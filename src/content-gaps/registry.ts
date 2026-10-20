import type { CollectionSlug, Payload, Where } from 'payload';

import { MARKER } from '@/fields/validators';
import { addDaysToKey, zonedDateKey } from '@/lib/jalali';
import { isGuideKey, PAGE_KEYS } from '@/lib/paths';

/**
 * Live content gaps for the System status view (spec-data 9.2, 9.3). No stored gap table:
 * filling a field in the admin closes its item on the next view. Items name the field path,
 * never the value.
 */

export type GapKind = 'needs_client' | 'needs_verification' | 'missing_content' | 'marker_in_text';

export interface GapTarget {
  type: 'global' | 'collection';
  slug: string;
  id?: string | number;
  field?: string;
}

export interface GapEntry {
  id: string;
  gapRow: number | null;
  kind: GapKind;
  labelFa: string;
  target: GapTarget;
  isOpen(payload: Payload): Promise<boolean>;
}

export const GAP_KIND_HEADINGS: Record<GapKind, string> = {
  needs_client: 'منتظر اطلاعات کلینیک',
  needs_verification: 'منتظر تأیید کلینیک',
  missing_content: 'محتوای ناقص',
  marker_in_text: 'علامت NEEDS_CLIENT در متن',
};

export const HOLIDAY_WARNING_DAYS = 60;

const KIND_ORDER: GapKind[] = [
  'needs_client',
  'needs_verification',
  'missing_content',
  'marker_in_text',
];

type Doc = Record<string, unknown>;

const empty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

function at(doc: Doc, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Doc | null | undefined)?.[key], doc);
}

const global = async (
  payload: Payload,
  slug: 'clinic' | 'seo-defaults' | 'features',
): Promise<Doc> => (await payload.findGlobal({ slug, depth: 0 })) as unknown as Doc;

const count = async (payload: Payload, collection: CollectionSlug, where: Where): Promise<number> =>
  (await payload.count({ collection, where })).totalDocs;

const published: Where = { _status: { equals: 'published' } };

/** A global field (or fields) that must be filled. */
function globalField(
  id: string,
  gapRow: number | null,
  kind: GapKind,
  labelFa: string,
  slug: 'clinic' | 'seo-defaults' | 'features',
  fields: string[],
): GapEntry {
  return {
    id,
    gapRow,
    kind,
    labelFa,
    target: { type: 'global', slug, field: fields[0] },
    isOpen: async (payload) => {
      const doc = await global(payload, slug);
      return fields.some((field) => empty(at(doc, field)));
    },
  };
}

/** A clinic checkbox that stays false until the clinic confirms. */
function clinicFlag(
  id: string,
  gapRow: number | null,
  kind: GapKind,
  labelFa: string,
  fields: string[],
): GapEntry {
  return {
    id,
    gapRow,
    kind,
    labelFa,
    target: { type: 'global', slug: 'clinic', field: fields[0] },
    isOpen: async (payload) => {
      const doc = await global(payload, 'clinic');
      return fields.some((field) => at(doc, field) !== true);
    },
  };
}

/** Open while no published document of the collection exists. */
function noneYet(
  id: string,
  gapRow: number,
  labelFa: string,
  collection: CollectionSlug,
): GapEntry {
  return {
    id,
    gapRow,
    kind: 'needs_client',
    labelFa,
    target: { type: 'collection', slug: collection },
    isOpen: async (payload) => (await count(payload, collection, published)) === 0,
  };
}

/** Open while any document matches `where`. */
function anyMatch(
  id: string,
  gapRow: number | null,
  kind: GapKind,
  labelFa: string,
  collection: CollectionSlug,
  where: Where,
): GapEntry {
  return {
    id,
    gapRow,
    kind,
    labelFa,
    target: { type: 'collection', slug: collection },
    isOpen: async (payload) => (await count(payload, collection, where)) > 0,
  };
}

/**
 * A client question no field answers (phase 6 rows 59, 61 to 63): the copy leaves the fact out.
 * Open until the answer is in the copy and this entry and its gaps.md row are closed.
 */
