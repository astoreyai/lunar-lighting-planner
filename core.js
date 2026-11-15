// Shared data, sites and helpers for both modes.
import { createEphemeris, FIRST_YEAR, LAST_YEAR } from './ephem.js';
import { polarGrid, globalGrid, stack, tileWindow } from './dem.js';
import { traceHorizon, horizonUnc } from './horizon.js';

export const $ = (id) => document.getElementById(id);
export const HOUR = 3600e3, DAY = 24 * HOUR, EYE_M = 2;
export const APP_VERSION = '42'; // the ?v= in index.html; tests/export.test.mjs keeps the two equal
export const T_MIN = Date.UTC(FIRST_YEAR, 0, 1), T_MAX = Date.UTC(LAST_YEAR + 1, 0, 1) - HOUR;

// Data files are requested with their own hash from the manifest, so a browser never pairs new code with a stale cached file.
let manifest = null;
const get = async (u, kind) => {
  const tag = manifest?.files[u.replace(/^data\//, '')]?.sha256.slice(0, 10);
  const r = await fetch(tag ? `${u}?d=${tag}` : u, tag ? undefined : { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Couldn't load ${u} (HTTP ${r.status}).`);
  return r[kind]();
};
export const getJSON = (u) => get(u, 'json'), getBin = (u) => get(u, 'arrayBuffer');
export const eph = createEphemeris((y) => getBin(`data/ephem/${y}.bin`));
export const data = { catalogue: [], sites: new Map(), meta: null, grids: {}, unc: {}, dataId: '', clps: null };

export async function loadCore() {
  manifest = await getJSON('data/manifest.json');
  const [cat, meta, unc, clps] = await Promise.all([getJSON('data/sites.json'), getJSON('data/dem/meta.json'), getJSON('data/uncertainty.json'), getJSON('data/clps.json')]);
  data.clps = clps; data.catalogue = cat.sites; data.meta = meta; data.unc = unc.levels_m; data.dataId = manifest.data_id;
  const loaded = await Promise.all(cat.sites.map(async (s) => {
    const horizon = await getJSON(`data/${s.horizon}`);
    horizon.unc = horizonUnc(horizon, data.unc);
    return { ...s, key: s.id, lat: s.lat_deg, lon: s.lon_deg, hM: horizon.groundM + EYE_M, horizon, short: s.name.split(' (')[0] };
  }));
  for (const s of loaded) data.sites.set(s.key, s);
}

const gridLoads = {}; // in-flight loads, so two callers never fetch the same grid twice
export async function loadGrid(name) {
  if (!data.grids[name]) {
    gridLoads[name] ||= (async () => {
      const m = data.meta[name], z = new Int16Array(await getBin(`data/${m.file}`));
      data.grids[name] = { ...m, z, sampler: m.ppd ? globalGrid({ data: z, ppd: m.ppd, id: 'LOLA 4 px/deg global' }) : polarGrid({ data: z, n: m.n, cellM: m.cellM, maxLat: m.maxLat, id: name === 'polar240' ? 'LOLA 240 m (75S)' : 'LOLA 1.2 km map grid' }) };
    })().finally(() => delete gridLoads[name]);
    await gridLoads[name];
  }
  return data.grids[name];
}

// A window of the 40 m terrain (85-90 S), assembled from its tiles; a tile is fetched once and kept.
const tiles40 = new Map();
export const loadWindow40 = (r0, c0, m) => tileWindow(data.meta.tiles40, r0, c0, m, (k) => {
  if (!tiles40.has(k)) tiles40.set(k, getBin(`data/${data.meta.tiles40.dir}/${k}.i16`).then((b) => new Int16Array(b)).catch((e) => { tiles40.delete(k); throw e; }));
  return tiles40.get(k);
});

const r3 = (x) => Math.round(x * 1000) / 1000;
// A point traced live in the browser (240 m south of 75S, 7.6 km elsewhere). `fast` uses coarser ray steps.
export async function customSite(lat, lon, { fast = false, name } = {}) {
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 360)) throw new Error('Enter a latitude between -90 and 90 and a longitude between -180 and 360.');
  lat = Math.max(Math.min(lat, 89.999), -89.999); // shortcut: east/north undefined exactly at a pole
  if (lon > 180) lon -= 360;
  const polar = lat <= -75;
  if (polar && !data.grids.polar240) setStatus('Loading 240 m south-polar terrain (29 MB, first time only)…');
  const layers = polar ? [(await loadGrid('polar240')).sampler, (await loadGrid('global4')).sampler] : [(await loadGrid('global4')).sampler];
  const horizon = traceHorizon(stack(layers), lat, lon, { eyeM: EYE_M, ...(fast ? { nearStepM: 120, farStepM: 240 } : {}) });
  horizon.unc = horizonUnc(horizon, data.unc);
  setStatus('');
  return { key: `custom:${r3(lat)},${r3(lon)}`, name: name || `Point ${r3(lat)}°, ${r3(lon)}°E`, short: name || `Point ${r3(lat)}°, ${r3(lon)}°E`, group: 'Custom', lat, lon, hM: horizon.groundM + EYE_M, horizon, ground_m: horizon.groundM, horizon_grids: horizon.grids };
}

export async function siteByKey(key) {
  if (key?.startsWith('custom:')) { const [a, b] = key.slice(7).split(',').map(Number); return customSite(a, b); }
  const s = data.sites.get(key);
  if (!s) throw new Error(`Unknown site "${key}".`);
  return s;
}

export function siteOptions(selected) {
  // Candidate sites and regions first; past landings after them, marked as such.
  const past = (g) => data.catalogue.some((s) => s.group === g && s.landing_utc);
  const groups = [...new Set(data.catalogue.map((s) => s.group))].sort((a, b) => past(a) - past(b));
  return groups.map((g) => `<optgroup label="${g}${past(g) ? ' (past landings)' : ''}">${data.catalogue.filter((s) => s.group === g).map((s) => `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${s.name}</option>`).join('')}</optgroup>`).join('');
}

// ---------- formatting ----------
export const fmtDur = (ms) => {
  const m = Math.round(ms / 60e3);
  if (m >= 1440) { const h = Math.round(m / 60); return `${Math.floor(h / 24)} d ${h % 24} h`; } // days and the nearest hour (it used to drop the minutes, so 6 d 19 h 58 min read "6 d 19 h")
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
};
export const fmtUTC = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export const fmtDay = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtDayShort = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const pct = (x) => `${Math.round(x * 100)}%`;
export const isoMin = (t) => new Date(t).toISOString().slice(0, 16);
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const compass = (az) => DIRS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

export const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export function setupCanvas(cv, cssH) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth;
  cv.width = Math.round(w * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = `${cssH}px`;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h: cssH };
}
export function setStatus(msg) { const el = $('status'); if (el) { el.textContent = msg; el.hidden = !msg; } }

// Small inline icons (no icon font): verdict marks and controls.
export const ICON = {
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  short: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  none: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  earth: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 9c3 1 5 0 7-2M8 19c1-3 4-4 7-3 2 .7 3-1 4-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
