import { describe, expect, it } from 'vitest';

import { createLogger } from '@/lib/log/logger';

function capture(level: 'info' | 'debug' = 'info') {
  const lines: string[] = [];
  const logger = createLogger(
    { logLevel: level, gitSha: 'abc1234', nodeEnv: 'production' },
    { write: (line: string) => void lines.push(line) },
  );
  const parsed = () => lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  return { logger, lines, parsed };
}

describe('logger (spec 12.1)', () => {
  it('LG1 JSON line with time, level label, msg, service, env, sha', () => {
    const { logger, parsed } = capture();
    logger.info({ msg: 'server_start' });
    const [line] = parsed();
    expect(line).toMatchObject({
      level: 'info',
      msg: 'server_start',
      service: 'sefid-web',
      env: 'production',
      sha: 'abc1234',
    });
    expect(String(line?.time)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('LG2 phones never reach a line: keys, values, messages, errors (redaction test)', () => {
    const { logger, lines } = capture();
    logger.info({
      msg: 'booking_saved',
      phone: '+989123456789',
      booking: { phone: '09123456789', mobile: '۰۹۱۲۳۴۵۶۷۸۹' },
    });
    logger.warn({ msg: 'lookup', query: 'phone=0912 345 6789' });
    logger.info('free text with 09123456789');
    logger.info({ msg: 'interp' }, 'caller %s', '+98 912 345 6789');
    logger.error({ msg: 'failed', err: new Error('duplicate booking for 09123456789') });
    logger.error(new Error('raw error 9123456789'));
    logger.error({ err: new Error('lookup failed for 09123456789') });
    logger.child({ reqId: 'r1' }).warn({ msg: 'child', detail: { contact: '00989123456789' } });
    const all = lines.join('\n');
    for (const needle of ['9123456789', '۹۱۲۳۴۵۶۷۸۹', '912 345 6789'])
      expect(all).not.toContain(needle);
    expect(all).toContain('[phone]');
  });

  it('LG3 spec key paths are redacted', () => {
    const { logger, parsed } = capture();
    logger.info({
      msg: 'request',
      name: 'Ali',
      patient: { name: 'Sara', note: 'n' },
      headers: {
        cookie: 'payload-token=x',
        authorization: 'Bearer y',
        'x-internal-token': 'z',
        accept: 'a',
      },
      token: 't',
    });
    expect(parsed()[0]).toMatchObject({
      name: '[redacted]',
      patient: { name: '[redacted]', note: '[redacted]' },
      headers: {
        cookie: '[redacted]',
        authorization: '[redacted]',
        'x-internal-token': '[redacted]',
        accept: 'a',
      },
      token: '[redacted]',
    });
  });

  it('LG4 errors are serialized with type, message and stack', () => {
    const { logger, parsed } = capture();
    logger.error({ msg: 'boom', err: new RangeError('bad range') });
    const err = parsed()[0]?.err as Record<string, unknown>;
    expect(err.type).toBe('RangeError');
    expect(err.message).toBe('bad range');
    expect(String(err.stack)).toContain('RangeError');
  });

  it('LG6 a 4xx error is a warning without changing the line', () => {
    const { logger, parsed } = capture();
    const authError = Object.assign(new Error('ایمیل یا رمز عبور اشتباه است.'), { status: 401 });
    logger.error({ msg: 'login_failed', err: authError });
    logger.error(authError);
    logger.error({ msg: 'boom', err: Object.assign(new Error('db down'), { status: 500 }) });
    expect(parsed().map((l) => l.level)).toEqual(['warn', 'warn', 'error']);
    expect(parsed()[0]).toMatchObject({ msg: 'login_failed', err: { status: 401 } });
  });

  it('LG5 level filter', () => {
    const { logger, lines } = capture('info');
    logger.debug({ msg: 'hidden' });
    expect(lines).toHaveLength(0);
  });
});
