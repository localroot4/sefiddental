# Phase 8, lane MOLAR: scenes 4, 5 and 6 in WebGL

Branch `p8-molar`. Scenes 4 (restoration levels), 5 (digital workflow) and 6 (before and after)
draw in the one fixed canvas through the scene contract (`webgl.load`, `webgl.assets`,
`webgl.draws`). Lane WORLD (scenes 1 to 3, 9 and 10, the camera, the world lights) is a separate
branch; nothing here depends on it.

## How a slot scene draws

Each scene owns a private three.js scene (camera, lights, materials) and draws it into the box of
its DOM world slot after the shared root render (R3F `addAfterEffect`, scissor, depth cleared in
the box): `src/experience/scenes/webgl/pass.ts`. It never moves the shared camera or relights the
world, and it takes no `useFrame` priority. After its first drawn frame the slot gets
`data-world-live` and the DOM art it replaces hides (the SVG molar, the slider's two photo
layers); a lost context, an unmount, or a frame with nothing to draw hands the DOM art back in
the same frame. The DOM stays the source of truth: chips, slider input, text, CTAs and photos.

`SceneSlots` (`src/experience/canvas/SceneSlots.tsx`) mounts one slot per registry scene with
`webgl.load` by `scenes/lifecycle.ts` (load one scene ahead, keep the neighbours, unmount two
scenes away, where the scene disposes its geometry, materials and textures). React state changes
only when the active scene does. The canvas chunk loads only where a registry scene draws at the
tier on this device (`scenesDrawWebgl`): a tier 1 phone loads no three.js.

## What each scene does per tier

