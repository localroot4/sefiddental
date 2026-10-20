import { unstable_cache } from 'next/cache';
import type { Payload } from 'payload';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  getArticleBySlug,
  getArticleCategories,
  getArticlesForDoctor,
  getArticlesForService,
  getArticlesPage,
  getRelatedArticles,
} from '@/lib/data/content';
import { getPublishedSlugs } from '@/lib/data/slugs';
import type { Page } from '@/payload-types';

import { getTestPayload, unique, uniqueKey, uniqueSlug } from './helpers';

// unstable_cache runs the loader directly and records its key and tags.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

/*
 * Article readers of the TEMPLATES lane (plan 2.1): the paged list, the post, related articles,
 * the service and dentist lists, and the slug sets the proxy's 404 reads (H4: a taxonomy without
 * a published article has no page). Every article here passes the publish gate (H5 with C1, H7
 * with C2, C3), like the e2e fixture.
 */

let payload: Payload;
const ids: Record<string, number> = {};
let restoreGuide: () => Promise<void> = async () => {};

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
const body = (service: number) => ({
  root: element('root', [
    element('heading', [textNode('بخش اول')], { tag: 'h2' }),
    element(
      'paragraph',
      [
        textNode('برای جزئیات '),
        docLink('services', service, 'صفحهٔ خدمت'),
        textNode(' و برای مراقبت '),
        docLink('pages', ids.guide!, 'راهنمای بیمار'),
        textNode(' را بخوانید.'),
      ],
      { textFormat: 0, textStyle: '' },
    ),
    element('heading', [textNode('بخش دوم')], { tag: 'h2' }),
  ]),
});

async function photo(width: number, height: number) {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: Math.floor(Math.random() * 255), g: 140, b: 90 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  return payload.create({
    collection: 'media',
    data: { alt: 'تصویر آزمون مقاله' },
    file: { data, name: `ar-${unique()}.jpg`, mimetype: 'image/jpeg', size: data.length },
  });
}

async function dentist() {
  const portrait = await photo(640, 800);
  const doc = await payload.create({
    collection: 'doctors',
    data: {
      name: `آزمون ${unique()}`,
      specialty: 'دندانپزشک عمومی',
      councilNumber: String(Math.floor(Math.random() * 1e9)),
      photo: portrait.id,
      _status: 'published',
    } as never,
  });
  return doc.id as number;
}

