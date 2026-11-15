# Usability tests: ready to run, not yet run

No participant has done these tasks. They need three kinds of people the project does not have: mission planners, teachers or first-time visitors, and analog-crew participants. This sheet is what a facilitator needs on the day. The tasks and measures are the audit's (`audit/lunar-navigator/AUDIT.md` §4), with the links brought up to the mission-first build.

## Setup

- **New flow:** the public site, https://astoreyai.github.io/lunar-lighting-planner/.
- **Old flow, for the comparison:** the build the audit inspected, revision `8748ec7`. The public history was squashed on 2026-11-14 (decision D41), so that revision exists only in the owner's local branch `backup-before-squash`. Serve it locally:

```bash
git worktree add ../nasa-baseline 8748ec7
```

```bash
python3 -m http.server 8766 --directory ../nasa-baseline/web
```

- Give half of each group the old flow first and half the new flow first, so practice does not favour either.
- Record for every participant and task: which flow, whether the answer was correct, seconds from reading the task to the answer, and each wrong statement on the way, in the participant's words.

## 1. Mission planners

Task, read aloud: "The launch slipped two days, to 16 March 2027, 16:00 UT. The mission needs 10 days of power and direct contact with Earth. At IM-2, how long does the window last from that landing, and what ends it?"

- Start link (new flow): `#mode=plan&site=im2_athena&land=2027-03-16T16:00&dur=10&share=0&earth=1&mh=0`
- Correct answer: about 6 days 20 hours (164 hours), ended by Earth dropping behind the terrain; the Sun sets later, at 9 days 14 hours. `tests/first_closure.test.mjs` and `tests/export.test.mjs` hold these numbers.
- Follow-up: "Where and when could this mission run in full instead?" Any place and window the page marks as holding the mission counts as correct. Note whether the participant uses the places list, the window list, the map or the mission clock.
- The error to watch for: naming the Sun as what ends the window. The old flow's headline did that (audit finding F-1).

## 2. First-time visitors and teachers

Task: "Here are two places about 10 km apart. Move the date. Explain why one of them is dark while the other is in sunlight."

- Start: the "Explore the Moon" tab, the panel "Why a short move changes everything", with a polar site chosen and "Compare with nearby low ground" pressed.
- Score against one rubric line: the explanation names terrain blocking a low Sun.
- Misconceptions to record: "it is night everywhere", "the crater is darker because it is deeper" with no mention of the Sun's height, and any mention of the Moon's phase as the cause.
- The low point is computed from the terrain (the lowest ground within 10 km), not a cited crater-floor coordinate. Say so if a participant asks what the second place is.

## 3. Analog crews

Task: show the field view for a site whose window is open, hand the participant an unrelated 10-minute task, then ask: "How long until you lose Earth, and can you trust this screen?"

- Start link: `#mode=field&fs=im2_athena&ft=2&fe=1`, at a time when the page shows an open window. Use "Hold this reading" before the distractor so the reading goes stale.
- Correct: the participant reads the time to the first closure and its name, and says the screen is stale (it is marked STALE after 90 seconds).
- This can show comprehension and whether staleness is noticed in a simulated setting. It cannot show suitability for flight.

## Reporting

Report per audience and per flow: the share of correct answers, the median time to answer, and the list of errors. Put the results in `docs/VALIDATION.md` under "Not validated", replacing the usability line there.
