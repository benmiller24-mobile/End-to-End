/**
 * Tests for Phase 1 Constraint Engine Expansion (Eclipse-only)
 * =============================================================
 * Validates Eclipse-only additions from training projects:
 *   - ECL23J_1 catalog prefix
 *   - Room types (primary_bath, main_bath)
 *   - Cabinet type expansions (RTB, LD-STD, BEP variants, VTB3D, VTSB widths)
 *   - Modification types (recessedBottomShelf, shallowDepth13)
 *   - Design patterns (vanity, bar)
 *   - Door style compatibility (Eclipse overlay styles)
 */

import {
  CONSTRUCTION_TYPES, CATALOG_PREFIXES, EDGE_PROFILES, HINGE_TYPES,
  ROOM_TYPES, CABINET_TYPES, WIDTH_MOD_RULES,
  DIMS, LANDING, CLEARANCE, TRIANGLE, CORNER_RULES,
  ISLAND_RULES, PENINSULA_RULES, UPPER_RULES, TRIM_ACCESSORIES,
  fillSegment, validateLayout,
} from './src/constraints.js';

import {
  VANITY_PATTERNS, BAR_PATTERNS, VALANCE_PATTERNS, FRIDGE_TALL_PATTERNS,
  DOOR_LAYOUT_COMPAT, ACCESSORY_RULES,
  RANGE_PATTERNS, SINK_PATTERNS, FRIDGE_PATTERNS,
  ISLAND_PATTERNS, TALL_PATTERNS, UPPER_PATTERNS,
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  UTILITY_PATTERNS,
} from './src/patterns.js';

import { solve } from './src/solver.js';

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Construction Types (Eclipse only) ═══");

test("Standard still exists and unchanged", CONSTRUCTION_TYPES.standard.code === "Standard" && CONSTRUCTION_TYPES.standard.pctUpcharge === 0);
test("Plywood still exists and unchanged", CONSTRUCTION_TYPES.plywood.code === "Plywood" && CONSTRUCTION_TYPES.plywood.pctUpcharge === 10);
test("No Shiloh flushInset", !CONSTRUCTION_TYPES.flushInset);
test("No Shiloh modernFlushInset", !CONSTRUCTION_TYPES.modernFlushInset);
test("No Shiloh fullOverlay", !CONSTRUCTION_TYPES.fullOverlay);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Catalog Prefixes ═══");

test("CATALOG_PREFIXES exported", !!CATALOG_PREFIXES);
test("ECL23J_1 exists", !!CATALOG_PREFIXES.ECL23J_1);
test("ECL23J_1 brand is Eclipse", CATALOG_PREFIXES.ECL23J_1.brand === "Eclipse");

// Eclipse catalogs still there
test("ECL8_8A_1 still exists", !!CATALOG_PREFIXES.ECL8_8A_1);
test("ECL24A_1 still exists", !!CATALOG_PREFIXES.ECL24A_1);

// No Shiloh catalogs
test("No SHI34A_1", !CATALOG_PREFIXES.SHI34A_1);
test("No SHI34_2A_1", !CATALOG_PREFIXES["SHI34_2A_1"]);
test("No SHI24_1", !CATALOG_PREFIXES.SHI24_1);
test("No SHI23H_1", !CATALOG_PREFIXES.SHI23H_1);

const totalCatalogs = Object.keys(CATALOG_PREFIXES).length;
test(`Total catalogs >= 10 (got ${totalCatalogs})`, totalCatalogs >= 10);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Edge Profiles ═══");

test("EDGE_PROFILES exported", !!EDGE_PROFILES);
test("Standard edge 150 exists", EDGE_PROFILES.standard.code === "150");
test("No insetOnly edge", !EDGE_PROFILES.insetOnly);
test("No subRail edge", !EDGE_PROFILES.subRail);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Hinge Types ═══");

test("HINGE_TYPES exported", !!HINGE_TYPES);
test("Standard hinge exists", !!HINGE_TYPES.standard);
test("No Flush Inset hinge", !HINGE_TYPES.flushInset);
test("No Modern Flush Inset hinge", !HINGE_TYPES.modernFlushInset);
test("No European Overlay hinge", !HINGE_TYPES.europeanOverlay);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Room Types ═══");

test("primary_bath exists", !!ROOM_TYPES.primary_bath);
test("primary_bath specialCabinets include VTSB", ROOM_TYPES.primary_bath.specialCabinets.includes("VTSB"));
test("primary_bath specialCabinets include LD", ROOM_TYPES.primary_bath.specialCabinets.includes("LD"));

test("main_bath exists", !!ROOM_TYPES.main_bath);
test("main_bath defaultBaseDepth is 21", ROOM_TYPES.main_bath.defaultBaseDepth === 21);

// Removed Shiloh room types
test("No powder_bath", !ROOM_TYPES.powder_bath);
test("No dual_sink_bath", !ROOM_TYPES.dual_sink_bath);

