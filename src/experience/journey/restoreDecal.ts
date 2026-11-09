/**
 * The restoration on the WebGL tooth's chewing surface at D3 (restore.ts plays it): the shapes of
 * the tier-1 top view (JourneyLayer.tsx, its 100-unit box) as flat meshes lying on the crown, drawn
 * over the enamel (no depth test: at D3 the tooth shows its chewing surface to the reader). Strokes
 * are ribbons, so they keep their width at any size and draw by their draw range.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
} from 'three';

import type { RestoreParts } from './restore';

/** The cavity, as the top view's `ct-fill` path (100-unit box, y down). */
const CAVITY: [number, number, number, number][] = [
  [50, 34, 62, 40],
  [68, 50, 62, 60],
  [50, 66, 38, 60],
  [32, 50, 38, 40],
];
/** The inlay's and the CIP layers' outline (`ct-inlay`). */
const INLAY = [
  [37, 39],
  [50, 34],
  [63, 39],
  [66, 50],
  [63, 61],
  [50, 66],
  [37, 61],
  [34, 50],
] as const;

/** Top-view units to shape units: x right, y up, centred on the box's middle. */
const v = (x: number, y: number): Vector2 => new Vector2(x - 50, 50 - y);

function cavity(): Shape {
  const s = new Shape();
  s.moveTo(38 - 50, 50 - 40);
  for (const [cx, cy, x, y] of CAVITY) s.quadraticCurveTo(cx - 50, 50 - cy, x - 50, 50 - y);
  return s;
}

function polygon(points: readonly (readonly [number, number])[]): Shape {
  return new Shape(points.map(([x, y]) => v(x, y)));
}

/** A ribbon `width` units wide along `points`: two triangles a segment, drawn by draw range. */
function ribbon(points: Vector2[], width: number): BufferGeometry {
  const pos: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = new Vector2(a.y - b.y, b.x - a.x).normalize().multiplyScalar(width / 2);
    const quad = [a.clone().add(n), a.clone().sub(n), b.clone().add(n), b.clone().sub(n)];
    for (const k of [0, 1, 2, 2, 1, 3]) pos.push(quad[k]!.x, quad[k]!.y, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/** The stain's three strokes (`ct-stain`), as one polyline per stroke in drawing order. */
function stainStrokes(): Vector2[][] {
  const curve = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
    const s = new Shape();
    s.moveTo(x0 - 50, 50 - y0);
    s.quadraticCurveTo(cx - 50, 50 - cy, x1 - 50, 50 - y1);
    return s.getPoints(12);
  };
  return [curve(44, 44, 50, 48, 56, 44), [v(50, 44), v(50, 56)], curve(44, 56, 50, 52, 56, 56)];
}

/** A light's sheared bar (`ct-gloss`, `ct-shimmer`: 60 tall, skewX(-18deg)). */
function bar(width: number): BufferGeometry {
  const shear = Math.tan((18 * Math.PI) / 180);
  const s = new Shape([
    v(20 - 30 * shear, 80),
    v(20 + width - 30 * shear, 80),
    v(20 + width + 30 * shear, 20),
    v(20 + 30 * shear, 20),
  ]);
  return new ShapeGeometry(s);
}

const paint = (color: string, opacity = 1): MeshBasicMaterial =>
  new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    // The top view's own colours: no tone mapping greys them on the lit enamel.
    toneMapped: false,
  });

export interface RestoreDecal {
  group: Group;
  /** Shows `parts` at `amount` (0..1: the top view's presence times the courier's fade). */
  update(parts: RestoreParts | null, amount: number): void;
}

/**
 * `unit` is one top-view unit in the tooth's own units; `top` the height of the crown's chewing
 * surface there.
 */
export function createRestoreDecal(unit: number, top: number): RestoreDecal {
  const group = new Group();
  group.name = 'restoration';
  group.position.y = top;
  // The shapes' plane onto the chewing surface: their y up toward the tooth's back.
  group.rotation.x = -Math.PI / 2;
  group.scale.setScalar(unit);
  group.renderOrder = 10;

  const layer = (geometry: BufferGeometry, material: MeshBasicMaterial): Mesh => {
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 10;
    group.add(mesh);
    return mesh;
  };
  const outlinePoints = cavity().getPoints(16);
  const outline = layer(ribbon(outlinePoints, 1.4), paint('#9A8670'));
  const outlineCount = outline.geometry.getAttribute('position').count;
  const fill = layer(new ShapeGeometry(cavity(), 16), paint('#E7DCCB'));
  const inlay = new Group();
  inlay.name = 'inlay';
  inlay.add(new Mesh(new ShapeGeometry(polygon(INLAY)), paint('#F6EEE0')));
  inlay.add(
    new Mesh(
      ribbon(
        [...INLAY, INLAY[0]].map(([x, y]) => v(x, y)),
        0.8,
      ),
      paint('#D9CBB5'),
    ),
  );
  for (const m of inlay.children) m.renderOrder = 11;
  group.add(inlay);
  const gloss = layer(bar(12), paint('#FFFFFF', 0));
  const dentine = layer(new ShapeGeometry(polygon(INLAY)), paint('#EBD3B4'));
  const enamel = layer(new ShapeGeometry(polygon(INLAY)), paint('#FFFDF8'));
  enamel.renderOrder = 11;
  const strokes = stainStrokes().map((points) => layer(ribbon(points, 0.9), paint('#A06F3E')));
  for (const s of strokes) s.renderOrder = 12;
  const shimmer = layer(bar(10), paint('#FFFFFF', 0));
  shimmer.renderOrder = 13;
  gloss.renderOrder = 13;

  const set = (mesh: Mesh | Group, opacity: number): void => {
    mesh.visible = opacity > 0.002;
    const meshes = mesh instanceof Mesh ? [mesh] : (mesh.children as Mesh[]);
    for (const m of meshes) (m.material as MeshBasicMaterial).opacity = opacity;
  };

  return {
    group,
    update(parts, amount) {
      group.visible = parts !== null && amount > 0.002;
      if (!group.visible || parts === null) return;
      // Plain: the outline draws, then the fill covers it.
      set(outline, amount * (parts.outline > 0 ? 1 : 0));
      outline.geometry.setDrawRange(0, Math.round((outlineCount / 6) * parts.outline) * 6);
      set(fill, amount * parts.fill);
      // VIP: centred on the inlay's middle (the box's), as transform-box: fill-box does.
      set(inlay, amount * parts.inlay.opacity);
      inlay.position.y = -parts.inlay.y;
      inlay.rotation.z = (-parts.inlay.rot * Math.PI) / 180;
      inlay.scale.setScalar(parts.inlay.scale);
      set(gloss, amount * parts.gloss.opacity);
      gloss.position.x = parts.gloss.x;
      // CIP: dentine, the translucent enamel over it, then the stain stroke by stroke.
      set(dentine, amount * parts.dentine);
      set(enamel, amount * 0.72 * parts.enamel);
      strokes.forEach((s, i) => {
        const drawn = Math.min(1, Math.max(0, parts.stain * strokes.length - i));
        const count = s.geometry.getAttribute('position').count;
        set(s, amount * 0.55 * (drawn > 0 ? 1 : 0));
        s.geometry.setDrawRange(0, Math.round((count / 6) * drawn) * 6);
      });
      set(shimmer, amount * parts.shimmer.opacity);
      shimmer.position.x = parts.shimmer.x;
    },
  };
}
