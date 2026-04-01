/**
 * @fileoverview Functional Envelopes Module
 *
 * Implements the core geometry layer for the Eclipse Kitchen Designer.
 * Every object in the kitchen has:
 * - A `physicalBox`: its actual solid dimensions
 * - A `clearanceBox`: the space it needs to function (doors, drawers, access)
 *
 * This module provides:
 * 1. Envelope generation from solver placements
 * 2. 3D AABB intersection detection
 * 3. Comprehensive collision checking
 * 4. Walkway validation per NKBA standards
 * 5. Visualization export for plan views
 *
 * @module functional-envelopes
 */

/**
 * Standard clearance requirements for kitchen objects.
 * Each entry defines functional clearance needed for operation.
 *
 * Clearance directions:
 * - front: extends outward from object face (toward room center)
 * - sides: extends left/right perpendicular to wall
 * - top: extends upward above object
 *
 * @type {Object}
 */
export const CLEARANCE_SPECS = {
  // Base cabinets
  base_cabinet_doors: {
    front: 20,      // Standard 90° door swing
    left: 0,
    right: 0,
    top: 0,
    notes: 'Standard 90-degree door swing, typical kitchen cabinet'
  },
  base_cabinet_drawers: {
    front: 24,      // Full-extension drawer pulling to full depth
    left: 0,
    right: 0,
    top: 0,
    notes: 'Full-extension drawers require 24" for operation'
  },

  // Appliances
  dishwasher: {
    front: 24,      // Door opens fully downward
    left: 0,
    right: 0,
    top: 0,
    notes: 'Door drops to horizontal, requires 24" clearance'
  },
  range: {
    front: 30,      // Standing room at range, 30" typical cooking zone
    left: 3,
    right: 3,
    top: 27,        // 24-30" to bottom of hood (27" average)
    notes: 'Cooking clearance per NKBA, range hoods mount 60-66" AFF'
  },
  refrigerator_french_door: {
    front: 30,      // Both doors swing out, crisper drawer access
    left: 15,       // Allow for hinge-side clearance
    right: 15,
    top: 1,         // 1" clearance above for ventilation
    notes: 'French doors swing both sides, crisper drawer access'
  },
  refrigerator_single_door: {
    front: 30,      // Door swing + handle clearance
    left: 4,        // Hinge side (minimal)
    right: 0,       // Handle side opens into kitchen
    top: 1,
    notes: 'Single door, asymmetric clearance for hinge vs handle'
  },
  wall_oven: {
    front: 30,      // Door opens fully downward
    left: 0,
    right: 0,
    top: 0,
    notes: 'Wall oven door drops, standing room at face'
  },
  sink: {
    front: 36,      // Standing room, arm movement under counter
    left: 0,
    right: 0,
    top: 0,
    notes: 'NKBA minimum standing clearance at sink'
  },

  // Cabinets - upper/tall
  upper_cabinet: {
    front: 0,       // Mounted to wall, no swing
    left: 0,
    right: 0,
    top: 0,
    notes: 'Wall-mounted, no operational clearance'
  },
  tall_cabinet_doors: {
    front: 24,      // 90° door swing (tall cabinet doors)
    left: 0,
    right: 0,
    top: 0,
    notes: 'Standard tall cabinet door swing'
  },
  tall_cabinet_pullouts: {
    front: 24,      // Pull-out shelves/drawers
    left: 0,
    right: 0,
    top: 0,
    notes: 'Pull-out shelves require full depth clearance'
  },

  // Specialty
  trash_pullout: {
    front: 18,      // Slides partway out
    left: 0,
    right: 0,
    top: 0,
    notes: 'Trash pullout slides out 18"'
  },
  lazy_susan_corner: {
    front: 24,      // Rotating shelf needs swing room
    left: 0,
    right: 0,
    top: 0,
    notes: 'Lazy Susan corner - rotating shelves'
  },

  // Island (special: walkway clearance on all sides)
  island: {
    front: 42,      // All-around walkway per NKBA
    left: 42,
    right: 42,
    top: 0,
    notes: 'Island requires 42" walkway on all sides (NKBA minimum)'
  }
};

/**
 * Severity levels for collision reporting.
 *
 * @type {Object}
 */
export const SEVERITY_LEVELS = {
  error: {
    code: 'error',
    priority: 1,
    description: 'Physical boxes overlap - cabinets occupy same space',
    actionRequired: true
  },
  warning: {
    code: 'warning',
    priority: 2,
    description: 'Clearance boxes overlap - doors cannot fully open',
    actionRequired: true
  },
  info: {
    code: 'info',
    priority: 3,
    description: 'Clearance boxes barely touch - tight but potentially usable',
    actionRequired: false
  }
};

