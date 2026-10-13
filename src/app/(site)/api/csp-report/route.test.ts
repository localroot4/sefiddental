import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

const report = (path = '/') =>
  JSON.stringify({
    'csp-report': {
      'document-uri': `https://sefiddental.ir${path}?utm_source=x`,
      'violated-directive': 'style-src-attr',
      'blocked-uri': 'inline',
    },
  });

const post = (body: string, type = 'application/csp-report', extra: Record<string, string> = {}) =>
  new Request('https://sefiddental.ir/api/csp-report', {
    method: 'POST',
    body,
    headers: { 'content-type': type, 'x-request-id': 'req-csp-0001', ...extra },
  });

describe('POST /api/csp-report (spec 7.6)', () => {
  let writes: string[];
  beforeEach(() => {
    stubSiteEnv({ NODE_ENV: 'production' });
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('CSR1 204, one warn line per directive, blocked and path per hour; no query in the log', async () => {
    const { POST } = await import('./route');
    expect((await POST(post(report()))).status).toBe(204);
    expect((await POST(post(report()))).status).toBe(204);
    expect((await POST(post(report('/x')))).status).toBe(204);
    const lines = writes
      .map((w) => JSON.parse(w) as Record<string, unknown>)
      .filter((l) => l.msg === 'csp_violation');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      level: 'warn',
      directive: 'style-src-attr',
      blocked: 'inline',
      path: '/',
      reqId: 'req-csp-0001',
    });
    expect(writes.join('')).not.toContain('utm_source');
  });

  it('CSR2 413 above 16 KB; 400 for a body that is not a report', async () => {
    const { POST } = await import('./route');
    expect((await POST(post('x'.repeat(16 * 1024 + 1)))).status).toBe(413);
    expect((await POST(post('{"hello":1}'))).status).toBe(400);
  });

  it('CSR3 429 after 30 reports a minute from one client key', async () => {
    const { POST } = await import('./route');
    for (let i = 0; i < 30; i += 1) expect((await POST(post(report()))).status).toBe(204);
    const limited = await POST(post(report()));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(limited.headers.get('cache-control')).toBe('no-store');
  });
});
