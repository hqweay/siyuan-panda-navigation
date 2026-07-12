<script lang="ts">
  import { showMessage, Dialog } from "siyuan";
  import { plugin } from "@/utils";
  import { settings } from "../settings";
  import { STYLE_TOKENS, type StyleToken } from "../style-tokens";
  import StyleTokenInput from "./StyleTokenInput.svelte";

  export let styleOverrides: Record<string, string> = {};
  export let onChange: (overrides: Record<string, string>) => void = () => {};

  let stylePresets: { name: string; overrides: Record<string, string> }[] = settings.getBySpace("nav-helper", "stylePresets") || [];
  let styleAdvancedOpen = settings.getBySpace("nav-helper", "styleAdvancedOpen") === true;
  $: coreTokens = STYLE_TOKENS.filter(t => t.category === "core");
  $: advancedTokens = STYLE_TOKENS.filter(t => t.category === "advanced");
  $: submenuTokens = STYLE_TOKENS.filter(t => t.category === "submenu");

  function toggleAdvancedOpen() {
    styleAdvancedOpen = !styleAdvancedOpen;
    settings.setBySpace("nav-helper", "styleAdvancedOpen", styleAdvancedOpen);
    settings.save();
  }

  function saveStylePreset() {
    const dialog = new Dialog({
      title: plugin.i18n["lets-nav-helper.appearance.savePresetTitle"],
      content: `<div class="b3-dialog__content">
        <input class="b3-text-field fn__block" id="stylePresetNameInput" placeholder="${plugin.i18n["lets-nav-helper.appearance.presetNamePlaceholder"]}">
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="stylePresetCancelBtn">${plugin.i18n["lets-nav-helper.cancelBtn"]}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="stylePresetConfirmBtn">${plugin.i18n["lets-nav-helper.preset.confirm"]}</button>
      </div>`,
      width: "400px",
    });
    const input = dialog.element.querySelector("#stylePresetNameInput") as HTMLInputElement;
    const cancelBtn = dialog.element.querySelector("#stylePresetCancelBtn");
    const confirmBtn = dialog.element.querySelector("#stylePresetConfirmBtn");

    setTimeout(() => input?.focus(), 100);

    cancelBtn?.addEventListener("click", () => dialog.destroy());

    const save = () => {
      const name = input?.value?.trim();
      if (name) {
        if (stylePresets.some(p => p.name === name)) {
          showMessage(plugin.i18n["lets-nav-helper.appearance.presetExists"].replace("{name}", name));
          return;
        }
        stylePresets = [...stylePresets, { name, overrides: { ...styleOverrides } }];
        settings.setBySpace("nav-helper", "stylePresets", stylePresets);
        settings.save();
        showMessage(plugin.i18n["lets-nav-helper.appearance.presetSaved"]);
        dialog.destroy();
      }
    };

    confirmBtn?.addEventListener("click", save);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") dialog.destroy();
    });
  }

  function deleteStylePreset(name: string) {
    const confirmDialog = new Dialog({
      title: plugin.i18n["lets-nav-helper.appearance.deletePresetTitle"],
      content: `<div class="b3-dialog__content" style="padding: 16px;">
        <p style="margin: 0;">${plugin.i18n["lets-nav-helper.appearance.deletePresetConfirm"].replace("{name}", name)}</p>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="deletePresetCancelBtn">${plugin.i18n["lets-nav-helper.cancelBtn"]}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="deletePresetConfirmBtn">${plugin.i18n["lets-nav-helper.preset.deleteConfirmBtn"]}</button>
      </div>`,
      width: "360px",
    });
    const cancelBtn = confirmDialog.element.querySelector("#deletePresetCancelBtn");
    const confirmBtn = confirmDialog.element.querySelector("#deletePresetConfirmBtn");
    cancelBtn?.addEventListener("click", () => confirmDialog.destroy());
    confirmBtn?.addEventListener("click", () => {
      stylePresets = stylePresets.filter(p => p.name !== name);
      settings.setBySpace("nav-helper", "stylePresets", stylePresets);
      settings.save();
      showMessage(plugin.i18n["lets-nav-helper.appearance.presetDeleted"].replace("{name}", name));
      confirmDialog.destroy();
    });
  }

  function applyStylePreset(name: string) {
    const preset = stylePresets.find(p => p.name === name);
    if (preset) {
      styleOverrides = { ...preset.overrides };
      onChange(styleOverrides);
    }
  }

  function resetAllStyles() {
    onChange({});
    showMessage(plugin.i18n["lets-nav-helper.appearance.allReset"]);
  }

  function handleStyleChange(token: StyleToken, val: string) {
    const next = { ...styleOverrides };
    if (val) {
      next[token.variable] = val;
    } else {
      delete next[token.variable];
    }
    onChange(next);
  }
