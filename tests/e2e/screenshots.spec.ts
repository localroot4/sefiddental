// Screenshots of the system pages, home and the content templates in every viewport and theme
// project (00-master.md section 5: 390x844, 820x1180, 1440x900, light and dark). With
// QA_SCREENSHOTS=phase-NN the files go to docs/qa/phase-NN/<template>-<width>-<theme>.png for
// the phase report; otherwise they are attached to the test report only. The admin login and
// dashboard screenshots are in admin.spec.ts (they need the shared admin session). Phase 7: home
// at ?tier=0 and ?tier=2 with reduced motion off and on, the intro at its 50% stage, and a
// recording of a full scroll at ?tier=2 (desktop and phone) for the hand-off, written to
// docs/qa/phase-NN/final/recordings/ with QA_SCREENSHOTS.
import path from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import {
  formsHydrated,
  isolateClient,
  isolateClientAt,
  pastTimeTrap,
  uniquePhone,
} from '../helpers/booking';
import { scrollThrough } from '../helpers/frames';
import { skipIntro } from '../helpers/intro';
import { captureTemplate, qaScreenshotDir } from '../helpers/screens';
import { MAINTENANCE_ORIGIN } from '../helpers/servers';
import { projectTheme } from '../helpers/theme';

const TEMPLATES = [
  { name: '404', url: '/qa-screenshot-missing-page' },
  { name: '404-template', url: '/qa/not-found' },
  { name: '500', url: '/qa/error' },
  { name: '410', url: '/qa/gone' },
  // The proxy's 503 answer from the server that runs with MAINTENANCE_MODE=on.
  { name: '503', url: `${MAINTENANCE_ORIGIN}/` },
  // Home: the static page, the full experience, and reduced motion over each (tier 0 either way).
  // The tier 2 shot follows a scroll down and up: the reveals fire once near the viewport, so a
  // capture from the top alone would show every section below the fold before its reveal.
  { name: 'home-tier0', url: '/?tier=0' },
  { name: 'home-tier2', url: '/?tier=2', scroll: true },
  { name: 'home-tier0-reduced', url: '/?tier=0', reducedMotion: true },
  { name: 'home-tier2-reduced', url: '/?tier=2', reducedMotion: true },
  { name: 'qa-components', url: '/qa/components' },
  // Phase 4 templates at their public Persian URLs; the dentist and the guide are the e2e fixture.
  { name: 'services-hub', url: encodeURI('/خدمات') },
  { name: 'category', url: encodeURI('/خدمات/زیبایی') },
  { name: 'restoration', url: encodeURI('/خدمات/ترمیم-دندان') },
  { name: 'service', url: encodeURI('/خدمات/لمینت-سرامیکی') },
  { name: 'dentists-hub', url: encodeURI('/پزشکان') },
  { name: 'dentist', url: encodeURI('/پزشکان/دکتر-نمونه-آزمایشی') },
  { name: 'about', url: encodeURI('/درباره-ما') },
  { name: 'address', url: encodeURI('/آدرس') },
  { name: 'guide-hub', url: encodeURI('/راهنمای-بیمار') },
  { name: 'guide', url: encodeURI('/راهنمای-بیمار/اولین-مراجعه') },
  // Phase 5: the pricing page shows the QA-FIN financing option of the e2e fixture.
  { name: 'pricing', url: encodeURI('/هزینه-و-پرداخت') },
  { name: 'privacy', url: encodeURI('/حریم-خصوصی') },
] as const;

test.beforeEach(({ page }) => skipIntro(page));

const size = (testInfo: TestInfo) => testInfo.project.name.split('-')[0];

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

for (const template of TEMPLATES) {
  test(`T-SS ${template.name} screenshot`, async ({ page }, testInfo) => {
    if ('reducedMotion' in template) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(template.url);
    if ('scroll' in template) {
      // A full down-and-up pass by touch takes over 30 s on a loaded host: triple the timeout
      // and let each pass fail inside it.
      test.slow();
      const scroll = {
        drive: size(testInfo) === 'desktop' ? 'wheel' : 'touch',
        deadlineMs: 40_000,
      } as const;
      await page.waitForTimeout(1500);
      if (scroll.drive === 'wheel') await page.mouse.move(720, 450);
      expect(await scrollThrough(page, 1, scroll)).toBe(true);
      expect(await scrollThrough(page, -1, scroll)).toBe(true);
      await page.waitForTimeout(1000);
    }
    await captureTemplate(page, testInfo, template.name, projectTheme(testInfo));
  });
}

