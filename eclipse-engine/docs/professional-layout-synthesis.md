# Professional Kitchen Layout — Research Synthesis & Engine Gap Map

Synthesis of deep research (appliance placement, work zones, cabinet/countertop
alignment, molding, storage) into what the Eclipse engine **already enforces**
vs. **genuine gaps**. Full research: `research-appliance-storage.md`,
`research-alignment.md`, `research-molding-storage.md`.

## The engine is already strong
A validation audit shows ~80 rules already encoded, covering most of the
professional checklist:
- Work triangle bounds, landing areas (sink/range/fridge/oven/micro), DW-to-sink,
  walkways, seating clearance, island clearance.
- Range-in-corner, range-under-window, fridge-mid-run, sink-in-corner,
  traffic-through-triangle, dead-corner.
- Hood width vs cooktop, hood mount height (pro variants), hood-upper overlap.
- Crown / light-rail / toe-kick-return molding presence; filler-at-wall-junction;
  fridge enclosure panels.
- Upper↔base alignment, stacked uppers on tall ceilings, end panels.

So most pro rules from the research are present. New this pass:
- **NKBA-G4-Tall-Splits-Work-Centers** — warns when a pantry/oven tower sits
  between two work centers on a run (breaks the triangle + counter run).
  (Earlier passes added G20a cooktop-under-window, G25 frontage, seating-by-height.)

## The real gap is NOT rules — it's L-shape corner geometry ★
An audit render of the L-shape example surfaced the thing that actually makes
multi-wall layouts "not look pro" — a concrete solver bug, not a missing rule:

**Symptom (l-shape-quote, 479 validation errors):**
- Wall A base run overruns the corner: with a 36" corner reserved at 63–99",
  the run fills to 66" (B15@3 + range@18–54 + B12@54–66), a **3" overlap into
  the corner zone** → `corner_anchor_overlap_A` + `spatial_physical_collision`.
- The corner cabinet (`BL36-SS-PH`) renders as a **floating text label with no
  box**, and the two wall runs read as disconnected.
- The actual refrigerator is hard to read on the plan (the above-fridge `RW`
  cabinet shows instead).

**Root cause:** when a wall has a corner, its fillable length must be reduced by
the corner consumption *and the cabinet packing must snap to that reduced length*
so the last cabinet can't overrun the corner zone. Wall A's fill used ~66" of a
99" wall while the corner reserved 63–99", leaving a 3" collision because the
range(36) + flanks didn't snap to the 63" available.

**Fix plan (next session — focused, ~the size of the appliance-drop fix):**
1. In the per-wall segment fill, compute `available = wallLength − leftCorner −
   rightCorner` and never place/extend a cabinet past `available`; absorb the
   remainder into a filler against the corner, not an overrun.
2. In `renderFloorPlan`, ensure the corner L-rect actually draws for the A→B
   orientation (the box is missing while the label draws) and that wall B's
   origin sits exactly at wall A's end so the runs meet.
3. Re-audit: the 479 errors should collapse to a handful, and the L-shape plan
   should read as a connected L with a drawn corner cabinet.

This is the highest-value remaining improvement for "looks like a pro did it" —
single-wall and island layouts already render cleanly; the corner is the weak
point.

## Lower-priority codifiable rules still worth adding (from research)
- Work-zone workflow scoring (consumables→cleaning→prep→cooking ordering) — the
  modern 5-zone model; the engine uses the triangle but doesn't score zone order.
- Glass/open uppers in symmetric pairs and never directly beside the cooktop.
- Fridge hinge oriented toward the nearest landing/prep zone.
- Over-sink / over-cooktop upper "lift" (raise + shrink that cabinet so its top
  still matches the run line) — research rule; engine handples height but not the
  explicit lift datum.

## Sources
See the three research docs for full source lists (NKBA, Fine Homebuilding, This
Old House, Blum, Dura Supreme, KraftMaid, Rev-A-Shelf, CliqStudios, and others).
