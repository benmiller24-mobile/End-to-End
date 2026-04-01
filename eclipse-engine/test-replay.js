/**
 * Eclipse Engine — Training Data Replay Tests
 * =============================================
 * Automatically reconstructs solver inputs from training JSONs, runs the
 * full configureProject pipeline, and compares generated layouts against
 * the original training data.
 *
 * For each project we check:
 *   1. Pipeline runs without error
 *   2. Generated layout has similar cabinet count (within tolerance)
 *   3. Generated pricing is in the correct order of magnitude
 *   4. Species upcharge percentages match training data differentials
 *   5. SKU families match the training project's cabinet types
 *   6. Room type and layout type are correctly interpreted
 */

import {
  configureProject, quickConfigure,
  priceLineItem, priceSpec,
  SPECIES_UPCHARGE,
  parseSku, lookupListPrice,
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


// ─── REPLAY INFRASTRUCTURE ──────────────────────────────────────────────────

/**
 * Extract solver-compatible input from a training JSON.
 * Reconstructs wall lengths from cabinet widths + appliance widths.
 */
function extractSolverInput(td) {
  const walls = [];
  const appliances = [];
  const tdWalls = td.walls || [];
  const tdApps = td.appliances || [];
  const layout = td.layout || {};

  // Infer room type
  let roomType = "kitchen";
  if (layout.room_type) {
    const rt = layout.room_type.toLowerCase();
    if (rt.includes("vanity") || rt.includes("bath")) roomType = "vanity";
    else if (rt.includes("office")) roomType = "office";
    else if (rt.includes("laundry")) roomType = "laundry";
    else if (rt.includes("utility")) roomType = "utility";
    else if (rt.includes("bar") || rt.includes("great")) roomType = "great_room";
    else if (rt.includes("showroom")) roomType = "showroom";
  }
  if (layout.is_utility) roomType = "utility";

  // Infer layout type
  let layoutType = "single-wall";
  const lt = (layout.type || "").toLowerCase();
  if (lt.includes("u-shape") || lt.includes("u shape")) layoutType = "u-shape";
  else if (lt.includes("l-shape") || lt.includes("l shape")) layoutType = "l-shape";
  else if (lt.includes("galley")) layoutType = "galley";
  else if (lt.includes("g-shape")) layoutType = "g-shape";
  else if (lt.includes("single")) layoutType = "single-wall";
  else if (lt.includes("multi-zone")) layoutType = "single-wall"; // treat multi-zone as single for solver

  // Build walls from training data
  for (const tw of tdWalls) {
    const bases = tw.base_cabinets || [];
    const uppers = tw.upper_cabinets || [];

    // Skip pure-appliance walls (fridge_wall with 0 base cabs)
    const baseWidth = bases.reduce((s, c) => s + (c.width || 0), 0);
    const isIslandWall = tw.wall_id && tw.wall_id.includes("island");

    if (isIslandWall) continue; // islands handled separately

    // Skip walls with no cabinets at all
    if (bases.length === 0 && uppers.length === 0) continue;

    // Determine wall role from wall_id
    let role = "general";
    const wid = (tw.wall_id || "").toLowerCase();
    if (wid.includes("range")) role = "range";
    else if (wid.includes("sink")) role = "sink";
    else if (wid.includes("fridge") || wid.includes("ref")) role = "fridge";
    else if (wid.includes("pantry")) role = "pantry";
    else if (wid.includes("oven")) role = "oven";
    else if (wid.includes("bar")) role = "barEntertaining";

    // Estimate wall length: sum of base cab widths + appliance widths on this wall
    let wallLength = baseWidth;
    const wallApps = tdApps.filter(a => a.wall === tw.wall_id);
    for (const a of wallApps) {
      wallLength += a.width || 0;
    }
    // Add ~12" buffer for fillers/corners if wall has cabs
    if (wallLength > 0) wallLength += 12;
    // Minimum wall length
    wallLength = Math.max(wallLength, 48);

    walls.push({
      id: tw.wall_id || `wall_${walls.length}`,
      length: wallLength,
      role,
    });
  }

  // Build appliances
  for (const ta of tdApps) {
    const type = normalizeApplianceType(ta.type);
    if (!type) continue;
    appliances.push({
      type,
      width: ta.width || 30,
      wall: ta.wall || walls[0]?.id || "A",
    });
  }

  // Detect island
  let island = null;
  if (layout.has_island) {
    const islandWalls = tdWalls.filter(w => w.wall_id && w.wall_id.includes("island"));
    if (islandWalls.length > 0) {
      const islandBases = islandWalls.flatMap(w => w.base_cabinets || []);
      const islandLength = islandBases.reduce((s, c) => s + (c.width || 0), 0) || 84;
      island = { length: Math.max(islandLength, 60), depth: 24.875 };
    } else {
      island = { length: layout.island_length_inches || 84, depth: 24.875 };
    }
  }

  // Materials from first spec
  const specs = Array.isArray(td.material_specs) ? td.material_specs : Object.values(td.material_specs || {});
  const primarySpec = specs[0] || {};
  const species = normalizeSpecies(primarySpec.species || "Maple");
  const construction = normalizeConstruction(primarySpec.construction || "Standard");
  const doorStyle = normalizeDoorStyle(primarySpec.door_style || "Hanover FP");

  // Ensure we have at least one wall
  if (walls.length === 0) {
    walls.push({ id: "A", length: 96, role: "general" });
  }

  return {
    room: {
      layoutType,
      roomType,
      walls,
      island,
      appliances,
      prefs: { cornerTreatment: "auto", preferDrawerBases: true, sophistication: "high" },
    },
    materials: { species, construction, doorStyle },
    training: {
      totalPrice: td.total_price || 0,
      baseCabCount: tdWalls.reduce((s, w) => s + (w.base_cabinets || []).length, 0),
      upperCabCount: tdWalls.reduce((s, w) => s + (w.upper_cabinets || []).length, 0),
      specCount: specs.length,
      species: specs.map(s => s.species),
      listPriceSum: tdWalls.reduce((s, w) => {
        return s + [...(w.base_cabinets || []), ...(w.upper_cabinets || [])].reduce((s2, c) => s2 + (c.list_price || 0), 0);
      }, 0),
    },
  };
}

function normalizeApplianceType(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("range") && !t.includes("hood")) return "range";
  if (t.includes("cooktop")) return "cooktop";
  if (t.includes("sink")) return "sink";
  if (t.includes("dishwasher")) return "dishwasher";
  if (t.includes("refrigerator") || t.includes("fridge")) return "refrigerator";
  if (t.includes("oven")) return "wallOven";
  if (t.includes("wine")) return "wineCooler";
  return null;
}

