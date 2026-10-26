// Home (phase 4 deliverable 3 and its acceptance criteria): the ten T-home sections in order,
// the layout-family rule, hero B fit and LCP per width, the single scoped image preload, no
// layout shift when the form session arrives or the hero card shows success, and the booking
// form's validation and send. Rows that do not depend on the theme run in one project only.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SECTIONS = [
  'hero',
  'trust',
  'services',
  'restoration',
  'compare',
  'dentists',
  'voices',
  'journey',
  'faq',
  'booking',
];

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  // Hydrated: the form islands switch to their own validation (a click before that is the no-JS
  // path, which navigates to /رزرو-نوبت).
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-booking-form] form')].every(
      (form) => (form as HTMLFormElement).noValidate,
    ),
  );
}

/** The element of the current LCP candidate (the last buffered entry). */
async function lcp(page: Page): Promise<{ tag: string; id: string; hero: boolean; what: string }> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const el = (list.getEntries().at(-1) as PerformanceEntry & { element: Element | null })
            .element;
          resolve({
            tag: el?.tagName ?? '',
            id: el?.id ?? '',
            hero: Boolean(el?.closest('[data-home-section="hero"]')),
            // Names the element in a failure message: tag, classes and the start of its text.
            what: el ? `${el.tagName}.${el.className} "${el.textContent?.slice(0, 40)}"` : 'none',
          });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }),
  );
}

/** Sum of layout shifts after `since` (performance.now() time), recorded from navigation. */
async function shiftSince(page: Page, since: number): Promise<number> {
  return page.evaluate(
    (t) =>
      (window as unknown as { __shifts: Array<{ value: number; startTime: number }> }).__shifts
        .filter((s) => s.startTime >= t)
        .reduce((sum, s) => sum + s.value, 0),
    since,
  );
}

/**
 * A stubbed `{ ok: true }` answer: the island's success state without storing a booking (no
 * callback line, so the generic one shows). The real pipeline runs in home-booking.spec.ts.
 */
const acceptBookings = (page: Page) => answerBookings(page, { status: 200, json: { ok: true } });

