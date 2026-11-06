import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { CALENDAR_PATH } from '@/admin/calendar';
import { ADMIN_ROUTE } from '@/lib/paths';

import { greetingKey, loadTrend, quickActions, trendDays } from './dashboard';

// 18 Oct 2026 in Tehran (UTC+3:30): 12:00 local is 08:30Z.
const tehran = (hhmm: string, day = '2026-10-18') => {
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, m) - 3.5 * 3_600_000);
};

describe('dashboard greeting and trend', () => {
  it('DS1 the greeting follows the Tehran clock, not the server zone', () => {
    expect(greetingKey(tehran('04:59'))).toBe('admin.home.greeting.night');
    expect(greetingKey(tehran('05:00'))).toBe('admin.home.greeting.morning');
    expect(greetingKey(tehran('11:59'))).toBe('admin.home.greeting.morning');
    expect(greetingKey(tehran('12:00'))).toBe('admin.home.greeting.noon');
    expect(greetingKey(tehran('16:00'))).toBe('admin.home.greeting.evening');
    expect(greetingKey(tehran('19:59'))).toBe('admin.home.greeting.evening');
    expect(greetingKey(tehran('20:00'))).toBe('admin.home.greeting.night');
    // 23:30Z is 03:00 the next morning in Tehran, still night.
    expect(greetingKey(new Date('2026-10-18T23:30:00Z'))).toBe('admin.home.greeting.night');
  });

  it('DS2 seven Tehran days, oldest first, today last, empty days at zero', () => {
    const now = tehran('12:00');
    const days = trendDays(
      [
        tehran('00:00').toISOString(), // today, at Tehran midnight
        tehran('11:00').toISOString(),
        tehran('23:59', '2026-10-17').toISOString(), // yesterday, though already 18 Oct in UTC+4
        tehran('08:00', '2026-10-12').toISOString(), // six days ago: the first day
        tehran('23:59', '2026-10-11').toISOString(), // seven days ago: outside
      ],
      now,
    );
    expect(days.map((d) => d.key)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(days.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 1, 2]);
  });

  it('DS3 one capped read of createdAt only, real requests since the first day', async () => {
    const find = vi.fn(async () => ({
      docs: [{ id: 1, createdAt: tehran('09:00').toISOString() }],
    }));
    const days = await loadTrend({ find } as unknown as Payload, tehran('12:00'));
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        select: { createdAt: true },
        pagination: false,
        depth: 0,
        overrideAccess: true,
        where: {
          and: [
            { createdAt: { greater_than_equal: tehran('00:00', '2026-10-12').toISOString() } },
            { status: { not_in: ['suspicious', 'spam'] } },
          ],
        },
      }),
    );
    expect(days.at(-1)).toEqual({ key: '2026-10-18', count: 1 });
  });

  it('DS4 quick actions follow the navigation: status for admins, a new article with create access', () => {
    const hrefs = (user: object | null, canWrite: boolean) =>
      quickActions(user, canWrite).map((a) => a.href.split('?')[0]);
    const bookings = `${ADMIN_ROUTE}/collections/bookings`;
    const article = `${ADMIN_ROUTE}/collections/articles/create`;
    expect(hrefs({ role: 'admin' }, true)).toEqual([
      bookings,
      article,
      CALENDAR_PATH,
      `${ADMIN_ROUTE}/system-status`,
    ]);
    expect(hrefs({ role: 'editor' }, true)).toEqual([bookings, article, CALENDAR_PATH]);
    expect(hrefs({ role: 'editor' }, false)).toEqual([bookings, CALENDAR_PATH]);
    expect(hrefs(null, true)).toEqual([]);
    expect(quickActions({ role: 'editor' }, true).filter((a) => a.primary)).toHaveLength(1);
  });
});
