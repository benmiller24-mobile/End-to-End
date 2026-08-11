# Auto-Design Rebuild Plan — from "valid" to "designed"

**Provenance:** synthesized 2026-08-11 from a 14-agent audit/research workflow:
5 internal audits (solver architecture, 96-kitchen output sweep, rendered-drawing
visual review, auto-vs-real-designer diff on the golden Mautz room, scorer
blind-spot analysis), 3 external research tracks (Cyncly's actual AI capability,
automated-layout state of the art, professional kitchen-design methodology), and
an adversarial verification pass in which every headline defect was independently
**reproduced by a second agent** before it entered this document. Where a claim
below carries file:line references or numbers, they were verified by running
`solve()` on real inputs in this repo.

---

## 1. The honest diagnosis: why auto-design has never felt right

The owner's instinct is correct and the 180/180 eval floor is not evidence to the
contrary — the eval loop is self-referential (the solver grades its own output,
and `severity=error` validations don't fail anything unless the rule name happens
to contain "NKBA"). A kitchen with **zero base cabinets scores 94/100** today.

### 1a. Structural: the solver is a packer, not a designer (all verified)

- **Greedy single pass, no global objective, no backtracking.** Each wall is
  solved independently after a fixed heuristic appliance-to-wall assignment
  (solver.js:480-517, 644-655). The work triangle and cross-wall balance are only
  *validated afterward*, never optimized. Reproduced: an ordinary 160″/130″
  L-shape yields a range "placed at 0 (wall too short)" error on a 160″ wall and
  a 368″ work triangle (NKBA max 312″) that ships with a warning.
- **Width selection is largest-first greedy; composition is never an objective**
  (constraints.js:1627-1679). Reproduced: `B42-RT | range | B16-RTL` (2.6:1
  flanks), a `B3D10` (10″ three-drawer base), a 4.7:1 flank at L=219. Across the
  96-kitchen sweep, **11.2% of all cabinets are ≤12″ wide** and 65/96 kitchens
  get a 9″ upper. Widths freeze at fill time, so every later symmetry pass can
  only *permute* boxes — the 42/16 flank is unfixable downstream by design.
- **Cross-phase state desync — the hood-off-range bug.** Four mirrors of
  placement truth (wallLayouts / appByWall / placements / _elev) reconciled by
  ad-hoc sync loops. `centerCookingZone` moves the range *after* the sync
  (solver.js:662-673 vs 703), so uppers read the stale position. Reproduced on
  2/36 stock templates: galley_island renders the hood 25.5″ off the range with
  a wall cabinet directly over 22.5″ of cooktop — while the decisions log says
  "Range re-centered."
- **~20 imported "expert" fixers are never called** (alignUppersToBase,
  enforceSymmetry, solveRoomExpert, insertWithCollisionCheck, …: grep count = 1,
  the import line). Phase 8-10 subsystems detect and warn; nothing redesigns.
  Three passes (part-id generator, style morphing, vertical alignment) **crash on
  every kitchen** and are swallowed by try/catch into info-level notes.
- **No room geometry model.** Corners are inferred from wall *array order*; the
  2D coordinate builder maps every wall after index 0 onto the same axis, so
  triangle math is fiction for U/G shapes (solver.js:8319-8331, 2016-2057).
- **Self-corruption bugs:** width fixes rewrite SKUs with `sku.replace(/\d+/,…)`
  — the first digit group of `B3D30` is the *drawer count*, so it becomes
  `B24D30` (verified in node). Duplicated WSC24-PH pushed per upper corner. An
  explicitly requested wall oven silently dropped. Talls emitted with
  `position=undefined` in 4 templates. 242.25″ packed onto a 240″ wall.

### 1b. Measured against reality: the Mautz test

We hold a real professionally designed kitchen (Mautz — the same golden order our
pricing locks to the penny). Auto-solving the *same room* reproduces roughly
**4 of the human designer's 16 material decisions**. The human's design is a set
of checkable invariants (window over sink → no upper there; fridge anchored by a
tall pantry; corner strategy; runs that close to the printed dimension; catalog
widths only) — none of which our evals assert today. That number — decisions
reproduced — is the single most honest KPI this feature has.

### 1c. What the drawings actually look like (visual review, 8 kitchens rendered)

