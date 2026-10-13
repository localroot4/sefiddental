# Phase 08 - WebGL World and Adaptive Quality

Add the 3D world behind the home journey: the mark, the diamonds, the bar,
the molar, the workflow path, the lights and the materials, with four
quality tiers that keep 60 fps on strong devices and a complete site on weak
ones. Think like the WebGL and shader engineer, 3D artist, technical artist,
performance engineer and the independent critic with a weak laptop.

## Inputs

`docs/experience-direction.md`, `docs/experience/storyboard.md`,
`design/brand/` glTF assets and the molar (default: the stylized in-house
`design/brand/3d/molar.glb`; gap 34, brief decision 22),
`design/prototypes/` (0), (d) and (f), `docs/discovery/threeui-review.md`
section 3 (effects to port, never iframes or CDN loads), the phase 7
timeline and tier provider, performance baselines.

## Deliverables

1. One fixed `<Canvas>` host on home (React Three Fiber), mounted after
   `load` and after the intro minimum, with `AdaptiveDpr`, the frame
   monitor, context-loss recovery, visibility pause (tab hidden, canvas
   off-screen, the hero photo covering the viewport: no frames render over
   the photo), and disposal of scene resources when far out of view.
2. Scene graph bound to the phase 7 master timeline: the camera path and
   light drift across the eleven scenes; the mark with a glass-like teal
   material and the diamonds as gems (from the hero exit on: the hero photo
   covers scene 1, brief decision 19); the services backdrop (scene 3); the
   molar turntable with the enamel material and the CIP characterization
   shader layer (scene 4); the diagonal workflow with point cloud,
   wireframe, solid and lit stages (scene 5); the displacement before/after
   wipe at tiers 2 and 3 (scene 6); the warm light shift (scenes 9 and 10);
   the playground parts as 3D at tier 3 only.
3. Assets: Draco glTF, KTX2 textures with a build step, no texture above
   2048 px, per-tier asset manifests, total download per tier within the
   budgets, preloading in scroll order. Molar choice (gap 34, brief
   decision 22): render the stylized molar and the realistic candidate
   side by side in the scene 4 light, so the client picks from two
   pictures under `docs/qa/phase-08/`. Save a render of the mark as a
   porcelain relief in the real scene 2 next to them (gap 34a). Before the
   candidate is used, a person confirms the license field on its model page
   and keeps the downloaded `license.txt`. The credit duties and the paid
   fallback are in brief decision 22. Spend no money without the client's
   explicit approval of the price. The stylized molar stays until the
   client picks.
4. Quality tiers end to end: `detect-gpu` plus device signals at first
   visit; the live monitor steps down after 2 seconds under 55 fps and
   never steps up during the visit except after idle; tier settings
   (DPR cap, post-processing, particle counts, shadows, which scenes run)
   exactly per `docs/experience-direction.md` section 3; the user override
   persists; tier 0 renders no canvas at all.
5. Theme correctness: both themes inside the world; the hero photo stays a
   DOM image, and the canvas starts rendering as the photo scrolls away,
   with no flash at the hand-over in either theme.
6. Accessibility: `aria-hidden` canvas; no information exists only in 3D;
   reduced motion disables the world.
7. Performance evidence per tier: frame-time distributions per scene with
   Chromium at tiers 3 and 2, with 4x CPU throttle, and with SwiftShader
   for tier 1; GPU memory per scene; download totals per tier; LCP and INP
   on home unchanged within budget; recordings and screenshots under
   `docs/qa/phase-08/`; a Persian checklist for the client's real-device
   test (one mid Android, one iPhone, one old laptop) that also asks which
   scene feels closest to immersive-g.com and hidokmeh.com, and which does
   not (brief decision 20).
8. `docs/reports/phase-08.md` with a scene-by-scene table: cost, tier
   behavior, fallback.

## Steps

1. Read the current React Three Fiber, drei and three.js docs for the
   installed majors before writing scene code.
2. Build the host and the tier system first with an empty scene; prove the
   monitor steps down under load.
3. Add scenes in scroll order, one at a time, measuring after each; a scene
   that cannot meet its tier budget ships at a lower tier only.
4. Run the full scroll under each tier profile; record; fix in one batch;
   confirm once; stop.
5. Independent review focused on memory leaks, context loss, mobile Safari
   quirks (WebGL 2 availability, DPR, `100dvh`), and whether any scene hides
   a CTA.

## Acceptance criteria

- 60 fps at tiers 3 and 2 on every scene at 4x throttle; never under 50 fps
  at tier 1 under SwiftShader; tier 0 has no canvas.
- Home budgets hold per tier: initial JS, WebGL assets, LCP, INP, CLS,
  Lighthouse >= 90 at tier 1 settings.
- The monitor steps down under induced load and the page stays usable; the
  override works and persists.
- Memory returns to baseline after a full scroll; context loss recovers
  without a reload.
- Both themes render correctly in the world; reduced motion disables it.
- No canvas frames render while the hero photo covers the viewport.
- Text, CTAs and navigation are unchanged and reachable in every tier.

## Hand-off

Ask the client to run the real-device checklist and report fps feel, any
device that struggles, which scene feels closest to the reference sites and
which does not, and whether any scene should be bolder or calmer. Show the
two molar pictures and ask which tooth they want in scene 4 (gap 34b).
Next to them, show the mark as a porcelain relief in the scene 2 render and
ask yes or no (gap 34a, pending since the phase 2 gate, not a new
question); launch needs an explicit yes.
