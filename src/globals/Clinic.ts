import type { ArrayField, Field, GlobalBeforeChangeHook, GlobalConfig, TextField } from 'payload';
import { array, text } from 'payload/shared';

import { hiddenForEditors, isAdmin } from '@/access/roles';
import { imageUpload, proseText, withRules } from '@/fields/factories';
import { globalHooks } from '@/hooks/compose';
import { clinicHoursSchema, type ClinicHours } from '@/lib/hoursState';
import { jalaliToDateKey } from '@/lib/jalali';
import { parseIranPhone } from '@/lib/phone';
import { toLatinDigits } from '@/lib/persianText';

type Row = Record<string, unknown>;

/** First Persian message of the hours schema (Lane U) for part of the hours value. */
function hoursIssue(part: Partial<ClinicHours>): true | string {
  const result = clinicHoursSchema.safeParse({
    timezone: 'Asia/Tehran',
    weekly: [],
    holidays: [],
    noteFa: '',
    ...part,
  });
  return result.success ? true : (result.error.issues[0]?.message ?? 'ساعت کاری نامعتبر است.');
}

const hhmm = (name: 'open' | 'close', label: string, required: boolean): TextField => ({
  name,
  type: 'text',
  label,
  required,
  admin: { width: '25%', placeholder: name === 'open' ? '10:00' : '20:00' },
  hooks: {
    beforeValidate: [
      ({ value }) => (typeof value === 'string' ? toLatinDigits(value.trim()) : value),
    ],
  },
  validate: withRules(text, (value) =>
    value === null ||
    value === undefined ||
    value === '' ||
    /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))
      ? true
      : 'ساعت را به شکل ۲۴ساعته بنویسید، مثل 10:00 یا 20:30.',
  ),
});

const WEEKDAYS = [
  { label: 'شنبه', value: 'sat' },
  { label: 'یکشنبه', value: 'sun' },
  { label: 'دوشنبه', value: 'mon' },
  { label: 'سه‌شنبه', value: 'tue' },
  { label: 'چهارشنبه', value: 'wed' },
  { label: 'پنجشنبه', value: 'thu' },
  { label: 'جمعه', value: 'fri' },
];

const weekly: ArrayField = {
  name: 'weekly',
  type: 'array',
  label: 'برنامهٔ هفتگی',
  labels: { singular: 'ردیف', plural: 'ردیف‌ها' },
  required: true,
  minRows: 1,
  maxRows: 7,
  validate: withRules(array, (value) =>
    Array.isArray(value)
      ? hoursIssue({
          weekly: (value as Row[]).map((row) => ({
            days: (row.days ?? []) as ClinicHours['weekly'][number]['days'],
            open: String(row.open ?? ''),
            close: String(row.close ?? ''),
          })),
        })
      : true,
  ),
  admin: { description: 'برنامهٔ هفتگی. هر روز فقط در یک ردیف.' },
  fields: [
    {
      name: 'days',
      type: 'select',
      hasMany: true,
      label: 'روزها',
      required: true,
      options: WEEKDAYS,
    },
    hhmm('open', 'شروع', true),
    hhmm('close', 'پایان', true),
  ],
};

const holidays: ArrayField = {
  name: 'holidays',
  type: 'array',
  label: 'تعطیلات و روزهای خاص',
  labels: { singular: 'روز', plural: 'روزها' },
  validate: withRules(array, (value) =>
    Array.isArray(value)
      ? hoursIssue({
          holidays: (value as Row[]).flatMap((row) => {
            const date = jalaliToDateKey(String(row.dateJalali ?? ''));
            if (!date) return [];
            return [
              {
                date,
                ...(row.open ? { open: String(row.open) } : {}),
                ...(row.close ? { close: String(row.close) } : {}),
              },
            ];
          }),
        })
      : true,
  ),
  admin: {
    description:
      'تعطیلات رسمی و روزهای با ساعت متفاوت. تعطیلات هر سال را از تقویم رسمی وارد کنید. بدون ساعت یعنی تعطیل.',
  },
  fields: [
    {
      name: 'dateJalali',
      type: 'text',
      label: 'تاریخ (شمسی)',
      required: true,
      admin: { placeholder: '۱۴۰۵/۰۱/۰۱', width: '25%' },
      validate: withRules(text, (value) =>
        typeof value === 'string' && jalaliToDateKey(value) !== null
          ? true
          : 'تاریخ شمسی را به شکل ۱۴۰۵/۰۱/۰۱ بنویسید.',
      ),
    },
    {
      name: 'date',
      type: 'text',
      label: 'تاریخ میلادی',
      admin: { readOnly: true, width: '25%', description: 'خودکار از تاریخ شمسی ساخته می‌شود.' },
    },
    { name: 'labelFa', type: 'text', label: 'عنوان', required: true, maxLength: 80 },
    hhmm('open', 'شروع (اگر باز است)', false),
    hhmm('close', 'پایان (اگر باز است)', false),
  ],
};

