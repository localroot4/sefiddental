import { describe, expect, it } from 'vitest';

import {
  altRule,
  approvalRule,
  ARTICLE_RESERVED_SLUGS,
  articleChecks,
  authorRule,
  bannedRule,
  categoryTermRule,
  consentRule,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
  effectiveTitleRule,
  financeRule,
  h2Count,
  headingsRule,
  homeLimitRule,
  internalLinks,
  lexicalNodeRule,
  lexicalRefs,
  lexicalText,
  type LinkTarget,
  linksRule,
  markerRule,
  pairRule,
  primaryServiceRule,
  readingMinutes,
  reviewedAtRule,
  reviewerRule,
  richProseRule,
  slugRule,
  sourcesRule,
  specialtyRule,
  subtextRule,
  tableCellsRule,
  tableRowsRule,
  titleRule,
  titleState,
  topicOf,
} from './validators';

const link = (url: string, linkType = 'custom') => ({
  type: 'link',
  fields: { url, linkType },
  children: [],
});
const docLink = (relationTo: string, value: unknown) => ({
  type: 'link',
  fields: { linkType: 'internal', doc: { relationTo, value } },
  children: [{ type: 'text', text: 'پیوند' }],
});
const body = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
});
const h2 = (text: string) => ({ type: 'heading', tag: 'h2', children: [{ type: 'text', text }] });
const tree = (...blocks: unknown[]) => ({ root: { type: 'root', children: blocks } });
const block = (fields: Record<string, unknown>) => ({ type: 'block', fields });

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

  it('V-TITLE on the effective title: the topic plus suffix when the SEO title is empty (H6)', () => {
    const long = 'ا'.repeat(40);
    expect(effectiveTitleRule('', long, DEFAULT_TITLE_SUFFIX)).toBe(
      'عنوان صفحه با پسوند ۶۵ نویسه است و در گوگل بریده می‌شود. «عنوان سئو» را کوتاه‌تر بنویسید: با پسوند حداکثر ۶۰ نویسه.',
    );
    expect(effectiveTitleRule('عنوان کوتاه', long, DEFAULT_TITLE_SUFFIX)).toBe(true);
    expect(effectiveTitleRule(null, 'عنوان کوتاه', DEFAULT_TITLE_SUFFIX)).toBe(true);
    expect(effectiveTitleRule('ا'.repeat(36), null, DEFAULT_TITLE_SUFFIX)).toBe(
      titleRule('ا'.repeat(36), DEFAULT_TITLE_SUFFIX),
    );
    expect(effectiveTitleRule(null, null, DEFAULT_TITLE_SUFFIX)).toBe(true);
  });

  it('TS1 title state: short below 50 (a warning, C24), long above 60, ok between', () => {
    expect(titleState(49)).toBe('short');
    expect(titleState(50)).toBe('ok');
    expect(titleState(60)).toBe('ok');
    expect(titleState(61)).toBe('long');
  });

  it('TP1 topic templates: the first whose fields are all filled', () => {
    const doctor = ['دکتر {name}، {specialty}', 'دکتر {name}'];
    expect(topicOf(doctor, { name: 'نمونه', specialty: 'دندانپزشک عمومی' })).toBe(
      'دکتر نمونه، دندانپزشک عمومی',
    );
    expect(topicOf(doctor, { name: 'نمونه', specialty: ' ' })).toBe('دکتر نمونه');
    expect(topicOf(['{h1}', '{title}'], { h1: '', title: 'عنوان' })).toBe('عنوان');
    expect(topicOf(['{title}'], {})).toBeNull();
  });

  it('V-DESC 120-160 when present, required for articles', () => {
    expect(descriptionRule('ب'.repeat(140), false)).toBe(true);
    expect(descriptionRule('ب'.repeat(100), false)).toBe(
      'توضیح سئو ۱۰۰ نویسه است. باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.',
    );
    expect(descriptionRule('', false)).toBe(true);
    expect(descriptionRule('', true)).toBe('توضیح سئو را بنویسید (۱۲۰ تا ۱۶۰ نویسه).');
  });

  it('V-SLUG form, a Persian letter, length and reserved words (H2)', () => {
    expect(slugRule('لمینت-سرامیکی', 80)).toBe(true);
    expect(slugRule('ایمپلنت-all-on-۴', 80)).toBe(true);
    expect(slugRule('لمینت سرامیکی', 80)).toBe(
      'نشانی فقط حروف فارسی، رقم فارسی، حروف کوچک لاتین و یک خط تیره بین واژه‌ها دارد.',
    );
    expect(slugRule('implant-۲', 80)).toBe('نشانی دست‌کم یک حرف فارسی لازم دارد.');
    expect(slugRule('ا'.repeat(61), 60)).toBe(
      'نشانی ۶۱ نویسه است. حداکثر ۶۰ نویسه مجاز است؛ کوتاه‌ترش کنید.',
    );
    expect(slugRule('vip', 80)).toBe('این نشانی رزرو سیستم است. نشانی دیگری بنویسید.');
    expect(slugRule('', 80)).toBe('نشانی خالی است. عنوان یا نشانی را وارد کنید.');
    // Article slugs would shadow the category and tag prefixes (H1).
    expect(slugRule('دسته', 60)).toBe(true);
    expect(slugRule('دسته', 60, ARTICLE_RESERVED_SLUGS)).toBe(
      'این نشانی رزرو سیستم است. نشانی دیگری بنویسید.',
    );
    expect(slugRule('برچسب', 60, ARTICLE_RESERVED_SLUGS)).not.toBe(true);
  });

  it('V-MARKER with or without a colon (H6)', () => {
    const message =
      'متن هنوز علامت «[[NEEDS_CLIENT]]» دارد. پیش از انتشار، اطلاعات واقعی را جایگزین کنید.';
    expect(markerRule('متن کامل')).toBe(true);
    expect(markerRule('پارکینگ: [[NEEDS_CLIENT: پارکینگ]]')).toBe(message);
    expect(markerRule('پارکینگ: [[NEEDS_CLIENT]]')).toBe(message);
    expect(markerRule('[[NEEDS_CLIENTS]]')).toBe(true);
  });

  it('V-ALT: Persian, 3 to 160 code points, not a file name (H6, H36)', () => {
    expect(altRule('لبخند بیمار پس از ترمیم دندان جلو')).toBe(true);
    expect(altRule('qa-fixture: پرترهٔ پزشک')).toBe(true);
    expect(altRule('IMG_1234')).toBe(
      'متن جایگزین نام فایل است. آنچه در تصویر دیده می‌شود را به فارسی بنویسید.',
    );
    expect(altRule('لبخند.jpg')).toBe(
      'متن جایگزین نام فایل است. آنچه در تصویر دیده می‌شود را به فارسی بنویسید.',
    );
    expect(altRule('smiling patient')).toBe(
      'متن جایگزین را به فارسی بنویسید: آنچه در تصویر دیده می‌شود.',
    );
    expect(altRule('لب')).toBe('متن جایگزین ۲ نویسه است. باید بین ۳ تا ۱۶۰ نویسه باشد.');
    expect(altRule('ل'.repeat(161))).toBe(
      'متن جایگزین ۱۶۱ نویسه است. باید بین ۳ تا ۱۶۰ نویسه باشد.',
    );
    expect(altRule(null)).toBe(true);
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

  it('V-REVIEWER split into the reviewer and the review date; V-SOURCES (H6)', () => {
    expect(reviewerRule(true, 3)).toBe(true);
    expect(reviewerRule(true, null)).toBe('بازبین پزشکی را انتخاب کنید.');
    expect(reviewerRule(false, null)).toBe(true);
    expect(reviewedAtRule(true, '2026-10-13')).toBe(true);
    expect(reviewedAtRule(true, null)).toBe('تاریخ بازبینی را وارد کنید.');
    expect(reviewedAtRule(false, null)).toBe(true);
    expect(sourcesRule(true, [{ title: 'ADA' }])).toBe(true);
    expect(sourcesRule(true, [])).toBe('دست‌کم یک منبع علمی اضافه کنید.');
    expect(sourcesRule(false, [])).toBe(true);
  });

  it('V-APPROVAL and V-PRIMARY: only an approved article publishes; a medical one needs a service', () => {
    expect(approvalRule('approved')).toBe(true);
    expect(approvalRule('in_review')).toBe(
      'مقاله هنوز تأیید نشده است. «مرحلهٔ تحریریه» را «منتظر بازبینی» بگذارید تا مدیر آن را تأیید کند.',
    );
    expect(primaryServiceRule(true, 4)).toBe(true);
    expect(primaryServiceRule(false, null)).toBe(true);
    expect(primaryServiceRule(true, null)).toBe(
      'خدمت اصلی را انتخاب کنید؛ مقالهٔ پزشکی به صفحهٔ یک خدمت پیوند می‌دهد.',
    );
  });

  it('V-LINKS finds internal document links only, in any depth (H7)', () => {
    const tree1 = body(
      link('/خدمات/ایمپلنت-دندان'),
      docLink('services', 4),
      link('https://sefiddental.ir/مقالات'),
      { type: 'listitem', children: [docLink('pages', { id: 9, key: 'guide-aftercare' })] },
      link('', 'internal'),
    );
    expect(internalLinks(tree1)).toEqual([
      { relationTo: 'services', id: 4 },
      { relationTo: 'pages', id: 9 },
    ]);
    expect(internalLinks(null)).toEqual([]);
  });

  it('V-LINKS (C2): a live service link (the primary one when set) and a live guide link', () => {
    const service: LinkTarget = {
      relationTo: 'services',
      id: 4,
      title: 'ایمپلنت دندان',
      published: true,
      guide: false,
    };
    const guide: LinkTarget = {
      relationTo: 'pages',
      id: 9,
      title: 'مراقبت بعد از درمان',
      published: true,
      guide: true,
    };
    expect(linksRule([service, guide])).toBe(true);
    expect(linksRule([service, guide], { id: 4, title: 'ایمپلنت دندان' })).toBe(true);
    expect(linksRule([guide])).toBe('در متن به صفحهٔ یک خدمت پیوند بدهید.');
    expect(linksRule([service, guide], { id: 5, title: 'اوردنچر' })).toBe(
      'در متن به خدمت اصلی مقاله («اوردنچر») پیوند بدهید.',
    );
    expect(linksRule([service])).toBe('در متن به یکی از راهنماهای بیمار پیوند بدهید.');
    expect(linksRule([service, { ...guide, published: false }])).toBe(
      'پیوند «مراقبت بعد از درمان» به صفحه‌ای منتشرنشده می‌رود و در سایت کار نمی‌کند. آن را بردارید یا صفحه‌ای منتشرشده را پیوند دهید.',
    );
    // A page that is not a guide does not count as the guide link.
    expect(linksRule([service, { ...guide, guide: false }])).toBe(
      'در متن به یکی از راهنماهای بیمار پیوند بدهید.',
    );
  });

  it('V-HEADINGS (C3): at least two H2 for the table of contents', () => {
    expect(h2Count(tree(h2('یک'), { type: 'heading', tag: 'h3', children: [] }, h2('دو')))).toBe(2);
    expect(headingsRule(tree(h2('یک'), h2('دو')))).toBe(true);
    expect(headingsRule(tree(h2('یک')))).toBe(
      'متن ۱ «تیتر ۲» دارد. دست‌کم دو «تیتر ۲» بنویسید تا فهرست مطالب ساخته شود.',
    );
    expect(headingsRule(null)).not.toBe(true);
  });

  it('V-TABLE every row has one cell per header', () => {
    expect(tableRowsRule([{ cells: ['الف', 'ب'] }], ['یک', 'دو'])).toBe(true);
    expect(tableRowsRule([{ cells: ['الف', 'ب'] }, { cells: ['الف'] }], ['یک', 'دو'])).toBe(
      'ردیف ۲ جدول ۱ خانه دارد. هر ردیف ۲ خانه لازم دارد، به تعداد سرستون‌ها.',
    );
    expect(tableRowsRule(null, ['یک', 'دو'])).toBe(true);
  });

  it('V-CELLS no empty cell in a table row', () => {
    expect(tableCellsRule(['الف', 'ب'])).toBe(true);
    for (const cells of [['الف', ''], ['  '], ['الف', null]]) {
      expect(tableCellsRule(cells)).toBe(
        'خانهٔ خالی در جدول نگذارید؛ اگر چیزی نیست، «ندارد» بنویسید.',
      );
    }
    expect(tableCellsRule(undefined)).toBe(true);
  });

  it('V-NODE: Lexical node errors in Persian, naming what to fix (H6, H34)', () => {
    const block = lexicalNodeRule(
      'block node failed to validate: The following fields are invalid: rows',
    );
    expect(block).toBe(
      'یکی از بلوک‌های متن (جدول، ویدیو یا نکته) کامل نیست. بلوک را باز کنید و پیام زیر خانهٔ قرمز را بخوانید.',
    );
    for (const english of [
      'link node failed to validate: The following fields are invalid: url',
      'upload node failed to validate: Please select a valid upload',
      'heading node failed to validate: h1',
    ]) {
      expect(lexicalNodeRule(english)).toBe(
        'یک پیوند، تصویر یا تیتر در متن کامل یا مجاز نیست. آن را دوباره بسازید یا بردارید.',
      );
    }
    expect(lexicalNodeRule(true)).toBe(true);
    expect(lexicalNodeRule('این فیلد اجباری است.')).toBe('این فیلد اجباری است.');
  });

  it('LR1 lexicalRefs: link targets, inline images and video files, ids only (H5)', () => {
    const upload = (value: unknown) => ({ type: 'upload', relationTo: 'media', value });
    const refs = lexicalRefs(
      tree(
        {
          type: 'paragraph',
          children: [docLink('services', { id: 3, title: 'ایمپلنت' }), link('https://www.ada.org')],
        },
        upload(7),
        block({ blockType: 'video', video: { id: 8 }, poster: 9, summary: 'خلاصه' }),
        block({ blockType: 'callout', text: 'نکته' }),
      ),
    );
    expect(refs).toEqual(['services:3', 'https://www.ada.org', 'media:7', 'media:8', 'media:9']);
    expect(lexicalRefs(tree(upload('7')))).toEqual(lexicalRefs(tree(upload({ id: 7 }))));
  });

  it('LX1 lexicalText and the copy checks read the article blocks (H8)', () => {
    const withBlocks = tree(
      block({ blockType: 'callout', tone: 'warning', text: 'نکتهٔ هشدار' }),
      block({
        blockType: 'table',
        caption: 'مقایسه',
        head: ['روش', 'دوام'],
        rows: [{ id: 'r1', cells: ['لمینت', 'ده سال'] }],
      }),
      block({ blockType: 'video', video: 3, poster: 4, summary: 'خلاصهٔ ویدیو' }),
    );
    const text = lexicalText(withBlocks);
    for (const part of ['نکتهٔ هشدار', 'مقایسه', 'روش', 'لمینت', 'ده سال', 'خلاصهٔ ویدیو']) {
      expect(text).toContain(part);
    }
    expect(text).not.toContain('warning');
    expect(text).not.toContain('r1');
    expect(
      richProseRule(
        tree(
          block({
            blockType: 'table',
            caption: 'x',
            head: [],
            rows: [{ cells: ['نتیجهٔ تضمینی'] }],
          }),
        ),
      ),
    ).toBe('واژهٔ «تضمینی» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.');
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

describe('ARTICLE-CHECKS (H11, C1-C3, C24): the checklist runs the publish rules on form data', () => {
  const service: LinkTarget = {
    relationTo: 'services',
    id: 4,
    title: 'ایمپلنت دندان',
    published: true,
    guide: false,
  };
  const guide: LinkTarget = {
    ...service,
    relationTo: 'pages',
    id: 9,
    title: 'راهنما',
    guide: true,
  };
  const valid = {
    title: 'ایمپلنت یا بریج برای دندان',
    slug: 'ایمپلنت-یا-بریج',
    excerpt: 'خلاصه',
    cover: 7,
    authorDoctor: 2,
    staffAuthorName: '',
    isMedical: true,
    primaryService: 4,
    body: tree(h2('یک'), h2('دو'), body(docLink('services', 4), docLink('pages', 9)).root),
    sources: [{ title: 'ADA', url: 'https://www.ada.org/x' }],
    reviewer: 2,
    reviewedAt: '2026-10-10T08:30:00.000Z',
    reviewState: 'approved',
    seo: { title: '', description: 'ب'.repeat(130) },
  };
  const lookups = {
    coverAlt: 'لبخند بیمار',
    targets: [service, guide],
    primary: { id: 4, title: 'ایمپلنت دندان' },
    reviewerPublished: true,
  };
  const byId = (checks: ReturnType<typeof articleChecks>) =>
    Object.fromEntries(checks.map((c) => [c.id, c.result]));

  it('AC1 a complete article passes every line; every line has a Persian label', () => {
    const checks = articleChecks(valid, lookups);
    expect(checks.map((c) => c.id)).toEqual([
      'title',
      'description',
      'slug',
      'cover',
      'author',
      'primaryService',
      'headings',
      'links',
      'sources',
      'reviewer',
      'reviewedAt',
      'approval',
      'prose',
    ]);
    expect(checks.filter((c) => c.result !== true)).toEqual([]);
    for (const c of checks) expect(c.label).toMatch(/[؀-ۿ]/);
  });

  it('AC2 a failing line carries the publish message; unknown lookups are pending', () => {
    const results = byId(
      articleChecks(
        {
          ...valid,
          title: 'ا'.repeat(40),
          cover: null,
          reviewer: null,
          reviewedAt: null,
          reviewState: 'writing',
          sources: [],
          body: tree(h2('یک')),
          excerpt: 'بهترین درمان',
        },
        { ...lookups, targets: [] },
      ),
    );
    expect(results.title).toBe(effectiveTitleRule('', 'ا'.repeat(40), DEFAULT_TITLE_SUFFIX));
    expect(results.cover).toBe('تصویر شاخص را انتخاب کنید.');
    expect(results.reviewer).toBe('بازبین پزشکی را انتخاب کنید.');
    expect(results.reviewedAt).toBe('تاریخ بازبینی را وارد کنید.');
    expect(results.approval).toBe(approvalRule('writing'));
    expect(results.sources).toBe('دست‌کم یک منبع علمی اضافه کنید.');
    expect(results.headings).toBe(headingsRule(tree(h2('یک'))));
    expect(results.links).toBe(linksRule([], { id: 4, title: 'ایمپلنت دندان' }));
    expect(results.prose).toBe(bannedRule('بهترین درمان'));
    const unknown = byId(articleChecks(valid, { primary: null }));
    expect(unknown.cover).toBe('pending');
    expect(unknown.links).toBe('pending');
    expect(unknown.reviewer).toBe('pending');
  });

  it('AC4 a short title passes with a warning only (C24)', () => {
    const [title] = articleChecks({ ...valid, title: 'لمینت سرامیکی' }, lookups);
    expect(title).toMatchObject({
      id: 'title',
      result: true,
      warning: 'کوتاه‌تر از ۵۰ نویسه؛ ۵۰ تا ۶۰ نویسه جای بیشتری در گوگل می‌گیرد.',
    });
    expect(articleChecks(valid, lookups)[0]?.warning).toBeUndefined();
  });

  it('AC3 the cover alt and an unpublished reviewer fail with their own messages', () => {
    const results = byId(
      articleChecks(valid, { ...lookups, coverAlt: 'IMG_1234', reviewerPublished: false }),
    );
    expect(results.cover).toBe(altRule('IMG_1234'));
    expect(results.reviewer).toBe(
      'بازبین منتشرنشده است. پزشکی را انتخاب کنید که صفحه‌اش در سایت منتشر شده است.',
    );
  });
});
