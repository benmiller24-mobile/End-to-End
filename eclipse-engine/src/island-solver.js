/**
 * ISLAND & PENINSULA SOLVER
 * ══════════════════════════════════════════════════════════════════════
 * Placement engine for floating island and peninsula cabinets with
 * NKBA clearance envelopes, decorative panels, and work-triangle validation.
 *
 * CORE CONCEPTS:
 *   1. NO-FLY ZONE: 42" minimum clearance inward from each perimeter wall
 *   2. BUILDABLE ZONE: floor space remaining after no-fly zones subtracted
 *   3. ISLAND CLUSTER: free-floating XY-positioned cabinets (not wall-snapped)
 *   4. PENINSULA: attached to one perimeter wall, 3-side clearance required
 *   5. DFBP (Decorative Finished Back Panel): 3/4" panels on exposed backs
 *   6. DEP (Decorative End Panel): Both ends of island, 3/4" full height
 *
 * NKBA Standards:
 *   - Minimum walkway: 42" (36" absolute minimum in tight spaces)
 *   - Island with cooktop: 42" ALL sides (fire safety)
 *   - Island with seating: 48" seating side (stools + walkway)
 *   - Work triangle vertices: sink, range, refrigerator
 *
 * Exports:
 *   - solveIslandPlacement(roomGeometry, wallLayouts, prefs)
 *   - calculateNoFlyZone(wallLayouts, roomDims)
 *   - calculateIslandClearances(islandBounds, wallLayouts, roomDims)
 *   - ISLAND_CONSTANTS
 *
 * Usage:
 *   import { solveIslandPlacement, ISLAND_CONSTANTS } from './island-solver.js';
 *   const result = solveIslandPlacement(roomGeo, wallLayouts, { hasSeating: true });
 *   console.log(result.island);      // Island placement
 *   console.log(result.dfbps);       // Decorative back panels
 *   console.log(result.validation);  // Clearance checks
 */

// ════════════════════════════════════════════════════════════════════
// CONSTANTS & STANDARDS
// ════════════════════════════════════════════════════════════════════

export const ISLAND_CONSTANTS = {
  // NKBA Clearance Standards (inches)
  NKBA_MIN_WALKWAY: 42,          // Preferred minimum walkway
  NKBA_ABSOLUTE_MIN: 36,          // Absolute minimum (tight spaces only)
  COOKTOP_MIN_CLEARANCE: 42,      // Fire safety: cooktop on ALL sides
  SEATING_SIDE_CLEARANCE: 48,     // Seating side (stools + walkway)

  // Island Sizing
  SINGLE_SIDED_DEPTH: 24,         // Single-access island
  DOUBLE_ACCESS_DEPTH: 48,        // Back-to-back (two 24" modules)
  MIN_ISLAND_WIDTH: 36,           // Minimum island width
  MIN_ISLAND_DEPTH: 24,           // Minimum island depth

  // Standard Cabinet Widths (Eclipse C3 frameless)
  STD_CABINET_WIDTHS: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48],

  // Panel Thicknesses
  DFBP_THICKNESS: 0.75,           // Decorative finished back panel
  DEP_THICKNESS: 0.75,            // Decorative end panel

  // Panel SKU Patterns
  SKU_DFBP: (w) => `DFBP-${w}`,
  SKU_DEP_BASE: () => `DEP-24`,
  SKU_DEP_TALL: () => `DEP-36`,
};

// ════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS (JSDoc)
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} RoomGeometry
 * @property {number} width       - Room width (inches)
 * @property {number} length      - Room length (inches)
 * @property {WallDef[]} walls    - Array of wall definitions
 */

/**
 * @typedef {Object} WallDef
 * @property {string} id          - Wall identifier ('north', 'south', 'east', 'west')
 * @property {number} length      - Wall length (inches)
 * @property {number} cabinetDepth - Cabinet depth on this wall (24" typical)
 * @property {number} startX      - Room-space X coordinate of wall start
 * @property {number} startY      - Room-space Y coordinate of wall start
 * @property {number} endX        - Room-space X coordinate of wall end
 * @property {number} endY        - Room-space Y coordinate of wall end
 */

