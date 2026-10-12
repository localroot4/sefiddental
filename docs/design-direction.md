# Design Direction

Design read: Persuade-mode marketing site for a premium, calm dental clinic in
south Tehran, with healthcare trust-first constraints. Language: calm, warm,
modern. Motion: cinematic WebGL journey on the home page (see
`docs/experience-direction.md`), calm elsewhere. Persian RTL first. Article
pages are Read mode. The admin panel is Operate mode and follows Payload
conventions.

Dials (1-10): DESIGN_VARIANCE 7, MOTION_INTENSITY 9 on home and 5 on content
pages, VISUAL_DENSITY 3 (articles 4).

Phase 2 turned this direction into `docs/design/DESIGN.md` (measured
contrast, final tokens in `design/tokens.css`, component specs). Where the
two differ, `DESIGN.md` wins; this file keeps the reasoning.

## 1. Color

Tokens are CSS custom properties on `:root`. Dark values live under
`:root[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` for
`:root:not([data-theme="light"])`. Tailwind v4 consumes them through `@theme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-brand` | `#00827A` | `#2BB5AA` | primary actions, links, active states, focus ring |
| `--color-brand-strong` | `#00655F` | `#00827A` | hover and pressed, small text on light surfaces |
| `--color-brand-soft` | `#E3F2F0` | `#0F3B3A` | tinted surfaces behind brand elements, chips |
| `--color-ink` | `#0A243F` | `#EAF1F4` | headings and body text |
| `--color-ink-muted` | `#4A5C70` | `#A9B8C6` | secondary text, must stay >= 4.5:1 on surface |
| `--color-surface` | `#F7F8F7` | `#071A2B` | page background, never pure white or black |
| `--color-surface-raised` | `#FFFFFF` | `#0D2A45` | cards, sheets, navigation |
| `--color-surface-sunken` | `#EEF2F1` | `#051522` | section bands |
| `--color-line` | `#D9E0E0` | `#1E3A52` | hairlines and borders |
| `--color-warm` | `#E8AF76` | `#E8AF76` | warm highlight: diamond motifs, selected tier, illustration accents. At most one warm element per viewport |
| `--color-success` | text `#2F7A3C`, fill `#77BA6B` | text `#9BD28F`, fill `#3E8E4B` | success and confirmation only |
| `--color-danger` | `#DA2031` | `#FF6B6B` | errors and destructive actions only |
| `--color-warning` | `#C9661F` | `#F0A05A` | warnings, emergency badge |
| `--color-info` | text `#1F7FA8`, fill `#59C1EF` | text `#8FD6F7`, fill `#2A8FBD` | informational notes |

Rules:

- One accent across the whole page: brand teal. Peach is a highlight, not a
  second accent.
- Yellow `#FFE95A`, burgundy `#8A2A38`, sky `#59C1EF`, orange `#E07F38` and
  green `#77BA6B` are category accents for service icons and illustrations
  inside the services hub only. They never color buttons, links or text.
- Red only for errors and danger. Green only for success.
- Contrast: teal on the light surface is about 4.5:1. Use `--color-brand-strong`
  for text under 16 px. Verify every pair with a script in phase 2 and record
  the table in `docs/design/DESIGN.md`.
- Gradients: none in UI chrome. A soft two-stop teal gradient is allowed only
  inside the intro mark and the hero mask edge.

## 2. Typography

- Display: Estedad (variable, OFL). Body and UI: Vazirmatn (variable, OFL).
  Self-hosted woff2, Persian plus Latin subsets, `font-display: swap`, preloaded.
- Persian digits in Persian text. Format numbers with `fa-IR` and the Persian
  thousands separator «٬». Phone numbers are LTR islands with `dir="ltr"` and
  grouped digits; `href` uses the international form `tel:+98...`.
- Never letter-space Persian. Never justify long text. No fake bold. No italic
  for Persian; emphasize with weight or color. Negative tracking is banned.

Fluid scale:

| Role | Size | Line height | Weight |
|---|---|---|---|
| display-1 | `clamp(2.25rem, 1.4rem + 3.6vw, 4.5rem)` | 1.15 | 700 |
| display-2 | `clamp(1.75rem, 1.2rem + 2.2vw, 3rem)` | 1.2 | 700 |
| heading | `clamp(1.375rem, 1.1rem + 1.1vw, 1.875rem)` | 1.3 | 600 |
| body-lg | `1.125rem` | 1.9 | 400 |
| body | `1rem` | 1.85 | 400 |
| small | `0.875rem` | 1.7 | 400 or 500 |
| caption | `0.8125rem` | 1.6 | 500 |

Measure: `max-inline-size: 62ch` for running text. Headlines max 2 lines on
desktop, 3 on phones. Hero subtext max 20 words.

## 3. Spacing, radius, elevation

