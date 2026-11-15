// Geometry for the globe (an orthographic view of a sphere drawn on a 2D canvas), testable in Node.
// Frame: the Moon body-fixed ME frame, x toward 0°E (the Earth side), z north.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const latLonToMe = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
export function meToLatLon([x, y, z]) {
  const n = Math.hypot(x, y, z);
  return [Math.asin(z / n) * R2D, Math.atan2(y, x) * R2D];
}

// Earth's centre can be up to this far from the sub-Earth mean point (0°N, 0°E): the largest libration in the
// packed Horizons data 1969-2040 (10.467°, tests/globe.test.mjs re-derives it) plus the observer's parallax
// (<= 0.279° at perigee). Points nearer the Earth-facing centre than 90° minus this always see Earth's centre;
// points farther than 90° plus this never do.
export const LIBRATION_MAX_DEG = 10.47, EARTH_PARALLAX_MAX_DEG = 0.28;
export function earthAlways(lat, lon) {
  const a = Math.acos(Math.cos(lat * D2R) * Math.cos(lon * D2R)) * R2D, m = LIBRATION_MAX_DEG + EARTH_PARALLAX_MAX_DEG;
  return a < 90 - m ? 'always' : a > 90 + m ? 'never' : 'sometimes';
}

// View basis at the centre point: U toward the viewer (local up), E screen-right, N screen-up (all in ME).
// roll [deg] twists the view about U: 0 keeps north up; positive turns the globe clockwise on screen.
export function viewBasis(lat0, lon0, roll = 0) {
  const la = lat0 * D2R, lo = lon0 * D2R, c = Math.cos(roll * D2R), s = Math.sin(roll * D2R);
  const e = [-Math.sin(lo), Math.cos(lo), 0], n = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  return {
    U: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
    E: e.map((x, k) => c * x + s * n[k]),
    N: n.map((x, k) => c * x - s * e[k]),
  };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// ME direction -> view coordinates (X right, Y up, Z toward viewer); a surface point is visible when Z > 0.
export const toView = (b, v) => [dot(v, b.E), dot(v, b.N), dot(v, b.U)];
// Disk point (X, Y), X^2 + Y^2 <= 1 -> the lat/lon under it on the visible hemisphere.
export function unproject(b, X, Y) {
  const Z = Math.sqrt(Math.max(0, 1 - X * X - Y * Y));
  return meToLatLon([0, 1, 2].map((k) => X * b.E[k] + Y * b.N[k] + Z * b.U[k]));
}

// Texture layout: row 0 is the southernmost row (-90°), column 0 is -180°E.
export const texLatLon = (r, c, W, H) => [-90 + (180 * (r + 0.5)) / H, -180 + (360 * (c + 0.5)) / W];
export const texIndex = (lat, lon, W, H) => Math.min(H - 1, Math.max(0, Math.floor(((lat + 90) * H) / 180))) * W + (((Math.floor(((lon + 180) * W) / 360) % W) + W) % W);

// Is the Sun's upper limb hidden by terrain, seen from grid cell (rg, cg)? March toward the Sun along the great
// circle with the shadow map's rules (shadow.js): bilinear samples, half-cell steps (along the ray) out to 20 km then whole cells,
// curvature included, and stop once even the highest point on the Moon could not reach the Sun's line. Within
// `near1` / `near2` metres the highest terrain nearby (`rise1` / `rise2`, above this cell) bounds it instead, so samples that cannot block are skipped
// (the samples taken, and so the answer, are the same as without the skip).
// z: the global grid (DN, 0.5 m), row 0 at +90°, col 0 at 0°E; lat/lon/az in radians; tanSun: tan(upper-limb elevation).
function castShadow(z, ppd, W, H, lat, lon, az, z0, tanSun, rise, rise1, near1, rise2, near2, cellN) {
  const sp1 = Math.sin(lat), cp1 = Math.cos(lat), st = Math.sin(az), ct = Math.cos(az);
  // Within 20 km and away from the poles a straight step in grid coordinates lands within ~3% of a cell of the
  // great-circle point (the curvature drop below is still applied), at a fraction of the trig.
  const flat = Math.abs(lat) < 75 * D2R, fr0 = (90 - lat * R2D) * ppd - 0.5, fc0 = (lon * R2D) * ppd - 0.5, kr = -ct / cellN, kc = st / (cellN * cp1);
  // Near steps: half a grid cell measured along the ray. Cells are cellN north-south but only cellN cos(lat) east-west,
  // so toward the poles an east-west ray steps finer (to cellN/16) instead of skipping whole cells.
  const along = 1 / Math.hypot(ct / cellN, st / (cellN * Math.max(cp1, 1 / 16))), first = Math.max(along, cellN / 8) / 2;
  for (let s = first; ; s += s < 20e3 ? first : cellN) {
    const drop = s / (2 * R_M);
    if (rise / s - drop < tanSun) return false;
    if (s < near1 ? rise1 / s - drop < tanSun : s < near2 && rise2 / s - drop < tanSun) continue;
    let fr, fc;
    if (flat && s < 20e3) { fr = fr0 + kr * s; fc = fc0 + kc * s; } else {
      const d = s / R_M, sd = Math.sin(d), cd = Math.cos(d), sp2 = sp1 * cd + cp1 * sd * ct;
      fr = (90 - Math.asin(sp2) * R2D) * ppd - 0.5; fc = (lon + Math.atan2(st * sd * cp1, cd - sp1 * sp2)) * R2D * ppd - 0.5;
    }
    fr = Math.min(Math.max(fr, 0), H - 1.001); fc = ((fc % W) + W) % W;
    const r0 = Math.floor(fr), c0 = Math.floor(fc), c1 = (c0 + 1) % W, wr = fr - r0, wc = fc - c0;
    const h = ((z[r0 * W + c0] * (1 - wc) + z[r0 * W + c1] * wc) * (1 - wr) + (z[(r0 + 1) * W + c0] * (1 - wc) + z[(r0 + 1) * W + c1] * wc) * wr) * 0.5;
    if ((h - z0 - (s * s) / (2 * R_M)) / s >= tanSun) return true;
  }
}
const R_M = 1737400, B1 = 8, B2 = 32, maxCache = new Map();
// Highest terrain [m]: over the whole Moon, and per BxB-cell block over that block and its 8 neighbours, so every
// point within B grid cells of a cell is covered by its block's value.
function heightBounds(z, W, H, B) {
  const key = z.length + ':' + B;
  if (maxCache.get(key)?.z === z) return maxCache.get(key);
  const BW = W / B, BH = H / B, blk = new Float32Array(BW * BH).fill(-Infinity), near = new Float32Array(BW * BH).fill(-Infinity);
  let all = -Infinity, low = Infinity;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const v = z[r * W + c] * 0.5, k = ((r / B) | 0) * BW + ((c / B) | 0); if (v > blk[k]) blk[k] = v; if (v > all) all = v; if (v < low) low = v; }
  for (let br = 0; br < BH; br++) for (let bc = 0; bc < BW; bc++) {
    let m = -Infinity;
    for (let i = Math.max(0, br - 1); i <= Math.min(BH - 1, br + 1); i++) for (let j = -1; j <= 1; j++) m = Math.max(m, blk[i * BW + ((bc + j + BW) % BW)]);
    near[br * BW + bc] = m;
  }
  // The deepest any horizon can dip below the local horizontal: from the highest point, over the lowest terrain.
  const out = { z, all, near, BW, B, dip: Math.acos((R_M + low) / (R_M + all)) };
  maxCache.set(key, out);
  return out;
}

