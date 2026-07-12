import { BuiltinCommand } from "../types";
import { showMessage, getActiveEditor } from "siyuan";
import { getBlockByID, listDocsByPath } from "../../api";
import { getCurrentDocId, openBlockByID } from "../../myscripts/syUtils";
import { navigation } from "../../navigation";
import { goToRandomBlock, getRandomBlockSql } from "../../myscripts/randomDocCache";

export const goBackCommand: BuiltinCommand = {
    id: "goBack",
    title: "后退",
    i18nKey: "lets-nav-helper.builtin.goBack",
    requiresParam: false,
    execute: () => {
        navigation.goBack();
    }
};

export const goForwardCommand: BuiltinCommand = {
    id: "goForward",
    title: "前进",
    i18nKey: "lets-nav-helper.builtin.goForward",
    requiresParam: false,
    execute: () => {
        navigation.goForward();
    }
};

const listChildDocs = async (box: string, path: string) => {
    let data = await listDocsByPath(box, path);
    return data?.files || [];
};

const getSibling = async (path: string, box: string) => {
    path = path.replace(".sy", "");
    const parts = path.split("/");
    if (parts.length > 0) {
        parts.pop();
    }
    let parentPath = parts.join("/");
    parentPath = parentPath || "/";
    return await listChildDocs(box, parentPath);
};

const goToSibling = async (delta: -1 | 1, plugin?: any) => {
    let docId = getCurrentDocId();
    if (!docId) return;
    let doc = await getBlockByID(docId);
    if (!doc) return;
    let { path, box } = doc;

    let siblings = await getSibling(path, box);
    if (!siblings || siblings.length === 0) return;
    
    let index = siblings.findIndex((sibling: any) => sibling.path === path);
    if (index === -1) return;
    
    if (delta < 0 && index == 0) {
        if (plugin) showMessage(plugin.i18n["lets-nav-helper.builtin.isFirstSibling"]);
        return;
    }
    if (delta > 0 && index == siblings.length - 1) {
        if (plugin) showMessage(plugin.i18n["lets-nav-helper.builtin.isLastSibling"]);
        return;
    }

    let newIndex = (index + delta + siblings.length) % siblings.length;
    openBlockByID(siblings[newIndex].id);
};

async function getParentDocument(path: string) {
    let pathArr = path.split("/").filter((item) => item != "");
    pathArr.pop();
    if (pathArr.length == 0) {
        return null;
    } else {
        let id = pathArr[pathArr.length - 1];
        return getBlockByID(id);
    }
}

export const goParentCommand: BuiltinCommand = {
    id: "goParent",
    title: "跳转父文档",
    i18nKey: "lets-nav-helper.builtin.goParent",
    requiresParam: false,
    execute: async (plugin) => {
        const currentDocId = getCurrentDocId();
        if (!currentDocId) return;
        const doc = await getBlockByID(currentDocId);
        if (!doc) return;
        const parent = await getParentDocument(doc.path);
        if (parent) {
            openBlockByID(parent.id);
        } else {
            showMessage(plugin.i18n["lets-nav-helper.builtin.isTopmostDoc"]);
        }
    }
};

export const goChildCommand: BuiltinCommand = {
    id: "goChild",
    title: "跳转子文档",
    i18nKey: "lets-nav-helper.builtin.goChild",
    requiresParam: false,
    execute: async (plugin) => {
        const currentDocId = getCurrentDocId();
        if (!currentDocId) return;
        const doc = await getBlockByID(currentDocId);
        if (!doc) return;
        const children = await listChildDocs(doc.box, doc.path);
        if (children && children.length > 0) {
            openBlockByID(children[0].id);
        } else {
            if (plugin) showMessage(plugin.i18n["lets-nav-helper.builtin.noChildDocument"]);
        }
    }
};

export const goNextCommand: BuiltinCommand = {
    id: "goNext",
    title: "跳转下一个文档",
    i18nKey: "lets-nav-helper.builtin.goNext",
    requiresParam: false,
    execute: async (plugin) => {
        await goToSibling(1, plugin);
    }
};

export const goPrevCommand: BuiltinCommand = {
    id: "goPrev",
    title: "跳转上一个文档",
    i18nKey: "lets-nav-helper.builtin.goPrev",
    requiresParam: false,
    execute: async (plugin) => {
        await goToSibling(-1, plugin);
    }
};

export const scrollToTopCommand: BuiltinCommand = {
    id: "scrollToTop",
    title: "返回顶部",
    i18nKey: "lets-nav-helper.builtin.scrollToTop",
    requiresParam: false,
    execute: () => {
        const editor = getActiveEditor(false);
        editor?.protyle?.contentElement?.scrollTo({ top: 0, behavior: "smooth" });
    }
};

export const scrollToBottomCommand: BuiltinCommand = {
    id: "scrollToBottom",
    title: "滚动到底部",
    i18nKey: "lets-nav-helper.builtin.scrollToBottom",
    requiresParam: false,
    execute: () => {
        const editor = getActiveEditor(false);
        const el = editor?.protyle?.contentElement;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
    }
};

export const randomCommand: BuiltinCommand = {
    id: "random",
    title: "随机文档",
    i18nKey: "lets-nav-helper.builtin.random",
    requiresParam: false,
    execute: () => {
        goToRandomBlock(getRandomBlockSql());
    }
};

export const documentCommands = [
    goBackCommand, goForwardCommand, goParentCommand, 
    goChildCommand, goNextCommand, goPrevCommand,
    scrollToTopCommand, scrollToBottomCommand, randomCommand
];
