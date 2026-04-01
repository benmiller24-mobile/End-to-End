/**
 * finishing-rules.js
 * Automated Finishing Rules Engine for Eclipse Kitchen Cabinet Layout Engine
 * Implements professional-grade finishing logic: end panels, fillers, symmetry, reveals, crown molding
 *
 * @module finishing-rules
 * @requires cabinet-geometry
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const FINISHING_CONSTANTS = {
  // Reveal standards (Eclipse frameless, inches)
  reveal: {
    doorToDoor: 0.125,        // 1/8" between doors
    cabinetToPanel: 0.0625,   // 1/16" between cabinet and end panel
    appliance: {
      range: 0.5,             // 1/2" from cabinet to range
      cooktop: 0.5,
      dishwasher: 0.125,
      refrigerator: 0.5,
      hood: 0.25,
    },
  },

  // End panel specifications
  endPanel: {
    thickness: 0.75,          // 3/4" thick (all types)
    baseHeightOffset: 4.5,    // Toe kick height
    skus: {
      base: {
        left: 'BEP3/4-FTK-L',
        right: 'BEP3/4-FTK-R',
        reversible: 'BEP3/4-FTK-L/R',
      },
      wall: {
        left: 'WEP3/4-L',
        right: 'WEP3/4-R',
      },
      tall: {
        left: 'TEP3/4-L',
        right: 'TEP3/4-R',
      },
      finished_back: 'DFBP',   // For islands: DFBP-{width}
    },
  },

  // Filler solver thresholds (inches)
  filler: {
    ignoreThreshold: 0.5,     // ≤ 0.5" → ignore (tolerance)
    overlayRange: [0.5, 3],   // 0.5"–3" → overlay filler
    resizeRange: [3, 6],      // 3"–6" → widen cabinet
    splitRange: [6, 12],      // 6"–12" → split across 2 cabs
    standardCabRange: 12,     // > 12" → add small cabinet
    skus: {
      overlay: ['OVF1.5', 'OVF2', 'OVF3'],
      standard: ['F3-30', 'F6-30'],
      scribe: 'SCRIBE-3',
    },
  },

  // Symmetry enforcement
  symmetry: {
    toleranceForAutoFix: 3,   // ≤ 3" difference → auto-adjust
    appliances: ['range', 'cooktop', 'hood', 'window'], // Trigger symmetry check
  },

  // Toe kick
  toeKick: {
    standardHeight: 4.5,      // Standard base and tall cabinet toe kick
  },

  // Crown molding
  crown: {
    returnLength: 1.5,        // 1.5" return pieces at ends
    cornerAngle: 45,          // 45° miter at corners
  },

  // Appliance clearances (inches)
  appliance: {
    refrigerator: {
      sideVentilation: 0.5,
      topClearance: 0,
    },
    hood: {
      minHeight: 60,          // AFF (above finish floor)
      maxHeight: 66,
    },
  },
};

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Apply all finishing rules to a complete kitchen layout
 * Orchestrates end panel detection, filler solving, symmetry enforcement, etc.
 *
 * @param {Object} layouts - Layout objects keyed by position
 * @param {Array} layouts.wallLayouts - Horizontal wall layout runs (base/upper)
 * @param {Array} layouts.upperLayouts - Upper cabinet runs
 * @param {Array} layouts.talls - Tall cabinet runs
 * @param {Array} layouts.corners - Corner cabinet config
 * @param {Object} layouts.islandLayout - Island cabinet run
 * @param {Object} layouts.peninsulaLayout - Peninsula cabinet run
 * @param {Object} prefs - User preferences (molding, style, etc.)
 *
 * @returns {Object} Finishing rule results:
 *   - adjustedLayouts: Updated layouts after all modifications
 *   - endPanels: Array of { position, cabId, side, sku, width, height }
 *   - fillers: Array of { position, beforeCabId, afterCabId, sku, width }
 *   - resizes: Array of { cabId, originalWidth, newWidth }
 *   - symmetryFixes: Array of { appliance, position, adjustment }
 *   - validation: Array of { type, severity, message, cabId? }
 */
