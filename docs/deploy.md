# Deploy

Date: 2026-10-26. Status: the site runs on the clinic's own VPS (1.2,
section 3). Every section applies now. Section 4 is the client's checklist, in
Persian. Section 7 keeps the former cPanel path for reference.

Audience: engineers who build, release and operate the site (English), and the
clinic (section 4, Persian).

Contents:

1. Status and decision record
2. Runtime contract for any host
3. Chosen path: own VPS
4. کارهای شما (client checklist)
5. Rollback
6. Restore runbook
7. Former path: shared cPanel host (kept for reference)

## 1. Status and decision record

### 1.1 Status

- Hosting path: the clinic's own VPS, Ubuntu Server 26.04 LTS in Tehran at
  `2.144.23.111`, bought on 2026-10-26 (1.2). Release procedure: section 3.
  It replaces the shared cPanel host (section 7).
- Phase: preview at `https://new.sefiddental.ir`, not indexed.
  `sefiddental.ir` stays at the old host until the client approves the
  switch (3.7).
- Built and green: the app runs on environment-driven configuration (database
  adapter, media storage, base URL), so the same artifact runs on any path in
  this file. CI runs on GitHub Actions on every push.
- Release: the workflow "Server" (`.github/workflows/server.yml`) runs every
  action on the server over SSH from GitHub Actions (3.4). Nobody needs a
  shell on the server.
- Not verified yet: nothing has run on the server, and the smoke test
  `vps-smoke` (3.8) has not run yet. Open items: 3.9.

### 1.2 Decision record

| Date | Fact | Decision |
|---|---|---|
| 2026-10-12 | The cPanel account shows the Node.js Selector, but no Node version is installed ("No Node.js version is available. Please contact your hoster", plus a "No such user" error). | C2 depends on the host. A ticket asks the host to enable Node 20 or 22 (gap 32). |
| 2026-10-13 | The host answered: it does not support Node.js. | C2 at the current host is rejected. The client offered to buy a Node host. |
| 2026-10-13 | Hosting evaluation: Liara, ArvanCloud, shared cPanel "Node.js hosts", C1 (sources: Liara docs and CLI repositories on GitHub, Payload and Next.js docs at the pinned tags). | Recommend path A on Liara (1.4). ArvanCloud is second. C1 only if the client's WHM gives root SSH (1.5). Do not buy a shared cPanel "Node.js host" (1.3). |
| 2026-10-13 | Brief decision 21. | No deploy code until the client approves a priced path. |
| 2026-10-18 | The client bought a shared cPanel or DirectAdmin "Node.js" host and asked to put the site on it. Node version, database and SSH access unknown. | Path C2 with a package built for the panel's loader (section 7): SQLite in a data folder outside the release, secrets generated on the host, a loopback listener for the internal calls, the zip uploaded by hand. The risks of 1.3 are accepted. |
| 2026-10-26 | The client bought an Ubuntu Server 26.04 LTS VPS (a cloud VM in Tehran, public IPv4 `2.144.23.111`) as the production host. Outbound SSH from the studio is blocked. Several services block Iranian addresses. | Own VPS (section 3), replacing C2: GitHub Actions runs every action over SSH (workflow "Server"); PostgreSQL, nginx and certbot from the Ubuntu archive; each release carries its own Node runtime; preview at `new.sefiddental.ir` until the client approves the switch. The cPanel path stays documented in section 7. |

### 1.3 Why a shared cPanel "Node.js host" does not qualify

Iranian hosts sell cPanel or DirectAdmin plans with a Node.js selector
("هاست Node.js"). Such a plan fails the app's requirements on paper:

| Need | What a shared Node.js host offers | Result |
|---|---|---|
| Node 22.23.4 or newer (`package.json` `engines`) | Vendors list Node up to 16. The CloudLinux Node.js Selector docs list 6.x to 19.x. Our own host showed no version at all. | Fails unless the host proves 22.23.4+ |
| One long-running process | The selector runs apps through Phusion Passenger, which loads a CommonJS startup file. The standalone `server.js` is an ES module (`"type": "module"`). | Needs a wrapper; untested |
| PostgreSQL | Usually MySQL only. Payload 3.92.0 has no MySQL adapter. | SQLite on disk, against `docs/architecture.md` |
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
| P5b HTTP/2 | `curl -sI --http2 https://<staging host>/ \| head -1` (2.5 item 7). | `HTTP/2 200`; else the Lighthouse numbers do not hold in production |
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

- Node.js 22 LTS, version 22.23.4 or newer, or Node 24.22.1 or newer
  (`package.json` `engines`). CI uses `.nvmrc` (22.23.4).
- Linux x64 with glibc, the same OS, CPU and libc as the build machine. sharp
  installs a prebuilt binary for the build platform only, so a build from an
  Ubuntu runner does not run on Alpine (musl). Use a Debian-based image such as
  `node:22-trixie-slim`.
- One long-running process. Target: 1 GB RAM (see `NODE_OPTIONS`).
- A writable `/tmp`: uploads stream to temporary files (up to 64 MiB per
  request).
- PostgreSQL. CI tests on PostgreSQL 18, the server's major; the Liara
  proposal is 17. SQLite is for tests and local work only: two releases
  overlap during a zero-downtime switch.
- Outbound connections at run time: the database, S3 (when set) and SMTP (when
  set); `api.telegram.org` only when the Telegram notifier is switched on and
  `TELEGRAM_BOT_TOKEN` is set (usually filtered from servers in Iran), and the
  Farapayamak API once its driver is written. Payload telemetry is off.
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
  `.next/standalone`, then runs two steps on the build output:
  - `scripts/compile-hints.mjs` puts the V8 compile hint
    `//# allFunctionsCalledOnLoad` first in the bootstrap chunks
    (`rootMainFiles` of `.next/build-manifest.json`) and the gsap chunks of
    `.next/static/chunks`. It edits the chunks after Next.js wrote them, so it
    conflicts with Subresource Integrity (`experimental.sri`: the browser
    rejects the edited chunks) and with browser source maps
    (`productionBrowserSourceMaps`: every mapping one line off). Neither is
    on. Turn one on only after you remove this step. The step fails the
    build when the manifest lists no root chunk, a listed chunk is missing,
    or no gsap chunk exists.
  - `scripts/check-has.mjs` fails the build when the site CSS has a `:has()`
    selector outside `@media (scripting: none)` or one not in its allow
    list. In Chromium one active `:has()` rule makes every DOM insertion
    restyle the whole page (phase 7, Lighthouse tier 1).
- Copy `.next/static` only after `postbuild` finished: a copy taken between
  `next build` and `postbuild` has no compile hints.

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
  the process (exit 1) with one fatal JSON line, for example:

  ```json
  {"level":"fatal","msg":"env_invalid","detail":"Environment is incomplete:\nCRON_SECRET missing: set it to `openssl rand -base64 48`; the cron caller sends it as a bearer token"}
  ```

  `detail` has one entry per problem, separated by `\n`. Values are never
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
| `IP_HASH_SECRET` | yes | yes | HMAC key for stored client IP hashes (audit log, bookings) and for the SMS cap's destination hashes (`sms-throttle`). A change makes old hashes unmatchable and resets the SMS cap. |
| `FORM_TOKEN_SECRET` | yes | yes | Signs form session and time tokens, and keys the encrypted one-time flash cookie of the no-JS forms (`__Host-sefid-flash`). Rotating it drops flashes younger than 10 minutes unless the old value stays in `FORM_TOKEN_SECRET_PREVIOUS`. |
| `FORM_TOKEN_SECRET_PREVIOUS` | no | yes | The old `FORM_TOKEN_SECRET` during a rotation: verify only. Remove it after `FORM_TOKEN_TTL_SECONDS`. |
| `FORM_TOKEN_TTL_SECONDS` | no (default `7200`) | no | Lifetime of a form time token. |

Request handling:

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `ALLOW_INDEXING` | `true` on production only | no | `false`: robots.txt disallows everything, pages carry `X-Robots-Tag: noindex`, sitemaps list no URL. Staging stays `false`. |
| `DEMO_CONTENT` | never (default `false`) | no | `true` on the client preview only: while nothing of that kind is published, the home page shows demo dentists, patient voices and a before/after pair, and «پزشکان» shows demo dentists (`src/lib/demoContent.ts`). Nothing is stored; the first published item of a kind replaces its demo. Demo items have no page, link, JSON-LD, sitemap entry, booking binding, consent line or analytics event. The start fails when it is on with `ALLOW_INDEXING=true` or `SITE_URL` on `sefiddental.ir`. On the VPS, `provision` writes it with `PHASE=preview` only (3.7). |
| `TRUST_PROXY_HEADERS` | `true` behind a proxy | no | Trust `X-Forwarded-For`, `X-Forwarded-Proto` and an incoming `X-Request-Id` (2.4). `X-Forwarded-Host` is never read: the canonical check uses `Host`. With `false` in production, the System status view shows the row red; the start does not fail. |
| `TRUSTED_PROXY_HOPS` | no (default `1`) | no | Number of proxies in front of Node that append to `X-Forwarded-For` (2.4). When the trust is on and the admin's own address cannot be read, the System status view shows the trust row red in every mode. |
| `MAINTENANCE_MODE` | no (default `off`) | no | `on`: public requests get the 503 maintenance response (2.12). |
| `MAINTENANCE_RETRY_AFTER` | no (default `900`) | no | `Retry-After` seconds on the maintenance response. |
| `CSP_MODE` | no (default `enforce`) | no | CSP of public pages. Keep `enforce`. |
| `CSP_ADMIN_MODE` | no (default `enforce`) | no | CSP of `/giris`. Keep `enforce`; `report-only` is a debugging switch. |
| `QA_ROUTES` | never set | no | `1` enables `/qa/*` (CI and local QA only). It also lets any client move the server's opening-hours clock with the `x-qa-hours-at` request header, which changes the callback line and the stored `callbackDueAt` of real bookings. Never set it in production; there the System status view shows it red. |
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
| `SMTP_HOST` | no (empty = no reset mail) | no | SMTP server for password-reset mail. Without it reset mail is not sent (the log shows only the recipient and subject) and the status view says reset does not work. Recover an admin with `npm run reset-admin -- <email>` from a checkout with the production `DATABASE_URL` and `PAYLOAD_SECRET` (the artifact has no Payload CLI, as in 2.7). |
| `SMTP_PORT` | no (default `587`) | no | `587` STARTTLS, `465` implicit TLS. |
| `SMTP_USER` | no | no | SMTP user. |
| `SMTP_PASS` | no | yes | SMTP password. |
| `SMTP_FROM` | with `SMTP_HOST` | no | Sender address. |

