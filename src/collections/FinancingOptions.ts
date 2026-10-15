import type { CollectionConfig } from 'payload';
import { checkbox } from 'payload/shared';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import {
  dayOnlyDate,
  keyField,
  orderField,
  proseText,
  proseTextarea,
  tomanField,
  withRules,
} from '@/fields/factories';
import { financeRule } from '@/fields/validators';
import { contentHooks } from '@/hooks/compose';

/**
 * spec-data 2.12. `enabled` is the only switch for showing an option (not the features global);
 * it needs the partner, the cap, the terms and the partner's approval (V-FINANCE).
 */
export const FinancingOptions: CollectionConfig = {
  slug: 'financing-options',
  labels: { singular: 'گزینهٔ پرداخت', plural: 'گزینه‌های پرداخت' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'title',
    defaultColumns: ['title', 'provider', 'approvalStatus', 'enabled', '_status'],
    hidden: hiddenForEditors,
  },
  defaultSort: 'order',
  versions: { drafts: true },
  trash: true,
  ...taxonomyAccess(),
  hooks: contentHooks('financing-options', {
    normalize: { prose: ['title', 'whoApplies', 'surchargeNote', 'terms'], names: ['provider'] },
  }),
  fields: [
    keyField('شناسهٔ ثابت گزینه، در متن پیام واتساپ و آمار استفاده می‌شود.'),
    proseText('title', 'عنوان', {
      required: true,
      maxLength: 40,
      description: 'نام گزینه، مثل «وام درمان».',
    }),
    proseText('provider', 'شریک مالی', {
      maxLength: 60,
      description: 'نام شریک مالی. تا نام قطعی نشده، گزینه را فعال نکنید.',
    }),
    tomanField(
      'maxAmountToman',
      'سقف مبلغ',
      'سقف مبلغ به تومان، بدون جداکننده. در سایت با حروف هم نوشته می‌شود.',
    ),
    proseTextarea('whoApplies', 'چه کسی درخواست می‌دهد', {
      maxLength: 200,
      description: 'چه کسی و با چه مدرکی درخواست می‌دهد.',
    }),
    proseText('surchargeNote', 'تفاوت با پرداخت نقدی', {
      maxLength: 120,
      description: 'تفاوت هزینه با پرداخت نقدی، شفاف.',
    }),
    proseTextarea('terms', 'شرایط', { maxLength: 600, description: 'شرایط دقیق (مدت، مدارک).' }),
    {
      name: 'approvalStatus',
      type: 'select',
      label: 'وضعیت تأیید',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'تأییدشده', value: 'approved' },
        { label: 'در انتظار', value: 'pending' },
      ],
      admin: { description: 'وضعیت تأیید این گزینه با شریک مالی.' },
    },
    dayOnlyDate('approvedOn', 'تاریخ تأیید', 'تاریخ تأیید.'),
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'نمایش در سایت',
      defaultValue: false,
      index: true,
      validate: withRules(checkbox, (_value, { data }) => financeRule(data)),
      admin: {
        description:
          'نمایش در سایت. فقط وقتی روشن کنید که شریک و شرایط قطعی است. پس از روشن کردن، عنوان سئوی صفحهٔ هزینه‌ها را به «هزینه دندانپزشکی، بیمه و وام» تغییر دهید.',
      },
    },
    orderField(),
  ],
};
