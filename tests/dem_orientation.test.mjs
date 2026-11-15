// Real data: the polar stereographic grids must agree with the independent global cylindrical grid.
// The orientation search (8 flips/transposes) gave 63 m RMS for the chosen one and >= 2.4 km for the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raw } from './load_lola.mjs';
import { polarGrid, globalGrid } from '../web/dem.js';

const g16 = globalGrid({ data: raw('ldem_16.img'), ppd: 16, id: 'g16' });
const p240 = polarGrid({ data: raw('ldem_75s_240m.img'), n: 3812, cellM: 240, maxLat: -75, id: 'p240' });
const p40 = polarGrid({ data: raw('ldem_85s_40m.img'), n: 7584, cellM: 40, maxLat: -85, id: 'p40' });

function rms(a, b, lats) {
  let se = 0, k = 0;
  for (const lat of lats) for (let lon = 0; lon < 360; lon += 5) { se += (a.sample(lat, lon) - b.sample(lat, lon)) ** 2; k++; }
  return Math.sqrt(se / k);
}

test('240 m polar grid matches the global grid at 76-84 S', () => {
  assert.ok(rms(p240, g16, [-84, -82, -80, -78, -76]) < 150);
});

test('40 m polar grid matches the 240 m polar grid at 85.5-89 S', () => {
  assert.ok(rms(p40, p240, [-89, -88, -87, -86, -85.5]) < 60);
});

test('polar grids refuse points equatorward of their coverage', () => {
  assert.equal(p40.sample(-84.9, 0), null);
  assert.equal(p240.sample(-74.9, 0), null);
});