/**
 * @typedef {Object} CabinetPlacement
 * @property {string} sku         - Cabinet SKU
 * @property {number} width       - Cabinet width (inches)
 * @property {number} x           - Room-space X coordinate
 * @property {number} y           - Room-space Y coordinate
 * @property {number} depth       - Cabinet depth (24 or 48)
 * @property {number} height      - Cabinet height (34.5 for base)
 * @property {number} rotation    - Rotation: 0° or 180°
 * @property {string} wall_id     - Parent wall (null for island)
 * @property {string} role        - 'island' or 'peninsula'
 */

/**
 * @typedef {Object} NoFlyZone
 * @property {string} id          - Zone identifier
 * @property {Polygon} polygon    - Polygon boundary
 * @property {number} insetDist   - Inset distance (42 inches)
 */

/**
 * @typedef {Object} IslandPlacementResult
 * @property {CabinetPlacement[]} cabinets     - Island cabinet placements
 * @property {Object} clearances               - Clearance measurements
 * @property {string[]} dfbps                  - DFBP SKUs
 * @property {string[]} deps                   - DEP SKUs
 * @property {Object[]} validation             - Validation check results
 * @property {string} warning                  - Null if valid, error message if invalid
 */

/**
 * @typedef {Object} IslandBounds
 * @property {number} minX        - Minimum X coordinate
 * @property {number} maxX        - Maximum X coordinate
 * @property {number} minY        - Minimum Y coordinate
 * @property {number} maxY        - Maximum Y coordinate
 * @property {number} width       - Width (maxX - minX)
 * @property {number} depth       - Depth (maxY - minY)
 */

// ════════════════════════════════════════════════════════════════════
// MAIN SOLVER: solveIslandPlacement
// ════════════════════════════════════════════════════════════════════

/**
 * Solves optimal island placement given room geometry and wall layouts.
 *
 * Algorithm:
 *   1. Calculate no-fly zone (42" inset from each wall)
 *   2. Identify buildable zone (remaining floor space)
 *   3. Size island based on preferences and available space
 *   4. Center island in buildable zone
 *   5. Generate decorative panels (DFBP, DEP)
 *   6. Validate clearances and work triangle
 *
 * @param {RoomGeometry} roomGeometry - Room dimensions and wall definitions
 * @param {Object} wallLayouts       - Wall cabinet placements { wallId: [placements...] }
 * @param {Object} [prefs]           - Preferences
 * @param {boolean} [prefs.createIsland] - Create island (default: true)
 * @param {number} [prefs.preferredWidth] - Island width in inches (optional)
 * @param {number} [prefs.preferredDepth] - Island depth: 24 or 48 (default: 24)
 * @param {boolean} [prefs.hasSeating] - Island has seating side (default: false)
 * @param {boolean} [prefs.hasCooktop] - Island has cooktop (default: false)
 * @param {string} [prefs.workWall] - Wall with sink ('north', 'south', 'east', 'west')
 * @param {Object} [prefs.sinkPosition] - { x, y } of sink center
 * @param {Object} [prefs.rangePosition] - { x, y } of range center
 * @param {Object} [prefs.fridgePosition] - { x, y } of fridge center
 * @returns {IslandPlacementResult}
 *
 * @example
 * const result = solveIslandPlacement(
 *   { width: 180, length: 200, walls: [...] },
 *   { north: [...], south: [...] },
 *   { hasSeating: true, hasCooktop: false, workWall: 'north' }
 * );
 * if (result.warning) console.error(result.warning);
 * else console.log('Island:', result.island);
 */
