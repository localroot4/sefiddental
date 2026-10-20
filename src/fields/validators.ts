import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { EDITORIAL_MESSAGES } from '@/i18n/fa-editorial';
import { isGuideKey } from '@/lib/paths';
import { persianSlug } from '@/lib/persianSlug';
import { normalizePersian, toPersianDigits } from '@/lib/persianText';

/**
 * Editorial validators (spec-data 5.3). Each rule returns `true` or the Persian message. They
 * are field `validate` functions, so on drafts-enabled collections they gate publishing only
 * (drafts skip validation, spec-data P3). Pure: Payload wrappers live in the field factories.
 */
export type Rule = true | string;

const fa = (n: number): string => toPersianDigits(String(n));
/** Code points after NFC: the count Google and the SERP preview use (ZWNJ counts). */
export const codePoints = (value: string): number => [...value.normalize('NFC')].length;
const length = codePoints;
const filled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

export const TITLE_MAX = 60;
/** C24: below this the checklist and the SERP preview warn; it never blocks a save. */
export const TITLE_MIN = 50;
export const DESCRIPTION_MIN = 120;
export const DESCRIPTION_MAX = 160;
export const DEFAULT_TITLE_SUFFIX = ' | کلینیک دندانپزشکی سفید';
export const DEFAULT_SHORT_TITLE_SUFFIX = ' | کلینیک سفید';
/** H4 (docs/seo/keyword-map.md:52): article category titles name the articles section. */
export const ARTICLE_CATEGORY_TITLE_SUFFIX = ' | مقالات کلینیک دندانپزشکی سفید';

/** The two seo-defaults suffixes, or the fixed article category one. */
export type SuffixKey = 'titleSuffix' | 'shortTitleSuffix' | 'articleCategory';

/** The default text of each suffix; the live seo-defaults values have the same length. */
export const SUFFIXES: Readonly<Record<SuffixKey, string>> = {
  titleSuffix: DEFAULT_TITLE_SUFFIX,
  shortTitleSuffix: DEFAULT_SHORT_TITLE_SUFFIX,
  articleCategory: ARTICLE_CATEGORY_TITLE_SUFFIX,
};

/** V-TITLE: topic plus suffix within 60 code points (ZWNJ counts). */
export function titleRule(title: string | null | undefined, suffix: string): Rule {
  if (!title) return true;
  const n = length(title + suffix);
  return n <= TITLE_MAX
    ? true
    : `عنوان با پسوند ${fa(n)} نویسه است. حداکثر ${fa(TITLE_MAX)} نویسه مجاز است؛ ${fa(n - TITLE_MAX)} نویسه کوتاه‌ترش کنید.`;
}

/**
 * The topic of a document's title (src/lib/seo/metadata.ts): the first template whose `{field}`
 * placeholders are all filled, e.g. ['{h1}', '{title}'] or ['دکتر {name}، {specialty}'].
 */
export function topicOf(
  templates: readonly string[],
  data: Record<string, unknown>,
): string | null {
  for (const template of templates) {
    let complete = true;
    const text = template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = data[name];
      if (!filled(value)) complete = false;
      return filled(value) ? value.trim() : '';
    });
    if (complete) return text;
  }
  return null;
}

/** V-TITLE on the title Google shows (H6): the SEO title, else the page topic, plus the suffix. */
export function effectiveTitleRule(
  seoTitle: string | null | undefined,
  topic: string | null | undefined,
  suffix: string,
): Rule {
  if (seoTitle) return titleRule(seoTitle, suffix);
  if (!topic) return true;
  const n = length(topic + suffix);
  return n <= TITLE_MAX
    ? true
    : `عنوان صفحه با پسوند ${fa(n)} نویسه است و در گوگل بریده می‌شود. «عنوان سئو» را کوتاه‌تر بنویسید: با پسوند حداکثر ${fa(TITLE_MAX)} نویسه.`;
}

/** The title as Google shows it, for the SERP preview. */
export const effectiveTitle = (
  seoTitle: string | null | undefined,
  topic: string | null,
  suffix: string,
) => `${seoTitle || topic || ''}${suffix}`;

export type LengthState = 'short' | 'ok' | 'long';

/** C24: 50 to 60 code points is the target; short only warns, long fails V-TITLE. */
export function titleState(n: number): LengthState {
  return n < TITLE_MIN ? 'short' : n > TITLE_MAX ? 'long' : 'ok';
}

