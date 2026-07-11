export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function generateActionKey(item: { title: string; type: string; value?: string }): string {
  const seed = `${item.type}:${item.value || ""}:${item.title}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return "b" + Math.abs(hash).toString(36).padStart(6, "0");
}

export function getActionKey(item: any): string {
  return item.actionKey || generateActionKey(item);
}

export function assignButtonIds<T extends Record<string, any>>(item: T): T {
  item.id = generateId();
  item.actionKey = generateActionKey(item);
  if (Array.isArray(item.children)) {
    item.children.forEach(assignButtonIds);
  }
  return item;
}