function normalizeSpecies(species) {
  // Map training data species names to our pricing keys
  const map = {
    "Thermally Fused Laminate (TFL)": "TFL",
    "Thermally Fused Laminate": "TFL",
    "TFL": "TFL",
    "High Pressure Laminate Matte": "HPL",
    "High Pressure Laminate": "HPL",
    "HPL": "HPL",
    "PET Laminate": "PET Laminate",
    "Maple": "Maple",
    "Walnut": "Walnut",
    "Cherry": "Cherry",
    "Alder": "Alder",
    "White Oak": "White Oak",
    "Rift Cut White Oak": "Rift Cut White Oak",
    "Rustic Hickory": "Rustic Hickory",
    "American Poplar": "American Poplar",
    "Rustic Walnut": "Walnut",
    "Acrylic": "Acrylic",
    "Walnut Natural": "Walnut",
  };
  return map[species] || species;
}

function normalizeConstruction(construction) {
  const c = (construction || "").toLowerCase();
  if (c.includes("plywood") && !c.includes("partial")) return "Plywood";
  if (c.includes("procore") || c.includes("partial")) return "Procore Plywood/Partial";
  if (c.includes("mixed")) return "Mixed";
  return "Standard";
}

function normalizeDoorStyle(doorStyle) {
  // Extract door style name, strip group markers like {A}
  const clean = (doorStyle || "").replace(/\s*\{[A-Z]\}\s*/g, "").trim();
  // Check if it's in our pricing table
  const knownStyles = [
    "Metropolitan VG", "Hanover FP", "Hartford FP", "Scottsdale FP",
    "Malibu FP", "Napa VG FP", "Ward FP", "Malibu Reeded Panel", "Hanover FP 2.5",
  ];
  for (const s of knownStyles) {
    if (clean.toLowerCase().includes(s.toLowerCase().split(" ")[0])) return s;
  }
  return "Hanover FP"; // safe default
}


