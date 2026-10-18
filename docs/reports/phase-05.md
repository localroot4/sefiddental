# Phase 05 - Conversion System

Date: 2026-10-15 to 2026-10-18.

## Plan (written before building)

What: the booking page, its success page and the booking dialog; the
booking and emergency pipeline (normalization, honeypot, signed time
token, suspicious storage, per-phone and per-IP limits, duplicates,
persist-then-notify through a `Notifier` with `log` and `mail` drivers and
`telegram` and `farapayamak` scaffolds, SMS cap, queue retries); the
emergency page; the admin booking workflow in Payload; the pricing and
payment page; the restoration tiers finalized; first-party measurement and
the optional GA4 loader with `docs/analytics.md`; the privacy page draft;
e2e for every acceptance item; screenshots in `docs/qa/phase-05/`.

Order:

1. Wave 1, two parallel lanes: PIPELINE (request schemas and their tests
   first, then the handlers at `/api/booking` and `/api/emergency`, the
   proxy rewrite of the form posts, the no-JS flash cookie, the Notifier
   and its job, the SMS cap table, the QA hours clock) and PAGES5 (pricing,
   privacy, tiers, events, GA4 loader, analytics doc, the financing
   fixture).
2. Integration: one migration per adapter for the schema changes, build,
   unit, integration and e2e.
3. Wave 2, three parallel lanes on top: BOOKING-UI (booking page, success
   page, dialog, home wiring, island recovery paths), EMERGENCY-UI (the
   emergency page), ADMIN (list, tabs, status workflow, callback due,
   suspicious restore, bulk spam, CSV, dashboard widget).
4. Verification: build, e2e, screenshots at 390, 820 and 1440 px in both
   themes, axe, Lighthouse on the booking and pricing pages; inspect, fix
   in one batch, confirm once.
5. Independent review of the whole pipeline for spam, abuse and data
   exposure (prompt step 4); record and fix.
6. Report, commit, push, CI green.

Main decisions (full list in the Decisions section when the phase closes):
the insurer wording of freeze F31 wins over the prompt's «سایر بیمه‌ها»
until the client answers gap 51; the form `action` stays `/رزرو-نوبت` and
the proxy hands the post to the API route; values come back to the no-JS
page through a short encrypted cookie, never a URL; suspicious rows never
count toward a real person's limits; the island waits until its token is
2 s old before it posts, so fast autofill is not stored as suspicious.

Risks: the CI Total Blocking Time gate (phase 4 CI section), the 70 KB
booking-page JS target under a 131.8 KiB framework floor, Telegram reach
from a host in Iran, and the hours-dependent emergency order in tests.

## Delivered

Commit range on `main`: `51697dc` to the commit that closes this report
(it adds this report and the screenshots), oldest first. `e56d732`, the
last phase 4 report commit, sits between the first two.

- `51697dc` Add the booking and emergency request pipeline
- `09a703e` Add the pricing and privacy pages, the tier choice and measurement
- `444128b` Check the pricing and privacy pages in e2e, budgets and Lighthouse
- `502f7ed` Gate total blocking time against the framework floor of the same run
- `2567601` Add the booking page, its success page and the booking dialog
- `6b8d9b7` Add the emergency page
- `d359a74` Add the admin booking workflow and harden the form pipeline
- `d03ba74` Check the conversion pages in budgets, Lighthouse, axe and screenshots
- `6435152` Clear a field's message as soon as its value is valid
- `6df6db4` Correct the e2e checks that phase 5 changed
- `b2f37af` Scan the no-JS page copy at the page's own URL
- `1ea0713` Start every full-page QA capture at the top with the pointer parked
- `e7deee9` Ship no GA4 code while GA4 is off
- `421b9d2` Give the booking class a Lighthouse allowance for the deferred dialog
- `fb49eb1` Load the dialog's booking island after the page and slim the form chunks
- `ebebe0d` Write the form's hidden fields after the submit's last wait
- `9e8e7e7` Hide the sticky bar in full-page captures through its style property
- `f32b5d6` Record the notification, SMS and emergency copy gaps
- `efb975c` Mask phone numbers with asterisks and keep the admin mask in order
- `fe06292` Put the booking contact and status first in the admin record
- `bd1c354` Fix the booking and emergency form states the screenshots showed
- `e57edff` Fix the content page layouts the screenshots showed
- `15f830b` Keep a badge on one line and move it under a narrow tier name
- `1576b29` Give the emergency capture test the time its phone run needs
- `527971f` Give the form islands their control and info classes from the server
- `6a7ee34` Package the site for the shared cPanel host the clinic bought
- `2e9d63c` Open the internal listener before capturing Next's server
- `2720848` Default the forwarded protocol to https on the panel host
- `a5852f7` Add the phase 5 screenshots
- `b5d5cf9` Fix what the screenshot confirmation pass found in the fixes

Versions: as phase 4. Two new packages, both exact devDependencies of
versions Payload already ships: `drizzle-orm` 0.45.2, an exact
devDependency: the log tests import its `DrizzleQueryError` to prove that
bound values never reach a log line. Payload's database adapters already
ship the same version. `@libsql/client` 0.14.0: the cPanel package
script folds the seed database's write-ahead log into one file with it.

What exists now, by area:

- Request pipeline (`src/lib/booking/`, `/api/booking`,
  `/api/emergency`): request schemas with Persian and Arabic-Indic digit
  normalization, the honeypot, the signed 2-second time token and the
  form-session cookie, suspicious storage, rolling 24-hour per-phone and
  per-address rules, the 10-minute duplicate append (at most 20 entries a
  row, the overflow counted), the S1 to S6 abuse rules, JSON answers for
  the islands and 303 plus an encrypted flash cookie without JavaScript.
  The proxy hands the form posts to the API routes; the form `action`
  stays `/رزرو-نوبت` and `/اورژانس`.
- Notifications (`src/lib/notify/`): persist first, then one queued job
  per channel holding ids only. `log` and `mail` drivers work;
  `telegram` and `farapayamak` are scaffolds. Five tries from 60 s, the
  SMS cap through `sms-throttle` (an HMAC of the number), channel budgets,
  one spike alert per window. A notification shows a masked phone and an
  admin link, never the number.
- Booking UI: the booking page `/رزرو-نوبت` (indexable, rendered per
  request), the one-time success page (noindex), the booking dialog
  (native modal `<dialog>`: bottom sheet under 1024 px, focus trap, Esc,
  focus return, scroll lock; its island loads after `load`), the home hero
  card and home block wired to the pipeline, every recovery state (419
  renewal, network, server, unsent, neutral) with and without JavaScript.
- Emergency page `/اورژانس`: order by the hours state, the safety box, the
  triage checklist validated on the server, the avulsion first aid revealed
  with CSS, the call-first layout during hours, its own island and no-JS
  path.
- Pricing `/هزینه-و-پرداخت` and privacy `/حریم-خصوصی`: the restoration tier
  choice (radios, none checked, one CTA carrying the tier), financing only
  when enabled with the surcharge note first and amounts in words, the
  insurers by name; the privacy draft from the facts of the pipeline.
- Admin: the bookings list with tabs (all, new, callback due, urgent,
  suspicious, closed), urgency order, the contact cell (call and WhatsApp), bulk «اسپم»,
  one-click restore, CSV export for «مدیر» (formula guard, bidi controls
  dropped, 10 000-row cap), the record with contact, status and callback
  due first, the status workflow with its audit trail, the dashboard
  widget «درخواست‌های امروز», the notifier settings with a test action, and
  new rows in «وضعیت سامانه».
