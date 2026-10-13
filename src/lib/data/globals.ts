import type { DataFromGlobalSlug, GlobalSlug } from 'payload';

import { cachedRead } from './cache';
import { getPayloadClient } from './payload';
import { colTag, globTag } from './tags';

// Uploads in these globals (static map, default OG image) are populated one level deep.
async function readGlobal<S extends GlobalSlug>(slug: S, depth: 0 | 1) {
  const tags = depth > 0 ? [globTag(slug), colTag('media')] : [globTag(slug)];
  return cachedRead(`global:${slug}`, { depth }, tags, async () => {
    const payload = await getPayloadClient();
    return payload.findGlobal({ slug, depth }) as Promise<DataFromGlobalSlug<S>>;
  });
}

export function getClinic(): Promise<DataFromGlobalSlug<'clinic'>> {
  return readGlobal('clinic', 1);
}

/** @public Frozen signature; consumed in wave 2. */
export function getSeoDefaults(): Promise<DataFromGlobalSlug<'seo-defaults'>> {
  return readGlobal('seo-defaults', 1);
}

export function getFeatures(): Promise<DataFromGlobalSlug<'features'>> {
  return readGlobal('features', 0);
}
