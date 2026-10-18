import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { stubSiteEnv } from '@/lib/http/testEnv';
import { readYaml } from '@/seed/sources';
import { pagesYaml } from '@/seed/schemas';
import { pageData } from '@/seed/transforms';
import type { FinancingOption, Page } from '@/payload-types';

import { FinancingList, Pricing } from './Pricing';

vi.mock('@/components/booking/BookingForm', () => ({
  BookingForm: () => <form data-booking-form="block" />,
}));
vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getFeatures: vi.fn() }));
vi.mock('@/lib/data/catalog', () => ({ getServiceTree: vi.fn() }));
vi.mock('@/lib/data/published', () => ({ getPublished: vi.fn() }));

const ROOT = process.cwd();
const seeded = readYaml(ROOT, 'src/seed/data/pages.yaml', pagesYaml).data.pages.find(
  (p) => p.key === 'pricing',
)!;
const page = { id: 1, ...pageData(seeded) } as unknown as Page;

const CLINIC = {
  phones: { landline: '+982155101054', whatsapp: '+989121234567', whatsappVerified: false },
  address: { fullFa: 'تهران، خانی‌آباد نو' },
  maps: {},
  hours: { weekly: [], holidays: [] },
};
const INSURERS = ['بیمه ایران', 'بیمه کارآفرین', 'بیمه پاسارگاد', 'بیمه البرز', 'بیمه ما'];
const loan = {
  id: 7,
  key: 'partner-loan',
  title: 'وام درمان',
  provider: 'شریک نمونه',
  maxAmountToman: 200_000_000,
  whoApplies: 'بیمار با فاکتور کلینیک اقدام می‌کند',
  surchargeNote: 'حدود ۲۰ تا ۳۰ درصد بیشتر از پرداخت نقدی',
  terms: 'شرایط نمونه',
  approvalStatus: 'approved',
  enabled: true,
  _status: 'published',
} as FinancingOption;

let financing: FinancingOption[] = [];
let freeConsultation = true;

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  stubSiteEnv(); // JSON-LD URLs read SITE_URL
  financing = [];
  freeConsultation = true;
  vi.mocked(getClinic).mockResolvedValue(CLINIC as never);
  vi.mocked(getFeatures).mockImplementation(async () => ({ freeConsultation }) as never);
  vi.mocked(getServiceTree).mockResolvedValue([
    {
      services: [
        { id: 3, key: 'restoration', navLabel: 'ترمیم دندان', path: '/خدمات/ترمیم-دندان' },
        { id: 4, key: 'crown', navLabel: 'روکش دندان', path: '/خدمات/روکش-دندان' },
      ],
    },
  ] as never);
  vi.mocked(getPublished).mockImplementation((async (collection: string) => {
    switch (collection) {
      case 'insurances':
        return INSURERS.map((name, id) => ({ id, name }));
      case 'financing-options':
        return financing;
      case 'service-tiers':
        return ['standard', 'vip', 'cip'].map((key, id) => ({
          id,
          key,
          name: key === 'standard' ? 'معمولی' : key.toUpperCase(),
          description: 'توضیح',
          service: { key: 'restoration', bookingGroup: 'restore' },
        }));
      default:
        return []; // no service has a price (gap 14)
    }
  }) as never);
});

const html = async () => renderToStaticMarkup(await Pricing({ page }));
const sections = (markup: string) =>
  [...markup.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);