- Measurement: the first-party counter (`/api/events`, daily totals in
  `events-daily`), the event dictionary of `docs/analytics.md`, and the GA4
  bootstrap `/ga4.js`, which ships only while GA4 is enabled.
- Database: one migration per adapter for the conversion schema
  (`20261015_231648` and `_231654_phase5_conversion`) and one for the security review
  (`20261016_025729` and `_025735_phase5_security`). The security
  migration's down step refuses to run while audit rows of the new export
  action exist.
- Hosting (added at the end of the phase, when the client bought a shared
  cPanel host): `deploy/cpanel/` (the startup file: data folder, secrets
  generated on the host, first-run seed, loopback listener for the
  internal calls, the forwarded protocol default),
  `scripts/package-cpanel.mjs` and the workflow "Package for cPanel";
  `docs/deploy.md` sections 1, 3 and 4 rewritten for that host.
- Docs: `docs/analytics.md` (new), `docs/conversion.md` 5.2, 5.3, 5.4 and
  7.3, `docs/deploy.md` 2.4 and 2.5 (nginx caps, `limit_req`, the
  post-deploy proxy check), `docs/brief.md` (the TBT gate),
  `docs/content/gaps.md` rows 55 to 57, `docs/content/services.yaml` (the
  CIP line).

## Decisions and deviations

### Studio decisions of this phase (the freeze)

| # | Decision | Why |
|---|---|---|
| G1 | The pricing page and every page name the five featured insurers under «همکاری با بیمه‌ها»; never «سایر بیمه‌ها» or «طرف قرارداد» until gap 51 closes | Freeze F31 wins over the phase prompt's wording: an unconfirmed contract claim |
| G2 | One handler module per form at `/api/booking` and `/api/emergency`; the form `action` stays `/رزرو-نوبت` and `/اورژانس` and the proxy rewrites those two POSTs; JSON when `Accept` asks for it, else 303 | Real links and real form posts without JavaScript; one tested handler per form |
| G3 | No-JS values and the success summary travel in an encrypted, HttpOnly, Secure, SameSite=Lax cookie for 10 minutes, read once; never a phone, name or note in a URL | URLs end up in logs, history and referrers |
| G4 | Rolling 24 h windows; suspicious and spam rows never count toward a person's limits; the 4th request in 24 h appends and answers neutral; a bad token is stored suspicious and shows success; a cross-site post answers 403 | A real patient is never blocked by someone else's spam; a bot learns nothing |
| G5 | The island holds the POST until its token is 2 s old | Fast autofill is not stored as suspicious |
| G6 | The callback line comes from the server's hours state at submit time; the phase 4 native re-post on 404/405 is gone | One clock; no double submit |
| G7 | Native modal `<dialog>` for «رزرو نوبت» on pages without an inline form: bottom sheet under 1024 px, centered above, scroll lock with a stable gutter, focus trap, focus return; one form per page; none on home | Accessible by default; no layout jump |
| G8 | `booking_open` only when a CTA routes in the page; the booking page view sends one; the server counts the no-JS successes; events never carry a phone, name or note | Honest counts without personal data |
| G9, G10 | A «تماس با کلینیک» fallback on every success state; the emergency link in the full form's help text everywhere except home | A second way to reach the clinic; the emergency path is one tap away |
| G11 | Persist first, then one job per channel holding ids only (log and mail now, Telegram and Farapayamak scaffolded); 5 tries from 60 s; masked phone and an admin link only; SMS at most once per form destination per 24 h through `sms-throttle` (HMAC of the number) | A notification outage never loses a request; no phone number in a message or log |
| G12 | The emergency page order follows the hours state; the priority promise shows only when confirmed (gap 19); the avulsion first aid reveals with CSS `:has()`; with `features.emergencyEnabled` off the information stays, the form becomes a booking link and `/api/emergency` answers 404; the safety box uses the warning color, never `role="alert"` | Calm, correct guidance without promises the clinic has not made |
| G13 | Restoration tiers: one radio per tier, none checked in the HTML, one primary CTA carrying the chosen tier; the handler rejects an unknown tier | No choice recorded that the patient did not make (F24) |
| G14 | «از … تومان» only where a price is set (none today); financing only when enabled, the surcharge note inside the card before any amount; amounts also in words; no promise of the cost in the first session | Money copy that cannot mislead (gap 50) |
| G15 | Admin: urgency order, explicit sorts on every tab, bulk actions in the list's selection, Gregorian pickers with Jalali cells, CSV only for «مدیر» with a formula guard and a 10 000-row cap; the audit merge bug fixed with a failing test first | Staff see the urgent request first; exports cannot run formulas |
| G16 | GA4 loads only when enabled, after `load`, without an inline script; CI keeps it off; `docs/analytics.md` documents every event | Privacy and the CSP |
| G17 | Privacy page drafted from the facts of the pipeline; retention «until an admin deletes it» (gap 43) | Says only what the code does |
| G18 | e2e: the app server trusts one proxy hop; each test sends its own `X-Forwarded-For` (2001:db8::/32) and phone; real submits wait 2.1 s; a QA-only header sets the hours clock; the QA fixture enables one financing option | Tests that cannot see each other's rate limits or the real clock |
| G19 | The booking class lists `/رزرو-نوبت` and `/اورژانس` (150 KiB interim); pricing and privacy join the content class; Lighthouse adds the booking, emergency and pricing pages | The budgets cover every new page |
| G20 | New strings through `src/i18n/fa-<area>.ts` or the seed, under the copy rules; emergency copy from `docs/conversion.md` section 7 verbatim where it exists | One source per string; copy checks apply |

### Lane decisions beyond the freeze

Pipeline:

- 422 answers carry error codes, never Persian text; each form maps the
  codes to its own strings.
- The handler notifies after the create (not an `afterChange` hook), so
  staff-created and seeded rows never notify. A queue failure is logged and
  the row stays.
- Only the no-JS flow writes the first-party counter: `booking_success`
  counts success and neutral, `emergency_submit` counts new rows only;
  suspicious requests are never counted. JSON answers leave counting to the
  island's beacon.
- The duplicate window and the per-phone limit read rows of the same kind. A
  repeat is appended only to an open row (regular: new, contacted,
  scheduled; emergency: new, contacted), at most 20 appended entries per
  row; beyond that the answer stays neutral and nothing is written.
- The per-IP hour counts rows plus appended entries, read from the database,
  so it survives restarts. Requests from one IP hash run one at a time
  through count and write; the IP lock is always taken before the phone
  lock.
- The flash cookie is `__Host-sefid-flash`, AES-256-GCM with a key derived
  from `FORM_TOKEN_SECRET`, consumed only by a GET of its target; a no-JS
  note too long for one cookie is dropped from the kept values.
- A failed hours read still stores the request, with a null callback time;
  the page then shows the generic callback line.

Pricing, privacy and measurement:

- The pricing tiers summary also uses radios plus one CTA (G13 over spec
  S3 "no radios"); it shows the description and the price only.
- The pricing title is «هزینه دندانپزشکی و بیمه»; the seed comment tells the
  admin to add «وام» once a financing option is enabled.
- `data-tier` and `data-provider` are read on the clicked element only:
  `<html data-tier>` is the quality tier.
- `content_to_service` is recognized by the link target: a same-site link
  to a service page inside a guide or article.