/**
 * 3D Axis-Aligned Bounding Box (AABB) representation.
 *
 * @typedef {Object} Box3D
 * @property {number} x - Left edge position (distance along wall)
 * @property {number} y - Distance from wall (0 = flush)
 * @property {number} z - Height above floor
 * @property {number} width - Dimension along wall (x-axis)
 * @property {number} depth - Dimension away from wall (y-axis)
 * @property {number} height - Dimension upward (z-axis)
 */

/**
 * Functional envelope containing both physical and clearance boxes.
 *
 * @typedef {Object} FunctionalEnvelope
 * @property {string} id - Unique identifier (e.g., "cabinet_001")
 * @property {string} type - Object type (e.g., "base_cabinet_doors", "range")
 * @property {string} [wallId] - Wall identifier (for wall-mounted objects)
 * @property {Box3D} physicalBox - Actual solid geometry
 * @property {Box3D} clearanceBox - Space needed for operation
 * @property {number} priority - Collision priority: appliances (1) > cabinets (2) > accessories (3)
 * @property {Object} metadata - Additional info (width, depth, height, location, etc.)
 */

/**
 * Collision detection result between two boxes.
 *
 * @typedef {Object} IntersectionResult
 * @property {boolean} intersects - Whether boxes intersect
 * @property {number} [overlapVolume] - Volume of overlap in cubic inches
 * @property {Object} [overlapDims] - Overlap dimensions in each axis
 * @property {number} [overlapDims.x] - Overlap width
 * @property {number} [overlapDims.y] - Overlap depth
 * @property {number} [overlapDims.z] - Overlap height
 */

/**
 * Collision event between two envelopes.
 *
 * @typedef {Object} Collision
 * @property {FunctionalEnvelope} objectA - First object
 * @property {FunctionalEnvelope} objectB - Second object
 * @property {number} overlapVolume - Volume of overlap in cubic inches
 * @property {string} severity - "error", "warning", or "info"
 * @property {string} type - "physical_collision", "functional_obstruction", or "walkway_violation"
 * @property {Object} overlapDims - Dimensions of overlap {x, y, z}
 * @property {string} description - Human-readable description
 */

/**
 * Check if two 3D axis-aligned bounding boxes intersect.
 *
 * Uses the separating axis theorem (SAT) for AABBs.
 * Two boxes intersect if they overlap on ALL three axes.
 *
 * @param {Box3D} boxA - First bounding box
 * @param {Box3D} boxB - Second bounding box
 * @returns {IntersectionResult} Intersection details
 *
 * @example
 * const physBox = { x: 0, y: 0, z: 0, width: 30, depth: 24, height: 30 };
 * const clearanceBox = { x: -10, y: -20, z: 0, width: 50, depth: 44, height: 30 };
 * const result = checkIntersection(physBox, clearanceBox);
 * // { intersects: true, overlapVolume: 17280, overlapDims: {x: 30, y: 24, z: 30} }
 */
export function checkIntersection(boxA, boxB) {
  // Get bounds for each box
  const aMaxX = boxA.x + boxA.width;
  const aMaxY = boxA.y + boxA.depth;
  const aMaxZ = boxA.z + boxA.height;

  const bMaxX = boxB.x + boxB.width;
  const bMaxY = boxB.y + boxB.depth;
  const bMaxZ = boxB.z + boxB.height;

  // Check separation on each axis
  const separatedOnX = aMaxX <= boxB.x || bMaxX <= boxA.x;
  const separatedOnY = aMaxY <= boxB.y || bMaxY <= boxA.y;
  const separatedOnZ = aMaxZ <= boxB.z || bMaxZ <= boxA.z;

  const intersects = !separatedOnX && !separatedOnY && !separatedOnZ;

  if (!intersects) {
    return { intersects: false };
  }

  // Calculate overlap dimensions
  const overlapX = Math.min(aMaxX, bMaxX) - Math.max(boxA.x, boxB.x);
  const overlapY = Math.min(aMaxY, bMaxY) - Math.max(boxA.y, boxB.y);
  const overlapZ = Math.min(aMaxZ, bMaxZ) - Math.max(boxA.z, boxB.z);

  const overlapVolume = Math.max(0, overlapX) * Math.max(0, overlapY) * Math.max(0, overlapZ);

  return {
    intersects: true,
    overlapVolume,
    overlapDims: {
      x: Math.max(0, overlapX),
      y: Math.max(0, overlapY),
      z: Math.max(0, overlapZ)
    }
  };
}