describe('pricing page (T-pricing, pricing-tiers-measure 1.2)', () => {
  it('PR1 sections in the ia.md order; one H1; the page type; no financing under the seed', async () => {
    const markup = await html();
    expect(sections(markup)).toEqual(['how', 'tiers', 'insurers', 'faq', 'booking']);
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('data-page-type="pricing"');
    expect(markup).not.toContain(t('pages.pricing.financing'));
    expect(markup).not.toContain('وام درمان');
    // No price is set: no «از … تومان» line and no price heading (brief decision 4).
    expect(markup).not.toContain(t('pages.pricing.fromPrices'));
    expect(markup).not.toMatch(/از [۰-۹٬]+ تومان/);
  });

  it('PR2 insurers by name under «همکاری با بیمه‌ها», never «سایر بیمه» or «طرف قرارداد» (G1)', async () => {
    const markup = await html();
    const start = markup.indexOf('data-section="insurers"');
    const section = markup.slice(start, markup.indexOf('data-section=', start + 1));
    expect(section).toContain('همکاری با بیمه‌ها');
    for (const name of INSURERS) expect(section).toContain(`>${name}<`);
    expect(markup).not.toMatch(/سایر بیمه|طرف قرارداد/);
  });

  it('PR3 the free-consultation line follows the flag; the hero books and calls (F12)', async () => {
    expect(await html()).toContain(t('content.freeConsultation'));
    freeConsultation = false;
    const markup = await html();
    expect(markup).not.toContain(t('content.freeConsultation'));
    expect(markup).toContain('href="tel:+982155101054"');
    expect(markup).not.toContain('wa.me'); // WhatsApp hidden until verified
  });

  it('PR4 an enabled option: the surcharge right after the title, the cap in words, the legal line', async () => {
    financing = [loan, { ...loan, id: 8, key: 'dental-credit', enabled: false }];
    const markup = await html();
    expect(sections(markup)).toEqual(['how', 'tiers', 'insurers', 'financing', 'faq', 'booking']);
    expect(markup.match(/data-financing=/g)).toHaveLength(1);
    const card = markup.slice(markup.indexOf('data-financing="partner-loan"'));
    const order = [
      'وام درمان',
      `${t('pages.pricing.surcharge')} ${loan.surchargeNote}`,
      'تا ۲۰۰ میلیون تومان',
      'شریک نمونه',
      t('pages.pricing.finalDetails'),
    ].map((text) => card.indexOf(text));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Nothing between the title and the surcharge line.
    expect(card).toMatch(/<h3[^>]*>وام درمان<\/h3><p[^>]*>هزینهٔ نهایی:/);
  });

  it('PR8 a lone option takes the full row with its terms in two columns; two share a row (screens 37)', () => {
    const lone = renderToStaticMarkup(<FinancingList options={[loan]} phones={CLINIC.phones} />);
    expect(lone).toMatch(/^<ul class="grid gap-4">/);
    expect(lone).toMatch(/<dl class="grid gap-3 md:grid-cols-2 md:gap-x-8">/);
    const two = renderToStaticMarkup(
      <FinancingList
        options={[loan, { ...loan, id: 8, key: 'dental-credit' }]}
        phones={CLINIC.phones}
      />,
    );
    expect(two).toMatch(/^<ul class="grid gap-4 lg:grid-cols-2">/);
    expect(two).not.toContain('md:grid-cols-2');
  });

  it('PR7 WhatsApp verified: the card asks about its own option in the prefill (F12)', async () => {
    financing = [loan];
    vi.mocked(getClinic).mockResolvedValue({
      ...CLINIC,
      phones: { ...CLINIC.phones, whatsappVerified: true },
    } as never);
    const markup = await html();
    const start = markup.indexOf('data-financing="partner-loan"');
    const card = markup.slice(start, markup.indexOf('</li>', start));
    const text = 'سلام، دربارهٔ شرایط پرداخت و وام درمان سؤال دارم.';
    expect(card).toContain(`href="https://wa.me/989121234567?text=${encodeURIComponent(text)}"`);
    expect(card).toContain('data-track="whatsapp_click"');
  });

  it('PR5 the tiers summary: radios, none checked, the CTA carries the service; JSON-LD crumbs and FAQ', async () => {
    const markup = await html();
    expect(markup.match(/name="restoration-tier"/g)).toHaveLength(3);
    expect(markup).not.toMatch(/<input[^>]*\schecked=/); // the attribute, not a checked: class
    expect(markup).toContain('href="/خدمات/ترمیم-دندان#سطح-ترمیم"');
    expect(markup).toContain('href="/رزرو-نوبت?service=restoration&amp;tier=vip"');
    const ld = markup.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1] ?? '';
    expect(ld).toContain('"BreadcrumbList"');
    expect(ld).toContain('"FAQPage"');
  });
});

describe('pricing seed copy (pricing-tiers-measure 1.2, X6)', () => {
  it('PR6 lead fits a meta description; FAQ topics; never the same-session cost promise', () => {
    expect([...(seeded.lead ?? '')].length).toBeGreaterThanOrEqual(120);
    expect([...(seeded.lead ?? '')].length).toBeLessThanOrEqual(160);
    const text = JSON.stringify(seeded);
    expect(text).not.toContain('همان جلسه'); // gap 50
    expect(text).not.toContain('وام درمان'); // no option is enabled in the seed
    // The lead never points at payment terms the page may not show (conversion.md 1, principle 4).
    expect(seeded.lead).not.toContain('شرایط پرداخت');
    const faq = seeded.blocks?.find((b) => b.type === 'faq');
    expect(faq && 'items' in faq ? faq.items.map((i) => i.question) : []).toEqual([
      'هزینهٔ درمان چطور مشخص می‌شود؟',
      'کدام بیمه‌ها را می‌پذیرید؟',
      'امکان پرداخت قسطی هست؟',
      'فرق هزینهٔ ترمیم معمولی، VIP و CIP چیست؟',
    ]);
  });
});
