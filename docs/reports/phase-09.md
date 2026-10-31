# Phase 09 - Quality Gate and Operations

Date: 2026-10-29 to 2026-10-30. Commits `456c289` (base) to `6f3546e` (waves 1 and 2 merged), then
the gate series. Versions: Next.js 16.4.3, Payload 3.92.0, React 19.3.0, TypeScript 5.9.3,
Vitest 5.0.4, Playwright 1.64.0 (Chromium 156 in CI, 141 here), `@axe-core/playwright` 4.13.0,
Lighthouse 12.6.1 through LHCI 0.15.1, Node 22.

## Plan (written before building)

`docs/prompts/09-quality-gate.md`, run as three waves of parallel lanes on one host, each lane in
its own worktree, heavy commands through one lock and one timing lane per wave:

1. Wave 1: SURFACE (the launch-shaped public surface), PINS (phase 7 F2, F3, F5), OPS (backups,
   restore drill, alerts), SEC (security audit), COPY (dentist review of what ships), XB-CI
   (WebKit and Firefox in CI, PostgreSQL 18).
2. Wave 2: JURY (independent review), A11Y, SEO-RTL (crawl, RTL, dark), PERF, XB-FIX (engine
   fixes), ADMIN-GUIDE.
3. Wave 3: GATE: merge, re-run everything once, fix the jury rows no lane closed (3 h), reconcile
   the gaps, close phase 6, this report and the go table.

Owner decisions taken before the build: 1(a) launch without a published dentist (the dentists,
guides and articles hubs show their empty states); 2(b) a weekly `age`-encrypted off-site copy
until a bucket exists, plus the provider snapshot; 3(a) CSS-reserved pin geometry for desktop.

Risks named then: the WebKit and Firefox results come from CI only (no local engine); every live
or preview check runs from GitHub Actions (no route from this host); the frame budgets sit at
their edge on the 4-CPU host.

## Delivered

- Audits: `docs/qa/audit-accessibility.md`, `audit-performance.md`, `audit-seo.md`,
  `audit-security.md`, `audit-rtl-copy.md`; screenshots in `docs/qa/phase-09/`.
- Launch surface: no link to a page that is empty or missing at launch (chrome, hubs, the cases
  links of the gate series); empty hubs noindex and out of the sitemap; the live preview tab
  removed; `npm run db:live` (the launch-shaped database) and `tests/e2e/live-shape.spec.ts`.
- Pins (phase 7 F2, F3, F5): pinned geometry in CSS under `html[data-pins]`, written before the
  first paint.
