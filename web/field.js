// Field view: for a crew at a site, on the device's clock: how long until sunlight or Earth contact is lost, which
// goes first, whether a task fits, and how old the reading is. A reading older than STALE_MS is marked stale
// (NASA-STD-3001 Vol 2 [V2 10020]: show when data are stale, missing or unknown).
import { series, closures } from './windows.js';
import { $, DAY, T_MAX, APP_VERSION, eph, data, siteByKey, siteOptions, fmtDur, fmtUTC, setStatus } from './core.js';

const LOOK_D = 30, STEP_MS = 5 * 60e3, REFRESH_MS = 60e3;
export const STALE_MS = 90e3;
const hms = (t) => new Date(t).toISOString().slice(11, 19);

// Pure: what the display says for a reading. `r` = { at, c, worse, better, opensMs } (closures at the reading time, with
// the terrain as mapped, higher and lower by its uncertainty; time to the next opening if closed), `now` = the clock.
export function fieldReading(r, now, taskMs, needEarth) {
  const age = now - r.at, stale = age > STALE_MS, name = { power: 'The Sun sets', earth: 'Earth sets' };
  if (r.c.endMs === 0) {
    const why = r.c.sunMs === 0 ? (needEarth && r.c.earthMs === 0 ? 'no sunlight and no Earth contact' : 'no sunlight') : 'no Earth contact';
    return { state: 'closed', stale, age, head: 'Not usable now', sub: `${why[0].toUpperCase()}${why.slice(1)} here.${r.opensMs === null ? ` Nothing opens in the next ${LOOK_D} days.` : ` Opens in ${fmtDur(Math.max(0, r.opensMs - age))}, at ${fmtUTC(r.at + r.opensMs)}.`}`, fit: '' };
  }
  if (r.c.endMs === null) return { state: 'open', stale, age, head: `More than ${LOOK_D} days left`, sub: `Sunlight${needEarth ? ' and Earth contact hold' : ' holds'} for at least ${LOOK_D} days.`, fit: `A ${fmtDur(taskMs)} task fits.` };
  const left = r.c.endMs - age, other = r.c.first === 'power' ? r.c.earthMs : r.c.sunMs;
  const lo = r.worse.endMs ?? r.c.endMs, hi = r.better.endMs ?? Infinity, spread = hi - lo > 2 * 60e3;
  const fitsNow = left >= taskMs, fitsWorst = lo - age >= taskMs;
  return {
    state: left > 0 ? 'open' : 'closed', stale, age,
    head: left > 0 ? `${fmtDur(left)} left` : 'Window closed',
    sub: `${name[r.c.first]} first, at ${fmtUTC(r.at + r.c.endMs)}.${needEarth && other !== null && other > r.c.endMs ? ` ${name[r.c.first === 'power' ? 'earth' : 'power']} at ${fmtUTC(r.at + other)}.` : ''}${spread ? ` Terrain uncertainty: between ${fmtDur(Math.max(0, lo - age))} and ${hi === Infinity ? `more than ${LOOK_D} days` : fmtDur(Math.max(0, hi - age))} left.` : ''}`,
    fit: left <= 0 ? '' : fitsNow && fitsWorst ? `A ${fmtDur(taskMs)} task fits: start by ${fmtUTC(r.at + r.c.endMs - taskMs)}.` : fitsNow ? `A ${fmtDur(taskMs)} task is too close to call: it fits on the terrain as mapped, but not if the terrain is higher by its uncertainty.` : `A ${fmtDur(taskMs)} task does not fit.`,
    fits: left > 0 && fitsNow && fitsWorst,
  };
}

