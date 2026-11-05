'use client';

/**
 * Diamond dust (docs/discovery/threeui-review.md section 3, constellation drift at low counts):
 * one Points draw, moved entirely in the vertex shader, so a frame uploads no buffer. Scroll
 * velocity lifts it (clamped through the wobble), the volume stretches with the aspect ratio, and
 * at tier 3 the light depth of field softens the grains far from the focus plane. Opacity stays
 * low (16 % light, 30 % dark) so text over a grain keeps AA.
 */
import { useEffect, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Points } from 'three';

import type { Palette } from './materials';

const vertexShader = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uLift;
uniform float uSpread;
uniform float uSize;
uniform float uDof;
uniform float uFocus;
varying float vBlur;
varying float vSeed;
void main() {
  vec3 p = position;
  float speed = 0.05 + 0.08 * aSeed;
  p.y = mod(p.y + uTime * speed + uLift * (0.6 + aSeed) + 4.5, 9.0) - 4.5;
  p.x = p.x * uSpread + sin(uTime * 0.21 + aSeed * 6.283) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float blur = uDof * clamp(abs(-mv.z - uFocus) / 4.5, 0.0, 1.0);
  vBlur = blur;
  vSeed = aSeed;
  gl_PointSize = uSize * (0.6 + 0.8 * aSeed) * (1.0 + 1.8 * blur) * (10.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vBlur;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = abs(c.x) + abs(c.y);
  float edge = mix(0.06, 0.36, vBlur);
  float a = smoothstep(0.5, 0.5 - edge, d) * uOpacity * (1.0 - 0.65 * vBlur) * (0.55 + 0.45 * vSeed);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

/** A small LCG: the same field on every load, so screenshots compare. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface DustMotion {
  /** Seconds of world time. */
  time: number;
  /** Accumulated scroll lift (world units). */
  lift: number;
}

export function Dust(props: {
  count: number;
  dof: boolean;
  palette: Palette;
  motion: DustMotion;
  /** Read per frame: tier 1 hides the dust when no scene draws (its last frame stays clean). */
  visible: () => boolean;
}): React.JSX.Element | null {
  const { count, dof, palette, motion, visible } = props;
  const points = useRef<Points>(null);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    const random = seeded(7);
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      position[i * 3] = (random() - 0.5) * 9;
      position[i * 3 + 1] = (random() - 0.5) * 9;
      position[i * 3 + 2] = -1.2 + random() * 5;
      seed[i] = random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(position, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLift: { value: 0 },
          uSpread: { value: 1 },
          uSize: { value: 4 },
          uDof: { value: dof ? 1 : 0 },
          uFocus: { value: 9 },
          uColor: { value: new Color() },
          uOpacity: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [dof],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Through the Points ref: a frame and the effects write uniforms, never a hook's return value.
  const uniforms = (): Record<string, { value: number | Color }> | null =>
    (points.current?.material as ShaderMaterial | undefined)?.uniforms ?? null;
  useEffect(() => {
    const u = uniforms();
    if (u === null) return;
    (u.uColor?.value as Color).set(palette.dark ? '#5FD0C6' : '#0A243F');
    if (u.uOpacity) u.uOpacity.value = palette.dark ? 0.3 : 0.16;
  }, [palette, material]);
  useEffect(() => {
    const u = uniforms();
    if (u === null) return;
    // The field is about two viewports wide at 16:10; a phone gets the same density.
    if (u.uSpread) u.uSpread.value = Math.max(0.5, size.width / Math.max(1, size.height));
    // About 4 CSS px at the focus depth, whatever the DPR.
    if (u.uSize) u.uSize.value = 4 * dpr * (size.height / 900);
  }, [size, dpr, material]);

  useFrame(() => {
    const p = points.current;
    if (p === null) return;
    p.visible = visible();
    const u = (p.material as ShaderMaterial).uniforms;
    if (u.uTime) u.uTime.value = motion.time;
    if (u.uLift) u.uLift.value = motion.lift;
  });

  if (count <= 0) return null;
  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
