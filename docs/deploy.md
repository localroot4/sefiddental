# Deploy

Date: 2026-10-14. Status: the hosting path waits for the client (gap 32, brief
decision 21). Sections 1, 2, 5 and 6 apply now. Section 3 is a placeholder until
the client approves a priced path. Section 4 is the client's checklist, in
Persian.

Audience: engineers who build, release and operate the site (English), and the
clinic (section 4, Persian).

Contents:

1. Status and decision record
2. Runtime contract for any host
3. Chosen-path steps (blocked by gap 32)
4. کارهای شما (client checklist)
5. Rollback
6. Restore runbook

## 1. Status and decision record

### 1.1 Status

- Hosting path: not approved. Gap 32 is open.
- Built and green: the app runs on environment-driven configuration (database
  adapter, media storage, base URL), so the same artifact runs on any path in
  this file. CI runs on GitHub Actions on every push. CI has no deploy job.
- Held until the client approves a priced path (brief decision 21): the deploy
  workflow (phase 3 deliverable 9), the staging target and section 3 of this
  file. No deploy code exists.
- Open acceptance line: "`docs/deploy.md` lets the client deploy without asking
  a question" stays open until section 3 is filled.
- Deadline: hosting is settled before phase 7. The phase 7 hand-off needs a
  staging URL that the client opens on a phone.

### 1.2 Decision record

| Date | Fact | Decision |
|---|---|---|
| 2026-10-12 | The cPanel account shows the Node.js Selector, but no Node version is installed ("No Node.js version is available. Please contact your hoster", plus a "No such user" error). | C2 depends on the host. A ticket asks the host to enable Node 20 or 22 (gap 32). |
| 2026-10-13 | The host answered: it does not support Node.js. | C2 at the current host is rejected. The client offered to buy a Node host. |
| 2026-10-13 | Hosting evaluation: Liara, ArvanCloud, shared cPanel "Node.js hosts", C1 (sources: Liara docs and CLI repositories on GitHub, Payload and Next.js docs at the pinned tags). | Recommend path A on Liara (1.4). ArvanCloud is second. C1 only if the client's WHM gives root SSH (1.5). Do not buy a shared cPanel "Node.js host" (1.3). |
| 2026-10-13 | Brief decision 21. | No deploy code until the client approves a priced path. |

### 1.3 Why a shared cPanel "Node.js host" does not qualify

Iranian hosts sell cPanel or DirectAdmin plans with a Node.js selector
("هاست Node.js"). Such a plan fails the app's requirements on paper:

| Need | What a shared Node.js host offers | Result |
|---|---|---|
| Node 22.18 or newer (`package.json` `engines`) | Vendors list Node up to 16. The CloudLinux Node.js Selector docs list 6.x to 19.x. Our own host showed no version at all. | Fails unless the host proves 22.18+ |
| One long-running process | The selector runs apps through Phusion Passenger, which loads a CommonJS startup file. The standalone `server.js` is an ES module (`"type": "module"`). | Needs a wrapper; untested |
| PostgreSQL | Usually MySQL only. Payload 3.90.2 has no MySQL adapter. | SQLite on disk, against `docs/architecture.md` |
| Memory | An LVE limit per account (1 to 3 GB advertised). Next.js, the Payload admin and sharp share it. No control over out-of-memory kills. | Tight |
| Build | The build cannot run on the host. CI must ship the artifact over SSH. | Extra work |
| Deploy from GitHub Actions | Needs SSH open to foreign IP addresses. | Unknown per host (risk R2) |
| Inbound traffic from abroad | Same Iranian network risk as the current host. | Unknown per host (risk R1) |
| Staging, rollback, health-gated release | None. | Fails |

Advertised prices are 109,000 to 250,000 toman per month for 2 GB plans
(UNVERIFIED: search results, page dates unknown). The low price does not pay
for the engineering and the risk.

### 1.4 Recommendation: path A on Liara

Path A on Liara (liara.ir), Docker platform, with the standalone build made in
GitHub Actions.

Why:

1. Liara documents every feature the app needs: a long-running Node process,
   managed PostgreSQL in a private network, S3-compatible object storage,
   deploy from GitHub Actions with an API token, health-gated zero-downtime
   releases (Silver bundle and up), a release history, one app per environment
   for staging. Its docs and CLI are versioned on GitHub, so every step can
   cite a source.
2. Docker platform, not the Next.js platform. The Next.js platform builds on
   Liara's builder with a 5, 10 or 20 minute cap per bundle. Payload's own
   template builds with an 8 GB heap. Our build already runs in CI on a
   GitHub-hosted runner.
   The Docker image can also carry `pg_dump` and a cron runner.
3. A custom domain needs three DNS records at any DNS provider. The DNS does
   not move.
4. Teams give the clinic its own wallet. The studio joins as a member.