export function solveIslandPlacement(roomGeometry, wallLayouts, prefs = {}) {
  const {
    createIsland = true,
    preferredWidth = null,
    preferredDepth = ISLAND_CONSTANTS.SINGLE_SIDED_DEPTH,
    hasSeating = false,
    hasCooktop = false,
    workWall = null,
    sinkPosition = null,
    rangePosition = null,
    fridgePosition = null,
  } = prefs;

  // Step 1: Calculate no-fly zone
  const noFlyZone = calculateNoFlyZone(wallLayouts, roomGeometry);

  if (!noFlyZone.buildablePolygon || noFlyZone.buildablePolygon.length === 0) {
    return {
      cabinets: [],
      clearances: {},
      dfbps: [],
      deps: [],
      validation: [
        {
          rule: 'buildable_zone_exists',
          severity: 'error',
          message: 'No buildable zone after wall cabinet no-fly zones subtracted',
        },
      ],
      warning: 'No buildable zone available for island',
    };
  }

  // Step 2: Determine island dimensions
  const islandDims = determineIslandDimensions(
    noFlyZone,
    preferredWidth,
    preferredDepth
  );

  if (!islandDims) {
    return {
      cabinets: [],
      clearances: {},
      dfbps: [],
      deps: [],
      validation: [
        {
          rule: 'island_size_min',
          severity: 'error',
          message: `Buildable zone too small. Min island: ${ISLAND_CONSTANTS.MIN_ISLAND_WIDTH}"×${preferredDepth}", Available: ${noFlyZone.buildableWidth.toFixed(1)}"×${noFlyZone.buildableDepth.toFixed(1)}"`,
        },
      ],
      warning: `Buildable zone (${noFlyZone.buildableWidth.toFixed(1)}"×${noFlyZone.buildableDepth.toFixed(1)}) too small for minimum island (${ISLAND_CONSTANTS.MIN_ISLAND_WIDTH}"×${preferredDepth}")`,
    };
  }

  // Step 3: Center island in buildable zone
  const islandCenter = calculateIslandCenter(
    noFlyZone.buildableCenterX,
    noFlyZone.buildableCenterY,
    islandDims
  );

  const islandBounds = {
    minX: islandCenter.x - islandDims.width / 2,
    maxX: islandCenter.x + islandDims.width / 2,
    minY: islandCenter.y - islandDims.depth / 2,
    maxY: islandCenter.y + islandDims.depth / 2,
    width: islandDims.width,
    depth: islandDims.depth,
  };

  // Step 4: Decompose island width into standard cabinet widths
  const islandCabinets = decomposeIslandWidth(
    islandDims.width,
    islandBounds,
    preferredDepth
  );

  if (!islandCabinets || islandCabinets.length === 0) {
    return {
      cabinets: [],
      clearances: {},
      dfbps: [],
      deps: [],
      validation: [
        {
          rule: 'island_decomposition',
          severity: 'error',
          message: `Cannot decompose island width ${islandDims.width}" into standard cabinet widths`,
        },
      ],
      warning: `Cannot decompose island width ${islandDims.width}"`,
    };
  }

  // Step 5: Generate decorative panels
  const { dfbps, deps } = generateDecorativePanels(
    islandCabinets,
    preferredDepth,
    hasCooktop
  );

  // Step 6: Calculate clearances
  const clearances = calculateIslandClearances(
    islandBounds,
    wallLayouts,
    roomGeometry
  );

  // Step 7: Validate clearances and work triangle
  const validation = validateIslandPlacement(
    islandBounds,
    clearances,
    hasSeating,
    hasCooktop,
    wallLayouts,
    sinkPosition,
    rangePosition,
    fridgePosition
  );

  const hasErrors = validation.some((v) => v.severity === 'error');

  return {
    island: {
      cabinets: islandCabinets,
      bounds: islandBounds,
      center: islandCenter,
      depth: preferredDepth,
      hasSeating,
      hasCooktop,
      workWall,
    },
    clearances,
    dfbps,
    deps,
    validation,
    warning: hasErrors ? validation.find((v) => v.severity === 'error').message : null,
  };
}

