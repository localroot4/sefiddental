import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { persianSlug } from '@/lib/persianSlug';
import { normalizePersian, toPersianDigits } from '@/lib/persianText';

/**
 * Editorial validators (spec-data 5.3). Each rule returns `true` or the Persian message. They
 * are field `validate` functions, so on drafts-enabled collections they gate publishing only
 * (drafts skip validation, spec-data P3). Pure: Payload wrappers live in the field factories.
 */
export type Rule = true | string;

const fa = (n: number): string => toPersianDigits(String(n));
const length = (value: string): number => [...value.normalize('NFC')].length;

export const TITLE_MAX = 60;
export const DEFAULT_TITLE_SUFFIX = ' | کلینیک دندانپزشکی سفید';
export const DEFAULT_SHORT_TITLE_SUFFIX = ' | کلینیک سفید';

/** V-TITLE: topic plus suffix within 60 code points (ZWNJ counts). */
export function titleRule(title: string | null | undefined, suffix: string): Rule {
  if (!title) return true;
  const n = length(title + suffix);
  return n <= TITLE_MAX
    ? true
    : `عنوان با پسوند ${fa(n)} نویسه است. حداکثر ${fa(TITLE_MAX)} نویسه مجاز است؛ ${fa(n - TITLE_MAX)} نویسه کوتاه‌ترش کنید.`;
}

/** V-DESC: 120-160 code points when present (or always, when required). */
export function descriptionRule(value: string | null | undefined, required: boolean): Rule {
  if (!value) return required ? 'توضیح سئو را بنویسید (۱۲۰ تا ۱۶۰ نویسه).' : true;
  const n = length(value);
  return n >= 120 && n <= 160
    ? true
    : `توضیح سئو ${fa(n)} نویسه است. باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.`;
}

export const RESERVED_SLUGS = ['admin', 'api', '_next', 'en', 'fa', 'vip', 'rss', 'feed'] as const;
export const SLUG_EMPTY = 'نشانی خالی است. عنوان یا نشانی را وارد کنید.';

/** V-SLUG: already in persianSlug form, within `max`, not reserved. */
export function slugRule(value: string | null | undefined, max: number): Rule {
  if (!value) return SLUG_EMPTY;
  if ((RESERVED_SLUGS as readonly string[]).includes(value)) return 'این نشانی رزرو سیستم است.';
  if (value !== persianSlug(value) || length(value) > max) {
    return `نشانی فقط حروف فارسی، رقم و خط تیره دارد و حداکثر ${fa(max)} نویسه است.`;
  }
  return true;
}

export const MARKER = /\[\[NEEDS_CLIENT:[^\]]*\]\]/;
export const MARKER_MESSAGE =
  'متن هنوز علامت «[[NEEDS_CLIENT]]» دارد. پیش از انتشار، اطلاعات واقعی را جایگزین کنید.';

/** V-MARKER */
export function markerRule(value: unknown): Rule {
  return typeof value === 'string' && MARKER.test(value) ? MARKER_MESSAGE : true;
}

export const BANNED_WORDS = ['بهترین', 'بی‌نظیر', 'تضمینی', '۱۰۰٪ بدون درد', 'ارزان‌ترین', 'معجزه'];

// Spaces and ZWNJ removed, so «بی نظیر», «بینظیر» and «بی‌نظیر» all match.
const squash = (text: string): string =>
  normalizePersian(text, { digits: 'fa' }).replace(/%/g, '٪').replace(/[\s‌]/g, '');

/** V-BANNED: banned claims (compared after normalization) and the em dash. */
export function bannedRule(value: unknown): Rule {
  if (typeof value !== 'string' || value === '') return true;
  const text = squash(value);
  const word = BANNED_WORDS.find((w) => text.includes(squash(w)));
  if (word) return `واژهٔ «${word}» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.`;
  if (value.includes('—')) {
    return 'خط تیرهٔ بلند (—) مجاز نیست؛ از ویرگول، دونقطه یا جملهٔ تازه استفاده کنید.';
  }
  return true;
}

/** Marker and banned checks for every prose value (strings or hasMany arrays). */
export function proseRule(value: unknown): Rule {
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    const result = markerRule(item);
    if (result !== true) return result;
    const banned = bannedRule(item);
    if (banned !== true) return banned;
  }
  return true;
}

/** F17: V-MARKER and V-BANNED over the plain text of a Lexical tree (rich text bodies). */
export function richProseRule(value: unknown): Rule {
  return value ? proseRule(lexicalText(value)) : true;
}

// The fact line the home hero renders before the stored subtext while `freeConsultation` is on.
const FREE_CONSULTATION_LINE = CONTENT_MESSAGES['content.freeConsultation'];
export const SUBTEXT_MAX_WORDS = 19;
// \s does not match ZWNJ, so a half-spaced word counts once.
const wordCount = (value: string): number => value.split(/\s+/).filter(Boolean).length;

/** V-SUBTEXT (freeze F7): the rendered subtext, flag sentence included, within 19 words. */
export function subtextRule(value: unknown, freeConsultation: boolean): Rule {
  if (typeof value !== 'string' || value.trim() === '') return true;
  const n = wordCount(value) + (freeConsultation ? wordCount(FREE_CONSULTATION_LINE) : 0);
  if (n <= SUBTEXT_MAX_WORDS) return true;
  const withLine = freeConsultation ? ` با جملهٔ «${FREE_CONSULTATION_LINE}»` : '';
  return `متن زیر تیتر${withLine} ${fa(n)} واژه است. حداکثر ${fa(SUBTEXT_MAX_WORDS)} واژه مجاز است.`;
}

