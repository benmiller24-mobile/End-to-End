/**
 * Eclipse Engine — Revision Tracking Tests
 * Tests for diffLayouts, diffQuotes, and createRevision
 */

import {
  solve, diffLayouts, diffQuotes, createRevision, configureProject,
} from './src/index.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}


// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: diffLayouts — identical layouts → all unchanged
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffLayouts identical → all unchanged ═══");

const baseLayout = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B", position: "start" },
  ],
  prefs: { sophistication: "standard" },
});

const identicalLayout = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B", position: "start" },
  ],
  prefs: { sophistication: "standard" },
});

const diff1 = diffLayouts(baseLayout, identicalLayout);

assert(diff1.added.length === 0,
  `Identical layouts: no added (got ${diff1.added.length})`);
assert(diff1.removed.length === 0,
  `Identical layouts: no removed (got ${diff1.removed.length})`);
assert(diff1.modified.length === 0,
  `Identical layouts: no modified (got ${diff1.modified.length})`);
assert(diff1.unchanged.length > 0,
  `Identical layouts: items unchanged (got ${diff1.unchanged.length})`);
assert(diff1.summary.netCabinetChange === 0,
  `Identical layouts: netCabinetChange = 0 (got ${diff1.summary.netCabinetChange})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: diffLayouts — adding appliance creates new placements
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffLayouts adding appliance ═══");

const layoutWithFridge = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B", position: "start" },
    { type: "refrigerator", width: 36, wall: "A", position: "end" },
  ],
  prefs: { sophistication: "standard" },
});

const diff2 = diffLayouts(baseLayout, layoutWithFridge);

assert(diff2.added.length > 0,
  `Adding fridge: added > 0 (got ${diff2.added.length})`);
assert(diff2.summary.netCabinetChange > 0,
  `Adding fridge: netCabinetChange > 0 (got ${diff2.summary.netCabinetChange})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: diffLayouts — removing appliance shows removed placements
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffLayouts removing appliance ═══");

const layoutMinimal = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
  ],
  prefs: { sophistication: "standard" },
});

const diff3 = diffLayouts(baseLayout, layoutMinimal);

assert(diff3.removed.length > 0,
  `Removing appliance: removed > 0 (got ${diff3.removed.length})`);
// Note: netCabinetChange may be 0 or negative depending on wall layout reallocation
assert(diff3.summary.netCabinetChange <= 0,
  `Removing appliance: netCabinetChange <= 0 (got ${diff3.summary.netCabinetChange})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: diffLayouts — changing sophistication modifies placements
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffLayouts changing sophistication ═══");

const layoutHighSoph = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B", position: "start" },
  ],
  prefs: { sophistication: "high" },
});

const diff4 = diffLayouts(baseLayout, layoutHighSoph);

assert(diff4.modified.length > 0 || diff4.added.length > 0,
  `Changing sophistication: modifications > 0 (mod=${diff4.modified.length}, add=${diff4.added.length})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: diffLayouts — summary counts are correct
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffLayouts summary counts ═══");

const diff5 = diffLayouts(baseLayout, layoutWithFridge);

assert(diff5.summary.totalAdded === diff5.added.length,
  `Summary.totalAdded matches (expected ${diff5.added.length}, got ${diff5.summary.totalAdded})`);
assert(diff5.summary.totalRemoved === diff5.removed.length,
  `Summary.totalRemoved matches (expected ${diff5.removed.length}, got ${diff5.summary.totalRemoved})`);
assert(diff5.summary.totalModified === diff5.modified.length,
  `Summary.totalModified matches (expected ${diff5.modified.length}, got ${diff5.summary.totalModified})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: diffQuotes — price delta calculated correctly
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffQuotes price delta ═══");

const quote1 = configureProject({
  room: {
    layoutType: "l-shape",
    roomType: "kitchen",
    walls: [
      { id: "A", length: 156, role: "range" },
      { id: "B", length: 120, role: "sink" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A", position: "center" },
      { type: "sink", width: 36, wall: "B", position: "start" },
    ],
    prefs: { sophistication: "standard" },
  },
  materials: { species: "Maple", construction: "Standard" },
});

const quote2 = configureProject({
  room: {
    layoutType: "l-shape",
    roomType: "kitchen",
    walls: [
      { id: "A", length: 156, role: "range" },
      { id: "B", length: 120, role: "sink" },
    ],
    appliances: [
      { type: "range", width: 30, wall: "A", position: "center" },
      { type: "sink", width: 36, wall: "B", position: "start" },
      { type: "refrigerator", width: 36, wall: "A", position: "end" },
    ],
    prefs: { sophistication: "standard" },
  },
  materials: { species: "Maple", construction: "Standard" },
});

const diff6 = diffQuotes(quote1, quote2);

assert(typeof diff6.priceDiff.delta === "number",
  `Price delta is a number (got ${typeof diff6.priceDiff.delta})`);
assert(diff6.priceDiff.delta === (diff6.priceDiff.revisedTotal - diff6.priceDiff.originalTotal),
  `Delta = revised - original (expected ${diff6.priceDiff.revisedTotal - diff6.priceDiff.originalTotal}, got ${diff6.priceDiff.delta})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: diffQuotes — changeOrder description auto-generated
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffQuotes changeOrder description ═══");

const diff7 = diffQuotes(quote1, quote2);

assert(typeof diff7.changeOrder.description === "string",
  `changeOrder.description is string (got ${typeof diff7.changeOrder.description})`);
assert(diff7.changeOrder.description.length > 0,
  `changeOrder.description is not empty (length=${diff7.changeOrder.description.length})`);
assert(Array.isArray(diff7.changeOrder.items),
  `changeOrder.items is array (got ${typeof diff7.changeOrder.items})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: diffQuotes — deltaPercent calculation correct
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: diffQuotes deltaPercent ═══");

const diff8 = diffQuotes(quote1, quote2);

const expectedPercent = diff8.priceDiff.originalTotal > 0
  ? (diff8.priceDiff.delta / diff8.priceDiff.originalTotal) * 100
  : 0;

assert(Math.abs(diff8.priceDiff.deltaPercent - Math.round(expectedPercent * 100) / 100) < 0.01,
  `deltaPercent calculated correctly (expected ~${Math.round(expectedPercent * 100) / 100}, got ${diff8.priceDiff.deltaPercent})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: createRevision — returns original, revised, and diff
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: createRevision structure ═══");

const revision = createRevision(quote1, {
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B", position: "start" },
    { type: "refrigerator", width: 36, wall: "A", position: "end" },
  ],
}, configureProject);

assert(revision.original !== undefined,
  "revision.original exists");
assert(revision.revised !== undefined,
  "revision.revised exists");
assert(revision.diff !== undefined,
  "revision.diff exists");
assert(typeof revision.revision === "number",
  `revision.revision is number (got ${typeof revision.revision})`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: createRevision — diff shows actual changes made
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ Revisions: createRevision diff accuracy ═══");

assert(revision.diff.layoutDiff !== undefined,
  "diff.layoutDiff exists");
assert(revision.diff.priceDiff !== undefined,
  "diff.priceDiff exists");
assert(revision.diff.changeOrder !== undefined,
  "diff.changeOrder exists");
assert(revision.diff.layoutDiff.added.length > 0,
  `diff shows added items (got ${revision.diff.layoutDiff.added.length})`);

// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Revision tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
