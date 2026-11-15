// The combined landing layer (web/suit.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raw } from './load_lola.mjs';
import { polarGrid, globalGrid, stack, tileWindow, R_MOON_M } from '../web/dem.js';
import { traceHorizon } from '../web/horizon.js';
import { sample } from '../web/windows.js';
import { Worker } from 'node:worker_threads';
import { createSuit, buildSuit, buildSuitShared, suitImage, mapCells, shareOf, putShare } from '../web/suit.js';
import { shadowContext, visPass, visCells } from '../web/shadow.js';
import { nodeEphemeris } from './load_ephem.mjs';

test('longest usable run per cell, its start, classes and close calls (synthetic)', () => {
  const s = createSuit(4, 1, 3), all = new Uint8Array([7, 7, 7, 7]);
  // cell 0: usable at samples 1-4 (run of 4); cell 1: runs of 2 and 1; cell 2: never; cell 3: run of 3 only if the terrain is not raised
  const sun = [[0, 7, 0, 5], [7, 7, 0, 5], [7, 0, 0, 5], [7, 7, 0, 0], [7, 0, 0, 0]];
  sun.forEach((row, k) => s.add(k, new Uint8Array(row), all));
  assert.deepEqual([...s.best[0]], [4, 2, 0, 3]);
  assert.equal(s.start[0], 1);
  assert.deepEqual([0, 1, 2, 3].map((i) => s.cls(i)), [2, 1, 0, 2]);
  assert.deepEqual([0, 1, 2, 3].map((i) => s.close(i)), [false, false, false, true]); // raised: never usable; lowered: holds the mission
  const noEarth = createSuit(1, 1, 2); noEarth.add(0, new Uint8Array([7]), new Uint8Array([0])); noEarth.add(1, new Uint8Array([7]), new Uint8Array([0]));
  assert.equal(noEarth.cls(0), 0); // Sun up but Earth hidden throughout
});

test('landing areas: only ground whose whole footprint is good, grouped into connected areas (synthetic flat grid)', () => {
  const n = 40, z = new Int16Array(n * n); // flat, so nothing is steep
  for (let r = 0; r < n; r++) for (let c = 25; c < n; c++) z[r * n + c] = (c - 25) * 400; // a 200 m per cell ramp on the right: steep
  const grid = { z, n, cellM: 240 }, w = 30, h = 30, s = createSuit(w, h, 2), vis = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vis[y * w + x] = (x < 8 && y < 8) || (x >= 12 && x < 20 && y >= 12 && y < 22) ? 7 : 0; // two lit blocks
  s.add(0, vis, null); s.add(1, vis, null);
  const cells = mapCells(grid, grid, 5, 5, w, h), img = suitImage(s, grid, cells, { spacingM: 240, slopeMax: 10, padM: 480, centre: [15, 15] }); // footprint radius: 2 cells
  assert.equal(img.areas.length, 2);
  assert.deepEqual(img.areas.map((a) => a.cells), [(8 - 4) * (10 - 4), (8 - 4) * (8 - 4)]); // each block shrinks by the footprint radius on every side
  assert.equal(img.count.pad, 24 + 16);
  assert.deepEqual(img.areas.map((a) => !!a.nearest), [true, false]); // the selected place lies in the larger block
  const one = suitImage(s, grid, cells, { spacingM: 240, slopeMax: 10, padM: 480, centre: [3, 3], maxAreas: 1 });
  assert.deepEqual([one.areas.length, one.areas[0].cells, one.areas[0].nearest, one.areasTotal], [1, 16, true, 2]); // one slot: the nearest area takes it from the largest
  assert.ok(img.count.steep > 0 && img.count.good === 64 + 80);
});