Range walls have no designed upper composition (hood floats on bare wall; upper
runs stop 36-42″ short of corners; no upper corner cabinets exist anywhere in
auto output). Zero drawer bases in rendered samples. Fractional-width appliances.
Sliver cabinets as primary storage. Median counter asymmetry around the range:
**36 inches**. 45/96 kitchens have >12″ of bare wall above base runs. One-cabinet
walls in 31/96 kitchens. Non-catalog SKUs (W5448, B35-RT, BWDMA42-as-hero).
A homeowner says "meh" because the output *is* meh; our QA never looks.

---

## 2. Strategic finding: Cyncly has NOT "done it" — the moat is open

Confirmed by primary-source research (their own blogs/PRs, product pages, job
posts; no independent quality reviews exist):

- **Inspire Image-to-Design** is a *consumer/retail* Spaces Flex feature: the
  user supplies layout type + measurements; AI does image understanding (detect
  style/products in an inspiration photo) and catalog matching. The layout
  itself comes from **template/rule auto-fill with pre-AI lineage** (2020 Ideal
  Spaces shipped an "Auto-Design Module" years before the AI branding).
- Their professional tools (Design Flex) ship **no auto-designer** — the "AI" is
  the rendering engine (Cycles + auto-lighting). Their real asset is catalog
  breadth ("Content in Cloud"), not layout intelligence.
- No evidence of an AiHouse/Coohom engine under the hood; in-house CV team does
  image understanding, not placement.

**Implication:** "designer-grade auto-layout, explainable, priced to the penny"
is a capability *nobody* ships today. Getting this right is not catching up to
Cyncly — it is taking ground they have only marketed.

---

## 3. What "right" means — the definition we build against

From professional methodology research (NKBA guidelines + designer craft +
the sequence working designers actually follow), operationalized:

**The professional decision sequence** (violating this order is the named
amateur mistake):
1. Room facts: walls, windows/doors, ceiling, plumbing/gas/vent positions.
2. **Appliances + sink locked FIRST** (exact sizes; sink keeps the
   window/plumbing wall, range to the ventable focal wall, fridge at the work-core
   perimeter nearest the entry).
3. Verify triangle + aisles at appliance level — cheap to fix now.
4. **Tall anchors at run ends** (fridge surround + pantry block; never mid-run).
5. Zone counters: five zones (consumables, non-consumables, cleaning, prep,
   cooking); prep is the largest continuous counter between sink and range.
6. Fill runs with **symmetric, standard-width compositions**; drawers preferred
   at base level (≥50-60% of non-sink/non-corner base frontage in frameless
   lines); fillers ≤3″/run, at walls and corners only, never mid-run.
7. Uppers composed to the focal wall: hood centered over range (≤1.5″), flanking
   uppers mirror-symmetric, seams aligned to base seams, one top datum, corner
   uppers close the runs.

**The 28-item rubric** (full text in the audit archive; headline gates):
- HARD (NKBA, any fail = not order-grade): work aisle ≥42″; walkways ≥36″;
  triangle sum ≤26 ft with 4-9 ft legs and no tall between work centers; sink
  landings 24″/18″; range landings 15″/12″ (+9″ behind island cooktops); fridge
  15″ handle-side; DW ≤36″ from sink with 21″ standing clearance; prep counter
  ≥36″×24″ adjacent to a sink; no cooktop under an operable window.
- CRAFT (scored): no cabinet <12″ unless a dedicated pull-out; flank symmetry
  min/max ≥0.6 around the hood; upper seam alignment ≥50%; no blank upper span
  >24″ over counter (except window/hood/tall); tall units at run ends only;
  drawer-base fraction; ≤3″ filler per run; hood centerline within 1.5″ of range;
  every emitted SKU resolves exactly in the active tenant catalog.

---

## 4. The architecture: generate-and-score (beam search over compositions)

State-of-the-art review (classical optimization, learned scene synthesis, LLM
planners, commercial engines) lands on a clear recommendation for THIS domain —
discrete catalog SKUs, hard NKBA constraints, determinism required:

