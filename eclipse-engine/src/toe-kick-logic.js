/**
 * Eclipse Kitchen Designer — Toe Kick Logic
 * ===========================================
 * Continuous toe-kick run generation for frameless cabinetry.
 *
 * Instead of notched toe-kick boxes for individual cabinets,
 * this module generates continuous runs of matching material that:
 *   - Trace the front line of base cabinets on each wall
 *   - Merge adjacent cabinet footprints into single continuous runs
 *   - Handle gaps where appliances (ranges, dishwashers) sit on the floor
 *   - Generate corner miters where walls meet
 *   - Separately handle islands (4-sided) and peninsulas (3-sided)
 *   - Produce cut lists and SKU strings
 *
 * Standards:
 *   - TOE_KICK_HEIGHT: 4.5" (Eclipse standard, AFF)
 *   - TOE_KICK_SETBACK: 3" (offset from cabinet face toward wall)
 *   - Material height: 4.5"
 *
 * @module toe-kick-logic
 */

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

/**
 * Toe kick dimensional constants (in inches)
 * @type {Object}
 */
export const TOE_KICK_CONSTANTS = {
  HEIGHT: 4.5,           // Above-floor height to toe kick top
  SETBACK: 3,            // Horizontal offset from cabinet face toward wall
  MATERIAL_HEIGHT: 4.5,  // Material thickness in vertical direction
  CORNER_MITER_ANGLE: 45, // Degrees for corner joints
  MIN_RUN_LENGTH: 3,     // Minimum continuous run to generate (inches)
  ISLAND_OFFSET: 0,      // Islands have no setback (toe kick wraps perimeter)
};

// Material SKU prefixes
const SKU_NATURAL = 'TK-N';      // Natural finish
const SKU_CUSTOM = 'TK-C';       // Custom color finish

// Tolerance for detecting gaps and overlaps (inches)
const TOLERANCE = 0.125;  // 1/8 inch

// ─── DATA STRUCTURES ────────────────────────────────────────────────────────

/**
 * Wall layout structure
 * @typedef {Object} WallLayout
 * @property {string} wallId - Unique wall identifier ('WALL_N', 'WALL_S', 'WALL_E', 'WALL_W')
 * @property {string} orientation - 'horizontal' | 'vertical' (relative to kitchen compass)
 * @property {number} length - Total wall length in inches
 * @property {Array<Cabinet>} cabinets - Array of cabinet objects positioned on this wall
 */

/**
 * Cabinet object structure
 * @typedef {Object} Cabinet
 * @property {string} sku - Cabinet SKU identifier
 * @property {number} position - Start position along wall (X or Y, in inches)
 * @property {number} width - Cabinet width along wall (in inches)
 * @property {number} depth - Cabinet depth perpendicular to wall (in inches)
 * @property {string} type - Cabinet type: 'base' | 'sink_base' | 'appliance' | 'tall'
 * @property {boolean} [hasFootRail] - True if cabinet has a toe kick notch (floor gap) — appliances typically do
 * @property {boolean} [isFloored] - True if appliance sits directly on floor (range, dishwasher)
 */

/**
 * Toe kick run — a continuous segment of toe kick material
 * @typedef {Object} ToeKickRun
 * @property {string} runId - Unique identifier for this run
 * @property {string} wallId - Wall identifier where run is located
 * @property {number} startPos - Start position along wall (inches)
 * @property {number} endPos - End position along wall (inches)
 * @property {number} length - Total linear length of run (inches)
 * @property {string} side - Which side of structure: 'front' | 'left' | 'right' | 'back'
 * @property {boolean} needsMiterLeft - True if left end requires 45° miter joint
 * @property {boolean} needsMiterRight - True if right end requires 45° miter joint
 * @property {number} quantity - Number of units needed
 * @property {string} sku - Material SKU identifier
 * @property {number} linearFeet - Length converted to linear feet
 */

/**
 * Cut list item — one physical piece to cut
 * @typedef {Object} CutListItem
 * @property {string} runId - Reference to parent toe kick run
 * @property {number} length - Length in inches
 * @property {number} height - Height in inches (always MATERIAL_HEIGHT)
 * @property {string} material - Material type: 'natural' | 'custom_color'
 * @property {string} sku - SKU identifier
 * @property {boolean} needsMiterLeft - Left end cut at 45°
 * @property {boolean} needsMiterRight - Right end cut at 45°
 * @property {number} linearFeet - Length in linear feet
 */

