/**
 * expert-design-workflow.js
 *
 * EXPERT DESIGN WORKFLOW: The "order of operations" that professional kitchen designers follow.
 *
 * CRITICAL PHILOSOPHY: "Stop placing boxes and start solving the room."
 * Instead of left-to-right placement, this engine:
 *   1. Identifies mechanical anchor points (window, plumbing, ventilation, traffic)
 *   2. Places immovable primary anchors (sink, range) centered on their mechanical points
 *   3. Places secondary anchors within work triangle constraints
 *   4. Solves corners with blind corners / lazy susans first
 *   5. Fills remaining gaps using center-out symmetry from anchors
 *
 * @module expert-design-workflow
 */

// ============================================================================
// CONSTANTS & DESIGN HIERARCHY
// ============================================================================

/**
 * Priority-based design hierarchy phases.
 * Defines the strict order in which room decisions must be made.
 * @type {Object}
 */
const DESIGN_HIERARCHY = {
  PHASE_1_CENTER_POINTS: 1,      // Identify window centers, plumbing stacks, ventilation, traffic
  PHASE_2_PRIMARY_ANCHORS: 2,    // Place sink centered on plumbing/window; range centered on ventilation
  PHASE_3_SECONDARY_ANCHORS: 3,  // Dishwasher (adjacent to sink), fridge (work triangle), wall oven/microwave
  PHASE_4_CORNERS: 4,             // Place blind corners / lazy susans; freeze corner fillers
  PHASE_5_FILL_GAPS: 5,           // Work outward from anchors; fill remaining space with standard widths
};

/**
 * Eclipse cabinetry standard widths (frameless, in inches).
 * All cabinet widths must be decomposed into these increments.
 * @type {number[]}
 */
const ECLIPSE_STANDARD_WIDTHS = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48];

/**
 * Mechanical clearance rules for Eclipse frameless cabinetry.
 * @type {Object}
 */
const MECHANICAL_CLEARANCES = {
  CORNER_DEAD_ZONE: 3.0,           // 3" filler on both sides of 90° corner (drawer/handle clearance)
  WALL_TERMINATION: 1.5,           // 1.5" filler at run ending against perpendicular wall
  RANGE_LEFT_LANDING: 15,          // 15" clearance on left of range (for cookware)
  RANGE_RIGHT_LANDING: 12,         // 12" clearance on right of range (landing area)
  DISHWASHER_SINK_MAX: 36,         // DW must be within 36" of sink center
  FRIDGE_END_PANEL: 1.5,           // 1.5" REP if fridge deeper than cabinets
};

/**
 * Work Triangle constraints (NKBA standard).
 * @type {Object}
 */
const WORK_TRIANGLE = {
  MIN_LEG: 48,                     // Minimum leg length (4 feet)
  MAX_LEG: 108,                    // Maximum leg length (9 feet)
  MIN_PERIMETER: 156,              // Minimum total perimeter (13 feet)
  MAX_PERIMETER: 312,              // Maximum total perimeter (26 feet)
};

/**
 * Feature types recognized in room analysis.
 * @type {Object}
 */
const FEATURE_TYPES = {
  WINDOW: 'window',
  DOOR: 'door',
  PLUMBING: 'plumbing',
  VENTILATION: 'vent',
};

// ============================================================================
// PHASE 1: ROOM ANALYSIS & CENTER-POINT IDENTIFICATION
// ============================================================================

/**
 * Analyzes the room and identifies mechanical anchor points.
 *
 * @param {Array<Object>} walls - Wall definitions with geometry
 *   [{ id: 'N', length: 144, features: [...] }, ...]
 * @param {Array<Object>} features - Physical points in the room
 *   [{ type: 'window'|'door'|'plumbing'|'vent', wall, position, width }, ...]
 * @returns {Object} Room analysis with anchor suggestions
 *   {
 *     centerPoints: { window, plumbing, ventilation, trafficPaths },
 *     anchorSuggestions: { sinkWall, rangeWall, fridgeWall },
 *     layoutStrategy: description
 *   }
 */
