import type { CollectionConfig } from 'payload';

import { adminAccess } from '@/access/presets';
import { importRedirectsCsv } from '@/admin/redirects/importEndpoint';
import { hiddenForEditors } from '@/access/roles';
import { contentHooks } from '@/hooks/compose';
import {
  flattenRedirect,
  fromRule,
  normalizeRedirect,
  repointChains,
  toRule,
} from '@/hooks/redirects';

/**
 * spec-data 2.13: a flat `from -> to` table, one indexed read per request. Admin only; the
 * proxy reads it through the internal route, never public REST. Hit counts are written with one
 * SQL statement (src/lib/data/redirects.ts), never through hooks.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'تغییر مسیر', plural: 'تغییر مسیرها' },
  admin: {
    group: 'سیستم',
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'statusCode', 'active', 'source', 'hits', 'lastHitAt'],
    listSearchableFields: ['from', 'to'],
    hidden: hiddenForEditors,
    components: { beforeListTable: ['/admin/redirects/ImportCsv#ImportCsv'] },
  },
  defaultSort: '-updatedAt',
  versions: true,
  ...adminAccess(),
  endpoints: [{ path: '/import', method: 'post', handler: importRedirectsCsv }],
  hooks: contentHooks('redirects', {
    beforeValidate: [normalizeRedirect],
    beforeChange: [flattenRedirect],
    afterChange: [repointChains],
    revalidate: 'expire',
    docTags: false,
  }),
  fields: [
    {
      name: 'from',
      type: 'text',
      label: 'نشانی قدیمی',
      required: true,
      unique: true,
      index: true,
      validate: fromRule as never,
      admin: { description: 'نشانی قدیمی، بدون دامنه و بدون علامت سؤال. مثال: /vip' },
    },
    {
      name: 'to',
      type: 'text',
      label: 'مقصد',
      index: true,
      validate: toRule as never,
      admin: { description: 'نشانی مقصد در همین سایت.' },
    },
    {
      name: 'statusCode',
      type: 'select',
      label: 'نوع انتقال',
      required: true,
      defaultValue: '301',
      options: [
        { label: '۳۰۱ (دائمی)', value: '301' },
        { label: '۳۰۲ (موقت)', value: '302' },
        { label: '۳۰۸ (دائمی، حفظ روش)', value: '308' },
        { label: '۴۱۰ (حذف‌شده)', value: '410' },
      ],
      admin: { description: 'نوع انتقال. برای تغییر دائمی همیشه ۳۰۱.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'فعال',
      defaultValue: true,
      index: true,
      admin: { description: 'فعال است. برای غیرفعال کردن به‌جای حذف، تیک را بردارید.' },
    },
    {
      name: 'source',
      type: 'select',
      label: 'منشأ',
      required: true,
      index: true,
      defaultValue: 'manual',
      options: [
        { label: 'دستی', value: 'manual' },
        { label: 'تغییر نشانی', value: 'slug_change' },
        { label: 'نشانی کوتاه', value: 'alias' },
        { label: 'نشانی‌های سایت قبلی', value: 'import' },
        { label: 'حذف یا لغو انتشار', value: 'auto_removed' },
      ],
      admin: { description: 'این انتقال از کجا آمده است.' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'یادداشت',
      maxLength: 300,
      admin: { description: 'یادداشت داخلی.' },
    },
    {
      name: 'hits',
      type: 'number',
      label: 'دفعه‌های استفاده',
      defaultValue: 0,
      admin: { readOnly: true, description: 'تعداد دفعه‌های استفاده.' },
    },
    {
      name: 'lastHitAt',
      type: 'date',
      label: 'آخرین استفاده',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'آخرین استفاده.',
      },
    },
  ],
};
