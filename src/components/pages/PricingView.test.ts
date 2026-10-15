import { describe, expect, it } from 'vitest';

import type { CatalogCategory } from '@/lib/data/catalog';
import type { Clinic, FinancingOption, Service } from '@/payload-types';

import {
  financingWhatsapp,
  fromPrices,
  moneyLinks,
  shownFinancing,
  tomanInWords,
} from './PricingView';

const option = (over: Partial<FinancingOption>): FinancingOption =>
  ({
    id: 1,
    key: 'partner-loan',
    title: 'وام درمان',
    provider: 'شریک',
    maxAmountToman: 200_000_000,
    whoApplies: 'بیمار با فاکتور کلینیک اقدام می‌کند',
    surchargeNote: 'حدود ۲۰ تا ۳۰ درصد بیشتر از پرداخت نقدی',
    terms: 'شرایط',
    approvalStatus: 'approved',
    enabled: true,
    _status: 'published',
    ...over,
  }) as FinancingOption;

describe('pricing view helpers (pricing-tiers-measure 1.2, freeze G14)', () => {
  it('PV1 amounts in words: Persian digits, the scale word and تومان', () => {
    expect(tomanInWords(200_000_000)).toBe('۲۰۰ میلیون تومان');
    expect(tomanInWords(100_000_000)).toBe('۱۰۰ میلیون تومان');
    expect(tomanInWords(2_500_000)).toBe('۲ میلیون و ۵۰۰ هزار تومان');
    expect(tomanInWords(1_250_000_000)).toBe('۱ میلیارد و ۲۵۰ میلیون تومان');
    expect(tomanInWords(1_000_500)).toBe('۱ میلیون و ۵۰۰ تومان');
    expect(tomanInWords(750)).toBe('۷۵۰ تومان');
    expect(tomanInWords(2_000_000_000_000)).toBe('۲٬۰۰۰ میلیارد تومان');
    for (const empty of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tomanInWords(empty)).toBeNull();
    }
  });

  it('PV2 financing: only published, enabled and complete options, in their order', () => {
    const shown = shownFinancing([
      option({ id: 1, enabled: false }),
      option({ id: 2, _status: 'draft' }),
      option({ id: 3, provider: null }), // enabled before the partner is named (a bad import)
      option({ id: 4 }),
      option({ id: 5, key: 'dental-credit', approvalStatus: 'pending' }),
      option({ id: 6, key: 'second' }),
    ]);
    expect(shown.map((o) => o.id)).toEqual([4, 6]);
    expect(shownFinancing([option({ enabled: false })])).toEqual([]);
  });

  it('PV3 from prices: only services with a price, none without (brief decision 4)', () => {
    const services = [
      { id: 1, navLabel: 'لمینت سرامیکی', slug: 'لمینت-سرامیکی', priceFrom: 2_500_000 },
      { id: 2, navLabel: 'جرم‌گیری', slug: 'جرم-گیری', priceFrom: null },
      { id: 3, navLabel: 'x', slug: 'x', priceFrom: 0 },
    ] as Service[];
    expect(fromPrices(services)).toEqual([
      { label: 'لمینت سرامیکی', href: '/خدمات/لمینت-سرامیکی', price: 'از ۲٬۵۰۰٬۰۰۰ تومان' },
    ]);
    expect(fromPrices(services.slice(1))).toEqual([]);
  });

  it('PV4 the financing WhatsApp link: the option named in the prefill, hidden until verified (F12)', () => {
    const phones = { whatsapp: '+989121234567', whatsappVerified: true } as Clinic['phones'];
    expect(financingWhatsapp(phones, 'وام درمان')).toBe(
      `https://wa.me/989121234567?text=${encodeURIComponent('سلام، دربارهٔ شرایط پرداخت و وام درمان سؤال دارم.')}`,
    );
    expect(financingWhatsapp({ ...phones, whatsappVerified: false }, 'وام درمان')).toBeNull();
  });

  it('PV5 the money services link in their order, only when published', () => {
    const service = (key: string, path: string) => ({
      id: 0,
      key,
      navLabel: key,
      summary: null,
      path,
      priority: 0,
    });
    const tree = [
      {
        services: [service('crown', '/خدمات/روکش-دندان'), service('restoration', '/خدمات/ترمیم')],
      },
      { services: [service('ceramic-laminate', '/خدمات/لمینت')] },
    ] as CatalogCategory[];
    expect(moneyLinks(tree).map((s) => s.key)).toEqual([
      'restoration',
      'ceramic-laminate',
      'crown',
    ]);
  });
});
