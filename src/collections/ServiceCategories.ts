import type { CollectionConfig } from 'payload';
import { relationship } from 'payload/shared';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors } from '@/access/roles';
import {
  faqsArray,
  imageUpload,
  keyField,
  orderField,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  withRules,
} from '@/fields/factories';
import { contentHooks } from '@/hooks/compose';
import { sharedServiceSlug } from '@/hooks/slugNamespace';

/** spec-data 2.1. A standalone category (orthodontics, pediatric) resolves to its service page. */
export const ServiceCategories: CollectionConfig = {
  slug: 'service-categories',
  labels: { singular: 'دستهٔ خدمت', plural: 'دسته‌های خدمات' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'title',
    defaultColumns: ['title', 'key', 'slug', 'order', '_status'],
    listSearchableFields: ['title', 'navLabel', 'key'],
    hidden: hiddenForEditors,
  },
  defaultSort: 'order',
  versions: { drafts: true },
  trash: true,
  ...taxonomyAccess(),
  hooks: contentHooks('service-categories', {
    path: 'service-categories',
    normalize: {
      prose: ['title', 'h1', 'navLabel', 'summary', 'intro', 'faqs.*.question', 'faqs.*.answer'],
    },
    beforeValidate: [sharedServiceSlug('services')],
  }),
  fields: [
    keyField('شناسهٔ ثابت سیستمی. در نشانی‌ها و آمار استفاده می‌شود و پس از ساخت تغییر نمی‌کند.'),
    proseText('title', 'عنوان', {
      required: true,
      maxLength: 80,
      description: 'عنوان کامل دسته، همان‌که بالای صفحهٔ دسته دیده می‌شود.',
    }),
    proseText('h1', 'تیتر اصلی', {
      maxLength: 80,
      description: 'تیتر اصلی صفحهٔ دسته. خالی بماند، عنوان دسته استفاده می‌شود.',
    }),
    proseText('navLabel', 'نام در منو', {
      required: true,
      maxLength: 40,
      description: 'نام کوتاه در منوی خدمات.',
    }),
    {
      name: 'standalone',
      type: 'checkbox',
      label: 'بدون صفحهٔ جدا',
      defaultValue: false,
      admin: {
        description: 'این دسته صفحهٔ جدا ندارد و مستقیم به صفحهٔ خدمتش می‌رود (مثل ارتودنسی).',
      },
    },
    {
      name: 'standaloneService',
      type: 'relationship',
      relationTo: 'services',
      label: 'خدمت مقصد',
      validate: withRules(relationship, (value, { data }) =>
        data.standalone && !value ? 'خدمتی را که این دسته به آن ختم می‌شود انتخاب کنید.' : true,
      ),
      admin: {
        condition: (data) => Boolean(data?.standalone),
        description: 'خدمتی که این دسته به آن ختم می‌شود.',
      },
    },
    slugField({
      source: 'navLabel',
      nullableWhen: (data) => Boolean(data.standalone),
      description: 'بخش آخر نشانی صفحهٔ دسته. خالی بگذارید تا از نام منو ساخته شود.',
    }),
    {
      name: 'accent',
      type: 'select',
      label: 'رنگ نماد',
      required: true,
      options: [
        { label: 'زیبایی', value: 'cosmetic' },
        { label: 'جراحی', value: 'surgery' },
        { label: 'ترمیمی', value: 'restorative' },
        { label: 'ارتودنسی', value: 'ortho' },
        { label: 'کودکان', value: 'kids' },
      ],
      admin: { description: 'رنگ نماد دسته. فقط برای آیکن و تصویرسازی است، نه دکمه و متن.' },
    },
    {
      name: 'icon',
      type: 'text',
      label: 'آیکن',
      maxLength: 60,
      admin: { description: 'نام آیکن دسته در مجموعهٔ Phosphor.' },
    },
    proseTextarea('summary', 'خلاصه', {
      maxLength: 300,
      description: 'یک یا دو جمله دربارهٔ این دسته برای کارت و صفحهٔ دسته.',
    }),
    imageUpload(
      'heroMedia',
      'عکس بالای صفحه',
      'عکس واقعی بالای صفحهٔ دسته (۳:۲ در دسکتاپ، ۴:۵ در موبایل). نقطهٔ کانونی را در کتابخانهٔ رسانه تنظیم کنید.',
    ),
    proseTextarea('intro', 'متن راهنما', {
      maxLength: 1500,
      description:
        'چند بند کوتاه زیر فهرست خدمات: این دسته برای چه کسی است و از کجا شروع کند. بندها را با یک خط خالی جدا کنید.',
    }),
    faqsArray('پرسش‌های پرتکرار این دسته (۳ تا ۶ پرسش واقعی).'),
    orderField(),
    {
      name: 'services',
      type: 'join',
      label: 'خدمات',
      collection: 'services',
      on: 'category',
      defaultSort: 'order',
      admin: { description: 'خدمات این دسته.' },
    },
    seoGroup(),
  ],
};
