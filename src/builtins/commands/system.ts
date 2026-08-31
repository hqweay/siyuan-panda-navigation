import { BuiltinCommand } from "../types";
import { globalCommand } from "siyuan";
import { isMobile } from "../../utils";

// 打开熊猫插件自己的设置面板
export const openSettingCommand: BuiltinCommand = {
    id: "open-setting",
    title: "打开插件设置",
    i18nKey: "lets-nav-helper.builtin.openSetting",
    requiresParam: false,
    execute: (plugin) => {
        plugin.openSetting();
    }
};

// 打开思源全局设置。移动端等同原生底栏「更多」菜单（含全部设置入口）；桌面端打开思源设置面板
export const openSiyuanSettingCommand: BuiltinCommand = {
    id: "open-siyuan-setting",
    title: "打开思源设置",
    i18nKey: "lets-nav-helper.builtin.openSiyuanSetting",
    requiresParam: false,
    execute: (plugin) => {
        if (isMobile) {
            // 移动端：等同原生底栏「更多」按钮（popMenu），含全部设置入口
            globalCommand("mainMenu", plugin.app);
        } else {
            // 桌面端：打开思源全局设置面板
            globalCommand("config", plugin.app);
        }
    }
};
