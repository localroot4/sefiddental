import type { Payload } from 'payload';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { NOTIFY_MESSAGES } from '@/i18n/fa-notify';
import { createLogger, log } from '@/lib/log/logger';
import { scrubPhones } from '@/lib/log/redact';

import { readyChannels, sendMail, sendTelegram } from './drivers';
import { createNotifier } from './index';
import { renderBooking, renderEvent } from './render';
import { destinationHash } from './smsThrottle';
import { NOTIFY_RETRIES, notifyTask, runNotifyJob, type NotifyJobInput } from './task';
import type { NotifierSettings, NotifyEvent } from './types';

const SECRET = 'h'.repeat(48);
const SMTP = { host: 'smtp.test', port: 587, user: undefined, pass: undefined, from: 'a@b.test' };
const TOKEN = '123456:secret-bot-token';
const ENV = {
  siteUrl: 'https://sefiddental.ir',
  ipHashSecret: SECRET,
  smtp: SMTP,
  telegram: { botToken: TOKEN },
  farapayamak: { username: 'u', password: 'p' },
};
const ALL_ON: NotifierSettings = {
  mail: { enabled: true, recipients: [{ email: 'staff@sefid.test' }, { email: 'b@sefid.test' }] },
  telegram: { enabled: true, chatId: '-100123' },
  sms: {
    enabled: true,
    senderNumber: '3000123',
    adminRecipients: [{ phone: '+989121111111' }, { phone: '+989122222222' }],
    patientConfirmation: true,
  },
  errorDedupMinutes: 60,
};
const BOOKING = {
  id: 42,
  kind: 'emergency',
  phone: '+989123456789',
  name: 'نام بیمار',
  note: 'یادداشت محرمانه',
  triage: ['swelling'],
  bookingGroup: 'implant',
  preferredTime: 'evening',
  createdAt: '2026-10-13T08:00:00.000Z',
  callbackDueAt: '2026-10-13T08:10:00.000Z',
};

function fakePayload(settings: NotifierSettings, booking: object | null = BOOKING) {
  const queued: NotifyJobInput[] = [];
  const sendEmail = vi.fn(async () => undefined);
  const payload = {
    findGlobal: vi.fn(async () => settings),
    findByID: vi.fn(async () => booking),
    jobs: { queue: vi.fn(async ({ input }: { input: NotifyJobInput }) => void queued.push(input)) },
    sendEmail,
  } as unknown as Payload;
  return { payload, queued, sendEmail };
}

function notifierFor(settings: NotifierSettings, env: Partial<typeof ENV> = {}) {
  const lines: string[] = [];
  const base = createLogger(
    { logLevel: 'info', gitSha: 't', nodeEnv: 'test' },
    { write: (line: string) => void lines.push(line) },
  );
  // The objects as the notifier hands them over, before the logger's own phone scrubbing.
  const raw: object[] = [];
  const logger = {
    info: (obj: object) => (raw.push(obj), base.info(obj)),
    warn: (obj: object) => (raw.push(obj), base.warn(obj)),
  };
  let now = Date.parse('2026-10-13T08:00:00Z');
  const fake = fakePayload(settings);
  const notifier = createNotifier({
    payload: async () => fake.payload,
    env: () => ({ ...ENV, ...env }),
    logger,
    now: () => now,
  });
  return { notifier, lines, raw, ...fake, advance: (ms: number) => (now += ms) };
}

const booking: NotifyEvent = { type: 'booking', bookingId: 42, requestId: 'req-n-0001' };

