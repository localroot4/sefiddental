# Phase 04 - Core Pages

Date: 2026-10-15.

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

## Delivered

Commit range on `main`: `cb2e3a4` to the commit that closes this report
(it adds this report and the screenshots), oldest first:

- `cb2e3a4` Record the client's phase 3 gate answer
- `a6fefeb` Split the UI strings into one module per area
- `2b21912` Write the phase 4 plan
- `0bc3e73` Add the phase 4 content model, draft copy and copy checks
- `396e9cd` Add the component library, the icon sprite and the QA gallery
- `04df309` Answer unknown slugs with the branded 404 and add the chrome readers
- `e1e062e` Check the gallery and the unknown-slug 404 in e2e
- `d28b787` Fix the booking form interface for the phase 4 pages
- `5bd3fad` Share the helpers the page templates need
- `af8e843` Build the site header, menus, sticky bar and footer
- `f84dd07` Build the home page with hero B and the booking form
- `5c8e8bc` Build the services hub, category, service and restoration templates
- `4f55ef4` Build the dentists, about, address and patient guide pages
- `646bef9` Route the static Persian pages through ASCII folders
- `08348fb` Make the form-session rate limit configurable
- `28dfbc9` Check the phase 4 templates in e2e, bundle and Lighthouse
- `ba4cab9` Record the phase 4 contrast pairs, home order and gap rows
- `6930f6d` Load the scroll engine after the load event
- `a9654c2` Stop the header and footer logo from being cropped
- `9873560` Load lazy images before a full-page screenshot
- `d141d3c` Fix the phase 4 screenshot findings
- `02e1e4d` Expect the hours caveat and Persian council digits in the pages e2e
- `a8a3bf2` Compress the QA screenshots losslessly when they are written
- `6890cbe` Stop naming other insurers until the clinic confirms them
- `9bbec9c` Fix the navigation accessibility and RTL review findings
- `0210735` Decode images before a full-page screenshot

Versions: as phase 3. One new package: `@phosphor-icons/core` 2.1.1, a
devDependency. The prebuild step reads its raw SVG files into one sprite;
no icon code ships to the browser. `@gsap/react` 2.1.2 is removed: the
scroll engine now loads after `load` and needs no React hook.

What exists now, by area:

- Component library (`src/components/ui/`, 47 components): buttons, links,
  text and textarea fields, chips, badges, tags, alerts, toast, spinner,
  skeletons, empty state, success check, breadcrumbs, pagination, the
  section shell and header, the inner-page hero (family A), tile grid,
  category tile, service card, dentist card, card rail, tier comparison,
  facts row, FAQ, steps, quote, testimonial card, compare slider, hours
  badge and table, phone number, directions links, map block, media frame,
  labeled placeholder, `<picture>`, table of contents, source list, article
  meta. Every state is on the QA gallery `/qa/components` (QA routes only;
  404 in production). An ESLint rule rejects `sm:` classes: the theme
  defines no `sm` breakpoint.
- Icons: one cached sprite, `public/brand/icons.svg`, with the 30 names of
  `src/components/ui/icons.ts` (Phosphor regular, duotone for the five
  category icons, the brand mark). `<Icon>` is a server component;
  directional icons mirror in RTL. A stale hash stops the build.
- Chrome: header (one line from 1024 px, at most 72 px), the services mega
  menu (Popover API with a disclosure button; works without JavaScript),
  the drawer (modal `<dialog>`, focus trap, Esc, focus return; current
  page marked), the call
  link with the closed-hours sheet, the phone sticky bar (hides at the
  booking block and while a text field has focus), the static footer with
  disclosures on phones, the skip link, the theme button.
- Home (`/`): hero B with the compact booking card, the ten T-home sections
  in the storyboard order, at least five layout families with none used
  more than twice (T-HOME1), the restoration tier
  stepper (CSS only), the full booking form at the end. The form posts once
  (native fallback without JavaScript) and gets its session tokens and the
  hours state from `/api/form-session` after load.
- Services: hub, three category pages, the service template (every
  `docs/ia.md` T-service section, empty ones hidden) for the 17 service
  pages, the restoration page with the three tiers and the anchor
  `#سطح-ترمیم` (`/vip` lands there).
- Pages: dentists hub and profile, about, address (NAP with LTR phones,
  hours table with the live state after load, labeled static-map block,
  access-notes placeholder), patient guide hub and guide (reviewer,
  sources, table of contents on desktop), the 404 with the emergency link.
- Routing: an unknown slug under a Persian dynamic route answers the
  branded 404 (status 404, full `lang` and `dir` HTML) from the proxy. The
  five static Persian pages live in ASCII folders under
  `src/app/(site)/r/` behind an exact-path table (`PERSIAN_STATIC_ROUTES`).
