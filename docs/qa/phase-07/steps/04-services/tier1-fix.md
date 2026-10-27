# Services at tier 1: the card transition fix (step 4 follow-up)

Measured 2026-10-27 on this host (4 CPUs, Chromium 141), desktop 1440x900, default GPU, 4x CPU,
the `measure-home` scroll (wheel 80 px every 50 ms). Each run starts at load average under 1.0;
the two builds alternate in three rounds of three runs. Values: the services section's median
1 s window fps / slowest window fps / worst frame ms, as the median over the 9 runs.

| Build | Tier 1 | Tier 2 | Long tasks over 100 ms |
|---|---|---|---|
| 6e5b395 (before the services scene) | 57.1 / 57.1 / 33.4 | 59 / 59 / 33.3 | 0 |
| 4f9e7ad (the scene with the tier 1 reveal), earlier 21-run sample | 51 / 51 / 50 | - | 0 |
| This commit | 59 / 59 / 33.4 | 57 / 55 / 50 | 0 |

Per-run tier 1 medians, this commit: 59 60 59 60 58 60 58 59 59. Tier 2, this commit: 56.5
55.5 56 57 56 57 59 58 59 (the pinned row; three runs had a 54-68 ms task as the MorphSVG
chunk loaded, and two had a 66.7 ms worst frame).

Cause of the tier 1 drop: `LINK_CARD` carried Tailwind `transition-transform`, which transitions
`transform, translate, scale, rotate` over `--dur-2`. The reveal's gsap `y` writes an inline
`transform` on each tile every frame, so every frame started a new 200 ms CSS transition on the
five tiles: 6-12 ms of style recalculation per frame at 4x and 12 -> 30 composited layers. The
hover lift uses `translate`, so the card now transitions `translate` only.

With that fixed the reveal still cost 3 fps (56 against 59 without it, 21 runs each; heading,
lead and mark only: 57), so the tier 1 line reveal is dropped: the bento stays still at tier 1.

Tier 2 (the pinned row) misses the 59 median by 2 fps; it is the next item of step 4.
