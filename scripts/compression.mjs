// Response compression for the standalone server (scripts/wrap-standalone.mjs installs it in
// .next/standalone/server.js; next.config.ts sets compress: false). Next's own compression is gzip
// only; brotli halves the home's HTML, whose RSC payload repeats the markup beyond gzip's 32 KB
// window (69 KiB gzip, 35 to 42 KiB brotli). Plain Node: zlib has brotli, no dependency.
//
// - Accept-Encoding picks br, then gzip, then identity, by q-value; Vary: Accept-Encoding on every
//   compressible response, compressed or not.
// - Never twice: an encoded response, 204, 304, HEAD, a range, a known body under MIN_BYTES, a
//   type that is not text-like (images, fonts, archives) or Cache-Control: no-transform pass as is.
// - Streaming: Next calls res.flush() after each chunk it writes (pipe-readable.js); the layer
//   flushes the compressor then, so the first bytes of the HTML and the RSC stream go out at once.
// - Content-Length goes, a strong ETag turns weak (the bytes differ, the content does not).
// - /_next/static/ files precompressed at build (`.br`, `.gz` beside them) are sent instead of
//   Next's body, under Next's own headers (cache, security, type).
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Bodies shorter than this (bytes, when known) are not worth the encoding. */
export const MIN_BYTES = 1024;
/**
 * Brotli quality for responses made per request: the home's 439 KB HTML, flushed every 16 KB as
 * Next streams it, takes 5.1 ms of CPU at 5 for 42.5 KiB (4: 3.8 ms, 46.8 KiB; gzip 6: 6.1 ms,
 * 69.3 KiB).
 */
export const DYNAMIC_BR_QUALITY = 5;
const GZIP_LEVEL = 6;

const COMPRESSIBLE =
  /^(text\/(?!event-stream)|application\/(javascript|json|xml|x-component|manifest\+json|ld\+json|[\w.+-]*\+(json|xml))|image\/svg\+xml)/i;

/** Whether a Content-Type is worth compressing (text-like, not already compressed). */
export function compressible(type) {
  return typeof type === 'string' && COMPRESSIBLE.test(type);
}

/**
 * The encoding for an Accept-Encoding header: 'br', 'gzip' or 'identity' (RFC 9110 12.5.3).
 * A missing header is identity; q=0 refuses; `*` stands for any coding not listed; br wins a tie.
 */
export function negotiate(header) {
  if (typeof header !== 'string' || header.trim() === '') return 'identity';
  const q = new Map();
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    let value = 1;
    for (const p of params) {
      const [k, v] = p.trim().split('=');
      if (k === 'q') value = Number.isFinite(Number(v)) ? Number(v) : 0;
    }
    q.set(name.trim(), value);
  }
  const of = (name) => q.get(name) ?? q.get('*') ?? (name === 'identity' ? 1 : 0);
  const br = of('br');
  const gzip = of('gzip');
  if (br > 0 && br >= gzip) return 'br';
  if (gzip > 0) return 'gzip';
  return 'identity';
}

/** A header's value as one string: Next's appendHeader leaves arrays (send-response.js). */
function one(res, name) {
  const value = res.getHeader(name);
  return Array.isArray(value) ? value.join(', ') : value === undefined ? undefined : String(value);
}

/** Appends Accept-Encoding to the response's Vary once. */
function vary(res) {
  const list = (one(res, 'Vary') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (list.includes('*') || list.some((v) => v.toLowerCase() === 'accept-encoding')) return;
  res.setHeader('Vary', [...list, 'Accept-Encoding'].join(', '));
}

function weaken(res) {
  const etag = one(res, 'ETag');
  if (etag && !etag.startsWith('W/')) res.setHeader('ETag', `W/${etag}`);
}

function createEncoder(encoding) {
  return encoding === 'br'
    ? zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: DYNAMIC_BR_QUALITY,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      })
    : zlib.createGzip({ level: GZIP_LEVEL });
}

/**
 * The precompressed copy of a /_next/static/ file for `encoding`, or null. `staticDir` is the
 * folder that holds `.next/static` (the standalone server's own folder).
 */