> **Beam/best-first search over per-wall SKU compositions, ranked by a
> designer-grade rubric scorer.** The current greedy packer is the beam=1
> special case; quality ceiling rises with the scorer, not with rewrites.
> Deterministic (fixed beam width, stable tie-breaks), zero training data,
> hard constraints native (illegal SKUs are never expanded). Precedent:
> warehouse-layout beam+scoring (arXiv 2407.08633), kitchen-as-0-1-IP (Kološ),
> Make It Home cost terms, Holodeck's LLM-proposes/solver-disposes split.

Two optional lifts, sequenced later: a **CP-SAT global skeleton** (appliance-to-
wall assignment, corner strategy, tall placement — exactly the early irrevocable
decisions greedy gets wrong) feeding structurally diverse candidates to the beam;
and an **offline vision judge** (SSR-render → VLM pairwise grading) that
calibrates the rubric weights — learned taste with hundreds of judgments, not
thousands of training scenes, kept entirely off the deterministic hot path.
Rejected for the core: ATISS/diffusion-style learned generation (continuous
outputs vs exact tiling + catalog snapping; needs 10³-10⁵ designed scenes;
non-deterministic) and LLM-emitted geometry (hallucination risk on the hot path).
LLMs stay in two bounded roles: intent → solver DSL (consumer funnel), and judge.

Explainability falls out for free: each surviving candidate's score breakdown IS
the "why this design" rationale, which plugs straight into the existing
three-option UI from the Cyncly-moat plan.

---

## 5. The phased plan

### Phase AD-0 — Stop the bleeding (mechanical bugs, ~1-2 sessions)
Fix the verified defects that ship garbage regardless of architecture; each gets
a regression eval:
1. Hood/uppers state desync (sync after `centerCookingZone`, or single-source the
   range position) — galley_island renders as the fixture.
2. SKU width rewrites → family-aware builder (kill `replace(/\d+/,…)` — B3D30→B24D30).
3. Duplicated WSC24-PH per upper corner (solver.js:4775-4796).
4. Dropped-appliance guard: any requested appliance missing from output =
   severity-error validation (the silent wall-oven drop).
5. Undefined tall positions (4 templates), 242.25″-on-240″ overflow, end panels
   inserted mid-run, zero-width schedule rows.
6. Un-swallow the 3 always-crashing passes (fix or delete; exceptions fail tests).
7. `moldingPaths?.length` object-vs-array gate permanently disabling crown paths.
8. walls[]/placements[] disagreement (re-compile after late mutations).
Acceptance: new `evals/_cross/autodesign-defects.eval.mjs` red→green on each item;
existing floors intact.

