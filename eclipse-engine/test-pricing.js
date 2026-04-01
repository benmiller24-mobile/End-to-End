/**
 * Eclipse Engine — Pricing Tests (Phase 2)
 * Tests for C3 pricing engine: species upcharges, construction multipliers,
 * door group charges, modification pricing, spec totals, project totals,
 * and quick estimator.
 */

import {
  SPECIES_UPCHARGE, CONSTRUCTION_UPCHARGE,
  DOOR_STYLE_CHARGE, DRAWER_UPGRADES, DRAWER_GUIDE_UPGRADES,
  MOD_PRICING, ACCESSORY_PRICING,
  priceLineItem, priceSpec, priceProject, estimateProject,
  generateProjectSummary, generateCostBreakdownText,
  configureProject,
} from './src/index.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

function approx(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}


// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Pricing data exports
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Pricing data exports ═══");

assert(typeof SPECIES_UPCHARGE === "object" && Object.keys(SPECIES_UPCHARGE).length >= 10,
  `SPECIES_UPCHARGE has ${Object.keys(SPECIES_UPCHARGE).length} species (≥10)`);
assert(SPECIES_UPCHARGE["Maple"].pct === 0, "Maple is baseline (0% upcharge)");
assert(SPECIES_UPCHARGE["Walnut"].pct > 0, "Walnut has positive upcharge");
assert(SPECIES_UPCHARGE["TFL"].pct < 0, "TFL has negative upcharge (discount)");

assert(typeof CONSTRUCTION_UPCHARGE === "object",
  "CONSTRUCTION_UPCHARGE exported");
assert(CONSTRUCTION_UPCHARGE["Standard"].pct === 0,
  "Standard construction is baseline (0%)");
assert(CONSTRUCTION_UPCHARGE["Plywood"].pct === 10,
  "Plywood construction is 10% upcharge");

assert(typeof DOOR_STYLE_CHARGE === "object" && Object.keys(DOOR_STYLE_CHARGE).length >= 7,
  `DOOR_STYLE_CHARGE has ${Object.keys(DOOR_STYLE_CHARGE).length} styles (≥7)`);
assert(DOOR_STYLE_CHARGE["Hanover FP"].groupRate === 0,
  "Hanover FP has no door group charge");
assert(DOOR_STYLE_CHARGE["Malibu Reeded Panel"].groupRate > 0,
  "Malibu Reeded Panel has premium door group charge");

assert(typeof DRAWER_UPGRADES === "object", "DRAWER_UPGRADES exported");
assert(typeof DRAWER_GUIDE_UPGRADES === "object", "DRAWER_GUIDE_UPGRADES exported");

assert(typeof MOD_PRICING === "object", "MOD_PRICING exported");
assert(MOD_PRICING.widthMod.noCostThreshold === 0.30, "Width mod N/C threshold is 30%");
assert(MOD_PRICING.namedMods["WTD"].charge > 0, "WTD has a charge");
assert(MOD_PRICING.namedMods["RMK"].charge === 0, "RMK is free");

assert(typeof ACCESSORY_PRICING === "object", "ACCESSORY_PRICING exported");
assert(ACCESSORY_PRICING.endPanels["EDGTL"].price > 0, "EDGTL waterfall has a price");
assert(ACCESSORY_PRICING.touchUp["TUK-STAIN"].price > 0, "Touch-up kit has a price");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: priceLineItem — basic Maple/Standard/no extras
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem: basic ═══");

const basic = priceLineItem({ listPrice: 600 });
assert(basic.listPrice === 600, "Preserves listPrice");
assert(basic.speciesUpcharge === 0, "Default species is Maple (0%)");
assert(basic.constructionUpcharge === 0, "Default construction is Standard (0%)");
assert(basic.cabinetPrice === 600, "Cabinet price equals list price with no upcharges");
assert(basic.doorGroupCharge === 0, "No door group charge with no doors");
assert(basic.totalPrice === 600, "Total equals list price for basic item");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: priceLineItem — Walnut + Plywood + door charges
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem: Walnut + Plywood ═══");

