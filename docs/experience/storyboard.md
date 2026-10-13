# Home Experience Storyboard: «سفر یک لبخند»

Scene-by-scene board for the home page. Frames are in `docs/experience/frames/`
(wireframe level, rendered from `design/tools/frames.html`). Scroll ranges
are in viewport heights (vh) from the top of the document on desktop;
phones use native vertical scroll with no pinning, so their ranges are the
natural height of each section. Costs are estimates for phase 8; measured
numbers replace them in the phase 8 report.

Conventions: D = desktop and tablet landscape (>= 1024 px), P = phones and
tablet portrait, T0 = tier 0 (no WebGL, reduced motion). Exception: scenes 1
and 2 split at 744 px. Their phone version applies under 744 px only; tablet
portrait (744-1023 px) uses the full-bleed hero with the facts in a 2x2 grid
on its bottom edge. "Mark" is the teal logo mark; "diamonds" are the four
square gems of the wordmark; "bar" is the long bar of the wordmark. The
world material is the porcelain relief: matte white reliefs with soft
shadows on the warm surface (light theme), or teal glass on navy (dark
theme).

## Overview

| # | Scene | D range (vh) | Pinned | Direction | 3D layer | Phone version | T0 |
|---|---|---|---|---|---|---|---|
| 0 | Intro | 0 (overlay) | no | none | none (CSS and SVG) | same, shorter distances | static logo |
| 1 | Hero (direction B) | 0-100 | no | vertical | none: the photo covers the world | scrim text, booking card, then a 4:5 photo band with the facts | the same layout, static |
| 2 | Trust band and hero exit | 100-140 | no | vertical | the world appears as the photo leaves; camera tilt 3 degrees | facts 2x2 on the photo band's bottom edge | static facts |
| 3 | Services | 140-440 (300 vh for 5 worlds) | yes | horizontal | backdrop plane with subtle depth, mark morphs to icons (SVG) | native scroll-snap row | vertical bento |
| 4 | Three restoration levels | 440-640 (200 vh) | yes | vertical scrub | molar turntable, CIP shader | 3-step tap control, static molar poster per step | SVG morph stepper |
| 5 | Digital workflow | 640-940 (300 vh) | yes | diagonal | point cloud to wireframe to solid to lit; photo billboards | vertical steps with diamond markers | vertical steps |
| 6 | Before and after | 940-1040 | no | vertical | displacement wipe (tiers 2-3) | DOM clip-path slider | DOM slider |
| 7 | Dentists | 1040-1140 | no | vertical | depth parallax on cards (fine pointer) | snap carousel | static cards |
| 8 | Patient voices | 1140-1240 | no | vertical | soft 3D carousel (tiers 2-3) | simple cards | simple cards |
| 9 | First visit and FAQ | 1240-1360 | no | vertical | world light turns warm | same | same, no light change |
| 10 | Booking | 1360-1460 | no | vertical | mark idles beside the form | same (full form, second instance on home) | same |
| 11 | Footer playground | 1460-1560 | no | vertical | logo parts drop and can be thrown (3D at tier 3, DOM at 1-2) | DOM physics, touch | static footer |

Total about 15.6 viewport heights on desktop. Three direction changes:
vertical to horizontal (scene 3), horizontal back to a vertical scrub
(scene 4), vertical to diagonal (scene 5).

## Scene 0: Intro

- Question it answers: can a memorable brand reveal cost nothing in LCP?
- This is the brand moment of the first seconds: the hero has no WebGL
  (brief decision 19), so the mark reveal carries the brand.
- 0%: overlay in the surface color, mark outline at center, hero B already
  painted beneath (the hero photo is the LCP element from 744 px; on
  phones the H1 is, see scene 1).
- 50%: four diamonds have flown in and settled; the bar is drawing right to
  left as the real loading line (minimum 400 ms, maximum 1300 ms).
- 100%: mark strokes snapped, «سفید» filled, the mark scaled up as a mask
  (SVG mask scaled by transform) that opens onto the hero B composition;
  overlay removed; the scrim text settles, then the booking card.
