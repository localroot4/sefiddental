# Security audit (phase 9, lane SEC)

Base: `main` at `456c289`. Date: 2026-10-30. Scope: `docs/prompts/09-quality-gate.md`
deliverable 4, plan section 4.4, and the phase 6 wave 2 security review (the CSV import and
the article approval access; the preview path is removed by lane SURFACE).

Result: **no high or critical finding open.** Three medium findings stay open until other
lanes and the owner act: SEC-1 and SEC-2 (the public `Server` workflow, lane OPS) and SEC-7
(admin lock-out from a public e-mail, owner and OPS). No past run log leaked a secret
(section 8). Of the four low findings, two are fixed here and two are handed to the integrator
with a ready change (section 10). Severity follows impact on patient data, the admin and the
live site.

## 0. Threat model

| Asset | Who wants it | Main defences |
|---|---|---|
| Booking rows (patient phone, name, note) | anyone on the Internet | staff-only REST access, TOTP for every staff session, HMAC IP hashes, log redaction |
| Admin accounts | anyone on the Internet | password policy (12+), 5 tries then 15 min lock, per-IP limit 10 / 15 min, TOTP forced (5 codes then lock), `SameSite=Strict` session cookie |
| Public pages | defacement, script injection | strict nonce CSP, no `dangerouslySetInnerHTML` with content, React escaping |
| The server (SSH key, `/etc/sefid/app.env`) | anyone who can run a workflow | workflow_dispatch needs write access; secrets never in files |
| Availability of the forms | spam bots | origin check, form tokens, honeypot, minimum age, per-IP and per-phone limits, process cap |

The repository is **public** since 2026-10-29. That adds three attack surfaces:

1. **Source and history are readable.** History was checked for secrets (section 9); the
   server IP, the admin path `/giris` and the architecture are public, which the design never
   relied on hiding.
2. **Fork pull requests.** `ci.yml` uses `pull_request` (never `pull_request_target`), has
   `permissions: contents: read`, `persist-credentials: false`, and no stored secret: every
   secret is random per run and masked. A fork's run gets a read-only token and no repository
   secrets. `server.yml` and `package-cpanel.yml` are `workflow_dispatch` (write access
   needed) plus `push` to `main` for the runner-only smoke test. No `${{ }}` expression is
   expanded inside a `run:` script: inputs reach scripts through `env:`, and `inputs.action`
   is a `choice`. Actions are pinned to commit SHAs.
3. **Actions logs and artifacts are public.** Anyone can read every run log and, signed in to
   GitHub, download artifacts for 14 days. CI artifacts (`vitest-coverage`,
   `e2e-budgets-lighthouse`) hold only fictional e2e data and per-run secrets of a server
   that no longer exists. The cPanel release asset holds the seeded public content and no
   account (`scripts/package-cpanel.mjs`, the seeder creates no user). **The `Server`
   workflow log is the open risk:** see SEC-1.

## 1. Headers and CSP

| Check | Where | Result |
|---|---|---|
| Static set (HSTS 2 years, nosniff, Referrer-Policy, Permissions-Policy) once per response | standalone build, e2e `http` project (T-HD1 to T-HD8, T-HD11) | pass |
| Public CSP: nonce + `'strict-dynamic'`, two script hashes, style nonce + one hash; no `unsafe-inline`, `unsafe-eval` or `unsafe-hashes` anywhere | T-HD1, T-HD3 (zero violations on public pages) | pass |
| Admin CSP: script nonce + `'strict-dynamic'`, no `unsafe-eval`, enforced | T-HD8 | pass |
| Admin `style-src 'unsafe-inline'` | `src/lib/http/csp.ts` | **accepted**: Payload injects runtime styles and exposes no nonce; a nonce or hash in the same directive would void `'unsafe-inline'`. Scripts stay strict, so this allows CSS injection only, no script. |
| API, feeds, internal: `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex` | T-HD4, T-HD5, T-HD7b | pass |
| Paths the proxy skips (`/api/media`, `/brand`, `/fonts`) unframeable | `next.config.ts` `headers()`, T-HD6, T-HD7, T-HD7b | pass |
| No `X-Powered-By`; no `x-middleware-*` through nginx | T-HD1; `server.yml` smoke | pass |
| e2e `http` project, standalone build, `--workers=1` | `tests/e2e/http/*` | 48 passed (with T-HD11) |
| Deployed preview through nginx | new workflow **Headers** (`.github/workflows/headers.yml`, `scripts/check-headers.mjs`, tests T-CH1 to T-CH3): the four route checks, the cookies each route must set, and a fresh nonce on two fetches of `/` (a cache in front of the app would repeat it) | ready; run it from the Actions tab after the next deploy (this session has no route to the preview, plan section 0 item 7). Locally against the standalone it passes every check except `x-middleware-rewrite`, which nginx removes (smoke step). |

