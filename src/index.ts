import { Plugin, Dialog, openTab, showMessage } from "siyuan";
import { generateDefaultMenuItems } from "./config/presets";
import { isMobile, setPlugin, mobileUtils, assignButtonIds } from "./utils";
import { normalizeMenuItems } from "./normalize";
import { navigation } from "./navigation";
import { settings } from "./settings";
import { getLogger } from "./libs/logger";
import { goToRandomBlock, preloadAllRandomDocCaches, getRandomBlockSql } from "./myscripts/randomDocCache";
import { openBlockByID } from "./myscripts/syUtils";
import { registerPlugin, unregisterPlugin } from "@frostime/siyuan-plugin-kits";

import NavigationContainer from "./components/NavigationContainer.svelte";
import SettingsPanel from "./components/SettingsPanel.svelte";

const log = getLogger("panda-navigation");

export class PandaNavigation extends Plugin {
  private mobileNavigationInstance: NavigationContainer | null = null;
  private desktopNavigationInstance: NavigationContainer | null = null;

  private visibilityListener: () => void = () => {};
  private resizeListener: () => void = () => {};
  private resizeTimeout: NodeJS.Timeout | null = null;
  private openSiyuanUrlListener: (event: CustomEvent<{ url: string }>) => void = () => {};

  async onload() {
    log.info("熊猫导航 - 正在载入插件...");
    registerPlugin(this);
    setPlugin(this);
    settings.init(this);

    // 载入持久化配置
    const data = await this.loadData("config.json");
    settings.data = data || {};

    // 规范化配置项
    if (settings.data.menuItems) {
      settings.data.menuItems = normalizeMenuItems(settings.data.menuItems);
    }
    if (settings.data.customPresets) {
      settings.data.customPresets = settings.data.customPresets.map((preset: any) => {
        if (preset && preset.menuItems) {
          preset.menuItems = normalizeMenuItems(preset.menuItems);
        }
        return preset;
      });
    }

    // 初始化默认配置
    this.initDefaultSettings();

    // 初始化移动端导航历史
    mobileUtils.init();
    navigation.init();

    this.setupKernelRpcListener();

    // 监听链接一键导入事件
    this.openSiyuanUrlListener = ({ detail }: CustomEvent<{ url: string }>) => {
      this.handlePluginUrlImport(detail.url);
    };
    this.eventBus.on("open-siyuan-url-plugin", this.openSiyuanUrlListener);

    // 注册键盘快捷命令
    this.addCommand({
      langKey: "lets-nav-helper.cmdRandom",
      hotkey: "⌥⌘R",
      callback: () => {
        goToRandomBlock(getRandomBlockSql());
      }
    });

  }

  async onLayoutReady() {
    log.info("熊猫导航 - 主界面已就绪，挂载导航栏...");

    // 挂载导航栏（根据设备类型和配置）
    this.handleSettingsChange();

    // 注册全局窗口与状态监听
    this.registerEventListeners();
  }

  async onunload() {
    log.info("熊猫导航 - 正在卸载插件...");
    unregisterPlugin();

    // 注销 MCP 工具
    const siyuan = (globalThis as any).siyuan;
    if (siyuan?.mcp?.unregisterTool) {
      await siyuan.mcp.unregisterTool("panda-nav:navigate");
      await siyuan.mcp.unregisterTool("panda-nav:random");
      await siyuan.mcp.unregisterTool("panda-nav:set-click-hook");
      await siyuan.mcp.unregisterTool("panda-nav:remove-click-hook");
      await siyuan.mcp.unregisterTool("panda-nav:list-click-hooks");
    }

    if (this.openSiyuanUrlListener) {
      this.eventBus.off("open-siyuan-url-plugin", this.openSiyuanUrlListener);
    }

    // 销毁 Svelte 实例
    if (this.mobileNavigationInstance) {
      this.mobileNavigationInstance.$destroy();
      this.mobileNavigationInstance = null;
    }

    if (this.desktopNavigationInstance) {
      this.desktopNavigationInstance.$destroy();
      this.desktopNavigationInstance = null;
    }

    // 清理事件监听器
    this.unregisterEventListeners();

    // 销毁导航工具
    mobileUtils.destroy();
    navigation.destroy();
  }

