// The field reading and the guided-comparison helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fieldReading, STALE_MS } from '../web/field.js';
import { lowestNear } from '../web/pair.js';
import { gcDist } from '../web/route.js';

const H = 3600e3;
test('field reading: first closure, task fit, close call and staleness (synthetic)', () => {
  const c = { sunMs: 9 * H, earthMs: 6 * H, first: 'earth', endMs: 6 * H };
  const r = { at: Date.UTC(2027, 2, 16, 16), c, worse: { ...c, endMs: 5.5 * H }, better: { ...c, endMs: 6.2 * H }, opensMs: 0 };
  const v = fieldReading(r, r.at, 2 * H, true);
  assert.equal(v.stale, false);
  assert.equal(v.head, '6 h 0 min left');
  assert.match(v.sub, /^Earth sets first, at 2027-03-16 22:00 UTC\. The Sun sets at 2027-03-17 01:00 UTC\. Terrain uncertainty: between 5 h 30 min and 6 h 12 min left\.$/);
  assert.match(v.fit, /^A 2 h 0 min task fits: start by 2027-03-16 20:00 UTC\.$/);
  assert.match(fieldReading(r, r.at + 30e3, 5.8 * H, true).fit, /too close to call/);      // fits as mapped, not with higher terrain
  assert.match(fieldReading(r, r.at + 30e3, 7 * H, true).fit, /does not fit/);
  assert.equal(fieldReading(r, r.at + STALE_MS + 1000, 2 * H, true).stale, true);           // older than the limit: stale
  const closed = fieldReading({ ...r, c: { sunMs: 0, earthMs: 3 * H, first: 'power', endMs: 0 }, opensMs: 4 * H }, r.at, 2 * H, true);
  assert.equal(closed.head, 'Not usable now');
  assert.match(closed.sub, /No sunlight here\. Opens in 4 h 0 min/);
});

test('lowest ground within 10 km of IM-2 on the real 240 m grid: inside the radius and lower than the site', () => {
  const b = readFileSync(new URL('../web/data/dem/polar240.i16', import.meta.url)), z = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
  const low = lowestNear({ n: 3812, cellM: 240, z }, -84.7906, 29.1957);
  assert.ok(gcDist([-84.7906, 29.1957], [low.lat, low.lon]) <= 10e3);
  assert.ok(low.h < 5321 - 500, `low point ${low.h} m`); // the site stands at 5321 m
});
