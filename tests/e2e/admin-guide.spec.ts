// The admin guide (docs/admin-guide.fa.md, plan 5.6) step by step: each test walks one section of
// the guide as the account the guide names (the receptionist is an editor; hours and the status
// view need the manager's admin account) and writes the screenshots that section shows. They land
// in docs/qa/admin-guide/ when QA_SCREENSHOTS is set, else only in the test report.
//
// This file runs in the `admin` project beside admin.spec.ts, which needs the e2e admin and editor
// unenrolled when it starts and has spent seven of the ten sign-in POSTs a client may send in 15
// minutes (decision 41). So this file never signs in as those two: it uses the third e2e account
// (`guide`, an admin) and a receptionist that account creates, and every test sends its requests
// from its own client address (isolateClient). Its six sign-in POSTs count only against itself.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { tabHref } from '@/admin/bookings/tabs';
import { adminText } from '@/i18n/fa-admin';
import { ADMIN_ROUTE } from '@/lib/paths';
import { toPersianDigits } from '@/lib/persianText';

import { setupSecret, signInToAdmin, totpCode } from '../helpers/admin';
import { isolateClient } from '../helpers/booking';
import { APP_ORIGIN } from '../helpers/servers';
import { e2eAccounts } from '../helpers/users';

test.describe.configure({ mode: 'serial' });

const GUIDE = path.resolve(process.cwd(), 'docs/admin-guide.fa.md');
const SHOTS_DIR = path.resolve(process.cwd(), 'docs/qa/admin-guide');

type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>;
const sessions: { manager?: Cookies; reception?: Cookies } = {};
/** The receptionist T-AG1 creates; deleted after the file. */
let reception: { id: number; secret: string } | undefined;
const cleanup: string[] = [];
/** The clinic hours before T-AG6 added a holiday; afterAll writes them back. */
let clinicHours: unknown;

test.beforeEach(async ({ context }) => {
  await isolateClient(context);
});

async function as(page: Page, who: 'manager' | 'reception'): Promise<void> {
  const cookies = sessions[who];
  if (!cookies) throw new Error(`No ${who} session: T-AG1 failed.`);
  await page.context().addCookies(cookies);
  await page.goto(ADMIN_ROUTE);
}

/** REST from inside the admin page, with the session's cookie; returns status and body. */
async function rest(page: Page, method: string, url: string, body?: object) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    { method, url, body },
  );
}

/** A request as a patient's form would leave it, made by the manager through REST. */
async function booking(page: Page, data: Record<string, unknown>): Promise<number> {
  const created = await rest(page, 'POST', '/api/bookings?depth=0', data);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.doc.id as number;
}

const faToken = () => toPersianDigits(`${Date.now()}`.slice(-6));
let phoneSeq = 0;
/** 0999 and seven digits from the clock: no other test's phone, no per-phone rule hit. */
const phone = () =>
  `0999${String((Date.now() + (phoneSeq += 7919)) % 10_000_000).padStart(7, '0')}`;

/**
 * The guide's screenshot `name`.png: the viewport as the reader sees it, with the control the step
 * names outlined. Written to docs/qa/admin-guide/ only when QA_SCREENSHOTS is set. The outline
 * stays: no page gets a second shot, and a refused-save tooltip may be gone by then.
 */
async function shot(page: Page, name: string, target?: Locator): Promise<void> {
  if (target) {
    // One evaluate: it resolves the locator again if a hydrating form replaced the element.
    await target.evaluate((el: HTMLElement) => {
      el.scrollIntoView({ block: 'center' });
      el.style.outline = '4px solid #f76707';
      el.style.outlineOffset = '3px';
    });
  }
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.fonts.ready);
  const body = await page.screenshot({ animations: 'disabled' });
  if (process.env.QA_SCREENSHOTS) {
    await mkdir(SHOTS_DIR, { recursive: true });
    await sharp(body)
      .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
      .toFile(path.join(SHOTS_DIR, `${name}.png`));
  }
  await test.info().attach(`${name}.png`, { body, contentType: 'image/png' });
}

