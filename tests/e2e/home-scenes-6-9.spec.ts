// Scenes 6 to 9 (phase 7 report, plan section 2; lane COMPARE+DENTISTS+VOICES+LIGHT): the
// compare slider's clip-path follows input only, the dentist portraits answer a fine pointer only
// (no listener on touch), the voices row is a keyboard-reachable carousel with no media
// preloaded whose buttons rest at the ends and which a trackpad can swipe under Lenis, the warm
// layer scrubs `--warm` across the journey's entrance and holds it through the booking block, an
// entrance the reader already sees is never replayed, and the engine chunk's size with these
// four modules inside (annotated).
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { expectNoA11yViolations } from '../helpers/axe';
import { recordBeacons } from '../helpers/booking';
import { scrollThrough } from '../helpers/frames';
import { skipIntro } from '../helpers/intro';

type Hook = {
  snapshot(): { labels: string[]; layout: { latchedAtTier: number } };
  setUserOverride(o: number | 'auto'): void;
};

const MAX_PARALLAX_PX = 8;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

/** The debug hook is installed and the engine has measured its labels (`?debug=1`). */
async function engineReady(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => {
    const h = (window as unknown as { __sefid?: Hook }).__sefid;
    return h !== undefined && h.snapshot().labels.length > 0;
  });
}

/** Two animation frames: ScrollTrigger and the scenes have seen the scroll. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/** Scrolls so the element's top sits `offset` px above the viewport top (instant, native). */
async function scrollTo(page: Page, selector: string, offset = 0): Promise<void> {
  await page.evaluate(
    ([sel, off]) => {
      const el = document.querySelector(sel as string);
      if (!el) throw new Error(`no ${sel}`);
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY + (off as number),
        behavior: 'instant',
      });
    },
    [selector, offset] as const,
  );
  await frames(page);
}

