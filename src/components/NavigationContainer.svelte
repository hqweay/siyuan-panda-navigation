<script lang="ts">
import { getLogger } from "@/libs/logger";
const log = getLogger("lets-nav-helper");
  import { onMount, onDestroy } from "svelte";
  import { fly } from "svelte/transition";
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
  let submenuType: "customLinks" | null = null;
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

  $: visibleMenuItems = menuItems.filter(item => {
    if (item.showOn === "none") return false;
    if (deviceType === "mobile") return item.showOn === "both" || item.showOn === "mobile";
    return item.showOn === "both" || item.showOn === "desktop";
  });

  async function executeCustomAction(item: any) {
    if (submenuVisible) {
      hideSubmenu();
    }
    const type = item.type;
    // Fallback logic for legacy configs, map internal/url/sql/av-add/open-setting to builtin
    const isBuiltin = type === "builtin" || ["internal", "url", "sql", "av-add", "open-setting"].includes(type);
    
    if (isBuiltin) {
      let cmdId = item.value;
      if (type !== "builtin" && type !== "internal") {
          cmdId = type; // url, sql, av-add, open-setting
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
     } else {
        executeCustomAction(item);
     }
  }

  $: allNavbarButtons = visibleMenuItems.map((item) => ({
    key: item.id,
    icon: item.icon,
    label: item.title,
    action: (e: Event) => handleActionClick(item, e),
    hasSubmenu: item.type === "group"
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




  function showGroupSubmenu(group: any, event: Event) {
    const triggerBtn = (event.currentTarget as HTMLElement).closest(".nav-button");

    if (submenuVisible && submenuType === "customLinks") {
      if (submenuTriggerButton === triggerBtn) {
        hideSubmenu();
        return;
      }
      // 如果点击的是另一个分组按钮，则不 hideSubmenu，直接切换内容
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

    if (deviceType === "mobile" && submenuLayout === "grid") {
      submenuVisible = true;
      showIconPanel = true;
    } else {
      submenuVisible = true;
      showIconPanel = false;
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

  $: showIconPanel = submenuVisible && submenuType === "customLinks" && submenuLayout === "grid" && deviceType === "mobile";

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
      <div class="nav-expansion" transition:fly={{ y: 15, duration: 200, opacity: 0 }}>
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
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    background-image: linear-gradient(var(--nav-bg), var(--nav-bg));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 20px 20px 0 0;
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
    width: 40px;
    height: 40px;
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
    width: 20px;
    height: 20px;
    fill: currentColor;
    display: block;
    pointer-events: none;
  }

  .expansion-emoji {
    font-size: 20px;
    line-height: 1;
    pointer-events: none;
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
