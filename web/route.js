// Surface route between waypoints: great-circle legs on the 1737.4 km sphere, a terrain profile sampled from a
// dem.js stack, and slope along the way (pure functions, testable in Node).
import { R_MOON_M } from './dem.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const vec = ([lat, lon]) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
const latLon = ([x, y, z]) => [Math.asin(Math.max(-1, Math.min(1, z / Math.hypot(x, y, z)))) * R2D, Math.atan2(y, x) * R2D];

// Ground distance [m] between two [lat, lon] points along the great circle.
export function gcDist(a, b) {
  const p = vec(a), q = vec(b), c = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const s = Math.hypot(p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]);
  return Math.atan2(s, c) * R_MOON_M;
}
// Point a fraction f of the way from a to b along the great circle (spherical linear interpolation).
export function gcAt(a, b, f) {
  const p = vec(a), q = vec(b), w = gcDist(a, b) / R_MOON_M;
  if (w < 1e-12) return a.slice();
  const s = Math.sin(w), ka = Math.sin((1 - f) * w) / s, kb = Math.sin(f * w) / s;
  return latLon([0, 1, 2].map((i) => ka * p[i] + kb * q[i]));
}

// Terrain slope [deg] at a point: central differences one grid cell east-west and north-south of it, on whichever
// grid of the stack covers the point. null where the neighbours are not all covered by that grid.
export function slopeHere(terrain, lat, lon) {
  const here = terrain.sample(lat, lon);
  if (!here) return null;
  const g = here.grid, d = g.cellM, dLat = (d / R_MOON_M) * R2D, dLon = dLat / Math.max(Math.cos(lat * D2R), 1e-6);
  const h = (la, lo) => g.sample(la, lo);
  const n = h(lat + dLat, lon), s = h(lat - dLat, lon), e = h(lat, lon + dLon), w = h(lat, lon - dLon);
  if ([n, s, e, w].includes(null)) return null;
  return Math.atan(Math.hypot((e - w) / (2 * d), (n - s) / (2 * d))) * R2D;
}

// Profile along waypoints `pts` ([[lat, lon], ...], at least 2): a sample every ~stepM metres (and at every waypoint)
// with ground height, terrain slope and along-track grade. Totals: length, climb, descent, maxima, and the share of
// the route's length on terrain steeper than `limitDeg`.
export function routeProfile(terrain, pts, { stepM = 60, limitDeg = 15 } = {}) {
  const samples = [], legs = [];
  let s0 = 0;
  for (let k = 1; k < pts.length; k++) {
    const L = gcDist(pts[k - 1], pts[k]), n = Math.max(1, Math.ceil(L / stepM));
    legs.push({ from: k - 1, to: k, lengthM: L, startM: s0 });
    for (let i = k === 1 ? 0 : 1; i <= n; i++) {
      const [lat, lon] = gcAt(pts[k - 1], pts[k], i / n), t = terrain.sample(lat, lon);
      samples.push({ s: s0 + (L * i) / n, lat, lon, h: t ? t.h : null, grid: t?.grid.id, slope: t ? slopeHere(terrain, lat, lon) : null, leg: k - 1, wp: i === n ? k : i === 0 ? 0 : null });
    }
    s0 += L;
  }
  let climb = 0, descent = 0, maxGrade = 0, maxSlope = 0, steepM = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], ds = b.s - a.s;
    if (a.h !== null && b.h !== null && ds > 0) {
      const dh = b.h - a.h; if (dh > 0) climb += dh; else descent -= dh;
      b.grade = Math.atan(dh / ds) * R2D; maxGrade = Math.max(maxGrade, Math.abs(b.grade));
    }
    if (b.slope !== null) { maxSlope = Math.max(maxSlope, b.slope); if (b.slope > limitDeg) steepM += ds; }
  }
  return { samples, legs, totalM: s0, climbM: climb, descentM: descent, maxGrade, maxSlope, steep: s0 ? steepM / s0 : 0, grids: [...new Set(samples.map((x) => x.grid).filter(Boolean))] };
}
