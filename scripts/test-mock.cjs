const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'siyuan') {
    return { showMessage: () => {}, Plugin: class {} };
  }
  return originalRequire.apply(this, arguments);
};

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.buildSync({
  entryPoints: ['src/builtins/index.ts'],
  bundle: true,
  outfile: 'scripts/temp.cjs',
  format: 'cjs',
  external: ['siyuan']
});

const cmds = require('./temp.cjs').builtinCommands;
console.log("Found commands:", Object.keys(cmds));
fs.unlinkSync('scripts/temp.cjs');
