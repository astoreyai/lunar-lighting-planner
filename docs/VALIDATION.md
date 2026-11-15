# Validation

What has been checked, against what, with what result, and what has not. Written 2026-11-14 at app version 38, data fingerprint `31d05df6b9be`. Every check runs on real data unless marked synthetic. Run them with `node --test tests/*.test.mjs` (50 tests, all passing on that date).

## What the tool claims

Whether the Sun (upper limb) and Earth (centre) clear the LOLA terrain horizon at a lunar site, 2 m above the ground, at any time from 1969 to 2040, and what follows for a mission of a given length. It reports sunlight as a power input and Earth as line of sight. It claims no watts, no link margin and no hazard assessment below the terrain grid's cell size.

## Standards it is held against

| Standard | What it asks | Where this project stands |
|---|---|---|
| NASA-STD-7009B, Models and Simulations (2024) | Mandatory only for models supporting critical decisions; sets no pass marks. Asks that credibility be assessed and reported on named factors. | Outside the mandatory scope (inferred: the tool supports no NASA decision). The factors are used below as the checklist. |
| NPR 7150.2D, Software Engineering Requirements | Classes A–F; binds NASA projects, not the public. | Not bound. By its definitions the closest fit is Class E, "explore a design concept or hypothesis" (inferred). Use in real mission planning would make it Class D and bring that class's requirements. |
| NASA-STD-3001 Vol 2 §10 | [V2 10020] mark stale, missing or unknown data; [V2 10113] no mental computation for critical data. | Field view marks stale readings; the verdict names the first closure, so the reader no longer compares two panels. Not tested with crews. |
| WCAG 2.2 | 1.1.1, 1.4.1, 2.5.7, 2.5.8, 4.1.3 among others | Inspected, not audited by a specialist or with a screen reader: see "Accessibility". |

## Credibility factors (NASA-STD-7009B, Appendix E)

| Factor | Evidence | Gap |
|---|---|---|
| Data pedigree | Horizons DE441 responses cached raw; LOLA files md5-checked against `data/CHECKSUMS.md5`; 32 sites each cited in `pipeline/sites.json`; `web/data/manifest.json` fingerprints every shipped file; `pipeline/rebuild.sh` reproduced all 349 files byte for byte. | Rebuild run on one machine only. No dataset DOI confirmed for the LDEM products. |
| Verification | Calendar vs detail view (82 landings, worst 60 min, the sampling step); lit map vs tracer (99.8% and 100%); globe vs tracer (99.91%); live two-ray readout vs full horizon (0.001°); ellipse light ray vs shipped horizons (worst 0.216°, 148/148); first closure vs an independent search (37 landings); CSV vs the audit scenario. | — |
| Verification (landing-area layer) | Each cell's longest usable run vs the horizon tracer on the same 240 m grid and time samples: 21 of 21 firm cells agree around IM-2 over 47 days, runs within one sample (`tests/suit.test.mjs`). The block-skipping march gives exactly the same cells as marching every sample: 0 differences on the whole 1.2 km grid and two 240 m windows, Sun and Earth, five dates (same file). The worker path gave the same landing areas as the page path in one browser run around IM-2 (370 areas, same six listed); that is not an automated test. The whole-pole view picks the 240 m cell nearest each 1.2 km map cell: worst offset half a cell, checked over the whole map (same file). In the browser, the largest area it found for November 2027 got an independent full-mission verdict from the finer horizon at that point. | One site and two dates. Gaps shorter than the sample step (4 or 8 hours) are missed. Slopes span two cells. In the whole-pole view about 40% of cells are close calls. |
| Verification (40 m close-up) | Tile windows equal the raw mosaic; the march handed from a window to the surrounding grid is exact on the 240 m terrain; on the 40 m tiles each cell's class matches the horizon tracer on 31 of 31 firm cells around IM-2 and 23 of 23 on Shackleton's rim (`tests/suit.test.mjs`). | Two places, one span each. Around IM-2 one cell's longest run differed by 10 samples without changing class. |
| Validation | Sun and Earth directions vs Horizons topocentric tables: 0.0002° and 0.006° over 912 epochs per body, plus a fresh grazing-moment query (below 0.0001° in Sun elevation). Sun direction vs NASA Moon Trek's Sun Angle service, an independent implementation with no terrain: worst 0.0007° over 1,011 hourly samples at three candidate sites (`tests/moontrek.test.mjs`). Long-term Sun and Earth visibility vs the LOLA team's maps (Mazarico et al. 2011, PGDA 69): r = 0.994 and 0.984 at 40 points. Apollo 11 touchdown: 10.70° vs Horizons 10.55–11.06°. | The only external reference for terrain-blocked visibility is PGDA 69, which stops at 82.9°S. No check against Moon Trek: no scriptable interface was found, so a comparison would be manual. No check against imagery. |
| Input pedigree | The assumptions table and every CSV state the site, observer height, grids, rules, ephemeris and versions. | — |
| Uncertainty characterisation | Ephemeris: residuals above. Event times: a few minutes (10-minute samples, interpolated). Terrain: measured resolution sensitivity per grid (9.4 m, 154.5 m, 1,226 m height-equivalent at the 90th percentile), turned into an angle at the range of the blocking terrain; verdicts that change inside it are marked too close to call (4.5% of 11,680 landings in 2027). | The 40 m level (1.6 m) is scaled from the 240 m level, not measured. Errors common to all LOLA grids are not included. The LOLA labels give no accuracy figure; published figures (Smith et al. 2017: 0.48 m median crossover residual; Barker et al. 2021: 0.3–0.5 m RMS for separate 5 m products) do not refer to the grids used here. |
| Results robustness | Verdicts recomputed with the terrain raised and lowered by its uncertainty. PGDA check repeated on the coarser browser stack (r = 0.994, 0.980). The one PGDA outlier is explained: the point lies on an edge of the reference map, which spans 0.01–0.33 within 60 m (`audit/lunar-navigator/pgda_outlier_output.txt`). | Sensitivity to observer height not swept. |
| Technical review | One audit against the Space Apps brief (`audit/lunar-navigator/AUDIT.md`), by the same assistant that wrote the code. | No independent human or second-model review of this round. |
| Use history, users | None. | No planner, educator, student or crew member has used it under observation. Protocols: AUDIT §4. |

## Accessibility (inspection only)

At 375 px and at desktop width, the three views show no horizontal page scroll and no console errors. Every control in the Plan view has a visible label or an accessible name (scripted check). Colour is never the only cue: verdict days carry an icon, close calls a "?" and a dashed edge, the stale state the word STALE. The field view announces a change of state to screen readers, not each tick of the countdown. Canvases carry text alternatives, and the side-by-side canvas has a full table beside it. Not done: a screen-reader pass, a contrast audit of the new elements, and a test on a physical phone.

## Not validated

- Usability, for any audience. The tasks, links, correct answers and measures are ready in `docs/USABILITY_TESTS.md`; no participant has run them.
- The landing-area map's speed and memory use on a phone. The page reports its own run time under the map, so this can be read off a device.
- The 40 m close-up's terrain uncertainty: 1.6 m is the 240 m level scaled by cell size, not a measurement.
- Terrain lighting against Moon Trek's lighting tool, which mails its result to an address and was not run.
- Anything about a real vehicle: power, thermal, communications, landing hazards.
- Terrain horizons north of 82.9°S against an external reference.
- The field view on a device in the field, and its behaviour when the device clock is wrong (it cannot detect that).
