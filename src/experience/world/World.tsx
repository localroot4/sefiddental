'use client';

/**
 * The porcelain world (phase 8; docs/experience-direction.md sections 2, 3 and 6): the space
 * every WebGL scene lives in. It owns the camera path and the light drift bound to the master
 * timeline (cool dawn key at the hero exit, peach by scene 9's `--warm`), the RoomEnvironment
 * reflections, the diamond dust, the shared materials in both themes, and the one render call per
 * frame (priority 1, so R3F does not render on its own); each scene brings its own shadow catcher. The canvas fades in on its first frame: no flash at the hero hand-over.
 * Tier 1 renders only while one of its scenes is mounted, then one clean frame, then nothing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  type DirectionalLight,
  type HemisphereLight,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../engine/scrollEngine';
import { SCENES } from '../scenes/registry';

import { WorldContext, type WorldApi, type WorldMotion } from './context';
import { Dust } from './Dust';
import { applyPalette, createMaterials, readPalette, type Palette } from './materials';
import { SceneSlots } from './SceneSlots';
import { cameraPose, lightDrift, wobbleStep, worldSettings } from './worldMath';

const FOV = 30;
const ORDER = SCENES.map((scene) => scene.id);
/** Seconds for the camera to settle on a new pose (a jump by `scrollTo` eases, never snaps). */
const CAMERA_EASE = 0.35;
const POINTER_EASE = 0.5;
const COOL = new Color('#CFE0F0');
const WARM = new Color('#FFD2A6');

