import { pandaUtils } from "./utils/panda-utils";
import { builtinMetas } from "./utils/builtin-metas";
import { scriptApiReference } from "./utils/script-api-reference";
import { bundledDts } from "./utils/bundled-dts";
import { normalizeMenuItems } from "./normalize";
import { STYLE_TOKENS } from "./style-tokens";

interface PluginConfig {
  menuItems?: any[];
  customPresets?: any[];
  enableBottomNav?: string;
  showButtonLabels?: string;
  noteBookID?: string;
  styleOverrides?: Record<string, string>;
  stylePresets?: { name: string; overrides: Record<string, string> }[];
  navPosition?: { x: number; y: number };
  globalClickHooks?: ClickHook[];
}

interface ClickHookMatch {
  key?: string;
  type?: string;
  titleMatch?: string;
}

interface ClickHook {
  id: string;
  name: string;
  enabled: boolean;
  matchAll: boolean;
  match?: ClickHookMatch;
  mode: "before" | "after" | "replace";
  priority: number;
  script: string;
}

class KernelPlugin {
  private mcp: any;
  private storage: any;
  private rpc: any;
  private logger: any;

  constructor() {
    const siyuan = globalThis.siyuan;
    if (!siyuan) {
      console.error("[panda-nav] siyuan global object unavailable");
      return;
    }
    siyuan.plugin.lifecycle.onload = this.onload.bind(this);
    siyuan.plugin.lifecycle.onrunning = this.onrunning.bind(this);
    siyuan.plugin.lifecycle.onunload = this.onunload.bind(this);
  }

  async onrunning() {
    // empty hook to satisfy Siyuan host
  }

  async onload() {
    const ctx = globalThis.siyuan;
    this.mcp = ctx.mcp;
    this.storage = ctx.storage;
    this.rpc = ctx.rpc;
    this.logger = ctx.logger;

    await this.logger.info("[panda-nav] kernel plugin loading...");

    await this.registerScriptContextTool();
    await this.registerSchemaTool();
    await this.registerListActionsTool();
    await this.registerGetFullConfigTool();
    await this.registerAddActionTool();
    await this.registerBatchAddActionsTool();
    await this.registerRemoveActionTool();
    await this.registerUpdateActionTool();
    await this.registerSavePresetTool();
    await this.registerListPresetsTool();
    await this.registerApplyPresetTool();
    await this.registerGetStyleSchemaTool();
    await this.registerSetStyleTool();
    await this.registerResetStyleTool();
    await this.registerSetClickHookTool();
    await this.registerRemoveClickHookTool();
    await this.registerListClickHooksTool();
    await this.registerHookRpcHandler();

    await this.logger.info("[panda-nav] MCP tools registered");
  }

  async onunload() {
    const names = [
      "panda-nav:get-capabilities",
      "panda-nav:get-action-schema",
      "panda-nav:list-actions",
      "panda-nav:get-full-config",
      "panda-nav:add-action",
      "panda-nav:batch-add-actions",
      "panda-nav:remove-action",
      "panda-nav:update-action",
      "panda-nav:save-preset",
      "panda-nav:list-presets",
      "panda-nav:apply-preset",
      "panda-nav:get-style-schema",
      "panda-nav:set-style",
      "panda-nav:reset-style",
      "panda-nav:set-click-hook",
      "panda-nav:remove-click-hook",
      "panda-nav:list-click-hooks",
    ];
    for (const name of names) {
      try {
        await this.mcp.unregisterTool(name);
      } catch {}
    }
    await this.logger.info("[panda-nav] kernel plugin unloaded");
  }

