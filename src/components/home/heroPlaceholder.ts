/**
 * Neutral raster stand-ins for the home hero photo until the client's photo exists (freeze F3,
 * gap 36): the landscape crop from 744 px and the 4:5 phone band, at the photo's widths (storyboard
 * asset list), as AVIF and JPEG under /placeholders. scripts/sync-public-assets.mjs builds them
 * with sharp; the hero renders them through the real <picture>, preload and LCP pipeline. Grain
 * keeps them above Chromium's low-entropy LCP cut (0.05 bits per shown pixel) and under the
 * byte caps. No imports: Node runs this file directly from the sync script.
 */
export const HERO_PLACEHOLDER = {
  landscape: { widths: [1280, 1600, 1920, 2560], height: (w: number) => Math.round((w * 9) / 16) },
  portrait: { widths: [640, 828, 1080], height: (w: number) => Math.round((w * 5) / 4) },
} as const;

export type HeroCrop = keyof typeof HERO_PLACEHOLDER;

export function heroPlaceholderUrl(crop: HeroCrop, width: number, ext: 'avif' | 'jpg'): string {
  return `/placeholders/hero-${crop === 'portrait' ? 'p' : ''}${width}.${ext}`;
}

/** Every file the sync script writes, with its pixel size. */
export function heroPlaceholderFiles(): Array<{ url: string; width: number; height: number }> {
  return (Object.keys(HERO_PLACEHOLDER) as HeroCrop[]).flatMap((crop) =>
    HERO_PLACEHOLDER[crop].widths.flatMap((width) =>
      (['avif', 'jpg'] as const).map((ext) => ({
        url: heroPlaceholderUrl(crop, width, ext),
        width,
        height: HERO_PLACEHOLDER[crop].height(width),
      })),
    ),
  );
}
