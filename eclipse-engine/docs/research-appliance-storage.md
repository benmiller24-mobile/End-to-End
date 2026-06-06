# Professional Kitchen Design: Appliance Placement & Function-Based Storage

Research compiled for a kitchen layout engine. Every rule below gives the concrete, quantitative version plus a one-line rationale. Quantitative clearances are anchored to the **NKBA Kitchen Planning Guidelines with Access Standards** (the professional standard), supplemented by working kitchen designers (Vestabul School of Design, Dura Supreme, CliqStudios), This Old House, Houzz pros, Fine Homebuilding, Living Etc, Blum, and others. Each section ends with an **ENGINE IMPLEMENTATION** block of codifiable rules.

A note on units: NKBA recommendations are the source of truth for distances. Where designers cite ranges (e.g. "12–15 in"), the NKBA hard number is given first.

---

## 0. ORGANIZING FRAMEWORK: Work Triangle vs. Five Work Zones

### The Work Triangle (NKBA Guideline 3)
The three primary work centers — **cooking surface, cleanup/prep sink, refrigeration** — form a triangle.
- Each leg measured **center-front of appliance to center-front of appliance**.
- Each leg **≥ 4 ft (1.2 m) and ≤ 9 ft (2.7 m)**.
- Sum of all three legs **≤ 26 ft (7.9 m)**.
- **No leg may be intersected by an island/peninsula or other obstacle by more than 12 in (305 mm).**
- **No major traffic pattern should cross through the triangle** (Guideline 5).
- **No full-height, full-depth obstacle** (tall oven cabinet, pantry, fridge) should separate two work centers (Guideline 4); a recessed tall corner unit is acceptable.
- *Why:* minimizes walking between the three highest-traffic stations; the triangle is the right framework for single-cook kitchens under ~100 sq ft and galley/single-wall layouts.

### The Five Work Zones (modern, multi-cook, Blum "Dynamic Space")
Zones group **tools + surface + storage by task**, so two cooks don't cross paths. Better than the triangle for large kitchens, islands, and multi-cook households. The five zones and what each contains:

1. **Consumables** — pantry, refrigerator, dry goods (tins, rice, pasta), shopping-bag drop. *Place closest to the entry/garage door* so groceries are put away without crossing the kitchen.
2. **Non-consumables** — dishes, glassware, cutlery, serving pieces. *Place adjacent to the dishwasher/sink* so unloading is a pivot, not a walk.
3. **Cleaning** — sink, dishwasher, waste/recycling pull-outs, cleaning supplies (sponges, dish soap, household cleaner). The operational center.
4. **Preparation** — the main worktop; knives, cutting boards, mixing bowls, spices, prep tools. *Sits between the cleaning zone and cooking zone* (you wash → prep → cook in sequence).
5. **Cooking** — cooktop/range, oven, hood, microwave/steamer; pots, pans, cooking utensils, baking trays, oils/spices.

*Why the ordering matters:* the natural workflow is **Consumables → Cleaning → Prep → Cooking**, mirroring how food moves (store → wash → cut → cook). Designers lay zones out in that left-to-right (or counterclockwise) sequence to eliminate backtracking.

### ENGINE IMPLEMENTATION — framework
- `triangle.leg_length` ∈ [48 in, 108 in] for each of the 3 legs (fridge↔sink, sink↔cooktop, cooktop↔fridge); measured center-front to center-front.
- `triangle.perimeter` ≤ 312 in (26 ft). Score: penalize as perimeter → 312; hard-fail > 312.
- Hard constraint: no island/wall edge crosses any triangle leg by > 12 in.
- Hard constraint: no full-height unit (fridge, tall oven, pantry) lies *between* two of the three work centers on the same run.
- Hard constraint: no defined traffic/circulation path segment intersects the triangle interior.
- Zone model: assign every cabinet/appliance a `zone ∈ {consumables, non_consumables, cleaning, prep, cooking}`. Score layouts higher when zones appear in workflow order (consumables→cleaning→prep→cooking) along the primary run, and when each zone's storage is co-located with its appliance.
- Use triangle scoring for kitchens < ~100 sq ft / single-run / galley; use zone scoring for ≥ 2 cooks, islands, or > ~150 sq ft.

---

## 1. APPLIANCE PLACEMENT

