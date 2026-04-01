#!/usr/bin/env node
/**
 * Eclipse Kitchen Designer — Solver Runner
 * Runs the 7-phase solver with a given input and outputs positioned placements as JSON.
 *
 * Usage: node run-solver.mjs [input.json] > placements.json
 * If no input file given, uses a standard L-shape kitchen (156" × 120")
 */

import { solve } from './src/index.js';
import { readFileSync } from 'fs';

// Default L-shape input based on training data patterns
const DEFAULT_INPUT = {
  layoutType: "l-shape",
  roomType: "kitchen",
  projectName: "Solver Output — NKBA Validated L-Shape",
  walls: [
    { id: "A", length: 156, role: "range", direction: "east" },
    { id: "B", length: 120, role: "sink", direction: "north" }
  ],
  appliances: [
    { type: "refrigerator", width: 36, wall: "A", position: "start", model: "Sub-Zero CL3650UFD" },
    { type: "range", width: 36, wall: "A", position: "center", model: "Wolf DF364G" },
    { type: "sink", width: 33, wall: "B", model: "SS Undermount 33" },
    { type: "dishwasher", width: 24, wall: "B", model: "Miele G7186" }
  ],
  prefs: {
    cornerTreatment: "lazySusan",
    preferDrawerBases: true,
    preferSymmetry: true,
    sophistication: "high",
    species: "Walnut",
    doorStyle: "Metropolitan Vertical",
    construction: "Plywood"
  }
};

// Load input
let input;
if (process.argv[2]) {
  try {
    input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  } catch (e) {
    console.error(`Error reading ${process.argv[2]}: ${e.message}`);
    process.exit(1);
  }
} else {
  input = DEFAULT_INPUT;
}

// Run solver
try {
  const result = solve(input);

  // Extract and enhance placements with position validation
  const placements = result.placements || [];

  // Compute positions for any placements still missing them
  const wallGroups = {};
  for (const p of placements) {
    const wallKey = p.wall || 'unknown';
    if (!wallGroups[wallKey]) wallGroups[wallKey] = [];
    wallGroups[wallKey].push(p);
  }

  // For each wall group, if positions are sequential (cumulative), validate
  // If positions are undefined, compute from cumulative widths
  for (const [wallKey, cabs] of Object.entries(wallGroups)) {
    let pos = 0;
    for (const cab of cabs) {
      if (cab.position === undefined || cab.position === null) {
        cab.position = pos;
      }
      pos = cab.position + (cab.width || 0);
    }
  }

  // Build output with solver metadata
  const output = {
    input: {
      layoutType: input.layoutType,
      walls: input.walls,
      appliances: input.appliances.map(a => ({ type: a.type, width: a.width, wall: a.wall })),
    },
    solver: {
      phases: 7,
      cabinetCount: placements.length,
      wallCount: input.walls.length,
      hasCorner: placements.some(p => p.type === 'corner'),
      warnings: result._warnings || result.warnings || [],
    },
    placements: placements.map(p => ({
      sku: p.sku,
      width: p.width,
      position: p.position,
      wall: p.wall,
      type: p.type || 'base',
      role: p.role || 'general',
      zone: p._elev?.zone || p.zoneFunction || null,
      _elev: p._elev || null,
    })),
    // Separate by wall for SVG generator
    wallA: placements.filter(p => p.wall === 'A').map(p => ({
      sku: p.sku, width: p.width, position: p.position,
      type: p.type, role: p.role,
      height: p._elev?.height, yMount: p._elev?.yMount, depth: p._elev?.depth,
      zone: p._elev?.zone,
    })),
    wallB: placements.filter(p => p.wall === 'B').map(p => ({
      sku: p.sku, width: p.width, position: p.position,
      type: p.type, role: p.role,
      height: p._elev?.height, yMount: p._elev?.yMount, depth: p._elev?.depth,
      zone: p._elev?.zone,
    })),
    corners: placements.filter(p => p.type === 'corner').map(p => ({
      sku: p.sku, width: p.width, position: p.position, wall: p.wall,
    })),
  };

  console.log(JSON.stringify(output, null, 2));

} catch (e) {
  console.error(`Solver error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
}
