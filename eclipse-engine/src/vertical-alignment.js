/**
 * @fileoverview Vertical Common-Line Alignment Module
 * Ensures upper cabinet seams align with base cabinet seams, creating the professional
 * "grid" layout that expert designers demand. Implements alignment detection, optimization,
 * scoring, and visual grid export for frameless cabinetry.
 *
 * Part of the Eclipse Kitchen Cabinet Layout Engine
 * @version 1.0.0
 */

/**
 * Alignment tolerance in inches
 * Two seams within this distance are considered aligned
 */
const TOLERANCE_INCHES = 0.5;

/**
 * Scoring weights for alignment quality calculation
 */
const SCORING_WEIGHTS = {
  alignmentPercentage: 50,  // 50 points for perfect alignment
  offsetPenalty: 30,        // -30 max points for offset errors
  symmetryBonus: 15,        // +15 bonus for symmetric layout
  cornerAlignment: 5,       // +5 bonus for corner alignment
};

/**
 * Standard Eclipse upper cabinet widths in inches
 */
const STANDARD_UPPER_WIDTHS = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

/**
 * Alignment constants export
 */
export const ALIGNMENT_CONSTANTS = {
  TOLERANCE_INCHES,
  SCORING_WEIGHTS,
  STANDARD_UPPER_WIDTHS,
};

/**
 * Detects common-line alignment between base and upper cabinets
 *
 * @param {Array} baseCabinets - Base cabinet array with {id, x, width, type, ...}
 * @param {Array} upperCabinets - Upper cabinet array with {id, x, width, type, ...}
 * @returns {Object} Alignment analysis object
 *   - {number[]} baseSeams - X positions of all base cabinet seams (left & right edges)
 *   - {number[]} upperSeams - X positions of all upper cabinet seams
 *   - {Object[]} aligned - Seams that align within tolerance
 *       [{basePos, upperPos, offset}]
 *   - {Object[]} misaligned - Base seams without matching upper seams
 *       [{basePos, nearestUpper, offset}]
 *   - {number} alignmentPercentage - Percent of base seams with aligned uppers
 */
export function detectCommonLines(baseCabinets, upperCabinets) {
  // Extract all seam positions from base cabinets
  const baseSeams = extractSeams(baseCabinets).sort((a, b) => a - b);

  // Extract all seam positions from upper cabinets
  const upperSeams = extractSeams(upperCabinets).sort((a, b) => a - b);

  const aligned = [];
  const misaligned = [];

  // For each base seam, find matching upper seam within tolerance
  for (const basePos of baseSeams) {
    const matchingUpper = findNearestSeam(basePos, upperSeams);
    const offset = Math.abs(basePos - matchingUpper);

    if (offset <= TOLERANCE_INCHES) {
      aligned.push({
        basePos,
        upperPos: matchingUpper,
        offset,
      });
    } else {
      misaligned.push({
        basePos,
        nearestUpper: matchingUpper,
        offset,
      });
    }
  }

  const alignmentPercentage = baseSeams.length > 0
    ? Math.round((aligned.length / baseSeams.length) * 100)
    : 0;

  return {
    baseSeams,
    upperSeams,
    aligned,
    misaligned,
    alignmentPercentage,
    summary: {
      totalBaseSeams: baseSeams.length,
      alignedSeams: aligned.length,
      misalignedSeams: misaligned.length,
      alignmentPercentage,
    },
  };
}

/**
 * Optimizes upper cabinet layout to maximize alignment with base cabinet seams
 *
 * @param {Array} baseCabinets - Base cabinet array
 * @param {number} wallLength - Total wall length in inches
 * @param {number} leftConsumed - Width consumed on left (e.g., appliance)
 * @param {number} rightConsumed - Width consumed on right
 * @param {Object} prefs - Alignment preferences
 *   - {boolean} preferSymmetry - Force symmetric layout
 *   - {boolean} centerIfMisaligned - Center uppers if can't align
 *   - {number} focalPoint - X position of focal point (hood, window)
 *   - {string} focalZone - Type of focal zone: 'hood', 'window', 'fridge'
 * @returns {Object} Optimized layout
 *   - {Array} suggestedUppers - Array of {x, width, reason}
 *   - {number} alignmentScore - Alignment score (0-100)
 *   - {Object[]} decisions - Explanation of layout decisions
 */
