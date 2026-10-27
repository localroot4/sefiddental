/**
 * The MorphSVG chunk of scene 3 (phase 7 report D12, C15): loaded through `nearViewport` only
 * where the track pins. The pairs come precomputed on one grid with equal point counts and the
 * same start corner (scripts/brand-paths.mjs), so every tween passes them as `precompile` and no
 * shape matching runs in the browser. The mark's silhouette morphs from one world to the next;
 * each icon's ink outline (a sibling `<svg>`) crossfades in by opacity, the previous one out.
 */
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

import { SERVICE_ICON_OUTLINES } from '@/brand/serviceIconPaths';

import { morphAt } from './services';

gsap.registerPlugin(MorphSVGPlugin);

/** Pin progress one morph takes (prototype 0b). */
const MORPH_DURATION = 0.08;

type Accent = keyof typeof SERVICE_ICON_OUTLINES;
const isAccent = (value: string): value is Accent => Object.hasOwn(SERVICE_ICON_OUTLINES, value);

/**
 * Adds the morphs and the outline crossfades to the pin's timeline `tl` (duration 1) for the
 * worlds' accents in track order; returns the restore: kills the tweens, puts the original `d`
 * back and clears the outline opacities.
 */
export function addMorphs(
  tl: gsap.core.Timeline,
  path: SVGPathElement,
  outlines: readonly Element[],
  worlds: readonly string[],
): () => void {
  const original = path.getAttribute('d') ?? '';
  const tweens: gsap.core.Tween[] = [];
  const n = worlds.length;
  let from = original;
  const fade = (target: Element, from: number, to: number, at: number): void => {
    const tween = gsap.fromTo(
      target,
      { opacity: from },
      { opacity: to, duration: MORPH_DURATION, ease: 'none', immediateRender: false },
    );
    tl.add(tween, at);
    tweens.push(tween);
  };
  worlds.forEach((accent, i) => {
    if (!isAccent(accent)) return;
    const shape = SERVICE_ICON_OUTLINES[accent];
    const at = morphAt(i, n);
    const morph = gsap.to(path, {
      duration: MORPH_DURATION,
      ease: 'power1.inOut',
      lazy: false,
      morphSVG: { shape, shapeIndex: 0, type: 'linear', precompile: [from, shape] },
    });
    tl.add(morph, at);
    tweens.push(morph);
    const outline = outlines[i];
    const previous = outlines[i - 1];
    if (outline) fade(outline, 0, 1, at);
    if (previous) fade(previous, 1, 0, at);
    from = shape;
  });
  return () => {
    for (const tween of tweens) tween.kill();
    path.setAttribute('d', original);
    path.removeAttribute('data-original');
    gsap.set(outlines, { clearProps: 'opacity' });
  };
}
