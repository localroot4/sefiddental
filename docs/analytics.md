# Analytics

How the site measures what visitors do, without personal data. Sources:
`docs/conversion.md` section 9, `docs/discovery/kpis.md` section 3, phase 5
freeze decisions G8 and G16. Code: `src/lib/events/allowlist.ts`,
`src/lib/track/track.ts`, `src/lib/track/TrackListener.tsx`,
`src/app/(site)/api/events/route.ts`, `src/components/analytics/`.

## 1. Two channels, one truth

| Channel | What it is | Status |
|---|---|---|
| First-party counter | `navigator.sendBeacon` to `POST /api/events`, stored as daily totals in the `events-daily` collection | Always on. The source of truth. Works when GA4 is blocked or off |
| GA4 | Google Analytics 4, loaded after the page `load` event | Off by default. An admin turns it on (section 8) |

A form sent without JavaScript posts to the server, which counts
`booking_success` (and `emergency_submit` for a new emergency request) in
the counter itself (G8, `src/lib/booking/handler.ts`), unless the request
is flagged suspicious; GA4 never sees those. The bookings collection is the authority for booking counts: where
GA4 and the admin numbers disagree, the admin numbers win.

## 2. Event dictionary

"Stored" means the counter keeps the event with its four dimensions (date,
`location`, `pageType`, `serviceKey`). Every other parameter goes to GA4
only. Every event fires once per interaction and never blocks navigation.

| Event | Trigger | Parameters (GA4) | Sent from | GA4 conversion |
|---|---|---|---|---|
| `booking_open` | A «رزرو نوبت» CTA that routes in the page (dialog, scroll to the block, focus of the home hero field), or a view of the booking page (`location: page`). Never on view alone elsewhere | `location`, `service_key`, `tier` (tier CTAs) | `data-track` on the CTA; the hero field's first focus | no |
| `booking_submit` | A form submit that passed client validation, before the request | `location` (form instance: `hero`, `block`, `dialog`, `page`), `has_name`, `time_pref`, `tier` | booking form island | no |
| `booking_success` | The server stored the request | `duplicate` (true when appended to an earlier request) | booking form island; without JavaScript the server (counter only) | yes |
| `booking_error` | An inline or server error shown, one per error | `error_type` | booking form island | no |
| `call_click` | Any `tel:` link | `location`, `open_state` | `data-track` | yes |
| `closed_sheet_view` | The closed-hours sheet opened (after its `call_click`) | `location` | closed-hours sheet | no |
| `whatsapp_click` | Any WhatsApp link | `location` | `data-track` | yes |
| `directions_click` | A map app chosen | `location`, `provider` | `data-track` with `data-provider` | no |
| `emergency_submit` | The server stored an emergency request | `open_state`, `items_count` | emergency form island; without JavaScript the server (counter only, not for a repeat appended to an earlier request) | yes |
| `tier_select` | A restoration tier chosen (home scene 4, the restoration comparison on the restoration and pricing pages) | `location` (`tier`), `tier` | `HomeBookingPrefill` on `change` | no |
| `case_slider_use` | The first move of a before/after slider, by pointer or keys; once per slider per page view | `location`, `service_key` | `CompareSlider` | no |
| `save_contact` | The vCard downloaded from a success state | `location` | `data-track` | no |
| `content_to_service` | A plain link from a guide or an article to a service or service category page (both live under `/خدمات/<slug>`, so the URL cannot tell them apart) | `location` (`article`), `from_slug` | `TrackListener`, by the link target | no |
| `theme_toggle` | A manual theme change | `location`, `to` | theme button | no |

The `tel:115` link of the emergency safety box is not tracked.

## 3. Vocabularies

The code lists are the reference; a value outside them is mapped, not
stored as is.

- Locations (`EVENT_LOCATIONS`): header, hero, sticky, section, tier, aside,
  article, page, block, dialog, footer, drawer, mega_menu, faq, success,
  closed_sheet, none, other. Missing becomes `none`, unknown `other`.
- Page types (`PAGE_TYPES`), from `data-page-type` on the template root:
  home, service, category, services_hub, dentist, dentists_hub, cases,
  pricing, guide, guide_hub, article, articles, address, emergency, booking,
  booking_success, about, legal (the privacy page), system, other.
- Open states (`OPEN_STATES`): before-open, open, closing-soon, closed,
  holiday, unknown. Taken from the hours state of `/api/form-session`; until
  it arrives, or once it passed its change time, `unknown`.
- Error types (`error_type` of `booking_error`, one per error the form
  shows, `docs/conversion.md` 5.2): phone_empty, phone_invalid,
  phone_landline, note_too_long, name_too_long, expired (419), network,
  server (`ERROR_TYPES` in `allowlist.ts`).
- Providers (`PROVIDERS`): google, neshan, balad, waze.

## 4. Adding tracking

- Markup: `data-track="<event>"` and `data-tier` or `data-provider` on the
  element; `data-location`, `data-service-key` and `data-from-slug` on the
  element or any ancestor. `data-tier` is never inherited: `<html
  data-tier>` is the graphics quality tier. `TrackListener` (one delegated
  click listener, capture phase, nearest `[data-track]` only) reads them.
  Editors never touch JavaScript.
- Components: `ButtonLink`, `Button`, `TextLink` and `PhoneNumber` take
  `track={{ event, location, serviceKey }}`.
- From an island: `track(event, params)`. Pass `serviceKey` and `pageType`
  in camelCase; GA4 receives them as `service_key` and `page_type`.
