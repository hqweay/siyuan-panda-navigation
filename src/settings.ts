import { Plugin } from "siyuan";

export const settings = {
  data: {} as any,
  plugin: null as any as Plugin,
  
  init(pluginInstance: Plugin) {
    this.plugin = pluginInstance;
  },
  
  getBySpace(space: string, key: string) {
    return this.data[key];
  },
  
  setBySpace(space: string, key: string, value: any) {
    this.data[key] = value;
  },
  
  async save() {
    if (this.plugin) {
      await this.plugin.saveData("config.json", this.data);
    }
  }
};
