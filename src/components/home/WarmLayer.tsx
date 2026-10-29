/**
 * Scene 9's light (phase 7 report, plan section 2; C16): one fixed layer under every section,
 * `--color-warm` at 12 %: every text pair over it keeps AA with margin (the brand link 4.57:1 in
 * light, 5.61 in dark; design/tools/contrast.py formulas on the surface + warm mix, the table is
 * in the step README); `--color-line-strong` reaches 2.88 in light and appears over this layer
 * only as the guide link's underline (every section after the journey is opaque). Its opacity
 * reads `--warm`, which only `first-visit.ts` writes at tiers 1 to 3, so at tier 0 and under
 * reduced motion the layer stays at 0. `z-index: -1` inside `.site` keeps it above the page
 * background and below every section; no ancestor between `.site` and this element may carry
 * `transform`, `filter` or `contain`, or the fixed box is trapped inside it (T-S9 asserts the
 * rect equals the viewport). Phase 8 mirrors the same property into the world light and tints
 * every `[data-world-slot]` with it. Its height is `100lvh` from the top, never `inset: 0`: the
 * box does not resize as a phone's toolbar hides or shows (phone spec scene 9; verify on a real
 * phone).
 */
export function WarmLayer() {
  return (
    <div
      data-warm-layer=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -z-1 h-lvh bg-warm/12 [contain:strict] [opacity:var(--warm,0)]"
    />
  );
}
