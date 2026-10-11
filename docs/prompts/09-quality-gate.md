# Phase 09 - Quality Gate

Audit everything, fix everything, prove it. Think like the QA lead, the
accessibility specialist, the security engineer, the performance engineer and
the independent critic. Nothing new is designed in this phase; defects are
removed.

## Inputs

Everything built so far, every report, `docs/brief.md` section 7.

## Deliverables

1. `docs/qa/audit-accessibility.md` - axe-core results for every public
   template in both themes, plus a manual pass: keyboard-only walkthrough of
   booking, emergency, navigation, slider and FAQ; screen reader order check;
   focus visibility; target sizes; reduced motion; zoom to 200%; color-only
   information check. Every finding fixed or justified.
2. `docs/qa/audit-performance.md` - Lighthouse mobile and desktop for home,
   services hub, a service page, the restoration page, a dentist page, a
   post, booking, pricing, contact, in both themes; Web Vitals lab numbers;
   bundle size table; image weight table; font bytes; server response times.
   Every budget met or the regression fixed.
3. `docs/qa/audit-seo.md` - crawl of the site with a script: every page has
   one H1, unique title and description within length, canonical, valid
   JSON-LD, breadcrumbs, no orphan pages, no broken internal links, sitemap
   and robots correct, redirects working, OG tags present, Persian slugs
   clean.
4. `docs/qa/audit-security.md` - headers and CSP check, OWASP Top 10
   walkthrough of forms and admin, rate limits verified by script,
   `composer audit` and `npm audit` clean or justified, upload abuse tests,
   session and cookie flags, secrets scan of the repository history.
5. `docs/qa/audit-rtl-copy.md` - RTL inspection at all widths (alignment,
   mirroring, LTR islands, punctuation, ZWNJ, digits), copy self-audit for
   banned words and em dashes, one label per intent, consistent terminology.
6. Cross-browser: Playwright runs in Chromium, WebKit and Firefox for the
   e2e suite; iOS Safari quirks checked (100dvh, safe areas, position fixed
   with the keyboard open, `<dialog>` behavior).
7. Visual regression baseline: screenshots of every template at the three
   widths and both themes stored as the golden set under `docs/qa/golden/`
   and a script to compare future runs.
8. Content gaps: `docs/content/gaps.md` reconciled; anything still open is
   hidden gracefully in the UI, never shown as a marker to visitors.
9. Independent review by a separate agent acting as an award jury member and
   as a dental patient on a cheap phone: top ten issues, each fixed or
   consciously declined with a reason in the report.
10. `docs/reports/phase-09.md` with a single table: criterion, evidence,
    status.

## Steps

1. Run every automated audit first and fix in one batch.
2. Do the manual passes next, fix in one batch.
3. Re-run everything once; confirm; stop.

## Acceptance criteria

- Zero axe violations; the manual accessibility pass has no open blocker.
- All budgets in `docs/brief.md` section 7 met on every audited page in both
  themes, with evidence.
- SEO crawl has zero errors.
- Security audit has zero high or critical findings; CSP has no
  `unsafe-inline` or `unsafe-eval`.
- E2E suite green in all three browsers.
- No `[[NEEDS_CLIENT]]` text reaches a visitor.

## Hand-off

Present the single criterion-evidence-status table to the client and ask for
the go decision for launch.
