/*
 * Persian copy of the SEO lane (phase 6): the list-page title parts (H3, H4) and the share cards
 * per page type (H14), which scripts/og-cards.mjs renders once into design/brand/og/<card>.png.
 * The cards state no unconfirmed clinic fact (gaps 17, 48). Merged into MESSAGES in fa.ts.
 */

/** Page types with their own share card; booking, privacy and system pages use `default` (C31). */
export const OG_CARDS = [
  'default',
  'services-hub',
  'service-category',
  'service',
  'articles',
  'article',
  'guide-hub',
  'guide',
  'dentists-hub',
  'dentist',
  'pricing',
  'cases',
  'about',
  'address',
  'emergency',
] as const;

export type OgCard = (typeof OG_CARDS)[number];

export const SEO_MESSAGES = {
  // «مقالات سلامت دهان و دندان، صفحهٔ ۲» (H3); the number is written with Persian digits.
  'seo.page': 'صفحهٔ {n}',
  // Category and tag titles: «{نام دسته} | مقالات کلینیک دندانپزشکی سفید» (keyword map, H4).
  'seo.articlesOf': 'مقالات {site}',

  'seo.og.default.title': 'کلینیک دندانپزشکی سفید',
  'seo.og.default.line': 'خانی‌آباد نو، جنوب تهران',
  'seo.og.services-hub.title': 'خدمات دندانپزشکی',
  'seo.og.services-hub.line': 'زیبایی، جراحی و جایگزینی، درمان و نگهداری دندان',
  'seo.og.service-category.title': 'خدمات کلینیک سفید',
  'seo.og.service-category.line': 'درمان‌های هر گروه، مراحل و پرسش‌های رایج',
  'seo.og.service.title': 'درمان دندان در کلینیک سفید',
  'seo.og.service.line': 'مراحل درمان و پرسش‌های رایج',
  'seo.og.articles.title': 'مقالات سلامت دهان و دندان',
  'seo.og.articles.line': 'نوشته‌هایی ساده و همراه با منبع برای بیماران',
  'seo.og.article.title': 'مقالهٔ سلامت دهان و دندان',
  'seo.og.article.line': 'از مقالات کلینیک دندانپزشکی سفید',
  'seo.og.guide-hub.title': 'راهنمای بیمار',
  'seo.og.guide-hub.line': 'اولین مراجعه، ترس از دندانپزشکی و مراقبت بعد از درمان',
  'seo.og.guide.title': 'راهنمای بیمار کلینیک سفید',
  'seo.og.guide.line': 'نکته‌های ساده برای پیش و پس از درمان',
  'seo.og.dentists-hub.title': 'دندانپزشکان کلینیک سفید',
  'seo.og.dentists-hub.line': 'آشنایی با پزشکان و خدمات هر کدام',
  'seo.og.dentist.title': 'دندانپزشک کلینیک سفید',
  'seo.og.dentist.line': 'سوابق، مدارک و خدمات',
  'seo.og.pricing.title': 'هزینه‌ها، بیمه و شرایط پرداخت',
  'seo.og.pricing.line': 'پیش از درمان از هزینه و راه‌های پرداخت باخبر شوید',
  'seo.og.cases.title': 'قبل و بعد درمان',
  'seo.og.cases.line': 'نمونه‌کارها فقط با رضایت بیمار منتشر می‌شوند',
  'seo.og.about.title': 'درباره کلینیک دندانپزشکی سفید',
  'seo.og.about.line': 'آشنایی با کلینیک سفید در خانی‌آباد نو',
  'seo.og.address.title': 'آدرس و ساعات کاری',
  'seo.og.address.line': 'خانی‌آباد نو، خیابان میعاد شمالی',
  'seo.og.emergency.title': 'درد شدید دندان دارید؟',
  'seo.og.emergency.line': 'کارهای فوری و راه تماس با کلینیک سفید',
} as const satisfies Record<
  'seo.page' | 'seo.articlesOf' | `seo.og.${OgCard}.${'title' | 'line'}`,
  string
>;

/** The title and the supporting line of one share card. */
export function ogCardCopy(card: OgCard): { title: string; line: string } {
  return { title: SEO_MESSAGES[`seo.og.${card}.title`], line: SEO_MESSAGES[`seo.og.${card}.line`] };
}
