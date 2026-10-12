# Conversion Specification

How a visitor becomes an appointment. Binding for phases 3, 4, 5 and 7.
Microcopy is a final draft; the client approves it at the phase 1 gate.
`[[NEEDS_CLIENT: ...]]` marks text that waits for a fact. Revised after the
independent review (see `docs/reports/phase-01.md`).

## 1. Principles

1. Three actions everywhere, one thumb away: call, WhatsApp, booking.
2. One primary CTA per section. Secondary actions look secondary.
3. The booking form asks for one thing: a mobile number. Everything else is
   optional and prefilled when the page already knows it. "One screen" means
   one step with no second page; on a 360x640 phone the submit button may
   need one short scroll.
4. Never promise what the clinic cannot keep: no guaranteed slot, no
   guaranteed result, no time promise the receptionist has not confirmed.
5. Outside opening hours the site says so, the form becomes the primary
   action, and no button dials a closed clinic without warning.
6. No silent failure. Every request either reaches the admin (possibly
   flagged) or the visitor sees a specific message and a fallback.

## 2. One label per intent

| Intent | Label | Target |
|---|---|---|
| Book | «رزرو نوبت» | booking dialog or inline form; `/رزرو-نوبت` without JS |
| Call | «تماس با کلینیک» | `tel:+982155101054` |
| WhatsApp | «پیام در واتساپ» | `https://wa.me/989205451054?text=...` (number to verify) |
| Directions | «مسیریابی» | chooser: گوگل‌مپ، نشان، بلد، ویز |
| Submit booking | «ثبت درخواست» | form submit |
| Submit emergency | «ثبت درخواست فوری» | emergency form submit |
| Emergency page | «درد شدید دارید؟» | `/اورژانس` |
| Address page | «آدرس و ساعات» | `/آدرس` |
| Save contact | «ذخیرهٔ شمارهٔ کلینیک» | vCard download |

Registered short forms, allowed only inside the phone sticky bar: «تماس»
for «تماس با کلینیک», «واتساپ» for «پیام در واتساپ». Nowhere else.

Banned as labels: «تماس با ما» (ambiguous between calling and the address
page), «بیشتر بدانید», «کلیک کنید», «همین حالا تماس بگیرید», «انتخاب این
سطح».

Free consultation (confirmed): the fact «مشاورهٔ اول رایگان است» appears in
the hero subtext, the booking lead and the pricing page, behind the feature
flag `freeConsultation`. It is a fact line, never a button label; the
button stays «رزرو نوبت». The booking chip «معاینه» becomes «معاینه و
مشاورهٔ رایگان» while the flag is on.

WhatsApp is the primary messenger: it has been reachable in Iran without a
VPN since the restrictions were lifted in December 2024 (re-check before
launch; filtering policy changes). Telegram stays a secondary link in the
footer and on the address page.

## 3. CTA map per template

| Template | Hero primary | Hero secondary | In-page | End of page |
|---|---|---|---|---|
| T-home | رزرو نوبت | تماس با کلینیک | tier step: رزرو نوبت (tier prefilled); FAQ aside: call, WhatsApp, booking | booking block |
| T-service | رزرو نوبت (service prefilled) | پیام در واتساپ (service text) | FAQ aside | booking block |
| T-service-tiers | رزرو نوبت | پیام در واتساپ | per tier: رزرو نوبت (tier prefilled) | booking block |
| T-services-hub, T-category | none | none | cell and card links | booking block |
| T-dentists-hub | none | none | card links | booking block |
| T-dentist | رزرو نوبت (dentist noted) | تماس با کلینیک | none | booking block |
| T-cases | none | none | per case: a text-style «رزرو نوبت» (secondary style, service prefilled) | one primary booking block |
| T-pricing | رزرو نوبت | پیام در واتساپ | financing: پیام در واتساپ (financing text) | booking block |
| T-about | رزرو نوبت | none | none | booking block |
| T-guide-hub, T-guide | none | none | one inline service link | booking block |
| T-articles | none | none | article cards | none |
| T-article | none | none | one inline link to the primary service | service box with رزرو نوبت |
| T-address | تماس با کلینیک | مسیریابی | پیام در واتساپ | booking form (no second map) |
| T-emergency | see section 7 | | | |
| T-system (404) | رزرو نوبت | تماس با کلینیک | links to services; «درد شدید دارید؟» | none |

Contextual emergency links: the root canal and extraction service pages
show a quiet «درد شدید دارید؟» text link under the hero. The home page does
not, by the client's wish to avoid misuse; home reaches the emergency page
through the FAQ, the drawer, the mega menu row and the footer.

