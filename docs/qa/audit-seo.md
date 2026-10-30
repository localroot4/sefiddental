# SEO crawl audit (phase 9)

Date: 2026-10-30. Runs on the build of `9948d21` with this lane's changes (the series is rebased on
`8ada965`, which changes no server HTML). The crawl reads the HTML a search engine reads first:
plain `fetch`, no JavaScript, from `/robots.txt`, `/sitemap.xml` and home, following every
internal link.

## 1. Tool

`node scripts/crawl.mjs <origin>` (tests: `scripts/crawl.test.ts`, T-CR1 to T-CR20). The server
must run with `ALLOW_INDEXING=true`: staging is noindex everywhere and lists no sitemap URL, and
the crawl says so. Exit 0 with no problem, 1 otherwise; warnings print and never fail.

| Rule | Source |
|---|---|
| One H1 | `docs/seo/plan.md` 3 |
| Title at most 60 code points (NFC, ZWNJ counts); under 50 is a warning; page 2 and up of a list are exempt (the code adds «، صفحهٔ N») | plan 3, `src/fields/validators.ts` V-TITLE and C24 |
| Meta description 120 to 160 code points | plan 3, V-DESC |
| Titles and descriptions unique among indexable pages; later list pages may repeat the list description | plan 3 |
| Indexable page: canonical and `og:url` are the page itself | spec 9.3 |
| `og:title`, `og:description`, `og:image`, `og:type`, `og:locale` = `fa_IR`, `twitter:card` | spec 9.2 |
| JSON-LD parses and passes the graph checks of T-SD (`tests/helpers/jsonld.ts` `graphProblems`: one schema.org `@graph`, `@id` references resolve, absolute URLs, ISO dates, breadcrumb positions); `Dentist` and `WebSite` on every page | plan 4, phase 6 H15 and C4. The `schema-dts` types check the builders at compile time (`src/lib/seo/jsonld.ts`); the crawl checks what renders. |
| Inner pages: a `BreadcrumbList` ending at the page and the visible «مسیر صفحه» trail | plan 3 |
| Home: each `data-home-section` carries its heading (or, for the facts band, a named list) in the server HTML; every `aria-labelledby` names an element in the server HTML | phase 7 |
| No broken internal link and no internal link to a redirect | plan 7.4 |
| No orphan: every page has an internal link from another page | plan 3 |
| robots.txt names `/sitemap.xml`; every sitemap URL answers 200, is indexable and not disallowed; every indexable page is in the sitemap | spec 9.4 |
| Sitemap URLs have clean Persian slugs: Persian letters, digits and ZWNJ in words joined by single hyphens, no Arabic ي or ك | plan 3, `src/lib/persianSlug.ts` |
| Redirects: the seeded `/vip` alias answers 301 to the restoration tiers; with `--old-urls <csv>` each imported row answers its status (301 by default, 302, 410) and target | plan 7 |
| No `NEEDS_CLIENT`, «فرضی», «طرح نمایشی» or «نمونهٔ آزمایشی» in the HTML | phase 9 plan 5.3 |

Two flags relax one rule each and are for the named database only:

- `--demo`: the DEMO_CONTENT preview, where «فرضی» and «طرح نمایشی» label the stand-ins
  (`src/lib/demoContent.ts`). The live site refuses DEMO_CONTENT (`src/lib/env.ts`).
- `--qa`: the e2e database. The QA fixture marks its rows «نمونهٔ آزمایشی» and gives its fourteen
  articles one description on purpose, so fixture pages skip the uniqueness rule.

Deviation from the plan: «نمونه» alone is not banned. It is ordinary Persian («برای نمونه» in the
orthodontics copy) and the cases pages use «نمونه‌های قبل و بعد». The crawl bans the QA marker
«نمونهٔ آزمایشی» (with or without ZWNJ or «ی») instead.

## 2. Results

Both runs on the standalone build of this commit, `ALLOW_INDEXING=true`, `SITE_URL` equal to the
origin.

| Database | Command | URLs | Pages | Problems | Warnings |
|---|---|---|---|---|---|
| `npm run db:live` (launch shape, DEMO_CONTENT off) | `node scripts/crawl.mjs http://localhost:3300` | 32 | 32 | 0 (7 before R1) | 14 |
| `npm run db:e2e` (QA fixture), `QA_ROUTES=1` | `node scripts/crawl.mjs http://localhost:3300 --qa` | 57 | 56 | 1 (R2) | 18 |

The 14 warnings on `db:live` are titles of 34 to 48 code points (about, privacy, address,
booking, pricing, the services hub, the three categories and five services). C24 makes a short
title a warning, never a block: the keyword map chose these topics. Lengthening them is an SEO
pass after launch, with Search Console data.

## 3. Defects

| # | Defect | Fix |
|---|---|---|
| R1 | Seven indexable pages on `db:live` (services hub, about, address, booking, three categories) and three hubs that index with their first item (dentists, guides, articles) fall back to the home description: no SEO description and no lead of 120 to 160 characters. | Ten descriptions in the seed (`src/seed/data/pages.yaml`, `docs/content/services.yaml`; categories gain `seo_description` in `src/seed/schemas.ts` and `transforms.ts`): patch 6 of this lane, out of lane, for the integrator. The server seeds in create-only mode, so the preview needs the same ten texts typed in «توضیح سئو» (or a reviewed sync). |
| R2 | With a published case, home, the service page and the dentist page link «همهٔ نمونه‌ها» and the case thumbnails to `/قبل-و-بعد`, which has no route (404). Live has no case today (gap 6). | Not in this lane's files: `p9/findings/seortl.md` R2 gives the exact fix (drop the links until the cases template ships). |
| R3 | A dentist page used the home description unless the admin filled «توضیح سئو». | Patch 2: the bio when it is 120 to 160 characters, as the other templates do. |
| R4 | No crawl existed; `tests/fixtures/old-urls.csv` is a parser fixture with deliberate bad rows (loops, chains, foreign hosts, 410 in Persian digits), not the old site's URLs, so it cannot be checked for 301s on any database. | Patch 1 adds the crawl. It checks the seeded `/vip` alias on every run and an imported old-URL list with `--old-urls`. |

## 4. Old URLs (gap 11)

- `.github/workflows/old-urls.yml` («Old URLs», run by hand): reads the old sitemap and its child
  sitemaps from a GitHub runner (outside Iran) with `node scripts/crawl.mjs --old-sitemap <url>`
  and uploads `old-urls.csv` (from, to, status; `to` empty) as an artifact for 30 days. The admin
  fills `to` with the closest new page (never home in bulk, plan 7.2) and imports it.
- After the import: `node scripts/crawl.mjs https://sefiddental.ir --old-urls old-urls.csv`
  checks every row's answer.
- Not run yet. The workflow is not triggered from this lane. From this host the one allowed read
  of `https://sefiddental.ir/sitemap.xml` (2026-10-30) failed with a connection reset (plan
  fact 7), so no CSV exists. The parser was checked against a local stand-in of a WordPress-style
  site (a 301 from `/sitemap.xml` to a sitemap index, a CDATA child, an image sitemap entry, a
  query URL): four rows, home dropped. If the old host also refuses GitHub's runners, the
  workflow fails with the status in its log; then the list comes from the client's backup (gap
  11) or from Search Console after launch.
