/*
 * Persian UI strings of the layout and the system pages (spec 5.7, 14). One copy per string;
 * the static 503/410 documents keep their own copy in src/lib/system-pages/staticPage.ts, and a
 * test checks both for banned words, Arabic letters and em dashes. Routes are ready for /en
 * without exposing it: /en and /en/* render the 404 page and never appear in a sitemap.
 */

import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { ADMIN_MESSAGES } from '@/i18n/fa-admin';
import { ARTICLES_MESSAGES } from '@/i18n/fa-articles';
import { BOOKING_MESSAGES } from '@/i18n/fa-booking';
import { EDITORIAL_MESSAGES } from '@/i18n/fa-editorial';
import { EMERGENCY_MESSAGES } from '@/i18n/fa-emergency';
import { HOME_MESSAGES } from '@/i18n/fa-home';
import { NAV_MESSAGES } from '@/i18n/fa-nav';
import { NOTIFY_MESSAGES } from '@/i18n/fa-notify';
import { PAGES_MESSAGES } from '@/i18n/fa-pages';
import { REDIRECTS_MESSAGES } from '@/i18n/fa-redirects';
import { SEO_MESSAGES } from '@/i18n/fa-seo';
import { SERVICES_MESSAGES } from '@/i18n/fa-services';
import { STATUS_MESSAGES } from '@/i18n/fa-status';
import { CLINIC_FALLBACK, SYSTEM_LINKS, SYSTEM_MESSAGES } from '@/i18n/fa-system';
import { UI_MESSAGES } from '@/i18n/fa-ui';

export { CLINIC_FALLBACK, SYSTEM_LINKS };

export type Locale = { lang: 'fa'; dir: 'rtl' };

const LOCALE: Locale = { lang: 'fa', dir: 'rtl' };

export function getLocale(): Locale {
  return LOCALE;
}

const MESSAGES = {
  'skip.toMain': 'پرش به محتوای اصلی',
  'brand.homeLink': 'کلینیک دندانپزشکی سفید، صفحهٔ اصلی',
  'theme.toggle': 'پوستهٔ تیره',
  'urgent.label': 'درد شدید دارید؟',
  'notFound.title': 'صفحه پیدا نشد',
  'notFound.heading': 'این صفحه پیدا نشد',
  'notFound.lead': 'نشانی را دوباره بررسی کنید یا از پیوندهای زیر به صفحهٔ مورد نظرتان بروید.',
  // One module per area keeps parallel work off a shared file; keys are prefixed by area.
  ...SYSTEM_MESSAGES,
  ...UI_MESSAGES,
  ...CONTENT_MESSAGES,
  ...NAV_MESSAGES,
  ...HOME_MESSAGES,
  ...SERVICES_MESSAGES,
  ...PAGES_MESSAGES,
  ...NOTIFY_MESSAGES,
  ...EMERGENCY_MESSAGES,
  ...ADMIN_MESSAGES,
  ...BOOKING_MESSAGES,
  ...STATUS_MESSAGES,
  ...EDITORIAL_MESSAGES,
  ...SEO_MESSAGES,
  ...REDIRECTS_MESSAGES,
  ...ARTICLES_MESSAGES,
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

export const EMERGENCY_PATH = '/اورژانس';
