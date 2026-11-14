# Footer: the playground inside the footer

Owner decisions, 2026-11-07. The crow game proposed the same day is cancelled. The footer
playground stays (drag, throw, gravity fall, floor bounce, drift home, «پخش دوباره»), but it
stops being an empty stage band above the footer and becomes the footer's own backdrop.

## 1. Layout: one footer, not a stage above it

Owner, 2026-11-07: the playground must not be an empty band above the footer; it is the
footer's own background, blended with the footer menus, so the whole footer reads as one
premium composition.

- The separate stage band goes away. The footer becomes one dark section: the brand block,
  address, phones and hours and the three link columns sit on top; the play field is the
  footer's backdrop behind and around them, and its floor is a soft lit horizon just above the
  copyright line, spanning the full width.
- A subtle depth treatment ties them together: a faint radial glow in the brand teal behind the
  floor, a fine horizon line with a soft reflection under the parts, a gentle
  vignette toward the edges. No gradients that read as decoration only; no cards.
- The live parts (the lockup parts and the mark) move in the free space of the footer:
  the floor strip and the open areas between and below the columns. They never cover a link or
  text (the free-space map from the journey applies here too); a thrown part bounces off a
  column's box instead of passing over it.
- The landing (journey D8) is on this floor. «پخش دوباره» becomes a small, quiet control on the
  floor's edge.
- The quality picker («کیفیت»: خودکار، بدون جلوه، سبک، متوسط، کامل) leaves the stage and moves
  into the bottom bar beside the copyright, as a compact «کیفیت جلوه‌ها» control (a select or a
  small popover), still keyboard and screen-reader accessible.
- Phone (390) and tablet portrait: the columns stack as today; the floor strip sits under them
  above the copyright with enough height for the play (about 220 px), never pushing links out
  of reach.

## 2. Rules

- Tier 0, reduced motion and Save-Data: the parts rest on the floor; nothing moves; the footer
  looks finished.
- Nothing covers the footer's links or text; the footer keeps its height (no layout shift).
- The quality control keeps its current behaviour and labels; only its place and form change.

## 3. As built (2026-11-12)

- The footer is dark in both themes on every page: `data-theme="dark"` on `<footer>` scopes the
  dark tokens, so every text pair keeps the contrast it has in the dark theme. The sticky bar's
  spacer under it and the journey's footer band take the same scope.
- Home: the playground stage opens the footer on the same dark ground, with no edge between
  them. The parts stand on a fine lit horizon (`.playground-floor`, a soft reflection under it)
  with a faint teal glow behind them (`.playground-glow`); the lockup rests at a quiet scale
  (the mark 90 px tall from 1024 px). The field is 220 px on phones, 240 px on tablets and
  320 px from 1024 px.
- «کیفیت جلوه‌ها» and a quiet «پخش دوباره» (a ghost button, 44 px tall) sit on the floor's
  edge, under the horizon.
- Not as in section 1: the floor is the top of the footer, above the columns, not above the
  copyright, and the quality control is under the floor, not in the bottom bar. The scroll
  engine and the tier provider live inside `<main>` (`ExperienceRoot`), the footer outside it;
  moving the stage between the columns and the bottom bar would put the footer landmark inside
  `<main>` or need a client portal (a layout shift and no tier 0 markup). The parts therefore
  never pass over a column.

## 4. As built (2026-11-14): the logo is the playground

Owner, 2026-11-14: the stage and the footer still read as two things stacked; they must be one,
and the logo comes into the footer.

- Every page: the footer's brand column opens with a large lockup (`FOOTER_LOGO_CLASS` in
  `BrandLogo.tsx`: 72 px tall on phones, 80 px from 744 px). From 744 to 1023 px the brand
  column spans the row and the three link columns sit under it; from 1024 px it is the first of
  four columns (`2fr 1fr 1fr 1fr`). A fine lit horizon (`.footer-floor`) runs over the bottom bar.
- Home: there is no stage band any more. `PlaygroundSection` renders a zero-height root at the
  end of `<main>` and its field lies over the footer (`top-full`). The field's inner box repeats
  the footer's container and logo box, so the five parts (mark, bar, diamonds 1, 2 and 4) and
  the static letters sit exactly on the logo's pieces in CSS alone, as shares of the lockup's
  viewBox. Diamond 3 is the hole in the «ف» disc and stays with the letters. The journey docks
  at the mark part (D8) from the first measure.
- Tiers 1 to 3: `scenes/dom/footer.ts` sizes the field from the footer's top to the horizon,
  hides the footer's own logo (`opacity: 0`, so its accessible name stays) and shows the field.
  The parts drop in from the footer's top edge, can be dragged and thrown over the whole footer,
  fall onto the horizon and drift home into the logo 6 s after the last touch. The field lets
  every pointer through except the parts; each part's touch area is its `::before`, at least
  44 px square round its art.
- «کیفیت جلوه‌ها» and «پخش دوباره» are in the bottom bar, under the horizon
  (`[data-footer-controls]`), through a client portal (`FooterControls`): they need the tier
  store inside `ExperienceRoot`. They appear after hydration; the footer is below the first
  screen, so nothing the reader sees moves.
- Tier 0, reduced motion, no script: the field stays hidden and the footer's own static logo
  shows. Nothing moves, nothing shifts.
- The lanes keep the courier off the footer's text and controls as well (`driver.ts` measures
  the footer's obstacles with the root's).