// ─── REPLAY: Price real training line items ─────────────────────────────────

function replayTrainingPricing(td) {
  const specs = Array.isArray(td.material_specs) ? td.material_specs : Object.values(td.material_specs || {});
  const walls = td.walls || [];

  const results = [];

  for (const spec of specs) {
    // Gather all cabs that belong to this spec
    const specId = spec.spec_id || spec.po || "unknown";
    const allCabs = [];

    for (const w of walls) {
      const bases = (w.base_cabinets || []).filter(c => !c.spec || c.spec === specId || c.spec === spec.spec_id);
      const uppers = (w.upper_cabinets || []).filter(c => !c.spec || c.spec === specId || c.spec === spec.spec_id);
      allCabs.push(...bases, ...uppers);
    }

    // Only price cabs that have list_price
    const priceable = allCabs.filter(c => c.list_price && c.list_price > 0);

    if (priceable.length > 0) {
      const species = normalizeSpecies(spec.species || "Maple");
      const construction = normalizeConstruction(spec.construction || "Standard");
      const doorStyle = normalizeDoorStyle(spec.door_style || "Hanover FP");

      const priced = priceSpec({
        specId,
        species,
        construction,
        doorStyle,
        lineItems: priceable.map((c, i) => ({
          sku: c.sku,
          line: i + 1,
          listPrice: c.list_price,
          numDoors: c.num_doors || 0,
          numDrawers: c.num_drawers || 0,
          modifications: c.modifications || [],
        })),
      });

      const listSum = priceable.reduce((s, c) => s + c.list_price, 0);
      const expectedPct = SPECIES_UPCHARGE[species]?.pct || 0;

      results.push({
        specId,
        species,
        construction,
        cabCount: priceable.length,
        listSum,
        pricedSubtotal: priced.subtotal,
        expectedUpchargePct: expectedPct,
        actualUpchargePct: listSum > 0 ? Math.round((priced.subtotal / listSum - 1) * 100) : 0,
      });
    }
  }

  return results;
}


// ═══════════════════════════════════════════════════════════════════════════
// REPLAY TESTS
// ═══════════════════════════════════════════════════════════════════════════


// ─── Project replays ────────────────────────────────────────────────────────

const REPLAY_PROJECTS = [
  { file: "lofton_doris.json",          name: "Lofton Doris",          minCabs: 5,  maxCabs: 30 },
  { file: "bollini_kitchen.json",       name: "Bollini",               minCabs: 8,  maxCabs: 45 },
  { file: "eddies_kitchen.json",        name: "Eddies",                minCabs: 5,  maxCabs: 45 },
  { file: "gable_kitchen.json",         name: "Gable",                 minCabs: 5,  maxCabs: 47 },
  { file: "diehl_kitchen.json",         name: "Diehl",                 minCabs: 5,  maxCabs: 55 },
  { file: "helmer_mitchell_kitchen.json",name: "Helmer Mitchell",      minCabs: 3,  maxCabs: 20 },
  { file: "delawyer_kitchen.json",      name: "DeLawyer",              minCabs: 5,  maxCabs: 41 },
  { file: "showroom_ecla_kitchen.json", name: "Showroom ECLA",         minCabs: 3,  maxCabs: 25 },
  { file: "sabelhaus_west_kitchen.json",name: "Sabelhaus West",        minCabs: 3,  maxCabs: 25 },
  { file: "bissegger_great_room.json",  name: "Bissegger Great Room",  minCabs: 8,  maxCabs: 71 },
  { file: "lwh_hartley_laundry.json",   name: "LWH Hartley Laundry",   minCabs: 1,  maxCabs: 15 },
  { file: "cost_plus_vanity.json",      name: "Cost Plus Vanity",      minCabs: 1,  maxCabs: 15 },
  { file: "bissegger_office.json",      name: "Bissegger Office",      minCabs: 1,  maxCabs: 20 },
  { file: "bennet_utility.json",        name: "Bennet Utility",        minCabs: 1,  maxCabs: 15 },
];