- Operations: the restore drill `restore-check`, the weekly off-site copy `offsite-backup`
  (`age` to the owner's key), `sefid-status --check` with the result of every backup, the
  workflow «Watch» (hourly health and server checks that open one `incident` issue), the
  secrets masked in the public «Server» log, the jobs with server secrets in the environment
  `server` (`docs/deploy.md` 3.6, 6).
- Crawl `scripts/crawl.mjs` and the old-URL workflow «Old URLs»; own descriptions for ten pages.
- Engines: WebKit through an HTTPS front, WebGL forced in headless Firefox, CDP-only tests gated
  with a reason.
- The receptionist admin guide `docs/admin-guide.fa.md` with its screenshots.
- Jury fixes: top 10 rows 1 to 5 and 7 to 10, and in the gate series note 4 and the cases links
  (SEO-RTL R2); the TOTP setup line (ADMIN-GUIDE AG-F3).

## Decisions and deviations (what, why)

| What | Why |
|---|---|
| The «جای عکس» captions show on the client preview only (`a360aa7`; reverses D33 for the live site) | a patient reads a placeholder caption as «nothing to show» (jury row 2). Needs the owner's yes: go table. |
| Jury row 6 (the pricing page has no price) declined in code | prices are the client's (gap 14), and renaming the page, its H1 and nav item is a copy and IA choice for the client: asked in the go request |
| Jury note 1 (blank band under the phone booking success) declined | the card keeps its height on purpose (BF24): the success arrives after the network answer, often more than 500 ms after the tap, so a shrinking card would count as layout shift. The band already holds the next steps (what to bring, address, directions, call). |
| Jury note 2 (the emergency success repeats the safety box) declined | `docs/conversion.md` 7 asks for the box again on success (T-EM18): a patient who just submitted still needs the red flags; shortening it is a medical copy change for the reviewing dentist |
| Jury note 5 («سایر» alone on the second chip row at 1440 px) declined | a wrap of the last chip at one width; a fixed 4-column grid would squeeze the long «معاینه و مشاورهٔ رایگان» chip, and moving «سایر» first breaks the order of the list |
| Jury note 4 (two titles on the booking page): the card's «درخواست نوبت» stays as the form's name for screen readers only on that page | the H1 «رزرو نوبت» sits right above it; the dialog and the home blocks keep the visible title |
| `ci:local` ran its steps one by one with Playwright at one worker; Lighthouse ran after it under the measurement lock | host rule: one worker per lane, timing only in the exclusive window |
| Visual regression golden set (deliverable 8) not created | plan section 8: after phase 8 settles home |
| Anonymization of old bookings (deliverable 7) not built | no retention period exists (gap 43); a job without one would delete on a guess |

## Verification (what, how, result)

The criterion, evidence and status table of plan section 6. «Pending» names who must act.

| Criterion | Evidence | Status |
|---|---|---|
| Zero axe violations | `docs/qa/audit-accessibility.md`: 0 violations and 0 unjudged «incomplete» in the six matrix projects (390, 820, 1440 px, light and dark), every public template and home at tiers 0 to 3; re-run in the gate's `ci:local` (`tests/e2e/a11y.spec.ts`, 1266 passed, 0 failed, 972 skipped by their project gates; one worker, 1.3 h) | met |
| No open blocker in the manual pass | jury top 10: rows 1 to 5 and 7 to 10 fixed, row 6 declined (needs the client); lower notes 4 and the cases links fixed, 1, 2 and 5 declined with reasons (above); A11Y: 12 findings fixed, 4 justified | met |
| Every budget row has evidence and meets its gate | gate re-run: `npm run lhci` exit 0 in both themes (every LCP, CLS, TBT and category assertion holds); `check:bundle` exit 0 in `ci:local`; `measure-home` exit 0: every phase 7 frame row at 4x on the default GPU, tiers 1 and 2, passes; typing INP worst 96 ms. Brief 7 table: `docs/qa/audit-performance.md` 1. Every CI gate passes. Intermittent rows from the PERF run, not seen in the gate run: services frames at desktop tier 2 and FAQ at tier 1 at pace 16 (single dropped frames, no long task), and one typing INP entry near 1 s at desktop tiers 1 and 2 (no cause found; the FAQ pace-16 lane was not re-run). Documented targets missed with the gate met: initial JS on content, booking and emergency (framework floor), booking and emergency LCP 2.0 s | met; 3 intermittent rows stay on the watch list (section 8) |
| The crawl exits 0 | `node scripts/crawl.mjs` on the gate build: on `db:live`, 32 pages, 0 problems, 14 warnings (titles under 50 code points), exit 0; on the QA database (`--qa`), 56 pages, 0 problems (R2 is fixed by the gate series; it was the one problem). Both on the gate series build | met |
| Home content complete without JavaScript | the crawl's home rule (every section's heading in the server HTML) and the no-JS e2e checks | met |
| Zero high or critical security findings | `docs/qa/audit-security.md` 10: none; three medium (SEC-1, SEC-2, SEC-7) have their code fixes merged (`a64563c`, `794d56f`, `0448fe4`) and wait for owner steps in GitHub settings (11) | met; owner steps pending |
| Public CSP has no `unsafe-*`; the admin style exception is justified | `audit-security.md` 1: T-HD1, T-HD3 (public), T-HD8 (admin scripts strict); admin `style-src 'unsafe-inline'` accepted with its reason | met |
| E2E green in Chromium | CI run 95 (Chromium jobs green on `6f3546e`); the gate's local run 1266 passed, 0 failed, 972 skipped by their project gates; one worker, 1.3 h | met |
| E2E green in WebKit and Firefox | CI job `engines` on `6f3546e`: still red (before XB-FIX: 56 WebKit and 46 Firefox failures, run 87, `p9/findings/xb.md`). The XB2 series (`5912d19` to `6f96e98`) landed after the gate run and was not run here (no WebKit or Firefox on this host) | **not met yet**: the integrator confirms one green `engines` run |
| Backup restored once on a fresh database: `vps-smoke` | the restore drill and the off-site copy run on the runner in `vps-smoke` (`docs/deploy.md` 3.8), including a tampered run that must fail | pending: the integrator reads the `vps-smoke` result of the gate commit |
| Backup restored once on a fresh database: `restore-check` on the server | `docs/deploy.md` 6.1 table: not run yet | **pending**: owner OK, then the integrator runs the action `restore-check` and records the row |
| No `NEEDS_CLIENT` or demo text on `db:live` | the crawl's text rule on `db:live`: 0 problems on 32 pages (the rule bans `NEEDS_CLIENT`, «فرضی», «طرح نمایشی» and «نمونهٔ آزمایشی» in the HTML) | met |
| `watch.yml` green, and its issue flow proven | not run yet | **pending**: the integrator runs «Watch» once against the preview, then twice with `force_failure` (opens, then comments); the owner sets the repository to «Watch: All activity» |
| Lint, format, types, knip, unit, dom and int tests | gate `ci:local`: lint, format, types, knip and the bidi check pass; `npm test` 218 files, 3897 passed, 1 skipped; `test:tz` 81 passed in each of 3 time zones; build, no-prerender check, `db:e2e`, e2e and `check:bundle` pass. On the gate series: the same static checks, `npm test` 219 files, 3900 passed, 1 skipped, and 375 e2e tests of the touched specs pass (desktop light and dark, phone light, admin) | met |

