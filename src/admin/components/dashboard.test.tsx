import type { DefaultCellComponentProps, DefaultServerCellComponentProps, Payload } from 'payload';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TierCell } from '@/admin/bookings/cells';
import { cond, listHref, tabHref } from '@/admin/bookings/tabs';
import type { CalendarItem } from '@/admin/calendar';
import { EditorialCalendar } from '@/admin/views/EditorialCalendar';
import type { ContentGapsReport } from '@/content-gaps/registry';
import { adminText } from '@/i18n/fa-admin';
import { ADMIN_ROUTE } from '@/lib/paths';

import { BookingsTodayBody } from './BookingsToday';
import { CalendarNavLink } from './CalendarNavLink';
import { CalendarAgenda, ContentCalendar, ContentCalendarBody } from './ContentCalendar';
import { ContentGapsSummary, ContentGapsSummaryBody } from './ContentGapsSummary';
import { JalaliDateCell, JalaliDateHint } from './JalaliDateCell';
import { SeoHealth, SeoHealthBody } from './SeoHealth';

const form = vi.hoisted(() => ({ fields: {} as Record<string, { value: unknown }> }));
vi.mock('@payloadcms/ui', () => ({
  Gutter: ({ children }: { children: unknown }) => children,
  Pill: ({ children }: { children: unknown }) => children,
  useFormFields: (select: (context: [typeof form.fields]) => unknown) => select([form.fields]),
}));
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: ({ children }: { children: unknown }) => children,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
/** H34: no Latin word reaches the staff, apart from the allowlist. */
const latin = (html: string) =>
  (text(html).match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !['VIP', 'CIP'].includes(w));

