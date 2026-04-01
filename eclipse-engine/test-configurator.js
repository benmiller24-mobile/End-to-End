/**
 * Eclipse Engine — Configurator Tests
 * =====================================
 * End-to-end tests for the project configurator pipeline:
 *   room input → solver → pricing → complete quote
 */

import {
  configureProject, quickConfigure, configureMultiRoom,
  parseSku, lookupListPrice, CATALOG_PRICES,
} from './src/index.js';

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

// ─── 1. parseSku ────────────────────────────────────────────────────────────

group("parseSku — base cabinets", () => {
  const b24 = parseSku("B24");
  assert(b24.family === "base", "B24 family is base");
  assert(b24.width === 24, "B24 width is 24");
  assert(b24.numDoors === 1, "B24 has 1 door (< 27)");
  assert(!b24.isGola, "B24 is not GOLA");

  const b36 = parseSku("B36");
  assert(b36.numDoors === 2, "B36 has 2 doors (>= 27)");
});

group("parseSku — drawer bases", () => {
  const b3d = parseSku("B3D18");
  assert(b3d.family === "drawerBase", "B3D18 family is drawerBase");
  assert(b3d.numDrawers === 3, "B3D18 has 3 drawers");
  assert(b3d.width === 18, "B3D18 width is 18");

  const b4d = parseSku("B4D24");
  assert(b4d.family === "drawerBase", "B4D24 family is drawerBase");
  assert(b4d.numDrawers === 4, "B4D24 has 4 drawers");
});

group("parseSku — heavy-duty drawer", () => {
  const hd = parseSku("B2HD36");
  assert(hd.family === "heavyDrawer", "B2HD36 family is heavyDrawer");
  assert(hd.numDrawers === 2, "B2HD36 has 2 drawers");
});

group("parseSku — corner cabinets", () => {
  const bl = parseSku("BL36");
  assert(bl.family === "lazySusan", "BL36 family is lazySusan");

  const mc = parseSku("BBC48R-MC");
  assert(mc.family === "magicCorner", "BBC48R-MC family is magicCorner");

  const qt = parseSku("BBC42R-S");
  assert(qt.family === "quarterTurn", "BBC42R-S family is quarterTurn");

  const blind = parseSku("BBC45R");
  assert(blind.family === "blindCorner", "BBC45R family is blindCorner");
});

group("parseSku — GOLA prefix", () => {
  const gola = parseSku("FC-B3D24");
  assert(gola.family === "drawerBase", "FC-B3D24 family is drawerBase");
  assert(gola.isGola === true, "FC-B3D24 is GOLA");
  assert(gola.width === 24, "FC-B3D24 width is 24");
});

group("parseSku — wall cabinets", () => {
  const w30 = parseSku("W3036");
  assert(w30.family === "wall", "W3036 family is wall");
  assert(w30.width === 30, `W3036 width is 30 (got ${w30.width})`);

  const rh = parseSku("RH21");
  assert(rh.family === "rangeHood", "RH21 family is rangeHood");
});

group("parseSku — sink and specialty", () => {
  const sb = parseSku("SB36");
  assert(sb.family === "sinkBase", "SB36 family is sinkBase");

  const sba = parseSku("SBA36");
  assert(sba.family === "sinkBase", "SBA36 family is sinkBase");

  const bpos = parseSku("BPOS-12");
  assert(bpos.family === "specialty", "BPOS-12 family is specialty");

  const bwdma = parseSku("BWDMA18");
  assert(bwdma.family === "waste", "BWDMA18 family is waste");
});

group("parseSku — tall cabinets", () => {
  const ntk = parseSku("NTK2496");
  assert(ntk.family === "tallPantry", "NTK2496 family is tallPantry");

  const fio = parseSku("FIO27");
  assert(fio.family === "tall", "FIO27 family is tall");
});

group("parseSku — vanity cabinets", () => {
  const flvsb = parseSku("FLVSB4221");
  assert(flvsb.family === "vanity", "FLVSB4221 family is vanity");

  const uv = parseSku("UV1896L");
  assert(uv.family === "vanityTall", "UV1896L family is vanityTall");
});

group("parseSku — office cabinets", () => {
  const fd = parseSku("FD2HD21");
  assert(fd.family === "fileCabinet", "FD2HD21 family is fileCabinet");

  const ld = parseSku("LD36");
  assert(ld.family === "lapDrawer", "LD36 family is lapDrawer");
});

