import { BuiltinCommand } from "../types";
import { settings } from "../../settings";
import { showMessage } from "siyuan";
import {
  PRESET_GROUPS,
  generateDefaultMenuItems,
} from "../../config/presets";

export const switchPreset: BuiltinCommand = {
  id: "switch-preset",
  title: "切换导航预设",
  requiresParam: true,
  paramPlaceholder: "选择预设",
  inputType: "select",
  paramOptions: [
    { label: "恢复出厂配置", value: "RESTORE_DEFAULT" },
    ...PRESET_GROUPS.map((p) => ({ label: p.name, value: p.name })),
  ],
  loadParamOptions: async () => {
    const customPresets =
      settings.getBySpace("nav-helper", "customPresets") || [];
    return customPresets.map((p: any) => ({ label: p.name, value: p.name }));
  },
  execute: async (plugin: any, param?: string) => {
    if (!param) {
      showMessage("预设名称不能为空");
      return;
    }

    if (param === "RESTORE_DEFAULT") {
      const defaultItems = generateDefaultMenuItems();
      settings.setBySpace("nav-helper", "menuItems", defaultItems);
      await settings.save();
      if (plugin && typeof plugin.handleSettingsChange === "function") {
        plugin.handleSettingsChange();
      }
      showMessage("已恢复出厂默认配置");
      return;
    }

    // Check custom presets
    const customPresets =
      settings.getBySpace("nav-helper", "customPresets") || [];
    const customPreset = customPresets.find((p: any) => p.name === param);
    if (customPreset && customPreset.menuItems) {
      settings.setBySpace(
        "nav-helper",
        "menuItems",
        JSON.parse(JSON.stringify(customPreset.menuItems)),
      );
      await settings.save();
      if (plugin && typeof plugin.handleSettingsChange === "function") {
        plugin.handleSettingsChange();
      }
      showMessage(`已切换至预设: ${param}`);
      return;
    }

    // Check builtin presets
    const builtinPreset = PRESET_GROUPS.find((p) => p.name === param);
    if (builtinPreset) {
      const newItems = [builtinPreset.generate()];
      settings.setBySpace("nav-helper", "menuItems", newItems);
      await settings.save();
      if (plugin && typeof plugin.handleSettingsChange === "function") {
        plugin.handleSettingsChange();
      }
      showMessage(`已切换至内置预设: ${param}`);
      return;
    }

    showMessage(`未找到名为 "${param}" 的预设`);
  },
};
