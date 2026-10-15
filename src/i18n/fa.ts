/*
 * Persian UI strings of the layout and the system pages (spec 5.7, 14). One copy per string;
 * the static 503/410 documents keep their own copy in src/lib/system-pages/staticPage.ts, and a
 * test checks both for banned words, Arabic letters and em dashes. Routes are ready for /en
 * without exposing it: /en and /en/* render the 404 page and never appear in a sitemap.
 */

import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { HOME_MESSAGES } from '@/i18n/fa-home';
import { NAV_MESSAGES } from '@/i18n/fa-nav';
import { PAGES_MESSAGES } from '@/i18n/fa-pages';
import { SERVICES_MESSAGES } from '@/i18n/fa-services';
import { UI_MESSAGES } from '@/i18n/fa-ui';

export type Locale = { lang: 'fa'; dir: 'rtl' };

const LOCALE: Locale = { lang: 'fa', dir: 'rtl' };

export function getLocale(): Locale {
  return LOCALE;
}

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

const MESSAGES = {
  'skip.toMain': 'پرش به محتوای اصلی',
  'brand.homeLink': 'کلینیک دندانپزشکی سفید، صفحهٔ اصلی',
  'theme.toggle': 'تغییر پوسته',
  'call.label': 'تماس با کلینیک',
  'urgent.label': 'درد شدید دارید؟',
  'links.heading': 'صفحه‌های پرکاربرد',
  'notFound.title': 'صفحه پیدا نشد',
  'notFound.heading': 'این صفحه پیدا نشد',
  'notFound.lead': 'نشانی را دوباره بررسی کنید یا از پیوندهای زیر به صفحهٔ مورد نظرتان بروید.',
  'error.title': 'مشکلی پیش آمد',
  'error.heading': 'مشکلی پیش آمد',
  'error.lead':
    'صفحه درست باز نشد. چند لحظهٔ دیگر دوباره امتحان کنید. اگر کار فوری دارید، با کلینیک تماس بگیرید.',
  'error.retry': 'تلاش دوباره',
  'error.code': 'کد خطا:',
  'footer.copyright': 'همهٔ حقوق برای کلینیک دندانپزشکی سفید محفوظ است.',
  // One module per area keeps parallel work off a shared file; keys are prefixed by area.
  ...UI_MESSAGES,
  ...CONTENT_MESSAGES,
  ...NAV_MESSAGES,
  ...HOME_MESSAGES,
  ...SERVICES_MESSAGES,
  ...PAGES_MESSAGES,
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function t(key: MessageKey): string {
  return MESSAGES[key];
}

/** Every visible string of this module, for the copy test. */
export function allMessages(): string[] {
  return [
    ...Object.values(MESSAGES),
    CLINIC_FALLBACK.name,
    CLINIC_FALLBACK.phoneDisplay,
    CLINIC_FALLBACK.hoursLine,
    ...SYSTEM_LINKS.map((l) => l.label),
  ];
}

/** Links of the 404 and 500 pages (spec 14.1): the three category hubs, all services. */
export const SYSTEM_LINKS = [
  { label: 'خدمات زیبایی دندان', href: '/خدمات/زیبایی' },
  { label: 'جراحی و جایگزینی دندان', href: '/خدمات/جراحی-و-جایگزینی-دندان' },
  { label: 'درمان و نگهداری دندان', href: '/خدمات/درمان-دندان' },
  { label: 'همهٔ خدمات', href: '/خدمات' },
] as const;

export const EMERGENCY_PATH = '/اورژانس';
