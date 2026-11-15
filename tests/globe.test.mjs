// Globe geometry and lighting. Real data: ephemeris from the packed Horizons files, terrain from the
// 4 px/deg LOLA grid; the projection checks use constructed points (synthetic, labelled).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { latLonToMe, meToLatLon, viewBasis, toView, unproject, texIndex, globeTexture, earthAlways, LIBRATION_MAX_DEG } from '../web/globe-math.js';
import { sample } from '../web/windows.js';
import { nodeEphemeris } from './load_ephem.mjs';

const b = readFileSync(new URL('../web/data/dem/global4.i16', import.meta.url));
const grid = { z: new Int16Array(b.buffer, b.byteOffset, b.length / 2), ppd: 4 };
const close = (a, b, tol) => Math.abs(((a - b + 540) % 360) - 180) < tol;

test('orthographic projection: centre pixel is the view centre; project/unproject round trip (synthetic)', () => {
  for (const [lat0, lon0] of [[0, 0], [-62, 25], [-89.9, 140], [45, -170]]) {
    const v = viewBasis(lat0, lon0), [cl, co] = unproject(v, 0, 0);
    assert.ok(Math.abs(cl - lat0) < 1e-9 && close(co, lon0, 1e-6));
    for (const [X, Y] of [[0.3, -0.2], [-0.7, 0.5], [0.05, 0.9]]) {
      const [la, lo] = unproject(v, X, Y), [x, y, z] = toView(v, latLonToMe(la, lo));
      assert.ok(Math.abs(x - X) < 1e-9 && Math.abs(y - Y) < 1e-9 && z > 0);
    }
  }
});

test('globe lit at the Horizons sub-solar point and dark at its antipode; Sun overhead there (real data)', async () => {
  const eph = nodeEphemeris(), flat = { nAz: 4, elev: [0, 0, 0, 0] };
  for (const t of [Date.UTC(1969, 6, 20, 20), Date.UTC(2026, 10, 16, 20), Date.UTC(2035, 2, 1, 6)]) {
    await eph.ensure(t, t + 3600e3);
    const sun = eph.bodyVec('sun', t), [lat, lon] = meToLatLon(sun), tex = globeTexture(grid, sun);
    assert.ok(sample(eph, { lat, lon, hM: 0, horizon: flat }, flat, t).sun.el > 89.9);
    assert.equal(tex.lit[texIndex(lat, lon, tex.W, tex.H)], 1);
    assert.equal(tex.lit[texIndex(-lat, lon > 0 ? lon - 180 : lon + 180, tex.W, tex.H)], 0);
    const [, , Z] = toView(viewBasis(lat, lon), sun.map((x) => x / Math.hypot(...sun)));
    assert.ok(Z > 0.9999); // centred on the sub-solar point, the Sun marker is straight toward the viewer
  }
});

test('libration bound covers every sub-Earth point 1969-2040, and the near/far bands follow from it (real data)', () => {
  let max = 0;
  for (let y = 1969; y <= 2040; y++) {
    const f = readFileSync(new URL(`../web/data/ephem/${y}.bin`, import.meta.url)), a = new Float32Array(f.buffer, f.byteOffset, f.length / 4);
    for (let i = 0; i < a.length; i += 6) max = Math.max(max, Math.acos(Math.cos(a[i + 1] * Math.PI / 180) * Math.cos(a[i] * Math.PI / 180)) * 180 / Math.PI);
  }
  assert.ok(max <= LIBRATION_MAX_DEG && max > LIBRATION_MAX_DEG - 0.05, `scanned ${max}`);
  assert.equal(earthAlways(0, 0), 'always');
  assert.equal(earthAlways(0, 180), 'never');
  assert.equal(earthAlways(0, 85), 'sometimes'); // inside the old hardcoded 82-98 deg band edge region
  assert.equal(earthAlways(0, 80), 'sometimes'); // the old 82 deg guess would have said "always" here
});

test('live two-ray readout matches the full 720-ray horizon at the same azimuths (real LOLA 4 px/deg)', async () => {
  const { traceRays, traceHorizon, horizonAt } = await import('../web/horizon.js');
  const { globalGrid, stack } = await import('../web/dem.js');
  const terrain = stack([globalGrid({ data: grid.z, ppd: 4, id: 'g4' })]), opts = { eyeM: 2, nearStepM: 120, farStepM: 240 };
  for (const [lat, lon] of [[-62, 25], [-89.5, 120], [0.674, 23.473], [45.4, -170]]) {
    const h = traceHorizon(terrain, lat, lon, opts);
    const bins = [0, 37, 359, 512].map((k) => (k * 360) / h.nAz), r = traceRays(terrain, lat, lon, bins, opts);
    bins.forEach((az, i) => assert.ok(Math.abs(r.elev[i] - horizonAt(h, az)) < 0.001, `bin ${az}° at ${lat},${lon}`));
    // Between bins the exact ray and the interpolated horizon differ only by the 0.5° azimuth spacing.
    const mid = traceRays(terrain, lat, lon, [10.25, 200.25], opts).elev;
    assert.ok(Math.abs(mid[0] - horizonAt(h, 10.25)) < 0.5 && Math.abs(mid[1] - horizonAt(h, 200.25)) < 0.5);
  }
});

