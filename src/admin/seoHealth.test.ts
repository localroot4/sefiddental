import { describe, expect, it, vi } from 'vitest';

import { ADMIN_ROUTE } from '@/lib/paths';

import { loadSeoHealth, seoProblems, seoSpecOf, type SeoSpec } from './seoHealth';

// The collection configs read the environment while their modules load.
vi.stubEnv('DATABASE_URL', 'file:./.data/test.db');
vi.stubEnv('PAYLOAD_SECRET', 'p'.repeat(43));
const { collections } = await import('@/collections');
const fieldsOf = (slug: string) => collections.find((c) => c.slug === slug)?.fields ?? [];

const TITLE: SeoSpec = { topic: ['{title}'], suffix: 'titleSuffix' };
const H1: SeoSpec = { topic: ['{h1}'], suffix: 'titleSuffix' };
const LONG = 'عنوانی بسیار بلند برای یک صفحهٔ آزمایشی که از شصت نویسه می‌گذرد';
const DESCRIPTION = 'ت'.repeat(140);
const published = new Set(['7']);

describe('SEO health (H23, H33)', () => {
  it('SH1 each collection’s title templates and suffix come from its own SEO group', () => {
    expect(seoSpecOf(fieldsOf('articles'))).toEqual(TITLE);
    expect(seoSpecOf(fieldsOf('services'))).toEqual(H1);
    expect(seoSpecOf(fieldsOf('doctors')).suffix).toBe('shortTitleSuffix');
  });

  it('SH2 a title Google cuts, from the topic when the SEO title is empty', () => {
    expect(seoProblems('pages', { title: LONG }, TITLE, published)).toEqual(['title']);
    expect(
      seoProblems('pages', { title: LONG, seo: { title: 'کوتاه' } }, TITLE, published),
    ).toEqual([]);
  });

  it('SH3 a description out of range; missing only on articles, where it is required', () => {
    const article = { title: 'مقاله', reviewer: 7, seo: {} };
    expect(seoProblems('articles', article, TITLE, published)).toEqual(['description']);
    expect(seoProblems('services', { h1: 'خدمت' }, H1, published)).toEqual([]);
    expect(
      seoProblems('services', { h1: 'خدمت', seo: { description: 'کوتاه' } }, H1, published),
    ).toEqual(['description']);
  });

  it('SH4 an article whose author or reviewer dentist is no longer published', () => {
    const ok = {
      title: 'مقاله',
      reviewer: 7,
      staffAuthorName: 'پذیرش',
      seo: { description: DESCRIPTION },
    };
    expect(seoProblems('articles', ok, TITLE, published)).toEqual([]);
    expect(seoProblems('articles', { ...ok, reviewer: 8 }, TITLE, published)).toEqual(['byline']);
    expect(seoProblems('articles', { ...ok, authorDoctor: { id: 9 } }, TITLE, published)).toEqual([
      'byline',
    ]);
  });

  it('SH5 a page kept out of Google is not checked', () => {
    expect(seoProblems('pages', { title: LONG, seo: { noindex: true } }, TITLE, published)).toEqual(
      [],
    );
  });

  it('SH6 the loader checks only published documents of the viewer’s collections', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const rows: Record<string, unknown[]> = {
      articles: [
        { id: 1, title: 'بی‌توضیح', reviewer: 7, seo: {} },
        { id: 2, title: 'بازبین رفته', reviewer: 8, seo: { description: DESCRIPTION } },
      ],
      doctors: [{ id: 7 }],
    };
    const payload = {
      collections: Object.fromEntries(
        collections.map((c) => [
          c.slug,
          { config: { ...c, versions: { drafts: Boolean(c.versions) } } },
        ]),
      ),
      find: async (args: Record<string, unknown>) => {
        calls.push(args);
        return { docs: rows[args.collection as string] ?? [] };
      },
    };
    const report = await loadSeoHealth(payload as never, ['bookings', 'articles', 'tags', 'media']);
    expect(calls.map((c) => c.collection)).toEqual(['articles', 'doctors']);
    expect(calls[0]).toMatchObject({ where: { _status: { equals: 'published' } } });
    expect(calls[1]).toMatchObject({
      where: { and: [{ id: { in: ['7', '8'] } }, { _status: { equals: 'published' } }] },
    });
    expect(report).toEqual({
      title: [],
      description: [
        {
          collection: 'articles',
          id: 1,
          title: 'بی‌توضیح',
          href: `${ADMIN_ROUTE}/collections/articles/1`,
        },
      ],
      byline: [
        {
          collection: 'articles',
          id: 2,
          title: 'بازبین رفته',
          href: `${ADMIN_ROUTE}/collections/articles/2`,
        },
      ],
    });
  });
});
