/**
 * mounting-rail.js
 * Mounting rail calculation and cut list generation for frameless upper cabinet suspension.
 *
 * Eclipse cabinets are frameless and upper wall cabinets hang on metal suspension rails
 * (Z-brackets/French cleats). This module calculates rail positions, cuts, and hardware placement.
 *
 * @module mounting-rail
 */

/**
 * Standard dimensions and tolerances for mounting rail systems.
 * @type {Object}
 */
export const RAIL_CONSTANTS = {
  // Standard upper cabinet mounting
  STANDARD_UPPER_HEIGHT: 30,           // inches
  STANDARD_UPPER_MOUNT_AFF: 54,        // inches (bottom of upper cabinet)
  CLEAT_OFFSET: 2,                      // inches from top of cabinet to rail mount

  // Stock rail lengths
  STOCK_RAIL_LENGTHS: [48, 96],         // inches
  SPLICE_OVERLAP: 4,                    // inches minimum for splice

  // Hardware spacing
  STUD_SPACING: 16,                     // inches (typical on-center)
  SCREW_MARGIN: 3,                      // inches from rail end to first screw

  // Corner and detail
  CORNER_GAP: 0.75,                     // inches (end panel thickness)
  END_PANEL_MARGIN: 1,                  // inches for end-panel returns
  LED_CHANNEL_OFFSET: 1,                // inches above bottom of uppers

  // Tolerances
  FLOATING_POINT_PRECISION: 0.01        // inches
};

/**
 * Calculate the mounting height (AFF) for a rail based on upper cabinet height and ceiling.
 *
 * Rail mounts at the BACK TOP of the upper cabinet, calculated as:
 * railHeight = ceilingHeight - soffit_gap - upper_height + cleat_offset
 *
 * Or simplified: upper_mount_height + upper_height - cleat_offset
 * where upper_mount_height is the bottom of the cabinet (typically 54" AFF for standard 30" uppers).
 *
 * @param {number} upperHeight - Height of upper cabinet in inches
 * @param {number} ceilingHeight - Floor-to-ceiling height in inches (optional if upperMountHeight provided)
 * @param {Object} options - Configuration options
 * @param {number} [options.upperMountHeight=54] - Bottom of upper cabinet AFF (standard: 54")
 * @param {number} [options.cleatsOffset=2] - Distance from top of cabinet to rail mount point
 * @returns {number} Rail mounting height in inches AFF
 *
 * @example
 * // Standard 30" upper at 54" bottom mount height
 * calculateRailHeight(30, undefined, { upperMountHeight: 54 })
 * // Returns: 82 (54 + 30 - 2)
 */
export function calculateRailHeight(upperHeight, ceilingHeight, options = {}) {
  const {
    upperMountHeight = RAIL_CONSTANTS.STANDARD_UPPER_MOUNT_AFF,
    cleatsOffset = RAIL_CONSTANTS.CLEAT_OFFSET
  } = options;

  return upperMountHeight + upperHeight - cleatsOffset;
}

/**
 * Calculate screw locations along a rail run, ensuring studs are hit.
 *
 * Screws are placed every 16" (or custom stud spacing), with first screw within 3" of the end.
 *
 * @param {number} railStart - Start position of rail in inches
 * @param {number} railEnd - End position of rail in inches
 * @param {Object} options - Configuration
 * @param {number} [options.studSpacing=16] - Stud spacing in inches
 * @param {number} [options.marginFromEnd=3] - Distance from rail end to first/last screw in inches
 * @returns {Array<{position: number, studCenterNearest: number}>} Screw locations
 */
export function calculateScrewLocations(railStart, railEnd, options = {}) {
  const {
    studSpacing = RAIL_CONSTANTS.STUD_SPACING,
    marginFromEnd = RAIL_CONSTANTS.SCREW_MARGIN
  } = options;

  const screws = [];
  const railLength = railEnd - railStart;

  if (railLength < marginFromEnd * 2) {
    // Rail too short for standard placement
    screws.push({
      position: railStart + railLength / 2,
      studCenterNearest: null
    });
    return screws;
  }

  // Place first screw within margin from start
  let currentPos = railStart + marginFromEnd;

  while (currentPos <= railEnd - marginFromEnd) {
    screws.push({
      position: currentPos,
      studCenterNearest: Math.round(currentPos / studSpacing) * studSpacing
    });
    currentPos += studSpacing;
  }

  // Add final screw near the end if not already placed
  if (screws.length === 0 || (railEnd - screws[screws.length - 1].position) > marginFromEnd) {
    screws.push({
      position: railEnd - marginFromEnd,
      studCenterNearest: Math.round((railEnd - marginFromEnd) / studSpacing) * studSpacing
    });
  }

  return screws;
}

