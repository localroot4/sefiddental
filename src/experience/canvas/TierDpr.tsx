'use client';

/**
 * DPR per tier with movement regression (spec EXP 3.9, conflict C3). Replaces drei's
 * AdaptiveDpr, which scales R3F's `initialDpr` (set once) and would restore the first tier's DPR
 * after a step-down. `base` is also the Canvas `dpr` prop, which R3F re-applies on every render.
 */
import { useEffect } from 'react';

import { useThree } from '@react-three/fiber';

export function TierDpr(props: { base: number }): null {
  const current = useThree((state) => state.performance.current);
  const setDpr = useThree((state) => state.setDpr);
  useEffect(() => {
    setDpr(props.base * current);
  }, [props.base, current, setDpr]);
  return null;
}
