// Planner mode: one scenario (site, landing time, mission needs) -> verdict, nearest workable dates,
// other sites that day, nearby points, mission timeline, lit-terrain map; expert views folded away.
import { series, sample, landingCall as landingVerdict, events, usableWindows } from './windows.js';
import { assumptions, missionCsv } from './export.js';
import { R_MOON_M } from './dem.js';
import { $, HOUR, DAY, T_MIN, T_MAX, APP_VERSION, eph, data, customSite, siteByKey, siteOptions, fmtDur, fmtUTC, fmtDay, fmtDayShort, isoMin, compass, css, setupCanvas, setStatus, ICON } from './core.js';
import { createLitMap, hasClose } from './litmap.js';
import { RAMP, RAMP_LOW, EL_MAX } from './suit.js';
import { drawSky } from './sky.js';
import { createMission } from './mission.js';

const RANGE_D = 90, LOOK_BACK_D = 7, LOOK_D = 30; // windows listed at a place; the span searched for places and landing areas
// Ephemeris years the planner reads around a landing: verdicts reach RANGE_D days plus a 60-day mission past it.
const ensureAround = (t) => eph.ensure(Math.max(t - RANGE_D * DAY, T_MIN), Math.min(t + (RANGE_D + 62) * DAY, T_MAX));
const seriesCache = new Map();
function hourly(site, from, to) {
  const k = `${site.key}|${from}|${to}`;
  if (!seriesCache.has(k)) { if (seriesCache.size > 200) seriesCache.clear(); seriesCache.set(k, series(eph, site, site.horizon, from, to, HOUR)); }
  return seriesCache.get(k);
}

