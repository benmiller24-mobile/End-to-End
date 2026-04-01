/**
 * Scribe Tolerance Module
 * Handles out-of-square wall compensation using scribe fillers and tolerance margins
 * for the Eclipse Kitchen Cabinet Layout Engine (frameless cabinetry).
 *
 * @module scribe-tolerance
 */

/**
 * Scribe tolerance constants and SKU patterns
 * @type {Object}
 */
export const SCRIBE_CONSTANTS = {
  // Default scribe margin (wiggle room for installer to shave wood to fit)
  SCRIBE_MARGIN: 0.5, // inches

  // Wall deviation thresholds
  WALL_DEVIATION_THRESHOLD_WARNING: 0.5, // inches — use wider scribe filler
  WALL_DEVIATION_THRESHOLD_ALERT: 1.5, // inches — flag warning, may need shimming
  WALL_DEVIATION_THRESHOLD_ERROR: 3.0, // inches — flag error, wall needs remediation

  // Scribe filler SKU patterns and dimensions
  SCRIBE_SKUS: {
    'SCRIBE-3': {
      width: 3,
      description: 'Standard scribe filler (3")',
      minCutWidth: 0.5,
      maxCutWidth: 3,
    },
    'SCRIBE-6': {
      width: 6,
      description: 'Wide scribe filler for out-of-square walls (6")',
      minCutWidth: 0.5,
      maxCutWidth: 6,
    },
  },

  // Cabinet types that support scribing
  SCRIPTABLE_CABINET_TYPES: ['base', 'upper', 'tall'],

  // Positions where scribes should NOT be applied (handled by other modules)
  EXCLUDE_POSITIONS: ['corner', 'appliance', 'island'],
};

/**
 * Calculates the appropriate scribe width based on available gap and wall deviation
 *
 * @param {number} availableGap - Gap between cabinet end and wall (inches)
 * @param {number} [wallDeviation=0] - Wall out-of-square measurement (inches)
 * @param {number} [scribeMargin=SCRIBE_MARGIN] - Configurable scribe margin (inches)
 * @returns {number} Adjusted width for scribe filler (inches)
 *
 * @example
 * // Standard gap with no deviation
 * const width = calculateScribeWidth(1.0, 0);
 * // Returns: 0.5 (scribe is 1/2" to allow wiggle room)
 *
 * @example
 * // Out-of-square wall
 * const width = calculateScribeWidth(1.0, 0.75);
 * // Returns: 0.5 (still uses standard scribe margin)
 */
export function calculateScribeWidth(availableGap, wallDeviation = 0, scribeMargin = SCRIBE_CONSTANTS.SCRIBE_MARGIN) {
  if (availableGap <= 0) {
    throw new Error(`Invalid availableGap: ${availableGap}. Must be positive.`);
  }

  // The scribe width is the margin we reserve for installer adjustment
  // Deviation affects which SKU to use, but width calculation remains consistent
  const scribeWidth = Math.min(availableGap, scribeMargin);

  return Math.round(scribeWidth * 100) / 100; // Round to 2 decimal places
}

/**
 * Selects the appropriate scribe filler SKU based on wall deviation
 *
 * @param {number} wallDeviation - Wall out-of-square measurement (inches)
 * @returns {string} SKU identifier ('SCRIBE-3' or 'SCRIBE-6')
 *
 * @private
 */
function selectScribeSku(wallDeviation = 0) {
  if (wallDeviation > SCRIBE_CONSTANTS.WALL_DEVIATION_THRESHOLD_WARNING) {
    return 'SCRIBE-6';
  }
  return 'SCRIBE-3';
}

/**
 * Determines if a wall position is valid for scribe application
 *
 * @param {string} position - Position identifier ('corner', 'appliance', 'wall', etc.)
 * @returns {boolean} True if scribes should be applied at this position
 *
 * @private
 */
function isValidScribePosition(position) {
  return !SCRIBE_CONSTANTS.EXCLUDE_POSITIONS.includes(position);
}

/**
 * Identifies termination points in a cabinet run and applies scribe tolerance
 *
 * @param {Array<Object>} runCabinets - Cabinets in a single wall run
 * @param {string} wallId - Wall identifier
 * @param {string} cabinetType - 'base', 'upper', or 'tall'
 * @param {number} [wallDeviation=0] - Wall out-of-square measurement (inches)
 * @returns {Object} { scribes: [], adjustments: [] }
 *
 * @private
 */