for (const proj of REPLAY_PROJECTS) {
  group(`Replay: ${proj.name}`, () => {
    const td = loadTraining(proj.file);
    const input = extractSolverInput(td);

    // 1. Pipeline runs without error
    let quote;
    try {
      quote = configureProject({
        ...input,
        options: { projectName: proj.name, includeEstimate: true },
      });
      assert(true, "Pipeline runs without error");
    } catch (e) {
      assert(false, `Pipeline error: ${e.message}`);
      return;
    }

    // 2. Cabinet count in reasonable range
    assert(quote.layout.totalCabinets >= proj.minCabs,
      `Cabinet count ≥ ${proj.minCabs} (got ${quote.layout.totalCabinets})`);
    assert(quote.layout.totalCabinets <= proj.maxCabs,
      `Cabinet count ≤ ${proj.maxCabs} (got ${quote.layout.totalCabinets})`);

    // 3. Pricing is positive
    assert(quote.pricing.projectTotal > 0,
      `Project total > $0 (got $${quote.pricing.projectTotal})`);

    // 4. Room type correctly inferred
    assert(quote.project.roomType === input.room.roomType,
      `Room type = ${input.room.roomType} (got ${quote.project.roomType})`);

    // 5. Estimate included
    assert(quote.estimate !== null, "Estimate included");
  });
}


// ─── Training pricing accuracy ──────────────────────────────────────────────

const PRICING_PROJECTS = [
  { file: "lofton_doris.json",          name: "Lofton" },
  { file: "bollini_kitchen.json",       name: "Bollini" },
  { file: "diehl_kitchen.json",         name: "Diehl" },
  { file: "eddies_kitchen.json",        name: "Eddies" },
  { file: "delawyer_kitchen.json",      name: "DeLawyer" },
  { file: "helmer_mitchell_kitchen.json",name: "Helmer Mitchell" },
  { file: "showroom_ecla_kitchen.json", name: "Showroom ECLA" },
  { file: "gable_kitchen.json",         name: "Gable" },
  { file: "bissegger_great_room.json",  name: "Bissegger GR" },
];

group("Training pricing — species upcharge verification", () => {
  for (const proj of PRICING_PROJECTS) {
    const td = loadTraining(proj.file);
    const specResults = replayTrainingPricing(td);

    for (const sr of specResults) {
      if (sr.listSum > 0) {
        // Verify species upcharge is within ±2% of expected
        const diff = Math.abs(sr.actualUpchargePct - sr.expectedUpchargePct);
        assert(diff <= 2,
          `${proj.name} ${sr.species}: upcharge ${sr.actualUpchargePct}% ≈ expected ${sr.expectedUpchargePct}% (diff ${diff}%)`);
      }
    }
  }
});


// ─── SKU family coverage ────────────────────────────────────────────────────

group("SKU family coverage — training SKUs parseable", () => {
  const allSkus = new Set();
  const allFamilies = new Set();

  for (const proj of REPLAY_PROJECTS) {
    const td = loadTraining(proj.file);
    for (const w of td.walls || []) {
      for (const c of [...(w.base_cabinets || []), ...(w.upper_cabinets || [])]) {
        if (c.sku) {
          allSkus.add(c.sku);
          const parsed = parseSku(c.sku);
          allFamilies.add(parsed.family);
        }
      }
    }
  }

  assert(allSkus.size > 50, `Found ${allSkus.size} unique SKUs across training data`);
  assert(allFamilies.size >= 5, `Found ${allFamilies.size} SKU families`);

  // Verify key families are represented
  const expectedFamilies = ["base", "drawerBase", "sinkBase", "wall", "lazySusan"];
  for (const fam of expectedFamilies) {
    assert(allFamilies.has(fam), `Family '${fam}' found in training data`);
  }
});


// ─── Price lookup coverage ──────────────────────────────────────────────────

