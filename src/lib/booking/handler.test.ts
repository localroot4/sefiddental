import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { csrfFor, FORM_COOKIE, issueTimeToken } from '@/lib/formTokens';
import type { ClinicHours } from '@/lib/hoursState';
import { hoursState, QA_CLOCK_HEADER } from '@/lib/hoursState';
import { hashIp } from '@/lib/http/clientIp';
import { openFlash } from '@/lib/http/flash';
import { createLogger } from '@/lib/log/logger';
import type { NotifyEvent } from '@/lib/notify/types';

import {
  createBookingHandler,
  createEmergencyHandler,
  type BookingStore,
  type DuplicateEntry,
  type NewBooking,
} from './handler';
import type { Catalog } from './request';

// Test secrets only.
const K = 'k'.repeat(43);
const IP_SECRET = 'h'.repeat(48);
const SID = 'S'.repeat(43);
const TTL_S = 7200;
const NOW = Date.parse('2026-10-13T08:00:00Z'); // Tuesday 11:30 in Tehran: open
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  holidays: [{ date: '2026-10-20' as ClinicHours['holidays'][number]['date'] }],
  noteFa: '',
};
const CATALOG: Catalog = {
  services: new Map([['restoration', 11]]),
  tiers: new Map([['restoration', new Set(['vip'])]]),
  doctors: new Map(),
};
const PHONE = '09123456789';
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const E164 = '+989123456789';

/** A stored request of another phone, for seeding the store. */
const ROW: NewBooking = {
  kind: 'regular',
  status: 'new',
  flags: [],
  phone: '+989120000000',
  phoneNational: '09120000000',
  name: null,
  note: null,
  bookingGroup: null,
  service: null,
  serviceKey: null,
  tier: null,
  doctor: null,
  preferredTime: null,
  triage: null,
  formLocation: 'page',
  sourceUrl: null,
  utm: {},
  device: 'unknown',
  ipHash: null,
  callbackDueAt: null,
  createdAt: new Date(NOW).toISOString(),
};

interface Row extends Omit<NewBooking, 'status'> {
  id: number;
  status: NewBooking['status'] | 'contacted' | 'scheduled' | 'done' | 'cancelled' | 'spam';
  duplicateSubmissions: DuplicateEntry[];
}

function memoryStore(latencyMs = 0): BookingStore & { rows: Row[] } {
  const rows: Row[] = [];
  const at = (row: Row) => Date.parse(row.createdAt);
  // Async latency lets parallel requests interleave the way database calls do.
  const tick = () => (latencyMs ? new Promise((r) => setTimeout(r, latencyMs)) : undefined);
  return {
    rows,
    async recentClean(phone, kind, sinceMs) {
      await tick();
      return rows
        .filter(
          (r) =>
            r.phone === phone &&
            r.kind === kind &&
            r.status !== 'suspicious' &&
            r.status !== 'spam' &&
            at(r) >= sinceMs,
        )
        .sort((a, b) => at(b) - at(a))
        .map((r) => ({ id: r.id, createdAtMs: at(r), status: r.status }));
    },
    async countFromIp(ipHash, sinceMs, kind) {
      await tick();
      const ofKind = rows.filter((r) => kind === undefined || r.kind === kind);
      const appended = ofKind.flatMap((r) => r.duplicateSubmissions);
      return (
        ofKind.filter((r) => r.ipHash === ipHash && at(r) >= sinceMs).length +
        appended.filter((d) => d.ipHash === ipHash && Date.parse(d.at) >= sinceMs).length
      );
    },
    async create(row) {
      await tick();
      const stored = { ...row, id: rows.length + 1, duplicateSubmissions: [] };
      rows.push(stored);
      return { id: stored.id };
    },
    async appendDuplicate(id, entry, max) {
      await tick();
      const row = rows.find((r) => r.id === id);
      if (!row || row.duplicateSubmissions.length >= max) return false;
      row.duplicateSubmissions.push(entry);
      return true;
    },
  };
}

