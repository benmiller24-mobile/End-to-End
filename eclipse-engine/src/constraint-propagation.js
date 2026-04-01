/**
 * Constraint Propagation System — Cabinet Run Linked-List Manager
 * =================================================================
 *
 * Implements a sophisticated linked-list data structure for cabinet runs,
 * where changing one cabinet automatically ripples coordinate updates to
 * all downstream cabinets. Corners are PRIMARY ANCHORS (immutable), while
 * appliances are SECONDARY ANCHORS (strongly preferred position).
 *
 * Supports:
 *   - Width updates with automatic downstream propagation
 *   - Insert/remove operations with position adjustment
 *   - Overflow detection and automatic resolution strategies
 *   - Bidirectional propagation for pinned appliances
 *   - Multi-wall consistency when corners span walls
 *   - Flexible cabinet prioritization for overflow reduction
 *
 * No external dependencies. ES module format.
 */

// ============================================================================
// ANCHOR TYPE CONSTANTS
// ============================================================================

/**
 * Cabinet anchor classification for constraint propagation.
 * Determines how each cabinet behaves when the run overflows or is edited.
 */
export const ANCHOR_TYPES = {
  PRIMARY: 'PRIMARY',       // Corner cabinets (BBC, BL, WSC) — position immutable
  SECONDARY: 'SECONDARY',   // Appliances (sink, range, fridge, DW) — position strongly preferred
  FLEX: 'FLEX',             // Standard base cabs (B, B-RT, B3D, etc.) — can be resized/shifted
  FIXED_WIDTH: 'FIXED_WIDTH', // Appliances with manufacturer specs — cannot be resized
};

// ============================================================================
// CABINET RUN LINKED-LIST CLASS
// ============================================================================

/**
 * CabinetRun — Linked-list data structure for a single wall's cabinet sequence.
 *
 * Each cabinet is a node: { cab, prev, next }
 * Corners (leftAnchor, rightAnchor) are PRIMARY ANCHORS — never move.
 * All propagation flows outward from corners.
 *
 * @example
 * const run = new CabinetRun('wall-a', 120, 4.5, 3);
 * run.insert(baseCAB36, 0);
 * run.insert(sinkBase42, 1);
 * run.updateWidth(0, 39); // Sink shifts right by 3"
 * console.log(run.getOverflow()); // Check if run exceeds wall
 */
export class CabinetRun {
  /**
   * @param {string} wallId - Unique identifier for this wall (e.g., "wall-a")
   * @param {number} wallLength - Total available wall length in inches
   * @param {number} leftAnchor - Corner consumption on left (e.g., 4.5 for corner filler)
   * @param {number} rightAnchor - Corner consumption on right (e.g., 3 for filler)
   */
  constructor(wallId, wallLength, leftAnchor = 0, rightAnchor = 0) {
    this.wallId = wallId;
    this.wallLength = wallLength;
    this.leftAnchor = leftAnchor;  // PRIMARY anchor on left
    this.rightAnchor = rightAnchor; // PRIMARY anchor on right
    this.head = null;  // First cabinet node
    this.tail = null;  // Last cabinet node
    this.length = 0;   // Number of cabinets in list
  }

  /**
   * Get the total length consumed by all cabinets (excluding anchors).
   * @returns {number} Sum of all cabinet widths in inches
   */
  getTotalWidth() {
    let total = 0;
    let node = this.head;
    while (node) {
      total += node.cab.width || 0;
      node = node.next;
    }
    return total;
  }

  /**
   * Get available wall space after accounting for anchors and cabinets.
   * @returns {number} Remaining inches (positive if underflow, negative if overflow)
   */
  getOverflow() {
    const usedSpace = this.leftAnchor + this.getTotalWidth() + this.rightAnchor;
    return usedSpace - this.wallLength; // Positive = overflow, negative = underflow
  }

