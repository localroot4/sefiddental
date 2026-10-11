# Architecture

Binding for phases 3-10. Phase 3 refines it into concrete code and may update
this file in the same commit.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | PHP 8.3 (match the host; never below 8.2) | Shared cPanel with WHM |
| Framework | Laravel, current stable at build time | Check the official docs for the installed major version before using an API |
| Admin | Filament, current stable, locale `fa`, RTL | Panel at `/panel`, MFA enabled |
| Views | Blade components, server-rendered | No client-side router |
| CSS | Tailwind CSS v4 with `@theme` tokens from `docs/design-direction.md` | One token file, no ad-hoc colors |
| JS | Alpine.js 3 for small interactivity; GSAP 3 (ScrollTrigger, Flip, MorphSVG) for signature motion; optional Three.js for one lazy scene | Motion libraries load after LCP as ES modules |
| Build | Vite | Assets are built in CI, never on the host |
| Database | MySQL 8 on the host; SQLite for local dev and tests | |
| Cache, sessions, queue | file or database drivers; cron runs `schedule:run` every minute and `queue:work --stop-when-empty` | No Redis on shared hosting |
| Media | spatie/laravel-medialibrary with AVIF and WebP conversions and LQIP | Requires GD or Imagick with AVIF support on the host; fall back to WebP only if AVIF is unavailable |
| Sitemap | spatie/laravel-sitemap | Regenerated on publish and nightly |
| Roles and logs | spatie/laravel-permission, spatie/laravel-activitylog | admin and editor |
| Anti-spam | spatie/laravel-honeypot plus a time trap and rate limits | Cloudflare Turnstile optional, off by default |
| Dates | morilog/jalali or hekmatinasser/verta for Jalali display | Store UTC, display Asia/Tehran |
| Icons | blade-phosphor-icons | One family |
| Tests | Pest (feature and unit), Playwright (e2e and screenshots), axe-core, Lighthouse CI | All run in GitHub Actions |

## 2. Hosting and deployment

Facts to probe in phase 3 and record in `docs/reports/phase-03.md`: PHP version
and CLI availability, extensions (gd or imagick with avif, intl, mbstring,
bcmath, zip, exif), Composer, Node, SSH, cron, max execution time, memory
limit, document root control, HTTP/2 and Brotli, free disk.

Deployment strategy A (default, needs no Composer or Node on the host):

1. GitHub Actions on push to `main`: install PHP deps with
   `composer install --no-dev --optimize-autoloader`, build assets with
   `npm ci && npm run build`, run tests.
2. Publish the built tree (including `vendor/` and `public/build/`) to an
   orphan branch `deploy`.
3. cPanel Git Version Control pulls `deploy`; `.cpanel.yml` copies files to
   the app directory and runs `php artisan migrate --force` and
   `php artisan optimize` when PHP CLI exists.
4. Document root points to `public/` (set in WHM).

Strategy B (if SSH is available): rsync the built tree over SSH from CI and
run the artisan commands remotely. Same artifacts, same tests.

Both strategies keep `.env` on the server only. `.env.example` is committed.
Rollback: redeploy the previous `deploy` commit.

## 3. Request handling and URLs

- `dir="rtl" lang="fa"` on every page. Locale-prefixed routing is prepared
  (`/` is Persian; `/en` reserved) without exposing a second language.
- Persian slugs. Implement `PersianSlug` (Laravel's `Str::slug` strips
  Persian): normalize Arabic ي and ك to Persian, remove diacritics, collapse
  whitespace to hyphens, keep Persian letters and digits, trim hyphens.
  Slugs are editable in admin and unique per type. Changing a slug writes a
  301 into the redirects table automatically.
- Canonical URLs without trailing slash. `www` redirects to apex. HTTP to
  HTTPS. Query strings never create duplicate indexable pages.
- Redirects table with hit counters and an import tool for the old site map.

## 4. Data model

| Table | Key fields |
|---|---|
| service_categories | title, slug, accent, icon, order, seo fields |
| services | category_id, title, slug, summary, body (blocks), price_from (nullable), duration, sessions, faq (relation), related, priority, published_at, seo fields, reviewed_by (doctor), reviewed_at |
| service_tiers | service_id, name (معمولی/VIP/CIP), description, materials, highlights, price_from (nullable), order |
| doctors | name, slug, specialty, council_number, degrees, bio, photo, order, services (pivot), published_at, seo fields |
| posts | title, slug, excerpt, body (rich text with images), cover, category_id, tags (pivot), author_id (doctor or staff), reviewer_id (doctor), sources (json), reading_time, published_at, updated_at, seo fields |
| post_categories, tags | title, slug, description, seo fields |
| testimonials | patient_label, service_id, type (video/text), media, quote, consent_confirmed, order, published_at |
| cases | title, service_id, before_media, after_media, notes, consent_confirmed, order, published_at |
| bookings | phone (normalized E.164), name, service_id, tier, doctor_id (nullable), preferred_time, note, kind (regular/emergency), triage (json), emergency_outcome (urgent/not_urgent, nullable), status (new/contacted/scheduled/done/cancelled/spam), heard_from (admin-entered source), source_url, utm (json), device, ip_hash, notes (admin), handled_by, handled_at |
| insurances | name, logo, featured, order |
| financing_options | title, provider, max_amount, surcharge_note, terms, enabled |
| faqs | faqable (morph), question, answer, order |
| pages | key, title, slug, body blocks, seo fields |
| settings | group, key, value (json) with typed accessors: contact, hours, social, legal (license, supervisor), seo defaults, feature flags |
| redirects | from, to, status, hits, last_hit_at |

