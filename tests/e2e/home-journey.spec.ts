// The home journey (docs/experience/journey.md section 7): one courier travels from the hero to the
// footer. The rows read the pose through the debug probe (`window.__sefidJourney`, installed only
// with `?debug=1`): every dock is reached, one object shows at a time, scrolling back gives the
// same poses, nothing interactive or textual lies under the courier at a dock, the courier stays
// under the text while it travels, the footer takes the mark over and gives it back, and tier 0 or
// reduced motion load no courier. Desktop rows run the WebGL courier (tier 2), the phone rows the
// DOM courier (tier 1). Software rendering is slow here: the waits are generous, never the asserts.
import { expect, test, type Page } from '@playwright/test';

import { ARCH_PHOTO } from '@/lib/archPhoto';

import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

interface Pose {
  x: number;
  y: number;
  scale: number;
  form: 'mark' | 'tooth';
  dock: string | null;
  to: string | null;
  hidden: boolean;
  smile: number;
  arch: number;
  /** 0..1: the courier fades out wherever its box would sit under text. */
  opacity?: number;
}
interface Hold {
  id: string;
  start: number;
  end: number;
}

const probe = <T>(page: Page, fn: string): Promise<T> =>
  page.evaluate((name) => {
    const j = (window as unknown as { __sefidJourney?: Record<string, () => unknown> })
      .__sefidJourney;
    if (!j) throw new Error('window.__sefidJourney is not installed (needs ?debug=1)');
    return j[name]!() as T;
  }, fn) as Promise<T>;

async function open(page: Page, query: string): Promise<Hold[]> {
  await needsWebgl2(page);
  await page.goto(`/?${query}&debug=1`);
  await page.waitForLoadState('load');
  await page.waitForFunction(() => '__sefidJourney' in window, null, { timeout: 30_000 });
  // Let fonts and lazy images settle the layout, then measure once more.
  await page.waitForTimeout(1500);
  await probe(page, 'measure');
  // The lanes are planned in idle time (route.ts); measured again once they are, so every
  // travel's lane is in before the rows read poses (a lane never comes in mid-travel).
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __sefidJourney: { planStats(): { pending: number } | null } }
      ).__sefidJourney.planStats()?.pending === 0,
    null,
    { timeout: 60_000 },
  );
  await probe(page, 'measure');
  return probe<Hold[]>(page, 'holds');
}

async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.ceil(y));
  // One frame of the driver and of the canvas after the scroll.
  await page.waitForTimeout(400);
}

/** The positions a row visits: the middle of every hold (the footer's start) and every travel. */
function stops(holds: Hold[]): { name: string; y: number; dock: string | null }[] {
  const out: { name: string; y: number; dock: string | null }[] = [];
  holds.forEach((h, i) => {
    out.push({
      name: h.id,
      y: h.id === 'footer' ? h.start + 2 : (h.start + h.end) / 2,
      dock: h.id,
    });
    const next = holds[i + 1];
    if (next) out.push({ name: `${h.id}->${next.id}`, y: (h.end + next.start) / 2, dock: null });
  });
  return out;
}

/** What lies under the courier's box (its form fills about 80 % of it): text, controls, fields. */
async function underCourier(page: Page, pose: Pose) {
  return page.evaluate((p) => {
    const half = (p.scale * 0.8) / 2;
    const box = { left: p.x - half, right: p.x + half, top: p.y - half, bottom: p.y + half };
    const hits = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.left < box.right &&
      r.right > box.left &&
      r.top < box.bottom &&
      r.bottom > box.top;
    const shown = (el: Element) => {
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && Number(style.opacity) > 0.05;
    };
    const skip = (el: Element) => el.closest('[data-dev-overlay], [aria-hidden="true"], header');
    const text: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || skip(el) || !shown(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (Array.from(range.getClientRects()).some(hits))
        text.push(node.textContent.trim().slice(0, 40));
    }
    const controls = Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]'),
    )
      .filter((el) => !skip(el) && shown(el) && hits(el.getBoundingClientRect()))
      .map((el) => `${el.tagName.toLowerCase()} ${(el.textContent ?? '').trim().slice(0, 30)}`);
    return { text, controls };
  }, pose);
}