/** A published service with the source a medical service needs (H25). */
async function service() {
  const category = await payload.create({
    collection: 'service-categories',
    data: {
      key: uniqueKey('arcat'),
      title: 'دستهٔ آزمون',
      navLabel: 'دستهٔ آزمون',
      slug: uniqueSlug('دسته-خواننده'),
      accent: 'restorative',
      _status: 'published',
    },
  });
  const doc = await payload.create({
    collection: 'services',
    data: {
      key: uniqueKey('arsvc'),
      category: category.id,
      navLabel: `خدمت آزمون ${unique()}`,
      h1: 'خدمت آزمون',
      slug: uniqueSlug('خدمت-خواننده'),
      bookingGroup: 'other',
      priority: 3,
      sources: [{ title: 'Dental care', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
      _status: 'published',
    },
  });
  return doc.id as number;
}

const taxonomy = async (collection: 'article-categories' | 'tags', title: string) =>
  (await payload.create({ collection, data: { title: `${title} ${unique()}` } as never }))
    .id as number;

/** A published article (or a draft) that passes the gate; `day` orders them, newest first. */
async function article(day: number, extra: Record<string, unknown> = {}, draft = false) {
  const data = {
    title: `مقالهٔ آزمون ${day}`,
    slug: uniqueSlug('مقاله-خواننده'),
    excerpt:
      'این نوشته فقط برای آزمودن خواننده‌های مقاله است و جز پیوند به خدمت و راهنما چیزی ندارد که بیمار بخواند.',
    cover: ids.cover,
    body: body((extra.primaryService as number | undefined) ?? ids.service!),
    category: ids.category,
    primaryService: ids.service,
    authorDoctor: ids.author,
    isMedical: true,
    reviewer: ids.reviewer,
    reviewedAt: '2026-10-10T08:30:00.000Z',
    sources: [{ title: 'Dental care', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
    reviewState: 'approved',
    publishedAt: `2026-09-${String(day).padStart(2, '0')}T08:00:00.000Z`,
    seo: { description: 'پ'.repeat(130) },
    ...extra,
    _status: draft ? 'draft' : 'published',
  };
  return payload.create({ collection: 'articles', data: data as never, draft });
}

const tagsSeen = () =>
  new Set(
    vi
      .mocked(unstable_cache)
      .mock.calls.flatMap((call) => (call[2] as { tags?: string[] } | undefined)?.tags ?? []),
  );

describe('article readers (TEMPLATES, H3, H4, H24)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ids.cover = (await photo(1600, 900)).id as number;
    ids.author = await dentist();
    ids.reviewer = await dentist();
    ids.service = await service();
    ids.otherService = await service();
    ids.category = await taxonomy('article-categories', 'دستهٔ خواننده');
    ids.tag = await taxonomy('tags', 'برچسب خواننده');
    // The guide link target: a published guide page, put back afterwards (other files seed it).
    const key = 'guide-dental-fear';
    const existing = (
      await payload.find({ collection: 'pages', where: { key: { equals: key } }, depth: 0 })
    ).docs[0] as Page | undefined;
    const guide =
      existing ??
      (await payload.create({
        collection: 'pages',
        data: { key, title: 'ترس از دندانپزشکی', slug: 'ترس-از-دندانپزشکی' } as never,
        draft: true,
      }));
    await payload.update({
      collection: 'pages',
      id: guide.id,
      data: {
        reviewer: ids.reviewer,
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

  it('AT1 a page of cards: published only, newest first, with the totals; the cover populated, no body', async () => {
    const older = await article(1, { tags: [ids.tag] });
    const newer = await article(3, { tags: [ids.tag] });
    const middle = await article(2);
    await article(4, {}, true);
    const first = await getArticlesPage({ page: 1, category: ids.category, perPage: 2 });
    expect(first.docs.map((d) => d.id)).toEqual([newer.id, middle.id]);
    expect([first.totalDocs, first.totalPages, first.page]).toEqual([3, 2, 1]);
    const card = first.docs[0]!;
    expect(typeof card.cover).toBe('object');
    expect(card).not.toHaveProperty('body');
    const second = await getArticlesPage({ page: 2, category: ids.category, perPage: 2 });
    expect(second.docs.map((d) => d.id)).toEqual([older.id]);
    const tagged = await getArticlesPage({ page: 1, tag: ids.tag });
    expect(tagged.docs.map((d) => d.id)).toEqual([newer.id, older.id]);
    expect(tagsSeen()).toContain('col:articles');
  });

  it('AT2 slug sets and category chips keep only taxonomies with a published article (H4)', async () => {
    const empty = await taxonomy('article-categories', 'دستهٔ خالی');
    const draftOnly = await taxonomy('article-categories', 'دستهٔ پیش‌نویس');
    const unusedTag = await taxonomy('tags', 'برچسب بی‌مقاله');
    await article(5, { category: draftOnly }, true);
    const slugOf = async (collection: 'article-categories' | 'tags', id: number) =>
      (await payload.findByID({ collection, id, depth: 0 })).slug;
    const slugs = await getPublishedSlugs();
    expect(slugs['article-categories']).toContain(
      await slugOf('article-categories', ids.category!),
    );
    expect(slugs['article-categories']).not.toContain(await slugOf('article-categories', empty));
    expect(slugs['article-categories']).not.toContain(
      await slugOf('article-categories', draftOnly),
    );
    expect(slugs.tags).toContain(await slugOf('tags', ids.tag!));
    expect(slugs.tags).not.toContain(await slugOf('tags', unusedTag));
    const chips = (await getArticleCategories()).map((c) => c.id);
    expect(chips).toContain(ids.category);
    expect(chips).not.toContain(empty);
    expect(chips).not.toContain(draftOnly);
  });

  it('AT3 the post by slug in any URL spelling, relations populated, drafts never; link targets tag the read', async () => {
    const live = await article(6);
    const draft = await article(7, {}, true);
    vi.mocked(unstable_cache).mockClear();
    const post = await getArticleBySlug(encodeURIComponent(live.slug));
    expect(post?.id).toBe(live.id);
    expect(post?.authorDoctor?.id).toBe(ids.author);
    expect(post?.reviewer?.id).toBe(ids.reviewer);
    expect(post?.primaryService?.id).toBe(ids.service);
    expect(post?.category?.id).toBe(ids.category);
    expect([...tagsSeen()]).toEqual(
      expect.arrayContaining(['col:articles', 'col:services', 'col:pages', 'col:media']),
    );
    expect((await getArticleBySlug(live.slug.normalize('NFD')))?.id).toBe(live.id);
    expect(await getArticleBySlug(draft.slug)).toBeNull();
  });

  it('AT4 related: the published manual pick first, a draft pick skipped, then the same service', async () => {
    const otherCategory = await taxonomy('article-categories', 'دستهٔ دیگر');
    const pick = await article(8, { category: otherCategory, primaryService: ids.otherService });
    const draftPick = await article(9, {}, true);
    const self = await article(10, { relatedArticles: [draftPick.id, pick.id] });
    const post = await getArticleBySlug(self.slug);
    const related = await getRelatedArticles(post!);
    expect(related).toHaveLength(2);
    expect(related[0]?.id).toBe(pick.id);
    expect(related.map((r) => r.id)).not.toContain(self.id);
    expect(related.map((r) => r.id)).not.toContain(draftPick.id);
  });

  it('AT5 a service lists its two newest articles; a dentist lists authored and reviewed with the role', async () => {
    const forService = await getArticlesForService(ids.service!);
    expect(forService).toHaveLength(2);
    expect(forService[0]!.publishedAt! >= forService[1]!.publishedAt!).toBe(true);
    expect(await getArticlesForService(ids.otherService!)).toHaveLength(1);
    const both = await dentist();
    await article(11, { authorDoctor: both, reviewer: both });
    const authored = await getArticlesForDoctor(ids.author!);
    expect(authored.length).toBeGreaterThan(0);
    expect(authored.length).toBeLessThanOrEqual(6);
    expect(authored.every((a) => a.role === 'author')).toBe(true);
    expect((await getArticlesForDoctor(ids.reviewer!)).every((a) => a.role === 'reviewer')).toBe(
      true,
    );
    expect((await getArticlesForDoctor(both)).map((a) => a.role)).toEqual(['both']);
  });

  it('AT6 a deleted category leaves its article published with no category, and the readers resolve', async () => {
    const doomed = await taxonomy('article-categories', 'دستهٔ حذفی');
    const orphan = await article(12, { category: doomed });
    await payload.delete({ collection: 'article-categories', id: doomed });
    await expect(getPublishedSlugs()).resolves.toHaveProperty('article-categories');
    await expect(getArticleCategories()).resolves.toEqual(expect.any(Array));
    const post = await getArticleBySlug(orphan.slug);
    expect(post?.id).toBe(orphan.id);
    expect(post?.category).toBeNull();
  });

  it('AT7 an author, reviewer or primary service unpublished after review reads as null on the post', async () => {
    const [author, reviewer, primary] = [await dentist(), await dentist(), await service()];
    const post = await article(13, { authorDoctor: author, reviewer, primaryService: primary });
    for (const [collection, id] of [
      ['doctors', author],
      ['doctors', reviewer],
      ['services', primary],
    ] as const) {
      await payload.db.updateOne({ collection, id, data: { _status: 'draft' } });
    }
    const read = await getArticleBySlug(post.slug);
    expect(read?.id).toBe(post.id);
    expect(read?.authorDoctor).toBeNull();
    expect(read?.reviewer).toBeNull();
    expect(read?.primaryService).toBeNull();
  });
});
