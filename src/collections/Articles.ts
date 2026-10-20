import type { CollectionConfig, PayloadRequest } from 'payload';
import { array, date, relationship, select, upload } from 'payload/shared';

import { editorialAccess } from '@/access/presets';
import { hasRole, isAdminField } from '@/access/roles';
import {
  dayOnlyDate,
  faqsArray,
  imageUpload,
  JALALI_CELL,
  JALALI_HINT,
  jalaliUpdatedAt,
  livePreview,
  persianRichText,
  proseText,
  proseTextarea,
  publishedDoctorField,
  seoGroup,
  slugField,
  sourcesArray,
  withRules,
} from '@/fields/factories';
import { articleEditor } from '@/fields/richText';
import {
  altRule,
  approvalRule,
  ARTICLE_RESERVED_SLUGS,
  ARTICLE_SLUG_MAX,
  authorRule,
  COVER_ALT_MISSING,
  headingsRule,
  internalLinks,
  type InternalLink,
  LINK_TITLE_FIELD,
  linkTarget,
  type LinkTarget,
  linksRule,
  primaryServiceRule,
  reviewedAtRule,
  reviewerRule,
  richProseRule,
  sourcesRule,
} from '@/fields/validators';
import { articleComputed } from '@/hooks/computed';
import { contentHooks } from '@/hooks/compose';
import { reviewGate } from '@/hooks/review';

const notSelf = ({ id }: { id?: number | string }) => (id ? { id: { not_equals: id } } : true);
const idOf = (value: unknown): number | string | null => {
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value;
  return typeof id === 'number' || typeof id === 'string' ? id : null;
};

/** Status, title and kind of every internal link target, read once per collection. */
async function linkTargets(req: PayloadRequest, links: InternalLink[]): Promise<LinkTarget[]> {
  const found = new Map<string, Record<string, unknown>>();
  for (const collection of new Set(links.map((l) => l.relationTo))) {
    const field = LINK_TITLE_FIELD[collection];
    if (!field) continue;
    const { docs } = await req.payload.find({
      collection: collection as 'services',
      where: { id: { in: links.filter((l) => l.relationTo === collection).map((l) => l.id) } },
      depth: 0,
      pagination: false,
      select: { _status: true, [field]: true, ...(collection === 'pages' ? { key: true } : {}) },
      req,
    });
    for (const doc of docs as Record<string, unknown>[])
      found.set(`${collection}:${String(doc.id)}`, doc);
  }
  return links.map((link) => linkTarget(link, found.get(`${link.relationTo}:${String(link.id)}`)));
}

/** V-LINKS on publish: targets are read, so a dead link names its page (C2). */
async function linksOnPublish(
  body: unknown,
  { req, data, event }: { req: PayloadRequest; data: Record<string, unknown>; event?: string },
) {
  if (event !== 'submit') return true;
  const targets = await linkTargets(req, internalLinks(body));
  const primaryId = idOf(data.primaryService);
  let primary: { id: number | string; title: string } | null = null;
  if (primaryId !== null) {
    const linked = targets.find(
      (t) => t.relationTo === 'services' && String(t.id) === String(primaryId),
    );
    const service = linked
      ? null
      : await req.payload.findByID({
          collection: 'services',
          id: primaryId,
          depth: 0,
          disableErrors: true,
          select: { navLabel: true },
          req,
        });
    primary = { id: primaryId, title: linked?.title ?? service?.navLabel ?? '' };
  }
  return linksRule(targets, primary);
}

/**
 * spec-data 2.5 with the phase 6 gate (H5 with C1, H6, H7 with C2, C3): every article publishes
 * only when an admin approved it, with a published reviewer dentist, a review date, sources, two
 * H2 headings and live links to a service and a guide. `contentUpdatedAt` (not `updatedAt`) feeds
 * dateModified.
 */
