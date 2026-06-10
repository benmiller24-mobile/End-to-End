# Design Studio & Hybrid — Competitive Research and Recommendations

**Date:** 2026-06-09
**Suites examined:** Cyncly 2020 Design Live / Design Flex, Compusoft Winner / Winner Flex (also Cyncly), ProKitchen (Real View), AutoKitchen (Microcad) — plus IKEA Kitchen Planner, Chief Architect, HomeByMe, Cedreo, and general canvas-UX research (Figma, SketchUp, tldraw) for pattern grounding.

---

## 1. How the four suites actually work (interaction level)

### 2020 Design Live / Design Flex
- **Walls:** chained click-and-type drawing (click direction, type length, Enter); Ortho angle constraint; preset L/U room tools; green end-handles + red center handle on selected walls; per-wall properties dialog.
- **Placement:** drag from catalog onto a wall's "placement zone" (dotted interior band); magnetic snap within 3″, visible snap points; **collision on by default, hold Ctrl to overlap, Shift to suppress snap**; corner cabinets auto-position when dropped on the corner diagonal ("double-magnet" pointer).
- **Fillers:** dragged between cabinets and **auto-trimmed to the gap width**; corner-filler wizards take the shape of odd angles automatically.
- **Editing:** Placement box for typed offsets (numeric-first everywhere); **Replace button** swaps a placed item for a new catalog pick in place; Center verb (center sink on window, hood on range).
- **Elevations are editable workspaces** — stack wall cabinets, set heights, drag along wall; plan/elevation/3D are live views of one model.
- **User complaints:** drag "loses control and the cabinet drops off the grid," slow with heavy files, crashes, dated UI, catalog search is a learning curve.

### Winner / Winner Flex
- **The signature mechanic:** a placement **cursor that auto-advances** — type a catalog code, Enter, cabinet lands at the cursor, cursor jumps to its far edge ready for the next code. Keyboard hops: jump to nearest element/wall/corner, jump to left/right side of a tall unit. This chained code-entry is why European showroom staff quote kitchens in under 20 minutes.
- **Walls:** drag rubber-bands in 100mm/15° steps, or type exact; "close figure" auto-completes the room; retro-editing offers Move-previous/Move-next/Adjust-only with color-coded preview.
- **Manufacturer intelligence at placement:** dishwasher code prompts a filtered list of *fitting* appliance models; tall units prompt mandatory companion codes; Ctrl+Enter centers a hood over the cabinets below; "on worktop" items auto-drop to counter height.
- **Design = quote = order:** every placed code is already a priced quote line; plan generates EANCOM electronic supplier orders directly.
- **Weaknesses:** presumes catalog-code literacy; modal parameter dialogs at almost every placement.

### ProKitchen
- **Room templates** (U/L/rectangle buttons + typed wall lengths) or sketch-walls; islands are clunky construction-line scaffolding.
- **Placement zones** per wall incl. an explicit **corner zone** corner cabinets drop into; slide-and-bump along wall; **Fit verb** auto-resizes a colliding cabinet to the gap *and reprices it* through the catalog's legal width-mod.
- **Verb-buried editing** (right-click → Drag/Move/In-Out/Up-Down/Center/Position/Snap/Stack/Replace…) — its biggest weakness.
- **Live BOM ↔ plan two-way sync** with plan-label renumbering; Non-Plan Items tab for quote-only lines (scribe, toe-kick covers).
- **Multi-Quote: one design, up to 5 door styles priced side-by-side** — its single highest-leverage sales feature.
- **Documented trap:** editing width via the attributes text box visually resizes but silently misprices (geometry and price are separate edit paths).

### AutoKitchen
- **Fastest room shells:** point the mouse in a direction, type the length on the keypad, Enter — a 5-wall room with a notch in ~20 seconds; angled walls inline; works on imported DWG.
- **Blue/red arrow run-building:** last-placed cabinet shows left/right arrows + a **live readout of remaining inches to the nearest obstacle each way**; one click per cabinet butts the next flush. White-cube re-anchors onto any cabinet.
- **One-click contextual automations:** center-under-window (sink), center-above (hood), center-across-at-distance (island), relative-position typed offsets.
- **Filler "Adjust":** too-small gap → warning offers to shrink the filler to the exact remainder. One click.
- **v25/26 "AI furnishing":** auto-proposes cabinet layout from room + utility positions; recalculates to minimize fillers. (We had this first — our solver is more capable.)
- **Weaknesses:** modal-dialog ergonomics, historically non-associative dimensions (move a cabinet, dims go stale), quote was a separate Estimate app export until v26.