// Criterion fixed before the first run: where the layer does not flag a close call, its class (holds the mission,
// usable but too short, never usable) matches the horizon tracer on the same grid and time samples for at least 90% of cells.
test('layer classes agree with the horizon tracer around IM-2 (real 240 m LOLA, 37 days from 2027-03-07, 10-day mission, Earth required)', async () => {
  const b = readFileSync(new URL('../web/data/dem/polar240.i16', import.meta.url)), grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: 3812, cellM: 240 };
  const levels = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m;
  const D2R = Math.PI / 180, off = (grid.n - 1) / 2, rho = 2 * R_MOON_M * Math.tan((90 - 84.7906) * D2R / 2), W = 48;
  const r0 = Math.round(off - rho * Math.cos(29.1957 * D2R) / 240) - W / 2, c0 = Math.round(off + rho * Math.sin(29.1957 * D2R) / 240) - W / 2;
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 2, 7, 16), stepMs = 4 * 3600e3, spanMs = 47 * 86400e3, durMs = 10 * 86400e3, n = Math.round(spanMs / stepMs);
  await eph.ensure(t0, t0 + spanMs + 3600e3);
  const suit = await buildSuit({ grid, cells: mapCells(grid, grid, r0, c0, W, W), w: W, h: W, t0, spanMs, stepMs, durMs, needEarth: true, dhM: levels[240], bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }) });
  const terrain = stack([polarGrid({ data: grid.z, n: grid.n, cellM: 240, maxLat: -75, id: 'p240' }), globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'g16' })]);
  let same = 0, firm = 0, close = 0, runOff = 0;
  for (let y = 4; y < W; y += 8) for (let x = 4; x < W; x += 8) {
    const i = y * W + x;
    if (suit.close(i)) { close++; continue; }
    const X = (c0 + x - off) * 240, Y = (off - (r0 + y)) * 240, lat = (2 * Math.atan(Math.hypot(X, Y) / (2 * R_MOON_M))) / D2R - 90, lon = Math.atan2(X, Y) / D2R;
    const h = traceHorizon(terrain, lat, lon, { eyeM: 0, startM: 120, nearStepM: 100, farStepM: 200 }), site = { lat, lon, hM: h.groundM };
    let cur = 0, best = 0;
    for (let k = 0; k <= n; k++) { const p = sample(eph, site, h, t0 + k * stepMs); cur = p.sunMargin > 0 && p.earthMargin > 0 ? cur + 1 : 0; best = Math.max(best, cur); }
    firm++;
    if ((best === 0 ? 0 : best >= suit.need ? 2 : 1) === suit.cls(i)) same++;
    runOff = Math.max(runOff, Math.abs(best - suit.best[0][i]));
  }
  const img = suitImage(suit, grid, mapCells(grid, grid, r0, c0, W, W), { spacingM: 240, slopeMax: 10, padM: 500, centre: [W / 2, W / 2] });
  console.log(`landing layer vs tracer: ${same}/${firm} firm cells agree; ${close} flagged too close to call; longest run differs by at most ${runOff} samples; window: ${JSON.stringify(img.count)}; areas ${img.areasTotal}`);
  assert.ok(firm >= 20 && same / firm >= 0.9);
  assert.equal(img.count.full + img.count.short + img.count.none, img.count.inside);
});

// The march jumps over blocks of terrain that cannot reach the ray. That must not change a single cell.
test('block-skipping march gives the same cells as marching every sample (real LOLA, both grids, Sun and Earth, with uncertainty)', async () => {
  const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))), levels = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m;
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 9, 28);
  await eph.ensure(t0, t0 + 31 * 86400e3);
  for (const [name, r0, c0, size] of [['polarmap', 0, 0, 762], ['polar240', 2300, 2100, 120], ['polar240', 1846, 1846, 120]]) {
    const m = meta[name], b = readFileSync(new URL(`../web/data/${m.file}`, import.meta.url)), grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: m.n, cellM: m.cellM };
    for (const day of [0, 5, 11, 19, 26]) for (const [body, o, dhM] of [['sun', {}, levels[Math.round(m.cellM)]], ['sun', {}, 0], ['earth', { radiusKm: 0, near: true }, levels[Math.round(m.cellM)]]]) { // dhM 0: the lit-terrain map
      const v = eph.bodyVec(body, t0 + day * 86400e3);
      const fast = visPass(shadowContext(grid, v, { ...o, dhM }), r0, c0, size, size), ref = visPass(shadowContext(grid, v, { ...o, dhM, skip: false }), r0, c0, size, size);
      let diff = 0; for (let i = 0; i < fast.length; i++) if (fast[i] !== ref[i]) diff++;
      assert.equal(diff, 0, `${name} ${body} day ${day} dh ${dhM}`);
    }
  }
});

