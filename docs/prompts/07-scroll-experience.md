# Phase 07 - Home Scroll Experience (DOM and 2D layer)

Turn the home page into the scroll journey «سفر یک لبخند» at the DOM level:
the master timeline, the three direction changes, the intro, the hero
choreography, the footer playground and the tier scaffold, all before any
WebGL scene exists. Phase 8 adds the 3D world on top of this skeleton.
Think like the motion director, front-end engineer and performance engineer,
with the independent critic timing frames.

## Inputs

`docs/experience-direction.md`, `docs/experience/storyboard.md`,
`design/prototypes/`, `docs/design/DESIGN.md`, the phase 3 scaffold, the
phase 4 home markup, performance baselines from previous reports, the
staging target (hosting is settled before this phase, brief decision 21).

## Deliverables

1. Scroll engine: Lenis on fine-pointer devices only, GSAP ScrollTrigger
   master timeline with one labeled segment per scene, scroll ranges from
   the storyboard, `invalidateOnRefresh`, correct behavior on resize,
   rotation, theme switch and reduced-motion switch mid-scroll, and clean
   teardown on route change.
2. Intro in production per `docs/design-direction.md` section 8: inline CSS
   plus under 2 KB inline JS with a CSP hash, session-once, skip on tap, any
   key (Tab and Esc included) or «رد کردن انیمیشن», `main` inert while the
   overlay is up, reduced-motion branch, zero CLS, hero B (photo, scrim,
   card) painted beneath at first paint and revealed through the mark mask,
   the bar bound to the real experience-asset loading progress with a
   minimum duration, no intro on other routes.
3. Scenes 1-3 and 5-11 as DOM choreography with placeholders for the WebGL
   layers: hero settle (the scrim text, then the card; no pointer parallax
   next to the form); the hero exit (native scroll; the trust band leaves
   with the hero; at 1024 px and wider and tiers 1-3 the photo moves at
   0.85x, transform only, and uncovers the layer where the phase 8 world
   appears; scene 2 keeps its 100-140 vh range); static trust facts with no
   count-up; the horizontal pinned services scene (desktop and tablet
   landscape) with the mark morphing into category icons (MorphSVG) and the
   phone swipe-row version with native scroll snapping; the diagonal
   workflow scene with real photos as billboards along the path and its
   stepped phone version; before/after with the DOM clip-path slider;
   dentists depth parallax (fine pointer only); patient voices carousel; the
   warm light shift as CSS variables; the booking stage; the footer
   playground with GSAP Draggable and InertiaPlugin, bounds, floor,
   return-home timer, touch support, keyboard «پخش دوباره» button.
   Optional hero exit enhancement at 1024 px and wider, tiers 2-3 only: the
   photo contracts into the mark shape (an SVG mask scaled by transform).
   Keep it only if it holds 60 fps at 4x CPU throttle. Remove the static
   mark relief from the hero if no real hero photo exists by this phase, or
   if it covers the photo's focal area or reads as a watermark (brief
   decision 19).
4. Scene 4 (restoration tiers) as the SVG morph stepper from phase 2, with
   the tier CTA following the active step; the 3D molar replaces it at
   tiers 2 and 3 in phase 8.
5. Tier wiring: every scene reads the tier from the provider and renders
   its tier 0, 1, 2 and 3 variants (DOM variants only in this phase); the
   «کیفیت» control in the footer; the developer overlay shows tier and fps.
6. Measurement events for the experience (`tier_select`, `case_slider_use`,
   scene reached depth as `scene_view` with the scene id).
7. Performance evidence: before and after Lighthouse on home at tiers 0 and
   1; frame-time samples per scene at 4x and 6x CPU throttling; INP of the
   hero card submit and of the scene 10 booking block (home opens no
   dialog); memory before and after a full scroll; screenshots and
   recordings under `docs/qa/phase-07/`.
8. `docs/reports/phase-07.md`.

## Steps

1. Measure the baseline first and store it.
2. Build the engine and the intro, then one scene at a time; measure after
   each; revert anything that breaks a budget rather than moving the budget.
3. Test reduced motion by toggling the media query in Playwright and
   screenshotting both states; test tier switching live.
4. Test on a 375 px viewport with touch emulation: no pinned sections, no
   parallax, native scroll snapping in the services row.
5. Independent review on motion motivation (every animation justified in one
   sentence), scroll integrity (fast back-scroll, resize mid-pin), and
   accessibility of the pinned scenes (focus order, keyboard reachability).

## Acceptance criteria

- All budgets for the home page class hold at tiers 0 and 1 after this
  phase; content pages are untouched.
- 60 fps on every scene at 4x throttle on desktop; no long task over 100 ms
  during scroll.
- Intro under 1400 ms, skippable, session-once, CLS 0, LCP unchanged within
  100 ms of the no-intro baseline.
- Scrolling back at any speed and resizing mid-scene leaves nothing
  misplaced; route change leaves no listeners or ScrollTriggers behind.
- Reduced motion yields the tier 0 page; every CTA stays reachable in all
  tiers; the pinned scenes keep a sane focus order.
- The footer playground works with mouse, touch and keyboard and returns
  home after 6 seconds.
- No `scroll` event listeners; DOM animates only transform and opacity.

## Hand-off

Ask the client to scroll the real home page on the staging URL on their
phone and desktop and answer one question per scene: keep, tone down, or
change. Then ask which scene feels closest to immersive-g.com and
hidokmeh.com, and which does not (brief decision 20). Ask whether the
playground feels right.
