// Node loader for the packed Horizons year files in web/data/ephem (real data).
import { readFileSync } from 'node:fs';
import { createEphemeris } from '../web/ephem.js';
export const nodeEphemeris = () => createEphemeris(async (y) => {
  const b = readFileSync(new URL(`../web/data/ephem/${y}.bin`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
});