/**
 * Corner definition — where two walls meet
 * @typedef {Object} Corner
 * @property {string} cornerId - Unique identifier
 * @property {string} wall1Id - First wall identifier
 * @property {string} wall2Id - Second wall identifier
 * @property {string} position - Position identifier: 'NE' | 'SE' | 'SW' | 'NW'
 * @property {string} type - Corner type: 'convex' | 'concave' (determines miter direction)
 */

/**
 * Island layout structure
 * @typedef {Object} IslandLayout
 * @property {string} islandId - Unique island identifier
 * @property {number} centerX - Center X position of island
 * @property {number} centerY - Center Y position of island
 * @property {number} lengthX - Length along X-axis (inches)
 * @property {number} lengthY - Length along Y-axis (inches)
 * @property {Array<Cabinet>} cabinets - Cabinets positioned on island
 */

/**
 * Peninsula layout structure
 * @typedef {Object} PeninsulaLayout
 * @property {string} peninsulaId - Unique peninsula identifier
 * @property {string} attachedWall - Which wall the peninsula connects to
 * @property {number} position - Position along attached wall
 * @property {number} lengthAlongWall - Length along attached wall
 * @property {number} depthAwayFromWall - How far peninsula extends from wall
 * @property {Array<Cabinet>} cabinets - Cabinets on peninsula
 */

// ─── MAIN EXPORT FUNCTIONS ──────────────────────────────────────────────────

/**
 * Generate continuous toe-kick runs for all walls, islands, and peninsulas.
 *
 * @param {Array<WallLayout>} wallLayouts - Array of wall layout objects
 * @param {Array<Corner>} [corners=[]] - Optional array of corner definitions
 * @param {IslandLayout} [islandLayout=null] - Optional island layout
 * @param {Array<PeninsulaLayout>} [peninsulaLayouts=[]] - Optional peninsula layouts
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.golaPrefix=''] - Prefix for custom color SKUs ('TK-' or similar)
 * @param {boolean} [options.includeIslands=true] - Generate island toe kicks
 * @param {boolean} [options.includePeninsulas=true] - Generate peninsula toe kicks
 * @param {boolean} [options.useMiters=true] - Generate corner miters (vs. butt joints)
 * @returns {Object} Toe kick generation result
 * @returns {Array<ToeKickRun>} result.runs - All generated toe kick runs
 * @returns {Array<CutListItem>} result.cutList - Detailed cut list for manufacturing
 * @returns {number} result.totalLinearFt - Total linear footage of toe kick material
 * @returns {Object} result.skus - Aggregate SKU counts { 'TK-N': 24, 'TK-C': 12 }
 * @returns {Array<string>} result.warnings - Any design warnings or issues found
 */
export function generateToeKickRuns(
  wallLayouts,
  corners = [],
  islandLayout = null,
  peninsulaLayouts = [],
  options = {}
) {
  const {
    golaPrefix = '',
    includeIslands = true,
    includePeninsulas = true,
    useMiters = true,
  } = options;

  const result = {
    runs: [],
    cutList: [],
    totalLinearFt: 0,
    skus: {},
    warnings: [],
  };

  // Process wall-mounted base cabinets
  for (const wall of wallLayouts) {
    const wallRuns = generateWallToeKicks(wall, corners, useMiters, golaPrefix);
    result.runs.push(...wallRuns);
  }

  // Process island (4-sided)
  if (includeIslands && islandLayout) {
    const islandRuns = generateIslandToeKicks(islandLayout, golaPrefix);
    result.runs.push(...islandRuns);
  }

  // Process peninsulas (3-sided)
  if (includePeninsulas && peninsulaLayouts && peninsulaLayouts.length > 0) {
    for (const peninsula of peninsulaLayouts) {
      const peninsulaRuns = generatePeninsulaeToeKicks(peninsula, wallLayouts, golaPrefix);
      result.runs.push(...peninsulaRuns);
    }
  }

  // Generate cut list from runs
  for (const run of result.runs) {
    const cutItem = buildCutListItem(run);
    result.cutList.push(cutItem);

    // Aggregate SKU counts
    const sku = cutItem.sku;
    result.skus[sku] = (result.skus[sku] || 0) + cutItem.linearFeet;

    // Accumulate total
    result.totalLinearFt += cutItem.linearFeet;
  }

  // Validate and return
  const validation = validateToeKick(result.runs, wallLayouts);
  if (validation.warnings && validation.warnings.length > 0) {
    result.warnings.push(...validation.warnings);
  }

  return result;
}

