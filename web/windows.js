// Sun and Earth visibility over a time span at one site: sampled margins above the terrain horizon,
// rise/set events (linear interpolation between samples) and summary statistics.
import { horizonAt, uncAt } from './horizon.js';

// Fraction of a disk above a horizontal line: d = (centre elevation - horizon) / angular radius.
export function diskFraction(d) {
  if (d >= 1) return 1;
  if (d <= -1) return 0;
  return 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
}

// Sun counts as up while any part of its disk clears the terrain (upper limb); Earth while its centre does.
export function sample(eph, site, horizon, t) {
  const s = eph.topo(site, 'sun', t), e = eph.topo(site, 'earth', t);
  const hs = horizonAt(horizon, s.az), he = horizonAt(horizon, e.az);
  return {
    t, sun: s, earth: e, sunHorizon: hs, earthHorizon: he,
    sunMargin: s.el + s.radiusDeg - hs,
    sunFraction: diskFraction((s.el - hs) / s.radiusDeg),
    earthMargin: e.el - he,
    sunU: uncAt(horizon, s.az), earthU: uncAt(horizon, e.az), // terrain uncertainty toward each body, degrees
  };
}

export function series(eph, site, horizon, t0, t1, stepMs = 15 * 60e3) {
  const out = [];
  for (let t = t0; t <= t1; t += stepMs) out.push(sample(eph, site, horizon, t));
  return out;
}

// Times where `key` changes sign, linearly interpolated: [{t, rising}].
export function events(rows, key) {
  const ev = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1][key], b = rows[i][key];
    if ((a > 0) !== (b > 0)) ev.push({ t: rows[i - 1].t + (rows[i].t - rows[i - 1].t) * (a / (a - b)), rising: b > 0 });
  }
  return ev;
}

// Longest run of samples with `key` <= 0, in ms (bounded by the span).
function longestOff(rows, key) {
  let best = 0, start = null;
  for (const r of rows) {
    if (r[key] <= 0) { if (start === null) start = r.t; best = Math.max(best, r.t - start); } else start = null;
  }
  return best;
}

// Verdict for a landing at rows[i] lasting `n` samples. req = { minShare (0 = any part of the Sun), earth }.
// 'full' | 'short' | 'none', or null past the data. A short mission names the constraint that closes
// first (power on a tie); `then` carries the other one if it also closes before the mission ends.
// k raises (+1) or lowers (-1) the terrain by its uncertainty in each row; 0 is the terrain as mapped.
export function landingVerdict(rows, i, n, req, k = 0) {
  if (i + n >= rows.length) return null;
  const frac = (r) => (k && r.sunU ? diskFraction((r.sun.el - r.sunHorizon - k * r.sunU) / r.sun.radiusDeg) : r.sunFraction);
  const sunM = (r) => r.sunMargin - k * (r.sunU || 0), earthM = (r) => r.earthMargin - k * (r.earthU || 0);
  const power = (r) => sunM(r) > 0 && frac(r) >= req.minShare, earth = (r) => earthM(r) > 0;
  if (!power(rows[i])) return { verdict: 'none', reason: req.minShare > 0 ? `less than ${Math.round(req.minShare * 100)}% of the Sun visible at landing` : 'Sun below the terrain at landing' };
  if (req.earth && !earth(rows[i])) return { verdict: 'none', reason: 'Earth hidden at landing' };
  // The loss time is interpolated to where the margin crosses zero between the last good sample and the first bad one
  // (hourly samples alone ran a mean of 32 min late; interpolated, the median error is under a minute: tests/precision_sweep.mjs).
  // A share-of-disk limit can fail with the margin still positive: then the sample time stands.
  const t0 = rows[i].t, lost = (ok, m) => {
    for (let j = i + 1; j <= i + n; j++) if (!ok(rows[j])) { const a = m(rows[j - 1]), b = m(rows[j]); return rows[j - 1].t + (rows[j].t - rows[j - 1].t) * (b <= 0 ? a / (a - b) : 1) - t0; }
    return null;
  };
  const p = lost(power, sunM), e = req.earth ? lost(earth, earthM) : null;
  if (p === null && e === null) return { verdict: 'full' };
  const P = { reason: 'power', lostMs: p }, E = { reason: 'earth', lostMs: e };
  const [first, second] = e === null ? [P] : p === null ? [E] : p <= e ? [P, E] : [E, P];
  return { verdict: 'short', ...first, ...(second ? { then: second } : {}) };
}

