import { Plugin, Dialog, openTab } from "siyuan";
import { generateDefaultMenuItems } from "./config/presets";
import { isMobile, setPlugin, mobileUtils } from "./utils";
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

    this.addTab({
      type: "panda_settings_tab",
      init() {
        this.element.innerHTML = `<div id="panda-nav-settings-tab" style="height: 100%; overflow: auto; background-color: var(--b3-theme-background);"></div>`;
        (this as any).settingsPanel = new SettingsPanel({
          target: this.element.querySelector("#panda-nav-settings-tab")!,
          props: {
            closeDialog: () => {
              // Not used in Tab context
            },
          },
        });
      },
      destroy() {
        if ((this as any).settingsPanel) {
          (this as any).settingsPanel.$destroy();
        }
      }
    });

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
  openSetting() {
    if (isMobile) {
      const dialog = new Dialog({
        title: "🐼 熊猫导航 设置",
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
      openTab({
        app: this.app,
        custom: {
          icon: "iconSettings",
          title: "熊猫导航 设置",
          id: this.name + "panda_settings_tab",
        }
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

    kernel.rpc.bind("panda-nav:config-changed", async (params: { action: string; menuItems: any[] }) => {
      log.info("收到内核配置变更通知:", params.action);

      if (!params.menuItems) return;

      const normalizedItems = normalizeMenuItems(params.menuItems);
      const oldItems = settings.getBySpace("nav-helper", "menuItems");
      if (JSON.stringify(oldItems) !== JSON.stringify(normalizedItems)) {
        settings.setBySpace("nav-helper", "menuItems", normalizedItems);
        settings.save();
        this.handleSettingsChange();
      }
    });
  }

  private initDefaultSettings() {
    if (settings.getBySpace("nav-helper", "menuItems") === undefined) {
      let menuItems: any[] = generateDefaultMenuItems();

      // Cleanup old settings to avoid saving legacy bloat (optional, but good practice)
      const keysToRemove = [
        "showBackButton", "showForwardButton", "showDailyNoteButton", 
        "showNavigationMenuButton", "showCustomLinksButton", 
        "buttonOrder", "customActions"
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
}

export default PandaNavigation;
