// 40 m terrain windows for landing-ellipse checks: a 301 x 301 crop (12 km square) of LOLA LDEM_85S_40M (PDS)
// around each catalogue site the 40 m mosaic covers. The full mosaic is 115 MB, too large for the browser.
//   web/data/dem/crop40/<id>.i16   int16 LE heights (DN, 0.5 m), rows/cols of the full 7584 x 7584 grid
//   web/data/dem/crop40.json       { n, cellM, m, sites: { id: { file, r0, c0 } } }
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { R_MOON_M } from '../web/dem.js';

const root = new URL('../', import.meta.url), N = 7584, CELL = 40, HALF = 150, M = 2 * HALF + 1, D2R = Math.PI / 180;
const b = readFileSync(new URL('data/raw/lola/ldem_85s_40m.img', root)), z = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
if (z.length !== N * N) throw new Error(`ldem_85s_40m.img has ${z.length} samples, expected ${N * N}`);
const sites = JSON.parse(readFileSync(new URL('web/data/sites.json', root))).sites;
mkdirSync(new URL('web/data/dem/crop40/', root), { recursive: true });
const off = (N - 1) / 2, meta = { n: N, cellM: CELL, m: M, source: 'LOLA LDEM_85S_40M (PDS), 12 km window per site', sites: {} };
for (const s of sites) {
  const rho = 2 * R_MOON_M * Math.tan((90 + s.lat_deg) * D2R / 2);
  const r = Math.round(off - (rho * Math.cos(s.lon_deg * D2R)) / CELL), c = Math.round(off + (rho * Math.sin(s.lon_deg * D2R)) / CELL);
  const r0 = r - HALF, c0 = c - HALF;
  if (r0 < 0 || c0 < 0 || r0 + M > N || c0 + M > N) continue; // outside the 40 m mosaic: the app uses 240 m there
  const out = new Int16Array(M * M);
  for (let i = 0; i < M; i++) out.set(z.subarray((r0 + i) * N + c0, (r0 + i) * N + c0 + M), i * M);
  for (const v of out) if (v === -32768) throw new Error(`no-data value in the 40 m window for ${s.id}`);
  writeFileSync(new URL(`web/data/dem/crop40/${s.id}.i16`, root), Buffer.from(out.buffer));
  meta.sites[s.id] = { file: `dem/crop40/${s.id}.i16`, r0, c0 };
}
writeFileSync(new URL('web/data/dem/crop40.json', root), JSON.stringify(meta, null, 1));
console.log(`${Object.keys(meta.sites).length} windows:`, Object.keys(meta.sites).join(', '));