// Existing room types still intact
test("kitchen still exists", !!ROOM_TYPES.kitchen);
test("kitchen still has appliances required", ROOM_TYPES.kitchen.appliancesRequired === true);
test("vanity still exists", !!ROOM_TYPES.vanity);
test("master_bath still exists", !!ROOM_TYPES.master_bath);
test("bar still exists", !!ROOM_TYPES.bar);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Cabinet Types — Eclipse Additions ═══");

// RTB range top base (Eclipse)
test("RTB range top base exists", !!CABINET_TYPES.RTB);
test("RTB height is 28.5 (lower for cooktop)", CABINET_TYPES.RTB.heights.includes(28.5));

// LD-STD loose door (Eclipse/Gable/Alix)
test("LD-STD loose door exists", !!CABINET_TYPES["LD-STD"]);

// BEP variants
test("BEP now has FTK variants", CABINET_TYPES.BEP.variants.includes("BEP1 1/2-FTK-L"));

// LD widths (Eclipse: 33 from Diehl, 36)
test("LD has width 33", CABINET_TYPES.LD.widths.includes(33));
test("LD has width 36", CABINET_TYPES.LD.widths.includes(36));

// VTSB widths (Eclipse: 27, 30 from Diehl; 36 from Cost Plus)
test("VTSB has width 27", CABINET_TYPES.VTSB.widths.includes(27));
test("VTSB has width 30", CABINET_TYPES.VTSB.widths.includes(30));
test("VTSB has width 36", CABINET_TYPES.VTSB.widths.includes(36));
test("VTSB no width 24 (Shiloh-only)", !CABINET_TYPES.VTSB.widths.includes(24));

// VTB3D widths (Eclipse: 12, 15 from Diehl)
test("VTB3D exists", !!CABINET_TYPES.VTB3D);
test("VTB3D has width 12", CABINET_TYPES.VTB3D.widths.includes(12));
test("VTB3D has width 15", CABINET_TYPES.VTB3D.widths.includes(15));
test("VTB3D no width 24 (Shiloh-only)", !CABINET_TYPES.VTB3D.widths.includes(24));

// Removed Shiloh-only cabinet types
test("No FLVB (Shiloh floating vanity)", !CABINET_TYPES.FLVB);
test("No VTSBR (Shiloh reverse sink)", !CABINET_TYPES.VTSBR);
test("No VTB (Shiloh vanity tall base)", !CABINET_TYPES.VTB);
test("No VEP (Shiloh vanity end panel)", !CABINET_TYPES.VEP);
test("No B-2TD (Shiloh tiered drawer)", !CABINET_TYPES["B-2TD"]);
test("No BKI-15 (Shiloh)", !CABINET_TYPES["BKI-15"]);
test("No PW (Shiloh peninsula wall)", !CABINET_TYPES.PW);
test("No BBSCDL (Shiloh bar back)", !CABINET_TYPES.BBSCDL);
test("No RU (Shiloh refrigerator utility)", !CABINET_TYPES.RU);
test("No CTVAL (Shiloh valance)", !CABINET_TYPES.CTVAL);
test("No 1/4FPS (Shiloh panel)", !CABINET_TYPES["1/4FPS"]);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Modification Types ═══");

// Eclipse-only mods kept
test("recessedBottomShelf (RBS) exists", !!WIDTH_MOD_RULES.recessedBottomShelf);
test("shallowDepth13 exists", !!WIDTH_MOD_RULES.shallowDepth13);

// Pre-existing mods still intact
test("modSq30 still exists", !!WIDTH_MOD_RULES.modSq30);
test("modSq50 still exists", !!WIDTH_MOD_RULES.modSq50);
test("noToeKick still exists", !!WIDTH_MOD_RULES.noToeKick);
test("glassFrameDoor still exists", !!WIDTH_MOD_RULES.glassFrameDoor);
test("finishedInterior still exists", !!WIDTH_MOD_RULES.finishedInterior);

// Removed Shiloh-only mods
test("No modernInset mod", !WIDTH_MOD_RULES.modernInset);
test("No grafixTieredUpper", !WIDTH_MOD_RULES.grafixTieredUpper);
test("No grafixTieredLower", !WIDTH_MOD_RULES.grafixTieredLower);
test("No extendStileRight", !WIDTH_MOD_RULES.extendStileRight);
test("No extendStileLeft", !WIDTH_MOD_RULES.extendStileLeft);
test("No prepFinishedBottom", !WIDTH_MOD_RULES.prepFinishedBottom);
test("No shallowDepth16", !WIDTH_MOD_RULES.shallowDepth16);
test("No noPull", !WIDTH_MOD_RULES.noPull);
test("No vanityTallDoorEnd", !WIDTH_MOD_RULES.vanityTallDoorEnd);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Design Patterns — Vanity ═══");

const symDrawerVanity = VANITY_PATTERNS.find(p => p.id === "symmetric_drawer_flank_vanity");
test("symmetric_drawer_flank_vanity pattern exists", !!symDrawerVanity);
test("symmetric_drawer_flank_vanity has lapDrawer", symDrawerVanity && !!symDrawerVanity.lapDrawer);

const simpleVanity = VANITY_PATTERNS.find(p => p.id === "simple_vanity");
test("simple_vanity pattern exists", !!simpleVanity);

