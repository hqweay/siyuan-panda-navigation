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

（无需第二步，不再需要手动维护元数据！）

**改 1 处文件**：`builtins/commands/*.ts`（新增功能后运行 `pnpm dev` 或 `pnpm build` 时，系统会自动提取 AST 生成对应的 `builtin-metas.ts`）

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

AI 智能体调用 MCP 工具 `panda-nav:get-capabilities` 即可查询当前 `utils` 支持的所有函数名、参数签名和示例代码。该工具的描述由 `src/kernel.ts` 结合 `pandaUtils` + 自动提取构建的 `builtinMetas` 生成。

**开发者只要在 `commands` 下新增内置命令，或者在 `panda-utils.ts` 中新增工具，AI 就能全自动通过 MCP 认识它们，无需手动同步文档或修改注册代码！**

### 约束

- `meta` 字段必须是纯数据对象（不要引用外部变量），供 kernel 编译内联
- `fn` 的第一个参数固定为 `siyuan` SDK 模块，其余参数自定义
- `fn` 内部可使用 `siyuan.fetchSyncPost`、`siyuan.showMessage`、`siyuan.openTab` 等 SDK API

# MCP 工具参考 (AI 智能体使用)

## 配置管理

| 工具 | 用途 |
|------|------|
| `get-action-schema` | 返回所有合法字段值（type 枚举、builtinValues、icons、positions 等），**构造 action 前先调此工具** |
| `get-full-config` | 返回完整 config.json（含 menuItems + 所有设置项） |
| `list-actions` | 返回 menuItems 列表及其索引 |
| `add-action` | 添加单个 action |
| `batch-add-actions` | 批量添加 / 替换全部 actions（mode=append/replace） |
| `update-action` | 按索引更新 action |
| `remove-action` | 按索引删除 action |

## 脚本工具发现

| 工具 | 用途 |
|------|------|
| `get-capabilities` | 返回 utils 对象中所有可用函数（含自定义工具 + 内置命令），含参数签名和示例 |

## 构建命令

```bash
pnpm build              # 完整构建（前端 + kernel）
pnpm dev                # 开发模式（前端 watch + kernel watch，自动部署到 SiYuan 插件目录）
pnpm build:kernel       # 仅构建 kernel.js（输出到 dist/）
pnpm build:kernel:dev   # 仅构建 kernel.js（输出到 SiYuan 插件目录）
```**

# 文档规范 (Documentation Style)

当你被要求编写或更新面向用户的文档（如 `README.md`、`CHANGELOG.md`）时，**必须严格遵守以下“清爽克制”的风格**：
1. **去黑话（No Jargon）**：绝对不要向普通用户暴露深层架构的技术名词，如 `DOM`、`AST`、`Vite`、`MCP`、`高内聚低耦合`。把它们翻译成大白话（例如：“原生支持 MCP” -> “全面接入 AI 助手”，“原生 DOM transform 硬件加速” -> “拖动流畅无延迟”）。
2. **去浮夸（No Marketing Hype）**：禁止使用“革命性”、“神仙功能”、“极致的”、“无限潜能”等情绪化和夸张的带货词汇。保持描述客观、平实、简练。
3. **面向用户价值**：用大白话解释功能为用户解决了什么痛点（例如“不用担心遮挡笔记内容”），而不是展示底层的技术实现有多复杂。
