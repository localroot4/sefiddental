import { describe, expect, it } from 'vitest';

import { normalizePath } from '@/lib/http/pathsStub';
import {
  isAuthLimitedPath,
  isFirstUserPath,
  maintenanceBypass,
  needsFormSession,
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
