# Kitchen Design Data Found Online — to Improve Engine Layouts

Authoritative, current data gathered to improve the *layout decisions* (not the
rendering) the engine makes. The anchor source is the **NKBA Kitchen Planning
Guidelines with Access Standards** (the US professional standard, 31 guidelines),
cross-checked with manufacturer appliance specs and range-hood/code references.

Sources are listed at the bottom. Full verbatim guideline text is in
`outputs/nkba-guidelines-verbatim.md`.

---

## What the engine ALREADY encodes correctly (verified against NKBA)
These match the standard — leave as-is:
- Work triangle: total ≤ 26 ft, each leg 4–9 ft, obstacle intrusion ≤ 12" (G3).
- Work aisle 42" (1 cook) / 48" (multiple) (G6); walkway 36" (G7).
- Sink landing 24" + 18" (G11); prep area 36"W × 24"D (G12).
- Cooktop landing 12" + 15", 9" behind on island (G17).
- Refrigerator landing 15" (G16); oven/microwave landing 15" (G22, G23).
- Dishwasher within 36" of sink, 21" standing space (G13).
- Door clear opening 32" (G1).

## GAPS — data the engine is MISSING (highest layout value first)

### 1. Seating knee-clearance by counter height (NKBA G9) ★ biggest win
The island seating overhang is currently hardcoded at 12". NKBA ties it to
counter height:

| Counter height | Knee space per seat | Overhang (knee depth) |
|---|---|---|
| 30" (table)   | 24"W × 18"D | 18" |
| 36" (counter) | 24"W × 15"D | 15" |
| 42" (bar)     | 24"W × 12"D | 12" |

Each seat needs **24" of width**. So seat count = floor(seating_run / 24), and
the overhang should be 18/15/12 by height — not a flat 12".

### 2. Traffic clearance behind seating (NKBA G8)
- No traffic behind diner: **32"** from counter edge to wall.
- Traffic passes (edge past): **36"**. Traffic walks past: **44"**.
- (Engine currently uses 48/52 — conservative; adopting 36/44 frees up space in
  tight rooms while staying to standard.)

### 3. Cooking-surface clearance above (NKBA G18 / IRC M1901.1)
- **24"** to a protected, noncombustible surface above.
- **30"** to an unprotected/combustible surface (e.g. a wood cabinet) above.
- Drives minimum hood/cabinet mounting height over a cooktop.

### 4. No cooktop under an operable window (NKBA G20a) ★ now checkable
The engine already parses `wall.openings` (windows) and places the cooktop, so
it can now **validate that a cooktop/range is not under an operable window** —
a safety rule it currently ignores.

### 5. Combining adjacent landing areas (NKBA G24)
When two landing areas abut, the combined minimum = **larger requirement + 12"**
(not the sum). Improves spacing when, e.g., a sink and cooktop share a run.

### 6. Total countertop frontage (NKBA G25)
A functional kitchen needs **158" of countertop frontage, 24" deep, with 15"
clearance above**. Add a completeness check that flags undersized kitchens.

### 7. Landing-area qualification rule (NKBA G11 note)
A counter only counts as landing area if it's **≥16" deep** and **28"–45" AFF**.
Useful to avoid counting shallow/odd-height runs as valid landing.

### 8. Range hood mounting + sizing
- Mount **24–30"** above a gas cooktop, **28–36"** above electric/induction;
  **≥30"** when the surface above is combustible (matches G18).
