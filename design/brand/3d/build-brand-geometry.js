// Brand geometry builders for the Sefid Dental 3D assets.
// Source of truth for design/brand/3d/mark.glb, diamond.glb and molar.glb.
// The export page runs these in a browser and writes the GLB files; the
// prototypes import this module as the in-page fallback when a GLB cannot
// be fetched. All geometry is unit-scaled: the mark is 1 unit wide, the
// diamond 1 unit across its vertical diagonal, the molar crown 1 unit wide.
// The molar is stylized and modeled in-house (not anatomical data).
import * as THREE from '../../vendor/three.js';

// Outline of design/brand/logo-mark.svg (viewBox 982.3 119.0 184.0 222.9), inlined so the
// builder needs no fetch.
export const MARK_PATH_D = 'M990.3 333.9L990.3 168.6A42 42 0 0 1 1032.3 126.6L1083.8 126.6L1046.44 190.35A0.6 0.6 0 0 0 1047.44 191.01L1083.45 143A41 41 0 0 1 1116.25 126.6L1116.3 126.6A42 42 0 0 1 1158.3 168.6L1158.3 333.9L1134.52 333.9A23 23 0 0 1 1116.12 324.7L1080.24 276.86A1.5 1.5 0 0 1 1080.15 275.2L1113.21 218.79A0.6 0.6 0 0 0 1112.21 218.12L1032.28 324.7A23 23 0 0 1 1013.88 333.9Z';
export const MARK_VIEWBOX = '982.3 119.0 184.0 222.9';

const { BufferGeometryUtils, LoopSubdivision } = THREE;

// Ramer-Douglas-Peucker outline simplification (keeps corners, drops wiggles).
export function simplifyOutline(points, tolerance) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = points[a].x, ay = points[a].y, bx = points[b].x, by = points[b].y;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, bestD = tolerance;
    for (let i = a + 1; i < b; i++) {
      const p = points[i];
      const dist = len === 1 && dx === 0 && dy === 0
        ? Math.hypot(p.x - ax, p.y - ay)
        : Math.abs(dy * p.x - dx * p.y + bx * ay - by * ax) / len;
      if (dist > bestD) { bestD = dist; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function shapeFromPoints(outline, holes) {
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, p.y))));
  return shape;
}

// The teal mark as a beveled relief. Returns an indexed geometry with creased
// smooth normals, centered, 1 unit wide, facing +z.
export function buildMarkGeometry(options = {}) {
  const {
    depthRatio = 0.12,     // extrusion depth as a fraction of the mark width
    bevelSegments = 8,
    curveSegments = 24,
    tolerance = 0.0012,    // outline simplification, fraction of the width
    creaseAngle = Math.PI / 7,
    subdivide = 0,         // LoopSubdivision iterations (0 = off)
  } = options;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + MARK_VIEWBOX + '"><path d="' + MARK_PATH_D + '"/></svg>';
  const data = new THREE.SVGLoader().parse(svg);
  const shapes = data.paths[0].toShapes(true);
  // Measure the width in SVG units first.
  const box = new THREE.Box2();
  for (const s of shapes) for (const p of s.extractPoints(curveSegments).shape) box.expandByPoint(p);
  const width = box.max.x - box.min.x;
  const tol = tolerance * width;
  const rebuilt = shapes.map((s) => {
    const pts = s.extractPoints(curveSegments);
    return shapeFromPoints(simplifyOutline(pts.shape, tol), pts.holes.map((h) => simplifyOutline(h, tol)));
  });
  const depth = depthRatio * width;
  let geom = new THREE.ExtrudeGeometry(rebuilt, {
    depth,
    bevelEnabled: true,
    // A soft, rounded edge that grows inward (bevelOffset = -bevelSize): the silhouette stays the
    // logo's own outline, so the slits keep their width in 3D.
    bevelThickness: depth * 0.3,
    bevelSize: depth * 0.22,
    bevelOffset: -depth * 0.22,
    bevelSegments,
    curveSegments,
    steps: 1,
  });
  geom.deleteAttribute('uv');
  geom.rotateX(Math.PI); // SVG y points down; keep the mark upright and not mirrored
  geom.center();
  geom.scale(1 / width, 1 / width, 1 / width);
  if (subdivide > 0) {
    const merged = BufferGeometryUtils.mergeVertices(geom, 1e-5);
    geom = LoopSubdivision.modify(merged, subdivide, { split: false, preserveEdges: false, uvSmooth: false });
    geom.deleteAttribute('uv');
  }
  geom = BufferGeometryUtils.toCreasedNormals(geom, creaseAngle);
  geom = BufferGeometryUtils.mergeVertices(geom, 1e-5);
  geom.computeBoundingBox();
  geom.name = 'sefid-mark';
  return geom;
}