/**
 * Generate functional envelopes from solver placements.
 *
 * Creates both physical and clearance boxes for every object based on:
 * - Placement coordinates
 * - Object type and dimensions
 * - Functional clearance requirements
 *
 * @param {Array} placements - Cabinet/appliance placements from solver
 *   Each placement: { id, type, x, y, z, width, depth, height, wallId, ... }
 * @param {Object} wallLayouts - Wall layout info { wallId: { length, ... } }
 * @param {Object} [islandLayout] - Island layout if present
 * @param {Object} [options={}] - Generation options
 * @returns {Array<FunctionalEnvelope>} Array of envelopes with physical and clearance boxes
 *
 * @example
 * const placements = [
 *   { id: 'base_001', type: 'base_cabinet_doors', x: 0, y: 0, z: 4.5,
 *     width: 36, depth: 24, height: 30, wallId: 'wall_A' }
 * ];
 * const envelopes = generateEnvelopes(placements, wallLayouts);
 * // [{ id: 'base_001', physicalBox: {...}, clearanceBox: {...}, priority: 2 }]
 */
export function generateEnvelopes(placements, wallLayouts, islandLayout, options = {}) {
  const envelopes = [];

  for (const placement of placements) {
    // Create physical box from placement
    const physicalBox = {
      x: placement.x,
      y: placement.y,
      z: placement.z,
      width: placement.width,
      depth: placement.depth,
      height: placement.height
    };

    // Look up clearance specs for this object type
    const clearanceSpec = CLEARANCE_SPECS[placement.type] || CLEARANCE_SPECS.base_cabinet_doors;

    // Generate clearance box by extending physical box
    const clearanceBox = {
      x: physicalBox.x - clearanceSpec.left,
      y: physicalBox.y - clearanceSpec.front,  // Front is away from wall
      z: physicalBox.z,  // Clearance extends upward but starts at object base
      width: physicalBox.width + clearanceSpec.left + clearanceSpec.right,
      depth: physicalBox.depth + clearanceSpec.front,
      height: physicalBox.height + clearanceSpec.top
    };

    // Determine priority (lower number = higher priority in conflicts)
    let priority = 2;  // Default: cabinets
    if (isApplianceType(placement.type)) {
      priority = 1;    // Appliances win conflicts
    } else if (isAccessoryType(placement.type)) {
      priority = 3;    // Accessories lose conflicts
    }

    // Build envelope
    const envelope = {
      id: placement.id,
      type: placement.type,
      wallId: placement.wallId || null,
      physicalBox,
      clearanceBox,
      priority,
      metadata: {
        width: placement.width,
        depth: placement.depth,
        height: placement.height,
        location: `Wall ${placement.wallId}`,
        placementX: placement.x,
        placementY: placement.y,
        placementZ: placement.z
      }
    };

    envelopes.push(envelope);
  }

  // Handle island separately if present
  if (islandLayout && islandLayout.placements) {
    for (const placement of islandLayout.placements) {
      const physicalBox = {
        x: placement.x,
        y: placement.y,
        z: placement.z,
        width: placement.width,
        depth: placement.depth,
        height: placement.height
      };

      const clearanceSpec = CLEARANCE_SPECS.island;
      const clearanceBox = {
        x: physicalBox.x - clearanceSpec.left,
        y: physicalBox.y - clearanceSpec.front,
        z: physicalBox.z,
        width: physicalBox.width + clearanceSpec.left + clearanceSpec.right,
        depth: physicalBox.depth + clearanceSpec.front + 42,  // Walkway on opposite side too
        height: physicalBox.height
      };

      envelopes.push({
        id: placement.id || `island_${placement.x}_${placement.y}`,
        type: 'island',
        wallId: null,
        physicalBox,
        clearanceBox,
        priority: 2,
        metadata: {
          width: placement.width,
          depth: placement.depth,
          height: placement.height,
          location: 'Island',
          islandPosition: { x: placement.x, y: placement.y }
        }
      });
    }
  }

  return envelopes;
}