- Hood **width ≥ cooktop width** (common practice: +3" each side).
- Ventilation **≥150 cfm** recommended, **100 cfm** code minimum, ducted (G19).

### 9. Storage totals by kitchen size (NKBA G27) — completeness only
Total shelf/drawer frontage: **1400"** (small, ≤150 sq ft) / **1700"** (medium,
151–350) / **2000"** (large, >350). And ≥400/480/560" within 72" of the sink
(G28). Lets the engine flag under-stored designs.

### 10. Standard appliance dimensions (manufacturer specs)
A reference table so the solver validates real appliance fit and picks sane
defaults:

| Appliance | Standard width(s) | Depth | Notes |
|---|---|---|---|
| Range (freestanding/slide-in) | 30, 36, 48, 60 | ~25–28 | 30" cutout ≈ 29⅞" body |
| Cooktop | 30, 36 (also 24, 45, 48) | 19–22 | 2.5–4" tall |
| Wall oven | 27, 30 (also 24, 36) | 24 | single/double |
| Dishwasher | 24 (also 18 compact) | 24 | 35" tall |
| OTR microwave | 30 | 15–18 | bottom ≤54" AFF |
| Refrigerator (freestanding) | 30, 33, 36 | 29–35 | 67–70" tall |
| Built-in / column fridge | 36, 42, 48 | 24 | counter-depth |
| Range hood | ≥ cooktop width | — | +3"/side common |

---

## Concrete proposed additions to `constraints.js`
Drop-in constants (new — they don't conflict with existing values):

```js
// NKBA G9 — seating knee space by counter height
export const SEATING = {
  perSeatWidth: 24,
  byHeight: {
    30: { kneeDepth: 18, kneeWidth: 24 },  // table height
    36: { kneeDepth: 15, kneeWidth: 24 },  // counter height (default)
    42: { kneeDepth: 12, kneeWidth: 24 },  // bar height
  },
  // NKBA G8 traffic behind seating
  clearNoTraffic: 32, clearEdgePast: 36, clearWalkPast: 44,
};

// NKBA G18 / IRC M1901.1 — clearance above a cooking surface
export const COOKING_CLEARANCE = { protectedAbove: 24, unprotectedAbove: 30, behindOnIsland: 9 };

// Range hood (G18/G19 + manufacturer practice)
export const HOOD = {
  mountGasMin: 24, mountGasMax: 30, mountElecMin: 28, mountElecMax: 36,
  combustibleMin: 30, widthOverhangPerSide: 3, cfmRecommended: 150, cfmCodeMin: 100,
};

// NKBA G25/G27/G28 — completeness targets
export const COMPLETENESS = {
  countertopFrontageMin: 158, countertopDepthMin: 24, countertopClearAbove: 15,
  storageBySize: { small: 1400, medium: 1700, large: 2000 },     // sq-ft: ≤150 / 151–350 / >350
  storageNearSink: { small: 400, medium: 480, large: 560 },      // within 72" of sink
  landingQualifies: { minDepth: 16, minAFF: 28, maxAFF: 45 },    // G11 note
};

// Standard appliance widths for fit validation / defaults
export const APPLIANCE_STD_WIDTHS = {
  range: [30, 36, 48, 60], cooktop: [24, 30, 36, 45, 48],
  wallOven: [24, 27, 30, 36], dishwasher: [18, 24], microwaveOTR: [30],
  refrigerator: [30, 33, 36], fridgeColumn: [36, 42, 48],
};
```

## Where these plug into the solver/validator
- `SEATING` → island/peninsula overhang + seat count (replaces the hardcoded 12"
  in `solver.js` island worktop and the renderer's seating cantilever).
- `COOKING_CLEARANCE` + `HOOD` → hood mounting height and the upper-cabinet
  generation above a cooktop.
- Cooktop-under-window (G20a) → new check in `validateLayout()` using the
  `wall.openings` data the elevation renderer already reads.
- `COMPLETENESS` → new advisory checks in `validateLayout()` (frontage, storage).
- `APPLIANCE_STD_WIDTHS` → appliance fit validation + default sizing in
  `solveTalls`/appliance placement.

---

## Sources
- [NKBA Kitchen Planning Guidelines with Access Standards (full PDF)](https://newcreationsaustin.com/wp-content/uploads/2019/05/nkba-planning-guidelines.pdf)
- [NKBA guidelines (pre-2023 PDF)](https://nkba-ps.com/images/downloads/Awards/nkba_kitchen_planning_guidelines_pre_2023.pdf)
- [Mod Cabinetry — NKBA guideline summary](https://www.modcabinetry.com/nkba-guideline/)
- [Wholesale Cabinet Supply — NKBA clearances](https://www.thewcsupply.com/pages/kitchen-design-guidelines-standard-clearances)
- [Dura Supreme — countertop heights & overhangs for seating](https://www.durasupreme.com/blog/design-101-countertop-heights-and-overhangs-seating/)
- [Designer Appliances — modern appliance sizes](https://www.designerappliances.com/blog/appliance-sizes/)
- [Whirlpool — range/stove dimensions](https://www.whirlpool.com/blog/kitchen/stove-dimensions.html)
- [KitchenAid — range hood height above stove](https://www.kitchenaid.com/pinch-of-help/major-appliances/range-hood-height-above-stove.html)
- [Yale Appliance — range hood mounting height](https://blog.yaleappliance.com/how-high-do-you-hang-a-range-hood)
