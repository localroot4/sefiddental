import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ServerProps } from 'payload';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon, MARK_VIEW_BOX } from '@/admin/components/Icon';
import { Logo } from '@/admin/components/Logo';
import { SystemStatusNavLink } from '@/admin/components/SystemStatusNavLink';

import { SystemStatusBody } from './SystemStatusBody';
import { recentLogLines, type SystemStatusData } from './systemStatusData';

const healthy: SystemStatusData = {
  generatedAt: '2026-10-13T08:30:00.000Z',
  runtime: {
    node: 'v22.22.0',
    nodeEnv: 'production',
    uptimeSeconds: 3_900,
    startedAt: '2026-10-13T07:25:00.000Z',
    rssBytes: 300 * 1024 ** 2,
  },
  version: { gitSha: 'dff3ac0', buildTime: null },
  database: {
    adapter: 'postgres',
    reachable: true,
    latencyMs: 3,
    migrations: { applied: 1, newest: '20261013_184820_initial', pending: [] },
  },
  jobs: {
    queued: 2,
    processing: 0,
    stuck: 0,
    failed: [
      {
        id: 7,
        task: 'schedulePublish',
        message: 'Document not found',
        tries: 3,
        at: '2026-10-12T10:00:00.000Z',
      },
    ],
    lastCron: {
      at: '2026-10-13T08:29:00.000Z',
      ranJobs: 1,
      failed: 0,
      durationMs: 42,
      error: null,
    },
  },
  media: { storage: 'local', files: 12, bytes: 5 * 1024 ** 2, freeBytes: 20 * 1024 ** 3 },
  config: {
    siteUrl: 'https://sefiddental.ir',
    allowIndexing: false,
    maintenance: false,
    cspMode: 'enforce',
    cspAdminMode: 'report-only',
    trustProxyHeaders: false,
    smtp: false,
  },
  lastSeedAt: '2026-10-13T06:00:00.000Z',
  gaps: {
    generatedAt: '2026-10-13T08:30:00.000Z',
    total: 2,
    groups: [
      {
        kind: 'needs_client',
        headingFa: 'منتظر اطلاعات کلینیک',
        items: [
          {
            id: 'clinic.postalCode',
            gapRow: 12,
            labelFa: 'کد پستی کلینیک',
            adminUrl: '/admin/globals/clinic',
            fieldPath: 'address.postalCode',
          },
        ],
      },
      {
        kind: 'marker_in_text',
        headingFa: 'علامت NEEDS_CLIENT در متن',
        items: [
          {
            id: 'marker:services:4:intro',
            gapRow: null,
            labelFa: 'علامت NEEDS_CLIENT در «intro»',
            adminUrl: '/admin/collections/services/4',
            fieldPath: 'intro',
          },
        ],
      },
    ],
  },
  logs: [{ time: '2026-10-13T08:00:00.000Z', level: 'error', msg: 'request_error' }],
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ');

describe('System status view body (spec 13.3, freeze 29)', () => {
  const html = renderToStaticMarkup(<SystemStatusBody data={healthy} />);

  it('SS1 one H1 «وضعیت سیستم» and every section heading', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('وضعیت سیستم');
    for (const heading of [
      'پایگاه داده',
      'صف کارها',
      'ذخیره‌سازی رسانه',
      'نسخه و اجرا',
      'پیکربندی',
      'کارهای ناموفق در ۷ روز اخیر',
      'کمبود محتوا',
      'هشدارها و خطاهای اخیر',
    ]) {
      expect(html).toContain(`>${heading}</h2>`);
    }
  });

  it('SS2 facts in Persian digits; SHA, Node version and URLs in LTR islands', () => {
    expect(html).toContain('<bdi dir="ltr"');
    expect(html).toContain('dff3ac0</bdi>');
    expect(html).toContain('v22.22.0</bdi>');
    expect(html).toContain('https://sefiddental.ir</bdi>');
    expect(html).toContain('۱ ساعت و ۵ دقیقه');
    expect(html).toContain('۵ مگابایت');
    expect(html).toContain('۲۰ گیگابایت');
    expect(html).toContain('۱ کار، ۰ ناموفق، ۴۲ میلی‌ثانیه');
  });

  it('SS3 content gaps link to the admin field; markers carry the field path, never a value', () => {
    expect(html).toContain('<a href="/admin/globals/clinic">کد پستی کلینیک</a>');
    expect(html).toContain('ردیف ۱۲ فهرست کمبودها');
    expect(html).toContain('<a href="/admin/collections/services/4">');
    expect(html).toContain('intro</bdi>');
  });

  it('SS4 a failed read shows «نامشخص», never zero; a down database says so', () => {
    const broken: SystemStatusData = {
      ...healthy,
      database: { adapter: 'sqlite', reachable: false, latencyMs: null, migrations: null },
      jobs: { queued: null, processing: null, stuck: null, failed: null, lastCron: null },
      media: { storage: 'local', files: null, bytes: null, freeBytes: null },
      gaps: null,
      logs: [],
    };
    const down = renderToStaticMarkup(<SystemStatusBody data={broken} />);
    expect(down).toContain('در دسترس نیست');
    expect(down).toContain('هنوز اجرا نشده است');
    expect(text(down).match(/نامشخص/g)?.length).toBeGreaterThanOrEqual(8);
    expect(text(down)).not.toMatch(/(^|\s)۰(\s|$)/);
  });

  it('SS5 copy: no Arabic yeh or kaf, no em dash, no Latin digit outside LTR islands', () => {
    for (const markup of [
      html,
      renderToStaticMarkup(<SystemStatusNavLink {...navProps(admin)} />),
    ]) {
      const visible = text(markup.replace(/<bdi dir="ltr"[^>]*>[^<]*<\/bdi>/g, ''));
      expect(visible).not.toMatch(/[يك—]/);
      expect(visible).not.toMatch(/[0-9]/);
    }
  });
});

const navProps = (user: object | null) => ({ user }) as unknown as ServerProps;
const admin = { id: 1, role: 'admin' };

describe('admin nav link and graphics', () => {
  it('NL1 the nav link renders for an admin only', () => {
    expect(renderToStaticMarkup(<SystemStatusNavLink {...navProps(admin)} />)).toContain(
      'href="/admin/system-status"',
    );
    const editor = { id: 2, role: 'editor' };
    expect(renderToStaticMarkup(<SystemStatusNavLink {...navProps(editor)} />)).toBe('');
    expect(renderToStaticMarkup(<SystemStatusNavLink {...navProps(null)} />)).toBe('');
  });

  it('BR1 the icon is the mark of design/brand/logo-mark.svg; the logo is the labelled lockup', () => {
    const mark = readFileSync(path.resolve('design/brand/logo-mark.svg'), 'utf8');
    expect(mark).toContain(`viewBox="${MARK_VIEW_BOX}"`);
    const icon = renderToStaticMarkup(<Icon />);
    const d = /d="([^"]+)"/.exec(icon)?.[1] ?? '';
    expect(mark).toContain(`d="${d}"`);
    expect(icon).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Logo />)).toContain('aria-label="کلینیک دندانپزشکی سفید"');
  });

  it('LG1 log lines keep time, level and event only', () => {
    const line = JSON.stringify({
      time: 't',
      level: 'warn',
      msg: 'x_y',
      reqId: 'r',
      err: { message: 'secret' },
    });
    expect(recentLogLines([line, 'not json'])).toEqual([{ time: 't', level: 'warn', msg: 'x_y' }]);
  });
});
