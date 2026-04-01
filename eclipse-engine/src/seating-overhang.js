/**
 * seating-overhang.js
 * Island/Peninsula Seating & Countertop Overhang Module
 *
 * Calculates seating capacity, support bracket placement, and countertop extensions
 * for island and peninsula cabinetry with overhang constraints and design rules.
 *
 * @module seating-overhang
 */

/**
 * Standard seating and support dimensions (all in inches)
 * @readonly
 */
export const SEATING_CONSTANTS = {
  // Overhang depths
  OVERHANG_MIN: 0,
  OVERHANG_STANDARD: 12,
  OVERHANG_COMFORTABLE: 15,
  OVERHANG_ADA_MIN: 19,
  OVERHANG_MAX: 24,

  // Seating per person
  SEAT_WIDTH_TIGHT: 21,
  SEAT_WIDTH_STANDARD: 24,
  SEAT_WIDTH_GENEROUS: 28,

  // Counter heights
  COUNTER_HEIGHT_STANDARD: 36,
  BAR_HEIGHT_RAISED: 42,
  KNEE_CLEARANCE_MIN: 27,
  KNEE_WALL_HEIGHT_TYPICAL: 18,

  // Bracket spacing
  BRACKET_NO_SUPPORT_MAX: 10,
  BRACKET_STANDARD_SPACING: 24,
  BRACKET_CORBEL_SPACING: 30,
  BRACKET_HEAVY_SPACING: 18,
  BRACKET_END_MARGIN: 6,

  // Stool dimensions
  STOOL_HEIGHT_COUNTER: 24,
  STOOL_HEIGHT_BAR: 30,

  // Countertop
  FRONT_OVERHANG_STANDARD: 1.5,
  SEATING_OVERHANG_FLUSH: 0,
};

/**
 * Bracket types and their characteristics
 * @readonly
 */
export const BRACKET_TYPES = {
  NONE: {
    name: 'none',
    maxOverhang: 10,
    spacing: null,
  },
  HIDDEN_STEEL: {
    name: 'hidden_steel_bracket',
    minOverhang: 10,
    maxOverhang: 15,
    spacing: 24,
    corbel: false,
  },
  CORBEL_STANDARD: {
    name: 'corbel_standard',
    minOverhang: 10,
    maxOverhang: 20,
    spacing: 30,
    corbel: true,
  },
  CORBEL_DECORATIVE: {
    name: 'corbel_decorative',
    minOverhang: 15,
    maxOverhang: 24,
    spacing: 24,
    corbel: true,
  },
  HIDDEN_HEAVY: {
    name: 'hidden_heavy_bracket',
    minOverhang: 15,
    maxOverhang: 24,
    spacing: 18,
    corbel: false,
  },
};

/**
 * Determines appropriate bracket type based on overhang depth
 *
 * @param {number} overhangInches - Overhang depth in inches
 * @param {Object} prefs - User preferences
 * @param {boolean} [prefs.corbelsPreferred=false] - User prefers decorative corbels
 * @returns {Object} Bracket type object from BRACKET_TYPES
 */
function selectBracketType(overhangInches, prefs = {}) {
  if (overhangInches <= SEATING_CONSTANTS.BRACKET_NO_SUPPORT_MAX) {
    return BRACKET_TYPES.NONE;
  }

  if (prefs.corbelsPreferred) {
    if (overhangInches <= SEATING_CONSTANTS.BRACKET_CORBEL_SPACING) {
      return BRACKET_TYPES.CORBEL_STANDARD;
    }
    return BRACKET_TYPES.CORBEL_DECORATIVE;
  }

  // Default to hidden steel for standard overhang
  if (overhangInches <= SEATING_CONSTANTS.OVERHANG_COMFORTABLE) {
    return BRACKET_TYPES.HIDDEN_STEEL;
  }

  // Heavy-duty hidden brackets for large overhangs
  return BRACKET_TYPES.HIDDEN_HEAVY;
}