## 2. OWASP Top 10 walkthrough

| Flow | A01 access | A02 crypto | A03 injection | A04 design | A05 config | A07 auth | A08 integrity | A09 logging | A10 SSRF |
|---|---|---|---|---|---|---|---|---|---|
| Booking `/api/booking` | Local API with `overrideAccess` only after every check; REST create is staff-only (AC8) | HMAC form tokens, AES-256-GCM flash cookie, HMAC IP hash | Payload queries are parameterized; React escapes the admin views; CSV export guards `= + - @` | answers suspicious requests like real ones, stores them flagged up to 50 per IP hour | 16 KB body cap before parsing | none needed (public form) | `Sec-Fetch-Site`/`Origin` check, `SameSite=Lax` `__Host-` cookie | redacted keys and phone scrub, `ipHash` only | none |
| Emergency `/api/emergency` | same handler; 404 while the feature is off | same | same | 3 per IP and day | same | none | same | same | none |
| Form session `/api/form-session` | no data returned but tokens | HMAC | none | 60 / min per client | no-store | none | same-site cookie | none | none |
| Events `/api/events` | write-only counter | none | zod schema, allowlist mapping, 2 KB cap | 60 events / min per client, 3000 / min per process | no cookie read or set | none | origin check | no IP stored | none |
| CSP report `/api/csp-report` | write-only log | none | parser caps 16 KB | 30 / min per client, one line per directive and hour | none | none | none | dedupe | none |
| Cron `/api/cron/tick` | bearer `CRON_SECRET`, constant-time compare, 401 | 43+ char secret enforced at start | none | one tick at a time | none | bearer | runs jobs as job runner only | `cron_tick` line, status view | none |
| Health `/api/health` | public by design | none | none | 5 s memo on the database probe | no version of Node, host or env names; Git SHA is public anyway | none | none | change lines only | none |
| Internal `/api/internal/*` | `x-internal-token`, constant-time, 404 to everyone else | 43+ char secret | zod | none | none | token | none | none | target is `INTERNAL_ORIGIN`, never a request value |
| Admin sign-in with TOTP | `forceSetup`; every access wrapped (TS1 to TS3) | JWT with `useSessions` (logout revokes), 8 h | none | 10 / 15 min per IP on login, reset, both TOTP endpoints | `/create-first-user` and `/api/users/first-register` closed unless `ALLOW_FIRST_USER`; `/api/users/verify` closed | 12+ char passwords; 5 password or code tries, then 15 min lock (plugin `totp-attempts`) | Payload CSRF allowlist = `SITE_URL`, `SameSite=Strict` | sign-in, sign-out, reset audit rows | none |
| CSV import `/api/redirects/import` | TOTP-verified admin only (R14, SA4) | SHA-256 digest binds apply to the dry run | cells are paths, never formulas: `fromRule` and `toRule` refuse anything not starting with `/` (SA4) | dry run first, cap = snapshot max | JSON only (preflight), **4 MiB counted in bytes; refused on the declared size, else read only up to the limit (SEC-6, fixed)** | admin | writes through the collection hooks | one line per run | URLs are parsed, never fetched |
| Article approval (H5) | `reviewGate` refuses «تأییدشده» from editors on create, update, bulk update, duplicate and version restore (restore runs `beforeValidate` with the old version as data); reviewer and review date are admin-only fields | none | none | an editor change to reviewed content resets to «منتظر بازبینی» in the same save (ED8, ED9) | none | admin | the publish gate validates after the hook | audit rows | none |
| Media upload | staff only; anonymous refused before the body is read (MS5) | none | stored name is `slug-sha256.ext` from the bytes, never the client path or extension (SA1) | 20 MB images, 60 MB videos, 50 MP, one encode at a time | SVG refused, bytes decide the type (MI1, MS7, SA2) | staff | originals re-encoded, so an appended payload is dropped (SA2); trashed files stop serving (MS3) | audit rows | a create without a file never fetches `data.url` (MS4) |

