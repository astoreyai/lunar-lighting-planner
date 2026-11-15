// CPU time of the landing-area layer on the real grids (not a test: run with `node tests/bench_suit.mjs`).
// CPU seconds, not wall-clock, so a busy machine does not distort it much.
import { readFileSync } from 'node:fs';
import { buildSuit, suitImage, mapCells } from '../web/suit.js';
import { nodeEphemeris } from './load_ephem.mjs';
const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url)));
const levels = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m;
const load = (name) => { const m = meta[name], b = readFileSync(new URL(`../web/data/${m.file}`, import.meta.url)); return { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: m.n, cellM: m.cellM }; };
const eph = nodeEphemeris(), DAY = 86400e3, t0 = Date.UTC(2027, 9, 28), durMs = 10 * DAY, spanMs = 47 * DAY;
await eph.ensure(t0, t0 + spanMs + 3600e3);
const bodies = (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) });
const fine = load('polar240'), map = load('polarmap'), stepMs = 4 * 3600e3, dhM = levels[240];
// The two views of the page: the whole pole at points 1.2 km apart, and a 96 km window of every 240 m cell.
for (const [name, g, r0, c0, size] of [['whole pole', map, 0, 0, map.n], ['site window', fine, 2300, 2100, 400]]) {
  const cells = mapCells(g, fine, r0, c0, size, size), t = process.cpuUsage().user;
  const suit = await buildSuit({ grid: fine, cells, w: size, h: size, t0, spanMs, stepMs, durMs, needEarth: true, dhM, bodies });
  const img = suitImage(suit, fine, cells, { spacingM: g.cellM, slopeMax: 10, padM: 500, centre: [size / 2, size / 2] });
  console.log(name, `${size}x${size}`, `${((process.cpuUsage().user - t) / 1e6).toFixed(1)} CPU s`, JSON.stringify(img.count), 'areas', img.areasTotal, 'largest', img.areas[0]?.cells);
}
