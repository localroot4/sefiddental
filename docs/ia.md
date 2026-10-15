# Information Architecture

Final for v1 unless the client objects at the phase 1 gate. Revised after the
independent review. Keywords per URL: `docs/seo/keyword-map.md`. Conversion
details: `docs/conversion.md`. Layout families: `docs/design-direction.md`
section 6 (A-J) plus K and L defined below.

## 1. Sitemap

| URL | Page | Template | Index |
|---|---|---|---|
| `/` | خانه | T-home | yes |
| `/خدمات` | همهٔ خدمات | T-services-hub | yes |
| `/خدمات/زیبایی` | خدمات زیبایی دندان | T-category | yes |
| `/خدمات/جراحی-و-جایگزینی-دندان` | جراحی و جایگزینی دندان | T-category | yes |
| `/خدمات/درمان-دندان` | درمان و نگهداری دندان | T-category | yes |
| `/خدمات/لمینت-سرامیکی` | لمینت سرامیکی | T-service | yes |
| `/خدمات/کامپوزیت-دندان` | کامپوزیت دندان | T-service | yes |
| `/خدمات/بلیچینگ-دندان` | بلیچینگ دندان | T-service | yes |
| `/خدمات/بستن-دیاستم` | بستن دیاستم | T-service | yes |
| `/خدمات/لیفت-لثه` | لیفت لثه | T-service | yes |
| `/خدمات/طراحی-لبخند` | طراحی لبخند | T-service | yes |
| `/خدمات/ایمپلنت-دندان` | ایمپلنت دندان | T-service | yes |
| `/خدمات/اوردنچر` | اوردنچر | T-service | yes |
| `/خدمات/جراحی-دندان-عقل-و-فک` | جراحی دندان عقل و فک | T-service | yes |
| `/خدمات/جراحی-لثه` | جراحی لثه | T-service | yes |
| `/خدمات/کشیدن-دندان` | کشیدن دندان | T-service | yes |
| `/خدمات/ترمیم-دندان` | ترمیم دندان (معمولی، VIP، CIP) | T-service-tiers | yes |
| `/خدمات/جرم-گیری` | جرم‌گیری دندان | T-service | yes |
| `/خدمات/درمان-ریشه` | درمان ریشه | T-service | yes |
| `/خدمات/روکش-دندان` | روکش دندان | T-service | yes |
| `/خدمات/اینله-و-آنله` | اینله و آنله | T-service | yes |
| `/خدمات/ارتودنسی` | ارتودنسی | T-service | yes |
| `/خدمات/دندانپزشکی-کودکان` | دندانپزشکی کودکان | T-service | yes |
| `/vip` | alias | 301 to `/خدمات/ترمیم-دندان#سطح-ترمیم` | no |
| `/پزشکان` | پزشکان | T-dentists-hub | yes |
| `/پزشکان/{slug}` | one per dentist | T-dentist | yes |
| `/قبل-و-بعد` | قبل و بعد | T-cases | yes; `?service=` filters canonicalize to the base URL |
| `/هزینه-و-پرداخت` | هزینه و پرداخت | T-pricing | yes |
| `/راهنمای-بیمار` | راهنمای بیمار | T-guide-hub | yes |
| `/راهنمای-بیمار/اولین-مراجعه` | اولین مراجعه | T-guide | yes |
| `/راهنمای-بیمار/ترس-از-دندانپزشکی` | ترس از دندانپزشکی | T-guide | yes |
| `/راهنمای-بیمار/مراقبت-بعد-از-درمان` | مراقبت بعد از درمان | T-guide | yes |
| `/اورژانس` | درد شدید دندان | T-emergency | yes |
| `/درباره-ما` | درباره ما | T-about | yes |
| `/آدرس` | آدرس و ساعات کاری | T-address | yes |
| `/رزرو-نوبت` | رزرو نوبت | T-booking | yes; parameters canonicalize to the base URL |
| `/رزرو-نوبت/ثبت-شد` | درخواست ثبت شد | T-booking-success | no; redirects without a flash |
| `/مقالات` | مقالات | T-articles | yes; `?page=N` is self-canonical |
| `/مقالات/{slug}` | one per article | T-article | yes |
| `/مقالات/دسته/{slug}` | article category | T-articles | noindex, follow until the category has 5 published articles |
| `/مقالات/برچسب/{slug}` | article tag | T-articles | noindex, follow |
| `/حریم-خصوصی` | حریم خصوصی | T-legal | yes |
| `/admin` | admin | Payload | blocked in robots |
| `/api/health` | health | system | no |

