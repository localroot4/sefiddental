import { describe, expect, it } from 'vitest';

import {
  formValues,
  parseBookingRequest,
  parseEmergencyRequest,
  type Catalog,
  type FormInput,
} from './request';

// Published catalog of the tests: restoration has its three tiers, implant none.
const CATALOG: Catalog = {
  services: new Map<string, number>([
    ['restoration', 11],
    ['implant', 12],
  ]),
  tiers: new Map([['restoration', new Set(['standard', 'vip', 'cip'])]]),
  doctors: new Map([['دکتر-آزمون', 7]]),
};

const form = (entries: Record<string, string | string[]>): FormInput => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return formValues(data);
};

const booking = (entries: Record<string, string | string[]>) =>
  parseBookingRequest(form({ phone: '09123456789', ...entries }), CATALOG);
const emergency = (entries: Record<string, string | string[]>) =>
  parseEmergencyRequest(form({ phone: '09123456789', triage: 'swelling', ...entries }));

const data = <T>(result: { ok: true; data: T } | { ok: false }) => {
  if (!result.ok) throw new Error('expected a valid request');
  return result.data;
};

describe('booking request schema (booking-pipeline 5.2, 5.3)', () => {
  it.each([
    ['RQ1 Persian digits with spaces', '۰۹۱۲ ۳۴۵ ۶۷۸۹'],
    ['RQ2 Arabic-Indic digits', '٠٩١٢٣٤٥٦٧٨٩'],
    ['RQ3 +98', '+989123456789'],
    ['RQ4 0098', '00989123456789'],
    ['RQ5 10 digits without the leading zero', '9123456789'],
    ['RQ6 Persian 10 digits', '۹۱۲۳۴۵۶۷۸۹'],
    ['RQ7 a label and dashes', 'موبایل: 0912-345-6789'],
  ])('%s normalizes to E.164 and the national form', (_id, phone) => {
    expect(data(booking({ phone }))).toMatchObject({
      phone: '+989123456789',
      phoneNational: '09123456789',
    });
  });

  it('RQ8 empty, invalid and landline phones fail with their code', () => {
    const errors = (phone: string) => {
      const result = booking({ phone });
      return result.ok ? null : result.errors;
    };
    expect(errors('')).toEqual({ phone: 'empty' });
    expect(errors('   ')).toEqual({ phone: 'empty' });
    expect(errors('0912345678')).toEqual({ phone: 'invalid' });
    expect(errors('02155101054')).toEqual({ phone: 'landline' });
    expect(errors('55101054')).toEqual({ phone: 'landline' });
    expect(errors(`0912345678${'9'.repeat(60)}`)).toEqual({ phone: 'invalid' });
    // A missing field is an empty phone, not a crash.
    expect(parseBookingRequest(formValues(new FormData()), CATALOG)).toEqual({
      ok: false,
      errors: { phone: 'empty' },
    });
  });

  it('RQ9 note: 500 characters pass, 501 fail; CRLF counts as one character like the client', () => {
    expect(data(booking({ note: 'ن'.repeat(500) })).note).toHaveLength(500);
    expect(booking({ note: 'ن'.repeat(501) })).toEqual({
      ok: false,
      errors: { note: 'too_long' },
    });
    // A browser submits a textarea's line breaks as CRLF; the counter saw one character each.
    const lines = `${'ن'.repeat(249)}\r\n${'ن'.repeat(250)}`; // 501 code units, 500 characters
    expect(data(booking({ note: lines })).note).toBe(lines.replace('\r\n', '\n'));
    expect(data(booking({ note: '   ' })).note).toBeNull();
  });

  it('RQ10 name: Arabic letters normalized, ZWNJ kept, blank is null, over 80 fails', () => {
    expect(data(booking({ name: '  علي  كريمي ' })).name).toBe('علی کریمی');
    expect(data(booking({ name: 'می‌خواهم' })).name).toBe('می‌خواهم');
    expect(data(booking({ name: '  ' })).name).toBeNull();
    expect(data(booking({ name: 'ن'.repeat(80) })).name).toHaveLength(80);
    expect(booking({ name: 'ن'.repeat(81) })).toEqual({ ok: false, errors: { name: 'too_long' } });
  });

  it('RQ17 the note limit applies to the normalized text that is stored', () => {
    // One presentation-form ligature normalizes to three characters.
    expect(booking({ note: '\uFC5E'.repeat(200) })).toEqual({
      ok: false,
      errors: { note: 'too_long' },
    });
    // Space runs collapse before the count.
    expect(data(booking({ note: `${'ن'.repeat(250)}${' '.repeat(300)}ن` })).note).toHaveLength(252);
  });

  it('RQ18 control characters never reach the stored name or note', () => {
    expect(data(booking({ name: 'سا\u0000را\n کریمی\t' })).name).toBe('سارا کریمی');
    expect(data(booking({ note: 'درد\u0000 دارم\u0007\nامروز\u001F' })).note).toBe(
      'درد دارم\nامروز',
    );
    expect(data(emergency({ name: '\u0000', note: '\u0008' }))).toMatchObject({
      name: null,
      note: null,
    });
  });

  it('RQ11 several field errors are reported together', () => {
    expect(booking({ phone: '', name: 'ن'.repeat(81), note: 'ن'.repeat(501) })).toEqual({
      ok: false,
      errors: { phone: 'empty', name: 'too_long', note: 'too_long' },
    });
  });

  it('RQ12 chips and catalog fields keep known values', () => {
    expect(
      data(
        booking({
          service: 'restore',
          service_key: 'restoration',
          tier: 'vip',
          dentist: 'دکتر-آزمون',
          time_pref: 'evening',
          location: 'hero',
        }),
      ),
    ).toMatchObject({
      bookingGroup: 'restore',
      serviceKey: 'restoration',
      serviceId: 11,
      tier: 'vip',
      doctorId: 7,
      preferredTime: 'evening',
      formLocation: 'hero',
    });
  });

  it('RQ13 unknown or malformed metadata is dropped, never an error (BH-META)', () => {
    const result = data(
      booking({
        service: 'teeth',
        service_key: 'Restoration!',
        tier: 'gold',
        dentist: 'دکتر-ناشناس',
        time_pref: 'night',
        location: 'emergency',
      }),
    );
    expect(result).toMatchObject({
      bookingGroup: null,
      serviceKey: null,
      serviceId: null,
      tier: null,
      doctorId: null,
      preferredTime: null,
      formLocation: 'page',
    });
    // A well-formed key that is not published is dropped too.
    expect(data(booking({ service_key: 'whitening' })).serviceKey).toBeNull();
  });

  it('RQ14 a tier must belong to the service; without a service any published tier passes', () => {
    expect(data(booking({ service_key: 'implant', tier: 'vip' })).tier).toBeNull();
    expect(data(booking({ service_key: 'restoration', tier: 'cip' })).tier).toBe('cip');
    expect(data(booking({ tier: 'standard' })).tier).toBe('standard');
    expect(data(booking({ tier: 'x'.repeat(31) })).tier).toBeNull();
  });

  it('RQ15 source_url keeps a decoded path only, capped at 300; anything else is null', () => {
    const path = (source_url: string) => data(booking({ source_url })).sourceUrl;
    expect(path(encodeURI('/خدمات/ترمیم-دندان'))).toBe('/خدمات/ترمیم-دندان');
    expect(path('/?utm_source=x#top')).toBe('/');
    expect(path(`/${'a'.repeat(400)}`)).toHaveLength(300);
    expect(path('https://evil.example/')).toBeNull();
    expect(path('//evil.example/')).toBeNull();
    expect(path('/%E0%A4%A')).toBeNull();
    expect(path('')).toBeNull();
  });

  it('RQ16 utm keeps the five known keys, each capped at 100', () => {
    const utm = data(
      booking({
        utm: `utm_source=gbp&utm_medium=${'m'.repeat(150)}&utm_campaign=%D8%B3%D9%81%DB%8C%D8%AF&utm_id=9&ref=x`,
      }),
    ).utm;
    expect(utm).toEqual({ source: 'gbp', medium: 'm'.repeat(100), campaign: 'سفید' });
    expect(data(booking({})).utm).toEqual({});
  });
});