export function applyFinishingRules(layouts, prefs = {}) {
  const results = {
    adjustedLayouts: structuredClone(layouts),
    endPanels: [],
    fillers: [],
    resizes: [],
    symmetryFixes: [],
    validation: [],
  };

  // 1. VISIBILITY CHECK & AUTO END PANELS
  results.endPanels = visibilityCheck(results.adjustedLayouts, prefs);

  // 2. SMART FILLER SOLVER
  const { fillers, resizes, validation: fillerValidation } = solveAllFillers(
    results.adjustedLayouts
  );
  results.fillers = fillers;
  results.resizes = resizes;
  results.validation.push(...fillerValidation);

  // Apply resize operations to adjusted layouts
  applyResizes(results.adjustedLayouts, resizes);

  // 3. SYMMETRY ENFORCEMENT
  const symmetryResults = enforceSymmetryAllRuns(
    results.adjustedLayouts,
    prefs
  );
  results.symmetryFixes = symmetryResults.adjustments;
  results.validation.push(...symmetryResults.validation);

  // 4. TOE KICK ALIGNMENT
  const toeKickValidation = validateToeKickAlignment(results.adjustedLayouts);
  results.validation.push(...toeKickValidation);

  // 5. REVEAL CONSISTENCY
  const revealValidation = validateRevealConsistency(results.adjustedLayouts);
  results.validation.push(...revealValidation);

  // 6. CROWN MOLDING TERMINATION
  if (prefs.crownMolding) {
    const crownValidation = validateCrownMolding(results.adjustedLayouts, prefs);
    results.validation.push(...crownValidation);
  }

  // 7. FINISHED INTERIOR DETECTION
  detectFinishedInteriors(results.adjustedLayouts);

  return results;
}

// ============================================================================
// 1. VISIBILITY CHECK & AUTO END PANELS
// ============================================================================

/**
 * Scan cabinets and determine which sides need end panels
 * Considers walls, adjacent cabinets, islands, and peninsulas
 *
 * @param {Object} layouts - Cabinet layouts
 * @param {Object} prefs - User preferences
 * @returns {Array} End panel specs: { position, cabId, side, sku, width, height }
 */
export function visibilityCheck(layouts, prefs = {}) {
  const endPanels = [];

  // Process base cabinets (wall layouts)
  if (layouts.wallLayouts && Array.isArray(layouts.wallLayouts)) {
    layouts.wallLayouts.forEach((run, runIdx) => {
      if (!run.cabinets || run.cabinets.length === 0) return;

      run.cabinets.forEach((cab, cabIdx) => {
        const isFirstInRun = cabIdx === 0;
        const isLastInRun = cabIdx === run.cabinets.length - 1;

        // LEFT SIDE
        if (isFirstInRun) {
          // First cabinet: LEFT exposed unless against wall
          const leftPanel = createEndPanel(cab, 'left', 'base');
          if (leftPanel) endPanels.push(leftPanel);
        }

        // RIGHT SIDE
        if (isLastInRun) {
          // Last cabinet: RIGHT exposed unless against wall
          const rightPanel = createEndPanel(cab, 'right', 'base');
          if (rightPanel) endPanels.push(rightPanel);
        }
      });
    });
  }

  // Process upper cabinets
  if (layouts.upperLayouts && Array.isArray(layouts.upperLayouts)) {
    layouts.upperLayouts.forEach((run) => {
      if (!run.cabinets || run.cabinets.length === 0) return;

      run.cabinets.forEach((cab, cabIdx) => {
        const isFirstInRun = cabIdx === 0;
        const isLastInRun = cabIdx === run.cabinets.length - 1;

        if (isFirstInRun) {
          const leftPanel = createEndPanel(cab, 'left', 'wall');
          if (leftPanel) endPanels.push(leftPanel);
        }

        if (isLastInRun) {
          const rightPanel = createEndPanel(cab, 'right', 'wall');
          if (rightPanel) endPanels.push(rightPanel);
        }
      });
    });
  }

  // Process tall cabinets
  if (layouts.talls && Array.isArray(layouts.talls)) {
    layouts.talls.forEach((cab) => {
      // Tall cabinets are typically standalone but check adjacency
      if (cab.position && (cab.position.islandEnd || !cab.adjacentLeft)) {
        const leftPanel = createEndPanel(cab, 'left', 'tall');
        if (leftPanel) endPanels.push(leftPanel);
      }

      if (cab.position && (cab.position.islandEnd || !cab.adjacentRight)) {
        const rightPanel = createEndPanel(cab, 'right', 'tall');
        if (rightPanel) endPanels.push(rightPanel);
      }
    });
  }

  // Process island layout
  if (layouts.islandLayout && layouts.islandLayout.cabinets) {
    layouts.islandLayout.cabinets.forEach((cab) => {
      // Islands: ALL exposed sides get finished panels
      const sides = ['left', 'right', 'front', 'back'];
      sides.forEach((side) => {
        if (isExposed(cab, side, 'island')) {
          const panel = createEndPanel(cab, side, 'base');
          if (panel) endPanels.push({ ...panel, isIsland: true });
        }
      });

      // Island back: add finished back panel (DFBP)
      if (isExposed(cab, 'back', 'island')) {
        const width = cab.width || 24;
        endPanels.push({
          position: 'island',
          cabId: cab.id,
          side: 'back',
          sku: `DFBP-${width}`,
          width,
          height: cab.height || 34.5,
          isFinishedBack: true,
        });
      }
    });
  }

  // Process peninsula layout
  if (layouts.peninsulaLayout && layouts.peninsulaLayout.cabinets) {
    layouts.peninsulaLayout.cabinets.forEach((cab) => {
      // Peninsula: exposed end gets DEP, exposed back gets DFBP
      if (isExposed(cab, 'right', 'peninsula')) {
        const panel = createEndPanel(cab, 'right', 'base');
        if (panel) endPanels.push(panel);
      }

      if (isExposed(cab, 'back', 'peninsula')) {
        const width = cab.width || 24;
        endPanels.push({
          position: 'peninsula',
          cabId: cab.id,
          side: 'back',
          sku: `DFBP-${width}`,
          width,
          height: cab.height || 34.5,
          isFinishedBack: true,
        });
      }
    });
  }

  return endPanels;
}

