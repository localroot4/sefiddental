# Phase 06 - Content and SEO Engine

Date: 2026-10-18 to 2026-10-30 (closed at the phase 9 gate). Commits `6ba2864` to `a7ef2aa`,
then the phase 9 series up to the gate.

## Plan (written before building)

What: the articles engine (hub, post, category and tag pages, RSS,
pagination, `Article` and `FAQPage` data), the editorial system in Payload
(live validators, SERP preview, live preview, scheduling, review states,
the Persian normalizer on save, an editorial calendar, a writing
checklist), the admin polish for the receptionist (Persian everywhere,
navigation by daily task, dashboard widgets, media rules), final Persian
copy with sources for every service and the tiers, three patient guides,
six seed articles, structured data and OG images for every template, the
old-URL import with the `/vip` alias and slug-change redirects, internal
linking, the cases page that the menus already link, the editorial and admin
guides, screenshots and Lighthouse on a post.

Order:

1. Wave 0 (integrator): pending test keys, gap rows 58 to 63, this section.
2. Wave 1a, engineering lanes in parallel with disjoint files: MODEL
   (validators, blocks, normalizer, review states, checklist, SERP preview),
   SEED (YAML schemas, copy checks, the `[text](/path)` link syntax,
   articles seeding), SEO (metadata, JSON-LD with `schema-dts` checks, OG
   cards, sitemaps, RSS, pagination), REDIRECTS (CSV import with a dry run,
   the `/vip` fragment fix), ADMIN (navigation, dashboard widgets, calendar,
   Jalali dates, the no-English test), TEMPLATES step 1 (routes, readers,
   hub, post, category, tag, internal links, the QA fixture).
3. Wave 1b, after SEED's checks and once the source sites are reachable:
   three copy lanes (services, guides, articles). Each source is opened
   before it is cited.
4. Integration I1: generated files, one migration per adapter (the Media
   `og` size only), lint, tests, build, e2e, bundle.
5. Wave 2: an independent reviewer acting as a dentist reads every text
   against its sources (prompt step 4), the copy lanes fix; TEMPLATES step 2
   (block converters, live preview, cases page); an independent security
   review of the preview path, the CSV import and the approval access; the
   editorial guide.
6. Wave 3: accessibility, screenshots, Lighthouse on the QA post, the admin
   guide with screenshots. Then screenshot, inspect, fix in one batch,
   confirm, stop (prompt step 5); report, commit, push, CI green.

Main decisions (the full freeze table goes into Decisions when the phase
closes): article URLs as `docs/ia.md`; 12 items a list page, self-canonical
pages 2 and up; a category is indexable from 5 published articles, a tag
never; every article (not only medical ones) needs an approved review by a
published dentist, a review date, sources and two live internal links (one
service, one guide) before it publishes, and only an admin can approve;
live preview renders drafts on the server for TOTP-verified staff and ships
no public JavaScript; OG cards are rendered once per page type by a real
browser (Persian shaping) and committed, never on the shared host; the old
URL import is an admin upload with a dry run, because the cPanel host has
no known shell; client facts are never invented (YAML `# NEEDS_CLIENT`
comments and gap rows).

Deviation recorded now: TEMPLATES step 1 runs in parallel with MODEL,
against contracts fixed before wave 1 (block shapes, readers, preview URL),
where the prompt says model and admin first.

Risks: the content-page scripts gate has about 100 bytes of headroom on the
service page, so public templates add no client JavaScript; a preview path
that leaks drafts; the approval gate slowing the receptionist; the
rich-text normalizer at formatting boundaries; 15 to 25 thousand words of
medical copy under the copy rules; the source sites are blocked from the
build network until the client allows them; new text reaching a live site
that already runs needs the client's yes (a backup first, a fill-empty step
off by default).

## Integration I1 (2026-10-20, wave 1a)

The six engineering lanes (MODEL, SEED, SEO, REDIRECTS, ADMIN, TEMPLATES step 1) were each
reviewed by an independent reviewer and repaired before integration. Wave 1b (copy) has not run:
the source sites (nhs.uk, ada.org, cochrane.org, pubmed, aapd.org, perio.org, mouthhealthy.org)
still answer 403 from the build network, and a source is cited only after it is opened.

Deviations recorded at I1:

