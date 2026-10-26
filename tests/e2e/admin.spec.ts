// Admin acceptance (docs/prompts/03-foundation.md): the admin loads in Persian RTL, MFA
// enrollment works, an editor cannot reach globals, users, redirects or system views; plus the
// slug-change redirect (deliverable 5) and the admin screenshots. Playwright's global setup
// resets the e2e accounts, so every run starts unenrolled.
//
// One serial file in its own project: the two accounts and their TOTP state are shared, and the
// sign-in endpoints allow 10 POSTs per 15 minutes per client key (decision 41). This file makes
// six: admin enrollment (2), admin verification (2), editor enrollment (2). Later tests reuse
// the sessions through their cookies.
import { randomBytes } from 'node:crypto';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';

import { cond, listHref, tabHref } from '@/admin/bookings/tabs';
import { CALENDAR_PATH } from '@/admin/calendar';
import { t } from '@/i18n/fa';
import { adminText } from '@/i18n/fa-admin';
import { ADMIN_ROUTE, buildPath } from '@/lib/paths';
import { persianSlug } from '@/lib/persianSlug';
import { toPersianDigits } from '@/lib/persianText';

import { signInToAdmin } from '../helpers/admin';
import { expectNoA11yViolations } from '../helpers/axe';
import { isolateClient, pastTimeTrap, uniquePhone } from '../helpers/booking';
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
  `${ADMIN_ROUTE}/globals/clinic`,
  `${ADMIN_ROUTE}/globals/seo-defaults`,
  `${ADMIN_ROUTE}/globals/features`,
  `${ADMIN_ROUTE}/globals/notifier`,
  `${ADMIN_ROUTE}/globals/system-state`,
  `${ADMIN_ROUTE}/collections/users`,
  `${ADMIN_ROUTE}/collections/redirects`,
  `${ADMIN_ROUTE}/system-status`,
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
  await page.goto(ADMIN_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${ADMIN_ROUTE}/login`));

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
  await page.goto(ADMIN_ROUTE);
  const hrefs = await page
    .locator(`a[href^="${ADMIN_ROUTE}/"]`)
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs).toContain(`${ADMIN_ROUTE}/collections/tags`);
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
  await page.goto(ADMIN_ROUTE);
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
    (v) => v !== `${ADMIN_ROUTE}/globals/system-state` && v !== `${ADMIN_ROUTE}/system-status`,
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
  const response = await page.goto(`${ADMIN_ROUTE}/system-status`);
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
    await page.goto(`${ADMIN_ROUTE}/collections/tags/create`);
    await page.locator('#field-title').fill(`برچسب آزمون ${suffix}`);
    await page.locator('#field-slug').fill(oldSlug);
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/tags',
    );
    await page.locator('#action-save').click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/collections/tags/\\d+`));

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
      await page.goto(`${ADMIN_ROUTE}/login`);
      // Payload renders the theme from Sec-CH-Prefers-Color-Scheme. Headless Chromium sends the
      // emulated value only after it has seen Accept-CH once (its Critical-CH retry carried none),
      // so the first render here is light even in dark: load the page once more.
      await page.reload();
      await expect(page.locator('#field-email')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await captureTemplate(page, testInfo, 'admin-login', theme);

      await restoreSession(page, 'admin');
      await page.goto(ADMIN_ROUTE);
      await expect(page).toHaveURL(new RegExp(`${ADMIN_ROUTE}/?$`));
      await expect(
        page.locator(`a[href="${ADMIN_ROUTE}/collections/tags"]`).first(),
      ).toBeAttached();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await captureTemplate(page, testInfo, 'admin-dashboard', theme);
      await context.close();
    }
  }
});

// Booking workflow (phase 5 freeze G15, admin-notify.md 4). Each test makes its own QA bookings
// through REST with a session already in this file (no new sign-in) and finds them by a unique
// name token; the e2e database is the only one these rows ever reach.
type QaBooking = { id: number; phone: string; phoneNational: string };

/** Opens the admin as `role` and returns a REST helper bound to that session. */
async function adminAs(page: Page, role: 'admin' | 'editor') {
  await restoreSession(page, role);
  await page.goto(ADMIN_ROUTE);
  return {
    create: async (data: Record<string, unknown>): Promise<QaBooking> => {
      const { status, body } = await page.evaluate(async (row) => {
        const response = await fetch('/api/bookings?depth=0', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
        return { status: response.status, body: await response.json() };
      }, data);
      expect(status, JSON.stringify(body)).toBe(201);
      return body.doc as QaBooking;
    },
    read: (id: number) =>
      page.evaluate(
        (bookingId) => fetch(`/api/bookings/${bookingId}?depth=0`).then((r) => r.json()),
        id,
      ),
  };
}

const token = (label: string) => `${label}${Date.now().toString(36)}`;
const listOf = (search: string, href = `${ADMIN_ROUTE}/collections/bookings?`) =>
  `${href}${href.endsWith('?') ? '' : '&'}search=${encodeURIComponent(search)}`;
const tabs = (page: Page) => page.getByRole('navigation', { name: adminText('admin.tabs.nav') });
const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });

