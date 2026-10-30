// Scenes 1 and 2 (phase 7 report D3, D11, D18; lane HERO+TRUST): the CSS settle after the intro,
// the hero exit parallax from 1024 px at tiers 1 to 3 and nothing on phones or at tier 0, the
// trust band as the 40 vh world window in the server HTML, the relief off with the placeholder.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { skipIntro } from '../helpers/intro';

const HERO = '[data-scene="hero"]';
const PHOTO = `${HERO} [data-hero-photo]`;
const BAND = '[data-scene="trust"]';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

/** Computed translateY of the element (0 for `none`). */
function translateY(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    return transform === 'none' ? 0 : new DOMMatrix(transform).m42;
  });
}

/** The engine recorded its creation measure (tier 1 or more, three frames after `load`). */
async function waitForEngine(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName('sefid:engine-init').length), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
}

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
}

type Settle = {
  minOpacity: number;
  offsetAtEnd: string | null;
  endAt: number | null;
  settledAt: number | null;
};

test('T-HR1 after sefid:intro-end the H1 rises from its offset to identity (within 700 ms with PERF_GATE=1); its opacity was 1 from the first paint', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  // No skipIntro: a fresh context plays the intro, and the settle follows its end.
  await page.addInitScript(() => {
    const r: Settle = { minOpacity: 1, offsetAtEnd: null, endAt: null, settledAt: null };
    (window as unknown as { __settle: Settle }).__settle = r;
    const h1 = () => document.getElementById('hero-h1');
    document.addEventListener('sefid:intro-end', () => {
      r.endAt = performance.now();
      const el = h1();
      r.offsetAtEnd = el ? getComputedStyle(el).translate : null;
    });
    const tick = (): void => {
      const el = h1();
      if (el) {
        const style = getComputedStyle(el);
        r.minOpacity = Math.min(r.minOpacity, Number(style.opacity));
        if (r.endAt !== null && /^(none|0px( 0px)?)$/.test(style.translate)) {
          r.settledAt = performance.now();
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.intro), { timeout: 5000 })
    .toBe('done');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __settle: Settle }).__settle), {
      timeout: 3000,
    })
    .toMatchObject({ settledAt: expect.any(Number) });
  const r = await page.evaluate(() => (window as unknown as { __settle: Settle }).__settle);
  expect(r.minOpacity, 'the H1 never left 1: it stays the LCP candidate').toBe(1);
  const offset = testInfo.project.name === 'phone-light' ? 12 : 16;
  expect(r.offsetAtEnd, 'the offset held while the intro played').toBe(`0px ${offset}px`);
  // The transition is --dur-4 (600 ms); the frame that sees the identity lands 100 ms later on
  // a quiet host and 130 to 170 ms later with two workers on the loaded 4-core host, so the
  // wall-clock bound is asserted with PERF_GATE=1 only (D19) and recorded otherwise. Every
  // tests/perf project reads tests/perf only, so no gated run reaches this file by itself: the
  // integrator gates it serially, as the intro's bound: PERF_GATE=1 npx playwright test
  // tests/e2e/home-hero.spec.ts --project desktop-light --project phone-light --workers 1.
  const settledIn = (r.settledAt ?? 0) - (r.endAt ?? 0);
  testInfo.annotations.push({
    type: 'hero settle',
    description: `H1 identity ${Math.round(settledIn)} ms after sefid:intro-end (--dur-4 600 ms; at most 700 asserted with PERF_GATE=1)`,
  });
  console.log(`T-HR1 hero settle ms: ${Math.round(settledIn)}`);
  if (process.env.PERF_GATE === '1') expect(settledIn).toBeLessThanOrEqual(700);
});

