/**
 * @fileoverview NKBA Safety Validation Module for Eclipse Kitchen Cabinet Layout Engine
 * Handles electrical outlet placement, clearances, work triangle validation, and code compliance
 * @module nkba-validation
 */

/**
 * NKBA and NEC electrical/safety standards constants
 * @type {Object}
 */
export const NKBA_STANDARDS = {
  // Electrical outlet standards (NEC Article 210.52)
  electrical: {
    maxOutletSpacing: 48, // inches - max continuous wall-counter space without outlet
    counterOutletMaxDistance: 24, // inches - no point >24" from outlet
    outletHeightAFF: 44, // above finished floor (8" above 36" counter)
    islandMinSqFt: 12, // island must have outlet if > 12 sq ft
    gfciProximityToWater: 72, // inches (6 feet) - outlets within this distance need GFCI
    dedicatedCircuitAmps: 20, // countertop receptacles require 20-amp circuits
  },

  // Work triangle standards (NKBA Guideline 4)
  workTriangle: {
    minLegLength: 48, // inches (4 feet)
    maxLegLength: 108, // inches (9 feet)
    minPerimeter: 156, // inches (13 feet)
    maxPerimeter: 312, // inches (26 feet)
    maxObstacleIntersection: 12, // inches - obstacles can't intersect leg by >12"
  },

  // Landing area standards (NKBA Guidelines 6, 7, 8, 9)
  landingAreas: {
    sink: { primary: 24, secondary: 18 }, // inches on either side
    rangeOrCooktop: { primary: 15, secondary: 12 },
    fridge: 15, // on handle side
    microwave: 15, // above or below
    wallOven: 15, // on either side
  },

  // Clearance standards (NKBA Guidelines 13, 14, 15, 16)
  clearances: {
    oneCookKitchen: 42, // inches between opposing counters
    twoCookKitchen: 48, // inches between opposing counters
    applianceFrontClearance: 36, // inches in front of all appliances
    doorwayClearance: 44, // inches at doorways and traffic paths
    islandClearancePreferred: 42, // inches on all sides
    islandClearanceMinimum: 36, // inches on all sides
  },

  // Ventilation requirements (NKBA Guideline 5)
  ventilation: {
    hoodMinWidth: 'cooktopWidth', // hood must be >= cooktop width
    hoodHeightMin: 24, // inches above cooktop
    hoodHeightMax: 30, // inches above cooktop
    cooktopMustHaveVentilation: true,
  },

  // Countertop safety
  countertop: {
    islandEdgesMustRound: true,
    maxOverhang: 15, // inches at walkways without support
  },

  // ADA Compliance standards (ADAAG 2010)
  ada: {
    clearFloorSpaceLength: 48, // inches
    clearFloorSpaceWidth: 30, // inches
    kneeSpaceHeight: 27, // inches
    kneeSpaceWidth: 30, // inches
    kneeSpaceDepth: 19, // inches
    maxCounterHeight: 34, // inches
  },
};

/**
 * Represents a validation issue found during NKBA checks
 * @typedef {Object} ValidationIssue
 * @property {('error'|'warning'|'info')} severity - Issue severity level
 * @property {string} rule - Human-readable rule name
 * @property {string} code - NKBA guideline number or NEC article reference
 * @property {string} message - Detailed message about the violation
 * @property {string} [fix] - Suggested remediation
 * @property {Object} [data] - Additional context data
 */

/**
 * Represents an electrical outlet location
 * @typedef {Object} OutletLocation
 * @property {string} wallId - Unique identifier for the wall/run
 * @property {number} position - X/Y position in layout coordinates
 * @property {number} heightAFF - Height above finished floor (inches)
 * @property {boolean} isGFCI - Whether outlet requires GFCI protection
 * @property {string} circuit - Circuit number/identifier
 * @property {string} [circuitAmps] - Circuit amperage
 */

