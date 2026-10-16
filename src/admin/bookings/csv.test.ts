import { describe, expect, it } from 'vitest';

import { Bookings } from '@/collections/Bookings';

import { bookingsCsv, csvCell, toCsv } from './csv';

const fields = Bookings.fields as never;

describe('booking CSV (admin-notify.md 4.8)', () => {
  it('CSV1 RFC 4180 quoting, the formula guard, BOM first and CRLF line ends', () => {
    expect(csvCell('a "b", c\nd')).toBe('"a ""b"", c\nd"');
    for (const risky of ['=SUM(A1)', '+98912', '-1', '@cmd', '\tx', '\rx']) {
      expect(csvCell(risky)).toBe(`"'${risky}"`);
    }
    expect(csvCell('۰۹۱۲')).toBe('"۰۹۱۲"');
    expect(csvCell(null)).toBe('""');
    const file = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(file.startsWith('\uFEFF"a","b"\r\n"c","d"')).toBe(true);
    expect(file.endsWith('\r\n')).toBe(true);
  });

  it('CSV2 Persian headers in order, spaced national phone, Tehran Jalali time, labels; no hash, notes or rank', () => {
    const doc = {
      id: 42,
      createdAt: '2026-10-15T06:42:00.000Z', // 10:12 in Tehran, 23 Mehr 1405
      kind: 'emergency',
      status: 'new',
      phone: '+989123456789',
      phoneNational: '09123456789',
      name: '=HYPERLINK("x")',
      bookingGroup: null,
      service: { id: 3, navLabel: 'ایمپلنت' },
      handledBy: { id: 1, name: 'مدیر آزمون' },
      triage: ['swelling', 'broken'],
      flags: ['manual'],
      heardFrom: 'instagram',
      formLocation: 'dialog',
      utm: { source: 'ig' },
      ipHash: 'f'.repeat(64),
      listTitle: 'نام · ۰۹۱۲ ••• ۶۷۸۹',
      urgencyRank: 0,
      adminNotes: [{ text: 'یادداشت‌محرمانه' }],
      duplicateSubmissions: [{}, {}],
    };
    const [head, row] = bookingsCsv([doc], fields).slice(1).split('\r\n');
    const headers = head!.split(',').map((h) => h.slice(1, -1));
    expect(headers.slice(0, 7)).toEqual([
      'شمارهٔ درخواست',
      'زمان ثبت (UTC)',
      'زمان ثبت (تهران)',
      'نوع',
      'وضعیت',
      'موبایل',
      'نام',
    ]);
    expect(headers).toContain('utm_source');
    expect(headers.at(-1)).toBe('تعداد تکرار');
    const cells = Object.fromEntries(headers.map((h, i) => [h, row!.split('","')[i]]));
    expect(cells['زمان ثبت (تهران)']).toBe('1405/07/23 10:12');
    expect(cells['نوع']).toBe('فوری');
    // Spaced, so spreadsheet apps keep the leading 0 (a bare 0912… becomes a number).
    expect(cells['موبایل']).toBe('0912 345 6789');
    expect(cells['نام']).toBe(`'=HYPERLINK(""x"")`);
    expect(cells['خدمت']).toBe('ایمپلنت');
    expect(cells['نشانه‌ها']).toBe('ورم لثه یا صورت، دندان شکسته یا ضربه به دندان');
    expect(cells['محل فرم']).toBe('پنجرهٔ رزرو');
    expect(cells['پیگیری‌کننده']).toBe('مدیر آزمون');
    expect(cells['utm_source']).toBe('ig');
    expect(row!.endsWith('"2"')).toBe(true);
    for (const secret of ['f'.repeat(64), 'یادداشت‌محرمانه', '•••', '+989']) {
      expect(row).not.toContain(secret);
    }
  });
});
