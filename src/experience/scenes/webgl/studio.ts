/**
 * The light set of the molar slots (scenes 4 and 5), private to each slot scene: a key light that
 * can drift from cool to warm, a cool rim, a sky fill, a soft contact shadow under the tooth, and
 * an optional room environment for the clearcoat reflections. The contact shadow is a radial
 * blob, not a shadow map: the tooth floats on its turntable, and the blob costs one quad at every
 * tier (the storyboard's hard shadow at tier 2 would cost a depth pass for the same picture).
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  ShaderMaterial,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Studio {
  group: Group;
  shadow: Mesh;
  setTheme(dark: boolean): void;
  /** 0 the cool scan light, 1 the warm smile light (scene 5); scene 4 keeps 0.35. */
  setWarm(warm: number): void;
}

const COOL = new Color('#EEF4F8');
const WARM = new Color('#FFD4A6');

export function createStudio(): Studio {
  const group = new Group();
  const key = new DirectionalLight('#FFF6EC', 1.4);
  key.position.set(2.4, 3.2, 3.4);
  const rim = new DirectionalLight('#DCE8F0', 1.1);
  rim.position.set(-2.8, 1.4, -2.2);
  const fill = new HemisphereLight('#E4EEF4', '#E8D8C8', 0.9);
  group.add(key, key.target, rim, fill);

  const shadowMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new Color('#0A243F') }, uOpacity: { value: 0.22 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.0, 1.0, d)) * uOpacity;
        gl_FragColor = vec4(uColor, a * a * 1.6);
      }`,
  });
  const shadow = new Mesh(new PlaneGeometry(1.7, 1.7), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  group.add(shadow);

  let dark = false;
  let warm = 0;
  const apply = (): void => {
    // ACES maps the off-white enamel to white early: lights kept low so the levels' tints read.
    const base = dark ? 1.05 : 1.4;
    key.color.copy(COOL).lerp(WARM, warm);
    key.intensity = base * (1 + 0.25 * warm);
    rim.intensity = dark ? 1.1 : 0.7;
    rim.color.set(dark ? '#7FD3CB' : '#DCE8F0');
    fill.color.set(dark ? '#29506B' : '#E4EEF4');
    fill.groundColor.set(dark ? '#0F3B3A' : '#E8D8C8');
    fill.intensity = dark ? 0.5 : 0.55;
    shadowMaterial.uniforms.uColor!.value.set(dark ? '#000000' : '#0A243F');
    shadowMaterial.uniforms.uOpacity!.value = dark ? 0.5 : 0.24;
  };
  apply();

  return {
    group,
    shadow,
    setTheme(next) {
      dark = next;
      apply();
    },
    setWarm(next) {
      if (next === warm) return;
      warm = next;
      apply();
    },
  };
}

/** A prefiltered room environment for the clearcoat (tiers 2 and 3); render target, so a lost
 * context empties it: the caller builds it again on `webglcontextrestored`. */
export function createRoomEnvironment(gl: WebGLRenderer): { texture: Texture; dispose(): void } {
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  pmrem.dispose();
  room.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}
