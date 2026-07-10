import { BuiltinCommand } from "../types";
import { showMessage, getActiveEditor } from "siyuan";
import { getBlockByID, listDocsByPath } from "../../api";
import { getCurrentDocId, openBlockByID } from "../../myscripts/syUtils";
import { navigation } from "../../navigation";
import { goToRandomBlock, getRandomBlockSql } from "../../myscripts/randomDocCache";

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

const goToSibling = async (delta: -1 | 1) => {
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
        showMessage("当前文档已经是第一篇相邻文档");
        return;
    }
    if (delta > 0 && index == siblings.length - 1) {
        showMessage("当前文档已经是最后一篇相邻文档");
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
            showMessage("当前文档已经是顶层文档");
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
        const doc = await getBlockByID(currentDocId);
        if (!doc) return;
        const children = await listChildDocs(doc.box, doc.path);
        if (children && children.length > 0) {
            openBlockByID(children[0].id);
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
        await goToSibling(1);
    }
};

export const goPrevCommand: BuiltinCommand = {
    id: "goPrev",
    title: "跳转上一个文档",
    requiresParam: false,
    execute: async (plugin) => {
        await goToSibling(-1);
    }
};

export const scrollToTopCommand: BuiltinCommand = {
    id: "scrollToTop",
    title: "返回顶部",
    requiresParam: false,
    execute: () => {
        const editor = getActiveEditor(false);
        editor?.protyle?.contentElement?.scrollTo({ top: 0, behavior: "smooth" });
    }
};

export const scrollToBottomCommand: BuiltinCommand = {
    id: "scrollToBottom",
    title: "滚动到底部",
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
