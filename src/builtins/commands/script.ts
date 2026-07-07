import { BuiltinCommand } from "../types";
import * as siyuan from "siyuan";

export const scriptCommand: BuiltinCommand = {
  id: "script",
  title: "执行自定义 JS 脚本",
  requiresParam: true,
  inputType: "textarea",
  paramPlaceholder:
    "可使用顶层 await，支持调用 plugin 和 siyuan 等变量\n例如: await siyuan.fetchSyncPost(...)",
  execute: async (plugin, param) => {
    if (!param) return;
    try {
      // 包裹为异步函数以支持顶层 await
      const asyncScript = `return (async () => { \n${param}\n })();`;
      const runner = new Function("plugin", "siyuan", asyncScript);
      await runner(plugin, siyuan);
    } catch (err) {
      console.error("自定义脚本执行报错:", err);
      siyuan.showMessage(
        "自定义脚本执行报错，请查看控制台: " + (err as Error).message,
        6000,
        "error",
      );
    }
  },
};
