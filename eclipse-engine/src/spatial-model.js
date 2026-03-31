/**
 * Eclipse Kitchen Designer — Spatial Model
 * ==========================================
 * Single source of truth for all spatial relationships in kitchen layouts.
 *
 * Manages:
 *   - Wall elevation models (vertical zones)
 *   - Depth plane relationships (Z-axis positioning)
 *   - Cross-wall topology and sight lines
 *   - Cabinet placement validation
 *   - Visual balance scoring
 *
 * Coordinate system:
 *   X: horizontal along wall (left-to-right)
 *   Y: vertical height (floor-to-ceiling)
 *   Z: depth projection (away from wall)
 */

import { DIMS } from './constraints.js';

// ─── VERTICAL ELEVATION ZONES ──────────────────────────────────────────────
// Each wall elevation is organized into distinct vertical zones.
// Cabinets are positioned within these zones; some zones are "closed" (nothing allowed).

export const VERTICAL_ZONES = {
  TOE_KICK: {
    yMin: 0,
    yMax: 4,
    depth: 0,
    description: 'Toe kick recessed zone',
    allowsContent: false,
  },
  BASE: {
    yMin: 4,
    yMax: 34.5,
    depth: 24.875,
    description: 'Standard base cabinet zone (30.5" height, 24.875" depth incl door)',
    allowsContent: true,
    contentTypes: ['base', 'sink_base', 'appliance'],
  },
  COUNTER: {
    yMin: 34.5,
    yMax: 36,
    depth: 26.375,  // 24.875" base + 1.5" overhang
    description: 'Counter surface + overhang',
    allowsContent: false,
  },
  BACKSPLASH: {
    yMin: 36,
    yMax: 54,
    depth: 0,
    description: 'Backsplash zone — STRICTLY PROHIBITED for cabinets (tile only)',
    allowsContent: false,
    isProhibited: true,
  },
  UPPER: {
    yMin: 54,
    yMax: null,  // varies based on cabinet height
    depth: 13.875,
    description: 'Upper cabinet zone (13.875" depth incl door, height varies 30-54")',
    allowsContent: true,
    contentTypes: ['upper'],
  },
  CROWN: {
    yMin: null,
    yMax: null,
    depth: 13.875,
    description: 'Crown molding zone (fills to ceiling)',
    allowsContent: false,
  },
};

// Special zones that replace the standard vertical stack
export const SPECIAL_ZONES = {
  TALL_APPLIANCE: {
    yMin: 0,
    yMax: 84,
    depth: null,  // depends on appliance
    description: 'Refrigerator, freezer, wine column (84" tall)',
    contentTypes: ['refrigerator', 'freezer', 'wine_column'],
  },
  TALL_CABINET: {
    yMin: 0,
    yMax: null,  // 84-96" varies
    depth: 24.875,
    description: 'Tall pantry, oven tower, utility tower (full height)',
    contentTypes: ['tall_cabinet', 'oven_tower', 'pantry'],
  },
  ABOVE_TALL: {
    yMin: 84,
    yMax: null,  // varies with ceiling
    depth: 13.875,
    description: 'Wall cabinet above tall appliance/cabinet',
    contentTypes: ['upper', 'short_wall_cab'],
  },
  HOOD_ZONE: {
    yMin: 54,
    yMax: null,  // 78"+ depends on hood height
    depth: 0,
    description: 'Range hood zone (above cooktop, 54"–78"+)',
    contentTypes: ['hood'],
  },
};

// ─── DEPTH TIERS ──────────────────────────────────────────────────────────
// Z-axis positioning for different cabinet types within a wall.

