import { generateId } from "@/utils";

export const PRESET_GROUPS = [
  {
    id: "preset-nav-basic",
    name: "基础导航 (网格)",
    description: "包含上下左右文档跳转的九宫格菜单",
    generate: () => ({
      id: generateId(),
      type: "group",
      title: "基础导航",
      icon: "#iconMenu",
      showOn: "both",
      submenuLayout: "grid",
      children: [
        {
          id: generateId(),
          type: "builtin",
          value: "goParent",
          title: "父文档",
          icon: "#iconUp",
          showOn: "both",
        },
        {
          id: generateId(),
          type: "builtin",
          value: "goPrev",
          title: "上一个",
          icon: "#iconLeft",
          showOn: "both",
        },
        {
          id: generateId(),
          type: "builtin",
          value: "goNext",
          title: "下一个",
          icon: "#iconRight",
          showOn: "both",
        },
        {
          id: generateId(),
          type: "builtin",
          value: "goChild",
          title: "子文档",
          icon: "#iconDown",
          showOn: "both",
        },
      ],
    }),
  },
  {
    id: "preset-script-example",
    name: "自定义脚本示例 (高级)",
    description: "演示如何使用内置脚本引擎执行原生 JS 代码",
    generate: () => ({
      id: generateId(),
      type: "builtin",
      value: "script",
      title: "弹出问候语",
      icon: "#iconInfo",
      showOn: "both",
      param: `// 这是一个在 Siyuan 环境执行的脚本示例
// 你可以直接使用 siyuan 和 plugin 变量
// utils 为熊猫导航提供的工具函数（目前为空，后续版本会添加）
siyuan.showMessage("Hello World! 🐼 熊猫导航脚本执行成功");

// 支持顶层 await 进行网络请求
const res = await siyuan.fetchSyncPost('/api/query/sql', {
    stmt: "SELECT id, content FROM blocks WHERE type='d' LIMIT 1"
});

if (res && res.data && res.data.length > 0) {
    const docId = res.data[0].id;
    console.log("随机查询到文档:", docId);
    
    // 打开文档
    if (window.siyuan.config.system.os === "ios" || window.siyuan.config.system.os === "android") {
        siyuan.openMobileFileById(plugin.app, docId);
    } else {
        siyuan.openTab({ app: plugin.app, doc: { id: docId, action: ["cb-get-focus", "cb-get-scroll"] } });
    }
}
`,
    }),
  },
];

/**
 * 默认出厂配置
 */
export function generateDefaultMenuItems() {
  const basicNavPreset = PRESET_GROUPS.find(p => p.id === "preset-nav-basic");
  
  return [
    {
      id: generateId(),
      type: "builtin",
      value: "goBack",
      title: "返回",
      icon: "#iconLeft",
      showOn: "both",
    },
    {
      id: generateId(),
      type: "command",
      value: "dailyNote",
      title: "今日日记",
      icon: "#iconCalendar",
      showOn: "both",
    },
    basicNavPreset ? basicNavPreset.generate() : null,
    {
      id: generateId(),
      type: "builtin",
      value: "goForward",
      title: "前进",
      icon: "#iconRight",
      showOn: "both",
    },
    {
      id: generateId(),
      type: "group",
      value: "",
      title: "快捷动作",
      icon: "#iconStar",
      showOn: "both",
      children: [
        //  { id: generateId(), type: "builtin", title: "首页", value: "url", param: "siyuan://common/dashboard", icon: "#iconWorkspace", showOn: "both" },
        {
          id: generateId(),
          type: "command",
          title: "全局搜索",
          value: "globalSearch",
          icon: "#iconSearch",
          showOn: "mobile",
        },
        {
          id: generateId(),
          type: "builtin",
          title: "随机漫游",
          value: "sql",
          param: "SELECT id FROM blocks WHERE type = 'd'",
          icon: "#iconRefresh",
          showOn: "both",
        },
        {
          id: generateId(),
          type: "builtin",
          title: "作者博客",
          value: "url",
          param: "https://leay.net/",
          icon: "#iconLink",
          showOn: "both",
        },
      ],
    },
  ].filter(Boolean);
}
