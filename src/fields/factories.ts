import type {
  ArrayField,
  CheckboxField,
  DateField,
  FieldHook,
  GroupField,
  NumberField,
  PayloadRequest,
  TextareaField,
  TextField,
  UploadField,
  Validate,
} from 'payload';
import { text, textarea } from 'payload/shared';

import { isAdminField } from '@/access/roles';
import { persianSlug } from '@/lib/persianSlug';

import {
  DEFAULT_SHORT_TITLE_SUFFIX,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
  proseRule,
  type Rule,
  slugRule,
  titleRule,
} from './validators';

/** Field factories shared by the collections (spec-data 5.4). */

type Data = Record<string, unknown>;

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Stable system key: written once (seeder or create), never changed (field update access). */
export function keyField(description: string): TextField {
  return {
    name: 'key',
    type: 'text',
    label: 'شناسه',
    required: true,
    unique: true,
    index: true,
    validate: (value: unknown) =>
      typeof value === 'string' && KEY_PATTERN.test(value)
        ? true
        : 'شناسه فقط حروف کوچک لاتین، رقم و خط تیره دارد؛ مثل ceramic-laminate.',
    access: { update: () => false },
    admin: { position: 'sidebar', description },
  };
}

export function orderField(
  description = 'ترتیب نمایش؛ عدد کوچک‌تر زودتر نمایش داده می‌شود.',
): NumberField {
  return {
    name: 'order',
    type: 'number',
    label: 'ترتیب',
    min: 0,
    defaultValue: 100,
    index: true,
    validate: integerRule,
    admin: { position: 'sidebar', description },
  };
}

function integerRule(value: unknown): true | string {
  if (value === null || value === undefined) return true;
  return Number.isInteger(value) && (value as number) >= 0
    ? true
    : 'یک عدد صحیح و نامنفی وارد کنید.';
}

export function tomanField(
  name: string,
  label: string,
  description = 'به تومان، بدون جداکننده. خالی بماند، در سایت نمایش داده نمی‌شود.',
): NumberField {
  return { name, type: 'number', label, min: 0, validate: integerRule, admin: { description } };
}

/** A calendar day in Tehran (stored at 12:00 Tehran time, so the day never shifts). */
export function dayOnlyDate(name: string, label: string, description?: string): DateField {
  return {
    name,
    type: 'date',
    label,
    timezone: true,
    admin: { date: { pickerAppearance: 'dayOnly' }, description },
  };
}

export interface RuleOptions {
  data: Data;
  siblingData: Data;
  req: PayloadRequest;
  event?: string;
}
type FieldRule = (value: unknown, options: RuleOptions) => Rule | Promise<Rule>;

/**
 * Payload replaces its default validator when a field sets `validate`, so this runs the default
 * first (required, lengths, relations, rich text) and then the extra rules in order.
 */
export function withRules(base: unknown, ...rules: FieldRule[]): Validate {
  const run = base as (value: unknown, options: unknown) => Rule | Promise<Rule>;
  return (async (value: unknown, options: RuleOptions) => {
    const first = await run(value, options);
    if (first !== true) return first;
    for (const rule of rules) {
      const result = await rule(value, options);
      if (result !== true) return result;
    }
    return true;
  }) as unknown as Validate;
}

const prose: FieldRule = (value) => proseRule(value);

/** Text with the marker and banned-word checks after Payload's own checks (V-MARKER, V-BANNED). */
export function proseText(
  name: string,
  label: string,
  options: Partial<Pick<TextField, 'required' | 'maxLength' | 'minLength' | 'index'>> & {
    hasMany?: boolean;
    maxRows?: number;
    description?: string;
  } = {},
): TextField {
  const { description, ...rest } = options;
  return {
    name,
    type: 'text',
    label,
    ...rest,
    validate: withRules(text, prose),
    admin: { description },
  } as TextField;
}

export function proseTextarea(
  name: string,
  label: string,
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    description?: string;
  } = {},
): TextareaField {
  const { description, ...rest } = options;
  return {
    name,
    type: 'textarea',
    label,
    ...rest,
    validate: withRules(textarea, prose),
    admin: { description },
  };
}

