# Accessibility audit (phase 9, deliverable 1; lane A11Y)

Base: started on `main` at `9948d21` (wave 1: the pinned home geometry is CSS sticky stages under
`html[data-pins]`), final run on `4a5ca3f` (wave 2 FIX, SEO-RTL, PERF merged). Date: 2026-10-30. Target: WCAG 2.2 AA, plus the brief's 44 px targets.
Scope: `docs/prompts/09-quality-gate.md` deliverable 1, plan section 5.2, and the rows routed
to A11Y by JURY (4, 5, 8, 9) and XB (W8, W9, F4).

Result: **0 axe violations and 0 unjudged «incomplete» in 6 projects** (390 / 820 / 1440 px,
light and dark). Twelve findings fixed (A1 to A12), four justified (J1 to J4).

## 1. Method

Every check is an e2e test in `tests/e2e/a11y.spec.ts` that runs in the six matrix projects;
`npx playwright test --grep "T-A11Y|T-KB"` runs them all.

| Check | Test | How |
|---|---|---|
| axe on every public template | `T-A11Y <template>` (24 templates) | `@axe-core/playwright`, tags `wcag2a` to `wcag22aa`, 0 violations of any impact. No rule is disabled. |
| axe on home at every tier, at load and after a full scroll | `T-A11Y home at ?tier=0..3` | The scroll walks the page at 80 % of a viewport per step, so every reveal and pinned scene runs, then scans again. At tiers 1 to 3 a block outside the viewport may wait faded in its reveal's start state; its contrast is not judged there (it reaches full opacity as it enters), and a faded block inside the viewport still fails. |
| axe «incomplete» | inside every `T-A11Y` scan | A colour contrast axe cannot compute (text over a photo) is measured on the pixels: the text turns transparent, its line boxes are captured, and the worst pixel against the text colour must reach 4.5:1 (3:1 for large text). Any other kind of incomplete fails. |
| Hero text over the photo | `T-A11Y hero text contrast` | The same pixel measure on the H1, the subtext and «تماس با کلینیک», whatever axe decides. |
| Keyboard walk of every template | `T-KB walk <template>`, `T-KB walk home at ?tier=0..2` | Tab until the focus wraps. Each stop: at least 90 % of its box inside the viewport and every clipping ancestor; at least 60 % of it not covered by another element (sticky header, sticky bar; WCAG 2.4.11); its pixels with the focus ring differ from its pixels with the ring hidden (2.4.7). The ring is hidden by a constructed style sheet, never by a blur. |
| Named walkthroughs | `T-KB …` | The booking dialog on a content page, the hero card with the intro running, the restoration chips and CTA, the drawer and the services menu, the slider, the FAQ. |
| Screen reader order | `T-A11Y structure <template>` | `page.ariaSnapshot()` (the accessibility tree; `page.accessibility` is gone from Playwright 1.64): banner, main, contentinfo at the top; one H1, the first heading in main; no skipped heading level. |
| Target sizes | same test, phone projects | Every focusable control at 390 px is at least 44 x 44 px, counting a label and a stretched link's `::after`; links inside running text are exempt (2.5.8 inline). |
| 200 % zoom | same test, desktop projects | 1280 px at 200 % is 640 CSS px: no sideways scroll on any template. 400 % (320 px) was probed once by script: none either. |
| Reduced motion | `T-A11Y reduced motion gives the tier-0 page` | `prefers-reduced-motion: reduce` on `/` against `/?tier=0`: the same sections at the same heights, the same Tab order, no intro, no pins, no running animation and no inline transform after a full scroll. |
| Colour-only information | `T-A11Y a chosen chip …` and the review in section 4 | |

## 2. Findings

Severity follows the effect on a patient using the site.

