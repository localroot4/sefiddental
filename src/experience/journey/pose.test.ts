import { describe, expect, it } from 'vitest';

import { ARCH_PHOTO } from '@/lib/archPhoto';

import { ARCH_DEPTH, ARCH_SLOT, ARCH_TEETH, archLayout, footprintAngle, projectArch } from './arch';
import {
  archFrame,
  bounceOut,
  courierPose,
  CROWN_SHARE,
  FOOTER_DROP_PX,
  FORM_SHARE,
  holdRanges,
  domSpin,
  idleAmount,
  seatAmount,
  MIN_TRAVEL_VH,
  NO_POSE,
  STATIONS,
  viewportTop,
  type Box,
  type Dock,
  type DockId,
  type Pose,
  type Viewport,
} from './pose';

const VIEW: Viewport = { width: 1440, height: 900, maxScroll: 12_000 };

/** A desktop page: the three pinned stages (services, restoration, workflow) and five boxes. */
function page(): Dock[] {
  return [
    { id: 'hero', left: 120, top: 1000, width: 320, height: 240, pin: null },
    {
      id: 'services',
      left: 300,
      top: 1600,
      width: 200,
      height: 150,
      pin: { start: 1500, end: 3300 },
    },
    {
      id: 'restoration',
      left: 600,
      top: 3700,
      width: 190,
      height: 230,
      pin: { start: 3600, end: 5400 },
    },
    {
      id: 'workflow',
      left: 80,
      top: 6000,
      width: 360,
      height: 380,
      pin: { start: 5700, end: 7500 },
    },
    // The arch band sticks while the journey runs (SmileBand.tsx).
    { id: 'smile', left: 520, top: 8300, width: 400, height: 500, pin: { start: 8228, end: 9488 } },
    { id: 'dentists', left: 300, top: 10_400, width: 220, height: 120, pin: null },
    { id: 'booking', left: 200, top: 11_400, width: 192, height: 192, pin: null },
    { id: 'footer', left: 1200, top: 12_500, width: 96, height: 120, pin: null },
  ];
}

const formOf = (id: DockId) => STATIONS.find((s) => s.id === id)!.form;
const holdsOf = (docks = page(), view = VIEW) => holdRanges(docks, view);
const middleOf = (id: DockId, docks = page(), view = VIEW): number => {
  const h = holdsOf(docks, view).find((x) => x.dock.id === id)!;
  return (h.start + h.end) / 2;
};
const at = (y: number, docks = page(), view = VIEW): Pose => courierPose(y, docks, view, 2);

