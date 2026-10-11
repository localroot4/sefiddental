# Phase 05 - Conversion System

Build everything that turns a visitor into an appointment and makes money
decisions clear. Think like the conversion specialist, Laravel engineer,
security engineer, analytics engineer and legal reviewer.

## Inputs

`docs/conversion.md`, `docs/architecture.md` section 5, `docs/content/
clinic.yaml` (financing, insurers, emergency policy), `docs/content/
copy-guidelines.md`, previous reports.

## Deliverables

1. Booking: one-screen form as a page (`/رزرو-نوبت`) and as a modal opened
   from every «رزرو نوبت» CTA with the current service prefilled. Fields and
   microcopy exactly per `docs/conversion.md`. Progressive enhancement: the
   plain HTML form works without JavaScript. Success page and in-modal
   success state with the callback window, call and WhatsApp fallbacks, and
   the check-draw animation. Specific inline errors.
2. Emergency: `/اورژانس` with triage toggles, the call-first path during
   hours (big tel button, hours-aware copy), the request form, the safety
   line about ۱۱۵, rate limit one per phone per day, red flag in admin.
3. Pipeline: normalization, honeypot, time trap, rate limits, duplicate
   merge, persist-then-notify through the `Notifier` interface with `log`
   and `mail` drivers now and `telegram` and `farapayamak` drivers scaffolded
   behind config flags (disabled). Queue retries. Tests for every rule.
4. Admin booking workflow: list ordered by urgency (emergency first, then
   newest), click-to-call and WhatsApp links, status transitions with notes
   and handler, "callback due" view, filters, CSV export, dashboard widget
   with today's numbers, bulk mark as spam.
5. Pricing and payment page (`/هزینه-و-پرداخت`): how pricing works, "from"
   prices where set, the featured insurers by name with «سایر بیمه‌ها», the
   financing options rendered only when enabled with the transparent
   surcharge note, an FAQ, and a booking CTA.
6. Restoration tiers page finalized: comparison that is readable on phones
   (swipeable cards) and desktop (three columns), selected tier highlighted
   in the warm token, booking CTA that carries the tier.
7. Analytics: GA4 loader gated behind a config value and loaded after
   `load`; events `call_click`, `whatsapp_click`, `booking_submit`,
   `booking_success`, `emergency_submit`, `directions_click`, `theme_toggle`,
   `tier_select`; a `data-track` attribute convention so editors never
   touch JS. Document in `docs/analytics.md`.
8. Privacy page draft covering what the booking form stores and who sees it.
9. Playwright e2e: booking happy path, validation errors, Persian digits
   input, duplicate within 10 minutes, emergency rate limit, modal keyboard
   use, no-JS form submission. Screenshots under `docs/qa/phase-05/`.
10. `docs/reports/phase-05.md`.

## Steps

1. Write the Form Requests and the normalization tests first, make them fail,
   then implement.
2. Build the modal with `<dialog>`, focus trap, Esc close, scroll lock, and
   return focus to the opener.
3. Build admin views in Filament with Persian labels and help texts.
4. Independent review of the whole pipeline for spam, abuse and data
   exposure; record and fix.
5. Screenshot, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- A valid phone in Persian digits with spaces submits successfully; a
  landline is rejected with a specific message; the honeypot and the time
  trap block silently; the fourth booking from one phone in a day is
  throttled with a friendly message.
- The form submits without JavaScript and shows the same success page.
- Emergency copy changes outside opening hours and never promises a slot.
- Financing options do not render while `enabled` is false; when enabled,
  the surcharge note is visible without scrolling on phones.
- All events fire once per interaction and never block navigation.
- No phone number appears in logs; the request id does.
- Lighthouse budgets hold on the booking page and the pricing page.

## Hand-off

Ask the client to test the booking flow on their own phone and to confirm the
emergency copy, the financing texts and the insurer names.