### Cross-tool table stakes (all four)
1. Chained wall drawing with typed dimensions; edit walls later without redrawing.
2. Magnetic wall attachment with bump-stop against neighbors; modifier to override.
3. Corner-aware drop (corner cabinets self-place); auto-sizing fillers.
4. Numeric-first positioning (typed offsets, fine nudge steps) — never force pixel-dragging a known dimension.
5. Catalog quick-search by code + replace-in-place.
6. Elevation synchronized with plan, editable heights.
7. Item list = priced quote, two-way selection sync.
8. A "next position" assist that keeps runs flowing (Winner cursor / AutoKitchen arrows / 2020 reference-item).

---

## 2. Where we already stand

**Already competitive or better:**
- **Live accurate pricing in-canvas** — placements are quote lines through the same engine as the solver path; IKEA's most-loved feature, and ours is dealer-accurate (list/dealer/rep multipliers).
- **The solver itself** — AutoKitchen shipped "AI furnishing" in v25 as a headline feature; ours is deeper (training profiles, appliance packages, code checks) and bidirectional (auto → hand-edit via hybrid seed).
- **Shape templates** (single/galley/L/U/G) match ProKitchen's room-template buttons.
- **3D preview from the studio**, sharing the same placements model.
- **Click-to-arm placement** — coincidentally the touch-friendly pattern Winner Flex sells for showroom tablets.

**Current v1 gaps vs table stakes:** no ghost preview/validity feedback while placing; no gap dimensions or click-to-edit dims; settle is snap-after-drop rather than bump-and-slide during drag; no replace-in-place; no auto-advance after placing; no corner drop target (corners only arrive via hybrid seed); uppers fixed at 54″ datum (no elevation-height editing); island not draggable; no undo/redo; catalog is list-only (no front thumbnails or function facets); right-angle walls only.

---

## 3. Recommendations

### Tier 1 — table-stakes catch-up, high value / low-to-medium effort

**R1. Ghost preview with validity tint (place + drag).** Render the armed/dragged cabinet's true footprint, snapped live, green when legal and red with a one-line reason ("overlaps B24", "blocks DW door") when not. We already have `manualChecks` and `settleItem`; this is running them during the gesture instead of after. *The single cheapest perceived-quality win.*

**R2. Gap dimensions + click-dimension-to-edit.** Show leftover run space as styled dimension segments between items and to walls (the number every designer mentally computes — AutoKitchen's arrow readout, Chief Architect's "display gaps"). Make item-offset dimensions clickable inputs: type a value, the cabinet moves. Dimensions become controls, not annotations.

