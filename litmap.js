// The lit-terrain map: the south pole (75-90 S) shaded by the real Sun at one instant, with cast shadows.
// "pole" view uses the 1.2 km grid; "site" view a 96 km window of the 240 m grid around a centre point; "close" view a
// 16 km window of the 40 m grid there (85-90 S only), with the 240 m grid supplying the terrain farther away.
import { R_MOON_M } from './dem.js';
import { shadowContext, litImage } from './shadow.js';
import { buildSuit, buildSuitShared, suitImage, mapCells } from './suit.js';
import { eph, data, loadGrid, loadWindow40, css, fmtUTC, setStatus } from './core.js';

const D2R = Math.PI / 180, ZOOM_CELLS = 400, CLOSE_MARGIN = 200; // close-up: 40 m terrain for 8 km around the view, 240 m terrain beyond
const toGrid = (g, lat, lon) => {
  const off = (g.n - 1) / 2, rho = 2 * R_MOON_M * Math.tan((90 + lat) * D2R / 2);
  return [off - (rho * Math.cos(lon * D2R)) / g.cellM, off + (rho * Math.sin(lon * D2R)) / g.cellM];
};
// Whether the 40 m terrain reaches a place (it is a square about 303 km across, centred on the pole).
export const hasClose = (lat, lon) => { const T = data.meta.tiles40, [r, c] = toGrid(T, lat, lon); return r >= 0 && c >= 0 && r <= T.n - 1 && c <= T.n - 1; };

