'use client';

/**
 * Scene 3, the services backdrop (storyboard scene 3): a shallow porcelain relief behind the
 * pinned horizontal track. One relief motif per service world (a sparkle for cosmetic care, an
 * implant, a shield, an arch with brackets, soft bubbles for children) slides with the track at
 * half its speed, so the cards (DOM) float in front of a slower world. It sits in the stage's empty lower band, from the lower part of the cards to
 * just above the «همهٔ خدمات» row, so the heading, the cards' text and the link are never drawn
 * over. Procedural geometry: no download. Tiers 2 and 3 where the layout pins (>= 1024 px).
 */
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type Group,
} from 'three';

import {
  followCamera,
  navHeight,
  smoothstep,
  stageDocTop,
  stickyTop,
  useMeasured,
} from '../../world/anchor';
import { useWorld } from '../../world/context';
import { ShadowCatcher } from '../../world/ShadowCatcher';
import { ANCHOR_DEPTH, rectToCamera } from '../../world/worldMath';
import { once } from '../../engine/once';
import type { SceneProps } from '../types';

/** Behind the screen-anchored plane, in front of the shadow catcher. */
const DEPTH = ANCHOR_DEPTH + 0.45;
/** The backdrop moves at this share of the track's distance. */
const PARALLAX = 0.5;
const APPEAR_S = 0.9;

interface Piece {
  geometry: BufferGeometry;
  /** Local position (units of one motif, about 1.4 wide and 1 tall) and z rotation. */
  x: number;
  y: number;
  z: number;
  rz: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const BEVEL = { bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4 };

function extrude(shape: Shape, depth: number): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, { depth, curveSegments: 10, ...BEVEL });
  geometry.center();
  return geometry;
}

