import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NOT_FOUND, routeOfHtml, verdicts } from './check-no-prerender.mjs';

const withCatchAll = ['/(site)/page', '/(site)/[...notFound]/page', '/_not-found/page'];
const withoutCatchAll = ['/(site)/page', '/_not-found/page'];

describe('check-no-prerender', () => {
  it('T-NP1 maps HTML files to routes', () => {
    expect(routeOfHtml('index.html')).toBe('/');
    expect(routeOfHtml('_not-found.html')).toBe('/_not-found');
    expect(routeOfHtml(path.join('qa', 'not-found.html'))).toBe('/qa/not-found');
    expect(routeOfHtml(path.join('blog', 'index.html'))).toBe('/blog');
  });

  it('T-NP2 a prerendered public page fails', () => {
    const [home] = verdicts({ htmlRoutes: ['/'], appPaths: withCatchAll });
    expect(home).toMatchObject({ route: '/', ok: false });
  });

  it('T-NP3 /_not-found fails without the (site) catch-all (A6)', () => {
    const [result] = verdicts({ htmlRoutes: [NOT_FOUND], appPaths: withoutCatchAll });
    expect(result).toMatchObject({ route: NOT_FOUND, ok: false });
  });

  it('T-NP4 /_not-found is allowed, with a reason, once the catch-all exists', () => {
    const [result] = verdicts({ htmlRoutes: [NOT_FOUND], appPaths: withCatchAll });
    expect(result?.ok).toBe(true);
    expect(result?.reason).toMatch(/catch-all/);
  });

  it('T-NP5 Next global-error document is allowed with a reason; duplicates collapse', () => {
    const results = verdicts({
      htmlRoutes: ['/_global-error', '/_global-error'],
      appPaths: withCatchAll,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
  });
});
