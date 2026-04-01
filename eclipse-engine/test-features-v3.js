/**
 * Feature Tests v3 — RoomSketcher-inspired features
 * Tests: single-wall-island, G-shape, traffic flow, special zones,
 *        hutch zone-override, 2D floor plan export, waste cabinet guarantee
 */

import { solve } from './src/solver.js';
import { assignCoordinates, autoWallConfig, exportFloorPlan } from './src/coordinates.js';
import { TRAFFIC_FLOW, ZONE_CABINET_PRIORITY, HUTCH_RULES, ISLAND_RULES } from './src/constraints.js';

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════
// Feature 1: Single-Wall-Island Layout
// ═══════════════════════════════════════════════
console.log('\n═══ Feature 1: Single-Wall-Island Layout ═══');

const swiResult = solve({
  roomType: 'kitchen',
  walls: [{ id: 'A', length: 156, appliances: ['sink', 'dw'] }],
  island: {
    length: 72, depth: 39,
    appliances: ['range'],
    seating: { count: 3, side: 'back', overhang: 12 },
  },
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'island', width: 30 },
  ],
  prefs: { sophistication: 'high', coordinates: true },
});

check('Layout type inferred as single-wall-island', swiResult.layoutType === 'single-wall-island');
check('Has island layout', !!swiResult.island);
check('Island has range (hasRange flag)', swiResult.island?.hasRange === true);
check('Has wall A in walls array', swiResult.walls?.some(w => w.wallId === 'A'));

// Test auto wall config for SWI
const swiConfig = autoWallConfig(swiResult);
check('Wall A config exists', !!swiConfig['A']);
check('Island config exists at z=42 for SWI', swiConfig['island']?.origin?.z === 42);

// ═══════════════════════════════════════════════
// Feature 2: Traffic Flow Protection
// ═══════════════════════════════════════════════
console.log('\n═══ Feature 2: Traffic Flow Protection ═══');

check('TRAFFIC_FLOW exported', !!TRAFFIC_FLOW);
check('Door swing clearance defined (36")', TRAFFIC_FLOW.doorSwingClearance === 36);
check('Island-door min distance (42")', TRAFFIC_FLOW.islandDoorMinDistance === 42);
check('Sink prefers window', TRAFFIC_FLOW.sinkPreferWindow === true);
check('Fridge door swing clearance (36")', TRAFFIC_FLOW.fridgeDoorSwing === 36);

// Solve with door opening — traffic flow should protect door zone
const trafficResult = solve({
  roomType: 'kitchen',
  walls: [
    {
      id: 'A', length: 180,
      appliances: ['sink', 'dw', 'range'],
      openings: [{ type: 'door', posFromLeft: 0, width: 36, swingDirection: 'right' }],
    },
  ],
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'A', width: 30 },
  ],
  prefs: { sophistication: 'high' },
});

// Door zone should be protected — no cabinet starting at position 0
const wallACabs = trafficResult.walls?.find(w => w.wallId === 'A')?.cabinets || [];
const cabAtDoor = wallACabs.find(c => c.position !== undefined && c.position < 36);
check('No cabinet placed inside door zone (pos < 36")', !cabAtDoor);

// ═══════════════════════════════════════════════
// Feature 3: Special Kitchen Zones
// ═══════════════════════════════════════════════
console.log('\n═══ Feature 3: Special Kitchen Zones ═══');

check('breakfast_nook zone config exists', !!ZONE_CABINET_PRIORITY.breakfast_nook);
check('desk zone config exists', !!ZONE_CABINET_PRIORITY.desk);
check('butler_pantry zone config exists', !!ZONE_CABINET_PRIORITY.butler_pantry);
check('wet_bar zone config exists', !!ZONE_CABINET_PRIORITY.wet_bar);
check('coffee_bar zone config exists', !!ZONE_CABINET_PRIORITY.coffee_bar);

