# Professional Kitchen Design: Molding, Trim & Storage Cabinetry

Research compiled for the Kitchen Design Engine. Every rule below gives the concrete, quantitative version plus a one-line "why." A codifiable **ENGINE IMPLEMENTATION** section follows each part, and a master rule list closes the document.

---

# PART 1 — MOLDING & TRIM: PLACEMENT AND WHY

## 1.1 Crown Molding (top of wall/tall cabinets)

**What & dimensions**
- Crown caps the top of wall and tall cabinets. Standard wall cabinets come in **30", 36", 42", 48"** heights. With a standard **8' (96") ceiling**, a 42" upper set on a 54" base-of-upper line leaves little room; with a **9' (108") ceiling**, designers spec **42" uppers + 3–6" of crown** to close the gap.
- The crown/soffit gap professionals leave between cabinet top and ceiling is typically **3" to 6"**. Crown fills this so cabinets don't appear to "float."
- **Single crown** = one profile on the cabinet top. **Stacked crown** = a *starter/riser molding* fastened to the cabinet frame first, then crown on top — used to gain height and to **absorb an uneven ceiling**. A two-part (stacked) crown is the standard way to take cabinets to a finished ceiling on 8' walls (cabinetry reaches ~90", crown bridges to 96").

**When crown vs. no crown**
- **Crown to the ceiling** when the cabinet top is within roughly **1"–6"** of the ceiling (close enough that crown can bridge it cleanly). Why: hides the gap, gives a built-in custom look, conceals the inevitable out-of-level ceiling line.
- **Crown as a top cap (not to ceiling)** when there is a large open reveal above (e.g., 12"+ to a high ceiling) and the design intends open space above cabinets. Why: a decorative finished top edge without forcing a ceiling connection.
- **No crown** in flat/modern/frameless ("slab") designs, or when cabinets are full-height to ceiling with a tight scribe and a contemporary look is wanted. Why: stylistic; crown reads traditional.

**How it scribes to the ceiling**
- Choose a profile with **mass at the top** so material is available to scribe. Hold the crown level, keep a **consistent reveal** between the bottom of the crown and the cabinet top, push up to the **lowest point** of the ceiling, set the scribe tool to the largest gap, and trace/cut. Why: a wavy ceiling otherwise leaves a visible tapering gap.
- Caulk closes gaps up to **~1/4"**. Larger waves: scribe the crown, or float the ceiling flat with joint compound to meet a level crown. Why: caulk lines over ~1/4" crack and look amateur.

## 1.2 Light Rail / Under-Cabinet Valance Molding

- Mounted on the **bottom front edge of wall cabinets**. Common sizes: **7/8"–1-3/8" thick × 1-3/8"–1-1/2" tall**, often with a **dado (1/4"–1/2" × 3/4")** to recess lighting. Historic styles ran ~2" tall.
- **Why:** conceals under-cabinet light fixtures and **blocks direct glare** into the room/eyes when seated; also visually finishes the cabinet bottom. Without it you see the strip light and the wiring.

## 1.3 Toe Kick

- Standard **height 3.5"–4.5"** (3.5" common, 4–4.5" typical), **depth 3"** (measured from face of cabinet to the recessed back).
- **Why:** ergonomic — recess lets feet tuck under so the body stands close to the counter with an upright spine; 3.5" clears most footwear, 3" depth lets weight shift forward. Without it you'd lean and strain your lower back during prep.
- A **toe kick molding** strip (96" field-cut) covers the unfinished run for a continuous finished look.

## 1.4 Filler Strips

Fillers are made of cabinet-face material and bridge cabinet-to-wall, cabinet-to-appliance, and inside-corner junctions.

| Location | Minimum filler | Why |
|---|---|---|
| Drawer cabinet beside a wall | **1"** | Lets the drawer/box clear the wall and handle clear drywall; absorbs out-of-plumb wall. |
| Door cabinet beside a wall | **1.5"–2"+** (more with large pulls) | Door must swing ~90–110° without the pull/hinge hitting the wall. |
| Refrigerator beside a wall | **~4" (2"–3" min per Sub-Zero)** | Doors/handles project; need swing clearance so the door opens to ~120°. |
| **Inside corner** (two cabinet runs meet) | **3" rule of thumb (min)** | Door + drawer + pull on each leg must open without colliding across the corner. |
| Blind corner base, adjacent side | filler required | Lets the blind cabinet door open clear of the neighbor. |
| Roll-out trays beside a wall | **3"** | Tray + door swing both need clearance. |

- **Why fillers exist:** conceal/absorb out-of-plumb walls, keep hinges and pulls off drywall, and guarantee door/drawer swing clearance — especially at the **inside corner**, the #1 collision point.

## 1.5 Scribe Molding (against walls)

- A thin, flexible trim that hides the gap between a cabinet/filler edge and an **uneven wall**; covers gaps up to **~3/8"** (caulk only good to ~1/8").
- **Why:** walls are rarely plumb/flat. Pros keep the cabinet **run true and level**, then scribe the filler/panel/scribe-mold to the wall contour so the run isn't racked or thrown out of level by forcing it tight to a bad wall.

## 1.6 Base Molding, Shoe Molding, Riser

- **Base molding:** decorative trim at floor level of base cabinets / island bases; **protects** cabinet bottoms from scuffs and **grounds** the cabinetry visually (furniture-base look).
- **Shoe molding:** small quarter-round-style trim that hides the **cut edge of new flooring** at the toe kick/base on remodels. Why: flooring cuts are rarely clean to the cabinet.
- **Riser / starter molding:** placed between crown and cabinet (stacked crown) to **gain height and absorb ceiling unevenness**, bringing cabinets to the ceiling for a custom look.

## 1.7 End Panels / Decorative Panels

- Applied to any **exposed cabinet side** (end of a run, sides next to appliances, all visible island/peninsula faces) and island backs.
- **Why:** hides raw/unfinished case material, matches door style for a built-in look, protects the side from moisture/dishwasher heat, and structurally supports counter overhangs (e.g., over a dishwasher or island seating). Not needed where a side is buried against a wall.

### ENGINE IMPLEMENTATION — Molding & Trim

```
# Crown
IF ceiling_height - cabinet_top_height <= 6"  -> add crown to ceiling
   IF gap > 1.5"                              -> use stacked (riser+crown)
ELSE IF open_reveal_above >= 12"              -> add top-cap crown (not to ceiling) [style flag]
IF design_style in {modern, slab, frameless, full_height_scribe} -> omit crown

# Light rail
FOR every wall cabinet with under-cabinet lighting -> add light rail (1-3/8" tall) on bottom front edge

# Toe kick (always on base/tall)
toe_kick = height 4.5", depth 3"; add toe-kick molding over the run

# Fillers (auto-insert)
filler_wall_drawer        = 1"
filler_wall_door          = 2"
filler_wall_fridge        = 4"
filler_inside_corner      = 3"   # both legs
filler_blind_corner_adj   = per blind-cabinet spec (>=3")
# Scribe the filler to the wall; never shrink below mins above.

# Scribe / leveling
Keep run level+true; apply scribe molding (covers <=3/8") at any cabinet-to-wall edge.

# End panels
FOR every cabinet side that is exposed (end of run, next to appliance, island/peninsula faces & back)
    -> add finished/decorative end panel
# Refrigerator: finished deep panels (24"+ to match fridge depth) on exposed fridge sides.

# Base/shoe
Add base molding on islands/peninsulas & exposed base runs for furniture look.
Add shoe molding on remodels where new flooring meets toe kick.
```

---

# PART 2 — EFFICIENT STORAGE CABINETRY

## 2.1 Corner Cabinets

**Standard sizes**
- **Diagonal corner lazy susan base:** ~36" along each wall, 34.5" H, 24" D (also 33"/42").
- **Super Susan** (shelves ride on a bearing, no center pole): same footprint, more usable.
- **Blind corner base:** 36"–42" face out, **42"–48"** wall-to-edge, 24" D.

| Solution | When to use | Why |
|---|---|---|
| **Lazy Susan / Super Susan** | Daily-access corner; both walls ≈ **33"–36"+**; lighter items (spices, oils, bowls) | Rotating shelves bring items forward — fastest access, least digging. |
| **Diagonal corner (susan or shelves)** | Want the largest usable corner + a single angled door; both walls ≈ 36" | Maximizes corner volume with easy frontal access. |
| **Blind corner pull-out** | Bulky items (pots, mixers, roasters); corner used occasionally; capacity > convenience | Uses more of the square footprint; pull-out/swing hardware brings rear items out. |
| **Basic blind corner (no hardware)** | Tight budget / dead storage | Cheapest, but rear is hard to reach — avoid for daily use. |

- **Critical spec:** check the **clear door opening**, not the box width — many swing-out organizers need a minimum opening or they won't pass through. Blind corners are **handed** (L/R) and usually need an adjacent **filler (≥3")** so the door clears.
- **NKBA:** at least one corner cabinet should contain a **functional storage device** (susan/pull-out) where corners exist.

## 2.2 Base: Drawers vs. Doors

- Modern layouts: **2–3 deep drawers** per base instead of door+shelf. Why: one-motion full-extension access, no bending/reaching into a dark box; heavy-duty slides carry **pots, small appliances, bulk**.
- **Deep drawers (pots/pans):** wide **30"–36"** drawer stacks; full-extension, high weight rating. Why: see and grab everything; horizontal design line.
- **Roll-out trays behind doors:** best for **small appliances/mixers** and where a door is preferred; lower weight rating than drawers and lose width to the hinges. Under a cooktop: a shallow top roll-out for lids + deeper roll-outs below for pots.
- **Width matching:** drawers net more usable width than roll-outs (roll-out box narrows to clear hinges). Prefer drawers where weight/access matter.

## 2.3 Tall Pantry & Oven-Tower Storage

- **Tall pantry pull-out:** widths **12"–36"**, heights **84"/90"/93"/96"**; full-height pull-out or roll-out shelf banks. Why: brings entire pantry depth into view in one pull.
- **Tray dividers** in narrow cabinets **beside an oven/over an appliance**. Why: store sheet pans, cutting boards, lids **vertically** so they don't stack-and-jam.
- **Spice pull-out** near the range. Why: seasonings at the cook's reach during cooking.

## 2.4 Sink Base & Cleanup Zone

- **Sink base** standard widths **30", 33", 36"**; 34.5" H. Includes a **false drawer front** at top (no real drawer — the sink bowl is there).
- **Tilt-out / tip-out tray** behind the false front (trays trim to fit, e.g., a 36" tray cut down). Why: reclaims dead space behind the false front for sponges/scrubbers.
- **Trash/recycling pull-out** in a base **adjacent to the sink** (one or two bins). Why: scrape-and-toss workflow at cleanup; hides bins. NKBA places the dishwasher within **36"** of the sink edge.

## 2.5 Filler Pull-Outs (turn dead fillers into storage)

- **Base filler pull-outs** in **3", 6", 9"** widths (min cabinet opening ~6-1/8" / 9-1/8"). A 6" unit becomes a **spice/jar mini-pantry**; 9" holds taller bottles. Why: converts otherwise-wasted filler width into usable storage — especially good **next to the range** (spice) or sink.
- Installed **between** cabinets during new construction, not retrofit into an existing box.

### ENGINE IMPLEMENTATION — Storage

```
# Corner selection
both_walls = min(legA, legB)
IF both_walls >= 33" AND use == daily/light   -> Lazy/Super Susan (or diagonal if door space allows)
ELIF both_walls >= 36" AND want_max_volume    -> Diagonal corner susan
ELSE                                          -> Blind corner pull-out (with >=3" adjacent filler, set handedness)
IF clear_door_opening < organizer_min_opening -> downgrade to basket/keep blind pull-out
RULE: every existing corner gets a functional device (susan or pull-out).

# Base fill logic
DEFAULT base cabinets to drawer stacks (2-3 deep drawers).
Pots/pans run        -> 30"-36" deep-drawer stack (full extension, heavy slides)
Small appliances/mixer -> door + roll-out trays
Under cooktop        -> shallow lid roll-out (top) + deep pot roll-outs (below)

# Targeted inserts by adjacency
near sink   -> trash/recycle pull-out base; sink base gets tilt-out tray + false front
near range  -> spice pull-out (filler 6") or in-drawer spice; tray dividers in narrow flanking cabinet
beside oven -> tray/tray-divider cabinet for pans & boards
tall run    -> pantry pull-out (12"-36" W) OR roll-out shelf bank

# Filler -> storage
IF filler_width >= 6" at a wall/appliance junction near sink or range
   -> replace dead filler with base filler pull-out (6" spice, 9" bottles)

# Width->insert mapping
3"   -> filler pull-out (tray/spice)
6"-9"-> filler pull-out (spice/jars/bottles)
12"-24" -> drawers / roll-outs
30"-36" -> deep-drawer pot stack or double-door + roll-outs
30"/33"/36" base at sink -> sink base w/ tilt-out
```

---

# MASTER CODIFIABLE RULE LIST (quick reference)

1. **End panel** on EVERY exposed cabinet side (run ends, beside appliances, all island/peninsula faces + back).
2. **Filler** auto-inserted: **1"** wall+drawer, **2"** wall+door, **4"** at fridge, **3"** at every inside corner and beside roll-outs; scribe it to the wall.
3. **Inside corner = 3" min filler** so opposing doors/drawers don't collide.
4. **Crown to ceiling** when cabinet-top-to-ceiling ≤ **6"**; use **stacked crown** when gap > ~1.5" or ceiling is uneven; **omit** for modern/slab style.
5. **Light rail** on the bottom front of every wall cabinet with under-cabinet lighting (conceals lights/glare).
6. **Toe kick = 4.5" H × 3" D** on all base/tall cabinets (ergonomic stance).
7. **Scribe molding** (covers ≤ 3/8") at every cabinet-to-wall edge; keep the run level/true, never force to a bad wall.
8. **Corner:** Lazy/Super Susan if both walls ≥ **33–36"** and daily/light use; else **blind-corner pull-out** with ≥3" adjacent filler; every corner gets a functional device; verify clear door opening.
9. **Base default = deep-drawer stacks**; **30–36"** drawers for pots; roll-outs behind doors for mixers/appliances.
10. **Adjacency inserts:** trash/recycle pull-out + sink-base tilt-out near sink; spice pull-out + tray dividers near range/oven; pantry pull-out in tall runs.
11. **Dead filler ≥ 6"** near sink/range → convert to a **6"/9" base filler pull-out**.
12. **Sink base** = 30/33/36" with **false front + tilt-out tray**; dishwasher within **36"** of sink edge.
13. **Clearances (NKBA):** work aisle **42"** (1 cook) / **48"** (2 cooks); walkway **36"**; 24"+15" sink landings; 24"/30" cooktop-to-combustible above; 12" full-depth wall offset for fridge door swing.

---

# SOURCES

- Fine Homebuilding — *10 Steps to Install Crown Molding on Cabinets*: https://www.finehomebuilding.com/2022/07/06/10-steps-to-install-crown-molding-on-cabinets
- Fine Homebuilding — *Hiding a Wavy Ceiling in Crown Molding (Scribing Crown)*: https://www.finehomebuilding.com/project-guides/finish-trim-carpentry/scribing-crown-molding
- This Old House — *A Complete Guide To Hanging Crown Molding on Kitchen Cabinets*: https://www.thisoldhouse.com/cabinets/21216456/how-to-hang-crown-molding-on-kitchen-cabinets
- The Joy of Moldings — *Kitchen Crown Molding Installation*: https://www.thejoyofmoldings.com/how-to-install-the-crown-molding/
- Dura Supreme Cabinetry — *Light Rail Molding for Kitchen Cabinets*: https://www.durasupreme.com/blog/light-rail-molding-kitchen-cabinets/
- A Concord Carpenter — *Installing Molding For Under Cabinet Lighting*: https://www.aconcordcarpenter.com/installing-molding-for-under-cabinet-lighting.html
- NewMouldings — *Light Rail EWLR15 (dimensions)*: https://www.newmouldings.com/products/light-rail-ewlr15
- Kitchen Cabinet Kings — *Standard Toe Kick Height & Depth*: https://kitchencabinetkings.com/blog/standard-toe-kick-height/
- Fabuwood — *What is a Cabinet Toe Kick?*: https://www.fabuwood.com/blog/what-is-a-cabinet-toe-kick-enhancing-comfort-and-design-in-your-kitchen
- Woodworker Express — *Minimum filler between a cabinet and a wall*: https://www.woodworkerexpress.com/answers/6439201/What-is-the-minimum-filler-between-a-cabinet-and-a-wall
- Inspired Kitchen Design — *Overlooking Fillers and Panels (mistakes)*: https://inspiredkitchendesign.com/common-kitchen-design-mistakes-overlooking-fillers-and-panels/
- BJ Floors and Kitchens — *Cabinet Scribing 101*: https://www.bjfloorsandkitchens.com/blog/articles/cabinet-scribing-101-how-pros-make-walls-look-straight-without-rebuilding-them
- Gardenspace — *What Goes Between a Cabinet and a Wall? (Filler Strip Guide)*: https://www.gardenspace.blog/what-goes-between-cabinet-and-wall
- Cabinets.com — *Types of Moldings for Kitchen Cabinets*: https://www.cabinets.com/kitchen-cabinet-molding-types
- CabinetSelect — *Kitchen Cabinet Molding Types and Where to Use Them*: https://cabinetselect.com/essential-guide-to-kitchen-cabinet-molding-types/
- HomeStar — *What Is Riser Molding & How Is It Used*: https://homestardr.com/what-is-riser-molding/
- Oldenkamp — *Cabinet Height and Crown Molding Options*: https://www.oldenkamp.com/cabinet-height-and-crown-options/
- Wurth Louis and Company — *Blind Corner vs Lazy Susan: What to Spec and When*: https://wurthlac.com/blog/blind-corner-vs-lazy-susan
- ShelfGenie — *Lazy Susan vs. Blind Corner Solutions*: https://www.shelfgenie.com/blog/solutions-designs/lazy-susan-vs-blind-corner/
- Casta Cabinetry — *Corner Cabinet Dimensions: Complete Guide*: https://castacabinetry.com/post/corner-cabinet-dimensions/
- Lanae — *Corner Cabinet Dimensions: Lazy Susan and Alternatives*: https://lanaehome.com/blogs/news/corner-cabinet-dimensions-lazy-susan-and-alternatives
- Carla Aston / DESIGNED — *Pullouts Or Drawers In Kitchen Cabinets*: https://carlaaston.com/designed/pullouts-or-drawers-in-kitchen-cabinets-which-is-best
- Cypress Kitchen & Bath — *Cabinet Drawers vs. Roll-out Trays*: https://www.cypresskitchenandbath.com/blog/cabinet-drawers-vs-roll-out-trays-maximizing-your-kitchen-storage
- Edgewood Cabinetry — *Built-in Spice Racks, Trash Pull-Outs & More*: https://edgewoodcabinetry.com/services/cabinet-accessories/built-in-spice-racks-trash-pull-outs-more-must-have-custom-cabinet-features/
- ShelfGenie — *Recycling & Trash Cabinets for Kitchens*: https://www.shelfgenie.com/solution-items/kitchen-trash-recycling/
- Rev-A-Shelf — *Tall & Pantry pull-out organizers*: https://rev-a-shelf.com/kitchen/tall-and-pantry
- CliqStudios — *Tall Kitchen Pantry Cabinet With Pull-out Shelves*: https://www.cliqstudios.com/kitchen-pantry-cabinets/
- Nelson Cabinetry — *Sink Base Cabinet (30"-36")*: https://nelsonkb.com/product/30-sink-base-cabinet/
- The RTA Store — *Trimmable Tilt Out Tray for Sink Base*: https://www.thertastore.com/trimmable-tilt-out-tray-for-sink-base-2310432-70070.html
- KraftMaid — *3" and 6" Base Filler Cabinet Pull-Out*: https://www.kraftmaid.com/base-filler-pull-out-bfp_0000/
- CabinetParts / Rev-A-Shelf — *9" Base Filler Pull-Out (432-BFSC-9C)*: https://www.cabinetparts.com/p/revashelf-organizers-kitchen-organizers-RV432BFSC9C-p37227
- Unfinished Kitchen Cabinets — *What Is a Cabinet End Panel?*: https://www.unfinished-kitchen-cabinets.net/blog/what-is-a-cabinet-end-panel
- CliqStudios — *Cabinet Paneling (decorative & painted panels)*: https://www.cliqstudios.com/cabinet-paneling/
- Refrigerator Trim Kits — *Refrigerator Cabinet Surround: How-To (dimensions)*: https://refrigeratortrimkits.com/our-blog/refrigerator-cabinet-surround-how-to-guide-with-dimensions
- Wholesale Cabinet Supply — *Kitchen Design Guidelines & Clearances (NKBA)*: https://www.thewcsupply.com/pages/kitchen-design-guidelines-standard-clearances
- NKBA — *Kitchen Planning Guidelines with Access Standards (PDF)*: https://media.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf
- CRD Design Build — *Kitchen Dimensions: Code Requirements & NKBA Guidelines*: https://www.crddesignbuild.com/blog/kitchen-dimensions-code-requirements-nkba-guidelines/