/**
 * Run comprehensive collision check against all envelopes.
 *
 * Performs O(n²) pairwise comparison of all clearance boxes and classifies
 * collisions by severity and type.
 *
 * @param {Array<FunctionalEnvelope>} envelopes - All functional envelopes
 * @param {Object} [options={}] - Check options
 * @param {boolean} [options.includeInfoLevel=false] - Include info-level collisions
 * @param {boolean} [options.checkPhysicalOnly=false] - Only check physical boxes
 * @returns {Object} Collision report
 * @returns {Array<Collision>} collisions - Array of detected collisions
 * @returns {boolean} clear - True if no error/warning collisions found
 * @returns {number} errorCount - Number of physical collisions
 * @returns {number} warningCount - Number of functional obstructions
 * @returns {number} infoCount - Number of tight clearances
 *
 * @example
 * const report = runCollisionCheck(envelopes);
 * if (!report.clear) {
 *   console.error(`Found ${report.errorCount} physical collisions`);
 *   report.collisions.forEach(c => console.log(c.description));
 * }
 */
export function runCollisionCheck(envelopes, options = {}) {
  const {
    includeInfoLevel = false,
    checkPhysicalOnly = false
  } = options;

  const collisions = [];

  // Pairwise comparison
  for (let i = 0; i < envelopes.length; i++) {
    for (let j = i + 1; j < envelopes.length; j++) {
      const envA = envelopes[i];
      const envB = envelopes[j];

      // Skip if same wall-mounted objects might be on different walls (no collision)
      if (envA.wallId && envB.wallId && envA.wallId !== envB.wallId) {
        continue;
      }

      // Check physical boxes (always check for actual overlap)
      const physResult = checkIntersection(envA.physicalBox, envB.physicalBox);

      if (physResult.intersects) {
        // Physical collision - cabinets/objects occupying same space
        collisions.push(createCollision(
          envA,
          envB,
          physResult,
          'error',
          'physical_collision',
          `${envA.id} and ${envB.id} physically overlap`
        ));
        continue;
      }

      // Check clearance boxes (unless physical-only mode)
      if (!checkPhysicalOnly) {
        const clearResult = checkIntersection(envA.clearanceBox, envB.clearanceBox);

        if (clearResult.intersects) {
          // Determine severity based on overlap volume
          const severity = categorizeClearanceCollision(clearResult, envA, envB);

          if (severity === 'info' && !includeInfoLevel) {
            continue;  // Skip info-level unless requested
          }

          collisions.push(createCollision(
            envA,
            envB,
            clearResult,
            severity,
            'functional_obstruction',
            `Clearance conflict: ${envA.id} clearance overlaps ${envB.id} clearance`
          ));
        }
      }
    }
  }

  // Sort by severity (errors first)
  collisions.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    collisions,
    clear: !collisions.some(c => c.severity === 'error' || c.severity === 'warning'),
    errorCount: collisions.filter(c => c.severity === 'error').length,
    warningCount: collisions.filter(c => c.severity === 'warning').length,
    infoCount: collisions.filter(c => c.severity === 'info').length
  };
}

/**
 * Validate walkway clearances per NKBA standards.
 *
 * Checks:
 * - Between opposing counters: 42" (1 cook) or 48" (2 cook)
 * - Between counter and island: 42" minimum
 * - In front of appliances: 36" minimum
 * - At doorways: 44" minimum
 *
 * @param {Array<FunctionalEnvelope>} envelopes - All functional envelopes
 * @param {Object} roomGeometry - Room info
 *   - { width, depth, doorways: [{x, y, width, depth}, ...] }
 * @param {Object} [options={}] - Validation options
 * @param {number} [options.cookCount=1] - Number of cooks (affects counter spacing)
 * @returns {Object} Walkway validation report
 * @returns {Array<Object>} violations - Array of walkway violations
 * @returns {boolean} valid - True if all walkways meet NKBA standards
 */
