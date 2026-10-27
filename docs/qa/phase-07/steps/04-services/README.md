# Home performance (phase-07/steps/04-services)

Measured 2026-10-27T11:35:32.630Z on commit 4f9e7ad with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 0.97 / 2.06 / 2.88 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/steps/04-services --only=frames --tiers=1,2
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 60 | 47 | 16.8 | 49.9 | 18 | 0 (0) | 0 | 3.8 / 4.4 / 4.2 | 11.2 | yes |
| default | 1 | 6x | 56 | 36 | 33.3 | 66.7 | 61 | 1 (0) | 53 | 3.8 / 5 / 4.2 | 11.6 | yes |
| default | 2 | 4x | 59 | 56 | 16.8 | 50 | 15 | 0 (0) | 0 | 4 / 5.6 / 4.7 | 13.5 | yes |
| default | 2 | 6x | 55 | 46 | 33.3 | 50 | 78 | 0 (0) | 0 | 4 / 5.4 / 4.7 | 14.8 | yes |
| swiftshader | 1 | 4x | 26.3 | 22.6 | 50.1 | 150 | 337 | 1 (0) | 54 | 3.8 / 4.8 / 4.2 | 14.8 | yes |
| swiftshader | 1 | 6x | 25.3 | 19 | 66.7 | 116.7 | 345 | 5 (0) | 68 | 3.8 / 4.8 / 4.2 | 15.2 | yes |
| swiftshader | 2 | 4x | 22.4 | 9.7 | 83.4 | 166.6 | 402 | 2 (0) | 51 | 4.1 / 5.4 / 4.7 | 20 | yes |
| swiftshader | 2 | 6x | 21.8 | 10.3 | 83.4 | 133.3 | 407 | 10 (0) | 72 | 4.1 / 5.2 / 4.7 | 20.9 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | - / - / 16.8 / 16.7 / 0 | - / - / 33.3 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.8 / 0 | 24 / 24 / 66.7 / 66.7 / 0 | 22.3 / 22.3 / 66.7 / 66.7 / 0 | 21.3 / 21.3 / 100 / 66.7 / 0 | 21.3 / 21.3 / 100 / 66.7 / 0 |
| trust | - / - / 33.4 / 33.3 / 0 | - / - / 66.7 / 50 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 66.7 / 66.7 / 1, 54 | - / - / 99.9 / 99.9 / 1, 50 | - / - / 66.7 / 66.7 / 0 | - / - / 83.3 / 83.3 / 0 |
| services | 50 / 50 / 49.9 / 33.3 / 0 | 39 / 39 / 50.1 / 50 / 1, 53 | 58 / 56 / 50 / 16.8 / 0 | 49.5 / 46 / 50 / 33.4 / 0 | 22.6 / 20.7 / 100 / 66.7 / 0 | 21.3 / 20 / 83.4 / 83.3 / 1, 59 | 14.5 / 9.9 / 166.6 / 116.6 / 0 | 13.7 / 10.3 / 133.2 / 100.1 / 5, 72 |
| restoration | - / - / 33.4 / 16.8 / 0 | - / - / 50.1 / 50 / 0 | - / - / 33.4 / 16.8 / 0 | - / - / 49.9 / 33.4 / 0 | - / - / 83.4 / 66.8 / 0 | - / - / 99.9 / 83.3 / 1, 64 | - / - / 100.1 / 100.1 / 1, 51 | - / - / 83.4 / 83.4 / 1, 50 |
| compare | 60 / 60 / 16.8 / 16.8 / 0 | 59 / 59 / 33.3 / 16.8 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 58 / 58 / 33.3 / 16.8 / 0 | 25 / 25 / 133.3 / 66.6 / 0 | 25.6 / 25.6 / 66.7 / 50.1 / 0 | 26.6 / 26.6 / 66.7 / 50.1 / 0 | 25.6 / 25.6 / 83.2 / 50.1 / 0 |
| dentists | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 29 / 29 / 66.8 / 50 / 0 | 28 / 28 / 50.1 / 50 / 0 | 27 / 25.6 / 66.7 / 50.1 / 0 | 23.3 / 23 / 116.6 / 50.1 / 0 |
| voices | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.7 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 28.5 / 28.5 / 50.1 / 50 / 0 | 30 / 30 / 50.1 / 50 / 0 | 30 / 28.5 / 50.1 / 50 / 0 | 26.6 / 26.6 / 50.1 / 50 / 0 |
| journey | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.7 / 0 | 31 / 31 / 50 / 50 / 0 | 29 / 29 / 50.1 / 50 / 0 | 27 / 27 / 50.1 / 50 / 0 | 27.5 / 27.5 / 50.1 / 50.1 / 0 |
| faq | - / - / 33.4 / 16.8 / 0 | - / - / 33.4 / 33.3 / 0 | - / - / 16.8 / 16.8 / 0 | 40.3 / 40.3 / 33.4 / 33.4 / 0 | 28.1 / 28.1 / 50.1 / 50.1 / 0 | 24.6 / 24.6 / 83.4 / 66.7 / 0 | 25.2 / 25.2 / 66.7 / 50.1 / 0 | 22.3 / 22.3 / 83.4 / 66.7 / 1, 59 |
| booking | 59 / 59 / 33.3 / 16.8 / 0 | 45 / 45 / 50 / 33.4 / 0 | 56 / 56 / 33.3 / 16.8 / 0 | 48 / 48 / 33.4 / 33.4 / 0 | 25.3 / 25 / 66.7 / 66.6 / 0 | 25.3 / 23 / 66.8 / 66.7 / 1, 53 | 24 / 23.6 / 83.4 / 66.6 / 0 | 24.5 / 21.3 / 83.4 / 66.7 / 0 |
| none | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 16.8 / 16.8 / 0 | - / - / 16.8 / 16.7 / 0 | - / - / 50 / 33.4 / 0 | - / - / 50.1 / 33.5 / 0 | - / - / 50.1 / 50 / 0 | - / - / 50.1 / 50 / 0 |