describe('courierPose: docks', () => {
  it('J1 holds at every dock with its form, centred in the box (the smile box seats the tooth)', () => {
    for (const { id } of STATIONS) {
      const y = middleOf(id);
      const pose = at(y);
      const dock = page().find((d) => d.id === id)!;
      expect(pose.dock, id).toBe(id);
      expect(pose.form, id).toBe(formOf(id));
      expect(pose.local, id).toBeCloseTo(0.5, 5);
      expect(pose.whip, id).toBe(0);
      if (id === 'smile') continue;
      expect(pose.x, id).toBeCloseTo(dock.left + dock.width / 2, 5);
      expect(pose.y, id).toBeCloseTo(viewportTop(dock, y) + dock.height / 2, 5);
      expect(pose.scale, id).toBeCloseTo(Math.min(dock.width, dock.height) * 0.86, 5);
      // The form stays inside its box: no text around the box is ever under it at rest.
      expect(pose.x - pose.scale / 2).toBeGreaterThanOrEqual(dock.left);
      expect(pose.x + pose.scale / 2).toBeLessThanOrEqual(dock.left + dock.width);
    }
  });

  it('J2 a pinned dock holds still on screen for its whole pin; an unpinned one rides with the page', () => {
    const services = page()[1]!;
    const a = at(1600);
    const b = at(3000);
    expect(a.dock).toBe('services');
    expect(b.dock).toBe('services');
    expect(a.y).toBeCloseTo(b.y, 5);
    expect(a.y).toBeCloseTo(services.top - 1500 + services.height / 2, 5);
    // The services mark turns a little as the track moves.
    expect(b.rotation).toBeGreaterThan(a.rotation);
    expect(b.rotation - a.rotation).toBeLessThan(0.7);
    const dentists = middleOf('dentists');
    expect(at(dentists + 50).y).toBeCloseTo(at(dentists).y - 50, 5);
  });

  it('J3 before the first hold the courier waits at the first dock; at the top it is below the fold', () => {
    const pose = at(0);
    expect(pose.dock).toBe('hero');
    expect(pose.local).toBe(0);
    expect(pose.y - pose.scale / 2).toBeGreaterThan(VIEW.height);
  });

  it('J4 the footer dock hands the mark to the playground: hidden once the courier is home', () => {
    const last = holdsOf().at(-1)!;
    expect(last.dock.id).toBe('footer');
    expect(at(last.start).hidden).toBe(true);
    expect(at(VIEW.maxScroll).hidden).toBe(true);
    expect(at(VIEW.maxScroll).dock).toBe('footer');
    expect(at(last.start - 1).hidden).toBe(false);
    // The hand-off is reachable: it comes before the end of the scroll range.
    expect(last.start).toBeLessThanOrEqual(VIEW.maxScroll);
  });

  it('J4b the courier lands on the footer box as soon as the box is in view, not at mid-screen', () => {
    const docks = page();
    const footer = docks.find((d) => d.id === 'footer')!;
    const land = holdRanges(docks, VIEW).at(-1)!.start;
    // The box's bottom at 92 % of the viewport height: the reader can take the mark there.
    expect(land).toBeCloseTo(footer.top + footer.height - 0.92 * VIEW.height, 5);
    expect(courierPose(land + 1, docks, VIEW, 2).hidden).toBe(true);
  });

  it('J5 absent docks (no box at this width) are skipped; no dock or tier 0 means no courier', () => {
    const docks = page().map((d) => (d.id === 'workflow' ? { ...d, width: 0, height: 0 } : d));
    const ids = holdsOf(docks).map((h) => h.dock.id);
    expect(ids).not.toContain('workflow');
    expect(ids).toHaveLength(7);
    expect(courierPose(100, [], VIEW, 2)).toEqual(NO_POSE);
    expect(courierPose(100, page(), VIEW, 0)).toEqual(NO_POSE);
    expect(courierPose(Number.NaN, page(), VIEW, 3)).toEqual(NO_POSE);
    expect(NO_POSE.hidden).toBe(true);
  });
});

