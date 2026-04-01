/**
 * LINEAR STACKING ENGINE
 * ─────────────────────────────────────────────────────────────────
 * Deterministic cabinet placement using an X-axis anchor system.
 *
 * Rules:
 *   1. Every wall starts at X = 0.
 *   2. Corner consumption offsets the starting cursor.
 *   3. Appliances are placed first (anchors), creating segments.
 *   4. Each segment is filled left→right; next_cab.x = prev_cab.x + prev_cab.width
 *   5. total_placed_width MUST === available_wall_length (fillers close gaps).
 *   6. No cabinet may exceed wall boundary.
 *
 * This module exports pure functions — no side effects, no mutation.
 */

// ─── STANDARD CABINET WIDTHS (Eclipse C3 frameless) ────────────
const STD_WIDTHS = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48];

// ─── VALID FILLER WIDTHS ───────────────────────────────────────
const MAX_FILLER = 6;       // >6" → resize cabinet instead
const MIN_FILLER = 0.75;    // overlay filler minimum

// ─── SKU BUILDERS ──────────────────────────────────────────────
const BASE_SKU_MAP = {
  rangeFlanking:  (w) => w <= 12 ? `BKI${w}` : `B${w}-RT`,
  sinkAdjacent:   (w) => w <= 15 ? `BTD${w}` : `B3D${w}`,
  fridgeAdjacent: (w) => `B3D${w}`,
  general:        (w) => w <= 18 ? `B3D${w}` : `B3D${w}`,
  pantry:         (w) => `B3D${w}`,
};

const UPPER_SKU_MAP = {
  default: (w, h) => `W${w}${h || 39}`,
};

const FILLER_SKUS = {
  overlay:    (w) => `OVF${w < 3 ? 1.5 : 3}`,
  strip:      (w) => `F${Math.ceil(w)}30`,
  endPanel:   () => 'BEP3/4-FTK-L/R',
  wallEndPanel: (h) => `FWEP3/4-L/R-${h || 27}"`,
};


/**
 * ═══════════════════════════════════════════════════════════════
 *  CORE: linearStack
 * ═══════════════════════════════════════════════════════════════
 *
 * Fills a segment of wall with cabinets using strict left→right
 * stacking. Returns an array of placement objects.
 *
 * @param {number} segmentLength  - Available inches to fill
 * @param {string} role           - Zone role (rangeFlanking, general, etc.)
 * @param {number} startX         - Absolute X offset from wall origin
 * @param {string} wallId         - Wall identifier
 * @param {Object} [opts]         - Options: { preferredWidths, maxCabinets }
 * @returns {{ cabinets: CabinetPlacement[], fillers: FillerPlacement[], warnings: string[] }}
 */
