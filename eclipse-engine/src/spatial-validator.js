/**
 * SPATIAL VALIDATOR — Overlap, Collision & Constraint Checker
 * ════════════════════════════════════════════════════════════════
 *
 * Self-debugging validator that checks the entire layout for:
 *   1. Cabinet-to-cabinet overlaps (X-axis collision on same wall)
 *   2. Cabinet-to-wall boundary violations (overflow / underflow)
 *   3. Corner anchor integrity (adjacent cabs must chain from corner edge)
 *   4. Molding/trim collision with cabinet bounding boxes
 *   5. Crown molding path continuity (must skip hood/appliance gaps)
 *   6. Light rail path continuity (must skip hood/microwave zones)
 *   7. Component hierarchy enforcement (children outside parent bounds)
 *   8. Work triangle NKBA compliance
 *
 * Usage:
 *   import { validateSpatialLayout } from './spatial-validator.js';
 *   const report = validateSpatialLayout(solverOutput);
 *   // report.errors   → must-fix violations
 *   // report.warnings → advisory issues
 *   // report.passed   → true if no errors
 *
 * Every check returns { rule, severity, message, wall?, position?, fix? }
 */

// ─── BOUNDING BOX ──────────────────────────────────────────────
// Every physical object gets a 3D bounding box for collision detection.
// Cabinet boxes are Parents; moldings/hardware are Children.

/**
 * Build a 3D bounding box for a cabinet or appliance.
 * Coordinates: X = along wall, Y = depth from wall, Z = height from floor.
 */
export function buildBoundingBox(item, defaults = {}) {
  const x = item.position_start ?? item.position ?? 0;
  const w = item.width || 0;
  const d = item._depth || item.depth || defaults.depth || 24;
  const h = item.height || defaults.height || 34.5;

  // Vertical positioning
  let zBase = 0;
  if (item._elev?.yMount != null) {
    zBase = item._elev.yMount;
  } else if (item.type === 'wall' || item.type === 'wall_stacked_display') {
    zBase = 54; // standard upper bottom AFF
  } else if (item.type === 'base' || item.type === 'appliance') {
    zBase = 4.5; // toe kick height
  } else if (item.type === 'filler') {
    zBase = 4.5;
  }

  return {
    id: item.sku || item.applianceType || 'unknown',
    wall: item.wall || item.wall_id || null,
    // X-axis (along wall)
    xMin: x,
    xMax: x + w,
    // Y-axis (depth from wall, 0 = wall surface)
    yMin: 0,
    yMax: d,
    // Z-axis (height from floor)
    zMin: zBase,
    zMax: zBase + h,
    // Source reference
    _source: item,
  };
}

/**
 * Build a bounding box for a molding/trim piece.
 * Moldings are Children — they must sit OUTSIDE the parent cabinet box.
 */
export function buildMoldingBox(molding) {
  const x = molding.xStart ?? 0;
  const w = (molding.xEnd ?? 0) - x;
  const profile = molding.profileHeight || 3;

  let zBase, zMax, yMin, yMax;

  if (molding.type === 'crown') {
    // Crown sits ON TOP of cabinet, protruding forward
    zBase = molding.cabinetTopZ || 93; // typical upper top
    zMax = zBase + profile;
    yMin = 0;
    yMax = (molding.cabinetDepth || 13) + profile; // protrudes past face
  } else if (molding.type === 'light_rail') {
    // Light rail hangs BELOW cabinet bottom, on front face
    zBase = (molding.cabinetBottomZ || 54) - profile;
    zMax = molding.cabinetBottomZ || 54;
    yMin = (molding.cabinetDepth || 13) - 0.5; // slightly inset from face
    yMax = (molding.cabinetDepth || 13) + 0.75;
  } else if (molding.type === 'toe_kick') {
    zBase = 0;
    zMax = 4.5;
    yMin = 0;
    yMax = molding.cabinetDepth || 24;
  }

  return {
    id: molding.sku || molding.type,
    wall: molding.wall || null,
    xMin: x,
    xMax: x + w,
    yMin: yMin || 0,
    yMax: yMax || 3,
    zMin: zBase || 0,
    zMax: zMax || 3,
    _source: molding,
  };
}