/**
 * Represents a work triangle leg
 * @typedef {Object} TriangleLeg
 * @property {string} from - Starting appliance name ('sink'|'range'|'fridge')
 * @property {string} to - Ending appliance name
 * @property {number} distance - Leg length in inches
 * @property {boolean} valid - Whether leg meets length requirements
 * @property {string} [issue] - Description if invalid
 */

/**
 * Work triangle validation result
 * @typedef {Object} WorkTriangleResult
 * @property {TriangleLeg[]} legs - Three legs of the triangle
 * @property {number} perimeter - Total perimeter in inches
 * @property {boolean} valid - Overall validity
 * @property {ValidationIssue[]} issues - Any violations found
 */

/**
 * Electrical outlet plan for entire kitchen
 * @typedef {Object} OutletPlan
 * @property {OutletLocation[]} outlets - All outlet locations
 * @property {Object[]} gfciZones - Zones requiring GFCI protection
 * @property {Object[]} circuits - Circuit assignments
 */

/**
 * Full NKBA validation result
 * @typedef {Object} ValidationResult
 * @property {ValidationIssue[]} issues - All issues found
 * @property {OutletLocation[]} outlets - Generated outlet plan
 * @property {WorkTriangleResult} workTriangle - Work triangle analysis
 * @property {number} score - Overall compliance score (0-100)
 * @property {Object} details - Detailed results by category
 */

/**
 * Validates electrical outlet spacing requirements
 * Ensures no point on countertop is more than 24" from an outlet
 * and outlets are spaced at most 48" apart
 *
 * @param {Object} wallLayouts - Wall-run cabinet layout data
 * @param {number[]} waterSourceLocations - Positions of sinks and water features
 * @returns {Object} { outlets: OutletLocation[], issues: ValidationIssue[] }
 */
function validateOutletPlacement(wallLayouts, waterSourceLocations = []) {
  const outlets = [];
  const issues = [];
  let circuitCounter = 1;

  // Process each wall/run
  Object.entries(wallLayouts || {}).forEach(([wallId, wallData]) => {
    if (!wallData || !wallData.length) return;

    const runLength = wallData.length || 0;
    const outletSpacing = NKBA_STANDARDS.electrical.maxOutletSpacing;

    // Calculate required number of outlets for this run
    const minOutlets = Math.ceil(runLength / outletSpacing);

    // Distribute outlets evenly across the run
    for (let i = 0; i < minOutlets; i++) {
      const position = (runLength / (minOutlets + 1)) * (i + 1);

      // Check if outlet needs GFCI (within 6' of water source)
      const isGFCI = waterSourceLocations.some(
        waterPos => Math.abs(position - waterPos) <= NKBA_STANDARDS.electrical.gfciProximityToWater
      );

      outlets.push({
        wallId,
        position,
        heightAFF: NKBA_STANDARDS.electrical.outletHeightAFF,
        isGFCI,
        circuit: `C${circuitCounter}`,
        circuitAmps: 20,
      });

      circuitCounter++;
    }
  });

  // Validate maximum spacing between outlets
  outlets.forEach((outlet, idx) => {
    if (idx > 0) {
      const prevOutlet = outlets[idx - 1];
      if (outlet.wallId === prevOutlet.wallId) {
        const spacing = Math.abs(outlet.position - prevOutlet.position);
        if (spacing > NKBA_STANDARDS.electrical.maxOutletSpacing) {
          issues.push({
            severity: 'error',
            rule: 'Outlet Spacing',
            code: 'NEC 210.52(a)',
            message: `Outlets on wall "${outlet.wallId}" are ${spacing.toFixed(1)}" apart (max 48" allowed)`,
            fix: `Add outlet between position ${prevOutlet.position.toFixed(1)}" and ${outlet.position.toFixed(1)}"`,
            data: { wallId: outlet.wallId, spacing },
          });
        }
      }
    }
  });

  return { outlets, issues };
}

/**
 * Validates landing area requirements for each appliance
 *
 * @param {Object} appliances - Appliance positions { sink, range, fridge, microwave, wallOven, etc }
 * @param {Object} cabinetRuns - Cabinet layout data with widths/positions
 * @returns {ValidationIssue[]} Array of landing area violations
 */
