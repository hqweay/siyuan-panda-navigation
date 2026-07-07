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
];
