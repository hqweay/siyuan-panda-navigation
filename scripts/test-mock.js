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

esbuild.buildSync({
  entryPoints: ['src/builtins/index.ts'],
  bundle: true,
  outfile: 'temp.js',
  format: 'cjs',
  external: ['siyuan']
});

const cmds = require('./temp.js').builtinCommands;
console.log(Object.keys(cmds));
fs.unlinkSync('temp.js');
