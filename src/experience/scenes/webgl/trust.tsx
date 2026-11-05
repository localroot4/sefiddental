'use client';

/**
 * Scene 2, the hero exit (storyboard scene 2; brief decision 19): as the photo scrolls away the
 * glass mark and three diamond gems stand in the world window under the trust facts, at the end
 * side (left in RTL), in the box between the facts, the services mark and the services heading,
 * so no fact, heading or card is ever drawn over. The mark lags the page at 0.88x, the diamonds
 * drift on a 12 s loop, scroll velocity wobbles both (clamped) and a fine pointer tilts them.
 * Toward the services pin the mark drifts up and shrinks into the services mark (the scene 3
 * protagonist, SVG). Desktop only (>= 1024 px): narrower layouts have no text-free box here and
 * keep the dust and the light. Runs from tier 1 (section 3: the world at the hero exit).
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import type { BufferGeometry, Group, Mesh } from 'three';

import {
  docRect,
  followCamera,
  navHeight,
  smoothstep,
  stageDocTop,
  useMeasured,
} from '../../world/anchor';
import { MODELS } from '../../world/assets';
import { brandGeometry } from '../../world/brandGeometry';
import { useWorld } from '../../world/context';
import { ShadowCatcher } from '../../world/ShadowCatcher';
import { ANCHOR_DEPTH, rectToCamera, type PxRect } from '../../world/worldMath';
import { once } from '../../engine/once';
import type { SceneProps } from '../types';

const WIDE = '(min-width: 1024px)';
/** The mark's height over its width (design/brand/3d/README.md: 1 unit wide, logo 184 x 223). */
const MARK_ASPECT = 223 / 184;
/** Gap between the box and the text around it (CSS px). */
const GAP = 32;
/**
 * Diamonds: their box (`strip`, the band between the photo and the facts, shows first as the
 * photo leaves; `box`, the mark's), place in it (0..1, inline from the left), size in CSS px and
 * loop phase.
 */
const DIAMONDS = [
  { in: 'strip', u: 0.12, v: 0.5, size: 20, phase: 1 },
  { in: 'strip', u: 0.58, v: 0.45, size: 14, phase: 3.3 },
  { in: 'box', u: 0.86, v: 0.28, size: 34, phase: 0 },
  { in: 'box', u: 0.7, v: 0.8, size: 22, phase: 2.1 },
  { in: 'box', u: 0.1, v: 0.66, size: 18, phase: 4.2 },
] as const;
const LOOP_S = 12;
/** The mark appears over this long once its model has arrived. */
const ASSEMBLE_S = 0.8;

interface Layout {
  /** The text-free box in document px. */
  box: PxRect;
  /** The text-free band between the photo's bottom and the facts, full content width. */
  strip: PxRect;
  /** The services mark's centre: document x, and its y relative to the stage top. */
  target: { x: number; y: number };
  stage: { docTop: number; navH: number; roomHeight: number; pinned: boolean };
}

function measure(): Layout | null {
  if (!window.matchMedia(WIDE).matches) return null;
  const facts = document.querySelector('[data-world-slot="hero-exit"] > div');
  const services = document.querySelector<HTMLElement>('[data-scene="services"]');
  const stage = services?.querySelector<HTMLElement>('[data-stage]');
  const rail = stage?.querySelector('[data-rail]');
  const mark = stage?.querySelector('[data-mark]');
  if (!facts || !stage || !rail || !mark) return null;
  const top = stageDocTop(stage);
  const stageRect = stage.getBoundingClientRect();
  const railRect = rail.getBoundingClientRect();
  const markRect = mark.getBoundingClientRect();
  const heading = stage.querySelector('h2')?.parentElement?.getBoundingClientRect();
  const factsBox = docRect(facts);
  const factsBottom = factsBox.top + factsBox.height;
  const band = docRect(facts.parentElement ?? facts);
  const row = facts.firstElementChild?.getBoundingClientRect();
  const stripTop = band.top + GAP / 2;
  const stripBottom =
    factsBox.top + (row ? row.top - facts.getBoundingClientRect().top : 0) - GAP / 2;
  const left = markRect.right + GAP;
  const right = (heading ? heading.left : window.innerWidth / 2) - GAP;
  const boxTop = factsBottom + GAP / 2;
  const boxBottom = top + (railRect.top - stageRect.top) - GAP / 2;
  if (right - left < 160 || boxBottom - boxTop < 160) return null;
  const room = stage.nextElementSibling;
  return {
    box: { left, top: boxTop, width: right - left, height: boxBottom - boxTop },
    strip: {
      left: factsBox.left,
      top: stripTop,
      width: factsBox.width,
      height: Math.max(0, stripBottom - stripTop),
    },
    target: {
      x: markRect.left + markRect.width / 2,
      y: markRect.top - stageRect.top + markRect.height / 2,
    },
    stage: {
      docTop: top,
      navH: navHeight(),
      roomHeight:
        room instanceof HTMLElement && room.hasAttribute('data-pin-room') ? room.offsetHeight : 0,
      pinned: document.documentElement.hasAttribute('data-pins'),
    },
  };
}