## 4. Phone sticky bar

- Visible below 1024 px on every template except T-booking,
  T-booking-success and T-emergency (they carry their own actions).
- Three equal cells, 64 px tall plus `env(safe-area-inset-bottom)`, icon
  above label: «تماس» | «واتساپ» | «رزرو نوبت» (filled, primary).
- Always visible while the page scrolls. It hides only when (a) the page's
  booking block or the footer contact block is in view, (b) a form field has
  focus (keyboard open), or (c) the drawer or a dialog is open. Implemented
  with IntersectionObserver and focus events; no scroll listeners. The page
  gets bottom padding equal to the bar height so nothing is covered.
- Closed hours: the call cell opens a small sheet instead of dialing:
  «کلینیک الان بسته است. ساعات کاری: هر روز ۱۰ تا ۲۰، به‌جز تعطیلات
  رسمی.» with «رزرو نوبت» (primary) and «تماس با کلینیک» (secondary, for
  people who still want to try). Without JS the cell stays a plain `tel:`
  link.

## 5. Booking flow

Entry points: header CTA, hero, sticky bar, section CTAs, tier steps,
dentist pages, pricing, article service boxes, 404, the address page
(inline form), `/رزرو-نوبت`.

Mechanics:

- Every CTA is a real link to `/رزرو-نوبت?service={key}&tier={key}` (ASCII
  parameters; the page canonicalizes to `/رزرو-نوبت`).
- One form instance per page. If the page already shows the inline booking
  block, CTAs scroll to it and set the service; otherwise they open the same
  form in a `<dialog>`. This keeps ids unique; ids are still prefixed per
  instance as a safeguard.
- Dialog: on fine pointers focus moves to the phone field; on touch devices
  focus moves to the dialog heading so the keyboard does not cover the lead.
  Esc and the close button close it; focus returns to the opener.
- Without JavaScript the links open `/رزرو-نوبت` and everything works the
  same way.

### 5.1 Form (one step, one required field)

| # | Field | Required | Spec |
|---|---|---|---|
| 1 | Phone | yes | label «شمارهٔ موبایل»; help «مثلاً ۰۹۱۲ ۳۴۵ ۶۷۸۹»; `type="tel"`, `inputmode="numeric"`, `autocomplete="tel"`, `dir="ltr"`. Accepts Persian, Arabic and Latin digits, spaces, dashes, `+98`, `0098`, a leading `0`, or 10 digits starting with `9`. After normalization it must match `^09\d{9}$` (all operators, including 0920-0923 and 099x), stored as E.164 |
| 2 | Name | no | label «نام (اختیاری)»; `autocomplete="name"` |
| 3 | Service | no | When the page knows the service, one line: «خدمت: لمینت سرامیکی» with a «تغییر» button that reveals the chips. Otherwise native radio buttons styled as chips inside `<fieldset>` with legend «برای چه خدمتی؟ (اختیاری)»: معاینه، زیبایی، ایمپلنت، ترمیم و روکش، عصب‌کشی، ارتودنسی، کودکان، سایر. Each service has a `booking_group` in `services.yaml`; the exact `service_key` travels in a hidden field |
| 4 | Preferred time | no | radios as chips, legend «چه زمانی برای نوبت راحت‌ترید؟ (اختیاری)»: صبح، عصر، فرقی ندارد |
| 5 | Note | no | `<details>` summary «توضیح بیشتر»; label «توضیح (اختیاری)»; help «مثلاً: درد دارم، یا برای دو نفر نوبت می‌خواهم.»; max 500 characters with a live counter |
| hidden | `service_key`, `tier`, `dentist`, source URL, UTM, honeypot, signed form timestamp | | never shown |

Heading: «درخواست نوبت». Lead: «شماره‌تان را بگذارید. پذیرش زمان دقیق نوبت
را با شما هماهنگ می‌کند.» With the free-consultation flag on, a second line:
«مشاورهٔ اول رایگان است.»

Privacy line above the button: «شمارهٔ شما فقط برای هماهنگی نوبت استفاده
می‌شود.» with a link «حریم خصوصی». No consent checkbox; the line informs.

Button: «ثبت درخواست»; loading label «در حال ثبت»; the button keeps its
width; double submit is blocked.

Below the button, during opening hours only: «یا با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس
بگیرید.» (the number is a `tel:` link and an LTR island).

### 5.2 Validation and errors