test.beforeEach(({ page }) => skipIntro(page));

test.describe('desktop, WebGL courier', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-light', 'journey rows run in desktop-light');
    test.setTimeout(240_000);
  });

  test('T-JN1 every dock is reached in journey order, and the courier sits in its box', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=2');
    expect(holds.map((h) => h.id)).toEqual([
      'hero',
      'services',
      'restoration',
      'workflow',
      'smile',
      'dentists',
      'booking',
      'footer',
    ]);
    // The WebGL courier takes over once its canvas draws.
    await scrollToY(page, (holds[0]!.start + holds[0]!.end) / 2);
    await expect.poll(() => probe<boolean>(page, 'webgl'), { timeout: 60_000 }).toBe(true);
    for (const stop of stops(holds).filter((s) => s.dock !== null)) {
      await scrollToY(page, stop.y);
      const pose = await probe<Pose>(page, 'pose');
      expect(pose.dock, stop.name).toBe(stop.dock);
      if (stop.dock !== 'footer') expect(pose.opacity, `${stop.name}: whole at its dock`).toBe(1);
      if (stop.dock === 'footer') {
        expect(pose.hidden, 'the playground has the mark').toBe(true);
        continue;
      }
      if (stop.dock === 'smile') continue;
      // The rendered box (the workflow dock has a header and a pinned-stage variant).
      const box = await page.locator(`[data-dock="${stop.dock}"]`).evaluateAll(
        (els) =>
          els
            .find((el) => el.getClientRects().length > 0)!
            .getBoundingClientRect()
            .toJSON() as DOMRect,
      );
      expect(Math.abs(pose.x - (box.left + box.width / 2)), stop.name).toBeLessThan(2);
      expect(Math.abs(pose.y - (box.top + box.height / 2)), stop.name).toBeLessThan(2);
      expect(pose.scale, stop.name).toBeLessThanOrEqual(Math.min(box.width, box.height) + 1);
    }
  });

  test('T-JN2 one object only: the DOM courier steps aside while WebGL draws, the slot art is away', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=2');
    await scrollToY(page, (holds[0]!.start + holds[0]!.end) / 2);
    await expect.poll(() => probe<boolean>(page, 'webgl'), { timeout: 60_000 }).toBe(true);
    for (const stop of stops(holds)) {
      await scrollToY(page, stop.y);
      const state = await page.evaluate(() => ({
        dom: getComputedStyle(document.querySelector('[data-courier]')!).visibility,
        arch: getComputedStyle(document.querySelector('[data-courier-arch]')!).visibility,
        molarArt: Array.from(document.querySelectorAll('[data-world-slot="molar"] svg')).filter(
          (svg) => getComputedStyle(svg).visibility !== 'hidden',
        ).length,
        part: getComputedStyle(document.querySelector('[data-playground-part="mark"]')!).visibility,
        servicesMark: getComputedStyle(
          document.querySelector('[data-scene="services"] [data-mark]')!,
        ).visibility,
      }));
      const pose = await probe<Pose>(page, 'pose');
      expect(state.dom, stop.name).toBe('hidden');
      expect(state.arch, stop.name).toBe('hidden');
      expect(state.molarArt, `${stop.name}: the stepper's own molar hides`).toBe(0);
      // D2 is the services mark's own box: the courier stands in for it, one mark on screen.
      expect(state.servicesMark, `${stop.name}: the services SVG mark steps aside`).toBe('hidden');
      // The footer's mark part shows only once the courier is home, never beside it.
      expect(state.part === 'visible', stop.name).toBe(pose.hidden);
    }
  });

  test('T-JN3 reverse equality: scrolling back up gives the same pose at every position', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=2');
    const ys = stops(holds).map((s) => s.y);
    const down: Pose[] = [];
    for (const y of ys) {
      await scrollToY(page, y);
      down.push(await probe<Pose>(page, 'pose'));
    }
    for (let i = ys.length - 1; i >= 0; i -= 1) {
      await scrollToY(page, ys[i]!);
      expect(await probe<Pose>(page, 'pose'), `at ${Math.round(ys[i]!)}`).toEqual(down[i]);
    }
  });

  test('T-JN4 no text, control or field under the shown courier, at a dock or anywhere in travel', async ({
    page,
  }) => {
    test.setTimeout(480_000);
    const holds = await open(page, 'tier=2');
    const samples = stops(holds).filter((s) => s.dock !== null);
    // Ten positions through every travel, its ends excluded.
    holds.forEach((h, i) => {
      const next = holds[i + 1];
      if (!next) return;
      for (let k = 1; k <= 10; k += 1) {
        const y = h.end + ((next.start - h.end) * k) / 11;
        samples.push({ name: `${h.id}->${next.id} ${k}/10`, y, dock: null });
      }
    });
    for (const stop of samples) {
      await scrollToY(page, stop.y);
      const pose = await probe<Pose>(page, 'pose');
      if (pose.hidden) continue;
      // Whole wherever it shows: it keeps to the clear lanes, it never fades (route.ts).
      expect(pose.opacity ?? 1, stop.name).toBeGreaterThan(0.95);
      expect(await underCourier(page, pose), stop.name).toEqual({ text: [], controls: [] });
    }
    // The layers the courier draws in paint above the sections' boxes of `.site` and below the
    // header, the sticky bar and the hero's cards: z-index 1, with no stacking context between
    // them and `.site`.
    const stacking = await page.evaluate(() =>
      ['[data-courier-layer]', '[data-experience-layer]'].map((sel) => {
        const layer = document.querySelector(sel)!;
        const chain: string[] = [];
        for (
          let el = layer.parentElement;
          el && !el.classList.contains('site');
          el = el.parentElement
        ) {
          const s = getComputedStyle(el);
          if (s.zIndex !== 'auto' || s.transform !== 'none' || s.isolation === 'isolate')
            chain.push(el.tagName);
        }
        return { z: getComputedStyle(layer).zIndex, chain };
      }),
    );
    expect(stacking).toEqual([
      { z: '1', chain: [] },
      { z: '1', chain: [] },
    ]);
  });

  test('T-JN5 the footer takes the mark over: drag and throw it; scrolling back lifts the courier off', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=2');
    const footer = holds.at(-1)!;
    const part = page.locator('[data-playground-part="mark"]');
    await scrollToY(page, footer.start - 200);
    await expect(part).toHaveAttribute('data-courier-away', '');
    await expect(part).toBeHidden();
    await scrollToY(page, footer.start + 2);
    await expect(part).not.toHaveAttribute('data-courier-away');
    await expect(part).toBeVisible();
    expect((await probe<Pose>(page, 'pose')).hidden).toBe(true);
    // The playground runs as in phase 7: the part follows a drag. At the page's end it is still
    // handed over, and clear of the debug overlay in the bottom corner.
    await scrollToY(page, 1e6);
    expect((await probe<Pose>(page, 'pose')).hidden).toBe(true);
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('[data-dev-overlay]')
        ?.style.setProperty('display', 'none'),
    );
    await page.waitForTimeout(1500);
    const before = (await part.boundingBox())!;
    // Hover, press, then small moves a frame apart (as T-BF4): WebKit delivered the press and the
    // release of one 8-step move but no move Draggable saw in between (CI run 111).
    const at = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(100);
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(at.x - 14 * i, at.y - 5 * i);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await expect
      .poll(async () => Math.abs((await part.boundingBox())!.x - before.x), { timeout: 10_000 })
      .toBeGreaterThan(40);
    // Back up: the part waits at home, hidden, and the courier lifts off its box.
    await scrollToY(page, footer.start - 200);
    await expect(part).toHaveAttribute('data-courier-away', '');
    expect((await probe<Pose>(page, 'pose')).hidden).toBe(false);
    await expect
      .poll(() => part.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41))
      .toBe(0);
  });

  test('T-JN6 the smile station: the arch dissolves into the photo, which then stays', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=2');
    const smile = holds.find((h) => h.id === 'smile')!;
    const photo = page.locator('[data-smile-photo]');
    await scrollToY(page, smile.start - 10);
    await expect(photo).toHaveCSS('opacity', '0');
    await scrollToY(page, smile.start + (smile.end - smile.start) * 0.4);
    const seated = await probe<Pose>(page, 'pose');
    expect(seated).toMatchObject({ dock: 'smile', form: 'tooth', arch: 1, smile: 0 });
    await scrollToY(page, smile.end + 10);
    await expect(photo).toHaveCSS('opacity', '1');
    await scrollToY(page, holds.at(-1)!.start + 2);
    await expect(photo).toHaveCSS('opacity', '1');
  });
});