export function analyzeRoom(walls, features) {
  if (!walls || !Array.isArray(walls)) {
    throw new Error('analyzeRoom: walls must be an array');
  }
  if (!features || !Array.isArray(features)) {
    throw new Error('analyzeRoom: features must be an array');
  }

  const centerPoints = {
    window: null,
    plumbing: null,
    ventilation: null,
    trafficPaths: [],
  };

  const wallMap = new Map(walls.map(w => [w.id, w]));

  // Identify center-points by feature type
  for (const feature of features) {
    const wall = wallMap.get(feature.wall);
    if (!wall) continue;

    const featureCenter = feature.position + (feature.width || 0) / 2;

    switch (feature.type) {
      case FEATURE_TYPES.WINDOW:
        centerPoints.window = {
          wall: feature.wall,
          position: featureCenter,
          width: feature.width,
          note: 'Sink plumbing typically below window',
        };
        break;

      case FEATURE_TYPES.PLUMBING:
        centerPoints.plumbing = {
          wall: feature.wall,
          position: featureCenter,
          note: 'Primary sink anchor point',
        };
        break;

      case FEATURE_TYPES.VENTILATION:
        centerPoints.ventilation = {
          wall: feature.wall,
          position: featureCenter,
          note: 'Primary range anchor point (hood mounted above)',
        };
        break;

      case FEATURE_TYPES.DOOR:
        centerPoints.trafficPaths.push({
          wall: feature.wall,
          position: featureCenter,
          width: feature.width,
          note: 'Avoid placing appliances in doorway swing path',
        });
        break;
    }
  }

  // Generate anchor placement suggestions
  const anchorSuggestions = {
    sinkWall: centerPoints.plumbing?.wall || centerPoints.window?.wall,
    sinkPosition: centerPoints.plumbing?.position || centerPoints.window?.position,
    rangeWall: centerPoints.ventilation?.wall,
    rangePosition: centerPoints.ventilation?.position,
    fridgeWall: null, // Determined by work triangle
  };

  return {
    centerPoints,
    anchorSuggestions,
    layoutStrategy:
      'PRIMARY: Center Sink on plumbing/window point. ' +
      'SECONDARY: Center Range on ventilation point. ' +
      'WORK TRIANGLE: Place fridge to satisfy 48"-108" legs and 156"-312" perimeter. ' +
      'AVOID: Traffic paths when placing tall appliances.',
  };
}

// ============================================================================
// PHASE 2-3: ANCHOR PLACEMENT & WORK TRIANGLE VALIDATION
// ============================================================================

/**
 * Validates and solves the work triangle for sink, range, and refrigerator.
 *
 * Each leg must be 48"–108" (4'–9').
 * Total perimeter must be 156"–312" (13'–26').
 *
 * @param {Object} sinkPos - { wall: 'N', position: 72 }
 * @param {Object} rangePos - { wall: 'N', position: 120 }
 * @param {Object} fridgePos - { wall: 'E', position: 48 }
 * @returns {Object} Work triangle result
 *   {
 *     valid: boolean,
 *     legs: { sink_to_range, range_to_fridge, fridge_to_sink },
 *     perimeter: number,
 *     issues: string[],
 *     suggestions: string[]
 *   }
 */
