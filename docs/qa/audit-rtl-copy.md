# RTL and copy audit (phase 9, deliverable 5)

Three parts: the copy self-audit (section 1, wave 1 COPY lane), the RTL inspection at all
widths (section 2) and the dark mode audit (section 3). Sections 2 and 3 belong to the wave 2
SEO-RTL lane.

## 1. Copy self-audit

Date: 2026-10-30. Base commit `456c289`. Rows cite file and line at that commit.

### 1.1 Scope at launch

Owner decision 1(a): launch without a published reviewer dentist. So the dentists, guides and
articles hubs show their empty states, and only the copy below reaches a visitor on launch day.

- The 18 services and the five category pages: `docs/content/services.yaml`, every field a
  visitor reads (summary, SEO description, sessions, recovery, body blocks, FAQs, the three
  restoration tiers).
- Home (journey steps, FAQ), pricing (with the tier FAQ), emergency (title and description; it
  publishes without self-care blocks), about and privacy: `src/seed/data/pages.yaml`.
- The emergency page strings (safety box, triage, avulsed-tooth first aid):
  `src/i18n/fa-emergency.ts`.
- Every other visible UI string: `src/i18n/*.ts`.

Out of scope: the three guides and the six articles (drafts until a dentist is published) and
the dentist profiles. Their review moves to post-launch (plan section 8).

### 1.2 Mechanical checks

| Check | How | Result |
|---|---|---|
| Banned and restricted words (copy-guidelines: «بهترین», «بی‌نظیر», «تضمینی», «ارزان‌ترین», «معجزه», «بدون درد», «متخصص», «اولین کلینیک»), em and en dash | Scratch grep over `src/i18n/*.ts` (tests excluded), `services.yaml` and `pages.yaml`; comment lines skipped. Shown red once: a planted «بهترین —» in a copy of the tree gave one hit. | 0 hits |
| Per-string rules: banned words and labels, Arabic ي ك ى, Latin digits, dashes, English gloss in brackets, missing ZWNJ after «می» and before «ها»/«تر», `[[NEEDS_CLIENT` | `npm test -- src/seed/seed.test.ts` (SC3, SC8 to SC14) and `src/i18n/fa.test.ts` (CP1) | pass |
| Emergency strings equal `docs/conversion.md` section 7 byte for byte | `src/components/emergency/copy.test.ts` (T-EM4) | pass |
| No literal bidi control characters | `node scripts/check-bidi.mjs` | pass |
| The seeder accepts every string | `npm run test:int -- seed` | pass |

### 1.3 One label per intent

Every action label in `src/i18n` matches `docs/conversion.md` section 2: «رزرو نوبت» (`nav.book`,
`home.book`, `services.book`, `pages.book`, `ui.qa.book`), «تماس با کلینیک» (`call.label`),
«پیام در واتساپ» (`nav.whatsapp`, `booking.whatsapp`, `services.whatsapp`, `pages.whatsapp`),
«مسیریابی», «آدرس و ساعات», «ثبت درخواست», «ثبت درخواست فوری». The short forms «تماس» and
«واتساپ» appear only as `nav.quickCall` and `nav.quickWhatsapp` (the phone sticky bar). The five
banned labels appear nowhere (SC3, CP1). «نوبت عادی بگیرید» (`emergency.none.link`) is a link
inside a sentence that conversion.md 7 gives verbatim, not a button label. Result: no change.

### 1.4 Terminology

| Thing | Term used | Other forms found | Verdict |
|---|---|---|---|
| Crown | «روکش» (113 times) | «کراون»: 0 | One term. One defect: the QA component card called a veneer «روکش» (`src/i18n/fa-ui.ts:124`); fixed to «پوستهٔ نازک سرامیکی». |
| Root canal treatment | «درمان ریشه» | «عصب‌کشی» in the root-canal H1 and SEO title (as the alias in brackets) and in FAQ questions | Justified: the search phrase of keyword map 3; the page names both once. |
| Filling | «ترمیم» | «پر کردن» on the inlay-onlay page («با پر کردن معمولی چه فرقی دارد؟») and the step «پر کردن کانال‌ها» | Justified: the inlay page contrasts with the everyday word; the step fills canals, a different thing. |
| Whitening | «بلیچینگ» | «سفید کردن» in the bleaching SEO title and two FAQ answers | Justified: search phrase and plain gloss. |
| Implant, scaling, anaesthesia, reception | «ایمپلنت», «جرم‌گیری», «بی‌حسی», «پذیرش» | «کاشت دندان», «جرمگیری», «بیحسی», «منشی»: 0 | One term each. |

