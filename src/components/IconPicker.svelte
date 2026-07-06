<script lang="ts">
  export let active: boolean;
  export let currentIcon: string;
  export let allIcons: string[] = [];
  export let onSelect: (icon: string) => void;
  export let onClose: () => void;

  let searchQuery = "";

  $: filteredIcons = allIcons.filter((icon) =>
    icon.toLowerCase().includes(searchQuery.toLowerCase()),
  );
</script>

{#if active}
  <div class="icon-picker-panel fn__flex-column">
    <div class="picker-header fn__flex align-center justify-between">
      <span class="picker-title">🎨 选择动作图标</span>
      <button class="picker-close-btn" on:click={onClose}>
        <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>

    <div class="picker-search">
      <input
        class="b3-text-field fn__block"
        type="text"
        placeholder="🔍 搜索图标 (输入英文名称过滤)..."
        bind:value={searchQuery}
      />
    </div>

    <div class="picker-grid fn__flex-1">
      {#each filteredIcons as icon}
        <button
          class="picker-icon-card"
          class:active={currentIcon === icon}
          on:click={() => onSelect(icon)}
        >
          <svg class="picker-svg"><use xlink:href={icon}></use></svg>
          <span class="picker-icon-name">{icon.replace("#icon", "")}</span>
        </button>
      {/each}
      {#if filteredIcons.length === 0}
        <div class="picker-no-results">📭 没有找到匹配的图标</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .icon-picker-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--b3-theme-background);
    padding: 16px;
    box-sizing: border-box;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .picker-header {
    margin-bottom: 12px;
  }

  .picker-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .picker-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: inline-flex;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .picker-close-btn:hover {
    background-color: var(--b3-theme-background-light);
    opacity: 1;
  }

  .close-icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }

  .picker-search {
    margin-bottom: 14px;
  }

  .picker-grid {
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: min-content;
    gap: 8px;
    padding-right: 4px;
  }

  .picker-icon-card {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 64px;
    box-sizing: border-box;
  }

  .picker-icon-card:hover {
    border-color: var(--b3-theme-primary);
    background-color: var(--b3-theme-background-light);
  }

  .picker-icon-card.active {
    border-color: var(--b3-theme-primary);
    background-color: rgba(65, 184, 131, 0.1);
    color: var(--b3-theme-primary);
  }

  .picker-svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    margin-bottom: 6px;
  }

  .picker-icon-name {
    font-size: 10px;
    opacity: 0.7;
    text-align: center;
    word-break: break-all;
    white-space: normal;
  }

  .picker-no-results {
    grid-column: span 4;
    text-align: center;
    padding: 40px;
    opacity: 0.5;
    font-size: 13px;
  }
</style>