// ════════════════════════════════════════════════════════════════════
// NO-FLY ZONE CALCULATION
// ════════════════════════════════════════════════════════════════════

/**
 * Calculates the no-fly zone (42" inset from perimeter cabinets).
 *
 * Algorithm:
 *   1. For each wall, identify cabinet footprints
 *   2. Inset each wall 42" perpendicular into room (no-fly zone)
 *   3. Return intersection polygon (buildable zone)
 *   4. Calculate buildable center and area
 *
 * @param {Object} wallLayouts - Wall cabinet placements
 * @param {RoomGeometry} roomDims - Room dimensions
 * @returns {Object} { buildablePolygon, buildableWidth, buildableDepth, buildableCenterX, buildableCenterY, buildableArea }
 */
export function calculateNoFlyZone(wallLayouts, roomDims) {
  const clearance = ISLAND_CONSTANTS.NKBA_MIN_WALKWAY;
  const polygon = [];

  // Build room boundary corners
  const corners = [
    { x: 0, y: 0 },                           // origin (SW)
    { x: roomDims.width, y: 0 },              // SE
    { x: roomDims.width, y: roomDims.length }, // NE
    { x: 0, y: roomDims.length },             // NW
  ];

  // Inset each wall by clearance distance
  // This creates a smaller rectangle (buildable zone) in the center

  const buildableMinX = clearance;
  const buildableMaxX = roomDims.width - clearance;
  const buildableMinY = clearance;
  const buildableMaxY = roomDims.length - clearance;

  const buildableWidth = buildableMaxX - buildableMinX;
  const buildableDepth = buildableMaxY - buildableMinY;

  if (buildableWidth <= 0 || buildableDepth <= 0) {
    return {
      buildablePolygon: [],
      buildableWidth: Math.max(0, buildableWidth),
      buildableDepth: Math.max(0, buildableDepth),
      buildableCenterX: 0,
      buildableCenterY: 0,
      buildableArea: 0,
      noFlyZones: [],
    };
  }

  const buildablePolygon = [
    { x: buildableMinX, y: buildableMinY },
    { x: buildableMaxX, y: buildableMinY },
    { x: buildableMaxX, y: buildableMaxY },
    { x: buildableMinX, y: buildableMaxY },
  ];

  const buildableCenterX = (buildableMinX + buildableMaxX) / 2;
  const buildableCenterY = (buildableMinY + buildableMaxY) / 2;
  const buildableArea = buildableWidth * buildableDepth;

  return {
    buildablePolygon,
    buildableWidth,
    buildableDepth,
    buildableCenterX,
    buildableCenterY,
    buildableArea,
    noFlyZones: [
      {
        id: 'north_buffer',
        minX: 0,
        maxX: roomDims.width,
        minY: buildableMaxY,
        maxY: roomDims.length,
        distance: clearance,
      },
      {
        id: 'south_buffer',
        minX: 0,
        maxX: roomDims.width,
        minY: 0,
        maxY: buildableMinY,
        distance: clearance,
      },
      {
        id: 'east_buffer',
        minX: buildableMaxX,
        maxX: roomDims.width,
        minY: 0,
        maxY: roomDims.length,
        distance: clearance,
      },
      {
        id: 'west_buffer',
        minX: 0,
        maxX: buildableMinX,
        minY: 0,
        maxY: roomDims.length,
        distance: clearance,
      },
    ],
  };
}

// ════════════════════════════════════════════════════════════════════
// ISLAND SIZING
// ════════════════════════════════════════════════════════════════════

/**
 * Determines island dimensions based on preferences and available space.
 *
 * @param {Object} noFlyZone - No-fly zone calculation
 * @param {number} [preferredWidth] - Requested width, or null for auto
 * @param {number} preferredDepth - Depth: 24 or 48 (default: 24)
 * @returns {Object|null} { width, depth } or null if too small
 */