  private async registerScriptContextTool() {
    const allMetas: Record<string, any> = { ...builtinMetas };
    for (const [k, v] of Object.entries(pandaUtils)) {
      allMetas[k] = v.meta;
    }

    await this.mcp.registerTool(
      "panda-nav:get-script-context",
      {
        title: "Get TypeScript execution context for script writing",
        description:
          "Returns the global TypeScript environment, custom utils interface, or reads specific official Siyuan SDK .d.ts files. ALWAYS call this before writing a script to avoid hallucinations.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional. The path of the official .d.ts file to read (e.g. 'types/layout/Tab.d.ts'). If omitted, returns the global context and a list of available paths.",
            },
          },
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        if (input && input.path) {
          if (bundledDts[input.path]) {
            return { content: bundledDts[input.path] };
          } else {
            return { error: `File not found: ${input.path}` };
          }
        }

        const capabilities = Object.entries(allMetas).map(([name, meta]) => ({
          name,
          description: meta.description,
          parameters: meta.parameters.map((p: any) => `${p.name}: ${p.type}`),
          example: meta.example,
        }));

        return {
          utils: capabilities,
          scriptContext: scriptApiReference,
          availableTypes: Object.keys(bundledDts),
          hint: "Read the scriptContext carefully. If you need to know what 'Tab', 'App', or 'Plugin' is in detail, call this tool again with the specific 'path' from availableTypes.",
        };
      },
    );
  }

  private async registerSchemaTool() {
    await this.mcp.registerTool(
      "panda-nav:get-action-schema",
      {
        title: "Get action schema reference",
        description:
          "Returns valid values for all action fields. **CRITICAL PRIORITY**: When fulfilling a request, AI MUST determine the 'type' in this order: Priority 1: `builtin` (check builtinValues first) -> Priority 2: `command` (use SiYuan native command like dailyNote, search) -> Priority 3: `pluginCommand`.",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        const dynamicBuiltinValues = Object.values(builtinMetas).map((meta: any) => ({
          value: meta.name,
          description: meta.description,
        }));
        
        // script 被 gen-builtin-metas.js 在生成 utils 时去除了，所以这里需要手动补回
        dynamicBuiltinValues.push({
          value: "script",
          description: "Execute custom JavaScript (provide code in param field)",
        });
        
        // Fetch Siyuan native commands and plugin commands
        let commandValues: any[] = [];
        let pluginCommandValues: any[] = [];
        try {
          const siyuanObj = (globalThis as any).siyuan;
          if (siyuanObj?.config?.keymap?.general) {
            commandValues = Object.keys(siyuanObj.config.keymap.general).map(k => ({
              value: k,
              description: `System command: ${k}`
            }));
          }
          if (siyuanObj?.config?.keymap?.editor) {
            for (const category in siyuanObj.config.keymap.editor) {
              const catCommands = siyuanObj.config.keymap.editor[category];
              for (const key in catCommands) {
                commandValues.push({
                  value: `editor::${category}::${key}`,
                  description: `Editor command: ${category} - ${key}`
                });
              }
            }
          }
          if (siyuanObj?.config?.keymap?.plugin) {
            pluginCommandValues = Object.keys(siyuanObj.config.keymap.plugin).map(k => ({
              value: k,
              description: `Plugin command: ${k}`
            }));
          }
        } catch (e) {
          console.error("Failed to fetch commands:", e);
        }

        return {
          actionSchema: {
            types: {
              builtin: "Predefined action: use one of the builtinValues below (HIGHEST PRIORITY)",
              command:
                "A registered SiYuan system command (e.g. dailyNote) or editor command (e.g. editor::general::bold). See commandValues below. Use if no builtin matches.",
              pluginCommand: "A command registered by another plugin. See pluginCommandValues below. Use as last resort.",
              group: "Submenu container with children array and submenuLayout",
            },
            builtinValues: dynamicBuiltinValues,
            commandValues: commandValues,
            pluginCommandValues: pluginCommandValues,
            showOn: ["both", "mobile", "desktop"],
            positions: {
              mobilePosition: ["navbar", "submenu"],
              desktopPosition: ["navbar", "submenu"],
            },
            icons: {
              format: "#iconXxx (e.g. #iconStar)",
              common: [
                "#iconStar",
                "#iconHeart",
                "#iconLink",
                "#iconLeft",
                "#iconRight",
                "#iconUp",
                "#iconDown",
                "#iconMenu",
                "#iconCalendar",
                "#iconSearch",
                "#iconRefresh",
                "#iconInfo",
                "#iconSettings",
                "#iconWorkspace",
              ],
            },
            groupFields: {
              submenuLayout: ["list", "grid"],
              children: "Array of action items (same schema as parent)",
            },
            param:
              "Required for type=builtin with value=script/sql/url. For type=builtin value=script: JS code using plugin, siyuan, utils variables. Call get-script-context to read the TypeScript environment and verify available APIs.",
          },
        };
      });
  }

  private async registerGetFullConfigTool() {
    await this.mcp.registerTool(
      "panda-nav:get-full-config",
      {
        title: "Get full plugin configuration",
        description:
          "Returns the entire config.json including all settings (menuItems, enableBottomNav, showButtonLabels, etc.)",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        const config = await this.loadConfig();
        return { config };
      },
    );
  }

  private async registerBatchAddActionsTool() {
    await this.mcp.registerTool(
      "panda-nav:batch-add-actions",
      {
        title: "Batch add / replace navigation actions",
        description:
          "Add multiple actions at once or replace all existing actions. MUST respect the priority: 1) builtin 2) command 3) pluginCommand. Call get-action-schema to check valid builtins.",
        inputSchema: {
          type: "object",
          properties: {
            actions: {
              type: "array",
              description:
                "Array of action objects. Each object supports: title (string), type (string), value (string), icon (string), showOn (string), param (string). For type=group also: children (array), submenuLayout (string). See get-action-schema for valid values",
              items: { type: "object" },
            },
            mode: {
              type: "string",
              enum: ["append", "replace"],
              description:
                "append = add to existing list, replace = replace all existing actions",
            },
          },
          required: ["actions", "mode"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (input.mode === "replace") {
          config.menuItems = input.actions.map((a: any) => ({
            ...a,
            id: this.generateId(),
          }));
        } else {
          if (!config.menuItems) config.menuItems = [];
          for (const a of input.actions) {
            config.menuItems.push({ ...a, id: this.generateId() });
          }
        }
        await this.saveConfig(config);
        await this.notifyUI(config);
        return {
          success: true,
          total: config.menuItems.length,
          mode: input.mode,
        };
      },
    );
  }

  private async registerListActionsTool() {
    await this.mcp.registerTool(
      "panda-nav:list-actions",
      {
        title: "List all navigation actions",
        description: "Get all configured navigation action buttons",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        const config = await this.loadConfig();
        const items = config.menuItems || [];
        return { actions: items, total: items.length };
      },
    );
  }

  private async registerAddActionTool() {
    await this.mcp.registerTool(
      "panda-nav:add-action",
      {
        title: "Add a navigation action",
        description:
          "Add a button to the navigation bar. MUST respect the priority: 1) builtin 2) command 3) pluginCommand. Use get-script-context for scripts.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Button label" },
            type: {
              type: "string",
              enum: ["builtin", "command", "pluginCommand", "group"],
              description: "Action type",
            },
            value: {
              type: "string",
              description: "Action value: builtin id / command name / etc.",
            },
            icon: { type: "string", description: "Icon like #iconStar" },
            showOn: { type: "string", enum: ["both", "mobile", "desktop"] },
            param: {
              type: "string",
              description:
                "Parameter. For type=builtin value=script: JS code using plugin, siyuan, utils variables. Call get-script-context to discover the TypeScript environment and available SDK types.",
            },
          },
          required: ["title", "type"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (!config.menuItems) config.menuItems = [];
        const newItem: any = {
          id: this.generateId(),
          type: input.type,
          title: input.title,
          icon: input.icon || "#iconLink",
          value: input.value || "",
          showOn: input.showOn || "both",
        };
        if (input.param) newItem.param = input.param;
        config.menuItems.push(newItem);
        await this.saveConfig(config);
        await this.notifyUI(config);
        return {
          success: true,
          id: newItem.id,
          count: config.menuItems.length,
        };
      },
    );
  }

  private async registerRemoveActionTool() {
    await this.mcp.registerTool(
      "panda-nav:remove-action",
      {
        title: "Remove a navigation action",
        description:
          "Remove an action button by index. Call list-actions first to get indices",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "Index in the actions list (0-based)",
            },
          },
          required: ["index"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (
          !config.menuItems ||
          input.index < 0 ||
          input.index >= config.menuItems.length
        ) {
          return { success: false, error: "Index out of bounds or empty list" };
        }
        const removed = config.menuItems.splice(input.index, 1);
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true, removed: removed[0]?.title };
      },
    );
  }

  private async registerUpdateActionTool() {
    await this.mcp.registerTool(
      "panda-nav:update-action",
      {
        title: "Update a navigation action",
        description:
          "Update an existing action button by index. MUST respect the priority: 1) builtin 2) command 3) pluginCommand. Call list-actions to get the current list.",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "Index of the action to update (0-based)",
            },
            title: { type: "string", description: "New button label" },
            type: {
              type: "string",
              enum: ["builtin", "command", "pluginCommand", "group"],
            },
            value: { type: "string", description: "New action value" },
            icon: { type: "string", description: "New icon" },
            showOn: { type: "string", enum: ["both", "mobile", "desktop"] },
            param: { type: "string", description: "New parameter content" },
          },
          required: ["index"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (
          !config.menuItems ||
          input.index < 0 ||
          input.index >= config.menuItems.length
        ) {
          return { success: false, error: "Index out of bounds or empty list" };
        }
        const item = config.menuItems[input.index];
        if (input.title !== undefined) item.title = input.title;
        if (input.type !== undefined) item.type = input.type;
        if (input.value !== undefined) item.value = input.value;
        if (input.icon !== undefined) item.icon = input.icon;
        if (input.showOn !== undefined) item.showOn = input.showOn;
        if (input.param !== undefined) item.param = input.param;
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true };
      },
    );
  }

  private async registerSavePresetTool() {
    await this.mcp.registerTool(
      "panda-nav:save-preset",
      {
        title: "Save current navigation layout as a preset",
        description: "Save the current menuItems layout as a custom preset",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the preset" },
          },
          required: ["name"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (!config.customPresets) config.customPresets = [];
        const newPreset = {
          id: "preset-custom-" + Date.now(),
          name: input.name,
          menuItems: JSON.parse(JSON.stringify(config.menuItems || [])),
          styleOverrides: JSON.parse(JSON.stringify(config.styleOverrides || {})),
        };
        config.customPresets.push(newPreset);
        await this.saveConfig(config);
        return { success: true, id: newPreset.id };
      },
    );
  }

  private async registerListPresetsTool() {
    await this.mcp.registerTool(
      "panda-nav:list-presets",
      {
        title: "List all custom presets",
        description: "List all saved custom layout presets",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        const config = await this.loadConfig();
        const presets = config.customPresets || [];
        return { presets, total: presets.length };
      },
    );
  }

  private async registerApplyPresetTool() {
    await this.mcp.registerTool(
      "panda-nav:apply-preset",
      {
        title: "Apply a custom preset",
        description: "Apply a saved custom preset to the navigation bar",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the preset to apply",
            },
            mode: {
              type: "string",
              enum: ["append", "replace"],
              description:
                "Whether to append to existing items or replace all items",
            },
          },
          required: ["name", "mode"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        const presets = config.customPresets || [];
        const preset = presets.find((p: any) => p.name === input.name);
        if (!preset)
          return { success: false, error: `Preset "${input.name}" not found` };

        if (input.mode === "replace") {
          config.menuItems = JSON.parse(JSON.stringify(preset.menuItems));
          if (preset.styleOverrides) {
            config.styleOverrides = JSON.parse(JSON.stringify(preset.styleOverrides));
          }
        } else {
          config.menuItems = [
            ...(config.menuItems || []),
            ...JSON.parse(JSON.stringify(preset.menuItems)),
          ];
        }
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true, total: config.menuItems.length };
      },
    );
  }

  private async registerGetStyleSchemaTool() {
    await this.mcp.registerTool(
      "panda-nav:get-style-schema",
      {
        title: "Get style token schema",
        description: "Returns all available CSS custom properties for styling the navigation bar, with type, default value, and constraints.",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        return {
          tokens: STYLE_TOKENS.map(t => ({
            variable: t.variable,
            label: t.label,
            description: t.description,
            type: t.type,
            defaultValue: t.defaultValue,
            category: t.category,
            min: t.min,
            max: t.max,
            step: t.step,
          })),
          hint: "Use panda-nav:set-style to change individual tokens. Use panda-nav:reset-style to revert to defaults.",
        };
      },
    );
  }

  private async registerSetStyleTool() {
    await this.mcp.registerTool(
      "panda-nav:set-style",
      {
        title: "Set a navigation bar style",
        description: "Set a single CSS custom property value for the navigation bar. Call get-style-schema first to see available variables and their constraints.",
        inputSchema: {
          type: "object",
          properties: {
            variable: {
              type: "string",
              description: "The CSS variable name (e.g. --nav-bg, --nav-height). Call get-style-schema for the full list.",
            },
            value: {
              type: "string",
              description: "The CSS value (e.g. '#ff0000', '40px', '0.8').",
            },
          },
          required: ["variable", "value"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (!config.styleOverrides) config.styleOverrides = {};

        const token = STYLE_TOKENS.find(t => t.variable === input.variable);
        if (!token) {
          return { success: false, error: `Unknown variable: ${input.variable}. Call get-style-schema for valid options.` };
        }

        const value = String(input.value).trim();
        if (!value) {
          return { success: false, error: "Style value cannot be empty." };
        }
        const safe = /^[a-zA-Z0-9#%.,()\s\-\_]+$/;
        if (!safe.test(value)) {
          return { success: false, error: "Style value contains disallowed characters. Only alphanumeric, # % . , ( ) - _ and whitespace are allowed." };
        }

        config.styleOverrides[input.variable] = value;
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true, variable: input.variable, value };
      },
    );
  }

  private async registerResetStyleTool() {
    await this.mcp.registerTool(
      "panda-nav:reset-style",
      {
        title: "Reset navigation bar styles",
        description: "Reset one or all style tokens to their defaults. If variable is omitted, all styles are reset.",
        inputSchema: {
          type: "object",
          properties: {
            variable: {
              type: "string",
              description: "Optional. The CSS variable name to reset (e.g. --nav-bg). If omitted, all style overrides are cleared.",
            },
          },
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (!config.styleOverrides) config.styleOverrides = {};

        if (input.variable) {
          const token = STYLE_TOKENS.find(t => t.variable === input.variable);
          if (!token) {
            return { success: false, error: `Unknown variable: ${input.variable}. Call get-style-schema for valid options.` };
          }
          delete config.styleOverrides[input.variable];
        } else {
          config.styleOverrides = {};
        }

        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true, variable: input.variable || "all", reset: true };
      },
    );
  }

  private async registerSetClickHookTool() {
    await this.mcp.registerTool(
      "panda-nav:set-click-hook",
      {
        title: "Create or update a click hook",
        description: "Create a new global click hook or update an existing one by ID. Hooks intercept nav button clicks to run custom JS before, after, or instead of the original action.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Omit to create new, or provide existing ID to update." },
            name: { type: "string", description: "Human-readable name for the hook." },
            mode: { type: "string", enum: ["before", "after", "replace"], description: "before: run before original action. after: run after original action. replace: run instead of original (call next() to invoke original)." },
            script: { type: "string", description: "JavaScript code. Available variables: plugin, siyuan, utils, kits, item, event. In replace mode, call next() to execute original action. Max 10KB." },
            matchAll: { type: "boolean", description: "Set to true to match every button click. Default false." },
            match: { type: "object", properties: {
              key: { type: "string", description: "Button ID to match exactly." },
              type: { type: "string", description: "Button type: builtin, command, pluginCommand, group." },
              titleMatch: { type: "string", description: "Substring to match against button title." },
            }, description: "Filter when matchAll is false. Empty object matches nothing." },
            priority: { type: "number", description: "Lower runs first. Default 0." },
            enabled: { type: "boolean", description: "Default true. Set false to disable without deleting." },
          },
          required: ["name", "script", "mode"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        try {
          if (!input.name || !input.script || !input.mode) {
            return { success: false, error: "name, script, and mode are required." };
          }
          if (!["before", "after", "replace"].includes(input.mode)) {
            return { success: false, error: "mode must be 'before', 'after', or 'replace'." };
          }
          const script = String(input.script).trim();
          if (!script) return { success: false, error: "Script cannot be empty." };
          const MAX_SCRIPT_LEN = 10 * 1024;
          if (script.length > MAX_SCRIPT_LEN) {
            return { success: false, error: `Script exceeds 10KB limit.` };
          }
          const config = await this.loadConfig();
          if (!config.globalClickHooks) config.globalClickHooks = [];
          if (input.id) {
            const idx = config.globalClickHooks.findIndex(h => h.id === input.id);
            if (idx === -1) return { success: false, error: `Hook with id '${input.id}' not found.` };
            config.globalClickHooks[idx] = {
              ...config.globalClickHooks[idx],
              name: input.name,
              mode: input.mode,
              script,
              matchAll: input.matchAll === true,
              match: input.match || undefined,
              priority: input.priority != null ? input.priority : 0,
              enabled: input.enabled !== false,
            };
          } else {
            const hook: ClickHook = {
              id: this.generateId(),
              name: input.name,
              mode: input.mode,
              script,
              matchAll: input.matchAll === true,
              match: input.match || undefined,
              priority: input.priority != null ? input.priority : 0,
              enabled: input.enabled !== false,
            };
            config.globalClickHooks.push(hook);
          }
          await this.saveConfig(config);
          await this.notifyUI(config);
          return { success: true, id: input.id || config.globalClickHooks[config.globalClickHooks.length - 1].id };
        } catch (err: any) {
          return { success: false, error: `Internal error: ${err?.message || err}` };
        }
      },
    );
  }

  private async registerRemoveClickHookTool() {
    await this.mcp.registerTool(
      "panda-nav:remove-click-hook",
      {
        title: "Remove a click hook",
        description: "Delete a global click hook by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The hook ID to remove." },
          },
          required: ["id"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        if (!input.id) return { success: false, error: "id is required." };
        const config = await this.loadConfig();
        if (!config.globalClickHooks) config.globalClickHooks = [];
        const before = config.globalClickHooks.length;
        config.globalClickHooks = config.globalClickHooks.filter(h => h.id !== input.id);
        if (config.globalClickHooks.length === before) {
          return { success: false, error: `Hook with id '${input.id}' not found.` };
        }
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true };
      },
    );
  }

  private async registerListClickHooksTool() {
    await this.mcp.registerTool(
      "panda-nav:list-click-hooks",
      {
        title: "List all click hooks",
        description: "Returns all registered global click hooks with their configuration.",
        inputSchema: { type: "object", properties: {} },
        outputSchema: { type: "object" },
      },
      async () => {
        const config = await this.loadConfig();
        return { hooks: config.globalClickHooks || [] };
      },
    );
  }

  private async registerHookRpcHandler() {
    try {
      this.rpc.bind("panda-nav:update-hooks", async (params: { hooks: any[] }) => {
        if (!params || !Array.isArray(params.hooks)) {
          return { success: false, error: "Invalid hooks payload." };
        }
        const config = await this.loadConfig();
        config.globalClickHooks = params.hooks;
        await this.saveConfig(config);
        await this.notifyUI(config);
        return { success: true };
      });
    } catch (e) {
      await this.logger.warn("[panda-nav] 注册钩子 RPC 处理器失败:", e);
    }
  }

  private async loadConfig(): Promise<PluginConfig> {
    try {
      const obj = await this.storage.get("config.json");
      const text = await obj.text();
      const config = JSON.parse(text) || {};
      if (config.menuItems) {
        config.menuItems = normalizeMenuItems(config.menuItems);
      }
      if (config.customPresets) {
        config.customPresets = config.customPresets.map((preset: any) => {
          if (preset && preset.menuItems) {
            preset.menuItems = normalizeMenuItems(preset.menuItems);
          }
          return preset;
        });
      }
      return config;
    } catch {
      return {};
    }
  }

  private async saveConfig(config: PluginConfig) {
    await this.storage.put("config.json", JSON.stringify(config, null, 2));
  }

  private async notifyUI(config: PluginConfig) {
    try {
      await this.rpc.broadcast("panda-nav:config-changed", {
        action: "mcp-update",
        menuItems: config.menuItems || [],
        styleOverrides: config.styleOverrides || {},
        globalClickHooks: config.globalClickHooks || [],
      });
    } catch {}
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
    );
  }
}

new KernelPlugin();