Not found: SQL injection, stored XSS, open redirect (`/\host`, `//host`, `%5c` and Host
header spoofing all stay on the site: probed on the standalone, and `destination()` falls
back to `/` for any off-site target, D1), path traversal, SSRF.

## 3. Authorization matrix

`tests/int/access.int.test.ts`. TOTP-verified sessions; an unverified session is refused
everywhere (TS1 to TS3). `r c u d` = read, create, update, delete; `t` = trash only.

| Collection or global | anonymous | editor | admin | Test |
|---|---|---|---|---|
| services, service-categories, service-tiers, doctors, insurances, financing-options, article-categories | none | r | r c u d | AC1, AC2, AC4, AC8 |
| tags | none | r c u | r c u d | AC4 |
| articles, testimonials, cases | none | r c u t (approval: section 2) | r c u d | AC4, AC5, ED8 |
| pages | none | r | r c u d | AC7 |
| media | none (files public, trashed files 404) | r c u (live only) | r c u d | MS3, MS5, MS8 |
| bookings | none | r c u; never d; phone and kind admin-only | r c u d | AC8, **AC10** |
| redirects | none | none | r c u d; import endpoint | AC2, AC4, R14 |
| users | none | own row r u; role admin-only; never unlock | r c u; d others, never self; unlock | AC2, AC6, **AC11**, **AC13** |
| events-daily, sms-throttle, audit-log | none | none | r only | **AC9** |
| payload-jobs, payload-kv, totp-attempts | none | none | none (server code only) | **AC9** |
| payload-preferences, payload-locked-documents | none | own rows (Payload) | own rows | Payload defaults |
| payload-migrations | none; no REST route (501) | Local API only | Local API only | accepted, SEC-9 |
| globals: clinic, seo-defaults, features, notifier, system-state | none | none | r u | AC1, AC3, **AC8**, **AC9** |
| `/api/payload-jobs/run` | cron bearer only | none | TOTP-verified | **AC12** |
| `/api/bookings/export` | none | none | TOTP-verified | AC10 (admin-bookings) |

Bold: added in this audit. AC8 (no anonymous write anywhere), AC9 (system stores), AC10
(booking delete, phone and kind), AC11 (accounts), AC12 (job runs) and AC13 (unlock, which
also lifts the TOTP code lock) were each shown red once
by breaking the rule on purpose (`p9/out/sec/red-proof.txt`).

## 4. Rate limits (scratch script, limit + 1 requests)

`p9/out/sec/ratelimit-probe.mjs` against the standalone build with
`TRUST_PROXY_HEADERS=true`, one `X-Forwarded-For` address per route. All pass:

| Route | Limit in the code | Request at the limit | Limit + 1 |
|---|---|---|---|
| POST `/api/users/login` | 10 / 15 min per client (`src/proxy.ts`) | 401 | 429 |
| POST `/api/users/forgot-password` | same bucket rule | 200 | 429 |
| POST `/api/setup-totp` | same | 200 | 429 |
| POST `/api/verify-totp` | same | 200 | 429 |
| POST `/api/users/%4Cogin/` (other spelling) | same, routed path | 400 | 429 |
| POST `/api/events` | 60 events / min per client | 204 | 429 |
| POST `/api/csp-report` | 30 / min per client | 204 | 429 |
| GET `/api/form-session` | 60 / min per client (`FORM_SESSION_RATE_LIMIT`) | 200 | 429 |
| POST `/api/booking` (and `/api/emergency`) | 600 / min per process, **503 + Retry-After** by design | 422 | 503 |

The booking and emergency per-IP (10 / h, 3 / day) and per-phone (3 / day) limits answer like
a real request by design and store the request as flagged; `tests/int/booking.int.test.ts`
covers them. The notifier test action (1 / min) is covered by NT14. nginx adds
`limit_req` on media writes and the form routes (`deploy/vps`, smoke).

