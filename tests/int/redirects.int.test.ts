import { readFileSync } from 'node:fs';

import { revalidateTag } from 'next/cache';
import { createLocalReq, type Payload } from 'payload';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { importRedirectsCsv } from '@/admin/redirects/importEndpoint';
import type { PlanRow } from '@/lib/redirects/importCsv';
import type { Page } from '@/payload-types';

import {
  getTestPayload,
  refusal,
  type StaffUser,
  staffUsers,
  unique,
  uniqueKey,
  uniqueSlug,
} from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

const rows = async (from: string) =>
  (
    await payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      depth: 0,
      pagination: false,
    })
  ).docs;
const path = (slug: string) => `/خدمات/${slug}`;

/** A published category and service; a medical service publishes only with a source (H25). */
async function publishedService(db: Payload, slug = uniqueSlug('خدمت-آزمون')) {
  const category = await db.create({
    collection: 'service-categories',
    data: {
      key: uniqueKey('cat'),
      title: 'دستهٔ آزمون',
      navLabel: 'دستهٔ آزمون',
      slug: uniqueSlug('دسته-آزمون'),
      accent: 'cosmetic',
      _status: 'published',
    },
  });
  const service = await db.create({
    collection: 'services',
    data: {
      key: uniqueKey('svc'),
      category: category.id,
      navLabel: 'خدمت آزمون',
      h1: 'خدمت آزمون',
      slug,
      bookingGroup: 'other',
      priority: 3,
      sources: [{ title: 'Oral health', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
      _status: 'published',
    },
  });
  return { category, service };
}

describe('slug-change and removal redirects (spec-data 6.4)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('R1-R5 rename, draft save, chain, shadow, unpublish and republish', async () => {
    const a = uniqueSlug('الف');
    const b = uniqueSlug('ب');
    const c = uniqueSlug('ج');
    const { service } = await publishedService(payload, a);

    // R1 a slug change of a published service: one 301 from the old path.
    await payload.update({ collection: 'services', id: service.id, data: { slug: b } });
    const [first, ...more] = await rows(path(a));
    expect(more).toHaveLength(0);
    expect(first).toMatchObject({
      to: path(b),
      statusCode: '301',
      source: 'slug_change',
      active: true,
    });

    // R2 a draft save leaves the main row (and the redirects) alone.
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { slug: c },
      draft: true,
    });
    expect(await rows(path(b))).toHaveLength(0);

    // R3 publishing the new slug: B -> C, and A -> B is flattened to A -> C.
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { slug: c, _status: 'published' },
    });
    expect((await rows(path(b)))[0]).toMatchObject({ to: path(c), active: true });
    expect((await rows(path(a)))[0]).toMatchObject({ to: path(c), active: true });

    // R4 back to A: the redirect from A would shadow the live page, so it is switched off.
    await payload.update({ collection: 'services', id: service.id, data: { slug: a } });
    expect((await rows(path(a)))[0]?.active).toBe(false);
    expect((await rows(path(c)))[0]).toMatchObject({ to: path(a), active: true });
    expect((await rows(path(b)))[0]).toMatchObject({ to: path(a), active: true });

    // R5 unpublish sends the path to the hub; republishing switches that redirect off again.
    await payload.update({ collection: 'services', id: service.id, data: { _status: 'draft' } });
    expect((await rows(path(a)))[0]).toMatchObject({
      to: '/خدمات',
      source: 'auto_removed',
      active: true,
    });
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { _status: 'published' },
    });
    expect((await rows(path(a)))[0]?.active).toBe(false);
  });

  it('R6 trash and permanent delete redirect to the hub', async () => {
    const slug = uniqueSlug('حذف');
    const { service } = await publishedService(payload, slug);
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { deletedAt: new Date().toISOString() },
    });
    expect((await rows(path(slug)))[0]).toMatchObject({
      to: '/خدمات',
      source: 'auto_removed',
      active: true,
    });

    const other = uniqueSlug('حذف-کامل');
    const second = await publishedService(payload, other);
    await payload.delete({ collection: 'services', id: second.service.id });
    expect((await rows(path(other)))[0]).toMatchObject({ to: '/خدمات', source: 'auto_removed' });
  });

  it('R7 a category and a service cannot share a slug (H-NS)', async () => {
    const slug = uniqueSlug('مشترک');
    await publishedService(payload, slug);
    expect(
      await refusal(
        payload.create({
          collection: 'service-categories',
          data: {
            key: `k-${unique()}`,
            title: 'دسته',
            navLabel: 'دسته',
            slug,
            accent: 'kids',
            _status: 'published',
          },
        }),
      ),
    ).toEqual(['این نشانی برای یک خدمت دیگر استفاده شده است.']);
  });

  it('R8 manual redirects: normalized, chains flattened, loops refused', async () => {
    const x = `/old-${unique()}`;
    const y = `/mid-${unique()}`;
    const z = `/خدمات/${uniqueSlug('مقصد')}`;
    await payload.create({
      collection: 'redirects',
      data: { from: `${y.toUpperCase()}/`, to: z } as never,
    });
    const created = await payload.create({
      collection: 'redirects',
      data: { from: x, to: y } as never,
    });
    expect(created).toMatchObject({ to: z });
    expect((await rows(y))[0]).toMatchObject({ from: y, to: z });
    expect(
      await refusal(payload.create({ collection: 'redirects', data: { from: z, to: x } as never })),
    ).toEqual(['این انتقال به خودش برمی‌گردد. مقصد دیگری انتخاب کنید.']);
  });

  it('R9 revalidation: content tags with max, redirects and globals expire at once', async () => {
    const mock = vi.mocked(revalidateTag);
    mock.mockClear();
    const { service } = await publishedService(payload);
    expect(mock).toHaveBeenCalledWith('col:services', 'max');
    expect(mock).toHaveBeenCalledWith(`doc:services:${service.id}`, 'max');
    mock.mockClear();
    await payload.create({
      collection: 'redirects',
      data: { from: `/r-${unique()}`, to: '/' } as never,
    });
    expect(mock).toHaveBeenCalledWith('col:redirects', { expire: 0 });
    mock.mockClear();
    await payload.updateGlobal({ slug: 'features', data: { introEnabled: true } });
    expect(mock).toHaveBeenCalledWith('glob:features', { expire: 0 });
    mock.mockClear();
    // A draft save of a draft is invisible to the site: no revalidation.
    const draft = await payload.create({
      collection: 'articles',
      data: { title: `پیش‌نویس ${unique()}` },
      draft: true,
    });
    await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { title: 'دیگر' },
      draft: true,
    });
    expect(mock.mock.calls.filter(([tag]) => String(tag).startsWith('col:articles'))).toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 6: the /vip anchor (H20), the slug changes of the article and guide collections, and the