export function alignUppersToBase(
  baseCabinets,
  wallLength,
  leftConsumed = 0,
  rightConsumed = 0,
  prefs = {}
) {
  const {
    preferSymmetry = false,
    centerIfMisaligned = true,
    focalPoint = null,
    focalZone = null,
  } = prefs;

  const decisions = [];
  const baseSeams = extractSeams(baseCabinets).sort((a, b) => a - b);
  const suggestedUppers = [];

  // Available span for uppers
  const availableStart = leftConsumed;
  const availableEnd = wallLength - rightConsumed;
  const availableWidth = availableEnd - availableStart;

  // Special zone handling
  if (focalZone === 'hood' && focalPoint !== null) {
    // Above hood: no upper cabinet, but check corner seams
    decisions.push({
      type: 'focal-zone',
      zone: 'hood',
      action: 'skip-upper',
      position: focalPoint,
    });
  }

  if (focalZone === 'fridge' && focalPoint !== null) {
    // Above fridge: may have specialty uppers (freezer drawer box)
    decisions.push({
      type: 'focal-zone',
      zone: 'fridge',
      action: 'consider-specialty',
      position: focalPoint,
    });
  }

  // Group base cabinets into logical spans for upper alignment
  const spans = identifyAlignmentSpans(baseCabinets, focalPoint, focalZone);

  for (const span of spans) {
    if (span.isExcluded) {
      decisions.push({
        type: 'span-excluded',
        span,
        reason: span.excludeReason,
      });
      continue;
    }

    const spanStart = span.startX;
    const spanEnd = span.endX;
    const spanWidth = spanEnd - spanStart;

    // Get base seams within this span
    const spanSeams = baseSeams.filter(s => s >= spanStart && s <= spanEnd);

    if (spanSeams.length === 0) {
      decisions.push({
        type: 'no-seams',
        span,
        action: 'use-center-placement',
      });
      continue;
    }

    // Try to match upper widths to base seam gaps
    const matchedUppers = matchUppersToSeams(
      spanSeams,
      spanStart,
      spanEnd,
      preferSymmetry
    );

    for (const upper of matchedUppers) {
      suggestedUppers.push({
        x: upper.x,
        width: upper.width,
        reason: upper.reason,
      });
      decisions.push({
        type: 'upper-placed',
        x: upper.x,
        width: upper.width,
        alignment: upper.alignment,
      });
    }
  }

  // If no uppers placed or severe misalignment, apply centering fallback
  if (suggestedUppers.length === 0 && centerIfMisaligned) {
    const totalBaseWidth = Math.max(...baseSeams) - Math.min(...baseSeams);
    const centerPos = centerUpperRun(
      totalBaseWidth,
      Math.min(...baseSeams),
      Math.max(...baseSeams)
    );

    suggestedUppers.push({
      x: centerPos,
      width: totalBaseWidth,
      reason: 'centered-fallback',
    });

    decisions.push({
      type: 'fallback',
      action: 'center-uppers',
      position: centerPos,
      width: totalBaseWidth,
    });
  }

  // Calculate alignment score with suggested layout
  const alignmentScore = calculateSpanScore(
    baseCabinets,
    suggestedUppers,
    SCORING_WEIGHTS
  );

  return {
    suggestedUppers,
    alignmentScore,
    decisions,
    stats: {
      upperCount: suggestedUppers.length,
      totalUpperWidth: suggestedUppers.reduce((sum, u) => sum + u.width, 0),
      availableWidth,
      utilizationPercent:
        availableWidth > 0
          ? Math.round((suggestedUppers.reduce((sum, u) => sum + u.width, 0) / availableWidth) * 100)
          : 0,
    },
  };
}

/**
 * Scores alignment quality between base and upper cabinets
 *
 * @param {Array} baseCabinets - Base cabinet array
 * @param {Array} upperCabinets - Upper cabinet array
 * @returns {Object} Alignment score and metrics
 *   - {number} score - Overall score 0-100
 *   - {number} alignedSeams - Count of aligned seams
 *   - {number} totalSeams - Total base seams
 *   - {number} worstOffset - Largest misalignment in inches
 *   - {string[]} suggestions - Recommendations to improve alignment
 */
