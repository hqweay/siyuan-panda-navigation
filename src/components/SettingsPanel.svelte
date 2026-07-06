<script lang="ts">
  import { settings } from "../settings";
  import { plugin } from "../utils";
  import { showMessage } from "siyuan";

  export let closeDialog: () => void;

  let activeTab: "general" | "buttons" | "links" = "general";

  // General Settings
  let enableBottomNav = settings.getBySpace("nav-helper", "enableBottomNav") ?? "both";
  let navJustInMain = settings.getBySpace("nav-helper", "navJustInMain") ?? false;
  let hideSubmenu = settings.getBySpace("nav-helper", "hideSubmenu") ?? false;
  let noteBookID = settings.getBySpace("nav-helper", "noteBookID") ?? "";
  let dashBoardLink = settings.getBySpace("nav-helper", "dashBoardLink") ?? "";
  let randomSql = settings.getBySpace("nav-helper", "randomSql") ?? "SELECT id FROM blocks WHERE type = 'd'";

  // Button Visibility Settings
  let showBackButton = settings.getBySpace("nav-helper", "showBackButton") ?? "both";
  let showForwardButton = settings.getBySpace("nav-helper", "showForwardButton") ?? "both";
  let showDashBoard = settings.getBySpace("nav-helper", "showDashBoard") ?? "both";
  let showRandomButton = settings.getBySpace("nav-helper", "showRandomButton") ?? "both";
  let showCustomLinksButton = settings.getBySpace("nav-helper", "showCustomLinksButton") ?? "both";
  let showDailyNoteButton = settings.getBySpace("nav-helper", "showDailyNoteButton") ?? "both";
  let showNavigationMenuButton = settings.getBySpace("nav-helper", "showNavigationMenuButton") ?? "both";
  let showContextButton = settings.getBySpace("nav-helper", "showContextButton") ?? "both";

  // Custom Links
  let customLinks = settings.getBySpace("nav-helper", "customLinks") || [];
  if (!Array.isArray(customLinks)) {
    customLinks = [];
  }
  let links = [...customLinks];

  function addLink() {
    links = [...links, { title: "新动作", url: "", icon: "#iconLink" }];
  }

  function removeLink(index: number) {
    links = links.filter((_, i) => i !== index);
  }

  async function handleSave() {
    settings.setBySpace("nav-helper", "enableBottomNav", enableBottomNav);
    settings.setBySpace("nav-helper", "navJustInMain", navJustInMain);
    settings.setBySpace("nav-helper", "hideSubmenu", hideSubmenu);
    settings.setBySpace("nav-helper", "noteBookID", noteBookID);
    settings.setBySpace("nav-helper", "dashBoardLink", dashBoardLink);
    settings.setBySpace("nav-helper", "randomSql", randomSql);

    settings.setBySpace("nav-helper", "showBackButton", showBackButton);
    settings.setBySpace("nav-helper", "showForwardButton", showForwardButton);
    settings.setBySpace("nav-helper", "showDashBoard", showDashBoard);
    settings.setBySpace("nav-helper", "showRandomButton", showRandomButton);
    settings.setBySpace("nav-helper", "showCustomLinksButton", showCustomLinksButton);
    settings.setBySpace("nav-helper", "showDailyNoteButton", showDailyNoteButton);
    settings.setBySpace("nav-helper", "showNavigationMenuButton", showNavigationMenuButton);
    settings.setBySpace("nav-helper", "showContextButton", showContextButton);
    settings.setBySpace("nav-helper", "customLinks", links);

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
    if (key === "showDashBoard") return showDashBoard;
    if (key === "showRandomButton") return showRandomButton;
    if (key === "showDailyNoteButton") return showDailyNoteButton;
    if (key === "showNavigationMenuButton") return showNavigationMenuButton;
    if (key === "showCustomLinksButton") return showCustomLinksButton;
    return showContextButton;
  }

  function setBtnValue(key: string, value: string) {
    if (key === "showBackButton") showBackButton = value;
    else if (key === "showForwardButton") showForwardButton = value;
    else if (key === "showDashBoard") showDashBoard = value;
    else if (key === "showRandomButton") showRandomButton = value;
    else if (key === "showDailyNoteButton") showDailyNoteButton = value;
    else if (key === "showNavigationMenuButton") showNavigationMenuButton = value;
    else if (key === "showCustomLinksButton") showCustomLinksButton = value;
    else showContextButton = value;
  }
</script>

