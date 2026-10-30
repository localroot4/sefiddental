import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  oldUrlCsv,
  pageProblems,
  parseCsvRows,
  parsePage,
  redirectProblem,
  robotsRules,
  siteProblems,
  sitemapLocs,
  slugProblems,
} from './crawl.mjs';

const ORIGIN = 'https://sefiddental.ir';
const PATH = '/خدمات/لمینت-سرامیکی';
const URL_OF = (path: string) => new URL(path, ORIGIN).href;
const TITLE = 'لمینت سرامیکی در جنوب تهران، مراحل و مراقبت | کلینیک دندانپزشکی سفید';
const SHORT_TITLE = 'لمینت سرامیکی، مراحل و مراقبت | کلینیک دندانپزشکی سفید';
const DESCRIPTION =
  'لمینت سرامیکی در کلینیک دندانپزشکی سفید، خانی‌آباد نو: برای چه کسی مناسب است، چه مراحلی دارد، بعد از آن چه مراقبتی لازم است و چه خطرهایی دارد.';

type Fixture = {
  path?: string;
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  h1?: string;
  graph?: unknown[];
  jsonLd?: string;
  og?: boolean;
  breadcrumbNav?: boolean;
  body?: string;
};

/** A page that passes every rule; each test changes one thing. */
function page(f: Fixture = {}): string {
  const path = f.path ?? PATH;
  const url = URL_OF(path);
  const graph = f.graph ?? [
    { '@type': 'Dentist', '@id': `${ORIGIN}/#dentist`, name: 'کلینیک دندانپزشکی سفید' },
    { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/` },
    ...(path === '/'
      ? []
      : [
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'خانه', item: `${ORIGIN}/` },
              { '@type': 'ListItem', position: 2, name: 'لمینت', item: url },
            ],
          },
        ]),
  ];
  const og =
    (f.og ?? true)
      ? `<meta property="og:title" content="t"/><meta property="og:description" content="d"/>` +
        `<meta property="og:url" content="${f.canonical ?? url}"/>` +
        `<meta property="og:image" content="${ORIGIN}/brand/og/service.png"/>` +
        `<meta property="og:type" content="website"/><meta property="og:locale" content="fa_IR"/>`
      : '';
  return [
    `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charSet="utf-8"/>`,
    `<title>${f.title ?? SHORT_TITLE}</title>`,
    `<meta name="description" content="${f.description ?? DESCRIPTION}"/>`,
    `<meta name="robots" content="${f.robots ?? 'index, follow'}"/>`,
    `<link rel="canonical" href="${f.canonical ?? url}"/>`,
    og,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<script type="application/ld+json">${
      f.jsonLd ?? JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    }</script></head><body>`,
    (f.breadcrumbNav ?? true) ? `<nav aria-label="مسیر صفحه"><ol></ol></nav>` : '',
    `<main>${f.h1 ?? '<h1 class="x">لمینت سرامیکی</h1>'}${f.body ?? ''}</main></body></html>`,
  ].join('');
}

const HOME_BODY =
  '<div data-home-section="hero"><section aria-labelledby="hero-h1"><h1 id="hero-h1">سفید</h1></section></div>' +
  '<div data-home-section="trust"><ul aria-label="حقایق کلینیک"></ul></div>' +
  '<div data-home-section="faq"><h2 id="home-faq-title">پرسش‌ها</h2></div>';

const problems = (f: Fixture, allow: string[] = []) =>
  pageProblems(URL_OF(f.path ?? PATH), page(f), allow);

describe('crawl page rules (T-CR)', () => {
  it('T-CR1 a complete page passes; home passes with its sections', () => {
    expect(problems({})).toEqual([]);
    expect(problems({ path: '/', body: HOME_BODY, h1: '' })).toEqual([]);
    // `https://host` and `https://host/` are one canonical.
    expect(problems({ path: '/', canonical: ORIGIN, body: HOME_BODY, h1: '' })).toEqual([]);
  });

  it('T-CR2 exactly one H1', () => {
    expect(problems({ h1: '' })).toEqual(['0 H1 elements, want 1']);
    expect(problems({ h1: '<h1>a</h1><h1>b</h1>' })).toEqual(['2 H1 elements, want 1']);
  });

  it('T-CR3 title at most 60 and description 120 to 160 code points', () => {
    expect(problems({ title: TITLE })).toEqual([
      expect.stringMatching(/^title is 68 characters, over 60/),
    ]);
    expect(problems({ description: 'کوتاه' })).toEqual([
      'description is 5 characters, want 120 to 160',
    ]);
    // Page 2 of a list: the code adds «، صفحهٔ N» to a title checked without it.
    expect(
      pageProblems(
        `${URL_OF(PATH)}?page=2`,
        page({ title: TITLE, canonical: `${URL_OF(PATH)}?page=2` }),
      ),
    ).toEqual([]);
  });

  it('T-CR4 an indexable page names itself as canonical and og:url', () => {
    const other = URL_OF('/خدمات');
    expect(problems({ canonical: other })).toEqual([
      `canonical is ${other}, want ${URL_OF(PATH)}`,
      `og:url is ${other}, want ${URL_OF(PATH)}`,
    ]);
    // noindex pages may point elsewhere.
    expect(problems({ canonical: other, robots: 'noindex, follow' })).toEqual([]);
  });

  it('T-CR5 OG and Twitter tags', () => {
    expect(problems({ og: false })).toEqual([
      expect.stringMatching(/^og:url is null/),
      'no og:title',
      'no og:description',
      'no og:image',
      'no og:type',
      'no og:locale',
    ]);
  });

  it('T-CR6 JSON-LD parses, passes the graph checks and carries Dentist and WebSite', () => {
    expect(problems({ jsonLd: '{"@context":' })).toEqual([
      expect.stringMatching(/^JSON-LD does not parse/),
      'JSON-LD has no Dentist',
      'JSON-LD has no WebSite',
      'no BreadcrumbList',
    ]);
    const relative = [
      { '@type': 'Dentist', '@id': '/#dentist', name: 'x' },
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website` },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, item: URL_OF(PATH) }],
      },
    ];
    expect(problems({ graph: relative })).toEqual(['JSON-LD: @id is not absolute: /#dentist']);
  });

  it('T-CR7 inner pages carry a breadcrumb trail ending at the page, shown and in JSON-LD', () => {
    expect(problems({ breadcrumbNav: false })).toEqual(['no visible breadcrumb']);
    const graph = [
      { '@type': 'Dentist', '@id': `${ORIGIN}/#dentist` },
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website` },
    ];
    expect(problems({ graph })).toEqual(['no BreadcrumbList']);
    const wrong = [
      ...graph,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, item: `${ORIGIN}/` }],
      },
    ];
    expect(problems({ graph: wrong })).toEqual([
      `the last breadcrumb is ${ORIGIN}/, want ${URL_OF(PATH)}`,
    ]);
  });

  it('T-CR8 every home section has its heading in the server HTML', () => {
    const body = `${HOME_BODY}<div data-home-section="journey"><p>بدون عنوان</p></div>`;
    expect(problems({ path: '/', body, h1: '' })).toEqual([
      'home section "journey" has no heading in the server HTML',
    ]);
    expect(problems({ path: '/', body: '', h1: '<h1>سفید</h1>' })).toEqual([
      'home renders no data-home-section',
    ]);
    expect(problems({ body: '<form aria-labelledby="gone"></form>' })).toEqual([
      'aria-labelledby="gone" names no element in the server HTML',
    ]);
  });

  it('T-CR9 no placeholder text; the demo and QA words only where the run allows them', () => {
    expect(problems({ body: '[[NEEDS_CLIENT: phone]]' })).toEqual(['shows NEEDS_CLIENT']);
    expect(problems({ body: 'دکتر فرضی ۱' })).toEqual(['shows «فرضی»']);
    expect(problems({ body: 'طرح نمایشی' })).toEqual(['shows «طرح نمایشی»']);
    expect(problems({ body: 'دکتر فرضی ۱، طرح نمایشی' }, ['demo'])).toEqual([]);
    for (const marker of ['نمونهٔ آزمایشی', 'نمونه آزمایشی', 'نمونه‌ی آزمایشی']) {
      expect(problems({ body: marker })).toEqual(['shows «نمونهٔ آزمایشی»']);
      expect(problems({ body: marker }, ['qa'])).toEqual([]);
    }
    // «نمونه» alone is ordinary Persian (the orthodontics copy).
    expect(problems({ body: 'برای نمونه، دندان‌های جلو' })).toEqual([]);
  });

  it('T-CR10 parsePage decodes entities in the title and reads the links', () => {
    const parsed = parsePage(
      page({
        title: 'A &amp; B &#x27;C&#39;',
        body: '<a class="x" href="/%D8%A2%D8%AF%D8%B1%D8%B3">a</a>',
      }),
    );
    expect(parsed.title).toBe("A & B 'C'");
    expect(parsed.links).toEqual(['/%D8%A2%D8%AF%D8%B1%D8%B3']);
  });
});

describe('crawl site rules (T-CR)', () => {
  const ok = (path: string, f: Fixture = {}) => ({
    status: 200,
    page: parsePage(
      page({ path, title: `${path}${SHORT_TITLE}`, description: `${path}${DESCRIPTION}`, ...f }),
    ),
  });
  const site = (
    pages: Array<[string, ReturnType<typeof ok> | { status: number; page: null }]>,
    sitemap: string[],
    links: Array<[string, string]>,
    extra: { disallow?: string[]; allow?: string[] } = {},
  ) => {
    const inlinks = new Map<string, Set<string>>();
    for (const [from, to] of links) inlinks.set(to, new Set([...(inlinks.get(to) ?? []), from]));
    return siteProblems({
      pages: new Map(pages),
      sitemap: new Set(sitemap),
      rules: { disallow: extra.disallow ?? [], sitemaps: [] },
      inlinks,
      allow: extra.allow ?? [],
    });
  };

  it('T-CR11 a linked, indexed site passes', () => {
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH)],
        ],
        ['/', PATH],
        [
          ['/', PATH],
          [PATH, '/'],
        ],
      ),
    ).toEqual([]);
  });

  it('T-CR12 titles and descriptions are unique among indexable pages', () => {
    const same = { title: SHORT_TITLE, description: DESCRIPTION };
    expect(
      site(
        [
          ['/', ok('/', same)],
          [PATH, ok(PATH, same)],
          ['/آدرس', ok('/آدرس', { ...same, robots: 'noindex' })],
        ],
        ['/', PATH],
        [
          ['/', PATH],
          ['/', '/آدرس'],
        ],
      ),
    ).toEqual([`${PATH}: same title as /`, `${PATH}: same description as /`]);
    // The QA fixture's rows share one description on purpose, under --qa only.
    const fixture = '/مقالات/نمونه-آزمایشی-مقاله-۱';
    const pages: Parameters<typeof site>[0] = [
      ['/', ok('/', same)],
      [fixture, ok(fixture, same)],
    ];
    expect(site(pages, ['/', fixture], [['/', fixture]], { allow: ['qa'] })).toEqual([]);
    expect(site(pages, ['/', fixture], [['/', fixture]])).toHaveLength(2);
  });

  it('T-CR13 sitemap, robots.txt and meta robots agree', () => {
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH)],
        ],
        ['/'],
        [['/', PATH]],
      ),
    ).toEqual([`${PATH}: indexable but not in the sitemap`]);
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH)],
        ],
        ['/', PATH],
        [['/', PATH]],
        { disallow: ['/خدمات'] },
      ),
    ).toEqual([
      `${PATH}: indexable but disallowed in robots.txt`,
      `${PATH}: in the sitemap and disallowed in robots.txt`,
    ]);
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH, { robots: 'noindex, follow' })],
        ],
        ['/', PATH],
        [['/', PATH]],
      ),
    ).toEqual([`${PATH}: in the sitemap, noindex`]);
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, { status: 404, page: null }],
        ],
        ['/', PATH],
        [['/', PATH]],
      ),
    ).toEqual([`${PATH}: in the sitemap, answers 404`]);
    // Page 2 of a list stays out of the sitemap and repeats its description.
    const second = `${PATH}?page=2`;
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH)],
          [second, ok(PATH, { title: 'دوم' })],
        ],
        ['/', PATH],
        [
          ['/', PATH],
          [PATH, second],
        ],
      ),
    ).toEqual([]);
  });

  it('T-CR14 no orphan page', () => {
    expect(
      site(
        [
          ['/', ok('/')],
          [PATH, ok(PATH)],
        ],
        ['/', PATH],
        [[PATH, PATH]],
      ),
    ).toEqual([`${PATH}: orphan (no internal link points to it)`]);
  });

  it('T-CR15 sitemap URLs have clean Persian slugs', () => {
    expect(slugProblems('/خدمات/لمینت-سرامیکی')).toEqual([]);
    expect(slugProblems('/مقالات/نمونه-آزمایشی-مقاله-۱۲')).toEqual([]);
    expect(slugProblems('/services/veneer')).toEqual([
      'slug "services" is not Persian letters, digits and hyphens',
      'slug "veneer" is not Persian letters, digits and hyphens',
    ]);
    expect(slugProblems('/خدمات/لمينت')).toEqual(['slug "لمينت" has an Arabic ي or ك']);
    expect(slugProblems('/خدمات/لمینت--سرامیکی')).toEqual([
      'slug "لمینت--سرامیکی" has a stray hyphen',
    ]);
    const bad = '/Services';
    expect(
      site(
        [
          ['/', ok('/')],
          [bad, ok(bad)],
        ],
        ['/', bad],
        [['/', bad]],
      ),
    ).toEqual([`${bad}: slug "Services" is not Persian letters, digits and hyphens`]);
  });
});

describe('crawl inputs and old URLs (T-CR)', () => {
  it('T-CR16 sitemap index and urlset locations, entities and CDATA decoded', () => {
    const index =
      '<?xml version="1.0"?><sitemapindex xmlns="x"><sitemap><loc>https://a.ir/s1.xml</loc></sitemap>' +
      '<sitemap><loc><![CDATA[https://a.ir/s2.xml]]></loc></sitemap></sitemapindex>';
    expect(sitemapLocs(index)).toEqual({
      kind: 'index',
      locs: ['https://a.ir/s1.xml', 'https://a.ir/s2.xml'],
    });
    const urlset = '<urlset xmlns="x"><url><loc> https://a.ir/?p=1&amp;q=2 </loc></url></urlset>';
    expect(sitemapLocs(urlset)).toEqual({ kind: 'urlset', locs: ['https://a.ir/?p=1&q=2'] });
    expect(sitemapLocs('<html></html>').kind).toBeNull();
  });

  it('T-CR17 robots.txt: the * group and the Sitemap lines', () => {
    const rules = robotsRules(
      'User-agent: Googlebot\nDisallow: /x\n\nUser-agent: bingbot\nUser-agent: *\nDisallow: /giris\nDisallow: /api/ # comment\nAllow: /\n\nSitemap: https://a.ir/sitemap.xml\n',
    );
    expect(rules).toEqual({
      disallow: ['/giris', '/api/'],
      sitemaps: ['https://a.ir/sitemap.xml'],
    });
  });

  it('T-CR18 the old-site sitemap becomes the import CSV, one path per row', () => {
    expect(
      oldUrlCsv([
        'https://sefiddental.ir/%D9%84%D9%85%DB%8C%D9%86%D8%AA/',
        'https://sefiddental.ir/?p=12',
        'https://sefiddental.ir/',
        'https://sefiddental.ir/%D9%84%D9%85%DB%8C%D9%86%D8%AA/',
        'https://sefiddental.ir/a,b',
      ]),
    ).toBe('from,to,status\n/?p=12,,\n"/a,b",,\n/لمینت/,,\n');
  });

  it('T-CR19 the import CSV parses as the admin import reads it', () => {
    const rows = parseCsvRows(readFileSync('tests/fixtures/old-urls.csv', 'utf8'));
    expect(rows[0]).toEqual(['/قدیمی/صفحه-اول', '/خدمات']);
    expect(rows).toContainEqual(['/old/quoted,comma', '/خدمات']);
    expect(rows).toContainEqual(['/old/gone-fa', '', '۴۱۰']);
    expect(parseCsvRows('from;to\r\n/a;/b\r\n\r\n')).toEqual([['/a', '/b']]);
  });

  it('T-CR20 an old URL answers its 301 to its target, or its 410', () => {
    const at = (status: number, location: string | null = null) => ({ status, location });
    const row = ['/قدیمی', '/خدمات'];
    expect(redirectProblem(row, at(301, encodeURI('/خدمات')), ORIGIN)).toBeNull();
    expect(redirectProblem(row, at(301, URL_OF('/خدمات')), ORIGIN)).toBeNull();
    expect(redirectProblem(row, at(404), ORIGIN)).toBe('/قدیمی: answers 404, want 301');
    expect(redirectProblem(row, at(301, '/'), ORIGIN)).toBe(
      `/قدیمی: redirects to ${ORIGIN}/, want ${ORIGIN}/خدمات`,
    );
    expect(redirectProblem(['/old', '', '۴۱۰'], at(410), ORIGIN)).toBeNull();
    expect(redirectProblem(['/old', '/خدمات', '302'], at(301, '/خدمات'), ORIGIN)).toBe(
      '/old: answers 301, want 302',
    );
    const vip = ['/vip', '/خدمات/ترمیم-دندان#سطح-ترمیم'];
    expect(redirectProblem(vip, at(301, encodeURI(vip[1]!)), ORIGIN)).toBeNull();
  });
});
