// Sun and Earth seen from a lunar surface site, from hourly JPL Horizons sub-points (MOON_ME frame, DE441).
// Year file rows: [earth_lon, earth_lat, earth_km, sun_lon, sun_lat, sun_km], hourly from Jan 1 00:00 UT
// to the next Jan 1 00:00 UT inclusive.
import { R_MOON_M } from './dem.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, HOUR = 3600e3;
export const FIRST_YEAR = 1969, LAST_YEAR = 2040;
export const RADIUS_KM = { sun: 695700, earth: 6378.137 };

const unit = (lon, lat) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];

export function createEphemeris(loadYear) {
  const years = new Map();
  async function ensure(t0, t1) {
    const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    for (let y = y0; y <= y1; y++) {
      if (y < FIRST_YEAR || y > LAST_YEAR) throw new RangeError(`ephemeris covers ${FIRST_YEAR}-${LAST_YEAR} only`);
      if (!years.has(y)) years.set(y, new Float32Array(await loadYear(y)));
    }
  }
  // Moon-centred vector to the body [km], ME frame. Normalised linear blend of hourly unit vectors.
  function bodyVec(body, t) {
    const y = new Date(t).getUTCFullYear(), rows = years.get(y);
    if (!rows) throw new Error(`year ${y} not loaded`);
    const f = (t - Date.UTC(y, 0, 1)) / HOUR, i = Math.floor(f), w = f - i, o = body === 'sun' ? 3 : 0;
    const a = unit(rows[i * 6 + o], rows[i * 6 + o + 1]), b = unit(rows[(i + 1) * 6 + o], rows[(i + 1) * 6 + o + 1]);
    const v = [0, 1, 2].map((k) => a[k] * (1 - w) + b[k] * w), n = Math.hypot(...v);
    const km = rows[i * 6 + o + 2] * (1 - w) + rows[(i + 1) * 6 + o + 2] * w;
    return v.map((x) => (x / n) * km);
  }
  // Topocentric azimuth (deg, clockwise from north), elevation above the local horizontal plane, distance.
  function topo(site, body, t) {
    const lat = site.lat * D2R, lon = site.lon * D2R, rKm = (R_MOON_M + (site.hM || 0)) / 1000;
    const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    const east = [-Math.sin(lon), Math.cos(lon), 0];
    const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
    const B = bodyVec(body, t), v = [B[0] - up[0] * rKm, B[1] - up[1] * rKm, B[2] - up[2] * rKm];
    const dot = (p) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2], d = Math.hypot(...v);
    const az = (Math.atan2(dot(east), dot(north)) * R2D + 360) % 360;
    return { az, el: Math.asin(Math.max(-1, Math.min(1, dot(up) / d))) * R2D /* rounding can push |sin| past 1 at the zenith */, km: d, radiusDeg: Math.asin(RADIUS_KM[body] / d) * R2D };
  }
  return { ensure, bodyVec, topo };
}
