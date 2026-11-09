'use client';

/**
 * The journey layer (docs/experience/journey.md sections 4 to 6): it hosts the journey driver
 * (driver.ts) and draws what WebGL does not, under the page text inside `.site` (z-index -1,
 * after the warm layer), `aria-hidden` and without pointer events. The bands that paint the
 * booking and footer stages' own colours while those stages are transparent (so the courier
 * shows over them and every text pair keeps its contrast) are absolute boxes in `.site`'s own
 * coordinates, so they scroll natively with their stages; one fixed layer holds the DOM courier
 * of tier 1 (and the fallback at tiers 2 and 3 until, or whenever, the WebGL courier does not
 * draw): the SVG mark and tooth in one full-viewport SVG, a group moved by the pose. The whip
 * turns the spin group edge-on (a horizontal scale) and swaps the two forms; the smile station
 * draws the arch as an SVG. The breath is a CSS animation, so a page at rest runs no script loop.
 * Loaded with the engine chunk at tiers 1 to 3; tier 0 and reduced motion never load it.
 */
import { useEffect, useRef } from 'react';

import { CROWN, MOLAR_LEVELS, ROOTS } from '@/components/home/MolarStepper';

import { applyStyle } from '../core/applyStyle';
import { levelFromChoice } from '../scenes/webgl/math';

import { ARCH_SLOT, archLayout, footprintAngle, projectArch } from './arch';
import { COURIER_Z } from './attrs';
import { createJourney, type BandId, type Frame, type EngineTicks, type Journey } from './driver';
import { archFrame, CROWN_SHARE, domSpin, holdRanges, idleAmount, seatAmount } from './pose';

/** The courier's box before its scale (px). */
const BOX = 100;
const TEETH = archLayout();
const SLOT = TEETH[ARCH_SLOT]!;
const SLOT_AT = projectArch(SLOT);
const CROWN_RATIO = 0.82;

const LAYER = {
  position: 'fixed',
  inset: '0',
  'z-index': COURIER_Z,
  'pointer-events': 'none',
  contain: 'strict',
  overflow: 'hidden',
} as const;

const deg = (rad: number): number => (rad * 180) / Math.PI;

/** The porcelain's edge: a warm shade, not an outline in the brand colour. */
const PORCELAIN_EDGE = '#C8B391';

/**
 * Shared paint of the DOM courier (tier 1 and the fallback): porcelain lit from the upper start
 * side for the tooth and the arch's crowns, a glazed teal for the mark, and a soft contact shadow,
 * so the SVG forms read as objects, not line drawings.
 */
function Paint() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="courier-enamel" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#FFFDF8" />
          <stop offset="0.5" stopColor="#F2E9DA" />
          <stop offset="1" stopColor="#D5C3A6" />
        </linearGradient>
        <radialGradient id="courier-crown" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F1E8D9" />
          <stop offset="1" stopColor="#CDB99A" />
        </radialGradient>
        <linearGradient id="courier-glaze" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#3CC4B8" />
          <stop offset="0.45" stopColor="#0A8A80" />
          <stop offset="1" stopColor="#04524C" />
        </linearGradient>
        <linearGradient id="courier-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {/* The bevel: a light edge on the upper start side, a dark one opposite. */}
        <linearGradient id="courier-bevel" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#E9FFFC" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#E9FFFC" stopOpacity="0" />
          <stop offset="0.6" stopColor="#022E2B" stopOpacity="0" />
          <stop offset="1" stopColor="#022E2B" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="courier-shadow">
          <stop offset="0" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const LEVEL_NAMES = MOLAR_LEVELS.map((l) => l.level);