### 1.1 Refrigerator
- **Place at the END of a cabinet run (or near the kitchen entry), never mid-run.** *Why:* it's the tallest, deepest box; mid-run it severs the counter into two short useless stretches and blocks the work triangle (NKBA G4: full-height obstacle must not separate work centers). End placement keeps traffic out of the cook lane and lets the deep box terminate the run cleanly.
- **Never bury it in a corner against a wall.** *Why:* the door can't open the full ~90–120° and the crisper/freezer drawers can't clear the wall (Living Etc, designers' #1 fridge mistake).
- **Landing area (NKBA G16): ≥ 15 in (381 mm)** of counter on the **handle side** of the fridge; OR 15 in on either side of a side-by-side; OR 15 in no more than 48 in across from the front; OR 15 in above/adjacent to an undercounter unit. *Why:* a place to set the carton/bag the instant the door opens.
- **Door swing / hinge direction: hinge so the door opens TOWARD the nearest landing counter and toward the prep zone**, never into circulation or against a wall. On a single door, choose/reverse the hinge so it swings toward the adjacent counter; French-door and counter-depth models sidestep most swing conflicts. *Why:* you pull food out and pivot directly to the landing/prep surface without walking around the door.
- **Door-swing clearance:** a full-depth door needs roughly **36 in** of swing clearance; allow ~**42 in from opposing wall/island** so the door clears 90° and drawers/shelves pull out. Hinge-side minimum to crack the door for drawer pull-out is ~4.5 in; ~7.5 in to remove shelves. *Why:* prevents the door from jamming on a wall and lets bins extend.
- **Counter-depth (~24–25 in) is preferred** when the fridge sits at a run end next to standard 24-in cabinets, so it doesn't bulge into the walkway; pair with a microwave cabinet beside it to bridge the depth from 24-in deep fridge gable to 12-in upper.

#### ENGINE IMPLEMENTATION — refrigerator
- `fridge.position` MUST be a run terminal (first or last unit in a base/tall run) OR adjacent to a defined entry node.
- Hard-fail if `fridge` is in an inside corner OR has < `door_width` clearance for the door to open ≥ 90°.
- Require ≥ 15 in landing counter on the handle side (or per the 4 NKBA alternatives a–d).
- `fridge.hinge_side` chosen so the open door faces the nearest landing/prep zone; score down if door opens into a walkway or toward a wall < door-width away.
- Require ≥ 36 in (prefer 42 in) of clear floor in front of the fridge for door swing.

### 1.2 Range / Cooktop
- **Never under an operable window (NKBA G20a).** *Why:* fire hazard (curtains/blinds), grease on glass, heat can break the insulated-glass seal, and you can't put a hood over it. Code allows ≥ ~12 in side gap to a window only when unavoidable.
- **Never at the end of a run.** A cooking surface needs **landing on BOTH sides**: **≥ 12 in (305 mm) on one side and ≥ 15 in (381 mm) on the other (NKBA G17).** End-of-run gives landing on only one side — unsafe (nowhere to set a hot pan) and you can knock the handle. *Why:* hot-pot landing on both sides + balanced look.
- **Not in a corner**, and on an island/peninsula keep **≥ 9 in (229 mm) of counter behind** the surface at the same height (NKBA G17) so nothing tips off the back.
- **Centered as a focal point** with balanced cabinetry/landing on both sides. *Why:* function (landing both sides) and aesthetics (it's the visual anchor).
- **Hood centered over the cooktop, aligned to the cooking surface — not to surrounding cabinets.** Hood width ≥ cooktop width (often +3 in each side). *Why:* an off-center hood leaves part of the burners uncaptured, letting smoke/grease escape.
- **Hood mounting height above cooktop:** typically **24–30 in** (NKBA/IRC: ≥ 24 in to a protected noncombustible surface; ≥ 30 in to combustible material/metal cabinets; a listed hood may reduce to 24 in). Over-the-range microwaves follow the manufacturer's spec.
- **Ventilation:** ducted to outdoors; **≥ 100 cfm (code) / ≥ 150 cfm (NKBA recommended)**; > 400 cfm requires makeup air.
- **Controls must not require reaching across burners** (accessibility + safety).

#### ENGINE IMPLEMENTATION — range/cooktop
- Hard-fail if `cooktop` is directly below a window OR < 12 in horizontally from an operable window edge.
- Hard-fail if `cooktop` is at a run terminal or in a corner (cannot satisfy two-sided landing).
- Require landing ≥ 12 in on one side AND ≥ 15 in on the other, at cooktop height.
- If on island/peninsula, require ≥ 9 in counter behind the burners.
- `hood.center_x` == `cooktop.center_x` (align to appliance, not cabinets); `hood.width` ≥ `cooktop.width`.
- `hood.height_above_cooktop` ∈ [24 in, 30 in]; default 30 in over combustibles, 24 in min with listed hood.
- Score "focal point" higher when cooktop is centered on its wall run with symmetric flanking landing.

### 1.3 Sink (cleanup/prep)
- **Single sink (NKBA G10): locate adjacent to or across from the cooking surface and refrigerator** — i.e. on a triangle leg, central to the workflow.
- **Commonly centered under a window** *Why:* natural light and a view while washing/prepping (preference, not a hard rule).
- **Landing area (NKBA G11): ≥ 24 in (610 mm) on one side and ≥ 18 in (457 mm) on the other.** *Why:* a stacking zone for dirty dishes on one side, drying/clean on the other.
- **Prep area (NKBA G12): a continuous run ≥ 36 in wide × 24 in deep immediately next to the sink.** *Why:* the primary cutting/prep surface lives beside water.
- **Storage at sink (NKBA G28):** locate ≥ 400 in (small) / 480 in (medium) / 560 in (large kitchen) of shelf+drawer frontage within **72 in of the sink centerline** — the densest-use storage band.

#### ENGINE IMPLEMENTATION — sink
- `sink` must lie on a triangle leg (adjacent to or across from cooktop and fridge).
- Require ≥ 24 in landing on one side, ≥ 18 in on the other.
- Require ≥ 36 in × 24 in continuous prep counter immediately adjacent (this is the prep zone anchor).
- Prefer (score, not hard) sink centered on a window if one exists.
- Concentrate ≥ 400–560 in of shelf/drawer frontage within 72 in of sink centerline by kitchen size.

### 1.4 Dishwasher
- **Within 36 in (914 mm)** of the nearest edge of the cleanup/prep sink (NKBA G13). *Why:* drips travel from plate→sink→DW; farther means spills across the floor.
- **Standing/clear space: ≥ 21 in (533 mm)** between the dishwasher edge and any counter/appliance/cabinet at a right angle to it (NKBA G13); plus a 30 × 48 in clear floor space at the open door. *Why:* room to stand and load with the door down.
- **Handedness — which side of the sink:** put the dishwasher on the side that matches the user's dominant hand. A **right-handed** person holds the dish in the **left** hand and scrapes with the right, so loading is easiest with the **dishwasher to the LEFT of the sink**; reverse for left-handed users. Default to **the side toward the non-consumables (dish/glass) storage** so unloading is a single pivot. *Why:* fewest twists scraping→loading and unloading→putting away.
- **Don't let the open door block** a frequently used drawer/cabinet, the oven, or a walkway (common mistake). Don't place it across the kitchen from the sink.

#### ENGINE IMPLEMENTATION — dishwasher
- Hard constraint: `dist(dishwasher.edge, sink.edge)` ≤ 36 in.
- Require ≥ 21 in standing space between DW and any perpendicular cabinet/appliance; require 30×48 in clear floor at the door.
- `dishwasher.side_of_sink`: prefer the side toward the dish/glass (non-consumables) storage AND matching user handedness (left of sink for right-handed default).
- Score down if the open DW door overlaps a walkway, the oven door swing, or a high-use drawer face.

### 1.5 Microwave
- **Height (NKBA G21):** the **bottom of the microwave 3 in below the principal user's shoulder, and no more than 54 in (1372 mm) above the floor.** If below the counter, the **oven bottom ≥ 15 in (381 mm) off the floor.** Accessible controls ≤ 46–48 in. *Why:* lifting hot/heavy liquid above shoulder height is the main scald risk.
- **Landing (NKBA G22): ≥ 15 in adjacent to / above / below the handle side.** *Why:* set the hot dish down immediately.
- **Type preference:**
  - **Drawer microwave (in a base cabinet or island):** ergonomic — slide-out, no reaching/bending, frees counter and uppers; preferred in contemporary design (cost ~$1,000+, hard to retrofit). Keep above ~15 in off floor; not so low that kids reach hot food.
  - **Built-in wall / tall-cabinet:** sleek, at a safe height, with adjacent landing counter; better than over-the-range because you're not reaching over a hot cooktop. Often paired beside the fridge or stacked above the wall oven.
  - **Over-the-range (OTR):** saves counter and adds venting, but **reaching over a hot cooktop is a scald hazard** and it's too high for anyone under ~5'2". Designers avoid OTR for families with kids/shorter users.

#### ENGINE IMPLEMENTATION — microwave
- `microwave.bottom_height` ≤ 54 in AFF (and ≥ 15 in if below counter); controls ≤ 48 in.
- Require ≥ 15 in landing on the handle side (or above/below).
- Type score: drawer ≈ built-in-wall > OTR. Penalize OTR when household flags kids or short stature; OTR allowed only when it doubles as the required hood and user opts in.
- Forbid placing the microwave such that retrieval requires reaching across an active cooktop, unless it is an OTR unit explicitly chosen.

### 1.6 Wall Ovens / Tall Units (ovens, pantry, fridge surrounds)
- **Place tall units at the END of a run**, not mid-run, so they don't break a continuous counter (NKBA G4: a full-height obstacle must not separate two work centers). *Why:* a tall cabinet mid-run kills counter continuity and severs the triangle.
- **Group tall units together** (oven tower + pantry + fridge surround) into one "tall wall" so all counters stay continuous on the other runs.
- **Wall oven landing (NKBA G23): ≥ 15 in next to or above the oven**, or ≥ 15 in no more than 48 in across from it if the door doesn't open into a walkway. *Why:* a heatproof spot for the hot tray the moment it comes out.
- **Stacking convention:** microwave (or speed/convection) **above** the wall oven, optional warming drawer **below** — consolidates ovens and electrical rough-in. Place the most-used oven/speed-oven at a comfortable height; set top-oven controls near user eye level.
- **For side-opening (French/single) oven doors, the latch side must be next to a countertop** (NKBA/ICC G23) so you can transfer trays.
- **An oven tower placed perpendicular to a counter run** guarantees adjacent landing while keeping all tall units lined up.

#### ENGINE IMPLEMENTATION — tall units / wall ovens
- Hard constraint: `tall_unit.position ∈ {run terminal}`; never interior to a counter run between two work centers.
- Prefer clustering all tall units (oven tower, pantry, fridge enclosure) into a single contiguous "tall wall."
- Require ≥ 15 in landing adjacent to (or ≤ 48 in across from, non-walkway) the oven.
- For side-hinged oven doors, require counter on the latch side.
- Stack order template: microwave/speed-oven (top) → wall oven → warming drawer (bottom).

### 1.7 Trash / Recycling Pull-Out
- **≥ 2 waste receptacles (NKBA G15): one at the cleanup/prep sink, one for recycling in or near the kitchen.** *Why:* scraping and most waste happens at the sink; keep bins in the cleaning zone and off the traffic path.
- Pull-out trash sits in the **base cabinet immediately beside the sink** (cleaning zone), not under the prep counter where you need knee/leg space.

#### ENGINE IMPLEMENTATION — waste
- Require ≥ 2 waste pull-outs; ≥ 1 in the base cabinet directly adjacent to the cleanup sink (within the cleaning zone), ≥ 1 recycling nearby.
- Do not place the waste pull-out under the primary prep run if it blocks a seated/standing knee space.

### 1.8 Common Appliance-Placement MISTAKES pros avoid
- **Fridge jammed in a corner** → door won't fully open, drawers won't clear. → Put it at a run end with handle-side landing.
- **Range at the end of a run / range under a window** → only one-sided landing, fire hazard, no hood. → Center it with two-sided landing.
- **Dishwasher across the kitchen from the sink, or its open door blocking a drawer/oven/walkway.** → Within 36 in of the sink, hinged so the door doesn't block traffic.
- **Tall cabinet (oven/pantry) mid-run** breaking the counter and the triangle. → Move tall units to run ends.
- **Oven/cooktop with no nearby landing** for hot trays/pans. → Always provide the NKBA landing (15 in oven, 12/15 in cooktop).
- **Microwave over the range** for short users / kids → scald risk. → Use drawer or built-in.
- **A full-height obstacle separating two work centers** or **traffic crossing the triangle.** → Keep the triangle clear.

---

## 2. FUNCTION-BASED STORAGE (what goes where)

Core principle (NKBA + zone model): **store each item at its point of first use.** Storage is co-located with the appliance/zone where the item is used.

| Item class | Stored at / near | Why |
|---|---|---|
| Pots, pans, lids, cooking utensils, baking trays, oils, cooking spices | **Cooking zone** — base drawers flanking the range/cooktop; pan drawer below the cooktop | Grabbed and used at the burners; deep drawers beside the range eliminate carrying. |
| Knives, cutting boards, mixing bowls, prep tools, prep spices | **Prep zone** — drawers in the 36-in prep run beside the sink | Used on the prep counter between wash and cook. |
| Everyday dishes, glasses, mugs, cutlery, serving pieces (non-consumables) | **Cleaning zone** — uppers/drawers immediately beside the dishwasher/sink | Unloading the dishwasher is a single pivot, not a walk. |
| Dry food, canned goods, snacks (consumables) | **Consumables zone** — pantry + cabinets beside the fridge, near the entry | Groceries put away near where they enter; cooking ingredients pulled near the fridge. |
| Dish soap, sponges, scrubbers, household cleaners, waste/recycling | **Cleaning zone** — under-sink base + trash pull-out beside sink | Cleaning supplies belong where cleaning happens; under-sink for plumbing-adjacent items. |

Reinforce with the NKBA "storage at sink" rule (G28): the **densest band of storage (400–560 in of frontage) within 72 in of the sink centerline**, because the sink/cleanup/prep cluster is the busiest part of the kitchen.

### Drawers vs. Doors for base cabinets
- **Prefer DRAWERS over doors for base cabinets.** *Why:* full-extension drawers bring contents *out to you* — you see and reach everything without bending into a dark box or losing items at the back. Doors + fixed shelves hide the back third of the cabinet and require kneeling. Corner cabinets especially: a drawer or pull-out beats a deep dark door (NKBA G29 requires a functional device in at least one corner).
- Designers now spec mostly drawer banks in base cabinets, reserving doors for the sink base (plumbing), trash pull-out, and tall pantry.

### Drawer depth → contents
- **Deep drawers (≈ 10–12+ in interior) for pots, pans, mixing bowls, and pantry items** — stackable, heavy, organized with pegs/dividers; placed in the cooking and prep zones.
- **Shallow drawers (top of a bank) for cutlery, utensils, spices, gadgets** — keeps small tools visible and separated with inserts.
- Typical 3-drawer base: shallow (utensils) on top, then two deep (pots/pans/bowls) below.

### ENGINE IMPLEMENTATION — storage
- Tag each storage cabinet with a `stored_item_class` and require it to sit in the matching `zone`:
  - cookware/bakeware/cooking-utensils → adjacent to `cooktop`/`oven` (cooking zone).
  - prep tools / knives / boards / bowls → in/adjacent to the prep run beside `sink`.
  - dishes / glasses / cutlery (non-consumables) → adjacent to `dishwasher`/`sink`.
  - dry & canned food (consumables) → `pantry` or cabinet adjacent to `fridge`, near entry.
  - cleaning supplies + waste → under-sink base + base beside `sink`.
- Score: `storage_colocation = Σ (item used in zone Z stored within reach of zone Z)`; penalize cross-zone storage (e.g., pans stored by the fridge).
- Enforce NKBA G28: ≥ 400/480/560 in (small/med/large) of shelf+drawer frontage within 72 in of the sink centerline.
- Cabinet type rule: default base cabinets to **drawer banks**; force doors only for sink base, trash pull-out, and tall pantry.
- Within a drawer bank: top = shallow (`utensils/cutlery/spices`), lower 2 = deep (`pots/pans/bowls`). Require a deep drawer (≥ 10 in interior) for any cabinet tagged `cookware`.
- Corner base cabinets must contain a functional pull-out/lazy-Susan device (NKBA G29).

---

## KEY QUANTITATIVE REFERENCE TABLE (NKBA hard numbers)

| Element | Rule | Value |
|---|---|---|
| Work-triangle leg | each leg | 48–108 in (4–9 ft) |
| Work-triangle total | sum of 3 legs | ≤ 312 in (26 ft) |
| Work aisle | 1 cook / multiple cooks | ≥ 42 in / ≥ 48 in |
| Walkway | min width | ≥ 36 in |
| Fridge landing | handle side | ≥ 15 in |
| Cooktop landing | two sides | ≥ 12 in and ≥ 15 in |
| Cooktop behind (island) | min counter behind burners | ≥ 9 in |
| Cooktop–hood clearance | above surface | 24–30 in |
| Hood ventilation | exhaust rate | ≥ 100 cfm code / ≥ 150 cfm rec. |
| Sink landing | two sides | ≥ 24 in and ≥ 18 in |
| Prep area | beside sink | ≥ 36 in wide × 24 in deep |
| Dishwasher–sink | edge to edge | ≤ 36 in |
| Dishwasher standing space | to perpendicular cabinet | ≥ 21 in |
| Microwave bottom height | max AFF | ≤ 54 in (≥ 15 in if below counter) |
| Microwave landing | handle side | ≥ 15 in |
| Oven landing | beside/above | ≥ 15 in |
| Clear floor at each appliance | — | 30 × 48 in |
| Storage near sink | frontage within 72 in of centerline | ≥ 400 / 480 / 560 in (S/M/L) |
| Total countertop frontage | 24 in deep | ≥ 158 in |

---

## Sources

- NKBA Kitchen Planning Guidelines with Access Standards (official PDF): https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf
- NKBA Kitchen Planning Guidelines (pre-2023 PDF): https://nkba-ps.com/images/downloads/Awards/nkba_kitchen_planning_guidelines_pre_2023.pdf
- NKBA Design Guidelines summary — Simply Cabinetry: https://www.simplycabinetry.com/design-guidelines-nkba
- Kitchen Design Guidelines & Clearances — Wholesale Cabinet Supply: https://www.thewcsupply.com/pages/kitchen-design-guidelines-standard-clearances
- Kitchen Dimensions: Code Requirements & NKBA Guidelines — CRD Design Build: https://www.crddesignbuild.com/blog/kitchen-dimensions-code-requirements-nkba-guidelines/
- Kitchen Design Rules: Plan Zones, Layouts, and Clearances — WonderHowTo: https://interior-design.wonderhowto.com/how-to/kitchen-design-rules-plan-zones-layouts-and-clearances/
- Kitchen zones – an alternative to the kitchen work triangle — Naked Kitchens: https://www.nakedkitchens.com/blog/the-kitchen-expert/kitchen-zones-an-alternative-to-the-kitchen-work-triangle
- The Kitchen Work Triangle — CliqStudios: https://www.cliqstudios.com/work-triangle-floor-plan/
- Kitchen Clean-Up Zone — CliqStudios: https://www.cliqstudios.com/blog/kitchen-clean-up-zone/
- Five Zones / Dynamic Space — Blum Inspirations: https://www.blum-inspirations.com/en-eu/ideas/checklist-ten-steps-to-your-dream-kitchen
- Blum Dynamic Space (PDF): https://www.ldlonline.co.uk/media/wysiwyg/others/media/dynamic-space.pdf
- 5-Zone Principle — Saviesa: https://www.saviesahome.com/blog/5-zone-principle-in-kitchen-design/
- Your kitchen zones — Van Hoecke: https://www.vanhoecke.be/en/solutions/practical-kitchen/your-kitchen-zones
- Planning for Kitchen Appliance Landing Areas — Dura Supreme: https://www.durasupreme.com/blog/kitchen-appliance-landing-areas-design-101/
- Kitchen Work Zones: Clean-Up Zone — Dura Supreme: https://www.durasupreme.com/blog/creating-your-kitchen-clean-zone/
- Kitchen Prep Zone Design — Dovetail Contracting: https://www.dovetailcontractingllc.com/post/kitchen-prep-zone-design
- The Best Locations for Placing Wall Ovens — Vestabul School of Design: https://vestabul.com/2021/03/09/the-best-locations-for-placing-wall-ovens-in-your-kitchen-designs/
- Placing the Microwave in Your Kitchen Designs — Vestabul: https://vestabul.com/2022/07/19/placing-the-microwave-in-your-kitchen-designs/
- Refrigerator Placement in Kitchen Design — Kitchinsider: https://kitchinsider.com/refrigerator-placement-in-kitchen/
- Where to Put a Refrigerator — KitchenAid: https://www.kitchenaid.com/pinch-of-help/major-appliances/refrigerator-placement-in-kitchen.html
- Where to put a microwave in the kitchen — Whirlpool: https://www.whirlpool.com/blog/kitchen/where-to-place-a-microwave.html
- Making Room for the Microwave — This Old House: https://www.thisoldhouse.com/kitchens/21015356/making-room-for-the-microwave
- Microwave Placement in the Kitchen — CRD Design Build: https://www.crddesignbuild.com/blog/where-do-you-put-the-microwave/
- Six Perfect Places to Put the Microwave — CliqStudios: https://www.cliqstudios.com/blog/six-perfect-places-to-put-the-microwave-in-your-new-kitchen/
- Where to Put the Dishwasher in Your Kitchen — Houzz: https://www.houzz.com/magazine/where-to-put-the-dishwasher-in-your-kitchen-stsetivw-vs~81474076
- Where to Put Your Sink and Cooktop — Houzz: https://www.houzz.com/magazine/where-to-put-your-sink-and-cooktop-stsetivw-vs~147878741
- Range Hood Height Guide — CopperSmith: https://www.worldcoppersmith.com/articles/range-hood-placement-101-distance-above-cooktop--common-misconceptions/
- Range Hood Height Above Stove — KitchenAid: https://www.kitchenaid.com/pinch-of-help/major-appliances/range-hood-height-above-stove.html
- Range Hood Installation Do's and Don'ts — Victory Range Hoods: https://victoryrangehoods.com/blogs/range-hoods/range-hood-installation-dos-and-donts
- 5 Tips for Designing a Range Hood Wall — Carla Aston / DESIGNED: https://carlaaston.com/designed/5-tips-for-designing-range-hood-wall-in-kitchen
- Cooking surface clearance / window discussion — Fine Homebuilding: https://www.finehomebuilding.com/forum/cabinet-clearance-around-range-top
- Can You Have Range At End Of Cabinet Run? — DropByMyHouse: https://dropbymyhouse.com/range-at-end-of-cabinet-run/
- 5 Appliance Positioning Mistakes Kitchen Designers Avoid — Living Etc: https://www.livingetc.com/advice/kitchen-appliance-positioning-mistakes
- Kitchen Appliance Layout Mistakes to Avoid — Mountain High Appliance: https://www.mountainhighappliance.com/blog/kitchen-appliance-layout-mistakes-to-avoid
- 5 Kitchen Layout Mistakes — Sunset: https://sunset.com/home-garden/design/kitchen-layout-mistakes
- Avoid These Common Kitchen Design Mistakes with Appliances — Leicht Queens: https://www.leichtqueens.com/post/kitchen-appliance-design-mistakes
- Drawers vs. Doors: Rethink Kitchen Storage Like a Designer — Arcadia Kitchen & Bath: https://www.arcadiakitchenbath.com/blog/drawers-vs-doors-how-to-rethink-kitchen-storage-like-a-designer
- Drawers vs. Cabinet Doors — Plowman Kitchen & Bath: https://plowmankitchenbath.com/drawers-vs-cabinet-doors/
- Is it better to have doors or drawers in a kitchen? — Homes & Gardens: https://www.homesandgardens.com/kitchens/is-it-better-to-have-doors-or-drawers-in-a-kitchen
- The Drawer vs. Door Base Cabinet Dilemma — Nelson Kitchen & Bath: https://nelsonkb.com/dilemma-on-drawer-vs-door-base-cabinet-resolved/
- How to Choose Kitchen Cabinets with Drawers vs. Doors — Decor Cabinets: https://decorcabinets.com/blog-kitchen-cabinets-with-drawers-vs-doors/
- Expert Tips for Kitchen Appliances Placement — Kitchen Design NYC: https://www.kitchen-design-nyc.com/post/kitchen-appliance-placement
- Mod Cabinetry NKBA Guideline summary: https://www.modcabinetry.com/nkba-guideline/
