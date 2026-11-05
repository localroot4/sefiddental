/**
 * What the World shares with its scenes: the master clock, the materials, the theme and the
 * per-frame motion. `motion` is a plain mutable object written once per frame by the World
 * (never React state); `palette` changes only with the theme.
 */
import { createContext, useContext } from 'react';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../engine/scrollEngine';

import type { Palette, WorldMaterials } from './materials';
import type { WorldSettings } from './worldMath';

export interface WorldMotion {
  /** Seconds of world time (paused with the frames). */
  time: number;
  /** -1..1, the clamped and eased scroll velocity (down is positive). */
  wobble: number;
  /** Accumulated dust lift (world units). */
  lift: number;
  /** -1..1 from the viewport centre, eased; 0 without a fine pointer. */
  pointerX: number;
  pointerY: number;
  /** 0..1, scene 9's `--warm` as the DOM warm layer holds it. */
  warm: number;
}

export interface WorldApi {
  engine: ScrollEngine;
  tier: 1 | 2 | 3;
  settings: TierSettings;
  world: WorldSettings;
  materials: WorldMaterials;
  palette: Palette;
  motion: WorldMotion;
  /** Vertical field of view of the world camera (degrees). */
  fov: number;
  /** Scene slots mounted now. */
  drawingRef: { current: number };
  /**
   * A mounted scene that draws nothing this frame (no text-free box on this layout) adds 1; the
   * World resets it after the frame. Without `drawsIdle` the World renders only while mounted
   * scenes outnumber the empty ones: a scene that never reports counts as drawing.
   */
  emptyRef: { current: number };
}

export const WorldContext = createContext<WorldApi | null>(null);

export function useWorld(): WorldApi {
  const api = useContext(WorldContext);
  if (api === null) throw new Error('[world] a scene rendered outside <World>.');
  return api;
}
