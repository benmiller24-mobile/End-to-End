# Kitchen Design Engine — project context

You are working on the **Eclipse Kitchen Designer** — a dealer kitchen/bath design + quoting web app for Pinnacle Sales.

## What it is
A configurator that takes a room (walls, appliances, prefs) → solves a cabinet layout → renders a **floor plan**, **interior elevations**, a **3D view**, and an **AI photoreal render**, and produces a **priced quote**. It is a **white-label multi-tenant platform**: a tenant = one product line. Built-ins: **Eclipse** (frameless/European) and **Shiloh** (framed, 9 overlay+inset constructions); **Aspect** (frameless value line) is onboarded as a pure data package.

## Repo, stack, deploy
- GitHub: `benmiller24-mobile/End-to-End`, branch `main`. Netlify: `endtoendeclipse.netlify.app`.
- Frontend: **React + Vite** in `frontend/`. Solver: **`eclipse-engine/`** (pure Node ESM). Pricing: **`eclipse-pricing/`**. Serverless: **`netlify/functions/`** (Netlify Functions v2, `export const config = { path: '/api/...' }`).
- Build: `cd frontend && npm install && npm run build`. Dev: `netlify dev` (needed for `/api/*`); plain `vite` won't proxy the functions.
- Tests (run from `eclipse-engine/`): `node test-pricing.js` (must stay **153/0**), `node test.js`, `node test-patterns.js` (194/5 — the 5 are pre-existing lazy-susan/half-moon), `node test-configurator.js` (177/8 pre-existing price/family expectations). Root `npm test` chains several.

## Architecture map (the files you'll touch most)
- `eclipse-engine/src/solver.js` — the whole solver. `solve(input)` where input = `{layoutType, roomType, walls[], appliances[], island, prefs}` (note: templates store this under `.input`). Per-wall 1D packer; emits `walls[]`/`uppers[]`/`talls[]`/`island`/`placements[]`, each cabinet carrying `sku, position, width, _elev{yMount,height,depth,zone}`. Key passes: `normalizeSinkPlacement`, `fitIslandToRoom`, `centerCookingZone`, `featureRangeWall` (prefs.featureHood), `scoreAgainstTraining` (TRAINING_PROFILES).
- `eclipse-engine/src/constraints.js` — NKBA rules, depths, fillers, validations.
- `eclipse-engine/src/templates.js` — 36 templates (`.input`).
- `frontend/src/ElevationView.jsx` — **the big SVG elevation renderer** (PRONORM-quality shop drawings). Front rules live here: `parseDoorDrawer(sku,width)`, `doorCount(width)` (no door > ~24″), `frontTypeOf` (glass/mullion/wine/open). `CabFront` draws each cabinet front and is **construction-aware** (frameless reveal vs framed face-frame overlay/inset), with special branches for blind corners and vanity-combination cabinets. SVGs carry `data-pdf="elevation|section|floorplan"`.
- `frontend/src/FloorPlanView.jsx` — plan renderer + the per-wall world-frame logic (angle 0/90/180) that the 3D view reuses.
- `frontend/src/Kitchen3DView.jsx` — **Three.js** deterministic 3D from the solver geometry (`three@0.160`), plus an img2img "photoreal" button.
- `frontend/src/LeonardoRenderer.jsx` — AI render tab; `buildPrompt()` derives a design-accurate, per-wall prompt; ControlNet/img2img via the function.
- `frontend/src/constructionProfiles.js` — 10 profiles (`eclipse_frameless` + 9 Shiloh). Drives depths, reveals, face-frame, overlay/inset, overlay charges. `materials.frameStyle` selects it; `materials.brand` = eclipse|shiloh. (NB: `materials.construction` is a *different* field = box material Standard/Plywood.)
- `eclipse-pricing/src/` — `pricingEngine.js` (W.W. Wood "C3" formula), `skuCatalog.js` (Eclipse `RAW_SKU_DATA`), `shilohSkuCatalog.js` (`findShilohSku`, Shiloh-first then Eclipse fallback). App pricing is brand-aware via `setPricingBrand()` + `findSkuNormalized` in `App.jsx`.
- `netlify/functions/leonardo.js` — `/api/leonardo`; reads the Leonardo key from the Netlify env var `LEONARDO_API_KEY` (no embedded fallback); modes: photoReal, edge-ControlNet, img2img.