/** Every screenshot this file writes, in the guide's order; T-AG9 holds the guide to it. */
const SHOTS = [
  'sign-in',
  'totp-setup',
  'dashboard',
  'totp-code',
  'tabs',
  'callback-call',
  'callback-note',
  'close-refused',
  'spam-confirm',
  'emergency',
  'holidays',
  'system-status',
  'schedule-unpublish',
] as const;

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
/** The list's search box. The list reloads once the URL carries the search: select after that. */
async function search(page: Page, text: string): Promise<void> {
  await page.locator('#search-filter-input').fill(text);
  await page.waitForURL((url) => url.searchParams.get('search') === text);
  await expect(page.locator('tbody tr')).toHaveCount(1);
}
const select = async (page: Page, field: string, option: string) => {
  await page.locator(`#field-${field} .rs__control`).click();
  await page.locator('.rs__option', { hasText: option }).click();
};
const saved = (page: Page, id: number) =>
  page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/bookings/${id}`),
  );

test('T-AG1 section 1: the first sign-in sets up the code; later sign-ins ask for it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { guide } = e2eAccounts();
  await signInToAdmin(page, guide); // two sign-in POSTs
  sessions.manager = await page.context().cookies();
  const email = `reception-${Date.now().toString(36)}@sefid.test`;
  const password = randomBytes(18).toString('base64url');
  const created = await rest(page, 'POST', '/api/users?depth=0', {
    email,
    password,
    name: 'پذیرش آزمون',
    role: 'editor',
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  reception = { id: created.body.doc.id as number, secret: '' };
  await page.context().clearCookies();

  // Steps 1 to 6: the first sign-in (two POSTs).
  await page.goto(`${ADMIN_ROUTE}/login`);
  await page.locator('#field-email').fill(email);
  await page.locator('#field-password').fill(password);
  await shot(page, 'sign-in', page.locator('form button[type="submit"]'));
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/setup-totp(\\?|$)`));
  await shot(page, 'totp-setup', page.locator('form input[maxlength="1"]').first());
  reception.secret = await setupSecret(page);
  await page.locator('form input[maxlength="1"]').first().click();
  await page.keyboard.type(totpCode(reception.secret));
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === ADMIN_ROUTE);
  const today = page.getByRole('region', { name: adminText('admin.today.heading') });
  await expect(today).toBeVisible();
  await shot(page, 'dashboard', today);

  // Steps 7 to 9: every later sign-in (two POSTs).
  await page.context().clearCookies();
  await page.goto(`${ADMIN_ROUTE}/login`);
  await page.locator('#field-email').fill(email);
  await page.locator('#field-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/verify-totp(\\?|$)`));
  await shot(page, 'totp-code', page.locator('form input[maxlength="1"]').first());
  await page.locator('form input[maxlength="1"]').first().click();
  await page.keyboard.type(totpCode(reception.secret));
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === ADMIN_ROUTE);
  sessions.reception = await page.context().cookies();
});

test('T-AG2 sections 2 and 3: today’s requests, then a callback with a note', async ({ page }) => {
  await as(page, 'manager');
  const name = `مریم آزمون ${faToken()}`;
  const id = await booking(page, { phone: phone(), name });
  await page.context().clearCookies();
  await as(page, 'reception');

  // Section 2: the dashboard link, then the tabs.
  await page
    .getByRole('region', { name: adminText('admin.today.heading') })
    .getByRole('link', { name: /منتظر تماس/ })
    .click();
  const tabs = page.getByRole('navigation', { name: adminText('admin.tabs.nav') });
  await expect(tabs).toBeVisible();
  await shot(page, 'tabs', tabs);

  // Section 3: search the name, call from the row, open the request.
  await page.goto(tabHref('callbackDue'));
  await search(page, name);
  const call = row(page, name).locator('a[href^="tel:"]');
  await expect(call).toBeVisible();
  await shot(page, 'callback-call', call);
  await row(page, name)
    .locator(`a[href^="${ADMIN_ROUTE}/collections/bookings/${id}"]`)
    .first()
    .click();
  await page.waitForURL(new RegExp(`/collections/bookings/${id}`));
  await select(page, 'status', 'تماس گرفته شد');
  await page.locator('#field-adminNotes .array-field__add-row').first().click();
  await page.locator('#field-adminNotes__0__text').fill('تماس گرفتم. فردا ساعت ۱۱ می‌آید.');
  await shot(page, 'callback-note', page.locator('#field-adminNotes'));
  const done = saved(page, id);
  await page.locator('#action-save').click();
  expect((await done).status()).toBe(200);
  const after = await rest(page, 'GET', `/api/bookings/${id}?depth=0`);
  expect(after.body).toMatchObject({ status: 'contacted' });
});

