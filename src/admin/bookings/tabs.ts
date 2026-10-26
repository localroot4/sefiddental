import type { AdminMessageKey } from '@/i18n/fa-admin';
import { ADMIN_ROUTE } from '@/lib/paths';

/**
 * The booking list's views (freeze G15, D-2): shared link tabs, not per-user query presets. A
 * `?sort=` in the list URL becomes the user's saved sort (Payload's list preferences), so every
 * tab names its sort; «همه» names the urgency rank, which the database follows with newest first.
 * Filters use Payload's own URL shape, so the filter panel shows them.
 */

export type BookingTabKey = 'all' | 'new' | 'callbackDue' | 'emergency' | 'suspicious' | 'closed';

type Pair = readonly [string, string];

interface BookingTab {
  key: BookingTabKey;
  label: AdminMessageKey;
  sort: string;
  where: readonly Pair[];
}

const BOOKINGS_LIST_PATH = `${ADMIN_ROUTE}/collections/bookings`;

type Operator = 'equals' | 'in' | 'not_in' | 'exists' | 'greater_than_equal';

/** One condition of the first or-group, as the filter panel writes it. */
export const cond = (index: number, field: string, op: Operator, values: string[]): Pair[] =>
  op === 'in' || op === 'not_in'
    ? values.map((value, i) => [`where[or][0][and][${index}][${field}][${op}][${i}]`, value])
    : [[`where[or][0][and][${index}][${field}][${op}]`, values[0] ?? '']];

export const BOOKING_TABS: readonly BookingTab[] = [
  { key: 'all', label: 'admin.tabs.all', sort: 'urgencyRank', where: [] },
  {
    key: 'new',
    label: 'admin.tabs.new',
    sort: 'urgencyRank',
    where: cond(0, 'status', 'equals', ['new']),
  },
  // Callback due (D-3): requests nobody has reached yet, most overdue first. Rows without a due
  // time sort first on SQLite and last on PostgreSQL, so they stay in «جدید» only.
  {
    key: 'callbackDue',
    label: 'admin.tabs.callbackDue',
    sort: 'callbackDueAt',
    where: [
      ...cond(0, 'status', 'equals', ['new']),
      ...cond(1, 'callbackDueAt', 'exists', ['true']),
    ],
  },
  {
    key: 'emergency',
    label: 'admin.tabs.emergency',
    sort: 'urgencyRank',
    where: [
      ...cond(0, 'kind', 'equals', ['emergency']),
      ...cond(1, 'status', 'in', ['new', 'contacted']),
    ],
  },
  {
    key: 'suspicious',
    label: 'admin.tabs.suspicious',
    sort: '-createdAt',
    where: cond(0, 'status', 'equals', ['suspicious']),
  },
  {
    key: 'closed',
    label: 'admin.tabs.closed',
    sort: '-createdAt',
    where: cond(0, 'status', 'in', ['done', 'cancelled', 'spam']),
  },
];

/** The list URL for a filter and its explicit sort. */
export function listHref(where: readonly Pair[], sort: string): string {
  const params = new URLSearchParams();
  for (const [name, value] of [...where, ['sort', sort] as const]) params.append(name, value);
  return `${BOOKINGS_LIST_PATH}?${params}`;
}

export function tabHref(key: BookingTabKey): string {
  const tab = BOOKING_TABS.find((t) => t.key === key) ?? BOOKING_TABS[0]!;
  return listHref(tab.where, tab.sort);
}

export const TABS_NAV_ID = 'booking-tabs';

/**
 * Keyboard focus after a restore or a bulk change, whose button leaves the page with its row or
 * its bar: the current tab, else the first one.
 */
export function focusCurrentTab(): void {
  const nav = document.getElementById(TABS_NAV_ID);
  (nav?.querySelector<HTMLElement>('[aria-current="page"]') ?? nav?.querySelector('a'))?.focus();
}

type SearchParams = Record<string, string | string[] | undefined>;

/** The order the list shows: the URL's sort, else the saved one, else the urgency order. */
export function listSort(searchParams: SearchParams, savedSort?: string): string {
  return (
    (typeof searchParams.sort === 'string' ? searchParams.sort : undefined) ??
    savedSort ??
    'urgencyRank'
  );
}

/**
 * A bare list URL (the sidebar, the way back from a record) follows the saved sort, which the
 * last tab may have set: say so when that is not the urgency order and no tab explains it.
 */
export function savedOrderNotice(searchParams: SearchParams, savedSort?: string): boolean {
  return (
    typeof searchParams.sort !== 'string' &&
    listSort(searchParams, savedSort) !== 'urgencyRank' &&
    activeTab(searchParams, savedSort) === null
  );
}

/**
 * The tab whose filter and sort the list shows, or null for any other view. Without a sort in
 * the URL the list uses the saved one, and without that the urgency order.
 */
export function activeTab(searchParams: SearchParams, savedSort?: string): BookingTabKey | null {
  const where = Object.entries(searchParams)
    .filter(([key]) => key.startsWith('where'))
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('&');
  const sort = listSort(searchParams, savedSort);
  const tab = BOOKING_TABS.find(
    (t) =>
      t.sort === sort &&
      t.where
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('&') === where,
  );
  return tab?.key ?? null;
}
