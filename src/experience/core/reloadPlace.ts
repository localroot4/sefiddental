import { keyValue } from '../tier/browserEnv';

/**
 * The reader's place across a reload or a history visit of the home page, for a browser that
 * restores no scroll there: WebKit lands at the top on a reload (CI run 87, T-EN4c to T-EN4g,
 * 2010 to 10356 px off) where Chromium restores. Kept at `pagehide`, applied once at mount and
 * only when the browser left the page at the top, so a browser that restores keeps its own.
 * The pinned geometry is in the server HTML and the inline latch (pinsScript.ts), so the kept
 * offset lands in the same place.
 */
export const RELOAD_PLACE_KEY = 'sefid-scroll';
const session = keyValue(() => window.sessionStorage);

const here = (url: URL | Location): string => url.pathname + url.search;

/** `pagehide`: a page kept whole in the back/forward cache needs nothing. */
export function keepPlace(event: PageTransitionEvent): void {
  if (event.persisted) return;
  session.set(RELOAD_PLACE_KEY, JSON.stringify({ at: here(location), y: window.scrollY }));
}

/** At mount: the kept place, read once, for a reload or a history visit of this document. */
export function restorePlace(): void {
  const raw = session.get(RELOAD_PLACE_KEY);
  session.remove(RELOAD_PLACE_KEY);
  if (raw === null || window.scrollY !== 0 || location.hash !== '') return;
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  if (nav === undefined || (nav.type !== 'reload' && nav.type !== 'back_forward')) return;
  // A client navigation back to home inside a document loaded for another page is no reload.
  if (here(new URL(nav.name)) !== here(location)) return;
  try {
    const { at, y } = JSON.parse(raw) as Record<string, unknown>;
    if (at === here(location) && typeof y === 'number' && y > 0) {
      window.scrollTo({ top: y, behavior: 'instant' });
    }
  } catch {
    // Not JSON (another writer, a manual edit): the browser's place stands.
  }
}
