<script lang="ts">
  import { settings } from "../settings";
  import { plugin } from "../utils";
  import { showMessage } from "siyuan";
  import { onMount } from "svelte";
  import { lsNotebooks } from "../api";
  import IconPicker from "./IconPicker.svelte";

  export let closeDialog: () => void;

  let notebooks: any[] = [];

  // 图标选择弹窗相关的状态
  let showIconPicker = false;
  let iconEditingIndex: number | null = null;
  let allSiyuanIcons: string[] = [];

  onMount(async () => {
    try {
      const res = await lsNotebooks();
      if (res && res.notebooks) {
        notebooks = res.notebooks.filter((nb: any) => !nb.closed);
      }
    } catch (e) {
      console.error("加载笔记本列表失败", e);
    }

    try {
      // 动态抓取当前思源中注册的所有 SVG symbol 图标 (比如 litheness 主题图标精灵)
      const symbols = document.querySelectorAll("svg symbol");
      const iconsSet = new Set<string>();
      symbols.forEach((symbol) => {
        const id = symbol.getAttribute("id");
        if (id && id.startsWith("icon")) {
          iconsSet.add(`#${id}`);
        }
      });
      // 降级兜底方案
      if (iconsSet.size === 0) {
        COMMON_ICONS.forEach((i) => iconsSet.add(i));
      }
      allSiyuanIcons = Array.from(iconsSet).sort();
    } catch (e) {
      console.error("抓取思源系统图标失败，使用经典图标兜底:", e);
      allSiyuanIcons = [...COMMON_ICONS];
    }
  });

  function openIconPicker(index: number) {
    iconEditingIndex = index;
    showIconPicker = true;
  }

  function handleSelectIcon(icon: string) {
    if (iconEditingIndex !== null) {
      actions[iconEditingIndex].icon = icon;
      actions = [...actions];
    }
    showIconPicker = false;
  }

  let activeTab: "general" | "buttons" | "links" = "general";

  // General Settings
  let enableBottomNav =
    settings.getBySpace("nav-helper", "enableBottomNav") ?? "both";
  let noteBookID = settings.getBySpace("nav-helper", "noteBookID") ?? "";

  // Button Visibility Settings
  let showBackButton =
    settings.getBySpace("nav-helper", "showBackButton") ?? "both";
  let showForwardButton =
    settings.getBySpace("nav-helper", "showForwardButton") ?? "both";
  let showCustomLinksButton =
    settings.getBySpace("nav-helper", "showCustomLinksButton") ?? "both";
  let showDailyNoteButton =
    settings.getBySpace("nav-helper", "showDailyNoteButton") ?? "both";
  let showNavigationMenuButton =
    settings.getBySpace("nav-helper", "showNavigationMenuButton") ?? "both";
  let showContextButton =
    settings.getBySpace("nav-helper", "showContextButton") ?? "both";

  // Button Order Settings
  const ALL_BUTTONS = [
    { key: "showBackButton", label: "返回按钮", icon: "#iconLeft" },
    { key: "showDailyNoteButton", label: "今日日记按钮", icon: "#iconCalendar" },
    { key: "showNavigationMenuButton", label: "导航菜单按钮", icon: "#iconMenu" },
    { key: "showForwardButton", label: "前进按钮", icon: "#iconRight" },
    { key: "showCustomLinksButton", label: "快捷链接按钮", icon: "#iconStar" },
    { key: "showContextButton", label: "上下文状态按钮 (PC专用)", icon: "#iconUp" }
  ];

  let defaultButtonOrder = ALL_BUTTONS.map(b => b.key);
  let buttonOrder = settings.getBySpace("nav-helper", "buttonOrder") || [...defaultButtonOrder];

  // 保证已保存列表中含有所有当前配置键 (防止升级兼容问题)
  ALL_BUTTONS.forEach(b => {
    if (!buttonOrder.includes(b.key)) {
      buttonOrder.push(b.key);
    }
  });

  let displayButtons = [...ALL_BUTTONS].sort((a, b) => buttonOrder.indexOf(a.key) - buttonOrder.indexOf(b.key));

  function moveButtonUp(index: number) {
    if (index === 0) return;
    const temp = displayButtons[index];
    displayButtons[index] = displayButtons[index - 1];
    displayButtons[index - 1] = temp;
    displayButtons = [...displayButtons];
    buttonOrder = displayButtons.map(b => b.key);
  }

  function moveButtonDown(index: number) {
    if (index === displayButtons.length - 1) return;
    const temp = displayButtons[index];
    displayButtons[index] = displayButtons[index + 1];
    displayButtons[index + 1] = temp;
    displayButtons = [...displayButtons];
    buttonOrder = displayButtons.map(b => b.key);
  }

  // Custom Actions
  let customActions = settings.getBySpace("nav-helper", "customActions") || [];
  if (!Array.isArray(customActions)) {
    customActions = [];
  }
  let actions = [...customActions];

  // 折叠与选择相关的状态
  let expandedIndex: number | null = actions.length > 0 ? 0 : null;

  const COMMON_ICONS = [
    "#iconWorkspace",
    "#iconSearch",
    "#iconRefresh",
    "#iconCalendar",
    "#iconMenu",
    "#iconStar",
    "#iconLink",
    "#iconDatabase",
    "#iconUp",
    "#iconDown",
    "#iconLeft",
    "#iconRight",
    "#iconSettings",
    "#iconInfo",
    "#iconHelp",
    "#iconTrashcan",
  ];

  const NATIVE_COMMANDS = [
    { value: "globalSearch", label: "全局搜索 🔍" },
    { value: "recentDocs", label: "最近文档 🕒" },
    { value: "fileTree", label: "切换文件树 📁" },
    { value: "outline", label: "切换大纲 📑" },
    { value: "bookmark", label: "打开书签 🔖" },
    { value: "tag", label: "打开标签 🏷️" },
    { value: "backlinks", label: "打开反向链接 🔗" },
    { value: "graphView", label: "打开关系图 🕸️" },
    { value: "syncNow", label: "立即同步 🔄" },
    { value: "riffCard", label: "闪卡复习 🎴" },
    { value: "lockScreen", label: "锁屏 🔒" },
    { value: "config", label: "打开思源设置 ⚙️" },
    { value: "newFile", label: "新建文档 📄" },
  ];

  function addAction() {
    actions = [
      ...actions,
      {
        title: "新动作",
        type: "url",
        value: "",
        icon: "#iconLink",
        position: "submenu",
      },
    ];
    expandedIndex = actions.length - 1;
  }

  function removeAction(index: number) {
    actions = actions.filter((_, i) => i !== index);
    if (expandedIndex === index) {
      expandedIndex = actions.length > 0 ? 0 : null;
    } else if (expandedIndex !== null && expandedIndex > index) {
      expandedIndex -= 1;
    }
  }

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const temp = actions[index];
    actions[index] = actions[index - 1];
    actions[index - 1] = temp;
    actions = [...actions];
    if (expandedIndex === index) {
      expandedIndex = index - 1;
    } else if (expandedIndex === index - 1) {
      expandedIndex = index;
    }
  }

  function moveDown(index: number) {
    if (index === actions.length - 1) return;
    const temp = actions[index];
    actions[index] = actions[index + 1];
    actions[index + 1] = temp;
    actions = [...actions];
    if (expandedIndex === index) {
      expandedIndex = index + 1;
    } else if (expandedIndex === index + 1) {
      expandedIndex = index;
    }
  }

  function getPlaceholder(type: string) {
    if (type === "url") return "输入 https:// 、 siyuan:// 链接或文档 ID";
    if (type === "sql")
      return "输入 SQL 查询语句，例如 SELECT id FROM blocks WHERE type = 'd'";
    if (type === "av-add") return "输入属性视图/数据库的关联链接";
    return "";
  }

  async function handleSave() {
    settings.setBySpace("nav-helper", "enableBottomNav", enableBottomNav);
    settings.setBySpace("nav-helper", "noteBookID", noteBookID);

    settings.setBySpace("nav-helper", "showBackButton", showBackButton);
    settings.setBySpace("nav-helper", "showForwardButton", showForwardButton);
    settings.setBySpace(
      "nav-helper",
      "showCustomLinksButton",
      showCustomLinksButton,
    );
    settings.setBySpace(
      "nav-helper",
      "showDailyNoteButton",
      showDailyNoteButton,
    );
    settings.setBySpace(
      "nav-helper",
      "showNavigationMenuButton",
      showNavigationMenuButton,
    );
    settings.setBySpace("nav-helper", "showContextButton", showContextButton);
    settings.setBySpace("nav-helper", "buttonOrder", buttonOrder);
    settings.setBySpace("nav-helper", "customActions", actions);

    await settings.save();
    showMessage("熊猫导航配置已保存");
    closeDialog();

    // 触发插件实例更新
    if (plugin && (plugin as any).handleSettingsChange) {
      (plugin as any).handleSettingsChange();
    }
  }

  function getBtnValue(key: string) {
    if (key === "showBackButton") return showBackButton;
    if (key === "showForwardButton") return showForwardButton;
    if (key === "showDailyNoteButton") return showDailyNoteButton;
    if (key === "showNavigationMenuButton") return showNavigationMenuButton;
    if (key === "showCustomLinksButton") return showCustomLinksButton;
    return showContextButton;
  }

  function setBtnValue(key: string, value: string) {
    if (key === "showBackButton") showBackButton = value;
    else if (key === "showForwardButton") showForwardButton = value;
    else if (key === "showDailyNoteButton") showDailyNoteButton = value;
    else if (key === "showNavigationMenuButton")
      showNavigationMenuButton = value;
    else if (key === "showCustomLinksButton") showCustomLinksButton = value;
    else showContextButton = value;
  }
