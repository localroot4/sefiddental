# Steps 5 to 8: combined quiet-host measurement (phase 7)

Date: 2026-10-29. Commit ed9fa8b (main, clean tree), BUILD_ID `03VpEEE04d3y7GRWC-HVB`, after
`npm run build` and `npm run db:e2e` (the QA fixture publishes the workflow block, one dentist,
one case and one testimonial). Chromium 141.0.7390.37 headless, default GPU. Host: 4 CPUs, no
other work. Every measured run started only when the 1-minute load average was under 1 (measured
at the run's start: 0.32 to 0.99; the gated Playwright runs: 0.52 to 0.99). This run replaces the
step 5 numbers taken at load 10.86 (`../05-restoration/README.md`). Every run is in
`results.json`.

## 1. Verdict

| Row | Budget | Measured | Pass |
|---|---|---|---|
| Desktop frames, restoration, tiers 1 and 2 (pace 16, restoration alone) | median ≥ 59, slowest window ≥ 55, worst frame ≤ 50 ms, 0 tasks > 100 ms (median of 3) | t1 60 / 60 / 16.8 / 0; t2 60 / 58 / 50 / 0 | pass |
| Desktop frames, workflow, compare, dentists, voices, journey (first-visit), faq, booking, footer, none; tiers 1 and 2 (pace 80 whole page, and pace 16 workflow to footer) | as above | 18 of 18 section rows within budget on the median of 3 (lowest slowest-window median: 58); single runs had a worst frame over 50 ms 3 times (journey t2 66.8, workflow t1 50.1, footer t2 50.1); journey, faq, footer and compare at t2 hold no full 1 s window at pace 80, all hold them at pace 16 (2.1) | pass |
| Phone frames, the same sections, tiers 0, 1 and 2 (phone profile, 4x) | t0: median ≥ 58, slowest ≥ 55; t1 and t2: the P-F row against t0 | 27 judged rows (`none` is not judged), 0 misses (2.2) | pass |
| INP: restoration chip, compare drag, voices «بعدی», footer part press | ≤ 200 ms, median of 3 | 24 to 80 ms (desktop and phone, tiers 1 and 2) | pass |
| INP: hero and booking-block submits | ≤ 200 ms on every row | 56 to 96 ms (desktop and phone, tiers 0, 1 and 2: 12 rows) | pass |
| INP: «کیفیت» switch, phone (1 → 2, 2 → 1) | ≤ 200 ms | 128 ms, 72 ms | pass |
| INP: «کیفیت» switch, desktop, 1 → 2 | ≤ 200 ms | 184 ms (184, 224, 168) | pass (16 ms margin) |
| INP: «کیفیت» switch, desktop, 2 → 1 | ≤ 200 ms | **272 ms** (280, 272, 240) | **FAIL** (3.2) |
| clsAll, load and full scroll: phone tiers 0 to 2, desktop tier 1 | 0 (gate 0.05) | 0 in 9 + 9 runs | pass |
| clsAll, load and full scroll: desktop tier 2 | 0 (gate 0.05) | **1.554** in 3 of 3 whole-page runs (cls by the web-vitals rule 0.777) and 1.55 to 3.10 in 3 of 3 workflow-to-footer runs; 0.0002 in the restoration-only lane | **FAIL** (3.1) |
| clsAll, reload with the scroll restored at voices: phone tiers 1 and 2 (the phone spec row) | 0 | 0 in 6 runs (scroll restored to the voices top each time) | pass |
| clsAll, reload at voices: desktop (recorded) | 0 | t1 0 (restored to 5910 px, voices at 6910); **t2 1.0** in 3 of 3 (restored to 5953 px, inside the workflow pin; voices at 10356) | **FAIL** (3.1) |
| Heap growth over a full scroll down and up, after GC (T-PS, `PERF_GATE=1`) | ≤ +0.5 MiB per run | t2: +0.3, +0.3, +0.4; t1 (extra): +0.7, 0.0, 0.0 | t2 pass; t1 1 of 3 over (3.4) |
| Heap after a scroll down only and GC (measure-home method, recorded) | ≤ +0.5 MiB | desktop t1 +0.5, t2 +0.8; phone t1 +0.8, t2 +0.7 (each 3 of 3) | **over**, one-time, not a leak (3.4) |
| `check:bundle` home | target ≤ 160 KiB, gate ≤ 170 KiB | **160.8 KiB**, exit 0; content pages 144.7 to 149.6, booking pages 148.2 and 148.9 | gate pass, **target FAIL** (3.3) |
| `PERF_GATE=1` T-PS tier 2 at 4x on perf-default, 3 repeats | every report section 5 budget per run | repeat 1 failed (booking worst frame 66.7 ms; no long task); repeats 2 and 3 passed | **FAIL** 1 of 3 (3.5) |

Full row-by-row verdict (85 rows): `results.json` → `verdict`.

## 2. Detail tables

All at CPU 4x. Desktop is 1440x900 with the mouse wheel (measure-home's method); phone is the
phone profile (390x844, DPR 3, touch, `isMobile`) with CDP touch swipes, finger travel 80 px per
50 ms, CPU throttled from the navigation; the profile precondition (coarse, under 1024 px, no
Lenis) held in every phone run.

### 2.1 Desktop frames per section (1440x900, 4x, median of 3 field by field)

Each cell: median fps / slowest 1 s window fps / worst frame ms / long tasks over 100 ms. Pace 80 is the whole page (measure-home default); pace 16 is restoration alone (`--sections=restoration`) and, as a second lane, workflow to footer (`--sections=workflow,compare,dentists,voices,journey,faq,booking,footer`), where a short section holds full 1 s windows.

| Section | Tier | Pace 80 (runs 1 / 2 / 3 → median) | Pace 16 (runs 1 / 2 / 3 → median) | Pass |
|---|---|---|---|---|
| restoration | 1 | -/-/50 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| workflow | 1 | 60/60/33.4 · 59.5/59/33.3 · 60/60/16.8 → **60 / 60 / 33.3 ms / 0** | 60/58/50.1 · 60/59/33.4 · 60/58/33.4 → **60 / 58 / 33.4 ms / 0** | pass |
| compare | 1 | 59/59/33.3 · 60/60/16.8 · -/-/16.8 → **59 / 59 / 16.8 ms / 0** | 59.5/59/33.3 · 60/59/33.3 · 60/60/16.8 → **60 / 59 / 33.3 ms / 0** | pass |
| dentists | 1 | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/57/33.4 → **60 / 60 / 16.8 ms / 0** | pass |
| voices | 1 | 58/58/50 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | 60/59/33.3 · 60/59/50 · 60/58/33.4 → **60 / 59 / 33.4 ms / 0** | pass |
| journey (first-visit) | 1 | -/-/16.8 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/59/33.4 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| faq | 1 | -/-/33.3 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| booking | 1 | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/59/33.4 → **60 / 60 / 16.8 ms / 0** | pass |
| footer | 1 | -/-/16.8 · -/-/33.3 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| none | 1 | -/-/16.8 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | - | pass |
| restoration | 2 | 59/59/33.4 · 58/58/33.4 · 58/58/33.4 → **58 / 58 / 33.4 ms / 0** | 60/59/33.3 · 60/58/50 · 59.5/58/50 → **60 / 58 / 50 ms / 0** | pass |
| workflow | 2 | 60/59/33.4 · 60/60/33.4 · 60/59/33.4 → **60 / 59 / 33.4 ms / 0** | 60/59/33.4 · 60/59/33.4 · 60/58/50.1 → **60 / 59 / 33.4 ms / 0** | pass |
| compare | 2 | -/-/16.8 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/59/33.4 → **60 / 60 / 16.8 ms / 0** | pass |
| dentists | 2 | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | 60/60/16.8 · 60/59/33.4 · 60/59/33.4 → **60 / 59 / 33.4 ms / 0** | pass |
| voices | 2 | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| journey (first-visit) | 2 | -/-/16.8 · -/-/16.8 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 59.5/56/66.8 → **60 / 60 / 16.8 ms / 0** | pass |
| faq | 2 | -/-/33.3 · -/-/50 · -/-/16.8 → **no window / 33.3 ms / 0** | 60/60/16.8 · 59/58/50 · 59.5/59/33.4 → **59.5 / 59 / 33.4 ms / 0** | pass |
| booking | 2 | 60/60/16.8 · 59/59/33.3 · 59/59/33.3 → **59 / 59 / 33.3 ms / 0** | 60/58/33.4 · 60/58/50 · 60/60/16.8 → **60 / 58 / 33.4 ms / 0** | pass |
| footer | 2 | -/-/16.8 · -/-/50.1 · -/-/16.8 → **no window / 16.8 ms / 0** | 60/60/16.8 · 60/60/16.8 · 60/60/16.8 → **60 / 60 / 16.8 ms / 0** | pass |
| none | 2 | -/-/16.7 · -/-/33.3 · -/-/16.7 → **no window / 16.7 ms / 0** | - | pass |

### 2.2 Phone frames per section (390x844 touch, 4x, pace 80, median of 3 field by field)

| Section | Tier | Median fps | Slowest window fps | Worst frame ms | Frames over 33 ms / frames | Tasks > 100 ms | Misses (phoneMisses) | Pass |
|---|---|---|---|---|---|---|---|---|
| restoration | 0 | 60 | 60 | 16.8 | 0 / 82 | 0 | - | pass |
| restoration | 1 | 60 | 60 | 16.8 | 0 / 107 | 0 | - | pass |
| restoration | 2 | 60 | 60 | 16.8 | 0 / 107 | 0 | - | pass |
| workflow | 0 | 60 | 60 | 16.8 | 0 / 202 | 0 | - | pass |
| workflow | 1 | 60 | 60 | 16.8 | 0 / 291 | 0 | - | pass |
| workflow | 2 | 60 | 59 | 33.3 | 1 / 292 | 0 | - | pass |
| compare | 0 | 59 | 59 | 33.3 | 1 / 80 | 0 | - | pass |
| compare | 1 | 60 | 60 | 16.8 | 0 / 99 | 0 | - | pass |
| compare | 2 | 60 | 60 | 16.8 | 0 / 100 | 0 | - | pass |
| dentists | 0 | 60 | 60 | 16.8 | 0 / 94 | 0 | - | pass |
| dentists | 1 | 60 | 60 | 16.8 | 0 / 107 | 0 | - | pass |
| dentists | 2 | 60 | 60 | 16.8 | 0 / 107 | 0 | - | pass |
| voices | 0 | 60 | 60 | 16.8 | 0 / 86 | 0 | - | pass |
| voices | 1 | 60 | 60 | 16.8 | 0 / 101 | 0 | - | pass |
| voices | 2 | 60 | 60 | 33.3 | 1 / 101 | 0 | - | pass |
| journey | 0 | 60 | 60 | 16.8 | 0 / 71 | 0 | - | pass |
| journey | 1 | 60 | 60 | 16.8 | 0 / 88 | 0 | - | pass |
| journey | 2 | 60 | 60 | 16.8 | 0 / 88 | 0 | - | pass |
| faq | 0 | 60 | 60 | 16.8 | 0 / 76 | 0 | - | pass |
| faq | 1 | 60 | 60 | 16.8 | 0 / 86 | 0 | - | pass |
| faq | 2 | 60 | 60 | 16.8 | 0 / 86 | 0 | - | pass |
| booking | 0 | 60 | 60 | 16.8 | 0 / 157 | 0 | - | pass |
| booking | 1 | 60 | 60 | 16.8 | 0 / 173 | 0 | - | pass |
| booking | 2 | 60 | 60 | 16.8 | 0 / 173 | 0 | - | pass |
| footer | 0 | 60 | 60 | 16.8 | 0 / 73 | 0 | - | pass |
| footer | 1 | 60 | 60 | 16.8 | 0 / 90 | 0 | - | pass |
| footer | 2 | 60 | 60 | 16.8 | 0 / 89 | 0 | - | pass |
| none | 0 | 60 | 60 | 16.8 | 0 / 102 | 0 | - | pass |
| none | 1 | 60 | 60 | 16.8 | 0 / 103 | 0 | - | pass |
| none | 2 | 60 | 60 | 16.8 | 0 / 103 | 0 | - | pass |

### 2.3 INP (CPU 4x, median of 3; budget at most 200 ms)

| Row | Viewport | Tier | INP ms median (runs) | Slowest run: event, input delay / processing / presentation ms | Effect seen | Pass |
|---|---|---|---|---|---|---|
| restoration chip | desktop | 1 | 64 (56, 64, 64) | pointerdown, 9 / 2.6 / 52.4 | true; true; true | pass |
| restoration chip | desktop | 2 | 56 (56, 64, 56) | pointerdown, 11.1 / 1.8 / 51.1 | true; true; true | pass |
| restoration chip | phone | 1 | 64 (64, 64, 112) | pointerdown, 20.2 / 4.4 / 87.4 | true; true; true | pass |
| restoration chip | phone | 2 | 80 (96, 80, 72) | pointerdown, 26.3 / 3.3 / 66.4 | true; true; true | pass |
| compare slider drag | desktop | 1 | 24 (24, 24, 16) | pointerdown, 10 / 2.5 / 11.5 | "78"; "78"; "78" | pass |
| compare slider drag | desktop | 2 | 40 (40, 40, 16) | pointerdown, 3.2 / 1.2 / 35.6 | "78"; "78"; "78" | pass |
| compare slider drag | phone | 1 | 32 (32, 32, 32) | pointerup, 16.3 / 1.1 / 14.6 | "85"; "85"; "85" | pass |
| compare slider drag | phone | 2 | 32 (32, 32, 32) | pointerdown, 25.5 / 3.3 / 3.2 | "85"; "85"; "85" | pass |
| voices «بعدی» | desktop | 1 | 40 (32, 56, 40) | pointerdown, 11.9 / 9.6 / 34.5 | {"scrollLeft":400,"tier":"1"}; {"scrollLeft":400,"tier":"1"}; {"scrollLeft":400,"tier":"1"} | pass |
| voices «بعدی» | desktop | 2 | 40 (40, 32, 56) | pointerdown, 10.6 / 8.1 / 37.3 | {"scrollLeft":400,"tier":"2"}; {"scrollLeft":400,"tier":"2"}; {"scrollLeft":400,"tier":"2"} | pass |
| voices «بعدی» | phone | 1 | 48 (48, 56, 48) | pointerdown, 24.2 / 4.7 / 27.1 | {"scrollLeft":317,"tier":"1"}; {"scrollLeft":317,"tier":"1"}; {"scrollLeft":317,"tier":"1"} | pass |
| voices «بعدی» | phone | 2 | 56 (56, 40, 72) | click, 54.6 / 2.3 / 15.1 | {"scrollLeft":317,"tier":"2"}; {"scrollLeft":317,"tier":"2"}; {"scrollLeft":317,"tier":"2"} | pass |
| footer part press | desktop | 1 | 40 (32, 40, 40) | pointerdown, 1.4 / 16.3 / 22.3 | 6; 6; 6 | pass |
| footer part press | desktop | 2 | 40 (40, 40, 40) | pointerdown, 0.8 / 15.3 / 23.9 | 6; 6; 6 | pass |
| footer part press | phone | 1 | 48 (48, 48, 40) | pointerdown, 8.7 / 19.2 / 20.1 | 6; 6; 6 | pass |
| footer part press | phone | 2 | 64 (64, 64, 64) | pointerup, 41.1 / 2.5 / 20.4 | 6; 6; 6 | pass |
| «کیفیت» switch 1 → 2 | desktop | 1 | 184 (184, 224, 168) | pointerdown, 18.8 / 0.9 / 204.3 | "2"; "2"; "2" | pass |
| «کیفیت» switch 2 → 1 | desktop | 2 | 272 (280, 272, 240) | pointerdown, 7.3 / 2.3 / 270.4 | "1"; "1"; "1" | **FAIL** |
| «کیفیت» switch 1 → 2 | phone | 1 | 128 (128, 120, 160) | click, 58.9 / 65.7 / 35.4 | "2"; "2"; "2" | pass |
| «کیفیت» switch 2 → 1 | phone | 2 | 72 (72, 80, 72) | pointerdown, 38.9 / 2.5 / 38.6 | "1"; "1"; "1" | pass |
| hero submit | desktop | 0 | 72 (72, 56, 72) | pointerdown, 7.2 / 8 / 56.8 | "success"; "success"; "success" | pass |
| hero submit | desktop | 1 | 96 (56, 96, 96) | pointerdown, 8.3 / 10.1 / 77.6 | "success"; "success"; "success" | pass |
| hero submit | desktop | 2 | 56 (56, 56, 64) | pointerdown, 7.1 / 6.1 / 50.8 | "success"; "success"; "success" | pass |
| hero submit | phone | 0 | 72 (80, 72, 72) | click, 43.3 / 20.6 / 16.1 | "success"; "success"; "success" | pass |
| hero submit | phone | 1 | 80 (80, 88, 64) | pointerdown, 10.4 / 2 / 75.6 | "success"; "success"; "success" | pass |
| hero submit | phone | 2 | 80 (96, 80, 80) | pointerdown, 15.5 / 2.6 / 77.9 | "success"; "success"; "success" | pass |
| booking-block submit | desktop | 0 | 72 (72, 64, 80) | pointerdown, 6.9 / 9.9 / 63.2 | "success"; "success"; "success" | pass |
| booking-block submit | desktop | 1 | 80 (88, 72, 80) | pointerdown, 7.8 / 6.5 / 73.7 | "success"; "success"; "success" | pass |
| booking-block submit | desktop | 2 | 80 (80, 72, 88) | pointerdown, 7 / 7.1 / 73.9 | "success"; "success"; "success" | pass |
| booking-block submit | phone | 0 | 88 (72, 88, 112) | click, 54.3 / 36.2 / 21.5 | "success"; "success"; "success" | pass |
| booking-block submit | phone | 1 | 96 (112, 80, 96) | pointerdown, 7.7 / 4.3 / 100 | "success"; "success"; "success" | pass |
| booking-block submit | phone | 2 | 80 (88, 80, 80) | pointerdown, 11.8 / 2.3 / 73.9 | "success"; "success"; "success" | pass |

### 2.4 Gated perf runs (`PERF_GATE=1 npx playwright test tests/perf/scenes.spec.ts --project=perf-default`)

The T-PS rows scroll down and back up with a 40 px wheel step every 50 ms. Each repeat was its own
invocation, started at load under 1. Tier 1 is extra evidence; the brief asked for tier 2.

| Test | Repeat | Status | Heap after GC minus start (MiB) | Failed expectations |
|---|---|---|---|---|
| T-PS tier 2 at 4x | 1 | failed | +0.3 | booking worst frame 66.7 ms > 50 (median 59, slowest 55, 0 long tasks) |
| T-PS tier 2 at 4x | 2 | passed | +0.3 | - |
| T-PS tier 2 at 4x | 3 | passed | +0.4 | - |
| T-PS tier 1 at 4x | 1 | failed | +0.7 | heap +0.7 > 0.5 (4.3 / 5.0 / 5.0 MiB) |
| T-PS tier 1 at 4x | 2 | failed | 0.0 | restoration median 58.5 < 59, worst 50.1 ms > 50 |
| T-PS tier 1 at 4x | 3 | passed | 0.0 | - |

## 3. Failing rows: cause and the smallest fix

Fixes were tried only in a scratch copy of ed9fa8b, built on its own; nothing in this repo was
changed. Evidence: `results.json` → `fixExperiments`.

### 3.1 Desktop tier 2: the workflow pin is a layout shift of 0.777 at each pin edge

- **Where.** Every desktop tier-2 scroll reports two `layout-shift` entries of 0.7769 each, with no
  recent input. They come at the workflow pin's start (scrollY about 5714) and its end (about 7542).
  The source is the pinned stage `div.group/wf` with `previousRect` empty and `currentRect`
  72 / 828 / 1216 px. 0.7769 is the stage's share of the viewport (1216 x 828 / 1440 x 900). So
  web-vitals CLS on desktop tier 2 is 0.777, and the gate is 0.05. A reload lands inside the pin
  (scroll restoration at 5953 px) and gives 1.0.
- **What it is not.** The stage does not move: its rect is 72 / 828 before and after the switch to
  `position: fixed`, and the spacer and the page height do not change. Restoration and services
  use the same ScrollTrigger pin options and report 0. In-page tests on the workflow stage did not
  remove the entry: `overflow: visible` (the source moves to `.site`, 0.4056), `overflow: hidden`,
  `position: static`, a background, `contain: paint`, an in-flow child, an in-flow path. So it is
  Chromium's layout-shift attribution of this fixed-pin switch. Restoration and services avoid it
  for a reason not found here.
- **Fix (tested).** In `src/experience/scenes/dom/workflow.ts`, add `pinType: 'transform'` to the
  pin's `scrollTrigger`. Scratch build, 3 + 3 runs at load under 1: clsAll **0.0002** on the whole
  page (the restoration link below) and **0** in the workflow-to-footer lane. Workflow frames: pace 80
  60 / 59 / 33.3 ms on the median of 3 (runs 60/59/33.3, 60/60/16.8, 60/56/66.7); pace 16 60 / 58 /
  50 ms (runs 60/58/50, 60/52/83.3, 60/58/33.3). The median of 3 holds the budget. Single runs are
  noisier than without the fix (worst 66.7 and 83.3 ms in one run each). A transform pin follows Lenis on desktop, the
  only place where this pin exists (tiers 2 and 3 from 1024 px). Before it lands, run T-WF* and
  T-PS tier 2 three times, and look at a touch laptop at 1024 px or wider (coarse pointer, no
  Lenis), where a transform pin can lag the native scroll.
- **Also seen (0.0002, under the 0.05 gate, over the 0 target).** At tier 2 the restoration CTA
  link moves 29 px (y 469 → 498) when the pinned stepper changes panel, because the panels have
  different heights. Proposed (not tested): stack the panels in one grid cell, so the box keeps the
  tallest panel's height.

### 3.2 «کیفیت» switch, desktop 2 → 1: INP 272 ms

- **Cause (LoAF, 2 runs).** The `click` listener (React's root `onclick`) runs 181 and 194 ms,
  with 127 and 132 ms of forced style and layout. `onChange` calls `tier.setUserOverride` at once.
  The store notifies synchronously, React renders the discrete update, and the old engine's
  teardown (pin and context revert) runs inside the click task. The next paint waits for it.
  1 → 2 costs less (184 ms) because no pinned scene is reverted before it.
- **Fix (tested).** In `src/components/home/QualityControl.tsx`, let the click paint first:
  `onChange={() => requestAnimationFrame(() => setTimeout(() => tier.setUserOverride(option), 0))}`.
  Scratch build: desktop **32 to 48 ms** in both directions, phone 56 to 72 ms, the tier switches
  every time. The work moves to a task after the paint (153 and 158 ms at 4x, 108 ms of it forced
  layout). That task is not INP, but it is still a long task. The radio shows the new choice one
  frame later. Before it lands, run QualityControl's unit tests and T-BF8.

### 3.3 `check:bundle` home 160.8 KiB (target 160, gate 170)

- **Cause.** Step 4b ended at 159.8 KiB with a 0.2 KiB margin. Steps 5 to 8 add one client island
  to the home initial JS: `QualityControl.tsx`, 0.88 KiB minified alone and gzip -9 (900 bytes).
  The other client change, `HomeBookingPrefill.tsx`, only adds an `isTrusted` check. The report
  allowed the «کیفیت» island in the 160 KiB target, but 4b's light notice had taken 1.94 KiB
  against an estimate of 1 KiB.
- **Smallest fix (not tested).** The control sits at the bottom of the page. Ship its markup as
  server HTML and load the island lazily (`next/dynamic`) when the footer stage nears, as the
  Draggable chunk does. That takes about 0.9 KiB out of the initial JS, back to about 159.9 KiB.
  The alternative is to record 160.8 KiB against the target as a decision; the 170 KiB gate holds.

### 3.4 Heap

- **Gate (down and up, T-PS).** Tier 2: +0.3, +0.3, +0.4 MiB, pass. Tier 1 repeat 1: +0.7 MiB, with
  no drop at GC (5.0 → 5.0). Repeats 2 and 3 were 0.0. Not reproduced. No fix proposed.
- **Down only (measure-home, recorded).** +0.5 to +0.8 MiB in every run at tiers 1 and 2. A second
  full pass in the same page adds +0.1 MiB (desktop t2: 4.9 → 5.6 → 5.7; desktop t1: 4.4 → 4.8 →
  4.9) or nothing (phone t1: 4.3 → 5.0 → 4.4) (`results.json` → `notes.heapTwoPasses`). So the
  growth is a one-time cost of the first pass (scene code and lazy chunks such as Draggable,
  Inertia and MorphSVG compiled on first use), not a leak. If the section 5 row keeps the
  measure-home method, its +0.5 MiB budget does not fit a first pass that loads the lazy chunks.
  Measure it as T-PS does, or allow for those chunks.

### 3.5 T-PS tier 2, repeat 1: one 66.7 ms frame in booking

There was no long task in the run (0 over 50 ms). The booking median was 59 and the slowest window
55. Booking held 60 / 60 / 16.8 and 60 / 59 / 33.3 in the other two repeats. It held 59 / 59 / 33.3
(pace 80) and 60 / 58 / 33.4 (pace 16) on the median of 3 in the measure-home lanes. This is one
dropped pair of frames with no main-thread cause on record. No code fix is proposed. The 4b
recommendation stands: judge T-PS on the median of 3 repeats, as the measure-home rows are judged.

## 4. Method

- Driver: `drive.mjs` in the session scratchpad (not committed). It reuses measure-home's exported
  `settle`, `startSampler`, `observeShiftsAndTasks`, `clsFrom`, `heapMiB`, `frameSummary`,
  `phoneMisses` and the repo helpers (`throttleCpu`, `scrollThrough`, `sectionFrameStats`,
  `VIEWPORTS`, `defaultLaunch`). It repeats `measureFrames` at 4x on the default GPU with one
  addition: it waits for a load average under 1 before every run. measure-home runs its 24 frames
  runs back to back and adds 6x and SwiftShader runs that this brief did not ask for. The server is
  `scripts/start-standalone.mjs` with measure-home's environment on port 3000.
- Lanes: desktop whole page at pace 80 (tiers 1, 2); desktop `--sections=restoration --pace=16`;
  desktop `--sections=workflow,compare,dentists,voices,journey,faq,booking,footer --pace=16`
  (added because 4 sections held no 1 s window at pace 80); phone whole page at pace 80 (tiers 0, 1,
  2). Three runs each, median field by field.
- INP: Event Timing (`durationThreshold` 16 ms), the worst entry with an `interactionId` after the
  action, CPU 4x, 3 runs per row, a new context per run. Desktop clicks with the mouse; phone taps.
  The compare drag is a pointer or a touch drag of 120 px in 15 moves 30 ms apart from the thumb at
  50 (the value went to 78 on desktop and 85 on the phone every time). The fixture has one
  testimonial, so «بعدی» does not exist (`data-single`). As in T-S8, six clones were added and the
  scene was re-created through the «کیفیت» radios (0, then the tier) before the press; the row
  moved 400 px (desktop) and 317 px (phone). At tier 0 the voices buttons are invisible and inert
  under 1024 px and hidden from 1024 px (D24), so there is no tier-0 «بعدی» row. The «کیفیت» rows
  start from a stored choice (`sefid-quality` 1 or 2, no `?tier`) and press the other tier. The
  part press is a 80 ms press on the first playground part after the drop settled. The submits
  repeat measure-home's procedure (the booking POST answered `{ ok: true }`; 3 of 3 success states
  per row).
- Reload at voices: load, scroll to the voices top (offset chain), reload, then 3.5 s; clsAll
  from navigation (T-PH4's procedure).
- `npm run check:bundle` once; the gated T-PS runs as in 2.4.

## 5. Not verified

- The two tested fixes ran in a scratch build only, without the e2e suite, lint or unit tests.
  Neither ran on a touch laptop or a real device.
- The cause of the empty `previousRect` inside Chromium was not traced (no Chromium trace of the
  LayoutShiftTracker). The fix rests on the measurement.
- Lighthouse, 6x, SwiftShader, engine creation and the monitor rows were not part of this brief.
