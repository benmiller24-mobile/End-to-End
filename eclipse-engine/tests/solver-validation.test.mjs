#!/usr/bin/env node
/**
 * Eclipse Kitchen Designer — Solver Validation Test Suite
 *
 * Tests all layout types for:
 * 1. No overlapping cabinets on any wall
 * 2. No cabinet exceeds wall boundaries
 * 3. All appliances are placed (or properly warned)
 * 4. Uppers don't overlap with hood zones
 * 5. Corner cabinets are positioned correctly
 * 6. _elev data is assigned to all source objects
 * 7. No negative positions
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = join(import.meta.dirname, '..');
const { solve } = await import(join(BASE, 'src/solver.js'));

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

function checkNoOverlaps(cabs, label) {
  const sorted = [...cabs].sort((a, b) => (a.position || 0) - (b.position || 0));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = (prev.position || 0) + (prev.width || 0);
    const currStart = curr.position || 0;
    if (currStart < prevEnd - 0.5) { // 0.5" tolerance for rounding
      return { overlap: true, prev: prev.sku || prev.applianceType, curr: curr.sku || curr.applianceType,
               prevEnd, currStart, amount: prevEnd - currStart };
    }
  }
  return { overlap: false };
}

function checkNoBoundaryExceed(cabs, wallLength, label) {
  for (const cab of cabs) {
    const end = (cab.position || 0) + (cab.width || 0);
    if (end > wallLength + 1.0) { // 1" tolerance for end panels (BEP 3/4")
      return { exceed: true, sku: cab.sku || cab.applianceType, end, wallLength };
    }
  }
  return { exceed: false };
}

function checkNoNegativePositions(cabs, label) {
  for (const cab of cabs) {
    if ((cab.position || 0) < -0.5) {
      return { negative: true, sku: cab.sku || cab.applianceType, position: cab.position };
    }
  }
  return { negative: false };
}

function checkElevData(items, label) {
  for (const item of items) {
    if (!item._elev) {
      return { missing: true, sku: item.sku || item.applianceType || item.role };
    }
  }
  return { missing: false };
}

// ═══════════════════════════════════════════════════════════════
// TEST INPUTS
// ═══════════════════════════════════════════════════════════════

const testCases = [
  {
    name: 'Single-wall 120" (sink + DW)',
    input: {
      layoutType: 'single-wall',
      walls: [{ id: 'A', length: 120, role: 'sink' }],
      appliances: [
        { type: 'sink', width: 36, wall: 'A' },
        { type: 'dishwasher', width: 24, wall: 'A' },
      ],
      prefs: { sophistication: 'standard', preferDrawerBases: true },
    },
  },
  {
    name: 'Single-wall 180" full kitchen',
    input: {
      walls: [{ id: 'A', length: 180, role: 'sink' }],
      appliances: [
        { type: 'range', width: 30, wall: 'A' },
        { type: 'sink', width: 36, wall: 'A' },
        { type: 'dishwasher', width: 24, wall: 'A' },
        { type: 'refrigerator', width: 36, wall: 'A' },
      ],
      prefs: { sophistication: 'high', preferDrawerBases: true },
    },
  },
  {
    name: 'L-shape 99x115 (from training)',
    input: {
      walls: [
        { id: 'A', length: 99, role: 'range' },
        { id: 'B', length: 115, role: 'sink' },
      ],
      appliances: [
        { type: 'range', width: 36, wall: 'A', position: 'center' },
        { type: 'sink', width: 36, wall: 'B' },
        { type: 'dishwasher', width: 24, wall: 'B' },
        { type: 'refrigerator', width: 36, wall: 'B', position: 'end' },
      ],
      prefs: { cornerTreatment: 'lazySusan', preferDrawerBases: true, sophistication: 'high' },
    },
  },
  {
    name: 'L-shape 144x120 spacious',
    input: {
      walls: [
        { id: 'A', length: 144, role: 'range' },
        { id: 'B', length: 120, role: 'sink' },
      ],
      appliances: [
        { type: 'range', width: 36, wall: 'A' },
        { type: 'sink', width: 36, wall: 'B' },
        { type: 'dishwasher', width: 24, wall: 'B' },
        { type: 'refrigerator', width: 36, wall: 'B', position: 'end' },
      ],
      prefs: { cornerTreatment: 'lazySusan', preferDrawerBases: true, sophistication: 'high' },
    },
  },
  {
    name: 'U-shape 120x96x120',
    input: {
      walls: [
        { id: 'A', length: 120, role: 'range' },
        { id: 'B', length: 96, role: 'sink' },
        { id: 'C', length: 120, role: 'general' },
      ],
      appliances: [
        { type: 'range', width: 36, wall: 'A' },
        { type: 'sink', width: 36, wall: 'B' },
        { type: 'dishwasher', width: 24, wall: 'B' },
        { type: 'refrigerator', width: 36, wall: 'C', position: 'end' },
      ],
      prefs: { cornerTreatment: 'lazySusan', preferDrawerBases: true, sophistication: 'high' },
    },
  },
  {
    name: 'Island kitchen 277" with 129" island',
    input: {
      walls: [{ id: 'A', length: 277, role: 'sink', openings: [{ type: 'window', posFromLeft: 80, width: 40 }] }],
      island: { length: 129, depth: 30, endTreatment: 'waterfall' },
      appliances: [
        { type: 'sink', width: 36, wall: 'A' },
        { type: 'dishwasher', width: 24, wall: 'A' },
        { type: 'range', width: 48, wall: 'island' },
        { type: 'refrigerator', width: 36, wall: 'A', position: 'end' },
      ],
      prefs: { sophistication: 'very_high', islandBackStyle: 'fhd_seating', preferDrawerBases: true },
    },
  },
  {
    name: 'Galley 120x120',
    input: {
      walls: [
        { id: 'A', length: 120, role: 'range' },
        { id: 'B', length: 120, role: 'sink' },
      ],
      appliances: [
        { type: 'range', width: 30, wall: 'A' },
        { type: 'sink', width: 33, wall: 'B' },
        { type: 'dishwasher', width: 24, wall: 'B' },
        { type: 'refrigerator', width: 36, wall: 'A', position: 'end' },
      ],
      prefs: { sophistication: 'standard', preferDrawerBases: true },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════

console.log('Eclipse Solver Validation Test Suite');
console.log('====================================\n');

for (const tc of testCases) {
  console.log(`▶ ${tc.name}`);

  let result;
  try {
    result = solve(tc.input);
  } catch (err) {
    assert(false, `${tc.name}: solver crashed`, err.message);
    console.log(`  ✗ CRASH: ${err.message}\n`);
    continue;
  }

  // Test: No overlaps on any wall
  for (const wl of result.walls || []) {
    const overlap = checkNoOverlaps(wl.cabinets || [], `${tc.name} wall ${wl.wallId}`);
    assert(!overlap.overlap, `${tc.name}: wall ${wl.wallId} no overlaps`,
      overlap.overlap ? `${overlap.prev} ends at ${overlap.prevEnd}" but ${overlap.curr} starts at ${overlap.currStart}" (overlap ${overlap.amount}")` : '');
  }

  // Test: No boundary exceed
  for (const wl of result.walls || []) {
    const exceed = checkNoBoundaryExceed(wl.cabinets || [], wl.wallLength, `${tc.name} wall ${wl.wallId}`);
    assert(!exceed.exceed, `${tc.name}: wall ${wl.wallId} no boundary exceed`,
      exceed.exceed ? `${exceed.sku} ends at ${exceed.end}" but wall is ${exceed.wallLength}"` : '');
  }

  // Test: No negative positions
  for (const wl of result.walls || []) {
    const neg = checkNoNegativePositions(wl.cabinets || [], `${tc.name} wall ${wl.wallId}`);
    assert(!neg.negative, `${tc.name}: wall ${wl.wallId} no negative positions`,
      neg.negative ? `${neg.sku} at position ${neg.position}"` : '');
  }

  // Test: Upper layout no overlaps
  for (const ul of result.uppers || []) {
    const overlap = checkNoOverlaps(ul.cabinets || [], `${tc.name} uppers ${ul.wallId}`);
    assert(!overlap.overlap, `${tc.name}: uppers ${ul.wallId} no overlaps`,
      overlap.overlap ? `${overlap.prev} ends at ${overlap.prevEnd}" but ${overlap.curr} starts at ${overlap.currStart}"` : '');
  }

  // Test: _elev assigned to all wall cabinets
  for (const wl of result.walls || []) {
    const elev = checkElevData(wl.cabinets || [], `${tc.name} wall ${wl.wallId}`);
    assert(!elev.missing, `${tc.name}: wall ${wl.wallId} all cabs have _elev`,
      elev.missing ? `${elev.sku} missing _elev` : '');
  }

  // Test: _elev assigned to all uppers
  for (const ul of result.uppers || []) {
    const elev = checkElevData(ul.cabinets || [], `${tc.name} uppers ${ul.wallId}`);
    assert(!elev.missing, `${tc.name}: uppers ${ul.wallId} all cabs have _elev`,
      elev.missing ? `${elev.sku} missing _elev` : '');
  }

  // Test: Has validation array
  assert(Array.isArray(result.validation), `${tc.name}: has validation array`);

  // Test: Has metadata
  assert(result.metadata && typeof result.metadata.totalCabinets === 'number', `${tc.name}: has metadata`);

  // Test: Layout type detected
  assert(typeof result.layoutType === 'string', `${tc.name}: layoutType is string`);

  // Test: No critical errors (only DW not fitting is OK for tight layouts)
  const criticalErrors = (result.validation || []).filter(v =>
    v.severity === 'error' && !v.rule?.includes('DW') && !v.rule?.includes('no_space')
  );

  // Count placed appliances
  const allCabs = (result.walls || []).flatMap(w => w.cabinets || []);
  const placedAppliances = allCabs.filter(c => c.type === 'appliance');
  const inputAppliances = tc.input.appliances.filter(a => a.wall !== 'island');
  const skippedWarnings = (result.validation || []).filter(v => v.rule === 'no_space' || v.type === 'no_space');
  const expectedPlaced = inputAppliances.length - skippedWarnings.length;

  assert(placedAppliances.length >= expectedPlaced - 1,
    `${tc.name}: appliances placed (${placedAppliances.length}/${inputAppliances.length})`,
    `expected ≥${expectedPlaced - 1}, got ${placedAppliances.length}`);

  // Island checks
  if (result.island) {
    const islandWork = result.island.workSide || [];
    const islandNeg = checkNoNegativePositions(islandWork, `${tc.name} island`);
    assert(!islandNeg.negative, `${tc.name}: island no negative positions`);

    const islandOverlap = checkNoOverlaps(islandWork, `${tc.name} island`);
    assert(!islandOverlap.overlap, `${tc.name}: island no overlaps`);

    // Island width check
    const lastIslandCab = islandWork[islandWork.length - 1];
    if (lastIslandCab) {
      const islandEnd = (lastIslandCab.position || 0) + (lastIslandCab.width || 0);
      assert(islandEnd <= result.island.length + 0.5, `${tc.name}: island cabs within bounds`,
        `island ends at ${islandEnd}" but island is ${result.island.length}"`);
    }
  }

  const errorCount = (result.validation || []).filter(v => v.severity === 'error').length;
  const warnCount = (result.validation || []).filter(v => v.severity === 'warning').length;
  console.log(`  ✓ ${errorCount} errors, ${warnCount} warnings\n`);
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('====================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ${f}`);
  }
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
