# Experience Direction

Binding for phases 2, 7 and 8. Supersedes the motion section of
`docs/design-direction.md`. The client's new brief (2026-10-11): a cinematic,
scroll-driven experience in the spirit of Immersive Garden
(immersive-g.com) and hidokmeh.com, built on Next.js and WebGL 2, with
game-style quality tiers so weak devices drop effects but keep 60 fps, and
a site people keep scrolling for the pleasure of it. Built from the clinic's
own logo and the tooth, never copied from the references.

## 1. What we take from the references (patterns, not pixels)

| Pattern seen in Immersive Garden-class work | Our translation |
|---|---|
| A single continuous world; the camera travels through scenes as you scroll | One 3D world around the teal tooth mark; scroll moves the camera and the light |
| Scroll scrubs everything: text, 3D, image sequences, in sync | GSAP ScrollTrigger timeline as the master clock; the WebGL scene reads the same progress |
| Direction changes: vertical, then horizontal, then diagonal | Three direction changes on home, each tied to a story beat |
| Big typography as a visual object, split and animated | Estedad display type in Persian, letters as masks and layers (never letter-spaced) |
| Objects react to the pointer and to scroll velocity | Mark, diamonds and particles react to scroll speed; parallax to the pointer on desktop |
| Materials that look real: refraction, soft shadows, grain | Enamel-like translucent material on the tooth; glass-like teal mark; film grain only in WebGL, never on DOM |
| Playful physics somewhere unexpected | The footer playground: logo parts drop in, can be dragged and thrown, and settle |
| Everything is still tidy, fast and legible | Content pages stay light; the home experience has budgets and tiers |

Measured facts about immersive-g.com and the review of ThreeUI are in
`docs/discovery/reference-inspection.md` and `docs/discovery/threeui-review.md`.
Two findings change the plan:

- Immersive Garden's home is a single-material "plaster relief" world:
  white bas-relief sculptures drifting over a light gray plane, one card and
  one caption per viewport, tiny UI chrome. Our translation is a **porcelain
  relief world**: the tooth mark, the diamonds and natural forms as white
  porcelain reliefs in a warm off-white space (light theme) or navy with
  teal glass (dark theme). Phase 2 prototypes this material first.
- Their loading model (16.7 MB, a counter preloader, no fallback, virtual
  scroll with hidden body overflow, disabled zoom, sound) is exactly what
  this brief forbids. The budgets and tiers below stand.

- Dokmeh Agency (hidokmeh.com), an award-winning Tehran studio, proves the
  opposite loading model works: usable at once, native scroll smoothed by
  Lenis, light WebGL, phones at a tenth of the desktop bytes, and a real
  Persian version with a Persian display font. Its pinned "monument" scene
  (a pinned 3D object with text sliding over it, as our scene 4 pins the
  molar), its persistent accent pill, and its fanned depth cards are
  patterns we adopt. Its 64 MB desktop intro video and ghosted outline words
  are not. Its sliding counters are not either: our trust facts are static
  text on the hero's bottom edge (scene 2).

Taste calibration moved from the phase 2 gate to the phase 7 hand-off and
the phase 8 real-device checklist, where the client judges the real scenes
against both reference sites (brief decision 20). Gap 33 (the client's phone
recordings of both reference sites) stays open but optional.

## 2. The concept: «سفر یک لبخند»

Home is one scroll journey through the story of a treatment, told around
the logo. The teal tooth mark is the protagonist; the diamond dots and the
long bar are its companions; the navy world turns warm as the story ends.
Every scene also has a job (orient, prove, reassure, convert), so the
spectacle serves conversion, not the other way round.