**R3. One-click "fill gap."** Click a gap chip → menu: best-fit cabinet (width-filtered from catalog, priced), filler auto-trimmed to the exact remainder (2020's auto-trim + AutoKitchen's Adjust), or stretch-neighbor where a width mod is legal (ProKitchen's Fit, priced through our MOD/SQ data so geometry and price never diverge — the trap ProKitchen documents).

**R4. Bump-and-slide collision during drag.** Dragged cabinets stop against neighbors/walls and slide along the run; Ctrl-drag overlaps (for panels). 1-D math along the wall chain; replaces overlap-then-flag with prevent-by-default. Keep the post-hoc checks as backstop.

**R5. Auto-advance placement (the Winner cursor / AutoKitchen arrows).** After placing, keep the SKU armed and aim the next slot flush against the just-placed item, showing remaining inches each way; left/right end buttons to flow a whole run one click per cabinet. This is the #1 speed mechanic in both European-market leaders.

**R6. Replace-in-place with price delta.** Context action on a placed cabinet: same-family alternatives at other widths (we have `nearestInFamily`), anchored to the chosen edge, live ±$ shown before commit. Beats 2020's Replace button by showing the money.

**R7. Type-to-place SKU search.** A code field in the studio: type `B30`, Enter → armed with ghost (Winner's core mechanic; ProKitchen's Find). Pros think in nomenclature; `findSkuNormalized` already resolves handed/normalized variants.

**R8. Undo/redo + autosave.** Ctrl+Z/Ctrl+Shift+Z over a snapshot stack of `{walls, items, island}`; continuous autosave to projectStore. IKEA's legacy planner was infamous for losing work — non-negotiable for showroom trust.

### Tier 2 — differentiating depth

**R9. Inline per-wall elevation strip, editable heights.** Select a wall → its elevation renders beside/above the plan (we already render elevations; this is composition). Drag uppers vertically in the strip to set mount heights, stack W-cabinets, place at 54″/cabinet-to-ceiling/over-fridge. Kills the fixed-54″-datum limit and matches 2020's editable elevations — the hardest table-stake, but our shared SVG components make it tractable.

**R10. Corner drop target.** A visible corner zone on the plan; dropping/arming a corner SKU (LS, BLB, WDC…) self-positions and rotates with blind-pull handled (2020's double-magnet, ProKitchen's corner zone). Corners are the hardest interaction in kitchen CAD; right now ours only arrive via hybrid seed.

**R11. Draggable island + free runs with live clearance dims.** Island as a first-class draggable object showing live aisle clearances to the perimeter (and a 42″/48″ NKBA hint). Avoids ProKitchen's construction-line scaffolding clunk.

**R12. Contextual placement automations.** Center-on-window for sink bases, center-above-range for hoods, center-across-at-distance for islands — one-click commands, not measuring exercises (AutoKitchen's best idea; Winner's Ctrl+Enter).

**R13. Catalog browser upgrade.** Function facets (Sink Base / Drawer Base / Corner / Tall / Panels…from our cat/sub data) + width filter + **front-configuration line drawings** (SVG door/drawer fronts from official v8.8 door/drawer counts — what pros actually look at) with SKU + price on the card; keep code quick-search. Both research tracks: nomenclature-first with visual confirmation wins.

**R14. Numeric-first nudging.** Arrow keys move 1″, Shift ¼″, Alt 1/16″; selected item shows editable offset-from-wall-end field. Matches Winner's 100/50/10/1mm ladder.

### Tier 3 — things nobody does well (our openings)

**R15. Lock-and-resolve hybrid (the big one).** In manual mode, pin any items ("lock this sink wall") and ask the solver to design *around* them — fill remaining runs, respect locks, return as editable manual items. The solver already supports pinning; no competitor has a designer-grade auto-fill that respects hand-placed work. AutoKitchen's v25 AI furnishing is the closest and it's all-or-nothing. **This is the hybrid feature's killer evolution.**

**R16. Re-solve diff view.** When re-running the solver over an edited design, show what changed (added/removed/moved/repriced) before accepting — Winner's wall-edit preview pattern applied to layouts. Builds trust in the auto side of hybrid.

**R17. Multi-Quote.** One design, 3–5 door-style/species/construction columns priced side-by-side (ProKitchen's killer sales feature). For us it's nearly free: pricing is a pure function of placements × style — render N columns. Massive showroom value ("here's your kitchen in Maple vs Rustic Walnut vs paint, Eclipse vs Shiloh") per unit effort.

**R18. Insert-between with neighbor shift / run reorder.** Drop onto a run boundary: neighbors slide if slack exists; drag within a run to reorder (Figma's Smart Selection in 1-D). No kitchen tool does this well — clear differentiation once R4's run model exists.

**R19. Angled walls + soffits in studio.** 45° wall segments and per-wall soffit entry. The solver handles soffits already; studio parity matters for real rooms. (Curved walls: skip — even 2020 users barely use them.)

**R20. Live 3D pane (Cedreo-style).** Upgrade the 3D button to an optional always-on side pane that re-renders on edit (debounced, like the auto-mode ghost). Defer if WebGL perf on showroom hardware is shaky.

### Deliberately not recommended
- **Mid-drag auto-reoptimization** (AutoKitchen-style recalc fighting the user's hand) — offer "optimize this run" as an explicit action instead (R15).
- **Modal parameter dialogs at placement** (Winner/AutoKitchen's biggest ergonomic sin) — keep attributes in the side panel.
- **Two edit paths where one breaks the quote** (ProKitchen's width-textbox trap) — every geometry edit must route through priced SKU/mod resolution.
- **VR / photoreal in-studio rendering** — Leonardo rendering already covers presentation; ProKitchen Oculus reviews show the ROI isn't there.

---

## 4. Suggested sequencing

| Phase | Items | Theme |
|---|---|---|
| **A** | R1, R2, R4, R8 | Make the canvas feel professional: ghost + gaps + bump-slide + undo |
| **B** | R5, R6, R7, R3 | Make it fast: auto-advance, swap, type-to-place, fill-gap |
| **C** | R9, R10, R11, R14 | Make it complete: elevations, corners, island, nudging |
| **D** | R15, R16, R17 | Make it unbeatable: lock-and-resolve, diff view, Multi-Quote |
| **E** | R12, R13, R18, R19, R20 | Polish and reach |

Phase A+B turn the studio from "works" to "feels like a tool a designer would choose." Phase D is where we pass the incumbents instead of chasing them — nobody has a real solver behind a hand-editing canvas, and Multi-Quote is disproportionately cheap for us.
