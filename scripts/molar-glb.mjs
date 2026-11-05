// The molar the home scenes load (phase 8, scenes 4 and 5): design/brand/3d/molar.glb decoded
// from Draco at build time into a plain glTF binary. Motivation: decoding Draco in the browser
// needs a blob worker and WebAssembly, which the page CSP does not allow (worker-src 'self', no
// 'wasm-unsafe-eval'), and the decoder (draco_decoder.wasm and its wrapper, about 75 KB gzipped)
// outweighs the saving on one 17 KB model. The output keeps float positions and uint16 indices
// and stores normals as normalized int8 (KHR_mesh_quantization, read by GLTFLoader): 83 KB raw,
// about 55 KB gzipped. The decoder is three's own asm.js build, run once in Node.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const BYTE = 5120;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** The JSON and BIN chunks of a glTF binary; throws on anything else. */
export function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC || buffer.readUInt32LE(4) !== 2) {
    throw new Error('molar-glb: not a glTF 2.0 binary');
  }
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== CHUNK_JSON) throw new Error('molar-glb: first chunk is not JSON');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const binAt = 20 + jsonLength;
  if (buffer.readUInt32LE(binAt + 4) !== CHUNK_BIN) throw new Error('molar-glb: no BIN chunk');
  const bin = buffer.subarray(binAt + 8, binAt + 8 + buffer.readUInt32LE(binAt));
  return { json, bin };
}

/** three's Draco decoder module (asm.js, the same build DRACOLoader ships). */
async function dracoModule(root) {
  const file = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js');
  const source = readFileSync(file, 'utf8');
  const cjs = { exports: {} };
  // The emscripten wrapper is CommonJS inside an ESM package: run it with its own module scope.
  new Function('module', 'exports', 'require', '__dirname', source)(
    cjs,
    cjs.exports,
    createRequire(file),
    path.dirname(file),
  );
  return cjs.exports();
}

/** Positions, normals (float, xyz) and triangle indices of the first Draco primitive. */
export async function decodeDracoMolar(buffer, root) {
  const { json, bin } = readGlb(buffer);
  const primitive = json.meshes?.[0]?.primitives?.[0];
  const ext = primitive?.extensions?.KHR_draco_mesh_compression;
  if (!ext) throw new Error('molar-glb: the first primitive is not Draco compressed');
  const view = json.bufferViews[ext.bufferView];
  const bytes = new Int8Array(bin.buffer, bin.byteOffset + (view.byteOffset ?? 0), view.byteLength);

  const draco = await dracoModule(root);
  const decoder = new draco.Decoder();
  const mesh = new draco.Mesh();
  try {
    const status = decoder.DecodeArrayToMesh(bytes, bytes.byteLength, mesh);
    if (!status.ok() || mesh.ptr === 0) {
      throw new Error(`molar-glb: Draco decoding failed: ${status.error_msg()}`);
    }
    const attribute = (id) => {
      const attr = decoder.GetAttributeByUniqueId(mesh, id);
      const length = mesh.num_points() * attr.num_components();
      const ptr = draco._malloc(length * 4);
      decoder.GetAttributeDataArrayForAllPoints(mesh, attr, draco.DT_FLOAT32, length * 4, ptr);
      const out = new Float32Array(draco.HEAPF32.buffer, ptr, length).slice();
      draco._free(ptr);
      return out;
    };
    const positions = attribute(ext.attributes.POSITION);
    const normals = attribute(ext.attributes.NORMAL);
    const count = mesh.num_faces() * 3;
    const ptr = draco._malloc(count * 4);
    decoder.GetTrianglesUInt32Array(mesh, count * 4, ptr);
    const indices = new Uint32Array(draco.HEAPF32.buffer, ptr, count).slice();
    draco._free(ptr);
    return { positions, normals, indices, name: json.nodes?.[0]?.name ?? 'molar' };
  } finally {
    draco.destroy(mesh);
    draco.destroy(decoder);
  }
}

const pad4 = (n) => Math.ceil(n / 4) * 4;

/** A glTF binary with float positions, int8 normals (stride 4) and uint16 indices. */
export function writeQuantizedGlb({ positions, normals, indices, name }) {
  const vertices = positions.length / 3;
  if (vertices > 0xffff) throw new Error('molar-glb: too many vertices for uint16 indices');
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 1) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const normal8 = new Int8Array(vertices * 4);
  for (let v = 0; v < vertices; v += 1) {
    for (let c = 0; c < 3; c += 1) {
      normal8[v * 4 + c] = Math.max(-127, Math.min(127, Math.round(normals[v * 3 + c] * 127)));
    }
  }
  const index16 = Uint16Array.from(indices);
  const parts = [
    Buffer.from(positions.buffer),
    Buffer.from(normal8.buffer),
    Buffer.from(index16.buffer),
  ];
  const offsets = [];
  let length = 0;
  for (const part of parts) {
    offsets.push(length);
    length = pad4(length + part.length);
  }
  const bin = Buffer.alloc(length);
  parts.forEach((part, i) => part.copy(bin, offsets[i]));

  const json = {
    asset: { version: '2.0', generator: 'sefid scripts/molar-glb.mjs' },
    extensionsUsed: ['KHR_mesh_quantization'],
    extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, mode: 4 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: parts[0].length, target: ARRAY_BUFFER },
      {
        buffer: 0,
        byteOffset: offsets[1],
        byteLength: parts[1].length,
        byteStride: 4,
        target: ARRAY_BUFFER,
      },
      {
        buffer: 0,
        byteOffset: offsets[2],
        byteLength: parts[2].length,
        target: ELEMENT_ARRAY_BUFFER,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: FLOAT, count: vertices, type: 'VEC3', min, max },
      { bufferView: 1, componentType: BYTE, normalized: true, count: vertices, type: 'VEC3' },
      { bufferView: 2, componentType: UNSIGNED_SHORT, count: index16.length, type: 'SCALAR' },
    ],
  };
  const text = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonChunk = Buffer.alloc(pad4(text.length), 0x20);
  text.copy(jsonChunk);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(body.length, 0);
    head.writeUInt32LE(type, 4);
    return [head, body];
  };
  return Buffer.concat([header, ...chunk(CHUNK_JSON, jsonChunk), ...chunk(CHUNK_BIN, bin)]);
}

/** design/brand/3d/molar.glb as the plain glTF binary the scenes load. */
export async function buildMolarGlb(root) {
  const source = readFileSync(path.join(root, 'design/brand/3d/molar.glb'));
  return writeQuantizedGlb(await decodeDracoMolar(source, root));
}