test.describe('tier 0 and reduced motion', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-light', 'journey rows run in desktop-light');
  });

  const noCourier = async (page: Page, query: string) => {
    const chunks: string[] = [];
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return;
      if ((await response.text().catch(() => '')).includes('data-courier-layer'))
        chunks.push(response.url());
    });
    await page.goto(`/?${query}`);
    await page.waitForLoadState('load');
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-courier-layer]')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-world-stage');
    expect(chunks, 'no courier chunk').toEqual([]);
    // The static art stays: the stepper's molar, the smile photo, the footer's mark part.
    await expect(page.locator('[data-world-slot="molar"]')).not.toHaveAttribute('data-world-live');
    await expect(page.locator('[data-smile-photo]')).not.toHaveAttribute('style');
    await expect(page.locator('[data-playground-part="mark"]')).not.toHaveAttribute(
      'data-courier-away',
    );
    await expect(page.locator('[data-scene="services"] [data-mark]')).toBeVisible();
  };

  test('T-JN7 tier 0 loads no courier chunk and keeps the static art', async ({ page }) => {
    await noCourier(page, 'tier=0');
  });

  test.describe(() => {
    test.use({ reducedMotion: 'reduce' });
    test('T-JN8 reduced motion wins over ?tier=3: no courier', async ({ page }) => {
      await noCourier(page, 'tier=3');
    });
  });
});

