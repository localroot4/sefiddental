/**
 * Downloads of the phase 8 scenes 4 to 6 for the tier budgets (spec EXP 3.10 `assets`). No three.js
 * import here: the registry, which is in the initial JS, reads it.
 */
import type { AssetManifest } from '../types';

/** `scripts/molar-glb.mjs` output (prebuild); the unit test keeps `bytes` equal to the file. */
export const MOLAR_GLB = { url: '/brand/3d/molar.glb', bytes: 83_428 } as const;

/** Scenes 4 and 5 share the molar; the browser cache serves the second request. */
export const molarAssets = (): AssetManifest => [MOLAR_GLB];

/** Scene 6 draws the photos the DOM already loaded: no download of its own. */
export const compareAssets = (): AssetManifest => [];
