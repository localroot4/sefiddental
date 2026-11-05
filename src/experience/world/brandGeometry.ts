/**
 * The brand models of the world (design/brand/3d, Draco glTF): one geometry per file, shared by
 * the scenes that show it and disposed when the last one lets go (spec EXP 3.10, "disposal far
 * out of view"). The Draco worker is a same-origin file (scripts/draco-worker.mjs: the page CSP
 * allows no blob: worker) and is terminated whenever no model is decoding.
 */
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { DRACO_FILES } from './assets';

interface Entry {
  promise: Promise<BufferGeometry>;
  /** Identity of this load: a release to zero and a new acquire make a new one. */
  slot: { geometry: BufferGeometry | null; refs: number };
}

export interface GeometryCache {
  /** Resolves the shared geometry; every acquire needs one release. */
  acquire(url: string): Promise<BufferGeometry>;
  /** At zero references the geometry is disposed, now or as soon as it arrives. */
  release(url: string): void;
  /** Files with at least one reference (tests, the debug overlay). */
  size(): number;
}

export function createGeometryCache(load: (url: string) => Promise<BufferGeometry>): GeometryCache {
  const entries = new Map<string, Entry>();
  return {
    acquire(url) {
      const found = entries.get(url);
      if (found) {
        found.slot.refs += 1;
        return found.promise;
      }
      const slot: Entry['slot'] = { geometry: null, refs: 1 };
      const promise = load(url).then(
        (geometry) => {
          if (entries.get(url)?.slot === slot) slot.geometry = geometry;
          else geometry.dispose();
          return geometry;
        },
        (error: unknown) => {
          if (entries.get(url)?.slot === slot) entries.delete(url);
          throw error;
        },
      );
      entries.set(url, { promise, slot });
      return promise;
    },
    release(url) {
      const entry = entries.get(url);
      if (!entry) return;
      entry.slot.refs -= 1;
      if (entry.slot.refs > 0) return;
      entries.delete(url);
      entry.slot.geometry?.dispose();
    },
    size: () => entries.size,
  };
}

interface DracoInternals {
  decoderPaths: { js: string; wasm: string };
  decoderConfig: { wasmBinary?: ArrayBuffer };
  decoderPending: Promise<void> | null;
  workerSourceURL: string;
  _loadLibrary(url: string, responseType: 'arraybuffer'): Promise<ArrayBuffer>;
}

/** DRACOLoader with a worker file instead of the blob: URL three builds (CSP worker-src 'self'). */
class SameOriginDracoLoader extends DRACOLoader {
  _initDecoder(): Promise<void> {
    const self = this as unknown as DracoInternals;
    self.decoderPending ??= self
      ._loadLibrary(self.decoderPaths.wasm, 'arraybuffer')
      .then((wasm) => {
        self.decoderConfig.wasmBinary = wasm;
        self.workerSourceURL = self.decoderPaths.js;
      });
    return self.decoderPending;
  }
}

let loaders: { gltf: GLTFLoader; draco: DRACOLoader } | null = null;
let decoding = 0;

function gltfLoader(): { gltf: GLTFLoader; draco: DRACOLoader } {
  if (loaders === null) {
    const draco = new SameOriginDracoLoader()
      .setDecoderPath({ js: DRACO_FILES.worker, wasm: DRACO_FILES.wasm })
      .setWorkerLimit(1);
    loaders = { gltf: new GLTFLoader().setDRACOLoader(draco), draco };
  }
  return loaders;
}

/** The first mesh's geometry; the file's placeholder material is disposed (the scenes own theirs). */
async function loadGeometry(url: string): Promise<BufferGeometry> {
  const { gltf, draco } = gltfLoader();
  decoding += 1;
  try {
    const { scene } = await gltf.loadAsync(url);
    let geometry: BufferGeometry | null = null;
    scene.traverse((object: Object3D) => {
      const mesh = object as Mesh;
      if (mesh.isMesh !== true) return;
      geometry ??= mesh.geometry;
      for (const material of ([] as Material[]).concat(mesh.material)) material.dispose();
    });
    if (geometry === null) throw new Error(`[world] ${url} holds no mesh.`);
    return geometry;
  } finally {
    decoding -= 1;
    // The worker holds the wasm heap; a later scene starts a new one from the cached files.
    if (decoding === 0) draco.dispose();
  }
}

export const brandGeometry: GeometryCache = createGeometryCache(loadGeometry);