export function createField({ onChange }) {
  const st = { site: null, taskH: 2, earth: true, hold: false, reading: null, error: '' };
  let timer = 0, busy = false, said = '';

  async function compute() {
    if (busy) return;
    busy = true;
    try {
      const at = Date.now();
      if (at + LOOK_D * DAY > T_MAX) throw new Error('This device’s clock is past the end of the data (31 Dec 2040).');
      await eph.ensure(at, at + (LOOK_D + 1) * DAY);
      const rows = series(eph, st.site, st.site.horizon, at, at + LOOK_D * DAY, STEP_MS), req = { minShare: 0, earth: st.earth };
      const ok = (r) => r.sunMargin > 0 && (!st.earth || r.earthMargin > 0), open = rows.find(ok);
      st.reading = { at, key: `${st.site.key}|${st.earth}`, c: closures(rows, req), worse: closures(rows, req, 1), better: closures(rows, req, -1), opensMs: open ? open.t - at : null, p: rows[0] };
      st.error = '';
    } catch (e) { st.error = e.message; console.error(e); } finally { busy = false; }
  }

  function draw() {
    const r = st.reading, now = Date.now();
    $('fHold').setAttribute('aria-pressed', st.hold);
    $('fHold').textContent = st.hold ? 'Resume live updates' : 'Hold this reading';
    if (!r) { $('fHead').textContent = st.error || 'Working…'; $('fSub').textContent = ''; $('fFit').textContent = ''; $('fValid').textContent = ''; return; }
    const v = fieldReading(r, now, st.taskH * 3600e3, st.earth), box = $('fMain');
    box.className = `fmain ${v.stale ? 'stale' : v.state}`;
    $('fStale').hidden = !v.stale;
    $('fStale').textContent = v.stale ? `STALE: this reading is ${fmtDur(v.age)} old${st.hold ? ' (held)' : st.error ? ` (${st.error})` : ''}. Do not act on it.` : '';
    $('fHead').textContent = v.head; $('fSub').textContent = v.sub; $('fFit').textContent = v.fit;
    // Screen readers hear a change of state, not every tick of the countdown.
    const sig = `${r.key}|${v.state}|${r.c.first}|${v.fits}|${v.stale}`;
    if (sig !== said) { said = sig; $('fAnnounce').textContent = v.stale ? '' : `${v.head}. ${v.sub} ${v.fit}`; }
    const p = r.p, el = (e) => (e >= 0 ? `${e.toFixed(1)}° up` : `${(-e).toFixed(1)}° down`), coarse = !(st.site.horizon_grids || st.site.horizon.grids).some((g) => /40 m|240 m/.test(g));
    $('fTiles').innerHTML = `<div class="tile sun"><span class="tl">Sun</span><b>${p.sunMargin > 0 ? (p.sunFraction < 0.995 ? `${Math.round(p.sunFraction * 100)}% visible` : 'Sunlit') : 'Not visible'}</b><small>${el(p.sun.el)} · terrain ${p.sunHorizon.toFixed(1)}° ± ${p.sunU.toFixed(2)}°</small></div>
      <div class="tile earth"><span class="tl">Earth</span><b>${p.earthMargin > 0 ? 'In view' : 'Hidden'}</b><small>${el(p.earth.el)} · terrain ${p.earthHorizon.toFixed(1)}° ± ${p.earthU.toFixed(2)}°</small></div>`;
    $('fValid').textContent = `${st.site.short} · computed ${hms(r.at)} UTC from this device's clock · ${Math.round(v.age / 1000)} s old · data valid to 31 Dec 2040 · app ${APP_VERSION}, data ${data.dataId}${coarse ? ' · LOW CONFIDENCE: no fine terrain here, horizon from the 1.9 km or 7.6 km grid' : ''}`;
  }

  async function tick() {
    const r = st.reading;
    if (!st.hold && (!r || r.key !== `${st.site.key}|${st.earth}` || Date.now() - r.at >= REFRESH_MS)) await compute();
    draw();
  }

  return {
    st, tick,
    render() { $('fSite').innerHTML = `${st.site.key.startsWith('custom:') ? `<option value="${st.site.key}" selected>${st.site.name}</option>` : ''}${siteOptions(st.site.key)}`; $('fTask').value = st.taskH; $('fEarth').checked = st.earth; tick(); clearInterval(timer); timer = setInterval(tick, 1000); onChange(); },
    stop() { clearInterval(timer); },
    setSite(site) { st.site = site; st.reading = null; },
    bind() {
      $('fSite').addEventListener('change', async () => { try { st.site = await siteByKey($('fSite').value); st.reading = null; st.hold = false; await tick(); onChange(); } catch (e) { setStatus(e.message); } });
      $('fTask').addEventListener('change', () => { st.taskH = Math.min(240, Math.max(0.25, +$('fTask').value || 2)); $('fTask').value = st.taskH; draw(); onChange(); });
      $('fEarth').addEventListener('change', () => { st.earth = $('fEarth').checked; st.hold = false; tick(); onChange(); });
      $('fHold').addEventListener('click', () => { st.hold = !st.hold; tick(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('field').hidden) tick(); });
    },
    params() { return { fs: st.site.key, ft: st.taskH, fe: st.earth ? 1 : 0 }; },
    async load(q, fallback) {
      st.site = q.fs ? await siteByKey(q.fs).catch(() => fallback) : fallback;
      st.taskH = Math.min(240, Math.max(0.25, +(q.ft || 2))); st.earth = q.fe !== '0';
    },
  };
}
