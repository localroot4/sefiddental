# Architecture (v2, Next.js)

Binding for phases 3-10. Replaces the Laravel plan after the client chose a
Next.js and WebGL experience. Phase 3 refines it into code and may update
this file in the same commit.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4.3 with React 19.3.0, App Router, TypeScript 5.9.3 strict, on Node.js 22 (22.23.4 or later) | Server components by default; client islands only where behaviour needs JavaScript, and for WebGL. TypeScript 5.9.3 is the version verified with Payload 3.92.0 and the lint toolchain |
| CMS | Payload CMS 3.92.0 inside the same Next.js app, admin at `/giris` (`ADMIN_ROUTE` in `src/lib/paths.ts`; `/admin` is an ordinary 404), locale `fa`, RTL | Collections, drafts and versions, scheduled publish, access control, media with sharp, live preview |
| Database | PostgreSQL (Payload Postgres adapter) on a PaaS or a VPS; Payload's SQLite adapter on cPanel paths (C2) | The data model is identical; the adapter is an environment setting, and the confirmed hosting path (section 2) sets it |
| Styling | Tailwind CSS 4.3.3 with `@theme` tokens from `design/tokens.css`; CSS modules for complex scenes | one token file, no ad-hoc colors |
| UI motion | CSS transitions on transform and opacity with the motion tokens of `design/tokens.css`; native `<dialog>`, `<details>` and the Popover API | no motion library (phase 4: the JavaScript headroom, 10 KiB on content pages and 19.5 KiB on home, leaves no room for one); zero motion under `prefers-reduced-motion` |
| Scroll engine | GSAP 3.15.0 (ScrollTrigger, Flip, MorphSVG, Draggable, InertiaPlugin) plus Lenis 1.3.26 | one master timeline per page; see `docs/experience-direction.md` |
| WebGL | three.js r186 (0.186.1), `@react-three/fiber` 9.8.1, `@react-three/drei` 10.7.9, `@react-three/postprocessing`; WebGL 2 with WebGL 1 fallback for tier 1 | KTX2 textures, Draco glTF, one `<Canvas>` fixed behind the page |
| Quality tiers | `detect-gpu` 5.0.70 plus an in-house frame-time monitor (`src/experience/tier/frameMonitor.ts`: under 55 fps for 2 s drops one tier) and a per-tier DPR cap (`TierDpr.tsx`, not drei's `AdaptiveDpr`) | tiers 0-3 per `docs/experience-direction.md` section 3 |
| Fonts | Vazirmatn and Estedad via `next/font/local`, subsets, swap | preloaded |
| Icons | Phosphor, from the raw SVG package `@phosphor-icons/core` (devDependency) compiled at prebuild into one sprite, `public/brand/icons.svg`, holding only the names in `src/components/ui/icons.ts` | one family; `<Icon>` is a server component (`<svg><use href>`), so no icon JavaScript reaches the client |
| Dates | `date-fns-jalali` 4.4.0-0 for display; store UTC | Asia/Tehran |
| Email | Nodemailer (`@payloadcms/email-nodemailer` 3.92.0) through the host's SMTP | admin notifications; without SMTP no reset mail is sent (the log shows only the recipient and subject); recovery is `npm run reset-admin -- <email>` |
| Tests | Vitest 5.0.4 (unit), Playwright 1.64.0 (e2e, screenshots, frame timing), axe-core (`@axe-core/playwright` 4.13.0), Lighthouse CI 0.15.1 | all in GitHub Actions |
| Lint | ESLint 9.39.5, Prettier 3.9.10, TypeScript `--noEmit`, `knip` 6.41.0 for dead code | CI gate |

Phase 3 pins every version exactly in `package.json`. Other pinned runtime
packages: `payload-totp` 3.0.6 (MFA, section 8), zod 4.6.7 (validation),
sharp 0.35.5 (media), pino 9.14.0 (logs), yaml 2.9.1 (seeders).
`@phosphor-icons/core` (phase 4) and `@react-three/postprocessing` are
pinned by the phase that first uses them.

## 2. Hosting and deployment

A Next.js app with Payload needs a Node.js runtime that stays running, a
database and writable media storage. The client wants to avoid new hosting
cost, so the order of preference is: the client's existing cPanel server if
it can run Node dependably, otherwise a Node PaaS. Phase 3 decides with a
15-minute probe, in this order:

| Path | When it applies | Cost | How it runs |
|---|---|---|---|
| **C1: the client's own server through WHM** | WHM gives root SSH (a VPS or dedicated server with a cPanel license) | none | Install Node 22 LTS and PM2, run the built Next.js app as a service behind Apache or Nginx (cPanel's proxy or an Apache `ProxyPass` include), PostgreSQL from the system packages or Payload's SQLite adapter, media on local disk, cron from the system |
| **C2: cPanel "Setup Node.js App"** | shared or reseller cPanel on CloudLinux with the Node.js Selector (Passenger) and Node 20 or newer, at least 1 GB of memory for the account | none | Build in GitHub Actions (the server never runs `next build`), deploy the standalone output over SSH or cPanel Git, Passenger runs `server.js`; Payload with the SQLite adapter (one file, backed up nightly; a clinic site writes a few rows a day) or MySQL if Payload's adapter is stable at build time; media on disk under the account; cron through cPanel hitting a route |
| **A: Node PaaS inside Iran** | neither C1 nor C2 passes the probe | a small monthly fee | Liara first, ArvanCloud second: Docker platform running the standalone build made in CI (`docs/deploy.md` 1.4), managed PostgreSQL, object storage, deploy from GitHub Actions |

