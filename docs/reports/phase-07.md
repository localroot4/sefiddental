# Phase 07 - Home scroll experience (DOM and 2D layer)

Date: 2026-10-26 to (open). Commit range: `f1f6b1f` (baseline measured on
this commit with the uncommitted measurement script) to (open).

Versions: Next.js 16.4.3, React 19.3.0, Payload 3.92.0, gsap 3.15.0 (standard
no-charge license; the README says every bonus plugin is free for commercial
use; MorphSVGPlugin, Draggable and InertiaPlugin are used), lenis 1.3.26
(MIT), three 0.186.1 and @react-three/fiber 9.8.1 (installed since phase 3,
not loaded by this phase outside `?debug=1`), detect-gpu 5.0.70, Playwright
1.64.0 with Chromium 141.0.7390.37, Lighthouse 12.6.1, vitest 5.0.4, Node
22.23.4. No new dependency.

## Plan (written before building)

### 0. Where this phase starts

Baseline (`docs/qa/phase-07/baseline/`, median of 3, host benchmarkIndex
2090, CPU 4x on the mobile preset):

| Metric | `/?tier=0` | `/?tier=1` |
|---|---|---|
| Lighthouse mobile: score, LCP, CLS, TBT, total JS | 0.98, 2346 ms, 0, 100 ms, 156 KiB (11 requests) | 0.86, 2636 ms, 0, 457 ms, 444 KiB (15) |
| Lighthouse desktop: score, LCP, TBT | 1.0, 564 ms, 0 | 1.0, 553 ms, 4 ms |
| LCP element | `h1#hero-h1` on mobile, the hero `img` on desktop | same |
| Frames, desktop 1440x900, wheel scroll, 4x | median 60 fps, slowest window 58, worst frame 33 ms, 0 long tasks | 58 fps (min 50), p95 33 ms, worst 83 ms, 2 long tasks (84 ms, hero and top strip) |
| Frames, 6x | 58 fps (min 53), worst 50 ms, 0 long tasks | 42.3 fps (min 32), worst 167 ms, 5 long tasks, 2 over 100 ms (175 ms) |
| Slowest sections at 4x | all 56.5 to 60 fps | restoration 48.4, faq 51.7, booking 53.2, services 54.5 |
| SwiftShader (software GPU) | about 44.5 fps; services, restoration, faq, booking 23 to 31 | about 22 fps everywhere: the empty R3F canvas is GPU-bound |
| Heap MiB before / after scroll / after GC | 2.8 / 3.6 / 3.0 | 5.3 / 6.4 / 5.7 |
| INP of the submits (desktop hero, desktop block, phone hero, phone block) | 120, 136, 152, 160 ms | 136, 192, 192, 208 ms |
| Initial JS home (check:bundle) | 155.2 KiB (shared 143.5, route 11.8); gate 215 KiB, target 180 KB | same HTML |
| Content pages / booking pages initial JS | 144.2 to 149.2 KiB (gate 150, 0.8 KiB headroom) / 148.4 and 147.8 KiB | |
| CSS / fonts | 14.1 KiB / 90.1 KiB | |

What exists (`p7/scaffold.md`): `ExperienceRoot` (tier provider, engine chunk
after `load` at tier 1 or more, canvas chunk after `load` at tier 1 or
more), the engine (Lenis on fine pointers, one master timeline with
`scrub: true` and no labels, `gsap.matchMedia` with `all`, `reduce`, `fine`,
`wide`), measured scene bounds (`timelineMath.ts`), the tier store with the
layout latch, the registry of 12 scenes with storyboard ranges, the debug
overlay, the tier-0 server HTML of every section. Missing: the intro, every
scene choreography, the `workflow` and `footer` markup, the «کیفیت» control,
`scene_view`, the overlay's scene row, `docs/qa/phase-07/` beyond the
baseline. The hero mark relief still renders by default.

### 1. Deviations and decisions recorded before the build

