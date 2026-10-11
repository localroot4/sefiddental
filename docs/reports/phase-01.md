# Phase 01 - Discovery and Strategy

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
- `docs/seo/keyword-map.md`: 39 indexable URLs with primary and secondary terms, intent, H1 and title drafts; 12 article candidates, 6 seeds; brand and local terms.
- `docs/ia.md`: sitemap, navigation, mega menu, phone drawer, footer, breadcrumbs, internal-linking rules, section order for every template, self-review.
- `docs/conversion.md`: labels per intent, CTA map, sticky bar rules, booking flow with full microcopy and errors, success moment, hours awareness, emergency flow with gating, WhatsApp texts, analytics events.
- `docs/content/shot-list.fa.md`: Persian shot list for the photographer, 31 shots and videos by location.
- `docs/seo/gbp-setup.fa.md`: Persian step-by-step Google Business Profile guide with copy-ready NAP and description.
- `docs/discovery/risks.md`: 16 risks with mitigation and owner.
- Source files updated for consistency: `docs/brief.md`, `docs/design-direction.md`, `docs/seo/plan.md`, `docs/architecture.md`, `docs/prompts/04-core-pages.md`, `docs/content/gaps.md`.

## Decisions and deviations

| # | Decision | Why | Files changed |
|---|---|---|---|
| D1 | Flat service URLs `/خدمات/{slug}`; category only in the breadcrumb | Encoded Persian URLs get very long when shared; services can move between categories without redirects | `ia.md`, `seo/plan.md`, `brief.md` |
| D2 | Articles are «مقالات» (`/مقالات`), not «بلاگ» | Patients search for "مقاله"; one term in UI and URL | same |
| D3 | Primary nav: خدمات، پزشکان، قبل و بعد، هزینه و پرداخت، تماس. Articles move to the mega menu row, drawer and footer | Nav follows the decision path; article traffic enters from search | `ia.md`, `design-direction.md` |
| D4 | Sticky phone bar stays visible; hides only for the booking block, footer contact, focused fields and modals | Persistent actions convert better and need no scroll listener (banned) | `conversion.md`, `design-direction.md`, phase 4 prompt |
| D5 | Services bento has 5 cells, not 6 | The taxonomy has 3 categories plus 2 standalone services; the old "6 cells" note was an error | `design-direction.md` |
| D6 | Booking has one required field (mobile); no consent checkbox, an informing line instead | Fewer fields, higher completion; still transparent | `conversion.md` |
| D7 | «مشاورهٔ رایگان» is not used until the client confirms it | No unconfirmed offers | `conversion.md`, gaps 17 |
| D8 | Booking stores `heard_from`, `tier`, `doctor_id`, `emergency_outcome` | Attribution of calls and misuse measurement | `architecture.md` |
| D9 | WhatsApp is the primary messenger; Telegram secondary | WhatsApp reachable in Iran since December 2024; Telegram filtered | `conversion.md` |
| D10 | Launch is blocked while risk R1 (foreign crawlers blocked) is open | A site Google cannot fetch cannot rank | `risks.md` |

## Verification

| Check | How | Result |
|---|---|---|
| Old site reachable | `curl` to sefiddental.ir and the Web Archive, twice | blocked: TLS reset from abroad; no archive snapshot |
| Screenshot facts | zoomed crops of the home screenshot, read every section | facts recorded; 8 new gaps |
| Competitors | 3 web searches (US index) | directories dominate local results; no clinic site; brand not indexed |
| Every indexable URL has a keyword row | script comparing `ia.md` and `keyword-map.md` | 39 of 39 |
| Home layout families | manual count against rules | 10 distinct, none repeated, one image-text split |
| Booking required fields | spec review | 1 (mobile) |
| Emergency flow | spec review | triage, call-first in hours, ۱۱۵ line, rate limits present |
| Em and en dashes in all new docs | script | none |
| Arabic ي and ك in all new docs | script | none |
| Invented numbers | manual read | none; volumes marked unknown; stats marked unverified |

## Budgets

Not applicable: no public pages were built in this phase.

## Screenshots

None: documents only. The old-site screenshots used are in
`content/reference/old-site/`.

## Content gaps added or closed

Added rows 17-29 in `docs/content/gaps.md` (free consultation, callback
promise, emergency first-hour promise, signage name, host location and
international access, old videos, logo variants, unknown social icon,
first-visit cleaning promise, specialists on the team, scope checks for
"(verify)" terms, evidence for the «اولین» claim, directory profiles).
Closed: none.

## Risks and open questions

Top risks: R1 (crawlers blocked by the host), R4 (missing real assets),
R6 (advertising claims). Questions for the client (max 5):

1. Is the new host in Iran or abroad, and does it accept traffic from
   outside Iran? (R1, phase 3)
2. Is the first consultation free? (booking chips, hero copy)
3. During opening hours, how fast does reception call back a booking, and
   from which number? (success copy)
4. Exactly what name is on the clinic signage? (NAP, GBP, schema)
5. Which specialists are on the team: orthodontist, pediatric dentist, oral
   surgeon? (service claims, GBP categories)

## Prerequisites for the next phase (02, design system)

- Client approval of `docs/ia.md` and the microcopy in `docs/conversion.md`.
- Vector logo files, or approval to trace the PNG (gap 1, 23).
- Answers 2 and 4 above (they change the hero copy and the logo lockup).