test.describe('without the intro', () => {
  test.beforeEach(({ page }) => skipIntro(page));

  test('T-HR2 at ?tier=2 1440 px the photo layer moves by 0.15 of the scroll inside the hero within 1 px to the hero bottom; the section does not move', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'desktop-light');
    await page.goto('/?tier=2');
    await waitForEngine(page);
    const section = page.locator(HERO);
    // The hero starts under the 72 px header: its segment, and the parallax, start there.
    const { top, height } = await section.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });
    expect(top).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(900);
    const expected = (y: number): number => 0.15 * Math.min(Math.max(0, y - top), height);
    for (const y of [200, 500, Math.round(top + height * 0.75)]) {
      await scrollTo(page, y);
      await expect
        .poll(async () => Math.abs((await translateY(page, PHOTO)) - expected(y)), `at ${y}`)
        .toBeLessThanOrEqual(1);
      expect(await section.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
      expect(
        await section.evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY)),
      ).toBe(Math.round(top));
    }
    // Past the hero's bottom the photo holds its last offset.
    await scrollTo(page, Math.round(top + height + 300));
    await expect
      .poll(async () => Math.abs((await translateY(page, PHOTO)) - 0.15 * height))
      .toBeLessThanOrEqual(1);
    // Back to the top at any speed: identity.
    await scrollTo(page, 0);
    await expect.poll(() => translateY(page, PHOTO)).toBe(0);
  });

  test('T-HR3 at 390 px touch (tier 2) and at ?tier=0 on desktop the photo layer never transforms (its img may drift on phones)', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light', 'desktop-light');
    const phone = testInfo.project.name === 'phone-light';
    await page.goto(phone ? '/?tier=2' : '/?tier=0');
    if (phone) await waitForEngine(page);
    else await page.waitForLoadState('load');
    await scrollTo(page, 300);
    await page.waitForTimeout(300);
    expect(await page.locator(PHOTO).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('T-HR4 the trust band is the 40 vh world window from 1024 px in the server HTML: same rect at tier 0 and 2, no layout shift; under 1024 px it keeps its height', async ({
    page,
    request,
  }, testInfo) => {
    only(testInfo, 'desktop-light', 'tablet-light', 'phone-light');
    const html = await (await request.get('/')).text();
    expect(html).toContain('data-world-slot="hero-exit"');
    const rect = (): Promise<{ x: number; y: number; width: number; height: number }> =>
      page.locator(BAND).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    if (testInfo.project.name !== 'desktop-light') {
      await page.goto('/?tier=2');
      await page.waitForLoadState('load');
      const band = await rect();
      const height = page.viewportSize()?.height ?? 0;
      expect(band.height).toBeGreaterThan(0);
      expect(band.height).toBeLessThan(0.4 * height);
      return;
    }
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    // Fonts in the cache first: a webfont that arrives after the first paint swaps the text
    // (font-display: swap) and shifts the hero by itself, 0.016 on a loaded CI runner and 0.058
    // with a 1.5 s font delay locally. That shift is the Lighthouse CLS gate's business; this test
    // is about the band, which must not move or appear after the first paint.
    await page.goto('/?tier=0');
    await page.evaluate(() => document.fonts.ready);
    for (const height of [900, 1200]) {
      await page.setViewportSize({ width: 1440, height });
      const rects: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const tier of [0, 2]) {
        await page.goto(`/?tier=${tier}`);
        if (tier === 2) await waitForEngine(page);
        else await page.waitForLoadState('load');
        await page.waitForTimeout(500);
        rects[tier] = await rect();
        expect(rects[tier]?.height, `tier ${tier} at ${height}`).toBeGreaterThanOrEqual(
          0.4 * height - 1,
        );
        expect(
          await page.evaluate(() => (window as unknown as { __cls: number }).__cls),
          `layout shift at tier ${tier}, 1440x${height}`,
        ).toBe(0);
        // The wrapper carries the sunken surface from 1024 px in its own stacking context: the
        // photo is still the topmost paint beside the scrim (an unisolated wrapper would paint
        // its background over the -z-10 photo).
        expect(
          await page.evaluate(() => document.elementFromPoint(8, 300)?.tagName),
          `the photo paints beside the scrim at tier ${tier}, 1440x${height}`,
        ).toBe('IMG');
      }
      expect(rects[2], `the band rect at 1440x${height}`).toEqual(rects[0]);
    }
  });

  test('T-HR5 the mark relief is absent with the placeholder photo (D3)', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'desktop-light');
    await page.goto('/');
    await page.waitForLoadState('load');
    await expect(page.locator(`${HERO} img`).first()).toHaveAttribute('src', /placeholders\/hero-/);
    expect(await page.locator(`${HERO} svg use[href$="#mark"]`).count()).toBe(0);
  });

  test('T-HR6 with the placeholder photo a phone gets no 4:5 band (the trust band follows the form) and no caption; from 744 px the raster is dimmed in dark mode', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light', 'phone-dark', 'desktop-light', 'desktop-dark');
    await page.goto('/');
    await page.waitForLoadState('load');
    await expect(page.locator(HERO).getByText(/جای عکس/)).toHaveCount(0);
    const img = page.locator(`${PHOTO} img`);
    await expect(img).toHaveAttribute('src', /placeholders\/hero-/);
    if (testInfo.project.name.startsWith('phone')) {
      await expect(page.locator(PHOTO)).toBeHidden();
      // The trust band sits right under the form's row: nothing empty between them.
      const row = await page.locator('#hero-h1').evaluate((h1) => {
        const r = h1.parentElement!.parentElement!.getBoundingClientRect();
        return r.bottom + window.scrollY;
      });
      const band = await page
        .locator(BAND)
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      expect(Math.abs(band - row)).toBeLessThanOrEqual(1);
      return;
    }
    await expect(page.locator(PHOTO)).toBeVisible();
    await expect(img).toHaveCSS('opacity', testInfo.project.name === 'desktop-dark' ? '0.2' : '1');
  });
});