// ─── COLLISION DETECTION ───────────────────────────────────────

/**
 * Check if two bounding boxes overlap in 3D space.
 * Returns overlap volume or 0 if no collision.
 */
export function boxesOverlap(a, b) {
  // Must be on same wall
  if (a.wall && b.wall && a.wall !== b.wall) return 0;

  const xOverlap = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
  const yOverlap = Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin));
  const zOverlap = Math.max(0, Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin));

  return xOverlap * yOverlap * zOverlap;
}

/**
 * Check if two items overlap on the X-axis only (same wall, same vertical zone).
 */
export function xAxisOverlap(a, b) {
  if (a.wall && b.wall && a.wall !== b.wall) return 0;
  return Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
}


// ─── CORNER ANCHOR VALIDATION ──────────────────────────────────

/**
 * Validate that cabinets adjacent to a corner start exactly at the corner's
 * edge (corner.end_position === adjacent_cab.position_start).
 *
 * Rule: Corner is the ANCHOR. All cabinet runs chain FROM the corner edge.
 * The corner occupies a fixed footprint and adjacent cabinets snap to it.
 */
export function validateCornerAnchoring(wallLayouts, corners) {
  const issues = [];

  for (const corner of corners) {
    // Wall A: corner consumes from the RIGHT end (wallAConsumption from right)
    // The first cabinet to the left of the corner should end at wallLength - wallAConsumption
    const wallA = wallLayouts.find(w => w.wallId === corner.wallA);
    if (wallA) {
      const cornerEdgeA = wallA.wallLength - corner.wallAConsumption;
      const wallACabs = (wallA.cabinets || [])
        .filter(c => typeof c.position === 'number' && c.type !== 'end_panel')
        .sort((a, b) => a.position - b.position);

      // Find the cabinet closest to the corner edge
      const nearCorner = wallACabs.filter(c => {
        const cabEnd = c.position + (c.width || 0);
        return Math.abs(cabEnd - cornerEdgeA) < 2 || Math.abs(c.position - cornerEdgeA) < 2;
      });

      if (wallACabs.length > 0) {
        const lastCab = wallACabs[wallACabs.length - 1];
        const lastCabEnd = lastCab.position + (lastCab.width || 0);
        const gap = cornerEdgeA - lastCabEnd;

        if (gap > 1 && gap < 9) {
          issues.push({
            rule: 'corner_anchor_gap_A',
            severity: 'error',
            message: `Wall ${corner.wallA}: ${gap.toFixed(1)}" gap between last cabinet (${lastCab.sku} ends at ${lastCabEnd}") and corner zone (starts at ${cornerEdgeA}"). Cabinets must chain to corner edge.`,
            wall: corner.wallA,
            position: lastCabEnd,
            fix: `Extend ${lastCab.sku} by ${gap.toFixed(1)}" or insert filler`,
          });
        } else if (lastCabEnd > cornerEdgeA + 0.5) {
          issues.push({
            rule: 'corner_anchor_overlap_A',
            severity: 'error',
            message: `Wall ${corner.wallA}: last cabinet ${lastCab.sku} (ends at ${lastCabEnd}") overlaps corner zone (starts at ${cornerEdgeA}") by ${(lastCabEnd - cornerEdgeA).toFixed(1)}"`,
            wall: corner.wallA,
            position: cornerEdgeA,
            fix: `Shrink ${lastCab.sku} by ${(lastCabEnd - cornerEdgeA).toFixed(1)}"`,
          });
        }
      }
    }

    // Wall B: corner consumes from the LEFT end (wallBConsumption from left)
    // The first cabinet after the corner should start at wallBConsumption
    const wallB = wallLayouts.find(w => w.wallId === corner.wallB);
    if (wallB) {
      const cornerEdgeB = corner.wallBConsumption;
      const wallBCabs = (wallB.cabinets || [])
        .filter(c => typeof c.position === 'number' && c.type !== 'end_panel')
        .sort((a, b) => a.position - b.position);

      if (wallBCabs.length > 0) {
        const firstCab = wallBCabs[0];
        const gap = firstCab.position - cornerEdgeB;

        if (gap > 1 && gap < 9) {
          issues.push({
            rule: 'corner_anchor_gap_B',
            severity: 'error',
            message: `Wall ${corner.wallB}: ${gap.toFixed(1)}" gap between corner edge (${cornerEdgeB}") and first cabinet (${firstCab.sku} at ${firstCab.position}"). First cab must start at corner edge.`,
            wall: corner.wallB,
            position: cornerEdgeB,
            fix: `Move ${firstCab.sku} left to position ${cornerEdgeB}" or insert filler`,
          });
        } else if (firstCab.position < cornerEdgeB - 0.5) {
          issues.push({
            rule: 'corner_anchor_overlap_B',
            severity: 'error',
            message: `Wall ${corner.wallB}: first cabinet ${firstCab.sku} (at ${firstCab.position}") starts inside corner zone (edge at ${cornerEdgeB}") — overlap of ${(cornerEdgeB - firstCab.position).toFixed(1)}"`,
            wall: corner.wallB,
            position: firstCab.position,
            fix: `Move ${firstCab.sku} right to position ${cornerEdgeB}"`,
          });
        }
      }
    }
  }

  return issues;
}


