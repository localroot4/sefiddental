import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapChunks, HINT, hintChunks, withHint } from './compile-hints.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A `.next` directory with the build manifest and the chunks given (name: source). */
function fakeNext(rootMainFiles: string[] | undefined, chunks: Record<string, string>): string {
  const next = mkdtempSync(path.join(tmpdir(), 'compile-hints-'));
  dirs.push(next);
  mkdirSync(path.join(next, 'static', 'chunks'), { recursive: true });
  writeFileSync(
    path.join(next, 'build-manifest.json'),
    JSON.stringify({ polyfillFiles: ['static/chunks/poly.js'], rootMainFiles }),
  );
  for (const [name, source] of Object.entries(chunks)) {
    writeFileSync(path.join(next, 'static', 'chunks', name), source);
  }
  return next;
}

const read = (next: string, name: string) =>
  readFileSync(path.join(next, 'static', 'chunks', name), 'utf8');

describe('compile-hints', () => {
  it('T-CH1 a bootstrap chunk, and a gsap chunk (gsap core or ScrollTrigger), get the hint first', () => {
    expect(withHint('(()=>{react()})()', true)).toBe(`${HINT}(()=>{react()})()`);
    expect(withHint('(()=>{t._gsap||1})()', false)).toBe(`${HINT}(()=>{t._gsap||1})()`);
    expect(withHint('e.ScrollTrigger=r', false)?.startsWith(HINT)).toBe(true);
  });

  it('T-CH2 any other chunk, and a chunk already hinted, stay as they are', () => {
    expect(withHint('(()=>{react()})()', false)).toBeNull();
    expect(withHint(`${HINT}t._gsap`, false)).toBeNull();
    expect(withHint(`${HINT}react()`, true)).toBeNull();
  });

  it('T-CH3 the bootstrap chunks are the root main files; none listed fails the build', () => {
    const manifest = (rootMainFiles?: string[]) => JSON.stringify({ rootMainFiles });
    expect(bootstrapChunks(manifest(['static/chunks/react.js', 'static/chunks/x.css']))).toEqual([
      'static/chunks/react.js',
    ]);
    expect(() => bootstrapChunks(manifest(undefined))).toThrow(/no rootMainFiles/);
    expect(() => bootstrapChunks(manifest([]))).toThrow(/no rootMainFiles/);
  });

  it('T-CH4 a build: the root main files and the gsap chunks get the hint, page chunks do not; a second run writes nothing', () => {
    const next = fakeNext(['static/chunks/react.js', 'static/chunks/turbopack-x.js'], {
      'react.js': 'react()',
      'turbopack-x.js': 'runtime()',
      'home.js': 'page()',
      'gsap.js': 't._gsap',
      'poly.js': 'poly()',
    });
    expect(hintChunks(next).sort()).toEqual(['gsap.js', 'react.js', 'turbopack-x.js']);
    expect(read(next, 'react.js')).toBe(`${HINT}react()`);
    expect(read(next, 'home.js')).toBe('page()');
    expect(read(next, 'poly.js')).toBe('poly()');
    expect(hintChunks(next)).toEqual([]);
  });

  it('T-CH5 a root main file missing on disk, or no gsap chunk, fails the build', () => {
    const missing = fakeNext(['static/chunks/react.js', 'static/chunks/gone.js'], {
      'react.js': 'react()',
      'gsap.js': 't._gsap',
    });
    expect(() => hintChunks(missing)).toThrow(/1 of the 2 rootMainFiles chunks are not in/);
    const noGsap = fakeNext(['static/chunks/react.js'], { 'react.js': 'react()' });
    expect(() => hintChunks(noGsap)).toThrow(/no gsap chunk/);
  });
});