// The whole-pole view analyses the 240 m terrain at the cell nearest each 1.2 km map cell.
test('map cells pick the nearest terrain cell: same window on one grid, within half a cell across grids (grid sizes as shipped)', () => {
  const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))), map = meta.polarmap, fine = meta.polar240;
  assert.deepEqual([...mapCells(fine, fine, 10, 20, 3, 2)], [10 * fine.n + 20, 10 * fine.n + 21, 10 * fine.n + 22, 11 * fine.n + 20, 11 * fine.n + 21, 11 * fine.n + 22]);
  assert.deepEqual([...mapCells(fine, fine, 0, 0, 2, 1)], [-1, -1]); // the grid's edge row has no neighbours for a slope
  const cells = mapCells(map, fine, 0, 0, map.n, map.n), om = (map.n - 1) / 2, of = (fine.n - 1) / 2;
  let worst = 0, off = 0;
  for (let y = 0; y < map.n; y++) for (let x = 0; x < map.n; x++) {
    const j = cells[y * map.n + x];
    if (j < 0) { off++; continue; }
    const r = Math.floor(j / fine.n), c = j % fine.n; // metres from the pole, in each grid
    worst = Math.max(worst, Math.abs((r - of) * fine.cellM - (y - om) * map.cellM), Math.abs((c - of) * fine.cellM - (x - om) * map.cellM));
  }
  assert.ok(worst <= fine.cellM / 2 + 1e-6, `worst offset ${worst} m`);
  assert.ok(off < 4 * map.n, `${off} map cells fall off the terrain grid`); // only the outermost ring
});

test('from-landing mode counts only the run that begins at the first sample (synthetic)', () => {
  const s = createSuit(4, 1, 3, true);
  // cell 0: usable throughout; cell 1: lost after two samples, back later; cell 2: not usable at landing, usable later; cell 3: holds only if the terrain is not raised
  [[7, 7, 0, 5], [7, 7, 7, 5], [7, 0, 7, 5], [7, 7, 7, 5]].forEach((row, k) => s.add(k, new Uint8Array(row), null));
  assert.deepEqual([...s.best[0]], [4, 2, 0, 4]);
  assert.deepEqual([0, 1, 2, 3].map((i) => s.cls(i)), [2, 1, 0, 2]);
  assert.deepEqual([0, 1, 2, 3].map((i) => s.close(i)), [false, false, false, true]);
});

const T40 = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))).tiles40;
const tile40 = (k) => { const b = readFileSync(new URL(`../web/data/${T40.dir}/${k}.i16`, import.meta.url)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };

test('a window assembled from the 40 m tiles equals the same window of the raw LOLA mosaic (real data, across tile edges and the narrow last tiles)', async () => {
  const z = raw('ldem_85s_40m.img'), N = T40.n;
  for (const [r0, c0, m] of [[300, 400, 700], [N - 600, N - 600, 600], [0, 7000, 584], [3500, 3500, 100]]) {
    const w = await tileWindow(T40, r0, c0, m, tile40);
    let diff = 0; for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) if (w.z[r * m + c] !== z[(r0 + r) * N + c0 + c]) diff++;
    assert.equal(diff, 0, `window ${r0},${c0} size ${m}`);
    assert.deepEqual([w.n, w.cellM, w.r0, w.c0, w.full], [m, 40, r0, c0, N]);
  }
});

// A window with a coarser grid taking the march over must lose nothing at the hand-over. When the window is cut from
// that same grid, the samples are the same ones, so every cell must come out identical.
test('march handed from a window to the grid around it gives the same cells as the whole grid (real 240 m LOLA, Sun and Earth, with uncertainty)', async () => {
  const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))).polar240, dhM = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m[240];
  const b = readFileSync(new URL(`../web/data/${meta.file}`, import.meta.url)), grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: meta.n, cellM: meta.cellM };
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 9, 28);
  await eph.ensure(t0, t0 + 31 * 86400e3);
  for (const [r0, c0, m, inner] of [[2280, 2080, 160, 120], [1826, 1826, 160, 120], [1900, 1700, 90, 80]]) {
    const win = { z: new Int16Array(m * m), n: m, cellM: grid.cellM, r0, c0, full: grid.n }, pad = (m - inner) / 2;
    for (let r = 0; r < m; r++) win.z.set(grid.z.subarray((r0 + r) * grid.n + c0, (r0 + r) * grid.n + c0 + m), r * m);
    for (const day of [0, 5, 11, 19, 26]) for (const [body, o] of [['sun', {}], ['earth', { radiusKm: 0, near: true }]]) {
      const v = eph.bodyVec(body, t0 + day * 86400e3);
      const two = visCells(shadowContext(win, v, { ...o, dhM, far: { grid, dhM } }), mapCells(win, win, pad, pad, inner, inner));
      const one = visPass(shadowContext(grid, v, { ...o, dhM }), r0 + pad, c0 + pad, inner, inner);
      let diff = 0; for (let i = 0; i < one.length; i++) if (two[i] !== one[i]) diff++;
      assert.equal(diff, 0, `window ${r0},${c0} ${body} day ${day}`);
    }
  }
});