  /**
   * Insert a cabinet at the specified index in the run.
   * All downstream cabinets shift right by cabinet.width.
   *
   * @param {Object} cabinet - Cabinet object with { width, type, sku, ... }
   * @param {number} index - Position to insert (0 = before head)
   * @throws {Error} If index is out of bounds
   */
  insert(cabinet, index) {
    if (index < 0 || index > this.length) {
      throw new Error(
        `Index ${index} out of bounds. Run length: ${this.length}`
      );
    }

    const newNode = { cab: cabinet, prev: null, next: null };

    // Special case: empty run
    if (this.length === 0) {
      this.head = this.tail = newNode;
      this.length = 1;
      cabinet.position_start = this.leftAnchor;
      cabinet.position_end = this.leftAnchor + (cabinet.width || 0);
      return;
    }

    // Find the node at insertion point
    let target = null;
    let current = this.head;
    for (let i = 0; i < index; i++) {
      current = current.next;
    }
    target = current;

    // Insert before target
    newNode.next = target;
    newNode.prev = target ? target.prev : this.tail;

    if (target) {
      target.prev = newNode;
    } else {
      this.tail = newNode;
    }

    if (newNode.prev) {
      newNode.prev.next = newNode;
    } else {
      this.head = newNode;
    }

    this.length += 1;

    // Recalculate positions from head
    this._recalculatePositions();
  }

  /**
   * Remove cabinet at the specified index.
   * All downstream cabinets shift left by removed.width.
   *
   * @param {number} index - Index to remove
   * @returns {Object} The removed cabinet object
   * @throws {Error} If index is out of bounds
   */
  remove(index) {
    if (index < 0 || index >= this.length) {
      throw new Error(
        `Index ${index} out of bounds. Run length: ${this.length}`
      );
    }

    let current = this.head;
    for (let i = 0; i < index; i++) {
      current = current.next;
    }

    const removed = current.cab;
    const removedWidth = removed.width || 0;

    // Unlink node
    if (current.prev) {
      current.prev.next = current.next;
    } else {
      this.head = current.next;
    }

    if (current.next) {
      current.next.prev = current.prev;
    } else {
      this.tail = current.prev;
    }

    this.length -= 1;

    // Recalculate positions
    this._recalculatePositions();

    return removed;
  }

  /**
   * Update width of cabinet at index and propagate to downstream cabinets.
   *
   * @param {number} index - Cabinet index
   * @param {number} newWidth - New width in inches
   * @returns {{ delta: number, affected: number }} Change in width and count of cabinets shifted
   * @throws {Error} If index is out of bounds
   */
  updateWidth(index, newWidth) {
    if (index < 0 || index >= this.length) {
      throw new Error(
        `Index ${index} out of bounds. Run length: ${this.length}`
      );
    }

    let current = this.head;
    for (let i = 0; i < index; i++) {
      current = current.next;
    }

    const oldWidth = current.cab.width || 0;
    const delta = newWidth - oldWidth;

    current.cab.width = newWidth;

    // Propagate delta to all downstream cabinets
    let affected = 0;
    let node = current.next;
    while (node) {
      node.cab.position_start = (node.cab.position_start || 0) + delta;
      node.cab.position_end = (node.cab.position_end || 0) + delta;
      affected += 1;
      node = node.next;
    }

    // Update the modified cabinet's own end position
    current.cab.position_end = (current.cab.position_start || 0) + newWidth;

    return { delta, affected };
  }

  /**
   * Serialize the cabinet run back to a flat array for solver/layout output.
   *
   * @returns {Array<Object>} Array of cabinet objects with position_start/position_end set
   */
  toArray() {
    const result = [];
    let node = this.head;
    while (node) {
      result.push(node.cab);
      node = node.next;
    }
    return result;
  }

