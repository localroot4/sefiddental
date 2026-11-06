/**
 * What the World shares with its scene slots (the compare wipe): the master clock, the tier and
 * the count of slots mounted now.
 */
import { createContext, useContext } from 'react';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../engine/scrollEngine';

export interface WorldApi {
  engine: ScrollEngine;
  tier: 1 | 2 | 3;
  settings: TierSettings;
  /** Scene slots mounted now. */
  drawingRef: { current: number };
}

export const WorldContext = createContext<WorldApi | null>(null);

export function useWorld(): WorldApi {
  const api = useContext(WorldContext);
  if (api === null) throw new Error('[world] a scene rendered outside <World>.');
  return api;
}
