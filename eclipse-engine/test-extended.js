/**
 * Eclipse Engine — Extended Tests (Phase 1)
 * Tests for new room types, peninsula, room-type-aware validation,
 * and new exports added in Session 3.
 */

import {
  solve, fillSegment, validateLayout,
  ROOM_TYPES, CABINET_TYPES, DIMS, STD_VANITY_WIDTHS,
  WIDTH_MOD_RULES, CONSTRUCTION_TYPES, PENINSULA_RULES,
  TRIM_ACCESSORIES, ZONE_CABINET_PRIORITY, MATERIAL_SPLIT,
  CORNER_RULES, STD_TALL_HEIGHTS, STD_BASE_WIDTHS,
} from './src/index.js';

import {
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  VANITY_PATTERNS, UTILITY_PATTERNS,
  RANGE_PATTERNS, SINK_PATTERNS, ISLAND_PATTERNS,
  TALL_PATTERNS, UPPER_PATTERNS, DOOR_LAYOUT_COMPAT,
  ACCESSORY_RULES,
} from './src/patterns.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}


// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: New exports exist and have correct shape
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New exports & constants ═══");

assert(typeof ROOM_TYPES === "object" && Object.keys(ROOM_TYPES).length >= 7,
  `ROOM_TYPES has ${Object.keys(ROOM_TYPES).length} room types (≥7)`);
assert(ROOM_TYPES.kitchen.appliancesRequired === true, "Kitchen requires appliances");
assert(ROOM_TYPES.office.appliancesRequired === false, "Office does not require appliances");
assert(ROOM_TYPES.vanity.nkbaLandingApplies === false, "Vanity skips NKBA landing rules");

assert(typeof CABINET_TYPES === "object" && Object.keys(CABINET_TYPES).length >= 5,
  `CABINET_TYPES has ${Object.keys(CABINET_TYPES).length} categories`);

assert(Array.isArray(STD_VANITY_WIDTHS) && STD_VANITY_WIDTHS.includes(36),
  "STD_VANITY_WIDTHS includes 36");
assert(Array.isArray(STD_TALL_HEIGHTS) && STD_TALL_HEIGHTS.includes(105),
  "STD_TALL_HEIGHTS includes 105 (new)");

assert(typeof WIDTH_MOD_RULES === "object" && WIDTH_MOD_RULES.noCostThreshold !== undefined,
  "WIDTH_MOD_RULES has noCostThreshold");
assert(typeof CONSTRUCTION_TYPES === "object",
  "CONSTRUCTION_TYPES exported");
assert(typeof PENINSULA_RULES === "object" && PENINSULA_RULES.columnHeight > 0,
  "PENINSULA_RULES has columnHeight");
assert(typeof TRIM_ACCESSORIES === "object",
  "TRIM_ACCESSORIES exported");

// New pattern arrays
assert(Array.isArray(PENINSULA_PATTERNS) && PENINSULA_PATTERNS.length > 0,
  `PENINSULA_PATTERNS has ${PENINSULA_PATTERNS.length} patterns`);
assert(Array.isArray(OFFICE_PATTERNS) && OFFICE_PATTERNS.length > 0,
  `OFFICE_PATTERNS has ${OFFICE_PATTERNS.length} patterns`);
assert(Array.isArray(LAUNDRY_PATTERNS) && LAUNDRY_PATTERNS.length > 0,
  `LAUNDRY_PATTERNS has ${LAUNDRY_PATTERNS.length} patterns`);
assert(Array.isArray(VANITY_PATTERNS) && VANITY_PATTERNS.length > 0,
  `VANITY_PATTERNS has ${VANITY_PATTERNS.length} patterns`);
assert(Array.isArray(UTILITY_PATTERNS) && UTILITY_PATTERNS.length > 0,
  `UTILITY_PATTERNS has ${UTILITY_PATTERNS.length} patterns`);

// Zone priorities for non-kitchen rooms
assert(ZONE_CABINET_PRIORITY.officeDesk !== undefined, "officeDesk zone exists");
assert(ZONE_CABINET_PRIORITY.vanityWall !== undefined, "vanityWall zone exists");
assert(ZONE_CABINET_PRIORITY.laundryRoom !== undefined, "laundryRoom zone exists");
assert(ZONE_CABINET_PRIORITY.utilityStorage !== undefined, "utilityStorage zone exists");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Vanity room type — single-wall solve (Cost Plus inspired)
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Solver: Vanity room type ═══");

