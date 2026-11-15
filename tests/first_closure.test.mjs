// Real data: a cut-short verdict names whichever of power and Earth contact closes first (audit finding F-1).
// Expected hours are the audit's (audit/lunar-navigator/scenarios_output.txt), found there by an independent minute search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { series, landingVerdict } from '../web/windows.js';
import { nodeEphemeris } from './load_ephem.mjs';

const H = 3600e3, D = 24 * H, req = { minShare: 0, earth: true };
const site = (id) => {
  const s = JSON.parse(readFileSync(new URL('../web/data/sites.json', import.meta.url))).sites.find((x) => x.id === id);
  const horizon = JSON.parse(readFileSync(new URL(`../web/data/${s.horizon}`, import.meta.url)));
  return { lat: s.lat_deg, lon: s.lon_deg, hM: horizon.groundM + 2, horizon };
};
const eph = nodeEphemeris();

// [site, landing, joint interval in hours (audit), hours to the Sun's loss (audit)]
const CASES = [
  ['im2_athena', Date.UTC(2027, 2, 16, 16), 164.0, 230],
  ['im2_athena', Date.UTC(2027, 2, 19, 16), 92.0, 158],
  ['a3_n1', Date.UTC(2027, 2, 14, 16), 64.8, 89],
  ['a3_n2', Date.UTC(2027, 2, 14, 16), 160.1, 236],
];
for (const [id, t0, jointH, powerH] of CASES) test(`first closure is Earth, then power: ${id} ${new Date(t0).toISOString().slice(0, 13)}`, async () => {
  await eph.ensure(t0, t0 + 11 * D);
  const s = site(id), v = landingVerdict(series(eph, s, s.horizon, t0, t0 + 11 * D, H), 0, 240, req);
  assert.equal(v.verdict, 'short');
  assert.equal(v.reason, 'earth');
  assert.equal(v.lostMs / H, Math.ceil(jointH)); // hourly rows: the first failing hour
  assert.deepEqual(v.then, { reason: 'power', lostMs: powerH * H });
});

test('every cut-short landing in 120 days names the earlier loss: IM-2', async () => {
  const s = site('im2_athena'), t0 = Date.UTC(2027, 0, 1, 16), days = 120;
  await eph.ensure(t0, t0 + (days + 11) * D);
  const rows = series(eph, s, s.horizon, t0, t0 + (days + 11) * D, H);
  let short = 0, earthFirst = 0;
  for (let d = 0; d < days; d++) {
    const i = d * 24, v = landingVerdict(rows, i, 240, req);
    if (v.verdict !== 'short') continue;
    short++;
    const j = rows.findIndex((r, k) => k > i && !(r.sunMargin > 0 && r.earthMargin > 0)); // independent: first hour either is lost
    assert.equal(v.lostMs, rows[j].t - rows[i].t, `day ${d}`);
    assert.equal(v.reason, rows[j].sunMargin > 0 ? 'earth' : 'power', `day ${d}`);
    if (v.reason === 'earth') earthFirst++;
  }
  console.log('IM-2 cut-short landings', short, 'closed first by Earth', earthFirst);
  assert.ok(short > 10 && earthFirst > 0);
});
