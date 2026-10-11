# Phase 02 - Brand and Design System

Design in code, before the application exists. Output is a living styleguide
and prototypes that phase 3 imports as-is. Think like the creative director,
brand designer, motion designer and accessibility specialist.

## Inputs

`docs/design-direction.md`, `docs/ia.md`, `docs/conversion.md`,
`content/brand/`, phase 1 report.

## Deliverables

1. `docs/design/DESIGN.md` - the complete design system: final color tokens
   for both themes with a measured contrast table (every text-on-surface pair
   used anywhere, WCAG AA or better), typography scale and font loading
   strategy, spacing, radius, elevation, iconography rules, imagery rules,
   layout families with breakpoint behavior, component inventory with every
   state, RTL rules, motion tokens and principles, banned patterns. Written
   so an engineer who never saw the brief builds the same site.
2. `design/tokens.css` - CSS custom properties for both themes, ready to be
   imported into Tailwind v4 `@theme` in phase 3.
3. `design/fonts/` - Vazirmatn and Estedad variable woff2 files, subset to
   Persian plus Latin, with a `fonts.css` using `font-display: swap` and
   `unicode-range`. Record total bytes in the report (budget 120 KB).
4. `design/brand/` - logo as SVG if the client sent one, otherwise a careful
   vector trace of `content/brand/logo-horizontal.png` marked as a trace for
   client approval; separate SVGs for the teal mark, the wordmark, the
   diamond dot and the bar; favicon set; OG template background.
5. `design/styleguide.html` - a static, self-contained page (vanilla HTML,
   CSS, minimal JS, RTL, both themes with a toggle) that renders: colors,
   type scale with real Persian text, spacing and radius, buttons in every
   state, inputs with label, help and error, chips, cards, the service
   category tiles, the tier comparison, a dentist card, a before/after
   slider, a FAQ item, the sticky mobile bar, the navigation at three widths,
   skeletons, alerts, the footer.
6. `design/intro-prototype.html` - the intro animation from
   `docs/design-direction.md` section 8 built with CSS keyframes and under
   2 KB of JavaScript: real timings, skip on tap and Esc, session flag,
   reduced-motion branch, and a visible timeline overlay for review. Measure
   the total duration and confirm the hero beneath is painted at 0 ms.
7. `design/motion-prototypes/` - one small HTML prototype per signature
   moment (tier morph with GSAP MorphSVG, patient journey pan, hero mask
   reveal) with a phone fallback demonstrated in the same file.
8. `design/hero-directions/` - two complete hero compositions for the home
   page as static HTML (A and B), each at 390, 820 and 1440 in both themes,
   with the real positioning line and the exact CTA labels. The client picks
   one.
9. `docs/qa/phase-02/` - screenshots of everything above at the three widths
   and both themes.
10. `docs/reports/phase-02.md`.

## Steps

1. Derive every token from `docs/design-direction.md`. Compute contrast with
   a script (store it under `design/tools/`), adjust values that fail, and
   write the table.
2. Build the styleguide mobile-first. Check it at 320 px for overflow.
3. Build the intro prototype and time it with the Performance API. Confirm no
   layout shift when the overlay leaves (CLS 0).
4. Build the motion prototypes. Verify 60 fps on a 4x CPU throttle in
   Chromium DevTools protocol or by measuring frame times in Playwright.
5. Build the two hero directions. They must differ in composition, not just
   color: for example A = masked photo end with text start, B = full-bleed
   photo with a floating booking card.
6. Screenshot everything, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- Every text color on every surface used passes AA; small text passes 4.5:1
  in both themes, verified by the script output in the report.
- Fonts under 120 KB total; Persian text renders with correct shaping and
  digits.
- Styleguide has no horizontal scroll at 320, 390, 820, 1440 px.
- Intro: total under 1400 ms, skippable, session-once, reduced-motion branch,
  zero layout shift, hero painted beneath at start.
- Motion prototypes hold 60 fps on desktop and degrade to the stepped or
  stacked variant under 1024 px.
- Radius, spacing and accent rules are followed everywhere in the styleguide.
- No banned pattern appears in any prototype.

## Hand-off

Ask the client to pick hero direction A or B and to approve the logo trace.
List exactly which screenshots to open.
