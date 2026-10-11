# Phase 04 - Core Pages

Build the content templates with final layout, final structure and draft
copy, as server components with light motion. The home page gets its real
section markup and content now and its experience in phases 7 and 8. Think
like the UI designer, front-end engineer, Persian copywriter and
accessibility specialist.

## Inputs

`docs/ia.md`, `docs/conversion.md`, `docs/design/DESIGN.md`, the chosen hero
direction, `design/styleguide.html`, all previous reports.

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
3. Home page markup: all eleven sections from `docs/ia.md` with real content
   in reading order, the hero direction the client picked, static versions
   of the scenes (the tier 0 experience). This markup is what phases 7 and
   8 animate; it must already be complete and beautiful on its own.
4. Services hub, category pages, the service template (all sections of
   `docs/ia.md` T-service, empty sections hidden), the restoration page with
   the three tiers as a static comparison and the anchor `#سطح-ترمیم`.
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
- Hero: headline max 2 lines on desktop, subtext max 20 words, CTAs visible
  without scrolling at 390x844.
- Home uses at least five layout families, none more than twice.
- All numbers verified or hidden; all photos real or labeled placeholders.
- The service template renders every section from a seeded service.

## Hand-off

Ask the client to review the screenshots and approve structure and copy
direction; list missing photos by placement.
