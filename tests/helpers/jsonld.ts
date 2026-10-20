// JSON-LD of rendered pages for the e2e specs (phase 6, H15): one extractor for every spec, the
// graph checks of T-SD, and the public templates the SEO specs walk (structured data, share
// images). Article, category and tag paths are found on the hub, so no fixture slug is named.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

import type { OgCard } from '@/i18n/fa-seo';

export type JsonLdNode = { '@type': string; '@id'?: string; [key: string]: unknown };

const SCRIPT = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

/** The parsed `application/ld+json` scripts of an HTML document. */
export function jsonLdScripts(html: string): unknown[] {
  return [...html.matchAll(SCRIPT)].map((m) => JSON.parse(m[1]!) as unknown);
}

/** Every node of the page, the @graph arrays flattened. */
export async function jsonLd(page: Page): Promise<JsonLdNode[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => (JSON.parse(text) as { '@graph': JsonLdNode[] })['@graph']);
}

export const ofType = (nodes: JsonLdNode[], type: string) =>
  nodes.filter((n) => n['@type'] === type);

const URL_KEYS = new Set(['url', 'item', 'image', 'logo', 'thumbnailUrl', 'contentUrl', 'hasMap']);
const DATE_KEYS = new Set(['datePublished', 'dateModified', 'uploadDate']);
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

/**
 * What is wrong with a page's JSON-LD (T-SD), as readable lines; empty when nothing is: each
 * script is one schema.org @graph; no [[NEEDS_CLIENT marker; every @id defined once and every
 * @id reference defined on the page; URLs absolute; dates ISO 8601 (lastReviewed a plain date);
 * breadcrumb positions 1..n.
 */
