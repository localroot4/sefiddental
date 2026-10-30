import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLINIC_FALLBACK, SYSTEM_LINKS } from '@/i18n/fa';

// The chrome readers with the database mocked: the shell (and so the 404 document) must render
// when every read fails (CC-7).
const reads = vi.hoisted(() => ({
  published: vi.fn<(collection: string) => Promise<unknown[]>>(),
  clinic: vi.fn<() => Promise<unknown>>(),
}));
vi.mock('./published', () => ({ getPublished: reads.published }));
vi.mock('./globals', () => ({ getClinic: reads.clinic }));

const { getNavTree, navTreeFrom, NAV_FALLBACK } = await import('./catalog');
const { FOOTER_FALLBACK, getFooterData, socialLinks } = await import('./footer');

const category = (id: number, key: string, extra: Record<string, unknown> = {}) => ({
  id,
  key,
  title: `دستهٔ ${key}`,
  navLabel: key,
  slug: key,
  accent: 'cosmetic',
  ...extra,
});
const service = (id: number, key: string, categoryId: number, priority = 2) => ({
  id,
  key,
  navLabel: key,
  slug: key,
  category: categoryId,
  priority,
});

const CATEGORIES = [
  category(1, 'زیبایی'),
  category(2, 'ارتودنسی', { standalone: true, slug: null, standaloneService: 12 }),
  category(3, 'کودکان', { standalone: true, slug: null, standaloneService: 99 }),
];
const SERVICES = [
  service(10, 'لمینت', 1, 1),
  service(11, 'بلیچینگ', 1),
  service(12, 'ارتودنسی', 2),
];
const CLINIC = {
  nameFa: 'کلینیک دندانپزشکی سفید',
  footerLine: null,
  address: { fullFa: 'تهران، خیابان آزمون', city: 'تهران' },
  phones: {
    landline: '+982155101054',
    mobile: '+989205451054',
    whatsapp: '+989205451054',
    whatsappVerified: false,
  },
  hours: {
    note: null,
    weekly: [
      { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
    ],
  },
  social: { instagram: 'sefid.dental', telegramChannel: null, aparat: 'sefid' },
  maps: { googleMapsUrl: null, neshanUrl: 'https://neshan.org/maps/places/x' },
  legal: {},
};

const catalogue = async (collection: string) =>
  collection === 'service-categories' ? CATEGORIES : collection === 'services' ? SERVICES : [];

describe('chrome readers: nav tree and footer (CC-7, F12, C18)', () => {
  let writes: string[];
  beforeEach(() => {
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    reads.published.mockImplementation(catalogue);
    reads.clinic.mockResolvedValue(CLINIC);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    reads.published.mockReset();
    reads.clinic.mockReset();
  });

  it('FB1 groups are categories with a page; standalone services sit apart; an unpublished target drops', async () => {
    expect(await getNavTree()).toEqual({
      groups: [
        {
          key: 'زیبایی',
          label: 'زیبایی',
          title: 'دستهٔ زیبایی',
          path: '/خدمات/زیبایی',
          items: [
            { key: 'لمینت', label: 'لمینت', path: '/خدمات/لمینت' },
            { key: 'بلیچینگ', label: 'بلیچینگ', path: '/خدمات/بلیچینگ' },
          ],
        },
      ],
      others: [{ key: 'ارتودنسی', label: 'ارتودنسی', path: '/خدمات/ارتودنسی' }],
    });
    expect(navTreeFrom([])).toEqual({ groups: [], others: [] });
  });

  it('FB2 the database is down: the nav falls back to the system links, with one error line', async () => {
    reads.published.mockRejectedValue(new Error('cannot connect to Postgres'));
    expect(await getNavTree()).toBe(NAV_FALLBACK);
    expect(NAV_FALLBACK.groups.map((g) => g.path)).toEqual(
      SYSTEM_LINKS.slice(0, 3).map((l) => l.href),
    );
    expect(NAV_FALLBACK.groups.every((g) => g.items.length === 0)).toBe(true);
    expect(writes.filter((w) => w.includes('nav_tree_unavailable'))).toHaveLength(1);
  });

  it('FB3 footer: WhatsApp only once verified; maps, socials and money services in order', async () => {
    const footer = await getFooterData();
    expect(footer.whatsapp).toBeNull();
    expect(footer.phones).toEqual({ landline: '+982155101054', mobile: '+989205451054' });
    expect(footer.hours).toBe('هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.');
    expect(footer.maps).toEqual([{ provider: 'neshan', url: 'https://neshan.org/maps/places/x' }]);
    expect(footer.social.map((s) => s.url)).toEqual([
      'https://www.instagram.com/sefid.dental',
      'https://www.aparat.com/sefid',
    ]);
    expect(footer.popular).toEqual([{ key: 'لمینت', label: 'لمینت', path: '/خدمات/لمینت' }]);
    expect(footer.guides).toEqual([]);
    // No dentist or article published: the header and the drawer leave those hubs out (JURY 4).
    expect(footer.hubs).toEqual({ dentists: false, articles: false });
    reads.published.mockImplementation(async (collection) =>
      collection === 'doctors'
        ? [{ id: 1, services: [] }]
        : collection === 'articles'
          ? [{ slug: 'x' }]
          : catalogue(collection),
    );
    expect((await getFooterData()).hubs).toEqual({ dentists: true, articles: true });
    reads.published.mockImplementation(catalogue);

    reads.clinic.mockResolvedValue({
      ...CLINIC,
      phones: { ...CLINIC.phones, whatsappVerified: true },
    });
    expect((await getFooterData()).whatsapp).toBe('+989205451054');
    expect(socialLinks(undefined)).toEqual([]);
  });

  it('FB4 the database is down: the footer falls back to the system facts, with one error line', async () => {
    reads.clinic.mockRejectedValue(new Error('cannot connect to Postgres'));
    expect(await getFooterData()).toBe(FOOTER_FALLBACK);
    expect(FOOTER_FALLBACK).toMatchObject({
      name: CLINIC_FALLBACK.name,
      phones: { landline: CLINIC_FALLBACK.phoneE164 },
      hours: CLINIC_FALLBACK.hoursLine,
      whatsapp: null,
      hubs: { dentists: false, articles: false },
    });
    expect(writes.filter((w) => w.includes('footer_data_unavailable'))).toHaveLength(1);
  });
});
