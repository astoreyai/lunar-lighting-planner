// Real data: our Sun/Earth topocentric directions (from hourly Horizons sub-points) against Horizons'
// own topocentric airless apparent az/el at 6 lunar test points, 1969-2040 (fixtures from fetch_oracle.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeEphemeris } from './load_ephem.mjs';
import { POINTS, SERIES } from './oracle_points.mjs';

const D = Math.PI / 180;
const sep = (a1, e1, a2, e2) => Math.acos(Math.min(1, Math.sin(e1 * D) * Math.sin(e2 * D) + Math.cos(e1 * D) * Math.cos(e2 * D) * Math.cos((a1 - a2) * D))) / D;

export async function residuals(tag) {
  const eph = nodeEphemeris(), out = { sun: [], earth: [] };
  for (const [lon, lat] of POINTS) for (const [code, body] of [['10', 'sun'], ['399', 'earth']]) {
    const text = readFileSync(new URL(`./fixtures/oracle/${code}_${lon}_${lat}${tag}.txt`, import.meta.url), 'utf8');
    for (const line of text.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n')) {
      const f = line.split(',').map((s) => s.trim());
      const t = Date.parse(f[0].replace(/-(\w{3})-/, ' $1 ') + ' UTC');
      await eph.ensure(t, t + 3600e3);
      const p = eph.topo({ lat, lon, hM: 0 }, body, t);
      out[body].push({ t, lon, lat, d: sep(p.az, p.el, +f[3], +f[4]) });
    }
  }
  return out;
}

for (const { tag } of SERIES) test(`Sun and Earth directions agree with Horizons topocentric az/el (${tag ? 'mid-hour, interpolated' : 'on the hour'})`, async () => {
  const r = await residuals(tag);
  for (const body of ['sun', 'earth']) {
    const worst = r[body].reduce((a, b) => (b.d > a.d ? b : a));
    console.log(body, 'n', r[body].length, 'worst deg', worst.d.toFixed(5), new Date(worst.t).toISOString(), worst.lat, worst.lon);
    // Earth bound: sub-Earth point is aberrated from the geocentre, ~v/c = 0.0057 deg; Sun: interpolation only.
    assert.ok(worst.d < (body === 'sun' ? 0.001 : 0.0075), `${body} worst ${worst.d}`);
  }
});