check('breakfast_nook upperApproach = none', ZONE_CABINET_PRIORITY.breakfast_nook.upperApproach === 'none');
check('butler_pantry upperApproach = hutch', ZONE_CABINET_PRIORITY.butler_pantry.upperApproach === 'hutch');
check('coffee_bar upperApproach = hutch', ZONE_CABINET_PRIORITY.coffee_bar.upperApproach === 'hutch');

// Solve with a breakfast_nook wall — should get no uppers on that wall
const zoneResult = solve({
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 144, appliances: ['sink', 'dw', 'range'] },
    { id: 'B', length: 60, role: 'breakfast_nook' },
  ],
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'A', width: 30 },
  ],
  prefs: { sophistication: 'high' },
});

const nookWall = zoneResult.walls?.find(w => w.wallId === 'B');
check('Breakfast nook wall exists in layout', !!nookWall);
const nookUppers = zoneResult.uppers?.find(u => u.wallId === 'B');
check('Breakfast nook has no uppers (zone_no_uppers)', nookUppers?.cabinets?.length === 0 && nookUppers?.patternId === 'zone_no_uppers');

// Butler pantry wall should get hutch uppers
const pantryResult = solve({
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 144, appliances: ['sink', 'dw', 'range'] },
    { id: 'B', length: 72, role: 'butler_pantry' },
  ],
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'A', width: 30 },
  ],
  prefs: { sophistication: 'high' },
});

const pantryUppers = pantryResult.uppers?.find(u => u.wallId === 'B');
check('Butler pantry uppers exist', !!pantryUppers);
const pantryHasHutch = pantryUppers?.cabinets?.some(c => c.type === 'hutch' || c.sitsOnCounter);
check('Butler pantry gets hutch uppers (zone override)', !!pantryHasHutch);

// ═══════════════════════════════════════════════
// Feature 4: 2D Floor Plan Export
// ═══════════════════════════════════════════════
console.log('\n═══ Feature 4: 2D Floor Plan Export ═══');

const floorPlan = exportFloorPlan(swiResult);

check('Floor plan has layoutType', floorPlan.layoutType === 'single-wall-island');
check('Floor plan has boundingBox', !!floorPlan.boundingBox && floorPlan.boundingBox.width > 0);
check('Floor plan has walls layer', Array.isArray(floorPlan.layers.walls));
check('Floor plan has cabinets layer', Array.isArray(floorPlan.layers.cabinets));
check('Floor plan has appliances layer', Array.isArray(floorPlan.layers.appliances));
check('Floor plan has island layer', floorPlan.layers.island !== undefined);
check('Floor plan has openings layer', Array.isArray(floorPlan.layers.openings));
check('Floor plan has trafficArrows layer', Array.isArray(floorPlan.layers.trafficArrows));
check('Floor plan has validation array', Array.isArray(floorPlan.validation));

// Work triangle
const wt = floorPlan.layers.workTriangle;
if (wt) {
  check('Work triangle has 3 points', wt.points.length === 3);
  check('Work triangle has perimeter', wt.perimeter > 0);
  check('Work triangle has NKBA compliance flag', typeof wt.nkbaCompliant === 'boolean');
} else {
  console.log('  ⚠️  Work triangle not available (appliance coordinates may not be assigned)');
}

// Wall outlines
check('Wall outlines count >= 1', floorPlan.layers.walls.length >= 1);
const wallAOutline = floorPlan.layers.walls.find(w => w.id === 'A');
check('Wall A outline has width/depth', wallAOutline && wallAOutline.width > 0 && wallAOutline.depth > 0);

// ═══════════════════════════════════════════════
// Feature 5: G-Shape Layout
// ═══════════════════════════════════════════════
console.log('\n═══ Feature 5: G-Shape Layout ═══');

const gResult = solve({
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 120, appliances: ['sink', 'dw'] },
    { id: 'B', length: 96, appliances: ['range'] },
    { id: 'C', length: 120, appliances: ['refrigerator'] },
    { id: 'D', length: 60, partial: true, partialHeight: 42 },
  ],
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'B', width: 30 },
    { type: 'refrigerator', wall: 'C', width: 36 },
  ],
  prefs: { sophistication: 'high', coordinates: true },
});

