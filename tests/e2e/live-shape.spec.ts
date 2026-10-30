// The launch-shaped public surface (phase 9 SURFACE): the database `npm run db:live` builds
// (migrations and the seed, no QA fixture) with DEMO_CONTENT off. No dentist, guide or article is
// published there, so the chrome must link only pages that exist, and the empty hubs must stay out
// of the index. Run it with:
//   npm run db:live
//   E2E_LIVE_SHAPE=1 E2E_DATABASE_URL=file:./.data/e2e-live.db npx playwright test live-shape --project=desktop-light
import { expect, test, type APIRequestContext } from '@playwright/test';

import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';

import { INDEXING_ORIGIN } from '../helpers/servers';
import { findAll, parseXml, textOf } from '../helpers/xml';

test.skip(
  process.env.E2E_LIVE_SHAPE !== '1',
  'runs on the launch-shaped database only: npm run db:live, then E2E_LIVE_SHAPE=1 E2E_DATABASE_URL=file:./.data/e2e-live.db',
);
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'one run: the widths are set per step');
  // The servers inherit this process's environment: demo content would fill the empty hubs.
  expect(process.env.DEMO_CONTENT ?? '', 'DEMO_CONTENT must be unset').toMatch(
    /^(|false|0|off|no)$/,
  );
});

const SITEMAPS = ['pages', 'services', 'doctors', 'articles'] as const;
const EMPTY_HUBS = [PAGE_PATHS['dentists-hub'], PAGE_PATHS['guide-hub'], PAGE_PATHS.articles];

/** Decoded site paths of every `<loc>` of one child sitemap on the indexing server. */
async function sitemapPaths(request: APIRequestContext, name: string): Promise<string[]> {
  const response = await request.get(`${INDEXING_ORIGIN}/sitemaps/${name}.xml`);
  expect(response.status(), name).toBe(200);
  return findAll(parseXml(await response.text()), 'url').map((url) =>
    decodeURI(new URL(textOf(url, 'loc') ?? '').pathname),
  );
}

/** The meta robots of a page on the indexing server, after at most one 301. */
async function robotsOf(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(`${INDEXING_ORIGIN}${encodeURI(path)}`, { maxRedirects: 0 });
  expect(response.status(), path).toBe(200);
  return /<meta name="robots" content="([^"]+)"/.exec(await response.text())?.[1] ?? '';
}

test('T-LS1 every chrome link of the home page answers 200, or a 301 to a 200, at 390 and 1440', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const hrefs = new Set<string>();
  const collect = async (selector: string) => {
    const found = await page
      .locator(`${selector} a[href^="/"]`)
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(found.length, selector).toBeGreaterThan(0);
    for (const href of found) hrefs.add(href);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: t('nav.menuOpen') }).click();
  await expect(page.getByRole('dialog', { name: t('nav.drawer') })).toBeVisible();
  await collect('#site-drawer');
  await collect('header');
  await collect('footer');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await collect('header');
  await collect('footer');

  const broken: string[] = [];
  for (const href of hrefs) {
    const response = await request.get(href, { maxRedirects: 0 });
    let status = response.status();
    if (status === 301) {
      const target = response.headers().location ?? '';
      status = (await request.get(target, { maxRedirects: 0 })).status();
    }
    if (status !== 200) broken.push(`${decodeURI(href)} → ${response.status()}/${status}`);
  }
  expect(broken).toEqual([]);
});

test('T-LS2 every sitemap URL answers 200 and is indexable; the empty hubs are noindex and unlisted', async ({
  request,
}) => {
  test.setTimeout(120_000);
  const [pages, services, doctors, articles] = await Promise.all(
    SITEMAPS.map((name) => sitemapPaths(request, name)),
  );
  // The launch shape: nothing medical but the services is published (no reviewer dentist).
  expect(doctors, 'no dentist published').toEqual([]);
  expect(articles, 'no article or article category listed').toEqual([]);
  expect(
    pages!.filter((p) => p.startsWith(`${PAGE_PATHS['guide-hub']}/`)),
    'no guide',
  ).toEqual([]);
  expect(services!.length, 'the services publish').toBeGreaterThan(0);

  const listed = [...pages!, ...services!];
  const failures: string[] = [];
  for (const path of listed) {
    const response = await request.get(`${INDEXING_ORIGIN}${encodeURI(path)}`, {
      maxRedirects: 0,
    });
    const robots = /<meta name="robots" content="([^"]+)"/.exec(await response.text())?.[1] ?? '';
    if (response.status() !== 200 || /noindex/.test(robots)) {
      failures.push(`${path}: ${response.status()} ${robots}`);
    }
  }
  expect(failures, 'listed but not a 200 indexable page').toEqual([]);

  for (const hub of EMPTY_HUBS) {
    expect(listed, `${hub} unlisted while empty`).not.toContain(hub);
    expect(await robotsOf(request, hub), `${hub} noindex while empty`).toMatch(/^noindex/);
  }
});