| # | Scene | Direction | Story beat and job | Mechanics | Fallback (tier 0, reduced motion) |
|---|---|---|---|---|---|
| 0 | Intro | none | The mark assembles from scattered diamonds; the bar is the loading line | Inline CSS plus tiny JS; the mark opens as a mask onto the hero B composition; the WebGL world mounts beneath after `load` and renders no frames while the hero photo covers the viewport | Static logo, no overlay |
| 1 | Hero «اولین کلینیک دندانپزشکی دیجیتال جنوب تهران» (direction B) | vertical | Promise and first action | Full-bleed real photo (the LCP element from 744 px; on phones a scrim text element is, the H1 or the subtext) with the headline on a scrim and the floating booking card; text and card settle once; no WebGL frames while the photo covers the world; on exit the photo scrolls away and uncovers the porcelain world | Same photo, scrim, card and facts, no motion |
| 2 | Trust band and hero exit | vertical | Credibility | Static facts on the hero's bottom edge, in the first screen from 744 px (on phones, on the photo band after the card); the band leaves with the hero; the camera tilts slightly | Static facts |
| 3 | Services «چه کاری می‌توانیم بکنیم» | vertical to **horizontal** | Orientation | Pinned section; five service worlds slide horizontally; the mark morphs into each category icon as it passes; cards are DOM, the backdrop is WebGL | Vertical bento, no pin |
| 4 | Three restoration levels | horizontal continues, then unpins | Signature differentiator | A 3D molar on a turntable; scrolling advances معمولی, VIP, CIP; color characterization layers appear as a shader on CIP; tier CTA follows | SVG morph stepper (phase 2 prototype) |
| 5 | Digital workflow «از اسکن تا لبخند» | **diagonal** | Reassurance: the method | Camera flies along a diagonal path: scan (point cloud forms the tooth), design (wireframe to solid), make (the tooth gets its enamel), smile (warm light); real photos as billboards | Vertical steps with images |
| 6 | Before and after | vertical | Proof | Compare slider with a WebGL displacement wipe on desktop; DOM clip-path on phones | DOM clip-path slider |
| 7 | Dentists | vertical | Authority, faces | Portrait cards with depth parallax; hover tilt on desktop | Static cards |
| 8 | Patient voices | vertical | Social proof | Video posters in a soft 3D carousel; play opens a native player | Simple cards |
| 9 | First visit and FAQ | vertical | Remove fear, answer objections | Calm section; the world turns warm (peach light); FAQ accordion | Same, no light change |
| 10 | Booking | vertical | Convert | The form rises on a warm stage; the mark sits beside it, idle and friendly | Same form |
| 11 | Footer playground | vertical | Delight, memory | The logo parts fall from the header line into the footer, bounce, settle; drag and throw them; they drift back after a few seconds | Static footer with the logo |

Rules:

- Scroll is never hijacked. Native scroll position always maps to one point
  on the timeline; the user can scroll back at any speed and nothing breaks.
  Lenis only smooths; it never takes over the wheel on touch devices.
- Pinned sections exist only on desktop and tablet landscape (>= 1024 px).
  On phones every scene is vertical and the horizontal scene becomes a
  swipeable row; the diagonal scene becomes a stepped vertical sequence with
  the same visuals at lower cost.
