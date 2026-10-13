# Prototype notes

What each prototype answered, what was measured, what to carry into
phases 7 and 8. Pages and controls: `prototypes/README.md`.

## Answers

| Page | Answer |
|---|---|
| 00 porcelain world | Yes in both themes: the beveled mark relief and the diamonds read as matte porcelain on the warm surface with a soft contact shadow; in the dark theme the mark becomes teal glass on navy. Each tier costs about one more frame-time step (table below). The automatic drop works: started at tier 3 under 55 fps it reached tier 2 after 4 s and tier 1 after 7 s. The prototype floors at tier 1; the real engine must continue to tier 0 (posters) as the experience direction says. |
| 0a intro | Yes: 1250 ms on the first visit (hard cap 1400 ms whatever the load time), CLS 0, hero painted beneath from 0 ms, skip link ends it (375 ms when pressed at 390 px), not replayed inside a session, and the reduced-motion branch ends it in under 2 ms. |
| 0b services horizontal | Yes: pin plus scrub on native scroll held 60 fps at 1x and 4x CPU throttle and 56 fps at 6x; the mark morphs through five placeholder icons; under 1024 px the section is a native scroll-snap row with no pin (`scroll-snap-type: x mandatory`, no pin spacer). Fast reverse scroll and a mid-pin resize recover through `invalidateOnRefresh`. |
| 0c workflow diagonal | Yes, DOM only: the pinned diagonal path with four steps held 60 fps at 1x, 54 at 4x and 50 at 6x; the warm light is a custom property tweened on its consumers, not on the scene root. Phones get a vertical list with reveal-on-enter. |
| 0d molar turntable | Partly. The enamel material (cervical warmth, cool cusp tips, stained fissures, 0.15 transmission at tier 3 only) and the normal / VIP / CIP scrub read well in both themes. On the software GPU the page is fill-bound: 8 fps at 1440 x 900 and 21 fps at 480 x 300 at tier 1, far from the 50 fps target. Decision: a software renderer is tier 0, not tier 1 (see "Decisions"). Hardware numbers are still unmeasured. |
| 0e footer playground | Yes: the six parts drop into the footer with a bounce, drag and throw with Draggable plus InertiaPlugin inside the footer box with a floor, return home after 6 s idle, work with touch, and a replay button serves keyboard users. Tier 0 and reduced motion show the static footer. 60 fps at 1x, 54 at 4x, 48 at 6x while scrolling the page. |
| 0f compare wipe | Yes for the fallback, open for the effect: the DOM clip-path slider is a 48 px `role="slider"` handle driven by pointer and arrow keys with Home and End, and the WebGL path adds a velocity-driven displacement band. On the software GPU the WebGL path runs at 16 to 24 fps on a 960 x 600 canvas; whether the effect is worth its cost needs a real GPU and the client's eye. |

## Measurements (software GPU, lower bounds)

Environment: headless Chromium, SwiftShader (ANGLE) software GPU, 4 vCPU
container, viewport 1440 x 900, 5 s sample after a 2.5 s warm-up. CPU
throttle through the DevTools protocol. A software GPU runs every shader on
the CPU, so WebGL numbers here are a floor for weak hardware and say nothing
about a real GPU; the DOM numbers are representative of a slow laptop.

WebGL pages, fps (frame time) per tier at 1x and 4x CPU throttle:

| Page | T1 1x | T1 4x | T2 1x | T2 4x | T3 1x | T3 4x |
|---|---|---|---|---|---|---|
| 00 porcelain world | 7 fps (142 ms) | 6 fps (178 ms) | 4 fps (222 ms) | 4 fps (283 ms) | 2 fps (575 ms) | 2 fps (475 ms) |
| 0d molar turntable | 8 fps (133 ms) | 6 fps (172 ms) | 5 fps (222 ms) | 4 fps (275 ms) | 2 fps (500 ms) | 2 fps (583 ms) |
| 0f compare wipe | 16 fps (62 ms) | 9 fps (117 ms) | 23 fps (43 ms) | 17 fps (57 ms) | 24 fps (42 ms) | 17 fps (59 ms) |

DOM pages while wheel-scrolling through the pinned scene (median / minimum
fps over one-second windows, worst single frame):

| Page | 1x | 4x | 6x |
|---|---|---|---|
| 0b services horizontal | 60 / 58 fps, worst 33 ms | 60 / 52 fps, worst 117 ms | 56 / 48 fps, worst 117 ms |
| 0c workflow diagonal | 60 / 56 fps, worst 33 ms | 54 / 40 fps, worst 67 ms | 50 / 32 fps, worst 133 ms |
| 0e footer playground | 60 / 60 fps, worst 17 ms | 54 / 54 fps, worst 67 ms | 48 / 48 fps, worst 117 ms |

Intro (0a): first visit 1250 ms (1255 at 390 px), CLS 0; second visit in the
same session 0 ms (not played again); skip pressed at 390 px ends it
at 375 ms; reduced motion 1 ms (no animation). Phone services row:
`{"snap":"x mandatory","overflowX":"auto","pinned":false}`.
Fill-rate check (0d, tier 1, 1x): 8 fps at 1440 x 900, 14 at 960 x 600,
12 at 720 x 450, 21 at 480 x 300. The cost follows pixel count, so a
render-scale knob (0.75 at tier 1) buys more than removing geometry.

## Decisions carried into phases 7 and 8

1. A software renderer (SwiftShader, Mesa llvmpipe, `WEBGL_debug_renderer_info`
   naming "SwiftShader" or "llvmpipe") is tier 0. Tier 1 is for weak real
   GPUs (Intel UHD, Mali-G5x, Adreno 6xx). `detect-gpu` already reports
   these as its tier 0; the frame monitor stays as the second guard.
2. The frame monitor drops one tier after 2 s under 55 fps and goes all the
   way to tier 0; the prototype floor of tier 1 was a prototype shortcut.
3. Tier 1 renders at scale 0.75 (DPR 1.0 times 0.75) with no shadows, no
   post-processing and no transmission; tier 2 at DPR 1.5 with hard shadows
   and grain; tier 3 at DPR 2.0 with soft shadows, bloom, grain and 0.15
   transmission on the molar only.
4. Scroll scenes stay DOM-driven (GSAP ScrollTrigger on native scroll);
   WebGL draws into one fixed canvas behind them and is never the scroll
   owner.
5. Custom properties animated by GSAP go on the element that reads them,
   never on a scene root (0c lost about 15 fps at 4x throttle the other way).
6. The intro timeline is 1250 ms (`--dur-5`) with a hard cap at 1400 ms, so a
   slow font or asset load cannot stretch it.

## Known limits of these prototypes

- WebGL numbers above come from a software GPU and are floors; the fps
  meter on each page shows the real number on the client's machines.
- The videos in `docs/qa/phase-02/rec-*.webm` were recorded on the same
  software GPU at 1024 x 640, so the three WebGL pages look choppy in
  them; they show the look, not the motion quality.
- Service icons in 0b are placeholders; the molar is stylized; the compare
  images are procedural placeholders.
- Chromium blocks the pages over `file://` (module scripts and fonts);
  serve the repository root as the README says.
