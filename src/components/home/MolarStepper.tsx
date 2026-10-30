// The molar of scene 4 (phase 7 report D16) as three layers, plain, VIP and CIP, each its own
// sibling <svg> stacked in one grid cell, so a crossfade is a composited opacity on an element and
// a scale a transform, never a fill transition or a <g> opacity (a paint of one <svg>). The art is
// a lower molar seen from the cheek: a crown wider than tall with three cusps, narrowing to the
// neck, and two tapering roots about 1.3 times its height that part at the furcation. One brand
// line and a fill from the theme tokens, so it follows light and dark (never solid white on the
// navy page); the levels differ by the enamel tint, and the CIP layer adds the warm cervical shade
// and the stain lines in the grooves. The crown and the roots are drawn once and reused; the roots
// start inside the crown and are drawn under it.
// Which layer shows follows the checked chip as the panels do (`data-choice`, and a `:has()` rule
// only without JavaScript), so the stepper works without the engine and without a transition
// (tier 0). The scene module adds `data-motion` to the slot at tiers 1 to 3 without a pin, which
// turns on the `--dur-4` crossfade; in the pinned scrub (tiers 2 and 3 from 1024 px) the engine
// writes opacity and transform inline and leaves the attribute off. The slot is decorative and
// the world slot phase 8 replaces with the 3D molar at tiers 2 and 3.
const CROWN =
  'M52 118C40 106 28 90 28 72c0-20 12-32 26-32 10 0 17 6 24 11 7-8 14-15 22-15s15 7 22 15c7-5 14-11 24-11 14 0 26 12 26 32 0 18-12 34-24 46-18 8-78 8-96 0z';
const ROOTS =
  'M56 110c-4 40-8 86-2 112 3 10 14 11 17 1 7-27 15-57 29-71 14 14 22 44 29 71 3 10 14 9 17-1 6-26 2-72-2-112z';

/** The enamel per level (theme tokens: the light and dark values come from design/tokens.css). */
export const MOLAR_LEVELS = [
  { level: 'plain', fill: 'fill-surface-raised' },
  {
    level: 'vip',
    fill: 'fill-[color-mix(in_srgb,var(--color-brand)_10%,var(--color-surface-raised))]',
  },
  {
    level: 'cip',
    fill: 'fill-[color-mix(in_srgb,var(--color-warm)_24%,var(--color-surface-raised))] dark:fill-[color-mix(in_srgb,var(--color-warm)_12%,var(--color-surface-raised))]',
  },
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
          <g strokeWidth="2.5" strokeLinejoin="round" className={`stroke-brand ${fill}`}>
            <use href="#molar-roots" />
            <use href="#molar-crown" />
          </g>
          {level === 'cip' ? (
            <g data-stain="" fill="none" strokeLinecap="round" className="stroke-warm">
              <path d="M56 113c20 8 68 8 88 0" strokeOpacity="0.45" strokeWidth="8" />
              <path d="M78 51c2 9 6 15 12 18m32-18c-2 9-6 15-12 18" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
      ))}
    </div>
  );
}
