# Phase 03 - Project Foundation and Infrastructure

Create the Next.js application with Payload, the hosting decision, the
pipelines, the quality-tier scaffold and the system pages. Think like the
Next.js engineer, Payload engineer, DevOps engineer, security engineer and
performance engineer. No public page design beyond the base layout.

## Inputs

`docs/architecture.md`, `docs/experience-direction.md` sections 3 and 4,
`docs/design/DESIGN.md`, `design/`, the hosting answer from the client
(gap 32), the phase 1 and 2 reports.

Hosting status on 2026-10-13: the host has not answered the Node.js ticket
(gap 32). If gap 32 is still open, start this phase host-agnostic (brief
decision 21). Build every deliverable on environment-driven configuration
(database adapter, media storage, base URL). Record the probe facts known so
far in `docs/deploy.md`. Hold deliverable 9 (the deploy pipeline and the
staging target), the chosen-path steps of `docs/deploy.md` and the deploy
parts of steps 2 and 5 until the client confirms the path
(`docs/architecture.md` section 2: no deploy code before that confirmation).
While gap 32 is open, the report lists these items and the `docs/deploy.md`
acceptance line as open, blocked by gap 32. Hosting must be settled before
phase 7, because the phase 7 hand-off needs a staging URL that the client
opens on a phone. Use the traced logo in `design/brand/` as is (gap 1).

## Deliverables

1. Hosting decision recorded in `docs/deploy.md` after the probe in
   `docs/architecture.md` section 2, in order: C1 (the client's own server
   through WHM root), C2 (cPanel Node.js app with Node 20+ and 1 GB), A
   (Liara or ArvanCloud PaaS). Walk the client through the probe in Persian
   if they cannot run it alone. Build with environment-driven configuration
   so the same code runs on any path (database adapter, media storage,
   base URL). Document the exact steps for the chosen path (runtime,
   database, media, environment variables, domains, cron, deploy).
2. Next.js app (current stable, App Router, TypeScript strict) at the
   repository root with Payload 3 mounted at `/admin`, locale `fa`, RTL,
   PostgreSQL adapter (SQLite adapter for tests), media collection with
   sharp conversions (AVIF, WebP, sizes, blur placeholder) and focal-point
   crops (the home hero needs a landscape crop and a 4:5 crop for phones,
   brief decision 19) stored in object storage behind an adapter with a
   local fallback, `.env.example` complete and commented.
3. Collections and globals per `docs/architecture.md` section 4 with access
   control (admin, editor), drafts and versions, scheduled publish, Persian
   slug hook, audit trail, and seeders that import `docs/content/*.yaml` and
   `content/data/*.yaml` with `[[NEEDS_CLIENT]]` handling.
4. Shared utilities with unit tests: `persianText` (letters, digits, ZWNJ,
   spacing), `persianSlug`, `phone` (normalize and validate per
   `docs/conversion.md` 5.1), `jalali` display helpers, `hoursState`
   (schedule, holidays, next working time, callback copy), `qualityTier`
   (inputs: GPU benchmark result, device memory, viewport, reduced motion,
   data saver, saved override; output: tier 0-3 and settings).
5. Base layout: `next/font/local` for both fonts, Tailwind v4 with tokens
   imported from `design/tokens.css`, theme handling (system plus toggle, no
   flash), skip link, landmarks, `<Seo>` metadata helpers, JSON-LD
   builders with tests, security headers and CSP (hashes for static inline,
   nonces on dynamic routes), `sitemap.xml`, `robots.txt`, RSS stub,
   redirects collection and middleware with tests, canonical and host
   redirects.
6. Experience scaffold without scenes: the fixed `<Canvas>` host mounted
   only on home after `load`, the tier provider and the frame monitor, the
   Lenis and GSAP ScrollTrigger integration with a master timeline, and a
   developer overlay (fps, tier, DPR, memory) toggled by a query parameter.
7. System pages: branded 404, 500, maintenance; `/api/health`; the admin
   "System status" view; the measurement endpoint `/api/events` with the
   `events-daily` collection.
8. Quality tooling: Vitest with the utilities covered, ESLint, Prettier,
   TypeScript `--noEmit`, `knip`, Playwright config (three viewports, both
   themes, throttling helper, SwiftShader launch profile), axe-core helper,
   Lighthouse CI config with the budgets, a bundle-size check per page
   class, GitHub Actions workflow running everything on every push and pull
   request.
9. Deploy pipeline for the chosen option from GitHub Actions on `main`,
   with migrations and one-command rollback; a staging target if the
   platform allows. Do not deploy to production in this phase.
10. `README.md` with local setup, scripts, the phase process; `docs/deploy.md`.
11. `docs/reports/phase-03.md`.

## Steps

1. Read the official docs for the installed Next.js, Payload, R3F, drei and
   GSAP majors before writing code; record versions.
2. Scaffold and commit in small steps: app; Payload and collections;
   utilities with tests; layout and SEO plumbing; experience scaffold;
   system pages; CI; deploy.
3. Prove tests can fail: break `persianSlug` once, watch red, restore.
4. Run the full CI locally; fix until green. Measure the base layout with
   Lighthouse on the 404 page.
5. Independent review on auth and roles, headers and CSP, upload handling,
   the time-token and CSRF design, and secrets handling in the deploy
   workflow. Record findings.

## Acceptance criteria

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `npm run test:e2e` pass locally and in CI.
- Admin loads in Persian RTL; MFA enrollment works; editor cannot reach
  globals, users, redirects or system views.
- Seeders produce every category, service, tier, insurer, financing option
  and clinic global from the yaml files; `[[NEEDS_CLIENT]]` values show on
  the status view.
- `persianSlug('لمینت سرامیکی')` returns `لمینت-سرامیکی`; Arabic ي and ك
  normalize; the phone utility accepts Persian digits, `+98`, `0098`, `0`
  and 10-digit input and rejects landlines where a mobile is required;
  `hoursState` returns the right state and copy for before-open, open,
  closing-soon, closed and holiday cases.
- `qualityTier` is pure, unit-tested, and the overlay shows the live tier.
- Security headers on every response; CSP has no `unsafe-inline` or
  `unsafe-eval`.
- Lighthouse CI passes the content-page budgets on the 404 page.
- `docs/deploy.md` lets the client deploy without asking a question.

## Hand-off

Confirm the hosting option with the client. If the host has not answered
by the end of the build (gap 32), ask the client to choose C1 (their own
server through WHM root) or A (a Node PaaS in Iran, Liara first, for a
small monthly fee that they approve). List the platform accounts and
environment values they must create, and name any budget that the platform
cannot meet. List the pending logo approval again, not as a new question:
the trace (gap 1), shown as the final asset `design/brand/logo-horizontal.svg`
beside the client's original PNG (`content/brand/logo-horizontal.png`), with
a yes or no. Launch needs an explicit yes, or the original logo vector. Do
not ask about the 3D mark here; the phase 8 hand-off shows it in the real
scene (gap 34a, brief decision 20).
