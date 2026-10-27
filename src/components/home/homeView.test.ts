import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { t } from '@/i18n/fa';
import type { ClinicHours } from '@/lib/hoursState';
import type { Media, Page } from '@/payload-types';

import { heroPlaceholderFiles } from './heroPlaceholder';
import { heroImage, heroRelief, heroSubtext, sectionCopy, trustFacts } from './homeView';

const EVERY_DAY = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [{ days: [...EVERY_DAY], open: '10:00', close: '20:00' }],
  holidays: [],
  noteFa: '',
};
const INSURERS = ['بیمه ایران', 'بیمه کارآفرین', 'بیمه پاسارگاد', 'بیمه البرز', 'بیمه ما'];

const page = (data: Partial<Page>) => data as Page;

describe('home hero copy (freeze F6, F7)', () => {
  it('HV1 the free-consultation sentence is t(content.freeConsultation), first, only with the flag', () => {
    const home = page({ hero: { subtext: 'دندانپزشکی دیجیتال برای بزرگسالان و کودکان.' } });
    expect(heroSubtext(home, true)).toBe(
      `${t('content.freeConsultation')} دندانپزشکی دیجیتال برای بزرگسالان و کودکان.`,
    );
    expect(heroSubtext(home, false)).toBe('دندانپزشکی دیجیتال برای بزرگسالان و کودکان.');
    expect(heroSubtext(null, true)).toBe(t('content.freeConsultation'));
  });

  it('HV2 the seeded subtext renders in at most 19 words with the flag on (F7)', () => {
    const seed = parse(readFileSync('src/seed/data/pages.yaml', 'utf8')) as {
      pages: Array<{ key: string; subtext?: string; title: string }>;
    };
    const home = seed.pages.find((p) => p.key === 'home');
    const rendered = heroSubtext(page({ hero: { subtext: home?.subtext } }), true);
    expect(rendered.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(19);
    // F6: the fallback H1 until gap 28 closes, never the unverified «اولین» slogan.
    expect(home?.title).not.toContain('اولین');
  });

  it('HV3 sectionCopy reads one pages.sections row by key, null when missing', () => {
    const home = page({
      sections: [{ key: 'faq', heading: 'پرسش‌های پرتکرار', intro: null }],
    });
    expect(sectionCopy(home, 'faq')).toEqual({ heading: 'پرسش‌های پرتکرار', intro: null });
    expect(sectionCopy(home, 'services')).toBeNull();
    expect(sectionCopy(null, 'faq')).toBeNull();
  });
});

describe('trust band (scene 2, freeze F8)', () => {
  it('TB1 four verified facts in storyboard order, digits Persian, no same-session caption', () => {
    const facts = trustFacts({
      freeConsultation: true,
      hours: HOURS,
      callbackMinutes: 10,
      insurers: INSURERS,
    });
    expect(facts).toEqual([
      { value: 'مشاورهٔ اول رایگان' },
      { value: 'هر روز ۱۰ تا ۲۰', caption: 'به‌جز تعطیلات رسمی' },
      { value: 'تماس پذیرش تا ۱۰ دقیقه', caption: 'معمولاً، در ساعات کاری' },
      {
        value: 'همکاری با بیمه‌ها',
        caption: 'بیمه ایران، بیمه کارآفرین، بیمه پاسارگاد، بیمه البرز، بیمه ما',
      },
    ]);
    expect(JSON.stringify(facts)).not.toContain('همان جلسه');
    // Unconfirmed until gap 51 closes.
    expect(JSON.stringify(facts)).not.toMatch(/طرف قرارداد|سایر بیمه/);
  });

  it('TB2 a fact whose source is off or empty drops; no empty cells', () => {
    const facts = trustFacts({
      freeConsultation: false,
      hours: { ...HOURS, weekly: [{ days: ['sat'], open: '10:00', close: '20:00' }] },
      callbackMinutes: null,
      insurers: [],
    });
    expect(facts).toEqual([]);
  });
});

const sized = (names: string[]) =>
  Object.fromEntries(
    names.flatMap((n) => [
      [n, { url: `/api/media/file/${n}.webp`, width: Number(n.replace(/\D/g, '')) }],
      [`${n}Avif`, { url: `/api/media/file/${n}.avif`, width: Number(n.replace(/\D/g, '')) }],
    ]),
  );
const PHOTO = {
  id: 1,
  alt: 'اتاق درمان کلینیک در نور روز',
  sizes: sized(['w1280', 'w1600', 'w1920', 'w2560', 'p640', 'p828', 'p1080']),
} as unknown as Media;

describe('hero image (freeze F3, nav-conversion-hero 2.6)', () => {
  it('HI1 without a photo: the placeholder rasters, a decorative img, the preload on the 1280 AVIF', () => {
    const image = heroImage(null, null);
    expect(image.placeholder).toBe(true);
    expect(image.wide.avif).toBe(
      '/placeholders/hero-1280.avif 1280w, /placeholders/hero-1600.avif 1600w, /placeholders/hero-1920.avif 1920w, /placeholders/hero-2560.avif 2560w',
    );
    expect(image.tall.other).toContain('/placeholders/hero-p1080.jpg 1080w');
    expect(image.preloadHref).toBe('/placeholders/hero-1280.avif');
    expect(image.img.alt).toBe('');
  });

  it('HI2 with a photo: its Payload sizes, its alt, the 4:5 crop from photoPortrait when set', () => {
    const image = heroImage(PHOTO, null);
    expect(image.placeholder).toBe(false);
    expect(image.wide.avif.split(', ')).toHaveLength(4);
    expect(image.wide.otherType).toBe('image/webp');
    expect(image.img.alt).toBe(PHOTO.alt);
    const portrait = {
      ...PHOTO,
      id: 2,
      sizes: { p640: { url: '/p.webp', width: 640 }, p640Avif: { url: '/p.avif', width: 640 } },
    } as unknown as Media;
    expect(heroImage(PHOTO, portrait).tall.avif).toBe('/p.avif 640w');
  });
});

describe('hero mark relief (brief decision 19, phase 7 D3)', () => {
  it('HV4 renders only with the feature on and a real photo; never on the placeholder', () => {
    expect(heroRelief(true, { placeholder: false })).toBe(true);
    expect(heroRelief(true, { placeholder: true })).toBe(false);
    expect(heroRelief(false, { placeholder: false })).toBe(false);
  });
});

describe('hero placeholder rasters (freeze F3)', () => {
  it('HI3 the sync script writes every width as AVIF and JPEG, landscape 16:9 and band 4:5', () => {
    const files = heroPlaceholderFiles();
    expect(files).toHaveLength(14);
    expect(new Set(files.map((f) => f.url)).size).toBe(14);
    expect(files).toContainEqual({
      url: '/placeholders/hero-2560.avif',
      width: 2560,
      height: 1440,
    });
    expect(files).toContainEqual({
      url: '/placeholders/hero-p1080.jpg',
      width: 1080,
      height: 1350,
    });
  });
});