describe('Notifier', () => {
  it('NT1 a booking queues one job per ready channel and one per admin SMS recipient', async () => {
    const t = notifierFor(ALL_ON);
    await t.notifier.notify(booking);
    expect(t.queued.map((i) => i.channel)).toEqual([
      'mail',
      'telegram',
      'sms_admin',
      'sms_admin',
      'sms_patient',
    ]);
    const hashes = t.queued.filter((i) => i.channel === 'sms_admin').map((i) => i.recipientHash);
    expect(hashes).toEqual([
      destinationHash('+989121111111', SECRET),
      destinationHash('+989122222222', SECRET),
    ]);
  });

  it('NT1b nothing ready: the log line is the only output', async () => {
    const t = notifierFor({ mail: { enabled: false }, telegram: { enabled: false } });
    await t.notifier.notify(booking);
    expect(t.queued).toEqual([]);
    expect(t.lines.map((l) => JSON.parse(l))).toEqual([
      expect.objectContaining({ msg: 'notify', type: 'booking', bookingId: 42, channels: [] }),
    ]);
  });

  it('NT2 job inputs hold the event, the channel and a hash only; no phone in any form', async () => {
    const t = notifierFor(ALL_ON);
    await t.notifier.notify(booking);
    for (const input of t.queued) {
      expect(
        Object.keys(input).every((k) => ['event', 'channel', 'recipientHash'].includes(k)),
      ).toBe(true);
      const text = JSON.stringify(input);
      expect(scrubPhones(text)).toBe(text);
      expect(text).not.toMatch(/9121111111|9122222222|9123456789/);
    }
  });

  it('NT6 the log line holds the booking id and request id, never a phone', async () => {
    const t = notifierFor(ALL_ON);
    await t.notifier.notify(booking);
    const line = t.lines.join('\n');
    expect(line).toContain('"bookingId":42');
    expect(line).toContain('req-n-0001');
    expect(line).not.toMatch(/912/);
    expect(JSON.stringify(t.raw)).not.toMatch(/912/);
  });

  it('NT-LOG-FIRST a failed settings read still leaves the notify line, then throws', async () => {
    const t = notifierFor(ALL_ON);
    vi.mocked(t.payload.findGlobal).mockRejectedValueOnce(new Error('database down'));
    await expect(t.notifier.notify(booking)).rejects.toThrow('database down');
    expect(t.lines.map((l) => JSON.parse(l))).toEqual([
      expect.objectContaining({ msg: 'notify', type: 'booking', bookingId: 42, channels: [] }),
    ]);
    expect(t.queued).toEqual([]);
  });

  it('NT10 one spike alert per window across all hashes, with the distinct hashes seen in it (S5)', async () => {
    const t = notifierFor(ALL_ON);
    const spike: NotifyEvent = { type: 'ip_spike', ipHashPrefix: 'aaaa0000', count: 11 };
    await t.notifier.notify(spike);
    t.advance(30 * 60_000);
    await t.notifier.notify({ ...spike, count: 12 });
    await t.notifier.notify({ ...spike, ipHashPrefix: 'bbbb0000' });
    expect(t.queued.map((i) => i.channel)).toEqual(['mail', 'telegram']);
    // A spike inside the last window read needs no database read and writes no line.
    expect(t.payload.findGlobal).toHaveBeenCalledTimes(1);
    expect(t.lines.filter((l) => l.includes('notify_deduped'))).toHaveLength(0);
    // 61 minutes after the first alert: 'aaaa0000' was last seen 31 minutes ago, 'bbbb0000' too.
    t.advance(31 * 60_000);
    await t.notifier.notify({ ...spike, ipHashPrefix: 'cccc0000' });
    expect(t.queued).toHaveLength(4);
    expect(t.queued.map((i) => (i.event.type === 'ip_spike' ? i.event.addresses : 0))).toEqual([
      1, 1, 3, 3,
    ]);
    // A hash older than the window is pruned and no longer counted.
    t.advance(60 * 60_000);
    await t.notifier.notify({ ...spike, ipHashPrefix: 'dddd0000' });
    expect(t.queued.at(-1)?.event).toMatchObject({ addresses: 1, windowMinutes: 60 });
  });

  it('NT-BUDGET mail and Telegram take 20 booking notifications an hour; one budget alert per channel per hour says how many were held since when (S5)', async () => {
    const t = notifierFor(ALL_ON);
    const t0 = '2026-10-13T08:00:00.000Z';
    const send = async (n: number) => {
      for (let i = 0; i < n; i += 1) await t.notifier.notify({ type: 'booking', bookingId: i });
    };
    const count = (channel: string, type = 'booking') =>
      t.queued.filter((i) => i.channel === channel && i.event.type === type).length;
    await send(20);
    expect([count('mail'), count('telegram'), count('sms_admin'), count('sms_patient')]).toEqual([
      20, 20, 40, 20,
    ]);
    await send(1);
    // SMS keeps its own rules; mail and Telegram hold it, and alert once each.
    expect([count('mail'), count('telegram'), count('sms_admin')]).toEqual([20, 20, 42]);
    expect(t.queued.filter((i) => i.event.type === 'budget')).toEqual([
      {
        event: { type: 'budget', channel: 'mail', held: 1, since: t0, limit: 20 },
        channel: 'mail',
      },
      {
        event: { type: 'budget', channel: 'telegram', held: 1, since: t0, limit: 20 },
        channel: 'telegram',
      },
    ]);
    const lines = t.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.filter((l) => l.msg === 'notify_budget')).toHaveLength(2);
    expect(lines.at(-1)).toMatchObject({ msg: 'notify', held: ['mail', 'telegram'] });
    // Ten minutes on, one more is held without an alert; the next alert counts it from then.
    t.advance(10 * 60_000);
    await send(1);
    expect(count('mail', 'budget')).toBe(1);
    t.advance(50 * 60_000);
    await send(21);
    expect(count('mail')).toBe(40);
    expect(t.queued.filter((i) => i.event.type === 'budget').map((i) => i.event)).toEqual([
      expect.objectContaining({ channel: 'mail', held: 1, since: t0 }),
      expect.objectContaining({ channel: 'telegram', held: 1, since: t0 }),
      expect.objectContaining({ channel: 'mail', held: 2, since: '2026-10-13T08:10:00.000Z' }),
      expect.objectContaining({ channel: 'telegram', held: 2, since: '2026-10-13T08:10:00.000Z' }),
    ]);
  });

  it('NT-BUDGET-KIND regular bookings take at most 15 of the 20 slots, so emergencies keep 5', async () => {
    const t = notifierFor(ALL_ON);
    const send = (kind: 'regular' | 'emergency', n: number) =>
      Array.from({ length: n }).reduce<Promise<void>>(
        (prev, _, i) => prev.then(() => t.notifier.notify({ type: 'booking', bookingId: i, kind })),
        Promise.resolve(),
      );
    const mail = () =>
      t.queued.filter((i) => i.channel === 'mail' && i.event.type === 'booking').length;
    await send('regular', 20);
    expect(mail()).toBe(15);
    expect(t.queued.find((i) => i.event.type === 'budget')?.event).toMatchObject({ limit: 15 });
    await send('emergency', 6);
    expect(mail()).toBe(20);
  });

  it("NT-BUDGET-FIRST budget alerts are queued before the request's own jobs", async () => {
    const t = notifierFor(ALL_ON);
    for (let i = 0; i < 20; i += 1) await t.notifier.notify({ type: 'booking', bookingId: i });
    const queue = t.payload.jobs.queue as unknown as Mock<
      (args: { input: NotifyJobInput }) => Promise<void>
    >;
    queue.mockImplementation(async ({ input }) => {
      if (input.channel === 'sms_admin') throw new Error('queue down');
      t.queued.push(input);
    });
    await expect(t.notifier.notify({ type: 'booking', bookingId: 21 })).rejects.toThrow(
      'queue down',
    );
    expect(t.queued.filter((i) => i.event.type === 'budget').map((i) => i.channel)).toEqual([
      'mail',
      'telegram',
    ]);
  });

  it('NT-R5 reading the global moves the error-alert window to errorDedupMinutes', async () => {
    const { logRequestError, setErrorAlertSink, setErrorAlertWindow } =
      await import('@/lib/log/requestError');
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const alerts: unknown[] = [];
    setErrorAlertSink(async (alert) => void alerts.push(alert));
    try {
      const t = notifierFor({ ...ALL_ON, errorDedupMinutes: 5 });
      await t.notifier.notify(booking);
      const request = { path: '/x', method: 'GET', headers: {} };
      const context = { routePath: '/qa/nt-r5', routeType: 'route' };
      logRequestError(new Error('r5'), request, context, 0);
      logRequestError(new Error('r5'), request, context, 6 * 60_000);
      expect(alerts).toHaveLength(2);
    } finally {
      setErrorAlertSink(undefined);
      setErrorAlertWindow(undefined);
      write.mockRestore();
    }
  });

  it('NT-FLAGS a channel needs its switch AND its server credentials', () => {
    const none = { smtp: null, telegram: null, farapayamak: null };
    expect(readyChannels(ALL_ON, none, booking)).toEqual([]);
    expect(readyChannels({}, ENV, booking)).toEqual([]);
    expect(
      readyChannels({ ...ALL_ON, telegram: { enabled: true, chatId: '' } }, ENV, booking),
    ).not.toContain('telegram');
    expect(
      readyChannels({ ...ALL_ON, mail: { enabled: true, recipients: [] } }, ENV, booking),
    ).not.toContain('mail');
    expect(
      readyChannels(
        { ...ALL_ON, sms: { ...ALL_ON.sms, patientConfirmation: false } },
        ENV,
        booking,
      ),
    ).not.toContain('sms_patient');
    // A test message never texts a patient; errors and spikes never use SMS.
    expect(readyChannels(ALL_ON, ENV, { type: 'test', requestedBy: 1 })).toEqual([
      'mail',
      'telegram',
      'sms_admin',
    ]);
  });
});

