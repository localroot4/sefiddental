import type { CollectionConfig } from 'payload';
import { array } from 'payload/shared';

import { taxonomyAccess } from '@/access/presets';
import { hiddenForEditors, isStaffField } from '@/access/roles';
import { SERVICE_BLOCKS } from '@/blocks';
import {
  BOOKING_GROUP_OPTIONS,
  dayOnlyDate,
  faqsArray,
  imageUpload,
  keyField,
  orderField,
  proseText,
  proseTextarea,
  seoGroup,
  slugField,
  sourcesArray,
  tomanField,
  withRules,
} from '@/fields/factories';
import { sourcesRule } from '@/fields/validators';
import { contentHooks } from '@/hooks/compose';
import { sharedServiceSlug } from '@/hooks/slugNamespace';

/** spec-data 2.2. `seo.title` holds the title topic; the suffix comes from seo-defaults. */
export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'خدمت', plural: 'خدمات' },
  admin: {
    group: 'محتوا',
    useAsTitle: 'navLabel',
    defaultColumns: ['navLabel', 'category', 'slug', 'priority', '_status', 'updatedAt'],
    listSearchableFields: ['navLabel', 'h1', 'key', 'slug'],
    hidden: hiddenForEditors,
  },
  defaultSort: ['category', 'priority', 'order'],
  versions: { drafts: { schedulePublish: { timeFormat: 'HH:mm', timeIntervals: 15 } } },
  trash: true,
  ...taxonomyAccess({ scheduled: true }),
  hooks: contentHooks('services', {
    path: 'services',
    normalize: {
      prose: [
        'navLabel',
        'h1',
        'summary',
        'facts.sessions',
        'facts.duration',
        'facts.anesthesia',
        'facts.recovery',
        'faqs.*.question',
        'faqs.*.answer',
        // H9: body block prose (content, steps, callout) and the SEO texts.
        'body.*.body',
        'body.*.items.*.title',
        'body.*.items.*.text',
        'body.*.text',
        'seo.title',
        'seo.description',
      ],
      persianDigits: true,
    },
    beforeValidate: [sharedServiceSlug('service-categories')],
  }),
  fields: [
    keyField('شناسهٔ ثابت خدمت. در فرم نوبت (service_key) و آمار استفاده می‌شود و تغییر نمی‌کند.'),
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'service-categories',
      label: 'دسته',
      required: true,
      index: true,
      admin: {
        description: 'دستهٔ این خدمت. فقط در مسیر راهنما (بردکرامب) دیده می‌شود، نه در نشانی.',
      },
    },
    proseText('navLabel', 'نام در منو', {
      required: true,
      maxLength: 40,
      description: 'نام کوتاه در منو و کارت‌ها.',
    }),
    proseText('h1', 'تیتر اصلی', {
      required: true,
      maxLength: 90,
      description: 'تیتر اصلی صفحه. یک بار در صفحه می‌آید و اصطلاح اصلی جست‌وجو را دارد.',
    }),
    slugField({
      source: 'navLabel',
      description: 'بخش آخر نشانی، مثل «لمینت-سرامیکی». تغییر آن پس از انتشار، انتقال ۳۰۱ می‌سازد.',
    }),
    {
      name: 'bookingGroup',
      type: 'select',
      label: 'گروه فرم نوبت',
      required: true,
      index: true,
      options: BOOKING_GROUP_OPTIONS,
      admin: { description: 'گزینهٔ فرم نوبت که این خدمت زیر آن ثبت می‌شود.' },
    },
    {
      name: 'priority',
      type: 'number',
      label: 'اهمیت',
      required: true,
      index: true,
      min: 1,
      max: 3,
      admin: { description: 'اهمیت تجاری: ۱ مهم‌ترین. خدمات مهم‌تر در منو بالاتر می‌آیند.' },
    },
    orderField('ترتیب در فهرست دسته.'),
    {
      name: 'emergencyLink',
      type: 'checkbox',
      label: 'پیوند درد شدید',
      defaultValue: false,
      admin: { description: 'زیر تیتر صفحه، پیوند آرام «درد شدید دارید؟» نمایش داده شود.' },
    },
    proseTextarea('summary', 'خلاصه', {
      maxLength: 220,
      description: 'جملهٔ خلاصهٔ زیر تیتر و روی کارت‌ها.',
    }),
    imageUpload(
      'heroMedia',
      'عکس بالای صفحه',
      'عکس واقعی بالای صفحه (۳:۲ در دسکتاپ، ۴:۵ در موبایل). نقطهٔ کانونی را در کتابخانهٔ رسانه تنظیم کنید.',
    ),
    {
      name: 'facts',
      type: 'group',
      label: 'واقعیت‌های کوتاه',
      admin: {
        description: 'واقعیت‌های کوتاه ردیف بالای صفحه. فقط موارد پرشده نمایش داده می‌شوند.',
      },
      fields: [
        proseText('sessions', 'تعداد جلسه', {
          maxLength: 40,
          description: 'تعداد جلسه‌ها، مثلاً «۲ تا ۳ جلسه».',
        }),
        proseText('duration', 'مدت', { maxLength: 40, description: 'مدت هر جلسه یا کل درمان.' }),
        proseText('anesthesia', 'بی‌حسی', {
          maxLength: 40,
          description: 'نوع بی‌حسی، اگر لازم است.',
        }),
        proseText('recovery', 'بهبود', {
          maxLength: 60,
          description: 'زمان بهبود یا بازگشت به کار روزمره.',
        }),
      ],
    },
    tomanField(
      'priceFrom',
      'قیمت از',
      'قیمت «از …» به تومان، بدون جداکننده. خالی بماند، قیمتی نمایش داده نمی‌شود.',
    ),
    {
      name: 'body',
      type: 'blocks',
      label: 'متن اصلی',
      blocks: SERVICE_BLOCKS,
      admin: { description: 'متن اصلی صفحه: چیست، برای چه کسی مناسب است، مراحل درمان.' },
    },
    faqsArray('پرسش‌های پرتکرار این خدمت (۵ تا ۸ پرسش واقعی).'),
    {
      name: 'relatedServices',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      maxRows: 3,
      label: 'خدمات مرتبط',
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
      admin: { description: 'تا سه خدمت مرتبط برای انتهای صفحه.' },
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'doctors',
      label: 'بازبین پزشکی',
      admin: { description: 'دندانپزشکی که محتوای پزشکی این صفحه را بازبینی کرده است.' },
    },
    dayOnlyDate('reviewedAt', 'تاریخ بازبینی', 'تاریخ آخرین بازبینی پزشکی.'),
    {
      name: 'isMedical',
      type: 'checkbox',
      label: 'محتوای پزشکی',
      defaultValue: true,
      admin: { description: 'این صفحه ادعای پزشکی دارد و به منبع و بازبین نیاز دارد.' },
    },
    {
      ...sourcesArray(),
      // H25: a medical service publishes with sources; the reviewer waits for gap 42.
      validate: withRules(array, (value, { data }) => sourcesRule(data.isMedical, value)),
    },
    {
      name: 'searchTerms',
      type: 'text',
      hasMany: true,
      maxRows: 10,
      label: 'اصطلاح‌های جست‌وجو',
      admin: {
        description:
          'اصطلاح‌های جست‌وجویی که این صفحه مالک آن‌هاست (نقشهٔ کلمات کلیدی). فقط برای مرجع داخلی.',
      },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      label: 'یادداشت داخلی',
      access: { read: isStaffField },
      admin: { description: 'یادداشت داخلی، در سایت دیده نمی‌شود.' },
    },
    {
      name: 'scopeVerified',
      type: 'checkbox',
      label: 'دامنهٔ خدمت تأیید شده',
      defaultValue: true,
      admin: { description: 'دامنهٔ این خدمت با کلینیک تأیید شده است (ردیف ۲۷ کمبودها).' },
    },
    {
      name: 'performedBy',
      type: 'join',
      label: 'پزشکان',
      collection: 'doctors',
      on: 'services',
      admin: { description: 'پزشکانی که این خدمت را انجام می‌دهند.' },
    },
    {
      name: 'tiers',
      type: 'join',
      label: 'سطح‌ها',
      collection: 'service-tiers',
      on: 'service',
      defaultSort: 'order',
      admin: { description: 'سطح‌های این خدمت (فقط ترمیم دندان).' },
    },
    seoGroup({ topic: ['{h1}'] }),
  ],
};
