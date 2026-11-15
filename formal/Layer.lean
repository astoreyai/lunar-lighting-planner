/-!
# The landing layer's bookkeeping, proved

A model of the per-cell logic in `web/suit.js` and of the block skip in `web/shadow.js`, with proofs that Lean
checks (`lean Layer.lean`, core library only; `tests/formal.test.mjs` runs it where Lean is installed).

What this does and does not show. The definitions below restate the JavaScript by hand: `step` is the body of
`createSuit(...).add` for one cell and one terrain variant, `stepS` is the same with `fromStart`, `need` is
`Math.ceil(durMs / stepMs) + 1`, `shareOf` and `merge` are `shareOf` and `putShare`. The theorems hold for these
definitions. Nothing here proves that the JavaScript matches them; the tests in `tests/suit.test.mjs` are what tie
the two together (the synthetic run tests, and the worker layer compared cell for cell with the serial one).
-/

namespace Layer

/-! ## Runs of usable samples -/

/-- The number of usable samples at the front of a list. -/
def lead : List Bool → Nat
  | [] => 0
  | false :: _ => 0
  | true :: t => lead t + 1

/-- The longest run of usable samples: the best, over every starting sample, of the run that starts there. -/
def longest : List Bool → Nat
  | [] => 0
  | b :: t => max (lead (b :: t)) (longest t)

/-- `lead` is what it says: that many samples at the front are usable. -/
theorem lead_take (l : List Bool) : l.take (lead l) = List.replicate (lead l) true := by
  induction l with
  | nil => simp [lead]
  | cons b t ih => cases b <;> simp [lead, List.replicate_succ, ih]

/-- ... and the sample after them, if there is one, is not. -/
theorem lead_stops (l : List Bool) : l[lead l]? ≠ some true := by
  induction l with
  | nil => simp [lead]
  | cons b t ih =>
    cases b with
    | false => simp [lead]
    | true => simpa [lead] using ih

theorem lead_le_longest (l : List Bool) : lead l ≤ longest l := by
  cases l with
  | nil => simp [lead, longest]
  | cons b t => simp only [longest]; omega

/-- No run, wherever it starts, is longer than `longest`. -/
theorem lead_drop_le_longest (l : List Bool) : ∀ i, lead (l.drop i) ≤ longest l := by
  induction l with
  | nil => intro i; simp [lead, longest]
  | cons b t ih =>
    intro i
    cases i with
    | zero => simpa using lead_le_longest (b :: t)
    | succ j => have := ih j; simp only [List.drop_succ_cons, longest]; omega

/-- Some run is exactly that long. -/
theorem longest_attained (l : List Bool) : ∃ i, lead (l.drop i) = longest l := by
  induction l with
  | nil => exact ⟨0, rfl⟩
  | cons b t ih =>
    obtain ⟨j, hj⟩ := ih
    by_cases h : longest t ≤ lead (b :: t)
    · exact ⟨0, by simp only [List.drop_zero, longest]; omega⟩
    · exact ⟨j + 1, by simp only [List.drop_succ_cons, longest, hj]; omega⟩

/-- `add` for one cell and one terrain variant: `(cur, best)` are the run in progress and the longest so far. -/
def step (s : Nat × Nat) (b : Bool) : Nat × Nat :=
  if b then (s.1 + 1, max s.2 (s.1 + 1)) else (0, s.2)

/-- Samples added in time order. -/
def run : Nat × Nat → List Bool → Nat × Nat
  | s, [] => s
  | s, b :: t => run (step s b) t

theorem run_true (c b : Nat) (t : List Bool) : run (c, b) (true :: t) = run (c + 1, max b (c + 1)) t := by
  simp [run, step]

theorem run_false (c b : Nat) (t : List Bool) : run (c, b) (false :: t) = run (0, b) t := by
  simp [run, step]

theorem run_best (l : List Bool) :
    ∀ c b, c ≤ b → (run (c, b) l).2 = max (max b (c + lead l)) (longest l) := by
  induction l with
  | nil => intro c b h; simp only [run, lead, longest]; omega
  | cons x t ih =>
    intro c b h
    cases x with
    | true =>
      rw [run_true, ih (c + 1) (max b (c + 1)) (by omega)]
      simp only [lead, longest]
      omega
    | false =>
      have := lead_le_longest t
      rw [run_false, ih 0 b (by omega)]
      simp only [lead, longest]
      omega

/-- **The layer keeps the longest run.** Starting from nothing, `best` ends as the longest run of usable samples. -/
theorem run_longest (l : List Bool) : (run (0, 0) l).2 = longest l := by
  have := run_best l 0 0 (Nat.le_refl 0)
  have := lead_le_longest l
  omega

/-! ## From a landing: only the run that starts at the first sample -/

/-- `add` with `fromStart`: at sample `k` the run grows only if it is unbroken since sample 0, that is `cur = k`. -/
def stepS (k c : Nat) (b : Bool) : Nat := if b = true ∧ c = k then c + 1 else c

