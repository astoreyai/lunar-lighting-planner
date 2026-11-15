// Wall time of the landing layer across worker counts (not a test: run with `node tests/bench_workers.mjs`).
// It drives the page's own worker code (web/suit-worker.js, through buildSuitShared) from Node threads, on the
// whole-pole view: 47 days at 4-hour steps, Sun and Earth. Each time includes copying the terrain to the workers.
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { buildSuit, buildSuitShared, mapCells } from '../web/suit.js';
import { nodeEphemeris } from './load_ephem.mjs';
const meta = JSON.parse(readFileSync(new URL('../web/data/dem/meta.json', import.meta.url))), dhM = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m[240];
const load = (name) => { const m = meta[name], b = readFileSync(new URL(`../web/data/${m.file}`, import.meta.url)); return { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: m.n, cellM: m.cellM }; };
const eph = nodeEphemeris(), DAY = 86400e3, t0 = Date.UTC(2027, 9, 28), spanMs = 47 * DAY, stepMs = 4 * 3600e3, grid = load('polar240'), map = load('polarmap');
await eph.ensure(t0, t0 + spanMs + 3600e3);
const cells = mapCells(map, grid, 0, 0, map.n, map.n), bodies = (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) });
const o = { grid, cells, w: map.n, h: map.n, t0, spanMs, stepMs, durMs: 10 * DAY, needEarth: true, dhM, bodies }, sum = (suit) => { let n = 0; for (const v of suit.best[0]) n += v; return n; };
let s = performance.now();
const ref = sum(await buildSuit(o));
console.log(`serial, on one thread: ${((performance.now() - s) / 1000).toFixed(1)} s wall`);
for (const W of (process.argv[2] ? [+process.argv[2]] : [1, 2, 4, 6, 8, 12])) {
  const pool = Array.from({ length: W }, () => new Worker(new URL('./node_worker.mjs', import.meta.url)));
  pool.forEach((wk) => wk.postMessage({ terrain: { grid, far: null } }));
  s = performance.now();
  const suit = await buildSuitShared(pool.map((wk) => ({ post: (m) => wk.postMessage(m), on: (f) => { wk.removeAllListeners('message'); wk.on('message', f); } })), o);
  const wall = (performance.now() - s) / 1000;
  if (sum(suit) !== ref) throw new Error(`${W} workers gave a different layer`);
  console.log(`${W} worker${W > 1 ? 's' : ''}: ${wall.toFixed(1)} s wall`);
  await Promise.all(pool.map((wk) => wk.terminate()));
}
