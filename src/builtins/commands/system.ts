import { BuiltinCommand } from "../types";

export const openSettingCommand: BuiltinCommand = {
    id: "open-setting",
    title: "打开设置",
    i18nKey: "lets-nav-helper.builtin.openSetting",
    requiresParam: false,
    execute: (plugin) => {
        plugin.openSetting();
    }
};
