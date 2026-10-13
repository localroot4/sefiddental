import { zonedWallTimeToInstant, type DateKey } from '@/lib/jalali';
import { persianSlug } from '@/lib/persianSlug';
import { normalizeLetters, normalizePersian, normalizeZwnj } from '@/lib/persianText';

import type { ClinicYaml, InsurancesYaml, PagesYaml, ServicesYaml } from './schemas';

/**
 * Pure yaml-to-document mappers (spec-data 8.3-8.5). Seeders only fix letters and ZWNJ (freeze
 * decision 34); the collection hooks normalize the rest on save.
 */

export const fixText = (value: string): string => normalizeZwnj(normalizeLetters(value)).trim();
const opt = (value: string | null | undefined): string | null => (value ? fixText(value) : null);

/** services.yaml accents to the design token names (spec-data conflict 2). */
export const ACCENT_MAP = {
  warm: 'cosmetic',
  brand: 'surgery',
  green: 'restorative',
  sky: 'ortho',
  yellow: 'kids',
} as const;

export class SeedDataError extends Error {}

type Category = ServicesYaml['categories'][number];
type Service = ServicesYaml['services'][number];

export function categoryData(category: Category) {
  return {
    key: category.key,
    title: fixText(category.title),
    navLabel: fixText(category.nav_label ?? category.title),
    slug: category.slug,
    standalone: category.standalone ?? false,
    accent: ACCENT_MAP[category.accent],
    order: category.order,
    summary: opt(category.summary),
  };
}

/** The yaml slug is final: it must already be in persianSlug form, else the run stops. */
export function checkedSlug(slug: string, where: string): string {
  if (persianSlug(slug) !== slug) {
    throw new SeedDataError(
      `${where}: slug "${slug}" is not in its final form (expected "${persianSlug(slug)}").`,
    );
  }
  return slug;
}

export function serviceData(service: Service, categoryId: number | string, order: number) {
  return {
    key: service.key,
    category: categoryId,
    navLabel: fixText(service.nav_label),
    h1: fixText(service.h1),
    slug: checkedSlug(service.slug, `services.yaml ${service.key}`),
    bookingGroup: service.booking_group,
    priority: service.priority,
    order,
    emergencyLink: service.emergency_link ?? false,
    summary: opt(service.summary),
    facts: { sessions: opt(service.sessions), duration: opt(service.duration) },
    priceFrom: service.price_from,
    searchTerms: service.search_terms.map(fixText),
    internalNote: service.scope_to_verify ?? null,
    scopeVerified: !service.scope_to_verify,
    seo: { title: fixText(service.seo_title) },
  };
}

export function tierData(
  tier: NonNullable<Service['tiers']>[number],
  serviceId: number | string,
  index: number,
) {
  return {
    service: serviceId,
    key: tier.key,
    name: fixText(tier.name),
    description: fixText(tier.description),
    priceFrom: tier.price_from,
    order: (index + 1) * 10,
  };
}

/** `/vip` and other aliases: one redirect row to the service (with the tier anchor of ia.md). */
export function aliasRedirect(service: Service) {
  if (!service.alias) return null;
  const anchor = service.tiers?.length ? '#سطح-ترمیم' : '';
  return {
    from: service.alias,
    to: `/خدمات/${service.slug}${anchor}`,
    statusCode: '301' as const,
    source: 'alias' as const,
    active: true,
  };
}

/** A day-only date stored at 12:00 Tehran, as the date fields with a time zone expect. */
export const dayOnly = (key: string): string =>
  zonedWallTimeToInstant(key as DateKey, '12:00').toISOString();

export function financingData(row: ClinicYaml['financing'][number], index: number) {
  const approved = /^approved_(\d{4}-\d{2}-\d{2})$/.exec(row.status);
  return {
    key: row.key,
    title: fixText(row.title_fa),
    provider: opt(row.provider),
    maxAmountToman: row.max_amount_toman ?? null,
    whoApplies: opt(row.who_applies_fa),
    surchargeNote: opt(row.surcharge_note_fa),
    approvalStatus: approved ? ('approved' as const) : ('pending' as const),
    approvedOn: approved?.[1] ? dayOnly(approved[1]) : null,
    enabled: row.enabled ?? false,
    order: (index + 1) * 10,
  };
}

const stat = (value: number | null | undefined) => ({ value: value ?? null, verified: false });

