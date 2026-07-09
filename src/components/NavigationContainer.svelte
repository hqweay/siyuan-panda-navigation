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
    if (
      !target?.classList?.contains("protyle-content") &&
      !target?.classList?.contains("protyle-scroll")
    )
      return;

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
  let menuItems: any[] =
    settings.getBySpace(pluginMetadata.name, "menuItems") || [];

  $: visibleMenuItems = menuItems.filter((item) => {
    if (item.showOn === "none") return false;
    if (deviceType === "mobile")
      return item.showOn === "both" || item.showOn === "mobile";
    return item.showOn === "both" || item.showOn === "desktop";
  });

  async function handleActionClick(item: any, event: Event) {
    const type = item.type;
    // Fallback logic for legacy configs, map internal/url/sql/av-add/open-setting to builtin
    if (type === "group") {
        showGroupSubmenu(item, event);
        return;
    }

    if (type === "builtin" || ["internal", "url", "sql", "av-add", "open-setting"].includes(type)) {
      const cmdId = type === "builtin" ? item.value : type;
      const cmd = builtinCommands[cmdId];
      if (cmd) {
        const param = type === "builtin" ? item.param : item.value;
        cmd.execute(plugin, param).catch((err) => {
          log.error("执行内置命令失败:", err);
          showMessage("执行内置命令失败");
        });
      } else {
        showMessage("未知的内置功能: " + cmdId);
      }
      return;
    }

    const value = item.value;
    if (type === "command" || type === "pluginCommand") {
      try {
        if (value.startsWith("plugin::")) {
          const parts = value.split("::");
          const pluginName = parts[1];
          const cmdKey = parts[2];
          const targetPlugin = (window as any).siyuan?.ws?.app?.plugins?.find((p: any) => p.name === pluginName);
          if (targetPlugin) {
            const cmd = targetPlugin.commands.find((c: any) => c.customHotkey === cmdKey || c.langKey === cmdKey);
            if (cmd) {
              if (cmd.callback) cmd.callback();
              else if (cmd.globalCallback) cmd.globalCallback();
              else showMessage(`插件命令不支持外部直接调用: ${value}`);
            }
          }
        } else if (value.startsWith("editor::")) {
            const parts = value.split("::");
            const category = parts[1];
            const key = parts[2];
            const hotkey = (window as any).siyuan?.config?.keymap?.editor?.[category]?.[key]?.custom;
            if (hotkey) {
                simulateHotkey(hotkey);
            } else {
                showMessage(`找不到对应的快捷键配置: ${value}`);
            }
        } else if (value === "search") {
          const searchDialog = (window as any).siyuan?.dialogs?.find(
            (item: any) => item.element?.querySelector("#searchList"),
          );
          if (searchDialog) {
            searchDialog.destroy();
          } else {
            globalCommand(value, plugin.app);
          }
        } else if (value === "recentDocs") {
          const recentDialog = (window as any).siyuan?.dialogs?.find(
            (item: any) =>
              item.element?.getAttribute("data-key") === "dialog-recentdocs",
          );
          if (recentDialog) {
            recentDialog.destroy();
          } else {
            globalCommand(value, plugin.app);
          }
        } else if (value === "config") {
          const configDialog = (window as any).siyuan?.dialogs?.find(
            (item: any) => item.element?.querySelector(".config__panel"),
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

  function simulateHotkey(hotkeyStr: string) {
    if (!hotkeyStr) return;
    let ctrlKey = false, metaKey = false, shiftKey = false, altKey = false;
    
    if (hotkeyStr.includes("⌘")) metaKey = true;
    if (hotkeyStr.includes("⇧")) shiftKey = true;
    if (hotkeyStr.includes("⌥")) altKey = true;
    if (hotkeyStr.includes("⌃")) ctrlKey = true;
    if (hotkeyStr.includes("Ctrl+")) ctrlKey = true;
    if (hotkeyStr.includes("Shift+")) shiftKey = true;
    if (hotkeyStr.includes("Alt+")) altKey = true;
    
    let mainKey = hotkeyStr.replace(/(⌘|⇧|⌥|⌃|Ctrl\+|Shift\+|Alt\+)/g, "").trim().toUpperCase();
    
    let keyCode = 0;
    if (mainKey.length === 1 && /[A-Z0-9]/.test(mainKey)) {
        keyCode = mainKey.charCodeAt(0);
    } else {
        const specialKeys: Record<string, number> = {
            "Enter": 13, "Escape": 27, "Space": 32, "Backspace": 8, "Tab": 9,
            "ArrowLeft": 37, "ArrowUp": 38, "ArrowRight": 39, "ArrowDown": 40,
            "-": 189, "=": 187, "[": 219, "]": 221, "\\": 220,
            ";": 186, "'": 222, ",": 188, ".": 190, "/": 191, "`": 192
        };
        if (specialKeys[mainKey]) keyCode = specialKeys[mainKey];
    }
    
    const event = new KeyboardEvent("keydown", {
      key: mainKey,
      ctrlKey,
      metaKey,
      shiftKey,
      altKey,
      bubbles: true,
      cancelable: true
    });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    Object.defineProperty(event, 'which', { get: () => keyCode });
    
    const target = document.activeElement || document.body;
    target.dispatchEvent(event);
  }

  $: allNavbarButtons = visibleMenuItems.map((item) => ({
    key: item.id,
    icon: item.icon,
    label: item.title,
    action: (e: Event) => handleActionClick(item, e),
    hasSubmenu: item.type === "group",
  }));

  $: visibleButtons = allNavbarButtons;

  function shouldShowLabel(): boolean {
    const setting =
      settings.getBySpace(pluginMetadata.name, "showButtonLabels") ?? "both";
    if (setting === "both") return true;
    if (setting === "mobile") return deviceType === "mobile";
    if (setting === "pc") return deviceType === "desktop";
    return false;
  }

  let showLabel: boolean = true;
  $: showLabel = shouldShowLabel();

  function showGroupSubmenu(group: any, event: Event) {
    const triggerBtn = (event.currentTarget as HTMLElement).closest(
      ".nav-button",
    );

    if (submenuVisible && submenuType === "customLinks") {
      if (submenuTriggerButton === triggerBtn) {
        hideSubmenu();
        return;
      }
    }

    const validChildren = (group.children || []).filter((child: any) => {
      if (child.showOn === "none") return false;
      if (deviceType === "mobile")
        return child.showOn === "both" || child.showOn === "mobile";
      return child.showOn === "both" || child.showOn === "desktop";
    });

    if (validChildren.length === 0) {
      showMessage("该分组下没有内容");
      return;
    }

    submenuType = "customLinks";
    submenuLayout = group.submenuLayout || "list";
    submenuItems = validChildren.map((child: any) => ({
      icon: child.icon || "#iconLink",
      label: child.title,
      action: () => handleActionClick(child, event),
    }));

    submenuTriggerButton = (event.currentTarget as HTMLElement).closest(
      ".nav-button",
    );

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

  $: showIconPanel =
    submenuVisible &&
    submenuType === "customLinks" &&
    submenuLayout === "grid" &&
    deviceType === "mobile";

  function handleIconPanelOutsideClick(event: Event) {
    if (showIconPanel) {
      const target = event.target as HTMLElement;
      if (!target.closest(".navigation-container")) {
        hideSubmenu();
      }
    }
  }

  // 拖拽相关状态
  let navContainer: HTMLElement;
  let navX = 0;
  let navY = 0;
  let isDragging = false;
  let hasInitializedPosition = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialNavX = 0;
  let initialNavY = 0;

  function initNavPosition() {
    if (deviceType !== "desktop" || !navContainer) return;
    const saved = settings.getBySpace(pluginMetadata.name, "navPosition");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      navX = saved.x;
      navY = saved.y;
    } else {
      // 默认底部居中
      const rect = navContainer.getBoundingClientRect();
      navX = (window.innerWidth - rect.width) / 2;
      navY = window.innerHeight - 20 - rect.height;
    }
    clampNavPosition();
    hasInitializedPosition = true;
  }

  function clampNavPosition() {
    if (!navContainer) return;
    const padding = 10;
    const rect = navContainer.getBoundingClientRect();
    if (navX < padding) navX = padding;
    if (navY < padding) navY = padding;
    if (navX + rect.width > window.innerWidth - padding) {
      navX = window.innerWidth - rect.width - padding;
    }
    if (navY + rect.height > window.innerHeight - padding) {
      navY = window.innerHeight - rect.height - padding;
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (deviceType !== "desktop") return;
    // 忽略右键
    if (e.button !== 0) return;
    // 如果点击的是按钮内部，不触发拖拽
    const target = e.target as HTMLElement;
    if (target.closest(".nav-button")) return;

    if (submenuVisible) hideSubmenu();
    document.body.style.userSelect = "none";

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialNavX = navX;
    initialNavY = navY;

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    let newX = initialNavX + dx;
    let newY = initialNavY + dy;

    // 直接在这里做轻量限制，防止鼠标拖出屏幕外太远
    // 注意：虽然获取的是旧坐标的 DOM rect，但宽高是不变的，所以计算依然精准
    const padding = 10;
    const rect = navContainer.getBoundingClientRect();
    if (newX < padding) newX = padding;
    if (newY < padding) newY = padding;
    if (newX + rect.width > window.innerWidth - padding)
      newX = window.innerWidth - rect.width - padding;
    if (newY + rect.height > window.innerHeight - padding)
      newY = window.innerHeight - rect.height - padding;

    // 直接操作 DOM 绕过 Svelte 响应式以获得极致性能，不更新 navX/navY 避免冗余的 Svelte 响应式开销
    if (navContainer) {
      navContainer.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    }
  }

  function handlePointerUp() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);

    // 将最终渲染的坐标同步回 Svelte 状态
    if (navContainer) {
      const transform = navContainer.style.transform;
      const match = transform.match(/translate3d\(([^px]+)px,\s*([^px]+)px/);
      if (match) {
        navX = parseFloat(match[1]);
        navY = parseFloat(match[2]);
      }
    }

    settings.setBySpace(pluginMetadata.name, "navPosition", {
      x: navX,
      y: navY,
    });
    settings.save();
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
        if (hasInitializedPosition) {
          clampNavPosition();
          if (navContainer && !isDragging) {
            navContainer.style.transform = `translate3d(${navX}px, ${navY}px, 0)`;
          }
        }
      }
    }
  }

  onMount(() => {
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true); // capture 捕获 protyle 内部滚动
    document.addEventListener("click", handleIconPanelOutsideClick);

    // 使用 rAF 确保在下一帧绘制前 DOM 已经完全布局（比 setTimeout 更可靠）
    requestAnimationFrame(() => {
      initNavPosition();
    });
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
    bind:this={navContainer}
    class="navigation-container {deviceType}"
    class:scrolling-down={isScrollingDown}
    class:expanded={showIconPanel}
    class:is-dragging={isDragging}
    on:pointerdown={handlePointerDown}
    style={deviceType === "desktop" && hasInitializedPosition
      ? `top: 0; left: 0; bottom: auto; transform: translate3d(${navX}px, ${navY}px, 0);`
      : ""}
    on:click={(e) => {
      if (isScrollingDown && deviceType === "mobile") {
        isScrollingDown = false;
        e.stopPropagation();
      }
    }}
  >
    {#if showIconPanel}
      <div
        class="nav-expansion"
        transition:fly={{ y: 15, duration: 200, opacity: 0 }}
      >
        <div class="expansion-icons">
          {#each submenuItems as item, idx (idx)}
            <button
              class="expansion-btn"
              title={item.label}
              on:mousedown|preventDefault
              on:click={() => item.action?.()}
            >
              {#if item.icon && item.icon.startsWith("#icon")}
                <svg class="expansion-svg"
                  ><use xlink:href={item.icon}></use></svg
                >
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
    font-family: var(
      --b3-font-family,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Microsoft YaHei",
      sans-serif
    );
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
    transition:
      max-width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.3s ease,
      transform 0.3s ease,
      border-radius 0.2s ease;
    cursor: default;
  }

  /* Safari Pill Handle */
  .navigation-container.mobile::after {
    content: "";
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
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
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
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    cursor: grab;
  }

  .navigation-container.desktop.is-dragging {
    transition: none; /* Disable transition during drag for 0 latency */
    cursor: grabbing;
    opacity: 0.95;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .navigation-container.desktop :global(.nav-button) {
    min-width: 36px;
    min-height: 36px;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
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
    background-color: var(
      --b3-theme-background-light,
      rgba(59, 130, 246, 0.12)
    );
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