/**
 * Calculates bracket positions along an overhang, ensuring end coverage
 *
 * RULES:
 * - Spacing determined by bracket type
 * - Always place a bracket within 6" of each end
 * - Distribute remaining brackets evenly
 *
 * @param {number} overhangLength - Length of overhang in inches (along island)
 * @param {number} overhangDepth - Depth of overhang in inches (perpendicular)
 * @param {Object} bracketType - Bracket type from BRACKET_TYPES
 * @returns {Array<Object>} Array of bracket positions
 * @example
 * // Returns:
 * // [
 * //   { positionAlongLength: 6, distFromEnd: 'start', spacingGroup: 1 },
 * //   { positionAlongLength: 30, distFromEnd: 'middle', spacingGroup: 1 },
 * //   { positionAlongLength: 54, distFromEnd: 'middle', spacingGroup: 2 },
 * //   { positionAlongLength: 74, distFromEnd: 'end', spacingGroup: 2 }
 * // ]
 */
export function calculateBracketPositions(overhangLength, overhangDepth, bracketType) {
  const positions = [];

  if (bracketType.name === 'none') {
    return positions;
  }

  const spacing = bracketType.spacing;
  const margin = SEATING_CONSTANTS.BRACKET_END_MARGIN;

  // Always place brackets within margin of each end
  positions.push({
    positionAlongLength: margin,
    distFromEnd: 'start',
    spacingGroup: 1,
    depth: overhangDepth,
  });

  // If overhang is very short, only end brackets
  if (overhangLength <= margin * 2 + spacing) {
    positions.push({
      positionAlongLength: overhangLength - margin,
      distFromEnd: 'end',
      spacingGroup: 1,
      depth: overhangDepth,
    });
    return positions;
  }

  // Place brackets at regular intervals in the middle
  let currentPos = margin + spacing;
  let spacingGroup = 1;

  while (currentPos < overhangLength - margin) {
    positions.push({
      positionAlongLength: currentPos,
      distFromEnd: 'middle',
      spacingGroup,
      depth: overhangDepth,
    });
    currentPos += spacing;
    spacingGroup += 1;
  }

  // Final bracket at end
  positions.push({
    positionAlongLength: overhangLength - margin,
    distFromEnd: 'end',
    spacingGroup,
    depth: overhangDepth,
  });

  return positions;
}

/**
 * Generates SKU identifiers for bracket components
 *
 * @param {Array<Object>} bracketPositions - Array of bracket position objects
 * @param {Object} bracketType - Bracket type from BRACKET_TYPES
 * @param {Object} prefs - User preferences
 * @param {string} [prefs.style='SHAKER'] - Cabinet style (SHAKER, MODERN, TRANSITIONAL, etc.)
 * @param {string} [prefs.finish='MAPLE'] - Wood finish (MAPLE, WHITE, WALNUT, etc.)
 * @param {number} [prefs.correlId=''] - Optional correlation ID for design instance
 * @returns {Array<string>} Array of SKU codes
 * @example
 * // Returns:
 * // ['BRACKET-HIDDEN-12', 'BRACKET-HIDDEN-12', 'CORBEL-3-SHAKER', 'CORBEL-3-SHAKER']
 */
export function generateBracketSkus(bracketPositions, bracketType, prefs = {}) {
  const skus = [];
  const style = prefs.style || 'SHAKER';
  const finish = prefs.finish || 'MAPLE';

  if (bracketType.corbel) {
    // Corbels typically come in 3", 4", 6" widths
    const corbel_width = 3;
    bracketPositions.forEach(() => {
      skus.push(`CORBEL-${corbel_width}-${style}`);
    });
  } else {
    // Hidden brackets
    bracketPositions.forEach((pos) => {
      // Size brackets by depth (8", 12", 15", 18")
      const depth = Math.round(pos.depth);
      const sizeCategory = Math.ceil(depth / 3) * 3; // Round to nearest 3"
      skus.push(`BRACKET-HIDDEN-${Math.min(sizeCategory, 18)}`);
    });
  }

  return skus;
}

