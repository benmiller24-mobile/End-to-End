/**
 * Eclipse 3D Engine Bridge — Node.js ↔ Python OCP
 * ================================================
 * Calls the Python kitchen-3d-engine.py script via child_process,
 * passing solver placement data as JSON and receiving validated 3D
 * model data back.
 *
 * Usage:
 *   import { run3DValidation, build3DModel } from './engine-3d.js';
 *   const result = run3DValidation(placements, ceilingHeight);
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PYTHON_SCRIPT = join(__dirname, 'kitchen-3d-engine.py');

/**
 * Determine vertical mount position (yMount) from zone/context.
 */
function getYMount(cab) {
  // If _elev already assigned by solver, use it
  if (cab._elev && cab._elev.yMount != null) return cab._elev.yMount;

  const zone = cab._elev?.zone || cab.zone || classifyZone(cab);
  switch (zone) {
    case 'TOE_KICK':     return 0;
    case 'BASE':         return 4.5;
    case 'SINK_BASE':    return 4.5;
    case 'COUNTER':      return 34.5;
    case 'UPPER':        return 54;
    case 'ABOVE_TALL':   return 84;
    case 'TALL':         return 0;
    case 'CROWN':        return 84;
    default:             return 4.5;
  }
}

/**
 * Classify a cabinet into a vertical zone based on SKU/role.
 */
function classifyZone(cab) {
  const sku = (cab.sku || '').toUpperCase();
  const role = (cab.role || '').toLowerCase();

  if (role === 'tall' || role === 'pantry' || role === 'wine_cooler' || role === 'beverage_center') return 'TALL';
  if (role === 'upper' || role === 'wall' || role === 'upper_corner') return 'UPPER';
  if (/^RW/.test(sku)) return 'ABOVE_TALL';
  if (/^(W|WSC|WBC|WDC)/.test(sku)) return 'UPPER';
  if (/^(SW|UT)/.test(sku)) return 'TALL';
  if (/^(SB)/.test(sku)) return 'SINK_BASE';
  if (/^(B|DB|BL)/.test(sku)) return 'BASE';
  if (cab.type === 'refrigerator' || cab.type === 'freezer') return 'TALL';

  return 'BASE';
}

/**
 * Get depth for a cabinet based on zone/type.
 */
function getDepth(cab) {
  if (cab._elev?.depth) return cab._elev.depth;
  if (cab.depth) return cab.depth;

  const zone = cab._elev?.zone || classifyZone(cab);
  switch (zone) {
    case 'UPPER':       return 13;
    case 'ABOVE_TALL':  return 27;
    case 'TALL':        return 24;
    default:            return 24;
  }
}

/**
 * Get height for a cabinet.
 */
function getHeight(cab) {
  if (cab._elev?.height) return cab._elev.height;
  if (cab.height) return cab.height;

  const zone = classifyZone(cab);
  switch (zone) {
    case 'BASE':       return 30;
    case 'SINK_BASE':  return 30;
    case 'UPPER':      return 36;
    case 'TALL':       return 84;
    case 'ABOVE_TALL': return 12;
    default:           return 30;
  }
}

/**
 * Convert solver placements into the format the Python engine expects.
 */
function prepareCabinets(placements) {
  return placements
    .filter(p => p.sku && p.role !== 'accessory' && p.role !== 'filler')
    .map(p => {
      const zone = p._elev?.zone || classifyZone(p);
      return {
        name: `${p.wall || 'X'}-${p.sku}-${p.x || 0}`,
        sku: p.sku,
        wall: p.wall || 'A',
        x: p.x || 0,
        width: p.width || 36,
        height: p._elev?.height || getHeight(p),
        depth: p._elev?.depth || getDepth(p),
        yMount: p._elev?.yMount ?? getYMount(p),
        zone: zone,
        depthFromWall: p._elev?.depthSetback || 0,
      };
    });
}

/**
 * Run the Python 3D engine and return the result.
 * @param {Object} input - { ceilingHeight, cabinets: [...] }
 * @returns {Object} 3D model validation result
 */
