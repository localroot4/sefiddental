# Phase 02 - Brand, Design System and Experience Storyboard

Date: 2026-10-12. Versions used: recorded in section "Delivered".

## Plan (written before building)

Order:

1. Foundations: download and subset Vazirmatn and Estedad (Persian plus
   Latin), write `design/tokens.css` for both themes, compute every
   text-on-surface contrast pair with a script and adjust failing values.
2. Vendor three.js and GSAP minified builds into `design/vendor/` so every
   prototype runs from a plain file without a CDN (banned) and without the
   application that does not exist yet.
3. Brand: copy the traced SVGs, build the favicon set and the OG template,
   export the mark and the diamond as glTF (Draco) and model a stylized
   molar; turntable preview page.
4. Styleguide: one self-contained RTL page, both themes, every component
   with every state, checked at 320, 390, 820 and 1440 px.
5. Storyboard: eleven scenes with wireframe frames, scroll ranges, the
   three states, phone and tier 0 variants, asset lists and cost estimates.
6. Prototypes 0 and a-f, each answering one written question, each measured
   (duration, CLS, fps at 4x and 6x CPU throttle, SwiftShader).
7. Hero directions A and B at three widths and two themes.
8. One batched inspection of all screenshots, one batch of fixes, one
   confirmation, stop. Independent review of the design system and the
   prototypes by a separate agent.
9. Report, gaps, commit, push.

Risks: fonts or three.js downloads blocked by the network (fallback: ask
the client for the files); software GPU in this environment makes fps
numbers conservative (report them as lower bounds); the molar is stylized,
not anatomical, until a licensed model is sourced.
