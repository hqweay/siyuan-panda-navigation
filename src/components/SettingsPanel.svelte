<script lang="ts">
  import { settings } from "../settings";
  import { plugin, generateId } from "../utils";
  import { showMessage } from "siyuan";
  import { onMount } from "svelte";
  import { lsNotebooks, request } from "../api";
  import { builtinCommands, builtinCommandList } from "../builtins";
  import IconPicker from "./IconPicker.svelte";
  import { PRESET_GROUPS } from "../config/presets";

  export let closeDialog: () => void;

  let avDatabases: { id: string; name: string }[] = [];

  // 图标选择弹窗相关的状态
  let allSiyuanIcons: string[] = [];

  let sysCommands: { value: string; label: string }[] = [];
  let pluginCommandsGroups: { pluginName: string; commands: { value: string; label: string }[] }[] = [];

  onMount(async () => {
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

    try {
      const res = await request("/api/av/searchAttributeView", { keyword: "", excludes: [] });
      const results = res?.results || [];
      avDatabases = results.map((b: any) => ({
        id: b.blockID,
        name: b.avName || "未命名数据库",
      }));
    } catch (e) {
      console.error("加载数据库列表失败", e);
    }

    try {
      if ((window as any).siyuan?.config?.keymap?.general) {
        const general = (window as any).siyuan.config.keymap.general;
        const langs = (window as any).siyuan.languages || {};
        const COMMAND_BLACKLIST = ["goBack", "goForward"];
        for (const key in general) {
          if (COMMAND_BLACKLIST.includes(key)) continue;
          sysCommands.push({
            value: key,
            label: langs[key] || key
          });
        }
      } else {
        sysCommands = [
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
      }
      sysCommands = sysCommands;

      if (plugin?.app?.plugins) {
        plugin.app.plugins.forEach(p => {
          if (p.commands && p.commands.length > 0) {
            const cmds = p.commands.map(c => {
              const label = c.langText || (p.i18n && p.i18n[c.langKey]) || c.langKey;
              return {
                value: `plugin::${p.name}::${c.customHotkey || c.langKey}`,
                label: label
              };
            });
            pluginCommandsGroups.push({
              pluginName: p.displayName || p.name,
              commands: cmds
            });
          }
        });
        pluginCommandsGroups = pluginCommandsGroups;
      }
    } catch (e) {
      console.error("加载命令列表失败", e);
    }
  });






  let showIconPicker = false;
  let onIconSelect: (icon: string) => void = () => {};

  
  function handleTypeChange(item: any) {
    if (item.type === "builtin") {
        if (!builtinCommands[item.value]) {
            item.value = "goBack";
        }
    } else if (item.type === "command") {
        if (sysCommands.length > 0) item.value = sysCommands[0].value;
    } else if (item.type === "pluginCommand") {
        if (pluginCommandsGroups.length > 0 && pluginCommandsGroups[0].commands.length > 0) {
            item.value = pluginCommandsGroups[0].commands[0].value;
        }
    }
    menuItems = [...menuItems];
  }

  function openIconPicker(callback: (icon: string) => void) {
    onIconSelect = callback;
    showIconPicker = true;
  }

  function handleSelectIcon(icon: string) {
    onIconSelect(icon);
    showIconPicker = false;
    menuItems = [...menuItems]; // trigger reactivity
  }

  let activeTab: "general" | "buttons" | "links" = "general";

  // General Settings
  let enableBottomNav =
    settings.getBySpace("nav-helper", "enableBottomNav") ?? "both";
  let showButtonLabels = settings.getBySpace("nav-helper", "showButtonLabels") ?? "both";

  // Menu Builder Variables
  let menuItems: any[] = settings.getBySpace("nav-helper", "menuItems") || [];
  let expandedIndex: string | null = null;

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


  function addMenuItem(parentGroup?: any) {
    const newItem = {
      id: generateId(),
      type: "url",
      title: "新动作",
      value: "",
      icon: "#iconLink",
      showOn: "both"
    };
    if (parentGroup) {
      if (!parentGroup.children) parentGroup.children = [];
      parentGroup.children = [...parentGroup.children, newItem];
      menuItems = [...menuItems]; // Trigger reactivity
    } else {
      menuItems = [...menuItems, newItem];
    }
  }

  function addGroup() {
    const newGroup = {
      id: generateId(),
      type: "group",
      title: "新分组",
      value: "",
      icon: "#iconMenu",
      showOn: "both",
      submenuLayout: "list",
      children: []
    };
    menuItems = [...menuItems, newGroup];
  }

  function removeMenuItem(id: string, parentGroup?: any) {
    if (parentGroup) {
      parentGroup.children = parentGroup.children.filter((item: any) => item.id !== id);
    } else {
      menuItems = menuItems.filter((item: any) => item.id !== id);
    }
    menuItems = [...menuItems];
  }

  function toggleExpand(id: string) {
    expandedIndex = expandedIndex === id ? null : id;
  }

  function moveMenuItemUp(index: number, arr: any[]) {
    if (index === 0) return;
    const temp = arr[index];
    arr[index] = arr[index - 1];
    arr[index - 1] = temp;
    menuItems = [...menuItems];
  }

  function moveMenuItemDown(index: number, arr: any[]) {
    if (index === arr.length - 1) return;
    const temp = arr[index];
    arr[index] = arr[index + 1];
    arr[index + 1] = temp;
    menuItems = [...menuItems];
  }

  function duplicateMenuItem(item: any, parentGroup?: any) {
    const duplicated = JSON.parse(JSON.stringify(item));
    duplicated.id = generateId();
    if (duplicated.children) {
      duplicated.children.forEach((c: any) => c.id = generateId());
    }
    
    if (parentGroup) {
      const idx = parentGroup.children.findIndex((c: any) => c.id === item.id);
      parentGroup.children.splice(idx + 1, 0, duplicated);
    } else {
      const idx = menuItems.findIndex((c: any) => c.id === item.id);
      menuItems.splice(idx + 1, 0, duplicated);
    }
    menuItems = [...menuItems];
  }

  function getPlaceholder(type: string) {
    if (type === "url") return "输入 https:// 、 siyuan:// 链接或文档 ID";
    if (type === "sql")
      return "输入 SQL 查询语句，例如 SELECT id FROM blocks WHERE type = 'd'";
    if (type === "av-add") return "选择或输入数据库块 ID";
    if (type === "open-setting") return "";
    return "";
  }

  async function handleSave() {
    settings.setBySpace("nav-helper", "enableBottomNav", enableBottomNav);
    settings.setBySpace("nav-helper", "menuItems", menuItems);
    settings.setBySpace("nav-helper", "showButtonLabels", showButtonLabels);

    await settings.save();
    showMessage("熊猫导航配置已保存");
    closeDialog();

    // 触发插件实例更新
    if (plugin && (plugin as any).handleSettingsChange) {
      (plugin as any).handleSettingsChange();
    }
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
      菜单构建
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
      <div class="tab-pane align-stretch">
        <div class="fn__flex align-center justify-between" style="margin-bottom: 12px;">
          <span class="setting-desc" style="margin: 0;">配置您的导航菜单。支持动作和分组（最多2层）。</span>
          <div class="fn__flex" style="gap: 8px;">
            <select 
              class="b3-select b3-button--outline" 
              style="padding-right: 28px; background-color: var(--b3-theme-surface); cursor: pointer;"
              on:change={(e) => {
                const presetId = e.currentTarget.value;
                if (!presetId) return;
                const preset = PRESET_GROUPS.find(p => p.id === presetId);
                if (preset) {
                  const newItem = preset.generate();
                  menuItems = [...menuItems, newItem];
                  expandedIndex = newItem.id;
                }
                e.currentTarget.value = ""; // Reset
              }}
            >
              <option value="">导入预设...</option>
              {#each PRESET_GROUPS as preset}
                <option value={preset.id}>{preset.name}</option>
              {/each}
            </select>
            <button class="b3-button b3-button--outline" on:click={() => addGroup()}>添加分组</button>
            <button class="b3-button b3-button--outline" on:click={() => addMenuItem()}>添加动作</button>
          </div>
        </div>

        <div class="setting-row button-setting-row" style="margin-bottom: 16px;">
          <div class="button-info">
            <span class="setting-title">按钮标签文字</span>
            <span class="setting-desc" style="margin: 0;">控制按钮下方文字标签的显示</span>
          </div>
          <div class="button-controls">
            <select class="b3-select" bind:value={showButtonLabels}>
              <option value="both">移动端与 PC 端</option>
              <option value="mobile">仅移动端</option>
              <option value="pc">仅 PC 端</option>
              <option value="none">禁用</option>
            </select>
          </div>
        </div>

        <div class="actions-list">
          {#each menuItems as item, i (item.id)}
            <div class="action-card" class:expanded={expandedIndex === item.id} class:disabled={item.showOn === 'none'} style={item.type === 'group' ? 'border-left: 3px solid var(--b3-theme-primary);' : ''}>
              <!-- Header -->
              <div class="action-card-header" on:click={() => toggleExpand(item.id)}>
                <div class="header-left fn__flex align-center">
                  <span class="arrow-indicator">{expandedIndex === item.id ? "▼" : "▶"}</span>
                  <div class="action-icon-preview">
                    {#if item.icon && item.icon.startsWith("#icon")}
                      <svg class="preview-svg"><use xlink:href={item.icon}></use></svg>
                    {:else}
                      <span class="preview-emoji">{item.icon || "🔗"}</span>
                    {/if}
                  </div>
                  <span class="action-title-text">{item.title || "未命名"}</span>
                </div>

                <div class="header-right fn__flex align-center" on:click|stopPropagation>
                  <span class="badge badge-type">
                    {item.type === "group" ? "分组" : item.type === "internal" ? "内置" : "动作"}
                  </span>

                  <div class="action-arrows fn__flex">
                    <button class="arrow-btn" disabled={i === 0} on:click={() => moveMenuItemUp(i, menuItems)}>▲</button>
                    <button class="arrow-btn" disabled={i === menuItems.length - 1} on:click={() => moveMenuItemDown(i, menuItems)}>▼</button>
                  </div>
                  
                  <button class="remove-btn b3-tooltips b3-tooltips__w" style="padding: 4px; opacity: 0.7; font-size: 14px;" aria-label="删除" on:click={() => removeMenuItem(item.id)}>
                    <svg><use xlink:href="#iconTrashcan"></use></svg>
                  </button>
                </div>
              </div>

              <!-- Body -->
              {#if expandedIndex === item.id}
                <div class="action-card-body" role="none" on:click|stopPropagation on:keydown={null}>
                  <div class="form-row fn__flex" style="gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div class="form-item fn__flex-1" style="min-width: 180px;">
                      <span class="form-label">标题</span>
                      <input class="b3-text-field" type="text" bind:value={item.title} />
                    </div>
                    <div class="form-item fn__flex-1" style="min-width: 180px;">
                      <span class="form-label">图标 (Emoji或图标ID)</span>
                      <div class="fn__flex" style="gap: 8px;">
                        <input class="b3-text-field fn__flex-1" type="text" bind:value={item.icon} />
                        <button class="b3-button b3-button--outline" style="padding: 0 8px;" on:click={() => openIconPicker(icon => { item.icon = icon; menuItems = [...menuItems]; })}>🎨 选择图标</button>
                      </div>
                    </div>
                  </div>

                  <div class="form-row fn__flex" style="gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div class="form-item fn__flex-1" style="min-width: 180px;">
                      <span class="form-label">显示位置 (设备)</span>
                      <select class="b3-select" bind:value={item.showOn}>
                        <option value="both">全部设备</option>
                        <option value="desktop">仅桌面端</option>
                        <option value="mobile">仅移动端</option>
                        <option value="none">隐藏 (禁用)</option>
                      </select>
                    </div>

                    {#if item.type !== "group"}
                      <div class="form-item fn__flex-1" style="min-width: 180px;">
                        <span class="form-label">动作类型</span>
                        <select class="b3-select" bind:value={item.type} on:change={() => handleTypeChange(item)}>
                          <option value="builtin">内置功能</option>
                          <option value="command">思源系统命令</option>
                          <option value="pluginCommand">第三方插件命令</option>
                        </select>
                      </div>
                    {/if}
                  </div>
                  {#if item.type !== "group"}
                    <div class="form-item">
                      <span class="form-label">执行内容</span>
                      <div class="fn__flex" style="gap: 8px;">
                        {#if item.type === "builtin"}
                          <select class="b3-select" bind:value={item.value} style="width: 200px;" on:change={() => { item.param = ""; handleTypeChange(item); }}>
                            {#each builtinCommandList as cmd}
                               <option value={cmd.id}>{cmd.title}</option>
                            {/each}
                          </select>
                           {#if builtinCommands[item.value]?.requiresParam}
                             {#if item.value === "av-add"}
                               <select class="b3-select fn__flex-1" bind:value={item.param}>
                                 <option value="">请选择数据库</option>
                                 {#each avDatabases as db}
                                   <option value={db.id}>{db.name}</option>
                                 {/each}
                               </select>
                             {:else if item.value === "sql"}
                               <textarea class="b3-text-field fn__flex-1" bind:value={item.param} placeholder={builtinCommands[item.value]?.paramPlaceholder || ""} style="height: 60px; resize: vertical; font-family: monospace;"></textarea>
                             {:else}
                               <input class="b3-text-field fn__flex-1" type="text" bind:value={item.param} placeholder={builtinCommands[item.value]?.paramPlaceholder || ""} />
                             {/if}
                          {/if}
                        {:else if item.type === "command"}
                          <select class="b3-select fn__flex-1" bind:value={item.value}>
                            {#each sysCommands as cmd}
                              <option value={cmd.value}>{cmd.label}</option>
                            {/each}
                          </select>
                        {:else if item.type === "pluginCommand"}
                          <select class="b3-select fn__flex-1" bind:value={item.value}>
                            {#each pluginCommandsGroups as group}
                              <optgroup label={group.pluginName}>
                                {#each group.commands as cmd}
                                  <option value={cmd.value}>{cmd.label}</option>
                                {/each}
                              </optgroup>
                            {/each}
                          </select>
                        {/if}
                      </div>
                    </div>
                  {/if}
                  {#if item.type === "group"}
                    <div class="form-row fn__flex" style="gap: 12px; margin-bottom: 12px; padding: 12px; background-color: var(--b3-theme-background-light); border-radius: 4px;">
                      <div class="form-item fn__flex-1">
                        <span class="form-label">二级菜单布局</span>
                        <select class="b3-select" bind:value={item.submenuLayout}>
                          <option value="list">纵向列表 (显示文字)</option>
                          <option value="grid">图标网格 (隐藏文字)</option>
                        </select>
                      </div>
                    </div>

                    <div class="group-children-container" style="padding: 12px; background-color: var(--b3-theme-background-light); border-radius: 4px;">
                       <div class="fn__flex align-center justify-between" style="margin-bottom: 8px;">
                          <strong>组内动作</strong>
                          <button class="b3-button b3-button--small b3-button--outline" on:click={() => addMenuItem(item)}>添加子动作</button>
                       </div>
                       
                       {#if !item.children || item.children.length === 0}
                         <div style="color: var(--b3-theme-on-surface-light); font-size: 12px; padding: 8px 0;">该分组暂无动作</div>
                       {:else}
                         {#each item.children as child, j (child.id)}
                            <div class="action-card" style="margin-bottom: 8px; border: 1px solid var(--b3-border-color);" class:disabled={child.showOn === 'none'}>
                               <div class="action-card-header" style="background: transparent;">
                                  <div class="header-left fn__flex align-center">
                                     <div class="action-icon-preview" style="transform: scale(0.8);">
                                       {#if child.icon && child.icon.startsWith("#icon")}
                                         <svg class="preview-svg"><use xlink:href={child.icon}></use></svg>
                                       {:else}
                                         <span class="preview-emoji">{child.icon || "🔗"}</span>
                                       {/if}
                                     </div>
                                     <span class="action-title-text" style="font-size: 13px;">{child.title || "未命名"}</span>
                                  </div>
                                  <div class="header-right fn__flex align-center">
                                      <select class="b3-select" bind:value={child.showOn} style="width: 80px; margin-right: 8px;">
                                        <option value="both">全部</option>
                                        <option value="desktop">桌面</option>
                                        <option value="mobile">移动</option>
                                        <option value="none">隐藏</option>
                                      </select>
                                      <div class="action-arrows fn__flex">
                                        <button class="arrow-btn" disabled={j === 0} on:click={() => moveMenuItemUp(j, item.children)}>▲</button>
                                        <button class="arrow-btn" disabled={j === item.children.length - 1} on:click={() => moveMenuItemDown(j, item.children)}>▼</button>
                                      </div>
                                      <button class="remove-btn" style="padding: 4px;" aria-label="删除" on:click={() => removeMenuItem(child.id, item)}>
                                        <svg><use xlink:href="#iconTrashcan"></use></svg>
                                      </button>
                                  </div>
                               </div>
                               <!-- child body edit -->
                                                                <div style="padding: 0 12px 12px 12px;">
                                     
                                     <div class="fn__flex" style="gap: 8px; margin-bottom: 8px; width: 100%; flex-wrap: wrap;">
                                       <input class="b3-text-field fn__flex-1" style="min-width: 120px;" type="text" bind:value={child.title} placeholder="标题" />
                                       <div class="fn__flex fn__flex-1" style="gap: 4px; min-width: 140px;">
                                         <input class="b3-text-field fn__flex-1" type="text" bind:value={child.icon} placeholder="图标/Emoji" />
                                         <button class="b3-button b3-button--outline" style="padding: 0 4px;" on:click={() => openIconPicker(icon => { child.icon = icon; menuItems = [...menuItems]; })}>🎨</button>
                                       </div>
                                       <select class="b3-select fn__flex-1" style="min-width: 100px; max-width: 140px;" bind:value={child.type} on:change={() => handleTypeChange(child)}>
                                          <option value="builtin">内置功能</option>
                                          <option value="command">系统命令</option>
                                          <option value="pluginCommand">第三方命令</option>
                                       </select>
                                     </div>
                                     
                                     <div class="fn__flex" style="gap: 8px; width: 100%; flex-wrap: wrap;">
                                        {#if child.type === "builtin"}
                                          <select class="b3-select" bind:value={child.value} style="width: 160px;" on:change={() => { child.param = ""; handleTypeChange(child); }}>
                                            {#each builtinCommandList as cmd}
                                               <option value={cmd.id}>{cmd.title}</option>
                                            {/each}
                                          </select>
                                          {#if builtinCommands[child.value]?.requiresParam}
                                            {#if child.value === "av-add"}
                                              <select class="b3-select fn__flex-1" bind:value={child.param}>
                                                <option value="">请选择数据库</option>
                                                {#each avDatabases as db}
                                                  <option value={db.id}>{db.name}</option>
                                                {/each}
                                              </select>
                                            {:else if child.value === "sql"}
                                              <textarea class="b3-text-field fn__flex-1" bind:value={child.param} placeholder={builtinCommands[child.value]?.paramPlaceholder || ""} style="height: 60px; resize: vertical; font-family: monospace;"></textarea>
                                            {:else}
                                              <input class="b3-text-field fn__flex-1" type="text" bind:value={child.param} placeholder={builtinCommands[child.value]?.paramPlaceholder || ""} />
                                            {/if}
                                          {/if}
                                        {:else if child.type === "command"}
                                          <select class="b3-select fn__flex-1" bind:value={child.value}>
                                            {#each sysCommands as cmd}
                                              <option value={cmd.value}>{cmd.label}</option>
                                            {/each}
                                          </select>
                                        {:else if child.type === "pluginCommand"}
                                          <select class="b3-select fn__flex-1" bind:value={child.value}>
                                            {#each pluginCommandsGroups as group}
                                              <optgroup label={group.pluginName}>
                                                {#each group.commands as cmd}
                                                  <option value={cmd.value}>{cmd.label}</option>
                                                {/each}
                                              </optgroup>
                                            {/each}
                                          </select>
                                        {/if}
                                     </div>
                                 </div>
                            </div>
                         {/each}
                       {/if}
                    </div>
                  {/if}

                </div>
              {/if}
            </div>
          {/each}
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

  <IconPicker
    active={showIconPicker}
    currentIcon=""
    allIcons={allSiyuanIcons}
    onSelect={handleSelectIcon}
    onClose={() => showIconPicker = false}
  />
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

  .button-setting-row {
    gap: 12px;
  }

  .button-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex-shrink: 1;
  }

  .button-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .button-controls .b3-select {
    width: 130px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
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

  .action-card.disabled {
    opacity: 0.5;
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
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background-color: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    flex-shrink: 0;
  }

  .preview-svg {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface);
    display: block;
  }

  .preview-emoji {
    font-size: 16px;
    line-height: 1;
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




  .action-card-body {
    padding: 14px;
    background-color: var(--b3-theme-background-light);
    border-top: 1px solid var(--b3-border-color);
  }


  .form-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }


  .form-label {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.7;
  }





  .settings-footer {
    border-top: 1px solid var(--b3-border-color);
    padding-top: 16px;
    margin-top: 16px;
  }



  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background-color: rgba(244, 63, 94, 0.1);
    color: #f43f5e;
    opacity: 1;
  }

  .remove-btn svg {
    width: 12px;
    height: 12px;
  }
</style>