function callPython3D(input) {
  try {
    const inputJson = JSON.stringify(input);
    const result = execSync(`python3 "${PYTHON_SCRIPT}"`, {
      input: inputJson,
      encoding: 'utf-8',
      timeout: 30000,  // 30 second timeout
      maxBuffer: 10 * 1024 * 1024,  // 10MB
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('[3D Engine] Python execution failed:', err.message);
    return {
      success: false,
      error: err.message,
      validation: { collisions: [], stacking: [], depth: [], all_issues: [], error_count: 0, warning_count: 0 },
      elevations: {},
      elevData: {},
    };
  }
}

/**
 * Run full 3D validation on solver placements.
 * @param {Array} placements - Solver output placements array
 * @param {number} ceilingHeight - Room ceiling height in inches (default 96)
 * @returns {Object} { success, validation, elevations, elevData, cabinets }
 */
export function run3DValidation(placements, ceilingHeight = 96) {
  const cabinets = prepareCabinets(placements);
  return callPython3D({ ceilingHeight, cabinets });
}

/**
 * Build complete 3D model from solver output (walls, uppers, talls, appliances).
 * This reads the same source objects the renderer uses and builds a comprehensive model.
 * @param {Object} solverOutput - Full solver return object
 * @returns {Object} 3D model data with elevations and validation
 */
export function build3DModel(solverOutput) {
  const ceilingHeight = solverOutput.metadata?.ceilingHeight || 96;
  const cabinets = [];

  /**
   * Get X position for a cabinet — solver uses `.position` (wall-relative),
   * not `.x`. Falls back to cumulative width if neither exists.
   */
  function getX(cab) {
    if (cab.position != null) return cab.position;
    if (cab.x != null && cab.x !== 0) return cab.x;
    return null;  // needs cumulative fallback
  }

  // Process wall layouts (base cabinets)
  if (solverOutput.walls) {
    for (const wall of solverOutput.walls) {
      const wallId = wall.wallId;
      const wallCabs = (wall.cabinets || []).filter(c => c.sku);
      let runX = 0;
      for (const cab of wallCabs) {
        const xPos = getX(cab) ?? runX;
        cabinets.push({
          name: `${wallId}-base-${cab.sku}-${xPos}`,
          sku: cab.sku,
          wall: wallId,
          x: xPos,
          width: cab.width || 36,
          height: cab._elev?.height || 30,
          depth: cab._elev?.depth || 24.875,
          yMount: cab._elev?.yMount ?? 4,
          zone: cab._elev?.zone || 'BASE',
          depthFromWall: cab._elev?.depthSetback || 0,
        });
        runX = xPos + (cab.width || 36);
      }
    }
  }

  // Process upper layouts
  if (solverOutput.uppers) {
    for (const upper of solverOutput.uppers) {
      const wallId = upper.wallId;
      const upperCabs = (upper.cabinets || []).filter(c => c.sku);
      let runX = 0;
      for (const cab of upperCabs) {
        const xPos = getX(cab) ?? runX;
        cabinets.push({
          name: `${wallId}-upper-${cab.sku}-${xPos}`,
          sku: cab.sku,
          wall: wallId,
          x: xPos,
          width: cab.width || 30,
          height: cab._elev?.height || cab.height || 36,
          depth: cab._elev?.depth || 13,
          yMount: cab._elev?.yMount ?? 54,
          zone: cab._elev?.zone || 'UPPER',
          depthFromWall: cab._elev?.depthSetback || 0,
        });
        runX = xPos + (cab.width || 30);
      }
    }
  }

  // Process talls (pantry, fridge, end panels, etc.)
  if (solverOutput.talls) {
    for (const tall of solverOutput.talls) {
      if (!tall.sku) continue;
      cabinets.push({
        name: `${tall.wall || 'X'}-tall-${tall.sku}-${tall.position || tall.x || 0}`,
        sku: tall.sku,
        wall: tall.wall || 'A',
        x: tall.position || tall.x || 0,
        width: tall.width || 36,
        height: tall._elev?.height || tall.height || 84,
        depth: tall._elev?.depth || 24,
        yMount: tall._elev?.yMount ?? 0,
        zone: tall._elev?.zone || 'TALL',
        depthFromWall: tall._elev?.depthSetback || 0,
      });
    }
  }

  // Deduplicate: same SKU at same position on same wall = same cabinet from two sources
  const seen = new Set();
  const deduped = cabinets.filter(c => {
    const key = `${c.wall}:${c.sku}:${c.x}:${c.yMount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return callPython3D({ ceilingHeight, cabinets: deduped });
}

/**
 * Merge 3D validation results back into solver validation array.
 * @param {Array} existingValidation - Current solver validation issues
 * @param {Object} result3D - Output from run3DValidation or build3DModel
 * @returns {Array} Combined validation array
 */
export function merge3DValidation(existingValidation, result3D) {
  if (!result3D.success || !result3D.validation) return existingValidation;

  const merged = [...existingValidation];
  for (const issue of result3D.validation.all_issues || []) {
    merged.push({
      severity: issue.severity || 'warning',
      rule: `3d_${issue.rule || 'unknown'}`,
      message: issue.message || 'Unknown 3D validation issue',
    });
  }
  return merged;
}

/**
 * Apply _elev data from 3D engine back to source cabinet objects.
 * This replaces the JS-only assignElevToSourceObjects() with OCP-verified positions.
 * @param {Object} solverOutput - Full solver return object
 * @param {Object} result3D - Output from build3DModel
 */
export function apply3DElevData(solverOutput, result3D) {
  if (!result3D.success || !result3D.elevData) return;

  const elevData = result3D.elevData;

  function findElevData(wallId, sku, x) {
    const key = `${wallId}:${sku}:${x}`;
    return elevData[key];
  }

  function applyElev(cab, data) {
    if (!data) return;
    cab._elev = {
      zone: data.zone,
      yMount: data.yMount,
      height: data.height,
      depth: data.depth,
      depthSetback: data.depthFromWall || 0,
      yTop: data.yMount + data.height,
    };
  }

  // Apply to wall layout cabinets
  if (solverOutput.walls) {
    for (const wall of solverOutput.walls) {
      let runX = 0;
      for (const cab of (wall.cabinets || [])) {
        const xPos = cab.position ?? cab.x ?? runX;
        applyElev(cab, findElevData(wall.wallId, cab.sku, xPos));
        runX = xPos + (cab.width || 36);
      }
    }
  }

  // Apply to upper layout cabinets
  if (solverOutput.uppers) {
    for (const upper of solverOutput.uppers) {
      let runX = 0;
      for (const cab of (upper.cabinets || [])) {
        const xPos = cab.position ?? cab.x ?? runX;
        applyElev(cab, findElevData(upper.wallId, cab.sku, xPos));
        runX = xPos + (cab.width || 30);
      }
    }
  }

  // Apply to talls
  if (solverOutput.talls) {
    for (const tall of solverOutput.talls) {
      applyElev(tall, findElevData(tall.wall || 'X', tall.sku, tall.position || tall.x || 0));
    }
  }
}
