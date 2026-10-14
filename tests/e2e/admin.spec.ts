// Admin acceptance (docs/prompts/03-foundation.md): the admin loads in Persian RTL, MFA
// enrollment works, an editor cannot reach globals, users, redirects or system views; plus the
// slug-change redirect (deliverable 5) and the admin screenshots. Playwright's global setup
// resets the e2e accounts, so every run starts unenrolled.
//
// One serial file in its own project: the two accounts and their TOTP state are shared, and the
// sign-in endpoints allow 10 POSTs per 15 minutes per client key (decision 41). This file makes
// six: admin enrollment (2), admin verification (2), editor enrollment (2). Later tests reuse
// the sessions through their cookies.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { buildPath } from '@/lib/paths';
import { persianSlug } from '@/lib/persianSlug';

import { signInToAdmin } from '../helpers/admin';
import { requireRoutes } from '../helpers/pending';
import { captureTemplate, VIEWPORTS, type ViewportName } from '../helpers/screens';
import { APP_ORIGIN } from '../helpers/servers';
import { e2eAccounts } from '../helpers/users';

test.describe.configure({ mode: 'serial' });

type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>;
const sessions: { admin?: Cookies; editor?: Cookies } = {};

/** Payload's admin not-found view (hidden entity, or no read access). */
const NOT_FOUND_HEADING = 'موردی یافت نشد';

/** Admin areas an editor must never open (acceptance; DATA 5.1; freeze 29). */
const ADMIN_ONLY_VIEWS = [
  '/admin/globals/clinic',
  '/admin/globals/seo-defaults',
  '/admin/globals/features',
  '/admin/globals/notifier',
  '/admin/globals/system-state',
  '/admin/collections/users',
  '/admin/collections/redirects',
  '/admin/system-status',
] as const;

async function restoreSession(page: Page, role: 'admin' | 'editor'): Promise<void> {
  const cookies = sessions[role];
  if (!cookies) throw new Error(`No ${role} session: the sign-in test before this one failed.`);
  await page.context().addCookies(cookies);
}

/** REST call from inside the admin page: the browser's same-origin headers, the session cookie. */
async function restStatus(page: Page, path: string): Promise<number> {
  return page.evaluate((url) => fetch(url).then((r) => r.status), path);
}

async function expectPersianRtl(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  // Payload writes dir="RTL" in capitals (freeze decision 44).
  await expect(page.locator('html')).toHaveAttribute('dir', /^rtl$/i);
}

test('T-AD1 MFA: a fresh admin is forced through TOTP setup; the next sign-in asks for a code', async ({
  page,
}) => {
  const { admin } = e2eAccounts();
  expect(await signInToAdmin(page, admin)).toBe('enrolled');
  await expectPersianRtl(page);

  await page.context().clearCookies();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);

  expect(await signInToAdmin(page, admin)).toBe('verified');
  await expectPersianRtl(page);
  sessions.admin = await page.context().cookies();
});

test('T-AD2 an editor enrolls TOTP on the first sign-in', async ({ page }) => {
  const { editor } = e2eAccounts();
  expect(await signInToAdmin(page, editor)).toBe('enrolled');
  await expectPersianRtl(page);
  sessions.editor = await page.context().cookies();
});

