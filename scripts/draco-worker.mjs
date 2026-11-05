// The Draco decoder worker of the home world (phase 8), written to public/brand/3d/draco/ by
// scripts/sync-public-assets.mjs. three's DRACOLoader builds its worker from a blob: URL, which
// the page CSP forbids (worker-src 'self'), and the wasm inside it would run under the page's
// script-src, which has no 'wasm-unsafe-eval'. A same-origin worker script runs under its own
// response's CSP instead, so the file is the same body three would put in the blob: the gltf
// wasm wrapper, then the inside of `function DRACOWorker() { ... }` from DRACOLoader.js.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const START = 'function DRACOWorker() {';

/** The worker body three builds in `_initDecoder`; throws when the loader source changed shape. */
export function dracoWorkerSource(loaderSource, wrapperSource) {
  const start = loaderSource.indexOf(START);
  if (start < 0) throw new Error(`draco-worker: "${START}" not found in DRACOLoader.js`);
  let depth = 0;
  let end = -1;
  for (let i = start + START.length - 1; i < loaderSource.length; i++) {
    const char = loaderSource[i];
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('draco-worker: DRACOWorker has no closing brace');
  const body = loaderSource.slice(start + START.length, end);
  if (!body.includes("case 'decode'")) {
    throw new Error("draco-worker: DRACOWorker has no 'decode' message any more");
  }
  return ['/* draco decoder */', wrapperSource, '', '/* worker */', body].join('\n');
}

/** Reads the installed three's loader and gltf wrapper from `root`. */
export function buildDracoWorker(root) {
  const jsm = path.join(root, 'node_modules', 'three', 'examples', 'jsm');
  return dracoWorkerSource(
    readFileSync(path.join(jsm, 'loaders', 'DRACOLoader.js'), 'utf8'),
    readFileSync(path.join(jsm, 'libs', 'draco', 'gltf', 'draco_wasm_wrapper.js'), 'utf8'),
  );
}
