# Home performance (phase-08/world/frames)

Measured 2026-11-05T10:24:04.023Z on commit 3044daf with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 1.81 / 3.93 / 5.8 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3300 node scripts/measure-home.mjs docs/qa/phase-08/world/frames --only=frames --tiers=2,3 --sections=trust,services,journey,booking
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page (`--sections`: from one viewport above trust to the bottom of booking, a pin room included). Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | clsAll / cls | Engine initMs / longest task ms | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 2 | 4x | 14.5 | 4.1 | 150.1 | 3366.4 | 726 | 255 (128) | 2909 | 4.8 / 11.2 / 9.8 | 0 / 0 | 34.4 / 0 | 50.5 | yes |
| default | 2 | 6x | 14.4 | 3.8 | 166.7 | 3749.8 | 689 | 461 (150) | 3014 | 4.8 / 10.8 / 9.8 | 0 / 0 | 33.1 / 0 | 56.8 | yes |
| default | 3 | 4x | 6.3 | 1.9 | 233.3 | 4083.3 | 722 | 370 (182) | 3588 | 4.8 / 11.2 / 10 | 0 / 0 | 39.7 / 0 | 69.7 | yes |
| default | 3 | 6x | 5.9 | 1.8 | 266.6 | 4933.2 | 671 | 558 (194) | 4107 | 4.8 / 11.2 / 10 | 0 / 0 | 39.8 / 0 | 77.8 | yes |
| swiftshader | 2 | 4x | 6.5 | 0.4 | 316.7 | 4799.9 | 475 | 35 (9) | 728 | 4.8 / 10.5 / 9.7 | 0 / 0 | 66.2 / 570 | 72.4 | yes |
| swiftshader | 2 | 6x | 6.4 | 0.2 | 316.6 | 4733.2 | 481 | 69 (14) | 1053 | 4.8 / 10.2 / 9.7 | 0 / 0 | 36.5 / 0 | 69.7 | yes |
| swiftshader | 3 | 4x | 5.7 | 0.4 | 350 | 4216.5 | 515 | 23 (8) | 745 | 4.8 / 10.3 / 9.9 | 0 / 0 | 41.1 / 346 | 66.9 | yes |
| swiftshader | 3 | 6x | 8.5 | 0.4 | 249.9 | 3199.9 | 487 | 32 (7) | 745 | 4.8 / 10.8 / 9.7 | 0 / 0 | 45.7 / 343 | 55 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 2, 4x | default, tier 2, 6x | default, tier 3, 4x | default, tier 3, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x | swiftshader, tier 3, 4x | swiftshader, tier 3, 6x |
|---|---|---|---|---|---|---|---|---|
| trust | 8.2 / 8.2 / 249.9 / 249.9 / 12, 238 | 7 / 7 / 316.6 / 316.6 / 13, 310 | 4.7 / 3.3 / 866.6 / 866.6 / 14, 854 | 4 / 2.8 / 1033.3 / 1033.3 / 15, 1029 | 4.9 / 4.9 / 366.7 / 366.7 / 1, 50 | 5.9 / 5.1 / 416.6 / 416.6 / 0 | 3.1 / 2.9 / 533.3 / 533.3 / 1, 56 | 4.7 / 3.8 / 466.6 / 466.6 / 2, 69 |
| services | 7 / 4.8 / 299.9 / 200.1 / 125, 294 | 6.7 / 4.2 / 399.9 / 233.2 / 117, 392 | 5.5 / 1.9 / 700 / 350 / 126, 704 | 4.5 / 1.8 / 783.3 / 366.7 / 126, 779 | 3.9 / 2.6 / 666.7 / 449.9 / 12, 364 | 4.1 / 3.4 / 516.6 / 416.7 / 17, 407 | 4.1 / 1.9 / 783.3 / 483.3 / 12, 745 | 5.5 / 3 / 500.1 / 366.7 / 13, 512 |
| journey | 26 / 26 / 66.7 / 50.1 / 1, 50 | 18.7 / 18.4 / 83.4 / 83.3 / 16, 64 | 20 / 20 / 83.4 / 83.3 / 14, 75 | 14.9 / 14.3 / 100.1 / 100 / 29, 93 | 7.7 / 6.7 / 233.4 / 200 / 0 | 9.4 / 9 / 233.3 / 199.9 / 4, 115 | 9.7 / 9.2 / 150 / 133.4 / 0 | 12.6 / 12.6 / 116.7 / 116.6 / 0 |
| booking | 12.2 / 9.7 / 150 / 133.3 / 38, 141 | 9 / 8 / 166.7 / 150 / 42, 161 | 5.7 / 5 / 233.3 / 233.2 / 39, 242 | 5.2 / 4.5 / 283.3 / 266.6 / 43, 284 | 5.6 / 4.2 / 316.7 / 300 / 2, 54 | 6.4 / 6.4 / 266.6 / 216.6 / 8, 117 | 4.6 / 3.8 / 450 / 350 / 1, 56 | 6.1 / 5.1 / 316.7 / 300 / 3, 68 |