  // 接收思源核心分发的键盘显示事件
  mobilekeyboardshowEvent(eventData: any): void {
    this.hideNavigation();
  }

  // 接收思源核心分发的键盘隐藏事件
  mobilekeyboardhideEvent(eventData: any): void {
    if (this.showInMobile()) {
      this.showNavigation();
    }
  }

  // 插件设置面板入口
  async openSetting() {
    if (isMobile) {
      const dialog = new Dialog({
        title: this.i18n["lets-nav-helper.settings.dialogTitle"],
        content: `<div id="panda-nav-settings" style="height: 100%; overflow: auto;"></div>`,
        width: "92vw",
        height: "80vh",
      });

      new SettingsPanel({
        target: dialog.element.querySelector("#panda-nav-settings")!,
        props: {
          closeDialog: () => dialog.destroy(),
        },
      });
    } else {
      const tabId = this.name + "panda_settings_tab";
      openTab({
        app: this.app,
        custom: {
          icon: "iconSettings",
          title: this.i18n["lets-nav-helper.settings.tabTitle"],
          id: tabId,
        }
      }).then((tab) => {
        new SettingsPanel({
          target: tab.panelElement,
          props: {
            closeDialog: () => {
              const closeBtn = tab.headElement?.querySelector(".item__close") as HTMLElement;
              if (closeBtn) {
                closeBtn.click();
              } else {
                tab.parent?.removeTab(tab.id);
              }
            },
          },
        });
      }).catch((err) => {
        console.error("panda-nav: failed to open settings tab", err);
      });
    }
  }


  // 应用配置并重构导航栏
  handleSettingsChange(): void {
    const shouldShowMobile = isMobile && this.showInMobile();
    const shouldShowDesktop = !isMobile && this.showInPC();

    if (shouldShowMobile) {
      this.createMobileNavigation();
    } else if (shouldShowDesktop) {
      this.createDesktopNavigation();
    } else {
      if (this.mobileNavigationInstance) {
        this.mobileNavigationInstance.$destroy();
        this.mobileNavigationInstance = null;
      }
      if (this.desktopNavigationInstance) {
        this.desktopNavigationInstance.$destroy();
        this.desktopNavigationInstance = null;
      }
    }
  }

  private setupKernelRpcListener() {
    const kernel = (this as any).kernel;
    if (!kernel?.rpc?.bind) {
      log.warn("内核 RPC 不可用，MCP 配置热重载不生效");
      return;
    }

    kernel.rpc.bind("panda-nav:config-changed", async (params: { action: string; menuItems: any[]; styleOverrides: Record<string, string>; globalClickHooks?: any[] }) => {
      log.info("收到内核配置变更通知:", params.action);

      let changed = false;

      if (params.menuItems) {
        const normalizedItems = normalizeMenuItems(params.menuItems);
        const oldItems = settings.getBySpace("nav-helper", "menuItems");
        if (JSON.stringify(oldItems) !== JSON.stringify(normalizedItems)) {
          settings.setBySpace("nav-helper", "menuItems", normalizedItems);
          changed = true;
        }
      }

      if (params.styleOverrides) {
        const oldStyles = settings.getBySpace("nav-helper", "styleOverrides") || {};
        if (JSON.stringify(oldStyles) !== JSON.stringify(params.styleOverrides)) {
          settings.setBySpace("nav-helper", "styleOverrides", params.styleOverrides);
          changed = true;
        }
      }

      if (params.globalClickHooks) {
        const oldHooks = settings.getBySpace("nav-helper", "globalClickHooks") || [];
        if (JSON.stringify(oldHooks) !== JSON.stringify(params.globalClickHooks)) {
          settings.setBySpace("nav-helper", "globalClickHooks", params.globalClickHooks);
          changed = true;
        }
      }

      if (changed) {
        settings.save();
        this.handleSettingsChange();
      }
    });
  }

