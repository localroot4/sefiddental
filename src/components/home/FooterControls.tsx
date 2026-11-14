'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The home page's footer controls («کیفیت جلوه‌ها», «پخش دوباره») in the footer's bottom bar
 * (SiteFooter `[data-footer-controls]`, owner 2026-11-14: the logo leads the footer, settings sit
 * at its end). They need the tier store of `ExperienceRoot`, so they stay in its React tree and
 * reach the footer, outside it, through a portal: on the client only, after the first commit (the
 * footer is below the first screen, so its late row moves nothing the reader sees).
 */
export function FooterControls(props: { children: ReactNode }) {
  // The server's snapshot (none) while hydrating, then the slot: the footer never changes under it.
  const slot = useSyncExternalStore(subscribe, findSlot, noSlot);
  return slot ? createPortal(props.children, slot) : null;
}

const subscribe = (): (() => void) => () => {};
const findSlot = (): Element | null => document.querySelector('footer [data-footer-controls]');
const noSlot = (): null => null;
