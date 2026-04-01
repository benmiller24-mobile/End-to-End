#!/usr/bin/env node
/**
 * Eclipse Kitchen Designer — Full Solver Runner with Appliance Positions
 * Reads actual solver placements and infers appliance positions from gaps.
 */
import { solve } from './src/index.js';

const input = {
  layoutType: "l-shape",
  roomType: "kitchen",
  projectName: "NKBA-Validated L-Shape Kitchen",
  walls: [
    { id: "A", length: 156, role: "range", direction: "east" },
    { id: "B", length: 120, role: "sink", direction: "north" }
  ],
  appliances: [
    { type: "refrigerator", width: 36, wall: "A", model: "Sub-Zero CL3650UFD" },
    { type: "range", width: 36, wall: "A", model: "Wolf DF364G" },
    { type: "sink", width: 33, wall: "B", model: "SS Undermount 33" },
    { type: "dishwasher", width: 24, wall: "B", model: "Miele G7186" }
  ],
  prefs: {
    cornerTreatment: "lazySusan",
    preferDrawerBases: true,
    preferSymmetry: true,
    sophistication: "high"
  }
};

const result = solve(input);
const placements = result.placements || [];

// ─── Helper: get positioned cabinets for a wall/zone ───
function getPositioned(wall, zoneFilter) {
  return placements.filter(p =>
    p.wall === wall &&
    (zoneFilter ? zoneFilter(p) : true) &&
    p.position != null && !isNaN(p.position) &&
    p.width > 3
  ).sort((a, b) => a.position - b.position);
}

// ─── Infer appliance positions from gaps between cabinets ───
function findGaps(cabs, zoneStart, zoneEnd) {
  const gaps = [];
  let cursor = zoneStart;
  for (const c of cabs) {
    if (c.position > cursor + 1) {
      gaps.push({ start: cursor, width: Math.round(c.position - cursor) });
    }
    cursor = Math.max(cursor, c.position + c.width);
  }
  if (zoneEnd - cursor > 1) {
    gaps.push({ start: cursor, width: Math.round(zoneEnd - cursor) });
  }
  return gaps;
}

// ─── Build SVG placements ───
const svgPlacements = [];
const cornerSize = 36;

// ── Wall A ──
const wallABases = getPositioned('A', p => p._elev?.zone === 'BASE');
const wallAUppers = getPositioned('A', p => p._elev?.zone === 'UPPER');
const wallAUsable = 156 - cornerSize; // 120" usable on Wall A

// Add base cabinets
for (const b of wallABases) {
  if (b.role === 'fridge_panel' || b.role === 'base_end_panel' || b.role === 'wall_end_panel') continue;
  svgPlacements.push({ sku: b.sku, width: b.width, x: b.position, wall: 'A', zone: 'BASE' });
}

// Find fridge position from REP panels
const fridgePanelLeft = placements.find(p => p.wall === 'A' && p.role === 'fridge_panel' && p.side === 'left');
const fridgePanelRight = placements.find(p => p.wall === 'A' && p.role === 'fridge_panel' && p.side === 'right');
let fridgeX = 0;
if (fridgePanelLeft && fridgePanelLeft.position != null) {
  fridgeX = fridgePanelLeft.position + (fridgePanelLeft.width || 1.5);
} else if (fridgePanelRight && fridgePanelRight.position != null) {
  fridgeX = fridgePanelRight.position - 36;
}
svgPlacements.push({ sku: 'FRIDGE36', width: 36, x: Math.max(0, Math.round(fridgeX)), wall: 'A', zone: 'TALL', is_appliance: true });

// Find range position from gap between B24-RT cabinets
const rangeFlanking = wallABases.filter(b => b.role === 'rangeFlanking');
if (rangeFlanking.length >= 2) {
  const sorted = rangeFlanking.sort((a, b) => a.position - b.position);
  const rangeX = sorted[0].position + sorted[0].width;
  svgPlacements.push({ sku: 'RANGE36', width: 36, x: rangeX, wall: 'A', zone: 'BASE', is_appliance: true });
} else if (rangeFlanking.length === 1) {
  // Single flanking cab — range is adjacent
  const rangeX = rangeFlanking[0].position + rangeFlanking[0].width;
  svgPlacements.push({ sku: 'RANGE36', width: 36, x: rangeX, wall: 'A', zone: 'BASE', is_appliance: true });
}

// Wall A uppers (deduplicate RW above-fridge cab)
let rwAdded = false;
for (const u of wallAUppers) {
  if (u.role === 'fridge_wall_cab' || u.sku?.startsWith('RW')) {
    if (!rwAdded) {
      svgPlacements.push({ sku: u.sku, width: u.width, x: Math.max(0, Math.round(fridgeX)), wall: 'A', zone: 'UPPER' });
      rwAdded = true;
    }
    // Skip duplicates
  } else {
    svgPlacements.push({ sku: u.sku, width: u.width, x: u.position, wall: 'A', zone: 'UPPER' });
  }
}

