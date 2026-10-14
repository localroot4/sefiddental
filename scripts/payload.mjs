// Runs the Payload CLI with the event loop held open.
// shortcut: payload/bin.js starts tsx with `void start()`; while tsx's loader thread compiles on a
// cold cache, nothing keeps the main event loop alive, so Node exits 0 before the script runs
// (seen as a seeder run with no output and no rows). Drop this file once Payload awaits start().
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const keepAlive = setInterval(() => {}, 1 << 30);
process.on('exit', () => clearInterval(keepAlive));
// The exports map hides package.json and bin.js; the main entry lives in <package>/dist/.
const main = createRequire(import.meta.url).resolve('payload');
const bin = path.join(main.slice(0, main.lastIndexOf(`${path.sep}dist${path.sep}`)), 'bin.js');
await import(pathToFileURL(bin).href);