Probe checklist for phase 3 (the client runs it with the agent, or shares
the host name so the agent reads the provider's documentation):

1. WHM: is there root terminal or SSH access? (C1)
2. cPanel, Software section: is "Setup Node.js App" present, and which
   Node versions does it list? (C2)
3. Account limits (cPanel left column or WHM package): memory, processes,
   disk.
4. From outside Iran: does a test page on the server load? (risk R1)
5. Can GitHub Actions reach the server over SSH, or can cPanel Git pull from
   GitHub? (deploy path)

Whatever passes first wins. Static export (B, below) is the last resort and
needs a separate PHP service for bookings and content, so it is not
recommended.

**Option A: Node PaaS inside Iran.** Liara (liara.ir) or
ArvanCloud PaaS, both with container platforms, managed PostgreSQL and
object storage. Deploy from GitHub Actions on push to `main` (a Docker image
through the Liara CLI); environment variables in the platform; media in
object storage (S3 compatible) with a CDN. Low latency for Iranian visitors;
international inbound stays open for Googlebot (confirm with the provider).
Cost: a small monthly fee the client approves.

**Option A2: the client's WHM server, if it is a full VPS.** Install Node LTS
and PostgreSQL, run the app with PM2 behind Apache or Nginx as a reverse
proxy, deploy with GitHub Actions over SSH. Works, but the client's team
then owns the server.

**Option B (fallback, not recommended for this ambition): cPanel static.**
Next.js `output: 'export'` for the public site, deployed to cPanel as static
files; a separate small PHP API on cPanel for bookings; content still needs
a CMS somewhere, and every publish needs a rebuild that fetches content
across the Iran border. Slow content updates and fragile builds.

Phase 3 runs the probe above, records the facts in `docs/deploy.md`, and
asks the client to confirm the path before writing deploy code.

Status on 2026-10-13 (gap 32): on 2026-10-12 cPanel showed the Node.js
Selector but no installed Node version (probe step 2). The ticket that asks
the host to enable Node 20 or 22 has no answer. Phase 3 starts now and
stays host-agnostic (brief decision 21): every deliverable runs on
environment-driven configuration (database adapter, media storage, base
URL). The deploy pipeline (phase 3 deliverable 9), the staging target and
the chosen-path steps of `docs/deploy.md` wait until the client confirms
the path. If the host has not answered by the end of the phase 3 build, the
phase 3 hand-off asks the client to choose C1 or A. Hosting must be settled
before phase 7, because the phase 7 hand-off needs a staging URL that the
client opens on a phone.

Update on 2026-10-13: the host answered that it does not support Node.js,
so C2 at the current host is out. The client offered to buy a Node host.
A shared cPanel "Node.js host" does not qualify: such plans list Node 19 or
older (the app needs Node 22.23.4 or later, `package.json` `engines`),
Passenger loads CommonJS while Payload is ESM, and they usually have no
PostgreSQL (Payload has no MySQL adapter). The studio recommends path A on Liara; `docs/deploy.md` records
the probe facts and the purchase list. Deploy code waits for the client's
approval of the priced path (brief decision 21).

Deployment pipeline (option A): CI runs lint, types, unit tests, build,
Playwright smoke, Lighthouse budgets; on success deploys; Payload migrations
run on release; the previous release is kept for one-command rollback.

## 3. Request handling and URLs

- `<html dir="rtl" lang="fa">`. Locale-prefixed routing is prepared
  (`/` Persian, `/en` reserved) without exposing a second language.
- Persian slugs in route segments; a `persianSlug()` utility (normalize
  Arabic ي and ك, strip diacritics, hyphenate whitespace, keep Persian
  letters and digits) used by Payload `beforeValidate` hooks; slugs editable
  in admin and unique per collection; a slug change writes a 301 into the
  `redirects` collection.
- Old-URL import (phase 6, H19): `POST /api/redirects/import` serves a
  TOTP-verified admin only and takes JSON only (a cross-site form cannot
  send JSON without a preflight). The parser accepts a comma, a semicolon,
  a Persian semicolon («؛») or a tab as the separator. A dry run returns
  the plan and its sha256 digest and writes nothing. Apply plans again and
  writes only when the digest still matches, so it writes the rows the
  admin saw. Rows go through the collection's normal hooks with source
  `import`, one at a time. SQLite has no transaction here: a failure stops
  the run and names the line, and a rerun is idempotent (rows already
  written come out `unchanged`). A CSV row is never written over a row
  whose source is not `import`, such as the `/vip` alias or a slug-change
  redirect (C27). Chain repointing and flattening keep a `#anchor` (H20),
  so `/vip` keeps its tier anchor after a slug change.
- Persian dynamic routes (phase 3 change): Next.js 16.4 never matches a
  dynamic segment under a Persian folder in a production build (it builds
  the route pattern from the raw Unicode folder name and tests it against
  the percent-encoded path). Each Persian dynamic route therefore renders
  from an ASCII folder under `src/app/(site)/r/`, and the proxy rewrites the
  public path through one table (`PERSIAN_DYNAMIC_ROUTES`, read by
  `routeRewrite` in `src/lib/http/proxyRules.ts`): `/خدمات/<slug>`
  (services and categories) from `r/services`, `/پزشکان/<slug>` from `r/doctors`, `/مقالات/دسته/<slug>`
  from `r/article-categories`, `/مقالات/برچسب/<slug>` from `r/tags`,
  `/مقالات/<slug>` from `r/articles`, `/راهنمای-بیمار/<slug>` from
  `r/guides`. Only one segment after the prefix rewrites. A direct request
  under `/r/` gets the 404, so the internal paths never duplicate content.
  Canonical URLs, sitemaps and redirects keep the Persian path.
- Persian static pages (phase 4 change): static Persian folders are 404 in
  a production build too. Next finds the folder by its decoded path, but
  looks its route definition up by the percent-encoded path, so the render
  step matches nothing. Every page of `PAGE_PATHS` except home and the
  guides therefore renders from `src/app/(site)/r/<folder>/page.tsx`
  through a second, exact-path table (`PERSIAN_STATIC_ROUTES` in
  `src/lib/http/proxyRules.ts`): `/خدمات` from `r/services`, `/پزشکان`
  from `r/doctors`, `/راهنمای-بیمار` from `r/guides` (each hub beside its
  `[slug]` folder), `/درباره-ما` from `r/about`, `/آدرس` from `r/address`;
  later phases add `r/cases`, `r/pricing`, `r/emergency`, `r/booking`,
  `r/booking/success`, `r/privacy` and `r/articles`. No folder under
  `src/app/(site)/` has a Persian name (unit test R9).
- Canonical without trailing slash; `www` to apex; HTTP to HTTPS; query
  strings canonicalize to the base URL (gallery filters, booking params).
- Rendering (phase 3 change, replaces "static or ISR"): every public HTML
  response renders per request, so it carries a fresh CSP nonce (section 8)
  and never needs `unsafe-inline`. Data reads are cached and tagged instead
  (`unstable_cache`, kept while `cacheComponents` is off; entries live in
  process memory only, so a restart starts cold and never serves an old
  value). Payload save hooks revalidate the tags, never paths: content
  collections with the `max` profile (the first request after a save may
  still get the old version while it refreshes), the globals and
  `redirects` with `{ expire: 0 }`, so phone, hours and redirects change on
  the next request. Home keeps its client islands. Pages with an inline form
  (home, address, content pages with a booking block) still never carry the
  CSRF token, the signed time token or the hours state in their HTML; they
  fetch them from the `no-store` endpoint `/api/form-session`
  (`docs/conversion.md` section 6). The booking and emergency pages are
  dynamic (`no-store`). TTFB is measured on the chosen host.
- Readers (phase 6, `src/lib/data/`): `getPublished` takes an optional
  Payload `select` (typed with `TransformCollectionWithSelect`), so a list
  reads only its card fields and keeps its cache entries small.
  `getPublishedPage` is its paged sibling: it returns one page with
  `totalPages` and `totalDocs` (the article lists, 12 a page). A read with
  a depth above 0 over a `richText` field also carries the `col:` tags of
  the editors' link and upload collections (services, articles, pages,
  doctors, media), so a linked page's slug change refreshes it.
  `getPublishedSlugs` keeps only the article categories and tags that have
  a published article (H4), so the proxy answers the 404 for the others.

