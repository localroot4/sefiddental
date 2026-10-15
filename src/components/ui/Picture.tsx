import { mediaPath } from '@/lib/data/mediaPath';
import type { Media } from '@/payload-types';

import { cx } from './cx';

type SizeName = keyof NonNullable<Media['sizes']>;

// Payload image sizes (src/collections/Media.ts): WebP with an AVIF twin named `<size>Avif`.
const FAMILY = {
  landscape: ['w640', 'w960', 'w1280', 'w1600', 'w1920', 'w2560'],
  portrait: ['p640', 'p828', 'p1080'],
  square: ['s640', 's1080'],
} as const satisfies Record<string, readonly SizeName[]>;

export type Crop = keyof typeof FAMILY;

type Source = { url: string; width: number; height: number };

function sources(media: Media, crop: Crop, avif: boolean): Source[] {
  return FAMILY[crop].flatMap((name) => {
    const size = media.sizes?.[(avif ? `${name}Avif` : name) as SizeName];
    const url = mediaPath(size?.url);
    return url && size?.width && size.height
      ? [{ url, width: size.width, height: size.height }]
      : [];
  });
}

const srcSet = (list: Source[]) => list.map((s) => `${s.url} ${s.width}w`).join(', ');

/**
 * A Payload image as `<picture>`: AVIF, then WebP, then an `<img>` with width and height for the
 * ratio (freeze F3; next/image writes a style attribute the CSP blocks). It fills its parent
 * (MediaFrame). `priority` is for the LCP image only: eager, `fetchpriority="high"`, no blur;
 * everything else loads lazily over its blur placeholder, a decorative data: image underneath.
 * shortcut: the landscape sizes are centered, not cropped to the focal point; position them
 * through a nonce `<style>` when a photo needs it.
 */
export function Picture(props: {
  media: Media;
  sizes: string;
  crop?: Crop;
  priority?: boolean;
  /** Overrides the media alt; '' for a decorative image. */
  alt?: string;
  className?: string;
}) {
  const crop = props.crop ?? 'landscape';
  const webp = sources(props.media, crop, false);
  const avif = sources(props.media, crop, true);
  const original = mediaPath(props.media.url);
  const fallback = webp.find((s) => s.width >= 960) ?? webp.at(-1);
  const largest = webp.at(-1);
  const src = fallback?.url ?? original;
  if (!src) return null;
  const blur = props.priority
    ? null
    : crop === 'portrait'
      ? props.media.blurDataURLPortrait
      : props.media.blurDataURL;
  return (
    <span className={cx('relative block size-full', props.className)}>
      {blur ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/image writes a style attribute (F3)
        <img
          src={blur}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <picture className="relative block size-full">
        {avif.length ? (
          <source type="image/avif" srcSet={srcSet(avif)} sizes={props.sizes} />
        ) : null}
        {webp.length ? (
          <source type="image/webp" srcSet={srcSet(webp)} sizes={props.sizes} />
        ) : null}
        <img
          src={src}
          alt={props.alt ?? props.media.alt}
          width={largest?.width ?? props.media.width ?? undefined}
          height={largest?.height ?? props.media.height ?? undefined}
          sizes={props.sizes}
          loading={props.priority ? 'eager' : 'lazy'}
          fetchPriority={props.priority ? 'high' : undefined}
          decoding={props.priority ? 'sync' : 'async'}
          className="size-full object-cover"
        />
      </picture>
    </span>
  );
}
