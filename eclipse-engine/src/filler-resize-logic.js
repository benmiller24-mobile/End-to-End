/**
 * Eclipse Filler vs. Resize Logic
 * =================================
 * Professional rule: NEVER use a filler > 3". If the leftover space exceeds 3",
 * redistribute it by widening adjacent cabinets (MOD WIDTH N/C or MOD/SQ30).
 *
 * Decision hierarchy (from training data — 5:1 width-mod-to-filler ratio):
 *   1. Space ≤ 0.5"   → Ignore (installation tolerance)
 *   2. Space ≤ 3"     → Use OVF3 overlay filler (zone transition)
 *   3. Space 3-6"     → Widen the nearest cabinet by the gap (MOD WIDTH N/C, free)
 *   4. Space 6-12"    → Split the gap across 2 adjacent cabinets (MOD WIDTH N/C)
 *   5. Space > 12"    → Add a small standard cabinet (B9, B12, B15) + optional filler
 *
 * MOD WIDTH rules (from Eclipse pricing):
 *   - ≤ 30% size increase: MOD WIDTH N/C (no charge)
 *   - > 30% size increase: MOD/SQ30 ($91-$194 surcharge)
 *   - Maximum cabinet width: 48" (Eclipse manufacturing limit)
 *   - Minimum cabinet width: 9" (smallest standard base)
 *
 * @module filler-resize-logic
 */

// Standard Eclipse base cabinet widths
const STD_WIDTHS = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42];
const MAX_CAB_WIDTH = 48;
const MIN_CAB_WIDTH = 9;
const MAX_FILLER = 3;      // Never exceed 3" filler
const MOD_FREE_PCT = 0.30; // ≤30% width change is free
const TOLERANCE = 0.5;     // Installation tolerance — ignore gaps this small

/**
 * Resolve leftover space in a wall segment using filler vs. resize logic.
 *
 * @param {number} remainingSpace - The gap to fill (inches)
 * @param {Array} cabinets - Array of cabinet objects with { sku, width, type, position }
 * @param {string} golaPrefix - "FC-" for Gola or "" for standard
 * @returns {Object} { cabinets, fillers, modifications, warnings }
 */
