import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';

describe('logRequestError (spec 12.3)', () => {
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

  it('RE1 one request_error line with reqId, digest and a query-free path; one alert per signature per hour', async () => {
    const { logRequestError } = await import('@/lib/log/requestError');
    const error = Object.assign(new Error('boom for 09123456789'), { digest: '12345' });
    const request = {
      path: '/qa/error?phone=09123456789',
      method: 'GET',
      headers: { 'x-request-id': 'req-abc-123' },
    };
    const context = { routePath: '/qa/error', routeType: 'render' };
    logRequestError(error, request, context, 0);
    logRequestError(error, request, context, 10 * 60_000);
    const lines = writes.map((w) => JSON.parse(w) as Record<string, unknown>);
    const errors = lines.filter((l) => l.msg === 'request_error');
    const alerts = lines.filter((l) => l.msg === 'error_alert');
    expect(errors).toHaveLength(2);
    expect(alerts).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      level: 'error',
      reqId: 'req-abc-123',
      path: '/qa/error',
      digest: '12345',
      routeType: 'render',
    });
    expect(writes.join('')).not.toContain('09123456789');
  });
});
