# Phase 10 - Launch and Growth

Put the site live safely and set up the first ninety days of growth. Think
like the DevOps engineer, SEO strategist, analytics engineer and project
manager. Production actions happen only after the client's explicit
confirmation inside this phase.

## Inputs

`docs/deploy.md`, `docs/seo/plan.md`, phase 9 report, hosting access details
from the client (never stored in the repository).

## Deliverables

1. Pre-launch checklist executed and recorded: production `.env` prepared by
   the client from `.env.example`, database created, document root set to
   `public/`, PHP version and extensions confirmed with `ops:probe`, cron
   lines installed, HTTPS certificate active, HSTS enabled after a successful
   HTTPS check, backups scheduled, admin MFA enrolled, analytics id set,
   Search Console verification file or DNS record ready.
2. Deployment: run the pipeline to production; verify home, a service page,
   booking (test submission then mark as spam), admin login, sitemap, robots,
   `/up`, redirects from the old URL map, OG preview, both themes, Lighthouse
   on the live site.
3. Search and maps: submit the sitemap in Search Console; request indexing
   for the top pages; verify the Google Business Profile links to the site
   and booking page; confirm NAP consistency on Neshan and Balad.
4. Monitoring: uptime check through the cron heartbeat and an external ping
   if the client has one; error notifications live; a weekly digest to the
   admin with bookings, errors and Core Web Vitals field data when available.
5. `docs/launch-report.md` - what went live, when, verification results,
   rollback steps, and the first 30 days watch list (404s, coverage,
   rankings for brand and local terms, booking volume).
6. `docs/growth-plan.fa.md` - Persian 30, 60 and 90 day plan: review flow
   through SMS once Farapayamak is connected, content calendar for the next
   twelve weeks from the keyword map, Instagram to site links, local
   citations, before/after publishing cadence, monthly report ritual.
7. `docs/seo/report-template.md` - monthly report template.
8. Handover: `docs/handover.fa.md` - where everything lives, how to deploy,
   how to restore, how to add a dentist, how to turn financing on, who owns
   which account.
9. `docs/reports/phase-10.md`.

## Steps

1. Dry run the whole launch against a staging copy if the host allows a
   subdomain; otherwise rehearse locally with production settings.
2. Ask the client for the go in Persian with the exact list of irreversible
   actions. Proceed only after a clear yes.
3. Deploy, verify, and watch logs for thirty minutes.
4. Complete the search and maps steps with the client where their account is
   required.
5. Write the reports and the Persian guides.

## Acceptance criteria

- Live site passes the same Lighthouse budgets as staging on home, a service
  page and booking, in both themes.
- Old URLs redirect with 301 to the mapped pages; no 404 in the imported map.
- Sitemap submitted and accepted; robots correct; `/up` green; cron heartbeat
  green; backups ran once successfully in production.
- A real booking test reached the admin and the notifier.
- Rollback procedure documented and the previous deploy commit identified.

## Hand-off

Give the client the launch report summary in Persian and the first three
actions of the growth plan.
