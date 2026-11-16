// Planner add-ons: the landing ellipse with approach lighting, and a surface route with Sun and Earth at each waypoint.
// Both need the south-polar LOLA grids (75-90°S): 40 m windows around catalogue sites, else 240 m.
import { stack, polarGrid } from './dem.js';
import { ellipseCells, ellipseFits, slopeStats, litShare, approachLight, toMap, fromMap, scaleK, cellOf, slopeAt } from './landing.js';
import { routeProfile, gcDist } from './route.js';
import { series, summary, sample } from './windows.js';
import { $, DAY, HOUR, T_MAX, eph, data, getJSON, getBin, loadGrid, customSite, fmtDur, fmtUTC, compass, css, setupCanvas, setStatus } from './core.js';

const D2R = Math.PI / 180, MAX_WP = 8;
export const ELLIPSE_DEFAULTS = { L: 1000, W: 500, hdg: null, max: 10, elMin: 7, elMax: 20 };
const ROUTE_MAX = 15;

let cropMeta = null;
const crops = {};
async function cropFor(site) {
  if (site.lat > -84) return null;
  cropMeta ||= await getJSON('data/dem/crop40.json');
  const w = cropMeta.sites[site.key];
  if (!w) return null;
  crops[site.key] ||= polarGrid({ data: new Int16Array(await getBin(`data/${w.file}`)), n: cropMeta.n, cellM: cropMeta.cellM, maxLat: -84, id: 'LOLA 40 m (85S)', r0: w.r0, c0: w.c0, m: cropMeta.m });
  return crops[site.key];
}
// Local east/north unit vectors on the polar map at a longitude.
const axes = (lon) => ({ e: [Math.cos(lon * D2R), -Math.sin(lon * D2R)], n: [Math.sin(lon * D2R), Math.cos(lon * D2R)] });
// Local (east, north) metres from the site -> [lat, lon].
function enuToLatLon(site, E, N) {
  const [xs, ys] = toMap(site.lat, site.lon), k = scaleK(site.lat), { e, n } = axes(site.lon);
  return fromMap(xs + k * (E * e[0] + N * n[0]), ys + k * (E * e[1] + N * n[1]));
}
// Ellipse outline in local metres: `steps` points [E, N].
function outline(L, W, hdg, steps = 72) {
  const sh = Math.sin(hdg * D2R), ch = Math.cos(hdg * D2R);
  return Array.from({ length: steps }, (_, i) => { const t = (2 * Math.PI * i) / steps, u = (L / 2) * Math.cos(t), v = (W / 2) * Math.sin(t); return [u * sh + v * ch, u * ch - v * sh]; });
}