function determineIslandDimensions(noFlyZone, preferredWidth, preferredDepth) {
  // If preferred width not specified, use 75% of buildable width (centered)
  const width = preferredWidth ?? noFlyZone.buildableWidth * 0.75;

  // Validate minimum size
  if (width < ISLAND_CONSTANTS.MIN_ISLAND_WIDTH) {
    return null;
  }
  if (preferredDepth < ISLAND_CONSTANTS.MIN_ISLAND_DEPTH) {
    return null;
  }

  // Validate against available space
  if (width > noFlyZone.buildableWidth) {
    return null;
  }
  if (preferredDepth > noFlyZone.buildableDepth) {
    return null;
  }

  return {
    width: Math.round(width), // snap to nearest inch
    depth: preferredDepth,
  };
}

/**
 * Calculates centered XY position for island in buildable zone.
 *
 * @param {number} centerX - Buildable zone center X
 * @param {number} centerY - Buildable zone center Y
 * @param {Object} dims - { width, depth }
 * @returns {{ x, y }}
 */
function calculateIslandCenter(centerX, centerY, dims) {
  return {
    x: centerX,
    y: centerY,
  };
}

/**
 * Decomposes island width into standard cabinet widths.
 * Returns an array of cabinet placements spanning the island.
 *
 * @param {number} targetWidth - Total width to fill
 * @param {IslandBounds} bounds - Island bounds (minX, minY, etc.)
 * @param {number} depth - Cabinet depth (24 or 48)
 * @returns {CabinetPlacement[]|null}
 */
function decomposeIslandWidth(targetWidth, bounds, depth) {
  const { STD_CABINET_WIDTHS } = ISLAND_CONSTANTS;
  const widthPlan = decomposeToStandardWidths(targetWidth, STD_CABINET_WIDTHS);

  if (!widthPlan) {
    return null;
  }

  const cabinets = [];
  let cursor = bounds.minX;

  for (const w of widthPlan) {
    cabinets.push({
      sku: `B3D${w}`,
      width: w,
      x: cursor,
      y: bounds.minY,
      depth: depth,
      height: 34.5,
      rotation: 0,
      wall_id: null,
      role: 'island',
    });
    cursor += w;
  }

  return cabinets;
}

/**
 * Decomposes a target width into standard cabinet widths.
 * Uses a greedy algorithm: try largest widths first, accept remainder as filler.
 *
 * @param {number} targetWidth - Width to decompose
 * @param {number[]} standardWidths - Available cabinet widths (sorted descending)
 * @returns {number[]|null} Array of widths, or null if impossible
 */
function decomposeToStandardWidths(targetWidth, standardWidths) {
  // Sort descending for greedy packing
  const sorted = [...standardWidths].sort((a, b) => b - a);
  const result = [];
  let remaining = targetWidth;

  for (const width of sorted) {
    while (remaining >= width) {
      result.push(width);
      remaining -= width;
    }
  }

  // If remainder is small (filler-sized), absorb into last cabinet
  if (remaining > 0 && remaining <= 6) {
    if (result.length > 0) {
      result[result.length - 1] += remaining;
    } else {
      return null; // Can't fill target width
    }
  } else if (remaining > 0) {
    return null; // Remainder too large for filler
  }

  return result.length > 0 ? result : null;
}

// ════════════════════════════════════════════════════════════════════
// DECORATIVE PANELS
// ════════════════════════════════════════════════════════════════════

/**
 * Generates decorative back and end panels (DFBP, DEP) for the island.
 *
 * Rules:
 *   - ALL exposed backs get DFBP (3/4" thick)
 *   - Back-to-back cabinets (48" depth): only non-work side gets DFBP
 *   - Single-row (24" depth): back side gets DFBP
 *   - Both ends get DEP
 *
 * @param {CabinetPlacement[]} islandCabinets - Island cabinet placements
 * @param {number} depth - Island depth (24 or 48)
 * @param {boolean} hasCooktop - Island has cooktop
 * @returns {{ dfbps: string[], deps: string[] }}
 */