/**
 * Calculate stock pieces and splice points needed to reach a target rail length.
 *
 * Returns how many standard stock lengths are needed and where splices occur (with 4" overlap).
 *
 * @param {number} railLength - Total rail length needed in inches
 * @param {Array<number>} [stockLengths=[48, 96]] - Available stock lengths in inches
 * @param {number} [spliceOverlap=4] - Overlap required for splice in inches
 * @returns {Object} { pieces: Array<{length: number}>, splices: Array<{position: number, overlap: number}>, totalWaste: number }
 *
 * @example
 * // Need a 120" run
 * calculateStockPieces(120, [48, 96], 4)
 * // Returns: { pieces: [{length: 96}, {length: 48}], splices: [{position: 96, overlap: 4}], totalWaste: 24 }
 */
export function calculateStockPieces(railLength, stockLengths = RAIL_CONSTANTS.STOCK_RAIL_LENGTHS, spliceOverlap = RAIL_CONSTANTS.SPLICE_OVERLAP) {
  const pieces = [];
  const splices = [];
  let remainingLength = railLength;
  let currentPosition = 0;

  // Greedy algorithm: use largest stock pieces first
  const sortedStocks = [...stockLengths].sort((a, b) => b - a);

  while (remainingLength > RAIL_CONSTANTS.FLOATING_POINT_PRECISION) {
    let placed = false;

    for (const stockLength of sortedStocks) {
      if (stockLength <= remainingLength + spliceOverlap) {
        const pieceLength = Math.min(stockLength, remainingLength + spliceOverlap);
        pieces.push({ length: pieceLength, startPosition: currentPosition });

        if (remainingLength > stockLength) {
          // Need splice
          splices.push({
            position: currentPosition + stockLength - spliceOverlap,
            overlap: spliceOverlap
          });
          remainingLength -= (stockLength - spliceOverlap);
          currentPosition += (stockLength - spliceOverlap);
        } else {
          remainingLength -= pieceLength;
          currentPosition += pieceLength;
        }

        placed = true;
        break;
      }
    }

    if (!placed) {
      // Fallback: use smallest stock
      const smallest = sortedStocks[sortedStocks.length - 1];
      pieces.push({ length: smallest, startPosition: currentPosition });
      splices.push({
        position: currentPosition + smallest - spliceOverlap,
        overlap: spliceOverlap
      });
      remainingLength -= (smallest - spliceOverlap);
      currentPosition += (smallest - spliceOverlap);
    }
  }

  // Calculate total waste
  const totalPieceLength = pieces.reduce((sum, p) => sum + p.length, 0);
  const totalSpliceOverlap = splices.reduce((sum, s) => sum + s.overlap, 0);
  const totalWaste = totalPieceLength - railLength + totalSpliceOverlap;

  return { pieces, splices, totalWaste };
}