- Financing cards show no CTA while WhatsApp is unverified; insurers show
  names only (uploaded logos are skipped because the picture sizes crop
  them; a `shortcut:` comment marks it).
- The privacy page leaves cookie names out (Latin names with leading
  underscores break right-to-left text).

Booking page and dialog:

- `/رزرو-نوبت` stays indexable (`docs/ia.md`, the keyword map); the success
  page is noindex. Both render per request and are never stored.
- The dialog is mounted per page (booking, emergency, privacy, the 404
  template), not in the site shell. If the clinic or features read fails it
  renders nothing and logs `booking_dialog_unavailable`.
- Closing the dialog (Esc or «بستن») never validates the field it leaves.
- The chrome's booking route fills a CTA's service and tier into the form it
  routes to; the home helper that did the same on its own was removed.

Emergency page:

- The safety box sits under the lead at every width.
- The emergency form has its own island; a 419 for missing tokens is
  handled like an expired token.
- The QA fixture adds a closed holiday on 2027-03-21 so the holiday state
  can be shown; it is outside the 60-day window of the holidays gap.
- `pages` shows the reviewer, review date and sources fields on the
  emergency page; they become required for publishing only once the page
  has self-care blocks, so the page publishes today (`needsMedicalReview`,
  PG-MR1).

### Decisions at the close of the phase

| Decision | Why |
|---|---|
| The CI TBT gate is the higher of 400 ms and the framework floor's median plus 250 ms, measured on `/qa/floor` in the same run (`502f7ed`) | Run 29 failed on TBT for unchanged pages on a slow runner; a fixed limit fails at random there |
| The dialog's booking island loads after `load` (React.lazy inside `<Activity>`); the booking class gets a 5 KiB Lighthouse allowance for it (`fb49eb1`, `421b9d2`) | Lighthouse counts every script of the load; the initial JS stays inside the class limit |
| No GA4 code ships while GA4 is off: a first-party `/ga4.js` bootstrap loads only when enabled (`e7deee9`) | Zero third-party requests and less JS by default |
| The form islands take their control, info and submit classes from the server (`527971f`) | One source per class list; the restoration page was 25 bytes over its scripts gate |
| The phone mask is «۰۹۱۲ *** ۶۷۸۹» everywhere, in an LTR isolate inside plain RTL text (`efb975c`) | Bullets beside Persian digits read as zeros; the admin title showed the groups reversed |
| Hosting path C2: the client's shared cPanel host, with SQLite in a data folder outside the release and a package built for the panel's loader (`6a7ee34`, `docs/deploy.md` 1.2) | The client bought the host and asked to go live on it; the limits of `docs/deploy.md` 1.3 are accepted |

### Security review decisions (prompt step 4)

An independent review of the public pipeline found 0 critical, 1 high, 5
medium, 5 low and 1 info findings. Each fix lane was reviewed again by a
second, adversarial reviewer and fixed again (see Independent review).

| # | Finding | Decision |
|---|---|---|
| S1 | High: anyone could store unlimited «مشکوک» rows | Above 50 suspicious rows per address key in a rolling hour, a further suspicious request gets the same success answer and is not stored; one `form_dropped` line per key and hour carries a hash prefix and a count. One limiter per process caps the two form routes at 600 requests a minute (503 with Retry-After for JSON, the «server» message for no-JS). This changes `docs/conversion.md` 5.3 "never dropped" |
| S2 | Unknown client IP skipped the per-IP rule | Unknown clients share one fixed key with ten times the limits (100 an hour, 500 suspicious an hour, 30 emergencies a day). The System status view shows red in production when `TRUST_PROXY_HEADERS` is off or the chain is broken. The start does not fail. This overrides freeze G4 and Q7 ("skip") |
| S3 | A failed query wrote the name and note into the logs | The handler logs only the error name and a driver code. The logger treats `params`, `query` and `detail` as secret, cuts an error's message and stack at drizzle's "params:" marker, writes causes as `{type, code}` only, and Next's own `console.error` prints go through the same scrub (`src/lib/log/consoleScrub.ts`, loaded first in `register()`) |
| S4 | The neutral and repeat answers told a stranger that a number had booked or had an emergency | Rows and appended entries store an HMAC of the form session (never the session id). The neutral and repeat answers are judged by replaying the phone rules over this browser's own requests only; any other browser gets the normal success answer, and the request is still appended. Notification and counting run after the response (`after()`), so the timing does not show the class. This changes `docs/conversion.md` 5.2 and 7.3 |
| S5 | No budget for notifications; spike alerts per address | One spike alert per `errorDedupMinutes` window for all addresses, with the count of distinct addresses. Mail and Telegram take at most 20 booking and emergency notifications an hour each, regular bookings at most 15 of them, then one budget alert per channel and hour with the number held and since when. Per process (`shortcut:` comment) |
| S6 | Flagged emergencies ranked first | An open emergency flagged `emergency_ip_rate` ranks right after the clean open emergencies |
| S7 | Shared carrier addresses | Accepted, see below |
| S8 | The time token can be replayed for its lifetime | Accepted, see below |
| S10 | Appends over the 20-entry cap were lost silently | The row counts them in `appendsDropped` (read-only, shown when above zero) |
| S11 | Large bodies buffered before the 16 KiB check | `docs/deploy.md`: nginx `client_max_body_size 32k` by default, 64m only for uploads, `limit_req` on the four form paths; Next's `proxyClientMaxBodySize` stays at its default (one value for every path, a longer body is cut silently, admin save sizes are not measured yet) |
| S12 | QA-only settings accepted in production | The System status view shows red in production when `QA_ROUTES` or `FORM_SESSION_RATE_LIMIT` is set |
| R5 | The error-alert window was fixed at 60 minutes | It follows `notifier.errorDedupMinutes`, refreshed whenever the notifier reads the global |

The privacy page draft now names the browser code and the counted repeats.
`docs/conversion.md` 5.3 and 7.3 and `docs/deploy.md` 2.4 and 2.5 carry the
new rules.

### Accepted and residual risks of the security review

- S7, shared carrier addresses (low). After 10 requests in an hour from one
  address key (an IPv4 address or an IPv6 /64), later requests from it are
  stored «مشکوک» (no notification, rank 4). On carrier NAT one person can push
  real visitors there, and past 50 suspicious rows (S1) a real visitor on that
  key is not stored at all and still sees success. A higher limit would weaken
  the flood rules. Revisit if staff often restore real requests from «مشکوک»,
  or if `form_dropped` appears outside an attack.
- S8, the time token (low). One form-session request gives tokens valid for
  2 hours, and a renewed token is already 2 s old, so the 2 s trap stops naive
  bots only. The real limits are the per-address and per-phone rules, S1, the
  process cap and nginx `limit_req`.
- S2 while misconfigured (medium). With the proxy trust off or a broken chain
  in production, every visitor shares one key: about 9 forged posts a minute
  make every real request suspicious, then unstored. Guards: the red status
  row, one `form_ip_unknown` line per process, and the post-deploy check in
  `docs/deploy.md`.
- S11 remainder. An unauthenticated POST of up to 10 MB to `/admin` or any
  `/api/` path is buffered by Next's proxy before the route answers. Next step:
  log the body sizes of admin saves on staging, then lower both caps together.
  Without nginx (Liara), every POST path stays at 10 MB until the platform's
  limit is known.
