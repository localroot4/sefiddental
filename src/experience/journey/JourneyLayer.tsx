'use client';

/**
 * The journey layer (docs/experience/journey.md sections 4 to 6): it hosts the journey driver
 * (driver.ts) and draws what WebGL does not, under the page text inside `.site` (z-index -1,
 * after the warm layer), `aria-hidden` and without pointer events. The bands that paint the
 * booking and footer stages' own colours while those stages are transparent (so the courier
 * shows over them and every text pair keeps its contrast) are absolute boxes in `.site`'s own
 * coordinates, so they scroll natively with their stages; one fixed layer holds the DOM courier
 * of tier 1
 * (and the fallback at tiers 2 and 3 until, or whenever, the WebGL courier does not draw): the
 * inline SVG mark and tooth, moved by the pose with transforms only. The whip turns the spin box
 * edge-on and swaps the two forms; the smile station draws the arch as an SVG. The breath is a
 * CSS animation, so a page at rest runs no script loop. Loaded with the engine chunk at tiers 1
 * to 3; tier 0 and reduced motion never load it.
 */
import { useEffect, useRef } from 'react';

import { CROWN, MOLAR_LEVELS, ROOTS } from '@/components/home/MolarStepper';

import { applyStyle } from '../core/applyStyle';
import { levelFromChoice } from '../scenes/webgl/math';

import { ARCH_SLOT, archLayout, footprintAngle, projectArch } from './arch';
import { createJourney, type BandId, type Frame, type EngineTicks, type Journey } from './driver';
import { archFrame, CROWN_SHARE, domSpin, holdRanges, idleAmount, seatAmount } from './pose';

/** The courier's box before its scale (px). */
const BOX = 100;
const TEETH = archLayout();
const SLOT = TEETH[ARCH_SLOT]!;
const CROWN_RATIO = 0.82;

const LAYER = {
  position: 'fixed',
  inset: '0',
  'z-index': '-1',
  'pointer-events': 'none',
  contain: 'strict',
  overflow: 'hidden',
} as const;

const deg = (rad: number): number => (rad * 180) / Math.PI;

/** One crown seen from above, in arch units, at the origin. */
function Crown(props: { width: number; className?: string }) {
  const h = props.width * CROWN_RATIO;
  return (
    <rect
      x={-props.width / 2}
      y={-h / 2}
      width={props.width}
      height={h}
      rx={props.width * 0.38}
      strokeWidth={0.006}
      className={props.className ?? 'fill-surface-raised stroke-brand'}
    />
  );
}