// 18 Oct 2026, 12:00 in Tehran (26 Mehr 1405).
const NOW = new Date('2026-10-18T08:30:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
const item = (
  kind: CalendarItem['kind'],
  days: number,
  title: string,
  extra = {},
): CalendarItem => ({
  kind,
  at: at(days),
  collection: 'articles',
  id: title,
  title,
  href: `${ADMIN_ROUTE}/collections/articles/${title}`,
  ...extra,
});

type FindArgs = { collection: string; draft?: boolean };
type TestPayload = Payload & { find: Mock<(args: FindArgs) => Promise<{ docs: unknown[] }>> };

/**
 * Articles open to staff, services hidden from editors (`admin.hidden`, as Payload's navigation
 * reads it), TOTP on.
 */
function staffPayload(find: (args: FindArgs) => Promise<{ docs: unknown[] }>): TestPayload {
  const config = { fields: [], admin: { useAsTitle: 'title' }, versions: { drafts: {} } };
  const hidden = ({ user }: { user: { role?: string } | null }) => user?.role !== 'admin';
  return {
    config: {
      custom: { totp: { pluginOptions: { forceSetup: true, collection: 'users' } } },
      collections: [
        { slug: 'articles', admin: {} },
        { slug: 'services', admin: { hidden } },
      ],
      globals: [],
    },
    collections: { articles: { config }, services: { config } },
    find: vi.fn(find),
  } as unknown as TestPayload;
}

/** Exactly what Payload 3.90's DefaultDashboard passes `beforeDashboard`: no visibleEntities. */
const dashboardProps = (payload: Payload, user: object | null) =>
  ({
    i18n: {},
    locale: undefined,
    params: {},
    payload,
    permissions: {},
    searchParams: {},
    user,
  }) as never;

const EDITOR = { id: 2, role: 'editor', collection: 'users' };

const ITEMS: CalendarItem[] = [
  item('scheduled', 2, 'زمان‌بندی‌شده'),
  item('scheduled', 9, 'دور'),
  item('published', -3, 'منتشرشده'),
  item('failed', -1, 'ناموفق', { message: 'دست‌کم یک منبع علمی اضافه کنید.' }),
  item('scheduled', 1, 'لغو', { unpublish: true }),
];

describe('editorial calendar UI (H12, H13)', () => {
  it('DB1 the widget: failed publishes first, the next seven days, a link to the full view', () => {
    const html = renderToStaticMarkup(<ContentCalendarBody items={ITEMS} now={NOW} />);
    expect(html).toContain('>تقویم محتوا</h2>');
    expect(text(html)).toContain('۱ انتشار ناموفق');
    expect(hrefs(html)).toEqual([
      `${ADMIN_ROUTE}/content-calendar?kind=failed`,
      `${ADMIN_ROUTE}/collections/articles/لغو`,
      `${ADMIN_ROUTE}/collections/articles/زمان‌بندی‌شده`,
      `${ADMIN_ROUTE}/content-calendar`,
    ]);
    expect(latin(html)).toEqual([]);
    const quiet = renderToStaticMarkup(<ContentCalendarBody items={[]} now={NOW} />);
    expect(text(quiet)).toContain('در هفت روز آینده انتشاری زمان‌بندی نشده است.');
    expect(text(quiet)).not.toContain('ناموفق');
    // A failed read is «نامشخص», never «nothing scheduled».
    const broken = renderToStaticMarkup(<ContentCalendarBody items={null} now={NOW} />);
    expect(text(broken)).toContain('نامشخص');
    expect(text(broken)).not.toContain('انتشاری زمان‌بندی نشده است');
  });

  it('DB2 the view: the failed block with its message, filter chips, Jalali days, drafts by state', () => {
    const html = renderToStaticMarkup(
      <CalendarAgenda
        data={{ items: ITEMS, drafts: [{ id: 4, title: 'پیش‌نویس', reviewState: 'in_review' }] }}
        kind="all"
        now={NOW}
        reviewStates={[
          { value: 'writing', label: 'در حال نوشتن' },
          { value: 'in_review', label: 'منتظر بازبینی' },
        ]}
      />,
    );
    expect(html).toContain('<h1');
    expect(text(html)).toContain('انتشارهای ناموفق');
    expect(text(html)).toContain('دست‌کم یک منبع علمی اضافه کنید.');
    expect(html).toMatch(/aria-current="page"[^>]*>همه</);
    for (const day of ['پنج‌شنبه ۲۳ مهر', 'فردا', 'سه‌شنبه ۲۸ مهر', 'سه‌شنبه ۵ آبان']) {
      expect(html).toContain(`>${day}</h2>`);
    }
    // A failed publish is listed once, in its own block on top.
    expect(html.match(/دست‌کم یک منبع علمی اضافه کنید\./g)).toHaveLength(1);
    expect(text(html)).toContain('لغو انتشار');
    expect(text(html)).toContain('منتظر بازبینی');
    expect(text(html)).not.toContain('در حال نوشتن');
    expect(latin(html)).toEqual([]);
  });

  it('DB3 a filter shows one kind; an empty filter says why', () => {
    const failed = renderToStaticMarkup(
      <CalendarAgenda
        data={{ items: ITEMS, drafts: [] }}
        kind="published"
        now={NOW}
        reviewStates={[]}
      />,
    );
    expect(failed).toContain('>منتشرشده</a>');
    expect(failed).not.toContain('>دور</a>');
    expect(failed).toMatch(/aria-current="page"[^>]*>منتشرشده</);
    const onlyFailed = renderToStaticMarkup(
      <CalendarAgenda
        data={{ items: ITEMS, drafts: [] }}
        kind="failed"
        now={NOW}
        reviewStates={[]}
      />,
    );
    expect(onlyFailed.match(/دست‌کم یک منبع علمی اضافه کنید\./g)).toHaveLength(1);
    expect(onlyFailed).toContain('>شنبه ۲۵ مهر</h2>');
    const empty = renderToStaticMarkup(
      <CalendarAgenda data={{ items: [], drafts: [] }} kind="failed" now={NOW} reviewStates={[]} />,
    );
    expect(text(empty)).toContain('انتشار ناموفقی نیست.');
    expect(text(empty)).toContain('پیش‌نویس مقاله‌ای نیست.');
  });
});

describe('SEO health and content gaps (H33)', () => {
  it('DB4 counts per rule with the documents to fix, and an all-clear', () => {
    const doc = (id: number) => ({
      collection: 'articles',
      id,
      title: `مقالهٔ ${id}`,
      href: `${ADMIN_ROUTE}/collections/articles/${id}`,
    });
    const html = renderToStaticMarkup(
      <SeoHealthBody
        report={{ title: [], description: [1, 2, 3, 4, 5].map(doc), byline: [doc(9)] }}
      />,
    );
    expect(html).toContain('>سلامت سئو</h2>');
    expect(text(html)).toContain('توضیح سئو خالی است');
    expect(text(html)).not.toContain('بیش از ۶۰ نویسه');
    expect(text(html)).toContain('و ۲ مورد دیگر');
    expect(hrefs(html)).toEqual(
      [1, 2, 3, 9].map((id) => `${ADMIN_ROUTE}/collections/articles/${id}`),
    );
    expect(latin(html)).toEqual([]);
    const clear = { title: [], description: [], byline: [] };
    expect(text(renderToStaticMarkup(<SeoHealthBody report={clear} />))).toContain(
      'ایرادی پیدا نشد.',
    );
    const broken = text(renderToStaticMarkup(<SeoHealthBody report={null} />));
    expect(broken).toContain('نامشخص');
    expect(broken).not.toContain('ایرادی پیدا نشد.');
  });

  it('DB5 content gaps: counts per kind and the full list in the status view', () => {
    const report: ContentGapsReport = {
      generatedAt: NOW.toISOString(),
      total: 3,
      groups: [
        { kind: 'needs_client', headingFa: 'منتظر اطلاعات کلینیک', items: [{}, {}] as never },
        { kind: 'missing_content', headingFa: 'محتوای ناقص', items: [{}] as never },
      ],
    };
    const html = renderToStaticMarkup(<ContentGapsSummaryBody report={report} />);
    expect(text(html)).toContain('۳ مورد باز');
    expect(text(html)).toContain('منتظر اطلاعات کلینیک');
    expect(hrefs(html)).toEqual([`${ADMIN_ROUTE}/system-status#status-gaps`]);
    expect(text(renderToStaticMarkup(<ContentGapsSummaryBody report={null} />))).toContain(
      'نامشخص',
    );
    const none = { ...report, total: 0, groups: [] };
    expect(text(renderToStaticMarkup(<ContentGapsSummaryBody report={none} />))).toContain(
      'کمبود بازی نیست.',
    );
  });

  it('DB6 nothing for an unverified session; content gaps and nothing else for editors', async () => {
    const payload = staffPayload(async () => ({ docs: [] }));
    const props = (user: object | null) => dashboardProps(payload, user);
    for (const Widget of [ContentCalendar, SeoHealth, ContentGapsSummary]) {
      expect(await Widget(props({ ...EDITOR, _strategy: 'local-jwt', hasTotp: true }))).toBeNull();
      expect(await Widget(props(null))).toBeNull();
    }
    expect(payload.find).not.toHaveBeenCalled();
    expect(await ContentGapsSummary(props({ ...EDITOR, _strategy: 'totp' }))).toBeNull();
    expect(await ContentCalendar(props({ ...EDITOR, _strategy: 'totp' }))).not.toBeNull();
  });

  it('DB11 a failed read says «نامشخص» and leaves the dashboard standing', async () => {
    const payload = staffPayload(async () => {
      throw new Error('database down');
    });
    const props = dashboardProps(payload, { ...EDITOR, _strategy: 'totp' });
    for (const Widget of [ContentCalendar, SeoHealth]) {
      expect(text(renderToStaticMarkup((await Widget(props))!))).toContain('نامشخص');
    }
  });

  it('DB12 the widgets read what the viewer’s navigation shows, from the dashboard’s own props', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const job = { id: 1, input: { type: 'publish', doc: { relationTo: 'articles', value: 7 } } };
    const payload = staffPayload(async ({ collection, draft }) => {
      if (collection === 'payload-jobs') return { docs: [{ ...job, waitUntil: soon }] };
      if (draft) return { docs: [{ id: 7, title: 'مقالهٔ زمان‌بندی‌شده', _status: 'draft' }] };
      const description = 'ب'.repeat(50);
      return {
        docs: [{ id: 9, title: 'مقالهٔ منتشرشده', _status: 'published', seo: { description } }],
      };
    });
    const editor = dashboardProps(payload, { ...EDITOR, _strategy: 'totp' });
    const seo = renderToStaticMarkup((await SeoHealth(editor))!);
    expect(text(seo)).toContain(adminText('admin.seo.description'));
    expect(hrefs(seo)).toContain(`${ADMIN_ROUTE}/collections/articles/9`);
    const calendar = renderToStaticMarkup((await ContentCalendar(editor))!);
    expect(text(calendar)).toContain('مقالهٔ زمان‌بندی‌شده');
    expect(hrefs(calendar)).toContain(`${ADMIN_ROUTE}/collections/articles/7`);
    // The editor's navigation hides services, so neither widget reads them; an admin's does not.
    const read = () => payload.find.mock.calls.map(([args]) => args.collection);
    expect(read()).not.toContain('services');
    await SeoHealth(dashboardProps(payload, { ...EDITOR, role: 'admin', _strategy: 'totp' }));
    expect(read()).toContain('services');
  });

  it('DB13 the calendar view is a 404 without a TOTP-verified staff session (custom views are public)', async () => {
    const payload = staffPayload(async () => ({ docs: [] }));
    const view = (user: object | null) =>
      EditorialCalendar({
        initPageResult: {
          req: { payload, user, i18n: {} },
          permissions: {},
          visibleEntities: { collections: ['articles'], globals: [] },
        },
        params: {},
        searchParams: {},
        user,
      } as never);
    await expect(view(null)).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(view({ ...EDITOR, _strategy: 'local-jwt', hasTotp: true })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(payload.find).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(await view({ ...EDITOR, _strategy: 'totp' }));
    expect(html).toContain('id="content-calendar"');
    expect(payload.find).toHaveBeenCalled();
  });

  it('DB7 the calendar nav link for staff only', () => {
    expect(CalendarNavLink({ user: { role: 'editor' } } as never)).not.toBeNull();
    expect(CalendarNavLink({ user: null } as never)).toBeNull();
    const html = renderToStaticMarkup(CalendarNavLink({ user: { role: 'admin' } } as never)!);
    expect(hrefs(html)).toEqual([`${ADMIN_ROUTE}/content-calendar`]);
    expect(text(html)).toContain('تقویم محتوا');
  });
});

describe('Persian list cells and the bookings widget (H33, H34, H35)', () => {
  it('DB8 Jalali dates with the year in lists; nothing for an empty value', () => {
    const cell = (cellData: unknown) =>
      renderToStaticMarkup(<JalaliDateCell {...({ cellData } as DefaultCellComponentProps)} />);
    expect(text(cell('2026-10-18T08:30:00.000Z'))).toContain('۲۶ مهر ۱۴۰۵، ۱۲:۰۰');
    expect(cell(null)).toBe('');
    expect(cell('not a date')).toBe('');
    form.fields = { publishedAt: { value: '2026-10-18T08:30:00.000Z' } };
    const hint = renderToStaticMarkup(<JalaliDateHint path="publishedAt" />);
    expect(text(hint)).toContain('به تاریخ شمسی: ۲۶ مهر ۱۴۰۵، ۱۲:۰۰');
    form.fields = {};
    expect(renderToStaticMarkup(<JalaliDateHint path="publishedAt" />)).toBe('');
  });

  it('DB9 tier names instead of keys', () => {
    const cell = (cellData: unknown) =>
      renderToStaticMarkup(<TierCell {...({ cellData } as DefaultServerCellComponentProps)} />);
    expect(text(cell('standard'))).toContain('معمولی');
    expect(text(cell('vip'))).toContain('VIP');
    expect(cell(null)).toBe('');
  });

  it('DB10 «منتظر تماس» opens every new request, most overdue first; open emergencies open theirs', () => {
    const counts = {
      newToday: 1,
      emergencyToday: 0,
      waiting: 3,
      overdue: 0,
      suspiciousToday: 0,
      notUrgentMonth: 0,
      outcomeMonth: 0,
      openEmergency: 2,
    };
    const html = renderToStaticMarkup(<BookingsTodayBody counts={counts} now={NOW} />);
    const links = hrefs(html).map((h) => h.replaceAll('&amp;', '&'));
    // Exactly the requests counts.ts `waiting` counts (status new), most overdue first (H33).
    expect(links[2]).toBe(listHref(cond(0, 'status', 'equals', ['new']), 'callbackDueAt'));
    expect(links[5]).toBe(tabHref('emergency'));
    expect(text(html)).toContain('فوری‌های باز');
  });
});
