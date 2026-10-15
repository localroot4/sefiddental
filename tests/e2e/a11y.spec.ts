// axe-core WCAG 2.2 AA on every public template in all six viewport and theme projects
// (contrast differs per theme). The bar is zero violations of any impact, stricter than the
// phase's "zero serious or critical"; a disabled rule needs a reason here and in the report.
import { expect, test } from '@playwright/test';

import { expectNoA11yViolations } from '../helpers/axe';
import { requireRoutes, type PendingRoute } from '../helpers/pending';
import { MAINTENANCE_ORIGIN } from '../helpers/servers';

const TEMPLATES: ReadonlyArray<{
  name: string;
  url: string;
  status: number;
  needs?: PendingRoute;
}> = [
  { name: 'home', url: '/', status: 200 },
  { name: '404-unmatched', url: '/no-such-page', status: 404 },
  { name: '404 template (200)', url: '/qa/not-found', status: 200 },
  { name: '500', url: '/qa/error', status: 500 },
  { name: '410', url: '/qa/gone', status: 410 },
  { name: '503 (maintenance server)', url: `${MAINTENANCE_ORIGIN}/`, status: 503 },
  { name: 'maintenance.html (host fallback)', url: '/maintenance.html', status: 200 },
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
];

for (const template of TEMPLATES) {
  test(`T-A11Y ${template.name}`, async ({ page }) => {
    if (template.needs) requireRoutes(template.needs);
    // The status proves the scan ran on the template itself, not on an error page.
    const response = await page.goto(template.url);
    expect(response?.status()).toBe(template.status);
    await page.waitForLoadState('load');
    // A page that throws gets Next's bare error shell (no lang) from the server, and the branded
    // error view only after hydration; scan what the visitor gets, not the race before it.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expectNoA11yViolations(page);
  });
}

// The chosen state of the restoration tiers (freeze G13): one card warm, its CTA swapped in.
test('T-A11Y restoration with a tier chosen', async ({ page }) => {
  await page.goto(encodeURI('/خدمات/ترمیم-دندان'));
  await page.waitForLoadState('load');
  await page.locator('[id="سطح-ترمیم"]').getByRole('radio', { name: 'VIP' }).check();
  await expectNoA11yViolations(page);
});