// Criteria fixed before the first run, as for the polar map (shadow.test.mjs): >= 95% agreement over (cell, time)
// pairs, and every disagreement within 0.5° of the threshold (|Sun upper-limb margin over the traced terrain| < 0.5°).
// Pairs: a fixed lattice of texture cells (every 12th row, 88.4°S-88.4°N; columns about 90 km apart on the ground)
// at 20 real times over a month,
// kept when the Sun is between 9° below and 40° above the smooth horizon (terrain can change the answer there:
// from a high point the terrain horizon dips up to 8.7° below the flat one).
test('globe cast shadows agree with the horizon tracer on the same 4 px/deg grid (real data)', async () => {
  const { traceRays } = await import('../web/horizon.js');
  const { globalGrid, stack, R_MOON_M } = await import('../web/dem.js');
  const terrain = stack([globalGrid({ data: grid.z, ppd: 4, id: 'g4' })]), cellN = (R_MOON_M * Math.PI) / 180 / 4;
  const eph = nodeEphemeris(), t0 = Date.UTC(2027, 0, 1), times = Array.from({ length: 20 }, (_, k) => t0 + k * 36 * 3600e3);
  await eph.ensure(t0, times.at(-1) + 3600e3);
  const W = 1440, H = 720, cells = [];
  for (let r = 6; r < H; r += 12) {
    const lat = -90 + (r + 0.5) / 4, step = Math.round(12 / Math.max(Math.cos(lat * Math.PI / 180), 0.05)); // about equal spacing on the ground
    for (let c = 6; c < W; c += step) { const lon = -180 + (c + 0.5) / 4; cells.push({ r, c, lat, lon, hM: terrain.sample(lat, lon).h }); }
  }
  let n = 0, agree = 0, worst = 0, shadowed = 0;
  for (const t of times) {
    const tex = globeTexture(grid, eph.bodyVec('sun', t));
    for (const p of cells) {
      const s = eph.topo(p, 'sun', t), up = s.el + s.radiusDeg;
      if (up < -9 || up > 40) continue;
      // Same start convention as the march (terrain from half a grid cell out, measured along the ray, counts); the
      // tracer's own steps are finer than the march's everywhere, poles included.
      const a = s.az * Math.PI / 180, along = 1 / Math.hypot(Math.cos(a) / cellN, Math.sin(a) / (cellN * Math.max(Math.cos(p.lat * Math.PI / 180), 1 / 16)));
      const [h] = traceRays(terrain, p.lat, p.lon, [s.az], { eyeM: 0, startM: Math.max(along, cellN / 8) / 2, nearStepM: 250, farStepM: 500 }).elev;
      const margin = up - h, lit = tex.lit[p.r * W + p.c] === 1;
      n++; if (!lit && up > 0) shadowed++;
      if (lit === margin > 0) agree++; else worst = Math.max(worst, Math.abs(margin));
    }
  }
  const polar = cells.filter((p) => Math.abs(p.lat) > 75).length;
  console.log(`globe shadows (${cells.length} cells, ${polar} poleward of 75°): ${agree}/${n} agree (${((100 * agree) / n).toFixed(2)}%), ${shadowed} in shadow with the Sun up, worst disagreement ${worst.toFixed(3)}°`);
  assert.ok(n > 1000 && shadowed > 50, 'the sample must include real cast shadows');
  assert.ok(agree / n >= 0.95, `agreement ${agree}/${n}`);
  assert.ok(worst < 0.5, `worst disagreement ${worst}°`);
});

test('twisted view: north appears at screen (sin r, cos r), the centre stays put, axes stay orthonormal (geometry)', () => {
  for (const [lat, lon] of [[-62, 25], [0, 0], [-89, 140]]) for (const r of [0, 30, 90, -135]) {
    const b = viewBasis(lat, lon, r), d = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    for (const [a, c, want] of [[b.E, b.E, 1], [b.N, b.N, 1], [b.U, b.U, 1], [b.E, b.N, 0], [b.E, b.U, 0], [b.N, b.U, 0]]) assert.ok(Math.abs(d(a, c) - want) < 1e-12);
    const [cl, co] = unproject(b, 0, 0); assert.ok(Math.abs(cl - lat) < 1e-9 && Math.abs(((co - lon + 540) % 360) - 180) < 1e-9);
    const north = latLonToMe(Math.min(lat + 1, 89.99), lon), [X, Y] = toView(b, north), h = Math.hypot(X, Y);
    assert.ok(Math.abs(X / h - Math.sin(r * Math.PI / 180)) < 0.02 && Math.abs(Y / h - Math.cos(r * Math.PI / 180)) < 0.02, `${lat},${lon} r=${r}: ${X / h}, ${Y / h}`);
  }
});
