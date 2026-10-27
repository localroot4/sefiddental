# Home performance (phase-07/steps/02-intro)

Measured 2026-10-27T03:24:57.606Z on commit 8cddfbb with local changes; null; host 4 CPUs, load average 1.05 / 1.99 / 2.62 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3000 node scripts/measure-home.mjs docs/qa/phase-07/steps/02-intro --only=bundle,lighthouse
```

## Lighthouse (median of 3)

Lighthouse 12.6.1, performance category only, over HTTPS and HTTP/2 (scripts/tls-front.mjs), simulated throttling. Mobile preset CPU slowdown 4x (host benchmarkIndex 2119; scripts/lhci.mjs rule); desktop preset 1x. Lighthouse has no INP in a navigation: TBT and max potential FID are its proxies. Total JS is every script of the load, transfer size.

| Page | Preset | Score | LCP ms | CLS | TBT ms | Max potential FID ms | FCP ms | Total JS KiB (requests) | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| `/?tier=0` | mobile | 0.96 | 2265 | 0 | 179 | 181 | 1087 | 157 (11) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=1` | mobile | 0.94 | 2413 | 0 | 249 | 170 | 1082 | 208 (13) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=0` | desktop | 0.99 | 594 | 0 | 0 | 41 | 312 | 157 (11) | `section.relative > div.relative > picture > img.absolute` |
| `/?tier=1` | desktop | 0.99 | 618 | 0 | 0 | 45 | 316 | 208 (13) | `section.relative > div.relative > picture > img.absolute` |

## Initial JS per page class (scripts/check-bundle.mjs, exit code 0)

Encoded (gzip) bytes of every script that started before the load event, desktop 1440x900, light theme. Full data: bundle.json.

| Class | Page | Initial JS | Shared | Route | Interim limit | Route allowance | Doc target | CSS | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| home | `/` | 155.9 KiB | 143.5 KiB | 12.4 KiB | 215 KiB | 85 KiB | 180 KB | 14.2 KiB | 90.1 KiB |
| content | `/qa/not-found` | 144.3 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/زیبایی` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/ترمیم-دندان` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/لمینت-سرامیکی` | 149.3 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/پزشکان` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/پزشکان/دکتر-نمونه-آزمایشی` | 149.1 KiB | 143.5 KiB | 5.6 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/درباره-ما` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/آدرس` | 148.7 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار/اولین-مراجعه` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/هزینه-و-پرداخت` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/حریم-خصوصی` | 144.3 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| booking | `/رزرو-نوبت` | 148.5 KiB | 143.5 KiB | 5 KiB | 150 KiB | 20 KiB | 70 KB | 13.8 KiB | 90.1 KiB |
| booking | `/اورژانس` | 147.8 KiB | 143.5 KiB | 4.3 KiB | 150 KiB | 20 KiB | 70 KB | 13.8 KiB | 90.1 KiB |

