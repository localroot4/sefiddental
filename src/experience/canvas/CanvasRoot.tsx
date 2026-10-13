'use client';

/**
 * The one fixed canvas behind the home content (spec EXP 3.9). Imported with a plain `import()`
 * after the gates, so no three.js byte loads before `load`. Portal to `body` (a transformed
 * ancestor would turn `position: fixed` into `absolute`); decorative, `aria-hidden`, no pointer
 * events; `.site` (z-index 1) stacks above this layer (z-index 0).
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Preload } from '@react-three/drei/core/Preload';
import { Canvas, type RootState } from '@react-three/fiber';

import type { TierSettings } from '@/lib/qualityTier';

import { applyStyle } from '../core/applyStyle';
import type { FrameRuntime } from '../core/store';
import type { ScrollEngine } from '../engine/scrollEngine';
import type { StepSource } from '../tier/tierStore';

import { ContextLoss } from './ContextLoss';
import { FrameDriver } from './FrameDriver';
import { MonitorProbe } from './MonitorProbe';
import { StressScene } from './StressScene';
import { ThemeClearColor } from './ThemeClearColor';
import { TierDpr } from './TierDpr';

export interface CanvasRootProps {
  tier: 1 | 2 | 3;
  settings: TierSettings;
  mode: 'auto' | 'fixed';
  engine: ScrollEngine;
  runtime: FrameRuntime;
  stepDown: (source: StepSource) => void;
  /** `?debug=1&stress=N` only; 0 otherwise. */
  stress: number;
}

const LAYER_STYLE = {
  position: 'fixed',
  inset: '0',
  'z-index': '0',
  'pointer-events': 'none',
  contain: 'strict',
} as const;

const styleLayer = (el: HTMLDivElement | null): void => applyStyle(el, LAYER_STYLE);
const hideCanvas = (el: HTMLCanvasElement | null): void => el?.setAttribute('aria-hidden', 'true');

// Pointer parallax reads a window store in phase 8; R3F pointer events stay off.
const CANVAS_STYLE = { pointerEvents: 'none' } as const;
// No scroll listener and no per-scroll layout read: the canvas is fixed to the viewport.
const RESIZE = { scroll: false } as const;
// R3F defaults, stated for TierDpr's movement regression.
const PERFORMANCE = { min: 0.5, max: 1, debounce: 200 } as const;

export function CanvasRoot(props: CanvasRootProps): React.ReactPortal {
  const { tier, settings, mode, engine, runtime, stepDown, stress } = props;
  // Antialias is fixed at context creation; a later tier drop keeps it (tier 1 starts without).
  const [gl] = useState(() => ({
    antialias: tier >= 2,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance' as const,
  }));
  const base = settings.pixelRatio ?? 1;
  const shadows =
    settings.shadows === 'none' ? false : settings.shadows === 'soft' ? 'soft' : 'percentage';

  const onMonitorStep = useCallback(() => stepDown('monitor'), [stepDown]);
  const onRepeatedLoss = useCallback(() => stepDown('context-loss'), [stepDown]);
  const onCreated = useCallback((state: RootState) => runtime.setR3f(state.get), [runtime]);
  useEffect(() => () => runtime.setR3f(null), [runtime]);

  return createPortal(
    <div data-experience-layer="" aria-hidden="true" ref={styleLayer}>
      <Canvas
        ref={hideCanvas}
        frameloop="never"
        dpr={base}
        gl={gl}
        performance={PERFORMANCE}
        shadows={shadows}
        resize={RESIZE}
        style={CANVAS_STYLE}
        onCreated={onCreated}
        fallback={null}
      >
        <TierDpr base={base} />
        <ThemeClearColor />
        <FrameDriver engine={engine} runtime={runtime} />
        {mode === 'auto' && (
          <MonitorProbe key={tier} tier={tier} runtime={runtime} onStepDown={onMonitorStep} />
        )}
        <ContextLoss runtime={runtime} onRepeatedLoss={onRepeatedLoss} />
        <Preload all />
        {/* Phase 8: one scene slot per registry entry with `webgl.load` (scenes/lifecycle.ts). */}
        {stress > 0 && <StressScene loops={stress} />}
      </Canvas>
    </div>,
    document.body,
  );
}
