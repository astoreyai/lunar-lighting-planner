// The combined landing layer, mission first: for every cell of a map window, the longest stretch in a look-ahead
// span during which the ground is usable (sunlight, and Earth in view if the mission needs it), whether that
// stretch holds the mission, whether the ground is flat enough over a whole landing footprint, and whether the
// answer changes inside the terrain's uncertainty. It then groups the good ground into candidate landing areas.
// Imported with this module's own ?v= query, as in shadow.js: the workers load this file too.
const v = new URL(import.meta.url).search, { shadowContext, visCells, slopeDeg } = await import(`./shadow.js${v}`), { R_MOON_M } = await import(`./dem.js${v}`);

// Per cell and terrain variant (0 as mapped, 1 raised by its uncertainty, 2 lowered): the current and the longest
// run of usable samples, in samples. `start` is the sample at which the longest run on the terrain as mapped began.
// `need` = samples a mission spans. Samples must be added in time order. `fromStart`: only a run that begins at the
// first sample counts, so the layer answers for a landing at that moment instead of the best window in the span.
export function createSuit(w, h, need, fromStart = false) {
  const cur = [0, 1, 2].map(() => new Uint16Array(w * h)), best = [0, 1, 2].map(() => new Uint16Array(w * h));
  const start = new Uint16Array(w * h);
  return {
    w, h, need, best, start,
    add(k, sun, earth) { // sun, earth: visPass outputs for sample k; earth null when the mission does not need it
      const [c0, c1, c2] = cur, [b0, b1, b2] = best, N = w * h;
      for (let i = 0; i < N; i++) {
        const u = earth ? sun[i] & earth[i] : sun[i];
        if (u === 0) { if (!fromStart) { c0[i] = 0; c1[i] = 0; c2[i] = 0; } continue; } // most cells at most samples: dark on every variant
        if (u & 1 && (!fromStart || c0[i] === k)) { if (++c0[i] > b0[i]) { b0[i] = c0[i]; start[i] = k - c0[i] + 1; } } else if (!fromStart) c0[i] = 0;
        if (u & 2 && (!fromStart || c1[i] === k)) { if (++c1[i] > b1[i]) b1[i] = c1[i]; } else if (!fromStart) c1[i] = 0;
        if (u & 4 && (!fromStart || c2[i] === k)) { if (++c2[i] > b2[i]) b2[i] = c2[i]; } else if (!fromStart) c2[i] = 0;
      }
    },
    // After add(k) in fromStart mode: which cells still have a run going on any terrain variant (the rest are settled).
    alive(k, out) { let any = 0; for (let i = 0; i < w * h; i++) any |= out[i] = cur[0][i] > k || cur[1][i] > k || cur[2][i] > k ? 1 : 0; return any; },
    // 0 never usable, 1 usable but for less than the mission, 2 holds the mission
    cls(i, v = 0) { const b = best[v][i]; return b === 0 ? 0 : b >= need ? 2 : 1; },
    close(i) { return this.cls(i, 1) !== this.cls(i, 2); },
  };
}

// For each cell of a window of the `map` grid (rows r0.., cols c0.., w x h), the index of the nearest cell of the
// `fine` grid, or -1 off it. Both are south-polar stereographic with the pole at the centre. With map === fine this is
// the window itself; with the 1.2 km map grid over the 240 m terrain it is a point sample every 1.2 km.
export function mapCells(map, fine, r0, c0, w, h) {
  const k = map.cellM / fine.cellM, om = (map.n - 1) / 2, of = (fine.n - 1) / 2, cells = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.round(of + (r0 + y - om) * k), c = Math.round(of + (c0 + x - om) * k);
    cells[y * w + x] = r < 1 || c < 1 || r >= fine.n - 1 || c >= fine.n - 1 ? -1 : r * fine.n + c;
  }
  return cells;
}

// Sharing a list between W workers: worker w takes every W-th item from w on, so each gets the same mix of cheap and
// costly ground (contiguous bands left the workers at the map's top and bottom with much less to do, and every
// time step waits for the slowest). putShare puts a worker's results back in place.
export const shareOf = (a, w, W) => { const out = new a.constructor(Math.ceil((a.length - w) / W)); for (let j = 0, i = w; i < a.length; i += W) out[j++] = a[i]; return out; };
export const putShare = (out, part, w, W) => { for (let j = 0, i = w; j < part.length; i += W) out[i] = part[j++]; };

