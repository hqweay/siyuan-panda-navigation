import { BuiltinCommand } from "./types";
import { showMessage } from "siyuan";
import { sql } from "../api";
import { getCurrentDocId, openBlockByID } from "../myscripts/syUtils";
import { navigation } from "../navigation";
import { createSiyuanAVHelper } from "../myscripts/dbUtil";

// For daily note we'll import it from wherever it is or reimplement.
// Since createDailyNote uses UI flow in NavigationContainer, we might just re-export it from utils,
// or we can implement it cleanly here. For now, let's keep it simple.
import { createDailynote } from "@frostime/siyuan-plugin-kits";
import { lsNotebooks } from "../api";
import { settings } from "../settings";
import { mobileUtils } from "../utils";

export const builtinCommands: Record<string, BuiltinCommand> = {
    url: {
        id: "url",
        title: "URL 链接",
        requiresParam: true,
        paramPlaceholder: "https://...",
        execute: (plugin, param) => {
            if (param) window.open(param);
        }
    },
    sql: {
        id: "sql",
        title: "随机 SQL",
        requiresParam: true,
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
    },
    "av-add": {
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
    },
    goBack: {
        id: "goBack",
        title: "后退",
        requiresParam: false,
        execute: () => {
            navigation.goBack();
        }
    },
    goForward: {
        id: "goForward",
        title: "前进",
        requiresParam: false,
        execute: () => {
            navigation.goForward();
        }
    },
    navigationMenu: {
        id: "navigationMenu",
        title: "导航菜单",
        requiresParam: false,
        execute: () => {
            // This is special, we might need to handle it in the UI layer 
            // since it opens a popup relative to the button event.
            // For now, we leave it here and let the UI layer intercept it.
        }
    },
    "open-setting": {
        id: "open-setting",
        title: "打开设置",
        requiresParam: false,
        execute: (plugin) => {
            plugin.openSetting();
        }
    },
    dailyNote: {
        id: "dailyNote",
        title: "今日日记",
        requiresParam: false,
        execute: async (plugin) => {
            // Simplified execution, falls back to the old logic or we just execute it directly.
            // It's better to implement the core logic here.
            const noteBookID = settings.getBySpace(plugin.name, "noteBookID");
            if (!noteBookID) {
                showMessage("请先在设置中选择日记笔记本");
                plugin.openSetting();
                return;
            }
            try {
                const res = await lsNotebooks();
                const notebookExists = res?.notebooks?.some((nb: any) => nb.id === noteBookID && !nb.closed);
                if (!notebookExists) {
                    showMessage(`日记笔记本不存在或已关闭，请重新设置`);
                    settings.setBySpace(plugin.name, "noteBookID", "");
                    await settings.save();
                    plugin.openSetting();
                    return;
                }
                const today = new Date();
                const dailyNoteId = await createDailynote(noteBookID, today);
                if (dailyNoteId) {
                    openBlockByID(dailyNoteId);
                    showMessage(plugin.i18n["lets-nav-helper.dailyNoteCreated"]);
                    mobileUtils.vibrate(50);
                } else {
                    showMessage(plugin.i18n["lets-nav-helper.dailyNoteFailed"]);
                }
            } catch (error) {
                console.error("创建今日笔记失败:", error);
                showMessage(plugin.i18n["lets-nav-helper.dailyNoteFailed"]);
            }
        }
    },
    goParent: {
        id: "goParent",
        title: "跳转父文档",
        requiresParam: false,
        execute: async (plugin) => {
            const currentDocId = getCurrentDocId();
            if (!currentDocId) return;
            const res = await sql(`SELECT * FROM blocks WHERE id = '${currentDocId}' LIMIT 1`);
            if (res && res.length > 0) {
                const parentId = res[0].parent_id;
                if (parentId) {
                    openBlockByID(parentId);
                } else {
                    showMessage("当前文档已经是顶层文档");
                }
            }
        }
    },
    goChild: {
        id: "goChild",
        title: "跳转子文档",
        requiresParam: false,
        execute: async (plugin) => {
            const currentDocId = getCurrentDocId();
            if (!currentDocId) return;
            // Get the first child document
            const res = await sql(`SELECT * FROM blocks WHERE type = 'd' AND parent_id = '${currentDocId}' ORDER BY sort ASC LIMIT 1`);
            if (res && res.length > 0) {
                openBlockByID(res[0].id);
            } else {
                showMessage("当前文档没有子文档");
            }
        }
    },
    goNext: {
        id: "goNext",
        title: "跳转下一个文档",
        requiresParam: false,
        execute: async (plugin) => {
            const currentDocId = getCurrentDocId();
            if (!currentDocId) return;
            // Get current doc info
            const res = await sql(`SELECT * FROM blocks WHERE id = '${currentDocId}' LIMIT 1`);
            if (res && res.length > 0) {
                const parentId = res[0].parent_id;
                const sort = res[0].sort;
                
                // Get next sibling document
                let query = '';
                if (parentId) {
                    query = `SELECT * FROM blocks WHERE type = 'd' AND parent_id = '${parentId}' AND sort > ${sort} ORDER BY sort ASC LIMIT 1`;
                } else {
                    // Top level documents in the same notebook
                    const box = res[0].box;
                    const path = res[0].path;
                    // For top level documents, parent_id is empty. We look for docs with empty parent_id in the same box.
                    query = `SELECT * FROM blocks WHERE type = 'd' AND box = '${box}' AND parent_id = '' AND sort > ${sort} ORDER BY sort ASC LIMIT 1`;
                }
                const siblingsRes = await sql(query);
                if (siblingsRes && siblingsRes.length > 0) {
                    openBlockByID(siblingsRes[0].id);
                } else {
                    showMessage("当前文档没有下一个相邻文档");
                }
            }
        }
    }
};

export const builtinCommandList = Object.values(builtinCommands);
