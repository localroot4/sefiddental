# Phase 02 - Brand, Design System and Experience Storyboard

Date: 2026-10-12. Versions used: recorded in section "Delivered".

## Plan (written before building)

Order:

1. Foundations: download and subset Vazirmatn and Estedad (Persian plus
   Latin), write `design/tokens.css` for both themes, compute every
   text-on-surface contrast pair with a script and adjust failing values.
2. Vendor three.js and GSAP minified builds into `design/vendor/` so every
   prototype runs from a plain file without a CDN (banned) and without the
   application that does not exist yet.
3. Brand: copy the traced SVGs, build the favicon set and the OG template,
   export the mark and the diamond as glTF (Draco) and model a stylized
   molar; turntable preview page.
4. Styleguide: one self-contained RTL page, both themes, every component
   with every state, checked at 320, 390, 820 and 1440 px.
5. Storyboard: eleven scenes with wireframe frames, scroll ranges, the
   three states, phone and tier 0 variants, asset lists and cost estimates.
6. Prototypes 0 and a-f, each answering one written question, each measured
   (duration, CLS, fps at 4x and 6x CPU throttle, SwiftShader).
7. Hero directions A and B at three widths and two themes.
8. One batched inspection of all screenshots, one batch of fixes, one
   confirmation, stop. Independent review of the design system and the
   prototypes by a separate agent.
9. Report, gaps, commit, push.

Risks: fonts or three.js downloads blocked by the network (fallback: ask
the client for the files); software GPU in this environment makes fps
numbers conservative (report them as lower bounds); the molar is stylized;
a licensed realistic model replaces it only if the client picks it in
phase 8 (brief decision 22).

## Delivered

Versions: three.js r186 (0.186.1), GSAP 3.15.0 with ScrollTrigger, MorphSVG,
Draggable, InertiaPlugin, Flip and Observer (all free since 3.13), Draco
decoder from gltf-transform 4, Vazirmatn 33.003, Estedad 7.3, Chromium
(Playwright) for every check.

- `docs/design/DESIGN.md`: tokens for both themes with the measured
  contrast table (25 pairs), typography and font loading, spacing, radius,
  elevation, iconography and imagery, brand assets, layout families A to L,
  component inventory with states, RTL rules, motion tokens, the 3D look,
  banned patterns, the Tailwind v4 `@theme` mapping for phase 3.
- `design/tokens.css` (light on `:root`, dark by `data-theme` and by system
  preference), `design/tools/contrast.py` (proves every pair, exits 1 on a
  failure).
- `design/fonts/`: `Vazirmatn[wght].woff2` 59.3 KB (400 to 700),
  `Estedad-Bold.woff2` 32.3 KB (Persian only), `fonts.css`, both OFL files.
  Total 91.7 KB.
- `design/brand/`: the traced logo cleaned into five SVGs (horizontal, lockup
  without Latin, mark, wordmark, Latin), favicon set (SVG with media query,
  32, 192, 512, Apple touch), `og-template.svg` with title and description
  slots and `og-preview.png`. `design/brand/3d/`: `mark.glb` 9.2 KB,
  `diamond.glb` 5.1 KB, `molar.glb` 16.7 KB (Draco), the builder
  `build-brand-geometry.js`, a README with provenance and the rebuild
  steps; `design/tools/export-brand-glb.html` exports the raw glTF.
- `design/styleguide.html`: self-contained RTL page, both themes, every
  component and state listed in the prompt; `design/NOTES-styleguide.md`.
- `docs/experience/storyboard.md` with 24 wireframe frames in
  `docs/experience/frames/` (generator `design/tools/frames.html`), scroll
  ranges, three states per scene, phone and tier 0 versions, asset list,
  cost estimates and now the prototype measurements.
- `design/prototypes/`: 00 porcelain world, 0a intro, 0b services
  horizontal, 0c workflow diagonal, 0d molar turntable, 0e footer
  playground, 0f compare wipe, plus `README.md` (serving, parameters, test
  hooks) and `design/NOTES-prototypes.md` (answers, measurements,
  decisions).