URL rules:

- Services are flat under `/خدمات/{slug}`; the category lives in the
  breadcrumb, not the URL. Encoded Persian URLs get long when shared, and a
  service can move between categories without a redirect.
- Orthodontics and pediatric dentistry are services without a category page
  (their category records have `slug: null` and resolve to the service).
  Slugs are unique across categories and services.
- Articles use «مقالات» in the UI and the URL. Patients search for "مقاله".
- The address page is `/آدرس`, labeled «آدرس و ساعات». The word «تماس» is
  reserved for calling (see `docs/conversion.md` section 2).
- Article category names never equal a service's primary term (no category
  «ایمپلنت»; use «جایگزینی دندان» style topics or merge into tags).
- Area pages (for example نازی‌آباد) are out of v1; add them only with unique
  content, never as doorway pages.

## 2. Primary navigation

Desktop (one line, max 72 px, RTL so items start at the right):

```
[logo]  خدمات ▾   پزشکان   قبل و بعد   هزینه و پرداخت   آدرس و ساعات      [theme] [۰۲۱ ۵۵۱۰ ۱۰۵۴] [رزرو نوبت]
```

- Five items that follow the decision path: what, who, proof, money, where.
  Articles, guides, about and the emergency page live in the mega menu row,
  the phone drawer and the footer. Article traffic arrives from search.
- The phone number is a `tel:` link in an LTR island, hidden below 1280 px
  where a call icon remains.
- Active page: the long-bar motif under the item.

Services mega menu (opens on click or keyboard; on fine pointers hover intent
also opens it):

```
| زیبایی              | جراحی و جایگزینی دندان | درمان و نگهداری      | سایر خدمات            |
| لمینت سرامیکی       | ایمپلنت دندان          | ترمیم دندان (VIP/CIP)| ارتودنسی              |
| کامپوزیت دندان      | اوردنچر                | روکش دندان           | دندانپزشکی کودکان     |
| بلیچینگ دندان       | جراحی دندان عقل و فک   | درمان ریشه           |                       |
| بستن دیاستم         | جراحی لثه              | جرم‌گیری              | [همهٔ خدمات]           |
| لیفت لثه            | کشیدن دندان            | اینله و آنله         |                       |
| طراحی لبخند         |                        |                      |                       |
|--------------------------------------------------------------------------------------|
| راهنمای بیمار   مقالات   درباره ما   درد شدید دارید؟                                 |
```

Money services sit first in each column. Category titles link to category
pages.

Phone header: logo, call icon button (closed-hours sheet applies), menu
button. Phone drawer (full screen, focus trapped, Esc and close button, 48 px
rows, two levels max):

1. «رزرو نوبت» (primary) and «تماس با کلینیک» side by side
2. خدمات: three accordion groups, then ارتودنسی and دندانپزشکی کودکان as
   direct links, then «همهٔ خدمات»
3. پزشکان، قبل و بعد، هزینه و پرداخت
4. راهنمای بیمار، مقالات، درباره ما، آدرس و ساعات
5. «درد شدید دارید؟» with the warning token
6. Theme toggle and socials

Phone sticky bar: «تماس» | «واتساپ» | «رزرو نوبت». Rules in
`docs/conversion.md` section 4.

## 3. Footer

```
| کلینیک دندانپزشکی سفید        | خدمات پرطرفدار      | کلینیک           | راهنما             |
| one-line description          | لمینت سرامیکی       | پزشکان           | راهنمای بیمار      |
| address                       | کامپوزیت دندان      | قبل و بعد        | اولین مراجعه       |
| phones (LTR)                  | ایمپلنت دندان       | هزینه و پرداخت   | مقالات             |
| hours                         | روکش دندان          | درباره ما        | درد شدید دارید؟    |
| مسیریابی: گوگل‌مپ، نشان،       | ترمیم دندان         | آدرس و ساعات     | حریم خصوصی         |
| بلد، ویز                      | همهٔ خدمات           |                  |                    |
|--------------------------------------------------------------------------------------------|
| socials        license number, technical supervisor        © {سال جاری} کلینیک دندانپزشکی سفید |
```

Phones: the address and hours block stays open; the other groups are
`<details>` disclosures.