test('T-SS intro at its 50% stage', async ({ page }, testInfo) => {
  // The file's skipIntro marks the intro as seen; a later init script unmarks it (init scripts
  // run in order), so this fresh page plays the intro.
  await page.addInitScript(() => {
    try {
      sessionStorage.removeItem('sefid-intro');
    } catch {
      // No storage on an opaque origin; the real navigation runs this again.
    }
  });
  // A paused fake clock holds the intro script's stage timers; `runFor` fires the ones due by
  // 600 ms (the strokes and the word, before the frame opens at 900 ms). CSS animations run on
  // the document timeline, not on timers, so the shot pauses each at 600 ms itself (C18).
  const start = new Date('2026-10-27T08:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'playing');
  await page.clock.runFor(600);
  await expect(page.locator('#intro')).toHaveClass(/\bs2\b/);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 600;
    }
  });
  await captureTemplate(page, testInfo, 'intro-50', projectTheme(testInfo), {
    fullPage: false,
    animations: 'allow',
  });
});

test('T-SS recording: the intro and a full scroll at ?tier=2', async ({ browser }, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  test.setTimeout(120_000);
  const phone = size(testInfo) === 'phone';
  const file = `home-tier2-${phone ? 390 : 1440}.webm`;
  // A context of this test's own: the project's options plus a video at the viewport size, and
  // no skipIntro, so the recording opens with the intro.
  const context = await browser.newContext({
    recordVideo: {
      dir: testInfo.outputPath('video'),
      size: testInfo.project.use.viewport ?? undefined,
    },
  });
  const page = await context.newPage();
  await page.goto('/?tier=2');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'done', { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  if (!phone) await page.mouse.move(720, 450);
  // 50 s for the scroll: with the intro and the waits it fits the 120 s test timeout.
  expect(
    await scrollThrough(page, 1, { drive: phone ? 'touch' : 'wheel', deadlineMs: 50_000 }),
  ).toBe(true);
  await page.waitForTimeout(1500);
  const video = page.video();
  expect(video).not.toBeNull();
  // The file is complete once the context closes; saveAs waits for that.
  await context.close();
  const dir = qaScreenshotDir();
  const target = dir ? path.join(dir, 'final', 'recordings', file) : testInfo.outputPath(file);
  await video!.saveAs(target);
  await testInfo.attach(file, { path: target, contentType: 'video/webm' });
});

// Phase 5 conversion states (qa-budgets 4.2). The booking page's default, error, unsent, neutral
// and success shots are in booking.spec.ts, the dialog's in dialog.spec.ts, the home hero success
// in home-booking.spec.ts.
const BOOKING = encodeURI('/رزرو-نوبت');
const EMERGENCY = encodeURI('/اورژانس');
// Tehran is UTC+3:30; the seeded hours are every day 10 to 20. The holiday is the QA fixture's.
const CLOCK = {
  open: new Date('2026-10-21T08:00:00Z'), // 11:30
  closed: new Date('2026-10-21T17:00:00Z'), // 20:30
  'before-open': new Date('2026-10-21T05:00:00Z'), // 08:30
  holiday: new Date('2027-03-21T08:00:00Z'), // 11:30 on the holiday
} as const;
const emergencyForm = (page: Page) => page.locator('form[data-emergency-form]');

test('T-SS booking states: a known service, expired token, network and server failures', async ({
  page,
  context,
}, testInfo) => {
  await isolateClient(context);
  const theme = projectTheme(testInfo);
  await page.goto(`${BOOKING}?service=ceramic-laminate&tier=`);
  await captureTemplate(page, testInfo, 'booking-service', theme);

  // The first post answers 419, the second never arrives, the third answers 500.
  let posts = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (
      request.method() !== 'POST' ||
      decodeURI(new URL(request.url()).pathname) !== '/رزرو-نوبت'
    ) {
      return route.continue();
    }
    posts += 1;
    if (posts === 1) return route.fulfill({ status: 419, json: { ok: false, error: 'expired' } });
    if (posts === 2) return route.abort('internetdisconnected');
    return route.fulfill({ status: 500 });
  });
  await page.goto(BOOKING);
  await formsHydrated(page);
  const form = page.locator('#bk-page');
  const submit = form.getByRole('button', { name: t('booking.submit') });
  await form.getByLabel(t('booking.phone')).fill(uniquePhone(testInfo));
  for (const [state, key] of [
    ['expired', 'booking.failed.expired'],
    ['network', 'booking.failed.network'],
    ['server', 'booking.failed.server'],
  ] as const) {
    await submit.click();
    await expect(form.getByRole('alert')).toContainText(t(key).slice(0, 20));
    await expect(submit).toBeEnabled();
    await captureTemplate(page, testInfo, `booking-${state}`, theme);
  }
});

