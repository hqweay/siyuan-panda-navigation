var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/builtins/index.ts
var index_exports = {};
__export(index_exports, {
  builtinCommandList: () => builtinCommandList,
  builtinCommands: () => builtinCommands
});
module.exports = __toCommonJS(index_exports);
var import_meta = {};
var builtinCommands = {};
var modules = import_meta.glob("./commands/*.ts", { eager: true });
for (const path in modules) {
  const mod = modules[path];
  for (const key in mod) {
    const exp = mod[key];
    if (Array.isArray(exp)) {
      exp.forEach((cmd) => {
        if (cmd && cmd.id && typeof cmd.execute === "function") {
          builtinCommands[cmd.id] = cmd;
        }
      });
    } else if (exp && exp.id && typeof exp.execute === "function") {
      builtinCommands[exp.id] = exp;
    }
  }
}
var builtinCommandList = Object.values(builtinCommands);