- Base 4 px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Section padding `clamp(4rem, 6vw + 1rem, 8rem)`. Content container 1280 px,
  full-bleed media 1440 px. Gutters 16 (phone), 24 (tablet), 32 (desktop).
- Radius system, applied everywhere without exception: buttons and chips pill
  (999 px), inputs 12 px, cards 20 px, media 24 px, modals and sheets 28 px,
  badges 8 px.
- Elevation: tinted navy shadows only. Raised: `0 1px 2px rgb(10 36 63 / .06),
  0 8px 24px rgb(10 36 63 / .08)`. Floating (sticky bar, modal): `0 12px 40px
  rgb(10 36 63 / .18)`. Dark theme uses borders and lighter surfaces instead of
  strong shadows.
- Cards only when elevation communicates hierarchy. Prefer spacing, hairlines
  and bands. Never cards inside cards.

## 4. Iconography and imagery

- Icons: Phosphor Icons through `blade-phosphor-icons`. Regular weight for UI,
  duotone for the six service categories. One icon family in the whole site.
- RTL mirroring: mirror arrows and chevrons with `rtl:-scale-x-100`. Never
  mirror phones, clocks, checkmarks, play buttons or logos.
- Photography: real clinic photos only. Warm, soft grading. Faces look toward
  the content or the CTA. Aspect ratios: hero 4:5 on phones and 3:2 on
  desktop, cards 4:3, dentist portraits 4:5, before/after pairs 1:1. Every
  image has a Persian `alt`. AVIF and WebP with `srcset` and `sizes`, blur
  placeholders generated at upload, `fetchpriority="high"` for the LCP image.
- AI-generated people, stock smiles and clip-art teeth are banned.

## 5. Brand motifs

Reuse the logo's own geometry so the site feels designed by the same hand:

- The teal mark (toothpaste on a toothbrush head, per the client): hero
  image mask, loading indicator, favicon, bullet in brand-soft, section
  ornament at low opacity. In copy and code call it "the mark"; never draw a
  literal brush or paste next to it.
- The square diamond dots: particles in the intro, markers for steps, active
  state in pagination.
- The long horizontal bar of the wordmark (the brush handle): progress line
  in the intro, active nav underline, section divider.

## 6. Layout families

Use at least five different families on the home page. No family appears more
than twice on one page. Max two consecutive image-plus-text splits.

| Code | Family | Where |
|---|---|---|
| A | Asymmetric split hero, text start, masked image end; stacked on phones | home, service pages |
| B | Fact row: 3-6 short verified facts in one quiet row (trust band on home, facts on services, insurers on pricing) | home, service, dentist, pricing, about |
| C | Grid or bento with exactly as many cells as items (home and hub: 5 cells, 3 categories plus orthodontics and pediatric dentistry) | home, hubs, related items, financing |
| D | Pinned morph section (SVG tooth morphing through the 3 restoration tiers), stepper on phones | home, restoration page |
| E | Compare slider for before/after | home, gallery, service pages |
| F | Horizontal snap carousel on phones, 3-up grid on desktop | dentists |
| G | Patient journey: pinned horizontal pan on desktop, vertical steps on phones (home only). G-static: vertical steps with diamond markers, no pinning | home (G); service pages and about (G-static) |
| H | Video testimonial cards with poster frames and consent note | home, about, service pages |
| I | FAQ accordion with a sticky aside (call, WhatsApp, book) | service pages, pricing |
| J | Inline booking block with static map and hours. J-form: the same block without the map | most templates (J); address page (J-form) |

Two more families are defined in `docs/ia.md` section 6: K (reading
column) and L (focused task). Section order for every template lives in
`docs/ia.md`; home is A, B, C, D, E, F, G (first-visit journey), H, I (FAQ),
J, footer.
Hero stack: at most four text elements: optional short label, headline,
subtext, two CTAs («رزرو نوبت» primary, secondary per `docs/conversion.md`
section 3).
Navigation: desktop one line, max 72 px high: خدمات (mega menu), پزشکان,
قبل و بعد, هزینه و پرداخت, تماس, then theme toggle, phone and «رزرو نوبت».
Phones: logo, call icon, menu button, full-screen drawer with grouped
services and 48 px rows, and a bottom sticky bar: تماس | واتساپ | رزرو نوبت.
The bar stays visible and hides only when the booking block or footer
contact is in view, a field has focus, or a modal is open (rules in
`docs/conversion.md` section 4). It respects safe-area insets.

## 7. Components and states

Every component ships with default, hover, focus-visible, active, disabled,
loading, empty and error states where applicable, in both themes.

