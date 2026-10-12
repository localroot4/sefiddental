# Brand assets in 3D

Three glTF binaries (Draco compressed) built from the clinic's own logo
geometry, plus the builder that made them. Everything here is modeled
in-house for this project and ships under the project license. The molar is
a stylized tooth, not anatomical data: do not use it for clinical
illustration.

| File | What it is | Triangles | Vertices | Bytes (Draco) | Bytes (raw glTF) |
|---|---|---|---|---|---|
| `mark.glb` | The teal mark (toothpaste on a brush head) as a beveled relief, 1 unit wide, 0.173 units deep, facing +z | 1,984 | 1,996 | 9,240 | 56,736 |
| `diamond.glb` | One square diamond from the wordmark as a rounded tile rotated 45 degrees, 1 unit across the vertical diagonal, 0.36 thick | 1,452 | 728 | 5,096 | 105,528 |
| `molar.glb` | Stylized molar: smoothed crown with four cusps, central fossa and two fissures, three tapered roots; crown 1.03 units wide, 1.44 tall, y up | 5,988 (5,880 after Draco drops degenerate ones) | 2,948 | 16,700 | 107,912 |

Total: 31,036 bytes for the three files. All three carry POSITION and NORMAL
only (no UVs, no textures): the materials are procedural, so a UV seam would
only cost bytes and shading seams. Each file has one mesh with a placeholder
`MeshStandardMaterial` named `porcelain` or `enamel`; the scenes replace it.

## How they were made

`build-brand-geometry.js` (ES module, imports `../../vendor/three.js`) is the
source of truth and is also the in-page fallback of the prototypes when a GLB
cannot be fetched.

- Mark: `SVGLoader` parses the inlined outline of `../logo-mark.svg`
  (`toShapes`), the outline is sampled with `curveSegments` 24 and then
  simplified with Ramer-Douglas-Peucker at 0.12% of the width (the traced
  path has about 130 tiny curves; sampling alone gave about 3,000 outline
  points and 80,000 triangles). `ExtrudeGeometry` with depth 12% of the
  width, bevel on (thickness 22% and size 16% of the depth, 6 segments).
  Flipped upright (`rotateX(PI)`, SVG y points down), centered, scaled to a
  width of 1, creased smooth normals (`toCreasedNormals`, crease 25.7
  degrees), `mergeVertices`. One `LoopSubdivision` pass was tested: it
  quadruples the triangles to 4,912 with no visible gain on the beveled
  relief, so the shipped file has no subdivision.
- Diamond: `RoundedBoxGeometry(0.707, 0.707, 0.36, 5, 0.09)` rotated 45
  degrees around z so a corner points up.
- Molar: `RoundedBoxGeometry(1.0, 0.72, 0.92, 2, 0.3)` smoothed with
  `LoopSubdivision` (2 iterations, `split: false`), then the top vertices are
  displaced by a smooth height field (four Gaussian cusps, a negative
  central fossa, two Gaussian fissures along x = 0 and z = 0) and the crown
  is tapered toward the gum with a soft height of contour. Roots are three
  `CapsuleGeometry` shells tapered to 22 to 30% at the tip, tilted
  outward, merged with `BufferGeometryUtils.mergeGeometries`, then
  `mergeVertices` and `computeVertexNormals`. The roots are separate shells
  inside the crown, not a boolean union; opaque or low-transmission
  materials hide the overlap.
- Export: the builders run in headless Chromium (Playwright with the
  SwiftShader GPU); `GLTFExporter` writes a binary glTF, then
  `gltf-transform draco` compresses it (default settings: edgebreaker,
  14-bit positions, 10-bit normals).

A morph target variant of the molar (`buildMolarGeometry({ morph: true })`,
target `refine` with the cusps scaled by 1.35) works but Draco must keep the
vertex order for morph targets and falls back to sequential encoding: 110 KB
instead of 17 KB. The VIP state of the turntable prototype therefore applies
the same cusp function in the vertex shader (`cuspHeightGLSL`).

## Loading

```js
const draco = new THREE.DRACOLoader().setDecoderPath('../vendor/draco/');
const loader = new THREE.GLTFLoader().setDRACOLoader(draco);
const { scene } = await loader.loadAsync('../brand/3d/mark.glb');
```

`design/vendor/draco/` holds the matching wasm decoder and wrapper; nothing
is fetched from a CDN. The three files decode in about 150 ms on the
software GPU, including the decoder start.
