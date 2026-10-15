import { unstable_cache } from 'next/cache';
import type { Payload } from 'payload';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getNavTree, getServiceTree } from '@/lib/data/catalog';
import {
  getCases,
  getDoctorBySlug,
  getDoctors,
  getGuideBySlug,
  getGuides,
  getTestimonials,
} from '@/lib/data/content';
import { getPublishedSlugs } from '@/lib/data/slugs';
import { PAGE_PATHS, type PageKey } from '@/lib/paths';
import type { Page } from '@/payload-types';

import { getTestPayload, publishedService, unique, uniqueKey, uniqueSlug } from './helpers';

// unstable_cache runs the loader directly and records its key and tags.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

let payload: Payload;

const tagsSeen = () =>
  new Set(
    vi
      .mocked(unstable_cache)
      .mock.calls.flatMap((call) => (call[2] as { tags?: string[] } | undefined)?.tags ?? []),
  );

/** A JPEG media document; a random colour keeps its hash (and file name) unique. */
async function photo(width: number, height: number) {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: Math.floor(Math.random() * 255), g: 120, b: 140 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  return payload.create({
    collection: 'media',
    data: { alt: 'تصویر آزمون' },
    file: { data, name: `photo-${unique()}.jpg`, mimetype: 'image/jpeg', size: data.length },
  });
}

async function service(categoryId: number, priority: number, order: number, draft = false) {
  return payload.create({
    collection: 'services',
    data: {
      key: uniqueKey('svc'),
      category: categoryId,
      navLabel: `خدمت ${unique()}`,
      h1: 'خدمت آزمون',
      slug: uniqueSlug('خدمت'),
      bookingGroup: 'other',
      priority,
      order,
      _status: draft ? 'draft' : 'published',
    },
    draft,
  });
}

/** A published standalone category and its one service (the category publishes after it). */
async function standaloneCategory(slug: string | null = null) {
  const category = await payload.create({
    collection: 'service-categories',
    data: {
      key: uniqueKey('solo'),
      title: 'دستهٔ تک‌خدمتی',
      navLabel: 'تک‌خدمتی',
      slug,
      standalone: true,
      accent: 'kids',
    },
    draft: true,
  });
  const only = await service(category.id, 2, 10);
  await payload.update({
    collection: 'service-categories',
    id: category.id,
    data: { standaloneService: only.id, _status: 'published' },
  });
  return { category, only };
}

async function doctor(services: number[], draft = false) {
  const image = await photo(640, 800);
  const data = {
    name: `آزمون ${unique()}`,
    slug: uniqueSlug('دکتر'),
    specialty: 'دندانپزشک عمومی',
    councilNumber: String(Math.floor(Math.random() * 1e9)),
    photo: image.id,
    services,
  };
  return draft
    ? payload.create({ collection: 'doctors', data: { ...data, _status: 'draft' }, draft: true })
    : payload.create({ collection: 'doctors', data: { ...data, _status: 'published' } });
}

/**
 * Runs `test` with the page `key` changed by `data` (created when missing), then puts the row back
 * as it was: int tests share tables, never rows, and the seeder's tests read the seeded pages.
 */
async function withPage(
  key: PageKey,
  data: Partial<Page>,
  test: (page: Page) => Promise<void>,
): Promise<void> {
  const find = async (draft = false) =>
    (
      await payload.find({
        collection: 'pages',
        where: { key: { equals: key } },
        limit: 1,
        depth: 0,
        draft,
      })
    ).docs[0];
  const fieldsOf = (doc: Page | undefined) =>
    doc && Object.fromEntries(Object.keys(data).map((f) => [f, doc[f as keyof Page] ?? null]));
  const existing = await find();
  const page =
    existing ??
    (await payload.create({
      collection: 'pages',
      data: {
        key,
        title: 'صفحهٔ آزمون',
        slug: PAGE_PATHS[key].split('/').at(-1),
        _status: 'draft',
      },
      draft: true,
    }));
  const saved = fieldsOf(existing) ?? {};
  try {
    await payload.update({ collection: 'pages', id: page.id, data });
    await test(page);
  } finally {
    if (existing) {
      // A seeded guide is a draft without a reviewer, which a non-draft save refuses: the latest
      // version comes back through a draft save, the main row through the adapter.
      await payload.update({ collection: 'pages', id: page.id, data: saved, draft: true });
      await payload.db.updateOne({ collection: 'pages', id: page.id, data: saved });
    } else await payload.delete({ collection: 'pages', id: page.id });
  }
  expect(fieldsOf(await find())).toEqual(fieldsOf(existing));
  expect(fieldsOf(await find(true))).toEqual(fieldsOf(existing));
}

