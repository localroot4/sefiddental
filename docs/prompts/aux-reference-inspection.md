# Reference and Old-Site Inspection (browser session)

Run this in a Claude Code session that has a real browser (Chrome extension,
built-in browser, or Playwright with network access). The build sessions
cannot reach these sites. Inspect three sites, write one report, commit it
to this repository, and push. Follow the repository rules in
`docs/prompts/00-master.md` section 3 (commit as `localroot4
<atilnic@gmail.com>`, no tool or model names anywhere, branch `main`).

Sites:

1. `https://immersive-g.com` (Immersive Garden): creative and technical reference
2. `https://hidokme.com`: creative and technical reference
3. `https://sefiddental.ir`: the client's current site; content inventory,
   SEO baseline and the 301 map depend on it

Deliverables:

- `docs/discovery/reference-inspection.md`: the report, in English, with the
  exact section headings below. Tables over prose. Measured numbers only;
  write "not measurable" when something cannot be measured.
- `content/reference/inspection/<site>/`: screenshots and short recordings
  named as specified. Keep each recording under 15 MB (720p, 30 fps is
  enough); keep the folder under 150 MB in total.
- Commit in two commits (report, assets) and push to `origin main`.

Method notes:

- Use Playwright (Chromium) for measurements: `page.evaluate` for library
  detection, `CDPSession` for `Emulation.setCPUThrottlingRate`,
  `Performance.getMetrics`, `Network` events for transfer sizes, `page.video`
  for recordings. Use the real Chrome only where Playwright is blocked.
- Viewports: phone 390x844 (iPhone emulation, touch), tablet 820x1180,
  desktop 1440x900 at DPR 2. Light and dark color scheme emulation.
- Scroll in steps of 50% of the viewport height with 300 ms pauses, and
  separately one smooth continuous scroll, recording both.
- Never log in, never submit a real booking on the client's site; use the
  booking form only up to the last step without sending, or send a test
  with the name «تست سایت» and tell the client to delete it.

## Report sections

### 1. Summary

Ten lines max: what each reference site does that matters for a dental
clinic site, and the three biggest facts about the old site.

### 2. Immersive Garden (immersive-g.com)

#### 2.1 Technical stack

Table: framework (look for `__NEXT_DATA__`, `__nuxt`, `data-reactroot`,
Vite manifest), rendering (SSR or client-only: compare `view-source` text
to rendered text), 3D and animation libraries with versions (`window.THREE`,
`THREE.REVISION`, `window.gsap`, `gsap.version`, Lenis, Theatre, Pixi,
OGL, custom), smooth-scroll implementation, fonts (names, formats, total
bytes), total requests, total transfer (bytes, gzip), JS bytes, image bytes,
video bytes, 3D asset bytes (glTF, GLB, Draco, KTX2, basis), shader count
(count `<script type="x-shader">` and `gl.createShader` calls if
observable), number of `<canvas>` elements and the context type per canvas
(`webgl`, `webgl2`, `2d`), post-processing hints (EffectComposer, passes),
device pixel ratio used by the canvas (`canvas.width / clientWidth`),
service worker, CDN, cache headers, audio presence.

#### 2.2 Loading and first paint

Table: what is visible at 0.5 s, 1 s, 2 s, 3 s on desktop and phone (frame
grabs); preloader duration; whether the preloader blocks content; LCP, FCP,
TTI, CLS and total blocking time from Lighthouse mobile and desktop; the
order in which assets load (HTML, CSS, fonts, first image, three.js, models,
textures); whether loading continues after first interaction.

#### 2.3 Scroll choreography map

One row per scene, for desktop and for phone: scroll range (in viewport
heights from the top), direction (vertical, horizontal, diagonal, pinned,
free), what moves (camera, 3D object, text, images, background color,
light), the trigger (scroll position, pointer, time, click), easing feel
(linear scrub, eased scrub, snapped), whether native scroll is hijacked or
smoothed (test: wheel one notch, measure resulting scroll distance and
duration; try keyboard arrows and space; try dragging the scrollbar), how
fast back-scrolling behaves, whether sections snap.

#### 2.4 Interaction inventory

Table: pointer parallax, hover effects on cards and links, magnetic
buttons, drag or physics elements (find anything draggable; record a drag
and throw), cursor replacement, menu open and close animation, page
transitions between routes (record one), click targets inside pinned
sections, keyboard reachability of each interactive element, what happens
with `prefers-reduced-motion: reduce` (screenshots before and after), what
happens with WebGL disabled (`--disable-gpu` or `--use-gl=disabled`).

#### 2.5 Mobile behavior

Recording at 390x844 of a full scroll; what differs from desktop (dropped
scenes, horizontal sections turned vertical, lighter effects); touch
scrolling feel (native or smoothed); any scroll-jacking on touch; fps
estimate from the recording; battery or heat hints are not measurable.

#### 2.6 Performance under stress