export function resolveFillerOrResize(remainingSpace, cabinets, golaPrefix = '') {
  const result = {
    cabinets: [...cabinets],
    fillers: [],
    modifications: [],
    warnings: [],
  };

  if (remainingSpace <= TOLERANCE) {
    return result; // Within installation tolerance
  }

  // Rule 1: Space ≤ 3" → Use overlay filler
  if (remainingSpace <= MAX_FILLER) {
    result.fillers.push({
      sku: `OVF3${Math.ceil(remainingSpace)}`,
      width: remainingSpace,
      type: 'filler',
      role: 'overlay_filler',
      decision: `Space ${remainingSpace}" ≤ ${MAX_FILLER}" → overlay filler`,
    });
    return result;
  }

  // Rule 2: Space 3-6" → Widen the nearest cabinet
  if (remainingSpace <= 6) {
    const target = findBestResizeCandidate(result.cabinets, remainingSpace);
    if (target) {
      const oldWidth = target.width;
      const newWidth = oldWidth + remainingSpace;
      if (newWidth <= MAX_CAB_WIDTH) {
        const pctChange = remainingSpace / oldWidth;
        const modType = pctChange <= MOD_FREE_PCT ? 'MOD WIDTH N/C' : 'MOD/SQ30';
        target.width = newWidth;
        target.sku = rebuildSku(target.sku, newWidth, golaPrefix);
        target.modified = { type: modType, original: oldWidth, modified: newWidth };
        result.modifications.push({
          sku: target.sku, from: oldWidth, to: newWidth, modType,
          decision: `Space ${remainingSpace}" (3-6") → widen ${oldWidth}" cab to ${newWidth}" (${modType})`,
        });
        return result;
      }
    }
    // Fallback: use a filler anyway (shouldn't normally happen)
    result.fillers.push({
      sku: `F3${Math.ceil(remainingSpace)}`,
      width: remainingSpace,
      type: 'filler',
      role: 'gap_filler',
      decision: `Space ${remainingSpace}" — no suitable cabinet to widen, using filler`,
    });
    result.warnings.push(`Used ${remainingSpace}" filler > 3" — no adjacent cabinet could absorb gap`);
    return result;
  }

  // Rule 3: Space 6-12" → Split across 2 adjacent cabinets
  if (remainingSpace <= 12) {
    const candidates = findTwoResizeCandidates(result.cabinets, remainingSpace);
    if (candidates) {
      const [cab1, cab2] = candidates;
      const halfGap = remainingSpace / 2;
      const rounded1 = Math.ceil(halfGap * 2) / 2; // round to nearest 0.5"
      const rounded2 = remainingSpace - rounded1;

      for (const [cab, addWidth] of [[cab1, rounded1], [cab2, rounded2]]) {
        if (addWidth <= 0) continue;
        const oldWidth = cab.width;
        const newWidth = oldWidth + addWidth;
        if (newWidth <= MAX_CAB_WIDTH) {
          const pctChange = addWidth / oldWidth;
          const modType = pctChange <= MOD_FREE_PCT ? 'MOD WIDTH N/C' : 'MOD/SQ30';
          cab.width = newWidth;
          cab.sku = rebuildSku(cab.sku, newWidth, golaPrefix);
          cab.modified = { type: modType, original: oldWidth, modified: newWidth };
          result.modifications.push({
            sku: cab.sku, from: oldWidth, to: newWidth, modType,
            decision: `Split ${remainingSpace}" gap → widen ${oldWidth}" to ${newWidth}" (${modType})`,
          });
        }
      }
      return result;
    }
    // Fallback to single resize
    return resolveFillerOrResize_single(remainingSpace, result, golaPrefix);
  }

  // Rule 4: Space > 12" → Add a small standard cabinet + handle remainder
  const bestSmall = findLargestFittingCabinet(remainingSpace);
  if (bestSmall) {
    const remainder = remainingSpace - bestSmall;
    result.cabinets.push({
      sku: `${golaPrefix}B${bestSmall}`,
      width: bestSmall,
      type: 'base',
      role: 'gap_fill',
      decision: `Space ${remainingSpace}" > 12" → add B${bestSmall} + handle ${remainder}" remainder`,
    });
    // Recursively handle the remainder
    if (remainder > TOLERANCE) {
      const sub = resolveFillerOrResize(remainder, result.cabinets, golaPrefix);
      result.fillers.push(...sub.fillers);
      result.modifications.push(...sub.modifications);
      result.warnings.push(...sub.warnings);
    }
    return result;
  }

  // Ultimate fallback
  result.warnings.push(`Could not resolve ${remainingSpace}" gap — adding filler as last resort`);
  result.fillers.push({
    sku: `F3${Math.ceil(remainingSpace)}`,
    width: remainingSpace,
    type: 'filler',
    role: 'gap_filler_fallback',
  });
  return result;
}

/**
 * Find the best cabinet to widen (closest to end of run, type=base).
 */
function findBestResizeCandidate(cabinets, gap) {
  // Prefer the last base cabinet (closest to the gap, usually at end of run)
  const bases = cabinets.filter(c =>
    c.type === 'base' && c.width + gap <= MAX_CAB_WIDTH
  );
  if (bases.length === 0) return null;
  return bases[bases.length - 1]; // last one in run
}

/**
 * Find two adjacent base cabinets to split a gap between.
 */
function findTwoResizeCandidates(cabinets, gap) {
  const bases = cabinets.filter(c => c.type === 'base');
  if (bases.length < 2) return null;
  const halfGap = gap / 2;
  // Pick the last two base cabinets
  const cab1 = bases[bases.length - 2];
  const cab2 = bases[bases.length - 1];
  if (cab1.width + halfGap <= MAX_CAB_WIDTH && cab2.width + halfGap <= MAX_CAB_WIDTH) {
    return [cab1, cab2];
  }
  return null;
}

