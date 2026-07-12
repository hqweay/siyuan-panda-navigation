<script lang="ts">
  import { showMessage, Dialog } from "siyuan";
  import { settings } from "../settings";
  import { plugin, getActionKey } from "../utils";
  import { builtinMetas } from "../utils/builtin-metas";

  let hooks: any[] = settings.getBySpace("nav-helper", "globalClickHooks") || [];
  let expandedScripts: Set<string> = new Set();

  function toggleScriptExpand(id: string) {
    if (expandedScripts.has(id)) {
      expandedScripts.delete(id);
    } else {
      expandedScripts.add(id);
    }
    expandedScripts = expandedScripts;
  }

  function scriptPreview(text: string): string {
    if (!text || text.length <= 100) return text || "";
    return text.slice(0, 100) + "...";
  }

  async function syncHooksToKernel() {
    try {
      if ((plugin as any)?.kernel?.rpc?.call?.["panda-nav:update-hooks"]) {
        await (plugin as any).kernel.rpc.call["panda-nav:update-hooks"]({ hooks });
      }
    } catch (e) {
      console.warn("panda-nav: 同步钩子到内核失败，内核 config.json 未更新，仅前端 settings 生效", e);
    }
  }

  async function toggleEnabled(hook: any) {
    const updated = hooks.map(h =>
      h.id === hook.id ? { ...h, enabled: !h.enabled } : h
    );
    hooks = updated;
    settings.setBySpace("nav-helper", "globalClickHooks", hooks);
    await settings.save();
    await syncHooksToKernel();
    const toggleMsgKey = updated.find(h => h.id === hook.id)!.enabled ? "lets-nav-helper.hooks.toggledEnabled" : "lets-nav-helper.hooks.toggledDisabled";
    showMessage(plugin.i18n[toggleMsgKey].replace("{name}", hook.name));
  }

  async function deleteHook(id: string, name: string) {
    const dialog = new Dialog({
      title: plugin.i18n["lets-nav-helper.hooks.deleteTitle"],
      content: `<div class="b3-dialog__content" style="padding: 16px;">
        <p style="margin: 0;">${plugin.i18n["lets-nav-helper.hooks.deleteConfirmMsg"].replace("{name}", name)}</p>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="deleteHookCancelBtn">${plugin.i18n["lets-nav-helper.settings.cancel"]}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="deleteHookConfirmBtn">${plugin.i18n["lets-nav-helper.hooks.confirmDelete"]}</button>
      </div>`,
      width: "360px",
    });
    const cancelBtn = dialog.element.querySelector("#deleteHookCancelBtn");
    const confirmBtn = dialog.element.querySelector("#deleteHookConfirmBtn");
    cancelBtn?.addEventListener("click", () => dialog.destroy());
    confirmBtn?.addEventListener("click", async () => {
      hooks = hooks.filter(h => h.id !== id);
      settings.setBySpace("nav-helper", "globalClickHooks", hooks);
      await settings.save();
      await syncHooksToKernel();
      showMessage(plugin.i18n["lets-nav-helper.hooks.deleted"].replace("{name}", name));
      dialog.destroy();
    });
  }

  function openHookEditor(existingHook?: any) {
    const menuItems: any[] = settings.getBySpace("nav-helper", "menuItems") || [];
    const allButtons = menuItems.filter((i: any) => i.id);
    const usedValues = new Set<string>();
    menuItems.forEach((i: any) => { if (i.value) usedValues.add(i.value); });
    Object.keys(builtinMetas).forEach(k => usedValues.add(k));

    let name = existingHook?.name || "";
    let mode = existingHook?.mode || "after";
    let matchAll = existingHook?.matchAll ?? false;
    let matchKey = existingHook?.match?.key || "";
    let matchType = existingHook?.match?.type || "";
    let matchTitle = existingHook?.match?.titleMatch || "";
    let matchActionValue = existingHook?.match?.actionValue || "";
    let priority = existingHook?.priority ?? 0;
    let enabled = existingHook?.enabled ?? true;
    let script = existingHook?.script || "";

    const isEdit = !!existingHook;

    const seen = new Set<string>();
    const btnOptions = allButtons
      .filter((b: any) => {
        const key = getActionKey(b);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((b: any) => {
        const key = getActionKey(b);
        return `<option value="${key}" ${matchKey === key ? "selected" : ""}>${b.title || plugin.i18n["lets-nav-helper.hooks.unnamed"]} (${b.type})</option>`;
      })
      .join("");
    const valueOptions = Array.from(usedValues).sort().map(v =>
      `<option value="${v}" ${matchActionValue === v ? "selected" : ""}>${v}</option>`
    ).join("");

    const dialog = new Dialog({
      title: isEdit ? plugin.i18n["lets-nav-helper.hooks.editTitle"] : plugin.i18n["lets-nav-helper.hooks.newTitle"],
      content: `<div class="b3-dialog__content" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.fieldName"]}</span>
          <input class="b3-text-field" id="hookName" value="${name.replace(/"/g, "&quot;")}" style="width: 100%;" />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.fieldMode"]}</span>
          <select class="b3-select" id="hookMode" style="width: 100%;">
            <option value="before" ${mode === "before" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.modeBefore"]}</option>
            <option value="replace" ${mode === "replace" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.modeReplace"]}</option>
            <option value="after" ${mode === "after" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.modeAfter"]}</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="hookMatchAll" ${matchAll ? "checked" : ""} />
          <span style="font-size: 12px;">${plugin.i18n["lets-nav-helper.hooks.matchAll"]}</span>
        </label>
        <div id="matchFields" style="display: flex; flex-direction: column; gap: 8px; ${matchAll ? "display: none;" : ""}">
          <span id="andHint" style="font-size: 11px; opacity: 0.6;">${plugin.i18n["lets-nav-helper.hooks.andHint"]}</span>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.matchButton"]}</span>
            <select class="b3-select" id="hookMatchKey" style="width: 100%;">
              <option value="">${plugin.i18n["lets-nav-helper.hooks.anyOption"]}</option>
              ${btnOptions}
            </select>
          </label>
          <div id="otherMatchFields" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.matchType"]}</span>
              <select class="b3-select" id="hookMatchType" style="width: 100%;">
                <option value="">${plugin.i18n["lets-nav-helper.hooks.anyOption"]}</option>
                <option value="builtin" ${matchType === "builtin" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.typeBuiltin"]}</option>
                <option value="command" ${matchType === "command" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.typeCommand"]}</option>
                <option value="pluginCommand" ${matchType === "pluginCommand" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.typePluginCommand"]}</option>
                <option value="group" ${matchType === "group" ? "selected" : ""}>${plugin.i18n["lets-nav-helper.hooks.typeGroup"]}</option>
              </select>
            </label>
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.matchTitle"]}</span>
              <input class="b3-text-field" id="hookMatchTitle" value="${matchTitle.replace(/"/g, "&quot;")}" style="width: 100%;" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.matchActionValue"]}</span>
              <select class="b3-select" id="hookMatchActionValue" style="width: 100%;">
                <option value="">${plugin.i18n["lets-nav-helper.hooks.anyOption"]}</option>
                ${valueOptions}
              </select>
            </label>
          </div>
        </div>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.fieldPriority"]}</span>
          <input class="b3-text-field" id="hookPriority" type="number" value="${priority}" style="width: 100%;" />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">${plugin.i18n["lets-nav-helper.hooks.fieldScript"]}</span>
          <textarea class="b3-text-field" id="hookScript" rows="8" style="width: 100%; font-family: monospace; font-size: 11px;">${script.replace(/"/g, "&quot;")}</textarea>
          <span style="font-size: 11px; opacity: 0.5;">${plugin.i18n["lets-nav-helper.hooks.scriptHint"]}</span>
        </label>
      </div>
      <div class="b3-dialog__action" style="padding: 16px 16px 0;">
        <button class="b3-button b3-button--cancel" id="hookCancelBtn">${plugin.i18n["lets-nav-helper.settings.cancel"]}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="hookSaveBtn">${isEdit ? plugin.i18n["lets-nav-helper.hooks.saveBtn"] : plugin.i18n["lets-nav-helper.hooks.createBtn"]}</button>
      </div>`,
      width: "520px",
    });

    const cancelBtn = dialog.element.querySelector("#hookCancelBtn");
    const saveBtn = dialog.element.querySelector("#hookSaveBtn");
    const matchAllCheckbox = dialog.element.querySelector("#hookMatchAll") as HTMLInputElement;
    const matchFields = dialog.element.querySelector("#matchFields") as HTMLElement;

    matchAllCheckbox?.addEventListener("change", () => {
      matchFields.style.display = matchAllCheckbox.checked ? "none" : "flex";
    });

    const hookMatchKey = dialog.element.querySelector("#hookMatchKey") as HTMLSelectElement;
    const otherMatchFields = dialog.element.querySelector("#otherMatchFields") as HTMLElement;
    const andHint = dialog.element.querySelector("#andHint") as HTMLElement;
    function toggleOtherFields() {
      const locked = hookMatchKey.value !== "";
      otherMatchFields.style.opacity = locked ? "0.35" : "1";
      otherMatchFields.style.pointerEvents = locked ? "none" : "auto";
      andHint.textContent = locked ? plugin.i18n["lets-nav-helper.hooks.andHintLocked"] : plugin.i18n["lets-nav-helper.hooks.andHint"];
      if (locked) {
        (dialog.element.querySelector("#hookMatchType") as HTMLSelectElement).value = "";
        (dialog.element.querySelector("#hookMatchTitle") as HTMLInputElement).value = "";
        (dialog.element.querySelector("#hookMatchActionValue") as HTMLSelectElement).value = "";
      }
    }
    hookMatchKey?.addEventListener("change", toggleOtherFields);
    toggleOtherFields();

    cancelBtn?.addEventListener("click", () => dialog.destroy());

    saveBtn?.addEventListener("click", async () => {
      const el = (id: string) => dialog.element.querySelector(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      const newName = (el("#hookName") as HTMLInputElement).value.trim();
      if (!newName) { showMessage(plugin.i18n["lets-nav-helper.hooks.requireName"]); return; }

      const newScript = (el("#hookScript") as HTMLTextAreaElement).value.trim();
      if (!newScript) { showMessage(plugin.i18n["lets-nav-helper.hooks.requireScript"]); return; }
      if (newScript.length > 10 * 1024) { showMessage(plugin.i18n["lets-nav-helper.hooks.scriptTooLarge"]); return; }

      const newMatchAll = (el("#hookMatchAll") as HTMLInputElement).checked;
      const mKey = (el("#hookMatchKey") as HTMLInputElement).value.trim();
      const mType = (el("#hookMatchType") as HTMLSelectElement).value;
      const mTitle = (el("#hookMatchTitle") as HTMLInputElement).value.trim();
      const mActionValue = (el("#hookMatchActionValue") as HTMLInputElement).value.trim();
      const newPriority = parseInt((el("#hookPriority") as HTMLInputElement).value) || 0;
      const newMode = (el("#hookMode") as HTMLSelectElement).value;

      const match: any = {};
      if (mKey) match.key = mKey;
      if (mType) match.type = mType;
      if (mTitle) match.titleMatch = mTitle;
      if (mActionValue) match.actionValue = mActionValue;

      const hookData = {
        name: newName,
        mode: newMode,
        matchAll: newMatchAll,
        match: Object.keys(match).length > 0 ? match : undefined,
        priority: newPriority,
        enabled: true,
        script: newScript,
      };

      if (isEdit) {
        hooks = hooks.map(h => h.id === existingHook.id ? { ...h, ...hookData } : h);
      } else {
        hookData.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        hooks = [...hooks, hookData];
      }

      settings.setBySpace("nav-helper", "globalClickHooks", hooks);
      await settings.save();
      await syncHooksToKernel();
      showMessage(isEdit ? plugin.i18n["lets-nav-helper.hooks.updated"].replace("{name}", newName) : plugin.i18n["lets-nav-helper.hooks.created"].replace("{name}", newName));
      dialog.destroy();
    });
  }

  function matchSummary(hook: any): string {
    if (hook.matchAll) return plugin.i18n["lets-nav-helper.hooks.matchAllKeys"];
    const parts: string[] = [];
    if (hook.match?.key) {
      const all = (settings.getBySpace("nav-helper", "menuItems") || []);
      const btn = all.find((i: any) => getActionKey(i) === hook.match.key);
      parts.push(plugin.i18n["lets-nav-helper.hooks.matchButtonLabel"] + (btn ? btn.title : plugin.i18n["lets-nav-helper.hooks.matchDeletedButton"]));
    }
    if (hook.match?.type) parts.push(plugin.i18n["lets-nav-helper.hooks.matchTypeLabel"] + hook.match.type);
    if (hook.match?.titleMatch) parts.push(plugin.i18n["lets-nav-helper.hooks.matchTitleLabel"] + hook.match.titleMatch);
    if (hook.match?.actionValue) parts.push(plugin.i18n["lets-nav-helper.hooks.matchActionValueLabel"] + hook.match.actionValue);
    return parts.length > 0 ? plugin.i18n["lets-nav-helper.hooks.matchConditionFull"] + parts.join(plugin.i18n["lets-nav-helper.hooks.matchConditionSep"]) : plugin.i18n["lets-nav-helper.hooks.matchNoCondition"];
  }

  function priorityClass(p: number): string {
    if (p == null) return "";
    if (p > 0) return "priority-high";
    if (p < 0) return "priority-low";
    return "priority-zero";
  }
</script>

<div class="tab-pane">
  <div class="setting-row" style="display: flex; justify-content: space-between; align-items: center;">
    <span class="setting-title">{plugin.i18n["lets-nav-helper.hooks.title"].replace("{count}", hooks.length)}</span>
    <button class="b3-button b3-button--outline" on:click={() => openHookEditor()}>+ {plugin.i18n["lets-nav-helper.hooks.newBtn"]}</button>
  </div>
  {#if hooks.length === 0}
    <div class="setting-row" style="flex-direction: column; align-items: center; gap: 8px; padding: 24px;">
      <span class="setting-desc" style="text-align: center;">
        {plugin.i18n["lets-nav-helper.hooks.emptyLine1"]}<br>
        {plugin.i18n["lets-nav-helper.hooks.emptyLine2Prefix"]}<code>showMessage("✨")</code>{plugin.i18n["lets-nav-helper.hooks.emptyLine2Suffix"]}
      </span>
    </div>
  {:else}
    {#each hooks as hook, i (hook.id)}
      <div class="setting-row hook-row" style="gap: 12px; align-items: flex-start; {hook.enabled === false ? 'opacity: 0.5;' : ''}">
        <div class="hook-main" style="flex: 1; min-width: 0;">
          <div class="hook-header">
            <span class="setting-title">{hook.name || plugin.i18n["lets-nav-helper.hooks.unnamed"]}</span>
            {#if hook.enabled === false}
              <span class="hook-badge disabled-label">{plugin.i18n["lets-nav-helper.hooks.disabled"]}</span>
            {/if}
            <span class="hook-badge mode-{hook.mode}">{hook.mode}</span>
            {#if hook.priority != null}
              <span class="hook-badge {priorityClass(hook.priority)}">{plugin.i18n["lets-nav-helper.hooks.priority"]} {hook.priority}</span>
            {/if}
          </div>
          <div class="setting-desc hook-match">{matchSummary(hook)}</div>
          {#if hook.script}
            <div class="hook-script" style="margin-top: 6px;">
              {#if expandedScripts.has(hook.id)}
                <pre class="script-pre">{hook.script}</pre>
                <button class="script-toggle" on:click={() => toggleScriptExpand(hook.id)}>{plugin.i18n["lets-nav-helper.hooks.collapseScript"]}</button>
              {:else}
                <code class="script-preview">{scriptPreview(hook.script)}</code>
                {#if hook.script.length > 100}
                  <button class="script-toggle" on:click={() => toggleScriptExpand(hook.id)}>{plugin.i18n["lets-nav-helper.hooks.expandScript"]}</button>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
        <div class="hook-controls" style="flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
          <label class="toggle-switch" title={hook.enabled === false ? plugin.i18n["lets-nav-helper.hooks.clickToEnable"] : plugin.i18n["lets-nav-helper.hooks.clickToDisable"]}>
            <input
              type="checkbox"
              checked={hook.enabled !== false}
              on:change={() => toggleEnabled(hook)}
            />
            <span class="toggle-slider"></span>
          </label>
          <button
            class="b3-button b3-button--outline"
            style="padding: 2px 8px; font-size: 12px;"
            on:click={() => openHookEditor(hook)}>{plugin.i18n["lets-nav-helper.hooks.editBtn"]}</button>
          <button
            class="b3-button b3-button--outline"
            style="padding: 2px 8px; font-size: 12px; color: var(--b3-theme-error);"
            on:click={() => deleteHook(hook.id, hook.name)}>{plugin.i18n["lets-nav-helper.hooks.deleteBtn"]}</button>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .hook-row {
    flex-wrap: wrap;
  }
  .hook-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .hook-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    white-space: nowrap;
  }
  .hook-badge.mode-before { border-color: #2196f3; color: #2196f3; }
  .hook-badge.mode-replace { border-color: #ff9800; color: #ff9800; }
  .hook-badge.mode-after { border-color: #4caf50; color: #4caf50; }
  .hook-badge.priority-high { border-color: #f44336; color: #f44336; }
  .hook-badge.priority-low { border-color: #9e9e9e; color: #9e9e9e; }
  .hook-badge.priority-zero { border-color: #607d8b; color: #607d8b; }
  .hook-match {
    word-break: break-all;
    line-height: 1.4;
  }
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;
  }
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 10px;
    transition: 0.2s;
  }
  .toggle-slider::before {
    content: "";
    position: absolute;
    width: 14px;
    height: 14px;
    left: 2px;
    bottom: 2px;
    background: var(--b3-theme-on-surface);
    border-radius: 50%;
    transition: 0.2s;
    opacity: 0.5;
  }
  .toggle-switch input:checked + .toggle-slider {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
  }
  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(16px);
    background: #fff;
    opacity: 1;
  }
  .disabled-label {
    border-color: #9e9e9e;
    color: #9e9e9e;
  }
  .hook-script {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .script-pre {
    font-family: monospace;
    font-size: 11px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 8px;
    margin: 0;
    max-height: 120px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .script-preview {
    font-family: monospace;
    font-size: 11px;
    opacity: 0.6;
    word-break: break-all;
  }
  .script-toggle {
    background: none;
    border: none;
    color: var(--b3-theme-primary);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 0;
    text-align: left;
  }
  .script-toggle:hover {
    opacity: 0.8;
  }
  code {
    font-family: monospace;
    background: var(--b3-theme-surface);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }
</style>
