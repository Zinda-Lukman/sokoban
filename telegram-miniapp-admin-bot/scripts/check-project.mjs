import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tgRoot = join(root, 'tgcloud');
const jsFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.js')) jsFiles.push(full);
  }
}
await walk(tgRoot);
let failed = false;
for (const file of jsFiles) {
  const rel = relative(root, file);
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    failed = true;
    console.error(`SYNTAX ERROR ${rel}\n${syntax.stderr}`);
    continue;
  }
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of imports) {
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec);
      try { await readFile(target); }
      catch { failed = true; console.error(`MISSING IMPORT ${rel} -> ${spec}`); }
    } else if (spec !== 'sdk' && spec !== 'sdk/db' && spec !== 'sdk/api' && spec !== 'sdk/fetch') {
      failed = true;
      console.error(`UNSUPPORTED RUNTIME IMPORT ${rel} -> ${spec}`);
    }
  }
  if (/\bimport\s*\(/.test(source)) {
    failed = true;
    console.error(`DYNAMIC IMPORT FOUND ${rel}`);
  }
}
if (failed) process.exit(1);
console.log(`PASS: syntax and relative-import checks for ${jsFiles.length} tgcloud modules.`);
