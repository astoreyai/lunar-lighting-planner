// Guided comparison for Explore: a site and the lowest ground within 10 km of it, on one clock.
// The second point is found in the LOLA 240 m grid, not taken from a catalogue; the panel says so.
import { sample, summary, series } from './windows.js';
import { fromMap, toMap } from './landing.js';
import { gcDist } from './route.js';
import { drawSky } from './sky.js';
import { $, HOUR, T_MAX, eph, data, loadGrid, customSite, compass, fmtUTC, setStatus } from './core.js';

const RADIUS_M = 10e3;

// Lowest cell of a south-polar grid within radiusM of (lat, lon): { lat, lon, h }.
export function lowestNear(G, lat, lon, radiusM = RADIUS_M) {
  const off = (G.n - 1) / 2, [x0, y0] = toMap(lat, lon), r0 = Math.round(off - y0 / G.cellM), c0 = Math.round(off + x0 / G.cellM), k = Math.ceil(radiusM / G.cellM);
  let best = null;
  for (let r = Math.max(0, r0 - k); r <= Math.min(G.n - 1, r0 + k); r++) for (let c = Math.max(0, c0 - k); c <= Math.min(G.n - 1, c0 + k); c++) {
    const z = G.z[r * G.n + c];
    if (best && z >= best.z) continue;
    const [la, lo] = fromMap((c - off) * G.cellM, (off - r) * G.cellM);
    if (gcDist([lat, lon], [la, lo]) <= radiusM) best = { z, lat: la, lon: lo };
  }
  return { lat: best.lat, lon: best.lon, h: best.z * 0.5 };
}

// One sentence per place, and the contrast between them, for sighted and screen-reader users alike.
export function pairText(a, b, pa, pb, distM) {
  const one = (s, p, name = s.short) => {
    const dir = compass(p.sun.az), el = `${Math.abs(p.sun.el).toFixed(1)}° ${p.sun.el >= 0 ? 'above' : 'below'} the level horizon`;
    return p.sunMargin > 0 ? `At ${name} the Sun is ${el} toward the ${dir} and the terrain there rises only to ${p.sunHorizon.toFixed(1)}°, so it is in sunlight.`
      : `At ${name} the Sun is ${el} toward the ${dir}, but the terrain there rises to ${p.sunHorizon.toFixed(1)}°, so it is in shadow.`;
  };
  const drop = Math.round(a.horizon.groundM - b.horizon.groundM);
  const tail = pa.sunMargin > 0 !== pb.sunMargin > 0 ? `Same Sun, same moment, ${(distM / 1000).toFixed(1)} km apart and ${drop} m difference in height: what differs is how high the surrounding ground stands against a Sun that never climbs far above the horizon.`
    : `Right now both are ${pa.sunMargin > 0 ? 'lit' : 'dark'}: move the time to find a moment when only one is.`;
  return `${one(a, pa)} ${one(b, pb, 'the low point')} ${tail}`;
}

export function createPair({ now, start }) {
  const st = { a: null, b: null };
  const dist = () => gcDist([st.a.lat, st.a.lon], [st.b.lat, st.b.lon]);
  const polar = () => [...data.sites.values()].filter((s) => s.lat <= -75);

  function draw() {
    if (!st.b) return;
    const t = now(), pa = sample(eph, st.a, st.a.horizon, t), pb = sample(eph, st.b, st.b.horizon, t);
    const hi = Math.max(15, Math.ceil(Math.max(...st.a.horizon.elev, ...st.b.horizon.elev)) + 2), range = [-5, hi];
    drawSky($('xPairA'), { site: st.a, cur: pa, height: 150, range });
    drawSky($('xPairB'), { site: st.b, cur: pb, height: 150, range });
    $('xPairText').textContent = pairText(st.a, st.b, pa, pb, dist());
  }
  function month() {
    const rows = (s) => summary(series(eph, s, s.horizon, start(), Math.min(start() + 30 * 24 * HOUR, T_MAX), HOUR));
    const A = rows(st.a), B = rows(st.b);
    $('xPairMonth').textContent = `Over the month shown, ${st.a.short} is sunlit ${Math.round(A.sunlit * 100)}% of the time and the low point ${Math.round(B.sunlit * 100)}%.`;
  }
  async function find() {
    const btn = $('xPairGo'); btn.disabled = true;
    try {
      st.a = data.sites.get($('xPairSite').value);
      const G = (await loadGrid('polar240')), low = lowestNear({ n: G.n, cellM: G.cellM, z: G.z }, st.a.lat, st.a.lon);
      st.b = await customSite(low.lat, low.lon, { name: `Lowest ground within 10 km of ${st.a.short}` });
      $('xPairBody').hidden = false;
      $('xPairHeadA').textContent = `${st.a.short} · ground ${Math.round(st.a.horizon.groundM)} m`;
      $('xPairHeadB').textContent = `Lowest ground within 10 km · ${Math.round(st.b.horizon.groundM)} m · ${(dist() / 1000).toFixed(1)} km away`;
      $('xPairNote').textContent = `The low point (${st.b.lat.toFixed(3)}°, ${st.b.lon.toFixed(3)}°E) is the lowest cell of the LOLA 240 m grid within 10 km: a computed point, not a named or proposed landing site.`;
      draw(); month();
    } catch (e) { setStatus(e.message); console.error(e); } finally { btn.disabled = false; }
  }
  return {
    st, draw,
    refresh() { if (st.b) { draw(); month(); } },
    render() { if (!$('xPairSite').options.length) $('xPairSite').innerHTML = polar().map((s) => `<option value="${s.key}">${s.short}</option>`).join(''); draw(); },
    bind() { $('xPairGo').addEventListener('click', find); $('xPairSite').addEventListener('change', () => { st.b = null; $('xPairBody').hidden = true; }); },
  };
}