Notifier credentials (the `notifier` global holds only the switches and recipients; a channel
sends only when its switch is on and its values below are set):

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | no | yes | Bot token of the Telegram notifier (`<digits>:<key>`). Never logged; outbound to `api.telegram.org`. |
| `FARAPAYAMAK_USERNAME` | with `FARAPAYAMAK_PASSWORD` | no | Farapayamak panel user for SMS (the driver is a scaffold until the clinic approves SMS). |
| `FARAPAYAMAK_PASSWORD` | with `FARAPAYAMAK_USERNAME` | yes | Farapayamak panel password. |

Process (set by the host or the image):

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `NODE_ENV` | never set | no | `server.js` sets `production`. |
| `PORT` | platform | no | Listening port. Default `3000`. |
| `HOSTNAME` | `0.0.0.0` in a container | no | Bind address. Docker sets `HOSTNAME` to the container id, so set it explicitly. Never `127.0.0.1` or `::1`: the start refuses a loopback IP (Next 16.4 then proxies every rewrite to itself). To bind loopback, use `localhost`; if `localhost` resolves to `::1` on the host, also set `INTERNAL_ORIGIN=http://localhost:$PORT`. |
| `TZ` | `UTC` | no | Process time zone. The code stores UTC and never depends on it. |
| `NODE_OPTIONS` | `--max-old-space-size=640` on 1 GB | no | Heap limit. Tune after measuring RSS (probe P4). |
| `NEXT_TELEMETRY_DISABLED` | `1` | no | Next.js telemetry off (build and run). |

Backup job (held with deliverable 9; 2.10):

| Name | Required in production | Secret | Purpose |
|---|---|---|---|
| `BACKUP_S3_BUCKET` | for the backup job | no | Private bucket for database dumps. |
| `BACKUP_S3_ACCESS_KEY_ID` | for the backup job | yes | Access key of the backup bucket only. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | for the backup job | yes | Secret key of the backup bucket only. |

Never in production: `PROXY_CONFIG_TTL_MS`, `FORM_SESSION_RATE_LIMIT`, `INT_DATABASE_URL`,
`E2E_DATABASE_URL`, `E2E_PORT`, `PW_CHROMIUM_EXECUTABLE`, `CHROME_PATH`,
`QA_SCREENSHOTS`, `LHCI_THEME`, `CI`, `PAYLOAD_FORCE_DRIZZLE_PUSH`. Set by Next.js and Payload, never by us:
`NEXT_PHASE`, `NEXT_RUNTIME`, `VITEST_POOL_ID`, `PAYLOAD_MIGRATING`.

In production the System status view shows the row «تنظیمات ویژهٔ آزمون» red while
`QA_ROUTES` is on or `FORM_SESSION_RATE_LIMIT` differs from its default `60` (the default
value changes nothing). The start does not fail.

### 2.4 Behind a proxy: TRUST_PROXY_HEADERS and TRUSTED_PROXY_HOPS

Every PaaS puts a router in front of the app. Behind it, set
`TRUST_PROXY_HEADERS=true`.

- With `false`, every visitor shares one rate-limit key (`unknown`).
  `/api/form-session` then allows 60 requests per minute for the whole site,
  and sign-in allows 10 attempts per 15 minutes for everyone. The app also
  ignores `X-Forwarded-Proto`, so it cannot redirect plain HTTP to HTTPS.
- The booking and emergency forms count every visitor under one fixed key
  with ten times the per-IP limits. The windows roll, and every request of
  the key counts, suspicious ones included. For the whole site:
  - After 100 requests in the last 60 minutes, every later request is stored
    suspicious (`ip_rate`) and sends no notification.
  - After 500 suspicious rows in the last 60 minutes, a request is not stored
    at all, and the patient still sees the success answer. About 9 forged
    POSTs a minute keep the site there; they need no form session.
  - After 30 emergencies in the last 24 hours, every later emergency gets
    `emergency_ip_rate`. It still notifies, but ranks after the clean open
    emergencies.
- In production the System status view shows the row red. The start does
  not fail (S2), so check the view after every deploy (section 3).
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
  rate limit. A visitor who sends no `X-Forwarded-For` has too few entries:
  unknown, on the one shared key above. The System status view reads the
  admin's own request the same way and shows the row red.
- Too low: the chosen entry is a proxy address, so many visitors share one
  key.
- With a CDN in front (`2`), let the origin accept connections from the
  CDN's addresses only (nginx `allow` and `deny all`, or the host firewall). A
  client that reaches the origin directly sends one entry, lands on the shared
  unknown key, and can push every visitor into its limits.
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

3. Cap request bodies per path. Next's proxy (`src/proxy.ts`) holds up to
   10 MB of every request body in memory before a route sees it, and cuts a
   longer body without an error (`experimental.proxyClientMaxBodySize`,
   `node_modules/next/dist/server/body-streams.js`). Its matcher covers every
   path except `api/media` and static files. So nginx refuses an oversized
   body first, and only the paths that need a large body get one.

   The admin is at `/giris` (`ADMIN_ROUTE` in `src/lib/paths.ts`); `/admin` is
   an ordinary 404. The nginx location and the client steps use `/giris`.

   | Paths | `client_max_body_size` | Why |
   |---|---|---|
   | every path not listed below (server block), `/رزرو-نوبت` and `/اورژانس` included | `32k` | Public pages take no body; the two form pages answer 413 above 16 KiB. |
   | `/api/booking`, `/api/emergency`, `/api/events`, `/api/csp-report` | `32k` | The handlers answer 413 above 16 KiB (the events beacon above 2 KB). They sit under `/api/`, so they need their own location. |
   | `/giris`, every other path under `/api/` | `10m` | Admin server functions post under `/giris`, Payload REST and sign-in under `/api/`. Above 10 MB the proxy would cut the body without an error; nginx answers 413 instead. |
   | `/api/media` | `64m` | Payload accepts uploads up to that size (`requestSizeLimit` in `src/payload.config.ts`); the nginx default of 1 MB rejects most images. |

   nginx (untested). A regex location wins over the `/api/` prefix, and the
   longer prefix `/api/media` wins over `/api/`. The `if` lines are item 5.

   ```nginx
   server {
       # items 1, 2 and 4 here (see item 4: never inside a location)
       client_max_body_size 32k;

       location / {
           proxy_pass http://127.0.0.1:3000;
       }
       location ~ ^/api/(?:booking|emergency|events|csp-report)/?$ {
           if ($request_uri ~ "%(?![0-9A-Fa-f]{2})") { return 400; }
           proxy_pass http://127.0.0.1:3000;
       }
       location /api/ {
           client_max_body_size 10m;
           if ($request_uri ~ "%(?![0-9A-Fa-f]{2})") { return 400; }
           proxy_pass http://127.0.0.1:3000;
       }
       location /giris {
           client_max_body_size 10m;
           if ($request_uri ~ "%(?![0-9A-Fa-f]{2})") { return 400; }
           proxy_pass http://127.0.0.1:3000;
       }
       location /api/media {
           client_max_body_size 64m;
           limit_req zone=media burst=5;
           if ($request_uri ~ "%(?![0-9A-Fa-f]{2})") { return 400; }
           proxy_pass http://127.0.0.1:3000;
       }
   }
   ```

   Remaining risk (finding 11): an unauthenticated POST of up to 10 MB to
   `/giris` or any `/api/` path still sits in the proxy's memory before the
   route answers. About 200 such POSTs in parallel hold 2 GB. To lower the
   `10m`, first log `$content_length` of `/giris` and `/api/` POSTs on
   staging during normal admin work. Then lower the nginx cap and
   `experimental.proxyClientMaxBodySize` together, with a margin.

   `experimental.proxyClientMaxBodySize` in `next.config.ts` stays at its
   default until then. It is one value for every proxied path, and Next cuts a
   longer body silently. A lower value would break large admin saves without a
   clear error, and no measurement shows how large an admin save can be.

   Where no nginx runs in front (Liara), the proxy still holds up to 10 MB per
   POST on every path. Record the platform's body limit in section 3.