test('T-AG3 section 4: closing needs a note in the same save', async ({ page }) => {
  await as(page, 'manager');
  const name = `رضا آزمون ${faToken()}`;
  const id = await booking(page, { phone: phone(), name, status: 'contacted' });
  await page.context().clearCookies();
  await as(page, 'reception');
  await page.goto(`${ADMIN_ROUTE}/collections/bookings/${id}`);
  await select(page, 'status', 'انجام شد');
  await page.locator('#action-save').click();
  const refused = page.getByText(adminText('admin.workflow.closeNote', { to: 'انجام شد' })).first();
  await expect(refused).toBeVisible();
  await shot(page, 'close-refused', refused);
  await page.locator('#field-adminNotes .array-field__add-row').first().click();
  await page.locator('#field-adminNotes__0__text').fill('درمان انجام شد. نوبت بعدی ندارد.');
  const done = saved(page, id);
  await page.locator('#action-save').click();
  expect((await done).status()).toBe(200);
  const after = await rest(page, 'GET', `/api/bookings/${id}?depth=0`);
  expect(after.body).toMatchObject({ status: 'done' });
});

test('T-AG4 section 5: spam from the list, after the count is confirmed', async ({ page }) => {
  await as(page, 'manager');
  const name = `تبلیغ آزمون ${faToken()}`;
  const id = await booking(page, { phone: phone(), name });
  await page.context().clearCookies();
  await as(page, 'reception');
  await page.goto(tabHref('new'));
  await search(page, name);
  const box = row(page, name).locator('input[type="checkbox"]');
  await expect(box).toBeEnabled(); // Payload enables it once the list hydrates
  await box.check();
  await page.locator('#bookings-bulk-spam').click();
  await expect(page.getByText(adminText('admin.bulk.confirm', { n: '۱' }))).toBeVisible();
  await shot(page, 'spam-confirm', page.locator('#confirm-action'));
  await page.locator('#confirm-action').click();
  await expect(page.getByText(adminText('admin.bulk.done', { n: '۱' }))).toBeVisible();
  const after = await rest(page, 'GET', `/api/bookings/${id}?depth=0`);
  expect(after.body).toMatchObject({ status: 'spam' });
});

test('T-AG5 section 6: an emergency request, its outcome and a note', async ({ page }) => {
  await as(page, 'manager');
  const name = `اورژانس آزمون ${faToken()}`;
  const id = await booking(page, {
    phone: phone(),
    name,
    kind: 'emergency',
    triage: ['swelling'],
  });
  await page.context().clearCookies();
  await as(page, 'reception');
  await page.goto(tabHref('emergency'));
  await search(page, name);
  await row(page, name)
    .locator(`a[href^="${ADMIN_ROUTE}/collections/bookings/${id}"]`)
    .first()
    .click();
  await page.waitForURL(new RegExp(`/collections/bookings/${id}`));
  await select(page, 'emergencyOutcome', 'واقعاً فوری بود');
  await select(page, 'status', 'تماس گرفته شد');
  await page.locator('#field-adminNotes .array-field__add-row').first().click();
  await page.locator('#field-adminNotes__0__text').fill('ورم صورت دارد. امروز ساعت ۱۷ می‌آید.');
  await shot(page, 'emergency', page.locator('#field-emergencyOutcome'));
  const done = saved(page, id);
  await page.locator('#action-save').click();
  expect((await done).status()).toBe(200);
  const after = await rest(page, 'GET', `/api/bookings/${id}?depth=0`);
  expect(after.body).toMatchObject({ status: 'contacted', emergencyOutcome: 'truly_urgent' });
});

test('T-AG6 section 7: a holiday, with the manager account', async ({ page }) => {
  await as(page, 'manager');
  const before = await rest(page, 'GET', '/api/globals/clinic?depth=0');
  expect(before.status).toBe(200);
  const rows = (before.body.hours?.holidays ?? []).length as number;
  // Day 2 of next Nowruz: never past, and the QA fixture holds day 1.
  const year = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric' })
    .formatToParts(new Date())
    .find((part) => part.type === 'year')?.value;
  const date = `${toPersianDigits(String(Number(year) + 1))}/۰۱/۰۲`;
  clinicHours = before.body.hours; // afterAll puts them back: the public specs read these hours
  await page.getByRole('link', { name: 'ویرایش اطلاعات کلینیک' }).click();
  await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/globals/clinic`));
  await page.locator('.tabs-field__tab-button', { hasText: 'ساعات و تعطیلات' }).click();
  await page.locator('#field-hours__holidays .array-field__add-row').first().click();
  await page.locator(`#field-hours__holidays__${rows}__dateJalali`).fill(date);
  await page.locator(`#field-hours__holidays__${rows}__labelFa`).fill('تعطیل نوروز');
  await shot(page, 'holidays', page.locator(`#field-hours__holidays__${rows}__dateJalali`));
  const stored = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/globals/clinic'),
  );
  await page.locator('#action-save').click();
  expect((await stored).status()).toBe(200);
  const after = await rest(page, 'GET', '/api/globals/clinic?depth=0');
  expect(after.body.hours.holidays[rows]).toMatchObject({ labelFa: 'تعطیل نوروز' });
  expect(after.body.hours.holidays[rows].date).toMatch(/^\d{4}-03-2[12]$/);
});