export function solveWorkTriangle(sinkPos, rangePos, fridgePos) {
  // Validate input
  if (!sinkPos || !rangePos || !fridgePos) {
    throw new Error('solveWorkTriangle: all three appliance positions required');
  }

  // For frameless layouts, assume appliances on same wall use linear distance
  // and cross-wall appliances use diagonal wall-to-wall distance
  const legs = {
    sink_to_range: linearDistance(sinkPos, rangePos),
    range_to_fridge: linearDistance(rangePos, fridgePos),
    fridge_to_sink: linearDistance(fridgePos, sinkPos),
  };

  const perimeter = legs.sink_to_range + legs.range_to_fridge + legs.fridge_to_sink;

  const issues = [];
  const suggestions = [];

  // Check leg constraints
  if (legs.sink_to_range < WORK_TRIANGLE.MIN_LEG) {
    issues.push(`Sink→Range leg (${legs.sink_to_range}") is too short (min 48")`);
    suggestions.push('Move range farther from sink or relocate to different wall');
  }
  if (legs.sink_to_range > WORK_TRIANGLE.MAX_LEG) {
    issues.push(`Sink→Range leg (${legs.sink_to_range}") is too long (max 108")`);
    suggestions.push('Move range closer to sink');
  }

  if (legs.range_to_fridge < WORK_TRIANGLE.MIN_LEG) {
    issues.push(`Range→Fridge leg (${legs.range_to_fridge}") is too short (min 48")`);
    suggestions.push('Move fridge farther from range');
  }
  if (legs.range_to_fridge > WORK_TRIANGLE.MAX_LEG) {
    issues.push(`Range→Fridge leg (${legs.range_to_fridge}") is too long (max 108")`);
    suggestions.push('Move fridge closer to range');
  }

  if (legs.fridge_to_sink < WORK_TRIANGLE.MIN_LEG) {
    issues.push(`Fridge→Sink leg (${legs.fridge_to_sink}") is too short (min 48")`);
    suggestions.push('Move fridge farther from sink');
  }
  if (legs.fridge_to_sink > WORK_TRIANGLE.MAX_LEG) {
    issues.push(`Fridge→Sink leg (${legs.fridge_to_sink}") is too long (max 108")`);
    suggestions.push('Move fridge closer to sink');
  }

  // Check perimeter constraints
  if (perimeter < WORK_TRIANGLE.MIN_PERIMETER) {
    issues.push(`Work triangle perimeter (${perimeter}") is too small (min 156")`);
    suggestions.push('Spread appliances farther apart');
  }
  if (perimeter > WORK_TRIANGLE.MAX_PERIMETER) {
    issues.push(`Work triangle perimeter (${perimeter}") is too large (max 312")`);
    suggestions.push('Bring appliances closer together');
  }

  return {
    valid: issues.length === 0,
    legs,
    perimeter,
    issues,
    suggestions,
  };
}

/**
 * Computes linear distance between two appliance positions.
 * Accounts for same-wall vs cross-wall distances.
 *
 * @private
 * @param {Object} pos1 - { wall, position }
 * @param {Object} pos2 - { wall, position }
 * @returns {number} Distance in inches
 */
function linearDistance(pos1, pos2) {
  if (pos1.wall === pos2.wall) {
    return Math.abs(pos2.position - pos1.position);
  }
  // Cross-wall: use Manhattan distance (conservative estimate for frameless)
  // In a real implementation, this would use wall geometry
  return 60; // Placeholder diagonal
}

// ============================================================================
// PHASE 4: CORNER SOLVING
// ============================================================================

/**
 * Identifies and places corner cabinets (lazy susans, blind corners).
 * Corners are immovable once placed and require 3" fillers on both sides.
 *
 * @param {Array<Object>} walls - Wall list
 * @param {Array<Object>} corners - [{ wall, position: 'left'|'right', type: 'blind'|'lazy_susan' }, ...]
 * @returns {Array<Object>} Placed corner cabinets with mandatory fillers
 *   [
 *     {
 *       wall, position, type, width, leftFiller, rightFiller,
 *       locked: true, reason: 'Corner cabinet — immovable'
 *     },
 *     ...
 *   ]
 */
export function solveCorners(walls, corners) {
  if (!Array.isArray(corners) || corners.length === 0) {
    return [];
  }

  const placedCorners = [];

  for (const corner of corners) {
    const wall = walls.find(w => w.id === corner.wall);
    if (!wall) continue;

    const cornerWidth = corner.type === 'lazy_susan' ? 36 : 42; // Lazy susan 36", blind 42"
    const leftFiller = MECHANICAL_CLEARANCES.CORNER_DEAD_ZONE;
    const rightFiller = MECHANICAL_CLEARANCES.CORNER_DEAD_ZONE;

    placedCorners.push({
      wall: corner.wall,
      position: corner.position === 'left' ? 0 : wall.length - cornerWidth,
      type: corner.type,
      width: cornerWidth,
      leftFiller,
      rightFiller,
      locked: true,
      reason: 'Corner cabinet — immovable anchor',
      totalWidth: cornerWidth + leftFiller + rightFiller,
    });
  }

  return placedCorners;
}