## 5. Uploads and imports

`tests/int/media.int.test.ts`; SA1 to SA5 are new and were each shown red once.

| Abuse | Result | Test |
|---|---|---|
| SVG, SVG renamed `.png` | refused | MI1 |
| JPEG bytes claimed as MP4; GIF claimed as JPEG | refused | MS7 |
| HTML claimed as MP4 or WebM, or named `.html` | refused (Payload type check plus the hook) | SA2 |
| JPEG with an HTML payload appended (polyglot) | stored re-encoded without the payload, served `image/jpeg` + nosniff | SA2 |
| `../../../etc/passwd.jpg`, `..\..\boot.jpg`, `page.html`, `logo.svg` with JPEG bytes | stored as `<slug>-<sha256>.jpg` in the media folder | SA1 |
| Image over 20 MB | refused with the Persian message | SA3 |
| Anonymous multipart body | 403 before the body is read | MS5 |
| Video with a recording location | refused | MS9 |
| CSV cells `=HYPERLINK(…)`, `=cmd|…`, `@SUM(…)`, `+1`, `https://…`, `javascript:` | refused rows, nothing written | SA4 |
| Import body of 2.4 M Persian letters (under 4 Mi UTF-16 units, over 4 MiB) | 413 (was accepted) | SA5 |
| Import with a declared `Content-Length` over 4 MiB | 413 before the body is read | SA5 |

## 6. Cookies

| Cookie | Flags (observed on the standalone build) |
|---|---|
| `payload-token` | `HttpOnly; Secure; SameSite=Strict; Path=/`, 8 h; `Secure` only when `NODE_ENV=production` (always on the server) |
| `payload-token-totp` (plugin) | `HttpOnly`, `SameSite=Strict`, `Secure` as above, same lifetime |
| `__Host-sefid-form` | `Secure; HttpOnly; SameSite=Lax; Path=/`, 24 h (T-HD11 asserts this and the `payload-token` row) |
| `sefid-flash` | `Secure; HttpOnly; SameSite=Lax`, 10 min, AES-256-GCM sealed |

Payload writes `Secure=true; HttpOnly=true`; browsers read the attribute names and ignore the
value (RFC 6265 5.2.5, 5.2.6). The login and `/api/users/me` bodies also carry the JWT: SEC-4.

## 7. Dependencies

- `npm audit --omit=dev --audit-level=high`: **exit 0.** 17 production advisories, 11 low and
  6 moderate:
  - `esbuild <= 0.24.2` (moderate) under `drizzle-kit` (the migration CLI loader): affects the
    esbuild dev server only, which the app never starts.
  - `deepmerge 4.3.1` (low, GHSA-gcqx-w48m-w2h4, prototype poisoning of the returned object)
    under `payload`: Payload merges config objects and localized field data with it; the site
    has one locale, and no request body reaches it as a merge source.
  - Every other row (`@payloadcms/*`, `payload-totp`) is the same two, inherited.
- `npm audit` (dev included): 14 high, all in dev tools: `@lhci/cli` → `lighthouse` →
  `puppeteer-core` (`extract-zip`, `tmp`, `basic-ftp`, `proxy-agent`, `chromium-bidi`'s own
  `zod 3`) and `express`'s `body-parser`. They run only in CI against a local server and never
  ship (`.next/standalone` carries production dependencies only). The app's own `zod` is
  4.6.7, past GHSA-mrhx-c7xc-m3w5. Recheck when `@lhci/cli` releases.

## 8. Public repository: workflow review

| Check | Result |
|---|---|
| `pull_request_target`, `workflow_run`, `issue_comment` triggers | none |
| Fork PRs get secrets | no: `ci.yml` stores none; `server.yml` is not triggered by `pull_request` |
| Untrusted input in `run:` | none: inputs go through `env:`; `action` is a choice |
| Token permissions | `contents: read` (CI, Server), `actions: read` for the deploy CI check; `contents: write` only in the manual cPanel packaging |
| Artifacts | fictional data only (section 0) |
| Run logs | **public**: SEC-1. The 21 past `Server` jobs that reach the server (5 `run`, 5 `status`, 9 `deploy`, 1 `seed`, 1 `first-admin`, 2026-10-26 to 2026-10-30) were downloaded and searched: no secret value (only the script text `PAYLOAD_SECRET=$secret`, masked values show `***`); the 5 `run` commands print host facts, a reboot and curl status codes only. The `first-admin` run of 2026-10-26 shows the admin e-mail twice (the step `env:` header and the script line): SEC-7. |
| Repository secrets scope | any workflow file on any branch pushed by a collaborator can read them: SEC-2 |

