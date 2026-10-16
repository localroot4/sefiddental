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

  it('RE2 an alert also goes to the Notifier sink once per window, with ids only; a failed sink is logged', async () => {
    const { logRequestError, setErrorAlertSink } = await import('@/lib/log/requestError');
    const alerts: unknown[] = [];
    setErrorAlertSink(async (alert) => {
      alerts.push(alert);
    });
    const error = new TypeError('no row for 09123456789');
    const request = { path: '/x', method: 'GET', headers: { 'x-request-id': 'req-sink' } };
    const context = { routePath: '/qa/sink', routeType: 'route' };
    logRequestError(error, request, context, 0);
    logRequestError(error, request, context, 5 * 60_000);
    expect(alerts).toEqual([
      {
        type: 'error',
        signature: expect.stringMatching(/^[0-9a-f]{40}$/),
        routePath: '/qa/sink',
        errName: 'TypeError',
        count: 1,
        requestId: 'req-sink',
      },
    ]);
    expect(JSON.stringify(alerts)).not.toContain('0912');

    setErrorAlertSink(() => Promise.reject(new Error('database down')));
    const other = { routePath: '/qa/sink-down', routeType: 'route' };
    expect(() => logRequestError(error, request, other, 0)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    const lines = writes.map((w) => JSON.parse(w) as Record<string, unknown>);
    expect(lines.filter((l) => l.msg === 'error_alert_not_sent')).toEqual([
      expect.objectContaining({ reqId: 'req-sink', err: 'Error' }),
    ]);
    setErrorAlertSink(undefined);
  });

  it('RE3 the alert window follows errorDedupMinutes: set by the Notifier or a save of the global (R5)', async () => {
    const { logRequestError, setErrorAlertWindow } = await import('@/lib/log/requestError');
    const { Notifier } = await import('@/globals/Settings');
    const error = new Error('window test');
    const request = { path: '/x', method: 'GET', headers: {} };
    const alertsFor = (routePath: string, minutes: number[]) => {
      for (const at of minutes)
        logRequestError(error, request, { routePath, routeType: 'route' }, at * 60_000);
      return writes.filter((w) => w.includes('"error_alert"') && w.includes(routePath)).length;
    };
    setErrorAlertWindow(10);
    expect(alertsFor('/qa/r5-ten', [0, 9, 11])).toBe(2);
    setErrorAlertWindow(undefined);
    expect(alertsFor('/qa/r5-default', [0, 11, 59])).toBe(1);
    // A save of the notifier global moves the window at once in this process.
    const hook = Notifier.hooks?.afterChange?.at(-1);
    await hook?.({ doc: { errorDedupMinutes: 5 } } as never);
    expect(alertsFor('/qa/r5-saved', [0, 6])).toBe(2);
    setErrorAlertWindow(undefined);
  });

  it('RE4 a failed query alerts once whatever its bound values; none reach the log (S3)', async () => {
    const { logRequestError } = await import('@/lib/log/requestError');
    const failed = (name: string) =>
      new Error(`Failed query: insert into "bookings" ("name") values ($1)\nparams: ${name}`);
    const request = { path: '/api/booking', method: 'POST', headers: {} };
    const context = { routePath: '/qa/re4', routeType: 'route' };
    logRequestError(failed('علی رضایی'), request, context, 0);
    logRequestError(failed('سارا محمدی'), request, context, 60_000);
    const alerts = writes.filter((w) => w.includes('"error_alert"') && w.includes('/qa/re4'));
    expect(alerts).toHaveLength(1);
    expect(writes.join('')).not.toMatch(/رضایی|محمدی/);
  });
});
