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
  'home.hero.photoWide':
    'عکس افقی (ضلع بلند دست‌کم ۴۰۰۰ پیکسل): فضای خالی کلینیک (اتاق درمان یا پذیرش) با نور طبیعی، بدون چهره. جزئیات اصلی در نوار وسط و بالای کادر.',
  'home.hero.photoTall':
    'برش ۴:۵ برای موبایل از همان عکاسی: فضای خالی کلینیک (اتاق درمان یا پذیرش) با نور طبیعی، بدون چهره. جزئیات اصلی در یک‌سوم بالای کادر باشد؛ پایین کادر زیر نوار حقایق می‌رود.',
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
  'home.cases.all': 'همهٔ نمونه‌ها',
  'home.dentists.all': 'همهٔ پزشکان',
  'home.dentists.title': 'دکتر',
  // The rail's own region name: the section heading already names the section (landmark-unique).
  'home.dentists.rail': 'فهرست دندانپزشکان',
  'home.voices.consent': 'با رضایت کتبی بیمار منتشر شده است.',
  'home.journey.guide': 'راهنمای اولین مراجعه',
  'home.faq.aside': 'سؤال دیگری دارید؟',
  'home.booking.map': 'تصویر ثابت نقشهٔ محل کلینیک، ۴:۳، با نشانی ورودی',
} as const;