## 9. Secrets in history

- `git log -p --all` (225 commits, one author) against: AWS keys, private keys, GitHub tokens,
  Slack tokens, OpenAI and Stripe keys, Google API keys, Telegram bot tokens, URLs with
  passwords, and assignments to every app secret name with 16+ characters. 21 hits, all
  placeholders or CI throwaways (`CHANGE_ME`, `postgres:postgres` of the CI service,
  `user:password` in docs, `deadbeef` in a test). No secret.
- Every file name ever committed: no `.env`, key, certificate, dump or database file.
- GitHub secret scanning: the API is not reachable from this session (proxy refuses the
  path; the MCP scan answers «Advanced Security not enabled»). Owner action in section 11.

## 10. Findings

| Id | Severity | Finding | Status |
|---|---|---|---|
| SEC-1 | Medium | The `Server` workflow log is public. The `run` action prints the command and its output, and `logs` prints 300 app log lines; nothing masks `/etc/sefid/app.env`, so one `run` like `sudo cat /etc/sefid/app.env` would publish every server secret, and a `psql` query would publish patient data. No past log did (section 8). | Open, handed to OPS (`server.yml`, `p9/findings/sec.md`): `run` keeps its output out of the log (an `age`-encrypted artifact for the owner's key, as decision 2b), plus a mask of the secret values before every step that prints server output. A mask alone does not cover `base64` or patient data. |
| SEC-2 | Medium | `SERVER_SSH_KEY` and `ADMIN_PASSWORD` are repository secrets: a workflow pushed on any branch reads them. Fork PRs cannot (checked), so this needs a collaborator account. | Handed to OPS and the owner: a GitHub Environment `server` limited to `main`, secrets moved there, `environment: server` on the job. |
| SEC-3 | Low | The deployed preview had no scripted header check outside the server smoke test. | Fixed: workflow **Headers** and `scripts/check-headers.mjs` (T-CH1 to T-CH3). |
| SEC-4 | Low | Login, `/api/users/me` and refresh answer the JWT in the JSON body, which a script on the admin origin could read despite `HttpOnly`. The strict script CSP makes such a script unlikely. | Handed to the integrator (`src/collections/Users.ts` has no wave 1 owner): `auth.removeTokenFromResponses: true`; nothing in the admin, `payload-totp` or the site reads the body token (checked). |
| SEC-5 | Low | `toRule` accepts targets that a URL parser reads as another host: `/\host`, and `/` + tab + `/host` (the parser drops the tab). The proxy's `destination()` turns any off-site result into `/` (D1), so no visitor leaves the site, but the row is stored and the import shows it as «new». | Handed to the integrator (`src/hooks/redirects.ts`): refuse a `to` that `new URL(to, SITE_URL)` resolves to another origin, the same test as `destination()`. |
| SEC-6 | Low | The CSV import read the whole body before its 4 MiB check and counted UTF-16 units, so a Persian file up to about 8 MiB passed, and a chunked body was read whole. Admin only. | Fixed in `src/admin/redirects/importEndpoint.ts` with the shared `readTextCapped` (declared size first, then a stream read that stops at the limit); SA5 covers the three cases. |
| SEC-7 | Medium | Five wrong passwords or codes lock an account for 15 minutes, so anyone who knows an admin's e-mail can keep that account locked from rotating addresses. The only admin's e-mail is public in the `first-admin` run log of 2026-10-26, and `first-admin` and `reset-admin` print it again on every run. | Open, owner and OPS (`p9/findings/sec.md`): delete that run's log; sign in with an e-mail that is not published; take the admin e-mail from a secret instead of an input; a fail2ban jail on repeated 401s of `/api/users/login`. The lock itself stays: it is the brute-force defence. |
| SEC-8 | Info | Without SMTP (gap 55) Payload logs «Email attempted… To: '<e-mail>'» for a password reset, so a staff e-mail can reach a public `logs` run. | Covered by the SEC-1 fix plus SMTP at launch. |
| SEC-9 | Info | `payload-migrations` keeps Payload's default access (any signed-in user) on the Local API. It has no REST route (`endpoints: false`, 501) and no admin view; only server code with `overrideAccess` touches it. | Accepted. |
| SEC-10 | Info | Production audit: moderate `esbuild` and low `deepmerge` advisories; dev audit: 14 high in Lighthouse tooling. | Accepted with reasons, section 7. |

## 11. Owner actions (GitHub settings, no code)

1. Settings, Code security: turn on secret scanning and push protection (free on public
   repositories), and private vulnerability reporting.
2. Settings, Actions, General: keep «Require approval for all outside collaborators» for fork
   pull request workflows.
3. Create the Environment `server` (deployment branch: `main`), move `SERVER_SSH_KEY` and
   `ADMIN_PASSWORD` into it, then apply the SEC-2 change.
4. Delete the log of the `Server` run 40367459594 (`first-admin`, 2026-10-26): it shows the
   admin e-mail (SEC-7). Then change the admin's sign-in e-mail to one that is not published
   anywhere.

## 12. Evidence

- `npm run lint && npm run typecheck && npm test`: see the lane hand-off (`p9/out/sec/apply.md`).
- e2e `http` project on the standalone build, `--workers=1`: section 1.
- Red proofs, rate-limit run, audit output, secrets scan: `p9/out/sec/`.
- Independent reviewer: section 13.

## 13. Independent review

A separate reviewer agent read this file, `p9/findings/sec.md` and the lane diff.

First pass, eight points, each resolved:

| Point | Resolution |
|---|---|
| Past `Server` run logs, public since 2026-10-29, were not checked | Checked: 21 jobs, no secret value (section 8) |
| SEC-7 rested on «admin e-mails are not published», but a run log shows one | SEC-7 raised to Medium and opened; owner action 4 |
| SEC-6 still read a chunked body whole, and a non-numeric `Content-Length` skipped the check | Fixed with `readTextCapped`; SA5 adds the chunked case (shown red once) |
| The SEC-1 mask misses `base64`, new names and patient data | SEC-1 fix now keeps `run` output out of the log; the mask stays as a second layer |
| The headers check passed when an expected cookie was missing | `scripts/check-headers.mjs` now names the cookies each route must set (T-CH3); the session cookie flags are asserted in e2e T-HD11 |
| SEC-5's backslash rule misses `/`+tab+`/host` | The proposed fix compares the resolved origin, as `destination()` does |
| `users.unlock` was not in the matrix | AC13 (shown red once) |
| The result line hid the open medium findings | Rewritten |

Second pass: the eight resolutions hold; **verdict: no high or critical open.** It raised ten
low or info points:

| Point | Resolution |
|---|---|
| AC9 checked only read and create on the system stores | AC9 also refuses update and delete for editors and admins (shown red once) |
| AC13 did not try a password-only admin | Added (shown red once) |
| The cookie test reused the id T-HD9 | Renamed T-HD11 |
| The deployed check did not prove a fresh nonce | `check-headers.mjs` fetches `/` twice and compares |
| The non-numeric `Content-Length` rule lived in the import endpoint only | Moved into the shared `readTextCapped` (`src/lib/http/body.ts`, BD1 shown red once), so the booking, events, CSP report and internal routes refuse it too |
| The byte recheck after a stream read could turn invalid UTF-8 into a false 413 | The recheck runs on the `text()` path only |
| The static header set was copied into the check's test | The test imports `STATIC` from the script |
| `/api/media` and the port 80 redirect are not in the deployed check | Left open (low): the server smoke test covers `/`, `//` and a Persian route only. Adding `/api/media` and the HTTP redirect to `CHECKS` is a candidate for lane OPS, which owns the nginx config |
| T-HD11 parses `Set-Cookie` by hand where `storageState()` would do | Left: the raw header is what this audit inspects (Payload's `Secure=true` spelling) |
| Section 1 counts and the cookie test reference | Updated |
