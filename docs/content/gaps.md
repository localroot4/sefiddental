# Content Gaps

Every `[[NEEDS_CLIENT: ...]]` marker in code or content has a row here.
Phases append rows; the client closes them. Status: open, received, done.

| # | Item | Needed for | Owner | Status |
|---|---|---|---|---|
| 1 | Vector logo: traced in-house to `content/brand/logo-horizontal.svg` and cleaned into `design/brand/logo-*.svg`; client approves the trace (see `docs/qa/phase-02/`) or sends the original vector | brand, favicon, intro | client | awaiting approval |
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
| 32 | Hosting: cPanel has the Node.js Selector but no Node version is installed ("No Node.js version is available. Please contact your hoster", plus "No such user" error, 2026-10-12). The host must enable Node 20 or 22 in the selector (CloudLinux alt-nodejs packages), or the client installs it through WHM root (CloudLinux Manager), else path A (Liara) | phase 3 | client | ticket to host pending |
| 33 | Screen recordings (30-60 s each) of immersive-g.com and hidokmeh.com from the client's phone and desktop, plus the exact address of the second site (address confirmed) | phase 2 taste calibration | client | open |
| 34 | Approve the 3D interpretation of the brand: the mark as a porcelain relief (`design/brand/3d/mark.glb`, prototype 00) and the stylized molar (`molar.glb`, prototype 0d); a licensed anatomical molar is an alternative for phase 7 | phases 7 and 8 | client | open |
| 35 | Pick home hero direction A (masked split) or B (full-bleed with floating booking card): `docs/qa/phase-02/hero-a-*.png`, `hero-b-*.png` | phase 4 | client | open |
