import { afterEach, describe, expect, it, vi } from 'vitest';

import { watchCpuBlocking } from './browserEnv';

type Entry = { startTime: number; duration?: number; blockingDuration: number };

/** A PerformanceObserver that delivers `buffered` at once and `pending` through takeRecords. */
function installObserver(types: string[] | undefined, buffered: Entry[], pending: Entry[]) {
  const disconnect = vi.fn();
  class FakeObserver {
    static supportedEntryTypes = types;
    constructor(private readonly callback: (list: { getEntries(): Entry[] }) => void) {}
    observe(options: { type: string; buffered: boolean }) {
      expect(options).toEqual({ type: 'long-animation-frame', buffered: true });
      this.callback({ getEntries: () => buffered });
    }
    takeRecords() {
      return pending.splice(0);
    }
    disconnect = disconnect;
  }
  vi.stubGlobal('PerformanceObserver', FakeObserver);
  return disconnect;
}

/** The paint and user-timing entries `readMs` reads by name. */
function marks(byName: Record<string, number>): void {
  vi.spyOn(performance, 'getEntriesByName').mockImplementation((name: string) =>
    name in byName ? [{ startTime: byName[name] } as PerformanceEntry] : [],
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('watchCpuBlocking (phone spec 1.1)', () => {
  it('BE1 sums the blocking of the long animation frames from FCP on, the undelivered ones too', () => {
    const disconnect = installObserver(
      ['long-animation-frame', 'paint'],
      [
        { startTime: 100, blockingDuration: 900 }, // before FCP: parsing, not the device's CPU
        { startTime: 400, blockingDuration: 120 },
      ],
      [{ startTime: 900, blockingDuration: 80 }],
    );
    marks({ 'first-contentful-paint': 300 });
    const cpu = watchCpuBlocking();
    expect(cpu.readMs()).toBe(200);
    cpu.stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('BE3 the frame that holds the intro end does not count: that work is the site, not the device', () => {
    installObserver(
      ['long-animation-frame'],
      [
        { startTime: 400, duration: 60, blockingDuration: 40 },
        { startTime: 1500, duration: 180, blockingDuration: 130 }, // the intro's end, at 1520
        { startTime: 1700, duration: 70, blockingDuration: 20 },
      ],
      [],
    );
    marks({ 'first-contentful-paint': 300, 'intro:end': 1520 });
    expect(watchCpuBlocking().readMs()).toBe(60);
    // No intro (skipped, or a later page view): every frame counts.
    marks({ 'first-contentful-paint': 300 });
    expect(watchCpuBlocking().readMs()).toBe(190);
  });

  it('BE2 no long-animation-frame entry type (WebKit, Gecko) or no list at all: null, no observer', () => {
    installObserver(['paint'], [{ startTime: 1, blockingDuration: 999 }], []);
    expect(watchCpuBlocking().readMs()).toBeNull();
    installObserver(undefined, [], []);
    expect(watchCpuBlocking().readMs()).toBeNull();
  });
});
