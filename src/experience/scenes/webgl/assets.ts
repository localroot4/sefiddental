/**
 * Downloads of the phase 8 scenes 4 to 6 for the tier budgets (spec EXP 3.10 `assets`) and the
 * settings each draws under (`draws`). No three.js import here: the registry, which is in the
 * initial JS, reads it.
 */
import type { TierSettings } from '@/lib/qualityTier';

import type { AssetManifest } from '../types';

/** `scripts/molar-glb.mjs` output (prebuild); the unit test keeps `bytes` equal to the file. */
export const MOLAR_GLB = { url: '/brand/3d/molar.glb', bytes: 83_428 } as const;

/** Scenes 4 and 5 share the molar; the browser cache serves the second request. */
export const molarAssets = (): AssetManifest => [MOLAR_GLB];

/** Scene 6 draws the photos the DOM already loaded: no download of its own. */
export const compareAssets = (): AssetManifest => [];

/** Scene 4 draws the 3D molar where the tier settings give it the canvas (else the SVG stays). */
export const molarDraws = (settings: Pick<TierSettings, 'molar'>): boolean =>
  settings.molar === 'canvas';

/** Scene 5 draws on the pinned diagonal only; phones and tier 1 keep the DOM steps. */
export const diagonalDraws = (settings: Pick<TierSettings, 'pinnedScenes'>): boolean =>
  settings.pinnedScenes;

/** Scene 6: the WebGL wipe at tiers 2 and 3 from 1024 px; the DOM clip-path everywhere else. */
export const wipeDraws = (settings: Pick<TierSettings, 'compareWipe'>, wide = true): boolean =>
  settings.compareWipe === 'webgl' && wide;
