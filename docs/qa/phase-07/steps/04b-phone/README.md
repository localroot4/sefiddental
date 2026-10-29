# Step 4b: phone motion (phase 7, phone spec section 5.4 row 4b)

Date: 2026-10-29. Base 59dddd0. The step lands the phone scroll set (D21 to D28 of the phone
spec): weak-phone detection with the CPU signal and the light floor, the engine gate, the
scroll-only frame monitor, the light notice and its switch, Drift on the hero band's photo, Slide
and Settle in services. Trust stays still. This README holds the records the spec asks of it. The
measurements are in `measure.md`, the Drift A/B in `drift-ab.md`.

## 1. Gate rows (spec 5.4, row 4b)

| Row | Budget | Result | Where |
|---|---|---|---|
| T0 gate | phone, 4x, `?tier=0`: every section median ≥ 58, slowest ≥ 55 | pass in both lanes | measure.md 2.1 |
| Phone frames, tiers 0 to 2 | the P-F row against the same build's tier 0 | 0 misses (median of 3) | 2.1 |
| Hero and services frames | P-F, pace 16 | tier 1: 60/59, 60/60, 60/59; tier 2: 60/59, 60/60, 60/60 | 2.1 |
| Engine creation | `initMs` ≤ 50 ms; no task over 50 ms | initMs 3.8 to 11.3 ms; no task over 50 ms in 10 of 10 gated T-PS-P4 runs | 10.1 |
| `/?tier=1` Lighthouse TBT | not above the last CI median before 4b | local 5.5x: 110 ms against 111 for the base; CI not run | 2.3, section 3 below |
| clsAll | 0 target, 0.05 gate | 0 in every run; T-PH4, T-PH5 pass | 2.1, 10.8 |
| Idle ticker | 0 tick subscribers 1 s after scrollEnd | 0; the monitor's own loop runs 0 frames at rest | 10.3 |
| INP phone rows | each ≤ 200 ms | 48 to 80 ms; the notice switch 64 ms | 10.6 |
| `check:bundle` home | ≤ 160 KiB | 159.8 KiB | 10.5 |
| Engine chunk | ≤ 64 KiB | 54.7 KiB | T-EX5 |
| Owner's phone | no step-down; record slowMs and the slow windows | **open**: the owner checkpoint | section 2 below |

## 2. Owner checkpoint (spec 5.4, row 4b (4))

Send it only after the preview runs this change. Before it, `?debug=1` loaded the canvas on a
phone, and the canvas's monitor (it samples at rest) could step the owner's phone to tier 0 and
write the light floor (review blocker 2, measure.md 10.2).

- Media: a 390 px recording at `?tier=1` with touch swipes through hero, trust and services, and
  screenshots in light and dark (measure.md 10.9). The band shows the abstract stand-in of
  a2ce69c, so the photo's drift is soft; the drift is ±4 % of the band's height (±19.5 px at
  390 px).
- Ask 1: «این مقدار حرکت کافی است، یا بیشتر می‌خواهید؟» A "more" answer changes only the
  constants in `src/experience/scenes/dom/phone.ts` and adds the trust Rise.
- Ask 2, the Drift A/B (spec 2.5): `/?scrollcss=0` (gsap) and `/?scrollcss=1` (CSS view
  timeline). Which one moves the photo more smoothly on his phone?
