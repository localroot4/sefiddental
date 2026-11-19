/**
 * The light's trail behind the travelling courier (motion.ts createTrail), drawn by the WebGL
 * courier in a pass of its own under the courier's (WebglCourier.tsx): a ribbon in CSS px, each
 * place's width and opacity falling with its age. On the GPU, not in the DOM: an SVG trail laid out
 * the page every frame it moved (owner 2026-11-19: with it a laptop fell to the unpinned layout,
 * whose workflow has no tooth beats). None at tier 1, where the DOM courier draws.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';

import type { TrailPoint } from './motion';

/** At most this many places (60 a second for TRAIL_S; motion.ts keeps no more). */
export const TRAIL_MAX = 24;
/** The head's width, as a share of the courier's box, and its opacity. */
export const TRAIL_WIDTH = 0.22;
export const TRAIL_OPACITY = 0.32;
/** The rim teal of each theme, as sRGB (the output is not colour-managed). */
const TEAL = { light: [95, 211, 200], dark: [127, 227, 217] } as const;

export interface TrailRibbon {
  scene: Scene;
  camera: OrthographicCamera;
  /**
   * Builds the ribbon over `points` (CSS px, oldest first) and aims the camera at its box, which it
   * returns for the pass; null for fewer than two places.
   */
  update(
    points: readonly TrailPoint[],
    dark: boolean,
  ): { left: number; top: number; width: number; height: number } | null;
  dispose(): void;
}

export function createTrailRibbon(): TrailRibbon {
  const positions = new Float32Array(TRAIL_MAX * 2 * 3);
  const alphas = new Float32Array(TRAIL_MAX * 2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1).setUsage(DynamicDrawUsage));
  const index: number[] = [];
  for (let i = 0; i < TRAIL_MAX - 1; i += 1) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(index);
  const color = { value: new Vector3() };
  const material = new ShaderMaterial({
    uniforms: { uColor: color },
    vertexShader:
      'attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {\n  vAlpha = aAlpha;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
    fragmentShader:
      'uniform vec3 uColor;\nvarying float vAlpha;\nvoid main() {\n  gl_FragColor = vec4(uColor, vAlpha);\n}',
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);
  return {
    scene,
    camera,
    update(points, dark) {
      const n = Math.min(points.length, TRAIL_MAX);
      if (n < 2) return null;
      const from = points.length - n;
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (let i = 0; i < n; i += 1) {
        const p = points[from + i]!;
        const before = points[from + Math.max(0, i - 1)]!;
        const after = points[from + Math.min(n - 1, i + 1)]!;
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const length = Math.hypot(dx, dy) || 1;
        const life = Math.max(0, 1 - p.age);
        const half = Math.max(0.5, (p.s * TRAIL_WIDTH * life) / 2);
        const nx = (-dy / length) * half;
        const ny = (dx / length) * half;
        positions.set([p.x + nx, p.y + ny, 0, p.x - nx, p.y - ny, 0], i * 6);
        const alpha = TRAIL_OPACITY * life ** 1.5;
        alphas[i * 2] = alpha;
        alphas[i * 2 + 1] = alpha;
        left = Math.min(left, p.x - half);
        right = Math.max(right, p.x + half);
        top = Math.min(top, p.y - half);
        bottom = Math.max(bottom, p.y + half);
      }
      geometry.attributes.position!.needsUpdate = true;
      geometry.attributes.aAlpha!.needsUpdate = true;
      geometry.setDrawRange(0, (n - 1) * 6);
      const [r, g, b] = dark ? TEAL.dark : TEAL.light;
      color.value.set(r / 255, g / 255, b / 255);
      const box = {
        left: Math.floor(left) - 2,
        top: Math.floor(top) - 2,
        width: Math.ceil(right - left) + 4,
        height: Math.ceil(bottom - top) + 4,
      };
      // CSS px, y down: the box's top edge is the view's top.
      camera.left = box.left;
      camera.right = box.left + box.width;
      camera.top = box.top;
      camera.bottom = box.top + box.height;
      camera.updateProjectionMatrix();
      return box;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
