import { request } from "@/api";
import { isMobile, plugin } from "@/utils";
import {
  getActiveEditor,
  getFrontend,
  openMobileFileById,
  openTab,
  showMessage,
} from "siyuan";
import { goToRandomBlock } from "./randomDocCache";
import { openByMobile } from "../utils";
import { getLogger } from "@/libs/logger";
const log = getLogger("syUtils");


export async function addProtyleSlash(slash: any) {
  for (let i = 0; i < plugin.protyleSlash.length; i++) {
    if (plugin.protyleSlash[i].id === slash.id) {
      return;
    }
  }
  plugin.protyleSlash.push(slash);
}

const BlockIDPattern = /^\d{14,}-\w{7}$/;
export function isBlockID(id: string): boolean {
  return BlockIDPattern.test(id);
}

export function isNotebookID(id: string): boolean {
  return id.startsWith("20") && id.length === 14;
}

export function isAssetID(id: string): boolean {
  return id.startsWith("assets/");
}

export function isFileAnnotationID(id: string): boolean {
  return id.startsWith("fileannotation-");
}

export function isFileAnnotationBlockID(id: string): boolean {
  return id.startsWith("fileannotation-block_");
}

export function getCurrentDocId(): string {
  return isMobile
    ? window.siyuan.mobile.editor.protyle.block.id
    : document
        .querySelector(
          ".layout__wnd--active .protyle.fn__flex-1:not(.fn__none) .protyle-background"
        )
        ?.getAttribute("data-node-id");
}

export const getCurrentDoc = (): {} | null => {
  // 原生函数获取当前文档 protyle https://github.com/siyuan-note/siyuan/issues/15415
  const editor = getActiveEditor(false);
  const protyle = editor?.protyle;
  if (
    !protyle ||
    !protyle.block?.rootID ||
    !protyle.path ||
    !protyle.notebookId
  )
    return null;
  return {
    id: protyle.block.rootID,
    path: protyle.path,
    notebookId: protyle.notebookId,
  };
};
export function openBlockByID(id: string) {
  if (!isBlockID(id)) {
    return;
  }
  if (isMobile) {
    openMobileFileById(plugin.app, id);
  } else {
    openTab({
      app: plugin.app,
      doc: {
        id: id,
      },
    });
    // window.open(`siyuan://blocks/${id}`, "_blank");
  }
}

export function openByUrl(url) {
  url = url.trim();
  log.info("openByUrl:", url);
  if (!url) {
    showMessage("url为空");
    return;
  } else if (url.toLowerCase().startsWith("select ")) {
    goToRandomBlock(url);
  } else if (isBlockID(url)) {
    isMobile
      ? openMobileFileById(plugin.app, url)
      : window.open(`siyuan://blocks/${url}`, "_blank");
  } else if (url.toLowerCase().startsWith("siyuan://")) {
    plugin.eventBus.emit("open-siyuan-url-plugin", { url });
  } else {
    isMobile ? openByMobile(url) : window.open(url, "_blank");
  }
}
