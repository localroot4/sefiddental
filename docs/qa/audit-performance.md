# Performance audit (phase 9, lane PERF)

Base: `main` at `9948d21` (wave 1 merged) plus this lane's series. Date: 2026-10-30. Scope:
`docs/prompts/09-quality-gate.md` deliverable 2, plan section 5.4, the budgets of
`docs/brief.md` section 7 and `tests/budgets/limits.json` (unchanged: no threshold moved).

Host: the 4-CPU measurement container, Chromium 141.0.7390.37, Lighthouse 12.6.1 (LHCI
0.15.1), benchmarkIndex 1793 (CPU slowdown 4x for the mobile preset). Every timing run held the
exclusive measurement lock: no build, test or e2e of another lane ran beside it (their idle
servers and editors did). The standalone build of this tree on the e2e database
(`npm run build`, `npm run db:e2e`).

Result: **every CI gate passes, and the font-swap shift is fixed (0.057 to 0.0008).**
Still missed against the documented targets:

- initial JS on content, booking and emergency pages (the framework floor, known since
  phase 3);
- booking and emergency LCP 2.0 s (best run 1.97 to 2.12 s, all text render delay);
- home LCP 2.5 s on the light median (2.56 s; the best-of-5 gate passes by 12 ms);
- two of the 20 phase 7 frame rows: services at tier 2 and faq at tier 1 (single dropped
  frames, no long task; `p9/findings/perf.md`).

One INP entry (typing in the home booking block) needs a trace and a real device
(section 4.2).

## 1. Brief 7 table

Target: `docs/brief.md` section 7. Gate: what CI enforces (`lighthouserc.cjs`,
`scripts/lhci.mjs`, `scripts/check-bundle.mjs`, `tests/budgets/limits.json`). Mobile preset,
5 runs per URL, light and dark.

| Row | Target | Gate | Measured | Gate | Target |
|---|---|---|---|---|---|
| Content pages, performance score | ≥ 0.95 | warn at 0.95 (median) | light 0.98 to 0.99, dark 0.98 to 0.99 (404 template, restoration service, pricing) | pass | pass |
| Content pages, LCP | ≤ 2.5 s | best of 5 ≤ 2500 ms | best 1812 to 2188 ms; median 1967 to 2265 ms | pass | pass (median too) |
| Content pages, CLS | ≤ 0.05 | median ≤ 0.05 | 0 in every run, both themes | pass | pass |
| Content pages, TBT (INP proxy) | 200 ms | median ≤ max(400, floor + 250) | median 5 to 86 ms | pass | pass |
| Content pages, other categories | 100 | 100 (median) | accessibility, best practices, SEO 100 | pass | pass |
| Booking and emergency, LCP | ≤ 2.0 s | best of 5 ≤ 2500 ms (freeze G19: the 2.0 s target is reported) | booking best 2116 / 2114 ms, median 2148 / 2275 ms; emergency best 2110 / 1965 ms, median 2125 / 2114 ms (light / dark) | pass | **miss** by 0.1 to 0.3 s |
| Booking and emergency, score | ≥ 0.95 | warn at 0.95 | 0.97 to 0.99 | pass | pass |
| Home tier 1, score | ≥ 0.90 | median ≥ 0.90 (error) | 0.96 light, 0.97 dark (measure-home: 0.97) | pass | pass |
| Home tier 1, LCP | ≤ 2.5 s | best of 5 ≤ 2500 ms | best 2488 / 2410 ms, median 2560 / 2487 ms | pass (12 ms margin, light) | median misses in light |
| Home tier 0, score | ≥ 0.95 | warn at 0.95 | 0.96 light, 0.97 dark | pass | pass |
| Home tier 0, LCP | ≤ 2.5 s | best of 5 ≤ 2500 ms | best 2488 / 2485 ms, median 2563 / 2492 ms | pass (12 ms margin) | median misses in light |
| Home CLS (load) | ≤ 0.05 | median ≤ 0.05 | 0 at tiers 0 and 1, both themes | pass | pass |
| Fonts | ≤ 120 KiB | ≤ 120 KiB | 89.8 KiB transfer (Vazirmatn 58.0, Estedad 31.6) | pass | pass |
| CSS | ≤ 50 KiB gz | ≤ 50 KiB | 16.7 KiB content, 17.2 KiB home (transfer) | pass | pass |
| Initial JS, home | 180 KB | 170 KiB (`check:bundle`) | 160.3 KiB | pass | pass |
| Initial JS, content | 90 KB | 150 KiB | 144.7 to 149.6 KiB | pass (0.4 KiB headroom) | **miss** (framework floor 143.9 KiB shared) |
| Initial JS, booking and emergency | 70 KB | 150 KiB | 148.9 / 148.2 KiB | pass | **miss** (framework floor) |
| `check:bundle` | exit 0 | exit 0 | exit 0 | pass | pass |
| Font swap, desktop home, fonts 1.5 s late | CLS ≤ 0.05 in 5 of 5 | measure-home `fonts` lane (recorded) | 0.0008 in 15 of 15 runs (tiers 0, 1, 2); before: 0.043 to 0.057, 3 of 5 over | pass | pass |
| Frames, desktop 1440x900, 4x, default GPU, tiers 1 and 2, every section (phase 7 rows) | 60 fps at tier 2, ≥ 50 at tier 1 | phase 7 numbers: median ≥ 59, slowest 1 s window ≥ 55, worst frame ≤ 50 ms, no task over 100 ms (median of 3; recorded, `PERF_GATE=1` locally) | quiet run: 18 of 20 rows pass; **services tier 2** 60 / 54 / 66.7 ms (full run 57.5 / 56 / 50) and **faq tier 1** at pace 16 60 / 57 / 66.6 ms miss; 0 tasks over 100 ms anywhere | **2 rows miss** | tier 1 ≥ 50 pass; tier 2 60 missed in single windows |
| INP, hero and booking-block submits (measure-home, CPU 4x) | ≤ 200 ms | recorded | 72 to 160 ms, desktop and phone, tiers 0, 1, 2 (36 runs) | pass | pass |
| INP, typing in the home booking block, desktop tiers 1 and 2 | ≤ 200 ms | recorded | worst entry 928 to 1008 ms in 1 to 4 of 6 runs: a `keydown` with 0 ms input delay, 1 ms processing, 943 ms to the next frame; 40 to 96 ms otherwise | recorded | **open**: cause not found (section 4.2) |
| Thresholds | none lowered | `git diff tests/budgets` empty | empty | pass | pass |

