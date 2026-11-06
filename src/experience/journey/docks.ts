/**
 * The journey's docks as the pose function reads them (pose.ts `Dock`): every `[data-dock]` box
 * of the home page in document px, measured on mount and on resize, never per frame (the same
 * rule as world/anchor.ts). A box inside a sticky stage is measured at its place in flow, with the
 * scroll range of its pin (the stage sticks under the nav while the `PinRoom` after it scrolls),
 * so the pose holds it still during the pin. A box that is not rendered at this width (`display:
 * none`) is left out: the courier skips that station.
 */
import { STATIONS, type Dock, type DockId, type Viewport } from './pose';

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

/** `--nav-h` in px: the sticky stages stick under the header. */
function navHeight(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;
}

/** Every rendered `[data-dock]` box under `root`, in document px. */
export function measureDocks(root: ParentNode = document): Dock[] {
  const docks: Dock[] = [];
  const nav = navHeight();
  const sy = window.scrollY;
  const sx = window.scrollX;
  for (const el of root.querySelectorAll<HTMLElement>('[data-dock]')) {
    const id = el.dataset.dock;
    if (!isDockId(id) || el.getClientRects().length === 0) continue;
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) continue;
    let top = rect.top + sy;
    let pin: Dock['pin'] = null;
    const stage = stickyStage(el);
    const room = stage?.nextElementSibling;
    if (stage && room instanceof HTMLElement && room.hasAttribute('data-pin-room')) {
      // The room follows the stage in flow: its top less the stage's height is the stage's place,
      // even while the stage is stuck.
      const roomTop = room.getBoundingClientRect().top + sy;
      const stageRect = stage.getBoundingClientRect();
      const flowTop = roomTop - stageRect.height;
      top = flowTop + (rect.top - stageRect.top);
      const start = flowTop - nav;
      pin = { start, end: start + room.getBoundingClientRect().height };
    }
    docks.push({ id, left: rect.left + sx, top, width: rect.width, height: rect.height, pin });
  }
  return docks;
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