- Ask 3: one `?debug=1` screenshot after one full scroll, then `?debug=0`. Read from it: the
  `monitor` row (pass: `steps 0`; record `slow` and the slow windows), the `cpu N ms` at the end of
  the `tier` row (the CPU signal's calibration input), and the `gpu` row (why the GPU is null).

Record the three answers here.

## 3. Records the spec asks of this README

- **TBT baseline (spec section 4).** The last CI median before 4b: run 65 on 2b13ad0, LHCI at 4x,
  `/?tier=1` TBT 625 ms in light and 533 ms in dark. Local 5.5x is about CI 4x. The local medians
  (n=13, base and change interleaved) were 111 ms for 59dddd0 and 110 ms for 4b. The review
  fixes only split the engine's creation task into shorter ones, which cannot raise TBT, so
  Lighthouse was not run again. CI decides.
- **Drift A/B result (spec 2.5).** At 4x the CSS path has no main-thread cost: the same frames
  (60/59 in the hero in both arms), 0 inline style writes on the img against 825, 27 % less
  main-thread time over the band, and the animation is composited (`compositeFailed` 0). The other
  condition, smoother on the owner's phone, is open (ask 2). Until he answers, gsap stays the
  default. Before CSS ships, close the gaps in `drift-ab.md` section 4.
- **`?scrollcss` is not debug-only** (spec 2.5 says debug-only). The A/B must compare the paths a
  visitor gets. Under `?debug=1` the overlay runs an fps meter on the gsap ticker in every frame,
  which would add main-thread work to both arms. The query changes only the hero's drift path, and
  no link on the site carries it.
- **The switch's text comes before the effects (spec 3.4).** «جلوه‌ها را روشن کردیم.» appears in the
  same task as the click. On a slow phone the effects follow when the engine chunk has loaded, up
  to a second or more later. Accepted by spec 3.4; no observer was added to the initial JS.
- **D26 reads `scrollY` once per frame** (the spec says "there is no scrollY read"). A frame counts
  only when the page moved since the frame before. ScrollTrigger's `scrollEnd` comes 200 to 450 ms
  after the last scroll and never while a finger rests; those still frames are fast, and counted
  they reset the slow time (measure.md 3.2). One read per frame while scrolling, no layout.
- **T-PS-P3's slow condition is 4x plus 40 ms of main-thread work in every frame** (about 25 fps),
  not 20x CPU throttling. With a correct monitor, 20x and 40x do not make this page's swipes slow:
  the scroll is composited, and the scroll set's per-frame work is small (measure.md 3.3). The
  budget is unchanged.
- **Slide offset: 16 px, the phone gutter** (the spec's starting value was 24 px). With 24 px the
  first card started 8 px past the screen edge and passed within about 4 px of it at half opacity,
  so the row looked as if it overflowed. With 16 px the first card stays 8 px inside the edge at
  mid-Slide.
- **Bundle (spec section 4, home initial JS).** 157.0 KiB at 59dddd0, 159.8 KiB now; the target is
  160 and the gate 170. Per module, minified alone and gzip -9 (they sum to 3.8 KiB alone, 2.8 in
  the chunks): `LightNotice.tsx` 1.94 KiB and `lightNotice.ts` 0.47 (new; the spec estimated at
  most 1 KiB for the notice), `tierStore.ts` +0.50 (the CPU signal and the floor), `browserEnv.ts`
  +0.32 (the CPU observer), `ExperienceRoot.tsx` +0.18 (the engine gate), `qualityTier.ts` +0.16,
  `gpuProbe.ts` +0.13, `store.ts` +0.09, `query.ts` +0.03.
- **Voices fallback (spec 2.4 row 8).** The margin is 0.2 KiB and the voices handler is estimated
  at 0.3 KiB, so step 7 will most likely take the fallback the spec already defines: the voices
  box at every tier as `invisible` plus `inert`. That rule needs no new decision; step 7 measures
  `check:bundle` and applies it when the handler goes over 160 KiB.
- **The owner's earlier reading "gpu null, renderer masked" was a misreading** (spec 6.2). The
  overlay of that build could not show the renderer when the GPU was null, and detect-gpu answers
  FALLBACK (tier 1, not null) for an empty renderer. A null GPU with WebGL 2 comes only from a
  benchmark that was skipped or threw. The overlay now names the reason first (`gpu failed
  TypeError`, `gpu skipped`) and keeps `masked` for a probe that gave none.

## 4. Deviations and decisions of this step

- **No canvas under `?debug=1` on a phone.** Phase 7 draws no WebGL, and on phones the debug flag
  now loads no canvas, so the debug page measures what a visitor runs. The e2e rows no longer block
  the canvas chunk.
- **The CPU signal leaves out the intro's end.** The long animation frame that holds the
  `intro:end` mark is the intro script's own work (61 to 119 ms of blocking at 4x and 62 to 242
  at 6x, mostly forced style and layout). Counted, it put the 6x class at 456 and 465 ms, over the
  400 ms threshold (measure.md 10.4).
- **The notice at a 200 % root font.** The page itself is 446 px wide there on a 390 px screen (the
  header's logo), and the fixed notice spanned that width. Its width is now capped by `100vw`, and
  the button labels wrap. The header's overflow is not fixed here; it affects every page.
- **Every engine setup is its own task under 1024 px, the first one too.** The settle window
  covers the hero's first render, so the photo does not pop at the engine start.

## 5. Red proofs

Every new or changed test was run against a broken implementation and seen red; each file was
restored and compared afterwards (logs in the measurement folder: `a-red-proofs.log`,
`b-red-proofs.log`, `c-red-proofs.log`, `d/red/unit-red.log`).

- Detection and the engine (a): U-PH2, U-PH4, U-PH5, U-PH6, U-PH7, U-PH7b, U-PH12, U-PH14,
  U-PH15a, SE8, SE9, XR5, XR6, PH2, PH6, PH9, BE1 (two breaks).
- Notice, scenes and tooling (b): U-PH8 (two), U-PH9 (three), Q6b, the services Slide and Settle,
  the hero Drift, `phoneMisses`, `clsFrom`, and T-PH6 (e2e, the scroll padding).
- The A/B switch and the monitor fix (c): QP7, HS5, the subject element, U-PH7 (two), U-PH7b,
  U-PH7c, DH6, and T-PH12 (e2e, a loop that never stops).
- After the review (d), 13 unit breaks, each red: SE7 (the first setup inline again), SE11 (a
  refresh with no trigger; the refresh events set after the tier-0 return), U-PH7d (frames not
  reported), XR7 (the debug flag loads the canvas on a phone), DH6 (masked wins; frames not
  counted), GP10 (no error name), U-PH15a (no CPU reading in the state), BE3 (the intro frame
  counts), U-PH16 (40vh), PH9 (Drift's breakpoint in px), and the two new U-PH9 cases against the
  notice before the fixes. In e2e: T-PH12 against a build whose monitor loop does not stop at
  scrollEnd (137 then 197 frames at rest), T-PS-P3 against the same build (60 frames at rest; the
  'loaded' copy where the 'stepped' one belongs), T-PH12 against a build with the old debug
  condition (the canvas chunk reached the phone), and T-PH12, T-PH6 at a 200 % root font and T-PH6
  in landscape against the build before the review fixes.
