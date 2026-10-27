import type { CollectionConfig } from 'payload';
import { array, date, textarea, upload } from 'payload/shared';

import { adminAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import { PAGE_BLOCKS } from '@/blocks';
import {
  dayOnlyDate,
  imageUpload,
  livePreview,
  proseText,
  proseTextarea,
  publishedDoctorField,
  seoGroup,
  slugField,
  sourcesArray,
  withRules,
} from '@/fields/factories';
import {
  proseRule,
  reviewedAtRule,
  reviewerRule,
  sourcesRule,
  subtextRule,
} from '@/fields/validators';
import { pagePath } from '@/hooks/computed';
import { contentHooks } from '@/hooks/compose';
import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { isGuideKey, PAGE_KEYS } from '@/lib/paths';

const PAGE_LABELS: Record<string, string> = {
  home: 'خانه',
  'services-hub': 'همهٔ خدمات',
  'dentists-hub': 'پزشکان',
  cases: 'قبل و بعد',
  pricing: 'هزینه و پرداخت',
  'guide-hub': 'راهنمای بیمار',
  'guide-first-visit': 'راهنما: اولین مراجعه',
  'guide-dental-fear': 'راهنما: ترس از دندانپزشکی',
  'guide-aftercare': 'راهنما: مراقبت بعد از درمان',
  emergency: 'اورژانس',
  about: 'درباره ما',
  address: 'آدرس و ساعات کاری',
  booking: 'رزرو نوبت',
  'booking-success': 'ثبت درخواست نوبت',
  articles: 'مقالات',
  privacy: 'حریم خصوصی',
};

type KeyData = Partial<{ key: string; blocks: unknown[] | null }> | undefined;
/** Pages that show the medical reviewer fields: the guides and the emergency page (EM-S1). */
const guideOnly = (data: KeyData) => isGuideKey(data?.key) || data?.key === 'emergency';
/**
 * Medical content that needs a reviewer and sources before it publishes: a guide, or the
 * emergency page once it has self-care blocks. Without blocks the emergency page stays publishable.
 */
export const needsMedicalReview = (data: KeyData) =>
  isGuideKey(data?.key) || (data?.key === 'emergency' && Boolean(data.blocks?.length));

/** Home sections with a heading from Payload (freeze F4, F5); the hero and trust band have none. */
const SECTION_OPTIONS = [
  { label: 'خدمات', value: 'services' },
  { label: 'سه سطح ترمیم', value: 'restoration' },
  { label: 'روش دیجیتال', value: 'workflow' },
  { label: 'قبل و بعد', value: 'compare' },
  { label: 'پزشکان', value: 'dentists' },
  { label: 'ویدئوی بیماران', value: 'voices' },
  { label: 'اولین مراجعه', value: 'journey' },
  { label: 'پرسش‌های پرتکرار', value: 'faq' },
  { label: 'درخواست نوبت', value: 'booking' },
];

/** The free-consultation flag; on any read error the stricter count (flag on) applies. */
async function freeConsultationOn(req: import('payload').PayloadRequest): Promise<boolean> {
  try {
    const features = await req.payload.findGlobal({ slug: 'features', depth: 0, req });
    return features.freeConsultation !== false;
  } catch {
    return true;
  }
}

/** Pixel check of an uploaded image at publish time. */
const imageAtLeast =
  (rule: (w: number, h: number) => true | string) =>
  async (
    value: unknown,
    { req, event }: { req: import('payload').PayloadRequest; event?: string },
  ) => {
    if (!value || event !== 'submit') return true;
    const id = typeof value === 'object' ? (value as { id: number }).id : (value as number);
    const media = await req.payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      disableErrors: true,
      req,
    });
    return media?.width && media.height ? rule(media.width, media.height) : true;
  };

