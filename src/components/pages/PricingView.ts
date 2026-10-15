import { priceFromFa } from '@/components/services/view';
import { t } from '@/i18n/fa';
import { financeRule } from '@/fields/validators';
import type { CatalogCategory, CatalogService } from '@/lib/data/catalog';
import { buildPath } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';
import type { Clinic, FinancingOption, Service } from '@/payload-types';

import { whatsappHref } from './view';

/*
 * Pure view helpers of the pricing page (pricing-tiers-measure 1.2): what renders and the strings
 * composed from data. The template stays markup; these are tested (PV ids).
 */

const SCALES = [
  [1_000_000_000, 'pages.pricing.billion'],
  [1_000_000, 'pages.pricing.million'],
  [1_000, 'pages.pricing.thousand'],
] as const;

/**
 * An amount in words as copy-guidelines asks where the amount matters: «۲۰۰ میلیون تومان»,
 * «۲ میلیون و ۵۰۰ هزار تومان». Persian digits with «٬»; null for no positive amount.
 */
export function tomanInWords(toman: number | null | undefined): string | null {
  if (typeof toman !== 'number' || !Number.isFinite(toman) || toman <= 0) return null;
  let rest = Math.round(toman);
  const parts: string[] = [];
  for (const [size, word] of SCALES) {
    const count = Math.floor(rest / size);
    if (count > 0) parts.push(`${formatNumberFa(count)} ${t(word)}`);
    rest -= count * size;
  }
  if (rest > 0) parts.push(formatNumberFa(rest));
  return `${parts.join(` ${t('pages.pricing.and')} `)} ${t('services.toman')}`;
}

/**
 * Financing options the page may show (brief decision 5, freeze G14): published, enabled and
 * complete by the same rule the admin save applies (V-FINANCE), so an option enabled around the
 * validator (an import, a direct database edit) still stays hidden. The query already asks for
 * enabled options; this is the last gate before money text reaches a visitor.
 */
export function shownFinancing(options: FinancingOption[]): FinancingOption[] {
  return options.filter(
    (option) =>
      option.enabled === true && option._status === 'published' && financeRule(option) === true,
  );
}

export type FromPrice = { label: string; href: string; price: string };

/** «{service}: از … تومان» for each service with a price; none without (brief decision 4). */
export function fromPrices(
  services: Array<Pick<Service, 'navLabel' | 'slug' | 'priceFrom'>>,
): FromPrice[] {
  return services.flatMap((service) => {
    const price = priceFromFa(service.priceFrom);
    const href = buildPath('services', service);
    return price && href ? [{ label: service.navLabel, href, price }] : [];
  });
}

/** wa.me with «سلام، دربارهٔ شرایط پرداخت و {option} سؤال دارم.» (conversion.md 8); null until verified (F12). */
export function financingWhatsapp(phones: Clinic['phones'], title: string): string | null {
  const base = whatsappHref(phones);
  if (!base) return null;
  const text = t('pages.pricing.financingWhatsappText').replaceAll('{name}', title);
  return `${base.split('?')[0]}?text=${encodeURIComponent(text)}`;
}

// docs/ia.md 5 "Pricing": the restoration page and the three money services (studio Q12: the
// top revenue order of docs/brief.md 2).
const MONEY_SERVICES = ['restoration', 'ceramic-laminate', 'implant', 'crown'];

/** The money services' pages in that order, only those published (in the catalog). */
export function moneyLinks(tree: Array<Pick<CatalogCategory, 'services'>>): CatalogService[] {
  const byKey = new Map(tree.flatMap((c) => c.services).map((s) => [s.key, s]));
  return MONEY_SERVICES.flatMap((key) => byKey.get(key) ?? []);
}
