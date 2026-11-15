// Panorama of the sky all the way round a site: the real terrain horizon, the Sun and Earth now, and
// optionally their paths. Terrain is drawn over the bodies (as on the Moon); a body hidden behind terrain
// is marked with a dashed outline so its position stays readable.
import { horizonAt } from './horizon.js';
import { css, setupCanvas, compass } from './core.js';

// opts: { site, cur: sample(), tracks: rows or [], height, range: [lo, hi] | null, compact }
export function drawSky(cv, { site, cur, tracks = [], height = 240, range = null, compact = false }) {
  const { g, w, h } = setupCanvas(cv, height), hz = site.horizon.elev;
  const L = compact ? 30 : 44, Rm = 8, T = compact ? 6 : 10, B = compact ? 18 : 24, pw = w - L - Rm, ph = h - T - B;
  let [lo, hi] = range || [
    Math.max(Math.min(-2, ...hz) - 0.5, -10),
    Math.min(Math.max(6, ...hz, ...tracks.map((r) => r.sun.el), ...tracks.map((r) => r.earth.el), cur.sun.el, cur.earth.el) + 2, 90),
  ];
  const X = (az) => L + (((az % 360) + 360) % 360 / 360) * pw, Y = (el) => T + ((hi - Math.min(Math.max(el, lo), hi)) / (hi - lo)) * ph;
  g.fillStyle = css('--sky'); g.fillRect(L, T, pw, ph);
  g.font = `${compact ? 12 : 13}px system-ui, sans-serif`; g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.lineWidth = 1;
  const span = hi - lo, tick = span > 40 ? 15 : span > 15 ? 5 : span > 8 ? 2 : 1;
  for (let e = Math.ceil(lo / tick) * tick; e <= hi; e += tick) {
    g.beginPath(); g.moveTo(L, Y(e)); g.lineTo(L + pw, Y(e)); g.stroke();
    if (!compact || e % (tick * 2) === 0) g.fillText(`${e}°`, 2, Y(e) + 4);
  }
  g.strokeStyle = css('--muted'); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + pw, Y(0)); g.stroke(); g.setLineDash([]);
  for (const [az, n] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [360, 'N']]) {
    g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(X(az === 360 ? 359.999 : az), T); g.lineTo(X(az === 360 ? 359.999 : az), T + ph); g.stroke();
    g.fillStyle = css('--muted'); g.fillText(n, Math.min(X(az === 360 ? 359.999 : az) - 4, w - 12), h - 5);
  }
  const bodies = [['sun', css('--sun'), 'Sun'], ['earth', css('--earth'), 'Earth']];
  for (const [body, col] of bodies) {
    g.fillStyle = col; g.globalAlpha = 0.45;
    for (const r of tracks) g.fillRect(X(r[body].az) - 1, Y(r[body].el) - 1, 2.5, 2.5);
    g.globalAlpha = 1;
  }
  const rad = (body) => Math.max(compact ? 4 : 6, (cur[body].radiusDeg / span) * ph);
  for (const [body, col] of bodies) { g.fillStyle = col; g.beginPath(); g.arc(X(cur[body].az), Y(cur[body].el), rad(body), 0, 2 * Math.PI); g.fill(); }
  g.fillStyle = css('--terrain'); g.beginPath(); g.moveTo(L, T + ph);
  for (let k = 0; k <= site.horizon.nAz; k++) g.lineTo(X(((k * 360) / site.horizon.nAz) % 360 || (k ? 359.999 : 0)), Y(hz[k % site.horizon.nAz]));
  g.lineTo(L + pw, T + ph); g.closePath(); g.fill();
  g.strokeStyle = '#9aa5b8'; g.lineWidth = 1; g.stroke();
  g.font = `600 ${compact ? 12 : 13}px system-ui, sans-serif`; g.lineJoin = 'round';
  for (const [body, col, name] of bodies) {
    const x = X(cur[body].az), y = Y(cur[body].el), hidden = cur[body].el + cur[body].radiusDeg <= horizonAt(site.horizon, cur[body].az);
    if (hidden) { g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, rad(body) + 1, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); }
    const clipped = cur[body].el > hi ? ` ↑${Math.round(cur[body].el)}°` : '';
    const txt = `${name}${hidden ? ' (hidden)' : ''}${clipped}`, tw = g.measureText(txt).width;
    const tx = Math.min(Math.max(x + rad(body) + 4, L + 2), L + pw - tw - 2), ty = Math.max(y - 4, T + 12);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(txt, tx, ty); g.fillStyle = col; g.fillText(txt, tx, ty);
  }
  const sunH = horizonAt(site.horizon, cur.sun.az), earthH = horizonAt(site.horizon, cur.earth.az);
  cv.setAttribute('aria-label', `Sky all the way round ${site.short}: the Sun is ${cur.sun.el.toFixed(1)}° high toward the ${compass(cur.sun.az)}, where the terrain rises to ${sunH.toFixed(1)}°, so it is ${cur.sunMargin > 0 ? 'visible' : 'hidden'}. Earth is ${cur.earth.el.toFixed(1)}° high toward the ${compass(cur.earth.az)}, terrain ${earthH.toFixed(1)}°, so it is ${cur.earthMargin > 0 ? 'visible' : 'hidden'}.`);
}
