# Home performance (phase-07/steps/08-booking-footer)

Measured 2026-10-27T07:51:41.920Z on commit 01e24d4 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 4.49 / 3.5 / 1.74 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3800 node scripts/measure-home.mjs docs/qa/phase-07/steps/08-booking-footer --only=frames --tiers=1,2
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 60 | 40 | 16.8 | 216.7 | 22 | 2 (2) | 106 | 3.8 / 4.6 / 4.3 | 11.5 | yes |
| default | 1 | 6x | 57 | 28.5 | 33.3 | 349.9 | 55 | 3 (2) | 216 | 3.8 / 4.5 / 4.3 | 12.3 | yes |
| default | 2 | 4x | 56.5 | 39 | 33.3 | 216.6 | 55 | 2 (1) | 113 | 3.8 / 4.6 / 4.3 | 12.2 | yes |
| default | 2 | 6x | 50.5 | 15 | 50 | 416.7 | 115 | 16 (2) | 285 | 3.8 / 4.4 / 4.3 | 14.4 | yes |
| swiftshader | 1 | 4x | 19.4 | 12.8 | 99.9 | 166.7 | 356 | 6 (0) | 98 | 3.8 / 4.7 / 4.2 | 19.4 | yes |
| swiftshader | 1 | 6x | 16 | 8 | 116.6 | 250.1 | 314 | 16 (1) | 175 | 3.7 / 4.6 / 4.2 | 19.8 | yes |
| swiftshader | 2 | 4x | 16.2 | 8.2 | 150 | 300 | 317 | 17 (4) | 186 | 3.7 / 4.6 / 4.2 | 22.4 | yes |
| swiftshader | 2 | 6x | 16 | 7.2 | 116.7 | 333.3 | 337 | 21 (2) | 185 | 3.8 / 4.7 / 4.2 | 21.4 | yes |

### Per section (mean fps / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line; `none` is the header strip at the top, gaps and the footer.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | 60 / 16.8 / 0 | 58.6 / 16.8 / 0 | 58.1 / 16.8 / 0 | 55 / 16.8 / 1, 51 | 27.8 / 50.1 / 0 | 26.5 / 66.6 / 0 | 17.6 / 166.7 / 0 | 26 / 66.7 / 0 |
| trust | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 52.5 / 33.4 / 0 | 20 / 83.4 / 0 | 24 / 50.1 / 0 | 18 / 66.7 / 0 | 18.9 / 66.7 / 0 |
| services | 58.4 / 16.8 / 0 | 53.8 / 33.4 / 0 | 50.5 / 33.3 / 0 | 45.8 / 49.9 / 1, 62 | 16.2 / 116.7 / 0 | 16.3 / 116.6 / 3, 66 | 16.5 / 133.3 / 1, 73 | 13.8 / 133.3 / 5, 76 |
| restoration | 56.6 / 33.3 / 0 | 44.3 / 33.4 / 0 | 51.2 / 33.4 / 0 | 30.6 / 66.6 / 4, 72 | 16.3 / 149.9 / 0 | 14.7 / 149.9 / 2, 84 | 14 / 183.2 / 0 | 17.5 / 100 / 2, 52 |
| compare | 60 / 16.7 / 0 | 58.2 / 16.8 / 0 | 57.5 / 16.8 / 0 | 53.2 / 33.3 / 0 | 19.7 / 83.4 / 0 | 16.9 / 100 / 0 | 16.6 / 83.4 / 1, 50 | 18 / 83.3 / 1, 54 |
| dentists | 60 / 16.8 / 0 | 59.2 / 16.8 / 0 | 59.3 / 16.8 / 0 | 53.8 / 33.4 / 0 | 22 / 83.4 / 0 | 21 / 83.3 / 0 | 15.6 / 100 / 0 | 18.9 / 66.7 / 2, 61 |
| voices | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 58.3 / 16.8 / 0 | 57.6 / 16.8 / 0 | 22.6 / 66.7 / 0 | 19.3 / 83.3 / 0 | 20.7 / 83.3 / 0 | 20.9 / 66.7 / 0 |
| journey | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 56.8 / 33.3 / 0 | 23.3 / 66.7 / 0 | 17.8 / 83.3 / 0 | 17.7 / 66.7 / 1, 51 | 21.6 / 66.7 / 0 |
| faq | 43.7 / 33.4 / 2, 106 | 32 / 50 / 3, 216 | 38.2 / 50 / 2, 113 | 27.3 / 50.1 / 4, 285 | 14.6 / 116.7 / 2, 98 | 12.2 / 183.4 / 6, 175 | 13.6 / 150 / 4, 108 | 12.8 / 216.7 / 8, 185 |
| booking | 54.1 / 33.3 / 0 | 46.4 / 33.4 / 0 | 48.1 / 33.3 / 0 | 34.6 / 50.1 / 5, 71 | 18.8 / 83.3 / 0 | 15.2 / 116.6 / 4, 68 | 9.9 / 216.6 / 2, 85 | 11.5 / 133.3 / 5, 71 |
| none | 60 / 16.8 / 0 | 59 / 16.8 / 0 | 57.1 / 16.8 / 0 | 53.8 / 33.3 / 0 | 30.2 / 83.3 / 0 | 23.2 / 83.3 / 1, 57 | 19.7 / 116.7 / 0 | 24.8 / 83.4 / 1, 55 |

