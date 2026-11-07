# Phase 08 - WebGL world on the home page

Date: 2026-11-05. Built in two lanes on `4506586` (WORLD and
MOLAR), joined on `main` after `cc3e565`; the join and the review fixes are
`7703674` to `ba218ba`.

Versions: three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei (already
installed), gsap 3.15.0, Playwright 1.64.0 with Chromium 141. No new
dependency.

## What the home page draws

| Scene | Tiers and widths | What draws | Lane docs |
|---|---|---|---|
| World (all) | 1 to 3, where a scene draws | Camera path and light drift on the master timeline, diamond dust 400 / 200 / 80 points, grain in the materials at tiers 2 and 3 | `docs/qa/phase-08/world/` |
| 2 hero exit (`trust`) | 1 to 3, from 1024 px | Glass mark and gems in the text-free box under the hero; shrinks into the services mark | same |
| 3 services | 2 and 3, pinned layout | Five procedural porcelain reliefs in the empty lower band | same |
| 4 restoration | 2 and 3 everywhere, 1 from 1024 px | The 3D molar in its slot (scissor pass), turned by the stepper | `docs/qa/phase-08/molar/` |
| 5 workflow | 2 and 3, pinned layout | The workflow beats on the pinned diagonal | same |
| 6 compare | 2 and 3, from 1024 px | Displacement wipe between the two photos (the preview's demo cases have no slider, so it shows nothing there) | same |
| 9 first visit | 2 and 3 | The world background and key light turn warm | world |
| 10 booking | 2 and 3, from 1024 px | The mark breathes in a slot under the hours; the stage is transparent only while it paints | world |

Tier 0, reduced motion, Save-Data and no WebGL 2 get no canvas, as in phase 7.

## Gates (after the join)

- Every WebGL scene says where it draws (`webgl.draws` in
  `src/experience/scenes/registry.ts`). `scenesDrawWebgl(tier, settings)`
  is true only where one does, so a tier 1 phone loads no three.js.
- Without `?debug=1` the canvas chunk loads only once the world window under
  the hero shows (an IntersectionObserver in `ExperienceRoot.tsx`), or when
  the page opens below it (a restored place, an anchor).
- Scenes mount through `src/experience/world/SceneSlots.tsx`: one scene
  ahead, unmounted two away; a scene that draws nothing on this device never
  loads its chunk.
- Draco: the world's models decode in a same-origin worker
  (`public/brand/3d/draco/draco-worker.js`, generated at sync time); the
  molar is decoded at build time (`scripts/molar-glb.mjs`). The CSP is
  unchanged: no `blob:` worker, no `eval`.

## Review of the join (independent reviewer)

| Finding | Severity | Outcome |
|---|---|---|
| The idle world turned black after a resize, DPR change or context restore (`alpha: false`, one clean frame, then skipped frames) | Critical | Fixed in `27e6de6`: each of them asks for one more clean frame. No unit test (R3F render loop); covered by reading the R3F source |
| The canvas never loaded when the page opened below the trust band | Required | Fixed in `3c09264`, test XR1 (proved red without the fix) |
| The canvas frame monitor ignored the phone rules (D26) on tier 2 phones | Required | Fixed in `ba218ba`, tests MP1 and MP2 (MP1 proved red) |
| Molar slot scenes never report empty, so tier 1 renders the world full screen across scenes 3 to 6 | Optional | Not done: costs frames, no wrong output |
| Strict Mode double effects release geometry once in development | Nit | Not done: production unaffected |

## Measured

- Initial JS home 161 KiB of 170; content pages 144.9 to 149.3 of 150; every
  page class inside its limits (`check:bundle`).
- Downloads after a full scroll: about 365 KB gzip at every tier (budgets
  2.5 MB / 1.2 MB / 500 KB).
- Text contrast over the canvas: at least 5.13:1 in both themes at 1440x900
  and 390x844 (`docs/qa/phase-08/world/contrast.json`).
- Frames: this container has no GPU. On SwiftShader at rest: tier 1 16.8 fps,
  tier 2 9.5, tier 3 5.3. Production detects a software renderer as tier 0,
  so no visitor gets these numbers. **Real-device frame rates are not
  measured yet.**

## Tests

- Unit: 230 files, all green after the join except one footer timer test that
  failed once under load and passed alone.
- e2e, one worker, on the joined build: experience, tiers, tier0 and every
  `home-*` spec, 168 passed and 1 failed (T-PH4 timed out mid-swipe). After
  the review fixes, the affected specs: 71 passed and 1 failed (T-EN4g: the
  software renderer was slow enough that the frame monitor stepped tier 2
  down to 1; it passed on the first run).

## Open

- Closed 2026-11-07: CI run 42319407394 on `ccd9256` was green in every job
  (the journey replaced the WebGL scenes), so the phase 8 widening of
  `allow_red_ci` was taken back out of `server.yml`; it again accepts only a red
  Lighthouse step. Server run 42327906777 deployed `ccd9256` to the preview
  with CI green.

- Frame rates on real phones and laptops (owner's check list).
- T-EN4g and the tier 2 keyboard walk depend on runner speed without a GPU.
- Scene 6 needs a real before/after case with a slider to show on the preview.
