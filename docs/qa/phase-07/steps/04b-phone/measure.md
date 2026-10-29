# Step 4b measurement: 59dddd0 against the 4b change (phone spec 5.4, row 4b)

Date: 2026-10-29. Host: 4 CPUs, no other job running, Chromium 141.0.7390.37 (`/opt/pw-browsers`,
headless, default GPU as `tests/helpers/launch.ts`), Node 22.23.4. Every measured run waited until
the 1-minute load average was under 1 (`quiet.sh`, a 10 s poll). The load at each start is in the
logs.

All file paths below are relative to the measurement folder of step 4b (`p7/phone4b/` in the
integrator's working area, outside the repository); those files are not committed.

## 0. Builds and method

| Build | What | BUILD_ID | Used for |
|---|---|---|---|
| base | 59dddd0. The worktree's change was reverse-applied (`git apply -R` of the full diff), the tree was built with the worktree's turbopack cache, and the output was hard-linked to `root-base/`. Then the change was re-applied: `git diff 59dddd0` was identical before and after, and all 48 files were byte-compared with a tar backup. | `zbJuynvY6x52CyQgeP70f` | every base row |
| change v1 | b's change plus the first A/B switch | `eLs69nkX8r-o0upPQ5B8S` | frames lanes, Lighthouse, engine attribution (first set) |
| change v2 | plus the A/B CSS fixes | `5EtbAOTvFFt-528nEEttw` | Drift A/B, INP, check:bundle (first), gated perf run 1 |
| change final | plus the frame-monitor fix | `IWFZTTmNI5I4vQLYAl4fE` | gated perf runs 3 and 4, T-PS-P3, e2e, check:bundle (final), owner media, monitor diagnostics |

- Both builds were measured with the same tools: the change's `scripts/` and `tests/`, copied to
  `root-base/`. So the new phone lanes also run on the base. `fakegit/` labels those runs
  `59dddd0-base`.
- From v1 to final, the measured default path did not change. v1 to v2 changed only the A/B CSS
  rule and the element that carries the attribute; both are inert without `?scrollcss=1`. v2 to
  final changed only the frame monitor, which runs in auto mode. The frames lanes and Lighthouse
  use `?tier=N` (fixed mode, so no monitor), so their numbers hold for the final build. The bundle
  was measured again on the final build.
- The main branch moved during the work. It is now e779286: f6dd06a (services pointer during a
  pinned scroll), 87e0228 (graphql-scalars override) and e779286 (test only). As asked, the base
  is 59dddd0. The change tree is f6dd06a plus 4b, so f6dd06a's services change is in the
  "change" numbers. That change affects only the pinned desktop row.
- The change is still uncommitted in `/home/user/sefid-wt-step0` (HEAD f6dd06a, index changed
  only by the `git add -N` entries). Nothing was committed or pushed. The main repo was only read.

## 1. Verdict per row

| # | Row | Budget | Base 59dddd0 | Change | Result |
|---|---|---|---|---|---|
| 1 | T0 gate | phone, 4x, `?tier=0`: every section median ≥ 58, slowest ≥ 55 (median of 3) | pass in both lanes (worst section: services 60/57 in the hts lane) | pass in both lanes (worst: services 59.5/58) | **PASS** |
| 2 | Phone frames 4x, tiers 0/1/2 | P-F against the same build's tier 0 | 1 miss (hts trust t1: 2/81 frames over 33 ms) | 0 misses (full and hts lanes) | **PASS** (median of 3; single-run T-PS-P1 see 2.2) |
| 3 | Hero and services frames rows | P-F, hts lane (pace 16) | hero 60/58, services 60/60 (t1) | t1: hero 60/59, trust 60/60, services 60/59; t2: 60/59, 60/60, 60/60 | **PASS** |
| 4 | Engine creation, no task over 50 ms | phone, 4x | no creation task over 50 ms (initMs 7.8-8.8 with the intro skipped) | before the review fix: over 50 ms in 3 of 8 skip-intro runs (52, 53, 53 ms). **After it (10.1): initMs 1.4-11.4, no task over 50 ms in 10 of 10 gated T-PS-P4 runs and 8 of 8 skip-intro runs**; with the intro, only the intro's end and its rendering (N1) | **PASS** (10.1) |
| 5 | `/?tier=1` TBT not above the last CI median | CI 65 (2b13ad0): light **625**, dark **533** (LHCI 4x ≈ local 5.5x) | local 5.5x median **111** (n=13) | **110** (n=13) | **PASS** (local proxy; CI decides) |
| 6 | clsAll 0 | 0 target, 0.05 gate | 0 in 36 of 36 runs | 0 in 36 of 36 runs; T-PH4 (4 cases × 2 themes) and T-PH5 pass | **PASS** |
| 7 | Idle ticker | `tickSubscribers` 0, 1 s after scrollEnd | - | 0, but that check could not fail. Now also the monitor's own frames: 592-606 during the scroll, **0 in the next second** (gated T-PS-P3, 4 runs; T-PH12 both phone themes); a loop that does not stop goes red (10.3) | **PASS** (10.3) |
| 8 | INP phone rows exist | each ≤ 200 ms | - | submits 80-96, FAQ 56/64, notice switch 48 ms | **PASS** |
| 9 | `check:bundle` home | ≤ 160 KiB (gate 170) | 157.0 KiB | 159.7 KiB; **159.8 KiB** after the review fixes (10.5) | **PASS**, 0.2 KiB margin |
| 10 | Engine chunk | ≤ 64 KiB (T-EX5) | - | 54.7 KiB | **PASS** |
| - | Monitor false positive (T-PS-P3 4x) | no step-down | - | **failed before the fix** (4 of 4 runs went to tier 0); tier 1 in 9 of 9 runs after it | **FIXED** (3.1) |
| - | Monitor true positive (T-PS-P3) | one step within 10 s, relatch only after 1 s still, notice | - | stepped after 7.6 s, relatch 2.0 s after the last swipe, 'stepped' notice; after the review fixes 7.56-7.68 s, relatch 1.03-2.07 s, the 'stepped' copy asserted exactly (10.3) | **PASS with a new slow condition** (3.3) |
| - | CPU signal (new, review major 3) | recorded; calibrates `CPU_BLOCKING_MS` (400) | - | intro end left out: 4x 35-140 ms, 6x 144-335 ms, 10x 136-753 ms (5 of 6 over 400) (10.4) | **RECORDED** |
| - | Owner's phone | no step-down | - | not measurable here | **OPEN** (owner) |

## 2. Rows in detail

### 2.1 Frames (rows 1, 2, 3, 6)

There were two measure-home lanes per build and tier, each at 4x and 6x, median of 3 runs:

- `full`: `--viewport=phone --only=frames --tiers=N`, the whole page, pace 80.
- `hts`: `--sections=hero,trust,services --pace=16`. This lane is for the hero and services rows;
  short sections hold a full 1 s window only at a slow pace.

The order was interleaved per tier (full: base then change; hts: change then base). Results are in
`m/<lane>-t<tier>-<build>/` (`results.json`, `README.md`). Tables: `m/summary.md` has the medians
and the per-section budget check; `m/runs.md` has every run (also in section 7).

Per section at 4x, full lane (median fps / slowest window / worst ms, then the budget check):

| Section | base t0 | change t0 | base t1 | change t1 | base t2 | change t2 |
|---|---|---|---|---|---|---|
| hero | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| trust | - / - / 16.7 ok | - / - / 16.7 ok | - / - / 16.7 ok | - / - / 16.8 ok | - / - / 16.7 ok | - / - / 16.8 ok |
| services | 59 / 59 / 33.4 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 33.3 ok | 59.5 / 59 / 33.4 ok |
| restoration | - / - / 16.8 ok | - / - / 16.8 ok | - / - / 16.8 ok | - / - / 16.8 ok | - / - / 33.4 ok | - / - / 16.8 ok |
| compare | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| dentists | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| voices | 59 / 59 / 50 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| journey | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 33.3 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| faq | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok |
| booking | 60 / 60 / 16.8 ok | 60 / 60 / 16.8 ok | 60 / 60 / 33.3 ok | 60 / 60 / 16.8 ok | 59.5 / 59 / 33.3 ok | 59 / 58.1 / 33.4 ok |

Per section at 4x, hts lane:

| Section | base t0 | change t0 | base t1 | change t1 | base t2 | change t2 |
|---|---|---|---|---|---|---|
| hero | 60 / 58 / 33.4 ok | 60 / 59 / 33.4 ok | 60 / 58 / 33.4 ok | 60 / 59 / 33.4 ok | 60 / 58 / 50 ok | 60 / 59 / 33.4 ok |
| trust | 60 / 60 / 33.4 ok | 60 / 60 / 16.8 ok | 59 / 59 / 33.3 **2/81 frames over 33 ms** | 60 / 60 / 16.8 ok | 59 / 59 / 33.3 ok | 60 / 60 / 16.8 ok |
| services | 60 / 57 / 50 ok | 59.5 / 58 / 33.4 ok | 60 / 60 / 16.8 ok | 60 / 59 / 33.3 ok | 60 / 58 / 33.3 ok | 60 / 60 / 16.8 ok |

clsAll was 0 in every one of the 72 runs (36 per build). Long tasks over 100 ms during the scroll:
0, except one change run (hts t2 6x run 3, 1 task of 50-100 ms). The trust band holds a 1 s
window only in the hts lane.

### 2.2 Single-run gated perf rows (T-PS-P0 to T-PS-P4, `PERF_GATE=1`, perf-default)

| Run | Build | P0 (T0 gate) | P1 t1 | P1 t2 | P3 | P4 longest task / initMs | Log |
|---|---|---|---|---|---|---|---|
| 1 | v2 | pass | pass | pass | **fail**: tier 0 after the 4x scroll (false positive) | 0 / 20.3 | `e-perf-gated.log` |
| 2 | first monitor fix | pass | voices 1/43 frames over 33 ms | restoration 1/31 | 4x pass; 20x did not step in 10 s | 0 / 16.9 | `e-perf-gated-2.log` |
| 3 | final | dentists median 57 < 58 | journey 2/54 | pass | 4x pass; 20x did not step | 0 / 21.7 | `e-perf-gated-3.log` |
| P3 only | final + new slow condition | - | - | - | **pass** (stepped 7.6 s) | - | `e-perf-gated-P3.log` |
| 4 | final + new slow condition | pass | hero 2/53, faq 1/38 | pass | **pass** (stepped 7.6 s, relatch 2045 ms) | **52** / 29.9 | `e-perf-gated-4.log` |

The P0 and P1 misses are single runs with 1 or 2 frames over 33 ms in sections of 31 to 54
frames. At that size the 2 % rule flips on one frame. The same sections pass the median of 3
(2.1). The spec asks for a median of 3, but T-PS-P0 and T-PS-P1 measure one run. Recommendation
for QA: run them three times, or apply the 2 % rule only to sections with at least 100 frames.

### 2.3 TBT (row 5)

Baseline from the notes (`../ci65-tbt.md`, `../tbt/final/apply.md`): CI run 65 on 2b13ad0, LHCI
4x, `/?tier=1` TBT median **625 ms light, 533 ms dark** (tier 0: 430 / 392). Calibration: local
5.5x ≈ CI 4x. Since 2b13ad0, main has gained the compile hints (D22) and the CSS without
`:has()` (D21). The local A/B of those two gave tier 1 464 → 301 ms. So the local numbers below
are far under the CI baseline already at the base.

Method: `../tbt/tools/serve.mjs` (HTTPS + HTTP/2, both servers up) and `../tbt/tools/ga.mjs`
(Lighthouse 12.6.1 gather, then audit at 5.5x). There were 6 + 8 rounds for `/?tier=1` and 3 + 3
rounds for `/?tier=0`; the build that goes first flips each round, and there was one warm-up
gather per server before the second set. Two gathers failed with NO_NAVSTART (Lighthouse trace)
and are left out. Every run, simulated, at 5.5x:

| Page | Build | TBT ms (every run, in order) | TBT median | LCP median / best | Perf median |
|---|---|---|---|---|---|
| `/?tier=1` | base | 2459*, 92, 99, -, 12, 234, 213, 111, 135, 101, 144, 60, 78, 125 | **111** (106 without the cold run*) | 2485 / 2071 | 0.96 |
| `/?tier=1` | change | 83, 156, 343, 90, -, 150, 40, 30, 279, 110, 96, 173, 163, 107 | **110** | 2485 / 2039 | 0.95 |
| `/?tier=0` | base | 138, 82, 71, 173, 122, 117 | **119.5** | 2489 / 2338 | 0.965 |
| `/?tier=0` | change | 85, 112, 121, 55, 269, 188 | **116.5** | 2559.5 / 2481 | 0.95 |

\* The very first gather after the server started (cold): LCP 3606, perf 0.60.

Verdict: no TBT regression from 4b on this host (110 against 111). The CI median after 4b is
expected far under 625 / 533. CI decides; not verified here. Logs: `lh/audit-*.log`,
`lh/phaseC*.log`.

### 2.4 Engine creation (row 4)

Two measurements disagree, so the tasks were attributed with long-animation-frame scripts
(`tools/engine-tasks.mjs`, `eng/*.json`). The window is measure-home's own: from the engine
request to 1 s after `sefid:engine-init`. Two modes alternate: `intro` (the intro plays, as in
measure-home) and `skip` (the intro is marked played, as in T-PS-P4).

| Build | Mode | initMs (runs) | Long tasks in the window | Attribution of the tasks over 50 ms |
|---|---|---|---|---|
| base | intro | 7.5, 10, 10.6 | 55; 68+61; 52+53 | all: the intro script's `end` (TimerHandler setTimeout), forced style and layout 38 to 58 ms |
| base | skip | 8.8, 8.2, 7.8 | none | - |
| change v1 | intro | 22.2, 23.9, 29 | 72+91; 51+58; 64+51 | the intro's `end` (forced style and layout 42 to 62 ms) |
| change v1 | skip | 20, 20.8, 22.2 | none | - |
| change final | intro | 27.4, 22.1, 41.6, 24.6, 30.1, 17.8 | 58; 59+69; 64+59+69; 85+69; 81+97; 75+56 | the intro's `end` in every run; in 2 runs also the engine creation callback (49 and 36 ms script) |
| change final | skip | 16, 34.5, 30, 28.8, 28.6, 31.7 | none; **53**; none; none; none; **53** | the engine creation callback: a FrameRequestCallback in the home page chunk (`ExperienceRoot`'s third frame, `createScrollEngine`), 37 to 40 ms of script, 3 to 5 ms forced style |

- measure-home's "Engine longest task" column (51 to 91 ms for the change, 53 to 819 ms for the
  base) is mostly **the intro's end**, not the engine. That callback runs about 1.5 s after
  navigation at 4x, inside the window. It is pre-existing in both builds (finding N1).
- **The engine's own creation task** passes on the base: initMs 7.8 to 10.6, no long task. On the
  change it is close to the budget: initMs 16 to 42 ms at 4x. The creation task (its callback
  plus style and layout) went over 50 ms in 3 of 8 skip-intro runs on the final build: 53 and 53
  here, and 52 in T-PS-P4 run 4 (T-PS-P4 run 3 had 0). It also went over 50 ms in 1 of 6 intro
  runs (64 ms). The v1 runs also show initMs up to 31 to 35 ms in measure-home, so this is the
  phone set's creation cost, not this step's edits. These edits do not touch the creation path
  except one query check in the hero setup.
- **Cause:** `createScrollEngine` on the phone layout does about 30 ms of work at 4x in one
  task: the master, the bounds, and the first scene's setup inline. The base does 8 to 10 ms.
- **Not fixed:** it needs profiling and a further split of the creation work (for example the
  first scene's setup behind `nextTask` as well, or the master and labels in a task of their own),
  then a new test. That is not a small fix. **Reported to ENGINE.**

### 2.5 Bundle, engine chunk, INP (rows 8, 9, 10)

- `check:bundle` (`e-bundle-*.log`): home initial JS is **157.0 KiB** for the base, 159.6 KiB for
  change v2 and **159.7 KiB for the final change**. The target is 160 and the gate 170. The margin
  is 0.3 KiB. Content pages are 144.7 to 149.6 KiB.
- T-EX5 (`c-e2e.log`): engine chunk **54.7 KiB** (4 scripts after load). The budget is 64 KiB.
- INP (`m/inp-change/README.md`, v2, CPU 4x, median of 3). Phone submits: hero 96 / 88 ms and
  block 80 / 80 ms at tiers 1 / 2. Desktop: 64 to 96 ms. Phone taps: FAQ summary 56 ms (tier 1)
  and 64 ms (tier 2); the notice switch from tier 0 (deviceMemory 2) 48 ms. All are under 200 ms.
  The INP lane was not run on the base: its tap rows need the notice.

## 3. Fixes made in this step (worktree, uncommitted)

All checks passed: `c-delta.diff` (the 16 files of this step against b's state) and
`c-full.diff` (`git diff 59dddd0`, 47 files).

### 3.1 The frame monitor stepped capable phones down (D26), now fixed

- **Symptom:** gated T-PS-P3 run 1 ended at tier 0 after a full scroll at 4x (the false-positive
  row). `tools/monitor-diag.mjs` reproduced it in 4 of 4 runs, with and without `?debug=1`. The
  page's own rAF frames were at 60 fps (0 to 2 slow 250 ms windows per run). The monitor counted
  7 to 12 slow windows.
- **Root cause:** the monitor counted frames as gsap ticker dispatches. gsap's ticker
  (`gsap-core.js`, `_tick`) dispatches its listeners at most once per about 4 ms of `Date.now()`
  (`_nextTime += overlap + 4`). When the main thread is late, two frames' rAF callbacks run within
  a few ms of each other, and gsap merges them into one dispatch that reads as one 33 ms frame.
  Evidence (`tools/tick-diag.mjs`, `mon/ticks-4x.json`): 309 rAF frames gave 278 simulated
  dispatches. Windowed as the monitor does, that is 8 consecutive slow windows (40 to 52 fps),
  while the rAF frame clock showed 60 fps in 18 of 19 windows. On a real phone with a busy main
  thread the same merge happens, so the owner's class of phone could lose its effects after one
  scroll.
- **Fix (`src/experience/engine/scrollEngine.ts`, `monitorFrames`):** the monitor runs its own
  `requestAnimationFrame` loop from ScrollTrigger's `scrollStart` to `scrollEnd`. It uses the frame
  clock (the rAF timestamp, wall clock, so a 600 ms freeze is still 600 ms), never the gsap
  ticker. At rest no loop runs. The signature is now `monitorFrames(opts)`: the engine argument is
  gone, and `ExperienceRoot.tsx` was updated to match.

### 3.2 Still frames before scrollEnd reset the slow time, now fixed

- After 3.1, the true positive at 20x never stepped (gated run 2). ScrollTrigger dispatches
  `scrollEnd` 200 to 450 ms after the last scroll event: its `_sync` check runs every 250 ms
  (`ScrollTrigger.js` lines 371 and 2115), and none fires while a pointer is down (line 590). Those
  still frames are fast, so they made good windows, which reset `slowMs` (D26: a good window
  resets).
- **Fix:** a frame counts only when `window.scrollY` changed since the frame before. This refines
  D26's "samples only while the page scrolls"; the spec says "there is no scrollY read", which is
  now not true (one read per frame while scrolling, no layout). Test U-PH7c.

### 3.3 The T-PS-P3 true positive needed a new slow condition (test only)

- With a correct monitor, CPU throttling does not make this page's swipes slow
  (`tools/tp3-diag.mjs`, the T-PS-P3 swipe loop). Windows over frames in which the page moved:
  - 20x: 19 and 28 fps in the first two windows (creation work), then 60 fps in every window.
  - 40x: 4, 14 and 18 fps, then 60 fps.
  - 60x: the first swipe took 6.9 s and stepped.
  The scroll is composited and the scroll set's per-frame work is tiny. The spec marks 20x as
  "[guess: the rate that makes the scroll set slow on this host]".
- **Change (`tests/perf/scenes.spec.ts`, T-PS-P3):** the slow page is the phone profile at 4x with
  40 ms of main-thread work in every frame (about 25 fps). The budget is unchanged: one step
  within 10 s of swiping, no relatch before 1000 ms still, the 'stepped' notice. `CpuRate` is
  back to `1 | 4 | 6` (`tests/helpers/cpu.ts` now equals 59dddd0). Result: stepped after 7.6 s
  (twice), relatch 2.0 s after the last swipe, notice «جلوه‌ها روی این دستگاه کند بود، پس آن‌ها را
  خاموش کردیم.». The margin to 10 s is 2.4 s.
- T-PS-P3's printed clsAll (0.12 to 0.19) is the debug overlay's own layout shift: its panel grows
  from 70 to 340 px at about 1 s (`tools/tp3-diag.mjs`, layout-shift sources). It is not from the
  step-down. The test records it and does not assert it. T-PH5 (a forced step-down mid-swipe)
  asserts clsAll and passes.

### 3.4 What else changed with the monitor fix

- `src/experience/core/store.ts`, `debugHook.ts`: the monitor counters gain `windows` (sampled
  windows). `DevOverlay.tsx` shows `slow/total`.
- `tests/e2e/home-phone.spec.ts`, T-PH12: the monitor is no longer a tick subscriber, so the
  "during > 0 tick subscribers" check became: the sampled windows grow during two swipes and do
  not grow in a further 1 s at rest. The spec's assertion (0 tick subscribers 1 s after) is kept.
- Unit tests: U-PH7 and U-PH7b were adapted (a stubbed rAF drives the loop; U-PH7 also asserts
  that `gsap.ticker.add` is never called), U-PH7c is new, DH6 and the snapshot test cover
  `windows`, and XR4 matches the new signature.
- Red proofs (`c-red-proofs.log`):
  1. The monitor also rides the gsap ticker: U-PH7 red.
  2. A frame time capped at 33 ms: U-PH7b red.
  3. scrollEnd does not stop the loop: U-PH7 red.
  4. The store does not count windows: DH6 red.
  5. Still frames sampled: U-PH7c red.
  6. e2e: T-PH12 against a build whose loop does not stop at scrollEnd: red (windows 8 → 12 at
     rest).
  Each file was restored and byte-compared. The T-PH12 red build had the 3.1 code without 3.2;
  T-PH12 is unchanged since.

### 3.5 The Drift A/B switch

See `drift-ab.md`. Files: `query.ts` (`scrollCssActive`, QP7), `hero.ts` (`?scrollcss=1` writes
`data-scroll-css` on the hero, HS5), `globals.css` (the view-timeline rule). Red proofs 1 to 4 in
`c-red-proofs.log`. Pick: keep gsap as the default until the owner compares `/?scrollcss=0` and
`/?scrollcss=1` on his phone. The CSS path meets the "no main-thread cost at 4x" condition.

## 4. Monitor diagnostics, every run (final build unless named)

| Run | Condition | Result | File |
|---|---|---|---|
| before 3.1, debug × 2 | `?tier=1&monitor=1&debug=1`, 4x, full page | tier 0 at scrollY 4365 and 2910 | `mon/change-debug.json` |
| before 3.1, plain × 2 | `?tier=1&monitor=1`, 4x | tier 0 at 3430 and 2425 | `mon/change-plain.json`, `mon/change-plain2.json` |
| after 3.2, plain × 3 | the same | tier 1 (9 windows sampled) | `mon/fixed-plain-4x.json` |
| after 3.2, debug × 2 | the same | tier 1 (9 windows, 0 to 1 slow) | `mon/fixed-debug-4x.json` |
| after 3.2, debug × 2, 20x, continuous swipes | with a per-frame snapshot read (adds load) | tier 0 after 1.2 to 1.6 s | `mon/fixed-debug-20x.json` |
| T-PS-P3 loop, 20x / 40x / 60x | no extra load | 20x and 40x never stepped; 60x stepped in the first swipe (6.9 s) | console output, section 3.3 |
| gated T-PS-P3, 4 runs | spec rows | see 2.2 | `e-perf-gated*.log` |

## 5. e2e and static checks on the final build

- e2e (`c-e2e.log`): home-phone, home-hero, home-engine, experience, home and home-services on
  phone-light, phone-dark, tablet-light and desktop-light, `--workers 2`, E2E_PORT 3700. Result:
  **91 passed, 0 failed**, 145 skipped by project rules. This covers T-PH1 to T-PH12 (T-PH4 to
  T-PH8 and T-PH12 on both phone themes) and T-EX5.
- `npx vitest run` (all projects, `c-vitest.log`): **195 files, 3709 passed, 1 skipped**.
- eslint `--max-warnings=0` and prettier `--check` on the 16 files of this step, `tsc --noEmit -p
  .` and `scripts/check-has.mjs`: all exit 0.

## 6. Owner media (final build, phone profile, 390x844, DPR 3, touch)

- `phone-390.webm` (VP9, 780x1688, 25 fps, 18.4 s) and `phone-390.mp4` (H.264, the same,
  `/usr/bin/ffmpeg`). Light theme, `?tier=2` (this headless host detects a software renderer, so
  tier 0), the intro marked played, no CPU throttle. One constant 260 px/s scroll from the top to
  the middle of services (scrollY 1816), 1.2 s still, the same back to the top. It is
  requestAnimationFrame-driven, not a finger swipe, so the motion is even. Contact strip:
  `media/frames/strip.png`.
- Screenshots (`media/`): `390-light-top.png`, `390-dark-top.png`; `390-light-services-mid.png`,
  `390-dark-services-mid.png`, with the services row halfway through its Slide (opacity 0.50, x
  11.9 px, mark scale 0.977); `390-light-notice.png`, `390-dark-notice.png`, showing the light
  notice, opened the real way (deviceMemory 2, tier 0, the hero card past the header, 1 s still,
  'loaded' copy).
- **For the owner:** the e2e database's hero photo is a grey placeholder, so the photo's Drift
  can hardly be seen in the video. The services Slide and Settle are visible. Record again once
  the hero stand-in (task 80) lands, or show it on the preview with real content.

## 7. Every frames run (measure-home, phone profile)

The "Engine longest task" column includes the intro's end (section 2.4). "Scroll s" is how long
the same swipes took to deliver. The change's swipes take longer at tiers 1 and 2: +6 % in the
full lane and +24 % in the hts lane. Each CDP touch event waits for the main thread, which the
scrubs keep busier. The Drift A/B shows the same effect. Frame rates are not affected.

| Lane | Tier | CPU | Build | Run | Median / slowest fps | Worst ms | >33 ms | Long tasks (>100) | clsAll | Engine initMs / longest task ms | Scroll s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| full | 0 | 4x | base | 1 | 60 / 58 | 33.4 | 2 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 4x | base | 2 | 60 / 57 | 50 | 7 | 0 (0) | 0 | - / - | 15.2 |
| full | 0 | 4x | base | 3 | 60 / 57 | 66.6 | 3 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 4x | change | 1 | 60 / 59 | 33.4 | 2 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 4x | change | 2 | 60 / 60 | 16.8 | 0 | 0 (0) | 0 | - / - | 15 |
| full | 0 | 4x | change | 3 | 60 / 59 | 33.4 | 2 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 6x | base | 1 | 60 / 58 | 33.5 | 5 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 6x | base | 2 | 60 / 60 | 16.8 | 0 | 0 (0) | 0 | - / - | 15 |
| full | 0 | 6x | base | 3 | 60 / 52 | 149.9 | 7 | 0 (0) | 0 | - / - | 15.3 |
| full | 0 | 6x | change | 1 | 60 / 59 | 33.4 | 3 | 0 (0) | 0 | - / - | 15.1 |
| full | 0 | 6x | change | 2 | 60 / 59 | 33.4 | 1 | 0 (0) | 0 | - / - | 15 |
| full | 0 | 6x | change | 3 | 60 / 57 | 50.1 | 6 | 0 (0) | 0 | - / - | 15.1 |
| full | 1 | 4x | base | 1 | 60 / 58 | 33.3 | 4 | 0 (0) | 0 | 8.2 / 73 | 15.4 |
| full | 1 | 4x | base | 2 | 60 / 57 | 50 | 5 | 0 (0) | 0 | 7.9 / 84 | 15.4 |
| full | 1 | 4x | base | 3 | 60 / 58 | 33.4 | 4 | 0 (0) | 0 | 7 / 91 | 15.4 |
| full | 1 | 4x | change | 1 | 60 / 58 | 50.1 | 4 | 0 (0) | 0 | 21.7 / 55 | 16.4 |
| full | 1 | 4x | change | 2 | 60 / 58 | 50 | 1 | 0 (0) | 0 | 16.6 / 52 | 16.3 |
| full | 1 | 4x | change | 3 | 60 / 59 | 33.4 | 1 | 0 (0) | 0 | 31 / 53 | 16.4 |
| full | 1 | 6x | base | 1 | 60 / 58 | 33.3 | 3 | 0 (0) | 0 | 14.4 / 143 | 15.4 |
| full | 1 | 6x | base | 2 | 60 / 57 | 50 | 5 | 0 (0) | 0 | 16 / 118 | 15.4 |
| full | 1 | 6x | base | 3 | 60 / 58 | 50 | 3 | 0 (0) | 0 | 14.4 / 80 | 15.4 |
| full | 1 | 6x | change | 1 | 60 / 58 | 50 | 4 | 0 (0) | 0 | 141.7 / 179 | 16.4 |
| full | 1 | 6x | change | 2 | 60 / 58 | 50 | 3 | 0 (0) | 0 | 30.3 / 116 | 16.5 |
| full | 1 | 6x | change | 3 | 60 / 58 | 50 | 1 | 0 (0) | 0 | 64.3 / 97 | 16.4 |
| full | 2 | 4x | base | 1 | 60 / 58 | 50 | 3 | 0 (0) | 0 | 10.3 / 65 | 15.4 |
| full | 2 | 4x | base | 2 | 60 / 57 | 50 | 4 | 0 (0) | 0 | 3.3 / 67 | 15.5 |
| full | 2 | 4x | base | 3 | 60 / 58 | 33.4 | 4 | 0 (0) | 0 | 9.6 / 54 | 15.4 |
| full | 2 | 4x | change | 1 | 60 / 57 | 66.7 | 2 | 0 (0) | 0 | 18.7 / 56 | 16.4 |
| full | 2 | 4x | change | 2 | 60 / 58 | 50 | 5 | 0 (0) | 0 | 20.7 / 65 | 16.5 |
| full | 2 | 4x | change | 3 | 60 / 57 | 50.1 | 3 | 0 (0) | 0 | 19 / 54 | 16.4 |
| full | 2 | 6x | base | 1 | 60 / 57 | 50 | 8 | 0 (0) | 0 | 15.6 / 159 | 15.4 |
| full | 2 | 6x | base | 2 | 60 / 57 | 33.4 | 6 | 0 (0) | 0 | 18.8 / 78 | 15.4 |
| full | 2 | 6x | base | 3 | 60 / 57 | 50 | 9 | 0 (0) | 0 | 12.6 / 89 | 15.6 |
| full | 2 | 6x | change | 1 | 60 / 57 | 66.7 | 4 | 0 (0) | 0 | 30.7 / 0 | 16.5 |
| full | 2 | 6x | change | 2 | 60 / 58 | 50 | 1 | 0 (0) | 0 | 33.8 / 87 | 16.4 |
| full | 2 | 6x | change | 3 | 60 / 58 | 50 | 4 | 0 (0) | 0 | 29.1 / 104 | 16.4 |
| hts | 0 | 4x | base | 1 | 60 / 57 | 50.1 | 8 | 0 (0) | 0 | - / - | 18 |
| hts | 0 | 4x | base | 2 | 60 / 58 | 50 | 7 | 0 (0) | 0 | - / - | 18 |
| hts | 0 | 4x | base | 3 | 60 / 57 | 33.4 | 9 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 4x | change | 1 | 60 / 46 | 249.9 | 8 | 0 (0) | 0 | - / - | 18.2 |
| hts | 0 | 4x | change | 2 | 60 / 57 | 66.7 | 5 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 4x | change | 3 | 60 / 59 | 33.4 | 5 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 6x | base | 1 | 60 / 57 | 50.1 | 5 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 6x | base | 2 | 60 / 57 | 50 | 7 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 6x | base | 3 | 60 / 60 | 33.3 | 1 | 0 (0) | 0 | - / - | 17.8 |
| hts | 0 | 6x | change | 1 | 60 / 59 | 33.4 | 4 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 6x | change | 2 | 60 / 58 | 33.4 | 8 | 0 (0) | 0 | - / - | 17.9 |
| hts | 0 | 6x | change | 3 | 60 / 57 | 33.4 | 5 | 0 (0) | 0 | - / - | 17.9 |
| hts | 1 | 4x | base | 1 | 60 / 58 | 33.4 | 9 | 0 (0) | 0 | 13.7 / 63 | 18.3 |
| hts | 1 | 4x | base | 2 | 60 / 58 | 49.9 | 5 | 0 (0) | 0 | 8.8 / 89 | 18.3 |
| hts | 1 | 4x | base | 3 | 60 / 59 | 33.3 | 1 | 0 (0) | 0 | 13 / 56 | 18.1 |
| hts | 1 | 4x | change | 1 | 60 / 59 | 33.3 | 1 | 0 (0) | 0 | 13.8 / 56 | 22.6 |
| hts | 1 | 4x | change | 2 | 60 / 59 | 33.4 | 2 | 0 (0) | 0 | 18.1 / 51 | 22.6 |
| hts | 1 | 4x | change | 3 | 60 / 56.1 | 66.6 | 4 | 0 (0) | 0 | 25.2 / 70 | 22.7 |
| hts | 1 | 6x | base | 1 | 60 / 56 | 66.8 | 3 | 0 (0) | 0 | 11.2 / 126 | 18.2 |
| hts | 1 | 6x | base | 2 | 60 / 59 | 33.4 | 3 | 0 (0) | 0 | 28.8 / 101 | 18.2 |
| hts | 1 | 6x | base | 3 | 60 / 56 | 66.5 | 3 | 0 (0) | 0 | 5.3 / 92 | 18.2 |
| hts | 1 | 6x | change | 1 | 60 / 59 | 33.3 | 2 | 0 (0) | 0 | 33.6 / 129 | 22.7 |
| hts | 1 | 6x | change | 2 | 60 / 59 | 33.3 | 1 | 0 (0) | 0 | 28.7 / 100 | 22.6 |
| hts | 1 | 6x | change | 3 | 60 / 58 | 50 | 6 | 0 (0) | 0 | 36.4 / 136 | 22.8 |
| hts | 2 | 4x | base | 1 | 60 / 23 | 333.3 | 14 | 0 (0) | 0 | 11.2 / 199 | 19.1 |
| hts | 2 | 4x | base | 2 | 60 / 57 | 50 | 9 | 0 (0) | 0 | 13.5 / 765 | 18.3 |
| hts | 2 | 4x | base | 3 | 60 / 50 | 166.6 | 7 | 0 (0) | 0 | 10 / 616 | 18.4 |
| hts | 2 | 4x | change | 1 | 60 / 58 | 50 | 4 | 0 (0) | 0 | 34.8 / 58 | 22.7 |
| hts | 2 | 4x | change | 2 | 60 / 57 | 66.6 | 3 | 0 (0) | 0 | 17.5 / 91 | 22.7 |
| hts | 2 | 4x | change | 3 | 60 / 58 | 50.1 | 3 | 0 (0) | 0 | 26.5 / 72 | 22.7 |
| hts | 2 | 6x | base | 1 | 60 / 58 | 33.4 | 5 | 0 (0) | 0 | 24.3 / 114 | 18.2 |
| hts | 2 | 6x | base | 2 | 60 / 54 | 116.7 | 2 | 0 (0) | 0 | 13.8 / 819 | 18.2 |
| hts | 2 | 6x | base | 3 | 60 / 58 | 50 | 3 | 0 (0) | 0 | 14 / 81 | 18.2 |
| hts | 2 | 6x | change | 1 | 60 / 59 | 33.3 | 1 | 0 (0) | 0 | 31.1 / 87 | 22.6 |
| hts | 2 | 6x | change | 2 | 60 / 58 | 50 | 2 | 0 (0) | 0 | 25.9 / 104 | 22.6 |
| hts | 2 | 6x | change | 3 | 60 / 39 | 333.4 | 9 | 1 (0) | 0 | 50.7 / 111 | 23.2 |

## 8. Findings not fixed (report)

- **N1 (INTRO, pre-existing).** The intro script's `end` callback is one task of 46 to 97 ms at
  4x, 38 to 67 ms of it forced style and layout, at about 1.5 s after navigation. It is the same on
  the base. It lands in Lighthouse's TBT window and in measure-home's engine window.
- **N2 (QA tooling).** measure-home's `engineCreation()` window (engine request to init + 1 s)
  counts N1. Spec 4.1 item 7 says "to the last scene setup". Suggested fix: an engine
  `performance.measure('sefid:engine-setups')` after the deferred setup loop, used as the window's
  end. Not done: it would add production code for a tool.
- **N3 (ENGINE).** The creation task is borderline: over 50 ms in 3 of 8 skip-intro runs at 4x
  (section 2.4). Fixed after the review (10.1).
- **N4 (QA).** T-PS-P0 and T-PS-P1 measure one run, so the 2 % rule flips on one frame in short
  sections (section 2.2).
- **N5 (base only).** At `?tier=2` the base had 616 to 819 ms tasks in the engine window in 3 of
  6 hts runs, and windows down to 23 fps. The change does not. Not investigated.
- **N6.** In one change run (hts t0 4x run 1) there was one 250 ms frame on the static page (page
  slowest window 46). The section T0 gate is unaffected and runs 2 and 3 did not repeat it.
- **N7 (spec text).** D26 says "there is no scrollY read" and the T-PS-P3 row names 20x; both
  changed (sections 3.2 and 3.3). Update the spec and the 4b README.

## 9. Not verified

- The owner's phone row (no step-down, `slowMs`) and the Drift A/B on his phone: owner checkpoint.
- CI Lighthouse after 4b (the local 5.5x proxy only).
- WebKit (no Safari here); 90/120 Hz screens; real finger flings.
- `npm run knip`, Lighthouse on the final build (the measured build differs only in code that is
  inert there), and measure-home's frames lanes on the final build (same reason).
- The 4b README and the spec updates (N7): not written here. The README is written after the
  review (`docs/qa/phase-07/steps/04b-phone/README.md`); the spec text is the integrator's.

## 10. After the review (2026-10-29, final build `BZSErZvhLrG0Uee6wo3oM`)

The review returned two blockers, four majors and twelve minors. Their fixes are in the worktree
(uncommitted) and in the patch series (`series/`). Only the rows the fixes can move were measured
again, each run after `quiet.sh` (load under 1). Files are in `d/`.

### 10.1 Engine creation (row 4): fixed

- **Cause** (review profile, 3 runs at 4x): the first scene's setup ran inside the creation task.
  For the hero that is the Drift, a ScrollTrigger and its first refresh, 13 to 28 ms at 4x, so the
  creation frame reached 52 to 64 ms.
- **Fix** (`scrollEngine.ts`): under 1024 px every setup is a task of its own, the first one too.
  The settle window that the creation opens (`data-settling`, 370 ms) covers the hero's first
  render, so the photo does not pop.
- **Gated T-PS-P4, 10 runs** (`d/perf-P4x10.log`): initMs 3.8, 4.9, 5.8, 5.9, 6.2, 6.4, 8.1, 8.8,
  9.8, 11.3 ms; longest task in the window **0** in 10 of 10. All passed.
- **Attribution, 8 + 8 runs** (`tools/engine-row.mjs`, `d/engine-row-4x.json`): with the intro
  skipped, initMs 1.4 to 11.4 ms and no long task in measure-home's window (engine request to 1 s
  after creation, which holds every setup task) in 8 of 8 runs; the creation is no long animation
  frame any more. With the intro playing, the only long tasks are the intro's end (53 to 88 ms)
  and, 5 to 17 ms after its mark, that frame's rendering (51 to 113 ms; the long task API reports
  the frame's style and layout as a second task). Both are also on `/?tier=0`, without an engine
  (`tools/intro-tasks.mjs`: 87 + 56 ms and 58 ms there). That is N1, pre-existing.
- **measure-home's creation column** (`d/m-creation/`, `--viewport=phone --tiers=1
  --sections=hero,trust --pace=16`, the intro plays): initMs 6.6, 5.7, 7.2 ms at 4x (the change
  before: 13.8 to 25.2 in the hts lane) and 10.5, 14.4, 11.3 ms at 6x (before: 28.7 to 36.4).
  The column's longest task, 59 to 81 ms at 4x and 90 to 136 ms at 6x, is N1 (N2: the window
  counts the intro). Hero 60/60 and trust 60/60 at 4x, clsAll 0 in 6 of 6.
- Unit: SE7 asserts that no trigger exists after `createScrollEngine` returns and that each scene
  sets up one task later. Red with the first setup inline again (`d/red/unit-red.log`, R1).

### 10.2 `?debug=1` on a phone: no canvas any more (review blocker 2)

- `ExperienceRoot.tsx`: the canvas chunk loads under the debug flag only when the pointer is not
  a phone's (`tier.debug && !tier.phone`). A phone draws no WebGL in phase 7, so the debug page
  now runs the DOM monitor a visitor gets, and the canvas monitor (2000 ms rule, samples at rest,
  `stepDown('monitor')`) can no longer write the light floor on the owner's phone.
- Tests: XR7 (unit; red with the old condition, R5). The e2e rows no longer block the canvas
  chunk (`blockCanvasChunk` is gone from `home-phone.spec.ts` and from T-PS-P3): T-PH5, T-PH8
  and T-PH12 now prove the real path. Against the build before the fix, T-PH12 went red at once:
  `tickSubscribers` 1 (the canvas's frame driver) (`d/red-e2e-oldbuild.log`).

### 10.3 Idle ticker and the monitor rows (review major 4, minor 12)

- `monitorFrames` calls `onFrame` on every frame of its loop; `runtime.monitor.frames` counts them
  (`store.ts`), and the snapshot and the overlay show it.
- T-PH12 and T-PS-P3 now read `frames` 1 s after the scroll ends and again 1 s later; it must not
  change. The old checks (`tickSubscribers`, sampled windows) could not see a loop that never
  stops: a still page samples no window.
- **Red proof on the final code** (redo of proof 9): a build whose `onScrollEnd` does not cancel
  the loop (`d/build-red.log`, BUILD_ID `0oQ5QHgutD36EXEOvVPz1`). T-PH12: frames 137 then 197 at
  rest, red (`d/red-e2e-T-PH12.log`). T-PS-P3: 60 frames in the second at rest, red; and with the
  same build's notice variant forced to 'loaded', the exact 'stepped' text check went red too
  (`d/red-perf-T-PS-P3.log`). Both files were restored and compared by SHA-256.
- **Gated T-PS-P3, 4 runs** (`d/perf-P3x4.log`): tier 1 after the full 4x scroll in 4 of 4;
  592 to 606 monitor frames during it and **0** in the next second; 0 tick subscribers. The slow
  page stepped after 7.56, 7.68, 7.67 and 7.61 s of swiping, relatched 2.07, 1.03, 1.03 and
  2.03 s after the last swipe (never early), and showed «جلوه‌ها روی این دستگاه کند بود، پس آن‌ها را
  خاموش کردیم.». clsAll 0.1388 is the debug overlay's own shift, as before.

### 10.4 The CPU signal (review major 3): visible, the site's intro left out

- `TierState.cpuBlockingMs` carries the last reading (at `load` and at the gate). The snapshot has
  `cpuBlockingMs` and the overlay's tier row ends with `cpu N ms`. Units: U-PH15a and DH6.
- `browserEnv.readMs()` no longer counts the long animation frame that holds the `intro:end` mark.
  That frame is the intro script's own work (dialog close and focus), not the device's. Test BE3.
- Measured (`tools/cpu-row.mjs`, `d/cpu-row.json`, `d/cpu-row-10x.json`): phone profile, auto mode,
  CPU throttled from the navigation, the sum from FCP to `load` + 1500 ms. "Before" is the sum with
  the intro's frame; "now" is what the store reads. The store's own value (`?debug=1`) matched "now"
  in all 12 debug runs.

| Rate | Intro | Now, ms (6 runs: 3 plain, 3 debug) | Before, ms | The intro's frame, ms |
|---|---|---|---|---|
| 4x | plays | 88, 105, 77; 101, 35, 60 | 161, 177, 161; 162, 106, 178 | 61 to 119 |
| 4x | skipped | 140, 66, 108; 124, 129, 102 | same | - |
| 6x | plays | 279, 335, 176; 153, 233, 144 | 456, 465, 238; 298, 367, 386 | 62 to 242 |
| 6x | skipped | 208, 305, 165; 217, 210, 164 | same | - |
| 10x | plays (3 plain) | 557, 643, 136 | 635, 690, 286 | 46 to 150 |
| 10x | skipped (3 plain) | 408, 753, 546 | same | - |

  With the intro's frame counted, 400 ms fell inside the 6x class (456 and 465): a 6x phone could
  get the light version from the site's own intro. Now 4x and 6x stay under 400 in 24 of 24 runs,
  and 10x reaches it in 5 of 6. The threshold is still a guess until the owner's phone and a GE8320
  phone are read (spec 5.4 calibration row); the checkpoint message asks for the overlay's value.

### 10.5 Bundle (row 9) and where the 2.8 KiB of step 4b go

- `check:bundle` on the final build (`d/bundle-final.log`): home **159.8 KiB** (target 160, gate
  170), content pages 144.7 to 149.6 KiB. The review fixes added 0.1 KiB.
- Per module (`tools/bundle-breakdown.mjs`, `d/bundle-breakdown.md`: each changed module of the
  home initial JS minified alone, gzip -9; alone they sum to 3.8 KiB, in the chunks the step adds
  2.8): `LightNotice.tsx` 1.94 KiB (new), `lightNotice.ts` 0.47 (new), `tierStore.ts` +0.50,
  `browserEnv.ts` +0.32, `ExperienceRoot.tsx` +0.18 (the engine gate), `qualityTier.ts` +0.16,
  `gpuProbe.ts` +0.13, `store.ts` +0.09, `query.ts` +0.03. The notice is about two thirds; the spec
  estimated at most 1 KiB for it.
- Margin 0.2 KiB. The voices handler (step 7) is estimated at 0.3 KiB, so step 7 will most likely
  take the fallback of spec 2.4 row 8 (the voices box at every tier as `invisible` plus `inert`).
  That rule needs no new decision; the 4b README records it.

### 10.6 INP (row 8)

`d/m-inp/README.md` (`--only=inp --viewport=phone --tiers=1,2`, 4x, median of 3): phone submits
hero 80 / 72 ms and block 80 / 80 ms at tiers 1 / 2; FAQ summary 48 / 48 ms; the notice switch
from tier 0 **64 ms** (96, 64, 48; before the label change 48). All under 200 ms.

### 10.7 The notice at a 200 % root font (review minor 8): the cause was not the buttons

- Probe (`tools/notice-probe.mjs`, `tools/vw-probe.mjs`): at 390x844 with the root font at 200 %,
  the header's logo makes the page 446 px wide. The notice is `position: fixed` with the gutter
  insets, so it spans that 446 px layout viewport: box [-24, 358] in a 390 px `clientWidth`, with
  the labels on one line and with them wrapped alike. `100vw` is 390 there.
- The review's fix, `whitespace-normal text-balance` on the house button, cannot work: in the
  built CSS `.whitespace-nowrap` comes after both (offsets 28881, 28843 and 28717 in the final
  build's site CSS), so it wins.
- Fix: the labels wrap in their own span, and the box is at most `min(28rem, 100vw - 2 gutters)`
  wide. Now [4, 330]; at 100 % nothing moves ([16, 374]). T-PH6 compares with `clientWidth`; it was
  red against the build before (`d/red-e2e-oldbuild.log`), and so was the new landscape check (the
  text line 12.8 px off the buttons' middle; now 1 px).
- Not fixed here: the page itself is 446 px wide at a 200 % root font (the header's logo). That is
  the header's, on every page.

### 10.8 Rows not measured again

- T0 gate and the frames rows (1, 2, 3): the fixes touch the creation tasks, the debug-only canvas
  path, the monitor's counter (auto mode; the frames lanes run `?tier=N`) and a Slide constant
  (24 to 16 px, the same tween). The 10.1 lane shows hero and trust at 60/60.
- Lighthouse TBT (row 5): the fix only splits one task into two shorter ones, which cannot raise
  TBT. Not run.
- clsAll (row 6): T-PH4 and T-PH5 pass on both phone themes in the final e2e run.

### 10.9 Owner media (review major 6)

`owner/`: `phone-390.mp4` (780x1688, 21 s) and `phone-390.webm` (390x844), the phone profile at
`?tier=1` with real touch swipes (CDP touch events, 300 px each, no fling), light theme, intro
played, no throttle. The band shows main's stand-in (a2ce69c), regenerated in `d/standin/` with
main's own code and served in place of this tree's grain raster; the byte counts match a2ce69c's.
Screenshots: top, services mid-Slide (the first card 8 px from the edge at x 7.9 of 16), the
notice in light, dark and landscape. `owner/message-fa.md` is the checkpoint message draft.
The earlier recording had the page in the top-left quarter of the frame (Playwright does not
scale the viewport up to the requested video size); these files are cropped.

### 10.10 Checks on the final code

- eslint (`--max-warnings=0`) and prettier on the changed files, `tsc --noEmit -p .`, and
  `scripts/check-has.mjs`: exit 0 (`d/final-*.log`).
- `npm run build`: BUILD_ID `NTv2iLrOCwyL507HjR-Hk`. Its runtime code equals the measured build of
  10.1 to 10.9 (`BZSErZvhLrG0Uee6wo3oM`) but for one comment in `browserEnv.ts`; the rest of the
  later edits are tests and docs.
- `npm run knip`: no finding.
- `npx vitest run`: 195 files, 3716 passed, 1 skipped, 1 failed: NT6 in `src/lib/notify/notify.test.ts`,
  which this change does not touch. It asserts that the log line has no `912` (a phone prefix),
  and that run's timestamp was `15:50:36.912Z`. The file passed 21 of 21 on its own right after.
- e2e on the final build: home-phone, home-hero, home-engine, experience, home and home-services on
  phone-light, phone-dark, tablet-light and desktop-light, 2 workers: **91 passed, 0 failed**, 145
  skipped by project rules (`d/final-e2e2.log`). T-EX5: engine chunk 54.7 KiB. T-PH12 now also
  asserts that no script with `WebGLRenderer` reaches a phone under `?debug=1`; against a build
  with the old debug condition it went red on that check (`d/red-e2e-T-PH12-canvas.log`).