export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'مقاله', plural: 'مقالات' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'reviewState', '_status', 'publishedAt', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'excerpt'],
    description:
      'مقاله‌های سلامت دهان و دندان. فهرست «پیش از انتشار» کنار هر مقاله شرط‌های انتشار را نشان می‌دهد؛ پس از نوشتن، مرحله را «منتظر بازبینی» بگذارید تا مدیر تأیید کند.',
    livePreview: livePreview('articles'),
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
      prose: [
        'title',
        'excerpt',
        'body',
        'faqs.*.question',
        'faqs.*.answer',
        'seo.title',
        'seo.description',
      ],
      names: ['staffAuthorName'],
      persianDigits: true,
    },
    beforeValidate: [reviewGate],
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
      max: ARTICLE_SLUG_MAX,
      reserved: ARTICLE_RESERVED_SLUGS,
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
        const media = await req.payload.findByID({
          collection: 'media',
          id: idOf(value) as number,
          depth: 0,
          disableErrors: true,
          req,
        });
        return media?.alt?.trim() ? altRule(media.alt) : COVER_ALT_MISSING;
      }),
    },
    {
      name: 'body',
      type: 'richText',
      label: 'متن',
      required: true,
      editor: articleEditor,
      validate: withRules(persianRichText, richProseRule, headingsRule, linksOnPublish),
      admin: {
        description:
          'متن مقاله با دست‌کم دو «تیتر ۲». به صفحهٔ خدمت اصلی و یکی از راهنماهای بیمار پیوند بدهید (پیوند داخلی، نه نشانی دستی).',
      },
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
      index: true,
      validate: withRules(relationship, (value, { data }) =>
        primaryServiceRule(data.isMedical, value),
      ),
      admin: {
        description:
          'خدمتی که مقاله به آن پیوند می‌دهد و کادر نوبت انتهای مقاله را می‌سازد. برای مقالهٔ پزشکی اجباری است.',
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
      admin: {
        description:
          'تا دو مقالهٔ مرتبط. خالی بماند، سیستم مقاله‌های منتشرشده را به این ترتیب پیدا می‌کند: همان خدمت اصلی، همان دسته، برچسب مشترک، تازه‌ترها.',
      },
    },
    {
      ...publishedDoctorField(
        'authorDoctor',
        'نویسندهٔ پزشک',
        'author',
        'نویسنده، اگر یکی از پزشکان است. فقط پزشکان منتشرشده در فهرست هستند.',
        (value, { data }) => authorRule(value, data.staffAuthorName),
      ),
      index: true,
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
      admin: {
        description:
          'مقاله دربارهٔ درمان، بیماری یا مراقبت است. در این حالت خدمت اصلی اجباری است. بازبینی و منبع برای همهٔ مقاله‌ها اجباری است.',
      },
    },
    {
      ...publishedDoctorField(
        'reviewer',
        'بازبین پزشکی',
        'reviewer',
        'دندانپزشکی که متن را بازبینی کرده است. فقط مدیر هنگام تأیید آن را انتخاب می‌کند.',
        (value) => reviewerRule(true, value),
      ),
      index: true,
      access: { create: isAdminField, update: isAdminField },
    },
    {
      ...dayOnlyDate(
        'reviewedAt',
        'تاریخ بازبینی',
        'تاریخ بازبینی پزشکی؛ مدیر هنگام تأیید پر می‌کند.',
      ),
      validate: withRules(date, (value) => reviewedAtRule(true, value)),
      access: { create: isAdminField, update: isAdminField },
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'تاریخ بازبینی پزشکی؛ مدیر هنگام تأیید پر می‌کند.',
        components: { afterInput: [JALALI_HINT] },
      },
    },
    {
      ...sourcesArray(
        'منابع علمی: ADA، AAPD، AAP، Cochrane، NHS، IADT یا مقالهٔ داوری‌شده. «سایر» فقط برای واقعیت غیردرمانی، مثل قانون بیمه.',
      ),
      validate: withRules(array, (value) => sourcesRule(true, value)),
    },
    faqsArray('پرسش‌های پرتکرار در انتهای مقاله.'),
    {
      name: 'checklist',
      type: 'ui',
      label: 'پیش از انتشار',
      admin: {
        position: 'sidebar',
        components: { Field: '/admin/components/ArticleChecklist#ArticleChecklist' },
      },
    },
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
        components: { Cell: JALALI_CELL, afterInput: [JALALI_HINT] },
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
        components: { afterInput: [JALALI_HINT] },
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
      // H5: editors never pick «تأییدشده»; an approved article keeps it in its own list.
      filterOptions: ({ options, req, data }) =>
        hasRole(req.user, 'admin') || data?.reviewState === 'approved'
          ? options
          : options.filter((o) => (typeof o === 'string' ? o : o.value) !== 'approved'),
      validate: withRules(select, (value) => approvalRule(value)),
      admin: {
        position: 'sidebar',
        description:
          'نویسنده «منتظر بازبینی» می‌گذارد و فقط مدیر «تأییدشده» می‌کند. مقاله فقط پس از تأیید منتشر می‌شود. ویرایش متن مقالهٔ تأییدشده آن را به «منتظر بازبینی» برمی‌گرداند.',
      },
    },
    seoGroup({ descriptionRequired: true, topic: ['{title}'] }),
    jalaliUpdatedAt,
  ],
};