/**
 * Helper: Create an end panel spec for a cabinet side
 *
 * @param {Object} cab - Cabinet object
 * @param {string} side - 'left', 'right', 'front', or 'back'
 * @param {string} type - 'base', 'wall', or 'tall'
 * @returns {Object|null} End panel spec or null if not applicable
 */
function createEndPanel(cab, side, type) {
  if (!cab || !cab.width) return null;

  const skuMap = {
    base: { left: 'BEP3/4-FTK-L', right: 'BEP3/4-FTK-R' },
    wall: { left: 'WEP3/4-L', right: 'WEP3/4-R' },
    tall: { left: 'TEP3/4-L', right: 'TEP3/4-R' },
  };

  const sku = skuMap[type]?.[side];
  if (!sku) return null;

  const height =
    type === 'base'
      ? (cab.height || 34.5) - FINISHING_CONSTANTS.endPanel.baseHeightOffset
      : cab.height || 34.5;

  return {
    position: cab.position || 'wall',
    cabId: cab.id,
    side,
    sku,
    width: FINISHING_CONSTANTS.endPanel.thickness,
    height,
    type,
  };
}

/**
 * Helper: Determine if a cabinet side is exposed
 *
 * @param {Object} cab - Cabinet object
 * @param {string} side - Side to check
 * @param {string} context - 'island', 'peninsula', or 'wall'
 * @returns {boolean}
 */
function isExposed(cab, side, context) {
  if (context === 'island') {
    // Island cabinets: all sides exposed unless explicitly blocked
    return !cab[`${side}Blocked`];
  }

  if (context === 'peninsula') {
    // Peninsula: exposed end and back, attached on one side
    return side === 'right' || side === 'back';
  }

  // Wall context: handled by isFirstInRun / isLastInRun checks
  return false;
}

// ============================================================================
// 2. SMART FILLER SOLVER
// ============================================================================

/**
 * Solve fillers for all cabinet runs in all positions
 *
 * @param {Object} layouts - Cabinet layouts
 * @returns {Object} { fillers, resizes, validation }
 */
