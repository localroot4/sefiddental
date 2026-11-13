# Photos of the client preview

The clinic's own photos (taken at the clinic, sent by the owner on 2026-11-13,
originals in `content/photos/clinic/`) fill the photo slots on the client
preview (`DEMO_CONTENT`, `src/lib/demoPhotos.ts`). The live site never shows
these files: it refuses `DEMO_CONTENT` and shows only published media, so each
photo is published through the admin before launch.

Encoded by `node scripts/clinic-photos.mjs`: a 3:2 (`wide`) or 4:5 (`tall`,
`-p`) crop at the focal point given in that script, then AVIF (quality 50) and
WebP (quality 72) at the widths of `src/lib/demoPhotos.ts`. The sources are
Telegram copies, 1280 px at most: the widths above that (hero 1600 to 2560,
frames 1440) are upscaled and soft until the full-size originals arrive.

Consent: the patients in the treatment photos (cosmetic, restorative,
orthodontics, workflow smile and the three voice posters) need the clinic's
written consent before any of them is published.

`arch-occlusal-*` (the home arch band, journey D5) was made by the owner with an
AI image tool on 2026-11-07 (1122x1402 source); the journey's 3D arch is
registered to it by the numbers in `src/lib/archPhoto.ts`.

The before/after pair stays a labelled placeholder: two unrelated photos would
claim a treatment result.
