<script lang="ts">
  import { plugin } from "../utils";
  import type { StyleToken } from "../style-tokens";

  export let token: StyleToken;
  export let value: string = "";
  export let onChange: (value: string) => void = () => {};

  $: isDefault = value !== "" && token.cssFallback != null && value.trim() === token.cssFallback;
</script>

<div class="fn__flex" style="gap: 8px; align-items: center;">
  {#if token.type === "color"}
    <input
      type="color"
      value={value || token.cssFallback || "#ffffff"}
      on:input={(e) => onChange(e.currentTarget.value)}
      style="width: 36px; height: 36px; padding: 2px; border: 1px solid var(--b3-border-color); border-radius: 6px; cursor: pointer; background: none;"
    />
    <input
      class="b3-text-field"
      type="text"
      value={value}
      on:input={(e) => onChange(e.currentTarget.value)}
      placeholder={token.cssFallback || plugin.i18n["lets-nav-helper.styleToken.defaultPlaceholder"]}
      style="width: 120px;"
    />
  {:else if token.type === "size" || token.type === "opacity"}
    <input
      type="range"
      min={token.min != null ? token.min : 0}
      max={token.max != null ? token.max : 100}
      step={token.step != null ? token.step : 1}
      value={parseFloat(value) || parseFloat(token.cssFallback) || 0}
      on:input={(e) => {
        const num = parseFloat(e.currentTarget.value);
        onChange(token.type === "opacity" ? num + "" : num + "px");
      }}
      style="width: 120px;"
    />
    <span class="setting-desc" style="min-width: 40px; text-align: right;">
      {value || token.cssFallback || ""}
    </span>
  {:else}
    <input
      class="b3-text-field"
      type="text"
      value={value}
      on:input={(e) => onChange(e.currentTarget.value)}
      placeholder={token.cssFallback || plugin.i18n["lets-nav-helper.styleToken.defaultPlaceholder"]}
      style="width: 160px;"
    />
  {/if}
  {#if isDefault}
    <span class="setting-desc" style="opacity: 0.5; font-size: 11px; white-space: nowrap;">{plugin.i18n["lets-nav-helper.styleToken.defaultValue"]}</span>
  {/if}
  {#if value}
    <button
      class="b3-button b3-button--outline"
      style="padding: 0 6px; font-size: 11px;"
      on:click={() => onChange("")}>{plugin.i18n["lets-nav-helper.styleToken.reset"]}</button
    >
  {/if}
</div>