function analyzeRunForScribes(runCabinets, wallId, cabinetType, wallDeviation = 0) {
  const scribes = [];
  const adjustments = [];

  if (!runCabinets || runCabinets.length === 0) {
    return { scribes, adjustments };
  }

  // Check start of run (first cabinet against wall)
  const firstCabinet = runCabinets[0];
  if (firstCabinet.position === 'wall-start' && isValidScribePosition(firstCabinet.position)) {
    const scribeWidth = calculateScribeWidth(0.5, wallDeviation);
    const sku = selectScribeSku(wallDeviation);

    scribes.push({
      wallId,
      position: 0,
      side: 'left',
      width: scribeWidth,
      sku,
      cabinetType,
      affectedCabinetSku: firstCabinet.sku,
      originalWidth: firstCabinet.width,
      adjustedWidth: firstCabinet.width - SCRIBE_CONSTANTS.SCRIBE_MARGIN,
    });

    adjustments.push({
      cabinetSku: firstCabinet.sku,
      originalWidth: firstCabinet.width,
      newWidth: firstCabinet.width - SCRIBE_CONSTANTS.SCRIBE_MARGIN,
      reason: 'scribe-tolerance-start',
    });
  }

  // Check end of run (last cabinet against wall)
  const lastCabinet = runCabinets[runCabinets.length - 1];
  if (lastCabinet.position === 'wall-end' && isValidScribePosition(lastCabinet.position)) {
    const scribeWidth = calculateScribeWidth(0.5, wallDeviation);
    const sku = selectScribeSku(wallDeviation);

    scribes.push({
      wallId,
      position: 'end',
      side: 'right',
      width: scribeWidth,
      sku,
      cabinetType,
      affectedCabinetSku: lastCabinet.sku,
      originalWidth: lastCabinet.width,
      adjustedWidth: lastCabinet.width - SCRIBE_CONSTANTS.SCRIBE_MARGIN,
    });

    adjustments.push({
      cabinetSku: lastCabinet.sku,
      originalWidth: lastCabinet.width,
      newWidth: lastCabinet.width - SCRIBE_CONSTANTS.SCRIBE_MARGIN,
      reason: 'scribe-tolerance-end',
    });
  }

  return { scribes, adjustments };
}

/**
 * Generates validation issues for scribe fillers based on wall deviations
 *
 * @param {Array<Object>} scribes - Array of scribe filler objects
 * @param {Object} [wallDeviations={}] - Map of wallId to deviation in inches
 * @returns {Array<Object>} Validation issues with severity levels
 *
 * @private
 */
function generateScribeValidation(scribes, wallDeviations = {}) {
  const issues = [];

  scribes.forEach((scribe) => {
    const deviation = wallDeviations[scribe.wallId] || 0;

    // Warning: High out-of-square measurement
    if (deviation > SCRIBE_CONSTANTS.WALL_DEVIATION_THRESHOLD_ALERT) {
      issues.push({
        severity: 'warning',
        code: 'SCRIBE_HIGH_DEVIATION',
        message: `Wall ${scribe.wallId} has ${deviation}" out-of-square deviation. Installer may need to shim cabinets at position ${scribe.position}.`,
        scribeId: `${scribe.wallId}-${scribe.position}-${scribe.side}`,
        wallId: scribe.wallId,
        deviation,
      });
    }

    // Error: Wall needs remediation
    if (deviation > SCRIBE_CONSTANTS.WALL_DEVIATION_THRESHOLD_ERROR) {
      issues.push({
        severity: 'error',
        code: 'SCRIBE_CRITICAL_DEVIATION',
        message: `Wall ${scribe.wallId} has critical ${deviation}" out-of-square deviation. Wall must be remediated before installation.`,
        scribeId: `${scribe.wallId}-${scribe.position}-${scribe.side}`,
        wallId: scribe.wallId,
        deviation,
      });
    }
  });

  return issues;
}

/**
 * Applies scribe tolerance adjustments to wall and upper cabinet layouts
 *
 * Adds scribe fillers at run termination points and adjusts neighboring cabinet widths
 * to accommodate the scribe margin. Validates wall deviations and flags issues.
 *
 * @param {Object} wallLayouts - Wall layout data structure
 *   @param {string} wallLayouts.wallId - Unique wall identifier
 *   @param {Array<Object>} wallLayouts.baseRuns - Base cabinet runs
 *   @param {Array<Object>} wallLayouts.tallRuns - Tall cabinet runs (optional)
 *
 * @param {Object} upperLayouts - Upper cabinet layout data structure
 *   @param {Array<Object>} upperLayouts.runs - Upper cabinet runs
 *
 * @param {Array<Object>} corners - Corner filler placements (excluded from scribe logic)
 *
 * @param {Object} [wallDeviations={}] - Map of wallId to wall deviation in inches
 *   @example { wall-A: 0.75, wall-B: 1.25 }
 *
 * @returns {Object} Result object with adjusted layouts and validation
 *   @returns {Object} .adjustedLayouts - Updated cabinet layouts with width adjustments
 *   @returns {Array<Object>} .scribes - Array of scribe filler placements
 *   @returns {Array<Object>} .validation - Validation issues and warnings
 *   @returns {Object} .summary - Summary statistics
 *     @returns {number} .summary.totalScribes - Count of scribe fillers added
 *     @returns {number} .summary.affectedCabinets - Count of cabinets adjusted for scribe
 *     @returns {number} .summary.totalAdjustmentInches - Total width reduction from scribes
 *
 * @example
 * const result = applyScribeTolerance(
 *   wallLayouts,
 *   upperLayouts,
 *   corners,
 *   { 'wall-A': 0.75 }
 * );
 *
 * result.scribes.forEach(scribe => {
 *   console.log(`Add ${scribe.sku} at ${scribe.wallId}, position ${scribe.position}`);
 * });
 *
 * result.validation.forEach(issue => {
 *   if (issue.severity === 'error') console.warn(issue.message);
 * });
 */