/** V-DESC: 120-160 code points when present (or always, when required). */
export function descriptionRule(value: string | null | undefined, required: boolean): Rule {
  if (!value) return required ? 'توضیح سئو را بنویسید (۱۲۰ تا ۱۶۰ نویسه).' : true;
  const n = length(value);
  return n >= DESCRIPTION_MIN && n <= DESCRIPTION_MAX
    ? true
    : `توضیح سئو ${fa(n)} نویسه است. باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.`;
}

export const RESERVED_SLUGS = ['admin', 'api', '_next', 'en', 'fa', 'vip', 'rss', 'feed'] as const;
/** H1: an article slug equal to these would shadow /مقالات/دسته and /مقالات/برچسب. */
export const ARTICLE_RESERVED_SLUGS = ['دسته', 'برچسب'] as const;
export const SLUG_EMPTY = 'نشانی خالی است. عنوان یا نشانی را وارد کنید.';
// The letters persianSlug keeps (D-S2), without the digits and a-z.
const PERSIAN_LETTER = /[\u0621-\u063A\u0641-\u0648\u067E\u0686\u0698\u06A9\u06AF\u06CC]/;

/** V-SLUG (H2): persianSlug form, at least one Persian letter, within `max`, not reserved. */
export function slugRule(
  value: string | null | undefined,
  max: number,
  reserved: readonly string[] = [],
): Rule {
  if (!value) return SLUG_EMPTY;
  if ([...RESERVED_SLUGS, ...reserved].includes(value)) {
    return 'این نشانی رزرو سیستم است. نشانی دیگری بنویسید.';
  }
  if (value !== persianSlug(value)) {
    return 'نشانی فقط حروف فارسی، رقم فارسی، حروف کوچک لاتین و یک خط تیره بین واژه‌ها دارد.';
  }
  if (!PERSIAN_LETTER.test(value)) return 'نشانی دست‌کم یک حرف فارسی لازم دارد.';
  const n = length(value);
  if (n > max) {
    return `نشانی ${fa(n)} نویسه است. حداکثر ${fa(max)} نویسه مجاز است؛ کوتاه‌ترش کنید.`;
  }
  return true;
}

/** The marker with or without its note: «[[NEEDS_CLIENT]]» and «[[NEEDS_CLIENT: …]]» (H6). */
export const MARKER = /\[\[NEEDS_CLIENT(?:[:\s][^\]]*)?\]\]/;
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

/** V-REVIEWER (H6): a reviewer when the document needs one. */
export function reviewerRule(needed: unknown, reviewer: unknown): Rule {
  return !needed || reviewer ? true : 'بازبین پزشکی را انتخاب کنید.';
}

/** V-REVIEWED: the review date, on its own field. */
export function reviewedAtRule(needed: unknown, reviewedAt: unknown): Rule {
  return !needed || reviewedAt ? true : 'تاریخ بازبینی را وارد کنید.';
}

/** H23: a reviewer or author must be a published dentist (the public box and schema need one). */
export function publishedDoctorRule(role: 'reviewer' | 'author', published: boolean): Rule {
  if (published) return true;
  const who = role === 'reviewer' ? 'بازبین' : 'نویسندهٔ پزشک';
  return `${who} منتشرنشده است. پزشکی را انتخاب کنید که صفحه‌اش در سایت منتشر شده است.`;
}

/** V-SOURCES */
export function sourcesRule(needed: unknown, sources: unknown): Rule {
  if (!needed) return true;
  return Array.isArray(sources) && sources.length > 0 ? true : 'دست‌کم یک منبع علمی اضافه کنید.';
}

/** V-APPROVAL (H5, C1): every article publishes only once an admin approved it. */
export function approvalRule(state: unknown): Rule {
  return state === 'approved'
    ? true
    : 'مقاله هنوز تأیید نشده است. «مرحلهٔ تحریریه» را «منتظر بازبینی» بگذارید تا مدیر آن را تأیید کند.';
}

/** V-PRIMARY (H21): a medical article links one service and ends with its booking box. */
export function primaryServiceRule(isMedical: unknown, service: unknown): Rule {
  return !isMedical || service
    ? true
    : 'خدمت اصلی را انتخاب کنید؛ مقالهٔ پزشکی به صفحهٔ یک خدمت پیوند می‌دهد.';
}

// A file name or a camera default, never a description of the image.
const FILE_NAME =
  /\.(jpe?g|png|webp|avif|gif|heic|heif|tiff?|mp4|webm|mov)$|^(img|dsc|dcim|pxl|photo|image|screenshot)[\s_-]*\d/i;