## 4. Data model (Payload collections and globals)

| Collection | Key fields |
|---|---|
| service-categories | title, navLabel, slug (nullable for standalone), accent, icon, order, seo |
| services | category, navLabel, h1, seoTitle, slug, bookingGroup, emergencyLink, summary, body (blocks), priceFrom (nullable), duration, sessions, faqs (array), related, priority, reviewedBy (doctor), reviewedAt, `_status`, seo |
| service-tiers | service, name, description, materials, highlights, priceFrom, order |
| doctors | name, slug, specialty, specialtyConfirmed (board), councilNumber, degrees, bio, photo, order, services, `_status`, seo |
| articles | title, slug, excerpt, body (rich text with media), cover, category, tags, author (doctor or staff), reviewer (doctor), sources (array), readingTime, publishedAt, contentUpdatedAt, `_status`, reviewState (writing, in review, approved), seo |
| article-categories, tags | title, slug, description, seo |
| testimonials | patientLabel, service, type (video or text), media, poster, quote, consentConfirmed, order, `_status` |
| cases | title, service, before, after, notes, consentConfirmed, order, `_status` |
| bookings | phone (E.164), name, service, tier, doctor, preferredTime, note, kind (regular or emergency), triage, emergencyOutcome, status (new, contacted, scheduled, done, cancelled, spam, suspicious), flags, heardFrom, sourceUrl, utm, device, ipHash, adminNotes, handledBy, handledAt |
| insurances | name, logo, featured, order |
| financing-options | title, provider, maxAmount, surchargeNote, terms, enabled |
| pages | key, title, slug, blocks, seo |
| redirects | from, to, status, hits, lastHitAt |
| events-daily | date, event, location, pageType, serviceKey, count |
| media | upload with required alt, focal point, sharp conversions (AVIF, WebP, sizes), LQIP |
| users | admin and editor roles |
| audit-log | action, entitySlug, docId, docLabel, changedFields (field paths, never values), statusFrom, statusTo, actor, actorRole, requestId, ipHash |