/**
 * Calculates maximum seating capacity based on available countertop length
 *
 * @param {number} countertopLength - Length of available countertop on seating side (inches)
 * @param {string} [spacing='standard'] - Spacing preference (tight|standard|generous)
 * @returns {Object} Seating calculation { maxSeats, seatWidth, totalLength, availableForSeating }
 */
export function calculateSeatingCapacity(countertopLength, spacing = 'standard') {
  let seatWidth;

  switch (spacing.toLowerCase()) {
    case 'tight':
      seatWidth = SEATING_CONSTANTS.SEAT_WIDTH_TIGHT;
      break;
    case 'generous':
      seatWidth = SEATING_CONSTANTS.SEAT_WIDTH_GENEROUS;
      break;
    case 'standard':
    default:
      seatWidth = SEATING_CONSTANTS.SEAT_WIDTH_STANDARD;
  }

  const maxSeats = Math.floor(countertopLength / seatWidth);

  return {
    maxSeats,
    seatWidth,
    totalLength: countertopLength,
    usedLength: maxSeats * seatWidth,
    unusedLength: countertopLength - maxSeats * seatWidth,
  };
}

/**
 * Calculates countertop extension dimensions for seating side
 *
 * The seating-side countertop extends cabinets depth + overhang.
 * The work-side retains standard 1.5" front overhang.
 * Waterfall ends wrap the countertop vertically.
 *
 * @param {Object} cabinets - Cabinet configuration
 * @param {number} cabinets.depth - Cabinet body depth (typically 24" for base cabinets)
 * @param {number} cabinets.length - Length of island/peninsula
 * @param {number} overhang - Seating overhang depth (inches)
 * @param {Object} prefs - User preferences
 * @param {boolean} [prefs.waterfallEnd=false] - Apply waterfall detail at ends
 * @param {number} [prefs.countertopThickness=1.25] - Thickness of countertop material
 * @returns {Object} Countertop extension details
 */
export function calculateCountertopExtension(cabinets, overhang, prefs = {}) {
  const waterfallEnd = prefs.waterfallEnd || false;
  const countertopThickness = prefs.countertopThickness || 1.25;

  // Seating side countertop depth
  const seatingDepth = cabinets.depth + overhang;

  // Work side maintains standard overhang
  const workSideOverhang = SEATING_CONSTANTS.FRONT_OVERHANG_STANDARD;

  // Total work+cabinet depth on work side
  const workSideDepth = cabinets.depth + workSideOverhang;

  // Waterfall drops (if applied to ends)
  const waterfallDropLength = waterfallEnd ? countertopThickness : 0;

  return {
    seatingDepth,
    workSideDepth,
    seatingOverhang: overhang,
    workSideOverhang,
    cabinets: {
      length: cabinets.length,
      depth: cabinets.depth,
    },
    waterfall: {
      enabled: waterfallEnd,
      dropLength: waterfallDropLength,
    },
    countertopThickness,
    totalCountertopArea: {
      seatingLength: cabinets.length,
      seatingDepth,
      workLength: cabinets.length,
      workDepth: workSideDepth,
    },
  };
}

/**
 * Comprehensive seating layout calculation for islands and peninsulas
 *
 * @param {Object} islandLayout - Island/peninsula configuration
 * @param {string} islandLayout.type - 'island' | 'peninsula'
 * @param {number} islandLayout.length - Island length in inches
 * @param {number} islandLayout.depth - Island cabinet depth (typically 24")
 * @param {Array<string>} [islandLayout.seatingWalls=['south']] - Walls with seating
 * @param {Object} prefs - Design preferences
 * @param {number} [prefs.overhang=12] - Desired overhang depth (inches)
 * @param {string} [prefs.seatingSpacing='standard'] - tight|standard|generous
 * @param {boolean} [prefs.corbelsPreferred=false] - Prefer decorative corbels
 * @param {string} [prefs.style='SHAKER'] - Cabinet style for SKU generation
 * @param {string} [prefs.counterHeight=36] - 36 or 42 inches
 * @param {boolean} [prefs.waterfallEnd=false] - Waterfall countertop ends
 * @param {Object} [clearances] - Optional clearance requirements for validation
 * @returns {Object} Complete seating layout
 *
 * @example
 * const island = {
 *   type: 'island',
 *   length: 96,
 *   depth: 24,
 *   seatingWalls: ['south']
 * };
 * const prefs = {
 *   overhang: 15,
 *   seatingSpacing: 'standard',
 *   corbelsPreferred: true,
 *   style: 'MODERN'
 * };
 * const result = calculateSeatingLayout(island, prefs);
 * // Returns complete seating design with SKUs and brackets
 */