// ─── CABINET CHAIN VALIDATION ──────────────────────────────────

/**
 * Validate strict left→right chaining on each wall.
 * cab[i].position + cab[i].width === cab[i+1].position (±0.5" tolerance)
 */
export function validateCabinetChains(wallLayouts) {
  const issues = [];

  for (const wall of wallLayouts) {
    const cabs = (wall.cabinets || [])
      .filter(c => typeof c.position === 'number' && c.width > 0)
      .sort((a, b) => a.position - b.position);

    for (let i = 0; i < cabs.length - 1; i++) {
      const curr = cabs[i];
      const next = cabs[i + 1];
      const currEnd = curr.position + curr.width;
      const gap = next.position - currEnd;

      if (gap < -0.5) {
        // Overlap
        issues.push({
          rule: 'chain_overlap',
          severity: 'error',
          message: `Wall ${wall.wallId}: ${curr.sku || curr.applianceType} (ends ${currEnd.toFixed(1)}") overlaps ${next.sku || next.applianceType} (starts ${next.position.toFixed(1)}") by ${Math.abs(gap).toFixed(1)}"`,
          wall: wall.wallId,
          position: next.position,
          fix: `Shift ${next.sku || next.applianceType} right to ${currEnd}"`,
        });
      } else if (gap > 0.5 && gap < 9) {
        // Unfillable gap (too small for a cabinet, too big to ignore)
        issues.push({
          rule: 'chain_gap',
          severity: gap > 6 ? 'error' : 'warning',
          message: `Wall ${wall.wallId}: ${gap.toFixed(1)}" gap between ${curr.sku || curr.applianceType} and ${next.sku || next.applianceType} at position ${currEnd.toFixed(1)}"`,
          wall: wall.wallId,
          position: currEnd,
          fix: gap <= 3 ? `Insert overlay filler (OVF)` : gap <= 6 ? `Insert strip filler (F${Math.ceil(gap)}30)` : `Widen ${curr.sku} by ${gap.toFixed(1)}" (MOD WIDTH)`,
        });
      }
    }

    // Wall boundary check
    if (cabs.length > 0) {
      const first = cabs[0];
      const last = cabs[cabs.length - 1];
      const lastEnd = last.position + last.width;

      if (first.position < -0.5) {
        issues.push({
          rule: 'wall_underflow',
          severity: 'error',
          message: `Wall ${wall.wallId}: first cabinet ${first.sku} starts at ${first.position}" (before wall start)`,
          wall: wall.wallId,
          position: first.position,
        });
      }

      if (lastEnd > wall.wallLength + 0.5) {
        issues.push({
          rule: 'wall_overflow',
          severity: 'error',
          message: `Wall ${wall.wallId}: cabinets extend to ${lastEnd.toFixed(1)}" but wall is only ${wall.wallLength}"`,
          wall: wall.wallId,
          position: lastEnd,
          fix: `Shrink last cabinet or remove ${(lastEnd - wall.wallLength).toFixed(1)}" of width`,
        });
      }
    }
  }

  return issues;
}


