/**
 * Eclipse Engine — Integration Tests
 * =====================================
 * End-to-end tests that feed real training-project-inspired layouts through
 * the full configureProject pipeline and verify pricing is in the right ballpark.
 *
 * These tests don't try to replicate exact training totals (the solver generates
 * its own layout from room dimensions, which won't match hand-designed layouts).
 * Instead they verify:
 *   1. The pipeline runs without error for every room type and layout
 *   2. Pricing is in the correct order of magnitude for the species/construction
 *   3. Upcharge ratios are correct (Walnut > Maple > TFL)
 *   4. Multi-spec projects have multiple specs
 *   5. Training data line items price correctly through priceLineItem/priceSpec
 */

import {
  configureProject, quickConfigure, configureMultiRoom,
  priceLineItem, priceSpec, priceProject,
  SPECIES_UPCHARGE, CONSTRUCTION_UPCHARGE, DOOR_STYLE_CHARGE,
  CATALOG_PRICES, parseSku, lookupListPrice,
} from './src/index.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAINING_DIR = path.join(__dirname, '..', 'trainingData');

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

function group(name, fn) {
  console.log(`\n── ${name}`);
  fn();
}

function loadTraining(filename) {
  return JSON.parse(fs.readFileSync(path.join(TRAINING_DIR, filename), 'utf8'));
}


// ─── 1. Lofton Doris — L-shape Walnut+HPL 2-tone ───────────────────────────

group("Integration: Lofton Doris — L-shape Walnut+HPL", () => {
  const td = loadTraining("lofton_doris.json");

  // Price real training line items through priceSpec
  const sinkWall = td.walls.find(w => w.wall_id === "sink_wall");
  const rangeWall = td.walls.find(w => w.wall_id === "range_wall");

  const walnutItems = [
    ...sinkWall.base_cabinets.filter(c => c.spec === "walnut_main"),
    ...rangeWall.base_cabinets.filter(c => c.spec === "walnut_main"),
    ...(rangeWall.upper_cabinets || []).filter(c => c.spec === "walnut_main"),
  ];

  const specResult = priceSpec({
    species: "Walnut",
    construction: "Standard",
    doorStyle: "Metropolitan VG",
    lineItems: walnutItems.map((c, i) => ({
      sku: c.sku,
      line: i + 1,
      listPrice: c.list_price,
      numDoors: c.num_doors || 0,
      numDrawers: c.num_drawers || 0,
    })),
  });

  assert(specResult.itemCount > 0, `Walnut spec has ${specResult.itemCount} items`);
  assert(specResult.subtotal > 0, `Walnut spec subtotal > 0 ($${specResult.subtotal})`);
  // Walnut +25% over list prices
  const listSum = walnutItems.reduce((s, c) => s + (c.list_price || 0), 0);
  assert(specResult.subtotal > listSum, `Walnut subtotal ($${specResult.subtotal}) > list sum ($${listSum})`);
  const walnutRatio = specResult.subtotal / listSum;
  assert(walnutRatio > 1.2 && walnutRatio < 1.3, `Walnut upcharge ~25% (got ${((walnutRatio-1)*100).toFixed(1)}%)`);

  // Run solver pipeline on similar room
  const quote = configureProject({
    room: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 114, role: "sink" },   // sink wall ~114" of cabs
        { id: "B", length: 104, role: "range" },  // range wall ~104" of cabs + range
      ],
      appliances: [
        { type: "range", width: 30, wall: "B" },
        { type: "sink", width: 36, wall: "A" },
      ],
      prefs: { sophistication: "high" },
    },
    materials: { species: "Walnut", construction: "Standard", doorStyle: "Metropolitan VG" },
    options: { projectName: "Lofton-inspired", includeEstimate: true },
  });

  assert(quote.pricing.projectTotal > 0, `Lofton-inspired total > 0 ($${quote.pricing.projectTotal})`);
  assert(quote.layout.totalCabinets >= 5, `Has ≥5 cabs (${quote.layout.totalCabinets})`);
  // Training project was $19K — solver layout will differ, but should be same order of magnitude
  assert(quote.pricing.projectTotal > 2000, "Total > $2K");
  assert(quote.pricing.projectTotal < 50000, "Total < $50K");
});


// ─── 2. Bollini — U-shape Walnut Ultra ──────────────────────────────────────

