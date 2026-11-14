import { FooterControls } from '@/components/home/FooterControls';
import { QualityControlDeferred } from '@/components/home/QualityControlDeferred';
import { FOOTER_LOGO_CLASS, LOCKUP_VIEW } from '@/components/layout/BrandLogo';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';

/**
 * The five moving parts of the lockup, each at its own place in the footer logo: its symbol's
 * viewBox (LockupParts.tsx) less the lockup's origin, as a share of the lockup (113.7 82.7 1052.6
 * 280). Physical `left`: these are drawing coordinates, the same in both directions. Diamond 3 is
 * the hole in the «ف» disc, so it stays with the letters. Whole class strings only: Tailwind reads
 * them from the source. Every part is a 44 px touch target (its `::before`, centred on the art,
 * at least the art's own box; T-BF5b).
 */
const PARTS: readonly { part: string; box: string }[] = [
  { part: 'mark', box: 'left-[83.277%] top-[15.693%] w-[15.963%] h-[74.036%]' },
  { part: 'bar', box: 'left-[37.270%] top-[27.357%] w-[40.690%] h-[50.607%]' },
  { part: 'diamond-1', box: 'left-[15.343%] top-[86.643%] w-[2.784%] h-[10.500%]' },
  { part: 'diamond-2', box: 'left-[18.250%] top-[86.643%] w-[2.803%] h-[10.500%]' },
  { part: 'diamond-4', box: 'left-[27.798%] top-[2.857%] w-[2.755%] h-[10.464%]' },
];

const HIT =
  'before:absolute before:top-1/2 before:left-1/2 before:size-target before:min-w-full before:min-h-full before:-translate-x-1/2 before:-translate-y-1/2';

/**
 * Scene 11, the footer playground and the «کیفیت جلوه‌ها» control (phase 7 report D9, D15;
 * docs/experience/footer.md): the last child inside `ExperienceRoot`, `data-scene="footer"`, no
 * `data-home-section`. The playground is the footer's own logo (owner 2026-11-14: one footer, the
 * logo inside it): the field lies over SiteFooter right after this root (`top-full`), and its
 * inner box repeats the footer's container and logo size, so the parts sit on the logo's own
 * pieces in CSS alone; the journey measures the mark's box (D8) at its place from the first frame.
 * The field stays invisible and lets every pointer through until scenes/dom/footer.ts runs (tiers
 * 1 to 3): it then sizes the field down to the footer's floor, hides the footer's logo under the
 * letters and parts drawn here, and shows the field. Tier 0, reduced motion and no script: the
 * footer's own static logo. Nothing in flow: the control and a quiet «پخش دوباره» (the keyboard
 * path; its box is there at every tier, invisible and inert until the scene shows it at tiers 1 to
 * 3, D24) sit in the footer's bottom bar (FooterControls).
 */
export function PlaygroundSection() {
  return (
    <div data-scene="footer" data-theme="dark" className="relative">
      <FooterControls>
        <QualityControlDeferred
          labels={{
            legend: t('home.quality.label'),
            auto: t('home.quality.auto'),
            tiers: [
              t('home.quality.tier0'),
              t('home.quality.tier1'),
              t('home.quality.tier2'),
              t('home.quality.tier3'),
            ],
            reducedMotion: t('home.quality.reducedMotion'),
            siteCap: t('home.quality.siteCap'),
            device: t('home.quality.device'),
            saveData: t('home.quality.saveData'),
          }}
        />
        <Button variant="ghost" data-playground-replay="" inert className="invisible">
          {t('home.playground.replay')}
        </Button>
      </FooterControls>
      <div
        data-playground-field=""
        data-world-slot="playground"
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-full z-10 overflow-clip"
      >
        {/* The footer's container and logo box (SiteFooter): the same place, the same size. */}
        <div className="mx-auto w-full max-w-content px-gutter pt-12">
          <div className="relative w-fit">
            <svg viewBox={LOCKUP_VIEW} className={cx('block', FOOTER_LOGO_CLASS)} />
            <svg
              className="absolute top-[21.911%] left-[0.758%] h-[61.496%] w-[36.512%] text-ink"
              fill="currentColor"
            >
              <use href="#lockup-wordmark" />
            </svg>
            {PARTS.map(({ part, box }) => (
              <div
                key={part}
                data-playground-part={part}
                // D8 of the journey: the courier lands on the mark's home box and hands over.
                data-dock={part === 'mark' ? 'footer' : undefined}
                className={cx(
                  'pointer-events-auto absolute touch-none select-none',
                  // The mark's colour is the courier glaze's (globals.css), so the hand-off shows no jump.
                  part !== 'mark' && 'text-ink',
                  HIT,
                  box,
                )}
              >
                <svg className="pointer-events-none block size-full" fill="currentColor">
                  <use href={`#lockup-${part}`} />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
