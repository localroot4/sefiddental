'use client';

/**
 * Scene 5 in WebGL (storyboard scene 5): the scan, design, make and smile beats on one molar in
 * the pinned diagonal stage (tiers 2 and 3 from 1024 px, where `html[data-pins]` makes the stage
 * diagonal). The photos and the text stay DOM; the tooth sits in the stage's free corner beside
 * the centred step. Phones and tier 1 keep the DOM steps (the vertical list with its line).
 *
 * The beats follow the stage's own pin progress (its room, pinRoom.ts), the range the DOM path
 * pans over, so a beat and its step arrive together; `progress()` spans the whole section with
 * its heading and would run ahead.
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { useThree } from '@react-three/fiber';

import type { SceneProps } from '../types';

import { useMolar, useRigLifetime, useRoomEnvironment } from './hooks';
import { pinProgress, workflowDraws } from './math';
import { token, useSlotPass, type PassDraw } from './pass';
import { createWorkflowRig } from './workflowRig';

const SLOT = '[data-scene="workflow"] [data-world-slot="workflow"]';
const STEP = '[data-workflow-step]';

export default function WorkflowScene(props: SceneProps): null {
  const { tier, settings, ref } = props;
  const gl = useThree((state) => state.gl);
  const geometry = useMolar();
  const particles = settings.scene5Particles;
  const rig = useMemo(
    () =>
      geometry
        ? createWorkflowRig(geometry, { particles, rtl: document.documentElement.dir !== 'ltr' })
        : null,
    [geometry, particles],
  );

  useRigLifetime(rig);
  useImperativeHandle(ref, () => ({ dispose: () => void rig?.dispose() }), [rig]);
  useRoomEnvironment(gl, rig);

  // The nav height token, read again on resize (not per frame: it is a computed style).
  const nav = useRef(0);
  useEffect(() => {
    const read = (): void => {
      nav.current = parseFloat(token('--nav-h')) || 0;
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const draw = useCallback<PassDraw>(
    ({ gl: renderer, slot, rect, time }) => {
      if (rig === null) return null;
      if (!workflowDraws(tier, document.documentElement.hasAttribute('data-pins'))) return null;
      const room = slot.parentElement?.nextElementSibling;
      if (!(room instanceof HTMLElement) || !room.hasAttribute('data-pin-room')) return null;
      const roomRect = room.getBoundingClientRect();
      const step = slot.parentElement?.querySelector<HTMLElement>(STEP);
      rig.update({
        p: pinProgress(roomRect.top, nav.current, rect.height, roomRect.height),
        time,
        w: rect.width,
        h: rect.height,
        card: step?.offsetWidth ?? rect.width * 0.4,
        pixelRatio: renderer.getPixelRatio(),
      });
      return rig;
    },
    [rig, tier],
  );
  useSlotPass(SLOT, draw);
  return null;
}