group("parseSku — accessories/non-cabinet", () => {
  const filler = parseSku("F3340");
  assert(filler.family === "filler", "F3340 family is filler");

  const ep = parseSku("FBEP 3/4-FTK");
  assert(ep.family === "endPanel", "FBEP family is endPanel");

  const tk = parseSku("TK-N/C");
  assert(tk.family === "accessory", "TK-N/C family is accessory");
});

// ─── 2. lookupListPrice ─────────────────────────────────────────────────────

group("lookupListPrice — exact match", () => {
  const p = lookupListPrice(parseSku("B24"));
  assert(p === 440, `B24 list price is 440 (got ${p})`);

  const p2 = lookupListPrice(parseSku("SB36"));
  assert(p2 === 600, `SB36 list price is 600 (got ${p2})`);
});

group("lookupListPrice — interpolation", () => {
  // B20 is between 18 (330) and 21 (385) → interpolated
  const p = lookupListPrice(parseSku("B20"));
  assert(p > 330 && p < 385, `B20 interpolated between 330 and 385 (got ${p})`);
});

group("lookupListPrice — GOLA 10% upcharge", () => {
  // FC-B3D has width 3 from parsing, which will hit specialty or base price table
  // Let's test a known one: FC-SB36 → sinkBase 36 = 600 × 1.10 = 660
  const parsed = { family: "sinkBase", width: 36, isGola: true };
  const p = lookupListPrice(parsed);
  assert(p === 660, `GOLA SB36 list price is 660 (got ${p})`);
});

group("lookupListPrice — accessories return 0", () => {
  const p = lookupListPrice(parseSku("TK-N/C"));
  assert(p === 0, `Accessory TK-N/C returns 0 (got ${p})`);

  const p2 = lookupListPrice(parseSku("FBEP 3/4-FTK"));
  assert(p2 === 0, `End panel returns 0 (got ${p2})`);
});

group("lookupListPrice — magicCorner price", () => {
  const p = lookupListPrice(parseSku("BBC48R-MC"));
  assert(p === 3940, `BBC48R-MC list price is 3940 (got ${p})`);
});

// ─── 3. CATALOG_PRICES structure ────────────────────────────────────────────

group("CATALOG_PRICES data integrity", () => {
  assert(typeof CATALOG_PRICES.golaMultiplier === "number", "golaMultiplier is a number");
  assert(CATALOG_PRICES.golaMultiplier === 1.10, "golaMultiplier is 1.10");

  const families = ["base", "drawerBase", "sinkBase", "wall", "tall", "vanity"];
  for (const fam of families) {
    assert(typeof CATALOG_PRICES[fam] === "object", `CATALOG_PRICES.${fam} exists`);
    const widths = Object.keys(CATALOG_PRICES[fam]).map(Number);
    assert(widths.length >= 3, `CATALOG_PRICES.${fam} has ≥3 width entries`);
    // Prices should monotonically increase with width
    for (let i = 1; i < widths.length; i++) {
      assert(CATALOG_PRICES[fam][widths[i]] >= CATALOG_PRICES[fam][widths[i - 1]],
        `${fam} prices increase: ${widths[i - 1]}→${widths[i]}`);
    }
  }
});

// ─── 4. configureProject — L-shape kitchen ──────────────────────────────────

