// Unknown slugs under the Persian dynamic routes (decision F10): the proxy rewrites a slug outside
// the published set to the 404 document, so the server HTML is the full branded page (lang, dir,
// H1), never Next's `__next_error__` shell. Request-level checks on the server HTML, once per run.
// e2e runs with PROXY_CONFIG_TTL_MS=0, so every request reads a fresh slug set; the memo window,
// the refresh floor and the failed-fetch fall-through are unit-tested (src/lib/http/proxyConfig).
import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { t } from '@/i18n/fa';

const PERSIAN_DOCUMENT = /<html[^>]*\slang="fa"[^>]*\sdir="rtl"/;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'request-level rows run in desktop-light');
});

test('T-NF1 an unknown slug under each Persian dynamic route answers the branded 404 server HTML', async ({
  request,
}) => {
  // Each row has at least one published slug on the e2e database (services from the seeder; the
  // dentist, the guide and the articles from tests/fixtures/qa-seed.ts), so the proxy knows the set.
  // T-NF3 (phase 6): the post, category and tag rows too.
  for (const prefix of [
    '/خدمات/',
    '/پزشکان/',
    '/راهنمای-بیمار/',
    '/مقالات/',
    '/مقالات/دسته/',
    '/مقالات/برچسب/',
  ]) {
    const response = await request.get(encodeURI(`${prefix}no-such-slug-${Date.now()}`));
    expect(response.status(), prefix).toBe(404);
    const html = await response.text();
    expect(html, prefix).toMatch(PERSIAN_DOCUMENT);
    expect(html, prefix).toContain(t('notFound.heading'));
    expect(html, prefix).not.toContain('__next_error__');
  }
});

// The fixture dentist, guide, post, category and tag come from tests/fixtures/qa-seed.ts.
const KNOWN: Array<[path: string, page: string]> = [
  ['/خدمات/ترمیم-دندان', 'src/app/(site)/r/services/[slug]/page.tsx'],
  ['/پزشکان/دکتر-نمونه-آزمایشی', 'src/app/(site)/r/doctors/[slug]/page.tsx'],
  ['/راهنمای-بیمار/اولین-مراجعه', 'src/app/(site)/r/guides/[slug]/page.tsx'],
  ['/مقالات/نمونه-آزمایشی-مقاله-کامل', 'src/app/(site)/r/articles/[slug]/page.tsx'],
  ['/مقالات/دسته/نمونه-آزمایشی-دسته-الف', 'src/app/(site)/r/article-categories/[slug]/page.tsx'],
  ['/مقالات/برچسب/نمونه-آزمایشی-برچسب', 'src/app/(site)/r/tags/[slug]/page.tsx'],
];

for (const [url, page] of KNOWN) {
  test(`T-NF2 a published slug still reaches its template: ${url}`, async ({ request }) => {
    // A template another lane has not built yet answers 404 by itself.
    test.skip(
      !existsSync(path.resolve(process.cwd(), page)),
      `PENDING: ${page} does not exist yet.`,
    );
    const response = await request.get(encodeURI(url));
    expect(response.status(), url).toBe(200);
    expect(await response.text(), url).toMatch(PERSIAN_DOCUMENT);
  });
}