// Criterion fixed before the first run, the same as for the 240 m layer: where the layer does not flag a close call,
// its class matches the horizon tracer (40 m, then 240 m, then the global grid) for at least 90% of cells.
test('40 m close-up layer agrees with the horizon tracer at two places (real 40 m LOLA tiles with 240 m beyond, 10-day mission, Earth required)', async () => {
  const levels = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m;
  const b = readFileSync(new URL('../web/data/dem/polar240.i16', import.meta.url)), far = { grid: { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: 3812, cellM: 240 }, dhM: levels[240] };
  const terrain = stack([polarGrid({ data: raw('ldem_85s_40m.img'), n: T40.n, cellM: 40, maxLat: -85, id: 'p40' }), polarGrid({ data: far.grid.z, n: 3812, cellM: 240, maxLat: -75, id: 'p240' }), globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'g16' })]);
  const D2R = Math.PI / 180, off = (T40.n - 1) / 2, W = 48, M = 200, eph = nodeEphemeris(), stepMs = 4 * 3600e3, spanMs = 47 * 86400e3, durMs = 10 * 86400e3, n = Math.round(spanMs / stepMs);
  for (const [name, lat0, lon0, t0] of [['IM-2', -84.7906, 29.1957, Date.UTC(2027, 2, 7, 16)], ['Shackleton rim', -89.78, -155.0, Date.UTC(2027, 9, 28)]]) {
    const rho = 2 * R_MOON_M * Math.tan((90 + lat0) * D2R / 2), r0 = Math.round(off - rho * Math.cos(lon0 * D2R) / 40) - W / 2, c0 = Math.round(off + rho * Math.sin(lon0 * D2R) / 40) - W / 2;
    const R0 = Math.min(Math.max(r0 - M, 0), T40.n - W - 2 * M), C0 = Math.min(Math.max(c0 - M, 0), T40.n - W - 2 * M), grid = await tileWindow(T40, R0, C0, W + 2 * M, tile40);
    await eph.ensure(t0, t0 + spanMs + 3600e3);
    const cells = mapCells(grid, grid, r0 - R0, c0 - C0, W, W);
    const suit = await buildSuit({ grid, far, cells, w: W, h: W, t0, spanMs, stepMs, durMs, needEarth: true, dhM: levels[40], bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }) });
    let same = 0, firm = 0, close = 0, runOff = 0;
    for (let y = 4; y < W; y += 8) for (let x = 4; x < W; x += 8) {
      const i = y * W + x;
      if (suit.close(i)) { close++; continue; }
      const X = (c0 + x - off) * 40, Y = (off - (r0 + y)) * 40, lat = (2 * Math.atan(Math.hypot(X, Y) / (2 * R_MOON_M))) / D2R - 90, lon = Math.atan2(X, Y) / D2R;
      const h = traceHorizon(terrain, lat, lon, { eyeM: 0, startM: 20, nearStepM: 20, farStepM: 120 }), site = { lat, lon, hM: h.groundM };
      let cur = 0, best = 0;
      for (let k = 0; k <= n; k++) { const p = sample(eph, site, h, t0 + k * stepMs); cur = p.sunMargin > 0 && p.earthMargin > 0 ? cur + 1 : 0; best = Math.max(best, cur); }
      firm++;
      if ((best === 0 ? 0 : best >= suit.need ? 2 : 1) === suit.cls(i)) same++;
      runOff = Math.max(runOff, Math.abs(best - suit.best[0][i]));
    }
    const img = suitImage(suit, grid, cells, { spacingM: 40, slopeMax: 10, padM: 500, centre: [W / 2, W / 2] });
    console.log(`40 m layer vs tracer, ${name}: ${same}/${firm} firm cells agree; ${close} flagged too close to call; longest run differs by at most ${runOff} samples; window: ${JSON.stringify(img.count)}`);
    assert.ok(firm >= 20 && same / firm >= 0.9, `${name}: ${same}/${firm}`);
    assert.equal(img.count.full + img.count.short + img.count.none, img.count.inside);
  }
});

test('sharing a list between workers and putting it back loses and moves nothing (synthetic)', () => {
  for (const [N, W] of [[10, 3], [9, 3], [1, 4], [0, 2], [1000, 7]]) {
    const a = Int32Array.from({ length: N }, (_, i) => i * 3 + 1), back = new Int32Array(N);
    const parts = Array.from({ length: W }, (_, w) => shareOf(a, w, W));
    assert.equal(parts.reduce((n, p) => n + p.length, 0), N);
    parts.forEach((p, w) => putShare(back, p, w, W));
    assert.deepEqual([...back], [...a], `${N} items, ${W} workers`);
  }
});

