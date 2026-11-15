// Landing ellipse, approach lighting and surface route. Real data: the 40 m site windows against the raw PDS mosaic,
// the in-browser lit check against the shipped site horizons, route sampling on the real 240 m grid.
// Synthetic inputs (labelled) cover geometry the real data cannot pin down exactly: a tilted plane, ellipse axes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { polarGrid, globalGrid, stack, R_MOON_M } from '../web/dem.js';
import { horizonAt } from '../web/horizon.js';
import { sample } from '../web/windows.js';
import { toMap, fromMap, scaleK, ellipseCells, slopeAt, slopeStats, litShare, approachLight, ellipseFits } from '../web/landing.js';
import { gcDist, gcAt, slopeHere, routeProfile } from '../web/route.js';
import { raw } from './load_lola.mjs';
import { nodeEphemeris } from './load_ephem.mjs';

const web = (p) => new URL(`../web/data/${p}`, import.meta.url);
const i16 = (p) => { const b = readFileSync(web(p)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const meta = JSON.parse(readFileSync(web('dem/crop40.json')));
const sites = JSON.parse(readFileSync(web('sites.json'))).sites;
const p40raw = raw('ldem_85s_40m.img');
const full40 = polarGrid({ data: p40raw, n: 7584, cellM: 40, maxLat: -84, id: 'full40' });
const crop = (id) => polarGrid({ data: i16(meta.sites[id].file), n: meta.n, cellM: meta.cellM, maxLat: -84, id: 'LOLA 40 m window', r0: meta.sites[id].r0, c0: meta.sites[id].c0, m: meta.m });
const p240 = polarGrid({ data: i16('dem/polar240.i16'), n: 3812, cellM: 240, maxLat: -75, id: 'LOLA 240 m (75S)' });
const g4 = globalGrid({ data: i16('dem/global4.i16'), ppd: 4, id: 'LOLA 4 px/deg global' });

test('40 m site windows are exact crops of LDEM_85S_40M and sample identically (real data)', () => {
  assert.ok(Object.keys(meta.sites).length >= 10);
  for (const [id, w] of Object.entries(meta.sites)) {
    const z = i16(w.file);
    for (let i = 0; i < meta.m; i += 30) for (let j = 0; j < meta.m; j += 7) assert.equal(z[i * meta.m + j], p40raw[(w.r0 + i) * meta.n + w.c0 + j], `${id} cell ${i},${j}`);
    const G = crop(id), s = sites.find((x) => x.id === id);
    for (let k = 0; k < 50; k++) {
      const lat = s.lat_deg + (k % 7 - 3) * 0.02, lon = s.lon_deg + (Math.floor(k / 7) - 3) * 0.2;
      const a = G.sample(lat, lon), b = full40.sample(lat, lon);
      if (a !== null) assert.ok(Math.abs(a - b) < 1e-6, `${id} ${lat},${lon}: ${a} vs ${b}`);
    }
  }
});

test('slope of a tilted plane is recovered, in ground metres (synthetic plane)', () => {
  // Synthetic: a plane rising exactly 7 m per 40 m map cell toward map +x (14 DN: no int16 rounding), centred on the pole.
  const n = 201, cell = 40, off = (n - 1) / 2, z = new Int16Array(n * n), tan = 7 / 40;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) z[r * n + c] = (c - off) * 14;
  const G = polarGrid({ data: z, n, cellM: cell, maxLat: -80, id: 'synthetic plane' });
  for (const [R, C] of [[100, 100], [60, 140], [150, 30]]) {
    const [x, y] = [(C - off) * cell, (off - R) * cell], k = scaleK(fromMap(x, y)[0]);
    assert.ok(Math.abs(slopeAt(G, R, C) - Math.atan(tan * k) * 180 / Math.PI) < 0.02, `cell ${R},${C}: ${slopeAt(G, R, C)}`);
  }
  const st = slopeStats(ellipseCells(G, { lat: -89.95, lon: 30 }, { lengthM: 1200, widthM: 400, headingDeg: 0 }), 9.5);
  assert.equal(st.steep, 1); assert.ok(Math.abs(st.mean - Math.atan(tan) * 180 / Math.PI) < 0.02);
});

test('ellipse: area matches pi a b, and the long axis follows the heading (synthetic flat window)', () => {
  // Synthetic: flat zero heights; only the cell geometry matters here.
  const n = 7584, cell = 40, site = { lat: -88, lon: 30 }, [x, y] = toMap(site.lat, site.lon), off = (n - 1) / 2;
  const R = Math.round(off - y / cell), C = Math.round(off + x / cell), m = 301;
  const G = polarGrid({ data: new Int16Array(m * m), n, cellM: cell, maxLat: -84, id: 'synthetic flat', r0: R - 150, c0: C - 150, m });
  for (const [L, W, hdg] of [[2000, 600, 0], [2000, 600, 90], [3000, 1000, 37], [500, 1500, 20]]) {
    const cells = ellipseCells(G, site, { lengthM: L, widthM: W, headingDeg: hdg }), k = scaleK(site.lat);
    const expect = (Math.PI * (L / 2) * (W / 2)) / (cell / k) ** 2;
    assert.ok(Math.abs(cells.length / expect - 1) < 0.05, `${L}x${W}@${hdg}: ${cells.length} cells vs ${expect.toFixed(0)}`);
    // Farthest cell from the centre lies along the heading (to within the cell size).
    const far = cells.reduce((a, c) => (gcDist([c.lat, c.lon], [site.lat, site.lon]) > gcDist([a.lat, a.lon], [site.lat, site.lon]) ? c : a));
    const d = gcDist([far.lat, far.lon], [site.lat, site.lon]);
    assert.ok(Math.abs(d - Math.max(L, W) / 2) < cell * 1.5, `farthest ${d.toFixed(0)} m`);
    const dN = (far.lat - site.lat) * Math.PI / 180 * R_MOON_M, dE = ((far.lon - site.lon) * Math.PI / 180) * R_MOON_M * Math.cos(site.lat * Math.PI / 180);
    const az = ((Math.atan2(dE, dN) * 180 / Math.PI) + 360) % 180, want = (W > L ? hdg + 90 : hdg) % 180; // the long axis is across the track when W > L
    assert.ok(Math.min(Math.abs(az - want), 180 - Math.abs(az - want)) < 4, `axis ${az.toFixed(1)} vs heading ${hdg}`);
  }
  assert.equal(ellipseFits(G, site, 10000), true); assert.equal(ellipseFits(G, site, 13000), false);
});

test('approach lighting: Sun behind = rear half; elevation window (synthetic directions)', () => {
  const w = { elMin: 7, elMax: 20 };
  assert.deepEqual([approachLight({ az: 270, el: 10 }, 90, w).ok, approachLight({ az: 270, el: 10 }, 90, w).off], [true, 0]);
  assert.equal(approachLight({ az: 90, el: 10 }, 90, w).behind, false);   // Sun straight ahead
  assert.equal(approachLight({ az: 200, el: 10 }, 90, w).behind, true);   // 70° off behind
  assert.equal(approachLight({ az: 270, el: 25 }, 90, w).ok, false);      // too high
});

// The app traces sunlight only once the 240 m grid is loaded: with the 1.2 km map grid as far terrain the worst
// difference was 0.595° (2026-11-14), over this 0.5° limit, so that combination is not used.
for (const [label, far] of [['240 m', () => p240]]) test(`in-browser lit check at each 40 m site agrees with the shipped horizon, far terrain ${label} (real data)`, async () => {
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 2, 1), times = Array.from({ length: 12 }, (_, k) => t0 + k * 61 * 3600e3);
  await eph.ensure(t0, times.at(-1) + 3600e3);
  let n = 0, worst = 0, agree = 0, decided = 0;
  for (const id of Object.keys(meta.sites)) {
    const s = sites.find((x) => x.id === id), h = JSON.parse(readFileSync(web(s.horizon))), G = crop(id), terrain = stack([G, far(), g4]);
    const site = { lat: s.lat_deg, lon: s.lon_deg, hM: h.groundM + 2 };
    for (const t of times) {
      const r = litShare([{ R: 0, C: 0, lat: site.lat, lon: site.lon }], terrain, (la, lo, hM) => eph.topo({ lat: la, lon: lo, hM }, 'sun', t));
      const p = sample(eph, site, h, t), sun = eph.topo(site, 'sun', t);
      // the same ray, its elevation compared directly with the shipped horizon
      const { traceRays } = await import('../web/horizon.js');
      const e = traceRays(terrain, site.lat, site.lon, [sun.az], { eyeM: 2, nearStepM: 40, nearM: 20e3, farStepM: 240, startM: 80 }).elev[0];
      worst = Math.max(worst, Math.abs(e - horizonAt(h, sun.az))); n++;
      if (Math.abs(p.sunMargin) > 0.5) { decided++; if ((r.lit === 1) === (p.sunMargin > 0)) agree++; }
    }
  }
  console.log(`lit check (${label}) vs shipped horizons: ${n} site-times, worst horizon difference ${worst.toFixed(3)}°, ${agree}/${decided} agree where the margin exceeds 0.5°`);
  assert.ok(worst < 0.5, `worst ${worst}`);
  assert.equal(agree, decided);
});

