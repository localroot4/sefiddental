import { describe, expect, it } from 'vitest';

import {
  authorRule,
  bannedRule,
  categoryTermRule,
  consentRule,
  countInternalLinks,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
  financeRule,
  homeLimitRule,
  linksRule,
  markerRule,
  pairRule,
  readingMinutes,
  reviewerRule,
  richProseRule,
  slugRule,
  sourcesRule,
  specialtyRule,
  subtextRule,
  titleRule,
} from './validators';

const link = (url: string, linkType = 'custom') => ({
  type: 'link',
  fields: { url, linkType },
  children: [],
});
const body = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
});

describe('editorial validators (spec-data 5.3): one pass, one fail, exact message', () => {
  it('V-TITLE counts the suffix and ZWNJ', () => {
    expect(titleRule('لمینت سرامیکی؛ مراحل و هزینه', DEFAULT_TITLE_SUFFIX)).toBe(true);
    const long = 'ا'.repeat(36);
    expect(titleRule(long, DEFAULT_TITLE_SUFFIX)).toBe(
      'عنوان با پسوند ۶۱ نویسه است. حداکثر ۶۰ نویسه مجاز است؛ ۱ نویسه کوتاه‌ترش کنید.',
    );
    expect(titleRule('ا'.repeat(34) + '‌', DEFAULT_TITLE_SUFFIX)).toBe(true);
    expect(titleRule('ا'.repeat(35) + '‌', DEFAULT_TITLE_SUFFIX)).not.toBe(true);
    expect(titleRule(null, DEFAULT_TITLE_SUFFIX)).toBe(true);
  });

  it('V-DESC 120-160 when present, required for articles', () => {
    expect(descriptionRule('ب'.repeat(140), false)).toBe(true);
    expect(descriptionRule('ب'.repeat(100), false)).toBe(
      'توضیح سئو ۱۰۰ نویسه است. باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.',
    );
    expect(descriptionRule('', false)).toBe(true);
    expect(descriptionRule('', true)).toBe('توضیح سئو را بنویسید (۱۲۰ تا ۱۶۰ نویسه).');
  });

  it('V-SLUG form, length and reserved words', () => {
    expect(slugRule('لمینت-سرامیکی', 80)).toBe(true);
    expect(slugRule('لمینت سرامیکی', 80)).toBe(
      'نشانی فقط حروف فارسی، رقم و خط تیره دارد و حداکثر ۸۰ نویسه است.',
    );
    expect(slugRule('ا'.repeat(61), 60)).toBe(
      'نشانی فقط حروف فارسی، رقم و خط تیره دارد و حداکثر ۶۰ نویسه است.',
    );
    expect(slugRule('vip', 80)).toBe('این نشانی رزرو سیستم است.');
    expect(slugRule('', 80)).toBe('نشانی خالی است. عنوان یا نشانی را وارد کنید.');
  });

  it('V-MARKER', () => {
    expect(markerRule('متن کامل')).toBe(true);
    expect(markerRule('پارکینگ: [[NEEDS_CLIENT: پارکینگ]]')).toBe(
      'متن هنوز علامت «[[NEEDS_CLIENT]]» دارد. پیش از انتشار، اطلاعات واقعی را جایگزین کنید.',
    );
  });

  it('V-BANNED words in any spacing, digits and the em dash', () => {
    expect(bannedRule('روکش زیرکونیا با مواد درجه‌یک')).toBe(true);
    expect(bannedRule('بهترین دندانپزشک')).toBe(
      'واژهٔ «بهترین» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.',
    );
    expect(bannedRule('خدمات بی نظیر')).toBe(
      'واژهٔ «بی‌نظیر» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.',
    );
    expect(bannedRule('درمان 100% بدون درد')).toBe(
      'واژهٔ «۱۰۰٪ بدون درد» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.',
    );
    expect(bannedRule('الف — ب')).toBe(
      'خط تیرهٔ بلند (—) مجاز نیست؛ از ویرگول، دونقطه یا جملهٔ تازه استفاده کنید.',
    );
  });

  it('V-RICH (F17) markers and banned words inside rich text block publishing', () => {
    const rich = (...texts: string[]) => body(...texts.map((text) => ({ type: 'text', text })));
    expect(richProseRule(rich('ترمیم دندان با ', 'کامپوزیت همرنگ'))).toBe(true);
    expect(richProseRule(null)).toBe(true);
    expect(richProseRule(rich('پارکینگ: [[NEEDS_CLIENT: پارکینگ]]'))).toBe(
      'متن هنوز علامت «[[NEEDS_CLIENT]]» دارد. پیش از انتشار، اطلاعات واقعی را جایگزین کنید.',
    );
    expect(richProseRule(rich('نتیجهٔ ', 'تضمینی'))).toBe(
      'واژهٔ «تضمینی» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.',
    );
  });

  it('V-SUBTEXT (F7) counts the free-consultation sentence while the flag is on', () => {
    const fifteen = Array.from({ length: 15 }, () => 'واژه').join(' ');
    expect(subtextRule(fifteen, true)).toBe(true);
    expect(subtextRule(`${fifteen} یک`, true)).toBe(
      'متن زیر تیتر با جملهٔ «مشاورهٔ اول رایگان است.» ۲۰ واژه است. حداکثر ۱۹ واژه مجاز است.',
    );
    expect(subtextRule(`${fifteen} یک دو سه چهار`, false)).toBe(true);
    expect(subtextRule(`${fifteen} یک دو سه چهار پنج`, false)).toBe(
      'متن زیر تیتر ۲۰ واژه است. حداکثر ۱۹ واژه مجاز است.',
    );
    expect(subtextRule('می‌شوید', true)).toBe(true);
    expect(subtextRule('', true)).toBe(true);
  });

  it('V-REVIEWER and V-SOURCES apply to medical content only', () => {
    expect(reviewerRule(true, 3, '2026-10-13')).toBe(true);
    expect(reviewerRule(true, 3, null)).toBe('این محتوا پزشکی است و بازبین پزشک لازم دارد.');
    expect(reviewerRule(false, null, null)).toBe(true);
    expect(sourcesRule(true, [{ title: 'ADA' }])).toBe(true);
    expect(sourcesRule(true, [])).toBe('دست‌کم یک منبع علمی اضافه کنید.');
    expect(sourcesRule(false, [])).toBe(true);
  });

  it('V-LINKS counts internal links only', () => {
    const two = body(
      link('/خدمات/ایمپلنت-دندان'),
      link('', 'internal'),
      link('https://example.com'),
    );
    expect(countInternalLinks(two, 'https://sefiddental.ir')).toBe(2);
    expect(linksRule(two, 'https://sefiddental.ir')).toBe(true);
    expect(linksRule(body(link('https://sefiddental.ir/مقالات')), 'https://sefiddental.ir')).toBe(
      'مقاله ۱ پیوند داخلی دارد. دست‌کم دو پیوند به صفحه‌های سایت بگذارید.',
    );
  });

  it('V-AUTHOR exactly one author', () => {
    expect(authorRule(4, null)).toBe(true);
    expect(authorRule(null, 'مریم')).toBe(true);
    expect(authorRule(4, 'مریم')).toBe('یک نویسنده انتخاب کنید: یا پزشک، یا نام یکی از کارکنان.');
    expect(authorRule(null, '  ')).toBe('یک نویسنده انتخاب کنید: یا پزشک، یا نام یکی از کارکنان.');
  });

  it('V-CONSENT', () => {
    expect(consentRule(true)).toBe(true);
    expect(consentRule(false)).toBe('بدون تأیید رضایت کتبی بیمار، انتشار ممکن نیست.');
  });

  it('V-PAIR within 2%', () => {
    expect(pairRule({ width: 1000, height: 1000 }, { width: 1010, height: 1000 })).toBe(true);
    expect(pairRule({ width: 1000, height: 1000 }, { width: 1200, height: 1000 })).toBe(
      'نسبت ابعاد عکس قبل و بعد یکی نیست. هر دو را با یک کادر برش دهید.',
    );
  });

  it('V-SPECIALTY', () => {
    expect(specialtyRule('دندانپزشک عمومی', false)).toBe(true);
    expect(specialtyRule('متخصص پروتز', true)).toBe(true);
    expect(specialtyRule('متخصص پروتز', false)).toBe(
      'واژهٔ «متخصص» فقط برای تخصص بورد تأییدشده مجاز است.',
    );
  });

  it('V-FINANCE', () => {
    const full = {
      enabled: true,
      provider: 'بانک',
      maxAmountToman: 200000000,
      whoApplies: 'بیمار',
      surchargeNote: 'حدود ۲۰ درصد',
      terms: 'دوازده ماه',
      approvalStatus: 'approved',
    };
    expect(financeRule(full)).toBe(true);
    expect(financeRule({ ...full, enabled: false, provider: null })).toBe(true);
    expect(financeRule({ ...full, provider: null })).toBe(
      'برای نمایش در سایت، نام شریک، سقف مبلغ، شرایط و تأیید نهایی لازم است.',
    );
    expect(financeRule({ ...full, approvalStatus: 'pending' })).not.toBe(true);
  });

  it('V-CATTERM compares after normalization', () => {
    expect(categoryTermRule('جایگزینی دندان', ['ایمپلنت دندان'])).toBe(true);
    expect(categoryTermRule('ايمپلنت دندان', ['ایمپلنت دندان'])).toBe(
      'نام دسته نباید با نام یک خدمت یکی باشد؛ مثلاً «جایگزینی دندان» به‌جای «ایمپلنت».',
    );
  });

  it('V-HOME3', () => {
    expect(homeLimitRule(2, 3)).toBe(true);
    expect(homeLimitRule(3, 3)).toBe(
      'حداکثر ۳ مورد در صفحهٔ خانه نمایش داده می‌شود. یکی دیگر را بردارید.',
    );
  });
});

describe('H-READTIME', () => {
  it('RT1 200 words a minute, at least 1, ZWNJ does not split', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'می‌روم').join(' ');
    expect(readingMinutes(body({ type: 'text', text: words(1) }))).toBe(1);
    expect(readingMinutes(body({ type: 'text', text: words(201) }))).toBe(2);
    expect(readingMinutes(null)).toBe(1);
  });
});
