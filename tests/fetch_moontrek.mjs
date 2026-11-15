// Fetch NASA Moon Trek's Sun azimuth and elevation (its "Sun Angle" tool's service, no terrain) at three candidate
// landing sites, hourly for 14 days. Saves the raw XML to tests/fixtures/moontrek/. The URL shape is the one the
// Moon Trek page itself builds (jpl/dijit/SunAngleTool); only site coordinates and dates are sent.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
export const MT_SITES = ['a3_n2', 'a3_mp', 'ce7_shackleton_l'], MT_START = '2027-11-05T00:00:00', MT_END = '2027-11-19T00:00:00';
const dir = new URL('./fixtures/moontrek/', import.meta.url);
if (process.argv[1] === new URL(import.meta.url).pathname) {
  mkdirSync(dir, { recursive: true });
  const sites = JSON.parse(readFileSync(new URL('../web/data/sites.json', import.meta.url))).sites;
  for (const id of MT_SITES) {
    const file = new URL(`${id}.xml`, dir), s = sites.find((x) => x.id === id), at = `${s.lat_deg},${s.lon_deg}`;
    if (existsSync(file)) continue;
    const res = await fetch(`https://trek.nasa.gov/getAzElfromT1/LTD002=Moon,${at},0,${at},1,1/Sun/${MT_START}/${MT_END}/3600`), text = await res.text();
    if (!res.ok || !text.includes('<sample>')) throw new Error(`${id}: ${res.status} ${text.slice(0, 300)}`);
    writeFileSync(file, text);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