- `design/hero-directions/a.html` (masked split: copy on the start side,
  photo clipped by the mark) and `b.html` (full-bleed photo with a floating
  booking card).
- `docs/qa/phase-02/`: 69 screenshots (styleguide, heroes and prototypes at
  390, 820 and 1440 in both themes; tier and state variants) and six
  recordings `rec-0a` to `rec-0f` (.webm, 1024 x 640, 2.3 MB in total).
- `docs/content/gaps.md`: rows 1 and 23 updated, rows 34 and 35 added.

## Decisions and deviations

- Fonts: Vazirmatn instanced to 400 to 700 and Estedad shipped as a static
  700 cut without Latin, because the full variable files were 173 KB; Latin
  inside display text falls back to Vazirmatn 700.
- Logo: traced from the client's PNG in-house (potrace, cleaned by hand);
  the trace waits for the client's approval or the original vector.
- Tokens changed after the contrast script: brand text darkened to
  `#007A72`, brand-strong `#00655F`, ink-faint reserved for non-text, line-
  strong `#7F909E`, warning and danger text darkened; cosmetic category
  accent is rose `#C4606F` instead of the peach that duplicated the warm
  accent.
- `--dur-5` 1250 ms added for the intro with a hard cap at 1400 ms; the
  prompt asked for "under 1400 ms" and the first build landed exactly on it.
- Tier policy sharpened by the measurements: a software renderer
  (SwiftShader, llvmpipe) is tier 0, tier 1 is for weak real GPUs and
  renders at scale 0.75 with no shadows, post-processing or transmission.
  The acceptance line "above 50 fps with SwiftShader at tier 1" is not met
  (8 fps at 1440 x 900) and is replaced by this policy; see "Verification".
- Scroll scenes are DOM-driven on native scroll; WebGL never owns scroll.
  Pinned scenes exist only at 1024 px and above and only at tiers 2 and 3;
  tiers 0 and 1 get the bento grid (prototype 0b proves the switch).
- Phones always get the DOM clip-path compare slider; the WebGL wipe is a
  desktop tier 2 and 3 effect.
- Styleguide: the hero H1 uses a smaller clamp than display-1 (documented
  exception); the mega menu, emergency form, closed-hours sheet and article
  parts are not built yet (phase 3 and 4 components); «خدمات» is a plain
  link until the mega menu exists; `mask-image` was replaced by an inline
  `clipPath` because masks do not load over `file://`.
- Prototypes open over HTTP only in Chromium (module scripts and fonts are
  blocked for `file://`); the README gives the one-line server.
- Two subagent runs stopped on an API session limit mid-build; their partial
  output was checkpointed, then verified page by page and completed here.

## Verification

