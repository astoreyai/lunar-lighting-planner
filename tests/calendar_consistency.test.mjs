// Real data: the calendar's hourly "power lost after" must agree with the detail view's sunset event
// (10-minute series, interpolated crossing) to within one hourly sample, for every candidate day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { series, events, landingVerdict } from '../web/windows.js';
import { nodeEphemeris } from './load_ephem.mjs';

const H = 3600e3, D = 24 * H;
const site = (id) => {
  const s = JSON.parse(readFileSync(new URL('../web/data/sites.json', import.meta.url))).sites.find((x) => x.id === id);
  const horizon = JSON.parse(readFileSync(new URL(`../web/data/${s.horizon}`, import.meta.url)));
  return { lat: s.lat_deg, lon: s.lon_deg, hM: horizon.groundM + 2, horizon };
};

for (const id of ['im2_athena', 'apollo11']) test(`calendar power loss matches detail-view sunsets: ${id}`, async () => {
  const s = site(id), eph = nodeEphemeris(), t0 = Date.UTC(2027, 0, 1, 12), days = 120, dur = 10;
  await eph.ensure(t0, t0 + (days + dur + 1) * D);
  const hourly = series(eph, s, s.horizon, t0, t0 + (days + dur) * D, H);
  const fine = series(eph, s, s.horizon, t0, t0 + (days + dur) * D, 10 * 60e3);
  const sunsets = events(fine, 'sunMargin').filter((e) => !e.rising).map((e) => e.t);
  let checked = 0, worst = 0;
  for (let d = 0; d < days; d++) {
    const v = landingVerdict(hourly, d * 24, dur * 24, { minShare: 0, earth: false }), tl = t0 + d * D;
    if (v.verdict !== 'short') continue;
    const next = sunsets.find((t) => t > tl);
    const err = Math.abs(tl + v.lostMs - next);
    worst = Math.max(worst, err); checked++;
    assert.ok(err <= 10 * 60e3, `${id} day ${d}: calendar ${v.lostMs / H} h vs detail ${(next - tl) / H} h`);
  }
  console.log(id, 'short landings checked', checked, 'worst min', (worst / 60e3).toFixed(0));
  assert.ok(checked > 10);
});
