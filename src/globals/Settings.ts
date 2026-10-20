import type { GlobalConfig } from 'payload';
import { array, checkbox, text } from 'payload/shared';

import { hiddenForEditors, isAdmin } from '@/access/roles';
import { imageUpload, withRules } from '@/fields/factories';
import {
  DEFAULT_SHORT_TITLE_SUFFIX,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
} from '@/fields/validators';
import { globalHooks } from '@/hooks/compose';
import { ADMIN_MESSAGES as M } from '@/i18n/fa-admin';
import { setErrorAlertWindow } from '@/lib/log/requestError';
import { toLatinDigits } from '@/lib/persianText';
import { parseIranPhone } from '@/lib/phone';

import { needsEnv, notifierTest } from './notifierAdmin';

const adminOnly = { read: isAdmin, update: isAdmin, readVersions: isAdmin };
const settingsAdmin = { group: 'تنظیمات', hidden: hiddenForEditors };

/** spec-data 3.2. */
export const SeoDefaults: GlobalConfig = {
  slug: 'seo-defaults',
  label: 'تنظیمات سئو',
  admin: settingsAdmin,
  access: adminOnly,
  versions: { max: 50 },
  hooks: globalHooks('seo-defaults', {
    normalize: { prose: ['siteName', 'defaultDescription', 'areaServed', 'secondaryAreas'] },
  }),
  fields: [
    {
      name: 'siteName',
      type: 'text',
      label: 'نام سایت',
      required: true,
      defaultValue: 'کلینیک دندانپزشکی سفید',
      admin: { description: 'نام سایت در عنوان‌ها و داده‌های ساخت‌یافته.' },
    },
    {
      name: 'titleSuffix',
      type: 'text',
      label: 'پسوند عنوان',
      required: true,
      defaultValue: DEFAULT_TITLE_SUFFIX,
      admin: { description: 'پسوند عنوان صفحه‌ها.' },
    },
    {
      name: 'shortTitleSuffix',
      type: 'text',
      label: 'پسوند کوتاه',
      required: true,
      defaultValue: DEFAULT_SHORT_TITLE_SUFFIX,
      admin: { description: 'پسوند کوتاه برای صفحهٔ پزشکان.' },
    },
    {
      name: 'defaultDescription',
      type: 'textarea',
      label: 'توضیح پیش‌فرض',
      validate: withRules(text, (value) =>
        descriptionRule(typeof value === 'string' ? value : null, false),
      ),
      admin: { description: 'توضیح پیش‌فرض برای صفحه‌هایی که توضیح ندارند.' },
    },
    imageUpload('defaultOgImage', 'تصویر پیش‌فرض اشتراک‌گذاری', 'تصویر پیش‌فرض اشتراک‌گذاری.'),
    {
      name: 'areaServed',
      type: 'text',
      hasMany: true,
      label: 'مناطق خدمت',
      admin: { description: 'محله‌ها و مناطقی که کلینیک به آن‌ها خدمت می‌دهد.' },
    },
    {
      name: 'secondaryAreas',
      type: 'text',
      hasMany: true,
      label: 'مناطق فرعی',
      admin: { description: 'محله‌های فرعی (ردیف ۱۳ کمبودها).' },
    },
    {
      name: 'gscVerification',
      type: 'text',
      label: 'کد تأیید سرچ کنسول',
      validate: withRules(text, (value) =>
        value === null ||
        value === undefined ||
        value === '' ||
        /^[A-Za-z0-9_-]{10,100}$/.test(String(value))
          ? true
          : 'فقط خود کد را وارد کنید، بدون تگ متا.',
      ),
      admin: { description: 'کد تأیید سرچ کنسول (ردیف ۱۲).' },
    },
  ],
};