### 1.5 Dentist review: method

Three reviewer agents, separate from the agent that edited the copy, each acting as a general
dentist, read the copy read-only at `456c289` and checked every clinical claim (indications,
contraindications, steps, sessions, recovery, numbers, durability, risks, aftercare, first aid,
red flags) against the stored sources of that page. They also looked for material risks the page
does not state. Scope A: the six cosmetic services, home, pricing, emergency, about and the
emergency strings. Scope B: the five surgery and replacement services and the category pages.
Scope C: the seven restorative, orthodontic and pediatric services with the tiers. Verdicts: ok,
overclaim, missing risk, inaccurate, unsupported, wording.

This review is not a clinical sign-off. The client's own reviewer dentist (gap 42) remains the
sign-off after launch; `reviewed_by` stays null on every service.

Sources: ADA, NHS, PubMed, Cochrane and AAPD answered from this network on 2026-10-30, so the
reviewers re-opened most sources. Coverage:

| Page | Listed | Opened | Not re-opened (judged from the stored title) |
|---|---|---|---|
| ceramic-laminate | 6 | 5 | NHS «Chipped, broken or cracked tooth» |
| composite-veneer | 6 | 5 | NHS «Chipped, broken or cracked tooth» |
| bleaching | 5 | 5 | none |
| diastema | 10 | 9 | PubMed 39063806 (no abstract returned) |
| gum-lift | 11 | 6 | PubMed 39776712, 27136119, 24765624, 40947958, 16646512 |
| smile-design | 12 | 5 | PubMed 21217950, 17532914, 11194397, 35738740, 24765624, 37595084, 39063806 |
| implant | 16 | 14 | ADA «X-rays», Cochrane CD006697 |
| overdenture | 17 | 15 | ADA «X-rays», Cochrane CD006697 |
| oral-surgery | 10 | 9 | ADA «X-rays» |
| gum-surgery | 7 | 7 | none |
| extraction | 11 | 10 | AAPD «Management of the Developing Dentition» |
| restoration, scaling, root-canal, crown, inlay-onlay, orthodontics, pediatric | 16, 14, 13, 13, 13, 8, 19 | all | none |
| category pages | none of their own | judged against their services' sources | cosmetic: the ADA veneer and whitening pages were not re-opened for this row |
| home, pricing, emergency, about, `fa-emergency.ts` | none of their own | NHS «Dental abscess», «Toothache», «Knocked-out tooth», «Wisdom tooth removal»; IADT 2020 | none |

No row that needed a fix rests on a source that was not re-opened. The rows above stay marked
«not re-opened»; re-open them after launch (plan section 8).

### 1.6 Dentist review: rows that needed a fix

Status «fixed» means the fix is in the patch series of this lane, sometimes reworded to fit the
copy rules and field limits (the final text is in the diff). Every overclaim, missing-risk,
inaccurate and unsupported row is fixed or resolved with a reason.

