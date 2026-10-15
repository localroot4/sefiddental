import { t } from '@/i18n/fa';
import { mediaPath } from '@/lib/data/mediaPath';
import { formatNumberFa } from '@/lib/persianText';
import type { Clinic, Doctor, Media, Page } from '@/payload-types';

/*
 * Pure view helpers of the pages templates (dentists, about, address, guides): which facts and
 * blocks render, and the strings composed from data. The templates stay markup; these are tested.
 */

export const mediaOf = (value: number | Media | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null;

/** «دکتر {name}»: the name field stores no title (Doctors.ts). */
export const dentistName = (name: string): string => `${t('pages.dentist.title')} ${name}`;

/** A message with `{name}` filled in. */
export const withName = (key: 'pages.dentist.about' | 'pages.dentist.services', name: string) =>
  t(key).replaceAll('{name}', name);

export type FactItem = { value: string; caption: string };

// Family B holds at most six facts (DESIGN.md 6).
const MAX_FACTS = 6;

/**
 * A dentist's credentials as facts: each degree, the verified years of practice, each membership.
 * Unlike a service's short facts (hidden below three, C14), one verified credential still shows:
 * it is who treats the patient (E-E-A-T), not a marketing line.
 */
export function dentistFacts(
  doctor: Pick<Doctor, 'degrees' | 'yearsExperience' | 'memberships'>,
): FactItem[] {
  const filled = (list: string[] | null | undefined) =>
    (list ?? []).map((v) => v.trim()).filter(Boolean);
  const years = doctor.yearsExperience;
  return [
    ...filled(doctor.degrees).map((value) => ({ value, caption: t('pages.dentist.degree') })),
    ...(typeof years === 'number' && years > 0
      ? [
          {
            value: `${formatNumberFa(years)} ${t('pages.dentist.yearsUnit')}`,
            caption: t('pages.dentist.years'),
          },
        ]
      : []),
    ...filled(doctor.memberships).map((value) => ({
      value,
      caption: t('pages.dentist.membership'),
    })),
  ].slice(0, MAX_FACTS);
}

// A fact row is three to six facts (DESIGN.md 6); fewer hide it (templates C14).
const MIN_FACTS = 3;

const STATS = [
  ['yearsActive', 'pages.stat.yearsActive'],
  ['specialistDentists', 'pages.stat.specialistDentists'],
  ['specialtyClinics', 'pages.stat.specialtyClinics'],
  ['insurers', 'pages.stat.insurers'],
] as const;

/**
 * The about page's numbers: only the clinic stats marked verified (gap 15, "all numbers verified
 * or hidden"), else the page's own facts block; none below three.
 */
export function aboutFacts(
  stats: Clinic['stats'],
  blocks: Page['blocks'],
): { facts: FactItem[]; numbers: boolean } {
  const verified = STATS.flatMap(([field, key]) => {
    const stat = stats?.[field];
    return stat?.verified && typeof stat.value === 'number' && stat.value > 0
      ? [{ value: formatNumberFa(stat.value), caption: t(key) }]
      : [];
  });
  if (verified.length >= MIN_FACTS) return { facts: verified, numbers: true };
  const rows = blocksOf(blocks, 'facts').flatMap((block) =>
    (block.items ?? []).map((row) => ({ value: row.value.trim(), caption: row.label.trim() })),
  );
  const facts = rows.filter((row) => row.value && row.caption).slice(0, MAX_FACTS);
  return { facts: facts.length >= MIN_FACTS ? facts : [], numbers: false };
}

type PageBlock = NonNullable<Page['blocks']>[number];

/** The page's blocks of one type, in stored order. */
export function blocksOf<T extends PageBlock['blockType']>(
  blocks: Page['blocks'],
  type: T,
): Array<Extract<PageBlock, { blockType: T }>> {
  return (blocks ?? []).filter(
    (block): block is Extract<PageBlock, { blockType: T }> => block.blockType === type,
  );
}

/** Rich-text bodies of the content blocks, for the H2 anchors and the table of contents. */
export const contentBodies = (blocks: Page['blocks']) =>
  blocksOf(blocks, 'content').map((block) => block.body);

/** A plain-text field as paragraphs: blank lines split them, single line breaks join. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n[^\S\n]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** wa.me with the generic prefill of conversion.md 8; null until the number is verified (F12). */
export function whatsappHref(phones: Clinic['phones']): string | null {
  if (!phones.whatsappVerified || !phones.whatsapp) return null;
  const number = phones.whatsapp.replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(t('pages.whatsappText'))}`;
}

/** t.me link of the mobile number, only once the clinic confirmed it is on Telegram (gap 16). */
export function telegramHref(phones: Clinic['phones']): string | null {
  if (!phones.telegramVerified || !phones.telegram) return null;
  return `https://t.me/${phones.telegram.replace(/[^\d+]/g, '')}`;
}

/** The guide's sources as list items: the title, with the publisher when it is a named body. */
export function sourceItems(sources: Page['sources']): Array<{ label: string; href: string }> {
  return (sources ?? []).map((source) => ({
    label:
      source.publisher && !['journal', 'other'].includes(source.publisher)
        ? `${source.title} (${source.publisher})`
        : source.title,
    href: source.url,
  }));
}

/** A text as the meta description only when it is 120 to 160 characters (V-DESC), else none. */
export function metaDescription(text: string | null | undefined): string | undefined {
  const length = [...(text ?? '').trim()].length;
  return length >= 120 && length <= 160 ? text!.trim() : undefined;
}

/** A portrait as a share and JSON-LD image: its 1080 x 1350 crop, else the original. */
export function portraitImage(
  media: Media | null,
): { url: string; width: number; height: number; alt: string } | null {
  const size = media?.sizes?.p1080;
  const url = mediaPath(size?.url ?? media?.url);
  const width = size?.url ? size.width : media?.width;
  const height = size?.url ? size.height : media?.height;
  return media && url && width && height ? { url, width, height, alt: media.alt } : null;
}