## 4. Breadcrumbs

On every page except home, booking success and system pages; visible under
the header and mirrored in `BreadcrumbList` JSON-LD.

- Service: خانه / خدمات / {category} / {service}; standalone services skip
  the category.
- Dentist: خانه / پزشکان / {name}. Article: خانه / مقالات / {category} /
  {title}. Guide: خانه / راهنمای بیمار / {title}.
- Phones: only the parent link with a back chevron (mirrored in RTL).

## 5. Internal linking rules

| From | Must link to |
|---|---|
| Service | its category (breadcrumb), 2-3 related services, dentists who perform it, the pricing page, 2 related articles, cases of this service |
| Category | all its services, the pricing page, one guide |
| Dentist | services performed, articles authored or reviewed, cases |
| Article | one primary service (in the body and the end box), one guide, 2 related articles |
| Guide | the services it mentions, the articles that own the specific aftercare terms, booking |
| Pricing | the restoration page, the three money services, booking |
| Home | every category, the restoration page, dentists hub, cases, first-visit guide |

Anchor text is descriptive Persian («هزینه و شرایط لمینت سرامیکی»), never
«اینجا کلیک کنید». Phase 6 adds an admin check for at least two internal
links per article.

## 6. Templates and section order

Additional families:

- **K, reading column:** long-form text, 62ch measure, optional sticky table
  of contents on desktop, callouts, sources. Read mode.
- **L, focused task:** one task per screen, minimal distraction, trust aside
  on desktop (booking, emergency).

Family variants used below (defined in `docs/design-direction.md` section 6):
B is a fact row of 3-6 items; C is a grid or bento with exactly as many cells
as items; G-static is the journey as vertical steps with no pinning or pan
(the pinned pan exists only on the home page); J-form is the booking block
without the map. A is the asymmetric split hero of inner pages: text at the
start side, media in a plain 24 px radius frame, no mark mask. M is the
full-bleed photo hero, used on home only (brief decision 19).

Rules checked for every template: one H1; one primary CTA per section; no
family more than twice; at most two consecutive image-and-text splits.

### T-home

| # | Section | Family | Job | CTA |
|---|---|---|---|---|
| 1 | Hero (direction B): positioning line and subtext (up to 20 words) on a scrim at the start side, over a full-bleed real clinic photo; floating booking card with the compact form (phone field plus the hidden fields) at the end side; phones: scrim, card, then a 4:5 photo band | M | Promise and first action | «ثبت درخواست» in the card (primary) + «تماس با کلینیک» on the scrim (secondary) |
| 2 | Trust band: up to 4 verified facts, on the hero's bottom edge from 744 px (2x2 at 744-1023, one row of four from 1024) and on the bottom edge of the phone photo band | B | Credibility in 3 seconds | none |
| 3 | Services bento: 5 cells (3 categories, orthodontics, pediatric); cosmetic is the large cell | C | Orientation | cell links |
| 4 | Three restoration tiers: معمولی, VIP, CIP morph | D | Signature differentiator | «رزرو نوبت» with the tier |
| 5 | Before/after: 1 featured compare slider plus 2 thumbnails | E | Proof for cosmetic money services | link «همهٔ نمونه‌ها» |
| 6 | Dentists: cards with photo, specialty, council number | F | Authority, faces | link «همهٔ پزشکان» |
| 7 | Patient videos: three testimonials with posters | H | Social proof | none |
| 8 | First-visit journey: four steps from consultation to aftercare (pinned pan on desktop) | G | Remove fear and pressure | link «راهنمای اولین مراجعه» |
| 9 | FAQ: price, pain, insurance, financing, duration, emergency | I | Objections | sticky aside: call, WhatsApp, booking |
| 10 | Booking block with static map and hours; the full form, the second form instance on home | J | Action | «ثبت درخواست» |

The table is the order as built in phase 4: the order of
`docs/experience-direction.md` where the two overlap, so the patient videos
(scene 8) come before the first-visit journey, and the journey and the FAQ
share scene 9 (`data-scene="first-visit"`). A section without published
records renders nothing (before/after, dentists and patient videos until
the client sends them, F9); the order of the rest stays.
The storyboard's digital-workflow scene («از اسکن تا لبخند») is not built:
its captions are unconfirmed claims (gaps 7 and 48), and phase 7 decides.
Section headings and intros live in the home page's `sections` field; the
journey steps and the FAQ are the page's `steps` and `faq` blocks.

