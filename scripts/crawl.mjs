// Crawl audit of the public site (phase 9 SEO-RTL, docs/qa/audit-seo.md): plain fetch, no
// JavaScript, the HTML a search engine reads first. It starts from /sitemap.xml and home, follows
// every internal link and checks each page and the site as a whole. Start the server with
// ALLOW_INDEXING=true (staging is noindex everywhere and lists no sitemap URL):
//   node scripts/crawl.mjs http://localhost:3000
//   node scripts/crawl.mjs http://localhost:3000 --old-urls old-urls.csv   (after the import)
//   node scripts/crawl.mjs http://localhost:3000 --demo   (DEMO_CONTENT preview: «فرضی» allowed)
//   node scripts/crawl.mjs http://localhost:3000 --qa     (the e2e database: QA fixture marker)
// The old-URL list of the old site (gap 11), as the CSV the admin import reads:
//   node scripts/crawl.mjs --old-sitemap https://sefiddental.ir/sitemap.xml > old-urls.csv
// Exit 0 with no problem, 1 otherwise; warnings print and never fail.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { graphProblems } from '../tests/helpers/jsonld.ts';

// docs/seo/plan.md section 3 and src/fields/validators.ts (code points after NFC).
export const TITLE = { min: 50, max: 60 };
export const DESCRIPTION = { min: 120, max: 160 };
const BREADCRUMB_LABEL = 'مسیر صفحه';
const OG = ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:locale'];
/** Paths the crawl never follows: the admin, APIs and build assets. */
const SKIP = /^\/(giris|api|_next|brand|media)(\/|$)/;

const length = (value) => [...value.normalize('NFC')].length;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** HTML and XML character references to text. */
export const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, ref) => {
    if (ref[0] !== '#') return ENTITIES[ref.toLowerCase()] ?? all;
    const code =
      ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
    return String.fromCodePoint(code);
  });

const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k.toLowerCase(), decode(v)]),
  );

/**
 * Placeholder text that must never reach a visitor. «نمونه» alone is ordinary Persian («برای
 * نمونه» in the orthodontics copy): the QA fixture marks its rows «نمونهٔ آزمایشی». The demo words
 * belong to the DEMO_CONTENT preview, which the live site refuses (src/lib/env.ts).
 */
export const PLACEHOLDERS = [
  { label: 'NEEDS_CLIENT', pattern: /NEEDS_CLIENT/ },
  { label: '«فرضی»', pattern: /فرضی/, allow: 'demo' },
  { label: '«طرح نمایشی»', pattern: /طرح[\s‌]*نمایشی/, allow: 'demo' },
  { label: '«نمونهٔ آزمایشی»', pattern: /نمونه[ٔۀ‌\s]*(ی[‌\s]*)?آزمایشی/, allow: 'qa' },
];

/** The slug part of every QA fixture row (tests/fixtures/qa-seed.ts). */
const QA_SLUG = 'نمونه-آزمایشی';

/** What a crawler reads from one HTML document. */
export function parsePage(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => attrs(m[0]));
  const meta = (key) => metas.find((m) => m.name === key || m.property === key)?.content ?? null;
  const canonical = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => attrs(m[0]))
    .find((a) => a.rel === 'canonical');
  const title = /<title>([^<]*)<\/title>/.exec(html);
  return {
    title: title ? decode(title[1]).trim() : null,
    description: meta('description'),
    robots: meta('robots'),
    canonical: canonical?.href ?? null,
    og: Object.fromEntries(OG.map((key) => [key, meta(key)])),
    twitterCard: meta('twitter:card'),
    h1: (html.match(/<h1[\s>]/g) ?? []).length,
    links: [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => decode(m[1])),
    jsonLd: [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => m[1]),
    breadcrumbNav: html.includes(`<nav aria-label="${BREADCRUMB_LABEL}"`),
    homeSections: html
      .split(/(?=<div\b[^>]*\bdata-home-section=")/)
      .slice(1)
      .map((block) => ({
        name: /data-home-section="([^"]+)"/.exec(block)[1],
        // A heading, or a list that names itself (the trust facts band has no heading).
        named: /<h[12][\s>]|<(ul|ol|section)\b[^>]*\baria-label="/.test(block),
      })),
    labelledBy: [...html.matchAll(/\baria-labelledby="([^"]+)"/g)].flatMap((m) =>
      m[1].split(/\s+/),
    ),
    ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
  };
}