export default function JourneyLayer(props: {
  root: HTMLElement;
  engine: EngineTicks;
  tier: number;
  /** `?debug=1`: the e2e probe `window.__sefidJourney` (pose, holds, which courier draws). */
  debug: boolean;
  onJourney(journey: Journey | null): void;
}): React.JSX.Element {
  const { root, engine, tier, debug, onJourney } = props;
  const layer = useRef<HTMLDivElement>(null);
  const bands = useRef<Partial<Record<BandId, HTMLDivElement | null>>>({});
  const courier = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const tooth = useRef<SVGSVGElement>(null);
  const crown = useRef<SVGSVGElement>(null);
  const arch = useRef<SVGSVGElement>(null);
  const levels = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    applyStyle(layer.current, LAYER);
    let lastLevel = -1;
    let placed: Frame['bands'] | null = null;
    const render = ({ pose, scrollY, bands: measured, docks, webgl }: Frame): void => {
      // The bands scroll with the page (document coordinates in `.site`): written only when a
      // measure moved them, never per frame, so a native fling never slides them.
      if (measured !== placed) {
        placed = measured;
        const site = bands.current.booking?.parentElement?.offsetParent;
        const siteTop = site ? site.getBoundingClientRect().top + window.scrollY : 0;
        for (const id of ['booking', 'footer'] as const) {
          const el = bands.current[id];
          const band = measured.find((b) => b.id === id);
          if (!el) continue;
          el.style.setProperty('visibility', band ? 'visible' : 'hidden');
          if (!band) continue;
          el.style.setProperty('top', `${band.top - siteTop}px`);
          el.style.setProperty('height', `${band.height}px`);
        }
      }

      const box = courier.current;
      const show = !webgl && !pose.hidden;
      box?.style.setProperty('visibility', show ? 'visible' : 'hidden');
      if (box && show) {
        box.style.setProperty(
          'transform',
          `translate3d(${pose.x - BOX / 2}px, ${pose.y - BOX / 2}px, 0) scale(${pose.scale / BOX})`,
        );
        box.style.setProperty('--breathe', String(idleAmount(pose)));
        // Seated in the arch the tooth is a crown seen from above: its turn is the footprint's.
        spin.current?.style.setProperty('transform', `rotateY(${domSpin(pose)}rad)`);
        const isTooth = pose.form === 'tooth';
        const fade = isTooth ? 1 - pose.smile : 1;
        mark.current?.style.setProperty('opacity', isTooth ? '0' : '1');
        const seat = seatAmount(pose);
        tooth.current?.style.setProperty('opacity', String(isTooth ? fade * (1 - seat) : 0));
        crown.current?.style.setProperty('opacity', String(isTooth ? fade * seat : 0));
        // The chips' level at the restoration dock, plain everywhere else.
        const level =
          pose.dock === 'restoration'
            ? levelFromChoice(
                root
                  .querySelector('[data-scene="restoration"] [data-choices]')
                  ?.getAttribute('data-choice') ?? null,
              )
            : 0;
        if (level !== lastLevel) {
          levels.current.forEach((g, i) =>
            g?.style.setProperty('opacity', i === level ? '1' : '0'),
          );
          lastLevel = level;
        }
      }

      const smileDock = docks.find((d) => d.id === 'smile');
      const drawArch =
        !webgl && pose.dock === 'smile' && pose.arch > 0 && pose.smile < 1 && smileDock;
      const svg = arch.current;
      svg?.style.setProperty('visibility', drawArch ? 'visible' : 'hidden');
      if (svg && drawArch) {
        const frame = archFrame(smileDock, scrollY, pose.local);
        svg.style.setProperty(
          'transform',
          `translate3d(${frame.cx - BOX / 2}px, ${frame.cy - BOX / 2}px, 0) scale(${frame.width / BOX})`,
        );
        svg.style.setProperty('opacity', String(pose.arch * (1 - pose.smile)));
      }
    };
    const journey = createJourney({ root, engine, tier, render });
    onJourney(journey);
    const probe = window as { __sefidJourney?: unknown };
    if (debug) {
      probe.__sefidJourney = {
        pose: journey.pose,
        holds: () =>
          holdRanges(journey.docks(), journey.viewport()).map((h) => ({
            id: h.dock.id,
            start: h.start,
            end: h.end,
          })),
        webgl: journey.webgl,
        measure: journey.measure,
      };
    }
    return () => {
      if (debug) delete probe.__sefidJourney;
      onJourney(null);
      journey.destroy();
    };
  }, [root, engine, tier, debug, onJourney]);

  const slotAngle = deg(footprintAngle(SLOT.yaw));
  return (
    <>
      {/* In `.site`'s own coordinates (its containing block), under every section. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-1">
        <div
          ref={(el) => {
            bands.current.booking = el;
          }}
          data-band="booking"
          className="invisible absolute inset-x-0 top-0 bg-warm-soft"
        />
        <div
          ref={(el) => {
            bands.current.footer = el;
          }}
          data-band="footer"
          className="invisible absolute inset-x-0 top-0 bg-surface-sunken"
        />
      </div>
      <div ref={layer} data-courier-layer="" aria-hidden="true">
        <svg
          ref={arch}
          data-courier-arch=""
          viewBox="-0.5 -0.5 1 1"
          className="invisible absolute top-0 left-0 size-[100px] origin-top-left overflow-visible"
        >
          {TEETH.map((t, i) => {
            if (i === ARCH_SLOT) return null;
            const p = projectArch(t);
            return (
              <g
                key={i}
                transform={`translate(${p.u} ${p.v}) rotate(${deg(footprintAngle(t.yaw))})`}
              >
                <Crown width={t.width} className="fill-surface-raised stroke-brand/60" />
              </g>
            );
          })}
        </svg>
        <div
          ref={courier}
          data-courier=""
          className="invisible absolute top-0 left-0 size-[100px] origin-top-left [perspective:420px]"
        >
          <div data-courier-breathe="" className="size-full">
            <div ref={spin} className="relative size-full [transform-style:preserve-3d]">
              <svg
                ref={mark}
                data-form="mark"
                viewBox="0 0 168.03 207.3"
                className="absolute inset-0 m-auto h-[92%] w-auto fill-brand [backface-visibility:hidden]"
              >
                <use href="#lockup-mark" width="168.03" height="207.3" />
              </svg>
              <svg
                ref={tooth}
                data-form="tooth"
                viewBox="0 0 200 240"
                className="absolute inset-0 m-auto h-full w-auto opacity-0"
              >
                {MOLAR_LEVELS.map(({ level, fill }, i) => (
                  <g
                    key={level}
                    ref={(el) => {
                      levels.current[i] = el;
                    }}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    className={`stroke-brand transition-opacity duration-(--dur-4) ${fill} ${i === 0 ? '' : 'opacity-0'}`}
                  >
                    <path d={ROOTS} />
                    <path d={CROWN} />
                  </g>
                ))}
              </svg>
              <svg
                ref={crown}
                data-form="crown"
                viewBox="-0.5 -0.5 1 1"
                className="absolute inset-0 size-full overflow-visible opacity-0"
              >
                <g transform={`rotate(${slotAngle})`}>
                  <Crown width={CROWN_SHARE} className="fill-surface-raised stroke-brand" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
