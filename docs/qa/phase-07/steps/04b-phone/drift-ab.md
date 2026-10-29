# Drift A/B (phone spec 2.5): gsap scrub against a CSS view timeline

Date: 2026-10-29. Build: `/home/user/sefid-wt-step0` (the 4b change plus the A/B switch below),
BUILD_ID `5EtbAOTvFFt-528nEEttw`. Host: 4 CPUs, no other job running; load 0.80 to 0.83 at the start,
0.80 to 1.24 between rounds. Chromium 141.0.7390.37 headless (default GPU, as
`tests/helpers/launch.ts`).

## 1. What was built for the A/B

The spec asks for the CSS path behind an engine-written attribute and a debug query. Both are now
in the worktree (small, inert without the query):

- `src/experience/core/query.ts`: `scrollCssActive(search)` is true only for `scrollcss=1`.
  Test QP7.
- `src/experience/scenes/dom/hero.ts`: under 1024 px with `?scrollcss=1`, the hero scene writes
  `data-scroll-css` on the hero section and creates no gsap Drift. Its cleanup removes the
  attribute. Test HS5.
- `src/app/globals.css`: under `@supports (animation-timeline: view())` and under 744 px, the hero
  section declares `view-timeline: --hero-drift block` with `view-timeline-inset: 0px`. The img
  runs `hero-drift` (translate 0 -4 % to 0 +4 %, linear, fill both) on that timeline, from
  `entry-crossing calc(100% - 125vw)` to the timeline's end.

Three facts found while building it. Each one would have made the CSS arm wrong without notice:

1. **A view timeline on the band itself never moves.** The hero section has `overflow: hidden`, so
   it is the band's scroll container. Measured: the progress stayed at 0.278 at every `scrollY`.
   Fix: the section is the timeline's subject. The band is the section's last row and 125vw tall
   (measured at 360, 390, 412, 700 and 740 px wide). So the range start is
   `entry-crossing calc(100% - 125vw)`, and the end is the section's bottom at the viewport's top.
2. **The default `view-timeline-inset` is the root's scroll padding.** Here that is the header
   height plus `--space-4`. It moved the range by about 72 px at the start and 88 px at the end.
   `view-timeline-inset: 0px` gives the viewport's edges, as gsap uses.
3. **The CSS minifier breaks a written range end.** It writes `exit-crossing 100%` and `cover 100%`
   in the `animation-range` shorthand as `0%`. The longhands are merged back into that shorthand.
   Checked with `lightningcss` directly: `entry-crossing ... exit-crossing` becomes
   `exit-crossing 0%`. Fix: no written end. The default end `normal` is the timeline's end, cover
   100 %.

Check of the final path (`tools/sc-diag.mjs`, 390x844, no throttle): the timeline source is
`HTML`, the subject is `SECTION`. At `scrollY` 0, 600 and 1332 the progress is 0, 0.451 and 1.
The translate is -4 %, -0.40 % and +4 %. gsap's Drift on the same range gives progress
`scrollY / 1332`, so 0.450 at 600. **Compositor:** a trace from the navigation
(`tools/sc-trace.mjs`, `ab/trace-composite.json`) shows the `hero-drift` Animation event with
`compositeFailed: 0`. In Chromium 141 the CSS drift runs on the compositor. The spec marked this
as a guess; it is now verified for Chromium, not for WebKit.

## 2. Method

`tools/drift-ab.mjs`. Phone profile (`VIEWPORTS.phone`: 390x844, DPR 3, touch, Pixel 7 UA).
`?tier=2&scrollcss=0` (gsap) against `?tier=2&scrollcss=1` (CSS). CPU 4x from the navigation, then
`settle` (2.5 s and Escape, as measure-home), the engine-init measure and 1.5 s. Then touch swipes
(`scrollThrough`, `drive: 'touch'`, 16 px of finger travel per 50 ms, 100 ms hold, no fling) from
the top to the bottom of the trust band (`scrollY` 1332). The whole Drift range is inside it. Six
rounds; the arm that goes first alternates each round.

- **Cost run:** frames (the measure-home sampler, per section), long tasks, CDP
  `Performance.getMetrics` deltas over the swipes (TaskDuration, ScriptDuration,
  RecalcStyleDuration, LayoutDuration), and inline style writes on the img (a MutationObserver).
  Nothing is read per frame.