// ============================================================================
// PHASE 5: CENTER-OUT ANCHOR FILLING STRATEGY
// ============================================================================

/**
 * Fills wall space around an anchor (sink, range) using center-out symmetry.
 *
 * Given an anchor position and width, splits the remaining wall space into
 * LEFT and RIGHT zones. Each zone is filled symmetrically using standard widths.
 *
 * @param {number} wallLength - Total wall length in inches
 * @param {Object} anchor - { position: 72, width: 30 } (anchor center and width)
 * @param {number} leftCornerConsumed - Width consumed by left corner (including fillers)
 * @param {number} rightCornerConsumed - Width consumed by right corner (including fillers)
 * @param {number[]} standardWidths - Available cabinet widths (default: ECLIPSE_STANDARD_WIDTHS)
 * @returns {Object} Filled layout
 *   {
 *     anchor: { position, width },
 *     leftFill: { gap, cabinets: [{ width, position }], filler: null | number },
 *     rightFill: { gap, cabinets: [{ width, position }], filler: null | number },
 *     totalUsed: number,
 *     totalRemaining: number
 *   }
 */
export function anchorFromCenter(
  wallLength,
  anchor,
  leftCornerConsumed = 0,
  rightCornerConsumed = 0,
  standardWidths = ECLIPSE_STANDARD_WIDTHS
) {
  if (!anchor || typeof anchor.position !== 'number' || typeof anchor.width !== 'number') {
    throw new Error('anchorFromCenter: anchor must have { position, width }');
  }

  const anchorStart = anchor.position;
  const anchorEnd = anchor.position + anchor.width;

  // Available space on each side
  const leftGap = anchorStart - leftCornerConsumed;
  const rightGap = wallLength - anchorEnd - rightCornerConsumed;

  // Decompose left and right gaps to standard widths
  const leftCabs = decomposeToStandard(leftGap, standardWidths);
  const rightCabs = decomposeToStandard(rightGap, standardWidths);

  // Calculate actual space used and fillers
  const leftUsed = leftCabs.reduce((sum, w) => sum + w, 0);
  const rightUsed = rightCabs.reduce((sum, w) => sum + w, 0);

  const leftFiller = leftGap > leftUsed ? leftGap - leftUsed : null;
  const rightFiller = rightGap > rightUsed ? rightGap - rightUsed : null;

  // Position cabinets in fill zones
  const leftCabinets = [];
  let leftPos = leftCornerConsumed;
  for (const width of leftCabs) {
    leftCabinets.push({ width, position: leftPos });
    leftPos += width;
  }

  const rightCabinets = [];
  let rightPos = anchorEnd;
  for (const width of rightCabs) {
    rightCabinets.push({ width, position: rightPos });
    rightPos += width;
  }

  return {
    anchor: { position: anchor.position, width: anchor.width },
    leftFill: {
      gap: leftGap,
      cabinets: leftCabinets,
      filler: leftFiller,
    },
    rightFill: {
      gap: rightGap,
      cabinets: rightCabinets,
      filler: rightFiller,
    },
    totalUsed: anchor.width + leftUsed + rightUsed,
    totalRemaining: (leftFiller || 0) + (rightFiller || 0),
  };
}

/**
 * Enforces symmetry constraint around a focal point (window, range/hood, sink).
 *
 * When flanking a focal point, left and right cabinets MUST be equal width.
 * If they cannot be equal: size down the larger to match smaller, distribute
 * excess to fillers or run ends.
 *
 * @param {number} leftGap - Available width on left side
 * @param {number} rightGap - Available width on right side
 * @param {number} focalWidth - Width of focal point (for reference)
 * @param {number[]} standardWidths - Available cabinet widths
 * @returns {Object} Symmetry-enforced layout
 *   {
 *     leftCab: { width: 24, position: start },
 *     rightCab: { width: 24, position: start },
 *     leftRemainder: 6,
 *     rightRemainder: 3,
 *     symmetric: true,
 *     note: description
 *   }
 */