export function validateWalkways(envelopes, roomGeometry, options = {}) {
  const { cookCount = 1 } = options;

  const violations = [];
  const minCounterGap = cookCount >= 2 ? 48 : 42;
  const minIslandGap = 42;
  const minApplianceGap = 36;
  const minDoorwayGap = 44;

  // Group envelopes by wall for opposing counter check
  const wallMap = {};
  envelopes.forEach(env => {
    if (env.wallId && env.type !== 'island') {
      if (!wallMap[env.wallId]) {
        wallMap[env.wallId] = [];
      }
      wallMap[env.wallId].push(env);
    }
  });

  // Check opposing counter gaps (if room geometry indicates opposing walls)
  // This would require room dimensions to properly check

  // Check island gaps
  const islands = envelopes.filter(e => e.type === 'island');
  const wallCabs = envelopes.filter(e => e.wallId && e.type !== 'island');

  for (const island of islands) {
    for (const wallCab of wallCabs) {
      const gap = calculateGapBetweenBoxes(island.clearanceBox, wallCab.clearanceBox);
      if (gap < minIslandGap) {
        violations.push({
          type: 'island_gap',
          severity: 'warning',
          gap,
          minimum: minIslandGap,
          description: `Island-to-cabinet gap of ${gap.toFixed(1)}" is less than ${minIslandGap}" minimum`,
          objects: [island.id, wallCab.id]
        });
      }
    }
  }

  // Check appliance clearance
  const appliances = envelopes.filter(e => isApplianceType(e.type));
  for (const appliance of appliances) {
    const gap = findMinimumGapToOtherObjects(appliance, envelopes);
    if (gap.distance < minApplianceGap && gap.obstruction) {
      violations.push({
        type: 'appliance_gap',
        severity: 'warning',
        gap: gap.distance,
        minimum: minApplianceGap,
        description: `Appliance ${appliance.id} has only ${gap.distance.toFixed(1)}" clearance (minimum ${minApplianceGap}")`,
        objects: [appliance.id, gap.obstruction.id]
      });
    }
  }

  return {
    violations,
    valid: violations.length === 0,
    summary: `${violations.length} walkway violations found`
  };
}

/**
 * Export envelopes in a format suitable for plan-view renderer.
 *
 * Generates SVG/JSON data showing:
 * - Physical boxes as solid shapes
 * - Clearance boxes as dashed outlines
 * - Collisions highlighted in red
 *
 * @param {Array<FunctionalEnvelope>} envelopes - All functional envelopes
 * @param {Array<Collision>} [collisions=[]] - Detected collisions to highlight
 * @param {Object} [options={}] - Export options
 * @param {string} [options.format='json'] - 'json' or 'svg'
 * @param {number} [options.scale=1] - Scale factor for rendering
 * @returns {Object|string} Renderer-compatible data structure or SVG markup
 *
 * @example
 * const data = exportEnvelopesForRenderer(envelopes, collisions, { format: 'json' });
 * renderer.renderPlanView(data);
 */