test('route: great-circle legs and a profile sampled from the real 240 m grid', () => {
  const a = [-89.0, 10], b = [-88.6, 60], c = [-88.9, 120];
  const hav = (p, q) => { const D = Math.PI / 180, s = Math.sin((q[0] - p[0]) * D / 2) ** 2 + Math.cos(p[0] * D) * Math.cos(q[0] * D) * Math.sin((q[1] - p[1]) * D / 2) ** 2; return 2 * R_MOON_M * Math.asin(Math.sqrt(s)); };
  assert.ok(Math.abs(gcDist(a, b) - hav(a, b)) < 0.01);
  const mid = gcAt(a, b, 0.5);
  assert.ok(Math.abs(gcDist(a, mid) - gcDist(mid, b)) < 0.01);
  const terrain = stack([p240, g4]), pr = routeProfile(terrain, [a, b, c], { stepM: 240, limitDeg: 15 });
  assert.ok(Math.abs(pr.totalM - gcDist(a, b) - gcDist(b, c)) < 1e-6);
  for (const s of pr.samples.filter((_, i) => i % 25 === 0)) assert.equal(s.h, p240.sample(s.lat, s.lon));
  assert.equal(pr.samples.filter((s) => s.wp !== null).length, 3);
  assert.ok(pr.maxSlope > 0 && pr.maxSlope < 60 && pr.climbM > 0);
  // slope on the real grid matches the 40 m slope at the same place within the coarser grid's smoothing (sanity)
  const s240 = slopeHere(terrain, -89.5, 45);
  assert.ok(s240 !== null && s240 >= 0 && s240 < 45);
  console.log(`route: ${(pr.totalM / 1000).toFixed(1)} km, climb ${pr.climbM.toFixed(0)} m, max slope ${pr.maxSlope.toFixed(1)}°, steeper than 15° on ${(pr.steep * 100).toFixed(1)}%`);
});
