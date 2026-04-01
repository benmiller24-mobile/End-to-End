/**
 * snap-collision.js
 * Collision-Aware Snapping & Order-of-Operations Placement Logic
 * Eclipse Kitchen Cabinet Layout Engine (Frameless Cabinetry, C3 Catalog)
 *
 * Implements:
 * - Wall constraint (back-plane lock to y=0)
 * - Side-to-side snapping with zero-gap tolerance for frameless cabinets
 * - 3" snap grid alignment
 * - 8-phase corner-first placement order
 * - Cabinet object intelligence (doors, drawers, fillers, resize rules)
 * - Collision detection (physical overlap, door swing conflicts, handle clearance)
 * - Appliance-first resolution (sink, range, DW, fridge anchoring)
 * - Gap analysis for symmetry-aware fill
 *
 * @module snap-collision
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Strict 8-phase placement order for cabinet layout.
 * Each phase must complete before the next begins.
 * @type {string[]}
 */
export const PLACEMENT_ORDER = [
  'corners',           // Phase 1: 36" Lazy Susans or 42" Blind Corners
  'primary_anchor',    // Phase 2: Sink Base (centered on window/plumbing)
  'secondary_anchor',  // Phase 3: Range (centered on ventilation)
  'tertiary_anchor',   // Phase 4: DW adjacent to sink, Fridge per work triangle
  'tall_cabinets',     // Phase 5: Tall pantry, oven towers
  'base_fill',         // Phase 6: Fill remaining gaps with bases (center-out)
  'upper_align',       // Phase 7: Uppers aligned to base seams
  'accessories',       // Phase 8: End panels, fillers, moldings
];

/**
 * Snap behavior constants and tolerances.
 * @type {Object}
 */
export const SNAP_CONSTANTS = {
  // Grid alignment (all positions in 3" increments)
  GRID_SIZE: 3,
  GRID_POSITIONS: Array.from({ length: 17 }, (_, i) => i * 3), // 0, 3, 6, ..., 48

  // Frameless cabinet side-to-side gap (zero tolerance)
  FRAMELESS_GAP_TOLERANCE: 0.0,

  // Wall lock (back plane at y=0)
  WALL_Y_COORDINATE: 0,

  // Collision detection tolerances (inches)
  PHYSICAL_OVERLAP_TOLERANCE: 0.125, // 1/8" minimum clearance
  DOOR_SWING_BUFFER: 0.5,            // Buffer for door swing calculations
  HANDLE_CLEARANCE_BUFFER: 0.25,     // Extra margin for handles at corners

  // Appliance centering tolerance (inches)
  APPLIANCE_CENTER_TOLERANCE: 0.5,

  // Corner-blocking clearance (how far from corner to place cabinetry)
  CORNER_CLEARANCE: 1.5,
};

// ============================================================================
// CABINET INTELLIGENCE BUILDER
// ============================================================================

/**
 * Builds a comprehensive intelligence object for a cabinet SKU.
 * Contains all placement constraints, door/drawer behavior, and snap rules.
 *
 * @param {string} sku - Cabinet SKU (e.g., 'B30-RT', 'T36-LS')
 * @param {Object} position - Physical position { x, y, z, width, depth, height }
 * @param {Object} context - Application context with catalog data
 * @returns {Object} Cabinet intelligence object
 *
 * @example
 * const intel = buildCabinetIntelligence('B30-RT', { x: 0, width: 30 }, ctx);
 * // intel.doorSwing.arc = 90 degrees
 * // intel.snapBehavior = 'side-to-side'
 * // intel.fillerRequired = { left: false, right: false, corner: 3.0 }
 */