export function scoreAlignment(baseCabinets, upperCabinets) {
  const analysis = detectCommonLines(baseCabinets, upperCabinets);

  const {
    aligned,
    misaligned,
    alignmentPercentage,
  } = analysis;

  // Calculate worst offset
  const worstOffset = misaligned.length > 0
    ? Math.max(...misaligned.map(m => m.offset))
    : 0;

  // Base alignment points
  let score = (alignmentPercentage / 100) * SCORING_WEIGHTS.alignmentPercentage;

  // Offset penalty: decrease score based on maximum offset
  if (worstOffset > 0) {
    const offsetRatio = Math.min(worstOffset / 5, 1); // 5" = 100% penalty
    score -= offsetRatio * SCORING_WEIGHTS.offsetPenalty;
  }

  // Symmetry bonus: check if layout is balanced
  if (isLayoutSymmetric(baseCabinets, upperCabinets)) {
    score += SCORING_WEIGHTS.symmetryBonus;
  }

  // Corner alignment bonus
  if (hasCornerAlignment(baseCabinets, upperCabinets)) {
    score += SCORING_WEIGHTS.cornerAlignment;
  }

  score = Math.max(0, Math.min(100, score)); // Clamp to 0-100

  // Generate suggestions
  const suggestions = generateAlignmentSuggestions(
    analysis,
    worstOffset,
    alignmentPercentage
  );

  return {
    score: Math.round(score),
    alignedSeams: aligned.length,
    totalSeams: analysis.baseSeams.length,
    alignmentPercentage,
    worstOffset: Math.round(worstOffset * 100) / 100,
    suggestions,
    details: {
      aligned,
      misaligned,
    },
  };
}

/**
 * Centers the upper run within the base run with equal overhangs
 *
 * @param {number} upperWidth - Total width of all upper cabinets
 * @param {number} baseStart - Starting X position of base run
 * @param {number} baseEnd - Ending X position of base run
 * @returns {number} Starting X position for the centered upper run
 */
export function centerUpperRun(upperWidth, baseStart, baseEnd) {
  const baseWidth = baseEnd - baseStart;
  const overhang = (baseWidth - upperWidth) / 2;
  return baseStart + overhang;
}

/**
 * Exports alignment data in a format suitable for SVG rendering
 *
 * @param {Array} baseCabinets - Base cabinet array
 * @param {Array} upperCabinets - Upper cabinet array
 * @returns {Object} Grid visualization data
 *   - {Array} verticalLines - [{x, fromZ, toZ, aligned: bool}]
 *   - {Array} horizontalBands - [{z, label}]
 */