describe('platform readers (phase 4, freeze F9 and F10)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('DR1 the service tree: published only, money services first, standalone categories resolve to their service', async () => {
    const { category } = await publishedService(payload);
    const low = await service(category.id, 3, 10);
    const moneyLate = await service(category.id, 1, 20);
    const moneyEarly = await service(category.id, 1, 10);
    await service(category.id, 1, 5, true);
    const { category: standalone, only } = await standaloneCategory();

    const tree = await getServiceTree();
    expect([...tagsSeen()]).toEqual(
      expect.arrayContaining(['col:service-categories', 'col:services']),
    );
    const mine = tree.find((c) => c.id === category.id);
    // The helper's own service (priority 3, no order) sorts with the other priority 3 one.
    expect(mine?.services.map((s) => s.id).slice(0, 2)).toEqual([moneyEarly.id, moneyLate.id]);
    expect(mine?.services.map((s) => s.id)).toContain(low.id);
    expect(mine?.services.every((s) => s.path.startsWith('/خدمات/'))).toBe(true);
    expect(mine?.path).toBe(`/خدمات/${category.slug}`);
    const solo = tree.find((c) => c.id === standalone.id);
    expect(solo).toMatchObject({ standalone: true, path: `/خدمات/${only.slug}` });

    const nav = await getNavTree();
    expect(nav.groups.find((g) => g.key === category.key)?.items[0]?.key).toBe(moneyEarly.key);
    expect(nav.groups.some((g) => g.key === standalone.key)).toBe(false);
    expect(nav.others.map((o) => o.key)).toContain(only.key);
  });

  it('DR2 published slugs per dynamic route: drafts, standalone categories and non-guide pages stay out', async () => {
    const { category, service: live } = await publishedService(payload);
    const draft = await service(category.id, 2, 10, true);
    const { category: solo } = await standaloneCategory(uniqueSlug('تک'));
    expect(solo.slug).toBeTruthy();
    const dentist = await doctor([]);
    // The guide hub is a published page under the guides prefix, but not a guide.
    await withPage('guide-hub', { _status: 'published' }, async (hub) => {
      vi.mocked(unstable_cache).mockClear();
      const slugs = await getPublishedSlugs();
      // Read fresh: through the content cache the first read after a publish is the old set.
      expect(unstable_cache).not.toHaveBeenCalled();
      expect(Object.keys(slugs).sort()).toEqual(
        ['article-categories', 'articles', 'doctors', 'guides', 'services', 'tags'].sort(),
      );
      expect(slugs.services).toEqual(expect.arrayContaining([live.slug, category.slug]));
      expect(slugs.services).not.toContain(draft.slug);
      expect(slugs.services).not.toContain(solo.slug);
      expect(slugs.doctors).toContain(dentist.slug);
      expect(hub.slug).toBeTruthy();
      expect(slugs.guides).not.toContain(hub.slug);
      // The proxy compares normalizePath() output: stored slugs are already in that form.
      expect(slugs.services.every((s) => s === s.normalize('NFC') && !s.includes('/'))).toBe(true);
    });
  });

  it('DR3 dentists: published only, by slug in any URL spelling; draft services dropped; joins skipped', async () => {
    const { service: live } = await publishedService(payload);
    const hidden = await service(
      typeof live.category === 'object' ? live.category.id : live.category,
      2,
      10,
      true,
    );
    const dentist = await doctor([live.id, hidden.id]);
    const draft = await doctor([live.id], true);

    const all = await getDoctors();
    expect([...tagsSeen()]).toEqual(expect.arrayContaining(['col:doctors', 'col:media']));
    const listed = all.find((d) => d.id === dentist.id);
    expect(listed?.services.map((s) => s.id)).toEqual([live.id]);
    expect(all.some((d) => d.id === draft.id)).toBe(false);
    // With joins on, Payload fills `cases` ({ docs: [] } at least), drafts included.
    expect(listed?.cases).toBeUndefined();
    expect(typeof listed?.photo).toBe('object');

    expect((await getDoctorBySlug(encodeURIComponent(dentist.slug)))?.id).toBe(dentist.id);
    expect((await getDoctorBySlug(dentist.slug.normalize('NFD')))?.id).toBe(dentist.id);
    expect(await getDoctorBySlug(draft.slug)).toBeNull();
  });

  it('DR4 guides: published guide pages only, in key order; a hub slug never matches; a draft reviewer is hidden', async () => {
    const reviewer = await doctor([], true);
    const changes: Partial<Page> = {
      reviewer: reviewer.id,
      reviewedAt: '2026-10-01T00:00:00.000Z',
      sources: [{ title: 'منبع آزمون', url: 'https://www.ada.org/resources' }],
      _status: 'published',
    };
    await withPage('guide-dental-fear', changes, async (page) => {
      const guides = await getGuides();
      expect(guides.every((g) => g.key.startsWith('guide-') && g._status === 'published')).toBe(
        true,
      );
      const guide = guides.find((g) => g.id === page.id);
      expect(guide?.reviewer).toBeNull();
      expect((await getGuideBySlug(encodeURIComponent(page.slug ?? '')))?.id).toBe(page.id);
      expect(await getGuideBySlug('خدمات')).toBeNull();
      expect(await getGuideBySlug('راهنمای-بیمار')).toBeNull();
    });
  });

  it('DR5 cases and testimonials: published only, filtered by service, dentist and home flag; draft relations hidden', async () => {
    const { service: live } = await publishedService(payload);
    const draftDentist = await doctor([live.id], true);
    const [before, after] = [await photo(800, 600), await photo(800, 600)];
    const shown = await payload.create({
      collection: 'cases',
      data: {
        title: `نمونهٔ آزمون ${unique()}`,
        service: live.id,
        doctor: draftDentist.id,
        before: before.id,
        after: after.id,
        consentConfirmed: true,
        _status: 'published',
      },
    });
    const hiddenCase = await payload.create({
      collection: 'cases',
      data: { title: 'پیش‌نویس', service: live.id, before: before.id, after: after.id },
      draft: true,
    });
    const cases = await getCases({ service: live.id });
    expect(cases.map((c) => c.id)).toEqual([shown.id]);
    expect(cases[0]?.doctor).toBeNull();
    expect(cases[0]?.service?.id).toBe(live.id);
    expect(cases.some((c) => c.id === hiddenCase.id)).toBe(false);
    expect(await getCases({ doctor: draftDentist.id, service: live.id })).toHaveLength(1);
    expect((await getCases({ home: true })).some((c) => c.id === shown.id)).toBe(false);

    const quote = await payload.create({
      collection: 'testimonials',
      data: {
        patientLabel: 'م. آزمون',
        type: 'text',
        quote: 'جملهٔ آزمون',
        service: live.id,
        consentConfirmed: true,
        _status: 'published',
      },
    });
    await payload.create({
      collection: 'testimonials',
      data: { patientLabel: 'پیش‌نویس', type: 'text', quote: 'متن', service: live.id },
      draft: true,
    });
    const voices = await getTestimonials({ service: live.id, limit: 5 });
    expect(voices.map((t) => t.id)).toEqual([quote.id]);
    expect(voices[0]?.service?.id).toBe(live.id);
    expect((await getTestimonials({ home: true })).some((t) => t.id === quote.id)).toBe(false);
  });
});