export function buildCabinetIntelligence(sku, position, context) {
  // Extract cabinet type from SKU (first char: B=base, T=tall, U=upper)
  const cabinetType = sku.charAt(0).toUpperCase();
  const isBase = cabinetType === 'B';
  const isTall = cabinetType === 'T';
  const isUpper = cabinetType === 'U';

  // Determine if this is a corner cabinet (LS=Lazy Susan, BC=Blind Corner)
  const isCorner = sku.includes('LS') || sku.includes('BC');
  const isLazySusan = sku.includes('LS');
  const isBlindCorner = sku.includes('BC');

  // Determine standard dimensions (frameless C3 catalog)
  const width = position.width || 30;
  const depth = position.depth || 24;
  const height = position.height || (isBase ? 30 : isTall ? 84 : 15);

  // Extract width range and increment rules
  const baseRange = isCorner ? { min: 36, max: 42, increment: 3 } : { min: 9, max: 48, increment: 3 };
  const heightRange = { min: 15, max: 84, increment: 3 };

  return {
    // Identification
    sku,
    cabinetType,
    isBase,
    isTall,
    isUpper,
    isCorner,
    isLazySusan,
    isBlindCorner,

    // Physical dimensions (frameless box)
    physicalBox: {
      width,
      depth,
      height,
    },

    // Door configuration (frameless with European hinges)
    doorSwing: {
      type: isCorner ? 'none' : 'single', // Corner cabinets have no swing
      hingeSide: determineHingeSide(sku, position),
      arc: isCorner ? 0 : 90, // Single-door swing = 90 degrees
      radius: width - 1, // Door swing radius ≈ cabinet width - 1"
      minClearance: 0, // Frameless hinges don't project
    },

    // Drawer extension behavior
    drawerExtension: {
      depth: depth - 2, // Drawer box is 2" less than cabinet depth
      count: Math.floor((height - 4) / 8), // ~8" per drawer
      fullExtension: true, // Modern soft-close extends fully
    },

    // Handle clearance (from front face, inward)
    handleClearance: 1.25,

    // Filler requirements
    fillerRequired: computeFillerRequirements(sku, width),

    // Snap behavior rules
    snapBehavior: 'side-to-side', // All frameless snap side-to-side
    snapGapTolerance: SNAP_CONSTANTS.FRAMELESS_GAP_TOLERANCE,

    // Resizing rules
    canResize: !isCorner, // Corner cabinets are fixed size
    minWidth: baseRange.min,
    maxWidth: baseRange.max,
    resizeIncrement: baseRange.increment,
    minHeight: heightRange.min,
    maxHeight: heightRange.max,
    heightIncrement: heightRange.increment,

    // Anchor type (for phase ordering)
    anchorType: getAnchorType(sku),

    // Placement phase
    placementPhase: determinePhase(sku),

    // Constraint rules
    constraints: {
      cantFloatFromWall: true, // Back plane locked to wall (y=0)
      requiresCornerCheck: isCorner,
      requiresDrawerClearanceCheck: isBase && !isCorner,
    },
  };
}

/**
 * Determines hinge side from SKU or position context.
 * Convention: RT = right, LT = left, DS = double (none)
 * @private
 */
function determineHingeSide(sku, position) {
  if (sku.includes('DS')) return 'double';
  if (sku.includes('LT')) return 'left';
  if (sku.includes('RT')) return 'right';
  // Default based on position: left if x < midpoint
  return position.x < 24 ? 'left' : 'right';
}

/**
 * Computes filler requirements based on cabinet type and width.
 * Returns object with boolean flags and dimensions.
 * @private
 */
function computeFillerRequirements(sku, width) {
  // Lazy Susans and Blind Corners always need corner fillers (3")
  if (sku.includes('LS') || sku.includes('BC')) {
    return {
      left: false,
      right: false,
      corner: 3.0, // 3" corner filler
    };
  }

  // Standard cabinets may need side fillers if non-standard width
  const isStandardWidth = width % 3 === 0 && width >= 9 && width <= 48;
  return {
    left: !isStandardWidth,
    right: !isStandardWidth,
    corner: 0,
  };
}

/**
 * Returns the anchor type for appliance-centric placement.
 * @private
 */
function getAnchorType(sku) {
  if (sku.includes('SINK')) return 'sink';
  if (sku.includes('RANGE')) return 'range';
  if (sku.includes('DW')) return 'dishwasher';
  if (sku.includes('FRIDGE')) return 'refrigerator';
  return 'none';
}

/**
 * Determines placement phase based on cabinet attributes.
 * @private
 */