// One square diamond from the wordmark: a rounded tile rotated 45 degrees so
// a corner points up. 1 unit across the vertical diagonal.
export function buildDiamondGeometry(options = {}) {
  const { thickness = 0.36, radius = 0.09, segments = 5 } = options;
  const side = Math.SQRT1_2; // square side for a 1 unit diagonal
  const g = new THREE.RoundedBoxGeometry(side, side, thickness, segments, radius);
  g.deleteAttribute('uv');
  g.rotateZ(Math.PI / 4);
  g.computeBoundingBox();
  g.name = 'sefid-diamond';
  return g;
}

// Stylized molar: a smoothed rounded crown with four cusps, a central fossa
// and two fissures, over three tapered roots. Crown width 1 unit, y up.
// With { morph: true } the geometry also carries a morph target ('refine')
// that scales the cusps up. The shipped molar.glb has no morph target: Draco
// must keep vertex order for morph targets and falls back to sequential
// encoding, which made the file 110 KB instead of about 20 KB. The VIP state
// in the turntable prototype applies the same cusp function in the vertex
// shader instead (see cuspHeightGLSL below).
// RoundedBoxGeometry uses (segments * 2 + 1) divisions per face: 2 gives 300
// triangles, 4800 after two Loop subdivisions.
const CROWN = { w: 1.0, h: 0.72, d: 0.92, radius: 0.3, segments: 2 };

function cuspHeight(x, z, amp) {
  const s = 0.17, s2 = s * s;
  const centers = [[-0.25, -0.21], [0.25, -0.21], [-0.25, 0.23], [0.25, 0.23]];
  let h = 0;
  for (const [cx, cz] of centers) h += amp * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / s2);
  h -= 0.45 * amp * Math.exp(-(x * x + z * z) / 0.028);            // central fossa
  const gw = 0.0022;                                                 // fissures
  h -= 0.5 * amp * Math.exp(-(x * x) / gw) * Math.exp(-(z * z) / 0.3);
  h -= 0.4 * amp * Math.exp(-(z * z) / gw) * Math.exp(-(x * x) / 0.3);
  return h;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function displaceCrown(positions, amp) {
  const out = new Float32Array(positions.length);
  const half = CROWN.h / 2;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    // cervical taper: narrower toward the gum, a soft height of contour above
    const down = Math.max(0, -y / half);
    const contour = 1 + 0.035 * Math.sin(Math.PI * (y + half) / (2 * half)) ** 2 - 0.16 * down ** 1.6;
    const top = smoothstep(0.08, half * 0.92, y);
    out[i] = x * contour;
    out[i + 1] = y + top * cuspHeight(x, z, amp);
    out[i + 2] = z * contour;
  }
  return out;
}

function taperedRoot({ radius, length, taper, x, z, tiltX, tiltZ, topY }) {
  const g = new THREE.CapsuleGeometry(radius, length, 5, 18);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const pos = g.attributes.position;
  const total = length + 2 * radius;
  const yTop = length / 2 + radius;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.min(1, Math.max(0, (yTop - y) / total));
    const s = 1 - (1 - taper) * Math.pow(t, 0.9);
    pos.setXYZ(i, pos.getX(i) * s, y, pos.getZ(i) * s);
  }
  g.translate(0, -yTop, 0);          // top of the root at the origin
  g.rotateX(tiltX); g.rotateZ(tiltZ);
  g.translate(x, topY, z);
  return g.toNonIndexed();
}

