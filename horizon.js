// Terrain horizon: rays along great circles on the 1737.4 km sphere, clockwise from north, with exact
// spherical geometry (curvature included) from an eye `eyeM` above the local terrain. The Moon has no
// atmosphere, so there is no refraction term.
import { R_MOON_M } from './dem.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

// Terrain elevation angle seen from (lat, lon) along each azimuth in `azDeg` (degrees clockwise from north).
export function traceRays(terrain, latDeg, lonDeg, azDeg, opts = {}) {
  const { eyeM = 2, maxRangeM = 300e3, nearM = 20e3, nearStepM = 40, farStepM = 200, startM = 80 } = opts;
  const here = terrain.sample(latDeg, lonDeg);
  if (!here) throw new Error(`no terrain covers ${latDeg}, ${lonDeg}`);
  const r0 = R_MOON_M + here.h + eyeM;
  const p1 = latDeg * D2R, l1 = lonDeg * D2R, sp1 = Math.sin(p1), cp1 = Math.cos(p1);
  const elev = new Float32Array(azDeg.length), dist = new Float32Array(azDeg.length), cell = new Float32Array(azDeg.length), used = new Set([here.grid.id]);
  azDeg.forEach((az, k) => {
    const th = az * D2R, st = Math.sin(th), ct = Math.cos(th);
    let best = -90, bestS = 0, bestCell = 0;
    for (let s = startM; s <= maxRangeM; s += s < nearM ? nearStepM : farStepM) {
      const d = s / R_MOON_M, sd = Math.sin(d), cd = Math.cos(d);
      const sp2 = sp1 * cd + cp1 * sd * ct;
      const lat2 = Math.asin(sp2) * R2D;
      const lon2 = (l1 + Math.atan2(st * sd * cp1, cd - sp1 * sp2)) * R2D;
      const t = terrain.sample(lat2, lon2);
      if (!t) continue; // shortcut: an uncovered sample is skipped; the global grid covers everything
      used.add(t.grid.id);
      const r1 = R_MOON_M + t.h;
      const e = Math.atan2(r1 * cd - r0, r1 * sd) * R2D;
      if (e > best) { best = e; bestS = s; bestCell = t.grid.cellM; }
    }
    elev[k] = best; dist[k] = bestS; cell[k] = bestCell;
  });
  return { elev, dist, cell, groundM: here.h, grids: [...used] }; // dist, cell: range to the terrain that sets each ray's horizon, and that grid's cell size
}

export function traceHorizon(terrain, latDeg, lonDeg, opts = {}) {
  const { nAz = 720, eyeM = 2 } = opts;
  const { elev, dist, cell, groundM, grids } = traceRays(terrain, latDeg, lonDeg, Array.from({ length: nAz }, (_, k) => (k * 360) / nAz), opts);
  return { nAz, elev: Array.from(elev, (e) => Math.round(e * 1000) / 1000), dist: Array.from(dist, Math.round), cell: Array.from(cell, Math.round), groundM, eyeM, grids };
}

// Horizon uncertainty per azimuth, in degrees: the angle a height error of levels[cell] metres subtends at the range
// of the terrain that sets the horizon. `levels` maps a grid's cell size (m, rounded) to that height error; it is
// measured by pipeline/build_uncertainty.mjs. Zero where the horizon carries no range (older files).
export function horizonUnc(h, levels) {
  return Float32Array.from({ length: h.nAz }, (_, i) => (h.dist?.[i] > 0 ? Math.atan2(levels[h.cell[i]] ?? 0, h.dist[i]) * R2D : 0));
}
// The larger uncertainty of the two bins either side of an azimuth.
export function uncAt(h, azDeg) {
  if (!h.unc) return 0;
  const f = ((((azDeg % 360) + 360) % 360) / 360) * h.nAz, i = Math.floor(f) % h.nAz;
  return Math.max(h.unc[i], h.unc[(i + 1) % h.nAz]);
}

// Horizon elevation at an azimuth, linear between bins.
export function horizonAt(h, azDeg) {
  const f = ((((azDeg % 360) + 360) % 360) / 360) * h.nAz, i = Math.floor(f) % h.nAz, w = f - Math.floor(f);
  return h.elev[i] * (1 - w) + h.elev[(i + 1) % h.nAz] * w;
}