export function World(props: {
  tier: 1 | 2 | 3;
  settings: TierSettings;
  engine: ScrollEngine;
}): React.JSX.Element {
  const { tier, settings, engine } = props;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;

  // Primitive key: a new settings object with the same values keeps the compiled materials.
  const worldKey = JSON.stringify(worldSettings(tier, settings));
  const world = useMemo(() => JSON.parse(worldKey) as ReturnType<typeof worldSettings>, [worldKey]);
  const materials = useMemo(() => createMaterials(world), [world]);
  useEffect(() => () => materials.all.forEach((m) => m.dispose()), [materials]);

  const [palette, setPalette] = useState<Palette>(() => readPalette(document.documentElement));
  // The canvas still holds a frame of the old theme: hide it at once (no fade) and show it again
  // with the first frame drawn in the new one, so a theme switch never flashes the old surface.
  const revealed = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const read = () => {
      canvas.style.setProperty('transition', 'none');
      canvas.style.setProperty('opacity', '0');
      revealed.current = false;
      setPalette(readPalette(document.documentElement));
    };
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', read);
    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', read);
    };
  }, [gl]);
  useEffect(() => applyPalette(materials, palette), [materials, palette]);

  const [motion] = useState<WorldMotion>(() => ({
    time: 0,
    wobble: 0,
    lift: 0,
    pointerX: 0,
    pointerY: 0,
    warm: 0,
  }));
  const drawingRef = useRef(0);

  // The camera of the world: a narrow lens, so the screen-anchored objects keep their proportions.
  // Tier 3's glass transmission renders the opaque scene once more; at half size it costs a quarter.
  useEffect(() => {
    gl.transmissionResolutionScale = 0.5;
    camera.fov = FOV;
    camera.near = 0.5;
    camera.far = 40;
    camera.updateProjectionMatrix();
  }, [gl, camera]);

  // Reflections without an HDR file (storyboard scene 2). Rebuilt after a context restore: the
  // prefiltered map lives only on the GPU.
  useEffect(() => {
    let target: WebGLRenderTarget | null = null;
    const build = () => {
      target?.dispose();
      const pmrem = new PMREMGenerator(gl);
      const room = new RoomEnvironment();
      target = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      scene.environment = target.texture;
    };
    build();
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextrestored', build);
    return () => {
      canvas.removeEventListener('webglcontextrestored', build);
      scene.environment = null;
      target?.dispose();
    };
  }, [gl, scene]);

  // The canvas is opaque; it shows only after a frame has been drawn into it.
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.setProperty('opacity', '0');
    return () => {
      canvas.style.removeProperty('opacity');
      canvas.style.removeProperty('transition');
    };
  }, [gl]);

  // Fine pointers only (spec section 5): touch gets scroll-driven motion only.
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!settings.pointerParallax) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [settings.pointerParallax]);

  const warmLayer = useMemo(() => document.querySelector<HTMLElement>('[data-warm-layer]'), []);
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const background = useMemo(() => new Color(), []);
  const look = useMemo(() => ({ position: [0, 0, 10], target: [0, 0, 0] }), []);

  // Every program the scenes use, compiled before their first frame (KHR_parallel_shader_compile
  // where the driver has it), so a scene mounting mid-scroll does not stall a frame.
  useEffect(() => {
    const probe = new Group();
    const geometry = new PlaneGeometry(0.01, 0.01);
    for (const material of materials.all) {
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = material !== materials.shadow && material !== materials.glow;
      mesh.receiveShadow = material === materials.shadow;
      probe.add(mesh);
    }
    gl.compileAsync(probe, camera, scene).then(
      () => geometry.dispose(),
      (error: unknown) => {
        geometry.dispose();
        console.error('[world] shader precompile failed.', error);
      },
    );
  }, [gl, camera, scene, materials]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    motion.time += dt;
    motion.wobble = wobbleStep(motion.wobble, engine.velocity(), dt);
    motion.lift += motion.wobble * dt * 1.2;
    const ease = 1 - Math.exp(-dt / POINTER_EASE);
    motion.pointerX += (pointer.current.x - motion.pointerX) * ease;
    motion.pointerY += (pointer.current.y - motion.pointerY) * ease;
    const warm = parseFloat(warmLayer?.style.getPropertyValue('--warm') ?? '');
    motion.warm = world.drawsIdle && Number.isFinite(warm) ? warm : 0;

    const pose = cameraPose(ORDER, engine.activeScene());
    const follow = 1 - Math.exp(-dt / CAMERA_EASE);
    for (let i = 0; i < 3; i += 1) {
      look.position[i]! += (pose.position[i]! - look.position[i]!) * follow;
      look.target[i]! += (pose.target[i]! - look.target[i]!) * follow;
    }
    camera.position.set(
      look.position[0]! + motion.pointerX * 0.22,
      look.position[1]! - motion.pointerY * 0.14,
      look.position[2]!,
    );
    camera.lookAt(look.target[0]!, look.target[1]!, look.target[2]!);
    camera.updateMatrixWorld();

    const drift = lightDrift(engine.progress(), motion.warm);
    const light = key.current;
    if (light) {
      light.color.copy(COOL).lerp(WARM, drift.warmth);
      light.position.set(...drift.position);
      light.intensity = palette.dark ? 1.9 : 2.6;
    }
    if (fill.current) fill.current.intensity = palette.dark ? 0.7 : 1.0;
    background.copy(palette.surface).lerp(palette.stage, motion.warm);
    scene.background = background;
    gl.toneMappingExposure = palette.dark ? 0.95 : 1.0;
    materials.grain.uGrainTime.value = motion.time;
  }, -1);

  const cleanDrawn = useRef(false);
  useFrame(() => {
    const idle = !world.drawsIdle && drawingRef.current === 0;
    if (idle && cleanDrawn.current) return;
    gl.render(scene, camera);
    cleanDrawn.current = idle;
    if (!revealed.current) {
      revealed.current = true;
      gl.domElement.style.setProperty('transition', 'opacity var(--dur-3) var(--ease-out)');
      gl.domElement.style.setProperty('opacity', '1');
    }
  }, 1);

  const api = useMemo<WorldApi>(
    () => ({ engine, tier, settings, world, materials, palette, motion, fov: FOV, drawingRef }),
    [engine, tier, settings, world, materials, palette, motion],
  );
  const shadows = world.shadows !== 'none';

  return (
    <WorldContext.Provider value={api}>
      <hemisphereLight
        ref={fill}
        args={[palette.dark ? '#24435E' : '#E4EEF4', palette.dark ? '#0F3B3A' : '#EFE2D2']}
      />
      <directionalLight
        ref={key}
        castShadow={shadows}
        shadow-mapSize={[world.shadowMapSize, world.shadowMapSize]}
        shadow-radius={world.shadowRadius}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      <Dust
        count={world.particles}
        dof={world.dof}
        palette={palette}
        motion={motion}
        visible={() => world.drawsIdle || drawingRef.current > 0}
      />
      <SceneSlots />
    </WorldContext.Provider>
  );
}
