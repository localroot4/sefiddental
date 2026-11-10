// The courier audit (docs/experience/journey.md sections 1 to 3): the home page scrolled top to
// bottom, sampled every fifth of a viewport, and at every sample where the courier is on screen
// (a) it shows whole (pose opacity at least 0.95), (b) its form's box crosses no text, control or
// field, (c) nothing that paints sits above it (the DOM courier, or the canvas for WebGL, is the
// first painting element at five points of its box). Riding with the page at a dock it passes
// behind the header and the sticky bar as all content does; travelling it keeps clear of them.
// Each project audits its width at tier 2 and tier 1 (plus 1024x768 and 854x1280 by resizing),
// light and dark, at every hold, ten points through every travel and every third of a screen;
// T-CA3 checks the drawn courier (the shown place) during a wheel scroll. Failures are listed by
// section; the bar is none.
import { expect, test, type Page } from '@playwright/test';

import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

interface Sample {
  y: number;
  section: string;
  problems: string[];
}

/** One sample in the page: the checks of the header comment, or null when there is no courier. */
function check(): Omit<Sample, 'y'> | null {
  const j = (window as unknown as { __sefidJourney: Record<string, () => unknown> }).__sefidJourney;
  const p = j.pose!() as {
    x: number;
    y: number;
    scale: number;
    hidden: boolean;
    opacity: number;
    dock: string | null;
  };
  if (p.hidden) return null;
  // What is drawn: the shown place (the pose with its spring), its form grown by the lean, the
  // squash and the stretch (motion.ts).
  const d = j.shown!() as {
    x: number;
    y: number;
    scale: number;
    tilt: number;
    sx: number;
    sy: number;
  };
  const turn = Math.abs(Math.cos(d.tilt)) + Math.abs(Math.sin(d.tilt));
  const half = ((d.scale * 0.8) / 2) * turn * Math.max(d.sx, d.sy);
  const box = { l: d.x - half, r: d.x + half, t: d.y - half, b: d.y + half };
  if (box.r <= 0 || box.l >= innerWidth || box.b <= 0 || box.t >= innerHeight) return null;
  const at = (x: number, y: number): string => {
    const cx = Math.min(innerWidth - 1, Math.max(0, x));
    const cy = Math.min(innerHeight - 1, Math.max(0, y));
    for (const e of document.elementsFromPoint(cx, cy)) {
      const s = e.closest('[data-home-section], [data-scene], [data-smile-band], footer');
      if (s) {
        return (
          s.getAttribute('data-home-section') ??
          s.getAttribute('data-scene') ??
          (s.hasAttribute('data-smile-band') ? 'smile' : 'footer')
        );
      }
    }
    return 'page';
  };
  const problems: string[] = [];
  if (p.opacity < 0.95) problems.push(`opacity ${p.opacity.toFixed(2)}`);
  const docked = p.dock !== null;
  const skip = `[aria-hidden="true"], [data-dev-overlay], [data-courier-layer]${docked ? ', header, [data-sticky-bar]' : ''}`;
  const shown = (el: Element): boolean =>
    el.closest(skip) === null &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).opacity !== '0';
  const hit = (r: DOMRect): boolean =>
    r.width > 0 &&
    r.height > 0 &&
    r.left < box.r &&
    r.right > box.l &&
    r.top < box.b &&
    r.bottom > box.t;
  for (const el of document.querySelectorAll(
    'a[href], button, input, select, textarea, summary, [role="button"]',
  )) {
    if (shown(el) && [...el.getClientRects()].some(hit)) {
      problems.push(`over a control «${(el.textContent ?? el.tagName).trim().slice(0, 24)}»`);
      break;
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent?.trim() || !shown(el)) continue;
    range.selectNodeContents(node);
    if ([...range.getClientRects()].some(hit)) {
      problems.push(`over text «${node.textContent.trim().slice(0, 24)}»`);
      break;
    }
  }
  const webgl = (j.webgl!() as boolean) === true;
  const target = document.querySelector<HTMLElement>(webgl ? 'canvas' : '[data-courier]')!;
  const layer = document.querySelector<HTMLElement>('[data-courier-layer]')!;
  target.style.pointerEvents = 'auto';
  if (!webgl) layer.style.pointerEvents = 'auto';
  const paints = (e: Element): boolean => {
    if (e.closest('[data-dev-overlay]')) return false;
    if (docked && e.closest('header, [data-sticky-bar]')) return false;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const alpha = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor)?.[1]?.split(',')[3];
    if (cs.backgroundColor !== 'transparent' && Number(alpha ?? 1) > 0.02) return true;
    if (cs.backgroundImage !== 'none') return true;
    if (/^(img|svg|video|canvas|picture|iframe|input|textarea|select|button)$/i.test(e.tagName)) {
      return true;
    }
    return [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim());
  };
  for (const [dx, dy] of [
    [0, 0],
    [-0.6, 0],
    [0.6, 0],
    [0, -0.6],
    [0, 0.6],
  ] as const) {
    const x = d.x + dx * half;
    const y = d.y + dy * half;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    const above = document
      .elementsFromPoint(x, y)
      .find((e) => e === target || target.contains(e) || paints(e));
    if (above && above !== target && !target.contains(above)) {
      problems.push(`under ${above.tagName.toLowerCase()}`);
      break;
    }
  }
  target.style.pointerEvents = '';
  if (!webgl) layer.style.pointerEvents = '';
  return { section: at(d.x, d.y), problems };
}

