import sax from 'sax';
import { describe, expect, it } from 'vitest';

import { rssXml, sitemapIndexXml, urlsetXml, xmlEscape } from '@/lib/seo/xml';

/** Strict parse with sax; returns the element names in document order. */
function parseStrict(xml: string): string[] {
  const parser = sax.parser(true);
  const names: string[] = [];
  let error: Error | null = null;
  parser.onerror = (e) => {
    error = e;
  };
  parser.onopentag = (node) => void names.push(node.name);
  parser.write(xml).close();
  if (error) throw error;
  return names;
}

describe('XML builders (spec 9.4, 9.6)', () => {
  it('XM1 escapes the five special characters', () => {
    expect(xmlEscape(`a&b<c>d'e"f`)).toBe('a&amp;b&lt;c&gt;d&apos;e&quot;f');
  });

  it('XM2 urlset: loc, ISO lastmod in UTC, no changefreq or priority, strict XML', () => {
    const xml = urlsetXml([
      {
        loc: 'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA?a=1&b=2',
        lastmod: '2026-10-13T12:00:00+03:30',
      },
      { loc: 'https://sefiddental.ir/', lastmod: null },
    ]);
    expect(xml).toContain(
      '<loc>https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA?a=1&amp;b=2</loc>',
    );
    expect(xml).toContain('<lastmod>2026-10-13T08:30:00.000Z</lastmod>');
    expect(xml).not.toContain('changefreq');
    expect(parseStrict(xml)).toEqual(['urlset', 'url', 'loc', 'lastmod', 'url', 'loc']);
  });

  it('XM3 empty urlset is valid (indexing off)', () => {
    expect(parseStrict(urlsetXml([]))).toEqual(['urlset']);
  });

  it('XM4 sitemap index lists the children', () => {
    const xml = sitemapIndexXml(
      ['pages', 'services', 'doctors', 'articles'].map((n) => ({
        loc: `https://sefiddental.ir/sitemaps/${n}.xml`,
        lastmod: new Date('2026-10-13T08:30:00Z'),
      })),
    );
    expect(parseStrict(xml).filter((n) => n === 'sitemap')).toHaveLength(4);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('XM5 RSS 2.0 channel with atom self link, RFC 822 dates, escaped text, zero items valid', () => {
    const channel = {
      title: 'مقالات کلینیک دندانپزشکی سفید',
      link: 'https://sefiddental.ir/%D9%85%D9%82%D8%A7%D9%84%D8%A7%D8%AA',
      description: 'مقالات سلامت دهان و دندان',
      selfUrl: 'https://sefiddental.ir/rss.xml',
      lastBuildDate: new Date('2026-10-13T08:30:00Z'),
    };
    const empty = rssXml(channel, []);
    expect(parseStrict(empty)).toEqual([
      'rss',
      'channel',
      'title',
      'link',
      'description',
      'language',
      'atom:link',
      'lastBuildDate',
    ]);
    const xml = rssXml(channel, [
      {
        title: 'A & B <test>',
        link: 'https://sefiddental.ir/x',
        pubDate: '2026-10-13T08:30:00Z',
        description: 'خلاصه',
      },
    ]);
    expect(xml).toContain('<pubDate>Tue, 13 Oct 2026 08:30:00 GMT</pubDate>');
    expect(xml).toContain('<title>A &amp; B &lt;test&gt;</title>');
    expect(xml).toContain('<guid isPermaLink="true">https://sefiddental.ir/x</guid>');
    expect(xml).toContain('<language>fa-IR</language>');
    expect(parseStrict(xml)).toContain('item');
  });

  it('XM6 characters XML forbids are dropped, so the document still parses', () => {
    const xml = urlsetXml([{ loc: 'https://sefiddental.ir/a\u0001b￿' }]);
    expect(xml).toContain('<loc>https://sefiddental.ir/ab</loc>');
    expect(() => parseStrict(xml)).not.toThrow();
  });
});
