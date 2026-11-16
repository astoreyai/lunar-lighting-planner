# Plan: from working tool to one NASA planners could rely on

Written 2026-11-14 from the audit at `audit/lunar-navigator/AUDIT.md` (revision `8748ec7`). Task IDs T1–T12 and findings F-1, F-2 are the audit's. Tasks new in this plan are N1–N8.

## What "NASA worthy" means here

The target is a **preliminary screening and teaching tool** whose every number a NASA planner or educator can trace, reproduce and bound. It is not flight or mission-operations software, and the plan does not aim there.

Five tests define the bar. Each phase below closes one or more.

| # | Test | State today (audit) |
|---|---|---|
| B1 | **Correct**: no answer on the page contradicts another | Fails: the verdict names the wrong constraint in 4 of 6 cut-short cases (F-1) |
| B2 | **Honest about limits**: the tool says when it is outside its data or near its error | Fails: silent date clamp (F-2); no "too close to call" state at grazing Sun |
| B3 | **Traceable**: inputs, versions, assumptions and results can be exported and reproduced | Partial: sources cited and checksummed; no export, no assumptions table |
| B4 | **Validated**: independent checks, with stated uncertainty, and tested with real users | Partial: geometry checked against Horizons and PGDA; terrain error unassessed; no users |
| B5 | **Releasable**: licence, data credits, accessibility, a current public build | Partial: no licence; public site 3 commits behind |

**Standards to hold the work against.** NASA-STD-3001 Vol 2 §10 and WCAG 2.2 were fetched for the audit (S13, S14). NASA-STD-7009 (models and simulations credibility) and NPR 7150.2 (software classification) are named here from memory and were not fetched; N1 fetches them and corrects this plan if they say otherwise.

## Phases

Each phase ends at a gate. Nothing in a later phase starts before the gate of the phase it depends on.

### Phase 1: Correct and honest (B1, B2)

| Task | What | Done when |
|---|---|---|
| T1 | Verdict, other-sites list and move-the-lander list name the **first** constraint to close, and the second after it | IM-2 at 2027-03-16 16:00 UT says Earth at about 6 d 19 h, then power at 9 d 14 h. A regression test covers the 4 F-1 cases and case E. |
| T2 | No silent date clamp; `min`/`max` on the date field; the date search says when it reaches the end of the data | A link dated 2041-01-05 shows a message. At 2040-12-20 the page says the data end in 11 days. |
| N2 | README's "checked in this order" text rewritten to match T1 | README and behaviour agree |

**Gate 1:** baseline 26 tests still pass, plus the new ones; `scenarios.mjs` output shows no row where the verdict's reason differs from "closes first".

### Phase 2: Traceable (B3)

Depends on Phase 1, so that exported numbers are the corrected ones.

| Task | What | Done when |
|---|---|---|
| T3 | Assumptions table beside the verdict; CSV export of the window table | CSV for audit scenario A matches `scenarios_output.txt`. The table names eye height, terrain grid at the site, sampling step, visibility rules, DE441 and its span. |
| N3 | Every export and shared link carries the app version and data checksums | Two exports of one scenario from two machines are byte-identical |
| N4 | One documented command rebuilds `web/data/` from `data/raw/` and verifies `CHECKSUMS.md5` | A clean rebuild reproduces the shipped files |

**Gate 2:** a second person can reproduce a verdict from the export alone.

### Phase 3: Validated geometry, with uncertainty (B2, B4)

Independent of Phase 2; can run alongside it.

