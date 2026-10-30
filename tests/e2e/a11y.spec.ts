// Accessibility (phase 9 deliverable 3, docs/qa/audit-accessibility.md), in all six viewport and
// theme projects:
// - T-A11Y: axe-core WCAG 2.2 AA on every public template (contrast differs per theme). The bar is
//   zero violations of any impact, stricter than the phase's "zero serious or critical"; a
//   disabled rule needs a reason here and in the audit. Every «incomplete» axe leaves (text over
//   the hero photo) is judged on the screenshot's pixels. Plus the outline a screen reader reads,
//   44 px targets at 390 px, no sideways scroll at 200 % zoom, and reduced motion as tier 0.
// - T-KB: keyboard walkthroughs. Every Tab stop is in view, not under the sticky header or bar
//   (2.4.11), and shows a focus indicator (2.4.7).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import sharp from 'sharp';

import { t } from '@/i18n/fa';

import { WCAG22AA } from '../helpers/axe';
import { formsHydrated } from '../helpers/booking';
import { skipIntro } from '../helpers/intro';
import { requireRoutes, type PendingRoute } from '../helpers/pending';
import { MAINTENANCE_ORIGIN } from '../helpers/servers';

const TEMPLATES: ReadonlyArray<{
  name: string;
  url: string;
  status: number;
  needs?: PendingRoute;
  /** A page outside the site shell (system pages): no site header and footer, one H1. */
  bare?: boolean;
}> = [
  { name: 'home', url: '/', status: 200 },
  { name: '404-unmatched', url: '/no-such-page', status: 404 },
  { name: '404 template (200)', url: '/qa/not-found', status: 200 },
  { name: '500', url: '/qa/error', status: 500 },
  { name: '410', url: '/qa/gone', status: 410, bare: true },
  { name: '503 (maintenance server)', url: `${MAINTENANCE_ORIGIN}/`, status: 503, bare: true },
  { name: 'maintenance.html (host fallback)', url: '/maintenance.html', status: 200, bare: true },
  { name: 'component gallery', url: '/qa/components', status: 200 },
  {
    name: '404 for an unknown service slug',
    url: encodeURI('/خدمات/no-such-service'),
    status: 404,
  },
  // Phase 4 templates at their public Persian URLs; the dentist and the guide are the e2e fixture.
  { name: 'services-hub', url: encodeURI('/خدمات'), status: 200 },
  { name: 'category', url: encodeURI('/خدمات/زیبایی'), status: 200 },
  { name: 'restoration', url: encodeURI('/خدمات/ترمیم-دندان'), status: 200 },
  { name: 'service', url: encodeURI('/خدمات/لمینت-سرامیکی'), status: 200 },
  { name: 'dentists-hub', url: encodeURI('/پزشکان'), status: 200 },
  { name: 'dentist', url: encodeURI('/پزشکان/دکتر-نمونه-آزمایشی'), status: 200 },
  { name: 'about', url: encodeURI('/درباره-ما'), status: 200 },
  { name: 'address', url: encodeURI('/آدرس'), status: 200 },
  { name: 'guide-hub', url: encodeURI('/راهنمای-بیمار'), status: 200 },
  { name: 'guide', url: encodeURI('/راهنمای-بیمار/اولین-مراجعه'), status: 200 },
  // Phase 5 pages.
  { name: 'pricing', url: encodeURI('/هزینه-و-پرداخت'), status: 200 },
  { name: 'privacy', url: encodeURI('/حریم-خصوصی'), status: 200 },
  { name: 'booking', url: encodeURI('/رزرو-نوبت'), status: 200 },
  { name: 'emergency', url: encodeURI('/اورژانس'), status: 200 },
];

/** The home page at each quality tier: tier 2 pins the scenes from 1024 px (data-pins). */
const HOME_TIERS = [0, 1, 2] as const;
/** axe scans tier 3 too: the forced tier mounts the canvas layer (phase 8 draws in it). */
const HOME_SCAN_TIERS = [...HOME_TIERS, 3] as const;

// Every test opens the page without the intro, except the one that walks through it.
const INTRO_RUNNING = 'with the intro running';
test.beforeEach(({ page }, testInfo) =>
  testInfo.title.includes(INTRO_RUNNING) ? undefined : skipIntro(page),
);

