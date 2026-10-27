# Home performance (phase-07/steps/01-engine)

Measured 2026-10-27T02:39:44.649Z on commit 1e63a42 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 2.25 / 3.24 / 2.52 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3100 node scripts/measure-home.mjs docs/qa/phase-07/steps/01-engine --only=bundle,lighthouse,frames
```

## Lighthouse (median of 3)

Lighthouse 12.6.1, performance category only, over HTTPS and HTTP/2 (scripts/tls-front.mjs), simulated throttling. Mobile preset CPU slowdown 4x (host benchmarkIndex 1995; scripts/lhci.mjs rule); desktop preset 1x. Lighthouse has no INP in a navigation: TBT and max potential FID are its proxies. Total JS is every script of the load, transfer size.

| Page | Preset | Score | LCP ms | CLS | TBT ms | Max potential FID ms | FCP ms | Total JS KiB (requests) | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| `/?tier=0` | mobile | 0.97 | 2341 | 0 | 117 | 171 | 1158 | 157 (11) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=1` | mobile | 0.96 | 2422 | 0 | 130 | 156 | 1160 | 208 (13) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=0` | desktop | 1 | 601 | 0 | 0 | 40 | 317 | 157 (11) | `section.relative > div.relative > picture > img.absolute` |
| `/?tier=1` | desktop | 1 | 606 | 0 | 0 | 49 | 317 | 208 (13) | `section.relative > div.relative > picture > img.absolute` |

## Frame times and heap (desktop 1440x900, median of 3 runs field by field)

Chromium launched as tests/helpers/launch.ts does: `default` (headless as is) and `swiftshader` (the software GPU profile of the perf project); CDP CPU throttling, mouse wheel 80 px every 50 ms from the top to the bottom of the page. Frames are requestAnimationFrame deltas; long tasks come from a PerformanceObserver (over 50 ms). Heap is CDP Runtime.getHeapUsage: before the scroll after a forced GC, right after it, and after another GC.

| GPU | Tier | CPU | Median fps (1 s windows) | Slowest window fps | p95 frame ms | Worst frame ms | Frames over 33 ms | Long tasks (over 100 ms) | Longest task ms | Heap MiB before / after / after GC | Scroll s | Reached bottom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default | 0 | 4x | 59.5 | 57 | 16.8 | 49.9 | 6 | 0 (0) | 0 | 2.9 / 3.7 / 3 | 6.6 | yes |
| default | 0 | 6x | 57.5 | 53 | 16.8 | 50 | 18 | 0 (0) | 0 | 2.9 / 3.7 / 3 | 7 | yes |
| default | 1 | 4x | 60 | 59 | 16.7 | 33.4 | 2 | 0 (0) | 0 | 3.5 / 4.5 / 3.7 | 10 | yes |
| default | 1 | 6x | 57 | 47 | 33.3 | 50 | 42 | 0 (0) | 0 | 3.5 / 4.5 / 3.7 | 10.6 | yes |
| swiftshader | 0 | 4x | 43.8 | 16.9 | 66.7 | 200 | 53 | 1 (0) | 56 | 2.9 / 3.6 / 3 | 8.3 | yes |
| swiftshader | 0 | 6x | 45.8 | 18.1 | 66.7 | 183.4 | 55 | 0 (0) | 0 | 2.9 / 3.6 / 3 | 8.2 | yes |
| swiftshader | 1 | 4x | 31.5 | 22 | 50.1 | 100 | 297 | 0 (0) | 0 | 3.5 / 4.5 / 3.7 | 13.3 | yes |
| swiftshader | 1 | 6x | 31 | 22 | 50.1 | 100 | 297 | 1 (0) | 54 | 3.5 / 4.5 / 3.7 | 13.2 | yes |

### Per section (mean fps / p95 frame ms / long tasks, longest ms)

The section is the innermost `data-home-section` under the viewport centre line; `none` is the header strip at the top, gaps and the footer.

| Section | default, tier 0, 4x | default, tier 0, 6x | default, tier 1, 4x | default, tier 1, 6x | swiftshader, tier 0, 4x | swiftshader, tier 0, 6x | swiftshader, tier 1, 4x | swiftshader, tier 1, 6x |
|---|---|---|---|---|---|---|---|---|
| hero | 60 / 16.8 / 0 | 56.8 / 33.3 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 54 / 33.4 / 0 | 34.7 / 49.9 / 0 | 36.7 / 50 / 0 |
| trust | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60.1 / 16.7 / 0 | 37.5 / 33.4 / 0 | 36.9 / 33.4 / 0 |
| services | 54.3 / 33.4 / 0 | 50.3 / 33.4 / 0 | 59.2 / 16.7 / 0 | 54.1 / 33.3 / 0 | 26.6 / 116.7 / 1, 56 | 26.3 / 100 / 0 | 26.7 / 50.1 / 0 | 26.7 / 66.7 / 0 |
| restoration | 57.3 / 16.7 / 0 | 57.3 / 16.8 / 0 | 58.2 / 16.8 / 0 | 50.3 / 33.4 / 0 | 32.9 / 149.9 / 0 | 35.6 / 116.7 / 0 | 25.5 / 66.6 / 0 | 26 / 66.7 / 0 |
| compare | 60 / 16.8 / 0 | 57.1 / 33.3 / 0 | 60 / 16.8 / 0 | 58.1 / 16.8 / 0 | 58.5 / 16.8 / 0 | 57.1 / 33.4 / 0 | 32.1 / 50 / 0 | 31.1 / 50 / 0 |
| dentists | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 56.3 / 16.8 / 0 | 57.6 / 16.8 / 0 | 32.7 / 33.4 / 0 | 32 / 50 / 0 |
| voices | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 35.7 / 33.4 / 0 | 35 / 33.4 / 0 |
| journey | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 32.7 / 33.4 / 0 | 32.8 / 50 / 0 |
| faq | 60 / 16.8 / 0 | 55.9 / 33.3 / 0 | 60 / 16.7 / 0 | 49.7 / 33.4 / 0 | 30.5 / 83.3 / 0 | 31 / 100 / 0 | 26.5 / 83.3 / 0 | 25.9 / 66.7 / 0 |
| booking | 58.9 / 16.7 / 0 | 56.9 / 33.3 / 0 | 60 / 16.8 / 0 | 49.8 / 33.4 / 0 | 23.3 / 116.6 / 0 | 22.8 / 133.3 / 0 | 25.3 / 83.3 / 0 | 25.5 / 83.3 / 0 |
| none | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 60 / 16.8 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 60 / 16.7 / 0 | 49.1 / 33.4 / 0 | 46.7 / 33.4 / 0 |

## Initial JS per page class (scripts/check-bundle.mjs, exit code 0)

Encoded (gzip) bytes of every script that started before the load event, desktop 1440x900, light theme. Full data: bundle.json.

| Class | Page | Initial JS | Shared | Route | Interim limit | Route allowance | Doc target | CSS | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| home | `/` | 155.7 KiB | 143.5 KiB | 12.2 KiB | 215 KiB | 85 KiB | 180 KB | 14.1 KiB | 90.1 KiB |
| content | `/qa/not-found` | 144.3 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/زیبایی` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/ترمیم-دندان` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/خدمات/لمینت-سرامیکی` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/پزشکان` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/پزشکان/دکتر-نمونه-آزمایشی` | 149.1 KiB | 143.5 KiB | 5.6 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/درباره-ما` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/آدرس` | 148.7 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار/اولین-مراجعه` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/هزینه-و-پرداخت` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| content | `/حریم-خصوصی` | 144.3 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.7 KiB | 90.1 KiB |
| booking | `/رزرو-نوبت` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 20 KiB | 70 KB | 13.7 KiB | 90.1 KiB |
| booking | `/اورژانس` | 147.8 KiB | 143.5 KiB | 4.3 KiB | 150 KiB | 20 KiB | 70 KB | 13.7 KiB | 90.1 KiB |

