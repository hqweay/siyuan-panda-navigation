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
| 查询 AI 可用的 utils 函数列表 + 脚本上下文 API 参考 | MCP 工具 `panda-nav:get-script-context`（自动生成，无需手动同步） |

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
  requiresParam: false,            // 是否需要用户输入参数
  // 可选：参数输入方式（"text" | "textarea" | "select"）
  // inputType: "select",
  // 可选：静态选项列表（inputType === "select" 时使用）
  // paramOptions: [
  //   { label: "选项A", value: "a" },
  //   { label: "选项B", value: "b" },
  // ],
  // 可选：动态加载选项（如从 API 获取列表，inputType === "select" 时使用）
  // loadParamOptions: async () => {
  //   const res = await fetchSyncPost("/api/some/list", {});
  //   return (res?.data || []).map((item: any) => ({
  //     label: item.name,
  //     value: item.id,
  //   }));
  // },
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

### AI 发现机制与脚本生成约束

AI 智能体调用 MCP 工具 `panda-nav:get-script-context` 即可获取当前脚本执行的全部上下文。该工具返回三部分：
- **`utils`**：自定义工具函数列表（含参数签名和示例）
- **`scriptContext`**：结构化 API 参考，包含 `plugin`/`siyuan`/`window.siyuan` 的属性和方法速查、常见误区清单、最佳实践、参考链接
- **`availableTypes`**：可用的思源 SDK 类型文件路径列表；传入 `path` 参数可读取对应 `.d.ts` 源码

**🚨 [写脚本前的红线规定]** 
当用户要求"编写自定义 JS 脚本（script）"以新建一个动作按钮时，AI **绝对禁止**仅凭过去的记忆去假设思源核心 API。你必须：
1. 先调用 `panda-nav:get-script-context`（不带参数）获取完整的 `scriptContext` API 参考。
2. 仔细阅读 `scriptContext.commonPitfalls` 避免常见错误。如果对某个官方对象（如 `Tab`, `App`, `Plugin`）的属性 and 方法不确定，再次调用 `get-script-context` 传入 `path` 参数查阅官方源码（例如 `path: "types/layout/Tab.d.ts"`）。
3. 特别注意：**遵循“编辑器状态分流写入”原则**。获取编辑器必须使用 `siyuan.getActiveEditor(false)` 以防失焦。只有在“可编辑（`!editor.protyle.disabled`）且有活动光标”时才使用 `editor.insert(lute编译后的DOM)` 进行行内插入；在“只读模式或未聚焦文档”时，必须降级调用 REST API (`appendBlock`/`insertBlock`) 写入以确保 100% 成功。
4. 根据最新文档编写脚本代码，并通过 `add-action` 工具将其写入。

**开发者只要在 `commands` 下新增内置命令，或者在 `panda-utils.ts` 中新增工具，AI 就能全自动通过 MCP 认识它们，无需手动同步文档或修改注册代码！**

### 约束

- `meta` 字段必须是纯数据对象（不要引用外部变量），供 kernel 编译内联
- `fn` 的第一个参数固定为 `siyuan` SDK 模块，其余参数自定义
- `fn` 内部可使用 `siyuan.fetchSyncPost`、`siyuan.showMessage`、`siyuan.openTab` 等 SDK API

# MCP 工具参考 (AI 智能体使用)

## 配置管理

| 工具 | 用途 |
|------|------|
| `get-action-schema` | 返回所有合法字段值（type 枚举、动态生成的 builtinValues、commandValues、pluginCommandValues、icons、positions 等），**构造 action 前先调此工具** |
| `get-full-config` | 返回完整 config.json（含 menuItems + 所有设置项） |
| `list-actions` | 返回 menuItems 列表及其索引 |
| `add-action` | 添加单个 action（支持 `children` 和 `submenuLayout` 创建分组） |
| `batch-add-actions` | 批量添加 / 替换全部 actions（mode=append/replace） |
| `update-action` | 按索引更新 action（支持更新 `children` 和 `submenuLayout`） |
| `remove-action` | 按索引删除 action |

## 外观样式

| 工具 | 用途 |
|------|------|
| `get-style-schema` | 返回所有可用的 CSS 变量及其类型、默认值、约束（调 `set-style` 前先查） |
| `set-style` | 设置单个 CSS 变量值（导航栏或二级菜单样式） |
| `reset-style` | 重置一个或所有样式变量为默认值 |

## 全局钩子

| 工具 | 用途 |
|------|------|
| `set-click-hook` | 创建/更新点击钩子（before/after/replace 模式，可匹配按钮 actionKey/类型/标题） |
| `remove-click-hook` | 按钩子 id 删除钩子 |
| `list-click-hooks` | 列出所有钩子及其配置 |

## 脚本工具发现

| 工具 | 用途 |
|------|------|
| `get-script-context` | 返回 `utils` 函数列表 + `scriptContext` API 参考（plugin/siyuan/window.siyuan 速查 + 常见误区 + 最佳实践） + `availableTypes` 类型文件列表。写 script 前必查，遇未知对象传入 `path` 参数深查 |

## ⚠️ 编辑器命令（editor::）注意事项

编辑器命令（`editor::category::key`）**依赖用户在思源设置中手动分配的自定义快捷键**。如果用户没有为该命令设置快捷键，按钮点击后会报错"找不到对应的快捷键配置"。

