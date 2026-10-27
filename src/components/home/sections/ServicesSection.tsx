import { SERVICE_MARK_OUTLINE, SERVICE_MORPH_VIEWBOX } from '@/brand/serviceIconPaths';
import { type Accent, CategoryTile } from '@/components/ui/Cards';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icons';
import { Section, SectionHeader } from '@/components/ui/Layout';
import { ltr } from '@/components/ui/ltr';
import { MediaPlaceholder } from '@/components/ui/Media';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import type { CatalogCategory } from '@/lib/data/catalog';
import { PAGE_PATHS } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';

import type { Copy } from './HomeSection';

/** The ink outline that rests on the morphed silhouette: the accent's default glyph (Cards.tsx). */
const OUTLINE_GLYPH: Record<Accent, IconName> = {
  cosmetic: 'duo-sparkle',
  surgery: 'duo-bandaids',
  restorative: 'duo-tooth',
  ortho: 'duo-smiley',
  kids: 'duo-baby',
};

// One markup for every layout (phase 7 report D6; spec scene 3). Under 1024 px at every tier the
// track is a native snap row bleeding into the gutters; from 1024 px the bento (family C). The
// pinned layout (tiers 2 and 3, `html[data-pins]` from the latch, ENGINE; the scene writes it
// itself until the root does) turns the track into one horizontal row the pin slides, clipped by
// the rail: twice the rail wide at least, so the worlds pass the reader (each world the only
// flex item of its height, never stretched to the featured one).
const TRACK =
  'flex items-start gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-gutter px-gutter pt-1 pb-3 overscroll-x-contain lg:grid lg:grid-cols-3 lg:items-stretch lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-0 lg:snap-none lg:[[data-pins]_&]:flex lg:[[data-pins]_&]:w-max lg:[[data-pins]_&]:items-start lg:[[data-pins]_&]:gap-4 lg:[[data-pins]_&]:overflow-visible';
// The featured world's 4:3 media (the article's only div child) is capped by the viewport height, so
// the heading (160 px), the world and «همهٔ خدمات» stay inside one screen under the nav at
// 1280 x 720 (648 px available: 626 used at 20svh, 20 px over at 26svh).
const WORLD =
  'shrink-0 basis-[min(84vw,360px)] snap-center lg:basis-auto lg:snap-align-none lg:[[data-pins]_&]:w-[min(40vw,30rem)] lg:[[data-pins]_&>div]:max-h-[20svh]';

/** Scene 3 (family C): one tile per category, the first (cosmetic) large; standalone ones link to their service. */
export function ServicesSection(props: { tree: CatalogCategory[]; copy: Copy }) {
  const categories = props.tree.filter((c) => c.path);
  if (categories.length === 0) return null;
  const id = 'home-services-title';
  const accents = categories.map((c) => c.accent);
  // The mark (at most 96 px, its own paint layer): the silhouette the morph drives, then one ink
  // outline per world, crossfaded in by the scene; static at tier 0.
  const mark = (
    <div data-mark="" aria-hidden="true" className="relative size-16 contain-paint md:size-24">
      <svg viewBox={SERVICE_MORPH_VIEWBOX} className="absolute inset-0 size-full fill-brand">
        <path d={SERVICE_MARK_OUTLINE} />
      </svg>
      {accents.map((accent, i) => (
        <Icon
          key={i}
          name={OUTLINE_GLYPH[accent]}
          size="custom"
          className="absolute inset-0 size-full fill-transparent text-ink opacity-0"
        />
      ))}
    </div>
  );
  return (
    <div data-scene="services" data-home-section="services" data-family="C">
      <Section labelledBy={props.copy ? id : undefined}>
        <div data-stage="" className="lg:[[data-pins]_&]:min-h-[calc(100svh-var(--nav-h))]">
          {props.copy ? (
            <SectionHeader
              id={id}
              title={props.copy.heading}
              lead={props.copy.intro ? ltr(props.copy.intro) : undefined}
              action={mark}
              className="lg:[[data-pins]_&]:mb-6"
            />
          ) : (
            <div className="mb-8 md:mb-12">{mark}</div>
          )}
          <div data-rail="" className="-mx-gutter lg:mx-0 lg:[[data-pins]_&]:overflow-x-clip">
            <div
              data-track=""
              data-worlds={accents.join(' ')}
              data-lenis-prevent-horizontal=""
              className={TRACK}
            >
              {categories.map((category, i) => (
                <CategoryTile
                  key={category.key}
                  href={category.path as string}
                  title={category.title}
                  accent={category.accent}
                  icon={category.icon}
                  list={
                    category.standalone
                      ? (category.summary ?? category.services[0]?.summary ?? undefined)
                      : category.services.map((s) => s.navLabel).join('، ')
                  }
                  count={
                    category.standalone
                      ? undefined
                      : `${formatNumberFa(category.services.length)} ${t('home.services.unit')}`
                  }
                  featured={i === 0}
                  media={
                    i === 0 ? <MediaPlaceholder caption={t('home.services.photo')} /> : undefined
                  }
                  className={WORLD}
                />
              ))}
            </div>
          </div>
          {/* The link follows the five worlds in reading and focus order; the bar (tiers 1 to 3
              under 1024 px) follows the card in view. */}
          <div className="mt-6 flex items-center justify-between gap-4 lg:mt-8 lg:[[data-pins]_&]:mt-4">
            <TextLink standalone href={PAGE_PATHS['services-hub']} className="-ms-2">
              {t('home.services.all')}
            </TextLink>
            <div
              data-progress=""
              role="progressbar"
              aria-label={t('home.services.progress')}
              aria-valuemin={1}
              aria-valuemax={categories.length}
              aria-valuenow={1}
              aria-hidden="true"
              className="h-1 w-24 overflow-hidden rounded-full bg-line opacity-0 lg:hidden"
            >
              <div className="h-full origin-right bg-brand transition-transform" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
