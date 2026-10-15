import { preload } from 'react-dom';

import { BookingForm } from '@/components/booking/BookingForm';
import { ButtonLink } from '@/components/ui/Button';
import { FactsRow } from '@/components/ui/Content';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';
import { telHref } from '@/lib/phone';

import type { HeroImage, TrustFact } from './homeView';

const WIDE = '(min-width: 744px)';

const CAPTION = 'rounded-badge bg-surface-raised px-3 py-2 text-caption text-ink-muted';

/**
 * Hero B (family M; brief decision 19, DESIGN.md 7, nav-conversion-hero 2). Phones: the scrim and
 * the compact booking card fill the first screen (at least 100svh minus the 65 px header), then
 * the 4:5 photo band with the trust band on its bottom edge; the LCP is the H1 or the subtext.
 * From 744 px the landscape photo sits behind everything and is the LCP: one preload scoped to
 * that width with fetchpriority=high, while the <img> stays eager at normal priority (C14). From
 * 1024 px the trust band is one row on the hero's bottom edge. Text over the photo sits only on
 * the scrim, the card and the trust band.
 */
export function HomeHero(props: {
  title: string;
  subtext: string;
  image: HeroImage;
  relief: boolean;
  phone: string;
  facts: TrustFact[];
}) {
  const { image } = props;
  preload(image.preloadHref, {
    as: 'image',
    imageSrcSet: image.wide.avif,
    imageSizes: '100vw',
    fetchPriority: 'high',
    media: WIDE,
    type: 'image/avif',
  });
  return (
    <section
      data-scene="hero"
      data-experience-cover=""
      data-home-section="hero"
      data-family="M"
      aria-labelledby="hero-h1"
      className="relative grid grid-cols-1 overflow-hidden bg-surface-sunken md:block"
    >
      <div className="relative col-start-1 row-start-2 aspect-[4/5] md:absolute md:inset-0 md:aspect-auto">
        <picture>
          <source media={WIDE} type="image/avif" srcSet={image.wide.avif} sizes="100vw" />
          <source
            media={WIDE}
            type={image.wide.otherType}
            srcSet={image.wide.other}
            sizes="100vw"
          />
          <source type="image/avif" srcSet={image.tall.avif} sizes="100vw" />
          <source type={image.tall.otherType} srcSet={image.tall.other} sizes="100vw" />
          <img
            src={image.img.src}
            alt={image.img.alt}
            width={image.img.width}
            height={image.img.height}
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
        {image.placeholder ? (
          <p className={`absolute inset-x-gutter top-4 max-w-[26rem] md:hidden ${CAPTION}`}>
            <span className="font-semibold">{t('ui.placeholder.prefix')}</span>{' '}
            {t('home.hero.photoTall')}
          </p>
        ) : null}
      </div>
      {props.relief ? (
        <Icon
          name="mark"
          size="custom"
          className="pointer-events-none absolute -end-[10%] -top-[4%] hidden aspect-[168.1/207.5] h-auto w-[min(60vw,30rem)] text-surface-raised opacity-70 md:block lg:-end-[5%] lg:-top-[10%] lg:w-[min(38vw,36rem)]"
        />
      ) : null}
      <div className="relative col-start-1 row-start-1 mx-auto grid min-h-[calc(100svh-65px)] w-full max-w-content content-start gap-4 px-gutter pt-2 pb-8 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:content-center md:items-center md:gap-8 md:py-12 lg:min-h-[min(calc(100svh-var(--nav-h)),52rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12 lg:pb-[calc(var(--space-12)+7rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid content-start gap-4 rounded-sheet bg-surface/88 p-6 xl:p-8">
          <h1 id="hero-h1" className="font-display text-hero font-bold md:text-[2rem] lg:text-hero">
            {props.title}
          </h1>
          {props.subtext ? (
            <p id="hero-sub" className="max-w-[36ch] text-body-lg text-ink-muted">
              {props.subtext}
            </p>
          ) : null}
          <div>
            <ButtonLink
              variant="secondary"
              href={telHref(props.phone)}
              track={{ event: 'call_click', location: 'hero' }}
              data-call-sheet=""
              className="px-8"
            >
              {t('call.label')}
            </ButtonLink>
          </div>
        </div>
        <BookingForm variant="compact" instance="hero" className="md:justify-self-end" />
        {image.placeholder ? (
          <p className={`hidden max-w-[34rem] md:col-span-2 md:block ${CAPTION}`}>
            <span className="font-semibold">{t('ui.placeholder.prefix')}</span>{' '}
            {t('home.hero.photoWide')}
          </p>
        ) : null}
      </div>
      {props.facts.length > 0 ? (
        <div
          data-scene="trust"
          data-home-section="trust"
          data-family="B"
          className="relative col-start-1 row-start-2 self-end border-t border-line bg-surface-raised/90 lg:absolute lg:inset-x-0 lg:bottom-0"
        >
          <div className="mx-auto w-full max-w-content px-gutter py-6">
            <FactsRow facts={props.facts} label={t('home.trust.label')} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
