/*
 * Notification copy for clinic staff (admin-notify.md 9.4): mail, Telegram and SMS. Ids, times
 * and counts are filled in with Persian digits; a message never holds a full phone, a name, a
 * note or triage text (D-4). Placeholders are {name}.
 */
export const NOTIFY_MESSAGES = {
  'notify.booking.subject': 'درخواست نوبت تازه #{id}',
  'notify.emergency.subject': 'درخواست فوری تازه #{id}',
  'notify.line.kind': 'نوع: {value}',
  'notify.kind.regular': 'عادی',
  'notify.kind.emergency': 'فوری',
  'notify.line.group': 'گروه خدمت: {value}',
  'notify.line.time': 'زمان دلخواه: {value}',
  'notify.line.createdAt': 'زمان ثبت: {value}',
  'notify.line.callbackDue': 'مهلت تماس: {value}',
  'notify.line.phone': 'شماره: {value}',
  'notify.line.link': 'باز کردن درخواست در پنل: {value}',
  'notify.line.requestId': 'شناسهٔ پیگیری: {value}',
  'notify.value.none': 'انتخاب نشده',
  'notify.value.unknown': 'نامشخص',
  'notify.value.dateTime': '{date}، ساعت {time}',
  'notify.sms.booking': 'درخواست نوبت تازه #{id}. پنل را ببینید.',
  'notify.sms.emergency': 'درخواست فوری تازه #{id}. پنل را ببینید.',
  'notify.sms.patient':
    'کلینیک دندانپزشکی سفید: درخواست نوبت شما ثبت شد. پذیرش در ساعات کاری با شما تماس می‌گیرد.',
  'notify.spike.subject': 'هشدار: درخواست‌های زیاد از یک نشانی اینترنتی',
  'notify.spike.text':
    'در یک ساعت گذشته بیش از ۱۰ درخواست از یک نشانی اینترنتی رسید. درخواست‌های بعدی با وضعیت «مشکوک» ذخیره می‌شوند. فهرست مشکوک‌ها: {link}',
  'notify.error.subject': 'خطای سایت در {route}',
  'notify.error.text':
    'یک خطای تازه در سایت ثبت شد. تعداد تکرار: {count}. شناسهٔ پیگیری: {requestId}. جزئیات: {link}',
  'notify.test.subject': 'پیام آزمایشی اعلان‌های سایت',
  'notify.test.text': 'این پیام آزمایشی است. اگر آن را می‌بینید، این راه اعلان کار می‌کند.',
  'notify.fail.mail': 'ارسال ایمیل نشد ({cause}). تنظیمات SMTP را بررسی کنید.',
  'notify.fail.telegram': 'ارسال تلگرام نشد ({cause}).',
  'notify.fail.sms': 'پیامک هنوز راه‌اندازی نشده است.',
} as const;

export type NotifyMessageKey = keyof typeof NOTIFY_MESSAGES;