async function audit(page: Page, tier: 1 | 2): Promise<Sample[]> {
  await needsWebgl2(page);
  await skipIntro(page);
  await page.goto(`/?tier=${tier}&debug=1`);
  await page.waitForLoadState('load');
  await page.waitForFunction(() => '__sefidJourney' in window, null, { timeout: 30_000 });
  // Tier 2 audits the WebGL courier, never the DOM fallback in its place.
  if (tier === 2) {
    await page.waitForFunction(
      () => (window as unknown as { __sefidJourney: { webgl(): boolean } }).__sefidJourney.webgl(),
      null,
      { timeout: 90_000 },
    );
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    (window as unknown as { __sefidJourney: { measure(): void } }).__sefidJourney.measure(),
  );
  // The lanes are planned in idle time after a measure (route.ts): the audit judges them planned.
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __sefidJourney: { planStats(): { pending: number } | null } }
      ).__sefidJourney.planStats()?.pending === 0,
    null,
    { timeout: 60_000 },
  );

  // Where the courier is: every hold's middle and ten points through every travel, however short;
  // and the page every third of a screen.
  const positions = await page.evaluate(() => {
    const j = (
      window as unknown as { __sefidJourney: { holds(): { start: number; end: number }[] } }
    ).__sefidJourney;
    const holds = j.holds();
    const out: number[] = [];
    holds.forEach((h, i) => {
      out.push((h.start + h.end) / 2);
      const next = holds[i + 1];
      for (let k = 1; next && k <= 10; k += 1) out.push(h.end + ((next.start - h.end) * k) / 11);
    });
    const max = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= max; y += innerHeight / 3) out.push(y);
    return out.sort((a, b) => a - b);
  });
  const failing: Sample[] = [];
  for (const y of positions) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
    // The spring lands on the pose within about 0.3 s (motion.ts).
    await page.waitForTimeout(350);
    let sample = await page.evaluate(check);
    if (sample?.problems.length) {
      // Once more after the courier has surely settled (a slow software frame).
      await page.waitForTimeout(500);
      sample = await page.evaluate(check);
    }
    if (sample?.problems.length) failing.push({ y: Math.round(y), ...sample });
  }
  return failing;
}

const report = (failing: Sample[]): string =>
  failing.map((f) => `[${f.section}] y=${f.y}: ${f.problems.join('; ')}`).join('\n');