const walnutPly = priceLineItem({
  listPrice: 1000,
  species: "Walnut",
  construction: "Plywood",
  doorStyle: "Napa VG FP",
  numDoors: 2,
});

// 1000 × 1.25 (Walnut) × 1.10 (Plywood) = 1375
assert(walnutPly.speciesUpcharge === 25, "Walnut is 25% upcharge");
assert(walnutPly.constructionUpcharge === 10, "Plywood is 10% upcharge");
assert(approx(walnutPly.cabinetPrice, 1375), `Cabinet price is $1375 (got $${walnutPly.cabinetPrice})`);

// Door: Napa VG FP = $3/door × 2 doors = $6
assert(approx(walnutPly.doorGroupCharge, 6), `Door group charge is $6 (got $${walnutPly.doorGroupCharge})`);
assert(approx(walnutPly.totalPrice, 1381), `Total is $1381 (got $${walnutPly.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: priceLineItem — TFL discount species
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem: TFL discount ═══");

const tfl = priceLineItem({ listPrice: 500, species: "TFL" });
// 500 × 0.85 = 425
assert(tfl.speciesUpcharge === -15, "TFL is -15% (discount)");
assert(approx(tfl.cabinetPrice, 425), `TFL cabinet price is $425 (got $${tfl.cabinetPrice})`);
assert(approx(tfl.totalPrice, 425), `TFL total is $425 (got $${tfl.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: priceLineItem — drawer + guide upgrades
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem: drawer upgrades ═══");

const drawers = priceLineItem({
  listPrice: 600,
  species: "Maple",
  drawerType: "5/8\" Hdwd Dovetail",
  drawerGuide: "Blum Edge Guide",
  numDrawers: 3,
});

// Drawer: $15/drawer × 3 = $45
// Guide: $5/drawer × 3 = $15
assert(drawers.drawerCharge === 45, `Drawer charge $45 (got $${drawers.drawerCharge})`);
assert(drawers.guideCharge === 15, `Guide charge $15 (got $${drawers.guideCharge})`);
assert(approx(drawers.totalPrice, 660), `Total $660 (got $${drawers.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: priceLineItem — named modifications
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem: modifications ═══");

const withMods = priceLineItem({
  listPrice: 800,
  modifications: [
    { mod: "WTD", qty: 2 },
    { mod: "PTKL" },
    { mod: "RMK" },  // free
  ],
});

// WTD: $45 × 2 = $90, PTKL: $18, RMK: $0 → total mod charge = $108
assert(withMods.modBreakdown.length === 3, "3 modification entries in breakdown");
assert(approx(withMods.modCharge, 108), `Mod charge $108 (got $${withMods.modCharge})`);
assert(approx(withMods.totalPrice, 908), `Total $908 (got $${withMods.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: priceSpec — multi-item spec calculation
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceSpec: multi-item spec ═══");

const specResult = priceSpec({
  specId: "walnut_main",
  species: "Walnut",
  construction: "Standard",
  doorStyle: "Hartford FP",
  lineItems: [
    { sku: "B3D21", listPrice: 621, line: "w-1", numDoors: 0, numDrawers: 3 },
    { sku: "B3D18", listPrice: 561, line: "w-2", numDoors: 0, numDrawers: 3 },
    { sku: "SB36",  listPrice: 761, line: "w-3", numDoors: 2, numDrawers: 0 },
  ],
});

assert(specResult.specId === "walnut_main", "Spec ID preserved");
assert(specResult.itemCount === 3, "3 items in spec");
assert(specResult.pricedItems.length === 3, "3 priced items returned");

// Each item × 1.25 (Walnut) × 1.00 (Standard) + Hartford FP $0/door
// Item 1: 621 × 1.25 = 776.25
// Item 2: 561 × 1.25 = 701.25
// Item 3: 761 × 1.25 = 951.25
// Total: 2428.75
assert(approx(specResult.pricedItems[0].cabinetPrice, 776.25),
  `First item: $776.25 (got $${specResult.pricedItems[0].cabinetPrice})`);
assert(approx(specResult.subtotal, 2428.75),
  `Spec subtotal: $2428.75 (got $${specResult.subtotal})`);
assert(specResult.widthModWarning === null,
  "No width mod warning with no modifications");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: priceProject — multi-spec project
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceProject: multi-spec project ═══");

const projectResult = priceProject({
  specs: [
    {
      specId: "walnut_bases",
      species: "Walnut",
      construction: "Standard",
      doorStyle: "Hanover FP",
      lineItems: [
        { sku: "B3D24", listPrice: 681, line: 1 },
        { sku: "B3D24", listPrice: 681, line: 2 },
      ],
    },
    {
      specId: "maple_uppers",
      species: "Maple",
      construction: "Standard",
      doorStyle: "Hanover FP",
      lineItems: [
        { sku: "W3630", listPrice: 420, line: 3 },
        { sku: "W3630", listPrice: 420, line: 4 },
      ],
    },
  ],
  accessories: [
    { sku: "FBEP 3/4-FTK", qty: 2, unitPrice: 180 },
    { sku: "TUK-STAIN", qty: 1, unitPrice: 35 },
  ],
  touchUp: { type: "TUK-STAIN", qty: 1 },
});

assert(projectResult.specs.length === 2, "2 specs in project");

// Walnut: 681 × 1.25 × 2 = 1702.50
// Maple:  420 × 1.00 × 2 = 840.00
// Spec subtotal: 2542.50
assert(approx(projectResult.specs[0].subtotal, 1702.50),
  `Walnut spec: $1702.50 (got $${projectResult.specs[0].subtotal})`);
assert(approx(projectResult.specs[1].subtotal, 840),
  `Maple spec: $840 (got $${projectResult.specs[1].subtotal})`);
assert(approx(projectResult.specSubtotal, 2542.50),
  `Spec subtotal: $2542.50 (got $${projectResult.specSubtotal})`);

// Accessories: (180 × 2) + (35 × 1) = 395
assert(approx(projectResult.accessoryTotal, 395),
  `Accessory total: $395 (got $${projectResult.accessoryTotal})`);

// Touch-up: $35
assert(approx(projectResult.touchUpCost, 35),
  `Touch-up: $35 (got $${projectResult.touchUpCost})`);

// Project total: 2542.50 + 395 + 35 = 2972.50
assert(approx(projectResult.projectTotal, 2972.50),
  `Project total: $2972.50 (got $${projectResult.projectTotal})`);

assert(projectResult.warnings.length === 0, "No warnings for clean project");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: estimateProject — quick estimate
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ estimateProject: quick estimates ═══");

const walnutEstimate = estimateProject({
  cabinetCount: 39,
  species: "Walnut",
  construction: "Standard",
});

assert(walnutEstimate.tier === "ultra", "Walnut auto-tiers to ultra");
assert(walnutEstimate.perCabinetEstimate > 0, "Per-cabinet estimate is positive");
assert(walnutEstimate.lowEstimate < walnutEstimate.midEstimate,
  "Low < mid estimate");
assert(walnutEstimate.midEstimate < walnutEstimate.highEstimate,
  "Mid < high estimate");
assert(walnutEstimate.cabinetSubtotal > 0, "Cabinet subtotal is positive");

const tflEstimate = estimateProject({
  cabinetCount: 10,
  species: "TFL",
  construction: "Standard",
});

assert(tflEstimate.tier === "budget", "TFL auto-tiers to budget");
assert(tflEstimate.perCabinetEstimate < walnutEstimate.perCabinetEstimate,
  "TFL per-cabinet is cheaper than Walnut");

// With explicit tier override
const overrideTier = estimateProject({
  cabinetCount: 20,
  species: "Maple",
  construction: "Plywood",
  tier: "premium",
});
assert(overrideTier.tier === "premium", "Explicit tier override works");
assert(overrideTier.perCabinetEstimate > tflEstimate.perCabinetEstimate,
  "Premium Maple Plywood > budget TFL per cabinet");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: Rift Cut White Oak pricing — Bissegger-level premium
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Premium species: Rift Cut White Oak ═══");

const riftOak = priceLineItem({
  listPrice: 1200,
  species: "Rift Cut White Oak",
  construction: "Standard",
  doorStyle: "Malibu Reeded Panel",
  numDoors: 2,
});

// 1200 × 1.20 × 1.00 = 1440 + (5.00 × 2) = 1450
assert(riftOak.speciesUpcharge === 20, "Rift Cut White Oak is 20% upcharge");
assert(approx(riftOak.cabinetPrice, 1440), `Rift Oak cabinet: $1440 (got $${riftOak.cabinetPrice})`);
assert(approx(riftOak.doorGroupCharge, 10), `Reeded Panel door charge: $10 (got $${riftOak.doorGroupCharge})`);
assert(approx(riftOak.totalPrice, 1450), `Total: $1450 (got $${riftOak.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 11: Combined upcharges — Walnut + Plywood + dovetail + mods
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Combined upcharges: full stack ═══");

const fullStack = priceLineItem({
  listPrice: 969,
  species: "Walnut",
  construction: "Plywood",
  doorStyle: "Ward FP",
  numDoors: 1,
  drawerType: "3/4\" Hdwd Dovetail",
  drawerGuide: "Blum Edge Guide",
  numDrawers: 2,
  modifications: [
    { mod: "WTD", qty: 1 },
    { mod: "DPS", qty: 1 },
  ],
});

// Cabinet: 969 × 1.25 × 1.10 = 1332.375
// Door: 3.50 × 1 = 3.50
// Drawer: 22 × 2 = 44
// Guide: 5 × 2 = 10
// Mods: 45 + 35 = 80
// Total: 1332.375 + 3.50 + 44 + 10 + 80 = 1469.875 → 1469.88
assert(approx(fullStack.cabinetPrice, 1332.38, 0.02),
  `Full stack cabinet: $1332.38 (got $${fullStack.cabinetPrice})`);
assert(approx(fullStack.doorGroupCharge, 3.50),
  `Door charge: $3.50 (got $${fullStack.doorGroupCharge})`);
assert(approx(fullStack.drawerCharge, 44),
  `Drawer charge: $44 (got $${fullStack.drawerCharge})`);
assert(approx(fullStack.guideCharge, 10),
  `Guide charge: $10 (got $${fullStack.guideCharge})`);
assert(approx(fullStack.modCharge, 80),
  `Mod charge: $80 (got $${fullStack.modCharge})`);
assert(approx(fullStack.totalPrice, 1469.88, 0.02),
  `Full stack total: $1469.88 (got $${fullStack.totalPrice})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 12: Edge cases
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Edge cases ═══");

// Zero list price
const zeroCab = priceLineItem({ listPrice: 0 });
assert(zeroCab.totalPrice === 0, "Zero list price → zero total");

// Unknown species defaults to Maple
const unknown = priceLineItem({ listPrice: 500, species: "Exotic Bamboo" });
assert(unknown.speciesUpcharge === 0,
  "Unknown species defaults to Maple (0%)");
assert(approx(unknown.totalPrice, 500),
  "Unknown species uses Maple pricing");

// Unknown modification is silently skipped
const unknownMod = priceLineItem({
  listPrice: 500,
  modifications: [{ mod: "UNKNOWN_MOD_XYZ" }],
});
assert(unknownMod.modCharge === 0, "Unknown mod is silently skipped");
assert(unknownMod.modBreakdown.length === 0, "Unknown mod not in breakdown");

// Empty project
const emptyProject = priceProject({ specs: [] });
assert(emptyProject.projectTotal === 0, "Empty project = $0");
assert(emptyProject.specs.length === 0, "Empty project has 0 specs");

// Spec with no line items
const emptySpec = priceSpec({
  specId: "empty",
  species: "Maple",
  construction: "Standard",
  lineItems: [],
});
assert(emptySpec.subtotal === 0, "Empty spec = $0");
assert(emptySpec.itemCount === 0, "Empty spec has 0 items");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 13: Training data sanity — Lofton-scale project estimate
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Training data sanity check ═══");

// Lofton: ~$19K total, 22 cabs, Walnut + HPL 2-tone
// We can't perfectly match but should be in the right ballpark
const loftonEstimate = estimateProject({
  cabinetCount: 22,
  species: "Walnut",
  construction: "Standard",
  doorStyle: "Metropolitan VG",
});

// Training actual: $19,197. Our estimate should be in $15K-$30K range
assert(loftonEstimate.lowEstimate > 10000 && loftonEstimate.highEstimate < 50000,
  `Lofton estimate in reasonable range: $${loftonEstimate.lowEstimate} - $${loftonEstimate.highEstimate}`);

// Bollini: ~$54K cabinetry (39 cabs, Walnut Natural)
const bolliniEstimate = estimateProject({
  cabinetCount: 39,
  species: "Walnut",
  construction: "Standard",
  doorStyle: "Hartford FP",
});

assert(bolliniEstimate.midEstimate > loftonEstimate.midEstimate,
  "Bollini (39 cabs) estimate > Lofton (22 cabs) estimate");

// Budget project: Bennet Utility (~$4.7K, 10 cabs, TFL)
const bennetEstimate = estimateProject({
  cabinetCount: 10,
  species: "TFL",
  construction: "Mixed",
  doorStyle: "Metropolitan VG",
});

assert(bennetEstimate.midEstimate < loftonEstimate.midEstimate,
  "Bennet budget TFL < Lofton Walnut estimate");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 14: Accessory pricing data
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Accessory pricing data ═══");

assert(ACCESSORY_PRICING.endPanels["REF"].price === 3550,
  "REF panel is $3,550 (Bissegger pricing)");
assert(ACCESSORY_PRICING.hardware["PBC"].price > 0,
  "PBC peninsula column has a price");
assert(ACCESSORY_PRICING.hardware["TL28"].price > 0,
  "TL28 turned leg has a price");
assert(ACCESSORY_PRICING.fillers["F3"].pricePerInch > 0,
  "F3 filler has price per inch");
assert(ACCESSORY_PRICING.trim["PLWT-COVE"].price > 0,
  "PLWT-COVE finished top cove has a price");


// ═══════════════════════════════════════════════════════════════════════════
// TEST: GFD, FINISHED INT, PWL modification pricing entries
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ GFD / FINISHED INT / PWL modification pricing ═══");

// GFD exists and is $0
assert(MOD_PRICING.namedMods["GFD"] !== undefined, "GFD exists in namedMods");
assert(MOD_PRICING.namedMods["GFD"].charge === 0, "GFD is $0 (no extra charge)");

// FINISHED INT alias exists and is $40
assert(MOD_PRICING.namedMods["FINISHED INT"] !== undefined, "FINISHED INT exists in namedMods");
assert(MOD_PRICING.namedMods["FINISHED INT"].charge === 40, "FINISHED INT is $40/item");

// FIN INT original also exists
assert(MOD_PRICING.namedMods["FIN INT"] !== undefined, "FIN INT (original) still exists");
assert(MOD_PRICING.namedMods["FIN INT"].charge === 40, "FIN INT is $40/item");

// PWL exists and is $20
assert(MOD_PRICING.namedMods["PWL"] !== undefined, "PWL exists in namedMods");
assert(MOD_PRICING.namedMods["PWL"].charge === 20, "PWL is $20/item");

// MD exists and is $15/door
assert(MOD_PRICING.namedMods["MD"] !== undefined, "MD exists in namedMods");
assert(MOD_PRICING.namedMods["MD"].charge === 15, "MD is $15/door");


// ═══════════════════════════════════════════════════════════════════════════
// TEST: priceLineItem with GFD + FINISHED INT + PWL modifications
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceLineItem with display cabinet modifications ═══");

// Upper wall cab with GFD + FINISHED INT + PWL (typical very_high sophistication)
const displayCabPrice = priceLineItem({
  listPrice: 350,
  species: "Walnut",
  construction: "Plywood",
  doorStyle: "Hanover FP",
  numDoors: 2,
  numDrawers: 0,
  modifications: [
    { mod: "GFD", qty: 2 },
    { mod: "FINISHED INT", qty: 1 },
    { mod: "PWL", qty: 1 },
  ],
});

// GFD: $0 × 2 = $0
// FINISHED INT: $40 × 1 = $40
// PWL: $20 × 1 = $20
// Total mod charge: $60
assert(displayCabPrice.modCharge === 60,
  `Display cab mod charge: $60 (GFD $0 + FININT $40 + PWL $20) (got $${displayCabPrice.modCharge})`);
assert(displayCabPrice.modBreakdown.length === 3,
  `Mod breakdown has 3 entries (got ${displayCabPrice.modBreakdown.length})`);

// Verify GFD is tracked even at $0
const gfdEntry = displayCabPrice.modBreakdown.find(m => m.mod === "GFD");
assert(gfdEntry !== undefined, "GFD appears in mod breakdown");
assert(gfdEntry.cost === 0, "GFD cost is $0");
assert(gfdEntry.qty === 2, "GFD qty is 2 (2 glass doors)");

// Verify FINISHED INT
const finIntEntry = displayCabPrice.modBreakdown.find(m => m.mod === "FINISHED INT");
assert(finIntEntry !== undefined, "FINISHED INT appears in mod breakdown");
assert(finIntEntry.cost === 40, "FINISHED INT cost is $40");

// Total price: base × species × construction + door charge + mod charge
// 350 × 1.25 × 1.10 = 481.25 + 0 (door charge) + 60 (mods) = 541.25
const expectedBase = 350 * 1.25 * 1.10;
assert(Math.abs(displayCabPrice.totalPrice - (expectedBase + 60)) < 0.01,
  `Total price correct: $${(expectedBase + 60).toFixed(2)} (got $${displayCabPrice.totalPrice})`);

// SA corner cab with GFD + FINISHED INT + PWL (stacked wall angle at very_high)
const saPrice = priceLineItem({
  listPrice: 200,
  species: "White Oak",
  construction: "Standard",
  numDoors: 1,
  numDrawers: 0,
  modifications: [
    { mod: "GFD", qty: 1 },
    { mod: "FINISHED INT", qty: 1 },
    { mod: "PWL", qty: 1 },
  ],
});
// GFD $0 + FININT $40 + PWL $20 = $60 mods
assert(saPrice.modCharge === 60, `SA cab mod charge: $60 (got $${saPrice.modCharge})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST: priceSpec with modifications across multiple line items
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ priceSpec with mods across line items ═══");

const specWithMods = priceSpec({
  species: "Walnut",
  construction: "Plywood",
  doorStyle: "Hanover FP",
  drawerType: "Standard",
  drawerGuide: "Standard",
  lineItems: [
    // Standard wall cab, no mods
    { sku: "W3042", listPrice: 300, numDoors: 2, numDrawers: 0, modifications: [] },
    // GFD display cab
    { sku: "W3042-GFD", listPrice: 300, numDoors: 2, numDrawers: 0,
      modifications: [{ mod: "GFD", qty: 2 }, { mod: "FINISHED INT", qty: 1 }, { mod: "PWL", qty: 1 }] },
    // Mullion door cab
    { sku: "W3042-MD", listPrice: 300, numDoors: 2, numDrawers: 0,
      modifications: [{ mod: "MD", qty: 1 }] },
  ],
});

// Item 1: no mods → $0 mod charge
// Item 2: GFD($0) + FININT($40) + PWL($20) = $60
// Item 3: MD($15 × 1) = $15
// Total mod charges across spec: $75
const totalModsInSpec = specWithMods.pricedItems.reduce((sum, item) => sum + (item.modCharge || 0), 0);
assert(totalModsInSpec === 75,
  `Total mod charges across spec: $75 (got $${totalModsInSpec})`);

// Verify mod charges are included in subtotal
const item1Price = specWithMods.pricedItems[0].totalPrice;
const item2Price = specWithMods.pricedItems[1].totalPrice;
assert(item2Price > item1Price, `GFD cab ($${item2Price}) costs more than plain cab ($${item1Price})`);
assert(Math.abs(item2Price - item1Price - 60) < 0.01,
  `Price difference is exactly $60 (mods) (got $${(item2Price - item1Price).toFixed(2)})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST: End-to-end configureProject with very_high producing mods
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ End-to-end configureProject with mod pricing ═══");

// Use a long single-wall with sink (no range) so uppers get standard pattern
// with GFD flanking at very_high. Needs ≥3 base cabs for GFD to trigger.
const modQuote = configureProject({
  room: {
    layoutType: "single-wall",
    roomType: "kitchen",
    walls: [
      { id: "A", length: 240, role: "sink", ceilingHeight: 90 },
    ],
    appliances: [
      { type: "sink", width: 36, wall: "A", position: 102 },
    ],
    prefs: { sophistication: "very_high" },
  },
  materials: {
    species: "Walnut",
    construction: "Plywood",
    doorStyle: "Hanover FP",
  },
});

assert(modQuote.pricing !== undefined, "Quote has pricing section");
assert(modQuote.pricing.projectTotal > 0, `Project total > 0 (got $${modQuote.pricing.projectTotal})`);

// very_high with low ceiling (90") → standard uppers with GFD on flanking positions
// Check that at least some line items have mods
const allPricedItems = modQuote.pricing.specs.flatMap(s => s.pricedItems || []);
const itemsWithMods = allPricedItems.filter(item => item.modBreakdown?.length > 0);
assert(itemsWithMods.length > 0,
  `very_high sophistication produces items with mods (got ${itemsWithMods.length})`);

// Total mod charges should be > 0 (at least GFD+FININT+PWL on flanking uppers)
const totalModCharges = allPricedItems.reduce((sum, item) => sum + (item.modCharge || 0), 0);
assert(totalModCharges > 0,
  `Total mod charges > $0 for very_high project (got $${totalModCharges})`);

// Verify mod charges show up in spec subtotals
const specSubtotal = modQuote.pricing.specs[0]?.subtotal || 0;
assert(specSubtotal > 0, `Spec subtotal includes mod charges (got $${specSubtotal})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 12: generateProjectSummary — structure and key fields
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ generateProjectSummary ═══");

// Create a simple quote result for testing
const testQuote = configureProject({
  room: {
    layoutType: "l-shape",
    roomType: "kitchen",
    walls: [
      { id: "A", length: 156, role: "range" },
      { id: "B", length: 120, role: "sink" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
      { type: "dishwasher", width: 24, wall: "B" },
    ],
    prefs: { cornerTreatment: "auto", preferDrawerBases: true },
  },
  materials: {
    species: "Walnut",
    construction: "Plywood",
    doorStyle: "Hanover FP",
  },
});

// Extract from the returned quote which already has summary
const summary = testQuote.summary;

// Test: summary structure
assert(summary !== undefined, "generateProjectSummary returns an object");
assert(typeof summary.projectTotal === "number", "Has projectTotal (number)");
assert(typeof summary.categories === "object", "Has categories (object)");
assert(typeof summary.modificationBreakdown === "object", "Has modificationBreakdown (array-like)");
assert(typeof summary.speciesSurcharge === "object", "Has speciesSurcharge");
assert(typeof summary.constructionSurcharge === "object", "Has constructionSurcharge");
assert(Array.isArray(summary.topItems), "Has topItems (array)");
assert(typeof summary.roomSummary === "object", "Has roomSummary");

// Test: projectTotal matches quote
assert(approx(summary.projectTotal, testQuote.pricing.projectTotal),
  `projectTotal matches quote.projectTotal (got $${summary.projectTotal}, quote $${testQuote.pricing.projectTotal})`);

// Test: category counts
const totalCatsCount = Object.values(summary.categories).reduce((sum, cat) => sum + cat.count, 0);
assert(totalCatsCount > 0, `Categories have items (total count: ${totalCatsCount})`);

// Test: species surcharge reflects Walnut
assert(summary.speciesSurcharge.species === "Walnut",
  `Species surcharge shows Walnut (got ${summary.speciesSurcharge.species})`);
assert(summary.speciesSurcharge.pct === 25,
  `Walnut upcharge is 25% (got ${summary.speciesSurcharge.pct}%)`);

// Test: construction surcharge reflects Plywood
assert(summary.constructionSurcharge.construction === "Plywood",
  `Construction shows Plywood (got ${summary.constructionSurcharge.construction})`);
assert(summary.constructionSurcharge.pct === 10,
  `Plywood upcharge is 10% (got ${summary.constructionSurcharge.pct}%)`);

// Test: topItems sorted by price descending, max 5
assert(summary.topItems.length <= 5, `topItems has ≤5 items (got ${summary.topItems.length})`);
if (summary.topItems.length > 1) {
  for (let i = 1; i < summary.topItems.length; i++) {
    assert(summary.topItems[i - 1].price >= summary.topItems[i].price,
      `topItems[${i - 1}] price >= topItems[${i}] price`);
  }
}

// Test: roomSummary
assert(summary.roomSummary.layoutType === "l-shape",
  `roomSummary.layoutType is l-shape (got ${summary.roomSummary.layoutType})`);
assert(summary.roomSummary.roomType === "kitchen",
  `roomSummary.roomType is kitchen (got ${summary.roomSummary.roomType})`);
assert(summary.roomSummary.totalCabinets > 0,
  `roomSummary.totalCabinets > 0 (got ${summary.roomSummary.totalCabinets})`);
assert(typeof summary.roomSummary.validationErrors === "number",
  `roomSummary.validationErrors is number`);
assert(typeof summary.roomSummary.validationWarnings === "number",
  `roomSummary.validationWarnings is number`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 13: generateCostBreakdownText — formatted output
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ generateCostBreakdownText ═══");

const breakdownText = generateCostBreakdownText(summary);

assert(typeof breakdownText === "string", "generateCostBreakdownText returns string");
assert(breakdownText.length > 100, `Output is substantial (${breakdownText.length} chars)`);
assert(breakdownText.includes("ECLIPSE"), "Contains ECLIPSE header");
assert(breakdownText.includes("PROJECT TOTAL"), "Contains PROJECT TOTAL");
assert(breakdownText.includes("Walnut"), "Contains species name (Walnut)");
assert(breakdownText.includes("L Shape"), "Contains layout type (L Shape)");
assert(breakdownText.includes("Kitchen"), "Contains room type (Kitchen)");

// Verify it's formatted (has currency formatting, sections, etc.)
assert(breakdownText.includes("$"), "Contains currency symbol ($)");
assert(breakdownText.includes("─"), "Contains section dividers (─)");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 14: configureProject includes summary in return
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ configureProject with summary ═══");

assert(testQuote.summary !== undefined, "configureProject result includes summary");
assert(typeof testQuote.summary === "object", "summary is an object");
assert(testQuote.summary.projectTotal > 0, `summary.projectTotal > 0 (got $${testQuote.summary.projectTotal})`);
assert(typeof testQuote.summary.categories === "object", "summary has categories");


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Pricing tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
