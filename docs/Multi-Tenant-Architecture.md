# Multi-Tenant Manufacturer Architecture

Eclipse is a white-label, multi-tenant platform. A **tenant = one product
line** (Eclipse, Shiloh, Aspect, …) with its own branding, catalog, pricing
rules, construction set, and locale. Onboarding a new manufacturer requires
**zero code changes** — only a data import and configuration.

## Core principle

Manufacturer-specific behavior lives in **data and configuration, never in
code**. `if (manufacturer === 'x')` is a bug — the answer is a field on the
tenant object. The single switchboard is
[`eclipse-pricing/src/tenants/registry.js`](../eclipse-pricing/src/tenants/registry.js);
its header documents the full tenant schema.

## What a tenant owns

| Surface | Tenant field | Consumed by |
|---|---|---|
| Picker label / subtitle | `branding.lineLabel/.lineSub` | App cabinet-line picker (derives from `listTenants()`) |
| Order headers & form codes | `branding.manufacturerName/.formCodePrefix` | orderPackage (ECL-SO-CS → ASP-SO-CS) |
| Schedule / quote labels | `branding.scheduleHeader/.lineDescriptor` | App layout + quote tabs |
| Pricing provenance banner | `branding.catalogNote` | quote banner (interim/scraped disclaimers) |
| Catalog lookup | `catalog.find/.search/.list/.count` | skuResolver (active tenant), Design Studio browser, pricing |
| Authoritative dims/counts | `official` (nullable) | catalog browser rich rows, door/drawer counts |
| Construction systems | `constructions[]` + `defaultConstruction` | construction picker (keys into `constructionProfiles.js`) |
| Validation gates | `validation.styleCompat` | order readiness (door×species×finish matrix) |
| Price fallback line | `pricing.fallbackTenant` | resolver family search + `_fallback` quote flags |
| Cover-sheet variants | `coverFields` | order package field 10 |

## Onboarding a new manufacturer (zero code)

1. **Ingest the spec book:**
   `node tools/ingest-spec-book.mjs <book.pdf> --config tools/tenant-configs/<id>.ingest.json --out eclipse-pricing/src/tenants/packages/<id>.package.json`
   The ingest config is the operator's mapping: branding, page ranges,
   parser choice (`matrix` for W.W.-style width×height tables, `rows` for
   line-per-SKU books), SKU-prefix→type rules, price sanity bounds. The
   validator fails the run on duplicate-SKU price conflicts, unpriced rows,
   or thin extraction.
2. **Register it (configuration):** add the package to
   `eclipse-pricing/src/tenants/packages/manifest.js`. The brand appears in
   the UI picker, prices through the resolver, and flows to order forms
   automatically.
3. **Add eval fixtures:** create `evals/<id>/catalog-sanity.eval.mjs` with
   spot prices verified by eye against the spec book (and a golden order
   fixture when a real acknowledgment exists). The generic suite (registry
   contract, catalog integrity, resolver round-trip) runs for every tenant
   with no new code.
4. **Gate:** `node evals/run.mjs <id>` green + full test suites green +
   `vite build` clean before deploy.

## Eval harness

`node evals/run.mjs [tenantId]` — exit 1 on any failure.
- **Generic suite** (every tenant, free): registry contract, sampled
  catalog find/price integrity, resolver round-trip, search smoke.
- **Fixtures** (`evals/<tenant>/*.eval.mjs`): golden orders against real
  acknowledgments — Eclipse: Mautz $19,746.06 ack (35 lines to the penny);
  Shiloh: 27 Soderstrom-verified prices (native, no fallback); Aspect:
  spot prices from the v18.3.0 pages.

## Proven by

The third tenant (**Aspect**, 1,203 SKUs) was onboarded entirely through
this pipeline from `aspect_interactive_catalog_v1830.pdf` — config + data
only, no code edits outside the manifest list.