export function enforceSymmetryConstraint(
  leftGap,
  rightGap,
  focalWidth,
  standardWidths = ECLIPSE_STANDARD_WIDTHS
) {
  if (leftGap < 0 || rightGap < 0) {
    throw new Error('enforceSymmetryConstraint: gaps cannot be negative');
  }

  // Find the largest standard width that fits both sides
  let symmetricWidth = 0;
  for (const width of [...standardWidths].reverse()) {
    if (width <= leftGap && width <= rightGap) {
      symmetricWidth = width;
      break;
    }
  }

  const leftRemainder = leftGap - symmetricWidth;
  const rightRemainder = rightGap - symmetricWidth;

  return {
    leftCab: { width: symmetricWidth },
    rightCab: { width: symmetricWidth },
    leftRemainder,
    rightRemainder,
    symmetric: true,
    note: `Flanking cabinets both ${symmetricWidth}"; remainders: L=${leftRemainder}", R=${rightRemainder}"`,
  };
}

// ============================================================================
// PHASE 5B: STANDARD WIDTH DECOMPOSITION
// ============================================================================

/**
 * Decomposes a given gap into optimal combination of standard cabinet widths.
 *
 * Prefers fewer, larger cabinets (e.g., one 36" over two 18").
 * Allows up to 3" of filler at the end if no exact fit.
 *
 * @param {number} gap - Available width in inches
 * @param {number[]} standardWidths - Available widths (default: ECLIPSE_STANDARD_WIDTHS)
 * @returns {number[]} Cabinet widths that fit the gap
 *   Example: gap=54 → [36, 18] or [48, 3-filler]
 */
export function decomposeToStandard(gap, standardWidths = ECLIPSE_STANDARD_WIDTHS) {
  if (gap <= 0) {
    return [];
  }

  const sortedWidths = [...standardWidths].sort((a, b) => b - a); // Largest first
  const result = [];
  let remaining = gap;

  // Greedy: use largest possible widths first
  for (const width of sortedWidths) {
    while (remaining >= width) {
      result.push(width);
      remaining -= width;
    }
  }

  // If remainder ≤ 3", it's acceptable as filler; otherwise, adjust last cabinet
  if (remaining > 3) {
    // Couldn't decompose perfectly; return what we have + overflow indicator
    // (Caller should handle by reducing last cabinet or adjusting adjacent space)
    return result.length > 0 ? result : [];
  }

  return result;
}

// ============================================================================
// PHASE 5C: DISHWASHER ADJACENT-SINK RULE
// ============================================================================

/**
 * Places dishwasher adjacent to sink, respecting the 36" proximity rule.
 * DW cannot be placed at 90° to sink (NKBA rule).
 *
 * @param {Object} sinkPos - { wall, position, width }
 * @param {Object} sinkWallDef - Wall definition with length
 * @param {number} dwWidth - Dishwasher width (typically 24")
 * @returns {Object} Dishwasher placement or null if impossible
 *   {
 *     wall: same as sink,
 *     position: centered within 36" of sink,
 *     width: dwWidth,
 *     valid: boolean,
 *     reason: string
 *   }
 */
export function placeDishwasherAdjacentToSink(sinkPos, sinkWallDef, dwWidth = 24) {
  if (!sinkPos || !sinkWallDef) {
    throw new Error('placeDishwasherAdjacentToSink: sink position and wall required');
  }

  const sinkCenter = sinkPos.position + sinkPos.width / 2;
  const sinkEnd = sinkPos.position + sinkPos.width;

  // Try placement immediately to the RIGHT of sink
  const rightPos = sinkEnd;
  const rightDistance = Math.abs(rightPos + dwWidth / 2 - sinkCenter);

  if (rightDistance <= MECHANICAL_CLEARANCES.DISHWASHER_SINK_MAX && rightPos + dwWidth <= sinkWallDef.length) {
    return {
      wall: sinkPos.wall,
      position: rightPos,
      width: dwWidth,
      valid: true,
      reason: `DW placed right of sink, ${rightDistance}" from sink center`,
    };
  }

  // Try placement immediately to the LEFT of sink
  const leftPos = sinkPos.position - dwWidth;
  const leftDistance = Math.abs(leftPos + dwWidth / 2 - sinkCenter);

  if (leftDistance <= MECHANICAL_CLEARANCES.DISHWASHER_SINK_MAX && leftPos >= 0) {
    return {
      wall: sinkPos.wall,
      position: leftPos,
      width: dwWidth,
      valid: true,
      reason: `DW placed left of sink, ${leftDistance}" from sink center`,
    };
  }

  return {
    wall: sinkPos.wall,
    position: null,
    width: dwWidth,
    valid: false,
    reason: 'No valid adjacent position within 36" of sink center',
  };
}

