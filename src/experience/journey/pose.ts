/**
 * The courier's pose at a scroll position (docs/experience/journey.md section 3): one pure
 * function that every renderer (the WebGL courier, the DOM courier) and the tests read. Same input,
 * same output, so scrolling back plays the journey exactly in reverse and a reload anywhere shows
 * the right pose at once. No DOM and no three.js: the caller measures the docks (docks.ts).
 *
 * The model: each dock has a hold range of scroll in which the courier rides with the dock's box;
 * between two holds it travels on an eased cubic from one box's centre to the next. A pinned dock
 * (inside a sticky stage) holds for the whole pin; any other dock holds while its centre crosses
 * the middle half of the viewport. A travel spans at least 45 vh of scroll: neighbouring holds
 * give up their ends until it does.
 */
import { ARCH_PHOTO } from '@/lib/archPhoto';

import { ARCH_SLOT, archLayout, projectArch } from './arch';
import { placeOn, routeSteps, type Route } from './route';

export type DockId =
  'header' | 'services' | 'restoration' | 'workflow' | 'smile' | 'dentists' | 'booking' | 'footer';

export type Form = 'mark' | 'tooth';

/**
 * The stations in journey order, with the courier's form at each. D1 is the header logo's own
 * mark (owner, 2026-11-13): the courier lifts out of the logo as the reader scrolls and comes home
 * into it at the top, as it lands in the footer's lockup at the end.
 */
