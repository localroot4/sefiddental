// Runs last in `postbuild`: puts the compression layer (scripts/compression.mjs) in front of the
// standalone server and precompresses .next/static at brotli 11 and gzip 9. Every way the artifact
// runs starts .next/standalone/server.js (systemd on the VPS, deploy/cpanel/app.cjs,
// scripts/start-standalone.mjs for e2e and Lighthouse), so this file becomes a small server.js
// that installs the layer and imports Next's own, kept as next-server.js. The release tarball and
// the cPanel package copy the whole standalone folder and .next/static, so both carry it.
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

import { MIN_BYTES } from './compression.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');
const MARK = '// Written by scripts/wrap-standalone.mjs';

/** The server.js that installs the layer before Next's server starts. */
export const WRAPPER = `${MARK}: the compression layer, then Next's server.
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

import { install } from './compression.mjs';

install([http, https], { staticDir: fileURLToPath(new URL('.', import.meta.url)) });
await import('./next-server.js');
`;

/** Text-like assets worth a precompressed copy (fonts and images are compressed already). */
const PRECOMPRESS = /\.(js|mjs|css|json|svg|txt|html|xml|webmanifest)$/;

/** Writes `.br` and `.gz` beside every precompressible file of `dir` that they shrink by 10 %. */
export async function precompress(dir) {
  const brotli = promisify(zlib.brotliCompress);
  const gzip = promisify(zlib.gzip);
  const files = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (PRECOMPRESS.test(entry.name) && statSync(full).size >= MIN_BYTES) files.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  let saved = 0;
  // zlib's async calls run on the thread pool: a few at a time keeps every core busy.
  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(
      files.slice(i, i + 8).map(async (file) => {
        const data = readFileSync(file);
        const br = await brotli(data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        });
        const gz = await gzip(data, { level: 9 });
        if (br.length < data.length * 0.9) writeFileSync(`${file}.br`, br);
        if (gz.length < data.length * 0.9) writeFileSync(`${file}.gz`, gz);
        saved += data.length - br.length;
      }),
    );
  }
  return { files: files.length, saved };
}

async function main() {
  const server = path.join(standalone, 'server.js');
  if (!existsSync(server)) {
    console.error(
      'wrap-standalone: .next/standalone/server.js is missing; run after `next build`.',
    );
    process.exit(1);
  }
  if (!readFileSync(server, 'utf8').startsWith(MARK)) {
    renameSync(server, path.join(standalone, 'next-server.js'));
    writeFileSync(server, WRAPPER);
  }
  copyFileSync(
    path.join(root, 'scripts', 'compression.mjs'),
    path.join(standalone, 'compression.mjs'),
  );
  const { files, saved } = await precompress(path.join(root, '.next', 'static'));
  console.log(
    `wrap-standalone: compression layer in server.js; ${files} static files precompressed (brotli 11 saves ${Math.round(saved / 1024)} KiB).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
