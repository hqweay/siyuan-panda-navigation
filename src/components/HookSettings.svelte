<script lang="ts">
  import { showMessage, Dialog } from "siyuan";
  import { settings } from "../settings";
  import { plugin } from "../utils";

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

  function matchSummary(hook: any): string {
    const parts: string[] = [];
    if (hook.matchAll) return "匹配所有按键";
    if (hook.match?.key) parts.push(`按键ID: ${hook.match.key}`);
    if (hook.match?.type) parts.push(`类型: ${hook.match.type}`);
    if (hook.match?.titleMatch) parts.push(`标题: ${hook.match.titleMatch}`);
    return parts.join(" | ") || "无匹配条件";
  }

  function priorityClass(p: number): string {
    if (p == null) return "";
    if (p > 0) return "priority-high";
    if (p < 0) return "priority-low";
    return "priority-zero";
  }
</script>

<div class="tab-pane">
  {#if hooks.length === 0}
    <div class="setting-row" style="flex-direction: column; align-items: center; gap: 8px; padding: 24px;">
      <span class="setting-title" style="opacity: 0.6;">暂无全局钩子</span>
      <span class="setting-desc" style="text-align: center;">
        通过 MCP 工具 <code>set-click-hook</code> 创建钩子后，可在此管理。<br>
        示例：<code>panda-nav:set-click-hook</code> 创建烟花、确认对话框等行为。
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
