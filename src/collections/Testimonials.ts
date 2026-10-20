import type { CollectionConfig } from 'payload';
import { checkbox, textarea, upload } from 'payload/shared';

import { editorialAccess } from '@/access/presets';
import {
  dayOnlyDate,
  imageUpload,
  jalaliUpdatedAt,
  orderField,
  proseText,
  withRules,
} from '@/fields/factories';
import { homeFlag } from '@/fields/homeLimit';
import { consentRule, proseRule } from '@/fields/validators';
import { contentHooks } from '@/hooks/compose';

const requiredFor =
  (type: 'video' | 'text', message: string) =>
  (value: unknown, { data }: { data: Record<string, unknown> }) =>
    data.type === type && (value === null || value === undefined || value === '') ? message : true;

/** spec-data 2.9. Real patients with written consent only; no third-party embeds. */
export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  labels: { singular: 'نظر بیمار', plural: 'نظرات بیماران' },
  admin: {
    group: 'بیماران و نظرات',
    useAsTitle: 'patientLabel',
    description:
      'نظر بیمارانی که رضایت کتبی داده‌اند، به شکل ویدیو یا متن. ویدیو فقط از فایل خود کلینیک، نه پیوند به سایت دیگر.',
    defaultColumns: [
      'patientLabel',
      'service',
      'type',
      'consentConfirmed',
      '_status',
      'order',
      'updatedAt',
    ],
  },
  defaultSort: 'order',
  versions: { drafts: { schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 } } },
  trash: true,
  ...editorialAccess({ scheduled: true }),
  hooks: contentHooks('testimonials', {
    normalize: { names: ['patientLabel'], prose: ['quote', 'transcriptSummary'] },
  }),
  fields: [
    proseText('patientLabel', 'بیمار', {
      required: true,
      maxLength: 30,
      description: 'نام کوچک یا حروف اول بیمار. نام کامل ننویسید.',
    }),
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت',
      index: true,
      admin: { description: 'خدمتی که بیمار دربارهٔ آن صحبت می‌کند.' },
    },
    {
      name: 'type',
      type: 'select',
      label: 'نوع',
      required: true,
      defaultValue: 'video',
      options: [
        { label: 'ویدیو', value: 'video' },
        { label: 'متن', value: 'text' },
      ],
      admin: { description: 'نوع نظر.' },
    },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      label: 'ویدیو',
      filterOptions: { mimeType: { contains: 'video' } },
      validate: withRules(
        upload,
        requiredFor('video', 'برای نظر ویدیویی، فایل ویدیو را انتخاب کنید.'),
      ),
      admin: {
        condition: (data) => data?.type === 'video',
        description: 'فایل ویدیو (MP4 یا WebM). از سرویس بیرونی پیوند ندهید.',
      },
    },
    {
      ...imageUpload('poster', 'تصویر پیش‌نمایش', 'تصویر پیش‌نمایش ویدیو.'),
      validate: withRules(
        upload,
        requiredFor('video', 'برای نظر ویدیویی، تصویر پیش‌نمایش را انتخاب کنید.'),
      ),
      admin: { condition: (data) => data?.type === 'video', description: 'تصویر پیش‌نمایش ویدیو.' },
    },
    {
      name: 'quote',
      type: 'textarea',
      label: 'جملهٔ بیمار',
      maxLength: 300,
      validate: withRules(
        textarea,
        requiredFor('text', 'برای نظر متنی، جملهٔ بیمار را بنویسید.'),
        (value) => proseRule(value),
      ),
      admin: { description: 'جملهٔ بیمار، یک تا سه خط، بدون ویرایش معنا.' },
    },
    {
      name: 'transcriptSummary',
      type: 'textarea',
      label: 'خلاصهٔ ویدیو',
      maxLength: 500,
      validate: withRules(
        textarea,
        requiredFor('video', 'برای نظر ویدیویی، خلاصهٔ گفته‌ها را بنویسید.'),
        (value) => proseRule(value),
      ),
      admin: {
        condition: (data) => data?.type === 'video',
        description: 'خلاصهٔ گفته‌های ویدیو برای موتور جست‌وجو و کاربران بدون صدا.',
      },
    },
    dayOnlyDate('recordedAt', 'تاریخ ضبط', 'تاریخ ضبط.'),
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'مدت (ثانیه)',
      min: 1,
      max: 600,
      admin: { description: 'مدت ویدیو به ثانیه.' },
    },
    {
      name: 'consentConfirmed',
      type: 'checkbox',
      label: 'رضایت کتبی',
      defaultValue: false,
      validate: withRules(checkbox, (value) => consentRule(value)),
      admin: {
        description:
          'رضایت کتبی بیمار برای انتشار گرفته شده و در پرونده است. بدون آن منتشر نمی‌شود.',
      },
    },
    homeFlag(
      'testimonials',
      'showOnHome',
      'نمایش در خانه',
      3,
      'در صفحهٔ خانه نمایش داده شود (حداکثر سه مورد).',
    ),
    orderField(),
    {
      name: 'seedKey',
      type: 'text',
      unique: true,
      admin: { hidden: true },
    },
    jalaliUpdatedAt,
  ],
};
