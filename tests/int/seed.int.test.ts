import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { CollectionSlug, Payload, Where } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseDocument, type YAMLMap, type YAMLSeq } from 'yaml';

import { getContentGaps } from '@/content-gaps/registry';
import { PAGE_KEYS } from '@/lib/paths';
import { runSeed, SEED_FILES } from '@/seed/run';
import { SeedDataError } from '@/seed/transforms';

import { getTestPayload, unique } from './helpers';

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
      'guides.reviewer',
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

/**
 * Phase 6 (H29, H43, C8, C32): a seed root that is the repository with a test articles.yaml, so
 * the articles, their links and the fill mode are tested before the copy lane writes the file.
 */
const FIXTURE_ARTICLES = `
categories:
  - slug: آزمون-بذر-دسته
    title: دستهٔ آزمون بذر
tags:
  - slug: آزمون-بذر-برچسب
    title: برچسب آزمون بذر
articles:
  - slug: آزمون-بذر-یک
    title: مقالهٔ اول آزمون بذر
    seo_title: مقالهٔ اول آزمون بذر
    seo_description: توضیح آزمون
    excerpt: خلاصهٔ مقالهٔ اول
    category: آزمون-بذر-دسته
    tags: [آزمون-بذر-برچسب]
    primary_service: restoration
    is_medical: true
    reviewed_by: null  # NEEDS_CLIENT: reviewer dentist (gap 42)
    body:
      - type: content
        text: |-
          ## بخش یک
          پیش از [ترمیم دندان](/خدمات/ترمیم-دندان) بخوانید.

          ## بخش دو
          - [اولین مراجعه](/راهنمای-بیمار/اولین-مراجعه)
          - [مقالهٔ دوم](/مقالات/آزمون-بذر-دو)
      - type: callout
        tone: warning
        text: نکتهٔ آزمون
      - type: table
        caption: جدول آزمون
        head: [الف, ب]
        rows:
          - [یک, دو]
    sources:
      - title: Tooth decay
        publisher: NHS
        url: https://www.nhs.uk/conditions/tooth-decay/
        accessed_on: 2026-10-18
  - slug: آزمون-بذر-دو
    title: مقالهٔ دوم آزمون بذر
    seo_title: مقالهٔ دوم آزمون بذر
    seo_description: توضیح آزمون دوم
    excerpt: خلاصهٔ مقالهٔ دوم
    category: آزمون-بذر-دسته
    primary_service: null
    is_medical: false
    body:
      - type: content
        text: بازگشت به [مقالهٔ اول](/مقالات/آزمون-بذر-یک).
`;

const ARTICLE_SLUGS = ['آزمون-بذر-یک', 'آزمون-بذر-دو'];

/** One opened source for a service the yaml has none for yet (H25 before COPY-SERVICES). */
const TEST_SOURCE = {
  title: 'Tooth decay',
  publisher: 'NHS',
  url: 'https://www.nhs.uk/conditions/tooth-decay/',
  accessed_on: '2026-10-18',
};

const roots: string[] = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/**
 * A seed root: the repository's sources and media linked, so natural keys match the SD2 run; its
 * services.yaml with a source on every service and `edit` applied; the test articles.yaml.
 */
function seedRoot(
  edit: (services: YAMLSeq<YAMLMap>) => void = () => {},
  articles = FIXTURE_ARTICLES,
): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sefid-seed-root-'));
  roots.push(root);
  for (const dir of ['docs/content', 'src/seed/data'])
    mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ['content', SEED_FILES.clinic, SEED_FILES.pages])
    symlinkSync(path.join(ROOT, file), path.join(root, file));
  const doc = parseDocument(readFileSync(path.join(ROOT, SEED_FILES.services), 'utf8'));
  const services = doc.get('services') as YAMLSeq<YAMLMap>;
  for (const service of services.items)
    if (!service.has('sources')) service.set('sources', doc.createNode([TEST_SOURCE]));
  edit(services);
  writeFileSync(path.join(root, SEED_FILES.services), doc.toString({ lineWidth: 0 }));
  writeFileSync(path.join(root, SEED_FILES.articles), articles);
  return root;
}

