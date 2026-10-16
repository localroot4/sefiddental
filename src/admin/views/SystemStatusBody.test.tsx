import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Payload, ServerProps } from 'payload';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon, MARK_VIEW_BOX } from '@/admin/components/Icon';
import { Logo } from '@/admin/components/Logo';
import { SystemStatusNavLink } from '@/admin/components/SystemStatusNavLink';

import { parseEnv } from '@/lib/env';

import styles from './SystemStatus.module.css';
import { SystemStatusBody } from './SystemStatusBody';
import {
  collectSystemStatus,
  recentLogLines,
  testOnlySettings,
  type SystemStatusData,
} from './systemStatusData';

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
    clientIpKnown: false,
    smtp: false,
    testOnly: [],
  },
  notifier: {
    mail: { on: true, ready: true },
    telegram: { on: false, ready: false },
    sms: { on: true, ready: false },
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

/** The rendered value of one «پیکربندی» row. */
function row(data: SystemStatusData, label: string): string {
  const html = renderToStaticMarkup(<SystemStatusBody data={data} />);
  return new RegExp(`<dt>${label}</dt><dd>(.*?)</dd>`).exec(html)?.[1] ?? 'row missing';
}
const inDev = (data: SystemStatusData): SystemStatusData => ({
  ...data,
  runtime: { ...data.runtime, nodeEnv: 'development' },
});
const testOnlyOn: SystemStatusData = {
  ...healthy,
  config: { ...healthy.config, testOnly: ['QA_ROUTES', 'FORM_SESSION_RATE_LIMIT'] },
};
const red = `class="${styles.bad}"`;
const proxyRow = 'اعتماد به سربرگ‌های پراکسی';
const proxyBroken: SystemStatusData = {
  ...healthy,
  config: { ...healthy.config, trustProxyHeaders: true, clientIpKnown: false },
};
const statusEnv = (extra: Record<string, string>) =>
  parseEnv({ DATABASE_URL: 'file:./status.db', PAYLOAD_SECRET: 'status-test', ...extra });

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
      'اعلان‌ها',
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

  it('SS2b without SMTP the mail row says reset does not work, not «server log» (SEC-S8)', () => {
    expect(text(html)).toContain('غیرفعال؛ بازنشانی رمز کار نمی‌کند.');
    expect(html).not.toContain('فقط در گزارش سرور');
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
      notifier: null,
      gaps: null,
      logs: [],
    };
    const down = renderToStaticMarkup(<SystemStatusBody data={broken} />);
    expect(down).toContain('در دسترس نیست');
    expect(down).toContain('هنوز اجرا نشده است');
    expect(text(down).match(/نامشخص/g)?.length).toBeGreaterThanOrEqual(8);
    expect(text(down)).not.toMatch(/(^|\s)۰(\s|$)/);
  });

  it('SS6 notifier rows: on and ready, off, or on but unable to send; never a value', () => {
    expect(text(html)).toContain('روشن و آماده');
    expect(text(html)).toContain('خاموش');
    expect(text(html)).toContain('روشن است ولی حساب فراپیامک یا شمارهٔ خط تنظیم نشده');
    expect(html).not.toContain('هیچ راهی روشن نیست');
    const silent = renderToStaticMarkup(
      <SystemStatusBody
        data={{
          ...healthy,
          notifier: {
            mail: { on: false, ready: false },
            telegram: { on: false, ready: false },
            sms: { on: false, ready: false },
          },
          jobs: {
            ...healthy.jobs,
            failed: [
              { id: 8, task: 'ارسال اعلان', message: 'x', tries: 5, at: healthy.generatedAt },
            ],
          },
        }}
      />,
    );
    expect(silent).toContain(
      'هیچ راهی روشن نیست؛ درخواست‌ها فقط در پنل و گزارش سرور دیده می‌شوند.',
    );
    // A Persian task label reads as Persian, outside the LTR island a slug gets.
    expect(silent).toContain('<td>ارسال اعلان</td>');
    expect(html).toContain('schedulePublish</bdi>');
  });

  it('SS7 proxy headers off: red with the fix in production, plain «خاموش» elsewhere (S2)', () => {
    const label = proxyRow;
    const off = row(healthy, label);
    expect(off).toContain(red);
    expect(off).toContain('نشانی بازدیدکننده‌ها شناخته نمی‌شود');
    expect(off).toContain('بدون اعلان در «مشکوک» بمانند یا اصلاً ثبت نشوند');
    expect(off).toContain('متغیرهای محیط سرور');
    expect(off).toContain('TRUST_PROXY_HEADERS=true</bdi>');
    expect(row(inDev(healthy), label)).toBe('خاموش');
    const on = { ...proxyBroken, config: { ...proxyBroken.config, clientIpKnown: true } };
    expect(row(on, label)).toBe('روشن');
  });

  it('SS10 proxy headers on but this request has no readable address: red in every mode', () => {
    for (const data of [proxyBroken, inDev(proxyBroken)]) {
      const value = row(data, proxyRow);
      expect(value).toContain(red);
      expect(value).toContain('نشانی شما از سربرگ‌های پراکسی خوانده نشد');
      expect(value).toContain('اصلاً ثبت نشوند');
      expect(value).toContain('TRUSTED_PROXY_HOPS</bdi>');
    }
  });

  it('SS8 test-only settings: red with the fix in production, listed elsewhere (S12)', () => {
    const label = 'تنظیمات ویژهٔ آزمون';
    expect(row(healthy, label)).toBe('ندارد');
    const prod = row(testOnlyOn, label);
    expect(prod).toContain(red);
    expect(prod).toContain('تنظیم شده است');
    expect(prod).toContain('فقط برای آزمون است');
    expect(prod).toContain('رفتار سایت را تغییر می‌دهد');
    expect(prod).toContain('از متغیرهای محیط سرور بردارید');
    expect(prod).toContain('QA_ROUTES</bdi>');
    expect(prod).toContain('FORM_SESSION_RATE_LIMIT</bdi>');
    const dev = row(inDev(testOnlyOn), label);
    expect(dev).not.toContain(red);
    expect(dev).toContain('QA_ROUTES</bdi>');
  });

  it('SS9 a test-only setting counts when it is on or differs from its default (S12)', () => {
    const env = statusEnv;
    expect(testOnlySettings(env({}))).toEqual([]);
    expect(testOnlySettings(env({ QA_ROUTES: '1', FORM_SESSION_RATE_LIMIT: '500' }))).toEqual([
      'QA_ROUTES',
      'FORM_SESSION_RATE_LIMIT',
    ]);
    expect(testOnlySettings(env({ QA_ROUTES: '0', FORM_SESSION_RATE_LIMIT: '60' }))).toEqual([]);
  });

  it('SS5 copy: no Arabic yeh or kaf, no em dash, no Latin digit outside LTR islands', () => {
    for (const markup of [
      html,
      renderToStaticMarkup(<SystemStatusBody data={testOnlyOn} />),
      renderToStaticMarkup(<SystemStatusBody data={proxyBroken} />),
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

describe('System status data', () => {
  it("SD1 the config rows come from the env and from this request's proxy headers", async () => {
    const env = statusEnv({ QA_ROUTES: '1', TRUST_PROXY_HEADERS: 'true' });
    // Every database read fails into null (known()); only the settings are under test.
    const payload = {} as Payload;
    const seen = await collectSystemStatus(
      payload,
      env,
      new Headers({ 'x-forwarded-for': '203.0.113.7' }),
    );
    expect(seen.config).toMatchObject({
      trustProxyHeaders: true,
      clientIpKnown: true,
      testOnly: ['QA_ROUTES'],
    });
    const unseen = await collectSystemStatus(payload, env, new Headers());
    expect(unseen.config.clientIpKnown).toBe(false);
  });
});

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
    const logo = renderToStaticMarkup(<Logo />);
    expect(logo).toContain('aria-label="کلینیک دندانپزشکی سفید"');
    expect(logo).toMatch(/<use href="\/brand\/lockup\.svg\?v=[0-9a-f]{8}#lockup">/);
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
