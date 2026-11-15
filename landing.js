// Landing ellipse and approach lighting on a south polar stereographic LOLA grid (pure functions, testable in Node).
// Grids are dem.js polarGrid objects: { z, n, cellM, r0, c0, m } (an m x m window of the full n x n grid).
import { R_MOON_M } from './dem.js';
import { traceRays } from './horizon.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

// Map coordinates [m] of the south polar stereographic projection used by the LOLA polar grids, and back.
export const toMap = (lat, lon) => { const rho = 2 * R_MOON_M * Math.tan(((90 + lat) * D2R) / 2); return [rho * Math.sin(lon * D2R), rho * Math.cos(lon * D2R)]; };
export const fromMap = (x, y) => [(2 * Math.atan(Math.hypot(x, y) / (2 * R_MOON_M))) * R2D - 90, Math.atan2(x, y) * R2D];
// Map metres per ground metre at a latitude (1 at the pole, 1.0019 at 85°S).
export const scaleK = (lat) => 1 / Math.cos(((90 + lat) * D2R) / 2) ** 2;
export const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180; // a - b in (-180, 180]

// Full-grid row/col of a map point, and map point of a full-grid cell.
const off = (G) => (G.n - 1) / 2;
export const cellOf = (G, x, y) => [off(G) - y / G.cellM, off(G) + x / G.cellM];
export const xyOf = (G, R, C) => [(C - off(G)) * G.cellM, (off(G) - R) * G.cellM];

// Terrain slope [deg] at full-grid cell (R, C): central differences over the 8 neighbours' axis pairs, in ground metres.
export function slopeAt(G, R, C) {
  const i = R - G.r0, j = C - G.c0, { z, m } = G;
  if (i < 1 || j < 1 || i >= m - 1 || j >= m - 1) return null;
  const [x, y] = xyOf(G, R, C), d = (2 * G.cellM) / scaleK(fromMap(x, y)[0]);
  const gx = ((z[i * m + j + 1] - z[i * m + j - 1]) * 0.5) / d, gy = ((z[(i - 1) * m + j] - z[(i + 1) * m + j]) * 0.5) / d;
  return Math.atan(Math.hypot(gx, gy)) * R2D;
}

// Unit vectors on the map for local east and north at a longitude (north points away from the south pole).
const axes = (lon) => ({ e: [Math.cos(lon * D2R), -Math.sin(lon * D2R)], n: [Math.sin(lon * D2R), Math.cos(lon * D2R)] });

// Cells of G whose centres lie inside an ellipse at the site: `lengthM` along the approach heading (deg clockwise
// from north), `widthM` across it. Returns [{ R, C, lat, lon, slope }] (slope null at the window edge).
export function ellipseCells(G, site, { lengthM, widthM, headingDeg }) {
  const [xs, ys] = toMap(site.lat, site.lon), k = scaleK(site.lat), { e, n } = axes(site.lon);
  const sh = Math.sin(headingDeg * D2R), ch = Math.cos(headingDeg * D2R);
  const h = [sh * e[0] + ch * n[0], sh * e[1] + ch * n[1]], p = [ch * e[0] - sh * n[0], ch * e[1] - sh * n[1]];
  const a = lengthM / 2, b = widthM / 2, reach = (Math.max(a, b) * k) / G.cellM + 1, [Rs, Cs] = cellOf(G, xs, ys), out = [];
  for (let R = Math.floor(Rs - reach); R <= Math.ceil(Rs + reach); R++) {
    for (let C = Math.floor(Cs - reach); C <= Math.ceil(Cs + reach); C++) {
      if (R < G.r0 || C < G.c0 || R >= G.r0 + G.m || C >= G.c0 + G.m) continue;
      const [x, y] = xyOf(G, R, C), dx = (x - xs) / k, dy = (y - ys) / k, u = dx * h[0] + dy * h[1], v = dx * p[0] + dy * p[1];
      if ((u / a) ** 2 + (v / b) ** 2 > 1) continue;
      const [lat, lon] = fromMap(x, y);
      out.push({ R, C, lat, lon, slope: slopeAt(G, R, C) });
    }
  }
  return out;
}

// Does the ellipse (its larger axis, `sizeM`) fit inside the grid window with a cell to spare for slopes?
export function ellipseFits(G, site, sizeM) {
  const [R, C] = cellOf(G, ...toMap(site.lat, site.lon)), reach = (sizeM / 2) * scaleK(site.lat) / G.cellM + 2;
  return R - reach >= G.r0 && C - reach >= G.c0 && R + reach <= G.r0 + G.m - 1 && C + reach <= G.c0 + G.m - 1;
}

export function slopeStats(cells, limitDeg) {
  const s = cells.map((c) => c.slope).filter((v) => v !== null);
  if (!s.length) return null;
  return { n: s.length, steep: s.filter((v) => v > limitDeg).length / s.length, max: Math.max(...s), mean: s.reduce((x, y) => x + y, 0) / s.length };
}

// Share of ellipse cells that see the Sun's upper limb over the terrain at one instant. `sunAt(lat, lon, hM)` gives
// { az, el, radiusDeg } (topocentric); `terrain` is a dem.js stack. Up to `maxCells` cells are traced, evenly spread.
// Returns { lit, n, every, litCells: Set of "R,C", grids }: one terrain ray per traced cell, toward that cell's Sun azimuth.
export function litShare(cells, terrain, sunAt, { eyeM = 2, maxCells = 500, stepM = 40 } = {}) { // 40 m near steps on any grid, as the shipped horizons
  const every = Math.max(1, Math.ceil(cells.length / maxCells)), litCells = new Set(), grids = new Set();
  let n = 0, lit = 0;
  for (let k = 0; k < cells.length; k += every) {
    const c = cells[k], here = terrain.sample(c.lat, c.lon);
    if (!here) continue;
    const s = sunAt(c.lat, c.lon, here.h + eyeM);
    let up = false;
    if (s.el + s.radiusDeg > -10) { // no lunar terrain hides a Sun more than 10° down, nor shows it
      const r = traceRays(terrain, c.lat, c.lon, [s.az], { eyeM, nearStepM: stepM, nearM: 20e3, farStepM: 240, startM: 80 }); // first sample 80 m out, as the shipped horizons
      r.grids.forEach((g) => grids.add(g));
      up = s.el + s.radiusDeg > r.elev[0];
    }
    n++;
    if (up) { lit++; litCells.add(`${c.R},${c.C}`); }
  }
  return { lit: n ? lit / n : null, n, every, litCells, grids: [...grids] };
}

// Approach lighting: Sun elevation and how far the Sun's azimuth is from straight behind the lander (heading + 180°).
// "Behind" = in the rear half (within 90° of straight behind). Window [elMin, elMax] in degrees.
export function approachLight(sun, headingDeg, { elMin, elMax }) {
  const off = angDiff(sun.az, headingDeg + 180);
  const behind = Math.abs(off) < 90, inWindow = sun.el >= elMin && sun.el <= elMax;
  return { el: sun.el, az: sun.az, off, behind, inWindow, ok: behind && inWindow };
}