export const DEPTH_TIERS = {
  // Wall & upper cabinet positioning (includes 7/8" door)
  WALL_FACE: 0,
  UPPER_BACK: 0,
  UPPER_FRONT: 13.875,       // 13" body + 7/8" door

  // Base cabinet positioning (includes 7/8" door)
  BASE_BACK: 0,
  BASE_FRONT: 24.875,        // 24" body + 7/8" door

  // Counter
  COUNTER_FRONT: 26.375,     // 24.875" base + 1.5" overhang

  // Appliance depths (physical appliance dimensions, no door addition)
  FRIDGE_STANDARD: 27,
  FRIDGE_PRO: 30,
  COOKTOP_SURFACE: 21,
  RANGE_STANDARD: 25,
  MICROWAVE_MOUNTED: 16,
  DISHWASHER: 24,
};

// ─── TALL APPLIANCE HEIGHTS ─────────────────────────────────────────────────

export const TALL_APPLIANCE_HEIGHTS = {
  refrigerator: 84,
  freezer: 84,
  wineColumn: 84,
  wallOven: 51,     // double wall oven
  singleOven: 30,
  wallOvenTower: 93,  // double wall oven + cabinet above
};

// ─── SPATIAL MODEL STRUCTURE ────────────────────────────────────────────────

/**
 * Spatial model for a complete kitchen layout.
 * Manages wall elevations, depth relationships, and cross-wall topology.
 *
 * Structure:
 * {
 *   roomType: string,
 *   walls: Map<wallId, WallElevation>,
 *   appliances: Map<applianceId, Appliance>,
 *   corners: Map<cornerKey, CornerInfo>,
 *   sightLines: Map<viewKey, SightLine>,
 *   visualAnchors: Anchor[],
 *   preferences: object,
 * }
 */

/**
 * Wall elevation model.
 * Represents the vertical organization of a single wall.
 *
 * {
 *   wallId: string,
 *   direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST',
 *   length: number (in inches),
 *   cabinets: {
 *     base: Cabinet[],
 *     upper: Cabinet[],
 *     tall: Cabinet[],
 *   },
 *   appliances: Appliance[],
 *   zoneOccupancy: Map<zoneName, number[]>,  // X ranges occupied per zone
 *   depthProfile: Map<X, Z>,  // depth at each X coordinate
 *   visualBalance: number,  // 0-1 score
 * }
 */

// ─── BUILD SPATIAL MODEL ───────────────────────────────────────────────────

/**
 * Build the spatial model for a complete layout.
 *
 * @param {Object} walls - Map or array of wall definitions
 * @param {Object} appliances - Map or array of appliances
 * @param {Object} corners - Corner definitions
 * @param {Object} prefs - Design preferences
 * @returns {Object} Complete spatial model
 */
export function buildSpatialModel(walls, appliances, corners, prefs = {}) {
  const ceilingH = prefs.ceilingHeight || DIMS.standardCeiling;
  const model = {
    roomType: prefs.roomType || 'kitchen',
    walls: {},          // wallId → wall elevation object
    appliances: [],     // flat array of all appliances
    corners: [],        // flat array of corner objects
    crossWall: null,    // built after init
    visualAnchors: [],
    preferences: prefs,
    ceiling: ceilingH,
  };

  // Initialize wall elevations
  const wallArr = Array.isArray(walls) ? walls : [];
  for (const wall of wallArr) {
    const wallElev = initializeWallElevation(wall.id, wall, ceilingH);
    model.walls[wall.id] = wallElev;
  }

  // Register appliances on their walls + identify tall appliances
  const appArr = Array.isArray(appliances) ? appliances : [];
  for (const app of appArr) {
    model.appliances.push(app);
    if (app.wall && model.walls[app.wall]) {
      model.walls[app.wall].appliances.push(app);
      // Mark tall appliances that create special vertical zones
      const tallH = TALL_APPLIANCE_HEIGHTS[app.type];
      if (tallH) {
        model.walls[app.wall].tallAppliances.push({
          type: app.type,
          width: app.width,
          height: tallH,
          position: app.position || null,
          depth: DEPTH_TIERS[app.type === 'refrigerator' ? 'FRIDGE_STANDARD' : 'BASE_FRONT'],
        });
      }
    }
  }

  // Register corners
  const cornerArr = Array.isArray(corners) ? corners : [];
  model.corners = cornerArr;

  // Build cross-wall topology
  buildCrossWallGraph(model);

  return model;
}

