# Sefid Dental Clinic Website - Project Brief

Status: v1, discovery complete (2026-10-11).
This file is the source of truth for every build phase. If code, a prompt or a
report contradicts it, this file wins. If this file is wrong, fix it in the same
commit as the change that revealed the error.

## 1. Project summary

Rebuild `sefiddental.ir` from scratch as a custom, modern, Persian (RTL) website
for کلینیک دندانپزشکی سفید (Sefid Dental Clinic), a single-branch digital dental
clinic in south Tehran. The current site is generic, has broken embeds and
stock or AI-looking people photos, and does not rank.

The new site must:

1. Rank on Google page 1 for brand and local queries as fast as realistically
   possible, and build toward competitive service queries.
2. Convert visitors into appointments through the fastest possible booking
   form, phone calls and WhatsApp.
3. Look and feel like a large, premium, calm clinic. Visitors should ask who
   designed it.
4. Be flawless on mobile first, then tablet and desktop. Alignment, spacing and
   typography must be exact.
5. Be maintainable by the receptionist and the client (one blog post every 2-3
   days) through a Persian admin panel.

## 2. Business facts

| Item | Value |
|---|---|
| Name (fa) | کلینیک دندانپزشکی سفید. Short forms: کلینیک سفید، سفید دنتال |
| Name (en) | Sefid Dental Clinic. Logo lockup text: "DENTAL . CLINIC" |
| Positioning line in use | «اولین کلینیک دندانپزشکی دیجیتال جنوب تهران» |
| Contact-page headline in use | «میزبان لبخند شما هستیم» |
| Branches | One |
| Address | تهران، خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲ |
| Landline | 021-55101054 (displayed as 021 5510 1054) |
| Mobile | 0920-545-1054 (WhatsApp and Telegram assumed on this number; confirm) |
| Hours | Every day 10:00-20:00 except official holidays |
| Social | Instagram (just started), Telegram, WhatsApp |
| Maps | Listed on Neshan and Balad. No Google Business Profile yet (client will create) |
| Domain | sefiddental.ir only |
| Stats on the old site | 13 years of activity, 4 "specialty clinics", 7 specialist dentists, 10 insurances. Verify every number before use |

Positioning and offer:

- Claimed USP: digital dentistry, first digital clinic in south Tehran,
  meticulous and aesthetic work. The equipment list is not provided yet. Never
  invent device names or brands.
- Top revenue services, in order: ceramic laminate and composite veneers,
  crowns, implants, VIP and CIP restorations.
- Restoration tiers:
  - معمولی: standard restoration with mid-grade materials, the common offer.
  - VIP: premium materials and the clinic's dentist's skill. Form and surface
    match a natural tooth. Only this clinic's dentist performs it.
  - CIP: VIP plus color characterization (staining and tinting), so the color
    matches naturally as well.
- Patient source today: mostly referrals.
- Target market: Tehran city center and south. Primary area خانی‌آباد نو.
  Secondary neighborhoods to be confirmed.
- Competitors: one local clinic whose only edge is 60-month installments.
- Insurance strategy: focus on cash patients and insurers that settle well.
  Featured by name: بیمه ایران، کارآفرین، پاسارگاد، البرز، بیمه ما. Everything
  else is grouped as «سایر بیمه‌ها».
- Financing (no in-house installments):
  - Partner loan up to ۲۰۰ میلیون تومان. The patient applies with the clinic's
    invoice. Approved 2026-10-10. Partner name and terms pending.
  - Dental credit up to ۱۰۰ میلیون تومان. Approval pending.
  - Both cost about 20-30% more than cash. State this transparently.
  - Each option has an admin toggle and stays hidden until the client confirms
    names and terms.
- Emergency: same-day slots for patients in real pain, "if possible". Must be
  gated against abuse (see Decisions).
- Pediatric dentistry and orthodontics are offered.

## 3. Audience and psychology

Personas (for copy, imagery and CTA placement; never shown as literal segments):

1. Cosmetic seeker, 22-45, Instagram-literate. Wants laminate, composite or
   smile design. Fears an unnatural result and hidden costs. Convinced by
   before/after, real dentist faces, price ranges, financing.
2. Restorative patient, 35-65. Needs implant, crown or root canal. Fears pain
   and upselling. Convinced by credentials, calm explanations, insurer names,
   tier transparency.
3. Anxious patient. About one in six adults has high dental fear. Needs a
   "what happens on the first visit" page, photos of the space and team,
   pain-management messaging, and a way to ask before booking (WhatsApp).
4. Parent booking for a child. Needs the pediatric page, hours, parking,
   friendliness cues.
5. Emergency visitor in pain. One-thumb mobile user. Needs a phone button in
   the first viewport and a visible emergency path.

Research to apply (cite in reports, apply in design):

- First impressions form in about 50 ms (Lindgaard et al. 2006). 46% of
  credibility judgments cite visual design (Fogg, Stanford 2003). The first
  viewport must be calm, aligned and real.
- 53% of mobile visits abandon pages slower than 3 s (Google 2017). About +8%
  conversion per 0.1 s saved (Deloitte 2020). Performance budgets are design
  constraints, not afterthoughts.
