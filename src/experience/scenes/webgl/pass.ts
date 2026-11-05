/**
 * One private three.js scene drawn into the box of a DOM world slot (`[data-world-slot]`), after
 * the shared scene (R3F `addAfterEffect` runs after the root render of every frame the
 * FrameDriver advances). Motivation: each slot scene keeps its own camera, lights and environment,
 * so it never moves or relights the shared world (lane WORLD), and it needs no `useFrame`
 * priority, which would take the root render over. Only the slot's box is drawn (scissor), over
 * the world, with the depth cleared in the box.
 *
 * Hand-over: the slot gets `data-world-live` after the first frame drawn in it, and its CSS hides
 * the DOM art it replaces (MolarStepper, CompareSlider); the attribute goes on unmount, on a lost
 * context and whenever the scene draws nothing, so the DOM art is back the same frame.
 */
import { useEffect, useRef } from 'react';

import { addAfterEffect, useThree } from '@react-three/fiber';
import type { Camera, Scene, WebGLRenderer } from 'three';

import { passViewport } from './math';

export const LIVE_ATTR = 'data-world-live';

export interface PassFrame {
  gl: WebGLRenderer;
  slot: HTMLElement;
  rect: DOMRect;
  /** Seconds since the previous drawn frame, at most 0.1 (0 on the first). */
  dt: number;
  /** The frame clock in seconds (the scroll engine's gsap time). */
  time: number;
}

/**
 * What to draw this frame, or null for nothing (the DOM art stays); `box` draws into an element
 * inside the slot instead of the whole slot.
 */
export type PassDraw = (frame: PassFrame) => { scene: Scene; camera: Camera; box?: DOMRect } | null;

export function useSlotPass(selector: string, draw: PassDraw): void {
  const get = useThree((state) => state.get);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    let slot: HTMLElement | null = null;
    let live = false;
    let last = -1;
    const setLive = (on: boolean): void => {
      if (live === on) return;
      live = on;
      slot?.toggleAttribute(LIVE_ATTR, on);
    };
    const canvas = get().gl.domElement;
    const onLost = (): void => setLive(false);
    canvas.addEventListener('webglcontextlost', onLost);

    const off = addAfterEffect((time) => {
      if (slot === null || !slot.isConnected) {
        setLive(false);
        slot = document.querySelector<HTMLElement>(selector);
        if (slot === null) return;
      }
      const { gl, size } = get();
      const rect = slot.getBoundingClientRect();
      // Off screen: nothing to draw and nothing to hand back (the slot is not visible).
      if (passViewport(rect, size) === null) return;
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      const pass = drawRef.current({ gl, slot, rect, dt, time });
      const view = pass && passViewport(pass.box ?? rect, size);
      if (!pass || !view) {
        setLive(false);
        return;
      }
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.setViewport(view.x, view.y, view.width, view.height);
      gl.setScissor(view.scissor.x, view.scissor.y, view.scissor.width, view.scissor.height);
      gl.setScissorTest(true);
      gl.clearDepth();
      gl.render(pass.scene, pass.camera);
      gl.setScissorTest(false);
      gl.setViewport(0, 0, size.width, size.height);
      gl.autoClear = autoClear;
      setLive(true);
    });

    return () => {
      off();
      canvas.removeEventListener('webglcontextlost', onLost);
      setLive(false);
    };
  }, [get, selector]);
}

/** Whether the page shows the dark theme now (`color-scheme` follows data-theme and the system). */
export const isDark = (): boolean =>
  getComputedStyle(document.documentElement).colorScheme.includes('dark');

/** A CSS colour token of the current theme, e.g. `--color-brand`. */
export const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Calls `cb` when the theme changes (the toggle's data-theme or the system preference). */
export function watchTheme(cb: () => void): () => void {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener('change', cb);
  return () => {
    observer.disconnect();
    scheme.removeEventListener('change', cb);
  };
}
