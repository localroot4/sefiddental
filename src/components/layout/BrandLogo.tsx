import { createHash } from 'node:crypto';

import { LOCKUP_MARK_PATH } from '@/components/brand/LockupParts';
import { BRAND_LOCKUP, LOCKUP_SPRITE } from '@/lib/system-pages/staticPage';

// The sprite is a static file (scripts/sync-public-assets.mjs): inline path data rode in every
// page twice, in the HTML and in the hydration payload. /brand/* is cached for a week, so the
// query changes with the drawing.
const href = `/brand/lockup.svg?v=${createHash('sha256').update(LOCKUP_SPRITE).digest('hex').slice(0, 8)}#lockup`;
// The symbol maps its own viewBox onto the box `<use>` gives it, which starts at 0 0: the outer
// viewBox keeps the size only, or its offset crops the top and the start of the drawing.
const [, , width, height] = BRAND_LOCKUP.viewBox.split(' ');
/** The logo's own viewBox: the lockup's size from 0 0. */
export const LOCKUP_VIEW = `0 0 ${width} ${height}`;
/**
 * The footer logo's size (SiteFooter), shared with the home playground's field, which lays its
 * parts over this logo (PlaygroundSection): one string, so the two boxes never drift apart.
 */
// By width (72 and 80 px tall at a 16 px root), never wider than its column: at a 200 % root
// font a height in rem widened the phone page past the screen (T-PH6).
export const FOOTER_LOGO_CLASS = 'h-auto w-[16.9375rem] max-w-full md:w-[18.8125rem]';

/** The mark's box in the logo's own coordinates (the lockup's mark less the viewBox origin). */
const MARK = { x: 876.6, y: 43.9, width: 168, height: 207.3 };
const [ORIGIN_X = 0, ORIGIN_Y = 0] = BRAND_LOCKUP.viewBox.split(' ').map(Number);

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
      viewBox={LOCKUP_VIEW}
      role="img"
      aria-label={props.label}
      className={props.className}
      // The socket's echo spreads past the logo's edge (below).
      overflow={props.dock ? 'visible' : undefined}
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
      {props.dock ? (
        // The mark's outline, right after the mark's window and on its box: a faint socket while
        // the courier carries the mark, and the echo as it lands back (globals.css
        // `[data-logo-socket]`). Its own window may overflow: the mark's clips the lockup it shows
        // (the transform is the group's, the echo's scale the path's own).
        <svg
          x={MARK.x}
          y={MARK.y}
          width={MARK.width}
          height={MARK.height}
          viewBox={`${MARK.x} ${MARK.y} ${MARK.width} ${MARK.height}`}
          overflow="visible"
        >
          <g transform={`translate(${-ORIGIN_X} ${-ORIGIN_Y})`}>
            <path data-logo-socket="" d={LOCKUP_MARK_PATH} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      ) : null}
    </svg>
  );
}

/**
 * The footer's emblem (owner 2026-11-16: a background that shows the brand): the mark's own
 * outline as one fine line, like an architect's drawing of the logo, over a whisper of its fill.
 * The line keeps 1 px at any size (`non-scaling-stroke`). Decorative (`aria-hidden`); its colour
 * and fade are globals.css `.footer-emblem`.
 */
export function FooterEmblem(props: { className?: string }) {
  return (
    <svg viewBox="986 122 176 216" aria-hidden="true" className={props.className}>
      <path
        d={BRAND_LOCKUP.markPath}
        fill="currentColor"
        fillOpacity="0.05"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
