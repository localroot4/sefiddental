import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./.data/test.db',
  PAYLOAD_SECRET: 'p'.repeat(43),
};

async function loadMedia(extra: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...extra })) vi.stubEnv(key, value);
  return import('./Media');
}

const ask = (
  handler: Awaited<ReturnType<typeof loadMedia>>['missingLocalFileIs404'],
  filename: string,
) => handler(null, { params: { filename } });

describe('media file handler', () => {
  let dir = '';
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    dir = mkdtempSync(path.join(os.tmpdir(), 'sefid-media-'));
    writeFileSync(path.join(dir, 'photo.webp'), 'x');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('MF1 a file missing from the local disk is 404; others fall through to Payload', async () => {
    const { missingLocalFileIs404 } = await loadMedia({ MEDIA_DIR: dir });
    expect((await ask(missingLocalFileIs404, 'none.jpg'))?.status).toBe(404);
    expect((await ask(missingLocalFileIs404, 'photo.webp/x'))?.status).toBe(404);
    expect(await ask(missingLocalFileIs404, 'photo.webp')).toBeUndefined();
    expect(await ask(missingLocalFileIs404, '../outside.jpg')).toBeUndefined();
  });

  it('MF3 a NUL byte or a name over 255 bytes is a 404, not a 500 with a stack (UP-11)', async () => {
    const { missingLocalFileIs404 } = await loadMedia({ MEDIA_DIR: dir });
    expect((await ask(missingLocalFileIs404, 'a\0'))?.status).toBe(404);
    expect((await ask(missingLocalFileIs404, 'photo.webp\0.png'))?.status).toBe(404);
    expect((await ask(missingLocalFileIs404, `${'a'.repeat(300)}.jpg`))?.status).toBe(404);
  });

  it('MF2 with S3 configured the storage handler answers instead', async () => {
    const { missingLocalFileIs404 } = await loadMedia({
      MEDIA_DIR: dir,
      S3_BUCKET: 'media',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(await ask(missingLocalFileIs404, 'none.jpg')).toBeUndefined();
  });
});

describe('media config (H14a, H36)', () => {
  it('MC1 the og size: 1200x630 JPEG, quality 82, cropped (focal point), no enlargement', async () => {
    const { IMAGE_SIZES, Media } = await loadMedia({ MEDIA_DIR: os.tmpdir() });
    expect(IMAGE_SIZES.find((size) => size.name === 'og')).toMatchObject({
      width: 1200,
      height: 630,
      formatOptions: { format: 'jpeg', options: { quality: 82 } },
    });
    expect(Media.upload).toMatchObject({ focalPoint: true });
    vi.unstubAllEnvs();
  });

  it('MC2 alt text: Persian, not a file name, with the message that names the fix', async () => {
    const { Media } = await loadMedia({ MEDIA_DIR: os.tmpdir() });
    const alt = Media.fields.find((f) => 'name' in f && f.name === 'alt') as {
      validate: (value: unknown, options: object) => Promise<unknown>;
    };
    const options = {
      req: { t: (key: string) => key, payload: { config: { defaultMaxTextLength: 40000 } } },
      required: true,
    };
    expect(await alt.validate('IMG_1234', options)).toBe(
      'متن جایگزین نام فایل است. آنچه در تصویر دیده می‌شود را به فارسی بنویسید.',
    );
    expect(await alt.validate('smiling patient', options)).toBe(
      'متن جایگزین را به فارسی بنویسید: آنچه در تصویر دیده می‌شود.',
    );
    expect(await alt.validate('لبخند بیمار پس از ترمیم', options)).toBe(true);
    vi.unstubAllEnvs();
  });
});