// old-URL CSV import (H19, plan section 6, C27).

const textNode = (text: string) => ({
  type: 'text',
  text,
  version: 1,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
});
const element = (type: string, children: unknown[], extra: object = {}) => ({
  type,
  children,
  direction: 'rtl',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
});
const docLink = (relationTo: string, value: number, text: string) =>
  element('link', [textNode(text)], {
    version: 3,
    fields: { linkType: 'internal', newTab: false, doc: { relationTo, value } },
  });
const paragraph = (...children: unknown[]) =>
  element('paragraph', children, { textFormat: 0, textStyle: '' });
const h2 = (text: string) => element('heading', [textNode(text)], { tag: 'h2' });

/** A JPEG media document; a random colour keeps its content hash unique. */
async function photo(width: number, height: number) {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: Math.floor(Math.random() * 255), g: 80, b: 70 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  return payload.create({
    collection: 'media',
    data: { alt: 'لبخند بیمار در کلینیک' },
    file: { data, name: `rd-${unique()}.jpg`, mimetype: 'image/jpeg', size: data.length },
  });
}

const ids: Record<string, number> = {};
let restoreGuide: () => Promise<void> = async () => {};
const GUIDE_KEY = 'guide-dental-fear';

/** An article that passes the publish gate (H5 with C1, H6, H7 with C2, C3), as editorial.int. */
const article = (slug: string): Record<string, unknown> => ({
  title: 'ایمپلنت یا بریج برای دندان',
  slug,
  excerpt:
    'وقتی یک دندان از دست می‌رود، دو راه رایج ایمپلنت و بریج است. این نوشته تفاوت این دو را به زبان ساده می‌گوید.',
  cover: ids.cover,
  body: {
    root: element('root', [
      h2('ایمپلنت چیست'),
      paragraph(
        textNode('برای جزئیات درمان '),
        docLink('services', ids.service!, 'صفحهٔ خدمت'),
        textNode(' و برای آمادگی '),
        docLink('pages', ids.guide!, 'راهنمای ترس از دندانپزشکی'),
        textNode(' را بخوانید.'),
      ),
      h2('بریج چیست'),
      paragraph(textNode('متن کوتاه.')),
    ]),
  },
  category: ids.category,
  primaryService: ids.service,
  authorDoctor: ids.dentist,
  isMedical: true,
  reviewer: ids.dentist,
  reviewedAt: '2026-10-10T08:30:00.000Z',
  sources: [{ title: 'Dental implants', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
  reviewState: 'approved',
  seo: { description: 'ب'.repeat(130) },
  _status: 'published',
});
const articlePath = (slug: string) => `/مقالات/${slug}`;

describe('phase 6 slug changes and the /vip anchor (H20)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ids.cover = (await photo(1600, 900)).id as number;
    const portrait = await photo(640, 800);
    ids.dentist = (
      await payload.create({
        collection: 'doctors',
        data: {
          name: `آزمون ${unique()}`,
          specialty: 'دندانپزشک عمومی',
          councilNumber: String(Math.floor(Math.random() * 1e9)),
          photo: portrait.id,
          _status: 'published',
        } as never,
      })
    ).id as number;
    ids.service = (await publishedService(payload)).service.id as number;
    ids.category = (
      await payload.create({
        collection: 'article-categories',
        data: { title: `جایگزینی دندان ${unique()}` } as never,
      })
    ).id as number;
    // The guide link target: a published guide page, restored afterwards (other files use it).
    const existing = (
      await payload.find({ collection: 'pages', where: { key: { equals: GUIDE_KEY } }, depth: 0 })
    ).docs[0] as Page | undefined;
    const guide =
      existing ??
      (await payload.create({
        collection: 'pages',
        data: { key: GUIDE_KEY, title: 'ترس از دندانپزشکی', slug: 'ترس-از-دندانپزشکی' } as never,
        draft: true,
      }));
    await payload.update({
      collection: 'pages',
      id: guide.id,
      data: {
        reviewer: ids.dentist,
        reviewedAt: '2026-10-01T00:00:00.000Z',
        sources: [{ title: 'Dental anxiety', url: 'https://www.nhs.uk/conditions' }],
        _status: 'published',
      },
    });
    ids.guide = guide.id as number;
    restoreGuide = async () => {
      if (!existing) {
        await payload.delete({ collection: 'pages', id: guide.id });
        return;
      }
      const saved = {
        slug: existing.slug,
        reviewer: existing.reviewer ?? null,
        reviewedAt: existing.reviewedAt ?? null,
        sources: existing.sources ?? [],
        _status: existing._status,
      };
      await payload.update({ collection: 'pages', id: guide.id, data: saved, draft: true });
      await payload.db.updateOne({ collection: 'pages', id: guide.id, data: saved });
    };
  }, 120_000);

  afterAll(async () => {
    await restoreGuide();
  });

  it('R10 an alias to `path#anchor` stays one hop with its anchor after the path changes', async () => {
    const a = uniqueSlug('ترمیم');
    const b = uniqueSlug('ترمیم-نو');
    const { service } = await publishedService(payload, a);
    const alias = `/vip-${unique()}`;
    await payload.create({
      collection: 'redirects',
      data: { from: alias, to: `${path(a)}#سطح-ترمیم`, source: 'alias' } as never,
    });
    await payload.update({ collection: 'services', id: service.id, data: { slug: b } });
    expect((await rows(alias))[0]).toMatchObject({
      to: `${path(b)}#سطح-ترمیم`,
      source: 'alias',
      active: true,
    });
    expect((await rows(path(a)))[0]).toMatchObject({ to: path(b), source: 'slug_change' });
    // An alias written after the change is flattened onto the new path, anchor kept.
    const late = `/vip-${unique()}`;
    const created = await payload.create({
      collection: 'redirects',
      data: { from: late, to: `${path(a)}#سطح-ترمیم`, source: 'alias' } as never,
    });
    expect(created.to).toBe(`${path(b)}#سطح-ترمیم`);
  });

  it('R11 an article: autosaves change nothing, the publish and a scheduled publish add one 301, trash goes to the hub', async () => {
    const a = uniqueSlug('مقاله-الف');
    const b = uniqueSlug('مقاله-ب');
    const c = uniqueSlug('مقاله-ج');
    const doc = await payload.create({ collection: 'articles', data: article(a) as never });
    expect(doc._status).toBe('published');

    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { slug: b },
      draft: true,
      autosave: true,
    });
    expect(await rows(articlePath(a))).toHaveLength(0);
    await payload.update({ collection: 'articles', id: doc.id, data: { _status: 'published' } });
    expect(await rows(articlePath(a))).toEqual([
      expect.objectContaining({ to: articlePath(b), source: 'slug_change', active: true }),
    ]);

    await payload.update({ collection: 'articles', id: doc.id, data: { slug: c }, draft: true });
    const job = await payload.jobs.queue({
      task: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'articles', value: String(doc.id) } } as never,
      waitUntil: new Date(Date.now() - 1000),
    });
    await payload.jobs.runByID({ id: job.id });
    expect((await rows(articlePath(b)))[0]).toMatchObject({ to: articlePath(c), active: true });
    expect((await rows(articlePath(a)))[0]).toMatchObject({ to: articlePath(c), active: true });

    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { deletedAt: new Date().toISOString() },
    });
    expect((await rows(articlePath(c)))[0]).toMatchObject({
      to: '/مقالات',
      source: 'auto_removed',
      active: true,
    });
    expect((await rows(articlePath(a)))[0]).toMatchObject({ to: '/مقالات' });
  });

  it('R12 a guide slug change: one 301 under the guide hub', async () => {
    const guide = await payload.findByID({ collection: 'pages', id: ids.guide!, depth: 0 });
    const before = `/راهنمای-بیمار/${guide.slug}`;
    const slug = uniqueSlug('راهنما');
    await payload.update({ collection: 'pages', id: guide.id, data: { slug } });
    expect((await rows(before))[0]).toMatchObject({
      to: `/راهنمای-بیمار/${slug}`,
      source: 'slug_change',
      active: true,
    });
    await payload.update({ collection: 'pages', id: guide.id, data: { slug: guide.slug } });
    expect((await rows(before))[0]?.active).toBe(false);
  });

  it('R13 a dentist and an article category: one 301 each', async () => {
    const slug = uniqueSlug('دکتر-نو');
    const dentist = await payload.findByID({ collection: 'doctors', id: ids.dentist!, depth: 0 });
    await payload.update({ collection: 'doctors', id: dentist.id, data: { slug } });
    expect((await rows(`/پزشکان/${dentist.slug}`))[0]).toMatchObject({
      to: `/پزشکان/${slug}`,
      source: 'slug_change',
    });
    const category = await payload.create({
      collection: 'article-categories',
      data: { title: `دستهٔ آزمون ${unique()}` } as never,
    });
    const next = uniqueSlug('دسته-نو');
    await payload.update({
      collection: 'article-categories',
      id: category.id,
      data: { slug: next },
    });
    expect((await rows(`/مقالات/دسته/${category.slug}`))[0]).toMatchObject({
      to: `/مقالات/دسته/${next}`,
      source: 'slug_change',
    });
  });
});

