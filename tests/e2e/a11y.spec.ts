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
  { name: '404', url: '/a11y-missing-page', status: 404 },
  { name: '404 template (200)', url: '/qa/not-found', status: 200 },
  { name: '500', url: '/qa/error', status: 500 },
  { name: '410', url: '/qa/gone', status: 410 },
  { name: '503 (maintenance server)', url: `${MAINTENANCE_ORIGIN}/`, status: 503 },
  { name: 'maintenance.html (host fallback)', url: '/maintenance.html', status: 200 },
  {
    name: 'service route probe',
    url: encodeURI('/خدمات/ترمیم-دندان'),
    status: 200,
    needs: 'serviceProbe',
  },
];

for (const template of TEMPLATES) {
  test(`T-A11Y ${template.name}`, async ({ page }) => {
    if (template.needs) requireRoutes(template.needs);
    // The status proves the scan ran on the template itself, not on an error page.
    const response = await page.goto(template.url);
    expect(response?.status()).toBe(template.status);
    await page.waitForLoadState('load');
    await expectNoA11yViolations(page);
  });
}