export function linearStack(segmentLength, role, startX, wallId, opts = {}) {
  const cabinets = [];
  const fillers = [];
  const warnings = [];

  if (segmentLength <= 0) return { cabinets, fillers, warnings };

  // Step 1: Decompose segment into standard widths
  const widthPlan = decomposeToStandardWidths(segmentLength, opts.preferredWidths);

  if (!widthPlan) {
    warnings.push(`Cannot decompose ${segmentLength}" into standard widths on wall ${wallId}`);
    return { cabinets, fillers, warnings };
  }

  // Step 2: Stack cabinets left→right with strict chaining
  let cursor = startX;
  const skuFn = BASE_SKU_MAP[role] || BASE_SKU_MAP.general;

  for (let i = 0; i < widthPlan.cabinetWidths.length; i++) {
    const w = widthPlan.cabinetWidths[i];
    const cab = {
      sku: skuFn(w),
      width: w,
      position_start: cursor,
      position_end: cursor + w,
      type: 'base',
      wall_id: wallId,
      role: role,
      depth: 24,
      height: 34.5,
    };

    // INVARIANT: no overlap with previous
    if (cabinets.length > 0) {
      const prev = cabinets[cabinets.length - 1];
      if (cab.position_start !== prev.position_end) {
        warnings.push(
          `Chain break at ${cab.position_start}" (expected ${prev.position_end}") on wall ${wallId}`
        );
        cab.position_start = prev.position_end;
        cab.position_end = cab.position_start + w;
      }
    }

    cabinets.push(cab);
    cursor = cab.position_end;
  }

  // Step 3: Handle remainder with filler
  if (widthPlan.remainder > 0) {
    const filler = buildFiller(widthPlan.remainder, cursor, wallId);
    fillers.push(filler);
    cursor = filler.position_end;

    if (widthPlan.remainder > MAX_FILLER) {
      warnings.push(
        `Filler ${widthPlan.remainder}" exceeds ${MAX_FILLER}" max on wall ${wallId}. Consider resizing last cabinet.`
      );
    }
  }

  // Step 4: Boundary check
  const endX = startX + segmentLength;
  if (Math.abs(cursor - endX) > 0.01) {
    warnings.push(
      `Segment end mismatch: placed to ${cursor}", expected ${endX}" on wall ${wallId}`
    );
  }

  return { cabinets, fillers, warnings };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  CORE: stackWall
 * ═══════════════════════════════════════════════════════════════
 *
 * Full wall placement: corners → appliances → segments → fill.
 *
 * @param {Object} wall             - { id, length, role, appliances[] }
 * @param {Object|null} cornerLeft  - Corner consuming left side
 * @param {Object|null} cornerRight - Corner consuming right side
 * @returns {WallLayout}
 */
export function stackWall(wall, cornerLeft, cornerRight) {
  const wallLength = wall.length;
  const leftOffset = cornerLeft ? cornerLeft.wallConsumption : 0;
  const rightOffset = cornerRight ? cornerRight.wallConsumption : 0;
  const available = wallLength - leftOffset - rightOffset;
  const allCabinets = [];
  const allFillers = [];
  const warnings = [];
  let tagCounter = 1;

  // Step 1: Position appliances within available space
  const appliances = positionAppliances(wall.appliances || [], available, leftOffset);

  // Step 2: Build segments between appliances
  const segments = buildSegments(appliances, leftOffset, leftOffset + available);

  // Step 3: Fill each segment with linear stacking
  for (const seg of segments) {
    const role = classifySegmentRole(seg);
    const { cabinets, fillers, warnings: segWarnings } = linearStack(
      seg.length, role, seg.start, wall.id
    );
    allCabinets.push(...cabinets);
    allFillers.push(...fillers);
    warnings.push(...segWarnings);
  }

  // Step 4: Insert appliances into the cabinet array at correct positions
  for (const app of appliances) {
    allCabinets.push({
      sku: app.type.toUpperCase(),
      width: app.width,
      position_start: app.position,
      position_end: app.position + app.width,
      type: 'appliance',
      wall_id: wall.id,
      role: 'appliance',
      applianceType: app.type,
      depth: app.depth || 24,
      height: app.height || 34.5,
    });
  }

  // Step 5: Sort everything by position_start
  allCabinets.sort((a, b) => a.position_start - b.position_start);

  // Step 6: Assign KD tags
  for (const cab of allCabinets) {
    cab.tag = `KD${tagCounter++}`;
  }

  // Step 7: Chain integrity validation
  const chainValid = validateChain(allCabinets);
  if (!chainValid.valid) {
    warnings.push(...chainValid.breaks.map(b =>
      `Chain break: ${b.prevSku} ends at ${b.prevEnd}", ${b.nextSku} starts at ${b.nextStart}"`
    ));
  }

  // Step 8: Boundary validation
  const lastCab = allCabinets[allCabinets.length - 1];
  const lastFiller = allFillers[allFillers.length - 1];
  const finalEnd = Math.max(
    lastCab ? lastCab.position_end : 0,
    lastFiller ? lastFiller.position_end : 0
  );
  if (finalEnd > wallLength) {
    warnings.push(`Wall overflow: cabinets extend to ${finalEnd}" but wall is ${wallLength}"`);
  }

  return {
    wall_id: wall.id,
    wall_length: wallLength,
    corner_left_consumption: leftOffset,
    corner_right_consumption: rightOffset,
    available_after_corners: available,
    cabinets: allCabinets,
    fillers: allFillers,
    warnings,
    chain_integrity: chainValid.valid,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  DECOMPOSITION: Break length into standard cabinet widths
 * ═══════════════════════════════════════════════════════════════
 *
 * Greedy algorithm: pick largest fitting width, then fill remainder.
 * Ensures remainder ≤ MAX_FILLER (or triggers resize).
 */
export function decomposeToStandardWidths(length, preferredWidths) {
  const widths = preferredWidths || [...STD_WIDTHS].sort((a, b) => b - a); // largest first
  const result = [];
  let remaining = length;

  // Greedy fill
  while (remaining > 0) {
    // Find largest standard width that fits
    const fit = widths.find(w => w <= remaining);

    if (!fit) {
      // Remaining is smaller than smallest standard width → filler
      break;
    }

    // Check if using this width would leave an unfillable remainder
    const afterFit = remaining - fit;
    if (afterFit > 0 && afterFit < STD_WIDTHS[0] && afterFit > MAX_FILLER) {
      // Would leave 7-8" gap that's too big for filler, too small for cabinet
      // Try next smaller width instead
      const alt = widths.find(w => w < fit && w <= remaining);
      if (alt) {
        const afterAlt = remaining - alt;
        if (afterAlt <= MAX_FILLER || widths.find(w2 => w2 <= afterAlt)) {
          result.push(alt);
          remaining -= alt;
          continue;
        }
      }
    }

    result.push(fit);
    remaining -= fit;
  }

  // Validate: total placed + remainder should equal original length
  const totalPlaced = result.reduce((s, w) => s + w, 0);
  const remainder = length - totalPlaced;

  if (remainder < 0) {
    return null; // overflow — shouldn't happen
  }

  return {
    cabinetWidths: result,
    remainder: Math.round(remainder * 100) / 100, // avoid float drift
    totalPlaced,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  SEGMENTS: Build gaps between positioned appliances
 * ═══════════════════════════════════════════════════════════════
 */
export function buildSegments(appliances, wallStart, wallEnd) {
  const sorted = [...appliances].sort((a, b) => a.position - b.position);
  const segments = [];
  let cursor = wallStart;

  for (const app of sorted) {
    if (app.position > cursor) {
      segments.push({
        start: cursor,
        end: app.position,
        length: app.position - cursor,
        leftOf: app.type,
        rightOf: segments.length > 0 ? sorted[segments.length - 1]?.type : null,
      });
    }
    cursor = app.position + app.width;
  }

  // Final segment after last appliance
  if (cursor < wallEnd) {
    segments.push({
      start: cursor,
      end: wallEnd,
      length: wallEnd - cursor,
      leftOf: null,
      rightOf: sorted.length > 0 ? sorted[sorted.length - 1].type : null,
    });
  }

  return segments;
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  FILLER BUILDER
 * ═══════════════════════════════════════════════════════════════
 *
 * Rule: wall_length - sum(cab_widths) = filler_size
 * - ≤ 3": Overlay filler (OVF3)
 * - 3-6": Strip filler (F330, F630)
 * - > 6": Flag for cabinet resize instead
 */
export function buildFiller(gapInches, startX, wallId) {
  let sku, action;

  if (gapInches <= 3) {
    sku = `OVF${Math.ceil(gapInches * 2) / 2}`; // round to nearest 0.5
    action = 'overlay_filler';
  } else if (gapInches <= MAX_FILLER) {
    sku = `F${Math.ceil(gapInches)}30`;
    action = 'strip_filler';
  } else {
    sku = `FILLER-${Math.round(gapInches)}`;
    action = 'resize_recommended';
  }

  return {
    sku,
    width: gapInches,
    position_start: startX,
    position_end: startX + gapInches,
    type: 'filler',
    wall_id: wallId,
    action,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  CHAIN INTEGRITY VALIDATOR
 * ═══════════════════════════════════════════════════════════════
 *
 * Checks: cabinet[i].position_end === cabinet[i+1].position_start
 * for ALL consecutive pairs. Zero tolerance.
 */
export function validateChain(sortedCabinets) {
  const breaks = [];

  for (let i = 0; i < sortedCabinets.length - 1; i++) {
    const curr = sortedCabinets[i];
    const next = sortedCabinets[i + 1];

    if (Math.abs(curr.position_end - next.position_start) > 0.01) {
      breaks.push({
        index: i,
        prevSku: curr.sku,
        prevEnd: curr.position_end,
        nextSku: next.sku,
        nextStart: next.position_start,
        gap: next.position_start - curr.position_end,
      });
    }
  }

  return {
    valid: breaks.length === 0,
    breaks,
    totalCabinets: sortedCabinets.length,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  NKBA WORK TRIANGLE VALIDATOR
 * ═══════════════════════════════════════════════════════════════
 *
 * NKBA Planning Guideline 6:
 *   - Each leg of the work triangle: 4' (48") to 9' (108")
 *   - Sum of all three legs: 12' (144") to 26' (312")
 *   - No leg should cross through a cabinet, island, or table
 *   - No major traffic pattern should cross the triangle
 *
 * Measures center-front of each appliance.
 */
export function validateWorkTriangle(appliances, walls) {
  const sink = appliances.find(a => a.type === 'sink' || a.applianceType === 'sink');
  const range = appliances.find(a =>
    a.type === 'range' || a.type === 'cooktop' ||
    a.applianceType === 'range' || a.applianceType === 'cooktop'
  );
  const fridge = appliances.find(a =>
    a.type === 'refrigerator' || a.applianceType === 'refrigerator'
  );

  if (!sink || !range || !fridge) {
    return {
      compliant: false,
      reason: `Missing appliance(s): ${!sink ? 'sink ' : ''}${!range ? 'range ' : ''}${!fridge ? 'fridge' : ''}`,
      sink_to_range: null,
      range_to_fridge: null,
      fridge_to_sink: null,
      total_legs: null,
    };
  }

  // Get center-front position of each appliance
  const sinkCenter = getApplianceCenterFront(sink, walls);
  const rangeCenter = getApplianceCenterFront(range, walls);
  const fridgeCenter = getApplianceCenterFront(fridge, walls);

  // Calculate leg distances (2D Euclidean or Manhattan depending on layout)
  const sinkToRange = distance2D(sinkCenter, rangeCenter);
  const rangeToFridge = distance2D(rangeCenter, fridgeCenter);
  const fridgeToSink = distance2D(fridgeCenter, sinkCenter);
  const totalLegs = sinkToRange + rangeToFridge + fridgeToSink;

  const errors = [];

  // NKBA: Each leg 48" to 108"
  if (sinkToRange < 48) errors.push(`Sink→Range leg ${sinkToRange}" < 48" minimum`);
  if (sinkToRange > 108) errors.push(`Sink→Range leg ${sinkToRange}" > 108" maximum`);
  if (rangeToFridge < 48) errors.push(`Range→Fridge leg ${rangeToFridge}" < 48" minimum`);
  if (rangeToFridge > 108) errors.push(`Range→Fridge leg ${rangeToFridge}" > 108" maximum`);
  if (fridgeToSink < 48) errors.push(`Fridge→Sink leg ${fridgeToSink}" < 48" minimum`);
  if (fridgeToSink > 108) errors.push(`Fridge→Sink leg ${fridgeToSink}" > 108" maximum`);

  // NKBA: Total 144" to 312"
  if (totalLegs < 144) errors.push(`Total triangle ${totalLegs}" < 144" (12') minimum`);
  if (totalLegs > 312) errors.push(`Total triangle ${totalLegs}" > 312" (26') maximum`);

  return {
    compliant: errors.length === 0,
    sink_to_range: Math.round(sinkToRange),
    range_to_fridge: Math.round(rangeToFridge),
    fridge_to_sink: Math.round(fridgeToSink),
    total_legs: Math.round(totalLegs),
    errors,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  NKBA FULL VALIDATION SUITE
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates the complete layout against NKBA Planning Guidelines
 * and professional design rules.
 */
export function validateNKBA(layout) {
  const errors = [];
  const warnings = [];

  // ─── GUIDELINE 1: Doorway clearance ≥ 32" ───────────────────
  // (Checked externally — doorways are architectural, not cabinet)

  // ─── GUIDELINE 5: Work aisle width ≥ 42" (48" for two cooks) ─
  // (Checked via spatial model — requires room dimensions)

  // ─── GUIDELINE 6: Work Triangle ─────────────────────────────
  const allAppliances = [];
  for (const wall of (layout.walls || [])) {
    for (const cab of (wall.cabinets || [])) {
      if (cab.type === 'appliance') allAppliances.push({ ...cab, wall_id: wall.wall_id });
    }
  }
  const triangle = validateWorkTriangle(allAppliances, layout.walls);
  if (!triangle.compliant) {
    errors.push(`Work Triangle: ${triangle.errors.join('; ')}`);
  }

  // ─── GUIDELINE 7: Sink placement ────────────────────────────
  const sink = allAppliances.find(a => a.applianceType === 'sink');
  if (sink) {
    // Sink should have landing area of ≥ 24" on one side, ≥ 18" on other
    const sinkWall = layout.walls.find(w => w.wall_id === sink.wall_id);
    if (sinkWall) {
      const leftSpace = sink.position_start - (sinkWall.corner_left_consumption || 0);
      const rightSpace = (sinkWall.wall_length - (sinkWall.corner_right_consumption || 0)) - sink.position_end;
      if (Math.max(leftSpace, rightSpace) < 24) {
        warnings.push(`Sink landing: largest side is ${Math.max(leftSpace, rightSpace)}" (NKBA wants ≥24")`);
      }
      if (Math.min(leftSpace, rightSpace) < 18) {
        warnings.push(`Sink landing: smallest side is ${Math.min(leftSpace, rightSpace)}" (NKBA wants ≥18")`);
      }
    }
  }

  // ─── GUIDELINE 8: Range/Cooktop landing ─────────────────────
  const range = allAppliances.find(a =>
    a.applianceType === 'range' || a.applianceType === 'cooktop'
  );
  if (range) {
    const rangeWall = layout.walls.find(w => w.wall_id === range.wall_id);
    if (rangeWall) {
      const leftSpace = range.position_start - (rangeWall.corner_left_consumption || 0);
      const rightSpace = (rangeWall.wall_length - (rangeWall.corner_right_consumption || 0)) - range.position_end;
      // NKBA: 12" landing on one side, 15" on the other
      if (leftSpace < 12 && rightSpace < 12) {
        errors.push(`Range has no landing area ≥ 12" (left=${leftSpace}", right=${rightSpace}")`);
      }
      if (leftSpace < 15 && rightSpace < 15) {
        warnings.push(`Range landing: neither side ≥ 15" (left=${leftSpace}", right=${rightSpace}")`);
      }
      // NEVER: Range adjacent to tall cabinet without heat shield
      // NEVER: Range directly next to refrigerator
      const fridge = allAppliances.find(a => a.applianceType === 'refrigerator');
      if (fridge && fridge.wall_id === range.wall_id) {
        const gap = Math.abs(
          range.position_start > fridge.position_end
            ? range.position_start - fridge.position_end
            : fridge.position_start - range.position_end
        );
        if (gap < 9) {
          errors.push(`Range is ${gap}" from fridge (minimum 9" separation required)`);
        }
      }
    }
  }

  // ─── GUIDELINE 9: Refrigerator landing ──────────────────────
  const fridge = allAppliances.find(a => a.applianceType === 'refrigerator');
  if (fridge) {
    // NKBA: 15" landing on handle side
    const fridgeWall = layout.walls.find(w => w.wall_id === fridge.wall_id);
    if (fridgeWall) {
      const rightSpace = (fridgeWall.wall_length - (fridgeWall.corner_right_consumption || 0)) - fridge.position_end;
      const leftSpace = fridge.position_start - (fridgeWall.corner_left_consumption || 0);
      if (rightSpace < 15 && leftSpace < 15) {
        warnings.push(`Fridge landing: no side ≥ 15" (left=${leftSpace}", right=${rightSpace}")`);
      }
    }
  }

  // ─── GUIDELINE 10: DW adjacent to sink ──────────────────────
  const dw = allAppliances.find(a => a.applianceType === 'dishwasher');
  if (sink && dw) {
    if (sink.wall_id !== dw.wall_id) {
      warnings.push('Dishwasher and sink are on different walls');
    } else {
      const gap = Math.min(
        Math.abs(sink.position_end - dw.position_start),
        Math.abs(dw.position_end - sink.position_start)
      );
      if (gap > 36) {
        warnings.push(`Dishwasher is ${gap}" from sink (NKBA recommends adjacent, ≤36")`);
      }
    }
  }

  // ─── CHAIN INTEGRITY (all walls) ────────────────────────────
  let totalOverlaps = 0;
  let totalGaps = 0;
  for (const wall of (layout.walls || [])) {
    const sorted = [...(wall.cabinets || [])].sort((a, b) => a.position_start - b.position_start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const delta = next.position_start - curr.position_end;
      if (delta < -0.01) {
        totalOverlaps++;
        errors.push(`Overlap: ${curr.sku} and ${next.sku} overlap by ${Math.abs(delta)}" on wall ${wall.wall_id}`);
      } else if (delta > 0.5) {
        totalGaps++;
        warnings.push(`Gap: ${delta}" between ${curr.sku} and ${next.sku} on wall ${wall.wall_id}`);
      }
    }

    // Boundary check
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      const maxEnd = wall.wall_length - (wall.corner_right_consumption || 0);
      if (last.position_end > maxEnd + 0.5) {
        errors.push(`Wall ${wall.wall_id}: cabinets extend to ${last.position_end}" but available space ends at ${maxEnd}"`);
      }
    }
  }

  // ─── 25 "NEVER" RULES (Professional Design) ────────────────
  // These come from training data analysis
  const neverViolations = checkNeverRules(layout, allAppliances);
  errors.push(...neverViolations.errors);
  warnings.push(...neverViolations.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    overlap_count: totalOverlaps,
    gap_count: totalGaps,
    work_triangle: triangle,
  };
}


/**
 * ═══════════════════════════════════════════════════════════════
 *  25 "NEVER" RULES — Professional Kitchen Design
 * ═══════════════════════════════════════════════════════════════
 */
function checkNeverRules(layout, appliances) {
  const errors = [];
  const warnings = [];
  const walls = layout.walls || [];

  // Collect all cabinets across walls
  const allCabs = [];
  for (const w of walls) {
    for (const c of (w.cabinets || [])) {
      allCabs.push({ ...c, wall_id: w.wall_id });
    }
  }

  const range = appliances.find(a => a.applianceType === 'range' || a.applianceType === 'cooktop');
  const sink = appliances.find(a => a.applianceType === 'sink');
  const fridge = appliances.find(a => a.applianceType === 'refrigerator');
  const dw = appliances.find(a => a.applianceType === 'dishwasher');

  // 1. NEVER place range at end of cabinet run with no landing
  if (range) {
    const wall = walls.find(w => w.wall_id === range.wall_id);
    if (wall) {
      const wallEnd = wall.wall_length - (wall.corner_right_consumption || 0);
      const wallStart = wall.corner_left_consumption || 0;
      if (Math.abs(range.position_end - wallEnd) < 1) {
        errors.push('NEVER-1: Range at end of run with no right landing');
      }
      if (Math.abs(range.position_start - wallStart) < 1) {
        errors.push('NEVER-1: Range at start of run with no left landing');
      }
    }
  }

  // 2. NEVER place range directly adjacent to refrigerator
  if (range && fridge && range.wall_id === fridge.wall_id) {
    if (Math.abs(range.position_end - fridge.position_start) < 1 ||
        Math.abs(fridge.position_end - range.position_start) < 1) {
      errors.push('NEVER-2: Range directly adjacent to refrigerator (need ≥9" buffer)');
    }
  }

  // 3. NEVER place range directly adjacent to sink
  if (range && sink && range.wall_id === sink.wall_id) {
    if (Math.abs(range.position_end - sink.position_start) < 1 ||
        Math.abs(sink.position_end - range.position_start) < 1) {
      errors.push('NEVER-3: Range directly adjacent to sink (need ≥3" buffer)');
    }
  }

  // 4. NEVER place DW opening into traffic path / doorway
  // (Requires room data — checked externally)

  // 5. NEVER leave > 6" unfilled gap in a cabinet run
  for (const w of walls) {
    const sorted = [...(w.cabinets || [])].sort((a, b) => a.position_start - b.position_start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].position_start - sorted[i].position_end;
      if (gap > 6) {
        errors.push(`NEVER-5: ${gap}" gap between ${sorted[i].sku} and ${sorted[i+1].sku} on wall ${w.wall_id} (max 6")`);
      }
    }
  }

  // 6. NEVER place upper cabinet below 54" AFF (bottom edge)
  // (Checked in elevation rendering)

  // 7. NEVER omit end panel on exposed cabinet side
  for (const w of walls) {
    const sorted = [...(w.cabinets || [])].sort((a, b) => a.position_start - b.position_start);
    if (sorted.length > 0) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const wallStart = w.corner_left_consumption || 0;
      const wallEnd = w.wall_length - (w.corner_right_consumption || 0);

      // If first cabinet doesn't start at corner and isn't a filler/endpanel
      if (first.position_start > wallStart + 1 && first.type !== 'filler' && first.type !== 'accessory') {
        warnings.push(`NEVER-7: Exposed left end on wall ${w.wall_id} — needs end panel`);
      }
    }
  }

  // 8. NEVER place range under operable window
  // (Requires window data)

  // 9. NEVER use > 3" filler next to range (aesthetic)
  if (range) {
    const rangeCabs = allCabs.filter(c =>
      c.wall_id === range.wall_id &&
      c.type === 'filler' &&
      (Math.abs(c.position_end - range.position_start) < 1 ||
       Math.abs(range.position_end - c.position_start) < 1)
    );
    for (const f of rangeCabs) {
      if (f.width > 3) {
        warnings.push(`NEVER-9: ${f.width}" filler adjacent to range (max 3" for aesthetics)`);
      }
    }
  }

  // 10. NEVER: DW must open fully without hitting island/peninsula
  // (Requires spatial model)

  // 11. NEVER place tall cabinet between two base runs (breaks countertop)
  // (Checked via tall placement logic)

  // 12. NEVER: Hood width must be ≥ range width
  // (Checked in hood selection)

  // 13-25: Additional rules checked in constraints.js validator

  return { errors, warnings };
}


// ─── HELPER FUNCTIONS ──────────────────────────────────────────

function getApplianceCenterFront(appliance, walls) {
  const wall = (walls || []).find(w => w.wall_id === appliance.wall_id);
  const pos = appliance.position_start || appliance.position || 0;
  const width = appliance.width || 30;

  // Simple 1D center for same-wall calculations
  // For multi-wall (L/U shape), convert to 2D using wall geometry
  if (!wall) return { x: pos + width / 2, y: 0 };

  return {
    x: pos + width / 2,
    y: 0, // front face
    wall_id: appliance.wall_id,
    absolute_x: pos + width / 2, // will be transformed for multi-wall
  };
}

function distance2D(a, b) {
  if (a.wall_id === b.wall_id) {
    // Same wall: simple horizontal distance
    return Math.abs(a.x - b.x);
  }
  // Different walls: Manhattan distance through corner
  // (Simplified: sum of distances to corner from each wall)
  return a.x + b.x;
}

function classifySegmentRole(segment) {
  if (segment.leftOf === 'range' || segment.leftOf === 'cooktop') return 'rangeFlanking';
  if (segment.rightOf === 'range' || segment.rightOf === 'cooktop') return 'rangeFlanking';
  if (segment.leftOf === 'sink' || segment.rightOf === 'sink') return 'sinkAdjacent';
  if (segment.leftOf === 'refrigerator' || segment.rightOf === 'refrigerator') return 'fridgeAdjacent';
  return 'general';
}

function positionAppliances(appliances, availableLength, startOffset) {
  // Simple center-based positioning for now
  // Full implementation uses scoring model from solver.js positionAppliances()
  const positioned = [];
  const claimed = new Set();

  for (const app of appliances) {
    const w = app.width || 30;
    // Try to center on available space
    let bestPos = startOffset + Math.round((availableLength - w) / 2);

    // Avoid claimed positions
    while (claimed.has(bestPos) && bestPos < startOffset + availableLength - w) {
      bestPos++;
    }

    // Claim position
    for (let i = bestPos; i < bestPos + w; i++) claimed.add(i);

    positioned.push({
      ...app,
      position: bestPos,
      position_start: bestPos,
      position_end: bestPos + w,
    });
  }

  return positioned;
}
