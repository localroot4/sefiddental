'use client';

/**
 * Feeds rendered frame deltas to the frame monitor (spec EXP 3.7). Mounted only in auto mode and
 * keyed by tier, so every tier change starts a fresh monitor with its own warm-up. Every gate
 * reopening (cover left, context restored, first frame) and the tab becoming visible restart the
 * warm-up, so a pause never counts as a slow frame. Never sets React state per frame.
 */
import { useEffect, useRef, useState } from 'react';

import { useFrame } from '@react-three/fiber';

import type { Tier } from '@/lib/qualityTier';

import type { FrameRuntime } from '../core/store';
import { createFrameMonitor } from '../tier/frameMonitor';

export function MonitorProbe(props: {
  tier: Tier;
  runtime: FrameRuntime;
  onStepDown: () => void;
}): null {
  const { onStepDown, runtime } = props;
  const [monitor] = useState(() =>
    createFrameMonitor({ tier: props.tier, mode: 'auto', onStepDown: () => onStepDown() }),
  );
  const seenResumes = useRef(-1);

  // rAF stops in a background tab, so the gate never reads 'hidden'; reset on return instead.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') monitor.reset(performance.now());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [monitor]);

  useFrame((_, delta) => {
    const now = performance.now();
    if (seenResumes.current !== runtime.resumes) {
      seenResumes.current = runtime.resumes;
      monitor.reset(now);
      return;
    }
    monitor.push(delta, now);
  });

  return null;
}
