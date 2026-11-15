// 40 m terrain for the map's close-up view: LOLA LDEM_85S_40M (PDS) cut into 512 x 512 tiles, so the browser
// fetches only the few tiles around the place being looked at (the whole mosaic is 115 MB).
//   web/data/dem/t40/r<i>_c<j>.i16   int16 LE heights (DN, 0.5 m): rows i*512.., cols j*512.. of the 7584 x 7584 grid;
//                                    the last row and column of tiles are narrower (7584 = 14 * 512 + 416)
//   web/data/dem/meta.json           gains "tiles40": { dir, n, cellM, tile, maxLat, source }
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url), N = 7584, T = 512;
const b = readFileSync(new URL('data/raw/lola/ldem_85s_40m.img', root)), z = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
if (z.length !== N * N) throw new Error(`ldem_85s_40m.img has ${z.length} samples, expected ${N * N}`);
for (const v of z) if (v === -32768) throw new Error('no-data value in the 40 m mosaic');
mkdirSync(new URL('web/data/dem/t40/', root), { recursive: true });
let files = 0;
for (let i = 0; i * T < N; i++) for (let j = 0; j * T < N; j++) {
  const h = Math.min(T, N - i * T), w = Math.min(T, N - j * T), out = new Int16Array(h * w);
  for (let r = 0; r < h; r++) out.set(z.subarray((i * T + r) * N + j * T, (i * T + r) * N + j * T + w), r * w);
  writeFileSync(new URL(`web/data/dem/t40/r${i}_c${j}.i16`, root), Buffer.from(out.buffer));
  files++;
}
const metaUrl = new URL('web/data/dem/meta.json', root), meta = JSON.parse(readFileSync(metaUrl));
meta.tiles40 = { dir: 'dem/t40', n: N, cellM: 40, tile: T, maxLat: -85, source: 'LOLA LDEM_85S_40M (PDS)' };
writeFileSync(metaUrl, JSON.stringify(meta, null, 1));
console.log(`${files} tiles written`);