// Globe texture from the 4 px/deg global grid (720 x 1440, row 0 at +90°, col 0 at 0°E) and the Moon-centred
// Sun vector [km, ME]. Day side: relief shaded by the real Sun, with cast shadows unless `shadows` is false;
// night side and shadow: dim fixed-light relief.
// Returns RGBA pixels at the grid's own resolution plus each pixel's lit flag for testing.
export function globeTexture(grid, sunKm, { shadows = true } = {}) {
  const { z, ppd } = grid, W = 360 * ppd, H = 180 * ppd, px = new Uint8ClampedArray(W * H * 4), lit = new Uint8Array(W * H), hb1 = heightBounds(z, W, H, B1), hb2 = heightBounds(z, W, H, B2);
  const d = Math.hypot(...sunKm), u = sunKm.map((v) => v / d), radius = Math.asin(695700 / d);
  const cellN = (1737400 * D2R) / ppd; // metres per grid step north-south
  for (let r = 0; r < H; r++) {
    const [lat] = texLatLon(r, 0, W, H), rg = H - 1 - r; // grid row for this latitude
    const cl = Math.cos(lat * D2R), sl = Math.sin(lat * D2R), cellE = cellN * Math.max(cl, 0.05);
    // How far each block bound is safe: B cells east-west at the most poleward row its window covers, 10% margin.
    const nearOf = (B) => 0.9 * B * cellN * Math.max(0, Math.cos(Math.min(90, Math.abs(lat) + (2 * B) / ppd) * D2R)), near1 = nearOf(B1), near2 = nearOf(B2);
    for (let c = 0; c < W; c++) {
      const lon = -180 + (360 * (c + 0.5)) / W, cg = (c + W / 2) % W, co = Math.cos(lon * D2R), so = Math.sin(lon * D2R);
      const up = u[0] * cl * co + u[1] * cl * so + u[2] * sl, east = -u[0] * so + u[1] * co, north = -u[0] * sl * co - u[1] * sl * so + u[2] * cl;
      const zn = rg > 0 && rg < H - 1 ? (z[(rg - 1) * W + cg] - z[(rg + 1) * W + cg]) * 0.25 / cellN : 0;
      const ze = (z[rg * W + ((cg + 1) % W)] - z[rg * W + ((cg + W - 1) % W)]) * 0.25 / cellE;
      const norm = Math.hypot(ze, zn, 1), o = 4 * (r * W + c);
      const shade = (-ze * east - zn * north + up) / norm;
      const el = Math.asin(Math.min(1, Math.max(-1, up)));
      const z0 = z[rg * W + cg] * 0.5;
      // Lit means the Sun's upper limb is visible from the cell centre (as the horizon tracer and the polar map judge
      // it); the slope only sets the brightness, so a ridge crest whose far side faces away still counts as lit.
      // From a high point the terrain horizon can sit below the flat one, so the march starts at the deepest dip.
      if (shadows ? el + radius > -hb1.dip && !(el + radius < Math.PI / 2 && castShadow(z, ppd, W, H, lat * D2R, lon * D2R, Math.atan2(east, north), z0, Math.tan(el + radius), hb1.all - z0, hb1.near[((rg / B1) | 0) * hb1.BW + ((cg / B1) | 0)] - z0, near1, hb2.near[((rg / B2) | 0) * hb2.BW + ((cg / B2) | 0)] - z0, near2, cellN)) : el + radius > 0) {
        lit[r * W + c] = 1;
        const b = 70 + 185 * Math.min(1, Math.max(0, shade)); // floor above the brightest shadow (46), so grazing light still reads as lit
        px[o] = b; px[o + 1] = b * 0.95; px[o + 2] = b * 0.86;
      } else {
        const a = 16 + 30 * Math.max(0, (ze * 0.5 + zn * 0.5 + 0.7071) / norm);
        px[o] = a; px[o + 1] = a * 1.05; px[o + 2] = a * 1.3;
      }
      px[o + 3] = 255;
    }
  }
  return { px, lit, W, H };
}
