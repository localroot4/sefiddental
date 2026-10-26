# Home performance (phase-07/baseline)

Measured 2026-10-26T22:17:50.002Z on commit f1f6b1f with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 0.7 / 0.96 / 1.25 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/baseline
```

## Lighthouse (median of 3)

Lighthouse 12.6.1, performance category only, over HTTPS and HTTP/2 (scripts/tls-front.mjs), simulated throttling. Mobile preset CPU slowdown 4x (host benchmarkIndex 2090; scripts/lhci.mjs rule); desktop preset 1x. Lighthouse has no INP in a navigation: TBT and max potential FID are its proxies. Total JS is every script of the load, transfer size.

| Page | Preset | Score | LCP ms | CLS | TBT ms | Max potential FID ms | FCP ms | Total JS KiB (requests) | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| `/?tier=0` | mobile | 0.98 | 2346 | 0 | 100 | 158 | 1066 | 156 (11) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=1` | mobile | 0.86 | 2636 | 0 | 457 | 218 | 1070 | 444 (15) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=0` | desktop | 1 | 564 | 0 | 0 | 40 | 304 | 156 (11) | `section.relative > div.relative > picture > img.absolute` |
| `/?tier=1` | desktop | 1 | 553 | 0 | 4 | 57 | 293 | 444 (15) | `section.relative > div.relative > picture > img.absolute` |

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 0 | 4x | 60 | 58 | 16.8 | 33.4 | 3 | 0 (0) | 0 | 2.8 / 3.6 / 3 | 6.6 | yes |
| default | 0 | 6x | 58 | 53 | 16.8 | 50 | 12 | 0 (0) | 0 | 2.8 / 3.7 / 3 | 6.8 | yes |
| default | 1 | 4x | 58 | 50 | 33.3 | 83.3 | 39 | 2 (0) | 84 | 5.3 / 6.4 / 5.7 | 11.1 | yes |
| default | 1 | 6x | 42.3 | 32 | 33.4 | 166.6 | 195 | 5 (2) | 175 | 5.3 / 6.3 / 5.7 | 12.5 | yes |
| swiftshader | 0 | 4x | 44.5 | 17.7 | 66.7 | 183.3 | 50 | 1 (0) | 51 | 2.8 / 3.6 / 3 | 8.1 | yes |
| swiftshader | 0 | 6x | 44.8 | 17.4 | 66.6 | 150.1 | 50 | 0 (0) | 0 | 2.8 / 3.6 / 3 | 8.2 | yes |
| swiftshader | 1 | 4x | 22.3 | 18.7 | 66.7 | 100 | 332 | 2 (1) | 103 | 5.3 / 5.9 / 5.6 | 15.1 | yes |
| swiftshader | 1 | 6x | 21.6 | 17 | 66.7 | 133.3 | 324 | 6 (1) | 128 | 5.3 / 5.9 / 5.6 | 15.6 | yes |

### Per section (mean fps / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line; `none` is the header strip at the top, gaps and the footer.

| Section | default, tier 0, 4x | default, tier 0, 6x | default, tier 1, 4x | default, tier 1, 6x | swiftshader, tier 0, 4x | swiftshader, tier 0, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | 60 / 16.8 / 0 | 57 / 33.3 / 0 | 55.4 / 16.8 / 1, 78 | 37.5 / 49.9 / 1, 137 | 56.8 / 33.3 / 0 | 60 / 16.8 / 0 | 23.5 / 66.6 / 1, 74 | 21.8 / 50.1 / 1, 101 |
| trust | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 48 / 33.3 / 0 | 60.1 / 16.7 / 0 | 60.1 / 16.7 / 0 | 24 / 50 / 0 | 23.1 / 50 / 0 |
| services | 56.5 / 33.2 / 0 | 51.4 / 33.4 / 0 | 54.5 / 33.3 / 0 | 38.2 / 50 / 1, 56 | 28.9 / 116.7 / 1, 51 | 28.1 / 99.9 / 0 | 20.2 / 83.3 / 0 | 19.5 / 83.3 / 2, 62 |
| restoration | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 48.4 / 33.4 / 0 | 31.3 / 50 / 0 | 30 / 116.6 / 0 | 38.4 / 116.7 / 0 | 20.4 / 83.3 / 0 | 17.9 / 116.7 / 2, 55 |
| compare | 60 / 16.8 / 0 | 58.5 / 16.8 / 0 | 59.1 / 16.7 / 0 | 45.2 / 33.4 / 0 | 57.1 / 33.3 / 0 | 60 / 16.8 / 0 | 22.3 / 66.6 / 0 | 22.4 / 50.1 / 0 |
| dentists | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 46.7 / 33.4 / 0 | 58.8 / 16.7 / 0 | 58.8 / 16.8 / 0 | 23.6 / 50.1 / 0 | 24.6 / 50.1 / 0 |
| voices | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 47.4 / 33.4 / 0 | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 24.5 / 50.1 / 0 | 24 / 50.1 / 0 |
| journey | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 47.8 / 33.4 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 23.5 / 50.1 / 0 | 22.1 / 66.6 / 0 |
| faq | 60 / 16.7 / 0 | 55.7 / 33.3 / 0 | 51.7 / 33.4 / 0 | 35.7 / 50 / 0 | 31.4 / 83.4 / 0 | 30.5 / 100 / 0 | 21.3 / 66.7 / 0 | 19.5 / 66.7 / 0 |
| booking | 60 / 16.8 / 0 | 57.9 / 16.8 / 0 | 53.2 / 33.3 / 0 | 36.8 / 50 / 0 | 22.9 / 133.3 / 0 | 24.6 / 133.3 / 0 | 20.5 / 66.8 / 0 | 19.6 / 83.3 / 1, 54 |
| none | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 56.7 / 16.8 / 1, 78 | 49.1 / 33.4 / 1, 146 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 23.8 / 50.1 / 1, 103 | 23 / 50.1 / 1, 74 |

## INP of the booking submits (CPU 4x, median of 3)

Default headless Chromium. Event Timing API (PerformanceObserver, durationThreshold 16 ms, the lowest it allows: "< 16" means no entry). Typing is a tap or click on the phone field and 11 key presses 60 ms apart; the submit is a click (desktop) or a tap (phone). The booking POST is answered `{ ok: true }` without the real handler. Breakdown: the slowest run.

| Viewport | Tier | Form | Submit ms (runs) | Slowest submit: event, input delay / processing / presentation ms | Worst typing ms | Success state |
|---|---|---|---|---|---|---|
| desktop | 0 | hero | 120 (120, 144, 112) | pointerdown, 11 / 8 / 125 | 80 | 3/3 |
| desktop | 0 | block | 136 (136, 168, 112) | pointerdown, 11 / 11 / 146 | 56 | 3/3 |
| desktop | 1 | hero | 136 (128, 136, 184) | pointerdown, 26 / 11 / 147 | 88 | 3/3 |
| desktop | 1 | block | 192 (192, 192, 240) | pointerdown, 23 / 12 / 206 | 80 | 3/3 |
| phone | 0 | hero | 152 (160, 152, 120) | click, 50 / 28 / 82 | 64 | 3/3 |
| phone | 0 | block | 160 (192, 160, 160) | click, 64 / 104 / 24 | 72 | 3/3 |
| phone | 1 | hero | 192 (208, 176, 192) | pointerdown, 42 / 3 / 163 | 112 | 3/3 |
| phone | 1 | block | 208 (200, 208, 224) | click, 75 / 122 / 28 | 104 | 3/3 |

## Initial JS per page class (scripts/check-bundle.mjs, exit code 0)

Encoded (gzip) bytes of every script that started before the load event, desktop 1440x900, light theme. Full data: bundle.json.

| Class | Page | Initial JS | Shared | Route | Interim limit | Route allowance | Doc target | CSS | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| home | `/` | 155.2 KiB | 143.5 KiB | 11.8 KiB | 215 KiB | 85 KiB | 180 KB | 14.1 KiB | 90.1 KiB |
| content | `/qa/not-found` | 144.2 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/زیبایی` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/ترمیم-دندان` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/لمینت-سرامیکی` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/پزشکان` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/پزشکان/دکتر-نمونه-آزمایشی` | 149.1 KiB | 143.5 KiB | 5.6 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/درباره-ما` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/آدرس` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار/اولین-مراجعه` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/هزینه-و-پرداخت` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/حریم-خصوصی` | 144.2 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| booking | `/رزرو-نوبت` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 20 KiB | 70 KB | 13.7 KiB | 90.1 KiB |
| booking | `/اورژانس` | 147.8 KiB | 143.5 KiB | 4.3 KiB | 150 KiB | 20 KiB | 70 KB | 13.7 KiB | 90.1 KiB |

