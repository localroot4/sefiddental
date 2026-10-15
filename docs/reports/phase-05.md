# Phase 05 - Conversion System

Date: 2026-10-15 to (open).

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
