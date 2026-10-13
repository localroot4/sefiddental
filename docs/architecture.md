# Architecture (v2, Next.js)

Binding for phases 3-10. Replaces the Laravel plan after the client chose a
Next.js and WebGL experience. Phase 3 refines it into code and may update
this file in the same commit.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js, current stable (16 or later), App Router, TypeScript strict | Server components by default; client islands for motion and WebGL |
| CMS | Payload CMS 3.x inside the same Next.js app, admin at `/admin`, locale `fa`, RTL | Collections, drafts and versions, scheduled publish, access control, media with sharp, live preview |
| Database | PostgreSQL (Payload Postgres adapter) on a PaaS or a VPS; Payload's SQLite adapter on cPanel paths (C2) | The data model is identical; the adapter is an environment setting, and the confirmed hosting path (section 2) sets it |
| Styling | Tailwind CSS v4 with `@theme` tokens from `design/tokens.css`; CSS modules for complex scenes | one token file, no ad-hoc colors |
| UI motion | Motion (`motion/react`) for component states and layout animation | client islands only |
| Scroll engine | GSAP 3 (ScrollTrigger, Flip, MorphSVG, Draggable, InertiaPlugin) plus Lenis | one master timeline per page; see `docs/experience-direction.md` |
| WebGL | three.js, `@react-three/fiber` 9, `@react-three/drei`, `@react-three/postprocessing`; WebGL 2 with WebGL 1 fallback for tier 1 | KTX2 textures, Draco glTF, one `<Canvas>` fixed behind the page |
| Quality tiers | `detect-gpu` plus a frame-time monitor (`PerformanceMonitor` from drei) and `AdaptiveDpr` | tiers 0-3 per `docs/experience-direction.md` section 3 |
| Fonts | Vazirmatn and Estedad via `next/font/local`, subsets, swap | preloaded |
| Icons | Phosphor Icons React | one family |
| Dates | `date-fns-jalali` for display; store UTC | Asia/Tehran |
| Email | Nodemailer through the host's SMTP | admin notifications |
| Tests | Vitest (unit), Playwright (e2e, screenshots, frame timing), axe-core, Lighthouse CI | all in GitHub Actions |
| Lint | ESLint, Prettier, TypeScript `--noEmit`, `knip` for dead code | CI gate |

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
| **A: Node PaaS inside Iran** | neither C1 nor C2 passes the probe | a small monthly fee | Liara first, ArvanCloud second: Next.js preset, managed PostgreSQL, object storage, deploy from GitHub Actions |

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
ArvanCloud PaaS, both with Next.js app presets, managed PostgreSQL and
object storage. Deploy from GitHub Actions on push to `main` (Liara CLI or a
Docker image); environment variables in the platform; media in object
storage (S3 compatible) with a CDN. Low latency for Iranian visitors;
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
- Canonical without trailing slash; `www` to apex; HTTP to HTTPS; query
  strings canonicalize to the base URL (gallery filters, booking params).
- Rendering: content pages are static or ISR (revalidate on publish through
  Payload hooks); home is static (or ISR) with client islands, although its
  hero card and booking block render forms. Pages with an inline form (home,
  address, content pages with a booking block) stay static or ISR and get
  the CSRF token, the signed time token and the hours state from a
  `no-store` endpoint (`docs/conversion.md` section 6). Only the booking and
  emergency pages are dynamic (`no-store`).

## 4. Data model (Payload collections and globals)

| Collection | Key fields |
|---|---|
| service-categories | title, navLabel, slug (nullable for standalone), accent, icon, order, seo |
| services | category, navLabel, h1, seoTitle, slug, bookingGroup, emergencyLink, summary, body (blocks), priceFrom (nullable), duration, sessions, faqs (array), related, priority, reviewedBy (doctor), reviewedAt, status, seo |
| service-tiers | service, name, description, materials, highlights, priceFrom, order |
| doctors | name, slug, specialty, specialtyConfirmed (board), councilNumber, degrees, bio, photo, order, services, status, seo |
| articles | title, slug, excerpt, body (rich text with media), cover, category, tags, author (doctor or staff), reviewer (doctor), sources (array), readingTime, publishedAt, updatedAt, status, seo |
| article-categories, tags | title, slug, description, seo |
| testimonials | patientLabel, service, type (video or text), media, poster, quote, consentConfirmed, order, status |
| cases | title, service, before, after, notes, consentConfirmed, order, status |
| bookings | phone (E.164), name, service, tier, doctor, preferredTime, note, kind (regular or emergency), triage, emergencyOutcome, status (new, contacted, scheduled, done, cancelled, spam, suspicious), flags, heardFrom, sourceUrl, utm, device, ipHash, adminNotes, handledBy, handledAt |
| insurances | name, logo, featured, order |
| financing-options | title, provider, maxAmount, surchargeNote, terms, enabled |
| pages | key, title, slug, blocks, seo |
| redirects | from, to, status, hits, lastHitAt |
| events-daily | date, event, location, pageType, serviceKey, count |
| media | upload with required alt, focal point, sharp conversions (AVIF, WebP, sizes), LQIP |
| users | admin and editor roles |