function solveAllFillers(layouts) {
  const fillers = [];
  const resizes = [];
  const validation = [];

  const processRun = (run, position) => {
    if (!run || !run.cabinets || run.cabinets.length < 2) return;

    // Calculate gaps between consecutive cabinets
    for (let i = 0; i < run.cabinets.length - 1; i++) {
      const currentCab = run.cabinets[i];
      const nextCab = run.cabinets[i + 1];

      if (!currentCab.rightEdge || !nextCab.leftEdge) continue;

      const gap = nextCab.leftEdge - currentCab.rightEdge;

      if (gap <= FINISHING_CONSTANTS.filler.ignoreThreshold) {
        // RULE 1: Ignore small gaps (tolerance)
        continue;
      }

      if (
        gap >= FINISHING_CONSTANTS.filler.overlayRange[0] &&
        gap <= FINISHING_CONSTANTS.filler.overlayRange[1]
      ) {
        // RULE 2: Overlay filler
        const fillerSku = selectOverlayFiller(gap);
        fillers.push({
          position,
          beforeCabId: currentCab.id,
          afterCabId: nextCab.id,
          sku: fillerSku,
          width: gap,
          type: 'overlay',
        });
      } else if (
        gap >= FINISHING_CONSTANTS.filler.resizeRange[0] &&
        gap <= FINISHING_CONSTANTS.filler.resizeRange[1]
      ) {
        // RULE 3: Widen nearest flexible cabinet
        const resizeResult = resizeNearestFlexible(
          run.cabinets,
          i,
          gap,
          position
        );
        if (resizeResult) {
          resizes.push(resizeResult);
          fillers.push({
            position,
            beforeCabId: currentCab.id,
            afterCabId: nextCab.id,
            method: 'width-adjustment',
            affectedCab: resizeResult.cabId,
            originalGap: gap,
            resolvedBy: 'cabinet-resize',
          });
        }
      } else if (
        gap >= FINISHING_CONSTANTS.filler.splitRange[0] &&
        gap <= FINISHING_CONSTANTS.filler.splitRange[1]
      ) {
        // RULE 4: Split absorption across 2 nearest flex cabs
        const splitResult = splitFlexibleAbsorption(
          run.cabinets,
          i,
          gap,
          position
        );
        if (splitResult && splitResult.resizes.length > 0) {
          resizes.push(...splitResult.resizes);
          fillers.push({
            position,
            beforeCabId: currentCab.id,
            afterCabId: nextCab.id,
            method: 'split-absorption',
            affectedCabs: splitResult.resizes.map((r) => r.cabId),
            originalGap: gap,
            distributions: splitResult.resizes.map((r) => ({
              cabId: r.cabId,
              widthIncrease: r.newWidth - r.originalWidth,
            })),
          });
        }
      } else if (gap > FINISHING_CONSTANTS.filler.standardCabRange) {
        // RULE 5: Add small cabinet
        const smallCabSku = selectSmallCabinet(gap);
        fillers.push({
          position,
          beforeCabId: currentCab.id,
          afterCabId: nextCab.id,
          sku: smallCabSku,
          width: extractCabinetWidth(smallCabSku),
          type: 'standard-cabinet',
          note: `Gap ${gap.toFixed(2)}" requires cabinet; remainder may need additional filler`,
        });

        validation.push({
          type: 'warning',
          severity: 'medium',
          message: `Large gap (${gap.toFixed(2)}") between cabinets at ${position}; added ${smallCabSku}`,
          position,
          gap,
        });
      }
    }
  };

  // Process all runs
  if (layouts.wallLayouts) layouts.wallLayouts.forEach((r) => processRun(r, 'wall'));
  if (layouts.upperLayouts) layouts.upperLayouts.forEach((r) => processRun(r, 'upper'));

  return { fillers, resizes, validation };
}

/**
 * Select appropriate overlay filler SKU based on gap width
 *
 * @param {number} gap - Gap width in inches
 * @returns {string} Filler SKU
 */
function selectOverlayFiller(gap) {
  if (gap <= 1.5) return 'OVF1.5';
  if (gap <= 2) return 'OVF2';
  return 'OVF3';
}

/**
 * Select appropriate small cabinet based on gap width
 *
 * @param {number} gap - Gap width in inches
 * @returns {string} Cabinet SKU
 */
function selectSmallCabinet(gap) {
  if (gap <= 9) return 'B9';
  if (gap <= 12) return 'B12';
  return 'B15';
}

/**
 * Extract nominal width from cabinet SKU
 *
 * @param {string} sku - Cabinet SKU
 * @returns {number} Width in inches
 */
function extractCabinetWidth(sku) {
  const match = sku.match(/B(\d+)/);
  return match ? parseInt(match[1], 10) : 12;
}

/**
 * Resize nearest flexible cabinet to absorb gap
 *
 * @param {Array} cabinets - Cabinets in run
 * @param {number} gapIndex - Index before gap
 * @param {number} gapWidth - Gap width in inches
 * @param {string} position - Position label
 * @returns {Object|null} Resize operation or null
 */
