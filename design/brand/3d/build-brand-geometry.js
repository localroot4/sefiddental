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
export const MARK_PATH_D = 'M990.5 333.7C990.4 333.5 990.4 333.4 990.6 333.4C990.7 333.5 990.8 333.3 990.8 333.2C990.8 333.0 990.7 332.9 990.6 332.9C990.4 333.0 990.3 332.7 990.3 332.2C990.2 318.1 990.4 164.2 990.5 163.1C991.1 157.8 993.6 150.9 996.4 146.7C996.9 145.9 997.3 145.2 997.3 145.1C997.3 145.0 998.0 144.0 998.9 142.9C1000.9 140.3 1004.6 136.6 1007.0 135.1C1010.4 132.7 1011.0 132.3 1013.1 131.3C1014.2 130.7 1015.4 130.1 1015.7 130.0C1018.0 128.8 1023.4 127.5 1027.7 127.0C1032.4 126.5 1083.2 126.5 1083.5 127.1C1083.7 127.3 1083.6 127.3 1083.4 127.2C1082.9 126.9 1081.8 127.9 1082.1 128.3C1082.3 128.4 1082.5 128.3 1082.7 128.0C1082.9 127.7 1083.0 127.6 1083.0 127.8C1083.0 128.0 1078.6 135.6 1077.7 137.0C1077.5 137.3 1077.1 137.9 1076.9 138.3C1076.5 139.1 1074.3 142.9 1073.7 144.0C1073.5 144.3 1072.9 145.2 1072.5 146.2C1072.0 147.1 1071.3 148.2 1071.0 148.7C1070.7 149.1 1069.9 150.3 1069.4 151.3C1068.0 153.6 1065.7 157.7 1065.3 158.3C1062.4 163.3 1059.5 168.3 1058.7 169.8C1058.1 170.9 1057.2 172.5 1056.6 173.3C1056.1 174.1 1055.7 174.9 1055.7 175.2C1055.7 175.4 1055.5 175.7 1055.4 175.7C1055.2 175.7 1054.9 176.1 1054.7 176.6C1054.5 177.1 1053.4 179.0 1052.3 180.8C1049.6 185.4 1049.6 185.3 1048.4 187.2C1046.6 190.0 1045.9 192.2 1047.0 191.5C1047.3 191.3 1057.9 177.3 1060.2 174.0C1060.9 173.0 1062.0 171.4 1062.7 170.5C1064.5 168.3 1070.2 160.7 1071.7 158.5C1073.2 156.4 1078.3 149.6 1082.2 144.5C1085.5 140.1 1089.6 136.0 1092.9 133.9C1095.6 132.1 1101.1 129.4 1102.6 129.1C1103.2 129.0 1103.8 128.8 1103.9 128.6C1104.0 128.5 1104.4 128.3 1104.8 128.3C1105.2 128.3 1106.2 128.1 1107.0 127.8C1110.4 126.6 1121.5 126.6 1125.8 127.8C1130.6 129.1 1131.8 129.6 1134.7 131.0C1136.4 131.9 1138.8 133.2 1140.0 134.0C1141.1 134.8 1142.4 135.7 1142.8 135.9C1143.2 136.1 1144.8 137.7 1146.4 139.4C1150.8 144.0 1153.8 148.8 1155.8 154.5C1156.5 156.3 1157.0 158.2 1157.0 158.7C1157.0 159.2 1157.1 159.7 1157.3 159.8C1158.2 160.9 1158.3 169.9 1158.3 250.8C1158.3 332.5 1158.3 333.3 1157.7 333.7C1157.2 333.9 1152.7 334.0 1143.8 333.9C1131.6 333.8 1130.3 333.7 1128.3 333.1C1123.3 331.5 1118.4 328.0 1115.4 323.8C1114.9 323.0 1113.5 321.2 1112.3 319.6C1111.2 318.1 1107.1 312.7 1103.3 307.7C1099.6 302.6 1096.2 298.1 1095.8 297.6C1095.5 297.1 1094.1 295.3 1092.8 293.6C1091.5 291.9 1090.3 290.2 1090.0 289.8C1089.7 289.4 1087.8 286.9 1085.7 284.2C1081.0 277.9 1080.0 276.5 1080.0 275.8C1080.0 275.4 1080.5 274.4 1081.2 273.4C1081.8 272.4 1082.3 271.6 1082.3 271.5C1082.3 271.4 1083.2 270.0 1084.2 268.3C1085.2 266.6 1086.2 264.9 1086.3 264.7C1086.5 264.1 1089.0 259.9 1090.7 257.2C1091.2 256.5 1092.0 255.1 1092.5 254.1C1092.9 253.2 1093.9 251.5 1094.6 250.4C1095.3 249.4 1096.8 247.0 1097.9 245.1C1098.9 243.2 1100.1 241.2 1100.4 240.7C1100.7 240.2 1101.2 239.5 1101.4 239.0C1103.4 235.6 1108.2 227.3 1108.7 226.6C1109.1 226.1 1109.3 225.6 1109.3 225.5C1109.3 225.4 1109.7 224.7 1110.2 223.9C1111.7 221.6 1111.8 221.5 1112.8 219.6C1114.3 217.0 1114.4 216.7 1113.8 216.7C1113.4 216.7 1111.3 219.2 1107.8 224.0C1107.4 224.6 1106.2 226.1 1105.3 227.3C1104.4 228.5 1103.4 229.8 1103.1 230.2C1102.2 231.5 1098.5 236.4 1097.3 238.0C1096.7 238.9 1095.2 240.8 1094.1 242.4C1092.9 243.9 1091.6 245.6 1091.2 246.1C1090.8 246.7 1090.2 247.5 1089.8 248.0C1089.4 248.4 1088.7 249.5 1088.1 250.2C1087.6 251.0 1086.3 252.8 1085.2 254.2C1082.6 257.6 1081.9 258.6 1080.8 260.1C1080.4 260.8 1079.7 261.6 1079.4 261.9C1079.1 262.3 1078.4 263.1 1077.9 263.8C1077.5 264.6 1076.8 265.5 1076.5 265.8C1075.7 266.9 1074.2 268.8 1073.5 269.8C1071.9 272.1 1067.6 277.8 1067.1 278.3C1066.6 278.9 1062.3 284.7 1060.0 287.8C1059.2 289.0 1057.6 291.1 1056.5 292.5C1055.4 293.8 1053.9 295.8 1053.2 296.9C1052.4 297.9 1051.1 299.6 1050.3 300.6C1049.5 301.6 1048.4 303.1 1047.9 303.8C1047.3 304.9 1044.9 308.1 1043.4 309.8C1043.2 310.0 1042.5 311.0 1041.8 312.0C1041.1 313.0 1039.9 314.6 1039.2 315.6C1037.0 318.4 1036.2 319.3 1035.2 320.8C1031.9 325.4 1030.1 327.4 1027.6 329.3C1025.4 330.9 1024.3 331.5 1020.8 332.8L1018.2 333.8L1004.4 333.9C995.2 334.0 990.6 333.9 990.5 333.7Z';
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
    bevelSegments = 6,
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
    bevelThickness: depth * 0.22,
    bevelSize: depth * 0.16,
    bevelOffset: 0,
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
