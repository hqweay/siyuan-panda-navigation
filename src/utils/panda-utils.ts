export interface UtilMeta {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
  example: string;
}

export interface UtilEntry {
  meta: UtilMeta;
  fn: (siyuan: any, ...args: any[]) => any;
}

export const pandaUtils: Record<string, UtilEntry> = {
  // 示例 1：获取所有笔记本列表
  getNotebooks: {
    meta: {
      name: "getNotebooks",
      description: "获取当前所有打开的笔记本列表",
      parameters: [],
      example: "const notebooks = await utils.getNotebooks();",
    },
    fn: async (siyuan) => {
      const res = await siyuan.fetchSyncPost("/api/notebook/lsNotebooks", {});
      return res?.data?.notebooks || [];
    },
  },

  // 示例 2：执行 SQL 查询并返回原始数据
  // （内置的 utils.sql 是“随机漫游”直接打开页面，而这个工具是给写脚本的用户提取数据用的）
  queryBlocks: {
    meta: {
      name: "queryBlocks",
      description: "执行 SQL 查询并返回所有的块数据数组",
      parameters: [{ name: "stmt", type: "string", description: "完整的 SQL 查询语句" }],
      example: 'const blocks = await utils.queryBlocks("SELECT * FROM blocks WHERE type=\'d\' LIMIT 5");',
    },
    fn: async (siyuan, stmt: string) => {
      if (!stmt) return [];
      const res = await siyuan.fetchSyncPost("/api/query/sql", { stmt });
      return res?.data || [];
    },
  },
};
