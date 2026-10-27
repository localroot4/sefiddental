# Home performance (phase-07/steps/03-hero-trust/sections)

Measured 2026-10-27T11:17:27.278Z on commit 4339393 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 0.95 / 2.89 / 4.22 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/steps/03-hero-trust/sections --only=frames --tiers=1,2 --sections=hero,trust --pace=16
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 16 px every 50 ms from the top to the bottom of the page (`--sections`: from one viewport above hero to the bottom of trust, a pin spacer included). Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 4x | 60 | 58 | 16.7 | 33.4 | 3 | 0 (0) | 0 | 3.7 / 4.2 / 4 | 8.8 | yes |
| default | 1 | 6x | 58 | 55 | 16.8 | 49.9 | 14 | 0 (0) | 0 | 3.7 / 4.2 / 4 | 9.4 | yes |
| default | 2 | 4x | 60 | 59 | 16.7 | 33.3 | 1 | 0 (0) | 0 | 3.7 / 4.2 / 4 | 8.7 | yes |
| default | 2 | 6x | 58 | 53.1 | 16.8 | 50 | 19 | 0 (0) | 0 | 3.7 / 4.2 / 4 | 9.4 | yes |
| swiftshader | 1 | 4x | 23.2 | 18.7 | 66.6 | 83.4 | 287 | 0 (0) | 0 | 3.7 / 4.2 / 4 | 12.9 | yes |
| swiftshader | 1 | 6x | 23.6 | 17.7 | 66.6 | 83.3 | 289 | 0 (0) | 0 | 3.7 / 4.3 / 4 | 12.9 | yes |
| swiftshader | 2 | 4x | 23.6 | 19 | 66.6 | 83.4 | 291 | 0 (0) | 0 | 3.7 / 4.3 / 4 | 13 | yes |
| swiftshader | 2 | 6x | 23 | 17.4 | 66.7 | 100 | 284 | 2 (0) | 55 | 3.7 / 4.2 / 4 | 13.1 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 1, 4x | default, tier 1, 6x | default, tier 2, 4x | default, tier 2, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | 59 / 58 / 33.4 / 16.7 / 0 | 58 / 58 / 33.4 / 16.8 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 58 / 57 / 33.4 / 16.8 / 0 | 19.8 / 18.7 / 66.7 / 66.7 / 0 | 20 / 17.7 / 66.8 / 66.7 / 0 | 20.2 / 19 / 66.8 / 66.7 / 0 | 19.7 / 17.4 / 66.8 / 66.7 / 0 |
| trust | 59.5 / 59 / 33.3 / 16.8 / 0 | 59.5 / 59 / 33.4 / 16.8 / 0 | 60 / 60 / 16.8 / 16.8 / 0 | 56 / 56 / 33.4 / 33.2 / 0 | 23.6 / 20.7 / 66.8 / 50.1 / 0 | 25 / 22 / 66.7 / 50.1 / 0 | 24 / 23 / 66.7 / 50.1 / 0 | 23.6 / 21.3 / 66.7 / 66.6 / 0 |

