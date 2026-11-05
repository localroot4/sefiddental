/**
 * Scene 5's slot scene (plain three.js, no React): the four beats of the digital method on one
 * molar, in the free corner of the pinned diagonal stage. Scan: a point cloud sampled on the
 * tooth's surface converges under a rising scan band. Design: the wireframe. Make: the solid
 * builds from the root tips to the cusps and then gets its glaze. Smile: the key light turns warm.
 * The camera travels a diagonal arc (from above the start side to level with the end side) while
 * the DOM path pans the photos along the same diagonal (workflow.ts).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';

import { disposeObject3D, type DisposeCount } from '../dispose';

import { ramp, workflowStages } from './math';
import { createEnamel, MOLAR_Y } from './molar';
import { createStudio } from './studio';

/** Vertical field of view of the virtual full view (setViewOffset shows a quarter of it). */
const FOV = 36;
/** Tooth height (with its shadow) as a share of the stage height. */
const TOOTH_SHARE = 0.42;
const TOOTH_HEIGHT = MOLAR_Y.max - MOLAR_Y.min + 0.2;
const SHADOW_Y = MOLAR_Y.min - 0.1;

/** A small deterministic PRNG (mulberry32): the same cloud on every visit and in screenshots. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` points on the surface of an indexed triangle mesh, area-weighted, with normals. */
export function sampleSurface(
  geometry: BufferGeometry,
  count: number,
  random: () => number,
): { positions: Float32Array; normals: Float32Array } {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const triangles = index ? index.count / 3 : position.count / 3;
  const vertex = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cumulative = new Float64Array(triangles);
  let total = 0;
  for (let t = 0; t < triangles; t += 1) {
    a.fromBufferAttribute(position, vertex(t, 0));
    b.fromBufferAttribute(position, vertex(t, 1)).sub(a);
    c.fromBufferAttribute(position, vertex(t, 2)).sub(a);
    total += b.cross(c).length() / 2;
    cumulative[t] = total;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const n = new Vector3();
  for (let i = 0; i < count; i += 1) {
    const pick = random() * total;
    let lo = 0;
    let hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cumulative[mid] ?? 0) < pick) lo = mid + 1;
      else hi = mid;
    }
    let u = random();
    let v = random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    const [i0, i1, i2] = [vertex(lo, 0), vertex(lo, 1), vertex(lo, 2)];
    for (let axis = 0; axis < 3; axis += 1) {
      positions[i * 3 + axis] =
        position.getComponent(i0, axis) * w +
        position.getComponent(i1, axis) * u +
        position.getComponent(i2, axis) * v;
    }
    n.set(
      normal.getX(i0) * w + normal.getX(i1) * u + normal.getX(i2) * v,
      normal.getY(i0) * w + normal.getY(i1) * u + normal.getY(i2) * v,
      normal.getZ(i0) * w + normal.getZ(i1) * u + normal.getZ(i2) * v,
    ).normalize();
    normals.set([n.x, n.y, n.z], i * 3);
  }
  return { positions, normals };
}

const POINTS_VERTEX = /* glsl */ `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uAssemble;
  uniform float uScan;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vGlow;
  varying float vSettled;
  void main() {
    // Each point settles as the scan band reaches its height, with a little jitter.
    float height = (position.y - ${MOLAR_Y.min.toFixed(3)}) / ${(MOLAR_Y.max - MOLAR_Y.min).toFixed(3)};
    float t = clamp((uAssemble * 1.6 - height * 0.6 - aSeed * 0.35) / 0.4, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 drift = 0.02 * vec3(sin(uTime * 1.3 + aSeed * 40.0), cos(uTime * 1.1 + aSeed * 31.0), 0.0);
    vec3 p = mix(aStart, position, t) + drift * (1.0 - t);
    float band = ${MOLAR_Y.min.toFixed(3)} - 0.1 + uScan * ${(MOLAR_Y.max - MOLAR_Y.min + 0.2).toFixed(3)};
    vGlow = exp(-pow((position.y - band) / 0.06, 2.0)) * step(0.001, uScan) * step(uScan, 0.999);
    vSettled = t;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + 0.6 * vGlow) * (0.6 + 0.4 * t) / -mv.z;
  }
`;

const POINTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  varying float vGlow;
  varying float vSettled;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.55, 1.0, d)) * uOpacity * (0.45 + 0.55 * vSettled);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uGlowColor, vGlow), a);
    #include <colorspace_fragment>
  }
