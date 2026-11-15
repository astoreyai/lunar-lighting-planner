// Fetch JPL Horizons topocentric apparent az/el (airless) of the Sun (10) and Earth (399) seen from fixed
// test points on the Moon (MEAN_ME), ~every 173 days over 1969-2040. Saves raw text to tests/fixtures/oracle/.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { POINTS, SERIES } from './oracle_points.mjs';
const dir = new URL('./fixtures/oracle/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const { tag, start } of SERIES) for (const [lon, lat] of POINTS) for (const body of ['10', '399']) {
  const file = new URL(`${body}_${lon}_${lat}${tag}.txt`, dir);
  if (existsSync(file)) continue;
  const q = new URLSearchParams({ format: 'text', COMMAND: `'${body}'`, CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${lon},${lat},0'`, EPHEM_TYPE: "'OBSERVER'", START_TIME: `'${start}'`, STOP_TIME: "'2040-12-30 00:00'",
    STEP_SIZE: "'173 d'", QUANTITIES: "'4'", CSV_FORMAT: "'YES'", ANG_FORMAT: "'DEG'", EXTRA_PREC: "'YES'", APPARENT: "'AIRLESS'" });
  const text = await (await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`)).text();
  if (!text.includes('$$SOE')) throw new Error(text.slice(0, 1500));
  writeFileSync(file, text);
  await new Promise((r) => setTimeout(r, 2000));
}