4. Pass `Host` unchanged and set the forwarding headers. The canonical
   redirect reads `Host` only, and the app keeps an incoming `X-Request-Id`
   only when it matches `^[A-Za-z0-9._-]{8,64}$`. Never forward a client's
   own `X-Request-Id`. nginx (untested):

   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Request-Id $request_id;
   ```

   Put the directives of items 1, 2 and 4 (`add_header`, `proxy_hide_header`,
   `proxy_set_header`) in the `server` block, never inside a location. nginx
   copies each of them into a location only when that location sets none of
   its own. A location with one `proxy_set_header` loses every inherited
   `proxy_set_header` (the same holds for `add_header` and
   `proxy_hide_header`). The forms there get no `X-Forwarded-For`, so every
   visitor shares the unknown key (2.4), and `Host` becomes the upstream
   name, which breaks the canonical redirect.

5. Answer 400 for an invalid percent-escape under `/api` and `/giris`; Next
   answers a bare 500 first (SEC-S9). nginx (untested), inside every `/api`
   and `/giris` location (item 3 shows all four):

   ```nginx
   if ($request_uri ~ "%(?![0-9A-Fa-f]{2})") { return 400; }
   ```

6. Rate-limit POST and PATCH on `/api/media` per client, for example 10 a
   minute with a burst of 5, and keep the 64 MiB body cap of item 3 (UP-5).
   nginx (untested); an empty key is not counted, so other methods pass:

   ```nginx
   # http block; $client_subject is defined below
   map $request_method $media_write_key {
       POST    $client_subject;
       PATCH   $client_subject;
       default "";
   }
   limit_req_zone $media_write_key zone=media:10m rate=10r/m;

   # location /api/media
   limit_req zone=media burst=5;
   ```

   Rate-limit POST on the four form paths per client too: 10 a minute with a
   burst of 20 answers 429 to a flood, not to a person filling a form. The app keeps
   its own limits behind this (per IP, per phone and per process).
   nginx (untested); the map key is empty for every other path and method:

   ```nginx
   # http block
   # The client as the app counts it (limitSubject in src/lib/http/clientIp.ts):
   # IPv4 per address, IPv6 per /64. When "::" falls inside the first four
   # groups, the groups before it stand in for the /64 (a coarser key).
   map $remote_addr $client_subject {
       "~^(?<p64>[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+):" $p64;
       "~^(?<pre>[0-9a-f][0-9a-f:]*)::"                    $pre;
       default                                             $binary_remote_addr;
   }
   map "$request_method:$uri" $form_post_key {
       "~^POST:/(?:رزرو-نوبت|اورژانس|api/booking|api/emergency)/?$" $client_subject;
       default "";
   }
   limit_req_zone $form_post_key zone=forms:10m rate=10r/m;

   # server block
   limit_req zone=forms burst=20 nodelay;
   limit_req_status 429;
   error_page 429 /maintenance.html;
   ```

   - A location with its own `limit_req` (such as `/api/media`) does not
     inherit this one. That is fine: the forms key is empty there.
   - Behind a CDN, `$remote_addr` is the CDN's address. Restore the client
     address first (`set_real_ip_from` and `real_ip_header`), or every
     visitor shares one bucket.
   - Without the `$client_subject` map, one IPv6 host rotates addresses
     inside its /64 past the limit. Keep it whenever nginx listens on IPv6.
   - `error_page 429` shows a person the static Persian page with the
     clinic's call button instead of nginx's English page. Its heading says
     the site is being updated; the call button is what the person needs.
     The form islands read only the 429 status. The app's own 429 answers
     (sign-in, form session) pass unchanged, because `proxy_intercept_errors`
     stays off.

7. Serve HTTP/2 to browsers over TLS (nginx 1.25.1 and later:
   `http2 on;` in the `server` block). The Lighthouse gates measure the
   pages over HTTPS and HTTP/2 (`scripts/lhci.mjs`). Over HTTP/1.1,
   Lighthouse's mobile simulation puts LCP on the 404 template 300 to 470 ms
   later, because the browser opens up to six new connections for the fonts,
   styles and scripts. Check:

   ```bash
   curl -sI --http2 https://sefiddental.ir/ | head -1
   ```

   Expected: `HTTP/2 200`.

Where the platform router sets headers itself (Liara), check items 1 to 7 on
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

Check: the admin view «وضعیت سیستم» (`/giris/system-status`) shows the last
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
  into a scratch database). On the VPS the action `restore-check` runs it (3.6).
- A failed job must alert the admin. On the VPS the workflow "Watch" opens an
  issue when the newest nightly dump is older than 26 h or the last run failed
  (3.6).
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
- On the VPS (section 3), nginx also writes `/var/log/nginx/sefid.access.log`.
  It keeps the client address without its last part (IPv4 /24, IPv6 /48), so
  a form request never stays tied to a whole IP address: the privacy page
  promises that. Ubuntu's logrotate keeps it 14 days.
- nginx's error log names the full client address of a request that failed at
  the app (the app down or restarting). Every server of the site writes it to
  `/var/log/nginx/sefid/error.log`. `/etc/logrotate.d/sefid-nginx` rotates it
  every day and keeps one old file, so a line lives 2 days at most. Ubuntu's
  `/var/log/nginx/error.log` keeps only what happens outside these servers,
  such as nginx's own start.

### 2.12 Maintenance mode

Turn on: set `MAINTENANCE_MODE=on` and restart. The app reads the environment
once per process. Turn off: `MAINTENANCE_MODE=off` and restart.

| Request | In maintenance mode |
|---|---|
| Public pages | 503, the static maintenance page, `Retry-After: MAINTENANCE_RETRY_AFTER` |
| Public API | 503, JSON `{"status":"maintenance"}` |
| `/api/health` | works; the body shows `"maintenance":true` |
| `/giris`, sign-in, API calls with an admin session | work |
| Media files, `/_next/static`, fonts | work |
| `/api/cron/tick` | 503: scheduled publishing and jobs wait |

Use it for a restore (section 6), a risky migration or an incident. Editors
can still save in the admin, so tell them to stop during a restore.

Verified on 2026-10-14 against the local standalone build: the home page and
the cron tick answered 503, `/api/health` answered 200 with
`"maintenance":true`.

## 3. Chosen path: own VPS

On 2026-10-26 the client bought a VPS (decision record, 1.2). It replaces the
shared cPanel host, which section 7 keeps for reference. This path meets the
runtime contract of section 2: PostgreSQL, one long-running process behind
nginx, a release gated on `/api/health` with an automatic switch back, a
cron timer and nightly backups.

| Item | Value |
|---|---|
| Server | Ubuntu Server 26.04 LTS, amd64, a cloud VM in Tehran |
| Address | `2.144.23.111`, host name `sefid-prod-1` |
| Size | 2 vCPU, 2 GB RAM, 28 GB disk (read on 2026-10-26). A 2 GB swap file backs the RAM. PostgreSQL, the service cap and the Node heap are sized for it; on a larger plan raise them together. |
| Access | SSH as `deploy` with one ed25519 key, from GitHub Actions only |
| Server code | `deploy/vps/` (`provision.sh`, the files it installs, `server.env`, `known_hosts`) |
| Workflow | `.github/workflows/server.yml` ("Server") |
| Phase | Preview: `https://new.sefiddental.ir`, `ALLOW_INDEXING=false`, `DEMO_CONTENT=true`. `sefiddental.ir` stays at the old host until the client approves the switch (3.7). |

### 3.1 How it works

```text
GitHub runner (ubuntu-24.04), workflow "Server"      Server (Ubuntu 26.04)
  build as CI, release tarball  --- ssh (deploy) ---> ~/incoming/sefid-<id>.tar.gz
  migrate, seed, first-admin    --- ssh tunnel  ----> 127.0.0.1:5432 PostgreSQL
                                                      sefid-release: /srv/sefid/releases/<id>
                                                      sefid.service: node on localhost:3000
Visitors --- https ---> nginx :443 (TLS, headers, body caps) ---> localhost:3000
```

- Nobody opens a shell on the server. Outbound SSH is blocked where the
  studio works. Every action runs on a GitHub-hosted runner and reaches the
  server over SSH as `deploy`, which has passwordless sudo. The integrator
  starts a run and reads its log through the GitHub API.
- The server never builds and never downloads Node.js or npm packages.
  Several services block Iranian addresses (nodejs.org, npm, Docker Hub).
  The release tarball therefore carries the standalone server with every
  module, and the official Node.js binary of the build's version. The
  workflow checks that binary against `SHASUMS256.txt`, and the signature of
  that file against the keys of `nodejs/release-keys` (the "Verifying
  binaries" steps of the Node.js README).
- Migrations, the seeder and `first-admin` run on the runner from a checkout
  of the commit, through an SSH tunnel to Postgres (2.7, way 1). The app's
  start-up migrations stay as the fallback.
- For that, the workflow reads two values from `/etc/sefid/app.env`:
  `DATABASE_URL` and `PAYLOAD_SECRET`. It masks both, and the password inside
  the URL, before any other use. No other secret leaves the server.
- Packages come from the Ubuntu archive only: nginx, PostgreSQL (the major
  that 26.04 ships), certbot, ufw, fail2ban, unattended-upgrades.
- The build runs on an ubuntu-24.04 runner (glibc 2.39); the server runs
  26.04 with a newer glibc. 2.1 asks for the same OS and libc, so this differs
  on purpose. The release's native code (the Node binary, the prebuilt
  libvips of sharp, modules built by `npm ci`) needs a glibc at least as old
  as the build's, and newer glibc versions run it. Move the build to an
  ubuntu-26.04 runner when GitHub offers one.
- The SSH key enters an ssh-agent after `npm ci` and the build, never a file.
  Code that runs later in the job (Payload, the seeder, their dependencies)
  can use the connection while the job runs, but cannot copy the key.
- `provision`, the release switch, `rollback` and maintenance mode run as
  transient systemd units on the server, not as children of the SSH session.
  A cancelled run or a dropped connection cannot stop them halfway.

### 3.2 One-time setup

1. Before the bootstrap, the client sets a long random root password in the
   provider's panel (at least 20 characters, from a password manager) and
   checks once that the provider's web console opens a root shell. Until the
   first `provision`, root can log in over SSH with that password, and no
   firewall or fail2ban runs yet.
2. The client runs the bootstrap below as root on the server (section 4 has
   the steps in Persian). It creates the user `deploy` with sudo and one SSH
   key. It prints the private key (output 1) and the server's host key
   (output 2). The client sends output 2 to the studio at once.
3. `SERVER_SSH_KEY`: output 1, the whole key with its BEGIN and END lines,
   becomes an Actions secret of the repository (Settings, Secrets and
   variables, Actions). On a repository of a personal account only the owner
   can add secrets, and `localroot4/sefiddental` belongs to the studio. Who
   pastes output 1 is an open decision (below).
4. `ADMIN_PASSWORD`: the integrator makes a random temporary password with
   `openssl rand -base64 18` and stores it with
   `gh secret set ADMIN_PASSWORD`. Users rules: at least 12 characters,
   without the part of the e-mail before `@`. The integrator tells it to the
   client by phone, never in the e-mail or chat that carries the admin's
   e-mail. The client changes it at the first sign-in (3.3).