| What | How | Result |
|---|---|---|
| Contrast, both themes | `python3 design/tools/contrast.py` (25 pairs) and the reviewer's independent script | 0 failing; small text 4.5:1 or better, non-text 3:1 or better |
| Fonts | file sizes, glyph check (digits, ZWNJ, ی/ک, «،» «٬») | 91.7 KB of 120 KB; shaping correct in every screenshot |
| Horizontal overflow | `scrollWidth` vs `clientWidth` at 320, 390, 820, 1440, both themes, styleguide, heroes, 0a, 0b, 0c, 0e | none (0a at 320 fixed in the review round) |
| Console and network | Playwright over HTTP, 7 prototypes, 2 widths | zero errors, zero failed or third-party requests |
| Intro 0a | `window.__intro` and a layout-shift observer | 1250 ms first visit, CLS 0, skip 375 ms, second visit 0 ms, reduced motion under 2 ms |
| 0b desktop | wheel scroll through the pinned scene, 1x / 4x / 6x CPU | 60 / 60 / 56 fps median |
| 0b phone | computed style at 390 | `scroll-snap-type: x mandatory`, no pin spacer |
| 0b tier 1 | radio switch at 1440 | pin removed, bento grid, no overflow; tier 3 restores the pin |
| 0c | same scroll test | 60 / 54 / 50 fps median |
| 0e | same scroll test; tier 0 mid-drop; reduced-motion toggle | 60 / 54 / 48 fps; no tween survives tier 0; the chosen tier returns when reduced motion ends |
| 0d, 00, 0f on the software GPU | `window.__proto.getStats()` per tier | 0d 8 / 5 / 2 fps at tiers 1 / 2 / 3; 00 7 / 4 / 2; 0f 16 / 23 / 24 (960 x 600 canvas) |
| 0d fill-rate | tier 1 at four canvas sizes | 8 fps at 1440 x 900, 21 fps at 480 x 300: fill-bound |
| Automatic tier drop | 00 with `?auto=1` from tier 3 | tier 2 after 4 s, tier 1 after 7 s |
| Tier 0 paths | `?tier=0` and reduced motion on 00, 0d, 0f | canvas hidden, static layer shown, loop stopped, `aria-hidden` released |
| 0f phone | 390 px with touch | DOM slider at every tier |
| Keyboard and focus | reviewer's interaction script | skip link, drawer trap and Esc, chips, sliders, tier controls, replay all reachable with the token focus ring |
| 3D files | gltf-transform inspect, README byte counts | Draco present, sizes match, POSITION and NORMAL only |
| Recordings | `ffprobe` | six files, 2.2 to 8.7 s each, 1024 x 640 |

The acceptance line for prototype (d) on SwiftShader is not met and cannot
be met at full-screen size on a software renderer; the hardware numbers
remain unmeasured because this environment has no GPU. The client's
machines show the real number in the on-page meter. No reading came back at
the gate (2026-10-13); the first real-device numbers come from the phase 8
real-device checklist.

## Budgets

| Metric | Target | Measured |
|---|---|---|
| Fonts | 120 KB | 91.7 KB |
| 3D brand assets (mark, diamond, molar) | 60 + 10 + 120 KB (storyboard) | 9.2 + 5.1 + 16.7 KB |
| Intro duration | under 1400 ms | 1250 ms, cap 1400 |
| Intro CLS | 0 | 0 |
| Pinned DOM scenes, desktop | 60 fps | 60 fps at 1x, 48 to 56 at 6x CPU throttle |
| WebGL tier 1, software GPU | 50 fps (prompt) | 8 fps; policy changed, see above |
| Vendor bundle for prototypes | none (not shipped) | three.js 958 KB uncompressed, prototypes only |

## Screenshots and recordings

`docs/qa/phase-02/`: `styleguide-{390,820,1440}-{light,dark}.png`,
`styleguide-390-drawer-*.png`, `hero-{a,b}-{390,820,1440}-{light,dark}.png`,
`proto-00-*` (tiers and themes), `proto-0a-*` (intro frames, reduced),
`proto-0b-*` (p0, p50, p100, 1023, 1024, tier1), `proto-0c-*`, `proto-0d-*`
(plain, VIP, CIP, tier 0), `proto-0e-*`, `proto-0f-*` (WebGL, DOM, p25),
and `rec-0a-intro.webm` to `rec-0f-compare-wipe.webm`. The WebGL recordings
were made on the software GPU and look choppy; they show the look, not the
motion quality.

## Independent review

A separate reviewer checked DESIGN.md, tokens, styleguide, both heroes, the
seven prototypes and the 3D assets against the acceptance criteria and the
quality bar, with its own scripts (10 pages, 4 widths, 2 themes, keyboard,
tiers, reduced motion). It returned 20 findings, 7 major and 13 minor, and
a clean list for console, overflow, logo placement, contrast, fonts, dark
theme, keyboard, intro, scroll ownership, tiers, tokens and 3D files.

All 20 were fixed in one batch and re-verified:

1. Tier 0 art invisible in the light theme (00, 0d): the poster now uses
   the brand colours and the molar has an outline.
2. Intro could not finish under 1400 ms: fixed budget, 1250 ms, hard cap.
3. `ink-faint` used for 13 px text: moved to ink-muted; token redefined as
   non-text.
