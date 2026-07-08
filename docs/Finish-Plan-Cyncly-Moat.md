# Finish Plan — ship the app on ground Cyncly can't follow

**Audience:** Claude (executor) + Ben (owner). This is the working roadmap to take the
app from "differentiators built" to "product finished," phase by phase, with file
anchors and acceptance gates. Execute phases in order; every phase ends with the
standing quality gates green (see Guardrails) and a deploy.

---

## 1. Strategic frame (why these phases and not others)

Cyncly (2020 Design Live → Design Flex, Spaces Flex, Content-in-Cloud) already ships:
AI image-to-design, LiDAR room scan, photoreal cloud rendering, a massive multi-brand
catalog library, and live manufacturer pricing integrations. **Do not chase parity on
rendering quality, catalog breadth, decorative libraries, or free-form CAD** — they win
those on accumulated content, and none of them close a sale alone.

Cyncly is structurally blocked in four places, because each one attacks a revenue pillar
(designer seat licenses ~$2,495/yr; the centralized paid catalog-content pipeline; brand-
neutral aggregation):

| # | Moat | Their block | Our asset (already in repo) |
|---|------|-------------|------------------------------|
| M1 | **The app designs it** — room in, priced kitchens out, no CAD operator | Can't make the designer optional without cannibalizing seats | `eclipse-engine/src/solver.js` (`solve()`), `evals/si/scoreKitchen.mjs` 5-metric scorer, 95-plan live corpus, `TRAINING_PROFILES` |
| M2 | **Competitor-quote judo** — any 2020 PDF becomes our counter-quote | Can't build a tool whose purpose is migrating users off their own format | `frontend/src/floorplanVector.js`, `decode2020.js`, in-app 2020 import + brand-aware Multi-Quote, `tools/price-2020.mjs` |
| M3 | **Penny-verified trust** — quotes reconciled against real factory acks, evals in CI | Can't guarantee accuracy across thousands of third-party catalogs they don't control | `frontend/src/ackReconcile.js`, `orderReadiness.js`, golden-order evals (Mautz 35/35, Soderstrom, 8 pronorm orders at 100%) |
| M4 | **Manufacturer-owned white-label** — a brand hands its dealer network *its own* app in days | Aggregator model forbids exclusive storefronts; content pipeline is slow/centralized/paid | Tenant registry + packages, `tools/ingest-spec-book.mjs`, `ingest-pronorm.mjs`, `frontend/src/ProductLinesManager.jsx`, `EmbedApp.jsx` + `/api/consumer-design` |

Every phase below finishes one moat. Anything that doesn't serve a moat is deferred.

---

## 2. Current-state audit (what's built vs. what "finished" needs)

Verified against the working tree, July 2026 — this supersedes CLAUDE.md's "Current
state" where they disagree:

- **M1 solver**: single best layout per solve; QA scorer + 95-plan corpus exist
  (`evals/si/`) but the app never shows *alternatives* or *reasons*. Gap: multi-option
  generation, explanation trace, dealer-level taste training.
- **M2 re-quote**: 2020 decode dialects proven on real orders (Wong, Mark&Jane,
  Mautz, Christiansen); Multi-Quote prices a competitor order in all lines. Gap: it's
  a sequence of steps, not one flow; no branded "counter-quote" deliverable PDF; dialect
  fixtures not all pinned as evals.
