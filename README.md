# Sefid Dental Clinic Website

Custom Persian (RTL) website for کلینیک دندانپزشکی سفید, a digital dental
clinic in south Tehran. Rebuilt from scratch on Next.js with Payload CMS:
light, SEO-first content pages plus a cinematic, quality-tiered WebGL scroll
experience on the home page.

## Status

Phase 1 (discovery) is done. The build runs in ten gated phases. Each phase
has a prompt in `docs/prompts/` and ends with a report in `docs/reports/`.

## Where things live

| Path | Purpose |
|---|---|
| `docs/brief.md` | Source of truth: facts, scope, constraints, quality bar, decisions |
| `docs/experience-direction.md` | The home scroll experience: scenes, quality tiers, budgets |
| `docs/design-direction.md` | Visual rules and content-page motion until `docs/design/DESIGN.md` exists |
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
Read docs/prompts/00-master.md completely, then execute docs/prompts/02-design-system.md.
```

Replace the phase file for later phases. The application code arrives in
phase 3; setup instructions are added to this file then.
