import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';
import type { Clinic, Media, Page } from '@/payload-types';

import {
  aboutFacts,
  dentistFacts,
  metaDescription,
  sourceItems,
  telegramHref,
  whatsappHref,
} from './view';

const PHONES: Clinic['phones'] = {
  landline: '+982155101054',
  mobile: '+989205451054',
  whatsapp: '+989205451054',
  whatsappVerified: false,
  telegram: '+989205451054',
  telegramVerified: false,
};

const stat = (value: number, verified: boolean) => ({ value, verified });
const factsBlock = (rows: Array<[string, string]>): NonNullable<Page['blocks']> => [
  { blockType: 'facts', items: rows.map(([label, value]) => ({ label, value })) },
];

describe('pages view helpers', () => {
  it('PV1 dentist credentials: each degree and membership, verified years in Persian digits, blanks dropped, six at most', () => {
    expect(dentistFacts({ degrees: null, yearsExperience: null, memberships: [] })).toEqual([]);
    const facts = dentistFacts({
      degrees: ['دکترای عمومی دندانپزشکی', '  '],
      yearsExperience: 12,
      memberships: ['انجمن دندانپزشکی ایران'],
    });
    expect(facts).toEqual([
      { value: 'دکترای عمومی دندانپزشکی', caption: 'مدرک' },
      { value: '۱۲ سال', caption: 'سابقهٔ کار' },
      { value: 'انجمن دندانپزشکی ایران', caption: 'عضویت' },
    ]);
    expect(dentistFacts({ degrees: Array(9).fill('مدرک'), yearsExperience: 0 })).toHaveLength(6);
  });

  it('PV2 about facts: verified clinic numbers only, else the page facts; fewer than three hide the row', () => {
    const unverified = { yearsActive: stat(13, false), specialistDentists: stat(7, false) };
    expect(aboutFacts(unverified, null)).toEqual({ facts: [], numbers: false });
    // Two verified numbers are not a row; the page's facts block does not top them up.
    const two = { yearsActive: stat(13, true), insurers: stat(10, true) };
    expect(aboutFacts(two, factsBlock([['الف', 'ب']]))).toEqual({ facts: [], numbers: false });
    const verified = {
      ...two,
      specialistDentists: stat(7, true),
      specialtyClinics: stat(4, false),
    };
    const numbers = aboutFacts(verified, null);
    expect(numbers.numbers).toBe(true);
    expect(numbers.facts).toEqual([
      { value: '۱۳', caption: 'سال فعالیت' },
      { value: '۷', caption: 'دندانپزشک' },
      { value: '۱۰', caption: 'بیمهٔ تحت پوشش' },
    ]);
    // «متخصص» needs a board confirmation (copy-facts C-17): never a stat caption.
    expect(numbers.facts.map((f) => f.caption).join(' ')).not.toContain('متخصص');
    const block = factsBlock([
      ['یک شعبه', 'خانی‌آباد نو'],
      ['ساعات', 'هر روز'],
      ['بیمه', 'پنج بیمه'],
    ]);
    expect(aboutFacts(unverified, block)).toEqual({
      facts: [
        { value: 'خانی‌آباد نو', caption: 'یک شعبه' },
        { value: 'هر روز', caption: 'ساعات' },
        { value: 'پنج بیمه', caption: 'بیمه' },
      ],
      numbers: false,
    });
  });

  it('PV3 WhatsApp and Telegram links wait for the verified number; the prefill carries no personal data', () => {
    expect(whatsappHref(PHONES)).toBeNull();
    expect(telegramHref(PHONES)).toBeNull();
    const href = whatsappHref({ ...PHONES, whatsappVerified: true });
    expect(href).toMatch(/^https:\/\/wa\.me\/989205451054\?text=/);
    expect(decodeURIComponent(href!.split('text=')[1]!)).toBe(
      'سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.',
    );
    expect(telegramHref({ ...PHONES, telegramVerified: true })).toBe('https://t.me/+989205451054');
  });

  it('PV4 a lead becomes the meta description only at 120 to 160 characters', () => {
    expect(metaDescription(null)).toBeUndefined();
    expect(metaDescription('ک'.repeat(119))).toBeUndefined();
    expect(metaDescription(` ${'ک'.repeat(120)} `)).toBe('ک'.repeat(120));
    expect(metaDescription('ک'.repeat(160))).toBe('ک'.repeat(160));
    expect(metaDescription('ک'.repeat(161))).toBeUndefined();
  });

  it('PV6 sources: a named body joins the title, a journal or other does not', () => {
    expect(
      sourceItems([
        { title: 'Tooth extraction aftercare', publisher: 'NHS', url: 'https://nhs.uk/a' },
        { title: 'A study', publisher: 'journal', url: 'https://doi.org/x' },
        { title: 'منبع', publisher: null, url: 'https://example.org' },
      ]),
    ).toEqual([
      { label: 'Tooth extraction aftercare (NHS)', href: 'https://nhs.uk/a' },
      { label: 'A study', href: 'https://doi.org/x' },
      { label: 'منبع', href: 'https://example.org' },
    ]);
    expect(sourceItems(null)).toEqual([]);
  });
});

describe('share image', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    stubSiteEnv();
  });

  it('PV8 a portrait shares its 1080 x 1350 crop as a site path; the original only without the crop', async () => {
    const { portraitImage } = await import('./view');
    const photo = {
      id: 1,
      alt: 'پرتره',
      url: null,
      width: 3000,
      height: 3750,
      sizes: {
        p1080: {
          url: 'https://sefiddental.ir/api/media/file/a-1080x1350.webp',
          width: 1080,
          height: 1350,
        },
      },
    } as unknown as Media;
    expect(portraitImage(photo)).toEqual({
      url: '/api/media/file/a-1080x1350.webp',
      width: 1080,
      height: 1350,
      alt: 'پرتره',
    });
    expect(portraitImage({ ...photo, sizes: {}, url: '/api/media/file/a.jpg' })).toEqual({
      url: '/api/media/file/a.jpg',
      width: 3000,
      height: 3750,
      alt: 'پرتره',
    });
    expect(portraitImage({ ...photo, sizes: {} })).toBeNull();
    expect(portraitImage(null)).toBeNull();
  });
});
