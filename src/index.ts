import { Plugin, Dialog, openTab } from "siyuan";
import { isMobile, setPlugin, mobileUtils } from "./utils";
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

    // 初始化默认配置
    this.initDefaultSettings();

    // 初始化移动端导航历史
    mobileUtils.init();
    navigation.init();

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

  onunload() {
    log.info("熊猫导航 - 正在卸载插件...");
    unregisterPlugin();

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

  private initDefaultSettings() {
    if (settings.getBySpace("nav-helper", "menuItems") === undefined) {
      let menuItems: any[] = [];
      const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

      // First install or reset, new defaults
      menuItems = [
        { id: generateId(), type: "builtin", value: "goBack", title: "返回", icon: "#iconLeft", showOn: "both" },
        { id: generateId(), type: "command", value: "dailyNote", title: "今日日记", icon: "#iconCalendar", showOn: "both" },
        { id: generateId(), type: "builtin", value: "navigationMenu", title: "导航菜单", icon: "#iconMenu", showOn: "both" },
        { id: generateId(), type: "builtin", value: "goForward", title: "前进", icon: "#iconRight", showOn: "both" },
        {
          id: generateId(), type: "group", value: "", title: "快捷动作", icon: "#iconStar", showOn: "both",
          children: [
             { id: generateId(), type: "builtin", title: "首页", value: "url", param: "siyuan://common/dashboard", icon: "#iconWorkspace", showOn: "both" },
             { id: generateId(), type: "command", title: "全局搜索", value: "globalSearch", icon: "#iconSearch", showOn: "mobile" },
             { id: generateId(), type: "builtin", title: "随机漫游", value: "sql", param: "SELECT id FROM blocks WHERE type = 'd'", icon: "#iconRefresh", showOn: "both" },
             { id: generateId(), type: "builtin", title: "作者博客", value: "url", param: "https://leay.net/", icon: "#iconLink", showOn: "both" }
          ]
        }
      ];

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
