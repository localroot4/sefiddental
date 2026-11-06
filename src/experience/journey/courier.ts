/**
 * The WebGL courier's place in the scene contract (docs/experience/journey.md sections 5 and 6):
 * the tier it draws from and its downloads for the tier budgets. No three.js here: the registry,
 * which is in the initial JS, reads it.
 */
import { MOLAR_GLB } from '../scenes/webgl/assets';
import type { AssetManifest } from '../scenes/types';
import { modelManifest } from '../world/assets';

export const COURIER = {
  /** Tier 1 keeps the DOM courier: no three.js on a tier 1 device. */
  minTier: 2,
  /** The mark (Draco, with the same-origin decoder) and the pre-decoded molar. */
  assets: (): AssetManifest => [...modelManifest('mark'), MOLAR_GLB],
} as const;
