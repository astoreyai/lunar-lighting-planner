// Fingerprint of the shipped data: web/data/manifest.json lists the sha256 and size of every file under web/data,
// plus data_id, the first 12 hex digits of the sha256 over those lines. The app prints data_id beside every answer
// and in every export, so a result can be tied to the exact data that produced it.
//   node pipeline/manifest.mjs           write the manifest
//   node pipeline/manifest.mjs --check   fail if any file differs from the manifest (used by pipeline/rebuild.sh)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../web/data/', import.meta.url), sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (dir) => readdirSync(new URL(dir, root)).sort().flatMap((n) => (statSync(new URL(dir + n, root)).isDirectory() ? walk(`${dir}${n}/`) : [dir + n]));
const files = {};
for (const p of walk('')) if (p !== 'manifest.json') { const b = readFileSync(new URL(p, root)); files[p] = { sha256: sha(b), bytes: b.length }; }
const data_id = sha(Object.entries(files).map(([p, f]) => `${f.sha256}  ${p}\n`).join('')).slice(0, 12);

if (process.argv.includes('--check')) {
  const want = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const bad = [...new Set([...Object.keys(files), ...Object.keys(want.files)])].filter((p) => files[p]?.sha256 !== want.files[p]?.sha256);
  if (bad.length) { console.error(`${bad.length} file(s) differ from web/data/manifest.json:\n${bad.join('\n')}`); process.exit(1); }
  console.log(`${Object.keys(files).length} files match the manifest; data_id ${data_id}`);
} else {
  writeFileSync(new URL('manifest.json', root), `${JSON.stringify({ data_id, files }, null, 1)}\n`);
  console.log(`manifest written: ${Object.keys(files).length} files, data_id ${data_id}`);
}