## Budgets (metric, target, measured, per tier where relevant)

The brief 7 table with every row is `docs/qa/audit-performance.md` 1 (PERF lane, measured on
`726f3a2`). The gate re-ran the two timing scripts once on `6f3546e`, alone on the host:

Lighthouse, mobile preset (`npm run lhci`, 5 runs per URL, exit 0). LCP min / median / max in
ms; score and TBT are medians. Accessibility, best practices and SEO are 100 on every asserted URL
(the `/qa/floor` page is not asserted); CLS is 0 in all 80 runs.

| Page | Light LCP | Light score | Light TBT | Dark LCP | Dark score | Dark TBT | Gate (best of 5 ≤ 2500 ms) |
|---|---|---|---|---|---|---|---|
| `/qa/floor` (framework floor) | 1655 / 1662 / 1814 | 1.00 | 0 | 1355 / 1363 / 1674 | 1.00 | 12 | not asserted |
| `/qa/not-found` | 1813 / 2110 / 2413 | 0.99 | 2 | 2110 / 2111 / 2259 | 0.99 | 2 | pass |
| `/خدمات/ترمیم-دندان` | 2183 / 2187 / 2189 | 0.99 | 40 | 2184 / 2338 / 2571 | 0.98 | 53 | pass |
| `/هزینه-و-پرداخت` | 2108 / 2264 / 2418 | 0.98 | 1 | 2109 / 2408 / 2412 | 0.98 | 1 | pass |
| `/رزرو-نوبت` | 2114 / 2115 / 2422 | 0.99 | 2 | 2110 / 2113 / 2133 | 0.99 | 4 | pass |
| `/اورژانس` | 2109 / 2259 / 2409 | 0.98 | 3 | 2109 / 2259 / 2482 | 0.98 | 4 | pass |
| `/?tier=0` | 2485 / 2561 / 2638 | 0.97 | 17 | 2029 / 2490 / 2642 | 0.97 | 43 | pass |
| `/?tier=1` | 2483 / 2490 / 2561 | 0.97 | 74 | 2483 / 2492 / 2569 | 0.96 | 88 | pass |

