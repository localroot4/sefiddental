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