function resizeNearestFlexible(cabinets, gapIndex, gapWidth, position) {
  // Find nearest flexible cabinet (not anchor)
  let targetIdx = null;
  let minDistance = Infinity;

  cabinets.forEach((cab, idx) => {
    if (cab.isAnchor || cab.isAppliance) return; // Skip anchors and appliances

    const distance = Math.min(
      Math.abs(idx - gapIndex),
      Math.abs(idx - (gapIndex + 1))
    );

    if (distance < minDistance) {
      minDistance = distance;
      targetIdx = idx;
    }
  });

  if (targetIdx === null) return null;

  const targetCab = cabinets[targetIdx];
  const originalWidth = targetCab.width || 24;
  const newWidth = originalWidth + gapWidth;

  return {
    cabId: targetCab.id,
    originalWidth,
    newWidth,
    widthIncrease: gapWidth,
    position,
    method: 'absorb-gap',
  };
}

/**
 * Split gap absorption across 2 nearest flexible cabinets
 *
 * @param {Array} cabinets - Cabinets in run
 * @param {number} gapIndex - Index before gap
 * @param {number} gapWidth - Gap width in inches
 * @param {string} position - Position label
 * @returns {Object|null} { resizes: [...] } or null
 */
function splitFlexibleAbsorption(cabinets, gapIndex, gapWidth, position) {
  // Find 2 nearest flexible cabinets (left and right of gap)
  let leftIdx = gapIndex;
  let rightIdx = gapIndex + 1;

  // Walk left to find flexible cab
  while (
    leftIdx >= 0 &&
    (cabinets[leftIdx].isAnchor || cabinets[leftIdx].isAppliance)
  ) {
    leftIdx--;
  }

  // Walk right to find flexible cab
  while (
    rightIdx < cabinets.length &&
    (cabinets[rightIdx].isAnchor || cabinets[rightIdx].isAppliance)
  ) {
    rightIdx++;
  }

  if (leftIdx < 0 || rightIdx >= cabinets.length) return null;

  const leftCab = cabinets[leftIdx];
  const rightCab = cabinets[rightIdx];

  const leftIncrease = gapWidth / 2;
  const rightIncrease = gapWidth / 2;

  return {
    resizes: [
      {
        cabId: leftCab.id,
        originalWidth: leftCab.width || 24,
        newWidth: (leftCab.width || 24) + leftIncrease,
        widthIncrease: leftIncrease,
        position,
        method: 'split-absorption-left',
      },
      {
        cabId: rightCab.id,
        originalWidth: rightCab.width || 24,
        newWidth: (rightCab.width || 24) + rightIncrease,
        widthIncrease: rightIncrease,
        position,
        method: 'split-absorption-right',
      },
    ],
  };
}

/**
 * Apply resize operations to layouts, updating cabinet positions
 *
 * @param {Object} layouts - Cabinet layouts to modify in-place
 * @param {Array} resizes - Resize operations
 */
function applyResizes(layouts, resizes) {
  resizes.forEach((resize) => {
    const allCabs = [
      ...(layouts.wallLayouts?.flatMap((r) => r.cabinets) || []),
      ...(layouts.upperLayouts?.flatMap((r) => r.cabinets) || []),
      ...(layouts.talls || []),
      ...(layouts.islandLayout?.cabinets || []),
      ...(layouts.peninsulaLayout?.cabinets || []),
    ];

    const cab = allCabs.find((c) => c.id === resize.cabId);
    if (cab) {
      cab.width = resize.newWidth;
      // Recompute rightEdge based on new width
      if (cab.leftEdge !== undefined) {
        cab.rightEdge = cab.leftEdge + resize.newWidth;
      }
    }
  });
}

/**
 * Export solveFillers for single-run use (e.g., custom logic)
 *
 * @param {Array} cabinets - Cabinets in a run
 * @param {number} wallLength - Total wall or run length
 * @param {Array} anchors - Anchor cabinet IDs (optional)
 * @returns {Object} { fillers, resizes, validation }
 */
