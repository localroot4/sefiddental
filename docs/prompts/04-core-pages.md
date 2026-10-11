# Phase 04 - Core Pages

Build the public site's main templates with final layout, final structure and
draft copy. Motion in this phase is limited to the system reveals from the
design system; the intro and signature moments come in phase 7. Think like
the UI designer, front-end engineer, Persian copywriter and accessibility
specialist.

## Inputs

`docs/ia.md`, `docs/conversion.md`, `docs/design/DESIGN.md`, the hero
direction the client picked, `design/styleguide.html`, all previous reports.

## Deliverables

1. Blade component library in `resources/views/components/` mirroring the
   styleguide: every component from `docs/design/DESIGN.md` with all states,
   documented props, RTL correct, both themes.
2. Navigation: desktop bar (one line, max 72 px), services mega menu, phone
   drawer with grouped services and 48 px rows, theme toggle, phone link,
   «رزرو نوبت» CTA, sticky bottom bar on phones (تماس | واتساپ | رزرو نوبت)
   that hides on scroll down and returns on scroll up, safe-area aware.
   Footer with NAP, hours, legal line placeholders, links, socials.
3. Home page with the section order from `docs/design-direction.md`
   section 6, using the chosen hero direction. Sections that depend on
   phase 5-7 (tier morph, journey pan, booking block) ship as their static
   versions now.
4. Services hub (bento, exact cell count), category pages, service page
   template (hero, summary, who it is for, steps, sessions and duration,
   aftercare, price-from if set, dentists who perform it, related cases,
   FAQ with sticky aside, related services and articles), the restoration
   page with the three tiers as a static comparison.
5. Dentists hub and profile template (portrait, specialty, council number,
   degrees, services, articles reviewed, CTA).
6. About page (story, space, team, equipment section with
   `[[NEEDS_CLIENT]]` handling, trust facts verified or hidden).
7. Contact page (static map image with deep links to Google Maps, Neshan,
   Balad and Waze, hours table, phones as LTR islands, WhatsApp link with
   prefilled text, access notes placeholder).
8. Draft Persian copy for every template following the copy guidelines, with
   `[[NEEDS_CLIENT]]` where facts are missing. Service body copy is finalized
   in phase 6; here write the structure, headings, summaries and CTAs.
9. Image placeholders: a neutral block with the exact aspect ratio and a
   caption of what photo goes there, listed in `docs/content/gaps.md`.
10. Playwright screenshots of every template at the three widths in both
    themes under `docs/qa/phase-04/`; axe-core clean; Lighthouse within
    budgets on home, one service page and one dentist page.
11. `docs/reports/phase-04.md`.

## Steps

1. Build phone layouts first for every template, then tablet, then desktop.
2. Wire real data from the seeders; no hard-coded content in views.
3. Write the copy, then run the copy self-audit: banned words, one label per
   intent, Persian typography, no em dashes, hero subtext under 20 words.
4. Screenshot, inspect, fix in one batch, confirm, stop.
5. Independent review on navigation accessibility (keyboard, screen reader
   order, focus trap in the drawer) and on RTL correctness.

## Acceptance criteria

- No horizontal scroll from 320 px up on any template.
- Nav renders on one line at 1024 px and above; the drawer traps focus and
  closes with Esc; the sticky bar never covers content at the page bottom.
- Every template passes axe-core with zero violations and the Lighthouse
  budgets in both themes.
- Hero: headline max 2 lines on desktop, subtext max 20 words, CTAs visible
  without scrolling at 390x844.
- Home uses at least five layout families, no family more than twice, max
  two consecutive image-plus-text splits.
- All numbers shown are verified or hidden; all photos are real or labeled
  placeholders.
- Service page template renders every section from a seeded service and
  hides empty sections gracefully.

## Hand-off

Ask the client to review the screenshots and approve the structure and copy
direction. List missing photos by exact placement.
