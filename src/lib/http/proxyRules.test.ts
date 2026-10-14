import { describe, expect, it } from 'vitest';

import { buildPath, normalizePath, PAGE_PATHS, type PathCollection } from '@/lib/paths';
import {
  isAuthLimitedPath,
  isClosedPayloadPath,
  isFirstUserPath,
  maintenanceBypass,
  needsFormSession,
  routeRewrite,
} from '@/lib/http/proxyRules';

describe('isFirstUserPath (decision 41, freeze A1)', () => {
  it.each([
    '/api/users/first-register',
    '/api/users/first-register/',
    '/api/users/first%2Dregister',
    '/api/users/first%2dregister',
    '/api/users/FIRST-REGISTER',
    '/api/users//first-register//',
    '/admin/create-first-user',
    '/admin/create-first-user/',
    '/admin/create%2Dfirst-user',
    '/Admin/Create-First-User',
  ])('F1 %s is blocked after normalizePath', (raw) => {
    expect(isFirstUserPath(normalizePath(raw))).toBe(true);
  });

  it.each(['/admin/login', '/api/users/first%E0register', '/api/users', '/admin'])(
    'F2 %s is not a first-user path',
    (raw) => {
      expect(isFirstUserPath(normalizePath(raw))).toBe(false);
    },
  );
});

describe('isAuthLimitedPath (decision 41, freeze A1)', () => {
  it.each([
    '/api/users/login',
    '/api/users/login/',
    '/api/users/LOGIN',
    '/api/users/log%69n',
    '/api/users/forgot-password',
    '/api/setup-totp',
    '/api/verify-totp',
  ])('A1 POST %s is limited', (raw) => {
    expect(isAuthLimitedPath('POST', normalizePath(raw))).toBe(true);
  });

  it('A2 other methods and paths are not limited', () => {
    expect(isAuthLimitedPath('GET', '/api/users/login')).toBe(false);
    expect(isAuthLimitedPath('POST', '/api/users/me')).toBe(false);
    expect(isAuthLimitedPath('post', '/api/users/login')).toBe(true);
  });
});

describe('maintenanceBypass (spec X17)', () => {
  it('M1 health, admin pages, signed-in API calls and sign-in pass', () => {
    expect(maintenanceBypass('api', '/api/health', false)).toBe(true);
    expect(maintenanceBypass('admin', '/admin', false)).toBe(true);
    expect(maintenanceBypass('api', '/api/users/me', true)).toBe(true);
    expect(maintenanceBypass('api', '/api/users/login', false)).toBe(true);
    expect(maintenanceBypass('api', '/api/verify-totp', false)).toBe(true);
    expect(maintenanceBypass('internal', '/api/internal/proxy-config', false)).toBe(true);
  });

  it('M2 pages, feeds and anonymous API calls get the 503', () => {
    expect(maintenanceBypass('page', '/', false)).toBe(false);
    expect(maintenanceBypass('page', '/', true)).toBe(false);
    expect(maintenanceBypass('feed', '/sitemap.xml', false)).toBe(false);
    expect(maintenanceBypass('api', '/api/users/me', false)).toBe(false);
    expect(maintenanceBypass('api', '/api/events', false)).toBe(false);
  });

  it('M3 a session cookie never opens the site routes or the scheduler (SF-2)', () => {
    for (const path of [
      '/api/events',
      '/api/form-session',
      '/api/csp-report',
      '/api/booking',
      '/api/emergency',
      '/api/cron/tick',
    ]) {
      expect(maintenanceBypass('api', path, true), path).toBe(false);
    }
    expect(maintenanceBypass('api', '/api/users/login', true)).toBe(true);
  });
});

describe('isClosedPayloadPath (SEC-S4)', () => {
  it.each([
    '/api/users/verify',
    '/api/users/verify/abc',
    '/API/Users/Verify/x%61',
    '/api/users/verify/',
  ])('V1 %s is closed after normalizePath', (raw) => {
    expect(isClosedPayloadPath(normalizePath(raw))).toBe(true);
  });

  it.each(['/api/verify-totp', '/api/users/verifyx', '/api/users/me'])(
    'V2 %s stays open',
    (raw) => {
      expect(isClosedPayloadPath(normalizePath(raw))).toBe(false);
    },
  );
});

