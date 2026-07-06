<script lang="ts">
import { getLogger } from "@/libs/logger";
const log = getLogger("lets-nav-helper");
  import { onMount, onDestroy } from "svelte";
  import { isMobile } from "../utils";
  import NavButton from "./NavButton.svelte";
  import Submenu from "./Submenu.svelte";
  import { navigation } from "../navigation";
  import { settings } from "@/settings";
  import { plugin } from "@/utils";
  import pluginMetadata from "../plugin";
  import { mobileUtils } from "../utils";
  import { createDailynote } from "@frostime/siyuan-plugin-kits";
  import { showMessage, Dialog, globalCommand } from "siyuan";
  import type { CustomAction } from "@/types";
  import { lsNotebooks } from "../api";
  import { createSiyuanAVHelper } from "@/myscripts/dbUtil";
  import { goToRandomBlock } from "@/myscripts/randomDocCache";
  import {
    getCurrentDocId,
    openBlockByID,
    openByUrl,
  } from "@/myscripts/syUtils";

  export let deviceType: "mobile" | "desktop" = "mobile";
  export let isVisible: boolean = true;

  let submenuVisible = false;
  let submenuType: "navigation" | "customLinks" | null = null;
  let submenuItems: any[] = [];
  let submenuTriggerButton: HTMLElement | null = null;



  // 滚动隐藏逻辑
  let isScrollingDown = false;
  let lastScrollTop = 0;

  function handleScroll(event: Event) {
    if (deviceType !== "mobile") return;
    
    const target = event.target as HTMLElement | Document;
    let currentScrollTop = 0;

    if (target === document || target === window) {
      currentScrollTop = window.scrollY || document.documentElement.scrollTop;
    } else {
      const el = target as HTMLElement;
      if (!el.classList || (!el.classList.contains("protyle-scroll") && !el.classList.contains("protyle-content"))) {
        return;
      }
      currentScrollTop = el.scrollTop;
    }
    
    if (currentScrollTop === undefined) return;
    // 设置一个防抖阈值，避免太敏感
    if (Math.abs(currentScrollTop - lastScrollTop) < 10) return;

    if (currentScrollTop > lastScrollTop) {
      isScrollingDown = true;
      if (submenuVisible) hideSubmenu();
    } else {
      isScrollingDown = false;
    }
    
    lastScrollTop = currentScrollTop;
  }

  // 导航按钮配置
  const buttonConfigs = [
    {
      key: "showBackButton",
      icon: "#iconLeft",
      label: plugin.i18n["lets-nav-helper.back"],
      show: settings.getBySpace(pluginMetadata.name, "showBackButton"),
      action: () => navigation.goBack(),
    },
    {
      key: "showDailyNoteButton",
      icon: "#iconCalendar",
      label: plugin.i18n["lets-nav-helper.dailyNote"],
      show: settings.getBySpace(pluginMetadata.name, "showDailyNoteButton"),
      action: () => createDailyNote(),
    },
    {
      key: "showNavigationMenuButton",
      icon: "#iconMenu",
      label: plugin.i18n["lets-nav-helper.navigation"],
      show: settings.getBySpace(
        pluginMetadata.name,
        "showNavigationMenuButton"
      ),
      action: (event) => showNavigationSubmenu(event),
      hasSubmenu: true,
    },
    {
      key: "showForwardButton",
      icon: "#iconRight",
      label: plugin.i18n["lets-nav-helper.forward"],
      show: settings.getBySpace(pluginMetadata.name, "showForwardButton"),
      action: () => navigation.goForward(),
    },
    {
      key: "showCustomLinksButton",
      icon: "#iconStar",
      label: plugin.i18n["lets-nav-helper.links"],
      show: settings.getBySpace(pluginMetadata.name, "showCustomLinksButton"),
      action: (event) => showCustomActionsSubmenu(event),
      hasSubmenu: true,
    },
  ];

  // 加载自定义动作
  let customActions: CustomAction[] = settings.getBySpace(pluginMetadata.name, "customActions") || [];

  // 动作执行分发
  async function executeCustomAction(action: CustomAction) {
    const { type, value, title } = action;
    if (type === "url") {
      openByUrl(value);
    } else if (type === "sql") {
      await goToRandomBlock(value);
    } else if (type === "command") {
      try {
        globalCommand(value, plugin.app);
      } catch (err) {
        log.error("执行内置命令失败:", err);
        showMessage("执行内置命令失败");
      }
    } else if (type === "av-add") {
      try {
        const avHelper = await createSiyuanAVHelper(value);
        await avHelper.addBlocks([getCurrentDocId()]);
        showMessage("已成功添加到属性视图/数据库");
      } catch (err) {
        log.error("添加到数据库失败:", err);
        showMessage("添加到属性视图/数据库失败");
      }
    }
  }

  // 过滤显示的内置按钮
  $: visibleBuiltInButtons = buttonConfigs.filter((btn) => {
    if (isMobile && btn.show === "mobile") return true;
    if (!isMobile && btn.show === "pc") return true;
    if (btn.show === "both") return true;
    return false;
  });

  // 处理自定义动作的位置分发与防溢出回退
  $: navbarActions = customActions.filter(a => a.position === "navbar");
  $: submenuActions = customActions.filter(a => a.position === "submenu");

  let finalNavbarActions: CustomAction[] = [];
  let finalSubmenuActions: CustomAction[] = [];

  $: {
    finalNavbarActions = [...navbarActions];
    finalSubmenuActions = [...submenuActions];

    if (isMobile && deviceType === "mobile") {
      const totalBuiltIn = visibleBuiltInButtons.length;
      const limit = 7;
      if (totalBuiltIn + finalNavbarActions.length > limit) {
        const allowedNavbarCount = Math.max(0, limit - totalBuiltIn);
        const overflowActions = finalNavbarActions.slice(allowedNavbarCount);
        finalNavbarActions = finalNavbarActions.slice(0, allowedNavbarCount);
        finalSubmenuActions = [...overflowActions, ...finalSubmenuActions];
      }
    }
  }

  $: allNavbarButtons = [
    ...visibleBuiltInButtons,
    ...finalNavbarActions.map((action, idx) => ({
      key: `custom-nav-${idx}`,
      icon: action.icon || "#iconLink",
      label: action.title,
      action: () => executeCustomAction(action),
    }))
  ];



  // 创建今日笔记
  async function createDailyNote() {
    const noteBookID = settings.getBySpace(pluginMetadata.name, "noteBookID");
    log.info("createDailyNote clicked, current noteBookID:", noteBookID);
    if (!noteBookID) {
      await selectNotebookAndCreateDailyNote();
    } else {
      await executeCreateDailyNote(noteBookID);
    }
  }

  // 核心创建逻辑
  async function executeCreateDailyNote(notebookId: string) {
    try {
      // 校验该笔记本是否存在且未关闭，防止旧的/不存在的 ID 导致直接报错
      const res = await lsNotebooks();
      const notebookExists = res?.notebooks?.some((nb: any) => nb.id === notebookId && !nb.closed);
      if (!notebookExists) {
        log.warn(`日记笔记本 ${notebookId} 不存在或已关闭，重置配置并重新弹出选择框`);
        settings.setBySpace(pluginMetadata.name, "noteBookID", "");
        await settings.save();
        await selectNotebookAndCreateDailyNote();
        return;
      }

      const today = new Date();
      const dailyNoteId = await createDailynote(notebookId, today);

      if (dailyNoteId) {
        openBlockByID(dailyNoteId);
        showMessage(plugin.i18n["lets-nav-helper.dailyNoteCreated"]);
        mobileUtils.vibrate(50);
      } else {
        showMessage(plugin.i18n["lets-nav-helper.dailyNoteFailed"]);
        mobileUtils.vibrate([100, 50, 100]);
      }
    } catch (error) {
      log.error("创建今日笔记失败:", error);
      showMessage(plugin.i18n["lets-nav-helper.dailyNoteFailed"]);
      mobileUtils.vibrate([100, 50, 100]);
    }
  }

  // 弹出选择框选择笔记本
  async function selectNotebookAndCreateDailyNote() {
    try {
      const res = await lsNotebooks();
      if (!res || !res.notebooks) {
        showMessage("无法获取笔记本列表");
        return;
      }
      const openNotebooks = res.notebooks.filter((nb: any) => !nb.closed);
      if (openNotebooks.length === 0) {
        showMessage("没有打开的笔记本，请先创建或打开一个笔记本");
        return;
      }

      // 如果只有一个打开的笔记本，直接使用，不需要让用户选择
      if (openNotebooks.length === 1) {
        const notebookId = openNotebooks[0].id;
        settings.setBySpace(pluginMetadata.name, "noteBookID", notebookId);
        await settings.save();
        await executeCreateDailyNote(notebookId);
        return;
      }

      // 如果有多个笔记本，弹窗让用户选择
      const dialog = new Dialog({
        title: "选择日记笔记本",
        content: `
          <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 320px; overflow-y: auto;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: var(--b3-theme-on-surface-light);">
              您尚未配置日记笔记本。请选择一个笔记本，选择后将自动保存：
            </p>
            <div id="notebook-select-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${openNotebooks.map(nb => `
                <button class="b3-button b3-button--outline" data-id="${nb.id}" style="width: 100%; text-align: left; display: flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 8px 12px; font-size: 14px;">
                  <span>📁</span>
                  <span>${nb.name}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `,
        width: "320px",
      });

      // 绑定点击事件
      const listContainer = dialog.element.querySelector("#notebook-select-list");
      if (listContainer) {
        listContainer.addEventListener("click", async (e) => {
          const btn = (e.target as HTMLElement).closest("button");
          if (btn) {
            const notebookId = btn.getAttribute("data-id");
            if (notebookId) {
              dialog.destroy();
              // 保存到配置
              settings.setBySpace(pluginMetadata.name, "noteBookID", notebookId);
              await settings.save();
              // 执行创建日记
              await executeCreateDailyNote(notebookId);
            }
          }
        });
      }
    } catch (err) {
      log.error("选择笔记本失败:", err);
      showMessage("获取笔记本列表失败");
    }
  }

  // 显示导航子菜单
  function showNavigationSubmenu(event: MouseEvent) {
    submenuType = "navigation";
    submenuTriggerButton = event.currentTarget as HTMLElement;
    submenuItems = [
      {
        icon: "#iconUp",
        label: plugin.i18n["lets-nav-helper.jumpToParent"],
        action: async () => {
          await navigation.goToParent();
        },
      },
      {
        icon: "#iconLeft",
        label: plugin.i18n["lets-nav-helper.jumpToPrevSibling"],
        action: async () => {
          await navigation.goToSibling(-1);
        },
      },
      {
        icon: "#iconRight",
        label: plugin.i18n["lets-nav-helper.jumpToNextSibling"],
        action: async () => {
          await navigation.goToSibling(1);
        },
      },
      {
        icon: "#iconDown",
        label: plugin.i18n["lets-nav-helper.jumpToChild"],
        action: async () => {
          await navigation.goToChild();
        },
      },
    ];
    submenuVisible = true;
  }

  // 显示快捷动作子菜单
  function showCustomActionsSubmenu(event: MouseEvent) {
    submenuTriggerButton = event.currentTarget as HTMLElement;
    if (finalSubmenuActions.length === 0) {
      showMessage(plugin.i18n["lets-nav-helper.noCustomLinks"]);
      return;
    }

    submenuType = "customLinks";
    submenuItems = finalSubmenuActions.map((action: any) => {
      return {
        icon: action.icon || "#iconLink",
        label: action.title,
        action: () => executeCustomAction(action),
      };
    });

    submenuVisible = true;
  }

  // 显示 PC 专属悬浮球菜单
  function showDesktopMenu(event: MouseEvent) {
    submenuType = "navigation"; // 复用基本样式
    submenuTriggerButton = event.currentTarget as HTMLElement;
    submenuItems = [];

    // 上下级导航
    if (settings.getBySpace(pluginMetadata.name, "showContextButton")) {
      submenuItems.push(
        {
          icon: "#iconUp",
          label: plugin.i18n["lets-nav-helper.jumpToParent"],
          action: async () => {
            await navigation.goToParent();
          }
        },
        {
          icon: "#iconDown",
          label: plugin.i18n["lets-nav-helper.jumpToChild"],
          action: async () => {
            await navigation.goToChild();
          }
        }
      );
    }

    // 快捷动作 (合并 position === "submenu" 以及可能的回退动作)
    if (finalSubmenuActions.length > 0) {
      finalSubmenuActions.forEach((action) => {
        submenuItems.push({
          icon: action.icon || "🔗",
          label: action.title,
          action: () => executeCustomAction(action)
        });
      });
    }

    submenuVisible = true;
  }

  // 隐藏子菜单
  function hideSubmenu() {
    submenuVisible = false;
    submenuType = null;
    submenuItems = [];
    submenuTriggerButton = null;
  }

  // 过滤显示的按钮
  $: visibleButtons = allNavbarButtons;

  // 响应式调整
  function handleResize() {
    if (deviceType === "desktop") {
      const screenWidth = window.innerWidth;
      if (screenWidth < 768) {
        isVisible = false;
      } else {
        isVisible = true;
      }
    }
  }

  onMount(() => {
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true); // 使用 capture 捕获内部滚动
    handleResize();
  });

  onDestroy(() => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("scroll", handleScroll, true);
  });
</script>

{#if isVisible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="navigation-container {deviceType}"
    class:scrolling-down={isScrollingDown}
    on:click={(e) => {
      if (isScrollingDown && deviceType === "mobile") {
        isScrollingDown = false;
        e.stopPropagation();
      }
    }}
  >
    {#if deviceType === "desktop"}
      <button class="fab-button" on:click={showDesktopMenu}>
        <svg><use xlink:href="#iconStar"></use></svg>
      </button>
    {/if}

    {#if deviceType === "mobile"}
      {#each visibleButtons as button (button.key)}
        <NavButton {button} {deviceType} />
      {/each}
    {/if}
  </div>

  {#if submenuVisible}
    <Submenu
      type={submenuType}
      items={submenuItems}
      {deviceType}
      triggerButton={submenuTriggerButton}
      on:close={hideSubmenu}
    />
  {/if}
{/if}

<style>
  .navigation-container.mobile {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .navigation-container.mobile button {
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }

  .navigation-container.mobile button:active {
    transform: scale(0.95);
  }

  .navigation-container {
    touch-action: manipulation;
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    background-color: var(--nav-bg);
    font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif);
  }

  .navigation-container.mobile {
    bottom: env(safe-area-inset-bottom, 16px);
    left: 50%;
    transform: translateX(-50%);
    width: calc(100vw - 32px);
    max-width: 500px;
    height: var(--nav-height);
    justify-content: space-around;
    border-radius: 999px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: max-width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                opacity 0.3s ease;
    cursor: default;
  }

  /* Safari Pill Handle */
  .navigation-container.mobile::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 4px;
    border-radius: 2px;
    background: var(--b3-theme-on-surface, #888);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .navigation-container.mobile.scrolling-down {
    max-width: 56px;
    height: 36px;
    opacity: 0.85;
    pointer-events: auto;
    cursor: pointer;
  }

  .navigation-container.mobile.scrolling-down::after {
    opacity: 0.5;
  }

  /* Hide buttons gracefully */
  .navigation-container.mobile :global(button) {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .navigation-container.mobile.scrolling-down :global(button) {
    opacity: 0;
    transform: scale(0.5);
    pointer-events: none;
  }

  .navigation-container.desktop {
    bottom: 30px;
    right: 30px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(20px);
    border: 1px solid var(--b3-border-color, rgba(233, 236, 239, 0.2));
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    cursor: pointer;
  }

  .navigation-container.desktop:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
  
  .navigation-container.desktop:active {
    transform: translateY(0) scale(0.95);
  }

  .fab-button {
    background: transparent;
    border: none;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    outline: none;
    cursor: pointer;
  }

  .fab-button svg {
    width: 24px;
    height: 24px;
    fill: var(--b3-theme-on-surface, #333);
  }

  /* 键盘弹出时的样式调整 */
  @media (max-height: 500px) {
    .navigation-container.mobile {
      transform: translateY(100%);
    }
  }
</style>
