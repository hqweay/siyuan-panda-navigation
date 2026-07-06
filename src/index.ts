import { Plugin, Dialog, openTab } from "siyuan";
import { isMobile, setPlugin, mobileUtils } from "./utils";
import { navigation } from "./navigation";
import { settings } from "./settings";
import { getLogger } from "./libs/logger";
import { goToRandomBlock } from "./myscripts/randomDocCache";
import { openBlockByID } from "./myscripts/syUtils";
import { createDailynote, registerPlugin, unregisterPlugin } from "@frostime/siyuan-plugin-kits";

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

    // 注册键盘快捷命令
    this.addCommand({
      langKey: "lets-nav-helper.cmdRandom",
      hotkey: "⌥⌘R",
      callback: () => {
        const actions = settings.getBySpace("nav-helper", "customActions") || [];
        const sqlAction = actions.find((act: any) => act.type === "sql");
        const sql = sqlAction?.value || "SELECT id FROM blocks WHERE type = 'd'";
        goToRandomBlock(sql);
      }
    });

    this.addCommand({
      langKey: "lets-nav-helper.cmdDaily",
      hotkey: "⌥⌘D",
      callback: () => {
        const noteBookID = settings.getBySpace("nav-helper", "noteBookID");
        const today = new Date();
        createDailynote(noteBookID || "", today).then((id) => {
          if (id) {
            openBlockByID(id);
          }
        });
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
    const dialog = new Dialog({
      title: "🐼 熊猫导航 设置",
      content: `<div id="panda-nav-settings" style="height: 100%;"></div>`,
      width: isMobile ? "92vw" : "600px",
      height: "540px",
    });

    new SettingsPanel({
      target: dialog.element.querySelector("#panda-nav-settings")!,
      props: {
        closeDialog: () => dialog.destroy(),
      },
    });
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
    const defaultSettings: Record<string, any> = {
      enableBottomNav: "both",
      showBackButton: "both",
      noteBookID: "",
      showForwardButton: "both",
      showCustomLinksButton: "both",
      showDailyNoteButton: "both",
      showNavigationMenuButton: "both",
      showButtonLabels: "both",
      buttonOrder: [
        "showBackButton",
        "showDailyNoteButton",
        "showNavigationMenuButton",
        "showForwardButton",
        "showCustomLinksButton",
      ],
      customActions: [
        {
          title: "首页",
          type: "url",
          value: "siyuan://common/dashboard",
          icon: "#iconWorkspace",
          position: "navbar"
        },
        {
          title: "全局搜索",
          type: "command",
          value: "globalSearch",
          icon: "#iconSearch",
          position: "navbar"
        },
        {
          title: "随机漫游",
          type: "sql",
          value: "SELECT id FROM blocks WHERE type = 'd'",
          icon: "#iconRefresh",
          position: "submenu"
        },
        {
          title: "作者博客",
          type: "url",
          value: "https://leay.net/",
          icon: "#iconLink",
          position: "submenu"
        }
      ]
    };

    let modified = false;
    for (const key in defaultSettings) {
      if (settings.getBySpace("nav-helper", key) === undefined) {
        settings.setBySpace("nav-helper", key, defaultSettings[key]);
        modified = true;
      }
    }
    
    if (modified) {
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
