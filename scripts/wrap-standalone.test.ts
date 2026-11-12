import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { precompress, WRAPPER } from './wrap-standalone.mjs';

describe('wrap-standalone', () => {
  it('WS1 precompresses text assets that shrink, at every depth; never small files, fonts or noise', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ws1-'));
    try {
      const chunks = path.join(dir, 'chunks', 'app');
      mkdirSync(chunks, { recursive: true });
      const js = 'export const value = "سلام";\n'.repeat(400);
      writeFileSync(path.join(chunks, 'big.js'), js);
      writeFileSync(path.join(chunks, 'tiny.js'), 'x');
      writeFileSync(path.join(dir, 'font.woff2'), 'w'.repeat(5000));
      writeFileSync(path.join(dir, 'noise.css'), randomBytes(4000));
      const { files } = await precompress(dir);
      expect(files).toBe(2);
      expect(
        zlib.brotliDecompressSync(readFileSync(path.join(chunks, 'big.js.br'))).toString(),
      ).toBe(js);
      expect(zlib.gunzipSync(readFileSync(path.join(chunks, 'big.js.gz'))).toString()).toBe(js);
      expect(existsSync(path.join(chunks, 'tiny.js.br'))).toBe(false);
      expect(existsSync(path.join(dir, 'font.woff2.br'))).toBe(false);
      // Random bytes do not shrink by 10 %: no copy to send instead.
      expect(existsSync(path.join(dir, 'noise.css.br'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("WS2 the wrapper installs the layer on http and https before it imports Next's server", () => {
    const install = WRAPPER.indexOf('install([http, https]');
    const next = WRAPPER.indexOf("await import('./next-server.js')");
    expect(install).toBeGreaterThan(0);
    expect(next).toBeGreaterThan(install);
  });
});