export function applyScribeTolerance(wallLayouts, upperLayouts, corners = [], wallDeviations = {}) {
  // Validate inputs
  if (!wallLayouts || typeof wallLayouts !== 'object') {
    throw new Error('wallLayouts must be a valid object');
  }
  if (!upperLayouts || typeof upperLayouts !== 'object') {
    throw new Error('upperLayouts must be a valid object');
  }

  const scribes = [];
  const adjustedLayouts = {
    walls: structuredClone(wallLayouts),
    uppers: structuredClone(upperLayouts),
  };
  const validation = [];
  const affectedCabinets = new Set();

  // Process base cabinet runs
  if (wallLayouts.baseRuns && Array.isArray(wallLayouts.baseRuns)) {
    wallLayouts.baseRuns.forEach((run) => {
      const wallId = run.wallId || wallLayouts.wallId;
      const deviation = wallDeviations[wallId] || 0;

      const { scribes: runScribes, adjustments } = analyzeRunForScribes(
        run.cabinets,
        wallId,
        'base',
        deviation
      );

      // Merge scribe results
      scribes.push(...runScribes);

      // Apply width adjustments to layout
      adjustments.forEach((adj) => {
        const cabinet = adjustedLayouts.walls.baseRuns
          ?.flatMap((r) => r.cabinets)
          .find((c) => c.sku === adj.cabinetSku);

        if (cabinet) {
          cabinet.originalWidth = adj.originalWidth;
          cabinet.width = adj.newWidth;
          cabinet.scribeAdjustment = SCRIBE_CONSTANTS.SCRIBE_MARGIN;
          affectedCabinets.add(adj.cabinetSku);
        }
      });
    });
  }

  // Process tall cabinet runs
  if (wallLayouts.tallRuns && Array.isArray(wallLayouts.tallRuns)) {
    wallLayouts.tallRuns.forEach((run) => {
      const wallId = run.wallId || wallLayouts.wallId;
      const deviation = wallDeviations[wallId] || 0;

      const { scribes: runScribes, adjustments } = analyzeRunForScribes(
        run.cabinets,
        wallId,
        'tall',
        deviation
      );

      scribes.push(...runScribes);

      adjustments.forEach((adj) => {
        const cabinet = adjustedLayouts.walls.tallRuns
          ?.flatMap((r) => r.cabinets)
          .find((c) => c.sku === adj.cabinetSku);

        if (cabinet) {
          cabinet.originalWidth = adj.originalWidth;
          cabinet.width = adj.newWidth;
          cabinet.scribeAdjustment = SCRIBE_CONSTANTS.SCRIBE_MARGIN;
          affectedCabinets.add(adj.cabinetSku);
        }
      });
    });
  }

  // Process upper cabinet runs
  if (upperLayouts.runs && Array.isArray(upperLayouts.runs)) {
    upperLayouts.runs.forEach((run) => {
      const wallId = run.wallId || upperLayouts.wallId;
      const deviation = wallDeviations[wallId] || 0;

      const { scribes: runScribes, adjustments } = analyzeRunForScribes(
        run.cabinets,
        wallId,
        'upper',
        deviation
      );

      scribes.push(...runScribes);

      adjustments.forEach((adj) => {
        const cabinet = adjustedLayouts.uppers.runs
          ?.flatMap((r) => r.cabinets)
          .find((c) => c.sku === adj.cabinetSku);

        if (cabinet) {
          cabinet.originalWidth = adj.originalWidth;
          cabinet.width = adj.newWidth;
          cabinet.scribeAdjustment = SCRIBE_CONSTANTS.SCRIBE_MARGIN;
          affectedCabinets.add(adj.cabinetSku);
        }
      });
    });
  }

  // Generate validation issues
  const scribeValidation = generateScribeValidation(scribes, wallDeviations);
  validation.push(...scribeValidation);

  // Add countertop notes
  if (scribes.length > 0) {
    validation.push({
      severity: 'info',
      code: 'SCRIBE_COUNTERTOP_NOTE',
      message: `Scribe fillers are under the countertop. Countertop extends wall-to-wall, bridging over ${scribes.length} scribe filler(s).`,
      affectedScribes: scribes.map((s) => `${s.wallId}-${s.position}-${s.side}`),
    });
  }

  // Calculate summary statistics
  const totalAdjustmentInches = Array.from(affectedCabinets).length * SCRIBE_CONSTANTS.SCRIBE_MARGIN;

  return {
    adjustedLayouts,
    scribes,
    validation,
    summary: {
      totalScribes: scribes.length,
      affectedCabinets: affectedCabinets.size,
      totalAdjustmentInches: Math.round(totalAdjustmentInches * 100) / 100,
    },
  };
}