4. Hero B had two primary CTAs: the scrim button is secondary now.
5. Footer playground kept animating after tier 0 and lost the chosen tier
   after a reduced-motion change: drop tween tracked and killed, user tier
   kept apart from the effective tier.
6. Targets under 44 px in the styleguide: section index, footer and phone
   links fixed; links inside sentences stay inline.
7. Intro overflow at 320 px: tools row wraps, call icon hidden on phones.
8. DESIGN.md and tokens disagreed on the gutter breakpoint, `brand-glow`
   and `dur-5`, and lacked the `@theme` mapping: aligned and documented.
9. No `fonts.css`: added and linked from the styleguide, heroes and DOM
   prototypes.
10. Compare wipe ran WebGL on phones: DOM slider forced under 1024 px.
11. Services scene had no tier switch: added, tiers 0 and 1 render the
    bento grid without a pin.
12. Tier radio labels 40 px tall: 44 px.
13. Em dash as an on-screen placeholder: replaced.
14. Cosmetic category accent equal to the warm accent: rose.
15. Tier 0 molar hidden from assistive technology: `aria-hidden` toggled.
16. Hero A placeholder label clipped by the mask: centred, shortened.
17. Intro hero H1 column too narrow: 42 rem.
18. «خدمات» button announced a popup that does not exist: plain link.
19. Bloom flattened the relief in the light theme: strength 0.04 and
    threshold 1.6 in light, unchanged in dark (judged on the software GPU
    only).
20. 3D export page missing from the repo: `design/tools/export-brand-glb.html`
    added and the README rebuild steps written.

## Content gaps added or closed

- Row 1: logo trace cleaned into `design/brand/`, awaiting approval.
- Row 23: logo variants built in-house; vertical and white versions follow
  the approval.
- Row 34 (new): approve the 3D interpretation of the mark and the stylized
  molar, or source a licensed anatomical molar (the choice is recorded in
  brief decision 22).
- Row 35 (new): pick hero direction A or B.
- Rows 32 (host Node runtime) and 33 (reference recordings) stay open.

## Risks and open questions

Risks: no hardware GPU numbers yet (the tier policy rests on software
measurements and on `detect-gpu`; no reading came back at the gate, so the
first real-device numbers come from the phase 8 checklist); the molar is
stylized and may read as a cartoon next to real photography (it stays the
default until the client picks from two pictures in phase 8, brief decision
22); the traced logo may differ from the client's original vector in small
curves; the WebGL wipe may not justify its cost on real hardware either.

Risks added at the gate (2026-10-13): hero B depends on one real photo that
does not exist yet (gap 36); the client's first taste reading comes at the
phase 7 hand-off, after the scroll engine is built (brief decision 20);
hosting is still open (gap 32), and the phase 7 hand-off needs a staging
URL.

Questions for the client (five at most):

1. Hero direction A (masked split) or B (full-bleed with the booking card)?
2. Do you approve the logo trace and the 3D mark as a porcelain relief?
3. Which of the six recordings feels closest to the reference sites, and
   which one does not?
4. Stylized molar, or a licensed anatomical model (cost to be checked)?
5. Has the host answered the Node.js ticket (gap 32)?

The answers of 2026-10-13 are in the next section.

## Client answers at the gate (2026-10-13)

The client answered on 2026-10-13. The studio made the knock-on calls the
same day. Brief decisions 19 to 22 record both.

- Question 1, hero: B (`design/hero-directions/b.html`). Direction A
  (`a.html`) stays in the repo as an archived reference only (brief
  decision 19; gap 35 done).
- Mark relief over the hero photo: it stays for phase 4 and is judged over
  the first real photo. It is removed if it covers the focal area or reads
  as a watermark, and by default if no real photo exists by phase 7.
- Phones (< 744 px): the scrim (H1, subtext, «تماس با کلینیک»), then the
  booking card, then a 4:5 photo band with the four trust facts on its
  bottom edge. The H1 is the phone LCP element; the phone crop loads
  without priority.
