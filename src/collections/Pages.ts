import type { CollectionConfig } from 'payload';
import { array, relationship, textarea, upload } from 'payload/shared';

import { adminAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import { PAGE_BLOCKS } from '@/blocks';
import {
  dayOnlyDate,
  imageUpload,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  sourcesArray,
  withRules,
} from '@/fields/factories';
import { proseRule, reviewerRule, sourcesRule } from '@/fields/validators';
import { pagePath } from '@/hooks/computed';
import { contentHooks } from '@/hooks/compose';
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

const guideOnly = (data: Partial<{ key: string }> | undefined) => isGuideKey(data?.key);

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
    hidden: hiddenForEditors,
  },
  defaultSort: 'path',
  versions: {
    drafts: {
      autosave: { interval: 2000 },
      schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 },
    },
  },
  ...adminAccess({ scheduled: true }),
  hooks: contentHooks('pages', {
    path: 'pages',
    normalize: { prose: ['title', 'lead', 'hero.subtext'] },
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
            description: 'متن زیر تیتر، حداکثر ۲۰ واژه.',
          }),
          validate: withRules(
            textarea,
            (value) => proseRule(value),
            (value) =>
              typeof value === 'string' && value.trim().split(/\s+/).length > 20
                ? 'متن زیر تیتر حداکثر ۲۰ واژه است.'
                : true,
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
      name: 'blocks',
      type: 'blocks',
      label: 'بخش‌ها',
      blocks: PAGE_BLOCKS,
      admin: { description: 'بخش‌های محتوایی صفحه به ترتیب نمایش.' },
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'بازبین پزشکی',
      validate: withRules(relationship, (value, { data }) =>
        reviewerRule(guideOnly(data as { key?: string }), value, data.reviewedAt),
      ),
      admin: { condition: guideOnly, description: 'بازبین پزشکی این راهنما.' },
    },
    {
      ...dayOnlyDate('reviewedAt', 'تاریخ بازبینی', 'تاریخ بازبینی.'),
      admin: {
        condition: guideOnly,
        date: { pickerAppearance: 'dayOnly' },
        description: 'تاریخ بازبینی.',
      },
    },
    {
      ...sourcesArray('منابع علمی این راهنما.'),
      validate: withRules(array, (value, { data }) =>
        sourcesRule(guideOnly(data as { key?: string }), value),
      ),
      admin: { condition: guideOnly, description: 'منابع علمی این راهنما.' },
    },
    seoGroup(),
  ],
};
