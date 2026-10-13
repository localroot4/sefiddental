# Content Gaps

Every `[[NEEDS_CLIENT: ...]]` marker in code or content has a row here.
Phases append rows; the client closes them. Status: open, received, done.

| # | Item | Needed for | Owner | Status |
|---|---|---|---|---|
| 1 | Vector logo: traced in-house to `content/brand/logo-horizontal.svg` and cleaned into `design/brand/logo-*.svg`; client approves the trace (side by side with the original PNG: `docs/qa/phase-02/logo-trace-approval.png`, sent 2026-10-13) or sends the original vector | brand, favicon, intro; the vertical and white variants (row 23); launch | client | awaiting approval: asked at the phase 2 gate, no answer on 2026-10-13; listed again as pending, not as a new question: the phase 3 hand-off shows the final asset `design/brand/logo-horizontal.svg` beside the client's original PNG (`content/brand/logo-horizontal.png`), with a yes or no; phase 3 uses the trace as is; launch needs an explicit yes or the original vector |
| 2 | Dentists: name, specialty, council number, degree, photo, bio, services | dentists pages, E-E-A-T | client | open |
| 3 | Clinic license number and technical supervisor | footer, legal | client | open |
| 4 | Real photos: exterior, reception, rooms, team, equipment | every page | client | open |
| 5 | Videos: clinic tour, the three testimonial videos | home, testimonials | client | open |
| 6 | Before/after pairs with consent, labeled by service | gallery, service pages | client | open |
| 7 | Equipment list, only if "digital" claims should name devices | about, services | client | open |
| 8 | Financing partner names and exact terms; confirm 200M and 100M | pricing page | client | open |
| 9 | WhatsApp and Telegram numbers, Instagram handle | contact, sticky bar | client | open |
| 10 | Hosting facts: provider, PHP version, SSH, cron, Node, docroot | phase 3 deploy | client | open |
| 11 | Old site backup and URL list | 301 map, content import | client | open |
| 12 | Google Business Profile created; Search Console and GA4 IDs | phase 6 and 10 | client | open |
| 13 | Parking and public transport notes; secondary neighborhoods | contact, local SEO | client | open |
| 14 | "From" prices per service and per restoration tier, if shown | pricing, tiers | client | open |
| 15 | Confirm the four stats from the old site (13 years, 7 dentists, 4 clinics, 10 insurers) | trust band | client | open |
| 16 | Confirm the mobile number is the WhatsApp and Telegram number | sticky bar | client | open |
| 17 | Is the first consultation free? | booking chips, hero copy | client | done: yes, behind a feature flag |
| 18 | Callback promise and caller number | booking success copy | client | done: usually 5-10 minutes; both are admin settings |
| 19 | Emergency: can staff call urgent requests first at opening time («در اولین ساعت کاری»)? | emergency copy | client | open |
| 20 | Name on the clinic signage | NAP consistency | client | done: «کلینیک دندانپزشکی سفید» plus the logo |
| 21 | Is the new host in Iran or abroad? Is inbound traffic from outside Iran open (Googlebot)? | risk R1, phase 3 | client | open |
| 22 | Video files from the old site: clinic tour (about 48 s) and three patient testimonials | home, testimonials | client | open |
| 23 | Logo variants: built in-house from the trace in `design/brand/` (horizontal, lockup without Latin, mark, wordmark, favicon set, OG template); a vertical lockup and a white version follow once row 1 is approved | header, footer, OG | in-house | partly done |
| 24 | Unidentified round social icon with a check mark in the old footer | footer socials | client | open |
| 25 | First-visit promise on the old site («پاکسازی ملایم» if needed): still true? | first-visit guide | client | open |
| 26 | Specialists on the team | GBP, service pages | client | deferred: the client adds dentists in admin; no specialist claims until then |
| 27 | Scope checks: wisdom-tooth surgery, gum grafts, clear aligners, digital smile design software | keyword map "(verify)" terms | client | open |
| 28 | Evidence for the «اولین کلینیک دیجیتال جنوب تهران» claim, or approval to keep it as a slogan at the client's risk | home H1, risk R6 | client | open |
| 29 | Profiles on nobat.ir, doctoreto.com, paziresh24.com: existing or to create | local SEO | client | open |
| 30 | Are bridges and complete dentures offered? (no page until confirmed) | services, keyword map | client | open |
| 31 | A nearby 24-hour dental center or hospital to name for closed-hours emergencies | emergency page | client | open |
| 32 | Hosting: cPanel has the Node.js Selector but no Node version is installed ("No Node.js version is available. Please contact your hoster", plus "No such user" error, 2026-10-12). The host must enable Node 20 or 22 in the selector (CloudLinux alt-nodejs packages), or the client installs it through WHM root (CloudLinux Manager), else path A (Liara) | the phase 3 deploy pipeline, the staging target and the chosen-path steps of `docs/deploy.md` (the rest of phase 3 builds host-agnostic, brief decision 21); settled before phase 7, whose hand-off needs a staging URL | client | open: ticket to host, no answer on 2026-10-13; if there is no answer by the end of the phase 3 build, the phase 3 hand-off asks the client to choose C1 or A |
| 33 | Screen recordings (30-60 s each) of immersive-g.com and hidokmeh.com from the client's phone and desktop, plus the exact address of the second site (address confirmed) | taste calibration at the phase 7 hand-off and in the phase 8 real-device checklist (moved from phase 2, brief decision 20) | client | open, optional |
| 34 | 3D interpretation of the brand: (a) approve the mark as a porcelain relief (`design/brand/3d/mark.glb`, prototype 00); (b) choose the molar: the stylized in-house molar (`molar.glb`, prototype 0d; free, built) or a realistic model under the sourcing rules of brief decision 22. At the phase 2 gate (a) had no answer and (b) was not understood; (b) was explained in plain Persian on 2026-10-13, with no new question. In phase 8 both molars are rendered side by side and the client picks one of the two pictures | phase 8 (the WebGL world; phase 7 uses DOM placeholders and the SVG stepper) | client | open: (a) awaiting approval; no draft is judged (brief decision 20), so the phase 8 hand-off asks again, not as a new question: the mark in the real scene next to the two molar pictures, with a yes or no; launch needs an explicit yes; (b) the in-house molar is the default until the client picks |
| 35 | Pick home hero direction A (masked split) or B (full-bleed with floating booking card): `docs/qa/phase-02/hero-a-*.png`, `hero-b-*.png` | phase 4 | client | done: B (2026-10-13, brief decision 19); A stays in the repo as an archived reference |
| 36 | Home hero photo for direction B (brief decision 19): an empty clinic interior (treatment room or reception) in natural light, no faces; landscape, at least 4000 px on the long side, plus a 4:5 crop from the same shoot for the phone photo band. From 744 px the scrim covers the start (right) side, the booking card the end (left) side and the trust band the bottom, so the key detail sits in the central and upper band. In the 4:5 crop the key detail sits in the top third, because the trust band covers the bottom 37-61% of the band (430 to 320 px). Brief: `docs/content/shot-list.fa.md` section ۰, row ۳۲ | home hero: the LCP image from 744 px and the phone photo band; the phase 4 judgment of the mark relief over the photo (removed by default if no real photo exists by phase 7) | client | open |
