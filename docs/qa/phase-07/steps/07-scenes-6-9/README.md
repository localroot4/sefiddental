# Home performance (phase-07/steps/07-scenes-6-9)

Measured 2026-10-27T05:55:23.337Z on commit 01e24d4 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 12.09 / 9.06 / 5.81 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3700 node scripts/measure-home.mjs docs/qa/phase-07/steps/07-scenes-6-9 --only=frames --tiers=1,2
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 49 | 36 | 33.4 | 150 | 97 | 10 (0) | 89 | 3.8 / 5 / 4.2 | 12.7 | yes |
| default | 1 | 6x | 55 | 43 | 33.3 | 66.7 | 63 | 2 (0) | 70 | 3.8 / 4.9 / 4.2 | 11.3 | yes |
| default | 2 | 4x | 60 | 57 | 16.8 | 33.4 | 8 | 0 (0) | 0 | 3.8 / 4.3 / 4.2 | 10.1 | yes |
| default | 2 | 6x | 50 | 38 | 33.4 | 83.2 | 89 | 5 (0) | 76 | 3.8 / 5 / 4.2 | 12 | yes |
| swiftshader | 1 | 4x | 15.7 | 8.6 | 100.1 | 216.8 | 293 | 4 (0) | 63 | 3.8 / 4.8 / 4.1 | 18.7 | yes |
| swiftshader | 1 | 6x | 19.4 | 14.5 | 83.3 | 116.7 | 300 | 11 (1) | 106 | 3.8 / 4.9 / 4.1 | 16.3 | yes |
| swiftshader | 2 | 4x | 16.5 | 8.9 | 100 | 150 | 295 | 5 (0) | 95 | 3.8 / 4.8 / 4.1 | 18.1 | yes |
| swiftshader | 2 | 6x | 17.4 | 12.4 | 99.9 | 133.3 | 296 | 16 (0) | 93 | 3.8 / 4.9 / 4.1 | 16.8 | yes |

### Per section (mean fps / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line; `none` is the header strip at the top, gaps and the footer.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | 46 / 50 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 31.6 / 50 / 0 | 30 / 50 / 0 | 24.8 / 99.9 / 0 | 27 / 66.6 / 0 |
| trust | 54.6 / 33.3 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 18.5 / 83.4 / 0 | 25 / 50.1 / 0 | 17.1 / 100 / 0 | 18.7 / 83.4 / 0 |
| services | 50.7 / 33.4 / 1, 53 | 54.2 / 33.3 / 0 | 59.1 / 16.8 / 0 | 55.8 / 33.3 / 0 | 19.1 / 100 / 0 | 20 / 83.4 / 1, 51 | 18.2 / 116.6 / 1, 76 | 18.7 / 100 / 2, 60 |
| restoration | 40 / 66.6 / 1, 59 | 40.5 / 50 / 2, 70 | 54.9 / 33.3 / 0 | 38.4 / 66.6 / 2, 76 | 13.4 / 149.9 / 1, 59 | 16.6 / 116.6 / 2, 55 | 15.9 / 133.4 / 0 | 15.5 / 116.6 / 2, 58 |
| compare | 52.7 / 33.3 / 0 | 58 / 16.8 / 0 | 60 / 16.7 / 0 | 55.8 / 33.3 / 1, 56 | 19.2 / 100 / 0 | 19.1 / 83.4 / 2, 58 | 22.4 / 66.7 / 1, 50 | 22.6 / 66.8 / 1, 54 |
| dentists | 56.3 / 33.3 / 0 | 59.2 / 16.8 / 0 | 60 / 16.8 / 0 | 58.5 / 16.8 / 0 | 19.4 / 66.7 / 0 | 26.1 / 50.1 / 1, 53 | 18.8 / 66.7 / 0 | 23 / 66.6 / 0 |
| voices | 48.7 / 33.4 / 2, 62 | 54.1 / 33.3 / 0 | 59.2 / 16.8 / 0 | 48 / 33.4 / 1, 60 | 14.5 / 100 / 2, 56 | 21.9 / 83.3 / 2, 64 | 16.4 / 100 / 1, 55 | 18 / 83.4 / 5, 84 |
| journey | 43.5 / 50 / 0 | 52.7 / 33.4 / 0 | 60 / 16.7 / 0 | 48.2 / 33.4 / 0 | 11.7 / 116.7 / 0 | 18 / 66.8 / 1, 61 | 12.3 / 116.7 / 0 | 13.6 / 83.4 / 1, 62 |
| faq | 41.9 / 50 / 3, 79 | 47 / 33.4 / 0 | 59.1 / 16.8 / 0 | 45.7 / 33.4 / 0 | 13.5 / 116.6 / 1, 53 | 18.4 / 83.4 / 2, 64 | 14 / 100 / 1, 69 | 14.7 / 100 / 2, 57 |
| booking | 46.2 / 33.5 / 2, 65 | 47 / 33.4 / 0 | 60 / 16.7 / 0 | 46.5 / 33.4 / 0 | 14.1 / 133.3 / 0 | 17.5 / 83.4 / 2, 62 | 12.4 / 150 / 1, 56 | 14.5 / 116.6 / 2, 56 |
| none | 56.8 / 33.3 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 33.1 / 66.7 / 0 | 36.8 / 66.7 / 0 | 34.4 / 66.7 / 0 | 38.4 / 50.1 / 0 |


## Contrast over the warm layer at its warmest state (scene 9, `--warm` 1)

`design/tools/contrast.py` formulas (sRGB source-over, 8 bit) on `design/tokens.css`: the text tokens over `--color-surface` with `--color-warm` at 12 % composited on it, both themes. Run 2026-10-27 with `python3 -I`. 13 % and 14 % also keep every text pair; 15 % fails the brand link in light (4.4996). `--color-line-strong` is under 3:1 in light; over the transparent journey section it paints only the guide link's underline (a text decoration); every section after the journey paints its own opaque surface.

| Pair over surface + warm at 12 % | Role | Minimum | Light | Dark |
|---|---|---|---|---|
| --color-ink | body text | 4.5 | 13.76 pass (on #F5EFE8) | 12.44 pass (on #222C34) |
| --color-ink-muted | secondary text | 4.5 | 6.02 pass (on #F5EFE8) | 7.01 pass (on #222C34) |
| --color-brand | links and brand text | 4.5 | 4.57 pass (on #F5EFE8) | 5.61 pass (on #222C34) |
| --color-brand-strong | small brand text | 4.5 | 6.08 pass (on #F5EFE8) | 7.66 pass (on #222C34) |
| --color-ink-faint | non-text: placeholder glyphs and dividers | 3.0 | 3.09 pass (on #F5EFE8) | 4.26 pass (on #222C34) |
| --color-line-strong | borders and icons (non-text) | 3.0 | 2.88 FAIL (on #F5EFE8) | 3.12 pass (on #222C34) |
