# Phase 03 - Project Foundation and Infrastructure

Create the application skeleton, the admin, the pipelines and the deploy
strategy. Think like the Laravel engineer, DevOps engineer and security
engineer. No public page design yet beyond the base layout and system pages.

## Inputs

`docs/architecture.md`, `docs/design/DESIGN.md`, `design/`, phase 1 and 2
reports, hosting facts from the client (if missing, build strategy A from
`docs/architecture.md` section 2 and list the questions).

## Deliverables

1. Laravel application in the repository root (current stable), PHP 8.3
   target, SQLite for dev and tests, MySQL config for production,
   `.env.example` complete and commented.
2. Filament panel at `/panel` with locale `fa`, RTL, Persian translations,
   MFA enabled, roles admin and editor (spatie/laravel-permission), activity
   log, login throttling, a first admin created by a seeder from env values.
3. Domain foundation: migrations and models for every table in
   `docs/architecture.md` section 4, factories, seeders that import
   `docs/content/services.yaml`, `docs/content/clinic.yaml` and
   `content/data/*.yaml` with `[[NEEDS_CLIENT]]` handling.
4. Services: `PersianText` normalizer (letters, digits, ZWNJ, spacing),
   `PersianSlug`, `PhoneNumber` normalizer and validator (E.164, Iranian
   mobile), `Jalali` display helpers, `Settings` typed accessors.
5. Media pipeline: medialibrary with AVIF and WebP conversions, responsive
   sizes, LQIP, alt text required; a probe command that reports which image
   libraries and formats the runtime supports.
6. Front-end toolchain: Vite, Tailwind v4 with tokens imported from
   `design/tokens.css`, fonts from `design/fonts/`, Alpine.js, GSAP installed
   but loaded only through dynamic import on pages that need it, Phosphor
   icons via Blade. Base layout with `<x-seo>`, theme handling (system plus
   toggle, no flash of wrong theme), skip link, landmarks, CSP nonce support,
   security headers middleware.
7. SEO plumbing: `<x-seo>` component, JSON-LD builders with tests, sitemap
   generation, robots, redirects table and middleware with tests, canonical
   and host redirects, RSS route stub.
8. System pages: branded 404, 500, 503 maintenance, `/up` health, admin
   "System status" page.
9. Quality tooling: Pest with coverage of the services above, Laravel Pint,
   PHPStan (Larastan) at a sensible level, ESLint and Prettier for JS, a
   Playwright config with the three viewports and both themes, axe-core
   helper, Lighthouse CI config with the budgets from the brief, GitHub
   Actions workflow running all of it on every push and pull request.
10. Deployment: GitHub Actions deploy job per strategy A (default) and a
    documented strategy B, `.cpanel.yml`, a `docs/deploy.md` with the exact
    cPanel and WHM steps (document root to `public/`, PHP version, cron
    lines, env file), and a `php artisan ops:probe` command that prints the
    host facts needed. Do not deploy to production in this phase.
11. `README.md` updated with local setup, scripts and the phase process.
12. `docs/reports/phase-03.md`.

## Steps

1. Read the official docs for the installed Laravel and Filament majors
   before writing panel code. Record versions in the report.
2. Scaffold, then commit in small steps: app skeleton; admin; domain;
   services with tests; media; front-end toolchain; SEO plumbing; system
   pages; CI; deploy.
3. Prove tests can fail: break `PersianSlug` on purpose once, watch the test
   go red, restore.
4. Run the full CI locally (tests, Pint, PHPStan, build, Playwright smoke on
   the system pages). Fix until green.
5. Independent review by a separate agent on: auth and roles, headers and
   CSP, upload handling, deploy workflow secrets handling. Record findings.

## Acceptance criteria

- `composer test`, `composer lint`, `composer analyse`, `npm run build`,
  `npm run test:e2e` all pass locally and in CI.
- Admin loads in Persian RTL with MFA enrollment; editor cannot access
  settings, users or redirects.
- Seeders produce every service, category, tier, insurer, financing option
  and setting from the yaml files; `[[NEEDS_CLIENT]]` values are flagged in
  the status page.
- `PersianSlug('لمینت سرامیکی')` returns `لمینت-سرامیکی`; Arabic ي and ك are
  normalized; phone normalizer accepts Persian digits and `+98`, `0098`, `0`
  prefixes and rejects landlines where a mobile is required.
- Security headers present on every response; CSP has no `unsafe-inline`.
- Lighthouse CI runs against the 404 page and passes the budgets.
- `docs/deploy.md` lets the client deploy without asking a question, given
  the hosting facts.

## Hand-off

List the hosting facts still needed, the exact cPanel actions for the client
(document root, PHP version, cron), and confirm whether strategy A or B will
be used.
