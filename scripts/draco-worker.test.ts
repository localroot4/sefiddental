import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildDracoWorker, dracoWorkerSource } from './draco-worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('dracoWorkerSource', () => {
  it('W1 keeps the wrapper and only the inside of DRACOWorker, nested braces included', () => {
    const loader = [
      'class DRACOLoader {}',
      'function DRACOWorker() {',
      "  onmessage = function (e) { switch (e.data.type) { case 'decode': break; } };",
      '}',
      'export { DRACOLoader };',
    ].join('\n');
    const out = dracoWorkerSource(loader, 'var DracoDecoderModule = 1;');
    expect(out.startsWith('/* draco decoder */\nvar DracoDecoderModule = 1;')).toBe(true);
    expect(out).toContain("case 'decode'");
    expect(out).not.toContain('function DRACOWorker');
    expect(out).not.toContain('export {');
    expect(out).not.toContain('class DRACOLoader');
  });

  it('W2 fails loud when the loader changed shape', () => {
    expect(() => dracoWorkerSource('function Other() {}', '')).toThrow(/not found/);
    expect(() => dracoWorkerSource('function DRACOWorker() { {', '')).toThrow(/closing brace/);
    expect(() => dracoWorkerSource('function DRACOWorker() { }', '')).toThrow(/decode/);
  });

  it('W3 builds from the installed three (0.186): init and decode handlers, the wasm wrapper', () => {
    const out = buildDracoWorker(root);
    expect(out).toContain('DracoDecoderModule');
    expect(out).toContain("case 'init'");
    expect(out).toContain("case 'decode'");
    // A worker body, not a module: three runs it as a classic script.
    expect(out).not.toMatch(/^export /m);
  });
});