function setup(
  over: { trust?: boolean; qa?: boolean; emergencyEnabled?: boolean; latencyMs?: number } = {},
) {
  let now = NOW;
  const store = memoryStore(over.latencyMs);
  const notified: NotifyEvent[] = [];
  const counted: unknown[] = [];
  const lines: string[] = [];
  const base = createLogger(
    { logLevel: 'debug', gitSha: 'test', nodeEnv: 'test' },
    { write: (line: string) => void lines.push(line) },
  );
  // The objects as the handler hands them over, before the logger's own phone scrubbing.
  const raw: object[] = [];
  const logger = {
    child: (bindings: object) => {
      const child = base.child(bindings);
      const record = (level: 'info' | 'warn' | 'error') => (obj: object) => {
        raw.push({ ...bindings, ...obj });
        child[level](obj);
      };
      return { info: record('info'), warn: record('warn'), error: record('error') };
    },
  } as unknown as Pick<Logger, 'child'>;
  const notify = vi.fn(async (event: NotifyEvent) => void notified.push(event));
  const deps = {
    env: () => ({
      formTokenSecrets: [K],
      formTokenTtlSeconds: TTL_S,
      siteUrl: 'https://sefiddental.ir',
      ipHashSecret: IP_SECRET,
      trustProxyHeaders: over.trust ?? true,
      trustedProxyHops: 1,
      qaRoutes: over.qa ?? false,
    }),
    store,
    loadHours: vi.fn(async () => ({ hours: HOURS, options: { callbackMinutes: 10 } })),
    notify,
    countEvent: async (row: unknown) => void counted.push(row),
    logger,
    now: () => now,
  };
  const booking = createBookingHandler({ ...deps, catalog: async () => CATALOG });
  const emergency = createEmergencyHandler({
    ...deps,
    emergencyEnabled: async () => over.emergencyEnabled ?? true,
  });
  return {
    booking,
    emergency,
    store,
    notified,
    notify,
    counted,
    lines,
    raw,
    deps,
    advance: (ms: number) => (now += ms),
    now: () => now,
  };
}

interface Post {
  fields?: Record<string, string | string[]>;
  json?: boolean;
  ip?: string;
  tokenAgeMs?: number;
  tokens?: 'none' | 'forged';
  headers?: Record<string, string>;
  multipart?: boolean;
  path?: string;
}

function post(nowMs: number, options: Post = {}): Request {
  const fields: Record<string, string | string[]> = { phone: PHONE, ...options.fields };
  if (options.tokens !== 'none') {
    fields.csrf ??= options.tokens === 'forged' ? 'x'.repeat(43) : csrfFor(K, SID);
    fields.ts ??= issueTimeToken(K, SID, nowMs - (options.tokenAgeMs ?? 5000));
  }
  const entries = Object.entries(fields).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v) => [key, v] as [string, string]),
  );
  let body: BodyInit;
  if (options.multipart) {
    const data = new FormData();
    for (const [key, value] of entries) data.append(key, value);
    body = data;
  } else body = new URLSearchParams(entries);
  return new Request(`http://localhost:3000${options.path ?? '/api/booking'}`, {
    method: 'POST',
    body,
    headers: {
      cookie: `${FORM_COOKIE}=${SID}`,
      'x-request-id': 'req-test-0001',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Linux; Android 14) Mobile',
      ...(options.json === false ? {} : { accept: 'application/json' }),
      'x-forwarded-for': options.ip ?? '203.0.113.7',
      ...options.headers,
    },
  });
}

const flashOf = (res: Response) => {
  const value = /__Host-sefid-flash=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
  return value ? openFlash([K], value, NOW + 1000) : null;
};