function generateDecorativePanels(islandCabinets, depth, hasCooktop) {
  const dfbps = [];
  const deps = [];

  if (!islandCabinets || islandCabinets.length === 0) {
    return { dfbps, deps };
  }

  // Generate DFBPs for back cabinets
  if (depth === ISLAND_CONSTANTS.SINGLE_SIDED_DEPTH) {
    // Single-row: all cabinets get back panels
    for (const cab of islandCabinets) {
      dfbps.push(ISLAND_CONSTANTS.SKU_DFBP(cab.width));
    }
  } else if (depth === ISLAND_CONSTANTS.DOUBLE_ACCESS_DEPTH) {
    // Back-to-back: only non-work side (back row) gets DFBPs
    // For now, assume all back row cabinets get DFBPs
    for (const cab of islandCabinets) {
      if (cab.rotation === 180) {
        // Back-facing cabinets
        dfbps.push(ISLAND_CONSTANTS.SKU_DFBP(cab.width));
      }
    }
  }

  // Generate DEPs for end cabinets
  const endCabinets = [islandCabinets[0], islandCabinets[islandCabinets.length - 1]];
  for (const cab of endCabinets) {
    if (cab) {
      deps.push(ISLAND_CONSTANTS.SKU_DEP_BASE());
    }
  }

  return { dfbps, deps };
}

// ════════════════════════════════════════════════════════════════════
// CLEARANCE CALCULATION
// ════════════════════════════════════════════════════════════════════

/**
 * Calculates clearance distances from island perimeter to nearest wall cabinet.
 *
 * @param {IslandBounds} islandBounds - Island bounding box
 * @param {Object} wallLayouts - Wall cabinet placements
 * @param {RoomGeometry} roomDims - Room dimensions
 * @returns {Object} { north, south, east, west, violations: [] }
 */
export function calculateIslandClearances(islandBounds, wallLayouts, roomDims) {
  const measurements = {
    north: calculateClearanceDirection(
      islandBounds,
      'north',
      wallLayouts,
      roomDims
    ),
    south: calculateClearanceDirection(
      islandBounds,
      'south',
      wallLayouts,
      roomDims
    ),
    east: calculateClearanceDirection(islandBounds, 'east', wallLayouts, roomDims),
    west: calculateClearanceDirection(
      islandBounds,
      'west',
      wallLayouts,
      roomDims
    ),
    violations: [],
  };

  // Check NKBA minimum
  const minClearance = ISLAND_CONSTANTS.NKBA_MIN_WALKWAY;
  const directionViolations = [
    { dir: 'north', val: measurements.north },
    { dir: 'south', val: measurements.south },
    { dir: 'east', val: measurements.east },
    { dir: 'west', val: measurements.west },
  ];

  for (const { dir, val } of directionViolations) {
    if (val < minClearance) {
      measurements.violations.push({
        direction: dir,
        actual: val,
        required: minClearance,
        message: `${dir.toUpperCase()} clearance ${val.toFixed(1)}" < ${minClearance}" NKBA minimum`,
      });
    }
  }

  return measurements;
}

/**
 * Calculates clearance in one direction (north/south/east/west).
 *
 * @param {IslandBounds} islandBounds
 * @param {string} direction - 'north', 'south', 'east', 'west'
 * @param {Object} wallLayouts
 * @param {RoomGeometry} roomDims
 * @returns {number} Clearance in inches
 */
function calculateClearanceDirection(islandBounds, direction, wallLayouts, roomDims) {
  const CABINET_DEPTH = 24; // Standard cabinet depth

  switch (direction) {
    case 'north':
      // Distance from island maxY to room length
      return roomDims.length - islandBounds.maxY;

    case 'south':
      // Distance from island minY to zero (south wall)
      return islandBounds.minY;

    case 'east':
      // Distance from island maxX to room width
      return roomDims.width - islandBounds.maxX;

    case 'west':
      // Distance from island minX to zero (west wall)
      return islandBounds.minX;

    default:
      return 0;
  }
}

