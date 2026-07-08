import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";
import { goToRandomBlock } from "../../myscripts/randomDocCache";

export const sqlCommand: BuiltinCommand = {
    id: "sql",
    title: "高级随机漫游 (SQL)",
    requiresParam: true,
    inputType: "textarea",
    paramPlaceholder: "SELECT id FROM blocks...",
    execute: async (plugin, param) => {
        if (!param) return;
        try {
            await goToRandomBlock(param);
        } catch (err) {
            console.error("随机漫游失败:", err);
            showMessage("随机漫游失败");
        }
    }
};
