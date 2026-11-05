# Phase 8, lane WORLD: the porcelain world, scenes 1-2 exit, 3, 9 and 10

Branch `p8-world` on `4506586`. Scenes 4, 5 and 6 (the molar, the workflow,
the wipe) are the MOLAR lane's. Measured on 2026-11-05 in the cloud
container: 4 CPUs shared with the MOLAR lane (load average 3.8 to 6.5
during the runs), Chromium 141, **no GPU**: both launch profiles render WebGL
on SwiftShader (a software rasterizer).

## What each scene does, per tier

| Scene | Tier 3 | Tier 2 | Tier 1 | Tier 0 / reduced motion |
|---|---|---|---|---|
| World (all scenes) | camera path and light drift on the master timeline, cool to peach key; RoomEnvironment reflections; diamond dust 400 grains with the light depth of field; grain inside the materials; DPR cap 2 | same, dust 200, no depth of field; DPR cap 1.5 | renders only while one of its scenes is mounted (the hero exit; the molar is MOLAR's), then one clean frame and nothing; dust 80; no grain; DPR 1 x 0.75 | no canvas, no three.js |
| 1-2 hero exit (`trust`, from 1024 px) | teal glass mark (transmission 0.15 at half resolution) and three navy gems (silver in dark) in the text-free box under the facts; two gems in the band above the facts; mark lags 0.88x, gems loop 12 s, scroll-velocity wobble (clamped), fine-pointer tilt, shrinks into the services mark toward the pin; glow halo (the light bloom); soft PCF shadows (1024 map) on a catcher under the box | same without halo or transmission; hard shadows (512 map) | same without shadows | static facts |
| 3 services backdrop (pinned layouts) | five porcelain relief motifs (sparkle, implant, shield, arch with brackets, bubbles) in the stage's empty band, sliding at half the track's speed, with the sticky stage; soft shadows | same, hard shadows | not run (minTier 2) | vertical bento |
| 9 first visit | the world background and the key turn warm with `--warm` (the DOM warm layer's own value) | same | not drawn (the DOM warm layer still tints) | DOM layer stays 0 |
| 10 booking (from 1024 px) | the mark breathes and sways in a new 12rem slot under the hours, one gem circling it; `html[data-world-stage]` makes the stage transparent while the world paints the colour that composites to `--color-warm-soft` under the warm layer | same, hard shadows | not run (minTier 2) | the form alone |

Under 1024 px no scene of this lane draws (no text-free box there): the world
renders no frame unless another lane's scene draws (the molar), so phones and
tablets in portrait pay only the chunk; a narrow tier 1 page loads no canvas
at all.

Hand-over and gates: three.js and the canvas chunk load once the world window
under the hero (the trust band) shows 1 px, which at 1440x900 is the first
scroll; never at `load` (`?debug=1` keeps its load-time chunk). The
cover is now the photo box from 1024 px (the section also held the
transparent world window) and fills the viewport under the sticky header: at
1440x900 the gate is closed at scrollY 0 only. The canvas is invisible until
its first frame and is hidden at once on a theme switch until a frame in the
new theme is drawn: no black, stale or wrong-theme flash. Tab hidden, cover
and context loss stop frames (existing FrameDriver); after a restore the
environment map is rebuilt and the booking stage reopens (T-WD3). Scenes two
away unmount; their models go through a refcounted cache that disposes the
geometry at its last release (T-WD4, unit tests GC1-GC3).

## Downloads (gzip transfer, measured in the browser after a full scroll)

| | Tier 3 | Tier 2 | Tier 1 | Budget 3 / 2 / 1 |
|---|---|---|---|---|
| three.js, R3F, World, scene chunks | 275 KB | 275 KB | about 270 KB (no services or booking chunk) | |
| mark.glb + diamond.glb (Draco) | 13 KB | 13 KB | 13 KB | |
| Draco wasm + same-origin worker | 77 KB | 77 KB | 77 KB | |
| Textures | none (procedural materials; nothing to KTX2) | none | none | |
| **Total** | **about 365 KB** | **about 365 KB** | **about 360 KB** | 2.5 MB / 1.2 MB / 500 KB |

Initial JS of home: 160.7 KiB (was 160.8; limit 170). `npm run check:bundle`
passes. The tier budgets are also a unit test (assets.test.ts AS2).

GPU memory per scene is not measured (no GPU here). Estimate: shadow map 4 MB
(tier 3) or 1 MB (tier 2), prefiltered environment about 2 MB, tier 3's
half-size transmission target about 3 MB at 1440x900, geometry under 1 MB:
well under 64 / 128 / 256 MB.

## Frame times

`frames/README.md` and `frames/results.json`: `scripts/measure-home.mjs
--only=frames --tiers=2,3 --sections=trust,services,journey,booking`, wheel
80 px every 50 ms, CPU 4x and 6x, median of 3, after the shadow-catcher
commit (`bddd305`).

| GPU (software) | Tier | CPU | Median fps | trust | services | journey | booking |
|---|---|---|---|---|---|---|---|
| default | 2 | 4x | 14.5 | 8.2 | 7 | 26 | 12.2 |
| default | 3 | 4x | 6.3 | 4.7 | 5.5 | 20 | 5.7 |
| swiftshader | 2 | 4x | 6.5 | 4.9 | 3.9 | 7.7 | 5.6 |
| swiftshader | 3 | 4x | 5.7 | 3.1 | 4.1 | 9.7 | 4.6 |

Before `bddd305` (one full-screen shadow catcher, a 2048 map at tier 3,
full-size transmission) the same run gave 5.3 and 5.8 fps median at tiers 2
and 3 (default, 4x): the change roughly tripled tier 2.

At rest, no throttle, SwiftShader, scene 2 in view (requestAnimationFrame
deltas over 4 s, one run each): tier 0 60.3 fps, tier 1 16.8, tier 2 9.5, tier 3 5.3. Phase 7 found an
empty R3F canvas at 1440x900 at about 22 fps on this renderer, and the phase 2
prototype of this world 7 / 4 / 2 fps at tiers 1 / 2 / 3.

**Not met, and not provable here:** 60 fps at tiers 2 and 3 at 4x, and 50 fps
at tier 1 on SwiftShader. Every number above is a software rasterizer whose
floor for any canvas is about 22 fps; the per-frame work of the world is small
(about 10k triangles at the hero exit, one Points draw, one shadow pass). In production a software renderer is detected as tier 0
(`isSoftwareRenderer`), so no visitor gets these frames. Real-GPU frame times
need the client's devices (the phase 8 real-device checklist) or a runner with
a GPU.

## Text contrast over the canvas

`capture.mjs` paints every text transparent for a second shot and compares each
visible line's colour with the pixels behind it (2nd percentile, so one dust
grain under a glyph is not the background). Lowest ratio per shot is in
`contrast.json`: every desktop and phone shot is at least 5.13:1 (AA) in both
themes; the lowest are DOM pairs that do not touch the canvas (the booking
button 5.22, the journey lead 5.13 in light).

## Tests

- Unit: `npm test` 227 files, 3959 passed (new: worldMath, assets,
  brandGeometry, anchor, draco-worker, gates V2 header inset, registry V7).
- e2e, one worker, every project, on the final build: experience, home-world
  (T-WD1 to T-WD4), tiers, home-engine, home-phone, home-hero,
  home-services, home-booking-footer, home-booking, home-scenes-6-9, tier0:
  131 passed; a11y rows matching `home` (axe at tiers 0 to 3 after a full
  scroll, structure, keyboard walks), every project: 66 passed.
- lint, typecheck, format:check, knip, check-bidi, build, check:bundle: pass.

## Screenshots (tier 3, SwiftShader, intro skipped)

`scene2-hero-exit-*` (the photo leaving), `scene2-hero-exit-late-*` (the mark
under the facts), `scene3-services-*` (mid-pin), `scene9-first-visit-*`,
`scene10-booking-*`, each at 1440x900 and 390x844, light and dark. Looked at
and fixed once: the first mark read as flat mint (deeper teal, no sheen), the
shadows were large grey blobs (closer catcher, lower opacity, more frontal key),
the dark reliefs were too bright, and the booking slot had no size (the
spacing scale is reset: `w-[12rem]`).

## Not done or not met

- 60 fps at tiers 2 and 3 and 50 fps at tier 1 are unmeasured on a real GPU
  (above).
- Bloom and depth of field are light approximations, not post-processing
  passes: a glow halo behind the glass mark, and dust grains that soften away
  from the focus plane. Grain is in the materials, so the bare surface stays
  exactly the DOM surface (no seam with opaque sections).
- No KTX2 step: no textures exist; the storyboard's 1024 px normal map for the
  backdrop was replaced by relief geometry.
- Phones and tablet portrait get no mark, backdrop, booking stage, dust or
  warm world light (no text-free box; a full-DPR canvas for dust alone cost a
  tablet 3.9 megapixels a frame). The DOM warm layer still tints scene 9.
- Tier 1 keeps the D20 main-thread WebGL 2 confirm at `load` now that scenes
  declare `webgl.load` (phase 7 option two, counted against tier 1 TBT);
  Lighthouse was not run in this lane.
- Scene 3's mark morph stays the phase 7 SVG; the 3D mark shrinks into it.
- Velocity does not scale the grain; it drives the wobble and the dust lift.
- No independent review agent was available in this lane.
- The software GPU makes forced tiers 2 and 3 slow in e2e. The first full
  run had failures from it: T-KB walk home at ?tier=2 and the tier 3 axe scan
  on tablets (30 s timeouts), T-EN4g (the auto-mode monitor stepped down to
  tier 1, as specified, at about 10 fps), T-BF6 (the world's setup stall hid
  the drop), T-PH12 (a ticker callback before the first scroll). `e13290b`,
  `20263b1` and `97daf23` fixed the causes; the last full run is green. The
  desktop tier 2 keyboard walk and T-EN4g still depend on how fast a runner
  without a GPU renders the world at 1440x900: they can fail on a slower CI
  machine. Nothing was weakened; the lead decides if CI needs a GPU runner.
- Shared files touched: `registry.ts` (three entries, booking minTier 2),
  `CanvasRoot.tsx` (World instead of nothing; PCF for both shadow modes),
  `ExperienceRoot.tsx` (first-scroll gate), `scrollEngine.ts` and `gates.ts`
  (cover), `HomeHero.tsx` (cover attribute), `BookingSection.tsx` (slot),
  `globals.css` (stage rule), `sync-public-assets.mjs` (models, decoder).
