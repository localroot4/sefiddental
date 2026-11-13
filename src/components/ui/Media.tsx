import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';
import { DEMO_KINDS, DEMO_PHOTOS, demoPhotoUrl, type DemoPhotoKey } from '@/lib/demoPhotos';
import { readEnv } from '@/lib/env';

import { cx } from './cx';
import { PLACEHOLDER_SURFACE } from './Feedback';
import { Icon } from './Icon';

/**
 * Image ratios of DESIGN.md section 4. `hero` is the inner-page hero frame: 4:5 up to 1023 px,
 * 3:2 from 1024 (design-components Q-4).
 */
export const RATIO = {
  '4:5': 'aspect-[4/5]',
  '3:2': 'aspect-[3/2]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  hero: 'aspect-[4/5] lg:aspect-[3/2]',
} as const;

export type Ratio = keyof typeof RATIO;

/**
 * Plain media frame (family A): fixed ratio, 24 px radius, no mark mask. The image or the
 * placeholder fills it.
 */
export function MediaFrame(props: { ratio: Ratio; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-media bg-surface-sunken',
        RATIO[props.ratio],
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

/**
 * Whether this is the client preview (DEMO_CONTENT): the «جای عکس» captions show, where the clinic
 * sees which photo goes where, and a slot with a demo photo (src/lib/demoPhotos.ts) shows it.
 * Unset is off, so readEnv parses the flag only when it is set: a page or a test without the full
 * environment never needs it.
 */
export function onPreview(): boolean {
  return Boolean(process.env.DEMO_CONTENT) && readEnv().demoContent;
}

const srcSet = (
  key: DemoPhotoKey,
  crop: 'wide' | 'tall',
  widths: readonly number[],
  ext: 'avif' | 'webp',
) => widths.map((w) => `${demoPhotoUrl(key, crop, w, ext)} ${w}w`).join(', ');

/**
 * A demo photo of the client preview in a placeholder's box: `<picture>` with AVIF, then WebP; a
 * `frame` photo switches from its 4:5 crop to the 3:2 crop at 1024 px, as the hero frame does
 * (RATIO.hero), and loads eagerly at high priority (the inner page's LCP, as Picture `priority`).
 */
function DemoPicture(props: { photo: DemoPhotoKey; className: string }) {
  const { kind, alt } = DEMO_PHOTOS[props.photo];
  const files = DEMO_KINDS[kind];
  const main = files.tall.length ? 'tall' : 'wide';
  const largest = files[main].at(-1) ?? 0;
  const frame = kind === 'frame';
  return (
    <picture data-demo-photo={props.photo} className={cx('block', props.className)}>
      {frame
        ? (['avif', 'webp'] as const).map((ext) => (
            <source
              key={ext}
              media="(min-width: 1024px)"
              type={`image/${ext}`}
              srcSet={srcSet(props.photo, 'wide', files.wide, ext)}
              sizes={files.sizes}
            />
          ))
        : null}
      {(['avif', 'webp'] as const).map((ext) => (
        <source
          key={ext}
          type={`image/${ext}`}
          srcSet={srcSet(props.photo, main, files[main], ext)}
          sizes={files.sizes}
        />
      ))}
      <img
        src={demoPhotoUrl(props.photo, main, largest, 'webp')}
        alt={alt}
        width={largest}
        height={Math.round(main === 'tall' ? (largest * 5) / 4 : (largest * 2) / 3)}
        sizes={files.sizes}
        loading={frame ? 'eager' : 'lazy'}
        fetchPriority={frame ? 'high' : undefined}
        decoding={frame ? 'sync' : 'async'}
        className="size-full object-cover"
      />
    </picture>
  );
}

/**
 * A missing client photo (freeze F3): a calm neutral panel (PLACEHOLDER_SURFACE) that names the
 * photo it waits for, with a small photo glyph (decorative). Never the brand mark: the mark is
 * the courier and the logo only, one look everywhere (owner, 2026-11-13). The glyph steps back
 * (invisible, its row kept) when the panel is under 6rem tall. The caption «جای عکس: …» tells the
 * clinic which photo goes where, so it shows on the client preview only (DEMO_CONTENT): a small
 * label in its own row at the bottom start, visible text in Persian digits. Elsewhere the panel
 * is decorative and keeps the caption in `data-photo-slot` for QA. Nothing moves. The
 * panel is a size container, so its content never changes the ratio. `fill` and `card` fill a
 * positioned frame (MediaFrame, a card's media slot) that clips them to its radius; `standalone`
 * has its own ratio and radius. Every placement has a row in docs/content/gaps.md. On the client
 * preview a slot given a `demo` photo shows that photo in the same box instead, without caption.
 */
export function MediaPlaceholder(props: {
  caption: string;
  ratio?: Ratio;
  variant?: 'fill' | 'standalone' | 'card';
  /** The client preview's stock photo for this slot (src/lib/demoPhotos.ts). */
  demo?: DemoPhotoKey;
  className?: string;
}) {
  const box =
    props.variant === 'standalone'
      ? cx('relative overflow-hidden rounded-media', RATIO[props.ratio ?? '4:3'])
      : 'absolute inset-0';
  if (props.demo && onPreview()) {
    return <DemoPicture photo={props.demo} className={cx(box, props.className)} />;
  }
  return (
    <div
      data-photo-slot={props.caption}
      className={cx(
        '@container-size grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-3 p-4 text-caption text-ink-muted',
        PLACEHOLDER_SURFACE,
        props.variant === 'standalone'
          ? cx('rounded-media', RATIO[props.ratio ?? '4:3'])
          : 'absolute inset-0',
        props.className,
      )}
    >
      <Icon
        name="image"
        size="custom"
        className="size-[min(24%,3rem)] place-self-center text-ink-faint [@container(height<6rem)]:invisible"
      />
      {onPreview() ? (
        <p className="max-w-[30ch]">
          <span className="font-semibold text-brand-strong">{t('ui.placeholder.prefix')}</span>{' '}
          {props.caption}
        </p>
      ) : null}
    </div>
  );
}