- S4 residuals. A request over the 20-entry append cap leaves no browser mark,
  and a staff status change on the row that holds a prober's mark still changes
  its later answer; using either needs many verified requests from several
  address keys within minutes. Response timing is closer, not equal (a create
  and an append are different writes). `booking_success` slightly overcounts,
  because a stranger's repeat now shows success.
- S10 residual. A staff save writes `appendsDropped` back, so an increment made
  in the same milliseconds can be lost.
- Notifications and SMS. The spike map and the channel budgets live in one
  process. SMS (admin and patient) has no budget yet: an SMS budget is a
  prerequisite before SMS or the patient confirmation is switched on.
- Development output: the console scrub also removes the source-mapped error
  print in development.

## Verification

"Final run" below is the local run of 2026-10-18: e2e and screenshots on the
tree of `1576b29`; build, check:bundle and Lighthouse on `527971f`; unit and
static checks on `b5d5cf9`. It covers
lint, format, typecheck, knip, check-bidi, `npm test`, the PostgreSQL 16
integration suite on a freshly migrated database, the generated-file drift
check on both adapters, build, check-no-prerender, a fresh SQLite e2e
database with the QA fixture, the full e2e with `QA_SCREENSHOTS=phase-05`,
check:bundle and Lighthouse.

| What | How | Result |
|---|---|---|
| Static checks | Final run | Lint 0 problems; format, typecheck, knip and check-bidi clean. Pass |
| Unit, DOM and SQLite integration tests | `npm test` | 153 files, 2209 tests pass (phase 4: 1627). Pass |
| PostgreSQL integration | `npm run migrate` on a new PostgreSQL 16 database, then `test:int` with `INT_DATABASE_URL` | 18 files, 102 tests pass. Pass |
| Generated files | `generate:types`, `generate:importmap`, `migrate:create --skip-empty` on SQLite and PostgreSQL | Types reordered only (committed in `fe06292`); no migration written on either adapter. Pass |
| e2e | Full `npm run test:e2e` | 633 passed, 434 skipped (tests bound to one viewport or theme project), 2 failed: T-SS emergency hours states on both phone projects hit the 30 s test timeout under load (29 s alone). Fixed in `1576b29` (90 s, as the admin capture tests); both reruns pass. The forms subset (booking, home booking, dialog, emergency: 83 tests) passed again after `ebebe0d`. Pass |
| No prerendered public HTML | `npm run build`, `scripts/check-no-prerender.mjs` | Every public route is `ƒ`; only Next's own `/_global-error` is allowed. Pass |
| Acceptance: phone input | e2e T-BK4 (Persian digits with spaces; 10 digits without the leading zero), T-BK3 (a landline refused with its message, without JavaScript), T-BK2 (client messages); unit RQ, P and PH ids | Pass |
| Acceptance: honeypot and time token show success and land in «مشکوک» | e2e T-BK8; unit BH-HP, BH-FAST, BH-INVALID-TOKEN; integration BI-SUS | Pass |
| Acceptance: the fourth booking from one phone in a day is neutral; a duplicate within 10 minutes appends | e2e T-BK5 (the neutral state in the browser); unit BH-PHONE3, BH-DUP, BH-APPEND-CAP; integration BI-DUP (a real 24-hour window cannot run in e2e: the server keeps its own clock) | Pass |
| Acceptance: the booking page works without JavaScript; home card and block post to `/رزرو-نوبت`, which keeps the values and shows the unsent line; the second submit succeeds | e2e T-BK9, T-HB3, T-HB4 | Pass |
| Acceptance: the home HTML has no token, timestamp or hours sentence; two visitors of one cached home both book; the hero success has no layout shift | e2e T-HB5 (two contexts on one cached HTML), T-HB1 (the card does not move), T-HB6 (a submit before the token answer); unit BF ids | Pass |
| Acceptance: emergency order by hours, call button in the first screen at 360x640 during hours, triage on the server, no promised slot | e2e T-EM1, T-EM2, T-EM3, T-EM3b; unit EM-P4 (no slot is promised; «همان روز» only with «در صورت امکان») and the view test of the priority line, hidden until gap 19 is confirmed | Pass |
| Acceptance: financing hidden while disabled; the surcharge note on screen on phones when enabled | unit PR1, PR4; e2e T-PR2 (above the sticky bar at 390x844 with the QA-FIN fixture) | Pass |
| Acceptance: events fire once and never block navigation | e2e T-BK1, T-HB7, T-DLG4, T-EM7, T-EM9; unit TR and TL ids (`sendBeacon`, `keepalive`) | Pass |
| Acceptance: no phone number in logs; the request id is logged | unit BH-LOG, BH-LOG-DB, BH-500, AL1, RE4; integration AD3 (no phone, name or note in the audit log) | Pass |
| Acceptance: Lighthouse budgets on the booking and pricing pages | `npm run lhci`, numbers in Budgets | Pass locally in both themes after `527971f` (the service page was 25 bytes over the scripts gate before it); only the ungated home `?tier=1` warns. CI: see CI |
| Dialog | e2e T-DLG1 to T-DLG7 (keyboard, touch heading focus, prefill, one instance, the page behind stays put at three widths) | Pass |
| Admin workflow | e2e T-AD ids (tabs, status change, contact links, suspicious restore, bulk spam with the search kept, CSV for «مدیر» only, the dashboard widget); unit BK, BS, CL and CSV ids | Pass |
| axe, both themes | e2e T-A11Y on every template plus T-BK13, T-EM10 and the dialog states, with JavaScript and on the no-JS copy of the page | 0 violations. Pass |
| No sideways scroll from 320 px | e2e T-BK14, T-PR3, T-EM10 | Pass |
| Tests can fail | Every lane proved its key tests red (Independent review); after integration: BF14b (hidden fields after the last wait), TC6 without `md:px-0`, TC6b without the badge rule | Each went red, then green |
| Bundle budgets | `npm run check:bundle` | Every page class inside its interim limit; table in Budgets. Pass |
| cPanel package | `scripts/package-cpanel.mjs`, then the zip started under a stand-in for the panel's loader (the first http `listen()` goes to a unix socket, a second one throws), with only `SITE_URL`, `ALLOW_INDEXING` and `ALLOW_FIRST_USER` set and no forwarded headers | Health 200 with the release version, home, services, booking page and admin 200, `/vip` 301 from the redirects table (the internal listener works), unknown page 404, robots disallows all, a JSON booking stored, cron 200, secrets file 0600. The run found two defects first, fixed with failing tests CB6 and CB7 (`2e9d63c`, `2720848`). No local secret and no user row in the package. Not run on the real host yet |
| CI on GitHub | GitHub Actions | See CI |

## Budgets