/**
 * Generate mounting rails for a complete kitchen layout.
 *
 * For each wall with upper cabinets, creates one or more continuous rails (split at obstacles like hoods).
 * Calculates rail height, positions, cut lists, screw locations, and LED channel mounts (if enabled).
 *
 * @param {Array<Object>} upperLayouts - Upper cabinet instances from layout engine
 *   @param {string} upperLayouts[].wallId - Wall identifier
 *   @param {number} upperLayouts[].x - Left edge position in inches
 *   @param {number} upperLayouts[].width - Cabinet width in inches
 *   @param {number} upperLayouts[].height - Cabinet height in inches
 *
 * @param {Array<Object>} wallDefs - Wall definitions
 *   @param {string} wallDefs[].wallId - Unique wall identifier
 *   @param {number} wallDefs[].ceilingHeight - Floor-to-ceiling in inches
 *   @param {Array<Object>} [wallDefs[].obstacles] - Range hoods, cooktops, etc. that break rail runs
 *     @param {number} [wallDefs[].obstacles[].x] - Left edge of obstacle
 *     @param {number} [wallDefs[].obstacles[].width] - Obstacle width
 *
 * @param {Object} options - Configuration
 * @param {number} [options.upperMountHeight=54] - Bottom of upper cabinet AFF
 * @param {number} [options.cornerGap=0.75] - Gap at corners for end panel
 * @param {number} [options.endPanelMargin=1] - Margin for end panel returns
 * @param {boolean} [options.lightingEnabled=false] - Generate secondary LED channel rail
 * @param {number} [options.ledChannelOffset=1] - Distance above bottom of uppers for LED mount
 * @param {number} [options.studSpacing=16] - Stud spacing for screw placement
 *
 * @returns {Object} Complete rail specifications
 *   @returns {Array<Object>} .rails - Array of rail objects
 *     @returns {string} .rails[].wallId - Wall identifier
 *     @returns {string} .rails[].railId - Unique rail identifier
 *     @returns {number} .rails[].height - Mount height AFF in inches
 *     @returns {number} .rails[].startPos - Left position in inches
 *     @returns {number} .rails[].endPos - Right position in inches
 *     @returns {number} .rails[].cutLength - Total cut length in inches
 *     @returns {Array<Object>} .rails[].stockPieces - Stock pieces needed
 *     @returns {Array<Object>} .rails[].splicePoints - Splice locations
 *     @returns {Array<Object>} .rails[].screws - Screw locations
 *     @returns {boolean} .rails[].isLedChannel - True if secondary LED rail
 *   @returns {Array<Object>} .cutList - Flat list of all cuts needed
 *   @returns {Array<Object>} .screwLocations - All screw placements by wall
 *   @returns {Object} .stockNeeded - Summary of stock pieces by length and total waste
 *
 * @example
 * const result = generateMountingRails(
 *   [
 *     { wallId: 'west', x: 0, width: 36, height: 30 },
 *     { wallId: 'west', x: 36, width: 24, height: 30 }
 *   ],
 *   [{ wallId: 'west', ceilingHeight: 108, obstacles: [] }],
 *   { upperMountHeight: 54, lightingEnabled: true }
 * );
 *
 * // result.rails[0] =>
 * // {
 * //   wallId: 'west',
 * //   railId: 'west-rail-1',
 * //   height: 82,
 * //   startPos: 0,
 * //   endPos: 60,
 * //   cutLength: 60,
 * //   stockPieces: [...],
 * //   splicePoints: [],
 * //   screws: [...]
 * // }
 */
export function generateMountingRails(upperLayouts, wallDefs, options = {}) {
  const {
    upperMountHeight = RAIL_CONSTANTS.STANDARD_UPPER_MOUNT_AFF,
    cornerGap = RAIL_CONSTANTS.CORNER_GAP,
    endPanelMargin = RAIL_CONSTANTS.END_PANEL_MARGIN,
    lightingEnabled = false,
    ledChannelOffset = RAIL_CONSTANTS.LED_CHANNEL_OFFSET,
    studSpacing = RAIL_CONSTANTS.STUD_SPACING
  } = options;

  const rails = [];
  const cutList = [];
  const screwLocations = [];
  const stockNeeded = {};
  let railIndex = 1;

  // Group upper cabinets by wall
  const cabinetsByWall = new Map();
  upperLayouts.forEach(cabinet => {
    if (!cabinetsByWall.has(cabinet.wallId)) {
      cabinetsByWall.set(cabinet.wallId, []);
    }
    cabinetsByWall.get(cabinet.wallId).push(cabinet);
  });

  // Create wall lookup
  const wallMap = new Map(wallDefs.map(w => [w.wallId, w]));

  // Process each wall
  cabinetsByWall.forEach((cabinets, wallId) => {
    const wall = wallMap.get(wallId);
    if (!wall) {
      console.warn(`Wall definition not found for ${wallId}`);
      return;
    }

    // Sort cabinets left to right
    cabinets.sort((a, b) => a.x - b.x);

    // Determine upper cabinet height for this wall (assume uniform per wall)
    const upperHeight = cabinets[0]?.height || RAIL_CONSTANTS.STANDARD_UPPER_HEIGHT;
    const railHeight = calculateRailHeight(upperHeight, wall.ceilingHeight, {
      upperMountHeight,
      cleatsOffset: RAIL_CONSTANTS.CLEAT_OFFSET
    });

    // Find continuous rail runs (broken by obstacles like hoods)
    const runs = _calculateRailRuns(cabinets, wall.obstacles || [], {
      cornerGap,
      endPanelMargin
    });

    // Generate rail for each run
    runs.forEach((run, runIndex) => {
      const railId = `${wallId}-rail-${railIndex}`;
      const { startPos, endPos } = run;
      const cutLength = endPos - startPos;

      // Calculate stock pieces
      const { pieces, splices, totalWaste } = calculateStockPieces(cutLength);

      // Calculate screw locations
      const screws = calculateScrewLocations(startPos, endPos, { studSpacing });

      // Add primary rail
      const primaryRail = {
        wallId,
        railId,
        height: railHeight,
        startPos,
        endPos,
        cutLength,
        stockPieces: pieces,
        splicePoints: splices,
        screws,
        isLedChannel: false
      };

      rails.push(primaryRail);
      cutList.push({
        railId,
        wallId,
        height: railHeight,
        cutLength,
        stockPieces: pieces,
        splicePoints: splices,
        isLedChannel: false
      });

      screwLocations.push({
        railId,
        wallId,
        height: railHeight,
        screws
      });

      // Track stock needed
      pieces.forEach(piece => {
        const length = piece.length;
        stockNeeded[length] = (stockNeeded[length] || 0) + 1;
      });

      // Add secondary LED channel rail if enabled
      if (lightingEnabled) {
        const ledRailId = `${wallId}-led-${railIndex}`;
        const ledHeight = railHeight - ledChannelOffset - upperHeight;
        const ledRail = {
          wallId,
          railId: ledRailId,
          height: ledHeight,
          startPos,
          endPos,
          cutLength,
          stockPieces: pieces,
          splicePoints: splices,
          screws,
          isLedChannel: true
        };

        rails.push(ledRail);
        cutList.push({
          railId: ledRailId,
          wallId,
          height: ledHeight,
          cutLength,
          stockPieces: pieces,
          splicePoints: splices,
          isLedChannel: true
        });

        screwLocations.push({
          railId: ledRailId,
          wallId,
          height: ledHeight,
          screws
        });

        pieces.forEach(piece => {
          const length = piece.length;
          stockNeeded[length] = (stockNeeded[length] || 0) + 1;
        });
      }

      railIndex++;
    });
  });

  // Calculate total stock and waste summary
  const stockSummary = Object.keys(stockNeeded)
    .sort((a, b) => Number(b) - Number(a))
    .reduce((acc, length) => {
      acc[length] = stockNeeded[length];
      return acc;
    }, {});

  const totalLinearInches = Object.entries(stockSummary)
    .reduce((sum, [length, count]) => sum + (Number(length) * count), 0);

  const totalCutInches = cutList.reduce((sum, cut) => sum + cut.cutLength, 0);
  const totalWaste = totalLinearInches - totalCutInches;

  return {
    rails,
    cutList,
    screwLocations,
    stockNeeded: {
      byLength: stockSummary,
      totalLinearInches,
      totalCutInches,
      totalWaste,
      wastePercentage: totalLinearInches > 0 ? ((totalWaste / totalLinearInches) * 100).toFixed(1) : 0
    }
  };
}