export function precompressed(staticDir, url, encoding) {
  if (!staticDir || encoding === 'identity' || !url?.startsWith('/_next/static/')) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.split('?')[0]);
  } catch {
    return null;
  }
  const file = path.join(staticDir, '.next', pathname.slice('/_next/'.length));
  // Never outside the static folder (a crafted path), whatever the router would answer.
  if (!file.startsWith(path.join(staticDir, '.next', 'static') + path.sep)) return null;
  const variant = `${file}.${encoding === 'br' ? 'br' : 'gz'}`;
  try {
    const stat = statSync(variant);
    return stat.isFile() ? { file: variant, size: stat.size } : null;
  } catch {
    return null;
  }
}

/**
 * Compresses `res` for `req` where it pays (see the file comment). Call before the app handles
 * the request; the app writes as usual.
 */
export function compressResponse(req, res, { staticDir } = {}) {
  const encoding = negotiate(req.headers['accept-encoding']);
  const head = req.method === 'HEAD';
  const ranged = req.headers.range !== undefined;
  const writeHead = res.writeHead;
  const write = res.write;
  const end = res.end;
  const flushOp =
    encoding === 'br' ? zlib.constants.BROTLI_OPERATION_FLUSH : zlib.constants.Z_SYNC_FLUSH;
  /**
   * null until the headers are decided; then 'pass', 'file', 'stream', or 'pending': a body of
   * unknown length held (headers too) until it passes MIN_BYTES, ends short of it, or is flushed.
   */
  let mode = null;
  let encoder = null;
  let file = null;
  let message;
  let held = [];
  let heldBytes = 0;
  let commitSoon = false;

  const sendHead = () =>
    message === undefined
      ? writeHead.call(res, res.statusCode)
      : writeHead.call(res, res.statusCode, message);

  const decide = () => {
    if (mode !== null) return;
    mode = 'pass';
    if (!compressible(one(res, 'Content-Type')) || one(res, 'Content-Encoding')) return;
    vary(res);
    if (encoding === 'identity' || head || ranged) return;
    if (res.statusCode === 204 || res.statusCode === 304 || res.statusCode < 200) return;
    if (/\bno-transform\b/i.test(one(res, 'Cache-Control') ?? '')) return;
    const length = Number(one(res, 'Content-Length'));
    if (Number.isFinite(length) && length < MIN_BYTES) return;
    const copy = res.statusCode === 200 ? precompressed(staticDir, req.url, encoding) : null;
    if (copy) {
      mode = 'file';
      file = copy.file;
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Content-Length', copy.size);
      weaken(res);
      return;
    }
    mode = Number.isFinite(length) ? 'stream' : 'pending';
    if (mode === 'stream') startEncoder();
  };

  /** Headers for the encoded body and the encoder; the caller sends the head. */
  const startEncoder = () => {
    mode = 'stream';
    res.setHeader('Content-Encoding', encoding);
    res.removeHeader('Content-Length');
    weaken(res);
    encoder = createEncoder(encoding);
    encoder.on('data', (chunk) => {
      if (write.call(res, chunk) === false) encoder.pause();
    });
    res.on('drain', () => encoder.resume());
    // A full compressor made res.write return false: the app waits for res 'drain' to go on.
    encoder.on('drain', () => res.emit('drain'));
    encoder.on('end', () => end.call(res));
    encoder.on('error', (error) => res.destroy(error));
    // A client gone mid-stream: the compressor goes with it.
    res.on('close', () => {
      if (!res.writableFinished) encoder.destroy();
    });
  };

  /** From 'pending' to an encoded stream: the head goes out, the held bytes into the encoder. */
  const commit = () => {
    if (mode !== 'pending') return;
    startEncoder();
    sendHead();
    const body = Buffer.concat(held);
    held = [];
    if (body.length > 0) encoder.write(body);
  };

  const hold = (chunk, enc) => {
    if (chunk === undefined || chunk === null || typeof chunk === 'function') return;
    const part = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk, typeof enc === 'string' ? enc : undefined);
    held.push(part);
    heldBytes += part.length;
  };

  res.writeHead = function (status, ...rest) {
    // writeHead(status, [message], [headers]): its headers first, so the decision sees them.
    const headers = rest.find((arg) => arg !== null && typeof arg === 'object');
    if (Array.isArray(headers)) {
      // Raw pairs: [[name, value], ...] or [name, value, name, value, ...].
      const pairs = Array.isArray(headers[0])
        ? headers
        : headers.flatMap((v, i) => (i % 2 === 0 ? [[v, headers[i + 1]]] : []));
      for (const [k, v] of pairs) this.setHeader(k, v);
    } else if (headers) {
      for (const [k, v] of Object.entries(headers)) if (v !== undefined) this.setHeader(k, v);
    }
    if (typeof rest[0] === 'string') message = rest[0];
    this.statusCode = status;
    decide();
    // Pending: the head waits for the body (flushHeaders included).
    if (mode === 'pending') return this;
    return sendHead();
  };
  res.write = function (chunk, enc, cb) {
    if (mode === null && !this.headersSent) this.writeHead(this.statusCode);
    const done = [enc, cb].find((arg) => typeof arg === 'function');
    if (mode === 'pending') {
      hold(chunk, enc);
      if (heldBytes >= MIN_BYTES) commit();
      if (done) process.nextTick(done);
      return true;
    }
    if (mode === 'file') {
      // Next's own body is replaced by the precompressed copy at end.
      if (done) process.nextTick(done);
      return true;
    }
    if (mode !== 'stream') return write.call(this, chunk, enc, cb);
    return encoder.write(chunk, typeof enc === 'string' ? enc : undefined, done);
  };
  res.end = function (chunk, enc, cb) {
    const done = [chunk, enc, cb].find((arg) => typeof arg === 'function');
    const body = typeof chunk === 'function' ? undefined : chunk;
    if (mode === null && !this.headersSent) {
      // A whole body in one call: its length decides (no Content-Length set by the app).
      if (body !== undefined && body !== null && !this.hasHeader('Content-Length')) {
        this.setHeader(
          'Content-Length',
          Buffer.byteLength(body, typeof enc === 'string' ? enc : undefined),
        );
      }
      this.writeHead(this.statusCode);
    }
    // The body is in the held bytes once a pending response takes it.
    let taken = false;
    if (mode === 'pending') {
      hold(body, enc);
      taken = true;
      if (heldBytes < MIN_BYTES) {
        // Ended short: the body goes as it is, with its length.
        mode = 'pass';
        this.setHeader('Content-Length', heldBytes);
        sendHead();
        const whole = Buffer.concat(held);
        held = [];
        return end.call(this, whole, done);
      }
      commit();
    }
    if (mode === 'file') {
      if (done) this.once('finish', done);
      const stream = createReadStream(file);
      stream.on('data', (part) => {
        if (write.call(this, part) === false) stream.pause();
      });
      this.on('drain', () => stream.resume());
      stream.on('end', () => end.call(this));
      stream.on('error', (error) => this.destroy(error));
      return this;
    }
    if (mode !== 'stream') return end.call(this, chunk, enc, cb);
    if (done) this.once('finish', done);
    if (!taken && body !== undefined && body !== null)
      encoder.write(body, typeof enc === 'string' ? enc : undefined);
    encoder.end();
    return this;
  };
  // Next flushes after each streamed chunk: the compressor gives its bytes out at once. A body
  // still pending commits one macrotask later, so one that ends at once (a small route handler
  // response) still goes as it is.
  res.flush = function () {
    if (mode === 'stream') encoder.flush(flushOp);
    else if (mode === 'pending' && !commitSoon) {
      commitSoon = true;
      setImmediate(() => {
        if (mode !== 'pending') return;
        commit();
        encoder.flush(flushOp);
      });
    }
  };
}

/**
 * Wraps every request listener `http` (and `https`) servers get from here on, before the app's
 * server starts: the standalone server.js creates its server with createServer(listener).
 */
export function install(modules, options) {
  for (const mod of modules) {
    const create = mod.createServer;
    mod.createServer = function (...args) {
      const at = args.findIndex((arg) => typeof arg === 'function');
      if (at >= 0) {
        const listener = args[at];
        args[at] = function (req, res) {
          compressResponse(req, res, options);
          return listener.call(this, req, res);
        };
      }
      return create.apply(this, args);
    };
  }
}