// ─── MOLDING PATH VALIDATION ───────────────────────────────────

/**
 * Validate crown molding path — must be continuous along upper runs
 * but MUST SKIP hood/microwave zones (no intersect rule).
 *
 * Returns the correct molding segments (path-based extrusion).
 */
export function validateCrownMoldingPath(upperLayouts, accessories) {
  const issues = [];
  const correctedPaths = [];

  for (const ul of upperLayouts) {
    const cabs = (ul.cabinets || [])
      .filter(c => typeof c.position === 'number' && c.width > 0)
      .sort((a, b) => a.position - b.position);

    if (cabs.length === 0) continue;

    // Identify skip zones (hoods, microwaves, appliances)
    const skipZones = [];
    for (const cab of cabs) {
      const role = cab.role || cab.type || '';
      const isHood = role === 'range_hood' || role === 'rangeHood' || cab.type === 'rangeHood';
      const isMicro = cab.applianceType === 'microwave';
      if (isHood || isMicro) {
        skipZones.push({
          start: cab.position,
          end: cab.position + (cab.width || 0),
          type: isHood ? 'hood' : 'microwave',
        });
      }
    }

    // Build continuous segments that skip appliance zones
    const cabinetCabs = cabs.filter(c => {
      const role = c.role || c.type || '';
      const isHood = role === 'range_hood' || role === 'rangeHood' || c.type === 'rangeHood';
      const isMicro = c.applianceType === 'microwave';
      return !isHood && !isMicro;
    });

    if (cabinetCabs.length === 0) continue;

    // Build path segments — each segment is a continuous run of cabinets
    const segments = [];
    let segStart = null;
    let segEnd = null;

    for (const cab of cabinetCabs) {
      const cabStart = cab.position;
      const cabEnd = cab.position + (cab.width || 0);

      // Check if this cab is in a skip zone
      const inSkip = skipZones.some(sz =>
        cabStart < sz.end && cabEnd > sz.start
      );
      if (inSkip) continue;

      if (segStart === null) {
        segStart = cabStart;
        segEnd = cabEnd;
      } else if (cabStart <= segEnd + 0.5) {
        // Continuous — extend segment
        segEnd = Math.max(segEnd, cabEnd);
      } else {
        // Gap — start new segment
        segments.push({ start: segStart, end: segEnd, wall: ul.wallId });
        segStart = cabStart;
        segEnd = cabEnd;
      }
    }
    if (segStart !== null) {
      segments.push({ start: segStart, end: segEnd, wall: ul.wallId });
    }

    correctedPaths.push({
      wall: ul.wallId,
      segments,
      skipZones,
    });

    // Check if current crown molding (in accessories) spans a skip zone
    const crownAcc = (accessories || []).find(a =>
      a.subrole === 'crown-moulding' || a.subrole === 'crown'
    );
    if (crownAcc && skipZones.length > 0) {
      // If crown is a single linear-foot number spanning the whole wall,
      // it's NOT path-aware — it would clip through hoods
      const totalCabWidth = cabinetCabs.reduce((s, c) => s + (c.width || 0), 0);
      const totalUpperWidth = cabs.reduce((s, c) => s + (c.width || 0), 0);

      if (crownAcc.linearFeet && Math.abs(crownAcc.linearFeet - totalUpperWidth) < 2) {
        issues.push({
          rule: 'crown_spans_hood',
          severity: 'error',
          message: `Crown molding on wall ${ul.wallId} spans ${crownAcc.linearFeet}" including ${skipZones.length} hood/appliance zone(s). Crown must terminate before hoods and restart after.`,
          wall: ul.wallId,
          fix: `Use path-based extrusion: ${segments.length} segment(s) totaling ${totalCabWidth}" (not ${totalUpperWidth}")`,
        });
      }
    }
  }

  return { issues, correctedPaths };
}

/**
 * Validate light rail path — same rules as crown but at bottom of uppers.
 * Must skip hoods and microwaves.
 */
