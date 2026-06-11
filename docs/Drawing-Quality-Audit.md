# Floor Plan & Elevation Quality Audit — Findings and Improvement Plan

**Date:** 2026-06-11
**Method:** Headless battery ([tools/audit-drawings.jsx](../tools/audit-drawings.jsx)) — 13 room
configurations (every layout type, windows/doors, 9-ft ceiling + soffit, tight U, island,
pinned appliances, 45° angled walls, tall towers, vanity, plus a hand-built Design Studio
result) solved and rendered through FloorPlanView and ElevationView; 57 sheets rasterized
to PNG and inspected, plus programmatic checks (run continuity, ceiling fits, text
collisions, NaN/undefined leaks, dimension-chain sums).

**Headline:** zero crashes, zero NaN/undefined across all 57 sheets. The drawings are
structurally sound and close to professional. One **pricing-level accuracy bug** was found
and fixed during the audit; the rest is a prioritized backlog below.

---

## Fixed during the audit (deployed)

**P0 — Over-fridge cabinet double-counted.** Two solver paths each emitted an RW above the
same fridge: the uppers path emitted the ceiling-fit `RW3612-27`, and the talls
"fridge-pocket" path force-emitted `RW3621` (21" high into a 12" space — over the ceiling)
at the same position. Both reached `placements`, so **the quote charged for two cabinets,
the order package listed two, the floor plan labeled it RW3621 while the elevation schedule
said RW3612-27.** Fix: the talls path no longer emits an RW that doesn't fit, and a dedupe
pass keeps only the uppers-path RW. Verified: one RW at 8-ft (RW3612-27) and 9-ft
(RW3624-27) ceilings; all suites green.

---

## Findings — Accuracy (document correctness)

**A1 (P1) — Galley wall B draws on the wrong side of its wall.**
Both galley walls get the same frame angle (0°), and every view draws cabinets at +normal
("below the line"). For wall B that places its run on the FAR side of the wall — outside
the room. Consequences visible on the sheet: the drawn aisle is ~70" instead of the
designed 42", run B's doors face away from the kitchen, the KITCHEN room label collides
with run B's upper band. Affects floor plan, Design Studio canvas, and 3D equally (shared
convention). Fix direction: galley wall B needs an interior-side flip in the shared frame
model (a `flip`/mirrored-normal field in wallGeometry consumed by all three views), with
the gap constant recomputed so face-to-face aisle = 42".

**A2 (P1) — Elevation dimension chains don't sum to the wall.**
Corner-consumption zones and mid-run gaps get no dimension segment. Tight-U wall B reads
12" + 36" under an 84" overall; the tall-ovens wall B shows a pantry tower with NO
locating dimension from either wall end — an installer cannot set out the wall from the
sheet. Fix: emit a complete chain — corner zones as labeled "CORNER 36"" segments, open
gaps as "OPEN xx"" segments — and assert chain total = wall length (add to test-bounds).

**A3 (P1) — Soffits are invisible in elevations.**
A wall with `soffit {height 12, depth 14}` on a 108" ceiling renders uppers to 102" and
empty space above — no soffit mass, no hatch, no note. The solver accounts for it; the
drawing doesn't show it. The floor plan also gives no dashed soffit outline. Fix: draw the
soffit box (hatched) in elevation with a depth note, dashed outline on the plan.

**A4 (P2) — Plan dimension chain misses sub-3" slivers.**
Galley wall A: 36 + 38.25 + 30 + 39 = 143.25 on a 144" wall — the ¾" end-panel slot is
undimensioned, so the chain doesn't close. Either absorb panels into the chain as a
labeled ¾" tick or annotate "¾" panel" at the run end.

**A5 (P2) — Studio island position doesn't reach the documents.**
`buildManualResult` passes island `{length, depth, overhang}` but drops the studio's
dragged `x/y`; FloorPlanView and 3D re-place the island with their own defaults, so the
documents can disagree with the canvas the designer arranged. Fix: pass x/y through and
honor it in placeIsland/3D when present.

