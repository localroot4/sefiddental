import type { CollectionConfig } from 'payload';
import { checkbox, upload } from 'payload/shared';

import { editorialAccess } from '@/access/presets';
import {
  imageUpload,
  jalaliUpdatedAt,
  orderField,
  proseText,
  proseTextarea,
  withRules,
} from '@/fields/factories';
import { homeFlag } from '@/fields/homeLimit';
import { consentRule, pairRule } from '@/fields/validators';
import { contentHooks } from '@/hooks/compose';

/** spec-data 2.10. Before and after pairs share framing (V-PAIR) and need written consent. */
export const Cases: CollectionConfig = {
  slug: 'cases',
  labels: { singular: 'نمونهٔ قبل و بعد', plural: 'نمونه‌های قبل و بعد' },
  admin: {
    group: 'بیماران و نظرات',
    useAsTitle: 'title',
    description:
      'عکس‌های قبل و بعد درمان، فقط با رضایت کتبی بیمار. دو عکس هر نمونه باید کادر، نور و بزرگنمایی یکسان داشته باشند.',
    defaultColumns: [
      'title',
      'service',
      'consentConfirmed',
      'featuredOnHome',
      '_status',
      'order',
      'updatedAt',
    ],
  },
  defaultSort: 'order',
  versions: { drafts: { schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 } } },
  trash: true,
  ...editorialAccess({ scheduled: true }),
  hooks: contentHooks('cases', { normalize: { prose: ['title', 'notes'] } }),
  fields: [
    proseText('title', 'عنوان', {
      required: true,
      maxLength: 90,
      description: 'عنوان کوتاه، مثل «لمینت سرامیکی شش دندان جلو». بدون وعدهٔ نتیجه.',
    }),
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت',
      required: true,
      index: true,
      admin: { description: 'خدمت این نمونه. فیلتر صفحهٔ قبل و بعد از آن ساخته می‌شود.' },
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'پزشک',
      index: true,
      admin: { description: 'پزشک انجام‌دهنده، اگر منتشر شده است.' },
    },
    {
      ...imageUpload(
        'before',
        'عکس قبل',
        'عکس قبل. کادر، نور و بزرگنمایی باید با عکس بعد یکی باشد.',
        true,
      ),
      validate: withRules(upload, async (value, { req, data, event }) => {
        if (!value || !data.after || event !== 'submit') return true;
        const idOf = (v: unknown) =>
          typeof v === 'object' && v ? (v as { id: number }).id : (v as number);
        const [before, after] = await Promise.all(
          [value, data.after].map((v) =>
            req.payload.findByID({
              collection: 'media',
              id: idOf(v),
              depth: 0,
              disableErrors: true,
              req,
            }),
          ),
        );
        return pairRule(before, after);
      }),
    },
    imageUpload('after', 'عکس بعد', 'عکس بعد.', true),
    proseTextarea('notes', 'توضیح', {
      maxLength: 400,
      description: 'چه کاری انجام شد و در چند جلسه. بدون وعده.',
    }),
    {
      name: 'consentConfirmed',
      type: 'checkbox',
      label: 'رضایت کتبی',
      defaultValue: false,
      validate: withRules(checkbox, (value) => consentRule(value)),
      admin: { description: 'رضایت کتبی بیمار گرفته شده است. بدون آن منتشر نمی‌شود.' },
    },
    homeFlag('cases', 'featuredOnHome', 'نمایش در خانه', 3, 'در صفحهٔ خانه نمایش داده شود.'),
    orderField(),
    {
      name: 'sourceFolder',
      type: 'text',
      label: 'پوشهٔ منبع',
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
        description: 'پوشهٔ منبع در مخزن (برای ورود خودکار).',
      },
    },
    jalaliUpdatedAt,
  ],
};