  /**
   * Get cabinet at the specified index.
   *
   * @param {number} index - Index to retrieve
   * @returns {Object|null} Cabinet object or null if out of bounds
   */
  getAt(index) {
    if (index < 0 || index >= this.length) {
      return null;
    }
    let current = this.head;
    for (let i = 0; i < index; i++) {
      current = current.next;
    }
    return current ? current.cab : null;
  }

  /**
   * Get index of cabinet by reference (identity).
   *
   * @param {Object} cabinet - Cabinet object to find
   * @returns {number} Index or -1 if not found
   */
  indexOf(cabinet) {
    let current = this.head;
    for (let i = 0; i < this.length; i++) {
      if (current.cab === cabinet) {
        return i;
      }
      current = current.next;
    }
    return -1;
  }

  /**
   * Internal: Recalculate all position_start and position_end values
   * starting from the left anchor.
   *
   * @private
   */
  _recalculatePositions() {
    let position = this.leftAnchor;
    let node = this.head;
    while (node) {
      node.cab.position_start = position;
      node.cab.position_end = position + (node.cab.width || 0);
      position = node.cab.position_end;
      node = node.next;
    }
  }
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Classify a cabinet as PRIMARY, SECONDARY, FLEX, or FIXED_WIDTH anchor.
 *
 * PRIMARY ANCHORS (corners): BBC, BL, WSC, SWSC
 * SECONDARY ANCHORS (appliances): SB, RTB, and appliance types
 * FIXED_WIDTH: Non-resizable appliances
 * FLEX: Everything else
 *
 * @param {Object} cabinet - Cabinet object with type, sku, and properties
 * @returns {string} One of ANCHOR_TYPES values
 */
export function classifyAnchor(cabinet) {
  const type = cabinet.type || '';
  const sku = cabinet.sku || '';

  // PRIMARY ANCHORS: Corner cabinets
  if (
    type === 'BBC' ||
    type === 'BL' ||
    type === 'WSC' ||
    type === 'SWSC' ||
    type === 'BHM' ||
    type === 'BDL'
  ) {
    return ANCHOR_TYPES.PRIMARY;
  }

  // SECONDARY ANCHORS: Appliances (sink, range, fridge, dishwasher)
  if (
    type === 'SB' ||
    type === 'SBA' ||
    type === 'SB-FHD' ||
    type === 'DSB' ||
    type === 'RTB' ||
    sku.includes('SINK') ||
    sku.includes('RANGE') ||
    sku.includes('FRIDGE') ||
    sku.includes('DW') ||
    sku.includes('COOKTOP')
  ) {
    return ANCHOR_TYPES.SECONDARY;
  }

  // If appliance and width is fixed by spec, mark as FIXED_WIDTH
  if (cabinet.fixedWidth || cabinet.manufacturerWidth) {
    return ANCHOR_TYPES.FIXED_WIDTH;
  }

  // Everything else is FLEX
  return ANCHOR_TYPES.FLEX;
}

/**
 * Build CabinetRun objects from a solver's wallLayouts output.
 *
 * @param {Array<Object>} wallLayouts - Array of { id, length, cabinets, appliances }
 * @param {Object} corners - Corner cabinet metadata { leftCorner, rightCorner }
 * @returns {Map<string, CabinetRun>} Map of wallId → CabinetRun
 */
export function buildCabinetRuns(wallLayouts, corners = {}) {
  const runs = new Map();

  for (const wall of wallLayouts || []) {
    const wallId = wall.id || wall.wallId || `wall-${wall.index || 0}`;
    const wallLength = wall.length || wall.wallLength || 120;

    // Determine anchor consumptions
    let leftConsumption = 0;
    let rightConsumption = 0;

    const leftCorner = corners[wallId]?.leftCorner;
    const rightCorner = corners[wallId]?.rightCorner;

    if (leftCorner) {
      leftConsumption = leftCorner.fillerWidth || leftCorner.width || 0;
    }
    if (rightCorner) {
      rightConsumption = rightCorner.fillerWidth || rightCorner.width || 0;
    }

    // Create run
    const run = new CabinetRun(wallId, wallLength, leftConsumption, rightConsumption);

    // Insert all cabinets in order
    const cabinets = wall.cabinets || [];
    for (const cab of cabinets) {
      try {
        run.insert(cab, run.length);
      } catch (err) {
        console.warn(
          `Failed to insert cabinet into run ${wallId}:`,
          cab.sku || cab.type,
          err.message
        );
      }
    }

    runs.set(wallId, run);
  }

  return runs;
}

/**
 * Apply a user edit (resize, insert, remove, move) to a cabinet run.
 *
 * @param {Map<string, CabinetRun>} runs - Map of wallId → CabinetRun
 * @param {string} wallId - Target wall
 * @param {number} cabinetIndex - Cabinet index within the run
 * @param {Object} edit - Edit operation
 *   - edit.type: 'resize', 'insert', 'remove', 'move'
 *   - edit.width: New width (for resize)
 *   - edit.cabinet: Cabinet object (for insert)
 *   - edit.position: New position (for move)
 * @returns {{ runs: Map, changes: Array, overflows: Array }}
 *   - runs: Updated runs map
 *   - changes: Array of { wallId, index, type, delta, ... }
 *   - overflows: Array of overflow issues if any
 */
export function applyEdit(runs, wallId, cabinetIndex, edit = {}) {
  if (!runs.has(wallId)) {
    return { runs, changes: [], overflows: [{ wallId, error: 'Wall not found' }] };
  }

  const run = runs.get(wallId);
  const changes = [];
  const overflows = [];

  try {
    switch (edit.type) {
      case 'resize': {
        if (typeof edit.width !== 'number') {
          throw new Error('resize requires edit.width');
        }
        const { delta, affected } = run.updateWidth(cabinetIndex, edit.width);
        changes.push({
          wallId,
          index: cabinetIndex,
          type: 'resize',
          delta,
          affected,
        });
        break;
      }

      case 'insert': {
        if (!edit.cabinet) {
          throw new Error('insert requires edit.cabinet');
        }
        run.insert(edit.cabinet, cabinetIndex);
        changes.push({
          wallId,
          index: cabinetIndex,
          type: 'insert',
          cabType: edit.cabinet.type,
          width: edit.cabinet.width,
        });
        break;
      }

      case 'remove': {
        const removed = run.remove(cabinetIndex);
        changes.push({
          wallId,
          index: cabinetIndex,
          type: 'remove',
          width: removed.width,
          cabType: removed.type,
        });
        break;
      }

      case 'move': {
        if (typeof edit.position !== 'number') {
          throw new Error('move requires edit.position');
        }
        // Move is a semantic operation; implemented as resize + position adjust
        const cab = run.getAt(cabinetIndex);
        if (cab) {
          const oldStart = cab.position_start || 0;
          const delta = edit.position - oldStart;
          if (cabinetIndex > 0) {
            run.updateWidth(cabinetIndex, cab.width + delta);
          }
          changes.push({
            wallId,
            index: cabinetIndex,
            type: 'move',
            delta,
          });
        }
        break;
      }

      default: {
        throw new Error(`Unknown edit type: ${edit.type}`);
      }
    }
  } catch (err) {
    return {
      runs,
      changes,
      overflows: [{ wallId, index: cabinetIndex, error: err.message }],
    };
  }

  // Check for overflow after mutation
  const overflow = run.getOverflow();
  if (overflow > 0) {
    overflows.push({
      wallId,
      overflow,
      totalWidth: run.getTotalWidth(),
      available: run.wallLength - run.leftAnchor - run.rightAnchor,
    });
  }

  return { runs, changes, overflows };
}

/**
 * Validate all cabinet runs for integrity and consistency.
 *
 * Checks:
 *   - All position_start/position_end values are set
 *   - Cabinets are contiguous (no gaps, no overlaps)
 *   - First cabinet starts at leftAnchor
 *   - Last cabinet ends <= wallLength - rightAnchor
 *   - All widths are positive
 *
 * @param {Map<string, CabinetRun>} runs - Map of wallId → CabinetRun
 * @returns {{ valid: boolean, issues: Array<{ wallId, type, message, ... }> }}
 */
export function validateRuns(runs) {
  const issues = [];

  for (const [wallId, run] of runs.entries()) {
    // Check for position_start/position_end on all cabinets
    const cabinets = run.toArray();

    if (cabinets.length === 0) {
      // Empty run is valid
      continue;
    }

    // Check first cabinet alignment
    const firstCab = cabinets[0];
    if (firstCab.position_start !== run.leftAnchor) {
      issues.push({
        wallId,
        type: 'FIRST_CAB_MISALIGNED',
        message: `First cabinet position_start ${firstCab.position_start} !== leftAnchor ${run.leftAnchor}`,
      });
    }

    // Check contiguity and widths
    for (let i = 0; i < cabinets.length; i++) {
      const cab = cabinets[i];
      const width = cab.width || 0;

      if (width <= 0) {
        issues.push({
          wallId,
          index: i,
          type: 'INVALID_WIDTH',
          message: `Cabinet ${cab.sku || cab.type} has width ${width}`,
        });
      }

      if (!Number.isFinite(cab.position_start)) {
        issues.push({
          wallId,
          index: i,
          type: 'MISSING_POSITION',
          message: `Cabinet ${cab.sku} missing position_start`,
        });
      }

      if (cab.position_end !== cab.position_start + width) {
        issues.push({
          wallId,
          index: i,
          type: 'POSITION_MISMATCH',
          message: `position_end ${cab.position_end} !== position_start + width`,
        });
      }

      // Check gap to next cabinet
      if (i < cabinets.length - 1) {
        const nextCab = cabinets[i + 1];
        if (Math.abs(cab.position_end - nextCab.position_start) > 0.01) {
          issues.push({
            wallId,
            index: i,
            type: 'GAP_OR_OVERLAP',
            message: `Gap of ${nextCab.position_start - cab.position_end}" between cabinets`,
          });
        }
      }
    }

    // Check last cabinet against right anchor
    const lastCab = cabinets[cabinets.length - 1];
    const expectedEnd = run.wallLength - run.rightAnchor;
    if (Math.abs(lastCab.position_end - expectedEnd) > 0.01) {
      issues.push({
        wallId,
        type: 'LAST_CAB_MISALIGNED',
        message: `Last cabinet position_end ${lastCab.position_end} !== wallEnd ${expectedEnd}`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Automatically resolve overflow by reducing or removing flex cabinets.
 *
 * Strategy:
 *   1. Identify flex cabinets (non-anchor, non-appliance, type=B/B-RT/B3D/etc.)
 *   2. Calculate overflow amount
 *   3a. Reduce widest flex cab by overflow (if result ≥ 9")
 *   3b. Reduce multiple flex cabs proportionally
 *   3c. Remove smallest flex cab if reduction insufficient
 *
 * @param {Map<string, CabinetRun>} runs - Map of wallId → CabinetRun
 * @returns {{
 *   resolved: boolean,
 *   adjustments: Array<{ wallId, index, type, oldWidth, newWidth, reason }>
 * }}
 */
export function resolveOverflows(runs) {
  const adjustments = [];

  for (const [wallId, run] of runs.entries()) {
    let overflow = run.getOverflow();
    if (overflow <= 0) continue; // No overflow

    const cabinets = run.toArray();

    // Identify flex cabinets (can be resized/removed)
    const flexIndices = [];
    for (let i = 0; i < cabinets.length; i++) {
      const anchor = classifyAnchor(cabinets[i]);
      if (anchor === ANCHOR_TYPES.FLEX) {
        flexIndices.push(i);
      }
    }

    if (flexIndices.length === 0) {
      // No flex cabinets; cannot resolve
      continue;
    }

    // Strategy: Reduce widest flex first
    let remainingOverflow = overflow;

    // Sort flex cabinets by width (descending)
    const sortedFlex = flexIndices
      .map(i => ({ index: i, width: cabinets[i].width || 0 }))
      .sort((a, b) => b.width - a.width);

    for (const { index } of sortedFlex) {
      if (remainingOverflow <= 0) break;

      const cab = cabinets[index];
      const oldWidth = cab.width || 0;
      const minWidth = 9; // Minimum practical cabinet width

      if (oldWidth - remainingOverflow >= minWidth) {
        // Can reduce this cabinet
        const newWidth = oldWidth - remainingOverflow;
        run.updateWidth(index, newWidth);

        adjustments.push({
          wallId,
          index,
          type: 'RESIZE',
          oldWidth,
          newWidth,
          reason: `Reduced to resolve ${overlap.toFixed(1)}" overflow`,
        });

        remainingOverflow = 0;
      } else if (oldWidth > minWidth) {
        // Reduce as much as possible
        const newWidth = minWidth;
        const reduction = oldWidth - newWidth;
        run.updateWidth(index, newWidth);

        adjustments.push({
          wallId,
          index,
          type: 'RESIZE',
          oldWidth,
          newWidth,
          reason: `Partial reduction (${reduction.toFixed(1)}" removed)`,
        });

        remainingOverflow -= reduction;
      }
    }

    // If still overflowing, remove smallest flex cabinet
    if (remainingOverflow > 0) {
      const smallestFlex = sortedFlex[sortedFlex.length - 1]; // Last after sort = smallest
      const removed = run.remove(smallestFlex.index);

      adjustments.push({
        wallId,
        index: smallestFlex.index,
        type: 'REMOVE',
        oldWidth: removed.width,
        newWidth: 0,
        reason: `Removed flex cabinet to resolve overflow`,
      });
    }
  }

  const resolved = adjustments.length > 0;
  return { resolved, adjustments };
}

/**
 * Propagate a corner cabinet change across walls.
 *
 * When a corner cabinet changes (e.g., BBC width), both walls sharing that corner
 * must update their left/right consumption values.
 *
 * @param {Object} cornerCab - Corner cabinet object (BBC, BL, WSC, etc.)
 * @param {string} sourceWall - Wall where change originated
 * @param {string} targetWall - Opposite wall to update
 * @param {Map<string, CabinetRun>} runs - Map of wallId → CabinetRun
 * @returns {{ sourceWall, targetWall, updated: boolean, reason: string }}
 */
export function propagateAcrossCorner(
  cornerCab,
  sourceWall,
  targetWall,
  runs
) {
  const sourceRun = runs.get(sourceWall);
  const targetRun = runs.get(targetWall);

  if (!sourceRun || !targetRun) {
    return {
      sourceWall,
      targetWall,
      updated: false,
      reason: 'One or both walls not found in runs',
    };
  }

  const newConsumption = cornerCab.width || 0;

  // Determine which anchor (left or right) of target wall needs update
  // This depends on which side of sourceWall the corner is
  // Simplified: assume right corner of source = left corner of target
  const wasLeftTarget = targetRun.leftAnchor;
  const wasRightTarget = targetRun.rightAnchor;

  // Update target run's anchor (heuristic: typically right of source = left of target)
  targetRun.leftAnchor = newConsumption;
  targetRun._recalculatePositions();

  return {
    sourceWall,
    targetWall,
    updated: true,
    reason: `Updated targetWall leftAnchor from ${wasLeftTarget} to ${newConsumption}`,
  };
}

/**
 * Pinned cabinet support: Lock an appliance's position and propagate
 * bidirectionally (left and right) from the pin point.
 *
 * When a cabinet is "pinned" (user-locked position), adjacent cabinets
 * must adjust to accommodate. This may require resizing or removing flex
 * units on both sides.
 *
 * @param {Map<string, CabinetRun>} runs - Map of wallId → CabinetRun
 * @param {string} wallId - Target wall
 * @param {number} pinIndex - Cabinet index to pin
 * @param {number} pinnedPosition - Locked position_start in inches
 * @returns {{ success: boolean, leftAdjustments: Array, rightAdjustments: Array }}
 */
export function pinCabinetPosition(
  runs,
  wallId,
  pinIndex,
  pinnedPosition
) {
  const run = runs.get(wallId);
  if (!run) {
    return { success: false, leftAdjustments: [], rightAdjustments: [] };
  }

  const cabinets = run.toArray();
  if (pinIndex < 0 || pinIndex >= cabinets.length) {
    return { success: false, leftAdjustments: [], rightAdjustments: [] };
  }

  const pinnedCab = cabinets[pinIndex];
  const pinnedWidth = pinnedCab.width || 0;
  const pinnedEnd = pinnedPosition + pinnedWidth;

  const leftAdjustments = [];
  const rightAdjustments = [];

  // Adjust left side (shrink cabinets before pin)
  let currentPos = run.leftAnchor;
  for (let i = 0; i < pinIndex; i++) {
    const cab = cabinets[i];
    const oldWidth = cab.width || 0;
    const expectedEnd = currentPos + oldWidth;

    if (expectedEnd > pinnedPosition) {
      // Overlap: shrink this cabinet
      const newWidth = Math.max(9, pinnedPosition - currentPos);
      const reduction = oldWidth - newWidth;

      run.updateWidth(i, newWidth);
      leftAdjustments.push({
        index: i,
        oldWidth,
        newWidth,
        reduction,
      });
    }

    currentPos += newWidth || 0;
  }

  // Adjust right side (shift/shrink cabinets after pin)
  currentPos = pinnedEnd;
  for (let i = pinIndex + 1; i < cabinets.length; i++) {
    const cab = cabinets[i];
    const oldStart = cab.position_start || 0;
    const delta = currentPos - oldStart;

    if (delta !== 0) {
      cab.position_start = currentPos;
      cab.position_end = currentPos + (cab.width || 0);
      rightAdjustments.push({
        index: i,
        delta,
      });
    }

    currentPos = cab.position_end || 0;
  }

  // Mark cabinet as pinned
  pinnedCab.pinned = true;
  pinnedCab.pinnedPosition = pinnedPosition;

  return {
    success: true,
    leftAdjustments,
    rightAdjustments,
  };
}

/**
 * Unpin a cabinet, allowing it to shift again if needed.
 *
 * @param {Object} cabinet - Cabinet object with pinned property
 */
export function unpinCabinet(cabinet) {
  cabinet.pinned = false;
  delete cabinet.pinnedPosition;
}

/**
 * Calculate the "score" of a cabinet run, useful for comparing layout quality.
 *
 * Lower score = better (more compact, fewer adjustments).
 *
 * Score factors:
 *   - Positive overflow
 *   - Number of pinned cabinets
 *   - Widest deviation from target widths
 *
 * @param {CabinetRun} run - Cabinet run to score
 * @param {Object} options - Scoring options (reserved for future use)
 * @returns {number} Non-negative score
 */
export function scoreRun(run, options = {}) {
  let score = 0;

  // Penalize overflow
  const overflow = run.getOverflow();
  if (overflow > 0) {
    score += overflow * 10; // Heavy penalty for overflow
  }

  // Penalize underflow (wasted space)
  if (overflow < -6) {
    score += Math.abs(overflow) * 2; // Lighter penalty for underflow
  }

  // Penalize pinned cabinets (less flexible)
  const cabinets = run.toArray();
  const pinnedCount = cabinets.filter(c => c.pinned).length;
  score += pinnedCount * 5;

  return score;
}