/** Equal URLs after parsing: `http://host` and `http://host/` are one URL. */
const sameUrl = (a, b) => {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
};

const indexable = (page) => !/noindex/i.test(page.robots ?? '');

/** A Persian slug: Persian letters, digits and ZWNJ in words joined by single hyphens. */
export function slugProblems(pathname) {
  const problems = [];
  for (const segment of pathname.split('/').filter(Boolean)) {
    if (!/^[ء-غف-يپچژکگی۰-۹0-9‌-]+$/.test(segment)) {
      problems.push(`slug "${segment}" is not Persian letters, digits and hyphens`);
    } else if (/[يك]/.test(segment)) {
      problems.push(`slug "${segment}" has an Arabic ي or ك`);
    } else if (/^-|-$|--/.test(segment)) {
      problems.push(`slug "${segment}" has a stray hyphen`);
    }
  }
  return problems;
}

/**
 * Problems of one page (decoded path) as lines. `url` is its absolute URL on the crawled origin;
 * `allow` the placeholder groups the run accepts ('demo', 'qa').
 * @param {string} url
 * @param {string} html
 * @param {string[]} [allow]
 * @returns {string[]}
 */
export function pageProblems(url, html, allow = []) {
  const page = parsePage(html);
  const out = [];
  const pathname = decodeURI(new URL(url).pathname);
  // Page 2 and up of an article list: the code adds «، صفحهٔ N» to a title checked without it.
  const paginated = new URL(url).searchParams.has('page');
  if (page.h1 !== 1) out.push(`${page.h1} H1 elements, want 1`);
  if (!page.title) out.push('no <title>');
  else if (length(page.title) > TITLE.max && !paginated) {
    out.push(`title is ${length(page.title)} characters, over ${TITLE.max}: ${page.title}`);
  }
  if (!page.description) out.push('no meta description');
  else {
    const n = length(page.description);
    if (n < DESCRIPTION.min || n > DESCRIPTION.max) {
      out.push(`description is ${n} characters, want ${DESCRIPTION.min} to ${DESCRIPTION.max}`);
    }
  }
  if (indexable(page)) {
    if (!sameUrl(page.canonical, url)) out.push(`canonical is ${page.canonical}, want ${url}`);
    if (!sameUrl(page.og['og:url'], url)) out.push(`og:url is ${page.og['og:url']}, want ${url}`);
  }
  for (const key of OG) if (key !== 'og:url' && !page.og[key]) out.push(`no ${key}`);
  if (page.og['og:locale'] && page.og['og:locale'] !== 'fa_IR') out.push('og:locale is not fa_IR');
  if (!page.twitterCard) out.push('no twitter:card');

  let scripts = [];
  try {
    scripts = page.jsonLd.map((text) => JSON.parse(text));
  } catch (error) {
    out.push(`JSON-LD does not parse: ${error.message}`);
  }
  out.push(...graphProblems(scripts).map((p) => `JSON-LD: ${p}`));
  const nodes = scripts.flatMap((s) => (Array.isArray(s?.['@graph']) ? s['@graph'] : []));
  const types = nodes.map((n) => n['@type']);
  for (const type of ['Dentist', 'WebSite']) {
    if (!types.includes(type)) out.push(`JSON-LD has no ${type}`);
  }
  if (pathname !== '/') {
    const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')?.itemListElement ?? [];
    if (crumbs.length === 0) out.push('no BreadcrumbList');
    // A later page of a list ends its trail at the list itself.
    else if (indexable(page) && !sameUrl(crumbs.at(-1)?.item, url.split('?')[0])) {
      out.push(`the last breadcrumb is ${crumbs.at(-1)?.item}, want ${url}`);
    }
    if (!page.breadcrumbNav) out.push('no visible breadcrumb');
  } else {
    if (page.homeSections.length === 0) out.push('home renders no data-home-section');
    for (const section of page.homeSections) {
      if (!section.named)
        out.push(`home section "${section.name}" has no heading in the server HTML`);
    }
  }
  for (const id of new Set(page.labelledBy)) {
    if (!page.ids.has(id)) out.push(`aria-labelledby="${id}" names no element in the server HTML`);
  }
  for (const word of PLACEHOLDERS) {
    if (!allow.includes(word.allow) && word.pattern.test(html)) out.push(`shows ${word.label}`);
  }
  return out;
}