- 49% of phone use is one-thumb (Hoober 2013). Primary actions live in a
  bottom sticky bar on mobile.
- Hick's law and cognitive load: at most 5 primary nav items, one primary CTA
  per section, booking on one screen.
- Social proof and authority (Cialdini): real reviews, before/after with
  consent, license numbers, memberships, named insurers.
- Peak-end rule (Kahneman): the booking confirmation screen and the first call
  or SMS are designed moments.
- Faces attract attention and gaze direction steers it. Real photography only,
  subjects looking toward the content or CTA.

## 4. Brand

- Logo: Persian wordmark «سفید» in navy with a long horizontal bar and square
  diamond dots, a teal tooth-shaped mark, and "DENTAL . CLINIC" in teal.
  Source: `content/brand/logo-horizontal.png` (PNG only; SVG requested).
- Palette (`content/brand/palette.pdf`): teal `#00827A` (primary), deep teal
  `#00655F`, navy `#0A243F`, orange `#E07F38`, peach `#E8AF76`, green
  `#77BA6B`, red `#DA2031`, yellow `#FFE95A`, sky `#59C1EF`, burgundy
  `#8A2A38`. Roles are defined in `docs/design-direction.md`.
- Feel: calm and warm, modern and premium, trustworthy. Patients should relax.
  Not sterile, not loud, not "startup".
- Motion: Apple-like restraint, one signature intro, a few scroll-driven
  moments. Details in `docs/design-direction.md`.
- Dark mode: automatic from the system, with a manual toggle. Both themes
  equally polished.

## 5. Scope v1

Pages (Persian slugs; the sitemap is `docs/ia.md`):

- خانه
- خدمات hub, 4 categories plus 2 standalone services, one page per service,
  including the tiered «ترمیم دندان» page (معمولی / VIP / CIP) with a short
  alias route `/vip`
- پزشکان hub and one profile page per dentist
- هزینه و پرداخت: "from" prices when provided, insurers, financing, FAQ
- قبل و بعد gallery, consent-only, filterable by service
- راهنمای بیمار hub: اولین مراجعه، ترس از دندانپزشکی، مراقبت‌های بعد از درمان
- اورژانس: gated emergency request plus call
- درباره ما, تماس با ما (static map, direction deep links, hours, access notes)
- رزرو نوبت page, booking modal reachable from every CTA, thank-you page
- مقالات (articles) with categories, tags, dentist authors, reviewer, sources
- حریم خصوصی, 404, 500 and maintenance pages, all branded

Features:

- Admin panel (Filament, Persian, RTL) with roles admin and editor
- Booking workflow with statuses, notes and click-to-call
- Notification abstraction: log and email now; Telegram and Farapayamak SMS
  adapters later
- SEO engine: meta, JSON-LD, sitemap, redirects manager, OG images, RSS
- Media pipeline: AVIF/WebP conversions, responsive sizes, blur placeholders
- Analytics events for call, WhatsApp, booking, emergency, directions
- Dark mode, motion system, system status page, health endpoint

Out of scope for v1: online payment or deposit, real-time calendar booking,
multilingual content (routing stays i18n-ready), patient portal, Instagram API
feed (a curated manual grid is fine), clinic-software integration (keep the
booking model mappable and exportable).

## 6. Constraints

- Language: Persian only for v1. Code and developer docs in English. Build
  i18n-ready routes and translation files from day one.
- Hosting: shared cPanel with WHM access. Provider unknown. Probe PHP version,
  extensions, SSH, cron and Node in phase 3. Deployment habit: GitHub repo,
  auto deploy on push to `main`. No long-running Node process in production.
  Server-rendered PHP is mandatory.
- No WordPress. Custom build.
- Iranian network realities: self-host fonts, scripts and styles. No Google
  Fonts link. No Google Maps JavaScript (billing is impossible from Iran).
  Use a static map image plus deep links. Expect slow mobile networks. The
  site must work with zero third-party requests.
- SMS: the client has a Farapayamak panel. Integrate later behind an interface.
- Clinic management software: unknown. Keep bookings exportable (CSV).
- No launch deadline. Quality is the deadline. Still ship in phases with gates.
- Legal: Iranian medical advertising rules. No guarantees, no unprovable
  superlatives, no disparaging other dentists. Before/after only with written
  consent (the client confirms it exists). Display the clinic license and
  technical supervisor (مسئول فنی) in the footer once provided.

## 7. Quality bar (non-negotiable)

Performance on a simulated mid-range Android over 4G:

| Metric | Budget |
|---|---|
| LCP | <= 2.5 s |
| INP | <= 200 ms |
| CLS | <= 0.05 |
| TTFB | <= 0.8 s |
| Initial JS on content pages | <= 60 KB gzipped |
| Total JS including deferred motion libraries | <= 120 KB gzipped |
| CSS | <= 40 KB gzipped |
| Fonts (all subsets) | <= 120 KB |
| Lighthouse mobile | Performance >= 95, Accessibility 100, Best Practices 100, SEO 100 |