</script>

<div class="settings-container fn__flex-column fn__flex-1">
  <!-- Header / Tabs -->
  <div class="settings-tabs fn__flex">
    <button
      class="tab-btn"
      class:active={activeTab === "general"}
      on:click={() => (activeTab = "general")}
    >
      基础配置
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "buttons"}
      on:click={() => (activeTab = "buttons")}
    >
      按钮显示
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "links"}
      on:click={() => (activeTab = "links")}
    >
      快捷动作
    </button>
  </div>

  <!-- Content -->
  <div class="settings-content fn__flex-1 fn__flex-column">
    {#if activeTab === "general"}
      <div class="tab-pane">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">启用悬浮导航栏</span>
            <span class="setting-desc">选择在哪些设备上显示底部导航栏</span>
          </div>
          <select class="b3-select" bind:value={enableBottomNav}>
            <option value="both">移动端与 PC 端</option>
            <option value="mobile">仅移动端</option>
            <option value="pc">仅 PC 端</option>
            <option value="none">禁用</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">日记笔记本</span>
            <span class="setting-desc">用于快速创建/打开今日日记的笔记本</span>
          </div>
          <select
            class="b3-select"
            style="width: 260px;"
            bind:value={noteBookID}
          >
            <option value="">（未选择，首次使用时提示）</option>
            {#each notebooks as notebook}
              <option value={notebook.id}>{notebook.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}

    {#if activeTab === "buttons"}
      <div class="tab-pane">
        <div style="margin-bottom: 12px;">
          <span class="setting-desc" style="margin: 0;">配置各个按钮的显示状态。点击右侧上下箭头可以调整按钮在导航栏的显示顺序。</span>
        </div>

        {#each displayButtons as btn, i (btn.key)}
          <div class="setting-row">
            <div class="setting-info fn__flex align-center" style="gap: 10px;">
              <div class="action-icon-preview">
                <svg class="preview-svg"><use xlink:href={btn.icon}></use></svg>
              </div>
              <span class="setting-title" style="margin: 0;">{btn.label}</span>
            </div>
            
            <div class="fn__flex align-center" style="gap: 12px;">
              <select
                class="b3-select"
                style="width: 140px;"
                value={getBtnValue(btn.key)}
                on:change={(e) => setBtnValue(btn.key, e.currentTarget.value)}
              >
                <option value="both">移动端与 PC 端</option>
                <option value="mobile">仅移动端</option>
                <option value="pc">仅 PC 端</option>
                <option value="none">不显示</option>
              </select>

              <div class="action-arrows fn__flex">
                <button class="arrow-btn" disabled={i === 0} on:click={() => moveButtonUp(i)}>▲</button>
                <button class="arrow-btn" disabled={i === displayButtons.length - 1} on:click={() => moveButtonDown(i)}>▼</button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if activeTab === "links"}
      <div class="tab-pane align-stretch">
        <div
          class="fn__flex align-center justify-between"
          style="margin-bottom: 12px;"
        >
          <span class="setting-desc" style="margin: 0;"
            >配置您的快捷操作。点击卡片展开编辑详情，还可以通过上下箭头进行排序。</span
          >
          <button class="b3-button b3-button--outline" on:click={addAction}
            >添加动作</button
          >
        </div>

        <div class="actions-list">
          {#each actions as action, i (i)}
            <div class="action-card" class:expanded={expandedIndex === i}>
              <!-- Header of card -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="action-card-header" on:click={() => toggleExpand(i)}>
                <div class="header-left fn__flex align-center">
                  <span class="arrow-indicator"
                    >{expandedIndex === i ? "▼" : "▶"}</span
                  >
                  <div class="action-icon-preview">
                    {#if action.icon && action.icon.startsWith("#icon")}
                      <svg class="preview-svg"
                        ><use xlink:href={action.icon}></use></svg
                      >
                    {:else}
                      <span class="preview-emoji">{action.icon || "🔗"}</span>
                    {/if}
                  </div>
                  <span class="action-title-text"
                    >{action.title || "未命名动作"}</span
                  >
                </div>

                <div
                  class="header-right fn__flex align-center"
                  on:click|stopPropagation
                >
                  <span class="badge badge-type">
                    {action.type === "url"
                      ? "链接"
                      : action.type === "sql"
                        ? "SQL"
                        : action.type === "command"
                          ? "命令"
                          : "数据库"}
                  </span>
                  <span class="badge badge-pos">
                    {action.position === "navbar" ? "底栏" : "菜单"}
                  </span>

                  <div class="action-arrows fn__flex">
                    <button
                      class="arrow-btn"
                      disabled={i === 0}
                      on:click={() => moveUp(i)}>▲</button
                    >
                    <button
                      class="arrow-btn"
                      disabled={i === actions.length - 1}
                      on:click={() => moveDown(i)}>▼</button
                    >
                  </div>

                  <button class="delete-btn" on:click={() => removeAction(i)}>
                    <svg class="delete-svg"
                      ><use xlink:href="#iconTrashcan"></use></svg
                    >
                  </button>
                </div>
              </div>

              <!-- Body of card (only rendered/visible when expanded) -->
              {#if expandedIndex === i}
                <div class="action-card-body">
                  <div class="grid-form">
                    <div class="form-item">
                      <label class="form-label">显示标题</label>
                      <input
                        class="b3-text-field"
                        type="text"
                        bind:value={action.title}
                        placeholder="标题名称"
                      />
                    </div>

                    <div class="form-item">
                      <label class="form-label">展示位置</label>
                      <select class="b3-select" bind:value={action.position}>
                        <option value="navbar">底栏导航</option>
                        <option value="submenu">子菜单</option>
                      </select>
                    </div>

                    <div class="form-item">
                      <label class="form-label">动作类型</label>
                      <select
                        class="b3-select"
                        bind:value={action.type}
                        on:change={() => {
                          // 类型切换时，重置 value 默认值，避免保存不合适的内容
                          action.value = "";
                        }}
                      >
                        <option value="url">链接 / 文档ID</option>
                        <option value="sql">随机 SQL</option>
                        <option value="command">内置命令</option>
                        <option value="av-add">AV 属性视图</option>
                      </select>
                    </div>

                    <div class="form-item span-2">
                      <label class="form-label">动作图标</label>
                      <div class="fn__flex" style="gap: 8px; align-items: center;">
                        <input
                          class="b3-text-field"
                          style="flex: 1;"
                          type="text"
                          bind:value={action.icon}
                          placeholder="可输入 Emoji，或选择内置图标"
                        />
                        <button class="b3-button b3-button--outline" on:click={() => openIconPicker(i)}>
                          🎨 选择内置图标
                        </button>
                      </div>
                    </div>

                    <div class="form-item span-2">
                      <label class="form-label">动作内容 / 值</label>

                      {#if action.type === "command"}
                        <!-- 常用命令选择器 -->
                        <div class="fn__flex-column" style="gap: 6px;">
                          <select
                            class="b3-select"
                            on:change={(e) => {
                              if (e.currentTarget.value !== "custom") {
                                action.value = e.currentTarget.value;
                              }
                            }}
                            value={NATIVE_COMMANDS.some(
                              (cmd) => cmd.value === action.value,
                            )
                              ? action.value
                              : "custom"}
                          >
                            <option value="">-- 请选择预设内置命令 --</option>
                            {#each NATIVE_COMMANDS as cmd}
                              <option value={cmd.value}>{cmd.label}</option>
                            {/each}
                            <option value="custom">✍️ 自定义命令 ID</option>
                          </select>
                          {#if !NATIVE_COMMANDS.some((cmd) => cmd.value === action.value) || action.value === ""}
                            <input
                              class="b3-text-field"
                              type="text"
                              bind:value={action.value}
                              placeholder="输入思源命令 ID (如 splitLR)"
                            />
                          {/if}
                        </div>
                      {:else}
                        <!-- 普通文本/SQL输入 -->
                        {#if action.type === "sql"}
                          <textarea
                            class="b3-text-field action-sql-textarea"
                            bind:value={action.value}
                            placeholder={getPlaceholder(action.type)}
                          ></textarea>
                        {:else}
                          <input
                            class="b3-text-field"
                            type="text"
                            bind:value={action.value}
                            placeholder={getPlaceholder(action.type)}
                          />
                        {/if}
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}

          {#if actions.length === 0}
            <div class="no-actions-tip">
              <span>📭 暂无自定义动作，点击“添加动作”开始配置</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer Actions -->
  <div class="settings-footer fn__flex justify-end">
    <button class="b3-button b3-button--cancel" on:click={closeDialog}
      >取消</button
    >
    <div class="fn__space"></div>
    <button class="b3-button" on:click={handleSave}>保存配置</button>
  </div>
</div>

<IconPicker
  active={showIconPicker}
  currentIcon={iconEditingIndex !== null ? actions[iconEditingIndex].icon : ""}
  allIcons={allSiyuanIcons}
  onSelect={handleSelectIcon}
  onClose={() => showIconPicker = false}
/>

<style>
  .settings-container {
    padding: 16px;
    height: 100%;
    box-sizing: border-box;
    background-color: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    position: relative;
  }

  .settings-tabs {
    border-bottom: 1px solid var(--b3-border-color);
    margin-bottom: 16px;
    gap: 8px;
  }

  .tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 8px 16px;
    color: var(--b3-theme-on-surface);
    opacity: 0.7;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
    outline: none;
  }

  .tab-btn.active {
    opacity: 1;
    border-bottom-color: var(--b3-theme-primary);
    font-weight: bold;
  }

  .settings-content {
    overflow-y: auto;
    padding-right: 4px;
    flex: 1;
    min-height: 0;
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
  }

  .setting-desc {
    font-size: 12px;
    opacity: 0.6;
  }

  .align-center {
    align-items: center;
  }

  .justify-between {
    justify-content: space-between;
  }

  .justify-end {
    justify-content: flex-end;
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-card {
    background-color: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .action-card:hover {
    border-color: var(--b3-theme-primary-light, var(--b3-border-color));
  }

  .action-card.expanded {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--b3-theme-primary);
  }

  .action-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    cursor: pointer;
    background-color: var(--b3-theme-surface);
    user-select: none;
  }

  .header-left {
    gap: 10px;
  }

  .arrow-indicator {
    font-size: 10px;
    opacity: 0.5;
    width: 12px;
    display: inline-block;
  }

  .action-icon-preview {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background-color: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
  }

  .preview-svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }

  .preview-emoji {
    font-size: 14px;
  }

  .action-title-text {
    font-size: 14px;
    font-weight: 500;
  }

  .header-right {
    gap: 8px;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .badge-type {
    background-color: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
  }

  .badge-pos {
    background-color: rgba(65, 184, 131, 0.1);
    color: #41b883;
    border: 1px solid rgba(65, 184, 131, 0.2);
  }

  .action-arrows {
    gap: 2px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .arrow-btn {
    background: var(--b3-theme-surface);
    border: none;
    cursor: pointer;
    font-size: 8px;
    padding: 2px 6px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    transition: background-color 0.2s;
  }

  .arrow-btn:hover:not(:disabled) {
    background-color: var(--b3-theme-background-light);
    opacity: 1;
  }

  .arrow-btn:disabled {
    cursor: not-allowed;
    opacity: 0.2;
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .delete-btn:hover {
    background-color: rgba(244, 63, 94, 0.1);
  }

  .delete-svg {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-error);
  }

  .action-card-body {
    padding: 14px;
    background-color: var(--b3-theme-background-light);
    border-top: 1px solid var(--b3-border-color);
  }

  .grid-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-item.span-2 {
    grid-column: span 2;
  }

  .form-label {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.7;
  }



  .action-sql-textarea {
    height: 60px;
    font-family: monospace;
    resize: vertical;
    font-size: 12px;
  }

  .no-actions-tip {
    text-align: center;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
    padding: 40px;
    background-color: var(--b3-theme-surface);
    border: 1px dashed var(--b3-border-color);
    border-radius: 8px;
    font-size: 14px;
  }

  .settings-footer {
    border-top: 1px solid var(--b3-border-color);
    padding-top: 16px;
    margin-top: 16px;
  }


</style>
