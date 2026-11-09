/**
 * The intro mark's place (introScript.ts INTRO_CSS: `.i-lk`, `.i-m` and `--k`), for the courier's
 * hand-off once the dialog is gone: its centre at (50 %, 42 %) of the viewport, its height in
 * lockup units, and the lockup's scale from each width up. introScript.test.ts keeps it in step.
 */
export const INTRO_MARK = {
  x: 0.5,
  y: 0.42,
  height: 331.68,
  scales: [
    [1280, 0.5],
    [744, 0.42],
    [0, 0.34],
  ],
} as const;

/** The intro mark's box in a `width` by `height` viewport (px). */
export function introMarkBox(width: number, height: number): { x: number; y: number; h: number } {
  const k = INTRO_MARK.scales.find(([from]) => width >= from)![1];
  return { x: width * INTRO_MARK.x, y: height * INTRO_MARK.y, h: INTRO_MARK.height * k };
}