check('G-shape layout type', gResult.layoutType === 'g-shape');
check('G-shape has 4 wall results', gResult.walls?.length === 4);
check('G-shape has corners (2-3)', gResult.corners?.length >= 2);

// G-shape wall config
const gConfig = autoWallConfig(gResult);
check('G-shape wall A goes east', gConfig['A']?.direction === 'east');
check('G-shape wall B goes north', gConfig['B']?.direction === 'north');
check('G-shape wall C goes west', gConfig['C']?.direction === 'west');
check('G-shape wall D goes south', gConfig['D']?.direction === 'south');

// ═══════════════════════════════════════════════
// Waste Cabinet Guarantee
// ═══════════════════════════════════════════════
console.log('\n═══ Waste Cabinet Guarantee ═══');

const wasteResult = solve({
  roomType: 'kitchen',
  walls: [{ id: 'A', length: 120, appliances: ['sink', 'dw', 'range'] }],
  appliances: [
    { type: 'sink', wall: 'A', width: 33 },
    { type: 'dw', wall: 'A', width: 24 },
    { type: 'range', wall: 'A', width: 30 },
  ],
  prefs: { sophistication: 'high' },
});

// Check wall cabinets for waste (Phase 6d inserts into wall cabs)
const allWallCabs = wasteResult.walls?.flatMap(wl => wl.cabinets || []) || [];
const hasWasteInWall = allWallCabs.some(c => (c.sku || '').toUpperCase().includes('BWDM'));
check('Kitchen has waste cabinet in wall cabs (BWDM*)', hasWasteInWall);

// Validation should NOT flag missing waste
const wasteWarning = wasteResult.validation?.find(v => v.code === 'Design-Trash-Cabinet-Missing');
check('No "trash missing" validation warning (guaranteed by Phase 6d)', !wasteWarning);

// ═══════════════════════════════════════════════
// Island Rules & Constraints
// ═══════════════════════════════════════════════
console.log('\n═══ Island & Peninsula Constraint Rules ═══');

check('One-slab max width = 65"', ISLAND_RULES.oneSlabMaxWidth === 65);
check('One-slab max length = 128"', ISLAND_RULES.oneSlabMaxLength === 128);
check('Standard island depth = 39"', ISLAND_RULES.standardDepth === 39);
check('Deep island depth = 50"', ISLAND_RULES.deepIslandDepth === 50);
check('Seating overhang min = 12"', ISLAND_RULES.overhangMin === 12);
check('Seating overhang ideal = 15"', ISLAND_RULES.overhangIdeal === 15);
check('Width per adult = 24"', ISLAND_RULES.widthPerAdult === 24);
check('Width per child = 20"', ISLAND_RULES.widthPerChild === 20);

// ═══════════════════════════════════════════════
// Hutch Cabinet Rules
// ═══════════════════════════════════════════════
console.log('\n═══ Hutch Cabinet Rules ═══');

check('HUTCH_RULES exported', !!HUTCH_RULES);
check('Hutch counter gap = 0', HUTCH_RULES.counterGap === 0);
check('Hutch standard depth = 13"', HUTCH_RULES.depths.standard === 13);
check('Hutch deep depth = 16"', HUTCH_RULES.depths.deep === 16);
check('Hutch pocket door has PKD hardware', HUTCH_RULES.doorStyles.pocketDoor.hardware === 'PKD');
check('Hutch avoid above range', HUTCH_RULES.placement.avoidAboveRange === true);
check('Hutch avoid above sink', HUTCH_RULES.placement.avoidAboveSink === true);
check('Hutch min segment width = 15"', HUTCH_RULES.placement.minSegmentWidth === 15);

// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`Feature v3 Tests: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log('══════════════════════════════════════════════════');

if (failed > 0) process.exit(1);
