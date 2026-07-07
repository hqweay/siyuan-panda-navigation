import { BuiltinCommand } from "./types";
import { showMessage } from "siyuan";
import { sql } from "../api";
import { getCurrentDocId, openBlockByID } from "../myscripts/syUtils";
import { navigation } from "../navigation";
import { createSiyuanAVHelper } from "../myscripts/dbUtil";

// 移除了针对 dailyNote 的引用，因为该功能已交由系统原生命令处理

export const builtinCommands: Record<string, BuiltinCommand> = {
    url: {
        id: "url",
        title: "URL 链接",
        requiresParam: true,
        paramPlaceholder: "https:// 或 siyuan://...",
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
    },
    goPrev: {
        id: "goPrev",
        title: "跳转上一个文档",
        requiresParam: false,
        execute: async (plugin) => {
            const currentDocId = getCurrentDocId();
            if (!currentDocId) return;
            // Get current doc info
            const res = await sql(`SELECT * FROM blocks WHERE id = '${currentDocId}' LIMIT 1`);
            if (res && res.length > 0) {
                const parentId = res[0].parent_id;
                const sort = res[0].sort;
                
                // Get prev sibling document
                let query = '';
                if (parentId) {
                    query = `SELECT * FROM blocks WHERE type = 'd' AND parent_id = '${parentId}' AND sort < ${sort} ORDER BY sort DESC LIMIT 1`;
                } else {
                    // Top level documents in the same notebook
                    const box = res[0].box;
                    // For top level documents, parent_id is empty. We look for docs with empty parent_id in the same box.
                    query = `SELECT * FROM blocks WHERE type = 'd' AND box = '${box}' AND parent_id = '' AND sort < ${sort} ORDER BY sort DESC LIMIT 1`;
                }
                const siblingsRes = await sql(query);
                if (siblingsRes && siblingsRes.length > 0) {
                    openBlockByID(siblingsRes[0].id);
                } else {
                    showMessage("当前文档没有上一个相邻文档");
                }
            }
        }
    }
};

export const builtinCommandList = Object.values(builtinCommands);