  private initDefaultSettings() {
    if (settings.getBySpace("nav-helper", "menuItems") === undefined) {
      let menuItems: any[] = generateDefaultMenuItems();

      // Migrate old legacy style keys to new styleOverrides before deleting
      const oldStyleKeyMap: Record<string, string> = {
        backgroundColor: "--nav-bg",
        buttonColor: "--nav-btn-color",
        activeButtonColor: "--nav-btn-active-color",
      };
      const styleOverrides: Record<string, string> = {};
      for (const [oldKey, varName] of Object.entries(oldStyleKeyMap)) {
        const val = settings.data[oldKey];
        if (val != null && val !== "") {
          styleOverrides[varName] = String(val);
        }
      }
      const existingOverrides = settings.getBySpace("nav-helper", "styleOverrides") || {};
      settings.setBySpace("nav-helper", "styleOverrides", { ...styleOverrides, ...existingOverrides });

      // Cleanup old settings to avoid saving legacy bloat
      const keysToRemove = [
        "showBackButton", "showForwardButton", "showDailyNoteButton",
        "showNavigationMenuButton", "showCustomLinksButton",
        "buttonOrder", "customActions",
        "backgroundColor", "buttonColor", "activeButtonColor"
      ];
      keysToRemove.forEach(k => {
        // @ts-ignore - Assuming we can delete or set to undefined
        delete settings.data[k];
      });

      settings.setBySpace("nav-helper", "menuItems", menuItems);
      // We still need other default settings
      if (settings.getBySpace("nav-helper", "enableBottomNav") === undefined) {
         settings.setBySpace("nav-helper", "enableBottomNav", "both");
      }
      if (settings.getBySpace("nav-helper", "noteBookID") === undefined) {
         settings.setBySpace("nav-helper", "noteBookID", "");
      }
      if (settings.getBySpace("nav-helper", "showButtonLabels") === undefined) {
         settings.setBySpace("nav-helper", "showButtonLabels", "both");
      }

      if (settings.getBySpace("nav-helper", "globalClickHooks") === undefined) {
        settings.setBySpace("nav-helper", "globalClickHooks", []);
      }

      if (settings.getBySpace("nav-helper", "stylePresets") === undefined) {
        settings.setBySpace("nav-helper", "stylePresets", []);
      }
      settings.save();
    }
  }

  private showInMobile(): boolean {
    const val = settings.getBySpace("nav-helper", "enableBottomNav");
    return val === "mobile" || val === "both";
  }

  private showInPC(): boolean {
    const val = settings.getBySpace("nav-helper", "enableBottomNav");
    return val === "pc" || val === "both";
  }

  private createMobileNavigation() {
    if (this.desktopNavigationInstance) {
      this.desktopNavigationInstance.$destroy();
      this.desktopNavigationInstance = null;
    }

    if (this.mobileNavigationInstance) {
      this.mobileNavigationInstance.$destroy();
      this.mobileNavigationInstance = null;
    }

    this.mobileNavigationInstance = new NavigationContainer({
      target: document.body,
      props: {
        deviceType: "mobile",
        isVisible: true,
      },
    });
  }

  private createDesktopNavigation() {
    if (this.mobileNavigationInstance) {
      this.mobileNavigationInstance.$destroy();
      this.mobileNavigationInstance = null;
    }

    if (this.desktopNavigationInstance) {
      this.desktopNavigationInstance.$destroy();
      this.desktopNavigationInstance = null;
    }

    this.desktopNavigationInstance = new NavigationContainer({
      target: document.body,
      props: {
        deviceType: "desktop",
        isVisible: true,
      },
    });
  }