function validateLandingAreas(appliances = {}, cabinetRuns = {}) {
  const issues = [];
  const standards = NKBA_STANDARDS.landingAreas;

  if (appliances.sink && cabinetRuns.sink) {
    const sinkWidth = cabinetRuns.sink.width || 36;
    const availableLeft = cabinetRuns.sink.clearanceLeft || 0;
    const availableRight = cabinetRuns.sink.clearanceRight || 0;

    if (availableLeft < standards.sink.secondary && availableRight < standards.sink.primary) {
      issues.push({
        severity: 'error',
        rule: 'Sink Landing Area',
        code: 'NKBA 6',
        message: `Insufficient landing areas at sink: ${availableLeft}" left (need 18"), ${availableRight}" right (need 24")`,
        fix: 'Reposition sink or remove adjacent cabinets to provide adequate landing area',
        data: { appliance: 'sink', availableLeft, availableRight },
      });
    }
  }

  if (appliances.range && cabinetRuns.range) {
    const rangeWidth = cabinetRuns.range.width || 30;
    const availableLeft = cabinetRuns.range.clearanceLeft || 0;
    const availableRight = cabinetRuns.range.clearanceRight || 0;

    if (availableLeft < standards.rangeOrCooktop.secondary || availableRight < standards.rangeOrCooktop.primary) {
      issues.push({
        severity: 'error',
        rule: 'Range Landing Area',
        code: 'NKBA 7',
        message: `Insufficient landing at range: ${availableLeft}" one side (need 12"), ${availableRight}" other (need 15")`,
        fix: 'Ensure at least 15" landing on one side and 12" on the other side of range',
        data: { appliance: 'range', availableLeft, availableRight },
      });
    }
  }

  if (appliances.fridge && cabinetRuns.fridge) {
    const fridgeWidth = cabinetRuns.fridge.width || 36;
    const availableHandleSide = cabinetRuns.fridge.clearanceHandle || 0;

    if (availableHandleSide < standards.fridge) {
      issues.push({
        severity: 'error',
        rule: 'Fridge Landing Area',
        code: 'NKBA 8',
        message: `Insufficient landing on fridge handle side: ${availableHandleSide}" (need 15")`,
        fix: 'Provide 15" of clear counter space on the fridge handle side',
        data: { appliance: 'fridge', available: availableHandleSide },
      });
    }
  }

  if (appliances.microwave && cabinetRuns.microwave) {
    const availableLanding = cabinetRuns.microwave.clearanceAboveBelow || 0;
    if (availableLanding < standards.microwave) {
      issues.push({
        severity: 'warning',
        rule: 'Microwave Landing Area',
        code: 'NKBA 9',
        message: `Insufficient landing above/below microwave: ${availableLanding}" (need 15")`,
        fix: 'Ensure 15" of clear space above or below the microwave',
        data: { appliance: 'microwave', available: availableLanding },
      });
    }
  }

  if (appliances.wallOven && cabinetRuns.wallOven) {
    const availableSide = Math.max(
      cabinetRuns.wallOven.clearanceLeft || 0,
      cabinetRuns.wallOven.clearanceRight || 0
    );
    if (availableSide < standards.wallOven) {
      issues.push({
        severity: 'warning',
        rule: 'Wall Oven Landing Area',
        code: 'NKBA 9',
        message: `Insufficient landing beside wall oven: ${availableSide}" (need 15")`,
        fix: 'Provide 15" of clear counter space on either side of the wall oven',
        data: { appliance: 'wallOven', available: availableSide },
      });
    }
  }

  return issues;
}

/**
 * Validates clearance between opposing counters and in front of appliances
 *
 * @param {Object} roomLayout - Room dimensions and layout
 * @param {Object} cabinetPositions - Cabinet run positions and dimensions
 * @param {boolean} isAdaMode - Whether to apply ADA clearance standards
 * @returns {ValidationIssue[]} Array of clearance violations
 */
