// LOLA terrain grids (PDS LDEM, int16 heights * 0.5 m above the 1737.4 km sphere) and a priority stack.
// Polar grids: spherical polar stereographic about the south pole; global grid: simple cylindrical.

export const R_MOON_M = 1737400;
const D2R = Math.PI / 180;

// Bilinear sample of an int16 grid at fractional (row, col); null outside the grid.
function bilinear(data, rows, cols, r, c, scale) {
  if (!(r >= 0 && c >= 0 && r <= rows - 1 && c <= cols - 1)) return null;
  const r0 = Math.min(Math.floor(r), rows - 2), c0 = Math.min(Math.floor(c), cols - 2);
  const fr = r - r0, fc = c - c0, i = r0 * cols + c0;
  const top = data[i] * (1 - fc) + data[i + 1] * fc;
  const bot = data[i + cols] * (1 - fc) + data[i + cols + 1] * fc;
  return (top * (1 - fr) + bot * fr) * scale;
}

// South polar stereographic grid. `orient` = [sx, sy] maps projected (x, y) to (col, row) directions;
// fixed by tests/dem_orientation.test.mjs against the independent global grid.
// A window of a larger grid (an m x m crop starting at row r0, col c0 of the full n x n grid) samples the same way.
export function polarGrid({ data, n, cellM, maxLat, id, r0 = 0, c0 = 0, m = n }) {
  const off = (n - 1) / 2; // label LINE/SAMPLE_PROJECTION_OFFSET in 0-based pixels
  return {
    id, cellM, n, r0, c0, m, z: data,
    sample(latDeg, lonDeg) {
      if (latDeg > maxLat) return null;
      const rho = 2 * R_MOON_M * Math.tan((90 + latDeg) * D2R / 2);
      const x = rho * Math.sin(lonDeg * D2R), y = rho * Math.cos(lonDeg * D2R);
      return bilinear(data, m, m, off - y / cellM - r0, off + x / cellM - c0, 0.5);
    },
  };
}

// Simple cylindrical global grid, `ppd` pixels per degree, longitudes 0..360 east, row 0 at +90.
export function globalGrid({ data, ppd, id }) {
  const rows = 180 * ppd, cols = 360 * ppd;
  return {
    id, cellM: (R_MOON_M * D2R) / ppd,
    sample(latDeg, lonDeg) {
      const r = (90 - latDeg) * ppd - 0.5;
      let c = (((lonDeg % 360) + 360) % 360) * ppd - 0.5;
      if (c < 0) c += cols;
      const rr = Math.min(Math.max(r, 0), rows - 1);
      if (c > cols - 1) { // between the last column and the first: blend across the 0° seam
        const w = c - (cols - 1);
        return bilinear(data, rows, cols, rr, cols - 1, 0.5) * (1 - w) + bilinear(data, rows, cols, rr, 0, 0.5) * w;
      }
      return bilinear(data, rows, cols, rr, c, 0.5);
    },
  };
}

// First grid that covers the point answers.
export function stack(grids) {
  return {
    grids,
    sample(lat, lon) {
      for (const g of grids) {
        const h = g.sample(lat, lon);
        if (h !== null) return { h, grid: g };
      }
      return null;
    },
  };
}

// An m x m window (rows r0.., cols c0..) of a polar grid stored as square tiles (web/data/dem/t40), in the form
// shadow.js and suit.js take for a window. tiles: { n, cellM, tile }; getTile(name) resolves to that tile's Int16Array.
// The window must lie inside the grid.
export async function tileWindow(tiles, r0, c0, m, getTile) {
  const { n, cellM, tile: T } = tiles, z = new Int16Array(m * m), jobs = [];
  for (let i = Math.floor(r0 / T); i * T < r0 + m; i++) for (let j = Math.floor(c0 / T); j * T < c0 + m; j++) jobs.push(Promise.resolve(getTile(`r${i}_c${j}`)).then((t) => {
    const w = Math.min(T, n - j * T), ra = Math.max(r0, i * T), rb = Math.min(r0 + m, (i + 1) * T), ca = Math.max(c0, j * T), cb = Math.min(c0 + m, j * T + w);
    for (let r = ra; r < rb; r++) z.set(t.subarray((r - i * T) * w + ca - j * T, (r - i * T) * w + cb - j * T), (r - r0) * m + ca - c0);
  }));
  await Promise.all(jobs);
  return { z, n: m, cellM, r0, c0, full: n };
}
