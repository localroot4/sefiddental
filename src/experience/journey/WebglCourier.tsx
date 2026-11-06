'use client';

/**
 * The WebGL courier at tiers 2 and 3 (docs/experience/journey.md section 5): one persistent
 * object of the World, not a scene slot. Each frame it reads the pose the journey driver computes
 * for the current scroll position and draws, after the World's own render (R3F `addAfterEffect`),
 * two scissored passes: the arch into the smile box while the smile station shows it, and the
 * courier into a square box around the pose. The first frame it draws tells the driver, which
 * hides the DOM courier at the same pose; a lost context, a lower tier or the unmount hand it
 * back. The restoration chips drive the tooth's level at D3 and the hold's progress the workflow
 * beats at D4, as the phase 8 rigs did on their own slots.
 */
import { useEffect, useMemo, useState } from 'react';

import { addAfterEffect, useThree } from '@react-three/fiber';
import type { BufferGeometry, Camera, Scene, WebGLRenderer } from 'three';

import { MODELS } from '../world/assets';
import { brandGeometry } from '../world/brandGeometry';
import { useMolar, useRigLifetime } from '../scenes/webgl/hooks';
import { damp, levelFromChoice, passViewport, ramp, turntableYaw } from '../scenes/webgl/math';

import { workflowBeats } from './beats';
import { COURIER } from './courier';
import { BOX_GROW, createCourierRig, type CourierRig } from './courierRig';
import type { Journey } from './driver';
import { archFrame, idleAmount, viewportTop } from './pose';

/** The WebGL courier draws from this tier; tier 1 keeps the DOM courier. */
export const WEBGL_COURIER_TIER = COURIER.minTier;
/** Seconds: a level change reads as one turn, close to the SVG crossfade (--dur-4). */
const LEVEL_TAU = 0.3;

function drawPass(
  gl: WebGLRenderer,
  size: { width: number; height: number },
  rect: { left: number; top: number; width: number; height: number },
  scene: Scene,
  camera: Camera,
): boolean {
  const view = passViewport(rect, size);
  if (view === null) return false;
  const autoClear = gl.autoClear;
  gl.autoClear = false;
  gl.setViewport(view.x, view.y, view.width, view.height);
  gl.setScissor(view.scissor.x, view.scissor.y, view.scissor.width, view.scissor.height);
  gl.setScissorTest(true);
  gl.clearDepth();
  gl.render(scene, camera);
  gl.setScissorTest(false);
  gl.setViewport(0, 0, size.width, size.height);
  gl.autoClear = autoClear;
  return true;
}

export function WebglCourier(props: {
  journey: Journey | null;
  tier: 1 | 2 | 3;
  particles: number;
}): null {
  const { journey, tier, particles } = props;
  const get = useThree((state) => state.get);
  const molar = useMolar();
  const [mark, setMark] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let live = true;
    brandGeometry.acquire(MODELS.mark).then(
      (geometry) => {
        if (live) setMark(geometry);
      },
      // A load the unmount cut short (a navigation away) is not an error.
      (error: unknown) => {
        if (live) console.error('[journey] mark.glb failed to load; the DOM courier stays.', error);
      },
    );
    return () => {
      live = false;
      brandGeometry.release(MODELS.mark);
    };
  }, []);
  const rig = useMemo<CourierRig | null>(
    () => (molar && mark ? createCourierRig({ mark, molar }, { particles }) : null),
    [molar, mark, particles],
  );
  // The theme now and on every change; disposes the rig when it goes.
  useRigLifetime(rig);

  useEffect(() => {
    if (journey === null || rig === null || tier < WEBGL_COURIER_TIER) {
      journey?.setWebgl(false);
      return;
    }
    const canvas = get().gl.domElement;
    let lost = false;
    let last = -1;
    let level = 0;
    const onLost = (): void => {
      lost = true;
      journey.setWebgl(false);
    };
    const onRestored = (): void => {
      lost = false;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    const choices = document.querySelector('[data-scene="restoration"] [data-choices]');

    const off = addAfterEffect((time) => {
      if (lost) return;
      const { gl, size } = get();
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      const pose = journey.pose();
      const scrollY = window.scrollY;

      const smile = journey.docks().find((d) => d.id === 'smile');
      if (smile && pose.dock === 'smile' && pose.arch > 0 && pose.smile < 1) {
        const frame = archFrame(smile, scrollY, pose.local);
        const top = viewportTop(smile, scrollY);
        rig.updateArch({
          width: smile.width,
          height: smile.height,
          archWidth: frame.width,
          // It appears out of the dissolve and leaves into it, as the smile photo comes in.
          dissolve: Math.max(1 - pose.arch, pose.smile),
        });
        drawPass(
          gl,
          size,
          { left: smile.left, top, width: smile.width, height: smile.height },
          rig.arch.scene,
          rig.arch.camera,
        );
      }

      if (!pose.hidden) {
        const atRestoration = pose.dock === 'restoration';
        const target = atRestoration
          ? levelFromChoice(choices?.getAttribute('data-choice') ?? null)
          : 0;
        level = damp(level, target, dt, LEVEL_TAU);
        const settle = atRestoration
          ? ramp(pose.local, 0, 0.12) * (1 - ramp(pose.local, 0.88, 1))
          : 0;
        const side = pose.scale * BOX_GROW;
        rig.update({
          pose,
          time,
          level: Math.round(level * 1000) / 1000,
          turn: settle * turntableYaw(level, pose.local, time),
          beats: workflowBeats(pose.dock === 'workflow' ? pose.local : null),
          idle: idleAmount(pose),
          pixels: pose.scale * gl.getPixelRatio(),
        });
        drawPass(
          gl,
          size,
          { left: pose.x - side / 2, top: pose.y - side / 2, width: side, height: side },
          rig.scene,
          rig.camera,
        );
      }
      journey.setWebgl(true);
    });
    return () => {
      off();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      journey.setWebgl(false);
    };
  }, [journey, rig, tier, get]);

  return null;
}
