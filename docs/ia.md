# Information Architecture

Final for v1 unless the client objects at the phase 1 gate. Supersedes the
URL draft in `docs/seo/plan.md` section 3 (updated in the same commit).
Keywords per URL: `docs/seo/keyword-map.md`. Conversion details:
`docs/conversion.md`. Layout family codes A-J: `docs/design-direction.md`
section 6; this file adds K and L below.

## 1. Sitemap

| URL | Page | Template | Index |
|---|---|---|---|
| `/` | خانه | T-home | yes |
| `/خدمات` | همهٔ خدمات | T-services-hub | yes |
| `/خدمات/زیبایی` | خدمات زیبایی دندان | T-category | yes |
| `/خدمات/جایگزینی-دندان` | جایگزینی دندان | T-category | yes |
| `/خدمات/درمان-دندان` | درمان و نگهداری دندان | T-category | yes |
| `/خدمات/لمینت-سرامیکی` | لمینت سرامیکی | T-service | yes |
| `/خدمات/کامپوزیت-دندان` | ونیر کامپوزیت | T-service | yes |
| `/خدمات/بلیچینگ-دندان` | بلیچینگ دندان | T-service | yes |
| `/خدمات/بستن-دیاستم` | بستن دیاستم | T-service | yes |
| `/خدمات/لیفت-لثه` | لیفت لثه | T-service | yes |
| `/خدمات/طراحی-لبخند` | اصلاح طرح لبخند | T-service | yes |
| `/خدمات/ایمپلنت-دندان` | ایمپلنت دندان | T-service | yes |
| `/خدمات/اوردنچر` | اوردنچر | T-service | yes |
| `/خدمات/جراحی-دندان-و-فک` | جراحی فک و دندان | T-service | yes |
| `/خدمات/جراحی-لثه` | جراحی لثه | T-service | yes |
| `/خدمات/ترمیم-دندان` | ترمیم دندان (معمولی، VIP، CIP) | T-service-tiers | yes |
| `/خدمات/جرم-گیری` | جرم‌گیری دندان | T-service | yes |
| `/خدمات/درمان-ریشه` | درمان ریشه | T-service | yes |
| `/خدمات/روکش-دندان` | روکش دندان | T-service | yes |
| `/خدمات/اینله-و-آنله` | اینله و آنله | T-service | yes |
| `/خدمات/کشیدن-دندان` | کشیدن دندان | T-service | yes |
| `/خدمات/ارتودنسی` | ارتودنسی | T-service | yes |
| `/خدمات/دندانپزشکی-کودکان` | دندانپزشکی کودکان | T-service | yes |
| `/vip` | alias | 301 to `/خدمات/ترمیم-دندان#سطح-ترمیم` | no |
| `/پزشکان` | پزشکان | T-dentists-hub | yes |
| `/پزشکان/{slug}` | one per dentist | T-dentist | yes |
| `/قبل-و-بعد` | قبل و بعد | T-cases | yes |
| `/هزینه-و-پرداخت` | هزینه و پرداخت | T-pricing | yes |
| `/راهنمای-بیمار` | راهنمای بیمار | T-guide-hub | yes |
| `/راهنمای-بیمار/اولین-مراجعه` | اولین مراجعه | T-guide | yes |
| `/راهنمای-بیمار/ترس-از-دندانپزشکی` | ترس از دندانپزشکی | T-guide | yes |
| `/راهنمای-بیمار/مراقبت-بعد-از-درمان` | مراقبت بعد از درمان | T-guide | yes |
| `/اورژانس` | درد شدید و اورژانس | T-emergency | yes |
| `/درباره-ما` | درباره ما | T-about | yes |
| `/تماس` | تماس و مسیر | T-contact | yes |
| `/رزرو-نوبت` | رزرو نوبت | T-booking | yes |
| `/رزرو-نوبت/ثبت-شد` | درخواست ثبت شد | T-booking-success | no |
| `/مقالات` | مقالات | T-articles | yes |
| `/مقالات/{slug}` | one per article | T-article | yes |
| `/مقالات/دسته/{slug}` | article category | T-articles | yes |
| `/مقالات/برچسب/{slug}` | article tag | T-articles | noindex, follow |
| `/حریم-خصوصی` | حریم خصوصی | T-legal | yes |
| `/panel` | admin | Filament | blocked in robots |
| `/up` | health | system | no |

URL rules:

- Services are flat under `/خدمات/{slug}`; the category lives in the
  breadcrumb, not in the URL. Reason: shorter links when shared in WhatsApp
  (each Persian letter becomes six characters when encoded), and a service
  can move between categories without a redirect. Slugs are unique across
  categories and services.
- Orthodontics and pediatric dentistry are services without a category page;
  they appear directly in the hub and the menu.
- The label for articles is «مقالات» in the UI and the URL. Patients search
  for "مقاله", not "بلاگ"; one term, used everywhere.
- Area pages (for example نازی‌آباد) are out of v1; add them only with unique
  content (directions, patients from that area), never as doorway pages.

