# Reference Inspection

Measured on 2026-10-12 from the cloud build environment with Playwright
(Chromium 141, software GPU, through the environment's proxy). Frame rates
measured here are not representative of real hardware and are omitted.
Screenshots: `content/reference/inspection/immersive-garden/`.

Status per site:

| Site | Status | What remains |
|---|---|---|
| immersive-g.com | inspected (sections 2) | real-device frame rates, mobile scroll beyond the hero (synthesized touch gestures did not move the virtual scroll) |
| hidokme.com | unreachable: the gateway answered 502 (upstream not responding) and the domain did not resolve through DNS-over-HTTPS | the client confirms the exact address; the browser session (`docs/prompts/aux-reference-inspection.md`) inspects it |
| sefiddental.ir | unreachable from abroad (TLS reset by the origin) | the browser session runs section 4 of the aux prompt |
| github.com/MengTo/threeui | reviewed from source | see `docs/discovery/threeui-review.md` |

## 1. Summary

Immersive Garden's home page is one continuous virtual-scroll journey
through about 18 project cards in a light plaster world where white
bas-relief sculptures (birds, hands, leaves, folded fabric) drift with
parallax. It is Nuxt on Vercel, OGL plus three.js for WebGL 2, Lenis for
smooth virtual scroll, GSAP for timelines, Howler for sound, KTX2 and Draco
assets. It downloads about 16.7 MB, shows a percentage preloader for about
15 seconds on our connection, disables pinch zoom, has no reduced-motion
path and no WebGL fallback. Beautiful, cohesive and far too heavy for a
clinic site on Iranian mobile networks. We take its world-building and
rhythm; we reject its loading model.

## 2. Immersive Garden (immersive-g.com)

### 2.1 Technical stack

| Item | Measured |
|---|---|
| Framework | Nuxt 3 (Vue), SSR with `_payload.json` (58 KB), content from a Strapi-style CMS (image variants `large_`, `small_`, `thumbnail_`) |
| Hosting | Vercel (`server: Vercel`, `x-vercel-cache: HIT`), HSTS |
| WebGL | one full-viewport `webgl2` canvas; 5 to 11 small `2d` canvases for icons and the progress circle |
| Libraries in the entry bundle | three.js (one `REVISION`), OGL (152 references), GSAP (49), Lenis (55), Howler (55), KTX2Loader, DRACOLoader, GLTFLoader, EffectComposer (2), vue3-lottie (314 KB chunk) |
| JavaScript | entry chunk 2.44 MB raw, 667 KB gzipped, plus 11 small chunks |
| HTML | 233 KB raw, 43 KB gzipped |
| Fonts | 2 woff2, 59 KB total: PSTimes (serif display), Helvetica Neue Regular and Light |
| Total transfer, home, desktop | 16.7 MB in 115 requests |
| Total transfer, home, mobile | 16.5 MB in 104 requests (no mobile-specific reduction observed) |
| Largest assets | two KTX2 normal maps at 2.2 MB and 2.1 MB (`textures/ktx2/ultralow/`), marble webp 621 KB, noise PNGs 350 to 440 KB each (5 files), project JPG 617 KB, matcap PNG 554 KB, three MP3 loops 1.07 MB |
| 3D assets | 4 GLB models (Draco), 3 `.3dl` LUTs, 2 WASM decoders |
| Quality tiers | texture folders named `ultralow` suggest quality variants exist; the entry bundle has no `deviceMemory`, `hardwareConcurrency` or `prefers-reduced-motion` checks |
| Sound | three looping MP3s (actions, marble crack loop, thunder transition) with an on-screen «On» toggle |
| Third parties | none: every request goes to immersive-g.com |

### 2.2 Loading and first paint

| Item | Measured |
|---|---|
| `load` event | 1.3 s desktop, 11 s mobile emulation |
| Preloader | a percentage counter (0 to 100) over a blank plaster background with the logo and tagline; the world appears only at 100 |
| Time to ready | about 14 s desktop, about 21 s mobile on our connection; assets keep loading after the first interaction |
| Without WebGL (`--disable-3d-apis`) | the preloader never finishes; the visitor is stuck on a blank page with the logo |
| With `prefers-reduced-motion: reduce` | no change: the same preloader and the same motion |
| Viewport meta | `maximum-scale=1, user-scalable=0` (pinch zoom disabled) |

### 2.3 Scroll choreography (desktop, 1440x900)

Virtual scroll: `body` has `overflow: hidden`, the document is one viewport
tall, and Lenis maps wheel and touch input to a transformed container.
Native scrollbar dragging and keyboard scrolling do not exist. A thin
progress line sits at the bottom edge; a small dot marks progress.

| Scene | What happens |
|---|---|
| 0 Preloader | logo, tagline, counter |
| 1 Hero | logo and «Innovative digital experiences studio» in a small serif at top-left of a light plaster plane; «Scroll down» cue; sculpture fragments fade in |
| 2 Manifesto | «A global leader in groundbreaking digital design and strategy...» centered, fades in while a white relief sculpture drifts behind |
| 3 to 20 Projects | one project per viewport: a video card (16:9 or 4:3) placed at a different position each time (bottom-left, top-right, center, right edge), a two-to-four line serif caption placed near it, a white sculpture fragment (hand, bird, leaf, folded cloth) crossing the frame with parallax; the card and caption positions alternate so the eye travels across the screen |
| about 11 «Our approach» | the rhythm breaks with a centered one-line manifesto and a wide faded video |
| last | «See all projects» stays pinned bottom-left throughout; «Menu» stays top-right |

Direction changes: none observed on the home page; movement is vertical
with parallax depth. The famous horizontal and diagonal moves live in their
project case studies, not on the home page.

### 2.4 Interaction inventory

| Interaction | Observed |
|---|---|
| Pointer parallax | the sculpture layer shifts with the cursor on desktop |
| Hover | not measurable on video cards in headless mode |
| Sound | toggle bottom-right; sounds on actions and transitions |
| Menu | «Menu» top-right opens an overlay (not recorded) |
| Keyboard | no native scroll; arrows and space do nothing |
| Reduced motion | ignored |
| Zoom | disabled |

### 2.5 Mobile behavior (390x844 emulation)

The hero shows a dense white relief of birds, flowers and leaves filling
the screen behind the logo, the tagline and «Scroll down»; the relief
breathes and drifts on its own. The sound toggle and «See all projects»
sit at the bottom. Synthesized touch gestures did not advance the virtual
scroll, so deeper mobile scenes were not captured; the client's phone
recording covers this.

### 2.6 Performance under stress

Not representative in this environment (software GPU: 1 to 16 fps). The
asset budget alone tells the story: 16.7 MB before the page is usable,
with no mobile reduction.

### 2.7 Design system observations

| Item | Observed |
|---|---|
| Palette | one light plaster gray (about `#E6E7E7`) with white sculptures and near-black text; no accent color at all |
| Type | serif display (PSTimes) at modest sizes, Helvetica Neue for UI labels; small type, generous whitespace |
| Layout | asymmetric placement of one card and one caption per viewport; nothing centered except the manifesto lines |
| Texture | subtle plaster grain on the background, soft shadows on reliefs |
| Motion | slow drift, parallax on scroll and pointer, fades for text; nothing bounces |
| UI chrome | four tiny elements: logo, Menu, See all projects, sound toggle |

### 2.8 Accessibility and SEO

Empty `<h1>`, no `<h2>`; text exists in the server HTML (2.3k characters
of captions); 39 images; no zoom; no keyboard scrolling; canvas has no
`aria-hidden`; meta title and description present; Open Graph present;
`lang="en"`.

### 2.9 Verdict for Sefid Dental

Take this:

- One continuous world with a single material language. Our translation:
  a porcelain relief world. Teeth are porcelain and enamel; white relief
  sculptures of the tooth mark, the diamonds and natural forms drifting in a
  warm off-white plaster space is on-brand in a way no other clinic site is,
  and it reads calm. The dark theme becomes navy with teal glass.
- One card and one caption per viewport, placed asymmetrically, with a
  sculpture crossing the frame: our service and case scenes.
- Tiny UI chrome, a progress line, a persistent primary action
  («See all projects» becomes «رزرو نوبت»).
- A manifesto beat that breaks the rhythm («Our approach» becomes
  «اولین مراجعه چگونه است»).

Avoid this:

- 16.7 MB and a counter preloader: our budgets stay (home 2.5 MB at tier 3,
  1.2 MB at tier 2, 500 KB at tier 1, poster first, never a counter that
  blocks content).
- Virtual scroll with `body { overflow: hidden }`: no keyboard, no
  scrollbar, no native feel on phones. We smooth native scroll on desktop
  only.
- No WebGL fallback and no reduced-motion path: our tier 0 is a complete
  site.
- Disabled zoom and an empty H1.
- Sound: none for a clinic; a worried patient does not want surprise audio.
- No mobile-specific asset reduction.

## 3. hidokme.com

Not reachable from this environment: the gateway returned 502 (the upstream
did not answer) and public DNS-over-HTTPS did not resolve the name. The
client confirms the exact address; the browser session inspects it.

## 4. sefiddental.ir

Not reachable from abroad (TLS reset by the origin). The browser session
runs section 4 of `docs/prompts/aux-reference-inspection.md`.

## 5. Files produced

- `content/reference/inspection/immersive-garden/desktop-scroll-sheet.jpg`: 40 frames of a full desktop scroll
- `content/reference/inspection/immersive-garden/desktop-key-frames.jpg`: four frames at full size
- `content/reference/inspection/immersive-garden/mobile-hero-sheet.jpg`: 31 frames of the mobile hero over time
- `content/reference/inspection/immersive-garden/mobile-preloader.jpg`
- `content/reference/inspection/immersive-garden/fallbacks-no-webgl-and-reduced-motion.jpg`

## 6. Open questions

- The exact address of the second reference site (gap 33).
- Phone recordings of both reference sites from the client, which also
  show the mobile scroll beyond the hero.