- Content: one migration per adapter (`20261015_*_phase4_content`) for the
  new fields; seeded draft copy for every template; copy checks (banned
  words and labels, one label per intent, Persian letters and digits, ZWNJ,
  no em dashes, hero subtext word count) in tests and at publish time.
  `[[NEEDS_CLIENT]]` markers stay where facts are missing (10 in
  `docs/content/clinic.yaml`).
- Placeholders: every missing photo is a labeled neutral block of the exact
  ratio («جای عکس: …»). The home hero uses neutral grain rasters generated
  at prebuild (`public/placeholders/`, gitignored), so its preload and LCP
  path is the real one.
- QA fixture: `tests/fixtures/qa-seed.ts` adds one dentist, one published
  guide with a reviewer, one case and one testimonial for e2e, screenshots
  and Lighthouse only. Every visible string starts «نمونهٔ آزمایشی». It
  refuses to run unless `DATABASE_URL` names an e2e database.
- Docs: `docs/architecture.md` (images, routing, motion), `docs/brief.md`
  decision 1, `docs/ia.md` (home order, F4), `docs/design/DESIGN.md`
  (contrast pairs), `docs/conversion.md`, `docs/experience/storyboard.md`,
  `docs/seo/plan.md`, `docs/content/gaps.md` rows 44 to 53, `docs/deploy.md`
  (`FORM_SESSION_RATE_LIMIT` never in production), a correction in the
  phase 3 report.

## Decisions and deviations

### Studio decisions of this phase (the freeze)

| # | Decision | Why |
|---|---|---|
| F1 | No Motion library in phase 4. Light motion is CSS (transform and opacity, motion tokens, none under reduced motion). Native `<dialog>`, `<details>`, Popover API | JavaScript headroom was 10 KiB on content pages. Deviation from brief decision 1 wording, recorded in `docs/brief.md` and `docs/architecture.md` |
| F2 | Icons from `@phosphor-icons/core` compiled at prebuild into one sprite; `<Icon>` renders `<use>` | No icon code in client bundles; one cached file |
| F3 | Never `next/image`: its `style` attribute breaks the CSP. `<picture>` from Payload sizes. Missing photos: labeled placeholders; the home hero gets generated neutral rasters | CSP without `unsafe-inline`; a real LCP path before the photo exists |
| F4 | The digital-workflow scene is not built (its captions are unconfirmed claims, gap 48); phase 7 decides | No unverified claims |
| F5 | UI chrome copy in `src/i18n/fa-<area>.ts`; page copy in Payload, seeded from YAML | One source per kind of string |
| F6 | Home H1 is «کلینیک دندانپزشکی سفید در جنوب تهران» until gap 28 closes | «اولین» is an unverified ranking claim |
| F7 | Hero subtext at most 19 words including the free-consultation sentence; «plan and cost in the same session» left out (gap 50) | Acceptance criterion; unconfirmed promise |
| F8 | Numbers only when verified; the trust band adapts to the verified facts | No fake precision |
| F9 | No real dentists, cases, testimonials or guides yet: production hides those sections; QA uses the e2e fixture | Nothing invented on the live site |
| F10, F10b | The proxy answers an unknown slug with the branded 404. A failed fetch or a missing row falls through to the page. An empty published set is authoritative. Inside the 2 s refresh window the latest fetch decides, so a slug published under 2 s before its first visit can see the 404 for at most 2 s | `notFound()` in Next 16.4 gives an error shell without `lang` and `dir`; at launch no dentist or guide is published |
| F11 | Lighthouse in CI on home `?tier=0`, a service page and a dentist page, with the content assertions | Phase prompt deliverable 9 |
| F12 | WhatsApp CTAs hidden until `clinic.whatsappVerified` (gap 16) | Unverified number |
| F13 | Nav links to pages of phases 5 and 6 stay; phase 4 e2e does not follow them | The nav is final; the pages land later in this run |
| F14 | Hours wording everywhere «هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.» | One fact, one sentence |
| F17 | Copy checks cover the five banned labels and rich text at publish time | Copy rules enforced, not reviewed by eye |
| F18, F19 | Inputs 44 px everywhere; the whole hero card through «ثبت درخواست» sits above the sticky bar at 390x844 | Acceptance criterion; gap 7 of the styleguide |
| F20 | The focus ring is an outline | Visible in forced colors |
| F21 | Mega menu: Popover API plus a disclosure button; hover intent only as an enhancement. Drawer: modal `<dialog>` | Works without JavaScript; native focus handling |
| F22 | Page transitions deferred to phase 7 | Experience phase |
| F24 | Restoration tiers: static comparison, no preselected tier | A preselected tier would record a choice the patient never made |
| F25 | Footer disclosures with `<details>` | No JavaScript |
| F26 | No new Persian dynamic route prefixes; every public page renders per request | Phase 3 architecture |
| F27 | No inline `style` in server HTML; no Google fonts or maps; no scroll listeners; `dvh`/`svh`, never `h-screen` | CSP and master banned patterns |
| F29 | The five static Persian pages live in ASCII folders behind `PERSIAN_STATIC_ROUTES` | Next 16.4 404s a static Persian folder in a production build (see the phase 3 correction) |
| F30 | `FORM_SESSION_RATE_LIMIT` (default 60 a minute) is configurable; only e2e raises it | Every e2e test shares one localhost client |
| F31 | The trust band says «همکاری با بیمه‌ها» with the insurer names; never «طرف قرارداد» or «و سایر بیمه‌ها» until gap 51 closes | Unconfirmed contract claim |