const size = (testInfo: TestInfo) => testInfo.project.name.split('-')[0];

async function openTemplate(page: Page, template: (typeof TEMPLATES)[number]): Promise<void> {
  if (template.needs) requireRoutes(template.needs);
  // The status proves the check ran on the template itself, not on an error page.
  const response = await page.goto(template.url);
  expect(response?.status()).toBe(template.status);
  await page.waitForLoadState('load');
  // A page that throws gets Next's bare error shell (no lang) from the server, and the branded
  // error view only after hydration; check what the visitor gets, not the race before it.
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
}

/** Loads `/?tier=n` and waits for the engine where the tier runs one. */
async function openHome(page: Page, tier: number): Promise<void> {
  await page.goto(`/?tier=${tier}`);
  await page.waitForLoadState('load');
  await expect(page.locator('html')).toHaveAttribute('data-tier', String(tier));
  if (tier > 0) {
    await page.waitForFunction(() => performance.getEntriesByName('sefid:engine-init').length > 0);
  }
}

// ---------------------------------------------------------------------------------------------
// Contrast on the pixels. axe reports text over an image as «incomplete» (it cannot know the
// pixels): the hero subtext and call button, the phone trust band over the photo. Each such node
// is measured here: the text turns transparent, its line boxes are captured, and the worst
// background pixel against the text colour must reach 4.5:1 (3:1 for large text).

interface Contrast {
  label: string;
  ratio: number;
  required: number;
}