def runS : Nat → Nat → List Bool → Nat
  | _, c, [] => c
  | k, c, b :: t => runS (k + 1) (stepS k c b) t

/-- A cell that has lost the Sun or Earth is settled: no later sample changes it. -/
theorem runS_settled (l : List Bool) : ∀ k c, c < k → runS k c l = c := by
  induction l with
  | nil => intro k c _; rfl
  | cons b t ih =>
    intro k c h
    have hs : stepS k c b = c := by simp only [stepS]; split <;> omega
    simp only [runS, hs]
    exact ih (k + 1) c (by omega)

/-- **Skipping settled cells is sound.** Whatever is fed to a settled cell, the result is the same. This is why
the workers stop marching a cell once its run from the landing has ended (`alive` in `buildSuit`). -/
theorem runS_ignores_rest (l l' : List Bool) (k c : Nat) (h : c < k) : runS k c l = runS k c l' := by
  rw [runS_settled l k c h, runS_settled l' k c h]

theorem runS_alive (l : List Bool) : ∀ k, runS k k l = k + lead l := by
  induction l with
  | nil => intro k; simp [runS, lead]
  | cons b t ih =>
    intro k
    cases b with
    | true =>
      have hs : stepS k k true = k + 1 := by simp [stepS]
      simp only [runS, hs, lead, ih (k + 1)]; omega
    | false =>
      have hs : stepS k k false = k := by simp [stepS]
      simp only [runS, hs, lead]
      exact runS_settled t (k + 1) k (by omega)

/-- **From a landing, the layer keeps the run that starts at the landing.** -/
theorem runS_lead (l : List Bool) : runS 0 0 l = lead l := by
  simpa using runS_alive l 0

/-! ## Does a run hold the mission? -/

/-- `need = Math.ceil(durMs / stepMs) + 1`: the samples a mission spans. -/
def need (dur stp : Nat) : Nat := (dur + stp - 1) / stp + 1

/-- From its first sample to its last, a run of `need` samples covers the whole mission. -/
theorem need_spans (dur stp : Nat) (h : 0 < stp) : dur ≤ (need dur stp - 1) * stp := by
  have h1 := Nat.div_add_mod (dur + stp - 1) stp
  have h2 := Nat.mod_lt (dur + stp - 1) h
  have h3 : (dur + stp - 1) / stp * stp = stp * ((dur + stp - 1) / stp) := Nat.mul_comm _ _
  simp only [need, Nat.add_sub_cancel]
  omega

/-- One sample fewer would not: `need` is the least count that does. -/
theorem need_tight (dur stp : Nat) (h : 0 < stp) (hd : 0 < dur) : (need dur stp - 2) * stp < dur := by
  have h1 := Nat.div_add_mod (dur + stp - 1) stp
  have h2 := Nat.mod_lt (dur + stp - 1) h
  have h3 : (dur + stp - 1) / stp * stp = stp * ((dur + stp - 1) / stp) := Nat.mul_comm _ _
  have h4 : ((dur + stp - 1) / stp - 1) * stp = (dur + stp - 1) / stp * stp - stp := by
    rw [Nat.sub_mul, Nat.one_mul]
  have h5 : need dur stp - 2 = (dur + stp - 1) / stp - 1 := by simp only [need]; omega
  rw [h5, h4]
  omega

/-- **A cell classed as holding the mission really covers it**: a run of at least `need` samples spans at least
the mission's length. -/
theorem holds_covers (dur stp n : Nat) (h : 0 < stp) (hn : need dur stp ≤ n) : dur ≤ (n - 1) * stp :=
  Nat.le_trans (need_spans dur stp h) (Nat.mul_le_mul_right stp (by omega))

/-! ## Sharing the cells between workers -/

variable {α β : Type}

/-- `shareOf`: worker `w` of `W` takes every `W`-th cell from `w` on, so its `j`-th cell is cell `w + j * W`. -/
def shareOf (f : Nat → α) (w W : Nat) : Nat → α := fun j => f (w + j * W)

/-- `putShare` for every worker: cell `i` comes back from worker `i % W`, at position `i / W`. -/
def merge (parts : Nat → Nat → α) (W : Nat) : Nat → α := fun i => parts (i % W) (i / W)

/-- Sharing and merging puts every cell back where it was. -/
theorem merge_shareOf (f : Nat → α) (W : Nat) : merge (fun w => shareOf f w W) W = f := by
  funext i
  have := Nat.mod_add_div i W
  have h : i % W + i / W * W = i := by rw [Nat.mul_comm]; exact this
  simp only [merge, shareOf, h]

/-- No cell goes to two workers, or twice to one. -/
theorem share_unique {W w₁ w₂ j₁ j₂ : Nat} (h₁ : w₁ < W) (h₂ : w₂ < W)
    (h : w₁ + j₁ * W = w₂ + j₂ * W) : w₁ = w₂ ∧ j₁ = j₂ := by
  have hw : w₁ = w₂ := by
    have e₁ : (w₁ + j₁ * W) % W = w₁ := by rw [Nat.add_mul_mod_self_right, Nat.mod_eq_of_lt h₁]
    have e₂ : (w₂ + j₂ * W) % W = w₂ := by rw [Nat.add_mul_mod_self_right, Nat.mod_eq_of_lt h₂]
    rw [h] at e₁; omega
  refine ⟨hw, ?_⟩
  subst hw
  exact Nat.eq_of_mul_eq_mul_right (by omega : 0 < W) (by omega)

/-- A worker's share has `ceil((N - w) / W)` cells, the length `shareOf` allocates. -/
theorem share_size (N W w j : Nat) (hW : 0 < W) : w + j * W < N ↔ j < (N - w + W - 1) / W := by
  have h : j + 1 ≤ (N - w + W - 1) / W ↔ (j + 1) * W ≤ N - w + W - 1 := Nat.le_div_iff_mul_le hW
  have e : (j + 1) * W = j * W + W := by rw [Nat.add_mul, Nat.one_mul]
  constructor
  · intro hlt; exact h.mpr (by omega)
  · intro hlt; have := h.mp hlt; omega

/-- The layer: each cell's result depends on that cell's own samples and nothing else. -/
def layer (g : List Bool → β) (samples : Nat → List Bool) : Nat → β := fun i => g (samples i)

/-- **The workers' layer is the serial layer.** Each worker runs every time step for its own share and the page
merges the results; because a cell's result depends only on its own samples, that is the layer computed in one piece. -/
theorem shared_eq_serial (g : List Bool → β) (samples : Nat → List Bool) (W : Nat) :
    merge (fun w => layer g (shareOf samples w W)) W = layer g samples :=
  merge_shareOf (layer g samples) W

/-! ## The block skip in the shadow march -/

/-- **Jumping over a block is sound.** Heights are relative to the cell, `top` is the highest terrain in a block,
`s` the distance at which the ray enters it and `s'` any distance further along. Terrain of height `h ≤ top` at
`s'` subtends no more than `max top 0` does at `s`: `h / s' ≤ max top 0 / s`, written without division. With the
curvature term, which only grows with distance, this is the test `(top > 0 ? top / s : 0) - s * curv < tanSun`
in `march`: if it holds, nothing in the block reaches the ray. -/
theorem jump_sound (h top s s' : Int) (hs : 0 < s) (hss : s ≤ s') (hh : h ≤ top) :
    h * s ≤ max top 0 * s' := by
  have h0 : (0 : Int) ≤ max top 0 := by omega
  have h1 : h ≤ max top 0 := by omega
  exact Int.le_trans (Int.mul_le_mul_of_nonneg_right h1 (by omega)) (Int.mul_le_mul_of_nonneg_left hss h0)

/-- **A bilinear sample never exceeds the block's highest point.** With weights `a / n` and `b / n` across a cell
whose four corners are at most `M`, the sample (scaled by `n * n`) is at most `M`. The pyramid stores each block's
maximum with one cell of overlap, so every sample inside a block has its four corners in that block. -/
theorem bilinear_le (z00 z01 z10 z11 M a b n : Int) (ha : 0 ≤ a) (han : a ≤ n) (hb : 0 ≤ b) (hbn : b ≤ n)
    (h00 : z00 ≤ M) (h01 : z01 ≤ M) (h10 : z10 ≤ M) (h11 : z11 ≤ M) :
    (z00 * (n - a) + z01 * a) * (n - b) + (z10 * (n - a) + z11 * a) * b ≤ M * (n * n) := by
  have r0 : z00 * (n - a) + z01 * a ≤ M * n := by
    have p := Int.mul_le_mul_of_nonneg_right h00 (by omega : 0 ≤ n - a)
    have q := Int.mul_le_mul_of_nonneg_right h01 ha
    have e : M * (n - a) + M * a = M * n := by rw [← Int.mul_add]; congr 1; omega
    omega
  have r1 : z10 * (n - a) + z11 * a ≤ M * n := by
    have p := Int.mul_le_mul_of_nonneg_right h10 (by omega : 0 ≤ n - a)
    have q := Int.mul_le_mul_of_nonneg_right h11 ha
    have e : M * (n - a) + M * a = M * n := by rw [← Int.mul_add]; congr 1; omega
    omega
  have p := Int.mul_le_mul_of_nonneg_right r0 (by omega : 0 ≤ n - b)
  have q := Int.mul_le_mul_of_nonneg_right r1 hb
  have e : M * n * (n - b) + M * n * b = M * (n * n) := by
    rw [← Int.mul_add, Int.mul_assoc]; congr 2; omega
  omega

end Layer

#print axioms Layer.run_longest
#print axioms Layer.runS_lead
#print axioms Layer.runS_ignores_rest
#print axioms Layer.holds_covers
#print axioms Layer.need_tight
#print axioms Layer.shared_eq_serial
#print axioms Layer.share_unique
#print axioms Layer.share_size
#print axioms Layer.jump_sound
#print axioms Layer.bilinear_le