### Deviations and changes during the build

- The scroll engine (GSAP, ScrollTrigger, Lenis) moved out of the initial
  bundle. It loads at `load`, like the canvas, and is created once per
  latched layout. Home initial JS fell from 202.4 to 153 KiB. Before, every
  one of the five home `?tier=0` runs was over 2500 ms in both themes
  (best 2641 ms light, 2658 ms dark), so the best-of-5 gate failed. After:
  best 2337 ms light and 2199 ms dark; the medians fell from 2939 to
  2640 ms and from 2865 to 2561 ms, still over 2500 ms (see Budgets). Test
  T-EX5.
- Where `docs/design-direction.md` and `docs/design/DESIGN.md` differ, the
  build follows DESIGN.md, the phase 2 system: category icons appear on
  service cards on every page (DESIGN.md "Service card"), not only in the
  services hub, and the category palette is the DESIGN.md one.
- The footer bottom row keeps the `docs/ia.md` section 3 layout (socials,
  legal lines, ©). While the socials and the legal lines are empty, the ©
  sits alone at the end edge; it reads correctly once the license number
  (gap 3) is in.
- The phase 3 logo sprite drew the logo cropped (see the phase 3
  correction); fixed in `a9654c2`.

## Verification

"Final run" below is the local run on the tree of `9bbec9c`, 2026-10-15
from 19:22 to 19:36 UTC: lint, format, typecheck, knip, check-bidi,
`npm test`, build, check-no-prerender, a fresh SQLite e2e database with the
QA fixture, the full e2e with `QA_SCREENSHOTS=phase-04`, and check:bundle.
The screenshots were taken again after `0210735`.