Inline, below the field, with `aria-invalid="true"` and `aria-describedby`
pointing at the message. Validation runs on blur and on submit, never on
every keystroke. On submit errors, focus moves to the first invalid field;
the note `<details>` opens when its error shows; typed values are kept.

| Case | Message |
|---|---|
| Empty phone | «شمارهٔ موبایل را وارد کنید.» |
| Not a valid mobile | «شمارهٔ موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.» |
| Landline entered | «این شمارهٔ تلفن ثابت است. شمارهٔ موبایل را وارد کنید.» |
| Note too long | «توضیح بیشتر از ۵۰۰ حرف است. آن را کوتاه‌تر کنید.» |
| Page open too long (expired session, HTTP 419) | «صفحه مدت زیادی باز مانده بود و درخواست ثبت نشد. دوباره «ثبت درخواست» را بزنید.» With JS the form refreshes its token and keeps the values; without JS the booking page reloads with the values and this message |
| Network failure | «ارسال انجام نشد. اتصال اینترنت را بررسی کنید و دوباره «ثبت درخواست» را بزنید. اگر باز هم نشد، با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید.» |
| Server error | «مشکلی در سایت پیش آمد و درخواست ثبت نشد. دوباره «ثبت درخواست» را بزنید یا با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید.» plus «پیام در واتساپ»; logged with the request id |
| Duplicate or limit reached (neutral, see 5.3) | «درخواست شما قبلاً ثبت شده است. پذیرش در ساعات کاری با شما تماس می‌گیرد. برای کار فوری با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید.» shown as an info state, not an error |

### 5.3 Abuse controls (no silent loss)

| Control | Rule |
|---|---|
| Honeypot | one extra input with a neutral name that does not look like a real field, `tabindex="-1"`, `autocomplete="off"`, hidden from assistive tech |
| Time token | signed server timestamp in a hidden field; a submit faster than 2 seconds counts as suspicious |
| Suspicious requests | honeypot filled or too fast: the visitor sees the normal success state, the request is stored with status «مشکوک» (not deleted), and admin shows a daily count. Staff can restore a real request in one click |
| Per phone | 3 requests per 24 hours; more show the neutral message |
| Per IP | 10 per hour (generous: mobile carriers share IPs); above that, requests are stored as «مشکوک»; a spike alert reaches the admin |
| Duplicates | the same phone within 10 minutes: the new details are added as a note on the existing request; nothing is overwritten |
| SMS (when Farapayamak is enabled) | at most 1 message per destination number per 24 hours, whatever the form receives |

### 5.4 Success (peak-end moment)

The dialog success state and `/رزرو-نوبت/ثبت-شد` (noindex) share one design.
The success page shows only with a one-time flash from a real submission;
opened directly, it redirects to `/رزرو-نوبت`. Focus moves to the success
heading.

1. A check mark that draws itself (static under reduced motion).
2. «درخواست شما ثبت شد»
3. Callback line, computed from the schedule (section 6), one voice
   («پذیرش ... تماس می‌گیرد»):
   - Open: «پذیرش معمولاً تا {callbackMinutes} دقیقهٔ دیگر با شما تماس می‌گیرد.» (setting `callbackMinutes`, default 10, Persian digits)
   - Before opening today: «پذیرش امروز از ساعت ۱۰ با شما تماس می‌گیرد.»
   - Closing soon, closed or holiday: «پذیرش {فردا | شنبه ۱۲ مهر} از ساعت ۱۰ با شما تماس می‌گیرد.» On a holiday the line starts with «امروز تعطیل رسمی است.»
   - Then: «شمارهٔ ثبت‌شده: ۰۹۱۲ ••• ۶۷۸۹» (LTR island).
4. «تماس از شمارهٔ {callerNumber} خواهد بود. شماره را ذخیره کنید تا تماس را
   بشناسید.» with «ذخیرهٔ شمارهٔ کلینیک» (vCard: name, phones, address, site).
   `callerNumber` is a setting in admin; while empty, this line is hidden
   and the vCard still offers the clinic numbers.
5. «برای مراجعه همراه داشته باشید»: کارت ملی، کارت بیمه در صورت استفاده،
   عکس‌های رادیوگرافی قبلی اگر دارید، فهرست داروهایی که مصرف می‌کنید.
6. Address with «مسیریابی», and «پیام در واتساپ» as the fallback.

## 6. Hours awareness and caching

Hours come from settings (weekly schedule plus holiday overrides), evaluated
in Asia/Tehran on every request. States:

