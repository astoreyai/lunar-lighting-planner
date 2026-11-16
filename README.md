# Lunar Lighting Planner

An independent tool that answers two quick questions for any lunar landing site and date between 1969 and 2040:

1. **Is the Sun above the real terrain horizon, and for how long?** This decides power and thermal conditions.
2. **Is Earth above the horizon, and for how long?** This decides whether a lander can talk to Earth directly.

**Not a NASA Space Apps entry.** It is an independent project inspired by the 2026 NASA Space Apps challenge [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/), and it isn't submitted for judging.

It was built with an AI coding assistant (Claude), which wrote the code and ran the checks under the author's direction. All data are real and cited (see below).

The page opens with one question, "What do you want to find out?", and seven answers to it. Five are planning questions on one shared scenario, one is for learning and one is for use on the surface. Each view states its question, what you enter and what you get. Page text is short, in simplified technical English. A small "i" opens a bubble of one or two sentences where a detail is needed.

| Tab | Question | You enter | You get |
|---|---|---|---|
| Check landing | Does this landing work, and for how long? | Place, landing time, mission length, power needs, Earth contact | Full mission, cut short or no start; time to the first loss; map and sky at any moment |
| Find dates | When can I land at this place? | Place and mission needs; the landing time centres a search of 90 days either side | Every usable window, what ends it, the latest landing that still holds the mission |
| Find places | Where can I land? | A region or place and mission needs; the landing time starts the search (7 days before to 30 days after) | Landing areas on the map, points within 20 km, how each candidate site does |
| Compare sites | Which site is better for this mission? | The sites, mission needs, the same search dates | Best windows on one calendar, the CLPS regions side by side, every window at every site |
| Route | Will the touchdown and the drive work? | Place, landing time, ellipse, approach, slope limit, waypoints, speed | Slope and sunlight in the ellipse, the route's distance and slopes, Sun and Earth at each stop |
| Explore | How does light move across the Moon? | A time, and points on the globe or map | The lit Moon, Sun and Earth from any point, a month at each compared site |
| Field | How long do I have right now? | Site, task length, Earth contact; the device clock | Whether the task fits before the first loss, and the time remaining |

Choosing a window, a place, a landing area or a compared site sets the scenario and opens **Check landing** for it.

### The five planning questions (mission planners, navigation and operations engineers)