describe('emergency request schema (emergency.md 6.3, T-EM3)', () => {
  it('T-EM3a triage: empty or only unknown values fail with required', () => {
    expect(emergency({ triage: [] })).toEqual({ ok: false, errors: { triage: 'required' } });
    expect(emergency({ triage: ['toothache', ''] })).toEqual({
      ok: false,
      errors: { triage: 'required' },
    });
  });

  it('T-EM3b triage: duplicates merged, unknown dropped, catalog order, five at most', () => {
    expect(data(emergency({ triage: ['bleeding', 'swelling', 'bleeding', 'x'] })).triage).toEqual([
      'swelling',
      'bleeding',
    ]);
    const all = ['bleeding', 'avulsion', 'broken', 'swelling', 'severe_pain'];
    expect(data(emergency({ triage: [...all, ...all] })).triage).toEqual([
      'severe_pain',
      'swelling',
      'broken',
      'avulsion',
      'bleeding',
    ]);
  });

  it('T-EM3c phone rules equal booking: Persian with spaces, +98, 0098, 10 digits, 0920, 099x', () => {
    for (const phone of ['۰۹۱۲ ۳۴۵ ۶۷۸۹', '+989123456789', '00989123456789', '9123456789']) {
      expect(data(emergency({ phone })).phone).toBe('+989123456789');
    }
    expect(data(emergency({ phone: '09201234567' })).phone).toBe('+989201234567');
    expect(data(emergency({ phone: '09991234567' })).phone).toBe('+989991234567');
    expect(emergency({ phone: '02155101054' })).toEqual({
      ok: false,
      errors: { phone: 'landline' },
    });
  });

  it('T-EM3d note 500 and 501, name 80 and 81; errors combine with triage', () => {
    expect(data(emergency({ note: 'ن'.repeat(500), name: 'ن'.repeat(80) }))).toMatchObject({
      note: 'ن'.repeat(500),
      name: 'ن'.repeat(80),
    });
    expect(emergency({ triage: [], note: 'ن'.repeat(501), name: 'ن'.repeat(81) })).toEqual({
      ok: false,
      errors: { triage: 'required', note: 'too_long', name: 'too_long' },
    });
  });

  it('T-EM3e the request never carries booking-only fields', () => {
    const result = data(emergency({ service_key: 'restoration', tier: 'vip', time_pref: 'any' }));
    expect(Object.keys(result).sort()).toEqual(
      ['name', 'note', 'phone', 'phoneNational', 'sourceUrl', 'triage', 'utm'].sort(),
    );
  });
});
