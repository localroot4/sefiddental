import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getArticleCategories, getDoctors, getRelatedArticles } from '@/lib/data/content';
import type { PublishedArticle } from '@/lib/data/content';
import { stubSiteEnv } from '@/lib/http/testEnv';
import type { Media } from '@/payload-types';
import { lexicalFrom } from '@/seed/transforms';

import { Article } from './Article';
import { ArticlesHub } from './ArticlesHub';

// The share image helper's module reads the globals and the catalogue; never called here.
vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getSeoDefaults: vi.fn() }));
vi.mock('@/lib/data/catalog', () => ({ getServiceTree: vi.fn() }));
// parts.tsx (Band) holds the booking block too; a post never renders it.
vi.mock('@/components/booking/BookingForm', () => ({ BookingForm: () => null }));
vi.mock('@/lib/data/content', () => ({
  getArticleCategories: vi.fn(),
  getArticlesPage: vi.fn(),
  getDoctors: vi.fn(),
  getRelatedArticles: vi.fn(),
}));

const COVER = {
  id: 1,
  alt: 'نمای نزدیک لبخند',
  url: '/api/media/file/cover.jpg',
  width: 1600,
  height: 900,
  sizes: { w960: { url: '/api/media/file/cover-960.webp', width: 960, height: 540 } },
} as unknown as Media;

const card = (id: number) => ({
  id,
  title: `مقالهٔ شمارهٔ ${'یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده'.split(' ')[id - 1]}`,
  slug: `مقاله-${id}`,
  excerpt: 'خلاصهٔ کوتاه مقاله.',
  cover: COVER,
  publishedAt: `2026-09-${String(id + 10)}T08:00:00.000Z`,
  contentUpdatedAt: null,
  readingTime: 3,
});
const page = (n: number, docs = Array.from({ length: 12 }, (_, i) => card(i + 1))) => ({
  docs,
  page: n,
  totalPages: 2,
  totalDocs: 14,
});

const DENTIST = { id: 9, name: 'نمونه', slug: 'دکتر-نمونه', _status: 'published', photo: 3 };
const SERVICE = {
  id: 5,
  key: 'restoration',
  navLabel: 'ترمیم دندان',
  slug: 'ترمیم-دندان',
  summary: 'یک جملهٔ کوتاه.',
  _status: 'published',
};

function post(extra: Partial<PublishedArticle> = {}): PublishedArticle {
  const body = lexicalFrom(
    '## بخش اول\nبرای جزئیات [ترمیم دندان](/خدمات/ترمیم-دندان) را ببینید.\n\n## بخش دوم\nپایان.',
    () => ({ relationTo: 'services', value: SERVICE as never }),
  );
  return {
    id: 20,
    title: 'ترمیم یا روکش',
    slug: 'ترمیم-یا-روکش',
    excerpt: 'خلاصهٔ مقاله.',
    cover: COVER,
    body,
    category: { id: 4, title: 'ترمیم و زیبایی', slug: 'ترمیم-و-زیبایی' },
    tags: [{ id: 6, title: 'روکش', slug: 'روکش' }],
    primaryService: SERVICE,
    authorDoctor: DENTIST,
    staffAuthorName: null,
    isMedical: true,
    reviewer: DENTIST,
    reviewedAt: '2026-10-10T08:30:00.000Z',
    sources: [{ title: 'Restorations', publisher: 'ADA', url: 'https://www.ada.org/resources' }],
    faqs: [{ question: 'چقدر دوام دارد؟', answer: 'بسته به مراقبت.' }],
    readingTime: 4,
    publishedAt: '2026-10-14T06:00:00.000Z',
    contentUpdatedAt: '2026-10-16T06:00:00.000Z',
    reviewState: 'approved',
    seo: { description: 'توضیح جست‌وجو.' },
    updatedAt: '2026-10-16T06:00:00.000Z',
    createdAt: '2026-10-01T06:00:00.000Z',
    _status: 'published',
    ...extra,
  } as unknown as PublishedArticle;
}

const graphOf = (markup: string) =>
  [...markup.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap(
    (m) => (JSON.parse(m[1]!) as { '@graph': Array<Record<string, unknown>> })['@graph'],
  );

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  stubSiteEnv(); // canonical and JSON-LD URLs read SITE_URL
  vi.mocked(getArticleCategories).mockResolvedValue([
    { id: 4, title: 'ترمیم و زیبایی', slug: 'ترمیم-و-زیبایی' },
  ] as never);
  vi.mocked(getDoctors).mockResolvedValue([{ ...DENTIST, photo: COVER, services: [] }] as never);
  vi.mocked(getRelatedArticles).mockResolvedValue([card(1), card(2)] as never);
});

