import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  destination,
  getProxyConfig,
  isUnknownSlug,
  recordRedirectHit,
  resetProxyConfigMemo,
} from '@/lib/http/proxyConfig';
import { testEnv } from '@/lib/http/testEnv';

const VIP_TO = '/خدمات/ترمیم-دندان#سطح-ترمیم';
const VIP_LOCATION =
  'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA/%D8%AA%D8%B1%D9%85%DB%8C%D9%85-%D8%AF%D9%86%D8%AF%D8%A7%D9%86#%D8%B3%D8%B7%D8%AD-%D8%AA%D8%B1%D9%85%DB%8C%D9%85';

const body = (
  redirects: unknown[] = [['/vip', VIP_TO, 301]],
  ga: string | null = null,
  slugs?: Record<string, string[]>,
) =>
  new Response(
    JSON.stringify({
      v: 1,
      generatedAt: '2026-10-13T08:30:00.000Z',
      redirects,
      ga4MeasurementId: ga,
      ...(slugs ? { slugs } : {}),
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

describe('published slugs and the unknown-slug check (decision F10)', () => {
  const SLUGS = { services: ['ترمیم-دندان', 'زیبایی'], doctors: [], guides: ['اولین-مراجعه'] };
  const service = (slug: string) => ({ key: 'services' as const, slug });

  beforeEach(() => {
    resetProxyConfigMemo();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('PC6 slug sets per row with the fetch time; a body without slugs leaves them unknown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body(undefined, null, SLUGS)),
    );
    const view = await getProxyConfig(testEnv(), 7);
    expect(view.slugs?.get('services')).toEqual(new Set(['ترمیم-دندان', 'زیبایی']));
    expect(view.slugs?.get('doctors')?.size).toBe(0);
    expect(view.fetchedAt).toBe(7);

    resetProxyConfigMemo();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body()),
    );
    expect((await getProxyConfig(testEnv(), 0)).slugs).toBeNull();
  });

  it('PC7 a failed refetch keeps the stale redirects but forgets the slugs until a fetch succeeds', async () => {
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body(undefined, null, SLUGS)),
    );
    await getProxyConfig(env, 0);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('connect ECONNREFUSED'))),
    );
    const stale = await getProxyConfig(env, 30_000);
    expect(stale.redirects.get('/vip')?.to).toBe(VIP_TO);
    expect(stale.slugs).toBeNull();
    expect((await getProxyConfig(env, 31_000)).slugs).toBeNull(); // memo of the failure, 5 s
    expect(await isUnknownSlug(env, stale, service('نیست'), 31_000)).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body(undefined, null, SLUGS)),
    );
    expect((await getProxyConfig(env, 35_000)).slugs?.get('guides')).toEqual(
      new Set(['اولین-مراجعه']),
    );
  });

  it('PC8 a view fetched for this request refuses an unknown slug, also from an empty set; unknown or missing sets never do', async () => {
    const fetchMock = vi.fn(async () => body(undefined, null, SLUGS));
    vi.stubGlobal('fetch', fetchMock);
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    const view = await getProxyConfig(env, 1_000);
    expect(await isUnknownSlug(env, view, service('نیست'), 1_000)).toBe(true);
    expect(await isUnknownSlug(env, view, service('ترمیم-دندان'), 1_000)).toBe(false);
    // No published dentist yet: the empty set is the answer, not an unknown one.
    expect(await isUnknownSlug(env, view, { key: 'doctors', slug: 'دکتر-الف' }, 1_000)).toBe(true);
    expect(await isUnknownSlug(env, view, { key: 'tags', slug: 'الف' }, 1_000)).toBe(false);
    expect(await isUnknownSlug(env, { ...view, slugs: null }, service('نیست'), 1_000)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('PC9 an older view is confirmed by a fetch of its own: a slug published since then passes', async () => {
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => body(undefined, null, SLUGS)),
    );
    const old = await getProxyConfig(env, 0);
    const published = vi.fn(async () =>
      body(undefined, null, {
        ...SLUGS,
        services: [...SLUGS.services, 'تازه'],
        doctors: ['دکتر-تازه'],
      }),
    );
    vi.stubGlobal('fetch', published);
    expect(await isUnknownSlug(env, old, service('تازه'), 10_000)).toBe(false);
    expect(published).toHaveBeenCalledTimes(1);
    // The first dentist published into an empty set passes too.
    const doctor = { key: 'doctors' as const, slug: 'دکتر-تازه' };
    expect(await isUnknownSlug(env, old, doctor, 10_000)).toBe(false);
    // The confirmation refreshed the memo for every later request.
    expect((await getProxyConfig(env, 10_001)).slugs?.get('services')?.has('تازه')).toBe(true);
    expect(await isUnknownSlug(env, old, service('نیست'), 12_000)).toBe(true);
    expect(published).toHaveBeenCalledTimes(2);
  });

  it('PC10 inside the 2 s refresh floor the latest fetch decides without another; a failed one falls through', async () => {
    const env = testEnv({ PROXY_CONFIG_TTL_MS: '30000' });
    const fetchMock = vi.fn(async () => body(undefined, null, SLUGS));
    vi.stubGlobal('fetch', fetchMock);
    const view = await getProxyConfig(env, 0);
    expect(await isUnknownSlug(env, view, service('نیست'), 1_999)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const published = vi.fn(async () =>
      body(undefined, null, { ...SLUGS, services: [...SLUGS.services, 'تازه'] }),
    );
    vi.stubGlobal('fetch', published);
    expect(await isUnknownSlug(env, view, service('نیست'), 2_000)).toBe(true);
    // The request's own view is stale; the fetch that started last (at 2 s) has the new slug.
    expect(await isUnknownSlug(env, view, service('تازه'), 3_999)).toBe(false);
    expect(await isUnknownSlug(env, view, service('نیست'), 3_999)).toBe(true);
    expect(published).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    expect(await isUnknownSlug(env, view, service('نیست'), 9_000)).toBe(false);
    expect(await isUnknownSlug(env, view, service('نیست'), 9_500)).toBe(false); // failed latest
    // TTL 0 (e2e): no floor, every older view is confirmed.
    const eager = testEnv({ PROXY_CONFIG_TTL_MS: '0' });
    vi.stubGlobal('fetch', fetchMock);
    expect(await isUnknownSlug(eager, view, service('نیست'), 9_001)).toBe(true);
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
