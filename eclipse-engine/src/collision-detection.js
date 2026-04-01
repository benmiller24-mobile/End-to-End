/**
 * Eclipse Kitchen Designer — Appliance Door Swing Collision Detection
 * ===================================================================
 *
 * Detects and validates appliance door swing arcs against walls, islands,
 * other appliances, and cabinet doors. Provides auto-fix recommendations
 * and clearance envelope analysis.
 *
 * Coordinate system (Plan View):
 *   X: horizontal along wall (left-to-right)
 *   Y: depth from wall (0 = wall surface, positive = into room)
 *   Z: height from floor (for reference only; swings are 2D in XY plane)
 *
 * Door swing types:
 *   - ROTATIONAL: hinged doors (fridge, oven, wall oven, cabinets)
 *   - DROP_DOWN: drawer-style (dishwasher, microwave drawer)
 *   - SLIDE_OUT: telescoping slides (trash, pullout baskets)
 *
 * @module collision-detection
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: SWING ARC SPECIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Swing arc properties for each appliance type.
 * Defines door geometry, hinge position, arc angle, and required clearances.
 *
 * @type {Object<string, Object>}
 */
export const SWING_ARC_SPECS = {
  // ─── REFRIGERATORS ─────────────────────────────────────────────────────
  'french-door-36': {
    type: 'refrigerator',
    subtype: 'french-door',
    width: 36,
    doorConfig: 'dual',  // left + right doors
    doorsPerSide: 1,
    doorWidthEach: 17,  // each door ~17" wide
    swingAngle: 90,  // degrees
    arcRadius: 17,  // from hinge to door edge
    sideSwingClearance: 15,  // additional clearance for crisper drawers
    frontClearance: 0,  // hinged doors don't extend forward
    appliedHeightMin: 80,
    appliedHeightMax: 84,
    appliedDepth: 24,
    hingeSides: ['left', 'right'],  // each door on opposite side
    notes: 'Both doors swing outward; requires equal clearance on both sides',
  },

  'french-door-42': {
    type: 'refrigerator',
    subtype: 'french-door',
    width: 42,
    doorConfig: 'dual',
    doorsPerSide: 1,
    doorWidthEach: 21,
    swingAngle: 90,
    arcRadius: 21,
    sideSwingClearance: 15,
    frontClearance: 0,
    appliedHeightMin: 80,
    appliedHeightMax: 84,
    appliedDepth: 24,
    hingeSides: ['left', 'right'],
    notes: 'Larger French door; increased arc radius',
  },

  'french-door-48': {
    type: 'refrigerator',
    subtype: 'french-door',
    width: 48,
    doorConfig: 'dual',
    doorsPerSide: 1,
    doorWidthEach: 24,
    swingAngle: 90,
    arcRadius: 24,
    sideSwingClearance: 15,
    frontClearance: 0,
    appliedHeightMin: 80,
    appliedHeightMax: 84,
    appliedDepth: 24,
    hingeSides: ['left', 'right'],
    notes: '48" wide French door',
  },

  'single-door-fridge-30': {
    type: 'refrigerator',
    subtype: 'single-door',
    width: 30,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 28,  // approximately full width
    swingAngle: 90,
    arcRadius: 28,
    sideSwingClearance: 4,  // minimal side clearance
    frontClearance: 0,
    appliedHeightMin: 80,
    appliedHeightMax: 84,
    appliedDepth: 24,
    hingeSides: ['left'],  // or 'right' depending on placement
    notes: 'Column refrigerator; single full-width door',
  },

  'side-by-side-fridge-42': {
    type: 'refrigerator',
    subtype: 'side-by-side',
    width: 42,
    doorConfig: 'dual',
    doorsPerSide: 1,
    doorWidthEach: 21,
    swingAngle: 90,
    arcRadius: 21,
    sideSwingClearance: 8,
    frontClearance: 0,
    appliedHeightMin: 80,
    appliedHeightMax: 84,
    appliedDepth: 24,
    hingeSides: ['left', 'right'],
    notes: 'Side-by-side fridge',
  },

  // ─── RANGES & WALL OVENS ───────────────────────────────────────────────
  'range-door-30': {
    type: 'range',
    subtype: 'range',
    width: 30,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 28,
    swingAngle: 90,
    arcRadius: 28,
    sideSwingClearance: 6,
    frontClearance: 20,  // door drops down 20" when fully open
    appliedHeightMin: 34,
    appliedHeightMax: 36,
    appliedDepth: 28.5,
    hingeSides: ['bottom-hinge'],  // drops down from bottom
    notes: 'Drop-down oven door; extends 20" into room',
  },

  'range-door-36': {
    type: 'range',
    subtype: 'range',
    width: 36,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 34,
    swingAngle: 90,
    arcRadius: 34,
    sideSwingClearance: 6,
    frontClearance: 20,
    appliedHeightMin: 34,
    appliedHeightMax: 36,
    appliedDepth: 28.5,
    hingeSides: ['bottom-hinge'],
    notes: '36" range door',
  },

  'wall-oven-single-30': {
    type: 'wall-oven',
    subtype: 'single',
    width: 30,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 28,
    swingAngle: 90,
    arcRadius: 28,
    sideSwingClearance: 6,
    frontClearance: 0,  // side-hinged doors
    appliedHeightMin: null,  // variable (can be placed at any height)
    appliedHeightMax: null,
    appliedDepth: 24,
    hingeSides: ['left'],  // or 'right'
    notes: 'Side-hinged wall oven door',
  },

  'wall-oven-double-30': {
    type: 'wall-oven',
    subtype: 'double',
    width: 30,
    doorConfig: 'dual-stacked',
    doorsPerSide: 2,
    doorWidthEach: 28,
    swingAngle: 90,
    arcRadius: 28,
    sideSwingClearance: 6,
    frontClearance: 0,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: 24,
    hingeSides: ['left', 'left'],  // both doors on same side
    notes: 'Double wall oven; two doors stacked vertically',
  },

  // ─── DISHWASHERS ───────────────────────────────────────────────────────
  'dishwasher-24': {
    type: 'dishwasher',
    subtype: 'standard',
    width: 24,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 24,
    swingAngle: 90,
    arcRadius: 24,  // drops down fully
    sideSwingClearance: 3,
    frontClearance: 24,  // full 24" clearance needed in front
    appliedHeightMin: 34,
    appliedHeightMax: 35,
    appliedDepth: 24,
    hingeSides: ['bottom-hinge'],
    notes: 'Drop-down dishwasher door; standard 24" width',
  },

  // ─── MICROWAVE DRAWERS ─────────────────────────────────────────────────
  'microwave-drawer-24': {
    type: 'microwave',
    subtype: 'drawer',
    width: 24,
    doorConfig: 'drawer',
    doorsPerSide: 1,
    doorWidthEach: 24,
    swingAngle: 90,
    arcRadius: 15,  // drawer extends 15" out
    sideSwingClearance: 2,
    frontClearance: 15,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: 24,
    hingeSides: ['bottom-drawer'],
    notes: 'Microwave drawer; extends ~15" forward',
  },

  'microwave-drawer-30': {
    type: 'microwave',
    subtype: 'drawer',
    width: 30,
    doorConfig: 'drawer',
    doorsPerSide: 1,
    doorWidthEach: 30,
    swingAngle: 90,
    arcRadius: 15,
    sideSwingClearance: 2,
    frontClearance: 15,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: 24,
    hingeSides: ['bottom-drawer'],
    notes: '30" microwave drawer',
  },

  // ─── TRASH & PULLOUTS ──────────────────────────────────────────────────
  'trash-pullout-18': {
    type: 'trash',
    subtype: 'pullout',
    width: 18,
    doorConfig: 'pullout',
    doorsPerSide: 1,
    doorWidthEach: 18,
    swingAngle: 0,  // no swing angle; purely linear
    arcRadius: 18,  // extends 18" forward
    sideSwingClearance: 0,
    frontClearance: 18,
    appliedHeightMin: 4,
    appliedHeightMax: 34,
    appliedDepth: 18,
    hingeSides: ['bottom-slide'],
    notes: 'Trash/recycling pullout; linear extension',
  },

  // ─── CABINET DOORS ─────────────────────────────────────────────────────
  'cabinet-door-9': {
    type: 'cabinet',
    subtype: 'door',
    width: 9,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 9,
    swingAngle: 90,
    arcRadius: 9,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: null,  // varies with cabinet type
    hingeSides: ['left'],  // or 'right'
    notes: 'Small base cabinet door (9" wide)',
  },

  'cabinet-door-12': {
    type: 'cabinet',
    subtype: 'door',
    width: 12,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 12,
    swingAngle: 90,
    arcRadius: 12,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: null,
    hingeSides: ['left'],
    notes: 'Base cabinet door (12" wide)',
  },

  'cabinet-door-15': {
    type: 'cabinet',
    subtype: 'door',
    width: 15,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 15,
    swingAngle: 90,
    arcRadius: 15,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: null,
    hingeSides: ['left'],
    notes: 'Standard base cabinet door (15" wide)',
  },

  'cabinet-door-18': {
    type: 'cabinet',
    subtype: 'door',
    width: 18,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 18,
    swingAngle: 90,
    arcRadius: 18,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: null,
    appliedHeightMax: null,
    appliedDepth: null,
    hingeSides: ['left'],
    notes: 'Large base cabinet door (18" wide)',
  },

  'upper-door-9': {
    type: 'cabinet',
    subtype: 'upper-door',
    width: 9,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 9,
    swingAngle: 90,
    arcRadius: 9,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: 54,
    appliedHeightMax: null,
    appliedDepth: 13.875,  // standard upper depth with door
    hingeSides: ['left'],
    notes: 'Upper cabinet door (9" wide)',
  },

  'upper-door-12': {
    type: 'cabinet',
    subtype: 'upper-door',
    width: 12,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 12,
    swingAngle: 90,
    arcRadius: 12,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: 54,
    appliedHeightMax: null,
    appliedDepth: 13.875,
    hingeSides: ['left'],
    notes: 'Upper cabinet door (12" wide)',
  },

  'upper-door-15': {
    type: 'cabinet',
    subtype: 'upper-door',
    width: 15,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 15,
    swingAngle: 90,
    arcRadius: 15,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: 54,
    appliedHeightMax: null,
    appliedDepth: 13.875,
    hingeSides: ['left'],
    notes: 'Upper cabinet door (15" wide)',
  },

  'upper-door-18': {
    type: 'cabinet',
    subtype: 'upper-door',
    width: 18,
    doorConfig: 'single',
    doorsPerSide: 1,
    doorWidthEach: 18,
    swingAngle: 90,
    arcRadius: 18,
    sideSwingClearance: 0,
    frontClearance: 0,
    appliedHeightMin: 54,
    appliedHeightMax: null,
    appliedDepth: 13.875,
    hingeSides: ['left'],
    notes: 'Upper cabinet door (18" wide)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: GEOMETRIC UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the swing arc polygon for a single door in plan view.
 * Returns an array of points representing the arc's boundary when fully open.
 *
 * @param {Object} config - Swing arc spec (from SWING_ARC_SPECS)
 * @param {number} hingeX - X coordinate of hinge (in wall coords)
 * @param {number} hingeY - Y coordinate of hinge (in wall coords, typically 0 at wall)
 * @param {string} hingeSide - 'left', 'right', 'bottom-hinge', 'bottom-drawer', 'bottom-slide'
 * @returns {Array<{x: number, y: number}>} Array of points forming the arc polygon
 *
 * @example
 * const arc = calculateArcPolygon(
 *   SWING_ARC_SPECS['french-door-36'],
 *   12,  // hingeX (left door at x=12)
 *   0,   // hingeY (hinge at wall)
 *   'left'
 * );
 * // Returns polygon representing 90° leftward swing from (12, 0)
 */
export function calculateArcPolygon(config, hingeX, hingeY, hingeSide) {
  const { arcRadius, swingAngle, frontClearance, sideSwingClearance } = config;
  const points = [];
  const segments = Math.max(12, Math.ceil(swingAngle / 5));  // at least 12 segments
  const radians = (swingAngle * Math.PI) / 180;

  if (hingeSide === 'left') {
    // Door swings leftward (outward from right edge of hinge)
    // Arc traces counterclockwise from right edge to top/front
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * radians;
      const x = hingeX - arcRadius * Math.sin(angle);
      const y = hingeY + arcRadius * Math.cos(angle);
      points.push({ x, y });
    }
    // Close the arc with radial lines back to hinge
    points.push({ x: hingeX, y: hingeY });
  } else if (hingeSide === 'right') {
    // Door swings rightward
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * radians;
      const x = hingeX + arcRadius * Math.sin(angle);
      const y = hingeY + arcRadius * Math.cos(angle);
      points.push({ x, y });
    }
    points.push({ x: hingeX, y: hingeY });
  } else if (hingeSide === 'bottom-hinge' || hingeSide === 'bottom-drawer') {
    // Door/drawer drops down from bottom
    // Extends forward (positive Y) by frontClearance
    const maxY = hingeY + frontClearance;
    const maxX = hingeX + config.width;
    points.push({ x: hingeX, y: hingeY });
    points.push({ x: maxX, y: hingeY });
    points.push({ x: maxX, y: maxY });
    points.push({ x: hingeX, y: maxY });
  } else if (hingeSide === 'bottom-slide') {
    // Pullout drawer: linear extension
    const maxY = hingeY + frontClearance;
    points.push({ x: hingeX, y: hingeY });
    points.push({ x: hingeX + config.width, y: hingeY });
    points.push({ x: hingeX + config.width, y: maxY });
    points.push({ x: hingeX, y: maxY });
  }

  return points;
}