Targets are `docs/brief.md` section 7. Initial JS from `check:bundle` on the
build of `527971f` (the code of `2720848` adds only the cPanel package, which
ships no browser code). Lighthouse from the local run on the same build:
host benchmarkIndex 1979, CPU 4x, HTTPS and HTTP/2, 5 runs per URL and
theme. LCP cells: median (min to max). TBT gate: the median at most
max(400 ms, the framework floor's median + 250 ms) per theme (`502f7ed`);
floor medians 127 ms light, 91 ms dark.

| Metric | Target | CI gate | Measured |
|---|---|---|---|
| Initial JS, home `/` | 180 KB | 215 KiB interim, route 85 KiB | 155.1 KiB: shared 143.4, route 11.8 |
| Initial JS, content pages | 90 KB | 150 KiB interim, route 15 KiB | 144.1 to 149.1 KiB: shared 143.4 (phase 4: 142.3), routes 0.8 to 5.7. Target missed: the framework floor is 131.8 KiB |
| Initial JS, booking `/رزرو-نوبت` and emergency `/اورژانس` | 70 KB | 150 KiB, route 20 KiB | 148.3 and 147.7 KiB (routes 5.0 and 4.3). Target missed: same floor |
| All scripts of a load (Lighthouse) | none | content 150 KiB; booking class 150 KiB plus 5 KiB for the dialog island that loads after `load` | service page 149.9 KiB (the closest; 25 bytes over before `527971f`), dentist 149.7, pricing 149.2, 404 149.1, booking 149.1, emergency 152.1 of 155 |
| CSS | 50 KB | 50 KiB | 13.6 KiB content, 14 KiB home |
| Fonts | 120 KB | 120 KiB | 90.1 KiB |
| LCP `/qa/not-found` | 2.5 s | best of 5 (error) | light 2268 ms (1812 to 2289); dark 1961 ms (1810 to 2315) |
| LCP service `/خدمات/ترمیم-دندان` | 2.5 s | best of 5 (error) | light 2113 ms (2109 to 2411); dark 2181 ms (2112 to 2191) |
| LCP dentist (fixture) | 2.5 s | best of 5 (error) | light 2271 ms (2114 to 2495); dark 2259 ms (2117 to 2273) |
| LCP pricing `/هزینه-و-پرداخت` | 2.5 s | best of 5 (error) | light 2265 ms (2111 to 2455); dark 2420 ms (2111 to 2584, 1 run over) |
| LCP booking `/رزرو-نوبت` | 2.5 s | best of 5 (error) | light 1815 ms (1811 to 2268); dark 1965 ms (1813 to 2279) |
| LCP emergency `/اورژانس` | 2.5 s | best of 5 (error) | light 2268 ms (1966 to 2430); dark 2111 ms (1964 to 2462) |
| LCP home `?tier=0` | 2.5 s | best of 5 (error) | light 2336 ms (2038 to 2648, 2 over); dark 2635 ms (2340 to 2645, 4 over): the gate passes, the dark median misses the target |
| LCP home `?tier=1` | 2.5 s | median (warn) | light 2637 ms, dark 2637 ms: the warn fails in both themes (phase 7) |
| TBT (stands in for INP), content, booking and emergency | 200 ms | floor-relative, 400 ms here | medians 48 to 149 ms in both themes; booking 123 and 130 ms, pricing 87 and 109 ms |
| TBT home `?tier=0` | 200 ms | floor-relative | 89 ms light, 82 ms dark |
| TBT home `?tier=1` | 200 ms | none | 433 ms light, 481 ms dark |
| Lighthouse performance | 95 content, 90 home | 0.95 (warn) | content, booking, emergency, pricing 0.97 to 0.98; home `?tier=0` 0.97 and 0.96; `?tier=1` 0.86 and 0.87 |
| CLS | 0.05 | 0.05 (error) | under 0.05 on every asserted URL; e2e T-BK12 and T-HB1 assert no shift when the session answers and on success |
| Third-party requests | none | 0 (error) | 0 (GA4 off) |

The booking and emergency pages meet their Lighthouse budgets (prompt
acceptance). The scripts gate on the content pages has about 100 bytes of
headroom on the service page: the next client feature on those pages needs
a cut first (Risks).

## Screenshots and recordings

`docs/qa/phase-05/`: 266 PNGs named `<template>-<width>-<theme>.png`. They
cover the conversion templates in every state the e2e suite can reach: the
booking page (plain, with a service, and its error, unsent, neutral,
expired, network and server states), the success page, the dialog (open,
error, success), the home hero success, the emergency page (open, closed,
and at phone width before opening, on a holiday and the 360x640 first
screen; the avulsion first aid, the error, the success and the repeat
message), pricing, privacy, restoration with a tier chosen, and the admin
bookings list, a booking record and the dashboard. The phase 4 templates
are taken again. Widths 390, 820 and 1440 px, light and dark. `npm run
test:e2e` with `QA_SCREENSHOTS=phase-05` writes them on the e2e database
with the QA fixture. No recordings: phase 5 has no scenes.

## Independent review

### Lane reviews (build, review, fix)

Each of the five lanes was built, then read by a separate reviewer who did
not write it, then fixed in a separate pass. Every behaviour fix has a test
that failed first: a new test red before the fix, or an existing test turned
red by breaking the code on purpose and restoring it byte for byte.
Reviewers ran the unit, DOM and SQLite integration suites and their own
probe scripts; none ran e2e or a build. Severity: blocker, major, minor.

| Lane | Findings | Key findings and outcome | Declined or handed on |
|---|---|---|---|
| PIPELINE | 20 (0, 4, 16) | Two abuse paths reproduced with probes: 40 parallel posts from one address made 40 `new` rows (requests from one address key now run one at a time, the IP lock before the phone lock; BH-IP-RACE), and 200 repeats grew one row without bound (appends count toward the hourly address limit, at most 20 per row; BH-APPEND-CAP). The spike alert fired only on an exact count (BH-IP-JUMP); a new emergency was appended to a closed row (open rows only; BH-OPEN, BI-CLOSED). Minors: the phone checks of BH-LOG could not fail because the logger masks phones (the tests now read the raw objects); NUL characters gave a 500 on PostgreSQL (RQ18); a failed hours read lost the request (BH-HOURS-FAIL); the error line ran on every retry (NT12). 19 fixed | Finding 18, the neutral answer tells a stranger that a number booked: recorded, then fixed as S4 |
| PAGES5 | 21 (0, 8, 13) | Five e2e tests would fail as written: strict-mode multiple matches, a click caught by the card label's overlay, a colour read during a 200 ms transition, a percent-encoded href. `knip` was red in CI on an unused type. The privacy draft left out the encrypted no-JS cookie and the «مدیر» CSV export (PRV2, PRV4). Minors: amount words outside i18n, the analytics doc wrong on no-JS counting, a lead that promised payment terms (PR6). 15 fixed | 5 handed to the integrator: a dentist-page attribute, three deviations to record, the «not sold» line as a client question. Rejected: a pricing title built in code would override the admin's SEO title |
| BOOKING-UI | 19 (0, 5, 14) | The dialog's Tab trap counted an inert, invisible success link, so Tab left the modal (CB14); a scroll-lock assertion could never fail; a press on «ثبت درخواست» with an over-long note moved the button and lost the submit (BF4c); a client navigation that removed the open dialog left the page locked (CB15); the dialog on the 404 page would break the branded 404 during a database outage (it now renders nothing; BV2). 15 fixed, 2 in part | `/رزرو-نوبت` stays indexable (spec 3.1, `docs/ia.md`). e2e cannot make a fourth request in a day or a real 419 (the server's own clock and the token lifetime); BH-PHONE3 and the T-BK6 renewal check cover them. The duplicate prefill went to its owner |
| EMERGENCY-UI | 13 (3, 3, 7) | Blockers: the page did not mount the booking dialog, so the header CTA left the page (T-EM11); a call-link count failed at 390 px on the header icon; the lane's i18n line, an integration step (54 type errors until applied). Majors: page-wide label locators would collide with the dialog's form; the no-JS success heading took no focus, about 900 px down on phones (EF13); clicks before hydration. 11 fixed; a latent bug found on the way (`event.currentTarget` read inside a state updater) | Client copy question: with the form off, the closed lead still asks for a number |
| ADMIN | 19 (1, 3, 15) | Blocker: in «انتخاب همه» mode the bulk «علامت هرزنامه» dropped the list search, so a search for one number marked every booking in the database as spam (the search is merged as Payload's own bulk edit does, plus a confirmation with the count; BS2). Majors: no visible keyboard focus on tabs, dashboard figures and contact links (Payload's `a:focus{outline:none}`); the CSV export downloaded even when its audit row failed (now 500 and no file; CSV4); the monthly «فوری نبود» share was missing (DW5). All 19 fixed; seven earlier tests that had never been proven red were proven | e2e T-BA8 (an unverified sign-in hits the sign-in limit) and the widget's event figures stay out |