## 2. Primary navigation

Desktop (one line, max 72 px high, RTL so items start at the right):

```
[logo]  خدمات ▾   پزشکان   قبل و بعد   هزینه و پرداخت   تماس        [theme] [۰۲۱ ۵۵۱۰ ۱۰۵۴] [رزرو نوبت]
```

- Five items, matching the decision path: what you do, who does it, proof,
  money, where. Articles, guides, about and emergency live in the mega menu
  footer row, the phone drawer and the site footer. Article traffic arrives
  from search, not from the nav.
- The phone number is a real `tel:` link, LTR island, hidden below 1280 px
  where the call icon remains.
- Active page: the long-bar motif under the item.

Services mega menu (opens on click or keyboard; hover intent only adds a
preview on fine pointers):

```
| زیبایی              | جایگزینی دندان       | درمان و نگهداری      | سایر خدمات            |
| لمینت سرامیکی       | ایمپلنت دندان        | ترمیم دندان (VIP/CIP)| ارتودنسی              |
| ونیر کامپوزیت       | اوردنچر              | روکش دندان           | دندانپزشکی کودکان     |
| بلیچینگ دندان       | جراحی فک و دندان     | درمان ریشه           |                       |
| بستن دیاستم         | جراحی لثه            | جرم‌گیری              | [همهٔ خدمات]           |
| لیفت لثه            |                      | اینله و آنله         |                       |
| اصلاح طرح لبخند     |                      | کشیدن دندان          |                       |
|------------------------------------------------------------------------------------|
| راهنمای بیمار   مقالات   درد شدید دارید؟ اورژانس                                   |
```

Money services sit first in each column. Category titles link to category
pages.

Phone header: logo, call icon button, menu button. Phone drawer (full
screen, focus trapped, Esc and close button, 48 px rows, two levels max):

1. «رزرو نوبت» (primary) and «تماس با کلینیک» side by side
2. خدمات: three accordion groups, then ارتودنسی and دندانپزشکی کودکان as
   direct links, then «همهٔ خدمات»
3. پزشکان، قبل و بعد، هزینه و پرداخت
4. راهنمای بیمار، مقالات، درباره ما، تماس
5. «درد شدید دارید؟» link to the emergency page, with the warning token
6. Theme toggle and socials

Phone sticky bar: «تماس» | «واتساپ» | «رزرو نوبت». Behavior in
`docs/conversion.md` section 4.

## 3. Footer

```
| کلینیک دندانپزشکی سفید        | خدمات پرطرفدار      | کلینیک           | راهنما             |
| one-line description          | لمینت سرامیکی       | پزشکان           | راهنمای بیمار      |
| address                       | ونیر کامپوزیت       | قبل و بعد        | اولین مراجعه       |
| phones (LTR)                  | ایمپلنت دندان       | هزینه و پرداخت   | مقالات             |
| hours                         | روکش دندان          | درباره ما        | اورژانس            |
| مسیریابی: Google, Neshan,     | ترمیم دندان         | تماس             | حریم خصوصی         |
| Balad, Waze                   | همهٔ خدمات           |                  |                    |
|--------------------------------------------------------------------------------------------|
| socials        license number, technical supervisor        © ۱۴۰۵ کلینیک دندانپزشکی سفید    |
```

Phones: one column, the four groups as `<details>` disclosures except the
NAP block, which is always open.

## 4. Breadcrumbs

On every page except home, booking success and system pages. Visible under
the header, `BreadcrumbList` JSON-LD with the same items.

- Service: خانه / خدمات / {category} / {service}; standalone services skip the
  category.
- Dentist: خانه / پزشکان / {name}. Article: خانه / مقالات / {category} /
  {title}. Guide: خانه / راهنمای بیمار / {title}.
- Phones: show only the parent link with a back chevron (mirrored in RTL).

## 5. Internal linking rules

| From | Must link to |
|---|---|
| Service | its category (breadcrumb), 2-3 related services, dentists who perform it, pricing page, 2 related articles, cases of this service |
| Category | all its services, the pricing page, one guide |
| Dentist | services performed, articles authored or reviewed, cases |
| Article | one primary service (in the body and the end CTA), one guide, 2 related articles |
| Guide | the services it mentions, booking |
| Pricing | the restoration page, the three money services, booking |
| Home | every category, the restoration page, dentists hub, cases, first-visit guide |

Anchor text is descriptive Persian («هزینه و شرایط لمینت سرامیکی»), never
«اینجا کلیک کنید». Phase 6 adds an admin check for at least two internal
links per article.

## 6. Templates and section order

New layout families beyond A-J:

- **K, reading column:** long-form text, 62ch measure, optional sticky table
  of contents on desktop, callouts, sources. Read mode.
- **L, focused task:** one task per screen, minimal distraction, trust aside
  on desktop (booking, emergency).

Rules checked for every template: one H1; one primary CTA per section; no
family more than twice; at most two consecutive image-and-text splits.

### T-home

