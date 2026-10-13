'use client';

/**
 * WebGL context loss (spec EXP 3.9; docs/prompts/08-webgl-experience.md). three's renderer
 * already prevents the default on `webglcontextlost` and rebuilds on restore; this closes the
 * gate while the context is lost and drops to tier 0 on the second loss in one visit.
 */
import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';

import type { FrameRuntime } from '../core/store';

export const MAX_CONTEXT_LOSSES = 2;

export function ContextLoss(props: { runtime: FrameRuntime; onRepeatedLoss: () => void }): null {
  const canvas = useThree((state) => state.gl.domElement);
  const { runtime, onRepeatedLoss } = props;

  useEffect(() => {
    const onLost = () => {
      const losses = runtime.setContextLost(true);
      if (losses >= MAX_CONTEXT_LOSSES) onRepeatedLoss();
    };
    const onRestored = () => {
      runtime.setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      runtime.setContextLost(false);
    };
  }, [canvas, runtime, onRepeatedLoss]);

  return null;
}
