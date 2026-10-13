import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Payload } from 'payload';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getTestPayload, refusal } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400"/></svg>',
);
const file = (data: Buffer, name: string, mimetype: string) => ({
  data,
  name,
  mimetype,
  size: data.length,
});

/** A JPEG with a GPS position in its EXIF (spec-data 10.2); a random color keeps its hash unique. */
async function jpegWithGps(width: number, height: number): Promise<Buffer> {
  const [r, g, b] = [...randomBytes(3)] as [number, number, number];
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } })
    .jpeg({ quality: 80 })
    .withExif({
      IFD0: { Make: 'TestCam' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 41/1 0/1' },
    })
    .toBuffer();
}

describe('media pipeline (spec-data 7)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('MI1 a real SVG and an SVG renamed .png are refused', async () => {
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'نقشه برداری' },
        file: file(SVG, 'logo.svg', 'image/svg+xml'),
      }),
    ).rejects.toMatchObject({
      message: 'این نوع فایل پذیرفته نمی‌شود. فقط JPEG، PNG، WebP، AVIF، MP4 و WebM.',
    });
    const renamed = await refusal(
      payload.create({
        collection: 'media',
        data: { alt: 'نقشه برداری' },
        file: file(SVG, 'logo.png', 'image/png'),
      }),
    );
    expect(renamed.join(' ')).toMatch(/svg|MIME|نوع/i);
  });

  it(
    'MI2 a GPS JPEG yields every size, both placeholders, a hashed name and no EXIF',
    { timeout: 180_000 },
    async () => {
      const source = await jpegWithGps(2600, 2000);
      expect((await sharp(source).metadata()).exif).toBeDefined();
      const doc = await payload.create({
        collection: 'media',
        data: { alt: 'اتاق درمان کلینیک' },
        file: file(source, 'اتاق درمان.jpg', 'image/jpeg'),
      });
      expect(doc.filename).toMatch(/^اتاق-درمان-[0-9a-f]{10}\.jpg$/);
      const sizes = doc.sizes as Record<
        string,
        { filename?: string | null; width?: number | null; height?: number | null }
      >;
      const expected = [
        'thumb',
        ...[
          'w640',
          'w960',
          'w1280',
          'w1600',
          'w1920',
          'w2560',
          'p640',
          'p828',
          'p1080',
          's640',
          's1080',
        ].flatMap((n) => [n, `${n}Avif`]),
      ];
      for (const name of expected) expect(sizes[name]?.filename, name).toBeTruthy();
      expect(sizes.p1080).toMatchObject({ width: 1080, height: 1350 });
      expect(sizes.w2560Avif?.filename).toMatch(/\.avif$/);
      // payloadUploadSizes was filled before beforeChange: the 4:5 placeholder exists (freeze 10).
      expect(doc.blurDataURL).toMatch(/^data:image\/webp;base64,/);
      expect(doc.blurDataURLPortrait).toMatch(/^data:image\/webp;base64,/);
      const stored = await readFile(
        path.join(process.env.MEDIA_DIR as string, doc.filename as string),
      );
      const meta = await sharp(stored).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.exif).toBeUndefined();
    },
  );

  it('MI3 a tiny image is refused with the Persian message', async () => {
    const tiny = await sharp({
      create: { width: 200, height: 150, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'تصویر کوچک' },
        file: file(tiny, 'tiny.png', 'image/png'),
      }),
    ).rejects.toMatchObject({ message: 'عکس خیلی کوچک است؛ دست‌کم ۳۲۰ پیکسل.' });
  });
});
