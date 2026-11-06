import { MediaPlaceholder } from '@/components/ui/Media';
import { t } from '@/i18n/fa';

/**
 * The smile band, station D5 of the journey (docs/experience/journey.md): between the digital
 * workflow and the before/after pair. The courier tooth seats into a full arch in the empty box
 * (`data-dock="smile"`), the camera pulls back, and the arch dissolves into the smile photo:
 * the courier drives the photo's opacity (`data-smile-photo`) at tiers 1 to 3. Tier 0, reduced
 * motion and no JavaScript show the photo as it is, the band's static art. The photo is a 3:2
 * brand placeholder until the clinic sends one (gaps row 65); the client preview shows a stock
 * smile (DEMO_CONTENT). Decorative band: no heading, no landmark; the dock holds no text.
 */
export function SmileBand() {
  return (
    <div data-smile-band="" className="py-section">
      <div className="mx-auto w-full max-w-content px-gutter">
        <div className="relative mx-auto aspect-[3/2] w-full max-w-[40rem]">
          <div data-smile-photo="" className="absolute inset-0 overflow-hidden rounded-media">
            <MediaPlaceholder caption={t('home.smile.photo')} demo="smile" />
          </div>
          <div data-dock="smile" aria-hidden="true" className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