No persistent disk is needed: media go to a bucket, the database is managed,
logs go to stdout and backups go to a second bucket. The Next.js data cache
lives in memory (`experimental.isrFlushToDisk: false` in `next.config.ts`) and
refills after a restart.

### 1.5 Second choice, C1 and the fallback

- ArvanCloud Cloud Container is second. A custom domain must use ArvanCloud's
  CDN DNS, so the DNS moves. No official GitHub Actions guide was found. Its
  docs were readable only through search snippets.
- A self-managed Iranian VPS is the fallback if Liara fails probe P1 (1.7).
- C1 (the client's own server through WHM) applies only if WHM gives root SSH
  (a VPS or a dedicated server with a cPanel license, not a reseller WHM).
  C1 must also pass P1: the current origin resets every TLS connection from
  outside Iran (observed 2026-10-11, risk R1). On C1 the studio or the clinic
  owns OS updates, Node 22, PostgreSQL, the reverse proxy, TLS, backups and
  monitoring.

### 1.6 Prices (all UNVERIFIED)

No price in this section comes from a primary source. liara.ir and
arvancloud.ir are blocked from the build environment. Read the live prices
before the client approves (section 4).

Liara (search snippets of liara.ir pages, publication dates unknown, the
snippets disagree):

| # | Resource | Plan | Toman per month (UNVERIFIED) |
|---|---|---|---|
| 1 | Team `sefid-dental` | - | 0 |
| 2 | Private network `sefid-net` | - | not stated |
| 3 | App `sefid-prod` (Docker) | Mars: 1 GB, 1 core, 10 GB, Silver bundle | 1,300,000 plus Silver (unknown) |
| 4 | App `sefid-staging` (Docker) | Earth or Mars, Bronze bundle | 750,000 to 1,300,000 |
| 5 | PostgreSQL `sefid-db`, version 17 | Earth: 0.5 GB, 0.5 core, 5 GB, Silver bundle (7 days of daily backups) | 550,000 to 750,000 plus Silver (unknown) |
| 6 | Bucket `sefid-media` | 20 GB | unknown |
| 7 | Bucket `sefid-backups` (private) | 20 GB | unknown |
| 8 | Email `sefid-mail` (optional) | Opal: 500 sends per day | unknown |
| | Known parts | | about 2,600,000 to 3,350,000, plus bundles, buckets and email |

ArvanCloud for comparison: about 2,980,000 toman per month for the same shape
(unofficial third-party snapshot of the ArvanCloud price page, price revision
«۱ مهر ۱۴۰۵», scraped 2026-10-10; UNVERIFIED).

Live prices: `liara plan:list` after login, or the Liara console: profile >
«افزایش اعتبار» > «تخمین هزینه‌ها». Liara bills hourly from prepaid credit, so
a low-credit alert is mandatory.

### 1.7 Probes before the purchase is final

| Probe | How | Pass |
|---|---|---|
| P1 inbound from abroad (risk R1) | A GitHub-hosted runner (outside Iran) requests `https://<staging host>/api/health` 5 times over 24 hours. | HTTP 200 and a full TLS handshake every time |
| P2 deploy from abroad (risk R2) | The first deploy from GitHub Actions. | Release healthy; upload time recorded |
| P3 base image pull | The same deploy with the Iran build location. | Build succeeds; else retry the Germany build location |
| P4 memory | Staging under a scripted admin and image load. | RSS below 85% of the plan's RAM |
| P5 price | Live prices saved to the phase report. | The client approves the total in writing |
| P6 Googlebot (phase 10) | Search Console URL Inspection, live test. | Page fetched |

If P1 fails, Liara is out. Run P1 on ArvanCloud next.

### 1.8 Not verified

- Every Liara price. Every ArvanCloud price (unofficial snapshot only).
- Inbound reachability of Liara and ArvanCloud from abroad today. P1 decides.
- No Iranian provider can keep inbound traffic open during a national
  shutdown. Reports describe a 2026 shutdown from 8 January to 26-27 May
  (search results only). Risk R1 stays monitored on every path inside Iran.
- Liara: the health-check time unit (the docs say milliseconds, the example
  values read as seconds), billing of stopped apps, disk behavior during a
  zero-downtime switch. Check on staging.
- The Debian `postgresql-client` major version in the planned image. Check it
  when the image is built.

## 2. Runtime contract for any host

This section holds on every path: Liara, ArvanCloud, a VPS or C1.

### 2.1 Runtime

- Node.js 22 LTS, version 22.18.0 or newer (`package.json` `engines`). CI uses
  `.nvmrc` (22).
- Linux x64 with glibc, the same OS, CPU and libc as the build machine. sharp
  installs a prebuilt binary for the build platform only, so a build from an
  Ubuntu runner does not run on Alpine (musl). Use a Debian-based image such as
  `node:22-trixie-slim`.
- One long-running process. Target: 1 GB RAM (see `NODE_OPTIONS`).
- A writable `/tmp`: uploads stream to temporary files (up to 64 MiB per
  request).
- PostgreSQL. CI tests on PostgreSQL 16; the Liara proposal is 17. SQLite is
  for tests and local work only: two releases overlap during a zero-downtime
  switch.
- Outbound connections at run time: the database, S3 (when set) and SMTP (when
  set). Payload telemetry is off.
- TLS ends at the platform router or at a reverse proxy (2.5).

### 2.2 Build and start

Build once in CI. The host never runs `next build`.

```sh
npm ci
DATABASE_URL=postgres://build:build@127.0.0.1:5432/build PAYLOAD_SECRET=build-only-placeholder npm run build
```

- The build needs only a parseable `DATABASE_URL` and a non-empty
  `PAYLOAD_SECRET`. It opens no database connection.
- The build inlines no app variable (there is no `NEXT_PUBLIC_*` variable).
  On 2026-10-14 the local build output held none of the checked values from
  `.env` (`PAYLOAD_SECRET`, `CRON_SECRET`, `FORM_TOKEN_SECRET`). One artifact
  therefore serves staging and production; the host supplies every value at
  run time.
- `prebuild` copies brand files, fonts and `public/maintenance.html` into
  `public/`. `postbuild` deletes `.env` and `.env.production` from
  `.next/standalone`.

Assemble the release. Next.js leaves `public/` and `.next/static/` out of the
standalone folder:

```sh
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
```

Start:

```sh
node .next/standalone/server.js
```

- `server.js` sets `NODE_ENV=production` and changes into its own folder.
  Every path in the environment must be absolute.
- It listens on `HOSTNAME`:`PORT` (defaults `0.0.0.0`:`3000`).
- At start the app validates the environment. A missing or short value stops
  the process with one line per problem, for example
  `CRON_SECRET missing: set it to openssl rand -base64 48`. Values are never
  printed.
- Locally, `npm run start:standalone` does the copy and the start and reads the
  repository `.env`.

### 2.3 Environment

Source of truth: `src/lib/env.ts` (validation) and `.env.example` (comments).
"Yes" in the second column means the production start fails without it.
Generate every secret with `openssl rand -base64 48` (at least 43 characters),
one value per environment: staging and production never share a secret.

Site, database and Payload:

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `SITE_URL` | yes | no | Public origin, apex host, no trailing slash: `https://sefiddental.ir`. Payload `serverURL`, canonical URLs, sitemaps, robots, JSON-LD, form origin checks. |
| `GIT_SHA` | yes | no | Commit SHA of the release. Shown by `/api/health` (`version`), the status view and every log line. The deploy step sets it. |
| `BUILD_TIME` | no | no | ISO time of the build, shown on the status view. |
| `DATABASE_URL` | yes, also at build | yes | `postgres://user:password@host:5432/db`. The scheme selects the adapter (`postgres://` or `postgresql://`; `file:` is SQLite, tests only). |
| `DB_PUSH` | set `false` | no | Drizzle schema push. Production never pushes. Set `false` for every migrated database, so scripts and seeders never push. |
| `PAYLOAD_SECRET` | yes, also at build | yes | Signs admin sessions. A change signs every user out. |
| `ALLOW_FIRST_USER` | no (default `false`) | no | `true` only while creating the first admin on an empty database. Set it back to `false` and restart. |

Internal calls and forms:

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `CRON_SECRET` | yes | yes | Bearer token of `GET /api/cron/tick` and Payload's job runner (2.8). |
| `INTERNAL_API_TOKEN` | yes | yes | Header `x-internal-token` on the proxy's calls to `/api/internal/*`. |
| `INTERNAL_ORIGIN` | no (default `http://127.0.0.1:$PORT`) | no | Origin the proxy uses to reach the same process. Set it only when the server does not listen on loopback. Never the public origin. |
| `IP_HASH_SECRET` | yes | yes | HMAC key for stored client IP hashes (audit log, bookings). A change makes old hashes unmatchable. |
| `FORM_TOKEN_SECRET` | yes | yes | Signs form session and time tokens. |
| `FORM_TOKEN_SECRET_PREVIOUS` | no | yes | The old `FORM_TOKEN_SECRET` during a rotation: verify only. Remove it after `FORM_TOKEN_TTL_SECONDS`. |
| `FORM_TOKEN_TTL_SECONDS` | no (default `7200`) | no | Lifetime of a form time token. |

Request handling:

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `ALLOW_INDEXING` | `true` on production only | no | `false`: robots.txt disallows everything, pages carry `X-Robots-Tag: noindex`, sitemaps list no URL. Staging stays `false`. |
| `TRUST_PROXY_HEADERS` | `true` behind a proxy | no | Trust `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host` and an incoming `X-Request-Id` (2.4). |
| `TRUSTED_PROXY_HOPS` | no (default `1`) | no | Number of proxies in front of Node that append to `X-Forwarded-For` (2.4). |
| `MAINTENANCE_MODE` | no (default `off`) | no | `on`: public requests get the 503 maintenance response (2.12). |
| `MAINTENANCE_RETRY_AFTER` | no (default `900`) | no | `Retry-After` seconds on the maintenance response. |
| `CSP_MODE` | no (default `enforce`) | no | CSP of public pages. Keep `enforce`. |
| `CSP_ADMIN_MODE` | no (default `enforce`) | no | CSP of `/admin`. Keep `enforce`; `report-only` is a debugging switch. |
| `QA_ROUTES` | never set | no | `1` enables `/qa/*` (CI and local QA only). |
| `LOG_LEVEL` | no (default `info`) | no | `fatal`, `error`, `warn`, `info`, `debug` or `trace`. Production: `info`. |

Media and e-mail:

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `MEDIA_DIR` | yes, also with S3 | no | Absolute directory for uploads, outside the release folder. With S3 the app does not write there, but the start still requires the value. |
| `MEDIA_PUBLIC_ORIGIN` | no | no | Origin of a bucket or CDN that serves media directly. Adds it to CSP `img-src` and `media-src` and to robots. Leave empty while media are served through the app (2.9). |
| `S3_BUCKET` | no (empty = local disk) | no | Media bucket. |
| `S3_ENDPOINT` | with `S3_BUCKET` | no | S3 endpoint URL from the provider. |
| `S3_REGION` | no (default `default`) | no | Region name; Liara uses `default`. |
| `S3_FORCE_PATH_STYLE` | no (default `false`) | no | `true` for providers that need path-style URLs (Liara, ArvanCloud). |
| `S3_ACCESS_KEY_ID` | with `S3_BUCKET` | yes | Access key of the media bucket. |
| `S3_SECRET_ACCESS_KEY` | with `S3_BUCKET` | yes | Secret key of the media bucket. |
| `SMTP_HOST` | no (empty = mail goes to the log) | no | SMTP server for password-reset mail. Set it in production, else reset links appear in the server log. |
| `SMTP_PORT` | no (default `587`) | no | `587` STARTTLS, `465` implicit TLS. |
| `SMTP_USER` | no | no | SMTP user. |
| `SMTP_PASS` | no | yes | SMTP password. |
| `SMTP_FROM` | with `SMTP_HOST` | no | Sender address. |

Process (set by the host or the image):

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `NODE_ENV` | never set | no | `server.js` sets `production`. |
| `PORT` | platform | no | Listening port. Default `3000`. |
| `HOSTNAME` | `0.0.0.0` in a container | no | Bind address. Docker sets `HOSTNAME` to the container id, so set it explicitly. |
| `TZ` | `UTC` | no | Process time zone. The code stores UTC and never depends on it. |
| `NODE_OPTIONS` | `--max-old-space-size=640` on 1 GB | no | Heap limit. Tune after measuring RSS (probe P4). |
| `NEXT_TELEMETRY_DISABLED` | `1` | no | Next.js telemetry off (build and run). |

Backup job (held with deliverable 9; 2.10):

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `BACKUP_S3_BUCKET` | for the backup job | no | Private bucket for database dumps. |
| `BACKUP_S3_ACCESS_KEY_ID` | for the backup job | yes | Access key of the backup bucket only. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | for the backup job | yes | Secret key of the backup bucket only. |

Never in production: `PROXY_CONFIG_TTL_MS`, `INT_DATABASE_URL`,
`E2E_DATABASE_URL`, `E2E_PORT`, `PW_CHROMIUM_EXECUTABLE`, `CHROME_PATH`,
`QA_SCREENSHOTS`, `PW_BUDGETS`, `LHCI_THEME`, `CI`, `SEFID_TEST_DB_DIR`,
`PAYLOAD_FORCE_DRIZZLE_PUSH`. Set by Next.js and Payload, never by us:
`NEXT_PHASE`, `NEXT_RUNTIME`, `VITEST_POOL_ID`, `PAYLOAD_MIGRATING`.

### 2.4 Behind a proxy: TRUST_PROXY_HEADERS and TRUSTED_PROXY_HOPS

Every PaaS puts a router in front of the app. Behind it, set
`TRUST_PROXY_HEADERS=true`.

- With `false`, every visitor shares one rate-limit key (`unknown`).
  `/api/form-session` then allows 60 requests per minute for the whole site,
  and sign-in allows 10 attempts per 15 minutes for everyone. The app also
  ignores `X-Forwarded-Proto`, so it cannot redirect plain HTTP to HTTPS.
- Set `true` only when the Node port is reachable through the proxy alone.
  Otherwise a client sends its own `X-Forwarded-For` and `X-Request-Id`.

`TRUSTED_PROXY_HOPS` is the number of proxies that append to
`X-Forwarded-For` in front of Node. The client IP is entry N counted from the
right.

| Setup | Value |
|---|---|
| One proxy: one nginx, or a platform router that appends one entry | `1` |
| CDN, then the platform router | `2` |

- Too high: the chosen entry comes from the client, who can then dodge the
  rate limit.
- Too low: the chosen entry is a proxy address, so many visitors share one
  key.
- Confirm the hop count on staging before launch. Liara's docs do not state
  it.

### 2.5 Reverse proxy or TLS terminator (every path)

The app sets the static security headers itself (`next.config.ts`
`headers()`), and the proxy (`src/proxy.ts`) adds the route-dependent ones.
One response kind is out of the app's reach, so the reverse proxy in front of
Node must also set the static set.

1. Set these headers on every response, error responses included (nginx:
   `add_header ... always`). Hide the copies that Node sends
   (nginx: `proxy_hide_header`), so each header appears once.

   | Header | Value |
   |---|---|
   | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
   | `X-Content-Type-Options` | `nosniff` |
   | `Referrer-Policy` | `strict-origin-when-cross-origin` |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

   Why: Next.js 16.4 answers a path that contains `//` or `\` with its own
   308 before `headers()` and the proxy run (`base-server.js`
   `handleRequestImpl`). That 308 carries none of the headers above. It is
   the one exception to "security headers on every response" in the app
   (e2e T-CN2b pins it).

2. Remove the `x-middleware-*` response headers (nginx:
   `proxy_hide_header x-middleware-rewrite;`). A Persian dynamic page answers
   with `x-middleware-rewrite: /r/services/<slug>`, which names the internal
   ASCII route. The internal path itself answers the branded 404, so this
   leaks no content; removing the header is hardening only. Keep
   `x-nextjs-rewritten-path` and `x-nextjs-rewritten-query`: the App Router
   client reads them during client navigation.

3. Allow request bodies of 64 MiB (nginx: `client_max_body_size 64m;`).
   Payload accepts uploads up to that size (`requestSizeLimit` in
   `src/payload.config.ts`); the nginx default of 1 MB rejects most images.

Where the platform router sets headers itself (Liara), check items 1 to 3 on
staging and record what the platform allows in section 3.

### 2.6 Health check

`GET /api/health` and `HEAD /api/health`. No authentication. It answers in
maintenance mode too.

- 200 when the database answers within 2000 ms:

  ```json
  {"status":"ok","time":"2026-10-14T08:00:00.000Z","version":"<GIT_SHA>","uptimeSeconds":42,"maintenance":false,"checks":{"database":{"status":"ok","latencyMs":3}}}
  ```

- 503 with `"status":"down"` and `"database":{"status":"down","latencyMs":null}`
  when the database fails or is slow.
- `Cache-Control: no-store`. The result is reused for 5 seconds, so the
  endpoint cannot load the database.
- `HEAD` returns the same status without a body.

Platform probe, inside the container or on the host (no `curl` needed):

```sh
node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

With `curl` in the image:

```sh
curl -fsS -o /dev/null http://127.0.0.1:3000/api/health
```

- Probe the loopback origin. A host other than `SITE_URL` and its `www` form
  never gets the canonical redirect, so the probe sees the real status.
- After a release, check that `version` equals the released commit SHA.

### 2.7 Migrations on release

Production migrations live in `src/migrations/postgres/`. README section
"Generated files" explains how to create them (`npm run migrate:create`, once
per adapter).

Two ways to apply them. Both use the same files, and a migration runs once.

1. Release step (preferred where the release runner reaches the database).
   Run it from a checkout of the release commit after `npm ci`, before the new
   release starts. The artifact has no Payload CLI.

   ```sh
   DATABASE_URL="$DATABASE_URL" PAYLOAD_SECRET="$PAYLOAD_SECRET" DB_PUSH=false npm run migrate:status
   DATABASE_URL="$DATABASE_URL" PAYLOAD_SECRET="$PAYLOAD_SECRET" DB_PUSH=false npm run migrate
   ```

   A failure stops the release before any traffic moves.
2. At start (built in, the fallback when the database is private, as on
   Liara). With `NODE_ENV=production` the Postgres adapter runs every pending
   migration when Payload first starts (`prodMigrations` in
   `src/payload/db.ts`). The first request that needs Payload starts it; the
   health check is normally that request. `/api/health` answers 503 until the
   migrations finish. Each migration runs in a transaction. After a failure,
   every later request retries the start and `/api/health` stays at 503, so a
   health-gated platform keeps the old release.

Expand and contract rule. During a zero-downtime switch the old release
serves on the new schema, and a rollback runs old code on the new schema. So:

1. Expand: add tables and columns as nullable or with a default. Never rename
   or drop in the same release. New code reads both shapes.
2. Migrate: backfill data in a migration or a job.
3. Contract: drop the old column or table in a later release, after no
   release that you might roll back to still reads it.

Never on a production database: `payload migrate:fresh`, `migrate:reset` or
`migrate:down` (they drop data), and never a schema push. A down migration
needs a fresh backup, the client's confirmation and a written reason.

### 2.8 Cron: /api/cron/tick every minute

`GET /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`, every
minute. One tick runs Payload's schedules (scheduled publishing) and up to 20
queued jobs, then records the run for the status view.

- 200: JSON `{ ranJobs, failed, remaining, scheduled, durationMs }`.
- 401 without the bearer. 500 when a run fails (log line `cron_tick_failed`).
- 503 while maintenance mode is on: scheduled publishing and jobs wait.
- Overlapping ticks in one process share the running tick. Two releases that
  tick together during a switch are safe: Payload marks a running job as
  processing, and scheduled publishing is idempotent.

Call the loopback origin, not the public one: no router, no TLS, no rate
limit, and it keeps working during DNS changes.

Host crontab (cron runs in UTC; the schedule does not depend on it):

```cron
* * * * * curl -fsS --max-time 55 -o /dev/null -H @/etc/sefid-dental/cron-auth.header http://127.0.0.1:3000/api/cron/tick
```

`/etc/sefid-dental/cron-auth.header` holds one line,
`Authorization: Bearer <CRON_SECRET>`, mode `0600`, owned by the cron user.
The file keeps the secret out of the crontab and the process list.

In a container (for example Supercronic in the image), send the same request;
the secret comes from the container environment.

Check: the admin view «وضعیت سیستم» (`/admin/system-status`) shows the last
cron run less than two minutes ago.

Verified on 2026-10-14 against the local standalone build: 401 without the
bearer, 200 with the header file, 503 in maintenance mode.

### 2.9 Media storage

Choose one per environment.

S3-compatible bucket (required where the file system is temporary, as on
Liara and ArvanCloud):

- Set `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Keep `MEDIA_DIR` set (2.3).
- Uploads go to the bucket. The app serves each file at
  `/api/media/file/<name>` and reads it from the bucket, so Payload's access
  rules stay in force. With this configuration the bucket can stay private.
- Public read is allowed on the media bucket only. It is needed only if media
  are later served straight from the bucket or a CDN: that needs
  `MEDIA_PUBLIC_ORIGIN` and a storage configuration change, which is not built.
- The backup bucket is never public: dumps hold personal data.
- Use a key that reaches the media bucket only, when the provider supports it.

Local disk (C1 or a VPS):

- Leave `S3_BUCKET` empty. Set `MEDIA_DIR` to an absolute path on a persistent
  volume outside the release folder, for example
  `/var/lib/sefid-dental/media`. A new release must not replace it.
- Run one instance only.
- Back up `MEDIA_DIR` with the database (2.10): the dump holds media rows, not
  files.

### 2.10 Backups

- Every night at 23:30 UTC (03:00 Tehran; Tehran is UTC+03:30 all year):
  `pg_dump` of production in custom format to the private bucket
  `BACKUP_S3_BUCKET`, kept 14 days.
- Plus the platform's own database backups (Liara Silver: daily, 7 days).
- Media: with S3, the bucket is the store of record; deliverable 9 decides
  between bucket versioning and a nightly copy. With local disk, archive
  `MEDIA_DIR` to the backup bucket in the same job.
- The job itself is held with deliverable 9 (in the image or the host
  crontab). Its contract is the commands below.
- The `pg_dump` major version must equal the server major: `pg_dump` refuses
  to dump a newer server.

S3 client: rclone, configured from the environment only (no config file):

```sh
export RCLONE_CONFIG_BACKUP_TYPE=s3
export RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ENDPOINT="$S3_ENDPOINT"
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
```

Nightly job:

```sh
set -eu
stamp="$(date -u +%Y%m%dT%H%MZ)"
file="/tmp/sefid-$stamp.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$file"
pg_restore --list "$file" > /dev/null
rclone copyto "$file" "backup:$BACKUP_S3_BUCKET/db/sefid-$stamp.dump"
rclone delete --min-age 14d "backup:$BACKUP_S3_BUCKET/db/"
rm -f "$file"
```

- `set -eu` stops at the first failure, so the 14-day cleanup never runs after
  a failed dump.
- `pg_restore --list` proves the file is a readable archive. It does not prove
  the data restores: run a test restore once a month (section 6, steps 3 to 7,
  into a scratch database).
- A failed job must alert the admin. Deliverable 9 wires the alert.
- On a shared machine, put the password in `~/.pgpass` instead of the URL: a
  URL argument shows in the process list.

### 2.11 Logs

- JSON lines on stdout, one event per line: `time`, `level`, `msg`, `service`
  (`sefid-web`), `env`, `sha`, plus `reqId` and `route` on request lines. No
  log files.
- Phones, names, notes, cookies, tokens and authorization headers are
  redacted.
- Every response that passes the proxy carries `X-Request-Id`. Search the logs
  for that id.
- The last 200 warn and error lines since the start also show in the admin
  view «وضعیت سیستم».
- The platform keeps stdout (Liara: 7, 30 or 60 days by bundle).

### 2.12 Maintenance mode

Turn on: set `MAINTENANCE_MODE=on` and restart. The app reads the environment
once per process. Turn off: `MAINTENANCE_MODE=off` and restart.

| Request | In maintenance mode |
|---|---|
| Public pages | 503, the static maintenance page, `Retry-After: MAINTENANCE_RETRY_AFTER` |
| Public API | 503, JSON `{"status":"maintenance"}` |
| `/api/health` | works; the body shows `"maintenance":true` |
| `/admin`, sign-in, API calls with an admin session | work |
| Media files, `/_next/static`, fonts | work |
| `/api/cron/tick` | 503: scheduled publishing and jobs wait |

Use it for a restore (section 6), a risky migration or an incident. Editors
can still save in the admin, so tell them to stop during a restore.

Verified on 2026-10-14 against the local standalone build: the home page and
the cron tick answered 503, `/api/health` answered 200 with
`"maintenance":true`.

## 3. Chosen-path steps (blocked by gap 32)

Blocked by gap 32 and brief decision 21. No deploy code exists. This section is
filled after the client approves the priced path (section 4). It will hold
exactly these items, written for path A on Liara unless the client chooses
otherwise:

1. Liara app and database creation: the team, the private network, the apps
   `sefid-prod` and `sefid-staging` (Docker platform), PostgreSQL `sefid-db`
   with a second database and user for staging, the buckets `sefid-media` and
   `sefid-backups`, the plans and bundles that the client approved, and the
   environment values of 2.3 in each app.
2. `liara.json`: `platform` `docker`, `port` 3000, the health check of 2.6
   with the time unit verified on staging, time zone UTC.
3. The GitHub Actions deploy job: build the artifact (2.2), the Dockerfile
   (glibc base image, non-root user, the cron and backup schedule), a pinned
   `@liara/cli` version, deploy to staging on push to `main`, deploy to
   production by manual dispatch with a reviewer, and the post-deploy health
   and `version` check.
4. Secrets in GitHub environments: `LIARA_API_TOKEN` in the `staging` and
   `production` environments, with its expiry date written here. App secrets
   stay in the Liara app environment, never in GitHub.
5. Staging app: `sefid-staging`, its own secrets and database,
   `ALLOW_INDEXING=false`, basic auth, the URL the client opens on a phone in
   phase 7.
6. DNS records: the three records per domain that the Liara console shows
   (ALIAS or CNAME for traffic, TXT for ownership, CNAME for the certificate),
   the staging subdomain first, the apex and `www` only in phase 10, MX
   records untouched.
7. Rollback by redeploying the previous commit: the exact workflow command and
   the console path (section 5).

## 4. کارهای شما

این فهرست کارهای کلینیک برای راه‌اندازی میزبان سایت است. هر سطر یک کار است. کارها را به ترتیب انجام دهید.

1. لیارا (Liara) را به‌عنوان میزبان سایت تأیید کنید.
2. در console.liara.ir حساب بسازید. شماره و ایمیل خود کلینیک را وارد کنید. اگر لیارا خواست، احراز هویت را کامل کنید.
3. در حساب، تیمی به نام `sefid-dental` بسازید. حساب لیارای استودیو را با نقش «مدیر» به تیم دعوت کنید.
4. قیمت زنده را ببینید: پروفایل › «افزایش اعتبار» › «تخمین هزینه‌ها». استودیو جمع ماهانه را با همین قیمت‌ها برایتان می‌فرستد.
5. جمع ماهانه را کتبی تأیید کنید. برآورد فعلی حدود ۲٫۶ تا ۳٫۴ میلیون تومان در ماه است، به‌اضافهٔ بسته‌ها و فضای ذخیره‌سازی. این برآورد تأیید نشده است.
6. اعتبار تیم را شارژ کنید. هشدار «کمبود اعتبار» را روشن کنید. لیارا ساعتی از اعتبار کم می‌کند.
7. در منوی «API» تیم، کلید API بسازید. مدت اعتبار را ۶ ماه بگذارید. «ساخت کلید جدید» را بزنید.
8. کلید را فقط از راه امنی بفرستید که استودیو تعیین می‌کند، مثلاً پیوند یک‌بارمصرف. کلید را در پیامک، ایمیل یا پیام‌رسان نفرستید. تاریخ پایان اعتبار کلید را هم بفرستید.
9. بگویید DNS دامنهٔ sefiddental.ir کجا مدیریت می‌شود و رمز ورود آن دست چه کسی است. فعلاً هیچ رکوردی را تغییر ندهید.
10. بگویید ایمیل‌های `@sefiddental.ir` کجا هستند (مثلاً روی همین هاست cPanel). بگویید بعد از راه‌اندازی سایت، هاست cPanel را نگه می‌دارید یا نه.

استودیو بعد از این کارها اپ‌ها، پایگاه داده و فضای ذخیره‌سازی را می‌سازد. شما خودتان منبعی نسازید.

## 5. Rollback

Choose by what broke.

| What broke | Action |
|---|---|
| Code of the new release | Redeploy the previous good commit (below). |
| An environment value | Restore the old value in the platform and restart. |
| Data (wrong edits, a bad migration that lost data) | Restore runbook (section 6). |

Redeploy the previous good commit:

1. Turn on maintenance mode (2.12) if the release harms visitors or data.
2. Find the previous good SHA: the last release that passed its health check.

   ```sh
   git log --oneline -n 10 origin/main
   ```

3. Deploy that commit. The same artifact build of that SHA, with its own
   `GIT_SHA`. The workflow command and the platform's release-history path go
   into section 3, item 7. On C1, start the previous release folder.
4. Check the release:

   ```sh
   curl -fsS https://sefiddental.ir/api/health
   ```

   `"status":"ok"` and `version` equal to the previous SHA.
5. Turn off maintenance mode.

Rules:

- A rollback never runs a down migration. The old code runs on the new schema;
  the expand and contract rule (2.7) makes that safe.
- A rollback to a release older than the last contract step is not safe. Use
  section 6.
- Record every rollback in the phase report: time, SHAs, cause.

## 6. Restore runbook

Restore into a new database. Never restore over the live database: it stays as
the way back.

Tested on 2026-10-14 with PostgreSQL 16 on a local migrated, seeded database:
steps 2 and 4 to 7 restored all 109 tables with identical row counts. The
standalone server then started on the restored database, and `/api/health`
answered 200 (steps 8 and 9 without a platform). Steps 1, 3 and 10 were not
run: no bucket and no platform exist yet.

Values used below:

- `ADMIN_URL`: a role that can create databases (Liara: the `root` user of the
  database service), connected to the `postgres` database.
- `APP_ROLE`: the role in the production `DATABASE_URL`.
- `NEW_DB`: the name of the restored database, for example
  `sefid_restore_20261014`.
- `NEW_URL`: the production `DATABASE_URL` with `NEW_DB` as the database name.

Steps:

1. Turn on maintenance mode (2.12). Tell the editors to stop work in the
   admin. Check:

   ```sh
   curl -fsS https://sefiddental.ir/api/health
   ```

   The body shows `"maintenance":true`.
2. Dump the current state first, even if it is broken. This is the undo of the
   restore:

   ```sh
   pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="pre-restore-$(date -u +%Y%m%dT%H%MZ).dump"
   ```

3. Choose the dump: the newest one taken before the incident. Set the rclone
   variables of 2.10, then:

   ```sh
   rclone lsl "backup:$BACKUP_S3_BUCKET/db/"
   rclone copyto "backup:$BACKUP_S3_BUCKET/db/<file>.dump" restore.dump
   ```

4. Check that the file is a readable archive:

   ```sh
   pg_restore --list restore.dump > /dev/null
   ```

5. Create the empty database, owned by the app role:

   ```sh
   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $NEW_DB OWNER $APP_ROLE"
   ```

6. Restore as the app role, in one transaction. Any error stops the restore
   and leaves the database empty:

   ```sh
   pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$NEW_URL" restore.dump
   ```

7. Check the restored data:

   ```sh
   psql "$NEW_URL" -c "SELECT name, batch FROM payload_migrations ORDER BY id" -c "SELECT count(*) AS users FROM users" -c "SELECT count(*) AS services FROM services"
   ```

   The migration list matches the dump's date. The counts are plausible.
8. Point the app at the restored database: set `DATABASE_URL` to `NEW_URL` in
   the platform and restart. Keep maintenance mode on. If the dump is older
   than the code, the start applies the newer migrations (2.7). The restart
   also empties the in-memory data cache.
9. Check:

   ```sh
   curl -fsS https://sefiddental.ir/api/health
   ```

   `"status":"ok"` and `"database":{"status":"ok", ...}`. Sign in to the
   admin, open «وضعیت سیستم», open one public page.
10. Turn off maintenance mode and restart.
11. Keep the old database for 14 days. Dropping it deletes data, so it needs
    the client's confirmation.

Media: a database restore does not restore media files. A file uploaded after
the dump stays in the bucket without a row. A file deleted after the dump has
a row without a file, and its URL answers 404.
