import { BuiltinCommand } from "../types";
import { showMessage, fetchSyncPost } from "siyuan";
import { createSiyuanAVHelper } from "../../myscripts/dbUtil";
import { getCurrentDocId } from "../../myscripts/syUtils";

export const avAddCommand: BuiltinCommand = {
    id: "av-add",
    title: "添加到数据库",
    i18nKey: "lets-nav-helper.builtin.avAdd",
    requiresParam: true,
    paramPlaceholder: "选择数据库",
    inputType: "select",
    loadParamOptions: async () => {
        try {
            const res = await fetchSyncPost("/api/av/searchAttributeView", {
                keyword: "",
                excludes: [],
            });
            const results = res?.data?.results || [];
            return results.map((b: any) => ({
                label: b.avName || "未命名数据库",
                value: b.blockID,
            }));
        } catch (e) {
            console.error("加载数据库列表失败", e);
            return [];
        }
    },
    execute: async (plugin, param) => {
        if (!param) return;
        try {
            const avHelper = await createSiyuanAVHelper(param);
            const currentDocId = getCurrentDocId();
            if (currentDocId) {
                await avHelper.addBlocks([currentDocId]);
                showMessage(plugin.i18n["lets-nav-helper.addToDBSuccess"]);
            } else {
                showMessage(plugin.i18n["lets-nav-helper.noOpenDoc"]);
            }
        } catch (err) {
            console.error("添加到数据库失败:", err);
            showMessage(plugin.i18n["lets-nav-helper.addToDBFailed"]);
        }
    }
};