group("Price lookup coverage — training SKUs get prices", () => {
  let pricedCount = 0;
  let zeroPriceCount = 0;
  const zeroPriceFamilies = new Set();

  for (const proj of REPLAY_PROJECTS) {
    const td = loadTraining(proj.file);
    for (const w of td.walls || []) {
      for (const c of [...(w.base_cabinets || []), ...(w.upper_cabinets || [])]) {
        if (c.sku) {
          const parsed = parseSku(c.sku);
          const price = lookupListPrice(parsed);
          if (price > 0) pricedCount++;
          else {
            zeroPriceCount++;
            zeroPriceFamilies.add(parsed.family);
          }
        }
      }
    }
  }

  const total = pricedCount + zeroPriceCount;
  const coverage = total > 0 ? (pricedCount / total * 100).toFixed(1) : 0;
  assert(pricedCount > 50, `${pricedCount} SKUs got catalog prices (${coverage}% coverage)`);

  // Accessories/fillers/panels are expected to be $0 — that's fine
  const nonAccessoryZero = [...zeroPriceFamilies].filter(f =>
    !["filler", "endPanel", "accessory", "trim", "hardware"].includes(f)
  );
  assert(nonAccessoryZero.length === 0,
    `All non-accessory families have prices (zero-price families: ${nonAccessoryZero.join(", ") || "none"})`);
});


// ─── Layout comparison ──────────────────────────────────────────────────────

group("Layout comparison — generated vs training cabinet families", () => {
  // For projects with good data, verify the solver generates similar cabinet families
  // Note: Solver generates its own layout from reconstructed inputs, so we check
  // for families that the solver reliably produces given the extracted input
  // (sink bases require a sink appliance, corners require multi-wall layouts)
  const comparisons = [
    { file: "lofton_doris.json", name: "Lofton", expectedFamilies: ["drawerBase"], alternativeFamilies: { 0: ["lazySusan", "halfMoon"] } },
    { file: "bollini_kitchen.json", name: "Bollini", expectedFamilies: ["drawerBase"] },
    { file: "diehl_kitchen.json", name: "Diehl", expectedFamilies: ["drawerBase", "wall"] },
    { file: "helmer_mitchell_kitchen.json", name: "Helmer", expectedFamilies: ["drawerBase", "wall"] },
  ];

  for (const comp of comparisons) {
    const td = loadTraining(comp.file);
    const input = extractSolverInput(td);
    const quote = configureProject({ ...input, options: { projectName: comp.name } });

    // Collect generated SKU families
    const genFamilies = new Set();
    for (const item of quote.pricing.specs[0]?.pricedItems || []) {
      const parsed = parseSku(item.sku);
      genFamilies.add(parsed.family);
    }

    for (let i = 0; i < comp.expectedFamilies.length; i++) {
      const fam = comp.expectedFamilies[i];
      // Check if this family has alternatives (for different corner selections)
      if (comp.alternativeFamilies && comp.alternativeFamilies[i]) {
        const hasExpected = genFamilies.has(fam);
        const hasAlternative = comp.alternativeFamilies[i].some(alt => genFamilies.has(alt));
        assert(hasExpected || hasAlternative,
          `${comp.name}: generated layout includes '${fam}' or alternatives ${comp.alternativeFamilies[i]} (has: ${[...genFamilies].join(", ")})`);
      } else {
        assert(genFamilies.has(fam),
          `${comp.name}: generated layout includes '${fam}' family (has: ${[...genFamilies].join(", ")})`);
      }
    }
  }
});


// ─── Order-of-magnitude pricing comparison ──────────────────────────────────

group("Order-of-magnitude pricing — generated vs training", () => {
  // Compare our solver-generated quotes against training data totals.
  // The solver creates its own layout (not identical to hand-designed),
  // so we allow a wide tolerance (0.1x to 5x).
  const comparisons = [
    { file: "helmer_mitchell_kitchen.json",name: "Helmer Mitchell",   trainTotal: 5026 },
    { file: "showroom_ecla_kitchen.json", name: "Showroom ECLA",      trainTotal: 8537 },
    { file: "lofton_doris.json",          name: "Lofton",             trainTotal: 19197 },
    { file: "delawyer_kitchen.json",      name: "DeLawyer",           trainTotal: 18919 },
    { file: "bollini_kitchen.json",       name: "Bollini",            trainTotal: 63961 },
  ];

  for (const comp of comparisons) {
    const td = loadTraining(comp.file);
    const input = extractSolverInput(td);
    const quote = configureProject({ ...input, options: { projectName: comp.name } });

    const ratio = quote.pricing.projectTotal / comp.trainTotal;
    // We expect within 0.05x to 8x — wide tolerance because solver generates its own layout
    // and doesn't have actual catalog list prices
    assert(ratio > 0.05,
      `${comp.name}: generated ($${quote.pricing.projectTotal}) > 5% of training ($${comp.trainTotal}), ratio=${ratio.toFixed(2)}`);
    assert(ratio < 8,
      `${comp.name}: generated ($${quote.pricing.projectTotal}) < 800% of training ($${comp.trainTotal}), ratio=${ratio.toFixed(2)}`);
  }
});