- While the overlay is up, `main` is inert. Any key (Tab and Esc included)
  or a tap ends the intro, so focus never lands on the hidden phone field.
- The WebGL canvas mounts after `load` beneath the content but renders no
  frames while the hero photo covers the viewport.
- Phones: identical, distances 12 px, same timings; the reveal opens onto
  the scrim and the card.
- T0: no overlay; static logo in the header.
- Assets: inline SVG of the mark and wordmark (under 9 KB), CSS keyframes,
  under 2 KB inline JS. Cost: zero WebGL, zero layout shift.
- Prototype: `design/prototypes/0a-intro.html`. It reveals the archived
  direction A hero and skips only on a click or Esc; phase 7 builds the
  reveal onto hero B and the key rule above.

## Scene 1: Hero (0-100 vh), direction B

- Job: promise and first action. Reference: `design/hero-directions/b.html`
  (brief decision 19; direction A in `a.html` is archived). A full-bleed
  real photo; on a scrim at the start side, the H1 «اولین کلینیک
  دندانپزشکی دیجیتال جنوب تهران», the subtext with «مشاورهٔ اول رایگان»
  and one secondary action, «تماس با کلینیک». The scrim has no
  «رزرو نوبت», because the card beside or below it carries that intent.
- Booking card at the end side: the compact instance of the booking form
  (phone field plus the hidden fields, `docs/conversion.md` 5.1). Its
  «ثبت درخواست» is the only primary CTA in the hero. `booking_submit`
  carries `location = hero`.
- Card success: compact and in place, items 1-4 of `docs/conversion.md`
  5.4 (drawn check, «درخواست شما ثبت شد», the callback line with the
  masked number, the caller-number line with «ذخیرهٔ شمارهٔ کلینیک»). The
  card reserves its minimum block size, so success causes no layout shift.
  The full 5.4 content lives in the scene 10 success state and on
  `/رزرو-نوبت/ثبت-شد`.
- CTA routing: the header and sticky-bar «رزرو نوبت» focus the card's phone
  field while the card is in view; otherwise they scroll to the scene 10
  block. On phones the sticky bar stays visible while the card is in view
  and hides while any input has focus.
- Layers, back to front: the photo (`<img>`), the static mark relief, the
  scrim and the card, the trust band (scene 2). No WebGL frames here: the
  photo covers the fixed canvas, which renders no frames until the hero exit.
- Scrim: the surface color at 88% over the photo. Its text passes AA over
  both a black and a white photo pixel (`design/tools/contrast.py`,
  composite check).
- Mark relief: the static relief of b.html stays for phase 4 and is judged
  over the first real photo. Remove it if it covers the focal area or reads
  as a watermark; remove it by default if no real photo exists by phase 7.
- 0%: scrim text and card settled after the intro. 50%: nothing moves (no
  pointer parallax next to a form). 100% (leaving): native scroll; the hero,
  the card and the trust band scroll away together; at >= 1024 px and tiers
  1-3 the photo moves at 0.85x (transform only); the porcelain world
  appears behind it (scene 2).
- Optional exit enhancement, >= 1024 px and tiers 2-3 only: the photo
  contracts into the mark shape (SVG mask scaled by transform). Keep it only
  if it holds 60 fps at 4x CPU throttle.
- Tablets and desktop (>= 744 px): full-bleed landscape photo, scrim at the
  start (right) side, card at the end (left) side, trust band on the hero's
  bottom edge (744-1023: a 2x2 grid; >= 1024: one row of four). The
  landscape crop is the LCP element.
- Phones (< 744 px): the scrim panel (H1, subtext, «تماس با کلینیک»), then
  the card, then a 4:5 photo band with the four facts on its bottom edge.
  The first screen is the header, the scrim and the card. At 390x844 the
  phone field and «ثبت درخواست» are on it. On 640 px tall phones the phone
  field is below the first screen; the sticky-bar «رزرو نوبت» focuses it.
  The H1 is the LCP element; the 4:5 crop loads without priority.