const luminance = (r: number, g: number, b: number) => {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

async function pixelContrast(page: Page, target: Locator): Promise<Contrast> {
  await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  // The loaded images are decoded before the capture (an undecoded image paints nothing); a lazy
  // image that never loads would never settle its decode.
  await page.evaluate(() =>
    Promise.all(
      [...document.images]
        .filter((img) => img.complete && img.naturalWidth > 0)
        .map((img) => img.decode().catch(() => undefined)),
    ),
  );
  const info = await target.evaluate((el) => {
    const style = getComputedStyle(el);
    // The computed style is live: read the colour before the text turns transparent.
    const color = style.color;
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const left = Math.max(Math.min(...lines.map((r) => r.left)), 0);
    const top = Math.max(Math.min(...lines.map((r) => r.top)), 0);
    const right = Math.min(Math.max(...lines.map((r) => r.right)), window.innerWidth);
    const bottom = Math.min(Math.max(...lines.map((r) => r.bottom)), window.innerHeight);
    const px = parseFloat(style.fontSize);
    // Transparent text everywhere inside (children may set their own colour), through CSSOM,
    // which the CSP allows; restored after the capture.
    for (const node of [el as HTMLElement, ...el.querySelectorAll<HTMLElement>('*')]) {
      node.dataset.kbStyle = node.style.cssText;
      node.style.setProperty('color', 'transparent', 'important');
      node.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
      node.style.setProperty('text-decoration-color', 'transparent', 'important');
    }
    return {
      color,
      clip: { x: left, y: top, width: right - left, height: bottom - top },
      large: px >= 24 || (px >= 18.66 && Number(style.fontWeight) >= 700),
      label: `${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 30)}»`,
    };
  });
  const shot = await page.screenshot({ clip: info.clip, animations: 'disabled' });
  await target.evaluate((el) => {
    for (const node of [el as HTMLElement, ...el.querySelectorAll<HTMLElement>('*')]) {
      node.style.cssText = node.dataset.kbStyle ?? '';
      delete node.dataset.kbStyle;
    }
  });
  const [r = 0, g = 0, b = 0, a = 1] = (info.color.match(/[\d.]+/g) ?? []).map(Number);
  const { data, info: raw } = await sharp(shot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let worst = Infinity;
  for (let i = 0; i < data.length; i += raw.channels) {
    const [br, bg, bb] = [data[i]!, data[i + 1]!, data[i + 2]!];
    // A translucent text colour blends over each background pixel.
    const text = luminance(a * r + (1 - a) * br, a * g + (1 - a) * bg, a * b + (1 - a) * bb);
    const back = luminance(br, bg, bb);
    worst = Math.min(worst, (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05));
  }
  return { label: info.label, ratio: worst, required: info.large ? 3 : 4.5 };
}

/**
 * axe WCAG 2.2 AA: zero violations (the bar of helpers/axe.ts), and every «incomplete» judged: a
 * colour contrast axe could not compute is measured on the pixels; any other kind fails.
 */
async function expectAccessible(
  page: Page,
  options: {
    /**
     * Home at tiers 1 to 3: a block below or above the viewport may wait in its reveal's start
     * state (faded); it is never seen so and reaches full opacity as it enters. Contrast on such a
     * block is not judged; a faded block inside the viewport still fails.
     */
    offscreenReveals?: boolean;
    /** The QA gallery's photo-slot samples sit on placeholder art: their incomplete is not judged. */
    skipIncomplete?: boolean;
  } = {},
): Promise<void> {
  const { violations, incomplete } = await new AxeBuilder({ page })
    .withTags([...WCAG22AA])
    .exclude('[data-dev-overlay]')
    .analyze();
  if (options.offscreenReveals) {
    for (const v of violations.filter((x) => x.id === 'color-contrast')) {
      const hidden = await page.evaluate(
        (selectors) =>
          selectors.map((selector) => {
            const el = document.querySelector(selector);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            let opacity = 1;
            for (let e: Element | null = el; e; e = e.parentElement) {
              opacity *= Number(getComputedStyle(e).opacity);
            }
            return (r.bottom <= 0 || r.top >= window.innerHeight) && opacity < 1;
          }),
        v.nodes.map((n) => n.target.join(' ')),
      );
      v.nodes = v.nodes.filter((_, i) => !hidden[i]);
    }
  }
  const summary = violations
    .filter((v) => v.nodes.length > 0)
    .map(
      (v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
  expect(summary, `axe WCAG 2.2 AA violations on ${page.url()}`).toEqual([]);
  const unjudged: string[] = [];
  for (const rule of options.skipIncomplete ? [] : incomplete) {
    for (const node of rule.nodes) {
      const selector = node.target.join(' ');
      if (rule.id !== 'color-contrast' || node.target.length !== 1) {
        unjudged.push(`${rule.id}: ${selector}`);
        continue;
      }
      const result = await pixelContrast(page, page.locator(selector));
      if (result.ratio < result.required) {
        unjudged.push(`${result.label} ${result.ratio.toFixed(2)}:1 < ${result.required}:1`);
      }
    }
  }
  expect(unjudged, `axe incomplete on ${page.url()}, judged on the pixels`).toEqual([]);
}

for (const template of TEMPLATES) {
  test(`T-A11Y ${template.name}`, async ({ page }) => {
    await openTemplate(page, template);
    await expectAccessible(page, { skipIncomplete: template.name === 'component gallery' });
  });
}

// The chosen state of the restoration tiers (freeze G13): one card warm, its CTA swapped in.
test('T-A11Y restoration with a tier chosen', async ({ page }) => {
  await page.goto(encodeURI('/خدمات/ترمیم-دندان'));
  await page.waitForLoadState('load');
  await page.locator('[id="سطح-ترمیم"]').getByRole('radio', { name: 'VIP' }).check();
  await expectAccessible(page);
});

for (const tier of HOME_SCAN_TIERS) {
  test(`T-A11Y home at ?tier=${tier}, at load and after a full scroll`, async ({ page }) => {
    await openHome(page, tier);
    await expectAccessible(page, { offscreenReveals: tier > 0 });
    // Down the page most of a viewport at a time, so every reveal and pinned scene runs.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = page.viewportSize()!.height * 0.8;
    for (let y = 0; y < height; y += step) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(800);
    await expectAccessible(page, { offscreenReveals: tier > 0 });
  });
}

// Phase 7 left the text over the hero photo checked by eye (axe «incomplete»). Measured here on
// the pixels for the H1, the subtext and the call button, whatever axe decides about them.
test('T-A11Y hero text contrast on the photo, measured on the pixels', async ({ page }) => {
  await openHome(page, 0);
  const hero = page.locator('[data-scene="hero"]');
  const results = [
    await pixelContrast(page, hero.locator('#hero-h1')),
    await pixelContrast(page, hero.locator('#hero-sub')),
    await pixelContrast(page, hero.getByRole('link', { name: t('call.label') })),
  ];
  test.info().annotations.push({
    type: 'hero contrast',
    description: results.map((r) => `${r.label} ${r.ratio.toFixed(2)}:1`).join('; '),
  });
  for (const result of results) {
    expect(result.ratio, result.label).toBeGreaterThanOrEqual(result.required);
  }
});

// ---------------------------------------------------------------------------------------------
// Structure: the outline a screen reader reads (the accessibility tree, page.ariaSnapshot), the
// 44 px targets at 390 px (brief: 44 px, beyond WCAG 2.5.8's 24 px) and reflow at 200 % zoom.

/** Landmarks at the top of the tree and the heading levels in reading order. */
async function outline(page: Page) {
  const yaml = await page.ariaSnapshot();
  const top = [...yaml.matchAll(/^- (banner|main|contentinfo)\b/gm)].map((m) => m[1]);
  const inMain = yaml.split(/^- main\b/m)[1]?.split(/^- \S/m)[0] ?? '';
  // A line whose name holds «: » is quoted whole in the YAML: `- 'heading "…" [level=1]'`.
  const heading = /- '?heading (?:"(?:[^"\\]|\\.)*" )?\[level=(\d)\]/g;
  const levels = [...inMain.matchAll(heading)].map((m) => Number(m[1]));
  const ones = [...yaml.matchAll(heading)].filter((m) => m[1] === '1').length;
  const unnamed = [...yaml.matchAll(/- '?heading \[level=\d\]/g)].length;
  return { top, levels, ones, unnamed };
}

/** Focusable controls whose hit area is under 44 x 44 px, except links inside running text. */
const smallTargets = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const selector = 'a[href], button, input, select, textarea, summary, [tabindex]';
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.tabIndex < 0 || el.closest('[aria-hidden="true"], [inert], dialog:not([open])')) {
        continue;
      }
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || style.visibility === 'hidden') continue;
      // WCAG 2.5.8 inline exception: a link in a sentence keeps the line height.
      if (style.display === 'inline') continue;
      // A radio or a checkbox: its label is the target too.
      const parts: HTMLElement[] = [el];
      if (el instanceof HTMLInputElement) parts.push(...(el.labels ?? []));
      const boxes = parts.map((part) => part.getBoundingClientRect());
      // A card link, a tag or a tier card's label widens its hit area with an absolute ::after
      // (a stretched link).
      for (const part of parts) {
        const after = getComputedStyle(part, '::after');
        if (after.content === 'none' || after.position !== 'absolute') continue;
        let cb: HTMLElement | null = part;
        while (cb && getComputedStyle(cb).position === 'static') cb = cb.parentElement;
        if (!cb) continue;
        const r = cb.getBoundingClientRect();
        const px = (v: string) => parseFloat(v) || 0;
        boxes.push(
          new DOMRect(
            r.left + px(after.left),
            r.top + px(after.top),
            r.width - px(after.left) - px(after.right),
            r.height - px(after.top) - px(after.bottom),
          ),
        );
      }
      const width = Math.max(...boxes.map((b) => b.width));
      const height = Math.max(...boxes.map((b) => b.height));
      if (width < 43.5 || height < 43.5) {
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
        out.push(
          `${el.tagName.toLowerCase()} «${name}» ${Math.round(width)}x${Math.round(height)}`,
        );
      }
    }
    return out;
  });

for (const template of TEMPLATES) {
  test(`T-A11Y structure ${template.name}: outline, 44 px targets, 200 % zoom`, async ({
    page,
  }, testInfo) => {
    await openTemplate(page, template);
    await test.step('outline: banner, main, contentinfo; one H1, first in main; no skipped level; every heading named', async () => {
      const { top, levels, ones, unnamed } = await outline(page);
      // The QA gallery shows every heading style, two H1 among them: a design sample.
      if (template.name === 'component gallery') return;
      expect(ones, 'one H1').toBe(1);
      expect(unnamed, 'headings without a name').toBe(0);
      if (template.bare) return;
      expect(top).toEqual(['banner', 'main', 'contentinfo']);
      expect(levels[0], 'the first heading in main is the H1').toBe(1);
      const skips = levels.flatMap((level, i) =>
        i > 0 && level > levels[i - 1]! + 1 ? [`h${levels[i - 1]} → h${level}`] : [],
      );
      expect(skips, 'heading levels go down one at a time').toEqual([]);
    });
    if (size(testInfo) === 'phone') {
      await test.step('every control is at least 44 x 44 px at 390 px', async () => {
        // The QA gallery's bare urgent link is a design sample, never on a public page.
        const small = (await smallTargets(page)).filter(
          (s) => template.name !== 'component gallery' || !s.includes('درد شدید'),
        );
        expect(small).toEqual([]);
      });
    }
    if (size(testInfo) === 'desktop') {
      await test.step('200 % zoom of 1280 px (640 CSS px): no sideways scroll', async () => {
        await page.setViewportSize({ width: 640, height: 400 });
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

// Reduced motion equals tier 0: the same sections at the same heights, the same Tab order, no
// intro, no pins, and nothing animating after a full scroll.
test('T-A11Y reduced motion gives the tier-0 page', async ({ page }) => {
  const shape = () =>
    page.evaluate(() => ({
      sections: [...document.querySelectorAll<HTMLElement>('[data-home-section]')].map(
        (el) => `${el.dataset.homeSection} ${Math.round(el.getBoundingClientRect().height)}`,
      ),
      tabbable: [...document.querySelectorAll<HTMLElement>('a[href], button, input, summary')]
        .filter((el) => el.tabIndex >= 0 && el.checkVisibility({ visibilityProperty: true }))
        .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 20)),
    }));
  await openHome(page, 0);
  const tier0 = await shape();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('load');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-tier', '0');
  await expect(html).toHaveAttribute('data-tier-reason', 'reduced-motion');
  expect(await html.getAttribute('data-pins')).toBeNull();
  await expect(page.locator('#intro')).toHaveCount(0);
  expect(await shape()).toEqual(tier0);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  const moving = await page.evaluate(() => ({
    running: document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => String((a.effect as KeyframeEffect | null)?.target?.className ?? '?')),
    inline: document.querySelectorAll('main [style*="transform"], main [style*="opacity"]').length,
  }));
  expect(moving).toEqual({ running: [], inline: 0 });
});

// ---------------------------------------------------------------------------------------------
// Keyboard walkthroughs (T-KB). Each Tab stop must be in view (inside the viewport and every
// clipping ancestor), not covered by another element such as the sticky header or bar (WCAG
// 2.4.11), and show a focus indicator (2.4.7): a screenshot of the stop with its ring differs from
// one without it. A walk ends where the focus wraps to a stop it has seen.

interface Stop {
  label: string;
  /** Share of the element's box inside the viewport and every clipping ancestor. */
  inView: number;
  /** Share of that visible part not covered by another element (sampled hit test). */
  uncovered: number;
  /** The box and its ring, in viewport pixels, for the ring screenshots. */
  clip: { x: number; y: number; width: number; height: number } | null;
  /** Inside the walk's container (`within` or `until`), or no container. */
  inside: boolean;
}

/**
 * Waits until the page and every scroll container around the focus move less than a pixel for
 * three frames (smooth scroll) and the focused element's own transitions end (the skip link
 * slides in). A smooth scroll that hovers on a sub-pixel for 5 s does not fail the walk: the
 * stop's checks below decide.
 */
const settled = (page: Page) =>
  page
    .waitForFunction(
      () => {
        const w = window as unknown as { __kb?: { at: number[]; still: number } };
        const at = [window.scrollX, window.scrollY];
        for (let el = document.activeElement?.parentElement; el; el = el.parentElement) {
          at.push(el.scrollLeft, el.scrollTop);
        }
        const same =
          w.__kb?.at.length === at.length && at.every((v, i) => Math.abs(v - w.__kb!.at[i]!) < 1);
        w.__kb = { at, still: same ? w.__kb!.still + 1 : 0 };
        const moving = document.activeElement?.getAnimations().length ?? 0;
        return w.__kb.still >= 3 && moving === 0;
      },
      null,
      { polling: 'raf', timeout: 5000 },
    )
    .catch(() => undefined);

const readStop = (page: Page, container: string | null): Promise<Stop | null> =>
  page.evaluate((within) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) return null;
    const box = el.getBoundingClientRect();
    const text = (el.getAttribute('aria-label') ?? el.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    const type = el.getAttribute('type');
    const label = `${el.tagName.toLowerCase()}${type ? `[${type}]` : ''} «${text.slice(0, 40)}»`;
    let left = Math.max(box.left, 0);
    let top = Math.max(box.top, 0);
    let right = Math.min(box.right, window.innerWidth);
    let bottom = Math.min(box.bottom, window.innerHeight);
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      if (s.overflowX !== 'visible')
        [left, right] = [Math.max(left, r.left), Math.min(right, r.right)];
      if (s.overflowY !== 'visible')
        [top, bottom] = [Math.max(top, r.top), Math.min(bottom, r.bottom)];
    }
    const w = Math.max(right - left, 0);
    const h = Math.max(bottom - top, 0);
    const inView = (w * h) / Math.max(box.width * box.height, 1);
    let hits = 0;
    let samples = 0;
    if (w > 0 && h > 0) {
      const labels = el instanceof HTMLInputElement ? [...(el.labels ?? [])] : [];
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const fy of [0.2, 0.5, 0.8]) {
          samples += 1;
          const hit = document.elementFromPoint(left + w * fx, top + h * fy);
          if (
            hit &&
            (el.contains(hit) || hit.contains(el) || labels.some((l) => l.contains(hit)))
          ) {
            hits += 1;
          }
        }
      }
    }
    // A card link draws its ring on an absolute ::after over the whole card: the ring's clip is
    // the pseudo-element's containing block (the nearest positioned ancestor) then.
    const after = getComputedStyle(el, '::after');
    let ring = box;
    if (after.content !== 'none' && after.position === 'absolute') {
      let cb: HTMLElement | null = el;
      while (cb && getComputedStyle(cb).position === 'static') cb = cb.parentElement;
      if (cb) ring = cb.getBoundingClientRect();
    }
    const pad = 6;
    const x = Math.max(Math.floor(ring.left - pad), 0);
    const y = Math.max(Math.floor(ring.top - pad), 0);
    const cw = Math.min(Math.ceil(ring.right + pad), window.innerWidth) - x;
    const ch = Math.min(Math.ceil(ring.bottom + pad), window.innerHeight) - y;
    return {
      label,
      inView,
      uncovered: samples ? hits / samples : 0,
      clip: w > 0 && h > 0 && cw > 0 && ch > 0 ? { x, y, width: cw, height: ch } : null,
      inside: within === null || Boolean(el.closest(within)),
    };
  }, container);

