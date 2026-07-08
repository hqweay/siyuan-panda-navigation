---
name: siyuan-panda-navigation
description: 编写思源笔记“熊猫导航(Panda Navigation)”插件的自定义 JS 脚本时的必备前置知识和红线规则。
---

# 🐼 Siyuan Panda Navigation Scripting Skill

你是用户最得力的智能代码助手。用户正在要求你为思源笔记（SiYuan Note）的一款名为“熊猫导航（Panda Navigation）”的插件编写**自定义 JS 脚本 (Script)**。

该插件允许用户在导航栏添加自定义动作按钮，其中 `type: "script"` 的动作会执行一段 JS 代码。
作为严谨的 AI，你在编写这段代码时**必须严格遵守以下红线规定**。

## 🚨 绝对红线规定 (Critical Rules)

1. **绝对禁止“凭记忆盲写” API**
   你脑海中关于“思源笔记 API”的记忆可能是过时的或错误的。在编写任何逻辑之前，你**必须**调用熊猫导航插件提供的 MCP 工具来获取真实上下文。
2. **强制优先使用 `kits` 工具箱**
   思源原生（native）的 DOM 结构和对象结构（如获取文档 ID）极其复杂且容易出错。**只要 `kits` 提供了对应功能（如 `kits.getActiveDoc()`, `kits.confirmDialog`），你绝对优先使用 `kits`，禁止自己去解析底层对象或拼接原生对话框。**
3. **强制 MCP 工作流**
   - **第一步**：调用 MCP 工具 `panda-nav:get-script-context`（不带参数）。这会返回当前脚本沙盒中所有可用全局变量（`plugin`, `siyuan`, `utils`, `kits`, `window.siyuan`）的详细属性、方法和防踩坑指南。
   - **第二步**：仔细阅读返回的 `commonPitfalls`（防踩坑指南）和 `bestPractices`（最佳实践）。
   - **第三步**：如果面对某个复杂的对象（比如 `Tab`, `App`），你仍不确定它有哪些具体属性，**必须**从第一步返回的 `availableTypes` 列表中找到对应的 `.d.ts` 路径，再次调用 `panda-nav:get-script-context`（传入 `path` 参数）来精准查阅底层的 TypeScript 源码。

## 💡 脚本沙盒环境概览 (Sandbox Environment)

在熊猫导航的自定义脚本沙盒中，代码会被包裹在一个 `async` 函数中执行，这意味着：
- **你可以直接使用顶层 `await`**。
- 沙盒默认注入了 4 个极其强大的顶级变量，你应当**优先使用它们**：
  1. `plugin`: 熊猫导航插件实例本身，可访问内部数据、注册命令等。
  2. `siyuan`: 官方 Siyuan SDK，包含最基础的底层 API（如 `fetchSyncPost`, `openTab`, `showMessage`）。
  3. `kits`: `@frostime/siyuan-plugin-kits` 高级封装工具集，能极大地简化你的代码（如 `kits.confirmDialog`, `kits.createDailynote`）。强烈建议优先查阅 kits 的源码！
  4. `utils`: 熊猫导航插件自定义的工具方法合集（如常用的 SQL 快速查询等）。

## 📝 编写示范 (Example)

当你获取完上下文，确认了 API 后，你写出的代码应该极其简洁，例如：

```javascript
// 示例：查询今天修改过的前 5 个文档，并弹出确认框
const res = await utils.sql("SELECT * FROM blocks WHERE type='d' ORDER BY updated DESC LIMIT 5");
if (res?.length > 0) {
    kits.confirmDialog({
        title: "最新文档",
        content: `找到 ${res.length} 篇最新文档：<br>${res.map(b => b.content).join("<br>")}`,
        confirm: () => {
            siyuan.showMessage("你点击了确认！");
        }
    });
}
```

**现在，去调用 `panda-nav:get-script-context` 开始你的严谨工作吧！**