### Phase AD-1 — Scorer v2: move the goalposts to reality (~2 sessions)
Build the scorer that would have failed today's output, BEFORE changing the
generator (otherwise we can't see improvement):
1. **Hard-error passthrough**: any `severity=error` fails the run, regardless of
   rule name (kills the 94/100-with-zero-cabinets absurdity).
2. Implement the M1-M8 metric spec from the audit: storage-mix realism,
   independent landing recompute (stop trusting nkbaReport), composition & width
   regularity (flank symmetry, sliver ban, hood centering), upper-base seam
   alignment + coverage, zone adjacency, price realism band (per-tenant config
   field), aesthetics-engine fixes (no free points for absent data).
3. **The Mautz design-diff eval**: auto-solve the reconstructed Mautz room and
   score decisions-reproduced (baseline: ~4/16). Same for Wilterding.
4. Promote the worst-5 sweep kitchens to named fixtures with strict thresholds.
5. Record the honest baseline: the si corpus will go RED (expect single-digit %
   pass). That number replaces 180/180 as the KPI. Keep the old scorer as
   `--legacy` so the ratchet is visible.
Acceptance: scorer v2 fails ≥90% of today's corpus for documented reasons;
Mautz-diff runs in CI; a hand-designed good kitchen (Mautz itself, run through
buildManualResult) passes ≥90% of rubric items.

### Phase AD-2 — One truth, real geometry (~2 sessions)
Prerequisites for search — without this, candidates can't be trusted:
1. Single placement model per wall (one run structure; wallLayouts/appByWall/
   placements/_elev become derived views); delete the string-keyed sync loops.
2. Wall endpoints/normals computed in-engine (promote FloorPlanView's
   world-frame math); corners derived from geometry, not array order; true 2D
   coordinates for triangle/aisle math on U/G shapes.
3. Window/door openings become first-class solver inputs (no upper over a window;
   sink-under-window preference reads real geometry).
Acceptance: byte-identical output on the corpus for kitchens with no desync bugs
(proving the refactor is behavior-preserving), corrected output where bugs fired;
geometry unit evals (corner pairs, triangle on U-shape).

### Phase AD-3 — The generate-and-score core (~3-4 sessions)
1. Refactor the per-wall packer into a **candidate enumerator**: branch points at
   appliance placement (following the professional sequence: appliances first,
   verified at appliance level), tall anchoring (run ends only), corner strategy,
   zone counter allocation, and symmetric-pair flank fill (flanks solved as one
   constrained pair of equal standard widths — kills 42/16 forever).
2. Width discipline inside expansion: catalog width ladder only, remainder
   redistribution in 3″ steps (no slivers), fillers ≤3″ at walls/corners.
3. Beam width k (default ~8/wall, cross-wall coupling through the global
   variables), rank complete kitchens with scorer v2; `argmax` ships; top-3
   distinct candidates feed the existing DesignOptionsPanel with score-breakdown
   rationales. Greedy path retained behind `prefs._legacySolve` for one release.
4. Wire in (or delete) the 20 dead expert modules — each survives only as a
   scorer term or candidate generator.
Acceptance: corpus pass-rate on scorer v2 jumps from single digits to ≥60%;
Mautz decisions-reproduced ≥10/16; determinism eval (same input → same design,
twice); solve time <2s per kitchen; all existing suite floors hold.

### Phase AD-4 — Vertical composition: the focal wall (~2 sessions)
The visual review's biggest gap: uppers as designed composition, not base-seam
echo. Range-wall composer (hood centered ≤1.5″, mirror-symmetric flanking uppers,
seams snapped to base seams, corner uppers closing runs, one datum); window walls
(uppers suppressed over glass, symmetric about the window); drawer-base mix to
target; over-fridge + pantry block as the storage-wall pattern.
Acceptance: SSR-render the 8 previously-reviewed kitchens; the specific named
defects (floating hood, 36-42″ upper gaps at corners, bare walls) are gone in the
rendered images; scorer v2 corpus ≥80%; Mautz ≥12/16.

### Phase AD-5 — The taste loop (judge-calibrated weights) (~2 sessions + ongoing)
1. SSR→resvg render batches of candidate pairs; a vision judge (existing
   ANTHROPIC_API_KEY plumbing, offline only) grades pairwise "which looks
   designed"; fit scorer weights to the preferences. Deterministic core is
   untouched — the judge tunes constants, never places cabinets.
2. Diversify the corpus (60 kitchens currently collapse to 42 layouts; vary
   appliance walls, windows, entries) and grow the golden set: every reconciled
   real order (the Phase-3 flywheel) also becomes a design-diff fixture.
3. Consumer-funnel intent: LLM translates free text ("lots of baking storage,
   hide the fridge") into prefs/zone weights — the Holodeck split: LLM proposes
   intent, deterministic engine designs.
Acceptance: judged preference for new vs old output ≥80% on a 50-pair blind set;
corpus ≥90% on scorer v2 with documented waivers; the three-option UI ships
candidates that a designer reviewer signs off as "would present to a customer."

---

## 6. Guardrails

- **Determinism is non-negotiable**: same input → same design; beam ties broken
  lexicographically; the judge and LLM roles never run on the solve path.
- **Every emitted SKU resolves exactly in the active tenant catalog** — new hard
  eval; the SKU-invention era ends in AD-0/AD-3.
- **Multi-tenant rules hold**: rubric thresholds that vary by line (drawer
  fraction, price band) are tenant config fields, never brand conditionals.
- **The ratchet only tightens**: scorer-v2 pass-rate may never decrease in a
  commit; the Mautz decisions-reproduced number is reported in every phase.
- Existing product floors (pricing 153/0, vector/import/counter-quote evals,
  build) stay green throughout — this program touches generation, not pricing.

## 7. What to tell ourselves about the old 180/180

Keep it as a *crash-freedom* floor, rename the gate accordingly, and stop citing
it as design quality. The scoreboard that matters from now on:
**scorer-v2 corpus pass-rate** and **Mautz decisions-reproduced** — both start
embarrassing, both only allowed to go up, and both measure the thing the owner
has been seeing with his own eyes all along.
