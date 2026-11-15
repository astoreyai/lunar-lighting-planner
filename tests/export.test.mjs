// Export, assumptions, data fingerprint and the too-close-to-call rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { series, landingVerdict, landingCall } from '../web/windows.js';
import { horizonUnc } from '../web/horizon.js';
import { missionCsv, assumptions } from '../web/export.js';
import { nodeEphemeris } from './load_ephem.mjs';

const H = 3600e3, D = 24 * H, W = (p) => new URL(`../web/${p}`, import.meta.url);
const levels = JSON.parse(readFileSync(W('data/uncertainty.json'))).levels_m;
const manifest = JSON.parse(readFileSync(W('data/manifest.json')));
const site = (id) => {
  const s = JSON.parse(readFileSync(W('data/sites.json'))).sites.find((x) => x.id === id), horizon = JSON.parse(readFileSync(W(`data/${s.horizon}`)));
  horizon.unc = horizonUnc(horizon, levels);
  return { ...s, key: s.id, lat: s.lat_deg, lon: s.lon_deg, hM: horizon.groundM + 2, horizon };
};

test('shipped data match the manifest; page and code carry one version', () => {
  execFileSync('node', [fileURLToPath(new URL('../pipeline/manifest.mjs', import.meta.url)), '--check']);
  const v = readFileSync(W('core.js'), 'utf8').match(/APP_VERSION = '(\d+)'/)[1], tags = readFileSync(W('index.html'), 'utf8').match(/\?v=\d+/g);
  assert.ok(tags.length > 10 && tags.every((t) => t === `?v=${v}`), `index.html ?v tags must all be ${v}`);
});

test('CSV export reproduces the audit scenario (IM-2, 2027-03-16 16:00 UT) and is deterministic', async () => {
  const eph = nodeEphemeris(), s = site('im2_athena'), land = Date.UTC(2027, 2, 16, 16);
  await eph.ensure(land, land + 11 * D);
  const args = () => ({ site: s, land, durD: 10, minShare: 0, earth: true, version: '16', dataId: manifest.data_id, levels, verdict: 'Cut short', scenario: 'mode=plan', rows: series(eph, s, s.horizon, land, land + 10 * D, H) });
  const csv = missionCsv(args()), lines = csv.trim().split('\n'), head = lines.findIndex((l) => l.startsWith('time_utc'));
  assert.equal(csv, missionCsv(args()));
  const cols = lines[head].split(','), rows = lines.slice(head + 1).map((l) => Object.fromEntries(l.split(',').map((x, i) => [cols[i], x])));
  assert.equal(rows.length, 241);
  assert.equal(rows[0].time_utc, '2027-03-16T16:00Z');
  assert.equal(+rows.find((r) => r.earth_in_view === '0').hours_after_landing, 164); // audit: joint interval 164.0 h, closed by Earth
  assert.equal(+rows.find((r) => r.power_ok === '0').hours_after_landing, 230);      // audit: power lost at 230 h
  assert.ok(lines.slice(0, head).every((l) => l.startsWith('# ')) && lines.some((l) => l.includes(`data ${manifest.data_id}`)));
  assert.equal(assumptions(args()).length, 10);
});

test('terrain uncertainty: measured levels, and the angle shrinks with range (real horizon)', () => {
  const h = site('im2_athena').horizon;
  assert.ok(levels[40] < levels[240] && levels[240] < levels[1895] && levels[1895] < levels[7581]);
  h.dist.forEach((d, i) => assert.ok(Math.abs(h.unc[i] - Math.atan2(levels[h.cell[i]], d) * 180 / Math.PI) < 1e-6));
  assert.ok(Math.max(...h.unc) < 5 && Math.min(...h.unc) > 0);
});

test('too close to call: a margin inside the uncertainty flips the verdict; outside it does not (synthetic)', () => {
  const row = (t, sun, u) => ({ t: t * H, sunMargin: sun, sunFraction: 1, earthMargin: 5, sunU: u, earthU: 0, sun: { el: sun, radiusDeg: 0.26 }, sunHorizon: 0.26 });
  const req = { minShare: 0, earth: true };
  const firm = landingCall([row(0, 1, 0.1), row(1, 1, 0.1), row(2, 1, 0.1)], 0, 1, req);
  assert.deepEqual(firm, { verdict: 'full' });
  const close = landingCall([row(0, 1, 0.1), row(1, 0.05, 0.1), row(2, 1, 0.1)], 0, 1, req); // 0.05° clear, ±0.1° terrain
  assert.equal(close.verdict, 'full');
  assert.equal(close.close.worse.verdict, 'short');
  assert.equal(close.close.better.verdict, 'full');
  assert.equal(landingVerdict([row(0, 0.05, 0.1), row(1, 1, 0.1)], 0, 0, req, 1).verdict, 'none'); // terrain raised: no Sun at landing
});