| State | When | Effect |
|---|---|---|
| before-open | a working day, before 10:00 | callback "today from 10"; call cell shows the closed sheet |
| open | 10:00 to 19:30 | call-first copy; callback window copy |
| closing-soon | last 30 minutes | treated as closed for promises; calls still allowed |
| closed | after 20:00 | next working day copy; closed sheet |
| holiday | holiday override | «امروز تعطیل رسمی است.» plus next working day |

"Next working day" is computed from the schedule: «فردا» when it is
tomorrow, otherwise the weekday and Jalali date («شنبه ۱۲ مهر»).

Caching decision (made now because it shapes forms, security and copy): any
route that renders a form (booking, emergency, address, and the inline
booking block on content pages) gets its CSRF token, signed time token and
hours state from a small `no-store` endpoint when the form mounts, so the
page itself can stay static or ISR. Booking and emergency pages are fully
dynamic (`no-store`). No CDN or application cache ever serves a token.
Inline scripts in static pages use CSP hashes; dynamic routes use nonces.

## 7. Emergency flow (`/اورژانس`)

Goal: help people in real pain the same day when possible, send dangerous
cases to the right place, and keep the path from becoming a shortcut for
ordinary bookings.

### 7.1 Page order

Open hours (call first; items 1-3 fit the first screen at 360x640):

1. H1 «درد شدید دندان دارید؟»
2. Lead: «در ساعات کاری، سریع‌ترین راه تماس تلفنی است. در صورت امکان همان
   روز نوبت می‌دهیم.»
3. Large «تماس با کلینیک» button.
4. Safety box (section 7.2).
5. Triage and form, introduced by «اگر تماس برقرار نشد، شماره‌تان را بگذارید.»
6. Self-care until the visit (section 7.4).
7. Address and «مسیریابی».

Closed hours and holidays:

1. H1 «درد شدید دندان دارید؟»
2. Lead: «کلینیک الان بسته است. اگر یکی از نشانه‌های کادر زیر را دارید، منتظر
   نمانید. در غیر این صورت شماره‌تان را بگذارید.»
3. Safety box.
4. Triage and form. Above the button: «پذیرش {امروز | فردا | شنبه ۱۲ مهر}
   از ساعت ۱۰، پیش از بقیهٔ درخواست‌ها، با شما تماس می‌گیرد.»
   [[NEEDS_CLIENT: confirm this priority promise]]
5. Self-care, then address.

The call button is never gated by triage.

### 7.2 Safety box (warning token, always visible, ۱۱۵ is a `tel:115` link)

Heading: «اگر یکی از این‌ها را دارید، همین حالا با اورژانس ۱۱۵ تماس بگیرید
یا به اورژانس نزدیک‌ترین بیمارستان بروید:»

- «ورم صورت به چشم یا گردن رسیده یا چشم باز نمی‌شود.»
- «نفس کشیدن، قورت دادن، حرف زدن یا باز کردن دهان سخت شده است.»
- «خونریزی دهان زیاد است و با ۱۵ دقیقه فشار مداوم بند نمی‌آید.»
- «ضربهٔ شدیدی به سر یا صورت خورده‌اید.»

Second line in the box: «اگر ورم با تب، لرز یا حال عمومی بد همراه است،
همین امروز باید معاینه شوید. اگر کلینیک بسته است، به اورژانس بیمارستان
بروید.»

Sources: NHS pages on dental emergencies, toothache and dental abscess. The
reviewer dentist confirms the wording in phase 6.

### 7.3 Triage and form

Checkboxes inside the server-rendered form (`<fieldset>`, legend «کدام
مورد دربارهٔ شما درست است؟»). At least one is required and the server
validates it; JavaScript only reveals the extra text below.

- «درد شدیدی که با مسکن آرام نمی‌شود»
- «ورم لثه یا صورت»
- «دندان شکسته یا ضربه به دندان»
- «دندانی که کامل از جا درآمده است» reveals:
  «اگر دندان دائمی است، هر دقیقه مهم است. دندان را از تاج بگیرید و به ریشه
  دست نزنید. اگر کثیف است، حداکثر ۱۰ ثانیه با آب سرد روان بشویید و آن را
  نسابید. اگر می‌توانید، همین حالا دندان را در جای خودش بگذارید و روی
  دستمال تمیز گاز بگیرید. اگر نمی‌توانید، آن را در شیر نگه دارید، نه در آب.
  دندان شیری را در جایش نگذارید.»
  Open: «همین حالا با کلینیک تماس بگیرید و راه بیفتید.» with «تماس با کلینیک».
  Closed: «کلینیک الان بسته است. هرچه زودتر به نزدیک‌ترین درمانگاه
  دندانپزشکی شبانه‌روزی یا اورژانس بیمارستان بروید.»
  [[NEEDS_CLIENT: a nearby 24-hour dental center to name]]
  Source: IADT guidelines for avulsion; reviewer dentist confirms.