Globals: `clinic` (name, NAP with the coordinates as two number fields
`address.lat` and `address.lng`, phones, socials, hours with holiday
overrides, legal: license and supervisor), `seo-defaults`, `features`
(financing toggles, emergency, intro, analytics id, quality tier override),
`notifier` (drivers and test action), `system-state` (the last cron run for
the status view; hidden, admin read only, no versions, not seeded).

Phase 3 changes to this model (the configs in `src/collections/` and
`src/globals/` hold the full field lists):

- Content collections with drafts use Payload's own `_status` (draft or
  published). Payload does not allow a field named `status` when drafts are
  on with the Postgres adapter. `bookings` has no drafts and keeps `status`.
- `articles.reviewState` holds the editorial stage (writing, in review,
  approved); publishing stays separate. `articles.contentUpdatedAt` feeds
  `dateModified`, because Payload's own `updatedAt` moves on every autosave.
- `audit-log` records who changed what, because Payload versions keep no
  user. It is written by hooks only and is read only for admins.
- `system-state` exists so the status view can show the last cron run
  (section 9).
- Coordinates are two `number` fields, not Payload's `point` field: `point`
  does not work on SQLite, and the model must stay identical on both
  adapters.

Every content record has drafts, versions and an audit trail. Bookings
export to CSV. Phones are stored normalized and searchable in any digit form.

