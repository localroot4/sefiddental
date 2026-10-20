// Share images (phase 6: H14, C16, C31). Every template's og:image is an absolute URL that answers
// 200 with a PNG or JPEG of 1200x630; a post and a dentist share the `og` size of their cover or
// photo; a page without an image, or with one below 1200x630 (C16), shares its page type's card.
// With QA_SCREENSHOTS=phase-06 each served image is saved as docs/qa/phase-06/og-<template>.<ext>,
// to be looked at for Persian letter joining and right-to-left order (no test sees that, risk 12).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

import {
  ARTICLES_HUB,
  articleTemplates,
  CASES,
  FIXED_TEMPLATES,
  jsonLdScripts,
  ofType,
  type JsonLdNode,
  type SeoTemplate,
} from '../../helpers/jsonld';
import { routeExists } from '../../helpers/pending';
import { qaScreenshotDir } from '../../helpers/screens';
import { APP_ORIGIN } from '../../helpers/servers';

/**
 * C16: the QA fixture's category-B post has a cover below 1200x630 both ways, so Payload makes no
 * `og` size and the post shares the article card (tests/fixtures/qa-seed.ts).
 */
const SMALL_COVER: SeoTemplate = {
  name: 'article-small-cover',
  path: '/مقالات/نمونه-آزمایشی-مقاله-دسته-ب',
  card: 'article',
  types: ['BreadcrumbList', 'Article'],
};

/** Every template whose route exists in this build; the article ones are found on the hub. */
async function templates(request: APIRequestContext): Promise<SeoTemplate[]> {
  const list = [...FIXED_TEMPLATES];
  if (routeExists('cases')) list.push(CASES);
  if ((['articlesHub', 'article', 'articleCategory', 'tag'] as const).every(routeExists)) {
    list.push(ARTICLES_HUB, ...(await articleTemplates(request)), SMALL_COVER);
  }
  return list;
}

/** The content of `<meta property|name="key">` in the page's HTML. */
function meta(html: string, key: string): string | undefined {
  const tag = new RegExp(
    `<meta (?:property|name)="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`,
  );
  return tag.exec(html)?.[1]?.replace(/&amp;/g, '&');
}

async function shareImage(request: APIRequestContext, template: SeoTemplate) {
  const response = await request.get(encodeURI(template.path));
  expect(response.status(), template.path).toBe(200);
  const html = await response.text();
  return {
    html,
    url: meta(html, 'og:image') ?? '',
    width: meta(html, 'og:image:width'),
    height: meta(html, 'og:image:height'),
    alt: meta(html, 'og:image:alt'),
    twitter: meta(html, 'twitter:image'),
  };
}

test('T-OG1 every template shares an absolute 1200x630 PNG or JPEG that answers 200', async ({
  request,
}) => {
  test.setTimeout(120_000);
  const dir = qaScreenshotDir();
  for (const template of await templates(request)) {
    const og = await shareImage(request, template);
    const where = `${template.name} ${template.path}`;
    expect(og.url, where).toMatch(/^https?:\/\//);
    expect(og.twitter, where).toBe(og.url);
    expect([og.width, og.height], where).toEqual(['1200', '630']);
    expect(og.alt, where).toBeTruthy();
    const image = await request.get(og.url);
    expect(image.status(), `${where}: ${og.url}`).toBe(200);
    const type = image.headers()['content-type'] ?? '';
    expect(type, where).toMatch(/^image\/(png|jpeg)/);
    const bytes = await image.body();
    const info = await sharp(bytes).metadata();
    expect([info.width, info.height], `${where}: decoded size`).toEqual([1200, 630]);
    if (dir) {
      mkdirSync(dir, { recursive: true });
      const ext = type.includes('png') ? 'png' : 'jpg';
      writeFileSync(path.join(dir, `og-${template.name}.${ext}`), bytes);
    }
  }
});

test('T-OG2 a post and a dentist share the og size of their cover or photo (H14a)', async ({
  request,
}) => {
  const dentist = FIXED_TEMPLATES.find((t) => t.name === 'dentist')!;
  const withImages = [dentist];
  if ((['articlesHub', 'article'] as const).every(routeExists)) {
    withImages.push((await articleTemplates(request)).find((t) => t.name === 'article')!);
  }
  for (const template of withImages) {
    const og = await shareImage(request, template);
    // Payload names a size file <name>-<width>x<height>.<ext> (Media.ts `og`: JPEG).
    expect(new URL(og.url).pathname, template.path).toMatch(
      /^\/api\/media\/file\/[^/]+-1200x630\.jpe?g$/,
    );
  }
});

test('T-OG3 a page without an image, or with one below 1200x630, shares its type card (C16, C31)', async ({
  request,
}) => {
  const seeded = (await templates(request)).filter(
    (t) => t.name !== 'dentist' && t.name !== 'article',
  );
  for (const template of seeded) {
    const og = await shareImage(request, template);
    const where = `${template.name} ${template.path}`;
    expect(og.url, where).toBe(`${APP_ORIGIN}/brand/og/${template.card}.png`);
    expect([og.width, og.height], where).toEqual(['1200', '630']);
    if (template === SMALL_COVER) {
      // It does have an image: the Article JSON-LD names the cover itself, which has no og size.
      const graph = jsonLdScripts(og.html).flatMap(
        (s) => (s as { '@graph': JsonLdNode[] })['@graph'],
      );
      const image = String(ofType(graph, 'Article')[0]?.image ?? '');
      expect(image, where).toMatch(/\/api\/media\/file\/[^/]+$/);
      expect(image, where).not.toMatch(/-1200x630\.\w+$/);
    }
  }
});
