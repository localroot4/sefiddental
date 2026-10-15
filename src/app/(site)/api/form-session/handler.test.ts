import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { csrfFor, FORM_COOKIE, issueTimeToken, verifyFormTokens } from '@/lib/formTokens';
import type { ClinicHours } from '@/lib/hoursState';

import { createFormSessionHandler, FORM_SESSION_RATE, type FormSessionLimiter } from './handler';

// Test secret only.
const K = 'k'.repeat(43);
const SID = 'S'.repeat(43);
const TTL_SECONDS = 7200;
const NOW = Date.parse('2026-10-13T08:00:00Z'); // Tuesday 11:30 in Tehran: open
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  holidays: [],
  noteFa: 'note',
};
const ALLOW: FormSessionLimiter = { hit: () => ({ ok: true }) };

function setup(over: { limiter?: FormSessionLimiter; secrets?: string[]; now?: number } = {}) {
  const clientKey = vi.fn((_headers: Headers) => 'client-key');
  const loadHours = vi.fn(async () => ({ hours: HOURS, options: { callbackMinutes: 10 } }));
  const handler = createFormSessionHandler({
    env: () => ({
      formTokenSecrets: over.secrets ?? [K],
      formTokenTtlSeconds: TTL_SECONDS,
      qaRoutes: false,
    }),
    loadHours,
    limiter: over.limiter ?? ALLOW,
    clientKey,
    now: () => over.now ?? NOW,
  });
  return { handler, clientKey, loadHours };
}

const request = (query = '', cookie?: string) =>
  new NextRequest(`http://localhost:3000/api/form-session${query}`, {
    headers: cookie ? { cookie: `${FORM_COOKIE}=${cookie}` } : {},
  });

const sidFrom = (setCookie: string | null) =>
  /__Host-sefid-form=([^;]+)/.exec(setCookie ?? '')?.[1];

describe('GET /api/form-session handler', () => {
  it('FS1 200 JSON shape, no-store and the __Host- cookie (E1 at unit level)', async () => {
    const { handler } = setup();
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['csrf', 'hours', 'ts', 'ttlSeconds']);
    expect(body.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.ts).toMatch(/^v1\.[0-9a-z]{1,11}\.[A-Za-z0-9_-]{43}$/);
    expect(body.ttlSeconds).toBe(TTL_SECONDS);
    expect(body.hours).toEqual({
      state: 'open',
      callsAllowed: true,
      showClosedSheet: false,
      nextChangeAt: '2026-10-13T16:00:00.000Z',
      copy: {
        callback: 'پذیرش معمولاً تا ۱۰ دقیقهٔ دیگر با شما تماس می\u200Cگیرد.',
        closedSheet: null,
        emergencyClosedLine: null,
      },
    });

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie.split(/,(?=\s*[^;=]+=)/)).toHaveLength(1);
    expect(setCookie).toMatch(/^__Host-sefid-form=[A-Za-z0-9_-]{43};/);
    expect(setCookie).toMatch(/;\s*Path=\/(;|$)/);
    expect(setCookie).toMatch(/;\s*Secure(;|$)/i);
    expect(setCookie).toMatch(/;\s*HttpOnly(;|$)/i);
    expect(setCookie).toMatch(/;\s*SameSite=lax(;|$)/i);
    expect(setCookie).toMatch(/;\s*Max-Age=86400(;|$)/);
    expect(setCookie).not.toMatch(/domain=/i);
  });

  it('FS2 the tokens verify against the cookie it sets', async () => {
    const { handler } = setup();
    const response = await handler(request());
    const { csrf, ts } = await response.json();
    const cookieSid = sidFrom(response.headers.get('set-cookie'));
    const check = (nowMs: number) =>
      verifyFormTokens({ secrets: [K], cookieSid, csrf, ts, nowMs, ttlMs: TTL_SECONDS * 1000 })
        .status;
    expect([check(NOW + 1000), check(NOW + 2000)]).toEqual(['too-fast', 'ok']);
  });

  it('FS3 a well-formed cookie sid is reused; a malformed one is replaced', async () => {
    const { handler } = setup();
    const reused = await handler(request('', SID));
    expect((await reused.json()).csrf).toBe(csrfFor(K, SID));
    expect(sidFrom(reused.headers.get('set-cookie'))).toBe(SID);

    const replaced = await handler(request('', 'not-a-sid'));
    const sid = sidFrom(replaced.headers.get('set-cookie'));
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sid).not.toBe('not-a-sid');
    expect((await replaced.json()).csrf).toBe(csrfFor(K, sid as string));
  });

  it('FS4 renew: an expired genuine token is pre-aged, any other value is fresh', async () => {
    const now = NOW + TTL_SECONDS * 1000 + 60_000;
    const { handler } = setup({ now });
    const verifyNow = (ts: string) =>
      verifyFormTokens({
        secrets: [K],
        cookieSid: SID,
        csrf: csrfFor(K, SID),
        ts,
        nowMs: now,
        ttlMs: TTL_SECONDS * 1000,
      }).status;

    const old = issueTimeToken(K, SID, NOW);
    const renewed = await (await handler(request(`?renew=${encodeURIComponent(old)}`, SID))).json();
    expect(verifyNow(renewed.ts)).toBe('ok');

    for (const value of ['garbage', issueTimeToken(K, 'O'.repeat(43), NOW), 'x'.repeat(200)]) {
      const fresh = await (
        await handler(request(`?renew=${encodeURIComponent(value)}`, SID))
      ).json();
      expect(verifyNow(fresh.ts)).toBe('too-fast');
    }
  });

  it('FS5 rate limit: 429 with Retry-After, no-store, no cookie and no token', async () => {
    const limiter: FormSessionLimiter = { hit: () => ({ ok: false, retryAfterSec: 42 }) };
    const { handler, loadHours } = setup({ limiter });
    const response = await handler(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(loadHours).not.toHaveBeenCalled();
  });

  it('FS6 the limiter is keyed by the client key of the request headers', async () => {
    const hits: string[] = [];
    const limiter: FormSessionLimiter = {
      hit: (key) => {
        hits.push(key);
        return { ok: true };
      },
    };
    const { handler, clientKey } = setup({ limiter });
    await handler(request());
    expect(clientKey).toHaveBeenCalledWith(expect.any(Headers));
    expect(hits).toEqual(['client-key']);
    expect(FORM_SESSION_RATE).toEqual({ limit: 60, windowMs: 60_000 });
  });

  it('FS7 a failing hours read fails loud (500 from Next), never a guessed state', async () => {
    const handler = createFormSessionHandler({
      env: () => ({ formTokenSecrets: [K], formTokenTtlSeconds: TTL_SECONDS, qaRoutes: false }),
      loadHours: async () => {
        throw new Error('database unavailable');
      },
      limiter: ALLOW,
      clientKey: () => 'k',
      now: () => NOW,
    });
    await expect(handler(request())).rejects.toThrow('database unavailable');
  });

  it('FS8 a missing secret fails loud', async () => {
    const { handler } = setup({ secrets: [] });
    await expect(handler(request())).rejects.toThrow(/FORM_TOKEN_SECRET/);
  });

  it('FS9 closed hours carry the closed-sheet copy', async () => {
    const { handler } = setup({ now: Date.parse('2026-10-13T17:00:00Z') });
    const { hours } = await (await handler(request())).json();
    expect([hours.state, hours.callsAllowed, hours.showClosedSheet]).toEqual([
      'closed',
      false,
      true,
    ]);
    expect(hours.copy.closedSheet).toBe(
      'کلینیک الان بسته است. ساعات کاری: هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.',
    );
  });
});
