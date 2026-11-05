/**
 * The world's downloads per tier (scene `assets` contract, docs/experience-direction.md section 4
 * WebGL budgets): the brand models (Draco glTF, design/brand/3d) and the Draco decoder, served
 * from public/brand/3d by scripts/sync-public-assets.mjs. No textures: every material is
 * procedural, so no file is over 2048 px and the KTX2 step has nothing to compress. Bytes are the
 * transfer sizes: the server gzips these files (measured: equal to zlib's default level, which
 * assets.test.ts holds them to); raw, the decoder is 257 KB of the 271.
 */
import type { AssetManifest, AssetManifestEntry } from '../scenes/types';

const BASE = '/brand/3d';

export const MODELS = {
  mark: `${BASE}/mark.glb`,
  diamond: `${BASE}/diamond.glb`,
} as const;

export const DRACO_FILES = {
  worker: `${BASE}/draco/draco-worker.js`,
  wasm: `${BASE}/draco/draco_decoder.wasm`,
} as const;

const BYTES: Record<string, number> = {
  [MODELS.mark]: 8529,
  [MODELS.diamond]: 4479,
  [DRACO_FILES.worker]: 13537,
  [DRACO_FILES.wasm]: 63458,
};

const entry = (url: string): AssetManifestEntry => ({ url, bytes: BYTES[url] ?? 0 });

/** The decoder comes with any model; the same files at every tier (no tiered meshes here). */
export function modelManifest(...models: (keyof typeof MODELS)[]): AssetManifest {
  return [
    ...models.map((name) => entry(MODELS[name])),
    entry(DRACO_FILES.worker),
    entry(DRACO_FILES.wasm),
  ];
}

/** Every distinct file of several manifests, counted once (the browser caches repeats). */
export function manifestBytes(manifests: readonly AssetManifest[]): number {
  const seen = new Map<string, number>();
  for (const manifest of manifests) for (const item of manifest) seen.set(item.url, item.bytes);
  let total = 0;
  for (const bytes of seen.values()) total += bytes;
  return total;
}