| # | Section | Family | Job | CTA |
|---|---|---|---|---|
| 1 | Hero: positioning line, 20-word subtext, real photo in the tooth-mark mask | A | Promise and first action | «رزرو نوبت» + «تماس با کلینیک» |
| 2 | Trust band: up to 4 verified facts (years, dentists, insurers, digital workflow) | B | Credibility in 3 seconds | none |
| 3 | Services bento: 5 cells (3 categories, orthodontics, pediatric); cosmetic is the large cell | C | Orientation | cell links |
| 4 | Three restoration tiers: معمولی, VIP, CIP morph | D | Signature differentiator | «رزرو نوبت» with tier |
| 5 | Before/after: 1 featured compare slider plus 2 thumbnails | E | Proof for cosmetic money services | «دیدن همهٔ نمونه‌ها» |
| 6 | Dentists: cards with photo, specialty, council number | F | Authority, faces | «همهٔ پزشکان» |
| 7 | First visit journey: four steps from consultation to aftercare | G | Remove fear and pressure | «راهنمای اولین مراجعه» |
| 8 | Patient videos: three testimonials with posters | H | Social proof, emotion | none |
| 9 | FAQ: price, pain, insurance, financing, duration, emergency | I | Objections | sticky aside: call, WhatsApp, booking |
| 10 | Booking block with static map and hours | J | Action | form submit |

Ten sections, ten families, one split (hero). The old site's two feature
blocks and generic "why us" paragraph are dropped; their facts move into
the trust band and the journey.

### T-service (18 pages; T-service-tiers adds section 3)

| # | Section | Family | Notes |
|---|---|---|---|
| 1 | Hero: H1, one-sentence summary, real photo or case, CTAs | A | breadcrumb above |
| 2 | Facts row: sessions, duration, anesthesia, recovery, from-price | B | only filled facts render |
| 3 | Tiers comparison (restoration page only) | D | anchor `#سطح-ترمیم` |
| 4 | What it is, who it suits, who it does not, alternatives | K | in-page nav on desktop |
| 5 | Treatment steps | G | vertical on phones |
| 6 | Cases of this service | E | hidden when none |
| 7 | Dentists who perform it | F | hidden when none |
| 8 | One testimonial | H | hidden when none |
| 9 | FAQ (5-8) with sticky aside | I | `FAQPage` schema |
| 10 | Related services and articles | C | 3 related services, 2 articles |
| 11 | Booking block, service prefilled | J | |

### Other templates

| Template | Sections in order (family) |
|---|---|
| T-services-hub | compact hero (A) > bento of 5 groups (C) > full list by group with icons (K) > FAQ (I) > booking (J) |
| T-category | compact hero (A) > its services (C) > short guide text (K) > FAQ (I) > booking (J) |
| T-dentists-hub | compact hero (A) > dentist grid (F) > how the team works and sterilization standards (K) > booking (J) |
| T-dentist | portrait split with name, specialty, council number (A) > facts: degrees, years, memberships (B) > bio (K) > services performed (C) > cases (E) > articles reviewed (K, list) > booking with dentist noted (J) |
| T-cases | compact hero with consent line (A) > filter chips by service > grid of compare sliders (E) > booking (J) |
| T-pricing | compact hero (A) > how pricing works (K) > restoration tiers summary (D, static) > insurers: five featured plus «سایر بیمه‌ها» (B) > financing options when enabled (C) > FAQ (I) > booking (J) |
| T-guide-hub | compact hero (A) > guide list (C) > booking (J) |
| T-guide | reading column with TOC, reviewer box, sources (K) > booking (J) |
| T-emergency | hours-aware call panel and triage form (L) > safety line > address and directions (J) |
| T-about | space photo hero (A) > story (K) > verified facts (B) > team (F) > how we work, digital workflow (G) > testimonials (H) > booking (J) |
| T-contact | NAP, hours, call, WhatsApp, directions next to the static map (A) > access notes (K) > booking form (J) |
| T-booking | form with trust aside: address, hours, insurers, privacy line (L) |
| T-booking-success | confirmation, callback window, save-contact, directions, what to bring (L) |
| T-articles | featured latest article (A) > category chips > article grid (C) > pagination |
| T-article | reading column with TOC, author and reviewer boxes, FAQ, sources (K) > primary service CTA > related articles (C) |
| T-legal | reading column (K) |
| T-system | 404, 500, 503: message, search-free links to services, call button |

## 7. Self-review

| Check | Result |
|---|---|
| Hick's law: primary nav items | 5 (old site 7) |
| Menu depth | 2 levels (old site 3) |
| Thumb zone: call, WhatsApp, booking on phones | sticky bar, always within reach |
| One H1 per template | yes, listed as section 1 or the page title |
| One primary CTA per section | yes; tables above list one CTA each |
| Home families | 10 distinct, none repeated; one image-text split |
| Service template families | 10 sections and 10 families; 11 with D on the restoration page |
| Every indexable URL has a keyword entry | yes, see `docs/seo/keyword-map.md` |
