import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// next@16.4.0 ships the matcher helper as unstable_doesMiddlewareMatch; the docs at the tag
// name it unstable_doesProxyMatch, which the package does not export.

const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./.data/test.db',
  PAYLOAD_SECRET: 'p'.repeat(43),
};

async function loadProxy(extra: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...extra })) vi.stubEnv(key, value);
  return import('./proxy');
}

describe('proxy skeleton', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('PX1 matcher skips build assets, public static files and media files', async () => {
    const { config } = await loadProxy();
    const runs = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    expect(runs('/')).toBe(true);
    expect(runs('/admin/login')).toBe(true);
    expect(runs('/api/users/login')).toBe(true);
    expect(runs('/api/media/file/photo.webp')).toBe(false);
    expect(runs('/_next/static/chunks/app.js')).toBe(false);
    expect(runs('/brand/favicon.svg')).toBe(false);
    expect(runs('/fonts/Vazirmatn-wght.woff2')).toBe(false);
    expect(runs('/detect-gpu/benchmarks/d-intel.json')).toBe(false);
  });

  it('PX2 first-user routes return 404 unless ALLOW_FIRST_USER=true', async () => {
    const blocked = await loadProxy({ ALLOW_FIRST_USER: 'false' });
    const page = blocked.proxy(new NextRequest('http://localhost/admin/create-first-user'));
    expect(page.status).toBe(404);
    const api = blocked.proxy(
      new NextRequest('http://localhost/api/users/first-register', { method: 'POST' }),
    );
    expect(api.status).toBe(404);

    const allowed = await loadProxy({ ALLOW_FIRST_USER: 'true' });
    const open = allowed.proxy(new NextRequest('http://localhost/admin/create-first-user'));
    expect(open.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX5 first-user block matches the routed form of the path, for every method', async () => {
    const { proxy } = await loadProxy({ ALLOW_FIRST_USER: 'false' });
    for (const [method, path] of [
      ['POST', '/api/users/first-register/'],
      ['POST', '/api/users/first%2Dregister'],
      ['POST', '/api/users/first%2dregister'],
      ['POST', '/api/users/FIRST-REGISTER'],
      ['POST', '/api/users//first-register//'],
      ['GET', '/api/users/first-register'],
      ['GET', '/admin/create-first-user/'],
      ['GET', '/admin/create%2Dfirst-user'],
      ['GET', '/Admin/Create-First-User'],
    ] as const) {
      const res = proxy(new NextRequest(`http://localhost${path}`, { method }));
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const login = proxy(new NextRequest('http://localhost/admin/login'));
    expect(login.headers.get('x-middleware-next')).toBe('1');
    const malformed = proxy(new NextRequest('http://localhost/api/users/first%E0register'));
    expect(malformed.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX3 admin requests carry x-pathname; client copies of proxy headers are dropped', async () => {
    const { proxy } = await loadProxy();
    const admin = proxy(new NextRequest('http://localhost/admin/setup-totp'));
    expect(admin.headers.get('x-middleware-request-x-pathname')).toBe('/admin/setup-totp');
    expect(admin.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

    const site = proxy(
      new NextRequest('http://localhost/', {
        headers: { 'x-pathname': '/admin', 'x-nonce': 'forged', 'x-request-id': 'forged-id-123' },
      }),
    );
    expect(site.headers.get('x-middleware-request-x-pathname')).toBeNull();
    expect(site.headers.get('x-middleware-request-x-nonce')).toBeNull();
    expect(site.headers.get('x-request-id')).not.toBe('forged-id-123');
  });

  it('PX4 a trusted proxy may supply the request id', async () => {
    const { proxy } = await loadProxy({ TRUST_PROXY_HEADERS: 'true' });
    const res = proxy(
      new NextRequest('http://localhost/', { headers: { 'x-request-id': 'edge-req-12345' } }),
    );
    expect(res.headers.get('x-request-id')).toBe('edge-req-12345');
  });
});
