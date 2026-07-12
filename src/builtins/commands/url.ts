import { BuiltinCommand } from "../types";
import { openByUrl } from "../../myscripts/syUtils";

export const urlCommand: BuiltinCommand = {
    id: "url",
    title: "自定义链接/文档ID",
    i18nKey: "lets-nav-helper.builtin.url",
    requiresParam: true,
    paramPlaceholder: "https:// 或 siyuan:// 或 文档ID...",
    execute: (plugin, param) => {
        if (param) openByUrl(param);
    }
};