test.describe('phone, DOM courier', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-light', 'phone journey rows run in phone-light');
    test.setTimeout(180_000);
  });

  test('T-JN9 tier 1 phone: the DOM courier reaches the phone docks without three.js or a sideways scroll', async ({
    page,
  }) => {
    const three: string[] = [];
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return;
      if ((await response.text().catch(() => '')).includes('WebGLRenderer'))
        three.push(response.url());
    });
    const holds = await open(page, 'tier=1');
    // D1 is in the hero's 4:5 photo band whenever the hero shows one (a real photo, or the
    // client preview); without the band there is no box for it.
    const band = await page.locator('[data-hero-photo]').isVisible();
    expect(holds.map((h) => h.id)).toEqual([
      ...(band ? ['hero'] : []),
      'services',
      'restoration',
      'smile',
      'dentists',
      'footer',
    ]);
    await expect(page.locator('[data-scene="services"] [data-mark]')).toBeHidden();
    for (const stop of stops(holds)) {
      await scrollToY(page, stop.y);
      const pose = await probe<Pose>(page, 'pose');
      if (stop.dock !== null) expect(pose.dock, stop.name).toBe(stop.dock);
      const dom = await page.locator('[data-courier]').evaluate((el) => ({
        visibility: getComputedStyle(el).visibility,
        rect: el.getBoundingClientRect().toJSON() as DOMRect,
      }));
      expect(dom.visibility, stop.name).toBe(pose.hidden ? 'hidden' : 'visible');
      if (stop.dock !== null && !pose.hidden) {
        expect(await underCourier(page, pose), `at dock ${stop.name}`).toEqual({
          text: [],
          controls: [],
        });
      }
    }
    expect(three).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/** The top view's CSS animations (globals.css courier-top), by part. */
