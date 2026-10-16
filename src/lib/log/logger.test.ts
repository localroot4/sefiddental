import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@/lib/log/logger';
import { warnLines } from '@/lib/log/ringBuffer';

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

  it('BH-LOG-DB a failed query logs no bound value: message, stack, params, msg, format args, cause or detail (S3)', () => {
    const NAME = 'علی رضایی';
    const NOTE = 'درد شدید دندان عقل\nاز دیشب';
    const query = 'insert into "bookings" ("phone", "name", "note") values ($1, $2, $3)';
    const cause = Object.assign(new Error('database or disk is full'), { code: 'SQLITE_FULL' });
    // drizzle-orm 0.45.2's own class: the values sit in message and stack after `\nparams: `, in
    // the enumerable `params`, and the driver error is the enumerable `cause`.
    const err = new DrizzleQueryError(query, ['+989121234567', NAME, NOTE], cause);
    expect(err.message).toContain(`\nparams: +989121234567,${NAME}`);
    const pg = Object.assign(new Error('null value in column "x" violates not-null constraint'), {
      code: '23502',
      detail: `Failing row contains (12, ${NAME}, null).`,
    });
    const wrapped = new Error('save failed', { cause: err });
    const { logger, lines, parsed } = capture();
    logger.child({ reqId: 'r1', route: '/api/booking' }).error({ msg: 'form_error', err });
    logger.error(err);
    logger.error({ err });
    logger.warn({ msg: 'form_retry', error: err, reason: err.message });
    logger.error({ msg: 'save_failed', err: wrapped });
    logger.error('save failed %o', err);
    logger.error({ msg: 'interp' }, 'values %j', { params: err.params, to: '+989121234567' });
    logger.error({ msg: 'pg_failed', err: pg, error: pg });
    const all = lines.join('\n');
    for (const value of [NAME, 'رضایی', 'درد شدید', 'دیشب', '9121234567']) {
      expect(all).not.toContain(value);
    }
    const first = parsed()[0]?.err as Record<string, unknown>;
    expect(first).toMatchObject({ type: 'DrizzleQueryError', query: '[redacted]' });
    expect(first.params).toBe('[redacted]');
    expect(String(first.message)).toBe(`Failed query: ${query}\nparams: [redacted]`);
    // The frames stay after the cut; the driver error comes back as class and code only.
    expect(String(first.stack)).toMatch(/^Error: Failed query: insert into "bookings"/);
    expect(String(first.stack)).toMatch(/\nparams: \[redacted\]\n {4}at .*logger\.test\.ts/);
    expect(first.causes).toEqual([{ type: 'Error', code: 'SQLITE_FULL' }]);
    expect(parsed()[1]?.msg).toBe(`Failed query: ${query}\nparams: [redacted]`);
    expect((parsed()[4]?.err as Record<string, unknown>).causes).toEqual([
      { type: 'DrizzleQueryError' },
      { type: 'Error', code: 'SQLITE_FULL' },
    ]);
    expect(parsed()[7]).toMatchObject({
      err: { detail: '[redacted]', code: '23502' },
      error: { detail: '[redacted]' },
    });
  });

  it('LG5 level filter', () => {
    const { logger, lines } = capture('info');
    logger.debug({ msg: 'hidden' });
    expect(lines).toHaveLength(0);
  });

  it('LG9 the status ring keeps one line per repeated warning; stdout keeps all (SEC-S4)', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const logger = createLogger({ logLevel: 'info', gitSha: 'abc1234', nodeEnv: 'production' });
      for (let i = 0; i < 300; i += 1) logger.error({ msg: `flood_${i}`, id: i });
      logger.warn({ msg: 'distinct_line' });
      const ring = warnLines.entries();
      expect(ring.filter((line) => line.includes('flood_')).length).toBe(1);
      expect(ring.some((line) => line.includes('distinct_line'))).toBe(true);
      expect(write).toHaveBeenCalledTimes(301);
    } finally {
      write.mockRestore();
    }
  });
});
