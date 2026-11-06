'use client';

/**
 * The World (phase 8, reduced by the journey, docs/experience/journey.md): the one render call
 * per frame of the transparent canvas (priority 1, so R3F does not render on its own), the
 * courier that travels the whole page (journey/WebglCourier.tsx) and the slots of the scenes that
 * still draw into a DOM box (the compare wipe). No dust, gems, reliefs, grain or world background:
 * the page's own surfaces show through, and the layer under the text paints the bands. The canvas
 * fades in on its first frame and hides at once on a theme switch until a frame in the new theme
 * is drawn, so the old theme never flashes.
 */
import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../engine/scrollEngine';
import { COURIER } from '../journey/courier';
import type { Journey } from '../journey/driver';
import { WebglCourier } from '../journey/WebglCourier';

import { WorldContext, type WorldApi } from './context';
import { SceneSlots } from './SceneSlots';

export function World(props: {
  tier: 1 | 2 | 3;
  settings: TierSettings;
  engine: ScrollEngine;
  journey: Journey | null;
}): React.JSX.Element {
  const { tier, settings, engine, journey } = props;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const revealed = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.setProperty('opacity', '0');
    const hide = () => {
      canvas.style.setProperty('transition', 'none');
      canvas.style.setProperty('opacity', '0');
      revealed.current = false;
    };
    const observer = new MutationObserver(hide);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', hide);
    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', hide);
      canvas.style.removeProperty('opacity');
      canvas.style.removeProperty('transition');
    };
  }, [gl]);

  // Transparent clear: the courier's passes draw over the page's own surfaces.
  useEffect(() => {
    gl.setClearColor(0x000000, 0);
  }, [gl]);

  // Every advanced frame renders (the FrameDriver gates them), so a resize, a DPR change or a
  // restored context is drawn again on the next tick.
  useFrame(() => {
    gl.render(scene, camera);
    if (!revealed.current) {
      revealed.current = true;
      gl.domElement.style.setProperty('transition', 'opacity var(--dur-3) var(--ease-out)');
      gl.domElement.style.setProperty('opacity', '1');
    }
  }, 1);

  const drawingRef = useRef(0);
  const api = useMemo<WorldApi>(
    () => ({ engine, tier, settings, drawingRef }),
    [engine, tier, settings],
  );

  return (
    <WorldContext.Provider value={api}>
      <SceneSlots />
      {/* Tier 1 keeps the DOM courier: no model download (a debug canvas mounts at tier 1). */}
      {tier >= COURIER.minTier ? (
        <WebglCourier journey={journey} tier={tier} particles={settings.scene5Particles} />
      ) : null}
    </WorldContext.Provider>
  );
}