/** clinic.yaml to the four content globals (spec-data 8.4). Unverified facts stay unverified. */
export function globalsData(clinic: ClinicYaml) {
  return {
    clinic: {
      nameFa: fixText(clinic.name_fa),
      nameShortFa: opt(clinic.name_short_fa),
      nameEn: clinic.name_en ?? null,
      tagline: opt(clinic.tagline_fa),
      taglineApproved: false,
      contactHeadline: opt(clinic.contact_headline_fa),
      domain: clinic.domain,
      address: {
        fullFa: fixText(clinic.address.full_fa),
        city: fixText(clinic.address.city),
        district: opt(clinic.address.district),
        postalCode: clinic.address.postal_code ?? null,
        lat: clinic.address.lat ?? null,
        lng: clinic.address.lng ?? null,
        accessNotes: opt(clinic.address.access_notes_fa),
      },
      phones: {
        landline: clinic.phones.landline,
        mobile: clinic.phones.mobile ?? null,
        whatsapp: clinic.phones.whatsapp ?? null,
        whatsappVerified: false,
        telegram: clinic.phones.telegram ?? null,
        telegramVerified: false,
      },
      reception: { callbackMinutes: 10 },
      hours: {
        note: opt(clinic.hours.note_fa),
        weekly: clinic.hours.weekly.map((rule) => ({
          days: rule.days,
          open: rule.open,
          close: rule.close,
        })),
      },
      social: {
        instagram: clinic.social.instagram ?? null,
        telegramChannel: clinic.social.telegram_channel ?? null,
        aparat: clinic.social.aparat ?? null,
      },
      stats: {
        yearsActive: stat(clinic.stats.years_active),
        specialistDentists: stat(clinic.stats.specialist_dentists),
        specialtyClinics: stat(clinic.stats.specialty_clinics),
        insurers: stat(clinic.stats.insurances),
      },
      legal: {
        licenseNumber: clinic.legal.license_number ?? null,
        technicalSupervisor: opt(clinic.legal.technical_supervisor),
      },
      emergency: { policy: opt(clinic.emergency.policy_fa), priorityPromiseConfirmed: false },
    },
    'seo-defaults': {
      siteName: 'کلینیک دندانپزشکی سفید',
      titleSuffix: ' | کلینیک دندانپزشکی سفید',
      shortTitleSuffix: ' | کلینیک سفید',
      areaServed: clinic.market.target_areas_fa.map(fixText),
      secondaryAreas: clinic.market.secondary_areas_fa.map(fixText),
    },
    features: {
      freeConsultation: true,
      emergencyEnabled: clinic.emergency.offered,
      introEnabled: true,
      heroMarkRelief: true,
      ga4Enabled: false,
      qualityTierOverride: 'auto',
    },
    notifier: {
      mail: { enabled: false },
      telegram: { enabled: false },
      sms: { enabled: false, patientConfirmation: false },
      errorDedupMinutes: 60,
    },
  };
}

/** The insurer natural key: the name exactly as the collection hook stores it (H-NORM names). */
export const insurerKey = (name: string): string => normalizePersian(name);

export function insurancesData(file: InsurancesYaml) {
  return [
    ...file.featured.map((row, index) => ({
      name: insurerKey(row.name_fa),
      featured: true,
      order: (index + 1) * 10,
      logo: row.logo || null,
    })),
    ...(file.others ?? []).map((row, index) => ({
      name: insurerKey(row.name_fa),
      featured: false,
      order: 100 + index,
      logo: row.logo || null,
    })),
  ];
}

/** Warning when clinic.yaml's insurer list differs from content/data/insurances.yaml (conflict 4). */
export function insurerDifference(clinic: ClinicYaml, insurers: InsurancesYaml): string | null {
  const a = (clinic.insurances?.featured ?? []).map(insurerKey).sort();
  const b = insurers.featured.map((row) => insurerKey(row.name_fa)).sort();
  return a.join('|') === b.join('|')
    ? null
    : 'docs/content/clinic.yaml insurances.featured differs from content/data/insurances.yaml; the latter is seeded.';
}

export function pageData(page: PagesYaml['pages'][number]) {
  return {
    key: page.key,
    slug: page.slug === '' ? null : page.slug,
    title: fixText(page.title),
    lead: page.lead ? fixText(page.lead) : null,
    seo: {
      ...(page.seo_title ? { title: fixText(page.seo_title) } : {}),
      ...(page.noindex ? { noindex: true } : {}),
    },
  };
}

/** A yaml template entry (empty name or slug) is skipped and reported, never seeded. */
export const isTemplateDoctor = (row: { name_fa: string; slug: string }): boolean =>
  row.name_fa.trim() === '' || row.slug.trim() === '';

export const isSeedableTestimonial = (row: {
  patient_label_fa: string;
  consent_confirmed: boolean;
}): boolean => row.patient_label_fa.trim() !== '' && row.consent_confirmed === true;