const topAnimations = (page: Page) =>
  page.locator('[data-form="top"]').evaluate((svg) =>
    svg.getAnimations({ subtree: true }).map((a) => ({
      part: ((a as CSSAnimation).effect as KeyframeEffect).target?.getAttribute('class') ?? '',
      state: a.playState,
      at: Number(a.currentTime ?? 0),
    })),
  );

test.describe('D3 top view, DOM courier', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!['desktop-light', 'phone-light'].includes(testInfo.project.name), 'two widths');
  });

  test('T-JN13 tier 1: the top view plays its level as it comes in at D3, and again on each chip', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=1');
    const hold = holds.find((h) => h.id === 'restoration')!;
    await scrollToY(page, hold.start - 300);
    await page.waitForTimeout(1500);
    await scrollToY(page, (hold.start + hold.end) / 2);
    const top = page.locator('[data-form="top"]');
    expect(Number(await top.evaluate((el) => (el as SVGElement).style.opacity))).toBeGreaterThan(
      0.9,
    );
    await expect(top).toHaveAttribute('data-top-level', '0');
    // Coming in: the composite fill is still being laid, not finished since the page loaded.
    const fill = (await topAnimations(page)).find((a) => a.part === 'ct-fill')!;
    expect(fill.state, 'the fill plays on arrival').toBe('running');
    // A chip: VIP's inlay seats now, CIP's layers after it.
    for (const [name, level, part] of [
      ['VIP', '1', 'ct-inlay'],
      ['CIP', '2', 'ct-dentine'],
    ] as const) {
      await page
        .locator('[data-scene="restoration"]')
        .getByRole('radio', { name })
        // The chips may sit off the phone's screen at the hold: the radio itself takes the click.
        .dispatchEvent('click');
      await expect(top).toHaveAttribute('data-top-level', level);
      const played = (await topAnimations(page)).find((a) => a.part === part)!;
      expect(played.state, `${name} plays`).toBe('running');
    }
    // Then everything holds still: no CSS animation runs at rest.
    await page.waitForTimeout(3200);
    expect((await topAnimations(page)).filter((a) => a.state === 'running')).toEqual([]);
  });
});

/** Median frame time (ms) over 12 frames of a slow scroll through `y` (10 px a frame). */
const frameCost = (page: Page, y: number) =>
  page.evaluate(async (at) => {
    window.scrollTo(0, at - 60);
    await new Promise((r) => setTimeout(r, 1200));
    const times: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 12; i += 1) {
      window.scrollTo(0, at - 60 + i * 10);
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    times.sort((a, b) => a - b);
    return times[6]!;
  }, y);

test.describe('tier 2 frame cost', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!['desktop-light', 'tablet-light'].includes(testInfo.project.name), 'two widths');
    test.setTimeout(180_000);
  });

  test('T-JN14 tier 2: a frame at D5 (the arch) costs no more than 2.5 times a frame at the other docks, on the same machine', async ({
    page,
  }, testInfo) => {
    const holds = await open(page, 'tier=2');
    await scrollToY(page, holds[0]!.end + 200);
    await expect.poll(() => probe<boolean>(page, 'webgl'), { timeout: 90_000 }).toBe(true);
    const at = (id: string, f: number) => {
      const h = holds.find((x) => x.id === id)!;
      return h.start + (h.end - h.start) * f;
    };
    const others: number[] = [];
    for (const id of ['services', 'restoration', 'dentists'])
      others.push(await frameCost(page, at(id, 0.5)));
    others.sort((a, b) => a - b);
    const base = others[1]!;
    const arch = [await frameCost(page, at('smile', 0.2)), await frameCost(page, at('smile', 0.4))];
    testInfo.annotations.push({
      type: 'frame cost (ms)',
      description: `docks ${others.map(Math.round).join(', ')}; D5 ${arch.map(Math.round).join(', ')}`,
    });
    for (const cost of arch)
      expect(cost, `D5 against ${Math.round(base)} ms`).toBeLessThan(2.5 * base);
  });
});