const computed = (page: Page, selector: string, property: string) =>
  page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no ${sel}`);
      return getComputedStyle(el).getPropertyValue(prop).trim();
    },
    [selector, property] as const,
  );

/** [tx, ty] of a computed `matrix(...)`, or [0, 0] for `none`. */
const translation = (transform: string): [number, number] => {
  const m = /matrix\((.+)\)/.exec(transform)?.[1]?.split(',').map(Number) ?? [];
  return [m[4] ?? 0, m[5] ?? 0];
};

/** Event listener types on the first element the selector matches (CDP, the real registry). */
async function listenerTypes(page: Page, selector: string): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
  });
  if (!result.objectId) throw new Error(`no ${selector}`);
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
    objectId: result.objectId,
  });
  await cdp.detach();
  return listeners.map((l) => l.type);
}

const COMPARE_BOX = '[data-scene="compare"] div:has(> input[type="range"])';

test.beforeEach(({ page }) => skipIntro(page));

test('T-S6 the compare clip-path changes only from input, never from scroll; the figure reveals once; phone handle 44 px', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  const beacons = await recordBeacons(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  // The after layer is the second child of the slider box (CompareSlider.tsx).
  const clip = () =>
    page.evaluate((sel) => {
      const box = document.querySelector(sel);
      const layer = box?.children[1];
      if (!layer) throw new Error('no clipped layer');
      return getComputedStyle(layer).clipPath;
    }, COMPARE_BOX);
  const before = await clip();
  expect(before).not.toBe('none');
  const height = page.viewportSize()?.height ?? 900;
  for (const offset of [-height, -height / 2, 0, 300, 600, 900]) {
    await scrollTo(page, '[data-scene="compare"]', offset);
    expect(await clip(), `clip-path at offset ${offset}`).toBe(before);
  }
  // The slot and the side text rose once (opacity 1, the transform back at identity).
  for (const sel of ['[data-world-slot="compare"]', '[data-world-slot="compare"] + div']) {
    await expect.poll(() => computed(page, sel, 'opacity')).toBe('1');
    // Under 1024 px a scrub's lag (0.32 s) may still close the last fraction of a pixel.
    await expect
      .poll(async () => translation(await computed(page, sel, 'transform')))
      .toEqual([0, 0]);
  }
  await scrollTo(page, '[data-scene="compare"]', -height / 3);
  const range = page.locator(`${COMPARE_BOX} input[type="range"]`);
  await range.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(clip).not.toBe(before);
  await expect
    .poll(async () => (await beacons()).filter((b) => b.includes('case_slider_use')))
    .toHaveLength(1);
  expect(await computed(page, COMPARE_BOX, 'touch-action')).toBe('pan-y');
  const handle = await page.locator(`${COMPARE_BOX} [aria-hidden="true"] > span`).boundingBox();
  expect(handle?.width).toBeGreaterThanOrEqual(44);
  expect(handle?.height).toBeGreaterThanOrEqual(44);
});

test('T-S7 touch: no pointermove listener on the dentist cards; fine pointer at 1440: the portrait moves at most 8 px and rests on leave', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  const card = '[data-scene="dentists"] [role="region"] > *';
  const portrait = `${card} [data-portrait]`;
  await expect(page.locator(card).first()).toBeVisible();
  await scrollTo(page, '[data-scene="dentists"]', -80);
  await expect.poll(() => computed(page, card, 'opacity')).toBe('1');
  if (testInfo.project.name === 'phone-light') {
    for (const sel of [card, '[data-scene="dentists"]']) {
      expect(await listenerTypes(page, sel), `listeners on ${sel}`).not.toContain('pointermove');
    }
    expect(await computed(page, portrait, 'transform')).toBe('none');
    return;
  }
  expect(await listenerTypes(page, card)).toContain('pointermove');
  const box = await page.locator(card).first().boundingBox();
  if (!box) throw new Error('no card box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + 1, box.y + 1, { steps: 4 }); // the top-left corner, inside
  await expect
    .poll(async () => translation(await computed(page, portrait, 'transform')).map(Math.round))
    .toEqual([-MAX_PARALLAX_PX, -MAX_PARALLAX_PX]);
  const [tx, ty] = translation(await computed(page, portrait, 'transform'));
  expect(Math.abs(tx)).toBeLessThanOrEqual(MAX_PARALLAX_PX + 0.01);
  expect(Math.abs(ty)).toBeLessThanOrEqual(MAX_PARALLAX_PX + 0.01);
  await page.mouse.move(box.x - 60, box.y - 60, { steps: 4 });
  await expect
    .poll(async () => translation(await computed(page, portrait, 'transform')).map(Math.round))
    .toEqual([0, 0]);
});

test('T-S8 the voices row: a snap row (under 1024 px at every tier, D24), 44 px labelled buttons that move one card and rest at the ends (their box invisible and inert at tier 0 under 1024 px), keyboard, trackpad swipe under Lenis, no video and no media request, axe clean', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  const phone = testInfo.project.name === 'phone-light';
  const media: string[] = [];
  page.on('request', (request) => {
    if (/\.(mp4|webm|m4a|mp3)(\?|$)/.test(request.url())) media.push(request.url());
  });
  // A stored «کیفیت» choice, not the query override: the test changes it later.
  await page.addInitScript(() => localStorage.setItem('sefid-quality', '1'));
  await page.goto('/?debug=1');
  await engineReady(page);
  const row = page.locator('[data-world-slot="voices"]');
  // From 1024 px the carousel switch; under it the server's row at every tier (D24).
  if (phone) expect(await row.getAttribute('data-carousel')).toBeNull();
  else await expect(row).toHaveAttribute('data-carousel', '');
  await expect(row).toHaveAttribute('tabindex', '0');
  await expect(row).toHaveId('home-voices-row');
  await expect(row).toHaveAttribute('aria-labelledby', 'home-voices-title');
  expect(await computed(page, '[data-world-slot="voices"]', 'scroll-snap-type')).toContain('x');
  await expect(page.locator('[data-scene="voices"] video')).toHaveCount(0);
  const nav = page.locator('[data-voices-nav]');
  // The fixture publishes one testimonial: no buttons at any tier (data-single).
  await expect(nav).toBeHidden();
  await scrollTo(page, '[data-scene="voices"]', -80);
  for (const sel of ['[data-world-slot="voices"]', '[data-world-slot="voices"] > li']) {
    await expect.poll(() => computed(page, sel, 'opacity')).toBe('1');
  }

  // Six clones make the row overflow by several cards, so one step lands on the next card's
  // snap point instead of the row's end; a «کیفیت» change re-creates the scene over them, and
  // the buttons of a row with more than one voice appear.
  const step = await page.evaluate(() => {
    const list = document.querySelector('[data-world-slot="voices"]') as HTMLElement;
    const first = list.firstElementChild as HTMLElement;
    for (let i = 0; i < 6; i += 1) list.append(first.cloneNode(true));
    document.querySelector('[data-voices-nav]')?.removeAttribute('data-single');
    return first.getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap);
  });
  // Layout boxes, transforms aside (the offset chain).
  const boxes = () =>
    page.evaluate(() =>
      ['[data-world-slot="voices"]', '[data-voices-nav]'].map((sel) => {
        const el = document.querySelector<HTMLElement>(sel)!;
        let top = 0;
        for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
          top += e.offsetTop;
        }
        return [top, el.offsetWidth, el.offsetHeight];
      }),
    );
  // Through the tier-0 page and back (a phone's cap refuses tier 2), so the scene is rebuilt.
  const latched = () =>
    page.evaluate(
      () => (window as unknown as { __sefid: Hook }).__sefid.snapshot().layout.latchedAtTier,
    );
  const setTier = async (tier: number): Promise<void> => {
    await page.evaluate(
      (t) => (window as unknown as { __sefid: Hook }).__sefid.setUserOverride(t),
      tier,
    );
    await expect.poll(latched).toBe(tier);
  };
  await setTier(0);
  const tierZero = await boxes();
  if (phone) {
    // D24: at tier 0 the row is the same snap row and the buttons' box is there, invisible and
    // inert (the spec's fallback: no handler outside the engine).
    expect(await computed(page, '[data-world-slot="voices"]', 'scroll-snap-type')).toContain('x');
    await expect(nav).toHaveAttribute('inert', '');
    expect(await computed(page, '[data-voices-nav]', 'visibility')).toBe('hidden');
    expect(tierZero[1]![2]).toBeGreaterThan(0);
  }
  await setTier(1);
  await engineReady(page);
  await frames(page);
  await frames(page);
  if (phone) {
    await expect(nav).not.toHaveAttribute('inert');
    expect(await boxes()).toEqual(tierZero);
  } else {
    await expect(row).toHaveAttribute('data-carousel', '');
  }
  const prev = page.locator('[data-voices-nav] button[data-dir="-1"]');
  const next = page.locator('[data-voices-nav] button[data-dir="1"]');
  await expect(prev).toBeDisabled(); // at the start
  await expect(next).toBeEnabled();
  for (const button of [prev, next]) {
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-controls', 'home-voices-row');
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await expect(prev).toHaveText('قبلی');
  await expect(next).toHaveText('بعدی');
  const scrollLeft = () => row.evaluate((el) => Math.abs(el.scrollLeft));
  expect(await scrollLeft()).toBe(0);
  await next.click();
  await expect.poll(scrollLeft).toBeGreaterThan(step - 2);
  expect(await scrollLeft()).toBeLessThan(step + 2);
  await expect(prev).toBeEnabled();
  await prev.click();
  await expect.poll(scrollLeft).toBeLessThan(2);
  await expect(prev).toBeDisabled();
  // Keyboard: Enter on the button, then the arrow keys on the focused row (native scroll).
  await next.focus();
  await page.keyboard.press('Enter');
  await expect.poll(scrollLeft).toBeGreaterThan(step - 2);
  await row.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(scrollLeft).not.toBeCloseTo(step, 0);
  // The far end: «بعدی» rests disabled (RTL: the end is at negative scrollLeft).
  await row.evaluate((el) => el.scrollTo({ left: -el.scrollWidth, behavior: 'instant' }));
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  if (testInfo.project.name === 'desktop-light') {
    // A trackpad swipe (dx -120, dy 6: a trackpad's dy is almost never exactly 0) over the row
    // scrolls the row, not the page, while Lenis runs: `data-lenis-prevent-horizontal`.
    await row.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }));
    await expect.poll(scrollLeft).toBeLessThan(2);
    await expect(page.locator('html.lenis')).toHaveCount(1);
    const box = await row.boundingBox();
    if (!box) throw new Error('no row box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const pageY = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 4; i += 1) await page.mouse.wheel(-120, 6);
    await expect.poll(scrollLeft).toBeGreaterThan(100);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - pageY)).toBeLessThan(2);
  }

  expect(media, 'no media request on home').toEqual([]);
  await expectNoA11yViolations(page, { include: '[data-scene="voices"]' });
});

test("T-S9 the warm layer fills the viewport, --warm scrubs across the journey's entrance and holds 1 from the booking block at ?tier=1, absent at ?tier=0; the FAQ chevron takes --dur-2", async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?debug=1&tier=1');
  await engineReady(page);
  const layer = '[data-warm-layer]';
  const warm = () => computed(page, layer, '--warm');
  expect(await computed(page, layer, 'position')).toBe('fixed');
  // C16: the same box as a fixed element straight under body, so no ancestor traps it.
  const boxes = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.cssText = 'position:fixed;inset:0;pointer-events:none';
    const rect = (el: Element) => el.getBoundingClientRect().toJSON() as Record<string, number>;
    const out = [rect(document.querySelector('[data-warm-layer]')!), rect(probe)];
    probe.remove();
    return out;
  });
  expect(boxes[0], 'the fixed layer is boxed by an ancestor').toEqual(boxes[1]);
  expect(boxes[0]!.width).toBeGreaterThan(1000);
  await scrollTo(page, '[data-scene="dentists"]');
  expect(['', '0']).toContain(await warm());
  expect(await computed(page, layer, 'opacity')).toBe('0');
  await scrollTo(page, '[data-scene="booking"]', 1);
  await expect.poll(warm).toBe('1');
  // A scrubbed target (D25): within the engine's settle window its opacity eases there.
  await expect.poll(() => computed(page, layer, 'opacity')).toBe('1');
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await frames(page);
  expect(await warm()).toBe('1');
  // The scrub follows the journey's entrance: 0 with its top below the viewport, 1 once its top
  // reaches the viewport top, held from there (CR2: a child across `first-visit` would reach
  // 0.5 only as the journey leaves the top, and every section after it is opaque).
  const journey = '[data-home-section="journey"]';
  const height = page.viewportSize()?.height ?? 900;
  await scrollTo(page, journey, -height - 1);
  await expect.poll(warm).toBe('0');
  await scrollTo(page, journey, -height / 2);
  await expect.poll(async () => Number(await warm())).toBeCloseTo(0.5, 1);
  await scrollTo(page, journey, 0);
  await expect.poll(warm).toBe('1');
  await scrollTo(page, '[data-scene="dentists"]');
  await expect.poll(warm).toBe('0');
  expect(
    await computed(page, '[data-scene="first-visit"] summary svg', 'transition-duration'),
  ).toBe('0.2s');

  await page.goto('/?tier=0');
  await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
  await scrollTo(page, '[data-scene="booking"]', 1);
  expect(await warm()).toBe('');
  expect(await page.locator(layer).evaluate((el) => el.style.getPropertyValue('--warm'))).toBe('');
  expect(await computed(page, layer, 'opacity')).toBe('0');
});

test('T-S11 a deep link at the dentists: the cards the reader already sees never dip below opacity 1 when the engine arrives', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const card = '[data-scene="dentists"] [role="region"] > *';
  await page.addInitScript((sel) => {
    const samples: number[] = [];
    (window as unknown as { __opacity: number[] }).__opacity = samples;
    const sample = (): void => {
      const el = document.querySelector(sel);
      if (el) samples.push(Number(getComputedStyle(el).opacity));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, card);
  await page.goto('/?debug=1&tier=1#home-dentists-title');
  await engineReady(page);
  await page.waitForTimeout(600); // the rise would take 320 ms after the engine's creation
  const top = await page
    .locator(card)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan((page.viewportSize()?.height ?? 900) * 0.8); // the entrance is behind
  const samples = await page.evaluate(
    () => (window as unknown as { __opacity: number[] }).__opacity,
  );
  expect(samples.length).toBeGreaterThan(10);
  expect(Math.min(...samples)).toBe(1);
});

test('T-S10 engine chunk size with scenes 6 to 9 inside (annotation for the report)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const sizes = new Map<string, number>();
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    try {
      const { responseBodySize } = await response.request().sizes();
      sizes.set(response.url(), responseBodySize);
    } catch {
      // A script still in flight when the test ends has no sizes.
    }
  });
  // No debug flag: it would add the overlay and the canvas chunk (D5) to the set.
  await page.goto('/?tier=1');
  await page.waitForLoadState('load');
  await expect(page.locator('html.lenis')).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  const afterLoad = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const since = nav?.loadEventStart ?? 0;
    return performance
      .getEntriesByType('resource')
      .filter((entry) => entry.startTime >= since && /\.js(\?|$)/.test(entry.name))
      .map((entry) => entry.name);
  });
  const bytes = afterLoad.reduce((sum, url) => sum + (sizes.get(url) ?? 0), 0);
  const note = `${(bytes / 1024).toFixed(1)} (${afterLoad.length} scripts after load)`;
  testInfo.annotations.push({ type: 'engine chunk KiB (scenes 6-9)', description: note });
  console.log(`T-S10 engine chunk KiB: ${note}`);
  expect(afterLoad.length).toBeGreaterThan(0);
});

/** The document top of an element, transforms ignored (the offset chain). */
const docTop = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    let y = 0;
    for (let e = el as HTMLElement | null; e; e = e.offsetParent as HTMLElement | null) {
      y += e.offsetTop;
    }
    return y;
  });

for (const [name, rowSel] of [
  ['dentists', '[data-scene="dentists"] [role="region"]'],
  ['voices', '[data-scene="voices"] [data-world-slot="voices"]'],
] as const) {
  test(`T-PH11 the ${name} row on card 3 keeps its scrollLeft while the page swipes through its Slide range`, async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light', 'phone-dark');
    await page.goto('/?tier=1');
    await page.waitForLoadState('load');
    const height = page.viewportSize()?.height ?? 844;
    const bar = await page.evaluate(
      () => document.querySelector<HTMLElement>('[data-sticky-bar]')?.offsetHeight ?? 0,
    );
    const top = await docTop(page, rowSel);
    // A far scene sets up when it comes near (phone spec 1.4); its row then slides from below
    // the bar top and carries data-scrub.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top - height);
    await expect(page.locator(`${rowSel}[data-scrub]`)).toHaveCount(1, { timeout: 15_000 });
    // The fixture has one card: clones make the row scroll (the trigger is the row, not a card).
    const before = await page.locator(rowSel).evaluate(async (row) => {
      const first = row.firstElementChild as HTMLElement;
      for (let i = 0; i < 4; i += 1) row.append(first.cloneNode(true));
      const card = row.children[2] as HTMLElement;
      const r = card.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      row.scrollBy({
        left: r.left + r.width / 2 - (box.left + box.width / 2),
        behavior: 'instant',
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return row.scrollLeft;
    });
    expect(Math.abs(before)).toBeGreaterThan(0);
    expect(await scrollThrough(page, 1, { drive: 'touch', endY: top - height * 0.5 })).toBe(true);
    expect(
      await scrollThrough(page, -1, { drive: 'touch', endY: top - (height - bar) - 200 }),
    ).toBe(true);
    const after = await page.locator(rowSel).evaluate((row) => row.scrollLeft);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
}