// Range hood
const hood = placements.find(p => p.wall === 'A' && p.role === 'range_hood');
if (hood && hood.position != null) {
  svgPlacements.push({ sku: hood.sku || 'RH3624', width: hood.width, x: hood.position, wall: 'A', zone: 'UPPER', is_appliance: true });
}

// ── Wall B ──
const wallBBases = getPositioned('B', p => p._elev?.zone === 'BASE');
const wallBUppers = getPositioned('B', p => p._elev?.zone === 'UPPER');
const wallBUsable = 120 - cornerSize; // 84" usable on Wall B

// Add base cabinets
for (const b of wallBBases) {
  if (b.role === 'base_end_panel' || b.role === 'wall_end_panel' || b.type === 'filler') continue;
  svgPlacements.push({ sku: b.sku, width: b.width, x: b.position, wall: 'B', zone: 'BASE' });
}

// Find DW position from gaps on Wall B
// The solver positions cabinets but filters out the DW appliance.
// The DW goes in the gap on the OUTBOARD side of the sink (away from corner).
const sinkCab = wallBBases.find(b => b.role === 'sink-base' || b.sku?.startsWith('SB'));
if (sinkCab) {
  const sinkEnd = sinkCab.position + sinkCab.width;
  const sinkStart = sinkCab.position;

  // Check for gap after sink (outboard side in L-shape where corner is on left)
  const cabsAfterSink = wallBBases.filter(b => b.position >= sinkEnd && b.width > 3 && b.role !== 'sink-base');
  const nextCabAfterSink = cabsAfterSink.length > 0 ? cabsAfterSink[0] : null;

  const gapAfterSink = nextCabAfterSink
    ? nextCabAfterSink.position - sinkEnd
    : (cornerSize + wallBUsable) - sinkEnd;

  // Check for gap before sink (corner side)
  const cabsBeforeSink = wallBBases.filter(b => b.position + b.width <= sinkStart && b.width > 3);
  const prevCab = cabsBeforeSink.length > 0 ? cabsBeforeSink[cabsBeforeSink.length - 1] : null;
  const gapBeforeSink = prevCab
    ? sinkStart - (prevCab.position + prevCab.width)
    : sinkStart - cornerSize;

  // Place DW in the gap that matches DW width (24"), preferring outboard (after sink)
  if (gapAfterSink >= 24) {
    svgPlacements.push({ sku: 'DW24', width: 24, x: sinkEnd, wall: 'B', zone: 'BASE', is_appliance: true });
  } else if (gapBeforeSink >= 24) {
    svgPlacements.push({ sku: 'DW24', width: 24, x: sinkStart - 24, wall: 'B', zone: 'BASE', is_appliance: true });
  } else {
    // Fallback: place immediately after sink
    svgPlacements.push({ sku: 'DW24', width: 24, x: sinkEnd, wall: 'B', zone: 'BASE', is_appliance: true });
  }
}

// Wall B uppers
for (const u of wallBUppers) {
  svgPlacements.push({ sku: u.sku, width: u.width, x: u.position, wall: 'B', zone: 'UPPER' });
}

// ── Corner ──
svgPlacements.push({ sku: 'BL36-SS-PH', width: 36, x: 120, wall: 'A', zone: 'CORNER' });

// ── Countertops ──
svgPlacements.push({ sku: 'CTR-A', width: wallAUsable, x: 0, wall: 'A', zone: 'COUNTERTOP' });
svgPlacements.push({ sku: 'CTR-B', width: wallBUsable, x: cornerSize, wall: 'B', zone: 'COUNTERTOP' });

// Sort placements
const sorted = svgPlacements.sort((a, b) => {
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
  return a.x - b.x;
});

const output = {
  meta: {
    layoutType: 'l-shape',
    wallA_length: 156,
    wallB_length: 120,
    cornerSize: 36,
    cornerSku: 'BL36-SS-PH',
    species: 'Walnut',
    doorStyle: 'Metropolitan Vertical',
    construction: 'Plywood',
    solverCabinetCount: placements.length,
  },
  rawPlacements: placements.map(p => ({
    sku: p.sku, width: p.width, position: p.position, wall: p.wall,
    type: p.type, role: p.role, zone: p._elev?.zone,
    height: p._elev?.height, yMount: p._elev?.yMount, depth: p._elev?.depth,
  })),
  svgPlacements: sorted,
};

console.log(JSON.stringify(output, null, 2));
