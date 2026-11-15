// How much the landing layer and the verdict move with their own resolution (not a test: run with
// `node tests/precision_sweep.mjs`). Real data throughout. Three questions:
//   1. time step: does sampling every 4 hours give the classes and window lengths that every hour gives?
//   2. map level: does the 240 m view give the class the 40 m close-up gives at the same point?
//   3. verdict: how far is the hourly "first loss" from the loss found by a one-minute search?
import { readFileSync } from 'node:fs';
import { buildSuit, suitImage, mapCells } from '../web/suit.js';
import { tileWindow } from '../web/dem.js';
import { series, landingVerdict } from '../web/windows.js';
import { nodeEphemeris } from './load_ephem.mjs';
const W = (p) => new URL(`../web/data/${p}`, import.meta.url), J = (p) => JSON.parse(readFileSync(W(p)));
const meta = J('dem/meta.json'), levels = J('uncertainty.json').levels_m, i16 = (p) => { const b = readFileSync(W(p)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const fine = { z: i16(meta.polar240.file), n: meta.polar240.n, cellM: 240 }, T40 = meta.tiles40;
const eph = nodeEphemeris(), H = 3600e3, DAY = 24 * H, durMs = 10 * DAY, spanMs = 47 * DAY;
const bodies = (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) });
const pct = (a, b) => `${(100 * a / b).toFixed(1)}%`, q = (xs, p) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const PLACES = [['IM-2 area', 1318, 2218, Date.UTC(2027, 2, 7, 16)], ['Shackleton rim', 1846, 1846, Date.UTC(2027, 9, 28)], ['Malapert area', 2300, 2100, Date.UTC(2027, 9, 28)]]; // 240 m rows and columns of a window's corner

console.log('1. Time step: 4 hours against 1 hour (240 m terrain, 120 x 120 cells, 47 days, 10-day mission, Earth required)');
for (const [name, r0, c0, t0] of PLACES) {
  await eph.ensure(t0, t0 + spanMs + H);
  const cells = mapCells(fine, fine, r0, c0, 120, 120), run = (stepMs) => buildSuit({ grid: fine, cells, w: 120, h: 120, t0, spanMs, stepMs, durMs, needEarth: true, dhM: levels[240], bodies });
  const a = await run(4 * H), b = await run(H);
  let same = 0, firm = 0, firmSame = 0; const dLen = [], dStart = [];
  for (let i = 0; i < cells.length; i++) {
    const eq = a.cls(i) === b.cls(i); if (eq) same++;
    if (!a.close(i)) { firm++; if (eq) firmSame++; }
    if (a.best[0][i] && b.best[0][i]) { dLen.push(Math.abs((a.best[0][i] - 1) * 4 - (b.best[0][i] - 1))); dStart.push(Math.abs(a.start[i] * 4 - b.start[i])); }
  }
  console.log(`  ${name}: same class ${pct(same, cells.length)} of cells, ${pct(firmSame, firm)} of the ${pct(firm, cells.length)} not flagged close; longest window differs by median ${q(dLen, 0.5)} h, 90th percentile ${q(dLen, 0.9)} h, worst ${q(dLen, 1)} h; its opening by median ${q(dStart, 0.5)} h, 90th percentile ${q(dStart, 0.9)} h`);
}

