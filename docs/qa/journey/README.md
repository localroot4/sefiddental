# Journey evidence

The home journey (`docs/experience/journey.md`) at every dock of the courier (`NN-dock-<id>`)
and half way through every travel (`NN-travel-<from>-<to>`), at 1440x900 and 1024x768
(tier 2, the WebGL courier) and 390x844 (tier 1, the DOM courier), light and dark, on the client
preview build (DEMO_CONTENT, e2e database). JPEG, at most 1000 px wide. Shot with
`node docs/qa/journey/capture.mjs <origin>` in Chromium with SwiftShader (no GPU), 2026-11-06.

Docks per width: 1440 and 1024 show all eight; 390 shows services, restoration, smile and
footer (the other boxes exist from 1024 px only). At the footer dock the courier is hidden: the
playground's own mark part has taken over.

Measured on the same build (SwiftShader, not a real GPU; production treats a software renderer
as tier 0, so no visitor gets these numbers):

| Case | Frames while scrolling | Courier downloads |
|---|---|---|
| Tier 2, 1440x900 | 14 to 30 fps | mark.glb 8.8 KB, molar.glb 65.8 KB, Draco worker 13.8 KB and wasm 63.8 KB (152 KB) |
| Tier 3, 1440x900 | 16 to 28 fps | the same files |
| Tier 1, 390x844 (DOM courier) | 58 to 62 fps | none (no three.js) |

Known: in travel the courier passes under text, which stays on top but loses contrast while the
courier is behind it (for example `06-travel-dentists-booking`, and the workflow heading at
1024 px). At the services dock the courier mark sits beside the services SVG mark, whose icon
morph the spec keeps.
