# Lunar Landing Site Navigator: audit of the Lunar Lighting Planner

Audited 2026-11-14 against the NASA Space Apps 2026 challenge *Lunar Landing Site Navigator*. This audit changed no product code and deployed nothing. Everything it added is under `audit/lunar-navigator/`.

**Inspected revision.**
- Branch `main` at `8748ec7`. The working tree is clean apart from `audit/`.
- Local `main` is 3 commits ahead of `origin/main` (`22274d4`).
- The public site (gh-pages `a4df8bf`) serves `app.js?v=6`. It has neither the landing-ellipse nor the surface-route panels (checked with `curl`). Anything said below about what public users see applies to that older build, not to `8748ec7`.

**Project identity.** The workspace README declares the project an independent tool, "Not a NASA Space Apps entry", built before the hackathon; that is the owner's settled decision. The official dates agree: local events run 14–15 Nov and project submission opens Saturday 14 Nov 09:00 local (S5, S6), while the first commit is `c0c6d92` at 2026-11-13 14:13 −0600. The HackAthlone page lists its event as 13–15 Nov. Whether its opening preceded 20:13 UTC on 13 Nov was not checked; it does not change the outcome, because the README already declines entry.

## Outcome

1. **The science core works and is independently checked.**
   - Sun and Earth positions agree with JPL Horizons topocentric tables to 0.0002° (Sun) and 0.006° (Earth) over 912 epochs (`tests/ephem_oracle.test.mjs`).
   - Long-term visibility matches the LOLA team's polar maps: r = 0.994 for the Sun, 0.984 for Earth (`tests/pgda_illumination.test.mjs`).
   - At a grazing moment chosen for this audit, a fresh Horizons query matches the app to about 0.0001° in Sun elevation (§3.3).
2. **The comparison flow answers the brief, with one wrong answer that matters.** When a landing would lose both power and Earth contact, the headline verdict names the power loss even when Earth sets first. That is exactly the "which constraint closes the window" question a planner asks after a slip (§3.1, finding F-1).
3. **The biggest gaps are how much a planner can trust and reuse the output, not the physics.**
   - Out-of-span dates are silently changed (F-2).
   - Results cannot be exported, and no assumptions table sits beside the verdict (F-3).
   - No representative user has tested either mode.
   - There is no field (astronaut) view.
