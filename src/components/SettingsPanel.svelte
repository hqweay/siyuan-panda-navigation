<script lang="ts">
  import { settings } from "../settings";
  import { plugin } from "../utils";
  import { normalizeMenuItems } from "../normalize";
  import { showMessage } from "siyuan";
  import AppearanceSettings from "./AppearanceSettings.svelte";
  import ButtonSettings from "./ButtonSettings.svelte";
  import HookSettings from "./HookSettings.svelte";

  export let closeDialog: () => void;

  let activeTab: "general" | "buttons" | "appearance" | "hooks" = "general";

  let enableBottomNav =
    settings.getBySpace("nav-helper", "enableBottomNav") ?? "both";
  let showButtonLabels =
    settings.getBySpace("nav-helper", "showButtonLabels") ?? "both";

  let styleOverrides: Record<string, string> = { ...(settings.getBySpace("nav-helper", "styleOverrides") || {}) };

  function handleAppearanceChange(overrides: Record<string, string>) {
    styleOverrides = overrides;
  }

  let menuItems: any[] = normalizeMenuItems(
    settings.getBySpace("nav-helper", "menuItems") || [],
  );

  function handleButtonSettingsChange(items: any[], labels: string) {
    menuItems = items;
    showButtonLabels = labels;
  }

  async function handleSave() {
    settings.setBySpace("nav-helper", "enableBottomNav", enableBottomNav);
    settings.setBySpace("nav-helper", "menuItems", menuItems);
    settings.setBySpace("nav-helper", "showButtonLabels", showButtonLabels);
    settings.setBySpace("nav-helper", "styleOverrides", styleOverrides);

    await settings.save();
    showMessage("熊猫导航配置已保存");
    closeDialog();

    // 触发插件实例更新
    if (plugin && (plugin as any).handleSettingsChange) {
      (plugin as any).handleSettingsChange();
    }
  }
</script>

<div class="panda-nav settings-container fn__flex-column fn__flex-1">
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
      菜单构建
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "appearance"}
      on:click={() => (activeTab = "appearance")}
    >
      外观
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "hooks"}
      on:click={() => (activeTab = "hooks")}
    >
      钩子
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
      </div>
    {/if}

    {#if activeTab === "buttons"}
      <ButtonSettings
        {menuItems}
        {showButtonLabels}
        onChange={handleButtonSettingsChange}
      />
    {/if}

    {#if activeTab === "appearance"}
      <AppearanceSettings {styleOverrides} onChange={handleAppearanceChange} />
    {/if}

    {#if activeTab === "hooks"}
      <HookSettings />
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

  :global(.panda-nav .tab-pane) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  :global(.panda-nav .setting-row) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
  }

  :global(.panda-nav .setting-info) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.panda-nav .setting-title) {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  :global(.panda-nav .setting-desc) {
    font-size: 12px;
    opacity: 0.6;
  }

  :global(.panda-nav .button-controls) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  :global(.panda-nav .button-controls .b3-select) {
    width: 130px;
  }

  :global(.panda-nav .align-center) {
    align-items: center;
  }

  :global(.panda-nav .justify-between) {
    justify-content: space-between;
  }

  :global(.panda-nav .justify-end) {
    justify-content: flex-end;
  }

  .settings-footer {
    border-top: 1px solid var(--b3-border-color);
    padding-top: 16px;
    margin-top: 16px;
  }
</style>