| What | How | Result |
|---|---|---|
| Static checks | Final run | Lint 0 problems; format, typecheck, knip and check-bidi clean. Pass |
| Unit, DOM and SQLite integration tests | `npm test`; `test:tz` in UTC, Asia/Tehran and America/Los_Angeles (run on `d141d3c`) | 122 files, 1627 tests pass (953 at the end of phase 3); test:tz 79 of 79 in each zone. Pass |
| e2e | Full `npm run test:e2e` | 463 passed, 217 skipped, 0 failed (the skips are tests bound to one viewport or theme project). Two earlier full runs failed on purpose-changed behavior: 5 assertions that still expected the full hours sentence and Latin council digits (updated in `02e1e4d`), then T-NV2b and a wrong row measure in the new T-NV10 (fixed before `9bbec9c`). Pass |
| No prerendered public HTML | `npm run build`, `scripts/check-no-prerender.mjs` | Every public route is `ƒ`. Pass |
| Acceptance: no horizontal scroll from 320 px on any template | e2e T-HOME11, T-NV6 (drawer open too), T-SV7, T-PG8 | 0 px overflow at 320 to 1920 px on every template. Pass |
| Acceptance: nav on one line from 1024 px; the drawer traps focus and closes with Esc; the sticky bar never covers content | e2e T-NV1 (one line, at most 72 px, at 1024 to 1920 px), T-NV2 and T-NV2b (mega menu by keyboard and hover), T-NV3 and T-NV3b (trap, Esc, focus return, also without JavaScript), T-NV4 (390x844), T-NV5 | Pass |
| Acceptance: axe-core zero violations on every template in both themes | e2e T-A11Y: 19 pages (every template, the 404 for an unknown service slug, the system pages, the gallery) in the six viewport and theme projects; T-HOME13 runs every axe rule on home, its error states and its success; T-PG9 landmark-unique | 114 scans, 0 violations. Pass |
| Acceptance: content-page Lighthouse budgets in both themes; home passes at tier 0 | `npm run lhci` on `/qa/not-found`, `/خدمات/ترمیم-دندان`, the fixture dentist, home `?tier=0` and `?tier=1`, 5 runs per theme, HTTPS and HTTP/2 (run `v3`, on `6930f6d`, before the screenshot fixes) | Locally every asserted URL passes in both themes; numbers in Budgets. On GitHub, run 26 failed the TBT limit on a loaded 2-core runner (see CI). Open |
| Acceptance: home hero | e2e T-HOME10 (H1 two lines from 1024 px, at most three from 360 px), HV2 (subtext at most 19 words with the flag), T-HOME2 (at 390x844 the header, the scrim and the card through «ثبت درخواست» above the sticky bar), T-HOME4 (LCP is a scrim text element under 744 px at 390x844, 430x932 and 440x956, the photo from 744 px), T-HOME7 and T-HOME9 (no layout shift when the session arrives or on success) | Pass |
| Acceptance: home uses at least five layout families, none more than twice | e2e T-HOME1 | Pass |
| Acceptance: all numbers verified or hidden; all photos real or labeled placeholders | Unit TB1, TB2 (trust band), T-PG3 (unverified numbers hidden), copy checks; every missing photo is a «جای عکس» block (gap rows 36 and 44 to 52) | Pass. The dentist, case and testimonial photos in the screenshots are the QA fixture's grey files |
| Acceptance: the service template renders every section from a seeded service | e2e T-SV3 (restoration: every T-service section in order, the tiers, the anchor), T-SV4, T-SV6 | Pass |
| Unknown slugs | e2e T-NF1 (server HTML of an unknown slug under each Persian dynamic route: status 404, `lang="fa"`, `dir="rtl"`, the branded H1), T-NF2 (published slugs still reach their template); unit PX11, PX16, PC8 to PC10 | Pass |
| Booking form markup and client validation | e2e T-HOME8, T-HOME12, T-HOME14 (one POST per submit; the failure shows), T-HOME15 (without JavaScript the form posts once) | Pass. The handler itself is phase 5; success and failure use stubbed answers |
| Tests can fail | The lanes broke the code under their key tests on purpose (listed per lane in Independent reviews). After integration: T-EX5 (a static engine import), BL1 (the old viewBox), H-NOTE2 (hoursTableNote returning the full sentence), UN7 (the compact threshold raised) | Each went red, then green after the restore |
| Bundle budgets | `npm run check:bundle` | Every page class inside its interim limit; table in Budgets. Pass |
| CI on GitHub | GitHub Actions on every push | Run 24 on `d28b787` failed at knip: the booking form placeholder of that intermediate commit had no importer yet; the next commits import it. Run 26 on `02e1e4d`: see "CI" at the end of this report |

## Budgets

Targets are `docs/brief.md` section 7. Initial JS from `check:bundle` on
the final build. Lighthouse from run `v3` on `6930f6d` (after the
scroll-engine change, before the screenshot fixes, which changed markup
and CSS only): host benchmarkIndex 2446, CPU 4x, HTTPS and HTTP/2, 5 runs
per URL and theme. LCP cells: median (min to max).

| Metric | Target | CI gate | Measured |
|---|---|---|---|
| Initial JS, home `/` | 180 KB | 215 KiB interim, route 85 KiB | 153.1 KiB: shared 142.3, route 10.8. Target met (202.4 KiB before the engine change) |
| Initial JS, content pages | 90 KB | 150 KiB interim, route 15 KiB | 142.3 to 146.8 KiB: shared 142.3 (phase 3: 139.9), routes 0 to 4.5. Target missed: the framework floor is 131.8 KiB |
| Initial JS, booking and emergency | 70 KB | 150 KiB, route 20 KiB | No page before phase 5 |
| CSS | 50 KB | 50 KiB | 12.6 KiB content, 13 KiB home |
| Fonts | 120 KB | 120 KiB | 90.1 KiB |
| LCP `/qa/not-found` | 2.5 s | best of 5 at 2500 ms (error) | light 1963 ms (1813 to 2272); dark 2262 ms (1561 to 2265) |
| LCP service `/خدمات/ترمیم-دندان` | 2.5 s | best of 5 (error) | light 2187 ms (2038 to 2657, 2 runs over); dark 2190 ms (2075 to 2498) |
| LCP dentist (fixture) | 2.5 s | best of 5 (error) | light 1895 ms (1886 to 2338); dark 1894 ms (1644 to 2038) |
| LCP home `?tier=0` | 2.5 s | best of 5 (error) | light 2640 ms (2337 to 2660, 4 over); dark 2561 ms (2199 to 2640, 3 over). The gate passes; the median misses the target |
| LCP home `?tier=1` | 2.5 s | median (warn) | light 2189 ms (2187 to 2653); dark 2643 ms (2186 to 2719): the warn fails in dark |
| TBT, content (stands in for INP) | 200 ms | 400 ms interim (error) | 404 86 and 93 ms; service 138 and 66 ms; dentist 88 and 75 ms (light and dark medians) |
| TBT, home `?tier=0` | 200 ms | 400 ms interim (error) | 218 ms light (198 to 230), 201 ms dark (183 to 215) in run `v3`; after `c83d717`: 117 and 95 ms. Target met |
| TBT, home `?tier=1` | 200 ms | none | 465 ms light, 510 ms dark |
| Lighthouse performance | 95 content, 90 home | 0.95 (warn) | content 0.97 to 0.99; home `?tier=0` 0.94 in both themes; `?tier=1` 0.85 and 0.84 |
| CLS | 0.05 | 0.05 (error) | Under 0.05 on every asserted URL (the gate passed); e2e T-HOME7 and T-PG5 assert no shift when data arrives |
| Third-party requests | none | 0 (error) | 0 |