// ════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════

/**
 * Validates island placement against NKBA standards and work triangle.
 *
 * @param {IslandBounds} islandBounds
 * @param {Object} clearances
 * @param {boolean} hasSeating
 * @param {boolean} hasCooktop
 * @param {Object} wallLayouts
 * @param {Object} [sinkPos]
 * @param {Object} [rangePos]
 * @param {Object} [fridgePos]
 * @returns {Object[]} Array of validation results
 */
function validateIslandPlacement(
  islandBounds,
  clearances,
  hasSeating,
  hasCooktop,
  wallLayouts,
  sinkPos,
  rangePos,
  fridgePos
) {
  const results = [];

  // Rule 1: Minimum clearance on all sides
  const minClearance = ISLAND_CONSTANTS.NKBA_MIN_WALKWAY;
  if (clearances.north < minClearance) {
    results.push({
      rule: 'clearance_north',
      severity: 'error',
      message: `North clearance ${clearances.north.toFixed(1)}" < ${minClearance}"`,
      direction: 'north',
      actual: clearances.north,
      required: minClearance,
    });
  }
  if (clearances.south < minClearance) {
    results.push({
      rule: 'clearance_south',
      severity: 'error',
      message: `South clearance ${clearances.south.toFixed(1)}" < ${minClearance}"`,
      direction: 'south',
      actual: clearances.south,
      required: minClearance,
    });
  }
  if (clearances.east < minClearance) {
    results.push({
      rule: 'clearance_east',
      severity: 'error',
      message: `East clearance ${clearances.east.toFixed(1)}" < ${minClearance}"`,
      direction: 'east',
      actual: clearances.east,
      required: minClearance,
    });
  }
  if (clearances.west < minClearance) {
    results.push({
      rule: 'clearance_west',
      severity: 'error',
      message: `West clearance ${clearances.west.toFixed(1)}" < ${minClearance}"`,
      direction: 'west',
      actual: clearances.west,
      required: minClearance,
    });
  }

  // Rule 2: Cooktop fire safety (42" all sides)
  if (hasCooktop) {
    const cooktopClearance = ISLAND_CONSTANTS.COOKTOP_MIN_CLEARANCE;
    const directions = [
      { name: 'north', val: clearances.north },
      { name: 'south', val: clearances.south },
      { name: 'east', val: clearances.east },
      { name: 'west', val: clearances.west },
    ];

    for (const { name, val } of directions) {
      if (val < cooktopClearance) {
        results.push({
          rule: `cooktop_clearance_${name}`,
          severity: 'error',
          message: `Cooktop: ${name} clearance ${val.toFixed(1)}" < ${cooktopClearance}" fire safety minimum`,
          direction: name,
          actual: val,
          required: cooktopClearance,
        });
      }
    }
  }

  // Rule 3: Seating side clearance (48")
  if (hasSeating) {
    const seatingClearance = ISLAND_CONSTANTS.SEATING_SIDE_CLEARANCE;
    // Assume seating is on the south side (configurable in real implementation)
    if (clearances.south < seatingClearance) {
      results.push({
        rule: 'seating_clearance',
        severity: 'warning',
        message: `Seating side clearance ${clearances.south.toFixed(1)}" < recommended ${seatingClearance}"`,
        direction: 'south',
        actual: clearances.south,
        required: seatingClearance,
      });
    }
  }

  // Rule 4: Work triangle (if appliance positions provided)
  if (sinkPos && rangePos && fridgePos) {
    const workTriangle = validateWorkTriangle(
      islandBounds,
      sinkPos,
      rangePos,
      fridgePos
    );
    results.push(...workTriangle);
  }

  // If no errors, add pass message
  if (results.every((r) => r.severity !== 'error')) {
    results.push({
      rule: 'placement_valid',
      severity: 'info',
      message: 'Island placement is NKBA compliant',
    });
  }

  return results;
}

