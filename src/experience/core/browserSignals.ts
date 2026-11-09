/**
 * Document-level signals as `useSyncExternalStore` hooks (no setState in effects): `load`,
 * tab visibility, and the end of the intro (phase 7 contract, spec EXP 3.3). The server
 * snapshot of each is the safe value: not loaded, intro not done, visible.
 */
import { useSyncExternalStore } from 'react';

/** The intro never runs longer than this (DESIGN.md: 1250 ms, hard cap 1400 ms). */
export const INTRO_HARD_CAP_MS = 1400;

const INTRO_EVENT = 'sefid:intro-end';

const serverFalse = (): boolean => false;
const serverTrue = (): boolean => true;

function subscribeLoad(onChange: () => void): () => void {
  window.addEventListener('load', onChange);
  return () => window.removeEventListener('load', onChange);
}
const isLoaded = (): boolean => document.readyState === 'complete';

export function useDocumentLoaded(): boolean {
  return useSyncExternalStore(subscribeLoad, isLoaded, serverFalse);
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
const isVisible = (): boolean => document.visibilityState === 'visible';

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, isVisible, serverTrue);
}

/**
 * The intro is done when `html[data-intro]` is not 'playing' (absent = no intro), on the
 * `sefid:intro-end` event, or once the hard cap has passed since navigation start, so a broken
 * intro script can never keep the canvas away for the whole visit.
 */
export function isIntroDone(): boolean {
  return (
    document.documentElement.dataset.intro !== 'playing' || performance.now() >= INTRO_HARD_CAP_MS
  );
}

function subscribeIntro(onChange: () => void): () => void {
  document.addEventListener(INTRO_EVENT, onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-intro'] });
  const remaining = Math.max(0, INTRO_HARD_CAP_MS - performance.now());
  const timer = window.setTimeout(onChange, remaining + 1);
  return () => {
    document.removeEventListener(INTRO_EVENT, onChange);
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

export function useIntroDone(): boolean {
  return useSyncExternalStore(subscribeIntro, isIntroDone, serverFalse);
}

/** requestIdleCallback with a timeout, or a short timer where it is missing (Safari). */
export function onIdle(cb: () => void, timeoutMs: number): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => cb(), { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}
