# Conversion Specification

How a visitor becomes an appointment. Binding for phases 4, 5 and 7.
Microcopy is final draft; the client approves it at the phase 1 gate.
`[[NEEDS_CLIENT: ...]]` marks text that waits for a fact.

## 1. Principles

1. Three actions everywhere, one thumb away: call, WhatsApp, booking.
2. One primary CTA per section. Secondary actions look secondary.
3. The booking form asks for one thing: a mobile number. Everything else is
   optional and prefilled when the page already knows it.
4. Never promise what the clinic cannot keep: no guaranteed slot, no
   guaranteed result, no time promise the receptionist has not confirmed.
5. Outside opening hours, the site says so and makes the form the primary
   action; call buttons remain with honest copy.
6. Every interaction ends in a designed state: success, specific error, or a
   fallback (call, WhatsApp).

## 2. One label per intent

| Intent | Label | Target |
|---|---|---|
| Book | «رزرو نوبت» | booking modal; `/رزرو-نوبت` without JS |
| Call | «تماس با کلینیک»; «تماس» in the sticky bar | `tel:+982155101054` |
| WhatsApp | «پیام در واتساپ»; «واتساپ» in the sticky bar | `https://wa.me/989205451054?text=...` (number to verify) |
| Directions | «مسیریابی» | chooser: Google Maps, Neshan, Balad, Waze |
| Submit booking | «ثبت درخواست» | form submit |
| Emergency | «درد شدید دارید؟» | `/اورژانس` |
| Save contact | «ذخیرهٔ شمارهٔ کلینیک» | vCard download |

Banned as CTA labels: «تماس با ما» (ambiguous between call and contact
page), «بیشتر بدانید», «کلیک کنید», «مشاورهٔ رایگان» until the client
confirms the offer.

WhatsApp is the primary messenger: it is reachable in Iran without a VPN
since the restrictions were lifted in December 2024 (re-check before
launch; filtering policy changes). Telegram stays a
secondary link in the footer and contact page.

## 3. CTA map per template

| Template | Hero primary | Hero secondary | In-page | End of page |
|---|---|---|---|---|
| T-home | رزرو نوبت | تماس با کلینیک | tier CTA (booking with tier), FAQ aside (call, WhatsApp, booking) | booking block |
| T-service | رزرو نوبت (service prefilled) | پیام در واتساپ (service text) | FAQ aside | booking block |
| T-service-tiers | رزرو نوبت | پیام در واتساپ | «انتخاب این سطح» per tier (booking with tier) | booking block |
| T-category, T-services-hub | none (orientation pages) | none | cell and card links | booking block |
| T-dentist | رزرو نوبت (dentist in note) | تماس با کلینیک | none | booking block |
| T-cases | none | none | per case: «رزرو نوبت» for that service | booking block |
| T-pricing | رزرو نوبت | پیام در واتساپ | financing: «پرسیدن شرایط در واتساپ» | booking block |
| T-guide, T-article | none | none | one inline CTA to the primary service | service CTA box |
| T-contact | تماس با کلینیک | مسیریابی | پیام در واتساپ | booking form |
| T-emergency | see section 7 | | | |
| T-system (404) | رزرو نوبت | تماس با کلینیک | links to services | none |

## 4. Phone sticky bar

- Visible below 1024 px on every template except T-booking,
  T-booking-success and T-emergency (they carry their own actions).
- Three equal cells, 64 px tall plus `env(safe-area-inset-bottom)`; icons
  above labels; «رزرو نوبت» is the filled primary cell.
- Always visible while the page scrolls. It hides only when (a) the page's
  booking block or the footer contact block is in view, (b) a form field has
  focus (keyboard open), or (c) the drawer or a modal is open. Use
  IntersectionObserver and focus events; no scroll listeners. The page gets
  bottom padding equal to the bar height so nothing is covered.
- Outside opening hours the call cell keeps its label; a long-press or the
  contact page explains hours. The form remains the primary cell.

Deviation from `docs/design-direction.md` section 6 (hide on scroll down):
a persistent bar converts better on phones and needs no scroll listener.
That file is updated in the same commit.

## 5. Booking flow

Entry points: header CTA, hero, sticky bar, section CTAs, tier selection,
dentist pages, pricing, article end boxes, 404, contact page (inline form),
`/رزرو-نوبت`.

Mechanics: every CTA is a real link to `/رزرو-نوبت?service={key}&tier={key}`
(ASCII parameters; the page canonicalizes to `/رزرو-نوبت`). With JavaScript,
the link opens the same form in a `<dialog>`; focus moves to the phone field;
Esc closes; focus returns to the opener. Without JavaScript, the page works
the same way.

### 5.1 Form (one screen, one required field)

