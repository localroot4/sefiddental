# Phase 01 - Discovery and Strategy

No application code in this phase. Output is documents the whole project
depends on. Think like the UX researcher, SEO strategist, conversion
specialist and project manager at once.

## Inputs

All sources of truth in `00-master.md` section 2, especially
`content/reference/old-site/` (five screenshots of the current site) and
`docs/content/*.yaml`.

## Deliverables

1. `docs/discovery/old-site-audit.md` - what the old site does, what works
   (the three real testimonial videos, the restoration tiers idea, the
   positioning line), what fails (AI-looking people photos, broken empty
   embeds, generic copy, no dentist profiles, weak hierarchy, no emergency
   path, no pricing transparency), inferred SEO weaknesses, and what to
   preserve (facts, positioning, service taxonomy).
2. `docs/discovery/personas-and-journeys.md` - the five personas from the
   brief made concrete: goals, fears, triggers, device, entry query, decision
   path, objections and the exact page element that answers each objection.
3. `docs/discovery/kpis.md` - KPI tree: primary (booking submissions, calls,
   WhatsApp chats), secondary (emergency requests, direction clicks, scroll
   depth to booking, blog to service click-through), SEO (indexed pages,
   impressions, local pack presence, reviews count). Baseline unknown; define
   how each is measured (GA4 event names from `docs/seo/plan.md`).
4. `docs/seo/keyword-map.md` - expand the seed clusters in `docs/seo/plan.md`
   into a page-to-keyword map: for each planned URL the primary term, 3-6
   secondary terms, search intent, and the H1 and title-tag draft. Mark
   volumes as unknown unless a tool is reachable; never invent numbers.
5. `docs/ia.md` - information architecture: full sitemap with Persian slugs,
   template per page, primary navigation (max 5 items plus CTA), mega-menu
   grouping for services, footer map, breadcrumb rules, internal-linking
   rules, and a wireframe-level description of each template's sections in
   order (which layout family from `docs/design-direction.md` section 6).
6. `docs/conversion.md` - CTA map per template (one primary per section),
   the booking flow and the emergency flow as step lists with the exact
   fields and microcopy, the thank-you experience, the sticky mobile bar
   behavior, the WhatsApp message prefill text, and the analytics events for
   each interaction.
7. `docs/content/shot-list.fa.md` - Persian photo and video shot list the
   client can hand to a photographer, grouped by location, with orientation
   and purpose for each shot.
8. `docs/seo/gbp-setup.fa.md` - Persian step-by-step guide to create and
   complete the Google Business Profile, the exact NAP to use, categories,
   photos to upload, and how to ask patients for reviews without bursts.
9. `docs/discovery/risks.md` - risk register with mitigation and owner:
   hosting capabilities, missing assets, content cadence, medical advertising
   rules, performance on slow networks, sanctions-related service blocks.
10. `docs/reports/phase-01.md` per the template.

## Steps

1. Study the five screenshots carefully. Record every fact visible (menu
   items, stats, address, phones, hours, headlines) and compare with
   `docs/content/clinic.yaml`. Flag conflicts in `docs/content/gaps.md`.
2. Try to fetch `https://sefiddental.ir` and competitor sites. If the network
   blocks them, say so and work from the screenshots and the brief.
3. Write the deliverables. Keep each document scannable: tables and short
   lists, no essays.
4. Review your own IA against Hick's law (nav items), the thumb zone (mobile
   actions), and the quality bar (one H1, one primary CTA per section).
5. Update `docs/content/gaps.md` with anything newly discovered.

## Acceptance criteria

- Every planned URL has a primary keyword, template, H1 draft and title draft.
- The home page section order uses at least five layout families and no
  family more than twice.
- The booking flow completes in one screen with at most one required field.
- The emergency flow has triage, a call-first path during hours, the safety
  line about ۱۱۵, and a rate-limit rule.
- No invented numbers anywhere. Unknown volumes are marked unknown.
- Persian documents follow the copy guidelines and contain no em dashes.

## Hand-off

In the Persian reply, ask the client at most five questions whose answers
change phase 2 or 3, and list the client actions: start the GBP setup, send
the dentists list, send photos or schedule the shoot, send hosting facts.
