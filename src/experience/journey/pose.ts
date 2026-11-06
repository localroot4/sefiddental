/**
 * The courier's pose at a scroll position (docs/experience/journey.md section 3): one pure
 * function that every renderer (the WebGL courier, the DOM courier) and the tests read. Same input,
 * same output, so scrolling back plays the journey exactly in reverse and a reload anywhere shows
 * the right pose at once. No DOM and no three.js: the caller measures the docks (docks.ts).
 *
 * The model: each dock has a hold range of scroll in which the courier rides with the dock's box;
 * between two holds it travels on an eased cubic from one box's centre to the next. A pinned dock
 * (inside a sticky stage) holds for the whole pin; any other dock holds while its centre crosses
 * the middle half of the viewport. A travel spans at least 60 vh of scroll: neighbouring holds
 * give up their ends until it does.
 */
import { ARCH_SLOT, archLayout, projectArch } from './arch';

export type DockId =
  'hero' | 'services' | 'restoration' | 'workflow' | 'smile' | 'dentists' | 'booking' | 'footer';

export type Form = 'mark' | 'tooth';

/** The stations in journey order, with the courier's form at each. */
export const STATIONS: readonly { id: DockId; form: Form }[] = [
  { id: 'hero', form: 'mark' },
  { id: 'services', form: 'mark' },
  { id: 'restoration', form: 'tooth' },
  { id: 'workflow', form: 'tooth' },
  { id: 'smile', form: 'tooth' },
  { id: 'dentists', form: 'mark' },
  { id: 'booking', form: 'mark' },
  { id: 'footer', form: 'mark' },
];

const FORM = new Map(STATIONS.map((s) => [s.id, s.form]));
const ORDER = new Map(STATIONS.map((s, i) => [s.id, i]));

/** An empty DOM box the courier docks in, measured in document px with its stage in flow. */
export interface Dock {
  id: DockId;
  left: number;
  top: number;
  width: number;
  height: number;
  /**
   * Scroll range in which the box's sticky stage is stuck (its viewport top stays at
   * `top - pin.start`); null for a box that scrolls with the page.
   */
  pin: { start: number; end: number } | null;
}

export interface Viewport {
  width: number;
  height: number;
  /** The largest scrollY of the document. */
  maxScroll: number;
}

export interface Pose {
  /** Centre of the courier in viewport px. */
  x: number;
  y: number;
  /** Side of the square box the courier's form fits in (px). */
  scale: number;
  /** Turn about the vertical axis (radians) of the form shown. */
  rotation: number;
  form: Form;
  /** 0..1 through the half turn that swaps the form (0 outside a swap). */
  whip: number;
  /** 0..1 presence of the arch at the smile station (1 after it). */
  arch: number;
  /** 0..1 the arch dissolves into the smile photo (1 after the smile station). */
  smile: number;
  /** The footer playground has the mark (hand-off), or there is no courier. */
  hidden: boolean;
  /** The dock the courier holds at, null while it travels. */
  dock: DockId | null;
  /** 0..1 through the hold at `dock` (0 while travelling). */
  local: number;
  /** 0..1 through the travel toward `to` (0 at a dock). */
  travel: number;
  /** The dock the courier travels toward, null at a dock. */
  to: DockId | null;
}

/** A travel spans at least this share of the viewport height in scroll. */
export const MIN_TRAVEL_VH = 0.6;
/**
 * An unpinned dock holds while its centre is within this share of the viewport's middle; the
 * smile station holds longer, for the seat, the pull-back and the dissolve.
 */
const HOLD_VH = 0.5;
const SMILE_HOLD_VH = 0.9;
/** The form fills this share of its dock's shorter side. */
const FILL = 0.86;
/** The courier is this much smaller at the middle of a travel (it reads as distance). */
const DIP = 0.14;
/** The arc toward the page's middle, as a share of the distance to it. */
const ARC = 0.35;
/** The last stretch into the footer is a 40 px drop with the playground's bounce. */
export const FOOTER_DROP_PX = 40;
const DROP_SHARE = 0.22;