export const MOLAR_CUSP_AMP = 0.075;
export const MOLAR_CROWN_HALF_HEIGHT = CROWN.h / 2;

// GLSL twin of cuspHeight() for the shader-driven refine state. Takes the
// object-space x and z of the plain crown and returns the extra height for
// amplitude 'amp'. Keep in sync with cuspHeight().
export const cuspHeightGLSL = `
float sefidCuspHeight(float x, float z, float amp) {
  const float s2 = 0.17 * 0.17;
  float h = 0.0;
  h += amp * exp(-((x + 0.25) * (x + 0.25) + (z + 0.21) * (z + 0.21)) / s2);
  h += amp * exp(-((x - 0.25) * (x - 0.25) + (z + 0.21) * (z + 0.21)) / s2);
  h += amp * exp(-((x + 0.25) * (x + 0.25) + (z - 0.23) * (z - 0.23)) / s2);
  h += amp * exp(-((x - 0.25) * (x - 0.25) + (z - 0.23) * (z - 0.23)) / s2);
  h -= 0.45 * amp * exp(-(x * x + z * z) / 0.028);
  const float gw = 0.0022;
  h -= 0.5 * amp * exp(-(x * x) / gw) * exp(-(z * z) / 0.3);
  h -= 0.4 * amp * exp(-(z * z) / gw) * exp(-(x * x) / 0.3);
  return h;
}
`;

export function buildMolarGeometry(options = {}) {
  const { cuspAmp = MOLAR_CUSP_AMP, refineScale = 1.35, subdivisions = 2, morph = false } = options;
  let crown = new THREE.RoundedBoxGeometry(CROWN.w, CROWN.h, CROWN.d, CROWN.segments, CROWN.radius);
  crown.deleteAttribute('uv'); crown.deleteAttribute('normal');
  crown = LoopSubdivision.modify(crown, subdivisions, { split: false, preserveEdges: false, uvSmooth: false });
  crown.deleteAttribute('uv'); crown.deleteAttribute('normal');
  if (crown.index) crown = crown.toNonIndexed();
  const base = crown.attributes.position.array;
  const plain = displaceCrown(base, cuspAmp);
  crown.setAttribute('position', new THREE.BufferAttribute(plain, 3));
  if (morph) {
    const refined = displaceCrown(base, cuspAmp * refineScale);
    crown.morphAttributes.position = [new THREE.BufferAttribute(refined, 3)];
  }

  const topY = -CROWN.h / 2 + 0.16;
  const roots = [
    taperedRoot({ radius: 0.2, length: 0.36, taper: 0.3, x: -0.21, z: 0.18, tiltX: -0.1, tiltZ: 0.12, topY }),
    taperedRoot({ radius: 0.2, length: 0.36, taper: 0.3, x: 0.21, z: 0.18, tiltX: -0.1, tiltZ: -0.12, topY }),
    taperedRoot({ radius: 0.22, length: 0.4, taper: 0.28, x: 0.0, z: -0.22, tiltX: 0.14, tiltZ: 0, topY }),
  ];
  if (morph) {
    for (const r of roots) {
      const n = r.attributes.position.count * 3;
      r.morphAttributes.position = [new THREE.BufferAttribute(r.attributes.position.array.slice(0, n), 3)];
    }
  }
  let geom = BufferGeometryUtils.mergeGeometries([crown, ...roots], false);
  geom = BufferGeometryUtils.mergeVertices(geom, 1e-5);
  geom.computeVertexNormals();
  if (morph) {
    const tmp = new THREE.BufferGeometry();
    tmp.setIndex(geom.index);
    tmp.setAttribute('position', geom.morphAttributes.position[0]);
    tmp.computeVertexNormals();
    geom.morphAttributes.normal = [tmp.attributes.normal];
    geom.morphTargetsRelative = false;
    geom.userData.morphTargetNames = ['refine'];
  }
  geom.computeBoundingBox();
  geom.name = 'sefid-molar';
  return geom;
}

export function triangleCount(geometry) {
  return Math.round((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3);
}