5. The integrator commits `deploy/vps/known_hosts` with one line: the
   address, a space, then output 2, for example
   `2.144.23.111 ssh-ed25519 AAAA... root@host`. Until then every SSH step
   stops with a message that says so.
6. The same day, the integrator runs `provision` (3.3 step 1). It turns off
   root and password login over SSH and starts the firewall.

Open decision: who pastes output 1. The client cannot add a secret to the
studio's repository, and output 1 must never travel by chat or e-mail. Two
ways out:

- The integrator runs the bootstrap in the provider's web console,
  with access the client grants and withdraws afterwards, and pastes output 1
  straight into the secret.
- Invert the key flow. The integrator runs
  `ssh-keygen -t ed25519 -N '' -C github-actions-deploy -f key`, then
  `gh secret set SERVER_SSH_KEY < key`, and deletes `key`. Only the public
  line `key.pub` goes to the client, and the bootstrap writes that line into
  `authorized_keys` instead of running `ssh-keygen`; output 1 disappears.
  This changes the bootstrap text below, which is fixed until the integrator
  decides.

Bootstrap (fixed; do not change what it creates):

```sh
bash <<'EOF'
set -eu
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-deploy
chmod 440 /etc/sudoers.d/90-deploy && visudo -cf /etc/sudoers.d/90-deploy >/dev/null
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
k=$(mktemp -d)
ssh-keygen -q -t ed25519 -N '' -C github-actions-deploy -f "$k/key"
install -m 600 -o deploy -g deploy "$k/key.pub" /home/deploy/.ssh/authorized_keys
echo; echo '==== 1) GitHub secret SERVER_SSH_KEY (never paste it in a chat) ===='
cat "$k/key"; rm -rf "$k"
echo '==== 2) Host key: send this one line ===='
cat /etc/ssh/ssh_host_ed25519_key.pub
EOF
```

- Output 1 goes into the GitHub secret only: never into a chat, an e-mail or
  a file in the repository.
- Password login for root stays on until the first `provision`. Provision
  turns it off; it runs over the key, so the key is proved first.
- After the first `provision`, SSH accepts only `deploy` with its key. Root
  cannot log in over SSH at all, with a password or a key, and neither can
  the provider's default user. Without GitHub, the way in is the provider's
  web console as root, with the root password of step 1. The client keeps
  that password in a safe place.
- To replace the key later (lost or leaked), run the bootstrap again as root
  in the provider's web console. It writes a new `authorized_keys`, so the
  old key stops working. Then update the secret.
- A rebuild of the server, or a restore of a provider snapshot, can create a
  new host key. Every SSH step then stops at the host key check. The client
  runs `cat /etc/ssh/ssh_host_ed25519_key.pub` in the web console and sends
  the line; the integrator commits it in `deploy/vps/known_hosts`.

Who controls the server: `SERVER_SSH_KEY` is root on the server, and every
workflow run in this repository can read repository secrets, on any branch.
Whoever can push to the repository can push a workflow that prints the key:
every collaborator with write access is an admin of the server, and so is a
stolen token with the `workflow` scope. The main-only check in the workflow
guards against a mistake, not an attack. Close the gap when the plan allows
it (GitHub Pro or Team for a private repository):

1. Create the environment `production` (Settings, Environments) with the
   deployment branch rule "main" only.
2. Add `environment: production` to the job `server` of
   `.github/workflows/server.yml`, not to `vps-smoke` (it uses no secret).
3. Move `SERVER_SSH_KEY` and `ADMIN_PASSWORD` from the repository secrets to
   the environment.
4. Add a ruleset on main: a pull request is required, force pushes are
   blocked.

Until then, keep the collaborators with write access to the minimum.

### 3.3 First release

Run the workflow "Server" from main (Actions, Server, Run workflow), one
action at a time, in this order:

1. `provision`. Read its report: OS, CPU, RAM, disk, versions, the effective
   sshd values, ufw, the listening sockets (Node on loopback only, nginx on
   80 and 443), the `systemd-analyze security` score and the app environment
   names.
2. `deploy`. The log ends with the health JSON; `version` is the commit.
3. `seed`. The log shows the line `seed: mode create-only ...`.
4. `first-admin` with the input `email` set to the clinic's admin e-mail. The
   log shows `first-admin: <email> created`.
5. The client adds the A record `new.sefiddental.ir` to `2.144.23.111`
   (section 4). Wait for its TTL.
6. `cert`. It stops with a clear message while the name does not resolve to
   the server, so it never spends the Let's Encrypt rate limits.
7. `status`. Then the client signs in at `https://new.sefiddental.ir/giris`
   with the temporary password, sets up the TOTP code, changes the password,
   and opens «وضعیت سیستم». Every row of «پیکربندی» must be green except
   «ارسال ایمیل»: it stays red while no SMTP server is set (3.9).
8. The integrator deletes the secret: `gh secret delete ADMIN_PASSWORD`. It
   held the admin's password, and `first-admin` runs once. `reset-admin`
   (3.4) sets a new one when it is needed.

Before step 6, nginx serves the snakeoil certificate. Test with
`curl --resolve new.sefiddental.ir:443:2.144.23.111 -k`.

Later releases: run `deploy` after CI is green on main. `deploy` refuses a
commit whose CI run has not passed. Nothing deploys on its own yet.

### 3.4 The workflow "Server"

Input `action`:

| Action | What it does |
|---|---|
| `status` | `sefid-status`: health, current and previous release, units and timers, the last 50 app log lines, disk, memory, certificate, last backup, pending security updates, reboot required. Then `sefid-env`: the app environment names, never a value. The run is red when `/api/health` does not answer 200. |
| `logs` | The last 300 journal lines of `sefid.service`: JSON with personal data redacted (2.11). |
| `deploy` | Stops unless the CI workflow (`ci.yml`) passed for the commit. Then: build as CI (2.2), the release tarball and its sha256, upload, `sefid-backup pre-deploy`, the tunnel, `migrate:status` and `migrate`, then `sefid-release <tarball> <sha256> <release-id>` in a systemd unit. That switches, restarts and waits up to 180 s for `/api/health` 200 with the commit as `version`. Otherwise it switches back to the release that ran before, prints the last 80 log lines and fails. |
| `provision` | Copies `deploy/vps/` to the server and runs `provision.sh` as root in a systemd unit; its output shows when it ends. Safe to run any number of times. It never deletes data, keeps the secrets, and rewrites the other values of `/etc/sefid/app.env` from `server.env`. |
| `cert` | `sefid-cert`: checks that every name of `DOMAINS` resolves to the server only (local and public resolvers, AAAA too), runs certbot in webroot mode, points nginx at the certificate and reloads it. The packaged `certbot.timer` renews; a deploy hook reloads nginx. |
| `seed` | The seeder in `create-only` mode. Media files first, then rows: a pass on a scratch SQLite database writes every media file, the files go to `/var/lib/sefid/media`, then the pass on the server's database writes the rows. That pass writes into an empty folder, so its files keep the names of the first pass; the run fails if it wrote a file the first pass did not. A failed copy never leaves a row without its file. Restarts the app at the end, because the app caches reads in memory. Through the tunnel the first seed can take long: the job waits up to 30 minutes for output (`PAYLOAD_STALL_MS`) and runs up to 120 minutes. |
| `first-admin` | `npm run first-admin` with `ADMIN_EMAIL` from the input `email` and `ADMIN_PASSWORD` from the secret. Creates an admin only when no account exists. Prints the e-mail and `created` or `skipped: users exist`, never the password. |
| `reset-admin` | For a lost password, a lost TOTP phone or a locked account. `npm run reset-admin -- <email>` with the input `email`: the password becomes the value of the secret `ADMIN_PASSWORD`, the TOTP secret is removed and the sign-in lock lifted. Prints `reset-admin: <email> reset`, never the password. Before the run the integrator sets a new temporary `ADMIN_PASSWORD` and tells it to the admin by phone. The admin signs in, changes the password and sets up TOTP again; then the integrator deletes the secret. |
| `backup` | `sefid-backup manual` (3.6). |
| `restart` | Restarts `sefid.service` and waits for `/api/health` 200. |
| `rollback` | `sefid-release rollback` in a systemd unit: back to the previous release, with the same health check (section 5). |
| `maintenance-on`, `maintenance-off` | `sefid-maintenance on` or `off` (2.12) in a systemd unit. It restarts the app and waits until `/api/health` shows the mode. |
| `run` | Runs the input `command` as `deploy` on the server, for diagnosis. `deploy` has sudo, so this input is as powerful as the SSH key. The command and everything it prints go into the run log, which every collaborator can read for 90 days. Never put a secret in the command, and never print `/etc/sefid/app.env`, `/etc/sefid/cron-auth.header` or a key: `sudo sefid-env` lists the names. |
| `restore-check` | `sefid-restore-check` in a systemd unit: the restore drill of 3.6 on the scratch database `sefid_restore_check` only. It never touches `sefid`. |
| `offsite-backup` | Also every Friday at 01:23 UTC by schedule. Stops unless the repository variable `BACKUP_AGE_RECIPIENT` holds an age public key. `sefid-offsite` encrypts the newest nightly dump with age on the server; the run keeps the ciphertext and its `.sha256` as an artifact for 14 days (3.6). |
| `smoke` | The `vps-smoke` job (3.8). |

Rules:

