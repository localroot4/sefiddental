import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Clinic, SeoDefault } from '@/payload-types';

import { stubSiteEnv } from '@/lib/http/testEnv';

const mocks = vi.hoisted(() => ({
  clinic: vi.fn<() => Promise<unknown>>(),
  seo: vi.fn<() => Promise<unknown>>(),
}));
vi.mock('@/lib/data/globals', () => ({ getClinic: mocks.clinic, getSeoDefaults: mocks.seo }));

// The seeded clinic global (docs/content/clinic.yaml).
const clinic = {
  id: 1,
  nameFa: 'کلینیک دندانپزشکی سفید',
  nameShortFa: 'کلینیک سفید',
  nameEn: 'Sefid Dental Clinic',
  domain: 'sefiddental.ir',
  address: {
    fullFa: 'تهران، خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲',
    city: 'تهران',
    postalCode: null,
    lat: null,
    lng: null,
  },
  phones: { landline: '+982155101054' },
  reception: { callbackMinutes: 10 },
  hours: {
    weekly: [
      {
        id: 'w1',
        days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
        open: '10:00',
        close: '20:00',
      },
    ],
  },
  social: { instagram: null, telegramChannel: null, aparat: null },
  maps: {},
} as unknown as Clinic;

const seoGlobal = {
  id: 1,
  siteName: 'کلینیک دندانپزشکی سفید',
  titleSuffix: ' | کلینیک دندانپزشکی سفید',
  shortTitleSuffix: ' | کلینیک سفید',
  defaultDescription: null,
  defaultOgImage: {
    id: 3,
    alt: 'نمای کلینیک',
    url: 'http://localhost:3000/api/media/file/og-1.webp',
    width: 1200,
    height: 630,
  },
} as unknown as SeoDefault;

describe('site inputs from the globals', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('SI1 the seeded clinic maps to the clinic.yaml fallback (spec 9.7 fixture)', async () => {
    const { clinicJsonLdFrom, CLINIC } = await import('./siteInputs');
    const mapped = clinicJsonLdFrom(clinic);
    expect(mapped).toMatchObject(CLINIC);
    expect(mapped).toMatchObject({ geo: null, sameAs: [], hasMap: null });
  });

  it('SI2 handles become profile URLs; coordinates and a map link are passed on', async () => {
    const { clinicJsonLdFrom } = await import('./siteInputs');
    const mapped = clinicJsonLdFrom({
      ...clinic,
      address: { ...clinic.address, lat: 35.62, lng: 51.38, postalCode: '1234567890' },
      social: { instagram: 'sefid.dental', telegramChannel: null, aparat: 'sefid' },
      maps: { neshanUrl: 'https://neshan.org/maps/places/x' },
    });
    expect(mapped.sameAs).toEqual([
      'https://www.instagram.com/sefid.dental',
      'https://www.aparat.com/sefid',
    ]);
    expect(mapped.geo).toEqual({ lat: 35.62, lng: 51.38 });
    expect(mapped.address.postalCode).toBe('1234567890');
    expect(mapped.hasMap).toBe('https://neshan.org/maps/places/x');
  });

  it('SI3 seo-defaults: a relative OG image path with its size; no image without a size', async () => {
    const { seoDefaultsFrom } = await import('./siteInputs');
    expect(seoDefaultsFrom(seoGlobal)).toEqual({
      siteName: 'کلینیک دندانپزشکی سفید',
      titleSuffix: ' | کلینیک دندانپزشکی سفید',
      shortTitleSuffix: ' | کلینیک سفید',
      defaultDescription: null,
      defaultOgImage: {
        url: '/api/media/file/og-1.webp',
        width: 1200,
        height: 630,
        alt: 'نمای کلینیک',
      },
      gscVerification: null,
    });
    const noSize = { ...seoGlobal, defaultOgImage: 3 } as SeoDefault;
    expect(seoDefaultsFrom(noSize).defaultOgImage).toBeNull();
  });

  it('SI5 a page seo group maps for buildMetadata: fields kept, the image as an OG image', async () => {
    const { pageSeoFrom } = await import('./siteInputs');
    expect(pageSeoFrom(null)).toBeNull();
    expect(
      pageSeoFrom({
        title: 'دندانپزشکی دیجیتال جنوب تهران',
        description: 'توضیح',
        noindex: false,
        image: seoGlobal.defaultOgImage,
      }),
    ).toEqual({
      title: 'دندانپزشکی دیجیتال جنوب تهران',
      description: 'توضیح',
      noindex: false,
      image: { url: '/api/media/file/og-1.webp', width: 1200, height: 630, alt: 'نمای کلینیک' },
    });
    expect(pageSeoFrom({ title: 'الف', image: 3 })?.image).toBeNull();
  });

  it('SI4 the globals cannot be read: the fallback renders and one error line is logged', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    mocks.seo.mockRejectedValue(new Error('cannot connect to Postgres'));
    mocks.clinic.mockResolvedValue(clinic);
    const { getSiteInputs, SEO, CLINIC } = await import('./siteInputs');
    expect(await getSiteInputs()).toEqual({ seo: SEO, clinic: CLINIC });
    expect(writes.join('')).toContain('site_inputs_unavailable');

    mocks.seo.mockResolvedValue(seoGlobal);
    expect((await getSiteInputs()).seo.defaultOgImage?.url).toBe('/api/media/file/og-1.webp');
  });
});