/** The focus indicator shows: the stop's pixels with its ring differ from those without. */
async function ringShows(page: Page, clip: NonNullable<Stop['clip']>): Promise<boolean> {
  const focused = await page.screenshot({ clip, animations: 'disabled' });
  // The ring is hidden by a constructed style sheet (the CSP refuses an injected <style>, not
  // these) on the element, its pseudo-elements and the peers that draw it (chips, the slider
  // handle), never by a blur: a blur runs focusout handlers and changes the page under the walk.
  await page.evaluate(() => {
    const w = window as unknown as { __kbSheet?: boolean };
    if (!w.__kbSheet) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        ':is([data-kb-noring], [data-kb-noring] *, [data-kb-noring] ~ *, [data-kb-noring] ~ * *), :is([data-kb-noring], [data-kb-noring] *)::before, :is([data-kb-noring], [data-kb-noring] *)::after { outline-style: none !important; }',
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      w.__kbSheet = true;
    }
    document.activeElement?.setAttribute('data-kb-noring', '');
  });
  const plain = await page.screenshot({ clip, animations: 'disabled' });
  await page.evaluate(() => document.activeElement?.removeAttribute('data-kb-noring'));
  return !focused.equals(plain);
}

/** Marks the focused element as seen; true when it was seen before (the walk wrapped). */
const seenBefore = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const w = window as unknown as { __kbSeen?: WeakSet<Element> };
    w.__kbSeen ??= new WeakSet();
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    if (w.__kbSeen.has(el)) return true;
    w.__kbSeen.add(el);
    return false;
  });