export function solveFillers(cabinets = [], wallLength = 0, anchors = []) {
  if (!Array.isArray(cabinets) || cabinets.length < 2) {
    return { fillers: [], resizes: [], validation: [] };
  }

  // Mark anchors
  cabinets.forEach((cab) => {
    cab.isAnchor = anchors.includes(cab.id);
  });

  const results = {
    fillers: [],
    resizes: [],
    validation: [],
  };

  // Calculate gaps
  for (let i = 0; i < cabinets.length - 1; i++) {
    const currentCab = cabinets[i];
    const nextCab = cabinets[i + 1];

    if (!currentCab.rightEdge || !nextCab.leftEdge) continue;

    const gap = nextCab.leftEdge - currentCab.rightEdge;

    if (gap <= FINISHING_CONSTANTS.filler.ignoreThreshold) {
      continue;
    }

    if (
      gap >= FINISHING_CONSTANTS.filler.overlayRange[0] &&
      gap <= FINISHING_CONSTANTS.filler.overlayRange[1]
    ) {
      const fillerSku = selectOverlayFiller(gap);
      results.fillers.push({
        beforeCabId: currentCab.id,
        afterCabId: nextCab.id,
        sku: fillerSku,
        width: gap,
        type: 'overlay',
      });
    } else if (
      gap >= FINISHING_CONSTANTS.filler.resizeRange[0] &&
      gap <= FINISHING_CONSTANTS.filler.resizeRange[1]
    ) {
      const resizeResult = resizeNearestFlexible(cabinets, i, gap, 'custom');
      if (resizeResult) {
        results.resizes.push(resizeResult);
        results.fillers.push({
          beforeCabId: currentCab.id,
          afterCabId: nextCab.id,
          method: 'width-adjustment',
          affectedCab: resizeResult.cabId,
        });
      }
    }
  }

  return results;
}

// ============================================================================
// 3. SYMMETRY ENFORCEMENT
// ============================================================================

/**
 * Enforce symmetry around appliances (range, hood, window) in all runs
 *
 * @param {Object} layouts - Cabinet layouts
 * @param {Object} prefs - User preferences
 * @returns {Object} { adjustments, validation }
 */
function enforceSymmetryAllRuns(layouts, prefs = {}) {
  const adjustments = [];
  const validation = [];

  const processRun = (run, position) => {
    if (!run || !run.cabinets || run.cabinets.length < 3) return;

    // Find all appliances/focal points in this run
    const focalPoints = [];

    run.cabinets.forEach((cab, idx) => {
      if (cab.type === 'appliance' || cab.isAppliance) {
        focalPoints.push({
          index: idx,
          type: cab.applianceType || 'generic',
          cabinet: cab,
        });
      }
    });

    // For each focal point, check symmetry
    focalPoints.forEach((focal) => {
      const leftIdx = focal.index - 1;
      const rightIdx = focal.index + 1;

      if (leftIdx < 0 || rightIdx >= run.cabinets.length) return;

      const leftCab = run.cabinets[leftIdx];
      const rightCab = run.cabinets[rightIdx];

      const diff = Math.abs((leftCab.width || 0) - (rightCab.width || 0));

      if (diff <= FINISHING_CONSTANTS.symmetry.toleranceForAutoFix && diff > 0) {
        // Auto-adjust to equalize
        const targetWidth = ((leftCab.width || 0) + (rightCab.width || 0)) / 2;

        adjustments.push({
          position,
          appliance: focal.type,
          leftCab: leftCab.id,
          rightCab: rightCab.id,
          leftOriginalWidth: leftCab.width || 0,
          rightOriginalWidth: rightCab.width || 0,
          targetWidth,
          method: 'auto-equalize',
        });

        // Apply adjustment
        leftCab.width = targetWidth;
        rightCab.width = targetWidth;
      } else if (diff > FINISHING_CONSTANTS.symmetry.toleranceForAutoFix) {
        // Flag as recommendation
        validation.push({
          type: 'recommendation',
          severity: 'low',
          message: `Asymmetry detected around ${focal.type} at ${position}: left ${(leftCab.width || 0).toFixed(1)}", right ${(rightCab.width || 0).toFixed(1)}"`,
          position,
          appliance: focal.type,
          leftCabId: leftCab.id,
          rightCabId: rightCab.id,
          difference: diff,
        });
      }
    });
  };

  if (layouts.wallLayouts) layouts.wallLayouts.forEach((r) => processRun(r, 'wall'));
  if (layouts.upperLayouts) layouts.upperLayouts.forEach((r) => processRun(r, 'upper'));

  return { adjustments, validation };
}

/**
 * Export enforceSymmetry for standalone use
 *
 * @param {Array} cabinets - Cabinets to check
 * @param {Array} appliances - Appliance fixtures
 * @returns {Object} { adjustments }
 */
