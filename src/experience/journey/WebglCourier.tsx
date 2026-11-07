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

import { addAfterEffect, addEffect, useThree } from '@react-three/fiber';
import {
  PMREMGenerator,
  type BufferGeometry,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import type { Pulse } from '../canvas/pulse';
import { MODELS } from '../world/assets';
import { brandGeometry } from '../world/brandGeometry';
import { pageLeaving, useMolar, useRigLifetime } from '../scenes/webgl/hooks';
import { damp, levelFromChoice, passViewport, ramp } from '../scenes/webgl/math';

import { workflowBeats } from './beats';
import { COURIER } from './courier';
import { BOX_GROW, createCourierRig, type CourierRig } from './courierRig';
import type { Journey } from './driver';
import { archFrame, idleAmount, smoothstep, viewportTop } from './pose';
/** Seconds of idle float and turn at a dock after the last move (then the canvas sleeps). */
const IDLE_S = 12;

/** The WebGL courier draws from this tier; tier 1 keeps the DOM courier. */
export const WEBGL_COURIER_TIER = COURIER.minTier;
/** Seconds: a level change eases in about 0.55 s, damped, never overshooting. */
const LEVEL_TAU = 0.18;

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
  pulse: Pulse;
}): null {
  const { journey, tier, particles, pulse } = props;
  const get = useThree((state) => state.get);
  const molar = useMolar();
  const [mark, setMark] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let live = true;
    brandGeometry.acquire(MODELS.mark).then(
      (geometry) => {
        if (live) setMark(geometry);
      },
      // A load the unmount or a navigation away cut short is not an error.
      (error: unknown) => {
        if (live && !pageLeaving())
          console.error('[journey] mark.glb failed to load; the DOM courier stays.', error);
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

  // The studio environment: a room PMREM built once from the renderer (no file), for real
  // reflections in the glaze and the enamel; freed with the rig.
  useEffect(() => {
    if (rig === null) return;
    const { gl } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    rig.setEnvironment(env);
    return () => {
      rig.setEnvironment(null);
      env.dispose();
    };
  }, [rig, get]);

  useEffect(() => {
    if (journey === null || rig === null || tier < WEBGL_COURIER_TIER) {
      journey?.setWebgl(false);
      return;
    }
    const canvas = get().gl.domElement;
    let lost = false;
    let shown = false;
    let last = -1;
    let level = 0;
    const onLost = (): void => {
      lost = true;
      shown = false;
      journey.setWebgl(false);
    };
    const onRestored = (): void => {
      lost = false;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    const choices = document.querySelector('[data-scene="restoration"] [data-choices]');
    const target = (dock: string | null): number =>
      dock === 'restoration' ? levelFromChoice(choices?.getAttribute('data-choice') ?? null) : 0;

    // Before the World decides: a frame only when what the courier shows changed (the pose, the
    // level easing to a chip, the canvas still fading in), and the idle float and turn at a dock
    // for IDLE_S after the last move, easing out to the rest pose: then the canvas keeps its last
    // frame and the ticker sleeps.
    let signature = '';
    let quietSince = performance.now();
    const idleEnvelope = (): number => {
      const quiet = (performance.now() - quietSince) / 1000;
      return 1 - smoothstep(Math.min(1, Math.max(0, (quiet - IDLE_S + 3) / 3)));
    };
    const offAsk = addEffect(() => {
      const p = journey.pose();
      const sh = journey.shown();
      const next = [
        sh.x,
        sh.y,
        sh.scale,
        sh.tilt,
        sh.sx,
        p.x,
        p.y,
        p.scale,
        p.rotation,
        p.arch,
        p.smile,
        p.opacity,
        p.local,
        p.presence,
      ]
        .map((v) => v.toFixed(2))
        .concat(p.form, String(p.hidden), String(target(p.dock)))
        .join('|');
      if (next !== signature || Math.abs(level - target(p.dock)) > 0.001 || !shown) {
        if (next !== signature) quietSince = performance.now();
        signature = next;
        pulse.request();
      } else if (p.dock !== null && idleAmount(p) > 0 && idleEnvelope() > 0) {
        pulse.request();
      }
    });

    const off = addAfterEffect((time) => {
      if (lost || !pulse.rendered()) return;
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
          offsetX: frame.cx - (smile.left + smile.width / 2),
          offsetY: frame.cy - (top + smile.height / 2),
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

      if (!pose.hidden && pose.opacity > 0.005 && pose.presence > 0.005) {
        const atRestoration = pose.dock === 'restoration';
        level = damp(level, target(pose.dock), dt, LEVEL_TAU);
        const settle = atRestoration
          ? ramp(pose.local, 0, 0.12) * (1 - ramp(pose.local, 0.88, 1))
          : 0;
        // The shown place: the pose with its spring, lean and squash (motion.ts).
        const shown = journey.shown();
        const side = shown.scale * BOX_GROW;
        rig.update({
          pose,
          lean: shown.tilt,
          stretch: [shown.sx, shown.sy],
          time: performance.now() / 1000,
          level: Math.round(level * 1000) / 1000,
          // D3: no turn between the levels (the owner: «one left, one right»); the tooth eases
          // into a three-quarter top view, its chewing surface the subject of the shot.
          turn: 0,
          view: settle,
          beats: workflowBeats(pose.dock === 'workflow' ? pose.local : null),
          idle: pose.dock !== null ? idleAmount(pose) * idleEnvelope() : 0,
          pixels: pose.scale * gl.getPixelRatio(),
        });
        drawPass(
          gl,
          size,
          { left: shown.x - side / 2, top: shown.y - side / 2, width: side, height: side },
          rig.scene,
          rig.camera,
        );
      }
      // The DOM courier stays until the canvas has faded in (the World reveals it on its first
      // frame, and hides it at once on a theme switch), so the handover never blinks: the
      // computed opacity is read only until then.
      const visible =
        canvas.style.opacity === '1' &&
        (shown || parseFloat(getComputedStyle(canvas).opacity) >= 0.99);
      if (visible !== shown) {
        shown = visible;
        journey.setWebgl(visible);
      }
    });
    return () => {
      off();
      offAsk();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      journey.setWebgl(false);
    };
  }, [journey, rig, tier, get, pulse]);

  return null;
}