Every content record has `published_at`, soft deletes and activity log.
Bookings export to CSV. Phone numbers are stored normalized and searchable in
all digit forms.

## 5. Booking pipeline

1. Input normalization: Persian and Arabic digits to ASCII, whitespace and
   separators removed, `+98`, `0098` and `0` prefixes normalized to E.164,
   Iranian mobile pattern validated. Names trimmed and normalized (ی, ک, ZWNJ).
2. Spam gates: honeypot, minimum fill time, rate limits (5 per minute per IP,
   3 per day per phone, 1 emergency per day per phone), duplicate detection
   (same phone within 10 minutes updates the existing booking).
3. Persist first, then notify through `Notifier` (interface) with drivers
   `log`, `mail`, `telegram` (later), `farapayamak` (later). Failures are
   logged and retried by the queue; the user never sees a failure caused by
   a notifier.
4. Response: success view with callback window, call and WhatsApp fallbacks,
   analytics event. Errors are inline and specific.
5. Admin: new bookings list ordered by urgency, click-to-call, status
   workflow, notes, assignment, "callback due" view, CSV export.

## 6. SEO engine

- `<x-seo>` component: title, description, canonical, robots, OG and Twitter,
  alternate feeds; defaults from settings; per-record overrides.
- JSON-LD builders: `Dentist` (with `MedicalBusiness` fields, NAP, hours,
  geo, sameAs) on every page; `Physician` on dentist pages; `Service` or
  `MedicalProcedure` on service pages; `FAQPage` where FAQs render;
  `BreadcrumbList`; `Article` with `author`, `reviewedBy` and `dateModified`
  on posts; `VideoObject` for testimonial videos; `ItemList` on hubs.
- Sitemap index: pages, services, dentists, posts, cases. `robots.txt` with
  sitemap reference. RSS for the blog.
- OG images: a branded template per page type with the page title rendered
  server-side; fall back to the cover image for posts.
- Admin SEO fields with live validators: title length, description length,
  slug, alt text present on every image, internal links count, reviewer set
  for medical content, sources present when the post makes medical claims.

## 7. Performance

- Server: OPcache on, `config:cache`, `route:cache`, `view:cache`,
  `event:cache`. Full-page cache for public pages (spatie/laravel-responsecache
  or equivalent) invalidated on publish.
- HTML: critical content first, no render-blocking third parties, fonts
  preloaded, LCP image preloaded with `fetchpriority="high"`, explicit width
  and height on all media, `content-visibility: auto` on below-the-fold
  sections.
- JS: Alpine inline-initialized; GSAP and Three.js dynamically imported after
  `load` or on first intersection; per-page bundles.
- Images: AVIF and WebP, responsive `srcset`, lazy loading below the fold,
  LQIP placeholders, max 200 KB per hero image at 1600 px wide.
- Caching headers in `.htaccess`: hashed assets immutable for one year, HTML
  no-cache with ETag, Brotli or gzip.
- Budgets enforced in CI with Lighthouse CI assertions (see `docs/brief.md`).

## 8. Security

- HTTPS and HSTS, CSP with per-request nonces (inline intro script and JSON-LD
  use the nonce), `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options: DENY` (except admin previews).
- CSRF on every form. Validation at the boundary with Form Requests. Eloquent
  only, no raw SQL with interpolation.
- Admin: MFA, login throttling, strong passwords, session timeout, roles
  (admin: everything; editor: posts, cases, testimonials, bookings), activity
  log on every write.
- Uploads: type and size validation, image re-encoding, no SVG uploads from
  editors, files stored outside the web root when not public.
- Dependencies: `composer audit` and `npm audit` in CI. No secrets in the
  repository or logs. Personal data (phones) never logged in plain text.

## 9. Observability and operations

- Structured JSON logs with a request id. Daily rotation.
- `/up` health endpoint. Admin "System status" page: PHP version, queue depth,
  last cron run, last deploy SHA, disk usage, failed jobs, cache status,
  pending content gaps.
- Error notifications to the admin through the Notifier, deduplicated per
  error signature per hour.
- Backups: nightly database dump to storage with 14-day retention plus the
  host's own backups. Restore procedure documented.
- Maintenance mode page branded and cached.

## 10. Testing

- Pest: slug generation, digit and phone normalization, booking validation and
  rate limits, duplicate handling, redirects, sitemap contents, JSON-LD shape,
  settings accessors, authorization per role.
- Playwright: home loads and intro skips, booking happy path and error path,
  emergency gate, mobile drawer, theme toggle, before/after slider keyboard
  use, blog post renders TOC and sources. Screenshots at 390x844, 820x1180
  and 1440x900 in both themes saved to `docs/qa/`.
- axe-core on every public template. Lighthouse CI with budget assertions.
- Every bug fix adds a test that fails before the fix.

## 11. Local development

`php artisan serve` plus `npm run dev` (or `npm run build` for production
assets). SQLite database. Seeders import `docs/content/*.yaml` and
`content/data/*.yaml`. Playwright uses the preinstalled Chromium in cloud
sessions (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); Lighthouse CI uses the
same binary through `CHROME_PATH`.
