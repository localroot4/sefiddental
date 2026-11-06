/**
 * Downloads for the tier budgets (spec EXP 3.10 `assets`): the molar the courier carries
 * (journey/courier.ts) and the compare wipe's, with the settings the wipe draws under (`draws`).
 * No three.js import here: the registry, which is in the initial JS, reads it.
 */
import type { TierSettings } from '@/lib/qualityTier';

import type { AssetManifest } from '../types';

/** `scripts/molar-glb.mjs` output (prebuild); the unit test keeps `bytes` equal to the file. */
export const MOLAR_GLB = { url: '/brand/3d/molar.glb', bytes: 83_428 } as const;

/** Scene 6 draws the photos the DOM already loaded: no download of its own. */
export const compareAssets = (): AssetManifest => [];

/** Scene 6: the WebGL wipe at tiers 2 and 3 from 1024 px; the DOM clip-path everywhere else. */
export const wipeDraws = (settings: Pick<TierSettings, 'compareWipe'>, wide = true): boolean =>
  settings.compareWipe === 'webgl' && wide;
