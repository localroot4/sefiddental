# Phase 01 - Discovery and Strategy

Note (added after the phase): the client revised the brief toward a Next.js
and WebGL experience. The documents of this phase remain valid; where they
mention the former Laravel plan, `docs/architecture.md` v2 and
`docs/experience-direction.md` win.

Date: 2026-10-11. No application code in this phase.

## Plan (written before building)

What, in order:

1. Re-read the five old-site screenshots at higher zoom and record every
   visible fact; compare with `docs/content/clinic.yaml`; log conflicts.
2. Retry `sefiddental.ir`; search the web for local competitors and who ranks
   for brand and local queries. Record what the network allows.
3. Write the audit, personas and journeys, KPI tree, keyword map, IA,
   conversion spec, Persian shot list, Persian GBP guide, risk register.
4. Self-review the IA against Hick's law, the thumb zone and the quality bar;
   run mechanical checks (em dashes, invented numbers, URL coverage, layout
   families).
5. Independent review of `docs/ia.md` and `docs/conversion.md` by a separate
   agent (booking and money copy are sensitive). Fix findings.
6. Update `docs/content/gaps.md`, finish this report, commit, push.

Risks: network blocks Iranian hosts (no live audit of the old site or
competitors); no keyword-volume tool reachable (volumes stay unknown); some
facts on screenshots are low resolution.

## Delivered

- `docs/discovery/old-site-audit.md`: recorded facts, what to keep, what to retire, implications.
- `docs/discovery/personas-and-journeys.md`: five personas with entry queries, objections and the element that answers each; journey map.
- `docs/discovery/kpis.md`: KPI tree, definitions, sources, review ritual.
- `docs/seo/keyword-map.md`: 38 indexable URLs with one owner per term, intent, H1 and title drafts; 12 article candidates, 6 seeds; brand and local terms.
- `docs/ia.md`: sitemap, navigation, mega menu, phone drawer, footer, breadcrumbs, internal-linking rules, section order for every template, self-review.
- `docs/conversion.md`: labels per intent, CTA map, sticky bar and closed-hours sheet, booking flow with microcopy, errors and abuse controls, success moment, hours and caching decision, emergency flow with safety box and gating, WhatsApp texts, measurement events.
- `docs/content/shot-list.fa.md`: Persian shot list for the photographer, 31 shots and videos by location.
- `docs/seo/gbp-setup.fa.md`: Persian step-by-step Google Business Profile guide with copy-ready NAP and description.
- `docs/discovery/risks.md`: 16 risks with mitigation and owner.
- Source files aligned: `docs/brief.md`, `docs/design-direction.md`, `docs/architecture.md`, `docs/seo/plan.md`, `docs/content/services.yaml` (new categories, tier copy, `nav_label`, `h1`, `seo_title`, `booking_group`), `docs/content/copy-guidelines.md`, `docs/prompts/04-core-pages.md`, `docs/content/gaps.md`.

## Decisions and deviations

| # | Decision | Why |
|---|---|---|
| D1 | Flat service URLs `/خدمات/{slug}`; category only in the breadcrumb | Encoded Persian URLs get long when shared; services move without redirects |
| D2 | Articles are «مقالات» (`/مقالات`) | Patients search for "مقاله"; one term in UI and URL |
| D3 | Primary nav: خدمات، پزشکان، قبل و بعد، هزینه و پرداخت، آدرس و ساعات | Nav follows the decision path; article traffic enters from search |
| D4 | Address page `/آدرس` labeled «آدرس و ساعات»; «تماس» means calling only | Removes the call versus contact-page ambiguity |
| D5 | Sticky bar stays visible; a closed-hours sheet replaces dialing a closed clinic | Persistent actions convert better; no scroll listeners; no dead calls |
| D6 | Category «جراحی و جایگزینی دندان» holds implant, overdenture, wisdom-tooth and jaw surgery, gum surgery and extraction | Patients look for extraction and wisdom teeth together; one name per page |
| D7 | Services bento and hub: 5 cells | 3 categories plus 2 standalone services |
| D8 | Booking: one required field (mobile), native radio chips, prefilled service shown as one line | Highest completion, accessible, fits a phone |
| D9 | No full-page HTML cache (app or CDN) | Fresh CSRF tokens, CSP nonces, time tokens and hours copy on every request; speed comes from OPcache and fragment caches |
| D10 | Suspicious bookings are stored and flagged, never dropped | No real patient is lost to a false positive |
| D11 | First-party event counter is the source of truth; GA4 optional | GA4 is unreliable from Iran |
| D12 | Emergency page is call-first in hours, with a two-level safety box and server-validated triage | Medical safety and abuse control without blocking shared IPs |
| D13 | Home H1 keeps the client's «اولین» slogan with a documented fallback | The client chose the slogan; the risk and the fallback are on record (R6, gap 28) |
| D14 | No home-hero emergency link | Client asked to avoid misuse; the path stays in FAQ, drawer, mega menu, footer and relevant service pages |
| D15 | Launch is blocked while risk R1 (foreign crawlers blocked) is open | A site Google cannot fetch cannot rank |

## Verification