group("Integration: Bollini — U-shape Walnut", () => {
  const td = loadTraining("bollini_kitchen.json");

  // Price real training line items
  const rangeWall = td.walls.find(w => w.wall_id === "range_wall");
  const items = rangeWall.base_cabinets;

  const specResult = priceSpec({
    species: "Walnut",
    construction: "Standard",
    doorStyle: "Hartford FP",
    lineItems: items.map((c, i) => ({
      sku: c.sku,
      line: i + 1,
      listPrice: c.list_price,
      numDoors: c.num_doors || 0,
      numDrawers: c.num_drawers || 0,
      modifications: c.modifications || [],
    })),
  });

  assert(specResult.subtotal > 0, `Bollini range wall subtotal > 0 ($${specResult.subtotal})`);

  // Run solver on U-shape inspired by Bollini
  const quote = quickConfigure({
    layoutType: "u-shape",
    walls: [
      { id: "A", length: 180, role: "range" },
      { id: "B", length: 96, role: "sink" },
      { id: "C", length: 144, role: "fridge" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
      { type: "dishwasher", width: 24, wall: "B" },
      { type: "refrigerator", width: 36, wall: "C", position: "end" },
    ],
    species: "Walnut",
    construction: "Standard",
    sophistication: "very_high",
  });

  assert(quote.layout.cornerCount === 2, "U-shape has 2 corners");
  assert(quote.pricing.projectTotal > 3000, `Bollini-inspired > $3K ($${quote.pricing.projectTotal})`);
});


// ─── 3. Helmer Mitchell — Single wall TFL budget ────────────────────────────

group("Integration: Helmer Mitchell — Single wall TFL", () => {
  const td = loadTraining("helmer_mitchell_kitchen.json");

  // Training: 7 cabs, TFL, $5,026.50
  const quote = quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 120 }],
    appliances: [
      { type: "sink", width: 33, wall: "A" },
    ],
    species: "TFL",
    construction: "Standard",
    doorStyle: "Hanover FP",
  });

  assert(quote.materials.species === "TFL", "Species is TFL");
  // TFL is budget tier — should be cheap
  assert(quote.pricing.projectTotal < 10000, `TFL single-wall < $10K ($${quote.pricing.projectTotal})`);
  assert(quote.pricing.projectTotal > 500, `TFL single-wall > $500`);
});


// ─── 4. DeLawyer — L-shape PET Laminate ─────────────────────────────────────

group("Integration: DeLawyer — L-shape PET Laminate", () => {
  const quote = quickConfigure({
    layoutType: "l-shape",
    walls: [
      { id: "A", length: 156, role: "sink" },
      { id: "B", length: 120, role: "range" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "B" },
      { type: "sink", width: 36, wall: "A" },
      { type: "dishwasher", width: 24, wall: "A" },
    ],
    species: "PET Laminate",
    construction: "Standard",
  });

  assert(quote.pricing.projectTotal > 1000, "PET Laminate L-shape > $1K");
  assert(quote.pricing.projectTotal < 30000, "PET Laminate L-shape < $30K");
  assert(quote.layout.cornerCount === 1, "L-shape 1 corner");
});


// ─── 5. Diehl — L-shape Cherry with island ──────────────────────────────────

group("Integration: Diehl — L-shape Cherry with island", () => {
  const quote = configureProject({
    room: {
      layoutType: "l-shape",
      walls: [
        { id: "A", length: 168, role: "sink" },
        { id: "B", length: 120, role: "fridge" },
      ],
      island: { length: 84, depth: 24.875 },
      appliances: [
        { type: "sink", width: 36, wall: "A" },
        { type: "refrigerator", width: 36, wall: "B", position: "end" },
      ],
      prefs: {},
    },
    materials: { species: "Cherry", construction: "Standard", doorStyle: "Hanover FP" },
    options: { includeEstimate: true },
  });

  assert(quote.layout.hasIsland === true, "Has island");
  assert(quote.pricing.projectTotal > 2000, "Cherry L+island > $2K");
  // Cherry is +10% — somewhere between Maple and Walnut
  assert(quote.estimate.tier === "premium", `Cherry tier is premium (got ${quote.estimate.tier})`);
});


// ─── 6. Gable — U-shape Walnut+Maple 2-tone ────────────────────────────────

