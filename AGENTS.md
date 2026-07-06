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

## 路径说明

- `vendor/siyuan/docs/` — 官方文档，含完整的 REST API 列表、SY-FORMAT 块格式规范、工作区布局说明。**遇到 API 行为或参数格式有疑问时必查，禁止猜测。**
- `vendor/siyuan/` — 完整源码（Go 内核 + 前端 TS/Svelte）。**只读参考，禁止修改。** 适用于需要验证内部行为时深入查阅。
- `vendor/plugin-sample/` — 官方插件模板，展示 `Plugin` 类生命周期及标准 API 的惯用法。
- `src/api.ts` — 项目对 kernel REST API 的封装层。**优先使用已有函数；需要新接口时在此处添加再引用。**
