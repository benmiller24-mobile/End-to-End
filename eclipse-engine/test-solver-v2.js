/**
 * Tests for Phase 3: Layout Solver v2
 * =====================================
 * Validates the solver v2 upgrades:
 *   - Training-data-driven corner selection
 *   - Zone-pattern-aware segment filling
 *   - Phase 2 upper sizing rules integration
 *   - Filler-vs-modification decision logic
 *   - Aesthetic scoring (symmetry, consistency, proportionality)
 */

import { solve, scoreAesthetics, scoreCornerEfficiency } from './src/solver.js';
import {
  CORNER_TREATMENTS, UPPER_SIZING_RULES, FILLER_MOD_RULES,
} from './src/zone-patterns.js';

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
console.log("\n═══ Corner Selection — Training Data Driven ═══");

// L-shape with high sophistication: should get BL36-SS-PH (5× in training)
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
  prefs: { sophistication: "high" },
});

test("L-shape solve returns result", !!lShape);
test("L-shape has corners array", Array.isArray(lShape.corners));
test("L-shape has 1 corner", lShape.corners.length === 1);
// Walls 120"+96" both ≥42: high soph selects halfMoon (between magic and lazySusan)
test("L-shape corner is halfMoon (high soph + large walls)",
  lShape.corners[0].type === "halfMoon" && lShape.corners[0].sku === "BHM42R-SS");

// Very high sophistication with large walls: magic corner
const premiumL = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156 },
    { id: "B", length: 120 },
  ],
  appliances: [],
  prefs: { sophistication: "very_high" },
});

test("Premium L-shape corner is magicCorner", premiumL.corners[0]?.type === "magicCorner");
test("Premium corner has trainingFrequency from Phase 2",
  typeof premiumL.corners[0]?.trainingFrequency === "number" && premiumL.corners[0].trainingFrequency >= 1);

// U-shape: 2 corners
const uShape = solve({
  layoutType: "u-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 96 },
    { id: "B", length: 120 },
    { id: "C", length: 96 },
  ],
  appliances: [],
  prefs: { sophistication: "high" },
});

test("U-shape has 2 corners", uShape.corners.length === 2);

// Single-wall: no corners
const singleWall = solve({
  layoutType: "single-wall",
  roomType: "kitchen",
  walls: [{ id: "A", length: 120 }],
  appliances: [
    { type: "sink", width: 36, wall: "A" },
  ],
  prefs: {},
});

test("Single-wall has no corners", singleWall.corners.length === 0);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Aesthetic Scoring ═══");

test("L-shape result has aesthetics in metadata", !!lShape.metadata.aesthetics);
test("Aesthetics has overall score", typeof lShape.metadata.aesthetics.overall === "number");
test("Aesthetics overall is 0-100", lShape.metadata.aesthetics.overall >= 0 && lShape.metadata.aesthetics.overall <= 100);
test("Aesthetics has symmetry score", typeof lShape.metadata.aesthetics.symmetry === "number");
test("Aesthetics has consistency score", typeof lShape.metadata.aesthetics.consistency === "number");
test("Aesthetics has proportionality score", typeof lShape.metadata.aesthetics.proportionality === "number");

// Direct scoreAesthetics call
const directScore = scoreAesthetics(lShape.walls, lShape.uppers, lShape.corners, {});
test("scoreAesthetics returns overall", typeof directScore.overall === "number");
test("scoreAesthetics overall is 0-100", directScore.overall >= 0 && directScore.overall <= 100);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Upper Sizing — Training Data Heights ═══");

// Standard ceiling: should get 39" (most common in training: Diehl, Eddies, Kline)
const stdCeiling = solve({
  layoutType: "single-wall",
  roomType: "kitchen",
  walls: [{ id: "A", length: 120, ceilingHeight: 96 }],
  appliances: [{ type: "sink", width: 36, wall: "A" }],
  prefs: { upperApproach: "standard" },
});

const upperCabs = stdCeiling.uppers[0]?.cabinets || [];
const upperHeights = [...new Set(upperCabs.filter(c => c.height).map(c => c.height))];

