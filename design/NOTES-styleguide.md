# Styleguide and hero directions: build notes

Static, self-contained pages. No CDN, no external request of any kind. Fonts
load from `design/fonts/` by relative path, tokens from `design/tokens.css`,
the logo parts are inline SVG symbols (the mark and the wordmark), icons are
inline 24 px line symbols with a 1.5 px stroke. Vanilla CSS and a small
vanilla script per page. Open the files from disk; they work over `file://`.

Design intent: persuade mode, calm premium clinic. One accent (brand teal),
peach only on the selected restoration tier, navy ink on an off-white
surface, navy surfaces with teal in dark. Estedad for display sizes,
Vazirmatn 400 to 700 for everything else, body line height 1.85, 4 px grid,
radius system exactly as the tokens (pill, 12, 20, 24, 28, 8).

## Files

| File | What it is |
|---|---|
| `design/styleguide.html` | one page, every component in both themes, with the theme toggle (`data-theme` on `<html>`, default follows the system, saved in `localStorage` as `sefid-theme`) |
| `design/hero-directions/a.html` | home hero direction A: header, asymmetric split hero, trust band |
| `design/hero-directions/b.html` | home hero direction B: header, full-bleed hero with the floating booking card, trust band inside the hero |
| `docs/qa/phase-02/*.png` | screenshots: styleguide full page and both heroes at 390x844, 820x1180, 1440x900, light and dark, plus the open phone drawer at 390 |

## Component inventory (styleguide order)

| Component | States and notes |
|---|---|
| Color tokens | 24 swatches, light and dark value side by side in the current theme, hex and role |
| Type scale | display-1, display-2, heading, body-lg, body, small, caption with Persian sentences; one LTR island with a phone number and a Latin domain |
| Spacing and radius | the ten spacing steps as bars; the six radii as boxes |
| Buttons | primary, secondary, ghost, danger; 44 and 52; default, hover, focus-visible, active, disabled, loading (spinner replaces the icon, label stays); start and end icons mirrored in RTL |
| Links | resting hairline underline, 2 px bar grows from the start side on hover and focus |
| Inputs | label above, help text, error below with `aria-invalid` and `aria-describedby`; phone input as an LTR island with Persian digits; disabled; textarea with counter |
| Chips | native radios styled as 44 px pills; checked, hover, focus-visible, disabled |
| Booking form | per `docs/conversion.md` 5.1: one required field, service chips (first chip reads «معاینه و مشاورهٔ رایگان»), time chips, «توضیح بیشتر» disclosure with a 500 character counter, honeypot, privacy line, «ثبت درخواست» with the «در حال ثبت» loading state and kept width, phone fallback line; validation on blur and submit with the three phone messages; success state with the drawn check, callback line, masked number, save-contact button, what to bring, address; a reset button for the demo |
| Service card | 4:3 placeholder, category icon, title, one line, facts, link, hover lift |
| Category tiles | five tiles in a bento (cosmetic is the large cell), hand-drawn 24 px line icons in the category accents |
| Tier comparison | three columns from 1024 px, swipeable snapping cards below; VIP selected with the warm token and an «انتخاب‌شده» badge; one «رزرو نوبت» per tier |
| Dentist card | 4:5 portrait placeholder, name, specialty, council number in an LTR island; placeholders only, no invented name |
| Before/after slider | clip-path on the after layer, a transparent native range input gives pointer, touch and arrow keys; 44 px handle; labels «قبل» at the start and «بعد» at the end; `aria-valuetext` in Persian digits |
| FAQ | native `<details>`, 44 px summary, rotating chevron |
| Alerts and toast | info, success, warning, danger; toast fixed above the sticky bar, 4 s, demo button |
| Breadcrumb | full path from 744 px; parent only with a mirrored back chevron on phones |
| Pagination | Persian digits, prev and next mirrored, diamond under the active page, disabled prev |
| Skeleton | card skeleton with an opacity pulse (no shimmer gradient), static under reduced motion |
| Empty state | one sentence, one action, the mark in brand-soft |
| Sticky bar | fixed at the bottom under 1024 px, 64 px plus safe-area, three cells, the booking cell filled; hides while a field has focus or the drawer is open |
| Navigation | 72 px desktop bar with five items, the active item marked by the bar motif, theme toggle, phone as an LTR island from 1280 px (call icon below that), «رزرو نوبت» pill, logo at the end side; phone header with logo, call icon and menu button; full-screen `<dialog>` drawer with 48 px rows, three service groups as disclosures, Esc and close button, Tab trapped, focus returned to the opener |
| Footer | four groups per `docs/ia.md` section 3, address block always open, the other groups are disclosures on phones, bottom row with socials, license placeholders and the copyright |