| Check | How | Result |
|---|---|---|
| Old site reachable | `curl` to sefiddental.ir and the Web Archive, twice | blocked: TLS reset from abroad; no archive snapshot |
| Screenshot facts | zoomed crops of the home screenshot, read every section | facts recorded; new gaps logged |
| Competitors | 3 web searches (US index) | directories dominate local results; no clinic site; brand not indexed |
| Every indexable URL has a keyword row | script comparing `ia.md` and `keyword-map.md` | 38 of 38; no extra rows |
| Service H1 and title match `services.yaml` | script | 18 of 18 match |
| Term cannibalization | manual pass after review | one owner per term |
| Home layout families | manual count | 10 distinct, none repeated, one image-text split |
| Booking required fields | spec review | 1 (mobile) |
| Em and en dashes in docs | script over `docs/` | none |
| Arabic ي and ك | script over `docs/` | only where rules name them |
| Invented numbers | manual read | none; volumes unknown; stats marked unverified |

## Budgets

Not applicable: no public pages were built in this phase.

## Screenshots

None: documents only. The old-site screenshots used are in
`content/reference/old-site/`.

## Independent review

A separate agent reviewed `ia.md`, `conversion.md` and `keyword-map.md`
against the brief, design direction, copy guidelines and data files. It
reported 25 findings (2 blockers, 15 major, 8 minor) and advised against
approving the gate before fixes.

| Finding | Severity | Outcome |
|---|---|---|
| Avulsion instructions incomplete (replant, rinse limit, milk not water, baby teeth) and a closed-hours dead end | blocker | fixed with IADT-based text, hours-aware next step, gap 31 |
| Safety box missed fever and trismus; bleeding advice contradicted triage; one long sentence | blocker | fixed: list format, two levels, `tel:115`, triage wording changed, aspirin note |
| Emergency page not call-first; order differed between docs | major | fixed: call button in the first screen; one order in both docs |
| Triage gate needed JS; IP limit could block shared carrier IPs; no limit message | major | fixed: server validation; IP over limit is flagged, not blocked; message added |
| Full-page cache would break CSRF, nonces, time trap and hours copy; no 419 state | major | fixed: no full-page HTML cache (D9); 419 message added |
| Honeypot and time trap could silently drop real patients | major | fixed: stored as suspicious with one-click restore (D10) |
| Abuse via random phone numbers, SMS bombing, duplicate overwrite, number disclosure | major | fixed: IP limit, SMS cap, append-only duplicates, neutral message |
| Callback copy wrong before opening, on holidays and near closing; mixed voice | major | fixed: computed next working time, one voice |
| Out-of-hours call cell dials a closed clinic; long-press not discoverable | major | fixed: closed-hours sheet (D5) |
| Booking form too tall; no service-to-chip mapping | major | fixed: short chips, `booking_group`, prefilled one-line service |
| One-label-per-intent breaks («تماس» nav versus call, extra labels) | major | fixed: «آدرس و ساعات» (D4), registered short forms, banned extra labels |
| «اولین», «متخصص», «بدون درد» compliance | major | partly: «متخصص» and «بدون درد» restricted; «اولین» kept by client decision with fallback (D13) |
| Tier copy belittled other dentists and promised a result | major | fixed in `services.yaml` |
| Keyword cannibalization across services, articles, guides, about, hub, gallery | major | fixed: one owner per term |
| Surgery and extraction split across categories; four names for one page | major | fixed (D6); scope still to verify (gap 27) |
| Layout family definitions did not match use; pinned journey on every service page; double map | major | fixed: B and C redefined, G-static, J-form |
| No visible emergency path on home | major | declined on home by client wish (D14); added on root canal, extraction and 404 |
| Missing `h1`, `seo_title`, `nav_label`; slug uniqueness | minor | fixed in `services.yaml` |
| Gallery had many primary CTAs; filter canonical undefined | minor | fixed |
| Error copy and phone validation details | minor | fixed (10-digit input, `^09\d{9}$`, Persian map names) |
| Success page opened directly, duplicate ids, keyboard covering the lead, aria | minor | fixed |
| `items_count` always 1; GA4 unreliable | minor | fixed: moved to submit; first-party counter (D11) |
| Thin article categories, pagination canonical, long dentist titles, «آنلاین» | minor | fixed |
| Mega menu missing «درباره ما»; testimonials page references; bridges and dentures | minor | fixed; gap 30 for bridges and dentures |
| Doc drift (brief counts, labels, CTA map gaps, persona ages) | minor | fixed |

## Content gaps added or closed

Added rows 17-31 in `docs/content/gaps.md`. Closed: none.

## Risks and open questions

Top risks: R1 (crawlers blocked by the host), R4 (missing real assets), R6
(advertising claims). Questions for the client (max 5):

1. Is the new host in Iran or abroad, and does it accept traffic from outside
   Iran? (R1, phase 3)
2. Is the first consultation free? (booking chips, hero copy)
3. During opening hours, how fast does reception call back a booking, and
   from which number? (success copy)
4. Exactly what name is on the clinic signage? (NAP, GBP, schema)
5. Which specialists are on the team: orthodontist, pediatric dentist, oral
   surgeon? Does the clinic do wisdom-tooth surgery? (service claims, GBP)

## Prerequisites for the next phase (02, design system)

- Client approval of `docs/ia.md` and the microcopy in `docs/conversion.md`.
- Vector logo files, or approval to trace the PNG (gaps 1 and 23).
- Answers 2 and 4 above (they change the hero copy and the logo lockup).
