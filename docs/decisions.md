# Decisions

Each entry: what was decided, why, and what was rejected. Newest last. Aaron asked on 2026-11-14 for decisions to be made with a recommendation and rationale and recorded here, rather than asked one by one.

## 2026-11-14

**D1. Commit locally in two commits; publishing still needs Aaron's yes.**
The globe-shadow batch is committed first, rebuilt from its saved patch so it stays a rollback point of its own. The UI cleanup and the planning features are committed second: they edit the same lines of the same files and were never snapshotted apart. A local commit is undone with `git reset --soft HEAD~1`.
Pushing to GitHub and redeploying the public site waits for an explicit yes. The project's standing rule is to ask before each push, and the site is public.
Rejected: one commit for all three batches, because it would leave no rollback point for the globe work alone.

**D2. "Change axis" is a free twist, not a spinning-Moon animation.**
The twist works with two fingers, Shift-drag, ↺ ↻ or `[` `]`, and "North up" (N) resets it. It gives the one degree of freedom the globe lacked: rolling the view so a site can be studied from any side.
Rejected: animating the Moon turning on its axis. Play already sweeps the sunlight across the globe, and a globe that keeps turning works against inspecting a fixed spot.

**D3. Sunlit-at-touchdown runs only once the 240 m far terrain is loaded.**
With the 40 m window, then 240 m, then the 4 px/° global grid, the result matches the shipped horizons to 0.216°, and 148 of 148 calls agree, against a limit fixed at 0.5°.
Rejected: the 1.2 km map grid as far terrain. It measured 0.595°, outside that limit, even though it would have saved the 29 MB download.

