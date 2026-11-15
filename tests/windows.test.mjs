// Unit tests for windows.js. Inputs are synthetic (constructed margins and disk offsets), labelled as such.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diskFraction, events, summary } from '../web/windows.js';

test('disk fraction: fully below, half, fully above (synthetic)', () => {
  assert.equal(diskFraction(-1.2), 0);
  assert.ok(Math.abs(diskFraction(0) - 0.5) < 1e-12);
  assert.equal(diskFraction(1.5), 1);
  assert.ok(Math.abs(diskFraction(0.3) + diskFraction(-0.3) - 1) < 1e-12); // symmetric
});

test('events interpolate sign changes; summary counts fractions and longest gap (synthetic)', () => {
  const H = 3600e3, m = [-1, 1, 3, -1, -1, -1, 1];
  const rows = m.map((v, i) => ({ t: i * H, sunMargin: v, earthMargin: 1, sunFraction: v > 0 ? 1 : 0 }));
  const ev = events(rows, 'sunMargin');
  assert.deepEqual(ev.map((e) => [e.t / H, e.rising]), [[0.5, true], [2.75, false], [5.5, true]]);
  const s = summary(rows);
  assert.ok(Math.abs(s.sunlit - 3 / 7) < 1e-12);
  assert.equal(s.longestDarkMs, 2 * H);
  assert.equal(s.earthVisible, 1);
});

test('landing verdict: first closure is named, the later one follows (synthetic)', async () => {
  const { landingVerdict } = await import('../web/windows.js');
  const H = 3600e3, row = (t, sun, earth, frac = sun > 0 ? 1 : 0) => ({ t: t * H, sunMargin: sun, sunFraction: frac, earthMargin: earth });
  const rows = [row(0, -1, 1), row(1, 1, -1), row(2, 1, 1), row(3, 1, 1), row(4, 1, -1), row(5, -1, 1), row(6, 1, 1, 0.4)];
  const any = { minShare: 0, earth: false }, withEarth = { minShare: 0, earth: true };
  assert.equal(landingVerdict(rows, 0, 2, any).verdict, 'none');                       // dark at landing
  assert.equal(landingVerdict(rows, 1, 2, withEarth).reason, 'Earth hidden at landing'); // Earth checked after Sun
  assert.deepEqual(landingVerdict(rows, 2, 1, withEarth), { verdict: 'full' });
  assert.deepEqual(landingVerdict(rows, 2, 3, any), { verdict: 'short', reason: 'power', lostMs: 2.5 * H }); // margins of +1 then -1 an hour apart cross zero half-way
  assert.deepEqual(landingVerdict(rows, 2, 3, withEarth), { verdict: 'short', reason: 'earth', lostMs: 1.5 * H, then: { reason: 'power', lostMs: 2.5 * H } }); // Earth closes first
  const tie = [row(0, 1, 1), row(1, -1, -1), row(2, 1, 1)];
  assert.deepEqual(landingVerdict(tie, 0, 1, withEarth), { verdict: 'short', reason: 'power', lostMs: 0.5 * H, then: { reason: 'earth', lostMs: 0.5 * H } }); // same moment: power named first
  assert.deepEqual(landingVerdict(rows, 2, 2, withEarth), { verdict: 'short', reason: 'earth', lostMs: 1.5 * H });
  const share = [row(0, 1, 1), row(1, 0.5, 1, 0.3), row(2, 1, 1)]; // the Sun's margin is still positive but too little of the disk shows: no crossing to interpolate to
  assert.deepEqual(landingVerdict(share, 0, 1, { minShare: 0.5, earth: false }), { verdict: 'short', reason: 'power', lostMs: H });
  assert.equal(landingVerdict(rows, 5, 2, any), null);                                 // mission runs past the data
  assert.equal(landingVerdict(rows, 6, 0, { minShare: 0.5, earth: false }).verdict, 'none'); // 40% of disk < 50% needed
});