export function enforceSymmetry(cabinets = [], appliances = []) {
  const adjustments = [];

  appliances.forEach((app) => {
    const appIdx = cabinets.findIndex((c) => c.id === app.cabId);
    if (appIdx < 0 || appIdx === 0 || appIdx === cabinets.length - 1) return;

    const leftCab = cabinets[appIdx - 1];
    const rightCab = cabinets[appIdx + 1];

    const diff = Math.abs((leftCab.width || 0) - (rightCab.width || 0));

    if (diff > 0 && diff <= FINISHING_CONSTANTS.symmetry.toleranceForAutoFix) {
      const targetWidth = ((leftCab.width || 0) + (rightCab.width || 0)) / 2;

      adjustments.push({
        appliance: app.type,
        leftCab: leftCab.id,
        rightCab: rightCab.id,
        targetWidth,
      });

      leftCab.width = targetWidth;
      rightCab.width = targetWidth;
    }
  });

  return { adjustments };
}

// ============================================================================
// 4. TOE KICK ALIGNMENT
// ============================================================================

/**
 * Validate toe kick consistency across all cabinet runs
 *
 * @param {Object} layouts - Cabinet layouts
 * @returns {Array} Validation issues
 */
function validateToeKickAlignment(layouts) {
  const validation = [];
  const standard = FINISHING_CONSTANTS.toeKick.standardHeight;

  const checkCabinets = (cabinets, position) => {
    if (!cabinets) return;

    cabinets.forEach((cab) => {
      const toeKickHeight = cab.toeKickHeight || standard;

      if (Math.abs(toeKickHeight - standard) > 0.125) {
        validation.push({
          type: 'warning',
          severity: 'medium',
          message: `Cabinet ${cab.id} has non-standard toe kick height: ${toeKickHeight.toFixed(2)}" (standard: ${standard}")`,
          position,
          cabId: cab.id,
          actualHeight: toeKickHeight,
          standardHeight: standard,
        });
      }
    });
  };

  // Check all cabinet positions
  if (layouts.wallLayouts) {
    layouts.wallLayouts.forEach((run) => checkCabinets(run.cabinets, 'wall'));
  }

  if (layouts.talls) {
    layouts.talls.forEach((cab) => {
      const toeKickHeight = cab.toeKickHeight || standard;
      if (Math.abs(toeKickHeight - standard) > 0.125) {
        validation.push({
          type: 'warning',
          severity: 'medium',
          message: `Tall cabinet ${cab.id} has non-standard toe kick: ${toeKickHeight.toFixed(2)}"`,
          position: 'tall',
          cabId: cab.id,
        });
      }
    });
  }

  return validation;
}

// ============================================================================
// 5. REVEAL CONSISTENCY
// ============================================================================

/**
 * Validate reveal consistency across cabinet run
 *
 * @param {Object} layouts - Cabinet layouts
 * @returns {Array} Validation issues
 */
export function validateReveals(cabinets = []) {
  const validation = [];
  const standard = FINISHING_CONSTANTS.reveal.doorToDoor;

  if (cabinets.length < 2) return validation;

  // Check door-to-door reveals
  for (let i = 0; i < cabinets.length - 1; i++) {
    const cab1 = cabinets[i];
    const cab2 = cabinets[i + 1];

    if (cab1.rightEdge && cab2.leftEdge) {
      const actualReveal = cab2.leftEdge - cab1.rightEdge;

      // Account for end panels and fillers
      if (
        Math.abs(actualReveal - standard) > 0.0625 &&
        actualReveal !== 0
      ) {
        validation.push({
          type: 'warning',
          severity: 'low',
          message: `Reveal between ${cab1.id} and ${cab2.id}: ${actualReveal.toFixed(4)}" (standard: ${standard}")`,
          cabId1: cab1.id,
          cabId2: cab2.id,
          actualReveal,
          standardReveal: standard,
        });
      }
    }
  }

  return validation;
}

/**
 * Validate all reveals in all layouts
 *
 * @param {Object} layouts - Cabinet layouts
 * @returns {Array} Validation issues
 */
function validateRevealConsistency(layouts) {
  const validation = [];

  if (layouts.wallLayouts) {
    layouts.wallLayouts.forEach((run) => {
      validation.push(...validateReveals(run.cabinets));
    });
  }

  if (layouts.upperLayouts) {
    layouts.upperLayouts.forEach((run) => {
      validation.push(...validateReveals(run.cabinets));
    });
  }

  return validation;
}

