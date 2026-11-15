// Node loader for the raw LOLA PDS images in data/raw/lola (real data).
import { readFileSync } from 'node:fs';
const root = new URL('../data/raw/lola/', import.meta.url);
export const raw = (name) => { const b = readFileSync(new URL(name, root)); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