function clientQuestion(id: string, gapRow: number, labelFa: string, target: GapTarget): GapEntry {
  return { id, gapRow, kind: 'needs_client', labelFa, target, isOpen: async () => true };
}

const noValue = (field: string): Where => ({
  or: [{ [field]: { exists: false } }, { [field]: { equals: '' } }],
});

export const GAP_REGISTRY: readonly GapEntry[] = [
  globalField('clinic.postalCode', 37, 'needs_client', 'کد پستی کلینیک', 'clinic', [
    'address.postalCode',
  ]),
  globalField(
    'clinic.coordinates',
    38,
    'needs_client',
    'مختصات نقشهٔ کلینیک (عرض و طول جغرافیایی)',
    'clinic',
    ['address.lat', 'address.lng'],
  ),
  globalField(
    'clinic.accessNotes',
    13,
    'needs_client',
    'راهنمای دسترسی: پارکینگ، مترو، اتوبوس',
    'clinic',
    ['address.accessNotes'],
  ),
  globalField('clinic.instagram', 9, 'needs_client', 'نام کاربری اینستاگرام', 'clinic', [
    'social.instagram',
  ]),
  clinicFlag('clinic.whatsapp', 16, 'needs_verification', 'تأیید شمارهٔ واتساپ', [
    'phones.whatsappVerified',
  ]),
  clinicFlag('clinic.telegram', 16, 'needs_verification', 'تأیید شمارهٔ تلگرام', [
    'phones.telegramVerified',
  ]),
  clinicFlag('clinic.stats', 15, 'needs_verification', 'تأیید چهار عدد آمار کلینیک', [
    'stats.yearsActive.verified',
    'stats.specialistDentists.verified',
    'stats.specialtyClinics.verified',
    'stats.insurers.verified',
  ]),
  globalField('clinic.legal', 3, 'needs_client', 'شمارهٔ پروانه و نام مسئول فنی', 'clinic', [
    'legal.licenseNumber',
    'legal.technicalSupervisor',
  ]),
  clinicFlag(
    'clinic.tagline',
    28,
    'needs_verification',
    'تأیید شعار «اولین کلینیک دیجیتال جنوب تهران»',
    ['taglineApproved'],
  ),
  clinicFlag('clinic.priorityPromise', 19, 'needs_client', 'تأیید تماس زودتر با درخواست‌های فوری', [
    'emergency.priorityPromiseConfirmed',
  ]),
  globalField(
    'clinic.nearby24h',
    31,
    'needs_client',
    'مرکز دندانپزشکی شبانه‌روزی نزدیک',
    'clinic',
    ['emergency.nearby24hCenter'],
  ),
  {
    id: 'clinic.holidays',
    gapRow: 40,
    kind: 'missing_content',
    labelFa: `تعطیلات رسمی ${HOLIDAY_WARNING_DAYS} روز آینده وارد نشده است`,
    target: { type: 'global', slug: 'clinic', field: 'hours.holidays' },
    isOpen: async (payload) => {
      const doc = await global(payload, 'clinic');
      const today = zonedDateKey(new Date());
      const last = addDaysToKey(today, HOLIDAY_WARNING_DAYS);
      const rows = (at(doc, 'hours.holidays') ?? []) as { date?: string | null }[];
      return !rows.some(
        (row) => typeof row.date === 'string' && row.date >= today && row.date <= last,
      );
    },
  },
  anyMatch(
    'financing.provider',
    8,
    'needs_client',
    'نام شریک مالی و شرایط وام',
    'financing-options',
    {
      or: [{ provider: { exists: false } }, { provider: { equals: '' } }],
    },
  ),
  globalField('seo.secondaryAreas', 13, 'needs_client', 'محله‌های فرعی', 'seo-defaults', [
    'secondaryAreas',
  ]),
  {
    id: 'analytics.ids',
    gapRow: 12,
    kind: 'needs_client',
    labelFa: 'شناسهٔ GA4 و کد تأیید سرچ کنسول',
    target: { type: 'global', slug: 'features', field: 'ga4MeasurementId' },
    isOpen: async (payload) =>
      empty((await global(payload, 'features')).ga4MeasurementId) ||
      empty((await global(payload, 'seo-defaults')).gscVerification),
  },
  noneYet('doctors.none', 2, 'هیچ پزشکی منتشر نشده است', 'doctors'),
  {
    id: 'home.heroPhoto',
    gapRow: 36,
    kind: 'needs_client',
    labelFa: 'عکس بالای صفحهٔ خانه',
    target: { type: 'collection', slug: 'pages', field: 'hero.photo' },
    isOpen: async (payload) =>
      (await count(payload, 'pages', {
        and: [{ key: { equals: 'home' } }, { 'hero.photo': { exists: true } }],
      })) === 0,
  },
  noneYet('testimonials.none', 5, 'هیچ نظر بیماری منتشر نشده است', 'testimonials'),
  noneYet('cases.none', 6, 'هیچ نمونهٔ قبل و بعدی منتشر نشده است', 'cases'),
  {
    id: 'prices',
    gapRow: 14,
    kind: 'needs_client',
    labelFa: 'قیمت «از …» برای خدمات (اختیاری)',
    target: { type: 'collection', slug: 'services', field: 'priceFrom' },
    isOpen: async (payload) =>
      (await count(payload, 'services', { priceFrom: { exists: true } })) === 0 &&
      (await count(payload, 'service-tiers', { priceFrom: { exists: true } })) === 0,
  },
  anyMatch('services.scope', 27, 'needs_verification', 'تأیید دامنهٔ خدمات', 'services', {
    scopeVerified: { equals: false },
  }),
  anyMatch('insurers.logos', 39, 'needs_client', 'لوگوی بیمه‌های اصلی', 'insurances', {
    and: [{ featured: { equals: true } }, { logo: { exists: false } }],
  }),
  anyMatch(
    'services.copy',
    null,
    'missing_content',
    'متن خدمات (خلاصه یا متن اصلی خالی)',
    'services',
    {
      and: [published, { or: [{ summary: { exists: false } }, { summary: { equals: '' } }] }],
    },
  ),
  anyMatch('services.reviewer', 42, 'missing_content', 'بازبین پزشکی خدمات', 'services', {
    and: [published, { reviewedBy: { exists: false } }],
  }),
  anyMatch('guides.reviewer', 42, 'missing_content', 'بازبین پزشکی راهنماهای بیمار', 'pages', {
    and: [{ key: { in: PAGE_KEYS.filter(isGuideKey) } }, { reviewer: { exists: false } }],
  }),
  // C1: every article, medical or not, publishes only with a reviewer.
  anyMatch('articles.reviewer', 42, 'missing_content', 'بازبین پزشکی مقاله‌ها', 'articles', {
    reviewer: { exists: false },
  }),
  anyMatch('articles.cover', 58, 'needs_client', 'تصویر شاخص مقاله‌ها', 'articles', {
    cover: { exists: false },
  }),
  anyMatch(
    'articles.author',
    58,
    'needs_client',
    'نویسندهٔ مقاله‌ها: پزشک یا نام یکی از کارکنان',
    'articles',
    {
      and: [{ authorDoctor: { exists: false } }, noValue('staffAuthorName')],
    },
  ),
  clientQuestion(
    'guides.sedation',
    59,
    'آیا کلینیک برای بیماران مضطرب داروی آرام‌بخش یا گاز آرام‌بخش دارد؟',
    { type: 'collection', slug: 'pages' },
  ),
  anyMatch(
    'tiers.materials',
    60,
    'needs_client',
    'مواد روکش، لمینت، ایمپلنت و سطح‌های ترمیم و محل لابراتوار',
    'service-tiers',
    noValue('materials'),
  ),
  clientQuestion(
    'guides.firstVisitDocuments',
    61,
    'مدارکی که بیمار برای اولین مراجعه همراه می‌آورد',
    { type: 'collection', slug: 'pages' },
  ),
  clientQuestion('admin.authenticatorApp', 62, 'برنامهٔ رمز یک‌بارمصرف برای گوشی پذیرش', {
    type: 'collection',
    slug: 'users',
  }),
  clientQuestion(
    'articles.insurerLines',
    63,
    'بیمه‌های تکمیلی طرف کار کلینیک، درمان‌ها و مدارک لازم',
    { type: 'collection', slug: 'articles' },
  ),
  globalField(
    'seo.defaultDescription',
    41,
    'missing_content',
    'توضیح پیش‌فرض سئو',
    'seo-defaults',
    ['defaultDescription'],
  ),
];

