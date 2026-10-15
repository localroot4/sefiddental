// Screenshots of the system pages, home and the content templates in every viewport and theme
// project (00-master.md section 5: 390x844, 820x1180, 1440x900, light and dark). With
// QA_SCREENSHOTS=phase-NN the files go to docs/qa/phase-NN/<template>-<width>-<theme>.png for
// the phase report; otherwise they are attached to the test report only. The admin login and
// dashboard screenshots are in admin.spec.ts (they need the shared admin session).
import { test } from '@playwright/test';

import { captureTemplate } from '../helpers/screens';
import { MAINTENANCE_ORIGIN } from '../helpers/servers';
import { projectTheme } from '../helpers/theme';

const TEMPLATES = [
  { name: '404', url: '/qa-screenshot-missing-page' },
  { name: '404-template', url: '/qa/not-found' },
  { name: '500', url: '/qa/error' },
  { name: '410', url: '/qa/gone' },
  // The proxy's 503 answer from the server that runs with MAINTENANCE_MODE=on.
  { name: '503', url: `${MAINTENANCE_ORIGIN}/` },
  { name: 'home', url: '/' },
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
] as const;

for (const template of TEMPLATES) {
  test(`T-SS ${template.name} screenshot`, async ({ page }, testInfo) => {
    await page.goto(template.url);
    await captureTemplate(page, testInfo, template.name, projectTheme(testInfo));
  });
}
