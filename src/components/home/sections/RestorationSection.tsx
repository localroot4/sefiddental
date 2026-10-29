import { ButtonLink } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Chip } from '@/components/ui/Field';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import type { ServiceTier } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

import { HomeSection, type Copy } from './HomeSection';

// The step control shows the panel of the checked tier (every panel in the server HTML) by its
// position, `data-choice` (ChromeScripts' choices.ts); without JavaScript a `:has()` rule that
// exists only then (`noscript:`). Static classes per position: Tailwind cannot build a class from
// a tier key.
const PANEL = [
  'group-data-[choice=1]/tiers:grid noscript:group-has-[label:nth-of-type(1)>input:checked]/tiers:grid',
  'group-data-[choice=2]/tiers:grid noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:grid',
  'group-data-[choice=3]/tiers:grid noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:grid',
  'group-data-[choice=4]/tiers:grid noscript:group-has-[label:nth-of-type(4)>input:checked]/tiers:grid',
];

/**
 * Scene 4 (family D, the static stepper of phase 4): three steps, a line each, one «رزرو نوبت»
 * that carries the chosen tier to the scene 10 block (C15), and the full comparison on the
 * restoration page. No tier is preselected (F24): until a step is chosen, the button carries
 * the service only. HomeBookingPrefill sends `tier_select` (name `home-tier`).
 */
export function RestorationSection(props: {
  tiers: ServiceTier[];
  path: string | null;
  copy: Copy;
}) {
  const tiers = props.tiers.slice(0, PANEL.length);
  if (tiers.length === 0) return null;
  const service = typeof tiers[0]?.service === 'object' ? tiers[0].service : null;
  const book = (tier: ServiceTier | null) => (
    <ButtonLink
      size="lg"
      href={`${PAGE_PATHS.booking}?service=${service?.key ?? 'restoration'}${tier ? `&tier=${tier.key}` : ''}`}
      track={{ event: 'booking_open', location: 'tier', serviceKey: service?.key }}
      data-booking-cta=""
      data-booking-group={service?.bookingGroup ?? undefined}
    >
      {t('home.book')}
    </ButtonLink>
  );
  return (
    <HomeSection scene="restoration" section="restoration" family="D" copy={props.copy} split>
      <div data-choices="" className="group/tiers grid gap-6">
        <fieldset className="min-w-0">
          <legend className="sr-only">{t('home.restoration.legend')}</legend>
          <div className="flex flex-wrap gap-2">
            {tiers.map((tier) => (
              <Chip
                key={tier.key}
                name="home-tier"
                value={tier.key}
                label={ltr(tier.name)}
                className="min-w-24 justify-center"
              />
            ))}
          </div>
        </fieldset>
        <div
          data-tier-panel=""
          className="grid justify-items-start group-data-choice/tiers:hidden noscript:group-has-[input:checked]/tiers:hidden"
        >
          {book(null)}
        </div>
        {tiers.map((tier, i) => (
          <div
            key={tier.key}
            data-tier-panel={tier.key}
            className={cx(
              'hidden content-start justify-items-start gap-4 rounded-card border border-line bg-surface-raised p-6',
              PANEL[i],
            )}
          >
            <h3 className="text-heading font-semibold">{ltr(tier.name)}</h3>
            <p className="max-w-measure text-body text-ink-muted">{ltr(tier.description)}</p>
            {book(tier)}
          </div>
        ))}
        {props.path ? (
          <TextLink
            standalone
            href={`${props.path}#سطح-ترمیم`}
            className="-ms-2 justify-self-start"
          >
            {t('home.restoration.compare')}
          </TextLink>
        ) : null}
      </div>
    </HomeSection>
  );
}
