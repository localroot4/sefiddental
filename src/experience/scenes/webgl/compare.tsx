'use client';

/**
 * Scene 6 in WebGL (storyboard scene 6): the displacement wipe of the compare slider at tiers 2
 * and 3 from 1024 px. The DOM slider stays the control: its range input moves `--pos`, its
 * labels, divider and handle stay above the canvas, and this scene only redraws the two photos it
 * already shows, split at the same divider. Phones, tier 1 and tier 0 keep the DOM clip-path.
 *
 * It draws only when both photos are decoded and same-origin (a cross-origin photo would taint
 * the upload); a section without the slider (the demo cases) or without photos draws nothing.
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import type { SceneProps } from '../types';

import { createWipeRig } from './compareRig';
import { wipeDraws } from './math';
import { useSlotPass, type PassDraw } from './pass';

const SLOT = '[data-scene="compare"] [data-world-slot="compare"]';
const WIDE = '(min-width: 1024px)';

/** The decoded, same-origin photo of a CompareSlider layer, or null. */
function layerImage(root: Element, layer: 'before' | 'after'): HTMLImageElement | null {
  const img = root.querySelector<HTMLImageElement>(`[data-compare-${layer}] picture img`);
  if (img === null || !img.complete || img.naturalWidth === 0) return null;
  const src = img.currentSrc || img.src;
  try {
    return new URL(src, document.baseURI).origin === window.location.origin ? img : null;
  } catch {
    return null;
  }
}

export default function CompareScene(props: SceneProps): null {
  const { settings, ref } = props;
  const rig = useMemo(() => createWipeRig(), []);
  useEffect(() => () => void rig.dispose(), [rig]);
  useImperativeHandle(ref, () => ({ dispose: () => void rig.dispose() }), [rig]);

  const wide = useMemo(() => window.matchMedia(WIDE), []);
  const images = useRef<{ before: string; after: string } | null>(null);
  const ready = useRef(false);
  const box = useRef<{ root: HTMLElement; radius: number; rtl: boolean } | null>(null);

  const draw = useCallback<PassDraw>(
    ({ slot, dt, time }) => {
      if (!wipeDraws(settings, wide.matches)) return null;
      if (box.current === null || !slot.contains(box.current.root)) {
        const root = slot.querySelector<HTMLElement>('[data-compare]');
        if (root === null) return null;
        const style = getComputedStyle(root);
        box.current = {
          root,
          radius: parseFloat(style.borderTopLeftRadius) || 0,
          rtl: style.direction === 'rtl',
        };
      }
      const { root, radius, rtl } = box.current;
      const before = layerImage(root, 'before');
      const after = layerImage(root, 'after');
      if (before === null || after === null) return null;
      const srcs = { before: before.currentSrc, after: after.currentSrc };
      if (images.current?.before !== srcs.before || images.current.after !== srcs.after) {
        images.current = srcs;
        ready.current = false;
        const decode = (img: HTMLImageElement) =>
          createImageBitmap(img, { imageOrientation: 'flipY' });
        Promise.all([decode(before), decode(after)]).then(
          ([b, a]) => {
            if (images.current !== srcs) {
              b.close();
              a.close();
              return;
            }
            rig.setImages(b, a);
            ready.current = true;
          },
          (error: unknown) => console.error('[experience] compare photos did not decode.', error),
        );
      }
      if (!ready.current) return null;
      const rect = root.getBoundingClientRect();
      rig.update({
        pos: parseFloat(root.style.getPropertyValue('--pos') || '50'),
        rtl,
        dt,
        time,
        w: rect.width,
        h: rect.height,
        radius,
        // The section's entrance fades the slot in (reveal.ts writes its inline opacity).
        opacity: slot.style.opacity === '' ? 1 : parseFloat(slot.style.opacity),
      });
      return { scene: rig.scene, camera: rig.camera, box: rect };
    },
    [rig, settings, wide],
  );
  useSlotPass(SLOT, draw);
  return null;
}
