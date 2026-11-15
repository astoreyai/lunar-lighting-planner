// The Lean proofs about the landing layer's bookkeeping (formal/Layer.lean) still check.
// Skipped where Lean is not installed: the proofs are then simply not re-checked on that machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../formal/', import.meta.url)), have = spawnSync('lean', ['--version'], { cwd: dir }).status === 0;
test('Lean checks every proof in formal/Layer.lean, with no sorry and only the standard axioms', { skip: have ? false : 'lean is not installed' }, () => {
  const src = readFileSync(new URL('../formal/Layer.lean', import.meta.url), 'utf8');
  assert.ok(!/\bsorry\b|\baxiom\b|\badmit\b/.test(src.replace(/\/-[\s\S]*?-\//g, '').replace(/#print axioms.*/g, '')), 'no sorry, admit or axiom in the source');
  const r = spawnSync('lean', ['Layer.lean'], { cwd: dir, encoding: 'utf8' }), out = r.stdout + r.stderr;
  assert.equal(r.status, 0, out);
  assert.ok(!/error|warning|sorryAx/.test(out), out);
  const lines = out.trim().split('\n').filter((l) => l.includes('depends on axioms'));
  assert.equal(lines.length, 10); // the ten headline theorems
  for (const l of lines) assert.match(l, /depends on axioms: \[propext, Quot\.sound\]$/, l);
});
