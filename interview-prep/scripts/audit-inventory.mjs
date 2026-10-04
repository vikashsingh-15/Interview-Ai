// Read-only source/dependency inventory; excludes private environment files and generated data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['node_modules', '.git', 'dist', '.next', '.next-production', 'uploads', 'coverage', 'mongodb-data', 'test-results', 'playwright-report']);
const files = [];
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) visit(full); }
    else if (/\.(ts|tsx|js|mjs|cjs|css|json|svg|md)$/.test(entry.name) &&
      !entry.name.includes('lock') && !entry.name.endsWith('tsbuildinfo') &&
      !['AUDIT_INVENTORY.md', 'CODEBASE_AUDIT.md'].includes(entry.name)) {
      files.push({ name: path.relative(root, full).replaceAll('\\', '/'), text: fs.readFileSync(full, 'utf8') });
    }
  }
}
visit(root);
const code = files.filter(f => !f.name.startsWith('docs/') && !f.name.endsWith('.md'));
const imports = text => [...text.matchAll(/(?:from\s*|require\(\s*|import\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
const packageName = value => value.startsWith('@') ? value.split('/').slice(0, 2).join('/') : value.split('/')[0];
const lines = ['# Audit inventory', '', 'Generated with `node scripts/audit-inventory.mjs`. Private environments, logs, data, binaries and build output are excluded. All source/config/test/script text is read to collect static imports, API surfaces and dependency evidence. Static references are evidence of use, not proof that an unreferenced item is safe to remove.', '', '## Direct dependencies', '', '| App | Dependency | Declared class | Static usage evidence / disposition |', '|---|---|---|---|'];
for (const app of ['backend', 'frontend']) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, app, 'package.json'), 'utf8'));
  for (const group of ['dependencies', 'devDependencies']) for (const dep of Object.keys(pkg[group] || {})) {
    const matches = code.filter(f => imports(f.text).some(v => packageName(v) === dep));
    const evidence = matches.map(f => f.name).slice(0, 4).join(', ');
    let usage = evidence || 'Config/script/type/plugin or transitive tooling; retained pending conclusive proof';
    if (dep.startsWith('@types/')) usage = 'TypeScript declaration resolution; development/build types, retained';
    if (['typescript', 'eslint', 'eslint-config-next', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'ts-jest', 'ts-node', 'ts-node-dev', 'jest', 'next', '@playwright/test', 'autoprefixer', 'postcss', 'tailwindcss'].includes(dep)) usage = evidence || 'package scripts or framework/build/test configuration; retained';
    lines.push(`| ${app} | ${dep} | ${group === 'dependencies' ? 'runtime/build' : 'development/test'} | ${usage} |`);
  }
}
lines.push('', 'Root workspace mongodb-memory-server is a local tooling install boundary and is retained. Backend uses its separate declared test dependency. Locks are retained and synchronized by npm install.', '', '## Files and API/model surfaces', '', '| File | Lines | Imports | Routes / schema indexes |', '|---|---|---|---|');
for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
  const routes = [...f.text.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)/g)].map(m => `${m[1].toUpperCase()} ${m[2]}`);
  const indexes = [...f.text.matchAll(/\.index\(/g)].length;
  lines.push(`| ${f.name} | ${f.text.split('\n').length} | ${[...new Set(imports(f.text))].join(', ').replaceAll('|', '\\|')} | ${routes.join('; ')}${indexes ? `; ${indexes} explicit schema indexes` : ''} |`);
}
fs.writeFileSync(path.join(root, 'docs', 'AUDIT_INVENTORY.md'), lines.join('\n') + '\n');
console.log(`Inspected ${files.length} source/config/test/document files; wrote docs/AUDIT_INVENTORY.md`);
