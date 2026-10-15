'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentOf, showsStickyBar } from './routes';

/** A nav link that marks the current page (aria-current) in the server HTML already. */
export function NavLink(props: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={props.href}
      aria-current={currentOf(usePathname(), props.href)}
      className={props.className}
    >
      {props.children}
    </a>
  );
}

/**
 * The «خدمات» disclosure button of the mega menu: `aria-current="true"` anywhere under its hub, so
 * the section shows the active bar like the links do (a button is not the page itself).
 */
export function SectionButton(props: {
  section: string;
  popover: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      popoverTarget={props.popover}
      aria-controls={props.popover}
      aria-current={currentOf(usePathname(), props.section) ? 'true' : undefined}
      className={props.className}
    >
      {props.children}
    </button>
  );
}

/** Renders its server-rendered children except on the paths listed (nav spec 1.7). */
export function StickyBarGate(props: { hiddenOn: string[]; children: ReactNode }) {
  return showsStickyBar(usePathname(), props.hiddenOn) ? props.children : null;
}
