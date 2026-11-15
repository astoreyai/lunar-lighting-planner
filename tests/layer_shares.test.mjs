// Real data: the landing layer's long-term sunlight and Earth-contact shares against the independent LOLA team maps
// (Mazarico et al. 2011, Icarus 211:1066; PGDA product 69): average solar-disc visibility and average Earth
// visibility, hourly over 18.6 years. The layer runs on the 240 m terrain at the cells nearest a fixed lattice,
// every 12 hours over the same 18.6 years, as the page's year-long period does.
// Criteria fixed before the first run, the same as for the site horizons (tests/pgda_illumination.test.mjs):
// Pearson r > 0.9 and median |difference| < 0.05, for the Sun and for Earth.
// Known differences in what is counted: the layer counts the Sun as up when any part of its disc shows (the maps
// average the visible fraction of the disc), and Earth by its centre (the maps by any part of its disc).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { polarGrid, R_MOON_M } from '../web/dem.js';
import { buildSuit } from '../web/suit.js';
import { nodeEphemeris } from './load_ephem.mjs';
import { LATTICE } from './lattice.mjs';

const pgda = (f) => { const b = readFileSync(new URL(`../data/raw/pgda/${f}.IMG`, import.meta.url)); return polarGrid({ data: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: 5058, cellM: 60, maxLat: -82.9, id: f }); };
const DN_TO_FRACTION = 0.00004 / 0.5; // polarGrid scales DN by 0.5 (LOLA metres); PGDA DN scale is 0.00004
const pearson = (a, b) => {
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length, ma = m(a), mb = m(b);
  let sab = 0, saa = 0, sbb = 0;
  a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
  return sab / Math.sqrt(saa * sbb);
};
const median = (v) => { const s = [...v].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

test('the layer\'s long-term sunlight and Earth-contact shares match the LOLA team polar maps (real 240 m LOLA, 18.6 years)', async () => {
  const b = readFileSync(new URL('../web/data/dem/polar240.i16', import.meta.url)), grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: 3812, cellM: 240 };
  const dhM = JSON.parse(readFileSync(new URL('../web/data/uncertainty.json', import.meta.url))).levels_m[240], D2R = Math.PI / 180, off = (grid.n - 1) / 2;
  const cells = new Int32Array(LATTICE.length), at = LATTICE.map(([lat, lon], i) => { // the 240 m cell nearest each lattice point, and that cell's own position
    const rho = 2 * R_MOON_M * Math.tan((90 + lat) * D2R / 2), r = Math.round(off - rho * Math.cos(lon * D2R) / 240), c = Math.round(off + rho * Math.sin(lon * D2R) / 240);
    cells[i] = r * grid.n + c;
    const x = (c - off) * 240, y = (off - r) * 240;
    return [(2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON_M))) / D2R - 90, Math.atan2(x, y) / D2R];
  });
  const eph = nodeEphemeris(), t0 = Date.UTC(2020, 0, 1), spanMs = 18.6 * 365.25 * 86400e3;
  await eph.ensure(t0, t0 + spanMs + 86400e3);
  const suit = await buildSuit({ grid, cells, w: cells.length, h: 1, t0, spanMs, stepMs: 12 * 3600e3, durMs: 10 * 86400e3, needEarth: true, dhM, stats: true, bodies: (t) => ({ sun: eph.bodyVec('sun', t), earth: eph.bodyVec('earth', t) }) });
  const refSun = pgda('AVGVISIB_85S_060M_201608'), refEarth = pgda('AVGVISIB_85S_060M_201608_EARTH');
  const ours = { sun: [], earth: [] }, ref = { sun: [], earth: [] };
  at.forEach(([lat, lon], i) => { const q = suit.stat(i); ours.sun.push(q.sun); ours.earth.push(q.earth); ref.sun.push(refSun.sample(lat, lon) * DN_TO_FRACTION); ref.earth.push(refEarth.sample(lat, lon) * DN_TO_FRACTION); });
  for (const body of ['sun', 'earth']) {
    const d = ours[body].map((x, i) => Math.abs(x - ref[body][i])), r = pearson(ours[body], ref[body]), worst = d.indexOf(Math.max(...d)), bias = ours[body].reduce((s, x, i) => s + x - ref[body][i], 0) / d.length;
    console.log(`layer shares vs LOLA team maps, ${body}: r=${r.toFixed(3)} median|d|=${median(d).toFixed(3)} mean difference ${bias >= 0 ? '+' : ''}${bias.toFixed(3)} worst ${d[worst].toFixed(3)} at ${LATTICE[worst]} (ours ${ours[body][worst].toFixed(3)}, ref ${ref[body][worst].toFixed(3)}); ${suit.stats.n} samples`);
    assert.ok(r > 0.9 && median(d) < 0.05, `${body}: r ${r}, median ${median(d)}`);
  }
});