// RGBA image, statistics and candidate landing areas. grid: the terrain { z, n, cellM } (or a window of it, as in
// shadow.js); cells: mapCells() for the
// w x h image; spacingM: distance between neighbouring image cells. slopeMax: degrees. padM: radius of the landing
// footprint; ground counts as a landing area only if every image cell within padM of it is good (holds the mission,
// not steep, not a close call). centre: [y, x] of the selected place in the image.
export function suitImage(suit, grid, cells, { spacingM, slopeMax, padM, centre, maxAreas = 6 }) {
  const { w, h, need } = suit, N = w * h, px = new Uint8ClampedArray(N * 4), good = new Uint8Array(N), pad = new Uint8Array(N);
  const { z, n, cellM, r0: gr = 0, c0: gc = 0, full = n } = grid, off = (full - 1) / 2, minRho = 2 * R_MOON_M * Math.tan((15 * Math.PI) / 360), rel = new Float32Array(N), state = new Uint8Array(N);
  const count = { inside: 0, full: 0, short: 0, none: 0, steep: 0, close: 0, good: 0, pad: 0 }, q = Math.max(1, Math.round(spacingM / cellM)); // q: relief across neighbouring image cells
  for (let i = 0; i < N; i++) {
    const j = cells[i], r = Math.floor(j / n), c = j % n;
    if (j < 0 || Math.hypot((c + gc - off) * cellM, (off - r - gr) * cellM) > minRho) continue; // off the grid, or north of 75S
    count.inside++;
    const k = suit.cls(i), steep = slopeDeg(grid, r, c) > slopeMax, close = suit.close(i);
    const zx = c >= q && c < n - q ? (z[j + q] - z[j - q]) * 0.25 / (q * cellM) : 0, zy = r >= q && r < n - q ? (z[j - q * n] - z[j + q * n]) * 0.25 / (q * cellM) : 0;
    rel[i] = 0.55 + 0.45 * Math.max(0, (zx * 0.5 - zy * 0.5 + 0.7071) / Math.hypot(zx, zy, 1)); // fixed light from the upper left: relief only
    count[k === 2 ? 'full' : k === 1 ? 'short' : 'none']++;
    if (steep) count.steep++;
    if (close) count.close++;
    if (k === 2 && !steep && !close) { good[i] = 1; count.good++; }
    state[i] = 1 + k + (steep ? 4 : 0) + (close ? 8 : 0);
  }
  // Landing areas: good ground whose whole footprint (a disc of radius padM) is good.
  const R = Math.max(1, Math.round(padM / spacingM)), disc = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) disc.push([dy, dx]);
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const i = y * w + x;
    if (!good[i]) continue;
    let all = true;
    for (const [dy, dx] of disc) if (!good[i + dy * w + dx]) { all = false; break; }
    if (all) { pad[i] = 1; count.pad++; }
  }
  // Connected landing areas (edge-sharing cells), each represented by its cell with the longest window, nearest its centroid on a tie.
  const seen = new Uint8Array(N), areas = [], stack = [];
  for (let s = 0; s < N; s++) {
    if (!pad[s] || seen[s]) continue;
    const members = []; seen[s] = 1; stack.push(s);
    while (stack.length) {
      const i = stack.pop(), x = i % w; members.push(i);
      for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) if (j >= 0 && j < N && pad[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    let sy = 0, sx = 0; for (const i of members) { sy += Math.floor(i / w); sx += i % w; }
    const cy = sy / members.length, cx = sx / members.length; let rep = members[0], repD = Infinity;
    for (const i of members) { const d = Math.hypot(Math.floor(i / w) - cy, (i % w) - cx) - suit.best[0][i] * 1e3; if (d < repD) { repD = d; rep = i; } }
    const ry = Math.floor(rep / w), rx = rep % w;
    areas.push({ y: ry, x: rx, cells: members.length, areaKm2: (members.length * spacingM * spacingM) / 1e6, best: suit.best[0][rep], start: suit.start[rep], distM: Math.hypot(ry - centre[0], rx - centre[1]) * spacingM });
  }
  areas.sort((a, b) => b.cells - a.cells);
  // Listed: the largest areas, and always the one nearest the selected place (it takes the last slot if it is not among them).
  const top = areas.slice(0, maxAreas), nearest = areas.reduce((m, a) => (!m || a.distM < m.distM ? a : m), null);
  if (nearest) { nearest.nearest = true; if (!top.includes(nearest)) top[top.length - 1] = nearest; }
  for (let i = 0; i < N; i++) {
    const s = state[i]; if (!s) continue;
    const k = (s - 1) & 3, y = Math.floor(i / w), x = i % w, o = 4 * i;
    let col = k === 2 ? (pad[i] ? [150, 245, 185] : [84, 170, 120]) : k === 1 ? (() => { const f = Math.min(1, suit.best[0][i] / need); return [120 + 110 * f, 80 + 85 * f, 30]; })() : [42, 46, 66];
    if (s - 1 & 4 && (x + y) % 4 < 2) col = [200, 70, 80];          // too steep: red diagonal stripes
    if (s - 1 & 8 && x % 3 === 0 && y % 3 === 0) col = [255, 255, 255]; // too close to call: white dots
    px[o] = col[0] * rel[i]; px[o + 1] = col[1] * rel[i]; px[o + 2] = col[2] * rel[i]; px[o + 3] = 255;
  }
  return { px, w, h, count, areas: top, areasTotal: areas.length };
}

// Run the layer over [t0, t0 + spanMs] in time order, for the cells of mapCells(). `bodies(t)` -> { sun, earth } km vectors.
// `onStep(done, total, suit)` may return false to stop early; `pause` yields between samples so a page stays responsive.
// `pass(bodies, only)`, if given, resolves to one sample's { sun, earth } visibility arrays computed elsewhere (the
// page's workers), skipping cells where `only` is 0; otherwise they are computed here. `far`: { grid, dhM }, the coarser terrain beyond a window (shadow.js).
// `fromStart`: as in createSuit, with t0 the landing.
export async function buildSuit({ grid, cells, w, h, t0, spanMs, stepMs, durMs, needEarth, dhM, far = null, fromStart = false, bodies, onStep, pause = () => Promise.resolve(), pass }) {
  const n = Math.max(1, Math.round(spanMs / stepMs)), suit = createSuit(w, h, Math.ceil(durMs / stepMs) + 1, fromStart);
  const sun = new Uint8Array(w * h), earth = new Uint8Array(w * h);
  const alive = fromStart ? new Uint8Array(w * h).fill(1) : null; // from a landing, a cell that has lost the Sun or Earth needs no more marching
  pass ||= async (b, only) => {
    visCells(shadowContext(grid, b.sun, { dhM, far }), cells, sun, only);
    if (needEarth) visCells(shadowContext(grid, b.earth, { radiusKm: 0, near: true, dhM, far }), cells, earth, sun); // only where the Sun is or might be up
    return { sun, earth };
  };
  for (let k = 0; k <= n; k++) {
    const v = await pass(bodies(t0 + k * stepMs), alive);
    suit.add(k, v.sun, needEarth ? v.earth : null);
    if (onStep && onStep(k + 1, n + 1, suit) === false) return null;
    if (alive && !suit.alive(k, alive)) break; // every cell is settled
    await pause();
  }
  return suit;
}

// The same layer from W workers, each running every time step for its own share of the cells (shareOf) and keeping
// its own runs: nothing waits on the page between steps, which with per-step hand-back cost about a third of the
// time on 8 workers. `ports`: one { post(message), on(handler) } per worker running web/suit-worker.js, each already
// holding the terrain. `onStep(done, total, suit)` is called as the shares report (every `every` steps), with the
// slowest share's step and the layer merged so far; returning false stops the workers. Resolves to the merged
// suit, or null if stopped.
let runSeq = 0;
export function buildSuitShared(ports, { cells, w, h, t0, spanMs, stepMs, durMs, needEarth, dhM, fromStart = false, bodies, onStep, every = 12 }) {
  const W = ports.length, n = Math.max(1, Math.round(spanMs / stepMs)), suit = createSuit(w, h, Math.ceil(durMs / stepMs) + 1, fromStart);
  const id = ++runSeq, done = new Array(W).fill(0), list = Array.from({ length: n + 1 }, (_, k) => bodies(t0 + k * stepMs));
  return new Promise((resolve) => {
    let finals = 0, shown = 0;
    ports.forEach((p, i) => {
      p.on((d) => {
        if (d.id !== id) return; // a report from an earlier run
        for (let k = 0; k < 3; k++) putShare(suit.best[k], d.best[k], i, W);
        putShare(suit.start, d.start, i, W); done[i] = d.done;
        if (d.final) { if (++finals === W) resolve(suit); return; }
        const m = Math.min(...done);
        if (onStep && m > shown) { shown = m; if (onStep(m, n + 1, suit) === false) { ports.forEach((x) => x.post({ stop: true })); resolve(null); } }
      });
      p.post({ id, cells: shareOf(cells, i, W), run: { t0, spanMs, stepMs, durMs, needEarth, dhM, fromStart }, bodies: list, every });
    });
  });
}