## 5. Booking pipeline

Route handlers under `/api/booking` and `/api/emergency`, server-validated
with zod; the forms also work as plain HTML posts.

1. Normalize input (Persian and Arabic digits, separators, `+98`, `0098`,
   `0`, 10-digit forms); validate `^09\d{9}$`; normalize names (ی, ک, ZWNJ).
2. Abuse controls per `docs/conversion.md` sections 5.3 and 7.5: honeypot;
   signed time token (under 2 s is suspicious); suspicious requests stored
   with status `suspicious`, never dropped; 3 per day per phone; 10 per hour
   per IP before flagging; 1 emergency per day per phone; duplicates within
   10 minutes append a note; SMS capped at 1 per destination per day once
   enabled.
3. Persist, then notify through `Notifier` (interface) with drivers `log`,
   `mail`, `telegram` (later), `farapayamak` (later); retries through a
   lightweight queue (database-backed job table processed by a cron route).
4. Respond with the success state and the computed callback line.
5. Admin: bookings ordered by urgency, click-to-call, status workflow,
   notes, "callback due" view, suspicious list with one-click restore,
   CSV export.
6. Measurement endpoint `/api/events` receives `sendBeacon` payloads and
   increments `events-daily`; no cookies, no IP stored; rate limited.

## 6. SEO engine

- Next.js Metadata API fed by Payload `seo` fields with defaults from the
  global; canonical, robots, OG and Twitter; `generateMetadata` per route.
- JSON-LD builders: `Dentist` everywhere; `Physician` on dentist pages;
  `Service` on service pages; `FAQPage` where FAQs render; `BreadcrumbList`;
  `VideoObject` for testimonials; `ItemList` on hubs. Unit-tested shapes.
- Article graph (phase 6, C1): the `Article` (author, `datePublished`,
  `dateModified`) is the `mainEntity` of a `MedicalWebPage`, or of a plain
  `WebPage` when the article is not medical (`isMedical` off). The page
  node carries `reviewedBy` and `lastReviewed`.
- `sitemap.xml` is an index of four sitemaps (pages, services, doctors,
  articles); `robots.txt`; RSS route for articles.
- Sitemap `lastmod` (phase 6, H16): an article takes `contentUpdatedAt`,
  else `publishedAt`, the same date as its JSON-LD `dateModified`. An
  indexable article category takes the date of its newest article. Every
  other URL takes `updatedAt`. This is a recorded limitation: `updatedAt`
  moves on every save, so it can be newer than the last real content
  change.
- Empty articles hub (phase 6, C25): while no article is published,
  `/مقالات` is `noindex, follow` and stays out of `pages.xml`. A category
  is indexable from 5 published articles; a tag never is.
- Share cards (phase 6, H14): one 1200x630 PNG per page type, rendered
  once by a real browser and committed (`docs/design/DESIGN.md` section
  5), because `next/og` does not shape Persian. A page without its own
  image shares its type's card. Nothing renders on the host.