/**
 * Validate toe kick runs for overlaps, gaps, and consistency.
 *
 * @param {Array<ToeKickRun>} runs - Toe kick runs to validate
 * @param {Array<WallLayout>} wallLayouts - Wall layouts for reference
 * @returns {Object} Validation result
 * @returns {boolean} result.isValid - True if no critical issues
 * @returns {Array<string>} result.warnings - List of warnings/issues
 * @returns {Object} result.coverage - Per-wall coverage statistics
 */
export function validateToeKick(runs, wallLayouts) {
  const result = {
    isValid: true,
    warnings: [],
    coverage: {},
  };

  // Group runs by wall
  const runsByWall = {};
  for (const run of runs) {
    if (run.wallId && run.wallId !== 'island' && !run.wallId.startsWith('peninsula')) {
      if (!runsByWall[run.wallId]) {
        runsByWall[run.wallId] = [];
      }
      runsByWall[run.wallId].push(run);
    }
  }

  // Validate each wall
  for (const wall of wallLayouts) {
    const wallRuns = runsByWall[wall.wallId] || [];
    wallRuns.sort((a, b) => a.startPos - b.startPos);

    // Check for gaps between runs
    for (let i = 0; i < wallRuns.length - 1; i++) {
      const currentRun = wallRuns[i];
      const nextRun = wallRuns[i + 1];
      const gap = nextRun.startPos - currentRun.endPos;

      if (gap > TOLERANCE) {
        result.warnings.push(
          `Wall ${wall.wallId}: Gap of ${gap.toFixed(2)}" found between ` +
          `position ${currentRun.endPos.toFixed(2)}" and ${nextRun.startPos.toFixed(2)}"`
        );
      }

      // Check for overlaps
      if (gap < -TOLERANCE) {
        result.isValid = false;
        result.warnings.push(
          `Wall ${wall.wallId}: OVERLAP of ${Math.abs(gap).toFixed(2)}" detected ` +
          `between toe kick runs at positions ${currentRun.endPos.toFixed(2)}" and ${nextRun.startPos.toFixed(2)}"`
        );
      }
    }

    // Calculate coverage
    let totalCoverage = 0;
    for (const run of wallRuns) {
      totalCoverage += run.length;
    }
    result.coverage[wall.wallId] = {
      totalLength: wall.length,
      toeKickLength: totalCoverage,
      coveragePercent: (totalCoverage / wall.length) * 100,
    };
  }

  return result;
}

// ─── WALL TOE KICK GENERATION ────────────────────────────────────────────────

/**
 * Generate toe kick runs for a single wall.
 * Merges adjacent cabinets into continuous runs, gaps around appliances.
 *
 * @param {WallLayout} wall - Wall layout object
 * @param {Array<Corner>} corners - Corner definitions for miter detection
 * @param {boolean} useMiters - Enable corner miters
 * @param {string} golaPrefix - Custom color SKU prefix
 * @returns {Array<ToeKickRun>} Toe kick runs for this wall
 * @private
 */
function generateWallToeKicks(wall, corners, useMiters, golaPrefix) {
  const runs = [];

  if (!wall.cabinets || wall.cabinets.length === 0) {
    return runs;
  }

  // Filter to base cabinets that need toe kicks (exclude tall appliances)
  const baseCabinets = wall.cabinets.filter((cab) => {
    // Tall appliances (fridge, wine column) don't get toe kicks
    if (cab.type === 'tall' || cab.type === 'refrigerator' || cab.type === 'wine_column') {
      return false;
    }
    // Appliances that sit on floor have no toe kick
    if (cab.isFloored) {
      return false;
    }
    // Base and sink base cabinets get toe kicks
    return cab.type === 'base' || cab.type === 'sink_base';
  });

  if (baseCabinets.length === 0) {
    return runs;
  }

  // Sort cabinets by position
  baseCabinets.sort((a, b) => a.position - b.position);

  // Merge adjacent cabinets into continuous runs
  let currentRun = null;
  let runCounter = 0;

  for (const cab of baseCabinets) {
    const cabStart = cab.position;
    const cabEnd = cab.position + cab.width;

    if (currentRun === null) {
      // Start new run
      currentRun = {
        runId: `${wall.wallId}-tk-${++runCounter}`,
        wallId: wall.wallId,
        startPos: cabStart,
        endPos: cabEnd,
        side: 'front',
        needsMiterLeft: false,
        needsMiterRight: false,
        cabinetCount: 1,
      };
    } else {
      // Check if this cabinet is adjacent to current run (within tolerance)
      if (Math.abs(cabStart - currentRun.endPos) <= TOLERANCE) {
        // Merge into current run
        currentRun.endPos = cabEnd;
        currentRun.cabinetCount += 1;
      } else {
        // Gap detected — save current run and start new one
        if (currentRun.endPos - currentRun.startPos >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
          runs.push(finalizeRun(currentRun, wall, corners, useMiters, golaPrefix));
        }
        currentRun = {
          runId: `${wall.wallId}-tk-${++runCounter}`,
          wallId: wall.wallId,
          startPos: cabStart,
          endPos: cabEnd,
          side: 'front',
          needsMiterLeft: false,
          needsMiterRight: false,
          cabinetCount: 1,
        };
      }
    }
  }

  // Save final run
  if (currentRun && currentRun.endPos - currentRun.startPos >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
    runs.push(finalizeRun(currentRun, wall, corners, useMiters, golaPrefix));
  }

  return runs;
}

