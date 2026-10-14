import { randomBytes } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import config from '@payload-config';
import { REST_GET } from '@payloadcms/next/routes';
import type { Payload } from 'payload';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/(payload)/api/[...slug]/route';
import { trashedFileIs404 } from '@/collections/Media';
import { MEDIA_MESSAGES } from '@/hooks/media';
import type { LimitedSharp } from '@/lib/media/limitedSharp';

import { getTestPayload, refusal, staffUsers } from './helpers';

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

// ---------------------------------------------------------------------------------------------
// Security review fixes (UP-1 ... UP-13). REST calls go through the app's own route handlers.
// ---------------------------------------------------------------------------------------------

const slugOf = (url: string) => new URL(url, 'http://localhost').pathname.split('/').slice(2);
const rest = (handler: (r: Request, a: never) => Promise<Response>, request: Request) =>
  handler(request, { params: Promise.resolve({ slug: slugOf(request.url) }) } as never);

/** A minimal MP4: ftyp, a movie box with `extra` inside, and an empty media box. */
function mp4(extra: Buffer = Buffer.alloc(0)): Buffer {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body]);
  };
  const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1'));
  const moov = box('moov', Buffer.concat([box('mvhd', Buffer.alloc(100)), box('udta', extra)]));
  return Buffer.concat([ftyp, moov, box('mdat', randomBytes(4096))]);
}

async function storedPhoto(alt = 'عکس آزمون امنیتی') {
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    file: file(await jpegWithGps(800, 600), 'photo.jpg', 'image/jpeg'),
  });
  return { doc, onDisk: path.join(process.env.MEDIA_DIR as string, doc.filename as string) };
}