export function createLitMap(canvas, { onPick, describe }) {
  const view = { zoom: 'pole', center: null, t: 0, markers: [], outlines: [], paths: [], frame: null, layer: 'sun', paint: 'class', sort: 'size', mission: null, onLand: null };
  let pending = false, busy = false, building = '', near = null; // near: the last close-up window of 40 m terrain { key, grid }
  const lands = new Map(); // finished landing layers by key (the last four): { key, suit, grid, cells, ... }
  // 'land' (the best window in the search span) does not depend on the landing time; 'left' (from this landing) only on it.
  // The whole-pole view does not depend on the selected place; the others are windows around it. What is painted
  // (classes or a statistic) and how the areas are sorted do not change the layer, so they are not in the key.
  const keyFor = (layer, zoom, center, m) => {
    const left = layer === 'left';
    return layer !== 'sun' && m ? JSON.stringify([layer, zoom, zoom !== 'pole' && center ? [center.lat.toFixed(3), center.lon.toFixed(3)] : 0, { ...m, padM: 0, slopeMax: 0, ...(left ? { t0: 0, spanMs: 0 } : { landT: 0 }) }]) : '';
  };
  const landKey = () => keyFor(view.layer, view.zoom, view.center, view.mission);

  const toLatLon = (g, r, c) => {
    const off = (g.n - 1) / 2, x = (c - off) * g.cellM, y = (off - r) * g.cellM;
    return [(2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON_M))) / D2R - 90, Math.atan2(x, y) / D2R];
  };
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // A view's geometry and terrain. g: the grid the view's rows and columns belong to; grid: the terrain analysed,
  // with `far` beyond it; (vr, vc): the view's corner in `grid`; whole: the whole-pole view.
  async function sceneFor(zoom, center) {
    const polar = center && center.lat <= -75, close = polar && zoom === 'close' && hasClose(center.lat, center.lon);
    const zoomed = polar && zoom !== 'pole' && !close; // 'close' where the 40 m terrain does not reach falls back to the 240 m view
    if ((zoomed || close) && !data.grids.polar240) setStatus('Loading 240 m south-polar terrain (29 MB, first time only)…');
    const g = close ? { n: data.meta.tiles40.n, cellM: data.meta.tiles40.cellM } : await loadGrid(zoomed ? 'polar240' : 'polarmap');
    let r0 = 0, c0 = 0, size = g.n, grid = { z: g.z, n: g.n, cellM: g.cellM }, far = null, vr = 0, vc = 0;
    if (zoomed || close) {
      const [r, c] = toGrid(g, center.lat, center.lon);
      size = ZOOM_CELLS;
      vr = r0 = clamp(Math.round(r - size / 2), 1, g.n - size - 1);
      vc = c0 = clamp(Math.round(c - size / 2), 1, g.n - size - 1);
    }
    if (close) {
      const m = size + 2 * CLOSE_MARGIN, R0 = clamp(r0 - CLOSE_MARGIN, 0, g.n - m), C0 = clamp(c0 - CLOSE_MARGIN, 0, g.n - m), key = `${R0},${C0}`;
      if (near?.key !== key) { setStatus('Loading 40 m terrain around this place…'); near = { key, grid: await loadWindow40(R0, C0, m) }; }
      const f = await loadGrid('polar240');
      grid = near.grid; far = { grid: { z: f.z, n: f.n, cellM: f.cellM }, dhM: 0 }; vr = r0 - R0; vc = c0 - C0;
    }
    return { g, r0, c0, size, grid, far, vr, vc, whole: !zoomed && !close, center };
  }

  async function draw() {
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const scene = await sceneFor(view.zoom, view.center);
      if (view.layer !== 'sun' && view.mission) { await drawLand(scene); return; }
      const { g, r0, c0, size, grid, far, vr, vc } = scene;
      await eph.ensure(view.t, view.t + HOUR_MS);
      const img = litImage(shadowContext(grid, eph.bodyVec('sun', view.t), { far }), vr, vc, size, size);
      view.frame = { g, r0, c0, size, litFraction: img.litFraction };
      const off = new OffscreenCanvasOr(img.w, img.h);
      off.ctx.putImageData(new ImageData(img.px, img.w, img.h), 0, 0);
      paint(off.canvas);
      setStatus('');
    } finally {
      busy = false;
      if (pending) { pending = false; draw(); }
    }
  }

  // Workers for the landing layers: each takes a share of the map's cells and holds its own copy of the 240 m terrain
  // (29 MB, plus 10 MB of block maxima). Up to 8 where the device reports 8 GB or more, 2 where it reports 4 GB or
  // less, 4 where it does not say (Safari, Firefox); always leaving a core for the page. In a benchmark of the
  // whole-pole layer, 4 workers took 18 s and 8 took 13 s; more gained nothing (tests/bench_workers.mjs).
  // Returns null where module workers are missing, and the page computes instead.
  let pool = null;
  function workerRun(grid, far, opts) {
    if (pool === false) return null;
    try {
      pool ||= Array.from({ length: Math.min(navigator.deviceMemory === undefined ? 4 : navigator.deviceMemory <= 4 ? 2 : 8, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)) }, () => new Worker(new URL(`./suit-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' }));
    } catch { pool = false; return null; }
    // Each worker keeps its copies of the terrain until they change.
    const t = { ...(pool.z === grid.z ? {} : { grid }), ...(far ? (pool.farZ === far.grid.z ? {} : { far }) : pool.farZ ? { far: null } : {}) };
    pool.z = grid.z; pool.farZ = far ? far.grid.z : null;
    if (t.grid || 'far' in t) pool.forEach((wk) => wk.postMessage({ terrain: t }));
    return new Promise((resolve, reject) => {
      pool.forEach((wk) => { wk.onerror = (e) => reject(new Error(`Landing-area worker failed: ${e.message || 'could not start'}`)); });
      buildSuitShared(pool.map((wk) => ({ post: (m) => wk.postMessage(m), on: (f) => { wk.onmessage = (e) => f(e.data); } })), opts).then(resolve, reject);
    });
  }

  // A landing layer for a view, built a time sample at a time or taken from the last few built: 'land' over the
  // whole search span (the best window at each cell, with the sunlight and Earth statistics), 'left' from the chosen
  // landing to the mission's end (whether that landing holds). The site view analyses every 240 m cell of its window,
  // the whole-pole view the 240 m cell nearest each 1.2 km map cell, the close-up every 40 m cell of its window with
  // the 240 m terrain beyond. `preview(L, done, total)` is called as it builds. Resolves to null if stopped.
  async function landFor(scene, m, layer, key, preview) {
    if (lands.has(key)) return lands.get(key);
    const { g, r0, c0, size, vr, vc } = scene, left = layer === 'left', stepMs = m.stepMs, t0 = left ? m.landT : m.t0, spanMs = left ? m.durMs : m.spanMs;
    // The whole-pole view arrives with the 1.2 km map grid: its analysis runs on the 240 m terrain instead.
    let grid = scene.grid, far = scene.far && { ...scene.far, dhM: data.unc[Math.round(scene.far.grid.cellM)] ?? 0 }, cells;
    if (scene.whole) {
      if (!data.grids.polar240) setStatus('Loading 240 m south-polar terrain (29 MB, first time only)…');
      const f = await loadGrid('polar240');
      grid = { z: f.z, n: f.n, cellM: f.cellM }; cells = mapCells(g, grid, r0, c0, size, size);
    } else cells = mapCells(grid, grid, vr, vc, size, size);
    await eph.ensure(t0, t0 + spanMs + HOUR_MS);
    setStatus('');
    building = key;
    const dhM = data.unc[Math.round(grid.cellM)] ?? 0, started = performance.now(), opts = {
      grid, far, cells, w: size, h: size, t0, spanMs, durMs: m.durMs, stepMs, needEarth: m.needEarth, dhM, fromStart: left, stats: !left,
      bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }),
      onStep: (done, total, suit) => { if (pending) return false; if (preview && done % 12 === 0 && done < total) preview({ suit, grid, cells, t0, spanMs, stepMs, left }, done, total); return true; },
    }, onPage = () => buildSuit({ ...opts, pause: () => new Promise((r) => setTimeout(r)) }); // no workers: the page computes, and breathes between steps
    let suit;
    try {
      const shared = workerRun(grid, far, opts);
      suit = shared ? await shared.catch((e) => {
        if (!pool) throw e;
        pool.forEach((wk) => wk.terminate()); pool = false; // workers failed: compute on the page from here on
        return onPage();
      }) : await onPage();
    } finally { building = ''; }
    if (!suit) return null;
    const L = { key, suit, grid, cells, t0, spanMs, stepMs, left, tookS: (performance.now() - started) / 1000, workers: pool ? pool.length : 0 };
    lands.set(key, L);
    if (lands.size > 4) lands.delete(lands.keys().next().value);
    return L;
  }

  // What a layer says about a view: its image, counts and listed areas.
  function landInfo(L, scene, m, done, total, paint = 'class', sort = 'size') {
    const { g, r0, c0 } = scene, [cr, cc] = toGrid(g, scene.center.lat, scene.center.lon);
    const img = suitImage(L.suit, L.grid, L.cells, { spacingM: g.cellM, slopeMax: m.slopeMax, padM: m.padM, centre: [cr - r0, cc - c0], paint, sort });
    const areas = img.areas.map((a) => { const [lat, lon] = toLatLon(g, r0 + a.y, c0 + a.x); return { ...a, lat, lon }; });
    return { img, land: { count: img.count, areas, areasTotal: img.areasTotal, done, total, cellM: g.cellM, terrainM: L.grid.cellM, left: L.left, t0: L.t0, spanMs: L.spanMs, stepMs: L.stepMs, tookS: L.tookS, workers: L.workers, stats: !!L.suit.stats, paint: L.suit.stats ? paint : 'class' } };
  }

  async function drawLand(scene) {
    const show = (L, done, total) => {
      const { img, land } = landInfo(L, scene, view.mission, done, total, view.paint, view.sort);
      view.frame = { g: scene.g, r0: scene.r0, c0: scene.c0, size: scene.size, litFraction: 0, land };
      const off = new OffscreenCanvasOr(img.w, img.h);
      off.ctx.putImageData(new ImageData(img.px, img.w, img.h), 0, 0);
      paint(off.canvas);
      view.onLand?.(land);
    };
    const L = await landFor(scene, view.mission, view.layer, landKey(), show);
    if (L) { show(L, 1, 1); setStatus(''); }
  }

  function paint(src) {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr); canvas.style.height = `${W}px`;
    const g2 = canvas.getContext('2d');
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.fillStyle = css('--map-bg'); g2.fillRect(0, 0, W, W);
    g2.imageSmoothingEnabled = view.frame.size > 600;
    g2.drawImage(src, 0, 0, W, W);
    const { g, r0, c0, size } = view.frame, k = W / size;
    const P = (lat, lon) => { const [r, c] = toGrid(g, lat, lon); return [(c - c0 + 0.5) * k, (r - r0 + 0.5) * k]; };
    g2.font = '600 13px system-ui, sans-serif'; g2.lineJoin = 'round';
    const label = (txt, x, y) => { g2.lineWidth = 4; g2.strokeStyle = 'rgba(0,0,0,0.85)'; g2.strokeText(txt, x, y); g2.fillStyle = '#fff'; g2.fillText(txt, x, y); };
    // Region outlines (e.g. Artemis III candidate regions): thin, or bold for the selected one.
    for (const o of view.outlines) {
      g2.beginPath();
      o.pts.forEach(([la, lo], i) => { const [x, y] = P(la, lo); i ? g2.lineTo(x, y) : g2.moveTo(x, y); });
      g2.closePath(); g2.lineWidth = o.main ? 3 : 1.5; g2.setLineDash(o.main ? [] : [5, 4]);
      g2.strokeStyle = o.main ? '#fff' : 'rgba(127, 209, 199, 0.9)'; g2.stroke(); g2.setLineDash([]);
    }
    // Paths (a landing ellipse, a surface route): dark under-stroke so they read on lit and shadowed ground.
    for (const p of view.paths || []) {
      g2.beginPath();
      p.pts.forEach(([la, lo], i) => { const [x, y] = P(la, lo); i ? g2.lineTo(x, y) : g2.moveTo(x, y); });
      if (p.closed) g2.closePath();
      g2.lineWidth = (p.width || 2) + 2.5; g2.strokeStyle = 'rgba(0,0,0,0.85)'; g2.stroke();
      g2.lineWidth = p.width || 2; g2.strokeStyle = p.color || '#fff'; g2.stroke();
    }
    // Edge labels first, so site labels can step around them: boxes [x, baseline y, width].
    const edge = size === g.n ? [[0, 'Earth side (0°)'], [90, '90°E'], [180, '180°'], [-90, '90°W']].map(([lon, txt]) => {
      const [x, y] = P(-76.2, lon), w = g2.measureText(txt).width;
      return [Math.min(Math.max(x - w / 2, 4), W - w - 4), Math.min(Math.max(y + 4, 16), W - 6), w, txt];
    }) : [];
    const placed = edge.slice(), hits = (x, y, w) => placed.some((p) => x < p[0] + p[2] + 4 && p[0] < x + w + 4 && Math.abs(y - p[1]) < 15);
    for (const m of view.markers) {
      if (m.lat > -75) continue;
      const [x, y] = P(m.lat, m.lon);
      if (x < -10 || y < -10 || x > W + 10 || y > W + 10) continue;
      g2.beginPath(); g2.arc(x, y, m.main ? 8 : 5.5, 0, 2 * Math.PI);
      g2.fillStyle = m.color || css('--accent'); g2.fill();
      g2.lineWidth = 2; g2.strokeStyle = '#000'; g2.stroke();
      if (m.main) { g2.beginPath(); g2.arc(x, y, 13, 0, 2 * Math.PI); g2.lineWidth = 2.5; g2.strokeStyle = '#fff'; g2.stroke(); }
      if (m.label) {
        const w = g2.measureText(m.label).width;
        let lx = x + 12;
        if (lx + w > W - 4 || hits(lx, y + 5, w)) lx = x - 12 - w; // no room on the right: put it left of the dot
        lx = Math.min(Math.max(lx, 4), W - w - 4);
        placed.push([lx, y + 5, w]); label(m.label, lx, y + 5);
      }
    }
    // Candidate landing areas of the landing layer, lettered as in the list beside the map.
    if (view.frame.land && view.frame.land.done === view.frame.land.total) view.frame.land.areas.forEach((a, i) => {
      const [x, y] = P(a.lat, a.lon);
      g2.beginPath(); g2.arc(x, y, 11, 0, 2 * Math.PI); g2.fillStyle = '#0b2a18'; g2.fill(); g2.lineWidth = 2; g2.strokeStyle = '#fff'; g2.stroke();
      g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.fillText(String.fromCharCode(65 + i), x, y + 4.5); g2.textAlign = 'start';
    });
    for (const [x, y, , txt] of edge) label(txt, x, y);
    const kmPx = (k / (g.cellM / 1000)), bar = size === g.n ? 100 : g.cellM < 100 ? 2 : 10; // scale bar
    g2.fillStyle = '#fff'; g2.fillRect(12, W - 18, bar * kmPx, 4);
    label(`${bar} km`, 12, W - 24);
    canvas.setAttribute('aria-label', describe(view));
  }

  canvas.addEventListener('click', (e) => {
    if (!view.frame || !onPick) return;
    const { g, r0, c0, size } = view.frame, k = canvas.clientWidth / size;
    const [lat, lon] = toLatLon(g, r0 + e.offsetY / k - 0.5, c0 + e.offsetX / k - 0.5);
    if (lat <= -75) onPick(lat, lon);
  });

  return {
    view,
    // While the landing layer is building, a change that does not alter it (the moment slider, markers) must not restart it.
    set(opts) { Object.assign(view, opts); if (busy && building && building === landKey()) return Promise.resolve(); return draw(); },
    // The landing layer of another view, without drawing it (the CLPS regions table). Waits for a build in progress;
    // resolves to null if the map is asked to draw something else meanwhile.
    async analyse({ zoom, center, mission }) {
      while (busy) await new Promise((r) => setTimeout(r, 100));
      busy = true;
      try {
        const scene = await sceneFor(zoom, center), L = await landFor(scene, mission, 'land', keyFor('land', zoom, center, mission));
        return L && landInfo(L, scene, mission, 1, 1).land;
      } finally { busy = false; if (pending) { pending = false; draw(); } }
    },
    litFraction: () => view.frame?.litFraction ?? null,
    when: () => fmtUTC(view.t),
  };
}

const HOUR_MS = 3600e3;
// OffscreenCanvas where available, else a detached canvas (older Safari).
function OffscreenCanvasOr(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return { canvas: c, ctx: c.getContext('2d') };
}