| # | Field | Required | Spec |
|---|---|---|---|
| 1 | Phone | yes | label «شمارهٔ موبایل»; help «مثلاً ۰۹۱۲ ۳۴۵ ۶۷۸۹»; `type="tel"`, `inputmode="numeric"`, `autocomplete="tel"`, `dir="ltr"`; accepts Persian, Arabic and Latin digits, spaces, dashes, `+98`, `0098`, `0`; normalized to E.164 |
| 2 | Name | no | label «نام (اختیاری)»; `autocomplete="name"` |
| 3 | Service | no | label «برای چه خدمتی؟ (اختیاری)»; single-select chips: معاینه و مشاوره، زیبایی (لمینت، کامپوزیت، بلیچینگ)، ایمپلنت و جایگزینی دندان، ترمیم و روکش، درمان ریشه، ارتودنسی، دندانپزشکی کودکان، سایر؛ prefilled from the page |
| 4 | Preferred time | no | label «چه زمانی برای نوبت راحت‌ترید؟ (اختیاری)»; chips: صبح، عصر، فرقی ندارد |
| 5 | Note | no | collapsed behind «+ توضیح بیشتر»; label «توضیح (اختیاری)»; help «مثلاً: درد دارم، یا برای دو نفر نوبت می‌خواهم.»; max 500 characters with a live counter |
| hidden | tier, dentist, source URL, UTM, honeypot, time trap | | never shown |

Header: «درخواست نوبت». Lead: «شماره‌تان را بگذارید. پذیرش در ساعات کاری
تماس می‌گیرد و زمان دقیق نوبت را با شما هماهنگ می‌کند.»

Privacy line above the button: «شمارهٔ شما فقط برای هماهنگی نوبت استفاده
می‌شود.» with a link «حریم خصوصی». No consent checkbox; the line informs.

Button: «ثبت درخواست»; loading label «در حال ثبت»; the button keeps its
width; double submit is blocked.

Below the button, during opening hours only: «یا همین حالا تماس بگیرید:
۰۲۱ ۵۵۱۰ ۱۰۵۴».

### 5.2 Validation and errors (inline, below the field)

| Case | Message |
|---|---|
| Empty phone | «شمارهٔ موبایل را وارد کنید.» |
| Not a valid Iranian mobile | «شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.» |
| Landline entered | «برای هماهنگی سریع‌تر، شمارهٔ موبایل وارد کنید.» |
| Note too long | «توضیح حداکثر ۵۰۰ حرف است.» |
| Network failure | «ارسال انجام نشد. اتصال اینترنت را بررسی کنید و دوباره «ثبت درخواست» را بزنید. اگر باز هم نشد، با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید.» |
| Rate limit (4th request from one phone in a day) | «امروز از این شماره چند درخواست ثبت شده است. پذیرش به‌زودی تماس می‌گیرد. برای کار فوری تماس بگیرید.» |
| Server error | «مشکلی پیش آمد و درخواست ثبت نشد. لطفاً با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید.» (logged with the request id) |

Validation runs on blur and on submit, never on every keystroke. Errors
move focus to the first invalid field and are announced with
`aria-live="polite"`. Honeypot and time-trap failures return the normal
success page and store nothing (silent block).

Duplicates: a second request from the same phone within 10 minutes updates
the first one and shows the success state with «درخواست قبلی شما به‌روز شد.»

### 5.3 Success (peak-end moment)

Modal success state and `/رزرو-نوبت/ثبت-شد` (noindex) share one design:

1. A check mark that draws itself (static under reduced motion).
2. «درخواست شما ثبت شد»
3. Callback line, hours-aware:
   - Open: «پذیرش [[NEEDS_CLIENT: callback window, for example «تا یک ساعت دیگر»]] با شمارهٔ ۰۹۱۲ ••• ۶۷۸۹ تماس می‌گیرد.»
   - Closed: «ساعت کاری امروز تمام شده است. فردا از ساعت ۱۰ با شما تماس می‌گیریم.»
   - Holiday: «اولین روز کاری از ساعت ۱۰ با شما تماس می‌گیریم.»
4. «تماس از شمارهٔ ۰۲۱ ۵۵۱۰ ۱۰۵۴ خواهد بود. شماره را ذخیره کنید تا تماس را
   بشناسید.» with «ذخیرهٔ شمارهٔ کلینیک» (vCard with name, phones, address,
   site). Caller number to confirm with the client.
5. «برای مراجعه همراه داشته باشید»: کارت ملی، کارت بیمه در صورت استفاده،
   عکس‌های رادیوگرافی قبلی اگر دارید، فهرست داروهایی که مصرف می‌کنید.
6. Address with «مسیریابی», and «پیام در واتساپ» as the fallback.

## 6. Hours awareness

- Opening hours come from settings (weekly schedule plus holiday overrides),
  evaluated in Asia/Tehran.
- States: open, closing soon (last 30 minutes), closed, holiday.
- Full-page caching must not freeze the state: render the hours-dependent
  fragments from a tiny inline script that reads the schedule embedded in
  the page (nonce), or cache those pages with a 5-minute TTL. Decide in
  phase 3; record in the report.

## 7. Emergency flow (`/اورژانس`)

Goal: help people in real pain the same day when possible, without turning
every booking into an emergency.

### 7.1 Page order

