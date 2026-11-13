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

/**
 * A rect inside an element drawn with a scale `a` and a translation about its transform origin,
 * taken back to where it is at rest: p' = O + a (p - O) + t, so p = O + (p' - t - O) / a. O is the
 * origin (`origin`, from the element's own corner) in the untransformed box, whose corner sits at
 * drawn - t - origin (a - 1).
 */
export function atRest(
  r: { left: number; top: number; right: number; bottom: number },
  drawn: { left: number; top: number },
  m: { a: number; e: number; f: number },
  origin: { x: number; y: number },
): { left: number; top: number; right: number; bottom: number } {
  const a = m.a || 1;
  const ox = drawn.left - m.e - origin.x * (1 - a) + origin.x;
  const oy = drawn.top - m.f - origin.y * (1 - a) + origin.y;
  const back = (v: number, o: number, t: number): number => o + (v - t - o) / a;
  return {
    left: back(r.left, ox, m.e),
    right: back(r.right, ox, m.e),
    top: back(r.top, oy, m.f),
    bottom: back(r.bottom, oy, m.f),
  };
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

/**
 * The header logo's mark (journey D1) and the header's own controls: the header sticks at the top
 * at every scroll, so each box is pinned over the whole scroll range (its viewport top never
 * changes; pose.ts viewportTop). The controls keep the lane out of the header off the nav (the
 * page's obstacles skip the header). No logo with a dock (another page): no dock. Under 1024 px
 * neither: there the hero's cards span the screen under the header, so no lane leads out of the
 * logo without crossing text; the logo keeps its mark and the courier starts at D2.
 */
const HEADER_DOCK_MIN_WIDTH = 1024;
export function measureHeader(): { dock: Dock | null; obstacles: Box[] } {
  const header = document.querySelector('header');
  const mark = header?.querySelector('[data-dock="header"]');
  if (!header || !mark || mark.getClientRects().length === 0) return { dock: null, obstacles: [] };
  // The CSS breakpoint's own test (the viewport with its scrollbar), as the header's layout.
  if (!window.matchMedia(`(min-width: ${HEADER_DOCK_MIN_WIDTH}px)`).matches)
    return { dock: null, obstacles: [] };
  const pin = { start: 0, end: Infinity };
  const box = (r: DOMRect): Box => ({
    left: r.left + window.scrollX,
    top: r.top,
    width: r.width,
    height: r.height,
    pin,
  });
  const rect = mark.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return { dock: null, obstacles: [] };
  const logo = mark.closest('a');
  const obstacles = Array.from(header.querySelectorAll('a[href], button'))
    // Not an open mega-menu's links: they are gone at the next measure.
    .filter(
      (el) => el !== logo && el.closest('[popover]') === null && el.getClientRects().length > 0,
    )
    .map((el) => box(el.getBoundingClientRect()))
    .filter((b) => b.width > 0 && b.height > 0);
  return { dock: { id: 'header', ...box(rect) }, obstacles };
}

/** What the courier never covers: the controls and fields, and every line of shown text. */
const CONTROLS = 'a[href], button, input, select, textarea, summary, [role="button"]';
/**
 * On a container painted above the courier's layer (the hero's cards): the courier goes round
 * each of its children's boxes whole.
 */
export const ABOVE_ATTR = 'data-above-courier';
/**
 * On a box whose contents move sideways under the reader's hand or the scroll (a card rail, the
 * services track): its texts are not where a measure finds them later, so the courier goes round
 * the whole box.
 */
export const WALL_ATTR = 'data-courier-wall';
/** Decorative or not the page's text: the courier's own layers, the header, the dev overlay. */
const SKIP = '[aria-hidden="true"], header, [data-dev-overlay], [data-courier-layer]';
/** Panels that take turns in one place as the reader scrolls (the restoration's tiers). */
const TIER_PANEL = '[data-tier-panel]';

/**
 * The boxes of the page's text and controls under `root`, and the boxes painted above the
 * courier, in document px (route.ts plans the travels round them). One box per text node (its
 * lines' union), per control and per child of a `[data-above-courier]`; measured with the docks, never per
 * frame.
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
    if (!(right > left && bottom > top)) return;
    // A scroll-scrubbed entrance (`[data-scrub]`: a rise, a slide, a settle) may be mid-way now:
    // the box is taken where the element comes to rest, its transform undone.
    const scrub = el.closest<HTMLElement>('[data-scrub]');
    const style = scrub ? getComputedStyle(scrub) : null;
    const m = style ? new DOMMatrixReadOnly(style.transform) : null;
    if (scrub && style && m && !m.isIdentity) {
      const [ox = 0, oy = 0] = style.transformOrigin.split(' ').map(parseFloat);
      ({ left, top, right, bottom } = atRest(
        { left, top, right, bottom },
        scrub.getBoundingClientRect(),
        m,
        { x: ox, y: oy },
      ));
    }
    out.push(placeInFlow(el, { left, top, width: right - left, height: bottom - top }, nav));
  };
  const walls = Array.from(root.querySelectorAll<HTMLElement>(`[${WALL_ATTR}]`)).filter(
    // Only while its contents can move: wider than its box (a rail that wraps into a grid is not).
    (el) => el.closest(SKIP) === null && el.scrollWidth > el.clientWidth + 1,
  );
  // The restoration's tier panels share one cell while pinned, the unchosen ones only invisible
  // (RestorationSection.tsx), and its scrub shows one after another with no measure between: the
  // lanes keep clear of every one (planned at the top, they knew only the first; T-CA3 crossed
  // another's «رزرو نوبت»). Elsewhere a hidden element stays out.
  const shown = (el: Element): boolean =>
    el.closest(SKIP) === null &&
    !walls.some((wall) => wall.contains(el)) &&
    (getComputedStyle(el).visibility !== 'hidden' || el.closest(TIER_PANEL) !== null);
  for (const el of root.querySelectorAll(CONTROLS)) {
    if (shown(el)) add(el, el.getClientRects());
  }
  for (const el of root.querySelectorAll(`[${ABOVE_ATTR}] > :not([data-dock])`))
    add(el, el.getClientRects());
  for (const el of walls) add(el, el.getClientRects());
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

/** The viewport, the scroll range and the fixed bars the pose needs. */
export function measureViewport(): Viewport {
  const html = document.documentElement;
  const header = document.querySelector('header');
  const bar = document.querySelector<HTMLElement>('[data-sticky-bar]');
  return {
    width: html.clientWidth || window.innerWidth,
    height: window.innerHeight,
    maxScroll: Math.max(0, html.scrollHeight - window.innerHeight),
    insetTop: header?.offsetHeight ?? 0,
    // Shown or slid away for now, the bar comes back: the courier keeps clear of its place.
    insetBottom: bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0,
  };
}
