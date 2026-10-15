import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';

import { cx } from './cx';

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
 * A missing client photo (freeze F3): a neutral block naming the photo it waits for, «جای عکس:
 * …», visible text in Persian digits. `fill` fills a positioned frame (MediaFrame) with a dashed
 * outline; `card` fills a card's media slot with only the bottom border; `standalone` has its own
 * ratio and radius. Every placement has a row in docs/content/gaps.md.
 */
export function MediaPlaceholder(props: {
  caption: string;
  ratio?: Ratio;
  variant?: 'fill' | 'standalone' | 'card';
  className?: string;
}) {
  const variant = props.variant ?? 'fill';
  return (
    <div
      className={cx(
        'grid place-items-center bg-surface-sunken p-4 text-center text-caption text-ink-muted',
        variant === 'fill' &&
          'absolute inset-0 rounded-[inherit] border border-dashed border-line-strong',
        variant === 'card' && 'absolute inset-0 border-b border-dashed border-line-strong',
        variant === 'standalone' &&
          cx('rounded-media border border-dashed border-line-strong', RATIO[props.ratio ?? '4:3']),
        props.className,
      )}
    >
      <p className="max-w-[24ch] text-balance">
        <span className="font-semibold">{t('ui.placeholder.prefix')}</span> {props.caption}
      </p>
    </div>
  );
}
