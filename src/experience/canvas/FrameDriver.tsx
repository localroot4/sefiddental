'use client';

/**
 * One clock (spec EXP 3.9): the canvas uses frameloop="never" and renders only from the scroll
 * engine's gsap tick, and only while the gate is open. No frame renders while a
 * `[data-experience-cover]` (the hero photo) covers the viewport, the tab is hidden or the
 * context is lost. The driver follows the tick only while something moves: a scroll, a resize,
 * an input, a restored context or a frame asked for (pulse.ts) wakes it, and after a run of ticks
 * in which the World had nothing to render it lets go, so a page at rest keeps no frame loop.
 */
import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { gateState, type Gate } from '../core/gates';
import type { FrameRuntime } from '../core/store';
import type { ScrollEngine } from '../engine/scrollEngine';

import type { Pulse } from './pulse';

/** Ticks without a render before the driver lets the ticker go. */
const IDLE_TICKS = 30;
/** Inputs that may change what a scene draws without a scroll (a chip, the compare handle). */
const INPUTS = ['pointerdown', 'pointermove', 'keydown', 'input', 'change'] as const;

export function FrameDriver(props: {
  engine: ScrollEngine;
  runtime: FrameRuntime;
  pulse: Pulse;
}): null {
  const advance = useThree((state) => state.advance);
  const canvas = useThree((state) => state.gl.domElement);
  const { engine, runtime, pulse } = props;

  useEffect(() => {
    let previous: Gate = 'not-mounted';
    let off: (() => void) | null = null;
    let idle = 0;
    const tick = (timeSec: number): void => {
      const gate = gateState({
        mounted: true,
        covered: engine.covered(),
        visible: document.visibilityState === 'visible',
        contextLost: runtime.contextLost,
      });
      runtime.setGate(gate);
      const reopened = gate === 'open' && previous !== 'open';
      previous = gate;
      if (gate === 'open') {
        if (reopened) runtime.markResume();
        // Seconds, like R3F's own loop: useFrame deltas stay in seconds (frameloop="never").
        advance(timeSec, true);
        runtime.countFrame();
      }
      idle = gate === 'open' && pulse.rendered() ? 0 : idle + 1;
      if (idle >= IDLE_TICKS) {
        off?.();
        off = null;
      }
    };
    const wake = (): void => {
      idle = 0;
      if (off !== null) return;
      // A gap in the frames is not a slow frame: the monitor starts a new window.
      runtime.markResume();
      off = engine.onTick(tick);
    };
    const offWake = pulse.onWake(wake);
    wake();
    const scroll = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: wake });
    window.addEventListener('resize', wake);
    canvas.addEventListener('webglcontextrestored', wake);
    canvas.addEventListener('webglcontextlost', wake);
    for (const type of INPUTS) document.addEventListener(type, wake, { passive: true });
    return () => {
      off?.();
      off = null;
      offWake();
      scroll.kill();
      window.removeEventListener('resize', wake);
      canvas.removeEventListener('webglcontextrestored', wake);
      canvas.removeEventListener('webglcontextlost', wake);
      for (const type of INPUTS) document.removeEventListener(type, wake);
      runtime.setGate('not-mounted');
    };
  }, [engine, runtime, pulse, advance, canvas]);

  return null;
}
