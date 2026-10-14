import { createHash } from 'node:crypto';

import { BRAND_LOCKUP, LOCKUP_SPRITE } from '@/lib/system-pages/staticPage';

// The sprite is a static file (scripts/sync-public-assets.mjs): inline path data rode in every
// page twice, in the HTML and in the hydration payload. /brand/* is cached for a week, so the
// query changes with the drawing.
const href = `/brand/lockup.svg?v=${createHash('sha256').update(LOCKUP_SPRITE).digest('hex').slice(0, 8)}#lockup`;

/**
 * Brand lockup without the Latin line. The wordmark follows the theme ink (currentColor reaches
 * the sprite through `<use>`) while the mark keeps the logo teal. Server component.
 */
export function BrandLogo(props: { className?: string; label: string }) {
  return (
    <svg
      viewBox={BRAND_LOCKUP.viewBox}
      role="img"
      aria-label={props.label}
      className={props.className}
    >
      <use href={href} />
    </svg>
  );
}