- **M3 trust**: ack parser calibrated to W.W. Wood confirmations (#45923/28/33);
  order-readiness gate live in dealer UX. Gap: ack format is W.W.-specific and must
  become tenant config (multi-tenant rule!); reconciled acks don't yet feed back into
  eval fixtures (the flywheel isn't closed).
- **M4 white-label**: in-app onboarding works but persists to **localStorage only**
  (`frontend/src/tenantLocal.js`) — one device, no team; package promotion to the repo
  manifest is manual. Consumer embed shipped (`EmbedApp.jsx`, CORS'd API). Gap:
  multi-device tenant store, eval scaffold auto-generation, per-tenant theming of the
  embed, Shiloh official price CSV still pending.
- **Product shell**: `lib/projectStore.js` is localStorage with a Supabase-shaped
  schema (`supabase/schema.sql` written, `lib/supabase.js` a placeholder). No auth, no
  shareable quote links, no cross-device projects.
- **Stale docs**: CLAUDE.md still says pronorm pricing "not yet verified against an
  order ack" — it now reconciles 8 real orders at 100%. Fix in Phase 0.

---

## 3. Phases

### Phase 0 — Baseline lock & doc truth (≈½ session)

Goal: a trustworthy starting line so later phases can detect regressions.

1. Run and record the full gate: `cd eclipse-engine && node test-pricing.js` (153/0),
   `node test.js`, `node test-patterns.js`, `node test-configurator.js`,
   `node evals/run.mjs` (all tenants + `_cross`), `node evals/si/run-corpus.mjs`
   (record the current pass-rate as the floor), `cd frontend && npm run build`.
2. Update CLAUDE.md: pronorm order-ack limitation is resolved (8 orders, 100%);
   add the new modules (ackReconcile, orderReadiness, ProductLinesManager, EmbedApp,
   consumer-design API, evals/si) to the architecture map; point "Likely next tasks"
   at this document.
3. Acceptance: all suites at or above recorded counts; build clean; CLAUDE.md truthful.

> **Phase 0 record (2026-07-08) — DONE.** Floors locked: test-pricing **153/0**,
> test.js **31/0**, test-patterns **194/5** (pre-existing), test-configurator
> **177/8** (pre-existing), `evals/run.mjs` **325/0**, si corpus
> **180/180 (100%)**, frontend build clean. Two defects found and fixed en route:
> (1) the si design metric scored corner units as zero fill — the eval had only
> ever been green because pre-`c3ec705` short-code kitchens skipped corner
> resolution entirely; scorer now credits both corner legs and treats open-corner
> wedges as unbuildable (out of the denominator). (2) `generateMountingRails` was
> silently skipped for every kitchen since integration — the solver passed walls
> keyed `id` where the module expects `wallId`, and per-wall layout objects where
> it expects a flat cabinet list. Rails now generate (probe: 3 rails on a U).

### Phase 1 — Productize the re-quote weapon (M2) (≈1–2 sessions)

The smallest gap with the biggest demo payoff. Target experience: **drop any 2020
design PDF → 60 seconds later a branded "Competitive Re-Quote" sheet: their design,
reconstructed, priced in every line we carry, with the delta.**

1. **One flow, not steps.** In `FloorplanImport.jsx`, when the vector path identifies a
   2020/Cyncly PDF, chain automatically: decode dialect → reconstruct walls+cabinets →
   resolve SKUs per tenant (`skuResolver.js`) → Multi-Quote across `listTenants()`
   (respecting `capabilities.autoSolve` and price groups) → land on a comparison view.
   No dead ends: cabinets that don't resolve in a line appear as explicit "no
   equivalent — nearest: X" rows, never silently dropped.
2. **The deliverable.** New `CounterQuote` PDF section in `pdfExport.js`: side-by-side
   (source order vs. each line), per-line savings, tenant branding from
   `getTenant().branding`, and the budget-grade watermark (imported dims are
   customer-supplied — the `orderReadiness.js` gate stays in force).
3. **Pin the dialects.** Promote each proven decode (Wong, Mark&Jane, Mautz,
   Christiansen) to golden fixtures in `evals/_cross/floorplan-vector.eval.mjs` (or a
   sibling `requote.eval.mjs`): exact wall dims, cabinet count, and total per line.
   A dialect regression must fail evals, not a demo.
4. Acceptance: all four fixtures reconstruct and price exactly; SSR→resvg render-verify
   on the comparison view's plan/elevations; Phase 0 gates green.

> **Phase 1 record (2026-07-08) — DONE.** Shipped: `frontend/src/counterQuote.js`
> (pure, eval-pinned multi-line re-quote with exact/normalized/substituted/missing
> grades — nothing silently dropped), `CounterQuotePanel` in App.jsx (auto-appears
> on the quote step whenever a design was imported with cabinets; per-line totals,
> deltas suppressed across currencies, attention rows, one-click PDF),
> `exportCounterQuotePDF` in pdfExport.js (BUDGET watermark on every page, per-line
> interim-pricing notes), and import provenance (`importMeta`) threaded from
> FloorplanImport → App. New eval `evals/_cross/counter-quote.eval.mjs` (18 checks:
> Mautz re-quotes in all 3 lines, Eclipse fully exact/normalized, pronorm misses
> surface as explicit rows, deltas currency-safe, deterministic). One resolver gap
> found + fixed: island sink label `IWS30`/`IBS36` now maps to the SB sink-base
> family instead of the filler catch-all. Floors: evals now **343/0**; engine
> suites unchanged; build clean. NOTE: Wong / Mark&Jane order PDFs were priced
> live during development but never committed as fixtures — only Mautz, Wilterding,
> Christiansen (vision-routing) and BD475 (order-doc rejection) are pinnable from
> the repo. To pin more dialects, drop the source PDFs' positioned-page JSON into
> `evals/_cross/fixtures/` (see `tools/extract-order-pages.mjs`).

### Phase 2 — "The app designs it, three ways, and explains itself" (M1) (≈3–4 sessions)

The flagship. Cyncly's AI accelerates a designer; ours replaces the blank canvas.
Target experience: room + appliances + prefs → **three complete, distinct, priced,
NKBA-validated options, each with a plain-English rationale** — usable by a counter
salesperson with zero CAD training.

1. **Candidate generation** (`eclipse-engine/src/solver.js`): a `solveOptions(input,
   {count: 3})` wrapper that runs `solve()` under distinct *lenses* — e.g.
   storage-first (maximize drawer bases/talls), budget-first (value SKUs, fewer
   modifications), feature-first (featureHood, glass uppers, island upgrades) — by
   varying `prefs` systematically, NOT by randomness (determinism is a feature; no
   `Math.random`). Dedupe near-identical results by placement signature.
2. **Scoring & ranking**: reuse `evals/si/scoreKitchen.mjs` (move the pure scorer into
   `eclipse-engine/src/` so both evals and app import one copy) + existing
   `scoreAgainstTraining`. Rank, keep top 3 distinct.
3. **Explanation trace**: thread a `decisions[]` log through the named solver passes
   (`normalizeSinkPlacement`, `centerCookingZone`, `featureRangeWall`,
   `fitIslandToRoom`, corner handling): each entry `{pass, rule, text}` with NKBA rule
   references from `constraints.js`. Surface as a "Design rationale" panel per option
   and a paragraph on the PDF cover sheet. This is the anti-black-box move Cyncly's
   one-click AI can't match.
4. **Dealer taste training**: promote `TRAINING_PROFILES` weights to tenant/dealer
   config (a field with a default, per the multi-tenant rules — never a brand
   conditional). Add a "prefer this option" action that nudges the stored weights
   (persisted via projectStore; Supabase later in Phase 5).
5. **UI**: option cards (mini floor plan via `FloorPlanView`, subtotal, 3-bullet
   rationale) at the top of the design flow; one click adopts an option into the
   existing tabs. The embed (`EmbedApp.jsx` / `/api/consumer-design`) gets the same
   three options — that's the consumer hook.
6. Acceptance: 3 valid distinct options for all 36 templates (`templates.js`) and for
   the si corpus without dropping its recorded pass-rate; deterministic across runs;
   `test-pricing` 153/0; render-verify one option's elevations.

> **Phase 2 record (2026-07-08) — DONE.** Shipped: `eclipse-engine/src/designOptions.js`
> (`solveOptions` — 4 deterministic lenses: Balanced / Storage-first / Feature /
> Value-engineered; dedupe by placement signature; ranked by validation cleanliness +
> training fit; Balanced always the reference); a `decisions[]` rationale trace in
> solver.js (`noteDecision`) at the real choice points — layout read, sink relocation
> (window / island / longest-run, DW follows), corner treatment with the 30% guard and
> open-corner reservations, island fit vs NKBA aisles, cooking-zone re-centering,
> feature-hood — with NKBA citations; App: `DesignOptionsPanel` (option cards with
> MiniPlan schematics, per-option price, closest-real-project match, 3 rationale
> bullets, one-click adopt), `DesignRationalePanel` ("Why this design"), DESIGN
> RATIONALE section on the exported proposal PDF, and dealer taste memory (adopted
> lenses vote; future solves surface that lens first — device-local counts, no model).
> New eval `evals/_cross/design-options.eval.mjs`: every template ≥2 distinct options,
> ≥75% of kitchens get 3 (compact/single-wall rooms legitimately converge — fake
> choices are never padded in), all explained, deterministic, NKBA cited. Verified by
> SSR-rendering MiniPlan + the panel headlessly (no NaN, real boxes/prices). Floors:
> evals **352/0**, si corpus 180/180, engine suites unchanged, build clean.
> Honest scope cuts: (1) the scorer stays in `evals/si/` — moving it into the engine
> would drag tenant-catalog imports into a pure package; ranking uses engine-side
> signals instead. (2) Options are gated off for metric/realize tenants and the
> consumer embed for now — realization is per-design, and the embed can't be verified
> headless; both are follow-ups, not silent gaps.

### Phase 3 — Close the trust flywheel (M3) (≈1–2 sessions)

Target: **every real factory acknowledgment a dealer pastes in becomes a permanent
regression test**, and the ack parser stops being manufacturer-specific.

1. **Tenant-config ack formats**: extract the W.W. Wood parsing specifics in
   `ackReconcile.js` (SKU line shapes, footer labels) into an `ackFormat` field on the
   tenant schema in `registry.js` with the current behavior as default — the
   multi-tenant rules forbid the current hardcoding as soon as a second format shows
   up. pronorm's order-confirmation format (already parsed in
   `tools/reconcile-pronorm-order.mjs`) becomes the second config, proving the shape.
2. **Fixture promotion**: after a reconciliation with zero variance, offer "Save as
   eval fixture" → downloads a golden-order JSON in the exact shape
   `evals/<tenant>/` consumes, ready to commit. Document the loop in
   `docs/Multi-Tenant-Architecture.md`.
3. **Finish order-readiness**: audit `orderReadiness.js` checks against the Dealer Hub
   SOP list; wire any check currently stubbed; ensure the embed/consumer path can never
   reach an order-grade package (budget watermark permanent there).
4. Acceptance: #45923/28/33 and one pronorm ack reconcile in-app to the penny through
   the config-driven parser; a promoted fixture runs green under `evals/run.mjs`;
   zero brand conditionals introduced (grep gate: `if.*brand.*===`).

> **Phase 3 record (2026-07-08) — DONE.** Shipped: tenant `ackFormat` config
> (schema + `DEFAULT_ACK_FORMAT` in registry.js — all regex SOURCES as strings so
> a pure-JSON package can carry a complete format; `listFactor` normalizes
> discounted confirmations to list). `ackReconcile.js` now has two config-driven
> strategies: `anchoredTotal` (the calibrated W.W. default) and `numberedRows`
> (pronorm's EU-decimal 50%-discount rows, added to pronorm.package.json as pure
> data — proving the second-format shape). Flywheel closed:
> `buildGoldenOrderEval` + an in-app "Save as regression fixture" button on every
> zero-variance reconciliation — pins each acknowledged line the live resolver
> reproduces to the penny, in the exact `evals/<tenant>/order-*.eval.mjs` shape,
> ready to commit. New eval `_cross/ack-formats.eval.mjs` (26 checks) covers both
> parsers, EU normalization, clean/variance reconciles, tenant config presence,
> and EXECUTES the generated fixture's assertions. Order-readiness audit: all 9
> checks are real (none stubbed) and key on tenant fields — no changes needed
> beyond a stale comment. The brand-conditional grep gate caught one real
> violation (EmbedApp `brand === 'pronorm'` hardware + a brand-keyed frame map):
> replaced with a `consumer: {frameStyle, hardware}` tenant field (defaults in
> registry; shiloh keeps its 1¼" embed look, pronorm keeps bar pulls — behavior
> byte-identical). Floors: evals **378/0**, build clean.

### Phase 4 — Self-serve manufacturer onboarding, team-wide (M4) (≈2 sessions)

Target: **a manufacturer rep uploads a spec book and price list; a validated,
eval-scaffolded, disclaimered line exists for their whole team the same day.** This is
the direct attack on Content-in-Cloud's queue.

1. **Shared tenant store**: replace localStorage-only persistence in `tenantLocal.js`
   with the Supabase adapter (`tenant_packages` table added to `supabase/schema.sql`;
   `lib/supabase.js` becomes real). Keep localStorage as the offline/no-infra fallback
   — same interface, adapter chosen by environment.
2. **Eval scaffold on ingest**: when `ProductLinesManager` registers a line, emit an
   `evals/<id>/` scaffold (registry-contract + catalog-integrity run automatically
   already; generate a TODO golden-order fixture template + spec-book spot-price
   fixture pre-filled from the ingest validation report, like Aspect's).
3. **Provenance honesty**: auto-set `branding.catalogNote` interim-pricing disclaimers
   for scraped/ingested prices; the note clears only when a golden order reconciles
   (Phase 3 flywheel). Surface provenance in the quote header, not buried.
4. **Embed theming**: per-tenant colors/logo/fonts from `branding` applied to
   `EmbedApp.jsx` so the white-label story is visible ("this is *Aspect's* designer").
5. **Standing task**: when the official Shiloh price CSV arrives — replace
   `SHILOH_RAW_SKU_DATA`, wire the 1¼″-overlay per-door charge via the construction
   profile's overlay-charge field, diff against `Shiloh-Scraped-Prices-v342.csv`, flip
   the disclaimer. (Blocked on data, not code — do not let it block other phases.)
6. Acceptance: onboard a test line end-to-end from the UI, see it from a second
   browser profile; generic eval suite green for the new tenant; Eclipse default
   behavior byte-identical (no regression in existing suites).

> **Phase 4 record (2026-07-08) — DONE.** Shipped: honest Supabase client
> (`lib/supabase.js` — `supabaseConfigured` + lazy `getSupabase()`, null when the
> env is absent; no more garbage-placeholder client); team tenant store in
> `tenantLocal.js` (save/remove upsert/delete to a new `tenant_packages` table,
> `syncTeamTenantPackages()` pulls the dealership's lines at startup in both the
> dealer app and the embed — localStorage behavior unchanged and still the
> offline path); `tenant_packages` schema + RLS (team-wide read, owner write)
> appended to `supabase/schema.sql`; eval-scaffold generator
> (`frontend/src/evalScaffold.js` + an "⤓ Eval scaffold" button in
> ProductLinesManager) emitting a ready-to-commit `catalog-sanity.eval.mjs` with
> deterministic ingest-sampled spot prices and the golden-order TODO that the
> Phase-3 flywheel later fulfils; white-label embed theming (tenant palette gold
> + "<Line> Designer" masthead from branding — no code per brand). Provenance
> disclaimers were already auto-set at ingest (verified, not re-built). New eval
> `_cross/onboarding.eval.mjs` (14 checks) executes a generated scaffold's
> assertions against the live Aspect tenant. Floors: evals **392/0**, build
> clean, pricing 153/0. Cross-device acceptance can't be exercised headless
> (needs a provisioned Supabase project) — the code path is env-gated and
> no-ops cleanly without it; first live check happens on the deployed site.
> Standing task unchanged: official Shiloh price CSV is still blocked on data.

### Phase 5 — Product shell: persistence, sharing, identity (≈2–3 sessions)

What makes it a product a dealership adopts, and the layer where nothing Cyncly-shaped
exists at our price point (free-to-dealer, manufacturer-funded).

1. **Supabase persistence for projects**: implement the adapter `projectStore.js` was
   designed for (schema already written: projects → rooms → revisions). localStorage
   remains the fallback; `revisions.js` function already exists server-side.
2. **Auth**: Supabase auth (email magic-link is enough) scoping projects per dealer;
   tenant visibility per account (a dealer sees the lines they carry).
3. **Shareable quote links**: read-only URL rendering plan + elevations + priced quote
   (budget watermark rules intact) — the homeowner-facing artifact a salesperson sends
   after the counter visit. Reuse the SSR-able views; no login required to view.
4. **Deploy checklist** (document in README): Netlify env vars `LEONARDO_API_KEY`,
   `ANTHROPIC_API_KEY`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`; functions v2 paths; embed
   CORS origins. Never a key in code (standing security rule).
5. Acceptance: save → reload across devices; share link opens logged-out; existing
   single-device flow unchanged when Supabase env is absent; all gates green.

> **Phase 5 record (2026-07-08) — DONE.** Shipped: cloud project persistence
> (`projectStore.js` mirrors every save/delete/revision to a new
> `project_snapshots` table — denormalized to the app's own record shape, RLS
> owner-only, `updated_at_ms` as the sync tiebreaker; `syncProjectsFromCloud()`
> merges newer-wins on sign-in and pushes local-only projects up); dealer
> sign-in (`AuthBadge` in the header — Supabase magic link, appears only when
> the env is configured, triggers project sync, "N projects synced" flash);
> customer share links (the "🔗 Customer link" button encodes the CURRENT
> design as `items` + estimate into the branded consumer embed URL — the embed
> grew a `buildManualResult` path so shared designs rebuild VERBATIM rather than
> re-solving, plus a budget-grade estimate band; read-only by design, no order
> path); README deploy checklist (env vars, Supabase setup, pre-deploy gate
> commands, embed notes). New eval `_cross/share-link.eval.mjs` pins round-trip
> fidelity: every placed cabinet survives seed → JSON → rebuild at its position.
> Floors: evals **397/0**, si corpus 180/180, all engine suites at floor, build
> clean. Live checks that need a deployed site + provisioned Supabase (magic-link
> email flow, true cross-device pull, embed on the FAKS page) remain the first
> post-deploy validation — the code paths are env-gated and no-op cleanly
> without configuration.

---

## 4. Standing guardrails (every phase)

- **Multi-tenant rules are law**: no `if (brand === ...)` ever; new behavior = tenant
  config field with a default. Grep before every commit.
- **Quality gates**: `test-pricing` 153/0 · `test.js` · `test-patterns.js` (194/5
  pre-existing) · `test-configurator.js` (177/8 pre-existing) · `node evals/run.mjs`
  all tenants · si corpus ≥ Phase-0 floor · `npm run build` clean.
- **Render-verify** after any renderer change: SSR-bundle with esbuild → render to
  string → extract `<svg data-pdf=...>` → rasterize with `@resvg/resvg-js` → view.
- **Eclipse frameless never regresses**; everything new is additive behind
  tenant/capability flags.
- **Secrets**: keys live only in Netlify env vars. The old Leonardo key and the early
  GitHub PAT stay revoked.
- **Determinism**: no randomness in the solver or option generation; same input →
  same three options.

## 5. Deliberate non-goals (don't build)

Photoreal-rendering parity with Cycles; thousand-brand catalog breadth; decorative/
appliance 3D libraries; free-form CAD (odd angles, custom millwork); LiDAR capture
(the vision floorplan path + field-verify workflow covers measurement honestly);
native mobile apps.

## 6. Definition of finished

A counter salesperson can: import a competitor's 2020 PDF **or** sketch a room →
get three explained, priced options in any carried line → send the homeowner a share
link → field-verify dims → pass the order-readiness gate → export an order package →
paste the factory ack and reconcile to the penny — while a manufacturer can onboard
its line from a spec book and hand the branded embed to its dealer network, without
Ben (or Cyncly's content team) in the loop. Every step above is covered by an eval
or test that runs green.