## Measured results

Overflow check (`document.documentElement.scrollWidth <= clientWidth`), fonts
loaded, Chromium via Playwright:

| Width | styleguide | hero A | hero B |
|---|---|---|---|
| 320 | 320 / 320 OK | 320 / 320 OK | 320 / 320 OK |
| 390 | 390 / 390 OK | 390 / 390 OK | 390 / 390 OK |
| 820 | 820 / 820 OK | 820 / 820 OK | 820 / 820 OK |
| 1440 | 1440 / 1440 OK | 1440 / 1440 OK | 1440 / 1440 OK |

Hero checks: headline 2 lines at 1024, 1280, 1440 and 1920 in both
directions; nav 72 px on one line from 1024; at 390x844 the CTAs end at
423 px (A) and 432 px (B), above the sticky bar at 780 px.

Behavior checks (scripted): drawer opens, Tab stays inside across 40
presses, Esc closes and focus returns to the menu button; landline input
shows the landline message with `aria-invalid`; a valid number shows
«در حال ثبت», then the success state with the masked number and focus on
its heading; arrow keys move the compare slider; the theme toggle writes
`sefid-theme` to localStorage.

Two inspection rounds were done: one batched fix round (phone header
overflow, 320 px pagination wrap, grid row stretching, logo rendering,
headline size, hero spacing, tablet grid for B) and one confirmation round.

## Decisions and deviations

- Logo position: at the inline start of the desktop bar (the right side in
  RTL), matching the phone header and the Persian convention; corrected by
  the lead after the first review round.
- Logo rendering: `mask-image: url(file.svg)` is blocked over `file://`
  (CORS), so the mark and the wordmark are inline symbols filled with
  tokens. Over HTTP either method works.
- Hero headline: the six-word positioning line does not fit two lines at
  display-1 (72 px) in a 672 px column, so the heroes use
  `clamp(2.25rem, 1rem + 3vw, 3.75rem)` (60 px at 1440). Everything else
  uses the token scale as is.
- Hero mask: an SVG `clipPath` in `objectBoundingBox` units. The masked
  block keeps the mark's own proportion (168 : 207) on tablets and
  desktops and 4:5 on phones, so the shape is never stretched; the photo
  asset itself is still 3:2 on desktop and is cropped by the mark.
- `heading` uses Vazirmatn 600, because Estedad ships as a single 700
  weight (as `DESIGN.md` specifies).
- `clip-path: inset()` and `transform-origin` are physical by nature; the
  slider computes its value for RTL and the link underline origin is set
  under `[dir="rtl"]` with an `[dir="ltr"]` counterpart. No `left` or
  `right` keyword appears in any file.
- The services mega menu panel is not built; the «خدمات» item carries
  `aria-haspopup` and `aria-expanded` for it. The emergency form, the
  closed-hours sheet, testimonial cards and article parts are outside
  this deliverable.
- Trust facts use only confirmed facts (free first consultation, hours,
  callback window, the five featured insurers). The old-site statistics
  wait for verification (gap 15).

## How A and B differ

A is an asymmetric split: the copy with the four diamond gems sits at the
start side, the photo is cut by the teal mark shape at the end side, and
the trust band is a quiet row under the hero on a sunken band. B is a
full-bleed photo: the headline sits on a translucent sheet at the start
side, a floating booking card with the one-field form takes the end side,
and the mark appears as a large faint porcelain relief in the top corner.
In B the trust band lives on the bottom edge of the hero itself, so the
first viewport already contains proof and the form, while A keeps the
first viewport to the promise and the two CTAs and lets the photo carry
the mood.

## After the phase 2 review

- «خدمات» in the navigation is a plain link until the mega menu exists (phase 3); the earlier button carried `aria-haspopup` with no panel.
- `--color-ink-faint` is no longer used for text; captions and counters use `--color-ink-muted`.
- Section-index links, footer links and standalone phone links keep a 44 px hit area; links inside running sentences stay inline (WCAG inline exception).