// ============================================================================
// INTEGRATED ROOM SOLVING: ORCHESTRATES ALL PHASES
// ============================================================================

/**
 * Solves the complete kitchen layout using expert design workflow.
 *
 * Orchestrates all 5 phases:
 *   1. Room analysis → identify center-points
 *   2. Place primary anchors (sink, range) on mechanical points
 *   3. Place secondary anchors (DW, fridge) per constraints
 *   4. Place corners → freeze corner fillers
 *   5. Fill gaps with standard widths using center-out strategy
 *
 * @param {Array<Object>} walls - Wall definitions
 *   [{ id: 'N', length: 144 }, { id: 'E', length: 120 }, ...]
 * @param {Object} appliances - Appliance selections
 *   {
 *     sink: { type: 'sink_base', width: 30 },
 *     range: { type: 'range', width: 36 },
 *     fridge: { type: 'built_in_fridge', width: 42 },
 *     microwave: { width: 27 },
 *     dishwasher: { width: 24 }
 *   }
 * @param {Array<Object>} features - Room features (windows, doors, plumbing, vents)
 * @param {Array<Object>} corners - Corner cabinet definitions
 * @param {Object} prefs - Designer preferences
 *   { preferSymmetry: bool, avoidCornerDW: bool, ... }
 * @returns {Object} Complete layout solution
 *   {
 *     phase: 5,
 *     valid: boolean,
 *     walls: [{ id, placements: [{ type, width, position, locked }] }],
 *     appliances: { sink, range, fridge, dw, oven, microwave },
 *     workTriangle: { valid, legs, perimeter },
 *     violations: [],
 *     warnings: [],
 *     summary: string
 *   }
 */