describe('courierPose: travel', () => {
  it('J6 every travel spans at least 45 vh of scroll, and holds never overlap', () => {
    const holds = holdsOf();
    for (let i = 1; i < holds.length; i += 1) {
      expect(holds[i]!.start - holds[i - 1]!.end).toBeGreaterThanOrEqual(
        MIN_TRAVEL_VH * VIEW.height - 1e-6,
      );
      expect(holds[i]!.start).toBeGreaterThanOrEqual(
        holds[i]!.dock === holds[i - 1]!.dock ? 0 : holds[i - 1]!.end,
      );
      expect(holds[i]!.end).toBeGreaterThanOrEqual(holds[i]!.start);
    }
  });

  it('J7 both travel ends meet the dock poses: no jump leaving or reaching a dock', () => {
    const holds = holdsOf();
    for (let i = 1; i < holds.length; i += 1) {
      const a = holds[i - 1]!;
      const b = holds[i]!;
      const leave = [at(a.end), at(a.end + 0.01)];
      const reach = [at(b.start - 0.01), at(b.start)];
      for (const [p, q] of [leave, reach] as [Pose, Pose][]) {
        expect(Math.abs(p.x - q.x), `${a.dock.id}->${b.dock.id}`).toBeLessThan(0.5);
        expect(Math.abs(p.y - q.y), `${a.dock.id}->${b.dock.id}`).toBeLessThan(0.5);
        expect(Math.abs(p.scale - q.scale), `${a.dock.id}->${b.dock.id}`).toBeLessThan(0.5);
      }
      expect(leave[1]!.dock).toBeNull();
      expect(reach[1]!.dock).toBe(b.dock.id);
    }
  });

  it('J8 the whole journey moves without a jump: bounded steps per scrolled px, one form at a time', () => {
    let prev = at(0);
    for (let y = 1; y <= VIEW.maxScroll; y += 1) {
      const pose = at(y);
      // Where the form does not show (sunk into the smile) it may move: no one sees it.
      if (pose.presence < 0.01 || prev.presence < 0.01) {
        prev = pose;
        continue;
      }
      expect(Math.abs(pose.x - prev.x), `x at ${y}`).toBeLessThan(8);
      expect(Math.abs(pose.y - prev.y), `y at ${y}`).toBeLessThan(8);
      expect(Math.abs(pose.scale - prev.scale), `scale at ${y}`).toBeLessThan(4);
      if (pose.form === prev.form) {
        expect(Math.abs(pose.rotation - prev.rotation), `turn at ${y}`).toBeLessThan(0.08);
      } else {
        // The swap happens edge-on: both forms at a quarter turn, so neither shows its face.
        expect(Math.abs(Math.cos(prev.rotation)), `swap at ${y}`).toBeLessThan(0.12);
        expect(Math.abs(Math.cos(pose.rotation)), `swap at ${y}`).toBeLessThan(0.12);
      }
      prev = pose;
    }
  });

  it('J9 a travel arcs toward the page middle and dips in size half way', () => {
    const holds = holdsOf();
    const a = holds.find((h) => h.dock.id === 'dentists')!;
    const b = holds.find((h) => h.dock.id === 'booking')!;
    const mid = at((a.end + b.start) / 2);
    const ends = [at(a.end), at(b.start)];
    const straightX = (ends[0]!.x + ends[1]!.x) / 2;
    expect(mid.x).toBeGreaterThan(straightX);
    expect(mid.x).toBeLessThan(VIEW.width / 2);
    expect(mid.scale).toBeLessThan((ends[0]!.scale + ends[1]!.scale) / 2);
  });

  it('J10 the whip swaps mark for tooth half way to the restoration, with a half turn', () => {
    const holds = holdsOf();
    const a = holds.find((h) => h.dock.id === 'services')!;
    const b = holds.find((h) => h.dock.id === 'restoration')!;
    const y = (t: number) => a.end + (b.start - a.end) * t;
    expect(at(y(0.2))).toMatchObject({ form: 'mark', whip: 0 });
    expect(at(y(0.45)).form).toBe('mark');
    expect(at(y(0.45)).whip).toBeGreaterThan(0);
    expect(at(y(0.55)).form).toBe('tooth');
    expect(at(y(0.8))).toMatchObject({ form: 'tooth', whip: 1 });
    // The turn of a travel stays within half a turn of spin plus the docks' small difference.
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = at(y(t));
      const visual = p.rotation + (p.form === 'tooth' ? Math.PI : 0);
      lo = Math.min(lo, visual);
      hi = Math.max(hi, visual);
    }
    expect(hi - lo).toBeLessThanOrEqual(Math.PI + 0.35);
  });

  it('J11 the courier leaves the smile as a mark: the whip comes at the start of that travel', () => {
    const holds = holdsOf();
    const a = holds.find((h) => h.dock.id === 'smile')!;
    const b = holds.find((h) => h.dock.id === 'dentists')!;
    const y = (t: number) => a.end + (b.start - a.end) * t;
    expect(at(y(0.05)).form).toBe('tooth');
    expect(at(y(0.2)).form).toBe('mark');
    expect(at(y(0.3)).whip).toBe(1);
  });

  it('J12 into the footer the last stretch is a 40 px drop with the bounce, straight down', () => {
    const holds = holdsOf();
    const a = holds.at(-2)!;
    const b = holds.at(-1)!;
    const footer = b.dock;
    const y = (t: number) => a.end + (b.start - a.end) * t;
    const boxX = footer.left + footer.width / 2;
    // The drop takes the last stretch of the travel (at most a quarter viewport of scroll).
    const drop = Math.min(0.22 * (b.start - a.end), 0.25 * VIEW.height);
    const top = at(b.start - drop);
    expect(top.x).toBeCloseTo(boxX, 3);
    expect(top.y).toBeCloseTo(
      viewportTop(footer, b.start - drop) + footer.height / 2 - FOOTER_DROP_PX,
      0,
    );
    for (const share of [0.2, 0.5, 0.9]) {
      const yy = b.start - drop * (1 - share);
      const p = at(yy);
      const home = viewportTop(footer, yy) + footer.height / 2;
      expect(p.x).toBeCloseTo(boxX, 5);
      expect(p.y).toBeGreaterThanOrEqual(home - FOOTER_DROP_PX - 1e-6);
      expect(p.y).toBeLessThanOrEqual(home + 1e-6);
    }
    expect(bounceOut(0)).toBe(0);
    expect(bounceOut(1)).toBeCloseTo(1, 6);
    expect(bounceOut(0.5)).toBeGreaterThan(0.7);
    expect(bounceOut(0.8)).toBeGreaterThan(0.9);
    expect(bounceOut(0.95)).toBeGreaterThan(0.98);
    // The idle motion fades out on the way down, so the mark lands still.
    expect(idleAmount(at(y(0.5)))).toBeCloseTo(0.5, 5);
    expect(at(y(0.5))).toMatchObject({ to: 'footer', dock: null });
    expect(idleAmount(at(y(1)))).toBe(0);
    expect(idleAmount(at(middleOf('booking')))).toBe(1);
    expect(idleAmount(at(y(0.999)))).toBeLessThan(0.01);
  });
});