export function validateLightRailPath(upperLayouts) {
  const issues = [];
  const correctedPaths = [];

  for (const ul of upperLayouts) {
    const cabs = (ul.cabinets || [])
      .filter(c => typeof c.position === 'number' && c.width > 0)
      .sort((a, b) => a.position - b.position);

    if (cabs.length === 0) continue;

    // Real wall cabinets (light rail goes under these)
    const wallCabs = [];
    // Skip zones (hoods, microwaves)
    const skipZones = [];

    for (const cab of cabs) {
      const role = cab.role || cab.type || '';
      const isHood = role === 'range_hood' || role === 'rangeHood' || cab.type === 'rangeHood';
      const isMicro = cab.applianceType === 'microwave';
      if (isHood || isMicro) {
        skipZones.push({
          start: cab.position,
          end: cab.position + (cab.width || 0),
          type: isHood ? 'hood' : 'microwave',
        });
      } else {
        wallCabs.push(cab);
      }
    }

    // Build continuous path segments
    const segments = [];
    let segStart = null, segEnd = null;

    for (const cab of wallCabs) {
      const s = cab.position;
      const e = cab.position + (cab.width || 0);

      if (segStart === null) {
        segStart = s; segEnd = e;
      } else if (s <= segEnd + 0.5) {
        segEnd = Math.max(segEnd, e);
      } else {
        segments.push({ start: segStart, end: segEnd, wall: ul.wallId });
        segStart = s; segEnd = e;
      }
    }
    if (segStart !== null) {
      segments.push({ start: segStart, end: segEnd, wall: ul.wallId });
    }

    correctedPaths.push({ wall: ul.wallId, segments, skipZones });
  }

  return { issues, correctedPaths };
}


// ─── TRIM COLLISION DETECTION ──────────────────────────────────

/**
 * No-Intersect Rule: trim must never exist inside a cabinet's bounding box.
 * Crown → must be at Z = CabinetTop, Y ≥ CabinetDepth (front face or beyond)
 * Light Rail → must be at Z ≤ CabinetBottom, Y ≥ CabinetDepth - 0.5"
 * Toe Kick → must be at Z < 4.5", Y between 0 and CabinetDepth
 */
export function validateTrimCollisions(cabBoxes, moldingBoxes) {
  const issues = [];

  for (const trim of moldingBoxes) {
    for (const cab of cabBoxes) {
      // Same wall check
      if (trim.wall && cab.wall && trim.wall !== cab.wall) continue;

      const overlap = boxesOverlap(trim, cab);
      if (overlap > 0.1) { // more than 0.1 cubic inch overlap
        issues.push({
          rule: 'trim_inside_cabinet',
          severity: 'error',
          message: `Trim ${trim.id} collides with cabinet ${cab.id} on wall ${cab.wall} (${overlap.toFixed(1)} cu.in. overlap). Trim must be OUTSIDE cabinet bounding box.`,
          wall: cab.wall,
          position: Math.max(trim.xMin, cab.xMin),
          fix: `Push ${trim.id} to exterior face: Z=${cab.zMax}" (top) or Z=${cab.zMin - 3}" (bottom)`,
        });
      }
    }
  }

  return issues;
}


// ─── COMPONENT HIERARCHY ───────────────────────────────────────

/**
 * Validate parent/child relationships:
 * - Cabinets are Parents
 * - Moldings, hardware, end panels are Children
 * - Children must inherit exterior coordinates of Parent
 *
 * This catches cases where a child (e.g., crown molding) is placed
 * relative to a center point instead of an exterior face.
 */
