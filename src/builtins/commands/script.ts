import { BuiltinCommand } from "../types";
import * as siyuan from "siyuan";
import { builtinCommands } from "../index";
import { pandaUtils } from "../../utils/panda-utils";
import * as kits from "@frostime/siyuan-plugin-kits";

export const scriptCommand: BuiltinCommand = {
  id: "script",
  title: "执行自定义 JS 脚本",
  requiresParam: true,
  inputType: "textarea",
  paramPlaceholder:
    "可使用顶层 await，支持调用 plugin、siyuan、utils、kits 等变量，例如: await utils.sql(\"SELECT * FROM blocks LIMIT 5\")",
  execute: async (plugin, param) => {
    if (!param) return;
    try {
      const utils: Record<string, any> = {};

      for (const [k, v] of Object.entries(pandaUtils)) {
        utils[k] = (...args: any[]) => v.fn(siyuan, ...args);
      }

      for (const [id, cmd] of Object.entries(builtinCommands)) {
        if (id === "script") continue;
        if (cmd.requiresParam) {
          utils[id] = (param?: string) => cmd.execute(plugin, param);
        } else {
          utils[id] = () => cmd.execute(plugin);
        }
      }

      const asyncScript = `return (async () => { \n${param}\n })();`;
      const runner = new Function("plugin", "siyuan", "utils", "kits", asyncScript);
      await runner(plugin, siyuan, utils, kits);
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