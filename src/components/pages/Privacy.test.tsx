import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { stubSiteEnv } from '@/lib/http/testEnv';
import { readYaml } from '@/seed/sources';
import { pagesYaml } from '@/seed/schemas';
import { pageData } from '@/seed/transforms';
import type { Page } from '@/payload-types';

import { Privacy } from './Privacy';

vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getFeatures: vi.fn() }));

const seeded = readYaml(process.cwd(), 'src/seed/data/pages.yaml', pagesYaml).data.pages.find(
  (p) => p.key === 'privacy',
)!;
const page = { id: 2, ...pageData(seeded) } as unknown as Page;

let features: Record<string, unknown> = {};
beforeEach(() => {
  stubSiteEnv(); // JSON-LD URLs read SITE_URL
  features = { ga4Enabled: false, ga4MeasurementId: null };
  vi.mocked(getClinic).mockResolvedValue({ phones: { landline: '+982155101054' } } as never);
  vi.mocked(getFeatures).mockImplementation(async () => features as never);
});
afterEach(() => vi.unstubAllEnvs());

const html = async () => renderToStaticMarkup(await Privacy({ page }));

describe('privacy page (T-legal, freeze G17)', () => {
  it('PRV1 what the forms store and who sees it; one H1; legal page type; the clinic phone; no form', async () => {
    const markup = await html();
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('data-page-type="legal"');
    for (const fact of [
      'شمارهٔ موبایل شما',
      'کد یک‌طرفه از نشانی آی‌پی',
      '«ویراستار پذیرش»',
      'تا وقتی «مدیر» آن‌ها را حذف کند',
      'شمارهٔ شما فقط برای هماهنگی نوبت استفاده می‌شود.',
    ]) {
      expect(markup).toContain(fact);
    }
    expect(markup).toContain('href="tel:+982155101054"');
    expect(markup).toContain('dir="ltr"'); // the number is an LTR island
    expect(markup).not.toContain('<form');
    expect(markup).toContain('"BreadcrumbList"');
  });

  it('PRV2 the GA4 paragraph shows only while GA4 is on with a valid id', async () => {
    expect(await html()).not.toContain(t('pages.privacy.ga4Text'));
    features = { ga4Enabled: true, ga4MeasurementId: null };
    expect(await html()).not.toContain(t('pages.privacy.ga4Text'));
    features = { ga4Enabled: true, ga4MeasurementId: 'G-ABC123' };
    const markup = await html();
    expect(markup).toContain(t('pages.privacy.ga4Text'));
    expect(markup).toContain(`href="#analytics"`); // listed in the contents
    // Right after the cookies section, the last seeded one: GA4 sets cookies too.
    const h2 = [...markup.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(h2.slice(-3)).toEqual([
      'کوکی و حافظهٔ مرورگر',
      t('pages.privacy.ga4'),
      t('pages.privacy.contact'),
    ]);
  });

  it('PRV3 seed copy: a lead for the description, retention stated without a marker (gap 43)', () => {
    expect([...(seeded.lead ?? '')].length).toBeGreaterThanOrEqual(120);
    expect([...(seeded.lead ?? '')].length).toBeLessThanOrEqual(160);
    const text = JSON.stringify(seeded);
    expect(text).not.toContain('NEEDS_CLIENT');
    expect(text).toContain('۱۴ روز'); // nightly backups (deploy.md 2.10)
  });

  it('PRV4 seed copy names every copy of the data: flash cookie, admin file, list, staff fields, backups, storage', () => {
    const text = JSON.stringify(seeded);
    for (const fact of [
      'کوکی رمزگذاری‌شده', // __Host-sefid-flash (src/lib/http/flash.ts)
      'حداکثر ۱۰ دقیقه',
      'به‌صورت فایل', // the admin CSV export (admin-notify 4.8)
      'در فهرست درخواست‌ها بخشی از شماره پنهان است', // P-7: tel:/wa.me hrefs carry the full number
      'مهلت تماس با شما',
      'نتیجهٔ تماس در درخواست فوری',
      '۷ روز', // the platform's own backups (deploy.md)
      'با بستن زبانه پاک می‌شود', // session storage (src/lib/qualityTier.ts)
    ]) {
      expect(text).toContain(fact);
    }
    expect(text).not.toContain('نه در فهرست درخواست‌ها');
  });
});