/**
 * Check if a point (px, py) is inside a polygon defined by an array of points.
 * Uses ray-casting algorithm.
 *
 * @param {number} px - Point X coordinate
 * @param {number} py - Point Y coordinate
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculate the area of intersection between two polygons (Sutherland-Hodgman).
 * Returns the area in square inches.
 *
 * @param {Array<{x: number, y: number}>} poly1 - First polygon
 * @param {Array<{x: number, y: number}>} poly2 - Second polygon
 * @returns {number} Intersection area (sq in), or 0 if no overlap
 */
export function calculatePolygonIntersectionArea(poly1, poly2) {
  // Simple approximation: sample grid over bounding boxes
  const bbox1 = getPolygonBounds(poly1);
  const bbox2 = getPolygonBounds(poly2);

  const minX = Math.max(bbox1.minX, bbox2.minX);
  const maxX = Math.min(bbox1.maxX, bbox2.maxX);
  const minY = Math.max(bbox1.minY, bbox2.minY);
  const maxY = Math.min(bbox1.maxY, bbox2.maxY);

  if (minX >= maxX || minY >= maxY) return 0;

  let intersectionArea = 0;
  const sampleDensity = 0.5;  // sample every 0.5"
  const cellArea = sampleDensity * sampleDensity;

  for (let x = minX; x < maxX; x += sampleDensity) {
    for (let y = minY; y < maxY; y += sampleDensity) {
      if (isPointInPolygon(x, y, poly1) && isPointInPolygon(x, y, poly2)) {
        intersectionArea += cellArea;
      }
    }
  }

  return intersectionArea;
}

