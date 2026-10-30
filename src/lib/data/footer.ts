import type { Clinic } from '@/payload-types';

import { CLINIC_FALLBACK } from '@/i18n/fa';
import { hoursSummary } from '@/lib/hoursState';
import { log } from '@/lib/log/logger';
import type { PageKey } from '@/lib/paths';

import { getServiceTree, type NavLink } from './catalog';
import { toClinicHours } from './clinicHours';
import { getDoctors, getGuides, hasPublishedArticles } from './content';
import { getClinic } from './globals';

const SOCIAL_URLS = {
  instagram: (handle: string) => `https://www.instagram.com/${handle}`,
  telegramChannel: (handle: string) => `https://t.me/${handle}`,
  aparat: (handle: string) => `https://www.aparat.com/${handle}`,
} as const;

export type SocialNetwork = keyof typeof SOCIAL_URLS;

/** Profile links of the clinic's social handles, in a fixed order (footer, drawer, JSON-LD). */
export function socialLinks(social: Clinic['social']): { network: SocialNetwork; url: string }[] {
  return (Object.keys(SOCIAL_URLS) as SocialNetwork[]).flatMap((network) => {
    const handle = social?.[network];
    return handle ? [{ network, url: SOCIAL_URLS[network](encodeURIComponent(handle)) }] : [];
  });
}

const MAP_FIELDS = {
  google: 'googleMapsUrl',
  neshan: 'neshanUrl',
  balad: 'baladUrl',
  waze: 'wazeUrl',
} as const;

export type MapProvider = keyof typeof MAP_FIELDS;

/** The site footer and the contact parts of the chrome (docs/ia.md section 3). */
export interface FooterData {
  name: string;
  /** clinic.footerLine, the one-line description. */
  line: string | null;
  address: string | null;
  /** E.164 numbers; format with formatPhoneFa and telHref. */
  phones: { landline: string; mobile: string | null };
  /** The WhatsApp number once the clinic verified it (decision F12, gap 16), else null. */
  whatsapp: string | null;
  /** The every-day hours sentence (hoursSummary), null for an irregular week. */
  hours: string | null;
  hoursNote: string | null;
  /** Directions deep links that exist, in a fixed order. */
  maps: { provider: MapProvider; url: string }[];
  social: { network: SocialNetwork; url: string }[];
  legal: { licenseNumber: string | null; technicalSupervisor: string | null };
  /** The money services (priority 1) in catalogue order. */
  popular: NavLink[];
  /** Published patient guides: a footer link renders only for a published target (C18). */
  guides: { key: PageKey; path: string }[];
  /**
   * The hubs with something published. The header and the drawer link a hub only then: at launch
   * the dentists and articles hubs are empty (decision 1a), and an empty hub as a top-level link
   * reads as «nothing here» (JURY 4). The guides hub follows `guides`.
   */
  hubs: { dentists: boolean; articles: boolean };
}

/** With the database down: the system pages' clinic facts (CLINIC_FALLBACK), nothing else. */
export const FOOTER_FALLBACK: FooterData = {
  name: CLINIC_FALLBACK.name,
  line: null,
  address: null,
  phones: { landline: CLINIC_FALLBACK.phoneE164, mobile: null },
  whatsapp: null,
  hours: CLINIC_FALLBACK.hoursLine,
  hoursNote: null,
  maps: [],
  social: [],
  legal: { licenseNumber: null, technicalSupervisor: null },
  popular: [],
  guides: [],
  hubs: { dentists: false, articles: false },
};

/**
 * Footer data from the clinic global, the catalogue and the guides (tagged reads). The shell
 * also renders the 404 document, so a failed read answers the fallback with one error line (CC-7).
 */
export async function getFooterData(): Promise<FooterData> {
  try {
    const [clinic, tree, guides, doctors, articles] = await Promise.all([
      getClinic(),
      getServiceTree(),
      getGuides(),
      getDoctors(),
      hasPublishedArticles(),
    ]);
    const { phones, maps, legal } = clinic;
    return {
      name: clinic.nameFa,
      line: clinic.footerLine ?? null,
      address: clinic.address.fullFa,
      phones: { landline: phones.landline, mobile: phones.mobile ?? null },
      whatsapp: (phones.whatsappVerified && phones.whatsapp) || null,
      hours: hoursSummary(toClinicHours(clinic)),
      hoursNote: clinic.hours.note ?? null,
      maps: (Object.keys(MAP_FIELDS) as MapProvider[]).flatMap((provider) => {
        const url = maps?.[MAP_FIELDS[provider]];
        return url ? [{ provider, url }] : [];
      }),
      social: socialLinks(clinic.social),
      legal: {
        licenseNumber: legal?.licenseNumber ?? null,
        technicalSupervisor: legal?.technicalSupervisor ?? null,
      },
      popular: tree.flatMap((category) =>
        category.services
          .filter((service) => service.priority === 1)
          .map(({ key, navLabel, path }) => ({ key, label: navLabel, path })),
      ),
      guides: guides.map(({ key, path }) => ({ key, path })),
      hubs: { dentists: doctors.length > 0, articles },
    };
  } catch (err) {
    log.error({ msg: 'footer_data_unavailable', err });
    return FOOTER_FALLBACK;
  }
}
