// The molar of scene 4 (phase 7 report D16): the tier-0 art of design/prototypes/0d-molar-turntable.html
// as three pre-colored layers, plain, VIP and CIP, each its own sibling <svg> stacked in one grid
// cell, so a crossfade is a composited opacity on an element and a scale a transform, never a
// fill transition or a <g> opacity (a paint of one <svg>). The crown and the roots are drawn once
// and reused; a layer's fill is the enamel of its level and the CIP layer adds the warm
// cervical stroke and the stain lines. The crown is the prototype's left half mirrored about
// x = 100: the prototype's own path is lopsided (its right half 48 units short), so the roots
// and the CIP strokes, centred at 100, sat outside it. The roots start inside the crown and are
// drawn under it, so they leave its underside instead of hanging below a gap.
// Which layer shows follows the checked chip as the panels do (`data-choice`, and a `:has()` rule
// only without JavaScript), so the stepper works without the engine and without a transition
// (tier 0). The scene module adds `data-motion` to the slot at tiers 1 to 3 without a pin, which
// turns on the `--dur-4` crossfade; in the pinned scrub (tiers 2 and 3 from 1024 px) the engine
// writes opacity and transform inline and leaves the attribute off. The slot is decorative and
// the world slot phase 8 replaces with the 3D molar at tiers 2 and 3.
const CROWN =
  'M100 18c-30 0-52 10-66 30s-16 48-10 76c3 14 6 22 10 26 5 5 12 6 20 2 8-4 12-14 14-40 6-12 14-16 32-16 18 0 26 4 32 16 2 26 6 36 14 40 8 4 15 3 20-2 4-4 7-12 10-26 6-28 4-56-10-76-14-20-36-30-66-30z';
const ROOTS =
  'M62 100v50c-4 30-6 50-4 62 2 10 8 14 14 10 7-5 10-22 12-54V90zM138 100v50c4 30 6 50 4 62-2 10-8 14-14 10-7-5-10-22-12-54V90z';

/** The enamel per level; the CIP layer also draws the characterization group. */
export const MOLAR_LEVELS = [
  { level: 'plain', fill: '#FFFFFF' },
  { level: 'vip', fill: '#FBF8F2' },
  { level: 'cip', fill: '#F6EEDF' },
] as const;

// Which layer shows, by the position of the checked chip (the panels' PANEL rule: `data-choice`
// from choices.ts, `noscript:` `:has()` without JavaScript): Tailwind cannot build a class from an
// index. The first layer is the default and leaves when another step is checked. shortcut: three
// levels of art, a fourth tier keeps the plain molar; add a layer and a row for a fourth level.
const LAYER = [
  'group-data-[choice=2]/tiers:opacity-0 group-data-[choice=2]/tiers:transform-[scale(.94)] group-data-[choice=3]/tiers:opacity-0 group-data-[choice=3]/tiers:transform-[scale(.94)] noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:opacity-0 noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:transform-[scale(.94)] noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:opacity-0 noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:transform-[scale(.94)]',
  'opacity-0 transform-[scale(.94)] group-data-[choice=2]/tiers:opacity-100 group-data-[choice=2]/tiers:transform-none noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:opacity-100 noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:transform-none',
  'opacity-0 transform-[scale(.94)] group-data-[choice=3]/tiers:opacity-100 group-data-[choice=3]/tiers:transform-none noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:opacity-100 noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:transform-none',
];

export function MolarStepper(props: { className?: string }) {
  return (
    <div
      data-world-slot="molar"
      aria-hidden="true"
      className={`grid w-[10rem] md:w-[12rem] lg:w-[9rem] xl:w-[12rem] ${props.className ?? ''}`}
    >
      {MOLAR_LEVELS.map(({ level, fill }, i) => (
        <svg
          key={level}
          viewBox="0 0 200 240"
          data-level={level}
          className={`col-start-1 row-start-1 w-full in-data-motion:transition-[opacity,transform] in-data-motion:duration-[var(--dur-4)] ${LAYER[i]}`}
        >
          {i === 0 ? (
            <defs>
              <path id="molar-crown" d={CROWN} />
              <path id="molar-roots" d={ROOTS} />
            </defs>
          ) : null}
          <g fill={fill} strokeWidth="2" strokeLinejoin="round" className="stroke-line-strong">
            <use href="#molar-roots" />
            <use href="#molar-crown" />
          </g>
          {level === 'cip' ? (
            <g fill="none" strokeLinecap="round">
              <path
                d="M58 70c10-14 22-20 42-20s32 6 42 20"
                stroke="#C99A72"
                strokeOpacity="0.35"
                strokeWidth="10"
              />
              <path
                d="M78 54c8 10 10 22 10 36M122 54c-8 10-10 22-10 36"
                stroke="#8E6A45"
                strokeOpacity="0.45"
                strokeWidth="1.6"
              />
            </g>
          ) : null}
        </svg>
      ))}
    </div>
  );
}
