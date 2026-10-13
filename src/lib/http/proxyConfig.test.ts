import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  destination,
  getProxyConfig,
  recordRedirectHit,
  resetProxyConfigMemo,
} from '@/lib/http/proxyConfig';
import { testEnv } from '@/lib/http/testEnv';

const VIP_TO = '/خدمات/ترمیم-دندان#سطح-ترمیم';
const VIP_LOCATION =
  'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA/%D8%AA%D8%B1%D9%85%DB%8C%D9%85-%D8%AF%D9%86%D8%AF%D8%A7%D9%86#%D8%B3%D8%B7%D8%AD-%D8%AA%D8%B1%D9%85%DB%8C%D9%85';

const body = (redirects: unknown[] = [['/vip', VIP_TO, 301]], ga: string | null = null) =>
  new Response(
    JSON.stringify({
      v: 1,
      generatedAt: '2026-10-13T08:30:00.000Z',
      redirects,
      ga4MeasurementId: ga,
    }),
    {
      headers: { 'content-type': 'application/json' },
    },
  );

describe('destination (spec 6.3, X10-X12)', () => {
  const env = testEnv();

  it('X10 /vip to the Persian path with its fragment, percent-encoded', () => {
    expect(destination({ to: VIP_TO }, new URL('https://sefiddental.ir/vip'), env).href).toBe(
      VIP_LOCATION,
    );
  });

  it('X12 keeps only utm_* keys of the request', () => {
    const target = destination(
      { to: '/خدمات' },
      new URL('https://sefiddental.ir/vip?utm_source=a&p=2&gclid=x'),
      env,
    );
    expect(target.search).toBe('?utm_source=a');
    expect(target.origin).toBe('https://sefiddental.ir');
  });

  it('D1 a target off the site falls back to the home page (no open redirect)', () => {
    for (const to of ['//evil.example/x', '/\\evil.example/x', 'https://evil.example/x']) {
      expect(destination({ to }, new URL('https://sefiddental.ir/old'), env).href, to).toBe(
        'https://sefiddental.ir/',
      );
    }
  });

  it('D2 a 410 row (to null) resolves to the home page', () => {
    expect(destination({ to: null }, new URL('https://sefiddental.ir/old'), env).href).toBe(
      'https://sefiddental.ir/',
    );
  });
});

describe('getProxyConfig (spec 6.4, X15)', () => {
  let writes: string[];
  beforeEach(() => {
    resetProxyConfigMemo();
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('PC1 fetches the internal route with the token and builds the map', async () => {
    const fetchMock = vi.fn(async () =>
      body(
        [
          ['/vip', VIP_TO, 301],
          ['/gone', null, 410],
        ],
        'G-ABC123',
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ INTERNAL_ORIGIN: 'http://127.0.0.1:3000' });
    const view = await getProxyConfig(env, 0);
    expect(view.redirects.get('/vip')).toEqual({ from: '/vip', to: VIP_TO, status: 301 });
    expect(view.redirects.get('/gone')?.status).toBe(410);
    expect(view.ga4MeasurementId).toBe('G-ABC123');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://127.0.0.1:3000/api/internal/proxy-config');
    expect(new Headers(init.headers).get('x-internal-token')).toBe(env.internalApiToken);
    expect(init.cache).toBe('no-store');
  });

  it('PC2 memoized for the TTL, refetched after it', async () => {
    const fetchMock = vi.fn(async () => body());
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    await getProxyConfig(env, 0);
    await getProxyConfig(env, 29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getProxyConfig(env, 30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('PC3 single flight: concurrent callers share one fetch', async () => {
    let release: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv();
    const a = getProxyConfig(env, 0);
    const b = getProxyConfig(env, 1);
    release(body());
    const [va, vb] = await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(va).toBe(vb);
  });

  it('X15 a failed fetch never throws; one warn line per minute; stale value kept', async () => {
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '0' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body()),
    );
    const fresh = await getProxyConfig(env, 0);
    expect(fresh.redirects.size).toBe(1);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('connect ECONNREFUSED'))),
    );
    const stale = await getProxyConfig(env, 1000);
    expect(stale.redirects.get('/vip')?.to).toBe(VIP_TO);
    await getProxyConfig(env, 30_000);
    const warns = writes.filter((w) => w.includes('proxy_config_unavailable'));
    expect(warns).toHaveLength(1);
    expect(JSON.parse(warns[0] ?? '{}')).toMatchObject({
      level: 'warn',
      msg: 'proxy_config_unavailable',
    });
    await getProxyConfig(env, 61_000);
    expect(writes.filter((w) => w.includes('proxy_config_unavailable'))).toHaveLength(2);
  });

  it('PC4 cold failure answers an empty view; a bad body counts as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"v":2}')),
    );
    const view = await getProxyConfig(testEnv(), 0);
    expect(view.redirects.size).toBe(0);
    expect(view.ga4MeasurementId).toBeNull();
  });

  it('PC5 after a failure, requests within 5 s do not refetch', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    await getProxyConfig(env, 0);
    await getProxyConfig(env, 4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getProxyConfig(env, 5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('recordRedirectHit (spec 10.3, X16)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('RH1 one POST to the internal route with the token and the row key', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ INTERNAL_ORIGIN: 'http://127.0.0.1:3000' });
    await recordRedirectHit(env, '/vip');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://127.0.0.1:3000/api/internal/redirect-hit');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('x-internal-token')).toBe(env.internalApiToken);
    expect(JSON.parse(String(init.body))).toEqual({ from: '/vip' });
  });

  it('RH2 never throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('down'))),
    );
    await expect(recordRedirectHit(testEnv(), '/vip')).resolves.toBeUndefined();
  });
});
