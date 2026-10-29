# Home performance (phase-07/steps/08-booking-footer-inp)

Measured 2026-10-27T05:27:24.189Z on commit 01e24d4 with local changes; Chromium 141.0.7390.37; host 4 CPUs, load average 3.11 / 4.07 / 4.52 at the start.

Run again with the same command (after `npm run build` and `npm run db:e2e`; nothing else may listen on E2E_PORT or E2E_PORT + 1):

```
E2E_PORT=3800 node scripts/measure-home.mjs docs/qa/phase-07/steps/08-booking-footer-inp --only=inp --tiers=0,1
```

## INP of the booking submits (CPU 4x, median of 3)

Default headless Chromium. Event Timing API (PerformanceObserver, durationThreshold 16 ms, the lowest it allows: "< 16" means no entry). Typing is a tap or click on the phone field and 11 key presses 60 ms apart; the submit is a click (desktop) or a tap (phone). The booking POST is answered `{ ok: true }` without the real handler. Breakdown: the slowest run.

| Viewport | Tier | Form | Submit ms (runs) | Slowest submit: event, input delay / processing / presentation ms | Worst typing ms | Success state |
|---|---|---|---|---|---|---|
| desktop | 0 | hero | 144 (128, 144, 160) | pointerdown, 15 / 10 / 135 | 56 | 3/3 |
| desktop | 0 | block | 176 (176, 192, 152) | pointerdown, 14 / 4 / 174 | 64 | 3/3 |
| desktop | 1 | hero | 152 (152, 120, 160) | pointerdown, 14 / 12 / 135 | 64 | 3/3 |
| desktop | 1 | block | 176 (200, 176, 160) | pointerdown, 14 / 16 / 171 | 72 | 3/3 |
| phone | 0 | hero | 152 (152, 136, 176) | click, 53 / 29 / 94 | 88 | 3/3 |
| phone | 0 | block | 168 (168, 184, 144) | click, 65 / 99 / 20 | 64 | 3/3 |
| phone | 1 | hero | 176 (176, 176, 200) | pointerdown, 13 / 2 / 185 | 88 | 3/3 |
| phone | 1 | block | 200 (192, 200, 240) | pointerdown, 25 / 6 / 209 | 88 | 3/3 |

