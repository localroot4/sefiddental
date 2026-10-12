# Home Experience Storyboard: «سفر یک لبخند»

Scene-by-scene board for the home page. Frames are in `docs/experience/frames/`
(wireframe level, rendered from `design/tools/frames.html`). Scroll ranges
are in viewport heights (vh) from the top of the document on desktop;
phones use native vertical scroll with no pinning, so their ranges are the
natural height of each section. Costs are estimates for phase 8; measured
numbers replace them in the phase 8 report.

Conventions: D = desktop and tablet landscape (>= 1024 px), P = phones and
tablet portrait, T0 = tier 0 (no WebGL, reduced motion). "Mark" is the teal
logo mark; "diamonds" are the four square gems of the wordmark; "bar" is
the long bar of the wordmark. The world material is the porcelain relief:
matte white reliefs with soft shadows on the warm surface (light theme), or
teal glass on navy (dark theme).

## Overview

| # | Scene | D range (vh) | Pinned | Direction | 3D layer | Phone version | T0 |
|---|---|---|---|---|---|---|---|
| 0 | Intro | 0 (overlay) | no | none | none (CSS and SVG) | same, shorter distances | static logo |
| 1 | Hero | 0-100 | no | vertical | mark relief, 4 diamonds, light drift | stacked: text, poster, CTAs | poster + text |
| 2 | Trust band | 100-140 | no | vertical | camera tilt only | counters stacked 2x2 | static numbers |
| 3 | Services | 140-440 (300 vh for 5 worlds) | yes | horizontal | backdrop plane with subtle depth, mark morphs to icons (SVG) | native scroll-snap row | vertical bento |
| 4 | Three restoration levels | 440-640 (200 vh) | yes | vertical scrub | molar turntable, CIP shader | 3-step tap control, static molar poster per step | SVG morph stepper |
| 5 | Digital workflow | 640-940 (300 vh) | yes | diagonal | point cloud to wireframe to solid to lit; photo billboards | vertical steps with diamond markers | vertical steps |
| 6 | Before and after | 940-1040 | no | vertical | displacement wipe (tiers 2-3) | DOM clip-path slider | DOM slider |
| 7 | Dentists | 1040-1140 | no | vertical | depth parallax on cards (fine pointer) | snap carousel | static cards |
| 8 | Patient voices | 1140-1240 | no | vertical | soft 3D carousel (tiers 2-3) | simple cards | simple cards |
| 9 | First visit and FAQ | 1240-1360 | no | vertical | world light turns warm | same | same, no light change |
| 10 | Booking | 1360-1460 | no | vertical | mark idles beside the form | same | same |
| 11 | Footer playground | 1460-1560 | no | vertical | logo parts drop and can be thrown (3D at tier 3, DOM at 1-2) | DOM physics, touch | static footer |

Total about 15.6 viewport heights on desktop. Three direction changes:
vertical to horizontal (scene 3), horizontal back to a vertical scrub
(scene 4), vertical to diagonal (scene 5).

## Scene 0: Intro

- Question it answers: can a memorable brand reveal cost nothing in LCP?
- 0%: overlay in the surface color, mark outline at center, hero already
  painted beneath (poster image is the LCP element).
- 50%: four diamonds have flown in and settled; the bar is drawing right to
  left as the real loading line (minimum 400 ms, maximum 1300 ms).
- 100%: mark strokes snapped, «سفید» filled, the mark scaled up as a
  clip-path revealing the hero; overlay removed; hero text settles.
- Phones: identical, distances 12 px, same timings.
- T0: no overlay; static logo in the header.
- Assets: inline SVG of the mark and wordmark (under 9 KB), CSS keyframes,
  under 2 KB inline JS. Cost: zero WebGL, zero layout shift.
- Prototype: `design/prototypes/0a-intro.html`.

## Scene 1: Hero (0-100 vh)

- Job: promise and first action. H1 «اولین کلینیک دندانپزشکی دیجیتال جنوب
  تهران», subtext with «مشاورهٔ اول رایگان», «رزرو نوبت» and «تماس با کلینیک».
- Camera: front, slight low angle. Mark relief floats at the end side
  behind the photo mask; the diamonds drift on a slow 12 s loop; key light
  cool (dawn) at this point.
- 0%: text settled, mark at rest. 50%: pointer parallax only. 100% (leaving):
  the masked photo eases into a smaller framed card as the trust band
  rises; mark drifts up and shrinks to become the scene 3 protagonist.
- Phones: text, then poster (4:5), then CTAs; no parallax; the mark relief
  sits faint behind the poster corner.
- T0: poster image with the clip-path mask in CSS, no motion.
- Assets: mark.glb (Draco, target under 60 KB), diamond.glb (under 10 KB),
  environment from RoomEnvironment (no HDR file), hero poster AVIF under
  200 KB. Cost: about 30k triangles, one shadow map at tiers 2-3.

## Scene 2: Trust band (100-140 vh)

- Job: credibility in three seconds. Up to four verified facts; while the
  client confirms numbers, show only the two that are safe (free first
  consultation, same-day emergency when possible).
- 0%: band enters from below. 50%: counters count up once (DOM). 100%: the
  camera tilts 3 degrees to introduce depth before the horizontal turn.
- Phones: 2x2 facts, no counters animation beyond a fade.
- T0: static facts.
- Assets: none new. Cost: none.

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

- Job: convert. The one-field form on a warm stage; the mark idles beside
  it (slow breathing, no distraction); static map and hours next to it on
  desktop, below it on phones.
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
| hero poster | AVIF | 200 KB | 200 KB | 160 KB |
| workflow stills (phones) | AVIF x4 | 320 KB | 320 KB | 240 KB |
| three.js plus scenes | JS gz | about 220 KB | 220 KB | 160 KB |
| GSAP plus engine | JS gz | about 60 KB | 60 KB | 60 KB |
| Total after first paint | | under 1.4 MB | under 1.1 MB | under 0.5 MB |

These sit inside the experience budgets (2.5 MB, 1.2 MB, 0.5 MB) with room
for photography.

## Open points for the client at this gate

1. Hero direction A or B (see `design/hero-directions/`).
2. Approval of the traced logo and of the 3D interpretation of the mark.
3. Which prototype feels closest to the reference sites, which does not.