| ID | WCAG | Severity | Where | Finding | Resolution | Test |
|---|---|---|---|---|---|---|
| A1 | 2.4.11, 2.4.7 | major | snap rows under 1024 px at tier 0 and reduced motion: the home services row, the tier cards (restoration and pricing), the card and voice rows | A Tab to a card outside the row centred a neighbour: the browser reveals the link's own box, then the mandatory snap settles on the nearest snap position. At 820 px the third service kept 11 % of its link in view; at 390 px a tier card's CTA 37 %. The scroll engine centred the card for the services row only, and never runs at tier 0 or under reduced motion. | Fixed: `chrome/snapFocus.ts` centres the focused card of any mandatory snap row on a keyboard focus, at every tier; the services scene keeps only its pinned case. | `T-KB walk home at ?tier=0` (tablet), `T-KB walk component gallery` (phone), CB21 |
| A2 | 2.5.8 (brief: 44 px) | minor | breadcrumbs on every inner page; «بلد», «ویز» directions links | Targets 24 to 41 px wide (44 px tall). | Fixed: `min-w-target` on both, the text centred. | `T-A11Y structure …` (phone) |
| A3 | 1.4.1, 1.4.11 | minor | every chip group: booking service and tier chips, the home restoration chips, the «کیفیت» control | The chosen chip differed from the others by colour alone (a pale fill and a teal border of the same 1.5 px). | Fixed: the chosen chip's border is 3 px, its padding 1.5 px less, so the box and the row do not move. | `T-A11Y a chosen chip …` |
| A4 | 1.3.1 | minor | the booking page | The address, hours and insurers headings were H3 after the form's H2, so the outline read them as parts of the form. | Fixed: H2, same look. | `T-A11Y structure booking` |
| A5 | 2.5.8, 3.2.4 (JURY 5) | major | emergency, clinic closed | The only call action in the first screen was the inline «اورژانس ۱۱۵» link in a sentence (84 x 28 px). | Fixed: a full-width «تماس با اورژانس ۱۱۵» button (`tel:115`, danger fill, 52 px) where the open state has «تماس با کلینیک»; never in `[data-call-sheet]`, never tracked (EM-D4). The inline link stays. | T-EM13, T-EM1 (unit) |
| A6 | 3.2.3 consistency, trust (JURY 4) | major | header and drawer at launch | «پزشکان» (header, drawer), «راهنمای بیمار» and «مقالات» (drawer) led to empty hubs. | Fixed: each hub is linked only once it has published content (`FooterData.hubs`, the guides list), in the header bar, the services menu's row and the drawer; the links return by themselves. The footer keeps them as the crawl path. | CM7, FB3 |
| A7 | 1.4.3 kept (JURY 8) | minor | dark booking band, the warm tier card, the dark safety box | Dark `--color-warm-soft` `#2A2419` read as muddy brown next to the navy. | Fixed: `#1D2433`. Ink on it 13.60:1 (was 13.47), muted 7.66, dark safety box ink 9.72, icon 5.23, border 3.84. | `contrast.py`, T-A11Y dark projects |
| A8 | 2.1.1 (XB W8) | major in WebKit | the booking route on a tap | WebKit's click carries no touch `pointerType`, so a tap on «رزرو نوبت» focused the phone field and opened the iPhone keyboard over the dialog lead. | Fixed: a touch less than 1 s before the click makes it a tap (a key clears it), also when WebKit follows the touches with a mouse pointerdown and click (CI run 95). | CB12b, CB12c; T-DLG2, T-NV9 in the CI engines job |
| A9 | test only (XB W9, F4) | — | `dialog.spec.ts` | Mobile WebKit has no wheel (T-DLG7 threw). XB's suggested `scrollBy` would move even a locked page (`overflow: hidden` stops the user, not a script). One Firefox run left the dialog open after Esc (T-DLG1). | The wheel step runs where a wheel exists; the lock is still checked by its class. T-DLG1 now asserts the focus is in the dialog before Esc, so a repeat tells a lost focus from an ignored key. Not reproduced: no Firefox on this host. | T-DLG7, T-DLG1 |
| A10 | 1.3.1, 2.4.6 | minor | the tier cards (restoration and pricing pages) | The «معمولی» card's H3 had no accessible name in Chromium: its text node names the radio inside the heading and was left out of the heading's own name («VIP» and «CIP» sit in a `bdi` and kept theirs). A screen reader's headings list showed an empty item. | Fixed: the name sits in a span. | `T-A11Y structure restoration` (no unnamed heading) |
| A11 | 2.4.3 | major | the booking dialog under 1024 px, opened from the sticky bar | Esc from the phone field closed the dialog and dropped the focus on the page body: the sticky bar, and so its «رزرو نوبت» opener, is inert while a text field has focus, and wakes a task after the field's focusout. A keyboard user lost their place. | Fixed: `dialogs.ts` returns the focus once the bar wakes; a bar that stays inert (a booking block in view) sends it to the header home link. | CB22, `T-KB the booking dialog on a content page` |
| A12 | trust (JURY 9) | minor | the dentists and guides hubs while empty | Two photo slots framed a one-line empty state. | Fixed with FIX's diff: the hero is text-only while the hub has nothing published. | (FIX suggests a `live-shape.spec.ts` assert; integrator) |
| J1 | 2.5.8 | justified | inline links: «حریم خصوصی» in the consent line, «درد شدید دارید؟» in the FAQ answer, source links | Under 44 px tall. | Links inside a sentence are the 2.5.8 inline exception; the test skips `display: inline` only. | — |
| J2 | 1.4.3 | justified | QA gallery only | The bare urgent link sample (89 x 24 px) and the text over the placeholder art. | `/qa/components` is a design sample behind `QA_ROUTES`, never public: its axe violations still fail, its «incomplete» is not judged (the slot samples sit on placeholder art). | — |
| J3 | 1.4.3 | justified (phase 7 F6) | home workflow scene, tier 2 | Steps out of focus fade to 15 to 30 % opacity while pinned. | Moot at launch: the scene renders nothing until gap 48. Recheck when it ships. | — |
| J4 | 2.4.11 | justified | the 400 px tall viewport at 200 % zoom | Header (72 px) and sticky bar (64 px) take a third of the screen. | Both stay out of the way of the focus (the walk at 390 px holds); a short landscape window is the reader's choice. Not tested at 640 x 400 with the walk. | — |