/**
 * Presses Tab until the focus wraps (or after `max` stops, or once it leaves `until`) and checks
 * every stop. `within`: every stop must be inside this container (a modal's trap).
 */
async function tabWalk(
  page: Page,
  options: { max?: number; within?: string; until?: string } = {},
): Promise<string[]> {
  const labels: string[] = [];
  const problems: string[] = [];
  for (let i = 0; i < (options.max ?? 200); i += 1) {
    await page.keyboard.press('Tab');
    await settled(page);
    if (await seenBefore(page)) break;
    const stop = await readStop(page, options.within ?? options.until ?? null);
    if (stop === null) continue; // the focus left the document between two laps
    if (options.until && !stop.inside) break;
    labels.push(stop.label);
    const at = `stop ${labels.length} ${stop.label}`;
    if (!stop.inside) problems.push(`${at}: outside ${options.within}`);
    else if (stop.inView < 0.9) problems.push(`${at}: ${Math.round(stop.inView * 100)}% in view`);
    else if (stop.uncovered < 0.6) {
      problems.push(`${at}: ${Math.round(stop.uncovered * 100)}% not covered`);
    } else if (stop.clip && !(await ringShows(page, stop.clip))) {
      problems.push(`${at}: no visible focus indicator`);
    }
  }
  expect(problems, `keyboard walk of ${page.url()}`).toEqual([]);
  return labels;
}

