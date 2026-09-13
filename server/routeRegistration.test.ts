import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('does not register duplicate literal method/path handlers in the route modules', () => {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const file of fs.readdirSync('server').filter(name => /routes\.ts$/i.test(name))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join('server', file), 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(source) === 'app'
        && /^(get|post|put|patch|delete)$/.test(node.expression.name.text)
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = `${node.expression.name.text} ${node.arguments[0].text}`;
        if (seen.has(key)) duplicates.push(`${key}: ${seen.get(key)}, ${file}`);
        seen.set(key, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(seen.size).toBeGreaterThan(100);
  expect(duplicates).toEqual([]);
});
