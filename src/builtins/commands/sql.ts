import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";
import { sql } from "../../api";
import { openBlockByID } from "../../myscripts/syUtils";

export const sqlCommand: BuiltinCommand = {
    id: "sql",
    title: "高级随机漫游 (SQL)",
    requiresParam: true,
    inputType: "textarea",
    paramPlaceholder: "SELECT id FROM blocks...",
    execute: async (plugin, param) => {
        if (!param) return;
        try {
            const res = await sql(param);
            if (res && res.length > 0) {
                const randomBlock = res[Math.floor(Math.random() * res.length)];
                openBlockByID(randomBlock.id);
            } else {
                showMessage("SQL未查询到结果");
            }
        } catch (err) {
            console.error("SQL查询失败:", err);
            showMessage("SQL查询失败");
        }
    }
};
