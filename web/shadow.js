// Lit-terrain map: which points of a south-polar stereographic grid see the Sun at one instant.
// For each cell, march along the Sun's local azimuth and compare the terrain's elevation angle
// (curvature included) with the Sun's upper limb. The Sun is far enough that one direction serves
// every cell; its local azimuth and elevation still change across the map.
// Imported with this module's own ?v= query: a worker has no import map, and without the query it could pair this
// file with a stale cached copy of the next.
const { R_MOON_M } = await import(`./dem.js${new URL(import.meta.url).search}`);

const MAX_RHO = 2 * R_MOON_M * Math.tan((15 * Math.PI) / 360), TAN_LOW = Math.tan(-0.1); // the 75S circle on the map; a body 5.7 deg below the horizon

// grid: { z: Int16Array (DN, 0.5 m), n, cellM }; bodyKm: Moon-centred vector to the Sun or Earth (km, ME frame).
// opts.radiusKm: the body's radius when its upper limb decides (the Sun); 0 when its centre does (Earth).
// opts.near: the body is close enough that its direction differs from cell to cell (Earth: up to 0.26 deg).
// opts.dhM: terrain height uncertainty; litCell then also says whether the answer survives it (`edge`).
// opts.skip: false marches every sample (the reference the block skip is tested against).
// A grid may be a window of a larger one: { z, n (the window's size), cellM, r0, c0, full (the larger grid's size) }.
// opts.far: { grid, dhM }, a coarser grid of the same projection that takes the march over where this one ends
// (a 40 m window inside the 240 m grid): terrain far from the cell still shades it.
export function shadowContext(grid, bodyKm, { radiusKm = 695700, near = false, dhM = 0, skip = true, far = null } = {}) {
  const { z, n, cellM, r0 = 0, c0 = 0, full = n } = grid, off = (full - 1) / 2, d = Math.hypot(...bodyKm), p = pyramid(z, n);
  return { z, n, cellM, offR: off - r0, offC: off - c0, b: bodyKm, near, dh: dhM, u: bodyKm.map((v) => v / d), tanRadius: Math.tan(Math.asin(radiusKm / d)), zmaxM: p.zmax * 0.5, pyr: skip ? p.levels : null,
    far: far && shadowContext(far.grid, bodyKm, { radiusKm, near, dhM: far.dhM, skip }) };
}

// Highest terrain per block of 2, 4, ... 64 cells a side (each with one cell of overlap, so a bilinear sample is
// bounded by its block), and overall. The march jumps over a block whose highest point cannot reach the ray.
// Cached per height array.
const SHIFTS = [1, 2, 3, 4, 5, 6], pyramids = new WeakMap();
function pyramid(z, n) {
  let p = pyramids.get(z);
  if (!p) {
    let zmax = -Infinity, nb = Math.ceil(n / 2), max = new Int16Array(nb * nb).fill(-32768);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const v = z[r * n + c], br = r >> 1, bc = c >> 1;
      if (v > zmax) zmax = v;
      for (let i = r % 2 === 0 && br > 0 ? br - 1 : br; i <= br; i++) for (let j = c % 2 === 0 && bc > 0 ? bc - 1 : bc; j <= bc; j++) if (v > max[i * nb + j]) max[i * nb + j] = v;
    }
    const levels = [{ sh: 1, nb, max }];
    for (const sh of SHIFTS.slice(1)) { // a block is the union of its four children, overlap included
      const lo = levels.at(-1), nb2 = Math.ceil(lo.nb / 2), m2 = new Int16Array(nb2 * nb2).fill(-32768);
      for (let i = 0; i < lo.nb; i++) for (let j = 0; j < lo.nb; j++) { const k = (i >> 1) * nb2 + (j >> 1), v = lo.max[i * lo.nb + j]; if (v > m2[k]) m2[k] = v; }
      levels.push({ sh, nb: nb2, max: m2 });
    }
    pyramids.set(z, p = { zmax, levels });
  }
  return p;
}

