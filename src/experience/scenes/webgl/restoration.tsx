'use client';

/**
 * Scene 4 in WebGL (storyboard scene 4): the stylized molar on a turntable, drawn into the molar
 * slot of RestorationSection where the tier settings give the molar the canvas (tiers 2 and 3,
 * and tier 1 from 1024 px); elsewhere the SVG stepper stays. The chips stay the source of truth:
 * the level is the group's `data-choice` (choices.ts), which the pinned scrub and a tap both move,
 * and the molar eases to it (a third of a turn per level, VIP refines the form and the gloss, CIP
 * fades in the colour characterization). The scroll progress adds a slow turn inside the pin.
 */
import { useCallback, useImperativeHandle, useMemo, useRef } from 'react';

import { useThree } from '@react-three/fiber';

import type { SceneProps } from '../types';

import { useMolar, useRigLifetime, useRoomEnvironment } from './hooks';
import { damp, levelFromChoice, molarDraws } from './math';
import { useSlotPass, type PassDraw } from './pass';
import { createMolarRig } from './restorationRig';

const SLOT = '[data-scene="restoration"] [data-world-slot="molar"]';
/** Seconds: the level change reads as one turn, close to the SVG crossfade (--dur-4). */
const LEVEL_TAU = 0.3;
const BOX_GROW = 1.3;

export default function RestorationScene(props: SceneProps): null {
  const { tier, settings, progress, ref } = props;
  const gl = useThree((state) => state.gl);
  const geometry = useMolar();
  const rig = useMemo(
    () => (geometry ? createMolarRig(geometry, { tier }) : null),
    [geometry, tier],
  );

  useRigLifetime(rig);
  useImperativeHandle(ref, () => ({ dispose: () => void rig?.dispose() }), [rig]);
  useRoomEnvironment(gl, rig !== null && tier >= 2 ? rig : null);

  const wide = useMemo(() => window.matchMedia('(min-width: 1024px)'), []);
  const level = useRef<number | null>(null);
  const draw = useCallback<PassDraw>(
    ({ slot, rect, dt, time }) => {
      if (rig === null || !molarDraws(settings)) return null;
      const choice = slot.closest('[data-choices]')?.getAttribute('data-choice') ?? null;
      const target = levelFromChoice(choice);
      level.current = level.current === null ? target : damp(level.current, target, dt, LEVEL_TAU);
      rig.update({
        level: level.current,
        progress: progress(),
        time,
        aspect: rect.width / rect.height,
      });
      // From 1024 px the molar may outgrow its slot into the gutters around it (transparent
      // pixels; the tooth itself stays clear of the chips and the heading).
      if (!wide.matches) return rig;
      const grow = (BOX_GROW - 1) / 2;
      const box = new DOMRect(
        rect.x - rect.width * grow,
        rect.y - rect.height * grow,
        rect.width * BOX_GROW,
        rect.height * BOX_GROW,
      );
      return { scene: rig.scene, camera: rig.camera, box };
    },
    [rig, settings, progress, wide],
  );
  useSlotPass(SLOT, draw);
  return null;
}
