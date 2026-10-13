import type { CollectionSlug, Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getContentGaps } from '@/content-gaps/registry';
import { PAGE_KEYS } from '@/lib/paths';
import { runSeed } from '@/seed/run';

import { getTestPayload } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
const ROOT = process.cwd();

const CATEGORY_KEYS = [
  'cosmetic',
  'surgery-replacement',
  'restorative',
  'orthodontics',
  'pediatric',
];
const INSURERS = ['بیمه ایران', 'بیمه کارآفرین', 'بیمه پاسارگاد', 'بیمه البرز', 'بیمه ما'];

const docsWhere = async (collection: CollectionSlug, field: string, values: string[]) =>
  (
    await payload.find({
      collection,
      where: { [field]: { in: values } },
      depth: 0,
      pagination: false,
      trash: true,
    })
  ).docs as unknown as Record<string, unknown>[];

/** updatedAt of every seeded record, to prove a second run touches nothing. */
async function snapshot(): Promise<string> {
  const parts: unknown[] = [];
  for (const collection of [
    'service-categories',
    'services',
    'service-tiers',
    'insurances',
    'financing-options',
    'pages',
    'redirects',
  ] as CollectionSlug[]) {
    const docs = (
      await payload.find({ collection, depth: 0, pagination: false, sort: 'id', trash: true })
    ).docs;
    parts.push(docs.map((d) => [collection, d.id, (d as { updatedAt?: string }).updatedAt]));
  }
  for (const slug of ['clinic', 'seo-defaults', 'features', 'notifier'] as const) {
    parts.push([slug, (await payload.findGlobal({ slug, depth: 0 })).updatedAt]);
  }
  return JSON.stringify(parts);
}

describe('seeders (spec-data 8, acceptance of docs/prompts/03-foundation.md)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('SD1 dry-run writes nothing', async () => {
    const before = await payload.count({ collection: 'audit-log' });
    const report = await runSeed(payload, { mode: 'dry-run', root: ROOT });
    expect(report.mode).toBe('dry-run');
    expect((await payload.count({ collection: 'audit-log' })).totalDocs).toBe(before.totalDocs);
  });

  it(
    'SD2 categories, services, tiers, insurers, financing, the globals, every page key and /vip',
    { timeout: 120_000 },
    async () => {
      await runSeed(payload, { mode: 'create-only', root: ROOT });

      const categories = await docsWhere('service-categories', 'key', CATEGORY_KEYS);
      expect(categories).toHaveLength(5);
      expect(categories.every((c) => c._status === 'published')).toBe(true);
      const ortho = categories.find((c) => c.key === 'orthodontics');
      expect(ortho?.standaloneService).toBeTruthy();

      const services = (
        await payload.find({
          collection: 'services',
          where: { _status: { equals: 'published' } },
          depth: 0,
          pagination: false,
        })
      ).docs;
      const serviceKeys = new Set(services.map((s) => s.key));
      expect(serviceKeys.size).toBeGreaterThanOrEqual(18);
      const restoration = services.find((s) => s.key === 'restoration');
      expect(restoration).toMatchObject({
        slug: 'ترمیم-دندان',
        bookingGroup: 'restore',
        seo: { title: 'ترمیم دندان؛ معمولی، VIP و CIP' },
      });

      const tiers = await docsWhere('service-tiers', 'service', [String(restoration?.id)]);
      expect(tiers.map((t) => t.key).sort()).toEqual(['cip', 'standard', 'vip']);

      expect((await docsWhere('insurances', 'name', INSURERS)).map((i) => i.featured)).toEqual([
        true,
        true,
        true,
        true,
        true,
      ]);
      const financing = await docsWhere('financing-options', 'key', [
        'partner-loan',
        'dental-credit',
      ]);
      expect(financing).toHaveLength(2);
      expect(financing.every((f) => f.enabled === false && f.provider === null)).toBe(true);

      const clinic = await payload.findGlobal({ slug: 'clinic', depth: 0 });
      expect(clinic).toMatchObject({
        nameFa: 'کلینیک دندانپزشکی سفید',
        phones: { landline: '+982155101054', whatsappVerified: false },
        address: { postalCode: null },
        reception: { callbackMinutes: 10 },
      });
      expect(clinic.hours?.weekly?.[0]).toMatchObject({ open: '10:00', close: '20:00' });
      expect((await payload.findGlobal({ slug: 'seo-defaults', depth: 0 })).areaServed).toContain(
        'جنوب تهران',
      );
      expect((await payload.findGlobal({ slug: 'features', depth: 0 })).emergencyEnabled).toBe(
        true,
      );
      expect((await payload.findGlobal({ slug: 'notifier', depth: 0 })).errorDedupMinutes).toBe(60);

      const pages = await docsWhere('pages', 'key', PAGE_KEYS);
      expect(pages.map((p) => p.key).sort()).toEqual([...PAGE_KEYS].sort());
      expect(pages.find((p) => p.key === 'pricing')).toMatchObject({
        path: '/هزینه-و-پرداخت',
        _status: 'published',
      });
      expect(pages.find((p) => p.key === 'guide-aftercare')?._status).toBe('draft');

      const [vip] = await docsWhere('redirects', 'from', ['/vip']);
      expect(vip).toMatchObject({
        to: '/خدمات/ترمیم-دندان#سطح-ترمیم',
        statusCode: '301',
        source: 'alias',
        active: true,
      });

      const seedRows = await payload.find({
        collection: 'audit-log',
        where: { action: { equals: 'seed' } },
        depth: 0,
      });
      expect(seedRows.totalDocs).toBeGreaterThan(0);
    },
  );

  it('SD3 a second create-only run creates and updates nothing', { timeout: 120_000 }, async () => {
    const before = await snapshot();
    const report = await runSeed(payload, { mode: 'create-only', root: ROOT });
    expect(report.created).toEqual({});
    expect(report.updated).toEqual({});
    expect(await snapshot()).toBe(before);
  });

  it('SD4 the NEEDS_CLIENT values of the yaml are open gaps on the status view', async () => {
    const report = await getContentGaps(payload);
    const open = new Set(report.groups.flatMap((g) => g.items.map((i) => i.id)));
    for (const id of [
      'clinic.postalCode',
      'clinic.coordinates',
      'clinic.accessNotes',
      'clinic.instagram',
      'financing.provider',
      'clinic.legal',
      'seo.secondaryAreas',
      'clinic.whatsapp',
      'clinic.telegram',
      'clinic.stats',
      'services.scope',
      'insurers.logos',
    ]) {
      expect(open.has(id), id).toBe(true);
    }
    expect(report.groups[0]?.headingFa).toBe('منتظر اطلاعات کلینیک');
  });

  it('SD5 sync is refused in production', async () => {
    await expect(
      runSeed(payload, { mode: 'sync', root: ROOT, nodeEnv: 'production' }),
    ).rejects.toThrow(/refused/);
  });
});