group("configureProject — L-shape Maple kitchen", () => {
  const quote = configureProject({
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
      species: "Maple",
      construction: "Standard",
      doorStyle: "Hanover FP",
    },
    options: {
      projectName: "Test L-Shape",
      clientName: "Test Client",
      includeEstimate: true,
    },
  });

  // Project header
  assert(quote.project.name === "Test L-Shape", "project name set");
  assert(quote.project.client === "Test Client", "client name set");
  assert(quote.project.roomType === "kitchen", "roomType is kitchen");
  assert(quote.project.layoutType === "l-shape", "layoutType is l-shape");
  assert(typeof quote.project.date === "string", "date is string");

  // Layout
  assert(quote.layout.totalCabinets > 0, `has cabinets (${quote.layout.totalCabinets})`);
  assert(quote.layout.cornerCount === 1, "L-shape has 1 corner");
  assert(quote.layout.walls.length === 2, "2 walls");
  assert(quote.layout.hasIsland === false, "no island");
  assert(quote.layout.hasPeninsula === false, "no peninsula");

  // Materials echo
  assert(quote.materials.species === "Maple", "materials echo species");
  assert(quote.materials.construction === "Standard", "materials echo construction");
  assert(quote.materials.specCount === 1, "single spec");

  // Pricing
  assert(typeof quote.pricing.projectTotal === "number", "projectTotal is number");
  assert(quote.pricing.projectTotal > 0, `projectTotal > 0 (${quote.pricing.projectTotal})`);
  assert(quote.pricing.specs.length === 1, "1 pricing spec");
  assert(quote.pricing.specs[0].itemCount > 0, "spec has items");

  // Estimate
  assert(quote.estimate !== null, "estimate included");
  assert(quote.estimate.midEstimate > 0, "estimate midEstimate > 0");

  // Raw data
  assert(quote._raw.solverOutput !== null, "raw solver output present");
  assert(quote._raw.pricingInput !== null, "raw pricing input present");
});

// ─── 5. configureProject — Walnut+Plywood premium ──────────────────────────

group("configureProject — Walnut+Plywood upcharges", () => {
  const basic = configureProject({
    room: {
      layoutType: "single-wall",
      walls: [{ id: "A", length: 120 }],
      appliances: [{ type: "sink", width: 33, wall: "A" }],
      prefs: {},
    },
    materials: { species: "Maple", construction: "Standard", doorStyle: "Hanover FP" },
  });

  const premium = configureProject({
    room: {
      layoutType: "single-wall",
      walls: [{ id: "A", length: 120 }],
      appliances: [{ type: "sink", width: 33, wall: "A" }],
      prefs: {},
    },
    materials: { species: "Walnut", construction: "Plywood", doorStyle: "Napa VG FP" },
  });

  // Same layout, but Walnut+Plywood should be more expensive
  assert(premium.pricing.projectTotal > basic.pricing.projectTotal,
    `Walnut+Plywood ($${premium.pricing.projectTotal}) > Maple+Std ($${basic.pricing.projectTotal})`);

  // Walnut = +25%, Plywood = +10%, combined ~37.5% more
  const ratio = premium.pricing.projectTotal / basic.pricing.projectTotal;
  assert(ratio > 1.2, `Premium ratio > 1.2 (got ${ratio.toFixed(2)})`);
});

// ─── 6. quickConfigure ──────────────────────────────────────────────────────

group("quickConfigure — minimal input", () => {
  const q = quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 96 }],
    appliances: [],
    species: "TFL",
  });

  assert(q.project.roomType === "kitchen", "defaults to kitchen");
  assert(q.materials.species === "TFL", "species is TFL");
  assert(q.estimate !== null, "estimate always included");
  assert(q.pricing.projectTotal > 0, "has a price");
});

