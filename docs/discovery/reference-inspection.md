# Reference Inspection

Measured on 2026-10-12 from the cloud build environment with Playwright
(Chromium 141, software GPU, through the environment's proxy). Frame rates
measured here are not representative of real hardware and are omitted.
Screenshots: `content/reference/inspection/immersive-garden/`.

Screenshots for the second site: `content/reference/inspection/dokmeh/`.

Status per site:

| Site | Status | What remains |
|---|---|---|
| immersive-g.com | inspected (sections 2) | real-device frame rates, mobile scroll beyond the hero (synthesized touch gestures did not move the virtual scroll) |
| hidokmeh.com (Dokmeh Agency, Tehran) | inspected (section 3); the first address the client sent was misspelled | real-device frame rates |
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

## 3. Dokmeh Agency (hidokmeh.com)

An award-winning web design agency in Tehran. This matters twice: it shows
what an Iranian studio ships for Iranian networks, and it has a Persian
version of the same experience.

### 3.1 Technical stack

| Item | Measured |
|---|---|
| Framework | Next.js (App Router, Turbopack chunks), prerendered HTML (`x-nextjs-prerender: 1`), ISR with a 300 s stale time |
| Scroll | native document scroll (page height about 21 viewports on desktop, 17 on phones) smoothed by Lenis (`html.lenis`); keyboard and scrollbar work |
| WebGL | two `webgl2` canvases on desktop, one on phones: a pinned scene of a wooden and brass column standing in a foggy sea, lit by an HDR environment (`warm_reception_dinner_1k.hdr`, 1.4 MB on desktop, a 128 KB `_256` version on phones), one GLB model, PBR metal textures (color, normal, roughness webp) |
| Video | hero and intro videos: a 64 MB intro MP4, a 9 MB loop and a 4.6 MB background on desktop; a single 1.7 MB background on phones |
| Fonts | Satoshi variable and Fragment Mono (57 KB); the Persian version adds «Abar» for headings |
| JavaScript | 38 chunks on desktop, 21 on phones, all small (Turbopack splitting) |
| Total transfer, home, desktop | 80.6 MB in 136 requests (77.8 MB of it video) |
| Total transfer, home, mobile | 2.9 MB in 52 requests |
| Security | `X-Frame-Options: DENY`, HSTS, a report-only CSP that allows only self, its CMS subdomain and Google Analytics |
| CMS | `cms.hidokmeh.com` (headless CMS behind the same CSP) |
| Third parties | Google Tag Manager and Analytics only |
| Extras | an «Ask AI» entry with icons for several assistants; an English and a Persian version |

### 3.2 Loading and first paint

The hero shows a full-bleed video of golden grass in the wind behind a
white headline and award laurels; `load` fires in 4.2 s on desktop and
2.3 s on phones, the page is usable at once, and the big videos stream in
the background. No preloader. Software-GPU frame rate stayed near 60 fps on
both viewports, which means the WebGL work is light.

### 3.3 Scroll choreography (desktop)

| Scene | What happens |
|---|---|
| 1 Hero | full-bleed video, centered white headline («We design change-making website experiences...»), laurels, «Scroll to explore ↓»; a persistent yellow pill at the top holds the logo and «Menu» |
| 2 Founder | white section: portrait, name, title, and a bold manifesto paragraph |
| 3 Monument (pinned) | the 3D column in the foggy sea stays pinned while three counters (45+ awards, 350+ projects, 15+ years) and then «WHY US?» with a paragraph slide in one after another over the scene |
| 4 Trusted by | a clean 4x2 logo grid with a headline |
| 5 Selected works | «More Than +350 Projects in 15 years», then a masonry of device mockup cards with captions |
| 6 Awards | cards fanned out in 3D depth, a paginated list (01/10) with award names and dates |
| 7 What we do | giant ghosted outline words (Websites, E-commerce, Brand Identity, Interior Design) sliding past |
| 8 Footer | huge navigation words, contact details, social icons |

Direction changes: none; vertical with one pinned scene and depth effects.

### 3.4 Mobile (390x844)

Native scroll works. The same order as desktop; the monument scene is
pinned on phones too with the counters over it; the masonry becomes one
column; the awards fan becomes one card at a time with arrows; the videos
are replaced by a single light background video. Total 2.9 MB.

### 3.5 Persian version (`/fa/`)

`dir="rtl"` and `lang="fa"` are set after hydration (the server HTML still
says `lang="en"`), the H1 becomes «تجربه‌های دیجیتال ماندگار» in the Abar
font, Latin body text keeps Satoshi, the menu is translated, and the layout
mirrors. Numbers stay Latin. It is a competent Persian port, with the
server-side `lang` bug as the one thing not to copy.

### 3.6 Design system observations

| Item | Observed |
|---|---|
| Palette | white sections with near-black text, one bold accent (yellow pill and buttons), photographic and foggy-gray scene backgrounds |
| Type | Satoshi (geometric sans) at large sizes, Fragment Mono for labels, Abar for Persian display |
| Layout | centered hero, pinned scene with left-aligned overlays, grids and masonry, ghosted giant words |
| Motion | Lenis smoothing, counters that slide in while the scene stays, cards with 3D depth, text that reveals on scroll |
| UI chrome | one persistent pill (logo plus Menu) in the accent color |

### 3.7 Accessibility and SEO

One real H1, H2 and H3 structure, 2.5k characters of real text, Persian
version with proper `dir`, zoom allowed, `viewport-fit=cover`; CSP in
report-only mode; the 64 MB desktop video is the single performance flaw.

### 3.8 Verdict for Sefid Dental

Take this:

- The loading model: usable at once, media streams later, phones get a
  tenth of the bytes. This is our tiered loading in practice.
- Native scroll smoothed by Lenis with keyboard and scrollbar intact.
- The pinned monument with counters sliding over it: our trust band over
  the molar scene (scene 2 to 4 of the journey).
- The persistent accent pill with one action: our sticky «رزرو نوبت».
- Fanned cards with depth for the awards: our before/after and dentist
  cards at tiers 2 and 3.
- A real Persian version with a Persian display font and mirrored layout.

Avoid this:

- A 64 MB intro video on desktop.
- Ghosted giant outline words as a section: a known agency cliché and
  poor contrast.
- `lang="en"` in the server HTML of the Persian page.

## 4. sefiddental.ir

Not reachable from abroad (TLS reset by the origin). The browser session
runs section 4 of `docs/prompts/aux-reference-inspection.md`.

## 5. Files produced

- `content/reference/inspection/immersive-garden/desktop-scroll-sheet.jpg`: 40 frames of a full desktop scroll
- `content/reference/inspection/immersive-garden/desktop-key-frames.jpg`: four frames at full size
- `content/reference/inspection/immersive-garden/mobile-hero-sheet.jpg`: 31 frames of the mobile hero over time
- `content/reference/inspection/immersive-garden/mobile-preloader.jpg`
- `content/reference/inspection/immersive-garden/fallbacks-no-webgl-and-reduced-motion.jpg`
- `content/reference/inspection/dokmeh/desktop-scroll-sheet.jpg`: 31 frames of a full desktop scroll
- `content/reference/inspection/dokmeh/mobile-scroll-sheet.jpg`: 16 frames of a full mobile scroll
- `content/reference/inspection/dokmeh/persian-version-mobile.jpg`: the Persian version, hero and monument scene

## 6. Open questions

- Phone recordings of both reference sites from the client (real frame
  rates, the Immersive Garden mobile scroll beyond the hero, what the client
  likes most).
