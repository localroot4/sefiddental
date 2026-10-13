import type { CollectionConfig } from 'payload';
import { select } from 'payload/shared';

import { isAdmin, isAdminField, isStaff, isStaffField } from '@/access/roles';
import { BOOKING_GROUP_OPTIONS, withRules } from '@/fields/factories';
import {
  BOOKING_STATUS_LABELS,
  bookingRules,
  normalizeBooking,
  phoneSearch,
} from '@/hooks/booking';
import { contentHooks } from '@/hooks/compose';

const readOnlyField = { readOnly: true } as const;
const never = () => false;

/**
 * spec-data 2.14. Operational data: no versions (they would copy phone numbers); the audit log
 * records every change by field path and labels the row '#id', never the phone or name.
 */
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: { singular: 'درخواست نوبت', plural: 'درخواست‌های نوبت' },
  admin: {
    group: 'نوبت‌ها',
    useAsTitle: 'listTitle',
    defaultColumns: [
      'listTitle',
      'kind',
      'status',
      'bookingGroup',
      'callbackDueAt',
      'createdAt',
      'flags',
    ],
    listSearchableFields: ['phoneNational', 'name'],
  },
  defaultSort: ['urgencyRank', '-createdAt'],
  disableDuplicate: true,
  trash: true,
  indexes: [
    { fields: ['phone', 'createdAt'] },
    { fields: ['ipHash', 'createdAt'] },
    { fields: ['status', 'createdAt'] },
  ],
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isAdmin },
  hooks: {
    beforeOperation: [phoneSearch],
    ...contentHooks('bookings', {
      beforeValidate: [normalizeBooking],
      beforeChange: [bookingRules],
      revalidate: false,
      audit: { label: (doc) => `#${String(doc.id)}`, statusField: 'status' },
    }),
  },
  fields: [
    {
      name: 'listTitle',
      type: 'text',
      label: 'عنوان',
      admin: {
        ...readOnlyField,
        description: 'عنوان فهرست؛ شماره کامل فقط داخل پرونده دیده می‌شود.',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'شمارهٔ موبایل',
      required: true,
      index: true,
      validate: (value: unknown) =>
        typeof value === 'string' && /^\+989\d{9}$/.test(value)
          ? true
          : 'شمارهٔ موبایل معتبر نیست.',
      access: { create: isStaffField, update: isAdminField },
      admin: { description: 'شمارهٔ موبایل به شکل بین‌المللی. با دکمهٔ تماس شماره بگیرید.' },
    },
    {
      name: 'phoneNational',
      type: 'text',
      label: 'شماره',
      required: true,
      index: true,
      admin: {
        ...readOnlyField,
        description: 'همان شماره به شکل ۰۹…؛ جست‌وجو با رقم فارسی یا انگلیسی کار می‌کند.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'نام',
      maxLength: 80,
      admin: { description: 'نام بیمار، اگر وارد کرده است.' },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'نوع',
      required: true,
      index: true,
      defaultValue: 'regular',
      options: [
        { label: 'عادی', value: 'regular' },
        { label: 'فوری', value: 'emergency' },
      ],
      access: { update: isAdminField },
      admin: { description: 'نوع درخواست.' },
    },
    {
      name: 'bookingGroup',
      type: 'select',
      label: 'گروه',
      index: true,
      options: BOOKING_GROUP_OPTIONS,
      admin: { description: 'گزینه‌ای که بیمار در فرم انتخاب کرد.' },
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت',
      index: true,
      admin: { description: 'خدمت دقیق، اگر صفحه آن را می‌دانست.' },
    },
    {
      name: 'serviceKey',
      type: 'text',
      label: 'شناسهٔ خدمت',
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && /^[a-z0-9-]+$/.test(value))
          ? true
          : 'شناسهٔ خدمت فقط حروف کوچک لاتین، رقم و خط تیره دارد.',
      admin: { description: 'شناسهٔ خدمت در لحظهٔ ثبت (حتی اگر خدمت بعداً حذف شود).' },
    },
    {
      name: 'tier',
      type: 'text',
      label: 'سطح',
      maxLength: 30,
      admin: { description: 'سطح انتخاب‌شده، مثل vip.' },
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'پزشک',
      admin: { description: 'پزشکی که بیمار از صفحهٔ او آمده است.' },
    },
    {
      name: 'preferredTime',
      type: 'select',
      label: 'زمان دلخواه',
      options: [
        { label: 'صبح', value: 'morning' },
        { label: 'عصر', value: 'evening' },
        { label: 'فرقی ندارد', value: 'any' },
      ],
      admin: { description: 'زمان دلخواه بیمار.' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'توضیح بیمار',
      maxLength: 500,
      admin: { description: 'توضیح بیمار.' },
    },
    {
      name: 'triage',
      type: 'select',
      hasMany: true,
      label: 'نشانه‌ها',
      options: [
        { label: 'درد شدیدی که با مسکن آرام نمی‌شود', value: 'severe_pain' },
        { label: 'ورم لثه یا صورت', value: 'swelling' },
        { label: 'دندان شکسته یا ضربه به دندان', value: 'broken' },
        { label: 'دندانی که کامل از جا درآمده است', value: 'avulsion' },
        { label: 'خونریزی کم بعد از کشیدن دندان که هنوز ادامه دارد', value: 'bleeding' },
      ],
      validate: withRules(select, (value, { data }) =>
        data.kind === 'emergency' && (!Array.isArray(value) || value.length === 0)
          ? 'برای درخواست فوری، دست‌کم یک نشانه لازم است.'
          : true,
      ),
      access: { update: isAdminField },
      admin: { description: 'نشانه‌هایی که بیمار علامت زد.' },
    },
    {
      name: 'emergencyOutcome',
      type: 'select',
      label: 'نتیجهٔ تماس فوری',
      index: true,
      options: [
        { label: 'واقعاً فوری بود', value: 'truly_urgent' },
        { label: 'فوری نبود', value: 'not_urgent' },
      ],
      admin: {
        condition: (data) => data?.kind === 'emergency',
        description: 'پس از تماس ثبت کنید. برای آمار سوءاستفاده از مسیر فوری لازم است.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'وضعیت',
      required: true,
      index: true,
      defaultValue: 'new',
      options: Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      admin: { position: 'sidebar', description: 'وضعیت پیگیری.' },
    },
    {
      name: 'flags',
      type: 'select',
      hasMany: true,
      label: 'علامت‌ها',
      options: [
        { label: 'تله', value: 'honeypot' },
        { label: 'ارسال خیلی سریع', value: 'too_fast' },
        { label: 'محدودیت IP', value: 'ip_rate' },
        { label: 'محدودیت فوری IP', value: 'emergency_ip_rate' },
        { label: 'بازگردانده‌شده', value: 'restored' },
        { label: 'اولویت فوری برداشته شد', value: 'emergency_priority_removed' },
        { label: 'ثبت دستی', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'علامت‌های سیستم. «اولویت فوری برداشته شد» یعنی درخواست‌های فوری بعدی این شماره عادی حساب می‌شوند.',
      },
    },
    {
      name: 'formLocation',
      type: 'select',
      label: 'فرم',
      options: ['hero', 'block', 'dialog', 'page', 'emergency', 'admin'].map((value) => ({
        value,
        label: value,
      })),
      admin: { description: 'فرمی که درخواست از آن آمد.' },
    },
    {
      name: 'heardFrom',
      type: 'select',
      label: 'آشنایی از',
      index: true,
      options: [
        { label: 'جست‌وجوی گوگل', value: 'google' },
        { label: 'نقشه: نشان، بلد، گوگل‌مپ', value: 'maps' },
        { label: 'اینستاگرام', value: 'instagram' },
        { label: 'معرفی دوستان و آشنایان', value: 'referral' },
        { label: 'بیمار قبلی کلینیک', value: 'returning' },
        { label: 'تابلوی کلینیک', value: 'signage' },
        { label: 'سایت نوبت‌دهی', value: 'directory' },
        { label: 'سایر', value: 'other' },
      ],
      admin: { description: 'پاسخ بیمار به «از کجا با ما آشنا شدید؟».' },
    },
    {
      name: 'callbackDueAt',
      type: 'date',
      label: 'مهلت تماس',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
        description: 'تا این زمان باید با بیمار تماس گرفته شود.',
      },
    },
    {
      name: 'urgencyRank',
      type: 'number',
      label: 'ترتیب فوریت',
      index: true,
      admin: { hidden: true },
    },
    {
      name: 'handledBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'پیگیری‌کننده',
      admin: {
        ...readOnlyField,
        position: 'sidebar',
        description: 'نخستین کسی که وضعیت را از «جدید» تغییر داد.',
      },
    },
    {
      name: 'handledAt',
      type: 'date',
      label: 'زمان پیگیری',
      admin: { ...readOnlyField, position: 'sidebar', description: 'زمان نخستین پیگیری.' },
    },
    {
      name: 'adminNotes',
      type: 'array',
      label: 'یادداشت‌های پذیرش',
      labels: { singular: 'یادداشت', plural: 'یادداشت‌ها' },
      admin: {
        description:
          'یادداشت‌های پذیرش. یادداشت‌های قبلی ویرایش نمی‌شوند؛ یادداشت تازه اضافه کنید.',
      },
      fields: [
        { name: 'text', type: 'textarea', label: 'یادداشت', required: true, maxLength: 1000 },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          label: 'نویسنده',
          admin: readOnlyField,
        },
        { name: 'at', type: 'date', label: 'زمان', admin: readOnlyField },
      ],
    },
    {
      name: 'duplicateSubmissions',
      type: 'array',
      label: 'درخواست‌های تکراری',
      access: { create: never, update: never },
      admin: {
        ...readOnlyField,
        description: 'درخواست‌های تکراری همین شماره در ۱۰ دقیقه. چیزی بازنویسی نمی‌شود.',
      },
      fields: [
        { name: 'at', type: 'date' },
        { name: 'name', type: 'text' },
        { name: 'note', type: 'textarea' },
        { name: 'serviceKey', type: 'text' },
        { name: 'preferredTime', type: 'text' },
        { name: 'sourceUrl', type: 'text' },
      ],
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'صفحهٔ ارسال',
      maxLength: 300,
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.startsWith('/'))
          ? true
          : 'فقط مسیر صفحه، با / شروع شود.',
      admin: { description: 'صفحه‌ای که فرم از آن ارسال شد.' },
    },
    {
      name: 'utm',
      type: 'group',
      label: 'کمپین',
      admin: { description: 'پارامترهای کمپین، اگر بود.' },
      fields: ['source', 'medium', 'campaign', 'term', 'content'].map((name) => ({
        name,
        type: 'text' as const,
        maxLength: 100,
      })),
    },
    {
      name: 'device',
      type: 'select',
      label: 'دستگاه',
      options: [
        { label: 'موبایل', value: 'mobile' },
        { label: 'تبلت', value: 'tablet' },
        { label: 'دسکتاپ', value: 'desktop' },
        { label: 'نامشخص', value: 'unknown' },
      ],
      admin: { description: 'نوع دستگاه (بدون ذخیرهٔ اطلاعات کامل مرورگر).' },
    },
    {
      name: 'ipHash',
      type: 'text',
      label: 'اثر IP',
      index: true,
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
          ? true
          : 'اثر IP نامعتبر است.',
      access: { read: isAdminField, update: never },
      admin: {
        readOnly: true,
        description: 'اثر یک‌طرفهٔ IP برای محدودیت‌ها. IP خام ذخیره نمی‌شود.',
      },
    },
  ],
};