export function validateComponentHierarchy(wallLayouts, upperLayouts, accessories) {
  const issues = [];

  // Check that crown molding Z-base === upper cabinet Z-top
  for (const ul of upperLayouts) {
    const cabs = (ul.cabinets || []).filter(c =>
      c.type === 'wall' || c.type === 'wall_stacked_display' || c.type === 'refrigerator_wall'
    );
    if (cabs.length === 0) continue;

    // Get the actual upper cabinet top Z from _elev data
    for (const cab of cabs) {
      const elev = cab._elev || {};
      const cabTop = (elev.yMount || 54) + (elev.height || cab.height || 39);
      const cabDepth = elev.depth || cab.depth || 13;

      // Crown should be at Z = cabTop, not Z = cabTop - something
      if (cab._crownZ != null && Math.abs(cab._crownZ - cabTop) > 1) {
        issues.push({
          rule: 'crown_not_at_cab_top',
          severity: 'warning',
          message: `Crown molding Z=${cab._crownZ}" doesn't match cabinet top Z=${cabTop}" for ${cab.sku} on wall ${ul.wallId}`,
          wall: ul.wallId,
          fix: `Set crown base to Z=${cabTop}"`,
        });
      }
    }
  }

  // Check end panels are at cabinet exterior, not interior
  for (const wl of wallLayouts) {
    const panels = (wl.cabinets || []).filter(c => c.type === 'end_panel');
    const baseCabs = (wl.cabinets || []).filter(c => c.type === 'base' || c.type === 'appliance');

    for (const panel of panels) {
      if (panel.side === 'left') {
        // Left panel should be at or before the first base cabinet
        const firstBase = baseCabs.sort((a, b) => a.position - b.position)[0];
        if (firstBase && panel.position > firstBase.position + 1) {
          issues.push({
            rule: 'end_panel_inside_run',
            severity: 'warning',
            message: `Left end panel at ${panel.position}" is inside cabinet run (first base at ${firstBase.position}")`,
            wall: wl.wallId,
          });
        }
      }
    }
  }

  return issues;
}


// ─── WORK TRIANGLE (NKBA) ─────────────────────────────────────

/**
 * NKBA work triangle validation.
 * Each leg: 48" to 108"
 * Total: 144" to 312"
 * Center-front of each appliance measured.
 */
export function validateWorkTriangle(wallLayouts) {
  const appliances = [];

  for (const wall of wallLayouts) {
    for (const cab of (wall.cabinets || [])) {
      if (cab.type === 'appliance') {
        appliances.push({
          type: cab.applianceType,
          position: cab.position,
          width: cab.width,
          wall: wall.wallId,
          centerX: cab.position + (cab.width || 0) / 2,
        });
      }
    }
  }

  const sink = appliances.find(a => a.type === 'sink');
  const range = appliances.find(a => a.type === 'range' || a.type === 'cooktop');
  const fridge = appliances.find(a => a.type === 'refrigerator');

  if (!sink || !range || !fridge) {
    return [{
      rule: 'work_triangle_incomplete',
      severity: 'warning',
      message: `Missing appliance(s): ${!sink ? 'sink ' : ''}${!range ? 'range ' : ''}${!fridge ? 'fridge' : ''}`,
    }];
  }

  const issues = [];

  // Distance calculation (same wall = direct, different walls = Manhattan through corner)
  const dist = (a, b) => {
    if (a.wall === b.wall) return Math.abs(a.centerX - b.centerX);
    return a.centerX + b.centerX; // Manhattan through corner
  };

  const sinkToRange = dist(sink, range);
  const rangeToFridge = dist(range, fridge);
  const fridgeToSink = dist(fridge, sink);
  const total = sinkToRange + rangeToFridge + fridgeToSink;

  const checkLeg = (name, value) => {
    if (value < 48) issues.push({ rule: 'work_triangle_leg_short', severity: 'warning', message: `${name} leg is ${value}" (NKBA minimum: 48")` });
    if (value > 108) issues.push({ rule: 'work_triangle_leg_long', severity: 'warning', message: `${name} leg is ${value}" (NKBA maximum: 108")` });
  };

  checkLeg('Sink→Range', Math.round(sinkToRange));
  checkLeg('Range→Fridge', Math.round(rangeToFridge));
  checkLeg('Fridge→Sink', Math.round(fridgeToSink));

  if (total < 144) issues.push({ rule: 'work_triangle_small', severity: 'error', message: `Work triangle total ${Math.round(total)}" < 144" (12') minimum` });
  if (total > 312) issues.push({ rule: 'work_triangle_large', severity: 'error', message: `Work triangle total ${Math.round(total)}" > 312" (26') maximum` });

  return issues;
}


// ─── MASTER VALIDATION ─────────────────────────────────────────

/**
 * Run ALL spatial validations on the complete solver output.
 *
 * @param {Object} solverOutput — the full return from solve()
 * @returns {{ passed: boolean, errors: Issue[], warnings: Issue[], summary: string }}
 */