## 2. Lighthouse, mobile preset (`npm run lhci`)

`npm run lhci` exit 0. LCP in ms, min / median / max of 5; score and TBT on the median.

| Page | Light LCP | Light score | Light TBT | Dark LCP | Dark score | Dark TBT | LCP element |
|---|---|---|---|---|---|---|---|
| `/qa/floor` (framework floor, not asserted) | 1360 / 1378 / 2919 | 0.99 | 13 | 1366 / 1665 / 1675 | 1.00 | 35 | `body > p` |
| `/qa/not-found` | 1964 / 1967 / 2127 | 0.99 | 5 | 1817 / 2112 / 2265 | 0.99 | 7 | the 404 paragraph |
| `/خدمات/ترمیم-دندان` | 2113 / 2195 / 2342 | 0.98 | 86 | 2188 / 2190 / 2337 | 0.98 | 70 | the lead paragraph |
| `/هزینه-و-پرداخت` | 1812 / 2111 / 2565 | 0.99 | 31 | 1963 / 2265 / 2409 | 0.98 | 12 | the lead paragraph |
| `/رزرو-نوبت` | 2116 / 2148 / 2573 | 0.97 | 82 | 2114 / 2275 / 2571 | 0.98 | 17 | the form's intro line |
| `/اورژانس` | 2110 / 2125 / 2268 | 0.99 | 9 | 1965 / 2114 / 2420 | 0.99 | 7 | the lead paragraph |
| `/?tier=0` | 2488 / 2563 / 2709 | 0.96 | 68 | 2485 / 2492 / 2864 | 0.97 | 52 | `h1#hero-h1` |
| `/?tier=1` | 2488 / 2560 / 2638 | 0.96 | 69 | 2410 / 2487 / 2495 | 0.97 | 53 | `h1#hero-h1` |

