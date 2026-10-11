# Old Site Audit (sefiddental.ir)

Source: five screenshots in `content/reference/old-site/` (home, contact and
about on desktop; the phone menu in two states). A live audit was not
possible: the origin resets TLS connections from outside Iran and the Web
Archive has no snapshot (tried 2026-10-11, twice). Everything below is
observed on the screenshots or inferred from them; inferences are marked.

## 1. Facts recorded

| Item | Value on the old site | Matches `clinic.yaml` |
|---|---|---|
| Home H1 | «اولین کلینیک دندانپزشکی دیجیتال جنوب تهران» | yes |
| Contact H1 | «میزبان لبخند شما هستیم» | yes |
| About H1 | «درباره کلینیک سفید دنتال» | name variant, see 3.1 |
| Address | خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲ | yes |
| Phones | 021 5510 1054, 0920 545 1054 | yes |
| Hours | همه‌روزه به‌جز روزهای تعطیل رسمی (۱۰ الی ۲۰) | yes |
| Stats (about) | ۱۳ سال سابقهٔ فعالیت، ۴ کلینیک تخصصی، ۷ پزشک متخصص، ۱۰ بیمهٔ تحت پوشش | yes, unverified |
| Social (contact) | WhatsApp, Telegram, Instagram icons | handles unknown |
| Social (footer) | Instagram plus one round icon with a check mark (unidentified network) | new gap |
| Offer on home | Button «مشاورهٔ رایگان» under the dentists block | not in brief, new gap |
| First-visit promise | Time to talk, full exam, gentle cleaning if needed, personal consultation, transparent step-by-step plan «بدون هیچ فشاری» | new fact, verify |
| Video assets | One clinic video (about 48 s, branded «SEFID Dental Clinic») and three patient testimonial videos filmed in a treatment room | assets to request |
| Logo variants | Vertical lockup (header), horizontal lockup with «کلینیک دندانپزشکی دیجیتال» under the wordmark (hero), white vertical lockup (footer) | request all as SVG |
| Navigation | خانه، خدمات زیبایی دندان ▾، خدمات درمانی دندان ▾، ارتودنسی، دندانپزشکی کودکان، وبلاگ، تماس با ما ▾، [رزرو نوبت] | taxonomy captured in `services.yaml` |
| Services | 6 cosmetic, 4 replacement, 6 maintenance, plus orthodontics and pediatric | yes |

## 2. What works (preserve)

- **Positioning line.** «اولین کلینیک دندانپزشکی دیجیتال جنوب تهران» is
  specific: it names a method and an area. Keep it as the brand line, with
  the legal caveat in `docs/discovery/risks.md`.
- **First-visit narrative.** The dark card explains the first visit and says
  «بدون هیچ فشاری». That answers the two biggest fears (pain and upselling).
  Expand it into a full guide page.
- **Real patient videos.** Three on-camera testimonials and a clinic tour are
  the strongest trust assets the clinic owns. Reuse with consent.
- **Two contact numbers and messaging apps.** Patients in this market prefer
  WhatsApp and Telegram for a first question.
- **Service taxonomy.** Complete and close to how patients search. Keep the
  service names; simplify the grouping.
- **Brand colors.** Navy and teal are already recognizable from the logo.

## 3. What fails (retire)

### 3.1 Trust and credibility

- People photos look AI-generated or stock: the dentist with a patient, the
  smiling doctor on the about page, the receptionist on the contact page, the
  waiting room with the logo on a TV. Patients notice. This contradicts the
  real videos on the same page and costs credibility.
- No dentist names, faces, specialties or medical council numbers anywhere.
  For a medical (YMYL) site this is the largest trust and SEO gap.
- Stats float without context or proof («۴ کلینیک تخصصی» is unclear).
- The brand name has five variants: کلینیک دندانپزشکی سفید، کلینیک سفید،
  سفید دنتال، کلینیک سفید دنتال، دندانپزشکی دیجیتال سفید. Inconsistent naming
  weakens brand search and local SEO (NAP consistency).
- No license number or technical supervisor in the footer.

### 3.2 Conversion

- Three large white boxes render empty (home CTA band, contact, about). They
  are broken embeds, most likely the booking form and the map. The main
  conversion path is broken on every page we saw.
- CTAs duplicate intents with different labels: «تماس با ما», «رزرو نوبت»,
  «مشاورهٔ رایگان», «خدمات ما», all in the same navy button style. No visual
  priority.
- No phone button in the first viewport on phones (inferred from the desktop
  header; the phone menu shows no call action).
- No emergency path, no pricing or payment information, no insurer names,
  no financing.
- The CTA band repeats the same copy on every page.

### 3.3 Information architecture and navigation

- Three levels of nesting in the phone menu (خدمات درمانی دندان > جایگزینی
  دندان > ایمپلنت). Each level is a full-width teal bar; the open menu has no
  visible close button and the page shows behind it.
- «تماس با ما» is a dropdown (it likely hides «درباره ما»), which is an
  unexpected place for the about page.
- 7 top-level items plus a CTA on desktop: above the Hick's-law budget of
  5 for a first-time patient.
- No breadcrumbs, no hub page for services (inferred), no dentists section,
  no before/after gallery.

### 3.4 Visual design

- Centered everything, small body text, long gray paragraphs with no
  hierarchy, the same navy button everywhere, generic rounded image blocks,
  no rhythm between sections. It reads as a theme template.
- Hero: a stock smile with the logo pasted on top. Two competing focal
  points and no message in the image.
- Section headings are generic («چرا کلینیک دندانپزشکی سفید؟», «روش‌های
  نوین در دندان‌پزشکی»).
- No dark mode, no motion beyond a carousel.

### 3.5 SEO (inferred from screenshots; verify with the backup)

- Thin, generic paragraphs that could belong to any clinic; repeated across
  pages.
- No author, reviewer, sources or dates visible on content.
- Likely missing structured data (no visible FAQ, breadcrumbs, reviews).
- Web search from outside Iran returns nothing for the brand name, and the
  origin is not reachable from abroad. If Googlebot is blocked the same way,
  the site cannot rank at all. See risk R1.

## 4. Implications for the new site

| Finding | Response in the new site |
|---|---|
| Broken booking embeds | Native one-field booking form, server-rendered, works without JS |
| Fake-looking people | Real photography only; labeled placeholders until the shoot |
| No dentists | Dentist hub and profiles with council numbers; reviewer boxes |
| Name variants | One canonical name everywhere: «کلینیک دندانپزشکی سفید»; short form «کلینیک سفید» in body copy only |
| Deep phone menu | Two levels max; grouped drawer; sticky call, WhatsApp and booking bar |
| No money information | Pricing and payment page with insurers, financing, FAQ |
| No emergency path | Gated emergency page |
| Generic copy | Specific, sourced, reviewed copy per the copy guidelines |
| Real videos unused for SEO | Testimonials with posters, transcripts and `VideoObject` schema |
| Free consultation button | Keep only if the client confirms the offer |
