/**
 * Eclipse Engine — Solver Tests
 * Exercises the constraint engine against real training project dimensions.
 */

import { solve, fillSegment, validateLayout, LANDING, DIMS } from './src/index.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

// ─── TEST 1: fillSegment — stock width bin-packing ────────────────────────

console.log("\n═══ fillSegment tests ═══");

const fill96 = fillSegment(96);
assert(fill96.cabinets.reduce((s, w) => s + w, 0) + fill96.filler === 96, "96\" fills exactly to 96\"");
assert(fill96.filler <= 6, `96\" filler ${fill96.filler}" ≤ 6" (was ${fill96.filler})`);

const fill127 = fillSegment(127);
assert(fill127.cabinets.reduce((s, w) => s + w, 0) + fill127.filler === 127, "127\" fills exactly");

const fill54 = fillSegment(54, undefined, { preferSymmetric: true });
assert(fill54.cabinets.length >= 2, `54\" symmetric fill has ≥2 cabs (got ${fill54.cabinets.length})`);

const fill18 = fillSegment(18);
assert(fill18.cabinets.length === 1 && fill18.cabinets[0] === 18, "18\" fills with single 18\" cab");

const fill3 = fillSegment(3);
assert(fill3.cabinets.length === 0 && fill3.filler === 3, "3\" too small for cabinet, returns as filler");

// Width modification test
const fill40 = fillSegment(40);
assert(
  fill40.filler === 0 || fill40.modified,
  `40\" fills via modification or exact fill (filler=${fill40.filler}, modified=${JSON.stringify(fill40.modified)})`
);


// ─── TEST 2: solve — Lofton-like L-shape ──────────────────────────────────

console.log("\n═══ Solver: Lofton L-shape ═══");

const loftonResult = solve({
  layoutType: "l-shape",
  walls: [
    { id: "A", length: 96, role: "general" },
    { id: "B", length: 115, role: "sink" },
  ],
  appliances: [
    { type: "sink", width: 36, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
  ],
  prefs: { cornerTreatment: "lazySusan", preferDrawerBases: true, sophistication: "high" },
});

assert(loftonResult.layoutType === "l-shape", "Layout type is L-shape");
assert(loftonResult.corners.length === 1, "Has 1 corner");
assert(loftonResult.corners[0].type === "lazySusan", "Corner is lazy susan (both walls ≥36\")");
assert(loftonResult.walls.length === 2, "Has 2 wall layouts");
assert(loftonResult.validation !== undefined, "Has validation results");
assert(loftonResult.metadata.totalCabinets > 0, `Has ${loftonResult.metadata.totalCabinets} cabinets`);

// Check drawer base preference
const baseCabs = loftonResult.placements.filter(p => p.type === "base" && p.sku);
const drawerBases = baseCabs.filter(p => p.sku.includes("B3D") || p.sku.includes("B4D"));
assert(drawerBases.length > 0, `Has drawer bases (${drawerBases.length} of ${baseCabs.length})`);


// ─── TEST 3: solve — Gable-like U-shape ───────────────────────────────────

console.log("\n═══ Solver: Gable U-shape ═══");

const gableResult = solve({
  layoutType: "u-shape",
  walls: [
    { id: "A", length: 99, role: "range" },
    { id: "B", length: 252, role: "sink" },
    { id: "C", length: 89, role: "pantry" },
  ],
  appliances: [
    { type: "range", width: 36, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
    { type: "refrigerator", width: 36, wall: "B", position: "end" },
  ],
  prefs: { cornerTreatment: "auto", preferSymmetry: true, sophistication: "very_high" },
});

assert(gableResult.corners.length === 2, "U-shape has 2 corners");
assert(gableResult.walls.length === 3, "Has 3 wall layouts");
const rangeWall = gableResult.walls.find(w => w.role === "range");
assert(rangeWall !== undefined, "Identified range wall");


// ─── TEST 4: solve — Kline Piazza-like single wall + island ───────────────

console.log("\n═══ Solver: Kline Piazza single wall + island ═══");

const klineResult = solve({
  layoutType: "single-wall",
  walls: [
    { id: "A", length: 277, role: "sink", openings: [{ type: "window", posFromLeft: 80, width: 40 }] },
  ],
  island: { length: 129, depth: 30, endTreatment: "waterfall" },
  appliances: [
    { type: "sink", width: 36, wall: "A" },
    { type: "dishwasher", width: 24, wall: "A" },
    { type: "range", width: 48, wall: "island" },
    { type: "refrigerator", width: 36, wall: "A", position: "end" },
  ],
  prefs: {
    sophistication: "very_high",
    islandBackStyle: "fhd_seating",
    preferDrawerBases: true,
  },
});

assert(klineResult.corners.length === 0, "Single wall has no corners");
assert(klineResult.island !== null, "Has island layout");
assert(klineResult.island.hasRange === true, "Island has range");
assert(klineResult.island.pattern === "range_island", "Island pattern is range_island");
assert(klineResult.island.backSide.length > 0, "Island has back side (seating FHDs)");
assert(klineResult.island.endPanels.length === 2, "Island has 2 end panels");

// Check FHD seating with 13" depth
const seatingSide = klineResult.island.backSide;
const hasFHD = seatingSide.some(c => c.sku && c.sku.includes("FHD"));
assert(hasFHD, "Island back has FHD cabinets");
const has13Depth = seatingSide.some(c => c.depth === 13.875);
assert(has13Depth, "Island back has 13.875\" depth (13\" body + 7/8\" door)");

// Check EDGTL waterfall ends
const edgtlPanels = klineResult.island.endPanels.filter(p => p.sku && p.sku.includes("EDGTL"));
assert(edgtlPanels.length === 2, "Island has 2 EDGTL waterfall end panels");


// ─── TEST 5: solve — DeLawyer-like minimal uppers ─────────────────────────

console.log("\n═══ Solver: DeLawyer minimal uppers ═══");

const delResult = solve({
  layoutType: "l-shape",
  walls: [
    { id: "A", length: 120, role: "fridge" },
    { id: "B", length: 113, role: "range" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "B" },
    { type: "refrigerator", width: 30, wall: "A", position: "end" },
    { type: "sink", width: 33, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
  ],
  prefs: { cornerTreatment: "auto", upperApproach: "none", preferDrawerBases: true },
});

const uppers = delResult.uppers.flatMap(u => u.cabinets);
assert(uppers.length === 0, "No upper cabinets when upperApproach=none");


// ─── TEST 6: validateLayout ───────────────────────────────────────────────

console.log("\n═══ Validation tests ═══");

const badLayout = {
  appliances: [
    { type: "range", wall: "A", leftClearance: 10, rightClearance: 20 },
    { type: "sink", wall: "B", leftClearance: 12, rightClearance: 30 },
    { type: "dishwasher", wall: "C", adjacentToSink: false },
  ],
  trianglePerimeter: 340,
};

const issues = validateLayout(badLayout);
assert(issues.some(i => i.rule === "NKBA-Landing-Range"), "Catches range landing < 15\" (10\")");
assert(issues.some(i => i.rule === "NKBA-Landing-Sink"), "Catches sink secondary landing < 18\" (12\")");
assert(issues.some(i => i.rule === "NKBA-DW-Sink"), "Catches DW not adjacent to sink");
assert(issues.some(i => i.rule === "NKBA-Triangle-Max"), "Catches triangle > 312\" (340\")");


// ─── SUMMARY ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
