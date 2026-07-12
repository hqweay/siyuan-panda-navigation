import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";
import { goToRandomBlock } from "../../myscripts/randomDocCache";

export const sqlCommand: BuiltinCommand = {
    id: "sql",
    title: "高级随机漫游 (SQL)",
    i18nKey: "lets-nav-helper.builtin.sql",
    requiresParam: true,
    inputType: "textarea",
    paramPlaceholder: "SELECT id FROM blocks...",
    execute: async (plugin, param) => {
        if (!param) return;
        try {
            await goToRandomBlock(param);
        } catch (err) {
            console.error("随机漫游失败:", err);
            showMessage(plugin.i18n["lets-nav-helper.randomRoamFailed"]);
        }
    }
};