**配置按钮时的 type 优先级**：
1. `builtin` — 最高优先级，内置功能不依赖快捷键
2. `command`（系统命令，如 `dailyNote`）— 次优先级
3. `pluginCommand` — 第三方插件命令
4. `editor::` — **最低优先级**，仅在以上都不匹配时使用，且必须确认用户已配置快捷键

## 分组（Group）配置

`add-action` 和 `update-action` 支持创建分组按钮（二级菜单）：

```json
{
  "title": "工具箱",
  "type": "group",
  "icon": "#iconMenu",
  "submenuLayout": "list",
  "children": [
    { "title": "搜索", "type": "builtin", "value": "url", "param": "siyuan://api/search/" },
    { "title": "日记", "type": "builtin", "value": "dailyNote" }
  ]
}
```

- `submenuLayout`: `"list"`（纵向列表，显示文字）或 `"grid"`（图标网格）
- `children`: 子动作数组，schema 与父级相同（**不能嵌套 group**，仅支持一层）

## 构建命令

### 🚨 kernel.ts import 红线

`kernel.ts` 由 esbuild 打包后在 **goja**（Go 的 JS 运行时）中执行。goja **没有** DOM、`window`、`document`、`fetch`。

**禁止**从 `kernel.ts` import 任何包含浏览器端代码或 siyuan SDK 调用的模块（如 `src/utils.ts`），否则 esbuild 内联后会引发 goja 运行时错误（`Invalid module` / `RunScript: GoError`）。

安全做法：
- **纯函数**（字符串 hash、纯计算逻辑）→ 放入 `src/hash.ts` 这样的零依赖文件，`kernel.ts` 和前端都可以 import
- **需要 siyuan SDK** 的代码（`fetchSyncPost`、`showMessage` 等）→ 只能在 `panda-utils.ts` 中通过参数注入（`fn: async (siyuan) => {}`），不可在模块顶层 `import` siyuan
- 不确定时，先检查目标文件有没有 `import { ... } from "siyuan"` 或 `import { ... } from "./index"`、`./api` 等——有则不可在 kernel 侧 import

```ts
// ✅ 可以：零依赖纯函数
import { generateActionKey } from "./hash";

// ❌ 禁止：会拉入浏览器端代码
import { getActionKey } from "./utils";  // utils.ts 引用了 siyuan SDK、api.ts、index.ts
```

```bash
pnpm i18n:check         # 校验 i18n key 完整性（build/dev 前自动执行）
pnpm build              # 完整构建（前端 + kernel，含 i18n 校验）
pnpm dev                # 开发模式（前端 watch + kernel watch，自动部署到 SiYuan 插件目录，含 i18n 校验）
pnpm build:kernel       # 仅构建 kernel.js（输出到 dist/）
pnpm build:kernel:dev   # 仅构建 kernel.js（输出到 SiYuan 插件目录）
```**

# i18n 维护规范

本项目国际化仅有 `i18n/en_US.json` 和 `i18n/zh_CN.json` 两套文件，**不允许再新增其他 i18n 文件或目录**（已删除历史遗留的 `public/i18n/`）。

## 核心规则

1. **命名格式**：`lets-nav-helper.<模块>.<含义>`，点号分层。例如 `settings.saved`、`hooks.matchAllKeys`。**禁止**平铺式命名（如 `settingsSaved`、`hooksDeleted` — 这是已弃用的旧格式）。
2. **唯一数据源**：所有翻译只存在 `i18n/` 目录中。SiYuan 插件框架自动加载该目录。
3. **构建前自动校验**：`pnpm build` / `pnpm dev` 前会自动执行 `pnpm i18n:check`，扫描 `src/` 中所有 `plugin.i18n["..."]` 调用，确保每个 key 在 JSON 中都有对应条目。缺失则不通过。
4. **单独校验**：`pnpm i18n:check` 可随时手动运行，也会列出 JSON 中的废弃 key（代码未引用的）作为警告。

## 新增或修改 key

```ts
// ✅ 正确：分层命名
plugin.i18n["lets-nav-helper.settings.generalTab"]

// ❌ 禁止：平铺或非规范命名
plugin.i18n["lets-nav-helper.settingsGeneralTab"]
plugin.i18n["lets-nav-helper.GeneralTab"]
```

改完 JSON 后务必运行 `pnpm i18n:check` 确认两边一致。

# 文档规范 (Documentation Style)

当你被要求编写或更新面向用户的文档（如 `README.md`、`CHANGELOG.md`）时，**必须严格遵守以下“清爽克制”的风格**：
1. **去黑话（No Jargon）**：绝对不要向普通用户暴露深层架构的技术名词，如 `DOM`、`AST`、`Vite`、`MCP`、`高内聚低耦合`。把它们翻译成大白话（例如：“原生支持 MCP” -> “全面接入 AI 助手”，“原生 DOM transform 硬件加速” -> “拖动流畅无延迟”）。
2. **去浮夸（No Marketing Hype）**：禁止使用“革命性”、“神仙功能”、“极致的”、“无限潜能”等情绪化和夸张的带货词汇。保持描述客观、平实、简练。
3. **面向用户价值**：用大白话解释功能为用户解决了什么痛点（例如“不用担心遮挡笔记内容”），而不是展示底层的技术实现有多复杂。