/**
 * Which registry entry answers each `# NEEDS_CLIENT` and `# verify` comment of the yaml sources
 * (keys: `file:path`; a `*` segment matches any one segment). A test asserts every marker the
 * seeder finds is listed here. Facts the copy leaves out get a gaps row, not a marker (H26).
 */
export const YAML_MARKER_GAPS: Readonly<Record<string, string>> = {
  'docs/content/clinic.yaml:address.postal_code': 'clinic.postalCode',
  'docs/content/clinic.yaml:address.lat': 'clinic.coordinates',
  'docs/content/clinic.yaml:address.lng': 'clinic.coordinates',
  'docs/content/clinic.yaml:address.access_notes_fa': 'clinic.accessNotes',
  'docs/content/clinic.yaml:phones.whatsapp': 'clinic.whatsapp',
  'docs/content/clinic.yaml:phones.telegram': 'clinic.telegram',
  'docs/content/clinic.yaml:social.instagram': 'clinic.instagram',
  'docs/content/clinic.yaml:stats': 'clinic.stats',
  'docs/content/clinic.yaml:financing.0.provider': 'financing.provider',
  'docs/content/clinic.yaml:financing.1.provider': 'financing.provider',
  'docs/content/clinic.yaml:legal.license_number': 'clinic.legal',
  'docs/content/clinic.yaml:legal.technical_supervisor': 'clinic.legal',
  'docs/content/clinic.yaml:market.secondary_areas_fa': 'seo.secondaryAreas',
  'docs/content/services.yaml:services.*.reviewed_by': 'services.reviewer',
  'src/seed/data/pages.yaml:pages.*.reviewed_by': 'guides.reviewer',
  'src/seed/data/articles.yaml:articles.*.reviewed_by': 'articles.reviewer',
  'src/seed/data/articles.yaml:articles.*.cover': 'articles.cover',
  'src/seed/data/articles.yaml:articles.*.author': 'articles.author',
};

