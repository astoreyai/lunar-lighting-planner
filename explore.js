// Explore mode: compare a few sites over a month in plain words, with the lit-terrain map as the centrepiece.
import { series, sample, summary, events } from './windows.js';
import { traceRays } from './horizon.js';
import { stack } from './dem.js';
import { $, HOUR, DAY, T_MIN, T_MAX, eph, data, customSite, siteByKey, siteOptions, fmtDur, fmtUTC, fmtDay, isoMin, css, setupCanvas, setStatus, ICON, loadGrid, EYE_M } from './core.js';
import { createGlobe } from './globe.js';
import { earthAlways } from './globe-math.js';
import { createLitMap } from './litmap.js';
import { drawSky } from './sky.js';
import { createPair } from './pair.js';

const SKY_RANGE = [-5, 15]; // the same scale on every card so sites compare by eye

const MONTH_H = 30 * 24, MAX_SITES = 4;
export const DEFAULT_EXPLORE = ['im2_athena', 'im1_odysseus', 'apollo11', 'change4'];

export function createExplore({ onChange, onPlan }) {
  const st = { sites: [], start: 0, h: 0, playing: false };
  const cache = new Map();
  const month = (s) => {
    const k = `${s.key}|${st.start}`;
    if (!cache.has(k)) { if (cache.size > 40) cache.clear(); const rows = series(eph, s, s.horizon, st.start, Math.min(st.start + MONTH_H * HOUR, T_MAX), 30 * 60e3); cache.set(k, { rows, sum: summary(rows) }); }
    return cache.get(k);
  };
  const map = createLitMap($('xMap'), {
    onPick: (lat, lon) => guard(async () => { if (st.sites.length >= MAX_SITES) st.sites.pop(); st.sites.push(await customSite(lat, lon)); }),
    describe: (v) => `Map of the lunar south pole at ${fmtUTC(v.t)}: ${Math.round((v.frame?.litFraction ?? 0) * 100)}% of it is in sunlight right now; the rest is in shadow.`,
  });

  const now = () => st.start + st.h * HOUR;
  const pair = createPair({ now, start: () => st.start });
  let lastMap = 0;
  function pills(s) {
    const { rows } = month(s), t = now(), p = sample(eph, s, s.horizon, t);
    const nx = (key) => events(rows, key).find((e) => e.t > t);
    const pill = (up, e, cls, icon, upW, downW, setW, riseW) => `<span class="pill ${up ? `on ${cls}` : 'off'}">${icon}${up ? upW : downW}<small>${e ? `${up ? setW : riseW} in ${fmtDur(e.t - t)}` : 'all month'}</small></span>`;
    return pill(p.sunMargin > 0, nx('sunMargin'), 'sun', ICON.sun, 'Sunlit', 'Dark', 'sets', 'rises')
      + pill(p.earthMargin > 0, nx('earthMargin'), 'earth', ICON.earth, 'Earth in view', 'No Earth', 'sets', 'rises');
  }
  // ---------- Spin the Moon ----------
  let globe = null, globeStarting = false, globeGrid = null, gPoint = null, gSite = null, settleToken = 0;
  const fmtPos = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  const elw = (e) => (e >= 0 ? `${e.toFixed(1)}° up` : `${(-e).toFixed(1)}° below the horizon`);
  async function startGlobe() {
    if (globe || globeStarting) return;
    globeStarting = true;
    try {
      globeGrid = await loadGrid('global4');
      globe = await createGlobe($('gCanvas'), { onMove: readNow, onSettle: (la, lo) => settle(la, lo).catch((e) => setStatus(e.message)) });
      globe.resize(); globeTime(); globeMarkers();
      globe.lookAt(-62, 25); // the south polar region and the Earth-facing limb
    } catch (e) {
      $('gFail').hidden = false; $('gFail').textContent = `The globe couldn't start here (${e.message}). The map and site cards below still work.`;
      console.error(e);
    } finally { globeStarting = false; }
  }
  const globeTime = () => { if (globe) { const t = now(); globe.setTime(globeGrid, eph.bodyVec('sun', t), eph.bodyVec('earth', t), { moving: st.playing }); if (gPoint) readNow(...gPoint); if (gSite) renderMore(); } };
  const globeMarkers = () => globe?.setMarkers(st.sites.map((s) => ({ lat: s.lat, lon: s.lon })));
  // Live, on every move: the real terrain toward the Sun and toward Earth (two rays, not the full 720-ray horizon),
  // with the finest terrain already loaded (240 m near the south pole once fetched, else the 7.6 km global grid).
  let polarFetch = null;
  function readNow(lat, lon) {
    gPoint = [lat, lon];
    const g = data.grids, polar = lat <= -75;
    if (polar && !g.polar240 && !polarFetch) polarFetch = loadGrid('polar240').then(() => gPoint && readNow(...gPoint)).catch(() => {}); // on failure, don't refetch per move: the settled trace retries the load
    const terrain = stack([polar && g.polar240?.sampler, g.global4.sampler].filter(Boolean)), t = now();
    const site = { lat, lon, hM: terrain.sample(lat, lon).h + EYE_M }, s = eph.topo(site, 'sun', t), e = eph.topo(site, 'earth', t);
    const rays = traceRays(terrain, lat, lon, [s.az, e.az], { eyeM: EYE_M, nearStepM: 120, farStepM: 240 }); // same steps as the settled trace
    const [hs, he] = rays.elev, sunUp = s.el + s.radiusDeg > hs, earthUp = e.el > he;
    const blocked = (el, h) => `${elw(el)}, terrain ${h.toFixed(1)}°`;
    const earthEver = { always: 'near side', never: 'far side: never rises', sometimes: 'libration zone' }[earthAlways(lat, lon)];
    $('gPos').textContent = fmtPos(lat, lon);
    $('gNow').innerHTML = `<div class="tile sun"><span class="tl">Sun</span><b>${sunUp ? 'Sunlit' : s.el + s.radiusDeg > 0 ? 'In shadow' : 'Night'}</b><small>${sunUp || s.el + s.radiusDeg <= 0 ? elw(s.el) : blocked(s.el, hs)}</small></div>
      <div class="tile earth"><span class="tl">Earth</span><b>${earthUp ? 'In view' : e.el > 0 ? 'Behind terrain' : 'Below horizon'}</b><small>${earthUp || e.el <= 0 ? elw(e.el) : blocked(e.el, he)} · ${earthEver}</small></div>`;
    $('gSrc').textContent = !polar ? '' : g.polar240 ? 'Readout: 240 m terrain (globe shadows: 7.6 km)' : 'Loading 240 m polar terrain…';
    if (gSite && (Math.abs(gSite.lat - lat) > 0.01 || Math.abs(gSite.lon - lon) > 0.01)) { gSite = null; $('gMore').innerHTML = '<p class="hint">Stop turning for this month’s figures.</p>'; }
  }
  // Once the globe stops: trace the real terrain horizon at the crosshair and summarise the month.
  async function settle(lat, lon) {
    const token = ++settleToken;
    $('gMore').innerHTML = '<p class="hint">Tracing the terrain horizon…</p>';
    await new Promise((r) => setTimeout(r));
    const site = await customSite(lat, lon, { fast: true });
    if (token !== settleToken) return; // the globe moved on
    gSite = site; renderMore();
  }
  function renderMore() {
    const { sum, rows } = month(gSite), t = now(), p = sample(eph, gSite, gSite.horizon, t);
    const next = (key) => events(rows, key).find((e) => e.t > t), sn = next('sunMargin');
    $('gMore').innerHTML = `<dl class="stats four"><div><dt>${p.sunMargin > 0 ? 'Sunset' : 'Sunrise'}</dt><dd>${sn ? `in ${fmtDur(sn.t - t)}` : 'not this month'}</dd></div><div><dt>Sunlit this month</dt><dd>${Math.round(sum.sunlit * 100)}%</dd></div><div><dt>Longest night</dt><dd>${fmtDur(sum.longestDarkMs)}</dd></div><div><dt>Earth in view</dt><dd>${Math.round(sum.earthVisible * 100)}%</dd></div></dl>`;
  }
  async function pointSite() {
    if (!globe) throw new Error('The globe isn’t ready yet.');
    const [lat, lon] = globe.centre();
    if (!gSite || Math.abs(gSite.lat - lat) > 0.01 || Math.abs(gSite.lon - lon) > 0.01) await settle(lat, lon);
    return gSite;
  }

  const earthWords = (f) => (f > 0.999 ? 'always in view' : f < 0.001 ? 'never in view' : `in view ${Math.round(f * 100)}% of the time`);

  function render() {
    $('xSites').innerHTML = st.sites.map((s, i) => `<li class="chip"><span>${s.short}</span><button type="button" data-rm="${i}" aria-label="Remove ${s.short}">${ICON.none}</button></li>`).join('');
    $('xAdd').innerHTML = `<option value="">Add a site…</option>${siteOptions('')}`;
    $('xAdd').disabled = false;
    $('xStart').value = isoMin(st.start).slice(0, 10);
    renderCards(); renderTime(); startGlobe(); globeMarkers(); pair.render(); pair.refresh();
    onChange();
  }

  function renderCards() {
    const t = now();
    $('xCards').innerHTML = st.sites.map((s, i) => {
      const { sum } = month(s);
      return `<article class="card"><h3>${s.short}</h3><p class="where">${Math.abs(s.lat).toFixed(1)}°${s.lat < 0 ? 'S' : 'N'}, ${Math.abs(s.lon).toFixed(1)}°${s.lon < 0 ? 'W' : 'E'}</p>
        <p class="nowline">${pills(s)}</p>
        <dl class="stats three"><div><dt>Sunlit</dt><dd>${Math.round(sum.sunlit * 100)}%</dd></div><div><dt>Longest night</dt><dd>${fmtDur(sum.longestDarkMs)}</dd></div><div><dt>Earth in view</dt><dd>${Math.round(sum.earthVisible * 100)}%</dd></div></dl>
        <canvas class="sky" data-s="${i}" role="img" aria-label="Sky all the way round ${s.short}"></canvas>
        <canvas class="band" data-i="${i}" role="img" aria-label="Sun and Earth over the month at ${s.short}: sunlit ${Math.round(sum.sunlit * 100)}% of the time, Earth ${earthWords(sum.earthVisible)}."></canvas></article>`;
    }).join('') || '<p class="empty">Add a site, or tap the map to drop a point.</p>';
    drawBands(); drawSkies();
  }

  function drawSkies() {
    for (const cv of document.querySelectorAll('#xCards canvas.sky')) {
      const s = st.sites[+cv.dataset.s];
      drawSky(cv, { site: s, cur: sample(eph, s, s.horizon, now()), height: 96, range: SKY_RANGE, compact: true });
    }
  }

  function drawBands() {
    for (const cv of document.querySelectorAll('#xCards canvas.band')) {
      const s = st.sites[+cv.dataset.i], { rows } = month(s), { g, w } = setupCanvas(cv, 34), t0 = st.start, t1 = st.start + MONTH_H * HOUR;
      const X = (t) => ((t - t0) / (t1 - t0)) * w;
      for (const [key, col, y] of [['sunMargin', css('--sun'), 2], ['earthMargin', css('--earth'), 19]]) {
        g.fillStyle = css('--track'); g.fillRect(0, y, w, 13); g.fillStyle = col;
        let on = null;
        for (const r of rows) { if (r[key] > 0 && on === null) on = r.t; if (r[key] <= 0 && on !== null) { g.fillRect(X(on), y, X(r.t) - X(on), 13); on = null; } }
        if (on !== null) g.fillRect(X(on), y, w - X(on), 13);
      }
      g.fillStyle = '#fff'; g.fillRect(X(now()) - 1, 0, 2, 34);
    }
  }

  function renderTime() {
    $('xTime').value = st.h;
    $('xTimeLabel').textContent = `${fmtUTC(now())} · day ${Math.floor(st.h / 24) + 1} of 30`;
    const markers = st.sites.filter((s) => s.lat <= -75).map((s) => ({ lat: s.lat, lon: s.lon, label: s.short, color: css('--sun') }));
    const off = st.sites.filter((s) => s.lat > -75).map((s) => s.short);
    $('xMapNote').textContent = off.length ? `Off this map (south of 75°S only): ${off.join(', ')}.` : '';
    const outlines = [...data.sites.values()].filter((x) => x.outline).map((x) => ({ pts: x.outline, main: st.sites.some((y) => y.key === x.key) }));
    // While playing, the 160 ms polar map redraws at most every 0.4 s; the globe and cards keep every frame.
    const tNow = performance.now();
    if (!st.playing || tNow - lastMap > 400) { lastMap = tNow; map.set({ zoom: 'pole', t: now(), markers, outlines }).catch((e) => setStatus(e.message)); }
    globeTime();
  }

  async function guard(fn) { try { await fn(); await eph.ensure(st.start, Math.min(st.start + (MONTH_H + 24) * HOUR, T_MAX)); render(); } catch (e) { setStatus(e.message); console.error(e); } }

  // Playback runs on the clock, not per frame: a month takes ~12 s however slowly the map redraws.
  const HOURS_PER_SECOND = MONTH_H / 12;
  let frame = 0, last = 0;
  function tick(ts) {
    if (last) st.h = Math.round((st.h + ((ts - last) / 1000) * HOURS_PER_SECOND) % MONTH_H);
    last = ts;
    renderTime(); renderCardsLight();
    frame = requestAnimationFrame(tick);
  }
  // During play only the "right now" pills and the band cursors change.
  function renderCardsLight() {
    const t = now();
    document.querySelectorAll('#xCards .card').forEach((el, i) => { el.querySelector('.nowline').innerHTML = pills(st.sites[i]); });
    drawBands(); drawSkies(); pair.draw();
  }

  function bind() {
    pair.bind();
    $('gCompare').addEventListener('click', () => guard(async () => { const s = await pointSite(); if (!st.sites.some((x) => x.key === s.key)) { if (st.sites.length >= MAX_SITES) st.sites.shift(); st.sites.push(s); } }));
    $('gPlan').addEventListener('click', () => pointSite().then((s) => onPlan(s)).catch((e) => setStatus(e.message)));
    for (const el of document.querySelectorAll('.nudges')) el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !globe) return;
      if (b.dataset.zoom) globe.zoom(+b.dataset.zoom);
      else if (b.dataset.twist) globe.twist(+b.dataset.twist);
      else if (b.dataset.north) globe.northUp();
      else if (b.dataset.goto) globe.lookAt(...b.dataset.goto.split(',').map(Number));
    });
    $('xSites').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) guard(async () => { st.sites.splice(+b.dataset.rm, 1); }); });
    $('xAdd').addEventListener('change', () => { const k = $('xAdd').value; if (k) guard(async () => { if (!st.sites.some((s) => s.key === k)) { if (st.sites.length >= MAX_SITES) st.sites.shift(); st.sites.push(await siteByKey(k)); } }); });
    $('xStart').addEventListener('change', () => guard(async () => { const t = Date.parse(`${$('xStart').value}T00:00Z`); if (!Number.isNaN(t)) st.start = Math.min(Math.max(t, T_MIN), T_MAX - (MONTH_H + 24) * HOUR); }));
    $('xTime').addEventListener('input', () => { st.h = +$('xTime').value; renderTime(); renderCardsLight(); onChange(); });
    $('xPlay').addEventListener('click', () => {
      st.playing = !st.playing;
      $('xPlay').setAttribute('aria-pressed', st.playing); $('xPlay').querySelector('span').textContent = st.playing ? 'Pause' : 'Play';
      cancelAnimationFrame(frame);
      last = 0;
      if (st.playing) frame = requestAnimationFrame(tick); else { renderTime(); onChange(); }
    });
  }

  return {
    st, bind, render, guard,
    stop() { if (st.playing) $('xPlay').click(); },
    resize() { globe?.resize(); pair.draw(); if (st.sites.length) { renderTime(); drawBands(); drawSkies(); } },
    globe: () => globe,
    params() { return { ex: st.sites.map((s) => s.key).join(';'), xs: isoMin(st.start).slice(0, 10), xh: st.h }; },
    async load(q) {
      const keys = (q.ex ? q.ex.split(';') : DEFAULT_EXPLORE).filter((k) => k.startsWith('custom:') || data.sites.has(k)).slice(0, MAX_SITES);
      st.sites = await Promise.all(keys.map(siteByKey));
      const s = q.xs ? Date.parse(`${q.xs}T00:00Z`) : Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
      st.start = Math.min(Math.max(Number.isNaN(s) ? T_MIN : s, T_MIN), T_MAX - (MONTH_H + 24) * HOUR);
      st.h = Math.min(Math.max(+(q.xh || 0), 0), MONTH_H);
      await eph.ensure(st.start, Math.min(st.start + (MONTH_H + 24) * HOUR, T_MAX));
    },
  };
}