function determinePhase(sku) {
  if (sku.includes('LS') || sku.includes('BC')) return 'corners';
  if (sku.includes('SINK')) return 'primary_anchor';
  if (sku.includes('RANGE')) return 'secondary_anchor';
  if (sku.includes('DW') || sku.includes('FRIDGE')) return 'tertiary_anchor';
  if (sku.charAt(0) === 'T') return 'tall_cabinets';
  if (sku.charAt(0) === 'U') return 'upper_align';
  if (sku.charAt(0) === 'B') return 'base_fill';
  return 'accessories';
}

// ============================================================================
// WALL CONSTRAINT (BACK-PLANE LOCK)
// ============================================================================

/**
 * Locks a cabinet's back plane to the wall coordinate (y=0).
 * Validates that cabinet depth doesn't exceed wall depth allowance.
 *
 * @param {Object} cabinet - Cabinet object with position and depth
 * @param {string} wallId - Wall identifier
 * @param {number} [wallDepthMax=24] - Maximum wall depth allowance (inches)
 * @returns {Object} Validated cabinet with y=0 lock applied
 *
 * @throws {Error} If cabinet depth exceeds wall depth allowance
 *
 * @example
 * const locked = lockToWall(cabinet, 'wall-north', 24);
 * // cabinet.position.y === 0 (locked)
 */
export function lockToWall(cabinet, wallId, wallDepthMax = 24) {
  // Validate cabinet has required properties
  if (!cabinet || !cabinet.position || typeof cabinet.position.y !== 'number') {
    throw new Error('Invalid cabinet: must have position.y');
  }

  const cabinetDepth = cabinet.position.depth || cabinet.physicalBox?.depth || 24;

  // Check depth constraint
  if (cabinetDepth > wallDepthMax) {
    throw new Error(
      `Cabinet depth (${cabinetDepth}") exceeds wall allowance (${wallDepthMax}")`
    );
  }

  // Lock to wall (set y=0, relative to wall)
  return {
    ...cabinet,
    position: {
      ...cabinet.position,
      y: SNAP_CONSTANTS.WALL_Y_COORDINATE,
    },
    wallId,
    lockedToWall: true,
  };
}

// ============================================================================
// SNAP TO GRID (3" INCREMENTS)
// ============================================================================

/**
 * Snaps a position to the nearest grid increment.
 * Standard grid: 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, ...
 * Appliances may be off-grid if centered on features.
 *
 * @param {number} position - Position to snap (inches from origin)
 * @param {number} [gridSize=3] - Grid size in inches (default 3")
 * @param {boolean} [force=true] - Force snap even if off-grid (true) or allow off-grid (false)
 * @returns {number} Snapped position
 *
 * @example
 * snapToGrid(5.2) // → 6 (nearest 3" increment)
 * snapToGrid(4.8) // → 3 (rounds to nearest)
 * snapToGrid(24.5) // → 24 (rounds down)
 */
export function snapToGrid(position, gridSize = SNAP_CONSTANTS.GRID_SIZE, force = true) {
  if (!force) return position; // Return as-is if not forcing snap

  // Round to nearest grid position
  const snapped = Math.round(position / gridSize) * gridSize;
  return snapped;
}

// ============================================================================
// SNAP TO NEIGHBOR (SIDE-TO-SIDE ZERO-GAP)
// ============================================================================

/**
 * Snaps a cabinet to the nearest existing cabinet edge.
 * In frameless cabinetry, gap = 0.0" (zero tolerance).
 * Tries both left and right snapping, returns closest valid position.
 *
 * @param {Object} cabinet - Cabinet to position
 * @param {Array<Object>} existingCabs - Array of already-positioned cabinets
 * @param {number} [wallLength=120] - Total wall length (inches)
 * @returns {Object} Cabinet with snapped position, or original if no neighbors
 *
 * @example
 * const snapped = snapToNeighbor(newCab, [cab1, cab2]);
 * // newCab.position.x now snaps to nearest cabinet edge with 0" gap
 */
