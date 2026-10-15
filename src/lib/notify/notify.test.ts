import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

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

  it('NT10 a spike alert goes out once per hash per window; mail and Telegram only', async () => {
    const t = notifierFor(ALL_ON);
    const spike: NotifyEvent = { type: 'ip_spike', ipHashPrefix: 'abcd1234', count: 11 };
    await t.notifier.notify(spike);
    await t.notifier.notify({ ...spike, count: 12 });
    expect(t.queued.map((i) => i.channel)).toEqual(['mail', 'telegram']);
    t.advance(60 * 60_000);
    await t.notifier.notify(spike);
    await t.notifier.notify({ ...spike, ipHashPrefix: 'ffff0000' });
    expect(t.queued).toHaveLength(6);
    expect(t.lines.filter((l) => l.includes('notify_deduped'))).toHaveLength(1);
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
      { type: 'ip_spike', ipHashPrefix: 'abcd1234', count: 11 },
      ENV.siteUrl,
    );
    expect(spike.text).not.toContain('abcd1234');
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
