/** Persian UI strings owned by the phase 4 pages work; merged into MESSAGES in src/i18n/fa.ts. */
export const PAGES_MESSAGES = {
  'pages.crumb.home': 'خانه',
  'pages.book': 'رزرو نوبت',
  'pages.whatsapp': 'پیام در واتساپ',
  // Generic WhatsApp prefill (conversion.md 8): no personal data.
  'pages.whatsappText': 'سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.',
  'pages.telegram': 'پیام در تلگرام',
  'pages.allServices': 'همهٔ خدمات',
  'pages.textPlaceholder': 'جای متن:',

  // Dentists hub and profile. The name field stores no «دکتر»; the site adds it.
  'pages.dentist.title': 'دکتر',
  'pages.dentists.crumb': 'پزشکان',
  'pages.dentists.list': 'معرفی دندانپزشکان',
  'pages.dentists.rail': 'فهرست دندانپزشکان',
  'pages.dentists.empty':
    'معرفی دندانپزشکان کلینیک هنوز منتشر نشده است؛ برای نوبت، فرم پایین همین صفحه را پر کنید.',
  'pages.dentist.credentials': 'سوابق و مدارک',
  'pages.dentist.degree': 'مدرک',
  'pages.dentist.years': 'سابقهٔ کار',
  'pages.dentist.yearsUnit': 'سال',
  'pages.dentist.membership': 'عضویت',
  'pages.dentist.about': 'دربارهٔ {name}',
  'pages.dentist.services': 'خدمات {name}',
  'pages.dentist.cases': 'نمونه‌های قبل و بعد',
  // Articles the dentist wrote or reviewed (docs/ia.md T-dentist), each with its role.
  'pages.dentist.articles': 'مقاله‌های نوشته‌شده یا بازبینی‌شده',
  'pages.dentist.role.author': 'نویسنده',
  'pages.dentist.role.reviewer': 'بازبین',
  'pages.dentist.role.both': 'نویسنده و بازبین',
  'pages.cases.all': 'همهٔ نمونه‌ها',

  // About.
  'pages.about.facts': 'کلینیک در یک نگاه',
  'pages.about.team': 'دندانپزشکان کلینیک',
  'pages.about.allDentists': 'همهٔ پزشکان',
  'pages.about.work': 'روش کار ما',
  'pages.about.voices': 'تجربهٔ بیماران',
  'pages.voices.consent': 'با رضایت کتبی بیمار منتشر شده است.',
  // Captions of clinic.stats, shown only once each number is verified (gap 15). No «متخصص»
  // without a board confirmation (copy-facts C-17).
  'pages.stat.yearsActive': 'سال فعالیت',
  'pages.stat.specialistDentists': 'دندانپزشک',
  'pages.stat.specialtyClinics': 'کلینیک تخصصی',
  'pages.stat.insurers': 'بیمهٔ تحت پوشش',

  // Address.
  'pages.address.address': 'نشانی',
  'pages.address.phones': 'تلفن',
  'pages.address.landline': 'تلفن ثابت',
  'pages.address.mobile': 'موبایل',
  'pages.address.hours': 'ساعات کاری',
  'pages.address.access': 'راه رسیدن به کلینیک',
  'pages.address.accessPending': 'پارکینگ، مترو و اتوبوس نزدیک کلینیک، پس از تأیید کلینیک',

  // Patient guides.
  'pages.guides.crumb': 'راهنمای بیمار',
  'pages.guides.list': 'راهنماها',
  'pages.guides.empty':
    'راهنماها پس از بازبینی دندانپزشک این‌جا منتشر می‌شوند؛ تا آن زمان پرسش‌تان را هنگام هماهنگی نوبت بپرسید.',
  'pages.guide.faq': 'پرسش‌های پرتکرار',
  'pages.guide.reviewedOn': 'در',

  // Pricing and payment (pricing-tiers-measure 1.2). Insurers only by name under «همکاری با
  // بیمه‌ها» (freeze G1, F31); financing text only for an enabled option, the surcharge first (G14).
  'pages.pricing.how': 'هزینهٔ درمان به چه بستگی دارد؟',
  'pages.pricing.fromPrices': 'قیمت شروع خدمات',
  'pages.pricing.services': 'دربارهٔ این درمان‌ها بخوانید',
  'pages.pricing.tiers': 'ترمیم دندان در سه سطح',
  'pages.pricing.insuranceShare':
    'سهم بیمه به نوع درمان و بیمه‌نامهٔ شما بستگی دارد؛ پیش از نوبت از پذیرش بپرسید.',
  'pages.pricing.financing': 'گزینه‌های پرداخت',
  'pages.pricing.surcharge': 'هزینهٔ نهایی:',
  'pages.pricing.maxAmount': 'سقف مبلغ',
  'pages.pricing.upTo': 'تا',
  // An amount in words (tomanInWords): «۲ میلیون و ۵۰۰ هزار تومان».
  'pages.pricing.billion': 'میلیارد',
  'pages.pricing.million': 'میلیون',
  'pages.pricing.thousand': 'هزار',
  'pages.pricing.and': 'و',
  'pages.pricing.provider': 'شریک مالی',
  'pages.pricing.whoApplies': 'چه کسی درخواست می‌دهد',
  'pages.pricing.terms': 'شرایط',
  'pages.pricing.finalDetails': 'جزئیات نهایی را پذیرش اعلام می‌کند.',
  // conversion.md 8: the option's title fills {name}; never personal data.
  'pages.pricing.financingWhatsappText': 'سلام، دربارهٔ شرایط پرداخت و {name} سؤال دارم.',

  // Privacy (freeze G17): the parts that follow settings; the rest is seeded page text.
  'pages.privacy.ga4': 'گوگل آنالیتیکس',
  'pages.privacy.ga4Text':
    'آمار سایت با گوگل آنالیتیکس هم اندازه‌گیری می‌شود. این سرویس در مرورگر شما کوکی می‌گذارد و اطلاعات بازدید، مثل صفحه‌ها و دکمه‌هایی که می‌زنید، را به گوگل می‌فرستد. شماره، نام یا توضیح شما هرگز برای آن فرستاده نمی‌شود.',
  'pages.privacy.contact': 'پرسش یا درخواست حذف',
  'pages.privacy.contactText':
    'اگر دربارهٔ این صفحه پرسشی دارید یا می‌خواهید درخواست شما حذف شود، با کلینیک تماس بگیرید:',

  // Restoration tiers with the visitor's choice (freeze G13): the radio group's name and the
  // badge of the checked card. Never «انتخاب این سطح» (conversion.md 2).
  'pages.tiers.legend': 'سطح ترمیم',
  'pages.tiers.chosen': 'انتخاب شما',

  // Photo placeholders (freeze F3; gaps 45, 46, 47, 49 and the shot list numbers).
  'pages.photo.dentistsHub': 'عکس گروهی تیم در فضای کلینیک، افقی ۳:۲ و برش ۴:۵',
  'pages.photo.dentist': 'پرترهٔ ۴:۵ پزشک با روپوش، پس‌زمینهٔ ساده و روشن',
  'pages.photo.about': 'فضای انتظار خالی و مرتب با نور خوب، افقی ۳:۲ و برش ۴:۵',
  'pages.photo.guideHub':
    'میز پذیرش کلینیک، یا پزشک در حال توضیح طرح درمان به بیمار؛ افقی ۳:۲ و برش ۴:۵',
  'pages.photo.map': 'تصویر ثابت نقشهٔ محل کلینیک، ۴:۳، با نشانی ورودی',
  'pages.photo.building': 'نمای ساختمان و تابلو، ۴:۳',
  'pages.photo.entrance': 'در ورودی و پلاک، ۴:۳',
  'pages.photo.alley': 'کوچه و نشانهٔ نزدیک، ۴:۳',
  'pages.photo.parking': 'محل پارک یا ایستگاه، ۴:۳',
} as const;