4. **Competition submission is not available for this repository.**
   - The official FAQ says "Teams are not allowed to begin working on the challenges prior to the hackathon" ([S6](#1-sources)).
   - The owner has declared this repository a non-entry (README), and its first commit predates the official 14–15 Nov event.
   - The submission rules are recorded in the matrix for completeness, but none is pursued (§5.2).

Tests: baseline at `8748ec7` is `node --test tests/*.test.mjs` → **26/26 pass**, 19.1 s. No test was added or changed.

---

## 1. Sources

All were retrieved on 2026-11-14 into `audit/lunar-navigator/sources/`.

The official site's server does not send its intermediate certificate. Plain `curl` therefore fails verification. The pages were fetched with full TLS verification, using the SSL.com issuing CA taken from the certificate's AIA URL; no `-k` was used.

| ID | Publisher | Original URL | Local path / access | Supports |
|---|---|---|---|---|
| S1 | NASA Space Apps | [challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) | `official_challenge.html` is the raw page (client-rendered Next.js). `official_challenge_text.txt` is the text decoded from its payload. The text was also read in a browser. | The full brief (summary, background, objectives, considerations) and its 4 resources. This is the obligation language used in §2. |
| S2 | NASA Space Apps | [Resources tab](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources) | `official_challenge_resources.html` | 4 resources (S7–S10). The tab has no downloads or datasets of its own. |
| S3 | HackAthlone (TUS Athlone local event) | [organizer brief](https://hackathlone.com/challenges/lunar-landing-site-navigator) | `hackathlone_challenge.html`, `.txt` | The same text as S1, cross-checked section by section. The event runs 13–15 Nov 2026, and the page says "The official page is the final word". Nothing remains unconfirmed. |
| S4 | NASA Space Apps | [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) | `official_judging_awards_guide.html`, `.txt` | Eligibility rules. Criteria scored 1–5: Impact, Creativity, Validity, Relevance, Presentation. |
| S5 | NASA Space Apps | [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) | `official_project_submission_guide.html`, `.txt` | Demo of ≤7 slides or a video of ≤30 s, public links, an SI-use statement, references, and the deadline (15 Nov, 23:59 local time). |
| S6 | NASA Space Apps | [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/) | `official_participant_faqs.html`, `.txt` | The no-prior-work rule, team rules, and SI use. |
| S7 | ASU / LROC | [LROC QuickMap](https://quickmap.lroc.asu.edu/) | `res_quickmap.html` is an 8 KB app shell; its content is JS-rendered and was not captured. | **Terrain** and imagery layers, per the S2 description. A comparison point for the map view. |
| S8 | NASA JPL (SSTP) | [Moon Trek](https://trek.nasa.gov/moon/) | `res_moontrek.html` is an app shell. Its capabilities are taken from S11. | **Terrain**, 3D views, a sun-angle tool, and ray-traced lighting over a date range. The nearest **comparison tool**. |
| S9 | NASA JPL SSD | [Horizons](https://ssd.jpl.nasa.gov/horizons/), [manual](https://ssd.jpl.nasa.gov/horizons/manual.html) | `res_horizons*.html`. Also `horizons_grazing_im2_2027-03-14_body10.txt` and `_body399.txt`, the two API queries made for §3.3. | **Measurements**: DE441 topocentric az/el. The project's ephemeris source and its reference oracle. |
| S10 | Canadian Space Agency | [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | `res_csa_moon.html`. The first request was reset and the second succeeded (38 KB). Only the navigation part of the extracted text was reviewed. | **Educational context**: missions and Canada's role in Artemis. It supplies no data. |
| S11 | NASA NTRS | [Day & Law 2022, Moon Trek, 20220010585](https://ntrs.nasa.gov/citations/20220010585) | `ui_ntrs_20220010585.json`, `ui_ntrs_20220010585_moontrek.pdf` (abstract) | The planner-tool baseline: a Line-of-Sight tool for Earth and relay links, lighting analysis over user date ranges, and "multiple levels of engagement with different points of entry". |
| S12 | NASA SVS | [4944: Earth and Sun from the Moon's South Pole](https://svs.gsfc.nasa.gov/4944/) | `ui_svs_4944.html` | A public visualization from a first-person horizon camera on Shackleton's rim, with three months compressed into two minutes. The Sun stays within 1.5° of the horizon. |
| S13 | W3C | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | `ui_wcag22.html` | Success criteria 1.1.1, 1.4.1, 1.4.10, 2.4.11, 2.5.1, 2.5.7, 2.5.8, 3.3.2 and 4.1.3, each confirmed present by its anchor. |
| S14 | NASA | [NASA-STD-3001 Vol 2 §10 Crew Interfaces](https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/) | `ui_nasa_crew_interfaces_vol2.html`, `.txt` | [V2 10020] requires a visual cue for "stale, missing, unavailable, or unknown" data. [V2 10113] requires that critical data need no "mental transposition or computation, memory, or repetitive navigation". [V2 10005] and [V2 10006] cover consistency and nomenclature. |
| S15 | NASA GSFC PGDA; USGS ScienceBase; WUSTL PDS Geosciences | [PGDA 69](https://pgda.gsfc.nasa.gov/products/69), [doi:10.5066/P1MEQ6UK](https://doi.org/10.5066/P1MEQ6UK), [PDS Geosciences](https://pds-geosciences.wustl.edu/dataserv/pdsonposter.html) | `data_pgda_69.html`, `data_usgs_artemis3_regions.html`, `data_pds_geosciences_policy.html`, `data_pds_cite.html` | Attribution terms in the archive table below |

**Scientific archives the project uses.** These are already in `data/raw/`, with md5 sums in `data/CHECKSUMS.md5`. No new archive data was downloaded for this audit; the subsets on disk sufficed.

| Product | Coverage / resolution | Version / ID | Access link | Use | Attribution terms (source) |
|---|---|---|---|---|---|
| LOLA `LDEM_85S_40M` | 85°S–pole, 40 m | LRO-L-LOLA-3-RDR-V1, md5 `782aff7c…` | [PDS Geosciences lola_gdr](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr) | Near terrain at curated sites; 13 site windows for ellipses | No licence statement found on the PDS Geosciences pages fetched (`data_pds_geosciences_policy.html`; `data_pds_cite.html` gives poster-citation guidance only). Unrestricted use is likely for NASA PDS data but **unconfirmed** → T9 |
| LOLA `LDEM_75S_240M` | 75°S–pole, 240 m | same, md5 `a25251d4…` | same | Polar horizons; custom points; routes | As above |
| LOLA `LDEM_16` | global, 16 px/° (~1.9 km) | same, md5 `87d937cf…` | same | Far terrain; reduced to 4 px/° for the browser | As above |
| JPL Horizons | 1969-01-01 to 2040-12-31, hourly, UT | DE441, `MOON_ME` frame, quantities 14/15/19/20 | [API](https://ssd.jpl.nasa.gov/api/horizons.api) | All Sun/Earth geometry (15 MB packed) | Not checked (Horizons pages saved, terms not read) → T9 |
| PGDA product 69 | 85°S–pole, 60 m | `AVGVISIB_85S_060M_201608` (+`_EARTH`) | [PGDA 69](https://pgda.gsfc.nasa.gov/products/69) | Validation reference only (Mazarico et al. 2011) | "Please cite the Mazarico et al. (2011) reference" (`data_pgda_69.html`) |
| USGS Artemis III regions | 9 candidate regions | McClernan 2024, doi:10.5066/P1MEQ6UK | DOI | Site catalogue (region centres and outlines) | CC0 1.0: "marked with Creative Commons Zero v1.0 Universal"; cite McClernan 2024 (`data_usgs_artemis3_regions.html`) |

The README states none of these terms. T9 adds them, together with the owner's licence choice.

## 2. Requirements

Obligation levels follow S1 exactly. Only the challenge sentence ("Your challenge is to create an intuitive tool…") and the objective "Display the positions of the Sun and Earth relative to the horizon…" are imperative. Every other objective is "may consider", or "may (but are not required to) consider", so those are treated as suggested features.

The ID prefixes are:

- **C**: core challenge outcome.
- **F**: suggested feature.
- **S**: submission rule.
- **X**: project extension.

| ID | Kind | Objective (S1 unless noted) | User decision it serves | Data / reference needed |
|---|---|---|---|---|
| C1 | core | Compare landing sites and dates quickly | Which site/date to keep after a slip | Ephemeris, terrain horizons |
| C2 | core (imperative) | Sun and Earth relative to the local horizon at a site and date | Is the Sun/Earth above the real horizon now | Horizons, LOLA |
| C3 | core | Assess power-generation potential | Does the site give enough solar input | Sun elevation, visible disk, sunlit share |
| C4 | core | Assess direct-to-Earth (DTE) communication windows | When can the lander talk to Earth without relay | Earth elevation vs horizon |
| C5 | core | Serve planners, educators and the public | Each audience's question (§4) | User testing |
| F1 | suggested | Curated sites (Apollo, CLPS, commercial, other nations) plus custom coordinates | Pick a candidate | Cited coordinates |
| F2 | suggested | Side-by-side or sequential comparison | Trade sites against each other | — |
| F3 | suggested | Choose dates and times; lunar days and seasons | Effect of schedule changes | Ephemeris span |
| F4 | suggested | Time remaining to sunset or Earthset | Operations timing | Event finding |
| F5 | suggested | Solar elevation, sunlight duration, Earth windows; elevation shown prominently | Viability at a glance | — |
| F6 | suggested | 2D map / 3D surface / other views | Spatial understanding | Terrain |
| F7 | suggested | Animation or timeline over a lunar day | Duration of windows | — |
| F8 | suggested (technical) | Horizons or precomputed ephemeris; LOLA horizons; no refraction; libration and orbital variation | Trust in the numbers | S9, LOLA |
| F9 | suggested (UX) | Show why small location or date changes have big effects; lunar vs terrestrial contrast | Understanding | — |
| F10 | suggested (data) | Steep slopes and deep craters; extreme shadow | Hazard and shadow awareness | LOLA |
| F11 | suggested (impact) | Science–engineering coordination; quick response to slips | Shared, reusable answers | — |
| S1r | rule (S4, S6) | Respond to an official challenge, with work begun during the event | Eligibility | — |
| S2r | rule (S4, S5) | Demo: ≤7 slides or ≤30 s video, at a public link | Judging (Presentation) | — |
| S3r | rule (S5) | Public final-project link needing no login; English | Judging | Hosting |
| S4r | rule (S5) | Describe SI (AI) use; list all external resources; originality attestation | Judging | — |
| X1 | extension (requested) | Astronaut / analog-crew field use | Next closure and forecast validity in the field | §4.3 |
| X2 | extension (built) | Landing ellipse: slope, touchdown light, approach Sun | Pick a touchdown ellipse | LOLA 40 m, Apollo 7–20° rule |
| X3 | extension (built) | Surface route with Sun/Earth at waypoints and drive timing | Plan a traverse | LOLA 240 m / 40 m |

## 3. Assessment

**Architecture (inspected).**
- Entry point: `web/index.html`. It has an inline import map at `web/index.html:269` and loads `app.js?v=15`.
- The app is plain ES modules with no build step and no server code.
- Inputs: `web/data/ephem/<year>.bin` (Horizons, UT), `web/data/dem/*.i16` (LOLA), `web/data/horizons/<site>.json` (precomputed 720-ray horizons) and `web/data/sites.json` (32 cited sites).
- Calculations:
  - `ephem.js`: topocentric az/el from hourly sub-points.
  - `horizon.js`: ray tracing on great circles with curvature, 2 m eye.
  - `windows.js`: margins, events and verdict.
  - `shadow.js`: lit map.
  - `landing.js` and `route.js`.
- Flows: Plan (verdict → nearby days → other sites → move the lander → Sun/Earth panel → map → ellipse → route → timeline → calendar) and Explore (globe, lit map, up to 4 site cards, 4 explainers).
- The deploy is 49 MB of static files, published to GitHub Pages by `git subtree split --prefix web -b gh-pages` and `git push origin gh-pages`.
- State lives in the URL hash.

**What kind of evidence each part has.**

| Kind | Items |
|---|---|
| Working features | Both modes, run locally at `8748ec7` with no console errors (this session) |
| Independently checked | Ephemeris vs Horizons; illumination vs PGDA; grazing case vs a fresh Horizons query (§3.3); Apollo 11 replay (10.70° vs Horizons 10.55–11.06°) |
| Internally checked | Calendar vs detail view; shadow map vs tracer; globe vs tracer; ellipse/route vs the shipped horizons and the raw mosaic |
| Synthetic (labelled, tests only) | Window/verdict unit tests, tilted plane, ellipse geometry |

No mockups, placeholders or synthetic data were found in shipped paths.

### 3.1 Scenarios

All scenarios ran with `node audit/lunar-navigator/scenarios.mjs`; the output is in `scenarios_output.txt`. The script uses the app's own modules and shipped data. The F-1 and F-2 behaviour was also reproduced in the running app.

Common settings:
- Time scale: UT.
- Observer: 2 m above LOLA ground.
- Sun counts as "up" by its upper limb; Earth by its centre.
- Terrain: the shipped 720-ray horizon (40 m → 240 m → 16 px/°).
- Joint-interval closure searched hourly, then refined to the minute.
- 10-day verdict: the app's rule on hourly rows, with "any part of the Sun" and Earth required.

**A. Site fixed, landing date slips.**

Site: IM-2 Athena, Mons Mouton (−84.7906°, 29.1957°E, ground 5321 m). The planned landing is the hour that opens the longest joint Sun+Earth interval starting in March 2027: **2027-03-14 16:00 UT**.

| Slip | Sun / Earth up at landing | Joint interval | Closes first | App's 10-day verdict |
|---|---|---|---|---|
| +0 d | yes / yes | 212.0 h | Earth | cut short 212 h (earth) |
| +1 d | yes / yes | 188.0 h | Earth | cut short 188 h (earth) |
| +2 d | yes / yes | 164.0 h | **Earth** | **cut short 230 h (power)** ← F-1 |
| +5 d | yes / yes | 92.0 h | **Earth** | **cut short 158 h (power)** ← F-1 |
| +10 d | yes / no | — | — | can't start (Earth hidden) |
| +14 d | no / yes | — | — | can't start (Sun below terrain) |
| +28 d | no / yes | — | — | can't start (Sun below terrain) |

No landing hour within 120 days after the 14-day slip gives a full 10-day mission with Earth required: the longest joint interval in March is 212 h, short of 240 h.

**In the app** (`#mode=plan&site=im2_athena&land=2027-03-16T16:00&dur=10&share=0&earth=1`):
- The headline reads "Cut short on 16 Mar 2027. The Sun sets behind the terrain about 9 d 14 h after landing".
- The panel below it shows "Earthset in 6 d 19 h · 2027-03-23 11:58 UTC" (evidence: `evidence/im2_2027-03-16_verdict.jpg`).
- So the information is on the page, but the headline names the second constraint to close.
- Discrepancy: the script finds this Earthset at 12:00 UT (first failing minute); the page shows 11:58 (linear interpolation of 10-min samples). Two minutes, within the README's stated event-time error of a few minutes.

**B. Date fixed (2027-03-14 16:00 UT), nearby south-polar sites.**

| Site | Sun margin | Earth margin | Joint interval | Closes first | App verdict | 30-day sunlit / Earth / both |
|---|---|---|---|---|---|---|
| IM-2 Athena | +0.08° | +11.79° | 212.0 h | Earth | short 212 h (earth) | 43 / 83 / 31 % |
| A3 Mons Mouton | −3.65° | +3.71° | — | Sun already down | can't start | 0 / 42 / 0 % |
| A3 Mons Mouton Plateau | −4.30° | +8.87° | — | Sun already down | can't start | 22 / 69 / 11 % |
| A3 Nobile Rim 1 | +5.91° | +3.38° | 64.8 h | **Earth** | **short 89 h (power)** ← F-1 | 28 / 38 / 24 % |
| A3 Nobile Rim 2 | +2.07° | +8.74° | 160.1 h | **Earth** | **short 236 h (power)** ← F-1 | 39 / 67 / 29 % |
| A3 Malapert Massif | −5.07° | +5.61° | — | Sun already down | can't start | 0 / 51 / 0 % |
| A3 Haworth | −7.43° | +3.96° | — | Sun already down | can't start | 0 / 44 / 0 % |
| A3 de Gerlache Rim 2 | −14.41° | +6.54° | — | Sun already down | can't start | 30 / 55 / 0 % |
| A3 Slater Plain | −5.27° | +3.59° | — | Sun already down | can't start | 0 / 42 / 0 % |
| A3 Peak Near Cabeus B | −2.37° | +4.31° | — | Sun already down | can't start | 28 / 45 / 9 % |

In the app, "Move the lander instead" (24 points 5–20 km away) answered in about 2 s: "2 of 24 nearby points give a full mission". Its list ranks the other points by the verdict's reason, which shows the same masking.

**E. One nearby point, traced as the app does it** (`web/planner.js:121-127`: the same destination formula and fast 240 m → 4 px/° horizon). The "5 km northeast" point (−84.6727°, 30.4516°E), landing 2027-03-16 16:00 UT, has a joint interval of **138.5 h closed by Earth**. The app lists it as "Sun lost after 9 d 18 h" (234 h, power). Source: `scenarios_output.txt` §E.

**F-1 (material).**
- `landingVerdict` looks for a power loss anywhere in the mission first and reports it if found, **regardless of** whether Earth was lost earlier (`web/windows.js:59-62`).
- The README documents this order ("Each landing gets the first rule it fails, checked in this order").
- It still answers "which constraint ends the window" wrongly in 4 of the 6 distinct cut-short cases above (A +2 d, A +5 d, Nobile Rim 1, Nobile Rim 2; the B row for IM-2 repeats A +0 d), and at the nearby point in E.

### 3.2 Power and communication framing

- **Sunlight** is reported as a *power input*: whether the upper limb is above the terrain, the Sun's elevation, the visible fraction of the disk, and sunlit share and duration. The app gives **no watts**. Delivered power would need array area and orientation, efficiency, temperature, and dust. The app claims none of this.
- **Earth visibility** is a *geometric line-of-sight opportunity* (Earth's centre above terrain). It is not a link budget: no antenna pattern, DSN station visibility, or relay. README "Limits" says so.

### 3.3 Grazing horizon

Setting: IM-2 Athena, 2027-03-14 16:50 UT, eye 2 m (site altitude 5.3227 km above the 1737.4 km sphere).

| Quantity | App | Reference | Difference | Kind of check |
|---|---|---|---|---|
| Sun elevation | 1.0073° | Horizons 1.007309° (`horizons_grazing_…_body10.txt`) | <0.0001° | Independent |
| Sun azimuth | 69.1998° | 69.199618° | 0.0002° | Independent |
| Earth elevation / azimuth | 10.3525° / 326.2159° | 10.352963° / 326.214489° | 0.0005° / 0.0014° | Independent |
| Terrain horizon toward the Sun | 1.096° (shipped 40 m → 240 m → 16 px/° profile) | 1.094° (live 240 m → 4 px/° trace) | 0.003° | Internal only (same DEM family) |
| Upper-limb margin | +0.179° | — | — | Counted as Sun up |
| Visible disk | 29 % | — | — | The power input scales with this, not with up/down |

At grazing incidence, the up/down call depends on terrain error, not on ephemeris error. A 0.18° margin corresponds to about 0.3 m of terrain height per 100 m of distance. The 40 m DEM's vertical and positional error at that range was not assessed here. The app shows the percentage of the disk, which is the honest quantity at grazing incidence.

### 3.4 Outside data coverage

| Case | Behaviour | Evidence | Finding |
|---|---|---|---|
| Landing 2041-01-05 (after the 1969–2040 ephemeris) | The shared link silently loads **2040-12-20 23:00** and rewrites the hash, with no notice. `#pLand` has no `min`/`max`. | Browser; `web/planner.js` load path | **F-2** |
| Landing 2040-12-20, 10 days | "No full-mission date in the 90 days after", although only 11 days of data remain. Verdicts past `T_MAX` are `null` and are counted as "not full". | `web/planner.js:33-35, 80-84`; browser | **F-2** |
| Ephemeris load for 2041 (Node) | Throws "ephemeris covers 1969-2040 only" | `scenarios_output.txt` | Correct at module level |
| Custom point −74.5°, 30°E (north of the 240 m grid) | Horizon traced on the 4 px/° global grid (~7.6 km), and the grid is named in the result. Rays never run off the data, because the global grid covers everything. The plan's "incomplete ray → unknown" state does not exist and is not needed. | `scenarios_output.txt`; the globe readout names its grid | Resolution, not coverage, is the limit; the app discloses it |
| A3 Mons Mouton Plateau (−84.33°, outside LDEM_85S_40M) | No 40 m window; the ellipse uses 240 m and says so | `crop40.json`; README | Disclosed |

### 3.5 Requirements matrix

| ID | Requirement and source | Current behavior | File, test, or observed result | Status | Gap and next task | Acceptance check | Resource |
|---|---|---|---|---|---|---|---|
| C1 | Compare sites and dates quickly (S1 summary) | Verdict, nearby-days strip, nearest workable dates, other sites that day, move-the-lander (24 points), sites × days calendar | §3.1; move-the-lander about 2 s; `tests/calendar_consistency.test.mjs` | partial | F-1 names the later constraint → **T1**. No single view puts several sites on one time axis → **T4** | §3.1 A +2 d names Earth at about 6 d 19 h; Nobile Rim 1 names Earth at 64.8 h | Scenarios A/B |
| C2 | Sun and Earth vs local horizon, site and date (S1, imperative) | Four headline figures plus a 360° terrain panorama with Sun/Earth paths; dashed ring when hidden | `tests/ephem_oracle.test.mjs` (0.0002°/0.006°); §3.3 | met | — | Re-run the oracle; the §3.3 numbers reproduce | S9, LOLA |
| C3 | Power-generation potential (S1 summary) | Sun elevation, % disk visible, sunlit share, longest night; power-need setting (any / half / whole disk) | §3.2; `tests/pgda_illumination.test.mjs` | met (as power input) | Watts need engineering inputs (not requested) → optional **T12** | — | PGDA 69 |
| C4 | DTE communication windows (S1 summary) | Earth elevation, Earthrise/Earthset times, % Earth visible, bands | §3.1; oracle test | met (geometric) | Link availability needs DSN/antenna inputs → optional **T12** | — | S9 |
| C5 | Serve planners, educators, public (S1) | Plan and Explore modes; plain-language explainers; text alternatives on canvases | Browser inspection (aria-labels carry live values) | unverified | No representative users tested → **T7** | §4 protocols run with ≥5 users per audience | S11–S14 |
| F1 | Curated plus custom sites (S1, may) | 32 cited sites (Apollo, IM-1/2, Blue Ghost, HAKUTO-R, Chandrayaan-3, Chang'e-3–6, SLIM, Luna 25, Artemis III regions, Chang'e-7 candidates); map click or coordinates | `web/data/sites.json` | partial | Future CLPS targets have no published coordinates (dependency) → **T11** | Each new site has a fetched primary source | CLPS releases |
| F2 | Side-by-side / sequential comparison (S1, may) | Other-sites list, calendar, up to 4 Explore cards on a common −5° to 15° scale | Browser | met | Synchronized timeline is a planner improvement → **T4** | — | — |
| F3 | Choose dates/times; lunar days and seasons (S1, may) | Any UTC minute 1969–2040; strip ±14 d; calendar up to 12 months | §3.4 | partial | Silent clamp and false "no date" near the span end (F-2) → **T2** | §3.4 rows show a visible message | — |
| F4 | Time to sunset/Earthset (S1, may) | "Sunset in 9 d 13 h", "Earthset in 6 d 19 h" with UTC times | §3.1 | met | Headline verdict contradicts the figures (F-1) → **T1** | As C1 | — |
| F5 | Elevation (prominent), sunlight duration, Earth windows (S1, may) | Headline tiles; month stats; bands | Browser | met | — | — | — |
| F6 | 2D / 3D views (S1, may) | Lit-terrain polar map, horizon panorama, rotatable shaded globe (2D canvas) | `tests/shadow.test.mjs`, `tests/globe.test.mjs` | met | — | — | LOLA |
| F7 | Animation / timelines (S1, may) | Play on map and globe; mission timeline; waypoint bands | Browser | met | — | — | — |
| F8 | Horizons, LOLA, no refraction, libration (S1 considerations) | DE441 `MOON_ME` hourly; 720-ray LOLA horizons; no refraction term; libration through the sub-Earth point | README "Data and method"; oracle, DEM orientation and PGDA tests | met | Unexplained PGDA Earth outlier at 86.5°S 135°E → **T8** | Cause found or bounded | PGDA 69 |
| F9 | Why small changes matter; lunar vs terrestrial (S1, may) | 4 explainers; move-the-lander; nearby-days strip | Browser | partial | No guided two-site (ridge vs crater) comparison → **T5** | §4.2 task success ≥80% | S12 |
| F10 | Slopes, deep craters, shadows (S1, may) | Lit map; ellipse slope classes (40 m); route steep share | `tests/landing_route.test.mjs` | met | Metre-scale hazards are out of scope (stated) | — | LOLA |
| F11 | Science–engineering coordination; respond to slips (S1, may) | Shareable URL hash restores the scenario | `web/app.js:6-55` | partial | No export, no assumptions table → **T3**; live site lags 3 commits → **T10** | The CSV for §3.1 A matches `scenarios_output.txt`; shared link verified fresh (§6) | — |
| S1r | Official challenge, work begun during event (S4, S6) | Repository began 2026-11-13; README declares it a non-entry | `git log`; README | missing | Not pursued: ineligible. A submission needs new work started inside the event window (owner's call; window ends 15 Nov 23:59 local) | — | S4, S6 |
| S2r | Demo ≤7 slides / ≤30 s video (S4, S5) | None in the workspace | Inspected | missing | Not pursued (S1r) | — | S5 |
| S3r | Public link without login; English (S5) | Public gh-pages site (older build); English throughout | `curl` of the live site | met (for the old build) | Deploy the current build → **T10** | §6 fresh-browser check | — |
| S4r | SI-use description; references; originality (S5) | README states the code was written by Claude under the author's direction; data table cites sources | README | partial | Not pursued as a submission; licence and attribution unstated → **T9** | README has licence and data credits | — |
| X1 | Astronaut / analog field use (requested) | None. "Right now" in Explore means the chosen simulated moment (`web/explore.js:29`), not the wall clock; no staleness cue | Code and browser | missing | → **T6** | §4.3 protocol | S14 |
| X2 | Landing ellipse (built extension) | Slope share, touchdown sunlight (240 m loaded), approach-Sun check | `tests/landing_route.test.mjs` (worst 0.216°, 148/148) | met | Local only → **T10** | — | LOLA, Apollo rule |
| X3 | Surface route and drive timing (built extension) | Great-circle legs, profile, waypoint Sun/Earth, arrival times | Same test; arrivals match a hand calculation | met | Local only → **T10** | — | LOLA |

## 4. UI findings by audience

There were no representative users. Every walkthrough below is an **expert inspection** by the auditor. Each "alternative" is a **design proposal**, not a published finding. Published sources are cited where they support a design rule.

### 4.1 Mission planners

- **Decision.** After a launch slip, is there a continuous window, and which constraint closes it?
- **Current flow** (expert inspection):
  - The verdict comes first, then the 29-day strip and the nearest workable dates, all one tap apart.
  - The Earthset time is visible two sections below the verdict.
  - Failure state: F-1. The headline can name the wrong closer, and the planner must compare two numbers in different panels to catch it. That is the "mental transposition or computation" that NASA-STD-3001 [V2 10113] says critical data should not require ([S14](#1-sources)).
- **Published evidence.**
  - Moon Trek pairs lighting analysis over user-defined date ranges with a Line-of-Sight tool for Earth and relay links, as separate tools ([S11](#1-sources)).
  - The planner gap the brief names is having to work across "multiple interfaces" ([S1](#1-sources)).
- **Alternative (proposal).**
  - Synchronized site × date timelines: one row per candidate site on a shared time axis, with Sun, Earth and a **joint** band.
  - The first closure on each row labelled in words ("Earth sets 23 Mar 11:58, 6 d 19 h").
  - A terrain-horizon strip for the selected row.
  - An inspectable assumptions table next to the verdict: eye height, terrain grid at the site, sampling step, visibility rules, ephemeris DE441 and its span, and data versions.
- **Layout and controls.** Site set (add/remove), landing time, mission length, the power/Earth requirement toggles, and a slip control (± days). Rows sort by joint-window length.
- **Failure state.** A row that runs past 2040-12-31 shows "data end" rather than a verdict (fixes F-2).
- **Comparative task.** "Launch slipped 2 days to 16 Mar 16:00 UT. Find the longest window at IM-2 or a nearby Artemis region that keeps power and Earth, and say what ends it."
  - Correct answer, from §3.1: IM-2, 164 h, ended by Earth.
  - Measure: correctness of the closer, time to decision, and errors in naming the closer. Compare the current flow with the prototype.

### 4.2 Public users and educators

- **Decision.** Can a first-time visitor explain why moving from a ridge to a nearby crater changes the result?
- **Current flow** (expert inspection):
  - Explore shows up to 4 site cards. Each has a small horizon panorama on a common −5° to 15° scale, a month timeline, and plain-language pills.
  - The canvases carry live text alternatives, for example "Sun and Earth over the month at … sunlit 53% of the time". This meets the intent of WCAG 2.2 1.1.1 ([S13](#1-sources)).
  - Four explainers sit below.
  - Failure state: the visitor must pick both sites themselves. Nothing pairs a ridge with a crater floor, and the explainers are not tied to the cards.
- **Published evidence.**
  - NASA SVS 4944 explains south-pole lighting with a first-person horizon view from Shackleton's rim. It compresses three months into two minutes and states that the Sun never rises more than 1.5° above or sinks more than 1.5° below the horizon ([S12](#1-sources)).
  - Moon Trek's outreach aims at "multiple levels of engagement with different points of entry" ([S11](#1-sources)).
  - WCAG 2.2 1.4.1 (colour not the only cue) and 2.5.7 (single-pointer alternative to dragging) apply to the comparison controls ([S13](#1-sources)). The app already pairs every colour with an icon and has tap-to-centre (D8 in `docs/decisions.md`).
- **Alternative (proposal).**
  - A guided two-site comparison: two labelled horizon panoramas stacked, with one shared date slider.
  - The same Sun drawn at the same azimuth on both, with the terrain that blocks it labelled ("crater wall, 4.1° high").
  - A one-sentence text alternative that updates as the slider moves.
  - **Dependency:** a cited crater-floor coordinate. None is in the catalogue (README lists the missing "peak of light" points). Until one is sourced, the pair uses a user-picked map point.
- **Comparative task.** "Here are two places 10 km apart. Move the date. Explain why one is dark."
  - Score the explanation against a rubric: names terrain blocking a low Sun.
  - Measure: rubric correctness, time, and misconceptions (for example "it is night everywhere").

### 4.3 Astronauts and analog crews (extension)

- **Decision.** What is the next closure, and is this forecast still valid after an interruption?
- **Current flow** (expert inspection):
  - There is no field view.
  - Every "now" is a chosen moment (Explore's "right now" = start date + slider, `web/explore.js:29`; Plan defaults to the current hour on load only).
  - After an interruption the page keeps showing an old moment with no staleness cue.
  - The ephemeris also has a hard validity limit (2040), which F-2 hides.
- **Published evidence.** NASA-STD-3001 Vol 2:
  - [V2 10020] requires a visual indication when data are "stale, missing, unavailable, or unknown".
  - [V2 10113] requires critical data in a form that needs no mental computation.
  - [V2 10005] and [V2 10006] require consistent layout and nomenclature ([S14](#1-sources)).
- **Alternative (proposal).** A compact field display: site, task duration, time remaining to the **first** closure (Sun or Earth, named), and a validity line ("computed 14:00 UT for wall clock; data valid to 2040-12-31"). It turns amber and says "stale" once the wall clock passes the computed moment plus a set tolerance.
  - Controls: start task, task duration.
  - Failure states: stale; outside the ephemeris; the site's horizon traced at 7.6 km (low-confidence badge).
- **Comparative task.** Show a forecast, interrupt for 10 minutes with a distractor, then ask "how long until you lose Earth, and can you trust this screen?"
  - Measure: correct closer and time, and whether staleness is detected.
- **What an analog test can establish.** Comprehension, detection of stale forecasts, and time to answer under interruption, in a simulated setting. It cannot establish suitability for flight. That would need flight-qualified hardware, certified data products, real communications latency and crew-procedure integration.

## 5. Uses, backlog

### 5.1 Uses ranked by the evidence available today

| Rank | Use | User | Decision | Usable output today | Missing capability | Validation needed |
|---|---|---|---|---|---|---|
| 1 | Classroom and public exploration | Teachers, students, public | Why the pole is hard; compare sites | Explore cards, globe, lit map, explainers; validated geometry | Guided ridge-vs-crater pair (T5); user testing (T7) | §4.2 protocol in a classroom |
| 2 | Preliminary site and schedule screening | Mission planners | Keep/move a site or date after a slip | Verdicts, joint windows, move-the-lander, calendar; checked against Horizons and PGDA | Correct closer (T1), span honesty (T2), export and assumptions (T3), synchronized timeline (T4) | Cross-check selected windows against Moon Trek's lighting tool or PGDA at the candidate sites; §4.1 protocol |
| 3 | Inputs to power and communications trade studies | Power/comm engineers | Array and link sizing | Sun elevation, % disk, Earth elevation/azimuth time series (on screen only) | Export (T3); array and link models are separate engineering work (T12) | Engineering review of exported series against their model inputs |
| 4 | Analog crew training | Analog crews, trainers | Next closure in the field | None suited | Field display with staleness (T6) | §4.3 analog protocol |

### 5.2 Backlog (dependency-ordered)

**First three actions:** T1, T2 and T3. They are independent and can run in parallel.

| Task | Req ID | Priority and rationale | Prerequisite | Resource | Definition of done |
|---|---|---|---|---|---|
| **T1** Name the first constraint to close, in the verdict, the other-sites list and the move-the-lander list | C1, F4 | P1: gives a wrong answer to the brief's motivating question (F-1) | — | `web/windows.js`, `scenarios.mjs` | IM-2 at 2027-03-16 16:00 UT names Earth at about 6 d 19 h (power at 9 d 14 h second). A regression test covers the 4 F-1 cases in §3.1. 26 tests still pass. |
| **T2** Data-span honesty: no silent clamp; `min`/`max` on `#pLand`; the nearest-dates search says when it hits 2040-12-31 | F3, X1 | P1: a shared link can silently become a different scenario (F-2) | — | `web/planner.js`, `web/app.js` | A link dated 2041-01-05 shows a visible message. At 2040-12-20 the page says the data end in 11 days rather than "no full-mission date in 90 days". |
| **T3** Assumptions table next to the verdict, plus CSV export of the window table | F11, C3, C4 | P1: planners and trade studies need numbers they can carry and audit | — | README "Data and method" | The CSV for §3.1 A matches `scenarios_output.txt`. The assumptions block names eye height, grid at the site, step, rules, DE441 and its span. |
| T4 Synchronized multi-site timeline with a joint band and named closers | C1, F2 | P2: §4.1 alternative | T1 | §4.1 | Prototype runs the §4.1 task |
| T5 Guided two-site comparison with text alternative | F9, C5 | P2: §4.2 alternative | A cited crater-floor coordinate, or user-picked points | S12, S13 | Prototype runs the §4.2 task; text alternative updates with the slider |
| T6 Field display: wall-clock mode, first closure, staleness and validity cue | X1 | P3: extension | T1, T2 | S14 [V2 10020] | Stale state appears after the tolerance; §4.3 task runs |
| T7 Usability tests (3 protocols, current vs alternative) | C5 | P2: C5 stays unverified until then | T4, T5, T6 prototypes; recruiting representative users | §4 | Correctness, time and error rates reported per audience |
| T8 Explain the PGDA Earth outlier at 86.5°S 135°E | F8 | P3: validity, already disclosed | — | PGDA 69 | Cause identified or bounded in the README |
| T9 State the licence and data attribution terms | S4r, F8 | P2: needed before wider sharing (open question in KOS `qst_e2a3a9d68eeb`) | Owner picks a licence; read each archive's terms | PDS, PGDA, USGS pages | README has a licence and a credits section |
| T10 Deploy the current build (owner's call: GitHub or stewie.space) | F11, S3r, X2, X3 | P2: the public site lacks 3 commits | Owner's yes | §6 | §6 fresh-browser check passes on the chosen host |
| T11 Add future CLPS sites as coordinates are published | F1 | P3: dependency | Published coordinates | CLPS releases | Each site cited to a fetched source |
| T12 (optional) Power and link models | C3, C4 | P3: outside the brief's metrics | Array and link engineering inputs | Engineering owners | Watts and link margin labelled with their inputs |

**Competition submission.** There are no actionable tasks: S1r makes this repository ineligible.
- A submission would mean starting a new project inside the event window, which closes 15 Nov 2026 at 23:59 local time ([S4](#1-sources)).
- It would then need its own demo, SI statement and references (S2r, S4r).
- That is the owner's decision, and this audit does not recommend submitting this repository.

**Longer-term product work.** T4–T12.

## 6. Hosting note

**GitHub is optional and stewie.space is available for self-hosting.**

**What the app needs (inspected).**
- Static files only: `web/`, 49 MB, of which 34 MB is DEMs and 15 MB is ephemeris. There is no server code, database or authentication.
- All paths are relative, so the app runs at a subpath or on its own hostname.
- The globe's module worker loads from the same origin (`web/globe.js:93`).
- `.i16` and `.bin` are served as `application/octet-stream`.
- Gzip saves only 8–13% on the data (measured: `polar240.i16` 87%, `2027.bin` 88%, `global4.i16` 92% of original size), so compression can be left off for those files.

**Lightest viable setup on stewie.space.** A tunnel from a new hostname to a small local static web server, with no inbound ports:
1. A small `nginx:alpine` service serving a read-only bind mount of `web/`, published on the loopback interface only.
2. One tunnel ingress entry and DNS route for the new hostname.
3. A server block with `root`, `index index.html`, and a short cache for `/data/`. JS cache-busting already comes from the `?v=` query.

**One concrete gotcha.** If the server sends a `Content-Security-Policy` with `script-src 'self'`, it blocks the inline `<script type="importmap">` in `web/index.html`, and then no module loads.
- Fix: add `'sha256-<hash of the import map>'` to `script-src`. Recompute the hash after every `?v=` bump, or move the import map out.
- `worker-src 'self'` and `connect-src 'self'` are enough for everything else.

The owner's existing server configuration was inspected for this note; its details are kept out of this public copy.

**Verify a shared scenario from a fresh browser.**
1. Open a private window at `https://<host>/#mode=plan&site=im2_athena&land=2027-03-16T16:00&dur=10&share=0&earth=1&mh=0`.
2. Confirm the console shows no CSP violations.
3. Confirm the network panel shows 200s for `data/ephem/2027.bin` and `data/horizons/im2_athena.json` (and for `data/dem/polar240.i16` once "Check (29 MB terrain)" is pressed).
4. Confirm the page shows "Sunset in 9 d 13 h" and "Earthset in 6 d 19 h", as in §3.1.
5. Reload, and confirm the hash still restores the same scenario.

That last step is a hosting choice for the owner, and nothing was deployed by this audit.

## 7. Completeness check

- **Every core outcome has a matrix row:** C1–C5.
- **Every partial or missing row has a task or a stated dependency:**
  - C1: T1, T4
  - C5: T7
  - F1: T11 (dependency)
  - F3: T2
  - F9: T5
  - F11: T3, T10
  - S1r / S2r: not pursued, stated
  - S4r: T9
  - X1: T6
- **Material findings and their evidence:**
  - F-1: §3.1 tables A and B, case E, `windows.js:59-62`, screenshot, browser.
  - F-2: §3.4, `planner.js:33-35,80-84`, browser.
  - CSP gotcha: the inline import map in `web/index.html`.
  - Live-site lag: `curl` shows `app.js?v=6`.

**The claim most likely to be wrong:** that Explore's "right now" would be misread as wall-clock time. That rests on expert inspection; only the §4.3 protocol can settle it.

## 8. Follow-up, 2026-11-14

The findings above describe revision `8748ec7`. Work done since is tracked in `docs/PLAN.md` (status table) and checked in `docs/VALIDATION.md`. F-1 and F-2 are fixed; T1–T6, T8 and the credits half of T9 are done; T7, T10 and the licence wait on the owner.

Sources added to `audit/lunar-navigator/sources/` on 2026-11-14 (the folder is not committed; URLs are given so each can be refetched):

| ID | Publisher | Original URL | Local path | Supports |
|---|---|---|---|---|
| S16 | NASA | [NASA-STD-7009B](https://standards.nasa.gov/standard/NASA/NASA-STD-7009) | `std_nasa_std_7009B_final_2024-03-05.pdf` | Scope and credibility factors used in `docs/VALIDATION.md` |
| S17 | NASA | [NPR 7150.2D](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7150_002D_) | `std_nodis_npr7150_2D_N_PR_7150_002D_.pdf` | Software classes; the NPR does not bind the public |
| S18 | Barker et al. 2021, via NTRS | [author manuscript](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf) | `err_barker2021_lola_south_pole_author_ntrs.pdf` | Error figures for separate 5 m LOLA products (not the grids used here) |
| S19 | Smith et al. 2017, via NTRS | [accepted manuscript](https://ntrs.nasa.gov/api/citations/20160008718/downloads/20160008718.pdf) | `err_smith2017_lola_summary_ntrs_20160008718.pdf` | LOLA crossover residual 0.48 m; geolocation below 10 m |
| S20 | NASA NTRS | [Mazarico et al. 2011 record](https://ntrs.nasa.gov/api/citations/20120010094) | `err_mazarico2011_ntrs_record.json` | Abstract only; no numeric accuracy |
| S21 | NASA/JPL SSD | [About](https://ssd.jpl.nasa.gov/about/) | `terms_jpl_ssd_about_page.html` | Requested credit line for Horizons data |
| S22 | PDS Geosciences Node | [FAQ](https://pds-geosciences.wustl.edu/faq.html) | `terms_pds_geosciences_faq_page.html` | Data freely available; cite as published research |
| S23 | NASA JPL | [Moon Trek](https://trek.nasa.gov/moon/) | `terms_nasa_trek_moon_page.html` | No API or documentation links on the page |
