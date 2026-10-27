# Home performance (phase-07/steps/03-hero-trust)

Measured 2026-10-27T11:08:41.365Z on commit 7936d17 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 0.94 / 4.19 / 5.28 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/steps/03-hero-trust --only=frames --tiers=1,2
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 59 | 54 | 16.8 | 33.4 | 14 | 0 (0) | 0 | 3.7 / 4.7 / 4 | 11 | yes |
| default | 1 | 6x | 54 | 43 | 33.4 | 66.6 | 77 | 2 (0) | 55 | 3.7 / 4.3 / 4 | 12.2 | yes |
| default | 2 | 4x | 59 | 48 | 33.2 | 33.5 | 33 | 0 (0) | 0 | 3.7 / 4.7 / 4 | 11.3 | yes |
| default | 2 | 6x | 53.1 | 36 | 33.4 | 83.2 | 101 | 4 (0) | 61 | 3.7 / 4.3 / 4 | 12.6 | yes |
| swiftshader | 1 | 4x | 21.3 | 14 | 66.7 | 133.4 | 329 | 1 (0) | 54 | 3.7 / 4.3 / 4 | 16 | yes |
| swiftshader | 1 | 6x | 23 | 15 | 83.3 | 133.3 | 333 | 8 (0) | 69 | 3.7 / 4.4 / 4 | 16 | yes |
| swiftshader | 2 | 4x | 26 | 16.7 | 66.7 | 116.6 | 332 | 1 (0) | 56 | 3.7 / 4.4 / 4 | 15.1 | yes |
| swiftshader | 2 | 6x | 24.2 | 17 | 66.7 | 133.3 | 332 | 9 (0) | 75 | 3.7 / 4.5 / 4 | 15.6 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | - / - / 33.3 / 16.7 / 0 | - / - / 33.4 / 33.4 / 0 | - / - / 33.4 / 16.8 / 0 | - / - / 33.4 / 33.3 / 0 | 21 / 21 / 66.7 / 66.7 / 0 | 20.3 / 20.3 / 83.3 / 66.7 / 0 | 21.3 / 21.3 / 83.3 / 66.7 / 0 | 20.7 / 20.7 / 66.7 / 66.7 / 0 |
| trust | - / - / 16.8 / 16.7 / 0 | - / - / 50 / 33.4 / 0 | - / - / 33.3 / 16.8 / 0 | - / - / 66.6 / 33.4 / 0 | - / - / 66.7 / 66.7 / 0 | - / - / 100.1 / 100.1 / 0 | - / - / 66.7 / 66.7 / 0 | - / - / 66.7 / 66.7 / 0 |
| services | 58 / 58 / 33.4 / 33.2 / 0 | 53 / 53 / 50 / 33.4 / 0 | 58 / 58 / 33.4 / 33.3 / 0 | 43.3 / 43.3 / 50.1 / 33.4 / 1, 53 | 20.6 / 20.6 / 83.4 / 83.4 / 0 | 20.6 / 20.6 / 100 / 83.4 / 1, 53 | 22 / 22 / 83.3 / 66.7 / 0 | 21 / 20.3 / 100 / 83.3 / 2, 61 |
| restoration | - / - / 33.4 / 33.3 / 0 | - / - / 66.6 / 50 / 1, 54 | - / - / 33.4 / 33.3 / 0 | - / - / 66.6 / 66.5 / 1, 53 | - / - / 133.4 / 133.4 / 0 | 15.7 / 15.7 / 100.1 / 100.1 / 0 | - / - / 83.4 / 83.4 / 0 | - / - / 83.4 / 83.4 / 0 |
| compare | 60 / 60 / 16.8 / 16.8 / 0 | 54 / 54 / 33.4 / 33.3 / 0 | 59 / 59 / 33.3 / 16.7 / 0 | 58 / 58 / 50 / 16.8 / 0 | 22.6 / 22.6 / 66.7 / 66.7 / 0 | 24.6 / 24.6 / 66.7 / 50.1 / 0 | 24 / 24 / 66.7 / 50.1 / 0 | 25.2 / 25.2 / 100 / 50.1 / 1, 68 |
| dentists | 60 / 60 / 16.8 / 16.8 / 0 | 59 / 59 / 33.4 / 16.8 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 58 / 58 / 33.3 / 16.8 / 0 | 25 / 25 / 66.6 / 50.1 / 0 | 25.6 / 25.6 / 50.1 / 50.1 / 0 | 27 / 27 / 50.1 / 50 / 0 | 30 / 30 / 50.1 / 50 / 0 |
| voices | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 25.6 / 25.6 / 50.1 / 50.1 / 0 | 25 / 25 / 50.1 / 50.1 / 0 | 28.5 / 28.5 / 50.1 / 50 / 0 | 29.5 / 29.5 / 50.1 / 50 / 0 |
| journey | - / - / 16.8 / 16.8 / 0 | - / - / 33.4 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 33.4 / 16.8 / 0 | 25 / 25 / 66.6 / 50.1 / 0 | 25 / 25 / 66.6 / 50 / 0 | 28.5 / 28.5 / 50.1 / 50.1 / 0 | 28.5 / 28.5 / 50.1 / 50 / 0 |
| faq | - / - / 33.4 / 33.3 / 0 | 46.2 / 46.2 / 33.4 / 33.4 / 0 | 54 / 54 / 33.4 / 33.4 / 0 | 40 / 40 / 50.1 / 50 / 1, 53 | 23.2 / 23.2 / 116.7 / 83.3 / 0 | 23.6 / 23.6 / 116.6 / 83.3 / 2, 69 | 25.2 / 25.2 / 100 / 83.3 / 0 | 24 / 24 / 100 / 83.3 / 3, 61 |
| booking | 58 / 58 / 33.3 / 16.8 / 0 | 45.2 / 45.2 / 50 / 33.4 / 0 | 49.2 / 49.2 / 33.5 / 33.3 / 0 | 40 / 40 / 50 / 49.9 / 0 | 17.7 / 15.7 / 133.2 / 100 / 0 | 19.5 / 19 / 116.7 / 100 / 4, 64 | 19.3 / 18.7 / 100 / 99.9 / 0 | 20.3 / 18.4 / 116.6 / 99.9 / 3, 63 |
| none | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | 43 / 43 / 50 / 49.9 / 0 | - / - / 50 / 33.4 / 0 | - / - / 49.9 / 33.4 / 0 | - / - / 50 / 33.4 / 0 |