  private hideNavigation(): void {
    if (this.mobileNavigationInstance) {
      this.mobileNavigationInstance.$set({ isVisible: false });
    }
    if (this.desktopNavigationInstance) {
      this.desktopNavigationInstance.$set({ isVisible: false });
    }
  }

  private showNavigation(): void {
    if (this.mobileNavigationInstance) {
      this.mobileNavigationInstance.$set({ isVisible: true });
    }
    if (this.desktopNavigationInstance) {
      this.desktopNavigationInstance.$set({ isVisible: true });
    }
  }

  private registerEventListeners(): void {
    // 监听页面可见性变化
    this.visibilityListener = () => {
      if (document.hidden) {
        this.hideNavigation();
      } else {
        const val = settings.getBySpace("nav-helper", "enableBottomNav");
        if (val && val !== "none") {
          this.showNavigation();
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityListener);

    // 监听窗口大小变化以响应设备类型调整
    this.resizeListener = () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => {
        this.handleSettingsChange();
      }, 300);
    };
    window.addEventListener("resize", this.resizeListener);
  }

  private unregisterEventListeners(): void {
    document.removeEventListener("visibilitychange", this.visibilityListener);
    window.removeEventListener("resize", this.resizeListener);
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
  }

  private handlePluginUrlImport(urlStr: string) {
    try {
      const url = new URL(urlStr);
      if (!url.pathname.includes("/import")) return;
      
      let actionCode = url.searchParams.get("action");
      let presetCode = url.searchParams.get("preset");
      
      if (actionCode) {
        actionCode = actionCode.replace(/ /g, "+");
        const decodedStr = decodeURIComponent(escape(atob(actionCode)));
        const action = JSON.parse(decodedStr);
        this.showImportConfirmDialog(action, "action");
      } else if (presetCode) {
        presetCode = presetCode.replace(/ /g, "+");
        const decodedStr = decodeURIComponent(escape(atob(presetCode)));
        const preset = JSON.parse(decodedStr);
        this.showImportConfirmDialog(preset, "preset");
      }
    } catch (e) {
      log.error("解析导入链接失败", e);
      showMessage(this.i18n["lets-nav-helper.share.invalidCode"] || "解析分享码失败，可能是内容已损坏", 6000, "error");
    }
  }

