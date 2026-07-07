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
  import { builtinCommands } from "../builtins";
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
  let submenuLayout: "list" | "grid" = "list";
  let showIconPanel = false;

  // 滚动隐藏逻辑
  let isScrollingDown = false;
  let lastScrollTop = 0;

  function handleScroll(event: Event) {
    if (deviceType !== "mobile") return;

    const target = event.target as HTMLElement;
    // 只响应 protyle 主内容区的滚动，忽略弹窗/侧边栏等区域
    if (!target?.classList?.contains("protyle-content") && !target?.classList?.contains("protyle-scroll")) return;

    const currentScrollTop = target.scrollTop;
    if (currentScrollTop === undefined) return;
    if (Math.abs(currentScrollTop - lastScrollTop) < 10) return;

    if (currentScrollTop > lastScrollTop) {
      isScrollingDown = true;
      if (submenuVisible) hideSubmenu();
    } else {
      isScrollingDown = false;
    }

    lastScrollTop = currentScrollTop;
  }

  // 加载菜单配置
  let menuItems: any[] = settings.getBySpace(pluginMetadata.name, "menuItems") || [];
  let submenuDisplayMode = settings.getBySpace(pluginMetadata.name, "submenuDisplayMode") || "list";

  $: visibleMenuItems = menuItems.filter(item => {
    if (item.showOn === "none") return false;
    if (deviceType === "mobile") return item.showOn === "both" || item.showOn === "mobile";
    return item.showOn === "both" || item.showOn === "desktop";
  });

  async function executeCustomAction(item: any) {
    const type = item.type;
    // Fallback logic for legacy configs, map internal/url/sql/av-add/open-setting to builtin
    const isBuiltin = type === "builtin" || ["internal", "url", "sql", "av-add", "open-setting"].includes(type);
    
    if (isBuiltin) {
      let cmdId = item.value;
      if (type !== "builtin" && type !== "internal") {
          cmdId = type; // url, sql, av-add, open-setting
      }
      
      if (cmdId === "navigationMenu") {
          return;
      }

      const cmd = builtinCommands[cmdId];
      if (cmd) {
         const param = type === "builtin" ? item.param : item.value;
         await cmd.execute(plugin, param);
      } else {
         showMessage("未知的内置功能: " + cmdId);
      }
      return;
    }

    const value = item.value;
    if (type === "command" || type === "pluginCommand") {
      try {
        if (value.startsWith("plugin::")) {
          // Trigger plugin command
          const evt = new CustomEvent("click");
          const target = document.createElement("div");
          target.setAttribute("data-id", value);
          Object.defineProperty(evt, "target", { value: target, enumerable: true });
          (window as any).siyuan?.ws?.request("main", "getSysCommands", {}, (res: any) => {
            console.log("sys commands loaded, dispatching", value);
          });
          // This relies on Siyuan's internal dispatching.
          globalCommand(value, plugin.app);
        } else if (value === "search") {
          const searchDialog = (window as any).siyuan?.dialogs?.find((item: any) =>
            item.element?.querySelector("#searchList")
          );
          if (searchDialog) {
            searchDialog.destroy();
          } else {
            globalCommand(value, plugin.app);
          }
        } else if (value === "recentDocs") {
          const recentDialog = (window as any).siyuan?.dialogs?.find((item: any) =>
            item.element?.getAttribute("data-key") === "dialog-recentdocs"
          );
          if (recentDialog) {
            recentDialog.destroy();
          } else {
            globalCommand(value, plugin.app);
          }
        } else if (value === "config") {
          const configDialog = (window as any).siyuan?.dialogs?.find((item: any) =>
            item.element?.querySelector(".config__panel")
          );
          if (configDialog) {
            configDialog.destroy();
          } else {
            globalCommand(value, plugin.app);
          }
        } else {
          globalCommand(value, plugin.app);
        }
      } catch (err) {
        log.error("执行命令失败:", err);
        showMessage("执行命令失败");
      }
    }
  }

  function handleActionClick(item: any, event: Event) {
     if (item.type === "group") {
        showGroupSubmenu(item, event);
     } else if ((item.type === "internal" || item.type === "builtin") && item.value === "navigationMenu") {
        showNavigationSubmenu(event as MouseEvent);
     } else {
        executeCustomAction(item);
     }
  }

  $: allNavbarButtons = visibleMenuItems.map((item) => ({
    key: item.id,
    icon: item.icon,
    label: item.title,
    action: (e: Event) => handleActionClick(item, e),
    hasSubmenu: item.type === "group" || ((item.type === "internal" || item.type === "builtin") && item.value === "navigationMenu")
  }));

  $: visibleButtons = allNavbarButtons;

  function shouldShowLabel(): boolean {
    const setting = settings.getBySpace(pluginMetadata.name, "showButtonLabels") ?? "both";
    if (setting === "both") return true;
    if (setting === "mobile") return deviceType === "mobile";
    if (setting === "pc") return deviceType === "desktop";
    return false;
  }

  let showLabel: boolean = true;
  $: showLabel = shouldShowLabel();

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
    if (submenuVisible && submenuType === "navigation") {
      hideSubmenu();
      return;
    }
    submenuType = "navigation";
    submenuLayout = "list";
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

  function showGroupSubmenu(group: any, event: Event) {
    if (submenuVisible && submenuType === "customLinks") {
      hideSubmenu();
      return;
    }
    
    // 过滤掉没显示的子动作
    const validChildren = (group.children || []).filter((child: any) => {
       if (child.showOn === "none") return false;
       if (deviceType === "mobile") return child.showOn === "both" || child.showOn === "mobile";
       return child.showOn === "both" || child.showOn === "desktop";
    });

    if (validChildren.length === 0) {
      showMessage("该分组下没有内容");
      return;
    }

    submenuType = "customLinks"; // Reuse customLinks CSS
    submenuLayout = group.submenuLayout || "list";
    submenuItems = validChildren.map((child: any) => ({
      icon: child.icon || "#iconLink",
      label: child.title,
      action: () => handleActionClick(child, event),
    }));

    submenuTriggerButton = (event.currentTarget as HTMLElement).closest(".nav-button");

    if (deviceType === "mobile" && submenuDisplayMode === "iconPanel") {
      showIconPanel = true;
    } else {
      submenuVisible = true;
    }
  }

  // 隐藏子菜单
  function hideSubmenu() {
    submenuVisible = false;
    submenuType = null;
    submenuItems = [];
    submenuTriggerButton = null;
    submenuLayout = "list";
  }

  $: showIconPanel = submenuVisible && (submenuType === "customLinks" || submenuType === "navigation") && submenuDisplayMode === "iconPanel";

  function handleIconPanelOutsideClick(event: Event) {
    if (showIconPanel) {
      const target = event.target as HTMLElement;
      if (!target.closest('.navigation-container')) {
        hideSubmenu();
      }
    }
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
    window.addEventListener("scroll", handleScroll, true); // capture 捕获 protyle 内部滚动
    document.addEventListener("click", handleIconPanelOutsideClick);
    handleResize();
  });

  onDestroy(() => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("scroll", handleScroll, true);
    document.removeEventListener("click", handleIconPanelOutsideClick);
  });