const vanityResult = solve({
  layoutType: "single-wall",
  roomType: "vanity",
  walls: [
    { id: "A", length: 120, role: "general" },
  ],
  appliances: [],
  prefs: { preferDrawerBases: true },
});

assert(vanityResult.roomType === "vanity", "Room type is vanity");
assert(vanityResult.corners.length === 0, "Single-wall vanity has no corners");
assert(vanityResult.walls.length === 1, "Has 1 wall layout");
assert(vanityResult.metadata.totalCabinets > 0,
  `Vanity has ${vanityResult.metadata.totalCabinets} cabinets`);

// Vanity should not generate NKBA validation errors (no appliances, no NKBA)
const vanityNkbaIssues = vanityResult.validation.filter(v =>
  v.rule.startsWith("NKBA-"));
assert(vanityNkbaIssues.length === 0,
  "Vanity produces no NKBA validation issues");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Office room type — single-wall solve (Bissegger inspired)
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Solver: Office room type ═══");

const officeResult = solve({
  layoutType: "single-wall",
  roomType: "office",
  walls: [
    { id: "A", length: 96, role: "general" },
  ],
  appliances: [],
  prefs: {},
});

assert(officeResult.roomType === "office", "Room type is office");
assert(officeResult.walls.length === 1, "Has 1 wall layout");
assert(officeResult.metadata.totalCabinets > 0,
  `Office has ${officeResult.metadata.totalCabinets} cabinets`);

// Office should not produce NKBA errors
const officeNkbaIssues = officeResult.validation.filter(v =>
  v.rule.startsWith("NKBA-"));
assert(officeNkbaIssues.length === 0,
  "Office produces no NKBA validation issues");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Laundry room type — L-shape solve (LWH Hartley inspired)
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Solver: Laundry room type ═══");

const laundryResult = solve({
  layoutType: "l-shape",
  roomType: "laundry",
  walls: [
    { id: "A", length: 72, role: "general" },
    { id: "B", length: 48, role: "general" },
  ],
  appliances: [],
  prefs: { cornerTreatment: "auto", sophistication: "standard" },
});

assert(laundryResult.roomType === "laundry", "Room type is laundry");
assert(laundryResult.corners.length === 1, "L-shape laundry has 1 corner");
assert(laundryResult.walls.length === 2, "Has 2 wall layouts");

// Laundry should skip NKBA
const laundryNkbaIssues = laundryResult.validation.filter(v =>
  v.rule.startsWith("NKBA-"));
assert(laundryNkbaIssues.length === 0,
  "Laundry produces no NKBA validation issues");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Peninsula layout — galley-peninsula solve
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Solver: Peninsula layout ═══");

const penResult = solve({
  layoutType: "galley-peninsula",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  peninsula: { length: 81, depth: 36, shelfWidth: 14, lighting: true },
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
  ],
  prefs: { cornerTreatment: "auto", preferDrawerBases: true, sophistication: "high" },
});

assert(penResult.peninsula !== null, "Has peninsula layout");
assert(penResult.peninsula.columns.length === 2, "Peninsula has 2 columns");
assert(penResult.peninsula.shelf !== null, "Peninsula has shelf");
assert(penResult.peninsula.shelf.mods.includes("PWL"),
  "Peninsula shelf has PWL (prep for lighting)");
assert(penResult.peninsula.endPanels.length === 2, "Peninsula has 2 end panels");
assert(penResult.peninsula.pattern === "column_peninsula_with_shelf",
  "Peninsula pattern is column_peninsula_with_shelf");

// Peninsula columns should appear in placements (via accessories)
const penColumns = penResult.placements.filter(p =>
  p.role && p.role.startsWith("peninsula-column"));
