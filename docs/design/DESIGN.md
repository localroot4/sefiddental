# DESIGN.md: Sefid Dental Design System

Binding for every phase from 3 on. Built from `docs/design-direction.md`,
measured in phase 2, and implemented in `design/tokens.css`,
`design/fonts/`, `design/brand/` and `design/styleguide.html`. An engineer
who never saw the brief should build the same site from this file.

Design read: a Persuade-mode site for a premium, calm dental clinic in
south Tehran; healthcare trust-first; Persian RTL first; cinematic WebGL
only on the home journey, calm everywhere else. Dials: DESIGN_VARIANCE 7,
MOTION_INTENSITY 9 on home and 5 on content pages, VISUAL_DENSITY 3
(articles 4). Modes: home, services, dentists, pricing, cases, address and
booking are Persuade; articles and guides are Read; the admin is Operate
and follows Payload conventions.

## 1. Color

Tokens live in `design/tokens.css`. Light values on `:root`, dark values
under `[data-theme="dark"]` and under `prefers-color-scheme: dark` when no
explicit theme is set. Components never use raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-brand` | `#007A72` | `#2BB5AA` | primary actions, links, active states; the UI teal is one step darker than the logo teal so it passes AA on the surface |
| `--color-brand-logo` | `#00827A` | `#00827A` | the logo itself and 3D materials only |
| `--color-brand-strong` | `#00655F` | `#5FD0C6` | hover and pressed, small brand text |
| `--color-brand-soft` | `#ECF6F4` | `#0F3B3A` | tinted surfaces behind brand elements, chips |
| `--color-brand-glow` | `rgb(0 130 122 / 0.18)` | `rgb(43 181 170 / 0.22)` | glow behind the mark in 3D scenes and halos; never a surface |
| `--color-on-brand` | `#FFFFFF` | `#071A2B` | label on primary buttons |
| `--color-ink` | `#0A243F` | `#EAF1F4` | headings and body text |
| `--color-ink-muted` | `#4A5C70` | `#A9B8C6` | secondary text |
| `--color-ink-faint` | `#7B8A9A` | `#7C8FA1` | non-text only: placeholder glyphs, dividers, decorative icons (3:1); never for text, captions use ink-muted |
| `--color-surface` | `#F7F8F7` | `#071A2B` | page background |
| `--color-surface-raised` | `#FFFFFF` | `#0D2A45` | cards, sheets, navigation |
| `--color-surface-sunken` | `#EEF2F1` | `#051522` | section bands |
| `--color-line` | `#D9E0E0` | `#1E3A52` | decorative hairlines |
| `--color-line-strong` | `#7F909E` | `#5A7995` | input borders, icons (3:1) |
| `--color-warm` | `#E8AF76` | `#E8AF76` | warm highlight, at most one element per viewport; label uses `--color-on-warm` `#0A243F` |
| `--color-warm-soft` | `#FBF1E6` | `#2A2419` | warm stage behind the booking and first-visit scenes |
| `--color-success` / `-fill` | `#2F7A3C` / `#77BA6B` | `#9BD28F` / `#77BA6B` | success text / fill (label `--color-on-fill` `#0A243F`) |
| `--color-danger` / `-fill` | `#C81E2E` / `#DA2031` | `#FF8A8A` / `#DA2031` | error text / destructive fill (white label) |
| `--color-warning` / `-fill` | `#A85012` / `#E07F38` | `#F0A05A` / `#E07F38` | warning text / fill, the emergency badge |
| `--color-info` / `-fill` | `#1A6F94` / `#59C1EF` | `#8FD6F7` / `#59C1EF` | informational text / fill |
| `--color-cat-*` | rose, teal, green, sky, yellow | same | the five service categories: icons and illustrations only |
| `--color-focus` | `#007A72` | `#5FD0C6` | focus ring, 2 px ring with a 2 px surface gap |

Rules: one accent for UI (brand teal); peach is a highlight, never a second
accent; category colors never color text, links or buttons; red only for
errors and danger; green only for success. Fills (success, info, warning)
carry navy text in both themes; the danger fill carries white. No gradients
in UI chrome; a two-stop teal gradient may appear inside the intro mark
and the hero mask edge only.

