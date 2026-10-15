/*
 * Strings and clinic facts of the 500 boundary ((site)/error.tsx). Next loads that client
 * boundary on every page, so it reads this small module instead of src/i18n/fa.ts, which would
 * pull every area's messages into each page's JavaScript (F1). Merged into MESSAGES in fa.ts.
 */

export const SYSTEM_MESSAGES = {
  'call.label': 'تماس با کلینیک',
  'links.heading': 'صفحه‌های پرکاربرد',
  'error.title': 'مشکلی پیش آمد',
  'error.heading': 'مشکلی پیش آمد',
  'error.lead':
    'صفحه درست باز نشد. چند لحظهٔ دیگر دوباره امتحان کنید. اگر کار فوری دارید، با کلینیک تماس بگیرید.',
  'error.retry': 'تلاش دوباره',
  'error.code': 'کد خطا:',
} as const;

/**
 * Clinic facts the system pages need when the database is down (spec 14.2), from
 * docs/content/clinic.yaml. The hours line is the `hoursSummary()` wording (freeze F14).
 */
export const CLINIC_FALLBACK = {
  name: 'کلینیک دندانپزشکی سفید',
  phoneE164: '+982155101054',
  phoneDisplay: '۰۲۱ ۵۵۱۰ ۱۰۵۴',
  hoursLine: 'هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.',
} as const;

/** Links of the 404 and 500 pages (spec 14.1): the three category hubs, all services. */
export const SYSTEM_LINKS = [
  { label: 'خدمات زیبایی دندان', href: '/خدمات/زیبایی' },
  { label: 'جراحی و جایگزینی دندان', href: '/خدمات/جراحی-و-جایگزینی-دندان' },
  { label: 'درمان و نگهداری دندان', href: '/خدمات/درمان-دندان' },
  { label: 'همهٔ خدمات', href: '/خدمات' },
] as const;