// Pre-existing vanity patterns still intact
const floatingDual = VANITY_PATTERNS.find(p => p.id === "floating_vanity_dual");
test("floating_vanity_dual still exists", !!floatingDual);
const symWall = VANITY_PATTERNS.find(p => p.id === "symmetrical_vanity_wall");
test("symmetrical_vanity_wall still exists", !!symWall);

// Removed Shiloh vanity patterns
test("No dual_sink_mirror (JRS/Shiloh)", !VANITY_PATTERNS.find(p => p.id === "dual_sink_mirror"));
test("No floating_powder_vanity (McCarter/Shiloh)", !VANITY_PATTERNS.find(p => p.id === "floating_powder_vanity"));

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Design Patterns — Bar ═══");

test("BAR_PATTERNS exported and non-empty", Array.isArray(BAR_PATTERNS) && BAR_PATTERNS.length >= 1);
const barDisplay = BAR_PATTERNS.find(p => p.id === "bar_zone_display");
test("bar_zone_display exists (Eclipse/Bissegger)", !!barDisplay);
test("No peninsula_bar_with_beverage_center (JRS/Shiloh)", !BAR_PATTERNS.find(p => p.id === "peninsula_bar_with_beverage_center"));

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Design Patterns — Valance & Fridge Tall (emptied) ═══");

test("VALANCE_PATTERNS is empty array", Array.isArray(VALANCE_PATTERNS) && VALANCE_PATTERNS.length === 0);
test("FRIDGE_TALL_PATTERNS is empty array", Array.isArray(FRIDGE_TALL_PATTERNS) && FRIDGE_TALL_PATTERNS.length === 0);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Door Style Compatibility ═══");

// Eclipse overlay styles still intact
test("Hanover (HNVR) still exists", !!DOOR_LAYOUT_COMPAT["Hanover (HNVR)"]);
test("Scottsdale FP (SCDL) still exists", !!DOOR_LAYOUT_COMPAT["Scottsdale FP (SCDL)"]);
test("Metropolitan VG (MET-V) still exists", !!DOOR_LAYOUT_COMPAT["Metropolitan VG (MET-V)"]);
test("Napa VG FP (NAPA-V) still exists", !!DOOR_LAYOUT_COMPAT["Napa VG FP (NAPA-V)"]);
test("Malibu FP (MLBU) still exists", !!DOOR_LAYOUT_COMPAT["Malibu FP (MLBU)"]);
test("Malibu Reeded Panel (RMLB) still exists", !!DOOR_LAYOUT_COMPAT["Malibu Reeded Panel (RMLB)"]);
test("Ward FP (WARD) still exists", !!DOOR_LAYOUT_COMPAT["Ward FP (WARD)"]);
test("Hartford FP (HTFD) still exists", !!DOOR_LAYOUT_COMPAT["Hartford FP (HTFD)"]);
test("Hanover FP 2.5 (HNVR-2.5) still exists", !!DOOR_LAYOUT_COMPAT["Hanover FP 2.5 (HNVR-2.5)"]);

// Removed Shiloh inset/overlay door styles
test("No Napa Vert Grain FP Inset", !DOOR_LAYOUT_COMPAT["Napa Vert Grain FP Inset (NAPA-V INS)"]);
test("No Scottsdale FP Inset", !DOOR_LAYOUT_COMPAT["Scottsdale FP Inset (SCDL INS)"]);
test("No Malibu Reeded Panel Inset", !DOOR_LAYOUT_COMPAT["Malibu Reeded Panel Inset (RMLB INS)"]);
test("No Hanover FP FOVL", !DOOR_LAYOUT_COMPAT["Hanover FP FOVL (HNVR FOVL)"]);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Solver — Eclipse Bath Room Types ═══");

const primaryResult = solve({
  layoutType: "single-wall",
  roomType: "primary_bath",
  walls: [{ id: "A", length: 72 }],
  appliances: [],
  prefs: { upperApproach: "none" },
});
test("Solver accepts primary_bath room type", !!primaryResult && !!primaryResult.walls);

const mainResult = solve({
  layoutType: "single-wall",
  roomType: "main_bath",
  walls: [{ id: "A", length: 48 }],
  appliances: [],
  prefs: { upperApproach: "none" },
});
test("Solver accepts main_bath room type", !!mainResult && !!mainResult.walls);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Cross-referencing: Catalog → Construction ═══");

for (const [key, cat] of Object.entries(CATALOG_PREFIXES)) {
  if (cat.construction) {
    test(`Catalog ${key} → construction ${cat.construction} exists`, !!CONSTRUCTION_TYPES[cat.construction]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Cross-referencing: Room Type → Cabinet Types ═══");

for (const [roomKey, room] of Object.entries(ROOM_TYPES)) {
  if (room.specialCabinets) {
    for (const cabCode of room.specialCabinets) {
      const found = !!CABINET_TYPES[cabCode] || Object.keys(CABINET_TYPES).some(k => k.startsWith(cabCode));
      test(`Room ${roomKey} → specialCabinet ${cabCode} exists in CABINET_TYPES`, found);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Expansion Tests (Eclipse-only): ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
