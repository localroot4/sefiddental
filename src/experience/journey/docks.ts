/**
 * The journey's docks as the pose function reads them (pose.ts `Dock`): every `[data-dock]` box
 * of the home page in document px, measured on mount and on resize, never per frame (the same
 * rule as world/anchor.ts). A box inside a sticky stage is measured at its place in flow, with the
 * scroll range of its pin (the stage sticks under the nav while the `PinRoom` after it scrolls),
 * so the pose holds it still during the pin. A box that is not rendered at this width (`display:
 * none`) is left out: the courier skips that station.
 */
import { STATIONS, type Box, type Dock, type DockId, type Viewport } from './pose';

const IDS: ReadonlySet<string> = new Set(STATIONS.map((s) => s.id));

export const isDockId = (value: string | undefined): value is DockId =>
  value !== undefined && IDS.has(value);

/** The nearest ancestor that sticks now (its computed position is sticky), or null. */
function stickyStage(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node !== null; node = node.parentElement) {
    if (getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
}

/**
 * The box at its home in the viewport: a dock moved by a transform (the footer's mark part while
 * it is thrown, dragged or dropped) is read from its offset parent and its layout offsets, so a
 * remeasure mid-throw still finds the box where the part rests.
 */
function homeRect(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  const parent = el.offsetParent;
  const transform = getComputedStyle(el).transform;
  if (parent === null || transform === '' || transform === 'none') return rect;
  const base = parent.getBoundingClientRect();
  return {
    left: base.left + parent.clientLeft + el.offsetLeft,
    top: base.top + parent.clientTop + el.offsetTop,
    width: rect.width,
    height: rect.height,
  };
}

/** `--nav-h` in px: the sticky stages stick under the header. */
function navHeight(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;
}

/**
 * A viewport rect of `el` (or of text inside it) in document px: inside a sticky stage at its
 * place in flow, with the scroll range of its pin (the room after the stage is in flow, so its
 * top less the stage's height is the stage's place, even while the stage is stuck).
 */
function placeInFlow(
  el: Element,
  rect: { left: number; top: number; width: number; height: number },
  nav: number,
): Box {
  const sy = window.scrollY;
  let top = rect.top + sy;
  let pin: Box['pin'] = null;
  const stage = stickyStage(el as HTMLElement);
  const room = stage?.nextElementSibling;
  if (stage && room instanceof HTMLElement && room.hasAttribute('data-pin-room')) {
    const roomTop = room.getBoundingClientRect().top + sy;
    const stageRect = stage.getBoundingClientRect();
    const flowTop = roomTop - stageRect.height;
    top = flowTop + (rect.top - stageRect.top);
    const start = flowTop - nav;
    pin = { start, end: start + room.getBoundingClientRect().height };
  }
  return { left: rect.left + window.scrollX, top, width: rect.width, height: rect.height, pin };
}

/** Every rendered `[data-dock]` box under `root`, in document px. */
export function measureDocks(root: ParentNode = document): Dock[] {
  const docks: Dock[] = [];
  const nav = navHeight();
  for (const el of root.querySelectorAll<HTMLElement>('[data-dock]')) {
    const id = el.dataset.dock;
    if (!isDockId(id) || el.getClientRects().length === 0) continue;
    const rect = homeRect(el);
    if (!(rect.width > 0 && rect.height > 0)) continue;
    docks.push({ id, ...placeInFlow(el, rect, nav) });
  }
  return docks;
}

/** What the courier never sits under: the controls and fields, and every line of shown text. */
const CONTROLS = 'a[href], button, input, select, textarea, [role="button"]';
/** Decorative or not the page's text: the courier's own layers, the header, the dev overlay. */
const SKIP = '[aria-hidden="true"], header, [data-dev-overlay], [data-courier-layer]';

/**
 * The boxes of the page's text and controls under `root`, in document px (pose.ts fades the
 * courier out over them). One box per text node (its lines' union) and per control; measured with
 * the docks, never per frame.
 */
export function measureObstacles(root: Element): Box[] {
  const nav = navHeight();
  const out: Box[] = [];
  const add = (el: Element, rects: Iterable<DOMRect>): void => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of rects) {
      if (!(r.width > 0 && r.height > 0)) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    if (right > left && bottom > top) {
      out.push(placeInFlow(el, { left, top, width: right - left, height: bottom - top }, nav));
    }
  };
  const shown = (el: Element): boolean =>
    el.closest(SKIP) === null && getComputedStyle(el).visibility !== 'hidden';
  for (const el of root.querySelectorAll(CONTROLS)) {
    if (shown(el)) add(el, el.getClientRects());
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const el = node.parentElement;
    if (el === null || !node.textContent?.trim() || !shown(el)) continue;
    range.selectNodeContents(node);
    add(el, range.getClientRects());
  }
  return out;
}

/** The viewport and the scroll range the pose needs. */
export function measureViewport(): Viewport {
  const html = document.documentElement;
  return {
    width: html.clientWidth || window.innerWidth,
    height: window.innerHeight,
    maxScroll: Math.max(0, html.scrollHeight - window.innerHeight),
  };
}
