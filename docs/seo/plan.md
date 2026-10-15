# SEO Plan

## 1. Reality check

| Query type | Examples | Realistic time to page 1 |
|---|---|---|
| Brand | سفید دنتال، کلینیک سفید، کلینیک دندانپزشکی سفید | weeks after indexing |
| Local | دندانپزشکی خانی‌آباد، کلینیک دندانپزشکی خانی‌آباد نو، دندانپزشکی جنوب تهران | 1-3 months with Google Business Profile, citations and reviews |
| Service plus area | ایمپلنت دندان جنوب تهران، لمینت دندان خانی‌آباد، کامپوزیت دندان شهرری | 3-6 months with dedicated pages and links |
| Competitive service | ایمپلنت دندان تهران، لمینت دندان، قیمت کامپوزیت دندان | 6-12 months or more, content and authority dependent |

The site is a YMYL (Your Money or Your Life) topic. Google expects
experience, expertise, authoritativeness and trust: named dentist authors with
council numbers, reviewer boxes, sources, updated dates, clear contact and
license information. Thin or unreviewed medical articles hurt rankings.

## 2. Keyword map (seed, Persian)

Clusters to expand in phase 1 with volumes where tools are reachable:

- Brand: سفید دنتال، کلینیک سفید، دندانپزشکی سفید، sefid dental
- Local: دندانپزشکی خانی‌آباد نو، کلینیک دندانپزشکی خانی‌آباد، دندانپزشکی میعاد
  شمالی، دندانپزشکی جنوب تهران، دندانپزشکی نازی‌آباد، دندانپزشکی یافت‌آباد،
  دندانپزشکی شهرری، دندانپزشکی شبانه، دندانپزشکی اورژانس جنوب تهران
- Cosmetic: لمینت سرامیکی، قیمت لمینت دندان، کامپوزیت دندان، ونیر کامپوزیت،
  بلیچینگ دندان، سفید کردن دندان، بستن دیاستم، فاصله بین دندان‌ها، لیفت لثه،
  اصلاح طرح لبخند، طراحی لبخند دیجیتال
- Restorative: ایمپلنت دندان، قیمت ایمپلنت، اوردنچر، روکش دندان، روکش زیرکونیا،
  ترمیم دندان، کامپوزیت ترمیمی، اینله آنله، عصب‌کشی، درمان ریشه، جرم‌گیری،
  کشیدن دندان عقل، جراحی لثه
- Ortho and kids: ارتودنسی، ارتودنسی نامرئی، دندانپزشکی کودکان، دندانپزشکی
  اطفال جنوب تهران
- Money and trust: قیمت دندانپزشکی، دندانپزشکی طرف قرارداد بیمه ایران،
  دندانپزشکی با وام، وام دندانپزشکی، اعتبار دندانپزشکی
- Informational (blog): درد بعد از عصب‌کشی، مراقبت بعد از ایمپلنت، تفاوت لمینت و
  کامپوزیت، ترس از دندانپزشکی، دندان شیری کودک

## 3. URL structure

The full sitemap with templates and index rules is `docs/ia.md` section 1.
Summary: services are flat under `/خدمات/{slug}` (category in the
breadcrumb, not the URL); category hubs are `/خدمات/زیبایی`,
`/خدمات/جراحی-و-جایگزینی-دندان`, `/خدمات/درمان-دندان`; articles live under
`/مقالات`; `/vip` is a 301 alias to the restoration tiers.

Rules: one H1 per page carrying the primary term naturally. Title tag 50-60
characters, pattern `{موضوع} | کلینیک دندانپزشکی سفید`. Meta description
120-160 characters with a reason to click and the area name where relevant.
Breadcrumbs on every inner page. Internal links: every service page links to
its category, two related services, the dentists who perform it, the pricing
page and two articles. Every article links to one service page and one guide.

## 4. Structured data per template

| Template | JSON-LD |
|---|---|
| All pages | `Dentist` with name, address, geo, telephone, openingHoursSpecification, sameAs, logo, image |
| Service | `Service` (provider = Dentist) plus `FAQPage` plus `BreadcrumbList` |
| Dentist | `Physician` with medicalSpecialty, memberOf (the clinic), image and identifier (council number); never worksFor, which is a `Person` property while schema.org types `Physician` as an organization |
| Blog post | `Article` with author (Person), reviewedBy, datePublished, dateModified, image; `FAQPage` when FAQs exist |
| Gallery | `ImageGallery` or `ItemList` |
| Testimonial sections (home, about, service pages) | `VideoObject` per video with transcript summary |

Validate with Google's Rich Results Test when the network allows; otherwise
with a schema validator in CI.

## 5. Local SEO

1. Create the Google Business Profile: category "Dental clinic", secondary
   "Cosmetic dentist", "Dental implants provider", "Pediatric dentist",
   "Orthodontist". NAP identical to the site, hours identical, website link,
   booking link to `/رزرو-نوبت`, real photos (exterior, reception, rooms, team),
   services with descriptions, weekly posts.
2. Keep Neshan and Balad listings identical (name, address, phone, hours).
3. Review engine: after each visit, the receptionist sends the review link
   (later automated through SMS). Target a steady flow, never bursts. Reply
   to every review.
4. Citations in Iranian directories and medical listings with identical NAP.
5. Area pages only when they carry unique, useful content (directions, parking,
   patients from that area, specific services). No doorway pages.

## 6. Content engine

- Cadence: one article every 2-3 days as the client requested, with a quality
  gate: a dentist reviewer and sources for every medical claim. Fewer, better
  articles beat daily thin posts.
- Topic clusters per service: pillar page = the service page; cluster = guides,
  costs, aftercare, comparisons, myths, case stories.
- Article template: title with the primary term, 2-line summary, table of
  contents, H2 sections answering real questions, images with alt, FAQ block,
  sources list (ADA, AAPD, AAP, Cochrane, NHS, peer-reviewed journals), author
  box, reviewer box, updated date, one CTA.
- Admin checklist blocks publishing until: title and description lengths are
  right, slug is Persian and short, cover image has alt, reviewer is set,
  at least two internal links, sources present when medical.
- Persian text normalizer on save: Arabic letters to Persian, ZWNJ fixes,
  Persian digits, quotation marks, spacing around punctuation.

## 7. Migration from the old site

1. Obtain the backup. Extract every indexable URL (sitemap, database, server
   logs if present).
2. Map each old URL to the best new page. Unmapped URLs go to the closest hub,
   never to the home page in bulk.
3. Import the 301 map into the redirects manager before launch.
4. After launch: verify in Search Console (coverage, redirects), submit the
   sitemap, fix 404s weekly for the first two months.

## 8. Measurement

- Search Console: queries, pages, coverage, Core Web Vitals, enhancements.
- GA4 events and conversions: `docs/conversion.md` section 9.
- KPI tree and review ritual: `docs/discovery/kpis.md`.
- Monthly report template in `docs/seo/report-template.md` (phase 10).
