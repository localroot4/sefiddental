# Phase 07 - Motion and Signature Moments

Bring the prototypes from phase 2 into production without breaking a single
budget. Think like the motion designer and performance engineer, with the
independent critic watching frame times.

## Inputs

`docs/design/DESIGN.md` motion section, `design/intro-prototype.html`,
`design/motion-prototypes/`, performance numbers from previous reports.

## Deliverables

1. Intro reveal in production: inline CSS plus under 2 KB inline JS with the
   CSP nonce, session-once, skip on tap or Esc, reduced-motion branch, zero
   CLS, hero painted beneath at first paint, total under 1400 ms, no shown
   on admin, system pages or when navigating within the site.
2. Hero choreography: elements settle into place with the stagger from the
   design system on first paint; on repeat views only the short settle.
3. Signature moment 1: hero to proof transition with light parallax inside
   the mask on desktop only.
4. Signature moment 2: restoration tiers morph (MorphSVG) pinned with scrub
   on desktop; three-step tap control on phones; the tier CTA follows the
   active step.
5. Signature moment 3: patient journey horizontal pan on desktop, vertical
   steps with diamond markers on phones.
6. Before/after compare slider with pointer, touch and keyboard support and
   `tier_select`-style analytics event.
7. Micro-interactions from the design system: button press, card lift, input
   focus ring, FAQ chevron, nav active bar (Flip), theme toggle morph,
   booking check draw.
8. Cross-document View Transitions where supported, with a guard that
   disables them under reduced motion.
9. Loading strategy: GSAP plugins and any scene code dynamically imported
   after `load` or on first intersection, per page, with a measured size
   table in the report. Optional stretch only if budgets hold: the implant
   model scene with image-sequence fallback.
10. Performance evidence: before and after Lighthouse runs on home and the
    restoration page, frame-time measurements of each moment on a 4x CPU
    throttle, and the INP of the booking modal open. Screenshots and short
    recordings under `docs/qa/phase-07/`.
11. `docs/reports/phase-07.md`.

## Steps

1. Measure the baseline first and store it.
2. Implement one moment at a time; measure after each; revert anything that
   breaks a budget rather than tuning the budget.
3. Verify reduced motion by toggling the media query in Playwright and
   screenshotting both states.
4. Test on a 375 px viewport with touch emulation; confirm no pinned sections
   and no parallax below 1024 px.
5. Independent review focused on motion motivation: every animation must be
   justified in one sentence in the report; drop the ones that are not.

## Acceptance criteria

- All budgets from `docs/brief.md` section 7 hold on every measured page in
  both themes after motion is enabled.
- Intro under 1400 ms, skippable, session-once, CLS 0, LCP unchanged within
  100 ms compared with the no-intro baseline.
- Each moment holds 60 fps on desktop at 4x throttle and degrades correctly
  on phones.
- Reduced motion removes every non-essential animation; the site stays fully
  usable.
- No `scroll` event listeners anywhere; only transform and opacity animate.
- The Motion section of `docs/design/DESIGN.md` matches what shipped.

## Hand-off

Ask the client to experience the intro and the three moments on their phone
and desktop and to answer one question: keep, tone down, or change anything.
