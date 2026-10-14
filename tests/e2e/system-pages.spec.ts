// System pages (deliverable 7, freeze 6 and amendment A6): the branded 404 for unknown paths,
// the QA renders of the 404 template (200), the 500 boundary and the 410 document. QA routes
// exist only because the e2e server runs with QA_ROUTES=1. The axe scans of these templates are
// in a11y.spec.ts.
import { expect, test, type Page } from '@playwright/test';

import { t } from '@/i18n/fa';

import { watchConsoleErrors } from '../helpers/console';

async function expectPersianDocument(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

/** Body background equals the theme's --color-surface token (no unstyled default page). */
async function expectSurfaceBackground(page: Page): Promise<void> {
  const [background, surface] = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-surface)';
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(document.body).backgroundColor, resolved];
  });
  expect(background).toBe(surface);
}

test('T-SP1 an unknown path gets the branded 404: status, language, noindex, icons, surface', async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page);
  const response = await page.goto(`/no-such-page-${Date.now()}`);
  expect(response?.status()).toBe(404);
  await expectPersianDocument(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('notFound.heading'));
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  expect(await page.locator('link[rel~="icon"]').count()).toBeGreaterThan(0);
  await expectSurfaceBackground(page);
  expect(consoleErrors()).toEqual([]);
});

test('T-SP1b the 404 server HTML already carries lang and dir (no-JS readers, crawlers)', async ({
  request,
}) => {
  const response = await request.get(`/no-such-page-${Date.now()}`);
  expect(response.status()).toBe(404);
  expect(await response.text()).toMatch(/<html[^>]*\slang="fa"[^>]*\sdir="rtl"/);
});

test('T-SP2 /en and /en/* are 404, never an English site', async ({ request }) => {
  for (const path of ['/en', '/en/services']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test('T-SP3 /qa/not-found renders the 404 template with status 200 (Lighthouse target)', async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page);
  const response = await page.goto('/qa/not-found');
  expect(response?.status()).toBe(200);
  await expectPersianDocument(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('notFound.heading'));
  await expectSurfaceBackground(page);
  expect(consoleErrors()).toEqual([]);
});

test('T-SP4 /qa/error renders the branded 500 with a retry action', async ({ page }) => {
  const response = await page.goto('/qa/error');
  expect(response?.status()).toBe(500);
  await expectPersianDocument(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('error.heading'));
  await expect(page.getByRole('button', { name: t('error.retry') })).toBeVisible();
});

test('T-SP5 /qa/gone serves the static 410 document, noindex', async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page);
  const response = await page.goto('/qa/gone');
  expect(response?.status()).toBe(410);
  expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);
  await expectPersianDocument(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(consoleErrors()).toEqual([]);
});

test('T-SP6 the static maintenance page the host serves while Node is down is Persian', async ({
  page,
}) => {
  const response = await page.goto('/maintenance.html');
  expect(response?.status()).toBe(200);
  await expectPersianDocument(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('T-SP7 the font families are the names design/tokens.css asks for, and both load', async ({
  page,
}) => {
  // next/font/local names a family after its exported constant (src/lib/fonts.ts); the build-time
  // transform is out of Vitest's reach, so the check runs on the built page.
  await page.goto('/qa/not-found');
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() =>
    [...document.fonts].map((face) => face.family.replace(/^["']|["']$/g, '')),
  );
  expect(families).toEqual(expect.arrayContaining(['Vazirmatn', 'Estedad']));
  // Each family resolves to a face that loads (an empty list means the name matched nothing).
  const loaded = await page.evaluate(() =>
    Promise.all(
      ['400 1rem Vazirmatn', '700 1rem Estedad'].map(async (font) =>
        (await document.fonts.load(font, 'سفید')).map((face) => face.status),
      ),
    ),
  );
  expect(loaded).toEqual([['loaded'], ['loaded']]);
});