- T0: the same layout, no motion.
- Assets: the hero photo, landscape plus a 4:5 crop from the same shoot
  (brief in `docs/content/shot-list.fa.md`: an empty clinic interior in
  natural light, no faces; the key detail in the central and upper band);
  no glTF in this scene. Cost: one image decode, zero WebGL frames.

## Scene 2: Trust band and hero exit (100-140 vh)

- Job: credibility in three seconds. From 744 px the band sits on the
  hero's bottom edge and shows from 0 vh; this range is the hero exit. On
  phones the band sits on the bottom edge of the photo band, after the card.
- Facts are static text, with no count-up: the band is in the first screen
  from 744 px, under the intro overlay. Until gap 15 closes, use the facts
  of b.html: «مشاورهٔ اول رایگان», «هر روز ۱۰ تا ۲۰», «تماس پذیرش تا ۱۰
  دقیقه» and «بیمه‌های طرف قرارداد» with «ایران، کارآفرین، پاسارگاد، البرز،
  ما و سایر بیمه‌ها». The label follows brief decision 14: five insurers
  by name, the rest under «سایر بیمه‌ها».
- 0%: the band on screen with the hero. 50%: the band leaves with the
  hero; the world shows behind the photo: the mark relief at the end side,
  the diamonds drifting on a slow 12 s loop; camera front, slight low angle;
  key light cool (dawn). 100%: the camera tilts 3 degrees to introduce depth
  before the horizontal turn; the mark drifts up and shrinks to become the
  scene 3 protagonist.
- Phones: the world appears after the photo band scrolls away; no parallax.
- T0: static facts; no world.
- Assets: mark.glb (Draco, target under 60 KB), diamond.glb (under 10 KB),
  environment from RoomEnvironment (no HDR file). Cost: about 30k
  triangles, one shadow map at tiers 2-3; no frames while the photo covers
  the viewport.

## Scene 3: Services, the horizontal turn (140-440 vh, pinned)

- Job: orientation. Five worlds: زیبایی، جراحی و جایگزینی دندان، درمان و
  نگهداری، ارتودنسی، دندانپزشکی کودکان. Each world is a card group (DOM) on
  a wide track; the track slides horizontally as the user scrolls down.
- 0%: the first world (زیبایی) fills the stage; the mark sits above the
  track. 50%: the third world; the mark has morphed through sparkle,
  implant and shield icons (MorphSVG, 2D over the canvas). 100%: the fifth
  world; a «همهٔ خدمات» link; the track unpins.
- WebGL layer: a shallow porcelain backdrop with large soft relief shapes
  moving at half speed (depth); no text in 3D.
- Phones: no pin; a native scroll-snap row of five cards with the mark
  static above; a small progress bar under the row.
- T0: a vertical bento of five tiles.
- Assets: five icon paths (SVG), backdrop plane with a 1024 px KTX2 normal
  map (under 300 KB at tier 3, 512 px at tier 2, none at tier 1). Cost:
  low; the pin is the main cost (layout) and is DOM only.
- Prototype: `design/prototypes/0b-services-horizontal.html`.

## Scene 4: Three restoration levels (440-640 vh, pinned scrub)

- Job: the signature differentiator. A stylized porcelain molar on a
  turntable; scroll advances three steps: معمولی, VIP, CIP.
- 0%: molar in state «معمولی», label and one-line description, CTA «رزرو
  نوبت» (tier prefilled). 50%: state «VIP»: form refined, surface smoother,
  clearcoat higher. 100%: state «CIP»: color characterization shader fades
  in (warm gradients and fine stain lines near the cusps); CTA follows.
- Phones: three-step tap control; the molar renders at tier 2-3 as a
  smaller canvas, or three poster frames at tier 1.
- T0: the SVG morph stepper from phase 2 (prototype in phase 7).
- Assets: molar.glb (Draco, target under 120 KB, about 40k triangles after
  subdivision), one shader. Cost: moderate; shadows hard at tier 2.
