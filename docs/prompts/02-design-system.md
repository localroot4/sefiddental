# Phase 02 - Brand, Design System and Experience Storyboard

Design in code before the application exists. Output: a living styleguide,
the experience storyboard with prototypes, and the taste calibration the
WebGL phases build on. Think like the creative director, art director,
brand designer, motion director, 3D artist and accessibility specialist.

## Inputs

`docs/design-direction.md`, `docs/experience-direction.md`, `docs/ia.md`,
`docs/conversion.md`, `content/brand/`, the client's screen recordings of
the reference sites if provided (gap 33), the phase 1 report.

## Deliverables

1. `docs/design/DESIGN.md` - the complete design system: final color tokens
   for both themes with a measured contrast table (every text-on-surface
   pair, WCAG AA or better), typography scale and font loading, spacing,
   radius, elevation, iconography, imagery rules, layout families with
   breakpoint behavior, component inventory with every state, RTL rules,
   motion tokens for content pages, banned patterns, and a "3D look" section:
   materials, lighting, camera language, grain, how the brand colors behave
   under light in both themes.
2. `design/tokens.css` - CSS custom properties for both themes, ready for
   Tailwind v4 `@theme`.
3. `design/fonts/` - Vazirmatn and Estedad variable woff2, Persian plus Latin
   subsets, with a `fonts.css`; total bytes in the report (budget 120 KB).
4. `design/brand/` - logo SVGs (client files, or a careful trace of the PNG
   marked for approval): full lockups, the teal mark, the wordmark, the
   diamond, the bar; favicon set; OG template background. Plus a first 3D
   interpretation of the mark and the diamond as glTF (Draco) with a
   turntable preview page, and a sourced or modeled molar (license noted).
5. `design/styleguide.html` - static, self-contained, RTL, both themes with
   a toggle: colors, type scale with Persian text, spacing and radius,
   buttons in every state, inputs with label, help and error, chips as
   radios, cards, category tiles, tier comparison, dentist card,
   before/after slider, FAQ item, sticky bar, navigation at three widths,
   skeletons, alerts, footer.
6. `docs/experience/storyboard.md` - the eleven scenes of
   `docs/experience-direction.md` as a scene-by-scene board: for each scene
   a sketch or annotated frame (export to `docs/experience/frames/`), scroll
   range in viewport heights, what the camera, mark, text and CTA do at 0%,
   50% and 100%, the desktop versus phone version, the tier 0 version, the
   assets needed, and the estimated GPU and download cost. Mark the three
   direction changes and the footer playground.
7. `design/prototypes/` - small HTML or Vite prototypes that prove the
   riskiest ideas before the app exists: (a) the intro as specified, timed
   with the Performance API; (b) the horizontal pinned services scene with
   the mark morphing into category icons, desktop and the phone swipe
   version; (c) the diagonal workflow scene (DOM only); (d) a three.js
   turntable of the molar with the enamel material, with tier switching
   (DPR, post-processing on and off) and an on-screen fps meter; (e) the
   footer playground with GSAP Draggable and InertiaPlugin; (f) the
   before/after displacement wipe in WebGL with the DOM clip-path fallback.
8. `design/hero-directions/` - two complete home hero compositions (A and
   B) as static pages at 390, 820 and 1440 in both themes with the real
   positioning line and CTA labels; the client picks one.
9. `docs/qa/phase-02/` - screenshots of everything at the three widths and
   both themes; short screen recordings of prototypes (a) to (f).
10. `docs/reports/phase-02.md`.

## Steps

1. Derive tokens from `docs/design-direction.md`; compute contrast with a
   script under `design/tools/`; adjust and record.
2. Build the styleguide mobile-first; check 320 px for overflow.
3. Storyboard first, then prototypes: each prototype answers one question
   written at the top of its file ("can the molar look premium at tier 1?").
4. Measure every prototype: duration, CLS, fps at 4x and 6x CPU throttling,
   fps with SwiftShader. Write the numbers into the storyboard.
5. Build the two hero directions; they must differ in composition, not only
   color.
6. Screenshot, inspect, fix in one batch, confirm, stop.

## Acceptance criteria

- Every text color on every surface used passes AA; small text passes 4.5:1
  in both themes, proven by the script output in the report.
- Fonts under 120 KB; Persian shaping and digits correct.
- Styleguide has no horizontal scroll at 320, 390, 820 and 1440 px.
- Intro: under 1400 ms, skippable, session-once, reduced-motion branch, zero
  layout shift, hero painted beneath at start.
- Storyboard covers all eleven scenes with phone and tier 0 versions, scroll
  ranges and asset lists.
- Prototype (d) holds 60 fps at 4x throttle on the desktop tier settings and
  stays above 50 fps with SwiftShader at tier 1 settings; (b) and (e) hold
  60 fps on desktop; (b) phone version uses native scroll snapping.
- Radius, spacing and accent rules hold in every prototype; no banned
  pattern.

## Hand-off

Ask the client to pick hero direction A or B, approve the logo trace and
the 3D interpretation of the mark, and watch the six prototype recordings
and say which scene feels most like the reference sites and which does not.
