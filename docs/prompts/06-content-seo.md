# Phase 06 - Content and SEO Engine

Build the blog and editorial system, finish structured data, and write the
real content for services and the first articles. Think like the SEO
strategist, Persian medical copywriter, dental content reviewer and Filament
engineer.

## Inputs

`docs/seo/plan.md`, `docs/seo/keyword-map.md`, `docs/content/
copy-guidelines.md`, `docs/content/services.yaml`, previous reports, the old
site backup if the client provided it.

## Deliverables

1. Blog: categories, tags, posts with rich text (headings, images with
   required alt, callouts, tables, embedded video posters), cover image,
   author (dentist or staff), reviewer (dentist), sources list, reading time,
   table of contents generated from headings, related posts and services,
   share links, RSS, pagination, category and tag pages, Jalali dates,
   `Article` and `FAQPage` schema.
2. Editorial system in admin: SEO fields with live validators (title and
   description length, Persian slug, cover alt, reviewer required for medical
   content, sources required when the post makes medical claims, at least
   two internal links), SERP preview, scheduling, draft and review states,
   the Persian text normalizer on save, an editorial calendar view, and a
   Persian "how to write a post" checklist page inside admin.
3. Patient guide hub (`/راهنمای-بیمار`) and three guides written with
   sources: اولین مراجعه چگونه است، ترس از دندانپزشکی و راه‌های کنترل آن،
   مراقبت‌های بعد از درمان (per treatment group).
4. Final Persian copy for every service page and the restoration tiers,
   evidence-based, with sources and `reviewed_by` left as `[[NEEDS_CLIENT]]`
   until the client assigns dentists; FAQs per service (5-8 real questions).
5. Six seed articles mapped to the keyword map (one per money-making
   service plus one local piece), each following the article template.
6. Structured data completed and validated for every template; OG image
   generation per page type with Persian text rendered correctly; sitemap
   index with all content types; `robots.txt`.
7. Redirects: import tool for the old URL map (CSV), the `/vip` alias, and
   the automatic 301 on slug change, all tested.
8. Internal linking: related services, related articles, breadcrumbs,
   "dentists who perform this" on services, "articles reviewed" on dentists.
9. Playwright screenshots of blog index, a post, a guide, a category page at
   the three widths in both themes under `docs/qa/phase-06/`; Lighthouse
   within budgets on a post.
10. `docs/content/editorial-guide.fa.md` - Persian guide for the receptionist
    and the client: how to plan topics, write, add sources, choose images,
    fill SEO fields and publish.
11. `docs/reports/phase-06.md`.

## Steps

1. Build the content model and admin first, then the templates.
2. Write content in Persian with the copy guidelines open. Every clinical
   claim gets a source from ADA, AAPD, AAP, Cochrane, NHS or a peer-reviewed
   paper. No banned words. No invented clinic facts.
3. Validate schema with Google's tool if reachable, otherwise with a
   validator in CI; store results in the report.
4. Independent review of the medical content by a separate agent acting as a
   dentist reviewer: accuracy, missing risks, overclaims. Fix.
5. Screenshot, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- Publishing is blocked until the editorial checklist passes; the block
  message says exactly what to fix.
- Every service page has final copy, FAQs, sources and a reviewer field.
- Every article has author, reviewer, sources, updated date, TOC, one CTA,
  and valid `Article` schema.
- Sitemap lists every published URL once with correct lastmod; robots
  references it; RSS validates.
- The old-URL import creates 301s that tests verify; `/vip` redirects.
- A post page passes the Lighthouse budgets with a cover image and video
  poster.

## Hand-off

Ask the client to assign reviewer dentists per service, to send the old URL
list if not yet sent, and to read the editorial guide.