- Prototype: `design/prototypes/0d-molar-turntable.html`.

## Scene 5: Digital workflow, the diagonal (640-940 vh, pinned)

- Job: reassurance through method. Four beats along a diagonal path from
  the top start corner to the bottom end corner: اسکن (a point cloud forms
  the tooth), طراحی (wireframe to solid), ساخت (the enamel appears), لبخند
  (warm light, a real photo billboard).
- 0%: point cloud assembling; caption «اسکن دیجیتال، بدون قالب‌گیری».
  50%: solid tooth with wireframe fading; caption «طراحی قبل از درمان».
  100%: lit enamel beside a real photo; light now warm; caption «لبخند».
- Phones: vertical steps with diamond markers; the WebGL beats become
  four still renders (AVIF) with a short crossfade; no pin.
- T0: vertical steps with stills.
- Assets: reuse molar.glb for the point cloud (sampled vertices) and the
  solid; four billboard photos (client); particle count 3000 (tier 3),
  1500 (tier 2), 600 (tier 1). Cost: moderate; the diagonal camera move
  is cheap, the particles are the cost.
- Prototype (DOM path only): `design/prototypes/0c-workflow-diagonal.html`.

## Scene 6: Before and after (940-1040 vh)

- Job: proof. One featured compare slider plus two thumbnails linking to
  the gallery.
- 0%: the pair at rest with the handle centered. User drag or arrow keys
  move the handle; at tiers 2-3 the wipe edge has a soft displacement; at
  tier 1 and T0 a DOM clip-path.
- Phones: DOM clip-path slider, 44 px handle.
- Assets: two photos per case (client, with consent). Cost: tiny.
- Prototype: `design/prototypes/0f-compare-wipe.html`.

## Scene 7: Dentists (1040-1140 vh)

- Job: authority and faces. Portrait cards with name, specialty, council
  number. Hidden until the client publishes at least one dentist.
- Desktop: cards with depth parallax on pointer; phones: snap carousel.
- T0: static grid. Assets: portraits 4:5. Cost: none.

## Scene 8: Patient voices (1140-1240 vh)

- Job: social proof. The three existing testimonial videos as poster cards
  in a soft 3D carousel (tiers 2-3) or a plain carousel; play opens the
  native player; a consent line.
- Assets: three posters, three MP4 (streamed on play, never preloaded).

## Scene 9: First visit and FAQ (1240-1360 vh)

- Job: remove fear, answer objections. The world light turns warm here
  (peach key light); the first-visit steps in four lines; a FAQ accordion
  with a sticky aside (call, WhatsApp, booking) on desktop.
- T0: same content, no light change.

## Scene 10: Booking (1360-1460 vh)

- Job: convert. The second instance of the booking form on home (brief
  decision 19): the full form of `docs/conversion.md` 5.1 (the phone field
  plus the optional name, service and time chips, and note), from the same
  component as the hero card. Ids are prefixed per instance;
  `booking_submit` carries `location = block`.
- Tier steps (scene 4) and the FAQ aside (scene 9) scroll here with the tier
  or service prefilled. The header and sticky-bar «رزرو نوبت» scroll here
  once the hero card is out of view.
- Success: the full state of `docs/conversion.md` 5.4 in place, the same as
  `/رزرو-نوبت/ثبت-شد`.
- Home stays static or ISR and cacheable: both forms fetch the CSRF token,
  the signed time token and the hours state from the no-store endpoint.
- Stage: warm; the mark idles beside the form (slow breathing, no
  distraction); static map and hours next to it on desktop, below it on
  phones.
- T0: the form alone.

## Scene 11: Footer playground (1460-1560 vh)

- Job: delight and memory. When the footer enters, the logo parts drop from
  the header line into the footer box, bounce once and settle; the user can
  drag and throw them; after 6 s they drift home. Tier 3 renders the parts
  as 3D porcelain; tiers 1-2 use DOM elements; T0 shows the static footer.