### 1.1 Measured contrast (phase 2, `design/tools/contrast.py`)

| Pair | Role | Light | Dark | Min |
|---|---|---|---|---|
| --color-ink on --color-surface | body text | 14.75 OK | 15.43 OK | 4.5 |
| --color-ink on --color-surface-raised | text on cards | 15.71 OK | 12.82 OK | 4.5 |
| --color-ink on --color-surface-sunken | text on bands | 13.92 OK | 16.17 OK | 4.5 |
| --color-ink-muted on --color-surface | secondary text | 6.45 OK | 8.69 OK | 4.5 |
| --color-ink-muted on --color-surface-raised | secondary on cards | 6.87 OK | 7.22 OK | 4.5 |
| --color-ink-muted on --color-surface-sunken | secondary on bands | 6.09 OK | 9.11 OK | 4.5 |
| --color-ink-faint on --color-surface | non-text: placeholder glyphs and dividers | 3.32 OK | 5.29 OK | 3.0 |
| --color-brand on --color-surface | links and brand text >= 16 px | 4.90 OK | 6.96 OK | 4.5 |
| --color-brand on --color-surface-raised | links on cards | 5.22 OK | 5.78 OK | 4.5 |
| --color-brand-strong on --color-surface | small brand text | 6.52 OK | 9.50 OK | 4.5 |
| --color-brand on --color-brand-soft | brand text on soft chip | 4.73 OK | 4.86 OK | 4.5 |
| --color-ink on --color-brand-soft | ink on soft chip | 14.25 OK | 10.77 OK | 4.5 |
| --color-on-brand on --color-brand | label on primary button | 5.22 OK | 6.96 OK | 4.5 |
| --color-on-warm on --color-warm | label on warm highlight | 8.10 OK | 8.10 OK | 4.5 |
| --color-ink on --color-warm-soft | ink on warm soft | 14.08 OK | 13.47 OK | 4.5 |
| --color-success on --color-surface | success text | 4.97 OK | 10.08 OK | 4.5 |
| --color-danger on --color-surface | error text | 5.36 OK | 7.77 OK | 4.5 |
| --color-warning on --color-surface | warning text | 5.16 OK | 8.29 OK | 4.5 |
| --color-info on --color-surface | info text | 5.27 OK | 11.02 OK | 4.5 |
| #FFFFFF on --color-danger-fill | white on danger fill | 4.96 OK | 4.96 OK | 4.5 |
| --color-on-fill on --color-info-fill | label on info fill | 7.70 OK | 7.70 OK | 4.5 |
| --color-on-fill on --color-success-fill | label on success fill | 6.75 OK | 6.75 OK | 4.5 |
| --color-on-fill on --color-warning-fill | label on warning fill | 5.43 OK | 5.43 OK | 4.5 |
| --color-line-strong on --color-surface | borders and icons (non-text, 3:1) | 3.09 OK | 3.86 OK | 3.0 |
| --color-focus on --color-surface | focus ring (non-text, 3:1) | 4.90 OK | 9.50 OK | 3.0 |

0 failing pairs

The script exits non-zero on any failure and runs in CI from phase 3.

## 2. Typography

| Family | File | Weights | Scripts | Use |
|---|---|---|---|---|
| Vazirmatn | `design/fonts/Vazirmatn[wght].woff2` (59 KB) | variable 400-700 | Persian, Arabic presentation forms, Latin, digits | body, UI, headings |
| Estedad | `design/fonts/Estedad-Bold.woff2` (32 KB) | static 700 | Persian and punctuation only (no Latin letters) | display-1 and display-2 only |

Total 92 KB (budget 120 KB). Load with `font-display: swap`, preload both,
`unicode-range` not needed (both files are already subsets). Latin words
inside display text fall back to Vazirmatn 700 through the stack
`"Estedad", "Vazirmatn", system-ui, sans-serif`. In Next.js use
`next/font/local` with the same files.

Scale (fluid, `clamp()`), from `design/tokens.css`:

