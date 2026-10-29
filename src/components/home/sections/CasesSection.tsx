import { CompareSlider } from '@/components/ui/CompareSlider';
import { Icon } from '@/components/ui/Icon';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import type { Case, Service } from '@/payload-types';

import { HomeSection, media, type Copy } from './HomeSection';

type HomeCase = Omit<Case, 'service' | 'doctor'> & { service: Service | null };

/**
 * Scene 6 (family E): one compare slider and up to two thumbnails into the gallery. The figure's
 * wrapper is the `compare` world slot (phase 8 draws the displacement wipe there at tiers 2 and
 * 3 from 1024 px); it and the side text carry `data-enter`, the elements `compare.ts` reveals
 * once on enter at tiers 1 to 3. The slider itself moves from user input only (D12).
 */
export function CasesSection(props: { cases: HomeCase[]; copy: Copy }) {
  const [featured, ...rest] = props.cases.flatMap((c) => {
    const before = media(c.before);
    const after = media(c.after);
    return before && after ? [{ ...c, before, after }] : [];
  });
  if (!featured) return null;
  return (
    <HomeSection
      scene="compare"
      section="compare"
      family="E"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS.cases} className="-ms-2">
          {t('home.cases.all')}
        </TextLink>
      }
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:items-center lg:gap-16">
        <div data-world-slot="compare" data-enter="">
          <figure className="grid gap-3" data-service-key={featured.service?.key}>
            <CompareSlider
              before={
                <Picture
                  media={featured.before}
                  crop="square"
                  sizes="(min-width: 744px) 28rem, 100vw"
                />
              }
              after={
                <Picture
                  media={featured.after}
                  crop="square"
                  sizes="(min-width: 744px) 28rem, 100vw"
                />
              }
              handle={
                <span className="flex">
                  <Icon name="caret-back" size="sm" />
                  <Icon name="caret-forward" size="sm" />
                </span>
              }
              labels={{
                before: t('ui.compare.before'),
                after: t('ui.compare.after'),
                slider: t('ui.compare.label'),
                percent: t('ui.compare.percent'),
              }}
            />
            <figcaption className="text-small text-pretty text-ink-muted">
              {t('ui.compare.consent')}
            </figcaption>
          </figure>
        </div>
        <div className="grid content-start justify-items-start gap-3" data-enter="">
          <h3 className="text-heading font-semibold">{featured.title}</h3>
          {featured.notes ? (
            <p className="max-w-measure text-body text-ink-muted">{featured.notes}</p>
          ) : null}
          {featured.service && buildPath('services', featured.service) ? (
            <TextLink
              standalone
              href={buildPath('services', featured.service) as string}
              className="-ms-2"
            >
              {featured.service.navLabel}
            </TextLink>
          ) : null}
          {rest.length > 0 ? (
            <ul className="mt-4 grid w-full max-w-[28rem] grid-cols-2 gap-3">
              {rest.map((c) => (
                <li key={c.id}>
                  <a
                    href={PAGE_PATHS.cases}
                    className="grid gap-2 rounded-card text-small font-medium text-brand-strong"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-media bg-surface-sunken">
                      <Picture
                        media={c.after}
                        crop="square"
                        sizes="(min-width: 744px) 14rem, 50vw"
                      />
                    </span>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </HomeSection>
  );
}