describe('messages (D-4)', () => {
  it('NT3 a booking message: masked phone, admin link, request id, Persian digits; nothing else', () => {
    const message = renderBooking(BOOKING, ENV.siteUrl, 'req-n-0001');
    expect(message.subject).toBe('درخواست فوری تازه #۴۲');
    expect(message.text).toContain('شماره: ۰۹۱۲ ••• ۶۷۸۹');
    expect(message.text).toContain('https://sefiddental.ir/admin/collections/bookings/42');
    expect(message.text).toContain('شناسهٔ پیگیری: req-n-0001');
    expect(message.text).toContain('گروه خدمت: ایمپلنت');
    expect(message.text).toContain('زمان دلخواه: عصر');
    expect(message.text).toContain('زمان ثبت: ۲۱ مهر ۱۴۰۵، ساعت ۱۱:۳۰');
    expect(message.sms).toBe('درخواست فوری تازه #۴۲. پنل را ببینید.');
    for (const part of Object.values(message)) {
      expect(part).not.toContain('نام بیمار');
      expect(part).not.toContain('یادداشت محرمانه');
      expect(part).not.toMatch(/9123456789|swelling|ورم/);
    }
    expect(
      renderBooking({ ...BOOKING, kind: 'regular', bookingGroup: null }, ENV.siteUrl).text,
    ).toContain('گروه خدمت: انتخاب نشده');
  });

  it('NT3b event messages carry no address or phone', () => {
    const spike = renderEvent(
      { type: 'ip_spike', ipHashPrefix: 'abcd1234', count: 11, addresses: 3, windowMinutes: 45 },
      ENV.siteUrl,
    );
    expect(spike.text).not.toContain('abcd1234');
    expect(spike.text).toContain('شمار این نشانی‌ها در ۴۵ دقیقهٔ گذشته: ۳.');
    const budget = renderEvent(
      { type: 'budget', channel: 'telegram', held: 12, since: BOOKING.createdAt, limit: 20 },
      ENV.siteUrl,
    );
    expect(budget.subject).toBe('هشدار: سقف اعلان تلگرام پر شد');
    expect(budget.text).toContain('سقف ۲۰ اعلان در ساعت برای تلگرام پر شد.');
    expect(budget.text).toContain('از ۲۱ مهر ۱۴۰۵، ساعت ۱۱:۳۰ تا این لحظه ۱۲ درخواست');
    // No promise of a later alert: it comes only if another request is held after the hour.
    expect(budget.text).not.toContain('هشدار بعدی');
    expect(budget.text).toContain('https://sefiddental.ir/admin/collections/bookings');
    const error = renderEvent(
      { type: 'error', signature: 's', routePath: '/x/09123456789', errName: 'E', count: 3 },
      ENV.siteUrl,
    );
    expect(error.subject).not.toContain('09123456789');
    expect(error.text).toContain('تعداد تکرار: ۳');
  });

  it('NT-COPY the notification strings follow the copy rules', () => {
    for (const text of Object.values(NOTIFY_MESSAGES)) {
      expect(text).not.toMatch(/[يكى]/);
      expect(text).not.toMatch(/[—–]/);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/(^|[\s«])ن?می [آ-ی]/);
      expect(text).not.toMatch(/ (ها|های|هایی|تر|ترین)([\s.،؟»]|$)/);
    }
  });
});