/**
 * Find the largest standard cabinet that fits in the gap.
 */
function findLargestFittingCabinet(gap) {
  const sorted = [...STD_WIDTHS].sort((a, b) => b - a);
  for (const w of sorted) {
    if (w <= gap - TOLERANCE) return w; // leave at least tolerance for filler
  }
  return null;
}

/**
 * Single-cabinet resize fallback for 6-12" gaps.
 */
function resolveFillerOrResize_single(gap, result, golaPrefix) {
  const target = findBestResizeCandidate(result.cabinets, gap);
  if (target) {
    const oldWidth = target.width;
    const newWidth = oldWidth + gap;
    if (newWidth <= MAX_CAB_WIDTH) {
      const pctChange = gap / oldWidth;
      const modType = pctChange <= MOD_FREE_PCT ? 'MOD WIDTH N/C' : 'MOD/SQ30';
      target.width = newWidth;
      target.sku = rebuildSku(target.sku, newWidth, golaPrefix);
      target.modified = { type: modType, original: oldWidth, modified: newWidth };
      result.modifications.push({
        sku: target.sku, from: oldWidth, to: newWidth, modType,
        decision: `Space ${gap}" → widen single cab ${oldWidth}" to ${newWidth}" (${modType})`,
      });
      return result;
    }
  }
  // Can't resize — add smallest cab + filler
  const bestSmall = findLargestFittingCabinet(gap);
  if (bestSmall) {
    const remainder = gap - bestSmall;
    result.cabinets.push({
      sku: `${golaPrefix}B${bestSmall}`,
      width: bestSmall,
      type: 'base',
      role: 'gap_fill',
    });
    if (remainder > TOLERANCE && remainder <= MAX_FILLER) {
      result.fillers.push({
        sku: `OVF3${Math.ceil(remainder)}`,
        width: remainder,
        type: 'filler',
        role: 'overlay_filler',
      });
    }
  }
  return result;
}

/**
 * Rebuild a cabinet SKU with a new width.
 * E.g., B3D27 → B3D30, B18-FHD → B21-FHD
 */
function rebuildSku(sku, newWidth, golaPrefix) {
  const wStr = newWidth % 1 === 0 ? `${newWidth}` : `${Math.floor(newWidth)} 1/2`;

  // Strip gola prefix for parsing, re-add at end
  const stripped = sku.replace(/^FC-/, '');
  const prefix = sku.startsWith('FC-') ? 'FC-' : golaPrefix;

  // Pattern: B3D27 → B3D{w}
  const m1 = stripped.match(/^(B\d*D)(\d+)/);
  if (m1) return `${prefix}${m1[1]}${wStr}`;

  // Pattern: B27-RT → B{w}-RT
  const m2 = stripped.match(/^(B)(\d+)-(.+)$/);
  if (m2) return `${prefix}${m2[1]}${wStr}-${m2[3]}`;

  // Pattern: B27 → B{w}
  const m3 = stripped.match(/^(B)(\d+)$/);
  if (m3) return `${prefix}${m3[1]}${wStr}`;

  // Pattern: SB36 → SB{w}
  const m4 = stripped.match(/^(SB)(\d+)/);
  if (m4) return `${prefix}${m4[1]}${wStr}${stripped.slice(m4[0].length)}`;

  // Fallback: replace first number group
  return `${prefix}${stripped.replace(/\d+/, wStr)}`;
}

/**
 * Validate an entire wall's filler situation.
 * Returns warnings for any filler > 3".
 *
 * @param {Array} cabinets - All cabinets on a wall (including fillers)
 * @param {number} wallLength - Total wall length
 * @returns {Array} Array of { severity, rule, message, fix }
 */
