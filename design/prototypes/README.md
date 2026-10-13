# Experience prototypes

Seven standalone pages that prove the riskiest ideas of the home experience
before the application exists. Each page opens with the question it answers.
They import only `../vendor/*`, `../tokens.css`, `../fonts/*` and
`../brand/*`: no CDN, no build step.

| File | Question | Engine |
|---|---|---|
| `00-porcelain-world.html` | Do the mark and the diamonds read as white porcelain reliefs on the warm surface, in both themes, at tiers 1 to 3? | three.js |
| `0a-intro.html` | Does the intro finish in 1400 ms or less with zero layout shift, skippable, once per session, with a reduced-motion branch? | CSS + Web Animations |
| `0b-services-horizontal.html` | Does the pinned horizontal services scene with the mark morphing into category icons hold 60 fps, and does the phone version stay native scroll snapping? | GSAP ScrollTrigger + MorphSVG |
| `0c-workflow-diagonal.html` | Does a diagonal pinned path with four steps stay readable and cheap without WebGL? | GSAP ScrollTrigger |
| `0d-molar-turntable.html` | Does the stylized molar look premium at tier 1, and does the normal / VIP / CIP transition read? | three.js |
| `0e-footer-playground.html` | Can the logo parts fall into the footer, be dragged and thrown, and return home? | GSAP Draggable + InertiaPlugin |
| `0f-compare-wipe.html` | Is the WebGL displacement wipe worth it over the DOM clip-path slider, with full pointer and keyboard access? | three.js, DOM fallback |

## Open them over HTTP

Chromium blocks module scripts and fonts for `file://` pages (origin
`null`). Serve the repository root and open the pages from there:

```sh
python3 -m http.server 8077 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8077/design/prototypes/0d-molar-turntable.html`.
Firefox opens the pages from `file://` directly.

## Controls and query parameters

Every page has a theme toggle. The WebGL pages (00, 0d, 0f) have a tier
switch (0 to 3), an fps meter, and accept `?tier=N`, `?theme=dark|light`
and `?panel=0` (hides the panel for screenshots); `00` also takes
`?auto=1` to drop a tier after two seconds under 55 fps; `0d` takes
`?scrub=0..1`; `0f` takes `?p=0..1`. Tier 0 is a static DOM or SVG
version with no WebGL context. Under `prefers-reduced-motion` every page
collapses to its tier 0 or static branch.

For measurement scripts the pages expose `window.__proto.getStats()` (00,
0d, 0f), `window.__intro` (0a: duration, CLS, skipped, reduced),
`window.__st` (0b) and `window.__pg` (0e).

Measured numbers live in `../NOTES-prototypes.md`; the storyboard
(`docs/experience/storyboard.md`) carries the summary per scene.