test('T-AD10 tabs name their sort; «همه» undoes a saved sort and lists by urgency', async ({
  page,
}, testInfo) => {
  const api = await adminAs(page, 'admin');
  const name = token('فوریت');
  const done = await api.create({
    phone: uniquePhone(testInfo),
    name: `${name} پایان`,
    status: 'done',
  });
  const regular = await api.create({ phone: uniquePhone(testInfo), name: `${name} عادی` });
  const urgent = await api.create({
    phone: uniquePhone(testInfo),
    name: `${name} اورژانس`,
    kind: 'emergency',
    triage: ['swelling'],
  });

  // «مهلت تماس» saves sort=callbackDueAt as this user's list preference (the trap).
  await page.goto(tabHref('callbackDue'));
  const links = tabs(page).getByRole('link');
  await expect(links).toHaveCount(6);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute('href')))) {
    expect(href).toMatch(/[?&]sort=/);
  }
  await expect(
    tabs(page).getByRole('link', { name: adminText('admin.tabs.callbackDue') }),
  ).toHaveAttribute('aria-current', 'page');
  // A bare list URL now follows that saved sort: a notice says so and links back to urgency.
  await page.goto(listOf(name));
  const notice = page.getByText(adminText('admin.tabs.savedOrder'));
  await expect(notice).toBeVisible();
  await page.getByRole('link', { name: adminText('admin.tabs.urgencyOrder') }).click();
  await expect(page).toHaveURL(/sort=urgencyRank/);
  await expect(notice).toHaveCount(0);
  await page.goto(tabHref('callbackDue'));
  await tabs(page)
    .getByRole('link', { name: adminText('admin.tabs.all'), exact: true })
    .click();
  await expect(page).toHaveURL(/sort=urgencyRank/);
  await expect(
    tabs(page).getByRole('link', { name: adminText('admin.tabs.all'), exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  // Without a sort in the URL the saved one now is the urgency order again.
  await page.goto(listOf(name));
  const ids = await page
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((r) => r.querySelector('a[href*="/collections/bookings/"]')?.getAttribute('href')),
    );
  expect(ids.map((href) => Number(href?.split('/').pop()))).toEqual([
    urgent.id,
    regular.id,
    done.id,
  ]);
  await expect(row(page, `${name} اورژانس`)).toContainText(adminText('admin.kind.emergency'));
});

