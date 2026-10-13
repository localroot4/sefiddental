# Phase 03 - Project Foundation and Infrastructure

Date: 2026-10-13. Versions: recorded in "Delivered".

## Plan (written before building)

Inputs read: the sources of truth in `docs/prompts/00-master.md` section 2,
the phase 1 and 2 reports, and the official documentation of the pinned
versions (Next.js 16.4.0, React 19.3.0, Payload 3.90.2, Tailwind CSS 4.3.3,
React Three Fiber 9.8.1, drei 10.7.9, GSAP 3.15.0, Lenis 1.3.26,
detect-gpu 5.0.70, Vitest 5.0.4, Playwright 1.64.0), read from the projects'
GitHub repositories at the release tags because their websites are blocked
from the build environment. Six specifications and a completeness review
came out of that reading; the decisions below freeze their conflicts.

Client answers before the build (2026-10-13): the logo trace is approved
(gap 1 closed). The host refused Node.js, so C2 at the current host is out
(gap 32); the client offered to buy a Node host. The deploy pipeline waits
for the client's approval of a priced path (brief decision 21).

Order (the prompt lists Payload before the utilities; the Payload hooks
import the utilities, so the utilities come first):

1. Skeleton: one dependency manifest, TypeScript, merged `next.config.ts`,
   Payload mounted at `/admin` in Persian RTL with users and media, MFA,
   environment schema, proxy skeleton, tokens and fonts. Prove `next build`,
   the standalone server and the admin.
2. Parallel lanes on disjoint folders: utilities with tests; collections,
   globals, hooks, seeders; platform modules (CSP, canonical, logging,
   JSON-LD, metadata, system pages); experience modules; tooling configs.
3. Integration: register the data model, generate types, the import map and
   migrations for both database adapters, seed a fresh database.
4. Second lanes: routes that need data (health, events, cron, sitemaps, RSS,
   status view), the experience root on the home placeholder, end-to-end,
   performance and budget tests, integration tests.
5. Integration: compose the proxy, headers and CSP; admin CSP in report-only
   until the admin flows report nothing, then enforce.
6. CI workflow; full local run on a fresh database; Lighthouse on the 404
   template; screenshots and axe; one fix batch; one confirmation round;
   independent review of auth and roles, headers and CSP, uploads, form
   tokens and secrets; README, `docs/deploy.md`, this report, gaps.
7. Held until the client approves a priced path (gap 32): the deploy
   workflow, the staging target, the chosen-path steps of `docs/deploy.md`.

Decisions frozen before the lanes start:

1. Every public HTML response renders per request so it can carry a CSP
   nonce (no `unsafe-inline`); data reads are cached and tagged, and saves
   revalidate the tags. This replaces "static or ISR" in architecture
   section 3; TTFB is measured on the chosen host.
2. The admin keeps `style-src 'unsafe-inline'` (Payload renders inline
   styles); public pages never do.
3. Lighthouse cannot audit an HTTP 404 document, so it runs on a 200 render
   of the 404 template behind a runtime switch (`QA_ROUTES=1`).
4. The initial-JS budgets of 90 KB (content) and 70 KB (booking) sit below
   the framework floor: an empty Next.js 16.4 + React 19.3 page ships
   131.8 KiB gzipped. CI enforces interim limits (home 215 KiB, content
   150 KiB, booking 150 KiB) and every report shows the documented targets
   next to the measured values.
5. One environment schema (`src/lib/env.ts`) and one `.env.example`;
   `SITE_URL` and `GIT_SHA` are the names.
6. Scheduled work: one cron route every minute runs Payload's schedules and
   jobs and records the last run for the status view.
7. Integration tests use SQLite by default and Postgres on their own migrated
   database in CI; end-to-end tests use a fresh migrated database and the
   standalone server, the artifact that deploys.
8. Media: original format kept, camelCase size names, AVIF and WebP, focal
   crops including the home hero landscape and 4:5 crops, content-hashed file
   names; uploads bypass the proxy (its body buffer stops at 10 MB).
9. MFA through the `payload-totp` plugin; the public site reads content
   through the Local API only; anonymous REST reads are denied except media
   files; scheduled publish runs as a server user.
10. Holidays are entered as Jalali dates; other admin dates use Payload's
    Gregorian picker.
11. Password-reset mail goes through Nodemailer when SMTP settings exist,
    else to the server log.
12. TypeScript 5.9.3 (the version verified with Payload 3.90.2 and the lint
    toolchain).
13. Local end-to-end runs use the container's Chromium 1194 through an
    executable-path override; CI installs the browser Playwright expects.

Risks: Payload with Next.js 16.4 is new (3.90 is the first line that
supports it); `payload-totp` is a community plugin; Persian route folders
and revalidation of Persian paths are verified by the first end-to-end test;
the framework JS floor; Liara prices and foreign reachability are unverified
from here (both are client-side probes).