/** V-REVIEWER */
export function reviewerRule(isMedical: unknown, reviewer: unknown, reviewedAt: unknown): Rule {
  if (!isMedical) return true;
  return reviewer && reviewedAt ? true : 'این محتوا پزشکی است و بازبین پزشک لازم دارد.';
}

/** V-SOURCES */
export function sourcesRule(isMedical: unknown, sources: unknown): Rule {
  if (!isMedical) return true;
  return Array.isArray(sources) && sources.length > 0 ? true : 'دست‌کم یک منبع علمی اضافه کنید.';
}

/** V-AUTHOR: exactly one of a doctor or a staff name. */
export function authorRule(doctor: unknown, staffName: unknown): Rule {
  const hasDoctor = Boolean(doctor);
  const hasStaff = typeof staffName === 'string' && staffName.trim() !== '';
  return hasDoctor !== hasStaff ? true : 'یک نویسنده انتخاب کنید: یا پزشک، یا نام یکی از کارکنان.';
}

/** V-CONSENT */
export function consentRule(value: unknown): Rule {
  return value === true ? true : 'بدون تأیید رضایت کتبی بیمار، انتشار ممکن نیست.';
}

/** V-PAIR: before and after aspect ratios within 2%. */
export function pairRule(
  before: { width?: number | null; height?: number | null } | null | undefined,
  after: { width?: number | null; height?: number | null } | null | undefined,
): Rule {
  if (!before?.width || !before.height || !after?.width || !after.height) return true;
  const a = before.width / before.height;
  const b = after.width / after.height;
  return Math.abs(a - b) / Math.max(a, b) <= 0.02
    ? true
    : 'نسبت ابعاد عکس قبل و بعد یکی نیست. هر دو را با یک کادر برش دهید.';
}

/** V-SPECIALTY */
export function specialtyRule(specialty: unknown, confirmed: unknown): Rule {
  if (typeof specialty !== 'string' || confirmed === true) return true;
  return normalizePersian(specialty).includes('متخصص')
    ? 'واژهٔ «متخصص» فقط برای تخصص بورد تأییدشده مجاز است.'
    : true;
}

/** V-FINANCE */
export function financeRule(option: {
  enabled?: boolean | null;
  provider?: string | null;
  maxAmountToman?: number | null;
  whoApplies?: string | null;
  surchargeNote?: string | null;
  terms?: string | null;
  approvalStatus?: string | null;
}): Rule {
  if (!option.enabled) return true;
  const complete =
    Boolean(option.provider?.trim()) &&
    typeof option.maxAmountToman === 'number' &&
    Boolean(option.whoApplies?.trim()) &&
    Boolean(option.surchargeNote?.trim()) &&
    Boolean(option.terms?.trim()) &&
    option.approvalStatus === 'approved';
  return complete ? true : 'برای نمایش در سایت، نام شریک، سقف مبلغ، شرایط و تأیید نهایی لازم است.';
}

/** V-CATTERM: an article category is never named like a service. */
export function categoryTermRule(title: unknown, serviceTerms: readonly string[]): Rule {
  if (typeof title !== 'string' || title.trim() === '') return true;
  const key = normalizePersian(title).replace(/‌/g, ' ');
  const clash = serviceTerms.some((t) => normalizePersian(t).replace(/‌/g, ' ') === key);
  return clash
    ? 'نام دسته نباید با نام یک خدمت یکی باشد؛ مثلاً «جایگزینی دندان» به‌جای «ایمپلنت».'
    : true;
}

/** V-HOME3: at most `max` published documents carry the flag. */
export function homeLimitRule(othersWithFlag: number, max: number): Rule {
  return othersWithFlag < max
    ? true
    : `حداکثر ${fa(max)} مورد در صفحهٔ خانه نمایش داده می‌شود. یکی دیگر را بردارید.`;
}

/** V-LINKS: count internal links in a Lexical tree. */
export function countInternalLinks(root: unknown, siteOrigin: string): number {
  let count = 0;
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as {
      type?: unknown;
      fields?: { linkType?: unknown; url?: unknown };
      children?: unknown;
      root?: unknown;
    };
    if (n.type === 'link' || n.type === 'autolink') {
      const url = typeof n.fields?.url === 'string' ? n.fields.url : '';
      if (
        n.fields?.linkType === 'internal' ||
        url.startsWith('/') ||
        (siteOrigin && url.startsWith(siteOrigin))
      ) {
        count += 1;
      }
    }
    if (n.root) visit(n.root);
    if (Array.isArray(n.children)) n.children.forEach(visit);
  };
  visit(root);
  return count;
}

export function linksRule(body: unknown, siteOrigin: string): Rule {
  const n = countInternalLinks(body, siteOrigin);
  return n >= 2
    ? true
    : `مقاله ${fa(n)} پیوند داخلی دارد. دست‌کم دو پیوند به صفحه‌های سایت بگذارید.`;
}

/** H-READTIME: words of the plain text / 200, rounded up, at least 1 (assumed reading rate). */
export const WORDS_PER_MINUTE = 200;

export function lexicalText(root: unknown): string {
  const parts: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as { text?: unknown; children?: unknown; root?: unknown };
    if (typeof n.text === 'string') parts.push(n.text);
    if (n.root) visit(n.root);
    if (Array.isArray(n.children)) n.children.forEach(visit);
  };
  visit(root);
  return parts.join(' ');
}

export function readingMinutes(root: unknown): number {
  // \s does not match ZWNJ, so a half-spaced word stays one word.
  const words = lexicalText(root).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