export function exportAlignmentGrid(baseCabinets, upperCabinets) {
  const analysis = detectCommonLines(baseCabinets, upperCabinets);

  const verticalLines = [];
  const horizontalBands = [];

  // Create vertical lines for each seam
  const allSeams = new Set([
    ...analysis.baseSeams,
    ...analysis.upperSeams,
  ]);

  for (const seam of allSeams) {
    const isAligned = analysis.aligned.some(a =>
      Math.abs(a.basePos - seam) < 0.01 || Math.abs(a.upperPos - seam) < 0.01
    );

    verticalLines.push({
      x: seam,
      fromZ: 0,        // Toe kick level
      toZ: 84,         // Typical upper cabinet top
      aligned: isAligned,
      type: analysis.baseSeams.includes(seam) ? 'base' : 'upper',
    });
  }

  // Horizontal bands for reference
  horizontalBands.push(
    { z: 0, label: 'Toe Kick Bottom' },
    { z: 4.5, label: 'Toe Kick Top' },
    { z: 34.5, label: 'Base Cabinet Top' },
    { z: 54, label: 'Upper Cabinet Bottom' },
    { z: 84, label: 'Upper Cabinet Top' },
    { z: 96, label: 'Ceiling' }
  );

  return {
    verticalLines: verticalLines.sort((a, b) => a.x - b.x),
    horizontalBands,
    summary: {
      totalVerticalLines: verticalLines.length,
      alignedCount: verticalLines.filter(v => v.aligned).length,
    },
  };
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts all seam positions from a cabinet array
 * A seam is where two cabinets meet (position_end = next position_start)
 */
function extractSeams(cabinets) {
  const seams = new Set();

  // Add all left and right edges
  for (const cab of cabinets) {
    seams.add(cab.x);                    // Left edge
    seams.add(cab.x + cab.width);        // Right edge
  }

  return Array.from(seams);
}

/**
 * Finds the nearest seam to a given position
 */
function findNearestSeam(position, seams) {
  if (seams.length === 0) return position;

  return seams.reduce((nearest, seam) =>
    Math.abs(seam - position) < Math.abs(nearest - position) ? seam : nearest
  );
}

/**
 * Identifies logical alignment spans (regions to handle upper placement)
 * Respects focal zones (hood, window, fridge)
 */
function identifyAlignmentSpans(baseCabinets, focalPoint, focalZone) {
  if (baseCabinets.length === 0) return [];

  const spans = [];
  let currentSpan = null;

  for (const cab of baseCabinets) {
    const cabStart = cab.x;
    const cabEnd = cab.x + cab.width;

    // Check if cabinet is in a focal zone
    let isExcluded = false;
    let excludeReason = null;

    if (focalZone === 'hood' && focalPoint !== null) {
      if (cabStart <= focalPoint && cabEnd >= focalPoint) {
        isExcluded = true;
        excludeReason = 'above-hood';
      }
    }

    if (focalZone === 'fridge' && focalPoint !== null) {
      if (cabStart <= focalPoint && cabEnd >= focalPoint) {
        isExcluded = true;
        excludeReason = 'above-fridge-specialty';
      }
    }

    if (isExcluded) {
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
      spans.push({
        startX: cabStart,
        endX: cabEnd,
        isExcluded: true,
        excludeReason,
      });
    } else {
      if (!currentSpan) {
        currentSpan = {
          startX: cabStart,
          endX: cabEnd,
          isExcluded: false,
          cabinets: [cab],
        };
      } else {
        currentSpan.endX = cabEnd;
        currentSpan.cabinets.push(cab);
      }
    }
  }

  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

/**
 * Matches upper cabinet widths to seams within a span
 * Uses greedy matching: try exact matches first, then combinations
 */
function matchUppersToSeams(seams, spanStart, spanEnd, preferSymmetry) {
  const uppers = [];

  // Get gaps between seams
  const gaps = [];
  for (let i = 0; i < seams.length - 1; i++) {
    const gapStart = seams[i];
    const gapEnd = seams[i + 1];
    const gapWidth = gapEnd - gapStart;
    gaps.push({ start: gapStart, end: gapEnd, width: gapWidth });
  }

  if (gaps.length === 0) return uppers;

  // Try to match each gap to a standard width
  for (const gap of gaps) {
    const match = findClosestWidth(gap.width);

    if (match) {
      // Center the upper in the gap
      const overhang = (gap.width - match) / 2;
      uppers.push({
        x: gap.start + overhang,
        width: match,
        alignment: Math.abs(gap.width - match) < TOLERANCE_INCHES
          ? 'exact'
          : 'fitted',
        reason: `matched-gap-${match}in`,
      });
    }
  }

  // Apply symmetry if requested
  if (preferSymmetry && uppers.length > 1) {
    // Adjust outer uppers to be symmetric
    const firstWidth = uppers[0].width;
    const lastWidth = uppers[uppers.length - 1].width;

    if (firstWidth !== lastWidth) {
      const symmetricWidth = Math.min(firstWidth, lastWidth);
      uppers[0].width = symmetricWidth;
      uppers[uppers.length - 1].width = symmetricWidth;
      uppers[0].reason = 'symmetric-adjusted';
      uppers[uppers.length - 1].reason = 'symmetric-adjusted';
    }
  }

  return uppers;
}

/**
 * Finds the closest standard upper width to a target width
 */
function findClosestWidth(targetWidth) {
  let closest = null;
  let minDiff = Infinity;

  for (const width of STANDARD_UPPER_WIDTHS) {
    const diff = Math.abs(width - targetWidth);
    if (diff < minDiff && diff <= 3) { // Allow 3" tolerance
      minDiff = diff;
      closest = width;
    }
  }

  return closest;
}

/**
 * Calculates alignment score for a layout with suggested uppers
 */
function calculateSpanScore(baseCabinets, suggestedUppers, weights) {
  if (baseCabinets.length === 0) return 50; // Default neutral

  const baseSeams = extractSeams(baseCabinets);
  const upperSeams = extractSeams(
    suggestedUppers.map(u => ({ x: u.x, width: u.width }))
  );

  let alignedCount = 0;
  let totalOffset = 0;

  for (const baseSeam of baseSeams) {
    const nearest = findNearestSeam(baseSeam, upperSeams);
    const offset = Math.abs(baseSeam - nearest);

    if (offset <= TOLERANCE_INCHES) {
      alignedCount++;
    }
    totalOffset += offset;
  }

  const alignmentPercent =
    baseSeams.length > 0 ? (alignedCount / baseSeams.length) * 100 : 0;

  let score = (alignmentPercent / 100) * weights.alignmentPercentage;

  if (baseSeams.length > 0) {
    const avgOffset = totalOffset / baseSeams.length;
    const offsetRatio = Math.min(avgOffset / 5, 1);
    score -= offsetRatio * weights.offsetPenalty;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Checks if layout is symmetric left-to-right
 */
function isLayoutSymmetric(baseCabinets, upperCabinets) {
  if (baseCabinets.length < 2 || upperCabinets.length < 2) return false;

  const baseStart = Math.min(...baseCabinets.map(c => c.x));
  const baseEnd = Math.max(...baseCabinets.map(c => c.x + c.width));
  const baseCenter = (baseStart + baseEnd) / 2;

  const upperStart = Math.min(...upperCabinets.map(c => c.x));
  const upperEnd = Math.max(...upperCabinets.map(c => c.x + c.width));
  const upperCenter = (upperStart + upperEnd) / 2;

  return Math.abs(baseCenter - upperCenter) < 1; // Within 1" of center
}

/**
 * Checks if corner seams align (for L/U-shaped kitchens)
 */
function hasCornerAlignment(baseCabinets, upperCabinets) {
  const baseSeams = extractSeams(baseCabinets);
  const upperSeams = extractSeams(upperCabinets);

  // Check first and last seams
  if (baseSeams.length > 0 && upperSeams.length > 0) {
    const baseCorners = [baseSeams[0], baseSeams[baseSeams.length - 1]];
    const upperCorners = [upperSeams[0], upperSeams[upperSeams.length - 1]];

    const alignedCorners = baseCorners.filter(bc =>
      upperCorners.some(uc => Math.abs(bc - uc) <= TOLERANCE_INCHES)
    );

    return alignedCorners.length >= 1; // At least one corner aligns
  }

  return false;
}

/**
 * Generates actionable suggestions to improve alignment
 */
function generateAlignmentSuggestions(analysis, worstOffset, alignmentPercent) {
  const suggestions = [];

  if (alignmentPercent === 100) {
    suggestions.push('Perfect alignment achieved. No adjustments needed.');
    return suggestions;
  }

  if (alignmentPercent >= 80) {
    suggestions.push(
      `Good alignment (${alignmentPercent}%). Consider fine-tuning worst offsets.`
    );
  } else if (alignmentPercent >= 50) {
    suggestions.push(
      `Moderate alignment (${alignmentPercent}%). Review upper placement strategy.`
    );
  } else {
    suggestions.push(
      `Low alignment (${alignmentPercent}%). Consider centering fallback or layout redesign.`
    );
  }

  if (worstOffset > 2) {
    suggestions.push(
      `Worst misalignment is ${worstOffset.toFixed(2)}". Consider adjusting widths or positions.`
    );
  }

  if (worstOffset > 1 && worstOffset <= 2) {
    suggestions.push(
      `Worst misalignment is ${worstOffset.toFixed(2)}" (within 2"). Minor adjustment recommended.`
    );
  }

  if (analysis.misaligned.length > 0) {
    const topMisaligned = analysis.misaligned
      .sort((a, b) => b.offset - a.offset)
      .slice(0, 2);

    for (const m of topMisaligned) {
      suggestions.push(
        `Seam at ${m.basePos.toFixed(1)}" is ${m.offset.toFixed(2)}" from nearest upper. ` +
        `Try adjusting upper width or position.`
      );
    }
  }

  return suggestions;
}