export function snapToNeighbor(cabinet, existingCabs, wallLength = 120) {
  if (!existingCabs || existingCabs.length === 0) {
    return cabinet; // No neighbors to snap to
  }

  const cabinetWidth = cabinet.position.width || cabinet.physicalBox?.width || 30;
  const cabinetX = cabinet.position.x;

  // Find all potential snap edges from existing cabinets
  const snapEdges = [];

  for (const existingCab of existingCabs) {
    const existingX = existingCab.position.x;
    const existingWidth = existingCab.position.width || existingCab.physicalBox?.width || 30;

    // Right edge of existing cabinet (for snapping to its right)
    const rightEdge = existingX + existingWidth;
    snapEdges.push({
      position: rightEdge,
      source: 'right',
      neighbor: existingCab,
    });

    // Left edge of existing cabinet (for snapping to its left)
    snapEdges.push({
      position: existingX,
      source: 'left',
      neighbor: existingCab,
    });
  }

  // Add wall boundaries as snap targets
  snapEdges.push({ position: 0, source: 'wall-left' });
  snapEdges.push({ position: wallLength - cabinetWidth, source: 'wall-right' });

  // Find closest snap position
  let closestSnapEdge = null;
  let minDistance = Infinity;

  for (const edge of snapEdges) {
    // Snap position: new cabinet's left edge goes to this position
    let snapPosition = edge.position;

    // If snapping to right of neighbor, shift past it
    if (edge.source === 'right') {
      snapPosition = edge.position + SNAP_CONSTANTS.FRAMELESS_GAP_TOLERANCE;
    }

    // Calculate distance from current position
    const distance = Math.abs(snapPosition - cabinetX);

    if (distance < minDistance) {
      minDistance = distance;
      closestSnapEdge = { position: snapPosition, edge };
    }
  }

  // Apply snapped position
  if (closestSnapEdge && minDistance > SNAP_CONSTANTS.PHYSICAL_OVERLAP_TOLERANCE) {
    return {
      ...cabinet,
      position: {
        ...cabinet.position,
        x: closestSnapEdge.position,
      },
      snappedTo: closestSnapEdge.edge,
    };
  }

  return cabinet; // Already in a good position
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Checks if two rectangles overlap (2D projection on x-axis).
 * Returns true if physical boxes collide.
 * @private
 */
function boxesOverlap(cab1, cab2, tolerance = SNAP_CONSTANTS.PHYSICAL_OVERLAP_TOLERANCE) {
  const cab1X = cab1.position.x;
  const cab1Width = cab1.position.width || cab1.physicalBox?.width || 30;
  const cab1Right = cab1X + cab1Width;

  const cab2X = cab2.position.x;
  const cab2Width = cab2.position.width || cab2.physicalBox?.width || 30;
  const cab2Right = cab2X + cab2Width;

  // Check overlap with tolerance
  return !(cab1Right + tolerance <= cab2X || cab2Right + tolerance <= cab1X);
}

/**
 * Checks if door swings collide between two adjacent cabinets.
 * Assumes both have same hinge radius (width - 1).
 * @private
 */
function doorSwingsConflict(cab1, cab2, tolerance = SNAP_CONSTANTS.DOOR_SWING_BUFFER) {
  // If either has no door swing (corner cabinet), no conflict
  if (!cab1.doorSwing || !cab2.doorSwing || cab1.doorSwing.arc === 0 || cab2.doorSwing.arc === 0) {
    return false;
  }

  const cab1X = cab1.position.x;
  const cab1Width = cab1.position.width || cab1.physicalBox?.width || 30;
  const cab1Right = cab1X + cab1Width;

  const cab2X = cab2.position.x;

  // Check if cabs are adjacent
  const gap = Math.abs(cab2X - cab1Right);
  if (gap > tolerance) {
    return false; // Not adjacent, no swing conflict
  }

  // Check if hinge sides point toward each other
  const cab1HingeSide = cab1.doorSwing.hingeSide;
  const cab2HingeSide = cab2.doorSwing.hingeSide;

  // If cab1's door opens right (right hinge) AND cab2 is to its right, conflict!
  if (cab1HingeSide === 'right' && cab2X >= cab1Right && gap < tolerance) {
    return true;
  }

  // If cab2's door opens left (left hinge) AND cab1 is to its left, conflict!
  if (cab2HingeSide === 'left' && cab1X <= cab2X && gap < tolerance) {
    return true;
  }

  return false;
}

/**
 * Checks if cabinet handle clearance is adequate at a corner.
 * Corner cabinets and wall corners need extra clearance.
 * @private
 */
function handleClearanceOK(
  cabinet,
  existingCabs,
  wallLength,
  tolerance = SNAP_CONSTANTS.HANDLE_CLEARANCE_BUFFER
) {
  const cabinetX = cabinet.position.x;
  const cabinetWidth = cabinet.position.width || cabinet.physicalBox?.width || 30;
  const cabinetRight = cabinetX + cabinetWidth;
  const handleClear = cabinet.handleClearance || 1.25;

  // Check left wall proximity
  if (cabinetX - handleClear < tolerance) {
    return false; // Too close to left wall
  }

  // Check right wall proximity
  if (cabinetRight + handleClear > wallLength - tolerance) {
    return false; // Too close to right wall
  }

  // Check corner adjacency (no cabinet within handleClear + tolerance)
  for (const existingCab of existingCabs) {
    const existingX = existingCab.position.x;
    const existingWidth = existingCab.position.width || existingCab.physicalBox?.width || 30;
    const existingRight = existingX + existingWidth;

    // Gap between existing and new cabinet
    const leftGap = cabinetX - existingRight;
    const rightGap = existingX - cabinetRight;

    if (leftGap >= 0 && leftGap < handleClear + tolerance) {
      return false; // Too close on left side
    }
    if (rightGap >= 0 && rightGap < handleClear + tolerance) {
      return false; // Too close on right side
    }
  }

  return true;
}

/**
 * Inserts a new cabinet into the layout with full collision checking.
 * Validates: physical overlap, door swings, handle clearance, wall boundaries.
 *
 * @param {Object} newCab - Cabinet to insert
 * @param {Array<Object>} existingCabs - Existing positioned cabinets
 * @param {number} [wallLength=120] - Total wall length (inches)
 * @param {Array<Object>} [corners=[]] - Corner definitions for blocking zones
 * @returns {Object} { success: boolean, cabinet?: Object, error?: string, suggestion?: Object }
 *
 * @example
 * const result = insertWithCollisionCheck(newCab, [cab1, cab2], 120);
 * if (result.success) {
 *   // newCab is positioned at result.cabinet.position
 * } else {
 *   // result.suggestion contains alternative position or width
 * }
 */
export function insertWithCollisionCheck(newCab, existingCabs, wallLength = 120, corners = []) {
  // Validate input
  if (!newCab || !newCab.position) {
    return {
      success: false,
      error: 'Invalid cabinet: missing position',
    };
  }

  const cabinetX = newCab.position.x;
  const cabinetWidth = newCab.position.width || newCab.physicalBox?.width || 30;
  const cabinetRight = cabinetX + cabinetWidth;

  // Check 1: Wall boundary
  if (cabinetX < 0 || cabinetRight > wallLength) {
    return {
      success: false,
      error: 'Cabinet exceeds wall boundaries',
      suggestion: {
        reason: 'out-of-bounds',
        x: Math.max(0, Math.min(wallLength - cabinetWidth, cabinetX)),
      },
    };
  }

  // Check 2: Physical overlap with existing cabinets
  for (const existingCab of existingCabs) {
    if (boxesOverlap(newCab, existingCab)) {
      return {
        success: false,
        error: 'Cabinet overlaps with existing cabinet',
        suggestion: {
          reason: 'physical-overlap',
          neighbor: existingCab,
          x: (existingCab.position.x + existingCab.position.width) || (existingCab.position.x - cabinetWidth),
        },
      };
    }
  }

  // Check 3: Door swing conflicts
  for (const existingCab of existingCabs) {
    if (doorSwingsConflict(newCab, existingCab)) {
      return {
        success: false,
        error: 'Door swing conflict with adjacent cabinet',
        suggestion: {
          reason: 'door-swing-conflict',
          neighbor: existingCab,
          tryWidth: cabinetWidth - 3, // Reduce width by one increment
        },
      };
    }
  }

  // Check 4: Handle clearance at corners
  if (!handleClearanceOK(newCab, existingCabs, wallLength)) {
    return {
      success: false,
      error: 'Insufficient handle clearance at corner',
      suggestion: {
        reason: 'handle-clearance',
        tryWidth: cabinetWidth - 3, // Reduce width by one increment
      },
    };
  }

  // Check 5: Corner blocking zones
  for (const corner of corners) {
    const cornerClear = SNAP_CONSTANTS.CORNER_CLEARANCE;
    // Left corner zone
    if (corner.side === 'left' && cabinetX < cornerClear) {
      return {
        success: false,
        error: 'Cabinet too close to left corner',
        suggestion: {
          reason: 'corner-clearance',
          x: cornerClear,
        },
      };
    }
    // Right corner zone
    if (corner.side === 'right' && cabinetRight > wallLength - cornerClear) {
      return {
        success: false,
        error: 'Cabinet too close to right corner',
        suggestion: {
          reason: 'corner-clearance',
          x: wallLength - cabinetWidth - cornerClear,
        },
      };
    }
  }

  // All checks passed
  return {
    success: true,
    cabinet: newCab,
  };
}

// ============================================================================
// APPLIANCE-FIRST RESOLUTION
// ============================================================================

/**
 * Positions appliances first (sink, range, DW, fridge) based on features and work triangle.
 * Returns positioned appliances + remaining gaps for cabinet fill.
 *
 * @param {Array<Object>} appliances - Appliance cabinets (SINK, RANGE, DW, FRIDGE SKUs)
 * @param {number} [wallLength=120] - Total wall length (inches)
 * @param {Array<Object>} [corners=[]] - Corner definitions
 * @param {Object} [features={}] - Feature coordinates (sinkCenter, rangeCenter, windowX, ventX)
 * @returns {Object} { positioned: Array<Object>, gaps: Array<Object>, errors: Array<string> }
 *
 * @example
 * const result = resolveApplianceFirst(
 *   [sinkBase, range, dw],
 *   120,
 *   [],
 *   { sinkCenter: 30, rangeCenter: 60, windowX: 30 }
 * );
 * // result.positioned = [positionedSink, positionedRange, positionedDW]
 * // result.gaps = [{ start: 0, end: 30, width: 30 }, ...]
 */
export function resolveApplianceFirst(
  appliances,
  wallLength = 120,
  corners = [],
  features = {}
) {
  if (!appliances || appliances.length === 0) {
    return {
      positioned: [],
      gaps: [{ start: 0, end: wallLength, width: wallLength, leftNeighbor: null, rightNeighbor: null }],
      errors: [],
    };
  }

  const positioned = [];
  const errors = [];
  const occupiedRanges = [];

  // Helper: center cabinet on a feature coordinate
  const centerCabinetOn = (appliance, centerX) => {
    const width = appliance.position.width || appliance.physicalBox?.width || 30;
    const x = Math.max(0, Math.min(wallLength - width, centerX - width / 2));
    return {
      ...appliance,
      position: {
        ...appliance.position,
        x,
      },
    };
  };

  // Phase 1: SINK (primary anchor)
  const sinkApp = appliances.find((a) => a.sku && a.sku.includes('SINK'));
  if (sinkApp && features.sinkCenter !== undefined) {
    const centered = centerCabinetOn(sinkApp, features.sinkCenter);
    const collision = insertWithCollisionCheck(centered, positioned, wallLength, corners);
    if (collision.success) {
      positioned.push(collision.cabinet);
      occupiedRanges.push({
        start: centered.position.x,
        end: centered.position.x + (centered.position.width || 30),
      });
    } else {
      errors.push(`Sink placement failed: ${collision.error}`);
    }
  }

  // Phase 2: RANGE (secondary anchor)
  const rangeApp = appliances.find((a) => a.sku && a.sku.includes('RANGE'));
  if (rangeApp && features.rangeCenter !== undefined) {
    const centered = centerCabinetOn(rangeApp, features.rangeCenter);
    const collision = insertWithCollisionCheck(centered, positioned, wallLength, corners);
    if (collision.success) {
      positioned.push(collision.cabinet);
      occupiedRanges.push({
        start: centered.position.x,
        end: centered.position.x + (centered.position.width || 30),
      });
    } else {
      errors.push(`Range placement failed: ${collision.error}`);
    }
  }

  // Phase 3: DISHWASHER (tertiary anchor, adjacent to sink)
  const dwApp = appliances.find((a) => a.sku && a.sku.includes('DW'));
  if (dwApp && sinkApp && positioned.some((p) => p.sku.includes('SINK'))) {
    const sinkPos = positioned.find((p) => p.sku.includes('SINK'));
    const dwWidth = dwApp.position.width || dwApp.physicalBox?.width || 24;
    // Try to place DW to the left of sink
    let dwX = sinkPos.position.x - dwWidth;
    if (dwX < 0) {
      // If no room on left, try right of sink
      dwX = sinkPos.position.x + (sinkPos.position.width || 30);
    }
    const dwPos = {
      ...dwApp,
      position: { ...dwApp.position, x: Math.max(0, Math.min(wallLength - dwWidth, dwX)) },
    };
    const collision = insertWithCollisionCheck(dwPos, positioned, wallLength, corners);
    if (collision.success) {
      positioned.push(collision.cabinet);
      occupiedRanges.push({
        start: dwPos.position.x,
        end: dwPos.position.x + dwWidth,
      });
    } else {
      errors.push(`Dishwasher placement failed: ${collision.error}`);
    }
  }

  // Phase 4: REFRIGERATOR (tertiary anchor, per work triangle)
  const fridgeApp = appliances.find((a) => a.sku && a.sku.includes('FRIDGE'));
  if (fridgeApp) {
    // Position fridge to complete work triangle (prefer corner, check leg lengths)
    const fridgeWidth = fridgeApp.position.width || fridgeApp.physicalBox?.width || 36;
    // Simple strategy: place at one of the ends if available
    let fridgeX = 0;
    if (positioned.some((p) => p.sku.includes('SINK'))) {
      const sinkPos = positioned.find((p) => p.sku.includes('SINK'));
      // Place fridge at opposite end from sink
      fridgeX = sinkPos.position.x > wallLength / 2 ? 0 : wallLength - fridgeWidth;
    }
    const fridgePos = {
      ...fridgeApp,
      position: { ...fridgeApp.position, x: Math.max(0, Math.min(wallLength - fridgeWidth, fridgeX)) },
    };
    const collision = insertWithCollisionCheck(fridgePos, positioned, wallLength, corners);
    if (collision.success) {
      positioned.push(collision.cabinet);
      occupiedRanges.push({
        start: fridgePos.position.x,
        end: fridgePos.position.x + fridgeWidth,
      });
    } else {
      errors.push(`Refrigerator placement failed: ${collision.error}`);
    }
  }

  // Compute remaining gaps
  const gaps = analyzeGaps(positioned, wallLength, 0, 0);

  return {
    positioned,
    gaps,
    errors,
  };
}

// ============================================================================
// GAP ANALYSIS
// ============================================================================

/**
 * Analyzes remaining gaps in the layout after cabinets are positioned.
 * Returns sorted array of gaps ready for fill algorithm.
 *
 * @param {Array<Object>} positionedItems - Array of positioned cabinets
 * @param {number} [wallLength=120] - Total wall length (inches)
 * @param {number} [leftConsumed=0] - Space consumed from left (corner, end panel, etc.)
 * @param {number} [rightConsumed=0] - Space consumed from right
 * @returns {Array<Object>} Array of gap objects: [{ start, end, width, leftNeighbor, rightNeighbor }]
 *
 * @example
 * const gaps = analyzeGaps(positioned, 120, 0, 0);
 * // gaps[0] = { start: 0, end: 30, width: 30, leftNeighbor: null, rightNeighbor: cab1 }
 * // gaps[1] = { start: 60, end: 120, width: 60, leftNeighbor: cab2, rightNeighbor: null }
 */
export function analyzeGaps(positionedItems, wallLength = 120, leftConsumed = 0, rightConsumed = 0) {
  if (!positionedItems || positionedItems.length === 0) {
    return [
      {
        start: leftConsumed,
        end: wallLength - rightConsumed,
        width: wallLength - leftConsumed - rightConsumed,
        leftNeighbor: null,
        rightNeighbor: null,
      },
    ];
  }

  // Sort cabinets by x position
  const sorted = [...positionedItems].sort((a, b) => a.position.x - b.position.x);

  const gaps = [];
  let lastEnd = leftConsumed;

  for (const cabinet of sorted) {
    const cabStart = cabinet.position.x;
    const cabWidth = cabinet.position.width || cabinet.physicalBox?.width || 30;
    const cabEnd = cabStart + cabWidth;

    // Gap before this cabinet
    if (cabStart > lastEnd + SNAP_CONSTANTS.PHYSICAL_OVERLAP_TOLERANCE) {
      const gapWidth = cabStart - lastEnd;
      const leftNeighbor = gaps.length > 0 ? sorted[gaps.length - 1] : null;

      gaps.push({
        start: lastEnd,
        end: cabStart,
        width: gapWidth,
        leftNeighbor,
        rightNeighbor: cabinet,
      });
    }

    lastEnd = cabEnd;
  }

  // Final gap to right boundary
  const finalGapStart = lastEnd;
  const finalGapEnd = wallLength - rightConsumed;
  if (finalGapEnd > finalGapStart + SNAP_CONSTANTS.PHYSICAL_OVERLAP_TOLERANCE) {
    const lastCabinet = sorted[sorted.length - 1];
    gaps.push({
      start: finalGapStart,
      end: finalGapEnd,
      width: finalGapEnd - finalGapStart,
      leftNeighbor: lastCabinet,
      rightNeighbor: null,
    });
  }

  return gaps;
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

/**
 * Module exports:
 *
 * Constants:
 * - PLACEMENT_ORDER: 8-phase strict placement order
 * - SNAP_CONSTANTS: Grid size, tolerances, clearances
 *
 * Functions:
 * - buildCabinetIntelligence(sku, position, context): Build cabinet rules object
 * - lockToWall(cabinet, wallId, wallDepthMax): Lock back plane to y=0
 * - snapToGrid(position, gridSize, force): Snap to 3" grid
 * - snapToNeighbor(cabinet, existingCabs, wallLength): Zero-gap side-to-side snap
 * - insertWithCollisionCheck(newCab, existingCabs, wallLength, corners): Full collision validation
 * - resolveApplianceFirst(appliances, wallLength, corners, features): Anchor appliances
 * - analyzeGaps(positioned, wallLength, leftConsumed, rightConsumed): Find fill gaps
 *
 * @example
 * import {
 *   PLACEMENT_ORDER,
 *   SNAP_CONSTANTS,
 *   buildCabinetIntelligence,
 *   snapToNeighbor,
 *   insertWithCollisionCheck,
 *   resolveApplianceFirst,
 *   analyzeGaps,
 * } from './snap-collision.js';
 *
 * // Build cabinet intelligence
 * const intel = buildCabinetIntelligence('B30-RT', { x: 0, width: 30 }, ctx);
 *
 * // Snap to neighbor
 * const snapped = snapToNeighbor(newCab, [cab1, cab2], 120);
 *
 * // Validate insertion
 * const result = insertWithCollisionCheck(snapped, positioned, 120);
 * if (result.success) {
 *   positioned.push(result.cabinet);
 * }
 *
 * // Anchor appliances first
 * const { positioned: apps, gaps } = resolveApplianceFirst(
 *   [sink, range, dw, fridge],
 *   120,
 *   [],
 *   { sinkCenter: 30, rangeCenter: 60 }
 * );
 *
 * // Analyze remaining gaps for fill
 * const gaps = analyzeGaps(apps, 120);
 */