- A new event name: add it to `EVENT_NAMES` with its row here. The counter
  stores names as text plus the code list, so no migration is needed.
  Add a unit test next to the sender (`src/lib/track/track.test.tsx` shows
  the patterns) and prove it can fail.

## 5. Personal data

- No phone number, name or note in any event, in either channel.
- `track()` drops parameter keys that look personal (`phone…`, `mobile`,
  `tel`, `e164`, name variants, `note…`, `email`) and runs `scrubPhones()`
  on every string value, as a safety net behind the rule above.
- The counter sets and reads no cookie, stores no IP address and logs none;
  the client address only names an in-memory rate-limit bucket.
- GA4 sets its own cookies while it is on; the privacy page then shows its
  GA4 paragraph (section 8).

## 6. Counter endpoint

`POST /api/events`:

| Aspect | Value |
|---|---|
| Body | One event or an array of 1 to 10, any content type (`text/plain` from `sendBeacon`), at most 2048 bytes (413 above) |
| Schema | `event` (64), `location` (64), `pageType` (64), `serviceKey` (128), all optional except `event`; extra keys dropped |
| Origin | Same-site only (`Sec-Fetch-Site` or `Origin` against `SITE_URL`); 403 otherwise |
| Limits | 60 events a minute per client, 3000 a minute per process; 429 with `Retry-After` |
| Normalization | Unknown event dropped; location `none` or `other`; page type `other`; a service key outside the published keys `none` |
| Day | Tehran calendar day |
| Storage | `events-daily`: one row per day, event, location, page type and service key, with a count; one atomic upsert per event |
| Answer | 204, `Cache-Control: no-store` |

The fallback when `sendBeacon` refuses is `fetch` with `keepalive: true` and
`credentials: 'omit'`. Failures are silent: measurement never breaks a page.

## 7. Admin numbers

`events-daily` is readable by admins only (editors do not see event
counts). The admin dashboard summary (phase 5 admin work) reads the counts
per event for today, 7 days and 30 days (Tehran days, Jalali labels), the
funnel `booking_open` to `booking_submit` to `booking_success`, and calls and
WhatsApp taps by location. A failed read shows «نامشخص», never 0.

## 8. GA4

Turning it on (admin, «تنظیمات» then «قابلیت‌ها»):

1. Create a GA4 property and a web data stream for the site (client step,
   gap 12). Turn on enhanced measurement with "page changes based on browser
   history events": links inside the site change pages without a reload.
2. Set «شناسهٔ GA4» to the stream's measurement id (`G-…`) and turn on
   «گوگل آنالیتیکس». Saving refuses an empty or malformed id.

What the site then does:

- The layout renders `Analytics`, which renders the `Ga4Loader` island only
  while both settings are valid. After the `load` event the island defines
  `window.dataLayer` and `window.gtag`, queues `js` and `config`, and adds
  one async script `https://www.googletagmanager.com/gtag/js?id=<id>`. No
  inline script: the CSP nonce plus `'strict-dynamic'` trusts a script the
  site's own bundle inserts.
- The proxy adds the GA4 hosts to the public CSP (`script-src
  https://www.googletagmanager.com`, `img-src` and `connect-src` for
  `*.google-analytics.com`, `*.analytics.google.com`,
  `*.googletagmanager.com`). After the setting changes, the CSP and the page
  can disagree for one proxy refresh window; GA4 hits may be blocked for
  that window. The regional collection host is not verified in a browser
  yet (phase 3 note).
- The privacy page shows its «گوگل آنالیتیکس» paragraph while GA4 is on.
- CI keeps GA4 off, so the Lighthouse third-party gate stays at 0.

In GA4:

- Mark as key events (conversions): `booking_success`, `call_click`,
  `whatsapp_click`, `emergency_submit`.
- Register event-scoped custom dimensions: `location`, `page_type`,
  `service_key`, `open_state`, `tier`, `error_type`, `provider`, `has_name`,
  `time_pref`, `duplicate`, `items_count`, `from_slug`, `to`.

## 9. KPI mapping and review ritual

| KPI (`docs/discovery/kpis.md`) | Read it from |
|---|---|
| Booking requests | Admin bookings list (authority); `booking_success` |
| Qualified bookings | Admin, status contacted, scheduled or done |
| Booking completion rate | Counter or GA4: `booking_success` / `booking_open` |
| Call clicks | `call_click` by `location`; a proxy, so reception records «از کجا با ما آشنا شدید؟» |
| WhatsApp clicks | `whatsapp_click` |
| Emergency requests | Admin bookings, emergency kind; the share marked «فوری نبود» |
| Source of new patients | Admin field `heardFrom` |

Weekly (reception, 10 minutes): bookings, response time, spam, emergency
misuse. Monthly (client, 30 minutes): the KPI table, top queries and pages,
reviews, next month's content.

## 10. QA

- Unit and DOM tests: `src/lib/events/allowlist.test.ts` (E ids),
  `src/lib/track/track.test.tsx` (TR, TL ids: beacon body, GA4 snake case,
  extra parameters, `open_state`, `content_to_service`),
  `src/components/ui/CompareSlider.test.tsx` (CM4),
  `src/components/home/restoration.test.tsx` (RS ids, `tier_select`),
  `src/components/analytics/Analytics.test.tsx` (GA ids), and
  `tests/int/events.int.test.ts` for the endpoint.
- Locally: open the browser's network panel, filter `events`, and click a
  tracked element; one request per interaction, body without personal data.
  With GA4 on, `window.dataLayer` lists the queued commands.