/** The registry id of a yaml marker, or undefined when no key of YAML_MARKER_GAPS matches. */
export function yamlMarkerGap(file: string, path: string): string | undefined {
  const parts = path.split('.');
  for (const [key, id] of Object.entries(YAML_MARKER_GAPS)) {
    const [keyFile, keyPath = ''] = key.split(':');
    const pattern = keyPath.split('.');
    if (
      keyFile === file &&
      pattern.length === parts.length &&
      pattern.every((segment, i) => segment === '*' || segment === parts[i])
    ) {
      return id;
    }
  }
  return undefined;
}

/** Prose fields scanned for inline `[[NEEDS_CLIENT: …]]` markers (drafts included). */
export const MARKER_FIELDS: Readonly<Partial<Record<CollectionSlug, readonly string[]>>> = {
  'service-categories': ['title', 'h1', 'navLabel', 'summary', 'intro'],
  services: [
    'navLabel',
    'h1',
    'summary',
    'facts.sessions',
    'facts.duration',
    'facts.anesthesia',
    'facts.recovery',
  ],
  'service-tiers': ['name', 'description', 'materials'],
  doctors: ['name', 'specialty', 'bio'],
  articles: ['title', 'excerpt'],
  pages: ['title', 'lead', 'hero.subtext'],
  testimonials: ['quote', 'transcriptSummary'],
  cases: ['title', 'notes'],
  insurances: ['name'],
  'financing-options': ['title', 'whoApplies', 'surchargeNote', 'terms'],
};