const ARABIC_LETTER = /[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]/;

/** V-ALT (H6, H36): 3 to 160 code points, Persian, not a file name. */
export function altRule(value: unknown): Rule {
  if (typeof value !== 'string' || value.trim() === '') return true;
  const n = length(value.trim());
  if (n < 3 || n > 160) return `متن جایگزین ${fa(n)} نویسه است. باید بین ۳ تا ۱۶۰ نویسه باشد.`;
  if (FILE_NAME.test(value.trim())) {
    return 'متن جایگزین نام فایل است. آنچه در تصویر دیده می‌شود را به فارسی بنویسید.';
  }
  return ARABIC_LETTER.test(value)
    ? true
    : 'متن جایگزین را به فارسی بنویسید: آنچه در تصویر دیده می‌شود.';
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

type LexicalNode = {
  type?: unknown;
  tag?: unknown;
  text?: unknown;
  relationTo?: unknown;
  value?: unknown;
  fields?: Record<string, unknown> & {
    linkType?: unknown;
    url?: unknown;
    doc?: { relationTo?: unknown; value?: unknown } | null;
    blockType?: unknown;
  };
  children?: unknown;
  root?: unknown;
};

/** Visits every node of a Lexical tree (the editor state or its root). */
function walk(root: unknown, visit: (node: LexicalNode) => void): void {
  const step = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as LexicalNode;
    visit(n);
    if (n.root) step(n.root);
    if (Array.isArray(n.children)) n.children.forEach(step);
  };
  step(root);
}

export interface InternalLink {
  relationTo: string;
  id: number | string;
}

/** H7: the internal document links of a Lexical tree; custom URLs never count. */
export function internalLinks(root: unknown): InternalLink[] {
  const links: InternalLink[] = [];
  walk(root, (n) => {
    if (n.type !== 'link' || n.fields?.linkType !== 'internal') return;
    const doc = n.fields.doc;
    const value = doc?.value;
    const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value;
    if (typeof doc?.relationTo === 'string' && (typeof id === 'number' || typeof id === 'string')) {
      links.push({ relationTo: doc.relationTo, id });
    }
  });
  return links;
}

// An id whether the relation is populated or not, as text, so 7, '7' and {id: 7} match.
const refId = (value: unknown): string =>
  String(typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value);

/**
 * H5: what a body points at besides its words (link targets and URLs, inline images, the video
 * block's files). The approval covers them, so a swap re-opens review.
 */
export function lexicalRefs(root: unknown): string[] {
  const refs: string[] = [];
  walk(root, (n) => {
    const f = n.fields ?? {};
    if (n.type === 'link' || n.type === 'autolink') {
      refs.push(
        f.linkType === 'internal'
          ? `${String(f.doc?.relationTo)}:${refId(f.doc?.value)}`
          : String(f.url ?? ''),
      );
    } else if (n.type === 'upload') {
      refs.push(`${String(n.relationTo)}:${refId(n.value)}`);
    } else if (n.type === 'block' && f.blockType === 'video') {
      refs.push(`media:${refId(f.video)}`, `media:${refId(f.poster)}`);
    }
  });
  return refs;
}

/** A link target as the publish check sees it: its title, status and kind. */
export interface LinkTarget extends InternalLink {
  title: string;
  published: boolean;
  /** A guide page (pages with a guide key). */
  guide: boolean;
}

/** The field that names a link target, per collection the link drawer offers (richText.ts). */
export const LINK_TITLE_FIELD: Readonly<Record<string, string>> = {
  services: 'navLabel',
  pages: 'title',
  articles: 'title',
  doctors: 'name',
};
const REMOVED_TARGET = 'صفحهٔ حذف‌شده';

/** A link target from its document; none means deleted or in the trash. */
export function linkTarget(
  link: InternalLink,
  doc: Record<string, unknown> | undefined,
): LinkTarget {
  if (!doc) return { ...link, title: REMOVED_TARGET, published: false, guide: false };
  return {
    ...link,
    title: String(doc[LINK_TITLE_FIELD[link.relationTo] ?? 'title'] ?? ''),
    published: doc._status === 'published',
    guide: link.relationTo === 'pages' && isGuideKey(doc.key as string | undefined),
  };
}

/**
 * V-LINKS (H7, C2; docs/seo/plan.md:51): every internal link points at a published document, one
 * at a service (the primary service when set) and one at a guide. RichBody drops a link to an
 * unpublished document, so such a link would be dead on the site.
 */
