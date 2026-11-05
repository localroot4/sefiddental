# Home performance (phase-08/molar/frames)

Measured 2026-11-05T10:30:47.780Z on commit a0a942c; Chromium 141.0.7390.37; host 4 CPUs, load average 6.19 / 5.27 / 5.73 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3260 node scripts/measure-home.mjs docs/qa/phase-08/molar/frames --only=frames --tiers=2,3 --sections=restoration,workflow,compare
```

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page (`--sections`: from one viewport above restoration to the bottom of compare, a pin room included). Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | clsAll / cls | Engine initMs / longest task ms | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 2 | 4x | 11.4 | 6.1 | 166.6 | 333.3 | 321 | 257 (71) | 335 | 6.7 / 9.2 / 8.5 | 0 / 0 | 43.6 / 79 | 26.8 | yes |
| default | 2 | 6x | 8.9 | 5.3 | 183.3 | 433.4 | 299 | 264 (126) | 426 | 6.7 / 9.1 / 8.5 | 0 / 0 | 43.4 / 99 | 32.6 | yes |
| default | 3 | 4x | 11.6 | 6.3 | 150 | 333.3 | 314 | 264 (71) | 320 | 6.7 / 9.1 / 8.5 | 0 / 0 | 82.4 / 103 | 26.3 | yes |
| default | 3 | 6x | 10.3 | 5.5 | 166.7 | 350 | 304 | 268 (87) | 355 | 6.7 / 9.5 / 8.5 | 0 / 0 | 33.6 / 69 | 28.1 | yes |
| swiftshader | 2 | 4x | 7.9 | 3.3 | 316.6 | 450 | 218 | 15 (7) | 423 | 6.6 / 9.2 / 8.4 | 0 / 0 | 75.8 / 744 | 28.2 | yes |
| swiftshader | 2 | 6x | 7.2 | 3.1 | 333.2 | 483.3 | 211 | 31 (12) | 398 | 6.6 / 9.3 / 8.3 | 0 / 0 | 32.1 / 763 | 31 | yes |
| swiftshader | 3 | 4x | 8 | 2.9 | 300 | 516.7 | 227 | 17 (7) | 405 | 6.6 / 8.8 / 8.4 | 0 / 0 | 60 / 650 | 30.8 | yes |
| swiftshader | 3 | 6x | 7.3 | 3.3 | 316.6 | 516.5 | 214 | 33 (10) | 437 | 6.6 / 9.5 / 8.4 | 0 / 0 | 30.6 / 634 | 30.6 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 2, 4x | default, tier 2, 6x | default, tier 3, 4x | default, tier 3, 6x | swiftshader, tier 2, 4x | swiftshader, tier 2, 6x | swiftshader, tier 3, 4x | swiftshader, tier 3, 6x |
|---|---|---|---|---|---|---|---|---|
| restoration | 12.2 / 10.3 / 183.2 / 133.4 / 64, 170 | 8.9 / 8.4 / 200 / 166.7 / 62, 204 | 12.8 / 10 / 166.7 / 116.7 / 63, 170 | 10.8 / 9.7 / 150 / 133.2 / 61, 145 | 9.5 / 7.9 / 300 / 200 / 4, 252 | 8 / 7 / 333.4 / 216.6 / 8, 322 | 10.3 / 5.7 / 300 / 200 / 2, 307 | 7.9 / 5.5 / 300 / 233.3 / 11, 221 |
| workflow | 9.6 / 6.2 / 250.1 / 166.7 / 133, 209 | 7.4 / 5.3 / 300 / 200 / 139, 257 | 9.6 / 6.2 / 233.4 / 166.7 / 142, 228 | 8.6 / 5.6 / 233.2 / 183.4 / 141, 224 | 4.9 / 3.2 / 450 / 350 / 6, 423 | 4.5 / 3.1 / 483.3 / 383.3 / 17, 336 | 4.9 / 2.7 / 516.7 / 350 / 8, 373 | 5.1 / 2.9 / 516.5 / 333.3 / 14, 357 |
| compare | 14.9 / 14.3 / 83.4 / 83.4 / 36, 92 | 10.3 / 8.7 / 183.3 / 150 / 34, 171 | 13.9 / 12.8 / 100.1 / 83.4 / 37, 95 | 11.9 / 11.4 / 133.4 / 133.3 / 34, 124 | 9.6 / 9.5 / 200.1 / 150 / 1, 78 | 9.1 / 8.6 / 233.3 / 183.3 / 3, 111 | 9.4 / 8 / 250.1 / 166.7 / 1, 81 | 8.9 / 8.9 / 183.4 / 166.7 / 3, 99 |

