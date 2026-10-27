import type { ReactNode } from 'react';

import { Section, SectionHeader } from '@/components/ui/Layout';
import type { Media } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

export type Copy = { heading: string; intro: string | null } | null;

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
      <Section labelledBy={props.copy ? id : undefined} tone={props.tone}>
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
    </div>
  );
}