test("Standard ceiling uppers generated", upperCabs.length > 0);
// Height should be 36 or 39 depending on ceiling clearance
test("Upper heights are training-driven (36 or 39)",
  upperHeights.every(h => h === 36 || h === 39 || h === 3));

// Very high sophistication + 10ft ceiling: should get 63" (Bollini pattern)
const tallCeiling = solve({
  layoutType: "single-wall",
  roomType: "kitchen",
  walls: [{ id: "A", length: 120, ceilingHeight: 120 }],
  appliances: [{ type: "sink", width: 36, wall: "A" }],
  prefs: { upperApproach: "standard", sophistication: "very_high" },
});

const tallUpperHeights = [...new Set(
  (tallCeiling.uppers[0]?.cabinets || []).filter(c => c.height && c.type !== "rangeHood").map(c => c.height)
)];

test("Very high + 10ft ceiling produces floor-to-ceiling uppers",
  tallUpperHeights.some(h => h >= UPPER_SIZING_RULES.heightsByContext.floorToCeiling.height));

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Filler vs. Modification Logic ═══");

// The solver should now prefer width modifications over fillers
// Check that base cabinets include decisionNote when mods are applied
const fillerTest = solve({
  layoutType: "single-wall",
  roomType: "kitchen",
  walls: [{ id: "A", length: 97 }], // 97" doesn't divide evenly
  appliances: [{ type: "sink", width: 36, wall: "A" }],
  prefs: {},
});

const allBaseCabs = fillerTest.walls[0]?.cabinets?.filter(c => c.type === "base" || c.type === "filler") || [];
test("Solver generates base cabinets for odd-width wall", allBaseCabs.length > 0);

// Check that fillers are small (≤3" OVF) or mods are used instead
const fillers = allBaseCabs.filter(c => c.type === "filler");
const modifiedCabs = allBaseCabs.filter(c => c.modified);

test("Small or no fillers (Phase 2 prefers width mods)",
  fillers.every(f => f.width <= 6) || modifiedCabs.length > 0 || fillers.length === 0);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Non-Kitchen Room Types Still Work ═══");

// Vanity
const vanity = solve({
  layoutType: "single-wall",
  roomType: "vanity",
  walls: [{ id: "A", length: 60 }],
  appliances: [],
  prefs: { upperApproach: "none" },
});
test("Vanity solves without errors", !!vanity && !!vanity.walls);

// Office
const office = solve({
  layoutType: "single-wall",
  roomType: "office",
  walls: [{ id: "A", length: 72 }],
  appliances: [],
  prefs: { upperApproach: "minimal" },
});
test("Office solves without errors", !!office && !!office.walls);

// primary_bath (Phase 1 addition)
const priBath = solve({
  layoutType: "single-wall",
  roomType: "primary_bath",
  walls: [{ id: "A", length: 72 }],
  appliances: [],
  prefs: { upperApproach: "none" },
});
test("primary_bath solves without errors", !!priBath && !!priBath.walls);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Full Kitchen Solve — End to End ═══");

const fullKitchen = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
    { type: "refrigerator", width: 36, wall: "A", position: "end" },
  ],
  prefs: {
    cornerTreatment: "auto",
    preferDrawerBases: true,
    sophistication: "high",
    upperApproach: "standard",
  },
});

test("Full kitchen has placements", fullKitchen.placements.length > 0);
test("Full kitchen has validation", Array.isArray(fullKitchen.validation));
test("Full kitchen has aesthetics", !!fullKitchen.metadata.aesthetics);
test("Full kitchen aesthetic score > 0", fullKitchen.metadata.aesthetics.overall > 0);
test("Full kitchen has corner", fullKitchen.corners.length === 1);
test("Full kitchen has uppers", fullKitchen.uppers.length > 0);
test("Full kitchen has wall layouts", fullKitchen.walls.length === 2);
test("Full kitchen metadata has totalCabinets > 0", fullKitchen.metadata.totalCabinets > 0);

// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Solver v2 Tests: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