- Article publish gate (phase 6, H5 with C1; replaces the medical-only
  reviewer rule): every article, medical or not, publishes only when an
  admin set «تأییدشده» and it has a published reviewer dentist, a review
  date, sources, at least two H2 headings and live internal links to a
  service (the primary service when one is set) and a patient guide. A
  medical article also needs a primary service. Only admins set the
  reviewer, the review date and «تأییدشده». When an editor changes what
  the dentist reviewed, an approved article returns to «منتظر بازبینی» in
  the same save (`src/hooks/review.ts`). The reviewed content is the
  title, the excerpt, the body text (blocks included), the body's link
  targets, inline images and video files and posters, the FAQs and the
  sources. Formatting and row ids are left out, so a re-save of the same
  content keeps the approval. The other validators stay: title and
  description length, Persian slug, cover alt.
- Sources gates: guides and articles keep theirs. The services gate (H25)
  is held until the wave 1b copy adds sources (`src/collections/Services.ts`
  carries the `shortcut:` comment with the line to add).

## 7. Performance

- Server HTML first; the experience canvas mounts after `load` and after
  the intro's minimum duration, and renders no frames while the home hero
  photo covers the viewport; scenes load in scroll order with `Preload`
  and are disposed when far out of view.
- Per-page budgets in `docs/experience-direction.md` section 4, enforced by
  Lighthouse CI assertions and a bundle-size check in CI.
- Images: never `next/image`, because the style attribute it writes breaks
  the CSP (no inline styles in server HTML). `<Picture>` renders a
  `<picture>` from the Payload media sizes (AVIF with WebP fallback,
  responsive `srcset`). A missing photo renders `MediaPlaceholder`: the
  exact aspect ratio, a neutral token fill and a visible caption
  «جای عکس: …», each with a row in `docs/content/gaps.md`. The home hero
  photo is one art-directed `<picture>`: from 744 px the landscape crop is
  the LCP element and is preloaded with `fetchpriority="high"` through one
  preload with a media query; under 744 px a scrim text element (the H1 or
  the subtext) is the LCP element, never an image, and the 4:5 band starts
  below the first screen and loads without priority. Both crops come from
  one shoot. Until that photo exists (gap 36), the landscape is a neutral
  raster placeholder that sharp generates at prebuild
  (`public/placeholders/hero-*.avif` and `.jpg` at the hero widths), so the
  preload, `fetchpriority` and LCP pipeline is the real one; its caption is
  DOM text. On other pages the LCP image gets `fetchpriority="high"`.
- Build assets (`/_next/static`) immutable for one year. Media files
  `public, max-age=604800` (seven days), because crops regenerate under the
  same name when an editor moves the focal point. HTML renders per request
  and no page output is cached (section 3); the tagged data cache keeps
  content reads fast.

## 8. Security