export function calculateSeatingLayout(islandLayout, prefs = {}) {
  // Defaults
  const overhang = prefs.overhang || SEATING_CONSTANTS.OVERHANG_STANDARD;
  const seatingSpacing = prefs.seatingSpacing || 'standard';
  const counterHeight = prefs.counterHeight || SEATING_CONSTANTS.COUNTER_HEIGHT_STANDARD;
  const seatingWalls = islandLayout.seatingWalls || ['south'];

  // Validate overhang
  if (overhang < 0 || overhang > SEATING_CONSTANTS.OVERHANG_MAX) {
    throw new Error(
      `Overhang ${overhang}" is outside valid range [0, ${SEATING_CONSTANTS.OVERHANG_MAX}"]`
    );
  }

  // Select bracket type
  const bracketType = selectBracketType(overhang, prefs);

  // Calculate bracket positions
  const bracketPositions = calculateBracketPositions(
    islandLayout.length,
    overhang,
    bracketType
  );

  // Generate SKUs
  const skus = generateBracketSkus(bracketPositions, bracketType, prefs);

  // Calculate seating capacity
  const seatingCapacity = calculateSeatingCapacity(islandLayout.length, seatingSpacing);

  // Calculate countertop extension
  const countertop = calculateCountertopExtension(
    { length: islandLayout.length, depth: islandLayout.depth },
    overhang,
    prefs
  );

  // Determine bar/counter stool height
  const stoolHeight = counterHeight === 42
    ? SEATING_CONSTANTS.STOOL_HEIGHT_BAR
    : SEATING_CONSTANTS.STOOL_HEIGHT_COUNTER;

  // Knee clearance check
  const kneeHeadroom = counterHeight - SEATING_CONSTANTS.KNEE_CLEARANCE_MIN;

  return {
    type: islandLayout.type,
    seatingWalls,
    maxSeats: seatingCapacity.maxSeats,
    seatingSpacing,
    seatWidth: seatingCapacity.seatWidth,
    overhang: {
      depth: overhang,
      length: islandLayout.length,
      category: overhang <= 10 ? 'none' : overhang <= 15 ? 'standard' : 'heavy',
    },
    bracket: {
      type: bracketType.name,
      count: bracketPositions.length,
      positions: bracketPositions,
      spacing: bracketType.spacing || null,
    },
    countertop,
    counter: {
      height: counterHeight,
      stoolHeight,
      kneeHeadroom,
      meetsADAMin: overhang >= SEATING_CONSTANTS.OVERHANG_ADA_MIN,
    },
    components: {
      brackets: bracketPositions.length,
      skus,
    },
    timestamp: new Date().toISOString(),
    metadata: {
      version: '1.0.0',
      correlId: prefs.correlId || null,
    },
  };
}

/**
 * Validates seating layout against design rules and clearance requirements
 *
 * @param {Object} seatingLayout - Seating layout object from calculateSeatingLayout
 * @param {Object} [clearances] - Clearance constraints
 * @param {number} [clearances.minClearanceFromWall] - Minimum clearance from walls (inches)
 * @param {number} [clearances.minClearanceFromAppliance] - Clearance from appliances
 * @returns {Object} Validation result { valid: boolean, issues: Array<string> }
 */