function validateClearances(roomLayout = {}, cabinetPositions = {}, isAdaMode = false) {
  const issues = [];
  const standards = NKBA_STANDARDS.clearances;

  // Check opposing counter clearances
  if (cabinetPositions.opposingRunGap !== undefined) {
    const gap = cabinetPositions.opposingRunGap;
    const minClearance = isAdaMode ? standards.twoCookKitchen : standards.oneCookKitchen;

    if (gap < minClearance) {
      const cookType = gap < standards.twoCookKitchen ? 'two-cook' : 'one-cook';
      issues.push({
        severity: 'error',
        rule: 'Opposing Counter Clearance',
        code: 'NKBA 13',
        message: `Clearance between opposing counters is ${gap}" (${cookType} kitchen requires min ${minClearance}")`,
        fix: `Increase clearance to at least ${minClearance}"`,
        data: { gap, required: minClearance, kitchen: cookType },
      });
    }
  }

  // Check appliance front clearance
  Object.entries(cabinetPositions).forEach(([applianceId, position]) => {
    if (position.frontClearance !== undefined) {
      if (position.frontClearance < standards.applianceFrontClearance) {
        issues.push({
          severity: 'error',
          rule: 'Appliance Front Clearance',
          code: 'NKBA 14',
          message: `Front clearance for ${applianceId} is ${position.frontClearance}" (need min 36")`,
          fix: `Ensure minimum 36" clear space in front of ${applianceId}`,
          data: { appliance: applianceId, clearance: position.frontClearance },
        });
      }
    }
  });

  // Check doorway clearance
  if (cabinetPositions.doorwayClearance !== undefined) {
    if (cabinetPositions.doorwayClearance < standards.doorwayClearance) {
      issues.push({
        severity: 'error',
        rule: 'Doorway Clearance',
        code: 'NKBA 15',
        message: `Doorway clearance is ${cabinetPositions.doorwayClearance}" (need min 44")`,
        fix: 'Maintain 44" minimum clear width at doorways and traffic paths',
        data: { clearance: cabinetPositions.doorwayClearance },
      });
    }
  }

  // Check island clearances
  if (cabinetPositions.islandClearance !== undefined) {
    const islandClear = cabinetPositions.islandClearance;
    if (islandClear < standards.islandClearanceMinimum) {
      issues.push({
        severity: 'error',
        rule: 'Island Clearance Minimum',
        code: 'NKBA 16',
        message: `Island clearance is ${islandClear}" (need min 36" on all sides)`,
        fix: 'Increase island clearance to minimum 36" on all sides',
        data: { clearance: islandClear },
      });
    } else if (islandClear < standards.islandClearancePreferred) {
      issues.push({
        severity: 'warning',
        rule: 'Island Clearance Preferred',
        code: 'NKBA 16',
        message: `Island clearance is ${islandClear}" (preferred 42" on all sides)`,
        fix: 'Consider increasing island clearance to preferred 42"',
        data: { clearance: islandClear, preferred: standards.islandClearancePreferred },
      });
    }
  }

  return issues;
}

/**
 * Calculates distance between two points in inches
 *
 * @param {Object} point1 - { x: number, y: number }
 * @param {Object} point2 - { x: number, y: number }
 * @returns {number} Distance in inches
 */