/**
 * Finalize a toe kick run with computed properties and miter detection.
 *
 * @param {Object} run - Run object under construction
 * @param {WallLayout} wall - Wall layout for reference
 * @param {Array<Corner>} corners - Corner definitions
 * @param {boolean} useMiters - Enable miters
 * @param {string} golaPrefix - Custom color SKU prefix
 * @returns {ToeKickRun} Finalized run
 * @private
 */
function finalizeRun(run, wall, corners, useMiters, golaPrefix) {
  // Calculate length
  run.length = run.endPos - run.startPos;
  run.quantity = 1;

  // Detect corner miters
  if (useMiters && corners && corners.length > 0) {
    // Check if run starts or ends at a corner
    for (const corner of corners) {
      if (corner.wall1Id === wall.wallId || corner.wall2Id === wall.wallId) {
        // This corner involves this wall — check if run touches it
        if (Math.abs(run.startPos - 0) < TOLERANCE || Math.abs(run.startPos) < TOLERANCE) {
          run.needsMiterLeft = true;
        }
        if (Math.abs(run.endPos - wall.length) < TOLERANCE) {
          run.needsMiterRight = true;
        }
      }
    }
  }

  // Assign SKU
  run.sku = golaPrefix ? `${golaPrefix}-TK-C` : SKU_NATURAL;
  run.linearFeet = run.length / 12;

  return run;
}

// ─── ISLAND TOE KICK GENERATION ──────────────────────────────────────────────

/**
 * Generate toe kick runs for an island (4-sided perimeter).
 *
 * @param {IslandLayout} island - Island layout object
 * @param {string} golaPrefix - Custom color SKU prefix
 * @returns {Array<ToeKickRun>} Four runs (front, left, back, right)
 * @private
 */
function generateIslandToeKicks(island, golaPrefix) {
  const runs = [];

  if (!island.cabinets || island.cabinets.length === 0) {
    return runs;
  }

  // Islands have 4 sides: front, left, back, right
  const sides = [
    { side: 'front', length: island.lengthX },
    { side: 'left', length: island.lengthY },
    { side: 'back', length: island.lengthX },
    { side: 'right', length: island.lengthY },
  ];

  for (const { side, length } of sides) {
    if (length >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
      const run = {
        runId: `${island.islandId}-${side}`,
        wallId: 'island',
        islandId: island.islandId,
        startPos: 0,
        endPos: length,
        length,
        side,
        needsMiterLeft: true,  // Islands always have corner miters
        needsMiterRight: true,
        quantity: 1,
        sku: golaPrefix ? `${golaPrefix}-TK-C` : SKU_NATURAL,
        linearFeet: length / 12,
      };
      runs.push(run);
    }
  }

  return runs;
}

// ─── PENINSULA TOE KICK GENERATION ──────────────────────────────────────────

/**
 * Generate toe kick runs for a peninsula (3-sided: front, left, right).
 * The attached side to the main wall is handled by wall-mounted logic.
 *
 * @param {PeninsulaLayout} peninsula - Peninsula layout object
 * @param {Array<WallLayout>} wallLayouts - Wall layouts for reference
 * @param {string} golaPrefix - Custom color SKU prefix
 * @returns {Array<ToeKickRun>} Three runs (front, left, right)
 * @private
 */
