/**
 * The browser side of TierEnv (spec-utils 6.1 inputs). Storage access is wrapped: private mode
 * and blocked storage read as empty and never throw.
 */
import { probeGpu } from './gpuProbe';
import type { KeyValueStore, MediaSignal, TierEnv } from './tierStore';

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

function media(query: string): MediaSignal {
  const list = window.matchMedia(query);
  return {
    matches: () => list.matches,
    subscribe: (onChange) => {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
  };
}

function keyValue(storage: () => Storage): KeyValueStore {
  return {
    get: (key) => {
      try {
        return storage().getItem(key);
      } catch {
        return null; // storage blocked: same as empty
      }
    },
    set: (key, value) => {
      try {
        storage().setItem(key, value);
      } catch {
        // Storage blocked or full: the choice lasts for this page load only.
      }
    },
    remove: (key) => {
      try {
        storage().removeItem(key);
      } catch {
        // Storage blocked: nothing stored to remove.
      }
    },
  };
}

export function createBrowserTierEnv(): TierEnv {
  const nav = navigator as NavigatorHints;
  const local = keyValue(() => window.localStorage);
  return {
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    finePointer: media('(pointer: fine)'),
    wide: media('(min-width: 1024px)'),
    viewport: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    }),
    saveData: () => nav.connection?.saveData === true,
    deviceMemory: () => (typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null),
    search: () => window.location.search,
    local,
    session: keyValue(() => window.sessionStorage),
    onLoad: (cb) => {
      if (document.readyState === 'complete') {
        const id = window.setTimeout(cb, 0);
        return () => window.clearTimeout(id);
      }
      window.addEventListener('load', cb, { once: true });
      return () => window.removeEventListener('load', cb);
    },
    probe: ({ benchmark }) => probeGpu({ benchmark, storage: local }),
    scrollY: () => window.scrollY,
    now: () => performance.now(),
    every: (ms, cb) => {
      const id = window.setInterval(cb, ms);
      return () => window.clearInterval(id);
    },
  };
}