describe('drivers and the notify task', () => {
  it('NT4 mail: not ready without SMTP; all recipients in one message; errors scrubbed', async () => {
    expect(readyChannels(ALL_ON, { ...ENV, smtp: null }, booking)).not.toContain('mail');
    const { payload, sendEmail } = fakePayload(ALL_ON);
    const message = renderBooking(BOOKING, ENV.siteUrl);
    await sendMail(payload, ALL_ON, message);
    expect(sendEmail).toHaveBeenCalledWith({
      to: ['staff@sefid.test', 'b@sefid.test'],
      subject: message.subject,
      text: message.text,
    });
    sendEmail.mockRejectedValueOnce(
      Object.assign(new Error('connect to 09123456789 failed'), { code: 'ETIMEDOUT' }),
    );
    await expect(sendMail(payload, ALL_ON, message)).rejects.toThrow(
      'ارسال ایمیل نشد (SMTP: ETIMEDOUT). تنظیمات SMTP را بررسی کنید.',
    );
  });

  it('NT7 Telegram: the token never appears in an error; a non-2xx status throws', async () => {
    const message = renderBooking(BOOKING, ENV.siteUrl);
    const ok = vi.fn(async () => new Response(null, { status: 200 }));
    await expect(sendTelegram(ENV, ALL_ON, message, ok)).resolves.toEqual({ status: 'sent' });
    const bad = vi.fn(async () => new Response(null, { status: 403 }));
    await expect(sendTelegram(ENV, ALL_ON, message, bad)).rejects.toThrow('HTTP 403');
    const down = vi.fn(async () => {
      throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const error = await sendTelegram(ENV, ALL_ON, message, down).catch((e: Error) => e);
    expect(String((error as Error).message)).not.toContain(TOKEN);
    expect(String((error as Error).message)).toContain('TypeError');
  });

  it('NT-RETRY the task retries 5 times with exponential backoff from 60 s', () => {
    expect(notifyTask.slug).toBe('notify');
    expect(notifyTask.retries).toEqual({
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
    });
    expect(NOTIFY_RETRIES.attempts).toBe(5);
    expect(notifyTask.inputSchema?.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'event',
      'channel',
      'recipientHash',
    ]);
  });

  it('NT-ONFAIL a failed try warns; only the last try logs an error', async () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(log, 'error').mockImplementation(() => undefined);
    const fail = (totalTried: number) =>
      notifyTask.onFail?.({
        input: { event: booking, channel: 'mail' },
        job: { id: 7 },
        req: {},
        taskStatus: { complete: false, totalTried },
      } as unknown as Parameters<NonNullable<typeof notifyTask.onFail>>[0]);
    for (let tried = 0; tried < NOTIFY_RETRIES.attempts; tried += 1) await fail(tried);
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(NOTIFY_RETRIES.attempts);
    await fail(NOTIFY_RETRIES.attempts);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toMatchObject({ msg: 'notify_failed', jobId: 7 });
    warn.mockRestore();
    error.mockRestore();
  });

  it('NT-JOB a switch turned off after queueing, or a deleted booking, sends nothing', async () => {
    const off = fakePayload({ ...ALL_ON, mail: { enabled: false } });
    await expect(
      runNotifyJob(
        { event: booking, channel: 'mail' },
        { payload: off.payload, env: ENV, now: Date.now },
      ),
    ).resolves.toEqual({ status: 'skipped', reason: 'no_recipient' });
    expect(off.sendEmail).not.toHaveBeenCalled();
    const gone = fakePayload(ALL_ON, null);
    await expect(
      runNotifyJob(
        { event: booking, channel: 'mail' },
        { payload: gone.payload, env: ENV, now: Date.now },
      ),
    ).resolves.toEqual({ status: 'skipped', reason: 'no_recipient' });
    const sent = fakePayload(ALL_ON);
    await runNotifyJob(
      { event: booking, channel: 'mail' },
      { payload: sent.payload, env: ENV, now: Date.now },
    );
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('NT-BUDGET-JOB a budget alert goes by mail or Telegram only, never by SMS', async () => {
    const event: NotifyEvent = {
      type: 'budget',
      channel: 'mail',
      held: 4,
      since: BOOKING.createdAt,
      limit: 20,
    };
    expect(readyChannels(ALL_ON, ENV, event)).toEqual(['mail', 'telegram']);
    const { payload, sendEmail } = fakePayload(ALL_ON);
    await runNotifyJob({ event, channel: 'mail' }, { payload, env: ENV, now: Date.now });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'هشدار: سقف اعلان ایمیل پر شد' }),
    );
  });

  it('NT-SMS-ADMIN the Farapayamak scaffold fails loudly for a known admin; an unknown hash is skipped', async () => {
    const { payload } = fakePayload(ALL_ON);
    const deps = { payload, env: ENV, now: Date.now };
    await expect(
      runNotifyJob(
        {
          event: booking,
          channel: 'sms_admin',
          recipientHash: destinationHash('+989121111111', SECRET),
        },
        deps,
      ),
    ).rejects.toThrow('پیامک هنوز راه‌اندازی نشده است.');
    // Admin recipients are never capped: a second message reaches the provider call again.
    await expect(
      runNotifyJob(
        {
          event: booking,
          channel: 'sms_admin',
          recipientHash: destinationHash('+989121111111', SECRET),
        },
        deps,
      ),
    ).rejects.toThrow('پیامک هنوز راه‌اندازی نشده است.');
    await expect(
      runNotifyJob({ event: booking, channel: 'sms_admin', recipientHash: 'f'.repeat(64) }, deps),
    ).resolves.toEqual({ status: 'skipped', reason: 'no_recipient' });
  });
});