- HTTPS and HSTS; CSP with a per-request nonce plus `'strict-dynamic'` on
  every public page (section 3) and on the admin, and hashes for static
  inline scripts (the theme script now, the intro script in phase 7); outside
  development, public pages never allow `unsafe-inline` or `unsafe-eval`.
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options: DENY` except Payload live preview.
- Admin CSP (phase 3 change): `style-src` keeps `'unsafe-inline'`, because
  Payload renders inline styles and exposes no nonce for them. Scripts follow
  the public rule (nonce, no `unsafe-eval`). The admin policy enforces; a
  report-only switch (`CSP_ADMIN_MODE`) stays for debugging.
- CSRF double-submit token on forms; zod validation; parameterized queries
  through Payload; rate limits at the route handlers.
- Admin: Payload auth with MFA (TOTP) through the community plugin
  `payload-totp` 3.0.6 (phase 3 choice), login throttling (429 after 10
  attempts in 15 minutes per client on sign-in, password reset and the TOTP
  endpoints), strong passwords (at least 12 characters, never containing
  the email's local part), roles admin and editor (editor: articles, cases,
  testimonials, bookings), audit trail. Scheduled publish runs as the user
  who scheduled it. The schedule-publish server function checks update
  access (TOTP-wrapped) first, and the TOTP exemption for a user without a
  session strategy holds only inside `/api/cron/tick` (`asJobRunner()`). So
  scheduled publishes run only through the cron tick.
- Content access (phase 3): the public site reads content through Payload's
  Local API only. Anonymous REST reads are denied on every collection and
  global; the one exception is media files, which public pages embed.
  GraphQL is off.
- Uploads: type and size validation, re-encoding with sharp, no SVG from
  editors.
- `npm audit` in CI; no secrets in the repository or logs; phones never in
  logs.
- `package.json` `overrides` (2026-10-26) exist only because a parent pins
  an old version. Neither package reaches the server bundle. Drop each one
  when its parent catches up:
  - `dompurify` `^3.4.17` (GHSA-cg2g-xh64-v4q7 critical, GHSA-mrv2-3pqr-j5jr
    high): `monaco-editor` 0.57.0, under `@payloadcms/ui`, pins 3.4.15. The
    override only clears `npm audit`. Monaco bundles its own DOMPurify copy
    and never imports the npm package. Payload's code editor (JSON and code
    fields) loads monaco 0.55.1, with its own DOMPurify, at run time from
    `cdn.jsdelivr.net` (the default path of `@monaco-editor/loader`), not
    from `node_modules`. Drop the override when `monaco-editor` depends on
    3.4.17 or newer. Self-hosting monaco is a separate task.
  - `happy-dom` `^21.0.4` (GHSA-834v-8h66-3h79 high): `@lexical/headless`
    0.50.0, under `@payloadcms/richtext-lexical`, declares `^20.9.0`. The
    override sits outside that range. It is safe only because nothing loads
    `@lexical/headless/dom`, the one entry that imports happy-dom. Drop the
    override when `@lexical/headless` accepts `^21`.

## 9. Observability and operations

- Structured JSON logs with a request id. `/api/health` endpoint. Admin
  "System status" view: Node version, database, queue depth, last cron run,
  last deploy SHA, media storage usage, failed jobs, open content gaps.
- Admin dashboard and views (phase 6): the dashboard shows, in this order,
  today's requests, the content calendar, SEO health and, for admins only,
  the content gaps; each widget renders only for TOTP-verified staff.
  `/giris/content-calendar` is a staff view for TOTP-verified users only;
  anyone else gets the 404 of an unknown page. It lists failed publishes
  first, then scheduled and recent publishes by Tehran day, then article
  drafts by review state. Every collection and global hides the API tab
  (H32), because Payload has no per-role switch for it.
- Scheduled work (phase 3): one route, `GET /api/cron/tick`, called every
  minute by the host's cron with `Authorization: Bearer CRON_SECRET`. It
  runs Payload's schedules and job queue (scheduled publish now, the
  notifier retries of section 5 later, at most 20 jobs per tick) and records
  the run in the `system-state` global, which the status view shows as the
  last cron run. `docs/deploy.md` has the host cron setup.
- Error notifications through the Notifier, deduplicated per signature per
  hour.
- Backups: nightly PostgreSQL dump to object storage with 14-day retention
  plus the platform's own backups; restore runbook.
- Maintenance mode: `MAINTENANCE_MODE=on` makes the app answer public
  requests with a branded static 503 (`docs/deploy.md` 2.12). The same page,
  written to `public/maintenance.html` at build, lets the platform or
  reverse proxy answer while Node is down.

## 10. Testing

- Vitest: slug utility, digit and phone normalization, booking validation
  and limits, duplicate handling, redirects, schema builders, hours state
  and callback copy, quality tier selection logic.
- Playwright: home loads and intro skips, booking happy and error paths
  (booking page, dialog, the home hero card and the home booking block),
  the home HTML contains no token, emergency gate, drawer, theme
  toggle, compare slider keyboard use, article page; screenshots at
  390x844, 820x1180 and 1440x900 in both themes under `docs/qa/`;
  frame-time sampling on home with CPU throttling.
- axe-core on every public template. Lighthouse CI with budgets.
- Every bug fix adds a test that fails before the fix.

## 11. Local development

`npm run dev` (Next.js with Payload), local PostgreSQL (Docker or the
platform's dev database), `npm run build && npm start` for production
checks, Playwright with the preinstalled Chromium in cloud sessions
(`PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
never `playwright install` there; README "Tests"). Seeders import
`docs/content/*.yaml` and `content/data/*.yaml`; the page registry seed
lives in code (`src/seed/data/pages.yaml`), because the route tree owns the
page keys and hub slugs (phase 3 change).