/** spec-data 3.3. Financing visibility lives on each financing option, not here. */
export const Features: GlobalConfig = {
  slug: 'features',
  label: 'قابلیت‌ها',
  admin: settingsAdmin,
  access: adminOnly,
  versions: { max: 50 },
  hooks: globalHooks('features'),
  fields: [
    {
      name: 'freeConsultation',
      type: 'checkbox',
      label: 'مشاورهٔ اول رایگان',
      defaultValue: true,
      admin: {
        description:
          'جملهٔ «مشاورهٔ اول رایگان است» و گزینهٔ «معاینه و مشاورهٔ رایگان» نمایش داده شود.',
      },
    },
    {
      name: 'emergencyEnabled',
      type: 'checkbox',
      label: 'درخواست فوری',
      defaultValue: true,
      admin: { description: 'مسیر درخواست فوری فعال است.' },
    },
    {
      name: 'introEnabled',
      type: 'checkbox',
      label: 'انیمیشن ورود',
      defaultValue: true,
      admin: { description: 'انیمیشن کوتاه ورود در صفحهٔ خانه.' },
    },
    {
      name: 'heroMarkRelief',
      type: 'checkbox',
      label: 'نقش برجستهٔ لوگو',
      defaultValue: true,
      admin: {
        description: 'نقش برجستهٔ لوگو روی عکس خانه. اگر روی جزء اصلی عکس افتاد، خاموش کنید.',
      },
    },
    {
      name: 'ga4Enabled',
      type: 'checkbox',
      label: 'گوگل آنالیتیکس',
      defaultValue: false,
      admin: { description: 'گوگل آنالیتیکس پس از بارگذاری صفحه فعال شود.' },
    },
    {
      name: 'ga4MeasurementId',
      type: 'text',
      label: 'شناسهٔ گوگل آنالیتیکس',
      validate: withRules(text, (value, { data }) => {
        if (value === null || value === undefined || value === '') {
          return data.ga4Enabled ? 'برای روشن کردن آنالیتیکس، شناسهٔ GA4 لازم است.' : true;
        }
        return /^G-[A-Z0-9]{4,}$/.test(String(value)) ? true : 'شناسهٔ GA4 به شکل G-XXXXXXX است.';
      }),
      admin: { description: 'شناسهٔ اندازه‌گیری GA4 (ردیف ۱۲).' },
    },
    {
      name: 'qualityTierOverride',
      type: 'select',
      label: 'سقف کیفیت گرافیک',
      required: true,
      defaultValue: 'auto',
      options: [
        { label: 'خودکار', value: 'auto' },
        { label: '۰', value: '0' },
        { label: '۱', value: '1' },
        { label: '۲', value: '2' },
        { label: '۳', value: '3' },
      ],
      admin: {
        description: 'سقف کیفیت گرافیک برای همهٔ بازدیدکنندگان. فقط برای عیب‌یابی تغییر دهید.',
      },
    },
  ],
};

/** Required when the channel's `enabled` switch (a sibling field) is on. */
const requiredWhenEnabled =
  (message: string) =>
  (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
    siblingData.enabled &&
    (value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0))
      ? message
      : true;

const notifierHooks = globalHooks('notifier');

/**
 * spec-data 3.4: switches and recipients only. SMTP passwords, bot tokens and SMS credentials
 * live in environment variables.
 */