Lighthouse targets apply to: home, one service page, one doctor page, one blog
post, booking page, in both themes.

Accessibility: WCAG 2.2 AA. Complete keyboard access, visible focus, 44x44 CSS
px targets, labels above fields, errors below fields, reduced motion respected,
contrast verified in both themes.

Responsive: dedicated layouts for phones (360-430), tablets (744-1024) and
desktops (1280-1536+). No horizontal scroll at any width from 320 px up. Fluid
type with `clamp()`.

RTL: logical CSS properties only. LTR islands for numbers, phones, URLs and
Latin text. Icon mirroring rules. Persian digits in Persian text. Correct ZWNJ.

SEO: server-rendered HTML, one H1, semantic headings, Persian slugs, canonical,
sitemap, robots, JSON-LD, 301 manager, OG and Twitter cards, no render-blocking
third parties.

Security: HTTPS and HSTS, CSP with nonces, security headers, CSRF, rate limits,
honeypot and time trap, validation at every boundary, Eloquent parameterized
queries, least-privilege roles, MFA for admin, secrets only in environment
variables.

Honesty: no invented facts, numbers, device brands, doctor names or reviews.
Placeholders are explicit `[[NEEDS_CLIENT: ...]]` markers and are tracked in
`docs/content/gaps.md`.

## 8. Decisions log

| # | Decision | Rationale |
|---|---|---|
| 1 | Stack: PHP 8.3, Laravel (current stable), Filament (current stable) admin, Blade, Tailwind CSS v4, Alpine.js, GSAP (ScrollTrigger, Flip, MorphSVG), optional Three.js for one lazy scene | First-class on shared cPanel, server-rendered for SEO, production-grade RTL admin. Node SSR on shared hosting is fragile. |
| 2 | Deploy: GitHub Actions builds (Composer, Vite) and publishes a `deploy` branch, or rsyncs, that cPanel pulls. Document root is `public/` | Matches the client's push-to-deploy habit without Composer or Node on the host. Probe in phase 3. |
| 3 | Persian slugs, flat services (`/خدمات/لمینت-سرامیکی`), editable in admin; ASCII for system routes and query parameters. Full sitemap in `docs/ia.md` | Better relevance and CTR in Persian SERPs. Google handles UTF-8 slugs. |
| 4 | Prices: optional «از … تومان» per service, hidden when empty. The tiers page shows relative positioning unless prices are provided | Transparency builds trust; inflation makes fixed prices stale; admin controls it. |
| 5 | Financing options behind admin toggles with a transparent surcharge note | Terms are not final. Honesty is a trust signal and a legal safety. |
| 6 | Emergency: a separate gated request with triage questions, "if possible, same day", call-first during hours, rate-limited, flagged in admin | Serves real pain without turning every booking into an emergency. |
| 7 | Intro animation built from the logo's own elements, <= 1.4 s, once per session, skippable, never blocks LCP, static under reduced motion | Memorable and on-brand without the cost of a blocking preloader. |
| 8 | Motion budget: one intro, three scroll-driven signature moments, subtle reveals elsewhere | "Everything moves" fatigues users and kills mobile performance. |
| 9 | Photography: real clinic photos only. AI-generated or stock people are banned | The old site's AI-looking doctor photo is a trust leak. |
| 10 | Notifications: pluggable notifier. Log and email now, Telegram and Farapayamak later | Client decision. Keeps phase 5 unblocked. |
| 11 | Analytics: GA4 and Search Console (client creates). Custom events for call, WhatsApp, booking, emergency, directions | Client preference. Matomo optional later. |
| 12 | Maps: static map image plus deep links to Google Maps, Neshan, Balad and Waze | No Google billing from Iran. Fast. Works everywhere. |
| 13 | Fonts: Vazirmatn (body) and Estedad (display), self-hosted, Persian and Latin subsets | Free (OFL), excellent Persian shaping, variable, modern. |
| 14 | Insurers: five featured by name, the rest under «سایر بیمه‌ها», all admin-managed | Client strategy: cash patients first. |

## 9. Pending inputs from the client

Tracked with status in `docs/content/gaps.md`.

- Vector logo (SVG), or permission to trace the PNG
- Dentists: name, specialty, medical council number, degree, photo, short bio, services
- Clinic license number and technical supervisor name for the footer
- Real photos and videos of the clinic, team and equipment
- Before/after pairs with consent; the three testimonial videos from the old site
- Equipment list, only if "digital" claims should name devices
- Financing partner names and exact terms; confirm the 200M and 100M figures
- WhatsApp and Telegram numbers, Instagram handle
- Hosting facts: provider, PHP version, SSH, cron, Node, document root control
- Old site backup for the 301 map and content; Search Console and GA4 IDs
- Google Business Profile creation (guide delivered in phase 1)
- Parking and public transport notes; secondary neighborhoods
- "From" prices, if they should be shown

## 10. Process

Ten phases, one prompt each, in `docs/prompts/`. Every phase ends with a report
in `docs/reports/`, screenshots in `docs/qa/`, and a gate: the client approves
or requests changes before the next phase starts. `docs/prompts/00-master.md`
defines the rules that apply to every phase.
