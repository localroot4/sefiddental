# Phase 06 - Content and SEO Engine

Date: 2026-10-18 to (open).

## Plan (written before building)

What: the articles engine (hub, post, category and tag pages, RSS,
pagination, `Article` and `FAQPage` data), the editorial system in Payload
(live validators, SERP preview, live preview, scheduling, review states,
the Persian normalizer on save, an editorial calendar, a writing
checklist), the admin polish for the receptionist (Persian everywhere,
navigation by daily task, dashboard widgets, media rules), final Persian
copy with sources for every service and the tiers, three patient guides,
six seed articles, structured data and OG images for every template, the
old-URL import with the `/vip` alias and slug-change redirects, internal
linking, the cases page that the menus already link, the editorial and admin
guides, screenshots and Lighthouse on a post.

Order:

1. Wave 0 (integrator): pending test keys, gap rows 58 to 63, this section.
2. Wave 1a, engineering lanes in parallel with disjoint files: MODEL
   (validators, blocks, normalizer, review states, checklist, SERP preview),
   SEED (YAML schemas, copy checks, the `[text](/path)` link syntax,
   articles seeding), SEO (metadata, JSON-LD with `schema-dts` checks, OG
   cards, sitemaps, RSS, pagination), REDIRECTS (CSV import with a dry run,
   the `/vip` fragment fix), ADMIN (navigation, dashboard widgets, calendar,
   Jalali dates, the no-English test), TEMPLATES step 1 (routes, readers,
   hub, post, category, tag, internal links, the QA fixture).
3. Wave 1b, after SEED's checks and once the source sites are reachable:
   three copy lanes (services, guides, articles). Each source is opened
   before it is cited.
4. Integration I1: generated files, one migration per adapter (the Media
   `og` size only), lint, tests, build, e2e, bundle.
5. Wave 2: an independent reviewer acting as a dentist reads every text
   against its sources (prompt step 4), the copy lanes fix; TEMPLATES step 2
   (block converters, live preview, cases page); an independent security
   review of the preview path, the CSV import and the approval access; the
   editorial guide.
6. Wave 3: accessibility, screenshots, Lighthouse on the QA post, the admin
   guide with screenshots. Then screenshot, inspect, fix in one batch,
   confirm, stop (prompt step 5); report, commit, push, CI green.

Main decisions (the full freeze table goes into Decisions when the phase
closes): article URLs as `docs/ia.md`; 12 items a list page, self-canonical
pages 2 and up; a category is indexable from 5 published articles, a tag
never; every article (not only medical ones) needs an approved review by a
published dentist, a review date, sources and two live internal links (one
service, one guide) before it publishes, and only an admin can approve;
live preview renders drafts on the server for TOTP-verified staff and ships
no public JavaScript; OG cards are rendered once per page type by a real
browser (Persian shaping) and committed, never on the shared host; the old
URL import is an admin upload with a dry run, because the cPanel host has
no known shell; client facts are never invented (YAML `# NEEDS_CLIENT`
comments and gap rows).

Deviation recorded now: TEMPLATES step 1 runs in parallel with MODEL,
against contracts fixed before wave 1 (block shapes, readers, preview URL),
where the prompt says model and admin first.

Risks: the content-page scripts gate has about 100 bytes of headroom on the
service page, so public templates add no client JavaScript; a preview path
that leaks drafts; the approval gate slowing the receptionist; the
rich-text normalizer at formatting boundaries; 15 to 25 thousand words of
medical copy under the copy rules; the source sites are blocked from the
build network until the client allows them; new text reaching a live site
that already runs needs the client's yes (a backup first, a fill-empty step
off by default).
