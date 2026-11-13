import { createHash } from 'node:crypto';

import { BRAND_LOCKUP, LOCKUP_SPRITE } from '@/lib/system-pages/staticPage';

// The sprite is a static file (scripts/sync-public-assets.mjs): inline path data rode in every
// page twice, in the HTML and in the hydration payload. /brand/* is cached for a week, so the
// query changes with the drawing.
const href = `/brand/lockup.svg?v=${createHash('sha256').update(LOCKUP_SPRITE).digest('hex').slice(0, 8)}#lockup`;
// The symbol maps its own viewBox onto the box `<use>` gives it, which starts at 0 0: the outer
// viewBox keeps the size only, or its offset crops the top and the start of the drawing.
const [, , width, height] = BRAND_LOCKUP.viewBox.split(' ');

/** The mark's box in the logo's own coordinates (the lockup's mark less the viewBox origin). */
const MARK = { x: 876.6, y: 43.9, width: 168, height: 207.3 };

/**
 * Brand lockup without the Latin line. The wordmark follows the theme ink (currentColor reaches
 * the sprite through `<use>`) while the mark keeps the logo teal. The two are separate windows on
 * the one symbol, so the mark can step aside on its own: in the header it is the journey's first
 * dock (`dock`, docs/experience/journey.md D1): the courier lifts out of it as the reader scrolls
 * and comes back into it at the top. Server component.
 */
export function BrandLogo(props: { className?: string; label: string; dock?: boolean }) {
  const use = <use href={href} width={width} height={height} />;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={props.label}
      className={props.className}
    >
      <svg width="860" height={height} viewBox={`0 0 860 ${height}`}>
        {use}
      </svg>
      <svg
        data-dock={props.dock ? 'header' : undefined}
        x={MARK.x}
        y={MARK.y}
        width={MARK.width}
        height={MARK.height}
        viewBox={`${MARK.x} ${MARK.y} ${MARK.width} ${MARK.height}`}
      >
        {use}
      </svg>
    </svg>
  );
}
