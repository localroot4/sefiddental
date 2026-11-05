'use client';

/**
 * Scene 10, the booking stage (storyboard scene 10): the glass mark idles beside the form in its
 * empty slot under the hours (`[data-world-slot="booking-mark"]`, from 1024 px): slow breathing,
 * a gentle sway, one gem circling it; the key light is peach by now (World, `--warm`). The stage
 * is opaque in the server HTML; while the mark draws, `html[data-world-stage]` makes it
 * transparent over the world, which paints the colour that composites to the stage's own
 * warm-soft under the warm layer (globals.css, materials.ts `readPalette`). Tiers 2 and 3.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import type { BufferGeometry, Group, Mesh } from 'three';

import { docRect, followCamera, smoothstep, useMeasured } from '../../world/anchor';
import { MODELS } from '../../world/assets';
import { brandGeometry } from '../../world/brandGeometry';
import { useWorld } from '../../world/context';
import { ShadowCatcher } from '../../world/ShadowCatcher';
import { ANCHOR_DEPTH, rectToCamera, type PxRect } from '../../world/worldMath';
import { once } from '../../engine/once';
import type { SceneProps } from '../types';

const MARK_ASPECT = 223 / 184;
const STAGE_ATTR = 'data-world-stage';
const BREATH_S = 6;
const APPEAR_S = 0.8;

function measure(): PxRect | null {
  const slot = document.querySelector('[data-world-slot="booking-mark"]');
  if (!slot) return null;
  const rect = docRect(slot);
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

export default function BookingScene(props: SceneProps): React.JSX.Element | null {
  const { ref } = props;
  const { materials, motion, fov, world } = useWorld();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const canvas = useThree((state) => state.gl.domElement);
  const slot = useMeasured(measure);
  const root = useRef<Group>(null);
  const mark = useRef<Mesh>(null);
  const gem = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const [models, setModels] = useState<{ mark: BufferGeometry; diamond: BufferGeometry } | null>(
    null,
  );
  const arrived = useRef(-1);
  const lost = useRef(false);

  const release = useMemo(
    () =>
      once(() => {
        document.documentElement.removeAttribute(STAGE_ATTR);
        brandGeometry.release(MODELS.mark);
        brandGeometry.release(MODELS.diamond);
      }),
    [],
  );
  useImperativeHandle(ref, () => ({ dispose: release }), [release]);
  useEffect(() => {
    let live = true;
    Promise.all([brandGeometry.acquire(MODELS.mark), brandGeometry.acquire(MODELS.diamond)]).then(
      ([markGeometry, diamond]) => {
        if (live) setModels({ mark: markGeometry, diamond });
      },
      (error: unknown) => console.error('[world] the booking mark failed to load.', error),
    );
    return () => {
      live = false;
      release();
    };
  }, [release]);

  // A lost context paints nothing: the stage goes opaque again until frames return.
  useEffect(() => {
    const onLost = () => {
      lost.current = true;
      document.documentElement.removeAttribute(STAGE_ATTR);
    };
    const onRestored = () => {
      lost.current = false;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [canvas]);

  useFrame(() => {
    const group = root.current;
    const box = slot.current;
    const html = document.documentElement;
    const shown = group !== null && box !== null && models !== null && !lost.current;
    // Only at full warmth does the world paint the stage's own colour behind the section.
    const stage = shown && motion.warm >= 0.999;
    if (html.hasAttribute(STAGE_ATTR) !== stage) html.toggleAttribute(STAGE_ATTR, stage);
    if (group) group.visible = shown;
    if (!shown || box === null || group === null) return;
    followCamera(group, camera);
    if (arrived.current < 0) arrived.current = motion.time;
    const appear = smoothstep(0, APPEAR_S, motion.time - arrived.current);

    const t = motion.time;
    const breath = Math.sin((t / BREATH_S) * Math.PI * 2);
    const viewport = { width: size.width, height: size.height };
    const top = box.top - window.scrollY;
    const at = rectToCamera(
      { left: box.left, top: top + breath * 5, width: box.width, height: box.height },
      viewport,
      fov,
      ANCHOR_DEPTH,
    );
    const height = box.height * 0.8 * at.unitsPerPx * appear * (1 + breath * 0.015);
    const m = mark.current;
    if (m) {
      m.position.set(at.x, at.y, at.z);
      m.scale.setScalar(height / MARK_ASPECT);
      m.rotation.set(
        -0.06 + motion.wobble * 0.18 + motion.pointerY * 0.08,
        -0.22 + Math.sin(t * 0.45) * 0.12 + motion.pointerX * 0.16,
        Math.sin(t * 0.3) * 0.03 + motion.wobble * 0.05,
      );
    }
    const g = glow.current;
    if (g) {
      g.visible = world.glow;
      g.position.set(at.x, at.y, at.z - 0.4);
      g.scale.setScalar(height * 2);
    }
    const d = gem.current;
    if (d) {
      const a = t * 0.5;
      const r = box.width * 0.48 * at.unitsPerPx;
      d.position.set(
        at.x + Math.cos(a) * r,
        at.y + Math.sin(a) * r * 0.45,
        at.z + Math.sin(a) * 0.3,
      );
      d.scale.setScalar(22 * at.unitsPerPx * appear);
      d.rotation.set(motion.wobble * 0.4, a, 0);
    }
  });

  if (models === null) return null;
  const shadows = world.shadows !== 'none';
  return (
    <group ref={root}>
      <ShadowCatcher
        rect={() => {
          const box = slot.current;
          if (box === null) return null;
          const top = box.top - window.scrollY;
          return {
            left: box.left - 90,
            top: top - 60,
            width: box.width + 180,
            height: box.height + 160,
          };
        }}
      />
      <mesh ref={glow} material={materials.glow} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh
        ref={mark}
        geometry={models.mark}
        material={materials.glass}
        castShadow={shadows}
        renderOrder={3}
      />
      <mesh ref={gem} geometry={models.diamond} material={materials.gem} castShadow={shadows} />
    </group>
  );
}
