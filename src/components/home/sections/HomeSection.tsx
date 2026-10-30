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
  children: ReactNode;
}) {
  const id = `home-${props.section}-title`;
  const header = props.copy ? (
    <SectionHeader
      id={id}
      title={props.copy.heading}
      lead={props.copy.intro ? ltr(props.copy.intro) : undefined}
      action={props.action}
      className={props.split ? 'lg:mb-0 lg:self-start' : undefined}
    />
  ) : null;
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
