// V8 explicit compile hints (Chromium 136+). With the magic comment first, V8 compiles every
// function of the file on a background thread while the chunk streams in, instead of lazily on
// the main thread when Turbopack instantiates the modules. Hinted:
// - the bootstrap chunks, `rootMainFiles` of .next/build-manifest.json (Next's entry, react-dom,
//   the router, the Turbopack runtime): every page instantiates them in its bootstrap long task.
//   Not the pages' own entry chunks: on a 2-core machine the background compile of all initial
//   chunks (650 KB) competed with the main thread and the tier 0 gain vanished;
// - the scroll engine's gsap chunks (gsap core, ScrollTrigger: the engine evaluation after `load`,
//   tier 1, 20 to 30 ms/run less), found by check:bundle B3's markers.
// Runs as `postbuild`, after `next build` and before anything copies .next/static:
//   node scripts/compile-hints.mjs
// It edits build output after Next wrote it: Subresource Integrity (`experimental.sri`) would
// reject the edited chunks and browser source maps (`productionBrowserSourceMaps`) would map one
// line off. Neither is on; turning one on means dropping this step.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HINT = '//# allFunctionsCalledOnLoad\n';

/** A gsap core or ScrollTrigger chunk (check:bundle B3's markers). */
export const isGsap = (source) => source.includes('_gsap') || source.includes('ScrollTrigger');

/** The chunk with the hint first; null for a chunk to leave as it is or one already hinted. */
export function withHint(source, bootstrap) {
  if (source.startsWith(HINT) || !(bootstrap || isGsap(source))) return null;
  return HINT + source;
}

/** The bootstrap chunks, as paths relative to `.next`: the build manifest's `rootMainFiles`. */
export function bootstrapChunks(buildManifestJson) {
  const files = (JSON.parse(buildManifestJson).rootMainFiles ?? []).filter((file) =>
    file.endsWith('.js'),
  );
  // A Next.js upgrade that moves the list would silently drop the gain: fail the build.
  if (files.length === 0) {
    throw new Error('compile-hints: .next/build-manifest.json lists no rootMainFiles chunk');
  }
  return files;
}

/** Hints the chunks under `next` (a `.next` directory); returns the names it wrote. */
export function hintChunks(next) {
  const bootstrap = new Set(
    bootstrapChunks(readFileSync(path.join(next, 'build-manifest.json'), 'utf8')).map((file) =>
      path.normalize(path.join(next, file)),
    ),
  );
  const dir = path.join(next, 'static', 'chunks');
  const hinted = [];
  let found = 0;
  let gsap = 0;
  for (const name of readdirSync(dir, { recursive: true })) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(dir, name);
    const source = readFileSync(file, 'utf8');
    if (bootstrap.has(file)) found += 1;
    else if (isGsap(source)) gsap += 1;
    const hintedSource = withHint(source, bootstrap.has(file));
    if (hintedSource === null) continue;
    writeFileSync(file, hintedSource);
    hinted.push(name);
  }
  if (found !== bootstrap.size) {
    throw new Error(
      `compile-hints: ${bootstrap.size - found} of the ${bootstrap.size} rootMainFiles chunks are not in ${dir}`,
    );
  }
  // gsap renaming its markers would drop the engine hints (and check:bundle B3) without a word.
  if (gsap === 0) throw new Error(`compile-hints: no gsap chunk (_gsap, ScrollTrigger) in ${dir}`);
  return hinted;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const next = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), '.next');
  const hinted = hintChunks(next);
  console.log(`compile-hints: ${hinted.length} chunk(s): ${hinted.join(', ') || 'none'}`);
}
