/**
 * 熊猫导航 - 内核插件
 * 注册 MCP 工具，让 AI 智能体能够读取和配置导航动作
 */

class KernelPlugin {
  constructor() {
    const siyuan = globalThis.siyuan;
    if (!siyuan) {
      console.error("[panda-nav] siyuan 全局对象不可用");
      return;
    }

    siyuan.plugin.lifecycle.onload = this.onload.bind(this);
    siyuan.plugin.lifecycle.onunload = this.onunload.bind(this);
  }

  async onload() {
    const { mcp, storage, rpc, logger } = globalThis.siyuan;

    await logger.info("[panda-nav] 内核插件加载中...");

    // 注册 MCP 工具：列出所有动作（从 menuItems 读取）
    await mcp.registerTool(
      "panda-nav:list-actions",
      {
        title: "熊猫导航 - 列出所有动作",
        description: "获取熊猫导航当前配置的所有动作按钮，包括内置动作和自定义动作",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      async () => {
        const config = await this.loadConfig(storage);
        const items = config.menuItems || [];
        return { actions: items, total: items.length };
      }
    );

    // 注册 MCP 工具：添加一个新动作到导航栏
    await mcp.registerTool(
      "panda-nav:add-action",
      {
        title: "熊猫导航 - 添加快捷动作",
        description: "在导航栏添加一个动作按钮。type 为 builtin 时 value 可选：script（自定义脚本）/ sql（随机漫游 SQL）/ url（链接）/ goBack / goForward / dailyNote / random / scrollToTop / search。脚本内容放在 param 中",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "按钮显示名称" },
            type: { type: "string", enum: ["builtin", "command", "pluginCommand", "group"], description: "动作类型" },
            value: { type: "string", description: "动作值：内置功能ID（如 script/sql/url/goBack）/ 命令名等" },
            icon: { type: "string", description: "图标，如 #iconStar 或 #iconHeart" },
            showOn: { type: "string", enum: ["both", "mobile", "desktop"], description: "在哪些设备上显示" },
            param: { type: "string", description: "参数内容：当 type=builtin 且 value=script 时为 JS 脚本代码；value=sql 时为 SQL 语句；value=url 时为链接地址" },
          },
          required: ["title", "type"],
        },
        outputSchema: { type: "object" },
      },
      async (input) => {
        const config = await this.loadConfig(storage);
        if (!config.menuItems) config.menuItems = [];

        const newItem = {
          id: this.generateId(),
          type: input.type,
          title: input.title,
          icon: input.icon || "#iconLink",
          value: input.value || "",
          showOn: input.showOn || "both",
        };
        if (input.param) newItem.param = input.param;
        config.menuItems.push(newItem);

        await this.saveConfig(storage, config);
        await this.notifyUI(rpc, config.menuItems);

        return { success: true, id: newItem.id, count: config.menuItems.length };
      }
    );

    // 注册 MCP 工具：删除指定索引的动作
    await mcp.registerTool(
      "panda-nav:remove-action",
      {
        title: "熊猫导航 - 删除动作",
        description: "根据索引删除导航栏中的一个动作。先调用 list-actions 获取索引",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "动作在列表中的索引（从 0 开始）" },
          },
          required: ["index"],
        },
        outputSchema: { type: "object" },
      },
      async (input) => {
        const config = await this.loadConfig(storage);
        if (!config.menuItems || input.index < 0 || input.index >= config.menuItems.length) {
          return { success: false, error: "索引越界或动作列表为空" };
        }
        const removed = config.menuItems.splice(input.index, 1);
        await this.saveConfig(storage, config);
        await this.notifyUI(rpc, config.menuItems);

        return { success: true, removed: removed[0]?.title };
      }
    );

    await logger.info("[panda-nav] MCP 工具注册完成");
  }

  async onunload() {
    const { mcp, rpc, logger } = globalThis.siyuan;
    await logger.info("[panda-nav] 内核插件卸载中...");

    await mcp.unregisterTool("panda-nav:list-actions");
    await mcp.unregisterTool("panda-nav:add-action");
    await mcp.unregisterTool("panda-nav:remove-action");
  }

  async loadConfig(storage) {
    try {
      const obj = await storage.get("config.json");
      const text = await obj.text();
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async saveConfig(storage, config) {
    await storage.put("config.json", JSON.stringify(config, null, 2));
  }

  async notifyUI(rpc, menuItems) {
    try {
      await rpc.broadcast("panda-nav:config-changed", { action: "mcp-update", menuItems: menuItems || [] });
    } catch (_) {
      // 广播失败忽略
    }
  }

  generateId() {
    return (
      Math.random().toString(36).substring(2, 10) +
      Date.now().toString(36)
    );
  }
}

new KernelPlugin();
