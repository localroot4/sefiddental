import type { CollectionConfig } from 'payload';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import { imageUpload, orderField, proseText } from '@/fields/factories';
import { homeFlag } from '@/fields/homeLimit';
import { contentHooks } from '@/hooks/compose';

/** spec-data 2.11. content/data/insurances.yaml is the source of the list. */
export const Insurances: CollectionConfig = {
  slug: 'insurances',
  labels: { singular: 'بیمه', plural: 'بیمه‌ها' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'name',
    defaultColumns: ['name', 'featured', 'order', '_status'],
    hidden: hiddenForEditors,
  },
  defaultSort: ['-featured', 'order'],
  versions: { drafts: true },
  trash: true,
  ...taxonomyAccess(),
  hooks: contentHooks('insurances', { normalize: { names: ['name'] } }),
  fields: [
    {
      ...proseText('name', 'نام بیمه', {
        required: true,
        maxLength: 40,
        description: 'نام بیمه، مثل «بیمه ایران».',
      }),
      unique: true,
    },
    imageUpload('logo', 'لوگو', 'لوگوی بیمه با پس‌زمینهٔ شفاف.'),
    homeFlag(
      'insurances',
      'featured',
      'بیمهٔ اصلی',
      5,
      'جزو پنج بیمهٔ اصلی است. بقیه زیر «سایر بیمه‌ها» می‌آیند.',
    ),
    orderField(),
  ],
};