export function validateFillers(cabinets, wallLength) {
  const issues = [];
  const fillers = cabinets.filter(c => c.type === 'filler');

  for (const f of fillers) {
    if (f.width > MAX_FILLER) {
      issues.push({
        severity: 'error',
        rule: 'filler_too_wide',
        message: `Filler ${f.sku} is ${f.width}" wide — maximum is ${MAX_FILLER}"`,
        fix: `Redistribute ${f.width}" to adjacent cabinets using MOD WIDTH`,
      });
    }
  }

  // Check total filler percentage — should be < 5% of wall
  const totalFillerWidth = fillers.reduce((s, f) => s + (f.width || 0), 0);
  const fillerPct = (totalFillerWidth / wallLength) * 100;
  if (fillerPct > 5) {
    issues.push({
      severity: 'warning',
      rule: 'excessive_fillers',
      message: `Total fillers ${totalFillerWidth}" = ${fillerPct.toFixed(1)}% of wall — should be < 5%`,
      fix: 'Consider resizing cabinets to reduce filler usage',
    });
  }

  return issues;
}

/**
 * Post-process a wall layout to enforce the "never > 3" filler" rule.
 * Scans all fillers and redistributes oversized ones to adjacent cabinets.
 *
 * @param {Object} wallLayout - { wallId, wallLength, cabinets: [...] }
 * @param {string} golaPrefix - "FC-" or ""
 * @returns {Object} Updated wall layout with modified cabinets
 */
export function enforceFillerRule(wallLayout, golaPrefix = '') {
  const { cabinets } = wallLayout;
  const warnings = [];

  for (let i = 0; i < cabinets.length; i++) {
    const cab = cabinets[i];
    if (cab.type !== 'filler' || cab.width <= MAX_FILLER) continue;

    // Found an oversized filler — try to absorb into adjacent base cabinets
    const gap = cab.width;
    const left = i > 0 ? cabinets[i - 1] : null;
    const right = i < cabinets.length - 1 ? cabinets[i + 1] : null;

    const leftIsBase = left && left.type === 'base';
    const rightIsBase = right && right.type === 'base';

    if (leftIsBase && rightIsBase) {
      // Split between two adjacent cabinets
      const halfGap = gap / 2;
      for (const [adj, addW] of [[left, Math.ceil(halfGap)], [right, Math.floor(halfGap)]]) {
        const oldW = adj.width;
        const newW = oldW + addW;
        if (newW <= MAX_CAB_WIDTH) {
          const pctChange = addW / oldW;
          adj.width = newW;
          adj.sku = rebuildSku(adj.sku, newW, golaPrefix);
          adj.position_end = (adj.position_start || adj.position || 0) + newW;
          adj.modified = {
            type: pctChange <= MOD_FREE_PCT ? 'MOD WIDTH N/C' : 'MOD/SQ30',
            original: oldW, modified: newW,
          };
        }
      }
      // Remove the filler
      cabinets.splice(i, 1);
      i--; // re-check from same index
      warnings.push(`Absorbed ${gap}" filler into adjacent cabinets (split)`);
    } else if (leftIsBase || rightIsBase) {
      // Absorb into one adjacent cabinet
      const adj = leftIsBase ? left : right;
      const oldW = adj.width;
      const newW = oldW + gap;
      if (newW <= MAX_CAB_WIDTH) {
        const pctChange = gap / oldW;
        adj.width = newW;
        adj.sku = rebuildSku(adj.sku, newW, golaPrefix);
        adj.position_end = (adj.position_start || adj.position || 0) + newW;
        adj.modified = {
          type: pctChange <= MOD_FREE_PCT ? 'MOD WIDTH N/C' : 'MOD/SQ30',
          original: oldW, modified: newW,
        };
        cabinets.splice(i, 1);
        i--;
        warnings.push(`Absorbed ${gap}" filler into ${oldW}" cab → ${newW}" (${adj.modified.type})`);
      }
    } else {
      warnings.push(`Cannot absorb ${gap}" filler — no adjacent base cabinets`);
    }
  }

  // Recompute positions after modifications
  let pos = cabinets[0]?.position_start ?? cabinets[0]?.position ?? 0;
  for (const cab of cabinets) {
    cab.position = pos;
    cab.position_start = pos;
    cab.position_end = pos + (cab.width || 0);
    pos += cab.width || 0;
  }

  wallLayout._fillerWarnings = warnings;
  return wallLayout;
}