- «خونریزی کم بعد از کشیدن دندان که هنوز ادامه دارد»

Below the list: «هیچ‌کدام؟ برای درد خفیف یا مشکل غیرفوری، نوبت عادی
بگیرید.» linking to booking.

Fields: phone (required, same rules as booking), name (optional), note
(optional). Button «ثبت درخواست فوری».

Messages:

| Case | Message |
|---|---|
| No triage item (server) | «یکی از موارد را انتخاب کنید. اگر هیچ‌کدام درست نیست، نوبت عادی بگیرید.» |
| Second emergency from one phone in 24 hours | «امروز یک درخواست فوری با این شماره ثبت شده است. پذیرش با شما تماس می‌گیرد. اگر حالتان بدتر شده، در ساعات کاری با ۰۲۱ ۵۵۱۰ ۱۰۵۴ تماس بگیرید یا به اورژانس بیمارستان بروید.» |
| Success | «درخواست فوری شما ثبت شد.» plus the computed callback line from section 5.4 and the safety box again |

### 7.4 Self-care block

Short, sourced, written in phase 6 and reviewed by a dentist: cold compress
on the cheek, painkiller as the package says, no aspirin on the gum, no heat
on a swelling, and «به کودکان زیر ۱۶ سال آسپرین ندهید.» (NHS).

### 7.5 Gating and abuse control

| Rule | Value |
|---|---|
| Triage | at least one item, validated on the server |
| Per phone | 1 emergency request per 24 hours, then the message above |
| Per IP | above 3 per 24 hours the request is still stored but flagged; nobody is blocked by a shared carrier IP |
| Entry points | footer, phone drawer, mega menu row, booking form help text, root canal and extraction pages, home FAQ, 404; never in the primary nav or the sticky bar |
| Promise | «در صورت امکان»; never a guaranteed slot |
| Admin | red flag at the top of the list; outcome field «واقعاً فوری بود» or «فوری نبود»; staff can remove emergency priority from a phone that misuses it |
| Measurement | monthly share of emergency requests marked «فوری نبود» |

## 8. WhatsApp prefill texts

| Context | Text |
|---|---|
| Generic | «سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.» |
| Service page | «سلام، از صفحهٔ {نام خدمت} در سایت کلینیک سفید پیام می‌دهم. می‌خواهم دربارهٔ {نام خدمت} بیشتر بدانم.» |
| Pricing, financing | «سلام، دربارهٔ شرایط پرداخت و {نام گزینه} سؤال دارم.» |
| After booking | «سلام، همین الان در سایت درخواست نوبت ثبت کردم.» |

Texts are URL-encoded; no personal data is added automatically.

## 9. Measurement events

Two channels, one delegated listener. Links carry
`data-track="call_click" data-location="hero"`; editors never touch JS.

1. **First-party counter (source of truth).** `navigator.sendBeacon` to a
   small endpoint that stores daily aggregates (date, event, location,
   page_type, service_key). No cookies, no IP, no personal data. Shown on the
   admin dashboard. Works when GA4 is blocked, filtered or slowed.
2. **GA4 (optional).** Loaded after `load`, gated by a setting. Conversions:
   `booking_success`, `call_click`, `whatsapp_click`, `emergency_submit`.

| Event | Trigger | Extra parameters |
|---|---|---|
| `booking_open` | dialog opened, inline form scrolled to, or booking page viewed | `location` (header, hero, sticky, section, tier, aside, article, page) |
| `booking_submit` | valid submit sent | `has_name`, `time_pref`, `tier` |
| `booking_success` | server confirmed | `duplicate` |
| `booking_error` | inline or server error shown | `error_type` |
| `call_click` | any `tel:` link | `location`, `open_state` |
| `closed_sheet_view` | closed-hours sheet shown | none |
| `whatsapp_click` | any WhatsApp link | `location` |
| `directions_click` | a map provider chosen | `provider` |
| `emergency_submit` | emergency request stored | `open_state`, `items_count` |
| `tier_select` | tier step chosen | `tier` |
| `case_slider_use` | first drag or key press on a compare slider | `service_key` |
| `save_contact` | vCard downloaded | none |
| `content_to_service` | article or guide link to a service clicked | `from_slug` |
| `theme_toggle` | manual theme change | `to` |

No phone numbers or names in any event.
