'use client';

/**
 * One clock (spec EXP 3.9): the canvas uses frameloop="never" and renders only from the scroll
 * engine's gsap tick, and only while the gate is open. No frame renders while a
 * `[data-experience-cover]` (the hero photo) covers the viewport, the tab is hidden or the
 * context is lost.
 */
import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';

import { gateState, type Gate } from '../core/gates';
import type { FrameRuntime } from '../core/store';
import type { ScrollEngine } from '../engine/scrollEngine';

export function FrameDriver(props: { engine: ScrollEngine; runtime: FrameRuntime }): null {
  const advance = useThree((state) => state.advance);
  const { engine, runtime } = props;

  useEffect(() => {
    let previous: Gate = 'not-mounted';
    const off = engine.onTick((timeSec) => {
      const gate = gateState({
        mounted: true,
        covered: engine.covered(),
        visible: document.visibilityState === 'visible',
        contextLost: runtime.contextLost,
      });
      runtime.setGate(gate);
      const reopened = gate === 'open' && previous !== 'open';
      previous = gate;
      if (gate !== 'open') return;
      if (reopened) runtime.markResume();
      // Seconds, like R3F's own loop: useFrame deltas stay in seconds (frameloop="never").
      advance(timeSec, true);
      runtime.countFrame();
    });
    return () => {
      off();
      runtime.setGate('not-mounted');
    };
  }, [engine, runtime, advance]);

  return null;
}
