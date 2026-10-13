import type { CollectionConfig } from 'payload';
import { array, date, relationship, richText, upload } from 'payload/shared';

import { editorialAccess } from '@/access/presets';
import {
  dayOnlyDate,
  faqsArray,
  imageUpload,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  sourcesArray,
  withRules,
} from '@/fields/factories';
import { authorRule, linksRule, reviewerRule, sourcesRule } from '@/fields/validators';
import { articleComputed } from '@/hooks/computed';
import { contentHooks } from '@/hooks/compose';
import { readEnv } from '@/lib/env';

const notSelf = ({ id }: { id?: number | string }) => (id ? { id: { not_equals: id } } : true);

/**
 * spec-data 2.5. YMYL gate on publish: reviewer and sources for medical content, two internal
 * links, one author, cover alt text. `contentUpdatedAt` (not `updatedAt`) feeds dateModified.
 */
export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'مقاله', plural: 'مقالات' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewState', '_status', 'publishedAt', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'excerpt'],
  },
  defaultSort: '-publishedAt',
  versions: {
    drafts: {
      autosave: { interval: 2000 },
      schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 },
    },
  },
  trash: true,
  ...editorialAccess({ scheduled: true }),
  hooks: contentHooks('articles', {
    path: 'articles',
    normalize: {
      prose: ['title', 'excerpt', 'faqs.*.question', 'faqs.*.answer'],
      names: ['staffAuthorName'],
    },
    beforeChange: [articleComputed],
  }),
  fields: [
    proseText('title', 'عنوان', {
      required: true,
      maxLength: 90,
      description: 'عنوان مقاله با اصطلاح اصلی جست‌وجو.',
    }),
    slugField({
      source: 'title',
      max: 60,
      description:
        'نشانی کوتاه فارسی. پس از انتشار تغییر ندهید مگر لازم باشد؛ تغییر آن انتقال ۳۰۱ می‌سازد.',
    }),
    proseTextarea('excerpt', 'خلاصه', {
      required: true,
      minLength: 80,
      maxLength: 220,
      description: 'خلاصهٔ دوخطی بالای مقاله و روی کارت.',
    }),
    {
      ...imageUpload(
        'cover',
        'تصویر شاخص',
        'تصویر شاخص. متن جایگزین آن در کتابخانهٔ رسانه اجباری است.',
        true,
      ),
      validate: withRules(upload, async (value, { req, event }) => {
        if (!value || event !== 'submit') return true;
        const id = typeof value === 'object' ? (value as { id: number }).id : (value as number);
        const media = await req.payload.findByID({
          collection: 'media',
          id,
          depth: 0,
          disableErrors: true,
          req,
        });
        return media?.alt?.trim()
          ? true
          : 'تصویر شاخص متن جایگزین ندارد. آن را در کتابخانهٔ رسانه بنویسید.';
      }),
    },
    {
      name: 'body',
      type: 'richText',
      label: 'متن',
      required: true,
      validate: withRules(richText, (value) => linksRule(value, readEnv().siteUrl)),
      admin: { description: 'متن مقاله. دست‌کم دو پیوند داخلی به صفحه‌های سایت بگذارید.' },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'article-categories',
      label: 'دسته',
      required: true,
      index: true,
      admin: { description: 'دستهٔ مقاله.' },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      maxRows: 8,
      label: 'برچسب‌ها',
      admin: { description: 'برچسب‌ها. صفحه‌های برچسب در گوگل نمایه نمی‌شوند.' },
    },
    {
      name: 'primaryService',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت اصلی',
      required: true,
      index: true,
      admin: {
        description: 'خدمت اصلی که مقاله به آن پیوند می‌دهد و کادر انتهای مقاله را می‌سازد.',
      },
    },
    {
      name: 'relatedArticles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      maxRows: 2,
      label: 'مقاله‌های مرتبط',
      filterOptions: notSelf,
      admin: { description: 'دو مقالهٔ مرتبط. خالی بماند، سیستم خودش پیدا می‌کند.' },
    },
    {
      name: 'authorDoctor',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'نویسندهٔ پزشک',
      index: true,
      validate: withRules(relationship, (value, { data }) =>
        authorRule(value, data.staffAuthorName),
      ),
      admin: { description: 'نویسنده، اگر یکی از پزشکان است.' },
    },
    proseText('staffAuthorName', 'نام نویسنده از کارکنان', {
      maxLength: 60,
      description: 'نام نویسنده، اگر از کارکنان است (نه پزشک).',
    }),
    {
      name: 'isMedical',
      type: 'checkbox',
      label: 'محتوای پزشکی',
      defaultValue: true,
      admin: { description: 'مقاله ادعای پزشکی دارد. در این حالت بازبین و منبع اجباری است.' },
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'بازبین پزشکی',
      index: true,
      validate: withRules(relationship, (value, { data }) =>
        reviewerRule(data.isMedical, value, data.reviewedAt),
      ),
      admin: { description: 'دندانپزشکی که محتوای پزشکی را بازبینی کرده است.' },
    },
    dayOnlyDate('reviewedAt', 'تاریخ بازبینی', 'تاریخ بازبینی پزشکی.'),
    {
      ...sourcesArray('منابع علمی: ADA، AAPD، AAP، Cochrane، NHS یا مقالهٔ داوری‌شده.'),
      validate: withRules(array, (value, { data }) => sourcesRule(data.isMedical, value)),
    },
    faqsArray('پرسش‌های پرتکرار در انتهای مقاله.'),
    {
      name: 'readingTime',
      type: 'number',
      label: 'زمان مطالعه',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'زمان مطالعه به دقیقه، خودکار محاسبه می‌شود.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'تاریخ انتشار',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
        description: 'تاریخ انتشار. خالی بماند، هنگام انتشار پر می‌شود.',
      },
    },
    {
      name: 'contentUpdatedAt',
      type: 'date',
      label: 'به‌روزرسانی محتوا',
      validate: withRules(date, (value, { data }) =>
        value &&
        data.publishedAt &&
        Date.parse(String(value)) < Date.parse(String(data.publishedAt))
          ? 'تاریخ به‌روزرسانی نمی‌تواند پیش از تاریخ انتشار باشد.'
          : true,
      ),
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
        description: 'تاریخ آخرین به‌روزرسانی مهم محتوا. برای اصلاح غلط تایپی تغییر ندهید.',
      },
    },
    {
      name: 'reviewState',
      type: 'select',
      label: 'مرحلهٔ تحریریه',
      required: true,
      index: true,
      defaultValue: 'writing',
      options: [
        { label: 'در حال نوشتن', value: 'writing' },
        { label: 'منتظر بازبینی', value: 'in_review' },
        { label: 'تأییدشده', value: 'approved' },
      ],
      admin: {
        position: 'sidebar',
        description: 'مرحلهٔ کار تحریریه. انتشار جدا از این مرحله است.',
      },
    },
    seoGroup({ descriptionRequired: true }),
  ],
};
