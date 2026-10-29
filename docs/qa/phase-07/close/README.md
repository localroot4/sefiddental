# Phase 7 close: screenshots and axe (step 9)

Date: 2026-10-29. Commit 98b774a (main, clean tree), after `npm run build` and `npm run db:e2e`
(the QA fixture publishes the workflow block, one dentist, one case and one testimonial). The
server is `scripts/start-standalone.mjs` with the e2e environment of `playwright.config.ts`.
Chromium 141.0.7390.37 headless, default GPU, CPU not throttled. The driver scripts are in the
session scratchpad (`p7/close/shots.mjs`, `p7/close/axe.mjs`), not committed. The findings these
files support are in `docs/reports/phase-07.md`, sections Screenshots and Independent review.

## Screenshots

JPEG quality 80, CSS pixels (a 390 px page is 390 px wide). Every shot opens with the intro
marked as seen (`sessionStorage['sefid-intro']`), waits 1.5 s, decodes every image, then scrolls
the whole page down and up once, so the one-time reveals have fired before any capture.

| File pattern | What |
|---|---|
| `home-tier2-<width>-<theme>-full.jpg` | `/?tier=2`, reduced motion off. Stitched from viewport frames one viewport apart (header and sticky bar hidden after the first frame), because a full-page capture resizes the viewport to the page height, which re-creates the engine and hides the reveals below the fold again. A pinned scene shows its progress frame by frame. A scrubbed overlay can change at a frame seam. |
| `home-tier2-<width>-<theme>-reduced-full.jpg` | `/?tier=2` with `prefers-reduced-motion: reduce`: `html[data-tier]` is 0, the static page. A plain full-page capture (no engine runs). On phones the sticky bar shows once, at the first viewport's bottom edge. |
| `home-tier2-<width>-<theme>-<scene>.jpg` | One viewport with the scene's top under the header (`hero`: the page top region), reduced motion off: hero, services, restoration, workflow, compare, dentists, voices, first-visit, booking, footer (the footer 2.5 s after arrival, when the dropped parts have settled). |
| `home-tier2-1440-<theme>-<scene>-mid.jpg` | Desktop only, the pinned scenes (services, restoration, workflow) halfway through the scene's own scroll range. |
| `home-demo-<width>-<theme>-full.jpg`, `home-demo-<width>-light-<section>.jpg` | A second server with `DEMO_CONTENT=true` on a database with the seed only (no QA fixture: a published dentist, case or testimonial replaces its demo). 390 and 1440, `/?tier=2`, the demo compare, dentists and voices sections. |

Widths 390 (390x844, DPR 3, touch), 820 (820x1180, DPR 2, touch) and 1440 (1440x900), the
viewports of `tests/helpers/screens.ts`; light and dark from the context's `colorScheme`.
`html[data-tier]` was 2 in every motion-on run and 0 in every reduced run; `html[data-pins]` was
set only at 1440. `scrollWidth` equalled `clientWidth` in all 16 runs (no horizontal overflow). No
page error and no console error in any run.

## axe (`axe.json`)

`@axe-core/playwright` with the tags and the exclusion of `tests/helpers/axe.ts` (WCAG 2.0, 2.1
and 2.2 A and AA; `[data-dev-overlay]` left out). `/?tier=0` and `/?tier=2`, desktop 1440x900 and
phone 390x844 (DPR 3, touch), light and dark: 8 runs, each scanned 2.5 s after load and again
after a full scroll down and back to the top.

| Tier | Viewport | Theme | Violations (load / after scroll) | Rules passed | Incomplete (needs review) |
|---|---|---|---|---|---|
| 0 | desktop | light | 0 / 0 | 32 / 32 | color-contrast, 2 nodes |
| 0 | desktop | dark | 0 / 0 | 32 / 32 | color-contrast, 2 nodes |
| 0 | phone | light | 0 / 0 | 33 / 33 | color-contrast, 4 nodes |
| 0 | phone | dark | 0 / 0 | 33 / 33 | color-contrast, 4 nodes |
| 2 | desktop | light | 0 / 0 | 34 / 33 | color-contrast, 2 nodes |
| 2 | desktop | dark | 0 / 0 | 34 / 33 | color-contrast, 2 nodes |
| 2 | phone | light | 0 / 0 | 35 / 35 | color-contrast, 4 nodes |
| 2 | phone | dark | 0 / 0 | 35 / 35 | color-contrast, 4 nodes |

Every incomplete node is text whose background axe cannot compute because an image is under it:
on desktop the hero subtext (`#hero-sub`) and the scrim card over the hero photo; on phones three
trust facts at the photo's edge. The photo is the abstract stand-in (gap 36), so their contrast is
checked by eye in the screenshots only, and again when the real photo arrives.
