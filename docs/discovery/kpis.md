# KPI Tree

Baselines are unknown: the old site has no accessible analytics and the
clinic does not track call sources. The first 30 days after launch set the
baseline; targets are set in the first monthly report, not invented now.

## 1. North star

**Qualified appointment requests per week** = booking requests that the
receptionist marks as reached and not spam, plus first-time calls and WhatsApp
chats attributed to the site.

## 2. Tree

```
Qualified requests / week
├── Booking requests (form)          event booking_success, admin status != spam
│   ├── Booking opens                event booking_open
│   └── Form completion rate         booking_success / booking_open
├── Calls from the site              event call_click (proxy; real calls asked at reception)
├── WhatsApp chats from the site     event whatsapp_click
└── Emergency requests               event emergency_submit, admin flag

Supporting
├── Engagement on money pages        scroll to booking block, tier_select, case_slider_use
├── Local intent                     directions_click, contact page views
└── Content to service flow          article > service click-through (internal link click event)

SEO
├── Indexed pages                    Search Console coverage
├── Impressions and clicks           Search Console, brand vs non-brand split
├── Local pack presence              GBP insights: searches, calls, direction requests
├── Reviews                          GBP review count and average, monthly
└── Core Web Vitals (field)          Search Console CWV report
```

## 3. Definitions and measurement

| KPI | Definition | Source | Cadence |
|---|---|---|---|
| Booking requests | Forms submitted and stored | Admin bookings table, GA4 `booking_success` | weekly |
| Qualified bookings | Bookings with status contacted, scheduled or done | Admin | weekly |
| Booking completion rate | `booking_success` / `booking_open` | GA4 | weekly |
| Call clicks | Taps on any `tel:` link | GA4 `call_click` with `location` param | weekly |
| WhatsApp clicks | Taps on any WhatsApp link | GA4 `whatsapp_click` | weekly |
| Emergency requests | Emergency forms stored; share marked "not emergency" | Admin | weekly |
| Source of new patients | Reception asks «از کجا با ما آشنا شدید؟» and records it in admin | Admin field `heard_from` | monthly |
| Brand search | Search Console clicks for queries containing سفید | GSC | monthly |
| Non-brand clicks | Clicks for all other queries | GSC | monthly |
| Local actions | GBP calls, direction requests, website clicks | GBP Insights | monthly |
| Reviews | New reviews and average rating | GBP | monthly |
| Content output | Articles published with a reviewer and sources | Admin | monthly |
| Speed (field) | Share of good URLs for LCP, INP, CLS | GSC CWV | monthly |

Notes:

- `call_click` is a proxy. Add the `heard_from` field to the booking admin
  and ask callers; this is the only reliable way to attribute phone calls
  without a call-tracking service.
- GA4 conversions: `booking_success`, `call_click`, `whatsapp_click`,
  `emergency_submit`.
- Every event carries `page_type` (home, service, dentist, article, pricing,
  contact, other) and, where relevant, `service_key`.
- Analytics loads after the page `load` event and never blocks rendering. If
  GA4 is unreachable for some visitors, admin numbers stay the source of
  truth for bookings.

## 4. Review ritual

Weekly (receptionist, 10 minutes): bookings, response time, spam, emergency
misuse. Monthly (client, 30 minutes): the table above, top 10 queries, top 10
pages, new reviews, next month's content calendar. Template arrives in
phase 10 (`docs/seo/report-template.md`).
