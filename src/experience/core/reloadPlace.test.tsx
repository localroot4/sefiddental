import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keepPlace, RELOAD_PLACE_KEY, restorePlace } from './reloadPlace';

const hide = (persisted = false) => new PageTransitionEvent('pagehide', { persisted });

function navigation(type: NavigationTimingType, name = location.href): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type, name } as unknown as PerformanceEntry,
  ]);
}

describe('reloadPlace', () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;
  let scrollY = 0;

  beforeEach(() => {
    history.replaceState(null, '', '/?tier=2');
    sessionStorage.clear();
    scrollY = 0;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('RP1 a reload the browser left at the top returns to the place kept at pagehide', () => {
    scrollY = 2033;
    keepPlace(hide());
    scrollY = 0;
    navigation('reload');
    restorePlace();
    expect(scrollTo).toHaveBeenCalledWith({ top: 2033, behavior: 'instant' });
    expect(sessionStorage.getItem(RELOAD_PLACE_KEY)).toBeNull();
  });

  it('RP2 a browser that restored, a fresh navigation, a hash or another page keep their place', () => {
    const kept = (at = '/?tier=2') => JSON.stringify({ at, y: 2033 });
    const cases: Array<[string, () => void]> = [
      ['restored', () => ((scrollY = 2033), navigation('reload'))],
      ['navigate', () => navigation('navigate')],
      ['hash', () => (history.replaceState(null, '', '/?tier=2#faq'), navigation('reload'))],
      ['other document', () => navigation('reload', `${location.origin}/pricing`)],
    ];
    for (const [label, setup] of cases) {
      history.replaceState(null, '', '/?tier=2');
      scrollY = 0;
      sessionStorage.setItem(RELOAD_PLACE_KEY, kept());
      setup();
      restorePlace();
      expect(scrollTo, label).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(RELOAD_PLACE_KEY), label).toBeNull();
      vi.mocked(performance.getEntriesByType).mockRestore();
    }
    sessionStorage.setItem(RELOAD_PLACE_KEY, kept('/?tier=1'));
    navigation('reload');
    restorePlace();
    sessionStorage.setItem(RELOAD_PLACE_KEY, 'not json');
    restorePlace();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('RP4 a reload the browser restored short of the kept place goes on to it; one past it stays', () => {
    for (const [landed, called] of [
      [120, true],
      [2433, false],
    ] as const) {
      scrollY = 2033;
      keepPlace(hide());
      scrollY = landed;
      navigation('reload');
      restorePlace();
      if (called) expect(scrollTo).toHaveBeenCalledWith({ top: 2033, behavior: 'instant' });
      else expect(scrollTo).not.toHaveBeenCalled();
      scrollTo.mockClear();
      vi.mocked(performance.getEntriesByType).mockRestore();
    }
  });

  it('RP3 a page kept in the back/forward cache writes nothing', () => {
    scrollY = 500;
    keepPlace(hide(true));
    expect(sessionStorage.getItem(RELOAD_PLACE_KEY)).toBeNull();
  });
});
