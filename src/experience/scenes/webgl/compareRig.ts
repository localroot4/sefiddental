/**
 * Scene 6's slot scene (plain three.js, no React): the before and after photos of the compare
 * slider on one quad, split at the slider's divider with a soft displacement at the seam. At rest
 * the seam only breathes (a few tenths of a pixel at 448 px); a drag raises a wave that settles
 * after the handle stops. The rounded corners of the slider box are cut in the shader.
 */
import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
} from 'three';

import { disposeObject3D, type DisposeCount } from '../dispose';

import { wipeAmplitude, wipeEdge, WIPE_REST } from './math';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D tBefore;
  uniform sampler2D tAfter;
  uniform vec2 uBeforeScale;
  uniform vec2 uAfterScale;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uEdge;
  uniform float uAfterLeft;
  uniform float uAmp;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 px = vUv * uSize;
    float mask = 1.0 - smoothstep(-0.75, 0.75, roundedBox(px - uSize * 0.5, uSize * 0.5, uRadius));
    float wave = 0.6 * sin(vUv.y * 9.0 + uTime * 1.7) + 0.4 * sin(vUv.y * 23.0 - uTime * 2.3);
    float x = vUv.x - (uEdge + uAmp * wave);
    // The seam bends the photos toward it, as through the edge of a lens.
    float near = exp(-pow(x / 0.05, 2.0));
    vec2 uv = vUv;
    uv.x -= near * uAmp * 1.5 * sign(x);
    float aa = 0.75 / uSize.x;
    float after = uAfterLeft > 0.5 ? 1.0 - smoothstep(-aa, aa, x) : smoothstep(-aa, aa, x);
    vec3 b = texture2D(tBefore, (uv - 0.5) * uBeforeScale + 0.5).rgb;
    vec3 a = texture2D(tAfter, (uv - 0.5) * uAfterScale + 0.5).rgb;
    vec3 c = mix(b, a, after) + near * uAmp * 3.0;
    gl_FragColor = vec4(c, mask * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** UV scale that crops an image of aspect `image` to cover a box of aspect `box` (object-fit). */
export function coverScale(image: number, box: number): [number, number] {
  if (!(image > 0) || !(box > 0)) return [1, 1];
  return box > image ? [1, image / box] : [box / image, 1];
}

export interface WipeRig {
  scene: Scene;
  camera: OrthographicCamera;
  /**
   * The two photos as textures, as bitmaps decoded at their file size (flipped upright): an
   * `<img>` with a srcset reports its CSS size as `naturalWidth`, which three would allocate.
   */
  setImages(before: ImageBitmap, after: ImageBitmap): void;
  update(frame: {
    pos: number;
    rtl: boolean;
    dt: number;
    time: number;
    w: number;
    h: number;
    radius: number;
    opacity: number;
  }): void;
  dispose(): DisposeCount;
}

function imageTexture(image: ImageBitmap): Texture {
  const texture = new Texture(image);
  // WebGL ignores UNPACK_FLIP_Y for bitmaps: they come flipped from createImageBitmap.
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createWipeRig(): WipeRig {
  const scene = new Scene();
  const camera = new OrthographicCamera();
  const uniforms = {
    tBefore: { value: null as Texture | null },
    tAfter: { value: null as Texture | null },
    uBeforeScale: { value: new Vector2(1, 1) },
    uAfterScale: { value: new Vector2(1, 1) },
    uSize: { value: new Vector2(1, 1) },
    uRadius: { value: 0 },
    uEdge: { value: 0.5 },
    uAfterLeft: { value: 1 },
    uAmp: { value: WIPE_REST },
    uTime: { value: 0 },
    uOpacity: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);

  const release = (): void => {
    for (const uniform of [uniforms.tBefore, uniforms.tAfter]) {
      const texture = uniform.value;
      if (texture === null) continue;
      texture.dispose();
      (texture.image as ImageBitmap | null)?.close?.();
    }
  };
  let edge: number | null = null;
  let amp = WIPE_REST;
  const aspects = { before: 1, after: 1 };

  return {
    scene,
    camera,
    setImages(before, after) {
      release();
      uniforms.tBefore.value = imageTexture(before);
      uniforms.tAfter.value = imageTexture(after);
      aspects.before = before.width / before.height;
      aspects.after = after.width / after.height;
    },
    update({ pos, rtl, dt, time, w, h, radius, opacity }) {
      const next = wipeEdge(pos, rtl);
      const speed = edge === null || !(dt > 0) ? 0 : (next.edge - edge) / dt;
      edge = next.edge;
      amp = wipeAmplitude(amp, speed, dt);
      uniforms.uEdge.value = next.edge;
      uniforms.uAfterLeft.value = next.afterLeft ? 1 : 0;
      uniforms.uAmp.value = amp;
      uniforms.uTime.value = time;
      uniforms.uOpacity.value = opacity;
      uniforms.uSize.value.set(w, h);
      uniforms.uRadius.value = Math.min(radius, w / 2, h / 2);
      uniforms.uBeforeScale.value.set(...coverScale(aspects.before, w / h));
      uniforms.uAfterScale.value.set(...coverScale(aspects.after, w / h));
    },
    dispose() {
      release();
      return disposeObject3D(scene);
    },
  };
}