Why home tier 0 is slow on LCP: at tier 0 the H1 on the scrim is the LCP
element on a phone, and Lighthouse's simulation counts the scripts it
evaluates before the observed first paint. The scroll-engine change
removed about 50 KiB of them. The rest is the framework and the booking
island. The best-of-5 gate passes; the median does not. Phase 7 owns the
home experience budget; its next steps are in Risks.

## Screenshots and recordings

`docs/qa/phase-04/`: 114 PNGs named `<template>-<width>-<theme>.png` for
19 templates (home, services hub, category, service, restoration, dentists
hub, dentist, about, address, guide hub, guide, the component gallery, the
404 for an unknown page and its template, 410, 500, 503, admin login and
dashboard) at 390, 820 and 1440 px, light and dark. `npm run test:e2e`
with `QA_SCREENSHOTS=phase-04` writes them; they show the e2e database
with the QA fixture. The PNGs are stored with lossless compression. No
recordings: phase 4 has no scenes.

Each of the 528 viewport-sized slices of the first set was inspected; the
findings and their outcome are under Independent reviews. The second set,
taken after the fix batch, was inspected once to confirm.

## Independent review

### Lane reviews (build, review, fix)

Each of the seven lanes was built, then read by a separate reviewer who
did not write it, then fixed in a separate pass with every fix proved by a
test that failed first. The routing change had its own review. Severity:
blocker, major, minor; lanes whose reviewer gave no label were graded by
impact.

| Lane | Findings | Key findings and outcome |
|---|---|---|
| UI | 11 (0, 4, 7) | A 52 px field size broke F18 and the hero budget (removed); the testimonial video had no captions track (required `<track>`, UK8); the toast live region was hidden while closed (always-present `role="status"`, UK9); two islands imported `Icon` (props instead, UK10). All fixed |
| CONTENT | 9 (0, 3, 6) | The free-consultation line lived outside i18n (moved); category icons not seeded (seeded); the subtext validator blocked a valid 16 to 19 word subtext (CT4). All fixed or closed at integration |
| PLATFORM | 5 (0, 1, 4) | The QA fixture could overwrite a real page on a dev database (it now refuses unless `DATABASE_URL` names an e2e database). The first review of F10 confirmed the proxy logic and flagged the bare 404 for a second unknown slug inside 2 s; the routing review fixed it. All fixed |
| CHROME | 7 (0, 2, 5) | The client `error.tsx` pulled every i18n module and `Icon` into each page chunk (about 6.2 KiB gzip; `fa-system.ts`, SC5); drawer focus on open needed hydration (`autofocus`, T-NV3b). All fixed |
| HOME | 8 (1, 3, 4) | Blocker: a JavaScript submit sent two POSTs (one fetch, native fallback only on 404 or 405; BF7b, T-HOME14). axe `landmark-unique` was filtered out (T-HOME13 runs every rule); a layout-shift test could not fail (fixed); the tier stepper preselected a tier (F24; T-HOME12, T-HOME15). All fixed |
| SERVICES | 8 (0, 3, 5) | The restoration page lacked cases and testimonial sections (fixture relinked); the H1 matched the H2 size on 7 pages (`PageHero titleSize`); the share image ignored the hero photo (`Media.defaultPopulate` without `filename`, MI4). All fixed |
| PAGES | 9 (0, 3, 6) | `LiveHours` pulled `Icon` into the address chunk (LH4); the dentist form posted an empty dentist; the hours block dropped the holiday exception. All fixed |
| Routing (F10b, F29) | 1 (0, 1, 0) | An empty published set let every slug reach the page, so at launch the dentist and guide routes would answer the bare error shell (fixed: an empty set is authoritative; PC8, PX16). Verified clean: no direct `/r/*` access by encoding, case, dot segments, `//`, RSC, HEAD or POST; no open redirect; canonical, `og:url` and sitemaps stay Persian |