/** `<loc>` values of a sitemap index or urlset, and which one it is. */
export function sitemapLocs(xml) {
  const kind = /<sitemapindex[\s>]/.test(xml)
    ? 'index'
    : /<urlset[\s>]/.test(xml)
      ? 'urlset'
      : null;
  const locs = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((m) =>
    decode(
      m[1]
        .trim()
        .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
        .trim(),
    ),
  );
  return { kind, locs };
}

/** The `User-agent: *` group of robots.txt: Disallow prefixes and the Sitemap lines. */
export function robotsRules(text) {
  const disallow = [];
  const sitemaps = [];
  let star = false;
  let inAgents = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const [, key = '', value = ''] = /^([\w-]+)\s*:\s*(.*)$/.exec(line) ?? [];
    const k = key.toLowerCase();
    if (k === 'user-agent') {
      star = (inAgents && star) || value === '*';
      inAgents = true;
      continue;
    }
    inAgents = false;
    if (k === 'sitemap') sitemaps.push(value);
    else if (k === 'disallow' && star && value) disallow.push(decodeURI(value));
  }
  return { disallow, sitemaps };
}

const blocked = (rules, pathname) => rules.disallow.some((prefix) => pathname.startsWith(prefix));

/**
 * Problems across pages: unique titles and descriptions among indexable pages; sitemap, robots
 * and meta robots agree; no orphan. `pages` maps a decoded path to { page (parsePage), status };
 * `inlinks` a decoded path to the set of pages linking to it.
 * @param {{
 *   pages: Map<string, { status: number, page: ReturnType<typeof parsePage> | null }>,
 *   sitemap: Set<string>,
 *   rules: { disallow: string[], sitemaps: string[] },
 *   inlinks: Map<string, Set<string>>,
 *   allow?: string[],
 * }} input
 * @returns {string[]}
 */
export function siteProblems({ pages, sitemap, rules, inlinks, allow = [] }) {
  const out = [];
  const seen = { title: new Map(), description: new Map() };
  for (const [pathname, { page }] of pages) {
    if (!page || !indexable(page)) continue;
    // The QA fixture gives its fourteen articles one description on purpose: test rows, not copy.
    const fixture = allow.includes('qa') && pathname.includes(QA_SLUG);
    // Later pages of a list repeat its description and stay out of the sitemap (spec 9.4).
    const paginated = pathname.includes('?page=');
    for (const key of fixture ? [] : paginated ? ['title'] : ['title', 'description']) {
      if (!page[key]) continue;
      const first = seen[key].get(page[key]);
      if (first) out.push(`${pathname}: same ${key} as ${first}`);
      else seen[key].set(page[key], pathname);
    }
    if (!paginated && !sitemap.has(pathname))
      out.push(`${pathname}: indexable but not in the sitemap`);
    if (blocked(rules, pathname)) out.push(`${pathname}: indexable but disallowed in robots.txt`);
  }
  for (const pathname of sitemap) {
    const entry = pages.get(pathname);
    if (blocked(rules, pathname))
      out.push(`${pathname}: in the sitemap and disallowed in robots.txt`);
    if (entry?.status !== 200) out.push(`${pathname}: in the sitemap, answers ${entry?.status}`);
    else if (entry.page && !indexable(entry.page)) out.push(`${pathname}: in the sitemap, noindex`);
    out.push(...slugProblems(pathname).map((p) => `${pathname}: ${p}`));
  }
  for (const [pathname, { status }] of pages) {
    if (status !== 200 || pathname === '/') continue;
    const from = [...(inlinks.get(pathname) ?? [])].filter((p) => p !== pathname);
    if (from.length === 0) out.push(`${pathname}: orphan (no internal link points to it)`);
  }
  return out;
}