/** axe with every rule, best practices included (landmark-unique is not a WCAG-tagged rule). */
async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).exclude('[data-dev-overlay]').analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe violations on ${page.url()}`).toEqual([]);
}

/** Counts the booking POSTs and answers each with `answer` instead of the real handler. */
async function answerBookings(
  page: Page,
  answer: { status: number; json?: unknown },
): Promise<() => number> {
  let posts = 0;
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && decodeURI(new URL(req.url()).pathname) === '/رزرو-نوبت') {
      posts += 1;
      await route.fulfill(answer);
    } else await route.continue();
  });
  return () => posts;
}

async function recordShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: Array<{ value: number; startTime: number }> };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number }>) {
        w.__shifts.push({ value: e.value, startTime: e.startTime });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

test('T-HOME1 the ten T-home sections in reading order, at least five families, none twice', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/');
  const sections = await page
    .locator('[data-home-section]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-home-section')));
  expect(sections).toEqual(SECTIONS);
  const families = await page
    .locator('[data-family]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-family')));
  const counts = new Map<string, number>();
  for (const f of families) counts.set(f ?? '', (counts.get(f ?? '') ?? 0) + 1);
  expect(counts.size).toBeGreaterThanOrEqual(5);
  for (const [family, count] of counts) expect(count, family).toBeLessThanOrEqual(2);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('T-HOME2 at 390x844 the header, the scrim and the whole card sit above the sticky bar', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'phone-dark');
  await page.goto('/');
  await ready(page);
  const viewport = page.viewportSize()?.height ?? 844;
  const bar = page.locator('[data-sticky-bar]');
  const barHeight = (await bar.count()) ? ((await bar.boundingBox())?.height ?? 64) : 64;
  const submit = page.locator('#bk-hero').getByRole('button', { name: 'ثبت درخواست' });
  const box = await submit.boundingBox();
  expect(box, 'the hero submit').not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport - barHeight);
  // Nothing to scroll: the page opens at the top with the H1 under the header.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await page.locator('#hero-h1').boundingBox())?.y ?? -1).toBeGreaterThan(0);
});

test('T-HOME3 the 4:5 photo band starts below the first screen on phones', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light');
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [440, 956],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await ready(page);
    const top = await page
      .locator('[data-home-section="hero"] picture')
      .evaluate((el) => el.parentElement!.getBoundingClientRect().top);
    expect(top, `${width}x${height}`).toBeGreaterThanOrEqual(height - 1);
  }
});

test('T-HOME4 LCP: a scrim text element under 744 px, the hero photo from 744 px', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const cases = [
    [390, 844, 'text'],
    [430, 932, 'text'],
    [440, 956, 'text'],
    [744, 1133, 'img'],
    [820, 1180, 'img'],
    [1024, 768, 'img'],
    [1440, 900, 'img'],
  ] as const;
  for (const [width, height, kind] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await ready(page);
    await page.waitForTimeout(500);
    const element = await lcp(page);
    const at = `${width}x${height}: ${element.what}`;
    expect(element.hero, at).toBe(true);
    if (kind === 'img') expect(element.tag, at).toBe('IMG');
    else expect(['hero-h1', 'hero-sub'], at).toContain(element.id);
  }
});

test('T-HOME5 one image preload, scoped to 744 px with high priority; the img is eager and normal', async ({
  request,
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const html = await (await request.get('/')).text();
  const head = html.slice(0, html.indexOf('</head>'));
  const preloads = head.match(/<link[^>]*rel="preload"[^>]*as="image"[^>]*>/g) ?? [];
  expect(preloads).toHaveLength(1);
  expect(preloads[0]).toContain('media="(min-width: 744px)"');
  expect(preloads[0]).toMatch(/fetchpriority="high"/i);
  expect(html.match(/as="image"/g)).toHaveLength(1);
  await page.goto('/');
  const img = page.locator('[data-home-section="hero"] picture img');
  await expect(img).not.toHaveAttribute('loading', 'lazy');
  await expect(img).not.toHaveAttribute('fetchpriority', 'high');
  const wide = await page
    .locator('[data-home-section="hero"] source[media="(min-width: 744px)"][type="image/avif"]')
    .getAttribute('srcset');
  expect(
    await page.locator('head link[rel="preload"][as="image"]').getAttribute('imagesrcset'),
  ).toBe(wide);
});

test('T-HOME6 the home HTML holds no token, timestamp or hours sentence', async ({
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const html = await (await request.get('/')).text();
  expect(html).not.toMatch(/name="(csrf|ts)"[^>]*value="[^"]+"/);
  expect(html).not.toMatch(/v1\.[0-9a-z]{1,11}\.[A-Za-z0-9_-]{43}/);
  for (const sentence of [
    'دقیقهٔ دیگر',
    'کلینیک الان بسته است',
    'از ساعت ۱۰ با شما',
    'الان باز است',
  ]) {
    expect(html, sentence).not.toContain(sentence);
  }
});

test('T-HOME7 no layout shift when the form session arrives', async ({ page }, testInfo) => {
  only(testInfo, 'phone-light', 'phone-dark', 'tablet-light', 'desktop-light', 'desktop-dark');
  await recordShifts(page);
  // Hold the session answer until the block is on screen, and answer «calls allowed», so the
  // hours-dependent phone line fills in view (outside clinic hours it would stay empty).
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/form-session', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.hours.callsAllowed = true;
    await held;
    await route.fulfill({ response, json });
  });
  await page.goto('/');
  await ready(page);
  const block = page.locator('#bk-block');
  await block.locator('[type="submit"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => performance.now());
  release();
  await expect(block.locator('form a[href^="tel:"]')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await shiftSince(page, before)).toBe(0);
});

test('T-HOME8 the booking form validates on submit and on blur with the conversion.md messages', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await page.goto('/');
  await ready(page);
  const card = page.locator('#bk-hero');
  const phone = card.getByLabel('شمارهٔ موبایل');
  await card.getByRole('button', { name: 'ثبت درخواست' }).click();
  const error = card.locator('#bk-hero-phone-error');
  await expect(error).toHaveText('شمارهٔ موبایل را وارد کنید.');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toBeFocused();
  await phone.fill('021 5510 1054');
  await phone.blur();
  await expect(error).toHaveText('این شمارهٔ تلفن ثابت است. شمارهٔ موبایل را وارد کنید.');
  await phone.fill('0912 345');
  await phone.blur();
  await expect(error).toHaveText('شمارهٔ موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.');
  await phone.fill('۰۹۱۲ ۳۴۵ ۶۷۸۹');
  await phone.blur();
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
  await expect(error).toHaveCount(0);
  // The full form in scene 10: the note's limit.
  const block = page.locator('#bk-block');
  await block.getByText('توضیح بیشتر').click();
  await block.getByLabel('توضیح (اختیاری)').fill('ا'.repeat(501));
  await block.getByLabel('شمارهٔ موبایل').fill('09123456789');
  await block.getByRole('button', { name: 'ثبت درخواست' }).click();
  await expect(block.locator('#bk-block-note-error')).toHaveText(
    'توضیح بیشتر از ۵۰۰ حرف است. آن را کوتاه‌تر کنید.',
  );
  await expect(block.getByLabel('توضیح (اختیاری)')).toBeFocused();
});

test('T-HOME9 the compact success keeps the card size and position; focus on its heading', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-dark', 'desktop-light');
  const posts = await acceptBookings(page);
  const session = page.waitForResponse('**/api/form-session');
  await page.goto('/');
  await ready(page);
  await session;
  const card = page.locator('#bk-hero');
  const before = await card.boundingBox();
  await card.getByLabel('شمارهٔ موبایل').fill('09123456789');
  await card.getByRole('button', { name: 'ثبت درخواست' }).click();
  const done = card.getByRole('heading', { name: 'درخواست شما ثبت شد' });
  await expect(done).toBeFocused();
  await expect(card).toHaveAttribute('data-state', 'success');
  await expect(card.getByText('۰۹۱۲ *** ۶۷۸۹')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const after = await card.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  // The chrome's «رزرو نوبت» now routes to the scene 10 block, not to the done card.
  await expect(page.locator('[data-booking-form="hero"]')).toHaveCount(0);
  expect(posts()).toBe(1);
});

test('T-HOME10 the H1: two lines from 1024 px, at most three from 360 px', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const lines = async () =>
    page.locator('#hero-h1').evaluate((el) => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.getBoundingClientRect().height / lineHeight);
    });
  for (const width of [360, 375, 390, 414, 430, 744, 764, 784, 804, 820, 900, 1023]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await ready(page);
    expect(await lines(), `${width}`).toBeLessThanOrEqual(3);
  }
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await ready(page);
    expect(await lines(), `${width}`).toBe(2);
  }
});

test('T-HOME11 no horizontal scroll from 320 px', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light', 'desktop-dark');
  for (const width of [320, 360, 390, 430, 744, 820, 1023, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await ready(page);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll, `${width}`).toBeLessThanOrEqual(width);
  }
});

test('T-HOME12 a tier step carries its tier and service into the scene 10 form', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await page.goto('/');
  await ready(page);
  const section = page.locator('[data-home-section="restoration"]');
  const form = page.locator('[data-booking-form="block"] form');
  // No preselected tier (F24): the one visible «رزرو نوبت» carries the service only.
  await expect(section.getByRole('radio', { checked: true })).toHaveCount(0);
  const plain = section.getByRole('link', { name: 'رزرو نوبت', exact: true });
  await expect(plain).toHaveCount(1);
  expect(decodeURI((await plain.getAttribute('href')) ?? '')).toBe(
    '/رزرو-نوبت?service=restoration',
  );
  await plain.click();
  await expect(form.locator('input[name="tier"]')).toHaveValue('');
  await expect(form.locator('input[name="service_key"]')).toHaveValue('restoration');
  await section.getByRole('radio', { name: 'VIP' }).check();
  const cta = section.locator('[data-tier-panel="vip"]').getByRole('link', { name: 'رزرو نوبت' });
  await expect(cta).toBeVisible();
  await expect(plain).toHaveCount(1);
  await cta.click();
  await expect(form.locator('input[name="tier"]')).toHaveValue('vip');
  await expect(form.locator('input[name="service_key"]')).toHaveValue('restoration');
  await expect(page).toHaveURL(/\/$/);
});

test('T-HOME13 axe, every rule: the page, the form error states and the compact success', async ({
  page,
}) => {
  await acceptBookings(page);
  await page.goto('/');
  await ready(page);
  await expectNoAxeViolations(page);
  const block = page.locator('#bk-block');
  await page.locator('#bk-hero').getByRole('button', { name: 'ثبت درخواست' }).click();
  await block.getByText('توضیح بیشتر').click();
  await block.getByRole('button', { name: 'ثبت درخواست' }).click();
  await expect(block.locator('#bk-block-phone-error')).toBeVisible();
  await expectNoAxeViolations(page);
  const card = page.locator('#bk-hero');
  await card.getByLabel('شمارهٔ موبایل').fill('09123456789');
  await card.getByRole('button', { name: 'ثبت درخواست' }).click();
  await expect(card).toHaveAttribute('data-state', 'success');
  await expectNoAxeViolations(page);
});

test('T-HOME14 a booking handler that answered is never posted twice; the failure shows', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  const posts = await answerBookings(page, { status: 500 });
  await page.goto('/');
  await ready(page);
  const card = page.locator('#bk-hero');
  await card.getByLabel('شمارهٔ موبایل').fill('09123456789');
  await card.getByRole('button', { name: 'ثبت درخواست' }).click();
  await expect(card.getByRole('alert')).toContainText('مشکلی در سایت پیش آمد');
  await expect(card.getByRole('button', { name: 'ثبت درخواست' })).toBeEnabled();
  await expect(card.getByLabel('شمارهٔ موبایل')).toHaveValue('09123456789');
  await page.waitForTimeout(500);
  expect(posts()).toBe(1);
  await expect(page).toHaveURL(/\/$/);
  await expectNoAxeViolations(page);
});

test('T-HOME15 without JavaScript: the tier step works with CSS and the form posts once', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const section = page.locator('[data-home-section="restoration"]');
  await expect(section.locator('[data-tier-panel=""]')).toBeVisible();
  await expect(section.locator('[data-tier-panel="vip"]')).toBeHidden();
  await section.getByRole('radio', { name: 'VIP' }).check();
  await expect(section.locator('[data-tier-panel="vip"]')).toBeVisible();
  await expect(section.locator('[data-tier-panel=""]')).toBeHidden();
  const card = page.locator('#bk-hero');
  let posts = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST') posts += 1;
  });
  await card.getByLabel('شمارهٔ موبایل').fill('09123456789');
  const [post] = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    card.getByRole('button', { name: 'ثبت درخواست' }).click(),
  ]);
  expect(decodeURI(new URL(post.url()).pathname)).toBe('/رزرو-نوبت');
  const fields = new URLSearchParams(post.postData() ?? '');
  expect(fields.get('phone')).toBe('09123456789');
  expect(fields.get('location')).toBe('hero');
  expect(posts).toBe(1);
  await context.close();
});