<div class="settings-container fn__flex-column fn__flex-1">
  <!-- Header / Tabs -->
  <div class="settings-tabs fn__flex">
    <button class="tab-btn" class:active={activeTab === "general"} on:click={() => activeTab = "general"}>
      基础配置
    </button>
    <button class="tab-btn" class:active={activeTab === "buttons"} on:click={() => activeTab = "buttons"}>
      按钮显示
    </button>
    <button class="tab-btn" class:active={activeTab === "links"} on:click={() => activeTab = "links"}>
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
            <span class="setting-title">仅在主界面显示导航</span>
            <span class="setting-desc">进入思源设置页或弹窗时，导航栏会自动隐藏</span>
          </div>
          <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={navJustInMain} />
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">点击后隐藏子菜单</span>
            <span class="setting-desc">在导航栏子菜单中点击动作（如跳转到父文档）后自动收起菜单</span>
          </div>
          <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={hideSubmenu} />
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">日记笔记本 ID</span>
            <span class="setting-desc">用于快速创建/打开今日日记的笔记本 ID（可选）</span>
          </div>
          <input class="b3-text-field" type="text" style="width: 260px;" placeholder="默认使用首个笔记本" bind:value={noteBookID} />
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-title">首页/仪表盘链接</span>
            <span class="setting-desc">点击导航栏首页图标时打开的链接/视图</span>
          </div>
          <input class="b3-text-field" type="text" style="width: 260px;" placeholder="siyuan://..." bind:value={dashBoardLink} />
        </div>

        <div class="setting-row fn__flex-column align-stretch">
          <div class="setting-info">
            <span class="setting-title">随机漫游 SQL 语句</span>
            <span class="setting-desc">配置自定义的 SQL 语句过滤规则，用于随机文档查找</span>
          </div>
          <textarea class="b3-text-field fn__block" style="height: 80px; margin-top: 8px; font-family: monospace;" bind:value={randomSql}></textarea>
        </div>
      </div>
    {/if}

    {#if activeTab === "buttons"}
      <div class="tab-pane">
        <h4 style="margin: 0 0 12px 0; color: var(--b3-theme-on-surface); font-weight: normal; opacity: 0.8;">配置各个按钮在移动端/PC端的显示状态：</h4>
        
        {#each [
          { key: "showBackButton", label: "返回按钮 (#iconLeft)" },
          { key: "showForwardButton", label: "前进按钮 (#iconRight)" },
          { key: "showDashBoard", label: "首页按钮 (#iconWorkspace)" },
          { key: "showRandomButton", label: "随机漫游按钮 (#iconRefresh)" },
          { key: "showDailyNoteButton", label: "今日日记按钮 (#iconCalendar)" },
          { key: "showNavigationMenuButton", label: "导航菜单按钮 (#iconMenu)" },
          { key: "showCustomLinksButton", label: "快捷链接按钮 (#iconStar)" },
          { key: "showContextButton", label: "上下文状态按钮 (PC专用)" }
        ] as btn}
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">{btn.label}</span>
            </div>
            <select class="b3-select" 
              value={getBtnValue(btn.key)} 
              on:change={(e) => setBtnValue(btn.key, e.currentTarget.value)}
            >
              <option value="both">移动端与 PC 端</option>
              <option value="mobile">仅移动端</option>
              <option value="pc">仅 PC 端</option>
              <option value="none">不显示</option>
            </select>
          </div>
        {/each}
      </div>
    {/if}

    {#if activeTab === "links"}
      <div class="tab-pane fn__flex-column fn__flex-1 align-stretch">
        <div class="fn__flex align-center justify-between" style="margin-bottom: 12px;">
          <span class="setting-desc" style="margin: 0;">配置在「快捷动作」菜单中显示的动作，支持外部链接、文档 ID，或 SQL。</span>
          <button class="b3-button b3-button--outline" on:click={addLink}>添加动作</button>
        </div>

        <div class="links-list fn__flex-1">
          <table class="links-table">
            <thead>
              <tr>
                <th style="width: 60px;">图标</th>
                <th style="width: 120px;">显示标题</th>
                <th>链接 / SQL / 数据库ID</th>
                <th style="width: 60px;">操作</th>
              </tr>
            </thead>
            <tbody>
              {#each links as link, i}
                <tr>
                  <td>
                    <input class="b3-text-field input-center" type="text" bind:value={link.icon} placeholder="#iconLink" />
                  </td>
                  <td>
                    <input class="b3-text-field" type="text" bind:value={link.title} placeholder="标题" />
                  </td>
                  <td>
                    <input class="b3-text-field" type="text" bind:value={link.url} placeholder="https:// 或 SELECT id FROM..." />
                  </td>
                  <td style="text-align: center;">
                    <button class="delete-btn" on:click={() => removeLink(i)}>
                      <svg style="width: 16px; height: 16px; fill: var(--b3-theme-error);"><use xlink:href="#iconTrashcan"></use></svg>
                    </button>
                  </td>
                </tr>
              {/each}
              {#if links.length === 0}
                <tr>
                  <td colspan="4" style="text-align: center; color: var(--b3-theme-on-surface); opacity: 0.5; padding: 24px;">
                    点击“添加动作”开始配置快捷操作
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer Actions -->
  <div class="settings-footer fn__flex justify-end">
    <button class="b3-button b3-button--cancel" on:click={closeDialog}>取消</button>
    <div class="fn__space"></div>
    <button class="b3-button" on:click={handleSave}>保存配置</button>
  </div>
</div>

<style>
  .settings-container {
    padding: 16px;
    height: 100%;
    box-sizing: border-box;
    background-color: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
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

  .setting-row.align-stretch {
    align-items: stretch;
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

  .links-list {
    overflow-y: auto;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background-color: var(--b3-theme-surface);
  }

  .links-table {
    width: 100%;
    border-collapse: collapse;
  }

  .links-table th, .links-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--b3-border-color);
    text-align: left;
    font-size: 13px;
  }

  .links-table th {
    background-color: var(--b3-theme-background);
    font-weight: normal;
    opacity: 0.8;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .links-table td input {
    width: 100%;
    box-sizing: border-box;
  }

  .links-table td .input-center {
    text-align: center;
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .delete-btn:hover {
    background-color: rgba(244, 63, 94, 0.1);
  }

  .settings-footer {
    border-top: 1px solid var(--b3-border-color);
    padding-top: 16px;
    margin-top: 16px;
  }
</style>