console.log('2. Map level: the 240 m view against the 40 m close-up at the same points (16 km window, 4-hour step)');
const tile40 = (k) => i16(`${T40.dir}/${k}.i16`);
for (const [name, r240, c240, t0] of [['IM-2', 1345, 2245, Date.UTC(2027, 2, 7, 16)], ['Shackleton rim', 1873, 1873, Date.UTC(2027, 9, 28)]]) {
  await eph.ensure(t0, t0 + spanMs + H);
  const n = 66, cA = mapCells(fine, fine, r240, c240, n, n), off40 = (T40.n - 1) / 2, off240 = (fine.n - 1) / 2; // 66 cells of 240 m: 16 km
  const R = (r) => Math.round(off40 + (r - off240) * 6), R0 = Math.min(Math.max(R(r240) - 200, 0), T40.n - 800), C0 = Math.min(Math.max(R(c240) - 200, 0), T40.n - 800);
  const near = await tileWindow(T40, R0, C0, 800, tile40), cB = new Int32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = R(r240 + y) - R0, c = R(c240 + x) - C0; cB[y * n + x] = r < 1 || c < 1 || r >= 799 || c >= 799 ? -1 : r * 800 + c; }
  const o = { w: n, h: n, t0, spanMs, stepMs: 4 * H, durMs, needEarth: true, bodies };
  const a = await buildSuit({ ...o, grid: fine, cells: cA, dhM: levels[240] }), b = await buildSuit({ ...o, grid: near, far: { grid: fine, dhM: levels[240] }, cells: cB, dhM: levels[40] });
  let m = 0, same = 0, firm = 0, firmSame = 0;
  for (let i = 0; i < n * n; i++) { if (cB[i] < 0) continue; m++; const eq = a.cls(i) === b.cls(i); if (eq) same++; if (!a.close(i) && !b.close(i)) { firm++; if (eq) firmSame++; } }
  console.log(`  ${name}: same class at ${pct(same, m)} of ${m} points, ${pct(firmSame, firm)} of the ${pct(firm, m)} that neither level flags close`);
}

console.log('3. Verdict: first loss against a one-minute search (polar catalogue sites, landings every 6 hours for 60 days from 2027-03-01)');
const sites = J('sites.json').sites.filter((s) => s.lat_deg <= -75), req = { minShare: 0, earth: true }, T0 = Date.UTC(2027, 2, 1), late = [], interp = [];
await eph.ensure(T0, T0 + 75 * DAY);
for (const s of sites) {
  const horizon = J(s.horizon), site = { lat: s.lat_deg, lon: s.lon_deg, hM: horizon.groundM + 2 };
  for (let t = T0; t < T0 + 60 * DAY; t += 6 * H) {
    const v = landingVerdict(series(eph, site, horizon, t, t + 11 * DAY, H), 0, 240, req);
    if (v?.verdict !== 'short') continue;
    const hour = Math.ceil(v.lostMs / H) * H, key = v.reason === 'power' ? 'sunMargin' : 'earthMargin'; // the first failing hourly sample, which the verdict used to report
    const min = series(eph, site, horizon, t + hour - H, t + hour, 60e3).find((r) => r[key] <= 0);
    late.push((t + hour - min.t) / 60e3); interp.push(Math.abs(t + v.lostMs - min.t) / 60e3);
  }
}
console.log(`  ${late.length} cut-short landings at ${sites.length} sites: the first failing hourly sample is late by a mean of ${(late.reduce((a, b) => a + b, 0) / late.length).toFixed(0)} min, median ${q(late, 0.5)} min, worst ${q(late, 1)} min`);
console.log(`  the verdict's loss time, interpolated between the two hourly samples around the loss, is off by a median of ${q(interp, 0.5).toFixed(1)} min, 90th percentile ${q(interp, 0.9).toFixed(1)} min, worst ${q(interp, 1).toFixed(1)} min`);

console.log('4. Cost of drawing a preview of the layer (suitImage, wall ms on this machine)');
{
  const t0 = Date.UTC(2027, 9, 28), map = { z: i16(meta.polarmap.file), n: meta.polarmap.n, cellM: meta.polarmap.cellM };
  await eph.ensure(t0, t0 + 2 * DAY);
  for (const [name, g, size, r0, c0] of [['whole pole 762 x 762', map, map.n, 0, 0], ['site window 400 x 400', fine, 400, 2300, 2100]]) {
    const cells = mapCells(g, fine, r0, c0, size, size), suit = await buildSuit({ grid: fine, cells, w: size, h: size, t0, spanMs: DAY, stepMs: 4 * H, durMs: DAY / 2, needEarth: true, dhM: levels[240], bodies });
    const s = performance.now(); for (let k = 0; k < 5; k++) suitImage(suit, fine, cells, { spacingM: g.cellM, slopeMax: 10, padM: 500, centre: [size / 2, size / 2] });
    console.log(`  ${name}: ${((performance.now() - s) / 5).toFixed(0)} ms`);
  }
}