test.describe('courier audit', () => {
  test.beforeEach(({}, testInfo) => {
    test.setTimeout(300_000);
    test.skip(testInfo.project.name.startsWith('http'), 'page rows only');
  });

  for (const tier of [2, 1] as const) {
    test(`T-CA1 tier ${tier}: whole, never over text or a control, never under anything that paints`, async ({
      page,
    }, testInfo) => {
      const name = testInfo.project.name;
      test.skip(!/^(desktop|tablet|phone)-(light|dark)$/.test(name), 'the six matrix projects');
      // Phones are tier 1 (the DOM courier); a dark tier 2 row once per width is enough.
      test.skip(name.startsWith('phone') && tier === 2, 'phones run the DOM courier');
      const failing = await audit(page, tier);
      expect(report(failing), `failing samples in ${name} at tier ${tier}`).toBe('');
    });
  }

  for (const tier of [2, 1] as const) {
    test(`T-CA3 tier ${tier}: during a wheel scroll the drawn courier crosses no text or control`, async ({
      page,
      browserName,
    }, testInfo) => {
      // Playwright has no mouse wheel in mobile WebKit: the same 60 px steps by script there.
      const wheelless = browserName === 'webkit' && testInfo.project.use.isMobile === true;
      test.skip(
        testInfo.project.name !== 'desktop-light' && testInfo.project.name !== 'tablet-light',
        'one row per width, light',
      );
      await needsWebgl2(page);
      await skipIntro(page);
      await page.goto(`/?tier=${tier}&debug=1`);
      await page.waitForLoadState('load');
      await page.waitForFunction(() => '__sefidJourney' in window, null, { timeout: 30_000 });
      if (tier === 2) {
        await page.waitForFunction(
          () =>
            (window as unknown as { __sefidJourney: { webgl(): boolean } }).__sefidJourney.webgl(),
          null,
          { timeout: 90_000 },
        );
      }
      await page.waitForTimeout(1500);
      // The lanes are planned in idle time after a measure (route.ts): the audit judges them planned.
      await page.waitForFunction(
        () =>
          (
            window as unknown as { __sefidJourney: { planStats(): { pending: number } | null } }
          ).__sefidJourney.planStats()?.pending === 0,
        null,
        { timeout: 60_000 },
      );
      await page.mouse.move(200, 300);
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const failing: Sample[] = [];
      // About 1500 px/s: 60 px every 40 ms, the check in the frame after each notch.
      for (let y = 0; y < max; y = await page.evaluate(() => window.scrollY)) {
        if (wheelless) await page.evaluate(() => window.scrollBy(0, 60));
        else await page.mouse.wheel(0, 60);
        await page.waitForTimeout(40);
        // The frame after the notch: the driver has drawn the courier for this scroll position (a
        // slow headless frame, about 300 ms in WebKit, would compare an older one with the text).
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const sample = await page.evaluate(check);
        // Over text or a control only: mid-scroll the whole-paint check is the rest audit's.
        const over = sample?.problems.filter((p) => p.startsWith('over')) ?? [];
        if (over.length)
          failing.push({ y: Math.round(y), section: sample!.section, problems: over });
        if (failing.length > 20) break;
      }
      expect(report(failing), `failing samples mid-scroll at tier ${tier}`).toBe('');
    });
  }

  test('T-CA2 1024x768 and 854x1280 at tier 1', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-light' && testInfo.project.name !== 'tablet-light',
      'one row per resized width',
    );
    const size =
      testInfo.project.name === 'desktop-light'
        ? { width: 1024, height: 768 }
        : { width: 854, height: 1280 };
    await page.setViewportSize(size);
    const failing = await audit(page, 1);
    expect(report(failing), `failing samples at ${size.width}x${size.height}`).toBe('');
  });

  test('T-CA4 the intro hand-off: no frame of a glide puts the form over text, a control or a card; a phone never glides', async ({
    page,
  }, testInfo) => {
    const name = testInfo.project.name;
    test.skip(!['desktop-light', 'tablet-light', 'phone-light'].includes(name), 'light rows');
    const sizes =
      name === 'desktop-light'
        ? [
            { width: 1440, height: 900 },
            { width: 1024, height: 768 },
          ]
        : name === 'tablet-light'
          ? [
              { width: 820, height: 1180 },
              { width: 854, height: 1280 },
            ]
          : [page.viewportSize()!];
    for (const size of sizes) {
      // A new tab plays the intro again (its session flag is per tab).
      const tab = await page.context().newPage();
      await tab.setViewportSize(size);
      // Every frame of a glide, from the intro's first frame on (the intro plays: no skipIntro).
      await tab.addInitScript(() => {
        const out = { glide: 0, problems: [] as string[] };
        (window as unknown as { __glide: typeof out }).__glide = out;
        const tick = (): void => {
          const j = (
            window as unknown as {
              __sefidJourney?: {
                handoff(): string | null;
                shown(): {
                  x: number;
                  y: number;
                  scale: number;
                  tilt: number;
                  sx: number;
                  sy: number;
                };
              };
            }
          ).__sefidJourney;
          if (j?.handoff() === 'glide') {
            out.glide += 1;
            // The form's box as T-CA1 draws it (the shown place, grown by its lean and stretch).
            const d = j.shown();
            const turn = Math.abs(Math.cos(d.tilt)) + Math.abs(Math.sin(d.tilt));
            const half = ((d.scale * 0.8) / 2) * turn * Math.max(d.sx, d.sy);
            const hit = (r: DOMRect): boolean =>
              r.width > 0 &&
              r.height > 0 &&
              r.left < d.x + half &&
              r.right > d.x - half &&
              r.top < d.y + half &&
              r.bottom > d.y - half;
            const skip = '[aria-hidden="true"], [data-dev-overlay], [data-courier-layer], #intro';
            const shown = (el: Element): boolean =>
              el.closest(skip) === null && getComputedStyle(el).visibility !== 'hidden';
            for (const el of document.querySelectorAll(
              'a[href], button, input, select, textarea, summary, [role="button"]',
            )) {
              if (shown(el) && [...el.getClientRects()].some(hit)) {
                out.problems.push(`over a control «${(el.textContent ?? '').trim().slice(0, 24)}»`);
              }
            }
            for (const card of document.querySelectorAll(
              '[data-above-courier] > :not([data-dock])',
            )) {
              if ([...card.getClientRects()].some(hit)) out.problems.push('over a card');
            }
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const range = document.createRange();
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const el = node.parentElement;
              if (!el || !node.textContent?.trim() || !shown(el)) continue;
              range.selectNodeContents(node);
              if ([...range.getClientRects()].some(hit)) {
                out.problems.push(`over text «${node.textContent.trim().slice(0, 24)}»`);
              }
            }
          }
          if (performance.now() < 8000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await tab.goto('/?tier=1&debug=1');
      await tab.waitForFunction(() => document.documentElement.dataset.intro === 'done');
      await tab.waitForTimeout(1500);
      const { glide, problems } = await tab.evaluate(
        () => (window as unknown as { __glide: { glide: number; problems: string[] } }).__glide,
      );
      testInfo.annotations.push({
        type: 'glide frames',
        description: `${size.width}x${size.height}: ${glide}`,
      });
      if (name === 'phone-light') expect(glide, 'a phone never glides').toBe(0);
      expect([...new Set(problems)], `${size.width}x${size.height}`).toEqual([]);
      await tab.close();
    }
  });
});
