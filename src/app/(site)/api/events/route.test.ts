import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';
import { zonedDateKey } from '@/lib/jalali';

const mocks = vi.hoisted(() => ({
  increment: vi.fn(async () => undefined),
  payload: { marker: 'payload' },
}));
vi.mock('@/lib/data/payload', () => ({ getPayloadClient: async () => mocks.payload }));
vi.mock('@/lib/events/increment', () => ({
  getServiceKeys: async () => new Set(['implant']),
  incrementEventDaily: mocks.increment,
}));

const SITE = 'https://sefiddental.ir';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/events`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'text/plain;charset=UTF-8', ...headers },
  });

describe('POST /api/events (spec 11.2)', () => {
  beforeEach(() => {
    stubSiteEnv();
    mocks.increment.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('ER1 a beacon answers 204, increments one Tehran-day row and sets no cookie', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      post({ event: 'call_click', location: 'header', pageType: 'home', serviceKey: 'implant' }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mocks.increment).toHaveBeenCalledWith(mocks.payload, {
      date: zonedDateKey(new Date()),
      event: 'call_click',
      location: 'header',
      pageType: 'home',
      serviceKey: 'implant',
    });
  });

  it('ER2 an array increments each event; unknown names are dropped with 204', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      post([
        { event: 'theme_toggle' },
        { event: 'evil' },
        { event: 'whatsapp_click', location: 'x', serviceKey: 'nope', extra: 1 },
      ]),
    );
    expect(res.status).toBe(204);
    expect(mocks.increment).toHaveBeenCalledTimes(2);
    expect(mocks.increment).toHaveBeenLastCalledWith(mocks.payload, {
      date: expect.any(String),
      event: 'whatsapp_click',
      location: 'other',
      pageType: 'other',
      serviceKey: 'none',
    });
    expect((await POST(post({ event: 'evil' }))).status).toBe(204);
    expect(mocks.increment).toHaveBeenCalledTimes(2);
  });

  it('ER3 cross-site and foreign-origin requests are refused with 403 before any write', async () => {
    const { POST } = await import('./route');
    const evil = { origin: 'https://evil.example' };
    expect((await POST(post({ event: 'call_click' }, evil))).status).toBe(403);
    const crossSite = { 'sec-fetch-site': 'cross-site', ...evil };
    expect((await POST(post({ event: 'call_click' }, crossSite))).status).toBe(403);
    const same = { 'sec-fetch-site': 'same-origin', origin: SITE };
    expect((await POST(post({ event: 'call_click' }, same))).status).toBe(204);
    expect(mocks.increment).toHaveBeenCalledTimes(1);
  });

  it('ER4 bad bodies: 413 over 2 KB, 400 for broken JSON, wrong shapes and batches over 10', async () => {
    const { POST } = await import('./route');
    expect((await POST(post({ event: 'call_click', serviceKey: 'x'.repeat(3000) }))).status).toBe(
      413,
    );
    expect((await POST(post('{"event":'))).status).toBe(400);
    expect((await POST(post(''))).status).toBe(400);
    expect((await POST(post({ location: 'header' }))).status).toBe(400);
    expect((await POST(post([]))).status).toBe(400);
    expect(
      (await POST(post(Array.from({ length: 11 }, () => ({ event: 'call_click' }))))).status,
    ).toBe(400);
    expect(mocks.increment).not.toHaveBeenCalled();
  });

  it('ER5 the 61st event of a client in one minute answers 429 with Retry-After', async () => {
    const { POST } = await import('./route');
    const batch = Array.from({ length: 10 }, () => ({ event: 'call_click' }));
    for (let i = 0; i < 6; i += 1) expect((await POST(post(batch))).status).toBe(204);
    const res = await POST(post({ event: 'call_click' }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(mocks.increment).toHaveBeenCalledTimes(60);
  });
});