| # | Decision | Reason |
|---|---|---|
| D1 | Phases 7 and 8 run before the phase 6 leftovers (waves 2 and 3 of the phase 6 plan: the dentist review of the copy, TEMPLATES step 2, the security review of preview, CSV import and approval, the editorial and admin guides, Lighthouse on a post, the phase 6 report close). The master file runs one phase after the previous closes. | The client chose this on 2026-10-26 after the staging launch: they want the home experience on `https://new.sefiddental.ir` first. The leftovers are editorial work on content pages; phase 7 touches no content page, so neither blocks the other. Tracked as the open task «Close phase 6 leftovers». |
| D2 | Scene 5 (digital workflow) is built as a home page block `workflow` (four steps: title, line, 4:3 photo) with its diagonal choreography and stepped phone version, and renders nothing until the block is published. The e2e fixture seeds it on the e2e database only. | The brief requires the scene; the master rule «never invent facts» is stricter: its captions are unconfirmed claims (gap 48) and its photos do not exist. Staging shows two direction changes until the client answers gap 48. |
| D3 | The hero mark relief is off by default: it renders only when `features.heroMarkRelief` is true and the hero photo is real (`image.placeholder === false`). | Brief decision 19 and the phase 7 brief: no real hero photo exists (gap 36). |
| D4 | Scenes 6, 7 and 8 render nothing on staging until a case, a dentist and a consented testimonial are published. The client judges them from the phase 7 recordings of the e2e fixture, labeled as sample content. No sample content goes to the client's server. | Master: no invented reviews, names or smiles. |
| D5 | The three.js canvas chunk loads in phase 7 only under `?debug=1` (stress and monitor probes) or when a registry scene declares `webgl.load` (none before phase 8). The frame monitor takes its samples from the gsap ticker while no canvas renders. | Tier 1 fails LCP (2636 ms) and TBT (457 ms) only because a 290 KiB chunk that draws nothing evaluates inside the Lighthouse window. Phase 8 decides when three.js loads (at the hero exit, never at `load`). |
| D6 | Under 1024 px the services section is the native scroll-snap row at every tier, CSS only; the bento stays the layout from 1024 px. | The storyboard gave tier 0 the bento, but the server HTML cannot know the tier and a layout switch after hydration risks CLS. A snap row has no motion, so it is a valid tier 0. |
| D7 | Pin distances +200, +100 and +200 vh for scenes 3, 4 and 5: a segment is the pin distance plus the section's own height, so the storyboard starts of every later scene and the registry ranges (test V7, 1560 vh) stay valid. | The storyboard names ranges, not pin distances. |
| D8 | Pinned scenes keep their scrub on their own pin ScrollTrigger (the GSAP-documented form). The master timeline holds one label per scene, the unpinned scrubs as children at those labels, and `sceneProgress(id)` for every scene. | One ScrollTrigger per pin is unavoidable; a pinned element driven by a child of a document-wide scrub is not a supported pattern. |
| D9 | The «کیفیت» control and the playground render in a home-only stage inside `ExperienceRoot`, directly above `SiteFooter`, styled as the footer's top band (`data-scene="footer"`). `SiteFooter` and `SiteShell` are not edited. | `SiteFooter` is shared chrome outside the tier provider; a client control there adds JS to content pages, which have 0.8 KiB of headroom. |
| D10 | The intro overlay is a `<dialog>` opened with `showModal()` by the inline script. Everything outside the top layer is inert while it is open, Esc closes it natively, focus cannot leave the overlay. The brief's «`main` inert» is met by this mechanism; the e2e asserts focus cannot reach the phone field. | A pre-hydration attribute change on `main` (a hydrated element) and a React-removed overlay both risk hydration mismatches; the dialog needs only `suppressHydrationWarning` on itself. |
| D11 | The hero settle after the intro is CSS: `html[data-intro="playing"]` offsets the scrim text and the card by transform, `html[data-intro="done"]` settles them with `--dur-4` and 60 ms steps. No engine, no opacity on the H1 or the subtext. | LCP within 100 ms of the no-intro baseline; opacity on the LCP text removes it as a candidate. |
| D12 | Allowed non-transform writes, each recorded: the MorphSVG `d` morph on one inline SVG of at most 96 px (`contain: paint`) in scene 3, with the point matching precomputed offline (`shapeIndex: 0`); the clip-path of the existing `CompareSlider` from user input only; the FAQ chevron rotation; the warm light shift as one custom property `--warm` on one layer whose `opacity` reads it; the scroll-set `checked` radio in scene 4, whose `:has()` panel switch is a layout, at most once per step and never per frame; the pressed playground part's `z-index` through a class, once per press. Not allowed, so the lanes avoid them: `autoAlpha` (writes `visibility`), Draggable `zIndexBoost`, opacity on `<g>` inside one `<svg>` (a paint, not a composited opacity: scene 4 stacks three sibling `<svg>` elements), CSS transforms on SVG children (the intro moves one `<svg>` element per part). | The brief names MorphSVG, the clip-path slider and «CSS variables»; the transform-and-opacity rule applies to everything else, and the independent review at step 9 reads this list. |
| D13 | `scene_view` stores the scene id as its `location` (the counter's text dimension). No schema migration. | `EVENT_LOCATIONS` is a code list over a text column; a new column would need a migration and a unique-index change for one event. |
| D14 | The intro also plays on a device the probe later calls tier 0 (software renderer). It skips for reduced motion, Save-Data, a saved «کیفیت» of 0, a site cap of 0 (the server omits the markup) and a repeat visit in the session. | The inline script runs before any GPU probe; the intro is CSS and SVG and costs no WebGL. |
| D15 | The footer playground is drag, throw, bounds and floor at tiers 1 to 3 (DOM), static at tier 0; collisions and the 3D parts wait for phase 8. | The acceptance asks for mouse, touch and keyboard; the plugin loads lazily only near the footer, so tier 1 pays nothing until then. |
| D16 | Scene 4 is three pre-colored SVG layers (plain, VIP, CIP) crossfaded by opacity and scaled by transform; no MorphSVG there until a VIP outline exists. The molar is decorative (`aria-hidden`): the radio group is the control and the checked step's panel names the level, so the lane brief's `aria-valuetext` per step is not used (review RR6; test RS6 asserts `aria-hidden`). | Prototype 0d has no morph; a `fill` transition is a paint. `aria-valuetext` is valid only on a range role, and the radios already announce the step. |
| D17 | The client's message about ThreeUI is answered plainly at the hand-off: phase 7 is the DOM skeleton (the intro bar, word and line reveals, the fps overlay are its only ThreeUI pieces); the glass mark, particles, backdrop, wipe and glow are phase 8 (`docs/discovery/threeui-review.md` 3). No phase 8 slice is pulled forward. | Pulling WebGL into this phase breaks the brief («before any WebGL scene exists») and the tier 1 budgets that already fail. |
| D18 | The world window after the hero is the trust band itself: from 1024 px, at every tier and in the server HTML, the band leaves the photo's bottom edge and becomes a 40 vh row under the photo with the facts on it (`data-world-slot="hero-exit"`); under 1024 px the band stays on the 4:5 photo's edge. No element appears or grows after hydration. | A window inserted after hydration shifts the services section visible at scrollY 0 on tall desktops (hero grid `min(100svh - nav, 52rem)` = 832 px at 1200 px tall; impact 296/1200 x distance 480/1200 = 0.099 CLS, over the 0.05 gate), and a blank 40 vh band at tier 0 is not a complete site. The facts give the window content at every tier; phase 8 draws the world behind them. |
| D19 | The per-scene frame thresholds (59 fps median at 4x, 55 slowest window, 50 ms worst frame, no long task over 100 ms, heap +0.5 MiB) are asserted by `tests/perf/scenes.spec.ts` only with `PERF_GATE=1`, which the integrator sets on the local `perf-default` run at every step; on CI the same spec records annotations and attachments and stays green. The budget numbers do not move. | CI runs every Playwright project on a 2-core runner without a GPU (baseline 44.5 fps at tier 0 and 22 at tier 1 on SwiftShader), so an unconditional gate is red by construction and would block the deploy at step 9; the numbers are valid only on the measurement host. |
| D20 | The GPU probe makes its WebGL 2 context in a dedicated worker (`gpuProbe.worker.ts`, an OffscreenCanvas) with a 1500 ms timeout. The main thread makes one only without the worker's answer, for detect-gpu on a cache miss, or once to confirm a worker-only result before a tier that mounts the canvas: tiers 2 and 3, and tier 1 under `?debug=1` or once a scene declares `webgl.load` (`confirmWebgl2` in `tierStore.ts`, `SCENES_LOAD_WEBGL` in the registry). Any other tier 1 draws no WebGL in phase 7: with only the worker's answer it means «WebGL 2 in a worker, the main thread unchecked», and no main-thread context is made for it. Two visible changes: `data-tier-reason` is `software-renderer` instead of `no-webgl2` when WebGL 2 works only in workers on a software renderer, and under Chromium's `--disable-webgl2` `/?tier=1` gives `html[data-tier]` 1 where it gave 0 (`?tier=3` still gives 0, `no-webgl2`: T-T01). | On Lighthouse's software GPU the main-thread context was the largest tier 1 long task after `load` (19 to 102 ms, median 30 ms, in 20 of 20 tier 1 traces); with the worker no tier 1 trace has a main-thread GL task (0 of 20) and the main thread only receives the answer (1 to 6 ms). A context in a worker does not promise one on a main-thread `<canvas>` (`--disable-webgl2` blocks only the latter), so D-Q3 (no WebGL 2 beats `?tier=N`) holds through the confirm for every tier that draws. |
| D21 | No `:has()` selector is active with JavaScript in the site CSS. The states it styled follow attributes the chrome sets (html `data-modal` from `dialogs.ts`, the caret's `aria-expanded`, `data-choice` and `data-checked` from `choices.ts`) or sibling and pseudo-element selectors (chips, the avulsion first aid, the link cards' focus ring, the compare handle). Without JavaScript the `:has()` rules stay, only under `@media (scripting: none)` (Tailwind `noscript:`) and only from the allow list that `scripts/check-has.mjs` enforces in `postbuild`. A script that checks a radio dispatches `change`, D12's scroll-set radio in scene 4 included: the panel follows `data-choice`. | In Chromium one active `:has()` rule makes every DOM insertion restyle the whole document: on home one `appendChild` to body restyled about 867 elements (9 to 17 ms) at 2b13ad0, and 3 + 2 elements (0.3 ms) without the rules; a rule inside a media query that does not match costs nothing. |
| D22 | `postbuild` puts the V8 compile hint `//# allFunctionsCalledOnLoad` first in 7 chunks (`scripts/compile-hints.mjs`): the bootstrap chunks (`rootMainFiles` of `.next/build-manifest.json`) and the two gsap chunks. It fails the build when the manifest lists no chunk, a listed chunk is missing or no gsap chunk exists. Subresource Integrity and browser source maps stay off while the step exists (`docs/deploy.md`). | V8 then compiles those chunks on a background thread while they stream, instead of on the main thread inside the bootstrap long task (Chromium 136+). Against the same build without hints, paired medians at 5.5x, 4 cores: tier 1 TBT -164 / -175 ms, tier 0 -106 / -112 ms. The pages' own entry chunks stay unhinted: hinting all 14 initial chunks (657 KB) risked competing with the main thread on a 2-core runner. |

### 2. What: lanes and their scenes

Disjoint file ownership per lane is in `p7/lanes.md` (the build briefs).
Shared contract files have one owner: `page.tsx`, `globals.css`,
`design/tokens.css`, `fa-home.ts`, Payload types and migrations, `docs/**`
(INTEGRATOR); the engine, registry, `ExperienceRoot`, `core/*`, `tier/*`,
`overlay/*`, the events allowlist and `docs/analytics.md` row (ENGINE);
`csp.ts` and its test (INTRO); `limits.json`, `lighthouserc.cjs`,
`scripts/*.mjs`, `playwright.config.ts`, `tests/helpers/**`, `tests/perf/**`
(QA).

| Lane | Scenes | Core of the work |
|---|---|---|
| INTEGRATOR step 0 | - | Split `HomeSections.tsx` into `sections/*.tsx` (pure move), the slots in `page.tsx` (the lockup sprite, the intro overlay, `workflow`, the playground) with three null-rendering stubs whose props are fixed now (`IntroOverlay({ nonce })`, `WorkflowSection({ items })`, `PlaygroundSection()`), the nonce read, `LockupParts.tsx` (one hidden `<svg>` sprite of `<symbol>`s, rendered once; the intro and the playground use `<use href>`), the i18n keys of every lane, the `skipIntro` e2e helper added to every spec that opens `/`, T-HOME1 with `workflow` (family G), the Payload `workflow` block with its migrations and fixture rows, the `SiteShell` scroll-lock exclusion for `#intro`. Nothing under `src/experience/**`. |
| ENGINE | master, pins API, tier wiring, overlay, events | The `SceneContext` and `DomScene` contract, the `dom/` map and the eleven no-op scene modules (wave A; each scene lane overwrites its own in wave B), labels and segments from measured bounds (a scene's segment is its element's own range, so a nested scene overlaps its parent), the DOM scene hook, pins in document order before the master, `nearViewport` with a once guard, refresh on resize, rotation, fonts and any height change (ResizeObserver; FAQ toggles), keep-place across a relatch (reduced-motion switch, «کیفیت»), teardown on route change, D5 canvas gate, frame monitor on the ticker, overlay rows `scene` and per-scene fps plus the snapshot fields `tickSubscribers` and `draggables`, `scene_view` sender (IntersectionObserver in `ExperienceRoot`, works at tier 0), the allowlist change, `sefid:scroll-to` for the booking routes while Lenis runs. |
| INTRO | 0 | Overlay dialog, inline `<style nonce>`, inline script under 2 KB with its CSP hash and hash test, session-once (`sessionStorage['sefid-intro']`), skip on tap, any key and «رد کردن انیمیشن», the evenodd mark-frame reveal scaled by transform over hero B, progress bound to `document.fonts.ready`, the hero image `decode()`, `load` and the `sefid:intro-progress` hook, 400 ms minimum, 1400 ms cap with a CSS failsafe, reduced-motion exit, zero CLS, no markup on other routes, the client component that removes the closed dialog after hydration. |
| HERO+TRUST | 1, 2 | CSS settle (D11), the exit with the photo at 0.85x from 1024 px at tiers 1 to 3 (transform on the photo layer, never on the `[data-experience-cover]` section; the child spans the hero element's own range), the trust band as the 40 vh world window under the photo from 1024 px at every tier in the server HTML (D18, `data-world-slot="hero-exit"`), relief default off (D3), the optional mask contraction at tiers 2 and 3 kept only at 60 fps at 4x. |
| SERVICES | 3 | One markup: bento from 1024 px, snap row under it (D6); the pinned horizontal track at 1024 px and tiers 2 and 3 (+200 vh), the mark morphing through the five category outlines with MorphSVG in a lazy chunk, the focus-to-scroll map for off-screen worlds, line reveals at tier 1, the phone progress bar from an IntersectionObserver, `data-lenis-prevent-horizontal` on the row, the backdrop slot. |
| RESTORATION | 4 | The SVG stepper (D16) with the tier CTA following the active step: pinned scrub (+100 vh) at 1024 px and tiers 2 and 3 selecting the step from scroll without `tier_select`, the tap control everywhere else, `tier_select` only on a user choice, arrow keys keep the chip in view, the molar slot for phase 8. |
| WORKFLOW | 5 | `WorkflowSection` from the `workflow` block (D2): vertical steps with diamond markers and real photos at tiers 0 and 1 and on phones, the pinned diagonal (+200 vh) at 1024 px and tiers 2 and 3 with photo billboards on the path, opacity overlays instead of per-frame custom properties (prototype 0c measured 54 fps at 4x). |
| COMPARE+DENTISTS+VOICES+LIGHT | 6, 7, 8, 9 | One-shot reveals, the existing `CompareSlider` with its handle moved by transform, depth parallax on the dentist portraits on fine pointers only (8 px, in the ticker), the DOM carousel with previous and next buttons for voices, the warm layer scrubbed across scene 9 and held through 10 and 11, contrast re-checked at the warmest state. |
| BOOKING+FOOTER | 10, 11 | The booking card rising once on enter and completing at once on focus or a CTA route; the playground stage with the lockup parts dropping on enter, Draggable and InertiaPlugin in a lazy chunk, bounds, floor, 6 s return home, touch, «پخش دوباره»; the «کیفیت» control (`setUserOverride`, `localStorage['sefid-quality']`) showing the effective tier and the reason it differs. |
| QA | gates and evidence | `measure-home.mjs` tiers option and steps folders, `tests/perf/scenes.spec.ts` per-scene recorder at 4x and 6x and on SwiftShader with the thresholds behind `PERF_GATE=1` (D19), the 390 px touch run, the `?tier=1` Lighthouse warnings turned into errors (LCP best-of-5 like tier 0) with `home.interimKiB` 170 and `home.deferredKiB` 65, the `check:bundle` gsap needle for the home class, screenshots at the three widths in both themes with reduced motion on and off and the intro at 50%, the recordings. |
| INTEGRATOR close | - | Apply lane hand-backs in the order of section 4, measure after each, independent review, report, gaps, deploy to staging through the Server workflow, the Persian hand-off. |

### 3. Contracts fixed in step 0 (every lane builds on them)

DOM scene hook (ENGINE owns the engine side; each scene lane owns one
module `src/experience/scenes/dom/<scene>.ts`, imported by the ENGINE-owned
map `scenes/dom/index.ts`, bundled in the engine chunk, never in initial JS):

```ts
export interface SceneContext {
  id: SceneId;
  el: HTMLElement;                       // the [data-scene] element
  layout: LayoutLatch;                   // pins, lenis, latchedAtTier
  settings: TierSettings;                // heroExitParallax, heroExitMask, pointerParallax, ...
  conditions: { reduce: boolean; fine: boolean; wide: boolean };
  engine: ScrollEngine;                  // scrollTo, onTick, sceneProgress
  master: gsap.core.Timeline;            // add unpinned scrubs at `label`
  label: string;                         // the scene's label in the master
  segment(): { start: number; end: number }; // master time units 0..1, the scene element's own scroll range, re-read on refresh; a nested scene (trust inside hero) overlaps its parent instead of shortening it
  nearViewport(cb: () => void): () => void;  // exactly once, when the scene is within one viewport (an immediate check and the trigger's onEnter share one guard)
}
export interface DomScene {
  pin?(ctx: Omit<SceneContext, 'master' | 'label' | 'segment'>): void; // before the master, document order
  setup(ctx: SceneContext): void | (() => void);                        // after the master
}
```

Rules: everything a scene creates inside `pin` and `setup` lives in the
engine's matchMedia context and is reverted by `destroy()`; a scene's own
listeners, IntersectionObservers, Draggables and delayed calls are returned
as the cleanup, and the cleanup also removes every class, attribute and
property the scene added (`data-reveal`, `.in`, `aria-current`, a
`checked` it set, `will-change`, a restored `d`), because `mm.revert()`
undoes inline styles only; T-EN3 asserts the resulting page by list. Pin
starts are functions in pixels (`start: () => \`top ${navH}px\`` with the
`--nav-h` token read from the root's computed style), never a CSS
variable string. `pin` pins an inner element, never the `[data-scene]`
element (the spacer must sit inside it; `insidePinnedRange()` depends on
it). `setup` runs on phones too (no Lenis, no pins): it must branch on
`conditions.wide`, `layout.pinnedScenes` and `settings`. No scene reads
`tier.tier` to decide a pin. Plugin chunks load through `nearViewport`.

Engine refresh: `ScrollTrigger.refresh()` after `fonts.ready` (exists), on a
ResizeObserver of the root (height changes: images, FAQ toggles, the tier
attribute appearing, theme CSS), rAF-debounced; `invalidateOnRefresh` on
every trigger; labels and child positions are rebuilt from the measured
bounds on every refresh. Relatch keep-place: `ExperienceRoot` records the
active scene and its progress before destroying an engine for a new layout
and restores the scroll position from the new bounds after the first
measure.

Intro contract (exists in `core/browserSignals.ts`): `html[data-intro]` is
`playing` while the overlay is up and `done` after; the end dispatches
`sefid:intro-end` on `document`; the script's hard cap is 1400 ms from its
own execution (`t0`), while `isIntroDone()` counts 1400 ms from navigation
start and stays the canvas gate only: the client component that removes
the dialog follows `html[data-intro]` and the event, never that cap, with
one backstop at the `intro:start` mark plus 1600 ms that closes the dialog
itself (a hidden but open modal keeps the page inert); the overlay script
is `INTRO_SCRIPT` with `INTRO_SCRIPT_SHA256` next to the theme script
pattern; `sefid:intro-progress` (`detail.p` in 0..1) lets phase 8 feed
asset loading into the bar. The lockup parts are one hidden `<svg>` sprite
of `<symbol>`s rendered once in `page.tsx` outside the dialog; the intro
and the playground reference them with `<use href>`, each moving part as
its own `<svg>` element transformed by CSS.

Markup hooks: `[data-scene="<id>"]` (engine), `[data-home-section]` and
`[data-family]` (T-HOME1), `[data-experience-cover]` (render gate),
`[data-world-slot="<name>"]` on every transparent placeholder phase 8
replaces, `html[data-tier="N"]` overrides of a tier-0 default in CSS. No
`style` attribute in server HTML (CSP). No `scroll` listener. No gsap import
outside `src/experience/**` and never on a tier-0 path.

`scene_view` (ENGINE): `EVENT_NAMES` gains `scene_view`; `EVENT_LOCATIONS`
gains `trust`, `services`, `restoration`, `workflow`, `compare`, `dentists`,
`voices`, `first-visit`, `booking` (`hero` and `footer` exist). The sender
fires once per scene per page view when the scene's top crosses the
viewport middle (IntersectionObserver, `rootMargin: '0px 0px -50% 0px'`),
at every tier, from `ExperienceRoot` (already in the home route chunk, no
new island). GA4 gets `location` only. `docs/analytics.md` section 2 gets
the row; `normalizeEvent` tests and the events route test gain the cases.
`tier_select` keeps its meaning (a restoration tier chosen by the user);
the «کیفیت» control sends no event.

CSP for the inline intro script: the script is rendered with the request
nonce (T-HD1 requires it on every executable script) and listed by hash in
the public `script-src` next to `THEME_INIT_SCRIPT_SHA256`; `csp.test.ts`
CSP2 asserts the new list; a unit test recomputes the SHA-256 of
`INTRO_SCRIPT` and pins the byte size under 2048; the inline CSS is a
`<style nonce>` element, so `style-src` is unchanged; the SVG parts carry
no `style` attributes; `page.tsx` reads the nonce from the `x-nonce` request
header; T-HD3 gets `/?tier=2` at 1440 px (pins) and a fresh-context home
load (the intro) and still records zero `securitypolicyviolation` events.
GSAP core and the three plugins use no `eval`; ScrollTrigger's one raw
`style` attribute write on `body` at registration is empty and passes
Chromium today (T-HD3 at `/?debug=1&tier=1`).

### 4. Order, with a measurement after each step

Build in waves; integrate in this order. Each integration step runs
`npm run lint`, `npm run typecheck`, `npm test`, the lane's e2e spec, then
the measurement named; a step that breaks a budget is reverted, never the
budget (brief step 2). Frame numbers come from
`E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/steps/<nn>-<lane> --only=frames --tiers=1,2`
(after `npm run build` and `npm run db:e2e`); the full command without
`--only` runs at steps 2, 8 and 9.

| Step | Lands | Measurement that must hold |
|---|---|---|
| 0 | INTEGRATOR step 0 (pure moves, slots, three null stubs, the sprite; nothing under `src/experience/**`) | `npm run ci:local` green on its own (every added file imported and typed); `check:bundle` home within 0.3 KiB of 155.2 KiB; content pages unchanged; the home HTML diff is the sprite, the slots and the band's classes only. |
| 1 | ENGINE and QA gates (wave A, parallel with INTRO) | Frames tier 1 at 4x and 6x with `PERF_GATE=1` on the local `perf-default` project: no long task over 100 ms, 6x median at least 50 fps; Lighthouse mobile `/?tier=1`: TBT at most 200 ms, LCP at most 2500 ms best-of-5, total JS at most 235 KiB (the canvas chunk gone); route change leaves the snapshot equal to a fresh load (0 leaked triggers, tick subscribers, Draggables); `scene_view` once per scene; the engine chunk at most 64 KiB transfer (T-EX5). |
| 2 | INTRO (wave A) | Full run: LCP on `/?tier=0` and `/?tier=1`, mobile and desktop, within +100 ms of the baseline (2346, 2636 before step 1, 564, 553); CLS 0; intro duration at most 1400 ms in the e2e (`performance.measure`) and from the bar on the phone project; no viewport-sized paint after stage 3 starts (T-IN1 trace); the dialog survives a 1200 ms document delay until `sefid:intro-end` (T-IN10); inline JS under 2048 bytes; T-HD1 and T-HD3 green. |
| 3 | HERO+TRUST (wave B starts; scene lanes build in parallel on the step 1 engine) | Frames `hero`, `trust`, `none` at tiers 1 and 2, 4x: median at least 59 fps, slowest window at least 55, worst frame at most 50 ms; the mask stays only if this holds at tier 2; CLS 0 at 1440x900 and 1440x1200 with the band in the server HTML (D18), the band's rect identical at `?tier=0` and `?tier=2`; `translateY = 0.15 * scrollY` to the hero's bottom (T-HR2). |
| 4 | SERVICES | Frames `services` through the pin at tier 2; MorphSVG chunk never fetched at tier 0 and 1 or before `load` (T-EX5 extension); fast back-scroll and mid-pin resize transforms within 1 px of a fresh load; 375 px touch: no pin spacer, `scroll-snap-type: x mandatory`. |
| 5 | RESTORATION | Frames `restoration` at tier 2 (baseline tier 1 4x was 48.4 fps: the section must reach 59 after the canvas gate change and the scene work); scroll never fires `tier_select`; the CTA href matches the visible step. |
| 6 | WORKFLOW | Frames `workflow` at tier 2 on the fixture (prototype 54 fps at 4x must become 59); without the block, scenes 4 and 6 meet with no gap and V7 still passes. |
| 7 | COMPARE+DENTISTS+VOICES+LIGHT | Frames on the fixture at tiers 1 and 2; contrast of every text pair over the warmest state in both themes (`design/tools/contrast.py`); no pointer listener on coarse pointers; INP of a slider drag at most 200 ms. |
| 8 | BOOKING+FOOTER | Full run: INP of the hero and block submits at most 200 ms on all eight rows; frames `booking` and `none` (footer) while dragging and scrolling; Draggable chunk only near the footer at tier 1 or more; parts home 6000 ms after the last interaction; 0 Draggables after a route change; heap after GC within +0.5 MiB of the start. |
| 9 | Close: screenshots 390x844, 820x1180, 1440x900 in light and dark with reduced motion on and off, axe on home at tiers 0 and 2, the independent review (motion motivation, scroll integrity, pinned-scene accessibility), fixes in one batch, one more full run, report, gaps, commit, push, CI green, Server workflow `deploy` to `new.sefiddental.ir`, the Persian hand-off. | Every number of section 5. |

### 5. Budgets every lane must hold

| Metric | Baseline | After phase 7 | Gate |
|---|---|---|---|
| Home initial JS (`check:bundle`) | 155.2 KiB | at most 160 KiB: the intro client wrapper, the «کیفیت» island and the `scene_view` hook are the only additions; 0 bytes of gsap | 170 KiB interim (error; tightened from 215 so a stray 50 KiB gsap import cannot pass), 180 KB documented target; B3 also fails any script before `load` on home containing `_gsap` or `ScrollTrigger` |
| Content and booking pages initial JS | 144.2 to 149.2 KiB | unchanged within 0.3 KiB: no shared file (`SiteShell`, `SiteFooter`, `ui/*`, `chrome/*`) grows except the one-line `sefid:scroll-to` dispatch | 150 KiB (error) |
| Engine chunk (gsap core, ScrollTrigger, Lenis, 11 DOM scene modules) | 50.1 KB gz engine set | at most 64 KiB transfer; loads after `load` at tier 1 or more | T-EX5 asserts the size from the response (`request().sizes().responseBodySize`) and annotates it |
| Lazy plugin chunks | none | MorphSVG at most 12 KiB transfer (10 plus the icon paths); Draggable + Inertia at most 16 KiB; each only when its scene is within one viewport, the layout wants it, motion is not reduced, and exactly once per page view | T-SV3 and T-BF3 assert the sizes and the single fetch after a reload inside the scene |
| Lighthouse mobile `/?tier=0` | 0.98, LCP 2346, TBT 100, CLS 0 | score at least 0.95, LCP at most 2446 (baseline + 100 with the intro playing), TBT at most 200, CLS 0 | LCP 2500 best-of-5 (error), CLS 0.05 (error), score 0.95 (warn), script size 170 KiB (error) |
| Lighthouse mobile `/?tier=1` | 0.86, LCP 2636, TBT 457, JS 444 KiB | score at least 0.90, LCP at most 2500, TBT at most 200, total JS at most 235 KiB | errors: LCP 2500 best-of-5 (the same aggregation as tier 0; the median is printed by `lhci.mjs` and shown here), score 0.90 on the median, script size 170 + `home.deferredKiB` 65 = 235 KiB |
| Lighthouse desktop, both tiers | 1.0, LCP 564 / 553 | LCP at most 664 / 653 | - |
| Frames, desktop 1440x900, default GPU, 4x, tiers 1, 2, 3, every section | tier 0: 56.5 to 60; tier 1: 48.4 to 60 | median 1 s window at least 59 fps, slowest window at least 55, worst frame at most 50 ms, no long task over 100 ms | `tests/perf/scenes.spec.ts` with `PERF_GATE=1` on the measurement host at every step (D19); CI records the same numbers without asserting them |
| Frames, 6x | tier 1: 42.3 median | tier 1 at least 50 median (brief: never under 50 at tier 1), recorded per scene; tier 2 recorded | recorded |
| Frames, SwiftShader | tier 0 about 44.5; tier 1 about 22 | tier 0 within 2 fps of the baseline (no new tier-0 cost); `?tier=1` at least 44 (the canvas no longer renders); a software renderer is tier 0 in production | recorded |
| INP of the submits, 4x | 120 to 208 ms | at most 200 ms on all eight rows | `measure-home` |
| Heap after a full scroll and GC | +0.2 to +0.4 MiB | at most +0.5 MiB over the start at tiers 1 and 2 | `measure-home` |
| Intro | none | at most 1400 ms (target 1250), bar at least 400 ms, inline JS under 2048 bytes minified, inline CSS at most 3.5 KB minified, lockup SVG at most 9 KB in the home HTML only, CLS 0 | unit test and e2e |
| CSS / fonts | 14.1 / 90.1 KiB | phase adds at most 4 KiB gz of CSS; fonts unchanged | 50 / 120 KiB |
| Route change | 0 ScrollTriggers today | `ScrollTrigger.getAll().length === 0`, Lenis destroyed, no ticker callback, no Draggable, no IntersectionObserver, no intro listener | e2e |
| Reduced motion | tier 0 page | equals the tier 0 page, toggled mid-scene; screenshots of both states | e2e |

### 6. Phase 8 seams

- The WebGL layer: `CanvasRoot` (R3F, portal to `body`, `position: fixed`,
  z-index 0 under `.site` at z-index 1) mounts through `canMount` (loaded,
  intro done, tier 1 or more, visible) on idle once an engine exists; from
  this phase its chunk is requested only when `SCENES.some(s => s.webgl?.load)`
  or under `?debug=1`. Phase 8 fills `webgl.load` and `assets` per scene
  (`minTier` is set today; V7 asserts `load` stays undefined until then) and
  decides the two moments separately: the chunk download may start during
  the intro so `sefid:intro-progress` can feed the bar, while the WebGL
  context and the first scene are created at the hero exit, never at
  `load` and never before `isIntroDone()`.
- DOM placeholders phase 8 replaces or fills, all `[data-world-slot]`,
  transparent, `aria-hidden`: `hero-exit` (the 40 vh window after the hero),
  `services-backdrop` (the layer behind the horizontal track), `molar` (the
  SVG stepper at tiers 2 and 3), `workflow` (the stage behind the diagonal
  path: point cloud and solid tooth), `compare` (the DOM slider becomes the
  displacement wipe at tiers 2 and 3 from 1024 px), `voices` (the soft 3D
  carousel at tiers 2 and 3), `booking-mark` (the idle mark beside the
  form), `playground` (3D parts at tier 3). `tierSettings` already names
  them: `compareWipe`, `carousel3d`, `molar`, `footerPlayground`,
  `scenes3d`; phase 7 renders every `'webgl'` or `'3d'` value as its DOM
  form.
- Scene progress for WebGL scenes comes from `engine.sceneProgress(id)` and
  the master labels; `SceneProps.progress` and `active` are getters, never
  state. The warm light (`--warm` on the DOM layer) is mirrored to the
  world light in phase 8 by reading the same layer's variable.
- The WebGL 2 confirm (D20): once a scene declares `webgl.load`, every tier
  of 1 or more confirms a worker-only probe result with one main-thread
  context right after `load`, inside the Lighthouse window (23 to 24 ms in
  the tier 3 and debug controls on a software GPU), while three.js loads
  only at the hero exit (D5). Phase 8 picks one: confirm when `wantsCanvas`
  becomes true, accepting a later relatch to tier 0 when the confirm fails,
  or keep the confirm at `load` and count it against the tier 1 TBT budget.

### 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| GSAP bundle size: a static gsap import in any home component moves about 50 KB gz into initial JS; the three plugins add 25 KB gz | gsap only under `src/experience/**`; every scene module is in the engine chunk; MorphSVG and Draggable + Inertia in lazy chunks through `nearViewport`. The catch is real only with two changes: the home interim gate drops to 170 KiB (155 + 50 passed the old 215), and `check:bundle` B3 fails any home script before `load` whose body contains `_gsap` or `ScrollTrigger`; T-EX5 keeps the tier 0 and before-`load` checks for the three plugin names and the engine size. |
| INP of the phone block submit at tier 1 was 208 ms at the baseline, over the 200 ms gate before any scene lands | D5 removes the canvas evaluation that competed with the handler; T-BF2 measures again at step 8; if it still misses, the integrator adds one yield before the fetch in `BookingFormIsland`'s submit handler (`await new Promise((r) => setTimeout(r))`, so the pressed state paints before the request is built), re-checks the booking page budget with `check:bundle`, and records the before and after numbers. |
| A full-viewport SVG repainting every frame of the intro (CSS transforms on SVG children composite in WebKit never and in Chromium only sometimes) would land inside the LCP and TBT window on phones | The intro moves one `<svg>` element per part (frame, diamonds, strokes, wordmark, bar) with CSS transforms on the element, `will-change` only on the current stage's parts; T-IN1 records a devtools timeline trace and fails on any `Paint` event over 25% of the viewport after stage 3 starts. |
| Lenis with RTL | Lenis is vertical only; the horizontal track moves by GSAP transform, not by scroll. The phone and tablet snap row carries `data-lenis-prevent-horizontal` so trackpad swipes reach it under a fine pointer at 744 to 1023 px. `scrollTo` targets are elements or document pixels, never scroll-left values. |
| Pinning in RTL | ScrollTrigger pins by physical rect, direction-agnostic; the track distance is computed from `getBoundingClientRect().width` minus the rail width, never from `scrollLeft`; the e2e asserts the first world at the start edge at the pin start and the last world flush within 1 px at the pin end, in both scroll directions. |
| Safari (no WebKit in the cloud session; Chromium only) | APIs limited to Safari 16: `dialog` with `showModal`, `inert`, `overflow: clip`, `svh`, `:has()`, `translate`; Lenis is capped at 60 fps there and off on touch; the client's iPhone check is on the hand-off list and the phase 8 real-device checklist. |
| Low-end Android | Tier 1 has no pins, no parallax, one-shot reveals only; the snap row and the slider are native; `touch-action: none` only on the playground parts; the frame monitor (now on the gsap ticker) steps to tier 0 under 55 fps for 2 s; the perf spec adds a 390 px touch run at 6x; the client's phone at the hand-off. |
| ScrollTrigger refresh on a theme switch | A theme switch changes colors only; the ResizeObserver refresh covers any height change it causes (and FAQ toggles, image loads, the tier attribute); the e2e toggles the theme mid-pin at tier 2 and compares transforms with a fresh load within 1 px. |
| Intro hydration and LCP | The script changes only `html` attributes and the dialog's open state; the dialog has `suppressHydrationWarning`; React removes nothing before hydration; the LCP text moves by transform only; the hero paints beneath the top layer; measured at steps 2 and 9 against the baseline. |
| Tier 1 budgets fail before any scene lands | D5 removes the canvas chunk from phase 7; step 1 proves TBT and LCP before any scene is integrated; if TBT still exceeds 200 ms, the engine is created on idle after `load` and its creation is measured (`engineInitMs` in the overlay snapshot, at most 50 ms at 4x). |
| Prototype 0c (54 fps) and 0e (54 fps) are under target at 4x | Fixes are named in the lane briefs (opacity overlays instead of per-frame custom properties, `will-change` only on the focused step or the pressed part); each is measured alone at its step and reverted if it fails. |
| Pin spacers and React | Pins wrap an inner element whose children never change after hydration; created in document order before the master; reverted in the matchMedia context before React unmounts. Verified: whether `mm.revert()` kills Draggables (BOOKING+FOOTER owns the check; the cleanup kills them explicitly either way). |
| Booking routes fight Lenis | `bookingRoute.ts` dispatches `sefid:scroll-to`; the engine answers with `engine.scrollTo` while Lenis runs; the e2e checks the header CTA lands on the block within 1 px at tier 2 with a fine pointer. |
| JavaScript on, but the app chunks never run (a blocked or failed download): the states D21 moved to attributes stay as the server HTML renders them | Accepted trade-off of D21 (no pure-CSS form exists without `:has()`): the restoration tiers keep their plain «رزرو نوبت», which still opens booking but without the tier preselected, and lose the warm card and badge; home scene 4 keeps its no-tier panel; the phone drawer still opens natively but the page under it keeps scrolling and the sticky bar stays; the services caret does not turn. The avulsion first aid is pure CSS and still works. `tests/e2e/no-has.spec.ts` T-NH8 to T-NH10 pin this. |
| Staging deploy from this session | Every server action runs through the Server workflow on GitHub (the studio has no SSH to the server); `deploy` needs green CI on the commit; the hand-off waits for the workflow's health check. |

### 8. Hand-off (brief and brief decision 20)

Statement first, not a question: phase 7 is the scroll skeleton in the
DOM; the ThreeUI-style glass mark, particles, backdrop, wipe and glow are
phase 8 (D17). Then, on `https://new.sefiddental.ir`, phone and desktop:

1. One line per scene that renders (intro, hero, trust and the hero exit,
   services, restoration tiers, first visit and FAQ, booking, footer
   playground): keep, tone down, or change.
2. Which scene feels closest to immersive-g.com and hidokmeh.com, and which
   does not.
3. Does the playground feel right (drop, throw, return after 6 seconds)?

Pending inputs listed again, not asked anew: gap 48 (the digital workflow
scene appears only after it), gap 36 (the real hero photo; the relief
decision waits for it), one published case, dentist and consented
testimonial for scenes 6 to 8 (existing gap rows); the client sees those
scenes in the phase 7 recordings of the sample fixture.

## Delivered

(filled at the close)

## Decisions and deviations (what, why)

(section 1 of the plan, extended at the close)

## Verification (what, how, result)

(filled at the close)

## Budgets (metric, target, measured, per tier where relevant)

(section 5 of the plan with the measured column, filled at the close)

## Screenshots and recordings (paths)

`docs/qa/phase-07/baseline/` (before). Steps and final runs under
`docs/qa/phase-07/steps/` and `docs/qa/phase-07/final/` (filled at the close).

## Independent review (findings, fixes)

(filled at the close)

## Content gaps added or closed

(filled at the close)

## Risks and open questions (max 5 questions for the client)

(section 8 of the plan, updated at the close)

## Prerequisites for the next phase

(filled at the close)
