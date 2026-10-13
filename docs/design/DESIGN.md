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
only.

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
| --color-ink on hero scrim (surface 88%) | hero headline | 11.20 OK | 11.00 OK | 4.5 |
| --color-ink-muted on hero scrim (surface 88%) | hero subtext | 4.90 OK | 6.20 OK | 4.5 |
| --color-brand-strong on hero scrim (surface 88%) | secondary button label | 4.95 OK | 6.78 OK | 4.5 |
| --color-brand on hero scrim (surface 88%) | secondary button border (non-text, 3:1) | 3.72 OK | 4.96 OK | 3.0 |
| --color-ink on trust band (surface-raised 90%) | fact text | 12.58 OK | 9.52 OK | 4.5 |
| --color-ink-muted on trust band (surface-raised 90%) | fact captions | 5.51 OK | 5.37 OK | 4.5 |

Scrim alpha needed for every scrim pair: 85% light, 80% dark (built: 88%).

0 failing pairs

Text over the home hero photo sits only on the scrim or on the trust band,
never directly on the photo. The scrim is `--color-surface` at 88% with no
blur; the trust band is `--color-surface-raised` at 90%. Each hero row
composites the layer over a black and over a white photo pixel and shows
the lower ratio, so it holds for any photo. Lowering the scrim below 85%
fails AA in the light theme. The script holds the two alphas as `SCRIM_A`
and `BAND_A`. A change to either alpha in the hero styles changes these
two values and this table in the same commit.

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

Exception: the home hero H1 is six words inside the hero scrim. The text
column is 688 px from 1280, 528 px at 1024, 356 px at 820, 280 px at 744
and 240-350 px on phones (320-430). The hero uses
`clamp(2rem, 1rem + 3vw, 3.75rem)`: 32 px floor, 60 px cap. Measured on
`design/hero-directions/b.html` with this floor: 2 lines from 1024 to 1920
and at 430, 3 lines at 820 and from 360 to 414, 4 lines at 320 and at 744.
The former 2.25rem floor gave 4 lines at 360 and 375. The 4 lines at 744
stay open for phase 4. 320 px is below the 360 px floor of the phase 4
headline check, so the hero H1 may take 4 lines there. Every other
headline uses the scale above.

Rules: Persian digits in Persian text (the fonts carry them; format with
`fa-IR`); thousands separator «٬»; phone numbers and Latin in LTR islands
(`dir="ltr"`, `unicode-bidi: isolate`); never letter-space Persian; never
justify; no italic for Persian; no fake bold; measure 62ch; headlines max
2 lines at 1440 and 3 on phones; hero subtext max 20 words.

## 3. Spacing, radius, elevation, layout

- Base 4 px; scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (`--space-*`).
- Section padding `clamp(4rem, 6vw + 1rem, 8rem)`; content container
  80rem (`--container`); wide media 90rem (`--container-wide`); full-bleed
  media (the home hero photo) spans the viewport width; gutters (`--gutter`)
  16 px under 744, 24 px from 744 and 32 px from 1280.
- Radius system, one exception (full-bleed media touches the viewport
  sides and has square corners): pill 999 px (buttons, chips, the sticky
  pill), input 12 px, card 20 px, media 24 px, sheet and modal 28 px,
  badge 8 px.
- Elevation: `--shadow-raised` for cards that float (tinted navy), and
  `--shadow-floating` for the sticky bar, dialogs, the closed-hours
  sheet and the home hero booking card. Dark theme uses lighter surfaces
  and borders, weaker shadows. Cards only when elevation communicates
  hierarchy; never cards inside cards.
- Tailwind v4 mapping (phase 3): `--color-*`, `--radius-*` and `--shadow-*`
  keep their names inside `@theme`; `--space-N` becomes `--spacing-N`;
  `--text-role` keeps its name and gains `--text-role--line-height`;
  `--dur-*` and `--ease-*` stay plain custom properties for CSS and GSAP.
- Breakpoints: 744 (tablet), 1024 (desktop layouts, pinned scenes allowed),
  1280 (full nav with the phone number), 1536 (max type). Phone layouts
  are designed first.
- Targets: 44x44 CSS px minimum for every standalone control, 52 px for
  primary CTAs; 48 px rows in the drawer. Inline text links inside a
  sentence (for example «حریم خصوصی» in the booking privacy line) are
  exempt, as in WCAG 2.2 SC 2.5.8, and keep at least 24 px spacing from
  other targets. Navigation height 72 px. Sticky bar 64 px plus the safe-area.

