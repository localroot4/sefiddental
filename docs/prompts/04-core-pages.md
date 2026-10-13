# Phase 04 - Core Pages

Build the content templates with final layout, final structure and draft
copy, as server components with light motion. The home page gets its real
section markup and content now and its experience in phases 7 and 8. Think
like the UI designer, front-end engineer, Persian copywriter and
accessibility specialist.

## Inputs

`docs/ia.md`, `docs/conversion.md`, `docs/design/DESIGN.md`, hero direction
B (`design/hero-directions/b.html`, chosen 2026-10-13, brief decision 19;
the gaps between b.html and the binding docs are listed in
`design/NOTES-styleguide.md`), `docs/experience/storyboard.md` scene 1,
`design/styleguide.html`, all previous reports.

## Deliverables

1. Component library under `src/components/` mirroring the styleguide: every
   component from `docs/design/DESIGN.md` with all states, typed props, RTL
   correct, both themes; motion through Motion in client islands only.
2. Navigation: desktop bar (one line, max 72 px), services mega menu, phone
   drawer (grouped services, 48 px rows, focus trap, Esc), theme toggle,
   phone link with the closed-hours sheet, «رزرو نوبت» CTA, the sticky
   bottom bar with the visibility rules in `docs/conversion.md` section 4,
   safe-area aware. Footer per `docs/ia.md` section 3 (the playground
   arrives in phase 7; ship the static footer now).
3. Home page markup: all ten sections of `docs/ia.md` T-home with real
   content in reading order, hero direction B, static versions of the
   scenes (the tier 0 experience). This markup is what phases 7 and 8
   animate; it must already be complete and beautiful on its own. Hero B
   per brief decision 19 and `docs/design/DESIGN.md` section 7 (home hero):
   - From 744 px: the full-bleed landscape photo (the LCP element: one
     `<picture>`, one preload with a media query, `fetchpriority=high`),
     the scrim at the start side, the booking card at the end side, and the
     trust band on the hero's bottom edge (2x2 up to 1023 px, one row of
     four from 1024 px).
   - Under 744 px: the scrim, then the card, then a 4:5 photo band with the
     four facts on its bottom edge. The H1 is the LCP element; the 4:5 crop
     loads without priority.
   - The scrim holds the H1, the subtext and «تماس با کلینیک» (secondary)
     only; b.html's scrim «رزرو نوبت» is removed. The card's «ثبت درخواست»
     is the only primary CTA in the hero.
   - The card holds the compact instance of the booking form
     (`docs/conversion.md` 5.1, compact variant): markup and client-side
     validation now, submission wired in phase 5; without JavaScript it
     posts to `/رزرو-نوبت`. The scene 10 block holds the full instance;
     ids are prefixed per instance. CTA routing on home follows
     `docs/conversion.md` section 5. The compact success (items 1-4 of
     5.4) keeps the card's reserved minimum block size.
   - The static mark relief of b.html stays for now. Judge it over the
     first real photo: remove it if it covers the focal area or reads as a
     watermark.
   - Until the photo exists, the hero uses labeled placeholders with the
     brief of gap 36 (`docs/content/shot-list.fa.md`): an empty clinic
     interior in natural light, no faces, the key detail in the central
     and upper band.
4. Services hub, category pages, the service template (all sections of
   `docs/ia.md` T-service, empty sections hidden), the restoration page with
   the three tiers as a static comparison and the anchor `#سطح-ترمیم`.
   Inner-page heroes use layout family A with the media in a plain 24 px
   radius frame, without the mark mask; the full-bleed hero B is home only
   (brief decision 19).
5. Dentists hub and profile template.
6. About page, address page (static map image with deep links, hours table
   with the live state, phones as LTR islands, WhatsApp link with prefill,
   access notes placeholder), patient guide hub and guide template, 404
   with the emergency link.
7. Draft Persian copy for every template per the copy guidelines, with
   `[[NEEDS_CLIENT]]` where facts are missing; service body copy is
   finalized in phase 6.
8. Image placeholders: neutral blocks with exact aspect ratios and captions,
   listed in `docs/content/gaps.md`.
9. Playwright screenshots of every template at the three widths in both
   themes under `docs/qa/phase-04/`; axe-core clean; Lighthouse within the
   content-page budgets on home (tier 0), a service page and a dentist page.
10. `docs/reports/phase-04.md`.

## Steps

1. Phone layouts first for every template, then tablet, then desktop.
2. Data from Payload only; no hard-coded content in components.
3. Copy self-audit: banned words, one label per intent, Persian typography,
   no em dashes, hero subtext under 20 words.
4. Screenshot, inspect, fix in one batch, confirm, stop.
5. Independent review on navigation accessibility and RTL correctness.

## Acceptance criteria

- No horizontal scroll from 320 px up on any template.
- Nav on one line at 1024 px and above; the drawer traps focus and closes
  with Esc; the sticky bar never covers content.
- Every template passes axe-core with zero violations and the content-page
  Lighthouse budgets in both themes; home passes at tier 0.
- Home hero: headline 2 lines from 1024 px and at most 3 lines from 360 px
  (`docs/design/DESIGN.md` section 2); subtext max 20 words. At 390x844
  the header, the scrim and the whole hero card, through «ثبت درخواست»,
  show above the sticky bar without scrolling; the bar covers no part of
  the submit (`docs/experience/storyboard.md` scene 1; open b.html gap 7
  in `design/NOTES-styleguide.md`). The LCP element is the photo from
  744 px and the H1 under 744 px. No layout shift when the token and hours
  data arrive or when the card shows success. Text over the photo sits only
  on the scrim or the trust band (`docs/design/DESIGN.md` section 1.1).
- Home uses at least five layout families, none more than twice.
- All numbers verified or hidden; all photos real or labeled placeholders.
- The service template renders every section from a seeded service.

## Hand-off

Ask the client to review the screenshots of the real templates and approve
structure and copy direction. Say that the labeled neutral blocks are where
their photos go, and that the look and motion of the home experience are
judged in phases 7 and 8 (brief decision 20). Ask them to confirm the plain
media frame of the inner-page heroes on one service-page screenshot (brief
decision 19). List missing photos by placement, the home hero photo first
(gap 36).