| # | Where | Claim | Source | Verdict | Fix | Status |
|---|---|---|---|---|---|---|
| A14 | services.yaml:208 | «به‌ندرت رنگ لمینت تغییر می‌کند…» | ADA, Veneers | wording | Drop the colour clause: lines 202 and 239 say coffee and tea can stain. | fixed |
| A15 | services.yaml:231-233 | «حدود ۸۹ درصد لمینت‌ها پس از میانگین ۹ سال…» | none of the six stored sources (ADA «Materials for Indirect Restorations» checked again: no veneer survival figure) | unsupported | Remove the figure; «ماندگاری آن در هر فرد متفاوت است.» | fixed |
| A52 | services.yaml:619-623 | diastema risk list names only orthodontic pain | NHS, Braces | missing risk | Add «خطرهای [ارتودنسی](/خدمات/ارتودنسی) در صفحهٔ همان درمان آمده است.» | fixed |
| A58 | services.yaml:785-786 | gum margin «معمولاً تا حدود شش ماه ثابت می‌شود» | PubMed 24804287 («may stabilize by 6 months») | overclaim | «…ممکن است تا حدود شش ماه طول بکشد تا ثابت شود.» | fixed |
| A61 | services.yaml:769 | bone reshaping «ممکن است بر پایداری بافت نگهدارنده… اثر بگذارد» | PubMed 20516094 | wording | Proposed: name the bone removal plainly. | declined: the sentence is already hedged and the next sentence says the dentist checks suitability first |
| A70 | pages.yaml:68 | «بیشتر درمان‌ها با بی‌حسی موضعی انجام می‌شوند» | none; bleaching, check-ups, scaling and braces usually need none | inaccurate | «درمان‌هایی که ممکن است درد داشته باشند، معمولاً با بی‌حسی موضعی انجام می‌شوند.» | fixed |
| A71 | pages.yaml:69-70 | «حساسیت یا درد خفیف چند روزه ممکن است» | services.yaml:721 (gum surgery pain up to two weeks) | overclaim | «…حساسیت یا درد چندروزه ممکن است. دندانپزشک می‌گوید بعد از درمان شما چه انتظاری داشته باشید.» | fixed |
| A73 | pages.yaml:82 | «ایمپلنت یا ارتودنسی چند جلسه در چند ماه» | NHS, Braces (fixed braces one to two years) | inaccurate | «ایمپلنت چند جلسه در چند ماه… ارتودنسی ثابت معمولاً یک تا دو سال.» | fixed |
| A75, C12 | pages.yaml:24, 142-145; services.yaml:1965, 2068 | «در VIP مواد درجه‌یک…»; «دقت بیشتر» | no clinical source compares the tiers | unsupported | Soften, or keep only if the client confirms. | resolved: the tier definitions are the client's own facts (`docs/brief.md`, «Restoration tiers»: «premium materials», «form and surface match a natural tooth»), a service description, not a clinical claim. C13's no-durability line is added to both tier FAQs. |
| C13 | services.yaml:1964-1967 | tier FAQ does not say that no tier promises durability | ADA, Materials for Direct Restorations | wording | Add «هیچ سطحی از ترمیم قول تعداد سال مشخصی نمی‌دهد.» (the wording of the durability FAQ, line 1987) | fixed (services.yaml tier FAQ and the pricing tier FAQ) |
| A79 | fa-emergency.ts:19 | eye red flag without sudden eyesight problems | NHS, Dental abscess (999: «a swollen or painful eye, or suddenly start having problems with your eyesight») | missing risk | «…چشم باز نمی‌شود یا دید چشم ناگهان مشکل پیدا کرده است.» | fixed (also `docs/conversion.md` 7.2) |
| A80 | fa-emergency.ts:19-22 | no red flag for heavy swelling inside the mouth | NHS, Dental abscess (999: «a lot of swelling in your mouth») | missing risk | Proposed a new key; merged into `emergency.safety.breath` instead, so `SafetyBox.tsx` keeps its key list: «داخل دهان خیلی ورم کرده است، یا نفس کشیدن…» | fixed (also conversion.md 7.2) |
| A82, B72 | fa-emergency.ts:21; services.yaml:82 | «با ۱۵ دقیقه فشار مداوم بند نمی‌آید» | NHS, Wisdom tooth removal («press… for at least 10 minutes»); no source for 15 | unsupported (A82); inaccurate (B72: bleeding sent to 115 before the clinic) | Safety box: no number, «با فشار مداوم روی دستمال تمیز بند نمی‌آید». Surgery category FAQ: «دست‌کم ۱۰ دقیقه», then the clinic, then the hospital if closed; 115 stays for the airway and spreading-swelling flags. | fixed (also conversion.md 7.2; the draft aftercare guide, pages.yaml:536, gets the same safety-box wording) |
| A89 | fa-emergency.ts:40 | avulsed tooth: «در شیر نگه دارید» only | NHS, Knocked-out tooth («milk or saliva»); IADT | wording | «…در شیر یا بزاق نگه دارید، نه در آب.» (the pediatric page already says both) | fixed (also conversion.md 7.4) |
| A93 | fa-ui.ts:124 | a veneer called «روکش» | ADA, Veneers | wording | «پوستهٔ نازک سرامیکی روی سطح جلوی دندان.» | fixed |
| B9, B23, B35 | services.yaml:1063, 1248, 1447 | «داروی پوکی استخوان… این را هم بگویید» with no reason | NHS, alendronic acid; Cochrane CD003603 | missing risk (rare jaw-bone damage) | «…چون در موارد نادر جراحی ایمپلنت ممکن است به استخوان فک آسیب بزند.» | fixed (oral-surgery shortened to fit the 400-character callout) |
| B15 | services.yaml:1088-1092 | implant risks without the sinus | mainstream implant consent; Cochrane CD003607 links the sinus augmentation review | missing risk | «مشکل سینوس در ایمپلنت فک بالا: …» | fixed |
| B41, B62 | services.yaml:1490, 1529-1531, 1802 | nerve injury «معمولاً بهتر می‌شود…» only | Cochrane CD005293 (about 90% temporary; past six months permanent; the lingual nerve can alter taste) | missing risk (rare permanent injury, taste) | «در موارد کم، ممکن است ماندگار باشد. آسیب عصب زبان ممکن است حس چشایی را هم تغییر دهد.» | fixed; CD005293 (already a source of implant and overdenture) added to the oral-surgery and extraction source lists |
| B42, B64 | services.yaml:1493-1496, 1806-1808 | «when to call» lists have no route when the clinic is closed; extraction lacks persistent numbness | NHS, Wisdom tooth removal | wording | Add the persistent-numbness item (extraction) and «اگر کلینیک بسته است و خونریزی بند نمی‌آید، به اورژانس نزدیک‌ترین بیمارستان بروید.» | fixed |
| B43, B66 | services.yaml:1499, 1814 | warning callout names only breathing and swallowing | NHS, Dental abscess | wording | Use the root-canal callout (services.yaml:2312, row C42 ok): eye, neck, mouth opening, swelling inside the mouth → hospital. | fixed |
| B46 | services.yaml:1601 | «جراحی فلپ رایج‌ترین جراحی…» | no stored source says «most common» | unsupported | «یکی از جراحی‌های رایج» | fixed |
| B50 | services.yaml:1629 | root planing «تا لثه دوباره به دندان بچسبد» | ADA, Scaling and Root Planing («to help your gums reattach») | overclaim | «…تا به چسبیدن دوبارهٔ لثه به دندان کمک کند.» | fixed |
| B54 | services.yaml:1651 | gum surgery risk limited to the look of the upper front teeth | AAPD, Periodontal Conditions (recession, root exposure); mainstream periodontal consent | missing risk (recession, longer teeth, gaps, root sensitivity) | «پایین رفتن لثه: …» | fixed |
| B58 | services.yaml:1765 | link text «جراحی دندان عقل و فک» | the target page covers wisdom teeth (gap 27 scope) | wording | Drop «و فک» from the link text. | declined: the link text is the target page's own name; the page name and its scope are gap 27 (client), recorded in findings |
| B74 | services.yaml:94-98 | restorative intro: severe pain or swelling → call the clinic in working hours only | NHS, Dental abscess | wording | Add the hospital route when the clinic is closed. | fixed |
| C23 | services.yaml:2123 | «در پژوهش‌ها، جرم‌گیری با حساسیت… همراه بوده است» | Cochrane, Routine scale and polish (named only in its background) | wording | «جرم‌گیری ممکن است حساسیت دندان ایجاد کند یا به سطح دندان آسیب بزند.» | fixed |
| C27 | services.yaml:2151 | «در بیشتر افراد این حساسیت خفیف است» | PubMed 10983603 (deep cleaning only; no such figure) | unsupported | remove | fixed |
| C60 | services.yaml:2612, 2650 | inlay and onlay sensitivity only between the two sessions | PubMed 16900817 (13% sensitive in the first week after placement) | missing risk | «…در فاصلهٔ دو جلسه و چند روز بعد از چسباندن…» | fixed |
| C72 | services.yaml:2840 | root resorption «کمی از ریشه را کم کند» | Cochrane, External root resorption | wording | «…بخشی از ریشه را کوتاه کند. این کوتاه شدن معمولاً کم است، علامتی ندارد…» | fixed |
| C86 | services.yaml:2999 | permanent tooth «بهتر است در ۳۰ دقیقه تا یک ساعت درمان شود» | NHS, Knocked-out tooth («as soon as possible», no window) | unsupported | «هرچه زودتر برسید، شانس نگه داشتن دندان دائمی بیشتر است.» | fixed |

