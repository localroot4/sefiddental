import type {
  ArrayFieldServerProps,
  DefaultServerCellComponentProps,
  Payload,
  UIFieldServerProps,
} from 'payload';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BookingsToday, BookingsTodayBody } from '@/admin/components/BookingsToday';

import { ContactCell, ContactField } from './contact';
import { DuplicatesEmpty } from './duplicates';
import { bulkSpamMessage, dayTime, errorMessage, isOverdue } from './format';

const cell = (rowData: object) => ({ rowData }) as unknown as DefaultServerCellComponentProps;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ');

describe('booking list cells and blocks (admin-notify.md 4.1, 4.2)', () => {
  it('CT1 call and WhatsApp to the patient; labels name the masked number only', () => {
    const html = renderToStaticMarkup(<ContactCell {...cell({ phone: '+989123456789' })} />);
    expect(html).toContain('href="tel:+989123456789"');
    expect(html).toContain('href="https://wa.me/989123456789"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="تماس با بیمار ۰۹۱۲ *** ۶۷۸۹"');
    expect(text(html)).not.toMatch(/[0-9۰-۹]/);
    // A number that is not a valid Iranian mobile gets no link at all.
    expect(renderToStaticMarkup(<ContactCell {...cell({ phone: '+982112345678' })} />)).toBe('');
    // In the edit view a UI field's Cell runs without a row.
    expect(renderToStaticMarkup(<ContactCell {...cell(undefined as never)} />)).toBe('');
  });

  it('CT3 no WhatsApp link to a suspicious or spam request; the call link stays', () => {
    for (const status of ['suspicious', 'spam']) {
      const html = renderToStaticMarkup(
        <ContactCell {...cell({ phone: '+989123456789', status })} />,
      );
      expect(html, status).toContain('href="tel:+989123456789"');
      expect(html, status).not.toContain('wa.me');
    }
    const restored = { data: { phone: '+989123456789', status: 'new' } };
    expect(
      renderToStaticMarkup(<ContactField {...(restored as unknown as UIFieldServerProps)} />),
    ).toContain('wa.me');
    const spam = { data: { phone: '+989123456789', status: 'spam' } };
    expect(
      renderToStaticMarkup(<ContactField {...(spam as unknown as UIFieldServerProps)} />),
    ).not.toContain('wa.me');
  });

  it('CT2 the record block shows the number in an LTR island, then the two links', () => {
    const props = { data: { phone: '+989123456789' } } as unknown as UIFieldServerProps;
    const html = renderToStaticMarkup(<ContactField {...props} />);
    expect(html).toMatch(/<bdi dir="ltr"[^>]*>۰۹۱۲ ۳۴۵ ۶۷۸۹<\/bdi>/);
    expect(html).toContain('پیام واتساپ');
    const empty = { data: {} } as unknown as UIFieldServerProps;
    expect(renderToStaticMarkup(<ContactField {...empty} />)).toBe('');
  });

  it('DE1 an empty duplicates list says it is empty in one line; rows need no line', () => {
    const block = (data: object) =>
      renderToStaticMarkup(<DuplicatesEmpty {...({ data } as unknown as ArrayFieldServerProps)} />);
    expect(text(block({ duplicateSubmissions: [] })).trim()).toBe(
      'درخواست تکراری‌ای از این شماره ثبت نشده است.',
    );
    expect(block({})).toContain('<p');
    expect(block({ duplicateSubmissions: [{ at: '2026-10-15T06:42:00.000Z' }] })).toBe('');
  });

  it('CL1 Jalali Tehran times; «گذشته» only while the request is new and past due', () => {
    expect(dayTime('2026-10-15T06:42:00.000Z')).toBe('۲۳ مهر، ۱۰:۱۲');
    expect(dayTime(null)).toBeNull();
    const now = new Date('2026-10-15T08:00:00.000Z');
    expect(isOverdue('new', '2026-10-15T07:59:00.000Z', now)).toBe(true);
    expect(isOverdue('new', '2026-10-15T08:01:00.000Z', now)).toBe(false);
    expect(isOverdue('contacted', '2026-10-15T07:59:00.000Z', now)).toBe(false);
    expect(isOverdue('new', null, now)).toBe(false);
  });

  it('BS1 the bulk result names what changed and what the status table refused', () => {
    expect(bulkSpamMessage(3, 0)).toBe('۳ درخواست هرزنامه شد.');
    expect(bulkSpamMessage(2, 1)).toBe(
      '۲ درخواست هرزنامه شد. ۱ درخواست با وضعیت فعلی‌اش هرزنامه نمی‌شود.',
    );
    expect(bulkSpamMessage(0, 2)).toBe('۲ درخواست با وضعیت فعلی‌اش هرزنامه نمی‌شود.');
  });

  it('BS3 a failed call shows the server’s own message, a field error first', () => {
    const field = {
      errors: [{ message: 'invalid', data: { errors: [{ message: 'مجاز نیست.' }] } }],
    };
    expect(errorMessage(field)).toBe('مجاز نیست.');
    expect(errorMessage({ errors: [{ message: 'اجازه ندارید.' }] })).toBe('اجازه ندارید.');
    expect(errorMessage({ message: 'پیام' })).toBe('پیام');
    expect(errorMessage(null)).toBe('انجام نشد. اتصال را بررسی کنید و دوباره بزنید.');
  });
});

