# ThreeUI Review (github.com/MengTo/threeui)

Reviewed from a shallow clone on 2026-10-12 (commit `68802d5`, package
`@designcodeio/threeui` 1.2.0, MIT). The client suggested it as a help for
the WebGL experience.

## 1. What it is

An open-source catalog by Meng To (DesignCode) of 50 "Community" components:
Three.js hero backgrounds, shader buttons and CTAs, text animations,
loaders, small scenes (bookshelf, temple, landscape, globe) and a few
complete landing-page templates (Kage, Sylva Living World, Meng To
Sketchbook, Bestsellers Book Showcase). React wrappers around vanilla
three.js, published to npm, with a browse site, variants and controls, an
FPS meter in previews, and an MCP server (Pro members only) so coding
agents can pull components. Pro and Beta components are not in the
repository.

## 2. How it is built (facts from the source)

| Aspect | Finding | Consequence for us |
|---|---|---|
| Rendering model | Vanilla three.js inside React components; no React Three Fiber; two pinned three versions (`three128`, `three165`) aliased side by side, plus `three` as a peer | Mixing with our R3F scene graph means two renderers and duplicated three.js bundles. Not importable as-is. |
| Delivery of many components | 12 of the 50 ship as full HTML documents imported with `?raw` and rendered in an `<iframe>` with a `postMessage` bridge (liquid metal button, brand orbs, character carousel, elements, neuform, semantic bloom, sylva, text path studies, uplink loader, woven cloth) | An iframe cannot join our scroll timeline, shares no theme tokens, costs a separate document per instance, and hides text from SEO and assistive tech. Never embed these; port the idea. |
| External dependencies in scenes | HTML scenes load from cdnjs, Tailwind CDN, Google Fonts, Iconify, Supabase storage and threeui.com media (hundreds of references) | Blocked or slow in Iran. Anything we take must be rewritten self-hosted. |
| Asset pipeline | No glTF, Draco or KTX2 usage; textures are inline base64 or PNG; `three.min.js` copied into templates | No reusable asset pipeline; ours comes from phase 3. |
| Scroll | Landing templates use `addEventListener('scroll')` and `scrollY`; GSAP appears in one native component; no Lenis, no ScrollTrigger in native code | Their scroll approach is the pattern we ban. Inspiration only. |
| Runtime hygiene | Many files handle `prefers-reduced-motion` (52), `IntersectionObserver` (39), `visibilitychange` (37), `ResizeObserver` (46), `dispose()` (35), DPR capping (72) | Good small patterns worth copying into our scene components. |
| Quality tiers | None: no device memory, GPU benchmark or adaptive DPR; only the preview FPS meter (55 good, 45 watch) | Our tier system is ours to build. |
| Aesthetic | Dark tech: neon, orbs, halftone, CRT, liquid metal, particle fields, glass CTAs | Mostly the opposite of a calm, warm clinic. Pick materials and motion ideas, not looks. |
| License | MIT for code and ThreeUI imagery; OFL fonts; Three.js MIT | Reuse and modification are fine with attribution kept in `THIRD_PARTY_NOTICES`. |

## 3. What we take

Port as R3F or GLSL inside our own scene graph, re-colored to brand tokens,
tiered, self-hosted:

| ThreeUI piece | Where it serves the clinic | Tier |
|---|---|---|
| Condensation and liquid-form shader ideas | The glass-like material of the teal mark; the "enamel" sheen on the molar (scene 1 and 4) | 2-3 |
| Constellation and particle drift fields | The diamond particles of the intro and scene transitions, at low counts | 1-3 |
| Dot matrix and ribbon field | Subtle backdrop behind the services scene, low contrast | 2-3 |
| Uplink loader | Reference for the loading bar behavior (progress bound to real loading) | all |
| Text animation collection and text path studies | Journey labels and section headings on desktop, DOM-based | 1-3 |
| Before/after style displacement ideas from the gallery component | The compare wipe in scene 6 | 2-3 |
| Preview FPS meter | Our developer overlay and the live frame monitor thresholds | all |
| Lumen and glassmorphism CTA treatments | At most one: the booking stage glow in scene 10, warm not neon | 2-3 |

Rules: no iframe components; no CDN loads; no liquid-metal or neon
buttons on CTAs (a dental patient needs calm, legible buttons); nothing
that looks like a tech startup.

## 4. What we do not take

- The landing-page templates as a base: scroll listeners, inline
  `three.min.js`, no tiers, no RTL, no SEO structure.
- The MCP server: Pro only and OAuth-gated; the Community source is in the
  repository and in npm when a reference is needed.
- Fonts: Latin only.

## 5. Decision

ThreeUI is an idea bank and a source of small, well-written runtime
patterns, not a dependency. Phase 2 reads the listed components when
prototyping materials and particles; phase 8 ports what the storyboard
needs into our R3F scenes. `docs/experience-direction.md` section 6 and the
phase 2 and 8 prompts reference this file.