/**
 * Initialize a wall elevation.
 * Sets up zone occupancy tracking and depth profile.
 */
function initializeWallElevation(wallId, wallDef) {
  return {
    wallId,
    direction: wallDef.direction || 'NORTH',
    length: wallDef.length || 120,
    cabinets: {
      base: [],
      upper: [],
      tall: [],
    },
    appliances: [],
    tallAppliances: [],    // tall appliances creating special vertical zones
    zoneOccupancy: {
      TOE_KICK: [],
      BASE: [],
      COUNTER: [],
      BACKSPLASH: [],
      UPPER: [],
      CROWN: [],
    },
    depthProfile: {},      // X coordinate -> Z depth
    visualBalance: 0,
    doorSwings: [],        // door swing clearance zones
  };
}

// ─── WALL ELEVATION QUERIES ────────────────────────────────────────────────

/**
 * Get the elevation zones for a specific wall.
 * Returns the full vertical structure of the wall.
 *
 * @param {Object} model - Spatial model
 * @param {string} wallId - Wall identifier
 * @returns {Object} Wall elevation
 */
export function getWallElevation(model, wallId) {
  return model.walls[wallId];
}

/**
 * Get the vertical zone containing a given Y coordinate.
 *
 * @param {number} y - Height in inches
 * @param {Object} model - Spatial model (for ceiling height)
 * @returns {string} Zone name
 */
export function getZoneAtHeight(y, model = {}) {
  const ceiling = model.ceiling || DIMS.standardCeiling;

  if (y >= 0 && y <= VERTICAL_ZONES.TOE_KICK.yMax) return 'TOE_KICK';
  if (y > VERTICAL_ZONES.TOE_KICK.yMax && y <= VERTICAL_ZONES.BASE.yMax) return 'BASE';
  if (y > VERTICAL_ZONES.BASE.yMax && y <= VERTICAL_ZONES.COUNTER.yMax) return 'COUNTER';
  if (y > VERTICAL_ZONES.COUNTER.yMax && y < VERTICAL_ZONES.BACKSPLASH.yMax) return 'BACKSPLASH';
  if (y >= VERTICAL_ZONES.BACKSPLASH.yMax && y < 84) return 'UPPER';  // 54" is bottom of uppers
  if (y >= 84) return 'ABOVE_TALL';

  return 'UNKNOWN';
}

/**
 * Get the depth tier for a cabinet type.
 *
 * @param {string} cabinetType - Type of cabinet
 * @param {Object} placement - Cabinet placement details
 * @returns {number} Z depth in inches
 */
export function getDepthTier(cabinetType, placement = {}) {
  // Normalize type
  const type = (cabinetType || '').toLowerCase();

  if (type.includes('upper') || type.includes('u')) return DEPTH_TIERS.UPPER_FRONT;
  if (type.includes('base') || type.includes('b')) return DEPTH_TIERS.BASE_FRONT;
  if (type.includes('sink') || type.includes('sb')) return DEPTH_TIERS.BASE_FRONT;
  if (type.includes('counter') || type.includes('top')) return DEPTH_TIERS.COUNTER_FRONT;

  // Appliances
  if (type.includes('fridge') || type.includes('ref')) {
    return placement.isProBuilt ? DEPTH_TIERS.FRIDGE_PRO : DEPTH_TIERS.FRIDGE_STANDARD;
  }
  if (type.includes('cooktop') || type.includes('cook')) return DEPTH_TIERS.COOKTOP_SURFACE;
  if (type.includes('range')) return DEPTH_TIERS.RANGE_STANDARD;
  if (type.includes('dishwasher') || type.includes('dw')) return DEPTH_TIERS.DISHWASHER;

  // Default to base
  return DEPTH_TIERS.BASE_FRONT;
}

// ─── PLACEMENT VALIDATION ────────────────────────────────────────────────────