function calculateDistance(point1, point2) {
  const dx = (point1.x || 0) - (point2.x || 0);
  const dy = (point1.y || 0) - (point2.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Validates the work triangle (sink → range → fridge)
 * Each leg must be 4'–9' (48"–108"), total 13'–26' (156"–312")
 *
 * @param {Object} sinkPos - Sink position { x, y } in inches
 * @param {Object} rangePos - Range position { x, y } in inches
 * @param {Object} fridgePos - Fridge position { x, y } in inches
 * @returns {WorkTriangleResult}
 */
export function validateWorkTriangle(sinkPos, rangePos, fridgePos) {
  const standards = NKBA_STANDARDS.workTriangle;
  const issues = [];

  // Calculate distances (using center points)
  const sinkToRange = calculateDistance(sinkPos, rangePos);
  const rangeToFridge = calculateDistance(rangePos, fridgePos);
  const fridgeToSink = calculateDistance(fridgePos, sinkPos);
  const perimeter = sinkToRange + rangeToFridge + fridgeToSink;

  // Build leg objects
  const legs = [
    {
      from: 'sink',
      to: 'range',
      distance: sinkToRange,
      valid: sinkToRange >= standards.minLegLength && sinkToRange <= standards.maxLegLength,
    },
    {
      from: 'range',
      to: 'fridge',
      distance: rangeToFridge,
      valid: rangeToFridge >= standards.minLegLength && rangeToFridge <= standards.maxLegLength,
    },
    {
      from: 'fridge',
      to: 'sink',
      distance: fridgeToSink,
      valid: fridgeToSink >= standards.minLegLength && fridgeToSink <= standards.maxLegLength,
    },
  ];

  // Validate each leg
  legs.forEach(leg => {
    if (!leg.valid) {
      const minFeet = standards.minLegLength / 12;
      const maxFeet = standards.maxLegLength / 12;
      const legFeet = (leg.distance / 12).toFixed(1);

      if (leg.distance < standards.minLegLength) {
        issues.push({
          severity: 'error',
          rule: 'Work Triangle Leg Too Short',
          code: 'NKBA 4',
          message: `${leg.from.toUpperCase()} to ${leg.to.toUpperCase()} is ${legFeet}' (min ${minFeet}')`,
          fix: `Reposition appliances to increase leg length to 4'–9'`,
          data: { leg: `${leg.from}-${leg.to}`, distance: leg.distance },
        });
      } else {
        issues.push({
          severity: 'warning',
          rule: 'Work Triangle Leg Too Long',
          code: 'NKBA 4',
          message: `${leg.from.toUpperCase()} to ${leg.to.toUpperCase()} is ${legFeet}' (max ${maxFeet}')`,
          fix: 'Consider repositioning appliances to reduce distances',
          data: { leg: `${leg.from}-${leg.to}`, distance: leg.distance },
        });
      }
    }
  });

  // Validate perimeter
  const perimeterFeet = (perimeter / 12).toFixed(1);
  const minPerimFeet = standards.minPerimeter / 12;
  const maxPerimFeet = standards.maxPerimeter / 12;

  let perimeterValid = perimeter >= standards.minPerimeter && perimeter <= standards.maxPerimeter;

  if (!perimeterValid) {
    if (perimeter < standards.minPerimeter) {
      issues.push({
        severity: 'error',
        rule: 'Work Triangle Too Small',
        code: 'NKBA 4',
        message: `Work triangle perimeter is ${perimeterFeet}' (min ${minPerimFeet}')`,
        fix: 'Increase distances between appliances',
        data: { perimeter },
      });
    } else {
      issues.push({
        severity: 'warning',
        rule: 'Work Triangle Too Large',
        code: 'NKBA 4',
        message: `Work triangle perimeter is ${perimeterFeet}' (max ${maxPerimFeet}')`,
        fix: 'Reposition appliances to reduce overall distances',
        data: { perimeter },
      });
    }
  }

  return {
    legs,
    perimeter,
    valid: legs.every(leg => leg.valid) && perimeterValid,
    issues,
  };
}

/**
 * Generates electrical outlet plan for island and wall runs
 *
 * @param {Object} wallLayouts - Wall cabinet layout data { wallId: [...] }
 * @param {Object} islandLayout - Island cabinet layout data
 * @param {number[]} waterSourceLocations - Positions of sinks, water features
 * @returns {OutletPlan} Outlet locations, GFCI zones, and circuit assignments
 */
export function generateOutletPlan(wallLayouts, islandLayout, waterSourceLocations = []) {
  const { outlets, issues } = validateOutletPlacement(wallLayouts, waterSourceLocations);

  // Add island outlet if required
  if (islandLayout && islandLayout.area > NKBA_STANDARDS.electrical.islandMinSqFt) {
    outlets.push({
      wallId: 'island',
      position: islandLayout.center,
      heightAFF: NKBA_STANDARDS.electrical.outletHeightAFF,
      isGFCI: false,
      circuit: `C${outlets.length + 1}`,
      circuitAmps: 20,
    });
  }

  // Group outlets by GFCI requirement
  const gfciZones = outlets
    .filter(outlet => outlet.isGFCI)
    .map(outlet => ({
      outletId: `${outlet.wallId}-${outlet.position.toFixed(0)}`,
      wallId: outlet.wallId,
      position: outlet.position,
      protectionType: 'GFCI',
      reason: 'Within 6 feet of water source',
    }));

  // Group outlets by circuit
  const circuits = {};
  outlets.forEach(outlet => {
    if (!circuits[outlet.circuit]) {
      circuits[outlet.circuit] = {
        circuit: outlet.circuit,
        amperage: outlet.circuitAmps,
        outlets: [],
      };
    }
    circuits[outlet.circuit].outlets.push({
      wallId: outlet.wallId,
      position: outlet.position,
    });
  });

  return {
    outlets,
    gfciZones,
    circuits: Object.values(circuits),
  };
}

/**
 * Main NKBA validation function - comprehensive kitchen compliance check
 *
 * @param {Object} layoutResult - Layout output with appliance positions and cabinet runs
 * @param {Object} roomGeometry - Room dimensions { width, length, ceiling }
 * @param {Object} options - Validation options
 * @param {boolean} options.adaMode - Apply ADA accessibility standards
 * @param {boolean} options.strictMode - Enforce all guidelines as errors (not warnings)
 * @param {Object} options.appliances - Appliance configuration
 * @returns {ValidationResult} Comprehensive validation results with score
 */
export function validateNKBA(layoutResult = {}, roomGeometry = {}, options = {}) {
  const {
    adaMode = false,
    strictMode = false,
    appliances = {},
  } = options;

  const allIssues = [];
  let categoryScores = {
    electrical: 100,
    workTriangle: 100,
    landingAreas: 100,
    clearances: 100,
    ventilation: 100,
  };

  // --- ELECTRICAL OUTLET VALIDATION ---
  const {
    outlets,
    issues: electricalIssues,
  } = validateOutletPlacement(
    layoutResult.wallLayouts,
    layoutResult.waterSourceLocations
  );

  allIssues.push(...electricalIssues);
  if (electricalIssues.length > 0) {
    categoryScores.electrical = Math.max(0, 100 - electricalIssues.length * 10);
  }

  // --- WORK TRIANGLE VALIDATION ---
  const workTriangleResult = validateWorkTriangle(
    layoutResult.sinkPosition || { x: 0, y: 0 },
    layoutResult.rangePosition || { x: 0, y: 0 },
    layoutResult.fridgePosition || { x: 0, y: 0 }
  );

  allIssues.push(...workTriangleResult.issues);
  if (workTriangleResult.issues.length > 0) {
    categoryScores.workTriangle = workTriangleResult.valid ? 90 : 60;
  }

  // --- LANDING AREA VALIDATION ---
  const landingIssues = validateLandingAreas(
    layoutResult.appliances || appliances,
    layoutResult.cabinetRuns || {}
  );

  allIssues.push(...landingIssues);
  if (landingIssues.length > 0) {
    categoryScores.landingAreas = Math.max(0, 100 - landingIssues.length * 15);
  }

  // --- CLEARANCE VALIDATION ---
  const clearanceIssues = validateClearances(
    roomGeometry,
    layoutResult.cabinetPositions || {},
    adaMode
  );

  allIssues.push(...clearanceIssues);
  if (clearanceIssues.length > 0) {
    categoryScores.clearances = Math.max(0, 100 - clearanceIssues.length * 15);
  }

  // --- VENTILATION VALIDATION ---
  const ventilationIssues = [];
  if (NKBA_STANDARDS.ventilation.cooktopMustHaveVentilation && !layoutResult.hoodPresent) {
    ventilationIssues.push({
      severity: strictMode ? 'error' : 'error',
      rule: 'Range Hood Required',
      code: 'NKBA 5',
      message: 'Cooktop/range must have ventilation (hood or downdraft)',
      fix: 'Add range hood or downdraft ventilation system',
      data: { hoodPresent: false },
    });
  } else if (layoutResult.hoodPresent) {
    const cooktopWidth = layoutResult.cooktopWidth || 30;
    const hoodWidth = layoutResult.hoodWidth || 30;

    if (hoodWidth < cooktopWidth) {
      ventilationIssues.push({
        severity: 'warning',
        rule: 'Hood Width',
        code: 'NKBA 5',
        message: `Hood width (${hoodWidth}") is less than cooktop width (${cooktopWidth}")`,
        fix: 'Ensure hood width equals or exceeds cooktop width',
        data: { hoodWidth, cooktopWidth },
      });
    }

    if (layoutResult.hoodHeight !== undefined) {
      const hoodHeight = layoutResult.hoodHeight;
      const minHeight = NKBA_STANDARDS.ventilation.hoodHeightMin;
      const maxHeight = NKBA_STANDARDS.ventilation.hoodHeightMax;

      if (hoodHeight < minHeight || hoodHeight > maxHeight) {
        ventilationIssues.push({
          severity: 'warning',
          rule: 'Hood Height',
          code: 'NKBA 5',
          message: `Hood height (${hoodHeight}") should be ${minHeight}"–${maxHeight}" above cooktop`,
          fix: `Adjust hood height to ${minHeight}"–${maxHeight}" above cooktop`,
          data: { hoodHeight, min: minHeight, max: maxHeight },
        });
      }
    }
  }

  allIssues.push(...ventilationIssues);
  if (ventilationIssues.length > 0) {
    categoryScores.ventilation = Math.max(0, 100 - ventilationIssues.length * 20);
  }

  // --- ADA COMPLIANCE (if enabled) ---
  if (adaMode) {
    const adaIssues = [];

    if (layoutResult.counterHeight > NKBA_STANDARDS.ada.maxCounterHeight) {
      adaIssues.push({
        severity: 'error',
        rule: 'ADA Counter Height',
        code: 'ADAAG 2010 304.1',
        message: `Counter height ${layoutResult.counterHeight}" exceeds ADA maximum 34"`,
        fix: 'Reduce counter height to maximum 34" for ADA compliance',
        data: { height: layoutResult.counterHeight, max: NKBA_STANDARDS.ada.maxCounterHeight },
      });
    }

    allIssues.push(...adaIssues);
  }

  // --- CALCULATE OVERALL SCORE ---
  const categoryWeights = {
    electrical: 0.25,
    workTriangle: 0.25,
    landingAreas: 0.20,
    clearances: 0.20,
    ventilation: 0.10,
  };

  const score = Math.round(
    Object.entries(categoryWeights).reduce((sum, [category, weight]) => {
      return sum + (categoryScores[category] * weight);
    }, 0)
  );

  // --- PROMOTE WARNINGS TO ERRORS IF STRICT MODE ---
  if (strictMode) {
    allIssues.forEach(issue => {
      if (issue.severity === 'warning') {
        issue.severity = 'error';
      }
    });
  }

  return {
    issues: allIssues,
    outlets,
    workTriangle: workTriangleResult,
    score,
    details: {
      electrical: { score: categoryScores.electrical, issues: electricalIssues },
      workTriangle: { score: categoryScores.workTriangle, issues: workTriangleResult.issues },
      landingAreas: { score: categoryScores.landingAreas, issues: landingIssues },
      clearances: { score: categoryScores.clearances, issues: clearanceIssues },
      ventilation: { score: categoryScores.ventilation, issues: ventilationIssues },
    },
  };
}

export default {
  NKBA_STANDARDS,
  validateNKBA,
  validateWorkTriangle,
  generateOutletPlan,
};