test('T-AD11 contact links per row: call and WhatsApp to the patient, 44 px targets', async ({
  page,
}, testInfo) => {
  const api = await adminAs(page, 'editor');
  const name = token('تماس');
  const booking = await api.create({ phone: uniquePhone(testInfo), name });
  await page.goto(listOf(name));
  const call = row(page, name).locator(`a[href="tel:${booking.phone}"]`);
  const whatsapp = row(page, name).locator(`a[href="https://wa.me/${booking.phone.slice(1)}"]`);
  await expect(call).toHaveAttribute('aria-label', /^تماس با بیمار ۰۹۹۹ \*\*\* /);
  await expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
  for (const link of [call, whatsapp]) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('T-AD12 an editor closes a request only with a note; the history note names the handler', async ({
  page,
}, testInfo) => {
  const admin = await adminAs(page, 'admin');
  const booking = await admin.create({
    phone: uniquePhone(testInfo),
    name: token('بستن'),
    status: 'contacted',
  });
  const editor = await adminAs(page, 'editor');
  await page.goto(`${ADMIN_ROUTE}/collections/bookings/${booking.id}`);
  await page.locator('#field-status .rs__control').click();
  await page.locator('.rs__option', { hasText: 'انجام شد' }).click();
  await page.locator('#action-save').click();
  await expect(
    page.getByText(adminText('admin.workflow.closeNote', { to: 'انجام شد' })).first(),
  ).toBeVisible();

  await page.locator('#field-adminNotes .array-field__add-row').first().click();
  await page.locator('#field-adminNotes__0__text').fill('بیمار نوبت را لغو نکرد و درمان انجام شد.');
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/bookings/${booking.id}`),
  );
  await page.locator('#action-save').click();
  expect((await saved).status()).toBe(200);
  const after = (await editor.read(booking.id)) as {
    status: string;
    handledBy: unknown;
    adminNotes: Array<{ text: string; author: unknown }>;
  };
  expect(after.status).toBe('done');
  expect(after.adminNotes.map((n) => n.text)).toEqual([
    'بیمار نوبت را لغو نکرد و درمان انجام شد.',
    'وضعیت از «تماس گرفته شد» به «انجام شد» تغییر کرد.',
  ]);
  expect(after.adminNotes[1]?.author).toBe(after.adminNotes[0]?.author);
});

test('T-AD13 «مشکوک» lists today’s suspicious requests; «بازگرداندن» restores in one click', async ({
  page,
}, testInfo) => {
  const admin = await adminAs(page, 'admin');
  const name = token('مشکوک');
  const booking = await admin.create({
    phone: uniquePhone(testInfo),
    name,
    status: 'suspicious',
    flags: ['honeypot'],
  });
  const editor = await adminAs(page, 'editor');
  await page.goto(listOf(name, tabHref('suspicious')));
  await expect(tabs(page).getByRole('link', { name: /مشکوک/ })).toContainText('امروز');
  // Not a verified request yet: call it first, no WhatsApp.
  await expect(row(page, name).locator(`a[href="tel:${booking.phone}"]`)).toBeVisible();
  await expect(row(page, name).locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  await row(page, name)
    .getByRole('button', { name: adminText('admin.restore') })
    .click();
  await expect(page.getByText(adminText('admin.restore.done'))).toBeVisible();
  await expect(row(page, name)).toHaveCount(0);
  const after = (await editor.read(booking.id)) as { status: string; flags: string[] };
  // «manual»: the admin created it in the panel (4.11).
  expect(after).toMatchObject({ status: 'new', flags: ['honeypot', 'manual', 'restored'] });
});

test('T-AD14 bulk «علامت هرزنامه» as an editor: two change, the scheduled one is refused', async ({
  page,
}, testInfo) => {
  const admin = await adminAs(page, 'admin');
  const name = token('انبوه');
  for (const status of ['new', 'contacted', 'scheduled']) {
    await admin.create({ phone: uniquePhone(testInfo), name: `${name} ${status}`, status });
  }
  await adminAs(page, 'editor');
  await page.goto(listOf(name));
  await expect(page.locator('tbody tr')).toHaveCount(3);
  for (const status of ['new', 'contacted', 'scheduled']) {
    // Payload's row checkbox stays disabled until the list hydrates.
    const select = row(page, `${name} ${status}`).locator('input[type="checkbox"]');
    await expect(select).toBeEnabled();
    await select.check();
  }
  await expect(page.getByText(adminText('admin.bulk.selected', { n: '۳' }))).toBeVisible();
  await page.locator('#bookings-bulk-spam').click();
  // Payload's confirmation modal names the count before anything changes.
  await expect(page.getByText(adminText('admin.bulk.confirm', { n: '۳' }))).toBeVisible();
  await page.locator('#confirm-action').click();
  await expect(
    page.getByText('۲ درخواست هرزنامه شد. ۱ درخواست با وضعیت فعلی‌اش هرزنامه نمی‌شود.'),
  ).toBeVisible();
});

test('T-AD15 CSV: an admin downloads the filter; an editor has no button and gets 403', async ({
  page,
}, testInfo) => {
  const admin = await adminAs(page, 'admin');
  const name = token('خروجی');
  const booking = await admin.create({ phone: uniquePhone(testInfo), name: `=${name}` });
  await page.goto(listOf(name));
  await expect(page.locator('#bookings-export-csv')).toBeVisible();
  const csv = await page.evaluate(async (search) => {
    const response = await fetch(`/api/bookings/export?search=${encodeURIComponent(search)}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      bom: [...bytes.slice(0, 3)],
      text: new TextDecoder().decode(bytes),
    };
  }, name);
  expect(csv).toMatchObject({
    status: 200,
    type: 'text/csv; charset=utf-8',
    bom: [0xef, 0xbb, 0xbf],
  });
  expect(csv.text).toContain('"شمارهٔ درخواست","زمان ثبت (UTC)"');
  const spaced = booking.phoneNational.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');
  expect(csv.text).toContain(`"${spaced}"`); // spaced: spreadsheets keep the leading 0
  expect(csv.text).toContain(`"'=${name}"`); // formula guard

  await adminAs(page, 'editor');
  await page.goto(listOf(name));
  await expect(tabs(page)).toBeVisible();
  await expect(page.locator('#bookings-export-csv')).toHaveCount(0);
  expect(await restStatus(page, '/api/bookings/export')).toBe(403);
});

test('T-AD16 the dashboard shows today’s numbers to admins and editors, linked to their lists', async ({
  page,
}) => {
  for (const role of ['admin', 'editor'] as const) {
    await adminAs(page, role);
    const widget = page.getByRole('region', { name: adminText('admin.today.heading') });
    await expect(widget, role).toBeVisible();
    // Four of today's figures, this month's «فوری نبود» share and the open emergencies (H33).
    await expect(widget.getByRole('link')).toHaveCount(6);
    // Every new request, as counted, most overdue first.
    await expect(widget.getByRole('link', { name: /منتظر تماس/ })).toHaveAttribute(
      'href',
      listHref(cond(0, 'status', 'equals', ['new']), 'callbackDueAt'),
    );
    await expect(
      widget.getByRole('link', { name: adminText('admin.today.openEmergency') }),
    ).toHaveAttribute('href', tabHref('emergency'));
    await expect(widget).toContainText(adminText('admin.today.notUrgent'));
    await expect(widget).not.toContainText('NaN');
  }
});

