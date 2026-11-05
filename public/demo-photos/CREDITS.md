# Demo photos of the client preview

Stock photos that fill the photo slots on the client preview only
(`DEMO_CONTENT`, `src/lib/demoPhotos.ts`). The live site never shows them:
it refuses `DEMO_CONTENT` and keeps the labelled placeholders. Each file is
replaced by the clinic's own photo when it is published.

License of every photo: the Pexels License,
<https://www.pexels.com/license/>. It allows free commercial use, with or
without changes, and asks for no attribution. Its limits apply: no sale of
unaltered copies, no redistribution as a stock photo, no implied endorsement
by a person shown, no use of a person in a bad light. For that reason the
patient voice posters and the workflow smile show only a smile (nose to chin),
and every demo dentist card keeps the «فرضی» name and the «طرح نمایشی» line.

Downloaded on 2026-11-05 from `images.pexels.com` (the `w=2000` or `w=3200`
size, or the original where marked). Credits come from each photo's Pexels
page. Encoded with sharp: a centred crop at the focal point given here, then
AVIF (quality 50) and WebP (quality 72) at the widths of
`src/lib/demoPhotos.ts`. `wide` files are 3:2, `tall` files (`-p`) are 4:5.

| Files                         | Slot                                                           | Source page                                                                                                   | Photographer                    | Crop (focal x, y; zoom)                                               |
| ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `hero-*`                      | home hero (landscape and 4:5 band)                             | <https://www.pexels.com/photo/a-dental-equipment-in-the-clinic-6812453/>                                      | Pavel Danilyuk                  | 0.52, 0.5                                                             |
| `services-hub-*`              | services hub hero                                              | <https://www.pexels.com/photo/blue-and-white-dental-chair-6809634/>                                           | Pavel Danilyuk                  | 0.5, 0.45                                                             |
| `cosmetic-*`, `shade-guide-*` | cosmetic category and its services; services tiles (home, hub) | <https://www.pexels.com/photo/close-up-artificial-teeth-6627604/>                                             | Karolina Grabowska (Kaboompics) | 0.55, 0.5                                                             |
| `surgery-replacement-*`       | surgery and replacement category and its services              | <https://www.pexels.com/photo/dental-instruments-on-a-table-in-a-dental-clinic-15771809/>                     | Gaspar Osorio                   | 0.5, 0.5                                                              |
| `restorative-*`               | restorative category and its services                          | <https://www.pexels.com/photo/modern-dental-office-interior-with-equipment-30902075/>                         | Duy Tân Đại học                 | 0.45, 0.5                                                             |
| `orthodontics-*`              | orthodontics                                                   | <https://www.pexels.com/photo/cast-model-of-dentures-6529216/>                                                | cottonbro studio                | 0.6, 0.5                                                              |
| `pediatric-*`                 | pediatric dentistry                                            | <https://www.pexels.com/photo/teeth-and-dental-cast-models-7422519/>                                          | Emeric Kalil                    | 0.6, 0.5                                                              |
| `about-*`                     | about hero                                                     | <https://www.pexels.com/photo/waiting-room-in-a-hospital-8459996/>                                            | Los Muertos Crew                | 0.5, 0.55                                                             |
| `guide-hub-*`                 | patient guide hub hero                                         | <https://www.pexels.com/photo/a-person-holding-a-teeth-model-and-a-dental-scaler-4269698/>                    | Cedric Fauntleroy               | 0.62, 0.5                                                             |
| `dentists-hub-*`              | dentists hub hero                                              | <https://www.pexels.com/photo/dentist-with-patient-12745979/> (original)                                      | Esma Karagoz                    | tall 0.45, 0.45; wide 0.4, 0.5, 1.25 (the patient stays out of frame) |
| `workflow-scan-*`             | workflow step 1                                                | <https://www.pexels.com/photo/xray-image-of-teeth-on-the-screen-6502041/>                                     | cottonbro studio                | 0.5, 0.33                                                             |
| `workflow-design-*`           | workflow step 2                                                | <https://www.pexels.com/photo/unrecognizable-specialist-working-on-computer-in-modern-dental-clinic-7788368/> | Ivan Babydov                    | 0.5, 0.5                                                              |
| `workflow-make-*`             | workflow step 3                                                | <https://www.pexels.com/photo/crop-unrecognizable-dentist-making-dental-implant-in-laboratory-7788493/>       | Ivan Babydov                    | 0.5, 0.5                                                              |
| `workflow-smile-*`            | workflow step 4                                                | <https://www.pexels.com/photo/portrait-photo-of-woman-smiling-3791554/> (original)                            | Andrea Piacquadio               | 0.45, 0.66; 2.8                                                       |
| `dentist-1-*`                 | demo dentist 1                                                 | <https://www.pexels.com/photo/portrait-of-doctor-15752232/> (original)                                        | Yasin Aydın                     | 0.5, 0.32; 1.3                                                        |
| `dentist-2-*`                 | demo dentist 2                                                 | <https://www.pexels.com/photo/smiling-doctor-with-file-15641079/>                                             | Tran Nhu Tuan                   | 0.5, 0.3                                                              |
| `dentist-3-*`                 | demo dentist 3                                                 | <https://www.pexels.com/photo/middle-aged-doctor-in-white-apron-5531446/>                                     | Kevin Steven Ortega Eliett      | 0.5, 0.35                                                             |
| `voice-1-*`                   | patient voice poster 1                                         | <https://www.pexels.com/photo/smiling-young-woman-outdoor-portrait-35555197/> (original)                      | DΛVΞ GΛRCIΛ                     | 0.49, 0.5; 3                                                          |
| `voice-2-*`                   | patient voice poster 2                                         | <https://www.pexels.com/photo/woman-s-face-3402510/>                                                          | cottonbro studio                | 0.6, 0.5; 2                                                           |
| `voice-3-*`                   | patient voice poster 3                                         | <https://www.pexels.com/photo/portrait-of-a-smiling-man-12871449/> (original)                                 | Andreas Ellegaard (Skildring)   | 0.5, 0.62; 3                                                          |

Not filled on purpose: the before/after pair (two stock photos would claim a
treatment result), the address and wayfinding photos and the static map (a
stock building would mislead a visitor looking for the clinic), and the
profile photo of a published dentist (a real dentist never gets a stock face).
