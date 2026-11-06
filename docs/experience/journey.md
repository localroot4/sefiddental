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
- The canvas stays one fixed, `aria-hidden`, `pointer-events: none` layer under the
  DOM text (CanvasRoot, phase 8 gates unchanged). The courier never covers text, a
  CTA or a form field: every dock is a DOM box that holds no text.

## 2. Stations

A **dock** is an empty DOM box with `data-dock="<id>"`, measured in document pixels
(`world/anchor.ts`, on mount and on resize, never per frame). The courier **holds**
at a dock while the dock's own range is on screen, and **travels** between two docks
over the scroll between them.

| # | Dock | Section | Form at the dock | What happens while docked |
|---|---|---|---|---|
| D1 | `hero` | Hero, beside the headline on the photo side | mark | Rises out of the hero photo at the end of the intro (it takes over from the intro's SVG mark at the same screen box), slow idle turn |
| D2 | `services` | Services stage, above the track | mark | Turns a little per service as the track moves (the SVG icon morph stays the readable part) |
| D3 | `restoration` | Restoration stage, the molar slot | tooth | The phase 8 restoration rig drives it: the three levels (filling, inlay, crown) |
| D4 | `workflow` | Workflow diagonal | tooth | The beats on the tooth itself: point cloud, wireframe, solid, lit |
| D5 | `smile` | New band between workflow and before/after | tooth, then the arch | The tooth flies into the empty slot of a full arch and seats with a soft click. The camera pulls back; the arch dissolves into a smiling face photo (a demo stock photo, `DEMO_CONTENT` only) |
| D6 | `dentists` | Dentists heading, end side | mark | Small, idle; it leaves the smile as a mark (whip at the start of travel) |
| D7 | `booking` | The empty slot under the hours | mark | Breathes beside the form (phase 8 booking stage rules stay: the stage is transparent only while the courier paints there) |
| D8 | `footer` | The footer playground's mark home | mark | Falls into the footer field and hands over to the playground (section 4) |

Travel between docks: a cubic path from one dock's centre to the next, eased
(`power2.inOut` on the scroll between them), with a small arc toward the page's
middle and a turn of at most 180 degrees. Scale follows the dock size. Speed is
bounded: a travel spans at least 60 vh of scroll.

## 3. One pose function

`courierPose(scrollY, docks, viewport, tier)` in `src/experience/journey/pose.ts` is
pure and returns `{ x, y, scale, rotation, form, whip, arch, smile, hidden }` for one
frame. Everything that moves the courier reads it: the WebGL courier, the DOM
courier and the tests. Same input, same output, so reverse scroll is exact and a
reload at any place shows the right pose at once. It has unit tests for every dock,
both travel ends, the whip, a resize, and a page that opens mid-journey.

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
| Tier 2-3, any width | WebGL courier, all eight docks; at narrow widths the docks are the phone layout's empty boxes |
| Tier 1 (desktop or phone) | DOM courier: the same pose function moves an inline SVG of the mark and the tooth (two layers, the whip swaps them); D5 shows the arch as an SVG and the smile photo |
| Tier 0, reduced motion, Save-Data, no JS | No courier. Each section shows its phase 7 static art; the footer is static |

A tier change mid-page switches courier type at the current pose, with no jump.

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