// Visibility of the body from cell (r, c): -1 north of 75S; otherwise bit 0: blocked on the terrain as mapped (but
// not with it lowered by ctx.dh), bit 1: blocked only with it raised, 4: blocked even with it lowered (or the body
// well below the horizon). No trigonometry: on this projection the cell's latitude and longitude follow from its map
// position by algebra, and the body's elevation is used only as a tangent. This runs once per cell per time step.
let gUp = 0, gDx = 0, gDy = 0; // the last cell's body elevation (sine) and map direction, for litCell's relief shading
function cellCode(ctx, r, c) {
  const { z, n, cellM } = ctx;
  let u = ctx.u;
  const x = (c - ctx.offC) * cellM, y = (ctx.offR - r) * cellM, rho = Math.sqrt(x * x + y * y);
  if (rho > MAX_RHO) return -1;
  // colatitude from the south pole = 2 atan(t); longitude = atan2(x, y)
  const t = rho / (2 * R_MOON_M), q = 1 + t * t, sl = (t * t - 1) / q, cl = (2 * t) / q, so = rho ? x / rho : 0, co = rho ? y / rho : 1;
  if (ctx.near) { // direction from this cell, not from the Moon's centre
    const R = R_MOON_M / 1000, vx = ctx.b[0] - R * cl * co, vy = ctx.b[1] - R * cl * so, vz = ctx.b[2] - R * sl, d = Math.sqrt(vx * vx + vy * vy + vz * vz);
    u = [vx / d, vy / d, vz / d];
  }
  const up = u[0] * cl * co + u[1] * cl * so + u[2] * sl;
  const east = -u[0] * so + u[1] * co;
  const north = -u[0] * sl * co - u[1] * sl * so + u[2] * cl;
  const horiz = Math.sqrt(east * east + north * north) || 1e-12; // cos(elevation)
  // Map axes for local north (away from the south pole) and east, per metre of map distance.
  const dx = (north * so + east * co) / horiz, dy = (north * co - east * so) / horiz;
  gUp = up; gDx = dx; gDy = dy;
  const tanEl = up / horiz, den = 1 - tanEl * ctx.tanRadius, tanSun = den > 0 ? (tanEl + ctx.tanRadius) / den : Infinity; // tan(elevation + the body's radius)
  if (tanSun < TAN_LOW) return 4; // 5.7 deg below: no lunar terrain dips that far
  const z0 = z[r * n + c] * 0.5;
  let f = march(ctx, r, c, z0, dx, dy, tanSun, 0);
  if (!(f & 4) && ctx.far && leftAt) { const F = ctx.far; f |= march(F, F.offR - y / F.cellM, F.offC + x / F.cellM, z0, dx, dy, tanSun, leftAt); }
  return f & 4 ? 4 : f;
}

// Body geometry and visibility for cell (r, c): { inside, lit, el, shade, edge }; shade is cos(incidence) for relief.
// `edge` (only with ctx.dh): raising or lowering the terrain along the ray by ctx.dh metres would flip `lit`.
export function litCell(ctx, r, c) {
  const f = cellCode(ctx, r, c);
  if (f < 0) return { inside: false };
  const { z, n, cellM } = ctx, el = Math.asin(Math.max(-1, Math.min(1, gUp)));
  // Relief shading from the local slope (map-frame normal against the Sun direction).
  const zx = c > 0 && c < n - 1 ? (z[r * n + c + 1] - z[r * n + c - 1]) * 0.25 / cellM : 0;
  const zy = r > 0 && r < n - 1 ? (z[(r - 1) * n + c] - z[(r + 1) * n + c]) * 0.25 / cellM : 0;
  const shade = Math.max(0, (-zx * gDx * Math.cos(el) - zy * gDy * Math.cos(el) + Math.sin(el)) / Math.hypot(zx, zy, 1));
  return f === 4 ? { inside: true, lit: false, el, shade, edge: false } : { inside: true, lit: !(f & 1), el, shade, edge: f !== 0 };
}
// A cell's code as the landing layer stores it: bit 0 visible on the terrain as mapped, bit 1 visible even with it
// raised by ctx.dh, bit 2 visible if it is lowered.
const VIS = [7, 4, 5, 4, 0]; // by cellCode: clear; blocked as mapped; blocked only if raised; both; blocked outright

// March over ctx's grid from (r, c) (fractions allowed) along the map direction (dx, dy), starting `sFrom` metres out.
// Returns bit 0: blocked on the terrain as mapped (but not with it lowered by ctx.dh); bit 1: blocked only with it
// raised; 4: blocked even with it lowered. `leftAt` is then the distance at which the march ran out of this grid
// (its edge, or nothing in it high enough any more), where a coarser grid can take over; 0 if it was blocked first.
let leftAt = 0;
function march(ctx, r, c, z0, dx, dy, tanSun, sFrom) {
  const { z, n, cellM, dh, pyr } = ctx, dc = dx / cellM, dr = -dy / cellM, rise = ctx.zmaxM - z0 + dh;
  const half = cellM / 2, J = Math.ceil(20e3 / half), curv = 1 / (2 * R_MOON_M); // samples every half cell out to 20 km (narrow ridges hide between coarser ones), then every cell
  let f = 0, lv = 0; // lv: pyramid level to try next: up after a jump, down when a block might reach the ray
  leftAt = 0;
  march: for (let j = sFrom <= J * half ? Math.max(1, Math.ceil(sFrom / half)) : J + Math.ceil((sFrom - J * half) / cellM); ; j++) {
    const s = j <= J ? j * half : J * half + (j - J) * cellM;
    if (rise / s - s * curv < tanSun) { leftAt = s; break; }
    const fr = r + dr * s, fc = c + dc * s, r0 = Math.floor(fr), c0 = Math.floor(fc);
    if (r0 < 0 || c0 < 0 || r0 >= n - 1 || c0 >= n - 1) { leftAt = s; break; } // shortcut: with no coarser grid to take over, terrain beyond the edge (75S) is not modelled
    if (pyr) for (;;) {
      const p = pyr[lv], br = r0 >> p.sh, bc = c0 >> p.sh, top = p.max[br * p.nb + bc] * 0.5 + dh - z0;
      if ((top > 0 ? top / s : 0) - s * curv < tanSun) { // nothing in this block is high enough, even raised by dh: jump to the last sample inside it
        const er = dr > 0 ? (((br + 1) << p.sh) - fr) / dr : dr < 0 ? ((br << p.sh) - fr) / dr : Infinity;
        const ec = dc > 0 ? (((bc + 1) << p.sh) - fc) / dc : dc < 0 ? ((bc << p.sh) - fc) / dc : Infinity;
        const k = Math.ceil(Math.min(er, ec) / (j < J ? half : cellM)) - 1;
        if (k > 0) j += j < J ? Math.min(k, J - j) : k;
        if (lv < pyr.length - 1) lv++;
        continue march;
      }
      if (lv === 0) break;
      lv--;
    }
    const wr = fr - r0, wc = fc - c0, i = r0 * n + c0; // bilinear, as the horizon tracer samples LOLA
    const h = ((z[i] * (1 - wc) + z[i + 1] * wc) * (1 - wr) + (z[i + n] * (1 - wc) + z[i + n + 1] * wc) * wr) * 0.5;
    const a = (h - z0) / s - s * curv;
    if (a >= tanSun) {
      if (a - dh / s >= tanSun) return 4; // blocked even with the terrain lowered
      f |= 1;
    } else if (dh && a + dh / s >= tanSun) f |= 2;
  }
  return f;
}

