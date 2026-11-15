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
const planner = createPlanner({ onChange: writeHash });
const field = createField({ onChange: writeHash });
const TABS = [['tabPlan', 'plan'], ['tabExplore', 'explore'], ['tabField', 'field']];
const explore = createExplore({
  onChange: writeHash,
  // "Plan a landing here" from the globe: hand the traced point to the planner.
  onPlan: (site) => { planner.st.site = site; planner.st.near = null; setMode('plan'); window.scrollTo({ top: 0 }); },
});

function setMode(m, focus = false) {
  mode = m;
  for (const [tab, panel] of TABS) {
    const on = panel === m;
    $(tab).setAttribute('aria-selected', on); $(tab).tabIndex = on ? 0 : -1; $(panel).hidden = !on;
    if (on && focus) $(tab).focus();
  }
  if (m !== 'explore') explore.stop();
  if (m !== 'field') field.stop();
  if (m === 'plan') planner.render(); else if (m === 'field') field.render(); else { explore.render(); explore.resize(); } // canvases sized while hidden need a redraw
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
  await planner.load({ site: get('site'), land: legacyLanding(q), dur: get('dur'), share: get('share'), earth: get('earth'), mh: get('mh'), ell: get('ell'), wp: get('wp'), rmax: get('rmax'), rspd: get('rspd'), cmp: get('cmp'), layer: get('layer'), zoom: get('zoom'), ptab: get('ptab'), per: get('per'), from: get('from') }, data.sites.get('im2_athena') || [...data.sites.values()][0]);
  await explore.load({ ex: get('ex'), xs: get('xs'), xh: get('xh') });
  await field.load({ fs: get('fs'), ft: get('ft'), fe: get('fe') }, planner.st.site);
  if (matchMedia('(max-width: 700px)').matches) $('pScen').open = false; // phones: answer first, form on demand
  planner.bind(); explore.bind(); field.bind();
  for (const [tab, panel] of TABS) {
    $(tab).addEventListener('click', () => setMode(panel));
    $(tab).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = TABS.findIndex((t) => t[1] === mode);
      setMode(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][1], true);
    });
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => (mode === 'plan' ? planner.resize() : mode === 'explore' ? explore.resize() : 0), 150); });
  setStatus('');
  setMode(TABS.some((t) => t[1] === q.get('mode')) ? q.get('mode') : 'plan');
}

init().catch((e) => { setStatus(`Couldn't start: ${e.message}`); console.error(e); });