test('T-AD17 the notifier test action answers per channel (all off in e2e)', async ({ page }) => {
  await adminAs(page, 'admin');
  await page.goto(`${ADMIN_ROUTE}/globals/notifier`);
  await page.locator('#notifier-test').click();
  await expect(page.getByText('ایمیل: خاموش. تلگرام: خاموش. پیامک: خاموش.')).toBeVisible();
  // Editors get the 404 of the hidden global (admin-notify.md 7).
  await adminAs(page, 'editor');
  const status = await page.evaluate(() =>
    fetch('/api/globals/notifier/test', { method: 'POST' }).then((r) => r.status),
  );
  expect(status).toBe(404);
});

test('T-AD18 axe: the booking tabs, a booking’s contact block and the dashboard widget', async ({
  page,
}, testInfo) => {
  const api = await adminAs(page, 'admin');
  await expectNoA11yViolations(page, { include: 'section[aria-labelledby="bookings-today"]' });
  const booking = await api.create({ phone: uniquePhone(testInfo), name: token('دسترس') });
  await page.goto(tabHref('all'));
  await expectNoA11yViolations(page, {
    include: `nav[aria-label="${adminText('admin.tabs.nav')}"]`,
  });
  await page.goto(`${ADMIN_ROUTE}/collections/bookings/${booking.id}`);
  await expect(page.locator(`a[href="tel:${booking.phone}"]`)).toBeVisible();
  await expectNoA11yViolations(page, { include: `a[href="tel:${booking.phone}"]` });
});