/**
 * Get bounding box of a polygon.
 *
 * @param {Array<{x: number, y: number}>} polygon
 * @returns {Object} {minX, maxX, minY, maxY}
 */
export function getPolygonBounds(polygon) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Get a bounding rectangle for a wall segment.
 * Walls are vertical surfaces; in plan view they appear as lines.
 * We model them as thin rectangles for collision detection.
 *
 * @param {Object} wall - Wall definition {position, width, orientation: 'horizontal'|'vertical'}
 * @returns {Object} {minX, maxX, minY, maxY}
 */
export function getWallBounds(wall) {
  const wallThickness = 0.5;  // wall thickness in plan view (negligible)

  if (wall.orientation === 'horizontal') {
    // Wall runs left-right (parallel to X-axis)
    return {
      minX: wall.position,
      maxX: wall.position + wall.width,
      minY: wall.y - wallThickness,
      maxY: wall.y + wallThickness,
    };
  } else {
    // Wall runs front-back (parallel to Y-axis)
    return {
      minX: wall.x - wallThickness,
      maxX: wall.x + wallThickness,
      minY: wall.position,
      maxY: wall.position + wall.width,
    };
  }
}

/**
 * Get bounding rectangle for an island or peninsula.
 *
 * @param {Object} island - Island definition {xMin, xMax, yMin, yMax}
 * @returns {Object} {minX, maxX, minY, maxY}
 */