export function createMission({ st, updateMap, onChange }) {
  const m = { ell: { ...ELLIPSE_DEFAULTS }, wps: [], rmax: ROUTE_MAX, speed: null, adding: false, siteKey: null };
  let last = null; // the route's last traced stops, for re-timing without re-tracing
  const polar = () => st.site.lat <= -75;
  const heading = (sun) => (m.ell.hdg ?? Math.round((((sun.az + 180) % 360) + 360) % 360)); // auto: fly away from the Sun

  // ---------- landing ellipse ----------
  const ellCache = new Map();
  async function renderEllipse() {
    const site = st.site, box = $('pLandBody'), note = $('pLandNote');
    $('pLandBox').classList.toggle('na', !polar());
    if (!polar()) { box.hidden = true; note.textContent = `Needs south-polar terrain (75–90°S); ${site.short} is at ${site.lat.toFixed(1)}°.`; return; }
    const crop = await cropFor(site);
    const size = Math.max(m.ell.L, m.ell.W);
    let G = crop && ellipseFits(crop, site, size) ? crop : data.grids.polar240?.sampler;
    if (!G) { box.hidden = true; note.innerHTML = `${crop ? 'This ellipse is larger than the 12 km of 40 m terrain shipped for this site. ' : ''}Checking it needs the 240 m polar terrain (29 MB). <button type="button" class="btn" id="pLand240">Load 240 m terrain</button>`; return; }
    box.hidden = false;
    await loadGrid('global4');
    const p240 = data.grids.polar240?.sampler; // sunlight needs the 240 m grid beyond the 40 m window: the 1.2 km map grid misses the 0.5° test limit
    const t = st.land, sun0 = eph.topo({ lat: site.lat, lon: site.lon, hM: site.hM }, 'sun', t), hdg = heading(sun0);
    const k = `${site.key}|${t}|${m.ell.L}|${m.ell.W}|${hdg}|${G.id}|${!!data.grids.polar240}`;
    if (!ellCache.has(k)) {
      if (ellCache.size > 20) ellCache.clear();
      const cells = ellipseCells(G, site, { lengthM: m.ell.L, widthM: m.ell.W, headingDeg: hdg });
      const terrain = p240 && stack([G, p240, data.grids.global4.sampler].filter((x, i, a) => a.indexOf(x) === i));
      const lit = terrain ? litShare(cells, terrain, (la, lo, hM) => eph.topo({ lat: la, lon: lo, hM }, 'sun', t)) : null;
      ellCache.set(k, { cells, lit, G, hdg });
    }
    const { cells, lit } = ellCache.get(k), sl = slopeStats(cells, m.ell.max), ap = approachLight(sun0, hdg, m.ell);
    const res = G.cellM === 40 ? '40 m' : '240 m';
    $('pLandTiles').innerHTML = `
      <div class="tile ${sl && sl.steep > 0 ? 'bad' : 'good'}"><span class="tl">Steeper than ${m.ell.max}°</span><b>${sl ? `${Math.round(sl.steep * 100)}%` : '–'}</b><small>${sl ? `max ${sl.max.toFixed(1)}° · ${res} cells` : 'outside the terrain window'}</small></div>
      <div class="tile sun"><span class="tl">Sunlit at touchdown</span>${lit ? `<b>${lit.lit === null ? '–' : `${Math.round(lit.lit * 100)}%`}</b><small>${lit.n} spots${lit.every > 1 ? ` (every ${lit.every}th cell)` : ''}</small>` : '<button type="button" class="btn tilebtn" id="pLit240">Check (29 MB terrain)</button>'}</div>
      <div class="tile ${ap.ok ? 'good' : 'bad'}"><span class="tl">Approach Sun</span><b>${ap.ok ? 'Behind, in window' : !ap.behind ? 'Ahead of lander' : ap.el > m.ell.elMax ? 'Too high' : 'Too low'}</b><small>${ap.el.toFixed(1)}° up ${compass(ap.az)} · ${m.ell.hdg === null ? 'auto heading: flown away from the Sun' : `${Math.abs(ap.off).toFixed(0)}° off straight behind`}</small></div>`;
    $('eHdg').placeholder = `auto ${hdg}`;
    drawEllipse(G, site, hdg, cells, lit, sun0);
    note.innerHTML = `Heights: ${res} LOLA${G.cellM === 40 ? '' : ' (coarse for an ellipse this size)'}. Slopes miss boulders and craters smaller than a cell. ${lit ? `Sunlit: Sun's upper limb over the terrain (${lit.grids.join(' + ')}).` : 'Sunlight needs the 240 m polar terrain.'} Sun window: Apollo planning wanted the Sun 7–20° up behind the lander (<a href="https://www.nasa.gov/feature/50-years-ago-lunar-landing-sites-selected" target="_blank" rel="noopener">NASA</a>). The limits are examples. Set the limits of your vehicle.`;
  }

  function drawEllipse(G, site, hdg, cells, lit, sun) {
    const cv = $('pEll'), W = cv.clientWidth;
    if (!W) return;
    const { g } = setupCanvas(cv, W), N = Math.min(Math.round(W), 420);
    const S = Math.min(Math.max(1.5 * Math.max(m.ell.L, m.ell.W), 2000), (G.m - 4) * G.cellM), mpp = S / N; // view side [m], metres per pixel
    const [xs, ys] = toMap(site.lat, site.lon), k = scaleK(site.lat), { e, n } = axes(site.lon), { z, m: gm } = G;
    const inside = new Set(cells.map((c) => `${c.R},${c.C}`)), col = (v) => css(v).match(/\w\w/g).map((h) => parseInt(h, 16));
    const ok = col('--full'), near = col('--short'), bad = col('--none-dot');
    const img = new ImageData(N, N), px = img.data;
    for (let py = 0; py < N; py++) for (let qx = 0; qx < N; qx++) {
      const E = (qx + 0.5 - N / 2) * mpp, Nn = (N / 2 - py - 0.5) * mpp;
      const [Rf, Cf] = cellOf(G, xs + k * (E * e[0] + Nn * n[0]), ys + k * (E * e[1] + Nn * n[1])), R = Math.round(Rf), C = Math.round(Cf);
      const i = R - G.r0, j = C - G.c0, o = 4 * (py * N + qx);
      px[o + 3] = 255;
      if (i < 1 || j < 1 || i >= gm - 1 || j >= gm - 1) { px[o] = px[o + 1] = px[o + 2] = 8; continue; }
      const gx = ((z[i * gm + j + 1] - z[i * gm + j - 1]) * 0.5) / (2 * G.cellM), gy = ((z[(i - 1) * gm + j] - z[(i + 1) * gm + j]) * 0.5) / (2 * G.cellM);
      const hs = Math.max(0, (gx * 0.5 - gy * 0.5 + 0.7071) / Math.hypot(gx, gy, 1)); // relief only: a fixed light, not the Sun
      const key = `${R},${C}`;
      let rgb = [hs * 150 + 30, hs * 150 + 30, hs * 155 + 34];
      if (inside.has(key)) {
        const s = slopeAt(G, R, C), c = s === null ? ok : s > m.ell.max ? bad : s > 0.7 * m.ell.max ? near : ok;
        rgb = rgb.map((v, q) => v * 0.45 + c[q] * 0.55);
        if (lit && lit.every === 1 && !lit.litCells.has(key)) rgb = [rgb[0] * 0.3, rgb[1] * 0.32, rgb[2] * 0.5 + 40]; // in shadow at touchdown
      } else rgb = rgb.map((v) => v * 0.6);
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2];
    }
    const off = document.createElement('canvas'); off.width = N; off.height = N; off.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(off, 0, 0, W, W);
    const sc = W / S, X = (E) => W / 2 + E * sc, Y = (Nn) => W / 2 - Nn * sc;
    g.lineJoin = 'round'; g.font = '600 13px system-ui, sans-serif';
    const label = (txt, x, y, c = '#fff') => { g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(txt, x, y); g.fillStyle = c; g.fillText(txt, x, y); };
    // ellipse outline
    g.beginPath(); outline(m.ell.L, m.ell.W, hdg).forEach(([E, Nn], i) => (i ? g.lineTo(X(E), Y(Nn)) : g.moveTo(X(E), Y(Nn)))); g.closePath();
    g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
    // approach path through the ellipse, arrow at the far end (direction of travel)
    const arrow = (E0, N0, E1, N1, c, dash) => {
      g.setLineDash(dash || []); g.beginPath(); g.moveTo(X(E0), Y(N0)); g.lineTo(X(E1), Y(N1)); g.lineWidth = 5; g.strokeStyle = '#000'; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = c; g.stroke(); g.setLineDash([]);
      const a = Math.atan2(Y(N1) - Y(N0), X(E1) - X(E0));
      g.beginPath(); g.moveTo(X(E1), Y(N1)); g.lineTo(X(E1) - 12 * Math.cos(a - 0.45), Y(N1) - 12 * Math.sin(a - 0.45)); g.lineTo(X(E1) - 12 * Math.cos(a + 0.45), Y(N1) - 12 * Math.sin(a + 0.45)); g.closePath(); g.fillStyle = c; g.fill();
    };
    const sh = Math.sin(hdg * D2R), ch = Math.cos(hdg * D2R), r = Math.min(0.42 * S, 0.8 * m.ell.L);
    arrow(-r * sh, -r * ch, r * sh, r * ch, css('--accent'));
    label('approach', X(r * sh) + 8, Y(r * ch) - 8, css('--accent'));
    const ss = Math.sin(sun.az * D2R), sc2 = Math.cos(sun.az * D2R), rs = 0.4 * S;
    arrow(0, 0, rs * ss, rs * sc2, css('--sun'), sun.el + sun.radiusDeg < 0 ? [6, 5] : null);
    const st2 = `Sun ${sun.el.toFixed(1)}°`, tw = g.measureText(st2).width;
    label(st2, Math.min(Math.max(X(rs * ss) - tw / 2, 4), W - tw - 4), Math.min(Math.max(Y(rs * sc2) + (sc2 > 0 ? -12 : 22), 16), W - 6), css('--sun'));
    label('N ↑', 8, 20);
    const bar = S > 4000 ? 1000 : 500; g.fillStyle = '#fff'; g.fillRect(10, W - 16, bar * sc, 4); label(`${bar} m`, 10, W - 22);
    cv.setAttribute('aria-label', `Landing ellipse ${m.ell.L} by ${m.ell.W} m, approach heading ${hdg}°, on ${G.cellM} m terrain: ${$('pLandTiles').textContent.replace(/\s+/g, ' ').trim()}`);
  }

  // ---------- surface route ----------
  const wpCache = new Map();
  async function wpSite(lat, lon, name) {
    const k = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (!wpCache.has(k)) wpCache.set(k, await customSite(lat, lon, { fast: true, name }));
    return wpCache.get(k);
  }
  let routeToken = 0;
  async function renderRoute() {
    const hint = $('pRouteHint'), body = $('pRouteBody');
    $('rAdd').classList.toggle('on', m.adding); $('rAdd').textContent = m.adding ? 'Done adding' : 'Add on the map';
    $('pRouteBox').classList.toggle('na', !polar());
    $('rAdd').disabled = !polar(); $('rUndo').disabled = !m.wps.length; $('rClear').disabled = !m.wps.length;
    if (!polar()) { body.hidden = true; hint.textContent = `Needs south-polar terrain (75–90°S); ${st.site.short} is at ${st.site.lat.toFixed(1)}°.`; return; }
    if (!m.wps.length) { last = null; body.hidden = true; hint.textContent = m.adding ? `Tap the map to add up to ${MAX_WP} waypoints. The route starts at ${st.site.short}.` : 'Add waypoints on the map or by coordinates. The route starts at the landing site.'; return; }
    hint.textContent = m.adding ? `Tap the map to add waypoints (${m.wps.length} of ${MAX_WP}).` : '';
    const token = ++routeToken;
    const fresh = !data.grids.polar240;
    if (fresh) setStatus('Loading 240 m south-polar terrain (29 MB, first time only)…');
    const [p240, g4, crop] = await Promise.all([loadGrid('polar240'), loadGrid('global4'), cropFor(st.site)]);
    setStatus('');
    if (fresh) renderEllipse().catch((e) => setStatus(e.message)); // the 240 m grid now allows the touchdown sunlight check
    if (token !== routeToken) return;
    body.hidden = false;
    const pts = [[st.site.lat, st.site.lon], ...m.wps], terrain = stack([crop, p240.sampler, g4.sampler].filter(Boolean));
    const pr = routeProfile(terrain, pts, { stepM: 60, limitDeg: m.rmax });
    $('pRouteTiles').innerHTML = `
      <div class="tile"><span class="tl">Distance</span><b>${(pr.totalM / 1000).toFixed(pr.totalM < 10e3 ? 2 : 1)} km</b><small>${pts.length - 1} leg${pts.length > 2 ? 's' : ''}, straight lines</small></div>
      <div class="tile"><span class="tl">Climb · descent</span><b>${Math.round(pr.climbM)} · ${Math.round(pr.descentM)} m</b><small>along the route</small></div>
      <div class="tile ${pr.steep > 0 ? 'bad' : 'good'}"><span class="tl">Steeper than ${m.rmax}°</span><b>${Math.round(pr.steep * 100)}%</b><small>max ${pr.maxSlope.toFixed(1)}° · ${pr.grids.map((x) => x.replace('LOLA ', '').replace(/ \(.*\)/, '')).join(' + ')}</small></div>`;
    drawProfile(pr);
    // Sun and Earth at each waypoint across the mission (each traced on the 240 m horizon).
    $('pRouteList').innerHTML = '<li class="hint">Tracing the horizon at each waypoint…</li>';
    await new Promise((r) => setTimeout(r));
    const t0 = st.land, t1 = Math.min(st.land + st.durD * DAY, T_MAX), rows = [];
    for (let i = 0; i < pts.length; i++) {
      const s = i === 0 ? st.site : await wpSite(pts[i][0], pts[i][1], `W${i}`);
      if (token !== routeToken) return;
      const r = series(eph, s, s.horizon, t0, t1, HOUR);
      rows.push({ s, r, sum: summary(r), name: i === 0 ? 'Site' : `W${i}`, at: i === 0 ? 0 : pr.legs[i - 1].startM + pr.legs[i - 1].lengthM });
    }
    last = { rows, t0, t1 };
    timing();
    $('pRouteBands').setAttribute('aria-label', `Sun and Earth at the site and each waypoint over the ${st.durD}-day mission. ${rows.map((w) => `${w.name}: sunlit ${Math.round(w.sum.sunlit * 100)}%, Earth ${Math.round(w.sum.earthVisible * 100)}%`).join('; ')}.`);
  }

  function drawProfile(pr) {
    const cv = $('pProfile'), { g, w } = setupCanvas(cv, 150), pad = { l: 46, r: 8, t: 12, b: 22 };
    const hs = pr.samples.filter((s) => s.h !== null), lo = Math.min(...hs.map((s) => s.h)), hi = Math.max(...hs.map((s) => s.h)), span = Math.max(hi - lo, 50);
    const X = (s) => pad.l + (s / pr.totalM) * (w - pad.l - pad.r), Y = (h) => pad.t + (1 - (h - lo + span * 0.08) / (span * 1.16)) * (150 - pad.t - pad.b);
    g.font = '12px system-ui, sans-serif'; g.fillStyle = css('--muted'); g.strokeStyle = css('--line');
    for (const h of [lo, (lo + hi) / 2, hi]) { g.beginPath(); g.moveTo(pad.l, Y(h)); g.lineTo(w - pad.r, Y(h)); g.stroke(); g.fillText(`${Math.round(h)} m`, 2, Y(h) + 4); }
    g.beginPath(); g.moveTo(X(hs[0].s), 150 - pad.b); hs.forEach((s) => g.lineTo(X(s.s), Y(s.h))); g.lineTo(X(hs.at(-1).s), 150 - pad.b); g.closePath(); g.fillStyle = css('--terrain'); g.fill();
    for (let i = 1; i < hs.length; i++) { // line coloured where the ground is steeper than the limit
      g.beginPath(); g.moveTo(X(hs[i - 1].s), Y(hs[i - 1].h)); g.lineTo(X(hs[i].s), Y(hs[i].h));
      g.lineWidth = hs[i].slope > m.rmax ? 3.5 : 2; g.strokeStyle = hs[i].slope > m.rmax ? css('--none-dot') : css('--text'); g.stroke();
    }
    g.lineWidth = 1; g.fillStyle = css('--text');
    for (const s of pr.samples.filter((x) => x.wp !== null)) { g.strokeStyle = css('--muted'); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(s.s), pad.t); g.lineTo(X(s.s), 150 - pad.b); g.stroke(); g.setLineDash([]); g.fillText(s.wp === 0 ? 'Site' : `W${s.wp}`, Math.min(X(s.s) + 3, w - 30), 150 - 6); }
    cv.setAttribute('aria-label', `Ground height along the route: ${(pr.totalM / 1000).toFixed(1)} km from ${Math.round(lo)} to ${Math.round(hi)} m, climb ${Math.round(pr.climbM)} m, steeper than ${m.rmax}° on ${Math.round(pr.steep * 100)}% of it.`);
  }

  // Arrival at each stop when driving at m.speed (km/h) along the straight legs, leaving at the moment chosen in
  // "Sun and Earth over the horizon"; no stops on the way. Without a speed, only the mission-long shares are shown.
  function timing() {
    if (!last) return;
    const { rows, t0, t1 } = last, dep = st.land + st.mapH * HOUR;
    for (const w of rows) {
      w.tArr = m.speed ? dep + (w.at / 1000 / m.speed) * HOUR : null;
      w.arr = w.tArr !== null && w.tArr <= t1 ? sample(eph, w.s, w.s.horizon, w.tArr) : null;
    }
    drawBands(rows, t0, t1);
    const when = (w) => {
      if (w.tArr === null) return '';
      if (w.tArr > t1) return `<span class="warn">arrives after the mission ends (${fmtDur(w.tArr - dep)} drive)</span>`;
      const sun = w.arr.sunMargin > 0, earth = w.arr.earthMargin > 0;
      return `<span class="${sun && earth ? 'okay' : 'warn'}">${w.name === 'Site' ? 'leave' : 'arrive'} day ${((w.tArr - st.land) / DAY).toFixed(1)}: ${sun ? 'Sun up' : 'dark'}, ${earth ? 'Earth up' : 'no Earth'}</span>`;
    };
    $('pRouteList').innerHTML = rows.map((w) => `<li class="wp"><b>${w.name}</b><span>${(w.at / 1000).toFixed(1)} km</span><span>Sun ${Math.round(w.sum.sunlit * 100)}%</span><span>Earth ${Math.round(w.sum.earthVisible * 100)}%</span><span>longest dark ${fmtDur(w.sum.longestDarkMs)}</span>${when(w)}</li>`).join('');
  }

  function drawBands(rows, t0, t1) {
    const RH = 30, cv = $('pRouteBands'), { g, w } = setupCanvas(cv, rows.length * RH + 4), L = 44, X = (t) => L + ((t - t0) / (t1 - t0)) * (w - L);
    g.font = '600 12px system-ui, sans-serif';
    rows.forEach((row, i) => {
      const y = i * RH + 2;
      g.fillStyle = css('--text'); g.fillText(row.name, 2, y + 18);
      for (const [key, c, dy] of [['sunMargin', css('--sun'), 0], ['earthMargin', css('--earth'), 13]]) {
        g.fillStyle = css('--track'); g.fillRect(L, y + dy, w - L, 11); g.fillStyle = c;
        let on = null;
        for (const r of row.r) { if (r[key] > 0 && on === null) on = r.t; if (r[key] <= 0 && on !== null) { g.fillRect(X(on), y + dy, X(r.t) - X(on), 11); on = null; } }
        if (on !== null) g.fillRect(X(on), y + dy, X(t1) - X(on), 11);
      }
      if (row.tArr != null && row.tArr <= t1) { g.fillStyle = '#fff'; g.fillRect(X(row.tArr) - 1.5, y - 2, 3, 28); } // departure / arrival
    });
  }

  // ---------- map overlays, events, state ----------
  function overlays() {
    if (!polar()) return { paths: [], markers: [] };
    const sun0 = eph.topo({ lat: st.site.lat, lon: st.site.lon, hM: st.site.hM }, 'sun', st.land), hdg = heading(sun0);
    const paths = [{ pts: outline(m.ell.L, m.ell.W, hdg, 48).map(([E, N]) => enuToLatLon(st.site, E, N)), closed: true, color: '#fff', width: 2 }];
    if (m.wps.length) paths.push({ pts: [[st.site.lat, st.site.lon], ...m.wps], color: css('--accent'), width: 3 });
    return { paths, markers: m.wps.map(([lat, lon], i) => ({ lat, lon, label: `W${i + 1}`, color: css('--accent') })) };
  }
  function render() {
    if (m.siteKey !== null && m.siteKey !== st.site.key) { m.wps = []; m.adding = false; } // a route belongs to its landing site
    m.siteKey = st.site.key;
    for (const [id, v] of [['eLen', m.ell.L], ['eWid', m.ell.W], ['eHdg', m.ell.hdg ?? ''], ['eMax', m.ell.max], ['eElMin', m.ell.elMin], ['eElMax', m.ell.elMax], ['rMax', m.rmax], ['rSpeed', m.speed ?? '']]) if (document.activeElement !== $(id)) $(id).value = v;
    renderEllipse().catch((e) => { setStatus(e.message); console.error(e); });
    renderRoute().catch((e) => { setStatus(e.message); console.error(e); });
  }
  const num = (id, lo, hi, dflt) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; };
  function changed() { render(); updateMap(); onChange(); }
  function bind() {
    for (const id of ['eLen', 'eWid', 'eHdg', 'eMax', 'eElMin', 'eElMax']) $(id).addEventListener('change', () => {
      m.ell = { L: num('eLen', 50, 10000, ELLIPSE_DEFAULTS.L), W: num('eWid', 20, 10000, ELLIPSE_DEFAULTS.W), hdg: $('eHdg').value === '' ? null : ((Math.round(num('eHdg', -360, 720, 0)) % 360) + 360) % 360, max: num('eMax', 0.5, 60, ELLIPSE_DEFAULTS.max), elMin: num('eElMin', -5, 90, ELLIPSE_DEFAULTS.elMin), elMax: num('eElMax', -5, 90, ELLIPSE_DEFAULTS.elMax) };
      changed();
    });
    $('rMax').addEventListener('change', () => { m.rmax = num('rMax', 0.5, 60, ROUTE_MAX); changed(); });
    $('rSpeed').addEventListener('change', () => { const v = parseFloat($('rSpeed').value); m.speed = v > 0 ? Math.min(v, 100) : null; timing(); onChange(); });
    $('rAdd').addEventListener('click', () => { m.adding = !m.adding; changed(); if (m.adding) $('pMap').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    $('rUndo').addEventListener('click', () => { m.wps.pop(); changed(); });
    $('rClear').addEventListener('click', () => { m.wps = []; m.adding = false; changed(); });
    $('rGo').addEventListener('click', () => {
      const lat = parseFloat($('rLat').value), lon = parseFloat($('rLon').value);
      if (!(lat >= -90 && lat <= -75 && lon >= -180 && lon <= 360)) { setStatus('Waypoints need a latitude between -90 and -75 and a longitude between -180 and 360.'); return; }
      setStatus(''); if (m.wps.length < MAX_WP) { m.wps.push([lat, lon > 180 ? lon - 360 : lon]); changed(); }
    });
    $('pLandBox').addEventListener('click', (e) => { if (e.target.id === 'pLand240' || e.target.id === 'pLit240') { setStatus('Loading 240 m south-polar terrain (29 MB, first time only)…'); e.target.disabled = true; loadGrid('polar240').then(() => { setStatus(''); changed(); }).catch((x) => setStatus(x.message)); } });
  }
  return {
    m, render, bind, overlays,
    adding: () => m.adding && polar(),
    addWaypoint(lat, lon) { if (m.wps.length < MAX_WP) m.wps.push([+lat.toFixed(5), +lon.toFixed(5)]); if (m.wps.length >= MAX_WP) m.adding = false; changed(); },
    resize() { if (st.site) render(); },
    timing,
    params() {
      const e = m.ell, d = ELLIPSE_DEFAULTS, out = {};
      if (e.L !== d.L || e.W !== d.W || e.hdg !== d.hdg || e.max !== d.max || e.elMin !== d.elMin || e.elMax !== d.elMax) out.ell = [e.L, e.W, e.hdg ?? 'a', e.max, e.elMin, e.elMax].join(',');
      if (m.wps.length) out.wp = m.wps.map((p) => p.join(',')).join(';');
      if (m.rmax !== ROUTE_MAX) out.rmax = m.rmax;
      if (m.speed) out.rspd = m.speed;
      return out;
    },
    load(q) {
      const e = (q.ell || '').split(',');
      if (e.length === 6) m.ell = { L: +e[0] || ELLIPSE_DEFAULTS.L, W: +e[1] || ELLIPSE_DEFAULTS.W, hdg: e[2] === 'a' ? null : +e[2], max: +e[3] || ELLIPSE_DEFAULTS.max, elMin: +e[4], elMax: +e[5] };
      m.wps = (q.wp || '').split(';').filter(Boolean).map((p) => p.split(',').map(Number)).filter(([a, b]) => a <= -75 && a >= -90 && Number.isFinite(b)).slice(0, MAX_WP);
      if (q.rmax) m.rmax = +q.rmax || ROUTE_MAX;
      m.speed = +q.rspd > 0 ? Math.min(+q.rspd, 100) : null;
      m.siteKey = null;
    },
  };
}
