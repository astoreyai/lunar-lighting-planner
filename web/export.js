// What an answer rests on, as rows for the page and as comment lines in the CSV export; and the export itself.
// Nothing here reads the clock or the page address, so the same scenario gives the same bytes on any machine.

const f = (x, n) => x.toFixed(n);
const iso = (t) => new Date(t).toISOString().slice(0, 16) + 'Z';

// [label, value] pairs. `s` = { site, durD, minShare, earth, version, dataId, levels } (levels: metres per grid cell size).
export function assumptions(s) {
  const h = s.site.horizon, unc = h.unc ? [...h.unc].sort((a, b) => a - b) : null;
  const lv = Object.entries(s.levels || {}).sort((a, b) => a[0] - b[0]).map(([c, m]) => `${m} m on the ${c < 1000 ? `${c} m` : `${f(c / 1000, 1)} km`} grid`).join(', ');
  return [
    ['Site', `${s.site.name}: ${f(s.site.lat, 4)}°, ${f(s.site.lon, 4)}°E, ground ${f(h.groundM, 0)} m above the 1737.4 km sphere`],
    ['Observer', `${h.eyeM ?? 2} m above the ground`],
    ['Terrain', `${(s.site.horizon_grids || h.grids).join(' + ')}; horizon traced along ${h.nAz} azimuths out to 300 km`],
    ['Terrain uncertainty', unc ? `median ${f(unc[unc.length >> 1], 3)}°, largest ${f(unc[unc.length - 1], 3)}° around the horizon: a height error (${lv}) seen at the range of the blocking terrain. An answer that changes inside this is marked too close to call` : 'not available for this horizon'],
    ['Sun', `up while its upper limb clears the terrain; power needs ${s.minShare > 0 ? `at least ${Math.round(s.minShare * 100)}% of the disk` : 'any part of the disk'}. Sunlight is a power input: no array, pointing or dust model, so no watts`],
    ['Earth', `visible while its centre clears the terrain; ${s.earth ? 'required' : 'not required'}. Line of sight only: no antenna, ground station or relay model`],
    ['Atmosphere', 'none: no refraction'],
    ['Ephemeris', 'JPL Horizons, DE441, Moon mean-Earth frame, hourly values interpolated; times are UT; 1969-01-01 to 2040-12-31'],
    ['Sampling', 'verdicts from hourly samples; rise and set times from 10-minute samples, interpolated (good to a few minutes)'],
    ['Version', `app ${s.version}, data ${s.dataId}`],
  ];
}

const COLS = ['time_utc', 'hours_after_landing', 'sun_elevation_deg', 'sun_azimuth_deg', 'sun_radius_deg', 'terrain_toward_sun_deg', 'sun_upper_limb_margin_deg', 'sun_disk_visible_fraction', 'sun_terrain_uncertainty_deg', 'earth_elevation_deg', 'earth_azimuth_deg', 'terrain_toward_earth_deg', 'earth_margin_deg', 'earth_terrain_uncertainty_deg', 'power_ok', 'earth_in_view'];

// `rows`: windows.js samples from landing to the end of the mission. `verdict`: the sentence shown on the page.
// `scenario`: the link fragment that reopens this scenario.
export function missionCsv(s) {
  const head = [
    'Lunar Lighting Planner: Sun and Earth over the terrain horizon, one row per sample',
    `landing ${iso(s.land)}, mission ${s.durD} days`,
    `verdict: ${s.verdict}`,
    ...assumptions(s).map(([k, v]) => `${k}: ${v}`),
    `scenario: #${s.scenario}`,
  ].map((l) => `# ${l.replace(/\s+/g, ' ')}`);
  const body = s.rows.map((r) => [
    iso(r.t), f((r.t - s.land) / 3600e3, 2), f(r.sun.el, 4), f(r.sun.az, 4), f(r.sun.radiusDeg, 4), f(r.sunHorizon, 4), f(r.sunMargin, 4), f(r.sunFraction, 4), f(r.sunU, 4),
    f(r.earth.el, 4), f(r.earth.az, 4), f(r.earthHorizon, 4), f(r.earthMargin, 4), f(r.earthU, 4),
    r.sunMargin > 0 && r.sunFraction >= s.minShare ? 1 : 0, r.earthMargin > 0 ? 1 : 0,
  ].join(','));
  return [...head, COLS.join(','), ...body].join('\n') + '\n';
}