Totals: 92 findings (4 blocker, 23 major, 65 minor). The lane fix passes
were not reviewed a second time; the full e2e suite, the security review
and the screenshot inspection below cover them.

### Security review of the pipeline (prompt step 4)

A reviewer who had not built the pipeline read it for spam, abuse and data
exposure, ran the 146 unit tests of the form path and reproduced the log
leak (S3) with a script. Its 12 findings and their decisions are in the
security table under Decisions (S1 to S12, R5). Three fix lanes took them,
and a second, adversarial reviewer then read each fix lane and wrote probe
tests against it; the lane fixed again. The result is in `d359a74`.

| Fix lane | Findings it took | Second review | Outcome |
|---|---|---|---|
| Handler | 1, 2 (the rules), 3 (the handler log), 4, 6, 9, 10 | 8 (1 blocker, 1 major, 6 minor) | Blocker: a prober's answers still differed with and without a victim's earlier request. The answer now replays the phone rules over this browser's own marks only (BH-ORACLE, BI-ORACLE); the reviewer's simpler count rule would have changed BH-PHONE3 and BH-OPEN. Major: past 50 suspicious rows on a key, a real patient's valid request is not stored; kept and accepted under S7, because the alternative let one address store about 10 800 suspicious rows an hour. Minors: the process cap runs after the origin check (BH-PROCESS-CAP); a refused no-JS post gets a 303 with the server message instead of an empty 503, with one `form_busy` line per window (BH-BUSY); logs name the error class. The privacy copy and the origin lock-down in `docs/deploy.md` went to the integrator; the lost-increment race is the S10 residual. 31 deliberate breaks, all red |
| Log and notify | 3 (the logger), 5, R5 | 8 (0, 1, 7) | Major: Next prints an uncaught server error with `console.error` before `onRequestError`, outside the logger. `consoleScrub.ts` now loads first in `register()`; a probe on Next's own production logger with a real `DrizzleQueryError` shows no value. Minors: the root cause is kept as `{type, code}` and the stack keeps its frames; `detail` and format arguments are scrubbed; the budget alert carries `since` and no longer promises a later alert; deduplicated spikes take a fast path with no database read. The regular-booking flood that could use up the emergencies' budget went to the studio, which chose 15 of the 20 slots (S5). 29 mutations, all red |
| Ops | 2 (the status view), 11, 12, the S7 and S8 text | 9 (0, 2, 7) | Majors: the body caps in `docs/deploy.md` were reversed (now 32k by default and on the form, events and CSP paths, 10m only for `/admin` and `/api/`, 64m for media); the S2 risk was understated (the status copy names the consequence, plus `docs/deploy.md` 2.4 and the post-deploy check). Minors: the trust row turns red when the admin's own request has no readable address (SS10, SD1); nginx header inheritance, IPv6 /64 keys and `error_page 429` documented. 6 breaks, all red; the nginx snippets are untested |

Totals of the second review: 25 findings (1 blocker, 4 major, 20 minor),
all fixed or decided. Not verified by any reviewer: the real
`X-Forwarded-For` hops on the production host, which S2 and S11 depend on.

### Integration (e2e)

The full e2e run also found an integration bug that no lane test covered.
T-HB6: a submit pressed before the form-session answer set the hidden
fields (source URL, UTM, csrf, ts) and then waited. The token answer
re-rendered the island (`callsAllowed`), and React resets an uncontrolled
hidden input to its `defaultValue`, so the POST went out without tokens and
got 419. It showed only while the clinic was open, so the home hero test
failed by time of day. Fixed in `ebebe0d`: the island writes those fields
right before the POST, and a renewal after a 419 takes the ts it sent.
BF14b was red before the fix.

### Screenshot inspection (prompt step 5)

The first set has 266 screenshots (390, 820 and 1440 px in both themes;
the emergency first screen also at 360 px), cut into 986 viewport-sized
slices. Eight inspection groups read the 608 slices that show phase 5
work: booking, dialog and hero success states (two groups), emergency
states (two), pricing, privacy and the 404 template, home, admin and the
tier choice, and the booking blocks of the content pages. The other 378
slices show phase 4 templates outside those surfaces (hubs, error pages,
the component gallery, admin login, the upper parts of content pages) and
were not read again. A verifier opened each cited slice and the code it
named: 48 findings confirmed (4 major, 22 minor, 22 nit) and 8 refuted, for
example the breadcrumb chevron (it points toward the current page, correct
in RTL) and the dialog over the 404 page (the test opens it there on
purpose).

The studio decided each finding before any fix. Three fix lanes (public
forms, mask and admin, content UI) worked from those decisions, each fix
with a test that failed first, except four CSS-only admin changes (17,
18, 20, 46) that the second set checks. Fix commits: `efb975c` (mask),
`fe06292` (admin), `bd1c354` (forms), `e57edff` (content).

