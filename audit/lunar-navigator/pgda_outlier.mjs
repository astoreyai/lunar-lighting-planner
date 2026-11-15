// Audit follow-up T8: why one lattice point (86.5S 135E) disagrees with the PGDA Earth-visibility map. Real data only.
// Usage: node audit/lunar-navigator/pgda_outlier.mjs > audit/lunar-navigator/pgda_outlier_output.txt
import { readFileSync } from 'node:fs';
import { polarGrid, globalGrid, stack, R_MOON_M } from '../../web/dem.js';
import { traceHorizon, horizonAt, horizonUnc } from '../../web/horizon.js';
import { nodeEphemeris } from '../../tests/load_ephem.mjs';
const R = (f) => { const b = readFileSync(new URL(`../../data/raw/${f}`, import.meta.url)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const pg = (f) => polarGrid({ data: R(`pgda/${f}.IMG`), n: 5058, cellM: 60, maxLat: -82.9, id: f });
const refE = pg('AVGVISIB_85S_060M_201608_EARTH'), K = 0.00004 / 0.5;
const p40 = polarGrid({ data: R('lola/ldem_85s_40m.img'), n: 7584, cellM: 40, maxLat: -85, id: 'p40' });
const p240 = polarGrid({ data: R('lola/ldem_75s_240m.img'), n: 3812, cellM: 240, maxLat: -75, id: 'p240' });
const g16 = globalGrid({ data: R('lola/ldem_16.img'), ppd: 16, id: 'g16' });
const terrain = stack([p40, p240, g16]);
const levels = JSON.parse(readFileSync(new URL('../../web/data/uncertainty.json', import.meta.url))).levels_m;
const lat0 = -86.5, lon0 = 135, D2R = Math.PI / 180;
// reference map in the neighbourhood
const dl = (m) => m / R_MOON_M / D2R;
for (const r of [60, 120, 240, 480]) { const v = []; for (let a = 0; a < 360; a += 30) v.push(refE.sample(lat0 + dl(r) * Math.cos(a * D2R), lon0 + dl(r) * Math.sin(a * D2R) / Math.cos(lat0 * D2R)) * K); console.log(`ref Earth visibility on a ${r} m ring: min ${Math.min(...v).toFixed(3)} max ${Math.max(...v).toFixed(3)}`); }
console.log('ref at point', (refE.sample(lat0, lon0) * K).toFixed(3));
const eph = nodeEphemeris(), t0 = Date.UTC(2020, 0, 1), t1 = t0 + 18.6 * 365.25 * 86400e3; await eph.ensure(t0, t1);
function vis(lat, lon, eye, shift = 0, useU = 0) {
  const h = traceHorizon(terrain, lat, lon, { eyeM: eye }); h.unc = horizonUnc(h, levels);
  const site = { lat, lon, hM: h.groundM + eye }; let e1 = 0, n = 0, azs = [], els = [];
  for (let t = t0; t < t1; t += 6 * 3600e3, n++) { const e = eph.topo(site, 'earth', t); const i = Math.round(e.az * 2) % 720; if (e.el + e.radiusDeg > horizonAt(h, e.az) + shift + useU * h.unc[i]) e1++; azs.push(e.az); els.push(e.el); }
  return { v: e1 / n, h, azs, els };
}
const base = vis(lat0, lon0, 0.5);
const azMin = Math.min(...base.azs), azMax = Math.max(...base.azs);
console.log('ours', base.v.toFixed(3), 'Earth az', azMin.toFixed(1), azMax.toFixed(1), 'el', Math.min(...base.els).toFixed(2), Math.max(...base.els).toFixed(2));
for (let a = Math.floor(azMin); a <= azMax + 1; a += 2) { const i = (a * 2) % 720; console.log(' az', a, 'horizon', base.h.elev[i], 'dist m', base.h.dist[i], 'cell', base.h.cell[i], 'unc', base.h.unc[i].toFixed(3)); }
for (const s of [-0.5, -0.2, 0.2, 0.5, 1.0]) console.log('horizon shift', s, '->', vis(lat0, lon0, 0.5, s).v.toFixed(3));
console.log('with terrain +u', vis(lat0, lon0, 0.5, 0, 1).v.toFixed(3), '-u', vis(lat0, lon0, 0.5, 0, -1).v.toFixed(3));
for (const r of [120, 240]) for (let a = 0; a < 360; a += 90) console.log(`ours ${r} m toward ${a}:`, vis(lat0 + dl(r) * Math.cos(a * D2R), lon0 + dl(r) * Math.sin(a * D2R) / Math.cos(lat0 * D2R), 0.5).v.toFixed(3));