group("Integration: Gable — U-shape 2-tone Walnut+Maple", () => {
  const quote = configureProject({
    room: {
      layoutType: "u-shape",
      walls: [
        { id: "A", length: 144, role: "range" },
        { id: "B", length: 96, role: "sink" },
        { id: "C", length: 120, role: "pantry" },
      ],
      appliances: [
        { type: "range", width: 30, wall: "A" },
        { type: "sink", width: 36, wall: "B" },
        { type: "dishwasher", width: 24, wall: "B" },
      ],
      prefs: { sophistication: "high" },
    },
    materials: {
      specs: [
        { specId: "walnut-bases", species: "Walnut", construction: "Standard", doorStyle: "Napa VG FP", walls: ["A", "B", "C"] },
        { specId: "maple-uppers", species: "Maple", construction: "Standard", doorStyle: "Napa VG FP", roles: ["upper", "wall"] },
      ],
    },
    options: { projectName: "Gable-inspired" },
  });

  assert(quote.materials.specCount === 2, "2-tone has 2 specs");
  assert(quote.pricing.specs.length === 2, "2 pricing specs");
  assert(quote.pricing.projectTotal > 3000, "2-tone U-shape > $3K");
});


// ─── 7. Bennet Utility — non-kitchen room ───────────────────────────────────

group("Integration: Bennet Utility — utility room", () => {
  const quote = quickConfigure({
    layoutType: "single-wall",
    roomType: "utility",
    walls: [{ id: "A", length: 72 }],
    appliances: [],
    species: "HPL",
    construction: "Mixed",
  });

  assert(quote.project.roomType === "utility", "Room type is utility");
  assert(quote.pricing.projectTotal > 200, "Utility room > $200");
  assert(quote.pricing.projectTotal < 8000, "Utility room < $8K");
});


// ─── 8. Cost Plus Vanity — vanity room ──────────────────────────────────────

group("Integration: Cost Plus — vanity room", () => {
  const quote = quickConfigure({
    layoutType: "single-wall",
    roomType: "vanity",
    walls: [{ id: "A", length: 60 }],
    appliances: [],
    species: "Maple",
    construction: "Standard",
  });

  assert(quote.project.roomType === "vanity", "Room type is vanity");
  assert(quote.pricing.projectTotal > 100, "Vanity > $100");
  assert(quote.pricing.projectTotal < 10000, "Vanity < $10K");
});


// ─── 9. Bissegger Office — office room ──────────────────────────────────────

group("Integration: Bissegger — office room", () => {
  const quote = quickConfigure({
    layoutType: "single-wall",
    roomType: "office",
    walls: [{ id: "A", length: 96 }],
    appliances: [],
    species: "Maple",
    construction: "Standard",
  });

  assert(quote.project.roomType === "office", "Room type is office");
  assert(quote.pricing.projectTotal > 200, "Office > $200");
});


// ─── 10. LWH Hartley — laundry room ────────────────────────────────────────

group("Integration: LWH Hartley — laundry room", () => {
  const quote = quickConfigure({
    layoutType: "single-wall",
    roomType: "laundry",
    walls: [{ id: "A", length: 72 }],
    appliances: [],
    species: "TFL",
    construction: "Standard",
  });

  assert(quote.project.roomType === "laundry", "Room type is laundry");
  assert(quote.pricing.projectTotal > 100, "Laundry > $100");
  assert(quote.pricing.projectTotal < 6000, "Laundry < $6K");
});


// ─── 11. Species upcharge ordering — real training comparison ───────────────

group("Species upcharge ordering on identical layout", () => {
  const makeQuote = (species) => quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 120 }],
    appliances: [{ type: "sink", width: 33, wall: "A" }],
    species,
    construction: "Standard",
    doorStyle: "Hanover FP",
  });

  const tfl   = makeQuote("TFL");
  const maple = makeQuote("Maple");
  const oak   = makeQuote("White Oak");
  const walnut= makeQuote("Walnut");

  assert(tfl.pricing.projectTotal < maple.pricing.projectTotal,
    `TFL ($${tfl.pricing.projectTotal}) < Maple ($${maple.pricing.projectTotal})`);
  assert(maple.pricing.projectTotal < oak.pricing.projectTotal,
    `Maple ($${maple.pricing.projectTotal}) < White Oak ($${oak.pricing.projectTotal})`);
  assert(oak.pricing.projectTotal < walnut.pricing.projectTotal,
    `White Oak ($${oak.pricing.projectTotal}) < Walnut ($${walnut.pricing.projectTotal})`);
});


// ─── 12. Construction upcharge ordering ─────────────────────────────────────