- A «پخش دوباره» button serves keyboard users.
- Prototype: `design/prototypes/0e-footer-playground.html`.

## Asset list and budgets (targets for phases 7 and 8)

| Asset | Format | Tier 3 | Tier 2 | Tier 1 |
|---|---|---|---|---|
| mark.glb | glTF Draco | 60 KB | 60 KB | 60 KB |
| diamond.glb | glTF Draco | 10 KB | 10 KB | 10 KB |
| molar.glb | glTF Draco | 120 KB | 120 KB | 60 KB (decimated) |
| backdrop normal map | KTX2 | 300 KB (1024) | 120 KB (512) | none |
| grain and noise textures | KTX2 | 60 KB | none | none |
| workflow stills (phones) | AVIF x4 | 320 KB | 320 KB | 240 KB |
| three.js plus scenes | JS gz | about 220 KB | 220 KB | 160 KB |
| GSAP plus engine | JS gz | about 60 KB | 60 KB | 60 KB |
| Total after first paint | | under 1.4 MB | under 1.1 MB | under 0.5 MB |

These sit inside the experience budgets (2.5 MB, 1.2 MB, 0.5 MB) with room
for photography.

The hero photo is not tiered: it loads before the tier is known. Format:
AVIF with a WebP fallback, art-directed in one `<picture>`.

- Landscape crop (>= 744 px): srcset 1280, 1600, 1920 and 2560 w, at most
  120, 160, 200 and 280 KB; `sizes="100vw"`; one preload with
  `media="(min-width: 744px)"` and `fetchpriority="high"`; never lazy.
- Phone 4:5 band (< 744 px): srcset 640, 828 and 1080 w, at most 60, 80 and
  110 KB; no preload, no high priority.

## Prototype measurements (phase 2, software GPU)

Numbers from `design/NOTES-prototypes.md`; WebGL values are floors from a
software renderer, DOM values are representative of a slow laptop.

| Scene | Prototype | Result |
|---|---|---|
| 0 Intro | 0a | 1250 ms (hard cap 1400), CLS 0, skip and session-once work, reduced motion ends in under 2 ms |
| 1-2 World at the hero exit | 00 | 7 / 4 / 2 fps at tiers 1 / 2 / 3 on the software GPU; auto drop 3 to 2 in 4 s, to 1 in 7 s |
| 3 Services | 0b | 60 fps at 1x and 4x CPU, 56 at 6x; phone row is native scroll snap |
| 4 Restoration levels | 0d | 8 fps at tier 1 on the software GPU (fill-bound): software renderers become tier 0 |
| 5 Workflow | 0c | 60 / 54 / 50 fps at 1x / 4x / 6x, DOM only |
| 6 Before and after | 0f | DOM slider fully keyboard-driven; WebGL wipe 16 to 24 fps on the software GPU |
| 11 Footer | 0e | 60 / 54 / 48 fps at 1x / 4x / 6x; drag, throw, return home and replay work |

## Open points for the client at this gate

Answers of 2026-10-13:

1. Hero direction: B, `design/hero-directions/b.html` (brief decision 19).
   Scenes 0, 1, 2 and 10 above follow it; direction A is archived.
2. Approval of the traced logo and of the 3D interpretation of the mark:
   not answered yet (gaps 1 and 34). They are listed again as pending, with
   a screenshot and a yes or no; launch needs an explicit yes or the
   original vector. Phase 3 uses the trace as is.
3. Which prototype feels closest to the reference sites: not judged. The
   client watched every recording and screenshot and called them drafts
   that will not ship as they are. The comparison moves to the phase 7
   hand-off and the phase 8 real-device checklist, on real pages and scenes
   only (brief decision 20). Gap 33 stays open but optional.
4. Molar (gap 34): the client did not understand the question; it was
   explained in plain Persian on 2026-10-13, with no new question. The
   stylized in-house molar stays the default (brief decision 22). Phase 7
   uses the SVG stepper, so the 3D molar is first needed in phase 8; there
   the client picks from two side-by-side renders.