1. H25 is held for services. `src/collections/Services.ts` keeps the sources field without its
   publish gate (a `shortcut:` comment names the line to add). With the gate on, every seeded
   service is refused, so seeding, the int suites, `db:e2e`, the cPanel package and the editing
   of the live services would all stop until the copy lands. The gate turns on in the commit that
   adds the sources to `docs/content/services.yaml`. CT6 and SD12 (the gate's tests) and the C10
   copy checks SC8 to SC12 are held with it (`skip`, with the same note). Guides and articles
   keep their sources gate.
2. Until the guide copy lands, the QA fixture gives the dental-fear and aftercare guides a sample
   body and source (marked as sample text) when the seed has none, so they can publish on the
   e2e database.
3. `schema-dts` is 2.1.0 (current stable, with its `schema-dts-lib` types), not the 1.1.5 the
   SEO lane proposed; the reviewer checked the builders against both.
4. The save normalizer now writes Persian digits in the prose of articles, pages, services,
   service categories, tiers and doctors, and pairs straight quotes in all prose. The first sync
   after this rewrites such text once (phase 3 kept ASCII digits as typed).
5. Admin (H33, H34): the allowlist adds VIP and CIP (the clinic's tier names, as on the public
   site) and JPG and WebP. payload-totp's «Something went wrong» toast, its Google Authenticator
   link and the live preview «Responsive» size stay English (C15). «فوری‌های باز» counts open
   emergencies of every day, not only earlier days. The failed row of T-AD26 is proven at int
   level (CAL-I1), because a failed job cannot be made from the browser. Only the TOTP setup page
   is scanned for English. Media: the preview-size names are hidden; Payload's file-size units
   and FileMeta's «Copy URL» tooltip stay English (no translation key). Help text of the
   admin-only Clinic and Settings keeps technical tokens such as SMTP and GA4. Screen-reader
   and hover labels that Payload, Lexical and sonner hard-code also stay English: the toast
   region «Notifications alt+T» and «Close toast», a checkbox's title (its field name), a
   drawer named by its slug, and the editor's toolbar and block handles («Add block», «Drag to
   move», «Edit link»). T-AD21 skips exactly these; visible text is still checked. Arrays now
   carry Persian row labels, Payload's upload fields with English labels (MIME type, URL) get
   Persian ones, the TOTP views get Persian titles, and Payload's empty-array sentence, which
   read «must not contain any», now says that nothing is recorded yet.
6. Lexical's Persian heading label ships as `[SKIPPED]` and a feature's strings override the
   config's translations, so `src/fields/richText.ts` sets «تیتر» on the heading feature itself.
7. The seeder checks an unknown article category, tag or primary service after the earlier
   steps have written (idempotent rows; a rerun after the fix completes). Only unknown link paths
   stop the run before any write.
8. Found while running the admin e2e for the first time, and fixed with this integration:
   - The production build carries one copy of Payload per route bundle. When the admin page
     started Payload, a ValidationError thrown by a hook reached the API route's formatter as a
     foreign class and lost its field messages: an editor who closed a request without a note
     saw «The following field is invalid: status» with no reason. A config `afterError` hook
     (`src/hooks/errors.ts`) puts the public field messages back. It is the same bug for every
     hook that refuses a save, so it was in phase 5 too; e2e passed there only when another
     route started Payload first.
   - Lexical parks its hidden block handle and link editor 10 000 px to the left. Under RTL
     that made the article form 10 919 px wide; `custom.scss` clips it at the editor.
   - Payload preselects «لغو انتشار» in the schedule drawer of a document that was never
     published. The admin guide (wave 3) must say to choose «انتشار»; a guard is a wave 2
     candidate.
   - Without a session, a custom admin view (the calendar, the status view) shows the
     not-found view with a 200, because the admin layout streams before the view runs. No data
     is rendered; a signed-in editor gets a real 404.

## Close (phase 9 gate, 2026-10-30)

Phase 6 ended at I1. Its wave 1b, 2 and 3 ran later: the copy on 2026-10-26, the rest inside the
phase 9 lanes. This section closes the phase; nothing below is new work.

### Copy (wave 1b) and H25

- The sourced copy landed on 2026-10-26: the eighteen services (`a7ef2aa`), the three patient
  guides (`df13608`) and the six draft articles (`c2dd0d8`). Each source was opened before it
  was cited.
