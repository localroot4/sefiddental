// The standalone server's compression layer (scripts/compression.mjs, installed by
// scripts/wrap-standalone.mjs): brotli, then gzip, then identity by Accept-Encoding; Vary on
// every compressible response; static chunks from their build-time copies; small bodies, HEAD and
// fonts as they are. Raw bytes through node:http: Playwright's request context may decode them.
import http from 'node:http';
import zlib from 'node:zlib';

import { expect, test } from '@playwright/test';

interface Raw {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function raw(url: string, headers: Record<string, string>, method = 'GET'): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const parts: Buffer[] = [];
      res.on('data', (part: Buffer) => parts.push(part));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts) }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

const decode = (r: Raw): string => {
  const encoding = r.headers['content-encoding'];
  if (encoding === 'br') return zlib.brotliDecompressSync(r.body).toString();
  if (encoding === 'gzip') return zlib.gunzipSync(r.body).toString();
  return r.body.toString();
};

const varies = (r: Raw): boolean =>
  String(r.headers.vary ?? '')
    .split(',')
    .some((v) => v.trim().toLowerCase() === 'accept-encoding');

const BROWSER = { 'Accept-Encoding': 'gzip, deflate, br, zstd' };

test.describe('compression', () => {
  let base = '';
  test.beforeAll(({}, testInfo) => {
    base = String(testInfo.project.use.baseURL);
  });

  test('T-CZ1 the home: brotli for a browser, gzip or identity on request, the same page in each', async () => {
    const url = new URL('/?tier=1', base).href;
    const br = await raw(url, BROWSER);
    expect(br.status).toBe(200);
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers['content-length']).toBeUndefined();
    expect(varies(br)).toBe(true);
    // The static security set and the CSP are untouched.
    expect(br.headers['x-content-type-options']).toBe('nosniff');
    expect(br.headers['content-security-policy']).toBeTruthy();
    const page = decode(br);
    expect(page).toContain('id="hero-h1"');
    expect(page.trimEnd().endsWith('</html>')).toBe(true);
    const gz = await raw(url, { 'Accept-Encoding': 'gzip' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(decode(gz)).toContain('id="hero-h1"');
    const plain = await raw(url, {});
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(varies(plain)).toBe(true);
    // brotli carries the page in well under two thirds of gzip's bytes.
    expect(br.body.length).toBeLessThan(gz.body.length * 0.67);
    // HEAD: no body to encode, the same Vary.
    const head = await raw(url, BROWSER, 'HEAD');
    expect(head.headers['content-encoding']).toBeUndefined();
    expect(varies(head)).toBe(true);
  });

  test('T-CZ2 a static chunk comes from its build-time brotli copy, under the immutable cache headers', async () => {
    const html = decode(await raw(new URL('/', base).href, BROWSER));
    const chunk = /\/_next\/static\/chunks\/[\w-]+\.js/.exec(html)?.[0];
    expect(chunk, 'a chunk in the home HTML').toBeTruthy();
    const url = new URL(chunk!, base).href;
    const br = await raw(url, BROWSER);
    const plain = await raw(url, {});
    expect(br.headers['content-encoding']).toBe('br');
    expect(Number(br.headers['content-length'])).toBe(br.body.length);
    expect(br.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(br.headers['x-content-type-options']).toBe('nosniff');
    expect(varies(br)).toBe(true);
    expect(decode(br)).toBe(plain.body.toString());
  });

  test('T-CZ3 API routes: a small JSON body as it is, with its length and Vary (a large one compresses: CP8)', async () => {
    // Payload's REST API answers a guest with a short JSON error; /api/health with its checks.
    for (const path of ['/api/services?limit=1', '/api/health']) {
      const got = await raw(new URL(path, base).href, BROWSER);
      expect(got.headers['content-type'], path).toMatch(/^application\/json/);
      expect(got.headers['content-encoding'], path).toBeUndefined();
      expect(Number(got.headers['content-length']), path).toBe(got.body.length);
      expect(varies(got), path).toBe(true);
      expect(() => JSON.parse(got.body.toString()), path).not.toThrow();
    }
  });

  test('T-CZ4 a font goes as it is: woff2 is compressed already', async () => {
    const html = decode(await raw(new URL('/', base).href, BROWSER));
    const font = /\/_next\/static\/media\/[\w.-]+\.woff2/.exec(html)?.[0];
    expect(font).toBeTruthy();
    const got = await raw(new URL(font!, base).href, BROWSER);
    expect(got.status).toBe(200);
    expect(got.headers['content-encoding']).toBeUndefined();
    expect(varies(got)).toBe(false);
  });
});
