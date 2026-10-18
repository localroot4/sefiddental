import { getFeatures } from '@/lib/data/globals';
import { log } from '@/lib/log/logger';
import type { Feature } from '@/payload-types';

// The features global validates the same pattern; checked again before it reaches a script URL.
const GA4_ID = /^G-[A-Z0-9]{4,}$/;

/** The GA4 measurement id while GA4 is on and the id is valid, else null (the privacy page too). */
export function ga4Id(features: Pick<Feature, 'ga4Enabled' | 'ga4MeasurementId'>): string | null {
  const id = features.ga4Enabled ? features.ga4MeasurementId : null;
  return id && GA4_ID.test(id) ? id : null;
}

/**
 * The optional GA4 loader (conversion.md 9, freeze G16), mounted once by the site layout:
 * nothing at all unless an admin turned GA4 on (CI keeps it off, so pages make zero third-party
 * requests), then the first-party bootstrap /ga4.js with the page's nonce (ga4Boot.ts). A failed
 * settings read renders nothing: measurement never breaks a page.
 */
export async function Analytics({ nonce }: { nonce?: string }) {
  const id = await getFeatures().then(ga4Id, (err: unknown) => {
    log.warn({ msg: 'ga4_settings_unavailable', err });
    return null;
  });
  return id ? <script src="/ga4.js" data-ga4-id={id} nonce={nonce} async /> : null;
}
