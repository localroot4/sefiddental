import type { CollectionConfig } from 'payload';
import { text, upload } from 'payload/shared';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import { specialtyRule } from '@/fields/validators';
import {
  imageUpload,
  livePreview,
  orderField,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  withRules,
} from '@/fields/factories';
import { contentHooks } from '@/hooks/compose';
import { toLatinDigits } from '@/lib/persianText';

/**
 * spec-data 2.4. Publish gate (content/data/doctors.yaml): name, specialty, council number and
 * photo. «متخصص» only with a confirmed board specialty.
 */
export const Doctors: CollectionConfig = {
  slug: 'doctors',
  labels: { singular: 'پزشک', plural: 'پزشکان' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'name',
    defaultColumns: ['name', 'specialty', 'councilNumber', '_status', 'order'],
    listSearchableFields: ['name', 'councilNumber', 'slug'],
    hidden: hiddenForEditors,
    livePreview: livePreview('doctors'),
  },
  defaultSort: 'order',
  versions: { drafts: { schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 } } },
  trash: true,
  ...taxonomyAccess({ scheduled: true }),
  hooks: contentHooks('doctors', {
    path: 'doctors',
    normalize: {
      names: ['name'],
      prose: ['specialty', 'bio', 'degrees', 'memberships', 'seo.title', 'seo.description'],
      persianDigits: true,
    },
  }),
  fields: [
    proseText('name', 'نام', {
      required: true,
      maxLength: 60,
      description: 'نام و نام خانوادگی، بدون «دکتر». سایت «دکتر» را خودش اضافه می‌کند.',
    }),
    slugField({
      source: (data) =>
        typeof data.name === 'string' && data.name ? `دکتر ${data.name}` : undefined,
      description: 'بخش آخر نشانی صفحهٔ پزشک، مثل «دکتر-نام-خانوادگی».',
    }),
    {
      ...proseText('specialty', 'تخصص', {
        required: true,
        maxLength: 80,
        description: 'عنوان تخصص. واژهٔ «متخصص» فقط برای تخصص بورد تأییدشده مجاز است.',
      }),
      validate: withRules(text, (value, { data }) => specialtyRule(value, data.specialtyConfirmed)),
    },
    {
      name: 'specialtyConfirmed',
      type: 'checkbox',
      label: 'تخصص تأییدشده',
      defaultValue: false,
      admin: { description: 'تخصص بورد این پزشک با مدرک تأیید شده است.' },
    },
    {
      name: 'councilNumber',
      type: 'text',
      label: 'شمارهٔ نظام پزشکی',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? toLatinDigits(value).replace(/\s+/g, '') : value,
        ],
      },
      validate: withRules(text, (value) =>
        value === null || value === undefined || /^\d{1,10}$/.test(String(value))
          ? true
          : 'شمارهٔ نظام پزشکی فقط رقم است (حداکثر ۱۰ رقم).',
      ),
      admin: { description: 'شمارهٔ نظام پزشکی. بدون آن پزشک منتشر نمی‌شود.' },
    },
    proseText('degrees', 'مدرک‌ها', {
      hasMany: true,
      maxRows: 6,
      description: 'مدرک‌ها، هر کدام در یک ردیف.',
    }),
    {
      name: 'yearsExperience',
      type: 'number',
      label: 'سال‌های سابقه',
      min: 0,
      max: 60,
      admin: { description: 'سال‌های سابقهٔ کار، فقط اگر تأیید شده است.' },
    },
    proseText('memberships', 'عضویت‌ها', {
      hasMany: true,
      maxRows: 6,
      description: 'عضویت در انجمن‌های علمی.',
    }),
    proseTextarea('bio', 'معرفی', {
      maxLength: 1500,
      description: 'معرفی کوتاه، بدون ادعای «بهترین» یا وعدهٔ نتیجه.',
    }),
    {
      ...imageUpload('photo', 'عکس پرتره', 'عکس پرتره ۴:۵، واقعی، نگاه به سمت محتوا.', true),
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
        if (!media?.width || !media.height) return true;
        return media.width >= 640 && media.height >= 800
          ? true
          : 'عکس پرتره دست‌کم ۶۴۰ در ۸۰۰ پیکسل لازم دارد (پیشنهاد: ۱۰۸۰ در ۱۳۵۰).';
      }),
    },
    {
      name: 'services',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      index: true,
      label: 'خدمات',
      admin: { description: 'خدماتی که این پزشک انجام می‌دهد.' },
    },
    orderField('ترتیب در فهرست پزشکان.'),
    {
      name: 'authoredArticles',
      type: 'join',
      label: 'مقاله‌های نوشته‌شده',
      collection: 'articles',
      on: 'authorDoctor',
      admin: { description: 'مقاله‌هایی که این پزشک نوشته است.' },
    },
    {
      name: 'reviewedArticles',
      type: 'join',
      label: 'مقاله‌های بازبینی‌شده',
      collection: 'articles',
      on: 'reviewer',
      admin: { description: 'مقاله‌هایی که این پزشک بازبینی کرده است.' },
    },
    {
      name: 'cases',
      type: 'join',
      label: 'نمونه‌های قبل و بعد',
      collection: 'cases',
      on: 'doctor',
      admin: { description: 'نمونه‌های قبل و بعد این پزشک.' },
    },
    // The dentist page title: «دکتر نام، تخصص» (src/app/(site)/r/doctors/[slug]/page.tsx).
    seoGroup({ suffix: 'shortTitleSuffix', topic: ['دکتر {name}، {specialty}', 'دکتر {name}'] }),
  ],
};