## 4. Iconography and imagery

- Icons: Phosphor (React package in the app). Regular weight for UI,
  duotone for the five category icons. One family. Directional icons
  (arrows, chevrons, back) mirror in RTL; phones, clocks, checks, play and
  logos never mirror. Stroke 1.5 px on a 24 px grid.
- Photography: real clinic photos only; warm, soft grading; subjects look
  toward the content or the CTA. Ratios: inner-page heroes 4:5 on phones
  and 3:2 on desktop, cards 4:3, dentist portraits 4:5, before/after 1:1
  pairs. The home hero photo is an empty clinic interior in natural light,
  with no faces. From 744 px it is a landscape source (at least 4000 px on
  the long side) cropped by its focal point to the hero box (measured on
  b.html: 1.12:1 at 744x1133, 1.28:1 at 820x1180, about 3:2 at 1024x768,
  16:9 at 1440x900 and 7:3 at 1920x1080); the key detail sits in the
  central and upper band. Under 744 px it is a 4:5 band under the
  booking card, cropped from the same shoot; its key detail sits in the
  top third, because the trust band covers the bottom 37-61% of the band
  (430 to 320 px).
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

Implementation note: page heroes carry no mark mask. A mark mask remains
in the intro reveal and in the optional hero exit enhancement (the photo
contracts into the mark at 1024 px and wider, tiers 2-3 only, kept only if
it holds 60 fps at 4x CPU throttle). The intro uses an inline SVG `<mask>`
whose mark is scaled by transform. `mask-image: url()` is blocked over
`file://`, so the static pages use inline SVG masks or a `<clipPath>` with
`objectBoundingBox` units; the app may use CSS masks over HTTP.

Motifs: the mark as the intro reveal mask (the overlay opens through the
growing mark onto the hero), loading indicator, favicon, bullet in
brand-soft, faint relief ornament, the footer playground and the 3D world
from the hero exit; never as a mask on page heroes. On home the static
relief over the hero photo stays for phase 4 and is judged over the first
real photo: it is removed if it covers the focal area or reads as a
watermark, and by default if no real photo exists by phase 7. The
diamonds as intro particles, step markers and pagination dots; the bar as
the intro progress line, the active nav underline and section dividers.
Never draw a literal brush or paste next to the mark.

## 6. Layout families

| Code | Family | Breakpoint behavior |
|---|---|---|
| A | asymmetric split hero (inner pages): text at the start side, media in a plain 24 px radius frame at the end side, no mark mask | stacked on phones: text, media, CTAs |
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
| M | full-bleed photo hero (home only): headline, subtext and one secondary CTA on a scrim at the start side; floating booking card (compact form) at the end side; trust band (B) on the hero's bottom edge | 744-1023: two columns, facts in a 2x2 grid; from 1024: facts in one row of four; phones: scrim, card, then a 4:5 photo band with the four facts on its bottom edge |

Rules: at least five families on the home page; no family more than twice
on a page; at most two consecutive image-and-text splits; one H1; one
primary CTA per section. Section orders per template: `docs/ia.md`.
Family M is used on home only. The phase 4 review confirms the plain
family A media frame with one service-page screenshot.

## 7. Components and states

Every component ships default, hover (fine pointer), focus-visible, active,
disabled, and where it applies loading, empty, error and success, in both
themes. Reference implementation: `design/styleguide.html`.

