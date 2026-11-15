// Terrain-horizon uncertainty from real cross-resolution comparisons (no synthetic data).
// For each grid the app traces horizons on, trace the catalogue sites on that grid alone and compare every ray with
// the same site's shipped horizon, which was traced on finer terrain. The difference, turned into a height at the
// range of the blocking terrain (tan(difference) x range), is that grid's height-equivalent error for that ray.
// web/data/uncertainty.json keeps the 90th percentile per grid, keyed by cell size in metres (rounded):
//   240   LDEM_75S_240M, against horizons traced on LDEM_85S_40M (sites the 40 m mosaic covers)
//   1895  LDEM_16 (16 px/deg), against horizons traced on the 240 m and 40 m polar grids (sites south of 75S)
//   7581  the 4 px/deg browser grid, against the same polar horizons
//   1201  the 1.2 km polar map grid (the whole-pole map view), against the same polar horizons
// The 40 m grid has no finer grid in this repository to be compared with; its level is taken from the 240 m
// comparison scaled by cell size (40/240), and build output reports that it is a scaled value, not a measured one.
import { readFileSync, writeFileSync } from 'node:fs';
import { polarGrid, globalGrid, stack } from '../web/dem.js';
import { traceRays } from '../web/horizon.js';

const root = new URL('../', import.meta.url);
const raw = (n) => { const b = readFileSync(new URL(`data/raw/lola/${n}`, root)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const web = (p) => new URL(`web/data/${p}`, root);
const i16 = (p) => { const b = readFileSync(web(p)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const p240 = polarGrid({ data: raw('ldem_75s_240m.img'), n: 3812, cellM: 240, maxLat: -75, id: 'LOLA 240 m (75S)' });
const g16 = globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'LOLA 16 px/deg global' });
const g4 = globalGrid({ data: i16('dem/global4.i16'), ppd: 4, id: 'LOLA 4 px/deg global' });
const pm = JSON.parse(readFileSync(web('dem/meta.json'))).polarmap;
const pmap = polarGrid({ data: i16('dem/polarmap.i16'), n: pm.n, cellM: pm.cellM, maxLat: -75, id: 'LOLA 1.2 km map grid' });
const sites = JSON.parse(readFileSync(web('sites.json'))).sites;
const az = Array.from({ length: 720 }, (_, k) => k / 2), D2R = Math.PI / 180;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function compare(terrain, keep, cellM) {
  const err = []; let n = 0;
  for (const s of sites.filter(keep)) {
    const fine = JSON.parse(readFileSync(web(s.horizon))), c = traceRays(terrain, s.lat_deg, s.lon_deg, az, { eyeM: 2 });
    n++;
    for (let i = 0; i < az.length; i++) if (Math.round(c.cell[i]) === cellM) err.push(Math.abs(Math.tan((fine.elev[i] - c.elev[i]) * D2R)) * c.dist[i]);
  }
  return { sites: n, rays: err.length, p50_m: +q(err, 0.5).toFixed(1), p68_m: +q(err, 0.68).toFixed(1), p90_m: +q(err, 0.9).toFixed(1), p95_m: +q(err, 0.95).toFixed(1) };
}
const in40 = (s) => s.lat_deg < -85 && s.horizon_grids.some((g) => g.includes('40 m')), polar = (s) => s.lat_deg <= -75;
const measured = {
  240: compare(stack([p240, g16]), in40, 240),
  [Math.round(g16.cellM)]: compare(stack([g16]), polar, Math.round(g16.cellM)),
  [Math.round(g4.cellM)]: compare(stack([g4]), polar, Math.round(g4.cellM)),
  [Math.round(pmap.cellM)]: compare(stack([pmap, g16]), polar, Math.round(pmap.cellM)),
};
const levels = Object.fromEntries(Object.entries(measured).map(([k, v]) => [k, v.p90_m]));
levels[40] = +(levels[240] * 40 / 240).toFixed(1);
writeFileSync(web('uncertainty.json'), `${JSON.stringify({
  method: 'Height-equivalent horizon error per ray: tan(|coarse - fine horizon|) x range to the blocking terrain, at catalogue sites; 90th percentile per grid. See pipeline/build_uncertainty.mjs.',
  levels_m: levels, measured, scaled: { 40: 'not measured: the 240 m level scaled by cell size (40/240)' },
}, null, 1)}\n`);
console.log(JSON.stringify({ levels, measured }, null, 1));