</script>

<div class="tab-pane">
  <div class="setting-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
    <div class="setting-info">
      <span class="setting-title">{plugin.i18n["lets-nav-helper.appearance.navStyle"]}</span>
      <span class="setting-desc">{plugin.i18n["lets-nav-helper.appearance.navStyleDesc"]}</span>
    </div>
  </div>

  {#each coreTokens as token}
    <div class="setting-row" style="flex-wrap: wrap; gap: 12px;">
      <div class="setting-info" style="flex: 1; min-width: 140px;">
        <span class="setting-title">{plugin.i18n[token.labelKey] || token.label}</span>
        <span class="setting-desc">{plugin.i18n[token.descriptionKey] || token.description}</span>
      </div>
      <div class="button-controls" style="flex-shrink: 0;">
        <StyleTokenInput {token} value={styleOverrides[token.variable] || ""} onChange={(v) => handleStyleChange(token, v)} />
      </div>
    </div>
  {/each}

  <details open={styleAdvancedOpen} style="margin-top: 8px;">
    <summary on:click|preventDefault={toggleAdvancedOpen} style="cursor: pointer; opacity: 0.6; font-size: 13px; padding: 8px 0;">{plugin.i18n["lets-nav-helper.appearance.advancedOptions"]}</summary>
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      {#each advancedTokens as token}
        <div class="setting-row" style="flex-wrap: wrap; gap: 12px;">
          <div class="setting-info" style="flex: 1; min-width: 140px;">
            <span class="setting-title">{token.label}</span>
            <span class="setting-desc">{token.description}</span>
          </div>
          <div class="button-controls" style="flex-shrink: 0;">
            <StyleTokenInput {token} value={styleOverrides[token.variable] || ""} onChange={(v) => handleStyleChange(token, v)} />
          </div>
        </div>
      {/each}
    </div>

    <div class="setting-row" style="margin-top: 8px; gap: 8px; flex-wrap: wrap;">
      <div class="setting-info">
        <span class="setting-title">{plugin.i18n["lets-nav-helper.appearance.managePresets"]}</span>
        <span class="setting-desc">{plugin.i18n["lets-nav-helper.appearance.managePresetsDesc"]}</span>
      </div>
      <div class="button-controls" style="gap: 8px; flex-wrap: wrap;">
        <button
          class="b3-button b3-button--outline"
          on:click={saveStylePreset}>{plugin.i18n["lets-nav-helper.appearance.saveAsPreset"]}</button
        >
        {#if stylePresets.length > 0}
          <select
            class="b3-select"
            style="width: 140px;"
            on:change={(e) => {
              const name = e.currentTarget.value;
              if (!name) return;
              applyStylePreset(name);
              e.currentTarget.value = "";
            }}
          >
            <option value="">{plugin.i18n["lets-nav-helper.appearance.applyPreset"]}</option>
            {#each stylePresets as preset}
              <option value={preset.name}>{preset.name}</option>
            {/each}
          </select>
          {#each stylePresets as preset}
            <button
              class="b3-button b3-button--outline"
              style="padding: 2px 8px; font-size: 12px; color: var(--b3-theme-error);"
              on:click={() => deleteStylePreset(preset.name)}>{preset.name} ✕</button>
          {/each}
        {/if}
        <button
          class="b3-button b3-button--outline"
          style="color: var(--b3-theme-error);"
          on:click={resetAllStyles}>{plugin.i18n["lets-nav-helper.appearance.resetAll"]}</button
        >
      </div>
    </div>
  </details>

  <details style="margin-top: 8px;">
    <summary style="cursor: pointer; opacity: 0.6; font-size: 13px; padding: 8px 0;">{plugin.i18n["lets-nav-helper.appearance.submenuStyle"]}</summary>
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      {#each submenuTokens as token}
        <div class="setting-row" style="flex-wrap: wrap; gap: 12px;">
          <div class="setting-info" style="flex: 1; min-width: 140px;">
            <span class="setting-title">{token.label}</span>
            <span class="setting-desc">{token.description}</span>
          </div>
          <div class="button-controls" style="flex-shrink: 0;">
            <StyleTokenInput {token} value={styleOverrides[token.variable] || ""} onChange={(v) => handleStyleChange(token, v)} />
          </div>
        </div>
      {/each}
    </div>
  </details>
</div>