| Role | Size | Line height | Family and weight |
|---|---|---|---|
| display-1 | `clamp(2.25rem, 1.4rem + 3.6vw, 4.5rem)` | 1.15 | Estedad 700 |
| display-2 | `clamp(1.75rem, 1.2rem + 2.2vw, 3rem)` | 1.2 | Estedad 700 |
| heading | `clamp(1.375rem, 1.1rem + 1.1vw, 1.875rem)` | 1.3 | Vazirmatn 600 |
| body-lg | 1.125rem | 1.9 | Vazirmatn 400 |
| body | 1rem | 1.85 | Vazirmatn 400 |
| small | 0.875rem | 1.7 | Vazirmatn 400 or 500 |
| caption | 0.8125rem | 1.6 | Vazirmatn 500 |

Exception: the home hero H1 is six words; at display-1 it needs three lines
in a 672 px column, so the hero uses `clamp(2.25rem, 1rem + 3vw, 3.75rem)`
(60 px at 1440). Every other headline uses the scale above.

Rules: Persian digits in Persian text (the fonts carry them; format with
`fa-IR`); thousands separator «٬»; phone numbers and Latin in LTR islands
(`dir="ltr"`, `unicode-bidi: isolate`); never letter-space Persian; never
justify; no italic for Persian; no fake bold; measure 62ch; headlines max
2 lines at 1440 and 3 on phones; hero subtext max 20 words.

## 3. Spacing, radius, elevation, layout

- Base 4 px; scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (`--space-*`).
- Section padding `clamp(4rem, 6vw + 1rem, 8rem)`; content container
  80rem, full-bleed media 90rem; gutters (`--gutter`) 16 px under 744, 24 px
  from 744 and 32 px from 1280.
- Radius system, no exceptions: pill 999 px (buttons, chips, the sticky
  pill), input 12 px, card 20 px, media 24 px, sheet and modal 28 px,
  badge 8 px.
- Elevation: `--shadow-raised` for cards that float (tinted navy), and
  `--shadow-floating` for the sticky bar, dialogs and the closed-hours
  sheet. Dark theme uses lighter surfaces and borders, weaker shadows.
  Cards only when elevation communicates hierarchy; never cards inside
  cards.
- Tailwind v4 mapping (phase 3): `--color-*`, `--radius-*` and `--shadow-*`
  keep their names inside `@theme`; `--space-N` becomes `--spacing-N`;
  `--text-role` keeps its name and gains `--text-role--line-height`;
  `--dur-*` and `--ease-*` stay plain custom properties for CSS and GSAP.
- Breakpoints: 744 (tablet), 1024 (desktop layouts, pinned scenes allowed),
  1280 (full nav with the phone number), 1536 (max type). Phone layouts
  are designed first.
- Targets: 44x44 CSS px minimum, 52 px for primary CTAs; 48 px rows in the
  drawer. Navigation height 72 px. Sticky bar 64 px plus the safe-area.

## 4. Iconography and imagery

- Icons: Phosphor (React package in the app). Regular weight for UI,
  duotone for the five category icons. One family. Directional icons
  (arrows, chevrons, back) mirror in RTL; phones, clocks, checks, play and
  logos never mirror. Stroke 1.5 px on a 24 px grid.
- Photography: real clinic photos only; warm, soft grading; subjects look
  toward the content or the CTA. Ratios: hero 4:5 on phones and 3:2 on
  desktop, cards 4:3, dentist portraits 4:5, before/after 1:1 pairs.
  AVIF with WebP fallback, responsive sizes, blur placeholders, Persian
  `alt` on every image. AI-generated people, stock smiles and clip-art
  teeth are banned. Missing photos are neutral labeled blocks of the exact
  ratio plus a row in `docs/content/gaps.md`.

## 5. Brand assets and motifs

Files: `design/brand/` (`logo-horizontal.svg`, `logo-lockup-no-latin.svg`
for the header, `logo-mark.svg`, `logo-wordmark.svg`, `logo-latin.svg`,
`favicon.svg` with a dark-mode media query, PNG favicons 32, 192, 512 and
the 180 px Apple icon, `og-template.svg` with `{{title}}` and
`{{description}}` slots and a rendered `og-preview.png`), and
`design/brand/3d/` (glTF of the mark, a diamond and the stylized molar).