function star(points: number, outer: number, inner: number): Shape {
  const shape = new Shape();
  for (let i = 0; i <= points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}

function shield(): Shape {
  const s = new Shape();
  s.moveTo(0, 0.5);
  s.bezierCurveTo(0.18, 0.42, 0.32, 0.4, 0.42, 0.4);
  s.bezierCurveTo(0.44, 0.02, 0.3, -0.32, 0, -0.5);
  s.bezierCurveTo(-0.3, -0.32, -0.44, 0.02, -0.42, 0.4);
  s.bezierCurveTo(-0.32, 0.4, -0.18, 0.42, 0, 0.5);
  return s;
}

/** The five motifs in track order (ServicesSection's worlds: cosmetic first). */
function buildMotifs(): Piece[][] {
  const sparkle = extrude(star(4, 0.42, 0.12), 0.1);
  const sparkleSmall = extrude(star(4, 0.2, 0.06), 0.08);
  const tile = extrude(star(4, 0.17, 0.12), 0.08);
  const post = new CylinderGeometry(0.09, 0.07, 0.62, 20);
  const thread = new TorusGeometry(0.11, 0.028, 8, 24);
  const crown = new CapsuleGeometry(0.2, 0.08, 6, 16);
  const guard = extrude(shield(), 0.12);
  const bar = new CapsuleGeometry(0.035, 0.26, 4, 10);
  const arch = new TorusGeometry(0.5, 0.045, 10, 40, Math.PI);
  const bracket = extrude(star(4, 0.07, 0.05), 0.05);
  const bubble = new SphereGeometry(0.22, 24, 16);
  return [
    [
      { geometry: sparkle, x: 0, y: 0.05, z: 0, rz: 0 },
      { geometry: sparkleSmall, x: 0.48, y: 0.36, z: 0.05, rz: 0.2 },
      { geometry: tile, x: -0.46, y: -0.3, z: 0.02, rz: 0 },
    ],
    [
      { geometry: crown, x: 0, y: 0.34, z: 0, rz: Math.PI / 2, sx: 1, sy: 1.3, sz: 0.55 },
      { geometry: post, x: 0, y: -0.06, z: 0, rz: 0, sz: 0.6 },
      ...[0, 1, 2, 3].map((i) => ({
        geometry: thread,
        x: 0,
        y: 0.12 - i * 0.12,
        z: 0,
        rz: 0,
        sx: 1 - i * 0.06,
        sy: 0.35,
        sz: 1 - i * 0.06,
      })),
    ],
    [
      { geometry: guard, x: 0, y: 0, z: 0, rz: 0, sx: 1.1, sy: 1.1 },
      { geometry: bar, x: 0, y: 0.02, z: 0.1, rz: 0 },
      { geometry: bar, x: 0, y: 0.02, z: 0.1, rz: Math.PI / 2 },
    ],
    [
      { geometry: arch, x: 0, y: -0.2, z: 0, rz: 0, sz: 0.6 },
      ...[0, 1, 2, 3, 4].map((i) => {
        const a = ((i + 0.5) / 5) * Math.PI;
        return {
          geometry: bracket,
          x: Math.cos(a) * 0.5,
          y: -0.2 + Math.sin(a) * 0.5,
          z: 0.04,
          rz: a,
        };
      }),
    ],
    [
      { geometry: bubble, x: -0.12, y: 0.02, z: 0, rz: 0, sz: 0.45 },
      { geometry: bubble, x: 0.34, y: 0.3, z: 0.02, rz: 0, sx: 0.55, sy: 0.55, sz: 0.25 },
      { geometry: bubble, x: 0.3, y: -0.28, z: 0.02, rz: 0, sx: 0.36, sy: 0.36, sz: 0.18 },
      { geometry: sparkleSmall, x: -0.5, y: 0.34, z: 0.04, rz: 0.3 },
    ],
  ];
}

interface Layout {
  stage: { docTop: number; navH: number; roomHeight: number; pinned: boolean };
  /** The band the relief may fill, in px from the stage top. */
  bandTop: number;
  bandBottom: number;
  /** The first world's centre x (px) and the distance between two worlds (px). */
  firstX: number;
  spacing: number;
  /** How far the track slides over the pin (px), scenes/dom/services.ts `trackDistance`. */
  distance: number;
}

function measure(): Layout | null {
  const stage = document.querySelector<HTMLElement>('[data-scene="services"] [data-stage]');
  const rail = stage?.querySelector<HTMLElement>('[data-rail]');
  const track = rail?.querySelector<HTMLElement>('[data-track]');
  const room = stage?.nextElementSibling;
  if (!stage || !rail || !track || !(room instanceof HTMLElement)) return null;
  if (!document.documentElement.hasAttribute('data-pins')) return null;
  const worlds = Array.from(track.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );
  const [first, second] = worlds;
  if (!first || !second) return null;
  const stageRect = stage.getBoundingClientRect();
  const railRect = rail.getBoundingClientRect();
  const after = rail.nextElementSibling?.getBoundingClientRect();
  const railTop = railRect.top - stageRect.top;
  const bandTop = railTop + railRect.height * 0.45;
  const bandBottom = (after ? after.top - stageRect.top : railTop + railRect.height + 240) - 24;
  if (bandBottom - bandTop < 120) return null;
  // The first world's resting place: its box minus the track's current slide.
  const transform = getComputedStyle(track).transform;
  const slid = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  const firstRect = first.getBoundingClientRect();
  return {
    stage: {
      docTop: stageDocTop(stage),
      navH: navHeight(),
      roomHeight: room.offsetHeight,
      pinned: true,
    },
    bandTop,
    bandBottom,
    firstX: firstRect.left - slid + firstRect.width / 2,
    spacing: Math.abs(second.offsetLeft - first.offsetLeft),
    distance: Math.max(0, track.offsetWidth - rail.offsetWidth),
  };
}

export default function ServicesScene(props: SceneProps): React.JSX.Element {
  const { ref } = props;
  const { materials, motion, fov, world } = useWorld();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const layout = useMeasured(measure);
  const root = useRef<Group>(null);
  const motifs = useRef<(Group | null)[]>([]);
  const mounted = useRef(-1);

  const pieces = useMemo(() => buildMotifs(), []);
  const release = useMemo(
    () =>
      once(() => {
        const unique = new Set(pieces.flat().map((piece) => piece.geometry));
        for (const geometry of unique) geometry.dispose();
      }),
    [pieces],
  );
  useImperativeHandle(ref, () => ({ dispose: release }), [release]);
  useEffect(() => release, [release]);

  useFrame(() => {
    const group = root.current;
    const l = layout.current;
    if (!group) return;
    group.visible = l !== null;
    if (l === null) return;
    followCamera(group, camera);
    if (mounted.current < 0) mounted.current = motion.time;

    const y = window.scrollY;
    const pinStart = l.stage.docTop - l.stage.navH;
    const slide = Math.min(1, Math.max(0, (y - pinStart) / Math.max(1, l.stage.roomHeight)));
    const appear = Math.min(
      smoothstep(0, APPEAR_S, motion.time - mounted.current),
      smoothstep(pinStart - size.height * 0.6, pinStart - size.height * 0.15, y),
    );
    const top = stickyTop(y, l.stage) + l.bandTop;
    const height = l.bandBottom - l.bandTop;
    const viewport = { width: size.width, height: size.height };
    const shift = slide * l.distance * PARALLAX;
    motifs.current.forEach((motif, k) => {
      if (!motif) return;
      const at = rectToCamera(
        {
          // RTL: the worlds overflow to the left and the track slides right.
          left: l.firstX - (k * l.spacing) / 2 + shift,
          top: top + height / 2 + (1 - appear) * 48 + Math.sin(motion.time * 0.4 + k) * 4,
          width: 0,
          height: 0,
        },
        viewport,
        fov,
        DEPTH,
      );
      const scale = (height / 1.15) * at.unitsPerPx * (0.86 + 0.14 * appear);
      motif.visible = appear > 0.001;
      motif.position.set(at.x, at.y, at.z + (k % 2) * 0.12);
      motif.scale.setScalar(scale);
      motif.rotation.set(motion.wobble * 0.08, motion.pointerX * 0.06, motion.wobble * 0.03);
    });
  });

  const shadows = world.shadows !== 'none';
  return (
    <group ref={root}>
      <ShadowCatcher
        rect={() => {
          const l = layout.current;
          if (l === null) return null;
          const top = stickyTop(window.scrollY, l.stage) + l.bandTop;
          const height = l.bandBottom - l.bandTop;
          return { left: 0, top: top - 30, width: window.innerWidth, height: height + 140 };
        }}
      />
      {pieces.map((motif, k) => (
        <group
          key={k}
          ref={(g) => {
            motifs.current[k] = g;
          }}
        >
          {motif.map((piece, i) => (
            <mesh
              key={i}
              geometry={piece.geometry}
              material={materials.porcelain}
              position={[piece.x, piece.y, piece.z]}
              rotation={[0, 0, piece.rz]}
              scale={[piece.sx ?? 1, piece.sy ?? 1, piece.sz ?? 1]}
              castShadow={shadows}
              receiveShadow={shadows}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