interface SlugOptions {
  /** The field the slug is built from when left empty, or a builder. */
  source: string | ((data: Data) => string | undefined);
  max?: number;
  /** An empty slug is allowed (and kept empty) when this holds, e.g. standalone categories. */
  nullableWhen?: (data: Data) => boolean;
  unique?: boolean;
  description?: string;
  access?: TextField['access'];
}

/**
 * H-SLUG: `persianSlug(value || source)` before validation; V-SLUG as the validator. On a
 * partial update Payload passes the stored slug as the value, which persianSlug keeps (it is
 * idempotent), so a publish never rewrites a slug from its title.
 */
export function slugField(options: SlugOptions): TextField {
  const max = options.max ?? 80;
  const sourceOf = (data: Data | undefined): string | undefined => {
    if (!data) return undefined;
    if (typeof options.source === 'function') return options.source(data);
    const value = data[options.source];
    return typeof value === 'string' ? value : undefined;
  };
  const fill: FieldHook = ({ value, siblingData, originalDoc }) => {
    const own = typeof value === 'string' ? value.trim() : '';
    if (own) return persianSlug(own);
    const merged = { ...(originalDoc as Data | undefined), ...(siblingData as Data) };
    if (options.nullableWhen?.(merged)) return null;
    const source = sourceOf(siblingData as Data) ?? sourceOf(originalDoc as Data | undefined);
    const built = source ? persianSlug(source) : '';
    return built || null;
  };
  return {
    name: 'slug',
    type: 'text',
    label: 'نشانی',
    required: !options.nullableWhen,
    unique: options.unique ?? true,
    index: true,
    hooks: {
      beforeValidate: [fill],
      beforeDuplicate: [
        ({ value }) => (typeof value === 'string' && value ? `${value}-کپی` : value),
      ],
    },
    validate: ((value: unknown, { data }: { data: Data }) => {
      if (!value && options.nullableWhen?.(data)) return true;
      return slugRule(typeof value === 'string' ? value : null, max);
    }) as Validate,
    access: options.access,
    admin: {
      position: 'sidebar',
      description:
        options.description ??
        'بخش آخر نشانی. خالی بگذارید تا از عنوان ساخته شود. تغییر آن پس از انتشار، انتقال ۳۰۱ از نشانی قبلی می‌سازد.',
    },
  };
}

const PUBLISHERS = [
  { label: 'ADA', value: 'ADA' },
  { label: 'AAPD', value: 'AAPD' },
  { label: 'AAP', value: 'AAP' },
  { label: 'Cochrane', value: 'Cochrane' },
  { label: 'NHS', value: 'NHS' },
  { label: 'IADT', value: 'IADT' },
  { label: 'مجلهٔ داوری‌شده', value: 'journal' },
  { label: 'سایر', value: 'other' },
];

export function sourcesArray(description = 'منابع علمی ادعاهای پزشکی این صفحه.'): ArrayField {
  return {
    name: 'sources',
    type: 'array',
    label: 'منابع',
    labels: { singular: 'منبع', plural: 'منابع' },
    maxRows: 20,
    admin: { description },
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'عنوان منبع',
        required: true,
        maxLength: 200,
        admin: { description: 'عنوان منبع' },
      },
      { name: 'publisher', type: 'select', label: 'ناشر', options: PUBLISHERS },
      {
        name: 'url',
        type: 'text',
        label: 'نشانی منبع',
        required: true,
        validate: (value: unknown) =>
          typeof value === 'string' && /^https:\/\/[^\s/]+\.[^\s]+$/.test(value)
            ? true
            : 'نشانی منبع باید با https:// شروع شود.',
        admin: { description: 'نشانی منبع' },
      },
      dayOnlyDate('accessedOn', 'تاریخ مراجعه'),
    ],
  };
}