Meaning (client): the teal mark is toothpaste on a toothbrush head; the
long bar of the wordmark is the brush handle; four square diamonds.

Implementation note: `mask-image: url()` is blocked over `file://`, so the
static pages use the mark as an inline SVG `<clipPath>` with
`objectBoundingBox` units; the app may use CSS masks over HTTP.

Motifs: the mark as hero mask, loading indicator, favicon, bullet in
brand-soft and faint relief ornament; the diamonds as intro particles, step
markers and pagination dots; the bar as the intro progress line, the active
nav underline and section dividers. Never draw a literal brush or paste
next to the mark.

## 6. Layout families

| Code | Family | Breakpoint behavior |
|---|---|---|
| A | asymmetric split hero: text at the start side, masked media at the end side | stacked on phones: text, media, CTAs |
| B | fact row: 3-6 short verified facts | 2x2 on phones |
| C | grid or bento with exactly as many cells as items | single column under 744, two columns on tablets |
| D | pinned morph or turntable section | stepper with tap controls under 1024 |
| E | compare slider | same, 44 px handle |
| F | 3-up card grid | native snap carousel under 1024 |
| G | pinned horizontal pan (home only); G-static: vertical steps with diamond markers | vertical steps |
| H | video poster cards | single column |
| I | FAQ accordion with a sticky aside (call, WhatsApp, booking) | aside becomes the sticky bar |
| J | inline booking block with the static map; J-form without the map | map under the form |
| K | reading column, 62ch, optional sticky table of contents | no TOC |
| L | focused task with a trust aside | aside below |

Rules: at least five families on the home page; no family more than twice
on a page; at most two consecutive image-and-text splits; one H1; one
primary CTA per section. Section orders per template: `docs/ia.md`.

## 7. Components and states

Every component ships default, hover (fine pointer), focus-visible, active,
disabled, and where it applies loading, empty, error and success, in both
themes. Reference implementation: `design/styleguide.html`.

| Component | Spec |
|---|---|
| Button | primary (brand fill, on-brand label), secondary (brand outline), ghost (text), danger (danger fill, white); heights 44 and 52; pill; label plus optional start or end icon mirrored in RTL; hover darkens to brand-strong; active `scale(.98)`; loading keeps width, spinner replaces the icon, label stays; disabled 50% with no hover |
| Link | brand color, underline grows from the start side on hover, focus ring |
| Navigation | desktop bar 72 px, logo at the start side (the right in RTL, as on phones), 5 items, services mega menu (click or keyboard; hover intent on fine pointers), theme toggle, phone LTR island (hidden under 1280, icon remains), «رزرو نوبت» pill; phone header with a call icon (closed-hours sheet) and a drawer button; drawer full screen, 48 px rows, two levels, focus trapped, Esc closes |
| Sticky bar | under 1024 px: «تماس» \| «واتساپ» \| «رزرو نوبت» (primary cell), 64 px plus safe-area; visibility rules in `docs/conversion.md` section 4 |
| Closed-hours sheet | 28 px radius sheet from the bottom with hours and two actions |
| Input | label above, help text, 12 px radius, 44 px height, line-strong border, focus ring; error text below with `aria-invalid` and `aria-describedby`; phone input is an LTR island with `inputmode="numeric"` |
| Chips | native radios styled as 44 px pills in a fieldset with a legend; selected = brand-soft fill and brand border |
| Booking form | per `docs/conversion.md` section 5; success state with the drawn check |
| Emergency form | per `docs/conversion.md` section 7; warning token, `tel:115` link |
| Service card | title, one line, category icon, 20 px radius, hover lift 2 px |
| Category tile | bento cell with the duotone icon in the category color, title, count |
| Tier comparison | three columns on desktop, swipeable cards on phones; selected tier in the warm token with `--color-on-warm` text; one «رزرو نوبت» per tier carrying the tier |
| Dentist card | 4:5 portrait, name, specialty, council number as an LTR island |
| Compare slider | pointer, touch and keyboard; labels «قبل» «بعد»; 44 px handle |
| Testimonial card | poster, play button (not mirrored), name label, consent line |
| Fact | number in Persian digits (display-2) and a one-line label |
| FAQ item | native `<details>`, chevron rotates, 44 px summary |
| Alerts and toast | info, success, warning, danger with the fill and `--color-on-fill` or white; toast for transient messages only |
| Breadcrumb | parent path, truncated on phones to the parent with a mirrored chevron |
| Pagination | numbers in Persian digits, diamonds as the active marker |
| Article parts | table of contents, callout, sources list, author box, reviewer box, updated date, reading time |
| Map block | static map image, four deep links (گوگل‌مپ، نشان، بلد، ویز) |
| Footer | per `docs/ia.md` section 3; disclosures on phones; the playground on home |
| Skeletons | shapes matching the final layout; shimmer only under `prefers-reduced-motion: no-preference` |
| Empty state | one sentence and one action |
| System pages | 404, 500, 503 with links to services, the call button and, on 404, «درد شدید دارید؟» |

