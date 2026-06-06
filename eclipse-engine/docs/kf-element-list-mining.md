# KF Element List Mining — Professional Cabinet Schedule Conventions

**Source:** PRONORM-style "Element List (With List Price)" schedules from KF Design Output Packages.
**Sample:** 9 kitchens fully parsed (KFBSKD #10845, #10844, #10934, #10863, #11095, #11185, #11187, #11192, #11246).
Two requested files (#10942, #10969) could not be read — their 64–66 MB RTFs (bloated with embedded JPEG cabinet drawings) repeatedly triggered an OS-level mount deadlock on every read path attempted. The remaining 9 give a solid statistical base (577 raw line items).

**Method:** Each 40–80 MB RTF was stripped of control words and embedded image hex, then parsed into structured records (Pos / Quantity / Unit / Code / Description / Dimensions / Amount). Codes follow the PRONORM grammar `PREFIX + WIDTHcm - DEPTH/HEIGHTcm - VARIANT` (e.g. `UX60-76-32` = pull-out base, 60 cm wide, 76 cm deep, variant 32).

---

## How to read the codes

| Prefix family | Meaning |
|---|---|
| `U…` (UX, U, US, USX, UI, UIX, UG, UGX, UV, UVX, UE) | Base units. `UX`/`U…-32` = drawer pull-out; `US`/`USX` = sink base; `UI`/`UG` = hob base; `UGX…-46` = built-in oven base; `UV`/`UVX` = larder pull-out; `UE` = corner base |
| `O…` (OX, O, OR, ORX) | Wall/upper units. `OR`/`ORX` = framed-glass / range-hood wall units |
| `H…` (H, HG, HGX, HGP, HGPX, HP, HR, HS, HSP) | Tall units. `HG…` = appliance tower (oven+fridge), `HP`/`HR` = crockery/larder tall units |
| `DT`, `DTX` | Integrated-dishwasher front |
| `PU…, PO…, PUE, POE, PUX, POX, PH, PHP, DB` | Filler / corner-filler / ceiling-filler panels |
| `WS, WN, WW, WR, FM, ST` | Panel material & front material (cut-to-size end/back/decor panels) |
| `SB`, `SB-Z` | Plinth / kickboard panels + sealing profile |
| `OZ, OZV, ZHL, ZSI, UZ, ASS, MP-, X-, CUSTOMIZED` | Accessories / lights / transformers / waste sets / internal drawers / surcharges / modifiers |

Height/depth is embedded in the second number: tall units `…-227-`, `…-220-`, `…-208-` = 2080–2270 mm floor-to-ceiling; wall units `…-89-` ≈ 890 mm tall, `…-51-` ≈ 510 mm short (over-appliance) units; bases are almost universally `…-76-` (760 mm carcase).

---

## 1. BASE CABINETS

81 base units across 9 kitchens (avg **9.0 base units / kitchen**). Breakdown:

| Base subtype | Count | Share of bases |
|---|---|---|
| **Drawer / pull-out** (`UX…-32`, `U…-31`) | 47 | **58%** |
| Door base (`U…-01`, 1–2 doors) | 20 | 25% |
| Sink base (`US`, `USX`) | 6 | 7% |
| Hob base (`UI`, `UG`) | 5 | 6% |
| Corner base (`UE…-07`) | 3 | 4% |

**Drawer bases dominate door bases ~2.3 : 1.** This is the single strongest base convention. Among drawer pull-outs whose drawer count was explicit:
- **2-drawer (pan-drawer) pull-out: 26** — the default
- 1-drawer + interior pull-outs: 12
- The recurring spec is `…-32 "Pull-out unit / 2 drawers"` (two deep pan drawers) and `…-31 "Pull-out unit / 1 drawer / 2 front pull-outs"`.

**Sink base** is always present (every kitchen has ≥1), commonly a wide 2-door `USX120/US100/US80` paired with a **waste-bin sub-unit** (`…-90` "for waste bin" + `ASS-SET1-45` upright waste set).

**Most common base widths (cm):**

| Width | Count |
|---|---|
| **60** | 22 |
| **80** | 17 |
| **100** | 10 |
| 90 | 8 |
| 50 | 6 |
| 45 | 5 |
| 15 | 4 (spice/towel pull-outs) |
| 30 | 2 |
| 115/120 | 4 (sink runs) |

60 cm and 80 cm carcases account for ~half of all bases; drawer runs cluster at 60/80/90/100.

## 2. TALL UNITS

18 tall units across 9 kitchens (avg **2.0 / kitchen**; range 0–4). Two distinct roles:

- **Appliance towers** (`HG`, `HGX`, `HGP`, `HGPX`, `HS`, `HSP`) — oven + fridge/freezer surrounds, typically **60 cm wide** (also 76 cm rebuilt), **227 cm / 220 cm high (floor-to-ceiling)**. One per kitchen when present.
- **Crockery / larder tall units** (`HP`, `HR`, `H…`, `UV`, `U15-76-81/82`) — **45 cm** is the dominant width (7 of 18), at 220–227 cm full height or 144/208 cm. Frequently specced as **mirrored L/R pairs** (e.g. `HP45-227 L` + `HP45-227 R`, `H45-220-50 L` + `H45-220-50 R`).

**Grouping:** tall units are NOT all in one consecutive block. The typical pattern is a *tall run* of 2–3 crockery/larder units (often a symmetric L/R pair) PLUS a separately-placed appliance tower elsewhere in the layout. Tall heights match wall-cabinet tops, giving a flush ceiling line.

Tall height codes observed: 227 cm (×6), 220 cm (×6), 208 cm (×2), 144 cm (×2).

## 3. WALL / UPPER CABINETS

66 wall units across 9 kitchens (avg **7.3 / kitchen**) — so **wall : base ≈ 0.8 : 1** (slightly fewer walls than bases).

**Two standard heights:**
- `…-89-` ≈ **890 mm** tall wall units — 34 occurrences (the default, near floor-to-ceiling so tops align with tall units).
- `…-51-` ≈ **510 mm** short wall units — 21 occurrences (over fridge/hood/appliance bridging units).

**Glass units:** 6 of 66 wall units are framed-glass (`OR…`, `ORX…`), almost always the range-hood feature units flanking/over the cooktop.

**Widths (cm):** 40 (×13) and 60 (×12) dominate, then 90 (×10) and 50 (×8); 120 (×4) for wide feature spans. Wall-unit widths track the base/tall module grid.

Also present: open **wall shelves** (`WB50-350`, `WB25-250`) used as a styling element in most kitchens (8 occurrences).

## 4. RANGE / HOB AREA

**Highly symmetric and predictable.** In 5 of the 6 kitchens with a dedicated hob base, the hob base is flanked **left and right by identical-width drawer pull-out units**:

| Kitchen | Left | HOB base | Right |
|---|---|---|---|
| 10845 | `UX30…` pull-out | `UIX100` induction | `UX30…` pull-out |
| 10844 | `U50…` pull-out | `UG100` hob | `U50…` pull-out |
| 11185 | `UX50…` pull-out | `UIX90` induction | `UX50…` pull-out |
| 11187 | `UX50…` pull-out | `UIX90` induction | `UX50…` pull-out |
| 11246 | `U80…` pull-out | `UG100` hob | `U80…` pull-out |

The hob base itself is wide (80–100 cm, `…-32`/`…-31`/`…-38` "with top controls"). Above it sits a glass/feature wall unit (`OR`/`ORX`) or a short `…-51` bridging unit with an integrated hood and LED light. Symmetry of the flanking units is a deliberate design rule.

## 5. FILLERS / PANELS / END PANELS

These are the **highest-volume line-item category** and a major source of professional polish:

- **Filler panels:** avg **5.2 / kitchen** (range 3–11). Types: straight flush fillers (`PU…`, `PO…`, `PUX`, `POX`), **corner fillers** (`PUE`, `POE` "flush, with front 90°"), and **ceiling fillers** (`DB`, `PH`) that close the gap from cabinet top to ceiling. Corner fillers appear at every internal corner.
- **Cut panel material** (`WS`, `WN`, `WW`, `WR`, `FM`, `ST`): avg **22.9 / kitchen** — these are end panels, decor back panels, and exposed-side finishing panels priced by m². They make up **~36% of all line items**, the largest single bucket.
- **Plinth / kickboard** (`SB11`, `SB-Z11`): avg **2.3 / kitchen**, priced per linear metre, with sealing profile — present in every kitchen.

Takeaway: for every visible cabinet there are roughly **2–3 panel/filler/plinth finishing line items**. An engine that emits only carcases would under-spec the job by a large margin.

## 6. ACCESSORIES / INTERIOR FITTINGS

Frequency across the 9 kitchens (avg ~3.3 accessory + 3.3 modifier items / kitchen):

| Accessory | Count |
|---|---|
| **LED fitted lights** (`OZ`, `OZV`) + transformers (`ZHL`) | 46 |
| Internal drawers (`ZSI…`, champagne, drawer-in-drawer) | 12 |
| Upright **waste-bin sets** (`ASS-SET1-45`) | 5 |
| Sink-base metal shelf / swing-out (`UZ…`) | 3 |
| Comfort package / non-slip mat | 2 |

Plus **modifiers** (surcharges): `X-03-U` reduced carcase width, `X-35-F` amended front, `X-1245-V` LED milling surcharge, `CUSTOMIZED/CUSTOMISED` width extensions — avg 3.3/kitchen. Lighting is near-ubiquitous (LED under-cabinet + interior + transformer is a standard trio). Sink bases reliably carry a waste set + metal shelf.

## 7. THE OVERALL RECIPE

Average **main-cabinet** composition per kitchen (excluding the ~12% empty-code modifier sub-lines):

| Category | Avg / kitchen | Ratio (base = 1.0) |
|---|---|---|
| Base units | 9.0 | **1.00** |
| Wall units | 7.3 | 0.81 |
| Tall units | 2.0 | 0.22 |
| Dishwasher/appliance front | 0.8 | 0.09 |
| Filler panels | 5.2 | 0.58 |
| Plinth | 2.3 | 0.26 |
| Panel material (m²) | 22.9 | 2.54 |
| Accessories | 3.3 | 0.37 |
| Modifiers/surcharges | 3.3 | 0.37 |

**Cabinet-only ratio ≈ Base 9 : Wall 7 : Tall 2.** Add roughly 0.6 fillers and 2.5 cut-panel items per base, plus a near-constant lighting package.

---

## PROFESSIONAL CONVENTIONS TO ENFORCE (engine checklist)

A layout engine producing professional-grade schedules should satisfy these codifiable rules:

1. **Base ratio:** Aim for ~9 base units in a full kitchen; default **base:wall:tall ≈ 9:7:2** (wall slightly fewer than base, tall ≈ 2).
2. **Drawer bases dominate:** Make **~58% of base units drawer pull-outs**, ~25% doors. When in doubt, a base cabinet should be a **2-drawer pan-drawer pull-out** (the modal unit), not a single-door base.
3. **Default base width 60 cm, then 80/90/100 cm.** Snap base widths to the {45,50,60,80,90,100} cm grid; avoid odd widths except via explicit fillers.
4. **Bases sit on a 760 mm carcase** (`…-76-`); plinth/kickboard run is mandatory — emit `SB`-type plinth (per linear metre) for the full base run of every kitchen.
5. **Sink base rules:** every kitchen has exactly one sink base; it should be wide (≥80 cm, often 100–120 cm 2-door) and auto-carry a **waste-bin set + metal base shelf** accessory.
6. **Hob base must be symmetrically flanked** by two **equal-width drawer pull-outs** (enforced in 5/6 sampled kitchens). Hob base width 80–100 cm with "top controls" variant.
7. **Over-hob feature:** place a glass / framed feature wall unit (`OR`-type) or a short 510 mm bridging unit with integrated hood + LED directly above the hob.
8. **Tall units come as appliance tower + crockery run.** Allow up to one 60 cm full-height (220–227 cm) **oven+fridge tower**, plus crockery/larder tall units at **45 cm width**, frequently as **mirrored L/R pairs**. Match tall height to wall-cabinet tops for a flush ceiling line.
9. **Two wall-cabinet heights:** ~890 mm tall walls (default, tops aligned with tall units) and ~510 mm short walls over appliances/hood. Wall widths track the base grid (40/60/90 cm most common).
10. **Glass wall units are rare and intentional** (~9% of walls) — reserve for range-hood / feature positions, not general runs.
11. **Fillers are mandatory at corners and ceilings:** emit a **corner filler** (`PUE`/`POE`, 90°) at every internal corner and a **ceiling filler** where cabinet tops don't meet the ceiling. Budget ~5 filler panels per kitchen.
12. **Finishing panels scale with the job:** generate exposed end panels, decor back panels, and side-finishing panels — roughly **2–3 panel/filler line items per visible cabinet** (~23 panel-material items per kitchen). Never output bare carcases.
13. **Lighting is standard:** include an under-cabinet/interior **LED set + transformer** package by default (present in nearly every kitchen; 46 light line items / 9 kitchens).
14. **Integrated dishwasher** gets a dedicated decor front line item (`DT/DTX`) adjacent to the sink, ~0.8 per kitchen.
15. **Width adjustments are explicit:** when a cabinet must be non-standard, emit a separate **modifier/surcharge line** (`X-03-U` reduced width, `CUSTOMIZED` extend width) rather than silently resizing — pros itemize every deviation (~3 modifiers/kitchen).
