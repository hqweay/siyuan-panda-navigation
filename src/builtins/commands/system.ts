import { BuiltinCommand } from "../types";

export const openSettingCommand: BuiltinCommand = {
    id: "open-setting",
    title: "打开设置",
    requiresParam: false,
    execute: (plugin) => {
        plugin.openSetting();
    }
};