Against the brief's targets: the booking and emergency LCP stays over 2.0 s (best 2.11 s; the
framework scripts' render delay, `docs/qa/audit-performance.md` 2), and the home median sits at
2.49 to 2.56 s against 2.5 s, as in the PERF run.

`measure-home --tiers=0,1,2` (light, exit 0; `p9/final/home`, not in the repository):

| Row | Target or gate | Measured | Result |
|---|---|---|---|
| Home Lighthouse, mobile, median of 3 | score ≥ 0.90 (tier 1) | tier 0 0.97, tier 1 0.97, tier 2 0.96; LCP 2488 to 2561 ms; CLS 0 | pass |
| Home Lighthouse, desktop | - | 0.99 to 1.00; LCP 611 to 613 ms; TBT 0 | pass |
| Frames, desktop 1440x900, default GPU, 4x, tiers 1 and 2, every section | median ≥ 59, slowest window ≥ 55, worst frame ≤ 50 ms, no task over 100 ms | every section passes; services tier 2 59 / 58 / 33.4 ms; no task over 100 ms | pass |
| Frames, whole page, default GPU, 6x | recorded | 59 / 49 to 52 fps, worst 66.7 ms, no task over 100 ms | recorded |
| Frames, SwiftShader | tier 0 recorded; a software GPU is tier 0 in production | tier 0 52 fps median; tiers 1 and 2 28 to 33 fps | recorded |
| clsAll over a full scroll | 0 | 0 at every tier, both GPUs | pass |
| Heap after the scroll and GC | at most +0.5 MiB | +0.2 (tier 0), +0.4 (tier 1), +1.0 (tier 2) MiB | partial: tier 2 is the one-time lazy chunks of the first pass, as phase 7 recorded |
| INP, hero and block submits, 4x | ≤ 200 ms | 64 to 104 ms (desktop and phone, tiers 0 to 2) | pass |
| INP, typing in the booking forms | ≤ 200 ms | worst 96 ms in 36 runs | pass in this run (PERF saw an entry near 1 s, section 8) |
| Font swap, fonts 1.5 s late | cls ≤ 0.05 in every run | 0.0008 in 15 of 15 runs | pass |
| Initial JS (`check:bundle`) | interim limits 170 / 150 / 150 KiB | home 160.8, content 144.9 to 149.9, booking 149.1, emergency 148.4 KiB | pass (content 0.1 KiB under its limit); targets 90 and 70 KB missed (framework floor) |
| CSS, fonts | ≤ 50 KiB, ≤ 120 KiB | 16.8 to 17.3 KiB; 90.1 KiB | pass |

## Screenshots and recordings (paths)

- `docs/qa/phase-09/`: every public template at 390, 820 and 1440 px, light and dark, on the
  launch-shaped database, with the stitched tier 2 home and the empty hubs.
- `docs/qa/admin-guide/`: the admin guide's screens.
- Jury captures, walks and filmstrips: the scratch folder of the JURY lane (not in the repository).

## Independent review (findings, fixes)

| Review | Findings | Result |
|---|---|---|
| JURY (awards jury and a patient on a cheap phone in south Tehran) | top 10 and 10 lower notes | rows 1 (restoration CTA stretched), 2 (placeholder captions), 3 (phone hero band), 4 (empty hubs in the nav), 5 (closed-hours 115 call), 7 (molar drawing), 8 (dark booking band), 9 (empty hub heroes), 10 (VIP and CIP explained) fixed; row 6 declined to the client; lower notes 4 fixed, 1, 2, 5 declined (above), 3, 7 and 10 moved to section 8, 6 and 9 are client facts (gaps 3 and 18), 8 is a brand note for the client |
| SEC reviewer | SEC-5's backslash rule, SEC-6's chunked body, SEC-7's premise | all three fixed or raised (`audit-security.md` 13) |
| COPY dentist reviewer | the copy that ships | `audit-rtl-copy.md` 1 |

