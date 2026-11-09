import type { ReactNode } from 'react';

import { cx } from '@/components/ui/cx';
import { Section, SectionHeader } from '@/components/ui/Layout';
import type { Media } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

export type Copy = { heading: string; intro: string | null } | null;

/**
 * A pinned stage (desktop tiers 2 and 3, phase 7 F2 and F3): from 1024 px under `html[data-pins]`,
 * which the inline latch writes before the first paint (`experience/tier/pinsScript.ts`), the
 * stage sticks under the nav while the reader scrolls through the `PinRoom` after it, so a reload
 * or an anchor lands in the pinned geometry before the engine, and the engine only scrubs. Never
 * in print: the stage would print once and its room as blank pages.
 */
export const PIN_STAGE = 'lg:[[data-pins]_&]:not-print:sticky lg:[[data-pins]_&]:top-nav';

/**
 * The scroll distance of a pinned stage, its next sibling: one or two viewport heights (lvh: a
 * toolbar that comes and goes resizes nothing), the length the scene's scrub runs over
 * (`scenes/dom/pinRoom.ts`). Empty and unpainted.
 */
export function PinRoom(props: { vh: 1 | 2 }) {
  return (
    <div
      aria-hidden="true"
      data-pin-room=""
      className={cx(
        'hidden lg:[[data-pins]_&]:not-print:block',
        props.vh === 2 ? 'h-[200lvh]' : 'h-[100lvh]',
      )}
    />
  );
}

/**
 * The workflow's header-row dock: an empty box at the end edge (no action there), only while the
 * stage is not the pinned diagonal, which has its own.
 */
const WORKFLOW_DOCK =
  'absolute end-0 top-0 hidden h-[min(8rem,100%)] w-[min(13rem,24%)] md:block lg:[[data-pins]_&]:hidden';

/**
 * D6 (docs/experience/journey.md): the mark settles as the heading's emblem, an inline box a small
 * gap after the heading's last word, 1.3 em square (about 1.6 cap heights for the form inside),
 * centred on the line; empty and `aria-hidden`, so the heading reads as before. At every width.
 */
const EMBLEM = 'ms-[0.35em] inline-block size-[1.3em] align-[-0.32em]';

export const media = (value: number | Media | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null;

/**
 * One home section: its scene id for the experience engine (phases 7-8 animate this markup), its
 * place in the T-home order and its layout family (DESIGN.md 6), which the e2e checks read.
 */
export function HomeSection(props: {
  scene?: string;
  section: string;
  family: string;
  copy: Copy;
  action?: ReactNode;
  tone?: 'plain' | 'sunken' | 'warm';
  /** From 1024 px the heading sits beside the content (start side), not above it. */
  split?: boolean;
  /** The whole section is a pinned stage for this many viewport heights (`PinRoom`). */
  pin?: 1 | 2;
  /**
   * A journey dock in the header row (docs/experience/journey.md): the workflow's an empty box at
   * the end side, clear of the action, from 744 px (tablets too), absolute, so the header keeps its
   * height; the dentists' the heading's emblem at every width.
   */
  dock?: 'dentists' | 'workflow';
  children: ReactNode;
}) {
  const id = `home-${props.section}-title`;
  const emblem = props.dock === 'dentists';
  const heading = props.copy ? (
    <SectionHeader
      id={id}
      title={
        emblem ? (
          <>
            {props.copy.heading}
            <span data-dock="dentists" aria-hidden="true" className={EMBLEM} />
          </>
        ) : (
          props.copy.heading
        )
      }
      lead={props.copy.intro ? ltr(props.copy.intro) : undefined}
      action={props.action}
      className={props.split ? 'lg:mb-0 lg:self-start' : undefined}
    />
  ) : null;
  const header =
    heading && props.dock === 'workflow' ? (
      <div className="relative">
        {heading}
        <div data-dock="workflow" aria-hidden="true" className={WORKFLOW_DOCK} />
      </div>
    ) : (
      heading
    );
  return (
    <div data-scene={props.scene} data-home-section={props.section} data-family={props.family}>
      <Section
        labelledBy={props.copy ? id : undefined}
        tone={props.tone}
        // A whole pinned section ends close under its content: the full block padding below the
        // compare link reached 30 px past a 1024 x 768 viewport (T-RS7).
        className={props.pin ? cx(PIN_STAGE, 'lg:[[data-pins]_&]:pb-8') : undefined}
      >
        {props.split ? (
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            {header}
            <div className="min-w-0">{props.children}</div>
          </div>
        ) : (
          <>
            {header}
            {props.children}
          </>
        )}
      </Section>
      {props.pin ? <PinRoom vh={props.pin} /> : null}
    </div>
  );
}
