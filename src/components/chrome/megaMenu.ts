import { MEGA_ID } from './ids';

// Studio choice (nav spec Q14): open after a short rest, close after a longer grace, so a pointer
// crossing the bar opens nothing and the gap between the button and the panel closes nothing.
const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 300;

/**
 * Enhancements of the services mega menu (nav spec 1.3). The Popover API already gives click,
 * Esc with focus return and light dismiss without script; this adds aria-expanded, closing when
 * focus leaves the button and the panel, and hover intent on fine pointers. A click on a menu that
 * hover opened keeps it open instead of toggling it shut.
 */
export function setupMegaMenu(doc: Document, win: Window = window): () => void {
  const panel = doc.getElementById(MEGA_ID);
  const button = doc.querySelector<HTMLButtonElement>(`[popovertarget="${MEGA_ID}"]`);
  const root = button?.parentElement;
  if (!panel || !button || !root || typeof panel.showPopover !== 'function') return () => {};

  const isOpen = () => panel.matches(':popover-open');
  let timer = 0;
  let hoverOpened = false;
  const later = (fn: () => void, ms: number) => {
    win.clearTimeout(timer);
    timer = win.setTimeout(fn, ms);
  };

  const sync = () => {
    if (!isOpen()) hoverOpened = false;
    button.setAttribute('aria-expanded', String(isOpen()));
  };
  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !root.contains(next) && isOpen()) panel.hidePopover();
  };
  const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
  const onEnter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !fine.matches) return;
    later(() => {
      if (isOpen()) return;
      panel.showPopover();
      hoverOpened = true;
    }, OPEN_DELAY_MS);
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    // Never while focus is in the panel: a keyboard user who tabbed in would lose their place.
    later(
      () => hoverOpened && isOpen() && !panel.matches(':focus-within') && panel.hidePopover(),
      CLOSE_DELAY_MS,
    );
  };
  const onClick = (event: MouseEvent) => {
    win.clearTimeout(timer);
    if (hoverOpened && isOpen()) {
      event.preventDefault(); // a canceled click skips the popovertarget toggle
      hoverOpened = false;
    }
  };

  sync();
  panel.addEventListener('toggle', sync);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  button.addEventListener('click', onClick);
  return () => {
    win.clearTimeout(timer);
    if (isOpen()) panel.hidePopover();
    panel.removeEventListener('toggle', sync);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('pointerenter', onEnter);
    root.removeEventListener('pointerleave', onLeave);
    button.removeEventListener('click', onClick);
  };
}
