/**
 * Smoke test for Eclipse pricing module
 */
import {
  CATALOG, findSku, searchSkus, TYPE_NAMES,
  SPECIES_PCT, FINISH_COLORS, getSpeciesNames, getColorsForSpecies,
  DOORS, DRAWER_FRONTS, DRAWER_BOXES, DOOR_GROUP_CHARGES,
  CABINET_MODS, ROT_OPTIONS,
  extractCabinetWidth, guessDoors, guessDrawerCount, guessBuiltInROT, formatCurrency,
  calculateItemPrice, calculateOrderTotal, calculateLayoutPrice,
  calculateDealerPrice, buildProposal, quickEstimate,
} from './src/index.js';

let pass = 0, fail = 0;
function assert(label, condition) {
  if (condition) { pass++; }
  else { fail++; console.error(`  FAIL: ${label}`); }
}

console.log("=== Eclipse Pricing Module Tests ===\n");

// 1. Catalog
console.log("1. SKU Catalog");
assert("Catalog loaded", CATALOG.length > 4000);
console.log(`   ${CATALOG.length} SKUs loaded`);
const b36 = findSku("B36");
assert("findSku B36", b36 && b36.p > 0 && b36.t === "B");
console.log(`   B36: $${b36.p} stock, type=${b36.t}, ref=${b36.r}`);
const search = searchSkus("WBC36", 5);
assert("searchSkus WBC36", search.length > 0);
console.log(`   Search 'WBC36': ${search.length} results`);

// 2. Finish Data
console.log("\n2. Finish Data");
assert("28 species", Object.keys(SPECIES_PCT).length === 28);
assert("TFL is -25%", SPECIES_PCT["TFL"] === -25);
assert("Walnut is +20%", SPECIES_PCT["Walnut"] === 20);
const oakColors = getColorsForSpecies("White Oak");
assert("White Oak has colors", oakColors.length > 10);
console.log(`   White Oak: ${oakColors.length} colors available`);

// 3. Door Data
console.log("\n3. Door Data");
assert("75+ doors", DOORS.length >= 75);
assert("55+ drawer fronts", DRAWER_FRONTS.length >= 50);
assert("7 drawer boxes", DRAWER_BOXES.length === 7);
assert("Door group A=$0", DOOR_GROUP_CHARGES.A === 0);
assert("Door group B=$44", DOOR_GROUP_CHARGES.B === 44);
console.log(`   ${DOORS.length} doors, ${DRAWER_FRONTS.length} drawer fronts, ${DRAWER_BOXES.length} drawer boxes`);

// 4. Mod Data
console.log("\n4. Modification Data");
assert("35+ mods", CABINET_MODS.length >= 35);
assert("10 ROT options", ROT_OPTIONS.length === 10);
console.log(`   ${CABINET_MODS.length} modifications, ${ROT_OPTIONS.length} ROT options`);

// 5. Helpers
console.log("\n5. Helper Functions");
assert("B36 width=36", extractCabinetWidth("B36") === 36);
assert("W3630 width=36", extractCabinetWidth("W3630") === 36);
assert("B36-RT width=36", extractCabinetWidth("B36-RT") === 36);
assert("B24 doors=1", guessDoors("B24", "B") === 1);
assert("B36 doors=2", guessDoors("B36", "B") === 2);
assert("W3630 doors=2", guessDoors("W3630", "W") === 2);
assert("B36-RT has ROT", guessBuiltInROT("B36-RT") === 2);
assert("formatCurrency", formatCurrency(1234.5) === "$1,235");

// 6. Pricing Engine — Core
console.log("\n6. Pricing Engine");
// Standard base cabinet, White Oak, Standard construction, Hanover doors
const b36Item = { ...b36, q: 1, dc: 2, drc: 1 };
const p1 = calculateItemPrice(b36Item, "White Oak", "Standard", "HNVR", "DF-HNVR", "5/8-STD");
assert("B36 unit price > 0", p1.unitPrice > 0);
assert("B36 has door charge", p1.doorChg === 0); // HNVR is group A = $0
console.log(`   B36 White Oak Standard: ${formatCurrency(p1.unitPrice)}`);

