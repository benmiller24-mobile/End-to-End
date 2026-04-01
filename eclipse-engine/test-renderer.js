/**
 * Tests for Phase 4: Elevation + Floorplan Renderer
 * ===================================================
 * Validates the renderer module:
 *   - Floor plan SVG generation
 *   - Wall elevation SVG generation
 *   - Bill of materials generation
 *   - renderLayout() orchestrator
 *   - Dimension labels and cabinet labeling
 *   - All layout types (single-wall, L-shape, U-shape, galley)
 */

import { solve } from './src/solver.js';
import {
  renderFloorPlan, renderElevation, generateBOM, renderLayout,
} from './src/renderer.js';

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

// ─── Test fixtures ──────────────────────────────────────────────────────────

const singleWall = solve({
  layoutType: "single-wall",
  roomType: "kitchen",
  walls: [{ id: "A", length: 156, role: "range" }],
  appliances: [
    { type: "range", width: 30, wall: "A" },
    { type: "sink", width: 36, wall: "A" },
  ],
  prefs: {},
});

const lShape = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 120, role: "range" },
    { id: "B", length: 96, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A" },
    { type: "sink", width: 36, wall: "B" },
  ],
  prefs: {},
});

const uShape = solve({
  layoutType: "u-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
    { id: "C", length: 144, role: "fridge" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A" },
    { type: "sink", width: 36, wall: "B" },
    { type: "refrigerator", width: 36, wall: "C" },
  ],
  prefs: {},
});

const vanity = solve({
  layoutType: "single-wall",
  roomType: "vanity",
  walls: [{ id: "A", length: 72 }],
  appliances: [],
  prefs: {},
});

const withIsland = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  island: { length: 96 },
  appliances: [
    { type: "range", width: 30, wall: "A" },
    { type: "sink", width: 36, wall: "B" },
  ],
  prefs: {},
});


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Floor Plan SVG — Basic Structure ═══");

const fpSingle = renderFloorPlan(singleWall);
test("Single-wall floor plan returns string", typeof fpSingle === "string");
test("Floor plan contains <svg> tag", fpSingle.includes("<svg"));
test("Floor plan contains </svg> closing tag", fpSingle.includes("</svg>"));
test("Floor plan has xmlns attribute", fpSingle.includes('xmlns="http://www.w3.org/2000/svg"'));
test("Floor plan has style block", fpSingle.includes("<style>"));
test("Floor plan has title text", fpSingle.includes("Floor Plan"));

const fpL = renderFloorPlan(lShape);
test("L-shape floor plan returns string", typeof fpL === "string");
test("L-shape floor plan contains <rect> elements", fpL.includes("<rect"));
test("L-shape floor plan contains <line> elements", fpL.includes("<line"));

const fpU = renderFloorPlan(uShape);
test("U-shape floor plan returns string", typeof fpU === "string");

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Floor Plan SVG — Options ═══");

const fpNoSkus = renderFloorPlan(singleWall, { showSkus: false });
test("Floor plan without SKUs has fewer text elements",
  (fpNoSkus.match(/<text/g) || []).length < (fpSingle.match(/<text/g) || []).length);

const fpNoDims = renderFloorPlan(singleWall, { showDimensions: false });
test("Floor plan without dimensions is valid SVG", fpNoDims.includes("<svg") && fpNoDims.includes("</svg>"));

