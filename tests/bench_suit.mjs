// CPU time of the landing-area layer on the real grids (not a test: run with `node tests/bench_suit.mjs`).
// CPU seconds, not wall-clock, so a busy machine does not distort it much.
import { readFileSync } from 'node:fs';
import { buildSuit, suitImage, mapCells } from '../web/suit.js';
import { tileWindow } from '../web/dem.js';
import { nodeEphemeris } from './load_ephem.mjs';
const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url)));
const levels = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m;
const load = (name) => { const m = meta[name], b = readFileSync(new URL(`../web/data/${m.file}`, import.meta.url)); return { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: m.n, cellM: m.cellM }; };
const eph = nodeEphemeris(), DAY = 86400e3, t0 = Date.UTC(2027, 9, 28), durMs = 10 * DAY, spanMs = 47 * DAY;
await eph.ensure(t0, t0 + spanMs + 3600e3);
const bodies = (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) });
const fine = load('polar240'), map = load('polarmap'), stepMs = 4 * 3600e3, dhM = levels[240];
const T40 = meta.tiles40, tile40 = (k) => { const b = readFileSync(new URL(`../web/data/${T40.dir}/${k}.i16`, import.meta.url)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const near = await tileWindow(T40, 3500, 3337, 800, tile40); // the close-up around Shackleton's rim: a 16 km view with 8 km of 40 m terrain around it
// The page's views: the whole pole at points 1.2 km apart, a 96 km window of every 240 m cell, and a 16 km window of
// every 40 m cell with the 240 m terrain beyond. "land": the best window over 47 days; "left": from one landing, 10 days.
// Throughput is cell-samples (a cell at one time step, Sun and Earth) per CPU second.
const only = process.argv[2];
for (const [name, g, grid, far, r0, c0, size, left, stats] of [
  ['whole pole, land', map, fine, null, 0, 0, map.n, false], ['site window, land', fine, fine, null, 2300, 2100, 400, false], ['close-up, land', near, near, { grid: fine, dhM }, 200, 200, 400, false],
  ['site window, left', fine, fine, null, 2300, 2100, 400, true], ['close-up, left', near, near, { grid: fine, dhM }, 200, 200, 400, true],
  ['whole pole, land with statistics', map, fine, null, 0, 0, map.n, false, true], ['site window, land with statistics', fine, fine, null, 2300, 2100, 400, false, true]]) {
  if (only && name !== only) continue;
  const cells = mapCells(g, grid, r0, c0, size, size), span = left ? durMs : spanMs, t = process.cpuUsage().user;
  const suit = await buildSuit({ grid, far, cells, w: size, h: size, t0, spanMs: span, stepMs, durMs, needEarth: true, dhM: levels[Math.round(grid.cellM)], fromStart: left, stats, bodies });
  const cpu = (process.cpuUsage().user - t) / 1e6, img = suitImage(suit, grid, cells, { spacingM: g.cellM, slopeMax: 10, padM: 500, centre: [size / 2, size / 2] }), steps = Math.round(span / stepMs) + 1;
  console.log(`${name}: ${size}x${size}, ${steps} steps, ${cpu.toFixed(1)} CPU s, ${Math.round((img.count.inside * steps) / cpu / 1000)}k cell-samples/s`, JSON.stringify(img.count), 'areas', img.areasTotal);
}
