# Home performance (phase-07/steps/01-qa)

Measured 2026-10-27T04:21:45.510Z on commit 01e24d4 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 9.66 / 12.44 / 10.1 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3900 node scripts/measure-home.mjs docs/qa/phase-07/steps/01-qa --only=frames --tiers=1,2
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 57 | 49 | 33.3 | 83.3 | 41 | 3 (0) | 79 | 3.6 / 4.7 / 3.9 | 11.4 | yes |
| default | 1 | 6x | 58.5 | 50 | 16.8 | 50 | 28 | 0 (0) | 0 | 3.6 / 4.7 / 3.8 | 10.5 | yes |
| default | 2 | 4x | 60 | 59 | 16.8 | 33.4 | 2 | 0 (0) | 0 | 3.6 / 4.6 / 3.8 | 9.7 | yes |
| default | 2 | 6x | 59 | 50.2 | 16.8 | 50 | 23 | 0 (0) | 0 | 3.6 / 4.7 / 3.8 | 10.5 | yes |
| swiftshader | 1 | 4x | 22 | 14 | 66.7 | 166.7 | 305 | 2 (0) | 57 | 3.6 / 4.5 / 3.8 | 15.9 | yes |
| swiftshader | 1 | 6x | 29 | 18 | 66.6 | 100.1 | 306 | 3 (0) | 62 | 3.6 / 4.6 / 3.8 | 13.7 | yes |
| swiftshader | 2 | 4x | 21 | 7.8 | 100.1 | 216.7 | 306 | 5 (1) | 101 | 3.6 / 4.4 / 3.8 | 17.2 | yes |
| swiftshader | 2 | 6x | 13.9 | 6.9 | 133.4 | 250 | 282 | 18 (1) | 102 | 3.6 / 4.4 / 3.8 | 21.9 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | - / - / 33.3 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 33.3 / 16.8 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 66.8 / 33.4 / 0 | - / - / 50 / 49.9 / 0 | - / - / 83.3 / 83.3 / 0 | - / - / 83.4 / 83.4 / 0 |
| trust | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 16.7 / 16.7 / 0 | - / - / 16.7 / 16.7 / 0 | - / - / 33.4 / 33.4 / 0 | - / - / 50 / 50 / 0 | - / - / 66.7 / 66.7 / 0 | - / - / 83.4 / 83.4 / 0 |
| services | 54 / 54 / 33.4 / 33.3 / 1, 58 | 56 / 56 / 50 / 33.3 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 57 / 57 / 33.5 / 16.8 / 0 | 23.6 / 23.6 / 116.7 / 116.7 / 0 | 27.5 / 27.5 / 100.1 / 66.7 / 0 | 18.5 / 16.7 / 116.7 / 116.6 / 1, 57 | 12.2 / 9.8 / 250 / 166.7 / 4, 81 |
| restoration | - / - / 50 / 33.5 / 1, 52 | - / - / 33.4 / 33.3 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 33.4 / 33.4 / 0 | - / - / 150 / 133.3 / 0 | - / - / 83.3 / 66.7 / 0 | - / - / 100 / 83.4 / 0 | 10.5 / 10.5 / 183.3 / 183.3 / 2, 74 |
| compare | 52 / 52 / 66.6 / 33.4 / 1, 71 | 60 / 60 / 16.8 / 16.8 / 0 | 59 / 59 / 16.8 / 16.8 / 0 | 59 / 59 / 33.3 / 16.8 / 0 | 20 / 20 / 83.4 / 83.3 / 0 | 31 / 31 / 66.7 / 50 / 0 | 21.1 / 20.7 / 116.7 / 66.7 / 0 | 15 / 11.8 / 133.4 / 133.3 / 1, 70 |
| dentists | 59 / 59 / 33.3 / 16.8 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 24.6 / 24.6 / 66.7 / 50.1 / 0 | 33 / 33 / 50.1 / 50 / 0 | 22.7 / 22.6 / 83.3 / 66.7 / 0 | 13.3 / 11.6 / 150 / 133.3 / 3, 65 |
| voices | 59 / 59 / 33.4 / 16.7 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 23.6 / 23.6 / 66.7 / 50.1 / 0 | 31.5 / 31.5 / 50.1 / 49.9 / 0 | 23.2 / 22.3 / 66.7 / 66.6 / 0 | 18.5 / 14.5 / 116.7 / 100 / 0 |
| journey | - / - / 33.4 / 16.8 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.8 / 0 | 22 / 22 / 83.3 / 66.8 / 0 | 30.5 / 30.5 / 50.1 / 50 / 0 | 22.6 / 22.6 / 66.7 / 66.7 / 0 | 18.7 / 18.7 / 100 / 99.9 / 1, 54 |
| faq | - / - / 33.4 / 16.7 / 0 | - / - / 33.4 / 33.3 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 33.4 / 33.4 / 0 | 22 / 22 / 166.7 / 100 / 0 | 28.1 / 28.1 / 83.3 / 66.7 / 0 | 17.7 / 17.7 / 183.3 / 116.6 / 1, 54 | 13.6 / 8.8 / 233.3 / 200.1 / 3, 79 |
| booking | 54 / 54 / 49.9 / 33.3 / 0 | 51 / 51 / 33.4 / 33.3 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 52 / 52 / 33.4 / 33.3 / 0 | 17.6 / 17.1 / 133.3 / 100.1 / 1, 55 | 20.7 / 19.7 / 83.4 / 83.3 / 0 | 12.2 / 7.7 / 216.7 / 166.6 / 2, 65 | 11.2 / 7.6 / 200 / 150 / 4, 68 |
| none | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 50.1 / 50 / 0 | - / - / 50 / 33.4 / 0 | 32 / 32 / 66.6 / 50.1 / 0 | - / - / 66.7 / 50 / 0 |