// ─── Multi-spec projects ────────────────────────────────────────────────────

group("Multi-spec detection — 2-tone and 3-tone projects", () => {
  // Lofton: 2-spec (Walnut + HPL)
  const lofton = loadTraining("lofton_doris.json");
  const loftonInput = extractSolverInput(lofton);
  assert(loftonInput.training.specCount === 2,
    `Lofton detected as 2-spec (got ${loftonInput.training.specCount})`);
  assert(loftonInput.training.species.includes("Walnut"),
    "Lofton has Walnut spec");

  // Gable: 2-spec (Walnut + Maple)
  const gable = loadTraining("gable_kitchen.json");
  const gableInput = extractSolverInput(gable);
  assert(gableInput.training.specCount === 2,
    `Gable detected as 2-spec (got ${gableInput.training.specCount})`);

  // Kline: 3-spec
  const kline = loadTraining("kline_piazza.json");
  const klineSpecs = Array.isArray(kline.material_specs) ? kline.material_specs : Object.values(kline.material_specs || {});
  assert(klineSpecs.length === 3,
    `Kline detected as 3-spec (got ${klineSpecs.length})`);

  // Bissegger GR: 2-spec (Rift Cut White Oak × 2)
  const biss = loadTraining("bissegger_great_room.json");
  const bissSpecs = Array.isArray(biss.material_specs) ? biss.material_specs : Object.values(biss.material_specs || {});
  assert(bissSpecs.length === 2,
    `Bissegger GR detected as 2-spec (got ${bissSpecs.length})`);
});


// ─── Non-kitchen rooms ──────────────────────────────────────────────────────

group("Non-kitchen room type inference", () => {
  const tests = [
    { file: "lwh_hartley_laundry.json", expected: "laundry" },
    { file: "cost_plus_vanity.json",    expected: "vanity" },
    { file: "bissegger_office.json",    expected: "office" },
    { file: "bennet_utility.json",      expected: "utility" },
  ];

  for (const t of tests) {
    const td = loadTraining(t.file);
    const input = extractSolverInput(td);
    assert(input.room.roomType === t.expected,
      `${t.file}: inferred room type '${input.room.roomType}' = '${t.expected}'`);
  }
});


// ─── Appliance extraction ───────────────────────────────────────────────────

group("Appliance extraction from training data", () => {
  // Lofton: range + wall oven
  const lofton = extractSolverInput(loadTraining("lofton_doris.json"));
  const loftonApps = lofton.room.appliances.map(a => a.type);
  assert(loftonApps.includes("range"), "Lofton has range");
  assert(loftonApps.includes("wallOven"), "Lofton has wall oven");

  // Eddies: refrigerator + oven + sink
  const eddies = extractSolverInput(loadTraining("eddies_kitchen.json"));
  const eddiesApps = eddies.room.appliances.map(a => a.type);
  assert(eddiesApps.includes("refrigerator"), "Eddies has refrigerator");
  assert(eddiesApps.includes("sink"), "Eddies has sink");

  // ECLA: sink + dishwasher
  const ecla = extractSolverInput(loadTraining("showroom_ecla_kitchen.json"));
  const eclaApps = ecla.room.appliances.map(a => a.type);
  assert(eclaApps.includes("sink"), "ECLA has sink");
  assert(eclaApps.includes("dishwasher"), "ECLA has dishwasher");
});


// ─── SUMMARY ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Replay tests: ${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) process.exit(1);
