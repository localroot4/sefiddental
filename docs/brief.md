# Sefid Dental Clinic Website - Project Brief

Status: v2, discovery complete and the experience brief revised (2026-10-11):
Next.js, WebGL 2, cinematic scroll experience with game-style quality tiers.
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
3. Look and feel like a large, premium, calm clinic, and deliver a cinematic
   scroll experience in the spirit of Immersive Garden (immersive-g.com) and
   hidokmeh.com: one continuous world built around the logo and the tooth,
   direction changes (vertical, horizontal, diagonal), WebGL scenes, and a
   playful footer. Visitors should keep scrolling for pleasure and ask who
   designed it. Details: `docs/experience-direction.md`.
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
- First consultation is free (client, 2026-10-12). Say it plainly; the
  client may withdraw it later, so it is a setting, not hard-coded copy.
- Callback: during opening hours reception usually calls within 5 to 10
  minutes, depending on traffic. Copy says «معمولاً تا ۱۰ دقیقهٔ دیگر»; the
  minutes and the caller number are settings in admin.
- Dentists and specialists: unknown for now; the client adds and edits them
  in admin. Nothing is invented; sections that need dentists stay hidden
  until at least one is published.
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
  diamond dots, a teal mark, and "DENTAL . CLINIC" in teal. The client reads
  the mark as toothpaste squeezed onto a toothbrush head, and the long bar
  of the wordmark as the brush handle. Source: `content/brand/logo-horizontal.png`
  and the traced `content/brand/logo-horizontal.svg`, cleaned into
  `design/brand/`. The client's approval of the trace was asked at the phase 2
  gate and is still pending on 2026-10-13. Phase 3 uses the trace as is;
  launch needs an explicit yes or the original vector (gap 1).
- Signage: the sign reads «کلینیک دندانپزشکی سفید» with the logo; this is
  the canonical name everywhere.
- Palette (`content/brand/palette.pdf`): teal `#00827A` (primary), deep teal
  `#00655F`, navy `#0A243F`, orange `#E07F38`, peach `#E8AF76`, green
  `#77BA6B`, red `#DA2031`, yellow `#FFE95A`, sky `#59C1EF`, burgundy
  `#8A2A38`. Roles are defined in `docs/design-direction.md`.
- Feel: calm and warm, modern and premium, trustworthy. Patients should relax.
  Not sterile, not loud, not "startup".
- Motion: cinematic on the home experience (quality-tiered WebGL, 60 fps
  target), calm and light on content pages. Details in
  `docs/experience-direction.md`.
- Dark mode: automatic from the system, with a manual toggle. Both themes
  equally polished.

## 5. Scope v1

Pages (Persian slugs; the sitemap is `docs/ia.md`):

- خانه
- خدمات hub, 3 categories plus 2 standalone services, one page per service,
  including the tiered «ترمیم دندان» page (معمولی / VIP / CIP) with a short
  alias route `/vip`
- پزشکان hub and one profile page per dentist
- هزینه و پرداخت: "from" prices when provided, insurers, financing, FAQ
- قبل و بعد gallery, consent-only, filterable by service
- راهنمای بیمار hub: اولین مراجعه، ترس از دندانپزشکی، مراقبت‌های بعد از درمان
- اورژانس: gated emergency request plus call
- درباره ما, آدرس و ساعات (static map, direction deep links, hours, access notes)
- رزرو نوبت page; a booking modal for CTAs on pages without an inline booking form (home routes its CTAs to the hero card or the scene 10 block, decision 19); thank-you page
- مقالات (articles) with categories, tags, dentist authors, reviewer, sources
- حریم خصوصی, 404, 500 and maintenance pages, all branded

Features:

- Admin panel (Payload, Persian, RTL) with roles admin and editor
- Home experience: 11 scroll scenes with WebGL, quality tiers, footer playground
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
booking model mappable and exportable), WebGL on content pages beyond the
optional molar on the restoration page, sound.

## 6. Constraints

- Language: Persian only for v1. Code and developer docs in English. Build
  i18n-ready routes and translation files from day one.