group("Construction upcharge ordering on identical layout", () => {
  const makeQuote = (construction) => quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 120 }],
    appliances: [{ type: "sink", width: 33, wall: "A" }],
    species: "Maple",
    construction,
    doorStyle: "Hanover FP",
  });

  const std  = makeQuote("Standard");
  const mixed= makeQuote("Mixed");
  const ply  = makeQuote("Plywood");

  assert(std.pricing.projectTotal < mixed.pricing.projectTotal,
    `Standard ($${std.pricing.projectTotal}) < Mixed ($${mixed.pricing.projectTotal})`);
  assert(mixed.pricing.projectTotal < ply.pricing.projectTotal,
    `Mixed ($${mixed.pricing.projectTotal}) < Plywood ($${ply.pricing.projectTotal})`);
});


// ─── 13. Real training line items through priceLineItem ─────────────────────

group("Training line items — priceLineItem accuracy", () => {
  // Bollini BBC48R-MC — known $3,938 list price (on corner_zone wall)
  const td = loadTraining("bollini_kitchen.json");
  const cornerZone = td.walls.find(w => w.wall_id === "corner_zone");
  const bbc = cornerZone?.base_cabinets?.find(c => c.sku && c.sku.includes("BBC"));

  if (bbc) {
    const result = priceLineItem({
      listPrice: bbc.list_price,
      species: "Walnut",
      construction: "Standard",
      doorStyle: "Hartford FP",
      numDoors: 1,
    });

    // Walnut = +25% over list
    const expected = bbc.list_price * 1.25;
    assert(Math.abs(result.cabinetPrice - expected) < 1,
      `BBC cabinet price $${result.cabinetPrice} ≈ $${expected} (list ${bbc.list_price} × 1.25)`);
    assert(result.speciesUpcharge === 25, "Walnut upcharge is 25%");
  } else {
    assert(false, "Could not find BBC in Bollini range wall");
  }
});


// ─── 14. Real training data — Diehl Cherry full spec pricing ────────────────

group("Training spec — Diehl Cherry sink wall", () => {
  const td = loadTraining("diehl_kitchen.json");
  const sinkWall = td.walls.find(w => w.wall_id === "sink_wall");
  const bases = sinkWall.base_cabinets || [];

  const specResult = priceSpec({
    species: "Cherry",
    construction: "Standard",
    doorStyle: "Hanover FP",
    lineItems: bases.map((c, i) => ({
      sku: c.sku,
      line: i + 1,
      listPrice: c.list_price,
      numDoors: c.num_doors || 0,
      numDrawers: c.num_drawers || 0,
    })),
  });

  // Cherry = +10%
  const listSum = bases.reduce((s, c) => s + (c.list_price || 0), 0);
  assert(specResult.subtotal > listSum, `Cherry subtotal ($${specResult.subtotal}) > list ($${listSum})`);
  if (listSum > 0) {
    const ratio = specResult.subtotal / listSum;
    assert(ratio > 1.08 && ratio < 1.12, `Cherry upcharge ~10% (got ${((ratio-1)*100).toFixed(1)}%)`);
  }
  assert(specResult.itemCount === bases.length, `Item count matches (${specResult.itemCount})`);
});


// ─── 15. Multi-room inspired by Bissegger (Great Room + Office) ─────────────

group("Integration: Multi-room — Bissegger-inspired great room + office", () => {
  const quote = configureMultiRoom({
    rooms: [
      {
        name: "Great Room",
        room: {
          layoutType: "l-shape",
          roomType: "kitchen",
          walls: [
            { id: "A", length: 180, role: "range" },
            { id: "B", length: 132, role: "sink" },
          ],
          island: { length: 96, depth: 24.875 },
          appliances: [
            { type: "range", width: 30, wall: "A" },
            { type: "sink", width: 36, wall: "B" },
            { type: "dishwasher", width: 24, wall: "B" },
          ],
          prefs: { sophistication: "very_high" },
        },
      },
      {
        name: "Office",
        room: {
          layoutType: "single-wall",
          roomType: "office",
          walls: [{ id: "A", length: 96 }],
          appliances: [],
          prefs: {},
        },
      },
    ],
    materials: { species: "Rift Cut White Oak", construction: "Standard", doorStyle: "Malibu FP" },
    options: { projectName: "Bissegger-inspired" },
  });

  assert(quote.project.roomCount === 2, "2 rooms");
  assert(quote.rooms[0].layout.hasIsland === true, "Great room has island");
  assert(quote.rooms[1].project.roomType === "office", "Second room is office");
  assert(quote.combined.projectTotal > 5000, `Multi-room > $5K ($${quote.combined.projectTotal})`);
  // Rift Cut White Oak is premium tier
  assert(quote.estimate.tier === "premium", `RCWO tier is premium (got ${quote.estimate.tier})`);
});