export function validateSeating(seatingLayout, clearances = {}) {
  const issues = [];

  // Validate overhang
  if (seatingLayout.overhang.depth < 0) {
    issues.push('Overhang depth must be non-negative');
  }
  if (seatingLayout.overhang.depth > SEATING_CONSTANTS.OVERHANG_MAX) {
    issues.push(`Overhang depth exceeds maximum of ${SEATING_CONSTANTS.OVERHANG_MAX}"`);
  }

  // Validate seating capacity
  if (seatingLayout.maxSeats < 1 && seatingLayout.overhang.depth > 0) {
    issues.push('Island length too short for single seat');
  }

  // Validate counter height
  if (![SEATING_CONSTANTS.COUNTER_HEIGHT_STANDARD, SEATING_CONSTANTS.BAR_HEIGHT_RAISED].includes(seatingLayout.counter.height)) {
    issues.push(`Counter height ${seatingLayout.counter.height}" is non-standard`);
  }

  // Validate knee clearance
  if (seatingLayout.counter.kneeHeadroom < 0) {
    issues.push(`Insufficient knee clearance (${seatingLayout.counter.kneeHeadroom}")`);
  }

  // ADA compliance warning
  if (seatingLayout.counter.height === 36 && !seatingLayout.counter.meetsADAMin) {
    issues.push(
      `Overhang ${seatingLayout.overhang.depth}" below ADA minimum of ${SEATING_CONSTANTS.OVERHANG_ADA_MIN}"`
    );
  }

  // Bracket coverage validation
  if (seatingLayout.bracket.count > 0 && seatingLayout.overhang.depth > SEATING_CONSTANTS.BRACKET_NO_SUPPORT_MAX) {
    if (seatingLayout.bracket.positions.length === 0) {
      issues.push('Overhang requires brackets but none calculated');
    }

    // Check for adequate spacing
    const maxSpacing = seatingLayout.bracket.spacing || SEATING_CONSTANTS.BRACKET_STANDARD_SPACING;
    for (let i = 0; i < seatingLayout.bracket.positions.length - 1; i++) {
      const gap =
        seatingLayout.bracket.positions[i + 1].positionAlongLength -
        seatingLayout.bracket.positions[i].positionAlongLength;
      if (gap > maxSpacing * 1.5) {
        issues.push(
          `Bracket spacing gap of ${gap}" exceeds recommended maximum of ${maxSpacing * 1.5}"`
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    seatingLayout,
  };
}

/**
 * Estimates material requirements from seating layout
 *
 * @param {Object} seatingLayout - Seating layout from calculateSeatingLayout
 * @returns {Object} Material estimate { countertop, brackets, hardware, labor }
 */
export function estimateMaterials(seatingLayout) {
  const countertopArea = {
    seatingLength: seatingLayout.countertop.totalCountertopArea.seatingLength,
    seatingDepth: seatingLayout.countertop.totalCountertopArea.seatingDepth,
    workLength: seatingLayout.countertop.totalCountertopArea.workLength,
    workDepth: seatingLayout.countertop.totalCountertopArea.workDepth,
  };

  const countertopSqFt = (
    (countertopArea.seatingLength * countertopArea.seatingDepth +
      countertopArea.workLength * countertopArea.workDepth) /
    144
  ).toFixed(2);

  const bracketingCost = {
    bracketCount: seatingLayout.bracket.count,
    hardwarePerBracket: seatingLayout.bracket.type === 'corbel_decorative' ? 'premium' : 'standard',
  };

  return {
    countertop: {
      sqFt: countertopSqFt,
      seatingDepth: countertopArea.seatingDepth,
      workSideDepth: countertopArea.workDepth,
      waterfallEnds: seatingLayout.countertop.waterfall.enabled,
    },
    bracketing: bracketingCost,
    skus: seatingLayout.components.skus,
    labor: {
      complexity: seatingLayout.overhang.category === 'heavy' ? 'complex' : 'standard',
      bracketInstallation: seatingLayout.bracket.count > 0,
    },
  };
}

export default {
  SEATING_CONSTANTS,
  BRACKET_TYPES,
  calculateSeatingLayout,
  calculateBracketPositions,
  generateBracketSkus,
  calculateSeatingCapacity,
  calculateCountertopExtension,
  validateSeating,
  estimateMaterials,
};