export function faqsArray(description = 'پرسش‌های پرتکرار.'): ArrayField {
  return {
    name: 'faqs',
    type: 'array',
    label: 'پرسش‌ها',
    labels: { singular: 'پرسش', plural: 'پرسش‌ها' },
    maxRows: 8,
    admin: { description },
    fields: [
      proseText('question', 'پرسش', {
        required: true,
        maxLength: 160,
        description: 'پرسش، همان‌طور که بیمار می‌پرسد.',
      }),
      proseTextarea('answer', 'پاسخ', {
        required: true,
        maxLength: 1200,
        description: 'پاسخ کوتاه و دقیق، بدون وعده.',
      }),
    ],
  };
}

export const imageOnly = { mimeType: { contains: 'image' } } as const;

export function imageUpload(
  name: string,
  label: string,
  description?: string,
  required = false,
): UploadField {
  return {
    name,
    type: 'upload',
    relationTo: 'media',
    label,
    required,
    filterOptions: imageOnly,
    admin: { description },
  };
}

type SuffixKey = 'titleSuffix' | 'shortTitleSuffix';

async function titleSuffix(req: PayloadRequest, key: SuffixKey): Promise<string> {
  const fallback = key === 'titleSuffix' ? DEFAULT_TITLE_SUFFIX : DEFAULT_SHORT_TITLE_SUFFIX;
  try {
    const seo = await req.payload.findGlobal({ slug: 'seo-defaults', depth: 0, req });
    return (seo as Partial<Record<SuffixKey, string | null>>)[key] || fallback;
  } catch {
    return fallback;
  }
}

/** The SEO group of every public document (spec-data 5.2). */
export function seoGroup(
  options: { suffix?: SuffixKey; descriptionRequired?: boolean } = {},
): GroupField {
  const suffix = options.suffix ?? 'titleSuffix';
  const noindex: CheckboxField = {
    name: 'noindex',
    type: 'checkbox',
    label: 'نمایه نشود',
    defaultValue: false,
    access: { update: isAdminField },
    admin: { description: 'این صفحه در گوگل نمایه نشود.' },
  };
  return {
    name: 'seo',
    type: 'group',
    label: 'سئو',
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'عنوان سئو',
        validate: (async (
          value: unknown,
          { req, event }: { req: PayloadRequest; event?: string },
        ) => {
          if (typeof value !== 'string' || value === '') return true;
          // The two default suffixes have the same length as the live ones; read them on submit.
          const used =
            event === 'submit'
              ? await titleSuffix(req, suffix)
              : suffix === 'titleSuffix'
                ? DEFAULT_TITLE_SUFFIX
                : DEFAULT_SHORT_TITLE_SUFFIX;
          const title = titleRule(value, used);
          return title === true ? proseRule(value) : title;
        }) as Validate,
        admin: {
          description:
            'عنوان در نتیجهٔ گوگل، بدون پسوند «| کلینیک دندانپزشکی سفید». خالی بماند، تیتر صفحه استفاده می‌شود. با پسوند حداکثر ۶۰ نویسه.',
        },
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'توضیح سئو',
        required: Boolean(options.descriptionRequired),
        validate: ((value: unknown) => {
          const result = descriptionRule(
            typeof value === 'string' ? value : null,
            Boolean(options.descriptionRequired),
          );
          return result === true ? proseRule(value) : result;
        }) as Validate,
        admin: {
          description:
            'توضیح زیر عنوان در گوگل: ۱۲۰ تا ۱۶۰ نویسه، با دلیلی برای کلیک و نام محله اگر به کار می‌آید.',
        },
      },
      imageUpload(
        'image',
        'تصویر اشتراک‌گذاری',
        'تصویر اشتراک‌گذاری. خالی بماند، تصویر صفحه یا تصویر پیش‌فرض استفاده می‌شود.',
      ),
      noindex,
    ],
  };
}

/** Booking chips (docs/conversion.md 5.1), shared by services and bookings. */
export const BOOKING_GROUP_OPTIONS = [
  { label: 'معاینه', value: 'exam' },
  { label: 'زیبایی', value: 'cosmetic' },
  { label: 'ایمپلنت', value: 'implant' },
  { label: 'ترمیم و روکش', value: 'restore' },
  { label: 'عصب‌کشی', value: 'root_canal' },
  { label: 'ارتودنسی', value: 'ortho' },
  { label: 'کودکان', value: 'kids' },
  { label: 'سایر', value: 'other' },
];
