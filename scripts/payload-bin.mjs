// Runs Payload's CLI inside one tsx process; scripts/payload.mjs starts it and retries a stall.
// A timer holds the event loop open: on Node 22 tsx compiles in a loader thread that does not, so
// Node would otherwise quit (exit 0 or 13) while an import is still pending.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const keepAlive = setInterval(() => {}, 60_000);
// The exports map hides payload/dist/bin; the main entry is payload/dist/index.js.
const main = createRequire(import.meta.url).resolve('payload');
const { bin } = await import(pathToFileURL(path.join(path.dirname(main), 'bin', 'index.js')).href);
try {
  await bin(); // exits the process itself on success
} finally {
  clearInterval(keepAlive);
}