/** One crown seen from above, in arch units, at the origin. */
function Crown(props: { width: number; depth?: number }) {
  const h = props.width * CROWN_RATIO * (props.depth ?? 1);
  return (
    <rect
      x={-props.width / 2}
      y={-h / 2}
      width={props.width}
      height={h}
      rx={props.width * 0.38}
      fill="url(#courier-crown)"
      stroke={PORCELAIN_EDGE}
      strokeWidth={0.004}
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
  const courier = useRef<SVGGElement>(null);
  const spin = useRef<SVGGElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const tooth = useRef<SVGSVGElement>(null);
  const crown = useRef<SVGSVGElement>(null);
  const top = useRef<SVGSVGElement>(null);
  const shadow = useRef<SVGSVGElement>(null);
  const arch = useRef<SVGSVGElement>(null);
  const glint = useRef<HTMLDivElement>(null);
  const spark = useRef<HTMLDivElement>(null);
  const levels = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    applyStyle(layer.current, LAYER);
    let lastLevel = -1;
    let placed: Frame['bands'] | null = null;
    const render = ({ pose, shown, scrollY, bands: measured, docks, webgl }: Frame): void => {
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
      // The breath pauses while the DOM courier is hidden.
      if (box && box.hasAttribute('data-shown') !== show) box.toggleAttribute('data-shown', show);
      if (box && show) {
        // The shown place (the pose with its spring, lean and squash, motion.ts), about the
        // drawing's centre.
        const k = shown.scale / BOX;
        box.setAttribute(
          'transform',
          `translate(${shown.x} ${shown.y}) rotate(${deg(shown.tilt)}) scale(${k * shown.sx} ${k * shown.sy})`,
        );
        box.style.setProperty('--breathe', String(idleAmount(pose)));
        // 1 except where a travel has no lane at all (route.ts, the last resort).
        box.style.setProperty('opacity', String(Math.round(pose.opacity * 1000) / 1000));
        // The turn about the vertical axis, seen flat: seated in the arch the tooth is a crown
        // seen from above, whose turn is the footprint's.
        const turn = Math.cos(domSpin(pose));
        spin.current?.setAttribute('transform', `scale(${turn} 1)`);
        const isTooth = pose.form === 'tooth';
        const fade = pose.presence;
        // The mark has no back: it hides once turned past edge-on.
        mark.current?.style.setProperty('opacity', isTooth || turn < 0 ? '0' : String(fade));
        const seat = seatAmount(pose);
        tooth.current?.style.setProperty('opacity', String(isTooth ? fade * (1 - seat) : 0));
        crown.current?.style.setProperty('opacity', String(isTooth ? fade * seat : 0));
        shadow.current?.style.setProperty('opacity', String(fade * (1 - seat)));
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
          // The top view replays its level's own animation (globals.css, courier-top).
          top.current?.setAttribute('data-top-level', String(level));
          lastLevel = level;
        }
        // At D3 the tooth turns its chewing surface to the reader (the top view), in and out of
        // the hold; the side view carries it there and away.
        const topOn =
          isTooth && pose.dock === 'restoration'
            ? Math.min(1, pose.local / 0.12, (1 - pose.local) / 0.12)
            : 0;
        top.current?.style.setProperty('opacity', String(fade * topOn));
        tooth.current?.style.setProperty(
          'opacity',
          String(isTooth ? fade * (1 - seat) * (1 - topOn) : 0),
        );
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
          `translate3d(${frame.cx - frame.width / 2}px, ${frame.cy - frame.width / 2}px, 0) scale(${frame.width / BOX})`,
        );
        svg.style.setProperty('opacity', String(pose.arch * (1 - pose.smile)));
      }

      // The D5 hand-off (both tiers): a light runs along the arch's teeth on the photo, then
      // condenses into a spark on the first molar, out of which the tooth lifts off.
      const spot = glint.current;
      const flash = spark.current;
      const sparkOn = pose.dock === 'smile' ? Math.sin(Math.PI * Math.min(1, pose.lift * 1.6)) : 0;
      const on = smileDock !== undefined && (pose.glint > 0 || sparkOn > 0.01);
      spot?.style.setProperty('visibility', on && pose.glint > 0 ? 'visible' : 'hidden');
      flash?.style.setProperty('visibility', on && sparkOn > 0.01 ? 'visible' : 'hidden');
      if (on && smileDock) {
        const frame = archFrame(smileDock, scrollY, 1);
        const at = (p: { u: number; v: number }) => ({
          x: frame.cx + p.u * frame.width,
          y: frame.cy + p.v * frame.width,
        });
        const crown = SLOT.width * frame.width;
        if (spot && pose.glint > 0) {
          // Along the teeth, one end of the U to the other.
          const f = pose.glint * (TEETH.length - 1);
          const i = Math.min(TEETH.length - 2, Math.floor(f));
          const a = at(projectArch(TEETH[i]!));
          const b = at(projectArch(TEETH[i + 1]!));
          const x = a.x + (b.x - a.x) * (f - i);
          const y = a.y + (b.y - a.y) * (f - i);
          const k = (crown * 1.8) / BOX;
          spot.style.setProperty(
            'transform',
            `translate3d(${x - BOX / 2}px, ${y - BOX / 2}px, 0) scale(${k})`,
          );
          spot.style.setProperty('opacity', String(Math.sin(Math.PI * pose.glint)));
        }
        if (flash && sparkOn > 0.01) {
          const p = at(SLOT_AT);
          const k = (crown * 1.6 * sparkOn) / BOX;
          flash.style.setProperty(
            'transform',
            `translate3d(${p.x - BOX / 2}px, ${p.y - BOX / 2}px, 0) scale(${k})`,
          );
          flash.style.setProperty('opacity', String(sparkOn));
        }
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
        // Where the courier is drawn this frame (the pose with its spring, lean and squash).
        shown: journey.shown,
        planStats: () => journey.lanes()?.stats() ?? null,
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
        <Paint />
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
                <Crown width={t.width} depth={t.depth} />
              </g>
            );
          })}
        </svg>
        {/* The D5 glint: a soft light that runs along the teeth, and the spark on the molar. */}
        <div
          ref={glint}
          data-courier-glint=""
          className="invisible absolute top-0 left-0 size-[100px] origin-center rounded-full [background:radial-gradient(circle,rgb(255_255_255/0.7),rgb(207_245_241/0.28)_40%,transparent_70%)] mix-blend-screen"
        />
        <div
          ref={spark}
          data-courier-spark=""
          className="invisible absolute top-0 left-0 size-[100px] origin-center rounded-full [background:radial-gradient(circle,rgb(255_255_255/0.95),rgb(207_245_241/0.5)_30%,transparent_68%)]"
        />
        {/* The courier is SVG geometry in one fixed, full-viewport SVG: a moved <g> is not a
            box to the browser's layout-shift tracker, which counted the moved HTML box as
            shifting during a touch scroll (T-PH4). Drawn about its centre, in a 100-unit box. */}
        <svg data-courier-stage="" className="absolute inset-0 size-full overflow-visible">
          <g ref={courier} data-courier-body="" className="invisible">
            <g data-courier-breathe="">
              <g ref={spin}>
                <svg
                  ref={shadow}
                  viewBox="0 0 100 100"
                  x="-50"
                  y="-50"
                  width="100"
                  height="100"
                  overflow="visible"
                >
                  <ellipse cx="50" cy="97" rx="34" ry="5" fill="url(#courier-shadow)" />
                </svg>
                <svg
                  ref={mark}
                  data-form="mark"
                  viewBox="0 0 168.03 207.3"
                  x="-50"
                  y="-46"
                  width="100"
                  height="92"
                >
                  <use
                    href="#lockup-mark"
                    width="168.03"
                    height="207.3"
                    fill="url(#courier-glaze)"
                  />
                  <use
                    href="#lockup-mark"
                    width="168.03"
                    height="207.3"
                    fill="url(#courier-sheen)"
                  />
                  <use
                    href="#lockup-mark"
                    width="168.03"
                    height="207.3"
                    fill="none"
                    stroke="url(#courier-bevel)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                </svg>
                <svg
                  ref={tooth}
                  data-form="tooth"
                  viewBox="0 0 200 240"
                  x="-50"
                  y="-50"
                  width="100"
                  height="100"
                  className="opacity-0"
                >
                  <g fill="url(#courier-enamel)" stroke={PORCELAIN_EDGE} strokeWidth="1.5">
                    <path d={ROOTS} />
                    <path d={CROWN} />
                  </g>
                  {/* The levels over the porcelain: VIP a glaze sheen, CIP the warm neck and the
                    stained grooves (the restoration chips choose, at its dock only). */}
                  {LEVEL_NAMES.map((level, i) => (
                    <g
                      key={level}
                      ref={(el) => {
                        levels.current[i] = el;
                      }}
                      fill="none"
                      className={`transition-opacity duration-(--dur-4) ${i === 0 ? '' : 'opacity-0'}`}
                    >
                      {i >= 1 ? (
                        <ellipse cx="82" cy="62" rx="34" ry="14" fill="#FFFFFF" opacity="0.55" />
                      ) : null}
                      {i === 2 ? (
                        <g strokeLinecap="round" className="stroke-warm">
                          <path d="M56 113c20 8 68 8 88 0" strokeOpacity="0.5" strokeWidth="9" />
                          <path d="M78 51c2 9 6 15 12 18m32-18c-2 9-6 15-12 18" strokeWidth="2.2" />
                        </g>
                      ) : null}
                    </g>
                  ))}
                </svg>
                {/* D3's top view: the crown's chewing surface and the level's restoration on it
                  (globals.css courier-top: composite fill, seated inlay, layered ceramic). */}
                <svg
                  ref={top}
                  data-form="top"
                  data-top-level="0"
                  viewBox="0 0 100 100"
                  x="-43"
                  y="-43"
                  width="86"
                  height="86"
                  overflow="visible"
                  className="courier-top opacity-0"
                >
                  <path
                    d="M50 8c14 0 22 4 29 10s13 16 13 30-3 24-10 31-17 13-32 13-25-6-32-13S8 63 8 48s6-24 13-30S36 8 50 8z"
                    fill="url(#courier-crown)"
                    stroke={PORCELAIN_EDGE}
                    strokeWidth="1.2"
                  />
                  {/* The cusps and the central fissure of a molar seen from above. */}
                  <path
                    d="M30 30q10 8 20 4 10 4 20-4M32 70q9-8 18-4 9-4 18 4M50 34v32"
                    fill="none"
                    stroke="#BFA98A"
                    strokeOpacity="0.55"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <g className="ct-plain">
                    <path
                      className="ct-outline"
                      d="M38 40q12-6 24 0 6 10 0 20-12 6-24 0-6-10 0-20z"
                      fill="none"
                      stroke="#9A8670"
                      strokeWidth="1.4"
                      strokeDasharray="70"
                    />
                    <path
                      className="ct-fill"
                      d="M38 40q12-6 24 0 6 10 0 20-12 6-24 0-6-10 0-20z"
                      fill="#E7DCCB"
                      stroke="#B9A78F"
                      strokeWidth="0.8"
                    />
                  </g>
                  <g className="ct-vip">
                    <path
                      className="ct-inlay"
                      d="M37 39l13-5 13 5 3 11-3 11-13 5-13-5-3-11z"
                      fill="url(#courier-enamel)"
                      stroke="#E9DFCF"
                      strokeWidth="0.6"
                    />
                    <rect
                      className="ct-gloss"
                      x="20"
                      y="20"
                      width="12"
                      height="60"
                      fill="#FFFFFF"
                      opacity="0"
                    />
                  </g>
                  <g className="ct-cip">
                    <path
                      className="ct-dentine"
                      d="M37 39l13-5 13 5 3 11-3 11-13 5-13-5-3-11z"
                      fill="#EBD3B4"
                    />
                    <path
                      className="ct-enamel"
                      d="M37 39l13-5 13 5 3 11-3 11-13 5-13-5-3-11z"
                      fill="#FFFDF8"
                      fillOpacity="0.72"
                    />
                    <path
                      className="ct-stain"
                      d="M44 44q6 4 12 0M50 44v12M44 56q6-4 12 0"
                      fill="none"
                      stroke="#A06F3E"
                      strokeOpacity="0.55"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      strokeDasharray="40"
                    />
                    <rect
                      className="ct-shimmer"
                      x="20"
                      y="20"
                      width="10"
                      height="60"
                      fill="#FFFFFF"
                      opacity="0"
                    />
                  </g>
                </svg>
                <svg
                  ref={crown}
                  data-form="crown"
                  viewBox="-0.5 -0.5 1 1"
                  x="-50"
                  y="-50"
                  width="100"
                  height="100"
                  overflow="visible"
                  className="opacity-0"
                >
                  <g transform={`rotate(${slotAngle})`}>
                    <Crown width={CROWN_SHARE} />
                  </g>
                </svg>
              </g>
            </g>
            {/* The box the checks read (rect, visibility, hit-test): over the forms, unpainted. */}
            <rect data-courier="" x="-50" y="-50" width="100" height="100" fill="transparent" />
          </g>
        </svg>
      </div>
    </>
  );
}
