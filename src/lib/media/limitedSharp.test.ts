import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { limitedSharp } from './limitedSharp';

// A real 400 px PNG: the factory's type takes (input, options), not the options-only overload.
const square = await sharp({
  create: { width: 400, height: 400, channels: 3, background: '#c33' },
})
  .png()
  .toBuffer();

describe('limitedSharp (UP-6)', () => {
  it('LS1 Payload-style parallel sizes run one encode at a time and all finish', async () => {
    const limited = limitedSharp(1);
    const base = limited(square).rotate();
    const sizes = await Promise.all(
      [64, 96, 128, 160, 192, 224].map((width) =>
        base.clone().resize({ width }).webp({ quality: 50 }).toBuffer({ resolveWithObject: true }),
      ),
    );
    expect(sizes.map((s) => s.info.width)).toEqual([64, 96, 128, 160, 192, 224]);
    expect(limited.peak()).toBe(1);
  });

  it('LS2 without the limit the same calls overlap (the test can fail)', async () => {
    let active = 0;
    let peak = 0;
    const counting = (...args: Parameters<typeof sharp>) => {
      const instance = sharp(...args);
      const toBuffer = instance.toBuffer.bind(instance) as () => Promise<Buffer>;
      return Object.assign(instance, {
        toBuffer: async () => {
          active += 1;
          peak = Math.max(peak, active);
          try {
            return await toBuffer();
          } finally {
            active -= 1;
          }
        },
      });
    };
    await Promise.all([1, 2, 3].map(() => counting(square).png().toBuffer()));
    expect(peak).toBe(3);
    const limited = limitedSharp(2, counting as never);
    peak = 0;
    await Promise.all([1, 2, 3, 4].map(() => limited(square).png().toBuffer()));
    expect(peak).toBe(2);
    expect(limited.peak()).toBe(2);
  });

  it('LS3 metadata and other calls pass through unchanged', async () => {
    const meta = await limitedSharp(1)(square).metadata();
    expect(meta).toMatchObject({ width: 400, height: 400 });
  });
});