export const STATIONS: readonly { id: DockId; form: Form }[] = [
  { id: 'header', form: 'mark' },
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

/** A box in document px, measured with its stage in flow. */
export interface Box {
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

/** An empty DOM box the courier docks in. */
export interface Dock extends Box {
  id: DockId;
}

export interface Viewport {
  width: number;
  height: number;
  /** The largest scrollY of the document. */
  maxScroll: number;
  /** The sticky header's height: the courier never goes under it (px). */
  insetTop?: number;
  /** The sticky bar's height at the bottom (phones and tablets; px). */
  insetBottom?: number;
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
  /** 0..1 a light sweeps across the smile photo's teeth (0 outside the sweep). */
  glint: number;
  /**
   * 0..1 the tooth condenses out of the glint and lifts off the photo toward the reader (1 after
   * the smile station): the D5 hand-off.
   */
  lift: number;
  /**
   * 0..1 how much of the courier's form shows: it sinks into the smile with the arch and condenses
   * back out of the glint (1 everywhere else).
   */
  presence: number;
  /** The header logo or the footer playground has the mark (hand-off), or there is no courier. */
  hidden: boolean;
  /** The dock the courier holds at, null while it travels. */
  dock: DockId | null;
  /** 0..1 through the hold at `dock` (0 while travelling). */
  local: number;
  /** 0..1 through the travel toward `to` (0 at a dock). */
  travel: number;
  /** The dock the courier travels toward, null at a dock. */
  to: DockId | null;
  /**
   * 1, except where a travel finds no clear lane of the minimum size: the courier fades there
   * (route.ts, the last resort).
   */
  opacity: number;
}

/** A travel spans at least this share of the viewport height in scroll. */
export const MIN_TRAVEL_VH = 0.6;
/** The travel into the footer (a 40 px drop at its end) spans at least this share. */
const FOOTER_TRAVEL_VH = 0.45;
/**
 * An unpinned dock holds while its centre is within this share of the viewport's middle; the
 * smile station holds longer, for the seat, the pull-back and the dissolve.
 */
const HOLD_VH = 0.5;
const SMILE_HOLD_VH = 0.9;
/** No hold is shorter than this share of the viewport height (unless the scroll range ends). */
const MIN_HOLD_VH = 0.2;
/** The courier lands on the footer box once the box's bottom is this far down the viewport. */
const FOOTER_LAND_VH = 0.92;
/** The courier's mark is this share of its box's height (JourneyLayer.tsx draws it so). */
export const MARK_SHARE = 0.92;
/** Clear space between a docked courier and the header or the sticky bar (px). */
const BAR_MARGIN = 8;
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
  header: 0,
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

/**
 * The smile station: the arch fades in, the tooth seats, the camera pulls back, the arch (and the
 * seated tooth) dissolve into the smile photo; a light sweeps across the smile's teeth, and at the
 * brightest tooth it condenses into the glazed tooth, which lifts off the photo toward the reader
 * while the photo dims and settles back (the D5 hand-off; the travel then whips it into the mark).
 */
const SMILE = {
  archIn: [0, 0.16],
  seat: [0.04, 0.3],
  pull: [0.3, 0.46],
  dissolve: [0.46, 0.66],
  glint: [0.64, 0.86],
  condense: [0.8, 0.9],
  lift: [0.8, 1],
} as const;
/** The lifted tooth's size, as a share of the smile box's shorter side (at least its seated size). */
const LIFT_SIZE = 0.26;
/** The camera pulls back this share as the arch settles, to the photo's own framing. */
const PULL_BACK = 0.16;
/** The tooth starts this many of its own heights above the slot. */
const SEAT_LIFT = 1.3;
/** Molar.glb: crown width over the whole tooth's height (the courier box holds the height). */
export const CROWN_SHARE = 1.03 / 1.44;

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const span = (t: number, [a, b]: readonly [number, number]): number => clamp01((t - a) / (b - a));
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
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

/** The box's viewport top at scroll `y` (stuck while its stage is pinned). */
export function viewportTop(dock: Box, y: number): number {
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
  const limits = new Map<Dock, number>();
  const holds = docks
    .filter((d) => ORDER.has(d.id) && d.width > 0 && d.height > 0)
    .sort((a, b) => (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0))
    .map((dock): Hold => {
      // The header logo has the mark at the very top only: any scroll lifts it out.
      if (dock.id === 'header') return { dock, start: 0, end: 0 };
      if (dock.pin) return { dock, start: clampY(dock.pin.start), end: clampY(dock.pin.end) };
      // The footer hands the mark over as soon as its box is in view: the reader can take it.
      if (dock.id === 'footer') {
        const land = clampY(dock.top + dock.height - FOOTER_LAND_VH * viewport.height);
        return { dock, start: land, end: land };
      }
      const centre = dock.top + dock.height / 2 - viewport.height / 2;
      const half = ((dock.id === 'smile' ? SMILE_HOLD_VH : HOLD_VH) * viewport.height) / 2;
      // Riding with its dock, the courier stays clear of the header and the sticky bar: the
      // hold ends before it reaches either (the smile's slot sits off the box's centre).
      const reach =
        (Math.min(dock.width, dock.height) * FILL) / 2 +
        BAR_MARGIN +
        (dock.id === 'smile' ? dock.height / 4 : 0);
      const first =
        dock.top + dock.height / 2 - (viewport.height - (viewport.insetBottom ?? 0) - reach);
      const last = dock.top + dock.height / 2 - ((viewport.insetTop ?? 0) + reach);
      // Not the smile: its sequence needs its whole hold.
      if (dock.id !== 'smile') limits.set(dock, Math.max(last, centre));
      return {
        dock,
        start: clampY(Math.max(centre - half, Math.min(first, centre))),
        end: clampY(Math.min(centre + half, Math.max(last, centre))),
      };
    });
  const min = MIN_TRAVEL_VH * viewport.height;
  // The last travel is a short drop into the footer's lockup: its own minimum, so the reader who
  // has the footer in view finds the mark home.
  const minInto = (b: Hold): number =>
    b.dock.id === 'footer' ? FOOTER_TRAVEL_VH * viewport.height : min;
  // A hold keeps a short stretch of its own, so a station's sequence (the smile) never cuts.
  const keep = MIN_HOLD_VH * viewport.height;
  const room = (h: Hold): number => Math.max(0, h.end - h.start - keep);
  for (let i = 1; i < holds.length; i += 1) {
    const a = holds[i - 1]!;
    const b = holds[i]!;
    // A hold never starts before the previous one ends (docks out of order line up after it).
    if (b.start < a.start) b.start = a.start;
    if (b.end < b.start + keep) b.end = Math.min(top, b.start + keep);
    let need = minInto(b) - (b.start - a.end);
    if (need <= 0) continue;
    // Half from each side, then the rest from whichever side still has room.
    const giveA = Math.min(need / 2, room(a));
    const giveB = Math.min(need / 2, room(b));
    a.end -= giveA;
    b.start += giveB;
    need -= giveA + giveB;
    const moreB = Math.max(0, Math.min(need, room(b)));
    b.start += moreB;
    need -= moreB;
    const moreA = Math.max(0, Math.min(need, room(a)));
    a.end -= moreA;
    need -= moreA;
    // Docks too close or out of order to make room: the next hold moves later, so the travel
    // still spans its minimum (up to the end of the scroll range), never a cut.
    if (need > 0) {
      // Never past the scroll where the dock reaches the header: a shorter travel, not a hold
      // pushed under it (docks close together on a tablet).
      const cap = Math.min(top, limits.get(b.dock) ?? top);
      b.start = Math.max(b.start, Math.min(cap - keep, b.start + need));
      b.end = Math.min(top, Math.max(b.end, b.start + keep));
    }
    if (b.start < a.end) b.start = a.end;
    if (b.end < b.start) b.end = b.start;
  }
  // A hold the travels pushed late still ends before its dock reaches the header.
  for (const h of holds) {
    const limit = limits.get(h.dock);
    if (limit !== undefined && h.end > limit) h.end = Math.max(h.start, clampY(limit));
  }
  return holds;
}

/**
 * Where the arch sits in the smile box at its own progress: after the pull-back exactly where the
 * occlusal photo's arch lies (src/lib/archPhoto.ts), so the cross-fade is registered.
 */
export function archFrame(
  dock: Dock,
  y: number,
  local: number,
): { cx: number; cy: number; width: number } {
  const pull = 1 - PULL_BACK * (1 - smoothstep(span(local, SMILE.pull)));
  return {
    cx: dock.left + ARCH_PHOTO.centre.u * dock.width,
    cy: viewportTop(dock, y) + ARCH_PHOTO.centre.v * dock.height,
    width: (ARCH_PHOTO.archWidth * dock.width) / pull,
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
    if (local >= SMILE.lift[0]) {
      // Out of the glint at the first molar it seated in: from the seated crown to the lifted
      // tooth, rising toward the reader.
      const e = smoothstep(span(local, SMILE.lift));
      const seated = (SLOT.width * frame.width) / CROWN_SHARE;
      const size = Math.max(seated, LIFT_SIZE * Math.min(dock.width, dock.height));
      return {
        x: frame.cx + SLOT_AT.u * frame.width,
        y: frame.cy + SLOT_AT.v * frame.width - 0.5 * size * e,
        scale: mix(seated, size, e),
        rotation: mix(SLOT.yaw, BASE_YAW.dentists, e),
      };
    }
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
  // In the logo the mark is drawn at the logo's own size: the courier's box is that mark's height.
  if (dock.id === 'header') {
    return {
      x: dock.left + dock.width / 2,
      y: viewportTop(dock, y) + dock.height / 2,
      scale: dock.height / MARK_SHARE,
      rotation: 0,
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

interface SmileState {
  arch: number;
  smile: number;
  glint: number;
  lift: number;
  presence: number;
}

/**
 * A docked pose kept clear of the header and the sticky bar: a hold the travels pushed late (docks
 * close together) would ride its dock under them, so the courier stops at their edge instead. Not
 * the footer, which lands on its box, nor the header logo, which is in the header itself.
 */
function inView(at: Docked, dock: Dock, viewport: Viewport): Docked {
  if (dock.id === 'footer' || dock.id === 'header') return at;
  const half = (at.scale * FORM_SHARE) / 2 + BAR_MARGIN;
  const top = (viewport.insetTop ?? 0) + half;
  const bottom = viewport.height - (viewport.insetBottom ?? 0) - half;
  if (top > bottom) return at;
  return at.y < top ? { ...at, y: top } : at.y > bottom ? { ...at, y: bottom } : at;
}

/** The arch, the smile and the hand-off follow the smile station's own progress, before, during and after it. */
function smileState(holds: readonly Hold[], y: number): SmileState {
  const hold = holds.find((h) => h.dock.id === 'smile');
  // Without the station the photo simply shows.
  if (hold === undefined) return { arch: 0, smile: 1, glint: 0, lift: 1, presence: 1 };
  if (y > hold.end) return { arch: 1, smile: 1, glint: 0, lift: 1, presence: 1 };
  const local = y <= hold.start ? 0 : (y - hold.start) / Math.max(1e-6, hold.end - hold.start);
  const glint = span(local, SMILE.glint);
  return {
    arch: smoothstep(span(local, SMILE.archIn)),
    smile: smoothstep(span(local, SMILE.dissolve)),
    glint: glint > 0 && glint < 1 ? glint : 0,
    lift: smoothstep(span(local, SMILE.lift)),
    presence:
      local < SMILE.condense[0]
        ? 1 - smoothstep(span(local, SMILE.dissolve))
        : smoothstep(span(local, SMILE.condense)),
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
  glint: 0,
  lift: 1,
  presence: 1,
  hidden: true,
  dock: null,
  local: 0,
  travel: 0,
  to: null,
  opacity: 0,
};

function placePose(
  scrollY: number,
  docks: readonly Dock[],
  viewport: Viewport,
  tier: number,
  lanes: Lanes | null,
): Pose {
  if (tier < 1 || !Number.isFinite(scrollY)) return NO_POSE;
  const holds = holdRanges(docks, viewport);
  if (holds.length === 0) return NO_POSE;
  const y = scrollY;
  const station = smileState(holds, y);

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
    // Before the first hold it waits at its dock, below the fold at the top of a phone page.
    const waiting = atIndex === 0 && y < hold.start;
    const at = waiting
      ? docked(hold.dock, y, local)
      : inView(docked(hold.dock, y, local), hold.dock, viewport);
    return {
      ...at,
      form: FORM.get(hold.dock.id) ?? 'mark',
      whip: 0,
      ...station,
      // Only at the smile station does the form sink and condense.
      presence: hold.dock.id === 'smile' ? station.presence : 1,
      hidden: hold.dock.id === 'footer' || hold.dock.id === 'header',
      dock: hold.dock.id,
      local,
      travel: 0,
      to: null,
      opacity: 1,
    };
  }

  // Travelling between the hold that ended and the next one.
  const next = holds.findIndex((h) => y < h.start);
  const a = holds[next - 1]!;
  const b = holds[next]!;
  const t = clamp01((y - a.end) / (b.start - a.end));
  const path = travelPath(a, b, viewport);
  // Smoothstep, not power2: a peak 1.5 times the average speed instead of 2 (owner: calmer moves).
  const e = smoothstep(t);
  const formA = FORM.get(a.dock.id) ?? 'mark';
  const formB = FORM.get(b.dock.id) ?? 'mark';
  let rotation = mix(path.from.rotation, path.to.rotation, e);
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
  const route = lanes?.route(a, b) ?? null;
  const place = route ? placeOn(route, y) : { ...path.at(t, y), o: 1 };

  return {
    x: place.x,
    y: place.y,
    scale: place.s,
    rotation,
    form,
    whip,
    ...station,
    presence: 1,
    hidden: false,
    dock: null,
    local: 0,
    travel: t,
    to: b.dock.id,
    opacity: place.o,
  };
}

interface Path {
  from: Docked;
  to: Docked;
  /** The eased path at travel progress t and scroll y (viewport px). */
  at(t: number, y: number): { x: number; y: number; s: number };
}

/** A travel rides with its docks for this much scroll at each end (share of the viewport). */
const RIDE_VH = 0.25;

/**
 * The travel's own eased path (viewport px): it leaves riding with its dock, floats over the
 * scrolling page between the two docks' poses where the travel leaves and reaches them (so it
 * stays on screen), and rides with the next dock again as it arrives, so its speed never jumps. A
 * cubic with an arc toward the page's middle and a dip in size half way; into the footer the last
 * stretch is a 40 px drop with the bounce onto the box.
 */
function travelPath(a: Hold, b: Hold, viewport: Viewport): Path {
  const from = inView(docked(a.dock, a.end, 1), a.dock, viewport);
  const to = inView(docked(b.dock, b.start, 0), b.dock, viewport);
  const footer = b.dock.id === 'footer';
  const length = b.start - a.end;
  const drop = footer ? Math.min(DROP_SHARE * length, RIDE_VH * viewport.height) : 0;
  const ride = Math.min(RIDE_VH * viewport.height, (length - drop) / 3);
  const middle = viewport.width / 2;
  const bend = ARC * (middle - (from.x + to.x) / 2);
  const p1x = mix(from.x, to.x, 1 / 3) + bend;
  const p2x = mix(from.x, to.x, 2 / 3) + bend;
  return {
    from,
    to,
    at(t, y) {
      // The ends ride with their docks, eased in and out of the float.
      const leave = ride > 0 ? smoothstep(clamp01((y - a.end) / ride)) : 1;
      const reach = ride > 0 ? smoothstep(clamp01((b.start - drop - y) / ride)) : 1;
      const start = inView(docked(a.dock, y, 1), a.dock, viewport);
      const end = inView(docked(b.dock, y, 0), b.dock, viewport);
      const fx = mix(start.x, from.x, leave);
      const fy = mix(start.y, from.y, leave);
      const tx = mix(end.x, to.x, reach);
      const ty = mix(end.y, to.y, reach) - (footer ? FOOTER_DROP_PX : 0);
      // Into the footer the path ends 40 px above the box, and the rest is the drop.
      const pathT = footer ? clamp01((y - a.end) / Math.max(1e-6, length - drop)) : t;
      const e = smoothstep(pathT);
      const u = 1 - e;
      // The control points move with the ends.
      let x =
        u * u * u * fx +
        3 * u * u * e * (p1x + fx - from.x) +
        3 * u * e * e * (p2x + tx - to.x) +
        e * e * e * tx;
      // Out of the header the mark first drops out of the bar, then drifts sideways.
      let yy = mix(fy, ty, a.dock.id === 'header' ? 1 - (1 - e) * (1 - e) : e);
      if (footer && y > b.start - drop) {
        const home = viewportTop(b.dock, y) + b.dock.height / 2;
        x = b.dock.left + b.dock.width / 2;
        yy = home - FOOTER_DROP_PX + FOOTER_DROP_PX * bounceOut((y - (b.start - drop)) / drop);
      }
      return { x, y: yy, s: mix(from.scale, to.scale, e) * (1 - DIP * Math.sin(Math.PI * pathT)) };
    },
  };
}

/** The courier shrinks in a narrow lane, to this share of its smaller dock size at least. */
const LANE_MIN_SHARE = 0.4;
const LANE_MIN_PX = 28;

/**
 * The travels' lanes of one measure, planned ahead, off the scroll tick (route.ts): `next()`
 * plans one travel (the driver calls it in idle time, the travel nearest the reader first), and
 * a travel uses its lane once `use()` let it in, never in the middle of that travel, so the
 * courier never jumps to a lane; until then it keeps the eased path. Routes are kept across
 * measures by the travel's own inputs (its docks' places, the obstacles, the width, the height
 * in 96 px steps), so a toolbar that resizes the viewport plans nothing again.
 */
export interface Lanes {
  /**
   * Plans on, the travel nearest `near` (a scroll position) first, while `time()` (ms left in the
   * idle slot) lasts; false when nothing is left to plan.
   */
  next(near?: number, time?: () => number): boolean;
  /** Lets in every planned lane whose travel is not under way at scroll `y`. */
  use(y: number): void;
  /** Plans and lets in every lane now (tests, a still page). */
  all(): Lanes;
  /** Milliseconds spent planning, and the travels planned. */
  stats(): { ms: number; planned: number; pending: number };
  route(a: Hold, b: Hold): Route | null;
}

const ROUTES = new Map<string, Route>();
const ROUTES_KEPT = 48;

const roughHash = (boxes: readonly Box[]): number => {
  let h = boxes.length;
  for (const b of boxes)
    h = (h * 31 + Math.round(b.left + 3 * b.top + 5 * b.width + 7 * b.height)) | 0;
  return h;
};

export function prepareLanes(
  docks: readonly Dock[],
  viewport: Viewport,
  obstacles: readonly Box[],
): Lanes {
  const holds = holdRanges(docks, viewport);
  const scope = `${Math.round(viewport.width)}|${Math.round(viewport.height / 96)}|${viewport.insetTop ?? 0}|${viewport.insetBottom ?? 0}|${roughHash(obstacles)}`;
  const travels = holds.slice(1).map((b, i) => {
    const a = holds[i]!;
    const key = `${scope}|${a.dock.id}>${b.dock.id}|${Math.round(a.end / 8)}|${Math.round(b.start / 8)}|${roughHash([a.dock, b.dock])}`;
    return { a, b, key };
  });
  const live = new Set<string>();
  let current: { key: string; steps: Generator<void, Route> } | null = null;
  let ms = 0;
  let planned = 0;
  const pending = () => travels.filter((t) => !ROUTES.has(t.key));
  const lanes: Lanes = {
    next(near = 0, time = () => Infinity) {
      do {
        if (current === null) {
          const left = pending();
          if (left.length === 0) return false;
          left.sort(
            (p, q) =>
              Math.abs((p.a.end + p.b.start) / 2 - near) -
              Math.abs((q.a.end + q.b.start) / 2 - near),
          );
          const { a, b, key } = left[0]!;
          const path = travelPath(a, b, viewport);
          current = {
            key,
            steps: routeSteps({
              y0: a.end,
              y1: b.start,
              base: (t, y) => path.at(t, y),
              obstacles,
              // Out of the header logo the lane starts in the header band itself.
              viewport: a.dock.id === 'header' ? { ...viewport, insetTop: 0 } : viewport,
              min: Math.max(LANE_MIN_PX, LANE_MIN_SHARE * Math.min(path.from.scale, path.to.scale)),
            }),
          };
        }
        const started = performance.now();
        const r = current.steps.next();
        ms += performance.now() - started;
        if (r.done) {
          ROUTES.set(current.key, r.value);
          if (ROUTES.size > ROUTES_KEPT) ROUTES.delete(ROUTES.keys().next().value!);
          planned += 1;
          current = null;
        }
      } while (time() > 4);
      return current !== null || pending().length > 0;
    },
    use(y) {
      for (const t of travels) {
        if (live.has(t.key) || !ROUTES.has(t.key)) continue;
        // Not while the courier is on that travel: it would leave the eased path in one frame.
        if (y > t.a.end && y < t.b.start) continue;
        live.add(t.key);
      }
    },
    all() {
      while (lanes.next(0, () => Infinity) && pending().length + (current ? 1 : 0) > 0);
      for (const t of travels) if (ROUTES.has(t.key)) live.add(t.key);
      return lanes;
    },
    stats: () => ({ ms, planned, pending: pending().length }),
    route(a, b) {
      const t = travels.find((x) => x.a.dock.id === a.dock.id && x.b.dock.id === b.dock.id);
      if (!t || !live.has(t.key)) return null;
      return ROUTES.get(t.key) ?? null;
    },
  };
  return lanes;
}

/** The share of the courier's box its form fills (the box holds the turn and the shadow). */
export const FORM_SHARE = 0.8;

/**
 * The courier's pose for one frame. `tier` 0 has no courier. `lanes` are the travels' lanes round
 * the page's text, controls and the boxes painted above the courier (prepareLanes, planned ahead
 * off the tick): a travel whose lane is in goes through it, never over them. Pure: the same scroll
 * position, docks, viewport and lanes give the same pose, scrolling down or up.
 */
export function courierPose(
  scrollY: number,
  docks: readonly Dock[],
  viewport: Viewport,
  tier: number,
  lanes: Lanes | null = null,
): Pose {
  return placePose(scrollY, docks, viewport, tier, lanes);
}

/** 0..1 how far the tooth has seated into the arch (its crown turns to the camera); 0 for the mark. */
export function seatAmount(pose: Pose): number {
  return pose.form === 'tooth' ? pose.arch * (1 - pose.lift) : 0;
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
 * mark must land exactly on the playground's part, fading out on the way there, and none as it
 * leaves the header logo, fading in on the way to D2.
 */
export function idleAmount(pose: Pose): number {
  if (pose.hidden || pose.dock === 'footer') return 0;
  if (pose.to === 'footer') return 1 - pose.travel;
  return pose.to === 'services' ? pose.travel : 1;
}

/**
 * 0..1 how far the smile photo dims and settles back while the tooth lifts off it; it recovers as
 * the tooth flies on to the dentists.
 */
export function photoDim(pose: Pose): number {
  if (pose.dock === 'smile') return pose.lift;
  if (pose.to === 'dentists' && pose.dock === null)
    return 1 - smoothstep(clamp01(pose.travel / 0.4));
  return 0;
}

/**
 * 0..1 a soft teal light sweeps across the dentists' cards as the mark arrives at D6 (introducing
 * the team); 0 elsewhere and once it has settled.
 */
export function sweepAmount(pose: Pose): number {
  if (pose.to === 'dentists' && pose.dock === null) return span(pose.travel, [0.35, 1]);
  if (pose.dock === 'dentists') return pose.local < 0.25 ? 1 : 0;
  return 0;
}
