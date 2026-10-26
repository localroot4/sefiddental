# Sefid Dental Clinic Website

Custom Persian (RTL) website for کلینیک دندانپزشکی سفید, a digital dental clinic in south Tehran.
Next.js 16.4 serves light, SEO-first content pages and a quality-tiered WebGL scroll experience on home.
Payload CMS 3.90 runs inside the same app at `/admin`, on PostgreSQL (production) or SQLite (tests, local).

## Prerequisites

- Node.js 22.18 or newer (`.nvmrc`: 22) and npm.
- PostgreSQL 16, or a SQLite file for local work.

## First setup

1. Create the environment file.

   ```
   cp .env.example .env
   ```

   Fill these values in `.env`. Every other value has a working default, and `.env.example`
   explains each one.

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `postgres://user:password@127.0.0.1:5432/sefid_dev`, or `file:./.data/dev.db` for SQLite |
   | `DB_PUSH` | `false`: the database is migrated, never pushed |
   | `PAYLOAD_SECRET`, `CRON_SECRET`, `INTERNAL_API_TOKEN`, `IP_HASH_SECRET`, `FORM_TOKEN_SECRET` | a separate `openssl rand -base64 48` output for each |
   | `MEDIA_DIR` | an absolute upload directory outside `.next`, for example `/home/you/sefid-media` |
   | `ALLOW_FIRST_USER` | `true` until step 5 ends |

   `npm run dev` needs only `DATABASE_URL` and `PAYLOAD_SECRET`: it derives each missing secret
   from `PAYLOAD_SECRET` (an HMAC per name, one warning line each) and uploads to
   `<repo>/media`. The standalone server (`npm run start`, e2e, `check:bundle`, `lhci`) runs as
   production and stops when one of these values is missing.

2. Install the exact locked dependencies.

   ```
   npm ci
   ```

3. Create an empty database and migrate it. For SQLite, run `mkdir -p .data` first. For a local
   PostgreSQL 16 in the cloud container, run `pg_ctlcluster 16 main start` first.

   ```
   npm run migrate
   ```

   Run `migrate` only on a fresh database or on one that was always migrated. Never migrate,
   seed or serve a database that Drizzle push created (`DB_PUSH` unset or `true`): the commands
   stop at an interactive prompt. Push is for throwaway local databases only.

4. Import the clinic content from `docs/content/*.yaml` and `content/data/*.yaml`.

   ```
   npm run seed
   ```

   The default mode `create-only` adds missing records (and fills the empty fields of the four
   globals). It never overwrites. `npm run seed -- fill` also fills the empty fields of existing
   records, never overwrites a filled one, and leaves a reviewed document unchanged with a
   warning. `npm run seed -- sync` writes the yaml values into every record that differs and
   never unpublishes (refused when `NODE_ENV=production`). `npm run seed -- dry-run` reports and writes nothing. Check the output
   for the summary line that starts with `seed: mode:`. The npm scripts call the Payload CLI
   through `scripts/payload.mjs`, which reruns a command whose TypeScript loader stalls on a
   cold compile cache; never call `npx payload` directly.

5. Create the first admin.
   1. Start the app with `npm run dev`.
   2. Open `http://localhost:3000/admin/create-first-user` and create the account. The password
      needs at least 12 characters and must not contain the part of the email before `@`. The
      first account is always an admin.
   3. Enroll TOTP on `/admin/setup-totp`: scan the QR code with an authenticator app and enter a
      code. Every later sign-in asks for a code on `/admin/verify-totp`.
   4. Set `ALLOW_FIRST_USER=false` in `.env` (or delete the line) and restart `npm run dev`. The
      first-user screen and `POST /api/users/first-register` then answer 404.

   Create editor accounts later in the admin, under Users.

## Run

```
npm run dev
```

- Site: `http://localhost:3000`. Admin: `/admin`. System status: `/admin/system-status`.
  Health: `/api/health`.
- On home, `?debug=1` shows the developer overlay (fps, tier, DPR, memory) and `?tier=0` to
  `?tier=3` fixes the quality tier.
- The production artifact runs with `npm run build`, then `npm run start`.

## Scripts