// ─── 16. Showroom ECLA — small White Oak display ────────────────────────────

group("Integration: Showroom ECLA — White Oak display", () => {
  const td = loadTraining("showroom_ecla_kitchen.json");

  // Price training cabs directly
  const allCabs = [];
  for (const w of td.walls || []) {
    allCabs.push(...(w.base_cabinets || []), ...(w.upper_cabinets || []));
  }

  if (allCabs.length > 0 && allCabs[0].list_price) {
    const specResult = priceSpec({
      species: "White Oak",
      construction: "Standard",
      doorStyle: "Hanover FP",
      lineItems: allCabs.map((c, i) => ({
        sku: c.sku,
        line: i + 1,
        listPrice: c.list_price,
        numDoors: c.num_doors || 0,
        numDrawers: c.num_drawers || 0,
      })),
    });

    // White Oak = +15%
    const listSum = allCabs.reduce((s, c) => s + (c.list_price || 0), 0);
    if (listSum > 0) {
      const ratio = specResult.subtotal / listSum;
      assert(ratio > 1.13 && ratio < 1.17, `White Oak upcharge ~15% (got ${((ratio-1)*100).toFixed(1)}%)`);
    }
    // Training total $8,537 — our priced spec should be in same range
    assert(specResult.subtotal > 5000, `ECLA spec > $5K ($${specResult.subtotal})`);
    assert(specResult.subtotal < 15000, `ECLA spec < $15K ($${specResult.subtotal})`);
  } else {
    // Skip if no list prices
    console.log("  (skipped — no list_price in training data)");
  }
});


// ─── 17. Eddies — L-shape Maple with island ────────────────────────────────

group("Integration: Eddies — L-shape Maple with island", () => {
  const td = loadTraining("eddies_kitchen.json");

  // Price training sink wall cabs
  const sinkWall = td.walls.find(w => w.wall_id === "sink_wall");
  const bases = sinkWall?.base_cabinets || [];

  if (bases.length > 0 && bases[0].list_price) {
    const specResult = priceSpec({
      species: "Maple",
      construction: "Standard",
      doorStyle: "Scottsdale FP",
      lineItems: bases.map((c, i) => ({
        sku: c.sku,
        line: i + 1,
        listPrice: c.list_price,
        numDoors: c.num_doors || 0,
        numDrawers: c.num_drawers || 0,
      })),
    });

    // Maple = 0% upcharge, so subtotal ≈ list sum
    const listSum = bases.reduce((s, c) => s + (c.list_price || 0), 0);
    if (listSum > 0) {
      const ratio = specResult.subtotal / listSum;
      assert(ratio > 0.98 && ratio < 1.02, `Maple: no upcharge (ratio ${ratio.toFixed(3)})`);
    }
  }

  // Run solver pipeline
  const quote = configureProject({
    room: {
      layoutType: "l-shape",
      walls: [
        { id: "A", length: 111, role: "sink" },
        { id: "B", length: 108, role: "range" },
      ],
      island: { length: 84, depth: 24.875 },
      appliances: [
        { type: "sink", width: 42, wall: "A" },
        { type: "range", width: 30, wall: "B" },
      ],
      prefs: {},
    },
    materials: { species: "Maple", construction: "Standard", doorStyle: "Scottsdale FP" },
  });

  assert(quote.layout.hasIsland === true, "Has island");
  assert(quote.pricing.projectTotal > 2000, "Eddies-inspired > $2K");
});


// ─── 18. Kline Piazza — L-shape 3-tone ─────────────────────────────────────

group("Integration: Kline Piazza — L-shape 3-tone", () => {
  const quote = configureProject({
    room: {
      layoutType: "l-shape",
      walls: [
        { id: "A", length: 156, role: "range" },
        { id: "B", length: 120, role: "sink" },
      ],
      appliances: [
        { type: "range", width: 30, wall: "A" },
        { type: "sink", width: 36, wall: "B" },
      ],
      prefs: { sophistication: "very_high" },
    },
    materials: {
      specs: [
        { specId: "walnut-bases", species: "Walnut", construction: "Standard", doorStyle: "Napa VG FP", walls: ["A", "B"] },
        { specId: "maple-uppers", species: "Maple", construction: "Standard", doorStyle: "Napa VG FP", roles: ["upper"] },
        { specId: "maple-island", species: "Maple", construction: "Standard", doorStyle: "Napa VG FP", families: ["island"] },
      ],
    },
    options: { projectName: "Kline-inspired" },
  });

  assert(quote.materials.specCount === 3, `3-tone has 3 specs (got ${quote.materials.specCount})`);
  assert(quote.pricing.specs.length === 3, "3 pricing specs");
});


