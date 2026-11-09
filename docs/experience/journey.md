# Home journey: one courier from the hero to the footer

Owner decision, 2026-11-06. The phase 8 scenes read as separate pieces (gems, dust,
reliefs, a logo block per section). The owner wants one continuous, clean, premium
motion: one object, the **courier**, travels the whole home page with the scroll,
docks at stations, leaves them, changes form, and ends in the footer playground.
Every step is scrubbed by scroll, so scrolling back plays it exactly in reverse.
This file supersedes the per-scene WebGL objects of `storyboard.md` scenes 2, 3, 9
and 10. The page copy, layout, scroll pins and DOM fallbacks of phase 7 stay.

## 1. The courier

- One object at a time, two forms: the **mark** (the teal logo mark, `mark.glb`) and
  the **tooth** (the molar, `molar.glb`). A form change happens only during travel,
  hidden by a fast half turn (the "whip"): the old form spins edge-on, the new one
  comes out of the same spin. Never two forms on screen at once.
- Material: porcelain or glass with studio light (one key, one fill, one rim); no
  environment map at tier 1. No gems, dust, reliefs or film grain anywhere: remove
  them (`world/Dust.tsx`, the trust, services and booking world scenes, the gems).
- Design intent (polish, 2026-11-07): experience mode; a calm, premium object that
  is always there: glazed brand-teal porcelain with real studio reflections (a room
  PMREM built at runtime), a soft rim and contact shadow; motion that eases and
  settles (a critically damped follow, a lean into the move, a slow idle float and
  a light across the glaze at a dock), never a ghost.
- The canvas and the DOM courier are fixed, `aria-hidden`, `pointer-events: none`
  layers at `z-index: 1` in `.site` (journey/attrs.ts `COURIER_Z`): above the
  sections' boxes, below the header, the sticky bar and the boxes marked
  `[data-above-courier]` (the hero's cards). The courier never covers text, a CTA or
  a field: every dock is a DOM box that holds no text, and every travel goes through
  the clear lanes between them (section 3).

## 2. Stations

A **dock** is an empty DOM box with `data-dock="<id>"`, measured in document pixels
(`world/anchor.ts`, on mount and on resize, never per frame). The courier **holds**
at a dock while the dock's own range is on screen, and **travels** between two docks
over the scroll between them.

| # | Dock | Section | Form at the dock | What happens while docked |
|---|---|---|---|---|
| D1 | `hero` | The hero photo's floor under the gap between the title card and the form card (from 744 px); under 744 px in the 4:5 photo band under the form | mark | Visible from the first view on the photo, above it and below the cards; slow float and turn, a light across the glaze; the first scroll takes it down from where it is. After the intro (tiers 1 to 3; never under reduced motion or at tier 0) it is born in the intro mark's hole, filling it exactly above the cards. As the frame opens it glides to D1 once the overlay lifts (600 ms on a critically damped spring, frame-timed) only where every frame of the glide keeps its form clear of text, controls and cards; else, and on every phone, its mark fades out in the hole with the intro's own fade and it shows here after the lift (on today's layout every width fades). A journey that comes up to 800 ms after the lift glides from the mark's place where that is clear. The canvas mounts once the hand-off is over |
| D2 | `services` | Services stage, above the track | mark | Turns a little per service as the track moves (the SVG icon morph stays the readable part) |
| D3 | `restoration` | Restoration stage, the molar slot | tooth | The phase 8 restoration rig drives it: the three levels (filling, inlay, crown). The tooth turns its chewing surface to the reader (tier 1 a top view, WebGL a three-quarter view) and plays the level's restoration on it as it comes in and on every chip or pin step: plain, a cavity outline then one composite fill; VIP, a ceramic inlay that comes down turned and seats with a click, then a gloss; CIP, dentine, a translucent enamel layer, the fissures stained by hand and a slow shimmer (restore.ts, the same keyframes at both tiers) |
| D4 | `workflow` | Workflow diagonal | tooth | The beats on the tooth itself: point cloud, wireframe, solid, lit |
| D5 | `smile` | The arch band between workflow and before/after, a stage that sticks while the journey runs | tooth, then the arch | The upper arch seen from below (section 9), its teeth where the photo's are. The tooth flies into the empty first molar and seats with a soft click, the camera pulls back, the arch cross-fades into the occlusal photo registered; a glint runs along the teeth and the tooth condenses at the first molar and lifts off toward the reader while the photo dims and settles back |
| D6 | `dentists` | An emblem a small gap after the dentists heading, 1.3 em square, on its line (every width) | mark | As it arrives a soft teal light sweeps the cards' portraits from the left, on their top edge only; then it rests as the heading's emblem |
| D7 | `booking` | The empty slot under the hours | mark | Breathes beside the form (phase 8 booking stage rules stay: the stage is transparent only while the courier paints there) |
| D8 | `footer` | The footer playground's mark home | mark | Falls into the footer field and hands over to the playground (section 4) |

Docks per width (a dock that is not rendered is skipped):