1. H1 «درد شدید دندان دارید؟». Lead: «برای بیمارانی که درد شدید دارند، در
   صورت امکان همان روز نوبت می‌دهیم. اول چند سؤال کوتاه را جواب دهید.»
2. Safety box, always visible, warning token:
   «اگر ضربهٔ شدیدی به صورت خورده‌اید، ورم به اطراف چشم یا گردن رسیده،
   نفس کشیدن، قورت دادن یا حرف زدن سخت شده، یا خونریزی دهان بند نمی‌آید،
   همین حالا با اورژانس ۱۱۵ تماس بگیرید یا به نزدیک‌ترین بیمارستان بروید.»
   Source: NHS, "Dental problems" and "Toothache" pages (urgent signs);
   the reviewer dentist confirms in phase 6.
3. Triage (checkboxes, at least one required):
   - «درد شدیدی که با مسکن آرام نمی‌شود»
   - «ورم لثه یا صورت»
   - «دندان شکسته یا ضربه به دندان»
   - «دندانی که کامل از جا درآمده است» (shows: «اگر دندان دائمی است، فوراً
     تماس بگیرید. دندان را از تاج بگیرید، ریشه را لمس نکنید و آن را در
     شیر نگه دارید.» source: IADT guidelines, reviewer confirms)
   - «خونریزی بعد از کشیدن دندان که با فشار گاز بند نمی‌آید»
   If none fits: «هیچ‌کدام؟ برای درد خفیف یا مشکل غیرفوری، نوبت عادی
   بگیرید.» with a link to booking.
4. Open hours: a large «همین حالا تماس بگیرید» call button comes first.
   Below: «اگر تماس برقرار نشد، شماره‌تان را بگذارید.» and the form.
5. Closed hours: «ساعت کاری کلینیک تمام شده است. شماره‌تان را بگذارید؛ در
   اولین ساعت کاری با درخواست‌های فوری تماس می‌گیریم.» The form comes first.
   [[NEEDS_CLIENT: confirm "first hour" promise]]
6. Form: phone (required), name (optional), short note (optional). Button
   «ثبت درخواست فوری».
7. Self-care until the visit: a short, sourced block written in phase 6 and
   reviewed by a dentist (cold compress, painkiller as the package says, no
   aspirin on the gum, no heat).
8. Address and «مسیریابی».

### 7.2 Gating and abuse control

| Rule | Value |
|---|---|
| Triage required | at least one item checked or the form does not render |
| Rate limit per phone | 1 emergency request per 24 hours |
| Rate limit per IP | 3 emergency requests per 24 hours |
| Entry points | footer, phone drawer, mega menu row, booking form help text («درد شدید دارید؟»), root canal and extraction pages, 404; never in the primary nav or the sticky bar |
| Promise | «در صورت امکان»; never a guaranteed slot |
| Admin | red flag, top of the list, sound-free browser notification for logged-in staff; outcome field «واقعاً فوری بود» or «فوری نبود»; repeated misuse lets staff remove emergency priority for that phone |
| Measurement | share of emergency requests marked «فوری نبود» per month (KPI) |

## 8. WhatsApp prefill texts

| Context | Text |
|---|---|
| Generic | «سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.» |
| Service page | «سلام، از صفحهٔ {نام خدمت} در سایت کلینیک سفید پیام می‌دهم. می‌خواهم دربارهٔ {نام خدمت} بیشتر بدانم.» |
| Pricing, financing | «سلام، دربارهٔ شرایط پرداخت و {نام گزینه} سؤال دارم.» |
| After booking | «سلام، همین الان در سایت درخواست نوبت ثبت کردم.» |

Texts are URL-encoded; no personal data is added automatically.

## 9. Analytics events

GA4, loaded after `load`, never blocking. No phone numbers or names in any
event. Common parameters: `page_type`, `service_key` where relevant.

| Event | Trigger | Extra parameters |
|---|---|---|
| `booking_open` | modal opened or booking page viewed | `location` (header, hero, sticky, section, tier, aside, article, page) |
| `booking_submit` | valid submit sent | `has_name`, `time_pref`, `tier` |
| `booking_success` | server confirmed | `duplicate` (true, false) |
| `booking_error` | inline or server error shown | `error_type` |
| `call_click` | any `tel:` link | `location` |
| `whatsapp_click` | any WhatsApp link | `location` |
| `directions_click` | a map provider chosen | `provider` |
| `emergency_triage` | first triage item checked | `items_count` |
| `emergency_submit` | emergency request stored | `open_now` |
| `tier_select` | tier chosen in the comparison | `tier` |
| `case_slider_use` | first drag or key press on a compare slider | `service_key` |
| `save_contact` | vCard downloaded | none |
| `content_to_service` | article or guide link to a service page clicked | `from_slug` |
| `theme_toggle` | manual theme change | `to` |

Conversions in GA4: `booking_success`, `call_click`, `whatsapp_click`,
`emergency_submit`. Editors never touch JavaScript: links carry
`data-track="call_click" data-location="hero"` and one delegated listener
sends the events.