const GLOBAL_MARKER_FIELDS: Readonly<Record<'clinic' | 'seo-defaults', readonly string[]>> = {
  clinic: [
    'tagline',
    'footerLine',
    'contactHeadline',
    'address.fullFa',
    'address.accessNotes',
    'hours.note',
    'emergency.policy',
    'emergency.nearby24hCenter',
  ],
  'seo-defaults': ['defaultDescription'],
};

export interface OpenGapItem {
  id: string;
  gapRow: number | null;
  labelFa: string;
  adminUrl: string;
  fieldPath?: string;
}

export interface ContentGapsReport {
  generatedAt: string;
  total: number;
  groups: Array<{ kind: GapKind; headingFa: string; items: OpenGapItem[] }>;
}

export function adminUrlOf(target: GapTarget): string {
  if (target.type === 'global') return `/admin/globals/${target.slug}`;
  return target.id === undefined
    ? `/admin/collections/${target.slug}`
    : `/admin/collections/${target.slug}/${target.id}`;
}

async function markerItems(payload: Payload): Promise<OpenGapItem[]> {
  const items: OpenGapItem[] = [];
  for (const [collection, fields] of Object.entries(MARKER_FIELDS) as [
    CollectionSlug,
    string[],
  ][]) {
    const found = await payload.find({
      collection,
      where: { or: fields.map((field) => ({ [field]: { contains: '[[NEEDS_CLIENT' } })) },
      depth: 0,
      pagination: false,
      trash: true,
    });
    for (const doc of found.docs as unknown as Doc[]) {
      for (const field of fields) {
        const value = at(doc, field);
        if (typeof value === 'string' && MARKER.test(value)) {
          items.push({
            id: `marker:${collection}:${String(doc.id)}:${field}`,
            gapRow: null,
            labelFa: `علامت NEEDS_CLIENT در «${field}»`,
            adminUrl: adminUrlOf({ type: 'collection', slug: collection, id: doc.id as number }),
            fieldPath: field,
          });
        }
      }
    }
  }
  for (const [slug, fields] of Object.entries(GLOBAL_MARKER_FIELDS) as [
    'clinic' | 'seo-defaults',
    string[],
  ][]) {
    const doc = await global(payload, slug);
    for (const field of fields) {
      const value = at(doc, field);
      if (typeof value === 'string' && MARKER.test(value)) {
        items.push({
          id: `marker:${slug}:${field}`,
          gapRow: null,
          labelFa: `علامت NEEDS_CLIENT در «${field}»`,
          adminUrl: adminUrlOf({ type: 'global', slug }),
          fieldPath: field,
        });
      }
    }
  }
  return items;
}

/** Open gaps grouped in GapKind order; empty groups are left out. */
export async function getContentGaps(payload: Payload): Promise<ContentGapsReport> {
  const open = await Promise.all(
    GAP_REGISTRY.map(async (entry) => ((await entry.isOpen(payload)) ? entry : null)),
  );
  const byKind = new Map<GapKind, OpenGapItem[]>();
  for (const entry of open) {
    if (!entry) continue;
    const list = byKind.get(entry.kind) ?? [];
    list.push({
      id: entry.id,
      gapRow: entry.gapRow,
      labelFa: entry.labelFa,
      adminUrl: adminUrlOf(entry.target),
      ...(entry.target.field ? { fieldPath: entry.target.field } : {}),
    });
    byKind.set(entry.kind, list);
  }
  const markers = await markerItems(payload);
  if (markers.length > 0) byKind.set('marker_in_text', markers);
  const groups = KIND_ORDER.flatMap((kind) => {
    const items = byKind.get(kind);
    return items?.length ? [{ kind, headingFa: GAP_KIND_HEADINGS[kind], items }] : [];
  });
  return {
    generatedAt: new Date().toISOString(),
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups,
  };
}
