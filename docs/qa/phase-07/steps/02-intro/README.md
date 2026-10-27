# Home performance (phase-07/steps/02-intro)

Measured 2026-10-27T01:45:52.480Z on commit 1e63a42 with local changes; null; host 4 CPUs, load average 8.59 / 5.17 / 3.82 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3200 node scripts/measure-home.mjs docs/qa/phase-07/steps/02-intro --only=bundle,lighthouse
```

## Lighthouse (median of 3)

Lighthouse 12.6.1, performance category only, over HTTPS and HTTP/2 (scripts/tls-front.mjs), simulated throttling. Mobile preset CPU slowdown 4x (host benchmarkIndex 2219; scripts/lhci.mjs rule); desktop preset 1x. Lighthouse has no INP in a navigation: TBT and max potential FID are its proxies. Total JS is every script of the load, transfer size.

| Page | Preset | Score | LCP ms | CLS | TBT ms | Max potential FID ms | FCP ms | Total JS KiB (requests) | LCP element |
|---|---|---|---|---|---|---|---|---|---|
| `/?tier=0` | mobile | 0.91 | 2125 | 0 | 339 | 211 | 1107 | 156 (11) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=1` | mobile | 0.73 | 2436 | 0 | 1279 | 302 | 1120 | 444 (15) | `section.relative > div.relative > div.grid > h1#hero-h1` |
| `/?tier=0` | desktop | 0.99 | 691 | 0 | 3 | 55 | 345 | 156 (11) | `section.relative > div.relative > picture > img.absolute` |
| `/?tier=1` | desktop | 0.99 | 615 | 0 | 48 | 78 | 313 | 444 (15) | `section.relative > div.relative > picture > img.absolute` |

## Initial JS per page class (scripts/check-bundle.mjs, exit code 0)

Encoded (gzip) bytes of every script that started before the load event, desktop 1440x900, light theme. Full data: bundle.json.

| Class | Page | Initial JS | Shared | Route | Interim limit | Route allowance | Doc target | CSS | Fonts |
|---|---|---|---|---|---|---|---|---|---|
| home | `/` | 155.4 KiB | 143.5 KiB | 12 KiB | 215 KiB | 85 KiB | 180 KB | 14.2 KiB | 90.1 KiB |
| content | `/qa/not-found` | 144.2 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/زیبایی` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/ترمیم-دندان` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/خدمات/لمینت-سرامیکی` | 149.2 KiB | 143.5 KiB | 5.7 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/پزشکان` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/پزشکان/دکتر-نمونه-آزمایشی` | 149.1 KiB | 143.5 KiB | 5.6 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/درباره-ما` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/آدرس` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/راهنمای-بیمار/اولین-مراجعه` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/هزینه-و-پرداخت` | 148.6 KiB | 143.5 KiB | 5.1 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| content | `/حریم-خصوصی` | 144.2 KiB | 143.5 KiB | 0.8 KiB | 150 KiB | 15 KiB | 90 KB | 13.8 KiB | 90.1 KiB |
| booking | `/رزرو-نوبت` | 148.4 KiB | 143.5 KiB | 5 KiB | 150 KiB | 20 KiB | 70 KB | 13.8 KiB | 90.1 KiB |
| booking | `/اورژانس` | 147.8 KiB | 143.5 KiB | 4.3 KiB | 150 KiB | 20 KiB | 70 KB | 13.8 KiB | 90.1 KiB |

