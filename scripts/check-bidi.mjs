// Fails when a source file contains a literal bidirectional control character (spec-utils G5,
// the "Trojan Source" class of bugs): such characters reorder how code is displayed, so a
// review can read something other than what runs. Tests and tables write them as \u escapes.
//   node scripts/check-bidi.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** LRM, RLM, LRE..RLO (embeddings and overrides), LRI..PDI (isolates). */
export const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const SCANNED_DIRS = ['src', 'tests', 'scripts'];
const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.yaml',
  '.yml',
]);

/**
 * @param {string} text
 * @returns {{ line: number, column: number, codePoint: string }[]}
 */
export function findBidiControls(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((content, index) => {
    for (const match of content.matchAll(BIDI_CONTROLS)) {
      hits.push({
        line: index + 1,
        column: (match.index ?? 0) + 1,
        codePoint: `U+${match[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`,
      });
    }
  });
  return hits;
}

function listFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(full);
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = SCANNED_DIRS.flatMap((dir) => listFiles(path.join(root, dir)));
  let found = 0;
  for (const file of files) {
    for (const hit of findBidiControls(readFileSync(file, 'utf8'))) {
      found += 1;
      const where = `${path.relative(root, file)}:${hit.line}:${hit.column}`;
      console.error(
        `${where} ${hit.codePoint}: write it as an escape (\\u${hit.codePoint.slice(2)})`,
      );
    }
  }
  if (found > 0) {
    console.error(`check-bidi: ${found} literal bidi control character(s) in source files.`);
    process.exit(1);
  }
  console.log(`check-bidi: ${files.length} files, no literal bidi control characters.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