**D4. Approach lighting window 7–20°, "behind" = the rear half.**
The window is the Apollo planning rule: "the Sun angle should be between 7 and 20 degrees behind the LM" ([NASA, 50 Years Ago: Lunar Landing Sites Selected](https://www.nasa.gov/feature/50-years-ago-lunar-landing-sites-selected)). The source gives no angular tolerance for "behind", so the app counts any azimuth within 90° of straight behind and shows the actual offset.
A blank heading means "fly away from the Sun", and the tile says that its "behind" result is then true by construction.

**D5. Slope limits default to 10° (lander) and 15° (route), labelled as examples.**
No single sourced limit fits every vehicle, so both are inputs. The app says they are examples, as it already does for the mission defaults.

**D6. 40 m terrain ships as 12 km windows around the 13 catalogue sites it covers (2.3 MB), not the whole mosaic (115 MB).**
Custom points and sites outside the mosaic use 240 m, and the panel says that this is coarse for an ellipse.

**D7. Route timing: a speed input that is blank by default; the drive leaves at the moment chosen in "Sun and Earth over the horizon".**
With no sourced rover speed, a default number would be invented. Reusing the existing moment slider for the departure adds no new control. When a speed is set, each waypoint gets an arrival time, and the panel shows the Sun and Earth on arrival.

**D8. The globe's arrow nudge buttons were removed; + and − stay.**
Tap-to-centre is the single-pointer alternative to dragging (WCAG 2.5.7), and the arrow keys still work on the focused globe. The zoom buttons are the single-pointer alternative to pinch (WCAG 2.5.1).

**D9. No web fonts, and blue stays reserved for Earth.**
The UI skill suggested Exo/Roboto Mono and a blue accent. The fonts are a third-party request for little gain. A blue call-to-action would read as Earth data.

**D10. A route belongs to its landing site: changing the site clears the waypoints.**
Otherwise the waypoints from one site would silently become legs from another.

**D11. Two-finger gestures measure from the moment the second finger lands.**
Before, the starting angle and distance were taken from the first move event, after one finger had already moved. A 30° twist then came out short, with some stray zoom: 41% of globe pixels differed from the same twist done with the buttons. With the fix, 1 pixel in 97,969 differs, by 2 levels (float rounding).

**D12. "NASA worthy" means a traceable screening and teaching tool, not flight software; the work is ordered in `docs/PLAN.md`.**
Five tests set the bar: correct, honest about limits, traceable, validated, releasable. The verdict fix (T1) and the date-span fix (T2) come first, because exports and user tests built on a wrong verdict would have to be redone.
Rejected: aiming at mission-operations use (it needs certified data products and engineering inputs the project lacks), and starting with new views (T4–T6) before the verdict is right.

**D13. The fetched challenge pages, standards and papers stay out of the repository.**
`audit/lunar-navigator/sources/` is git-ignored. The audit's source index gives each URL and retrieval date. The repository is public, and third-party pages and author manuscripts are not ours to republish.

**D14. A cut-short verdict names the first loss, then the other; on a tie in the same hour, power first.**
This replaces "the first rule failed in a fixed order", which named power even when Earth was lost days earlier (36 of 37 cut-short landings at IM-2 in early 2027).

**D15. Terrain uncertainty is measured, per ray, as a height error at the range of the blocking terrain.**
Rejected: one angle per site. Measured differences between grids ran from 0.00° to 3° around a single horizon, because near terrain moves far more than a distant ridge; a single figure would be useless at the pole, where the Sun stays within 1.5° of the horizon. The height-equivalent error is steady with range (240 m grid: 8.4 m at the 90th percentile under 5 km, 12.2 m beyond), so one height per grid, seen at each ray's range, fits the data.
The level is the 90th percentile. The 40 m grid has nothing finer to be compared with here, so its level is the 240 m level scaled by cell size; the README and the validation report say that this is an assumption.

**D16. "Too close to call" means the verdict class changes (full, cut short, can't start) when the terrain is raised or lowered by its uncertainty.**
A change of reason inside the same class is not flagged. A change of timing only is reported as a range.

**D17. Data files are requested with their own hash from the manifest.**
While testing, the browser paired new code with a cached horizon file that lacked the new fields. The manifest is fetched fresh, and every other data URL carries its file's hash, so only changed files are downloaded again.

**D18. The guided comparison uses a computed low point, not a cited crater floor.**
No crater-floor coordinate with a citable source is in the catalogue. The lowest cell of the 240 m grid within 10 km is real data, reproducible, and labelled on the page as computed and not a named site.
Rejected: typing in a crater coordinate from memory, which the project's sourcing rule forbids.

**D19. The field view is a third tab on the device's clock, with a 90-second stale limit and a hold button.**
It refreshes every minute; 90 seconds is one missed refresh plus margin. The hold button exists so the stale state can be produced on demand in training and in the audit's interruption test.
Rejected: reusing Explore's time slider, where "right now" means a chosen moment.

**D20. No licence file was added, and nothing was pushed.**
Choosing a licence is the author's legal act; the plan recommends Apache-2.0. The public site still serves the older build until Aaron says yes to a push.

**D21. No comparison with Moon Trek was made.**
No scriptable interface to its lighting tools was found, so a comparison would be manual work in its web page. The validation report lists it as not done.

**D22. One combined map layer, "Best places to land", instead of four separate ones.**
Aaron asked for the layers to be condensed into a best-fit view with all landing sites on it. Usable time from landing, Earth visibility, slope and the uncertainty edge are folded into one class per cell, and every polar catalogue site is drawn on it in its own verdict colour. The map keeps one other setting, sunlight at the chosen moment.
Rejected: four toggles. Each answers part of the question, and the planner would have to overlay them mentally.

**D23. The layer shows usable time from landing, not the share of the mission that is lit.**
That is what the verdict measures, so the map and the verdict agree in kind. "Good ground" also needs all eight neighbours good, so a lone cell is not offered as a landing point.
The layer samples every 3 hours, coarse first. Hourly sampling would take about 75 s where 3-hourly takes 25 s; the verdict at any point chosen from the map still uses hourly samples on the finer horizon.

**D24. The public copy of the audit leaves out the owner's server details.**
The audit's hosting note named private configuration files and how the self-hosting server is reached. Before the first push that included the audit, those specifics were replaced with a generic description in the three unpushed commits, and the full note was kept in a local file that git ignores. The advice itself (a static server behind a tunnel, and the Content-Security-Policy fix for the inline import map) is unchanged.

**D25. The planner works in windows, not calendar days.**
Aaron pointed out that the day is not what matters. The 2027 data agree in part: at Apollo 11 every lunar day gives the same window (354–356 h), so only the position within the lunar day counts; at IM-2 the windows run from 37 h to 380 h, so the month matters as well. The day strip and "nearest dates" are replaced by the place's usable windows, each with what closes it and whether it holds the mission. The date field stays, because a mission still needs a calendar slot, and now says where the search starts.
Rejected: dropping dates altogether, which would hide the seasonal change at the pole.

**D26. Mission first: the place is a result, not the first input.**
The form asks for the mission's needs first. "Where this mission fits" ranks candidate sites and regions by their windows, and past landing sites are folded away as reference. Choosing a place or a landing area does not move the search span; typing a date or choosing a window does.

**D27. The map layer scores each cell by its own best window, and proposes landing areas.**
A cell is green if any window in the search span holds the mission, not only if one is open at a typed landing moment. Landing areas are green ground whose whole landing footprint is green, within the slope limit and not a close call, grouped by connected components and listed largest first.
This is image analysis of measured terrain. Rejected: image augmentation in the machine-learning sense (generated or sharpened terrain), which would put invented detail in front of a planner.
The whole-pole view samples every 8 hours because its 98 m uncertainty makes each sample about 0.43 s; at 4 hours it took about two and a half minutes.

**D28. A place is shown with its first window that holds the mission.** (2026-11-14)
The places list and "Sites side by side" had shown a place's longest holding window, which could be the one a month later when an earlier one also held the mission (Nobile Rim 2: 2 Dec shown, 3 Nov also holds). The first holding window answers "from this date, when can I go", and puts the sites on the same lunar day when they are compared. A place with no holding window still shows its longest.

**D29. "Sites side by side" compares windows, not one shared landing moment.**
It had landed every site at the selected site's landing time, so a site listed above as holding the mission could read "no usable window" there. It now spans the search range on one calendar, outlines each site's best window, and its table matches the places list. The folded "All sites and dates" calendar stays day-based: it answers the launch-slip question (same site, a later day), and a run of green days there is a window seen from the landing side.

**D30. The landing-area layer skips terrain blocks and runs in workers.**
The site view took 85 s in a benchmark on the real 240 m grid, with the march itself the cost (205 terrain samples per cell per time step). A six-level pyramid of block maxima lets the march jump over terrain that cannot reach the ray, raised by its uncertainty or not: 14 samples and 23 block tests per call instead of 205 (whole-pole view: 7 and 13 instead of 42). The skip is exact, and `tests/suit.test.mjs` requires zero differing cells against the full march on both grids. Up to four workers then each take a band of rows. Rejected: a per-cell horizon profile (hundreds of megabytes, and it would interpolate between azimuths), and a coarser time step (misses short shadows). Not done: sharing one copy of the terrain between workers, which needs response headers GitHub Pages does not send.

**D31. Landing areas listed: the largest, and always the nearest.**
Ranked by size alone, the whole-pole list could hold only areas hundreds of kilometres from the selected place. The nearest area now takes the last slot when it is not among the largest, and is labelled.

**D32. An unknown place in a link is reported, not silently replaced.**
A link with a site id the catalogue does not have used to open IM-2 with no word. The page now says which id was missing and what it shows instead, until another place is chosen.

**D33. The whole-pole landing map analyses the 240 m terrain, every 4 hours.** (2026-11-14, supersedes the 8-hour step in D27)
On the 1.2 km grid the layer carried 98 m of terrain uncertainty and 39% of its cells were close calls. It now evaluates the 240 m cell nearest each 1.2 km map cell, with the 240 m grid's 9.4 m uncertainty and the same 4-hour step as the site view. In a benchmark of a 10-day mission from 28 Oct 2027, close calls fell to 14% and the run cost 69 CPU seconds on one thread. The cost is the 29 MB terrain download for the whole-pole view, and that an area there is a patch of sample points 1.2 km apart. Rejected: a finer map grid of its own (new data file and a new measured uncertainty for a result still coarser than this one).

**D34. The folded calendar shows windows, not landing days.** (supersedes the last sentence of D29)
"All sites and dates" became "All sites, all windows": each site's usable windows across up to 12 months, with the part of a window in which a landing still holds the mission drawn brighter. The launch-slip question it used to answer is now answered by "land by" on each window, in this chart and in the window list at a place.

**D35. Moon Trek cross-check done for the Sun's direction; its terrain lighting needs the owner.** (supersedes D21)
Moon Trek's page configuration names a Sun-angle service that answers a plain URL. `tests/fetch_moontrek.mjs` saves its hourly Sun azimuth and elevation at three candidate sites for 14 days, and `tests/moontrek.test.mjs` compares ours: worst separation 0.0007° over 1,011 samples, against a criterion of 0.05° fixed before the first run. The service has no terrain and refuses Earth as a target. Moon Trek's terrain lighting tool is a job that mails its result to an address, so it was not run: sending the owner's address to an outside service is the owner's call.

**D36. Fewer workers on low-memory devices, and the map reports its own run time.**
Each worker holds a 29 MB terrain copy plus 10 MB of block maxima. A device that reports 4 GB of memory or less gets two workers instead of four. The note under the map states the seconds and workers of the last run, so a phone's timing can be read off the page; none has been measured yet.


**D37. The Plan tab shows the answer first; the rest sits behind three sub-tabs.** (2026-11-14, supersedes the page order of D26)
Measured on the live page, the verdict began about 2,600 px down, below the places list and the map, and the one chart of the mission's own timeline sat about 6,700 px down. The verdict and a mission clock now come directly under the scenario, beside the map. "Places and windows", "Compare sites" and "Ellipse and route" are sub-tabs below them; the map stays above all three because the ellipse and the route draw on it. The mission-first rule of D26 stands: the scenario is still set first and the places list still ranks by mission. Rejected: a sticky one-line verdict bar over the old order, which keeps the answer in view but leaves a page of ten sections.

**D38. The mission clock joins the timeline, the moment slider and the sky.**
"The mission, day by day" and "Sun and Earth over the horizon" were two panels about one thing. The clock adds a usable-time band (the verdict's rule), a red line at the first loss with a band for the terrain's uncertainty, and one sentence: how long the landing stays usable and what ends it, or when the place next becomes usable.

**D39. A second landing layer: where this landing holds the mission.**
The landing-area layer answers "is there a window in the search span"; it cannot say what a landing at the chosen time does elsewhere on the map. The new layer runs the same march from the landing to the mission's end and counts only the run that begins at landing. It is a mode of the existing layer (`fromStart`), not new machinery, and it is cached separately so switching layers does not rebuild either.

**D40. The map gets a 40 m close-up from tiles, with the 240 m terrain beyond.**
The verdict already used a 40 m horizon, but no map showed 40 m terrain. `LDEM_85S_40M` is cut into 225 tiles (110 MB in the repository; the page fetches about four per place). In the close-up the shadow march runs on a window of 40 m terrain reaching 8 km past the view and hands over to the 240 m grid at the window's edge, because terrain far from a cell still shades it at a grazing Sun. Tests: the hand-over is exact when the window is cut from the coarse grid itself, and the 40 m layer matches the horizon tracer at two places. The 40 m uncertainty (1.6 m) is scaled, not measured, and the page says so. Rejected: the 13 existing 12 km windows, because a landing area picked from the map is a new place with no window; free panning and wheel zoom, because a wheel over the map would take over page scrolling, and a click already moves the place and recentres the view.

**D41. The public history was squashed to one commit dated 2026-11-14.** (Aaron's instruction, 2026-11-14)
The public repository's history now starts at a single commit made that day. Commit hashes cited in `audit/lunar-navigator/AUDIT.md`, `docs/PLAN.md` and `docs/USABILITY_TESTS.md` (`8748ec7`, `22274d4`, `a4df8bf`) belong to the earlier history, which is kept only in the owner's local branch `backup-before-squash`. One commit with its true date was chosen over replaying the old commits with new dates, which would have put false dates on them. Dates inside the documents are unchanged.

**D42. Place first, then date; other places second.** (Aaron, 2026-11-14, supersedes the order in D26)
D26 put the mission's needs first and treated the place as a result. It records that choice but no evidence for it. Aaron's point: a target site is often fixed by science or logistics, so a mission cannot necessarily move, and the first question is when a given site works. The scenario now asks for the place, then the landing time, then the mission's needs. Under the answer, the site's own usable windows come first and the ranked list of other places second, renamed "Other places for this mission". Nothing was removed: the ranked list, the landing-area map and the rule that choosing a place does not move the search span all stand.

**D43. Licence: Apache-2.0.** (Aaron, 2026-11-14)
Chosen over MIT for its patent grant. `LICENSE` is the unmodified text from apache.org. It covers the code; the data files stay under their sources' terms (README, "Data credits and terms").
