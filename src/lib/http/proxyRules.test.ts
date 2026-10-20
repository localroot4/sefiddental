import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPath,
  isGuideKey,
  normalizePath,
  PAGE_KEYS,
  PAGE_PATHS,
  type PageKey,
  type PathCollection,
} from '@/lib/paths';
import {
  isAuthLimitedPath,
  isClosedPayloadPath,
  isFirstUserPath,
  dynamicRoute,
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

describe('routeRewrite (Persian routes)', () => {
  it('R1 a Persian service path renders from the ASCII folder, in any spelling', () => {
    const encoded =
      '/r/services/%D9%84%D9%85%DB%8C%D9%86%D8%AA-%D8%B3%D8%B1%D8%A7%D9%85%DB%8C%DA%A9%DB%8C';
    expect(routeRewrite(normalizePath('/خدمات/لمینت-سرامیکی'))).toBe(encoded);
    expect(routeRewrite(normalizePath(encodeURI('/خدمات/لمینت-سرامیکی')))).toBe(encoded);
    // NFD spelling and Arabic yeh/kaf normalize to the same slug.
    expect(routeRewrite(normalizePath('/خدمات/لمینت-سرامیكي'.normalize('NFD')))).toBe(encoded);
    expect(routeRewrite('/خدمات/a?b')).toBe('/r/services/a%3Fb');
  });

  it('R2 deeper paths and ASCII pages render as they are', () => {
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
    // The static pages' folders too, hubs included.
    for (const folder of ['services', 'about', 'address', 'booking/success']) {
      expect(routeRewrite(`/r/${folder}`), folder).toBe('/r');
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
    expect(routeRewrite('/مقالات/دسته/a/b')).toBeNull();
  });

  it('R5 QA routes answer the 404 document unless QA_ROUTES is on', () => {
    for (const path of ['/qa/not-found', '/qa/error', '/qa/gone']) {
      expect(routeRewrite(path), path).toBe('/r');
      expect(routeRewrite(path, true), path).toBeNull();
    }
    expect(routeRewrite('/qa')).toBeNull();
  });

  it('R6 dynamicRoute names the row and the slug of exactly one segment after a prefix', () => {
    expect(dynamicRoute('/خدمات/لمینت-سرامیکی')).toEqual({
      key: 'services',
      slug: 'لمینت-سرامیکی',
    });
    expect(dynamicRoute('/مقالات/دسته/ایمپلنت')).toEqual({
      key: 'article-categories',
      slug: 'ایمپلنت',
    });
    expect(dynamicRoute('/مقالات/برچسب/درد')).toEqual({ key: 'tags', slug: 'درد' });
    expect(dynamicRoute('/مقالات/دسته')).toEqual({ key: 'articles', slug: 'دسته' });
    expect(dynamicRoute('/راهنمای-بیمار/اولین-مراجعه')?.key).toBe('guides');
    for (const path of ['/خدمات', '/خدمات/', '/خدمات/a/b', '/r/services/x', '/']) {
      expect(dynamicRoute(path), path).toBeNull();
    }
  });

  it('R7 an unknown slug answers the 404 document; the flag changes no other path', () => {
    expect(routeRewrite('/پزشکان/دکتر-ناشناس', false, true)).toBe('/r');
    expect(routeRewrite('/پزشکان/دکتر-ناشناس', false, false)).toBe(
      `/r/doctors/${encodeURIComponent('دکتر-ناشناس')}`,
    );
    expect(routeRewrite('/خدمات', false, true)).toBe('/r/services');
    expect(routeRewrite('/qa/not-found', true, true)).toBeNull();
  });

  it('R8 every PAGE_PATHS key renders from an ASCII folder: static pages by exact path', () => {
    for (const key of PAGE_KEYS) {
      const page = PAGE_PATHS[key];
      const rewrite = routeRewrite(normalizePath(encodeURI(page)));
      if (key === 'home') expect(rewrite, key).toBeNull();
      else if (isGuideKey(key)) expect(rewrite, key).toMatch(/^\/r\/guides\/%/);
      else expect(rewrite, key).toMatch(/^\/r\/[a-z]+(\/[a-z]+)?$/);
    }
    expect(routeRewrite(PAGE_PATHS['services-hub'])).toBe('/r/services');
    expect(routeRewrite(PAGE_PATHS['dentists-hub'])).toBe('/r/doctors');
    expect(routeRewrite(PAGE_PATHS['guide-hub'])).toBe('/r/guides');
    expect(routeRewrite(PAGE_PATHS.about)).toBe('/r/about');
    expect(routeRewrite(PAGE_PATHS.address)).toBe('/r/address');
    // Exact paths only: a deeper path is not the page.
    expect(routeRewrite(`${PAGE_PATHS.about}/x`)).toBeNull();
  });

  it('R9 route tree: no folder under (site) has a Persian name; phase 4 and 6 pages are in r/', () => {
    const site = join(process.cwd(), 'src', 'app', '(site)');
    const folders = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => [entry.name, ...folders(join(dir, entry.name))]);
    expect(folders(site).filter((name) => /[^\x20-\x7e]/.test(name))).toEqual([]);
    const hubs: PageKey[] = [
      'services-hub',
      'dentists-hub',
      'guide-hub',
      'about',
      'address',
      'articles',
    ];
    for (const key of hubs) {
      const file = join(site, `${routeRewrite(PAGE_PATHS[key])}/page.tsx`);
      expect(existsSync(file), key).toBe(true);
    }
    // Phase 6: every dynamic row of the articles has its `[slug]` folder.
    for (const folder of ['articles', 'article-categories', 'tags']) {
      expect(existsSync(join(site, 'r', folder, '[slug]', 'page.tsx')), folder).toBe(true);
    }
  });
});