| # | Severity | Defect | Outcome |
|---|---|---|---|
| 1 | major | Admin masked phone read in reverse group order and wrapped in the list | Fixed (mask): an LTR isolate with no-break spaces in the title, breadcrumb and notifications; the CSV drops bidi controls before its formula guard (BK11, NT3, CSV1) |
| 2 | major | A notice rendered after a no-JS post sat below the first screen, unfocused | Fixed (forms): it takes focus and scrolls into view on load, with and without JS (BF20) |
| 3 | major | Admin record on phone and tablet: contact and status after about 20 fields | Fixed (admin): contact, status and callback due open the main column at every width (BK12) |
| 4 | major | Dialog success kept the form's height | Fixed (forms): the dialog form is hidden after success (BF23) |
| 5 | minor | Emergency success shows the safety box twice | Recorded: required by `docs/conversion.md` 7.3 |
| 6 | minor | Clinic number inside notices was plain text | Fixed (forms): a tracked `tel:` link in an LTR island (BV6, T-EM19) |
| 7 | minor | Neutral state keeps the filled form and a live submit | Recorded: `docs/conversion.md` 5.2 keeps the values on purpose |
| 8 | minor | Over-limit note counter stayed grey | Fixed (forms): danger colour above 500 (BF21, EF14) |
| 9 | minor | Standalone links looked under 44 px on phones | Skipped: the computed boxes are 44 px; the estimate measured the text; «اورژانس ۱۱۵» is inline and exempt |
| 10 | minor | Hours label and value 650 to 770 px apart at 820 | Fixed (content): the hours list is capped at 28rem (UH6) |
| 11 | minor | Content-page booking block at 820 unlike the service pages | Fixed (content): the same grid, map beside address and hours (PB1, PB2) |
| 12 | minor | Booking success card off-centre | Fixed (forms): centred (BV7) |
| 13 | minor | Dark warm surface reads muddy | Recorded: a token decision; phase 7 reviews the dark palette |
| 14 | minor | Dark safety box was grey | Fixed (forms): a warm dark warning surface, ink 9.45:1, border 3.73:1 (T-EM5c) |
| 15 | minor | Admin pagination chevrons not mirrored | Fixed (admin): an RTL rule in `custom.scss` |
| 16 | minor | Admin used red for urgency | Fixed (admin): the warning pill and tokens (CL2) |
| 17 | minor | Admin contact links stacked, rows 117 px tall | Fixed (admin): one row of 44 px buttons |
| 18 | minor | Admin tab strip clipped at 390 | Fixed (admin): the tabs wrap |
| 19 | minor | Admin column order hid the callback due | In part (admin): callback due before group (BK9); no column dropped: «کار سریع» holds the restore action and «گروه» is set by real bookings |
| 20 | minor | Full number flush left under its label | Fixed (admin): aligned to the start edge |
| 21 | minor | Tier card cut at 820; the chosen card off-screen at 390 | In part (content): three columns from 744 px (TC6); no scroll on load, because nothing checks a tier on load (F24) |
| 22 | minor | Chosen tier not shown in the booking summary | Recorded: the hidden field carries it; a visible echo is next phase |
| 23 | minor | Tier radios native and 13 px, grey in dark | Fixed (content): a drawn 20 px radio (TC7) |
| 24 | minor | Avulsion first aid in plain body text | Fixed (forms): the warning box with an icon, never red (T-EM16b) |
| 25 | minor | Footer © pinned to the end edge | Recorded: phase 4 decision (`docs/ia.md` section 3) |
| 26 | minor | Empty band in the compact success view | Fixed (forms): the reserve removed, content at the top (BF24) |
| 27 | nit | 64 px under the form card's last element | Recorded: the reserved call line prevents a layout shift (T-BK12) |
| 28 | nit | Textarea resize grip | Recorded: native control |
| 29 | nit | Dialog error at 1440: submit 8 px from the bottom edge | Fixed (forms): a sticky fade band that passes clicks through (BV8) |
| 30 | nit | Focus ring hid the red border of an invalid field | Fixed (forms): the ring is danger-coloured on invalid fields (UF2b, BF22, EF15) |
| 31 | nit | 390 bottom sheet fills the screen | Recorded: freeze G7 (100dvh) |
| 32 | nit | Dark emergency checkboxes grey and native | Fixed (forms): drawn in the brand colour (EF16) |
| 33 | nit | Open state never says the clinic is open | Recorded: client copy |
| 34 | nit | Emergency form used two content widths | Fixed (forms): one measure (EF17) |
| 35 | nit | Safety heading wrapped at half width | Fixed (forms): `text-pretty` (T-EM5c) |
| 36 | nit | Mask «•••» reads as Persian zeros | Fixed (mask): «***» everywhere (P34, H27, PH3) |
| 37 | nit | A lone financing card orphaned | Fixed (content): it spans the row with two-column terms (PR8) |
| 38 | nit | «درد شدید دارید؟» teal in forms, amber elsewhere | Recorded: inside a form it is a help-text link and takes the link colour; the amber belongs to the chrome's emergency items. Phase 7 reviews the colour roles |
| 39 | nit | Home group icons dim in dark | Recorded: phase 4 |
| 40 | nit | Diagonal pattern inside white cards | Skipped: no such pattern in the CSS; a pixel probe (252 against 255, the same count as in phase 4) points to a rasterization artefact of the tall capture |
| 41 | nit | First trust-strip item has no second line | Recorded: content |
| 42 | nit | English gloss «(characterization)» in public copy | Fixed (content): removed; SC3 now refuses Latin text in brackets |
| 43 | nit | Consent caption leaves «است.» alone | Fixed (content): `text-pretty` on all three captions (CM5) |
| 44 | nit | Empty «درخواست‌های تکراری» and «کمپین» sections | In part (admin): one empty line inside the duplicates block (BK13, DE1); «کمپین» is a capture artefact (Payload renders group fields only once scrolled into view) |
| 45 | nit | «زمان پیگیری» cut at 1440 | Recorded: capture artefact |
| 46 | nit | Dashboard widget 6 px wider than the cards | Fixed (admin): matches Payload's 6 px widget padding |
| 47 | nit | On phones the footer repeats the block's address and hours | Recorded: the footer carries the clinic's address and hours on every page (phase 4, `docs/ia.md` section 3) |
| 48 | nit | Captures drew the sticky header mid-page, the hidden call bar and hover tints | Fixed in the capture helper (`1ea0713`, `9e8e7e7`) |

Outcome: 29 fixed, 3 in part, 14 recorded, 2 not reproduced in code.

A separate reviewer read each fix lane against its diff, the decisions and
the cited slices, re-ran the checks and recomputed the contrast figures. 10
issues (2 blocking, 3 major, 5 minor):

- Forms. Major: the sticky fade band of 29 took clicks and hid a focused
  control at the bottom edge; it now passes clicks through and the dialog
  keeps focus clear of it with scroll padding (BV8, red first). Blocking,
  across lanes: the client copy of the mask in `phoneInput.ts` still drew
  «•••» and three tests stayed red; changed (PH3, BF6b, BF13). Minor, not
  changed: the drawn checkbox uses a 4 px radius outside the radius tokens.
- Mask and admin. Major: the empty-duplicates line, as a field of its own,
  touched the next field's label; it now sits inside the array block as its
  `afterInput` (BK13, red first). Major: no test pinned the bidi strip before
  the CSV formula guard, so swapping the two would let a bare `=` formula
  through; CSV1 now covers it and went red with the order swapped (the code
  was already right). Minor: a stale doc comment, fixed.
- Content. Blocking: the CIP gloss lives in `docs/content/services.yaml`,
  outside the lane, so SC3 stayed red until the integrator applied it.
  Minors: TC6 now asserts `md:px-0`. Left as they are: the «انتخاب شما»
  badge wraps onto two lines between 744 and about 800 px (measured from
  the 820 capture; the screenshots cover 820 only), PB1 checks the column's
  class but not its two children, and TC7 does not assert the checked ring
  width.