// ============================================================================
// 6. CROWN MOLDING TERMINATION
// ============================================================================

/**
 * Validate crown molding termination at exposed ends
 *
 * @param {Object} layouts - Cabinet layouts
 * @param {Object} prefs - User preferences (crownMolding, crownStyle, etc.)
 * @returns {Array} Validation issues and requirements
 */
function validateCrownMolding(layouts, prefs = {}) {
  const validation = [];

  if (!prefs.crownMolding) return validation;

  const checkRun = (run, position) => {
    if (!run || !run.cabinets || run.cabinets.length === 0) return;

    const firstCab = run.cabinets[0];
    const lastCab = run.cabinets[run.cabinets.length - 1];

    // First cabinet: needs crown return on left end
    if (firstCab) {
      validation.push({
        type: 'requirement',
        severity: 'info',
        message: `Crown molding return needed at left end of ${position} run (cabinet ${firstCab.id})`,
        position,
        cabId: firstCab.id,
        side: 'left',
        requirement: 'crown-return',
        returnLength: FINISHING_CONSTANTS.crown.returnLength,
      });
    }

    // Last cabinet: needs crown return on right end
    if (lastCab && lastCab !== firstCab) {
      validation.push({
        type: 'requirement',
        severity: 'info',
        message: `Crown molding return needed at right end of ${position} run (cabinet ${lastCab.id})`,
        position,
        cabId: lastCab.id,
        side: 'right',
        requirement: 'crown-return',
        returnLength: FINISHING_CONSTANTS.crown.returnLength,
      });
    }
  };

  if (layouts.wallLayouts) {
    layouts.wallLayouts.forEach((r) => checkRun(r, 'wall-base'));
  }

  if (layouts.upperLayouts) {
    layouts.upperLayouts.forEach((r) => checkRun(r, 'wall-upper'));
  }

  // Check for tall cabinets and potential conflicts with uppers
  if (layouts.talls && layouts.upperLayouts) {
    layouts.talls.forEach((tall) => {
      // If a tall is present, check if uppers are at same height
      const uppers = layouts.upperLayouts.flatMap((r) => r.cabinets || []);
      const upperHeights = new Set(uppers.map((c) => c.height));

      if (tall.height && !upperHeights.has(tall.height)) {
        validation.push({
          type: 'warning',
          severity: 'medium',
          message: `Tall cabinet ${tall.id} height (${tall.height}") differs from uppers; crown molding alignment may be complex`,
          cabId: tall.id,
          tallHeight: tall.height,
          upperHeights: Array.from(upperHeights),
        });
      }
    });
  }

  return validation;
}

// ============================================================================
// 7. FINISHED INTERIOR DETECTION
// ============================================================================

/**
 * Auto-add Finished Interior (FI) mod to cabinets with glass doors or open shelves
 *
 * @param {Object} layouts - Cabinet layouts (modified in-place)
 */
function detectFinishedInteriors(layouts) {
  const checkCabinets = (cabinets) => {
    if (!Array.isArray(cabinets)) return;

    cabinets.forEach((cab) => {
      const hasGlassDoors =
        cab.mods && Array.isArray(cab.mods) && cab.mods.includes('GFD');
      const isOpenShelf =
        cab.type === 'shelf' || cab.type === 'open-shelf';

      if (hasGlassDoors || isOpenShelf) {
        if (!cab.mods) cab.mods = [];
        if (!cab.mods.includes('FI')) {
          cab.mods.push('FI');
          cab.finishedInterior = true;
        }
      }
    });
  };

  if (layouts.wallLayouts) {
    layouts.wallLayouts.forEach((run) => checkCabinets(run.cabinets));
  }

  if (layouts.upperLayouts) {
    layouts.upperLayouts.forEach((run) => checkCabinets(run.cabinets));
  }

  if (layouts.talls) {
    checkCabinets(layouts.talls);
  }

  if (layouts.islandLayout && layouts.islandLayout.cabinets) {
    checkCabinets(layouts.islandLayout.cabinets);
  }

  if (layouts.peninsulaLayout && layouts.peninsulaLayout.cabinets) {
    checkCabinets(layouts.peninsulaLayout.cabinets);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  applyFinishingRules,
  visibilityCheck,
  solveFillers,
  enforceSymmetry,
  validateReveals,
  FINISHING_CONSTANTS,
};
