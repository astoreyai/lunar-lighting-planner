// Audit scenarios for the Lunar Lighting Planner, run against the app's own modules and shipped data (real data only).
// Usage: node audit/lunar-navigator/scenarios.mjs > audit/lunar-navigator/scenarios_output.txt
// Time scale: UT (the Horizons fetch uses TIME_TYPE 'UT'). Observer: 2 m above the LOLA ground, as in the app.
import { readFileSync } from 'node:fs';
import { nodeEphemeris } from '../../tests/load_ephem.mjs';
import { sample, series, landingVerdict, summary } from '../../web/windows.js';
import { polarGrid, globalGrid, stack } from '../../web/dem.js';
import { traceRays, traceHorizon, horizonAt } from '../../web/horizon.js';

const W = (p) => new URL(`../../web/data/${p}`, import.meta.url);
const sites = JSON.parse(readFileSync(W('sites.json'))).sites;
const eph = nodeEphemeris();
const H = 3600e3, D = 24 * H, MIN = 60e3;
const iso = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UT';
const f2 = (x) => (x === null || x === undefined ? '—' : x.toFixed(2));
const site = (id) => {
  const s = sites.find((x) => x.id === id), h = JSON.parse(readFileSync(W(s.horizon)));
  return { id, name: s.name, lat: s.lat_deg, lon: s.lon_deg, hM: h.groundM + 2, h };
};
const i16 = (p) => { const b = readFileSync(W(p)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };

// First loss of Sun (upper limb) or Earth (centre) after t0, to the minute. Returns the closing condition.
function closure(S, t0, maxDays = 30) {
  const ok = (r) => ({ sun: r.sunMargin > 0, earth: r.earthMargin > 0 });
  const r0 = ok(sample(eph, S, S.h, t0));
  if (!r0.sun || !r0.earth) return { open: false, sun: r0.sun, earth: r0.earth };
  for (let k = 1; k <= maxDays * 24; k++) {
    const r = ok(sample(eph, S, S.h, t0 + k * H));
    if (!r.sun || !r.earth) {
      for (let m = 1; m <= 60; m++) {
        const q = ok(sample(eph, S, S.h, t0 + (k - 1) * H + m * MIN));
        if (!q.sun || !q.earth) return { open: true, hours: (k - 1) + m / 60, at: t0 + (k - 1) * H + m * MIN, closedBy: !q.sun && !q.earth ? 'Sun and Earth together' : !q.sun ? 'Sun (power input)' : 'Earth (direct-to-Earth line of sight)' };
      }
    }
  }
  return { open: true, hours: null, closedBy: `nothing within ${maxDays} d` };
}
const verdict10 = (S, t0) => { // the app's rule: 10-day mission, any part of the Sun, Earth required, hourly rows
  const rows = series(eph, S, S.h, t0, t0 + 11 * D, H);
  return landingVerdict(rows, 0, 240, { minShare: 0, earth: true });
};
const vtxt = (v) => (v.verdict === 'full' ? 'full 10 d' : v.verdict === 'none' ? `can't start (${v.reason})` : `cut short after ${(v.lostMs / H).toFixed(0)} h (${v.reason})`);

const out = [];
const log = (s = '') => { out.push(s); console.error(s); };
await eph.ensure(Date.UTC(2027, 0, 1), Date.UTC(2027, 11, 31));

// ---- A. Site fixed, landing date slips ----
const A = site('im2_athena');
log(`## A. Site fixed, date slips: ${A.name} (${A.lat}°, ${A.lon}°E), eye 2 m, horizon = shipped 720-ray profile (LOLA 40 m → 240 m → 16 px/°)`);
// planned landing: the hour in March 2027 that opens the longest joint Sun+Earth interval
let best = null;
for (let t = Date.UTC(2027, 2, 1); t < Date.UTC(2027, 3, 1); t += H) {
  const s = sample(eph, A, A.h, t), p = sample(eph, A, A.h, t - H);
  if (s.sunMargin > 0 && s.earthMargin > 0 && !(p.sunMargin > 0 && p.earthMargin > 0)) { const c = closure(A, t); if (c.hours && (!best || c.hours > best.c.hours)) best = { t, c }; }
}
log(`Planned landing (opens the longest joint Sun+Earth interval that starts in March 2027): ${iso(best.t)}`);
log('| Slip | Landing (same time of day) | Sun up | Earth up | Joint interval | Closed first by | 10-day verdict (Earth required) |');
log('|---|---|---|---|---|---|---|');
for (const d of [0, 1, 2, 5, 10, 14, 28]) {
  const t = best.t + d * D, c = closure(A, t), v = verdict10(A, t);
  log(`| +${d} d | ${iso(t)} | ${c.open || c.sun ? 'yes' : 'no'} | ${c.open || c.earth ? 'yes' : 'no'} | ${c.open ? (c.hours ? c.hours.toFixed(1) + ' h' : '>30 d') : 'not open'} | ${c.open ? c.closedBy : '—'} | ${vtxt(v)} |`);
}
// next landing hour after a 14-day slip that still gives a full 10-day mission
{
  const t0 = best.t + 14 * D, rows = series(eph, A, A.h, t0, t0 + 120 * D, H);
  let k = 0; for (; k < rows.length - 241; k++) if (landingVerdict(rows, k, 240, { minShare: 0, earth: true })?.verdict === 'full') break;
  log(`After a 14-day slip, the first landing hour with a full 10-day mission (Earth required) is ${k < rows.length - 241 ? iso(rows[k].t) + ` (${(k / 24).toFixed(1)} d later)` : 'not found within 120 d'}.`);
}

// ---- B. Date fixed, nearby sites compared ----
const ids = ['im2_athena', 'a3_mm', 'a3_mp', 'a3_n1', 'a3_n2', 'a3_ma', 'a3_hw', 'a3_g2', 'a3_sp', 'a3_cb'];
log(); log(`## B. Date fixed (${iso(best.t)}), nearby south-polar sites compared`);
log('| Site | Lat, lon | Sun margin ° | Earth margin ° | Joint interval | Closed first by | 10-day verdict | 30-d sunlit / Earth / both |');
log('|---|---|---|---|---|---|---|---|');
for (const id of ids) {
  const S = site(id), s = sample(eph, S, S.h, best.t), c = closure(S, best.t), v = verdict10(S, best.t);
  const sm = summary(series(eph, S, S.h, best.t, best.t + 30 * D, H));
  log(`| ${S.name.replace('Artemis III candidate region: ', 'A3: ')} | ${S.lat.toFixed(2)}, ${S.lon.toFixed(2)} | ${f2(s.sunMargin)} | ${f2(s.earthMargin)} | ${c.open ? (c.hours ? c.hours.toFixed(1) + ' h' : '>30 d') : 'not open'} | ${c.open ? c.closedBy : (!c.sun ? 'Sun already down' : 'Earth already hidden')} | ${vtxt(v)} | ${Math.round(sm.sunlit * 100)}% / ${Math.round(sm.earthVisible * 100)}% / ${Math.round(sm.both * 100)}% |`);
}

// ---- C. Grazing horizon ----
log(); log('## C. Grazing Sun (centre within 0.1° of a terrain horizon at least 0.5° high), 10-min steps, March 2027');
let graze = null;
for (const id of ids) {
  const S = site(id);
  for (let t = Date.UTC(2027, 2, 1); t < Date.UTC(2027, 3, 1) && !graze; t += 10 * MIN) {
    const s = sample(eph, S, S.h, t);
    if (s.sunHorizon > 0.5 && Math.abs(s.sun.el - s.sunHorizon) < 0.1) graze = { S, t, s };
  }
  if (graze) break;
}
if (graze) {
  const { S, t, s } = graze;
  const p240 = polarGrid({ data: i16('dem/polar240.i16'), n: 3812, cellM: 240, maxLat: -75, id: '240' });
  const g4 = globalGrid({ data: i16('dem/global4.i16'), ppd: 4, id: 'g4' });
  const e240 = traceRays(stack([p240, g4]), S.lat, S.lon, [s.sun.az], { eyeM: 2 }).elev[0];
  log(`Site ${S.name} (${S.lat}°, ${S.lon}°E, ground ${S.h.groundM.toFixed(0)} m, eye 2 m), ${iso(t)}`);
  log(`App: Sun centre el ${s.sun.el.toFixed(3)}°, az ${s.sun.az.toFixed(2)}°, angular radius ${s.sun.radiusDeg.toFixed(3)}°`);
  log(`Terrain horizon at that azimuth: shipped profile (40 m → 240 m → 16 px/°) ${s.sunHorizon.toFixed(3)}°; live 240 m → 4 px/° trace ${e240.toFixed(3)}° (difference ${(e240 - s.sunHorizon).toFixed(3)}°)`);
  log(`Upper-limb margin ${s.sunMargin.toFixed(3)}° → counted as Sun up; visible disk ${(s.sunFraction * 100).toFixed(0)}% (power input scales with this fraction, not with up/down)`);
  log(`HORIZONS_CHECK ${S.lon} ${S.lat} ${(S.hM / 1000).toFixed(4)} ${new Date(t).toISOString().slice(0, 16).replace('T', ' ')}`);
}

// ---- D. Outside data coverage ----
log(); log('## D. Outside data coverage');
try { await eph.ensure(Date.UTC(2041, 0, 5), Date.UTC(2041, 0, 6)); log('2041-01-05: loaded (unexpected)'); } catch (e) { log(`2041-01-05 (after the 1969–2040 ephemeris span): ensure() throws "${e.message}"`); }
{
  await eph.ensure(Date.UTC(2040, 11, 20), Date.UTC(2040, 11, 31, 23));
  const rows = series(eph, A, A.h, Date.UTC(2040, 11, 25), Date.UTC(2040, 11, 31, 23), H);
  log(`Landing 2040-12-25 with a 10-day mission: rows end at ${iso(rows.at(-1).t)}; landingVerdict returns ${JSON.stringify(landingVerdict(rows, 0, 240, { minShare: 0, earth: true }))} (null = past the data)`);
}
{
  const g4 = globalGrid({ data: i16('dem/global4.i16'), ppd: 4, id: 'LOLA 4 px/deg global' });
  const h = traceHorizon(stack([g4]), -74.5, 30, { eyeM: 2 });
    log(`Custom point -74.5°, 30°E (north of the 240 m grid's 75°S edge): horizon traced on ${JSON.stringify(h.grids)}; the result has no per-ray completeness field (keys: ${Object.keys(h).join(', ')})`);
  const a3mp = sites.find((x) => x.id === 'a3_mp'), crops = JSON.parse(readFileSync(W('dem/crop40.json')));
  log(`a3_mp (${a3mp.lat_deg}°) has a 40 m window: ${Boolean(crops.sites.a3_mp)} (LDEM_85S_40M stops at 85°S equivalent edge; ellipse falls back to 240 m)`);
}

// ---- E. One move-the-lander point, traced as the app does (planner.js: fast trace, 240 m → 4 px/°) ----
{
  log(); log('## E. Move-the-lander point "5 km northeast" of IM-2 Athena, landing 2027-03-16 16:00 UT');
  const R = 1737.4e3, D2R = Math.PI / 180, base = site('im2_athena'), p1 = base.lat * D2R, l1 = base.lon * D2R, d = 5000 / R, th = 45 * D2R;
  const sp2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th);
  const lat = Math.asin(sp2) / D2R, lon = (l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sp2)) / D2R;
  const p240 = polarGrid({ data: i16('dem/polar240.i16'), n: 3812, cellM: 240, maxLat: -75, id: 'LOLA 240 m (75S)' });
  const g4 = globalGrid({ data: i16('dem/global4.i16'), ppd: 4, id: 'LOLA 4 px/deg global' });
  const h = traceHorizon(stack([p240, g4]), lat, lon, { eyeM: 2, nearStepM: 120, farStepM: 240 });
  const S = { id: 'ne5', name: '5 km NE', lat, lon, hM: h.groundM + 2, h }, t = Date.UTC(2027, 2, 16, 16);
  const c = closure(S, t), v = verdict10(S, t);
  log(`Point ${lat.toFixed(4)}°, ${lon.toFixed(4)}°E (grids ${JSON.stringify(h.grids)}): joint interval ${c.open ? (c.hours ? c.hours.toFixed(1) + ' h' : '>30 d') : 'not open'}, closed first by ${c.closedBy ?? '—'}; app verdict: ${vtxt(v)}`);
}
console.log(out.join('\n'));
