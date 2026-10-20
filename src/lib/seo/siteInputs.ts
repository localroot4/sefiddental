import type { Clinic, Media, SeoDefault } from '@/payload-types';

import { socialLinks } from '@/lib/data/footer';
import { getClinic, getSeoDefaults } from '@/lib/data/globals';
import { mediaPath } from '@/lib/data/mediaPath';
import { log } from '@/lib/log/logger';
import type { ClinicJsonLdInput } from '@/lib/seo/jsonld';
import type { OgImage, PageSeoInput, SeoDefaults } from '@/lib/seo/metadata';

// Fallback inputs, from docs/content/clinic.yaml: used when the globals cannot be read, so the
// site shell, the 404 document and their JSON-LD still render. One module, because the (site)
// layout and the global 404 document both render the metadata and the Dentist and WebSite JSON-LD.
export const SEO: SeoDefaults = {
  siteName: 'کلینیک دندانپزشکی سفید',
  titleSuffix: ' | کلینیک دندانپزشکی سفید',
  shortTitleSuffix: ' | کلینیک سفید',
};

export const CLINIC: ClinicJsonLdInput = {
  name: 'کلینیک دندانپزشکی سفید',
  alternateNames: ['کلینیک سفید', 'Sefid Dental Clinic'],
  telephone: '+982155101054',
  address: {
    street: 'خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲',
    locality: 'تهران',
    region: 'تهران',
    country: 'IR',
  },
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
};

// The `og` image size (Media.ts, H14) until payload-types is regenerated with it.
type OgSize = { url?: string | null; width?: number | null; height?: number | null };

/**
 * A media document as a share image: its `og` size (1200x630 JPEG around the focal point, H14).
 * Null when the size is missing (an image smaller than 1200x630 both ways, or one uploaded before
 * the size existed): the page then shares its type card (C16), never a wrongly sized file.
 */
export function ogImageOf(media: number | Media | null | undefined): OgImage | null {
  if (typeof media !== 'object' || media === null) return null;
  const og = (media.sizes as { og?: OgSize } | null | undefined)?.og;
  const path = mediaPath(og?.url);
  return path && og?.width && og.height
    ? { url: path, width: og.width, height: og.height, alt: media.alt }
    : null;
}

/** A document's `seo` group (seoGroup fields) as buildMetadata reads it; the image as an OG image. */
export function pageSeoFrom(
  seo:
    | {
        title?: string | null;
        description?: string | null;
        image?: SeoDefault['defaultOgImage'];
        noindex?: boolean | null;
      }
    | null
    | undefined,
): PageSeoInput['seo'] {
  if (!seo) return null;
  const { title, description, image, noindex } = seo;
  return { title, description, noindex, image: ogImageOf(image) };
}

/** The seo-defaults global as the metadata helpers read it. */
export function seoDefaultsFrom(seo: SeoDefault): SeoDefaults {
  return {
    siteName: seo.siteName,
    titleSuffix: seo.titleSuffix,
    shortTitleSuffix: seo.shortTitleSuffix,
    defaultDescription: seo.defaultDescription ?? null,
    defaultOgImage: ogImageOf(seo.defaultOgImage),
    gscVerification: seo.gscVerification ?? null,
  };
}

/** The clinic global as the Dentist JSON-LD builder reads it (spec 9.7). */
export function clinicJsonLdFrom(clinic: Clinic): ClinicJsonLdInput {
  const { address, maps, social } = clinic;
  const cityPrefix = `${address.city}،`;
  const sameAs = socialLinks(social).map((link) => link.url);
  return {
    name: clinic.nameFa,
    alternateNames: [clinic.nameShortFa, clinic.nameEn].filter((n): n is string => Boolean(n)),
    telephone: clinic.phones.landline,
    address: {
      // The street line repeats no city: «تهران، خانی‌آباد نو…» becomes «خانی‌آباد نو…».
      street: address.fullFa.startsWith(cityPrefix)
        ? address.fullFa.slice(cityPrefix.length).trimStart()
        : address.fullFa,
      locality: address.city,
      region: CLINIC.address.region,
      country: CLINIC.address.country,
      postalCode: address.postalCode ?? null,
    },
    geo:
      typeof address.lat === 'number' && typeof address.lng === 'number'
        ? { lat: address.lat, lng: address.lng }
        : null,
    weekly: clinic.hours.weekly.map(({ days, open, close }) => ({ days, open, close })),
    sameAs,
    hasMap: maps?.googleMapsUrl || maps?.neshanUrl || maps?.baladUrl || null,
  };
}

/**
 * Inputs of the site shell from the seo-defaults and clinic globals (tagged, cached reads). When
 * the database cannot answer, the shell still renders from the clinic.yaml fallback above.
 */
export async function getSiteInputs(): Promise<{ seo: SeoDefaults; clinic: ClinicJsonLdInput }> {
  try {
    const [seo, clinic] = await Promise.all([getSeoDefaults(), getClinic()]);
    return { seo: seoDefaultsFrom(seo), clinic: clinicJsonLdFrom(clinic) };
  } catch (err) {
    log.error({ msg: 'site_inputs_unavailable', err });
    return { seo: SEO, clinic: CLINIC };
  }
}
