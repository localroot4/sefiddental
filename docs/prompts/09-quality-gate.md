# Phase 09 - Quality Gate and Operations

Audit everything, fix everything, prove it, and make the system
observable and recoverable. Think like the QA lead, accessibility
specialist, security engineer, performance engineer, DevOps engineer and
the independent critic. Nothing new is designed; defects are removed and
operations are completed.

## Inputs

Everything built so far, every report, `docs/brief.md` section 7,
`docs/experience-direction.md` sections 3, 4 and 8.

## Deliverables

1. `docs/qa/audit-accessibility.md` - axe-core on every public template in
   both themes and all tiers of home; manual keyboard-only walkthrough of
   booking, emergency, navigation, the pinned scenes, the slider and the
   FAQ; screen reader order; focus visibility; target sizes; reduced
   motion; 200% zoom; color-only information. Every finding fixed or
   justified.
2. `docs/qa/audit-performance.md` - Lighthouse mobile and desktop for home
   at tiers 0 and 1, services hub, a service page, the restoration page, a
   dentist page, an article, booking, pricing, address, in both themes; lab
   Web Vitals; bundle sizes per page class; image and font weights; server
   response times; per-tier frame-time summaries from phase 8 re-run on the
   final build. Every budget met or the regression fixed.
3. `docs/qa/audit-seo.md` - scripted crawl: one H1, unique titles and
   descriptions within length, canonical, valid JSON-LD, breadcrumbs, no
   orphan pages, no broken internal links, sitemap and robots correct,
   redirects working, OG present, Persian slugs clean, the home content
   complete in the server HTML without JavaScript.
4. `docs/qa/audit-security.md` - headers and CSP, OWASP Top 10 walkthrough
   of forms and admin, rate limits verified by script, `npm audit` clean or
   justified, upload abuse tests, cookie flags, secrets scan of the history.
5. `docs/qa/audit-rtl-copy.md` - RTL inspection at all widths, copy
   self-audit (banned words, em dashes, one label per intent, terminology),
   dark mode audit.
6. Cross-browser: Playwright in Chromium, WebKit and Firefox; iOS Safari
   quirks (100dvh, safe areas, fixed elements with the keyboard open,
   `<dialog>`, WebGL 2 and DPR); the experience under each engine.
7. Operations completed: nightly PostgreSQL backup to object storage with
   retention and a verified restore runbook; log viewer in admin; the
   status view complete; error notifications deduplicated; maintenance
   page; anonymization of old bookings on a schedule; authorization matrix
   tests; `docs/admin-guide.fa.md` updated with the final screens.
8. Visual regression baseline: screenshots of every template at the three
   widths and both themes under `docs/qa/golden/` with a compare script.
9. Content gaps reconciled; nothing open reaches a visitor as a marker.
10. Independent review by a separate agent acting as an awards jury member
    and as a dental patient on a cheap phone in south Tehran: top ten
    issues, each fixed or consciously declined with a reason.
11. `docs/reports/phase-09.md` with one table: criterion, evidence, status.

## Steps

1. Run every automated audit first; fix in one batch.
2. Manual passes next; fix in one batch.
3. Re-run everything once; confirm; stop.

## Acceptance criteria

- Zero axe violations; no open blocker in the manual pass.
- All budgets met on every audited page and tier with evidence.
- SEO crawl has zero errors; home content is complete without JavaScript.
- Zero high or critical security findings; CSP without `unsafe-inline` or
  `unsafe-eval`.
- E2E suite green in all three engines.
- Backup restored once successfully on a fresh database.
- No `[[NEEDS_CLIENT]]` text reaches a visitor.

## Hand-off

Present the criterion-evidence-status table to the client and ask for the go
decision for launch.