export function linksRule(
  targets: readonly LinkTarget[],
  primary?: { id: number | string; title: string } | null,
): Rule {
  const dead = targets.find((t) => !t.published);
  if (dead) {
    return `پیوند «${dead.title}» به صفحه‌ای منتشرنشده می‌رود و در سایت کار نمی‌کند. آن را بردارید یا صفحه‌ای منتشرشده را پیوند دهید.`;
  }
  const services = targets.filter((t) => t.relationTo === 'services');
  if (primary && !services.some((t) => String(t.id) === String(primary.id))) {
    return `در متن به خدمت اصلی مقاله («${primary.title}») پیوند بدهید.`;
  }
  if (services.length === 0) return 'در متن به صفحهٔ یک خدمت پیوند بدهید.';
  if (!targets.some((t) => t.relationTo === 'pages' && t.guide)) {
    return 'در متن به یکی از راهنماهای بیمار پیوند بدهید.';
  }
  return true;
}

/** C3: the article's table of contents lists its H2 headings. */
export function h2Count(root: unknown): number {
  let n = 0;
  walk(root, (node) => {
    if (node.type === 'heading' && node.tag === 'h2') n += 1;
  });
  return n;
}

/** V-HEADINGS (C3): at least two H2, so every article has a table of contents. */
export function headingsRule(root: unknown): Rule {
  const n = h2Count(root);
  return n >= 2
    ? true
    : `متن ${fa(n)} «تیتر ۲» دارد. دست‌کم دو «تیتر ۲» بنویسید تا فهرست مطالب ساخته شود.`;
}

/** V-TABLE: one cell per header in every row of an article table. */
export function tableRowsRule(rows: unknown, head: unknown): Rule {
  if (!Array.isArray(rows) || !Array.isArray(head)) return true;
  const index = rows.findIndex((row) => {
    const cells = (row as { cells?: unknown } | null)?.cells;
    return (Array.isArray(cells) ? cells.length : 0) !== head.length;
  });
  if (index === -1) return true;
  const cells = (rows[index] as { cells?: unknown[] }).cells?.length ?? 0;
  return `ردیف ${fa(index + 1)} جدول ${fa(cells)} خانه دارد. هر ردیف ${fa(head.length)} خانه لازم دارد، به تعداد سرستون‌ها.`;
}

/** V-CELLS: no empty cell in a row of an article table. */
export function tableCellsRule(cells: unknown): Rule {
  return Array.isArray(cells) && cells.some((cell) => typeof cell !== 'string' || !cell.trim())
    ? 'خانهٔ خالی در جدول نگذارید؛ اگر چیزی نیست، «ندارد» بنویسید.'
    : true;
}

/**
 * V-NODE (H6, H34): Lexical reports a failed node in English («block node failed to validate:
 * …»). The field errors of a block show in Persian inside it, so the body message points there.
 */
export function lexicalNodeRule(result: Rule): Rule {
  const node = typeof result === 'string' && /^(\w+) node failed to validate/.exec(result)?.[1];
  if (!node) return result;
  return node === 'block'
    ? 'یکی از بلوک‌های متن (جدول، ویدیو یا نکته) کامل نیست. بلوک را باز کنید و پیام زیر خانهٔ قرمز را بخوانید.'
    : 'یک پیوند، تصویر یا تیتر در متن کامل یا مجاز نیست. آن را دوباره بسازید یا بردارید.';
}

/**
 * The prose fields of the article blocks (H8), by block slug. Dotted paths, `*` walks an array.
 * The copy checks, reading time and the normalizer read these and nothing else of a block.
 */
export const BLOCK_PROSE: Readonly<Record<string, readonly string[]>> = {
  callout: ['text'],
  table: ['caption', 'head', 'rows.*.cells'],
  video: ['summary'],
};

function collect(value: unknown, segments: readonly string[], out: string[]): void {
  if (segments.length === 0) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => typeof v === 'string' && out.push(v));
    return;
  }
  const [head, ...rest] = segments as [string, ...string[]];
  if (head === '*') {
    if (Array.isArray(value)) value.forEach((item) => collect(item, rest, out));
  } else if (typeof value === 'object' && value !== null) {
    collect((value as Record<string, unknown>)[head], rest, out);
  }
}

/** H-READTIME: words of the plain text / 200, rounded up, at least 1 (assumed reading rate). */
export const WORDS_PER_MINUTE = 200;