Ten sections, ten families (M, B, C, D, E, F, G, H, I, J), no image-text
split (the hero is full-bleed). The booking form appears twice (the hero
card inside M and the booking block J), within the limit of two per family.

### T-service (17 pages; T-service-tiers adds section 3)

| # | Section | Family | Notes |
|---|---|---|---|
| 1 | Hero: H1, one-sentence summary, real photo or case, CTAs | A | breadcrumb above; root canal and extraction add the quiet «درد شدید دارید؟» link |
| 2 | Fact row: sessions, duration, anesthesia, recovery, from-price | B | only filled facts render |
| 3 | Tiers comparison (restoration page only) | D | anchor `#سطح-ترمیم` |
| 4 | What it is, who it suits, who it does not, alternatives | K | in-page nav on desktop |
| 5 | Treatment steps | G-static | |
| 6 | Cases of this service | E | hidden when none |
| 7 | Dentists who perform it | F | hidden when none |
| 8 | One testimonial | H | hidden when none |
| 9 | FAQ (5-8) with sticky aside | I | `FAQPage` schema |
| 10 | Related services and articles | C | 3 services, 2 articles |
| 11 | Booking block, service prefilled | J | |

### Other templates

| Template | Sections in order (family) |
|---|---|
| T-services-hub | compact hero (A) > bento of 5 groups (C) > full list by group with icons (K) > FAQ (I) > booking (J) |
| T-category | compact hero (A) > its services (C) > short guide text (K) > FAQ (I) > booking (J) |
| T-dentists-hub | compact hero (A) > dentist grid (F) > how the team works and sterilization standards (K) > booking (J) |
| T-dentist | portrait split with name, specialty, council number (A) > fact row: degrees, years, memberships (B) > bio (K) > services performed (C) > cases (E) > articles authored or reviewed (K, list) > booking with the dentist noted (J) |
| T-cases | compact hero with the consent line (A) > filter chips (`?service=`) > grid of compare sliders, each with a secondary-style «رزرو نوبت» link (E) > one primary booking block (J) |
| T-pricing | compact hero (A) > how pricing works (K) > restoration tiers summary (D; phase 5 decision G13: a radio per tier, none checked, one «رزرو نوبت» that carries the chosen tier) > insurers: the five featured by name under «همکاری با بیمه‌ها» (B; phase 5 decision G1 and freeze F31: no «سایر بیمه‌ها» or «طرف قرارداد» until gap 51 closes) > financing options when enabled (C) > FAQ (I) > booking (J) |
| T-guide-hub | compact hero (A) > guide list (C) > booking (J) |
| T-guide | reading column with TOC, reviewer box, sources (K) > booking (J) |
| T-emergency | focused task (L) in the order of `docs/conversion.md` section 7.1, ending with address and directions |
| T-about | space photo hero (A) > story (K) > verified facts (B) > team (F) > how we work, digital workflow (G-static) > testimonials (H) > booking (J) |
| T-address | NAP, hours, call, WhatsApp, directions next to the static map (A) > access notes (K) > booking form without a second map (J-form) |
| T-booking | form with trust aside: address, hours, insurers, privacy line (L) |
| T-booking-success | confirmation, callback line, save contact, directions, what to bring (L) |
| T-articles | featured latest article (A) > category chips > article grid (C) > pagination |
| T-article | reading column with TOC, author and reviewer boxes, FAQ, sources (K) > primary service box > related articles (C) |
| T-legal | reading column (K) |
| T-system | 404, 500, 503: message, links to services, call button, «درد شدید دارید؟» on 404 |

## 7. Self-review

| Check | Result |
|---|---|
| Primary nav items | 5 (old site 7) |
| Menu depth | 2 levels (old site 3) |
| Call, WhatsApp, booking on phones | sticky bar, always within thumb reach |
| One H1 per template | yes |
| One primary CTA per section | yes; per-case gallery links use the secondary style |
| Home families | 10 distinct; no image-text split; the booking form twice (hero card and booking block), within the limit |
| Service template | 10 sections and 10 families; 11 with D on the restoration page |
| Signature scroll moments | home only (hero transition, tiers morph, journey pan); other pages use static variants |
| Every indexable URL has a keyword row | yes, see `docs/seo/keyword-map.md` |
