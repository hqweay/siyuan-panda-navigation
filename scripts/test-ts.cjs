const ts = require('typescript');
const fs = require('fs');
const glob = require('fast-glob');

const files = glob.sync('src/builtins/commands/*.ts');
const metas = {};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      if (node.type && node.type.getText(sourceFile) === 'BuiltinCommand') {
        const obj = node.initializer;
        let id, title, requiresParam = false, paramPlaceholder = '';
        
        obj.properties.forEach(prop => {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            const name = prop.name.text;
            if (name === 'id') id = prop.initializer.text;
            if (name === 'title') title = prop.initializer.text;
            if (name === 'requiresParam') requiresParam = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
            if (name === 'paramPlaceholder') paramPlaceholder = prop.initializer.text;
          }
        });
        
        if (id && title) {
          const parameters = [];
          if (requiresParam) {
            parameters.push({
              name: "param",
              type: "string",
              description: paramPlaceholder || "执行参数"
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
    }
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
});

console.log(JSON.stringify(metas, null, 2));
