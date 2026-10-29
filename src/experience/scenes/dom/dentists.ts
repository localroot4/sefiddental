/**
 * Scene 7, dentists (phase 7 report, plan section 2). From 1024 px the cards rise once on enter
 * at tiers 1 to 3; under 1024 px the rail's scroll container slides in instead (phone spec scene
 * 7, Slide through `reveal` with axis x), so the cards and their snap positions never move. From
 * 1024 px with a fine pointer and `settings.pointerParallax`, each portrait follows the pointer
 * over its card by at most 8 px (transform only, eased in the engine's tick, back to rest on
 * leave); a coarse pointer gets no listener and keeps the native snap rail.
 * Motivation: faces answer the pointer, so authority feels present, not printed.
 */
import type { DomScene, SceneContext } from '../types';

import { reveal } from './reveal';

const MAX_PX = 8;
/** The portrait's rest scale while the parallax is on: 8 px of travel never uncovers the frame. */
const SCALE = 1.06;
/** Share of the remaining distance closed per 60 fps frame: about 120 ms to settle. */
const EASE = 0.18;
const SETTLED_PX = 0.05;

interface Item {
  card: HTMLElement;
  portrait: HTMLElement;
  /** Target and current offsets in px. */
  tx: number;
  ty: number;
  x: number;
  y: number;
}

const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

const write = (item: Item): void => {
  item.portrait.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) scale(${SCALE})`;
};

/** Pointer parallax on the portraits; returns the cleanup (listeners, tick, transforms). */
export function parallax(engine: SceneContext['engine'], cards: HTMLElement[]): () => void {
  const items = cards.flatMap((card) => {
    const portrait = card.querySelector<HTMLElement>('[data-portrait]');
    return portrait ? [{ card, portrait, tx: 0, ty: 0, x: 0, y: 0 }] : [];
  });
  for (const item of items) write(item);
  let off: (() => void) | null = null;
  const tick = (_time: number, deltaSec: number): void => {
    const k = 1 - (1 - EASE) ** (deltaSec * 60);
    let busy = false;
    for (const item of items) {
      item.x += (item.tx - item.x) * k;
      item.y += (item.ty - item.y) * k;
      if (Math.abs(item.tx - item.x) > SETTLED_PX || Math.abs(item.ty - item.y) > SETTLED_PX) {
        busy = true;
      } else {
        item.x = item.tx;
        item.y = item.ty;
      }
      write(item);
    }
    // The tick runs only while a portrait moves: no per-frame work at rest.
    if (!busy) {
      off?.();
      off = null;
    }
  };
  const wake = (): void => {
    off ??= engine.onTick(tick);
  };
  const removers = items.map((item) => {
    const move = (event: PointerEvent): void => {
      const r = item.card.getBoundingClientRect();
      item.tx = clamp(((event.clientX - r.left) / r.width - 0.5) * 2) * MAX_PX;
      item.ty = clamp(((event.clientY - r.top) / r.height - 0.5) * 2) * MAX_PX;
      wake();
    };
    const leave = (): void => {
      item.tx = 0;
      item.ty = 0;
      wake();
    };
    item.card.addEventListener('pointermove', move);
    item.card.addEventListener('pointerleave', leave);
    return () => {
      item.card.removeEventListener('pointermove', move);
      item.card.removeEventListener('pointerleave', leave);
      item.portrait.style.transform = '';
    };
  });
  return () => {
    off?.();
    off = null;
    for (const remove of removers) remove();
  };
}

const scene: DomScene = {
  setup(ctx) {
    const rail = ctx.el.querySelector<HTMLElement>('[role="region"]');
    const cards = Array.from(ctx.el.querySelectorAll<HTMLElement>('[role="region"] > *'));
    const { wide } = ctx.conditions;
    const cleanups = [
      wide ? reveal(cards, ctx.el, true) : reveal(rail ? [rail] : [], ctx.el, false, 'x'),
    ];
    if (ctx.settings.pointerParallax && ctx.conditions.fine && wide) {
      cleanups.push(parallax(ctx.engine, cards));
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
export default scene;
