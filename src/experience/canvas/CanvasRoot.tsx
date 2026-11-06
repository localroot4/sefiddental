'use client';

/**
 * The one fixed canvas behind the home content (spec EXP 3.9). Imported with a plain `import()`
 * after the gates, so no three.js byte loads before `load`. Transparent (the journey,
 * docs/experience/journey.md): it draws the courier over the page's own surfaces. It renders
 * inside the experience root, under every section of `.site` (z-index -1, after the warm layer
 * and the journey layer in tree order), with no transformed, filtered or contained ancestor up
 * to `.site` (WarmLayer.tsx has the same rule, which `position: fixed` needs); decorative,
 * `aria-hidden`, no pointer events.
 */
import { useCallback, useEffect, useState } from 'react';

import { Preload } from '@react-three/drei/core/Preload';
import { Canvas, type RootState } from '@react-three/fiber';

import type { TierSettings } from '@/lib/qualityTier';

import { applyStyle } from '../core/applyStyle';
import type { FrameRuntime } from '../core/store';
import type { ScrollEngine } from '../engine/scrollEngine';
import type { Journey } from '../journey/driver';
import type { StepSource } from '../tier/tierStore';
import { World } from '../world/World';

import { ContextLoss } from './ContextLoss';
import { FrameDriver } from './FrameDriver';
import { MonitorProbe } from './MonitorProbe';
import { StressScene } from './StressScene';
import { TierDpr } from './TierDpr';

export interface CanvasRootProps {
  tier: 1 | 2 | 3;
  settings: TierSettings;
  mode: 'auto' | 'fixed';
  /** A phone: the canvas monitor follows the phone rules (D26). */
  phone: boolean;
  engine: ScrollEngine;
  runtime: FrameRuntime;
  stepDown: (source: StepSource) => void;
  /** `?debug=1&stress=N` only; 0 otherwise. */
  stress: number;
  /** The journey driver the courier reads its pose from (null until it runs). */
  journey: Journey | null;
}

const LAYER_STYLE = {
  position: 'fixed',
  inset: '0',
  'z-index': '-1',
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

export function CanvasRoot(props: CanvasRootProps): React.JSX.Element {
  const { tier, settings, mode, phone, engine, runtime, stepDown, stress, journey } = props;
  // Antialias is fixed at context creation; a later tier drop keeps it (tier 1 starts without).
  const [gl] = useState(() => ({
    antialias: tier >= 2,
    alpha: true,
    stencil: false,
    powerPreference: 'high-performance' as const,
  }));
  const base = settings.pixelRatio ?? 1;

  const onMonitorStep = useCallback(() => stepDown('monitor'), [stepDown]);
  const onRepeatedLoss = useCallback(() => stepDown('context-loss'), [stepDown]);
  const onCreated = useCallback((state: RootState) => runtime.setR3f(state.get), [runtime]);
  useEffect(() => () => runtime.setR3f(null), [runtime]);

  return (
    <div data-experience-layer="" aria-hidden="true" ref={styleLayer}>
      <Canvas
        ref={hideCanvas}
        frameloop="never"
        dpr={base}
        gl={gl}
        performance={PERFORMANCE}
        shadows={false}
        resize={RESIZE}
        style={CANVAS_STYLE}
        onCreated={onCreated}
        fallback={null}
      >
        <TierDpr base={base} />
        <FrameDriver engine={engine} runtime={runtime} />
        {mode === 'auto' && (
          <MonitorProbe
            key={tier}
            tier={tier}
            phone={phone}
            runtime={runtime}
            onStepDown={onMonitorStep}
          />
        )}
        <ContextLoss runtime={runtime} onRepeatedLoss={onRepeatedLoss} />
        <Preload all />
        {/* The world and its scene slots (scenes/lifecycle.ts); the stress quad replaces it. */}
        {stress > 0 ? (
          <StressScene loops={stress} />
        ) : (
          <World tier={tier} settings={settings} engine={engine} journey={journey} />
        )}
      </Canvas>
    </div>
  );
}
