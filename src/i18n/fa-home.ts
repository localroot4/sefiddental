/**
 * Persian UI strings owned by the phase 4 home work; merged into MESSAGES in src/i18n/fa.ts. The
 * booking form lives in this lane, so its chrome is here too (`booking.*`, conversion.md 5.1-5.4,
 * verbatim). Page copy (H1, subtext, section headings, steps, FAQ) is Payload data.
 */
export const HOME_MESSAGES = {
  'booking.heading': 'درخواست نوبت',
  'booking.lead': 'شماره‌تان را بگذارید. پذیرش زمان دقیق نوبت را با شما هماهنگ می‌کند.',
  'booking.phone': 'شمارهٔ موبایل',
  // The sample number renders as an LTR island after «مثلاً».
  'booking.phoneHelp': 'مثلاً',
  'booking.phoneSample': '۰۹۱۲ ۳۴۵ ۶۷۸۹',
  'booking.name': 'نام (اختیاری)',
  'booking.serviceKnown': 'خدمت:',
  'booking.serviceChange': 'تغییر',
  'booking.serviceLegend': 'برای چه خدمتی؟ (اختیاری)',
  'booking.group.exam': 'معاینه',
  'booking.group.examFree': 'معاینه و مشاورهٔ رایگان',
  'booking.group.cosmetic': 'زیبایی',
  'booking.group.implant': 'ایمپلنت',
  'booking.group.restore': 'ترمیم و روکش',
  'booking.group.root_canal': 'عصب‌کشی',
  'booking.group.ortho': 'ارتودنسی',
  'booking.group.kids': 'کودکان',
  'booking.group.other': 'سایر',
  'booking.timeLegend': 'چه زمانی برای نوبت راحت‌ترید؟ (اختیاری)',
  'booking.time.morning': 'صبح',
  'booking.time.evening': 'عصر',
  'booking.time.any': 'فرقی ندارد',
  'booking.noteSummary': 'توضیح بیشتر',
  'booking.note': 'توضیح (اختیاری)',
  'booking.noteHelp': 'مثلاً: درد دارم، یا برای دو نفر نوبت می‌خواهم.',
  'booking.noteTooLong': 'توضیح بیشتر از ۵۰۰ حرف است. آن را کوتاه‌تر کنید.',
  'booking.privacy': 'شمارهٔ شما فقط برای هماهنگی نوبت استفاده می‌شود.',
  'booking.privacyLink': 'حریم خصوصی',
  'booking.submit': 'ثبت درخواست',
  'booking.submitting': 'در حال ثبت',
  'booking.fallbackBefore': 'یا با',
  'booking.fallbackAfter': 'تماس بگیرید.',
  // conversion.md 5.2; the clinic number and «تماس بگیرید.» follow as in the fallback line.
  'booking.failed.network':
    'ارسال انجام نشد. اتصال اینترنت را بررسی کنید و دوباره «ثبت درخواست» را بزنید. اگر باز هم نشد، با',
  'booking.failed.server':
    'مشکلی در سایت پیش آمد و درخواست ثبت نشد. دوباره «ثبت درخواست» را بزنید یا با',
  // conversion.md 5.2 (419), 5.2 neutral state (the clinic number and «تماس بگیرید.» follow) and
  // section 6 (a no-JS home post reaches the booking page without a token).
  'booking.failed.expired':
    'صفحه مدت زیادی باز مانده بود و درخواست ثبت نشد. دوباره «ثبت درخواست» را بزنید.',
  'booking.neutral':
    'درخواست شما قبلاً ثبت شده است. پذیرش در ساعات کاری با شما تماس می‌گیرد. برای کار فوری با',
  'booking.retry': 'درخواست هنوز ثبت نشده است. یک بار دیگر «ثبت درخواست» را بزنید.',
  'booking.nameTooLong': 'نام بیشتر از ۸۰ حرف است. آن را کوتاه‌تر کنید.',
  // The callback line when the server could not read the hours (conversion.md 5.2 wording).
  'booking.callbackGeneric': 'پذیرش در ساعات کاری با شما تماس می‌گیرد.',
  'booking.close': 'بستن',
  'booking.done': 'درخواست شما ثبت شد',
  'booking.callerBefore': 'تماس از شمارهٔ',
  'booking.callerAfter': 'خواهد بود. شماره را ذخیره کنید تا تماس را بشناسید.',
  'booking.saveContact': 'ذخیرهٔ شمارهٔ کلینیک',
  'booking.bringHeading': 'برای مراجعه همراه داشته باشید',
  'booking.bring.id': 'کارت ملی',
  'booking.bring.insurance': 'کارت بیمه در صورت استفاده',
  'booking.bring.xray': 'عکس‌های رادیوگرافی قبلی اگر دارید',
  'booking.bring.meds': 'فهرست داروهایی که مصرف می‌کنید',
  'booking.whatsapp': 'پیام در واتساپ',
  'booking.whatsappText': 'سلام، همین الان در سایت درخواست نوبت ثبت کردم.',
  'home.book': 'رزرو نوبت',
  'home.whatsappText': 'سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.',
  // The photo brief (size, crop, focal band) is gap 36 and the shot list; the page names the scene.
  'home.hero.photoWide': 'فضای خالی کلینیک با نور طبیعی، بدون چهره',
  'home.hero.photoTall': 'فضای خالی کلینیک با نور طبیعی، بدون چهره',
  'home.trust.label': 'حقایق کلینیک',
  'home.trust.free': 'مشاورهٔ اول رایگان',
  'home.trust.callbackBefore': 'تماس پذیرش تا',
  'home.trust.callbackAfter': 'دقیقه',
  'home.trust.callbackCaption': 'معمولاً، در ساعات کاری',
  'home.trust.insurance': 'همکاری با بیمه‌ها',
  'home.services.all': 'همهٔ خدمات',
  'home.services.unit': 'خدمت',
  'home.services.photo': 'عکس ۴:۳ از نتیجهٔ یک درمان زیبایی، با رضایت کتبی بیمار',
  'home.restoration.legend': 'سطح ترمیم',
  'home.restoration.compare': 'مقایسهٔ کامل سه سطح ترمیم',
  // The brief's tier facts in one line (services.yaml tier descriptions); no duration, no result.
  'home.restoration.levels':
    'معمولی: مواد متداول. VIP: مواد درجه‌یک، دقت بیشتر. CIP: VIP به‌علاوهٔ رنگ‌آمیزی جزئیات.',
  'home.cases.all': 'همهٔ نمونه‌ها',
  'home.dentists.all': 'همهٔ پزشکان',
  'home.dentists.title': 'دکتر',
  // The rail's own region name: the section heading already names the section (landmark-unique).
  'home.dentists.rail': 'فهرست دندانپزشکان',
  'home.voices.consent': 'با رضایت کتبی بیمار منتشر شده است.',
  'home.journey.guide': 'راهنمای اولین مراجعه',
  'home.faq.aside': 'سؤال دیگری دارید؟',
  'home.booking.map': 'تصویر ثابت نقشهٔ محل کلینیک، ۴:۳، با نشانی ورودی',
  // Phase 7 (one block per lane; the strings come from the lane briefs).
  // INTRO: the overlay's only focusable element.
  'home.intro.skip': 'رد کردن انیمیشن',
  // BOOKING+FOOTER: the «کیفیت» control, its five options and the three reasons the effective tier
  // differs from the choice.
  'home.quality.label': 'کیفیت',
  'home.quality.auto': 'خودکار',
  'home.quality.tier0': 'بدون جلوه',
  'home.quality.tier1': 'سبک',
  'home.quality.tier2': 'متوسط',
  'home.quality.tier3': 'کامل',
  'home.quality.reducedMotion': 'حرکت کمتر فعال است',
  'home.quality.siteCap': 'محدودیت سایت',
  'home.quality.device': 'دستگاه',
  'home.quality.saveData': 'صرفه‌جویی داده فعال است',
  'home.playground.replay': 'پخش دوباره',
  // COMPARE+DENTISTS+VOICES+LIGHT: the voices carousel buttons.
  'home.voices.prev': 'قبلی',
  'home.voices.next': 'بعدی',
  // SERVICES: the aria label of the phone row's progress bar.
  'home.services.progress': 'جایگاه در فهرست خدمات',
  // INTEGRATOR: the light notice (phone spec 3.3). «جلوه» is the one word for an effect; the
  // switch is one button whose label follows the state.
  'home.light.loaded': 'جلوه‌ها را روی این دستگاه خاموش کردیم تا سایت روان بماند.',
  'home.light.stepped': 'جلوه‌ها روی این دستگاه کند بود، پس آن‌ها را خاموش کردیم.',
  'home.light.on': 'جلوه‌ها را روشن کردیم.',
  'home.light.off': 'جلوه‌ها را خاموش کردیم.',
  'home.light.turnOn': 'روشن کردن جلوه‌ها',
  'home.light.turnOff': 'خاموش کردن جلوه‌ها',
  'home.light.dismiss': 'بستن',
} as const;