test('T-AG7 section 8: the status view, with the manager account', async ({ page }) => {
  await as(page, 'manager');
  // A new account starts with the menu closed.
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await page.getByRole('link', { name: 'وضعیت سیستم', exact: true }).click();
  await page.waitForURL(new RegExp(`${ADMIN_ROUTE}/system-status`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('وضعیت سیستم');
  const config = page.locator('section[aria-labelledby="status-config"] dl > div');
  // The e2e server's QA switches (a red row live never shows) would teach the wrong «normal».
  await config
    .filter({ has: page.locator('dt', { hasText: 'تنظیمات ویژهٔ آزمون' }) })
    .evaluate((el: HTMLElement) => (el.style.display = 'none'));
  // Red on every server until the clinic's SMTP exists (gap 55): the guide says it is normal.
  const mail = config.filter({ has: page.locator('dt', { hasText: 'ارسال ایمیل' }) });
  await shot(page, 'system-status', mail.locator('dd'));
});

test('T-AG8 section 9: the schedule drawer preselects «لغو انتشار» on a never-published draft', async ({
  page,
}) => {
  await as(page, 'manager');
  const draft = await rest(page, 'POST', '/api/articles?draft=true&depth=0', {
    title: `پیش‌نویس راهنما ${faToken()}`,
  });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  cleanup.push(`/api/articles/${draft.body.doc.id}`);
  await page.context().clearCookies();
  await as(page, 'reception');
  await page.goto(`${ADMIN_ROUTE}/collections/articles/${draft.body.doc.id}`);
  await page.locator('#action-save-popup button').first().click();
  await page.locator('#schedule-publish').click();
  const drawer = page.locator('.schedule-publish');
  // Payload phase 6 I1: the wrong choice is the default. The guide says to pick «انتشار».
  await expect(drawer.getByRole('radio', { name: 'لغو انتشار' })).toBeChecked();
  await expect(drawer.getByRole('radio', { name: 'انتشار', exact: true })).not.toBeChecked();
  await shot(page, 'schedule-unpublish', drawer.locator('.schedule-publish__type'));
});

test('T-AG9 the guide follows the copy rules and shows exactly the screenshots this file writes', () => {
  const guide = readFileSync(GUIDE, 'utf8');
  const images = [...guide.matchAll(/!\[[^\]]+\]\(qa\/admin-guide\/([a-z-]+)\.png\)/g)].map(
    (m) => m[1],
  );
  expect(images).toEqual([...SHOTS]);
  // Prose only: code spans (addresses) and image paths are not copy.
  const prose = guide
    .replace(/`[^`]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']')
    .split('\n');
  for (const line of prose) {
    // docs/qa/audit-rtl-copy.md 1.2: the per-string rules of SC3 and CP1.
    for (const word of ['بهترین', 'بی‌نظیر', 'تضمینی', 'ارزان‌ترین', 'معجزه', 'منشی']) {
      expect(line).not.toContain(word);
    }
    expect(line, line).not.toMatch(/[يكى]/);
    expect(line, line).not.toMatch(/[—–]/);
    expect(line, line).not.toMatch(/[0-9]/);
    expect(line, line).not.toMatch(/\([^)]*[A-Za-z][^)]*\)/);
    expect(line, line).not.toMatch(/\[\[NEEDS_CLIENT/);
    expect(line, line).not.toMatch(/(^|[\s«])ن?می [آ-ی]/);
    expect(line, line).not.toMatch(/ (ها|های|هایی|تر|ترین)([\s.،؟»]|$)/);
    // Gap 62: no authenticator product until the client names one.
    expect(line, line).not.toMatch(/Google|Microsoft|Authy|گوگل|مایکروسافت/i);
  }
});

test.afterAll(async ({ browser }) => {
  if (!sessions.manager) return;
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  await isolateClient(context);
  const page = await context.newPage();
  await as(page, 'manager');
  if (clinicHours) {
    const restored = await rest(page, 'POST', '/api/globals/clinic?depth=0', {
      hours: clinicHours,
    });
    expect(restored.status, JSON.stringify(restored.body)).toBe(200);
  }
  for (const url of cleanup) await rest(page, 'DELETE', url);
  if (reception) {
    expect((await rest(page, 'DELETE', `/api/users/${reception.id}`)).status).toBe(200);
  }
  await context.close();
});