Totals: 58 findings (1 blocker, 20 major, 37 minor), all fixed. The fix
passes were not reviewed a second time; the full e2e suite and the
screenshot inspection below cover them.

### Screenshot inspection (prompt step 4)

Five inspectors read the 528 slices of the first set, one per template
group. Findings: 56 (1 blocker, 8 major, 47 minor); the logo and the
duplicated hours line were reported by several groups and are listed once
below.

Fixed in one batch (`a9654c2`, `d141d3c`):

- Blocker: the header, drawer, footer and admin logo was cropped (phase 3
  sprite; BL1).
- Major: the kids and ortho category icons lost their faces in dark; the
  error border of a field was 2.84:1 in dark; skeletons were 1.05:1;
  pagination wrapped at 390 px; a standalone home category tile showed no
  summary; a single dentist card showed a peek strip and a half-empty row
  on phones (the rail now gives one card the row, up to 24rem); the 4:3
  picture specimen was empty (lazy image never loaded in
  the full-page capture; the helper now loads every image first).
- Minor: the hours sentence repeated the table rows (now only the holiday
  caveat, H-NOTE2); Latin digits in the council number; an odd last fact sat alone in a
  half-empty row; card title sizes differed between category tiles and
  service cards; the footer phones had no icon; the FAQ bottom rule
  floated; the guide hub's «همهٔ خدمات» sat as the guides list action; the
  empty-state mark was invisible; two gallery captions and the gallery
  phone hint.

Kept as designed, with the reason:

- Category accents on service cards outside the hub: DESIGN.md (phase 2)
  supersedes design-direction.md here.