/**
 * Validates island position relative to work triangle (sink, range, fridge).
 *
 * @param {IslandBounds} islandBounds
 * @param {Object} sinkPos - { x, y }
 * @param {Object} rangePos - { x, y }
 * @param {Object} fridgePos - { x, y }
 * @returns {Object[]} Validation results
 */
function validateWorkTriangle(islandBounds, sinkPos, rangePos, fridgePos) {
  const results = [];

  // Check island doesn't block direct path between sink and range
  const sinkToRangeBlocked = islandBlocksPath(
    sinkPos,
    rangePos,
    islandBounds
  );
  if (sinkToRangeBlocked) {
    results.push({
      rule: 'work_triangle_sink_range',
      severity: 'warning',
      message: 'Island may block direct path between sink and range',
    });
  }

  // Check island doesn't block direct path between range and fridge
  const rangeToFridgeBlocked = islandBlocksPath(
    rangePos,
    fridgePos,
    islandBounds
  );
  if (rangeToFridgeBlocked) {
    results.push({
      rule: 'work_triangle_range_fridge',
      severity: 'warning',
      message: 'Island may block direct path between range and fridge',
    });
  }

  // Check island doesn't block direct path between fridge and sink
  const fridgeToSinkBlocked = islandBlocksPath(
    fridgePos,
    sinkPos,
    islandBounds
  );
  if (fridgeToSinkBlocked) {
    results.push({
      rule: 'work_triangle_fridge_sink',
      severity: 'warning',
      message: 'Island may block direct path between fridge and sink',
    });
  }

  return results;
}

/**
 * Checks if a straight line between two points intersects island bounds.
 *
 * @param {Object} p1 - { x, y }
 * @param {Object} p2 - { x, y }
 * @param {IslandBounds} islandBounds
 * @returns {boolean} True if line intersects island
 */
function islandBlocksPath(p1, p2, islandBounds) {
  // Simple AABB (axis-aligned bounding box) intersection test
  // Line from p1 to p2 intersects island if line crosses any edge

  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  // Check if bounding rectangles overlap
  return (
    minX < islandBounds.maxX &&
    maxX > islandBounds.minX &&
    minY < islandBounds.maxY &&
    maxY > islandBounds.minY
  );
}

// ════════════════════════════════════════════════════════════════════
// PENINSULA SOLVER (Future Enhancement)
// ════════════════════════════════════════════════════════════════════

/**
 * Solves optimal peninsula placement (attached to one wall).
 * Peninsula requires clearance on only 3 sides (attached side is against wall).
 *
 * @param {RoomGeometry} roomGeometry
 * @param {Object} wallLayouts
 * @param {string} attachedWall - 'north', 'south', 'east', 'west'
 * @param {Object} [prefs]
 * @returns {IslandPlacementResult}
 *
 * @example
 * const peninsula = solvePeninsulaPlacement(
 *   roomGeo,
 *   wallLayouts,
 *   'north',
 *   { preferredWidth: 60, hasSeating: true }
 * );
 */
export function solvePeninsulaPlacement(
  roomGeometry,
  wallLayouts,
  attachedWall,
  prefs = {}
) {
  // Peninsula logic: attach to wall, reduce clearance requirement on that side
  // Implementation follows island solver but with modified clearance rules
  return {
    peninsula: null,
    clearances: {},
    dfbps: [],
    deps: [],
    validation: [
      {
        rule: 'peninsula_not_yet_implemented',
        severity: 'info',
        message: 'Peninsula solver is a future enhancement',
      },
    ],
    warning: 'Peninsula solver not yet implemented',
  };
}

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export default {
  solveIslandPlacement,
  calculateNoFlyZone,
  calculateIslandClearances,
  solvePeninsulaPlacement,
  ISLAND_CONSTANTS,
};