function generatePeninsulaeToeKicks(peninsula, wallLayouts, golaPrefix) {
  const runs = [];

  if (!peninsula.cabinets || peninsula.cabinets.length === 0) {
    return runs;
  }

  const peninsulaId = peninsula.peninsulaId;

  // Peninsula has 3 exposed sides: front, left, right
  // The "attached" side is handled by the main wall logic

  // Front side (away from main wall)
  if (peninsula.depthAwayFromWall >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
    runs.push({
      runId: `${peninsulaId}-front`,
      wallId: `peninsula-${peninsulaId}`,
      peninsulaId,
      startPos: 0,
      endPos: peninsula.depthAwayFromWall,
      length: peninsula.depthAwayFromWall,
      side: 'front',
      needsMiterLeft: true,
      needsMiterRight: true,
      quantity: 1,
      sku: golaPrefix ? `${golaPrefix}-TK-C` : SKU_NATURAL,
      linearFeet: peninsula.depthAwayFromWall / 12,
    });
  }

  // Left side
  if (peninsula.lengthAlongWall >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
    runs.push({
      runId: `${peninsulaId}-left`,
      wallId: `peninsula-${peninsulaId}`,
      peninsulaId,
      startPos: 0,
      endPos: peninsula.lengthAlongWall,
      length: peninsula.lengthAlongWall,
      side: 'left',
      needsMiterLeft: true,
      needsMiterRight: false,
      quantity: 1,
      sku: golaPrefix ? `${golaPrefix}-TK-C` : SKU_NATURAL,
      linearFeet: peninsula.lengthAlongWall / 12,
    });
  }

  // Right side
  if (peninsula.lengthAlongWall >= TOE_KICK_CONSTANTS.MIN_RUN_LENGTH) {
    runs.push({
      runId: `${peninsulaId}-right`,
      wallId: `peninsula-${peninsulaId}`,
      peninsulaId,
      startPos: 0,
      endPos: peninsula.lengthAlongWall,
      length: peninsula.lengthAlongWall,
      side: 'right',
      needsMiterLeft: false,
      needsMiterRight: true,
      quantity: 1,
      sku: golaPrefix ? `${golaPrefix}-TK-C` : SKU_NATURAL,
      linearFeet: peninsula.lengthAlongWall / 12,
    });
  }

  return runs;
}

// ─── CUT LIST GENERATION ────────────────────────────────────────────────────

/**
 * Build a cut list item from a toe kick run.
 *
 * @param {ToeKickRun} run - Toe kick run object
 * @returns {CutListItem} Cut list item ready for manufacturing
 * @private
 */
function buildCutListItem(run) {
  const material = run.sku === SKU_NATURAL ? 'natural' : 'custom_color';

  return {
    runId: run.runId,
    length: run.length,
    height: TOE_KICK_CONSTANTS.MATERIAL_HEIGHT,
    material,
    sku: run.sku,
    needsMiterLeft: run.needsMiterLeft,
    needsMiterRight: run.needsMiterRight,
    linearFeet: run.linearFeet,
    notes: buildCutNotes(run),
  };
}

/**
 * Generate cut notes (fabrication instructions) for a toe kick run.
 *
 * @param {ToeKickRun} run - Toe kick run object
 * @returns {string} Human-readable cut notes
 * @private
 */
function buildCutNotes(run) {
  const parts = [];

  if (run.wallId === 'island') {
    parts.push(`Island ${run.islandId} - ${run.side} side`);
  } else if (run.wallId.startsWith('peninsula')) {
    parts.push(`Peninsula ${run.peninsulaId} - ${run.side} side`);
  } else {
    parts.push(`${run.wallId} wall - position ${run.startPos.toFixed(1)}" to ${run.endPos.toFixed(1)}"`);
  }

  const cuts = [];
  if (run.needsMiterLeft) cuts.push('45° miter left');
  if (run.needsMiterRight) cuts.push('45° miter right');
  if (cuts.length > 0) {
    parts.push(`Cuts: ${cuts.join(', ')}`);
  }

  return parts.join(' | ');
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

/**
 * Calculate total linear feet from all runs.
 *
 * @param {Array<ToeKickRun>} runs - Toe kick runs
 * @returns {number} Total linear feet
 * @private
 */
function calculateTotalLinearFeet(runs) {
  return runs.reduce((sum, run) => sum + (run.length / 12), 0);
}

/**
 * Aggregate SKU counts from runs.
 *
 * @param {Array<ToeKickRun>} runs - Toe kick runs
 * @returns {Object} SKU aggregate { 'TK-N': 24, 'TK-C': 12 }
 * @private
 */
function aggregateSkus(runs) {
  const skus = {};
  for (const run of runs) {
    if (run.sku) {
      skus[run.sku] = (skus[run.sku] || 0) + run.linearFeet;
    }
  }
  return skus;
}

/**
 * Format linear feet to string with precision.
 *
 * @param {number} feet - Linear feet value
 * @returns {string} Formatted string (e.g., "24.5 ft")
 * @private
 */
function formatLinearFeet(feet) {
  return `${feet.toFixed(2)} ft`;
}
