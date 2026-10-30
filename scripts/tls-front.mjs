// HTTPS and HTTP/2 in front of the local server, for Lighthouse (scripts/lhci.mjs starts it)
// and the WebKit e2e run (playwright.config.ts). Browsers reach production through a TLS
// terminator that speaks HTTP/2 (docs/deploy.md 2.5). Lighthouse models plain HTTP/1.1 as six
// cold connections, which is not what ships.
//   node scripts/tls-front.mjs <key.pem> <cert.pem> <listen port> <upstream port>
//   node scripts/tls-front.mjs <listen port> <upstream port>   (a throwaway localhost certificate)
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream';

import { localCertificate } from './lhci.mjs';

function credentials(args) {
  if (args.length === 4) return { key: readFileSync(args[0]), cert: readFileSync(args[1]) };
  // The key lives in memory only: the folder is gone before the server listens.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tls-front-'));
  try {
    const tls = localCertificate(dir);
    return { key: readFileSync(tls.key), cert: readFileSync(tls.cert) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const [listenPort, upstreamPort] = args.slice(-2);

// Connection-specific headers: HTTP/2 forbids them (RFC 9113 8.2.2); each hop sets its own.
const HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'host',
  'http2-settings',
]);
const endToEnd = (headers) =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !k.startsWith(':') && !HOP.has(k)));

const server = http2.createSecureServer(
  // HTTP/1.1 too: Playwright's request fixture and Node's fetch do not speak HTTP/2.
  { ...credentials(args), allowHTTP1: true },
  (req, res) => {
    const upstream = http.request(
      {
        // 'localhost' as the app binds it (HOSTNAME may be localhost on ::1); Node tries both.
        host: 'localhost',
        port: Number(upstreamPort),
        method: req.method,
        path: req.url,
        // The app answers its SITE_URL host only (canonical redirect), so keep that host.
        headers: { ...endToEnd(req.headers), host: `localhost:${upstreamPort}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, endToEnd(up.headers));
        // A body cut upstream must end the browser's stream too, not leave it waiting.
        pipeline(up, res, (error) => {
          if (error && res.stream && !res.stream.destroyed)
            res.stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR);
        });
      },
    );
    // The browser cancelled the stream (a prefetch, a navigation): free the upstream socket.
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy();
    });
    upstream.on('error', (error) => {
      if (res.stream?.destroyed ?? res.destroyed) return;
      console.error(`tls-front: ${req.method} ${req.url} failed upstream: ${error.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);

server.listen(Number(listenPort), 'localhost', () => {
  console.log(`tls-front: https://localhost:${listenPort} -> http://localhost:${upstreamPort}`);
});
