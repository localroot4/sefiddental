import type { CollectionConfig } from 'payload';

import { readOnlyForAdmins } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';

/**
 * spec-data 4.1: who changed what and when (versions keep no user). Field paths only, never
 * values. Written by hooks through the Local API; nobody writes through REST.
 */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'سابقهٔ تغییر', plural: 'سابقهٔ تغییرات' },
  admin: {
    group: 'سیستم',
    useAsTitle: 'docLabel',
    defaultColumns: [
      'createdAt',
      'actorLabel',
      'action',
      'entitySlug',
      'docLabel',
      'changedFields',
    ],
    hidden: hiddenForEditors,
  },
  defaultSort: '-createdAt',
  disableDuplicate: true,
  lockDocuments: false,
  indexes: [{ fields: ['entitySlug', 'docId'] }, { fields: ['actor', 'createdAt'] }],
  access: readOnlyForAdmins,
  fields: [
    {
      name: 'action',
      type: 'select',
      label: 'کار',
      required: true,
      index: true,
      options: [
        { label: 'ساخت', value: 'create' },
        { label: 'ویرایش', value: 'update' },
        { label: 'انتشار', value: 'publish' },
        { label: 'لغو انتشار', value: 'unpublish' },
        { label: 'انتقال به سطل', value: 'trash' },
        { label: 'بازگردانی', value: 'restore' },
        { label: 'حذف', value: 'delete' },
        { label: 'ورود', value: 'login' },
        { label: 'خروج', value: 'logout' },
        { label: 'فراموشی رمز', value: 'forgot_password' },
        { label: 'بذر داده', value: 'seed' },
        { label: 'خروجی', value: 'export' },
      ],
      admin: { description: 'کار انجام‌شده.' },
    },
    {
      name: 'entityType',
      type: 'select',
      label: 'نوع موجودیت',
      required: true,
      options: [
        { label: 'مجموعه', value: 'collection' },
        { label: 'تنظیمات', value: 'global' },
        { label: 'ورود', value: 'auth' },
        { label: 'سیستم', value: 'system' },
      ],
      admin: { description: 'نوع موجودیت.' },
    },
    {
      name: 'entitySlug',
      type: 'text',
      label: 'مجموعه',
      required: true,
      admin: { description: 'مجموعه یا تنظیمات.' },
    },
    { name: 'docId', type: 'text', label: 'شناسهٔ سند', admin: { description: 'شناسهٔ سند.' } },
    {
      name: 'docLabel',
      type: 'text',
      label: 'عنوان سند',
      maxLength: 120,
      admin: { description: 'عنوان سند در لحظهٔ تغییر.' },
    },
    {
      name: 'changedFields',
      type: 'text',
      hasMany: true,
      label: 'فیلدهای تغییرکرده',
      admin: { description: 'فیلدهای تغییرکرده (بدون مقدار).' },
    },
    {
      name: 'statusFrom',
      type: 'text',
      label: 'وضعیت قبلی',
      admin: { description: 'تغییر وضعیت.' },
    },
    { name: 'statusTo', type: 'text', label: 'وضعیت جدید', admin: { description: 'تغییر وضعیت.' } },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      label: 'کاربر',
      admin: { description: 'کاربر.' },
    },
    {
      name: 'actorLabel',
      type: 'text',
      label: 'انجام‌دهنده',
      required: true,
      admin: { description: 'انجام‌دهنده.' },
    },
    { name: 'actorRole', type: 'text', label: 'نقش', admin: { description: 'نقش در آن لحظه.' } },
    {
      name: 'requestId',
      type: 'text',
      label: 'شناسهٔ درخواست',
      index: true,
      admin: { description: 'شناسهٔ درخواست برای پیدا کردن در گزارش‌ها.' },
    },
    { name: 'ipHash', type: 'text', label: 'اثر آی‌پی' },
    {
      name: 'note',
      type: 'textarea',
      label: 'توضیح',
      admin: { description: 'توضیح (مثلاً خلاصهٔ اجرای بذر داده).' },
    },
  ],
};

/**
 * spec-data 4.2: daily counters, one row per day and dimension set, incremented by one SQL
 * upsert (src/lib/events/increment.ts). Text plus a code allowlist, not select (no enum
 * migrations); 'none' and 'other' instead of NULL so the unique index always conflicts.
 */
export const EventsDaily: CollectionConfig = {
  slug: 'events-daily',
  labels: { singular: 'آمار روزانه', plural: 'آمار روزانه' },
  admin: {
    group: 'سیستم',
    useAsTitle: 'event',
    defaultColumns: ['date', 'event', 'location', 'pageType', 'serviceKey', 'count'],
    hidden: hiddenForEditors,
  },
  defaultSort: ['-date', '-count'],
  disableDuplicate: true,
  lockDocuments: false,
  indexes: [{ fields: ['date', 'event', 'location', 'pageType', 'serviceKey'], unique: true }],
  access: readOnlyForAdmins,
  fields: [
    {
      name: 'date',
      type: 'text',
      label: 'روز',
      required: true,
      index: true,
      admin: { description: 'روز (به وقت تهران).' },
    },
    {
      name: 'event',
      type: 'text',
      label: 'رویداد',
      required: true,
      index: true,
      admin: { description: 'نام رویداد.' },
    },
    {
      name: 'location',
      type: 'text',
      label: 'محل',
      required: true,
      defaultValue: 'none',
      admin: { description: 'جای کلیک یا فرم.' },
    },
    {
      name: 'pageType',
      type: 'text',
      label: 'نوع صفحه',
      required: true,
      defaultValue: 'other',
      admin: { description: 'نوع صفحه.' },
    },
    {
      name: 'serviceKey',
      type: 'text',
      label: 'خدمت',
      required: true,
      defaultValue: 'none',
      admin: { description: 'خدمت مرتبط.' },
    },
    {
      name: 'count',
      type: 'number',
      label: 'تعداد',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: 'تعداد.' },
    },
  ],
};
