// Real data: the lit-terrain shadow march must agree with the horizon tracer on the same terrain grid.
// Criteria fixed before the first run: >= 95% agreement over (point, time) pairs, and every disagreement
// within 0.5 deg of the threshold (|Sun upper-limb margin over the traced horizon| < 0.5 deg).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raw } from './load_lola.mjs';
import { polarGrid, globalGrid, stack, R_MOON_M } from '../web/dem.js';
import { traceHorizon } from '../web/horizon.js';
import { sample } from '../web/windows.js';
import { shadowContext, litCell, litImage } from '../web/shadow.js';
import { nodeEphemeris } from './load_ephem.mjs';
import { LATTICE } from './lattice.mjs';

const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url)));
const load = (m) => { const b = readFileSync(new URL(`../web/data/${m.file}`, import.meta.url)); return { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: m.n, cellM: m.cellM }; };
const D2R = Math.PI / 180;
// The map's two grids: the whole-pole view (1.2 km) and the 96 km site view (240 m). The tracer samples finer than the march on both.
const GRIDS = { 'pole view, 1.2 km grid': [meta.polarmap, 200, 400], 'site view, 240 m grid': [meta.polar240, 100, 200] };

for (const [label, [m, nearStepM, farStepM]] of Object.entries(GRIDS)) test(`shadow march agrees with the horizon tracer on the same grid: ${label}`, async () => {
  const grid = load(m), off = (grid.n - 1) / 2;
  const terrain = stack([polarGrid({ data: grid.z, n: grid.n, cellM: grid.cellM, maxLat: -75, id: 'map' }), globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'g16' })]);
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 0, 1), times = Array.from({ length: 100 }, (_, k) => t0 + k * 7 * 3600e3);
  await eph.ensure(t0, times.at(-1) + 3600e3);
  const pts = LATTICE.map(([lat, lon]) => {
    const rho = 2 * R_MOON_M * Math.tan((90 + lat) * D2R / 2);
    const r = Math.round(off - rho * Math.cos(lon * D2R) / grid.cellM), c = Math.round(off + rho * Math.sin(lon * D2R) / grid.cellM);
    const x = (c - off) * grid.cellM, y = (off - r) * grid.cellM; // the cell centre the shadow march uses
    const plat = (2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON_M))) / D2R - 90, plon = Math.atan2(x, y) / D2R;
    // Same start convention as the march (terrain from half a cell out counts); the tracer keeps its own finer steps.
    const h = traceHorizon(terrain, plat, plon, { eyeM: 0, startM: grid.cellM / 2, nearStepM, farStepM });
    return { r, c, site: { lat: plat, lon: plon, hM: h.groundM }, h };
  });
  let agree = 0, n = 0, worstMargin = 0;
  for (const t of times) {
    const ctx = shadowContext(grid, eph.bodyVec('sun', t));
    for (const p of pts) {
      const lit = litCell(ctx, p.r, p.c).lit, m = sample(eph, p.site, p.h, t).sunMargin;
      n++;
      if (lit === m > 0) agree++; else worstMargin = Math.max(worstMargin, Math.abs(m));
    }
  }
  console.log(`${label}: agreement ${(100 * agree / n).toFixed(1)}% of ${n}; worst disagreeing margin ${worstMargin.toFixed(3)} deg`);
  assert.ok(agree / n >= 0.95 && worstMargin < 0.5);
  if (grid.n > 1000) return; // the app draws 400x400 windows of the 240 m grid, never the whole grid
  const ctx = shadowContext(grid, eph.bodyVec('sun', t0)), s = performance.now();
  const img = litImage(ctx);
  console.log(`${label}: full grid ${grid.n}x${grid.n} ${Math.round(performance.now() - s)} ms, lit ${(100 * img.litFraction).toFixed(1)}%`);
});