export default function TrustScene(props: SceneProps): React.JSX.Element | null {
  const { ref } = props;
  const { materials, motion, fov, world, emptyRef } = useWorld();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const layout = useMeasured(measure);
  const root = useRef<Group>(null);
  const mark = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const gems = useRef<(Mesh | null)[]>([]);
  const [models, setModels] = useState<{ mark: BufferGeometry; diamond: BufferGeometry } | null>(
    null,
  );
  const arrived = useRef(-1);

  const release = useMemo(
    () =>
      once(() => {
        brandGeometry.release(MODELS.mark);
        brandGeometry.release(MODELS.diamond);
      }),
    [],
  );
  useImperativeHandle(ref, () => ({ dispose: release }), [release]);
  useEffect(() => {
    let live = true;
    Promise.all([brandGeometry.acquire(MODELS.mark), brandGeometry.acquire(MODELS.diamond)]).then(
      ([markGeometry, diamond]) => {
        if (live) setModels({ mark: markGeometry, diamond });
      },
      (error: unknown) => console.error('[world] the hero exit models failed to load.', error),
    );
    return () => {
      live = false;
      release();
    };
  }, [release]);

  useFrame(() => {
    const group = root.current;
    const l = layout.current;
    if (!group) {
      emptyRef.current += 1;
      return;
    }
    group.visible = l !== null && models !== null;
    if (!group.visible || l === null) {
      emptyRef.current += 1;
      return;
    }
    followCamera(group, camera);
    if (arrived.current < 0) arrived.current = motion.time;
    const appear = smoothstep(0, ASSEMBLE_S, motion.time - arrived.current);

    const y = window.scrollY;
    const viewport = { width: size.width, height: size.height };
    const boxTop = l.box.top - y;
    // Lags the page at 0.88x around the viewport centre, inside the box.
    const lag = Math.max(
      -0.1,
      Math.min(0.1, -((boxTop + l.box.height / 2 - size.height / 2) * 0.12) / l.box.height),
    );
    // Toward the pin the mark drifts into the services mark and shrinks to nothing.
    const pinStart = l.stage.docTop - l.stage.navH;
    const exit = smoothstep(pinStart - size.height * 0.45, pinStart, y);
    const stageTop = Math.max(l.stage.navH, l.stage.docTop - y);

    const heightPx = Math.min(l.box.height * 0.78, l.box.width * 0.5 * MARK_ASPECT, 320);
    const home = {
      x: l.box.left + l.box.width * 0.4,
      y: boxTop + l.box.height * (0.5 + lag),
    };
    const goal = { x: l.target.x, y: stageTop + l.target.y };
    const at = rectToCamera(
      {
        left: home.x + (goal.x - home.x) * exit,
        top: home.y + (goal.y - home.y) * exit,
        width: 0,
        height: 0,
      },
      viewport,
      fov,
      ANCHOR_DEPTH,
    );
    const scale = heightPx * at.unitsPerPx * (1 - exit) * appear;
    const m = mark.current;
    if (m) {
      m.visible = scale > 1e-4;
      m.position.set(at.x, at.y, at.z);
      m.scale.setScalar(scale / MARK_ASPECT);
      m.rotation.set(
        -0.14 + motion.wobble * 0.22 + motion.pointerY * 0.1,
        0.46 - 0.22 * smoothstep(0, 1, props.progress()) + motion.pointerX * 0.18,
        motion.wobble * 0.06,
      );
    }
    const g = glow.current;
    if (g) {
      g.visible = world.glow && scale > 1e-4;
      g.position.set(at.x, at.y, at.z - 0.4);
      g.scale.setScalar(scale * 2.1);
    }
    const loop = (motion.time / LOOP_S) * Math.PI * 2;
    DIAMONDS.forEach((d, i) => {
      const gem = gems.current[i];
      if (!gem) return;
      const area = d.in === 'strip' ? l.strip : l.box;
      // A strip too low for the gem and its drift stays empty.
      const fits = area.height >= d.size + 24;
      const p = rectToCamera(
        {
          left: area.left + area.width * d.u + Math.sin(loop + d.phase) * 10,
          top: area.top - y + area.height * d.v + Math.cos(loop + d.phase) * 6,
          width: 0,
          height: 0,
        },
        viewport,
        fov,
        ANCHOR_DEPTH,
      );
      const s = fits ? d.size * p.unitsPerPx * (1 - exit) * appear : 0;
      gem.visible = s > 1e-4;
      gem.position.set(p.x, p.y, p.z + 0.2);
      gem.scale.setScalar(s);
      gem.rotation.set(motion.wobble * 0.5, Math.sin(loop + d.phase) * 0.5, 0);
    });
  });

  if (models === null) return null;
  const shadows = world.shadows !== 'none';
  return (
    <group ref={root}>
      {/* Under the box, with room for the shadows that fall down and to the left. */}
      <ShadowCatcher
        rect={() => {
          const l = layout.current;
          if (l === null) return null;
          const { box } = l;
          const top = box.top - window.scrollY;
          return {
            left: box.left - 80,
            top: top - 40,
            width: box.width + 160,
            height: box.height + 120,
          };
        }}
      />
      <mesh ref={glow} material={materials.glow} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh
        ref={mark}
        geometry={models.mark}
        material={materials.glass}
        castShadow={shadows}
        renderOrder={3}
      />
      {DIAMONDS.map((d, i) => (
        <mesh
          key={d.phase}
          ref={(gem) => {
            gems.current[i] = gem;
          }}
          geometry={models.diamond}
          material={materials.gem}
          castShadow={shadows}
        />
      ))}
    </group>
  );
}