The integrator applied the cross-lane requests: the CIP gloss removed from
`docs/content/services.yaml`, the empty-duplicates string in
`src/i18n/fa-admin.ts`, the RTL pagination chevrons in
`src/app/(payload)/custom.scss` (`scale: -1 1`, which composes with
Payload's rotate), the mask in `docs/conversion.md`, the regenerated types
(field order only; `migrate:create` wrote nothing on either adapter), and
the dark warning surface on warning alerts too, so the self-care callouts
match the safety box. Recorded, not changed: at 820 px home's booking block
still stacks the map above the address and hours, because decision 11
named only the content pages. Booking rows saved before `efb975c` keep
their bullet-mask title until their next save.

Confirmation pass. The second set (266 captures, 976 slices) was read once
by nine inspection groups (the eight of the first pass plus the
restoration page and the component gallery), 872 slices in all, each fix
checked against its first-set slice. Result: 56 fix checks confirmed. 30
open items went to an adversarial verifier, which refuted 21 (capture
artefacts, decisions already recorded, duplicates) and confirmed 9:

| Item | Severity | Outcome |
|---|---|---|
| Pricing: a one-line financing term sat level with the gap of its two-line neighbour (from fix 37) | nit | Fixed in `b5d5cf9` (PR8) |
| Forms gallery: the shared text area counter stayed grey over the limit (fix 8 reached only the islands) | nit | Fixed in `b5d5cf9` (UF5b) |
| Admin record: the callback due showed Payload's default date format, the Persian month cut by a tatweel | minor | Fixed in `b5d5cf9` (BK12) |
| Admin list at 820 px: the one-row contact buttons pushed the callback due column past the edge (from fix 17) | minor | Fixed in `b5d5cf9` (the buttons wrap); not re-captured |
| Admin record at 390 px: the contact block's rem cap narrower than the fields (Payload's 12 px root) | nit | Fixed in `b5d5cf9` (the cap from 1024 px); not re-captured |
| Booking notices: the call fallback line repeats the number that the network, server and neutral notices already link | minor | Recorded: the change sits in the booking island, and the content scripts gate has about 100 bytes of headroom; next change to the island |
| Capture harness: the visible sticky bar still covers the seam between slices at 390 and 820 (the fix of 48 hid only the hidden bar) | nit | Recorded: harness, not product; next phase's captures |
| Capture harness: template and booking captures run on the real clock, so the hours state differs between widths of one run | nit | Recorded: harness; pin the clock for every capture |
| Capture harness: a booking capture can run before the session answer adds the call line | nit | Recorded: harness; wait for the session answer before capturing |

Not re-checked by a third set: the five fixes of `b5d5cf9` (unit tests
only). The prompt's step 5 ends here: inspect, fix in one batch, confirm,
stop.

## Content gaps added or closed

- Added rows 54 to 57 in `docs/content/gaps.md`: 54 the privacy page line
  that booking data is never sold or given to advertisers, and the draft
  copy of the privacy and pricing pages; 55 where staff notifications go
  (the clinic mailbox and the Telegram chat); 56 the SMS account, sender
  line and monthly budget; 57 the emergency page draft copy.
- Updated: none.
- Closed: none. Still open and tied to this phase: rows 12 (GA4 id), 16
  (WhatsApp number: the financing cards show no WhatsApp CTA until it is
  confirmed), 19 (the emergency priority promise stays hidden), 31 (a
  24-hour center to name when closed), 40 (holidays; the QA fixture adds
  one far date only), 42 (medical reviewer), 43 (retention), 50, 51
  (insurer wording), 54 to 57.

## Risks and open questions

Questions for the client (in plain words):

1. When the clinic opens, can reception call urgent requests first (gap
   19)? Until you confirm, the emergency page makes no priority promise.
2. Which 24-hour dental center or hospital should the emergency page name
   for nights and holidays (gap 31)?
3. May the privacy page say «آن را به کسی نمی‌فروشیم و برای تبلیغات به کسی
   نمی‌دهیم» (gap 54)? How long should booking requests be kept (gap 43)?
4. Please read the emergency page copy (gap 57) and the pricing and privacy
   drafts (gap 54).
5. Which mailbox and which Telegram chat should receive booking alerts
   (gap 55)? Do you want SMS, and what monthly budget (gap 56)?
6. The phase 4 questions on the insurers (gap 51), the WhatsApp number
   (gap 16) and the reviewer dentist (gap 42) are still open.

Hand-off requests (phase prompt): test the booking flow on your own phone
(home card, home block, booking page, the dialog on the pricing page, and
the emergency page), and confirm the emergency copy, the financing texts
and the insurer names. Staging is needed for the phone test: it waits on
the hosting decision.

Engineering risks:

- The accepted security residuals: see "Accepted and residual risks of the
  security review" above (S7, S8, S2 while misconfigured, S11, S4, S10,
  notification budgets per process, no SMS budget yet).
- The production proxy chain is not verified: S2 depends on the real
  `X-Forwarded-For` hops, and the cPanel host has no nginx, so Next's 10 MB
  body cap is the only one (S11, `docs/deploy.md` 3.6). The first release
  checks the status view (section 4 step 18).
- Script budgets: the booking class is 148.3 KiB of initial JS against a
  70 KB target, and the framework floor alone is 131.8 KiB. The content
  scripts gate has about 100 bytes of headroom on the service page
  (149.9 of 150 KiB): the next feature on the content pages needs a cut
  first, or a recorded studio decision on the interim limit.
- Hosting: the clinic bought a shared cPanel host (`docs/deploy.md` 1.2,
  section 3). Not verified until the first release on it: the Node versions
  it offers (22.18 or newer is required), its glibc (the sharp and libsql
  binaries), whether its web server passes `X-Forwarded-For` (else every
  visitor shares one rate-limit key, S2, shown red in «وضعیت سیستم»), its
  memory limit, and how it treats an idle app. The database is SQLite in
  `~/sefid-data`, so backups are a weekly download of that folder.
- Telegram from a host in Iran may be filtered; the mail driver and the
  admin list are the fallback (gap 55).
- Old booking rows keep the bullet-mask title until their next save; there
  are no production rows yet.
- e2e runs in Chromium only; the dialog, `:has()` reveals and the drawn
  checkboxes are checked by hand in Safari and Firefox in phase 9.
- A unit test (`SI1`, site inputs) timed out once while the full e2e suite
  loaded the machine and passed on the rerun; it imports its module
  dynamically. Watch it in CI.

## Prerequisites for the next phase

Phase 6 (content and SEO) can start: the article and guide collections,
the publish copy checks, the slug-change redirect and the sitemaps exist
from phases 3 and 4. It needs from the client: the reviewer dentist (gap
42) before any medical page can be published, and the old site's URL list
for the redirect import. A backup of the old site exists but its host
refuses connections from outside Iran; the client is asked to share it
through Google Drive. The first release on the new host (`docs/deploy.md`
section 4) runs in parallel and needs nothing from phase 6.

## CI

Run 38836148263 on `502f7ed` (the pricing and privacy pages and the new
TBT gate; the booking, emergency and admin work was not pushed yet) passed
both jobs. Runner: benchmarkIndex 3891, load 0.93 after a 70 s wait. The
TBT gate compares each URL with the framework floor of the same run
(`/qa/floor`, an empty page in the same layout): floor medians 136 ms light
(85 to 212) and 155 ms dark (91 to 195), so the gate was 400 ms light and
405 ms dark.

| URL | TBT median light, dark | LCP best of 5 light, dark |
|---|---|---|
| `/qa/not-found` | 195, 182 ms | 1975, 1816 ms |
| `/خدمات/ترمیم-دندان` | 145, 196 ms | 2131, 2045 ms |
| dentist (fixture) | 142, 149 ms | 1900, 1969 ms |
| `/هزینه-و-پرداخت` | 128, 132 ms | 2112, 2042 ms |
| home `?tier=0` | 115, 157 ms | 2044, 2195 ms |
| home `?tier=1` (no TBT gate) | 448, 523 ms | median 2564 ms (warn), 2347 ms |

Run 34 (39166734718) on `6ba2864`, which carries all of phase 5 and the
phase 6 plan, passed both jobs: lint, format, types, knip, bidi, coverage,
test:tz, SQLite integration and the audit; then the generated-file drift
check on both adapters, the PostgreSQL 16 integration suite, migrate and
seed, the build, check-no-prerender, the full e2e suite on PostgreSQL,
check:bundle and Lighthouse in both themes (the floor-relative TBT gate
included). Run 33 on `178b7f9` had passed every step through e2e and
check:bundle before the next push cancelled it at Lighthouse; runs 31 and 32
were cancelled the same way.
