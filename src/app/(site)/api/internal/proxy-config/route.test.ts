import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

const mocks = vi.hoisted(() => ({
  features: { ga4Enabled: false, ga4MeasurementId: 'G-ABC123' as string | null },
  recordRedirectHit: vi.fn(async () => undefined),
}));
vi.mock('@/lib/data/globals', () => ({ getFeatures: async () => mocks.features }));
vi.mock('@/lib/data/redirects', () => ({
  getRedirectsSnapshot: async () => ({
    generatedAt: '2026-10-13T08:30:00.000Z',
    rows: [['/vip', '/خدمات/ترمیم-دندان#سطح-ترمیم', 301]],
  }),
  recordRedirectHit: mocks.recordRedirectHit,
}));

const TOKEN = 'i'.repeat(48); // testEnv's INTERNAL_API_TOKEN
const get = (token?: string) =>
  new Request('http://127.0.0.1:3000/api/internal/proxy-config', {
    headers: token ? { 'x-internal-token': token } : {},
  });
const hit = (body: string, token = TOKEN) =>
  new Request('http://127.0.0.1:3000/api/internal/redirect-hit', {
    method: 'POST',
    body,
    headers: token ? { 'x-internal-token': token } : {},
  });

describe('/api/internal/* (spec 10.2, 10.3)', () => {
  beforeEach(() => {
    stubSiteEnv();
    mocks.recordRedirectHit.mockClear();
    mocks.features.ga4Enabled = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('IN1 proxy-config without the token, or with a wrong one, is a plain 404', async () => {
    const { GET } = await import('./route');
    for (const token of [undefined, 'wrong', `${TOKEN}x`]) {
      const res = await GET(get(token));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not Found');
    }
  });

  it('IN2 proxy-config answers v1 rows the proxy schema accepts; GA4 id only when enabled', async () => {
    const { GET } = await import('./route');
    const res = await GET(get(TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      v: 1,
      generatedAt: '2026-10-13T08:30:00.000Z',
      redirects: [['/vip', '/خدمات/ترمیم-دندان#سطح-ترمیم', 301]],
      ga4MeasurementId: null,
    });
    mocks.features.ga4Enabled = true;
    expect((await (await GET(get(TOKEN))).json()) as { ga4MeasurementId: string }).toMatchObject({
      ga4MeasurementId: 'G-ABC123',
    });
  });

  it('IN3 redirect-hit: 404 without the token, 400 for a bad body, 204 counts one hit', async () => {
    const { POST } = await import('../redirect-hit/route');
    expect((await POST(hit('{"from":"/vip"}', ''))).status).toBe(404);
    expect((await POST(hit('{"from":"vip"}'))).status).toBe(400);
    expect((await POST(hit('not json'))).status).toBe(400);
    expect(mocks.recordRedirectHit).not.toHaveBeenCalled();
    expect((await POST(hit('{"from":"/vip"}'))).status).toBe(204);
    expect(mocks.recordRedirectHit).toHaveBeenCalledWith('/vip');
  });
});