| Scene | Tier 3 | Tier 2 | Tier 1 | Tier 0, reduced motion | Phones (under 1024 px) |
|---|---|---|---|---|---|
| 4 Restoration | 3D molar on a turntable in the molar slot (1.3x box from 1024 px); a third of a turn per level; VIP: cusp refinement and gloss; CIP: warm cervical and root shade, cool tips, stained fissures | same | same from 1024 px | SVG stepper, no canvas | tiers 2 and 3: the 3D molar in the slot; tier 1: SVG stepper (the storyboard's posters; no new images) |
| 5 Workflow | pinned diagonal: point cloud (3000) forms the tooth under a scan band, wireframe, solid builds root to cusp, glaze, warm light; camera on a diagonal arc | same, 1500 points | DOM steps (minTier 2) | DOM steps | DOM steps with the timeline line (no WebGL) |
| 6 Before and after | displacement wipe of the two photos at the slider's divider; DOM labels, divider, handle and range stay | same | DOM clip-path | DOM clip-path | DOM clip-path |

Materials: no environment map at any tier. The enamel draws its own studio reflection (two soft
panels, Schlick-weighted) and a subsurface-like glow (warm ivory at grazing angles and through the
cusp tips) instead of transmission, which a scissored pass cannot use. A PMREM room doubled the
frame time on the software GPU (below). Shadow: a soft contact blob at every tier, not a shadow
map. Post-processing (bloom, grain) is the host's and does not apply to the slot passes.

The molar: the stylized in-house `design/brand/3d/molar.glb` (gap 34: unchanged). Draco cannot be
decoded in the page (CSP: `worker-src 'self'`, no `'wasm-unsafe-eval'`), so the prebuild decodes it
once (`scripts/molar-glb.mjs`) into `public/brand/3d/molar.glb`: plain glTF, float positions,
int8 normals (KHR_mesh_quantization), 83,428 bytes raw, about 55 KB gzipped.

## Downloads (gzipped, from this build)

| Item | Size | When |
|---|---|---|
| three.js + R3F chunk | 237.0 KB | after `load`, where a scene draws |
| canvas host chunk | 8.3 KB | same |
| GLTFLoader chunk | 16.3 KB | with scene 4 or 5 |
| scene chunks 4 / 5 / 6 | 3.7 / 4.4 / 2.6 KB | one scene ahead of the reader |
| molar.glb | 55 KB (83.4 KB raw) | with scene 4 or 5 (cached for the other) |

Initial JS: `npm run check:bundle` passes; home 160.6 KiB of 170, service pages 150 KiB of 150
(the slider island is unchanged; the wipe hides its layers from `globals.css`). The engine set
after `load` at tier 1 is 59.8 KiB of 64 (T-EX5, canvas chunks left out).

## Frame times (container: no GPU)

Read these as a floor, not as device numbers. The container has no GPU: "default" headless also
renders WebGL with SwiftShader on the CPU. The host's load average was 6 to 8 on 4 CPUs while
other lanes ran. Not measured on a real GPU or device.

`scripts/measure-home.mjs --only=frames --tiers=2,3 --sections=restoration,workflow,compare`
(1440x900, wheel scroll, median of 3; full table in `frames/README.md`):

| Section (median fps / slowest window fps) | default 2, 4x | default 3, 4x | swiftshader 2, 4x | swiftshader 3, 4x |
|---|---|---|---|---|
| restoration | 12.2 / 10.3 | 12.8 / 10 | 9.5 / 7.9 | 10.3 / 5.7 |
| workflow | 9.6 / 6.2 | 9.6 / 6.2 | 4.9 / 3.2 | 4.9 / 2.7 |
| compare | 14.9 / 14.3 | 13.9 / 12.8 | 9.6 / 9.5 | 9.4 / 8 |

The same sections in phase 7 (DOM only, `docs/qa/phase-07/steps/05-08-combined`) held 58 to 60 fps
at tier 2 and 4x. At 1x CPU, steady frame time while a scene is in view (rAF deltas, 60 frames,
median / p95 ms; same host):

| | services (canvas, nothing drawn) | restoration | workflow | compare |
|---|---|---|---|---|
| 1440, tier 1 | 16.7 / 16.8 | 16.7 / 16.8 | (not drawn) | (not drawn) |
| 1440, tier 2 | 16.7 / 50 | 50 / 83 | 117 / 183 | 50 / 83 |
| 1440, tier 3 | 16.7 / 33 | 50 / 117 | 117 / 150 | 50 / 100 |
| 390, tier 3 (dpr 2) | | 67 / 117 | (not drawn) | (not drawn) |

Before the material changes the 1440 tier 3 restoration was 100 ms and the 390 tier 3 one 133 ms
(room environment, sheen). Heap returns to 8.4 to 8.5 MiB after GC in every run.

Verdict: the phase 8 target (60 fps at tiers 2 and 3 with 4x CPU) is **not met in this container**
and **not tested on a GPU**. The scenes are a few thousand triangles and up to 3000 points; the
cost here is software fill (the physical enamel shader per pixel, MSAA at tiers 2 and 3, the
wireframe's 17,640 lines). Next step: the client's real-device checklist, and a measurement on a
machine with a GPU, before any scene moves to a lower tier.

## Screenshots (`screens/`, ?tier=3, SwiftShader, e2e database)

- Scene 4: `s4-plain|vip|cip-1440-light|dark.jpg`; phones `s4-plain|cip-390-light|dark.jpg`.
- Scene 5: `s5-p0|p33|p66|p100-1440-light|dark.jpg` (pin progress 0, 1/3, 2/3, 1: scan, design,
  make, smile); phones `s5-390-light|dark.jpg` (DOM steps).
- Scene 6: `s6-1440-light|dark.jpg` (WebGL wipe), `s6-390-light|dark.jpg` (DOM slider). The e2e
  fixture's photos are flat grey squares.

## Stills for the client (`stills/`)

- `scene4-molar-plain|vip|cip-light|dark.jpg`: the stylized molar in the scene 4 light, at 3x,
  for gap 34b. The realistic candidate is not rendered: it needs a licensed model (brief decision
  22, no purchase without the client's approval of the price).
- `mark-relief-prototype00-light.jpg` (porcelain relief on the warm surface) and `-dark.jpg` (teal
  glass on navy), for gap 34a. Rendered from `design/prototypes/00-porcelain-world.html` at tier
  3, not from the real scene 2, which is lane WORLD's and not on this branch: replace it with a
  scene 2 render after the merge.

## Not done, or open

- Scene 5 photo billboards (optional): the photos stay DOM.
- Scene 6 on the client preview: the preview shows the demo cases section (no slider, no
  `data-scene="compare"`), so the wipe draws nothing there until a real case is published or the
  demo section renders a CompareSlider inside a `compare` world slot.
- Lighthouse was not run. On a desktop preset `/?tier=1` the canvas now loads (the molar at tier 1
  from 1024 px): about 260 KB after `load` against the home `deferredKiB` of 65. The mobile preset
  emulates a 412 px touch screen, a phone at tier 1, which should load none: not verified.
- Context loss: handled in code (the slot hands back the DOM art; nothing to rebuild, no render
  targets); not exercised by a test here. GPU memory per scene: not measured.
- `npm run lhci` and the full e2e matrix were not run; the touched specs were (see the report).