group("quickConfigure — with sophistication", () => {
  const std = quickConfigure({
    layoutType: "l-shape",
    walls: [
      { id: "A", length: 144, role: "range" },
      { id: "B", length: 108, role: "sink" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
    ],
    sophistication: "very_high",
    species: "Walnut",
  });

  assert(std.layout.totalCabinets > 0, "generated cabinets");
  assert(std.pricing.projectTotal > 0, "priced");
});

// ─── 7. quickConfigure — non-kitchen rooms ──────────────────────────────────

group("quickConfigure — vanity room", () => {
  const q = quickConfigure({
    layoutType: "single-wall",
    roomType: "vanity",
    walls: [{ id: "A", length: 60 }],
    appliances: [],
  });

  assert(q.project.roomType === "vanity", "roomType is vanity");
  assert(q.layout.totalCabinets > 0, "vanity has cabinets");
});

group("quickConfigure — office room", () => {
  const q = quickConfigure({
    layoutType: "single-wall",
    roomType: "office",
    walls: [{ id: "A", length: 96 }],
    appliances: [],
  });

  assert(q.project.roomType === "office", "roomType is office");
});

group("quickConfigure — laundry room", () => {
  const q = quickConfigure({
    layoutType: "single-wall",
    roomType: "laundry",
    walls: [{ id: "A", length: 72 }],
    appliances: [],
  });

  assert(q.project.roomType === "laundry", "roomType is laundry");
});

// ─── 8. configureProject — U-shape kitchen ──────────────────────────────────

group("configureProject — U-shape kitchen", () => {
  const q = configureProject({
    room: {
      layoutType: "u-shape",
      walls: [
        { id: "A", length: 144, role: "range" },
        { id: "B", length: 96, role: "sink" },
        { id: "C", length: 132, role: "fridge" },
      ],
      appliances: [
        { type: "range", width: 30, wall: "A" },
        { type: "sink", width: 36, wall: "B" },
        { type: "dishwasher", width: 24, wall: "B" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
      ],
      prefs: { cornerTreatment: "auto", sophistication: "high" },
    },
    materials: { species: "White Oak", construction: "Plywood" },
  });

  assert(q.layout.cornerCount === 2, "U-shape has 2 corners");
  assert(q.layout.walls.length === 3, "3 walls");
  assert(q.pricing.projectTotal > 0, "priced");
});

// ─── 9. configureProject — with island ──────────────────────────────────────

group("configureProject — L-shape with island", () => {
  const q = configureProject({
    room: {
      layoutType: "l-shape",
      walls: [
        { id: "A", length: 168, role: "range" },
        { id: "B", length: 132, role: "sink" },
      ],
      island: { length: 84, depth: 24.875 },
      appliances: [
        { type: "range", width: 30, wall: "A" },
        { type: "sink", width: 36, wall: "B" },
        { type: "dishwasher", width: 24, wall: "B" },
      ],
      prefs: {},
    },
    materials: { species: "Maple", construction: "Standard" },
  });

  assert(q.layout.hasIsland === true, "has island");
  assert(q.layout.totalCabinets > 10, `island layout has many cabs (${q.layout.totalCabinets})`);
});

// ─── 10. configureMultiRoom ─────────────────────────────────────────────────

group("configureMultiRoom — kitchen + laundry", () => {
  const q = configureMultiRoom({
    rooms: [
      {
        name: "Kitchen",
        room: {
          layoutType: "l-shape",
          roomType: "kitchen",
          walls: [
            { id: "A", length: 144, role: "range" },
            { id: "B", length: 108, role: "sink" },
          ],
          appliances: [
            { type: "range", width: 30, wall: "A" },
            { type: "sink", width: 36, wall: "B" },
          ],
          prefs: {},
        },
      },
      {
        name: "Laundry",
        room: {
          layoutType: "single-wall",
          roomType: "laundry",
          walls: [{ id: "A", length: 72 }],
          appliances: [],
          prefs: {},
        },
      },
    ],
    materials: { species: "Maple", construction: "Standard" },
    options: { projectName: "Smith Residence" },
  });

  assert(q.project.name === "Smith Residence", "project name");
  assert(q.project.roomCount === 2, "2 rooms");
  assert(q.rooms.length === 2, "2 room quotes");
  assert(q.combined.totalCabinets > 0, "combined cab count");
  assert(q.combined.projectTotal > 0, "combined total");
  assert(q.combined.projectTotal ===
    Math.round((q.rooms[0].pricing.projectTotal + q.rooms[1].pricing.projectTotal) * 100) / 100,
    "combined total equals sum of room totals");
  assert(q.estimate !== null, "combined estimate");
});

// ─── 11. configureMultiRoom — per-room material override ────────────────────

group("configureMultiRoom — per-room material override", () => {
  const q = configureMultiRoom({
    rooms: [
      {
        name: "Kitchen",
        room: {
          layoutType: "single-wall",
          roomType: "kitchen",
          walls: [{ id: "A", length: 96 }],
          appliances: [],
          prefs: {},
        },
        materials: { species: "Walnut" }, // override
      },
      {
        name: "Utility",
        room: {
          layoutType: "single-wall",
          roomType: "utility",
          walls: [{ id: "A", length: 72 }],
          appliances: [],
          prefs: {},
        },
        // inherits base materials (Maple)
      },
    ],
    materials: { species: "Maple", construction: "Standard" },
  });

  assert(q.rooms[0].materials.species === "Walnut", "kitchen got Walnut override");
  assert(q.rooms[1].materials.species === "Maple", "utility kept Maple default");
});

// ─── 12. Error handling ─────────────────────────────────────────────────────

group("configureProject — error on missing room", () => {
  let threw = false;
  try {
    configureProject({ materials: { species: "Maple" } });
  } catch (e) {
    threw = true;
    assert(e.message.includes("room"), "error mentions room");
  }
  assert(threw, "throws on missing room");
});

group("configureMultiRoom — error on empty rooms", () => {
  let threw = false;
  try {
    configureMultiRoom({ rooms: [] });
  } catch (e) {
    threw = true;
  }
  assert(threw, "throws on empty rooms array");
});

// ─── 13. Pricing sanity checks ──────────────────────────────────────────────

group("Pricing sanity — project total in reasonable range", () => {
  // A simple L-shape Maple kitchen should be in $3K-$20K range
  const q = quickConfigure({
    layoutType: "l-shape",
    walls: [
      { id: "A", length: 144, role: "range" },
      { id: "B", length: 108, role: "sink" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
    ],
  });

  assert(q.pricing.projectTotal > 2000,
    `L-shape > $2K (got $${q.pricing.projectTotal})`);
  assert(q.pricing.projectTotal < 25000,
    `L-shape < $25K (got $${q.pricing.projectTotal})`);
});

group("Pricing sanity — Walnut Ultra tier in higher range", () => {
  const q = quickConfigure({
    layoutType: "u-shape",
    walls: [
      { id: "A", length: 168, role: "range" },
      { id: "B", length: 120, role: "sink" },
      { id: "C", length: 144, role: "fridge" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
      { type: "dishwasher", width: 24, wall: "B" },
      { type: "refrigerator", width: 36, wall: "C", position: "end" },
    ],
    species: "Walnut",
    construction: "Plywood",
    doorStyle: "Napa VG FP",
  });

  assert(q.pricing.projectTotal > 5000,
    `Walnut U-shape > $5K (got $${q.pricing.projectTotal})`);
});

// ─── 14. Line item traceability ─────────────────────────────────────────────

group("Line item traceability — SKUs and walls preserved", () => {
  const q = configureProject({
    room: {
      layoutType: "single-wall",
      walls: [{ id: "A", length: 96 }],
      appliances: [{ type: "sink", width: 33, wall: "A" }],
      prefs: { preferDrawerBases: true },
    },
    materials: { species: "Maple", construction: "Standard" },
  });

  const items = q.pricing.specs[0].pricedItems;
  assert(items.length > 0, "has priced items");

  for (const item of items) {
    assert(typeof item.sku === "string" && item.sku.length > 0, `item ${item.line} has sku`);
    assert(typeof item.listPrice === "number", `item ${item.line} has listPrice`);
    assert(typeof item.totalPrice === "number", `item ${item.line} has totalPrice`);
    assert(item.totalPrice >= item.listPrice * 0.5, `item ${item.line} total ≥ 50% of list`);
  }
});

// ─── 15. Spec subtotal adds up ──────────────────────────────────────────────

group("Spec subtotal consistency", () => {
  const q = quickConfigure({
    layoutType: "l-shape",
    walls: [
      { id: "A", length: 156 },
      { id: "B", length: 120 },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A" },
      { type: "sink", width: 36, wall: "B" },
    ],
  });

  const spec = q.pricing.specs[0];
  const sumOfItems = spec.pricedItems.reduce((s, i) => s + i.totalPrice, 0);
  const diff = Math.abs(spec.subtotal - sumOfItems);
  assert(diff < 0.02, `Spec subtotal ($${spec.subtotal}) ≈ sum of items ($${sumOfItems.toFixed(2)}), diff=$${diff.toFixed(2)}`);
});

group("Project total consistency", () => {
  const q = quickConfigure({
    layoutType: "single-wall",
    walls: [{ id: "A", length: 120 }],
    appliances: [],
  });

  const specSub = q.pricing.specSubtotal;
  const accTotal = q.pricing.accessoryTotal;
  const touchUp = q.pricing.touchUpCost;
  const total = q.pricing.projectTotal;
  const expected = specSub + accTotal + touchUp;
  const diff = Math.abs(total - expected);
  assert(diff < 0.02, `projectTotal ($${total}) = specSub ($${specSub}) + acc ($${accTotal}) + touch ($${touchUp}), diff=$${diff.toFixed(2)}`);
});

// ─── SUMMARY ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Configurator tests: ${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) process.exit(1);
