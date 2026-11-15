// The Moon as a globe on a 2D canvas: orthographic view of the sphere, lit by the real Sun (texture baked by
// globe-math.js), with the Sun and Earth directions marked off the limb. No WebGL needed. The point under the
// centre crosshair is the view centre; it is reported while rotating (onMove) and once rotation stops (onSettle).
import { globeTexture, viewBasis, toView, unproject, texIndex, latLonToMe } from './globe-math.js';
import { css } from './core.js';

const SETTLE_MS = 350, D2R = Math.PI / 180;

export function createGlobe(canvas, { onMove, onSettle }) {
  const view = { lat: -62, lon: 25, zoom: 1, roll: 0 }; // roll [deg]: twist about the view axis, 0 = north up
  let tex = null, sunV = null, earthV = null, markers = [], frame = 0, settleTimer = 0, sharp = false, sharpTimer = 0;
  let lit = null, shadowed = false, playing = false; // the instant being shown; whether its texture has cast shadows yet
  const g = canvas.getContext('2d');

  function draw() {
    frame = 0;
    if (!tex) return;
    const C = canvas.clientWidth, b = viewBasis(view.lat, view.lon, view.roll);
    if (!C) return; // hidden (other mode): nothing to draw until it is shown again
    // CSS-pixel frames while moving (cheap enough to redraw on every drag step); device pixels once still.
    const dpr = sharp ? Math.min(window.devicePixelRatio || 1, 2) : 1, W = Math.round(C * dpr);
    if (canvas.width !== W) { canvas.width = W; canvas.height = W; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    let R = (W / 2) * 0.8 * view.zoom, cx = W / 2;
    const img = g.createImageData(W, W), out = img.data;
    for (let y = 0; y < W; y++) {
      const Y = (cx - y - 0.5) / R;
      if (Math.abs(Y) > 1) continue;
      for (let x = 0; x < W; x++) {
        const X = (x + 0.5 - cx) / R;
        if (X * X + Y * Y > 1) continue;
        const [lat, lon] = unproject(b, X, Y), i = texIndex(lat, lon, tex.W, tex.H) * 4, o = (y * W + x) * 4;
        out[o] = tex.px[i]; out[o + 1] = tex.px[i + 1]; out[o + 2] = tex.px[i + 2]; out[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); R /= dpr; cx /= dpr; // overlays in CSS pixels
    g.font = '600 13px system-ui, sans-serif'; g.lineJoin = 'round';
    const label = (txt, x, y, col) => { g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); };
    for (const m of markers) {
      const [X, Y, Z] = toView(b, latLonToMe(m.lat, m.lon));
      if (Z <= 0) continue;
      g.beginPath(); g.arc(cx + X * R, cx - Y * R, 4.5, 0, 2 * Math.PI); g.fillStyle = css('--accent'); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke(); // compared sites: not the Sun's colour
    }
    // Sun and Earth. Facing us: a ring on the point where it is straight overhead. Behind the globe: a dashed marker
    // just past the edge in its direction (an off-edge marker for a body near the view axis would point nowhere useful).
    const placed = [[cx - 16, cx + 6, 32, 20]]; // label boxes [x, baseline y, width, clearance]; the crosshair counts as taken
    for (const [v, col, name, rOut] of [[sunV, css('--sun'), 'Sun', 1.1], [earthV, css('--earth'), 'Earth', 1.22]]) {
      if (!v) continue;
      const [X, Y, Z] = toView(b, v);
      if (Z > 0) {
        const x = cx + X * R, y = cx - Y * R;
        if (x < 0 || y < 0 || x > C || y > C) continue; // zoomed in and the overhead point is out of frame
        g.beginPath(); g.arc(x, y, 9, 0, 2 * Math.PI); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = col; g.stroke();
        const txt = `${name} overhead`, tw = g.measureText(txt).width, lx = Math.min(Math.max(x - tw / 2, 4), C - tw - 4);
        let ly = Math.min(Math.max(y - 15, 14), C - 6);
        if (placed.some((p) => lx < p[0] + p[2] && p[0] < lx + tw && Math.abs(ly - p[1]) < (p[3] || 16))) ly = Math.min(y + 26, C - 6); // the other label is there: go below the ring
        placed.push([lx, ly, tw]); label(txt, lx, ly, col);
        continue;
      }
      const h = Math.hypot(X, Y) || 1e-9, ux = X / h, uy = -Y / h, rr = Math.min(R * rOut, C / 2 - 14);
      const x1 = cx + ux * R * 1.02, y1 = cx + uy * R * 1.02, x2 = cx + ux * rr, y2 = cx + uy * rr;
      g.setLineDash([4, 4]); g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.arc(x2, y2, name === 'Sun' ? 7 : 6, 0, 2 * Math.PI); g.fillStyle = col; g.fill();
      const txt = `${name} (behind)`, tw = g.measureText(txt).width;
      label(txt, Math.min(Math.max(x2 - tw / 2, 4), C - tw - 4), Math.min(Math.max(y2 - 12, 14), C - 6), col);
    }
    // North arrow, top right: where north points on screen after any twist.
    const ax = C - 30, ay = 36, sr = Math.sin(view.roll * D2R), cr = Math.cos(view.roll * D2R);
    g.beginPath(); g.arc(ax, ay, 17, 0, 2 * Math.PI); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill();
    g.save(); g.translate(ax, ay); g.rotate(view.roll * D2R);
    g.beginPath(); g.moveTo(0, -13); g.lineTo(5, 1); g.lineTo(-5, 1); g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(0, 11); g.lineTo(5, 1); g.lineTo(-5, 1); g.closePath(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
    g.restore();
    g.font = '700 11px system-ui, sans-serif'; label('N', ax + sr * 25 - 4, ay - cr * 25 + 4, '#fff');
  }
  const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
  // While things change: CSS pixels, and no cast shadows if the time changed (the shadow pass takes ~0.2 s).
  // Once they stop: device pixels and cast shadows. Never during Play, even if a slow frame leaves a gap.
  function soften() {
    sharp = false; redraw();
    clearTimeout(sharpTimer);
    sharpTimer = setTimeout(() => {
      if (playing) return;
      if (!shadowed && lit) bakeShadows(lit);
      sharp = true; redraw();
    }, SETTLE_MS);
  }
  // Cast shadows in a worker when the browser allows one, else here. A result for an instant no longer shown is dropped.
  let worker = null, job = 0;
  try {
    worker = new Worker(new URL(`./globe-worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
    worker.onerror = () => { worker = null; if (lit && !shadowed) bakeShadows(lit); };
  } catch { worker = null; }
  function bakeShadows(want) {
    const id = ++job, done = (px) => { if (id === job && lit === want) { tex = { ...tex, px }; shadowed = true; redraw(); } };
    if (!worker) { done(globeTexture(want.grid, want.sunKm).px); return; }
    worker.onmessage = ({ data }) => { if (data.id === id) done(data.px); };
    worker.postMessage({ id, z: want.grid.z, ppd: want.grid.ppd, sunKm: want.sunKm }); // the grid is copied: 2 MB
  }
  function changed() {
    soften();
    onMove(view.lat, view.lon);
    clearTimeout(settleTimer); settleTimer = setTimeout(() => onSettle(view.lat, view.lon), SETTLE_MS);
  }
  const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  function lookAt(lat, lon) { view.lat = Math.max(-89.9, Math.min(89.9, lat)); view.lon = wrap(lon); changed(); }
  const twist = (d) => { view.roll = ((((view.roll + d) + 180) % 360) + 360) % 360 - 180; changed(); };

  // Pointer: drag turns; Shift-drag twists about the centre; a tap (under 4 px of movement) re-centres on the
  // tapped point; two pointers pinch-zoom and twist.
  const pts = new Map(); let moved = 0, pinch = 0, ang = null;
  const angleAt = ([x, y]) => Math.atan2(y - canvas.clientWidth / 2, x - canvas.clientWidth / 2) / D2R;
  const dAng = (a, b) => ((((b - a) + 540) % 360) + 360) % 360 - 180;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is a nicety: dragging still works without it */ }
    pts.set(e.pointerId, at(e)); moved = 0; pinch = 0; ang = null;
    if (pts.size === 2) { // second finger down: measure from here, so a gesture's twist and zoom add up exactly
      const [a, c] = [...pts.values()]; pinch = Math.hypot(a[0] - c[0], a[1] - c[1]); ang = Math.atan2(c[1] - a[1], c[0] - a[0]) / D2R;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) {
      pts.set(e.pointerId, at(e));
      const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]), th = Math.atan2(c[1] - a[1], c[0] - a[0]) / D2R;
      if (pinch) view.zoom = Math.max(0.6, Math.min(8, view.zoom * (d / pinch)));
      if (ang !== null) view.roll = ((((view.roll + dAng(ang, th)) + 180) % 360) + 360) % 360 - 180;
      pinch = d; ang = th; moved = 99; changed(); return;
    }
    const [ex, ey] = at(e), dx = ex - p[0], dy = ey - p[1]; moved += Math.abs(dx) + Math.abs(dy);
    pts.set(e.pointerId, [ex, ey]);
    if (e.shiftKey) { twist(dAng(angleAt(p), angleAt([ex, ey]))); return; }
    // Screen drag -> east/north drag in the un-twisted frame, so the ground follows the pointer at any roll.
    const R = (canvas.clientWidth / 2) * 0.8 * view.zoom, c = Math.cos(view.roll * D2R), s = Math.sin(view.roll * D2R);
    const de = dx * c + dy * s, dn = dy * c - dx * s;
    lookAt(view.lat + (dn / R) / D2R, view.lon - (de / (R * Math.max(0.1, Math.cos(view.lat * D2R)))) / D2R);
  });
  const up = (e) => {
    if (pts.size === 1 && moved < 4) { // a tap: re-centre there
      const W = canvas.clientWidth, R = (W / 2) * 0.8 * view.zoom, [ex, ey] = at(e), X = (ex - W / 2) / R, Y = (W / 2 - ey) / R;
      if (X * X + Y * Y <= 1) lookAt(...unproject(viewBasis(view.lat, view.lon, view.roll), X, Y));
    }
    pts.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.zoom = Math.max(0.6, Math.min(8, view.zoom * Math.exp(-e.deltaY * 0.0015))); changed(); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = 10 / view.zoom, k = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [step, 0], ArrowDown: [-step, 0] }[e.key];
    if (k) { e.preventDefault(); lookAt(view.lat + k[0], view.lon + k[1]); }
    else if (e.key === '[' || e.key === ']') { e.preventDefault(); twist(e.key === ']' ? 15 : -15); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); view.roll = 0; changed(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); view.zoom = Math.min(8, view.zoom * 1.25); changed(); }
    else if (e.key === '-') { e.preventDefault(); view.zoom = Math.max(0.6, view.zoom / 1.25); changed(); }
  });

  return {
    view,
    // Bake the lit texture for one instant: quickly without cast shadows now, with them once the time holds still.
    setTime(grid, sunKm, earthKm, { moving = false } = {}) {
      playing = moving; lit = { grid, sunKm }; shadowed = false;
      tex = globeTexture(grid, sunKm, { shadows: false });
      const n = (v) => { const d = Math.hypot(...v); return v.map((x) => x / d); };
      sunV = n(sunKm); earthV = n(earthKm); soften();
    },
    setMarkers(list) { markers = list; redraw(); },
    lookAt,
    zoom(f) { view.zoom = Math.max(0.6, Math.min(8, view.zoom / f)); changed(); },
    twist,
    northUp() { view.roll = 0; changed(); },
    centre: () => [view.lat, view.lon],
    resize: redraw,
    drawNow: draw, // for timing in tests and the browser check
    isSharp: () => sharp,
    hasShadows: () => shadowed,
  };
}