## 8. RTL rules

`<html dir="rtl" lang="fa">`. Logical properties only (`margin-inline-start`,
`padding-inline`, `inset-inline-end`, `border-start-start-radius`). LTR
islands for Latin, phone numbers, URLs and codes (`<bdi>` or `dir="ltr"`
with `unicode-bidi: isolate`). Persian punctuation («،» «؛» «؟» «:» and
«گیومه»); ZWNJ in prefixes and suffixes; Persian ی and ک. Icon mirroring
per section 4. Numbers formatted with `Intl.NumberFormat('fa-IR')`.

## 9. Motion tokens and rules (content pages and UI)

Durations `--dur-1` 120 ms (micro), `--dur-2` 200 ms (UI), `--dur-3` 320 ms
(reveals), `--dur-4` 600 ms (choreography), `--dur-5` 1250 ms (the intro only, hard cap 1400 ms); easings `--ease-out`
`cubic-bezier(0.16, 1, 0.3, 1)` and `--ease-in-out`
`cubic-bezier(0.65, 0, 0.35, 1)`; all durations become 0 under reduced
motion (the token file does this). Rules: motivated only; transform and
opacity only in the DOM; no scroll event listeners; pinned sections only at
1024 px and wider; phones use 12 px distances and fewer staggers; nothing
loops except loading indicators. The home experience, its intro, tiers and
budgets are specified in `docs/experience-direction.md` and
`docs/experience/storyboard.md`.

## 10. The 3D look

- Material language: porcelain relief. Light theme: matte white reliefs
  (`#F4F3EF`, roughness about 0.55, clearcoat 0.3, slight sheen) on the
  warm surface with soft shadows and a fine grain at tier 3. Dark theme:
  navy world with the mark as teal glass (`--color-brand-logo`,
  transmission about 0.6, ior 1.45) and diamonds as navy gems that catch
  light.
- The molar: ivory enamel (`#F6F1E7`, roughness 0.35, clearcoat 0.6, a
  little transmission at tier 3 for a subsurface feel); the CIP state adds
  a procedural characterization layer (warm gradients, fine stain lines near
  the cusps). It is stylized and modeled in-house; an anatomical licensed
  model may replace it later without changing the scene contract.
- Lighting: one key light drifting from cool (hero) to warm (first visit and
  booking); fill from `RoomEnvironment`; no HDR files.
- Camera: front and slightly low in the hero; a gentle tilt in the trust
  band; lateral travel in the services scene; a diagonal path in the
  workflow scene; still for the rest.
- Grain only in WebGL post-processing at tier 3, never as a DOM overlay.
- Text never lives in 3D.

## 11. Banned patterns

Purple or mesh gradients; three equal feature cards; cards inside cards;
decorative status dots; small uppercase labels above headings (max one per
three sections); centered-everything layouts; infinite marquees; scroll
cues; custom cursors; emoji in the UI; em dashes in copy; glassmorphism
except a light scrim behind the navigation; spinners where a skeleton
fits; neon or liquid-metal buttons; sound; zoom lock; scroll hijacking;
WebGL on content pages beyond the optional molar on the restoration page;
Google Fonts links; Google Maps JavaScript; any third-party request on
public pages except optional analytics.
