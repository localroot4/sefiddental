'use client';

/**
 * The porcelain wall the objects cast their soft shadows on, only under the box a scene draws in
 * (in its camera-space group): a full-screen catcher ran the PCF lookup on every pixel of the
 * viewport. The rect is in viewport px, read per frame; null hides it.
 */
import { useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh } from 'three';

import { useWorld } from './context';
import { CATCHER_DEPTH, rectToCamera, type PxRect } from './worldMath';

export function ShadowCatcher(props: { rect: () => PxRect | null }): React.JSX.Element | null {
  const { rect } = props;
  const { materials, fov, world } = useWorld();
  const size = useThree((state) => state.size);
  const mesh = useRef<Mesh>(null);

  useFrame(() => {
    const m = mesh.current;
    if (m === null) return;
    const r = rect();
    m.visible = r !== null && r.width > 0 && r.height > 0;
    if (r === null || !m.visible) return;
    const at = rectToCamera(r, size, fov, CATCHER_DEPTH);
    m.position.set(at.x, at.y, at.z);
    m.scale.set(r.width * at.unitsPerPx, r.height * at.unitsPerPx, 1);
  });

  if (world.shadows === 'none') return null;
  return (
    <mesh ref={mesh} material={materials.shadow} receiveShadow>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