/** Gregorian DateKey of each holiday row from its Jalali text (freeze 3.6). */
export const holidayDates: GlobalBeforeChangeHook = ({ data }) => {
  const rows = (data?.hours as Row | undefined)?.holidays;
  if (!Array.isArray(rows)) return data;
  return {
    ...data,
    hours: {
      ...(data.hours as Row),
      holidays: (rows as Row[]).map((row) => ({
        ...row,
        date: jalaliToDateKey(String(row.dateJalali ?? '')),
      })),
    },
  };
};

/** A phone in any digit form becomes E.164; the validator then checks the kind. */
const phone = (
  name: string,
  label: string,
  description: string,
  mobileOnly: boolean,
  required = false,
): TextField => ({
  name,
  type: 'text',
  label,
  required,
  hooks: {
    beforeValidate: [
      ({ value }) => {
        if (typeof value !== 'string' || value.trim() === '') return value === '' ? null : value;
        const parsed = parseIranPhone(value, { accept: 'mobile-or-landline' });
        return parsed.ok ? parsed.e164 : value;
      },
    ],
  },
  validate: withRules(text, (value) => {
    if (value === null || value === undefined || value === '') return true;
    const pattern = mobileOnly ? /^\+989\d{9}$/ : /^\+98\d{10}$/;
    return pattern.test(String(value))
      ? true
      : mobileOnly
        ? 'شمارهٔ موبایل معتبر نیست؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.'
        : 'شماره معتبر نیست؛ تلفن ثابت با کد شهر یا موبایل.';
  }),
  admin: { description, style: { direction: 'ltr' } },
});

const MAP_HOSTS: Record<string, readonly string[]> = {
  googleMapsUrl: ['google.com', 'maps.app.goo.gl', 'goo.gl'],
  neshanUrl: ['neshan.org'],
  baladUrl: ['balad.ir'],
  wazeUrl: ['waze.com'],
};

const mapUrl = (name: string, label: string): TextField => ({
  name,
  type: 'text',
  label,
  validate: withRules(text, (value) => {
    if (value === null || value === undefined || value === '') return true;
    try {
      const url = new URL(String(value));
      const host = url.hostname.replace(/^www\./, '');
      const ok =
        url.protocol === 'https:' &&
        (MAP_HOSTS[name] ?? []).some((h) => host === h || host.endsWith(`.${h}`));
      return ok ? true : 'پیوند باید با https:// و از همان برنامهٔ نقشه باشد.';
    } catch {
      return 'پیوند باید با https:// و از همان برنامهٔ نقشه باشد.';
    }
  }),
  admin: { description: 'پیوند مسیریابی در هر برنامه.', style: { direction: 'ltr' } },
});

const handle = (name: string, label: string, description: string): TextField => ({
  name,
  type: 'text',
  label,
  hooks: {
    beforeValidate: [
      ({ value }) => (typeof value === 'string' ? value.trim().replace(/^@/, '') || null : value),
    ],
  },
  validate: withRules(text, (value) =>
    value === null || value === undefined || /^[A-Za-z0-9._]{1,30}$/.test(String(value))
      ? true
      : 'نام کاربری فقط حروف لاتین، رقم، نقطه و زیرخط دارد.',
  ),
  admin: { description, style: { direction: 'ltr' } },
});

const stat = (name: string, label: string): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    { name: 'value', type: 'number', label: 'عدد', min: 0 },
    { name: 'verified', type: 'checkbox', label: 'تأییدشده', defaultValue: false },
  ],
});