describe('courierPose: smile station', () => {
  it('J13 the tooth seats into the arch slot, the camera pulls back, the arch dissolves into the smile', () => {
    const hold = holdsOf().find((h) => h.dock.id === 'smile')!;
    const dock = hold.dock;
    const y = (t: number) => hold.start + (hold.end - hold.start) * t;
    expect(at(hold.start - 1)).toMatchObject({ arch: 0, smile: 0 });
    const start = at(y(0));
    const seated = at(y(0.4));
    expect(start.arch).toBe(0);
    // The tooth comes down onto its slot (measured from the box, which scrolls with the page).
    expect(start.y - viewportTop(dock, y(0))).toBeLessThan(seated.y - viewportTop(dock, y(0.4)));
    const frame = archFrame(dock, y(0.4), 0.4);
    const slot = archLayout()[ARCH_SLOT]!;
    const s = projectArch(slot);
    expect(seated.x).toBeCloseTo(frame.cx + s.u * frame.width, 5);
    expect(seated.y).toBeCloseTo(frame.cy + s.v * frame.width, 5);
    expect(seated.scale * CROWN_SHARE).toBeCloseTo(slot.width * frame.width, 5);
    expect(seated.arch).toBe(1);
    expect(seated.smile).toBe(0);
    // The pull-back makes the arch (and the seated tooth) smaller.
    expect(at(y(0.6)).scale).toBeLessThan(seated.scale);
    expect(at(y(0.55)).smile).toBeGreaterThan(0);
    expect(at(y(0.55)).smile).toBeLessThan(1);
    expect(at(y(1)).smile).toBe(1);
    expect(at(hold.end + 2000)).toMatchObject({ arch: 1, smile: 1 });
  });

  it('J13b the hand-off: the tooth sinks into the smile, a glint sweeps the teeth, the tooth lifts off it', () => {
    const hold = holdsOf().find((h) => h.dock.id === 'smile')!;
    const dock = hold.dock;
    const y = (t: number) => hold.start + (hold.end - hold.start) * t;
    // It sinks into the photo with the arch: nothing of it shows while the light sweeps.
    expect(at(y(0.55)).presence).toBeLessThan(1);
    const sweep = at(y(0.75));
    expect(sweep.presence).toBe(0);
    expect(sweep.glint).toBeGreaterThan(0);
    expect(sweep.glint).toBeLessThan(1);
    // Out of the glint: at the first molar it seated in, growing, rising, then whole.
    const forming = at(y(0.86));
    expect(forming.presence).toBeGreaterThan(0);
    const frame = archFrame(dock, y(0.86), 0.86);
    const slot = projectArch(archLayout()[ARCH_SLOT]!);
    expect(forming.x).toBeCloseTo(frame.cx + slot.u * frame.width, 5);
    const lifted = at(y(1));
    expect(lifted).toMatchObject({ presence: 1, lift: 1, form: 'tooth', glint: 0 });
    expect(lifted.scale).toBeGreaterThanOrEqual(forming.scale);
    expect(lifted.y - viewportTop(dock, y(1))).toBeLessThan(forming.y - viewportTop(dock, y(0.86)));
    expect(seatAmount(lifted)).toBe(0);
    // The travel leaves from exactly there, whole.
    const leave = at(hold.end + 1);
    expect(Math.abs(leave.x - lifted.x)).toBeLessThan(3);
    expect(leave.presence).toBe(1);
  });

  it('J14 without the smile box the photo simply shows', () => {
    const docks = page().filter((d) => d.id !== 'smile');
    expect(at(0, docks).smile).toBe(1);
    expect(at(0, docks).arch).toBe(0);
  });
});

