import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { compressible, compressResponse, MIN_BYTES, negotiate } from './compression.mjs';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const servers: http.Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

/** A server whose responses go through the layer, and its port. */
async function serve(handler: Handler, staticDir?: string): Promise<number> {
  const server = http.createServer((req, res) => {
    compressResponse(req, res, { staticDir });
    handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

interface Got {
  status: number;
  headers: http.IncomingHttpHeaders;
  raw: Buffer;
  /** Milliseconds from the request to the first byte of the body, and to its end. */
  firstAt: number;
  endAt: number;
}

function get(port: number, url: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Promise<Got>((resolve, reject) => {
    const started = performance.now();
    const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, (res) => {
      const parts: Buffer[] = [];
      let firstAt = -1;
      res.on('data', (part: Buffer) => {
        if (firstAt < 0) firstAt = performance.now() - started;
        parts.push(part);
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          raw: Buffer.concat(parts),
          firstAt,
          endAt: performance.now() - started,
        }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

const page = 'سلام دنیا <p>hello</p>\n'.repeat(400);

describe('negotiate', () => {
  it('CP1 br before gzip before identity, by q-value; q=0 and * refuse or allow', () => {
    expect(negotiate('gzip, deflate, br, zstd')).toBe('br');
    expect(negotiate('gzip')).toBe('gzip');
    expect(negotiate('br;q=0.5, gzip;q=0.8')).toBe('gzip');
    expect(negotiate('br;q=0, gzip')).toBe('gzip');
    expect(negotiate('*')).toBe('br');
    expect(negotiate('gzip;q=0, *;q=0.1')).toBe('br');
    expect(negotiate('identity')).toBe('identity');
    expect(negotiate('br;q=0, gzip;q=0')).toBe('identity');
    expect(negotiate(undefined)).toBe('identity');
    expect(negotiate('')).toBe('identity');
  });

  it('CP2 text-like types compress; images, fonts and event streams do not', () => {
    for (const type of [
      'text/html; charset=utf-8',
      'text/x-component',
      'application/javascript; charset=UTF-8',
      'application/json',
      'application/manifest+json',
      'image/svg+xml',
    ])
      expect(compressible(type), type).toBe(true);
    for (const type of [
      'image/avif',
      'font/woff2',
      'application/zip',
      'text/event-stream',
      undefined,
    ])
      expect(compressible(type), String(type)).toBe(false);
  });
});

describe('compressResponse', () => {
  it('CP3 an HTML page comes as brotli with Vary, no length and a weak ETag; gzip and identity on request', async () => {
    const port = await serve((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Vary', 'rsc');
      res.setHeader('ETag', '"abc"');
      res.setHeader('Content-Length', Buffer.byteLength(page));
      res.end(page);
    });
    const br = await get(port, '/', { 'Accept-Encoding': 'gzip, br' });
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers['content-length']).toBeUndefined();
    expect(br.headers.vary).toBe('rsc, Accept-Encoding');
    expect(br.headers.etag).toBe('W/"abc"');
    expect(zlib.brotliDecompressSync(br.raw).toString()).toBe(page);
    expect(br.raw.length).toBeLessThan(Buffer.byteLength(page) / 4);
    const gz = await get(port, '/', { 'Accept-Encoding': 'gzip' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(zlib.gunzipSync(gz.raw).toString()).toBe(page);
    const plain = await get(port, '/');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.headers.vary).toBe('rsc, Accept-Encoding');
    expect(plain.raw.toString()).toBe(page);
  });

  it('CP4 never twice, never a small body, an image, a HEAD, a 304 or a range', async () => {
    const gzipped = zlib.gzipSync(page);
    const port = await serve((req, res) => {
      if (req.url === '/encoded') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Encoding', 'gzip');
        res.end(gzipped);
      } else if (req.url === '/small') {
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      } else if (req.url === '/image') {
        res.setHeader('Content-Type', 'image/avif');
        res.end(Buffer.alloc(MIN_BYTES * 4));
      } else if (req.url === '/not-modified') {
        res.statusCode = 304;
        res.setHeader('Content-Type', 'text/html');
        res.end();
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.end(page);
      }
    });
    const ae = { 'Accept-Encoding': 'br, gzip' };
    const encoded = await get(port, '/encoded', ae);
    expect(encoded.headers['content-encoding']).toBe('gzip');
    expect(encoded.raw.equals(gzipped)).toBe(true);
    const small = await get(port, '/small', ae);
    expect(small.headers['content-encoding']).toBeUndefined();
    expect(small.raw.toString()).toBe('{"ok":true}');
    const image = await get(port, '/image', ae);
    expect(image.headers['content-encoding']).toBeUndefined();
    expect(image.headers.vary).toBeUndefined();
    const head = await get(port, '/', ae, 'HEAD');
    expect(head.headers['content-encoding']).toBeUndefined();
    expect(head.headers.vary).toBe('Accept-Encoding');
    const notModified = await get(port, '/not-modified', ae);
    expect(notModified.status).toBe(304);
    expect(notModified.headers['content-encoding']).toBeUndefined();
    const ranged = await get(port, '/', { ...ae, Range: 'bytes=0-99' });
    expect(ranged.headers['content-encoding']).toBeUndefined();
  });

  it('CP8 headers appended as Next sends a route handler (arrays) are read the same', async () => {
    const json = JSON.stringify({ items: Array.from({ length: 200 }, (_, i) => ({ i })) });
    const port = await serve((_req, res) => {
      res.appendHeader('vary', 'rsc');
      res.appendHeader('content-type', 'application/json; charset=utf-8');
      res.write(json);
      res.end();
    });
    const got = await get(port, '/api/x', { 'Accept-Encoding': 'br' });
    expect(got.headers['content-encoding']).toBe('br');
    expect(got.headers.vary).toBe('rsc, Accept-Encoding');
    expect(zlib.brotliDecompressSync(got.raw).toString()).toBe(json);
  });

  it('CP9 a small body streamed as a route handler streams it goes as it is, with its length', async () => {
    const json = '{"status":"ok","checks":{"db":true}}';
    const port = await serve((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.flushHeaders();
      res.write(json);
      (res as unknown as { flush(): void }).flush();
      res.end();
    });
    const got = await get(port, '/api/health', { 'Accept-Encoding': 'br' });
    expect(got.headers['content-encoding']).toBeUndefined();
    expect(got.headers['content-length']).toBe(String(json.length));
    expect(got.headers.vary).toBe('Accept-Encoding');
    expect(got.raw.toString()).toBe(json);
  });

  it('CP10 a stream whose first chunk is small still sends it at once, compressed', async () => {
    const port = await serve((_req, res) => {
      res.setHeader('Content-Type', 'text/x-component');
      res.flushHeaders();
      res.write('0:"$Sreact.fragment"\n');
      (res as unknown as { flush(): void }).flush();
      setTimeout(() => res.end(page), 300);
    });
    const got = await get(port, '/', { 'Accept-Encoding': 'br' });
    expect(got.headers['content-encoding']).toBe('br');
    expect(got.firstAt).toBeLessThan(200);
    expect(got.endAt).toBeGreaterThanOrEqual(290);
    expect(zlib.brotliDecompressSync(got.raw).toString()).toBe(`0:"$Sreact.fragment"\n${page}`);
  });

  it('CP5 a streamed page: a flushed first chunk arrives before the rest is written', async () => {
    const port = await serve((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.write('<!doctype html><title>first</title>');
      // Next calls flush() after each chunk it writes (pipe-readable.js).
      (res as unknown as { flush(): void }).flush();
      setTimeout(() => res.end(page), 300);
    });
    const got = await get(port, '/', { 'Accept-Encoding': 'br' });
    expect(got.headers['content-encoding']).toBe('br');
    expect(got.firstAt).toBeGreaterThanOrEqual(0);
    expect(got.firstAt).toBeLessThan(200);
    expect(got.endAt).toBeGreaterThanOrEqual(290);
    expect(zlib.brotliDecompressSync(got.raw).toString()).toBe(
      `<!doctype html><title>first</title>${page}`,
    );
  });

  it('CP7 a large streamed body that waits for drain, as Next writes it, arrives whole', async () => {
    const part = Buffer.from(`<div>${'x'.repeat(65_000)}</div>`);
    const port = await serve((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      let left = 32;
      const next = (): void => {
        while (left > 0) {
          left -= 1;
          if (!res.write(part)) {
            res.once('drain', next);
            return;
          }
        }
        res.end();
      };
      next();
    });
    for (const encoding of ['br', 'gzip'] as const) {
      const got = await get(port, '/', { 'Accept-Encoding': encoding });
      const body =
        encoding === 'br' ? zlib.brotliDecompressSync(got.raw) : zlib.gunzipSync(got.raw);
      expect(body.length, encoding).toBe(part.length * 32);
    }
  }, 15_000);

  it('CP6 a static chunk precompressed at build is sent as it is, under the app headers', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'cp6-'));
    try {
      const chunks = path.join(dir, '.next', 'static', 'chunks');
      mkdirSync(chunks, { recursive: true });
      const js = 'console.log("chunk");\n'.repeat(200);
      const br = zlib.brotliCompressSync(js);
      writeFileSync(path.join(chunks, 'a.js'), js);
      writeFileSync(path.join(chunks, 'a.js.br'), br);
      const port = await serve((_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', js.length);
        res.write(js.slice(0, 100));
        res.end(js.slice(100));
      }, dir);
      const got = await get(port, '/_next/static/chunks/a.js', { 'Accept-Encoding': 'br, gzip' });
      expect(got.headers['content-encoding']).toBe('br');
      expect(got.headers['content-length']).toBe(String(br.length));
      expect(got.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(got.raw.equals(br)).toBe(true);
      // No .gz copy: gzip is made per request instead.
      const gz = await get(port, '/_next/static/chunks/a.js', { 'Accept-Encoding': 'gzip' });
      expect(gz.headers['content-encoding']).toBe('gzip');
      expect(zlib.gunzipSync(gz.raw).toString()).toBe(js);
      // A path out of the static folder is never read.
      const out = await get(port, '/_next/static/../../etc/passwd', { 'Accept-Encoding': 'br' });
      expect(out.raw.equals(br)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
