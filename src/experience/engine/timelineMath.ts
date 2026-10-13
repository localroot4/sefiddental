/**
 * Master timeline math (spec EXP 3.6 rule 5). The master runs 0..1 over the document scroll
 * range; scene segments come from the measured `[data-scene]` tops, never from hard-coded vh.
 */

export interface SceneOffset<Id extends string = string> {
  id: Id;
  /** Document top of the section in px (rect top + scrollY), measured on every refresh. */
  top: number;
}

export interface SceneBound<Id extends string = string> {
  id: Id;
  start: number;
  end: number;
}

const clamp01 = (value: number): number => (value <= 0 ? 0 : value >= 1 ? 1 : value);

/** Document scroll fraction: the one position native scroll maps to. 0 when nothing scrolls. */
export function scrollFraction(scrollY: number, scrollRange: number): number {
  if (!(scrollRange > 0) || !Number.isFinite(scrollY)) return 0;
  return clamp01(scrollY / scrollRange);
}

/**
 * Scene i starts where its top reaches the viewport top and ends where scene i + 1 starts; the
 * last ends at 1. Starts are clamped to 0..1 and kept non-decreasing (document order).
 */
export function sceneBounds<Id extends string>(
  offsets: readonly SceneOffset<Id>[],
  scrollRange: number,
): SceneBound<Id>[] {
  let floor = 0;
  const starts = offsets.map((offset) => {
    floor = Math.max(floor, scrollFraction(offset.top, scrollRange));
    return floor;
  });
  return offsets.map((offset, i) => ({
    id: offset.id,
    start: starts[i] ?? 0,
    end: i + 1 < starts.length ? (starts[i + 1] ?? 1) : 1,
  }));
}

/** 0..1 inside one segment; a zero-length segment is 0 before its start and 1 from it. */
export function sceneProgress(progress: number, bound: { start: number; end: number }): number {
  const length = bound.end - bound.start;
  if (!(length > 0)) return progress >= bound.start ? 1 : 0;
  return clamp01((progress - bound.start) / length);
}

/** Index of the segment that holds `progress` (the last one whose start is not after it). */
export function activeSceneIndex(progress: number, bounds: readonly { start: number }[]): number {
  let index = -1;
  for (let i = 0; i < bounds.length; i += 1) {
    const bound = bounds[i];
    if (bound !== undefined && bound.start <= progress) index = i;
  }
  return index;
}