| Script | What it does |
|---|---|
| `predev` | Runs before `dev`: `scripts/sync-public-assets.mjs` copies brand files, fonts, the static maintenance page and the GPU benchmarks into `public/` |
| `dev` | Starts the Next.js development server on port 3000 |
| `prebuild` | Runs before `build`: the same asset copy as `predev` |
| `build` | Builds the standalone production server into `.next/standalone/` |
| `postbuild` | Deletes the `.env` files that Next copies into `.next/standalone/` |
| `start` | Same as `start:standalone` |
| `start:standalone` | Copies `public/` and `.next/static/` beside the standalone server and starts it with the repo `.env` (shell values win) |
| `lint` | ESLint with zero warnings allowed |
| `format` | Prettier: rewrites files |
| `format:check` | Prettier: fails on unformatted files |
| `typecheck` | `next typegen`, then `tsc --noEmit` |
| `knip` | Fails on unused files, exports and dependencies |
| `test` | Vitest: the unit, dom and int projects |
| `test:unit` | Vitest: the unit and dom projects |
| `test:int` | Vitest: the int project (Payload on SQLite, or on PostgreSQL with `INT_DATABASE_URL`) |
| `test:coverage` | The unit and dom projects with coverage into `coverage/` |
| `test:tz` | The Jalali and hours tests in UTC, Asia/Tehran and America/Los_Angeles |
| `test:e2e` | Playwright against three standalone servers |
| `check:bundle` | Initial JS per page class against `tests/budgets/limits.json` |
| `lhci` | Lighthouse CI in light, then dark, with the LCP spread of 5 runs |
| `ci:local` | The local CI chain: lint, format, types, knip, bidi check, tests, time zones, build, prerender check, `db:e2e`, e2e, bundle, Lighthouse |
| `payload` | The Payload CLI |
| `generate:types` | Writes `src/payload-types.ts` |
| `generate:importmap` | Writes `src/app/(payload)/admin/importMap.js` |
| `migrate` | Applies pending migrations to `DATABASE_URL` |
| `migrate:create` | Writes a migration for the adapter that `DATABASE_URL` selects |
| `migrate:status` | Lists applied and pending migrations |
| `seed` | Imports the yaml content; mode `create-only` (default), `fill`, `sync` or `dry-run`; `DB_PUSH` defaults to `false` |
| `reset-admin` | `npm run reset-admin -- <email>`: sets a random password that meets the policy, clears TOTP, unlocks the account and prints the password once. With `ADMIN_PASSWORD` set, that becomes the password and nothing prints it (the workflow "Server", `docs/deploy.md` 3.4). The recovery path without SMTP |
| `first-admin` | Creates the first admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD` when no account exists; prints the e-mail and `created` or `skipped: users exist`. The workflow "Server" runs it (`docs/deploy.md` 3.4) |
| `db:e2e` | Rebuilds `.data/e2e.db`: a fresh SQLite file, migrated and seeded |

## Tests

| Project | Files | Runs on |
|---|---|---|
| unit | `src/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/helpers/**/*.test.ts` | Node, no database, no network |
| dom | `src/**/*.test.tsx` | jsdom |
| int | `tests/int/**/*.int.test.ts`, `tests/setup/**/*.int.test.ts` | Payload on one temporary SQLite file per worker, or on PostgreSQL |
| e2e | `tests/e2e/**/*.spec.ts`, `tests/perf/**/*.spec.ts` | Playwright and the standalone build on a migrated, seeded database |

Unit, dom and int on SQLite:

```
npm test
```

Integration tests on PostgreSQL: create an empty database for them, migrate it once, then pass
its URL. The tests never assume empty tables, so the database can be reused.

```
DATABASE_URL=postgres://user:password@127.0.0.1:5432/sefid_int DB_PUSH=false npm run migrate
```

```
INT_DATABASE_URL=postgres://user:password@127.0.0.1:5432/sefid_int npm run test:int
```

End-to-end tests run the build, not the source: build again after every code change. In the
cloud container, Playwright needs the preinstalled Chromium; never run `playwright install`
there. CI installs the Chromium that Playwright expects.

```
npm run build
```

```
npm run db:e2e
```

```
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```

- Playwright starts three servers: `E2E_PORT` (default 3000), `E2E_PORT+1` with
  `MAINTENANCE_MODE=on` and `E2E_PORT+2` with `ALLOW_INDEXING=true`. Stop `npm run dev` first,
  or set another port: `E2E_PORT=3200 npm run test:e2e`.
- Projects: six viewport and theme pairs (phone, tablet, desktop; light, dark), `http`, `admin`
  (serial, no retry), `no-webgl2` and `perf-swiftshader`.
- The global setup resets the e2e accounts in `.data/e2e-users.json` and `.data/e2e-totp.json`.
- `QA_SCREENSHOTS=phase-NN npm run test:e2e` writes screenshots to `docs/qa/phase-NN/`.

Time zones, bundle size and Lighthouse (the last two need `build` and `db:e2e` first):

```
npm run test:tz
```

```
npm run check:bundle
```

```
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run lhci
```

The whole local chain: put `PW_CHROMIUM_EXECUTABLE` and `CHROME_PATH` in `.env` (Playwright,
`check:bundle` and `lhci` read it), free ports 3000 to 3002, then run:

```
npm run ci:local
```

CI (`.github/workflows/ci.yml`) also runs coverage, `npm audit`, the generated-files drift
check, and the int and e2e tests on PostgreSQL.

## Generated files

The developer who changes the Payload config regenerates these files and commits them in the same
commit. The CI drift step fails when one is stale.

| File | Command | When |
|---|---|---|
| `src/payload-types.ts` | `npm run generate:types` | After a change to a collection, global, field or block |
| `src/app/(payload)/admin/importMap.js` | `npm run generate:importmap` | After adding, moving or removing a custom admin component |
| `src/migrations/postgres/`, `src/migrations/sqlite/` | `npm run migrate:create -- <name>`, once per adapter | After any schema change |

Each adapter has its own migration folder, and `DATABASE_URL` selects the adapter. A shell value
wins over `.env`:

```
DATABASE_URL=postgres://user:password@127.0.0.1:5432/sefid_dev npm run migrate:create -- <name>
```

```
DATABASE_URL=file:./.data/drift.db npm run migrate:create -- <name>
```

Then apply the new migration with `npm run migrate`. Never edit a migration that already ran on a
shared database; write a new one.

Never commit these (gitignored, rebuilt by the tooling): `public/brand/`, `public/fonts/`,
`public/detect-gpu/`, `public/maintenance.html` and `public/favicon.ico` (written by `predev`
and `prebuild`), `next-env.d.ts`, `.next/`, `.data/`, `media/`.

## Folder map

| Path | Contents |
|---|---|
| `src/app/(site)/` | Public site: layout, home, branded 404 and 500, `r/` (Persian dynamic routes), `qa/` (Lighthouse and screenshot targets, only with `QA_ROUTES=1`), `api/` (health, events, cron, CSP reports, form session, internal proxy calls) |
| `src/app/(payload)/` | Payload admin at `/admin` and the Payload API (generated, plus `custom.scss`) |
| `src/app/` | Also: `robots.ts`, `sitemap.xml/`, `sitemaps/`, `rss.xml/`, `global-not-found.tsx` |
| `src/collections/` | Payload collections: content, bookings, media, users, redirects, system |
| `src/globals/` | Payload globals: clinic facts and site settings |
| `src/access/` | Role checks (admin, editor) and the TOTP access wrapper |
| `src/hooks/` | Payload hooks: Persian normalization, slugs, audit trail, revalidation, password policy, first user |
| `src/seed/` | The seeder and its schemas |
| `src/migrations/` | Generated migrations, one folder per database adapter |
| `src/lib/` | Utilities (Persian text, slugs, phone, Jalali, hours, quality tier, form tokens), the environment schema (`env.ts`), data readers, HTTP and proxy rules, SEO, logging, theme, system pages |
| `src/experience/` | Home experience: tier provider, scroll engine, canvas host, scenes, developer overlay |
| `src/admin/` | Custom admin views and components: System status, logo, icon |
| `src/components/`, `src/blocks/`, `src/fields/`, `src/i18n/`, `src/content-gaps/` | Layout and SEO components, Payload blocks and shared fields, Persian UI strings, the `[[NEEDS_CLIENT]]` registry |
| `src/proxy.ts`, `src/payload.config.ts`, `src/payload/` | The request proxy, the Payload config, the database adapter switch |
| `tests/` | `int/`, `e2e/`, `perf/`, `setup/`, `helpers/`, `budgets/limits.json` |
| `scripts/` | Asset sync, standalone start, bundle check, Lighthouse, bidi and prerender checks |
| `design/` | Tokens, fonts, brand SVGs and 3D assets, styleguide, prototypes, vendored libraries |
| `docs/` | Brief (source of truth), architecture, design system, experience, IA, conversion, SEO, content, deploy, prompts, reports, QA |
| `content/` | Brand assets, screenshots of the old site, client data to import |

## Persian routes

Next.js 16.4 matches no route under a Persian folder name in a production build, static pages and
dynamic segments such as `[slug]` alike. So every public Persian path rewrites to an ASCII folder
under `/r`.

- Put a static page in `src/app/(site)/r/<folder>/page.tsx` and its `PAGE_PATHS` key in
  `PERSIAN_STATIC_ROUTES` (exact paths; the type requires every key but home and the guides).
- Put a dynamic page in `src/app/(site)/r/<folder>/[slug]/page.tsx`.
- Add one row to `PERSIAN_DYNAMIC_ROUTES` in `src/lib/http/proxyRules.ts` for every new dynamic
  route, for example `['/پزشکان/', '/r/doctors/']`. The proxy rewrites the public path through
  this table.
- Build the public prefix in `src/lib/paths.ts`. Unit test R4 ties each table row to `buildPath`.
- Never create a folder with a Persian name under `src/app/(site)/` (unit test R9). One segment
  after a prefix of the dynamic table always rewrites to its `[slug]` folder.
- Canonical URLs, sitemaps and redirects use the Persian path. A direct request under `/r/`
  answers the branded 404.

## Phase process

The build runs in ten gated phases. `docs/prompts/00-master.md` holds the rules for every phase,
and `docs/prompts/NN-*.md` holds one prompt per phase. Run one phase per session, on `main`:

```
Read docs/prompts/00-master.md completely, then execute docs/prompts/04-core-pages.md.
```

Replace the phase file for later phases. Each phase ends with a report in
`docs/reports/phase-NN.md`, screenshots in `docs/qa/phase-NN/` and updated content gaps in
`docs/content/gaps.md`. The client approves a phase before the next one starts. The newest report
gives the current state; the release pipeline is the workflow "Server" (`docs/deploy.md` section 3).