| Task | What | Done when |
|---|---|---|
| N1 | Fetch NASA-STD-7009 and NPR 7150.2 into `audit/lunar-navigator/sources/`; state the software class and the credibility factors the tool is assessed on | Sources indexed; this plan corrected if needed |
| N5 | Terrain error budget: source LOLA's published vertical and positional error, convert it to a horizon-angle uncertainty per site | README states the uncertainty and its source |
| N6 | "Too close to call" state when the Sun or Earth margin is inside that uncertainty (the audit's grazing case had a +0.18° margin) | Verdicts at grazing moments say so instead of yes/no |
| T8 | Explain or bound the PGDA Earth outlier at 86.5°S 135°E | Cause in the README |
| N7 | Cross-check selected windows against a second tool (Moon Trek lighting) at 3 candidate sites | Differences tabulated in a validation report under `docs/` |

**Gate 3:** `docs/VALIDATION.md` lists every check, its reference, its residual, and what is still unchecked.

### Phase 4: Fit for each audience (B4)

Depends on Phases 1–3.

| Task | Audience | What |
|---|---|---|
| T4 | Planners | Several sites on one time axis, joint Sun+Earth band, first closure named on each row |
| T5 | Public, educators | Guided ridge-versus-crater comparison with one date slider and a live text alternative. Needs a cited crater-floor coordinate, or user-picked points until one is sourced. |
| T6 | Analog crews | Compact field view on the wall clock: first closure, time remaining, and a "stale" cue (NASA-STD-3001 [V2 10020]) |
| N8 | All | WCAG 2.2 AA pass on the new views, keyboard only and with a screen reader |
| T7 | All | Usability tests, current flow against each new view, using the audit's three protocols |

**Gate 4:** T7 results reported per audience (correctness, time, errors). This needs real planners, teachers and analog participants; recruiting them is the owner's step and the longest lead item in the plan.

### Phase 5: Release (B5)

T9 and T10 do not depend on Phases 2–4 and can ship right after Gate 1.

| Task | What | Needs from owner |
|---|---|---|
| T9 | Licence, data credits (USGS CC0, PGDA citation, PDS and Horizons terms read and recorded) | Licence choice. Recommended: Apache-2.0, for its patent grant; MIT is shorter but has none. |
| T10 | Deploy the current build and run the audit's fresh-browser check | A yes to push. Recommended host: stay on GitHub Pages, which already works with no upkeep. GitHub is optional and stewie.space is available for self-hosting; it needs a container, a tunnel hostname and the CSP hash fix (audit §6). |

**Gate 5:** public build matches `main`; README carries licence, credits, validation summary and limits.

### Not planned

- **T11** (future CLPS sites): NASA still publishes regions, not coordinates (checked 2026-11-15). The planned south-pole deliveries are listed with search places instead (D50); sites wait on published coordinates.
- **T12** (watts, link margin): needs array and radio engineering inputs the project does not have. Until then the tool reports sunlight as a power input and Earth visibility as line of sight only.
- **Space Apps submission**: this repository is ineligible (begun before the event; README declares it a non-entry).

## Order of work

1. Phase 1 (T1, T2, N2).
2. T9 and T10, once the owner has chosen a licence and said yes to a push.
3. Phases 2 and 3 side by side.
4. Phase 4 views, then T7 with recruited users.

## Most likely to be wrong

That the terrain error budget (N5) yields a threshold small enough to be useful. If LOLA's error at long range turns out larger than typical grazing margins, many polar verdicts become "too close to call", and Phase 3 would need finer terrain rather than a label.

## Status, 2026-11-15 (app version 45, data `e76ce2301c54`, 55 tests passing)

| Task | State | Evidence or what is missing |
|---|---|---|
| T1 first closure named | done | `tests/first_closure.test.mjs`; seen in the browser |
| T2 date-span honesty | done | seen in the browser with a 2041 link |
| N2 README rule text | done | README "Each landing gets one verdict" |
| T3 assumptions table, CSV | done | `tests/export.test.mjs` |
| N3 version and data stamps | done | same test. Byte-identical across two machines: not run on a second machine |
| N4 one rebuild command | done on one machine | `sh pipeline/rebuild.sh` reproduced 350 files |
| N1 standards fetched | done | NASA-STD-7009B and NPR 7150.2D read; this plan's earlier wording stands, with the class assignment (E) inferred |
| N5 terrain error budget | done as resolution sensitivity | no published accuracy exists for the grids used; the 40 m level is scaled, not measured |
| N6 too close to call | done | 4.5% of 11,680 landings; the risk named above did not materialise |
| T8 PGDA outlier | done | reference-map edge; `audit/lunar-navigator/pgda_outlier_output.txt` |
| N7 Moon Trek cross-check | done for the Sun's direction | `tests/moontrek.test.mjs`: worst 0.0007° over 1,011 samples at 3 candidate sites. Terrain lighting not compared: Moon Trek mails that result to an address |
| T4 sites side by side | done | seen in the browser at desktop and phone width |
| T5 guided comparison | done with a computed low point | a cited crater-floor coordinate is still missing |
| T6 field view | done | `tests/views.test.mjs`; open and stale states exercised in tests, closed state seen live |
| N8 accessibility | inspected | no screen-reader or contrast audit |
| Combined landing layer (added 2026-11-14 at Aaron's request) | done | `tests/suit.test.mjs`; seen in the browser at both zooms and phone width |
| Window-first planner, mission-first order, landing-area finder (added 2026-11-14 at Aaron's request) | done | `tests/windows.test.mjs`, `tests/suit.test.mjs`; seen in the browser at desktop and phone width |
| Faster landing-area layer, window-based site comparison, nearest area, unknown-place notice (2026-11-14) | done | `tests/suit.test.mjs`; seen in the browser at desktop and phone width |
| Whole-pole map on 240 m terrain at 4 hours, window chart for all sites, lighter workers, run-time note (2026-11-14) | done | `tests/suit.test.mjs`; seen in the browser |
| Answer-first Plan tab with sub-tabs, mission clock, from-landing layer, 40 m close-up (2026-11-14, after a navigation review Aaron asked for) | done | `tests/suit.test.mjs`; seen in the browser at desktop and phone width |
| Measured speed, precision and usability; faster march; workers run whole shares; interpolated loss time; Lean proofs (2026-11-14) | done | `docs/VALIDATION.md`, "Measured speed and precision"; `tests/suit.test.mjs`, `tests/formal.test.mjs` |
| South-pole area method for CLPS: delivery table, sunlight and Earth statistics, statistic layers, area ranking, regions comparison (2026-11-15, D50 to D55) | done | `tests/suit.test.mjs`, `tests/layer_shares.test.mjs`; seen in the browser at desktop and phone width |
| Page ordered by the planning questions: CLPS regions first in the scenario, map under the clock on a phone, grouped map menu, nearby searches first (2026-11-15, D56 to D59) | done | seen in the browser at desktop and phone width; no new test, the change is layout only |
| One question-led navigation: seven tabs, each stating its question, what you enter and what you get (2026-11-15, D60 to D63) | done | seen in the browser at desktop and phone width; no new test, the change is navigation and layout |
| Shorter page text in simplified technical English, info bubbles for detail, one-line tabs on a phone (2026-11-15, D66 to D67) | done | seen in the browser at desktop and phone width; words per view on a phone fell 5% to 20% |
| T7 usability tests | blocked | needs recruited planners, educators and analog participants; `docs/USABILITY_TESTS.md` is ready to run |
| T9 licence and credits | done | Apache-2.0, chosen by Aaron on 2026-11-14; `LICENSE` is the text from apache.org |
| T10 deploy | done at version 45 | pushed and redeployed with Aaron's yes each time (versions 33, 36, 37, 38 on 2026-11-14; 42 to 45 on 2026-11-15); the public history was squashed to one commit on 2026-11-14 (D41). Later versions wait for the next yes |