for (const template of TEMPLATES.filter((tpl) => tpl.name !== 'home')) {
  test(`T-KB walk ${template.name}`, async ({ page }) => {
    await openTemplate(page, template);
    expect((await tabWalk(page)).length).toBeGreaterThan(0);
  });
}

// Home at each tier: the hero card, the services row or pinned track, the restoration chips and
// their CTA, the slider, the FAQ and the booking block, each stop in view with its ring.
for (const tier of HOME_TIERS) {
  test(`T-KB walk home at ?tier=${tier} (tier 2 pins the scenes from 1024 px)`, async ({
    page,
  }) => {
    await openHome(page, tier);
    const labels = await tabWalk(page);
    // The hero card's phone field comes before the first scene.
    const phone = labels.findIndex((label) => label.startsWith('input[tel]'));
    expect(phone).toBeGreaterThan(0);
    expect(phone).toBeLessThan(15);
  });
}

test(`T-KB home ${INTRO_RUNNING}: the Tab that ends it starts the walk at the skip link`, async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'playing');
  await page.keyboard.press('Tab');
  await expect(page.locator('#intro')).toHaveCount(0);
  await expect(page.locator('a.skip-link')).toBeFocused();
  await seenBefore(page);
  const labels = await tabWalk(page, { max: 20 });
  expect(labels.some((label) => label.startsWith('input[tel]'))).toBe(true);
});