- Text is real DOM text, server-rendered, always readable without WebGL.
- Each scene has exactly one job and one primary CTA at most (in the hero,
  the card's «ثبت درخواست»; «تماس با کلینیک» is secondary).
- Nothing autoplays sound. No cursor replacement. No infinite loaders.

## 3. Quality tiers (the game settings)

Detected on first visit with `detect-gpu` (GPU benchmark tier), screen size,
device memory, `prefers-reduced-motion`, data saver and battery hints. Then
corrected live by a frame-time monitor: if the average frame drops under
55 fps for 2 seconds, the tier steps down; it never steps up during the
same visit except after an idle period. The user can override in a small
«کیفیت» control in the footer (saved locally).

| Tier | Typical device | Resolution scale (DPR cap) | Post-processing | Particles | Shadows | 3D scenes | Horizontal pin |
|---|---|---|---|---|---|---|---|
| 3 | Desktop with a discrete GPU, recent iPhone or flagship Android | 2.0 | bloom, grain, depth of field (light) | 100% | soft | all | yes |
| 2 | Average laptop, mid Android (2022+) | 1.5 | grain only | 50% | hard | all | yes (>= 1024 px) |
| 1 | Old laptop, low-end Android | 1.0 | none | 20% | none | the world at the hero exit and the molar only; others become image sequences or stills | no |
| 0 | No WebGL 2, reduced motion, data saver, or sustained drops at tier 1 | none | none | none | none | none: posters, SVG and CSS only | no |

Targets: 60 fps at tiers 3 and 2; never under 50 fps at tier 1; tier 0 has
no WebGL at all. Memory: the GPU budget is 256 MB at tier 3, 128 MB at
tier 2, 64 MB at tier 1; textures are KTX2 (Basis) compressed, models are
glTF with Draco, no texture over 2048 px.

## 4. Loading strategy and budgets

The first paint never waits for WebGL.

| Page class | What loads first | Initial JS | WebGL assets | LCP | INP |
|---|---|---|---|---|---|
| Home (experience) | server HTML, CSS, fonts, the hero photo (the LCP from 744 px; on phones a scrim text element, the H1 or the subtext, is the LCP and the photo band starts below the first screen and loads without priority), intro | <= 180 KB gzipped (React, GSAP core, Lenis, the scroll engine) | three.js and scenes after `load`, by scene order, behind the intro bar; total <= 2.5 MB at tier 3, <= 1.2 MB at tier 2, <= 500 KB at tier 1 | <= 2.5 s on 4G | <= 200 ms |
| Content pages (services, dentists, pricing, articles, guides, address) | server HTML, CSS, fonts, images | <= 90 KB gzipped; no three.js | none, except one optional lazy canvas on the restoration page | <= 2.5 s | <= 200 ms |
| Booking and emergency | server HTML, CSS, fonts | <= 70 KB gzipped | none | <= 2.0 s | <= 200 ms |

Fonts <= 120 KB total. CSS <= 50 KB gzipped. CLS <= 0.05 everywhere. The
canvas is `position: fixed` behind the content, so loading it never shifts
layout. While the hero photo covers the viewport, the canvas renders no
frames. Lighthouse mobile: Performance >= 90 on home at tier 1 settings,
>= 95 on every content page; Accessibility, Best Practices and SEO 100.

Phase 3 measurement: the Next.js 16.4 and React 19.3 framework floor is
131.8 KiB gzipped, above the content and booking targets. CI gates interim
initial-JS limits (home 215 KiB, content 150 KiB, booking and emergency
150 KiB) and every report shows the targets in the table next to the
measured values. Lighthouse audits content pages on a 200 render of the 404
template (`/qa/not-found`). Details: `docs/brief.md` section 7.

## 5. Interaction rules

- Pointer parallax and hover tilt only on fine pointers; touch devices get
  scroll-driven motion only.
- Scroll velocity drives secondary motion (particles, grain intensity, the
  mark's wobble), clamped so fast scrolling never looks broken.
- The footer playground: GSAP Draggable with InertiaPlugin for drag and
  throw; simple bounds and a floor; collisions between parts are optional
  (tier 3 only); parts return home after 6 seconds of inactivity; keyboard
  users get a «پخش دوباره» button instead; touch targets stay 44 px.
- Page transitions: the mark morphs between routes with the View Transitions
  API where available; content pages otherwise cross-fade in 200 ms.
- Reduced motion collapses everything to the tier 0 experience, including
  the intro and the playground.

## 6. Brand assets in 3D

- The teal mark (toothpaste on a brush head) as a smooth 3D solid with a
  glass-like teal material; the diamonds as small navy gems that catch
  light; the bar (the brush handle) as a porcelain rod and, in 2D, a glowing
  teal line used for loading and scene transitions. Scene 5 may show the
  paste squeezing onto the brush as the "care" beat; keep it abstract, never
  cartoon.
- One molar model, used in scenes 4 and 5. Default: the stylized in-house
  `design/brand/3d/molar.glb` from phase 2 (free, built; brief decision 22).
  Enamel material with subsurface-like translucency. A realistic licensed
  model may replace it without changing the scene contract, only if the
  client picks it from side-by-side renders in phase 8 (gap 34). Sourcing
  and license rules are in brief decision 22.
- Porcelain relief material for the world: matte white with soft shadows
  and a fine grain, derived from the Immersive Garden observation; the
  materials and particle ideas listed in `docs/discovery/threeui-review.md`
  section 3 are the first candidates to port.
- Lighting: a warm key light that drifts from cool to warm across the
  journey; the navy world background in dark theme, the off-white surface
  in light theme; the scene reads correctly in both themes.

## 7. Accessibility and SEO contract for the experience

- Every scene's text and links exist in the server HTML in reading order.
  Screen readers and Googlebot get a complete page without any canvas.
- The canvas has `aria-hidden="true"`; decorative only.
- Pinned sections keep keyboard focus order sane: focusable elements inside
  a pinned scene are reachable and scrolled into view.
- A visible «رد کردن انیمیشن» link in the intro and the «کیفیت» control
  give the user control.
- Heading structure, breadcrumbs and schema are identical to a plain page.

## 8. Verification (phases 7, 8 and 9)

- Frame times measured in Chromium with 4x and 6x CPU throttling and with a
  software GPU (SwiftShader) to emulate tiers 1 and 0; results in the report.
- Real devices when the client can test: one mid Android, one iPhone, one
  old laptop; a short checklist in Persian. It also asks which scene feels
  closest to immersive-g.com and hidokmeh.com, and which does not (brief
  decision 20).
- Scroll back and forth at high speed, resize mid-scroll, rotate the phone,
  switch theme mid-scene, toggle reduced motion mid-scene: nothing breaks.
- Memory profile over a full scroll: no growth after scenes unload.
