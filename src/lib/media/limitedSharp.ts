import sharp, { type Sharp } from 'sharp';

type SharpFactory = (...args: Parameters<typeof sharp>) => Sharp;

/** The sharp factory Payload calls, plus the most encodes that ever ran at once (for tests). */
export interface LimitedSharp extends SharpFactory {
  peak(): number;
}

/**
 * sharp with at most `limit` encodes running at a time (UP-6). Payload's createImageSizes starts
 * all 23 sizes together (Promise.all) and every clone decodes the original again, so one 12 MP
 * photo peaked at about 1.1 GB RSS on a host planned with 1 GB. `toBuffer` and `toFile` (promise
 * form, the one Payload uses) wait for a slot; every other call passes through.
 */
export function limitedSharp(limit: number, base: SharpFactory = sharp): LimitedSharp {
  let active = 0;
  let peak = 0;
  const waiting: (() => void)[] = [];
  const acquire = (): Promise<void> => {
    if (active < limit) {
      active += 1;
      peak = Math.max(peak, active);
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  };
  // A finished encode hands its slot to the next one in line, so a newcomer never overtakes it.
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };
  const queued = async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };

  const wrap = (instance: Sharp): Sharp => {
    const proxy: Sharp = new Proxy(instance, {
      get(target, prop) {
        const value: unknown = Reflect.get(target, prop, target);
        if (typeof value !== 'function') return value;
        if (prop === 'toBuffer' || prop === 'toFile') {
          return (...args: unknown[]) =>
            queued(() => value.apply(target, args) as Promise<unknown>);
        }
        return (...args: unknown[]) => {
          const out: unknown = value.apply(target, args);
          if (out === target) return proxy;
          return prop === 'clone' ? wrap(out as Sharp) : out;
        };
      },
    });
    return proxy;
  };

  const factory = ((...args: Parameters<typeof sharp>) => wrap(base(...args))) as LimitedSharp;
  factory.peak = () => peak;
  return factory;
}
