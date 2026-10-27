import { LOCKUP_MARK_PATH } from '@/components/brand/LockupParts';
import { CLINIC_FALLBACK, t } from '@/i18n/fa';
import { INTRO_CSS, INTRO_SCRIPT } from '@/lib/intro/introScript';

import { IntroRemover } from './IntroRemover';

/** The whole mark's viewBox (LockupParts `lockup-mark`); the two halves are placed inside it. */
const MARK_BOX = '990.27 126.64 168.03 207.3';
/** The mark's centre in lockup units: the frame's origin and the point the hole opens from. */
const CX = 1074.285;
const CY = 230.29;
/** Half-side of the frame's square: at the smallest scale (1.6 x .34) it still covers 2700 px. */
const R = 5000;
const FRAME_PATH = `M${CX - R} ${CY - R}h${2 * R}v${2 * R}h${-2 * R}z${LOCKUP_MARK_PATH}`;

/**
 * Scene 0, the intro overlay (phase 7; report D10, D11, D14; design-direction 8). Server
 * component rendered by `page.tsx` after the lockup sprite, never when the site cap is 0. A
 * closed `<dialog id="intro">` holds its own `<style nonce>`, the frame (the surface-coloured
 * veil with the mark-shaped hole), the lockup parts as one `<svg><use>` each, and the skip
 * button, the only focusable element. `IntroScript`, after the hero's first row, opens the dialog
 * as a modal and drives the stages (introScript.ts): before first paint in Chromium, which
 * honours its render-blocking link; Safari and Firefox can paint the hero uncovered at a parser
 * yield before it (see `IntroScript`). The hero beneath paints at first paint, so the LCP
 * element is unchanged. Motivation: the brand moment of the first seconds carries the brand
 * because the hero has no WebGL (storyboard scene 0). Without JavaScript, under reduced motion
 * and on every other route the dialog stays closed or absent.
 * `IntroRemover` drops it after hydration once `html[data-intro]` is not `playing`; the dialog
 * and the style carry `suppressHydrationWarning` because the script changes the dialog's
 * attributes before hydration and browsers blank the nonce in the DOM.
 */
export function IntroOverlay(props: { nonce: string | undefined }) {
  const { nonce } = props;
  return (
    <IntroRemover>
      <dialog id="intro" aria-label={CLINIC_FALLBACK.name} suppressHydrationWarning>
        <style
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: INTRO_CSS }}
        />
        <svg className="i-f" viewBox={`${CX - 0.5} ${CY - 0.5} 1 1`} aria-hidden="true">
          <path fillRule="evenodd" d={FRAME_PATH} />
        </svg>
        <div className="i-lk" aria-hidden="true">
          <svg className="i-m">
            <use href="#lockup-mark" />
          </svg>
          <svg className="i-sl" viewBox={MARK_BOX}>
            <use href="#lockup-stroke-left" x="990.27" y="126.64" width="92.98" height="207.3" />
          </svg>
          <svg className="i-sr" viewBox={MARK_BOX}>
            <use href="#lockup-stroke-right" x="1083.25" y="126.64" width="75.05" height="207.3" />
          </svg>
          <svg className="i-w">
            <use href="#lockup-wordmark" />
          </svg>
          <svg className="i-b">
            <use href="#lockup-bar" />
          </svg>
          <svg className="i-d i-d1">
            <use href="#lockup-diamond-1" />
          </svg>
          <svg className="i-d i-d2">
            <use href="#lockup-diamond-2" />
          </svg>
          <svg className="i-d i-d3">
            <use href="#lockup-diamond-3" />
          </svg>
          <svg className="i-d i-d4">
            <use href="#lockup-diamond-4" />
          </svg>
        </div>
        <button type="button" className="i-skip">
          {t('home.intro.skip')}
        </button>
      </dialog>
    </IntroRemover>
  );
}

/**
 * The intro's inline script, rendered by `HomeHero` after its first row (the H1 block and the
 * booking card; never when the site cap is 0); it needs only the dialog before it. The parser
 * yields after it (`showModal()` forces style and layout), so the H1 and the subtext, parsed by
 * then, paint in the first frame under the overlay and the LCP is the first contentful paint;
 * with the script after the dialog the H1 painted one or two frames later. The render-blocking
 * `<link rel="expect">` (hoisted to `<head>`) holds every frame until the script is parsed.
 * It lets go at the parse, not the run: in about 4% of cold loads in Chromium a frame paints the
 * first row uncovered for 12 to 72 ms before `showModal()` (5 of 120 at 4x CPU; the page before
 * this change painted the header before the dialog in 30 of 30). An empty element after the
 * script as the link's target closed that window (0 of 120) but let more chunk evaluations land
 * before the first frame, and Lighthouse's simulated tier 0 LCP rose from a 2415 to a 2570 ms
 * median (gate 2500 on the best of 5), so the link names the script. Only Chromium honours the
 * link: in Safari and Firefox a parser yield can paint the hero markup from its `<section>` to
 * here uncovered (about 9 KB; T-IN11 caps it at 10 KB), so it ends with the first row. The script
 * stays in the DOM: it ran once.
 */
export function IntroScript(props: { nonce: string | undefined }) {
  return (
    <>
      <link rel="expect" href="#intro-script" blocking="render" />
      <script
        id="intro-script"
        nonce={props.nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }}
      />
    </>
  );
}
