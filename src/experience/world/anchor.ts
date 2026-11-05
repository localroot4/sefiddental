/**
 * Screen anchoring: the world's objects sit beside DOM boxes that hold no text, so no CTA or
 * line of text is ever drawn over (docs/prompts/08-webgl-experience.md acceptance). Boxes are
 * measured in document pixels on mount and whenever the document resizes (fonts, the FAQ, a
 * rotation), never per frame; a frame maps them to the viewport with `scrollY` alone.
 */
import { useEffect, useRef } from 'react';

import type { Camera, Object3D } from 'three';

import type { PxRect } from './worldMath';

/** The element's box in document pixels (viewport rect plus scroll). */
export function docRect(el: Element): PxRect {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/** `--nav-h` in pixels (the sticky stages stick under it). */
export function navHeight(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;
}

/**
 * Re-runs `measure` (a stable function) after mount and after every document or viewport size
 * change; frames read the last result.
 */
export function useMeasured<T>(measure: () => T | null): { readonly current: T | null } {
  const result = useRef<T | null>(null);
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      result.current = measure();
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(run);
    };
    run();
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [measure]);
  return result;
}

/**
 * A sticky stage's document top in flow, even while it is stuck: its parent's top (the stage is
 * the first child of `Section`'s inner box, which never sticks).
 */
export function stageDocTop(stage: HTMLElement): number {
  return docRect(stage.parentElement ?? stage).top;
}

/** Children of `group` then live in the camera's space: x right, y up, -z ahead. */
export function followCamera(group: Object3D, camera: Camera): void {
  group.position.copy(camera.position);
  group.quaternion.copy(camera.quaternion);
}

/** 0..1 ease in and out. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t =
    edge1 === edge0
      ? x >= edge1
        ? 1
        : 0
      : Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * The viewport top of a sticky stage at scroll `y`: in flow before its pin, under the nav during
 * it, then scrolled away with its room's end (the stage and room of scenes/dom/pinRoom.ts).
 */
export function stickyTop(
  y: number,
  stage: { docTop: number; navH: number; roomHeight: number; pinned: boolean },
): number {
  const start = stage.docTop - stage.navH;
  if (!stage.pinned || y < start) return stage.docTop - y;
  const end = start + stage.roomHeight;
  return y <= end ? stage.navH : stage.navH - (y - end);
}
