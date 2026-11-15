// Real data: our Sun direction against NASA Moon Trek's Sun Angle service (no terrain) at three candidate landing
// sites, hourly for 14 days (fixtures from fetch_moontrek.mjs). Moon Trek is an independent implementation: its
// reference frame and corrections are not documented in the response.
// Criterion fixed before the first run: every sample within 0.05 deg, a fifth of the Sun's apparent radius and
// enough for a mean-Earth / principal-axis frame difference (about 0.03 deg) plus aberration (0.006 deg).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeEphemeris } from './load_ephem.mjs';
import { MT_SITES } from './fetch_moontrek.mjs';

const D = Math.PI / 180;
const sep = (a1, e1, a2, e2) => Math.acos(Math.min(1, Math.sin(e1 * D) * Math.sin(e2 * D) + Math.cos(e1 * D) * Math.cos(e2 * D) * Math.cos((a1 - a2) * D))) / D;

test('Sun direction agrees with NASA Moon Trek at three candidate sites, hourly for 14 days from 2027-11-05', async () => {
  const eph = nodeEphemeris(), sites = JSON.parse(readFileSync(new URL('../web/data/sites.json', import.meta.url))).sites;
  for (const id of MT_SITES) {
    const s = sites.find((x) => x.id === id), xml = readFileSync(new URL(`./fixtures/moontrek/${id}.xml`, import.meta.url), 'utf8');
    const rows = [...xml.matchAll(/<time>(\d{4})-(\d{3})T(\d\d):(\d\d):[\d.]+<\/time>\s*<Az[^>]*>([-\d.]+)<\/Az>\s*<El[^>]*>([-\d.]+)<\/El>/g)];
    assert.equal(rows.length, 337);
    let worst = 0, worstEl = 0, at = 0;
    for (const [, y, doy, hh, mm, az, el] of rows) {
      const t = Date.UTC(+y, 0, +doy, +hh, +mm);
      await eph.ensure(t, t + 3600e3);
      const p = eph.topo({ lat: s.lat_deg, lon: s.lon_deg, hM: 0 }, 'sun', t), d = sep(p.az, p.el, +az, +el);
      if (d > worst) { worst = d; at = t; }
      worstEl = Math.max(worstEl, Math.abs(p.el - el));
    }
    console.log(`Moon Trek vs ours, ${id} (${s.lat_deg}, ${s.lon_deg}): worst separation ${worst.toFixed(4)} deg at ${new Date(at).toISOString()}; worst elevation difference ${worstEl.toFixed(4)} deg`);
    assert.ok(worst < 0.05, `${id}: ${worst} deg`);
  }
});