Every LCP element is text. The breakdown is the same on every page: TTFB about 610 ms
(Lighthouse's simulated 4G round trips), no load delay, and a render delay of 1.2 to 2.1 s,
which is the simulated main thread running the framework scripts at 4x. The framework floor
page alone renders its paragraph at 1.36 s. Booking and emergency stay over 2.0 s for that
reason; a cut there means less framework JS before the first paint, which no page-level change
in this lane can do. The dentist profile and the articles are no longer in the list: none
publishes at launch (decision 1a; plan section 8 moves their audit to the first publication).

## 3. Lighthouse, desktop preset (`LHCI_FORM_FACTOR=desktop`)

`LHCI_FORM_FACTOR=desktop LHCI_CPU_MULTIPLIER=1 npm run lhci` exit 0 (every assertion of the
mobile run holds on desktop too). LCP min / median / max in ms; score median.

| Page | Light LCP | Dark LCP | Score (both) | TBT |
|---|---|---|---|---|
| `/qa/floor` | 342 / 370 / 458 | 337 / 373 / 449 | 1.00 | 0 |
| `/qa/not-found` | 464 / 480 / 500 | 459 / 476 / 525 | 1.00 | 0 |
| `/خدمات/ترمیم-دندان` | 574 / 584 / 593 | 516 / 584 / 603 | 1.00 | 0 |
| `/هزینه-و-پرداخت` | 468 / 506 / 514 | 498 / 513 / 527 | 1.00 | 0 |
| `/رزرو-نوبت` | 489 / 491 / 512 | 461 / 509 / 534 | 1.00 | 0 |
| `/اورژانس` | 492 / 517 / 538 | 472 / 507 / 516 | 1.00 | 0 |
| `/?tier=0` | 612 / 612 / 642 | 609 / 619 / 639 | 0.99 | 0 (max 21) |
| `/?tier=1` | 610 / 613 / 621 | 608 / 610 / 642 | 0.99 | 0 |

## 4. Home (`node scripts/measure-home.mjs <out> --tiers=0,1,2`, full run)

Phase 7 step 9 never ran the full script; this is that run, on this tree. Lighthouse (median of
3, both presets):

| Page | Preset | Score | LCP ms | CLS | TBT ms | Total JS KiB (requests) |
|---|---|---|---|---|---|---|
| `/?tier=0` | mobile | 0.97 | 2491 | 0 | 34 | 162 (12) |
| `/?tier=1` | mobile | 0.97 | 2490 | 0 | 83 | 221 (17) |
| `/?tier=2` | mobile | 0.96 | 2562 | 0 | 92 | 221 (17) |
| `/?tier=0` | desktop | 0.99 | 623 | 0 | 0 | 162 (12) |
| `/?tier=1` | desktop | 0.99 | 616 | 0 | 0 | 221 (17) |
| `/?tier=2` | desktop | 0.99 | 613 | 0 | 0 | 232 (18) |

Against the PINS baseline (`456c289`, median of 3): tier 0 mobile LCP 2498 to 2491 ms, tier 1
2561 to 2490 ms: within the +50 ms acceptance.

### 4.1 Frames (the phase 7 rows)

Desktop 1440x900, default GPU, CPU 4x, mouse wheel, median of 3 runs field by field; each cell
is median fps / slowest 1 s window fps / worst frame ms / tasks over 100 ms. The phase 7 rule
(report section 5): median ≥ 59, slowest ≥ 55, worst ≤ 50 ms, no task over 100 ms. Three runs
of the same build: the full run above (load average 2.3 at its start, measure-home's own
Lighthouse lane before it), then a frames-only run at pace 80 and the phase 7 short-section
lane at pace 16 (`--sections=workflow,…,footer`), each started at a 1-minute load under 1.
"No window" means the section never filled a 1 s window at that pace (phase 7 judged those on
the pace 16 lane).

| Section | Tier | Full run, pace 80 | Quiet, pace 80 | Quiet, pace 16 | Verdict |
|---|---|---|---|---|---|
| services | 1 | 60 / 60 / 33.3 / 0 | 60 / 60 / 16.8 / 0 | - | pass |
| services | 2 | 57.5 / 56 / 50 / 0 | 60 / 54 / 66.7 / 0 | - | **miss** |
| restoration | 1 | no window / 16.8 / 0 | no window / 16.8 / 0 | - | pass |
| restoration | 2 | 59 / 59 / 33.4 / 0 | 59 / 59 / 33.4 / 0 | - | pass |
| workflow | 1 | 59 / 57 / 33.4 / 0 | 59 / 58 / 50 / 0 | 60 / 59 / 33.3 / 0 | pass |
| workflow | 2 | 60 / 58 / 33.4 / 0 | 60 / 59 / 33.3 / 0 | 60 / 59 / 33.3 / 0 | pass |
| compare | 1 | 60 / 60 / 16.8 / 0 | 60 / 60 / 16.8 / 0 | 60 / 57 / 50 / 0 | pass |
| compare | 2 | 59 / 59 / 33.3 / 0 | 60 / 60 / 16.8 / 0 | 60 / 60 / 16.8 / 0 | pass |
| dentists | 1, 2 | 60 / 60 / 16.8 / 0 | 60 / 60 / 16.8 / 0 | 60 / 59 to 60 / ≤ 33.4 / 0 | pass |
| voices | 1 | 59 / 59 / 33.4 / 0 | 60 / 60 / 16.8 / 0 | 59.5 / 59 / 33.4 / 0 | pass |
| voices | 2 | 58 / 58 / 33.4 / 0 | 59 / 59 / 33.4 / 0 | 60 / 58 / 33.4 / 0 | pass on the quiet runs |
| journey | 1, 2 | no window | no window | 60 / 60 / 16.8 / 0 | pass |
| faq | 1 | 57 / 57 / 50.1 / 0 | no window / 49.9 / 0 | 60 / 57 / 66.6 / 0 | **miss** (worst frame) |
| faq | 2 | 53 / 53 / 50 / 0 | no window / 33.3 / 0 | 60 / 59 / 33.3 / 0 | pass on the quiet runs |
| booking | 1 | 57 / 57 / 33.4 / 0 | 60 / 60 / 16.8 / 0 | 60 / 60 / 16.8 / 0 | pass on the quiet runs |
| booking | 2 | 57 / 57 / 50 / 0 | 59 / 59 / 33.3 / 0 | 60 / 59 / 33.4 / 0 | pass on the quiet runs |
| footer | 1, 2 | 59 / 59 / 33.3 / 0 | no window | 60 / 59 to 60 / ≤ 33.3 / 0 | pass |

Services at tier 2 is the row phase 7 already held at its edge (57 / 55 / 50, then 59 / 55 / 50
at `b223a62`); PINS measured 57.5 / 56 / 50 and 58.5 / 55 / 50 after its CSS pins. Across the
six runs here the services pin drops single frames (3 to 13 frames over 33 ms per run, worst
33 to 100 ms) with no long task: a compositing or paint cost of the pinned row, not script. It
is filed for the engine owner (`p9/findings/perf.md`); this lane owns none of the scene files.
Tier 0 (no motion) is 60 / 55 / 33.4 at 4x. On SwiftShader (the software GPU) tiers 1 and 2
run at about 25 fps for the whole page, as in phase 7 (D19: recorded, never gated). Load and
full-scroll CLS: 0 in every frames run at every tier.

### 4.2 INP

Submits (the INP rows of phase 7): 72 to 160 ms in every run (desktop and phone, hero card and
home booking block, tiers 0, 1 and 2), under the 200 ms target.

Typing: the phone field of the home booking block on desktop at tiers 1 and 2 records one
entry near 1 s in some runs (full run: 4 of 6; two re-runs: 4 of 6 and 1 of 6; a tier 2 only
run: 0 of 3; never on phone, never in the hero card, never at tier 0; phase 7: 72 ms). The
slow entry is a `keydown` with 0 ms input delay and 1 ms of processing; the other 943 ms pass
before the next presented frame. What fills them is not known yet: a long-animation-frame probe
(5 runs, its own browser) did not reproduce the entry, and the slow runs come only after
earlier runs in the same browser, so a headless presentation stall is as likely as page work.
GATE traces it, and the launch checklist (plan section 7) types into the block once on a real
desktop browser and on the owner's phone.
`measure-home` now records the worst typing event's phases (`typingEvent` in results.json).

## 5. Font swap

Before: with every woff2 answered 1.5 s late, the desktop home shifted 0.043 to 0.057 (5 runs,
3 over the gate; phase 7 measured 0.058). The cause: next/font's `"Vazirmatn Fallback"` was
`local(Arial)` with Latin-derived metrics. Arial is not on this Linux host (nor, usually, on
Android), so the text fell through to `system-ui`, here DejaVu Sans, 8 % wider than Vazirmatn
(25 % in bold). The hero booking card was 21 px taller until the swap.

Fix (`src/lib/fonts.css`, `src/lib/fonts.ts`): the site declares `"Vazirmatn Fallback"` itself,
one `@font-face` per system font and weight, each with Vazirmatn's ascent (1.0254 em) and
descent (0.5371 em), no line gap, and a `size-adjust` measured as Vazirmatn's width over the
font's on the 272 Persian strings of the home page:

| Font (`local()`) | size-adjust 400 | size-adjust 700 | Where it exists |
|---|---|---|---|
| Arial | 101 % | 101 % | Windows, macOS (next/font's value kept; Persian widths not measured) |
| DejaVu Sans | 92.8 % | 79.9 % | most Linux desktops, this host |
| Noto Naskh Arabic | 109 % | 107.4 % | Android, Linux |
| Noto Sans Arabic | 98.8 % | 91.7 % | Android, Linux |

Chromium uses the last face whose `local()` font exists (checked on this host); Firefox and
Safari were not checked. Text still shows at once (`font-display: swap`; phase 7 question 5
keeps its answer). After, fonts 1.5 s late, 5 runs each:

| Page | CLS (largest session window) |
|---|---|
| desktop home, tiers 0, 1, 2 (`fonts` lane of measure-home) | 0.0008 in 15 of 15 |
| desktop home, intro skipped | 0.0007 to 0.0008 |
| `/خدمات/ترمیم-دندان` | 0.0016 to 0.0023 |
| `/رزرو-نوبت` | 0.0006 to 0.0007 |

## 6. Weights

| Item | Weight |
|---|---|
| Vazirmatn (variable, 400 to 700) | 59,348 B (58.0 KiB) |
| Estedad Bold | 32,348 B (31.6 KiB) |
| Site CSS, content page / home (transfer) | 16.7 / 17.2 KiB |
| Home hero placeholder (gap 36), AVIF | 11 KiB at 640 w, 18 KiB at 828 w, 20 KiB at 1280 w, 44 KiB at 1920 w, 77 KiB at 2560 w |
| Home images in the mobile load | 1 request, 18.2 KiB |
| Content, booking and emergency images in the load | none |

The placeholder's AVIF is larger than its JPEG (20 KiB against 12.5 KiB at 1280 w) because the
film grain is there on purpose (`scripts/sync-public-assets.mjs`: above the low-entropy LCP
cut); the client's photo replaces it (gap 36), and its AVIF must then be checked against the
storyboard caps. The e2e media are QA stand-ins under 1 KiB per AVIF; real uploads go through
the Payload sizes (AVIF and WebP per width), so their weight is a launch-checklist item on the
preview.

## 7. TTFB per page class

Standalone server on the e2e database, `curl` `time_starttransfer` from localhost, 2 warm-ups,
then 20 requests; the median, min and max in ms.

| Class | Path | Median | Min | Max |
|---|---|---|---|---|
| home | `/` | 56 | 42 | 94 |
| home tier 1 | `/?tier=1` | 54 | 41 | 70 |
| content | `/qa/not-found` | 39 | 30 | 50 |
| content | `/خدمات/ترمیم-دندان` | 44 | 36 | 64 |
| content | `/هزینه-و-پرداخت` | 40 | 31 | 62 |
| content | `/خدمات` | 37 | 29 | 70 |
| booking | `/رزرو-نوبت` | 33 | 25 | 50 |
| booking | `/اورژانس` | 33 | 27 | 44 |
| health | `/api/health` | 5 | 4 | 8 |

The server renders every page per request (freeze decision 1). Localhost has no network
time, so these numbers are the server's own work; production adds the round trip.

## 8. Reproduce

```
npm run build && npm run db:e2e
E2E_PORT=3400 LHCI_TLS_PORT=3443 npm run lhci
E2E_PORT=3400 LHCI_TLS_PORT=3443 LHCI_FORM_FACTOR=desktop LHCI_CPU_MULTIPLIER=1 npm run lhci
E2E_PORT=3400 node scripts/measure-home.mjs <out> --tiers=0,1,2
E2E_PORT=3400 node scripts/measure-home.mjs <out> --only=frames --tiers=1,2 \
  --sections=workflow,compare,dentists,voices,journey,faq,booking,footer --pace=16
```
