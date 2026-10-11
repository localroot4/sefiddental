# Phase 05 - Conversion System

Build everything that turns a visitor into an appointment and makes money
decisions clear. Think like the conversion specialist, Next.js engineer,
security engineer, analytics engineer and legal reviewer.

## Inputs

`docs/conversion.md`, `docs/architecture.md` section 5, `docs/content/
clinic.yaml` (financing, insurers, emergency policy), `docs/content/
copy-guidelines.md`, previous reports.

## Deliverables

1. Booking: one-step form as a page (`/رزرو-نوبت`) and as a `<dialog>`
   opened from every «رزرو نوبت» CTA with the service prefilled, exactly per
   `docs/conversion.md` sections 5 and 6 (one form instance per page, token
   endpoint, 419 recovery, touch focus rule). The plain HTML form works
   without JavaScript. Success page and in-dialog success state with the
   computed callback line, save-contact vCard, call and WhatsApp fallbacks,
   and the check-draw animation. Specific inline errors with `aria-invalid`.
2. Emergency: `/اورژانس` exactly per `docs/conversion.md` section 7: order
   per hours state, the two-level safety box with `tel:115`, server-validated
   triage, the avulsion text, the self-care block placeholder for phase 6,
   limits and flags.
3. Pipeline per `docs/conversion.md` 5.3 and 7.5 and `docs/architecture.md`
   section 5: normalization, honeypot, signed time token, suspicious storage
   (never dropped), per-phone and per-IP limits, append-only duplicates,
   persist-then-notify through the `Notifier` interface with `log` and
   `mail` drivers now and `telegram` and `farapayamak` scaffolded behind
   flags, SMS cap, queue retries. Tests for every rule.
4. Admin booking workflow in Payload: list ordered by urgency (emergency
   first, then newest), click-to-call and WhatsApp links, status transitions
   with notes and handler, "callback due" view, suspicious list with
   one-click restore, `heardFrom` field, filters, CSV export, dashboard
   widget with today's numbers, bulk mark as spam.
5. Pricing and payment page (`/هزینه-و-پرداخت`): how pricing works, "from"
   prices where set, the featured insurers by name with «سایر بیمه‌ها», the
   financing options rendered only when enabled with the transparent
   surcharge note, an FAQ, and a booking CTA.
6. Restoration tiers page finalized: comparison that is readable on phones
   (swipeable cards) and desktop (three columns), selected tier highlighted
   in the warm token, booking CTA that carries the tier.
7. Measurement per `docs/conversion.md` section 9: the first-party
   `sendBeacon` counter (source of truth, dashboard in admin) and the
   optional GA4 loader gated by a setting and loaded after `load`; the
   `data-track` convention; `docs/analytics.md`.
8. Privacy page draft covering what the booking form stores and who sees it.
9. Playwright e2e: booking happy path, validation errors, Persian digits
   input, duplicate within 10 minutes, emergency rate limit, modal keyboard
   use, no-JS form submission. Screenshots under `docs/qa/phase-05/`.
10. `docs/reports/phase-05.md`.

## Steps

1. Write the Form Requests and the normalization tests first, make them fail,
   then implement.
2. Build the dialog with `<dialog>`, focus trap, Esc close, scroll lock,
   and return focus to the opener; on touch devices focus the heading.
3. Build admin views in Payload with Persian labels and help texts.
4. Independent review of the whole pipeline for spam, abuse and data
   exposure; record and fix.
5. Screenshot, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- A valid phone in Persian digits with spaces submits successfully; a
  10-digit number without the leading zero is accepted; a landline is
  rejected with the specific message; honeypot and time-token failures show
  success and land in the suspicious list; the fourth booking from one
  phone in a day shows the neutral message; a duplicate within 10 minutes
  appends a note.
- The form submits without JavaScript and shows the same success page.
- Emergency page order changes with the hours state; the call button is
  in the first screen at 360x640 during hours; triage is validated on the
  server; copy never promises a slot.
- Financing options do not render while `enabled` is false; when enabled,
  the surcharge note is visible without scrolling on phones.
- All events fire once per interaction and never block navigation.
- No phone number appears in logs; the request id does.
- Lighthouse budgets hold on the booking page and the pricing page.

## Hand-off

Ask the client to test the booking flow on their own phone and to confirm the
emergency copy, the financing texts and the insurer names.