/**
 * Internal helper: Calculate continuous rail runs on a wall, accounting for obstacles.
 *
 * @private
 * @param {Array<Object>} cabinets - Sorted upper cabinet objects
 * @param {Array<Object>} obstacles - Hood, cooktop, etc. that break the rail
 * @param {Object} margins - cornerGap and endPanelMargin
 * @returns {Array<{startPos: number, endPos: number}>} Rail run segments
 */
function _calculateRailRuns(cabinets, obstacles = [], margins = {}) {
  const { cornerGap = 0.75, endPanelMargin = 1 } = margins;

  if (cabinets.length === 0) {
    return [];
  }

  // Find leftmost and rightmost cabinet positions
  const leftmost = Math.min(...cabinets.map(c => c.x)) - endPanelMargin;
  const rightmost = Math.max(...cabinets.map(c => c.x + c.width)) + endPanelMargin;

  // Sort obstacles by position
  const sortedObstacles = [...obstacles].sort((a, b) => a.x - b.x);

  // If no obstacles, return single run
  if (sortedObstacles.length === 0) {
    return [{ startPos: leftmost, endPos: rightmost }];
  }

  // Split into segments around obstacles
  const runs = [];
  let currentStart = leftmost;

  sortedObstacles.forEach(obstacle => {
    const obstacleStart = obstacle.x - cornerGap;
    const obstacleEnd = obstacle.x + obstacle.width + cornerGap;

    // Rail segment before this obstacle
    if (currentStart < obstacleStart && obstacleStart < rightmost) {
      runs.push({
        startPos: currentStart,
        endPos: Math.min(obstacleStart, rightmost)
      });
    }

    currentStart = Math.max(currentStart, obstacleEnd);
  });

  // Final segment after last obstacle
  if (currentStart < rightmost) {
    runs.push({
      startPos: currentStart,
      endPos: rightmost
    });
  }

  // Filter out negligible segments
  return runs.filter(run => run.endPos - run.startPos > 1);
}

export default {
  RAIL_CONSTANTS,
  calculateRailHeight,
  calculateScrewLocations,
  calculateStockPieces,
  generateMountingRails
};
