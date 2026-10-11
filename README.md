# Sefid Dental Clinic Website

Custom Persian (RTL) website for کلینیک دندانپزشکی سفید, a digital dental
clinic in south Tehran. Rebuilt from scratch for mobile-first conversion,
SEO and a premium, calm brand experience.

## Status

Discovery complete. The build runs in ten gated phases. Each phase has a
prompt in `docs/prompts/` and ends with a report in `docs/reports/`.

## Where things live

| Path | Purpose |
|---|---|
| `docs/brief.md` | Source of truth: facts, scope, constraints, quality bar, decisions |
| `docs/design-direction.md` | Visual and motion rules until `docs/design/DESIGN.md` exists |
| `docs/architecture.md` | Stack, hosting, data model, pipelines |
| `docs/seo/plan.md` | Keyword clusters, URL structure, schema, local SEO, migration |
| `docs/content/` | Service taxonomy, clinic facts, copy guidelines, content gaps |
| `docs/prompts/` | Master prompt and one prompt per phase |
| `docs/reports/` | Phase reports |
| `docs/qa/` | Screenshots and audits |
| `content/` | Brand assets, reference screenshots of the old site, client data to import |

## Running a phase

Open a new session on `main`, then:

```
Read docs/prompts/00-master.md completely, then execute docs/prompts/01-discovery.md.
```

Replace the phase file for later phases. The application code arrives in
phase 3; setup instructions are added to this file then.
