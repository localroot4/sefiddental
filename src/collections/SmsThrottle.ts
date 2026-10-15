import type { CollectionConfig } from 'payload';

import { readOnlyForAdmins } from '@/access/presets';

/**
 * SMS cap store (conversion.md 5.3, admin-notify.md 9.6): one row per form-supplied destination,
 * keyed by an HMAC of the number (never the number). Written only by src/lib/notify/smsThrottle.ts
 * with one atomic upsert; no versions, no audit, no locks, hidden in the admin.
 */
export const SmsThrottle: CollectionConfig = {
  slug: 'sms-throttle',
  labels: { singular: 'سقف پیامک', plural: 'سقف پیامک' },
  admin: { group: 'سیستم', hidden: true },
  disableDuplicate: true,
  lockDocuments: false,
  access: readOnlyForAdmins,
  fields: [
    {
      name: 'destinationHash',
      type: 'text',
      label: 'اثر شماره',
      required: true,
      unique: true,
      admin: { description: 'اثر یک‌طرفهٔ شمارهٔ گیرنده. خود شماره ذخیره نمی‌شود.' },
    },
    {
      name: 'lastSentAt',
      type: 'date',
      label: 'آخرین ارسال',
      required: true,
      admin: { description: 'زمان آخرین پیامک به این گیرنده.' },
    },
  ],
};