test('closures: interpolated loss times, which closes first, lost at start, never lost (synthetic)', async () => {
  const { closures } = await import('../web/windows.js');
  const H = 3600e3, row = (t, sun, earth) => ({ t: t * H, sunMargin: sun, sunFraction: sun > 0 ? 1 : 0, earthMargin: earth });
  const rows = [row(0, 3, 1), row(1, 2, 1), row(2, 1, -1), row(3, -1, -1)];
  assert.deepEqual(closures(rows, { minShare: 0, earth: true }), { sunMs: 2.5 * H, earthMs: 1.5 * H, first: 'earth', endMs: 1.5 * H });
  assert.deepEqual(closures(rows, { minShare: 0, earth: false }), { sunMs: 2.5 * H, earthMs: 1.5 * H, first: 'power', endMs: 2.5 * H });
  assert.equal(closures([row(0, -1, 1), row(1, 1, 1)], { minShare: 0, earth: true }).endMs, 0);
  assert.deepEqual(closures([row(0, 1, 1), row(1, 1, 1)], { minShare: 0, earth: true }), { sunMs: null, earthMs: null, first: null, endMs: null });
});

test('usable windows: interpolated edges, who opens and who closes, open at either end (synthetic)', async () => {
  const { usableWindows } = await import('../web/windows.js');
  const H = 3600e3, row = (t, sun, earth) => ({ t: t * H, sunMargin: sun, sunFraction: sun > 0 ? 1 : 0, earthMargin: earth });
  //            0           1           2            3            4            5           6           7
  const rows = [row(0, 1, 1), row(1, 1, -1), row(2, -1, -3), row(3, 1, -1), row(4, 3, 1), row(5, 1, 3), row(6, -1, 3), row(7, 1, 1)];
  const w = usableWindows(rows, { minShare: 0, earth: true });
  assert.deepEqual(w.map((x) => [x.open / H, x.close === null ? null : x.close / H, x.openedBy, x.closedBy]),
    [[0, 0.5, null, 'earth'], [3.5, 5.5, 'earth', 'power'], [6.5, null, 'power', null]]);
  const sunOnly = usableWindows(rows, { minShare: 0, earth: false });
  assert.deepEqual(sunOnly.map((x) => [x.open / H, x.close === null ? null : x.close / H]), [[0, 1.5], [2.5, 5.5], [6.5, null]]);
});

test('usable windows at Apollo 11 in 2027 repeat every lunar day; at IM-2 they do not (real data)', async () => {
  const { usableWindows, series } = await import('../web/windows.js');
  const { readFileSync } = await import('node:fs');
  const { nodeEphemeris } = await import('./load_ephem.mjs');
  const H = 3600e3, eph = nodeEphemeris(), t0 = Date.UTC(2027, 0, 1), t1 = Date.UTC(2027, 11, 31);
  await eph.ensure(t0, t1);
  const lengths = (id) => {
    const s = JSON.parse(readFileSync(new URL('../web/data/sites.json', import.meta.url))).sites.find((x) => x.id === id), h = JSON.parse(readFileSync(new URL(`../web/data/${s.horizon}`, import.meta.url)));
    return usableWindows(series(eph, { lat: s.lat_deg, lon: s.lon_deg, hM: h.groundM + 2 }, h, t0, t1, H), { minShare: 0, earth: true }).filter((w) => w.openedBy && w.close && w.close - w.open >= 24 * H).map((w) => (w.close - w.open) / H);
  };
  const a = lengths('apollo11'), m = lengths('im2_athena');
  console.log(`2027 windows: Apollo 11 ${Math.min(...a).toFixed(0)}-${Math.max(...a).toFixed(0)} h (${a.length}); IM-2 ${Math.min(...m).toFixed(0)}-${Math.max(...m).toFixed(0)} h (${m.length})`);
  assert.ok(a.length >= 11 && Math.max(...a) - Math.min(...a) < 3);
  assert.ok(Math.max(...m) - Math.min(...m) > 200);
});