export const Notifier: GlobalConfig = {
  slug: 'notifier',
  label: 'اعلان‌ها',
  admin: {
    ...settingsAdmin,
    components: {
      elements: {
        beforeDocumentControls: ['/admin/components/NotifierTestButton#NotifierTestButton'],
      },
    },
  },
  access: adminOnly,
  versions: { max: 50 },
  // POST /api/globals/notifier/test (admin-notify.md 9.8).
  endpoints: [notifierTest],
  hooks: {
    ...notifierHooks,
    // A save moves the error-alert window at once in this process (R5); other processes follow
    // at their next notification, which reads the global (src/lib/notify).
    afterChange: [
      ...(notifierHooks.afterChange ?? []),
      ({ doc }) => setErrorAlertWindow(doc.errorDedupMinutes),
    ],
  },
  fields: [
    {
      name: 'mail',
      type: 'group',
      label: 'ایمیل',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'فعال',
          defaultValue: false,
          validate: withRules(
            checkbox,
            needsEnv((env) => env.smtp !== null, M['admin.notifier.needsSmtp']),
          ),
          admin: { description: 'ارسال اعلان نوبت با ایمیل.' },
        },
        {
          name: 'recipients',
          type: 'array',
          label: 'گیرندگان',
          labels: { singular: 'گیرنده', plural: 'گیرندگان' },
          validate: withRules(array, requiredWhenEnabled('دست‌کم یک گیرنده لازم است.')),
          admin: { description: 'گیرندگان اعلان.' },
          fields: [{ name: 'email', type: 'email', label: 'ایمیل', required: true }],
        },
      ],
    },
    {
      name: 'telegram',
      type: 'group',
      label: 'تلگرام',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'فعال',
          defaultValue: false,
          validate: withRules(
            checkbox,
            needsEnv((env) => env.telegram !== null, M['admin.notifier.needsTelegram']),
          ),
          admin: { description: 'ارسال اعلان نوبت در تلگرام.' },
        },
        {
          name: 'chatId',
          type: 'text',
          label: 'شناسهٔ گفت‌وگو',
          validate: withRules(text, requiredWhenEnabled('شناسهٔ گفت‌وگوی تلگرام لازم است.')),
          admin: { description: 'شناسهٔ گفت‌وگوی تلگرام.' },
        },
      ],
    },
    {
      name: 'sms',
      type: 'group',
      label: 'پیامک',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'فعال',
          defaultValue: false,
          validate: withRules(
            checkbox,
            needsEnv((env) => env.farapayamak !== null, M['admin.notifier.needsSms']),
          ),
          admin: { description: 'ارسال اعلان نوبت با پیامک از طریق فراپیامک.' },
        },
        {
          name: 'senderNumber',
          type: 'text',
          label: 'شمارهٔ خط',
          hooks: {
            beforeValidate: [
              ({ value }) => (typeof value === 'string' ? toLatinDigits(value.trim()) : value),
            ],
          },
          validate: withRules(text, requiredWhenEnabled('شمارهٔ خط ارسال لازم است.'), (value) =>
            value === null ||
            value === undefined ||
            value === '' ||
            /^\d{4,20}$/.test(String(value))
              ? true
              : 'شمارهٔ خط فقط رقم است.',
          ),
          admin: { description: 'شمارهٔ خط ارسال.' },
        },
        {
          name: 'adminRecipients',
          type: 'array',
          label: 'گیرندگان مدیر',
          labels: { singular: 'گیرندهٔ مدیر', plural: 'گیرندگان مدیر' },
          admin: { description: 'موبایل‌هایی که اعلان نوبت می‌گیرند.' },
          fields: [
            {
              name: 'phone',
              type: 'text',
              label: 'موبایل',
              required: true,
              // As the clinic phones (Clinic.ts): any digits in, E.164 stored.
              hooks: {
                beforeValidate: [
                  ({ value }) => {
                    const parsed = parseIranPhone(value, { accept: 'mobile' });
                    return parsed.ok ? parsed.e164 : value;
                  },
                ],
              },
              validate: withRules(text, (value) =>
                /^\+989\d{9}$/.test(String(value ?? ''))
                  ? true
                  : 'شمارهٔ موبایل معتبر نیست؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.',
              ),
              admin: { style: { direction: 'ltr' } },
            },
          ],
        },
        {
          name: 'patientConfirmation',
          type: 'checkbox',
          label: 'پیامک تأیید بیمار',
          defaultValue: false,
          admin: { description: 'پیامک تأیید برای بیمار (حداکثر یکی در ۲۴ ساعت برای هر شماره).' },
        },
      ],
    },
    {
      name: 'errorDedupMinutes',
      type: 'number',
      label: 'بازهٔ تکرار خطا (دقیقه)',
      required: true,
      defaultValue: 60,
      min: 1,
      admin: { description: 'یک خطای تکراری در این بازه فقط یک بار اعلان می‌شود.' },
    },
  ],
};

/**
 * Freeze decision 18: the cron tick's last run for the status view. Admin read only, hidden, no
 * versions, not seeded, not audited, not revalidated; the tick writes it with the Local API and
 * `{ skipRevalidate: true, skipAudit: true }`.
 */
export const SystemState: GlobalConfig = {
  slug: 'system-state',
  label: 'وضعیت اجرا',
  admin: { group: 'سیستم', hidden: true },
  access: { read: isAdmin, update: () => false },
  fields: [
    { name: 'lastCronRunAt', type: 'date', label: 'آخرین اجرا' },
    { name: 'lastCronRanJobs', type: 'number', label: 'کارهای اجراشده' },
    { name: 'lastCronFailed', type: 'number', label: 'کارهای ناموفق' },
    { name: 'lastCronDurationMs', type: 'number', label: 'مدت (میلی‌ثانیه)' },
    { name: 'lastCronError', type: 'text', label: 'آخرین خطا', maxLength: 200 },
  ],
};
