// WCAG 2.2 AA scan with axe-core (docs/brief.md: target WCAG 2.2 AA). Every public template runs
// it in all six viewport and theme projects, because contrast differs per theme.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';

export const WCAG22AA: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface A11yOptions {
  /** Limit the scan to one CSS selector. */
  include?: string;
  /** Extra selectors to skip (one selector per entry). */
  exclude?: readonly string[];
  /** Rule ids to skip. Each needs a written reason in the test and in the phase report. */
  disableRules?: readonly string[];
}

export async function expectNoA11yViolations(page: Page, options: A11yOptions = {}): Promise<void> {
  // The developer overlay is a debugging aid behind ?debug=1, never part of a public page.
  let builder = new AxeBuilder({ page }).withTags([...WCAG22AA]).exclude('[data-dev-overlay]');
  if (options.include) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (options.disableRules?.length) builder = builder.disableRules([...options.disableRules]);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe WCAG 2.2 AA violations on ${page.url()}`).toEqual([]);
}

/**
 * axe runs in the page, so a page with JavaScript off cannot run it (its promise never settles).
 * This scans that page's server HTML instead, scripts removed, in a fresh page with JavaScript at
 * the same origin, so the styles and the contrast are the page's own.
 */
export async function expectNoA11yViolationsWithoutJs(
  page: Page,
  browser: Browser,
  options: A11yOptions = {},
): Promise<void> {
  const html = (await page.content()).replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const scan = await context.newPage();
    await scan.goto(new URL('/robots.txt', page.url()).href);
    await scan.setContent(html, { waitUntil: 'load' });
    await expectNoA11yViolations(scan, options);
  } finally {
    await context.close();
  }
}
