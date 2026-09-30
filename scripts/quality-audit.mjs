import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';

const label = process.argv[2] || 'current';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple report label');
const destination = path.resolve('artifacts/code-quality', label);
fs.mkdirSync(destination, { recursive: true });
const save = (name, value) => fs.writeFileSync(path.join(destination, `${name}.json`), JSON.stringify(value, null, 2));
const configs = {};
for (const name of ['app', 'node']) {
  const config = ts.readConfigFile(`tsconfig.${name}.json`, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  configs[name] = parsed.options;
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({
    file: d.file ? path.relative(process.cwd(), d.file.fileName) : null,
    line: d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  }));
  save(`types-${name}`, diagnostics);
  console.log(`${name}: ${diagnostics.length} diagnostics`);
}
const lint = spawnSync('node_modules/.bin/eslint', ['src', 'server', 'shared', '--format', 'json'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
if (!lint.stdout) throw new Error(lint.stderr || 'ESLint did not return a report');
const lintResults = JSON.parse(lint.stdout);
save('lint', lintResults);
console.log(`lint: ${lintResults.reduce((n, f) => n + f.errorCount, 0)} errors, ${lintResults.reduce((n, f) => n + f.warningCount, 0)} warnings`);

const files = ['src', 'server', 'shared', 'scripts'].flatMap(root => ts.sys.readDirectory(root, ['.ts', '.tsx', '.js', '.mjs', '.cjs'], ['**/generated/**'])).map(file => path.resolve(file));
const graph = new Map();
const external = new Set();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = [];
  const visit = node => {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) specifier = node.arguments[0];
    if (specifier && ts.isStringLiteral(specifier)) {
      const value = specifier.text;
      const resolved = ts.resolveModuleName(value, file, configs.app, ts.sys).resolvedModule;
      if (resolved && !resolved.isExternalLibraryImport) imports.push(path.resolve(resolved.resolvedFileName));
      if (!value.startsWith('.') && !value.startsWith('@/') && !value.startsWith('@shared/') && !value.startsWith('node:')) external.add(value.startsWith('@') ? value.split('/').slice(0, 2).join('/') : value.split('/')[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  graph.set(file, imports);
}
const reachable = new Set();
const walk = file => { if (reachable.has(file)) return; reachable.add(file); for (const child of graph.get(file) || []) walk(child); };
for (const entry of ['src/main.tsx', 'server/index.ts']) walk(path.resolve(entry));
const orphanCandidates = files.filter(file => /\/(src|server)\//.test(file) && !/\.(test|spec)\.|\/test\/|\.d\.ts$/.test(file) && !reachable.has(file)).map(file => path.relative(process.cwd(), file));
save('graph', { sourceFiles: files.length, reachableFiles: reachable.size, orphanCandidates, importedPackages: [...external].sort() });
console.log(`graph: ${files.length} files, ${orphanCandidates.length} unreachable candidates (manual verification required)`);