### 1.7 Dentist review: rows judged ok

Each row has a claim, a source and the verdict ok, with no fix. Listed by page, with the
sources each one rests on.

| Page | Rows | Main sources |
|---|---|---|
| ceramic-laminate | A1 to A13, A16, A17 | ADA Veneers, ADA Teeth Whitening, NHS Braces |
| composite-veneer | A18 to A25 | ADA Veneers, ADA Teeth Whitening, ADA Materials for Direct Restorations |
| bleaching | A26 to A42 (sensitivity, shade limits, crowns and fillings do not change colour, age and pregnancy, non-dentist kits, about three years) | ADA, NHS, Cochrane CD006202, AAPD |
| diastema | A43 to A51, A53 (causes, mixed dentition, no-prep composite, braces one to two years, retainer) | PubMed 7617490, 25073229, 26881147, 41529786, 15948679; NHS Braces, Gum disease |
| gum-lift | A54 to A57, A59, A60, A62 to A64 | PubMed 37730094, 20516094, 24804287, 32124069, 26970296; NHS Gum disease |
| smile-design | A65 to A68 | PubMed 21217950, 24765624; ADA Teeth Whitening |
| home, pricing, emergency, about | A69, A72, A74, A76, A77 | NHS Toothache, Dental abscess; ADA Materials for Direct Restorations |
| emergency strings | A78, A81, A83 to A88, A90, A91 (the avulsion text matches IADT 2020: hold the crown, rinse at most 10 s in cold running water, replant, never a primary tooth) | NHS Dental abscess, Toothache, Knocked-out tooth; IADT 2020 |
| other UI strings | A92, A94 (no medical statements beyond the consent line) | none needed |
| implant | B1 to B8, B10 to B14, B16 to B18 (Cochrane CD004152 «often removed», CD005293 nerve) | ADA Implants, Missing Teeth; Cochrane CD003878, CD003607, CD004152, CD003069, CD004970, CD005293 |
| overdenture | B19 to B22, B24 to B30 | Cochrane CD008001; NHS and ADA Dentures |
| oral-surgery | B31 to B34, B36 to B40, B44 (17 to 21 years, two or three pieces, under 40 minutes, 10 minutes pressure) | NHS Wisdom tooth removal; ADA Wisdom Teeth, Dry Socket; Cochrane CD003879 |
| gum-surgery | B45, B47 to B49, B51 to B53, B55 | ADA Scaling and Root Planing, Gum Disease; NHS Gum disease; AAPD |
| extraction | B56, B57, B59 to B61, B63, B65, B67 | ADA Extractions, Dry Socket, Space Maintainers; NHS alendronic acid, Anticoagulant medicines |
| category pages | B68 to B71, B73, B75, B76 (orthodontics and pediatric are standalone: no category copy) | the services' sources; NHS Dental abscess |
| restoration and tiers | C1 to C11, C14 to C17 | ADA, NHS, PubMed 36098547, 39286911, 33805399 |
| scaling | C18 to C22, C24 to C26, C28 to C30 | ADA, NHS Dental check-ups, Gum disease; Cochrane Routine scale and polish |
| root-canal | C31 to C47 (86 to 93% at two to ten years) | ADA, NHS Root canal treatment, Toothache, Dental abscess; PubMed 20158529; Cochrane; AAPD Pulp Therapy |
| crown | C48 to C55 (about half sensitive in three months, over 90% at five years) | ADA Crowns, Materials for Indirect Restorations; PubMed 15195722, 30019391, 12186346 |
| inlay-onlay | C56 to C59, C61, C62 (91% at ten years) | ADA; PubMed 32718491, 12186346, 27287305 |
| orthodontics | C63 to C71, C73 (6 to 8 weeks, one to two years, early treatment at 7 to 11) | NHS Braces; ADA; Cochrane Prominent upper front teeth, Underbite, Retention, Fluorides during fixed braces |
| pediatric | C74 to C85, C87 | ADA, AAPD, NHS Children's teeth, Knocked-out tooth; Cochrane Fluoride varnishes, Sealants |