/** Tab from «همهٔ خدمات», the last stop of scene 3, three times into scene 4. */
async function restorationStops(page: Page): Promise<string[]> {
  await page.locator('[data-scene="services"] a').last().focus();
  await settled(page);
  const stops: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    await settled(page);
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement) return `chip ${el.name}`;
        const href = decodeURI(el?.getAttribute('href') ?? '').replace(/^[^?#]*/, '');
        return `${el?.textContent?.trim()} ${href}`;
      }),
    );
  }
  return stops;
}

test('T-KB restoration: the chips, the shown panel CTA with the chosen tier, then the comparison', async ({
  page,
}) => {
  for (const tier of HOME_TIERS) {
    await openHome(page, tier);
    const stops = await restorationStops(page);
    expect(stops[0], `tier ${tier}`).toBe('chip home-tier');
    expect(stops[1], `tier ${tier}`).toMatch(new RegExp(`^${t('home.book')} \\?service=`));
    expect(stops[2], `tier ${tier}`).toBe(`${t('home.restoration.compare')} #سطح-ترمیم`);
    // Back to the chips; an arrow key chooses, and the next Tab is the chosen panel's CTA.
    await page.keyboard.press('Shift+Tab');
    await settled(page);
    await page.keyboard.press('Shift+Tab');
    await settled(page);
    await page.keyboard.press('ArrowDown');
    await settled(page);
    const chosen = await page.evaluate(
      () => document.querySelector<HTMLInputElement>('input[name="home-tier"]:checked')?.value,
    );
    expect(chosen, `tier ${tier}`).toBeTruthy();
    await page.keyboard.press('Tab');
    await settled(page);
    const cta = page.locator(':focus');
    await expect(cta).toHaveAttribute('href', new RegExp(`tier=${chosen}`));
    await expect(cta).toBeInViewport();
  }
});

