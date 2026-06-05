# European Design Guide — Curated Extraction (BookKitchen EN, 2025)

**Provenance:** Extracted from "BookKitchen EN" (181-page European kitchen design ebook), chapters 1 (Ergonomics & Measurements), 3 (Layouts), 5 (10 Unique Kitchen Designs), and 7 (10 Details That Make a Difference).

**Integration policy (IMPORTANT):**
- This guide is an ADVISORY layer. It never overrides Eclipse product data (catalog, SKUs, standard dimensions) or NKBA hard rules.
- All metric values were converted to inches and snapped to Eclipse-standard increments before entering code.
- European product/brand content (Ch4 handles hardware, Ch8 materials, Ch9 brands) was deliberately EXCLUDED — Eclipse catalog is the only source of buildable product.
- Code touchpoints: `EURO_GUIDE` constant + `EuroGuide-*` advisory checks in `src/constraints.js`; patterns tagged `source: "BookKitchen-EN-2025"` in `src/patterns.js`.

---

# Kitchen Design Rule Extraction — Chapters 1, 3, 7

Source: European kitchen design book page scans. Metric values are as printed; inch conversions are exact computed values (printed imperial equivalents shown in the book are noted where they differ).

## Ch1 Ergonomics

### Quantitative rules

| Rule | Metric | Inches | Source page |
|---|---|---|---|
| Work triangle — distance between any two zones (sink, cooktop, fridge) | 1–2 m (book: 3.28–6.56 ft) | 39.4" – 78.7" | c1-009.png |
| Work triangle — minimum leg distance (avoid too-narrow spacing) | 1.2 m (book: 3.94 ft) | 47.2" | c1-010.png |
| Work triangle — maximum leg distance (limit walking) | 2.7 m (book: 8.86 ft) | 106.3" | c1-010.png |
| Work triangle — maximum total perimeter (sum of 3 sides) | 7.9 m (book: 25.92 ft) | 311.0" | c1-010.png |
| Min countertop landing space at end of run / beside cooktop at unit end | 40 cm (book: 15¾") | 15.75" | c1-011.png |
| Ideal clearance between cooktop and sink | ≥60 cm (book: 23⅝") | 23.62" | c1-011.png |
| Min countertop between sink and end of a unit | 40 cm (book: 15¾") | 15.75" | c1-011.png |
| Min space between cooktop and dishwasher | 60 cm (book: 23⅝"); dishwasher should sit next to the sink | 23.62" | c1-011.png |
| Min countertop between oven unit and cooktop (landing for hot dishes) | 40 cm (book: 15¾") | 15.75" | c1-011.png |
| Min countertop between refrigerator unit and sink | 40 cm (book: 15¾") | 15.75" | c1-011.png |
| Standard cabinet depth (base units) | 60 cm (book: 23⅝") | 23.62" | c1-012.png |
| Base unit width, one door | 20–60 cm (book: 7⅞"–23⅝") | 7.87" – 23.62" | c1-012.png |
| Base unit width, two doors | 70–150 cm (book: 2'3½"–4'11") | 27.56" – 59.06" | c1-012.png |
| Base unit height (excluding countertop thickness) | 75–90 cm (book: 2'5½"–2'11½") | 29.53" – 35.43" | c1-012.png |
| Wall (suspended) unit depth | 30–35 cm (book: 11⅞"–13¾"; exact conversion 11.81"–13.78") | 11.81" – 13.78" | c1-012.png |
| Backsplash height (countertop to bottom of wall units) | ~70 cm (book: 2'3½") | 27.56" | c1-012.png |
| Oven housing unit — width | 60 cm (book: 23⅝") | 23.62" | c1-013.png |
| Oven housing unit — depth | 60 cm (book: 23⅝") | 23.62" | c1-013.png |
| Refrigerator housing (tall) unit — depth | 60 cm (book: 23⅝") | 23.62" | c1-013.png |
| Refrigerator housing (tall) unit — width | 60 cm (book: 23⅝") | 23.62" | c1-013.png |
| Min clearance in front of the sink | min 70 cm (diagram) | 27.56" | c1-014.png |
| Min clearance in front of the refrigerator | min 85 cm (diagram) | 33.46" | c1-014.png |
| Min clearance in front of the dishwasher | min 90 cm (diagram) | 35.43" | c1-014.png |
| Min clearance in front of a low (under-counter) oven | min 100 cm (diagram) | 39.37" | c1-014.png |
| Min clearance between a unit and facing wall | min 100 cm; 70 cm if doors are sliding (diagram) | 39.37" / 27.56" | c1-014.png |
| Min aisle between two facing base units | min 120 cm; 90 cm if doors are sliding (diagram) | 47.24" / 35.43" | c1-014.png |
| Min aisle for two people cooking together | min 140 cm (diagram) | 55.12" | c1-014.png |
| Work surface height range (min–max), shown for shorter and taller users | min ~85 cm – max ~95 cm (diagram) | 33.46" – 37.40" | c1-014.png |
| Folding/retractable window faucet — rotation to clear an opening window | 90° rotation (forward or backward, toward user) | n/a (angle) | c1b-016.png |

Note: c1-014 values are read from small diagram callouts at the limit of scan resolution; the four diagrams are titled "Minimum Distances Between Kitchen Elements Based on Circumstances," "Minimum and Maximum Heights for a Work Surface," "Height of a Backsplash and Depth of Upper and Lower Units," and "Minimum and Maximum Heights for Sliding Storage Units." The sliding-storage diagram divides a tall pull-out unit into an easy-access middle zone, harder-access zones above and below, and a very-hard-access zone at the top — exact cm callouts not legible at this scan resolution.

### Qualitative principles

- The activity (work) triangle connects sink, cooktop, and refrigerator; the goal is to minimize unnecessary movement while keeping the three points neither too far apart nor too close together. (c1-009.png)
- The sink is the most frequently used zone and the center of food prep/washing; it should be a reasonable distance from the other two points. The cooktop should be close to the sink to manage hot foods and liquids; the refrigerator should be easily accessible from both sink and cooktop. (c1-009.png)
- Triangle adaptation by layout: L-shaped — place each point across the two walls forming the corner; U-shaped — one element per wall for a compact triangle; straight/linear — keep the elements close together along the run; island — the island can host sink or cooktop to facilitate the triangle. (c1-009.png)
- If a perfect triangle is impossible (linear or open kitchens), preserve reasonable distances and add intermediate landing countertops between zones to keep ergonomics. (c1-010.png)
- The dishwasher should be placed next to the sink for good ergonomics. (c1-011.png)
- Wall-unit depth is kept shallower than base-unit depth (30–35 cm vs 60 cm) specifically so users can cook comfortably without hitting their head. (c1-012.png)
- Each manufacturer has its own variations; the standard dimensions are a general base for ergonomic design, not absolutes. (c1-012.png)
- Oven housing units must include ventilation at the top (the unit never touches the wall directly at the back/top) so hot air from the oven can escape. (c1-013.png)
- Refrigerator housing requires ventilation at the bottom (air-intake grid or open base) and at the top (gap between unit and ceiling) so air circulates around the compressor/coils. (c1-013.png)

## Ch3 Layouts

Chapter 3 is a catalog of layout archetypes presented as floor plans (available as DWG/Archicad CAD files); the rules are compositional rather than dimensional.

### Qualitative principles

- Layout catalog spans: straight (linear) kitchen, parallel (galley) kitchen, L-shaped, U-shaped, G-shaped, kitchen with island, island-with-bar, and closed kitchen with two parallel sections — choose by room size and openness. (c3-056.png – c3-060.png)
- Straight kitchen without an island is the recommended archetype for small spaces; all functions sit on one wall. (c3-057.png)
- L-shaped kitchen with a (nearly square) island suits big spaces; tall storage stacks on the short leg. (c3-057.png)
- Parallel kitchen can gain a bar corner to serve small spaces — a compact second run doubles as seating. (c3-057.png)
- L kitchen works for small spaces; U kitchen works as a kitchen niche (three sides of a compact recess); G kitchen extends the U with a peninsula bar. (c3-058.png)
- An L kitchen can integrate a dining table directly in the open corner of the plan. (c3-059.png)
- Plan with island opposite: a wall run faces a freestanding island that combines prep and dining/bar functions. (c3-059.png)
- Closed kitchen with two parallel sections: a corridor (galley) arrangement with work zones split across facing runs. (c3-059.png)
- G kitchen variant adds a dedicated bar area on the peninsula return. (c3-060.png)
- Kitchen with island: place basins (sink) and cooking surface facing each other — sink on the island, cooktop on the wall run or vice versa — to shorten the work triangle. (c3-060.png)
- Built-in back section: tall units form a full-height back wall while the island carries both cooktop and sink. (c3-060.png)
- Handle details (Ch4 pages in this batch): integrated handles cut at 45° give a minimalist look but the sharp edge can be uncomfortable and the edge is more fragile; rounded/groove integrated handles (e.g., ~2.5 cm groove between fronts) soften the grip and reading of the facade; hidden handles with metal profiling keep ceramic/heavy fronts flush; metal edge-grip and recessed top-edge profiles suit slab doors; solid wood handles on tall cabinets provide a comfortable grip and reinforced durability; raised stone edge on drop-edge countertops can act as the handle for the top drawer. (c3b-063.png, c3b-064.png, c3b-065.png)

## Ch7 Details

Chapter 7 lists "10 details that make a difference" — all qualitative design details with construction-section drawings (component callouts, no printed dimensions).

### Qualitative principles

- Detail 1 — Drawer with containers and storage guides: store utensils and pots in suitable containers inside deep drawers with metal anti-slip guide sections, instead of loose in traditional cabinets. (c7-124.png)
- Detail 2 — Linen/dish-towel drawer: use a box with a height-adjustable tray (adjustment dots) and provide ventilation in the cabinet so moisture from towels doesn't cause mold or damage. (c7-125.png)
- Detail 3 — Paper-towel drawer: a dedicated drawer or niche with a slot for the roll keeps the paper-towel holder integrated and the countertop uncluttered. (c7-125.png)
- Detail 4 — Upper cabinets that conceal the kitchen: a sliding/accordion door system above the countertop hides sink, oven, and small appliances when not in use; upper mounting must go on structure (not a false ceiling) and weight considerations are required; integrate LED lighting and finish the inside to match the backsplash. (c7-126.png)
- Detail 5 — Hidden cutting board: an under-counter sliding wooden tray (with handle, fixed mounting part) hides a cutting board beneath the countertop or extends the workspace on an island. (c7-126.png)
- Detail 6 — Side niche on the island: extend the island to create a niche with a metal rod and wood back panel for hanging towels, dishcloths, and cutting boards. (c7b-127.png)
- Detail 7 — Island corner storage: use the slim corners/ends of islands for shallow hinged-door storage, ideal for spices and other shallow items. (c7b-127.png)
- Detail 8 — Light bar and utensil rail: integrate a countertop bar combining an LED rail with a suspension rail and overhang hooks above the cooking area so utensils in active use hang within reach, with a flush-mounted gas plate and metal groove handhold. (c7b-128.png)
- Detail 9 — Knife and cutting-board chest: a countertop-adjacent chest with LED rail, hinged ceramic-covered door panel, interior container storage, and a second interior storage drawer stores knives within reach and doubles as a cutting board when opened. (c7b-128.png)
- Detail 10 — Tray-drawer under the oven: a sliding tray drawer (with handhold underneath and integrated handle) placed directly below a tall-unit oven catches dishes coming out of the oven and can double as a breakfast/bar shelf; the tall unit above uses height-adjustable interior shelves. (c7b-129.png)

---

# Chapter 5 Extraction — "10 Unique Kitchen Designs"

Source: page images c5-070.png – c5-112.png (chapter opens on c5-070, Chapter 6 begins on c5-112).
Note on dimensions: source scans are 579×819 px; dimension strings on the CAD plans/elevations are below legible resolution even after upscaling. Layout geometry, appliance positions, and zone composition were read directly from the drawings; numeric dimensions are recorded only where stated in body text or legible spec lists. Every kitchen includes downloadable DWG/Archicad/SketchUp files per the book, so exact dimensions live in those files, not the page images.

---

## Kitchen #1 — Taupe + White Marble Island on Circular Legs (c5-072 – c5-075)

- **Layout type:** Single-wall run + freestanding island (island-parallel / galley-like work pair), with dining table beyond the island.
- **Overall dimensions:** Not legible on plans; room shown in axonometric (c5-075) is a roughly rectangular space with the kitchen wall on one short side.
- **Appliance arrangement:** Tall wall run holds the oven (Samsung NV7000, clean black) and concealed storage; island carries the cooktop (Bora-type downdraft) and prep zone; black sink/tap (Quadrodesign Idealaqua Inox 383) on the island/wall run. Custom ventilation system integrated into the island for the hood — no ceiling extraction.
- **Zone composition:** Cooking moved onto the island ("opening the kitchen to adjacent areas"); wall run = tall/storage + oven zone; integrated hidden storage in the island.
- **Distinctive moves:**
  1. Island supported by **two circular legs** — furniture-like, visually floating slab.
  2. **Custom in-island ventilation** replacing a ceiling hood (decluttered ceiling).
  3. Noble-material mix: taupe-beige lacquer + white veined marble; integrated hidden storage for "discreet, efficient performance."
- **Specs (c5-075):** Quadrodesign Idealaqua Inox 383 tap; Bora M Pure cooktop; Samsung NV7000 76L oven (black); Dekton Natural-collection worktop / natural marble.

## Kitchen #2 — Light Wood + Beige Marble, Pocket-Door Niche (c5-076 – c5-079)

- **Layout type:** Single-wall (long rear run with niche) + parallel central island = parallel/galley-with-island.
- **Overall dimensions:** Not legible; rear run spans the full room width on plan (c5-077).
- **Appliance arrangement:** Rear wall: worktop niche flanked by **two retractable (pocket) doors** concealing appliance/work space when closed; oven (Miele H7460-60 BP black) in the rear run. Island: sink + Siemens inductionAir hob (hob with integrated extraction), so wet + hot zones both face the living side; integrated channel/trough in the island countertop for utensils, boards, etc.
- **Zone composition:** Rear bank = concealable working back wall (honey-colored light wood); island = beige-marble monolith with hidden storage on its front face and accessible open storage on the working rear side.
- **Distinctive moves:**
  1. **Double pocket-door niche** — entire back-wall work zone disappears when not in use.
  2. **Integrated countertop channel** (Veneta Cucine-style accessory rail) machined into the island marble.
  3. Stone-vs-wood duality: living-room-facing faces clad in stone, kitchen-side faces in wood (explicitly noted on c5-079 as a cost/lightness strategy).
- **Specs (c5-079):** Gessi Flessa HT tap; Siemens iQ700 EX877LX67E inductionAir Plus (vented hob); Miele H7460-60 BP black oven; SapienStone Arabescato surfaces.

## Kitchen #3 — Wood Slat Wall + Matte Black Island (c5-080 – c5-083)

- **Layout type:** Single-wall (tall wood-clad appliance/storage wall) + compact central island.
- **Overall dimensions:** Not legible on plan (c5-081); ventilation install space documented in a dedicated 2D section (c5-083, DWG/Archicad downloadable).
- **Appliance arrangement:** Tall wall: stacked ovens + integrated (wood-clad) refrigerator + storage cabinets. Island: sink AND cooktop combined in one large matte-black lacquered block, with **integrated downdraft hood in the cooking surface**; retractable faucet that tucks flush into the countertop.
- **Zone composition:** All tall elements (ovens, fridge, condiment storage) consolidated into one wood appliance wall; island is a pure work monolith with electrical outlets and utensil storage built in; upper cabinets dedicated to storage above.
- **Distinctive moves:**
  1. **Retractable faucet** — sink disappears, island reads as sculpture/"centerpiece, almost artistic."
  2. Hood integrated into the hob with documented installation cavity (2D detail provided).
  3. Decorative **slatted wood screen wall** behind, blending kitchen into living space.
- **Specs (c5-083):** Foster OP Gun Metal Satin tap; Foster Outline Gun Metal sink; Miele H7460-60 BP Noir oven; Grey Marble Tundra worktop.

## Kitchen #4 — Green Marble in Haussmann Apartment (c5-084 – c5-087)

- **Layout type:** Single-wall + island (island parallel to the wall run), inserted into a period room with mouldings.
- **Overall dimensions:** Not legible on plan (c5-085).
- **Appliance arrangement:** Wall run: oven built into light-wood tall/wall cabinetry, illuminated open shelf niche above the green-marble splashback; **high cabinet conceals a coffee corner** (integrated LED strip, custom layout to hide the coffee machine behind doors). Island: hob + prep (sink in wall run), entirely clad in green marble.
- **Zone composition:** Tall storage + hidden breakfast/coffee station grouped at one end; island purely work/social; upper shelves blend kitchen into living space.
- **Distinctive moves:**
  1. **Island fully wrapped in distinctive green marble (Verde Green Extra)** with a **continuous handle line routed around the entire perimeter** — a graphic groove that doubles as handleless grip and visually lightens the volume.
  2. **Concealed coffee corner** in a tall cabinet with internal LED lighting.
  3. Dialogue with Haussmann mouldings: grooves on upper door panels echo the period boiserie ("link between past and present").
- **Specs (c5-087):** Quadrodesign Idealaqua Inox 383 tap; Suter Carbone sink; Miele H7840-60 BPX 125 Gala black oven; Green Marble Verde Green Extra.

## Kitchen #5 — Light Wood + Calacatta with Integrated Round Dining Table (c5-088 – c5-091)

- **Layout type:** Single-wall (long run, tall unit at one end) + island with an attached lower-height round dining table = island/peninsula hybrid social hub.
- **Overall dimensions:** Not legible; plan (c5-089) shows island centered on a long wall run, table seating 4 cantilevered off the island end.
- **Appliance arrangement:** Wall run: sink-side perimeter + **perforated sliding-door upper storage units** (dish/kitchen-item garage); tall column at the right end (wine cave Gaggenau Série 200 under-counter per spec). Island: prep + cooking with the Arclinea countertop storage system; CEA tap.
- **Zone composition:** Uppers = perforated sliding fronts displaying/ventilating contents; island = heart of the kitchen, fused with a **rounded wood dining table set lower than worktop height** — explicit prep-vs-dining height split with improved ergonomics.
- **Distinctive moves:**
  1. **Island-integrated round dining table at lower height** with rounded edges — softens the island lines, builds conviviality.
  2. **Perforated sliding-door upper cabinets** — accessible, semi-transparent storage.
  3. LED accent lighting inside storage to enhance accessibility; beige marble + light wood "modernity meets tradition" pairing.
- **Specs (c5-091):** CEA ETW27 tap; Arclinea countertop storage system; Gaggenau wine cave Série 200 (under-counter); Marble Calacatta.

## Kitchen #6 — Dark Wood + Calacatta Viola Bar Island (c5-092 – c5-095)

- **Layout type:** Single-wall (full-width dark-wood rear bank with retractable-door niche) + central island with bar seating.
- **Overall dimensions:** Not legible; plan (c5-093) shows 4 bar stools along the living-side face of the island, tall column at the right end of the room.
- **Appliance arrangement:** Rear bank: workspace niche concealed behind **retractable side doors** (sink/appliances hidden when closed); integrated Fhiaba 75 cm column fridge; Falmec Zero ceiling-flush hood over the island hob (black induction on the island per photos c5-093/094).
- **Zone composition:** One side of the island = working face (hob), opposite side = **bar/dining face with stools** — explicit double-sided island; rear bank = storage + concealable wet/messy zone; vertical slot-handle dark wood fronts.
- **Distinctive moves:**
  1. **Bold book-matched Calacatta Viola** waterfall island as the focal sculptural object against near-black wood.
  2. **Retractable-door workspace niche** (same disappearing-kitchen strategy as #2) for "minimalist aesthetic with daily practicality."
  3. Integrated LED architectural lighting; bar side of island treated as furniture.
- **Specs (c5-095):** Gessi Venti20 tap; Falmec Zero / Zero Easy hood; Fhiaba Integrated 75 S7490FR refrigerator; Marble Calacatta (Viola-veined).

## Kitchen #7 — Wood Storage Wall + Stainless Steel Island (c5-096 – c5-099)

- **Layout type:** L-shaped perimeter (rear worktop run + side tall-unit wall) + central stainless island.
- **Overall dimensions:** Not legible; plan (c5-097) shows rear run with sink under a long niche, full-height cabinet wall on the right, island centered.
- **Appliance arrangement:** Rear run: sink + worktop with **sliding-wood-door countertop garage** ("cleverly concealing storage spaces dedicated to condiments and culinary tools" — appliance/condiment garage at splashback level). Side wall: tall units with built-in oven (Haier I-Turn). Island: hob with prep, brushed stainless steel wrap.
- **Zone composition:** Tall units consolidated on one wall; perimeter = wet + hidden everyday-tools zone; island = cooking/social centerpiece in contrasting steel.
- **Distinctive moves:**
  1. **Stainless-steel island with silk finish** — "subtle reflections and graphic details," pro-kitchen material domesticated; island as "work of art."
  2. **Sliding-door backsplash garage** keeping the worktop empty.
  3. Warm wood envelope (ceiling-height cabinetry + clay-toned walls) against cold steel — deliberate material temperature contrast.
- **Specs (c5-099):** Stainless steel countertop, silk finish; IB Acciaio AC387 tap; Haier Four I-Turn HW060SM5F5BH oven.

## Kitchen #8 — White Matte Lacquer + Black Marquina Island (c5-100 – c5-103)

- **Layout type:** L/U white perimeter (tall-unit wall + worktop wall) + long black marble island that extends into a table = island-with-integrated-table.
- **Overall dimensions:** Not legible; plan (c5-101) and axonometric (c5-103) show wraparound white cabinetry on two to three walls.
- **Appliance arrangement:** Perimeter: sink on the back run; **hood integrated into the ceiling/wall design for clean straight lines** (Falmec Silence NRS); Siemens iQ700 60×45 compact steam oven built into the tall white wall. Island: black-marble block with hob; island elevation (c5-103) shows the marble volume continuing as a thinner **table extension** with open leg frame.
- **Zone composition:** Central island adds storage dedicated to glasses, "elegantly optimizing the space"; all tall storage in floor-to-ceiling matte white lacquered wall with **integrated handles** (handleless grid); Corian backsplash for durability/easy cleaning.
- **Distinctive moves:**
  1. Stark **black-on-white duality**: black Marquina-veined island vs. seamless white lacquer walls — island/table reads as freestanding furniture.
  2. **Island-to-table height/thickness transition** in one continuous composition.
  3. **Corian backsplash** chosen as undervalued material; integrated-handle matte lacquer fronts; black faucet (Gessi Stelo) as graphic accent.
- **Specs (c5-103):** Siemens iQ700 60×45 cm built-in compact steam oven, black; Gessi Stelo faucet; Falmec Silence NRS hood.

## Kitchen #9 — Tradition-Meets-Modern L with Corner Bench (c5-104 – c5-107)

- **Layout type:** **L-shaped** wall kitchen (no island), with a corner dining bench in the opposite corner; compact-room scheme under exposed timber beams.
- **Overall dimensions:** Not legible; axonometric (c5-107) shows a small rectangular room, kitchen along the back + right wall, L-bench at front-left.
- **Appliance arrangement:** Back run: hob (Miele KM 7361 FL full-surface induction) + worktop with dark-stone splashback band; right return: **integrated refrigerator column in dark wood adorned with grooves** (Miele K 37582-55 iDF-1) + tall storage. Sink on the main run. Cooker front (range-style front) listed in specs.
- **Zone composition:** Tall zone = single dark fluted fridge column acting as furniture; rest = white lacquered base/wall units with moulding-style classic doors; dedicated **corner bench/banquette** as the convivial centerpiece.
- **Distinctive moves:**
  1. **Fluted/grooved dark wood refrigerator column** — fridge dressed as a freestanding armoire, glamour anchor.
  2. **Classic moulded door fronts with modern grooved upper-panel detail** — explicit "link between past and present," echoing the beamed/traditional shell.
  3. Corner banquette dining replaces island/table — small-space conviviality; graphic geometric stone floor.
- **Specs (c5-107):** Miele KM 7361 FL induction cooktop; cooker front; Miele K 37582-55 iDF-1 integrated fridge-freezer.

## Kitchen #10 — Minimalist White + Stainless Island in Marble Niche (c5-108 – c5-111)

- **Layout type:** Single-wall (with short return / recessed marble niche) + freestanding stainless-steel island = wall + island, lower-cabinets-only scheme.
- **Overall dimensions:** Not legible; plan (c5-109) shows perimeter run with sink + DW (dishwasher labeled), island centered in front of a marble-lined wall niche.
- **Appliance arrangement:** Perimeter: sink + dishwasher in white/marble base run set inside a **recessed marble niche** (no wall cabinets at all — "exclusively lower cabinetry"); island: **Bora S Pure induction with integrated extractor (air-recycling)** + second prep face; black sprung tap on the island in photos.
- **Zone composition:** Upper storage deliberately absent ("absence of upper storage keeps the structure light and avoids visual clutter"); island is a stainless cube with **four push-on magnetic-opening door fronts** (elevation c5-111 annotates "ouverture magnétique type push-on" on each panel); storage consolidated below worktop height.
- **Distinctive moves:**
  1. **No wall units anywhere** — radical lower-cabinet-only minimalism with a marble display niche instead of uppers.
  2. **Stainless island with handleless push-on magnetic doors**, silk-finish steel meeting white marble.
  3. In-hob extraction (Bora) eliminating any visible hood — ceiling kept bare except a single pendant.
- **Specs (c5-111):** Stainless steel countertop, silk finish; IB Acciaio AC387 tap; Bora S Pure induction cooktop with integrated extractor (air-recycling system).

---

## Recurring Patterns (seen in 3+ of the 10 designs)

1. **Island as the social/working heart, wall run as servant zone** — 9 of 10 designs (#1–#8, #10) pair a single back wall (or L) of storage/tall units with a freestanding island carrying hob and/or sink; only #9 (small room) omits the island.
2. **Hob extraction integrated into the cooktop or island — no visible hood** — #1 (custom in-island ventilation), #2 (Siemens inductionAir), #3 (hob-integrated hood with install detail), #10 (Bora S Pure); #8 hides the hood in the ceiling plane and #6 uses a ceiling-flush Falmec Zero. Decluttered ceilings are a chapter-wide doctrine.
3. **Disappearing work zones: pocket/retractable doors and garages** — #2 (double pocket-door niche), #6 (retractable side doors on the workspace niche), #7 (sliding-door countertop garage), #4 (coffee corner concealed in tall cabinet). The kitchen must be able to "switch off" visually toward the living space.
4. **Statement stone monolith island, waterfall-wrapped** — #2 (beige marble), #4 (green Verde Extra), #6 (Calacatta Viola), #8 (black Marquina), plus marble-topped islands in #1 and #5; book-matched dramatic veining is the focal point in every stone scheme.
5. **Handleless or integrated-handle fronts** — #4 (perimeter routed handle groove), #8 (integrated handles in matte lacquer), #10 (push-on magnetic doors), #6/#3 (slot/edge grips on dark fronts). No visible hardware anywhere in the chapter.
6. **Tall units consolidated into a single appliance/storage wall** — #1, #3, #6, #7, #8, #9 group ovens + integrated fridge + pantry into one floor-to-ceiling bank, keeping the rest of the room at worktop height.
7. **Material-temperature contrast: warm wood envelope vs. one cold "object"** (stone or steel island) — #1, #2, #3, #5, #6, #7; #2 makes it explicit policy: stone facing the living area, wood on the working side, also as a cost-control device.
8. **Island doubling as dining: integrated tables, lowered levels, or bar seating** — #1 (table beyond island), #5 (built-in lowered round table), #6 (4-stool bar face), #8 (island extends into table); conviviality engineered into the work core.
9. **Integrated countertop channels/accessory systems** — #2 (machined channel, Veneta Cucine reference), #5 (Arclinea countertop storage system), #7 (backsplash garage): the worktop itself is organized so the surface stays empty.
10. **Spec pattern:** premium European appliance set repeats — Miele ovens (#2, #3, #4, #9), Gessi taps (#2, #6, #8), Bora/Siemens vented hobs (#1, #2, #10), integrated columns (Fhiaba, Miele, Gaggenau wine cave); surfaces are SapienStone/Dekton/natural marble. Each design ships with DWG/Archicad/SketchUp files (noted on #1, #3, #7, #8, #9), so the book treats these as buildable technical packages, not mood boards.