## 3. Screen reader order

Read from the accessibility tree (`page.ariaSnapshot()`) at 1440 px on every template; the
test holds the rules below at every width. Every page reads in this order:

1. banner: the logo link, «ناوبری اصلی» (the services menu, the decision pages), the call and
   «رزرو نوبت»;
2. main: the breadcrumbs («مسیر صفحه»), the H1, then the sections in visual order, each a
   region named by its H2, and the booking block («درخواست نوبت») last;
3. contentinfo: «خدمات پرطرفدار», «کلینیک», «راهنما», each an H2.

On home: the hero (H1, then the hero card's H2 «درخواست نوبت»), services (five H3 worlds),
restoration, cases, dentists, voices, the first visit (four H3 steps), the FAQ with its aside
(H3), the booking block. The pinned scenes keep this order: pins are CSS sticky stages, and the
empty `aria-hidden` rooms after them are not in the tree. The unchosen restoration panels are
`visibility: hidden` when pinned (`display: none` otherwise), so neither a screen reader nor the
Tab key meets them; the chips, the shown panel's CTA and «مقایسهٔ کامل سه سطح ترمیم» follow in
that order (T-KB restoration).

Emergency: the H1, the 115 call (closed) or the clinic call (open), the safety box as a region
named by its H2, the form, the address aside. The maintenance pages (503 and the host fallback)
have their own shell: one H1, no site landmarks.

## 4. Colour-only information

| Information | Cue besides colour |
|---|---|
| The chosen chip (booking, home restoration, «کیفیت») | a 3 px border instead of 1.5 px (A3) |
| The chosen restoration tier card | the radio's dot, and the CTA text changes to the tier |
| The current nav item | a 2 px bar under it (`aria-current`) |
| Field errors | the message text under the field, `aria-invalid`, the focus moves to the first (T-BK2) |
| Links in running text | underlined (`TextLink`; axe `link-in-text-block` passes) |
| Clinic open or closed | the text of the hours badge and the closed-hours sheet |
| Warning and emergency boxes | the warning icon and the heading text, not only the tint |
| Success and failure of a request | the heading text and the focus move (5.4) |

## 5. Hero contrast on the pixels

Phase 7 left the text over the hero photo «checked by eye» (axe incomplete: 2 nodes on desktop,
4 on phones). Measured now on the screenshot: the text turns transparent, its line boxes are
captured at the project's pixel ratio, and the worst background pixel is compared with the text
colour. `/?tier=0`, the e2e photo (the clinic placeholder), main `4a5ca3f` with this series:

| Width | Theme | H1 (needs 3) | Subtext (needs 4.5) | «تماس با کلینیک» (needs 4.5) |
|---|---|---|---|---|
| 390 | light | 14.73 | 6.44 | 6.50 |
| 390 | dark | 15.58 | 8.78 | 9.60 |
| 820 | light | 14.62 | 6.35 | 6.41 |
| 820 | dark | 14.68 | 8.27 | 9.04 |
| 1440 | light | 14.22 | 6.22 | 6.24 |
| 1440 | dark | 14.68 | 8.27 | 9.13 |

The text sits on the 88 % scrim, so the photo moves these numbers little; a real photo will
change them, and `T-A11Y hero text contrast` measures again in every project. The phone trust
band over the photo (the other axe incomplete) is judged the same way inside `T-A11Y home`.

## 6. Not verified

- Real screen readers (NVDA, VoiceOver, TalkBack): the order comes from the accessibility
  tree, not from listening.
- WebKit and Firefox locally (no engine on this host): the CI `engines` job runs the matrix
  there. XB W8 is unit-tested only.
- Windows forced colours: the focus ring is an outline (it survives), not re-checked by eye.
- Real devices and real zoom: the 200 % check is a 640 px viewport.