### 1.8 Open after launch

- Re-open the sources marked «not re-opened» in 1.5 from a network that reaches them.
- The client's reviewer dentist (gap 42) signs off this copy and fills `reviewed_by`.
- The guides and articles get the same review before they publish (decision 1).

## 2. RTL inspection

Date: 2026-10-30. The standalone build of `9948d21` with this lane's changes (`8ada965` adds only
the client-side reload place, `src/experience/core/reloadPlace.ts`), Chromium 141.0.7390.37.

### 2.1 Method

- Screenshots: `QA_SCREENSHOTS=phase-09 npx playwright test screenshots --grep "T-SS .* screenshot"`
  in the six matrix projects (390x844 at 3x with touch, 820x1180 at 2x with touch, 1440x900; light
  and dark). On the QA database (`npm run db:e2e`): 25 templates, from the system pages to the
  article. On the launch database (`npm run db:live`, `E2E_LIVE_SHAPE=1`): the dentist, guide and
  article hubs in their empty state. Files: `docs/qa/phase-09/<template>-<width>-<theme>.jpg` (JPEG, at most 1000 px wide).
  Home at `?tier=2` is stitched from viewport frames after a full scroll (phase 7 F4).
- A scripted probe at the same three widths and both themes (session scratchpad, not committed):
  every sitemap URL plus the empty hubs, the booking success page, page 2 of the articles list,
  a tag page and a 404. Per page it reads `html[dir]`, horizontal overflow
  (`scrollWidth - clientWidth`), any element past the viewport edge outside a clipping parent,
  Persian text set `text-align: left` or in an LTR box, text whose color equals its background,
  and page errors. 34 URLs on `db:live` (204 runs) and 55 on the QA database (330 runs).
