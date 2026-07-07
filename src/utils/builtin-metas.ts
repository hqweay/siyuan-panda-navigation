import { UtilMeta } from "./panda-utils";

export const builtinMetas: Record<string, UtilMeta> = {
  goBack: {
    name: "goBack",
    description: "后退到上一个浏览的文档",
    parameters: [],
    example: "utils.goBack()",
  },
  goForward: {
    name: "goForward",
    description: "前进到下一个浏览的文档",
    parameters: [],
    example: "utils.goForward()",
  },
  goParent: {
    name: "goParent",
    description: "跳转到当前文档的父文档",
    parameters: [],
    example: "utils.goParent()",
  },
  goChild: {
    name: "goChild",
    description: "跳转到当前文档的第一个子文档",
    parameters: [],
    example: "utils.goChild()",
  },
  goNext: {
    name: "goNext",
    description: "跳转到当前文档的下一个同级文档",
    parameters: [],
    example: "utils.goNext()",
  },
  goPrev: {
    name: "goPrev",
    description: "跳转到当前文档的上一个同级文档",
    parameters: [],
    example: "utils.goPrev()",
  },
  url: {
    name: "url",
    description: "在浏览器中打开一个链接",
    parameters: [{ name: "url", type: "string", description: "要打开的链接（http/https/siyuan 协议）" }],
    example: 'utils.url("https://example.com")',
  },
};
