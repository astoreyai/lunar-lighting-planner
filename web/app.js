// Start-up, mode tabs and the shareable link. Links from earlier versions (t=, at=, cal=) still open.
import { $, DAY, data, loadCore, setStatus } from './core.js';
import { createPlanner } from './planner.js';
import { createExplore } from './explore.js';
import { createField } from './field.js';

let mode = 'plan', hashTimer = 0;
const writeHash = () => {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const q = new URLSearchParams({ mode, ...(mode === 'plan' ? planner.params() : mode === 'field' ? field.params() : explore.params()) });
    history.replaceState(null, '', `#${q}`);
  }, 250);
};
const planner = createPlanner({ onChange: writeHash, onQ: () => markTabs() });
const field = createField({ onChange: writeHash });
// One row of questions: five are views of the planner (its st.q), then Explore and the field view.
const TABS = [['tabCheck', 'plan', 'check'], ['tabDate', 'plan', 'date'], ['tabPlace', 'plan', 'place'], ['tabCompare', 'plan', 'compare'], ['tabRoute', 'plan', 'route'], ['tabExplore', 'explore'], ['tabField', 'field']];
const isOn = ([, m, q]) => m === mode && (!q || q === planner.st.q);
let started = false;
const explore = createExplore({
  onChange: writeHash,
  // "Plan a landing here" from the globe: hand the traced point to the planner.
  onPlan: (site) => { planner.st.site = site; planner.st.near = null; setMode('plan', 'check'); window.scrollTo({ top: 0 }); },
});

function markTabs(focus = false) {
  for (const t of TABS) {
    const on = isOn(t);
    $(t[0]).setAttribute('aria-selected', on); $(t[0]).tabIndex = on ? 0 : -1;
    if (on) { $(t[1]).setAttribute('aria-labelledby', t[0]); if (focus) $(t[0]).focus(); }
  }
}
function setMode(m, q, focus = false) {
  const was = mode;
  mode = m;
  if (q) planner.st.q = q;
  for (const p of ['plan', 'explore', 'field']) $(p).hidden = p !== m;
  markTabs(focus);
  if (m !== 'explore') explore.stop();
  if (m !== 'field') field.stop();
  if (m === 'plan' && was === 'plan' && started) planner.setQ(planner.st.q); // another question on the same scenario: nothing to recompute
  else if (m === 'plan') { planner.render(); started = true; } else if (m === 'field') field.render(); else { explore.render(); explore.resize(); } // canvases sized while hidden need a redraw
}

// Old links carried the time as `at`, or as `start` plus a window fraction `t` over `span` days.
function legacyLanding(q) {
  const p = (s) => (s ? Date.parse(`${s.length === 16 ? `${s}:00` : s}Z`) : NaN);
  for (const t of [p(q.get('land')), p(q.get('at'))]) if (!Number.isNaN(t)) return t;
  const s = p(q.get('start'));
  if (!Number.isNaN(s) && q.get('t')) return s + +q.get('t') * +(q.get('span') || 30) * DAY;
  return Number.isNaN(s) ? null : s;
}

async function init() {
  setStatus('Loading sites and terrain…');
  await loadCore();
  const q = new URLSearchParams(location.hash.slice(1)), get = (k) => q.get(k) ?? undefined;
  await planner.load({ site: get('site'), land: legacyLanding(q), dur: get('dur'), share: get('share'), earth: get('earth'), mh: get('mh'), ell: get('ell'), wp: get('wp'), rmax: get('rmax'), rspd: get('rspd'), cmp: get('cmp'), layer: get('layer'), zoom: get('zoom'), ptab: get('ptab'), q: get('q'), per: get('per'), from: get('from') }, data.sites.get('im2_athena') || [...data.sites.values()][0]);
  await explore.load({ ex: get('ex'), xs: get('xs'), xh: get('xh') });
  await field.load({ fs: get('fs'), ft: get('ft'), fe: get('fe') }, planner.st.site);
  if (matchMedia('(max-width: 700px)').matches) $('pScen').open = false; // phones: answer first, form on demand
  planner.bind(); explore.bind(); field.bind();
  for (const [tab, panel, ask] of TABS) {
    $(tab).addEventListener('click', () => setMode(panel, ask));
    $(tab).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = TABS[(TABS.findIndex(isOn) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      setMode(n[1], n[2], true);
    });
  }
  // Info bubbles close on a click elsewhere or on Escape.
  const shut = (but) => { for (const d of document.querySelectorAll('details.info[open]')) if (!but || !d.contains(but)) d.open = false; };
  document.addEventListener('click', (e) => shut(e.target));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => (mode === 'plan' ? planner.resize() : mode === 'explore' ? explore.resize() : 0), 150); });
  setStatus('');
  setMode(TABS.some((t) => t[1] === q.get('mode')) ? q.get('mode') : 'plan');
}

init().catch((e) => { setStatus(`Couldn't start: ${e.message}`); console.error(e); });