Table for CPU throttling 1x, 4x, 6x: average fps during a continuous
scroll (measure with `requestAnimationFrame` sampling injected before
scrolling), longest task, dropped-frame share, JS heap before and after a
full scroll, whether the site reduces quality on its own (look for DPR
changes, disabled effects, a quality setting in the UI or local storage).
Then one run with the software GPU (`--use-gl=swiftshader` or
`--use-angle=swiftshader`).

#### 2.7 Design system observations

Colors in hex (background, text, accent, up to 8), fonts and sizes for
H1, H2, body, small (computed styles), line heights, letter spacing, grid
and container widths, section padding, border radius values, image and
video treatment (grain, grading, aspect ratios), motion durations and
easings seen in computed transitions or GSAP timelines (`gsap.globalTimeline`
inspection if accessible), light or dark theme, theme toggle.

#### 2.8 Accessibility and SEO

Headings outline, whether body text is real DOM text (select it) or
canvas, alt text coverage, focus visibility, tab order through one scene,
`lang` and `dir`, meta title and description, canonical, Open Graph, JSON-LD
types, sitemap and robots, Lighthouse accessibility and SEO scores, and
whether the main content exists in the server HTML with JavaScript
disabled.

#### 2.9 Verdict for Sefid Dental

Two short lists: "take this" (patterns that would serve a worried patient
on a phone) and "avoid this" (patterns that would hurt conversion, speed or
accessibility for this client).

### 3. hidokme.com

Same subsections 3.1 to 3.9 as section 2.

### 4. sefiddental.ir (the client's current site)

#### 4.1 Reachability

From the session's location: does the site load? HTTP status, TLS, server
header, hosting provider and country (reverse lookup of the IP), CDN. Also
test from a second location if the browser can use a VPN or a public web
proxy; record whether foreign IPs are blocked. Run the Google Search
Console style check: fetch with the Googlebot user agent from outside Iran
and record the response.

#### 4.2 Full URL inventory (needed for the 301 map)

Read `robots.txt` and every sitemap it lists; crawl all internal links from
the home page to depth 3. One table row per URL: URL, HTTP status, final
URL after redirects, page type (home, service, category, article, contact,
other), `<title>`, meta description, H1, word count, number of images,
images without alt, canonical, `noindex` or not, last modified if given.
Save the raw list as `content/reference/inspection/sefiddental/urls.csv`.

#### 4.3 Technical stack and hosting

CMS and version (WordPress generator tag, `wp-content` paths, theme name,
page builder such as Elementor, plugins visible in asset paths), PHP or
server hints from headers, caching plugin, total transfer and requests of
the home page, Lighthouse mobile and desktop scores with the core metrics,
console errors and failed requests (this explains the empty white boxes on
home, contact and about), mixed content, HTTP to HTTPS redirect, `www`
handling.

#### 4.4 Content extraction

For every page in 4.2, save the visible text as Markdown under
`content/reference/inspection/sefiddental/pages/<slug>.md` with the H1 and
headings preserved. Collect every fact: clinic name variants, addresses,
phones, hours, insurers, prices, doctor names and specialties, device or
brand names, statistics, promises (for example "free consultation"), awards.
Put the facts table in the report.

#### 4.5 Media inventory

Table of all images and videos: URL, size, dimensions, where used, alt
text, and a judgment: real clinic photo, stock, or AI-looking (say why).
Download the logo files, the clinic video and the three patient testimonial
videos if they are directly reachable, into
`content/reference/inspection/sefiddental/media/` (skip files over 40 MB
and list their URLs instead).

#### 4.6 Booking and contact flow

What «رزرو نوبت» does on desktop and phone (link, modal, form, third-party
embed), the form fields and their validation, where the form posts (network
request target), what the user sees after submit, the empty boxes on home,
contact and about (which embed, which error), the map embed and its
provider, phone links (`tel:` present or not), WhatsApp and Telegram links
with the exact numbers, Instagram handle and follower count, any other
social link (there is an unidentified round icon with a check mark in the
footer: identify it).

#### 4.7 SEO baseline

Title and description per page (from 4.2), duplicate titles, structured
data found, Open Graph, hreflang, sitemap validity, robots rules, internal
link count per page, broken links, redirect chains, indexed pages
(`site:sefiddental.ir` in Google: count and list), the Google results for
«سفید دنتال», «کلینیک دندانپزشکی سفید», «دندانپزشکی خانی آباد نو»,
«دندانپزشکی جنوب تهران» with the top 10 URLs each, and whether a Google
Business Profile or Maps listing appears for the clinic (name, rating,
review count, address and phone as shown).

#### 4.8 Competitors from the search results

For the top three clinic websites that appear for the local queries above
(not directories): URL, stack, booking method, whether prices are shown,
whether dentists are named with council numbers, Lighthouse mobile
performance score, and one sentence on their strongest point.

#### 4.9 Screenshots

Every page at 390, 820 and 1440 (full page) under
`content/reference/inspection/sefiddental/screens/`, plus the phone menu
open, the booking form open, and the console error panel.

### 5. Files produced

A list of every file saved, with paths and sizes.

### 6. Open questions

Anything that could not be measured or that needs the client, as a short
list.
