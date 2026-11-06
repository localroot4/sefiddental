/**
 * The WebGL courier (plain three.js, no React; docs/experience/journey.md sections 1 and 2): one
 * object in its own studio light (key, rim, sky fill, a soft contact shadow), drawn by a scissored
 * pass into a square box around the pose (WebglCourier.tsx), with an orthographic camera so the
 * box size is the pose's scale exactly. Two forms share one holder: the glazed teal mark
 * (mark.glb) and the enamel tooth (molar.glb, the restoration levels and the workflow beats of
 * phase 8 on the tooth itself). The arch of the smile station is a second small scene: the molar
 * instanced along archLayout, seen from above the front as the pose's projection assumes, so the
 * courier tooth seats in its slot pixel for pixel; it fades in and out by dissolving.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import { disposeObject3D, type DisposeCount } from '../scenes/dispose';
import { levelBlend } from '../scenes/webgl/math';
import { createEnamel, MOLAR_Y } from '../scenes/webgl/molar';
import { createStudio } from '../scenes/webgl/studio';

import { ARCH_DEPTH, ARCH_ELEVATION, ARCH_SLOT, archLayout } from './arch';
import type { Beats } from './beats';
import type { Pose } from './pose';

/** The pass box is this much larger than the pose's scale: room for the turn and the shadow. */
export const BOX_GROW = 1.5;
/** mark.glb is 1 unit wide and 223 / 184 tall. */
const MARK_HEIGHT = 223 / 184;
const MARK_FILL = 0.92;
const TOOTH_HEIGHT = MOLAR_Y.max - MOLAR_Y.min;
/** Crown centre of molar.glb: the point that seats in the arch. */
const CROWN_Y = 0.2;
const CROWN_WIDTH = 1.03;
/** The tooth's view from above before it nears the arch (the restoration rig's 0.6, flatter). */
const TOOTH_TILT = 0.42;

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

/** `count` points on the surface of a triangle mesh, area-weighted (the scan's point cloud). */
export function sampleSurface(
  geometry: BufferGeometry,
  count: number,
  random: () => number,
): Float32Array {
  const position = geometry.getAttribute('position');
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
  const out = new Float32Array(count * 3);
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
    for (let axis = 0; axis < 3; axis += 1) {
      out[i * 3 + axis] =
        position.getComponent(vertex(lo, 0), axis) * w +
        position.getComponent(vertex(lo, 1), axis) * u +
        position.getComponent(vertex(lo, 2), axis) * v;
    }
  }
  return out;
}

const POINTS_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uScan;
  uniform float uSize;
  uniform float uTime;
  varying float vGlow;
  void main() {
    float band = ${MOLAR_Y.min.toFixed(3)} - 0.1 + uScan * ${(TOOTH_HEIGHT + 0.2).toFixed(3)};
    vGlow = exp(-pow((position.y - band) / 0.07, 2.0)) * step(0.001, uScan) * step(uScan, 0.999);
    vec3 p = position + 0.006 * vec3(sin(uTime * 1.3 + aSeed * 40.0), cos(uTime * 1.1 + aSeed * 31.0), 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (1.0 + 0.7 * vGlow);
  }
`;
const POINTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.5, 1.0, d)) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uGlowColor, vGlow), a);
    #include <colorspace_fragment>
  }
`;

/** The glazed mark: clearcoat and the enamel's two studio softboxes, no environment map. */
function createGlaze(): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
  float facing = saturate(dot(normal, geometryViewDir));
  vec3 r = reflect(-geometryViewDir, normal);
  float panels = smoothstep(0.55, 0.95, r.y) + 0.6 * smoothstep(0.6, 0.95, r.x) * smoothstep(-0.2, 0.4, r.y);
  float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
  outgoingLight += vec3(panels) * (0.2 + fresnel) * 0.42;
}
#include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'sefid-glaze-1';
  return material;
}

export interface CourierFrame {
  pose: Pose;
  time: number;
  /** The restoration level position (0 plain, 1 VIP, 2 CIP), smoothed by the caller. */
  level: number;
  /** The turntable's extra turn at the restoration dock (radians). */
  turn: number;
  beats: Beats;
  /** 0..1 of the idle motion (pose.ts idleAmount). */
  idle: number;
  /** Device px per CSS px of the box side, for the point size. */
  pixels: number;
}

export interface CourierRig {
  scene: Scene;
  camera: OrthographicCamera;
  arch: { scene: Scene; camera: OrthographicCamera };
  update(frame: CourierFrame): void;
  /** `box` the arch pass box (px), `width` the arch's width in it (px), `dissolve` 0..1. */
  updateArch(frame: { width: number; height: number; archWidth: number; dissolve: number }): void;
  setTheme(dark: boolean, brand: string): void;
  dispose(): DisposeCount;
}