- Hosting: the client wants no new cost if possible. Phase 3 probes the
  existing cPanel server first (root access through WHM, or the cPanel
  Node.js app feature) and uses it when it can run Node dependably; a Node
  PaaS inside Iran (Liara, else ArvanCloud) is the fallback. Deployment
  habit stays: push to `main`, auto deploy. Details and the probe checklist
  in `docs/architecture.md` section 2.
- No WordPress. Custom build.
- Heavy motion lives on the home experience only. Service, dentist, article,
  pricing, address, booking and emergency pages stay light and server-
  rendered; they carry the SEO and the conversions.
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

Performance on a simulated mid-range Android over 4G, per page class
(full table in `docs/experience-direction.md` section 4):

| Metric | Home experience | Content pages | Booking and emergency |
|---|---|---|---|
| LCP | <= 2.5 s (scrim text on phones, the hero photo from 744 px) | <= 2.5 s | <= 2.0 s |
| INP | <= 200 ms | <= 200 ms | <= 200 ms |
| CLS | <= 0.05 | <= 0.05 | <= 0.05 |
| Initial JS (gzipped) | <= 180 KB | <= 90 KB | <= 70 KB |
| WebGL assets | tiered: 2.5 MB / 1.2 MB / 0.5 MB / none | none | none |
| Frame rate | 60 fps at tiers 3 and 2, >= 50 fps at tier 1, no WebGL at tier 0 | n/a | n/a |
| Lighthouse mobile | Performance >= 90 (tier 1 settings), others 100 | Performance >= 95, others 100 | Performance >= 95, others 100 |