test('T-SS restoration with VIP chosen', async ({ page }, testInfo) => {
  await page.goto(encodeURI('/خدمات/ترمیم-دندان'));
  await page.getByRole('radio', { name: 'VIP' }).check();
  await captureTemplate(page, testInfo, 'restoration-tier-selected', projectTheme(testInfo));
});

test('T-SS emergency hours states, first screen and avulsion', async ({
  page,
  context,
}, testInfo) => {
  // Up to eight page loads and full-page captures on a phone: 29 s alone, over 30 s under load.
  test.setTimeout(90_000);
  const theme = projectTheme(testInfo);
  const phone = size(testInfo) === 'phone';
  const at = async (state: keyof typeof CLOCK) => {
    await isolateClientAt(context, CLOCK[state]);
    await page.goto(EMERGENCY);
  };
  const states: Array<keyof typeof CLOCK> = ['open', 'closed'];
  if (phone) states.push('before-open', 'holiday'); // 390 only (qa-budgets 4.2)
  for (const state of states) {
    await at(state);
    await captureTemplate(page, testInfo, `emergency-${state}`, theme);
  }
  if (phone) {
    // The call button in the first screen of a small phone (T-EM2): what the visitor sees.
    await page.setViewportSize({ width: 360, height: 640 });
    await at('open');
    await captureTemplate(page, testInfo, 'emergency-first-screen', theme, { fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  if (size(testInfo) === 'tablet') return;
  for (const state of ['open', 'closed'] as const) {
    await at(state);
    await emergencyForm(page).getByLabel(t('emergency.triage.avulsion'), { exact: true }).check();
    await expect(page.getByText(t('emergency.avulsion.text'))).toBeVisible();
    await captureTemplate(page, testInfo, `emergency-avulsion-${state}`, theme);
  }
});

test('T-SS emergency form: triage error, success, a second request from one phone', async ({
  page,
  context,
}, testInfo) => {
  const theme = projectTheme(testInfo);
  const phone = uniquePhone(testInfo);
  const form = emergencyForm(page);
  const open = async () => {
    await page.goto(EMERGENCY);
    const arrived = Date.now(); // the page renders its tokens: they are at least this old
    await page.waitForFunction(
      () => document.querySelector<HTMLFormElement>('form[data-emergency-form]')?.noValidate,
    );
    await form.getByLabel(t('booking.phone')).fill(phone);
    return arrived;
  };
  const submit = () => form.getByRole('button', { name: t('emergency.submit') }).click();
  await isolateClientAt(context, CLOCK.open);

  await open();
  await submit();
  await expect(page.locator('#em-triage-error')).toHaveText(t('emergency.triage.required'));
  await captureTemplate(page, testInfo, 'emergency-error', theme);

  await form.getByLabel(t('emergency.triage.severe_pain'), { exact: true }).check();
  await pastTimeTrap(Date.now());
  await submit();
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toBeVisible();
  await captureTemplate(page, testInfo, 'emergency-success', theme);

  await pastTimeTrap(await open());
  await form.getByLabel(t('emergency.triage.swelling'), { exact: true }).check();
  await submit();
  await expect(
    page.getByRole('status').filter({ hasText: t('emergency.repeat.before') }),
  ).toBeVisible();
  await captureTemplate(page, testInfo, 'emergency-limit', theme);
});