export function getIslandBounds(island) {
  return {
    minX: island.xMin ?? island.x,
    maxX: island.xMax ?? island.x + island.width,
    minY: island.yMin ?? island.y,
    maxY: island.yMax ?? island.y + island.depth,
  };
}

/**
 * Calculate clearance needed in front of an appliance for NKBA compliance.
 * Standard: 42" walkway in front of all appliances.
 *
 * @param {Object} appliance - Appliance placement {position_start, width, type}
 * @returns {Object} {xMin, xMax, yMin, yMax, clearanceY}
 */
export function getClearanceEnvelope(appliance) {
  const applXMin = appliance.position_start ?? appliance.position ?? 0;
  const applXMax = applXMin + appliance.width;
  const nkbaWalkwayClearance = 42;  // inches

  return {
    xMin: applXMin,
    xMax: applXMax,
    yMin: 0,  // at wall
    yMax: nkbaWalkwayClearance,
    clearanceY: nkbaWalkwayClearance,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: COLLISION DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a door swing collides with an adjacent wall.
 *
 * @param {Object} appliance - Appliance placement data
 * @param {string} swingArcKey - Key from SWING_ARC_SPECS (e.g., 'french-door-36')
 * @param {Object} adjacentWall - Adjacent wall definition
 * @param {string} hingeSide - 'left' or 'right' for the adjacent wall
 * @returns {Object|null} Collision details or null if no collision
 *
 * @example
 * const collision = checkWallCollision(
 *   { position_start: 12, width: 36 },
 *   'french-door-36',
 *   { position: 0, width: 50, orientation: 'vertical', y: -12 },
 *   'left'
 * );
 * if (collision) {
 *   console.log(`Door swing hits wall at ${collision.intersectionX}"`);
 * }
 */
export function checkWallCollision(appliance, swingArcKey, adjacentWall, hingeSide) {
  const arcSpec = SWING_ARC_SPECS[swingArcKey];
  if (!arcSpec) return null;

  const applXMin = appliance.position_start ?? appliance.position ?? 0;
  const applXMax = applXMin + arcSpec.width;
  const wallBounds = getWallBounds(adjacentWall);

  // Determine hinge location based on hingeSide
  let hingeX;
  if (hingeSide === 'left') {
    hingeX = applXMin;
  } else if (hingeSide === 'right') {
    hingeX = applXMax;
  } else {
    return null;
  }

  const arcPoly = calculateArcPolygon(arcSpec, hingeX, 0, hingeSide);
  const arcBounds = getPolygonBounds(arcPoly);

  // Check if arc bounds intersect with wall bounds
  if (
    arcBounds.minX >= wallBounds.maxX ||
    arcBounds.maxX <= wallBounds.minX ||
    arcBounds.minY >= wallBounds.maxY ||
    arcBounds.maxY <= wallBounds.minY
  ) {
    return null;  // no collision
  }

  // Collision detected
  const intersectionX = Math.max(arcBounds.minX, wallBounds.minX);
  const overlapDistance = Math.min(arcBounds.maxX, wallBounds.maxX) - Math.max(arcBounds.minX, wallBounds.minX);

  return {
    type: 'wall-collision',
    applianceType: arcSpec.type,
    applianceSubtype: arcSpec.subtype,
    applianceWidth: arcSpec.width,
    wall: adjacentWall,
    hingePosition: hingeX,
    hingeSide,
    intersectionX,
    overlapDistance,
    arcPoly,
    severity: 'high',
    suggestedFix: hingeSide === 'left'
      ? `Insert 3" pull-out filler or pantry to left of appliance to buffer door swing`
      : `Insert 3" pull-out filler or pantry to right of appliance to buffer door swing`,
  };
}

/**
 * Check if a door swing collides with an island or peninsula.
 *
 * @param {Object} appliance - Appliance placement data
 * @param {string} swingArcKey - Key from SWING_ARC_SPECS
 * @param {Object} island - Island/peninsula bounds {xMin, xMax, yMin, yMax}
 * @returns {Object|null} Collision details or null
 */
export function checkIslandCollision(appliance, swingArcKey, island) {
  const arcSpec = SWING_ARC_SPECS[swingArcKey];
  if (!arcSpec) return null;

  const applXMin = appliance.position_start ?? appliance.position ?? 0;
  const applXMax = applXMin + arcSpec.width;
  const islandBounds = getIslandBounds(island);

  // For French doors or side-hinge doors, check both sides
  const collisions = [];

  for (const hingeSide of arcSpec.hingeSides) {
    let hingeX = applXMin;
    if (hingeSide === 'right' || (arcSpec.doorConfig === 'dual' && hingeSide === arcSpec.hingeSides[1])) {
      hingeX = applXMax;
    }

    const arcPoly = calculateArcPolygon(arcSpec, hingeX, 0, hingeSide);
    const arcBounds = getPolygonBounds(arcPoly);

    // Quick AABB check
    if (
      arcBounds.minX >= islandBounds.maxX ||
      arcBounds.maxX <= islandBounds.minX ||
      arcBounds.minY >= islandBounds.maxY ||
      arcBounds.maxY <= islandBounds.minY
    ) {
      continue;  // no collision on this side
    }

    const intersectionArea = calculatePolygonIntersectionArea(arcPoly, [
      { x: islandBounds.minX, y: islandBounds.minY },
      { x: islandBounds.maxX, y: islandBounds.minY },
      { x: islandBounds.maxX, y: islandBounds.maxY },
      { x: islandBounds.minX, y: islandBounds.maxY },
    ]);

    if (intersectionArea > 1) {  // more than 1 sq in overlap
      collisions.push({
        type: 'island-collision',
        applianceType: arcSpec.type,
        applianceSubtype: arcSpec.subtype,
        applianceWidth: arcSpec.width,
        island,
        hingePosition: hingeX,
        hingeSide,
        intersectionArea,
        arcPoly,
        severity: intersectionArea > 50 ? 'high' : 'medium',
        suggestedFix: `Reposition appliance away from island or consider left-opening door configuration`,
      });
    }
  }

  return collisions.length > 0 ? collisions : null;
}

/**
 * Check if two appliance door swings collide with each other.
 *
 * @param {Object} appliance1 - First appliance
 * @param {string} arcKey1 - Swing arc spec key for appliance 1
 * @param {Object} appliance2 - Second appliance
 * @param {string} arcKey2 - Swing arc spec key for appliance 2
 * @returns {Array<Object>} Array of collision objects, or empty if no collisions
 */
export function checkApplianceToApplianceCollision(appliance1, arcKey1, appliance2, arcKey2) {
  const arcSpec1 = SWING_ARC_SPECS[arcKey1];
  const arcSpec2 = SWING_ARC_SPECS[arcKey2];

  if (!arcSpec1 || !arcSpec2) return [];

  const collisions = [];

  // Calculate swing arcs for both appliances
  const app1XMin = appliance1.position_start ?? appliance1.position ?? 0;
  const app1XMax = app1XMin + arcSpec1.width;
  const app2XMin = appliance2.position_start ?? appliance2.position ?? 0;
  const app2XMax = app2XMin + arcSpec2.width;

  // Check all door combinations
  for (const hingeSide1 of arcSpec1.hingeSides) {
    const hingeX1 = hingeSide1 === 'right' ? app1XMax : app1XMin;
    const arcPoly1 = calculateArcPolygon(arcSpec1, hingeX1, 0, hingeSide1);

    for (const hingeSide2 of arcSpec2.hingeSides) {
      const hingeX2 = hingeSide2 === 'right' ? app2XMax : app2XMin;
      const arcPoly2 = calculateArcPolygon(arcSpec2, hingeX2, 0, hingeSide2);

      const intersectionArea = calculatePolygonIntersectionArea(arcPoly1, arcPoly2);

      if (intersectionArea > 1) {
        collisions.push({
          type: 'appliance-to-appliance',
          applianceA: {
            type: arcSpec1.type,
            subtype: arcSpec1.subtype,
            width: arcSpec1.width,
            hingeSide: hingeSide1,
          },
          applianceB: {
            type: arcSpec2.type,
            subtype: arcSpec2.subtype,
            width: arcSpec2.width,
            hingeSide: hingeSide2,
          },
          intersectionArea,
          severity: intersectionArea > 50 ? 'high' : 'medium',
          suggestedFix: `Increase spacing between appliances or configure one door to swing in opposite direction`,
        });
      }
    }
  }

  return collisions;
}

/**
 * Check if a cabinet door collides with an adjacent appliance door.
 *
 * @param {Object} cabinet - Cabinet placement
 * @param {string} cabinetDoorKey - Cabinet door key (e.g., 'cabinet-door-15')
 * @param {Object} appliance - Adjacent appliance
 * @param {string} applianceDoorKey - Appliance door key
 * @param {string} cabinetHingeSide - 'left' or 'right'
 * @param {string} applianceHingeSide - 'left' or 'right'
 * @returns {Object|null} Collision or null
 */
export function checkCabinetToDoorCollision(
  cabinet,
  cabinetDoorKey,
  appliance,
  applianceDoorKey,
  cabinetHingeSide,
  applianceHingeSide
) {
  const cabinetSpec = SWING_ARC_SPECS[cabinetDoorKey];
  const applianceSpec = SWING_ARC_SPECS[applianceDoorKey];

  if (!cabinetSpec || !applianceSpec) return null;

  const cabXMin = cabinet.position_start ?? cabinet.position ?? 0;
  const cabXMax = cabXMin + cabinetSpec.width;
  const applXMin = appliance.position_start ?? appliance.position ?? 0;
  const applXMax = applXMin + applianceSpec.width;

  const cabHingeX = cabinetHingeSide === 'right' ? cabXMax : cabXMin;
  const applHingeX = applianceHingeSide === 'right' ? applXMax : applXMin;

  const cabArc = calculateArcPolygon(cabinetSpec, cabHingeX, 0, cabinetHingeSide);
  const applArc = calculateArcPolygon(applianceSpec, applHingeX, 0, applianceHingeSide);

  const intersectionArea = calculatePolygonIntersectionArea(cabArc, applArc);

  if (intersectionArea > 1) {
    return {
      type: 'cabinet-to-appliance',
      cabinet: {
        sku: cabinet.sku,
        width: cabinetSpec.width,
        hingeSide: cabinetHingeSide,
      },
      appliance: {
        type: applianceSpec.type,
        width: applianceSpec.width,
        hingeSide: applianceHingeSide,
      },
      intersectionArea,
      severity: 'medium',
      suggestedFix: `Adjust cabinet door hinge direction or increase spacing`,
    };
  }

  return null;
}

/**
 * Check if an appliance or cabinet door violates the 42" NKBA walkway clearance.
 *
 * @param {Object} appliance - Appliance placement
 * @param {string} swingArcKey - Swing arc key
 * @returns {Object|null} Clearance violation or null
 */
export function checkWalkwayClearance(appliance, swingArcKey) {
  const arcSpec = SWING_ARC_SPECS[swingArcKey];
  if (!arcSpec) return null;

  const envelope = getClearanceEnvelope(appliance);
  const requiredClearance = 42;

  if (arcSpec.frontClearance < requiredClearance) {
    return {
      type: 'walkway-clearance-violation',
      appliance: {
        type: arcSpec.type,
        width: arcSpec.width,
      },
      requiredClearance,
      actualClearance: arcSpec.frontClearance,
      deficit: requiredClearance - arcSpec.frontClearance,
      severity: 'medium',
      suggestedFix: `Ensure minimum 42" clearance in front of appliance for NKBA compliance`,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: HIGH-LEVEL API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate all swing arcs in a layout and detect collisions.
 *
 * @param {Array<Object>} placements - Array of appliance/cabinet placements
 *   Each placement should have: {id, position_start, width, appliance_type, type, ...}
 * @param {Array<Object>} wallLayouts - Array of wall definitions
 *   Each wall: {id, position, width, orientation, y?, x?, ...}
 * @param {Object} islandLayout - Island/peninsula definition (optional)
 *   {xMin, xMax, yMin, yMax} or null
 * @returns {Object} {
 *   arcs: Array<{id, appliance, arcPoly, arcKey, ...}>,
 *   collisions: Array<{...}>,
 *   fixes: Array<{...}>,
 *   stats: {totalArcs, totalCollisions, severity}
 * }
 */
export function calculateSwingArcs(placements, wallLayouts, islandLayout) {
  const arcs = [];
  const collisions = [];
  const fixes = [];
  const applianceToArcKey = {};

  // Step 1: Map each appliance/cabinet to its swing arc spec
  for (const placement of placements) {
    const arcKey = getSwingArcKeyForPlacement(placement);
    if (!arcKey) continue;

    applianceToArcKey[placement.id] = arcKey;

    const arcSpec = SWING_ARC_SPECS[arcKey];
    const applXMin = placement.position_start ?? placement.position ?? 0;
    const applXMax = applXMin + arcSpec.width;

    // Calculate arc(s) for this placement
    for (const hingeSide of arcSpec.hingeSides) {
      const hingeX = hingeSide === 'right' || hingeSide.includes('right') ? applXMax : applXMin;
      const arcPoly = calculateArcPolygon(arcSpec, hingeX, 0, hingeSide);

      arcs.push({
        id: `${placement.id}_${hingeSide}`,
        placement,
        arcKey,
        arcSpec,
        hingeSide,
        arcPoly,
        bounds: getPolygonBounds(arcPoly),
      });
    }
  }

  // Step 2: Check appliance-to-wall collisions
  for (const arc of arcs) {
    for (const wall of wallLayouts) {
      const collision = checkWallCollision(
        arc.placement,
        arc.arcKey,
        wall,
        arc.hingeSide
      );
      if (collision) {
        collisions.push(collision);
        fixes.push({
          appliance: arc.placement.id,
          recommendation: collision.suggestedFix,
          priority: 'high',
        });
      }
    }
  }

  // Step 3: Check appliance-to-island collisions
  if (islandLayout) {
    for (const arc of arcs) {
      const islandCollisions = checkIslandCollision(arc.placement, arc.arcKey, islandLayout);
      if (islandCollisions) {
        collisions.push(...islandCollisions);
        for (const collision of islandCollisions) {
          fixes.push({
            appliance: arc.placement.id,
            recommendation: collision.suggestedFix,
            priority: 'high',
          });
        }
      }
    }
  }

  // Step 4: Check appliance-to-appliance collisions
  for (let i = 0; i < arcs.length; i++) {
    for (let j = i + 1; j < arcs.length; j++) {
      const arc1 = arcs[i];
      const arc2 = arcs[j];

      // Only check adjacent appliances (within 5" on X-axis)
      if (Math.abs(arc1.bounds.minX - arc2.bounds.minX) > 50) continue;

      const appCollisions = checkApplianceToApplianceCollision(
        arc1.placement,
        arc1.arcKey,
        arc2.placement,
        arc2.arcKey
      );

      if (appCollisions.length > 0) {
        collisions.push(...appCollisions);
        for (const collision of appCollisions) {
          fixes.push({
            appliances: [arc1.placement.id, arc2.placement.id],
            recommendation: collision.suggestedFix,
            priority: 'medium',
          });
        }
      }
    }
  }

  // Step 5: Check walkway clearances (NKBA 42")
  for (const arc of arcs) {
    const clearanceIssue = checkWalkwayClearance(arc.placement, arc.arcKey);
    if (clearanceIssue) {
      collisions.push(clearanceIssue);
    }
  }

  const highSeverityCount = collisions.filter(c => c.severity === 'high').length;
  const mediumSeverityCount = collisions.filter(c => c.severity === 'medium').length;

  return {
    arcs,
    collisions,
    fixes,
    stats: {
      totalArcs: arcs.length,
      totalCollisions: collisions.length,
      highSeverity: highSeverityCount,
      mediumSeverity: mediumSeverityCount,
      overallStatus: highSeverityCount > 0 ? 'FAILED' : mediumSeverityCount > 0 ? 'WARNINGS' : 'PASSED',
    },
  };
}

/**
 * Determine the swing arc spec key for a given placement.
 * Maps appliance type and dimensions to SWING_ARC_SPECS keys.
 *
 * @param {Object} placement - Placement object
 * @returns {string|null} Key from SWING_ARC_SPECS, or null if not found
 *
 * @example
 * const key = getSwingArcKeyForPlacement({
 *   type: 'appliance',
 *   appliance_type: 'refrigerator',
 *   appliance_subtype: 'french-door',
 *   width: 36
 * });
 * // Returns 'french-door-36'
 */
export function getSwingArcKeyForPlacement(placement) {
  const { type, appliance_type, appliance_subtype, width, applianceType, applianceSubtype } = placement;

  const appType = appliance_type || applianceType || '';
  const appSubtype = appliance_subtype || applianceSubtype || '';

  // Build candidate keys to search for
  const candidates = [
    `${appSubtype}-${width}`,
    `${appType}-${appSubtype}`,
    `${appType}-${width}`,
  ];

  // Also add cabinet door keys
  if (type === 'base' || type === 'wall') {
    const doorKey = type === 'wall' ? `upper-door-${width}` : `cabinet-door-${width}`;
    candidates.unshift(doorKey);
  }

  // Search for a matching key in SWING_ARC_SPECS
  for (const candidate of candidates) {
    if (SWING_ARC_SPECS[candidate]) {
      return candidate;
    }
  }

  return null;
}

/**
 * Check door clearance for a single appliance against adjacent elements.
 *
 * @param {Object} appliance - Appliance placement
 * @param {Array<Object>} adjacentElements - Array of walls, islands, or cabinets
 * @returns {Object} {
 *   clear: boolean,
 *   obstruction?: { type, distance, fixRequired },
 *   minGapNeeded?: number,
 *   recommendations?: Array<string>
 * }
 */
export function checkDoorClearance(appliance, adjacentElements) {
  const arcKey = getSwingArcKeyForPlacement(appliance);
  if (!arcKey) {
    return { clear: false, obstruction: { type: 'unknown-appliance', distance: 0 } };
  }

  const arcSpec = SWING_ARC_SPECS[arcKey];
  const obstructions = [];
  let minGapNeeded = 0;

  for (const element of adjacentElements) {
    if (element.type === 'wall') {
      const collision = checkWallCollision(appliance, arcKey, element, 'left');
      if (collision) {
        obstructions.push(collision);
        minGapNeeded = Math.max(minGapNeeded, 3);  // 3" filler recommended
      }
    } else if (element.type === 'island') {
      const collisions = checkIslandCollision(appliance, arcKey, element);
      if (collisions) {
        obstructions.push(...collisions);
      }
    }
  }

  return {
    clear: obstructions.length === 0,
    obstructions: obstructions.length > 0 ? obstructions : undefined,
    minGapNeeded: minGapNeeded > 0 ? minGapNeeded : undefined,
    recommendations: obstructions.map(o => o.suggestedFix),
  };
}

/**
 * Validate all door swings in a complete layout result.
 *
 * @param {Object} layoutResult - Full layout solver output
 *   Should include: {walls: [...], appliances: [...], cabinets: [...], island?: {...}}
 * @returns {Array<Object>} Array of validation issues, empty if all clear
 *
 * @example
 * const issues = validateAllSwings(solverOutput);
 * if (issues.length > 0) {
 *   console.log(`Found ${issues.length} door swing issues`);
 *   issues.forEach(issue => console.log(issue.message));
 * }
 */
export function validateAllSwings(layoutResult) {
  const { walls = [], appliances = [], cabinets = [], island } = layoutResult;

  const allPlacements = [...(appliances || []), ...(cabinets || [])];
  const result = calculateSwingArcs(allPlacements, walls, island);

  const issues = result.collisions.map(collision => ({
    type: collision.type,
    severity: collision.severity,
    message: collision.suggestedFix,
    data: collision,
  }));

  return issues;
}

/**
 * Generate a clearance envelope (polygon) showing total space needed for a door when open.
 *
 * @param {Object} appliance - Appliance placement
 * @param {string} swingArcKey - Swing arc spec key
 * @returns {Object} {
 *   appliance,
 *   clearancePolygon: Array<{x, y}>,
 *   clearanceArea: number (sq in),
 *   minClearanceDepth: number (inches)
 * }
 */
export function generateClearanceEnvelope(appliance, swingArcKey) {
  const arcSpec = SWING_ARC_SPECS[swingArcKey];
  if (!arcSpec) return null;

  const applXMin = appliance.position_start ?? appliance.position ?? 0;
  const applXMax = applXMin + arcSpec.width;
  const envelope = getClearanceEnvelope(appliance);

  // Generate polygon combining appliance footprint + clearance
  const clearancePoly = [
    { x: applXMin, y: 0 },
    { x: applXMax, y: 0 },
    { x: applXMax, y: envelope.clearanceY },
    { x: applXMin, y: envelope.clearanceY },
  ];

  const bounds = getPolygonBounds(clearancePoly);
  const clearanceArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);

  return {
    appliance,
    swingArcKey,
    clearancePolygon: clearancePoly,
    clearanceArea,
    minClearanceDepth: envelope.clearanceY,
    bounds,
  };
}

export default {
  SWING_ARC_SPECS,
  calculateArcPolygon,
  calculateSwingArcs,
  checkDoorClearance,
  checkWallCollision,
  checkIslandCollision,
  checkApplianceToApplianceCollision,
  checkCabinetToDoorCollision,
  checkWalkwayClearance,
  validateAllSwings,
  generateClearanceEnvelope,
  getSwingArcKeyForPlacement,
  getPolygonBounds,
  isPointInPolygon,
  calculatePolygonIntersectionArea,
};