export function createPlanner({ onChange }) {
  const st = { site: null, land: 0, durD: 10, minShare: 0, earth: true, mapH: 0, near: null, notice: '', linkNote: null, cmp: [], layer: 'sun', from: 0, ptab: 'Places', sort: 'size', period: 'span' }; // layer: what the map shows; sort: the order of the listed areas; period: what the landing layer covers // from: the date the search for places and windows starts at
  const req = () => ({ minShare: st.minShare, earth: st.earth });
  const PT = ['Places', 'Compare', 'Tools']; // the sections under the answer and the map; st.ptab is the one shown
  const showTab = () => PT.forEach((k) => { const on = k === st.ptab; $(`pt${k}`).setAttribute('aria-selected', on); $(`pt${k}`).tabIndex = on ? 0 : -1; $(`pp${k}`).hidden = !on; });
  const map = createLitMap($('pMap'), {
    onPick: (lat, lon) => (mission.adding() ? mission.addWaypoint(lat, lon) : guard(async () => { st.site = await customSite(lat, lon); st.near = null; })),
    describe: (v) => (v.frame?.land ? `Map of the best places to land for this mission. ${bestText(v.frame.land)} ${st.site.short} is marked with a ring.` : `Lit-terrain map at ${fmtUTC(v.t)}: ${Math.round((v.frame?.litFraction ?? 0) * 100)}% of the area shown is in sunlight. ${st.site.short} is marked with a ring.`),
  });

  // Landing ellipse and surface route; adding a waypoint zooms the map to the site so the route is visible.
  const mission = createMission({ st, onChange: () => onChange(), updateMap: () => { if (mission.adding() && map.view.zoom !== 'site') { map.view.zoom = 'site'; $('pZoom').value = 'site'; } updateMap(); } });

  // ---------- computations ----------
  // Usable windows at a site over [from, to]. Each offers a landing at its first full hour; `fits` if the mission ends before it closes.
  const ceilHour = (t) => Math.ceil(t / HOUR) * HOUR;
  function windowsAt(site, from, to) {
    const rows = hourly(site, from, to), end = rows[rows.length - 1].t;
    return usableWindows(rows, req()).map((w) => {
      const land = ceilHour(w.open), close = w.close ?? end;
      return { ...w, land, len: close - w.open, endKnown: w.close !== null, fits: close - land >= st.durD * DAY };
    }).filter((w) => w.land < (w.close ?? end));
  }
  const siteRange = () => [Math.max(st.land - RANGE_D * DAY, T_MIN), Math.min(st.land + (RANGE_D + st.durD + 1) * DAY, T_MAX)];
  // The search span: a week before the chosen date to 30 days after it, plus the mission, so a whole lunar day is covered.
  const lookRange = () => [Math.max(st.from - LOOK_BACK_D * DAY, T_MIN), Math.min(st.from + (LOOK_D + st.durD) * DAY, T_MAX)];
  // A place in the search span: its first window that holds the mission, else its longest one.
  function placeInfo(site) {
    const ws = windowsAt(site, ...lookRange()), fit = ws.find((w) => w.fits), longest = [...ws].sort((a, b) => b.len - a.len)[0];
    return { site, w: fit || longest || null, fits: !!fit, rank: fit ? 1e13 + fit.len : longest ? longest.len : 0 };
  }
  const verdictAt = (site, t) => landingVerdict(hourly(site, t, Math.min(t + (st.durD + 1) * DAY, T_MAX)), 0, st.durD * 24, req());

  function why(v) {
    const p = sample(eph, st.site, st.site.horizon, st.land), dirS = compass(p.sun.az), dirE = compass(p.earth.az);
    if (!v) return 'This landing runs past the end of the ephemeris (2040).';
    if (v.verdict === 'none' && v.reason.startsWith('Earth')) {
      return p.earth.el < -1.5 ? `Earth is ${(-p.earth.el).toFixed(1)}° below the horizon: from here it never rises (the far side always faces away from Earth), or it's at the low point of its monthly wobble.`
        : `Earth is ${p.earth.el.toFixed(1)}° up toward the ${dirE}, but terrain there rises to ${p.earthHorizon.toFixed(1)}° and hides it.`;
    }
    if (v.verdict === 'none') {
      if (p.sun.el + p.sun.radiusDeg < 0) return `The Sun is ${(-p.sun.el).toFixed(1)}° below the horizon toward the ${dirS}: it's lunar night here.`;
      if (st.minShare > 0 && p.sunMargin > 0) return `Only ${Math.round(p.sunFraction * 100)}% of the Sun's disk clears the terrain to the ${dirS}; your power needs ${Math.round(st.minShare * 100)}%.`;
      return `The Sun is ${p.sun.el.toFixed(1)}° up toward the ${dirS}, but terrain there rises to ${p.sunHorizon.toFixed(1)}° and blocks it.`;
    }
    if (v.verdict === 'short') {
      const what = (r, lead) => (r === 'power' ? (st.minShare > 0 ? (lead ? 'Usable sunlight ends' : 'usable sunlight ends') : (lead ? 'The Sun sets behind the terrain' : 'the Sun sets')) : (lead ? 'Earth drops behind the terrain' : 'Earth drops out of view'));
      const then = v.then ? (Math.ceil(v.then.lostMs / HOUR) === Math.ceil(v.lostMs / HOUR) ? `, and ${what(v.then.reason, false)} in the same hour` : `; ${what(v.then.reason, false)} later, at ${fmtDur(v.then.lostMs)}`) : '';
      return `${what(v.reason, true)} first, about ${fmtDur(v.lostMs)} after landing${then}. The mission needs ${st.durD} days.${v.range && fmtDur(v.range[0]) !== fmtDur(v.range[1]) ? ` Allowing for the terrain's uncertainty, that first loss comes between ${fmtDur(v.range[0])} and ${fmtDur(v.range[1])} after landing.` : ''}`;
    }
    const rows = series(eph, st.site, st.site.horizon, st.land, Math.min(st.land + 30 * DAY, T_MAX), 10 * 60e3), set = events(rows, 'sunMargin').find((e) => !e.rising);
    return `The Sun stays up${st.earth ? ' and Earth stays in view' : ''} for all ${st.durD} days. ${set ? `Sunset comes ${fmtDur(set.t - st.land)} after landing.` : 'No sunset in the next 30 days.'}`;
  }

  // What the terrain's uncertainty does to a verdict that is too close to call.
  const say = (x) => (x.verdict === 'full' ? 'a full mission' : x.verdict === 'short' ? `cut short after ${fmtDur(x.lostMs)} (${x.reason === 'power' ? 'Sun' : 'Earth'} lost)` : `unable to start (${x.reason})`);
  const closeText = (v) => (v?.close ? `Too close to call: the answer changes within the terrain's uncertainty. With the terrain higher than mapped by that much, this landing is ${say(v.close.worse)}; with it lower, ${say(v.close.better)}.` : '');
  const closeTag = (v) => (v?.close ? ' · too close to call' : '');
  const scenario = () => String(new URLSearchParams({ mode: 'plan', ...api.params() }));
  const facts = () => ({ site: st.site, durD: st.durD, minShare: st.minShare, earth: st.earth, version: APP_VERSION, dataId: data.dataId, levels: data.unc });

  // ---------- rendering ----------
  const TITLE = { full: 'Full mission', short: 'Cut short', none: "Can't start" };
  function render() {
    showTab();
    $('pSite').innerHTML = `${st.site.key.startsWith('custom:') ? `<option value="" selected>${st.site.name}</option>` : ''}${siteOptions(st.site.key)}`;
    $('pLand').min = isoMin(T_MIN); $('pLand').max = isoMin(landMax());
    if (st.linkNote && st.linkNote.site !== st.site) st.linkNote = null; // said once, until another place is chosen
    $('pNotice').textContent = [st.linkNote?.text, st.notice].filter(Boolean).join(' '); $('pNotice').hidden = !$('pNotice').textContent;
    $('pLand').value = isoMin(st.land); $('pDur').value = st.durD; $('pShare').value = String(st.minShare); $('pEarth').checked = st.earth;
    $('pLat').value = st.site.lat.toFixed(3); $('pLon').value = st.site.lon.toFixed(3);
    const act = st.site.landing_utc && Date.parse(st.site.landing_utc);
    $('pActual').hidden = !act;
    if (act) $('pActual').textContent = `Use the actual landing (${fmtUTC(act)})`;
    $('pScenSum').textContent = `${st.site.short} · ${fmtUTC(st.land)} · ${st.durD}-day mission${st.earth ? ' · needs Earth contact' : ''}`;
    $('pSiteInfo').innerHTML = `${st.site.lat.toFixed(3)}°, ${st.site.lon.toFixed(3)}°E · ${Math.round(st.site.ground_m)} m${st.site.source_url ? ` · <a href="${st.site.source_url}" target="_blank" rel="noopener">source</a>` : ''}`;
    // Regions, candidate sites and crash sites carry a caveat the verdict depends on: show it.
    $('pSiteNote').textContent = !st.site.landing_utc || /crash|impact/i.test(st.site.note || '') ? (st.site.note || '') : '';
    $('pSiteNote').hidden = !$('pSiteNote').textContent;
    const v = verdictAt(st.site, st.land), kind = v?.verdict || 'none';
    const card = $('pVerdict');
    card.className = `verdict ${kind}`;
    $('pVerdictTitle').innerHTML = `<span class="vi">${ICON[kind]}</span>${v ? `${TITLE[kind]} on ${fmtDay(st.land)}` : 'No answer for this date'}`;
    $('pWhy').textContent = why(v);
    $('pClose').textContent = closeText(v); $('pClose').hidden = !v?.close;
    const fa = assumptions(facts());
    $('pAssumeSum').textContent = `${fa[1][1]} · ${(st.site.horizon_grids || st.site.horizon.grids).map((g) => g.replace('LOLA ', '')).join(' + ')} · hourly · DE441 · app ${APP_VERSION}, data ${data.dataId}`;
    $('pAssumeTable').tBodies[0].innerHTML = fa.map(([k, val]) => `<tr><th scope="row">${k}</th><td>${val}</td></tr>`).join('');
    renderWindows(kind);
        renderPlaces(); renderClps(); renderNear(); renderCompare(); renderTimeline(); renderMoment(); updateMap(); mission.render(); renderCalendarIfOpen().catch((e) => setStatus(e.message));
    onChange();
  }

  // ---------- the selected place: its usable windows ----------
  const hm = (t) => new Date(t).toISOString().slice(11, 16), dayHm = (t) => `${fmtDayShort(t)} ${hm(t)}`;
  const BY = { power: 'the Sun sets', earth: 'Earth sets' };
  function renderWindows(kind) {
    const [from, to] = siteRange(), all = windowsAt(st.site, from, to), ws = all.filter((w) => w.len >= 6 * HOUR), need = st.durD * DAY;
    const maxLen = Math.max(need, ...ws.map((w) => w.len)), nFit = ws.filter((w) => w.fits).length;
    $('pWinsLead').textContent = ws.length ? `${ws.length} window${ws.length > 1 ? 's' : ''} of sunlight${st.earth ? ' with Earth in view' : ''} at ${st.site.short} between ${fmtDay(from)} and ${fmtDay(to)}; ${nFit} hold${nFit === 1 ? 's' : ''} a ${st.durD}-day mission. Choosing one sets the landing to its first full hour.${all.length > ws.length ? ` ${all.length - ws.length} shorter than 6 hours not listed.` : ''}`
      : `No window of 6 hours or more at ${st.site.short} between ${fmtDay(from)} and ${fmtDay(to)}.`;
    $('pWins').innerHTML = ws.map((w) => {
      const close = w.close ?? to, sel = st.land >= w.open - HOUR && st.land < close, short = need - (close - w.land);
      const what = `${w.openedBy ? dayHm(w.open) : `before ${dayHm(w.open)}`} to ${w.endKnown ? dayHm(close) : 'past the range shown'}`, how = `${fmtDur(w.len)}${w.endKnown ? ` · ${BY[w.closedBy]}` : ' or more'}`, fit = w.fits ? `holds the mission${w.endKnown ? ` · land by ${dayHm(close - need)}` : ''}` : `${fmtDur(short)} short`;
      return `<li><button type="button" class="win ${w.fits ? 'full' : 'short'}${sel ? ' sel' : ''}" data-land="${w.land}" aria-pressed="${sel}" aria-label="Window from ${what}, ${how.replace(' · ', ', until ')}: ${fit}. Land at ${dayHm(w.land)} UTC."><span class="vi ${w.fits ? 'full' : 'short'}">${ICON[w.fits ? 'full' : 'short']}</span><span class="wd">${what}</span><span class="wbar" aria-hidden="true"><span style="width:${(100 * w.len / maxLen).toFixed(1)}%"></span><i style="left:${(100 * need / maxLen).toFixed(1)}%"></i></span><span class="wt">${how}</span><span class="wf">${fit}</span></button></li>`;
    }).join('');
    // Nearest windows that hold the mission, before and after the chosen landing.
    const fits = all.filter((w) => w.fits && w.land !== st.land), before = fits.filter((w) => w.land < st.land).pop(), after = fits.find((w) => w.land > st.land);
    const none = (side) => `<p class="none-near">${side === 'before' ? (from <= T_MIN ? 'No earlier window holds the mission: the data start on 1 Jan 1969.' : `No window in the ${RANGE_D} days before holds the mission.`) : (to >= T_MAX ? 'No later window holds the mission before the data end on 31 Dec 2040.' : `No window in the ${RANGE_D} days after holds the mission.`)}</p>`;
    const alt = (w, side) => (!w ? none(side) : `<button type="button" class="alt" data-land="${w.land}" aria-label="Land ${dayHm(w.land)} UTC, in a window of ${fmtDur(w.len)}">${side === 'before' ? '← ' : ''}${dayHm(w.land)} <small>${fmtDur(w.len)} window</small>${side === 'after' ? ' →' : ''}</button>`);
    $('pNearest').innerHTML = kind === 'full' ? '' : `<p class="lead">Nearest windows here that hold the mission</p><div class="alts">${alt(before, 'before')}${alt(after, 'after')}</div>`;
  }

  // ---------- other places for this mission ----------
  let places = [];
  function renderPlaces() {
    const [from, to] = lookRange();
    places = [...data.sites.values(), ...(st.site.key.startsWith('custom:') ? [st.site] : [])].map(placeInfo).sort((a, b) => b.rank - a.rank);
    const row = ({ site: s, w, fits }) => `<li><button type="button" class="siteRow${s.key === st.site.key ? ' cur' : ''}" ${s.key.startsWith('custom:') ? `data-lat="${s.lat}" data-lon="${s.lon}"` : `data-site="${s.key}"`}${w ? ` data-land="${w.land}"` : ''}><span class="vi ${!w ? 'none' : fits ? 'full' : 'short'}">${ICON[!w ? 'none' : fits ? 'full' : 'short']}</span><span class="nm">${s.short}${s.key === st.site.key ? ' <small>(selected)</small>' : ''}</span><span class="rs">${!w ? 'no usable window' : fits ? `opens ${dayHm(w.open)}, lasts ${fmtDur(w.len)}${w.endKnown ? '' : ' or more'}` : `longest window ${fmtDur(w.len)}`}</span></button></li>`;
    const future = places.filter((x) => !x.site.landing_utc), past = places.filter((x) => x.site.landing_utc), n = future.filter((x) => x.fits).length;
    $('pOthersLead').textContent = `A ${st.durD}-day mission${st.earth ? ' with Earth contact' : ''}, starting between ${fmtDay(from)} and ${fmtDay(Math.max(from, to - st.durD * DAY))}: ${n} of ${future.length} candidate sites and regions ${n === 1 ? 'has' : 'have'} a window that holds it.`;
    $('pOthers').innerHTML = future.map(row).join('');
    $('pOthersMore').innerHTML = past.map(row).join('');
    $('pPastSum').textContent = `Past landing sites, for reference (${past.filter((x) => x.fits).length} of ${past.length} would hold it)`;
  }

  function renderNear() {
    const polar = st.site.lat <= -75;
    $('pNearBtn').hidden = !polar;
    $('pNearNote').textContent = polar ? 'Checks this landing at 24 points 5–20 km away.' : 'Needs south-polar terrain: sites south of 75°S only.';
    if (!st.near || st.near.key !== `${st.site.key}|${st.land}|${st.durD}|${st.minShare}|${st.earth}`) { $('pNear').innerHTML = ''; return; }
    const rows = [...st.near.points].sort((a, b) => (b.v?.verdict === 'full') - (a.v?.verdict === 'full') || (b.v?.lostMs || 0) - (a.v?.lostMs || 0));
    const nFull = rows.filter((p) => p.v?.verdict === 'full').length;
    $('pNear').innerHTML = `<p class="lead">${nFull ? `${nFull} of ${rows.length} nearby points give a full mission.` : `None of the ${rows.length} nearby points gives a full mission on this date.`}</p><ul class="rows">${rows.slice(0, 8).map((p) => `<li><button type="button" class="siteRow" data-lat="${p.site.lat}" data-lon="${p.site.lon}"><span class="vi ${p.v?.verdict || 'out'}">${p.v ? ICON[p.v.verdict] : ''}</span><span class="nm">${p.label}</span><span class="rs">${!p.v ? '' : p.v.verdict === 'full' ? 'full mission · use this point' : p.v.verdict === 'short' ? `${p.v.reason === 'power' ? 'Sun' : 'Earth'} lost after ${fmtDur(p.v.lostMs)}` : p.v.reason}${closeTag(p.v)}</span></button></li>`).join('')}</ul>`;
  }

  async function searchNear() {
    const key = `${st.site.key}|${st.land}|${st.durD}|${st.minShare}|${st.earth}`, base = st.site, pts = [];
    const btn = $('pNearBtn'); btn.disabled = true;
    try {
      const D2R = Math.PI / 180, p1 = base.lat * D2R, l1 = base.lon * D2R;
      for (const km of [5, 10, 20]) for (let a = 0; a < 360; a += 45) {
        const d = (km * 1000) / R_MOON_M, th = a * D2R, sp2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th);
        const lat = Math.asin(sp2) / D2R, lon = (l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sp2)) / D2R;
        setStatus(`Checking nearby point ${pts.length + 1} of 24…`);
        await new Promise((r) => setTimeout(r)); // let the progress line paint
        const label = `${km} km ${compass(a)}`, site = await customSite(lat, ((lon + 540) % 360) - 180, { fast: true, name: `${label} of ${base.short}` });
        pts.push({ site, label, v: verdictAt(site, st.land) });
      }
      st.near = { key, points: pts };
      setStatus('');
      render();
      map.view.zoom = 'site'; $('pZoom').value = 'site'; updateMap();
    } finally { btn.disabled = false; }
  }

  // ---------- sites side by side: one time axis, Sun, Earth and usable bands, the first closure named ----------
  const CMP_MAX = 6;
  let cmpAuto = [];
  function cmpSites() {
    if (st.cmp.length) return [st.site, ...st.cmp.filter((s) => s.key !== st.site.key)].slice(0, CMP_MAX);
    const rank = (v) => (v?.verdict === 'full' ? 2e12 : v?.verdict === 'short' ? 1e12 + v.lostMs : 0);
    const best = (list) => list.map((x) => ({ s: x.s, r: rank(x.v) })).sort((a, b) => b.r - a.r);
    const cat = places.filter((x) => x.site.key !== st.site.key && !x.site.landing_utc).slice(0, 3).map((x) => x.site); // the best candidate places for this mission
    const near = st.near?.key.startsWith(`${st.site.key}|${st.land}|`) ? best(st.near.points.map((p) => ({ s: p.site, v: p.v }))).slice(0, 2).map((x) => x.s) : [];
    return [st.site, ...near, ...cat];
  }
  function renderCompare() {
    const [t0, t1] = lookRange(), need = st.durD * DAY;
    cmpAuto = cmpSites();
    const list = cmpAuto.map((s) => ({ ...placeInfo(s), rows: hourly(s, t0, t1) })).sort((a, b) => b.rank - a.rank);
    const lasts = (x) => `${fmtDur(x.w.len)}${x.w.endKnown ? '' : ' or more'}`, short = (x) => fmtDur(need - ((x.w.close ?? t1) - x.w.land));
    const when = (x) => `${x.w.openedBy ? dayHm(x.w.open) : `before ${dayHm(x.w.open)}`} to ${x.w.endKnown ? dayHm(x.w.close) : `past ${fmtDayShort(t1)}`}`;
    const sum = (x) => (!x.w ? 'no usable window' : x.fits ? `opens ${dayHm(x.w.open)}, lasts ${lasts(x)}` : `longest window ${lasts(x)}, ${short(x)} short`);
    $('pCmpTable').tBodies[0].innerHTML = list.map((x) => `<tr><th scope="row">${x.site.key === st.site.key ? `${x.site.short} <small>(selected)</small>` : `<button type="button" class="link" data-cmp="${x.site.key}">${x.site.short}</button>`}</th><td>${x.w ? when(x) : 'none'}</td><td>${x.w ? lasts(x) : '—'}</td><td>${x.w?.endKnown ? BY[x.w.closedBy] : '—'}</td><td>${!x.w ? 'no' : x.fits ? 'yes' : `no, ${short(x)} short`}</td></tr>`).join('');
    $('pCmpAdd').innerHTML = `<option value="">Add a site…</option>${siteOptions('')}`;
    $('pCmpReset').hidden = !st.cmp.length;
    $('pCmpNeed').textContent = st.earth ? 'Usable: power and Earth together' : 'Usable: power';
    $('pCmpLead').textContent = `Each site's best window for a ${st.durD}-day mission between ${fmtDay(t0)} and ${fmtDay(t1)}, on one calendar. The sites that hold the mission come first.`;
    const cv = $('pCmp'), RH = 58, TOP = 18, { g, w } = setupCanvas(cv, TOP + list.length * RH), X = (t) => ((t - t0) / (t1 - t0)) * w;
    g.font = '13px system-ui, sans-serif'; g.strokeStyle = css('--line'); g.fillStyle = css('--muted');
    const step = Math.max(1, Math.ceil((t1 - t0) / DAY / Math.max(2, Math.floor(w / 64))));
    for (let t = Math.ceil(t0 / DAY) * DAY; t <= t1; t += step * DAY) { const x = X(t); g.beginPath(); g.moveTo(x, TOP - 2); g.lineTo(x, TOP + list.length * RH); g.stroke(); if (x < w - 40) g.fillText(fmtDayShort(t), x + 3, 12); }
    const ok = { sun: (r) => r.sunMargin > 0 && r.sunFraction >= st.minShare, earth: (r) => r.earthMargin > 0 };
    list.forEach((x, i) => {
      const y = TOP + i * RH;
      g.fillStyle = css('--text'); g.font = `${x.site.key === st.site.key ? '700' : '500'} 13px system-ui, sans-serif`;
      const tail = `: ${sum(x)}`;
      let name = x.site.short;
      while (g.measureText(name + tail).width > w - 4 && name.length > 6) name = `${name.slice(0, -2)}…`;
      g.fillText(name + tail, 2, y + 14);
      for (const [fn, col, yy, hh] of [[ok.sun, css('--sun'), 20, 8], [ok.earth, css('--earth'), 30, 8], [(r) => ok.sun(r) && (!st.earth || ok.earth(r)), css('--full'), 40, 12]]) {
        g.fillStyle = css('--track'); g.fillRect(0, y + yy, w, hh); g.fillStyle = col;
        let on = null;
        for (const r of x.rows) { if (fn(r) && on === null) on = r.t; if (!fn(r) && on !== null) { g.fillRect(X(on), y + yy, X(r.t) - X(on), hh); on = null; } }
        if (on !== null) g.fillRect(X(on), y + yy, X(t1) - X(on), hh);
      }
      if (x.w) { // the best window, outlined, with a tick where a mission landed at its opening would end
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(X(x.w.open), y + 39, X(x.w.close ?? t1) - X(x.w.open), 14);
        if (x.w.land + need <= t1) { g.beginPath(); g.moveTo(X(x.w.land + need), y + 36); g.lineTo(X(x.w.land + need), y + 56); g.stroke(); }
      }
    });
    if (st.land >= t0 && st.land <= t1) { g.strokeStyle = css('--text'); g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(st.land), TOP); g.lineTo(X(st.land), TOP + list.length * RH); g.stroke(); g.setLineDash([]); }
    cv.setAttribute('aria-label', `Sun, Earth and usable time at ${list.length} sites between ${fmtDay(t0)} and ${fmtDay(t1)}, on one calendar, each with its best window outlined. ${list.map((x) => `${x.site.short}: ${sum(x)}`).join('. ')}.`);
  }

  // The mission clock: Sun, Earth and usable time from landing, the mission's end, the first loss and the chosen moment.
  function renderTimeline() {
    const span = Math.max(st.durD + 4, 14) * DAY, t0 = st.land, t1 = Math.min(t0 + span, T_MAX), H = 122;
    const rows = series(eph, st.site, st.site.horizon, t0, t1, 15 * 60e3), cv = $('pTimeline'), { g, w } = setupCanvas(cv, H);
    const X = (t) => ((t - t0) / (t1 - t0)) * w, end = t0 + st.durD * DAY, v = verdictAt(st.site, st.land);
    g.font = '13px system-ui, sans-serif'; g.fillStyle = css('--muted'); g.strokeStyle = css('--line');
    const step = Math.max(1, Math.ceil(span / DAY / Math.max(2, Math.floor(w / 64)))); // ~64 px per label so they never collide on a phone
    for (let d = 0; d * DAY <= t1 - t0; d += step) { const x = X(t0 + d * DAY); g.beginPath(); g.moveTo(x, 16); g.lineTo(x, H - 8); g.stroke(); g.fillText(`day ${d}`, x + 3, 13); }
    const usable = (r) => r.sunMargin > 0 && r.sunFraction >= st.minShare && (!st.earth || r.earthMargin > 0); // the verdict's rule, on the terrain as mapped
    [[(r) => r.sunMargin > 0, css('--sun'), 'Sun'], [(r) => r.earthMargin > 0, css('--earth'), 'Earth'], [usable, css('--full'), 'Usable']].forEach(([ok, col, lab], n) => {
      const y = 24 + 30 * n;
      g.fillStyle = css('--track'); g.fillRect(0, y, w, 22); g.fillStyle = col;
      let on = null;
      for (const r of rows) { if (ok(r) && on === null) on = r.t; if (!ok(r) && on !== null) { g.fillRect(X(on), y, X(r.t) - X(on), 22); on = null; } }
      if (on !== null) g.fillRect(X(on), y, X(t1) - X(on), 22);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(lab, 6, y + 16); g.fillStyle = '#fff'; g.fillText(lab, 6, y + 16); // readable on the bar and on the dark track
    });
    g.strokeStyle = css('--text'); g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(end), 18); g.lineTo(X(end), H - 8); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--text'); g.fillText('mission ends', Math.min(X(end) + 4, w - 90), H - 2);
    if (v?.verdict === 'short') { // the first loss, with the span the terrain's uncertainty moves it over
      const red = css('--none-dot');
      if (v.range) { g.globalAlpha = 0.3; g.fillStyle = red; g.fillRect(X(t0 + v.range[0]), 18, Math.max(2, X(t0 + v.range[1]) - X(t0 + v.range[0])), H - 26); g.globalAlpha = 1; }
      g.strokeStyle = red; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(t0 + v.lostMs), 18); g.lineTo(X(t0 + v.lostMs), H - 8); g.stroke();
    }
    const mt = st.land + st.mapH * HOUR; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(mt), 18); g.lineTo(X(mt), H - 12); g.stroke();
    // Describe each body from its state at landing: the next change, or that it holds for the whole span.
    const days = Math.round(span / DAY), next = (key, upWord, downWord, riseWord, setWord) => {
      const up = rows[0][key] > 0, ev = events(rows, key)[0];
      return ev ? `${up ? upWord : downWord} at landing, ${ev.rising ? riseWord : setWord} after ${fmtDur(ev.t - t0)}` : `${up ? upWord : downWord} for all ${days} days shown`;
    };
    $('pTimelineText').textContent = `${next('sunMargin', 'Sun up', 'Sun down', 'sunrise', 'sunset')}; ${next('earthMargin', 'Earth in view', 'Earth hidden', 'Earthrise', 'Earthset')}. Mission ends at day ${st.durD}.`;
    const opens = rows.find(usable);
    $('pClockLead').textContent = !v ? '' : v.verdict === 'full' ? `Usable for the whole mission: ${st.durD} days from ${fmtUTC(t0)}.`
      : v.verdict === 'short' ? `Usable for ${fmtDur(v.lostMs)} of the ${st.durD} days: ${v.reason === 'power' ? (st.minShare > 0 ? 'usable sunlight' : 'sunlight') : 'Earth contact'} is lost first, at ${fmtUTC(t0 + v.lostMs)}.`
        : `Not usable at this landing time.${opens ? ` It becomes usable ${fmtDur(opens.t - t0)} later, at ${fmtUTC(opens.t)}.` : ` Nothing usable in the ${days} days shown.`}`;
    cv.setAttribute('aria-label', `Sun, Earth and usable time from landing through day ${days}. ${$('pClockLead').textContent} ${$('pTimelineText').textContent}`);
    $('pMapTime').max = Math.round(span / HOUR);
  }

  // ---------- the landing-area layer ----------
  const share = (a, b) => { const x = b ? (100 * a) / b : 0; return x > 0 && x < 0.5 ? 'under 1%' : `${Math.round(x)}%`; };
  const padM = () => Math.max(mission.m.ell.L, mission.m.ell.W) / 2;
  function bestText(L) {
    const c = L.count, from = L.t0, to = L.t0 + L.spanMs;
    if (L.done < L.total) return `Working through ${L.left ? st.durD : Math.round((to - from) / DAY)} days of light: step ${L.done} of ${L.total}.`;
    const found = `${L.areasTotal ? `${L.areasTotal} separate landing area${L.areasTotal > 1 ? 's' : ''} found${L.areasTotal > L.areas.length ? `; the largest are listed, with the one nearest ${st.site.short}` : ''}.` : 'No landing area in this view.'}`;
    const tail = `${share(c.steep, c.inside)} is too steep and ${share(c.close, c.inside)} too close to call. ${found}`, span = `between ${fmtDay(from)} and ${fmtDay(to)}`, mean = (x) => `${Math.round((100 * x) / (c.inside || 1))}%`;
    if (L.paint === 'sun') return `On average the ground shown is in sunlight ${mean(c.sunSum)} of the time ${span}; ${share(c.sunHalf, c.inside)} of it is lit at least half that time. ${found}`;
    if (L.paint === 'earth') return `On average Earth is in view from the ground shown ${mean(c.earthSum)} of the time ${span}; from ${share(c.earthHalf, c.inside)} of it Earth is in view at least half that time. ${found}`;
    if (L.paint === 'el') return `Where the ground shown is ever lit ${span}, the Sun's centre is on average ${c.lit ? (c.elSum / c.lit).toFixed(1) : '0'}° above the level horizon while it is lit. A level array collects in proportion to the sine of that angle; an upright array that turns to the Sun collects nearly all of it. ${found}`;
    if (L.left) return `${share(c.pad, c.inside)} of the ground shown is a landing area for a landing at ${fmtUTC(L.t0)}: sunlight${st.earth ? ' with Earth in view' : ''} from then for all ${st.durD} days, no steeper than ${mission.m.ell.max}° anywhere within ${Math.round(padM())} m, and not a close call. ${share(c.full, c.inside)} holds the mission from that landing, ${share(c.short, c.inside)} is usable at landing but loses the ${st.earth ? 'Sun or Earth' : 'Sun'} early, ${share(c.none, c.inside)} is not usable at landing; ${tail}`;
    return `${share(c.pad, c.inside)} of the ground shown is a landing area: a window of at least ${st.durD} days of sunlight${st.earth ? ' with Earth in view' : ''} between ${fmtDay(from)} and ${fmtDay(to)}, no steeper than ${mission.m.ell.max}° anywhere within ${Math.round(padM())} m, and not a close call. ${share(c.full, c.inside)} has such a window, ${share(c.short, c.inside)} is usable for less, ${share(c.none, c.inside)} is never usable in that span; ${tail}`;
  }
  const bearing = (a, b) => { const D = Math.PI / 180, dl = (b.lon - a.lon) * D; return (Math.atan2(Math.sin(dl) * Math.cos(b.lat * D), Math.cos(a.lat * D) * Math.sin(b.lat * D) - Math.sin(a.lat * D) * Math.cos(b.lat * D) * Math.cos(dl)) / D + 360) % 360; };
  // An area's sunlight and Earth statistics over the period, at its representative point.
  const pc = (x) => `${Math.round(100 * x)}%`;
  const areaStat = (q, stepMs) => `Sunlit ${pc(q.sun)} of the period, longest night ${q.dark ? `about ${fmtDur(q.dark * stepMs)}` : 'none'} · Earth in view ${pc(q.earth)}, longest outage ${q.outage ? `about ${fmtDur(q.outage * stepMs)}` : 'none'}${q.sunEl !== null ? ` · Sun ${q.sunEl.toFixed(1)}° up while lit` : ''}`;
  function renderBest(L) {
    $('pBestText').textContent = bestText(L).replace(/^u/, 'U');
    $('pAreas').innerHTML = L.done < L.total ? '' : L.areas.map((a, i) => {
      const open = L.t0 + a.start * L.stepMs, len = (a.best - 1) * L.stepMs;
      return `<li><button type="button" class="siteRow" data-lat="${a.lat}" data-lon="${a.lon}" data-land="${L.left ? L.t0 : ceilHour(open)}"><span class="vi full">${String.fromCharCode(65 + i)}</span><span class="nm">${a.areaKm2 < 10 ? a.areaKm2.toFixed(1) : Math.round(a.areaKm2)} km², ${a.distM < 1.5 * L.cellM ? `at ${st.site.short}` : `${(a.distM / 1000).toFixed(a.distM < 20e3 ? 1 : 0)} km ${compass(bearing(st.site, a))} of ${st.site.short}`}${a.nearest && L.areasTotal > 1 ? ' <small>(nearest)</small>' : ''}${a.stat ? `<small class="stt">${areaStat(a.stat, L.stepMs)}</small>` : ''}</span><span class="rs">${L.left ? `holds the mission from ${dayHm(L.t0)}` : `window opens about ${dayHm(open)}, about ${fmtDur(len)}`}</span></button></li>`;
    }).join('');
    $('pBestNote').textContent = `Sampled every ${L.stepMs / HOUR} hours on the ${L.terrainM} m terrain${L.cellM > 1.5 * L.terrainM ? ', at points 1.2 km apart' : ''}${L.terrainM < 100 ? ' (240 m terrain farther out)' : ''}, so times here are approximate; slopes are measured across ${2 * L.terrainM} m.${L.terrainM < 100 ? ` The uncertainty allowed for the 40 m terrain (${data.unc[40]} m) is scaled from the 240 m level, not measured.` : ''}${st.minShare > 0 ? ' This layer counts any part of the Sun as power; the verdict uses your stricter power setting.' : ''} ${L.left ? 'Choosing an area moves the landing there, at the same time' : "Choosing an area plans a landing at its window's opening"}, and the verdict then traces a finer horizon there.${L.tookS ? ` Worked out in ${L.tookS < 10 ? L.tookS.toFixed(1) : Math.round(L.tookS)} s${L.workers ? ` on ${L.workers} worker${L.workers > 1 ? 's' : ''}` : ''}.` : ''}`;
  }

  // The landing layer's mission and period: the search span every 4 hours, or a year from its start every 12.
  const PAINT = { share: 'sun', contact: 'earth', sunel: 'el' }; // map settings that colour the landing layer by a statistic
  const landMission = () => {
    const [a, b] = lookRange(), year = st.period === 'year' && st.layer !== 'left';
    return { t0: a, spanMs: year ? Math.min(365 * DAY, T_MAX - a) : b - a, stepMs: (year ? 12 : 4) * HOUR, landT: st.land, durMs: st.durD * DAY, needEarth: st.earth, slopeMax: mission.m.ell.max, padM: padM() };
  };

  // ---------- planned CLPS deliveries to the south pole ----------
  const clpsCentre = (v) => (v.site ? data.sites.get(v.site) : v.lat !== undefined ? v : st.site);
  function renderClps() {
    const C = data.clps, link = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
    $('pClpsNote').innerHTML = `${C.note} Source: ${link(C.source, C.source_title)}, page dated ${C.page_updated}, read ${C.read}.`;
    $('pClps').innerHTML = C.deliveries.map((d, i) => `<li><button type="button" class="siteRow" data-clps="${i}"><span class="vi out">${i + 1}</span><span class="nm">${d.id} · ${d.provider} ${d.lander}<small class="stt">NASA: "${d.region}"</small></span><span class="rs">search ${C.views[d.view].name}</span></button></li>`).join('');
    $('pClpsBasis').innerHTML = [...Object.values(C.views).map((v) => `<li><b>${v.name}.</b> ${v.basis}${v.basis_source ? ` ${link(v.basis_source, 'Gazetteer')}` : ''}</li>`),
      ...C.deliveries.filter((d) => d.detail).map((d) => `<li><b>${d.id}.</b> ${d.detail} ${link(d.detail_source, 'NASA release')}</li>`)].join('');
    $('pClpsLead').textContent = `Runs the landing-area analysis for this ${st.durD}-day mission${st.earth ? ' with Earth contact' : ''} over each region NASA names for a planned south-pole delivery, and lists the largest landing area found in each. The regions are where this tool searches; NASA has published no coordinates. It takes about as long as three map builds.`;
  }
  async function compareClps() {
    const C = data.clps, m = landMission(), body = $('pClpsTable').tBodies[0], td = (x) => `<td>${x}</td>`;
    body.innerHTML = '';
    for (const k of [...new Set(C.deliveries.map((d) => d.view))]) {
      const v = C.views[k], c0 = clpsCentre(v);
      $('pClpsStatus').textContent = `Working on ${v.name}…`;
      const L = await map.analyse({ zoom: v.zoom, center: { lat: c0.lat, lon: c0.lon }, mission: m });
      if (!L) { $('pClpsStatus').textContent = 'Stopped, because the map was asked to draw something else. Run it again.'; return; }
      const a = L.areas[0], c = L.count, q = a?.stat;
      body.insertAdjacentHTML('beforeend', `<tr><th scope="row">${v.name}</th>${td(C.deliveries.filter((d) => d.view === k).map((d) => d.id).join(', '))}${td(`${share(c.pad, c.inside)} of the ground, ${L.areasTotal} area${L.areasTotal === 1 ? '' : 's'}`)}${a
        ? td(`${a.areaKm2 < 10 ? a.areaKm2.toFixed(1) : Math.round(a.areaKm2)} km² at ${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°E`) + td(`opens about ${dayHm(L.t0 + a.start * L.stepMs)}, about ${fmtDur((a.best - 1) * L.stepMs)}`) + td(pc(q.sun)) + td(pc(q.earth)) + td(q.dark ? `about ${fmtDur(q.dark * L.stepMs)}` : 'none')
        : td('none') + td('–').repeat(4)}</tr>`);
    }
    $('pClpsStatus').textContent = `Done: ${fmtDay(m.t0)} to ${fmtDay(m.t0 + m.spanMs)}, sampled every ${m.stepMs / HOUR} hours. The last three columns are at the largest area's best point.`;
  }

  function updateMap() {
    const polar = st.site.lat <= -75;
    $('pMapWrap').hidden = !polar;
    $('pMapNone').hidden = polar;
    $('pMapNone').textContent = polar ? '' : `The map covers 75–90°S; ${st.site.short} is at ${st.site.lat.toFixed(1)}°.`;
    if (!polar) return;
    const t = st.land + st.mapH * HOUR;
    $('pMapWhen').textContent = fmtUTC(t);
    const near = st.near?.points || [], col = { full: css('--full'), short: css('--short'), none: css('--none-dot') }, landLayer = st.layer !== 'sun', paint = PAINT[st.layer], byWindow = landLayer && st.layer !== 'left';
    const closeOk = hasClose(st.site.lat, st.site.lon), level = map.view.zoom === 'pole' ? 'pole' : map.view.zoom === 'close' && closeOk ? 'close' : 'site';
    $('pZoomNote').hidden = map.view.zoom !== 'close' || closeOk;
    // On the landing layer every polar catalogue site is drawn, coloured by its own verdict for this landing.
    const cat = [...data.sites.values()].filter((s) => s.lat <= -75 && s.key !== st.site.key && (landLayer || (level === 'pole' && !s.outline)));
    const markers = [{ lat: st.site.lat, lon: st.site.lon, label: st.site.short, main: true, color: css('--sun') },
      ...near.map((n) => ({ lat: n.site.lat, lon: n.site.lon, color: col[n.v?.verdict] || '#888' })),
      ...cat.map((s) => ({ lat: s.lat, lon: s.lon, label: s.short.startsWith("Chang'e-7") || (landLayer && s.outline && level === 'pole') ? '' : s.short, ...(byWindow ? { color: (() => { const x = places.find((q) => q.site.key === s.key); return !x?.w ? col.none : x.fits ? col.full : col.short; })() } : {}) }))];
    $('pLayer').value = st.layer;
    $('pLegSun').hidden = landLayer; $('pLegLand').hidden = !landLayer || !!paint; $('pLegStat').hidden = !paint; $('pBest').hidden = !landLayer;
    if (paint) {
      $('pRamp').style.background = `linear-gradient(to right, rgb(${RAMP_LOW}), rgb(${RAMP[paint]}))`;
      $('pLegLo').textContent = paint === 'el' ? '0°' : '0%'; $('pLegHi').textContent = paint === 'el' ? `${EL_MAX}° or more` : '100%';
      $('pLegWhat').textContent = { sun: 'Share of the period in sunlight', earth: 'Share of the period with Earth in view', el: "Mean height of the Sun's centre while lit" }[paint];
    }
    $('pPeriod').value = st.period; $('pSort').value = st.sort; $('pPeriod').closest('label').hidden = st.layer === 'left';
    if (landLayer && !map.view.frame?.land) $('pBestText').textContent = 'Working…';
    $('pMapRes').textContent = { pole: '1.2 km', site: '240 m', close: '40 m' }[level];
    $('pLegFull').textContent = byWindow ? 'Window holds the mission' : 'This landing holds the mission'; $('pLegShort').textContent = byWindow ? 'Usable, too short' : 'Usable at landing, lost early'; $('pLegNone').textContent = byWindow ? 'Never usable' : 'Not usable at landing';
    const outlines = [...data.sites.values()].filter((x) => x.outline && (level === 'pole' || x.key === st.site.key)).map((x) => ({ pts: x.outline, main: x.key === st.site.key }));
    const ov = mission.overlays();
    $('pMapTap').hidden = !mission.adding();
    map.set({ t, center: { lat: st.site.lat, lon: st.site.lon }, markers: [...markers, ...ov.markers], outlines, paths: ov.paths, layer: paint ? 'land' : st.layer, paint: paint || 'class', sort: st.sort, onLand: renderBest, mission: landMission() }).catch((e) => setStatus(e.message));
  }

  // The chosen moment: headline numbers with countdowns from that moment, and the sky panorama.
  const momentCache = new Map();
  function renderMoment() {
    const s0 = st.site, t = st.land + st.mapH * HOUR, k = `${s0.key}|${t}`;
    if (!momentCache.has(k)) { if (momentCache.size > 30) momentCache.clear(); momentCache.set(k, series(eph, s0, s0.horizon, t, Math.min(t + 30 * DAY, T_MAX), 10 * 60e3)); }
    const rows = momentCache.get(k), p = rows[0];
    $('pMapTime').value = st.mapH;
    $('pMapLabel').textContent = `${fmtUTC(t)} · day ${(st.mapH / 24).toFixed(1)}`;
    const elw = (e) => (e >= 0 ? `${e.toFixed(1)}° up` : `${(-e).toFixed(1)}° down`);
    const next = (key, upName, downName) => {
      const up = p[key] > 0, e = events(rows, key)[0];
      return `<span class="tl">${up ? upName : downName}</span><b>${e ? `in ${fmtDur(e.t - t)}` : 'over 30 d'}</b><small>${e ? fmtUTC(e.t) : up ? 'stays up' : 'stays down'}</small>`;
    };
    const lit = p.sunMargin > 0, night = p.sun.el + p.sun.radiusDeg < 0;
    $('pTiles').innerHTML = `
      <div class="tile sun"><span class="tl">Sun</span><b>${lit ? (p.sunFraction < 0.995 ? `${Math.round(p.sunFraction * 100)}% visible` : 'Sunlit') : night ? 'Night' : 'Behind terrain'}</b><small>${elw(p.sun.el)} ${compass(p.sun.az)} · terrain ${p.sunHorizon.toFixed(1)}°</small></div>
      <div class="tile sun">${next('sunMargin', 'Sunset', 'Sunrise')}</div>
      <div class="tile earth"><span class="tl">Earth</span><b>${p.earthMargin > 0 ? 'In view' : p.earth.el > 0 ? 'Behind terrain' : 'Below horizon'}</b><small>${elw(p.earth.el)} ${compass(p.earth.az)} · terrain ${p.earthHorizon.toFixed(1)}°</small></div>
      <div class="tile earth">${next('earthMargin', 'Earthset', 'Earthrise')}</div>`;
    const tracks = series(eph, s0, s0.horizon, st.land, Math.min(st.land + st.durD * DAY, T_MAX), HOUR);
    drawSky($('pSky'), { site: s0, cur: p, tracks, height: 260 });
  }

  // ---------- all sites, all windows (folded) ----------
  const cal = { rows: [], days: 365, sig: '', labelW: 190, t0: 0, t1: 0, cur: { i: 0, k: 0 } };
  const landBy = (w) => (w.close ?? cal.t1) - st.durD * DAY; // the last landing in a window that still holds the mission
  const winText = (site, w) => `${site.short} · ${w.openedBy ? dayHm(w.open) : `before ${dayHm(w.open)}`} to ${w.endKnown ? dayHm(w.close) : `past ${fmtDay(cal.t1)}`} · ${fmtDur(w.len)}${w.endKnown ? `, then ${BY[w.closedBy]}` : ' or more'} · ${w.fits ? `holds the mission${w.endKnown ? ` if landed by ${dayHm(landBy(w))}` : ''}` : `${fmtDur(st.durD * DAY - ((w.close ?? cal.t1) - w.land))} short`}`;
  async function renderCalendarIfOpen() {
    if (!$('pAll').open) return;
    cal.days = +$('pCalDays').value;
    const from = lookRange()[0], to = Math.min(from + (cal.days + st.durD) * DAY, T_MAX);
    await eph.ensure(from, to);
    const sites = [...data.sites.values(), ...(st.site.key.startsWith('custom:') ? [st.site] : [])];
    const sig = JSON.stringify([from, to, st.durD, st.minShare, st.earth, sites.map((s) => s.key)]);
    if (sig !== cal.sig) {
      Object.assign(cal, { sig, t0: from, t1: to, cur: { i: 0, k: 0 } });
      cal.rows = sites.map((site) => { const ws = windowsAt(site, from, to).filter((w) => w.len >= 6 * HOUR); return { site, ws, fit: ws.filter((w) => w.fits) }; })
        .sort((a, b) => !!a.site.landing_utc - !!b.site.landing_utc || b.fit.length - a.fit.length || b.ws.length - a.ws.length); // candidate places first, past landing sites after
      $('pCalLead').textContent = `Every window of sunlight${st.earth ? ' with Earth in view' : ''} at every site between ${fmtDay(from)} and ${fmtDay(to)}. Green holds a ${st.durD}-day mission, and its brighter part is when a landing still fits; amber is a shorter window. Hover or use the arrow keys for the details; click or Enter plans a landing at the window's opening.`;
      $('pCalTable').tBodies[0].innerHTML = cal.rows.map((r, i) => {
        const w = r.fit[0];
        return `<tr><th scope="row">${r.site.short}</th><td>${r.fit.length} of ${r.ws.length}</td><td>${!w ? 'none in this range' : `<button type="button" data-row="${i}" data-win="${r.ws.indexOf(w)}">${dayHm(w.open)}, ${fmtDur(w.len)}${w.endKnown ? '' : ' or more'}</button>`}</td></tr>`;
      }).join('');
    }
    drawCalendar();
  }
  const calX = (t) => cal.labelW + ((t - cal.t0) / (cal.t1 - cal.t0)) * cal.plotW;
  function drawCalendar() {
    const cv = $('pCal'), TOP = 22, RH = 22, wrapW = cv.parentElement.clientWidth;
    cal.labelW = wrapW < 500 ? 110 : 190;
    cal.plotW = Math.max(wrapW - cal.labelW, cal.days * 2); // at least 2 px a day; the wrapper scrolls on a phone
    cv.style.width = `${cal.labelW + cal.plotW}px`;
    const { g } = setupCanvas(cv, TOP + cal.rows.length * RH);
    g.font = '13px system-ui, sans-serif'; g.fillStyle = css('--muted'); g.strokeStyle = css('--line');
    for (let d = new Date(cal.t0); d.getTime() <= cal.t1; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDate() !== 1) continue;
      const x = calX(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), lab = d.toLocaleDateString('en-GB', { month: 'short', year: d.getUTCMonth() === 0 ? '2-digit' : undefined, timeZone: 'UTC' });
      if (x < cal.labelW) continue;
      g.beginPath(); g.moveTo(x, 14); g.lineTo(x, TOP + cal.rows.length * RH); g.stroke();
      if (x + g.measureText(lab).width < cal.labelW + cal.plotW) g.fillText(lab, x + 2, 12);
    }
    cal.rows.forEach((r, i) => {
      const y = TOP + i * RH;
      g.fillStyle = css('--text');
      let name = r.site.short.replace('candidate region: ', '').replace('candidate: ', ''); // the shared prefixes would truncate every label to the same text
      while (g.measureText(name).width > cal.labelW - 8 && name.length > 4) name = `${name.slice(0, -2)}…`;
      g.fillText(name, 2, y + 15);
      g.fillStyle = css('--track'); g.fillRect(cal.labelW, y + 3, cal.plotW, RH - 6);
      for (const w of r.ws) {
        const x0 = calX(w.open), x1 = calX(w.close ?? cal.t1), xb = w.fits ? Math.max(x0 + 1, calX(landBy(w))) : x1;
        g.fillStyle = css(w.fits ? '--full' : '--short');
        g.fillRect(x0, y + 3, Math.max(1, xb - x0), RH - 6);
        if (w.fits) { g.globalAlpha = 0.4; g.fillRect(xb, y + 3, Math.max(0, x1 - xb), RH - 6); g.globalAlpha = 1; } // too late to land, still usable
      }
    });
    const cw = cal.rows[cal.cur.i]?.ws[cal.cur.k];
    if (document.activeElement === cv && cw) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(calX(cw.open) - 2, TOP + cal.cur.i * RH + 1, Math.max(4, calX(cw.close ?? cal.t1) - calX(cw.open)) + 4, RH - 2); } // keyboard cursor
  }
  // The row and window under the pointer; k is -1 between windows.
  const calHit = (e) => {
    const i = Math.floor((e.offsetY - 22) / 22), t = cal.t0 + ((e.offsetX - cal.labelW) / cal.plotW) * (cal.t1 - cal.t0), r = cal.rows[i];
    return r && e.offsetX >= cal.labelW ? { i, t, k: r.ws.findIndex((w) => t >= w.open && t <= (w.close ?? cal.t1)) } : null;
  };

  // ---------- events ----------
  // Re-rendering replaces the control that had focus; put keyboard users somewhere meaningful instead of <body>.
  async function guard(fn) {
    const from = document.activeElement?.closest?.('#pWins, #pNearest, #pOthersBox, #pNear, #pCalTable, #pBest')?.id;
    try { await fn(); await ensureAround(st.land); render(); } catch (e) { setStatus(e.message); console.error(e); return; }
    if (from === 'pWins') $('pWins').querySelector('.sel')?.focus();
    else if (from) { $('pVerdictTitle').focus(); $('pVerdict').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }
  // A date outside the ephemeris is moved to the nearest one that fits the mission, and the page says so.
  const landMax = () => T_MAX - (st.durD + 1) * DAY;
  const shiftTo = (t, search = true) => {
    if (search) st.from = Math.min(Math.max(t, T_MIN), landMax());
    st.land = Math.min(Math.max(t, T_MIN), landMax()); st.mapH = 0;
    st.notice = st.land === t ? '' : `You asked for ${fmtUTC(t)}, which is outside the data (1 Jan 1969 to 31 Dec 2040). Showing the ${t > st.land ? 'latest' : 'earliest'} landing a ${st.durD}-day mission fits instead: ${fmtUTC(st.land)}.`;
  };
  function bind() {
    const setTab = (k, focus) => { st.ptab = k; showTab(); if (focus) $(`pt${k}`).focus(); api.resize(); onChange(); }; // canvases sized while hidden need a redraw
    PT.forEach((k, i) => {
      $(`pt${k}`).addEventListener('click', () => setTab(k));
      $(`pt${k}`).addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(PT[(i + (e.key === 'ArrowRight' ? 1 : PT.length - 1)) % PT.length], true); } });
    });
    $('pSite').addEventListener('change', () => guard(async () => { if ($('pSite').value) { st.site = data.sites.get($('pSite').value); st.near = null; } }));
    $('pGo').addEventListener('click', () => guard(async () => { st.site = await customSite(parseFloat($('pLat').value), parseFloat($('pLon').value)); st.near = null; }));
    $('pLand').addEventListener('change', () => guard(async () => { const t = Date.parse(`${$('pLand').value}Z`); if (!Number.isNaN(t)) shiftTo(t); }));
    $('pDur').addEventListener('change', () => guard(async () => { st.durD = Math.min(60, Math.max(1, Math.round(+$('pDur').value || 10))); st.mapH = Math.min(st.mapH, st.durD * 24); }));
    $('pShare').addEventListener('change', () => guard(async () => { st.minShare = +$('pShare').value; }));
    $('pEarth').addEventListener('change', () => guard(async () => { st.earth = $('pEarth').checked; }));
    const pickLand = (e) => { const b = e.target.closest('[data-land]'); if (b) guard(async () => shiftTo(+b.dataset.land)); };
    $('pNearest').addEventListener('click', pickLand); $('pWins').addEventListener('click', pickLand);
    $('pFind').addEventListener('click', () => { st.layer = 'land'; updateMap(); onChange(); $('hMap').scrollIntoView({ behavior: 'smooth' }); });
    const pickRow = (e) => {
      const b = e.target.closest('.siteRow'); if (!b || b.dataset.clps) return; // a CLPS row has its own handler
      guard(async () => { st.site = b.dataset.site ? data.sites.get(b.dataset.site) : await customSite(+b.dataset.lat, +b.dataset.lon); if (b.dataset.site) st.near = null; if (b.dataset.land) shiftTo(+b.dataset.land, false); });
      $('plan').scrollIntoView({ behavior: 'smooth' });
    };
    $('pOthersBox').addEventListener('click', pickRow); $('pNear').addEventListener('click', pickRow); $('pAreas').addEventListener('click', pickRow);
    $('pCmpAdd').addEventListener('change', () => { const k = $('pCmpAdd').value; if (k) guard(async () => { if (!st.cmp.length) st.cmp = cmpAuto.filter((s) => s.key !== st.site.key); if (!st.cmp.some((s) => s.key === k)) st.cmp = [...st.cmp, data.sites.get(k)].slice(-(CMP_MAX - 1)); }); });
    $('pCmpReset').addEventListener('click', () => guard(async () => { st.cmp = []; }));
    $('pCmpTable').addEventListener('click', (e) => { const b = e.target.closest('[data-cmp]'); if (b) guard(async () => { const s = cmpAuto.find((x) => x.key === b.dataset.cmp); if (s) { const w = placeInfo(s).w; st.site = s; if (!s.key.startsWith('custom:')) st.near = null; if (w) shiftTo(w.land, false); } }); });
    $('pNearBtn').addEventListener('click', () => searchNear().catch((e) => setStatus(e.message)));
    $('pMapTime').addEventListener('input', () => { st.mapH = +$('pMapTime').value; renderMoment(); updateMap(); renderTimeline(); mission.timing(); onChange(); });
    $('pZoom').addEventListener('change', () => { map.view.zoom = $('pZoom').value; updateMap(); onChange(); });
    $('pLayer').addEventListener('change', () => { st.layer = $('pLayer').value; updateMap(); onChange(); });
    $('pSort').addEventListener('change', () => { st.sort = $('pSort').value; updateMap(); });
    $('pPeriod').addEventListener('change', () => { st.period = $('pPeriod').value; updateMap(); onChange(); });
    $('pClps').addEventListener('click', (e) => {
      const b = e.target.closest('[data-clps]'); if (!b) return;
      const v = data.clps.views[data.clps.deliveries[+b.dataset.clps].view];
      guard(async () => { if (v.site) { st.site = data.sites.get(v.site); st.near = null; } else if (v.lat !== undefined) { st.site = await customSite(v.lat, v.lon, { name: `${v.name} (search point)` }); st.near = null; } map.view.zoom = v.zoom; $('pZoom').value = v.zoom; st.layer = 'land'; });
      $('hMap').scrollIntoView({ behavior: 'smooth' });
    });
    $('pClpsRun').addEventListener('click', () => compareClps().catch((e) => { $('pClpsStatus').textContent = e.message; }));
    mission.bind();
    $('pCsv').addEventListener('click', () => {
      const rows = hourly(st.site, st.land, Math.min(st.land + st.durD * DAY, T_MAX)), v = verdictAt(st.site, st.land);
      const csv = missionCsv({ ...facts(), land: st.land, rows, verdict: `${v ? TITLE[v.verdict] : 'No answer'}. ${why(v)} ${closeText(v)}`.trim(), scenario: scenario() });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `lunar-window_${st.site.key.replace(/[^a-z0-9.-]+/gi, '_')}_${isoMin(st.land).replace(':', '')}Z_${st.durD}d.csv`;
      a.click(); URL.revokeObjectURL(a.href);
      $('pCsvNote').textContent = `Saved ${rows.length} hourly rows as ${a.download}.`;
    });
    $('pActual').addEventListener('click', () => guard(async () => shiftTo(Date.parse(st.site.landing_utc))));
    $('pTimeline').addEventListener('click', (e) => { const span = +$('pMapTime').max; st.mapH = Math.round((e.offsetX / $('pTimeline').clientWidth) * span); renderMoment(); updateMap(); renderTimeline(); mission.timing(); onChange(); });
    const cal1 = () => renderCalendarIfOpen().catch((e) => setStatus(e.message));
    $('pAll').addEventListener('toggle', cal1);
    $('pCalDays').addEventListener('change', cal1);
    const openWin = (i, k) => { const r = cal.rows[i], w = r?.ws[k]; if (w) guard(async () => { st.site = r.site; st.near = null; shiftTo(w.land, false); $('plan').scrollIntoView({ behavior: 'smooth' }); }); };
    $('pCal').addEventListener('mousemove', (e) => { const c = calHit(e); if (c) $('pCalPick').textContent = c.k < 0 ? `${cal.rows[c.i].site.short} · no usable window on ${fmtDay(c.t)}` : winText(cal.rows[c.i].site, cal.rows[c.i].ws[c.k]); });
    $('pCal').addEventListener('click', (e) => { const c = calHit(e); if (c && c.k >= 0) openWin(c.i, c.k); });
    // Keyboard: left and right move between a site's windows, up and down between sites (to the window nearest in time), Enter plans it.
    const announce = () => {
      const r = cal.rows[cal.cur.i], w = r?.ws[cal.cur.k]; if (!r) return;
      $('pCalPick').textContent = w ? winText(r.site, w) : `${r.site.short} · no usable window in this range`;
      const wrap = $('pCal').parentElement, x = w ? calX(w.open) : cal.labelW; // keep the cursor in view when the chart scrolls
      if (x < wrap.scrollLeft + cal.labelW || x > wrap.scrollLeft + wrap.clientWidth - 20) wrap.scrollLeft = Math.max(0, x - wrap.clientWidth / 2);
      drawCalendar();
    };
    $('pCal').addEventListener('focus', announce);
    $('pCal').addEventListener('blur', drawCalendar);
    $('pCal').addEventListener('keydown', (e) => {
      const row = cal.rows[cal.cur.i], move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Home: [0, -1e4], End: [0, 1e4] }[e.key];
      if (move && row) {
        e.preventDefault();
        const i = Math.max(0, Math.min(cal.rows.length - 1, cal.cur.i + move[0])), ws = cal.rows[i].ws, at = row.ws[cal.cur.k]?.open ?? cal.t0;
        const k = move[0] ? ws.reduce((best, w, j) => (best < 0 || Math.abs(w.open - at) < Math.abs(ws[best].open - at) ? j : best), -1) : Math.max(0, Math.min(ws.length - 1, cal.cur.k + move[1]));
        cal.cur = { i, k };
        announce();
      } else if (e.key === 'Enter') { e.preventDefault(); openWin(cal.cur.i, cal.cur.k); }
    });
    $('pCalTable').addEventListener('click', (e) => { const b = e.target.closest('button[data-row]'); if (b) openWin(+b.dataset.row, +b.dataset.win); });
  }

  const api = {
    st, bind, render, guard,
    resize() { if (st.site) { renderCompare(); renderTimeline(); renderMoment(); updateMap(); mission.resize(); if ($('pAll').open) drawCalendar(); } },
    params() { return { site: st.site.key, land: isoMin(st.land), dur: st.durD, share: st.minShare, earth: st.earth ? 1 : 0, mh: st.mapH, ...(st.cmp.length ? { cmp: st.cmp.map((s) => s.key).join(';') } : {}), ...(st.layer !== 'sun' ? { layer: st.layer } : {}), ...(map.view.zoom !== 'pole' ? { zoom: map.view.zoom } : {}), ...(st.ptab !== 'Places' ? { ptab: st.ptab.toLowerCase() } : {}), ...(st.period !== 'span' ? { per: st.period } : {}), ...(st.from !== st.land ? { from: isoMin(st.from) } : {}), ...mission.params() }; },
    async load(q, fallbackSite) {
      st.site = q.site ? await siteByKey(q.site).catch(() => { st.linkNote = { site: fallbackSite, text: `This link names a place the planner does not have ("${q.site}"). Showing ${fallbackSite.short} instead.` }; return fallbackSite; }) : fallbackSite;
      st.durD = Math.min(60, Math.max(1, +(q.dur || 10))); st.minShare = +(q.share || 0); st.earth = q.earth !== '0';
      shiftTo(q.land || Math.floor(Date.now() / HOUR) * HOUR); st.mapH = Math.max(0, +(q.mh || 0));
      const f = q.from ? Date.parse(`${q.from}:00Z`) : NaN; if (!Number.isNaN(f)) st.from = Math.min(Math.max(f, T_MIN), landMax());
      st.layer = ['land', 'left', 'share', 'contact', 'sunel'].includes(q.layer) ? q.layer : 'sun'; st.period = q.per === 'year' ? 'year' : 'span';
      st.ptab = PT.find((k) => k.toLowerCase() === q.ptab) || 'Places';
      map.view.zoom = ['site', 'close'].includes(q.zoom) ? q.zoom : 'pole'; $('pZoom').value = map.view.zoom;
      st.cmp = q.cmp ? (await Promise.all(q.cmp.split(';').slice(0, CMP_MAX - 1).map((k) => siteByKey(k).catch(() => null)))).filter(Boolean) : [];
      mission.load(q);
      await ensureAround(st.land);
    },
  };
  return api;
}