/** spec-data 3.1. The time zone is a code constant (Asia/Tehran), not data. */
export const Clinic: GlobalConfig = {
  slug: 'clinic',
  label: 'اطلاعات کلینیک',
  admin: { group: 'تنظیمات', hidden: hiddenForEditors },
  access: { read: isAdmin, update: isAdmin, readVersions: isAdmin },
  versions: { max: 50 },
  hooks: globalHooks('clinic', {
    normalize: {
      prose: [
        'nameFa',
        'nameShortFa',
        'tagline',
        'contactHeadline',
        'footerLine',
        'address.fullFa',
        'address.city',
        'address.district',
        'address.accessNotes',
        'hours.note',
        'hours.holidays.*.labelFa',
        'emergency.policy',
        'emergency.nearby24hCenter',
      ],
      names: ['legal.technicalSupervisor'],
    },
    beforeChange: [holidayDates],
  }),
  // Unnamed tabs group the form by task (H32); they add no level to the stored data.
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'هویت',
          fields: [
            {
              name: 'nameFa',
              type: 'text',
              label: 'نام کلینیک',
              required: true,
              admin: { description: 'نام رسمی کلینیک، همان تابلو.' },
            },
            {
              name: 'nameShortFa',
              type: 'text',
              label: 'نام کوتاه',
              admin: { description: 'نام کوتاه، مثل «کلینیک سفید».' },
            },
            {
              name: 'nameEn',
              type: 'text',
              label: 'نام لاتین',
              validate: withRules(text, (value) =>
                value === null || value === undefined || /^[\x20-\x7E]+$/.test(String(value))
                  ? true
                  : 'فقط حروف لاتین.',
              ),
              admin: {
                description: 'نام لاتین برای داده‌های ساخت‌یافته.',
                style: { direction: 'ltr' },
              },
            },
            {
              name: 'tagline',
              type: 'text',
              label: 'شعار',
              maxLength: 80,
              admin: {
                description: 'شعار کلینیک. ادعای «اولین» فقط با تصمیم کلینیک (ردیف ۲۸ کمبودها).',
              },
            },
            {
              name: 'taglineApproved',
              type: 'checkbox',
              label: 'شعار تأییدشده',
              defaultValue: false,
              admin: {
                description:
                  'کلینیک مدرک ادعای شعار را داده یا نگه‌داشتن آن را به‌عنوان شعار پذیرفته است (ردیف ۲۸).',
              },
            },
            {
              name: 'contactHeadline',
              type: 'text',
              label: 'تیتر تماس',
              maxLength: 60,
              admin: { description: 'تیتر صفحهٔ آدرس و ساعات.' },
            },
            proseText('footerLine', 'معرفی کوتاه پانویس', {
              maxLength: 120,
              description:
                'یک جملهٔ کوتاه زیر نام کلینیک در پانویس سایت، فقط با واقعیت‌های تأییدشده.',
            }),
            {
              name: 'domain',
              type: 'text',
              label: 'دامنه',
              required: true,
              validate: withRules(text, (value) =>
                /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(String(value ?? ''))
                  ? true
                  : 'فقط نام دامنه، بدون https و /.',
              ),
              admin: { description: 'دامنهٔ سایت، بدون https.', style: { direction: 'ltr' } },
            },
          ],
        },
        {
          label: 'تماس و نشانی',
          fields: [
            {
              name: 'address',
              type: 'group',
              label: 'نشانی',
              fields: [
                {
                  name: 'fullFa',
                  type: 'textarea',
                  label: 'نشانی کامل',
                  required: true,
                  maxLength: 200,
                  admin: { description: 'نشانی کامل همان‌طور که روی نقشه‌ها ثبت است.' },
                },
                {
                  name: 'city',
                  type: 'text',
                  label: 'شهر',
                  required: true,
                  admin: { description: 'شهر.' },
                },
                { name: 'district', type: 'text', label: 'محله', admin: { description: 'محله.' } },
                {
                  name: 'postalCode',
                  type: 'text',
                  label: 'کد پستی',
                  hooks: {
                    beforeValidate: [
                      ({ value }) =>
                        typeof value === 'string'
                          ? toLatinDigits(value).replace(/[\s-]/g, '') || null
                          : value,
                    ],
                  },
                  validate: withRules(text, (value) =>
                    value === null || value === undefined || /^\d{10}$/.test(String(value))
                      ? true
                      : 'کد پستی ده رقم است.',
                  ),
                  admin: { description: 'کد پستی ده‌رقمی.' },
                },
                {
                  name: 'lat',
                  type: 'number',
                  label: 'عرض جغرافیایی',
                  min: -90,
                  max: 90,
                  admin: { description: 'عرض جغرافیایی از نشان یا بلد.' },
                },
                {
                  name: 'lng',
                  type: 'number',
                  label: 'طول جغرافیایی',
                  min: -180,
                  max: 180,
                  admin: { description: 'طول جغرافیایی از نشان یا بلد.' },
                },
                {
                  name: 'accessNotes',
                  type: 'textarea',
                  label: 'دسترسی',
                  maxLength: 500,
                  admin: { description: 'پارکینگ، مترو، اتوبوس.' },
                },
              ],
            },
            {
              name: 'phones',
              type: 'group',
              label: 'تلفن‌ها',
              fields: [
                phone(
                  'landline',
                  'تلفن ثابت',
                  'تلفن ثابت؛ با رقم فارسی یا انگلیسی وارد کنید، به شکل بین‌المللی ذخیره می‌شود.',
                  false,
                  true,
                ),
                phone('mobile', 'موبایل', 'موبایل کلینیک.', true),
                phone('whatsapp', 'واتساپ', 'شمارهٔ واتساپ.', true),
                {
                  name: 'whatsappVerified',
                  type: 'checkbox',
                  label: 'واتساپ تأییدشده',
                  defaultValue: false,
                  admin: {
                    description: 'این شماره واتساپ دارد و پاسخ داده می‌شود (ردیف ۱۶ کمبودها).',
                  },
                },
                phone('telegram', 'تلگرام', 'شمارهٔ تلگرام.', true),
                {
                  name: 'telegramVerified',
                  type: 'checkbox',
                  label: 'تلگرام تأییدشده',
                  defaultValue: false,
                  admin: { description: 'شمارهٔ تلگرام تأیید شده است.' },
                },
              ],
            },
            {
              name: 'reception',
              type: 'group',
              label: 'پذیرش',
              fields: [
                {
                  name: 'callbackMinutes',
                  type: 'number',
                  label: 'زمان تماس (دقیقه)',
                  required: true,
                  defaultValue: 10,
                  min: 1,
                  max: 120,
                  admin: { description: 'پذیرش معمولاً تا چند دقیقه پس از ثبت تماس می‌گیرد.' },
                },
                phone(
                  'callerNumber',
                  'شمارهٔ تماس‌گیرنده',
                  'شماره‌ای که پذیرش از آن تماس می‌گیرد. خالی بماند، این خط در پیام موفقیت پنهان است.',
                  false,
                ),
              ],
            },
            {
              name: 'social',
              type: 'group',
              label: 'شبکه‌های اجتماعی',
              fields: [
                handle('instagram', 'اینستاگرام', 'نام کاربری اینستاگرام بدون @.'),
                handle('telegramChannel', 'کانال تلگرام', 'کانال تلگرام، اگر هست.'),
                handle('aparat', 'آپارات', 'کانال آپارات، اگر هست.'),
              ],
            },
            {
              name: 'maps',
              type: 'group',
              label: 'نقشه',
              fields: [
                mapUrl('googleMapsUrl', 'گوگل‌مپ'),
                mapUrl('neshanUrl', 'نشان'),
                mapUrl('baladUrl', 'بلد'),
                mapUrl('wazeUrl', 'ویز'),
                imageUpload('staticMap', 'تصویر نقشه', 'تصویر ثابت نقشه (بدون نقشهٔ گوگل).'),
              ],
            },
          ],
        },
        {
          label: 'ساعات و تعطیلات',
          fields: [
            {
              name: 'hours',
              type: 'group',
              label: 'ساعات کاری',
              fields: [
                {
                  name: 'note',
                  type: 'text',
                  label: 'توضیح',
                  maxLength: 80,
                  admin: {
                    description: 'توضیح کوتاه ساعات، مثل «هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی».',
                  },
                },
                weekly,
                holidays,
              ],
            },
          ],
        },
        {
          label: 'اورژانس',
          fields: [
            {
              name: 'emergency',
              type: 'group',
              label: 'اورژانس',
              fields: [
                {
                  name: 'policy',
                  type: 'textarea',
                  label: 'سیاست نوبت فوری',
                  maxLength: 300,
                  admin: { description: 'سیاست نوبت فوری، بدون وعدهٔ نوبت قطعی.' },
                },
                {
                  name: 'nearby24hCenter',
                  type: 'textarea',
                  label: 'مرکز شبانه‌روزی نزدیک',
                  maxLength: 300,
                  admin: { description: 'مرکز شبانه‌روزی نزدیک برای ساعات تعطیل (ردیف ۳۱).' },
                },
                {
                  name: 'priorityPromiseConfirmed',
                  type: 'checkbox',
                  label: 'تماس زودتر تأییدشده',
                  defaultValue: false,
                  admin: {
                    description:
                      'کلینیک تأیید کرده درخواست‌های فوری در ساعت شروع کار زودتر تماس گرفته می‌شوند (ردیف ۱۹).',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'قانونی و آمار',
          fields: [
            {
              name: 'legal',
              type: 'group',
              label: 'اطلاعات قانونی',
              fields: [
                {
                  name: 'licenseNumber',
                  type: 'text',
                  label: 'شمارهٔ پروانه',
                  admin: { description: 'شمارهٔ پروانهٔ کلینیک برای پانویس.' },
                },
                {
                  name: 'technicalSupervisor',
                  type: 'text',
                  label: 'مسئول فنی',
                  admin: { description: 'نام مسئول فنی برای پانویس.' },
                },
              ],
            },
            {
              name: 'stats',
              type: 'group',
              label: 'آمار',
              admin: {
                description:
                  'عدد فقط وقتی در سایت نمایش داده می‌شود که «تأییدشده» تیک بخورد (ردیف ۱۵ کمبودها).',
              },
              fields: [
                stat('yearsActive', 'سال‌های فعالیت'),
                stat('specialistDentists', 'دندانپزشکان متخصص'),
                stat('specialtyClinics', 'بخش‌های تخصصی'),
                stat('insurers', 'بیمه‌ها'),
              ],
            },
          ],
        },
      ],
    },
  ],
};
