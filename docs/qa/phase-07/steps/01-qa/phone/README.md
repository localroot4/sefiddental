# Home performance (phase-07/steps/01-qa/phone)

Measured 2026-10-27T04:28:48.658Z on commit 01e24d4 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 10.12 / 8.5 / 8.78 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3900 node scripts/measure-home.mjs docs/qa/phase-07/steps/01-qa/phone --only=frames --tiers=1 --viewport=phone
```

## Frame times and heap (phone 390x844 touch, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is); CDP CPU throttling, one-finger swipes of 500 px (CDP touch events, no fling) from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 1 | 6x | 51 | 46.2 | 33.4 | 66.8 | 107 | 0 (0) | 0 | 3.6 / 4.1 / 3.8 | 12.6 | yes |

### Per section (median window fps / slowest window fps / worst frame ms / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line, `footer` the playground stage; `none` is the header strip at the top, gaps and the site footer. Window fps are 1 s windows of that section's frames (`-` when the section held no full window); the budgets (report section 5) read the first three numbers.

| Section | default, tier 1, 6x |
|---|---|
| hero | - / - / 33.4 / 33.4 / 0 |
| trust | - / - / 33.3 / 33.3 / 0 |
| services | 50 / 48 / 50 / 33.4 / 0 |
| restoration | - / - / 66.7 / 33.4 / 0 |
| compare | 49 / 49 / 33.4 / 33.4 / 0 |
| dentists | 43 / 43 / 50.1 / 33.4 / 0 |
| voices | 54 / 54 / 50 / 33.4 / 0 |
| journey | 45 / 45 / 50 / 33.4 / 0 |
| faq | - / - / 33.4 / 33.3 / 0 |
| booking | 51 / 51 / 33.4 / 33.4 / 0 |
| none | - / - / 33.3 / 16.8 / 0 |

