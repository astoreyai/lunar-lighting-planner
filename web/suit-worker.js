// One worker of the landing layers: it runs every time step for its share of the map's cells and keeps their runs
// (web/suit.js, buildSuitShared). Workers do not see the page's import map, so the version query is carried over by hand.
// The handler is set before the import resolves: a message that arrives while a module worker is still awaiting is lost.
const suitJs = import(`./suit.js${new URL(import.meta.url).search}`);
let terrain = {}, current = 0; // { grid, far }, kept until the page sends another; the id of the run in progress
// A turn of the event loop between time steps, so a "stop" or a new run can get in (no timer: timers are clamped).
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
self.onmessage = async ({ data: d }) => {
  const { buildSuit } = await suitJs;
  if (d.terrain) { terrain = { grid: d.terrain.grid || terrain.grid, far: 'far' in d.terrain ? d.terrain.far : terrain.far }; return; }
  current = d.id ?? 0; // a stop carries no id: the run in progress ends at its next step
  if (d.stop) return;
  const { id, cells, every, run } = d;
  const report = (s, done, final) => { const best = s.best.map((a) => a.slice()), start = s.start.slice(); self.postMessage({ id, done, final, best, start }, [...best.map((a) => a.buffer), start.buffer]); };
  let at = 0;
  const suit = await buildSuit({ ...terrain, ...run, cells, w: cells.length, h: 1, bodies: (t) => d.bodies[Math.round((t - run.t0) / run.stepMs)], pause: tick,
    onStep: (done, total, s) => { if (current !== id) return false; at = done; if (done % every === 0 && done < total) report(s, done, false); return true; } });
  if (suit) report(suit, at, true);
};