| Width | Docks |
|---|---|
| From 1024 px | All eight. D4 is the pinned diagonal's strip at tiers 2-3 with pins; otherwise the empty box at the end of the workflow header row |
| 744-1023 px (tablets in portrait) | All eight: D1 on the hero photo under the cards, D4 the header box, D7 under the hours (closing the stacked column) |
| Under 744 px (phones) | D1 (in the 4:5 photo band, when the hero has one), D2, D3, D5, D6 (the heading's emblem), D8 |

Travel between docks: a cubic path from one dock's centre to the next, eased
(`power2.inOut` on the scroll between them), with a small arc toward the page's
middle and a turn of at most 180 degrees. Scale follows the dock size. Speed is
bounded: a travel spans at least 45 vh of scroll (less where docks stand closer than that).

## 3. One pose function

`courierPose(scrollY, docks, viewport, tier)` in `src/experience/journey/pose.ts` is
pure and returns `{ x, y, scale, rotation, form, whip, arch, smile, hidden }` for one
frame. Everything that moves the courier reads it: the WebGL courier, the DOM
courier and the tests. Same input, same output, so reverse scroll is exact and a
reload at any place shows the right pose at once. It has unit tests for every dock,
both travel ends, the whip, a resize, and a page that opens mid-journey.


Lanes (`route.ts`): measured with the docks, never per frame, the page's text and
control boxes, the children of `[data-above-courier]`, and whole `[data-courier-wall]`
boxes (a card rail or the services track, whose contents move sideways) are the
obstacles; a scrubbed entrance (`[data-scrub]`) is measured at rest. Each travel is
planned once: at scroll samples every 12 px the courier may stay on the eased path or
take a grid place, smaller down to a minimum, or peek in from a side; a shortest path
(one grid step per sample, the way between two samples checked against the scrolling
boxes) prefers the eased path, full size and calm motion. Where no place on screen is
clear (a phone's full-width text) it leaves the frame at a side and comes back, never
a ghost. A travel floats on screen between its two docks' poses and rides with them at
both ends; a hold ends before its dock reaches the header or the sticky bar.

Secondary motion (`motion.ts`, render only): the shown place follows the pose with a
critically damped spring (about 0.3 s, no overshoot), leans into a sideways move and
squashes a little with the scroll's speed, and stretches through the whip; at rest it
lands on the pose exactly, and a jump of more than half a screen is taken at once.

## 4. Footer hand-off

D8 is the home box of the mark part of the footer playground
(`scenes/dom/footer.ts`). When the courier reaches it, it drops the last 40 px with
the playground's bounce, then the DOM mark part takes its place in the same frame
(courier `hidden`, the part visible) and the playground runs as in phase 7: drag,
throw, bounce, drift home, «پخش دوباره». Scrolling back up out of the footer hides
the part and the courier lifts off from the same box. Tier 3 may draw the thrown
parts in 3D later; not in this step.

## 5. Tiers and devices

| Case | Courier |
|---|---|
| Tier 2-3, any width | WebGL courier at the docks of section 2 for the width |
| Tier 1 (desktop, tablet or phone) | DOM courier: the same pose function moves an inline SVG of the mark and the tooth (two layers, the whip swaps them), shaded as porcelain (enamel gradient, glaze, sheen, contact shadow), centred on the pose; D5 shows the arch as an SVG, centred on its dock, and the smile photo |
| Tier 0, reduced motion, Save-Data, no JS | No courier. Each section shows its phase 7 static art; the footer is static |

A tier change mid-page switches courier type at the current pose, with no jump.

Tablets follow the width rules, not a device list: a touch screen under 1024 px gets the phone
layout's rules for pins (none) and the tablet docks above; from 1024 px the desktop ones.

A GPU without a benchmark row (detect-gpu `FALLBACK`) is classified by its renderer name
(`fallbackTier` in `src/lib/qualityTier.ts`, mirrored in the inline pins script). `FALLBACK`
here means "the data loaded and does not list this GPU" (or detect-gpu has no file for its
vendor, as for Immortalis). A load that failed (the coarse-pointer gate's abort at load + 1500
ms, a 404, bad JSON, a network error) is not `FALLBACK`: `gpuProbe.ts` reports no GPU answer
(tier 1) and caches nothing, so the next visit measures again. The 5.0.70 data stops before the
2024 mobile GPUs (the Xiaomi Pad 7's Adreno 732 is not listed), so these get tier 2, never 3:

| Renderer | Tier 2 from | Why |
|---|---|---|
| Adreno | 640-699, 720-799, every 8xx | The listed 640/650/660 rows run the courier; the 702 and 710 are budget parts (the data lists the 702 at 18 fps) |
| Mali-G | G76 and up; G610 and up in the three-digit series | G76 is the first listed Mali-G with headroom (about 31 fps on 1080p phones; the device-memory cap and the monitor catch the rest); G52/G57 stay at 1 |
| Immortalis | all | Arm's ray-tracing flagship line (G715 and later) |
| `Apple GPU` | all | Safari masks every Apple GPU with this name, so the name cannot tell an A8 iPad from an M4; no memory API exists there. A weak one drops through the frame monitor (auto mode) |

Anything else unlisted stays tier 1. `?tier=` still overrides.

## 6. Budgets and gates

- Home initial JS stays within 170 KiB (`check:bundle`); the courier chunk loads with
  the canvas chunk (phase 8 gate: after the first scroll) or, for the DOM courier,
  with the engine chunk.
- Downloads within the phase 8 budgets; the arch is instanced geometry built from
  `molar.glb` (no new model file over 60 KB); the smile photo is AVIF under 120 KB.
- One draw call for the courier, one instanced call for the arch, no shadow maps at
  tier 1-2, one soft shadow at tier 3.
- Contrast and CLS as phase 8: text over the canvas at least 4.5:1, CLS 0.

## 7. Acceptance

1. Scrolling top to bottom shows one object, never two, moving without a jump between
   every pair of docks, at 1440x900, 1024x768 and 390x844, light and dark.
2. Scrolling back up plays the same poses in reverse (pose at a given `scrollY` is
   the same going down and up).
3. The tooth seats into the arch and the arch becomes the smile at D5.
4. In the footer the mark can be dragged and thrown, and comes home.
5. No text, CTA or field is covered at any scroll position (an e2e probe at each
   dock and mid-travel).
6. Tier 0 and reduced motion load no courier chunk.
7. Unit tests for `courierPose`; e2e for docks, reverse, hand-off, tier 0; lint,
   types, build, bundle green.

## 8. As built (2026-11-06, branch `p9-journey`)

- Code: `src/experience/journey/` (pose, docks, arch, beats, driver, the DOM and WebGL
  couriers). The pose is pure and unit-tested; `?debug=1` installs `window.__sefidJourney`
  (pose, holds, which courier draws) for the e2e rows in `tests/e2e/home-journey.spec.ts`.
- Layers (polish, 2026-11-07): the bands stay under the page (`.site`, z-index -1); the
  DOM courier's layer and the canvas are at z-index 1, above the sections' boxes and
  below the header (30), the sticky bar (40) and the hero's cards (2). The hero is no
  longer a render-gate cover: the canvas draws the courier over its photo.
- D1 is a box on the hero photo's floor under the gap between the two cards (from
  744 px; the hero grid has room for it under the cards) and in the 4:5 photo band
  under 744 px; the courier waits there from the first view.
- Docks per width: section 2. Tablets (744-1023 px) got D4, D6 and D7 on 2026-11-07
  (branch `p9-tablet`); before that the band had only D2, D3, D5, D8 and the courier was gone
  for long stretches. Tablet evidence: `docs/qa/tablet/` (`capture.mjs`).
- D2 is the services SVG mark's own box: at tiers 1 to 3 the mark hides while the journey runs
  (the courier stands in for it, so one mark shows), and tier 0 keeps the SVG mark and its
  icon morph.
- In travel the courier keeps to the clear lanes (section 3): it is never under or over
  text, and never fades.
- D4 draws the point cloud and the wireframe as two extra calls on the tooth; the courier is
  otherwise one call (mark or tooth) plus its soft contact shadow, and the arch one
  instanced call. No shadow map at any tier.
- D5 photo: the owner's occlusal arch photo (`arch-occlusal-*`, section 9) on the
  client preview; elsewhere the labelled placeholder.
- The arch band is a sticky stage with a 1.2-screen room at every tier, tier 0 and
  reduced motion included (decided 2026-11-07): the page keeps one layout at every tier
  (D24, no shift after hydration), so at tier 0 the photo simply holds while the page
  scrolls on.

## 9. D5 occlusal arch photo (owner decision, 2026-11-07)

The smile portrait at D5 is replaced by the upper dental arch seen from straight below (an
occlusal view): a U-shaped arch, incisors at the top, molars at the bottom, symmetric, with the
palate between. The 3D arch is shown from the same angle, the tooth seats into its first-molar
slot, and the arch cross-fades into the photo, registered to it.

Photo needed (the owner provides it; a placeholder render ships until then):

- Portrait 4:5, at least 2400x3000, the arch centred and filling about 80 % of the width, sharp
  edge to edge, even ring-flash light, healthy natural teeth with fine fissure detail, no text,
  labels, instruments or mirror edges, a dark or black surround.
- Files: `public/demo-photos/arch-occlusal-{640,1280}.{avif,webp}` and the alignment numbers in
  its manifest (arch centre, width, incisor and first-molar points).
- Stock search terms: "maxillary occlusal view intraoral photograph", "upper dental arch occlusal
  photo", "healthy maxillary arch top view".
- Image-generator prompt: «Ultra high-resolution clinical intraoral occlusal photograph of a
  healthy adult upper dental arch, viewed straight from below as through an occlusal mirror, the
  full arch from second molar to second molar, perfectly symmetric, natural ivory-white teeth
  with realistic enamel translucency and fine occlusal fissures, healthy pink palate with soft
  rugae, soft even ring-flash lighting, pure black surround, no text, no labels, no instruments,
  no mirror edges, sharp focus edge to edge, medical photography, 8K, portrait 4:5.»
