import { BuiltinCommand } from "../types";
import { showMessage } from "siyuan";
import { sql } from "../../api";
import { getCurrentDocId, openBlockByID } from "../../myscripts/syUtils";
import { navigation } from "../../navigation";

export const goBackCommand: BuiltinCommand = {
    id: "goBack",
    title: "后退",
    requiresParam: false,
    execute: () => {
        navigation.goBack();
    }
};

export const goForwardCommand: BuiltinCommand = {
    id: "goForward",
    title: "前进",
    requiresParam: false,
    execute: () => {
        navigation.goForward();
    }
};

export const goParentCommand: BuiltinCommand = {
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
};

export const goChildCommand: BuiltinCommand = {
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
};

export const goNextCommand: BuiltinCommand = {
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
};

export const goPrevCommand: BuiltinCommand = {
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
};

export const documentCommands = [goBackCommand, goForwardCommand, goParentCommand, goChildCommand, goNextCommand, goPrevCommand];