/** The whip window inside a travel (share of the travel), by the pair of forms. */
const WHIP_MIDDLE = [0.38, 0.62] as const;
/** The courier leaves the smile as a mark: the whip comes at the start of that travel. */
const WHIP_START = [0, 0.28] as const;

/** Base turn of the form at each dock (radians): a three-quarter view, flat at the footer. */
const BASE_YAW: Record<DockId, number> = {
  hero: -0.28,
  services: -0.3,
  restoration: 0,
  workflow: 0,
  smile: 0,
  dentists: -0.32,
  booking: -0.22,
  footer: 0,
};
/** The services mark turns this far across the pin, as the track moves. */
const SERVICES_TURN = 0.6;

/** The smile station: arch fades in, tooth seats, camera pulls back, arch dissolves. */
const SMILE = {
  archIn: [0, 0.18],
  seat: [0.04, 0.36],
  pull: [0.36, 0.58],
  dissolve: [0.56, 0.94],
} as const;
/** The arch spans this share of the smile box's width (before the pull-back). */
const ARCH_FILL = 0.84;
const PULL_BACK = 0.16;
/** The tooth starts this many of its own heights above the slot. */
const SEAT_LIFT = 1.3;
/** Molar.glb: crown width over the whole tooth's height (the courier box holds the height). */
export const CROWN_SHARE = 1.03 / 1.44;

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const span = (t: number, [a, b]: readonly [number, number]): number => clamp01((t - a) / (b - a));
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
/** gsap power2.inOut. */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
/** gsap bounce.out. */
export function bounceOut(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) * (t - 1.5 / d) + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) * (t - 2.25 / d) + 0.9375;
  return n * (t - 2.625 / d) * (t - 2.625 / d) + 0.984375;
}
/** gsap back.out(1.4): the seat's soft click. */
const backOut = (t: number): number => {
  const s = 1.4;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/** The dock's viewport top at scroll `y` (stuck while its stage is pinned). */
export function viewportTop(dock: Dock, y: number): number {
  const { pin } = dock;
  if (pin === null || y <= pin.start) return dock.top - y;
  if (y <= pin.end) return dock.top - pin.start;
  return dock.top - pin.start - (y - pin.end);
}

export interface Hold {
  dock: Dock;
  /** Scroll range of the hold; the first extends to -infinity and the last to +infinity. */
  start: number;
  end: number;
}

/**
 * The hold ranges of the docks present, in journey order: the pin of a pinned dock, else the
 * scroll in which its centre crosses the middle of the viewport; clamped to the scroll range,
 * then shortened at their ends so every travel spans at least MIN_TRAVEL_VH.
 */
export function holdRanges(docks: readonly Dock[], viewport: Viewport): Hold[] {
  const top = Math.max(0, viewport.maxScroll - 1);
  const clampY = (y: number): number => Math.min(top, Math.max(0, y));
  const holds = docks
    .filter((d) => ORDER.has(d.id) && d.width > 0 && d.height > 0)
    .sort((a, b) => (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0))
    .map((dock): Hold => {
      if (dock.pin) return { dock, start: clampY(dock.pin.start), end: clampY(dock.pin.end) };
      const centre = dock.top + dock.height / 2 - viewport.height / 2;
      const half = ((dock.id === 'smile' ? SMILE_HOLD_VH : HOLD_VH) * viewport.height) / 2;
      return { dock, start: clampY(centre - half), end: clampY(centre + half) };
    });
  const min = MIN_TRAVEL_VH * viewport.height;
  for (let i = 1; i < holds.length; i += 1) {
    const a = holds[i - 1]!;
    const b = holds[i]!;
    // A hold never starts before the previous one ends (docks out of order collapse onto it).
    if (b.start < a.start) b.start = a.start;
    if (b.end < b.start) b.end = b.start;
    let need = min - (b.start - a.end);
    if (need <= 0) continue;
    // Half from each side, then the rest from whichever side still has room.
    const giveA = Math.min(need / 2, a.end - a.start);
    const giveB = Math.min(need / 2, b.end - b.start);
    a.end -= giveA;
    b.start += giveB;
    need -= giveA + giveB;
    if (need > 0) {
      const moreB = Math.min(need, b.end - b.start);
      b.start += moreB;
      need -= moreB;
      const moreA = Math.min(need, a.end - a.start);
      a.end -= moreA;
    }
    // Overlapping docks that could not make room: no travel, the next hold starts here.
    if (b.start < a.end) b.start = a.end;
    if (b.end < b.start) b.end = b.start;
  }
  return holds;
}

/** Where the arch sits in the smile box at its own progress (pull-back included). */
export function archFrame(
  dock: Dock,
  y: number,
  local: number,
): { cx: number; cy: number; width: number } {
  const pull = 1 - PULL_BACK * smoothstep(span(local, SMILE.pull));
  return {
    cx: dock.left + dock.width / 2,
    cy: viewportTop(dock, y) + dock.height / 2,
    width: dock.width * ARCH_FILL * pull,
  };
}

const SLOT = archLayout()[ARCH_SLOT]!;
const SLOT_AT = projectArch(SLOT);

interface Docked {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** The pose of the form at a dock at scroll `y` and hold progress `local` (no whip). */
function docked(dock: Dock, y: number, local: number): Docked {
  if (dock.id === 'smile') {
    const frame = archFrame(dock, y, local);
    const crown = SLOT.width * frame.width;
    const scale = crown / CROWN_SHARE;
    const seat = backOut(span(local, SMILE.seat));
    return {
      x: frame.cx + SLOT_AT.u * frame.width,
      y: frame.cy + SLOT_AT.v * frame.width - (1 - seat) * SEAT_LIFT * scale,
      scale,
      rotation: SLOT.yaw,
    };
  }
  const turn = dock.id === 'services' ? (local - 0.5) * SERVICES_TURN : 0;
  return {
    x: dock.left + dock.width / 2,
    y: viewportTop(dock, y) + dock.height / 2,
    scale: Math.min(dock.width, dock.height) * FILL,
    rotation: BASE_YAW[dock.id] + turn,
  };
}

/** The arch and the smile follow the smile station's own progress, before, during and after it. */
function smileState(holds: readonly Hold[], y: number): { arch: number; smile: number } {
  const hold = holds.find((h) => h.dock.id === 'smile');
  // Without the station the photo simply shows.
  if (hold === undefined) return { arch: 0, smile: 1 };
  const local =
    y <= hold.start ? 0 : y >= hold.end ? 1 : (y - hold.start) / (hold.end - hold.start);
  if (y > hold.end) return { arch: 1, smile: 1 };
  return {
    arch: smoothstep(span(local, SMILE.archIn)),
    smile: smoothstep(span(local, SMILE.dissolve)),
  };
}

export const NO_POSE: Pose = {
  x: 0,
  y: 0,
  scale: 0,
  rotation: 0,
  form: 'mark',
  whip: 0,
  arch: 0,
  smile: 1,
  hidden: true,
  dock: null,
  local: 0,
  travel: 0,
  to: null,
};

/**
 * The courier's pose for one frame. `tier` 0 has no courier. Pure: the same scroll position,
 * docks and viewport give the same pose, scrolling down or up.
 */
export function courierPose(
  scrollY: number,
  docks: readonly Dock[],
  viewport: Viewport,
  tier: number,
): Pose {
  if (tier < 1 || !Number.isFinite(scrollY)) return NO_POSE;
  const holds = holdRanges(docks, viewport);
  if (holds.length === 0) return NO_POSE;
  const y = scrollY;
  const { arch, smile } = smileState(holds, y);

  // At a dock: before the first hold the courier waits at the first dock, after the last at it.
  const atIndex = holds.findIndex(
    (h, i) => (i === 0 || y >= h.start) && (i === holds.length - 1 || y <= h.end),
  );
  if (atIndex >= 0) {
    const hold = holds[atIndex]!;
    const local =
      hold.end > hold.start
        ? clamp01((y - hold.start) / (hold.end - hold.start))
        : y >= hold.end
          ? 1
          : 0;
    const at = docked(hold.dock, y, local);
    return {
      ...at,
      form: FORM.get(hold.dock.id) ?? 'mark',
      whip: 0,
      arch,
      smile,
      hidden: hold.dock.id === 'footer',
      dock: hold.dock.id,
      local,
      travel: 0,
      to: null,
    };
  }

  // Travelling between the hold that ended and the next one.
  const next = holds.findIndex((h) => y < h.start);
  const a = holds[next - 1]!;
  const b = holds[next]!;
  const t = clamp01((y - a.end) / (b.start - a.end));
  const from = docked(a.dock, y, 1);
  const to = docked(b.dock, y, 0);
  const formA = FORM.get(a.dock.id) ?? 'mark';
  const formB = FORM.get(b.dock.id) ?? 'mark';

  const footer = b.dock.id === 'footer';
  // Into the footer the path ends 40 px above the box, and the rest is the drop.
  const pathT = footer ? clamp01(t / (1 - DROP_SHARE)) : t;
  const e = easeInOut(pathT);
  const endY = footer ? to.y - FOOTER_DROP_PX : to.y;
  const middle = viewport.width / 2;
  const bend = ARC * (middle - (from.x + to.x) / 2);
  const p1x = mix(from.x, to.x, 1 / 3) + bend;
  const p2x = mix(from.x, to.x, 2 / 3) + bend;
  const u = 1 - e;
  let x = u * u * u * from.x + 3 * u * u * e * p1x + 3 * u * e * e * p2x + e * e * e * to.x;
  let yy = mix(from.y, endY, e);
  if (footer && t > 1 - DROP_SHARE) {
    x = to.x;
    yy = endY + FOOTER_DROP_PX * bounceOut((t - (1 - DROP_SHARE)) / DROP_SHARE);
  }

  let rotation = mix(from.rotation, to.rotation, e);
  let form = formA;
  let whip = 0;
  if (formA !== formB) {
    whip = smoothstep(
      span(t, formA === 'tooth' && a.dock.id === 'smile' ? WHIP_START : WHIP_MIDDLE),
    );
    // The old form turns to edge-on, the new one comes out of the same spin: the docks' own
    // turn fades out toward the swap, so both forms are exactly edge-on there.
    form = whip < 0.5 ? formA : formB;
    rotation =
      rotation * (1 - Math.sin(Math.PI * whip)) + Math.PI * whip - (whip < 0.5 ? 0 : Math.PI);
  }

  return {
    x,
    y: yy,
    scale: mix(from.scale, to.scale, e) * (1 - DIP * Math.sin(Math.PI * pathT)),
    rotation,
    form,
    whip,
    arch,
    smile,
    hidden: false,
    dock: null,
    local: 0,
    travel: t,
    to: b.dock.id,
  };
}

/** 0..1 how far the tooth has seated into the arch (its crown turns to the camera); 0 for the mark. */
export function seatAmount(pose: Pose): number {
  return pose.form === 'tooth' ? pose.arch : 0;
}

/**
 * The DOM courier's turn about the vertical axis: the pose's, except a seated tooth, which shows
 * its crown's footprint (the SVG arch's own angle) instead.
 */
export function domSpin(pose: Pose): number {
  return pose.rotation * (1 - seatAmount(pose));
}

/**
 * How much of the idle motion (the breath, the slow turn) shows: none at the footer, where the
 * mark must land exactly on the playground's part, fading out on the way there.
 */
export function idleAmount(pose: Pose): number {
  if (pose.hidden || pose.dock === 'footer') return 0;
  return pose.to === 'footer' ? 1 - pose.travel : 1;
}