</script>

{#if isVisible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="navigation-container {deviceType}"
    class:scrolling-down={isScrollingDown}
    class:expanded={showIconPanel}
    on:click={(e) => {
      if (isScrollingDown && deviceType === "mobile") {
        isScrollingDown = false;
        e.stopPropagation();
      }
    }}
  >
    {#if showIconPanel}
      <div class="nav-expansion">
        <div class="expansion-icons">
          {#each submenuItems as item, idx (idx)}
            <button
              class="expansion-btn"
              title={item.label}
              on:click={() => item.action?.()}
            >
              {#if item.icon && item.icon.startsWith("#icon")}
                <svg class="expansion-svg"><use xlink:href={item.icon}></use></svg>
              {:else}
                <span class="expansion-emoji">{item.icon || "🔗"}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    <div class="buttons-wrapper">
      {#each visibleButtons as button (button.key)}
        <NavButton {button} {deviceType} {showLabel} />
      {/each}
    </div>
  </div>

  {#if !showIconPanel && submenuVisible}
    <Submenu
      type={submenuType}
      layout={submenuLayout}
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

  .navigation-container.mobile :global(button) {
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }

  .navigation-container.mobile :global(button:active) {
    transform: scale(0.95);
  }

  .navigation-container {
    touch-action: manipulation;
    position: fixed;
    z-index: 3;
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
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: max-width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                opacity 0.3s ease,
                transform 0.3s ease,
                border-radius 0.2s ease;
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
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: auto;
    height: auto;
    padding: 4px;
    gap: 2px;
    justify-content: center;
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    background-color: var(--nav-bg);
    border: 1px solid var(--b3-border-color, rgba(233, 236, 239, 0.15));
  }

  .navigation-container.desktop :global(.nav-button) {
    min-width: 36px;
    min-height: 36px;
    padding: 6px;
    border-radius: 8px;
  }

  .navigation-container.desktop :global(.nav-button .icon) {
    font-size: 20px;
  }

  /* 展开层 — 从导航栏顶部生长出来 */
  .nav-expansion {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    padding: 8px 12px 10px;
    background: var(--b3-theme-surface);
    background-image: linear-gradient(var(--nav-bg), var(--nav-bg));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 20px 20px 0 0;
    animation: expansionIn 0.18s ease-out;
  }

  .expansion-icons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 0 auto;
    gap: 2px;
    max-width: 240px;
  }

  .expansion-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--b3-theme-on-surface);
    transition: background-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .expansion-btn:hover {
    background-color: var(--b3-theme-background-light, rgba(59, 130, 246, 0.12));
  }

  .expansion-btn:active {
    transform: scale(0.9);
  }

  .expansion-svg {
    width: 22px;
    height: 22px;
    fill: currentColor;
    display: block;
    pointer-events: none;
  }

  .expansion-emoji {
    font-size: 22px;
    line-height: 1;
    pointer-events: none;
  }

  @keyframes expansionIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* 按钮包裹层 — 独立裁剪 hover 背景，不干涉展开层 */
  .buttons-wrapper {
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: inherit;
    gap: inherit;
  }

  .navigation-container.mobile .buttons-wrapper {
    flex: 1;
    justify-content: space-around;
    height: 100%;
  }

  .navigation-container.desktop .buttons-wrapper {
    justify-content: center;
  }

  /* 展开时导航栏只保留底部圆角，与二级栏合体成一个完整胶囊 */
  .navigation-container.expanded {
    border-radius: 0 0 20px 20px;
  }

  /* 键盘弹出时的样式调整 */
  @media (max-height: 500px) {
    .navigation-container.mobile {
      transform: translateY(100%);
    }
  }
</style>