CSS <= 50 KB gzipped. Fonts <= 120 KB. Lighthouse targets apply in both
themes.

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
| 1 | Stack: Next.js (current stable, App Router, TypeScript), Payload CMS 3 inside the app (admin `/admin`, Persian, RTL), PostgreSQL, Tailwind CSS v4, Motion for UI, GSAP plus Lenis for scroll, three.js with React Three Fiber for WebGL 2, `detect-gpu` plus a frame monitor for quality tiers | The client chose Next.js and a WebGL experience; Payload keeps the CMS in the same codebase and deploy; server components keep content pages light and SEO-first. Replaces the Laravel plan of v1. |
| 2 | Deploy: GitHub Actions on push to `main` builds, tests and deploys to a Node host (Liara or ArvanCloud PaaS, or the client's VPS); managed PostgreSQL and object storage for media | Next.js with Payload needs Node and a database. Keeps the push-to-deploy habit. The hosting path is confirmed once gap 32 closes, and settled before phase 7 (decision 21). |
| 3 | Persian slugs, flat services (`/خدمات/لمینت-سرامیکی`), editable in admin; ASCII for system routes and query parameters. Full sitemap in `docs/ia.md` | Better relevance and CTR in Persian SERPs. Google handles UTF-8 slugs. |
| 4 | Prices: optional «از … تومان» per service, hidden when empty. The tiers page shows relative positioning unless prices are provided | Transparency builds trust; inflation makes fixed prices stale; admin controls it. |
| 5 | Financing options behind admin toggles with a transparent surcharge note | Terms are not final. Honesty is a trust signal and a legal safety. |
| 6 | Emergency: a separate gated request with triage questions, "if possible, same day", call-first during hours, rate-limited, flagged in admin | Serves real pain without turning every booking into an emergency. |
| 7 | Intro built from the logo's own elements, <= 1.4 s, once per session, skippable, never blocks LCP; its mark mask reveals the hero; the WebGL world mounts beneath after load, renders no frames while the hero photo covers the viewport and appears as the hero scrolls away (decision 19) | Memorable and on-brand without a blocking preloader; the bar doubles as the real loading line for the experience. |
| 8 | Motion: a cinematic, scroll-driven WebGL journey on the home page («سفر یک لبخند», 11 scenes with vertical, horizontal and diagonal movement and a physics footer), with four quality tiers and a 60 fps target; content pages keep subtle motion only | The client wants an Immersive Garden-class experience; tiers keep weak devices smooth and content pages keep SEO and conversion safe. Replaces the "Apple-like restraint" decision of v1. |
| 9 | Photography: real clinic photos only. AI-generated or stock people are banned | The old site's AI-looking doctor photo is a trust leak. |
| 10 | Notifications: pluggable notifier. Log and email now, Telegram and Farapayamak later | Client decision. Keeps phase 5 unblocked. |
| 11 | Analytics: GA4 and Search Console (client creates). Custom events for call, WhatsApp, booking, emergency, directions | Client preference. Matomo optional later. |
| 12 | Maps: static map image plus deep links to Google Maps, Neshan, Balad and Waze | No Google billing from Iran. Fast. Works everywhere. |
| 13 | Fonts: Vazirmatn (body) and Estedad (display), self-hosted through `next/font/local`, Persian and Latin subsets | Free (OFL), excellent Persian shaping, variable, modern. |
| 15 | Scroll is never hijacked; pinned and horizontal scenes exist only at 1024 px and wider; phones get vertical, lighter versions of every scene | Mobile is the client's first priority; native scroll keeps accessibility and performance. |
| 16 | Quality tiers 0-3 chosen by GPU benchmark, device signals and a live frame monitor, with a user override | Game-style settings keep 60 fps on strong devices and a complete, fast site on weak ones. |
| 14 | Insurers: five featured by name, the rest under «سایر بیمه‌ها», all admin-managed | Client strategy: cash patients first. |
| 17 | Hosting: the existing cPanel server if the phase 3 probe passes (root through WHM, or the cPanel Node.js app with Node 20+ and 1 GB), else a Node PaaS in Iran (Liara, else ArvanCloud) | Next.js with Payload needs a running Node process and a database; the client prefers no new cost; a probe decides on facts, not guesses. |
| 18 | «مشاورهٔ رایگان» is used as a fact, controlled by a feature flag | Client confirmed the offer and may withdraw it. |
| 19 | Home hero: direction B (`design/hero-directions/b.html`); direction A (`a.html`) stays in the repo as an archived reference. From 744 px: a full-bleed landscape photo (the LCP element, one preload with a media query and `fetchpriority=high`), the scrim at the start side, the booking card at the end side, the trust band on the hero's bottom edge (2x2 from 744 px, one row of four from 1024 px). Phones (< 744 px): scrim, card, then a 4:5 photo band with the four facts on its bottom edge; a scrim text element (the H1 or the subtext) is the LCP element, never an image, and the scrim-and-card block fills the first screen, so the band starts below it and the photo loads without priority. The scrim keeps one secondary action, «تماس با کلینیک»; the card's «ثبت درخواست» is the only primary CTA in the hero. Home has two instances of the one booking form: the compact hero card (phone field plus hidden fields) and the full block in scene 10; `booking_submit` carries `location` = `hero` or `block`; header and sticky-bar «رزرو نوبت» focus the hero phone field while the card is in view, else scroll to the scene 10 block. Home stays static or ISR; both forms fetch their tokens and the hours state from the no-store endpoint. The phone sticky bar stays visible while the hero card is in view. The card shows a compact success in place at a reserved height. No WebGL over the hero photo; the phase 7 exit is native scroll with a light photo parallax. The static mark relief over the photo is judged over the first real photo. Inner pages keep family A with the media in a plain 24 px frame, without the mark mask; B is home only. Photo brief: gap 36 | Client choice at the phase 2 gate, 2026-10-13: the first viewport carries the promise, the form and the proof together. The studio made the knock-on calls the same day to keep LCP, INP and CLS in budget and one primary CTA per view. Details: `docs/conversion.md`, `docs/experience/storyboard.md`, `docs/design/DESIGN.md`. |
| 20 | Taste feedback only on real pages and scenes. Prototype drafts (`design/prototypes/`, `docs/qa/phase-02/`) are technical proofs, not the final look, and the client does not judge them. Taste questions move to the phase 7 hand-off (the client scrolls the real home page on a phone and a desktop: keep, tone down or change, and which scene feels closest to immersive-g.com and hidokmeh.com and which does not) and to the same comparison in the phase 8 real-device checklist | On 2026-10-13 the client said they watched all recordings and screenshots, and that drafts that will not appear on the site as they are cannot be judged. Gap 33 (recordings of the reference sites) stays open but optional. |
| 21 | Phase 3 starts host-agnostic while gap 32 is open: every deliverable runs on environment-driven configuration (database adapter, media storage, base URL). The deploy pipeline, the staging target and the chosen-path steps of `docs/deploy.md` wait until the client confirms the path. If the host has not answered by the end of the phase 3 build, the phase 3 hand-off asks the client to choose C1 or A. Hosting is settled before phase 7 | The host had not answered the Node.js ticket on 2026-10-13. The phase 7 hand-off needs a staging URL that the client opens on a phone. |
| 22 | Molar (scene 4): the stylized in-house molar (`design/brand/3d/molar.glb`, free, built) is the default until the client decides. Phase 7 uses the SVG stepper, so the 3D molar is first needed in phase 8; there both molars are rendered side by side and the client picks from two pictures. Realistic candidate: University of Dundee School of Dentistry, "Maxillary First Molar (Left)" on Sketchfab, reported as CC BY 4.0 (CT-based ZBrush sculpt, about 28.5k triangles, three roots). Before use, a person confirms the license field on the model page and keeps the downloaded `license.txt`. Duties: a credit line with links to the model page and the license on a credits page linked from the footer, and a note that we modified the file. Paid marketplaces (CGTrader, TurboSquid, Fab) are ruled out. Paid fallback: a model commissioned from an Iranian 3D artist, paid in rial (for example through Ponisha), with a written transfer of rights that allows web distribution. No money is spent without the client's explicit approval of the price. A doc that calls the molar "anatomical" notes this choice | The client did not understand the molar question at the gate; it was explained in plain Persian on 2026-10-13, with no new question. The marketplaces' standard licenses forbid a GLB that visitors can extract from the browser, and paying from Iran needs an intermediary. Sketchfab was not reachable from the build environment, so the Dundee license is reported, not verified. |

## 9. Pending inputs from the client

Tracked with status in `docs/content/gaps.md`.

- Logo: a yes on the in-house trace, shown in the phase 3 hand-off as the final asset `design/brand/logo-horizontal.svg` beside the client's original PNG (yes or no), or the original vector files (gap 1)
- Dentists: name, specialty, medical council number, degree, photo, short bio, services
- Clinic license number and technical supervisor name for the footer
- Real photos and videos of the clinic, team and equipment
- The home hero photo for direction B: an empty clinic interior, landscape plus a 4:5 crop (gap 36; shot list section ۰)
- Before/after pairs with consent; the three testimonial videos from the old site
- Equipment list, only if "digital" claims should name devices
- Financing partner names and exact terms; confirm the 200M and 100M figures
- WhatsApp and Telegram numbers, Instagram handle
- Hosting: the host's answer to the cPanel Node.js ticket (gap 32, no answer on 2026-10-13); if the host cannot enable Node 20 or 22, or has not answered by the end of the phase 3 build, the client chooses C1 (WHM root access) or A (a Liara account, a small monthly fee the client approves)
- Old site backup for the 301 map and content; Search Console and GA4 IDs
- Google Business Profile creation (guide delivered in phase 1)
- Parking and public transport notes; secondary neighborhoods
- "From" prices, if they should be shown
- 3D brand: in the phase 8 hand-off, a yes on the mark as a porcelain relief, shown in the real scene next to the two molar pictures (yes or no; decision 20), and the molar choice from those two pictures, with the in-house molar as the default (gap 34, decision 22)
- Optional: phone and desktop recordings of the two reference sites (gap 33)

## 10. Process

Ten phases, one prompt each, in `docs/prompts/`. Every phase ends with a report
in `docs/reports/`, screenshots in `docs/qa/`, and a gate: the client approves
or requests changes before the next phase starts. `docs/prompts/00-master.md`
defines the rules that apply to every phase.