`;

export interface WorkflowRig {
  scene: Scene;
  camera: PerspectiveCamera;
  /** `p` the unclamped pin progress; `w`, `h` the stage size and `card` the step width (px). */
  update(frame: {
    p: number;
    time: number;
    w: number;
    h: number;
    card: number;
    pixelRatio: number;
  }): void;
  setTheme(dark: boolean, brand: string): void;
  dispose(): DisposeCount;
}

export function createWorkflowRig(
  geometry: BufferGeometry,
  opts: { particles: number; rtl: boolean },
): WorkflowRig {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  const studio = createStudio();
  studio.shadow.position.y = SHADOW_Y;
  scene.add(studio.group);

  const tooth = new Group();
  scene.add(tooth);

  const enamel = createEnamel({ color: '#F3ECDF', sss: 0.24 });
  enamel.setLevel(1, 0);
  const solid = new Mesh(geometry, enamel.material);
  tooth.add(solid);

  const wireMaterial = new MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const wire = new Mesh(geometry, wireMaterial);
  wire.scale.setScalar(1.002);
  tooth.add(wire);

  const random = mulberry32(5);
  const { positions, normals } = sampleSurface(geometry, opts.particles, random);
  const starts = new Float32Array(opts.particles * 3);
  const seeds = new Float32Array(opts.particles);
  for (let i = 0; i < opts.particles; i += 1) {
    // Out along the surface normal and sideways: the cloud reads as captured from around the tooth.
    const out = 0.6 + random() * 1.6;
    const side = (random() - 0.5) * 1.4;
    starts[i * 3] = (positions[i * 3] ?? 0) + (normals[i * 3] ?? 0) * out + side;
    starts[i * 3 + 1] = (positions[i * 3 + 1] ?? 0) + (normals[i * 3 + 1] ?? 0) * out * 0.6;
    starts[i * 3 + 2] = (positions[i * 3 + 2] ?? 0) + (normals[i * 3 + 2] ?? 0) * out;
    seeds[i] = random();
  }
  const cloud = new BufferGeometry();
  cloud.setAttribute('position', new BufferAttribute(positions, 3));
  cloud.setAttribute('aStart', new BufferAttribute(starts, 3));
  cloud.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  const pointUniforms = {
    uAssemble: { value: 0 },
    uScan: { value: 0 },
    uSize: { value: 1 },
    uPixelRatio: { value: 1 },
    uTime: { value: 0 },
    uColor: { value: new Color('#007A72') },
    uGlowColor: { value: new Color('#CFF5F1') },
    uOpacity: { value: 1 },
  };
  const points = new Points(
    cloud,
    new ShaderMaterial({
      uniforms: pointUniforms,
      vertexShader: POINTS_VERTEX,
      fragmentShader: POINTS_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  // The start positions sit outside the bounding sphere of `position`.
  points.frustumCulled = false;
  tooth.add(points);

  let size = { w: 0, h: 0, card: 0 };
  const target = new Vector3(0, (SHADOW_Y + MOLAR_Y.max) / 2, 0);
  const side = opts.rtl ? 1 : -1;

  return {
    scene,
    camera,
    update({ p, time, w, h, card, pixelRatio }) {
      const s = workflowStages(p);
      pointUniforms.uAssemble.value = s.assemble;
      pointUniforms.uScan.value = s.scan;
      pointUniforms.uOpacity.value = s.points;
      pointUniforms.uTime.value = time;
      pointUniforms.uPixelRatio.value = pixelRatio;
      points.visible = s.points > 0.005;
      wireMaterial.opacity = 0.42 * s.wire;
      wire.visible = s.wire > 0.005;
      enamel.uniforms.uBuild.value = s.build;
      enamel.uniforms.uGlaze.value = s.glaze;
      solid.visible = s.build > 0.001;
      studio.shadow.visible = solid.visible || s.assemble > 0.5;
      studio.shadow.scale.setScalar(0.6 + 0.4 * Math.max(s.build, s.assemble * 0.6));
      studio.setWarm(s.warm);
      tooth.rotation.y = -0.6 + 1.1 * ramp(p, -0.3, 1.2) + 0.08 * Math.sin(time * 0.5);

      if (w !== size.w || h !== size.h || card !== size.card) {
        size = { w, h, card };
        // The tooth's centre in the stage: the middle of the free strip beside the centred step
        // (the start side, where the next step has not arrived and the last one has left).
        const free = Math.max(1, (w - card) / 2);
        const heightPx = Math.min(TOOTH_SHARE * h, (free * 0.92) / 0.78);
        const fx = 0.5 + (side * (card / 2 + free / 2)) / w;
        const fy = 0.66;
        camera.aspect = w / h;
        camera.setViewOffset(2 * w, 2 * h, w - fx * w, h - fy * h, w, h);
        // Full view height 2h: the tooth spans heightPx of it at distance d.
        const half = Math.tan(((FOV / 2) * Math.PI) / 180);
        const d = (TOOTH_HEIGHT * 2 * h) / (heightPx * 2 * half);
        camera.userData.distance = d;
        camera.updateProjectionMatrix();
        // About 3.5 px points on a 830 px stage, in proportion elsewhere.
        pointUniforms.uSize.value = 0.0042 * h * d;
      }
      // The diagonal: from above the start side down to level with the end side.
      const k = ramp(p, -0.2, 1.1);
      const azimuth = side * (0.55 - 1.1 * k);
      const elevation = 0.5 - 0.42 * k;
      const d = (camera.userData.distance as number | undefined) ?? 8;
      camera.position.set(
        target.x + d * Math.cos(elevation) * Math.sin(azimuth),
        target.y + d * Math.sin(elevation),
        target.z + d * Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.lookAt(target);
    },
    setTheme(dark, brand) {
      studio.setTheme(dark);
      enamel.material.color.set(dark ? '#F2ECE1' : '#F0E8DA');
      enamel.uniforms.uBuildEdge.value.set(brand);
      wireMaterial.color.set(brand);
      pointUniforms.uColor.value.set(brand);
      pointUniforms.uGlowColor.value.set(dark ? '#E9FFFC' : '#5FD3C8');
    },
    dispose: () => disposeObject3D(scene),
  };
}
