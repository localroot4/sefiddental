/*
 * XML builders for the sitemap index, the per-collection sitemaps (spec 9.4) and the RSS stub
 * (spec 9.6). Pure: the routes of wave 2 feed them published rows.
 */

/** Escapes the five XML special characters (&, <, >, ', "). */
export function xmlEscape(text: string): string {
  return text.replace(/[&<>'"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === "'" ? '&apos;' : '&quot;',
  );
}

/** Drops characters XML 1.0 does not allow: C0 controls except tab, LF, CR; lone surrogates; U+FFFE/F. */
function xmlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    const control = c < 32 && c !== 9 && c !== 10 && c !== 13;
    const surrogate = c >= 0xd800 && c <= 0xdfff;
    if (!control && !surrogate && c !== 0xfffe && c !== 0xffff) out += ch;
  }
  return out;
}
const text = (value: string) => xmlEscape(xmlChars(value));

export interface SitemapEntry {
  /** Absolute URL (absoluteUrl()). */
  loc: string;
  /** Any Date-parsable value; written as ISO 8601 UTC. */
  lastmod?: string | Date | null;
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

function lastmod(value: SitemapEntry['lastmod']): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `<lastmod>${date.toISOString()}</lastmod>`;
}

/** `<urlset>`; no changefreq or priority. An empty list is valid (indexing off, no rows). */
export function urlsetXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((e) => `<url><loc>${text(e.loc)}</loc>${lastmod(e.lastmod)}</url>`)
    .join('');
  return `${XML_DECL}<urlset xmlns="${SITEMAP_NS}">${urls}</urlset>\n`;
}

/** `<sitemapindex>` of the child sitemaps. */
export function sitemapIndexXml(entries: readonly SitemapEntry[]): string {
  const items = entries
    .map((e) => `<sitemap><loc>${text(e.loc)}</loc>${lastmod(e.lastmod)}</sitemap>`)
    .join('');
  return `${XML_DECL}<sitemapindex xmlns="${SITEMAP_NS}">${items}</sitemapindex>\n`;
}

export const SITEMAP_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
  'X-Robots-Tag': 'noindex',
};

export interface RssChannel {
  title: string;
  /** Absolute URL of the articles hub. */
  link: string;
  description: string;
  /** Absolute URL of the feed itself (atom:link rel="self"). */
  selfUrl: string;
  lastBuildDate: Date;
}

export interface RssItem {
  title: string;
  /** Absolute URL; also the permalink guid. */
  link: string;
  description?: string | null;
  pubDate: string | Date;
}

/** RSS 2.0 with atom:link self; `pubDate` in RFC 822 form (toUTCString). Zero items is valid. */
export function rssXml(channel: RssChannel, items: readonly RssItem[]): string {
  const rfc822 = (d: string | Date) => (d instanceof Date ? d : new Date(d)).toUTCString();
  const body = items
    .map(
      (item) =>
        `<item><title>${text(item.title)}</title><link>${text(item.link)}</link>` +
        `<guid isPermaLink="true">${text(item.link)}</guid><pubDate>${rfc822(item.pubDate)}</pubDate>` +
        (item.description ? `<description>${text(item.description)}</description>` : '') +
        '</item>',
    )
    .join('');
  return (
    `${XML_DECL}<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>` +
    `<title>${text(channel.title)}</title><link>${text(channel.link)}</link>` +
    `<description>${text(channel.description)}</description><language>fa-IR</language>` +
    `<atom:link href="${text(channel.selfUrl)}" rel="self" type="application/rss+xml"/>` +
    `<lastBuildDate>${channel.lastBuildDate.toUTCString()}</lastBuildDate>${body}</channel></rss>\n`
  );
}

export const RSS_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};