  private showImportConfirmDialog(data: any, type: "action" | "preset") {
    if (!data) return;

    const isAction = type === "action";
    const title = data.title || data.name || this.i18n["lets-nav-helper.buttonSettings.unnamed"];
    const displayType = isAction 
      ? (data.type === "group" ? this.i18n["lets-nav-helper.buttonSettings.typeGroup"] : this.i18n["lets-nav-helper.buttonSettings.typeAction"])
      : this.i18n["lets-nav-helper.share.importPreset"];

    let bodyHtml = "";
    if (isAction) {
      bodyHtml = `
        <div class="b3-form__space" style="margin-bottom: 12px; font-size: 14px; line-height: 1.5;">
          <strong>${this.i18n["lets-nav-helper.share.actionTitle"] || "标题："}</strong> ${title}<br/>
          <strong>${this.i18n["lets-nav-helper.share.actionType"] || "类型："}</strong> ${displayType}
        </div>
        <div class="b3-form__space" style="font-size: 13px; color: var(--b3-theme-on-surface-light);">
          ${this.i18n["lets-nav-helper.share.confirmImportAction"] || "确认追加此动作到菜单末尾吗？"}
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="b3-form__space" style="margin-bottom: 12px; font-size: 14px; line-height: 1.5;">
          <strong>${this.i18n["lets-nav-helper.share.importPreset"] || "检测到导入导航预设"}</strong>: ${title}
        </div>
        <div class="b3-form__space" style="font-size: 13px; color: var(--b3-theme-on-surface-light); margin-bottom: 12px;">
          ${this.i18n["lets-nav-helper.share.confirmImportPreset"] || "请选择预设导入方式："}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="import-mode" value="group" checked>
            <span>${this.i18n["lets-nav-helper.share.importPresetAsGroup"] || "追加为新菜单分组"}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="import-mode" value="replace">
            <span>${this.i18n["lets-nav-helper.share.importPresetAsReplace"] || "覆盖替换当前菜单"}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="import-mode" value="save">
            <span>${this.i18n["lets-nav-helper.share.importPresetSaveOnly"] || "仅保存至预设列表"}</span>
          </label>
        </div>
      `;
    }

    const dialog = new Dialog({
      title: this.i18n["lets-nav-helper.share.dialogTitle"] || "导入确认",
      content: `
        <div class="b3-dialog__content" style="padding: 16px;">
          ${bodyHtml}
        </div>
        <div class="b3-dialog__action" style="display: flex; justify-content: flex-end; padding: 12px 16px; background-color: var(--b3-theme-background-light);">
          <button class="b3-button b3-button--cancel" id="importCancelBtn">${this.i18n["lets-nav-helper.share.btnCancel"] || "取消"}</button>
          <div class="fn__space"></div>
          <button class="b3-button b3-button--text" id="importConfirmBtn">${this.i18n["lets-nav-helper.share.btnConfirm"] || "确认导入"}</button>
        </div>
      `,
      width: "420px",
    });

    dialog.element.querySelector("#importCancelBtn")?.addEventListener("click", () => dialog.destroy());
    dialog.element.querySelector("#importConfirmBtn")?.addEventListener("click", () => {
      if (isAction) {
        const importedAction = assignButtonIds(JSON.parse(JSON.stringify(data)));
        const menuItems = settings.getBySpace("nav-helper", "menuItems") || [];
        settings.setBySpace("nav-helper", "menuItems", [...menuItems, importedAction]);
        settings.save();
        this.notifySettingsChanged();
        showMessage(this.i18n["lets-nav-helper.share.importSuccess"] || "导入成功");
      } else {
        const checkedModeEl = dialog.element.querySelector('input[name="import-mode"]:checked') as HTMLInputElement;
        const mode = checkedModeEl ? checkedModeEl.value : "group";
        
        const presetName = data.name || this.i18n["lets-nav-helper.buttonSettings.unnamed"];
        const presetItems = data.menuItems || [];

        if (mode === "replace") {
          settings.setBySpace("nav-helper", "menuItems", JSON.parse(JSON.stringify(presetItems)));
          settings.save();
          this.notifySettingsChanged();
          showMessage(this.i18n["lets-nav-helper.share.importSuccess"] || "导入成功");
        } else if (mode === "group") {
          const newGroup = assignButtonIds({
            type: "group",
            title: presetName,
            icon: "#iconMenu",
            showOn: "both",
            submenuLayout: "list",
            children: JSON.parse(JSON.stringify(presetItems)),
          });
          const menuItems = settings.getBySpace("nav-helper", "menuItems") || [];
          settings.setBySpace("nav-helper", "menuItems", [...menuItems, newGroup]);
          settings.save();
          this.notifySettingsChanged();
          showMessage(this.i18n["lets-nav-helper.share.importSuccess"] || "导入成功");
        } else if (mode === "save") {
          const customPresets = settings.getBySpace("nav-helper", "customPresets") || [];
          const newPreset = {
            id: "preset-custom-" + Date.now(),
            name: presetName,
            menuItems: JSON.parse(JSON.stringify(presetItems)),
          };
          settings.setBySpace("nav-helper", "customPresets", [...customPresets, newPreset]);
          settings.save();
          this.notifySettingsChanged();
          showMessage(this.i18n["lets-nav-helper.share.importSuccess"] || "导入成功");
        }
      }
      dialog.destroy();
    });
  }

  private notifySettingsChanged() {
    this.handleSettingsChange();
    window.dispatchEvent(new CustomEvent("panda-nav-settings-imported"));
  }
}

export default PandaNavigation;