describe('article templates (T-articles, T-article)', () => {
  it('AH1 hub page 1: one H1, the featured card and 11 more, chips, page 2 link, no booking', async () => {
    const markup = renderToStaticMarkup(
      await ArticlesHub({ path: '/مقالات', title: 'مقالات', current: 'all', list: page(1) }),
    );
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('data-page-type="articles"');
    expect(markup.match(/data-featured=""/g)).toHaveLength(1);
    expect(markup.match(/<article/g)).toHaveLength(12);
    // Only the featured cover loads eagerly (the hub's LCP).
    expect(markup.match(/loading="eager"/g)).toHaveLength(1);
    expect(markup).toContain('href="/مقالات?page=2"');
    expect(markup).toMatch(/aria-current="page"[^>]*>همه</);
    expect(markup).not.toContain('data-booking-form');
    const list = graphOf(markup).find((n) => n['@type'] === 'ItemList');
    expect(list?.itemListElement).toHaveLength(12);
  });

  it('AH2 page 2 and a category: no featured card; the category chip is current', async () => {
    const second = renderToStaticMarkup(
      await ArticlesHub({ path: '/مقالات', title: 'مقالات', current: 'all', list: page(2) }),
    );
    expect(second).not.toContain('data-featured');
    const category = renderToStaticMarkup(
      await ArticlesHub({
        path: '/مقالات/دسته/ترمیم-و-زیبایی',
        title: 'ترمیم و زیبایی',
        label: 'دسته',
        current: 4,
        list: page(1),
      }),
    );
    expect(category).not.toContain('data-featured');
    expect(category).toMatch(/aria-current="page"[^>]*>ترمیم و زیبایی</);
    const crumbs = graphOf(category).find((n) => n['@type'] === 'BreadcrumbList');
    expect((crumbs?.itemListElement as Array<{ name: string }>).map((c) => c.name)).toEqual([
      'خانه',
      'مقالات',
      'ترمیم و زیبایی',
    ]);
  });

  it('AH3 post: eager cover, Jalali dates, TOC with FAQ and sources, people, share, one CTA, related', async () => {
    const markup = renderToStaticMarkup(await Article({ article: post() }));
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('data-page-type="article"');
    expect(markup).toMatch(/<img[^>]*loading="eager"[^>]*fetchPriority="high"/i);
    expect(markup).toContain('<time dateTime="2026-10-16T06:00:00.000Z">');
    for (const id of ['بخش-اول', 'بخش-دوم', 'faq', 'sources']) {
      expect(markup, id).toContain(`href="#${id}"`);
      expect(markup, id).toContain(`id="${id}"`);
    }
    // Author and reviewer boxes link the dentist; the review day is Jalali.
    expect(markup.match(/href="\/پزشکان\/دکتر-نمونه"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(markup).toContain('۱۸ مهر ۱۴۰۵');
    expect(markup).toContain('href="/مقالات/برچسب/روکش"');
    expect(markup).toContain('https://t.me/share/url?url=');
    expect(markup.match(/href="\/رزرو-نوبت[^"]*"/g)).toEqual([
      'href="/رزرو-نوبت?service=restoration"',
    ]);
    expect(markup).toContain('data-section="related"');
    expect(markup.match(/href="\/مقالات\/مقاله-\d"/g)).toHaveLength(2);
    expect(markup).not.toMatch(/\sstyle="/);
    const graph = graphOf(markup);
    const article = graph.find((n) => n['@type'] === 'Article');
    expect(article?.dateModified).toBe('2026-10-16T06:00:00.000Z');
    expect(article?.author).toMatchObject({ name: 'دکتر نمونه' });
    expect(graph.find((n) => n['@type'] === 'MedicalWebPage')).toBeDefined();
    expect(graph.find((n) => n['@type'] === 'FAQPage')).toBeDefined();
  });

  it('AH4 a non-medical post with a staff author and no service: WebPage, the pricing CTA, no related', async () => {
    vi.mocked(getRelatedArticles).mockResolvedValue([]);
    const markup = renderToStaticMarkup(
      await Article({
        article: post({
          isMedical: false,
          primaryService: null,
          authorDoctor: null,
          staffAuthorName: 'سارا رضایی',
          faqs: [],
        }),
      }),
    );
    expect(markup.match(/href="\/رزرو-نوبت[^"]*"/g)).toEqual(['href="/رزرو-نوبت"']);
    expect(markup).toContain('href="/هزینه-و-پرداخت"');
    expect(markup).toContain('سارا رضایی');
    expect(markup).not.toContain('data-section="related"');
    expect(markup).not.toContain('href="#faq"');
    // C3: a post without FAQs still has its TOC: the two H2s and the sources.
    for (const id of ['بخش-اول', 'بخش-دوم', 'sources']) {
      expect(markup, id).toContain(`href="#${id}"`);
      expect(markup, id).toContain(`id="${id}"`);
    }
    const graph = graphOf(markup);
    expect(graph.find((n) => n['@type'] === 'WebPage')).toBeDefined();
    expect(graph.find((n) => n['@type'] === 'Article')?.author).toEqual({
      '@type': 'Person',
      name: 'سارا رضایی',
    });
  });
});