describe('POST /api/booking handler', () => {
  it.each([
    ['BH-NORM1 Persian digits with spaces', '۰۹۱۲ ۳۴۵ ۶۷۸۹'],
    ['BH-NORM2 Arabic-Indic', '٠٩١٢٣٤٥٦٧٨٩'],
    ['BH-NORM3 +98', '+989123456789'],
    ['BH-NORM4 0098', '00989123456789'],
    ['BH-NORM5 10 digits starting with 9', '9123456789'],
  ])('%s stores E.164 and the national form', async (_id, phone) => {
    const t = setup();
    const res = await t.booking(post(NOW, { fields: { phone } }));
    expect(res.status).toBe(200);
    expect(t.store.rows[0]).toMatchObject({
      phone: E164,
      phoneNational: PHONE,
      status: 'new',
      kind: 'regular',
      flags: [],
      device: 'mobile',
    });
  });

  it('BH-LAND BH-EMPTY BH-INVALID BH-NOTE BH-NAME: 422 with codes, nothing stored', async () => {
    const t = setup();
    for (const [fields, errors] of [
      [{ phone: '02155101054' }, { phone: 'landline' }],
      [{ phone: '' }, { phone: 'empty' }],
      [{ phone: '0912345' }, { phone: 'invalid' }],
      [{ note: 'ن'.repeat(501) }, { note: 'too_long' }],
      [{ name: 'ن'.repeat(81) }, { name: 'too_long' }],
    ] as const) {
      const res = await t.booking(post(NOW, { fields }));
      expect(res.status).toBe(422);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ ok: false, errors });
    }
    expect(t.store.rows).toHaveLength(0);
    const ok = await t.booking(post(NOW, { fields: { note: 'ن'.repeat(500) } }));
    expect(ok.status).toBe(200);
  });

  it('BH-META bad metadata never fails the create; values dropped or capped', async () => {
    const t = setup();
    const res = await t.booking(
      post(NOW, {
        fields: {
          service_key: 'nope',
          tier: 'gold',
          dentist: 'x',
          location: 'evil',
          source_url: `/${'a'.repeat(500)}`,
          utm: `utm_source=${'s'.repeat(300)}`,
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(t.store.rows[0]).toMatchObject({
      serviceKey: null,
      service: null,
      tier: null,
      doctor: null,
      formLocation: 'page',
      utm: { source: 's'.repeat(100) },
    });
    expect(t.store.rows[0]?.sourceUrl).toHaveLength(300);
  });

  it('BH-HP honeypot: the same success body, row suspicious + honeypot, no notification', async () => {
    const t = setup();
    const real = await (await t.booking(post(NOW))).json();
    t.advance(DAY); // a new day, so the phone rules do not decide the second answer
    const trap = await t.booking(post(t.now(), { fields: { extra_7: 'Acme' }, ip: '203.0.113.8' }));
    expect(await trap.json()).toEqual(real);
    expect(t.store.rows[1]).toMatchObject({ status: 'suspicious', flags: ['honeypot'] });
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(1);
  });

  it('BH-FAST under 2 s is suspicious + too_fast with a success body; 2000 ms is new', async () => {
    const t = setup();
    const fast = await t.booking(post(NOW, { tokenAgeMs: 1999 }));
    expect((await fast.json()).state).toBe('success');
    expect(t.store.rows[0]).toMatchObject({ status: 'suspicious', flags: ['too_fast'] });
    await t.booking(post(NOW, { tokenAgeMs: 2000 }));
    expect(t.store.rows[1]).toMatchObject({ status: 'new', flags: [] });
  });

  it('BH-419 a token older than the TTL answers 419 and stores nothing', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { tokenAgeMs: TTL_S * 1000 + 1 }));
    expect(res.status).toBe(419);
    expect(await res.json()).toEqual({ ok: false, error: 'expired' });
    expect(t.store.rows).toHaveLength(0);
  });

  it('BH-MISSING no tokens: JSON answers like 419; HTML keeps the values on the page', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { tokens: 'none' }));
    expect(res.status).toBe(419);
    const html = await t.booking(
      post(NOW, { tokens: 'none', json: false, fields: { name: 'سارا', location: 'hero' } }),
    );
    expect(html.status).toBe(303);
    expect(html.headers.get('location')).toBe(encodeURI('/رزرو-نوبت'));
    expect(flashOf(html)).toMatchObject({
      form: 'booking',
      to: '/رزرو-نوبت',
      outcome: 'retry',
      values: { phone: PHONE, name: 'سارا', location: 'hero' },
    });
    expect(t.store.rows).toHaveLength(0);
  });

  it('BH-INVALID-TOKEN a forged token is stored suspicious + bad_token and answered success', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { tokens: 'forged' }));
    expect((await res.json()).state).toBe('success');
    expect(t.store.rows[0]).toMatchObject({ status: 'suspicious', flags: ['bad_token'] });
  });

  it('BH-ORIGIN a cross-site request answers 403 and stores nothing', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { headers: { 'sec-fetch-site': 'cross-site' } }));
    expect(res.status).toBe(403);
    const origin = await t.booking(
      post(NOW, { headers: { 'sec-fetch-site': '', origin: 'https://evil.example' } }),
    );
    expect(origin.status).toBe(403);
    expect(t.store.rows).toHaveLength(0);
  });

  it('BH-SIZE a body over 16 KiB answers 413', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { fields: { note: 'a'.repeat(17 * 1024) } }));
    expect(res.status).toBe(413);
    expect(t.store.rows).toHaveLength(0);
  });

  it('BH-MULTIPART the island body (FormData) parses like the native post', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { multipart: true, fields: { time_pref: 'any' } }));
    expect(res.status).toBe(200);
    expect(t.store.rows[0]).toMatchObject({ preferredTime: 'any', phone: E164 });
  });

  it('BH-DUP within 10 minutes appends; at 10:01 a new row', async () => {
    const t = setup();
    await t.booking(post(NOW, { fields: { name: 'اول' } }));
    t.advance(9 * 60_000 + 59_000);
    const dup = await t.booking(post(t.now(), { fields: { name: 'دوم', note: 'تازه' } }));
    expect(await dup.json()).toEqual({ ok: true, state: 'neutral', duplicate: true });
    expect(t.store.rows).toHaveLength(1);
    expect(t.store.rows[0]).toMatchObject({ name: 'اول', note: null });
    expect(t.store.rows[0]?.duplicateSubmissions).toEqual([
      expect.objectContaining({ name: 'دوم', note: 'تازه' }),
    ]);
    t.advance(2000);
    await t.booking(post(t.now()));
    expect(t.store.rows).toHaveLength(2);
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(2);
  });

  it('BH-PHONE3 three rows in 24 h, the 4th is neutral and appended; 24 h later the window frees', async () => {
    const t = setup();
    for (let i = 0; i < 3; i += 1) {
      expect((await (await t.booking(post(t.now()))).json()).state).toBe('success');
      t.advance(HOUR);
    }
    const fourth = await t.booking(post(t.now()));
    expect((await fourth.json()).state).toBe('neutral');
    expect(t.store.rows).toHaveLength(3);
    expect(t.store.rows[2]?.duplicateSubmissions).toHaveLength(1);
    // The first row turns 24 h old 1 ms after this point.
    t.advance(DAY - 3 * HOUR + 1);
    expect((await (await t.booking(post(t.now()))).json()).state).toBe('success');
    expect(t.store.rows).toHaveLength(4);
  });

  it('BH-PHONE-SUS suspicious rows count toward neither the limit nor the duplicate window', async () => {
    const t = setup();
    for (let i = 0; i < 4; i += 1) await t.booking(post(NOW, { fields: { extra_7: 'bot' } }));
    const res = await t.booking(post(NOW));
    expect((await res.json()).state).toBe('success');
    expect(t.store.rows.map((r) => r.status)).toEqual([
      'suspicious',
      'suspicious',
      'suspicious',
      'suspicious',
      'new',
    ]);
  });

  it('BH-IP10 ten an hour from one IP are new, the 11th on suspicious + ip_rate, each asks for the alert', async () => {
    const t = setup();
    for (let i = 0; i < 12; i += 1) {
      await t.booking(post(NOW, { fields: { phone: `0912000${String(i).padStart(4, '0')}` } }));
    }
    expect(t.store.rows.slice(0, 10).every((r) => r.status === 'new')).toBe(true);
    expect(t.store.rows[10]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
    expect(t.store.rows[11]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
    // The notifier sends one per hash per window (NT10).
    const spikes = t.notified.filter((e) => e.type === 'ip_spike');
    expect(spikes).toEqual(
      [11, 12].map((count) => ({
        type: 'ip_spike',
        ipHashPrefix: t.store.rows[0]?.ipHash?.slice(0, 8),
        count,
        requestId: 'req-test-0001',
      })),
    );
    // Another address has its own bucket.
    await t.booking(post(NOW, { ip: '198.51.100.9', fields: { phone: '09129990000' } }));
    expect(t.store.rows[12]?.status).toBe('new');
  });

  it('BH-IP-NULL an unknown client IP skips the per-IP rule and warns once per process', async () => {
    const t = setup({ trust: false });
    for (let i = 0; i < 12; i += 1) {
      await t.booking(post(NOW, { fields: { phone: `0912000${String(i).padStart(4, '0')}` } }));
    }
    await t.emergency(post(NOW, { path: '/api/emergency', fields: { triage: 'bleeding' } }));
    expect(t.store.rows.every((r) => r.status === 'new' && r.ipHash === null)).toBe(true);
    // Both handlers share the one warning.
    expect(t.lines.filter((l) => l.includes('form_ip_unknown'))).toHaveLength(1);
  });

  it('BH-IP-RACE parallel posts from one IP: ten new rows, the rest suspicious', async () => {
    const t = setup({ latencyMs: 2 });
    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        t.booking(post(NOW, { fields: { phone: `0912000${String(i).padStart(4, '0')}` } })),
      ),
    );
    expect(t.store.rows.filter((r) => r.status === 'new')).toHaveLength(10);
    expect(t.store.rows.filter((r) => r.flags.includes('ip_rate'))).toHaveLength(5);
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(10);
    expect(t.notified.filter((e) => e.type === 'ip_spike')).toHaveLength(5);
  });

  it('BH-IP-JUMP a count already past ten still asks for the spike alert', async () => {
    const t = setup();
    const ipHash = hashIp('203.0.113.7', IP_SECRET);
    // Rows another process wrote, so no request of this one ever read exactly ten.
    for (let i = 0; i < 12; i += 1) await t.store.create({ ...ROW, ipHash });
    await t.booking(post(NOW));
    expect(t.store.rows[12]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
    expect(t.notified).toEqual([
      expect.objectContaining({ type: 'ip_spike', ipHashPrefix: ipHash.slice(0, 8), count: 13 }),
    ]);
  });

  it('BH-APPEND-IP appended duplicates count toward the per-IP hour', async () => {
    const t = setup();
    for (let i = 0; i < 10; i += 1) await t.booking(post(NOW, { fields: { note: `n${i}` } }));
    expect(t.store.rows).toHaveLength(1);
    expect(t.store.rows[0]?.duplicateSubmissions).toHaveLength(9);
    expect(t.store.rows[0]?.duplicateSubmissions[0]?.ipHash).toBe(t.store.rows[0]?.ipHash);
    await t.booking(post(NOW, { fields: { note: 'n10' } }));
    expect(t.store.rows).toHaveLength(2);
    expect(t.store.rows[1]).toMatchObject({ status: 'suspicious', flags: ['ip_rate'] });
    expect(t.store.rows[0]?.duplicateSubmissions).toHaveLength(9);
    expect(t.notified.filter((e) => e.type === 'ip_spike')).toHaveLength(1);
  });

  it('BH-APPEND-CAP a row keeps 20 appended entries; later ones answer neutral and are logged', async () => {
    const t = setup();
    await t.booking(post(NOW));
    for (let i = 1; i <= 21; i += 1) {
      const res = await t.booking(post(NOW, { ip: `198.51.100.${i}`, fields: { note: `n${i}` } }));
      expect((await res.json()).state).toBe('neutral');
    }
    expect(t.store.rows).toHaveLength(1);
    expect(t.store.rows[0]?.duplicateSubmissions).toHaveLength(20);
    expect(t.lines.filter((l) => l.includes('form_append_capped'))).toHaveLength(1);
  });

  it('BH-OPEN a request is never appended to a closed row', async () => {
    const t = setup();
    // Within 10 minutes of a row staff already closed: a new row.
    await t.booking(post(t.now()));
    t.store.rows[0]!.status = 'done';
    expect((await (await t.booking(post(t.now()))).json()).state).toBe('success');
    expect(t.store.rows).toHaveLength(2);
    // The 4th in 24 h goes to the newest open row, never to a cancelled one.
    t.advance(HOUR);
    await t.booking(post(t.now()));
    t.store.rows[2]!.status = 'cancelled';
    t.advance(HOUR);
    expect((await (await t.booking(post(t.now()))).json()).state).toBe('neutral');
    expect(t.store.rows.map((r) => r.duplicateSubmissions.length)).toEqual([0, 1, 0]);
    // No open row left: a new row, notified.
    t.store.rows[1]!.status = 'done';
    expect((await (await t.booking(post(t.now()))).json()).state).toBe('success');
    expect(t.store.rows).toHaveLength(4);
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(4);
  });

  it('BH-HOURS-FAIL a failed hours read still stores the request: no callback time, success', async () => {
    const t = setup();
    t.deps.loadHours.mockRejectedValueOnce(new Error('clinic read failed'));
    const res = await t.booking(post(NOW));
    expect(await res.json()).toEqual({
      ok: true,
      state: 'success',
      callback: null,
      masked: '۰۹۱۲ ••• ۶۷۸۹',
    });
    expect(t.store.rows[0]).toMatchObject({ status: 'new', callbackDueAt: null });
    expect(t.notified).toHaveLength(1);
    expect(t.lines.some((l) => l.includes('form_hours_failed'))).toBe(true);
  });

  it('BH-CALLBACK the success callback equals hoursState at submit time in each state', async () => {
    for (const [iso, state] of [
      ['2026-10-13T05:00:00Z', 'before-open'],
      ['2026-10-13T08:00:00Z', 'open'],
      ['2026-10-13T16:10:00Z', 'closing-soon'],
      ['2026-10-13T17:00:00Z', 'closed'],
      ['2026-10-20T08:00:00Z', 'holiday'],
    ] as const) {
      const t = setup();
      const at = Date.parse(iso);
      t.advance(at - NOW);
      const expected = hoursState(new Date(at), HOURS, { callbackMinutes: 10 });
      expect(expected.state).toBe(state);
      const body = await (await t.booking(post(at))).json();
      expect(body.callback).toBe(expected.copy.callback);
    }
  });

  it('BH-QA-CLOCK the QA header moves the callback only with QA_ROUTES, never the token check', async () => {
    const closed = { [QA_CLOCK_HEADER]: '2026-10-13T17:00:00Z' };
    const qa = setup({ qa: true });
    const moved = await (await qa.booking(post(NOW, { headers: closed }))).json();
    expect(moved.callback).toBe(
      hoursState(new Date('2026-10-13T17:00:00Z'), HOURS, { callbackMinutes: 10 }).copy.callback,
    );
    // The stored callback time follows the same clock: the next opening plus 10 minutes.
    expect(qa.store.rows[0]).toMatchObject({
      status: 'new',
      callbackDueAt: '2026-10-14T06:40:00.000Z',
    });
    const off = setup({ qa: false });
    const kept = await (await off.booking(post(NOW, { headers: closed }))).json();
    expect(kept.callback).toBe(
      hoursState(new Date(NOW), HOURS, { callbackMinutes: 10 }).copy.callback,
    );
    expect(off.store.rows[0]?.callbackDueAt).toBe('2026-10-13T08:10:00.000Z');
  });

  it('BH-MASK the success body carries the masked number', async () => {
    const t = setup();
    expect((await (await t.booking(post(NOW))).json()).masked).toBe('۰۹۱۲ ••• ۶۷۸۹');
  });

  it('BH-HTML no-JS success: 303 to the success page with a flash, counted once on the server', async () => {
    const t = setup();
    const res = await t.booking(post(NOW, { json: false, fields: { location: 'block' } }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(encodeURI('/رزرو-نوبت/ثبت-شد'));
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(
      /^__Host-sefid-flash=[A-Za-z0-9_-]+; Path=\/; Max-Age=600; Secure; HttpOnly; SameSite=Lax$/,
    );
    expect(cookie).not.toContain('0912');
    expect(flashOf(res)).toMatchObject({ outcome: 'success', masked: '۰۹۱۲ ••• ۶۷۸۹' });
    expect(t.counted).toEqual([
      {
        date: '2026-10-13',
        event: 'booking_success',
        location: 'block',
        pageType: 'booking',
        serviceKey: 'none',
      },
    ]);
    // JSON answers leave counting to the island's beacon; suspicious ones are never counted.
    await t.booking(post(NOW, { fields: { phone: '09121112222' } }));
    await t.booking(post(NOW, { json: false, fields: { phone: '09121113333', extra_7: 'x' } }));
    expect(t.counted).toHaveLength(1);
  });

  it('BH-HTML-INVALID no-JS field errors: 303 to the form page with values and codes', async () => {
    const t = setup();
    const res = await t.booking(
      post(NOW, { json: false, fields: { phone: '021 5510 1054', note: 'ن'.repeat(501) } }),
    );
    expect(res.status).toBe(303);
    expect(flashOf(res)).toMatchObject({
      outcome: 'invalid',
      errors: { phone: 'landline', note: 'too_long' },
      values: { phone: '021 5510 1054', note: 'ن'.repeat(501) },
    });
  });

  it('BH-HTML-EXPIRED no-JS 419: the form page with the values and the old token to renew', async () => {
    const t = setup();
    const ts = issueTimeToken(K, SID, NOW - TTL_S * 1000 - 1);
    const res = await t.booking(post(NOW, { json: false, fields: { ts } }));
    expect(flashOf(res)).toMatchObject({
      outcome: 'expired',
      renewTs: ts,
      values: { phone: PHONE },
    });
    expect(t.store.rows).toHaveLength(0);
  });

  it('BH-RACE two simultaneous posts of one phone make one row and one appended entry', async () => {
    const t = setup();
    const answers = await Promise.all([t.booking(post(NOW)), t.booking(post(NOW))]);
    const states = await Promise.all(answers.map(async (r) => (await r.json()).state));
    expect(states.sort()).toEqual(['neutral', 'success']);
    expect(t.store.rows).toHaveLength(1);
    expect(t.store.rows[0]?.duplicateSubmissions).toHaveLength(1);
  });

  it('NT-PERSIST a notifier that throws: the row exists and the answer is success', async () => {
    const t = setup();
    t.notify.mockRejectedValueOnce(new Error('queue down'));
    const res = await t.booking(post(NOW));
    expect((await res.json()).state).toBe('success');
    expect(t.store.rows).toHaveLength(1);
    expect(t.lines.some((l) => l.includes('notify_failed'))).toBe(true);
  });

  it('NT-SUS suspicious rows and appended duplicates queue no booking notification', async () => {
    const t = setup();
    await t.booking(post(NOW, { fields: { extra_7: 'x' } }));
    await t.booking(post(NOW, { tokenAgeMs: 100 }));
    await t.booking(post(NOW));
    await t.booking(post(NOW));
    expect(t.notified).toEqual([{ type: 'booking', bookingId: 3, requestId: 'req-test-0001' }]);
  });

  it('BH-500 a store failure answers 500 with the request id and logs it', async () => {
    const t = setup();
    t.store.create = async () => {
      throw new Error(`db down for ${E164}`);
    };
    const res = await t.booking(post(NOW));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server', requestId: 'req-test-0001' });
    const line = t.lines.find((l) => l.includes('form_error')) ?? '';
    expect(line).toContain('req-test-0001');
    expect(line).not.toMatch(/912/);
  });

  it('BH-LOG every outcome logs the request id and never a phone, name or note', async () => {
    const t = setup();
    const name = 'نام‌آزمون';
    const note = 'یادداشت‌آزمون';
    const cases: Post[] = [
      {},
      {},
      { fields: { extra_7: 'x' } },
      { tokenAgeMs: 1 },
      { tokens: 'forged' },
      { tokens: 'none' },
      { tokenAgeMs: TTL_S * 1000 + 1 },
      { fields: { phone: '02155101054' } },
      { json: false },
      { headers: { 'sec-fetch-site': 'cross-site' } },
    ];
    for (const options of cases) {
      await t.booking(post(NOW, { ...options, fields: { name, note, ...options.fields } }));
    }
    await t.emergency(
      post(NOW, { path: '/api/emergency', fields: { name, note, triage: 'bleeding' } }),
    );
    expect(t.lines.length).toBeGreaterThanOrEqual(cases.length);
    // The raw objects too: the logger's own scrubbing must not be what keeps them clean.
    const handed = JSON.stringify(t.raw);
    expect(t.raw.length).toBe(t.lines.length);
    for (const text of ['9123456789', '۹۱۲۳۴۵۶۷۸۹', '۰۹۱۲', '2155101054', name, note]) {
      expect(handed).not.toContain(text);
    }
    for (const line of t.lines) {
      expect(line).toContain('req-test-0001');
      for (const digits of ['9123456789', '۹۱۲۳۴۵۶۷۸۹', '912 345', '2155101054', '۰۹۱۲']) {
        expect(line).not.toContain(digits);
      }
      expect(line).not.toContain(name);
      expect(line).not.toContain(note);
      expect(line).not.toContain('203.0.113.7');
    }
  });
});

describe('POST /api/emergency handler', () => {
  const em = (t: ReturnType<typeof setup>, options: Post = {}) =>
    t.emergency(
      post(t.now(), {
        path: '/api/emergency',
        ...options,
        fields: { triage: ['swelling', 'bleeding'], ...options.fields },
      }),
    );

  it('T-EM7 a valid post stores an emergency row, then notifies', async () => {
    const t = setup();
    const res = await em(t, { fields: { location: 'hero', service_key: 'restoration' } });
    expect((await res.json()).state).toBe('success');
    expect(t.store.rows[0]).toMatchObject({
      kind: 'emergency',
      status: 'new',
      triage: ['swelling', 'bleeding'],
      formLocation: 'emergency',
      serviceKey: null,
      tier: null,
    });
    expect(t.notified).toEqual([{ type: 'booking', bookingId: 1, requestId: 'req-test-0001' }]);
  });

  it('T-EM3 the server validates triage: none answers 422 required, nothing stored', async () => {
    const t = setup();
    const res = await em(t, { fields: { triage: [] } });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, errors: { triage: 'required' } });
    expect(t.store.rows).toHaveLength(0);
  });

  it('T-EM8 a repeat at +5 min and +23 h is appended to the first; at +24 h 1 min a new row', async () => {
    const t = setup();
    await em(t);
    t.advance(5 * 60_000);
    expect(await (await em(t, { fields: { triage: 'avulsion' } })).json()).toEqual({
      ok: true,
      state: 'neutral',
      duplicate: true,
    });
    t.advance(23 * HOUR - 5 * 60_000);
    expect((await (await em(t)).json()).state).toBe('neutral');
    expect(t.store.rows).toHaveLength(1);
    expect(t.store.rows[0]?.duplicateSubmissions.map((d) => d.triage)).toEqual([
      ['avulsion'],
      ['swelling', 'bleeding'],
    ]);
    t.advance(HOUR + 60_000);
    expect((await (await em(t)).json()).state).toBe('success');
    expect(t.store.rows).toHaveLength(2);
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(2);
  });

  it('T-EM9 the 4th emergency from one IP in 24 h is stored new + emergency_ip_rate', async () => {
    const t = setup();
    for (let i = 0; i < 4; i += 1) {
      await em(t, { fields: { phone: `0912000${String(i).padStart(4, '0')}` } });
      t.advance(HOUR);
    }
    expect(t.store.rows.map((r) => [r.status, r.flags])).toEqual([
      ['new', []],
      ['new', []],
      ['new', []],
      ['new', ['emergency_ip_rate']],
    ]);
  });

  it('T-EM9b the per-IP hour counts both kinds: the 11th request of either is suspicious', async () => {
    const t = setup();
    for (let i = 0; i < 6; i += 1) {
      await t.booking(post(t.now(), { fields: { phone: `0912000${String(i).padStart(4, '0')}` } }));
    }
    for (let i = 0; i < 4; i += 1) await em(t, { fields: { phone: `0912100000${i}` } });
    expect(t.store.rows.every((r) => r.status === 'new')).toBe(true);
    await em(t, { fields: { phone: '09121000009' } });
    expect(t.store.rows[10]).toMatchObject({ status: 'suspicious', kind: 'emergency' });
    expect(t.store.rows[10]?.flags).toContain('ip_rate');
  });

  it('T-EM-CLOSED a repeat after staff closed the emergency makes a new row and notifies', async () => {
    const t = setup();
    await em(t);
    t.store.rows[0]!.status = 'done';
    t.advance(8 * HOUR);
    expect((await (await em(t, { fields: { triage: 'avulsion' } })).json()).state).toBe('success');
    expect(t.store.rows.map((r) => [r.status, r.triage])).toEqual([
      ['done', ['swelling', 'bleeding']],
      ['new', ['avulsion']],
    ]);
    // A scheduled emergency is no longer at the top of the list: its repeat is a new row too.
    t.store.rows[1]!.status = 'scheduled';
    expect((await (await em(t)).json()).state).toBe('success');
    // The open row takes the next repeat.
    expect((await (await em(t)).json()).state).toBe('neutral');
    expect(t.store.rows.map((r) => r.duplicateSubmissions.length)).toEqual([0, 0, 1]);
    expect(t.notified.filter((e) => e.type === 'booking')).toHaveLength(3);
  });

  it('BH-FLASH-SIZE the flash keeps known triage values only; the cookie stays under 4 KB', async () => {
    const t = setup();
    const junk = Array.from({ length: 5 }, (_, i) => String(i).repeat(2500));
    const res = await em(t, {
      json: false,
      fields: { phone: '0912', triage: [...junk, 'bleeding'] },
    });
    expect(res.status).toBe(303);
    expect((res.headers.get('set-cookie') ?? '').length).toBeLessThan(4096);
    expect(flashOf(res)).toMatchObject({ outcome: 'invalid', triage: ['bleeding'] });
  });

  it('T-EM10 honeypot and a submit under 2 s: success answer, suspicious rows', async () => {
    const t = setup();
    expect((await (await em(t, { fields: { extra_7: 'x' } })).json()).state).toBe('success');
    expect((await (await em(t, { tokenAgeMs: 500 })).json()).state).toBe('success');
    expect(t.store.rows.map((r) => [r.status, r.flags])).toEqual([
      ['suspicious', ['honeypot']],
      ['suspicious', ['too_fast']],
    ]);
    expect(t.notified).toHaveLength(0);
  });

  it('T-EM11 expired answers 419; a bad Origin 403; nothing stored', async () => {
    const t = setup();
    expect((await em(t, { tokenAgeMs: TTL_S * 1000 + 1 })).status).toBe(419);
    expect((await em(t, { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    expect(t.store.rows).toHaveLength(0);
  });

  it('T-EM-OFF features.emergencyEnabled false answers 404 and stores nothing', async () => {
    const t = setup({ emergencyEnabled: false });
    const res = await em(t);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(t.store.rows).toHaveLength(0);
  });

  it('T-EM-HTML no-JS: success flash on /اورژانس, counted once as emergency_submit', async () => {
    const t = setup();
    const res = await em(t, { json: false });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(encodeURI('/اورژانس'));
    expect(flashOf(res)).toMatchObject({ form: 'emergency', to: '/اورژانس', outcome: 'success' });
    const repeat = await em(t, { json: false, fields: { note: 'بدتر شد' } });
    expect(flashOf(repeat)).toMatchObject({
      outcome: 'neutral',
      triage: ['swelling', 'bleeding'],
      values: { note: 'بدتر شد' },
    });
    expect(t.counted).toEqual([
      {
        date: '2026-10-13',
        event: 'emergency_submit',
        location: 'none',
        pageType: 'emergency',
        serviceKey: 'none',
      },
    ]);
  });
});