test('T-AD19 bookings list and a booking at three widths, light and dark', async ({
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
      await restoreSession(page, 'admin');
      await page.goto(tabHref('all'));
      // As T-AD9: the first render may miss the emulated theme hint.
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(tabs(page)).toBeVisible();
      await captureTemplate(page, testInfo, 'admin-bookings', theme);
      const first = page.locator('tbody tr a[href*="/collections/bookings/"]').first();
      if ((await first.count()) > 0) {
        await first.click();
        await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/collections/bookings/\\d+`));
        await captureTemplate(page, testInfo, 'admin-booking', theme);
      }
      await context.close();
    }
  }
});

test('T-AD20 four emergencies from one address: the 4th is stored new with emergency_ip_rate', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // Integrator request R8 (G4, G12): nobody is blocked; the 4th in 24 hours is only flagged.
  // One client address for all four, its own phone each, past the 2 s time trap; no JavaScript,
  // so the server-rendered form posts and its tokens are in the HTML.
  const client = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(client);
  const visitor = await client.newPage();
  const form = visitor.locator('form[data-emergency-form]');
  const phones: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const phone = uniquePhone(testInfo);
    phones.push(phone);
    await visitor.goto(encodeURI('/اورژانس'));
    const opened = Date.now();
    await form.getByLabel(t('emergency.triage.severe_pain'), { exact: true }).check();
    await form.getByLabel(t('booking.phone')).fill(phone);
    await pastTimeTrap(opened);
    await form.getByRole('button', { name: t('emergency.submit') }).click();
    await expect(
      visitor.getByRole('heading', { name: t('emergency.done') }),
      `request ${i + 1}`,
    ).toBeVisible();
  }
  await client.close();

  await adminAs(page, 'admin');
  const stored = await page.evaluate(async (numbers) => {
    const rows = [];
    for (const national of numbers) {
      const query = `where[phoneNational][equals]=${national}&depth=0&sort=createdAt`;
      const body = await fetch(`/api/bookings?${query}`).then((r) => r.json());
      rows.push(body.docs.map((d: { status: string; flags: string[] }) => [d.status, d.flags]));
    }
    return rows;
  }, phones);
  expect(stored).toEqual([
    [['new', []]],
    [['new', []]],
    [['new', []]],
    [['new', ['emergency_ip_rate']]],
  ]);
});

// Phase 6 (docs/prompts/06-content-seo.md 2b, H32 to H35, C12 to C15). Documents made here carry
// Persian-only names (a Persian-digit token), so the English scan never trips on test data.
const faToken = () => toPersianDigits(`${Date.now()}`);

/**
 * H34: the only Latin words an editor may read (as src/collections/adminCopy.test.ts), plus the
 * authenticator app the plugin names, its network-error toast and the live preview's
 * «Responsive» size, recorded as deviations in the phase report (C15).
 */
const ALLOWED_LATIN = new Set([
  ...['ADA', 'AAPD', 'AAP', 'Cochrane', 'NHS', 'IADT'],
  ...['JPEG', 'JPG', 'PNG', 'HEIC', 'MP4', 'WebM', 'AVIF', 'WebP'],
  ...['VIP', 'CIP', 'NEEDS_CLIENT'],
  ...['Google', 'Authenticator', 'Something', 'went', 'wrong', 'Responsive'],
  // «کد QR» on the TOTP setup page: the code's own name, as on every phone.
  'QR',
]);

/**
 * Latin words in what the page shows (text, labels, placeholders, titles) after stored values
 * are taken out: table cells, chosen relationships, document titles, URLs, emails, file names.
 */
async function englishOn(page: Page): Promise<string[]> {
  const shown = await page.evaluate(() => {
    // Stored values (titles, cells, chosen options, file names) are data, not interface copy.
    const STORED =
      'tbody td, .rs__single-value, .rs__multi-value, .render-title, .step-nav__last, .file-details, .file-meta';
    const stored = [...document.querySelectorAll(STORED)].map(
      (el) => (el as HTMLElement).innerText,
    );
    let text = `${document.title}\n${document.body.innerText}`;
    for (const value of stored) if (value) text = text.replaceAll(value, ' ');
    const attributes = [...document.querySelectorAll('[aria-label], [placeholder], [title]')]
      // Third-party labels with no translation key (C15, phase 6 report): sonner's toast region and
      // close button, the title Payload's CheckboxInput copies from the field name, a drawer named
      // by its slug, and the Lexical toolbar and block handles (visible editor text stays checked).
      .filter(
        (el) =>
          !el.closest('tbody, .rich-text-lexical') &&
          !el.matches(
            `${STORED}, section[aria-label$="alt+T"], .payload-toast-close-button, input[type="checkbox"], dialog[class*="payload__modal-item--slug-"]`,
          ),
      )
      .flatMap((el) => ['aria-label', 'placeholder', 'title'].map((a) => el.getAttribute(a) ?? ''));
    return [text, ...attributes].join('\n');
  });
  const plain = shown
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\S+\.(jpe?g|png|webp|avif|gif|heic|mp4|webm|svg|csv)\b/gi, ' ')
    .replace(/\b(image|video|application|text)\/[\w.+-]+/g, ' ');
  return [...new Set(plain.match(/[A-Za-z][A-Za-z0-9_]+/g) ?? [])].filter(
    (w) => !ALLOWED_LATIN.has(w),
  );
}

async function expectPersianOnly(page: Page, where: string): Promise<void> {
  // The sign-in page has a form and no heading.
  await expect(page.locator('h1, h2, form').first(), where).toBeVisible();
  // Soft: one run lists every page that shows English.
  expect.soft(await englishOn(page), where).toEqual([]);
}

/** REST from inside the admin page, with the session's cookie; returns status and body. */
async function rest(page: Page, method: string, path: string, body?: object) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    { method, path, body },
  );
}

/** A 1200x900 JPEG uploaded to the media library as the signed-in user, with a Persian alt. */
async function uploadPhoto(page: Page, alt: string): Promise<number> {
  const jpeg = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: '#d9d3c7' },
  })
    .jpeg()
    .toBuffer();
  const { status, body } = await page.evaluate(
    async ({ b64, alt, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append('file', new File([bytes], name, { type: 'image/jpeg' }));
      form.append('_payload', JSON.stringify({ alt }));
      const response = await fetch('/api/media?depth=0', { method: 'POST', body: form });
      return { status: response.status, body: await response.json() };
    },
    { b64: jpeg.toString('base64'), alt, name: `case-${Date.now()}.jpg` },
  );
  expect(status, JSON.stringify(body)).toBe(201);
  return body.doc.id as number;
}

const EDITOR_COLLECTIONS = ['bookings', 'articles', 'tags', 'media', 'testimonials', 'cases'];

test('T-AD21 an editor reads no English: dashboard, lists, forms, a document each, account, calendar', async ({
  page,
}) => {
  test.setTimeout(240_000);
  requireRoutes('contentCalendar');
  await adminAs(page, 'editor');
  await expectPersianOnly(page, 'dashboard');
  for (const slug of EDITOR_COLLECTIONS) {
    await page.goto(`${ADMIN_ROUTE}/collections/${slug}`);
    await expectPersianOnly(page, `${slug} list`);
    const first = page.locator(`tbody tr a[href*="/collections/${slug}/"]`).first();
    if ((await first.count()) > 0) {
      await page.goto((await first.getAttribute('href')) ?? '');
      await expectPersianOnly(page, `${slug} document`);
    }
    await page.goto(`${ADMIN_ROUTE}/collections/${slug}/create`);
    await expectPersianOnly(page, `${slug} create`);
    // C15: the empty state of a search with no result.
    await page.goto(
      `${ADMIN_ROUTE}/collections/${slug}?search=${encodeURIComponent('واژه‌ای‌که‌نیست')}`,
    );
    await expectPersianOnly(page, `${slug} empty search`);
  }
  // The media preview sizes drawer names every size in English unless custom.scss hides it.
  await page.goto(
    `${ADMIN_ROUTE}/collections/media/${await uploadPhoto(page, `عکس نمونهٔ ${faToken()}`)}`,
  );
  await page.locator('.file-field__previewSizes').click();
  await expect(page.locator('.preview-sizes')).toBeVisible();
  await expectPersianOnly(page, 'media preview sizes');
  await page.goto(`${ADMIN_ROUTE}/account`);
  await expectPersianOnly(page, 'account');
  for (const view of [CALENDAR_PATH, `${CALENDAR_PATH}?kind=failed`]) {
    await page.goto(view);
    await expectPersianOnly(page, view);
  }
  // C15: a refused publish shows the block messages in the toast and under the fields.
  await page.goto(`${ADMIN_ROUTE}/collections/articles/create`);
  await page.locator('#field-title').fill(`مقالهٔ ناقص ${faToken()}`);
  await page.locator('#action-save').click();
  await expect(page.locator('.payload-toast-container li').first()).toBeVisible();
  await expectPersianOnly(page, 'refused publish');
});

test('T-AD21b the sign-in and TOTP setup pages are Persian too', async ({ browser, page }) => {
  await adminAs(page, 'admin');
  const email = `editor-${Date.now()}@sefid.test`;
  const password = randomBytes(18).toString('base64url');
  const created = await rest(page, 'POST', '/api/users?depth=0', {
    email,
    password,
    name: `ویراستار موقت ${faToken()}`,
    role: 'editor',
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  // One more sign-in POST for this file (seven of the ten allowed in 15 minutes).
  const context = await browser.newContext({ baseURL: APP_ORIGIN, locale: 'fa-IR' });
  const visitor = await context.newPage();
  await visitor.goto(`${ADMIN_ROUTE}/login`);
  await expectPersianOnly(visitor, 'login');
  await visitor.locator('#field-email').fill(email);
  await visitor.locator('#field-password').fill(password);
  await visitor.locator('form button[type="submit"]').click();
  await visitor.waitForURL(new RegExp(`${ADMIN_ROUTE}/setup-totp(\\?|$)`));
  await expectPersianOnly(visitor, 'setup-totp');
  await context.close();
  expect((await rest(page, 'DELETE', `/api/users/${created.body.doc.id}`)).status).toBe(200);
});

test('T-AD22 navigation by daily task; the calendar link after the groups (H32, C12)', async ({
  page,
}) => {
  requireRoutes('contentCalendar');
  const groups = () =>
    page
      .locator('.nav-group')
      .evaluateAll((all) =>
        all.map((g) => [
          g.querySelector('.nav-group__label')?.textContent?.trim() ?? '',
          [...g.querySelectorAll('a[id^="nav-"]')].map((a) => a.id),
        ]),
      );
  const linkOrder = () =>
    page.locator('nav a[id^="nav-"]').evaluateAll((all) => all.map((a) => a.id));

  await adminAs(page, 'admin');
  const adminGroups = await groups();
  expect(adminGroups.map(([label]) => label)).toEqual([
    'نوبت‌ها',
    'محتوا',
    'بیماران و نظرات',
    'تنظیمات',
    'سیستم',
  ]);
  expect(adminGroups[3]?.[1]).toEqual([
    'nav-insurances',
    'nav-financing-options',
    'nav-global-clinic',
    'nav-global-seo-defaults',
    'nav-global-features',
    'nav-global-notifier',
  ]);
  const adminLinks = await linkOrder();
  expect(adminLinks.slice(-2)).toEqual(['nav-content-calendar', 'nav-system-status']);
  // H32: no API tab on a document, for admins either (Payload has no per-role switch).
  await page.goto(`${ADMIN_ROUTE}/collections/tags`);
  const tag = page.locator('tbody tr a[href*="/collections/tags/"]').first();
  await page.goto((await tag.getAttribute('href')) ?? '');
  await expect(page.locator('.doc-tabs')).toBeVisible();
  await expect(page.locator('a[href$="/api"]')).toHaveCount(0);

  await adminAs(page, 'editor');
  expect(await groups()).toEqual([
    ['نوبت‌ها', ['nav-bookings']],
    ['محتوا', ['nav-articles', 'nav-tags', 'nav-media']],
    ['بیماران و نظرات', ['nav-testimonials', 'nav-cases']],
  ]);
  expect((await linkOrder()).slice(-1)).toEqual(['nav-content-calendar']);
});

test('T-AD26 a scheduled publish shows on its day in the calendar, for the editor too', async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  requireRoutes('contentCalendar');
  await adminAs(page, 'admin');
  const title = `مقالهٔ زمان‌بندی ${faToken()}`;
  const draft = await rest(page, 'POST', '/api/articles?draft=true&depth=0', { title });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  const id = draft.body.doc.id as number;

  // Payload's own scheduler: the publish menu, a day three days ahead, the first free time.
  await page.goto(`${ADMIN_ROUTE}/collections/articles/${id}`);
  await page.locator('#action-save-popup button').first().click();
  await page.locator('#schedule-publish').click();
  const drawer = page.locator('.schedule-publish');
  // Payload preselects «لغو انتشار» for a document with no newer version, a never-published one too.
  await drawer.locator('.schedule-publish__type li').first().locator('label').click();
  await drawer.locator('.react-datepicker__input-container input').click();
  const target = new Date(Date.now() + 3 * 86_400_000);
  const shownMonth = await page.locator('.react-datepicker__current-month').textContent();
  if (target.getMonth() !== new Date().getMonth()) {
    await page.locator('.react-datepicker__navigation--next').click();
    await expect(page.locator('.react-datepicker__current-month')).not.toHaveText(shownMonth ?? '');
  }
  const day = String(target.getDate()).padStart(3, '0');
  await page
    .locator(`.react-datepicker__day--${day}:not(.react-datepicker__day--outside-month)`)
    .click();
  await page
    .locator('.react-datepicker__time-list-item:not(.react-datepicker__time-list-item--disabled)')
    .first()
    .click();
  await page.locator('#scheduled-publish-save').click();
  await expect(drawer.locator('.schedule-publish__upcoming tbody tr')).toHaveCount(1);

  for (const role of ['admin', 'editor'] as const) {
    await adminAs(page, role);
    await page.goto(`${CALENDAR_PATH}?kind=scheduled`);
    // The draft also sits in the drafts list; the dated row carries the kind.
    const row = page
      .locator(`#content-calendar li:has(a[href="${ADMIN_ROUTE}/collections/articles/${id}"])`)
      .filter({ hasText: adminText('admin.calendar.kind.scheduled') });
    await expect(row, role).toHaveCount(1);
    await expect(row, role).toContainText(title);
    // The dashboard widget lists the next seven days.
    await page.goto(ADMIN_ROUTE);
    await expect(
      page
        .getByRole('region', { name: adminText('admin.calendar.title') })
        .getByRole('link', { name: title }),
      role,
    ).toBeVisible();
  }
  // The refused publish (a red row with the block messages) needs a past due time, which the
  // picker refuses: tests/int/calendar.int.test.ts CAL-I1 runs it through the real job queue.

  // Custom views are public: without a session the calendar is the admin's 404, not drafts.
  const context = await browser.newContext({ baseURL: APP_ORIGIN, locale: 'fa-IR' });
  const visitor = await context.newPage();
  // Without a session Payload's admin layout has streamed before the view runs, so the not-found
  // view comes with a 200 (a soft 404); a signed-in editor gets the real 404 (T-AD3).
  await visitor.goto(CALENDAR_PATH);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(NOT_FOUND_HEADING);
  await expect(visitor.locator('#content-calendar')).toHaveCount(0);
  await context.close();
});

test('T-AD27 dashboard order: requests, calendar, SEO health; content gaps for admins only', async ({
  page,
}) => {
  requireRoutes('contentCalendar');
  const widgets = () =>
    page
      .locator('section[aria-labelledby]')
      .evaluateAll((all) => all.map((s) => s.getAttribute('aria-labelledby')));
  await adminAs(page, 'admin');
  expect(await widgets()).toEqual(
    expect.arrayContaining([
      'bookings-today',
      'content-calendar-widget',
      'seo-health',
      'content-gaps-summary',
    ]),
  );
  const order = (await widgets()).filter((id) =>
    ['bookings-today', 'content-calendar-widget', 'seo-health', 'content-gaps-summary'].includes(
      id ?? '',
    ),
  );
  expect(order).toEqual([
    'bookings-today',
    'content-calendar-widget',
    'seo-health',
    'content-gaps-summary',
  ]);
  await expect(
    page
      .getByRole('region', { name: adminText('admin.gaps.heading') })
      .getByRole('link', { name: adminText('admin.gaps.open') }),
  ).toHaveAttribute('href', `${ADMIN_ROUTE}/system-status#status-gaps`);

  await adminAs(page, 'editor');
  await expect(page.getByRole('region', { name: adminText('admin.seo.heading') })).toBeVisible();
  await expect(page.getByRole('region', { name: adminText('admin.gaps.heading') })).toHaveCount(0);
});

test('T-AD31 an editor adds a case: two photos, written consent, publish (admin guide)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await adminAs(page, 'editor');
  const name = faToken();
  await uploadPhoto(page, `عکس قبل نمونهٔ ${name}`);
  await uploadPhoto(page, `عکس بعد نمونهٔ ${name}`);
  const title = `نمونهٔ آزمون ${name}`;

  await page.goto(`${ADMIN_ROUTE}/collections/cases/create`);
  await page.locator('#field-title').fill(title);
  await page.locator('#field-service .rs__control').click();
  await page.locator('.rs__option').first().click();
  for (const [field, which] of [
    ['before', 'قبل'],
    ['after', 'بعد'],
  ] as const) {
    await page.locator(`#field-${field} .upload__listToggler`).click();
    const drawer = page.locator('.list-drawer').last();
    await drawer
      .locator('tbody tr', { hasText: `عکس ${which} نمونهٔ ${name}` })
      .locator('button')
      .first()
      .click();
    await expect(drawer).toBeHidden();
  }
  // Without the consent box the publish is refused with the message the guide quotes.
  await page.locator('#action-save').click();
  await expect(
    page.getByText('بدون تأیید رضایت کتبی بیمار، انتشار ممکن نیست.').first(),
  ).toBeVisible();
  await page.locator('#field-consentConfirmed').check();
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.startsWith('/api/cases') &&
      ['POST', 'PATCH'].includes(r.request().method()),
  );
  await page.locator('#action-save').click();
  expect((await saved).ok()).toBe(true);
  const found = await rest(
    page,
    'GET',
    `/api/cases?depth=0&where[title][equals]=${encodeURIComponent(title)}`,
  );
  expect(found.body.docs).toEqual([
    expect.objectContaining({ title, _status: 'published', consentConfirmed: true }),
  ]);
});

