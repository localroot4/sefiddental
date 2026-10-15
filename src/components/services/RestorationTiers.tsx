import { ButtonLink } from '@/components/ui/Button';
import { ltr } from '@/components/ui/ltr';
import { TierComparison, type TierColumn } from '@/components/ui/Tiers';
import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import type { Service, ServiceTier } from '@/payload-types';

import { priceFromFa } from './view';

/** The anchor of the restoration tiers; /vip lands on it (freeze F24). */
export const TIERS_ANCHOR = 'سطح-ترمیم';

/** The radios' name; HomeBookingPrefill sends tier_select for it (RS3). */
export const TIER_INPUT = 'restoration-tier';

/**
 * The restoration tiers with the visitor's choice (freeze G13): the comparison in choice mode and
 * one primary «رزرو نوبت» under it that carries the chosen tier, `?service=…&tier=…` (none until
 * a choice, F24). Every link is real; with JavaScript, HomeBookingPrefill puts the tier into the
 * page's booking block before the chrome scrolls there. The restoration page shows every row;
 * `summary` (the pricing page) keeps the description and the price only.
 */
export function RestorationTiers(props: {
  service: { key: string; bookingGroup?: Service['bookingGroup'] | null };
  tiers: ServiceTier[];
  summary?: boolean;
  className?: string;
}) {
  const { service } = props;
  const booking = `${PAGE_PATHS.booking}?service=${encodeURIComponent(service.key)}`;
  return (
    <TierComparison
      label={t('services.tiers.rail')}
      className={props.className}
      tiers={props.tiers.map((tier): TierColumn => {
        const price = priceFromFa(tier.priceFrom);
        return {
          key: tier.key,
          name: ltr(tier.name),
          summary: ltr(tier.description),
          rows: [
            ...(tier.materials && !props.summary
              ? [{ term: t('services.tiers.materials'), value: ltr(tier.materials) }]
              : []),
            ...(tier.highlights?.length && !props.summary
              ? [{ term: t('services.tiers.highlights'), value: ltr(tier.highlights.join('، ')) }]
              : []),
            ...(price ? [{ term: t('services.tiers.price'), value: price }] : []),
          ],
        };
      })}
      choice={{
        name: TIER_INPUT,
        legend: t('pages.tiers.legend'),
        badge: t('pages.tiers.chosen'),
        action: (key) => (
          <ButtonLink
            size="lg"
            href={key ? `${booking}&tier=${encodeURIComponent(key)}` : booking}
            track={{ event: 'booking_open', location: 'tier', serviceKey: service.key }}
            data-booking-cta=""
            data-booking-group={service.bookingGroup ?? undefined}
            data-tier={key ?? undefined}
          >
            {t('services.book')}
          </ButtonLink>
        ),
      }}
    />
  );
}