describe('courierPose: purity', () => {
  it('J15 reverse equality: scrolling down then up gives the same pose at every position', () => {
    const down = new Map<number, Pose>();
    for (let y = 0; y <= VIEW.maxScroll; y += 7) down.set(y, at(y));
    for (let y = Math.floor(VIEW.maxScroll / 7) * 7; y >= 0; y -= 7)
      expect(at(y)).toEqual(down.get(y));
  });

  it('J16 a page that opens mid-journey shows the pose a full scroll from the top reaches', () => {
    const y = middleOf('workflow') + 123;
    const fresh = at(y);
    for (let s = 0; s < y; s += 50) at(s);
    expect(at(y)).toEqual(fresh);
    expect(fresh.dock).toBe('workflow');
  });

  it('J17 a resize re-measures the docks: the pose follows the new boxes, at the same place in the journey', () => {
    // A narrower window: every box moves and shrinks, the document grows.
    const narrow: Viewport = { width: 1024, height: 768, maxScroll: 14_000 };
    const docks = page().map((d) => ({
      ...d,
      left: d.left * 0.7,
      top: d.top * 1.15,
      width: d.width * 0.8,
      height: d.height * 0.8,
      pin: d.pin && { start: d.pin.start * 1.15, end: d.pin.end * 1.15 },
    }));
    const y = middleOf('dentists', docks, narrow);
    const pose = courierPose(y, docks, narrow, 3);
    const box = docks.find((d) => d.id === 'dentists')!;
    expect(pose.dock).toBe('dentists');
    expect(pose.x).toBeCloseTo(box.left + box.width / 2, 5);
    expect(pose.scale).toBeCloseTo(Math.min(box.width, box.height) * 0.86, 5);
    expect(courierPose(y, docks, narrow, 3)).toEqual(pose);
  });

  it('J18 crowded docks give up their holds for the travel; out-of-order docks never run backwards', () => {
    const view: Viewport = { width: 390, height: 844, maxScroll: 5000 };
    const docks: Dock[] = [
      { id: 'services', left: 10, top: 900, width: 100, height: 80, pin: null },
      { id: 'restoration', left: 10, top: 1000, width: 100, height: 80, pin: null },
      { id: 'smile', left: 10, top: 600, width: 300, height: 200, pin: null },
    ];
    const holds = holdRanges(docks, view);
    for (let i = 1; i < holds.length; i += 1) {
      expect(holds[i]!.start).toBeGreaterThanOrEqual(holds[i - 1]!.end);
      expect(holds[i]!.end).toBeGreaterThanOrEqual(holds[i]!.start);
    }
    let prev = courierPose(0, docks, view, 1);
    for (let y = 1; y < 5000; y += 1) {
      const pose = courierPose(y, docks, view, 1);
      expect(Number.isFinite(pose.x) && Number.isFinite(pose.y)).toBe(true);
      // Still no jump where it shows: a crowded travel is steeper, never a cut.
      if (pose.presence > 0.01 && prev.presence > 0.01)
        expect(Math.abs(pose.x - prev.x) + Math.abs(pose.y - prev.y), `step at ${y}`).toBeLessThan(
          12,
        );
      prev = pose;
    }
    expect(prev.dock).toBe('smile');
  });
});

