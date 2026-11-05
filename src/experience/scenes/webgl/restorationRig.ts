/**
 * Scene 4's slot scene (plain three.js, no React): the molar on a turntable in its own light,
 * framed to the molar slot of RestorationSection. `update` takes the smoothed level position
 * (0 plain, 1 VIP, 2 CIP) and the scroll progress.
 */
import { Group, Mesh, PerspectiveCamera, Scene, type BufferGeometry, type Texture } from 'three';

import { disposeObject3D, type DisposeCount } from '../dispose';

import { fitDistance, levelBlend, turntableYaw } from './math';
import { createEnamel, MOLAR_Y } from './molar';
import { createStudio } from './studio';

const FOV = 24;
/** The view drops onto the occlusal plane by this much, so the cusps and the roots both read. */
const ELEVATION = 0.6;
/** Turntable box: the crown's diagonal when turned, the tooth's height with its shadow. */
const BOX = { width: 1.46, height: 1.62 };
const SHADOW_Y = MOLAR_Y.min - 0.1;

export interface MolarRig {
  scene: Scene;
  camera: PerspectiveCamera;
  update(frame: { level: number; progress: number; time: number; aspect: number }): void;
  setTheme(dark: boolean): void;
  setEnvironment(texture: Texture | null): void;
  dispose(): DisposeCount;
}

export function createMolarRig(geometry: BufferGeometry, opts: { tier: 1 | 2 | 3 }): MolarRig {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 30);
  const studio = createStudio();
  studio.setWarm(0.35);
  studio.shadow.position.y = SHADOW_Y;
  scene.add(studio.group);

  // Only tier 3 has the room environment: more glow keeps the enamel from going flat without it.
  const enamel = createEnamel({ color: '#F3ECDF', sss: opts.tier === 3 ? 0.2 : 0.3 });
  const molar = new Mesh(geometry, enamel.material);
  const turntable = new Group();
  turntable.add(molar);
  scene.add(turntable);

  const centreY = (SHADOW_Y + MOLAR_Y.max) / 2;
  let aspect = 0;

  return {
    scene,
    camera,
    update({ level, progress, time, aspect: nextAspect }) {
      if (nextAspect !== aspect) {
        aspect = nextAspect;
        camera.aspect = aspect;
        const d = fitDistance(FOV, aspect, BOX.width, BOX.height) * 1.04;
        camera.position.set(0, centreY + d * Math.sin(ELEVATION), d * Math.cos(ELEVATION));
        camera.lookAt(0, centreY, 0);
        camera.updateProjectionMatrix();
      }
      const { refine, character } = levelBlend(level);
      enamel.setLevel(refine, character);
      turntable.rotation.y = turntableYaw(level, progress, time);
      // A slow breath on the turntable; the shadow stays on the floor.
      molar.rotation.x = 0.05 * Math.sin(time * 0.6);
      molar.position.y = 0.025 * Math.sin(time * 0.8);
    },
    setTheme(dark) {
      studio.setTheme(dark);
      enamel.material.color.set(dark ? '#EFE7D8' : '#E9DFCC');
      enamel.material.envMapIntensity = dark ? 0.4 : 0.6;
    },
    setEnvironment(texture) {
      scene.environment = texture;
    },
    dispose: () => disposeObject3D(scene),
  };
}
