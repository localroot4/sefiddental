'use client';

/**
 * One slot per registry scene with `webgl.load` (spec EXP 3.10): the lifecycle in
 * scenes/lifecycle.ts loads a scene one ahead in scroll order, keeps the neighbours mounted and
 * unmounts it two scenes away, where its handle frees what R3F does not. React state changes
 * only when a slot changes state, never per frame.
 */
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';

import { useFrame } from '@react-three/fiber';

import { SCENES } from '../scenes/registry';
import { isMounted, slotState, type SlotState } from '../scenes/lifecycle';
import type { SceneHandle, SceneId, SceneProps } from '../scenes/types';

import { useWorld } from './context';

const SLOTS = SCENES.filter((scene) => scene.webgl?.load !== undefined);
const INDEX = new Map(SCENES.map((scene, i) => [scene.id, i]));

/** `onMount` runs when a first slot mounts (the World then builds its environment). */
export function SceneSlots(props: { onMount: () => void }): React.JSX.Element {
  const { onMount } = props;
  const { engine, tier, settings, drawingRef } = useWorld();
  const [modules, setModules] = useState<Partial<Record<SceneId, ComponentType<SceneProps>>>>({});
  const [states, setStates] = useState<Partial<Record<SceneId, SlotState>>>({});
  const requested = useRef(new Set<SceneId>());
  // One stable ref per scene (a new function each render would detach, and dispose, the scene);
  // a detach frees what R3F does not dispose itself.
  const refs = useMemo(() => {
    const handles = new Map<SceneId, SceneHandle>();
    return new Map(
      SLOTS.map((scene) => [
        scene.id,
        (handle: SceneHandle | null) => {
          if (handle !== null) {
            handles.set(scene.id, handle);
            return;
          }
          handles.get(scene.id)?.dispose();
          handles.delete(scene.id);
        },
      ]),
    );
  }, []);

  useFrame(() => {
    const active = engine.activeScene();
    const activeIndex = active === null ? -1 : (INDEX.get(active.id) ?? -1);
    let changed = false;
    const next: Partial<Record<SceneId, SlotState>> = {};
    for (const scene of SLOTS) {
      const state = slotState({
        tier,
        minTier: scene.webgl?.minTier ?? null,
        // A scene that draws nothing on this device and layout never loads its chunk.
        hasLoader: scene.webgl?.draws?.(settings) ?? true,
        sceneIndex: INDEX.get(scene.id) ?? -1,
        activeIndex,
        loaded: modules[scene.id] !== undefined,
      });
      next[scene.id] = state;
      if (states[scene.id] !== state) changed = true;
      if (state === 'loading' && !requested.current.has(scene.id)) {
        requested.current.add(scene.id);
        scene.webgl?.load?.().then(
          (mod) => setModules((current) => ({ ...current, [scene.id]: mod.default })),
          (error: unknown) => console.error(`[world] scene "${scene.id}" failed to load.`, error),
        );
      }
    }
    drawingRef.current = SLOTS.filter((scene) => isMounted(next[scene.id] ?? 'idle')).length;
    if (changed) setStates(next);
  }, -2);

  const mounted = SLOTS.filter((scene) => isMounted(states[scene.id] ?? 'idle'));
  const anyMounted = mounted.length > 0;
  useEffect(() => {
    if (anyMounted) onMount();
  }, [anyMounted, onMount]);
  return (
    <>
      {mounted.map((scene) => {
        const Scene = modules[scene.id];
        if (Scene === undefined) return null;
        return (
          <Scene
            key={scene.id}
            ref={refs.get(scene.id)}
            id={scene.id}
            tier={tier}
            settings={settings}
            progress={() => engine.sceneProgress(scene.id)}
            active={() => engine.activeScene()?.id === scene.id}
          />
        );
      })}
    </>
  );
}