describe('seat and spin', () => {
  it('J21 only the tooth seats: after the smile the mark turns face to the reader again (DOM spin)', () => {
    const d6 = at(middleOf('dentists'));
    expect(d6.arch).toBe(1);
    expect(seatAmount(d6)).toBe(0);
    expect(domSpin(d6)).toBeCloseTo(d6.rotation, 9);
    expect(Math.abs(domSpin(d6))).toBeGreaterThan(0.2);
    // The whip out of the smile turns the DOM mark too.
    const holds = holdsOf();
    const a = holds.find((h) => h.dock.id === 'smile')!;
    const b = holds.find((h) => h.dock.id === 'dentists')!;
    let edge = 1;
    for (let t = 0; t <= 0.3; t += 0.005) {
      const p = at(a.end + (b.start - a.end) * t);
      if (p.form === 'mark') edge = Math.min(edge, Math.abs(Math.cos(domSpin(p))));
    }
    expect(edge).toBeLessThan(0.2);
    // Seated in the arch the tooth shows its footprint: no spin.
    const smile = holds.find((h) => h.dock.id === 'smile')!;
    const seated = at(smile.start + (smile.end - smile.start) * 0.4);
    expect(seatAmount(seated)).toBe(1);
    expect(domSpin(seated)).toBe(0);
  });
});

describe('never under text: the lanes', () => {
  /** A paragraph between the dentists and the booking docks, with a clear start-side gutter. */
  const text: Box = { left: 260, top: 10_900, width: 1180, height: 60, pin: null };
  const viewOf = { ...VIEW, insetTop: 72 };
  const docks = page();
  const textOnly = [text];
  const withText = (y: number, boxes: Box[] = textOnly) => courierPose(y, docks, viewOf, 2, boxes);
  const touches = (pose: Pose, box: Box, y: number): boolean => {
    const half = (pose.scale * FORM_SHARE) / 2;
    const top = viewportTop(box, y);
    return (
      pose.y + half > top &&
      pose.y - half < top + box.height &&
      pose.x + half > box.left &&
      pose.x - half < box.left + box.width
    );
  };

  it('J22 a travel goes round the text through a clear lane, whole, on screen, the same both ways', () => {
    const holds = holdRanges(page(), viewOf);
    const a = holds.find((h) => h.dock.id === 'dentists')!;
    const b = holds.find((h) => h.dock.id === 'booking')!;
    let moved = 0;
    let prev = withText(a.end);
    for (let y = a.end; y <= b.start; y += 2) {
      const pose = withText(y);
      expect(touches(pose, text, y), `under the text at ${y}`).toBe(false);
      expect(pose.opacity, `whole at ${y}`).toBe(1);
      expect(pose.y - (pose.scale * FORM_SHARE) / 2, `under the header at ${y}`).toBeGreaterThan(
        72,
      );
      expect(pose.y + (pose.scale * FORM_SHARE) / 2).toBeLessThan(viewOf.height);
      // No jump: a few px per scrolled px at most.
      expect(Math.hypot(pose.x - prev.x, pose.y - prev.y), `step at ${y}`).toBeLessThan(40);
      if (Math.abs(pose.x - courierPose(y, docks, viewOf, 2).x) > 1) moved += 1;
      expect(withText(y)).toEqual(pose);
      prev = pose;
    }
    // It left the eased path for the lane somewhere.
    expect(moved).toBeGreaterThan(0);
    // The ends are the docks' own poses.
    expect(withText(a.end)).toMatchObject({ x: at(a.end).x, y: at(a.end).y });
  });

  it('J23 past a full-width text with no lane the courier leaves the frame at a side, never a ghost', () => {
    // A wall of text across the whole width: no place on screen is clear while it passes.
    const walls = [{ left: 0, top: 10_900, width: 1440, height: 60, pin: null }];
    const wall = walls[0]!;
    const holds = holdRanges(page(), viewOf);
    const a = holds.find((h) => h.dock.id === 'dentists')!;
    const b = holds.find((h) => h.dock.id === 'booking')!;
    let away = 0;
    for (let y = a.end; y <= b.start; y += 2) {
      const pose = withText(y, walls);
      const half = (pose.scale * FORM_SHARE) / 2;
      const off = pose.x + half < 0 || pose.x - half > viewOf.width;
      if (off) away += 1;
      else expect(touches(pose, wall, y), `on the text at ${y}`).toBe(false);
      expect(pose.opacity, `a ghost at ${y}`).toBe(1);
    }
    expect(away).toBeGreaterThan(0);
  });

  it('J24 without obstacles a travel floats on screen between its two docks', () => {
    const holds = holdsOf();
    for (let i = 1; i < holds.length; i += 1) {
      const a = holds[i - 1]!;
      const b = holds[i]!;
      for (let k = 0; k <= 20; k += 1) {
        const pose = at(a.end + ((b.start - a.end) * k) / 20);
        expect(pose.y, `${a.dock.id}->${b.dock.id} ${k}`).toBeGreaterThan(-pose.scale / 2);
        expect(pose.y).toBeLessThan(VIEW.height + pose.scale / 2);
      }
    }
  });
});

