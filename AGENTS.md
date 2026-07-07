# Reference Codebases

本项目基于思源笔记插件体系，以下本地路径是开发的主要参考来源。

## 快查表（优先查这里，禁止凭记忆假设 API 行为）

| 需求 | 查哪里 |
|------|--------|
| REST API 参数 / 返回值 | `vendor/siyuan/docs/API.zh-CN.md` |
| 块/行内元素数据格式（`.sy` 文件结构） | `vendor/siyuan/docs/SY-FORMAT.zh-CN.md` |
| 工作区目录结构 | `vendor/siyuan/docs/WORKSPACE.zh-CN.md` |
| 插件 API 用法（addCommand / addDock / addTab…） | `vendor/plugin-sample/src/index.ts` |
| 项目已封装的 API 函数 | `src/api.ts`（优先！不要直接看 node_modules） |
| 思源前端/内核具体实现细节 | `vendor/siyuan/app/` 或 `vendor/siyuan/kernel/` |
| 向 utils 暴露工具方法 | `src/utils/panda-utils.ts`（参考已有的 `sql` / `showMessage` 条目） |
| 新增内置命令（BuiltinCommand） | `src/builtins/commands/`（参考已有的 `document.ts`/`url.ts`） |
| 查询 AI 可用的 utils 函数列表 | MCP 工具 `panda-nav:get-capabilities`（自动生成，无需手动同步） |

## 路径说明

- `vendor/siyuan/docs/` — 官方文档，含完整的 REST API 列表、SY-FORMAT 块格式规范、工作区布局说明。**遇到 API 行为或参数格式有疑问时必查，禁止猜测。**
- `vendor/siyuan/` — 完整源码（Go 内核 + 前端 TS/Svelte）。**只读参考，禁止修改。** 适用于需要验证内部行为时深入查阅。
- `vendor/plugin-sample/` — 官方插件模板，展示 `Plugin` 类生命周期及标准 API 的惯用法。
- `src/api.ts` — 项目对 kernel REST API 的封装层。**优先使用已有函数；需要新接口时在此处添加再引用。**

# 扩展指南 (Adding Utilities & Builtins)

## 场景一：新增内置命令 (BuiltinCommand)

内置命令是导航栏按钮可选的 `type: "command"` 动作，由 `src/builtins/index.ts` 通过 `import.meta.glob` 自动扫描注册。

### 步骤

1. 在 `src/builtins/commands/` 下新建 `.ts` 文件，导出 `BuiltinCommand` 对象：

```ts
import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";

export const myCustomCommand: BuiltinCommand = {
  id: "myCustomCommand",           // 唯一 ID，供 menuItems 引用
  title: "自定义功能",              // 显示名称
  requiresParam: false,             // 是否需要用户输入参数
  execute: async (plugin, param) => {
    // plugin: PandaNavigation 实例
    // param: 用户输入的参数（requiresParam=true 时）
    showMessage("执行成功");
  },
};
```

2. 在 `src/utils/builtin-metas.ts` 中添加对应元数据（用于 MCP get-capabilities 发现）：

```ts
myCustomCommand: {
  name: "myCustomCommand",
  description: "自定义功能描述",
  parameters: [],                  // 无参数时留空数组
  example: "utils.myCustomCommand()",
},
```

**改 2 处文件**：`builtins/commands/*.ts` + `builtin-metas.ts`

## 场景二：向 utils 暴露工具方法

`utils` 对象可在自定义脚本中直接使用（`new Function("plugin", "siyuan", "utils", ...)`），数据来自 `src/utils/panda-utils.ts`。

### 步骤

在 `src/utils/panda-utils.ts` 中添加一条 `UtilEntry`：

```ts
getNotebooks: {
  meta: {
    name: "getNotebooks",
    description: "获取所有笔记本列表",
    parameters: [],
    example: 'const notebooks = await utils.getNotebooks()',
  },
  fn: async (siyuan) => {
    // siyuan: 从 "siyuan" 包导入的 SDK 对象（非 globalThis.siyuan）
    // 可使用 siyuan.fetchSyncPost, siyuan.showMessage, siyuan.openTab 等
    const res = await siyuan.fetchSyncPost("/api/notebook/lsNotebooks", {});
    return res?.data;
  },
},
```

**改 1 处文件**：`panda-utils.ts`（MCP 描述自动由 `kernel.ts` 编译内联，无需额外操作）

### AI 发现机制

AI 智能体调用 MCP 工具 `panda-nav:get-capabilities` 即可查询当前 `utils` 支持的所有函数名、参数签名和示例代码。该工具的描述由 `src/kernel.ts` 在构建时从 `pandaUtils` + `builtinMetas` 自动生成，新增函数后无需修改任何 MCP 注册代码。

### 约束

- `meta` 字段必须是纯数据对象（不要引用外部变量），供 kernel 编译内联
- `fn` 的第一个参数固定为 `siyuan` SDK 模块，其余参数自定义
- `fn` 内部可使用 `siyuan.fetchSyncPost`、`siyuan.showMessage`、`siyuan.openTab` 等 SDK API

## 构建命令

```bash
pnpm build              # 完整构建（前端 + kernel）
pnpm dev                # 开发模式（前端 watch + kernel watch，自动部署到 SiYuan 插件目录）
pnpm build:kernel       # 仅构建 kernel.js（输出到 dist/）
pnpm build:kernel:dev   # 仅构建 kernel.js（输出到 SiYuan 插件目录）
```**