// Lit map of a window of the grid (rows r0.., cols c0.., size w x h) as RGBA pixels: lit terrain warm and
// shaded by the real Sun; shadow dim blue-grey with fixed relief so the terrain stays readable.
export function litImage(ctx, r0 = 0, c0 = 0, w = ctx.n, h = ctx.n) {
  const { z, n, cellM } = ctx, px = new Uint8ClampedArray(w * h * 4);
  let litCount = 0, inside = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = r0 + y, c = c0 + x, o = 4 * (y * w + x);
    if (r < 1 || c < 1 || r >= n - 1 || c >= n - 1) continue;
    const k = litCell(ctx, r, c);
    if (!k.inside) continue;
    inside++;
    if (k.lit) {
      litCount++;
      const b = 150 + 105 * Math.min(1, k.shade * 8); // sunlit ground reads as plainly lit even with the Sun 1-2 deg up
      px[o] = b; px[o + 1] = b * 0.94; px[o + 2] = b * 0.82;
    } else {
      const zx = (z[r * n + c + 1] - z[r * n + c - 1]) * 0.25 / cellM, zy = (z[(r - 1) * n + c] - z[(r + 1) * n + c]) * 0.25 / cellM;
      const a = 14 + 34 * Math.max(0, (zx * 0.5 - zy * 0.5 + 0.7071) / Math.hypot(zx, zy, 1)); // fixed light from the upper left
      px[o] = a; px[o + 1] = a * 1.05; px[o + 2] = a * 1.25;
    }
    px[o + 3] = 255;
  }
  return { px, w, h, litFraction: inside ? litCount / inside : 0 };
}

// Slope of the grid surface at cell (r, c), degrees, from central differences (so at the scale of two cells).
export function slopeDeg(grid, r, c) {
  const { z, n, cellM } = grid;
  const zx = (z[r * n + c + 1] - z[r * n + c - 1]) * 0.25 / cellM, zy = (z[(r - 1) * n + c] - z[(r + 1) * n + c]) * 0.25 / cellM;
  return Math.atan(Math.hypot(zx, zy)) * 180 / Math.PI;
}

// One visibility pass over a window, for the combined landing layer. Per cell, bit 0: visible on the terrain as
// mapped; bit 1: visible even with the terrain raised by ctx.dh; bit 2: visible if it is lowered by ctx.dh.
// `only`: an earlier pass's output; cells where it is 0 are skipped (their result cannot matter) and left 0.
export function visPass(ctx, r0, c0, w, h, out = new Uint8Array(w * h), only = null) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = r0 + y, c = c0 + x;
    if (r < 1 || c < 1 || r >= ctx.n - 1 || c >= ctx.n - 1 || (only && !only[y * w + x])) { out[y * w + x] = 0; continue; }
    const f = cellCode(ctx, r, c);
    out[y * w + x] = f < 0 ? 0 : VIS[f];
  }
  return out;
}

// The same pass over a list of cells: `cells[i]` is an index into the grid (r * n + c), or -1 for nothing there.
// `up`, if given, receives the sine of the body's elevation above the level horizon at each cell computed.
export function visCells(ctx, cells, out = new Uint8Array(cells.length), only = null, up = null) {
  const n = ctx.n;
  for (let i = 0; i < cells.length; i++) {
    const j = cells[i], r = Math.floor(j / n), c = j % n;
    if (j < 0 || r < 1 || c < 1 || r >= n - 1 || c >= n - 1 || (only && !only[i])) { out[i] = 0; if (up) up[i] = 0; continue; }
    const f = cellCode(ctx, r, c);
    out[i] = f < 0 ? 0 : VIS[f];
    if (up) up[i] = f < 0 ? 0 : gUp;
  }
  return out;
}
