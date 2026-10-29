/**
 * Scene 8, patient voices (phase 7 report, plan section 2; phone spec scene 8, D24). Under 1024 px
 * the list is a native scroll-snap row at every tier in the server HTML, and the «قبلی» and «بعدی»
 * box is there at every tier, invisible and inert (the spec's fallback: no handler in the home
 * initial JS); here, at tiers 1 to 3, the buttons appear and work, and the row's scroll container
 * slides in (Slide through `reveal` with axis x; the cards and their snap positions never move).
 * From 1024 px tier 0 keeps the grid; at tiers 1 to 3 the list becomes the row (`data-carousel`
 * switches the classes the section rendered), the buttons show while the row overflows, and the
 * cards rise once on enter. Each press scrolls the row by one card. The switch changes the
 * section's height, so it runs one frame after the engine's creation task (no forced layout
 * there), where the engine's resize observer, past its first report of the size the creation
 * measured, sees the new height and refreshes the bounds (a microtask would land before that
 * first report and leave every later scene's bounds stale); a later switch (on enter) would cost
 * a full refresh mid-scroll instead. The ends: an IntersectionObserver on the first and the last
 * card (reported after layout, never a forced one) disables the button whose end is in full
 * view; from 1024 px it also hides the buttons while the whole row fits (under 1024 px their box
 * stays, D24; one voice gets no buttons at any tier, `data-single`). Nothing plays and no media
 * is preloaded (captions, phase 4). Motivation: one voice at a time, in the reader's own pace.
 */
import type { DomScene } from '../types';

import { reveal } from './reveal';

/** One card plus the column gap, in the row's own direction (RTL scrolls toward negative left). */
export function scrollByCard(row: HTMLElement, dir: 1 | -1): void {
  const card = row.firstElementChild;
  if (!card) return;
  const style = getComputedStyle(row);
  const step = card.getBoundingClientRect().width + (parseFloat(style.columnGap) || 0);
  const sign = style.direction === 'rtl' ? -1 : 1;
  row.scrollBy({ left: dir * sign * step, behavior: 'smooth' });
}

const scene: DomScene = {
  setup(ctx) {
    const row = ctx.el.querySelector<HTMLElement>('[data-world-slot="voices"]');
    const nav = ctx.el.querySelector<HTMLElement>('[data-voices-nav]');
    if (!row || !nav) return;
    const { wide } = ctx.conditions;
    const cleanups = [wide ? reveal(row.children, row, true) : reveal([row], row, false, 'x')];
    let frame = requestAnimationFrame(() => {
      frame = 0;
      if (wide) {
        // Hidden until the observer reports the row overflows: no flash of the buttons.
        nav.hidden = true;
        row.setAttribute('data-carousel', '');
      }
      nav.classList.remove('invisible');
      nav.removeAttribute('inert');
      const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button[data-dir]'));
      for (const button of buttons) {
        const dir = button.dataset.dir === '-1' ? -1 : 1;
        const onClick = (): void => scrollByCard(row, dir);
        button.addEventListener('click', onClick);
        cleanups.push(() => button.removeEventListener('click', onClick));
      }
      const first = row.firstElementChild;
      const last = row.lastElementChild;
      const full = { start: false, end: false };
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.target === first) full.start = entry.intersectionRatio >= 0.99;
            if (entry.target === last) full.end = entry.intersectionRatio >= 0.99;
          }
          for (const button of buttons) {
            button.disabled = button.dataset.dir === '-1' ? full.start : full.end;
          }
          if (wide) nav.hidden = full.start && full.end;
        },
        { root: row, threshold: 0.99 },
      );
      if (first) observer.observe(first);
      if (last) observer.observe(last);
      cleanups.push(() => {
        observer.disconnect();
        for (const button of buttons) button.disabled = false;
        row.removeAttribute('data-carousel');
        nav.hidden = false;
        nav.setAttribute('inert', '');
        nav.classList.add('invisible');
      });
    });
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
    };
  },
};
export default scene;
