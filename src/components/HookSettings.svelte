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
    showMessage(`钩子 "${hook.name}" 已${updated.find(h => h.id === hook.id)!.enabled ? "启用" : "禁用"}`);
  }

  async function deleteHook(id: string, name: string) {
    const dialog = new Dialog({
      title: "删除全局钩子",
      content: `<div class="b3-dialog__content" style="padding: 16px;">
        <p style="margin: 0;">确定要删除钩子 <strong>"${name}"</strong> 吗？</p>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" id="deleteHookCancelBtn">取消</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="deleteHookConfirmBtn">确定删除</button>
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
      showMessage(`钩子 "${name}" 已删除`);
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
        return `<option value="${key}" ${matchKey === key ? "selected" : ""}>${b.title || "(未命名)"} (${b.type})</option>`;
      })
      .join("");
    const valueOptions = Array.from(usedValues).sort().map(v =>
      `<option value="${v}" ${matchActionValue === v ? "selected" : ""}>${v}</option>`
    ).join("");

    const dialog = new Dialog({
      title: isEdit ? "编辑全局钩子" : "新建全局钩子",
      content: `<div class="b3-dialog__content" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">名称</span>
          <input class="b3-text-field" id="hookName" value="${name.replace(/"/g, "&quot;")}" style="width: 100%;" />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">模式</span>
          <select class="b3-select" id="hookMode" style="width: 100%;">
            <option value="before" ${mode === "before" ? "selected" : ""}>before（执行前）</option>
            <option value="replace" ${mode === "replace" ? "selected" : ""}>replace（替换）</option>
            <option value="after" ${mode === "after" ? "selected" : ""}>after（执行后）</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="hookMatchAll" ${matchAll ? "checked" : ""} />
          <span style="font-size: 12px;">匹配所有按钮</span>
        </label>
        <div id="matchFields" style="display: flex; flex-direction: column; gap: 8px; ${matchAll ? "display: none;" : ""}">
          <span style="font-size: 11px; opacity: 0.6;">多个条件需同时满足（AND）</span>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 12px; opacity: 0.7;">匹配 - 按钮</span>
            <select class="b3-select" id="hookMatchKey" style="width: 100%;">
              <option value="">（不限）</option>
              ${btnOptions}
            </select>
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 12px; opacity: 0.7;">匹配 - 按钮类型</span>
            <select class="b3-select" id="hookMatchType" style="width: 100%;">
              <option value="">（不限）</option>
              <option value="builtin" ${matchType === "builtin" ? "selected" : ""}>builtin（内置功能）</option>
              <option value="command" ${matchType === "command" ? "selected" : ""}>command（系统命令）</option>
              <option value="pluginCommand" ${matchType === "pluginCommand" ? "selected" : ""}>pluginCommand（第三方命令）</option>
              <option value="group" ${matchType === "group" ? "selected" : ""}>group（分组）</option>
            </select>
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 12px; opacity: 0.7;">匹配 - 按钮标题（包含）</span>
            <input class="b3-text-field" id="hookMatchTitle" value="${matchTitle.replace(/"/g, "&quot;")}" style="width: 100%;" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 12px; opacity: 0.7;">匹配 - 功能值</span>
            <select class="b3-select" id="hookMatchActionValue" style="width: 100%;">
              <option value="">（不限）</option>
              ${valueOptions}
            </select>
          </label>
        </div>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">优先级（数值越小越先执行）</span>
          <input class="b3-text-field" id="hookPriority" type="number" value="${priority}" style="width: 100%;" />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 12px; opacity: 0.7;">脚本（可用变量: plugin, siyuan, utils, kits, item, event, next, trigger）</span>
          <textarea class="b3-text-field" id="hookScript" rows="8" style="width: 100%; font-family: monospace; font-size: 11px;">${script.replace(/"/g, "&quot;")}</textarea>
          <span style="font-size: 11px; opacity: 0.5;">上限 10KB。after/before 可调 trigger("按钮ID") 链式触发其他按钮。</span>
        </label>
      </div>
      <div class="b3-dialog__action" style="padding: 16px 16px 0;">
        <button class="b3-button b3-button--cancel" id="hookCancelBtn">取消</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="hookSaveBtn">${isEdit ? "保存" : "创建"}</button>
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

    cancelBtn?.addEventListener("click", () => dialog.destroy());

    saveBtn?.addEventListener("click", async () => {
      const el = (id: string) => dialog.element.querySelector(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      const newName = (el("#hookName") as HTMLInputElement).value.trim();
      if (!newName) { showMessage("请输入名称"); return; }

      const newScript = (el("#hookScript") as HTMLTextAreaElement).value.trim();
      if (!newScript) { showMessage("请输入脚本"); return; }
      if (newScript.length > 10 * 1024) { showMessage("脚本超过 10KB 限制"); return; }

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
      showMessage(isEdit ? `钩子 "${newName}" 已更新` : `钩子 "${newName}" 已创建`);
      dialog.destroy();
    });
  }

  function matchSummary(hook: any): string {
    if (hook.matchAll) return "匹配所有按键";
    const parts: string[] = [];
    if (hook.match?.key) {
      const all = (settings.getBySpace("nav-helper", "menuItems") || []);
      const btn = all.find((i: any) => getActionKey(i) === hook.match.key);
      parts.push(`按钮: ${btn ? btn.title : "(已删除的按钮)"}`);
    }
    if (hook.match?.type) parts.push(`类型: ${hook.match.type}`);
    if (hook.match?.titleMatch) parts.push(`标题包含: ${hook.match.titleMatch}`);
    if (hook.match?.actionValue) parts.push(`功能值: ${hook.match.actionValue}`);
    return parts.length > 0 ? "条件全满足: " + parts.join("，") : "无匹配条件";
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
    <span class="setting-title">全局钩子（{hooks.length}）</span>
    <button class="b3-button b3-button--outline" on:click={() => openHookEditor()}>+ 新建钩子</button>
  </div>
  {#if hooks.length === 0}
    <div class="setting-row" style="flex-direction: column; align-items: center; gap: 8px; padding: 24px;">
      <span class="setting-desc" style="text-align: center;">
        点击上方「新建钩子」开始配置。<br>
        示例：创建一个 after 钩子，脚本写 <code>showMessage("✨")</code>，实现统一点击动效。
      </span>
    </div>
  {:else}
    {#each hooks as hook, i (hook.id)}
      <div class="setting-row hook-row" style="gap: 12px; align-items: flex-start; {hook.enabled === false ? 'opacity: 0.5;' : ''}">
        <div class="hook-main" style="flex: 1; min-width: 0;">
          <div class="hook-header">
            <span class="setting-title">{hook.name || "(未命名)"}</span>
            {#if hook.enabled === false}
              <span class="hook-badge disabled-label">已禁用</span>
            {/if}
            <span class="hook-badge mode-{hook.mode}">{hook.mode}</span>
            {#if hook.priority != null}
              <span class="hook-badge {priorityClass(hook.priority)}">优先级 {hook.priority}</span>
            {/if}
          </div>
          <div class="setting-desc hook-match">{matchSummary(hook)}</div>
          {#if hook.script}
            <div class="hook-script" style="margin-top: 6px;">
              {#if expandedScripts.has(hook.id)}
                <pre class="script-pre">{hook.script}</pre>
                <button class="script-toggle" on:click={() => toggleScriptExpand(hook.id)}>收起脚本</button>
              {:else}
                <code class="script-preview">{scriptPreview(hook.script)}</code>
                {#if hook.script.length > 100}
                  <button class="script-toggle" on:click={() => toggleScriptExpand(hook.id)}>展开脚本</button>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
        <div class="hook-controls" style="flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
          <label class="toggle-switch" title={hook.enabled === false ? "点击启用" : "点击禁用"}>
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
            on:click={() => openHookEditor(hook)}>编辑</button>
          <button
            class="b3-button b3-button--outline"
            style="padding: 2px 8px; font-size: 12px; color: var(--b3-theme-error);"
            on:click={() => deleteHook(hook.id, hook.name)}>删除</button>
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
