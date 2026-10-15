# Phase 04 - Core Pages

Date: 2026-10-15 to (open).

## Plan (written before building)

What: the component library, the site chrome (header, mega menu, drawer,
closed-hours sheet, sticky bar, footer), the home page markup with hero B
and the compact and full booking form (markup and client validation), the
services hub, category, service and restoration templates, the dentists
hub and profile, about, address, patient guide hub and guide, and the 404
update. Draft Persian copy in Payload, placeholders for every missing photo,
screenshots at three widths in both themes, axe and Lighthouse.

Order:

1. Wave 1, three parallel lanes: UI (components, tokens, icon sprite, a QA
   gallery of every state), CONTENT (schema additions with migrations, seed
   copy, gap rows, copy checks, doc fixes), PLATFORM (unknown-slug 404 in the
   proxy, home title and meta description, data readers for nav, footer,
   dentists and guides, an e2e-only fixture seed).
2. Wave 2, four parallel lanes on top of wave 1: CHROME, HOME, SERVICES,
   PAGES.
3. Integration and verification: build, e2e, screenshots of every template
   at 390, 820 and 1440 px in light and dark, axe, Lighthouse on home at
   tier 0, a service page and a dentist page; inspect the screenshots, fix in
   one batch, confirm once.
4. Independent reviews: navigation accessibility and RTL (phase prompt), and
   the proxy change for unknown slugs.
5. Report, gaps, commit, push, CI green.

Main decisions (full list in the Decisions section when the phase closes):
no Motion library in this phase (CSS motion; JS headroom is 10 KiB on
content pages), icons as one cached sprite, `<picture>` instead of
`next/image` (CSP), the home H1 fallback until the slogan is supported
(gap 28), WhatsApp hidden until the number is verified (gap 16), an
e2e-only fixture for the dentist, guide, case and testimonial templates
(no real ones exist yet).

Risks: the 390x844 hero fit above the sticky bar (gap 7 measured 9 px short
on the prototype), the JS budgets, the per-request home render, and the
pages of phases 5 and 6 that the navigation already links to.
