import { MediaPlaceholder, onPreview } from '@/components/ui/Media';
import { t } from '@/i18n/fa';
import { ARCH_PHOTO, ARCH_PHOTO_WIDTHS } from '@/lib/archPhoto';

const CAPTION = 'rounded-badge bg-surface-raised px-3 py-2 text-caption text-ink-muted';
const srcSet = (ext: 'avif' | 'webp'): string =>
  ARCH_PHOTO_WIDTHS.map((w) => `/demo-photos/arch-occlusal-${w}.${ext} ${w}w`).join(', ');

/**
 * The arch band, station D5 of the journey (docs/experience/journey.md sections 2 and 9): between
 * the digital workflow and the before/after pair. The courier tooth seats into the empty first
 * molar of a full upper arch seen from below (`data-dock="smile"`), the camera pulls back, and the
 * 3D arch cross-fades into the occlusal photo, registered to it (src/lib/archPhoto.ts); the
 * courier drives the photo's opacity (`data-smile-photo`) at tiers 1 to 3. Tier 0, reduced motion
 * and no JavaScript show the photo as it is. The client preview (DEMO_CONTENT) shows the owner's
 * photo; elsewhere the slot is the labelled brand placeholder. Decorative band: no heading, no
 * landmark; the dock holds no text.
 */
export function SmileBand() {
  const demo = onPreview();
  return (
    <div data-smile-band="" className="py-section">
      {/* A stage that sticks under the header, the arch centred in the screen, through a room
          of 1.2 screens: the seat, the pull-back, the cross-fade and the hand-off play on a
          still arch. Server HTML at every tier (D24: the boxes stand where tier 1 puts them, and
          nothing grows after hydration); at tier 0 the photo simply holds while the page goes on. */}
      <div className="sticky top-nav mx-auto grid min-h-[calc(100svh-var(--nav-h))] w-full max-w-content content-center justify-items-center gap-3 px-gutter max-lg:pb-sticky-bar print:static print:min-h-0">
        <div className="relative aspect-[4/5] w-full max-w-[min(26rem,calc((100svh-var(--nav-h)-8rem)*0.8))]">
          <div
            data-smile-photo=""
            className="absolute inset-0 overflow-hidden rounded-media bg-[#06090d]"
          >
            {demo ? (
              <picture>
                {(['avif', 'webp'] as const).map((ext) => (
                  <source
                    key={ext}
                    type={`image/${ext}`}
                    srcSet={srcSet(ext)}
                    sizes="(min-width: 744px) 26rem, 100vw"
                  />
                ))}
                <img
                  src={`/demo-photos/arch-occlusal-${ARCH_PHOTO_WIDTHS.at(-1)}.webp`}
                  alt={t('home.smile.archAlt')}
                  width={ARCH_PHOTO.width}
                  height={ARCH_PHOTO.height}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </picture>
            ) : (
              <MediaPlaceholder caption={t('home.smile.photo')} />
            )}
          </div>
          <div data-dock="smile" aria-hidden="true" className="absolute inset-0" />
        </div>
        {demo && ARCH_PHOTO.placeholder ? (
          <p className={CAPTION}>
            <span className="font-semibold">{t('ui.placeholder.prefix')}</span>{' '}
            {t('home.smile.archPlaceholder')}
          </p>
        ) : null}
      </div>
      <div aria-hidden="true" data-pin-room="" className="h-[120svh] print:hidden" />
    </div>
  );
}
