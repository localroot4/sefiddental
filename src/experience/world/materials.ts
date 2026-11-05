/**
 * The world's shared materials (docs/experience-direction.md section 6) and their two themes: the
 * glass-like teal mark, the diamonds as gems (navy in the light theme, silver on navy), the
 * porcelain relief (matte, soft shadows, a fine grain at tiers 2 and 3), the shadow catcher and
 * the glow halo (tier 3's light bloom). One set per canvas, owned by the World: scenes pass them
 * as props, so R3F never disposes them on a scene's unmount.
 */
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  ShaderMaterial,
  ShadowMaterial,
  SRGBColorSpace,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import { underWarmLayer, type WorldSettings } from './worldMath';

/** `bg-warm/12` of the DOM warm layer (src/components/home/WarmLayer.tsx). */
export const WARM_LAYER_ALPHA = 0.12;

export interface Palette {
  dark: boolean;
  /** `--color-surface`: the canvas background before scene 9. */
  surface: Color;
  /** Painted under the warm layer at full `--warm`, it composites to `--color-warm-soft`. */
  stage: Color;
}

const css = (style: CSSStyleDeclaration, name: string): string =>
  style.getPropertyValue(name).trim();

function srgb255(value: string): [number, number, number] {
  const c = new Color(value).getRGB({ r: 0, g: 0, b: 0 } as Color, SRGBColorSpace);
  return [c.r * 255, c.g * 255, c.b * 255];
}

/** Reads the theme tokens; `color-scheme` follows `data-theme` and the system preference. */
export function readPalette(root: HTMLElement): Palette {
  const style = getComputedStyle(root);
  const surface = css(style, '--color-surface') || '#F7F8F7';
  const stage = underWarmLayer(
    srgb255(css(style, '--color-warm-soft') || '#FBF1E6'),
    srgb255(css(style, '--color-warm') || '#E8AF76'),
    WARM_LAYER_ALPHA,
  );
  return {
    dark: style.colorScheme.includes('dark'),
    surface: new Color(surface),
    stage: new Color().setRGB(stage[0] / 255, stage[1] / 255, stage[2] / 255, SRGBColorSpace),
  };
}

const GRAIN_HEAD = /* glsl */ `
uniform float uGrainTime;
uniform float uGrainAmount;
float grainHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;
const GRAIN_TAIL = /* glsl */ `
  gl_FragColor.rgb += (grainHash(gl_FragCoord.xy + fract(uGrainTime * 0.37) * vec2(731.0, 419.0)) - 0.5) * uGrainAmount;
`;

/** One grain clock and strength for every grained material. */
export interface GrainUniforms {
  uGrainTime: { value: number };
  uGrainAmount: { value: number };
}

/** Fine film grain in screen space, inside the material only: the bare surface stays flat. */
function withGrain<M extends Material>(material: M, uniforms: GrainUniforms): M {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRAIN_HEAD}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${GRAIN_TAIL}`);
  };
  material.customProgramCacheKey = () => 'world-grain';
  return material;
}

const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`;

export interface WorldMaterials {
  glass: MeshPhysicalMaterial;
  gem: MeshPhysicalMaterial;
  porcelain: MeshStandardMaterial;
  shadow: ShadowMaterial;
  glow: ShaderMaterial;
  grain: GrainUniforms;
  all: readonly Material[];
}

export function createMaterials(world: WorldSettings): WorldMaterials {
  const grain: GrainUniforms = { uGrainTime: { value: 0 }, uGrainAmount: { value: 0.028 } };
  const grained = <M extends Material>(m: M): M => (world.grain ? withGrain(m, grain) : m);
  const glass = grained(
    new MeshPhysicalMaterial({
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ior: 1.45,
      transmission: world.transmission,
      thickness: 0.45,
      attenuationDistance: 0.9,
    }),
  );
  const gem = grained(
    new MeshPhysicalMaterial({ roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 }),
  );
  const porcelain = grained(new MeshStandardMaterial({ roughness: 0.74, metalness: 0 }));
  const shadow = new ShadowMaterial({ transparent: true });
  const glow = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0 } },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    toneMapped: false,
  });
  return { glass, gem, porcelain, shadow, glow, grain, all: [glass, gem, porcelain, shadow, glow] };
}

/** Both themes are first-class: the light porcelain space, or navy with teal glass. */
export function applyPalette(m: WorldMaterials, palette: Palette): void {
  const { dark } = palette;
  m.glass.color.set(dark ? '#0B8C82' : '#037D74');
  m.glass.emissive.set(dark ? '#0E6A63' : '#00655F');
  m.glass.emissiveIntensity = dark ? 0.3 : 0.1;
  m.glass.attenuationColor.set(dark ? '#0F5F59' : '#0B6E68');
  m.glass.envMapIntensity = dark ? 0.8 : 1.2;

  m.gem.color.set(dark ? '#D5DEE1' : '#0A243F');
  m.gem.metalness = dark ? 0.15 : 0.3;
  m.gem.envMapIntensity = dark ? 0.85 : 1.6;

  m.porcelain.color.set(dark ? '#061626' : '#F6F5F1');
  m.porcelain.envMapIntensity = dark ? 0.2 : 0.5;

  m.shadow.color.set(dark ? '#000000' : '#0A243F');
  m.shadow.opacity = dark ? 0.22 : 0.08;

  const glow = m.glow.uniforms as { uColor: { value: Color }; uOpacity: { value: number } };
  glow.uColor.value.set(dark ? '#2BB5AA' : '#2BB5AA');
  glow.uOpacity.value = dark ? 0.3 : 0.16;
  m.grain.uGrainAmount.value = dark ? 0.034 : 0.026;
}