## MULTI-TENANT RULES (non-negotiable)
- **Never write `if (brand === 'x')` / `=== 'shiloh'` / `=== 'eclipse'` in code.** Manufacturer-specific behavior is a FIELD on the tenant object — `eclipse-pricing/src/tenants/registry.js` documents the schema (branding, catalog interface, constructions, validation gates, price fallback, cover-sheet variants). If a tenant needs new behavior, add a config field with a default, not a conditional.
- All catalog/pricing lookups go through the ACTIVE TENANT (`setPricingBrand(id)` → `setActiveTenant`); UI brand surfaces (picker, order form codes, schedule headers, provenance banners) derive from `getTenant(...)`/`listTenants()`.
- **Onboarding a manufacturer = data + config only:** `tools/ingest-spec-book.mjs` (PDF spec book → validated tenant package JSON) → list the package in `tenants/packages/manifest.js` → add eval fixtures in `evals/<id>/`. See `docs/Multi-Tenant-Architecture.md`.
- **Evals run per tenant:** `node evals/run.mjs [tenant]` — generic suite (registry contract, catalog integrity, resolver round-trip) runs for every tenant automatically; golden-order fixtures live per tenant (Eclipse: Mautz ack to the penny; Shiloh: Soderstrom-verified; Aspect: spec-book spot prices). Adding a tenant means adding its fixtures. Keep evals green alongside the test suites before any deploy.

## Conventions & gotchas
- Cabinet fronts are rendered by **family rule** (SKU prefix + width), **not per-SKU art** — fix the rule, not 7,500 SKUs. Examples: `B3D/B4D/B2TD`=drawer base; `SB/VSB`=sink (false front+doors); `BBC/WBC`=blind (access door + blind panel); `BL/BLS/BA`=lazy-susan/angle; `BWDMA`=waste (doors, no drawer); `BWR/WWR/WR`=wine; `VCSD/VSD/VCSB`=vanity combination (column split: sink door + drawer bank). Door pulls: **base = top, upper = bottom**.
- Uppers are **top-anchored** to a common datum (`upperTopAFF`), not bottom-anchored; over-fridge `RW` cabinets mount higher (`_elev.yMount`) and are deeper (`_elev.depth` ~27″). Read the real ceiling from `_inputWalls[0].ceilingHeight` (not `metadata`).
- **Render-verify without a browser:** SSR-bundle `ElevationView`/`FloorPlanView` with esbuild (`--format=esm --platform=node`, banner shim for `require`/`import.meta`), render to string, extract the `<svg data-pdf=...>`, rasterize with **`@resvg/resvg-js`** (NOT cairosvg — it blanks the SVG), then view the PNG. `feTurbulence` works in resvg. You **cannot** verify WebGL (Three.js) or live Leonardo headless — those need the deployed site.
- Pricing for **Shiloh is interim** (scraped from `shiloh_catalog_v342` PDF, ~4,989 SKUs + 27 Soderstrom-verified lines) pending the official price CSV; the tenant's `branding.catalogNote` carries the disclaimer. Eclipse pricing is verified against the Mautz acknowledgment ($19,746.06, 35/35 lines); keep `test-pricing` (153/0), `test-mautz`, and `evals/run.mjs` green.
- The uploaded catalog PDFs (`shiloh_catalog_v342_interactive 2.pdf`, `eclipse_catalog_v880_interactive.pdf`, brochures) are the source of truth for specs/drawings/prices.

## Current state (recently shipped)
Shiloh framed line + all 9 overlay/inset constructions; brand/construction UI; interim Shiloh pricing + brand-aware lookup; sculptural plaster hood + arched zellige niche; "feature the hood" (drops flanking uppers); 3D View (Three.js) + img2img photoreal pass; design-accurate AI prompt with per-wall composition; full elevation SKU audit + fixes (blind base/wall corners, waste base, wine, vanity combinations, angle corners, panels/mouldings, the "no door > 24″" rule). See the report docs in the project folder: `Shiloh-Integration-Plan.md`, `Elevation-Drawing-Audit.md`, `Pricing-Audit-Report.md`, `Current-Trends-Integration.md`.

## Likely next tasks
1. Load the **official Shiloh price CSV** → replace `SHILOH_RAW_SKU_DATA`, wire the 1¼″-overlay per-door charge, flip pricing from interim to verified (`Shiloh-Scraped-Prices-v342.csv` is there to diff).
2. Polish the **3D view** materials/lighting/camera and the **Leonardo** depth/img2img tuning (validate on the deployed Netlify site — can't be done headless).
3. Optional deeper **dimensional** drawing audit (toe heights, rail widths, drawer-face heights, mullion patterns) per cabinet family vs each catalog spec page.

## Working agreement
- After any renderer change, do the SSR→resvg render-verify and keep `test-pricing` at 153/0 and the frontend build clean before committing.
- Default to **Eclipse frameless** so existing behavior never regresses; Shiloh/framed is additive behind the brand selector.

## Security status
- The Leonardo key is read **only** from the Netlify env var `LEONARDO_API_KEY` — the embedded fallback was removed (2026-06-09). The old key is still in git history, so it must stay rotated/revoked at Leonardo; never re-add a key literal to the code.
- A GitHub PAT used during early development must remain revoked (GitHub → Settings → Developer settings → Tokens). Never commit tokens or keys.
