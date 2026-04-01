/**
 * Integration test: JS bridge → Python OCP 3D engine
 */
import { run3DValidation, build3DModel } from './src/engine-3d.js';

console.log('═══ Eclipse 3D Engine Integration Test ═══\n');

// Test 1: Direct placement validation
console.log('Test 1: run3DValidation with sample placements...');
const placements = [
  { sku: 'BL36-SS-PH', wall: 'A', x: 0,  width: 36, height: 30.5, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875, depthSetback: 0 }},
  { sku: 'SB36-FHD',   wall: 'A', x: 36, width: 36, height: 30.5, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875, depthSetback: 0 }},
  { sku: 'B3D18',      wall: 'A', x: 72, width: 18, height: 30.5, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875, depthSetback: 0 }},
  { sku: 'B27-RT',     wall: 'A', x: 90, width: 27, height: 30.5, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875, depthSetback: 0 }},
  { sku: 'W3639',      wall: 'A', x: 0,  width: 36, height: 39, _elev: { zone: 'UPPER', yMount: 54, height: 39, depth: 13.875, depthSetback: 0 }},
  { sku: 'W3639',      wall: 'A', x: 36, width: 36, height: 39, _elev: { zone: 'UPPER', yMount: 54, height: 39, depth: 13.875, depthSetback: 0 }},
  { sku: 'WSC2439',    wall: 'A', x: 72, width: 24, height: 39, _elev: { zone: 'UPPER', yMount: 54, height: 39, depth: 13.875, depthSetback: 0 }},
  // Fridge + RW above
  { sku: 'FRIDGE-36',  wall: 'B', x: 63, width: 36, height: 84, _elev: { zone: 'TALL', yMount: 0, height: 84, depth: 27.875, depthSetback: 0 }, type: 'refrigerator' },
  { sku: 'RW3612-27',  wall: 'B', x: 63, width: 36, height: 12, _elev: { zone: 'ABOVE_TALL', yMount: 84, height: 12, depth: 27.875, depthSetback: 0 }},
];

const result = run3DValidation(placements, 96);

if (result.success) {
  console.log(`  ✓ Python engine returned successfully`);
  console.log(`  ✓ ${result.totalSolids} 3D solids created`);
  console.log(`  ✓ Collisions: ${result.validation.error_count} errors, ${result.validation.warning_count} warnings`);
  
  if (result.validation.all_issues.length === 0) {
    console.log(`  ✓ All stacking and collision checks pass`);
  } else {
    for (const issue of result.validation.all_issues) {
      console.log(`  ⚠ ${issue.severity}: ${issue.message}`);
    }
  }
  
  // Show elevation data
  console.log('\n  Wall A elevation from 3D engine:');
  for (const cab of (result.elevations?.A || [])) {
    console.log(`    ${cab.sku.padEnd(12)} x=${String(cab.x).padStart(5)} yMount=${String(cab.yMount).padStart(5)} yTop=${String(cab.yTop).padStart(5)} ${cab.width}w×${cab.height}h×${cab.depth}d [${cab.zone}]`);
  }
  
  console.log('\n  Wall B elevation from 3D engine:');
  for (const cab of (result.elevations?.B || [])) {
    console.log(`    ${cab.sku.padEnd(12)} x=${String(cab.x).padStart(5)} yMount=${String(cab.yMount).padStart(5)} yTop=${String(cab.yTop).padStart(5)} ${cab.width}w×${cab.height}h×${cab.depth}d [${cab.zone}]`);
  }
} else {
  console.log(`  ✗ FAILED: ${result.error}`);
}

// Test 2: Deliberate collision
console.log('\n\nTest 2: Collision detection (overlapping cabinets)...');
const badPlacements = [
  { sku: 'B36', wall: 'A', x: 0,  width: 36, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875 }},
  { sku: 'B36', wall: 'A', x: 20, width: 36, _elev: { zone: 'BASE', yMount: 4, height: 30.5, depth: 24.875 }},
];
const bad = run3DValidation(badPlacements, 96);
if (bad.success && bad.validation.error_count > 0) {
  console.log(`  ✓ Correctly detected ${bad.validation.error_count} collision(s)`);
  for (const c of bad.validation.collisions) {
    console.log(`    → ${c.message}`);
  }
} else {
  console.log(`  ✗ Failed to detect collision`);
}

// Test 3: Ceiling violation
console.log('\n\nTest 3: Ceiling violation (RW too tall)...');
const ceilPlacements = [
  { sku: 'RW3621-27', wall: 'A', x: 0, width: 36, _elev: { zone: 'ABOVE_TALL', yMount: 84, height: 21, depth: 27.875 }},
];
const ceil = run3DValidation(ceilPlacements, 96);
if (ceil.success && ceil.validation.stacking.some(i => i.rule === 'exceeds_ceiling')) {
  console.log(`  ✓ Correctly flagged ceiling violation (84+21=105 > 96)`);
} else {
  console.log(`  ✗ Failed to detect ceiling violation`);
}

console.log('\n═══ All integration tests complete ═══');