- Every action except `smoke` stops at once on a branch other than main.
  That guards against a mistake, not an attack (3.2, "Who controls the
  server").
- One action at a time (concurrency group `server`). GitHub keeps one waiting
  run per group: a newer waiting run cancels the older waiting one.
- SSH uses `StrictHostKeyChecking yes` with `deploy/vps/known_hosts`,
  `BatchMode yes` and `ConnectTimeout 20`. When the connection fails before
  the server ran anything (a timeout, or a reset during the key exchange),
  the step tries once more after 30 s. Every other failure stops the run.
- The upload resumes where a dropped connection stopped it, up to 3
  attempts, then checks the sha256.
- `provision`, the release switch, `rollback` and maintenance mode run as
  transient systemd units named `sefid-<name>-<UTC time>`. When the run is
  cancelled or the connection drops, the unit still finishes, a switch back
  included. To read one later, run `run` with
  `sudo journalctl -u 'sefid-release-*' -n 200 --no-pager`.
- No step prints a secret, and no step runs `set -x`.

### 3.5 Server layout

`deploy/vps/` is the source of truth. Overview:

| Path or unit | What it is |
|---|---|
| `/etc/sefid/app.env` (root:sefid 0640) | The app environment of 2.3. The secrets are generated on the server once and kept; the other values come from `server.env` on every provision. Never print it. |
| `/etc/sefid/server.env`, `/etc/sefid/host.env` | The committed config, and the loopback origin that provision found for `localhost` |
| `/etc/sefid/cron-auth.header` (sefid 0400) | `Authorization: Bearer <CRON_SECRET>` for the cron tick (2.8) |
| `/srv/sefid/releases/<release-id>/` | `node/`, `app/`, `release.json`, `release.env`. Root-owned, read-only for the app. `release-id` is `<UTC yyyymmddThhmmssZ>-<sha7>`. The last 5 are kept. |
| `/srv/sefid/current`, `/srv/sefid/previous` | Links to the running release and the one before |
| `/var/lib/sefid/media` (sefid 0750) | `MEDIA_DIR`, uploads (2.9) |
| `/var/backups/sefid/{db,media}` (root 0700) | Backups (3.6) |
| `/var/backups/sefid/last-<label>` | The result of the last backup run of that label: `<UTC time> ok <dump>` or `<UTC time> failed exit <code>` |
| `/run/sefid-cron.ok` | Touched by root after every successful tick; `sefid-status --check` reads its age |
| `sefid.service` | User `sefid`, `localhost:3000`, sandboxed; `systemd-analyze security` in the provision report |
| `sefid-cron.timer` | The tick of 2.8 every minute, on the loopback origin |
| `sefid-backup.timer` | 23:30 UTC every night |
| `sefid-restore-check-app` | Transient unit of the restore drill: the current release on port 3009 against `sefid_restore_check` (3.6) |
| nginx | TLS 1.2 and 1.3, HTTP/2, every rule of 2.5. Unknown host names get no answer: 444 on port 80, a TLS alert without a certificate on 443. Port 80 serves `/.well-known/acme-challenge/` and redirects the rest to https. Access log with shortened client addresses; error log in `/var/log/nginx/sefid/error.log`, kept 2 days (2.11). |
| PostgreSQL | Loopback only, scram-sha-256, role and database `sefid` |
| Firewall and SSH | ufw allows 22 (rate-limited), 80 and 443. fail2ban watches sshd. SSH: key only, user `deploy` only, no root login, forwarding only to `127.0.0.1:5432`. |
| OS | Security updates every night at 22:30 to 22:45 UTC (02:00 in Tehran), with the service restarts they need; a reboot at 23:45 UTC when one is required. UTC clock (chrony, with plain NTP beside Ubuntu's NTS sources). 2 GB swap, journald capped at 1 GB. |

### 3.6 Backups, restore drill and alerts

On the server:

- Every night at 23:30 UTC, `sefid-backup` writes
  `/var/backups/sefid/db/sefid-<stamp>-nightly.dump` (`pg_dump` custom format,
  read back with `pg_restore --list`) and a tar of the media folder. It keeps
  14 days.
- Every run writes its result to `/var/backups/sefid/last-<label>`:
  `<UTC time> ok <dump>` or `<UTC time> failed exit <code>`. `status` prints
  it under "last backup".
- Every `deploy` takes a `pre-deploy` backup of the database before the
  migrations. It skips the media folder: a release does not change media.
- The action `backup` takes one now.
- Before it writes, `sefid-backup` checks the free space. It stops with a
  clear message when the disk has less than twice the newest dump plus the
  media folder: a full disk would stop PostgreSQL. `status` prints the size
  of all backups.
- Each nightly media archive is a full copy, so 14 days keep 14 copies of the
  media folder. Read "all backups" in `status` every month (open item 3.9).
- The reboot after an update (23:45 UTC) comes 15 minutes after the backup
  starts and cuts off a backup that still runs; that night then has no
  backup. With a few GB of media the backup takes a minute or two. If it
  grows past 10 minutes, move `Automatic-Reboot-Time` in
  `deploy/vps/files/etc/apt/apt.conf.d/53sefid-auto-reboot`.

Off the server (owner decision 2b, until a bucket exists):

- The provider's daily VM snapshot. It is the first way back after a lost
  VM, media included. The client turns it on in the provider's panel
  (section 4, item 12).
- The weekly off-site copy: every Friday at 01:23 UTC the workflow "Server"
  runs the action `offsite-backup`. It also runs by hand.
  - `sefid-offsite` on the server encrypts the newest nightly dump with
    [age](https://age-encryption.org) to the owner's public key. Only that
    ciphertext leaves the server; the owner's private key never reaches the
    server or GitHub.
  - The run keeps `sefid-<stamp>-nightly.dump.age` and its `.sha256` (of the
    plain dump) as the artifact `sefid-offsite-<run id>` for 14 days.
  - The repository is public, so any signed-in GitHub user can download the
    artifact. The encryption is the only protection: the run refuses to start
    without a valid public key in the repository variable
    `BACKUP_AGE_RECIPIENT`, and it refuses a nightly dump older than 26 h.
    Before it keeps the file, it checks that the file is age ciphertext.
  - The dump holds patients' phone numbers; encrypted, they leave Iran.
  - The media folder is not part of it. The VM snapshot covers media.

The owner's key pair, once, on the owner's computer:

1. Install age: `brew install age` (macOS), `winget install --id
   FiloSottile.age` (Windows) or `sudo apt install age` (Ubuntu).
2. Create the key pair:

   ```sh
   age-keygen -o sefid-backup-key.txt
   ```

   It prints `Public key: age1...`. The file holds the private key
   (`AGE-SECRET-KEY-1...`).
3. Keep the file in two places only you control: your password manager (as
   a file or secure note) and a USB stick kept at home. Never put it on
   GitHub, on the server, in a chat or in an e-mail. Without it no copy can
   be read again; with it anyone can read every copy.
4. In GitHub: Settings, Secrets and variables, Actions, tab "Variables",
   "New repository variable". Name `BACKUP_AGE_RECIPIENT`, value the
   `age1...` line. The public key is not secret.
5. Run the action `offsite-backup` once, then decrypt the copy (6.3,
   steps 3 and 4) to prove the key works.

A new key pair: repeat steps 2 to 5. Copies made before stay readable only
with the old private key; keep it until those artifacts expire (14 days).

Restore drill: the action `restore-check` runs `sefid-restore-check` on the
server, on the scratch database `sefid_restore_check` only. It never writes to
the database `sefid`.

1. It restores the newest dump as 6.1 step 6 does, and compares the row count
   of every table with the rows in the dump.
2. It starts the current release against the scratch database on port 3009,
   with an empty media folder, until `/api/health` answers 200.
3. It unpacks the newest media archive into a temporary folder and compares
   the file count with the archive's list.
4. It drops the scratch database and removes the temporary folders, also
   after a failure.

It needs about twice the database and the media archive in free space, and
checks that first. Run it once a month and record it in 6.1.

Alerts: the workflow "Watch" (`.github/workflows/watch.yml`, checks in
`deploy/vps/watch-check.sh`) runs every hour at minute 17.

- From GitHub, so also from outside Iran: `GET <SITE_URL>/api/health`. The
  site follows `PHASE` in `server.env`.
- Over SSH: `sudo sefid-status --check`. It prints one line per failure and
  exits 1:
  - the newest nightly dump is older than 26 h, or the last nightly run
    failed;
  - no successful cron tick in 5 minutes (`sefid-cron.service` touches
    `/run/sefid-cron.ok` after each one);
  - less than 15 % free on a file system of `/`, `/var/lib/sefid`,
    `/var/lib/postgresql` or `/var/backups/sefid`;
  - the certificate expires within 14 days;
  - `/api/health` on loopback does not answer 200.
- A failed check is checked again after 2 minutes, so a restart during a
  deploy raises no alarm.
- What still fails opens one issue labelled `incident`. A later run with
  other failures comments on it; the same failures add nothing. Digits do not
  count, so "27 h old", then "28 h old" is the same failure. Only the issue
  body and the comments of `github-actions` count as earlier reports: a
  comment by anyone else cannot silence one. The first run in which every
  check passes comments and closes it.
- A server whose `sefid-status` has no `--check` yet (before `provision`)
  fails with "printed no ok line".
- GitHub mails new issues and comments to everyone who watches the
  repository: the owner sets "Watch" to "All activity" (or "Custom", Issues).
- The issues are public: the lines name checks and numbers, never a secret.
- The run stays green when it could report: the issue is the alert.
- The input `force_failure` of a manual run adds one failure that names the
  run id in letters, to test the issue flow: the first forced run opens the
  issue, the second comments on it.
- GitHub turns off a schedule after 60 days without a commit in a public
  repository and mails the owner. Turn it on again under Actions, "Watch".

### 3.7 From preview to live

Only after the client approves the switch in writing. nginx serves a name
only after `provision` knows it, and with a real certificate only after
`cert`: this order keeps the gap to a few minutes.

1. At least one day before: the client exports the zone of `sefiddental.ir`
   (every record) and lowers the TTL of the apex and `www` records to 300 s.
2. Mail, in the same days: on a zone made by cPanel, the MX record usually
   points at the apex, and `mail`, `webmail` and `ftp` are often CNAMEs of
   it. After the switch they would reach the VPS, which runs no mail server,
   and mail to the clinic would bounce. If any record points at the apex or
   is a CNAME of it, the client creates `mail.sefiddental.ir A <old host IP>`,
   points the MX record and those names at it, waits for their old TTL and
   sends a test mail to an `@sefiddental.ir` address. A change of the MX
   record needs the client's confirmation.
3. In `deploy/vps/server.env`, change the one line `PHASE=preview` to
   `PHASE=live`. That sets `SITE_URL=https://sefiddental.ir`,
   `DOMAINS="sefiddental.ir www.sefiddental.ir"` and `ALLOW_INDEXING=true`,
   and drops `DEMO_CONTENT` from `/etc/sefid/app.env`: no demo item reaches
   the live site, and the app refuses to start with it there.
   Commit to main.
4. Run `provision` while the DNS still points at the old host. Visitors still
   reach the old host; the preview at `new.sefiddental.ir` stops.
5. The client points `sefiddental.ir` and `www.sefiddental.ir` at
   `2.144.23.111` (A records) and removes every other A and AAAA record of
   both names.
6. Run `cert` at once, and again every few minutes until it passes. It stops
   with a clear message while a resolver still gives the old address. Until
   it passes, a visitor who already gets the new address sees a certificate
   warning: about 5 to 10 minutes with a TTL of 300 s.
7. Check: `https://sefiddental.ir/api/health` answers 200,
   `https://www.sefiddental.ir/` redirects to the apex, `robots.txt` allows
   crawling, and «وضعیت سیستم» shows no red row except «ارسال ایمیل» (3.9).

After the switch `new.sefiddental.ir` is no longer served. Remove its A
record then, and run `run` with
`sudo certbot delete --non-interactive --cert-name new.sefiddental.ir`:
otherwise `certbot.timer` keeps trying to renew it and fails every day.

### 3.8 Smoke test: the job `vps-smoke`

It runs on every push to main that changes `deploy/vps/` or
`.github/workflows/server.yml`, and with the action `smoke`. It uses the same
steps as the server job, on the runner itself:

1. `provision.sh` twice with `SEFID_SMOKE=1`, in a systemd unit as on the
   server. The second run must print no `==> updated` and no `restarting`
   line: that proves it is idempotent. The switch skips sshd, ufw, fail2ban,
   the host name, the swap file and the reboot settings (the update timer
   included), and nothing else.
2. `deploy`, `seed` and `first-admin` through `127.0.0.1`; the pre-deploy
   backup runs on the still empty database. `first-admin` runs twice:
   `created`, then `skipped: users exist`. Then `reset-admin` sets a new
   password for that account.
3. Checks: health 200 with the commit. Through nginx on 443 (`--resolve`,
   `-k`): the home page answers 200 with each header of 2.5 item 1 exactly
   once, and no `x-middleware-*` header; a `//` path and a Persian route carry
   the same headers. An unknown host name gets no TLS handshake. The cron
   timer runs a successful tick, and `/api/cron/tick` answers 401 without the
   bearer. `sefid-backup nightly` writes a dump that `pg_restore --list`
   reads and records `<time> ok <dump>` in `last-nightly`.
   `sefid-status --check` passes; a "disk" line is tolerated, because the
   runner's disk can be fuller than 85 %. The restore drill fails once with
   a restored row deleted on purpose (`SEFID_RESTORE_CHECK_TAMPER=1`) and
   leaves no scratch database, then passes. `sefid-offsite` refuses three bad
   recipients, encrypts to a throwaway key on the runner, and the copy
   decrypts to the dump's sha256.
   Maintenance mode answers 503, then 200. A second release, then a
   `rollback` in a systemd unit whose client is killed while it runs: the
   unit still returns to the first release and records the second as
   previous. A release whose server exits at once is switched back. `status`
   and `logs` run.

The runner is Ubuntu 24.04, the server 26.04. The smoke test cannot cover:

- the PostgreSQL major: the runner installs 16, the server runs 18 (the int
  suite and e2e of CI run on 18); nginx and OpenSSH versions, sshd socket activation, ufw, fail2ban and the real
  network;
- sudo-rs, which 26.04 uses as `sudo`;
- the Rust coreutils (uutils), which 26.04 uses instead of GNU coreutils.
  The scripts use `install -D -o -g`, `mv -T`, `sha256sum --check -`,
  `sort -V`, `date -u +<format>`, `df --output=avail -B1`, and 6.1 uses
  `cp --update=none`;
- OpenSSH 10, whose `sshd-auth` process logs failed logins (the fail2ban
  filter names it; check that the jail counts failures);
- chrony with NTS sources, which a network in Iran may block.

The provision report prints the sudo, `date`, PostgreSQL, nginx and OpenSSH
versions, the time sources and the fail2ban sshd jail. Read them after the
first `provision` on the server. The smoke test also runs
`apt-get full-upgrade` on the runner, which has hundreds of preinstalled
packages: a red or slow `vps-smoke` can come from there (3.9).

### 3.9 Known limits and open items

- Not run yet: the actions `restore-check` and `offsite-backup` and the
  workflow "Watch" have not run on the server. `vps-smoke` runs the first two
  on the runner.
- One server, no staging. The preview phase serves as staging until the
  switch.
- The release folder is read-only for the app. The data cache stays in
  memory (`experimental.isrFlushToDisk: false` in `next.config.ts`), so
  Next.js writes nothing under `app/.next/cache`.
- No SMTP server is set. «ارسال ایمیل» in «وضعیت سیستم» stays red, and
  password reset by mail does not work: `reset-admin` (3.4) replaces it.
  provision keeps lines of `/etc/sefid/app.env` it does not manage, so the
  `SMTP_*` lines of 2.3 can go there, but no action writes a secret into that
  file without showing it in the run log yet.
- nginx's error log keeps full client addresses for up to 2 days (2.11), while
  the privacy page says a form never keeps the IP address. The privacy
  sentence stays with gap 54.
- Open items: who pastes the SSH key (3.2, open decision); GitHub
  environment protection (3.2, "Who controls the server"); the off-site
  copy of the media folder (the VM snapshot covers it until a bucket exists,
  3.6); media backups that copy only changed files (for
  example `rsync --link-dest` snapshots) instead of 14 full archives; SMTP
  (above); whether `SEFID_SMOKE=1` should
  skip `apt-get full-upgrade` on the runner (it changes the list of what the
  switch skips); a deploy that starts on its own after CI is green; a staging
  environment.

## 4. کارهای شما

این فهرست، راه‌اندازی سایت روی سرور خود کلینیک است. کارها را به همین ترتیب انجام دهید. هر سطر یک کار است.

1. در پنل ارائه‌دهندهٔ سرور، یک رمز root بلند و تصادفی بگذارید: دست‌کم ۲۰ نویسه، از یک برنامهٔ مدیریت رمز.
2. این رمز را در جای امن نگه دارید. بعدها تنها راه ورود شما به سرور همین رمز است.
3. کنسول وب ارائه‌دهنده را یک بار باز کنید. مطمئن شوید با root وارد می‌شوید.
4. با کاربر root وارد سرور شوید: از کنسول وب ارائه‌دهنده، یا با SSH و رمز root.
5. دستور «Bootstrap» بخش 3.2 را کامل کپی کنید، در سرور بچسبانید و Enter بزنید.
6. خروجی شمارهٔ ۲ یک خط است که با `ssh-ed25519` شروع می‌شود. آن را همان موقع برای استودیو بفرستید. این خط محرمانه نیست.
7. خروجی شمارهٔ ۱ یک کلید خصوصی است. جای آن فقط Secret مخزن در GitHub است. آن را برای هیچ‌کس نفرستید: نه در پیام‌رسان، نه در ایمیل.
8. اگر به Settings مخزن سایت در GitHub دسترسی دارید: به Settings، بعد Secrets and variables، بعد Actions بروید.
9. «New repository secret» را بزنید. نام را `SERVER_SSH_KEY` بگذارید. کلید را از خط `BEGIN` تا خط `END` در مقدار بچسبانید. «Add secret» را بزنید.
10. اگر به Settings دسترسی ندارید، کلید را کپی نکنید. به استودیو خبر دهید. استودیو راه امن را با شما هماهنگ می‌کند.
11. ایمیل حساب مدیر سایت را برای استودیو بفرستید.
12. اگر ارائه‌دهندهٔ سرور «پشتیبان‌گیری خودکار» یا «Snapshot» روزانه دارد، آن را روشن کنید.
13. منتظر پیام استودیو بمانید: «سایت روی سرور آماده است».
14. از این به بعد، root نمی‌تواند با SSH وارد سرور شود، با رمز یا بدون رمز. این عمدی است و خرابی نیست.
15. برای ورود به سرور فقط کنسول وب ارائه‌دهنده را با رمز root به کار ببرید.
16. پنل DNS دامنهٔ `sefiddental.ir` را باز کنید. یک رکورد A بسازید: نام `new` و مقدار `2.144.23.111`. به رکوردهای دیگر دست نزنید.
17. به استودیو خبر دهید. استودیو گواهی HTTPS را می‌گیرد.
18. استودیو یک گذرواژهٔ موقت برای حساب مدیر، با تماس تلفنی به شما می‌گوید.
19. نشانی `https://new.sefiddental.ir/giris` را باز کنید. با ایمیل خود و گذرواژهٔ موقت وارد شوید.
20. کد دومرحله‌ای (TOTP) را با یک برنامهٔ Authenticator در گوشی راه بیندازید.
21. گذرواژه را عوض کنید: دست‌کم ۱۲ نویسه، بدون بخش اول ایمیل. گذرواژهٔ تازه را به هیچ‌کس نگویید.
22. در پنل مدیریت، «وضعیت سیستم» را باز کنید. از بخش «پیکربندی» عکس بگیرید و برای استودیو بفرستید.
23. ردیف «ارسال ایمیل» فعلاً قرمز است. این تا راه‌اندازی سرور ایمیل طبیعی است.
24. سایت را در `https://new.sefiddental.ir` ببینید و نظرتان را بگویید.
25. وقتی سایت را برای نشانی اصلی تأیید کردید، این را کتبی به استودیو بگویید.
26. استودیو مراحل تغییر DNS نشانی اصلی را برایتان می‌فرستد. این مراحل یک روز زودتر شروع می‌شوند.
27. پیش از تغییر، رکوردهای ایمیل دامنه را با استودیو بررسی کنید. این کار ایمیل کلینیک را از قطع شدن حفظ می‌کند.

اگر این اتفاق‌ها افتاد:

- رمز مدیر یا گوشی کد دومرحله‌ای را گم کردید، یا حساب قفل شد: به استودیو خبر دهید. استودیو حساب را بازنشانی می‌کند و گذرواژهٔ موقت تازه را تلفنی می‌گوید. بعد از ورود، گذرواژه را عوض کنید و کد دومرحله‌ای را دوباره راه بیندازید.
- ارائه‌دهنده سرور را از نو ساخت یا از Snapshot برگرداند: در کنسول وب، دستور `cat /etc/ssh/ssh_host_ed25519_key.pub` را بزنید. خروجی را برای استودیو بفرستید.
- کلید خصوصی گم شد یا لو رفت: در کنسول وب با root، دستور «Bootstrap» را دوباره اجرا کنید. کلید قبلی از کار می‌افتد. بعد بندهای ۶ تا ۱۰ را دوباره انجام دهید.

اگر مشکلی دیدید، فقط شرح مشکل و عکس صفحه را بفرستید. رمز root، کلید خصوصی و گذرواژهٔ مدیر را برای هیچ‌کس نفرستید.

## 5. Rollback

Choose by what broke. On the VPS every step is an action of the workflow
"Server" (3.4).

| What broke | Action |
|---|---|
| Code of the new release | `rollback` (below). |
| An environment value | Non-secret values: revert the change in `deploy/vps/server.env` on main, then run `provision`. The secrets live only in `/etc/sefid/app.env` on the server, and provision keeps them. Other hosts: restore the old value in the platform and restart. |
| Data (wrong edits, a bad migration that lost data) | Restore runbook (section 6). |
| The whole VM | The provider's snapshot, else the off-site copy (6.3). |

Back to the previous release on the VPS:

1. Run `maintenance-on` if the release harms visitors or data.
2. Run `rollback`. `sefid-release rollback` points `/srv/sefid/current` at
   the previous release, restarts the app and waits for `/api/health` 200
   with that release's commit. When the check fails, it switches back and
   the run is red.
3. Run `status`: `version` is the previous commit, and "releases" shows
   current and previous swapped.
4. Run `maintenance-off`.

`rollback` knows one step back only, although the server keeps the last 5
releases. To go further back, revert the bad commits on main
(`git revert`), wait for CI, then run `deploy`. That builds a new release of
the old code with its own `GIT_SHA`.

Redeploy the previous good commit (other hosts):

1. Turn on maintenance mode (2.12) if the release harms visitors or data.
2. Find the previous good SHA: the last release that passed its health check.

   ```sh
   git log --oneline -n 10 origin/main
   ```

3. Deploy that commit: the artifact build of that SHA, with its own
   `GIT_SHA`. On C1, start the previous release folder instead.
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

### 6.1 On the VPS

Not run yet on live data. The action `restore-check` (3.6) runs steps 3 to 7
on the scratch database `sefid_restore_check` and starts the app on it; record
each run here.

| Date (UTC) | Dump | Tables, rows | Media files | Result |
|---|---|---|---|---|
| not run yet; it needs the owner's OK | | | | |

Every step is an action of the workflow "Server" (3.4). For
`run`, the line after "run:" goes into the input `command`. `<stamp>` is the
UTC date of the restore, for example `20261101`.

1. `maintenance-on`. Tell the editors to stop work in the admin.
2. `backup`. This dump of the current state, even a broken one, is the undo
   of the restore.
3. Choose the dump: the newest one taken before the incident.

   ```sh
   sudo ls -lt /var/backups/sefid/db
   ```

4. Check that the file is a readable archive:

   ```sh
   sudo pg_restore --list /var/backups/sefid/db/<file> > /dev/null && echo readable
   ```

5. Create the empty database, owned by the app role:

   ```sh
   sudo -u postgres createdb --owner=sefid sefid_restore_<stamp>
   ```

6. Restore as the app role, in one transaction. Any error stops the restore
   and leaves the database empty. Only root reads the backup folder, so
   `cat` reads the file and `pg_restore` reads its standard input:

   ```sh
   sudo cat /var/backups/sefid/db/<file> | sudo -u postgres pg_restore --role=sefid --no-owner --no-privileges --exit-on-error --single-transaction --dbname=sefid_restore_<stamp>
   ```

7. Check the restored data:

   ```sh
   sudo -u postgres psql -d sefid_restore_<stamp> -c "SELECT name, batch FROM payload_migrations ORDER BY id" -c "SELECT count(*) AS users FROM users" -c "SELECT count(*) AS services FROM services"
   ```

   The migration list matches the dump's date. The counts are plausible.
8. Swap the databases in one transaction (`psql -1`). `DATABASE_URL` stays
   as it is (provision checks its form), so the restored database takes the
   name `sefid`, and the old one keeps its data under a new name. The line
   first ends every other session on both databases (the nightly dump, a
   leftover tunnel), and it starts the app again in every case:

   ```sh
   sudo systemctl stop sefid-cron.timer sefid.service && sudo -u postgres psql -X -1 -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('sefid', 'sefid_restore_<stamp>') AND pid <> pg_backend_pid()" -c "ALTER DATABASE sefid RENAME TO sefid_before_restore_<stamp>" -c "ALTER DATABASE sefid_restore_<stamp> RENAME TO sefid"; rc=$?; sudo systemctl start sefid.service sefid-cron.timer; exit $rc
   ```

   If the run is red with a psql error, nothing was renamed and the app runs
   on the old database again. Fix the cause (a typo in `<stamp>`, for
   example) and run the line again. If the dump is older than the code, the
   start applies the newer migrations (2.7). The restart also empties the
   in-memory data cache.
9. `status`: `/api/health` answers 200 and shows `"maintenance":true`. Sign
   in to the admin and open «وضعیت سیستم»: the «پیکربندی» section shows no
   red row except «ارسال ایمیل» (no SMTP server, 3.9). Open one public page.
10. `maintenance-off`.
11. Keep `sefid_before_restore_<stamp>` for 14 days. Dropping it deletes
    data, so it needs the client's confirmation.

Media: a database restore does not restore media files. To bring back files
deleted after the dump, unpack the media archive of the same night (a
`nightly` or `manual` one: `pre-deploy` backups hold no media) into a new
folder, copy back only the files that are missing, then remove the unpacked
copy: it holds every upload, patient photos included, outside the 14-day
retention.

```sh
sudo mkdir /var/lib/sefid/restore-<stamp> && sudo tar -xzf /var/backups/sefid/media/<file> -C /var/lib/sefid/restore-<stamp> && sudo -u sefid cp -r --update=none /var/lib/sefid/restore-<stamp>/media/. /var/lib/sefid/media/; rc=$?; sudo rm -rf /var/lib/sefid/restore-<stamp>; exit $rc
```

### 6.2 Any other host

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
   admin and open «وضعیت سیستم»: the «پیکربندی» section shows no red row.
   Open one public page.
10. Turn off maintenance mode and restart.
11. Keep the old database for 14 days. Dropping it deletes data, so it needs
    the client's confirmation.

Media: a database restore does not restore media files. A file uploaded after
the dump stays in the bucket without a row. A file deleted after the dump has
a row without a file, and its URL answers 404.

### 6.3 From the off-site copy (the VM is lost)

First choice: the provider restores the VM from its snapshot (3.6). Then send
the studio the new host key (section 4, "if this happens"). The steps below
are for a VM without a snapshot.

1. A new server: bootstrap (3.2), `provision`, `cert`, `deploy` (3.3). The
   database `sefid` is empty.
2. On your computer, download the newest copy: Actions, workflow "Server",
   the newest green `offsite-backup` run, artifact `sefid-offsite-<run id>`.
   Or:

   ```sh
   gh run download <run id> --repo localroot4/sefiddental --name sefid-offsite-<run id>
   ```

3. Decrypt it with your private key:

   ```sh
   age --decrypt --identity sefid-backup-key.txt --output sefid-<stamp>-nightly.dump sefid-<stamp>-nightly.dump.age
   ```

4. Check it:

   ```sh
   sha256sum --check sefid-<stamp>-nightly.dump.sha256
   ```

   It prints `OK`. On macOS use `shasum -a 256 --check`.
5. Let your own SSH key in for the copy. `run` with your public key (it is
   not secret; the comment `restore` marks the line):

   ```sh
   echo 'ssh-ed25519 AAAA... restore' | sudo tee -a /home/deploy/.ssh/authorized_keys
   ```

6. Copy the dump, then take your key out again with `run`:

   ```sh
   scp sefid-<stamp>-nightly.dump deploy@<SERVER_HOST>:
   ```

   ```sh
   sudo install -m 0600 /home/deploy/sefid-<stamp>-nightly.dump /var/backups/sefid/db/ && rm /home/deploy/sefid-<stamp>-nightly.dump && sudo sed -i '/ restore$/d' /home/deploy/.ssh/authorized_keys
   ```

7. Follow 6.1 from step 4 with that file.
8. Delete the plain dump on your computer. It holds every patient's phone
   number.
9. Media: without a snapshot, uploads are lost. Upload them again from the
   originals.


Chosen on 2026-10-18 and replaced by the own VPS on 2026-10-26 (1.2). Nothing
below is in use. The workflow "Package for cPanel", `scripts/package-cpanel.mjs`
and `deploy/cpanel/` still build and test the package. The text is unchanged,
except that its section numbers now start with 7.

On 2026-10-18 the client bought a shared host with a Node.js selector
(decision record, 1.2). This section is the release procedure for that host.
It accepts the limits of 1.3: no staging, no health-gated release, no
rollback beyond re-uploading the previous package, SQLite instead of
PostgreSQL, and one memory limit for the whole account.

### 7.1 How the package runs on the host

`node scripts/package-cpanel.mjs` (after `npm run build`, or the workflow
"Package for cPanel") writes `release/sefid-cpanel-<sha>.zip`. Its root is the
panel's "Application root":

| Path | What it is |
|---|---|
| `app.cjs`, `boot.cjs` | Startup file (`deploy/cpanel/`). CommonJS: the panel's loader (Phusion Passenger or LiteSpeed lsnode) `require()`s it. |
| `server/` | Next's standalone server with `public/` and `.next/static/`. No `node_modules` sits in the root: the Node selector reserves that name for its own environment. |
| `seed/` | A migrated and seeded SQLite database with its media, copied to the data folder on the first start only. |
| `package.json`, `release.json` | A minimal manifest (no dependencies; never run "NPM Install") and the commit and build time. |

At start `boot.cjs`:

1. Stops with a clear line when Node is older than 22.23.4 (24.22.1 on Node 24).
2. Uses the data folder `~/sefid-data` (`SEFID_DATA_DIR` overrides it), outside
   the release, mode 0700. A new release never touches it.
3. Takes each secret of 2.3 from the panel's environment, else from
   `~/sefid-data/secrets.json` (0600), which the first start creates with
   48 random bytes per value. It writes `~/sefid-data/cron-secret` (0600) for
   the cron job. Values are never printed.
4. Fills the defaults of this host type unless the panel sets them:
   `DATABASE_URL=file:~/sefid-data/sefid.db`, `MEDIA_DIR=~/sefid-data/media`,
   `DB_PUSH=false`, `TRUST_PROXY_HEADERS=true`, `TRUSTED_PROXY_HOPS=1`,
   `TZ=UTC`, `NEXT_TELEMETRY_DISABLED=1`, `GIT_SHA` and `BUILD_TIME` from
   `release.json`.
5. On the first start only, copies `seed/sefid.db` and `seed/media/` into the
   data folder (an existing database is never overwritten).
6. Opens a second HTTP server on a free loopback port and sets
   `INTERNAL_ORIGIN` to it. The panel's loader takes the app's first
   `listen()` (public traffic arrives on its socket, not on a TCP port), so the
   proxy's calls to `/api/internal/*` need their own listener. It serves those
   paths only (404 for anything else) and listens through `net.Server`'s
   `listen`, which the loaders leave alone.
7. Gives Next's requests `X-Forwarded-Proto: https` when the panel's web
   server sent none. Without the header Next fills in `http`, and the
   canonical redirect would send every visitor to the same https URL again
   and again. The panel forces HTTPS itself (7.3 step 3); a header the web
   server does send is kept.
8. Imports `server/server.js`. Pending migrations run when Payload first
   starts (2.7, `prodMigrations` of the SQLite adapter).

A failed start writes one JSON line to stderr and to `startup-error.log` in
the application root (readable in File Manager).

Unit tests: `deploy/cpanel/boot.test.ts` (CB1 to CB8, including a simulated
loader that throws on a second `listen()` and `boot()` end to end).

### 7.2 Panel settings

| Setting | Value |
|---|---|
| Node.js version | 22.23.4 or a newer 22.x, or 24.22.1 or newer; 23.x does not start. If the list has no such version, ask the host to enable Node 22.23.4 or newer; the app does not start on older versions. |
| Application mode | Production |
| Application root | `sefid` |
| Application URL | `sefiddental.ir` (the root, no path) |
| Application startup file | `app.cjs` |
| Environment variables | `SITE_URL=https://sefiddental.ir`, `ALLOW_INDEXING=false` until the client approves the content, `ALLOW_FIRST_USER=true` only until the first admin exists. Optional: SMTP values of 2.3. Nothing else is needed. |

### 7.3 First release

1. Create the application with the settings above, then stop it.
2. File Manager: open `sefid`, upload the zip, "Extract", delete the zip.
3. SSL/TLS Status: run AutoSSL for `sefiddental.ir` and `www`. Domains:
   turn on "Force HTTPS Redirect". The form cookies are `__Host-` cookies and
   work over HTTPS only.
4. Start the application. Open `https://sefiddental.ir/api/health`: it
   answers `{"status":"ok", ...}` with the release's `version`.
5. Open `/giris` and create the first admin. Then remove `ALLOW_FIRST_USER`
   and restart.
6. Cron Jobs: every minute (`* * * * *`):

   ```sh
   curl -fsS -m 55 -H "Authorization: Bearer $(cat $HOME/sefid-data/cron-secret)" https://sefiddental.ir/api/cron/tick > /dev/null
   ```

7. In the admin, open «وضعیت سیستم». Every row of «پیکربندی» must be green.
   A red proxy-trust row means the host's web server does not pass the
   visitor's address in `X-Forwarded-For` (2.4): every visitor then shares
   one rate-limit key (S2). Report it before going further.

### 7.4 Later releases

1. Download the new zip. Stop the application.
2. File Manager, in `sefid`: delete the `server` folder (stale chunks of the
   old release would stay otherwise), upload and extract the zip, delete it.
3. Start the application and check `/api/health` shows the new `version`.

Migrations run at the first request after the start. Rollback: the same steps
with the previous zip, but only when that release has the same migrations
(2.7: a down migration needs a backup and the client's confirmation).

New seed content (phase 6, H43 with C8). A later release does not seed the
live database again: `seed/` is copied on the first start only (7.1 step 5).
New text in the seed files reaches a running site only by hand in the admin
or through the seeder's fill mode, `npm run seed -- fill`. Fill creates
missing records and fills empty fields. It never overwrites a filled field
and leaves a document with a medical reviewer unchanged. Fill is off by
default: nothing runs it at start or in the package. Before a fill, get the
client's yes and back up `~/sefid-data` (7.5).

The seeder reads `docs/content/*.yaml`, `content/data/*.yaml`, the media
files under `content/` and `src/seed/data/*.yaml`. The package ships none of
them: `scripts/package-cpanel.mjs` runs the seeder at build time from the
repository root. A fill therefore runs in one of two ways:

1. Ship those files with the release, then run the fill on the host.
2. Run the fill on a downloaded copy of `~/sefid-data`, then upload it again:
   stop the application, download the folder, run the fill on the copy from a
   checkout of the released commit (`release.json`) with
   `DATABASE_URL=file:<copy>/sefid.db`, `MEDIA_DIR=<copy>/media` and
   `DB_PUSH=false`, upload `sefid.db` and `media/` again, then start the
   application.

### 7.5 Backups

Everything that cannot be rebuilt is in `~/sefid-data`: `sefid.db`, `media/`
and `secrets.json`. Include the folder in the host's account backup and
download a copy every week. Copy `sefid.db` only while the application is
stopped, or with its `-wal` file beside it. Losing `secrets.json` signs every
admin out and voids pending form tokens; it does not lose data.

### 7.6 Known limits on this host

- One account memory limit (LVE) for Next.js, the Payload admin and sharp.
  An out-of-memory kill shows as a restart in the panel.
- The loader may stop an idle application; the minute cron keeps it warm
  and runs the job queue.
- sharp and libsql ship prebuilt Linux x64 glibc binaries. A host on an old
  glibc (CloudLinux 7, glibc 2.17) cannot load them; the start fails with a
  loader error in `stderr.log`.
- Request body caps of 2.5 (nginx) do not exist here: Next's own 10 MB cap
  applies (S11).

### 7.7 کارهای مشتری روی هاست cPanel

این فهرست، راه‌اندازی سایت روی هاست cPanel است. کارها را به همین ترتیب انجام دهید. هر سطر یک کار است.

1. فایل `sefid-cpanel.zip` را بگیرید. استودیو آن را می‌فرستد.
2. وارد cPanel شوید. بخش «Setup Node.js App» را باز کنید. «Create Application» را بزنید.
3. «Node.js version» را روی یکی از این‌ها بگذارید: `22.23.4` یا یک نسخهٔ ۲۲ جدیدتر، یا `24.22.1` یا جدیدتر. سایت روی نسخه‌های دیگر (از جمله ۲۳) بالا نمی‌آید. اگر چنین نسخه‌ای در فهرست نیست، از پشتیبانی هاست `Node 22.23.4` یا جدیدتر را بخواهید.
4. «Application mode» را روی Production بگذارید.
5. در «Application root» بنویسید `sefid`.
6. در «Application URL» دامنهٔ `sefiddental.ir` را انتخاب کنید. مسیر را خالی بگذارید.
7. در «Application startup file» بنویسید `app.cjs`.
8. سه متغیر محیطی اضافه کنید: `SITE_URL` با مقدار `https://sefiddental.ir`، `ALLOW_INDEXING` با مقدار `false` و `ALLOW_FIRST_USER` با مقدار `true`.
9. «Create» را بزنید. بعد «Stop App» را بزنید.
10. «File Manager» را باز کنید. وارد پوشهٔ `sefid` شوید. فایل zip را بارگذاری کنید. روی آن «Extract» را بزنید. بعد فایل zip را پاک کنید.
11. در «SSL/TLS Status» برای `sefiddental.ir` و `www.sefiddental.ir` گزینهٔ «Run AutoSSL» را بزنید.
12. در «Domains» گزینهٔ «Force HTTPS Redirect» را روشن کنید.
13. به «Setup Node.js App» برگردید. «Start App» را بزنید.
14. نشانی `https://sefiddental.ir/api/health` را باز کنید. باید عبارت `"status":"ok"` را ببینید.
15. نشانی `https://sefiddental.ir/giris` را باز کنید. حساب مدیر را با ایمیل کلینیک و یک گذرواژهٔ قوی بسازید.
16. در «Setup Node.js App» متغیر `ALLOW_FIRST_USER` را پاک کنید. «Save» و بعد «Restart» را بزنید.
17. در «Cron Jobs» یک کار با زمان‌بندی «Once Per Minute» بسازید. دستور بخش 7.3 بند ۶ را در آن بگذارید.
18. در پنل مدیریت سایت، «وضعیت سیستم» را باز کنید. از بخش «پیکربندی» عکس بگیرید و برای استودیو بفرستید.

اگر سایت بالا نیامد، فایل‌های `stderr.log` و `startup-error.log` را از پوشهٔ `sefid` بفرستید. هیچ فایلی از پوشهٔ `sefid-data` را برای کسی نفرستید: رمزهای سایت در آن است.
