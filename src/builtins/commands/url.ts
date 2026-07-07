import { BuiltinCommand } from "../types";

export const urlCommand: BuiltinCommand = {
    id: "url",
    title: "URL 链接",
    requiresParam: true,
    paramPlaceholder: "https:// 或 siyuan://...",
    execute: (plugin, param) => {
        if (param) window.open(param);
    }
};
