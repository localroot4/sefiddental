import type { CollectionConfig } from 'payload';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import { orderField, proseText, proseTextarea, tomanField } from '@/fields/factories';
import { contentHooks } from '@/hooks/compose';

/** spec-data 2.3: the restoration tiers (standard, VIP, CIP). Key unique per service. */
export const ServiceTiers: CollectionConfig = {
  slug: 'service-tiers',
  labels: { singular: 'سطح خدمت', plural: 'سطح‌های خدمت' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'name',
    defaultColumns: ['name', 'service', 'key', 'order', '_status'],
    hidden: hiddenForEditors,
  },
  defaultSort: ['service', 'order'],
  indexes: [{ fields: ['service', 'key'], unique: true }],
  versions: { drafts: true },
  trash: true,
  ...taxonomyAccess(),
  hooks: contentHooks('service-tiers', {
    normalize: { prose: ['name', 'description', 'materials', 'highlights'] },
  }),
  fields: [
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت',
      required: true,
      index: true,
      admin: { description: 'خدمتی که این سطح به آن تعلق دارد.' },
    },
    {
      name: 'key',
      type: 'text',
      label: 'شناسه',
      required: true,
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
          ? true
          : 'شناسه فقط حروف کوچک لاتین، رقم و خط تیره دارد؛ مثل vip.',
      access: { update: () => false },
      admin: {
        position: 'sidebar',
        description:
          'شناسهٔ ثابت سطح، مثل standard، vip، cip. در نشانی نوبت (tier) استفاده می‌شود.',
      },
    },
    proseText('name', 'نام سطح', {
      required: true,
      maxLength: 30,
      description: 'نام سطح، مثل «معمولی»، «VIP»، «CIP».',
    }),
    proseTextarea('description', 'توضیح', {
      required: true,
      maxLength: 400,
      description: 'توضیح کوتاه تفاوت این سطح. بدون وعدهٔ نتیجه.',
    }),
    proseTextarea('materials', 'مواد و روش', {
      maxLength: 300,
      description: 'مواد و روش کار، فقط اگر تأیید شده است.',
    }),
    proseText('highlights', 'نکته‌های مقایسه', {
      hasMany: true,
      maxRows: 6,
      maxLength: 60,
      description: 'نکته‌های کوتاه مقایسه.',
    }),
    tomanField(
      'priceFrom',
      'قیمت از',
      'قیمت «از …» به تومان. خالی بماند، فقط جایگاه نسبی سطح نمایش داده می‌شود.',
    ),
    orderField('ترتیب از پایه تا بالاترین سطح.'),
  ],
};