- **Track run:** a requestAnimationFrame loop records `scrollY` and the img's offset in its band.
  It reports frames in which the scroll moved and the img did not ("stalls"). It also reports the
  RMS change of the img's velocity between frames ("jerk", px/ms²).

## 3. Results (6 rounds per arm)

Medians:

| Metric | gsap scrub | CSS view timeline |
|---|---|---|
| hero: median / slowest 1 s window fps, worst frame ms | 60 / 59 / 33.4 | 60 / 59 / 33.3 |
| trust: median / slowest window fps | 60 / 60 | 60 / 60 |
| frames over 33 ms (page), long tasks, clsAll | 2, 0, 0 | 1.5, 0, 0 |
| main-thread task time over the swipes | 968 ms | 551 ms |
| the same per second of swiping | 62 ms/s | 45.5 ms/s |
| script / style per second of swiping | 7.5 / 5.3 ms/s | 5.6 / 4.0 ms/s |
| inline style writes on the img | 825 | 0 |
| duration of the same swipes | 15.6 s | 12.1 s |
| track: stalls, jerk RMS | 26.5, 0.0015 | 24, 0.0009 |
| img offset range (px) | -43.9 to -4.9 | -43.9 to -4.9 |

Per run (cost): `ab/results.json`. Every round agrees in direction. Main-thread time per second
of swiping: gsap 58 to 68 ms/s, CSS 44 to 51 ms/s.

Reading:

- Frame rates are the same. At 4x on this host neither path drops a frame window in the hero.
- The gsap scrub costs main-thread time and the CSS path does not. The gsap arm had about 17 ms
  more main-thread time per second of swiping (+36 %), from script and style recalculation. It
  also wrote the img's inline transform 825 times. The CSS arm wrote it 0 times.
- The same swipes took 28 % longer to deliver in the gsap arm (15.6 s against 12.1 s, in every
  round). Each CDP touch event is acknowledged by the renderer's main thread, and the scrub keeps
  that thread busier. This is a second sign of the main-thread cost. It is not a measured scroll
  delay on a real phone.
- The CSS motion follows the scroll exactly (lower jerk). The gsap motion trails the finger by the
  0.32 s scrub lag and keeps moving between swipes (811 moving frames against 285). Headless
  Chromium cannot show the 90/120 Hz risk of section 2.5. That needs a real phone.

## 4. Pick, per spec 2.5

Rule: "If the CSS path wins (smoother on the owner's phone, and no main-thread cost at 4x), ship
Drift and Fill as CSS ... Otherwise keep the gsap scrub."

- No main-thread cost at 4x: **met by the CSS path** (0 style writes, 27 % less main-thread time
  over the band, the same frames).
- Smoother on the owner's phone: **not measured.** It needs the owner's checkpoint (step 4b (4)).

**Pick now: keep the gsap scrub as the shipped default.** The CSS path has met the first
condition. Send the owner the two links at the checkpoint (his phone detects tier 1):
`/?scrollcss=0` (gsap) and `/?scrollcss=1` (CSS). If he finds the CSS link smoother, ship Drift as
CSS: the hero writes `data-scroll-css` by default under 1024 px at tiers 1 to 3, the gsap Drift
goes, and Fill (step 6) follows the same path. Record the answer in the 4b README.

Before the CSS path ships by default, close these gaps (they do not affect the A/B):

1. **No settle.** At an engine start or a step-down, the CSS animation appears or goes at once.
   The D25 settle transition does not apply to animations. The img can jump by up to 4 % of the
   band, 19.5 px at 390 px. At load the band starts at the fold (its top is at 844 px in a
   844 px viewport), so the start is not seen. A relatch at idle while the band is in view would
   show the jump.
2. **Geometry.** The range assumes the band is the hero's last row and 125vw tall. A change to
   HomeHero.tsx must keep both true, or the range must change with it.
3. **Support.** Safari without scroll-driven animations shows the still photo. The spec accepts
   this as risk 6.1.
4. **Minifier.** Keep the range end unwritten (fact 3 above). A written `100%` end fails without
   notice.