/** The chrome's «رزرو نوبت»: the header pill from 1024 px, the sticky bar under it. */
const bookCta = (page: Page, testInfo: TestInfo) =>
  size(testInfo) === 'desktop'
    ? page.getByRole('banner').getByRole('link', { name: t('nav.book') })
    : page.locator('[data-sticky-bar]').getByRole('link', { name: t('nav.book') });

test('T-KB the booking dialog on a content page: opens on the phone field, Tab stays inside, Esc returns', async ({
  page,
}, testInfo) => {
  await page.goto(encodeURI('/حریم-خصوصی'));
  await formsHydrated(page);
  const cta = bookCta(page, testInfo);
  await cta.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('dialog[data-booking-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type="tel"]')).toBeFocused();
  await seenBefore(page);
  const labels = await tabWalk(page, { within: 'dialog[data-booking-dialog]' });
  expect(labels.length).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(cta).toBeFocused();
});

test('T-KB navigation: the drawer under 1024 px or the services menu, every item in view', async ({
  page,
}, testInfo) => {
  await page.goto(encodeURI('/درباره-ما'));
  await page.waitForLoadState('load');
  if (size(testInfo) === 'desktop') {
    const button = page.locator('[popovertarget="mega-menu"]');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#mega-menu')).toBeVisible();
    const labels = await tabWalk(page, { until: '#mega-menu' });
    expect(labels.length).toBeGreaterThan(3);
  } else {
    const button = page.getByRole('banner').getByRole('button', { name: t('nav.menuOpen') });
    await button.focus();
    await page.keyboard.press('Enter');
    const drawer = page.locator('dialog[open]');
    await expect(drawer).toBeVisible();
    await seenBefore(page);
    const labels = await tabWalk(page, { within: 'dialog[open]' });
    expect(labels.length).toBeGreaterThan(5);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test('T-KB the before and after slider: Home, End, arrows that move the divider their way, the value read', async ({
  page,
}) => {
  await openHome(page, 0);
  const slider = page.getByRole('slider', { name: 'مقایسهٔ قبل و بعد' });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('100');
  await expect(slider).toHaveAttribute('aria-valuetext', /۱۰۰/);
  await page.keyboard.press('ArrowDown');
  await expect(slider).toHaveValue('99');
  // Right to left: the divider moves the way the arrow points.
  const handle = slider.locator('xpath=following-sibling::span[1]');
  const x = async () => (await handle.boundingBox())!.x;
  const start = await x();
  await page.keyboard.press('ArrowRight');
  expect(await x()).toBeGreaterThan(start);
  const back = await x();
  await page.keyboard.press('ArrowLeft');
  expect(await x()).toBeLessThan(back);
});

test('T-KB the FAQ: Enter and Space open and close a question; its link follows in the Tab order', async ({
  page,
}) => {
  await openHome(page, 0);
  const urgent = page
    .locator('[data-home-section="faq"] details')
    .filter({ hasText: t('urgent.label') });
  await urgent.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(urgent).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(urgent.getByRole('link')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press(' ');
  await expect(urgent).not.toHaveAttribute('open', '');
});

// Colour is never the only cue (1.4.1): a chosen chip's edge doubles (an inset ring inside its
// border), so the row does not move; the current nav item carries a bar (NAV_ITEM), errors carry
// text (T-BK2).
test('T-A11Y a chosen chip differs by its edge, not only its colour', async ({ page }) => {
  await page.goto(encodeURI('/رزرو-نوبت'));
  await formsHydrated(page);
  const group = page.getByRole('group', { name: t('booking.serviceLegend') });
  const chip = group.getByRole('radio').first();
  const face = chip.locator('xpath=following-sibling::span[1]');
  const look = () =>
    face.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { ring: s.boxShadow.includes('inset'), width: r.width, height: r.height };
    });
  const before = await look();
  await chip.check();
  const after = await look();
  expect([before.ring, after.ring]).toEqual([false, true]);
  expect([after.width, after.height]).toEqual([before.width, before.height]);
});