describe('old-URL CSV import endpoint (H19, plan section 6, C27)', () => {
  let admin: StaffUser;
  let editor: StaffUser;
  const fixture = readFileSync('tests/fixtures/old-urls.csv', 'utf8');
  const origins = 'old-sefid.ir';

  type Answer = {
    rows?: PlanRow[];
    error?: string;
    digest?: string;
    written?: number;
    message?: string;
  };
  async function post(user: object, body: unknown, type = 'application/json') {
    const req = await createLocalReq(
      {
        user: user as never,
        req: {
          method: 'POST',
          headers: new Headers({ 'content-type': type }),
          text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        } as never,
      },
      payload,
    );
    const response = await importRedirectsCsv(req);
    return { status: response.status, body: (await response.json()) as Answer };
  }
  const count = async () => (await payload.count({ collection: 'redirects' })).totalDocs;
  const outcomes = (answer: Answer) =>
    Object.fromEntries((answer.rows ?? []).map((r) => [r.line, r.outcome]));

  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
    // The seeded /vip alias (the seeder writes it; this database may not be seeded).
    if ((await rows('/vip')).length === 0) {
      await payload.create({
        collection: 'redirects',
        data: { from: '/vip', to: '/خدمات/ترمیم-دندان#سطح-ترمیم', source: 'alias' } as never,
      });
    }
  });

  it('R14 only a TOTP-verified admin; a body that is not JSON is refused', async () => {
    const unverified = { ...admin, _strategy: 'local-jwt', hasTotp: true };
    for (const user of [editor, unverified]) {
      const { status, body } = await post(user, { csv: fixture, origins });
      expect(status).toBe(403);
      expect(body).toEqual({ message: 'فقط مدیر می‌تواند نشانی‌ها را از فایل وارد کند.' });
    }
    expect((await post(admin, 'csv=x', 'application/x-www-form-urlencoded')).status).toBe(400);
    expect((await post(admin, '{"csv":', 'application/json')).status).toBe(400);
    expect((await post(admin, { csv: 3 })).status).toBe(400);
  });

  it('R15 the dry run writes nothing; apply writes the same plan with source import; a rerun changes nothing', async () => {
    const before = await count();
    const dry = await post(admin, { csv: fixture, origins });
    expect(dry.status).toBe(200);
    expect(await count()).toBe(before);
    expect(dry.body.error).toBeUndefined();
    const plan = outcomes(dry.body);
    // C27 (/vip alias) and a live hub are refused; the rest as the unit fixture (IC5).
    expect(plan[11]).toBe('refused');
    expect(plan[12]).toBe('refused');
    const written = (dry.body.rows ?? []).filter((r) => r.outcome === 'new');
    expect(written).toHaveLength(11);

    // A stale digest is refused before any write.
    const stale = await post(admin, { csv: fixture, origins, apply: true, digest: 'x' });
    expect(stale.status).toBe(409);
    expect(await count()).toBe(before);

    const applied = await post(admin, {
      csv: fixture,
      origins,
      apply: true,
      digest: dry.body.digest,
    });
    expect(applied.status).toBe(200);
    expect(applied.body.written).toBe(11);
    for (const row of written) {
      expect((await rows(row.from))[0], row.from).toMatchObject({
        to: row.to,
        statusCode: row.status,
        source: 'import',
        active: true,
      });
    }
    expect((await rows('/vip'))[0]).toMatchObject({ source: 'alias' });

    const again = await post(admin, { csv: fixture, origins });
    const rerun = (again.body.rows ?? []).filter((r) => r.outcome !== 'refused');
    expect(rerun.map((r) => r.outcome)).toEqual(Array(11).fill('unchanged'));
    const versions = await payload.countVersions({ collection: 'redirects' });
    const second = await post(admin, {
      csv: fixture,
      origins,
      apply: true,
      digest: again.body.digest,
    });
    expect(second.body.written).toBe(0);
    expect((await payload.countVersions({ collection: 'redirects' })).totalDocs).toBe(
      versions.totalDocs,
    );
  });

  it('R17 a write that fails stops the run and says where; a rerun finishes it', async () => {
    const tag = unique();
    const csv = `/stop-${tag}-a,/خدمات\n/stop-${tag}-b,/پزشکان\n/stop-${tag}-c,/مقالات`;
    const dry = await post(admin, { csv, origins });
    const create = payload.create.bind(payload);
    let calls = 0;
    const spy = vi
      .spyOn(payload, 'create')
      .mockImplementation(((args: { collection: string }) =>
        args.collection === 'redirects' && ++calls === 2
          ? Promise.reject(new Error('disk full'))
          : create(args as never)) as never);
    try {
      const failed = await post(admin, { csv, origins, apply: true, digest: dry.body.digest });
      expect(failed.status).toBe(500);
      expect(failed.body.message).toBe(
        'ثبت در سطر ۲ متوقف شد: ۱ ردیف پیش از آن ثبت شد. دوباره بررسی کنید؛ ردیف‌های ثبت‌شده «بدون تغییر» می‌شوند.',
      );
    } finally {
      spy.mockRestore();
    }
    const again = await post(admin, { csv, origins });
    expect(outcomes(again.body)).toEqual({ 1: 'unchanged', 2: 'new', 3: 'new' });
    const done = await post(admin, { csv, origins, apply: true, digest: again.body.digest });
    expect(done.body.written).toBe(2);
  });

  it('R16 a published service path and a file over the cap are refused', async () => {
    const { service } = await publishedService(payload);
    const live = await post(admin, { csv: `${path(service.slug as string)},/خدمات`, origins });
    expect(live.body.rows?.[0]).toMatchObject({
      outcome: 'refused',
      note: 'این نشانی صفحهٔ منتشرشدهٔ سایت است و تغییر مسیر آن را پنهان می‌کند.',
    });
    const big = Array.from({ length: 5001 }, (_, i) => `/big-${i},/خدمات`).join('\n');
    const over = await post(admin, { csv: big, origins });
    expect(over.body).toMatchObject({
      rows: [],
      error: 'فایل بیش از ۵٬۰۰۰ ردیف دارد. آن را به چند فایل کوچک‌تر تقسیم کنید.',
    });
    const before = await count();
    const refused = await post(admin, { csv: big, origins, apply: true, digest: over.body.digest });
    expect(refused.status).toBe(400);
    expect(await count()).toBe(before);
  });
});