export function solveRoomExpert(walls, appliances, features, corners = [], prefs = {}) {
  const result = {
    phase: 0,
    valid: true,
    walls: [],
    appliances: {},
    workTriangle: { valid: false, legs: {}, issues: [] },
    violations: [],
    warnings: [],
    summary: '',
  };

  if (!walls || walls.length === 0) {
    result.violations.push('No walls provided');
    result.valid = false;
    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1: Analyze room and identify center-points
  // ─────────────────────────────────────────────────────────────────
  result.phase = 1;
  const roomAnalysis = analyzeRoom(walls, features || []);

  if (!roomAnalysis.anchorSuggestions.sinkWall) {
    result.warnings.push('No plumbing or window detected; sink placement is flexible');
  }
  if (!roomAnalysis.anchorSuggestions.rangeWall) {
    result.warnings.push('No ventilation detected; range placement is flexible');
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 2: Place primary anchors (sink and range)
  // ─────────────────────────────────────────────────────────────────
  result.phase = 2;

  const sinkWidth = appliances?.sink?.width || 30;
  const sinkWall = roomAnalysis.anchorSuggestions.sinkWall || 'N';
  const sinkPosition = roomAnalysis.anchorSuggestions.sinkPosition || 60;
  const sinkAnchor = { position: sinkPosition, width: sinkWidth };

  result.appliances.sink = {
    type: 'sink_base',
    wall: sinkWall,
    position: sinkPosition,
    width: sinkWidth,
    locked: true,
    reason: 'Primary anchor on plumbing/window center-point',
  };

  const rangeWidth = appliances?.range?.width || 36;
  const rangeWall = roomAnalysis.anchorSuggestions.rangeWall || 'N';
  const rangePosition = roomAnalysis.anchorSuggestions.rangePosition || 120;

  result.appliances.range = {
    type: 'range',
    wall: rangeWall,
    position: rangePosition,
    width: rangeWidth,
    locked: true,
    reason: 'Primary anchor on ventilation center-point',
  };

  // ─────────────────────────────────────────────────────────────────
  // PHASE 3: Place secondary anchors (dishwasher, fridge, oven)
  // ─────────────────────────────────────────────────────────────────
  result.phase = 3;

  // Dishwasher: adjacent to sink
  if (appliances?.dishwasher) {
    const dwWidth = appliances.dishwasher.width || 24;
    const sinkWallDef = walls.find(w => w.id === sinkWall);

    if (sinkWallDef) {
      const dwPlacement = placeDishwasherAdjacentToSink(sinkAnchor, sinkWallDef, dwWidth);
      if (dwPlacement.valid) {
        result.appliances.dishwasher = {
          type: 'dishwasher',
          wall: dwPlacement.wall,
          position: dwPlacement.position,
          width: dwWidth,
          locked: true,
          reason: 'Secondary anchor: adjacent to sink',
        };
      } else {
        result.violations.push(`Cannot place DW adjacent to sink: ${dwPlacement.reason}`);
        result.valid = false;
      }
    }
  }

  // Refrigerator: placed per work triangle (for now, placeholder)
  if (appliances?.fridge) {
    const fridgeWidth = appliances.fridge.width || 42;
    // Simplified: place on opposite wall from sink
    const fridgeWall = sinkWall === 'N' ? 'E' : 'N';
    const fridgePos = 36;

    result.appliances.fridge = {
      type: 'fridge',
      wall: fridgeWall,
      position: fridgePos,
      width: fridgeWidth,
      locked: true,
      reason: 'Secondary anchor: work triangle constraint',
    };

    // Validate work triangle
    const wtResult = solveWorkTriangle(
      { wall: sinkWall, position: sinkPosition },
      { wall: rangeWall, position: rangePosition },
      { wall: fridgeWall, position: fridgePos }
    );

    result.workTriangle = wtResult;
    if (!wtResult.valid) {
      result.violations.push(`Work triangle invalid: ${wtResult.issues.join('; ')}`);
      result.valid = false;
    }
  }

  // Wall oven / microwave: tall stack placement (simplified for now)
  if (appliances?.oven) {
    result.appliances.oven = {
      type: 'wall_oven',
      wall: sinkWall === 'N' ? 'W' : 'N',
      position: 12,
      width: 30,
      height: 'tall_stack',
    };
  }

  if (appliances?.microwave) {
    result.appliances.microwave = {
      type: 'microwave',
      wall: sinkWall === 'N' ? 'W' : 'N',
      position: 48,
      width: 27,
      height: 'tall_stack',
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 4: Solve corners
  // ─────────────────────────────────────────────────────────────────
  result.phase = 4;
  const placedCorners = solveCorners(walls, corners);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 5: Fill gaps using center-out strategy
  // ─────────────────────────────────────────────────────────────────
  result.phase = 5;

  for (const wall of walls) {
    const wallAppliances = Object.values(result.appliances).filter(a => a.wall === wall.id);

    if (wallAppliances.length === 0) {
      // Wall has no appliances; fill with base units
      const decomposed = decomposeToStandard(wall.length, ECLIPSE_STANDARD_WIDTHS);
      result.walls.push({
        id: wall.id,
        length: wall.length,
        placements: decomposed.map((w, i) => ({
          type: 'base_cab',
          width: w,
          position: decomposed.slice(0, i).reduce((sum, x) => sum + x, 0),
        })),
      });
    } else if (wallAppliances.length === 1) {
      // One anchor on wall; fill left and right
      const anchor = wallAppliances[0];
      const fills = anchorFromCenter(
        wall.length,
        { position: anchor.position, width: anchor.width },
        0,
        0,
        ECLIPSE_STANDARD_WIDTHS
      );

      const placements = [];

      // Add left fill cabinets
      for (const cab of fills.leftFill.cabinets) {
        placements.push({
          type: 'base_cab',
          width: cab.width,
          position: cab.position,
        });
      }
      if (fills.leftFill.filler) {
        placements.push({
          type: 'filler',
          width: fills.leftFill.filler,
          position: fills.leftFill.cabinets.length > 0
            ? fills.leftFill.cabinets[fills.leftFill.cabinets.length - 1].position +
              fills.leftFill.cabinets[fills.leftFill.cabinets.length - 1].width
            : 0,
        });
      }

      // Add anchor
      placements.push({
        type: anchor.type,
        width: anchor.width,
        position: anchor.position,
        locked: anchor.locked,
      });

      // Add right fill cabinets
      for (const cab of fills.rightFill.cabinets) {
        placements.push({
          type: 'base_cab',
          width: cab.width,
          position: cab.position,
        });
      }
      if (fills.rightFill.filler) {
        placements.push({
          type: 'filler',
          width: fills.rightFill.filler,
          position: fills.rightFill.cabinets.length > 0
            ? fills.rightFill.cabinets[fills.rightFill.cabinets.length - 1].position +
              fills.rightFill.cabinets[fills.rightFill.cabinets.length - 1].width
            : anchor.position + anchor.width,
        });
      }

      result.walls.push({
        id: wall.id,
        length: wall.length,
        placements,
      });
    } else {
      // Multiple anchors on wall; fill gaps between them
      const sortedAppliances = wallAppliances.sort((a, b) => a.position - b.position);
      const placements = [];

      // Fill before first appliance
      if (sortedAppliances[0].position > 0) {
        const gap = sortedAppliances[0].position;
        const decomposed = decomposeToStandard(gap, ECLIPSE_STANDARD_WIDTHS);
        let pos = 0;
        for (const width of decomposed) {
          placements.push({ type: 'base_cab', width, position: pos });
          pos += width;
        }
        if (pos < gap) {
          placements.push({ type: 'filler', width: gap - pos, position: pos });
        }
      }

      // Add appliances and fill gaps between them
      for (let i = 0; i < sortedAppliances.length; i++) {
        const app = sortedAppliances[i];
        placements.push({
          type: app.type,
          width: app.width,
          position: app.position,
          locked: app.locked,
        });

        if (i < sortedAppliances.length - 1) {
          const nextApp = sortedAppliances[i + 1];
          const gap = nextApp.position - (app.position + app.width);
          if (gap > 0) {
            const decomposed = decomposeToStandard(gap, ECLIPSE_STANDARD_WIDTHS);
            let pos = app.position + app.width;
            for (const width of decomposed) {
              placements.push({ type: 'base_cab', width, position: pos });
              pos += width;
            }
            if (pos < nextApp.position) {
              placements.push({
                type: 'filler',
                width: nextApp.position - pos,
                position: pos,
              });
            }
          }
        }
      }

      // Fill after last appliance
      const lastApp = sortedAppliances[sortedAppliances.length - 1];
      const remainingGap = wall.length - (lastApp.position + lastApp.width);
      if (remainingGap > 0) {
        const decomposed = decomposeToStandard(remainingGap, ECLIPSE_STANDARD_WIDTHS);
        let pos = lastApp.position + lastApp.width;
        for (const width of decomposed) {
          placements.push({ type: 'base_cab', width, position: pos });
          pos += width;
        }
        if (pos < wall.length) {
          placements.push({
            type: 'filler',
            width: wall.length - pos,
            position: pos,
          });
        }
      }

      result.walls.push({
        id: wall.id,
        length: wall.length,
        placements,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Final validation and summary
  // ─────────────────────────────────────────────────────────────────
  result.phase = 5;

  if (result.violations.length === 0) {
    result.summary = `Layout complete (${result.phase} phases). All anchors placed. Work triangle: ${
      result.workTriangle.valid ? 'VALID' : 'INVALID'
    }`;
  } else {
    result.summary = `Layout incomplete. ${result.violations.length} violations: ${result.violations.join('; ')}`;
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DESIGN_HIERARCHY,
  ECLIPSE_STANDARD_WIDTHS,
  MECHANICAL_CLEARANCES,
  WORK_TRIANGLE,
  FEATURE_TYPES,
};