describe('arch layout', () => {
  it("J19 sixteen teeth on the photo's symmetric U, incisors in front, the slot the right first molar", () => {
    const teeth = archLayout();
    expect(teeth).toHaveLength(ARCH_TEETH);
    expect(ARCH_TEETH).toBe(16);
    for (let i = 0; i < teeth.length; i += 1) {
      const a = teeth[i]!;
      const b = teeth[teeth.length - 1 - i]!;
      expect(a.x).toBeCloseTo(-b.x, 9);
      expect(a.z).toBeCloseTo(b.z, 9);
      expect(a.yaw).toBeCloseTo(-b.yaw, 9);
      expect(a.z).toBeGreaterThanOrEqual(-1e-9);
      expect(a.z).toBeLessThanOrEqual(ARCH_DEPTH + 1e-9);
    }
    const slot = teeth[ARCH_SLOT]!;
    expect(slot.x).toBeGreaterThan(0.25);
    // A molar: wider than the premolars in front of it, behind the incisors.
    expect(slot.width).toBeGreaterThan(teeth[ARCH_SLOT - 1]!.width);
    expect(teeth[ARCH_TEETH / 2]!.z).toBeGreaterThan(slot.z);
  });

  it('J20 the occlusal projection centres the arch on its frame, the incisors at the top', () => {
    const teeth = archLayout();
    const front = projectArch(teeth[ARCH_TEETH / 2]!);
    const back = projectArch(teeth[0]!);
    expect(front.v).toBeLessThan(back.v);
    // Centred: the front and the back teeth sit about equally far from the middle.
    expect(Math.abs(front.v + back.v)).toBeLessThan(0.1);
    expect(projectArch({ x: 0, z: ARCH_DEPTH }).v).toBeCloseTo(-ARCH_DEPTH / 2, 9);
    expect(projectArch({ x: 0.2, z: ARCH_DEPTH / 2 })).toEqual({ u: 0.2, v: 0 });
    // Footprints follow the curve, mirrored on the two sides; the slot is on the screen's right.
    const slot = teeth[ARCH_SLOT]!;
    expect(projectArch(slot).u).toBeGreaterThan(0);
    expect(footprintAngle(slot.yaw)).toBeCloseTo(
      -footprintAngle(teeth[ARCH_TEETH - 1 - ARCH_SLOT]!.yaw),
      5,
    );
    expect(footprintAngle(0)).toBeCloseTo(0, 9);
  });
});

describe('the occlusal photo is registered to the arch', () => {
  it("J25 the arch projects each tooth onto the photo's own tooth, and its middle onto the centre", () => {
    const r = ARCH_PHOTO.width / ARCH_PHOTO.height;
    const right = archLayout().slice(ARCH_TEETH / 2);
    right.forEach((tooth, i) => {
      const p = projectArch(tooth);
      const photo = ARCH_PHOTO.teeth[i]!;
      expect(ARCH_PHOTO.centre.u + p.u * ARCH_PHOTO.archWidth).toBeCloseTo(photo.u, 9);
      expect(ARCH_PHOTO.centre.v + p.v * ARCH_PHOTO.archWidth * r).toBeCloseTo(photo.v, 9);
    });
    // The centre is the arch's middle: halfway between the incisors and the last molars.
    const front = ARCH_PHOTO.teeth[0]!.v;
    const back = ARCH_PHOTO.teeth.at(-1)!.v;
    expect(ARCH_PHOTO.centre.v).toBeCloseTo((front + back) / 2, 3);
    expect(ARCH_PHOTO.archWidth).toBeCloseTo(2 * (ARCH_PHOTO.teeth.at(-1)!.u - 0.5), 3);
  });
});