export function lexicalText(root: unknown): string {
  const parts: string[] = [];
  walk(root, (n) => {
    if (typeof n.text === 'string') parts.push(n.text);
    const paths = n.type === 'block' ? BLOCK_PROSE[String(n.fields?.blockType)] : undefined;
    for (const path of paths ?? []) collect(n.fields, path.split('.'), parts);
  });
  return parts.join(' ');
}

export function readingMinutes(root: unknown): number {
  // \s does not match ZWNJ, so a half-spaced word stays one word.
  const words = lexicalText(root).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export const ARTICLE_SLUG_MAX = 60;
export const COVER_ALT_MISSING = 'تصویر شاخص متن جایگزین ندارد. آن را در کتابخانهٔ رسانه بنویسید.';

/** What the article checklist knows beyond the form; `undefined` while it is still loading. */
export interface ArticleLookups {
  suffix?: string;
  coverAlt?: string | null;
  targets?: readonly LinkTarget[];
  primary?: { id: number | string; title: string } | null;
  reviewerPublished?: boolean;
}

export type CheckId =
  | 'title'
  | 'description'
  | 'slug'
  | 'cover'
  | 'author'
  | 'primaryService'
  | 'headings'
  | 'links'
  | 'sources'
  | 'reviewer'
  | 'reviewedAt'
  | 'approval'
  | 'prose';

export interface Check {
  id: CheckId;
  label: string;
  result: Rule | 'pending';
  /** A hint that never blocks publishing (C24: a title under 50 code points). */
  warning?: string;
}

const idOf = (value: unknown): unknown =>
  typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value;

/**
 * H11: the article publish rules on the admin form data, one line per rule, with the same
 * messages as the publish gate (Articles.ts). The server gate stays the authority.
 */
export function articleChecks(data: Record<string, unknown>, lookups: ArticleLookups): Check[] {
  const seo = (data.seo ?? {}) as { title?: string | null; description?: string | null };
  const title = typeof data.title === 'string' ? data.title : '';
  const slug = filled(data.slug) ? data.slug : persianSlug(title, { maxLength: ARTICLE_SLUG_MAX });
  const faqs = Array.isArray(data.faqs)
    ? (data.faqs as { question?: unknown; answer?: unknown }[])
    : [];
  const primary = data.primaryService ? lookups.primary : null;
  const suffix = lookups.suffix ?? DEFAULT_TITLE_SUFFIX;
  const topic = topicOf(['{title}'], data);
  const cover = (): Check['result'] => {
    if (!data.cover) return 'تصویر شاخص را انتخاب کنید.';
    if (lookups.coverAlt === undefined) return 'pending';
    return lookups.coverAlt ? altRule(lookups.coverAlt) : COVER_ALT_MISSING;
  };
  const results: Record<CheckId, Check['result']> = {
    title: effectiveTitleRule(seo.title, topic, suffix),
    description: descriptionRule(seo.description, true),
    slug: slugRule(slug, ARTICLE_SLUG_MAX, ARTICLE_RESERVED_SLUGS),
    cover: cover(),
    author: authorRule(idOf(data.authorDoctor), data.staffAuthorName),
    primaryService: primaryServiceRule(data.isMedical, idOf(data.primaryService)),
    headings: headingsRule(data.body),
    links:
      lookups.targets === undefined || primary === undefined
        ? 'pending'
        : linksRule(lookups.targets, primary),
    sources: sourcesRule(true, data.sources),
    reviewer: !data.reviewer
      ? reviewerRule(true, null)
      : lookups.reviewerPublished === undefined
        ? 'pending'
        : publishedDoctorRule('reviewer', lookups.reviewerPublished),
    reviewedAt: reviewedAtRule(true, data.reviewedAt),
    approval: approvalRule(data.reviewState),
    prose: proseRule([
      title,
      data.excerpt,
      lexicalText(data.body),
      seo.title,
      seo.description,
      ...faqs.flatMap((f) => [f.question, f.answer]),
    ]),
  };
  const short = titleState(codePoints(effectiveTitle(seo.title, topic, suffix))) === 'short';
  return (Object.keys(results) as CheckId[]).map((id) => ({
    id,
    label: EDITORIAL_MESSAGES[`editorial.check.${id}`],
    result: results[id],
    ...(id === 'title' && short && results.title === true
      ? { warning: EDITORIAL_MESSAGES['editorial.serp.titleShort'] }
      : {}),
  }));
}
