import { getFrontend } from "siyuan";
import { getBlockByID } from "./api";
import { getCurrentDocId } from "./myscripts/syUtils";
import { getLogger } from "./libs/logger";
import { PandaNavigation } from "./index";

const log = getLogger("panda-nav-utils");

/**
 * 移动端环境检测
 */
export const isMobile =
  getFrontend() === "mobile" || getFrontend() === "browser-mobile";

/**
 * PC端环境检测（桌面端）
 */
export const isDesktop = !isMobile;

/**
 * 全局插件实例桥接
 */
export let plugin: PandaNavigation;

export function setPlugin(p: PandaNavigation) {
  plugin = p;
}

/**
 * 移动端工具类
 */
class MobileUtils {
  private initialized = false;

  private visibilityListener: () => void = () => {};
  private onlineListener: () => void = () => {};
  private offlineListener: () => void = () => {};
  private orientationListener: () => void = () => {};

  init(): void {
    if (this.initialized) return;

    log.info("移动端工具初始化");
    this.initialized = true;
    this.setupMobileEventListeners();
  }

  destroy(): void {
    if (!this.initialized) return;

    log.info("移动端工具销毁");

    document.removeEventListener("visibilitychange", this.visibilityListener);
    if ("navigator" in window && "onLine" in navigator) {
      window.removeEventListener("online", this.onlineListener);
      window.removeEventListener("offline", this.offlineListener);
    }
    window.removeEventListener("orientationchange", this.orientationListener);

    this.initialized = false;
  }

  private setupMobileEventListeners(): void {
    this.visibilityListener = () => {
      if (document.hidden) {
        log.info("页面隐藏");
      } else {
        log.info("页面显示");
      }
    };
    document.addEventListener("visibilitychange", this.visibilityListener);

    if ("navigator" in window && "onLine" in navigator) {
      this.onlineListener = () => log.info("网络连接恢复");
      window.addEventListener("online", this.onlineListener);

      this.offlineListener = () => log.info("网络连接断开");
      window.addEventListener("offline", this.offlineListener);
    }

    this.orientationListener = () => {
      setTimeout(() => {
        // orientation change handled in Svelte
      }, 100);
    };
    window.addEventListener("orientationchange", this.orientationListener);
  }

  async getCurrentDoc(): Promise<any> {
    const docId = getCurrentDocId();
    if (!docId) {
      throw new Error(plugin.i18n["lets-nav-helper.cannotGetDocId"]);
    }

    try {
      return await getBlockByID(docId);
    } catch (error) {
      log.error("获取当前文档信息失败:", error);
      throw error;
    }
  }

  isInMainDocument(): boolean {
    try {
      const currentPath = window.location.pathname;
      return (
        currentPath.includes("/mobile/") ||
        currentPath.includes("/editor/") ||
        isMobile
      );
    } catch (error) {
      log.error("检查主文档界面失败:", error);
      return false;
    }
  }

  showMobileMessage(
    message: string,
    type: "info" | "success" | "error" = "info",
  ): void {
    if ((window as any).showMessage) {
      (window as any).showMessage(message);
    } else {
      alert(message);
    }
  }

  vibrate(pattern: number | number[] = 100): void {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        log.warn("振动反馈失败:", error);
      }
    }
  }

  preventDefault(e: Event): void {
    if (e.cancelable) {
      e.preventDefault();
    }
  }

  stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  isTouchDevice(): boolean {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }

  getDeviceInfo(): {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  } {
    const width = window.innerWidth;

    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
    };
  }

  safeExecute(
    fn: () => void,
    errorMessage: string = plugin.i18n["lets-nav-helper.execFailed"],
  ): void {
    try {
      fn();
    } catch (error) {
      log.error(errorMessage, error);
      this.showMobileMessage(errorMessage, "error");
    }
  }

  delayExecute(fn: () => void, delay: number = 100): NodeJS.Timeout {
    return setTimeout(() => {
      this.safeExecute(fn);
    }, delay);
  }

  throttle(func: Function, delay: number): Function {
    let timeoutId: NodeJS.Timeout;
    let lastExecTime = 0;
    return (...args: any[]) => {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        func.apply(null, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(
          () => {
            func.apply(null, args);
            lastExecTime = Date.now();
          },
          delay - (currentTime - lastExecTime),
        );
      }
    };
  }

  debounce(func: Function, delay: number): Function {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }
}

// 创建全局实例
export const mobileUtils = new MobileUtils();

// 简单的 openByMobile 辅助，移自原来的 myscripts/utils.ts
export const openByMobile = (uri: string) => {
  if (!uri) return;

  const isInIOS = () =>
    window.siyuan.config.system.container === "ios" &&
    window.webkit?.messageHandlers;
  const isInAndroid = () =>
    window.siyuan.config.system.container === "android" && window.JSAndroid;
  const isInHarmony = () =>
    window.siyuan.config.system.container === "harmony" && window.JSHarmony;

  if (isInIOS()) {
    if (uri.startsWith("assets/")) {
      window.webkit.messageHandlers.openLink.postMessage(
        location.origin +
          "/assets/" +
          encodeURIComponent(uri.replace("assets/", "")),
      );
    } else if (uri.startsWith("/")) {
      window.webkit.messageHandlers.openLink.postMessage(location.origin + uri);
    } else {
      try {
        new URL(uri);
        window.webkit.messageHandlers.openLink.postMessage(uri);
      } catch (e) {
        window.webkit.messageHandlers.openLink.postMessage("https://" + uri);
      }
    }
  } else if (isInAndroid()) {
    window.JSAndroid.openExternal(uri);
  } else if (isInHarmony()) {
    window.JSHarmony.openExternal(uri);
  } else {
    window.open(uri);
  }
};

/**
 * 生成唯一ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function generateActionKey(item: { title: string; type: string; value?: string }): string {
  const seed = `${item.type}:${item.value || ""}:${item.title}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return "b" + Math.abs(hash).toString(36).padStart(6, "0");
}

export function getActionKey(item: any): string {
  return item.actionKey || generateActionKey(item);
}

export function assignButtonIds<T extends Record<string, any>>(item: T): T {
  item.id = generateId();
  item.actionKey = generateActionKey(item);
  if (Array.isArray(item.children)) {
    item.children.forEach(assignButtonIds);
  }
  return item;
}