- Source: physical direction utilities (`ml-`, `pr-`, `left-`, `text-left`, `rounded-l-`,
  `border-r-` and the CSS properties) in `src/components`, `src/app` and `src/experience`; the
  directional icons.

### 2.2 Results

| Check | Result |
|---|---|
| `html[dir]` | `rtl` on all 534 runs |
| Horizontal overflow, elements past the viewport edge | 0 |
| Persian text left-aligned | 0 |
| Persian text in an LTR box | 0. The only LTR boxes are the phone numbers and the «۰/۵۰۰» counter of the note field: LTR islands by design, digits in Persian. |
| Page errors | 0 |
| Physical direction utilities and CSS properties | 0: margins, paddings, insets, borders, radii and alignment are logical (`ms-`, `pe-`, `start-`, `text-start`). |
| Directional icons | `caret-back`, `caret-forward` and `arrow-forward` are listed in `MIRRORED_ICONS` and flip under `rtl:` (`src/components/ui/Icon.tsx`); breadcrumbs, pagination, related links and cards point the reading way. Up and down carets do not flip. |
| Screenshots, all templates | Headings, body text, lists, breadcrumbs, FAQ chevrons, form labels, hints and errors, buttons, the header, the drawer trigger, the footer columns and the booking cards start at the right edge. Latin source titles (`Veneers`, `Dental treatments`) sit as LTR islands after their Persian numbers. Numbers, dates and prices are Persian digits. The tier chips (معمولی, VIP, CIP) read right to left. |

### 2.3 Defects

None in the RTL layout. Two capture notes, not page defects:

- In a full-page capture of a phone or tablet template the fixed bottom bar («رزرو نوبت», «تماس»)
  appears once at the first viewport's bottom edge, over the content beneath it. A reader sees
  it pinned to the bottom of the screen. `captureTemplate` hides it only when it is hidden.
- The service cards on home scroll sideways at 390 and 820 by design (scroll snap); the next card
  shows at the start edge as the cue.

## 3. Dark mode audit

Same screenshots and probe, `prefers-color-scheme: dark` (the site follows the system unless the
reader chose a theme).

| Check | Result |
|---|---|
| Body background | `rgb(7, 26, 43)` in every dark run, `rgb(247, 248, 247)` in every light run: no page stays light |
| Text the same color as its background | 0 |
| Brand marks | The logo, the header mark and the footer mark switch to their light-on-dark versions |
| Cards, inputs, chips, FAQ rows, breadcrumbs, the sticky bar | Surfaces step up from the page background; borders and focus rings stay visible |
| Photos and placeholders | The house placeholder (`MediaPlaceholder`) and the restoration tooth drawing invert to their dark tones; no white box around an image |
| Contrast | Measured by the A11Y lane with axe (`docs/qa/audit-accessibility.md`) |

Known and deferred (plan section 8): the dark booking band reads brown (phase 7 V3, a design
pass), and the workflow contrast (F6, when gap 48 turns the scene on). No new dark defect.