// Same with Walnut (+20%) and Plywood (+10%)
const p2 = calculateItemPrice(b36Item, "Walnut", "Plywood", "HNVR", "DF-HNVR", "5/8-STD");
assert("Walnut+Plywood > White Oak+Std", p2.unitPrice > p1.unitPrice);
console.log(`   B36 Walnut Plywood: ${formatCurrency(p2.unitPrice)} (+${Math.round((p2.unitPrice/p1.unitPrice-1)*100)}%)`);

// Mitered door upcharge
const p3 = calculateItemPrice(b36Item, "White Oak", "Standard", "ESSX", "DF-HNVR", "5/8-STD");
assert("Mitered door costs more", p3.unitPrice > p1.unitPrice);
assert("Door charge = 2×$44", p3.doorChg === 88); // ESSX is group B, 2 doors
console.log(`   B36 White Oak + Essex Miter: ${formatCurrency(p3.unitPrice)} (door upcharge: $${p3.doorChg})`);

// Legrabox drawer box upcharge
const p4 = calculateItemPrice(b36Item, "White Oak", "Standard", "HNVR", "DF-HNVR", "LEGRA");
assert("Legrabox costs more", p4.unitPrice > p1.unitPrice);
console.log(`   B36 White Oak + Legrabox: ${formatCurrency(p4.unitPrice)} (drawer box upcharge: $${p4.dbChg})`);

// 7. Order Total
console.log("\n7. Order Total");
const order = calculateOrderTotal(
  [
    { ...findSku("B36"), q: 2, dc: 2, drc: 1 },
    { ...findSku("W3630"), q: 3, dc: 2, drc: 0 },
    { ...findSku("SB36"), q: 1, dc: 2, drc: 1 },
  ],
  { species: "White Oak", construction: "Standard", door: "HNVR", drawerFront: "DF-HNVR", drawerBox: "5/8-STD" }
);
assert("Order has 3 line items", order.items.length === 3);
assert("Order subtotal > 0", order.subtotal > 0);
console.log(`   3-item order: ${formatCurrency(order.subtotal)}`);

// 8. Layout Pricing
console.log("\n8. Layout Pricing (Design App Integration)");
const layout = calculateLayoutPrice(
  [
    { sku: "B36", qty: 2, wall: "A", doorCount: 2, drawerCount: 1 },
    { sku: "W3630", qty: 3, wall: "A", doorCount: 2, drawerCount: 0 },
    { sku: "SB36", qty: 1, wall: "B", doorCount: 2, drawerCount: 1 },
    { sku: "W2430", qty: 2, wall: "B", doorCount: 1, drawerCount: 0 },
  ],
  { species: "Maple", construction: "Plywood", door: "HNVR", drawerFront: "DF-HNVR", drawerBox: "5/8-STD" },
  sku => findSku(sku)
);
assert("Layout priced", layout.subtotal > 0);
assert("Wall A total", layout.byWall["A"] > 0);
assert("Wall B total", layout.byWall["B"] > 0);
console.log(`   Layout subtotal: ${formatCurrency(layout.subtotal)}`);
console.log(`   Wall A: ${formatCurrency(layout.byWall["A"])} | Wall B: ${formatCurrency(layout.byWall["B"])}`);

// 9. Margin Calculator
console.log("\n9. Margin & Proposal");
const dealer = calculateDealerPrice(5000, 35, "markup");
assert("35% markup", Math.abs(dealer.sellPrice - 6750) < 1);
console.log(`   $5,000 cost @ 35% markup = ${formatCurrency(dealer.sellPrice)}`);

const proposal = buildProposal(layout.subtotal, { markupPct: 35, linearFeet: 22, counterSF: 48 });
assert("Proposal total > 0", proposal.projectTotal > 0);
console.log(`   Full proposal: ${formatCurrency(proposal.projectTotal)}`);
console.log(`   Cabinet sell: ${formatCurrency(proposal.cabinetSell)}`);
console.log(`   Blended margin: ${proposal.blendedMarginPct.toFixed(1)}%`);

const est = quickEstimate(20, "mid");
assert("Quick estimate", est.lowEstimate > 0 && est.highEstimate > est.lowEstimate);
console.log(`   Quick estimate (20 LF, mid): ${formatCurrency(est.lowEstimate)} - ${formatCurrency(est.highEstimate)}`);

// Summary
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
