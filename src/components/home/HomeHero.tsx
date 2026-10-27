import { preload } from 'react-dom';

import { BookingForm } from '@/components/booking/BookingForm';
import { ButtonLink } from '@/components/ui/Button';
import { FactsRow } from '@/components/ui/Content';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';
import { telHref } from '@/lib/phone';

import { heroRelief, type HeroImage, type TrustFact } from './homeView';

const WIDE = '(min-width: 744px)';

const CAPTION = 'rounded-badge bg-surface-raised px-3 py-2 text-caption text-ink-muted';

/**
 * The settle after the intro (scene 1, phase 7 D11): CSS only, keyed on `html[data-intro]` from
 * the inline intro script. While the intro plays, the scrim text and the card wait 12 px lower
 * (16 px from 744 px) under the overlay; at `done` they rise with --dur-4 in 60 ms steps by
 * position, transform only, so the H1 and the subtext stay the LCP candidates on phones and a
 * focus inside the card is never blocked. Without the intro (skipped, seen, reduced motion, a
 * site cap of 0) the attribute is `done` or absent: no offset, no transition. Motivation: the
 * settle hands the eye from the mark to the promise and then to the action.
 */
const SETTLE =
  '[html[data-intro=playing]_&]:translate-y-[12px] md:[html[data-intro=playing]_&]:translate-y-[16px] [html[data-intro=done]_&]:translate-y-0 [html[data-intro=done]_&]:transition-[translate] [html[data-intro=done]_&]:duration-(--dur-4) [html[data-intro=done]_&]:ease-out';
const SETTLE_STEP = [
  '',
  '[html[data-intro=done]_&]:delay-[60ms]',
  '[html[data-intro=done]_&]:delay-[120ms]',
  '[html[data-intro=done]_&]:delay-[180ms]',
] as const;

/**
 * Hero B (family M; brief decision 19, DESIGN.md 7, nav-conversion-hero 2). Phones: the scrim and
 * the compact booking card fill the first screen (at least 100svh minus the 65 px header), then
 * the 4:5 photo band with the trust band on its bottom edge; the LCP is the H1 or the subtext.
 * From 744 px the landscape photo sits behind everything and is the LCP: one preload scoped to
 * that width with fetchpriority=high, while the <img> stays eager at normal priority (C14). Text
 * over the photo sits only on the scrim, the card and the trust band. The scrim comes before the
 * photo in the markup: a streamed first frame that holds only the photo would paint it under the
 * header on phones, make it the LCP and then shift it below the fold. The photo and the relief
 * sit behind the scrim by z-index in the section's own stacking context.
 *
 * From 1024 px (phase 7 D18) the trust band leaves the photo's edge and is a 40 vh row under it,
 * the world window where phase 8 draws behind the facts (`data-world-slot="hero-exit"`); the
 * photo is bounded and clipped by the inner wrapper, so its exit parallax (scenes/dom/hero.ts
 * moves `[data-hero-photo]` at tiers 1 to 3) never slides under the band. Everything is server
 * HTML at every tier: nothing appears or grows after hydration (CLS 0). Under 1024 px the inner
 * wrapper is `display: contents`, so the grid, the photo and the band keep the phase 4 layout.
 * The slot attribute is present at every width; it is a window only from 1024 px. From 1024 px
 * the sunken surface moves from the section to the inner wrapper (its own stacking context, so it
 * stays under the photo), and the band sits on the page surface: nothing of the hero paints over
 * the world behind the page.
 */
export function HomeHero(props: {
  title: string;
  subtext: string;
  image: HeroImage;
  /** The «نقش برجستهٔ لوگو» feature; shown only on a real photo (homeView.heroRelief). */
  relief: boolean;
  phone: string;
  facts: TrustFact[];
  /**
   * The intro's inline script (IntroOverlay.tsx `IntroScript`): after the first row (the H1
   * block and the booking card), whole in the first frame; from 744 px a card painted a frame
   * after the H1 block re-centres it (layout shift 0.03 at 820 px, 0.06 at 1440 px).
   */
  intro?: React.ReactNode;
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
      className="relative isolate grid grid-cols-1 overflow-hidden bg-surface-sunken md:block lg:bg-transparent"
    >
      <div className="contents lg:relative lg:isolate lg:block lg:overflow-clip lg:bg-surface-sunken">
        <div className="relative col-start-1 row-start-1 mx-auto grid min-h-[calc(100svh-65px)] w-full max-w-content content-start gap-4 px-gutter pt-2 pb-8 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:content-center md:items-center md:gap-8 md:py-12 lg:min-h-[min(calc(100svh-var(--nav-h)),52rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="grid content-start gap-4 rounded-sheet bg-surface/88 p-6 xl:p-8">
            <h1
              id="hero-h1"
              className={`font-display text-hero font-bold md:text-[2rem] lg:text-hero ${SETTLE}`}
            >
              {props.title}
            </h1>
            {props.subtext ? (
              <p
                id="hero-sub"
                className={`max-w-[36ch] text-body-lg text-ink-muted ${SETTLE} ${SETTLE_STEP[1]}`}
              >
                {props.subtext}
              </p>
            ) : null}
            <div className={`${SETTLE} ${SETTLE_STEP[2]}`}>
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
          <BookingForm
            variant="compact"
            instance="hero"
            className={`md:justify-self-end ${SETTLE} ${SETTLE_STEP[3]}`}
          />
          {image.placeholder ? (
            <p className={`hidden max-w-[34rem] md:col-span-2 md:block ${CAPTION}`}>
              <span className="font-semibold">{t('ui.placeholder.prefix')}</span>{' '}
              {t('home.hero.photoWide')}
            </p>
          ) : null}
        </div>
        {props.intro}
        <div
          data-hero-photo=""
          className="relative -z-10 col-start-1 row-start-2 aspect-[4/5] md:absolute md:inset-0 md:aspect-auto"
        >
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
        {heroRelief(props.relief, image) ? (
          <Icon
            name="mark"
            size="custom"
            className="pointer-events-none absolute -z-10 -end-[10%] -top-[4%] hidden aspect-[168.1/207.5] h-auto w-[min(60vw,30rem)] text-surface-raised opacity-70 md:block lg:-end-[5%] lg:-top-[10%] lg:w-[min(38vw,36rem)]"
          />
        ) : null}
      </div>
      {props.facts.length > 0 ? (
        <div
          data-scene="trust"
          data-home-section="trust"
          data-family="B"
          data-world-slot="hero-exit"
          className="relative col-start-1 row-start-2 self-end border-t border-line bg-surface-raised/90 lg:grid lg:min-h-[40vh] lg:content-center lg:bg-transparent"
        >
          <div className="mx-auto w-full max-w-content px-gutter py-6">
            <FactsRow facts={props.facts} label={t('home.trust.label')} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