export function createCourierRig(
  geometry: { mark: BufferGeometry; molar: BufferGeometry },
  opts: { particles: number },
): CourierRig {
  const half = BOX_GROW / 2;
  const scene = new Scene();
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 20);
  camera.position.set(0, 0, 8);
  const studio = createStudio();
  // A soft drop shadow facing the camera, under the object.
  studio.shadow.rotation.x = 0;
  studio.shadow.position.set(0, -0.5, -2);
  studio.shadow.scale.set(0.62, 0.16, 1);
  scene.add(studio.group);

  const holder = new Group();
  const tilt = new Group();
  const spin = new Group();
  holder.add(tilt);
  tilt.add(spin);
  scene.add(holder);

  const glaze = createGlaze();
  const mark = new Mesh(geometry.mark, glaze);
  mark.scale.setScalar(MARK_FILL / MARK_HEIGHT);
  spin.add(mark);

  const toothScale = 1 / TOOTH_HEIGHT;
  const tooth = new Group();
  tooth.scale.setScalar(toothScale);
  spin.add(tooth);
  const enamel = createEnamel({ color: '#F3ECDF', sss: 0.26 });
  const solid = new Mesh(geometry.molar, enamel.material);
  tooth.add(solid);
  const wireMaterial = new MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const wire = new Mesh(geometry.molar, wireMaterial);
  wire.scale.setScalar(1.002);
  tooth.add(wire);
  const count = Math.max(0, Math.round(opts.particles));
  const random = mulberry32(5);
  const cloud = new BufferGeometry();
  cloud.setAttribute(
    'position',
    new BufferAttribute(sampleSurface(geometry.molar, count, random), 3),
  );
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) seeds[i] = random();
  cloud.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  const pointUniforms = {
    uScan: { value: 0 },
    uSize: { value: 2 },
    uTime: { value: 0 },
    uColor: { value: new Color('#007A72') },
    uGlowColor: { value: new Color('#CFF5F1') },
    uOpacity: { value: 0 },
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
  tooth.add(points);

  // The arch: thirteen molars and the empty slot, in its own light.
  const archScene = new Scene();
  const archCamera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20);
  archCamera.position.set(0, 0, 8);
  const archStudio = createStudio();
  archStudio.shadow.visible = false;
  archScene.add(archStudio.group);
  const archEnamel = createEnamel({ color: '#F3ECDF', sss: 0.22 });
  archEnamel.setLevel(1, 0);
  const teeth = archLayout();
  const instances = new InstancedMesh(geometry.molar, archEnamel.material, teeth.length - 1);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  let k = 0;
  teeth.forEach((t, i) => {
    if (i === ARCH_SLOT) return;
    const s = t.width / CROWN_WIDTH;
    m.compose(
      new Vector3(t.x, -CROWN_Y * s, t.z - ARCH_DEPTH / 2),
      q.setFromAxisAngle(up, t.yaw),
      new Vector3(s, s, s),
    );
    instances.setMatrixAt(k, m);
    k += 1;
  });
  instances.instanceMatrix.needsUpdate = true;
  const archGroup = new Group();
  archGroup.rotation.x = ARCH_ELEVATION;
  archGroup.add(instances);
  archScene.add(archGroup);

  let level = -1;
  return {
    scene,
    camera,
    arch: { scene: archScene, camera: archCamera },
    update({ pose, time, level: nextLevel, turn, beats, idle, pixels }) {
      const isTooth = pose.form === 'tooth';
      mark.visible = !isTooth;
      tooth.visible = isTooth;
      // Near the arch the tooth turns its crown to the camera and pivots on it, as it seats.
      const seat = isTooth ? pose.arch : 0;
      tilt.rotation.x = isTooth ? TOOTH_TILT + (ARCH_ELEVATION - TOOTH_TILT) * seat : 0;
      const centre = (MOLAR_Y.min + MOLAR_Y.max) / 2;
      tooth.position.y = -(centre + (CROWN_Y - centre) * seat) * toothScale;
      spin.rotation.y = pose.rotation + turn + idle * 0.12 * Math.sin(time * 0.45);
      holder.position.y = idle * 0.02 * Math.sin((time / 6) * Math.PI * 2);
      studio.shadow.visible = !isTooth || seat < 0.5;
      if (isTooth) {
        if (nextLevel !== level) {
          const { refine, character } = levelBlend(nextLevel);
          enamel.setLevel(refine, character);
          level = nextLevel;
        }
        enamel.uniforms.uBuild.value = beats.build;
        enamel.uniforms.uGlaze.value = beats.glaze;
        enamel.uniforms.uDissolve.value = pose.smile;
        solid.visible = beats.build > 0.001;
        wire.visible = beats.wire > 0.005;
        wireMaterial.opacity = 0.42 * beats.wire;
        points.visible = beats.points > 0.005;
        pointUniforms.uOpacity.value = beats.points;
        pointUniforms.uScan.value = beats.scan;
        pointUniforms.uTime.value = time;
        // About 3 px points on a 200 px tooth, in proportion elsewhere.
        pointUniforms.uSize.value = Math.max(1.5, 0.016 * pixels);
      }
      studio.setWarm(beats.warm);
    },
    updateArch({ width, height, archWidth, dissolve }) {
      const w = width / 2 / archWidth;
      const h = height / 2 / archWidth;
      if (archCamera.right !== w || archCamera.top !== h) {
        archCamera.left = -w;
        archCamera.right = w;
        archCamera.top = h;
        archCamera.bottom = -h;
        archCamera.updateProjectionMatrix();
      }
      archEnamel.uniforms.uDissolve.value = dissolve;
    },
    setTheme(dark, brand) {
      studio.setTheme(dark);
      archStudio.setTheme(dark);
      const ivory = dark ? '#F2ECE1' : '#F0E8DA';
      enamel.material.color.set(ivory);
      archEnamel.material.color.set(ivory);
      enamel.uniforms.uBuildEdge.value.set(brand);
      glaze.color.set(dark ? '#0B8C82' : '#037D74');
      wireMaterial.color.set(brand);
      pointUniforms.uColor.value.set(brand);
      pointUniforms.uGlowColor.value.set(dark ? '#E9FFFC' : '#5FD3C8');
    },
    dispose: () => {
      // The mark's geometry belongs to the brand model cache (brandGeometry.ts): released there.
      spin.remove(mark);
      glaze.dispose();
      instances.dispose();
      const a = disposeObject3D(scene);
      const b = disposeObject3D(archScene);
      return {
        geometries: a.geometries + b.geometries,
        materials: a.materials + b.materials + 1,
        textures: a.textures + b.textures,
      };
    },
  };
}
