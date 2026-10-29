/**
 * The browser side of TierEnv (spec-utils 6.1 inputs). Storage access is wrapped: private mode
 * and blocked storage read as empty and never throw.
 */
import { probeGpu, webgl2OnMainThread } from './gpuProbe';
import type { CpuBlocking, KeyValueStore, MediaSignal, TierEnv } from './tierStore';

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

export function keyValue(storage: () => Storage): KeyValueStore {
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

type AnimationFrameEntry = PerformanceEntry & { blockingDuration?: number };

/**
 * The CPU signal (phone spec 1.1): the `blockingDuration` of every long animation frame that
 * started at or after FCP. `buffered` delivers the frames before the observer existed; Chromium
 * only, so WebKit and Gecko read null (no judgement). The frame that holds the intro's end
 * (`intro:end`) does not count: its dialog close and focus are the site's work (61 to 119 ms of
 * blocking at 4x and 62 to 242 at 6x, most of it forced style and layout), not a weak device.
 */
export function watchCpuBlocking(): CpuBlocking {
  if (
    typeof PerformanceObserver === 'undefined' ||
    // Absent before Safari 13: no judgement there either.
    !(PerformanceObserver.supportedEntryTypes as readonly string[] | undefined)?.includes(
      'long-animation-frame',
    )
  ) {
    return { readMs: () => null, stop: () => {} };
  }
  const frames: AnimationFrameEntry[] = [];
  const observer = new PerformanceObserver((list) => {
    frames.push(...list.getEntries());
  });
  observer.observe({ type: 'long-animation-frame', buffered: true });
  return {
    readMs: () => {
      frames.push(...observer.takeRecords());
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const end = performance.getEntriesByName('intro:end')[0]?.startTime;
      const intro = (f: AnimationFrameEntry): boolean =>
        end !== undefined && f.startTime <= end && end <= f.startTime + f.duration;
      return frames.reduce(
        (sum, f) => (f.startTime >= fcp && !intro(f) ? sum + (f.blockingDuration ?? 0) : sum),
        0,
      );
    },
    stop: () => observer.disconnect(),
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
    probe: ({ benchmark, signal }) => probeGpu({ benchmark, storage: local, signal }),
    watchCpuBlocking,
    webgl2OnMainThread,
    scrollY: () => window.scrollY,
    now: () => performance.now(),
    epochMs: () => Date.now(),
    every: (ms, cb) => {
      const id = window.setInterval(cb, ms);
      return () => window.clearInterval(id);
    },
  };
}