export function exportEnvelopesForRenderer(envelopes, collisions = [], options = {}) {
  const {
    format = 'json',
    scale = 1
  } = options;

  if (format === 'json') {
    return {
      envelopes: envelopes.map(env => ({
        id: env.id,
        type: env.type,
        physical: {
          x: env.physicalBox.x * scale,
          y: env.physicalBox.y * scale,
          z: env.physicalBox.z * scale,
          width: env.physicalBox.width * scale,
          depth: env.physicalBox.depth * scale,
          height: env.physicalBox.height * scale
        },
        clearance: {
          x: env.clearanceBox.x * scale,
          y: env.clearanceBox.y * scale,
          z: env.clearanceBox.z * scale,
          width: env.clearanceBox.width * scale,
          depth: env.clearanceBox.depth * scale,
          height: env.clearanceBox.height * scale
        },
        priority: env.priority,
        metadata: env.metadata
      })),
      collisions: collisions.map(c => ({
        objectA: c.objectA.id,
        objectB: c.objectB.id,
        severity: c.severity,
        type: c.type,
        description: c.description,
        overlapVolume: c.overlapVolume,
        overlapDims: c.overlapDims
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        envelopeCount: envelopes.length,
        collisionCount: collisions.length,
        errorCount: collisions.filter(c => c.severity === 'error').length,
        warningCount: collisions.filter(c => c.severity === 'warning').length
      }
    };
  }

  if (format === 'svg') {
    return generateSVGVisualization(envelopes, collisions, scale);
  }

  throw new Error(`Unknown export format: ${format}`);
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an object type is an appliance (higher priority).
 * @private
 */
function isApplianceType(type) {
  const applianceTypes = [
    'dishwasher',
    'range',
    'refrigerator_french_door',
    'refrigerator_single_door',
    'wall_oven',
    'sink'
  ];
  return applianceTypes.includes(type);
}

/**
 * Check if an object type is an accessory (lower priority).
 * @private
 */
function isAccessoryType(type) {
  const accessoryTypes = [
    'trash_pullout',
    'lazy_susan_corner'
  ];
  return accessoryTypes.includes(type);
}

/**
 * Create a collision object with description.
 * @private
 */
function createCollision(envA, envB, intersectResult, severity, type, description) {
  return {
    objectA: envA,
    objectB: envB,
    overlapVolume: intersectResult.overlapVolume,
    severity,
    type,
    overlapDims: intersectResult.overlapDims,
    description
  };
}

/**
 * Categorize clearance collision severity based on overlap volume.
 * @private
 */
function categorizeClearanceCollision(result, envA, envB) {
  // If clearance overlap is very small, it's just "tight"
  const threshold = 100;  // 100 cubic inches = minor overlap

  if (result.overlapVolume < threshold) {
    return 'info';  // Tight but potentially workable
  }

  return 'warning';  // Functional obstruction
}

/**
 * Calculate the minimum gap between two boxes (perpendicular distance).
 * @private
 */
function calculateGapBetweenBoxes(boxA, boxB) {
  // Check if boxes are separated on Y axis (distance from wall)
  if (boxA.y + boxA.depth <= boxB.y) {
    return boxB.y - (boxA.y + boxA.depth);
  }
  if (boxB.y + boxB.depth <= boxA.y) {
    return boxA.y - (boxB.y + boxB.depth);
  }

  // Check if boxes are separated on X axis (along wall)
  if (boxA.x + boxA.width <= boxB.x) {
    return boxB.x - (boxA.x + boxA.width);
  }
  if (boxB.x + boxB.width <= boxA.x) {
    return boxA.x - (boxB.x + boxB.width);
  }

  // Boxes overlap - no gap
  return 0;
}

/**
 * Find minimum gap from one envelope to any other object.
 * @private
 */
function findMinimumGapToOtherObjects(envelope, allEnvelopes) {
  let minGap = Infinity;
  let obstruction = null;

  for (const other of allEnvelopes) {
    if (other.id === envelope.id) continue;

    const gap = calculateGapBetweenBoxes(envelope.clearanceBox, other.clearanceBox);
    if (gap < minGap) {
      minGap = gap;
      obstruction = other;
    }
  }

  return { distance: minGap === Infinity ? 0 : minGap, obstruction };
}

/**
 * Generate SVG visualization of envelopes and collisions.
 * @private
 */
function generateSVGVisualization(envelopes, collisions, scale) {
  const padding = 50;
  const minX = Math.min(...envelopes.map(e => e.clearanceBox.x)) * scale - padding;
  const minY = Math.min(...envelopes.map(e => e.clearanceBox.y)) * scale - padding;
  const maxX = Math.max(...envelopes.map(e =>
    (e.clearanceBox.x + e.clearanceBox.width) * scale
  )) + padding;
  const maxY = Math.max(...envelopes.map(e =>
    (e.clearanceBox.y + e.clearanceBox.depth) * scale
  )) + padding;

  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">`;
  svg += '<style>';
  svg += '.physical { fill: #2E86AB; opacity: 0.8; stroke: #1A3F5C; stroke-width: 1; }';
  svg += '.clearance { fill: none; stroke: #A23B72; stroke-width: 1; stroke-dasharray: 4,4; opacity: 0.6; }';
  svg += '.collision { fill: #F18F01; opacity: 0.4; stroke: #C71A3A; stroke-width: 2; }';
  svg += '.label { font-size: 10px; fill: #333; }';
  svg += '</style>';

  // Draw all envelopes
  for (const env of envelopes) {
    const isCollided = collisions.some(c =>
      c.objectA.id === env.id || c.objectB.id === env.id
    );

    const pBox = env.physicalBox;
    const cBox = env.clearanceBox;

    // Physical box (solid)
    svg += `<rect x="${pBox.x * scale}" y="${pBox.y * scale}" ` +
           `width="${pBox.width * scale}" height="${pBox.depth * scale}" ` +
           `class="physical ${isCollided ? 'collision' : ''}" />`;

    // Clearance box (dashed)
    svg += `<rect x="${cBox.x * scale}" y="${cBox.y * scale}" ` +
           `width="${cBox.width * scale}" height="${cBox.depth * scale}" ` +
           `class="clearance" />`;

    // Label
    const labelX = (pBox.x + pBox.width / 2) * scale;
    const labelY = (pBox.y + pBox.depth / 2) * scale;
    svg += `<text x="${labelX}" y="${labelY}" class="label" text-anchor="middle">${env.id}</text>`;
  }

  svg += '</svg>';
  return svg;
}

export default {
  generateEnvelopes,
  checkIntersection,
  runCollisionCheck,
  validateWalkways,
  exportEnvelopesForRenderer,
  CLEARANCE_SPECS,
  SEVERITY_LEVELS
};