Globals: `clinic` (name, NAP, phones, socials, hours with holiday
overrides, legal: license and supervisor), `seo-defaults`, `features`
(financing toggles, emergency, intro, analytics id, quality tier override),
`notifier` (drivers and test action).

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
  `Article` with `author`, `reviewedBy`, `dateModified`; `VideoObject` for
  testimonials; `ItemList` on hubs. Unit-tested shapes.
- `sitemap.xml` index per collection, `robots.txt`, RSS route for articles.
- OG images with `next/og` (ImageResponse) and the Persian font.
- Editorial validators in Payload: title and description length, Persian
  slug, cover alt, reviewer required for medical content, sources required
  when medical claims exist, at least two internal links.

## 7. Performance

- Server HTML first; the experience canvas mounts after `load` and after
  the intro's minimum duration, and renders no frames while the home hero
  photo covers the viewport; scenes load in scroll order with `Preload`
  and are disposed when far out of view.
- Per-page budgets in `docs/experience-direction.md` section 4, enforced by
  Lighthouse CI assertions and a bundle-size check in CI.
- Images: `next/image` with AVIF and WebP, responsive sizes, blur
  placeholders from Payload. The home hero photo is one art-directed
  `<picture>` (Next.js `getImageProps`): from 744 px the landscape crop is
  the LCP element and is preloaded with `fetchpriority="high"` through one
  preload with a media query; under 744 px a scrim text element (the H1 or
  the subtext) is the LCP element, never an image, and the 4:5 band starts
  below the first screen and loads without priority. Both crops come from
  one shoot.
  On other pages the LCP image gets `fetchpriority="high"`.
- Static assets immutable for one year; HTML `no-cache` on dynamic routes;
  ISR for content routes.

## 8. Security

- HTTPS and HSTS; CSP with per-request nonces on dynamic routes and hashes
  for the static inline intro script; `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` except
  Payload live preview.
- CSRF double-submit token on forms; zod validation; parameterized queries
  through Payload; rate limits at the route handlers.
- Admin: Payload auth with MFA (TOTP) through a maintained plugin or
  built-in support, login throttling, strong passwords, roles admin and
  editor (editor: articles, cases, testimonials, bookings), audit trail.
- Uploads: type and size validation, re-encoding with sharp, no SVG from
  editors.
- `npm audit` in CI; no secrets in the repository or logs; phones never in
  logs.

## 9. Observability and operations

- Structured JSON logs with a request id. `/api/health` endpoint. Admin
  "System status" view: Node version, database, queue depth, last cron run,
  last deploy SHA, media storage usage, failed jobs, open content gaps.
- Error notifications through the Notifier, deduplicated per signature per
  hour.
- Backups: nightly PostgreSQL dump to object storage with 14-day retention
  plus the platform's own backups; restore runbook.
- Maintenance mode: a branded static page served by the platform.

## 10. Testing

- Vitest: slug utility, digit and phone normalization, booking validation
  and limits, duplicate handling, redirects, schema builders, hours state
  and callback copy, quality tier selection logic.
- Playwright: home loads and intro skips, booking happy and error paths
  (booking page, dialog, the home hero card and the home booking block),
  the cached home HTML contains no token, emergency gate, drawer, theme
  toggle, compare slider keyboard use, article page; screenshots at
  390x844, 820x1180 and 1440x900 in both themes under `docs/qa/`;
  frame-time sampling on home with CPU throttling.
- axe-core on every public template. Lighthouse CI with budgets.
- Every bug fix adds a test that fails before the fix.

## 11. Local development

`npm run dev` (Next.js with Payload), local PostgreSQL (Docker or the
platform's dev database), `npm run build && npm start` for production
checks, Playwright with the preinstalled Chromium in cloud sessions
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Seeders import
`docs/content/*.yaml` and `content/data/*.yaml`.