test('T-AD2b the editor navigation has no admin-only entry', async ({ page }) => {
  await restoreSession(page, 'editor');
  await page.goto('/admin');
  const hrefs = await page
    .locator('a[href^="/admin/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs).toContain('/admin/collections/tags');
  for (const view of ADMIN_ONLY_VIEWS) {
    expect(hrefs.filter((href) => href.startsWith(view))).toEqual([]);
  }
});

test('T-AD3 an editor gets the not-found view on every admin-only area', async ({ page }) => {
  await restoreSession(page, 'editor');
  for (const view of ADMIN_ONLY_VIEWS) {
    const response = await page.goto(view);
    expect(response?.status(), view).toBe(404);
    await expect(page.getByRole('heading', { level: 1 }), view).toHaveText(NOT_FOUND_HEADING);
  }
});

test('T-AD4 an editor gets 403 from REST on globals and redirects', async ({ page }) => {
  await restoreSession(page, 'editor');
  await page.goto('/admin');
  // Positive control: the editor's session works for what editors may read.
  expect(await restStatus(page, '/api/tags?limit=1')).toBe(200);
  for (const path of ['/api/globals/clinic', '/api/globals/features', '/api/redirects']) {
    expect(await restStatus(page, path), path).toBe(403);
  }
});

test('T-AD5 an admin opens the same areas (control for T-AD3)', async ({ page }) => {
  await restoreSession(page, 'admin');
  // system-state is hidden for everyone (freeze 18); the status view has its own test.
  const views = ADMIN_ONLY_VIEWS.filter(
    (v) => v !== '/admin/globals/system-state' && v !== '/admin/system-status',
  );
  for (const view of views) {
    const response = await page.goto(view);
    expect(response?.status(), view).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }), view).not.toHaveText(NOT_FOUND_HEADING);
  }
});

test('T-AD6 an admin opens the System status view', async ({ page }) => {
  requireRoutes('statusView');
  await restoreSession(page, 'admin');
  const response = await page.goto('/admin/system-status');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('وضعیت سیستم');
});

test.describe('slug change in the admin', () => {
  const suffix = Date.now().toString(36);
  const oldSlug = persianSlug(`برچسب-آزمون-${suffix}`);
  const newSlug = persianSlug(`برچسب-آزمون-تازه-${suffix}`);
  const oldPath = buildPath('tags', { slug: oldSlug }) ?? '';
  const newPath = buildPath('tags', { slug: newSlug }) ?? '';

  test('T-AD7 changing a published slug writes an active 301 from the old path', async ({
    page,
  }) => {
    await restoreSession(page, 'admin');
    await page.goto('/admin/collections/tags/create');
    await page.locator('#field-title').fill(`برچسب آزمون ${suffix}`);
    await page.locator('#field-slug').fill(oldSlug);
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/tags',
    );
    await page.locator('#action-save').click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(/\/admin\/collections\/tags\/\d+/);

    await page.locator('#field-slug').fill(newSlug);
    const updated = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && /\/api\/tags\/\d+/.test(r.url()),
    );
    await page.locator('#action-save').click();
    expect((await updated).status()).toBe(200);

    const rows = await page.evaluate(
      (from) =>
        fetch(`/api/redirects?depth=0&where[from][equals]=${encodeURIComponent(from)}`).then((r) =>
          r.json(),
        ),
      oldPath,
    );
    expect(rows.docs).toEqual([
      expect.objectContaining({
        from: oldPath,
        to: newPath,
        statusCode: '301',
        active: true,
        source: 'slug_change',
      }),
    ]);
  });

  test('T-AD8 the old path answers 301 to the new one through the proxy', async ({ request }) => {
    requireRoutes('proxyConfig');
    const response = await request.get(encodeURI(oldPath), { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(new URL(newPath, APP_ORIGIN).href);
  });
});

test('T-AD9 admin login and dashboard screenshots at three widths, light and dark', async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  for (const size of Object.keys(VIEWPORTS) as ViewportName[]) {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...VIEWPORTS[size],
        baseURL: APP_ORIGIN,
        locale: 'fa-IR',
        timezoneId: 'Asia/Tehran',
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto('/admin/login');
      await expect(page.locator('#field-email')).toBeVisible();
      await captureTemplate(page, testInfo, 'admin-login', theme);

      await restoreSession(page, 'admin');
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin\/?$/);
      await expect(page.locator('a[href="/admin/collections/tags"]').first()).toBeAttached();
      await captureTemplate(page, testInfo, 'admin-dashboard', theme);
      await context.close();
    }
  }
});