const fixtureRoot = seedRoot();
const serviceByKey = (services: YAMLSeq<YAMLMap>, key: string): YAMLMap => {
  const found = services.items.find((service) => service.get('key') === key);
  if (!found) throw new Error(`seed.int.test: services.yaml has no service "${key}"`);
  return found;
};

type Doc = Record<string, unknown>;

const latest = async (collection: CollectionSlug, where: Where): Promise<Doc> =>
  (await payload.find({ collection, where, depth: 0, limit: 1, draft: true }))
    .docs[0] as unknown as Doc;

/** Every node of a Lexical tree of the given type. */
function nodesOf(tree: unknown, type: string): Doc[] {
  const out: Doc[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Doc;
    if (n.type === type) out.push(n);
    if (n.root) visit(n.root);
    if (Array.isArray(n.children)) n.children.forEach(visit);
  };
  visit(tree);
  return out;
}

describe('phase 6 seeding: articles, links, fill and sync (H29, H43, C8, C32)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it(
    'SD6 articles seed as drafts with categories, tags, blocks and resolved internal links',
    { timeout: 120_000 },
    async () => {
      // Services and pages are created here too when SD2 did not run (a filtered run).
      const report = await runSeed(payload, { mode: 'create-only', root: fixtureRoot });
      expect(report.created).toMatchObject({ 'article-categories': 1, tags: 1, articles: 2 });
      expect(report.markers.map((m) => `${m.file}:${m.path}`)).toContain(
        'src/seed/data/articles.yaml:articles.0.reviewed_by',
      );

      const [one, two] = await Promise.all(
        ARTICLE_SLUGS.map((slug) => latest('articles', { slug: { equals: slug } })),
      );
      const restoration = await latest('services', { key: { equals: 'restoration' } });
      const guide = await latest('pages', { key: { equals: 'guide-first-visit' } });
      const category = await latest('article-categories', { slug: { equals: 'آزمون-بذر-دسته' } });
      const tag = await latest('tags', { slug: { equals: 'آزمون-بذر-برچسب' } });
      expect(one).toMatchObject({
        _status: 'draft',
        category: category.id,
        tags: [tag.id],
        primaryService: restoration.id,
        isMedical: true,
        sources: [expect.objectContaining({ publisher: 'NHS', title: 'Tooth decay' })],
        seo: expect.objectContaining({ title: 'مقالهٔ اول آزمون بذر' }),
      });
      for (const field of ['reviewer', 'reviewedAt', 'cover', 'authorDoctor', 'staffAuthorName']) {
        expect(one?.[field] ?? null, field).toBeNull();
      }
      expect(two).toMatchObject({ _status: 'draft', primaryService: null, isMedical: false });

      // Article two did not exist when article one was written: the second pass links it.
      expect(nodesOf(one?.body, 'link').map((n) => n.fields)).toEqual([
        {
          linkType: 'internal',
          newTab: false,
          doc: { relationTo: 'services', value: restoration.id },
        },
        { linkType: 'internal', newTab: false, doc: { relationTo: 'pages', value: guide.id } },
        { linkType: 'internal', newTab: false, doc: { relationTo: 'articles', value: two?.id } },
      ]);
      expect(nodesOf(two?.body, 'link').map((n) => n.fields)).toEqual([
        { linkType: 'internal', newTab: false, doc: { relationTo: 'articles', value: one?.id } },
      ]);
      expect(nodesOf(one?.body, 'block').map((n) => (n.fields as Doc).blockType)).toEqual([
        'callout',
        'table',
      ]);
    },
  );

  it('SD7 a second run on the article root creates and updates nothing', async () => {
    const report = await runSeed(payload, { mode: 'create-only', root: fixtureRoot });
    expect(report.created).toEqual({});
    expect(report.updated).toEqual({});
  });

  it(
    'SD8 fill: creates what is missing, fills empty fields, never overwrites; a second fill changes nothing',
    { timeout: 120_000 },
    async () => {
      const one = await latest('articles', { slug: { equals: ARTICLE_SLUGS[0] } });
      // An editor rewrote the excerpt and cleared the search description and the sources.
      await payload.update({
        collection: 'articles',
        id: one.id as number,
        data: {
          excerpt: 'خلاصه‌ای که ویراستار نوشته است',
          seo: { description: '' },
          sources: [],
        },
        draft: true,
        context: { skipRevalidate: true },
      });
      // A deleted tag is missing again.
      const tag = await latest('tags', { slug: { equals: 'آزمون-بذر-برچسب' } });
      await payload.delete({
        collection: 'tags',
        id: tag.id as number,
        context: { skipRevalidate: true },
      });

      const first = await runSeed(payload, { mode: 'fill', root: fixtureRoot });
      expect(first.created).toEqual({ tags: 1 });
      expect(first.updated.articles).toBe(1);
      const after = await latest('articles', { slug: { equals: ARTICLE_SLUGS[0] } });
      expect(after).toMatchObject({
        excerpt: 'خلاصه‌ای که ویراستار نوشته است',
        seo: expect.objectContaining({ description: 'توضیح آزمون' }),
        sources: [expect.objectContaining({ publisher: 'NHS' })],
        _status: 'draft',
      });

      const second = await runSeed(payload, { mode: 'fill', root: fixtureRoot });
      expect(second.created).toEqual({});
      expect(second.updated).toEqual({});
    },
  );

  it(
    'SD10 fill leaves a document with a medical reviewer as it is and names its empty fields (C1)',
    { timeout: 120_000 },
    async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          name: `بازبین آزمون ${unique()}`,
          specialty: 'دندانپزشک عمومی',
          councilNumber: String(Math.floor(Math.random() * 1e9)),
          _status: 'draft',
        } as never,
        draft: true,
      });
      const article = await latest('articles', { slug: { equals: ARTICLE_SLUGS[0] } });
      await payload.update({
        collection: 'articles',
        id: article.id as number,
        data: { reviewer: doctor.id, sources: [] },
        draft: true,
        context: { skipRevalidate: true },
      });
      // A dentist reviewed the live restoration page, then the editor removed its FAQs.
      const service = await latest('services', { key: { equals: 'restoration' } });
      await payload.update({
        collection: 'services',
        id: service.id as number,
        data: { reviewedBy: doctor.id, faqs: [] },
        context: { skipRevalidate: true },
      });

      const report = await runSeed(payload, { mode: 'fill', root: fixtureRoot });
      expect(await latest('articles', { slug: { equals: ARTICLE_SLUGS[0] } })).toMatchObject({
        reviewer: doctor.id,
        sources: [],
      });
      expect(await latest('services', { key: { equals: 'restoration' } })).toMatchObject({
        _status: 'published',
        reviewedBy: doctor.id,
        faqs: [],
      });
      expect(report.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(new RegExp(`^articles .*${ARTICLE_SLUGS[0]}.*: .*sources`)),
          expect.stringMatching(/^services .*restoration.*: .*faqs/),
        ]),
      );
    },
  );

  it(
    'SD11 fill on published services fills empty fields, keeps filled ones, and reports a refused save without stopping (H43)',
    { timeout: 120_000 },
    async () => {
      // `implant` comes before `crown` in services.yaml: the refusal must not stop the later fill.
      const crown = await latest('services', { key: { equals: 'crown' } });
      const implant = await latest('services', { key: { equals: 'implant' } });
      const edited = 'خلاصه‌ای که ویراستار نوشته است';
      await payload.update({
        collection: 'services',
        id: crown.id as number,
        data: { isMedical: false, sources: [], summary: edited },
        context: { skipRevalidate: true },
      });
      await payload.update({
        collection: 'services',
        id: implant.id as number,
        data: { seo: { title: '' } },
        context: { skipRevalidate: true },
      });
      // The yaml asks for a search title over V-TITLE, so the save of the merged document fails.
      const root = seedRoot((services) =>
        serviceByKey(services, 'implant').set('seo_title', 'ایمپلنت '.repeat(10).trim()),
      );

      const report = await runSeed(payload, { mode: 'fill', root });
      const crownAfter = await latest('services', { key: { equals: 'crown' } });
      expect(crownAfter).toMatchObject({ _status: 'published', summary: edited });
      expect((crownAfter.sources as unknown[]).length).toBeGreaterThan(0);
      const implantAfter = await latest('services', { key: { equals: 'implant' } });
      expect(implantAfter._status).toBe('published');
      expect((implantAfter.seo as Doc).title || null).toBeNull();
      expect(report.warnings).toContainEqual(
        expect.stringMatching(/^services .*implant.*: not saved \(seo\.title: /),
      );
    },
  );

  it('SD12 a service the yaml cannot publish stops the run with its file:line and key (H25)', async () => {
    const root = seedRoot((services) => {
      const copy = serviceByKey(services, 'scaling').clone() as YAMLMap;
      copy.set('key', 'seed-no-source');
      copy.set('slug', 'آزمون-بی-منبع');
      for (const key of ['sources', 'alias', 'tiers', 'related']) copy.delete(key);
      services.items.push(copy);
    });
    const run = runSeed(payload, { mode: 'create-only', root });
    await expect(run).rejects.toBeInstanceOf(SeedDataError);
    await expect(run).rejects.toThrow(
      /^docs\/content\/services\.yaml:\d+: seed-no-source: .*sources: دست‌کم یک منبع علمی/,
    );
    expect(await latest('services', { key: { equals: 'seed-no-source' } })).toBeUndefined();
  });

  it('SD13 an unknown link path or article category stops the run with its file:line (H29)', async () => {
    const slug = 'آزمون-بذر-سه';
    const third = (category: string, text: string) =>
      `${FIXTURE_ARTICLES}  - slug: ${slug}
    title: مقالهٔ سوم آزمون بذر
    seo_title: مقالهٔ سوم آزمون بذر
    seo_description: توضیح آزمون سوم
    excerpt: خلاصهٔ مقالهٔ سوم
    category: ${category}
    primary_service: null
    is_medical: false
    body:
      - type: content
        text: ${text}
`;
    const lineOf = (yaml: string, line: string) => yaml.split('\n').indexOf(line) + 1;

    // The link check runs before the first write, in every mode.
    const badLink = third('آزمون-بذر-دسته', 'پیوند به [نیست](/خدمات/نیست).');
    const link = runSeed(payload, { mode: 'create-only', root: seedRoot(undefined, badLink) });
    await expect(link).rejects.toBeInstanceOf(SeedDataError);
    await expect(link).rejects.toThrow(
      `src/seed/data/articles.yaml:${lineOf(badLink, '        text: پیوند به [نیست](/خدمات/نیست).')}: unknown link path "/خدمات/نیست"`,
    );
    expect(await latest('articles', { slug: { equals: slug } })).toBeUndefined();

    const badCategory = third('نیست', 'متن آزمون.');
    const category = runSeed(payload, { mode: 'dry-run', root: seedRoot(undefined, badCategory) });
    await expect(category).rejects.toBeInstanceOf(SeedDataError);
    await expect(category).rejects.toThrow(
      `src/seed/data/articles.yaml:${lineOf(badCategory, '    category: نیست')}: unknown category "نیست"`,
    );
  });

  // Last: its sync puts back the fields SD10 and SD11 changed.
  it(
    'SD9 a second sync changes nothing: seeded values survive the save hooks unchanged (C32)',
    { timeout: 180_000 },
    async () => {
      await runSeed(payload, { mode: 'sync', root: fixtureRoot });
      const second = await runSeed(payload, { mode: 'sync', root: fixtureRoot });
      expect(second.created).toEqual({});
      expect(second.updated).toEqual({});
    },
  );
});
