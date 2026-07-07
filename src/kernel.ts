import { pandaUtils } from "./utils/panda-utils";
import { builtinMetas } from "./utils/builtin-metas";

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
    siyuan.plugin.lifecycle.onunload = this.onunload.bind(this);
  }

  async onload() {
    const ctx = globalThis.siyuan;
    this.mcp = ctx.mcp;
    this.storage = ctx.storage;
    this.rpc = ctx.rpc;
    this.logger = ctx.logger;

    await this.logger.info("[panda-nav] kernel plugin loading...");

    await this.registerCapabilitiesTool();
    await this.registerSchemaTool();
    await this.registerListActionsTool();
    await this.registerGetFullConfigTool();
    await this.registerAddActionTool();
    await this.registerBatchAddActionsTool();
    await this.registerRemoveActionTool();
    await this.registerUpdateActionTool();

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
    ];
    for (const name of names) {
      try {
        await this.mcp.unregisterTool(name);
      } catch { }
    }
    await this.logger.info("[panda-nav] kernel plugin unloaded");
  }

  private async registerCapabilitiesTool() {
    const allMetas: Record<string, any> = { ...builtinMetas };
    for (const [k, v] of Object.entries(pandaUtils)) {
      allMetas[k] = v.meta;
    }

    const capabilities = Object.entries(allMetas).map(([name, meta]) => ({
      name,
      description: meta.description,
      parameters: meta.parameters.map((p: any) => `${p.name}: ${p.type}`),
      example: meta.example,
    }));

    await this.mcp.registerTool(
      "panda-nav:get-capabilities",
      {
        title: "Get available script utilities",
        description: "Returns all functions available in the utils object for script execution, including custom utilities and built-in commands",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => ({ capabilities }),
    );
  }

  private async registerSchemaTool() {
    await this.mcp.registerTool(
      "panda-nav:get-action-schema",
      {
        title: "Get action schema reference",
        description: "Returns valid values for all action fields (type, builtin values, icons, positions, etc.) so you can construct correct action objects",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => ({
        actionSchema: {
          types: {
            builtin: "Predefined action: use one of the builtinValues below",
            command: "A registered SiYuan command (e.g. dailyNote, globalSearch)",
            pluginCommand: "A command registered by another plugin",
            group: "Submenu container with children array and submenuLayout",
          },
          builtinValues: [
            { value: "goBack", description: "Navigate to previous document in history" },
            { value: "goForward", description: "Navigate to next document in history" },
            { value: "goParent", description: "Go to parent document" },
            { value: "goChild", description: "Go to first child document" },
            { value: "goNext", description: "Go to next sibling document" },
            { value: "goPrev", description: "Go to previous sibling document" },
            { value: "dailyNote", description: "Open today's daily note" },
            { value: "random", description: "Open a random document" },
            { value: "scrollToTop", description: "Scroll current document to top" },
            { value: "search", description: "Open global search" },
            { value: "script", description: "Execute custom JavaScript (provide code in param field)" },
            { value: "sql", description: "Execute SQL and open a random result (provide SQL in param field)" },
            { value: "url", description: "Open a URL (provide URL in param field)" },
          ],
          showOn: ["both", "mobile", "desktop"],
          positions: {
            mobilePosition: ["navbar", "submenu"],
            desktopPosition: ["navbar", "submenu"],
          },
          icons: {
            format: "#iconXxx (e.g. #iconStar)",
            common: [
              "#iconStar", "#iconHeart", "#iconLink", "#iconLeft", "#iconRight",
              "#iconUp", "#iconDown", "#iconMenu", "#iconCalendar", "#iconSearch",
              "#iconRefresh", "#iconInfo", "#iconSettings", "#iconWorkspace",
            ],
          },
          groupFields: {
            submenuLayout: ["list", "grid"],
            children: "Array of action items (same schema as parent)",
          },
          param: "Required for type=builtin with value=script/sql/url. For script: JS code using plugin, siyuan, utils variables with top-level await support",
        },
      }),
    );
  }

  private async registerGetFullConfigTool() {
    await this.mcp.registerTool(
      "panda-nav:get-full-config",
      {
        title: "Get full plugin configuration",
        description: "Returns the entire config.json including all settings (menuItems, enableBottomNav, showButtonLabels, etc.)",
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
        description: "Add multiple actions at once or replace all existing actions. Use get-action-schema to see valid field values",
        inputSchema: {
          type: "object",
          properties: {
            actions: {
              type: "array",
              description: "Array of action objects. Each object supports: title (string), type (string), value (string), icon (string), showOn (string), param (string). For type=group also: children (array), submenuLayout (string). See get-action-schema for valid values",
              items: { type: "object" },
            },
            mode: {
              type: "string",
              enum: ["append", "replace"],
              description: "append = add to existing list, replace = replace all existing actions",
            },
          },
          required: ["actions", "mode"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (input.mode === "replace") {
          config.menuItems = input.actions.map((a: any) => ({ ...a, id: this.generateId() }));
        } else {
          if (!config.menuItems) config.menuItems = [];
          for (const a of input.actions) {
            config.menuItems.push({ ...a, id: this.generateId() });
          }
        }
        await this.saveConfig(config);
        await this.notifyUI(config.menuItems);
        return { success: true, total: config.menuItems.length, mode: input.mode };
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
        description: "Add a button to the navigation bar. Use get-capabilities to discover available utils functions for script execution",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Button label" },
            type: { type: "string", enum: ["builtin", "command", "pluginCommand", "group"], description: "Action type" },
            value: { type: "string", description: "Action value: builtin id / command name / etc." },
            icon: { type: "string", description: "Icon like #iconStar" },
            showOn: { type: "string", enum: ["both", "mobile", "desktop"] },
            param: { type: "string", description: "Parameter. For type=builtin value=script: JS code using plugin, siyuan, utils variables. Use get-capabilities to see available utils functions" },
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
        await this.notifyUI(config.menuItems);
        return { success: true, id: newItem.id, count: config.menuItems.length };
      },
    );
  }

  private async registerRemoveActionTool() {
    await this.mcp.registerTool(
      "panda-nav:remove-action",
      {
        title: "Remove a navigation action",
        description: "Remove an action button by index. Call list-actions first to get indices",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "Index in the actions list (0-based)" },
          },
          required: ["index"],
        },
        outputSchema: { type: "object" },
      },
      async (input: any) => {
        const config = await this.loadConfig();
        if (!config.menuItems || input.index < 0 || input.index >= config.menuItems.length) {
          return { success: false, error: "Index out of bounds or empty list" };
        }
        const removed = config.menuItems.splice(input.index, 1);
        await this.saveConfig(config);
        await this.notifyUI(config.menuItems);
        return { success: true, removed: removed[0]?.title };
      },
    );
  }

  private async registerUpdateActionTool() {
    await this.mcp.registerTool(
      "panda-nav:update-action",
      {
        title: "Update a navigation action",
        description: "Update an existing action button by index. Call list-actions to get the current list",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "Index of the action to update (0-based)" },
            title: { type: "string", description: "New button label" },
            type: { type: "string", enum: ["builtin", "command", "pluginCommand", "group"] },
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
        if (!config.menuItems || input.index < 0 || input.index >= config.menuItems.length) {
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
        await this.notifyUI(config.menuItems);
        return { success: true };
      },
    );
  }

  private async loadConfig(): Promise<any> {
    try {
      const obj = await this.storage.get("config.json");
      const text = await obj.text();
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  private async saveConfig(config: any) {
    await this.storage.put("config.json", JSON.stringify(config, null, 2));
  }

  private async notifyUI(menuItems: any[]) {
    try {
      await this.rpc.broadcast("panda-nav:config-changed", {
        action: "mcp-update",
        menuItems: menuItems || [],
      });
    } catch { }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }
}

new KernelPlugin();
