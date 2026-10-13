// WCAG 2.2 AA scan with axe-core (docs/brief.md: target WCAG 2.2 AA). Every public template runs
// it in all six viewport and theme projects, because contrast differs per theme.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

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