export function validateSpatialLayout(solverOutput) {
  const {
    walls: wallLayouts = [],
    uppers: upperLayouts = [],
    corners = [],
    accessories = [],
    talls = [],
  } = solverOutput;

  const allIssues = [];

  // 1. Corner anchor integrity
  allIssues.push(...validateCornerAnchoring(wallLayouts, corners));

  // 2. Cabinet chain integrity (all walls)
  allIssues.push(...validateCabinetChains(wallLayouts));

  // 3. Crown molding path (skip hoods)
  const crownResult = validateCrownMoldingPath(upperLayouts, accessories);
  allIssues.push(...crownResult.issues);

  // 4. Light rail path (skip hoods)
  const lrResult = validateLightRailPath(upperLayouts);
  allIssues.push(...lrResult.issues);

  // 5. Component hierarchy
  allIssues.push(...validateComponentHierarchy(wallLayouts, upperLayouts, accessories));

  // 6. Work triangle
  allIssues.push(...validateWorkTriangle(wallLayouts));

  // Separate errors and warnings
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    infos,
    crownPaths: crownResult.correctedPaths,
    lightRailPaths: lrResult.correctedPaths,
    summary: `${errors.length} error(s), ${warnings.length} warning(s)${errors.length === 0 ? ' — PASSED' : ' — FAILED'}`,
  };
}


// ─── CORNER-FIRST SEQUENCING HELPER ────────────────────────────

/**
 * Given corner definitions, compute the exact anchor coordinates
 * that adjacent cabinets must chain from.
 *
 * Returns a map: wallId → { leftAnchor, rightAnchor }
 * where leftAnchor is the X position where the first cabinet must start
 * and rightAnchor is where the last cabinet must end.
 */
export function computeCornerAnchors(walls, corners) {
  const anchors = {};

  for (const wall of walls) {
    anchors[wall.id] = {
      leftAnchor: 0,
      rightAnchor: wall.length,
      leftCorner: null,
      rightCorner: null,
    };
  }

  for (const corner of corners) {
    // Wall A: corner consumes from the right
    if (anchors[corner.wallA]) {
      anchors[corner.wallA].rightAnchor = anchors[corner.wallA].rightAnchor - corner.wallAConsumption;
      anchors[corner.wallA].rightCorner = corner;
    }
    // Wall B: corner consumes from the left
    if (anchors[corner.wallB]) {
      anchors[corner.wallB].leftAnchor = corner.wallBConsumption;
      anchors[corner.wallB].leftCorner = corner;
    }
  }

  return anchors;
}


/**
 * Build molding path segments for the renderer.
 * Returns segments that respect skip zones (hoods, appliances).
 *
 * The renderer should draw one <rect> or <path> per segment,
 * NOT one giant rect spanning min-to-max of all uppers.
 */
export function buildMoldingPathSegments(upperCabs, type = 'crown') {
  const sorted = [...upperCabs]
    .filter(c => typeof c.position === 'number' && c.width > 0)
    .sort((a, b) => a.position - b.position);

  if (sorted.length === 0) return [];

  // Identify skip zones
  const skipTypes = new Set(['range_hood', 'rangeHood']);
  const segments = [];
  let segStart = null, segEnd = null;

  for (const cab of sorted) {
    const role = cab.role || cab.type || '';
    const isHood = skipTypes.has(role) || cab.type === 'rangeHood';
    const isMicro = cab.applianceType === 'microwave';
    const shouldSkip = isHood || isMicro;

    if (shouldSkip) {
      // Close current segment
      if (segStart !== null) {
        segments.push({ start: segStart, end: segEnd });
        segStart = null;
        segEnd = null;
      }
      continue;
    }

    const s = cab.position;
    const e = cab.position + (cab.width || 0);

    if (segStart === null) {
      segStart = s;
      segEnd = e;
    } else if (s <= segEnd + 0.5) {
      segEnd = Math.max(segEnd, e);
    } else {
      segments.push({ start: segStart, end: segEnd });
      segStart = s;
      segEnd = e;
    }
  }

  if (segStart !== null) {
    segments.push({ start: segStart, end: segEnd });
  }

  return segments;
}