| Component | Spec |
|---|---|
| Button | primary (brand fill, on-brand label), secondary (brand outline), ghost (text), danger (danger fill, white); heights 44 and 52; pill; label plus optional start or end icon mirrored in RTL; hover darkens to brand-strong; active `scale(.98)`; loading keeps width, spinner replaces the icon, label stays; disabled 50% with no hover |
| Link | brand color, underline grows from the start side on hover, focus ring |
| Navigation | desktop bar 72 px, logo at the start side (the right in RTL, as on phones), 5 items, services mega menu (click or keyboard; hover intent on fine pointers), theme toggle, phone LTR island (hidden under 1280, icon remains), «رزرو نوبت» pill; phone header with a call icon (closed-hours sheet) and a drawer button; drawer full screen, 48 px rows, two levels, focus trapped, Esc closes |
| Home hero | family M. One `<picture>` with art-directed sources (full-bleed landscape from 744 px, a 4:5 band under 744 px): never a CSS background, never `loading="lazy"`. From 744 px the landscape crop is the LCP: one preload with a media query and `fetchpriority="high"`. Under 744 px the LCP is a scrim text element (the H1, or the subtext where its box is larger), never an image; the scrim-and-card block is at least `calc(100svh - 65px)` tall (the 64 px phone header plus its hairline), so the 4:5 band always starts below the first screen and loads without priority. Scrim panel at the start side (surface 88%, no blur, sheet radius 28, padding 24, 32 from 1280) with the H1 (hero clamp, section 2), the subtext and «تماس با کلینیک» (secondary); no other button. Booking card at the end side (card radius 20, raised surface, hairline, `--shadow-floating`; 21rem at 744, 22rem at 1024, 26rem from 1280) with the compact booking form; its «ثبت درخواست» is the only primary CTA in the hero. Trust band (four facts on surface-raised 90%, hairline top) on the hero's bottom edge from 744 px and on the photo band's bottom edge on phones. From 1024 the hero has `min-block-size: min(100svh - var(--nav-h), 52rem)`. The static mark relief follows section 5 |
| Sticky bar | under 1024 px: «تماس» \| «واتساپ» \| «رزرو نوبت» (primary cell), 64 px plus safe-area; visibility rules in `docs/conversion.md` section 4 |
| Closed-hours sheet | 28 px radius sheet from the bottom with hours and two actions |
| Input | label above, help text, 12 px radius, 44 px height, line-strong border, focus ring; error text below with `aria-invalid` and `aria-describedby`; phone input is an LTR island with `inputmode="numeric"` |
| Chips | native radios styled as 44 px pills in a fieldset with a legend; selected = brand-soft fill and brand border |
| Booking form | per `docs/conversion.md` section 5; one component in two variants: full (booking page, dialog, booking blocks) and compact (home hero card: phone field plus the hidden fields); home has one of each, every other page one instance; ids prefixed per instance; success state with the drawn check; the compact success shows items 1-4 of `docs/conversion.md` 5.4 in place and keeps the card height (reserved min block size) |
| Emergency form | per `docs/conversion.md` section 7; warning token, `tel:115` link |
| Service card | title, one line, category icon, 20 px radius, hover lift 2 px |
| Category tile | bento cell with the duotone icon in the category color, title, count |
| Tier comparison | three columns on desktop, swipeable cards on phones; selected tier in the warm token with `--color-on-warm` text; one «رزرو نوبت» per tier carrying the tier |
| Dentist card | 4:5 portrait, name, specialty, council number as an LTR island |
| Compare slider | pointer, touch and keyboard; labels «قبل» «بعد»; 44 px handle |
| Testimonial card | poster, play button (not mirrored), name label, consent line |
| Fact | short fact in body 600 (for example «هر روز ۱۰ تا ۲۰») with a caption line in ink-muted and a 2 px brand line at the start side, as built in `design/hero-directions/b.html`; the display-2 number variant only for verified statistics (gap 15) |
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
  the cusps). It is stylized and modeled in-house, and it is the default
  until the client decides (gap 34). A realistic model may replace it
  without changing the scene contract only if the client picks it in
  phase 8 from two side-by-side renders; the sourcing rule is in
  `docs/brief.md` section 8.
- No WebGL over the home hero photo: the fixed canvas mounts after load but
  renders no frames while the photo covers the viewport. The world appears
  as the hero scrolls away (the hero exit).
- Lighting: one key light drifting from cool (hero exit) to warm (first
  visit and booking); fill from `RoomEnvironment`; no HDR files.
- Camera: front and slightly low where the world first appears (the hero
  exit); a gentle tilt as the trust band leaves with the hero; lateral
  travel in the services scene; a diagonal path in the workflow scene;
  still for the rest.
- Grain only in WebGL post-processing at tier 3, never as a DOM overlay.
- Text never lives in 3D.

## 11. Banned patterns

Purple or mesh gradients; three equal feature cards; cards inside cards;
decorative status dots; small uppercase labels above headings (max one per
three sections); centered-everything layouts; infinite marquees; scroll
cues; custom cursors; emoji in the UI; em dashes in copy; glassmorphism
except a light scrim behind the navigation (the home hero scrim is an 88%
surface sheet with no blur, not glass); spinners where a skeleton fits;
neon or liquid-metal buttons; sound; zoom lock; scroll hijacking; WebGL
on content pages beyond the optional molar on the restoration page;
Google Fonts links; Google Maps JavaScript; any third-party request on
public pages except optional analytics.