test.describe('tablet, DOM courier', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-light', 'tablet journey rows run in tablet-light');
    test.setTimeout(180_000);
  });

  test('T-JN11 tablet portrait: the courier docks at all eight stations, clear of text', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=1');
    expect(holds.map((h) => h.id)).toEqual([
      'hero',
      'services',
      'restoration',
      'workflow',
      'smile',
      'dentists',
      'booking',
      'footer',
    ]);
    for (const stop of stops(holds)) {
      if (stop.dock === null) continue;
      await scrollToY(page, stop.y);
      const pose = await probe<Pose>(page, 'pose');
      expect(pose.dock, stop.name).toBe(stop.dock);
      // At the footer the courier hands over to the footer's own mark.
      expect(pose.hidden, `${stop.name} shown`).toBe(stop.dock === 'footer');
      expect(await underCourier(page, pose), `at dock ${stop.name}`).toEqual({
        text: [],
        controls: [],
      });
    }
  });

  test('T-JN12 tablet: the empty D7 box collapses where no courier comes (tier 0, reduced motion)', async ({
    page,
  }) => {
    const d7 = page.locator('[data-dock="booking"]');
    await page.goto('/?tier=1');
    await expect(page.locator('html')).toHaveAttribute('data-tier', '1');
    await expect(d7).toBeVisible();
    await page.goto('/?tier=0');
    await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
    await expect(d7).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(d7).toBeHidden();
  });

  test('T-JN10 tier 1 tablet: the DOM courier and its arch sit centred on the pose, in their boxes', async ({
    page,
  }) => {
    const holds = await open(page, 'tier=1');
    const centre = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      });
    for (const id of ['services', 'restoration']) {
      const h = holds.find((x) => x.id === id)!;
      await scrollToY(page, (h.start + h.end) / 2);
      const pose = await probe<Pose>(page, 'pose');
      expect(pose.dock, id).toBe(id);
      const dom = await centre('[data-courier]');
      expect(Math.abs(dom.x - pose.x), `${id} x`).toBeLessThan(2);
      expect(Math.abs(dom.y - pose.y), `${id} y`).toBeLessThan(2);
      expect(Math.abs(dom.w - pose.scale), `${id} size`).toBeLessThan(2);
      // On its box's centre; the restoration slot carries the scrubbed settle, so there the
      // courier is inside its box, not on the box's resting centre.
      const box = await centre(`[data-dock="${id}"]`);
      const slack = id === 'restoration' ? { x: box.w / 2, y: box.h / 2 } : { x: 2, y: 2 };
      expect(Math.abs(dom.x - box.x), `${id} x in its box`).toBeLessThan(slack.x);
      expect(Math.abs(dom.y - box.y), `${id} y in its box`).toBeLessThan(slack.y);
    }
    // The SVG arch is centred on the smile box while it shows.
    const smile = holds.find((x) => x.id === 'smile')!;
    await scrollToY(page, smile.start + (smile.end - smile.start) * 0.3);
    expect((await probe<Pose>(page, 'pose')).dock).toBe('smile');
    const arch = await centre('[data-courier-arch]');
    const box = await centre('[data-dock="smile"]');
    expect(Math.abs(arch.x - box.x), 'arch x').toBeLessThan(2);
    // The arch's middle is where the occlusal photo has it (src/lib/archPhoto.ts).
    const middle = box.y + (ARCH_PHOTO.centre.v - 0.5) * box.h;
    expect(Math.abs(arch.y - middle), 'arch y').toBeLessThan(2);
  });
});