/**
 * Validate if a cabinet placement violates spatial rules.
 * Checks zone boundaries, depth constraints, and adjacency conflicts.
 *
 * @param {Object} model - Spatial model
 * @param {string} wallId - Wall identifier
 * @param {Object} placement - {xMin, xMax, yMin, yMax, type, depth}
 * @returns {Object} {valid: boolean, violations: string[]}
 */
export function validatePlacement(model, wallId, placement) {
  const violations = [];
  const wall = model.walls[wallId];

  if (!wall) {
    violations.push(`Wall ${wallId} not found`);
    return { valid: false, violations };
  }

  // Check if placement exceeds wall length
  if (placement.xMin < 0 || placement.xMax > wall.length) {
    violations.push(`Placement exceeds wall boundaries (0–${wall.length})`);
  }

  // Check zone boundaries
  const yStart = getZoneAtHeight(placement.yMin, model);
  const yEnd = getZoneAtHeight(placement.yMax, model);

  // Backsplash zone is strictly prohibited
  if (yStart === 'BACKSPLASH' || yEnd === 'BACKSPLASH') {
    violations.push('Backsplash zone (36"–54") is prohibited for cabinets');
  }

  // Check for zone conflicts
  const zoneOccupancy = wall.zoneOccupancy[yStart] || [];
  const xRange = [placement.xMin, placement.xMax];
  const overlaps = zoneOccupancy.some(existing => rangesOverlap(xRange, existing));
  if (overlaps) {
    violations.push(`Placement overlaps existing cabinet in ${yStart} zone`);
  }

  // Validate depth constraints
  const expectedDepth = getDepthTier(placement.type);
  if (placement.depth && Math.abs(placement.depth - expectedDepth) > 2) {
    violations.push(`Depth mismatch: expected ~${expectedDepth}", got ${placement.depth}"`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Check if two X-axis ranges overlap.
 */
function rangesOverlap(range1, range2) {
  return range1[0] < range2[1] && range1[1] > range2[0];
}

// ─── ELEVATION COMPOSITION ────────────────────────────────────────────────────

/**
 * Compose a wall's cabinets into a proper elevation with Y/Z coordinates.
 * Assigns each cabinet to its zone, calculates positions, and validates the result.
 *
 * @param {Object} model - Spatial model
 * @param {string} wallId - Wall identifier
 * @param {Array} baseCabs - Base cabinet placements
 * @param {Array} upperCabs - Upper cabinet placements
 * @param {Array} tallCabs - Tall cabinet placements
 * @param {Array} appliances - Appliances
 * @returns {Object} Composed elevation with cabinets positioned {cabinets: [], valid: boolean}
 */
export function composeElevation(
  model,
  wallId,
  baseCabs = [],
  upperCabs = [],
  tallCabs = [],
  appliances = []
) {
  const wall = model.walls[wallId];
  if (!wall) {
    return { valid: false, error: `Wall ${wallId} not found`, cabinets: [] };
  }

  const composed = [];
  const errors = [];

  // Process base cabinets
  baseCabs.forEach(cab => {
    const placement = {
      ...cab,
      yMin: VERTICAL_ZONES.BASE.yMin,
      yMax: VERTICAL_ZONES.BASE.yMax,
      z: DEPTH_TIERS.BASE_FRONT,
    };

    const validation = validatePlacement(model, wallId, placement);
    if (!validation.valid) {
      errors.push(...validation.violations);
    } else {
      composed.push(placement);
      recordZoneOccupancy(wall, 'BASE', [cab.xMin, cab.xMax]);
    }
  });

  // Process upper cabinets
  upperCabs.forEach(cab => {
    const cabHeight = cab.height || 30;  // Default upper cabinet height
    const placement = {
      ...cab,
      yMin: VERTICAL_ZONES.UPPER.yMin,
      yMax: VERTICAL_ZONES.UPPER.yMin + cabHeight,
      z: DEPTH_TIERS.UPPER_FRONT,
    };

    const validation = validatePlacement(model, wallId, placement);
    if (!validation.valid) {
      errors.push(...validation.violations);
    } else {
      composed.push(placement);
      recordZoneOccupancy(wall, 'UPPER', [cab.xMin, cab.xMax]);
    }
  });

  // Process tall cabinets
  tallCabs.forEach(cab => {
    const cabHeight = cab.height || 84;
    const placement = {
      ...cab,
      yMin: 0,
      yMax: cabHeight,
      z: DEPTH_TIERS.BASE_FRONT,
      isTall: true,
    };

    // Tall cabinets skip zone validation (special case)
    composed.push(placement);
  });

  // Track appliances
  appliances.forEach(app => {
    const appHeight = TALL_APPLIANCE_HEIGHTS[app.type] || 84;
    const appDepth = getDepthTier(app.type);

    const placement = {
      ...app,
      yMin: 0,
      yMax: appHeight,
      z: appDepth,
      isAppliance: true,
    };

    composed.push(placement);
  });

  // Calculate visual balance
  const balance = calculateElevationBalance(composed, wall.length);

  return {
    valid: errors.length === 0,
    errors,
    cabinets: composed,
    balance,
  };
}

/**
 * Record X-range occupancy in a zone.
 */
function recordZoneOccupancy(wall, zone, xRange) {
  if (!wall.zoneOccupancy[zone]) wall.zoneOccupancy[zone] = [];
  wall.zoneOccupancy[zone].push(xRange);
}

// ─── VISUAL BALANCE SCORING ────────────────────────────────────────────────

/**
 * Score visual balance of a wall elevation.
 * Evaluates:
 *   - Symmetry (anchors at both ends)
 *   - Focal point (tall element or appliance positioned prominently)
 *   - Height variation (not all same height)
 *
 * @param {Array} cabinets - Composed cabinet placements
 * @param {number} wallLength - Wall length in inches
 * @returns {number} Balance score (0–1)
 */
export function calculateElevationBalance(cabinets, wallLength) {
  if (!cabinets || cabinets.length === 0) return 0;

  let score = 0;
  let checks = 0;

  // Check 1: Are there cabinets at both ends? (anchoring)
  const xPositions = cabinets.map(c => c.xMin);
  const hasLeftAnchor = xPositions.some(x => x < wallLength * 0.25);
  const hasRightAnchor = xPositions.some(x => x > wallLength * 0.75);
  checks++;
  if (hasLeftAnchor && hasRightAnchor) score += 0.35;

  // Check 2: Is there a tall element (fridge, pantry, oven tower)?
  const hasTall = cabinets.some(c => c.yMax >= 84 || c.isTall);
  checks++;
  if (hasTall) score += 0.35;

  // Check 3: Height variety (not all same)
  const heights = cabinets.map(c => c.yMax - c.yMin);
  const uniqueHeights = new Set(heights);
  checks++;
  if (uniqueHeights.size >= 2) score += 0.30;

  // Normalize
  return Math.min(1, score / checks * 3);
}

/**
 * Score visual balance of a complete wall (convenience wrapper).
 *
 * @param {Object} model - Spatial model
 * @param {string} wallId - Wall identifier
 * @returns {number} Balance score (0–1)
 */
export function scoreElevationBalance(model, wallId) {
  const wall = model.walls[wallId];
  if (!wall || wall.cabinets.base.length === 0) return 0;

  const allCabs = [
    ...wall.cabinets.base,
    ...wall.cabinets.upper,
    ...wall.cabinets.tall,
  ];

  return calculateElevationBalance(allCabs, wall.length);
}

// ─── CROSS-WALL TOPOLOGY ────────────────────────────────────────────────────

/**
 * Build cross-wall relationship graph.
 * Tracks adjacency, corners, sight lines, and visual anchors.
 */
function buildCrossWallGraph(model) {
  const wallIds = Object.keys(model.walls);

  // Initialize cross-wall data
  model.sightLines = {};

  // Identify wall pairs by direction
  const wallsByDirection = {};
  wallIds.forEach(id => {
    const wall = model.walls[id];
    const dir = wall.direction;
    if (!wallsByDirection[dir]) wallsByDirection[dir] = [];
    wallsByDirection[dir].push(id);
  });

  // Register corners as sight lines
  for (const corner of model.corners) {
    const wall1 = corner.wall1 || corner.wallA;
    const wall2 = corner.wall2 || corner.wallB;
    if (wall1 && wall2) {
      const consumption = corner.consumption || 2;
      model.sightLines[`view-${wall1}→${wall2}`] = {
        from: wall1,
        to: wall2,
        consumption,
      };
    }
  }

  // Identify visual anchors (tall elements)
  for (const app of model.appliances) {
    if (TALL_APPLIANCE_HEIGHTS[app.type] >= 84) {
      model.visualAnchors.push({
        type: app.type,
        height: TALL_APPLIANCE_HEIGHTS[app.type],
        wallId: app.wall,
        x: app.position || app.x,
      });
    }
  }

  for (const wallId of wallIds) {
    const wall = model.walls[wallId];
    wall.cabinets.tall.forEach(cab => {
      model.visualAnchors.push({
        type: 'tall_cabinet',
        height: cab.height || 84,
        wallId,
        x: cab.xMin,
      });
    });
  }
}

/**
 * Get cross-wall relationship graph.
 *
 * @param {Object} model - Spatial model
 * @returns {Object} Graph with adjacency and sight lines
 */
export function getCrossWallGraph(model) {
  return {
    walls: Object.keys(model.walls),
    corners: model.corners,
    sightLines: model.sightLines || {},
    visualAnchors: model.visualAnchors,
  };
}

// ─── ZONE DEPTH RULES ───────────────────────────────────────────────────────

/**
 * Get the standard depth for a zone.
 * Used to enforce depth constraints per vertical zone.
 *
 * @param {string} zoneName - Zone name
 * @returns {number} Standard depth in inches
 */
export function getZoneDepth(zoneName) {
  const zone = VERTICAL_ZONES[zoneName] || SPECIAL_ZONES[zoneName];
  return zone ? zone.depth : 0;
}

/**
 * Check if a zone allows cabinet content.
 *
 * @param {string} zoneName - Zone name
 * @returns {boolean} True if zone accepts cabinets
 */
export function zoneAllowsContent(zoneName) {
  const zone = VERTICAL_ZONES[zoneName];
  return zone ? zone.allowsContent : false;
}

/**
 * Get all zones that are prohibited for cabinet placement.
 *
 * @returns {string[]} Array of prohibited zone names
 */
export function getProhibitedZones() {
  return Object.entries(VERTICAL_ZONES)
    .filter(([_, zone]) => zone.isProhibited)
    .map(([name]) => name);
}

// ─── DEPTH PROFILE UTILITIES ────────────────────────────────────────────────

/**
 * Record depth at a point on a wall.
 * Updates the depth profile for visual/clearance calculations.
 *
 * @param {Object} wall - Wall elevation
 * @param {number} x - X coordinate
 * @param {number} z - Z depth
 */
export function recordDepth(wall, x, z) {
  wall.depthProfile[x] = (wall.depthProfile[x] || 0) + z;
}

/**
 * Get maximum depth at a given X coordinate.
 *
 * @param {Object} wall - Wall elevation
 * @param {number} x - X coordinate
 * @returns {number} Maximum Z depth at X
 */
export function getMaxDepthAt(wall, x) {
  return wall.depthProfile[x] || 0;
}

/**
 * Get average wall depth across all X coordinates.
 *
 * @param {Object} wall - Wall elevation
 * @returns {number} Average depth
 */
export function getAverageWallDepth(wall) {
  const vals = Object.values(wall.depthProfile);
  if (vals.length === 0) return 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
}

// ─── VERTICAL STACKING RULES ────────────────────────────────────────────────
// Defines which cabinet categories can stack above/below others,
// minimum/maximum gaps between them, and alignment requirements.

const STACKING_RULES = {
  // What can go above a base cabinet?
  BASE: {
    allowedAbove: ['UPPER', 'HOOD_ZONE'],
    minGap: 18,   // min backsplash clearance (NKBA: 18" min counter-to-upper)
    maxGap: 24,   // max backsplash height before it looks wrong
    alignX: true, // uppers should align with base edges
  },
  // What can go above a tall appliance?
  TALL_APPLIANCE: {
    allowedAbove: ['ABOVE_TALL'],  // only short wall cabs (RW)
    minGap: 0,
    maxGap: 3,    // tight fit above fridge
    alignX: true,
  },
  // What can go above a tall cabinet?
  TALL_CABINET: {
    allowedAbove: [],  // nothing goes above a 96" tall
    minGap: 0,
    maxGap: 0,
    alignX: false,
  },
  // Hood zone constraints
  HOOD_ZONE: {
    allowedAbove: [],
    minGap: 0,
    maxGap: 0,
    alignX: true,
  },
  // Upper cabinets — crown molding goes above, nothing structural
  UPPER: {
    allowedAbove: ['CROWN'],
    minGap: 0,
    maxGap: 0,
    alignX: false,
  },
};

/**
 * Validate vertical stacking relationships for a wall.
 * Checks that items above bases are in allowed categories,
 * gaps are within min/max, and X alignment is maintained.
 *
 * @param {Array} placements - All placements for one wall, each with _elev data
 * @returns {Array} Array of {severity, rule, message} violations
 */
export function validateStacking(placements) {
  const violations = [];
  if (!placements || placements.length < 2) return violations;

  // Group by zone
  const byZone = {};
  for (const p of placements) {
    const zone = p._elev?.zone || 'BASE';
    if (!byZone[zone]) byZone[zone] = [];
    byZone[zone].push(p);
  }

  // Check base-to-upper stacking
  const bases = byZone['BASE'] || [];
  const uppers = byZone['UPPER'] || [];

  for (const base of bases) {
    const baseLeft = base.position ?? 0;
    const baseRight = baseLeft + (base.width || 0);

    // Find uppers that overlap this base's X range
    const stackedAbove = uppers.filter(u => {
      const uLeft = u.position ?? 0;
      const uRight = uLeft + (u.width || 0);
      return uLeft < baseRight && uRight > baseLeft;
    });

    for (const upper of stackedAbove) {
      // Gap is measured from COUNTER TOP (36") to upper bottom, not from cabinet top.
      // Counter is always at VERTICAL_ZONES.COUNTER.yMax regardless of base cabinet height.
      const counterTop = VERTICAL_ZONES.COUNTER.yMax;  // 36"
      const upperBottom = upper._elev?.yMount || VERTICAL_ZONES.UPPER.yMin;  // 54"
      const gap = upperBottom - counterTop;

      // Check gap range (backsplash height)
      if (gap < STACKING_RULES.BASE.minGap - 1) {
        violations.push({
          severity: 'error',
          rule: 'stacking_gap_too_small',
          message: `Upper ${upper.sku} is only ${gap.toFixed(1)}" above counter (min ${STACKING_RULES.BASE.minGap}")`,
        });
      }
      if (gap > STACKING_RULES.BASE.maxGap + 1) {
        violations.push({
          severity: 'warning',
          rule: 'stacking_gap_too_large',
          message: `${gap.toFixed(1)}" gap between counter and ${upper.sku} — backsplash zone is unusually tall`,
        });
      }
    }
  }

  // Check that nothing sits in the backsplash zone (36-54")
  for (const p of placements) {
    const yMount = p._elev?.yMount || 0;
    const yTop = p._elev?.yTop || 0;
    // Check if cabinet overlaps the backsplash zone (36-54")
    if (yMount > 36 && yMount < 54 && p._elev?.zone !== 'UPPER' && p._elev?.zone !== 'TALL') {
      violations.push({
        severity: 'error',
        rule: 'backsplash_violation',
        message: `${p.sku} mounts at ${yMount}" — inside the protected backsplash zone (36-54")`,
      });
    }
  }

  return violations;
}

// ─── DEPTH CONFLICT DETECTION ───────────────────────────────────────────────

/**
 * Detect depth conflicts between adjacent placements on a wall.
 * Flags when items with different depths are side-by-side without proper
 * transition handling (fillers, panels, or intentional offsets).
 *
 * Common conflicts:
 *   - Fridge (27") next to base cabinet (24") → needs filler panel
 *   - Range (25") next to base (24") → minor, acceptable
 *   - Pro fridge (30") next to base → needs panel + spacer
 *
 * @param {Array} placements - All placements for one wall, sorted by X position
 * @returns {Array} Array of {severity, rule, message, suggestion} conflicts
 */
export function detectDepthConflicts(placements) {
  const conflicts = [];
  if (!placements || placements.length < 2) return conflicts;

  // Sort by X position
  const sorted = placements
    .filter(p => typeof p.position === 'number' && p._elev)
    .sort((a, b) => a.position - b.position);

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];

    // Only check items in the same vertical zone
    if (curr._elev.zone !== next._elev.zone) continue;

    const currDepth = curr._elev.depth || 0;
    const nextDepth = next._elev.depth || 0;
    const diff = Math.abs(currDepth - nextDepth);

    if (diff >= 3) {
      // Significant depth mismatch (3"+)
      const deeper = currDepth > nextDepth ? curr : next;
      const shallower = currDepth > nextDepth ? next : curr;

      conflicts.push({
        severity: diff >= 6 ? 'warning' : 'info',
        rule: 'depth_conflict',
        message: `Depth mismatch: ${deeper.sku} (${currDepth > nextDepth ? currDepth : nextDepth}" deep) adjacent to ${shallower.sku} (${currDepth > nextDepth ? nextDepth : currDepth}" deep) — ${diff}" difference`,
        suggestion: diff >= 6
          ? 'Consider adding a filler panel or end panel between these items'
          : 'Minor depth difference — visually acceptable with counter overhang',
        items: [deeper.sku, shallower.sku],
        depthDiff: diff,
      });
    }
  }

  return conflicts;
}

/**
 * Run full 3D spatial validation on a complete layout.
 * Combines stacking rules + depth conflict detection.
 *
 * @param {Array} placements - All placements with _elev data
 * @param {Object} wallMap - Map of wallId -> array of placements
 * @returns {Array} Combined violations and conflicts
 */
export function validate3DSpatial(placements, wallMap) {
  const issues = [];

  // Group placements by wall if wallMap not provided
  if (!wallMap) {
    wallMap = {};
    for (const p of placements) {
      const w = p.wall || 'unknown';
      if (!wallMap[w]) wallMap[w] = [];
      wallMap[w].push(p);
    }
  }

  // Run per-wall validations
  for (const [wallId, wallPlacements] of Object.entries(wallMap)) {
    const stackIssues = validateStacking(wallPlacements);
    const depthIssues = detectDepthConflicts(wallPlacements);

    for (const issue of [...stackIssues, ...depthIssues]) {
      issue.wall = wallId;
      issues.push(issue);
    }
  }

  return issues;
}

export default {
  VERTICAL_ZONES,
  SPECIAL_ZONES,
  DEPTH_TIERS,
  TALL_APPLIANCE_HEIGHTS,
  buildSpatialModel,
  getWallElevation,
  getZoneAtHeight,
  getDepthTier,
  validatePlacement,
  composeElevation,
  calculateElevationBalance,
  scoreElevationBalance,
  getCrossWallGraph,
  getZoneDepth,
  zoneAllowsContent,
  getProhibitedZones,
  recordDepth,
  getMaxDepthAt,
  getAverageWallDepth,
  validateStacking,
  detectDepthConflicts,
  validate3DSpatial,
};
