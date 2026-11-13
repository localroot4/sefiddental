/*
 * Photos of the client preview (the clinic's own since 2026-11-13, scripts/clinic-photos.mjs) (DEMO_CONTENT, src/lib/env.ts, refused on the live site):
 * free Pexels photos in the photo slots, so the client sees the site with photos before the clinic
 * sends its own (shot list, docs/content/gaps.md rows 36, 44, 45, 48, 52). Each file is
 * self-hosted under /demo-photos (CSP img-src 'self'); public/demo-photos/CREDITS.md names the
 * source page, photographer and license of every photo. A slot shows its photo only while
 * DEMO_CONTENT is on and nothing of its own is published (MediaPlaceholder's `demo`); elsewhere
 * the slot keeps its labelled placeholder. No imports: the encode recipe in CREDITS.md reads the
 * widths from this file.
 */

/**
 * The slot kinds, each with its files and `sizes`: `frame` is the inner-page hero frame (4:5 up to
 * 1023 px, 3:2 from 1024, the page's LCP, so it loads eagerly at high priority); `card` a 4:3
 * slot from a 3:2 crop; `portrait` a 4:5 card (dentist, video poster). `wide` files are 3:2,
 * `tall` files 4:5.
 */
export const DEMO_KINDS = {
  frame: {
    wide: [960, 1440],
    tall: [640, 1080],
    sizes: '(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw',
  },
  card: {
    wide: [640, 1280],
    tall: [],
    sizes: '(min-width: 1280px) 37rem, (min-width: 744px) 50vw, 100vw',
  },
  portrait: { wide: [], tall: [640, 1080], sizes: '(min-width: 1024px) 26rem, 84vw' },
} as const;

/** Each photo once, by slot kind, with its Persian alt (ends in «عکس نمایشی»). */
export const DEMO_PHOTOS = {
  'services-hub': {
    kind: 'frame',
    alt: 'اتاق درمان کلینیک سفید با یونیت و نور روز از پنجره؛ عکس نمایشی',
  },
  cosmetic: {
    kind: 'frame',
    alt: 'معاینهٔ دندان بیمار با آینه و سوند در کلینیک؛ عکس نمایشی',
  },
  'surgery-replacement': {
    kind: 'frame',
    alt: 'قطعه‌های رنگی کیت ایمپلنت در نور آبی از نزدیک؛ عکس نمایشی',
  },
  restorative: {
    kind: 'frame',
    alt: 'سخت کردن ترمیم با نور آبی پشت محافظ نارنجی؛ عکس نمایشی',
  },
  orthodontics: {
    kind: 'frame',
    alt: 'دندان‌های با براکت ارتودنسی و آینهٔ دندانپزشکی از نزدیک؛ عکس نمایشی',
  },
  pediatric: {
    kind: 'frame',
    alt: 'میز کار کلینیک با اسباب‌بازی‌ها و مدل دندان برای کودکان؛ عکس نمایشی',
  },
  about: {
    kind: 'frame',
    alt: 'سالن انتظار کلینیک با نیمکت چوبی و گلدان‌های سبز؛ عکس نمایشی',
  },
  'guide-hub': {
    kind: 'frame',
    alt: 'دندانپزشک کلینیک کنار صفحهٔ رایانه در حال درمان بیمار؛ عکس نمایشی',
  },
  'dentists-hub': {
    kind: 'frame',
    alt: 'دندانپزشک کلینیک با روپوش آبی در حال درمان بیمار؛ عکس نمایشی',
  },
  'workflow-scan': {
    kind: 'card',
    alt: 'دندانپزشک در کنار تصویر سه‌بعدی دندان روی صفحه؛ عکس نمایشی',
  },
  'workflow-design': {
    kind: 'card',
    alt: 'بررسی رادیوگرافی دندان روی صفحهٔ رایانه؛ عکس نمایشی',
  },
  'workflow-make': {
    kind: 'card',
    alt: 'قطعه‌های کیت ایمپلنت آمادهٔ کار؛ عکس نمایشی',
  },
  'workflow-smile': {
    kind: 'card',
    alt: 'لبخند بیمار روی یونیت پس از معاینه؛ عکس نمایشی',
  },
  'shade-guide': {
    kind: 'card',
    alt: 'سینی ابزار استریل دندانپزشکی از نزدیک؛ عکس نمایشی',
  },
  'dentist-1': { kind: 'portrait', alt: 'پرترهٔ دندانپزشک کلینیک با روپوش آبی؛ عکس نمایشی' },
  'dentist-2': { kind: 'portrait', alt: 'پرترهٔ دندانپزشک کلینیک با روپوش سبز و لوپ؛ عکس نمایشی' },
  'voice-1': { kind: 'portrait', alt: 'لبخند بیمار با براکت ارتودنسی از نزدیک؛ عکس نمایشی' },
  'voice-2': { kind: 'portrait', alt: 'معاینهٔ دندان بیمار با آینه از نزدیک؛ عکس نمایشی' },
  'voice-3': { kind: 'portrait', alt: 'بیمار پشت محافظ نارنجی نور ترمیم؛ عکس نمایشی' },
} as const satisfies Record<string, { kind: keyof typeof DEMO_KINDS; alt: string }>;

export type DemoPhotoKey = keyof typeof DEMO_PHOTOS;

/** The hero photo of each service category's page, and of each service page in it. */
export const DEMO_CATEGORY_PHOTOS: Partial<Record<string, DemoPhotoKey>> = {
  cosmetic: 'cosmetic',
  'surgery-replacement': 'surgery-replacement',
  restorative: 'restorative',
  orthodontics: 'orthodontics',
  pediatric: 'pediatric',
};

/** The home hero (gap 36): the landscape from 744 px (3:2) and the 4:5 phone band. */
export const DEMO_HERO = {
  wide: [1280, 1600, 1920, 2560],
  tall: [640, 828, 1080],
  alt: 'دندانپزشک کلینیک سفید در حال درمان بیمار کنار صفحهٔ رایانه؛ عکس نمایشی',
} as const;

/** A file's URL: the 3:2 crop at `width`, or the 4:5 crop (`tall`). */
export function demoPhotoUrl(
  key: DemoPhotoKey | 'hero',
  crop: 'wide' | 'tall',
  width: number,
  ext: 'avif' | 'webp',
): string {
  return `/demo-photos/${key}-${crop === 'tall' ? 'p' : ''}${width}.${ext}`;
}
