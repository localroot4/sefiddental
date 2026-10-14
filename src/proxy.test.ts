import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest, type NextFetchEvent } from 'next/server';

const ev = { waitUntil: () => undefined } as unknown as NextFetchEvent;
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

describe('proxy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Page requests read the proxy config from the internal route: offline here, so the empty
    // view answers at once (getProxyConfig never throws).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline in unit tests');
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
    const page = await blocked.proxy(
      new NextRequest('http://localhost/admin/create-first-user'),
      ev,
    );
    expect(page.status).toBe(404);
    const api = await blocked.proxy(
      new NextRequest('http://localhost/api/users/first-register', { method: 'POST' }),
      ev,
    );
    expect(api.status).toBe(404);

    const allowed = await loadProxy({ ALLOW_FIRST_USER: 'true' });
    const open = await allowed.proxy(
      new NextRequest('http://localhost/admin/create-first-user'),
      ev,
    );
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
      const res = await proxy(new NextRequest(`http://localhost${path}`, { method }), ev);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const login = await proxy(new NextRequest('http://localhost/admin/login'), ev);
    expect(login.headers.get('x-middleware-next')).toBe('1');
    const malformed = await proxy(
      new NextRequest('http://localhost/api/users/first%E0register'),
      ev,
    );
    expect(malformed.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX3 admin requests carry x-pathname; client copies of proxy headers are dropped', async () => {
    const { proxy } = await loadProxy();
    const admin = await proxy(new NextRequest('http://localhost/admin/setup-totp'), ev);
    expect(admin.headers.get('x-middleware-request-x-pathname')).toBe('/admin/setup-totp');
    expect(admin.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

    const site = await proxy(
      new NextRequest('http://localhost/', {
        headers: { 'x-pathname': '/admin', 'x-nonce': 'forged', 'x-request-id': 'forged-id-123' },
      }),
      ev,
    );
    expect(site.headers.get('x-middleware-request-x-pathname')).toBeNull();
    expect(site.headers.get('x-middleware-request-x-nonce')).not.toBe('forged'); // fresh nonce (X18)
    expect(site.headers.get('x-request-id')).not.toBe('forged-id-123');
  });

  it('PX4 a trusted proxy may supply the request id', async () => {
    const { proxy } = await loadProxy({ TRUST_PROXY_HEADERS: 'true' });
    const res = await proxy(
      new NextRequest('http://localhost/', { headers: { 'x-request-id': 'edge-req-12345' } }),
      ev,
    );
    expect(res.headers.get('x-request-id')).toBe('edge-req-12345');
  });
  it('PX6 the auth limiter counts every routed spelling of the login path in one bucket', async () => {
    const { proxy } = await loadProxy();
    const spellings = [
      '/api/users/login',
      '/api/users/login/',
      '/api/users/LOGIN',
      '/api/users/log%69n',
    ];
    for (let i = 0; i < 10; i += 1) {
      const path = spellings[i % spellings.length];
      const res = await proxy(new NextRequest(`http://localhost${path}`, { method: 'POST' }), ev);
      expect(res.status, `request ${i + 1} ${path}`).toBe(200);
    }
    const limited = await proxy(
      new NextRequest('http://localhost/api/users/log%69n', { method: 'POST' }),
      ev,
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    const page = await proxy(new NextRequest('http://localhost/admin/login'), ev);
    expect(page.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX7 pages get a nonce CSP and the security headers; the nonce reaches the request', async () => {
    const { proxy } = await loadProxy();
    const res = await proxy(new NextRequest('http://localhost/'), ev);
    const csp = res.headers.get('content-security-policy') ?? '';
    const nonce = res.headers.get('x-middleware-request-x-nonce') ?? '';
    expect(nonce.length).toBeGreaterThan(10);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('PX8 maintenance answers 503 on pages and lets health and the admin through', async () => {
    const { proxy } = await loadProxy({ MAINTENANCE_MODE: 'on' });
    const page = await proxy(new NextRequest('http://localhost/'), ev);
    expect(page.status).toBe(503);
    expect(page.headers.get('retry-after')).toBe('900');
    const health = await proxy(new NextRequest('http://localhost/api/health'), ev);
    expect(health.headers.get('x-middleware-next')).toBe('1');
    const admin = await proxy(new NextRequest('http://localhost/admin'), ev);
    expect(admin.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX9 redirect rows from the proxy config answer before the canonical step', async () => {
    const { proxy } = await loadProxy({ SITE_URL: 'http://localhost' });
    const body = {
      v: 1,
      generatedAt: '2026-10-13T00:00:00.000Z',
      redirects: [
        ['/vip', '/خدمات', 301],
        ['/old-page', null, 410],
      ],
      ga4MeasurementId: null,
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/proxy-config') ? Response.json(body) : new Response(null),
    );
    vi.stubGlobal('fetch', fetchMock);
    const hit = await proxy(new NextRequest('http://localhost/VIP/?utm_source=x&a=1'), ev);
    expect(hit.status).toBe(301);
    expect(decodeURIComponent(hit.headers.get('location') ?? '')).toBe(
      'http://localhost/خدمات?utm_source=x',
    );
    const gone = await proxy(new NextRequest('http://localhost/old-page'), ev);
    expect(gone.status).toBe(410);
  });
  it('PX10 booking and emergency pages get the form cookie and the sid header once', async () => {
    const { proxy } = await loadProxy();
    const fresh = await proxy(
      new NextRequest(`http://localhost${encodeURI('/رزرو-نوبت')}`, {
        headers: { 'x-sefid-form-sid': 'forged' },
      }),
      ev,
    );
    const sid = fresh.headers.get('x-middleware-request-x-sefid-form-sid') ?? '';
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = fresh.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`__Host-sefid-form=${sid}`);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('secure');

    const known = 'k'.repeat(43);
    const again = await proxy(
      new NextRequest(`http://localhost${encodeURI('/اورژانس')}`, {
        headers: { cookie: `__Host-sefid-form=${known}` },
      }),
      ev,
    );
    expect(again.headers.get('x-middleware-request-x-sefid-form-sid')).toBe(known);
    expect(again.headers.get('set-cookie')).toBeNull();

    const home = await proxy(
      new NextRequest('http://localhost/', { headers: { 'x-sefid-form-sid': 'forged' } }),
      ev,
    );
    expect(home.headers.get('x-middleware-request-x-sefid-form-sid')).toBeNull();
    expect(home.headers.get('set-cookie')).toBeNull();
  });

  it('PX11 Persian dynamic routes render from the ASCII folder, which is closed directly', async () => {
    const { proxy } = await loadProxy({ SITE_URL: 'http://localhost' });
    const service = await proxy(
      new NextRequest(`http://localhost${encodeURI('/خدمات/ترمیم-دندان')}?utm_source=x`),
      ev,
    );
    const target = new URL(service.headers.get('x-middleware-rewrite') ?? 'http://x/');
    expect(decodeURIComponent(target.pathname)).toBe('/r/services/ترمیم-دندان');
    expect(target.search).toBe('?utm_source=x');
    expect(service.headers.get('x-middleware-request-x-nonce')).toBeTruthy();
    expect(service.headers.get('content-security-policy')).toContain("'strict-dynamic'");

    const direct = await proxy(new NextRequest('http://localhost/r/services/x'), ev);
    expect(new URL(direct.headers.get('x-middleware-rewrite') ?? 'http://x/').pathname).toBe('/r');

    const hub = await proxy(new NextRequest(`http://localhost${encodeURI('/خدمات')}`), ev);
    expect(hub.headers.get('x-middleware-rewrite')).toBeNull();
    expect(hub.headers.get('x-middleware-next')).toBe('1');
  });

  it('PX12 QA routes answer the 404 document unless QA_ROUTES=1', async () => {
    const off = await (
      await loadProxy({ SITE_URL: 'http://localhost' })
    ).proxy(new NextRequest('http://localhost/qa/not-found'), ev);
    expect(new URL(off.headers.get('x-middleware-rewrite') ?? 'http://x/').pathname).toBe('/r');

    const on = await (
      await loadProxy({ SITE_URL: 'http://localhost', QA_ROUTES: '1' })
    ).proxy(new NextRequest('http://localhost/qa/not-found'), ev);
    expect(on.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
