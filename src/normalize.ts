/**
 * 规范化菜单配置项，将历史遗留的类型（如 url, sql, av-add, open-setting 等）转换为统一的 builtin 类型，
 * 并正确映射其 value 和 param 字段，确保 Svelte 配置界面和运行期一致。
 */
export function normalizeMenuItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item) return item;
    const normalized = { ...item };

    if (normalized.type === "group" && Array.isArray(normalized.children)) {
      normalized.children = normalizeMenuItems(normalized.children);
      return normalized;
    }

    const legacyTypes = ["url", "sql", "av-add", "open-setting"];
    if (legacyTypes.includes(normalized.type)) {
      normalized.param = normalized.param !== undefined && normalized.param !== null ? normalized.param : normalized.value;
      normalized.value = normalized.type;
      normalized.type = "builtin";
    } else if (normalized.type === "internal") {
      normalized.type = "builtin";
    }

    return normalized;
  });
}
