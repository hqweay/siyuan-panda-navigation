const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

const files = glob.sync('src/builtins/commands/*.ts');
const metas = {};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match exported commands: export const xxxCommand: BuiltinCommand = { ... }
  const regex = /export\s+const\s+(\w+)\s*:\s*BuiltinCommand\s*=\s*{([\s\S]*?^})}/gm;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    const body = match[2];
    
    // Extract fields
    const idMatch = body.match(/id:\s*["']([^"']+)["']/);
    const titleMatch = body.match(/title:\s*["']([^"']+)["']/);
    const requiresParamMatch = body.match(/requiresParam:\s*(true|false)/);
    const paramPlaceholderMatch = body.match(/paramPlaceholder:\s*["']([^"']+)["']/);
    
    if (idMatch && titleMatch) {
      const id = idMatch[1];
      const title = titleMatch[1];
      const requiresParam = requiresParamMatch ? requiresParamMatch[1] === 'true' : false;
      const paramPlaceholder = paramPlaceholderMatch ? paramPlaceholderMatch[1] : '';
      
      const parameters = [];
      if (requiresParam) {
        parameters.push({
          name: "param",
          type: "string",
          description: paramPlaceholder || "参数"
        });
      }
      
      metas[id] = {
        name: id,
        description: title,
        parameters,
        example: `utils["${id}"](${requiresParam ? '"..."' : ''})`
      };
    }
  }
});

console.log(JSON.stringify(metas, null, 2));