// The page's own worker file, run in Node threads (tests/node_worker.mjs). Each worker runs every time step for its
// share; the merged layer must be the serial one, cell for cell, on every terrain variant.
test('layer computed by three workers equals the serial layer exactly, in both modes, and can be stopped (real 240 m LOLA)', async () => {
  const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))).polar240, dhM = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m[240];
  const b = readFileSync(new URL(`../web/data/${meta.file}`, import.meta.url)), grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: meta.n, cellM: meta.cellM };
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 9, 28), W = 70, cells = mapCells(grid, grid, 1846, 1846, W, W);
  await eph.ensure(t0, t0 + 48 * 86400e3);
  const pool = Array.from({ length: 3 }, () => new Worker(new URL('./node_worker.mjs', import.meta.url)));
  const ports = pool.map((wk) => ({ post: (m) => wk.postMessage(m), on: (f) => { wk.removeAllListeners('message'); wk.on('message', f); } }));
  try {
    pool.forEach((wk) => wk.postMessage({ terrain: { grid, far: null } }));
    for (const fromStart of [false, true]) {
      const o = { stats: !fromStart, grid, cells, w: W, h: W, t0: fromStart ? t0 + 12 * 86400e3 : t0, spanMs: (fromStart ? 10 : 47) * 86400e3, stepMs: 4 * 3600e3, durMs: 10 * 86400e3, needEarth: true, dhM, fromStart, bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }) };
      const serial = await buildSuit(o), steps = [], shared = await buildSuitShared(ports, { ...o, onStep: (done) => { steps.push(done); return true; } });
      for (let v = 0; v < 3; v++) assert.deepEqual(shared.best[v], serial.best[v], `variant ${v}, fromStart ${fromStart}`);
      assert.deepEqual(shared.start, serial.start);
      serial.arrays().forEach((x, k) => assert.deepEqual(shared.arrays()[k], x, `array ${k}, fromStart ${fromStart}`)); // the statistics too
      assert.equal(shared.stats?.n, serial.stats?.n);
      assert.equal(!!serial.stats, !fromStart);
      let usable = 0; for (const x of serial.best[0]) if (x) usable++;
      assert.ok(usable > 100, `${usable} usable cells: the comparison is not empty`);
      if (!fromStart) assert.deepEqual(steps, steps.slice().sort((x, y) => x - y)), assert.ok(steps.length >= 10 && steps.every((x) => x % 12 === 0));
    }
    const stopped = await buildSuitShared(ports, { grid, cells, w: W, h: W, t0, spanMs: 47 * 86400e3, stepMs: 4 * 3600e3, durMs: 10 * 86400e3, needEarth: true, dhM, bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }), onStep: () => false });
    assert.equal(stopped, null);
  } finally { await Promise.all(pool.map((wk) => wk.terminate())); }
});

test('sunlight and Earth statistics per cell: shares, longest stretches, mean elevations (synthetic)', () => {
  const s = createSuit(2, 1, 2, false, true), S = Math.sin(Math.PI / 6); // sine of 30 degrees
  // cell 0: Sun on for samples 0-2, off 3-4, on 5; Earth always in view, 30 deg up. cell 1: Sun never; Earth out for samples 1-3.
  const sun = [[7, 0], [7, 0], [5, 0], [0, 0], [4, 0], [7, 0]], earth = [[7, 7], [7, 0], [7, 0], [7, 4], [7, 7], [7, 7]];
  sun.forEach((row, k) => s.add(k, new Uint8Array(row), null, new Uint8Array(earth[k]), new Float32Array([S, -0.2]), new Float32Array([S, 0.1])));
  const a = s.stat(0), b = s.stat(1);
  assert.deepEqual([a.sun, a.lit, a.dark, a.earth, a.contact, a.outage], [4 / 6, 3, 2, 1, 6, 0]); // 5 counts (visible as mapped), 4 does not
  assert.ok(Math.abs(a.sunEl - 30) < 1e-4 && Math.abs(a.earthEl - 30) < 1e-4 && Math.abs(a.flat - (4 / 6) * S) < 1e-6);
  assert.deepEqual([b.sun, b.lit, b.dark, b.sunEl, b.flat, b.earth, b.contact, b.outage], [0, 0, 6, null, 0, 3 / 6, 2, 3]);
  assert.deepEqual([...s.best[0]], [3, 0]); // the runs are untouched by the statistics
  assert.equal(createSuit(1, 1, 2).stats, null);
});
