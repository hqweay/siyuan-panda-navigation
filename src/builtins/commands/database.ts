import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";
import { createSiyuanAVHelper } from "../../myscripts/dbUtil";
import { getCurrentDocId } from "../../myscripts/syUtils";

export const avAddCommand: BuiltinCommand = {
    id: "av-add",
    title: "添加到数据库",
    requiresParam: true,
    paramPlaceholder: "数据库ID或名称",
    execute: async (plugin, param) => {
        if (!param) return;
        try {
            const avHelper = await createSiyuanAVHelper(param);
            const currentDocId = getCurrentDocId();
            if (currentDocId) {
                await avHelper.addBlocks([currentDocId]);
                showMessage("已成功添加到属性视图/数据库");
            } else {
                showMessage("当前没有打开的文档");
            }
        } catch (err) {
            console.error("添加到数据库失败:", err);
            showMessage("添加到属性视图/数据库失败");
        }
    }
};