test('T-AD32 an editor records an emergency outcome with a note', async ({ page }, testInfo) => {
  const admin = await adminAs(page, 'admin');
  const booking = await admin.create({
    phone: uniquePhone(testInfo),
    name: `اورژانس ${faToken()}`,
    kind: 'emergency',
    triage: ['swelling'],
  });
  const editor = await adminAs(page, 'editor');
  await page.goto(`${ADMIN_ROUTE}/collections/bookings/${booking.id}`);
  await page.locator('#field-emergencyOutcome .rs__control').click();
  await page.locator('.rs__option', { hasText: 'واقعاً فوری بود' }).click();
  await page.locator('#field-status .rs__control').click();
  await page.locator('.rs__option', { hasText: 'تماس گرفته شد' }).click();
  await page.locator('#field-adminNotes .array-field__add-row').first().click();
  await page.locator('#field-adminNotes__0__text').fill('ورم صورت داشت؛ برای امروز ساعت ۱۷ آمد.');
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/bookings/${booking.id}`),
  );
  await page.locator('#action-save').click();
  expect((await saved).status()).toBe(200);
  const after = (await editor.read(booking.id)) as {
    status: string;
    emergencyOutcome: string;
    adminNotes: Array<{ text: string }>;
  };
  expect(after).toMatchObject({ status: 'contacted', emergencyOutcome: 'truly_urgent' });
  expect(after.adminNotes.map((n) => n.text)).toContain('ورم صورت داشت؛ برای امروز ساعت ۱۷ آمد.');
});

test('T-AD33 axe: the calendar view, the three new widgets, the checklist and the SERP preview', async ({
  page,
}) => {
  requireRoutes('contentCalendar');
  await adminAs(page, 'admin');
  for (const id of ['content-calendar-widget', 'seo-health', 'content-gaps-summary']) {
    await expectNoA11yViolations(page, { include: `section[aria-labelledby="${id}"]` });
  }
  await page.goto(CALENDAR_PATH);
  await expectNoA11yViolations(page, { include: '#content-calendar' });
  await page.goto(`${ADMIN_ROUTE}/collections/articles/create`);
  for (const id of ['article-checklist-heading', 'serp-preview-heading']) {
    // Payload renders a group's fields only once it nears the viewport.
    if (id === 'serp-preview-heading') await page.locator('#field-seo').scrollIntoViewIfNeeded();
    await expect(page.locator(`section[aria-labelledby="${id}"]`)).toBeVisible();
    await expectNoA11yViolations(page, { include: `section[aria-labelledby="${id}"]` });
  }
});

test('T-AD34 the dashboard, the calendar and an article form at three widths, light and dark', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  requireRoutes('contentCalendar');
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
      await restoreSession(page, 'editor');
      await page.goto(ADMIN_ROUTE);
      // As T-AD9: the first render may miss the emulated theme hint.
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(
        page.getByRole('region', { name: adminText('admin.seo.heading') }),
      ).toBeVisible();
      await captureTemplate(page, testInfo, 'admin-dashboard-editor', theme);
      await page.goto(CALENDAR_PATH);
      await expect(page.locator('#content-calendar')).toBeVisible();
      await captureTemplate(page, testInfo, 'admin-calendar', theme);
      await page.goto(`${ADMIN_ROUTE}/collections/articles/create`);
      await expect(
        page.locator('section[aria-labelledby="article-checklist-heading"]'),
      ).toBeVisible();
      await captureTemplate(page, testInfo, 'admin-article', theme);
      await context.close();
    }
  }
});