describe('media security fixes', () => {
  beforeAll(async () => {
    payload ??= await getTestPayload();
  });

  it('MS1 a file on update is refused before Payload deletes the stored one (UP-1, UP-9)', async () => {
    const { doc, onDisk } = await storedPhoto();
    const other = await jpegWithGps(700, 500);
    await expect(
      payload.update({
        collection: 'media',
        id: doc.id,
        data: { alt: 'ab' },
        file: file(other, 'other.jpg', 'image/jpeg'),
      }),
    ).rejects.toMatchObject({ message: MEDIA_MESSAGES.replace });
    await expect(access(onDisk)).resolves.toBeUndefined();
    const crop = payload.update({
      collection: 'media',
      id: doc.id,
      data: { alt: 'ab' },
      req: { query: { uploadEdits: { widthInPixels: 400, heightInPixels: 300 } } } as never,
    });
    await expect(crop).rejects.toMatchObject({ message: MEDIA_MESSAGES.replace });
    expect((await sharp(onDisk).metadata()).width).toBe(800);
  });

  it('MS2 an upload leaves no temp file behind, audit row included (UP-2)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sefid-upload-'));
    const temp = path.join(dir, 'tmp-upload');
    const bytes = await jpegWithGps(640, 480);
    await writeFile(temp, bytes);
    await payload.create({
      collection: 'media',
      data: { alt: 'عکس با فایل موقت' },
      file: {
        data: Buffer.alloc(0),
        tempFilePath: temp,
        name: 'temp.jpg',
        mimetype: 'image/jpeg',
        size: bytes.length,
      } as never,
    });
    await expect(access(temp)).rejects.toMatchObject({ code: 'ENOENT' });
    await rm(dir, { recursive: true, force: true });
  });

  it('MS3 a trashed document stops serving its files to visitors; staff still see them (UP-3)', async () => {
    const { doc } = await storedPhoto();
    const get = (name: string, cookie?: string) =>
      rest(
        REST_GET(config),
        new Request(
          `http://localhost/api/media/file/${encodeURIComponent(name)}`,
          cookie ? { headers: { cookie } } : undefined,
        ),
      );
    const size = (doc.sizes as Record<string, { filename?: string | null }>).thumb
      ?.filename as string;
    expect((await get(doc.filename as string)).status).toBe(200);
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: { deletedAt: new Date().toISOString() },
    });
    expect((await get(doc.filename as string)).status).toBe(404);
    expect((await get(size)).status).toBe(404);
    const staff = await trashedFileIs404({ payload, user: { role: 'admin' } } as never, {
      params: { filename: doc.filename as string },
    });
    expect(staff).toBeUndefined();
  });

  it('MS4 a create without a file never fetches a URL (UP-4)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      payload.create({
        collection: 'media',
        data: {
          alt: 'فایل از راه دور',
          filename: 'remote-name.png',
          url: 'https://raw.githubusercontent.com/x/y/z.png',
        } as never,
        overrideAccess: false,
        user: { id: 1, role: 'admin', collection: 'users', _strategy: 'totp' } as never,
      }),
    ).rejects.toMatchObject({ message: MEDIA_MESSAGES.missing });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('MS5 an anonymous upload is refused before its body is read (UP-5)', async () => {
    let pulled = false;
    // highWaterMark 0: the stream is pulled only when someone reads it.
    const body = new ReadableStream(
      {
        pull(controller) {
          pulled = true;
          controller.enqueue(new Uint8Array(1024));
        },
      },
      { highWaterMark: 0 },
    );
    const response = await rest(
      POST,
      new Request('http://localhost/api/media', {
        method: 'POST',
        body,
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(403);
    expect(pulled).toBe(false);
  });

  it('MS6 one image encode at a time (UP-6)', () => {
    expect((payload.config.sharp as unknown as LimitedSharp).peak()).toBe(1);
  });

  it('MS7 the bytes decide the kind, not the claimed type (UP-7)', async () => {
    const tiny = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'عکس با نوع ویدیو' },
        file: file(tiny, 'clip.mp4', 'video/mp4'),
      }),
    ).rejects.toMatchObject({ message: MEDIA_MESSAGES.type });
    const gif = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#fff' },
    })
      .gif()
      .toBuffer();
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'گیف با نوع جی‌پی‌جی' },
        file: file(gif, 'a.jpg', 'image/jpeg'),
      }),
    ).rejects.toMatchObject({ message: MEDIA_MESSAGES.type });
  });

  it('MS8 an editor cannot restore a trashed document (UP-9)', async () => {
    const { editor } = await staffUsers(payload);
    const { doc } = await storedPhoto();
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: { deletedAt: new Date().toISOString() },
    });
    const restore = payload.update({
      collection: 'media',
      id: doc.id,
      data: { deletedAt: null },
      trash: true,
      overrideAccess: false,
      user: editor as never,
    });
    await expect(restore).rejects.toBeTruthy();
    const after = await payload.findByID({
      collection: 'media',
      id: doc.id,
      trash: true,
      depth: 0,
    });
    expect(after.deletedAt).toBeTruthy();
    const live = await storedPhoto();
    const edited = await payload.update({
      collection: 'media',
      id: live.doc.id,
      data: { alt: 'متن تازهٔ ویراستار' },
      overrideAccess: false,
      user: editor as never,
    });
    expect(edited.alt).toBe('متن تازهٔ ویراستار');
  });

  it('MS9 a video with a recording location is refused; a clean one is kept (UP-10)', async () => {
    const xyz = Buffer.concat([
      Buffer.from([0, 0, 0, 30, 0xa9, 0x78, 0x79, 0x7a]),
      Buffer.from('\0\x12\x15\xc7+35.6892+051.3890/', 'latin1'),
    ]);
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'ویدیوی آزمون' },
        file: file(mp4(xyz), 'clip.mp4', 'video/mp4'),
      }),
    ).rejects.toMatchObject({ message: MEDIA_MESSAGES.location });
    const clean = await payload.create({
      collection: 'media',
      data: { alt: 'ویدیوی آزمون بدون مکان' },
      file: file(mp4(), 'clip.mp4', 'video/mp4'),
    });
    expect(clean.mimeType).toBe('video/mp4');
  });

  it('MS10 HEAD of a stored file answers like GET without a body (UP-13)', async () => {
    const { doc } = await storedPhoto();
    const response = await rest(
      REST_GET(config),
      new Request(`http://localhost/api/media/file/${encodeURIComponent(doc.filename as string)}`, {
        method: 'HEAD',
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe('');
  });
});