- **H25 is closed by `a7ef2aa`:** it turns the services sources gate on and unskips CT6 and
  SD12. `38924d5` turns the C10 copy checks (SC8 to SC12) on. I1 deviation 1 is void.
- I1 deviation 2 stands for the e2e database only: the QA fixture still publishes the guides
  with a sample reviewer.

### Wave 2 and 3 items

| Item | Status | Where, or why moved |
|---|---|---|
| Dentist review of every text against its sources | done for what ships at launch: the 18 services, the five category pages, home, pricing, emergency, about, privacy (phase 9 COPY, `f85d133`, `19dbf99`, `docs/qa/audit-rtl-copy.md` 1) | the 3 guides and 6 articles: plan section 8, before they publish (gaps 2, 42; owner decision 1a) |
| TEMPLATES step 2: rich-text block converters (callout, table, video) | moved | plan section 8: before the first article publishes; until then no article can publish (fact 2 of the phase 9 plan) |
| TEMPLATES step 2: live preview route | removed for launch (phase 9 SURFACE: the tab and its config) | plan section 8, with its security review, when the converters land |
| TEMPLATES step 2: the cases page `/قبل-و-بعد` | moved | plan section 8: the first consented pair (gap 6). The chrome (SURFACE) and, since the phase 9 gate, home, the service template and the dentist page link it no more; the sitemap leaves it out (`c39549b`) |
| Security review of the preview path, the CSV import and the approval access | done (phase 9 SEC, `docs/qa/audit-security.md` 2, 3, 5; SEC-5 and SEC-6 fixed) | the preview path is gone, so its review moves with it |
| Editorial guide `docs/content/editorial-guide.fa.md` | moved | plan section 8: when a reviewer dentist exists; no article can publish before |
| Schedule-drawer «لغو انتشار» guard | moved | plan section 8; the admin guide warns (`docs/admin-guide.fa.md`, «زمان‌بندی انتشار») |
| Accessibility | done (phase 9 A11Y, `docs/qa/audit-accessibility.md`) | |
| Screenshots | done for the launch shape (phase 9, `docs/qa/phase-09/`) | the article and dentist templates are captured on the QA database only |
| Lighthouse on a post | moved | plan section 8: the first published article or dentist; `scripts/lhci.mjs` dropped the dentist URL (`db30bff`) |
| Admin guide with screenshots | done (phase 9 ADMIN-GUIDE, `docs/admin-guide.fa.md`, `docs/qa/admin-guide/`) | |

### Freeze table

| ID | Decision | Why |
|---|---|---|
| P6-1 | Article URLs as `docs/ia.md`; 12 items a list page; pages 2 and up self-canonical | one URL scheme for the engine and the crawl |
| P6-2 | A category is indexable from 5 published articles; a tag never | thin pages stay out of the index |
| P6-3 | Every article needs an approved review by a published dentist, a review date, sources and two live internal links (one service, one guide) before it publishes; only an admin approves | medical content (E-E-A-T); the receptionist cannot publish unreviewed text |
| P6-4 | Guides and the emergency self-care blocks need a published reviewer dentist too; services carry their sources gate (H25) | the same rule for every medical text |
| P6-5 | OG cards are rendered once per page type by a real browser and committed, never on the server | Persian shaping needs a real text engine |
| P6-6 | The old-URL import is an admin upload with a dry run; rows that resolve off-site are refused (SEC-5) | the host had no shell; an import must never redirect a patient away |
| P6-7 | Client facts are never invented: `# NEEDS_CLIENT` comments and gap rows | the copy rules; the gap registry tests (CG1, CG2) |
| P6-8 | The save normalizer writes Persian digits in prose and pairs straight quotes (I1 deviation 4) | one written form on every page |
| P6-9 | `schema-dts` 2.1.0 types the JSON-LD builders; the crawl checks what renders | compile-time and render-time checks of the same graph |
| P6-10 | Live preview is not shipped at launch (was: drafts rendered on the server for TOTP-verified staff) | no route existed; a preview path is a draft leak risk without its review |
| P6-11 | C15: the Payload, Lexical and sonner strings listed in I1 deviation 5 stay English; since the phase 9 gate the TOTP setup line names no app (AG-F3) | no translation key exists for them |