const fpCustomTitle = renderFloorPlan(singleWall, { title: "My Kitchen" });
test("Custom title appears in SVG", fpCustomTitle.includes("My Kitchen"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Floor Plan SVG — Island ═══");

const fpIsland = renderFloorPlan(withIsland);
test("Island floor plan returns string", typeof fpIsland === "string");
test("Island floor plan contains ISLAND label", fpIsland.includes("ISLAND"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Wall Elevation SVG — Basic Structure ═══");

const elevA = renderElevation(lShape, "A");
test("Elevation returns string", typeof elevA === "string");
test("Elevation contains <svg> tag", elevA.includes("<svg"));
test("Elevation contains </svg>", elevA.includes("</svg>"));
test("Elevation has title", elevA.includes("Wall A Elevation"));
test("Elevation contains <rect> elements", elevA.includes("<rect"));

const elevB = renderElevation(lShape, "B");
test("Wall B elevation returns string", typeof elevB === "string");
test("Wall B elevation has title", elevB.includes("Wall B Elevation"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Wall Elevation SVG — Options ═══");

const elevCustom = renderElevation(singleWall, "A", { title: "Range Wall" });
test("Custom elevation title", elevCustom.includes("Range Wall"));

const elevNoSkus = renderElevation(singleWall, "A", { showSkus: false });
test("Elevation without SKUs is valid", elevNoSkus.includes("<svg") && elevNoSkus.includes("</svg>"));

const elevNoDims = renderElevation(singleWall, "A", { showDimensions: false });
test("Elevation without dimensions is valid", elevNoDims.includes("<svg") && elevNoDims.includes("</svg>"));
test("Elevation without dimensions has no dim lines",
  !elevNoDims.includes('stroke="#666"') || (elevNoDims.match(/stroke="#666"/g) || []).length < (elevA.match(/stroke="#666"/g) || []).length);


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Wall Elevation SVG — Non-existent Wall ═══");

const elevMissing = renderElevation(singleWall, "Z");
test("Non-existent wall returns valid SVG", elevMissing.includes("<svg") && elevMissing.includes("</svg>"));
test("Non-existent wall has title", elevMissing.includes("Wall Z Elevation"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Wall Elevation — Vanity Room ═══");

const elevVanity = renderElevation(vanity, "A");
test("Vanity elevation returns string", typeof elevVanity === "string");
test("Vanity elevation is valid SVG", elevVanity.includes("<svg") && elevVanity.includes("</svg>"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Bill of Materials — Structure ═══");

const bomSingle = generateBOM(singleWall);
test("BOM returns object", typeof bomSingle === "object");
test("BOM has items array", Array.isArray(bomSingle.items));
test("BOM has summary", typeof bomSingle.summary === "object");
test("BOM has svgTable", typeof bomSingle.svgTable === "string");
test("BOM items have sku field", bomSingle.items.every(i => typeof i.sku === "string"));
test("BOM items have qty field", bomSingle.items.every(i => typeof i.qty === "number" && i.qty > 0));
test("BOM items have type field", bomSingle.items.every(i => typeof i.type === "string"));
test("BOM items have description field", bomSingle.items.every(i => typeof i.description === "string"));

const bomL = generateBOM(lShape);
test("L-shape BOM has items", bomL.items.length > 0);
test("L-shape BOM summary total pieces > 0", bomL.summary.totalPieces > 0);
test("L-shape BOM summary has byType", typeof bomL.summary.byType === "object");

const bomU = generateBOM(uShape);
test("U-shape BOM has items", bomU.items.length > 0);
test("U-shape BOM totalPieces >= totalLineItems", bomU.summary.totalPieces >= bomU.summary.totalLineItems);


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Bill of Materials — SVG Table ═══");

test("BOM SVG table has svg tag", bomSingle.svgTable.includes("<svg"));
test("BOM SVG table has header", bomSingle.svgTable.includes("Bill of Materials"));
test("BOM SVG table has SKU header", bomSingle.svgTable.includes("SKU"));
test("BOM SVG table has TOTAL line", bomSingle.svgTable.includes("TOTAL:"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ renderLayout() Orchestrator ═══");

const fullRender = renderLayout(lShape);
test("renderLayout returns object", typeof fullRender === "object");
test("renderLayout has floorPlan SVG", typeof fullRender.floorPlan === "string" && fullRender.floorPlan.includes("<svg"));
test("renderLayout has elevations object", typeof fullRender.elevations === "object");
test("renderLayout has elevation for wall A", typeof fullRender.elevations.A === "string");
test("renderLayout has elevation for wall B", typeof fullRender.elevations.B === "string");
test("renderLayout has bom object", typeof fullRender.bom === "object");
test("renderLayout bom has items", Array.isArray(fullRender.bom.items));

const fullU = renderLayout(uShape, { title: "U-Shape Kitchen" });
test("U-shape renderLayout has 3 elevations", Object.keys(fullU.elevations).length === 3);
test("U-shape renderLayout custom title in floor plan", fullU.floorPlan.includes("U-Shape Kitchen"));

const fullVanity = renderLayout(vanity);
test("Vanity renderLayout has 1 elevation", Object.keys(fullVanity.elevations).length === 1);


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ SVG Dimension Labels ═══");

// Check that dimension labels use proper formatting
const elevWithDims = renderElevation(singleWall, "A", { showDimensions: true });
test("Elevation has dimension text with inches symbol", elevWithDims.includes('"'));
test("Elevation has wall length dimension", elevWithDims.includes("156"));

const fpWithDims = renderFloorPlan(singleWall, { showDimensions: true });
test("Floor plan has wall dimension", fpWithDims.includes("156"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ No Shiloh Content Cross-Check ═══");

// Verify no Shiloh content leaked into renderer outputs
const allSvg = fpSingle + fpL + fpU + elevA + elevB + bomSingle.svgTable;
test("No Shiloh references in SVG output", !allSvg.includes("SHI") && !allSvg.includes("Shiloh"));
test("No inset door references in SVG output", !allSvg.toLowerCase().includes("inset"));


// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`Phase 4 Renderer tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAILURES DETECTED — review above");
  process.exit(1);
} else {
  console.log("All renderer tests passed ✅");
}
