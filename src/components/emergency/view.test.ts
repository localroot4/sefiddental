import { describe, expect, it } from 'vitest';

import { hoursState, type ClinicHours } from '@/lib/hoursState';
import type { Flash } from '@/lib/http/flash';

import { emergencyView, initialFromFlash } from './view';

const EVERY_DAY = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [{ days: [...EVERY_DAY], open: '10:00', close: '20:00' }],
  holidays: [],
  noteFa: '',
};
// Tehran is UTC+3:30: 08:00Z is 11:30, 16:15Z is 19:45, 05:00Z is 08:30, 17:00Z is 20:30.
const at = (iso: string, hours: ClinicHours = HOURS) => hoursState(new Date(iso), hours);
const OPEN = at('2026-10-14T08:00:00Z');
const CLOSING = at('2026-10-14T16:15:00Z');
const BEFORE = at('2026-10-14T05:00:00Z');
const CLOSED = at('2026-10-14T17:00:00Z');
const HOLIDAY = at('2026-10-14T08:00:00Z', {
  ...HOURS,
  holidays: [{ date: '2026-10-14' as never }],
});
const NO_DAY = at('2026-10-14T17:00:00Z', { ...HOURS, weekly: [] });

describe('emergency page order per hours state (conversion.md 7.1, EM-D1)', () => {
  it('T-EM1 open: call first, the full lead, no line above the button, call on avulsion', () => {
    expect(OPEN.state).toBe('open');
    expect(emergencyView(OPEN, false)).toEqual({
      callFirst: true,
      lead: 'emergency.lead.open',
      aboveSubmit: null,
      avulsion: 'call',
    });
  });

  it('T-EM1 closing soon: call first, the cut lead, the next-day callback above the button', () => {
    expect(CLOSING.state).toBe('closing-soon');
    const view = emergencyView(CLOSING, true);
    expect(view).toMatchObject({ callFirst: true, lead: 'emergency.lead.closingSoon' });
    expect(view.avulsion).toBe('call');
    // Closed for promises: the plain callback line, never the priority clause (H25).
    expect(view.aboveSubmit).toBe('پذیرش فردا از ساعت ۱۰ با شما تماس می‌گیرد.');
  });

  it.each([
    ['before-open', BEFORE],
    ['closed', CLOSED],
    ['holiday', HOLIDAY],
  ])(
    'T-EM1 %s: safety first, the closed lead, no call button, the closed avulsion text',
    (s, h) => {
      expect(h.state).toBe(s);
      expect(emergencyView(h, false)).toMatchObject({
        callFirst: false,
        lead: 'emergency.lead.closed',
        avulsion: 'closed',
      });
    },
  );

  it('T-EM2 the priority promise only once the clinic confirmed it (gap 19, EM-F9)', () => {
    expect(emergencyView(BEFORE, false).aboveSubmit).toBe(BEFORE.copy.callback);
    expect(emergencyView(BEFORE, true).aboveSubmit).toBe(
      'پذیرش امروز از ساعت ۱۰، پیش از بقیهٔ درخواست‌ها، با شما تماس می‌گیرد.',
    );
    expect(emergencyView(CLOSED, false).aboveSubmit).toBe(CLOSED.copy.callback);
    expect(emergencyView(CLOSED, true).aboveSubmit).toContain('فردا از ساعت ۱۰، پیش از');
    expect(emergencyView(HOLIDAY, false).aboveSubmit).toMatch(/^امروز تعطیل رسمی است\. /);
    expect(emergencyView(HOLIDAY, true).aboveSubmit).toContain('پیش از بقیهٔ');
    // No working day ahead: the noWorkingDay line, with or without the confirmation.
    expect(emergencyView(NO_DAY, true).aboveSubmit).toBe(NO_DAY.copy.callback);
    expect(NO_DAY.copy.callback).toContain('اولین روز کاری');
  });
});

describe('the form state from the no-JS flash (freeze G3)', () => {
  const flash = (over: Partial<Flash>): Flash => ({
    form: 'emergency',
    to: '/اورژانس',
    outcome: 'invalid',
    at: 0,
    ...over,
  });

  it('T-EM18b a direct GET or another form flash shows the empty form, never a success', () => {
    for (const f of [null, flash({ form: 'booking', outcome: 'success', masked: 'x' })]) {
      expect(initialFromFlash(f)).toMatchObject({ done: null, notice: null, errors: {} });
    }
  });

  it('T-EM18c success carries the server line and the masked number', () => {
    expect(
      initialFromFlash(flash({ outcome: 'success', callback: 'پذیرش', masked: '۰۹۱۲ *** ۶۷۸۹' })),
    ).toMatchObject({ done: { callback: 'پذیرش', masked: '۰۹۱۲ *** ۶۷۸۹' } });
    expect(initialFromFlash(flash({ outcome: 'success' })).done).toEqual({
      callback: null,
      masked: '',
    });
  });

  it('T-EM15b invalid keeps the values, the boxes and the codes; other outcomes are notices', () => {
    const values = { phone: '021 5510 1054', name: 'نمونه', note: 'درد' };
    expect(
      initialFromFlash(
        flash({ values, triage: ['avulsion'], errors: { phone: 'landline', triage: 'required' } }),
      ),
    ).toEqual({
      values,
      triage: ['avulsion'],
      errors: { phone: 'landline', triage: 'required' },
      notice: null,
      done: null,
    });
    for (const outcome of ['neutral', 'retry', 'expired', 'server'] as const) {
      expect(initialFromFlash(flash({ outcome, values, errors: { phone: 'x' } }))).toMatchObject({
        values,
        errors: {},
        notice: outcome,
      });
    }
  });
});