/** spec-data 2.8: one document per page key; path from the key, guides keep an editable slug. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'صفحه', plural: 'صفحه‌ها' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'title',
    defaultColumns: ['title', 'key', 'path', '_status', 'updatedAt'],
    // H7: editors read pages (the link drawer lists the guides) but never see them in the nav.
    hidden: hiddenForEditors,
    livePreview: livePreview('pages'),
  },
  defaultSort: 'path',
  versions: {
    drafts: {
      autosave: { interval: 2000 },
      schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 },
    },
  },
  ...adminAccess({ scheduled: true, editorsRead: true }),
  hooks: contentHooks('pages', {
    path: 'pages',
    normalize: {
      prose: [
        'title',
        'lead',
        'hero.subtext',
        'sections.*.heading',
        'sections.*.intro',
        // H9: block prose (content body, steps, FAQ, facts, callout) and the SEO texts.
        'blocks.*.body',
        'blocks.*.items.*.title',
        'blocks.*.items.*.text',
        'blocks.*.items.*.question',
        'blocks.*.items.*.answer',
        'blocks.*.items.*.label',
        'blocks.*.items.*.value',
        'blocks.*.text',
        'seo.title',
        'seo.description',
      ],
      persianDigits: true,
    },
    beforeChange: [pagePath],
  }),
  fields: [
    {
      name: 'key',
      type: 'select',
      label: 'شناسهٔ صفحه',
      required: true,
      unique: true,
      options: PAGE_KEYS.map((value) => ({ value, label: PAGE_LABELS[value] ?? value })),
      access: { update: () => false },
      admin: {
        position: 'sidebar',
        description: 'شناسهٔ ثابت صفحه. مسیر و قالب صفحه از آن می‌آید.',
      },
    },
    proseText('title', 'تیتر', {
      required: true,
      maxLength: 90,
      description: 'تیتر اصلی صفحه (H1).',
    }),
    slugField({
      source: 'title',
      unique: false,
      nullableWhen: (data) => data.key === 'home',
      // Hub slugs belong to the route tree; only guide slugs change (with a 301).
      access: {
        update: ({ doc, data }) => isGuideKey((doc?.key ?? data?.key) as string | undefined),
      },
      description: 'بخش آخر نشانی. برای صفحه‌های اصلی ثابت است.',
    }),
    {
      name: 'path',
      type: 'text',
      label: 'نشانی کامل',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'نشانی کامل صفحه، خودکار ساخته می‌شود.',
      },
    },
    proseTextarea('lead', 'جملهٔ زیر تیتر', { maxLength: 300, description: 'جملهٔ زیر تیتر.' }),
    {
      name: 'hero',
      type: 'group',
      label: 'بالای صفحهٔ خانه',
      admin: { condition: (data) => data?.key === 'home', description: 'بخش بالای صفحهٔ خانه.' },
      fields: [
        {
          ...imageUpload(
            'photo',
            'عکس افقی',
            'عکس افقی تمام‌عرض (از ۷۴۴ پیکسل). فضای خالی کلینیک، نور طبیعی، بدون چهره. نقطهٔ کانونی را روی جزء اصلی در نوار میانی و بالایی بگذارید.',
          ),
          validate: withRules(
            upload,
            imageAtLeast((w) =>
              w >= 2560 ? true : 'عکس افقی خانه دست‌کم ۲۵۶۰ پیکسل عرض لازم دارد (پیشنهاد: ۴۰۰۰).',
            ),
          ),
        },
        {
          ...imageUpload(
            'photoPortrait',
            'عکس ۴:۵ موبایل',
            'عکس ۴:۵ موبایل از همان عکاسی. خالی بماند، از عکس افقی با نقطهٔ کانونی بریده می‌شود. جزء اصلی در یک‌سوم بالایی باشد.',
          ),
          validate: withRules(
            upload,
            imageAtLeast((w, h) =>
              w >= 1080 && h >= 1350 && Math.abs(w / h - 0.8) / 0.8 <= 0.02
                ? true
                : 'عکس موبایل باید ۴:۵ و دست‌کم ۱۰۸۰ در ۱۳۵۰ پیکسل باشد.',
            ),
          ),
        },
        {
          ...proseTextarea('subtext', 'متن زیر تیتر', {
            description: `متن زیر تیتر، بدون جملهٔ «${CONTENT_MESSAGES['content.freeConsultation']}»؛ آن جمله وقتی قابلیت مشاورهٔ رایگان روشن است خودکار جلوی این متن می‌آید. هر دو با هم حداکثر ۱۹ واژه.`,
          }),
          validate: withRules(
            textarea,
            (value) => proseRule(value),
            // Every run reads the flag: the admin form state validates with event 'onChange' and
            // blocks the save on that result, so a typing-time default would reject valid text.
            async (value, { req }) => subtextRule(value, await freeConsultationOn(req)),
          ),
        },
      ],
    },
    {
      ...imageUpload('heroMedia', 'عکس بالای صفحه', 'عکس بالای صفحه (۳:۲ دسکتاپ، ۴:۵ موبایل).'),
      admin: {
        condition: (data) => data?.key !== 'home',
        description: 'عکس بالای صفحه (۳:۲ دسکتاپ، ۴:۵ موبایل).',
      },
    },
    {
      name: 'sections',
      type: 'array',
      label: 'تیتر بخش‌ها',
      labels: { singular: 'بخش', plural: 'بخش‌ها' },
      maxRows: SECTION_OPTIONS.length,
      validate: withRules(array, (value) => {
        const keys = Array.isArray(value) ? value.map((row) => (row as { key?: string }).key) : [];
        return new Set(keys).size === keys.length ? true : 'هر بخش فقط یک بار می‌آید.';
      }),
      admin: {
        condition: (data) => data?.key === 'home',
        description: 'تیتر و جملهٔ کوتاه زیر تیتر بخش‌های صفحهٔ خانه؛ هر بخش یک بار.',
      },
      fields: [
        { name: 'key', type: 'select', label: 'بخش', required: true, options: SECTION_OPTIONS },
        proseText('heading', 'تیتر بخش', { required: true, maxLength: 80 }),
        proseTextarea('intro', 'جملهٔ زیر تیتر', { maxLength: 300 }),
      ],
    },
    {
      name: 'blocks',
      type: 'blocks',
      label: 'بخش‌ها',
      blocks: PAGE_BLOCKS,
      admin: { description: 'بخش‌های محتوایی صفحه به ترتیب نمایش.' },
    },
    {
      ...publishedDoctorField(
        'reviewer',
        'بازبین پزشکی',
        'reviewer',
        'بازبین پزشکی این صفحه. فقط پزشکان منتشرشده در فهرست هستند.',
        (value, { data }) => reviewerRule(needsMedicalReview(data as KeyData), value),
      ),
      admin: {
        condition: guideOnly,
        description: 'بازبین پزشکی این صفحه. فقط پزشکان منتشرشده در فهرست هستند.',
      },
    },
    {
      ...dayOnlyDate('reviewedAt', 'تاریخ بازبینی', 'تاریخ بازبینی.'),
      validate: withRules(date, (value, { data }) =>
        reviewedAtRule(needsMedicalReview(data as KeyData), value),
      ),
      admin: {
        condition: guideOnly,
        date: { pickerAppearance: 'dayOnly' },
        description: 'تاریخ بازبینی.',
      },
    },
    {
      ...sourcesArray('منابع علمی این صفحه.'),
      validate: withRules(array, (value, { data }) =>
        sourcesRule(needsMedicalReview(data as KeyData), value),
      ),
      admin: { condition: guideOnly, description: 'منابع علمی این صفحه.' },
    },
    seoGroup({ topic: ['{title}'] }),
  ],
};