- From 744 px: the full-bleed landscape photo is the LCP element (one
  preload with a media query, `fetchpriority=high`). The scrim sits at the
  start side, the card at the end side, the trust band on the bottom edge
  (2x2 up to 1023 px, one row of four from 1024 px).
- Home has two instances of the one booking form: the compact hero card
  (phone field plus hidden fields) and the full block in scene 10. Ids are
  prefixed per instance; `booking_submit` carries `location` = `hero` or
  `block`. Every other page keeps one instance.
- CTA routing on home: header and sticky-bar «رزرو نوبت» focus the hero
  phone field while the card is in view, else scroll to the scene 10
  block. Tier steps and FAQ asides scroll to the block with the tier or
  service prefilled. Home stays static or ISR and cacheable; both forms
  fetch their tokens and the hours state from the no-store endpoint.
- The phone sticky bar stays visible while the hero card is in view; it
  hides while any input has focus.
- The scrim keeps one secondary action, «تماس با کلینیک». Its «رزرو نوبت»
  button is removed, so the card's «ثبت درخواست» is the only primary CTA
  in the hero. This goes further than review fix 4, which only made the
  scrim button secondary.
- Hero card success: compact and in place, items 1-4 of
  `docs/conversion.md` 5.4, at a reserved height (no layout shift). The
  full 5.4 content lives in the scene 10 success state and on
  /رزرو-نوبت/ثبت-شد.
- Inner pages keep layout family A with the media in a plain 24 px frame,
  without the tooth-mark mask. One service-page screenshot confirms it at
  the phase 4 review. Full-bleed B is home only.
- Home hero photo: an empty clinic interior in natural light, no faces;
  landscape, at least 4000 px on the long side, plus a 4:5 crop from the
  same shoot. The key detail sits in the central and upper band (gap 36;
  shot list section ۰).
- Question 2, logo trace and 3D mark: no answer. Both are listed again as
  pending with a screenshot and a yes or no, not as new questions. Phase 3
  uses the trace as is; launch needs an explicit yes or the original
  vector (gaps 1 and 34).
- Question 3, recordings: withdrawn. The client watched all recordings and
  screenshots and does not judge drafts that will not appear on the site
  as they are. Taste questions move to the phase 7 hand-off and the phase
  8 real-device checklist, on real pages only. Gap 33 stays open but
  optional (brief decision 20).
- Question 4, molar: the client did not understand the question. It was
  explained in plain Persian on 2026-10-13, with no new question. The
  in-house stylized molar is the default; in phase 8 both molars are
  rendered side by side and the client picks from two pictures. The
  sourcing rules are in brief decision 22.
- Question 5, hosting: the host has not answered the Node.js ticket
  (gap 32). Phase 3 starts host-agnostic (brief decision 21).

## Prerequisites for the next phase

- Question 1 is answered (hero B). Questions 2 and 5 are open on
  2026-10-13; neither blocks phase 3.
- Phase 3 starts host-agnostic (brief decision 21). Every deliverable runs
  on environment-driven configuration (database adapter, media storage,
  base URL). The deploy pipeline (deliverable 9), the staging target and
  the chosen-path steps of `docs/deploy.md` wait until the client confirms
  the path (C1 or C2 on cPanel, else A). If the host has not answered by
  the end of the phase 3 build, the phase 3 hand-off asks the client to
  choose C1 or A. Hosting is settled before phase 7.
- Phase 3 uses the traced logo in `design/brand/` as is. An approved trace
  or the original vector replaces those files (gap 1).
- `design/tokens.css`, `design/fonts/`, `design/brand/` and DESIGN.md are
  the inputs of the Tailwind `@theme` and the Next.js font setup.
- The prototype decisions in `design/NOTES-prototypes.md` (software
  renderer is tier 0, render scale 0.75 at tier 1, DOM-owned scroll, custom
  properties on their consumers, DOM slider on phones) go into the scroll
  and tier engine of phase 7.
