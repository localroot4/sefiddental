/**
 * GPU disposal for objects R3F does not dispose itself (spec EXP 3.10, E10): anything shown
 * through `<primitive object={...} />`, for example a loaded glTF scene. Each geometry, material
 * and texture is disposed once, even when shared. The caller also clears the loader cache
 * (`useLoader.clear(GLTFLoader, url)`) so the cache does not keep the objects alive.
 */
import type { Object3D } from 'three';

interface Disposable {
  dispose(): void;
}

interface TextureLike extends Disposable {
  isTexture: true;
}

const isTexture = (value: unknown): value is TextureLike =>
  typeof value === 'object' &&
  value !== null &&
  (value as { isTexture?: unknown }).isTexture === true &&
  typeof (value as { dispose?: unknown }).dispose === 'function';

const isDisposable = (value: unknown): value is Disposable =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { dispose?: unknown }).dispose === 'function';

export interface DisposeCount {
  geometries: number;
  materials: number;
  textures: number;
}

/** Texture maps on a material, plus textures inside ShaderMaterial uniforms. */
function materialTextures(material: object): TextureLike[] {
  const found: TextureLike[] = [];
  for (const value of Object.values(material)) {
    if (isTexture(value)) found.push(value);
  }
  const uniforms = (material as { uniforms?: Record<string, { value?: unknown }> }).uniforms;
  if (uniforms && typeof uniforms === 'object') {
    for (const uniform of Object.values(uniforms)) {
      const value = uniform?.value;
      if (isTexture(value)) found.push(value);
      if (Array.isArray(value)) for (const item of value) if (isTexture(item)) found.push(item);
    }
  }
  return found;
}

export function disposeObject3D(root: Object3D): DisposeCount {
  const geometries = new Set<Disposable>();
  const materials = new Set<Disposable>();
  const textures = new Set<Disposable>();

  root.traverse((object) => {
    const { geometry, material } = object as { geometry?: unknown; material?: unknown };
    if (isDisposable(geometry)) geometries.add(geometry);
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of list) {
      if (!isDisposable(item)) continue;
      materials.add(item);
      for (const texture of materialTextures(item)) textures.add(texture);
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}