export function graphProblems(scripts: unknown[]): string[] {
  const problems: string[] = [];
  const defined = new Map<string, number>();
  const referenced = new Set<string>();
  const walk = (value: unknown, key: string, top: boolean): void => {
    if (Array.isArray(value)) return value.forEach((v) => walk(v, key, false));
    if (value !== null && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      const keys = Object.keys(node);
      const id = node['@id'];
      if (typeof id === 'string') {
        if (keys.length === 1) referenced.add(id);
        else if (top) defined.set(id, (defined.get(id) ?? 0) + 1);
        if (!/^https?:\/\//.test(id)) problems.push(`@id is not absolute: ${id}`);
      }
      if (node['@type'] === 'BreadcrumbList') {
        const items = (node.itemListElement ?? []) as Array<{ position?: unknown }>;
        const positions = items.map((item) => item.position);
        const expected = items.map((_, i) => i + 1);
        if (JSON.stringify(positions) !== JSON.stringify(expected)) {
          problems.push(`BreadcrumbList positions ${JSON.stringify(positions)}`);
        }
      }
      for (const k of keys) walk(node[k], k, false);
      return;
    }
    if (typeof value !== 'string') return;
    if (value.includes('[[NEEDS_CLIENT')) problems.push(`${key} holds a [[NEEDS_CLIENT marker`);
    if ((URL_KEYS.has(key) || key === 'sameAs') && !/^https?:\/\//.test(value)) {
      problems.push(`${key} is not an absolute URL: ${value}`);
    }
    if (DATE_KEYS.has(key) && (!ISO_DATE_TIME.test(value) || Number.isNaN(Date.parse(value)))) {
      problems.push(`${key} is not an ISO 8601 date: ${value}`);
    }
    if (key === 'lastReviewed' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      problems.push(`lastReviewed is not a schema.org Date: ${value}`);
    }
  };
  for (const script of scripts) {
    const graph = script as { '@context'?: unknown; '@graph'?: unknown };
    if (graph['@context'] !== 'https://schema.org' || !Array.isArray(graph['@graph'])) {
      problems.push('a script is not one schema.org @graph');
      continue;
    }
    for (const node of graph['@graph']) walk(node, '@graph', true);
  }
  for (const [id, count] of defined)
    if (count > 1) problems.push(`@id defined ${count} times: ${id}`);
  for (const id of referenced) if (!defined.has(id)) problems.push(`@id not on the page: ${id}`);
  return problems;
}

export interface SeoTemplate {
  /** Screenshot and report name. */
  name: string;
  /** Decoded site path. */
  path: string;
  /** The share card the page shows when it has no image of its own (H14, C31). */
  card: OgCard;
  /** JSON-LD types the page carries besides the site-wide Dentist and WebSite. */
  types: string[];
}

/** Templates with a fixed path on the e2e database (seed plus tests/fixtures/qa-seed.ts). */
export const FIXED_TEMPLATES: SeoTemplate[] = [
  { name: 'home', path: '/', card: 'default', types: [] },
  {
    name: 'services-hub',
    path: '/خدمات',
    card: 'services-hub',
    types: ['BreadcrumbList', 'ItemList'],
  },
  {
    name: 'service-category',
    path: '/خدمات/زیبایی',
    card: 'service-category',
    types: ['BreadcrumbList', 'ItemList'],
  },
  {
    name: 'service',
    path: '/خدمات/لمینت-سرامیکی',
    card: 'service',
    types: ['BreadcrumbList', 'Service'],
  },
  {
    name: 'restoration',
    path: '/خدمات/ترمیم-دندان',
    card: 'service',
    types: ['BreadcrumbList', 'Service'],
  },
  {
    name: 'dentists-hub',
    path: '/پزشکان',
    card: 'dentists-hub',
    types: ['BreadcrumbList', 'ItemList'],
  },
  {
    name: 'dentist',
    path: '/پزشکان/دکتر-نمونه-آزمایشی',
    card: 'dentist',
    types: ['BreadcrumbList', 'Physician'],
  },
  {
    name: 'guide-hub',
    path: '/راهنمای-بیمار',
    card: 'guide-hub',
    types: ['BreadcrumbList', 'ItemList'],
  },
  {
    name: 'guide',
    path: '/راهنمای-بیمار/اولین-مراجعه',
    card: 'guide',
    types: ['BreadcrumbList', 'MedicalWebPage'],
  },
  { name: 'pricing', path: '/هزینه-و-پرداخت', card: 'pricing', types: ['BreadcrumbList'] },
  { name: 'about', path: '/درباره-ما', card: 'about', types: ['BreadcrumbList'] },
  { name: 'address', path: '/آدرس', card: 'address', types: ['BreadcrumbList'] },
  { name: 'emergency', path: '/اورژانس', card: 'emergency', types: ['BreadcrumbList'] },
  { name: 'booking', path: '/رزرو-نوبت', card: 'default', types: ['BreadcrumbList'] },
  { name: 'privacy', path: '/حریم-خصوصی', card: 'default', types: ['BreadcrumbList'] },
];

/** Phase 6 templates (TEMPLATES lane): their routes may not exist yet (tests/helpers/pending.ts). */
export const ARTICLES_HUB: SeoTemplate = {
  name: 'articles',
  path: '/مقالات',
  card: 'articles',
  types: ['BreadcrumbList', 'ItemList'],
};
export const CASES: SeoTemplate = {
  name: 'cases',
  path: '/قبل-و-بعد',
  card: 'cases',
  types: ['BreadcrumbList', 'ItemList'],
};

/** Decoded site paths of the links in an HTML document. */
function linkPaths(html: string): string[] {
  return [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => decodeURI(m[1]!));
}

async function htmlOf(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(encodeURI(path));
  expect(response.status(), path).toBe(200);
  return response.text();
}

/**
 * The article templates found on the hub (the first post of page 1), then its category and its
 * first tag from the post's own links. Reading them from the pages keeps the fixture slugs in
 * tests/fixtures/qa-seed.ts only.
 */
export async function articleTemplates(request: APIRequestContext): Promise<SeoTemplate[]> {
  const isPost = (p: string) => /^\/مقالات\/[^/]+$/.test(p) && !/\/(دسته|برچسب)$/.test(p);
  const post = linkPaths(await htmlOf(request, ARTICLES_HUB.path)).find(isPost);
  expect(post, 'a published article linked from /مقالات').toBeDefined();
  const links = linkPaths(await htmlOf(request, post!));
  const category = links.find((p) => p.startsWith('/مقالات/دسته/'));
  const tag = links.find((p) => p.startsWith('/مقالات/برچسب/'));
  expect(category, `a category link on ${post}`).toBeDefined();
  expect(tag, `a tag link on ${post}`).toBeDefined();
  const list = ['BreadcrumbList', 'ItemList'];
  return [
    { name: 'article', path: post!, card: 'article', types: ['BreadcrumbList', 'Article'] },
    { name: 'article-category', path: category!, card: 'articles', types: list },
    { name: 'article-tag', path: tag!, card: 'articles', types: list },
  ];
}
