import { t } from '@/i18n/fa';
import { mediaPath } from '@/lib/data/mediaPath';
import { hoursSummary, type ClinicHours } from '@/lib/hoursState';
import { toPersianDigits } from '@/lib/persianText';
import type { Media, Page } from '@/payload-types';

import { HERO_PLACEHOLDER, heroPlaceholderUrl } from './heroPlaceholder';

// Pure view helpers of the home page (homeView.test.ts); the readers are in homeData.ts.

/** The heading and intro of one home section (pages.sections), or null when the editor left it out. */
export function sectionCopy(page: Page | null, key: NonNullable<Page['sections']>[number]['key']) {
  const row = page?.sections?.find((s) => s.key === key);
  return row ? { heading: row.heading, intro: row.intro ?? null } : null;
}

/** H1 subtext (freeze F7): the free-consultation sentence first while the flag is on. */
export function heroSubtext(page: Page | null, freeConsultation: boolean): string {
  return [freeConsultation ? t('content.freeConsultation') : '', page?.hero?.subtext ?? '']
    .filter(Boolean)
    .join(' ');
}

export type TrustFact = { value: string; caption?: string };

/**
 * The trust band (scene 2, family B): verified facts only, in the storyboard order; a fact whose
 * source is off or empty drops and the row keeps one cell per fact (freeze F8). The same-session
 * caption of b.html waits for the client (C23, R2).
 */
export function trustFacts(input: {
  freeConsultation: boolean;
  hours: ClinicHours;
  callbackMinutes: number | null | undefined;
  insurers: string[];
}): TrustFact[] {
  const facts: TrustFact[] = [];
  if (input.freeConsultation) facts.push({ value: t('home.trust.free') });
  // «هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.»: the value before the comma, the exception after.
  const summary = hoursSummary(input.hours);
  if (summary) {
    const [value = '', caption] = summary.replace(/\.$/, '').split('، ');
    facts.push({ value, caption });
  }
  if (input.callbackMinutes) {
    facts.push({
      value: `${t('home.trust.callbackBefore')} ${toPersianDigits(String(input.callbackMinutes))} ${t('home.trust.callbackAfter')}`,
      caption: t('home.trust.callbackCaption'),
    });
  }
  if (input.insurers.length > 0) {
    facts.push({
      value: t('home.trust.insurance'),
      caption: input.insurers.join('، '),
    });
  }
  return facts;
}

type Size = { url: string; width: number };

export interface HeroImage {
  /** From 744 px: the landscape crop (AVIF srcset, then WebP or JPEG). */
  wide: { avif: string; other: string; otherType: string };
  /** Under 744 px: the 4:5 band. */
  tall: { avif: string; other: string; otherType: string };
  img: { src: string; width: number; height: number; alt: string };
  /** The first URL of the wide AVIF srcset, the preload's required href. */
  preloadHref: string;
  placeholder: boolean;
}

const srcSet = (list: Size[]) => list.map((s) => `${s.url} ${s.width}w`).join(', ');

function mediaSizes(media: Media | null, names: readonly string[], avif: boolean): Size[] {
  const sizes = (media?.sizes ?? {}) as Record<
    string,
    { url?: string | null; width?: number | null }
  >;
  return names.flatMap((name) => {
    const size = sizes[avif ? `${name}Avif` : name];
    const url = mediaPath(size?.url);
    return url && size?.width ? [{ url, width: size.width }] : [];
  });
}

const WIDE = ['w1280', 'w1600', 'w1920', 'w2560'] as const;
const TALL = ['p640', 'p828', 'p1080'] as const;

/**
 * The hero photo's sources: the client's photo (Payload sizes, the 4:5 crop from photoPortrait or
 * from the landscape's focal point), else the neutral placeholder rasters (freeze F3).
 */
export function heroImage(photo: Media | null, portrait: Media | null): HeroImage {
  const wideAvif = mediaSizes(photo, WIDE, true);
  const wideWebp = mediaSizes(photo, WIDE, false);
  const tallSource = portrait ?? photo;
  const tallAvif = mediaSizes(tallSource, TALL, true);
  const tallWebp = mediaSizes(tallSource, TALL, false);
  if (photo && wideAvif.length && wideWebp.length && tallAvif.length && tallWebp.length) {
    const fallback = tallWebp.at(-1) as Size;
    return {
      wide: { avif: srcSet(wideAvif), other: srcSet(wideWebp), otherType: 'image/webp' },
      tall: { avif: srcSet(tallAvif), other: srcSet(tallWebp), otherType: 'image/webp' },
      img: {
        src: fallback.url,
        width: fallback.width,
        height: (fallback.width * 5) / 4,
        alt: photo.alt,
      },
      preloadHref: (wideAvif[0] as Size).url,
      placeholder: false,
    };
  }
  const sizes = (crop: 'landscape' | 'portrait', ext: 'avif' | 'jpg') =>
    HERO_PLACEHOLDER[crop].widths.map((width) => ({
      url: heroPlaceholderUrl(crop, width, ext),
      width,
    }));
  const largest = HERO_PLACEHOLDER.portrait.widths.at(-1) ?? 1080;
  return {
    wide: {
      avif: srcSet(sizes('landscape', 'avif')),
      other: srcSet(sizes('landscape', 'jpg')),
      otherType: 'image/jpeg',
    },
    tall: {
      avif: srcSet(sizes('portrait', 'avif')),
      other: srcSet(sizes('portrait', 'jpg')),
      otherType: 'image/jpeg',
    },
    // The placeholder is decorative: its caption is visible DOM text.
    img: {
      src: heroPlaceholderUrl('portrait', largest, 'jpg'),
      width: largest,
      height: HERO_PLACEHOLDER.portrait.height(largest),
      alt: '',
    },
    preloadHref: heroPlaceholderUrl('landscape', HERO_PLACEHOLDER.landscape.widths[0], 'avif'),
    placeholder: true,
  };
}