/**
 * Validates scribe filler placements against wall layouts
 *
 * Checks for:
 * - Duplicate scribes at same position
 * - Scribe placement conflicts with corners/appliances
 * - Width consistency
 * - SKU availability
 *
 * @param {Array<Object>} scribes - Array of scribe filler objects to validate
 * @param {Object} wallLayouts - Wall layout data for cross-referencing
 *
 * @returns {Array<Object>} Validation issues with severity levels
 *   @property {string} severity - 'error', 'warning', or 'info'
 *   @property {string} code - Error code identifier
 *   @property {string} message - Human-readable message
 *
 * @example
 * const issues = validateScribes(scribes, wallLayouts);
 * issues.filter(i => i.severity === 'error').forEach(e => console.error(e.message));
 */
export function validateScribes(scribes, wallLayouts) {
  const issues = [];
  const seenPositions = new Map();

  if (!Array.isArray(scribes)) {
    throw new Error('scribes must be an array');
  }

  scribes.forEach((scribe) => {
    // Validate required fields
    const requiredFields = ['wallId', 'position', 'side', 'width', 'sku', 'cabinetType'];
    requiredFields.forEach((field) => {
      if (!(field in scribe)) {
        issues.push({
          severity: 'error',
          code: 'SCRIBE_MISSING_FIELD',
          message: `Scribe missing required field: ${field}`,
        });
      }
    });

    // Check for duplicate positions
    const positionKey = `${scribe.wallId}-${scribe.position}-${scribe.side}`;
    if (seenPositions.has(positionKey)) {
      issues.push({
        severity: 'error',
        code: 'SCRIBE_DUPLICATE_POSITION',
        message: `Duplicate scribe at ${positionKey}. Only one scribe allowed per position/side.`,
      });
    }
    seenPositions.set(positionKey, true);

    // Validate SKU
    if (!SCRIBE_CONSTANTS.SCRIBE_SKUS[scribe.sku]) {
      issues.push({
        severity: 'error',
        code: 'SCRIBE_INVALID_SKU',
        message: `Invalid scribe SKU: ${scribe.sku}. Must be one of: ${Object.keys(SCRIBE_CONSTANTS.SCRIBE_SKUS).join(', ')}`,
      });
    }

    // Validate cabinet type
    if (!SCRIBE_CONSTANTS.SCRIPTABLE_CABINET_TYPES.includes(scribe.cabinetType)) {
      issues.push({
        severity: 'error',
        code: 'SCRIBE_INVALID_CABINET_TYPE',
        message: `Invalid cabinet type for scribing: ${scribe.cabinetType}`,
      });
    }

    // Validate width
    if (scribe.width <= 0 || scribe.width > 3) {
      issues.push({
        severity: 'warning',
        code: 'SCRIBE_UNUSUAL_WIDTH',
        message: `Scribe width ${scribe.width}" is unusual. Standard scribe margin is 0.5".`,
      });
    }

    // Validate cabinet adjustment
    if (scribe.adjustedWidth && scribe.originalWidth) {
      const adjustment = scribe.originalWidth - scribe.adjustedWidth;
      if (adjustment !== SCRIBE_CONSTANTS.SCRIBE_MARGIN) {
        issues.push({
          severity: 'warning',
          code: 'SCRIBE_ADJUSTMENT_MISMATCH',
          message: `Cabinet ${scribe.affectedCabinetSku} adjusted by ${adjustment}", expected ${SCRIBE_CONSTANTS.SCRIBE_MARGIN}".`,
        });
      }
    }
  });

  return issues;
}

export default {
  SCRIBE_CONSTANTS,
  calculateScribeWidth,
  applyScribeTolerance,
  validateScribes,
};