// The verdict on the terrain as mapped, plus what the terrain's uncertainty does to it:
//   close: { worse, better }  full / cut short / can't start changes with the terrain higher or lower: too close to call
//   range: [ms, ms]           same verdict, but the loss time moves by this much
export function landingCall(rows, i, n, req) {
  const v = landingVerdict(rows, i, n, req);
  if (!v) return null;
  const worse = landingVerdict(rows, i, n, req, 1), better = landingVerdict(rows, i, n, req, -1);
  if (worse.verdict !== v.verdict || better.verdict !== v.verdict) v.close = { worse, better };
  else if (v.verdict === 'short' && worse.lostMs !== better.lostMs) v.range = [worse.lostMs, better.lostMs];
  return v;
}

// From rows[0] onward: how long power and Earth contact last. Times are ms after rows[0].t, interpolated between
// samples where a margin crosses zero; 0 = already lost at the start, null = holds to the end of `rows`.
// `first`/`endMs` name the constraint that closes the usable window first (Earth counts only if req.earth).
// k raises (+1) or lowers (-1) the terrain by its uncertainty, as in landingVerdict.
export function closures(rows, req, k = 0) {
  const sunM = (r) => r.sunMargin - k * (r.sunU || 0), earthM = (r) => r.earthMargin - k * (r.earthU || 0);
  const frac = (r) => (k && r.sunU ? diskFraction((r.sun.el - r.sunHorizon - k * r.sunU) / r.sun.radiusDeg) : r.sunFraction);
  const power = (r) => sunM(r) > 0 && frac(r) >= req.minShare;
  const until = (ok, m) => {
    if (!ok(rows[0])) return 0;
    for (let i = 1; i < rows.length; i++) if (!ok(rows[i])) {
      const a = m(rows[i - 1]), b = m(rows[i]); // a share-of-disk limit can fail with the margin still positive: then use the sample time
      return rows[i - 1].t + (rows[i].t - rows[i - 1].t) * (b <= 0 ? a / (a - b) : 1) - rows[0].t;
    }
    return null;
  };
  const sunMs = until(power, sunM), earthMs = until((r) => earthM(r) > 0, earthM);
  const c = [['power', sunMs], ...(req.earth ? [['earth', earthMs]] : [])].filter((x) => x[1] !== null).sort((x, y) => x[1] - y[1]);
  return { sunMs, earthMs, first: c[0]?.[0] ?? null, endMs: c[0]?.[1] ?? null };
}

// Usable windows in `rows`: stretches where power holds (and Earth is in view, if req.earth). Each is
// { open, close, openedBy, closedBy, i0, i1 }: times in ms, interpolated where a margin crosses zero between samples;
// openedBy/closedBy name the constraint that was last to arrive / first to go ('power' | 'earth').
// A window already open at rows[0] has openedBy null; one still open at the last row has close and closedBy null.
export function usableWindows(rows, req) {
  const power = (r) => r.sunMargin > 0 && r.sunFraction >= req.minShare, earth = (r) => !req.earth || r.earthMargin > 0;
  const ok = (r) => power(r) && earth(r), out = [];
  // Where a constraint flips between samples a and b; a share-of-disk limit has no zero crossing, so it takes the sample time.
  const cross = (a, b, key) => (a[key] > 0 !== b[key] > 0 ? a.t + (b.t - a.t) * (a[key] / (a[key] - b[key])) : null);
  let w = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], p = rows[i - 1];
    if (ok(r) && !w) {
      w = { open: r.t, close: null, openedBy: null, closedBy: null, i0: i, i1: i };
      if (p) { // the constraint that arrived last opened the window
        const c = [['power', power(p) ? null : cross(p, r, 'sunMargin') ?? r.t], ['earth', earth(p) ? null : cross(p, r, 'earthMargin') ?? r.t]].filter((x) => x[1] !== null).sort((x, y) => y[1] - x[1])[0];
        w.open = c[1]; w.openedBy = c[0];
      }
    } else if (!ok(r) && w) { // the constraint that went first closed it
      const c = [['power', power(r) ? null : cross(p, r, 'sunMargin') ?? r.t], ['earth', earth(r) ? null : cross(p, r, 'earthMargin') ?? r.t]].filter((x) => x[1] !== null).sort((x, y) => x[1] - y[1])[0];
      w.close = c[1]; w.closedBy = c[0]; w.i1 = i - 1; out.push(w); w = null;
    }
  }
  if (w) { w.i1 = rows.length - 1; out.push(w); }
  return out;
}

export function summary(rows) {
  const n = rows.length, frac = (f) => rows.filter(f).length / n;
  return {
    sunlit: frac((r) => r.sunMargin > 0),
    earthVisible: frac((r) => r.earthMargin > 0),
    both: frac((r) => r.sunMargin > 0 && r.earthMargin > 0),
    meanSunFraction: rows.reduce((a, r) => a + r.sunFraction, 0) / n,
    longestDarkMs: longestOff(rows, 'sunMargin'),
    longestNoEarthMs: longestOff(rows, 'earthMargin'),
  };
}
