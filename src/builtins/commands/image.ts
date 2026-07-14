import { BuiltinCommand } from "../types";
import { showMessage, hideMessage, getActiveEditor, fetchSyncPost } from "siyuan";
import * as kits from "@frostime/siyuan-plugin-kits";

export const uploadImageCommand: BuiltinCommand = {
    id: "uploadImage",
    title: "上传并插入图片",
    i18nKey: "lets-nav-helper.builtin.uploadImage",
    requiresParam: false,
    execute: async (plugin) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = false;
        input.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;z-index:-1;";
        document.body.appendChild(input);

        input.oncancel = () => {
            input.remove();
        };

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
                input.remove();
                return;
            }
            try {
                showMessage(plugin.i18n["lets-nav-helper.builtin.uploading"] || "正在上传图片...", 0);
                const fd = new FormData();
                fd.append("assetsDirPath", "/assets/");
                fd.append("file[]", file);

                const headers: Record<string, string> = {};
                if (window.siyuan?.config?.apiToken) {
                    headers["Authorization"] = `Token ${window.siyuan.config.apiToken}`;
                }

                const resp = await fetch("/api/asset/upload", {
                    method: "POST",
                    headers: headers,
                    body: fd
                });
                hideMessage();

                const data = await resp.json();
                if (data.code !== 0) throw new Error(data.msg || "上传失败");

                const assetPath = data.data.succMap ? Object.values(data.data.succMap)[0] as string : null;
                if (!assetPath) {
                    const errFile = data.data.errFiles?.[0] || "文件处理异常";
                    throw new Error(errFile);
                }

                const md = `![${file.name}](${assetPath})`;
                const editor = getActiveEditor(false);
                let inserted = false;

                if (editor && !editor.protyle.disabled) {
                    const selection = window.getSelection();
                    let hasSelection = false;
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        if (editor.protyle.wysiwyg.element.contains(range.startContainer)) {
                            hasSelection = true;
                        }
                    }

                    if (hasSelection) {
                        let html = editor.protyle.lute.Md2BlockDOM(md);
                        html = editor.protyle.lute.BlockDOM2InlineBlockDOM(html);
                        editor.insert(html, false, true);
                        inserted = true;
                        showMessage(plugin.i18n["lets-nav-helper.builtin.imageInserted"] || "图片已插入", 2000);
                    }
                }

                if (!inserted) {
                    let docId = editor?.protyle?.block?.rootID;
                    if (!docId) {
                        docId = await kits.getActiveDoc();
                    }

                    if (docId) {
                        await fetchSyncPost("/api/block/appendBlock", {
                            data: md,
                            dataType: "markdown",
                            parentID: docId
                        });
                        showMessage(plugin.i18n["lets-nav-helper.builtin.imageAppended"] || "图片已追加到文档末尾", 2000);
                    } else {
                        showMessage(plugin.i18n["lets-nav-helper.noOpenDoc"] || "当前没有打开的文档", 3000, "error");
                    }
                }
            } catch (e: any) {
                hideMessage();
                showMessage((plugin.i18n["lets-nav-helper.execFailed"] || "执行失败") + ": " + e.message, 5000, "error");
            } finally {
                input.remove();
            }
        };
        input.click();
    }
};
