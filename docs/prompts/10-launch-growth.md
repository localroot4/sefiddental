# Phase 10 - Launch and Growth

Put the site live safely and set up the first ninety days of growth. Think
like the DevOps engineer, SEO strategist, analytics engineer and project
manager. Production actions happen only after the client's explicit
confirmation inside this phase.

## Inputs

`docs/deploy.md`, `docs/seo/plan.md`, phase 9 report, hosting access details
from the client (never stored in the repository).

## Deliverables

1. Pre-launch checklist executed and recorded: production environment
   variables set on the platform from `.env.example`, PostgreSQL and object
   storage provisioned, domain attached, HTTPS certificate active, HSTS
   enabled after a successful HTTPS check, the platform scheduler or
   external ping configured for cron routes, backups scheduled, admin MFA
   enrolled, analytics id set, Search Console verification ready, an
   explicit yes from the client on the logo trace (or the original vector
   in its place) and on the 3D mark (gaps 1 and 34), and the R1 check
   passed: the live site fetched successfully from outside Iran and by the
   Search Console live test.
2. Deployment: run the pipeline to production; verify home at two tiers, a
   service page, booking from the cached home hero card and from the
   booking page (test submissions, then mark as spam), admin login,
   sitemap, robots, `/api/health`, redirects from the old URL map, OG
   preview, both themes, Lighthouse on the live site.
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

1. Dry run the whole launch against the staging target (built with the
   deploy pipeline once the hosting path is confirmed, brief decision 21).
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
- Sitemap submitted and accepted; robots correct; `/api/health` green; cron
  heartbeat green; backups ran once successfully in production.
- A real booking test reached the admin and the notifier.
- Rollback procedure documented and the previous deploy commit identified.

## Hand-off

Give the client the launch report summary in Persian and the first three
actions of the growth plan.
