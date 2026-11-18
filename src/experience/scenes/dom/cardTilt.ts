/**
 * Cards that turn toward a fine pointer (owner 2026-11-18: «cards that play with the mouse», the
 * courier's own turn at the docks): over a card the side under the pointer goes back, at most
 * MAX_DEG, through gsap (it shares the card's transform with the scene's entrance, never a CSS
 * transform that would fight it), and a soft light follows the pointer (globals.css
 * `[data-tilt]::after`, its place in `--mx` and `--my`, on while `data-lit`). Only from 1024 px
 * with a fine pointer; the engine never runs under reduced motion or at tier 0. The cleanup takes
 * the listeners, the attributes and the turn away.
 */
import { gsap } from 'gsap';

export const MAX_DEG = 5;
const PERSPECTIVE_PX = 900;
/** A calm follow, about the courier's own (motion.ts TILT_OMEGA). */
const FOLLOW_S = 0.5;

export function cardTilt(cards: ArrayLike<HTMLElement>, on: boolean): () => void {
  if (!on || cards.length === 0) return () => {};
  const removers = Array.from(cards).map((card) => {
    card.setAttribute('data-tilt', '');
    gsap.set(card, { transformPerspective: PERSPECTIVE_PX });
    // gsap's first parse writes `translate: none` inline: the card's own 2 px hover lift (the CSS
    // `translate`, Cards.tsx LINK_CARD) would stop. It composes with gsap's transform: let it be.
    card.style.removeProperty('translate');
    const toX = gsap.quickTo(card, 'rotationX', { duration: FOLLOW_S, ease: 'power3.out' });
    const toY = gsap.quickTo(card, 'rotationY', { duration: FOLLOW_S, ease: 'power3.out' });
    const move = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      const u = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
      const v = Math.max(0, Math.min(1, (event.clientY - r.top) / r.height));
      // Right of the centre the right side goes back (rotationY > 0); below it, the bottom does.
      toY((u - 0.5) * 2 * MAX_DEG);
      toX(-(v - 0.5) * 2 * MAX_DEG);
      card.style.setProperty('--mx', `${Math.round(u * 100)}%`);
      card.style.setProperty('--my', `${Math.round(v * 100)}%`);
      card.setAttribute('data-lit', '');
    };
    const leave = (): void => {
      toX(0);
      toY(0);
      card.removeAttribute('data-lit');
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    return () => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(card, 'rotationX,rotationY');
      // After the engine's revert: no inline transform (nor translate, rotate, scale) stays.
      gsap.set(card, { clearProps: 'transform' });
      card.removeAttribute('data-tilt');
      card.removeAttribute('data-lit');
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    };
  });
  return () => removers.forEach((remove) => remove());
}
