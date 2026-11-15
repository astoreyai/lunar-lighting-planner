// Build the browser data from the real LOLA PDS images in data/raw/lola and pipeline/sites.json:
//   web/data/dem/polar240.i16   LDEM_75S_240M as-is (int16 LE, 3812 x 3812) for custom-point horizons
//   web/data/dem/global4.i16    LDEM_16 block-averaged 4x4 to 4 px/deg (720 x 1440)
//   web/data/dem/polarmap.i16   240 m grid resampled to 762 x 762 (~1.2 km cells) for the map hillshade
//   web/data/horizons/<id>.json terrain horizon per catalogue site (40 m -> 240 m -> 16 px/deg stack)
//   web/data/sites.json         catalogue + ground height + horizon file + grids used
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { polarGrid, globalGrid, stack, R_MOON_M } from '../web/dem.js';
import { traceHorizon } from '../web/horizon.js';

const root = new URL('../', import.meta.url);
const raw = (n) => { const b = readFileSync(new URL(`data/raw/lola/${n}`, root)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const out = (p) => new URL(`web/data/${p}`, root);
mkdirSync(out('dem'), { recursive: true });
mkdirSync(out('horizons'), { recursive: true });

const g16d = raw('ldem_16.img'), p240d = raw('ldem_75s_240m.img');
const p40 = polarGrid({ data: raw('ldem_85s_40m.img'), n: 7584, cellM: 40, maxLat: -85, id: 'LOLA 40 m (85S)' });
const p240 = polarGrid({ data: p240d, n: 3812, cellM: 240, maxLat: -75, id: 'LOLA 240 m (75S)' });
const g16 = globalGrid({ data: g16d, ppd: 16, id: 'LOLA 16 px/deg global' });

copyFileSync(new URL('data/raw/lola/ldem_75s_240m.img', root), out('dem/polar240.i16'));

const g4 = new Int16Array(720 * 1440);
for (let r = 0; r < 720; r++) for (let c = 0; c < 1440; c++) {
  let s = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g16d[(4 * r + i) * 5760 + 4 * c + j];
  g4[r * 1440 + c] = Math.round(s / 16);
}
writeFileSync(out('dem/global4.i16'), Buffer.from(g4.buffer));

// Map grid: same projection, n = 762, cell = 240 * 3812 / 762 m, sampled bilinearly at projected cell centres.
const N = 762, cell = (240 * 3812) / N, map = new Int16Array(N * N), off240 = 3811 / 2;
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const x = (c - (N - 1) / 2) * cell, y = ((N - 1) / 2 - r) * cell;
  const rr = Math.min(Math.max(off240 - y / 240, 0), 3810.999), cc = Math.min(Math.max(off240 + x / 240, 0), 3810.999);
  const r0 = Math.floor(rr), c0 = Math.floor(cc), fr = rr - r0, fc = cc - c0, i = r0 * 3812 + c0;
  map[r * N + c] = Math.round((p240d[i] * (1 - fc) + p240d[i + 1] * fc) * (1 - fr) + (p240d[i + 3812] * (1 - fc) + p240d[i + 3813] * fc) * fr);
}
writeFileSync(out('dem/polarmap.i16'), Buffer.from(map.buffer));
writeFileSync(out('dem/meta.json'), JSON.stringify({
  sphere_m: R_MOON_M, scale_m_per_dn: 0.5,
  polar240: { file: 'dem/polar240.i16', n: 3812, cellM: 240, maxLat: -75, source: 'LOLA LDEM_75S_240M (PDS)' },
  polarmap: { file: 'dem/polarmap.i16', n: N, cellM: cell, maxLat: -75, source: 'LOLA LDEM_75S_240M resampled' },
  global4: { file: 'dem/global4.i16', ppd: 4, source: 'LOLA LDEM_16 (PDS) 4x4 block mean' },
}, null, 1));
console.log('DEM files written');

const catalogue = new URL('pipeline/sites.json', root);
if (!existsSync(catalogue)) { console.log('no pipeline/sites.json yet: horizons skipped'); process.exit(0); }
const cat = JSON.parse(readFileSync(catalogue, 'utf8'));
const terrain = stack([p40, p240, g16]);
for (const s of cat.sites) {
  const t0 = Date.now(), h = traceHorizon(terrain, s.lat_deg, s.lon_deg);
  writeFileSync(out(`horizons/${s.id}.json`), JSON.stringify(h));
  Object.assign(s, { ground_m: Math.round(h.groundM * 10) / 10, horizon: `horizons/${s.id}.json`, horizon_grids: h.grids });
  console.log(s.id, h.grids.join(' + '), `${Date.now() - t0} ms`);
}
writeFileSync(out('sites.json'), JSON.stringify(cat, null, 1));
