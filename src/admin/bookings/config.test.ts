import type { Field } from 'payload';
import { describe, expect, it } from 'vitest';

import { Bookings } from '@/collections/Bookings';
import { ADMIN_MESSAGES } from '@/i18n/fa-admin';

import { tehranDayStart, tehranMonthStart } from './counts';

const top = (
  Bookings.fields as Array<Field & { name?: string; admin?: Record<string, unknown> }>
).filter((f) => f.name);
const field = (name: string) => top.find((f) => f.name === name);

describe('bookings admin config (freeze G15, admin-notify.md 4 and 8)', () => {
  it('BK7 the bulk editor offers the status only', () => {
    for (const f of top) {
      expect(Boolean(f.admin?.disableBulkEdit), f.name).toBe(f.name !== 'status');
    }
  });

  it('BK9 urgency order, list columns, slots, the CSV endpoint and no filter on free text or hashes', () => {
    expect(Bookings.defaultSort).toEqual(['urgencyRank', '-createdAt']);
    expect(Bookings.admin?.defaultColumns).toEqual([
      'listTitle',
      'contact',
      'kind',
      'status',
      'callbackDueAt',
      'bookingGroup',
      'receivedAt',
      'flags',
      'rowActions',
    ]);
    expect(Bookings.admin?.components?.beforeListTable).toEqual([
      '/admin/bookings/BookingTabs#BookingTabs',
      '/admin/bookings/BulkSpam#BulkSpam',
    ]);
    expect(Bookings.endpoints).toEqual([
      expect.objectContaining({ path: '/export', method: 'get' }),
    ]);
    for (const name of [
      'listTitle',
      'phone',
      'urgencyRank',
      'ipHash',
      'note',
      'sourceUrl',
      'utm',
      'adminNotes',
      'duplicateSubmissions',
    ]) {
      expect(field(name)?.admin?.disableListFilter, name).toBe(true);
    }
    for (const name of ['status', 'kind', 'heardFrom', 'formLocation', 'callbackDueAt', 'flags']) {
      expect(field(name)?.admin?.disableListFilter, name).toBeUndefined();
    }
    expect(field('heardFrom')?.admin?.position).toBe('sidebar');
  });

  it('BK12 the record opens with the call, the status and the callback due, on phones too', () => {
    // Payload puts sidebar fields after all main fields under 1024 px, so these are main fields.
    expect(top.slice(0, 3).map((f) => f.name)).toEqual(['contact', 'status', 'callbackDueAt']);
    // Payload's default "MMM d, yyy h:mm a" cuts the Persian month with a tatweel (confirm pass).
    expect(top[2]).toMatchObject({ admin: { date: { displayFormat: 'd MMMM yyyy، HH:mm' } } });
    for (const f of top.slice(0, 3)) expect(f.admin?.position, f.name).toBeUndefined();
  });

  it('BK13 an empty duplicates list says so inside its own block, not as a loose field', () => {
    // A ui Field gets no field wrapper, so its line lands in the gap before the next field.
    expect(field('duplicateSubmissions')?.admin?.components).toEqual({
      afterInput: ['/admin/bookings/duplicates#DuplicatesEmpty'],
    });
    expect(field('duplicatesEmpty')).toBeUndefined();
  });

  it('BK10 Persian labels: form locations, every duplicate subfield, the help texts', () => {
    const location = field('formLocation') as unknown as {
      label: string;
      options: Array<{ label: string }>;
    };
    expect(location.label).toBe('محل فرم');
    expect(location.options.map((o) => o.label)).not.toContain('hero');
    // The block form also sits on service and dentist pages, not only the home page.
    expect(location.options.map((o) => o.label)).toContain('فرم پایین صفحه');
    const duplicates = field('duplicateSubmissions') as unknown as {
      fields: Array<{ name: string; label?: string; access?: unknown }>;
      admin: { description: string };
    };
    expect(duplicates.admin.description).toBe(ADMIN_MESSAGES['admin.duplicates.help']);
    for (const sub of duplicates.fields) expect(sub.label, sub.name).toMatch(/[آ-ی]/);
    expect(duplicates.fields.find((f) => f.name === 'ipHash')?.access).toBeDefined();
  });

  it('DW1 "today" and "this month" start at Tehran midnight (UTC+3:30), whatever the server zone', () => {
    expect(tehranDayStart(new Date('2026-10-15T20:31:00Z')).toISOString()).toBe(
      '2026-10-15T20:30:00.000Z',
    );
    expect(tehranDayStart(new Date('2026-10-15T20:29:00Z')).toISOString()).toBe(
      '2026-10-14T20:30:00.000Z',
    );
    // 1 Mehr 1405 is 23 September 2026; 20:29 UTC on the 22nd is still 31 Shahrivar in Tehran.
    expect(tehranMonthStart(new Date('2026-10-15T08:00:00Z')).toISOString()).toBe(
      '2026-09-22T20:30:00.000Z',
    );
    expect(tehranMonthStart(new Date('2026-09-22T20:30:00Z')).toISOString()).toBe(
      '2026-09-22T20:30:00.000Z',
    );
    expect(tehranMonthStart(new Date('2026-09-22T20:29:00Z')).toISOString()).toBe(
      '2026-08-22T20:30:00.000Z',
    );
  });
});