// ─── 19. priceProject with real multi-spec structure ────────────────────────

group("priceProject — multi-spec with accessories", () => {
  const result = priceProject({
    specs: [
      {
        specId: "walnut",
        species: "Walnut",
        construction: "Standard",
        doorStyle: "Hartford FP",
        lineItems: [
          { sku: "B3D21", line: 1, listPrice: 621, numDoors: 0, numDrawers: 3 },
          { sku: "SB36", line: 2, listPrice: 712, numDoors: 2, numDrawers: 0 },
          { sku: "B3D18", line: 3, listPrice: 561, numDoors: 0, numDrawers: 3 },
        ],
      },
      {
        specId: "hpl",
        species: "HPL",
        construction: "Standard",
        doorStyle: "Metropolitan VG",
        lineItems: [
          { sku: "O2784", line: 1, listPrice: 2150, numDoors: 2, numDrawers: 0 },
        ],
      },
    ],
    accessories: [
      { sku: "FBEP 3/4-FTK", qty: 2, unitPrice: 180 },
      { sku: "F3", qty: 1, unitPrice: 24 },
    ],
    touchUp: { type: "TUK-STAIN", qty: 1 },
  });

  assert(result.specs.length === 2, "2 specs");
  assert(result.specs[0].specId === "walnut", "First spec is walnut");
  assert(result.specs[1].specId === "hpl", "Second spec is hpl");
  assert(result.specSubtotal > 0, "specSubtotal > 0");
  assert(result.accessoryTotal === 384, `Accessory total = 384 (got ${result.accessoryTotal})`);
  assert(result.touchUpCost === 35, `Touch-up cost = 35 (got ${result.touchUpCost})`);
  assert(result.projectTotal === result.specSubtotal + result.accessoryTotal + result.touchUpCost,
    "projectTotal = specSub + acc + touchUp");
});


// ─── 20. Edge cases and stress tests ────────────────────────────────────────

group("Edge case — galley layout", () => {
  const quote = quickConfigure({
    layoutType: "galley",
    walls: [
      { id: "A", length: 120 },
      { id: "B", length: 120 },
    ],
    appliances: [
      { type: "sink", width: 33, wall: "A" },
      { type: "range", width: 30, wall: "B" },
    ],
  });

  assert(quote.layout.cornerCount === 0, "Galley has 0 corners");
  assert(quote.layout.walls.length === 2, "2 walls");
  assert(quote.pricing.projectTotal > 0, "Has a price");
});

group("Edge case — very small room", () => {
  const quote = quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 48 }],
    appliances: [],
    species: "TFL",
  });

  assert(quote.layout.totalCabinets >= 1, `At least 1 cab (${quote.layout.totalCabinets})`);
  assert(quote.pricing.projectTotal > 0, "Has a price even for tiny room");
});

group("Edge case — large U-shape with island", () => {
  const quote = quickConfigure({
    layoutType: "u-shape",
    walls: [
      { id: "A", length: 240, role: "range" },
      { id: "B", length: 144, role: "sink" },
      { id: "C", length: 216, role: "fridge" },
    ],
    island: { length: 108, depth: 24.875 },
    appliances: [
      { type: "range", width: 48, wall: "A" },
      { type: "sink", width: 42, wall: "B" },
      { type: "dishwasher", width: 24, wall: "B" },
      { type: "refrigerator", width: 36, wall: "C", position: "end" },
    ],
    species: "Rift Cut White Oak",
    construction: "Plywood",
    doorStyle: "Malibu FP",
    sophistication: "very_high",
  });

  assert(quote.layout.totalCabinets >= 15, `Large layout ≥15 cabs (${quote.layout.totalCabinets})`);
  assert(quote.layout.cornerCount === 2, "U-shape 2 corners");
  assert(quote.layout.hasIsland === true, "Has island");
  assert(quote.pricing.projectTotal > 10000, `RCWO large > $10K ($${quote.pricing.projectTotal})`);
});


// ─── SUMMARY ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Integration tests: ${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) process.exit(1);
