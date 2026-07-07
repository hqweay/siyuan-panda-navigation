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

export const pandaUtils: Record<string, UtilEntry> = {};