describe('needsFormSession', () => {
  it('S1 GET and HEAD of the booking and emergency pages', () => {
    expect(
      needsFormSession('GET', normalizePath('/%D8%B1%D8%B2%D8%B1%D9%88-%D9%86%D9%88%D8%A8%D8%AA')),
    ).toBe(true);
    expect(needsFormSession('HEAD', '/اورژانس')).toBe(true);
    expect(needsFormSession('POST', '/اورژانس')).toBe(false);
    expect(needsFormSession('GET', '/')).toBe(false);
  });
});

describe('routeRewrite (Persian dynamic routes)', () => {
  it('R1 a Persian service path renders from the ASCII folder, in any spelling', () => {
    const encoded =
      '/r/services/%D9%84%D9%85%DB%8C%D9%86%D8%AA-%D8%B3%D8%B1%D8%A7%D9%85%DB%8C%DA%A9%DB%8C';
    expect(routeRewrite(normalizePath('/خدمات/لمینت-سرامیکی'))).toBe(encoded);
    expect(routeRewrite(normalizePath(encodeURI('/خدمات/لمینت-سرامیکی')))).toBe(encoded);
    // NFD spelling and Arabic yeh/kaf normalize to the same slug.
    expect(routeRewrite(normalizePath('/خدمات/لمینت-سرامیكي'.normalize('NFD')))).toBe(encoded);
    expect(routeRewrite('/خدمات/a?b')).toBe('/r/services/a%3Fb');
  });

  it('R2 hubs, deeper paths and other pages render as they are', () => {
    expect(routeRewrite('/خدمات')).toBeNull();
    expect(routeRewrite('/خدمات/a/b')).toBeNull();
    expect(routeRewrite('/')).toBeNull();
    expect(routeRewrite('/rss')).toBeNull();
    expect(routeRewrite('/r')).toBeNull();
  });

  it('R3 a direct request into the ASCII folders gets the 404 document', () => {
    expect(routeRewrite('/r/services/x')).toBe('/r');
    expect(routeRewrite(normalizePath('/R/Services/x'))).toBe('/r');
    for (const folder of ['doctors', 'articles', 'article-categories', 'tags', 'guides']) {
      expect(routeRewrite(`/r/${folder}/x`), folder).toBe('/r');
    }
    expect(routeRewrite(normalizePath('/%72/services/x'))).toBe('/r');
  });

  it('R4 every phase 4 dynamic route has a row, at the path src/lib/paths.ts builds', () => {
    const rows: Array<[PathCollection, string]> = [
      ['services', '/r/services/'],
      ['service-categories', '/r/services/'],
      ['doctors', '/r/doctors/'],
      ['articles', '/r/articles/'],
      ['article-categories', '/r/article-categories/'],
      ['tags', '/r/tags/'],
    ];
    for (const [collection, folder] of rows) {
      const path = buildPath(collection, { slug: 'نمونه-اسلاگ' }) ?? '';
      expect(routeRewrite(normalizePath(path)), collection).toBe(
        folder + encodeURIComponent('نمونه-اسلاگ'),
      );
    }
    const guide = buildPath('pages', { key: 'guide-first-visit', slug: 'اولین-مراجعه' }) ?? '';
    expect(routeRewrite(guide)).toBe(`/r/guides/${encodeURIComponent('اولین-مراجعه')}`);
    // Hubs and static pages render from their own Persian folders.
    for (const path of Object.values(PAGE_PATHS)) {
      if (!path.startsWith('/راهنمای-بیمار/')) expect(routeRewrite(path), path).toBeNull();
    }
    expect(routeRewrite('/مقالات/دسته/a/b')).toBeNull();
  });

  it('R5 QA routes answer the 404 document unless QA_ROUTES is on', () => {
    for (const path of ['/qa/not-found', '/qa/error', '/qa/gone']) {
      expect(routeRewrite(path), path).toBe('/r');
      expect(routeRewrite(path, true), path).toBeNull();
    }
    expect(routeRewrite('/qa')).toBeNull();
  });
});
