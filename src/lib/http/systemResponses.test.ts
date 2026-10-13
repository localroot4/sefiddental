import { describe, expect, it } from 'vitest';

import { API_CSP } from '@/lib/http/csp';
import {
  goneResponse,
  maintenanceResponse,
  tooManyRequestsResponse,
} from '@/lib/http/systemResponses';
import { STATIC_PAGE_CSP } from '@/lib/system-pages/staticPage';

const map = (headers: Array<[string, string]>) =>
  new Map(headers.map(([k, v]) => [k.toLowerCase(), v]));

describe('system responses of the proxy', () => {
  it('SR1 maintenance page: 503, Retry-After, no-store, static CSP, noindex, no script', () => {
    const res = maintenanceResponse({
      kind: 'page',
      env: { maintenanceRetryAfter: 900 },
      reqId: 'r1',
    });
    const h = map(res.headers);
    expect(res.status).toBe(503);
    expect(h.get('retry-after')).toBe('900');
    expect(h.get('cache-control')).toBe('no-store');
    expect(h.get('content-security-policy')).toBe(STATIC_PAGE_CSP);
    expect(h.get('x-robots-tag')).toBe('noindex');
    expect(h.get('content-type')).toBe('text/html; charset=utf-8');
    expect(h.get('x-request-id')).toBe('r1');
    expect(res.body).toContain('سایت در حال به‌روزرسانی است');
    expect(res.body).not.toContain('<script');
  });

  it('SR2 maintenance API: JSON body', () => {
    const res = maintenanceResponse({
      kind: 'api',
      env: { maintenanceRetryAfter: 60 },
      reqId: 'r2',
    });
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body)).toEqual({ status: 'maintenance' });
    expect(map(res.headers).get('content-security-policy')).toBe(API_CSP);
    expect(map(res.headers).get('retry-after')).toBe('60');
  });

  it('SR3 gone: 410 document without Retry-After', () => {
    const res = goneResponse({ reqId: 'r3' });
    expect(res.status).toBe(410);
    expect(res.body).toContain('این صفحه دیگر در دسترس نیست');
    expect(map(res.headers).has('retry-after')).toBe(false);
  });

  it('SR4 429 in the Payload error shape with Retry-After', () => {
    const res = tooManyRequestsResponse({ retryAfterSec: 120, reqId: 'r4' });
    expect(res.status).toBe(429);
    expect(map(res.headers).get('retry-after')).toBe('120');
    const json = JSON.parse(res.body) as { errors: Array<{ message: string }> };
    expect(json.errors[0]?.message).toMatch(/دوباره امتحان کنید/);
  });
});