Button (primary, secondary, ghost, danger; sizes 44 and 52 px; start or end
icon mirrored in RTL; loading spinner replaces the icon, label stays).
Link with grow-from-start underline. Navigation (desktop, mega menu, phone
drawer). Sticky bottom bar. Theme toggle (icon morph). Service card. Category
tile. Tier comparison (three columns on desktop, swipeable cards on phones,
selected tier in warm highlight). Dentist card. Before/after compare slider
(pointer, touch and keyboard, labels «قبل» و «بعد»). Video testimonial card.
Stat. FAQ item. Booking form. Emergency form. Alert and toast. Breadcrumb.
Pagination. Article parts: table of contents, callout, sources list, author
box, reviewer box, updated date, reading time. Map block. Footer. Skeletons.
Empty states. 404 and error pages.

Booking form and emergency form: fields, microcopy, states, abuse rules and
page order are specified in `docs/conversion.md` sections 5 and 7. Visual
rules here: chips are native radios styled as pills, 44 px tall; the check
icon on success draws with a stroke animation (static under reduced motion);
the emergency safety box uses the warning token and an icon, never red.

## 8. Motion system

The home experience (scenes, quality tiers, loading, interaction rules,
verification) is specified in `docs/experience-direction.md` and overrides
this section where they differ. The rules below apply to content pages and
to UI components everywhere.

Tokens: `--dur-1: 120ms` (micro), `--dur-2: 200ms` (UI), `--dur-3: 320ms`
(reveals), `--dur-4: 600ms` (choreography), `--dur-5: 900-1400ms` (intro).
`--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out:
cubic-bezier(0.65, 0, 0.35, 1)`; GSAP `expo.out` for settles and
`back.out(1.2)` only on the intro diamonds.

Principles:

- Motivated only: hierarchy, storytelling, feedback or state change.
- Animate `transform` and `opacity` only in the DOM. No scroll event
  listeners; use GSAP ScrollTrigger, IntersectionObserver or CSS scroll-
  driven animations. Lenis smooths scroll on desktop only.
- `prefers-reduced-motion: reduce` collapses everything to instant states
  and the tier 0 experience.
- Phones: shorter distances (12 px), fewer staggers, no pinned sections
  under 1024 px, no parallax, no pointer effects.
- Nothing loops forever except loading indicators.
- Content pages never load three.js; the restoration page may lazy-load the
  molar scene behind an intersection trigger at tiers 2 and 3.

Intro storyboard (first visit per session, total <= 1400 ms, tap, Esc or
«رد کردن انیمیشن» skips, static under reduced motion):

| Time | What happens |
|---|---|
| 0 ms | Overlay in the surface color covers the viewport. Hero markup and the preloaded hero poster render beneath it, so LCP is not delayed. The teal mark outline sits at center. |
| 0-500 ms | The four diamond dots fly in from the viewport edges and settle with a soft overshoot. The long bar draws from right to left as the real loading progress (page, then experience assets), minimum 400 ms. |
| 500-900 ms | The two strokes of the teal mark snap together. The letters of «سفید» fill through a mask. |
| 900-1300 ms | The teal mark scales up as a clip-path mask and reveals the hero beneath. Hero text settles in from 16 px offsets with a 60 ms stagger. The WebGL world, if ready, fades in behind the hero; otherwise the poster stays until it is. |
| 1400 ms | Overlay removed from the DOM, focus and scroll restored. |

Micro-interactions: button press `scale(.98)`, card hover 2 px lift, input
focus ring grows, FAQ chevron rotates, nav active bar slides with Flip,
theme toggle icon morphs, booking success check draws itself.

Page transitions: the mark morphs between routes with the View Transitions
API where supported; otherwise a 200 ms cross-fade.

## 9. Accessibility and RTL rules

- WCAG 2.2 AA. Skip link. Landmarks. One H1. Focus-visible ring in brand with
  2 px offset. 44x44 CSS px targets. Labels above inputs, help text in markup,
  errors below inputs, `aria-live="polite"` for booking status.
- Accordions, dialogs and menus use the native `<details>`, `<dialog>` and
  disclosure patterns with correct ARIA only where semantics are missing.
- `dir="rtl"` on `<html>`, `lang="fa"`. Logical properties only
  (`margin-inline-start`, `padding-inline`, `inset-inline-end`). LTR islands:
  `<bdi>` or `dir="ltr"` with `unicode-bidi: isolate` for Latin, phone
  numbers, URLs and codes.
- Persian punctuation: «،» «؛» «؟» «:» and «گیومه». ZWNJ in می‌شود, کلینیک‌ها and
  similar. Persian ی and ک, never Arabic ي and ك.

## 10. Banned patterns

Purple or mesh gradients. Three equal feature cards. Cards inside cards.
Decorative status dots. Small uppercase labels above every heading (max one
per three sections). Centered everything. Stock smiles and AI people. Fake
precise numbers. Emoji in the UI. Em dashes in copy. Scroll cues. Custom
cursors. Infinite marquees. Glassmorphism, except a light scrim behind the
navigation. Spinners where a skeleton fits. 3D for show. Anything that moves
without a reason.
