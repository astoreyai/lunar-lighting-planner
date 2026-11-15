// Real data: our long-term Sun and Earth visibility against the independent LOLA team maps
// (Mazarico et al. 2011, Icarus 211:1066; PGDA product 69, AVGVISIB_85S_060M_201608[_EARTH]):
// average solar-disc visibility and average Earth visibility (any part of disc), hourly over 18.6 years.
// Criteria fixed before the first run: Pearson r > 0.9 and median |difference| < 0.05 on a fixed lattice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raw } from './load_lola.mjs';
import { polarGrid, globalGrid, stack } from '../web/dem.js';
import { traceHorizon, horizonAt } from '../web/horizon.js';
import { diskFraction } from '../web/windows.js';
import { nodeEphemeris } from './load_ephem.mjs';

const pgda = (f) => { const b = readFileSync(new URL(`../data/raw/pgda/${f}.IMG`, import.meta.url)); return polarGrid({ data: new Int16Array(b.buffer, b.byteOffset, b.length / 2), n: 5058, cellM: 60, maxLat: -82.9, id: f }); };
const DN_TO_FRACTION = 0.00004 / 0.5; // polarGrid scales DN by 0.5 (LOLA metres); PGDA DN scale is 0.00004

import { LATTICE } from './lattice.mjs';

const pearson = (a, b) => {
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length, ma = m(a), mb = m(b);
  let sab = 0, saa = 0, sbb = 0;
  a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
  return sab / Math.sqrt(saa * sbb);
};
const median = (v) => { const s = [...v].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

const global4 = () => { const b = readFileSync(new URL('../web/data/dem/global4.i16', import.meta.url)); return globalGrid({ data: new Int16Array(b.buffer, b.byteOffset, b.length / 2), ppd: 4, id: 'g4' }); };
const STACKS = {
  'curated sites (40 m, 240 m, 16 px/deg)': () => stack([
    polarGrid({ data: raw('ldem_85s_40m.img'), n: 7584, cellM: 40, maxLat: -85, id: 'p40' }),
    polarGrid({ data: raw('ldem_75s_240m.img'), n: 3812, cellM: 240, maxLat: -75, id: 'p240' }),
    globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'g16' }),
  ]),
  'custom points in the browser (240 m, 4 px/deg)': () => stack([
    polarGrid({ data: raw('ldem_75s_240m.img'), n: 3812, cellM: 240, maxLat: -75, id: 'p240' }), global4(),
  ]),
};

for (const [label, makeStack] of Object.entries(STACKS)) test(`long-term Sun and Earth visibility match the LOLA team polar maps: ${label}`, async () => {
  const terrain = makeStack();
  const refSun = pgda('AVGVISIB_85S_060M_201608'), refEarth = pgda('AVGVISIB_85S_060M_201608_EARTH');
  const eph = nodeEphemeris(), t0 = Date.UTC(2020, 0, 1), t1 = t0 + 18.6 * 365.25 * 86400e3;
  await eph.ensure(t0, t1);
  const ours = { sun: [], earth: [] }, ref = { sun: [], earth: [] };
  for (const [lat, lon] of LATTICE) {
    const h = traceHorizon(terrain, lat, lon, { eyeM: 0.5 }), site = { lat, lon, hM: h.groundM + 0.5 };
    let sun = 0, earth = 0, n = 0;
    for (let t = t0; t < t1; t += 3600e3, n++) {
      const s = eph.topo(site, 'sun', t), e = eph.topo(site, 'earth', t);
      sun += diskFraction((s.el - horizonAt(h, s.az)) / s.radiusDeg);
      earth += e.el + e.radiusDeg > horizonAt(h, e.az) ? 1 : 0;
    }
    ours.sun.push(sun / n); ours.earth.push(earth / n);
    ref.sun.push(refSun.sample(lat, lon) * DN_TO_FRACTION); ref.earth.push(refEarth.sample(lat, lon) * DN_TO_FRACTION);
  }
  for (const body of ['sun', 'earth']) {
    const d = ours[body].map((x, i) => Math.abs(x - ref[body][i])), r = pearson(ours[body], ref[body]);
    const worst = d.indexOf(Math.max(...d));
    console.log(`${label} ${body}: r=${r.toFixed(3)} median|d|=${median(d).toFixed(3)} worst ${d[worst].toFixed(3)} at ${LATTICE[worst]} (ours ${ours[body][worst].toFixed(3)}, ref ${ref[body][worst].toFixed(3)})`);
    assert.ok(r > 0.9 && median(d) < 0.05, `${body}: r ${r}, median ${median(d)}`);
  }
});