Pick the place first, then a date: a target site is often fixed by science or logistics, so the first question is when that site works. Then set the mission: its length, its power needs (any part, half, or all of the Sun's disk visible) and whether direct-to-Earth contact is required. The date also says where in the calendar the search for windows starts. The defaults (10 days, any part of the Sun, Earth required) are examples, not NASA or CLPS requirements. On a phone the scenario folds into a one-line summary.

The scenario is shared by the five planning questions and sits under the question. Its first row is the place (the three regions NASA names for planned CLPS deliveries, then the catalogue and coordinates); its second row is the mission. In **Check landing** the verdict and the mission clock sit beside the map; on a phone the map comes straight after the clock's slider, which drives it, and the sky chart after the map. Wherever the map appears (Check landing, Find places, Route) it keeps the right-hand column. The map's menu is grouped by what each setting answers: at the chosen moment, for this mission, over the period. The open question, the map layer and the map level go into the shareable link; links from earlier versions still open.

**Check landing** answers for the chosen place: its verdict and its mission clock. **Find dates** lists that place's usable windows. **Find places** covers other places that could hold the same mission, for missions that can move. Sunlight and Earth contact come in **windows**, not days: near the equator every lunar day gives the same window (354–356 h at Apollo 11 through 2027), while at the south pole they run from 37 h to 380 h at IM-2 in the same year, so the unit the page offers is the window.

#### Check landing

- **Verdict** for that landing (full mission, cut short, or can't start), with the reason in plain words taken from the real geometry. For example: "The Sun is 2.0° below the horizon toward the southwest: it's lunar night here", or "terrain there rises to 2.3° and blocks it".
- **Too close to call**: when raising or lowering the terrain by its measured uncertainty changes the verdict (full, cut short, can't start), the verdict says so and gives both outcomes. When only the timing moves, the verdict gives the range.
- **Nearest windows that hold the mission**, earlier and later, when the chosen landing does not.
- **Mission clock**: Sun, Earth and usable-time bands from landing past the end of the mission. One line states how long the landing stays usable and what is lost first; a red line marks that first loss, with a red band where the terrain's uncertainty moves it. If the landing cannot start, the line says when the place next becomes usable. A slider, or a click on the bands, picks a moment: the tiles below count down from it to the next sunset and Earthset, the sky panorama shows it, and the map lights the terrain for it.
- **Sun and Earth over the horizon**: pick any moment in the mission. You get four headline figures (the Sun: sunlit, partly visible, behind terrain or night, with its elevation and the terrain that way; time to the next sunset or sunrise; the same two for Earth) and a panorama of the real terrain horizon all the way round, with the Sun, Earth and their paths. A dashed ring marks a body hidden behind terrain.
- **Where the light falls**: the lit-terrain map at the same moment, either the whole south pole or 96 km around the site.
- **Assumptions and export**: under the verdict, a one-line summary opens into a table of what the answer rests on (observer height, terrain grids, terrain uncertainty, Sun and Earth rules, ephemeris, sampling, app version and data fingerprint). "Download this mission as CSV" saves one row per hour of the mission with the Sun's and Earth's elevation, azimuth, terrain height, margin and uncertainty. The file carries the same assumptions and the scenario link as comment lines, and reads no clock, so the same scenario gives the same bytes on any machine.

#### Find dates

- **Usable windows at this place**: every window of 6 hours or more within 90 days either side, with its opening and closing times, its length against the mission length, what closes it (the Sun or Earth), and whether it holds the mission. Choosing one lands at its first full hour.

#### Find places

- **Search around the selected place**: traces the real horizon at 24 points 5, 10 and 20 km away (240 m LOLA terrain) and checks the same landing at each.
- **Find landing areas**: see "Landing areas for this mission" below.
- **Planned CLPS deliveries to the south pole**: the deliveries NASA lists for the south pole, each with NASA's own words for where it goes. NASA names regions and gives no coordinates, so each row opens the map on the place this tool searches for that region and runs the landing-area analysis there. How each search place was chosen is listed under the table; one of them, on the ridge between Shackleton and de Gerlache, is constructed for this tool.
- **Candidate places for this mission**: every candidate site and region, ranked by whether it has a window that holds the mission in the search span (a week before the chosen date to 30 days after it, plus the mission), with when that window opens and how long it lasts. Choosing a row selects the place and sets the landing to the window's first full hour. Past landing sites are folded below as reference: they are history, not options.

#### Compare sites

- **Sites side by side**: the selected site, the three best other candidate places for this mission and, after "Check points within 20 km", the two best nearby points, on one calendar covering the search span. Each row has a Sun band, an Earth band and a "usable" band (power, and Earth if required). The site's best window is outlined: its first window that holds the mission, or its longest one if none does. A tick marks where a mission landed at that window's opening would end, and a dashed line marks the selected landing. The table gives each window's dates, length, what closes it and whether it holds the mission. Choosing a site there plans a landing at its window's opening. Add a site from the list; the choice goes into the link.
- **All sites, all windows**: every usable window at every site on one calendar, for up to 12 months from the search start. A window that holds the mission is green, and its brighter part is when a landing still fits; a shorter window is amber. Candidate places come first, past landing sites after. It works from the keyboard (left and right between a site's windows, up and down between sites, Enter to plan a landing at that window's opening) and has a table fallback.

#### Route

- **Landing ellipse** (south of 75°S): set its length and width, the approach heading (blank = fly away from the Sun), a slope limit and a Sun-elevation window.
  - **Steeper than the limit**: share of the ellipse's terrain cells above the slope limit, from central differences on LOLA heights. The heights come from a 12 km window of the 40 m mosaic (LDEM_85S_40M) around each catalogue site it covers (13 sites), or the 240 m grid elsewhere. Slopes at 40 m miss boulders and craters smaller than a cell; site certification uses metre-scale data.
  - **Sunlit at touchdown**: one terrain ray per cell toward that cell's Sun (upper limb, eye 2 m, first sample 80 m out as in the shipped horizons) over the 40 m window, then 240 m, then the global grid. It runs once the 240 m grid is loaded (a button loads it); with the 1.2 km map grid as far terrain it missed the 0.5° test limit (0.595°), so that combination is not used.
  - **Approach Sun**: the Sun's elevation and how far its azimuth is from straight behind the lander. It passes when the Sun is in the rear half and inside the window. The default window, 7–20°, is the Apollo planning figure: "the Sun angle should be between 7 and 20 degrees behind the LM" ([NASA, 50 Years Ago: Lunar Landing Sites Selected](https://www.nasa.gov/feature/50-years-ago-lunar-landing-sites-selected)). At the south pole the Sun rarely climbs that high, so expect "too low" there.
  - A north-up view of the ellipse colours each cell by slope class, darkens cells in shadow at touchdown, and draws the approach and Sun directions. The ellipse outline also appears on the map.
- **Surface route** (south of 75°S): "Add waypoints", then tap the map (up to 8; the route starts at the landing site and is drawn on the map).
  - Great-circle legs sampled every 60 m: distance, climb and descent, maximum terrain slope, and the share of the route steeper than a limit you set (default 15°, an example). Heights and slopes use the site's 40 m window where the route is inside it, else 240 m.
  - A height profile with the too-steep stretches in red.
  - Sun and Earth at the site and every waypoint across the mission (each traced on its own 240 m horizon), with sunlit and Earth-visible shares and the longest dark spell.
  - Drive timing: enter a speed and the drive leaves at the moment chosen in "Sun and Earth over the horizon". Each stop gets its arrival day, whether the Sun and Earth are up then, and a white mark on its band. There is no default speed, because no single sourced value fits every vehicle. Moving the moment re-times the drive.
  - Ellipse settings and waypoints go into the shareable link.

Each landing gets one verdict:

1. **Can't start** if, at landing, the Sun is below the terrain (or less of its disk is visible than the power needs require).
2. **Can't start** if Earth contact is required and Earth is hidden at landing.
3. **Cut short** if power or required Earth contact is lost before the mission ends. The verdict names whichever is lost first and how long after landing (interpolated between hourly samples, to within a few minutes), then the other one if it is also lost before the mission ends. If both go in the same hour, power is named first.
4. **Full mission** otherwise.

A landing time outside the data (1 Jan 1969 to 31 Dec 2040) is moved to the nearest time the mission fits, and the page says that it did so. A link that names a place the planner does not have says which, and shows IM-2 instead. Near either end of the data, the search for nearby full-mission dates says how many days of data it had.

Conditions are sampled hourly; window edges are interpolated between samples.

### Explore (students, teachers, the public)

- **Spin the Moon**: a globe you turn by dragging or tapping (tap centres that spot), zoom with pinch, scroll or the +/− buttons, and twist about the view axis with two fingers, Shift-drag, the ↺ ↻ buttons or the [ ] keys; "North up" (or N) undoes the twist and a compass shows where north points. Dragging follows the pointer at any twist.
  - It is lit by the real Sun at the chosen time, shading 7.6 km LOLA terrain, and rings mark where the Sun and Earth are straight overhead.
  - Cast shadows: once the time holds still, every sunlit cell marches toward the Sun with the polar map's rules (upper limb, curvature, bilinear samples, half-cell steps measured along the ray), starting from the deepest dip any horizon can have (8.7°, from the grid's highest and lowest points). The pass takes about 0.3 s in Node and 0.4 s in a desktop browser (not measured on a phone), so it runs in a background worker once the time stops; during Play and scrubbing the globe shows only the terminator.
  - While you rotate, the panel updates on every move for the point under the crosshair, with real terrain: it traces two rays, toward the Sun and toward Earth, so it can say "in shadow" or "behind terrain" and how high the terrain rises that way. It uses the 240 m polar grid south of 75°S once that has loaded (it starts loading when you reach the pole), else the 7.6 km global grid, and names the grid it used.
  - When you stop, it traces the full 720-ray horizon at that point and adds this month's sunlight, the longest night and Earth visibility. The globe also redraws at the screen's full resolution.
  - Play moves the day/night line across the globe.
  - "Compare this point" adds the point to the site cards; "Plan a landing here" opens it in Check landing.
  - "Always, sometimes, never" comes from the largest libration in our Horizons data (10.47° over 1969–2040) plus the observer's parallax (0.28°). Earth's centre is always up within 79.25° of the Earth-facing centre of the Moon and never up beyond 100.75°; the test re-derives the bound from the data.
  - The globe is drawn on a plain 2D canvas, so it needs no WebGL or third-party library.
- Pick up to four sites, or click the map to drop a point.
- Play or scrub through a month on the lit-terrain map, and watch the light sweep around the pole.
- Each site gets a card in plain words: Sun up or dark right now, with the time to the next sunrise or sunset; the same for Earth; sunlight this month; the longest night; whether Earth is always in view, sometimes, or never rises; and a small horizon panorama. Every card uses the same −5° to 15° scale, so sites compare by eye.
- **Why a short move changes everything**: pick a polar site and the page finds the lowest ground within 10 km on the 240 m LOLA grid. It then draws both skies on one scale at the chosen time and says in words why one is lit and the other dark. The low point is computed from the terrain, not a named or proposed site, and the panel says so.
- Four short explainers say why the pole is so hard: the Sun skims the horizon, a day lasts a month, Earth hangs almost still, and there's no air to soften the shadows.

### Field (analog crews, training)

A single reading on the device's own clock for one site: how long until sunlight or Earth contact is lost, which goes first, when the next one follows, and whether a task of a given length fits. If the terrain's uncertainty moves the answer, it gives the range, and a task that fits only on the terrain as mapped is called too close to call.

- The reading refreshes every minute and shows its age and the time it was computed.
- A reading older than 90 seconds is marked **STALE** in words, with a dashed border and struck-through figures, following NASA-STD-3001 Vol 2 [V2 10020] (show when data are stale, missing or unknown). "Hold this reading" freezes it, so the stale state can be shown in training.
- A site with no fine terrain (horizon from the 1.9 km or 7.6 km grid) carries a low-confidence note.
- It is a training and planning aid. It has not been tested with crews and is not flight software.

### The lit-terrain map

For every cell of a south-polar grid, the map marches along the Sun's local azimuth and compares the terrain's elevation angle, with curvature included, against the Sun's upper limb. It uses one real Sun direction from the Horizons data. Sunlit ground is drawn warm and shaded by the real Sun; shadow is drawn dim. The whole pole (1.2 km grid) redraws in about 0.17 s, and the 96 km site view (240 m grid) in about 0.2 s.

The map has three levels: the whole south pole (1.2 km), 96 km around the selected place (240 m), and a 16 km close-up on the 40 m terrain. The 40 m mosaic (`LDEM_85S_40M`, a square about 303 km across centred on the pole) ships as 225 tiles of about 0.5 MB, and the page fetches only the tiles around the place: four for most places. In the close-up the march runs on the 40 m terrain for about 8 km around the view, and on the 240 m terrain beyond, so distant ridges still cast their shadows. Outside the 40 m mosaic the close-up falls back to the 240 m view and says so. Clicking the map moves the selected place there, which recentres the two closer levels.

### Landing areas for this mission (one combined map layer)

The Plan map has a second setting, "Landing areas for this mission". It asks, for every cell of the map and without reference to any chosen site: is there a window in the search span that holds this mission, and is the ground fit to land on?

- **Green**: a window of at least the mission length (sunlight, and Earth in view if required). **Bright green** is a landing area: every cell within the landing footprint (half the ellipse's longer side, 500 m by default) is green, no steeper than the ellipse's slope limit (default 10°, an example), and not a close call.
- **Amber**: usable, but never for as long as the mission (brighter is longer). **Dark**: never usable in the span.
- **Red stripes**: too steep. **White dots**: too close to call, the class changes when the terrain is raised or lowered by its measured uncertainty (9.4 m on the 240 m grid, which both map views analyse).
- **Every polar catalogue place** as a dot coloured by whether its own windows hold the mission.

Connected landing areas are found by image analysis of the result (a footprint-sized erosion, then connected components), and six are lettered on the map and listed (the largest, and always the one nearest the selected place) with their size, where they are, and when their window opens. Choosing one plans a landing there at that opening; the verdict then traces the finer horizon at that point. For a 10-day mission with Earth contact from 4 Nov 2027, the whole-pole view finds 410 areas; the largest (32 km², near 75.5°S 15°E) opens about 5 Nov 04:00, and the verdict there is a full mission.

This is analysis of the measured LOLA heights. Nothing is sharpened, interpolated beyond bilinear sampling, or generated: a flat patch here means flat at the grid's scale (slopes are measured across two cells, 480 m), which says nothing about boulders or craters smaller than that.

Three more settings colour the same layer by a statistic over the period: the share of the time in sunlight, the share with Earth in view, and the mean height of the Sun's centre while the ground is lit. Each listed landing area also carries these for its best point: sunlit share, longest night, Earth-contact share, longest outage and Sun height. The areas can be listed by size, longest window, sunlight or Earth contact. The period is the search span every 4 hours, or a year from its start every 12 hours.

On sunlight efficiency: the tool gives geometry, not watts. An upright array that turns to the Sun collects in proportion to the sunlit share. A level array collects in proportion to the sine of the Sun's height, which at the pole is a few percent. Turning either into power needs the array's own figures.

"CLPS regions compared", under Compare sites, runs the analysis over each region NASA names and lists the largest landing area in each with the same statistics.

A third setting, "Where this landing holds the mission", asks the narrower question: for a landing at the chosen time, at every cell, do sunlight and Earth contact last from that moment to the mission's end? Green holds; amber is usable at landing but lost early; dark is not usable at landing. It covers only the mission's days, and a cell that has lost the Sun or Earth is not marched again, so it takes under a second (0.2 to 0.9 s in a desktop browser on 8 workers).

Method and cost: the shadow march runs toward the Sun and toward Earth every 4 hours across the span, in time order, keeping each cell's longest run. Both views analyse the 240 m terrain. The site view takes every cell of a 96 km window. The whole-pole view takes the 240 m cell nearest each point of a 1.2 km lattice, so it is the same analysis sampled every 1.2 km: an area it lists is a patch of neighbouring sample points, and the site view shows what lies between them. Two things keep it quick. The march jumps over blocks of terrain too low to reach the ray, using the highest point of each block at six block sizes; a test confirms on real terrain that this changes no cell. And the map's cells are shared between web workers, each of which runs every time step for its own share and keeps its own results, so nothing waits on the page between steps: up to eight where the device reports 8 GB of memory or more, two where it reports 4 GB or less, four where it does not say (each worker holds its own 29 MB copy of the terrain). Where workers are not available the page computes. Measured on the whole-pole layer (47 days, Sun and Earth), with the page's own worker code driven from Node threads: 62 s on one thread, 15.5 s on four workers, 8.8 s on eight, and no gain beyond that (`node tests/bench_workers.mjs`). In a desktop browser on eight workers the whole pole took 9.7 s, the 96 km view 3.3 s and the 40 m close-up 6.6 s. The note under the map says how long the last run took and on how many workers. Limits: any part of the Sun counts as power, whatever the power setting; a gap shorter than 4 hours is missed; the whole-pole view needs the 29 MB terrain file, as the site view does.

## Rebuild the data

One command rebuilds everything under `web/data` from the raw inputs and checks every file against `web/data/manifest.json`:

```bash
sh pipeline/rebuild.sh
```

It runs `fetch_raw.sh` (download if missing, verify md5), `fetch_ephem.py 1969 2040` (packs the cached Horizons responses), `build_web_data.mjs`, `build_crops40.mjs`, `build_tiles40.mjs`, `build_uncertainty.mjs` and `manifest.mjs --check`. On 2026-11-15 it reproduced all 350 shipped files byte for byte (data fingerprint then `929e998ba03b`; version 44 dropped two date fields from the site catalogue, giving `e76ce2301c54`) on the development machine; it has not been run on a second machine. After a deliberate data change, `node pipeline/manifest.mjs` writes the new manifest.

```bash
node --test tests/*.test.mjs
```

`fetch_raw.sh` downloads the LOLA DEMs (NASA PDS, about 177 MB) and the PGDA illumination maps (about 102 MB) into `data/raw/`, then checks their md5. `tests/fetch_oracle.mjs` refetches the Horizons fixtures; they are already committed.

## Run it

It's a static site with no build step:

```bash
python3 -m http.server 8765 --directory web
```

Then open http://127.0.0.1:8765/. Any static host (for example GitHub Pages) can serve `web/` as it is.

## Data and method

| What | Source | How it is used |
|---|---|---|
| Sun and Earth directions | [JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/). Target Moon (301), observer geocentre, quantities 14/15/19/20 (sub-Earth point, sub-solar point, ranges), hourly 1969–2040, DE441, `MOON_ME` frame | `pipeline/fetch_ephem.py` packs one float32 file per year (`web/data/ephem/`, 15 MB in total, loaded lazily). The browser blends hourly unit vectors and subtracts the site position (Earth parallax is about 1°) to get topocentric azimuth and elevation. |
| Terrain | LRO LOLA PDS: `LDEM_85S_40M`, `LDEM_75S_240M`, `LDEM_16` (sizes match the PDS files; md5 in `data/CHECKSUMS.md5`) | The horizon is traced along 720 great-circle rays to 300 km, from an eye 2 m above the ground, with exact spherical geometry. There is no atmosphere, so no refraction term. Curated sites use the 40 m → 240 m → 16 px/° stack, precomputed by `pipeline/build_web_data.mjs`. Custom points are traced live in the browser on the 240 m grid (south of 75°S) or a 4 px/° global grid. |
| Site coordinates | 32 sites, each cited in `pipeline/sites.json`. These include NASA's 9 Artemis III candidate regions from the USGS outline release (McClernan 2024, doi:10.5066/P1MEQ6UK): the centre of each region is the mean of its outline corners in south-polar stereographic coordinates, and the map draws each outline. They also include Luna 25's likely impact site (NASA/LRO) and six Chang'e-7 candidate sites from a peer-reviewed site-selection study (*Remote Sensing* 17:1121, 2025; CNSA has not announced a final site). The 16 original sites: (`source`, `source_url`): LROC NAC-derived positions for Apollo 11–17, IM-1, IM-2, Blue Ghost M1, HAKUTO-R M2 (impact site), Chandrayaan-3 and Chang'e-3/4/5/6; JAXA for SLIM; NSSDCA, operator and agency pages for landing times | Some landing times are known only to the minute; the notes in `sites.json` say which. |

**Visibility rules:**
- The Sun counts as **up** while any part of its disk clears the terrain (upper limb above the horizon).
- Earth counts as **in view** while its centre clears the terrain.
- The "% of disk" figure is the visible fraction of the solar disk, which drives solar-array output.

## Accuracy checks (all on real data, run with `node --test tests/*.test.mjs`)

- **Ephemeris vs Horizons topocentric tables** (`tests/ephem_oracle.test.mjs`).
  - Our Sun and Earth az/el were compared against Horizons' own topocentric, airless, apparent az/el. The comparison covers 6 lunar test points and 912 epochs per body over 1969–2040, run twice: on the hour (stored rows) and at half past (interpolated between rows; same result).
  - Worst error: 0.0002° for the Sun and 0.006° for Earth. The Earth residual is annual stellar aberration (v/c ≈ 0.0057°), which enters the geocentric sub-Earth point. It is 0.6% of Earth's angular radius.
- **DEM orientation** (`tests/dem_orientation.test.mjs`).
  - The polar stereographic grids were compared with the independent global cylindrical grid. The chosen orientation gives a 63 m RMS difference; each of the other 7 orientations gives 2.4 km or more.
  - The 40 m and 240 m grids agree to 3.7 m RMS.
- **Long-term Sun and Earth visibility vs the LOLA team's polar maps** (`tests/pgda_illumination.test.mjs`).
  - Reference: Mazarico et al. 2011, Icarus 211:1066, through [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) `AVGVISIB_85S_060M_201608` and its `_EARTH` counterpart, averaged hourly over an 18.6-year cycle.
  - Method: 40 fixed points (85.5–89.5°S, every 45° of longitude); pass criteria set before the first run: r > 0.9 and median |difference| < 0.05.

    | Terrain stack | Sun r | Sun median diff | Earth r | Earth median diff |
    |---|---|---|---|---|
    | Curated sites (40 m → 240 m → 16 px/°) | 0.994 | 0.014 | 0.984 | 0.000 |
    | Custom points in the browser (240 m → 4 px/°) | 0.994 | 0.009 | 0.980 | 0.000 |

  - One Earth outlier at 86.5°S 135°E: ours 0.32, reference 0.12, for both stacks. Cause: the point lies on a sharp edge of the reference map. On a ring 60 m around it the reference itself runs from 0.01 to 0.33, and one 60 m cell away it reads 0.33, the same as ours. A ridge 160 m from the point, rising to 2.4°, stands at the edge of Earth's path there (azimuth 217–233°, never more than 4.5° up), so a shift of one reference cell decides whether Earth clears it. Our own value moves between 0.24 and 0.32 within 120 m. Script and output: `audit/lunar-navigator/pgda_outlier.mjs`.
  - The reference map stops at 82.9°S, so custom points at 75–85°S are not covered by this check.
- **Apollo 11 replay**: at touchdown (1969-07-20 20:17:40 UTC, NSSDCA) the app puts the Sun at 10.70° elevation. Horizons' own topocentric table brackets it at 10.55° (20:00) and 11.06° (21:00).
- **Calendar vs detail view** (`tests/calendar_consistency.test.mjs`): for every cut-short landing over 120 days at IM-2 (Mons Mouton) and Apollo 11, the calendar's hourly "power lost after" agrees with the next sunset found from the detail view's 10-minute series, to within one hourly sample. 82 landings were checked; the worst difference was 60 min.
- **Lit-terrain map vs the horizon tracer** (`tests/shadow.test.mjs`).
  - On the same grid, the shadow march and the horizon tracer agree on 40 polar points × 100 times:
    - whole-pole view (1.2 km): 99.8%, worst disagreement 0.088° from the threshold;
    - site view (240 m): 100.0%, worst 0.031°.
  - The map's resolution is printed in its legend, because the verdict uses the finer horizon at the exact site and the two can differ at a shadow edge.
  - Pass criteria were fixed before the first run: ≥ 95% agreement, and every disagreement within 0.5°.
  - Three causes of disagreement were found and fixed on the way:
    - nearest-cell sampling, replaced with interpolation;
    - steps too coarse near the observer;
    - a different start distance for counting terrain (a convention).
- **Globe** (`tests/globe.test.mjs`): the orthographic projection round-trips, and its centre pixel is the view centre. At the Horizons sub-solar point the Sun is overhead and the globe is lit; at the antipode it is dark. The libration bound covers every sub-Earth point from 1969 to 2040. This test also found a bug: the elevation came out as NaN with the Sun exactly overhead, which is now fixed in `ephem.js`. The globe's cast shadows agree with the horizon tracer on the same grid for 99.91% of 36,917 (cell, time) pairs over 4,595 cells from 88°S to 88°N (166 of them poleward of 75°), with every disagreement within 0.48° of the threshold (criteria fixed before the first run: at least 95%, within 0.5°). The first runs failed and found four real faults, each fixed at its cause: the globe called a cell dark when its 7.6 km patch faced away from the Sun even though the point itself saw the Sun; it skipped high points that see the Sun below the flat horizon; near the poles, where grid cells are about 1 km wide east-west, its 3.8 km steps jumped over terrain; and the shared global-grid sampler (`dem.js`) did not blend across the 0° meridian in its last half pixel. Fixing the sampler changes none of the 32 shipped site horizons (recomputed and compared). The live two-ray readout gives the same terrain elevation as the full 720-ray horizon at the bin azimuths (within 0.001°), at four real points including the south pole.
- **Landing ellipse and route** (`tests/landing_route.test.mjs`):
  - The 13 shipped 40 m windows are exact crops of LDEM_85S_40M, and sample identically to the full mosaic.
  - The touchdown sunlight ray (40 m window, then 240 m, then 4 px/°) against the shipped site horizons (full 40 m mosaic, 240 m, 16 px/°) at 13 sites × 12 times: worst horizon difference 0.216°, and all 148 lit/unlit calls with a margin above 0.5° agree. Criterion fixed before the run: within 0.5°. The first run failed at 2.8°: the browser ray started 40 m out instead of the shipped 80 m; fixed in `landing.js`.
  - Route legs match the haversine distance; profile heights equal the 240 m grid's own samples.
  - Synthetic (labelled): a plane rising exactly 7 m per 40 m cell gives its slope back within 0.02°; ellipse cell counts match πab within 5% and the long axis follows the heading; the Sun-behind rule.
  - Globe twist geometry: the view axes stay orthonormal, the centre stays put, and north appears at screen direction (sin r, cos r).
- **First closure** (`tests/first_closure.test.mjs`, real data): the four landings where an audit found the verdict naming the wrong constraint now name Earth first, with the audit's hours. Over 120 landing days at IM-2, every cut-short verdict matches an independent search for the first hour either body is lost (37 landings, 36 of them closed first by Earth).
- **Terrain uncertainty** (`pipeline/build_uncertainty.mjs`, `tests/export.test.mjs`): each grid is traced alone at catalogue sites and compared, ray by ray, with the same site's shipped horizon from finer terrain. The difference is turned into a height at the range of the blocking terrain. 90th percentiles: 9.4 m for the 240 m grid (12 sites, 8,640 rays, against 40 m), 154.5 m for the 16 px/° grid and 1,226 m for the 4 px/° grid (17 polar sites, 12,240 rays each). The 40 m grid has no finer grid here to be compared with: its level, 1.6 m, is the 240 m level scaled by cell size, an assumption, not a measurement. For scale, the LOLA team reports a median crossover residual of 0.48 m after adjustment (Smith et al. 2017, Icarus 283:70). With these levels, 4.5% of 11,680 landings (32 sites × 365 days of 2027, 10 days, Earth required) are too close to call.
- **Export and data fingerprint** (`tests/export.test.mjs`): the CSV for IM-2 on 2027-03-16 16:00 UT loses Earth at hour 164 and power at hour 230, as in the audit; two exports are identical; the shipped data match the manifest; the page and the code carry one version number.
- **Field reading and guided comparison** (`tests/views.test.mjs`): the reading's first closure, task fit, close call and stale state (synthetic, labelled); the lowest ground within 10 km of IM-2 on the real 240 m grid.
- **Landing-area layer** (`tests/suit.test.mjs`): around IM-2 on the real 240 m grid over 47 days, each cell's class (a window that holds the mission, usable for less, never usable) matches the horizon tracer on the same grid and time samples at 21 of 21 cells it does not flag as close calls (15 flagged), and the longest run differs by at most one sample. Criterion fixed before the run: at least 90%. Landing-area grouping is checked on a synthetic grid (labelled). The Sun shadow test is unchanged by the generalised march (99.8% and 100%). The march that skips blocks of low terrain gives exactly the same cells as marching every sample, on the whole 1.2 km grid and two 240 m windows, for the Sun and Earth on five dates. The whole-pole view's choice of the 240 m cell nearest each 1.2 km map cell is checked over the whole map (worst offset half a cell).
- **40 m close-up** (`tests/suit.test.mjs`): a window assembled from the tiles equals the same window of the raw LOLA mosaic, across tile edges. A march handed from a window to the grid around it gives exactly the same cells as the whole grid (240 m terrain, Sun and Earth, five dates). On the real 40 m tiles with 240 m terrain beyond, each cell's class matches the horizon tracer (40 m, then 240 m, then the global grid) on 31 of 31 firm cells around IM-2 and 23 of 23 on Shackleton's rim, against a criterion of 90% fixed before the first run. Around IM-2 the longest run differed by up to 10 four-hour samples at one cell without changing its class.
- **Long-term shares** (`tests/layer_shares.test.mjs`): the layer's sunlight and Earth-contact shares over 18.6 years, at the 240 m cells nearest 40 fixed points, against the LOLA team's average-visibility maps. Sun: r = 0.992, median difference 0.003. Earth: r = 0.995, median difference 0.044, with the layer 0.034 lower on average because it counts Earth by its centre and the maps by any part of its disc. Criteria (r above 0.9, median below 0.05) were fixed before the first run.
- **Workers** (`tests/suit.test.mjs`): the page's own worker file, run in three Node threads, gives the serial layer cell for cell on every terrain variant, in both layer modes, and stops when told to.
- **Precision** (`node tests/precision_sweep.mjs`, real data, not part of the test run):
  - Time step: sampling every 4 hours gives the same class as every hour for 99.5 to 99.7% of cells at three places, and for 99.8 to 100% of the cells not flagged too close to call. A window's length differs by a median of 3 h and its opening by 1 to 2 h.
  - Map level: the 240 m view gives the class the 40 m close-up gives at 90.7% of points around IM-2 and 95.0% on Shackleton's rim, and at 99.7% and 99.9% of the points neither level flags too close to call.
  - Verdict: over 442 cut-short landings at 17 polar sites, the first failing hourly sample is a mean of 32 minutes late. The verdict now interpolates between the two hourly samples around the loss, and is then off by a median of 0.7 minutes (worst 7.2) against a one-minute search.
- **Formal proofs** (`formal/Layer.lean`, checked by `tests/formal.test.mjs` where Lean 4 is installed): for a model that restates the layer's per-cell logic, Lean proves that
  - the layer keeps the longest run of usable samples, and from a landing keeps the run that starts at the landing;
  - a cell that has lost the Sun or Earth cannot change again, which is why it is safe to stop marching it;
  - a run classed as holding the mission spans at least the mission's length, and one sample fewer would not;
  - sharing cells between workers and merging the results returns every cell to its place, with no cell given to two workers, and equals the layer computed in one piece;
  - jumping over a terrain block in the shadow march is sound, and a bilinear sample never exceeds a block's highest point.

  The proofs use no `sorry` and only Lean's standard axioms. They are about the model, which was written by hand from the JavaScript; the tests above are what tie the two together.
- **Moon Trek** (`tests/moontrek.test.mjs`): our Sun azimuth and elevation against NASA Moon Trek's Sun Angle service at three candidate sites (Nobile Rim 2, Mons Mouton Plateau, Shackleton-L), hourly for 14 days from 5 Nov 2027. Worst separation 0.0007° over 1,011 samples; the criterion, fixed before the first run, was 0.05°. That service has no terrain and gives the Sun only, so this checks the Sun's direction with a second implementation, not the horizons. Moon Trek's terrain lighting tool mails its result to an address and was not run.
- **Windows** (`tests/windows.test.mjs`): interpolated edges and which constraint opens and closes a window (synthetic, labelled); on real data, Apollo 11's 2027 windows span 354–356 h and IM-2's 37–380 h.
- **Window and verdict logic**: unit tests (synthetic inputs, labelled).

`docs/VALIDATION.md` lists every check with its reference, its residual and what is still unchecked.

## Limits

- Terrain detail is limited by the DEM. The south pole is resolved at 40 m near the pole and 240 m to 75°S. Elsewhere it is 1.9 km for curated sites and 7.6 km for custom points. Small boulders and crater walls below that scale are not modelled.
- Hourly ephemeris samples are interpolated, so event times carry an error of a few minutes. The windows are sampled every 5–120 min depending on window length.
- Dates are limited to the fetched span, 1969-01-01 to 2040-12-31.
- **Terrain uncertainty is a resolution-sensitivity measure**, not an absolute error: it says how much a horizon moves when finer terrain replaces coarser. It does not include errors shared by all LOLA grids, and the 40 m level is scaled, not measured. Away from the south pole the levels come from polar terrain and may not fit smoother or rougher ground.
- **No user testing.** No planner, teacher, student or crew member has used any view under observation. The test protocols are in `audit/lunar-navigator/AUDIT.md` §4.
- **Sunlight is a power input and Earth is line of sight.** There is no array, thermal, antenna, ground-station or relay model, so the app gives no watts and no link margin.
- Earth visibility is geometric: it does not model antenna patterns, Deep Space Network station availability, or relay satellites.
- **Routes** are straight great-circle legs between the waypoints you choose. The app does no path-finding and assumes constant speed with no stops. Slopes come from the 40 m window near catalogue sites and 240 m elsewhere, so obstacles smaller than a cell are invisible.
- **The statistics layers** count the Sun as up when any part of its disc shows and Earth by its centre, on the terrain as mapped. The exact share of the Sun's disc is computed only at the selected site. The year-long period samples every 12 hours, so its windows and nights are known to about half a day.
- **The CLPS search places are not landing sites.** NASA has published regions only; the tool searches the region and reports what it finds.
- **The 40 m close-up** covers 85–90°S only. Its close calls use a terrain uncertainty of 1.6 m that is scaled from the 240 m level by cell size, not measured. At 40 m far more ground counts as too steep, because slope is then measured across 80 m.
- **Landing ellipses** measure slope at 40 m (240 m away from the 13 windows), not at the metre scale used to certify a site. Sunlight at touchdown is computed only once the 240 m grid is loaded (decision D3 in `docs/decisions.md`).
- **Globe gestures** were checked in Chromium with emulated touch: a two-finger 30° twist matches two 15° button twists to 1 pixel in 97,969. They have not been tried on a physical phone.
- **Artemis III region outlines vs cited landing points.** IM-2's LROC landing point falls inside the Mons Mouton Plateau region. Chang'e-7's de Gerlache-TR candidate falls inside de Gerlache Rim 2. IM-1, which landed near Malapert A at 80°S, falls in none, as expected.
- **Chang'e-7 candidates vs the site-selection paper (observation, not a pass/fail check).** At all six candidates, our long-term sunlight is higher than the paper's average illumination: by 3–6 points at four sites, 11 at Shackleton-L and 19 at de Gerlache-TR. The figures aren't like for like. The paper averages over each landing region, including its small shadowed craters. We compute a single point, 2 m above the ground, over 18.6 years. The paper's height and averaging period weren't stated in the text we read.
- **Not in the catalogue**:
  - Chandrayaan-4 (ISRO site MM-4, Mons Mouton): reported in the news, but no official publication with coordinates was found.
  - Future CLPS landers (IM-3, Blue Ghost Mission 2, Griffin Mission 1, APEX 1.0): no published landing coordinates found.
  - Published "peak of light" points (Shackleton connecting ridge, Malapert, Nobile rim): the coordinates were not available in open-access text.
  - Any of these can be evaluated by clicking the polar map or typing coordinates.

## Data credits and terms

| Data | Credit | Terms as read on 2026-11-14 |
|---|---|---|
| Sun and Earth ephemeris | NASA/JPL Solar System Dynamics, Horizons (DE441). Data retrieved 2026-11-15 (Pasadena time): all 72 years and the 24 test tables were fetched again that day; the yearly files packed byte for byte the same as those shipped. https://ssd.jpl.nasa.gov | JPL SSD asks for the credit "NASA/JPL Solar System Dynamics" with the retrieval date. No use restriction was found on the pages read. |
| Terrain | LRO LOLA gridded data records, PDS data set LRO-L-LOLA-4-GDR-V1.0, NASA PDS Geosciences Node; Smith et al. 2017, Icarus 283:70–91 | PDS Geosciences: archives are "freely available for downloading"; cite as published research. No dataset DOI for the LDEM products was confirmed. |
| Illumination maps (validation only, not shipped) | Mazarico et al. 2011, Icarus 211:1066–1081, via PGDA product 69 | PGDA: "Please cite the Mazarico et al. (2011) reference". |
| Sun angles (validation only; three raw responses in `tests/fixtures/moontrek/`) | NASA Solar System Treks, Moon Trek Sun Angle service (JPL). Retrieved 2026-11-14. https://trek.nasa.gov/moon/ | The portal's home page links only NASA's privacy notice and the responses state no terms (checked 2026-11-14). Treated as NASA material used with credit; that reading is an inference. |
| Planned CLPS deliveries (`pipeline/clps.json`) | NASA, CLPS deliveries page (dated 2026-10-23) and release 26-046 (2026-05-26). Read 2026-11-15. | NASA material, used with credit. Regions only: NASA gives no coordinates. |
| Crater positions used to construct one search point | IAU Gazetteer of Planetary Nomenclature (USGS), features 5450 and 1439. Read 2026-11-15. | Public nomenclature data, cited. |
| Artemis III region outlines | McClernan 2024, USGS, doi:10.5066/P1MEQ6UK | CC0 1.0. |
| Site coordinates | one citation per site in `pipeline/sites.json` | as cited |

The code is licensed under the **Apache License 2.0** (see `LICENSE`). Copyright 2026 Aaron Storey. The data files under `web/data` and `tests/fixtures` derive from the sources above and stay under those sources' terms.

## Repository layout

- `pipeline/fetch_ephem.py`: Horizons fetch and packing. Raw responses are cached in `data/raw/horizons/`.
- `pipeline/build_web_data.mjs`: browser DEMs and per-site horizons.
- `pipeline/build_crops40.mjs`: the 12 km windows of 40 m terrain around catalogue sites, for the landing ellipse.
- `pipeline/build_tiles40.mjs`: the whole 40 m mosaic as 225 tiles, for the map's close-up level.
- `formal/Layer.lean`: Lean 4 proofs about the landing layer's bookkeeping (see "Accuracy checks").
- `tests/bench_suit.mjs`, `tests/bench_workers.mjs`, `tests/precision_sweep.mjs`: benchmarks and precision sweeps on real data; not part of the test run.
- `pipeline/build_uncertainty.mjs`: terrain-horizon uncertainty levels. `pipeline/manifest.mjs`: the data fingerprint. `pipeline/rebuild.sh`: all of the above in one command, verified.
- `docs/PLAN.md`: the plan this work follows. `docs/VALIDATION.md`: every check and what is unchecked. `audit/lunar-navigator/`: the audit against the Space Apps brief and its scripts.
- `docs/decisions.md`: design decisions with their rationale and the options rejected.
- `web/`: the app.
  - `dem.js`, `horizon.js`, `ephem.js`, `windows.js`, `shadow.js` and `globe-math.js`: the physics and geometry, the same modules the pipeline and tests use.
  - `globe.js`: the rotatable globe; `globe-worker.js` bakes its cast shadows in the background. `sky.js`: the horizon panoramas.
  - `core.js`: shared data and helpers.
  - `suit.js`: the combined landing layer.
  - `export.js`: the assumptions table and the CSV export. `field.js`: the field view. `pair.js`: the guided two-point comparison.
  - `planner.js` and `explore.js`: the two modes. `mission.js`: the planner's landing-ellipse and surface-route panels; `landing.js` and `route.js`: their geometry.
  - `litmap.js`: the lit-terrain map.
  - `app.js`: start-up and shareable links.
- `tests/`: `node --test tests/*.test.mjs`. `tests/fetch_oracle.mjs` refetches the Horizons fixtures and `tests/fetch_moontrek.mjs` the Moon Trek ones.
- `data/raw/`: LOLA and PGDA inputs (not committed; md5 in `data/CHECKSUMS.md5`).