describe('dashboard widget (admin-notify.md 4.9)', () => {
  const now = new Date('2026-10-15T08:00:00.000Z'); // 11:30 in Tehran, 23 Mehr 1405
  const counts = {
    newToday: 4,
    emergencyToday: 1,
    waiting: 3,
    overdue: 2,
    suspiciousToday: 2,
    notUrgentMonth: 1,
    outcomeMonth: 3,
    openEmergency: 1,
  };
  const hrefs = (html: string) =>
    [...html.matchAll(/href="([^"]+)"/g)].map(
      (m) => new URL(m[1]!.replaceAll('&amp;', '&'), 'https://admin.test'),
    );

  it('DW2 today’s numbers in Persian digits; each link opens the list it counts, with a sort', () => {
    const html = renderToStaticMarkup(<BookingsTodayBody counts={counts} now={now} />);
    expect(html).toContain('>درخواست‌های امروز</h2>');
    for (const label of ['درخواست تازه', 'درخواست فوری', 'منتظر تماس', 'مشکوک امروز']) {
      expect(html).toContain(label);
    }
    expect(text(html)).toContain('۲ از مهلت گذشته');
    expect(html).not.toContain('امروز هنوز درخواستی ثبت نشده است.');
    const links = hrefs(html);
    expect(links).toHaveLength(6);
    for (const link of links) expect(link.searchParams.get('sort'), link.search).toBeTruthy();
    // «درخواست تازه»: created since Tehran midnight, not suspicious or spam (counts.ts).
    expect(Object.fromEntries(links[0]!.searchParams)).toEqual({
      'where[or][0][and][0][createdAt][greater_than_equal]': '2026-10-14T20:30:00.000Z',
      'where[or][0][and][1][status][not_in][0]': 'suspicious',
      'where[or][0][and][1][status][not_in][1]': 'spam',
      sort: 'urgencyRank',
    });
    expect(links[1]!.searchParams.get('where[or][0][and][2][kind][equals]')).toBe('emergency');
    // «منتظر تماس»: exactly counts.ts `waiting` (status new on any day), most overdue first.
    expect(Object.fromEntries(links[2]!.searchParams)).toEqual({
      'where[or][0][and][0][status][equals]': 'new',
      sort: 'callbackDueAt',
    });
  });

  it('DW3 a failed read is «نامشخص», never «۰»; an empty day says so', () => {
    const broken = renderToStaticMarkup(
      <BookingsTodayBody counts={{ ...counts, newToday: null, overdue: null }} now={now} />,
    );
    expect(text(broken)).toContain('نامشخص');
    expect(text(broken)).not.toMatch(/(^|\s)۰(\s|$)/);
    const quiet = renderToStaticMarkup(
      <BookingsTodayBody counts={{ ...counts, newToday: 0, overdue: 0 }} now={now} />,
    );
    expect(quiet).toContain('امروز هنوز درخواستی ثبت نشده است.');
    expect(quiet).not.toContain('از مهلت گذشته');
  });

  it('DW5 this Jalali month’s «فوری نبود» share, linked to those requests (R-10)', () => {
    const html = renderToStaticMarkup(<BookingsTodayBody counts={counts} now={now} />);
    expect(text(html)).toContain('سهم «فوری نبود» این ماه');
    expect(text(html)).toContain('۳۳٪');
    const link = hrefs(html)[4]!;
    expect(Object.fromEntries(link.searchParams)).toEqual({
      'where[or][0][and][0][createdAt][greater_than_equal]': '2026-09-22T20:30:00.000Z',
      'where[or][0][and][1][kind][equals]': 'emergency',
      'where[or][0][and][2][emergencyOutcome][equals]': 'not_urgent',
      sort: '-createdAt',
    });
    const none = { ...counts, notUrgentMonth: 0, outcomeMonth: 0 };
    expect(text(renderToStaticMarkup(<BookingsTodayBody counts={none} now={now} />))).toContain(
      'هنوز نتیجه‌ای ثبت نشده است.',
    );
    const failed = { ...counts, outcomeMonth: null };
    expect(
      text(renderToStaticMarkup(<BookingsTodayBody counts={failed} now={now} />)),
    ).not.toContain('٪');
  });

  it('DW6 nothing for an unverified session or a non-staff user; counts only after the check', async () => {
    const count = vi.fn(async () => ({ totalDocs: 2 }));
    const payload = {
      config: { custom: { totp: { pluginOptions: { forceSetup: true, collection: 'users' } } } },
      count,
    } as unknown as Payload;
    const render = (user: object | null) =>
      BookingsToday({ payload, user } as unknown as Parameters<typeof BookingsToday>[0]);
    const editor = { id: 2, role: 'editor', collection: 'users' };
    expect(await render({ ...editor, _strategy: 'local-jwt', hasTotp: true })).toBeNull();
    expect(await render({ ...editor, role: 'none', _strategy: 'totp' })).toBeNull();
    expect(await render(null)).toBeNull();
    expect(count).not.toHaveBeenCalled();
    const shown = await render({ ...editor, _strategy: 'totp' });
    expect(renderToStaticMarkup(shown!)).toContain('درخواست‌های امروز');
  });
});