assert(penColumns.length === 2,
  `Peninsula columns in placements (found ${penColumns.length})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Room-type-aware validation — NKBA skipped for non-kitchen
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Validation: Room-type-aware NKBA skip ═══");

// This layout would fail NKBA in a kitchen but should pass in a vanity
const vanityValidation = validateLayout({
  roomType: "vanity",
  appliances: [
    { type: "range", wall: "A", leftClearance: 0, rightClearance: 0 },
    { type: "dishwasher", wall: "A", adjacentToSink: false },
  ],
  trianglePerimeter: 400,
});
assert(vanityValidation.filter(v => v.rule.startsWith("NKBA-")).length === 0,
  "Vanity roomType skips all NKBA rules even with bad appliance data");

// Same layout as kitchen should produce NKBA errors
const kitchenValidation = validateLayout({
  roomType: "kitchen",
  appliances: [
    { type: "range", wall: "A", leftClearance: 0, rightClearance: 0 },
    { type: "dishwasher", wall: "A", adjacentToSink: false },
  ],
  trianglePerimeter: 400,
});
assert(kitchenValidation.filter(v => v.rule.startsWith("NKBA-")).length > 0,
  "Kitchen roomType catches NKBA violations");

// Default (no roomType) should behave as kitchen
const defaultValidation = validateLayout({
  appliances: [
    { type: "range", wall: "A", leftClearance: 5, rightClearance: 5 },
  ],
});
assert(defaultValidation.some(v => v.rule === "NKBA-Landing-Range"),
  "Default (no roomType) enforces NKBA kitchen rules");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Width modification limit validation
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Validation: Width mod limit ═══");

// 5 of 10 cabinets modified = 50% > 30% limit
const widthModLayout = {
  roomType: "kitchen",
  appliances: [],
  placements: [
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: { original: 30, modified: 28 } },
    { type: "base", modified: { original: 30, modified: 28 } },
    { type: "base", modified: { original: 30, modified: 28 } },
    { type: "base", modified: { original: 30, modified: 28 } },
    { type: "base", modified: { original: 30, modified: 28 } },
  ],
};
const widthModIssues = validateLayout(widthModLayout);
assert(widthModIssues.some(v => v.rule === "Eclipse-Width-Mod-Limit"),
  "Catches >30% width modification limit");

// Under limit — 2 of 10 = 20%
const underLimitLayout = {
  roomType: "kitchen",
  appliances: [],
  placements: [
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: null },
    { type: "base", modified: { original: 30, modified: 28 } },
    { type: "base", modified: { original: 30, modified: 28 } },
  ],
};
const underLimitIssues = validateLayout(underLimitLayout);
assert(!underLimitIssues.some(v => v.rule === "Eclipse-Width-Mod-Limit"),
  "20% width modification does not trigger limit warning");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: Utility room type
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Solver: Utility room type ═══");

const utilityResult = solve({
  layoutType: "single-wall",
  roomType: "utility",
  walls: [
    { id: "A", length: 72, role: "general" },
  ],
  appliances: [],
  prefs: {},
});

assert(utilityResult.roomType === "utility", "Room type is utility");
assert(utilityResult.metadata.totalCabinets > 0,
  `Utility has ${utilityResult.metadata.totalCabinets} cabinets`);
const utilityNkba = utilityResult.validation.filter(v => v.rule.startsWith("NKBA-"));
assert(utilityNkba.length === 0, "Utility produces no NKBA issues");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: Backward compat — solve without roomType defaults to kitchen
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Backward compatibility ═══");

const defaultResult = solve({
  layoutType: "single-wall",
  walls: [{ id: "A", length: 120, role: "range" }],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
  ],
  prefs: { preferDrawerBases: true },
});

assert(defaultResult.roomType === "kitchen",
  "No roomType defaults to kitchen");
assert(defaultResult.peninsula === null,
  "No peninsula input gives null peninsula");
assert(defaultResult.validation !== undefined,
  "Validation still runs for default kitchen");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: New cabinet types from final 6 training JSONs
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New cabinet types (Bollini/Bissegger/Owen/McComb/Kamisar batch) ═══");

// Bollini firsts
assert(CABINET_TYPES["BKI"]?.category === "base",
  "BKI (knife insert) registered as base");
assert(CABINET_TYPES["BBC-MC"]?.category === "corner",
  "BBC-MC (magic corner) registered as corner");
assert(CABINET_TYPES["BB-HTFD"]?.category === "panel",
  "BB-HTFD (Hartford bar back) registered as panel");
assert(CABINET_TYPES["SWSC"]?.category === "stacked_corner",
  "SWSC (stacked wall square corner bi-fold) registered as stacked_corner");
assert(CABINET_TYPES["WS"]?.description?.toLowerCase().includes("shelf") ||
  CABINET_TYPES["WS"]?.description?.toLowerCase().includes("decorative"),
  "WS (wall shelf decorative) has correct description");

// Bissegger firsts
assert(CABINET_TYPES["BCF"] !== undefined,
  "BCF (beverage center) registered");
assert(CABINET_TYPES["BPTPO"] !== undefined,
  "BPTPO (paper towel pullout) registered");
assert(CABINET_TYPES["BUBO"] !== undefined,
  "BUBO (utensil bin) registered");
assert(CABINET_TYPES["WGPD"] !== undefined,
  "WGPD (wall garage pocket doors) registered");
assert(CABINET_TYPES["REF"] !== undefined,
  "REF (wall door panel for fridge) registered");

// Kamisar firsts
assert(CABINET_TYPES["DSB"] !== undefined,
  "DSB (diagonal sink base) registered");
assert(CABINET_TYPES["RTB"] !== undefined,
  "RTB (range top base) registered");

// Owen
assert(CABINET_TYPES["FIO"] !== undefined,
  "FIO (flush inset oven) registered");

// McComb
assert(CABINET_TYPES["BB-SCDL"] !== undefined,
  "BB-SCDL (Scottsdale bar back) registered");

// SBA (Gable/Bissegger apron sink)
assert(CABINET_TYPES["SBA"]?.category === "base",
  "SBA (apron sink base) registered as base");
assert(CABINET_TYPES["TB"] !== undefined,
  "TB (tray base) registered");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 11: Corner rule variants — magic corner & quarter-turn shelves
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Corner variants ═══");

assert(CORNER_RULES.blindCorner?.variants?.magicCorner !== undefined,
  "Magic corner variant exists in blindCorner rules");
assert(typeof CORNER_RULES.blindCorner?.variants?.magicCorner === "string" &&
  CORNER_RULES.blindCorner.variants.magicCorner.includes("BBC"),
  "Magic corner references BBC in its description");
assert(CORNER_RULES.blindCorner?.variants?.quarterTurnShelves !== undefined,
  "Quarter-turn shelves variant exists in blindCorner rules");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 12: New room types — great_room and bar
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Room types: great_room & bar ═══");

assert(ROOM_TYPES.great_room !== undefined, "great_room room type exists");
assert(ROOM_TYPES.great_room.appliancesRequired === false,
  "great_room does not require appliances");
assert(ROOM_TYPES.great_room.workTriangleApplies === false,
  "great_room skips work triangle");
assert(Array.isArray(ROOM_TYPES.great_room.specialCabinets) &&
  ROOM_TYPES.great_room.specialCabinets.includes("WGPD"),
  "great_room specialCabinets includes WGPD");

assert(ROOM_TYPES.bar !== undefined, "bar room type exists");
assert(ROOM_TYPES.bar.defaultBaseDepth === 21,
  "bar has 21\" shallow depth for service counter");
assert(ROOM_TYPES.bar.nkbaLandingApplies === false,
  "bar skips NKBA landing rules");

// Great room solve — should work without errors
const greatRoomResult = solve({
  layoutType: "single-wall",
  roomType: "great_room",
  walls: [{ id: "A", length: 96, role: "general" }],
  appliances: [],
  prefs: {},
});
assert(greatRoomResult.roomType === "great_room",
  "Solver accepts great_room room type");
const grNkba = greatRoomResult.validation.filter(v => v.rule.startsWith("NKBA-"));
assert(grNkba.length === 0,
  "great_room produces no NKBA issues");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 13: Material split / two-tone configurations
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Material split configurations ═══");

assert(MATERIAL_SPLIT.twoTone_paintStain !== undefined,
  "twoTone_paintStain exists (Owen: paint + stain)");
assert(MATERIAL_SPLIT.twoTone_paintPaint !== undefined,
  "twoTone_paintPaint exists (McComb: paint + paint)");
assert(MATERIAL_SPLIT.twoTone_doorStyle !== undefined,
  "twoTone_doorStyle exists (Bissegger: same species, different door styles)");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 14: New zone priorities — bar, great room, nook
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New zone priorities ═══");

assert(ZONE_CABINET_PRIORITY.barEntertaining !== undefined,
  "barEntertaining zone exists");
assert(ZONE_CABINET_PRIORITY.greatRoomDisplay !== undefined,
  "greatRoomDisplay zone exists");
assert(ZONE_CABINET_PRIORITY.builtInNook !== undefined,
  "builtInNook zone exists");
assert(typeof ZONE_CABINET_PRIORITY.barEntertaining === "object" &&
  ZONE_CABINET_PRIORITY.barEntertaining.preferred !== undefined,
  "barEntertaining zone has preferred cabinet list");
assert(Array.isArray(ZONE_CABINET_PRIORITY.barEntertaining.preferred) &&
  ZONE_CABINET_PRIORITY.barEntertaining.preferred.length > 0,
  "barEntertaining zone preferred list is non-empty");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 15: New range patterns — knife insert & range top base
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New range patterns ═══");

const knifePattern = RANGE_PATTERNS.find(p => p.id === "knife_insert_flank");
assert(knifePattern !== undefined, "knife_insert_flank pattern exists");
assert(knifePattern.occurrences.some(o => o.toLowerCase().includes("bollini")),
  "knife_insert_flank references Bollini training project");

const rtbPattern = RANGE_PATTERNS.find(p => p.id === "range_top_base");
assert(rtbPattern !== undefined, "range_top_base pattern exists");
assert(rtbPattern.occurrences.some(o => o.toLowerCase().includes("kamisar")),
  "range_top_base references Kamisar training project");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 16: New sink patterns — diagonal corner & apron farmhouse
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New sink patterns ═══");

const diagSink = SINK_PATTERNS.find(p => p.id === "sink_diagonal_corner");
assert(diagSink !== undefined, "sink_diagonal_corner pattern exists");
assert(diagSink.occurrences.some(o => o.includes("DSB42") || o.toLowerCase().includes("kamisar")),
  "sink_diagonal_corner references DSB42 or Kamisar");

const apronSink = SINK_PATTERNS.find(p => p.id === "sink_apron_farmhouse");
assert(apronSink !== undefined, "sink_apron_farmhouse pattern exists");
assert(apronSink.occurrences.some(o => o.includes("SBA36") || o.toLowerCase().includes("bissegger") || o.toLowerCase().includes("gable")),
  "sink_apron_farmhouse references SBA36 or Gable/Bissegger");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 17: New island pattern — bar backs
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New island patterns ═══");

const barBackIsland = ISLAND_PATTERNS.find(p => p.id === "island_sink_waste_with_bar_backs");
assert(barBackIsland !== undefined, "island_sink_waste_with_bar_backs pattern exists");
assert(barBackIsland.occurrences.some(o => o.toLowerCase().includes("bollini")),
  "bar back island references Bollini");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 18: New tall patterns — flush inset oven, ultra-tall, wire tray dividers
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New tall patterns ═══");

const fioTower = TALL_PATTERNS.find(p => p.id === "flush_inset_oven_tower");
assert(fioTower !== undefined, "flush_inset_oven_tower pattern exists");

const ultraTall = TALL_PATTERNS.find(p => p.id === "ultra_tall_utility_27d");
assert(ultraTall !== undefined, "ultra_tall_utility_27d pattern exists");
assert(ultraTall.occurrences.some(o => o.includes("117") || o.toLowerCase().includes("bollini")),
  "ultra_tall references 117\" or Bollini");

const wtdOven = TALL_PATTERNS.find(p => p.id === "oven_with_wire_tray_dividers");
assert(wtdOven !== undefined, "oven_with_wire_tray_dividers pattern exists");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 19: New upper patterns — stacked glass display & garage pocket doors
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ New upper patterns ═══");

const glassCabWall = UPPER_PATTERNS.find(p => p.id === "stacked_glass_display_wall");
assert(glassCabWall !== undefined, "stacked_glass_display_wall pattern exists");
assert(glassCabWall.occurrences.some(o => o.toLowerCase().includes("bollini")),
  "stacked_glass_display_wall references Bollini");

const garagePocket = UPPER_PATTERNS.find(p => p.id === "wall_garage_pocket_doors");
assert(garagePocket !== undefined, "wall_garage_pocket_doors pattern exists");
assert(garagePocket.occurrences.some(o => o.toLowerCase().includes("bissegger")),
  "wall_garage_pocket_doors references Bissegger");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 20: Door style compatibility — new door styles
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Door style compatibility ═══");

assert(DOOR_LAYOUT_COMPAT["Hartford FP (HTFD)"] !== undefined,
  "Hartford FP (HTFD) door compat entry exists");
assert(DOOR_LAYOUT_COMPAT["Scottsdale FP (SCDL)"] !== undefined,
  "Scottsdale FP (SCDL) door compat entry exists");
assert(DOOR_LAYOUT_COMPAT["Hanover FP 2.5 (HNVR-2.5)"] !== undefined,
  "Hanover FP 2.5 (HNVR-2.5) door compat entry exists");
assert(Object.keys(DOOR_LAYOUT_COMPAT).length >= 9,
  `DOOR_LAYOUT_COMPAT has ${Object.keys(DOOR_LAYOUT_COMPAT).length} door styles (≥9)`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 21: Width mod rules — new modification types
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Width mod new types ═══");

assert(WIDTH_MOD_RULES.removableToeKick !== undefined,
  "removableToeKick (RMK) mod type exists");
assert(WIDTH_MOD_RULES.wireTrayDivider !== undefined,
  "wireTrayDivider (WTD) mod type exists");
assert(WIDTH_MOD_RULES.drawerPegSystem !== undefined,
  "drawerPegSystem (DPS) mod type exists");
assert(WIDTH_MOD_RULES.woodCutleryDrawer !== undefined,
  "woodCutleryDrawer (WCD2) mod type exists");
assert(WIDTH_MOD_RULES.spiceRack !== undefined,
  "spiceRack (SR8) mod type exists");
assert(WIDTH_MOD_RULES.toeKickLighting !== undefined,
  "toeKickLighting (PTKL) mod type exists");
assert(WIDTH_MOD_RULES.prepFloatingShelfLighting !== undefined,
  "prepFloatingShelfLighting (PFSL) mod type exists");
assert(WIDTH_MOD_RULES.contourDoor !== undefined,
  "contourDoor (RCTD/LCTD) mod type exists");
assert(WIDTH_MOD_RULES.mullion !== undefined,
  "mullion (MD) mod type exists");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 22: Trim accessories — new entries
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Trim accessories — new entries ═══");

assert(TRIM_ACCESSORIES.finishedTop?.cove !== undefined,
  "finishedTop.cove (PLWT-COVE) exists");
assert(TRIM_ACCESSORIES.crownMould !== undefined,
  "crownMould trim accessory exists");
assert(TRIM_ACCESSORIES.counterTopMould !== undefined,
  "counterTopMould trim accessory exists");
assert(TRIM_ACCESSORIES.subRail10 !== undefined,
  "subRail10 (10\" face sub rail) exists");
assert(TRIM_ACCESSORIES.straightValance !== undefined,
  "straightValance trim accessory exists");
assert(TRIM_ACCESSORIES.contemporaryValance !== undefined,
  "contemporaryValance trim accessory exists");
assert(TRIM_ACCESSORIES.floatingShelfBrackets !== undefined,
  "floatingShelfBrackets trim accessory exists");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 23: Construction types
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Construction types ═══");

assert(CONSTRUCTION_TYPES.standard !== undefined,
  "standard construction type exists");
assert(CONSTRUCTION_TYPES.plywood !== undefined,
  "plywood construction type exists");
assert(CONSTRUCTION_TYPES.plywoodPartial !== undefined,
  "plywoodPartial (Procore Plywood/Partial) construction type exists");
assert(typeof CONSTRUCTION_TYPES.standard.pctUpcharge === "number",
  "Construction types have pctUpcharge");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 24: STD_TALL_HEIGHTS includes ultra-tall 117 & 118
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Dimensional constants — ultra-tall heights ═══");

assert(STD_TALL_HEIGHTS.includes(117),
  "STD_TALL_HEIGHTS includes 117 (Bollini U21117)");
assert(STD_TALL_HEIGHTS.includes(118),
  "STD_TALL_HEIGHTS includes 118");
assert(STD_TALL_HEIGHTS.includes(84) && STD_TALL_HEIGHTS.includes(96),
  "STD_TALL_HEIGHTS still has standard 84 and 96");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 25: Accessory rules from patterns.js
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Accessory rules ═══");

assert(ACCESSORY_RULES !== undefined, "ACCESSORY_RULES exported");
assert(ACCESSORY_RULES.endPanels !== undefined, "endPanels rules exist");
assert(ACCESSORY_RULES.endPanels.base !== undefined,
  "base end panel SKU defined");
assert(ACCESSORY_RULES.rollOutTrays !== undefined,
  "rollOutTrays rules exist");
assert(ACCESSORY_RULES.touchUp !== undefined,
  "touchUp rules exist");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 26: Peninsula patterns — turned legs (Owen)
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Peninsula patterns — advanced ═══");

const turnedLegPattern = PENINSULA_PATTERNS.find(p =>
  p.id?.includes("turned_leg") || p.description?.toLowerCase().includes("turned leg"));
assert(turnedLegPattern !== undefined,
  "Peninsula pattern with turned legs exists (Owen PBC + TL)");

// All peninsula patterns should have an id and description
assert(PENINSULA_PATTERNS.every(p => p.id && p.description),
  "All peninsula patterns have id and description");


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Extended tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