## Content gaps added or closed

Reconciled with the clinic checklist of 2026-10-29 (`docs/content/gaps.md`): rows 10 and 32 done
(the VPS), row 21 received (the host is in Tehran), row 64 added (the restoration line under the
home chips). Rows 2, 3, 6, 11, 12, 14, 41, 57 and 62 carry the phase 9 facts. No checklist item is
answered yet.

## Risks and open questions (max 5 questions for the client)

1. Do you approve the draft copy the launch carries: the default description (gap 41), the
   privacy and pricing lines (54), the emergency page with its 115 button (57) and the
   restoration line (64)? The first-visit sentence (50) stays out.
2. Prices: may the site show «از ...» prices (gap 14)? If not, may the pricing page be renamed
   to «بیمه و شرایط پرداخت»?
3. The clinic's licence number and technical director (gap 3).

Risks: the WebKit and Firefox results are not green yet; no real iPhone or Android device has
opened the site (launch checklist); the frames and INP rows above.

## Prerequisites for the next phase

1. CI green in three engines on one commit (XB2, then the integrator).
2. The preview deployed from that commit; `restore-check`, `offsite-backup` and «Watch» run once
   against it (integrator, with the owner's OK).
3. The owner's steps: the environment `server` with the secrets moved into it, the
   `first-admin` log deleted and the admin e-mail changed (SEC-2, SEC-7), the
   `BACKUP_AGE_RECIPIENT` key, the repository watched for issues, a yes on the live captions
   (D33).
4. The client's go (go table below), MFA enrolled, holidays entered (gap 40), the provider
   snapshot on, the zone export with TTL 300 and the MX check (`docs/deploy.md` 3.7 steps 1
   and 2), the owner's phone and an iPhone on the preview.

## Go table (for the client's go decision)

Launch needs every «yes» row done. A row marked [CLIENT] cannot finish without the clinic.

| # | Item | State at the gate | Who acts | Blocks launch |
|---|---|---|---|---|
| 1 | The phase 9 table above | every CI gate green in Chromium; WebKit and Firefox red | studio (XB2, integrator) | yes |
| 2 | A restore proven on the server (`restore-check`, recorded in `docs/deploy.md` 6.1) | not run | owner OK, then studio | yes |
| 3 | «Watch» live, issue flow proven, the repository watched | not run | studio; owner watches | yes |
| 4 | Lighthouse on the preview: home, a service, booking, both themes (from a GitHub runner) | not run | studio | yes |
| 5 | Rollback ready: `docs/deploy.md` 5 and the previous release commit | documented | studio | yes |
| 6 | The draft copy the yes covers: gaps 41, 54, 57 (with the 115 button), 64; 50 stays out | waiting [CLIENT] | client | yes |
| 7 | Admin MFA enrolled | waiting [CLIENT] | client | yes |
| 8 | Holidays of 1405 and 1406 entered (gap 40) | waiting [CLIENT] | client | yes |
| 9 | The provider's daily snapshot on | waiting [CLIENT] | client | yes |
| 10 | Zone export, TTL 300, the MX check (`docs/deploy.md` 3.7 steps 1, 2) | waiting [CLIENT] | client | yes |
| 11 | The owner's phone and an iPhone on the preview | not done | owner, client | yes |
| 12 | Owner yes: no «جای عکس» caption on the live site (reverses D33) | waiting | owner | yes |
| 13 | Owner OK to bring the preview database's service and page copy and the ten new descriptions up to date (the seed only creates; real data) | waiting | owner, then studio | yes |
| 14 | Owner GitHub steps: environment `server` with the secrets, the `first-admin` log deleted, a new admin e-mail, `BACKUP_AGE_RECIPIENT` | waiting | owner | yes |
| 15 | The written go for the switch: `PHASE=live`, `provision`, the DNS change, `cert` (`docs/deploy.md` 3.7; visitors see it within the TTL) | waiting [CLIENT] | client | yes |
| 16 | SMTP for staff notifications (gap 55) | open | client | no: requests reach the admin list and the log; the launch report records it |
| 17 | Search Console and the sitemap (gap 12) | open | client | no: submitted the day the account exists |
| 18 | Prices or a renamed pricing page (gap 14, jury row 6) | open | client | no |
| 19 | Clinic licence and technical director (gap 3) | open | client | no, but a trust cost on day one |

## Cut to post-launch (plan section 8, as at the gate)

Plan section 8 stands. The gate adds the rows marked «gate».

| Item | From | Trigger or when |
|---|---|---|
| Phase 8 WebGL world; tier 3 frames; V1 (empty pin stage) | D26, phase 7 | after launch |
| Rich-text block converters (callout, table, video) | P6 TEMPLATES step 2 | before the first article publishes |
| Live preview route and its security review | P6 TEMPLATES step 2 | with the converters |
| Cases page `/قبل-و-بعد` and its links (home, service, dentist; removed at the gate) | P6 TEMPLATES step 2, gate | the first consented pair (gap 6) |
| Dentist review of the 3 guides and 6 articles | P6 wave 2 | before they publish (gaps 2, 42) |
| `docs/content/editorial-guide.fa.md` | P6 deliverable 10 | when a reviewer dentist exists |
| Lighthouse on a post; dentist page audit | P6, P9 deliverable 2 | first published article or dentist |
| Visual regression golden set and compare script; F4 capture tooling | P9 deliverable 8 | after phase 8 settles home |
| Anonymization of old bookings | P9 deliverable 7 | the client sets a retention period (gap 43) |
| Schedule-drawer «لغو انتشار» guard | P6 I1 | the admin guide warns at launch |
| F6, V2 (workflow contrast and overlap) | phase 7 | when gap 48 turns the workflow scene on |
| V4 (demo only) | phase 7 | never on live (V3 is fixed) |
| Initial JS targets 90 KB and 70 KB | brief 7 | the framework floor; interim gates hold |
| Services frames at desktop tier 2, FAQ at tier 1, the typing INP entry: intermittent, seen by PERF, not in the gate run (gate) | PERF findings 1 to 3 | a trace of `/?tier=2` over the services pin (`cc,gpu,viz`) and of `--only=inp --tiers=1,2`; never by lowering a threshold |
| Media snapshots with `rsync --link-dest` | deploy 3.9 | when media passes about 1 GB |
| Growth plan, SEO report template, weekly digest, `handover.fa.md` | P10 deliverables 4, 6, 7, 8 | within 2 weeks of launch |
| Payload-internal English strings (C15) | P6 I1 | recheck on Payload upgrades |
| Re-open COPY sources marked «not re-opened» | wave 1 COPY | from a network that reaches them |
| The «Server» `run` action keeps its output in the public log; secrets are masked, a query's rows are not (gate, SEC-1 residual) | SEC-1 | before anyone runs a data query through `run`; until then staff never do |
| Jury note 3: the footer «کیفیت» picker reads as engineering words (gate) | JURY | with phase 8, which changes the tiers |
| Jury note 7: single-item sections leave two thirds of a row empty (gate) | JURY | before the first dentist publishes |
| Jury note 10: the services row at 820 px scrolls instead of a 2-column grid (gate) | JURY | the next home layout pass |
| Titles under 50 code points on 14 pages: crawl warnings (gate) | SEO-RTL | an SEO pass with Search Console data |
| `docs/deploy.md` 1.1 still says nothing has run on the server (gate) | integrator | the next deploy note |
