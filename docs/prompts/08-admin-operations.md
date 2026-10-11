# Phase 08 - Admin Experience and Operations

Make the admin a pleasure for a receptionist and make the system observable
and recoverable. Think like the Filament engineer, UX writer, DevOps engineer
and the receptionist who will use it every day.

## Inputs

`docs/architecture.md` sections 4, 5 and 9, phases 3, 5 and 6 reports,
`docs/content/editorial-guide.fa.md`.

## Deliverables

1. Admin polish in Persian: every label, help text, empty state, validation
   message and notification written per the copy guidelines; navigation
   grouped by daily tasks (نوبت‌ها، محتوا، بیماران و نظرات، تنظیمات، سیستم);
   dashboard with today's bookings, callbacks due, emergency flags, content
   calendar, SEO health (pages missing descriptions, images missing alt,
   broken internal links), and open content gaps.
2. Roles verified: admin everything; editor posts, cases, testimonials,
   bookings only. Activity log readable, filterable, with before and after
   values.
3. Media manager: upload with drag and drop, alt text required, focal point,
   usage list, regenerate conversions action.
4. Settings UI: contact and hours (with holiday overrides), socials, legal
   (license, supervisor), SEO defaults, feature flags (financing options,
   emergency, intro animation, analytics id), notifier configuration with a
   "send test" action per driver.
5. Operations: nightly database backup command with retention and a restore
   runbook, log viewer in admin (last errors, request id search),
   `System status` page completed (PHP, extensions, queue, cron heartbeat,
   last deploy SHA, disk, failed jobs, cache), error notifications
   deduplicated per signature per hour, maintenance mode toggle with the
   branded page.
6. Data hygiene: bookings older than a configurable number of months are
   anonymized by a scheduled command; export respects roles.
7. `docs/admin-guide.fa.md` - Persian guide with screenshots for the
   receptionist: handle a booking, handle an emergency, publish a post, add a
   case with consent, update hours for a holiday, what the status page means,
   who to call when something is red.
8. Tests: authorization matrix, backup command, anonymization command, settings
   validation, notifier test action; Playwright screenshots of the key admin
   screens at 1440 and 820 under `docs/qa/phase-08/`.
9. `docs/reports/phase-08.md`.

## Steps

1. Walk every admin screen as the editor role, then as admin; write down
   every friction point; fix them.
2. Write the Persian guide while walking the flows; screenshot each step.
3. Independent review focused on authorization and data exposure.
4. Screenshot, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- A receptionist can complete every task in the guide without touching code
  or asking a developer.
- No English string is visible to the editor role.
- The authorization matrix test proves the editor cannot reach settings,
  users, redirects or system pages.
- Backup runs on schedule, restore runbook verified once on a fresh database.
- Status page turns red on a stopped cron within 5 minutes and the admin
  receives one notification, not many.

## Hand-off

Ask the client to let the receptionist try the guide and send back any step
that was unclear.