- The warm booking band (`--color-warm-soft`, dark #2A2419): DESIGN.md
  "warm stage behind the booking and first-visit scenes".
- Fewer cards than columns leave the row start-aligned (dentists,
  testimonials, cases with the one-item fixture); a real clinic has more.
- The © alone at the end edge of the footer row: `docs/ia.md` section 3
  layout, filled once the license number arrives (gap 3).
- Three equal tier columns: F24 (no preselected tier).
- The guide's reading column keeps its measure on tablets, where the table
  of contents is hidden; 404 and 500 stay one column (phase 3 layout).
- The 500 page's error code is the Next.js digest in Latin digits inside an
  LTR island: it must match the server log line.
- The tier cards scroll at 820 px with a peek of the third card (the
  scroller of DESIGN.md "Tier comparison").
- A chip wrapping alone onto a second row, a textarea resize grip, the
  compare-slider divider over placeholder images, the gallery's nested
  hero: cosmetic or gallery-only.

Confirmation round on the second set: 9 of 10 fixes confirmed. The
pagination fix had regressed: it used the `sm` breakpoint, which
`globals.css` does not define, so Tailwind wrote no CSS for it and the
unit test (which checked class names only) passed. Fixed with `md`; a lint
rule now rejects any `sm:` class, and e2e T-NV10 checks the one-row layout
at 320, 390, 743, 744 and 1440 px in a browser. One 1440 px capture of the
4:3 specimen was still blank; see the final screenshot check.

### Navigation accessibility and RTL (prompt step 5)

Three reviewers read the chrome with distinct lenses (keyboard and focus,
assistive-technology semantics, RTL); a separate skeptic per lens tried to
refute each finding. 13 findings: 12 confirmed, 1 refuted.

| # | Finding | Outcome |
|---|---|---|
| S1 (major) | The static 503 and `maintenance.html` drew the link focus as a box-shadow with `outline:none`; forced colors remove box-shadows, so focus was invisible | Fixed: an outline, as F20 |
| S2 | Drawer rows and mega-menu links never marked the current page; on phones the drawer is the only primary navigation | Fixed: `NavLink` (aria-current) plus a visible weight and color |
| S3 | The theme button's name was an action («تغییر پوسته») with `aria-pressed`, so "pressed" did not say which theme is on | Fixed: the name is the state, «پوستهٔ تیره» |
| S4 | The current-page bar was a background, which forced colors remove | Fixed: a 2 px border |
| S5, K6 | On `/`, the drawer logo (a next/link to the same path) left the modal open | Fixed: a plain link like the other rows |
| K1 | A hover-opened menu closed 300 ms after the pointer left even with keyboard focus inside it | Fixed: no hover close while focus is inside; e2e T-NV11 |
| K3 | Card rails and tier comparisons stay a tab stop from 1024 px, where they do not scroll | Accepted: below 1024 px they scroll and some rails hold no focusable card (the testimonial posters), so the region must take focus there; from 1024 px it is one extra named stop |
| K4 | Closing the drawer by widening past 1024 px sent focus to `<body>` (the menu button is hidden there) | Fixed: focus goes to the header home link; CB9 |
| K5 | `<main tabindex="-1">` took focus on every click into its text, so the next Tab restarted at the top | Fixed: main is focusable only while the skip link moves focus to it; CB8, T-SM3 |
| R1 | The pagination `sm:` classes generated no CSS | Fixed (see above) |
| R2 | The booking success list used `ps-5`, outside the reset spacing scale, so it had no indent | Fixed: `ps-6` |
| K2 (refuted) | Without JavaScript the open mega menu stays over the page while Tab moves into main | Refuted: WCAG 2.4.11 allows content the user opened when Esc reveals the focus; F21's no-JS baseline |

While writing this report, a read of the seed copy against freeze F31
found «و سایر بیمه‌ها» still in the home FAQ answer, the about page and a
gallery caption (gap 51 forbids it until the client confirms). Fixed: the
copy now says the clinic works with the five insurers; copy tests SC3 and
CP1 reject «طرف قرارداد» and «سایر بیمه» in every seeded and UI string.

Checked and correct: skip link order and target, header Tab order in RTL,
mega menu Enter, Space and Esc without script, focus return, light
dismiss, the drawer's trap and Esc, the closed-hours sheet over the
drawer, the inert hidden sticky bar, scroll padding under the header and
above the sticky bar, unclipped focus outlines, landmarks, LTR islands,
mirrored directional icons, logical properties.

## Content gaps added or closed

- Added rows 44 to 53 in `docs/content/gaps.md`: 44 service page photos
  (18 pages), 45 hub and category hero photos, 46 address and wayfinding
  photos, 47 the static map image (in-house from the coordinates of row
  38), 48 the digital workflow (scanner, on-screen design) and its photos,
  49 team and sterilization photos, 50 the first-visit promise «در همان
  جلسه …» (left out of the hero, F7), 51 whether the five insurers are
  contracted (F31), 52 the home services tile photo (with written patient
  consent), 53 Persian captions for the testimonial videos (the collection
  needs a captions field before a video can be published).
- Updated: row 4 (photo placements split into rows 36, 44 to 46, 48 and
  49), row 8 (the home FAQ answer on instalments stays neutral), row 28
  (the fallback H1 is seeded; the slogan waits), row 41 (in-house draft
  seeded; the client approves).
- Closed: none. Still open and tied to this phase: rows 2 (dentists), 3
  (license and supervisor), 16 (WhatsApp number), 28, 36 (home hero photo),
  41, 42 (medical reviewer), 44 to 53.

## Risks and open questions

Questions for the client (five, in plain words):

1. Can you show evidence that Sefid is the first digital clinic in south
   Tehran? If not, may the site use «اولین کلینیک دیجیتال جنوب تهران» as a
   slogan at your own risk, or do we keep the plain title (gap 28)?
2. In the first visit, is the patient examined and told the treatment plan
   and the cost in the same session (gap 50)?
3. Are Iran, Karafarin, Pasargad, Alborz and Ma insurance contracted with
   the clinic, or does the clinic only accept their claims (gap 51)?
4. Does the clinic scan teeth with an intraoral scanner and design the
   treatment on screen? If yes, we need four photos of it (gap 48).
5. Is 0920 545 1054 the clinic's WhatsApp number (gap 16)?

Hand-off requests (phase prompt): review the screenshots in
`docs/qa/phase-04/` and approve the structure and the copy direction; the
labeled neutral blocks are where your photos go; the look and motion of
the home experience are judged in phases 7 and 8. Confirm the plain media
frame of the inner-page hero on `service-1440-light.png`. Missing photos by
placement, the home hero first: home hero (gap 36), service pages (44),
hubs and categories (45), address and wayfinding (46), team and
sterilization (49), the home services tile (52), dentist portraits (2).

Engineering risks:

- Home LCP at tier 0: the best-of-5 gate passes, but the median is 2561 to
  2640 ms locally, over the 2.5 s target. TBT met its target after
  `c83d717` (95 to 117 ms locally). The framework (142.3 KiB shared JS) and
  the booking island are most of the remaining cost. Phase 7 adds the experience and must not add initial JS; options
  are an earlier first paint of the scrim text and a smaller booking
  island.
- Class names without CSS: two utilities outside the reset scales (`sm:`
  and `ps-5`) built silently. A lint rule now blocks `sm:`; a build-time
  check of every class literal against the built CSS is planned for the
  phase 9 quality gate.
- Browsers: the chrome relies on the Popover API, `<dialog>`, Invoker
  Commands with a fallback, `:has()` and `::details-content`; e2e runs in
  Chromium only. Safari and Firefox are checked by hand in phase 9.
- Routing: a slug published less than 2 s before its first visit can see
  the branded 404 for at most 2 s (F10b). Phase 6 draft preview must skip
  the slug check. Persian page responses carry `x-middleware-rewrite` with
  the internal `/r/...` path; `docs/deploy.md` 2.5 tells the reverse proxy
  to strip it.
- PostgreSQL: CI migrates PostgreSQL 16 and runs the integration suite
  and the e2e suite on it; the local runs above use SQLite. A migrate down
  step is not exercised on either adapter.
- The phase 3 risks stand (hosting decision, HTTP/2 at the host, Iran
  internet shutdowns, memory per upload, npm advisories in Payload's tree).

## Prerequisites for the next phase

Phase 5 (conversion) can start: the booking form markup, its validation,
the form session and the nav links to the booking, pricing and emergency
pages exist. It needs the booking handler, the emergency page and the
pricing page, and nothing from the client to start. The answers to the
five questions above change copy only.

## CI

Run 38790379668 on `02e1e4d` (the code of phase 4 before the navigation
review fixes): the unit job passed (lint, format, types, knip, bidi,
coverage, test:tz, SQLite integration, audit). The second job passed the
generated-file drift check, the PostgreSQL 16 integration suite, migrate
and seed, the build, check-no-prerender, the full e2e suite on PostgreSQL
and check:bundle, then failed at Lighthouse on TBT alone. Every LCP gate
passed. Runner: benchmarkIndex 2102, 2 cores, load average 2.67 (1 min)
and 4.34 (5 min) when Lighthouse started, left over from the e2e step.

| URL | TBT median light | TBT median dark | Locally (light, dark) |
|---|---|---|---|
| `/qa/not-found` | 372 ms (278 to 435) | 380 ms (321 to 446) | 86, 93 ms |
| `/خدمات/ترمیم-دندان` | 394 ms (303 to 512) | 420 ms (379 to 434): over 400 | 138, 66 ms |
| dentist (fixture) | 464 ms (231 to 541): over 400 | 439 ms (367 to 614): over 400 | 88, 75 ms |
| home `?tier=0` | 555 ms (525 to 636): over 400 | 622 ms (550 to 663): over 400 | 218, 201 ms |

The 404 page changed little in this phase (shared JS 139.9 to 142.3 KiB),
yet its CI TBT is at the top of the phase 3 range (127 to 372 ms on
earlier runners), and the same code measures 4 times lower on the 4-core
local host. Following the phase 3 procedure for a red TBT gate, the first
step is the runner load: the Lighthouse step now waits up to 3 minutes for
the 1-minute load average to fall under 1 before it measures (`ci.yml`,
"Runner load before Lighthouse"). The limits are unchanged.

Run 38796456379 on `92664c0` (the runner waited 55 s for the load to fall
to 0.98; benchmarkIndex 1954) was still red on TBT alone: 404 387 and 341
ms, service 388 and 405, dentist 440 and 373, home `?tier=0` 612 and 600.
So load was not the main cause. A trace comparison on the local host
against an empty Next.js 16.4 page, in interleaved runs, showed that a
local CPU slowdown of 8x reproduces the CI numbers for the content pages:
there the framework floor alone blocks about 160 to 210 ms of the 400 ms
limit. It also found three costs of our own and removed them in
`c83d717`: a module-scope `Intl.NumberFormat` (about 10 ms in hydration on
every page that formats numbers), the GPU probe at load when the tier is
already fixed at 0, and the scroll engine evaluated and measuring the page
at tier 0, where it builds nothing. Local home `?tier=0` TBT fell from 218
and 201 ms to 117 and 95 ms.

Run 38814171802 on `c83d717` passed both jobs (benchmarkIndex 2544, load
0.99 at the start of Lighthouse; e2e 463 passed, 217 skipped):

| URL | TBT median light | TBT median dark | LCP best of 5 light, dark |
|---|---|---|---|
| `/qa/not-found` | 252 ms (222 to 283) | 253 ms (223 to 311) | 1813, 1815 ms |
| `/خدمات/ترمیم-دندان` | 215 ms (199 to 490) | 325 ms (244 to 390) | 2197, 1970 ms |
| dentist (fixture) | 231 ms (184 to 391) | 209 ms (195 to 223) | 1900, 1905 ms |
| home `?tier=0` | 215 ms (170 to 321) | 235 ms (156 to 360) | 2268, 2055 ms |

The content pages stay close to the 400 ms limit on slow runners (run 27
was red on a 1954 runner). If the gate turns red again on TBT alone, the
options are a TBT gate measured against an empty Next.js page in the same
job, or a 4-core runner, which costs money and is the client's decision.