/** CSV records (RFC 4180, comma or semicolon) with the header row dropped when it says "from". */
export function parseCsvRows(text) {
  const body = text.replace(/^﻿/, '');
  const head = body.split(/\r?\n/)[0];
  const sep = head.split(';').length > head.split(',').length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i <= body.length; i += 1) {
    const c = body[i];
    if (quoted && c === '"' && body[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (c === '"' && (quoted || cell.trim() === '')) {
      quoted = !quoted;
    } else if (quoted) {
      cell += c ?? '';
    } else if (c === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n' || c === '\r' || c === undefined) {
      if (c === '\r' && body[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  return rows[0]?.[0]?.toLowerCase() === 'from' ? rows.slice(1) : rows;
}

/**
 * The old-site URLs (gap 11) as the import CSV: one row per path, `to` left for the admin. Home
 * stays out: the new site answers `/` itself.
 */
export function oldUrlCsv(locs) {
  const paths = [
    ...new Set(locs.map((loc) => decodeURI(new URL(loc).pathname) + new URL(loc).search)),
  ];
  const cell = (v) => (/[",;\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  return (
    [
      'from,to,status',
      ...paths
        .filter((p) => p !== '/')
        .sort()
        .map((p) => `${cell(p)},,`),
    ].join('\n') + '\n'
  );
}

/** One redirect check: the answer to `from` against the row's `to` and status (301 by default). */
/**
 * @param {string[]} row
 * @param {{ status: number, location: string | null }} answer
 * @param {string} origin
 * @returns {string | null}
 */
export function redirectProblem([from = '', to = '', status = ''], answer, origin) {
  // The import accepts Persian and Arabic-Indic digits («۴۱۰»).
  const digits = status.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) =>
    String(d.charCodeAt(0) % 16),
  );
  const want = Number(digits || 301);
  if (answer.status !== want) return `${from}: answers ${answer.status}, want ${want}`;
  if (want === 410 || !to) return null;
  const got = answer.location ? new URL(answer.location, origin) : null;
  const target = new URL(to, origin);
  const same = (u) => decodeURI(u.pathname) + u.hash;
  return got && same(got) === same(target) && got.origin === target.origin
    ? null
    : `${from}: redirects to ${got && decodeURI(got.href)}, want ${decodeURI(target.href)}`;
}

async function get(url, { redirect = 'manual' } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { redirect, signal: AbortSignal.timeout(30_000) });
      const type = response.headers.get('content-type') ?? '';
      const body =
        type.includes('html') || type.includes('xml') || type.startsWith('text/')
          ? await response.text()
          : (await response.arrayBuffer(), '');
      return { status: response.status, type, body, location: response.headers.get('location') };
    } catch (error) {
      if (attempt === 3) throw new Error(`GET ${url} failed three times: ${error.message}`);
    }
  }
}

/** Every page URL of a sitemap index or urlset, following child sitemaps one level. */
async function sitemapUrls(url, problems) {
  const top = await get(url, { redirect: 'follow' });
  if (top.status !== 200) {
    problems.push(`${url} answers ${top.status}`);
    return [];
  }
  const parsed = sitemapLocs(top.body);
  if (parsed.kind === 'urlset') return parsed.locs;
  if (parsed.kind !== 'index') {
    problems.push(`${url} is neither a sitemap index nor a urlset`);
    return [];
  }
  const out = [];
  for (const child of parsed.locs) {
    const answer = await get(child, { redirect: 'follow' });
    if (answer.status !== 200) problems.push(`${child} answers ${answer.status}`);
    else out.push(...sitemapLocs(answer.body).locs);
  }
  return out;
}

/** The whole audit of one origin; resolves to { problems, warnings, pages }. */
export async function crawl(origin, { allow = [], oldUrls = null } = {}) {
  const problems = [];
  const warnings = [];
  const robots = await get(`${origin}/robots.txt`);
  const rules = robotsRules(robots.status === 200 ? robots.body : '');
  if (robots.status !== 200) problems.push(`/robots.txt answers ${robots.status}`);
  if (!rules.sitemaps.includes(`${origin}/sitemap.xml`)) {
    problems.push(`robots.txt names no Sitemap: ${origin}/sitemap.xml`);
  }
  if (rules.disallow.includes('/')) {
    problems.push('robots.txt disallows everything: start the server with ALLOW_INDEXING=true');
  }
  const locs = await sitemapUrls(`${origin}/sitemap.xml`, problems);
  const sitemap = new Set();
  for (const loc of locs) {
    const url = new URL(loc);
    if (url.origin !== origin) problems.push(`sitemap lists another origin: ${loc}`);
    else sitemap.add(decodeURI(url.pathname));
  }
  if (sitemap.size === 0) problems.push('the sitemap lists no URL');

  const pages = new Map();
  const inlinks = new Map();
  const queued = new Set(['/', ...sitemap]);
  const queue = [...queued];
  while (queue.length > 0) {
    const pathname = queue.shift();
    const url = `${origin}${encodeURI(pathname)}`;
    const answer = await get(url);
    const entry = { status: answer.status, page: null };
    pages.set(pathname, entry);
    if (answer.status >= 300 && answer.status < 400) {
      entry.location = answer.location;
      continue;
    }
    if (answer.status !== 200 || !answer.type.includes('text/html')) continue;
    entry.page = parsePage(answer.body);
    problems.push(...pageProblems(url, answer.body, allow).map((p) => `${pathname}: ${p}`));
    if (entry.page.title && length(entry.page.title) < TITLE.min && indexable(entry.page)) {
      warnings.push(
        `${pathname}: title is ${length(entry.page.title)} characters, under ${TITLE.min}`,
      );
    }
    for (const href of entry.page.links) {
      const target = new URL(href, url);
      if (target.origin !== origin || !/^https?:$/.test(target.protocol)) continue;
      const page = target.searchParams.get('page');
      // Paginated lists are crawled page by page: later pages hold the older articles.
      const linked = decodeURI(target.pathname) + (page ? `?page=${page}` : '');
      if (SKIP.test(linked) || /\.\w+$/.test(target.pathname)) continue;
      if (!inlinks.has(linked)) inlinks.set(linked, new Set());
      inlinks.get(linked).add(pathname);
      if (!queued.has(linked)) {
        queued.add(linked);
        queue.push(linked);
      }
    }
  }
  for (const [pathname, entry] of pages) {
    const from = [...(inlinks.get(pathname) ?? [])].slice(0, 3).join(', ');
    if (entry.status >= 300 && entry.status < 400 && from) {
      problems.push(
        `${pathname}: linked from ${from}, redirects (${entry.status}) to ${entry.location}`,
      );
    } else if (entry.status !== 200 && from) {
      problems.push(`${pathname}: broken link (${entry.status}) from ${from}`);
    }
  }
  problems.push(...siteProblems({ pages, sitemap, rules, inlinks, allow }));

  // The seeded /vip alias always, then the imported old-URL list when given.
  const redirects = [['/vip', '/خدمات/ترمیم-دندان#سطح-ترمیم', '301'], ...(oldUrls ?? [])];
  for (const row of redirects) {
    // An old-site URL in the file keeps its path; the redirect answers on this origin.
    const from = new URL(row[0], origin);
    const answer = await get(`${origin}${from.pathname}${from.search}`);
    const problem = redirectProblem(row, answer, origin);
    if (problem) problems.push(`redirect ${problem}`);
  }
  return { problems, warnings, pages };
}

async function main(argv) {
  if (argv[0] === '--old-sitemap') {
    const problems = [];
    const locs = await sitemapUrls(argv[1], problems);
    if (problems.length > 0 || locs.length === 0) {
      console.error(problems.join('\n') || `${argv[1]} lists no URL`);
      return 1;
    }
    process.stdout.write(oldUrlCsv(locs));
    console.error(`crawl: ${locs.length} old URLs written`);
    return 0;
  }
  const origin = argv.find((a) => /^https?:\/\//.test(a))?.replace(/\/+$/, '');
  if (!origin) {
    console.error('usage: node scripts/crawl.mjs <origin> [--old-urls file.csv] [--demo] [--qa]');
    return 2;
  }
  const allow = ['demo', 'qa'].filter((flag) => argv.includes(`--${flag}`));
  const csv = argv[argv.indexOf('--old-urls') + 1];
  const oldUrls = argv.includes('--old-urls') ? parseCsvRows(readFileSync(csv, 'utf8')) : null;
  const { problems, warnings, pages } = await crawl(origin, { allow, oldUrls });
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const p of problems) console.error(`problem: ${p}`);
  const html = [...pages.values()].filter((e) => e.page).length;
  console.log(
    `crawl: ${pages.size} URLs, ${html} pages, ${problems.length} problems, ${warnings.length} warnings`,
  );
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
