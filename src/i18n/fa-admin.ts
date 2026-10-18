/*
 * Admin copy for the booking workflow (admin-notify.md 4 and 8, freeze G15) and the Notifier
 * settings (9.7, 9.8, 9.10). Staff-facing; the copy rules apply (ZWNJ, Persian digits, no em
 * dash). Placeholders are {name}; values are filled in by adminText.
 */
export const ADMIN_MESSAGES = {
  // Bookings collection
  'admin.bookings.description':
    'درخواست‌های فرم‌های سایت. فوری‌ها اول، بعد تازه‌ترها. شمارهٔ کامل داخل هر درخواست و در دکمهٔ تماس است.',
  'admin.bookings.statusHelp':
    'وضعیت پیگیری. هر تغییر وضعیت با نام شما و زمان در یادداشت‌ها ثبت می‌شود. برای «انجام شد» و «لغو شد» اول یک یادداشت تازه بنویسید؛ این دو پایانی‌اند و برای تغییرشان به مدیر بگویید.',
  'admin.bookings.callbackDueHelp':
    'تا این زمان باید با بیمار تماس گرفته شود. اگر پاسخ نداد، یادداشت بگذارید و این زمان را جلو ببرید.',
  'admin.bookings.formLocation': 'محل فرم',
  'admin.formLocation.hero': 'کارت بالای صفحهٔ خانه',
  'admin.formLocation.block': 'فرم پایین صفحه',
  'admin.formLocation.dialog': 'پنجرهٔ رزرو',
  'admin.formLocation.page': 'صفحهٔ رزرو نوبت',
  'admin.formLocation.emergency': 'فرم اورژانس',
  'admin.formLocation.admin': 'ثبت در پنل',
  'admin.duplicates.help':
    'درخواست‌های تکراری همین شماره: در ۱۰ دقیقه، چهارمین درخواست در ۲۴ ساعت یا درخواست فوری دوباره در ۲۴ ساعت. چیزی بازنویسی نمی‌شود.',
  'admin.duplicates.at': 'زمان',
  'admin.duplicates.name': 'نام',
  'admin.duplicates.note': 'توضیح بیمار',
  'admin.duplicates.serviceKey': 'شناسهٔ خدمت',
  'admin.duplicates.preferredTime': 'زمان دلخواه',
  'admin.duplicates.sourceUrl': 'صفحهٔ ارسال',
  'admin.duplicates.triage': 'نشانه‌ها',
  'admin.duplicates.ipHash': 'اثر IP',
  'admin.duplicates.empty': 'درخواست تکراری‌ای از این شماره ثبت نشده است.',
  'admin.contact.label': 'تماس با بیمار',
  'admin.contact.call': 'تماس با بیمار',
  'admin.contact.whatsapp': 'پیام واتساپ',
  'admin.contact.callAria': 'تماس با بیمار {phone}',
  'admin.contact.whatsappAria': 'پیام واتساپ به بیمار {phone}',
  'admin.receivedAt.label': 'زمان ثبت',
  'admin.rowActions.label': 'کار سریع',
  'admin.cell.overdue': 'گذشته',
  'admin.cell.dayTime': '{date}، {time}',
  'admin.unknown': 'نامشخص',
  'admin.kind.regular': 'عادی',
  'admin.kind.emergency': 'فوری',
  'admin.network': 'انجام نشد. اتصال را بررسی کنید و دوباره بزنید.',
  // Status changes (src/admin/bookings/workflow.ts)
  'admin.workflow.history': 'وضعیت از «{from}» به «{to}» تغییر کرد.',
  'admin.workflow.closeNote':
    'برای «{to}» اول در «یادداشت‌های پذیرش» یک یادداشت تازه بنویسید که چه شد.',
  // One-click restore
  'admin.restore': 'بازگرداندن',
  'admin.restore.pending': 'در حال بازگرداندن',
  'admin.restore.done': 'درخواست بازگردانده شد و در «جدید» است.',
  // Tabs above the list
  'admin.tabs.nav': 'نماهای درخواست‌ها',
  'admin.tabs.all': 'همه',
  'admin.tabs.new': 'جدید',
  'admin.tabs.callbackDue': 'مهلت تماس',
  'admin.tabs.emergency': 'فوری',
  'admin.tabs.suspicious': 'مشکوک',
  'admin.tabs.closed': 'بسته‌شده',
  'admin.tabs.overdue': '{n} گذشته',
  'admin.tabs.today': '{n} امروز',
  'admin.tabs.savedOrder': 'این فهرست به ترتیبی است که آخرین بار انتخاب کردید، نه به ترتیب فوریت.',
  'admin.tabs.urgencyOrder': 'نمایش به ترتیب فوریت',
  // Bulk spam
  'admin.bulk.selected': '{n} مورد انتخاب شده',
  'admin.bulk.spam': 'علامت هرزنامه',
  'admin.bulk.pending': 'در حال ثبت',
  'admin.bulk.confirm':
    '{n} درخواست هرزنامه می‌شود. هر کدام بعداً از نمای «بسته‌شده» بازگرداندنی است.',
  'admin.bulk.done': '{n} درخواست هرزنامه شد.',
  'admin.bulk.refused': '{m} درخواست با وضعیت فعلی‌اش هرزنامه نمی‌شود.',
  // CSV export
  'admin.csv.button': 'خروجی',
  'admin.csv.pending': 'در حال آماده‌سازی',
  'admin.csv.forbidden': 'فقط مدیر می‌تواند خروجی بگیرد.',
  'admin.csv.tooMany': 'بیش از ۱۰٬۰۰۰ درخواست در این فیلتر است. بازهٔ زمانی را کوتاه‌تر کنید.',
  'admin.csv.badFilter': 'فیلتر این فهرست خوانده نشد. فیلتر را پاک کنید و دوباره بزنید.',
  'admin.csv.auditFailed': 'فایل ساخته نشد، چون ثبت آن در سابقهٔ تغییرات انجام نشد. دوباره بزنید.',
  'admin.csv.audit': 'خروجی CSV با {n} ردیف',
  'admin.csv.auditFilter': 'فیلتر روی: {fields}',
  'admin.csv.col.id': 'شمارهٔ درخواست',
  'admin.csv.col.createdAtUtc': 'زمان ثبت (UTC)',
  'admin.csv.col.createdAt': 'زمان ثبت (تهران)',
  'admin.csv.col.kind': 'نوع',
  'admin.csv.col.status': 'وضعیت',
  'admin.csv.col.phone': 'موبایل',
  'admin.csv.col.name': 'نام',
  'admin.csv.col.group': 'گروه',
  'admin.csv.col.service': 'خدمت',
  'admin.csv.col.serviceKey': 'شناسهٔ خدمت',
  'admin.csv.col.tier': 'سطح',
  'admin.csv.col.doctor': 'پزشک',
  'admin.csv.col.preferredTime': 'زمان دلخواه',
  'admin.csv.col.note': 'توضیح بیمار',
  'admin.csv.col.triage': 'نشانه‌ها',
  'admin.csv.col.outcome': 'نتیجهٔ تماس فوری',
  'admin.csv.col.heardFrom': 'آشنایی از',
  'admin.csv.col.formLocation': 'محل فرم',
  'admin.csv.col.sourceUrl': 'صفحهٔ ارسال',
  'admin.csv.col.device': 'دستگاه',
  'admin.csv.col.callbackDueAt': 'مهلت تماس (تهران)',
  'admin.csv.col.handledBy': 'پیگیری‌کننده',
  'admin.csv.col.handledAt': 'زمان پیگیری (تهران)',
  'admin.csv.col.flags': 'علامت‌ها',
  'admin.csv.col.duplicates': 'تعداد تکرار',
  // Dashboard widget
  'admin.today.heading': 'درخواست‌های امروز',
  'admin.today.new': 'درخواست تازه',
  'admin.today.emergency': 'درخواست فوری',
  'admin.today.waiting': 'منتظر تماس',
  'admin.today.overdue': '{n} از مهلت گذشته',
  'admin.today.suspicious': 'مشکوک امروز',
  'admin.today.empty': 'امروز هنوز درخواستی ثبت نشده است.',
  'admin.today.notUrgent': 'سهم «فوری نبود» این ماه',
  'admin.today.noOutcome': 'هنوز نتیجه‌ای ثبت نشده است.',
  'admin.today.percent': '{n}٪',
  // Notifier settings: validation, test action, status view
  'admin.notifier.needsSmtp':
    'برای ایمیل، تنظیمات SMTP روی سرور لازم است. از پشتیبانی فنی بخواهید آن را تنظیم کند.',
  'admin.notifier.needsTelegram': 'برای تلگرام، توکن ربات روی سرور لازم است.',
  'admin.notifier.needsSms': 'برای پیامک، نام کاربری و رمز فراپیامک روی سرور لازم است.',
  'admin.notifier.test': 'ارسال پیام آزمایشی',
  'admin.notifier.testPending': 'در حال ارسال',
  'admin.notifier.unsaved': 'اول تغییرها را ذخیره کنید.',
  'admin.notifier.wait': 'یک دقیقه صبر کنید و دوباره بزنید.',
  'admin.notifier.mail': 'ایمیل',
  'admin.notifier.telegram': 'تلگرام',
  'admin.notifier.sms': 'پیامک',
  'admin.notifier.line': '{channel}: {result}',
  'admin.notifier.sent': 'فرستاده شد.',
  'admin.notifier.off': 'خاموش.',
  'admin.notifier.noRecipient': 'گیرنده‌ای ندارد.',
  'admin.notifier.smsNotReady':
    'روشن است ولی حساب فراپیامک، شمارهٔ خط یا گیرندهٔ پیامک تنظیم نشده؛ پیامکی فرستاده نمی‌شود.',
  'admin.status.notifier': 'اعلان‌ها',
  'admin.status.ready': 'روشن و آماده',
  'admin.status.off': 'خاموش',
  'admin.status.mailNotReady': 'روشن است ولی SMTP یا گیرنده تنظیم نشده؛ ایمیلی فرستاده نمی‌شود.',
  'admin.status.telegramNotReady':
    'روشن است ولی توکن ربات یا شناسهٔ گفت‌وگو تنظیم نشده؛ پیامی فرستاده نمی‌شود.',
  'admin.status.smsNotReady':
    'روشن است ولی حساب فراپیامک یا شمارهٔ خط تنظیم نشده؛ پیامکی فرستاده نمی‌شود.',
  'admin.status.logOnly': 'هیچ راهی روشن نیست؛ درخواست‌ها فقط در پنل و گزارش سرور دیده می‌شوند.',
} as const;

export type AdminMessageKey = keyof typeof ADMIN_MESSAGES;

/** The message with its {placeholders} filled in. */
export function adminText(
  key: AdminMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return ADMIN_MESSAGES[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
