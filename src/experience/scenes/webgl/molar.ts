/**
 * The stylized in-house molar of scenes 4 and 5 (gap 34: it stays until the client picks) and its
 * enamel. The geometry loads once per page view and is shared; disposing it only frees the GPU
 * buffers, which the next draw uploads again, so either scene may dispose it.
 *
 * Enamel (experience-direction section 6): MeshPhysicalMaterial (clearcoat) with a
 * subsurface-like term instead of transmission: a warm ivory glow toward the silhouette and
 * through the thin cusps. Transmission renders the opaque scene into its own target at canvas
 * size, which a scissored slot pass cannot use, and costs a second render. Layers in the shader:
 * the VIP refinement (cusp displacement, from the turntable prototype 0d), the CIP colour
 * characterization (a warm cervical gradient, cool translucent tips, stain lines in the
 * fissures), and scene 5's build cut and glaze.
 */
import {
  Color,
  MeshPhysicalMaterial,
  type BufferGeometry,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MOLAR_GLB } from './assets';

let pending: Promise<BufferGeometry> | null = null;

/** The molar geometry (crown 1.03 wide, y up, roots down to y -1.03), loaded once. */
export function loadMolar(): Promise<BufferGeometry> {
  pending ??= new GLTFLoader().loadAsync(MOLAR_GLB.url).then((gltf) => {
    let found: Mesh | null = null;
    gltf.scene.traverse((object) => {
      if (found === null && (object as Mesh).isMesh) found = object as Mesh;
    });
    const mesh = found as Mesh | null;
    if (mesh === null) throw new Error(`[experience] ${MOLAR_GLB.url} holds no mesh.`);
    // The scenes bring their own material; the file has none worth keeping.
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    mesh.geometry.computeBoundingBox();
    return mesh.geometry;
  });
  // A failed request may succeed on the next mount (a flaky network): do not cache the failure.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** Crown top and root tips of molar.glb (accessor min and max), for the build cut and the tips. */
export const MOLAR_Y = { min: -1.032, max: 0.41 } as const;

const CUSP_GLSL = /* glsl */ `
float sefidCuspHeight(float x, float z, float amp) {
  const float s2 = 0.17 * 0.17;
  float h = 0.0;
  h += amp * exp(-((x + 0.25) * (x + 0.25) + (z + 0.21) * (z + 0.21)) / s2);
  h += amp * exp(-((x - 0.25) * (x - 0.25) + (z + 0.21) * (z + 0.21)) / s2);
  h += amp * exp(-((x + 0.25) * (x + 0.25) + (z - 0.23) * (z - 0.23)) / s2);
  h += amp * exp(-((x - 0.25) * (x - 0.25) + (z - 0.23) * (z - 0.23)) / s2);
  h -= 0.45 * amp * exp(-(x * x + z * z) / 0.028);
  h -= 0.5 * amp * exp(-(x * x) / 0.0022) * exp(-(z * z) / 0.3);
  h -= 0.4 * amp * exp(-(z * z) / 0.0022) * exp(-(x * x) / 0.3);
  return h;
}`;

const NOISE_GLSL = /* glsl */ `
float sefidHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sefidNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sefidHash(i), sefidHash(i + vec2(1.0, 0.0)), f.x),
             mix(sefidHash(i + vec2(0.0, 1.0)), sefidHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const CUSP_AMP = 0.075;
const CROWN_HALF = 0.36;

export interface EnamelUniforms {
  uRefine: { value: number };
  uCharacter: { value: number };
  /** Subsurface-like glow strength. */
  uSss: { value: number };
  uSssColor: { value: Color };
  /** Strength of the studio softbox reflection (the clearcoat's environment). */
  uReflect: { value: number };
  /** 0..1: the solid exists from the root tips up to this share of the height (scene 5). */
  uBuild: { value: number };
  uBuildEdge: { value: Color };
  /** 0 matte milled block, 1 glazed enamel (scene 5). */
  uGlaze: { value: number };
  /** 0..1 the enamel dissolves in a noise pattern (the arch into the smile, journey D5). */
  uDissolve: { value: number };
}

export interface Enamel {
  material: MeshPhysicalMaterial;
  uniforms: EnamelUniforms;
  /** Writes the VIP and CIP blend (levelBlend) into the uniforms and the physical parameters. */
  setLevel(refine: number, character: number): void;
}

const ENAMEL = { roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.42 };

export function createEnamel(opts: {
  color: string;
  sss: number;
  /**
   * False: no clearcoat lobe at any level (the D5 arch: thirteen small teeth over a large pass,
   * where the shader's own softbox reflection carries the gloss).
   */
  clearcoat?: boolean;
}): Enamel {
  const coat = opts.clearcoat === false ? 0 : 1;
  const uniforms: EnamelUniforms = {
    uRefine: { value: 0 },
    uCharacter: { value: 0 },
    uSss: { value: opts.sss },
    uSssColor: { value: new Color('#F4D6B4') },
    uReflect: { value: 0.35 },
    uBuild: { value: 1 },
    uBuildEdge: { value: new Color('#2BB5AA') },
    uGlaze: { value: 1 },
    uDissolve: { value: 0 },
  };
  const material = new MeshPhysicalMaterial({
    color: opts.color,
    metalness: 0,
    ...ENAMEL,
    clearcoat: ENAMEL.clearcoat * coat,
  });
  const yMin = MOLAR_Y.min.toFixed(3);
  const yMax = MOLAR_Y.max.toFixed(3);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uRefine;
varying vec3 vObjPos;
varying vec3 vObjNormal;
${CUSP_GLSL}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float topW = smoothstep(0.08, ${CROWN_HALF} * 0.92, position.y);
float refineAmp = uRefine * ${CUSP_AMP} * 0.35;
{
  const float e = 0.01;
  float hx = (sefidCuspHeight(position.x + e, position.z, refineAmp) - sefidCuspHeight(position.x - e, position.z, refineAmp)) / (2.0 * e);
  float hz = (sefidCuspHeight(position.x, position.z + e, refineAmp) - sefidCuspHeight(position.x, position.z - e, refineAmp)) / (2.0 * e);
  objectNormal = normalize(objectNormal - topW * vec3(hx, 0.0, hz));
}
vObjNormal = objectNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed.y += topW * sefidCuspHeight(position.x, position.z, refineAmp);
vObjPos = transformed;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uCharacter;
uniform float uSss;
uniform vec3 uSssColor;
uniform float uReflect;
uniform float uBuild;
uniform vec3 uBuildEdge;
uniform float uGlaze;
uniform float uDissolve;
varying vec3 vObjPos;
varying vec3 vObjNormal;
${NOISE_GLSL}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float sefidCut = mix(${yMin} - 0.02, ${yMax} + 0.06, uBuild);
if (vObjPos.y > sefidCut) discard;
if (uDissolve > 0.0 && sefidNoise(vObjPos.xy * 7.0 + vObjPos.z * 5.0) * 0.98 + 0.01 < uDissolve) discard;
float sefidEdge = uBuild < 0.999 ? 1.0 - smoothstep(0.0, 0.05, sefidCut - vObjPos.y) : 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 p = vObjPos;
  float up = clamp(vObjNormal.y, 0.0, 1.0);
  vec3 c = diffuseColor.rgb;
  // Milled block before the glaze: a flatter, cooler white.
  c = mix(c * vec3(0.93, 0.95, 0.97), c, uGlaze);
  if (uCharacter > 0.001) {
    // Warm dentin shade from the cervical third down the roots, strongest at the neck.
    float cervical = smoothstep(0.15, -0.3, p.y) * mix(0.7, 1.0, smoothstep(-0.7, -0.3, p.y));
    float tips = smoothstep(0.26, 0.42, p.y) * up;
    float wob = (sefidNoise(p.xz * 18.0) - 0.5) * 0.05;
    float fx = exp(-pow((p.x + wob) / 0.035, 2.0)) * exp(-(p.z * p.z) / 0.14);
    float fz = exp(-pow((p.z - wob) / 0.035, 2.0)) * exp(-(p.x * p.x) / 0.14);
    float fissure = clamp(fx + fz, 0.0, 1.0) * smoothstep(0.1, 0.3, p.y) * up;
    fissure *= 0.55 + 0.45 * sefidNoise(p.xz * 40.0 + p.y * 9.0);
    c = mix(c, c * vec3(0.86, 0.66, 0.42), clamp(cervical, 0.0, 1.0) * uCharacter);
    c = mix(c, vec3(0.78, 0.84, 0.88), tips * 0.5 * uCharacter);
    c = mix(c, vec3(0.42, 0.28, 0.16), fissure * uCharacter);
    c *= 1.0 - 0.05 * uCharacter * sefidNoise(p.xz * 6.0 + p.y * 3.0);
  }
  diffuseColor.rgb = c;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.72, roughnessFactor, uGlaze);
if (uCharacter > 0.001) {
  float wobR = (sefidNoise(vObjPos.xz * 18.0) - 0.5) * 0.05;
  float fr = exp(-pow((vObjPos.x + wobR) / 0.022, 2.0)) * exp(-(vObjPos.z * vObjPos.z) / 0.14)
    + exp(-pow((vObjPos.z - wobR) / 0.022, 2.0)) * exp(-(vObjPos.x * vObjPos.x) / 0.14);
  roughnessFactor += uCharacter * 0.25 * clamp(fr, 0.0, 1.0) * smoothstep(0.2, 0.34, vObjPos.y);
}`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= uGlaze;
#endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  // Subsurface-like: light scattered inside the enamel shows at grazing angles and through the
  // thin cusp tips, warm ivory, never on the matte block.
  float facing = saturate(dot(normal, geometryViewDir));
  float rim = pow(1.0 - facing, 2.5);
  float thin = smoothstep(0.2, 0.4, vObjPos.y) * 0.35;
  outgoingLight += uSssColor * (rim + thin) * uSss * uGlaze;
  // Studio reflection without an environment map: two soft panels (above and to the start side)
  // seen in the reflected view ray, Schlick-weighted, on the glazed surface only. A PMREM room
  // doubled the frame time on a software GPU for the same picture on a small slot.
  vec3 r = reflect(-geometryViewDir, normal);
  float panels = smoothstep(0.55, 0.95, r.y) + 0.6 * smoothstep(0.6, 0.95, r.x) * smoothstep(-0.2, 0.4, r.y);
  float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
  outgoingLight += vec3(panels) * (0.25 + fresnel) * uReflect * uGlaze;
  outgoingLight = mix(outgoingLight, uBuildEdge * 1.6, sefidEdge);
}
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'sefid-enamel-2';

  return {
    material,
    uniforms,
    setLevel(refine, character) {
      uniforms.uRefine.value = refine;
      uniforms.uCharacter.value = character;
      material.roughness = ENAMEL.roughness - 0.28 * refine;
      material.clearcoat = (ENAMEL.clearcoat + 0.65 * refine) * coat;
      material.clearcoatRoughness = ENAMEL.clearcoatRoughness - 0.3 * refine;
      uniforms.uReflect.value = 0.2 + 0.3 * refine;
    },
  };
}