**A6 (P3) — Placement copies of the RW carry stale `_elev`** (y54/h12 vs the uppers list's
y84). Views read the uppers list so drawings are right, but anything consuming
`placements._elev` inherits the wrong mount. Normalize at compile time.

## Findings — Quality (drawing craft)

**Q1 (P1) — Tag-circle pileups, no leaders.** KD tag circles collide at corners and dense
runs in every config (worst at the angled junction: 6 circles stacked). Tags float without
leader lines, so a crowded area is ambiguous. Fix: collision-aware tag placement (push
along the dim row until clear) + short leader line from tag to cabinet; corner tags fan
outward.

**Q2 (P1, cheap) — Elevation margin text defects.** `96"" CLG` / `93"" AFF` double inch
marks (the template appends `"` to a value that already has one); `0" FIN-FLR` clipped at
the right sheet edge; tiny top-left garble where the panel-height label collides with the
CLG line; right-side AFF ladder collides with the ¾" SCRIBE label (`54" AFF 108"`).

**Q3 (P2) — Sheet composition wastes the page.** The plan occupies roughly a quarter of
the sheet with dead space below; the legend and scale bar collide with each other and the
title block ("each band = 1'-0"" overlaps legend labels; "Base Cabinet" half-clipped at
the margin). Fix: fit viewBox to drawn content + title block, move legend/scale into a
fixed footer lane.

**Q4 (P2) — Label duplication and rotated-label collisions.** Appliances print twice
("DW" italic + "DW 24""); narrow cabinets' vertical SKU labels (B3D24, BWDMA19) cross tag
circles and dims. Fix: single label per item; for items under ~15" wide, move the SKU out
to a leadered note.

**Q5 (P2) — Annotation rows collide in elevations.** The GFCI/receptacle note overlaps the
light-rail label and ¾" SCRIBE text in every sheet; on single-wall the countertop spec
line runs through the DW label. Fix: reserve fixed annotation lanes (backsplash notes at
one height, utility notes at another) and skip a lane when occupied.

**Q6 (P2) — Angled-junction clutter.** The corner zone at a 45° junction collects tags,
the angled upper band crosses the junction, and small fragments ("TALL", rotated SKUs)
overlap. Tag fan-out (Q1) plus suppressing the upper band inside the open-corner wedge
covers it.

**Q7 (P3) — Uppers drawn as an offset band outside the wall.** A consistent house
convention, but it doubles the plan's bounding box, separates uppers from their bases, and
isn't the NKBA dashed-overlay style a dealer/inspector expects. Moving to dashed uppers
drawn OVER the base run (with the existing legend) would halve sheet height and read
standard. Bigger change — verify against the order-package sight checks.

**Q8 (P3) — Blank wall stretches lack annotation.** Long empty runs (tall-ovens wall B)
read as unfinished; an "OPEN WALL — xx"" note (and countertop line spanning only actual
cabinetry, as today) would make intent explicit.

---

## Recommended sequence

| Wave | Items | Why first |
|---|---|---|
| 1 | A1 galley flip · A2 complete dim chains · Q2 margin text | Document correctness an installer relies on; Q2 is an hour of fixes |
| 2 | Q1 tag leaders/collision · A3 soffit drawing · Q5 annotation lanes | The two biggest "looks professional" wins + a real accuracy gap |
| 3 | Q3 sheet fit · Q4 label dedupe · A4 chain slivers · A5 island x/y | Polish + closing the remaining sum/position gaps |
| 4 | Q7 NKBA dashed uppers · Q6 angled clutter · Q8 open-wall notes · A6 | Convention change last — it touches every sheet |

**Regression guard:** the audit harness is committed at
[tools/audit-drawings.jsx](../tools/audit-drawings.jsx) (needs `@resvg/resvg-js` +
esbuild; see header). Re-run after each wave — the text-collision counter and the
accuracy checks turn these findings into numbers that should go to zero.
