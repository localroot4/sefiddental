# Sefid Dental Clinic Website

Custom Persian (RTL) website for کلینیک دندانپزشکی سفید, a digital dental
clinic in south Tehran. Rebuilt from scratch on Next.js with Payload CMS:
light, SEO-first content pages plus a cinematic, quality-tiered WebGL scroll
experience on the home page.

## Status

Phases 1 (discovery) and 2 (brand, design system and experience
storyboard) are done. At the phase 2 gate (2026-10-13) the client chose
home hero direction B (`docs/brief.md` decision 19). Phase 3 (foundation)
is next. It starts host-agnostic, because the host has not answered the
Node.js ticket (gap 32). The logo trace and 3D mark approvals are pending
(gaps 1 and 34). The build runs in ten gated phases. Each phase has a
prompt in `docs/prompts/` and ends with a report in `docs/reports/`.

## Where things live

| Path | Purpose |
|---|---|
| `docs/brief.md` | Source of truth: facts, scope, constraints, quality bar, decisions |
| `docs/experience-direction.md` | The home scroll experience: scenes, quality tiers, budgets |
| `docs/design/DESIGN.md` | The design system: tokens, type, components, RTL, motion, 3D look |
| `docs/design-direction.md` | The reasoning behind the design system |
| `docs/experience/storyboard.md` | Scene-by-scene board of the home journey with frames |
| `design/` | Tokens, fonts, brand SVGs and 3D assets, styleguide, prototypes, hero directions, vendored libraries |
| `docs/architecture.md` | Next.js, Payload, WebGL stack; hosting; data model; pipelines |
| `docs/ia.md`, `docs/conversion.md` | Sitemap and navigation; booking and emergency flows |
| `docs/discovery/` | Old-site audit, personas, KPIs, risks |
| `docs/seo/plan.md` | Keyword clusters, URL structure, schema, local SEO, migration |
| `docs/content/` | Service taxonomy, clinic facts, copy guidelines, content gaps |
| `docs/prompts/` | Master prompt and one prompt per phase |
| `docs/reports/` | Phase reports |
| `docs/qa/` | Screenshots and audits |
| `content/` | Brand assets, reference screenshots of the old site, client data to import |

## Running a phase

Open a new session on `main`, then:

```
Read docs/prompts/00-master.md completely, then execute docs/prompts/03-foundation.md.
```

Replace the phase file for later phases. The application code arrives in
phase 3; setup instructions are added to this file then.
