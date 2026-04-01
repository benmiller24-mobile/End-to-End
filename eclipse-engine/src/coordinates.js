/**
 * Eclipse Cabinet Designer — 3D Coordinate Assignment
 * ====================================================
 * Assigns X/Y/Z placement coordinates to every cabinet for visualization export.
 *
 * Coordinate System:
 *   X-axis: horizontal along wall (varies by wall direction)
 *   Y-axis: vertical (0 = floor, increases upward)
 *   Z-axis: perpendicular to wall (0 = at wall face, increases into room)
 *
 * Wall Directions:
 *   "east":  wall runs along +X axis (positive X into room)
 *   "north": wall runs along +Z axis (positive Z into room)
 *   "west":  wall runs along -X axis (negative X into room)
 *   "south": wall runs along -Z axis (negative Z into room)
 */

import { DIMS } from './constraints.js';

/**
 * Assign 3D coordinates to all cabinet placements in a layout result.
 *
 * @param {Object} layoutResult - Result from solve()
 * @param {Object} [wallConfig] - Optional wall configuration mapping wall IDs to positions/directions
 * @returns {Array} Array of placements with coordinates assigned
 */
export function assignCoordinates(layoutResult, wallConfig) {
  const { walls = [], island, placements = [] } = layoutResult;

  // Auto-generate wall config if not provided
  const config = wallConfig || autoWallConfig(layoutResult);

  // Track running positions along each wall
  const wallPositions = {};
  for (const wall of walls) {
    wallPositions[wall.id] = 0;
  }

  const coordinatedPlacements = [];

  for (const placement of placements) {
    const wallId = placement.wall;

    if (!wallId) {
      coordinatedPlacements.push(placement);
      continue;
    }

    // Handle island and peninsula specially
    if (wallId.startsWith('island') || wallId === 'island-work' || wallId === 'island-back' || wallId === 'island-end') {
      const coords = assignIslandCoordinates(placement, island, config);
      coordinatedPlacements.push({ ...placement, coordinates: coords });
      continue;
    }

    if (wallId.includes('-') && !walls.find(w => w.id === wallId)) {
      // Corner placement (e.g., "A-B")
      const coords = assignCornerCoordinates(placement, wallId, config, walls);
      coordinatedPlacements.push({ ...placement, coordinates: coords });
      continue;
    }

    // Regular wall cabinet
    const wallCfg = config[wallId];
    if (!wallCfg) {
      coordinatedPlacements.push(placement);
      continue;
    }

    const wall = walls.find(w => w.id === wallId);
    const coords = assignWallCoordinates(placement, wall, wallCfg, wallPositions[wallId]);
    wallPositions[wallId] += placement.width || 0;

    coordinatedPlacements.push({ ...placement, coordinates: coords });
  }

  return coordinatedPlacements;
}

/**
 * Auto-generate wall configuration based on layout type.
 *
 * @param {Object} layoutResult - Result from solve()
 * @returns {Object} Wall configuration mapping
 */
export function autoWallConfig(layoutResult) {
  const { layoutType, walls: rawWalls = [] } = layoutResult;
  const config = {};
  // Normalize: solver output uses wallId/wallLength, input uses id/length
  const walls = rawWalls.map(w => ({
    id: w.id || w.wallId,
    length: w.length || w.wallLength || 120,
  }));

  if (layoutType === 'single-wall' || layoutType === 'single-wall-island') {
    // Single wall at origin, running east
    if (walls[0]) {
      config[walls[0].id] = {
        origin: { x: 0, y: 0, z: 0 },
        direction: 'east',
      };
    }
    // Island parallel to wall, centered, at standard walkway distance
    if (layoutType === 'single-wall-island') {
      config['island'] = {
        origin: { x: (walls[0]?.length || 120) * 0.15, y: 0, z: 42 },
        direction: 'east',
      };
    }
  } else if (layoutType === 'l-shape' && walls.length >= 2) {
    // Wall A east from origin, wall B north
    config[walls[0].id] = {
      origin: { x: 0, y: 0, z: 0 },
      direction: 'east',
    };
    config[walls[1].id] = {
      origin: { x: walls[0].length, y: 0, z: 0 },
      direction: 'north',
    };
  } else if (layoutType === 'u-shape' && walls.length >= 3) {
    // Wall A east from origin, wall B north, wall C west
    config[walls[0].id] = {
      origin: { x: 0, y: 0, z: 0 },
      direction: 'east',
    };
    config[walls[1].id] = {
      origin: { x: walls[0].length, y: 0, z: 0 },
      direction: 'north',
    };
    config[walls[2].id] = {
      origin: { x: walls[0].length, y: 0, z: walls[1].length },
      direction: 'west',
    };
  } else if (layoutType === 'g-shape' && walls.length >= 4) {
    // G-shape: U-shape + partial 4th wall (peninsula turn)
    // Wall A east, B north, C west, D south (partial)
    config[walls[0].id] = {
      origin: { x: 0, y: 0, z: 0 },
      direction: 'east',
    };
    config[walls[1].id] = {
      origin: { x: walls[0].length, y: 0, z: 0 },
      direction: 'north',
    };
    config[walls[2].id] = {
      origin: { x: walls[0].length, y: 0, z: walls[1].length },
      direction: 'west',
    };
    config[walls[3].id] = {
      origin: { x: 0, y: 0, z: walls[1].length },
      direction: 'south',
    };
  } else if (layoutType === 'galley' && walls.length >= 2) {
    // Two parallel walls, wall A at z=0, wall B at z=walkway
    const walkway = 42; // Standard galley walkway
    config[walls[0].id] = {
      origin: { x: 0, y: 0, z: 0 },
      direction: 'east',
    };
    config[walls[1].id] = {
      origin: { x: 0, y: 0, z: walkway },
      direction: 'east',
    };
  } else {
    // Fallback: arrange walls sequentially
    let xPos = 0;
    let zPos = 0;
    for (const wall of walls) {
      if (xPos === 0) {
        config[wall.id] = {
          origin: { x: 0, y: 0, z: 0 },
          direction: 'east',
        };
        xPos = wall.length;
      } else {
        config[wall.id] = {
          origin: { x: xPos, y: 0, z: 0 },
          direction: 'north',
        };
        zPos = wall.length;
      }
    }
  }

  return config;
}

/**
 * Calculate Y position based on cabinet type.
 *
 * @param {Object} placement - Cabinet placement
 * @returns {number} Y position in inches
 */
function getYPosition(placement) {
  const { type, role, sku } = placement;

  // Base cabinets sit on floor
  if (type === 'base' || role === 'base' || role === 'appliance') {
    return 0;
  }

  // Upper cabinets at standard height
  if (type === 'upper' || role === 'upper') {
    return DIMS.upperBottom;
  }

  // Tall cabinets from floor
  if (type === 'tall' || role === 'tall' || role === 'wine_cooler' || role === 'beverage_center') {
    return 0;
  }

  // Panels (REP) from floor
  if (role === 'rep' || (sku && sku.startsWith('REP'))) {
    return 0;
  }

  // Accessories - depends on type
  if (role === 'accessory' || role === 'toe-kick' || role === 'filler' || role === 'trim') {
    return 0;
  }

  // Default to base level
  return 0;
}

/**
 * Calculate height based on cabinet type.
 *
 * @param {Object} placement - Cabinet placement
 * @returns {number} Height in inches
 */
function getHeight(placement) {
  const { type, role, height, sku } = placement;

  // Use explicit height if provided
  if (height) return height;

  // Base cabinets standard height
  if (type === 'base' || role === 'base' || role === 'appliance') {
    return DIMS.baseHeight;
  }

  // Upper cabinets - vary by spec
  if (type === 'upper' || role === 'upper') {
    return 36; // Common upper height
  }

  // Tall cabinets - full height
  if (type === 'tall' || role === 'tall' || role === 'wine_cooler' || role === 'beverage_center') {
    return 96; // Standard ceiling height
  }

  // Toe kick
  if (role === 'toe-kick') {
    return DIMS.toeKickHeight;
  }

  // Panel height
  if (role === 'rep' || (sku && sku.startsWith('REP'))) {
    return 96; // Full height panel
  }

  return 0;
}

/**
 * Calculate depth based on cabinet type.
 *
 * @param {Object} placement - Cabinet placement
 * @returns {number} Depth in inches
 */
function getDepth(placement) {
  const { type, role, depth } = placement;

  if (depth) return depth;

  // Base cabinets
  if (type === 'base' || role === 'base' || role === 'appliance') {
    return DIMS.baseDepth;
  }

  // Upper cabinets
  if (type === 'upper' || role === 'upper') {
    return DIMS.upperDepth;
  }

  // Tall cabinets
  if (type === 'tall' || role === 'tall' || role === 'wine_cooler' || role === 'beverage_center') {
    return DIMS.baseDepth;
  }

  // Accessories
  if (role === 'accessory' || role === 'toe-kick' || role === 'rep') {
    return 0.5; // Minimal depth for accessories
  }

  return DIMS.baseDepth;
}

/**
 * Assign coordinates to a wall cabinet.
 *
 * @param {Object} placement - Cabinet placement
 * @param {Object} wall - Wall definition
 * @param {Object} wallCfg - Wall configuration (origin, direction)
 * @param {number} position - Running position along wall
 * @returns {Object} Coordinates object
 */
function assignWallCoordinates(placement, wall, wallCfg, position) {
  const { origin, direction } = wallCfg;
  const width = placement.width || 0;
  const height = getHeight(placement);
  const depth = getDepth(placement);
  const y = getYPosition(placement);

  let x, z, rotation;

  switch (direction) {
    case 'east':
      x = origin.x + position;
      z = origin.z;
      rotation = 0;
      break;
    case 'north':
      x = origin.x;
      z = origin.z + position;
      rotation = 90;
      break;
    case 'west':
      x = origin.x - position;
      z = origin.z;
      rotation = 180;
      break;
    case 'south':
      x = origin.x;
      z = origin.z - position;
      rotation = 270;
      break;
    default:
      x = origin.x + position;
      z = origin.z;
      rotation = 0;
  }

  // Calculate bounds and center
  let minX, maxX, minZ, maxZ;
  if (direction === 'east' || direction === 'west') {
    minX = Math.min(x, x + width);
    maxX = Math.max(x, x + width);
    minZ = z;
    maxZ = z + depth;
  } else {
    minX = x;
    maxX = x + depth;
    minZ = Math.min(z, z + width);
    maxZ = Math.max(z, z + width);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = y + height / 2;
  const centerZ = (minZ + maxZ) / 2;

  return {
    x: Math.round(minX * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(minZ * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    rotation,
    center: {
      x: Math.round(centerX * 100) / 100,
      y: Math.round(centerY * 100) / 100,
      z: Math.round(centerZ * 100) / 100,
    },
  };
}

/**
 * Assign coordinates to a corner cabinet.
 *
 * @param {Object} placement - Cabinet placement
 * @param {string} wallId - Corner identifier (e.g., "A-B")
 * @param {Object} config - Wall configuration
 * @param {Array} walls - Wall definitions
 * @returns {Object} Coordinates object
 */
function assignCornerCoordinates(placement, wallId, config, walls) {
  const [wallAId, wallBId] = wallId.split('-');
  const wallACfg = config[wallAId];
  const wallBCfg = config[wallBId];

  if (!wallACfg || !wallBCfg) {
    return {
      x: 0, y: 0, z: 0, width: 0, height: 0, depth: 0, rotation: 0,
      center: { x: 0, y: 0, z: 0 },
    };
  }

  // Place corner at the intersection of the two walls
  const wallA = walls.find(w => w.id === wallAId);
  const wallB = walls.find(w => w.id === wallBId);

  let x, z;
  const width = placement.width || 0;
  const height = getHeight(placement);
  const depth = getDepth(placement);
  const y = getYPosition(placement);

  // Determine corner position based on wall directions
  if (wallACfg.direction === 'east' && wallBCfg.direction === 'north') {
    x = wallACfg.origin.x + (wallA?.length || 0);
    z = wallBCfg.origin.z;
  } else if (wallACfg.direction === 'north' && wallBCfg.direction === 'west') {
    x = wallBCfg.origin.x - width;
    z = wallACfg.origin.z + (wallA?.length || 0);
  } else if (wallACfg.direction === 'west' && wallBCfg.direction === 'south') {
    x = wallBCfg.origin.x - width;
    z = wallBCfg.origin.z - (wallB?.length || 0);
  } else if (wallACfg.direction === 'south' && wallBCfg.direction === 'east') {
    x = wallACfg.origin.x;
    z = wallACfg.origin.z - (wallA?.length || 0);
  } else {
    x = wallACfg.origin.x + (wallA?.length || 0);
    z = wallBCfg.origin.z;
  }

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const centerZ = z + depth / 2;

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(z * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    rotation: 0,
    center: {
      x: Math.round(centerX * 100) / 100,
      y: Math.round(centerY * 100) / 100,
      z: Math.round(centerZ * 100) / 100,
    },
  };
}

/**
 * Assign coordinates to island/peninsula cabinets.
 *
 * @param {Object} placement - Cabinet placement
 * @param {Object} island - Island definition
 * @param {Object} config - Wall configuration
 * @returns {Object} Coordinates object
 */
function assignIslandCoordinates(placement, island, config) {
  // Island center position (simplified - assume center of room)
  const islandX = island?.x || 60;
  const islandZ = island?.z || 60;
  const width = placement.width || 0;
  const height = getHeight(placement);
  const depth = getDepth(placement);
  const y = getYPosition(placement);

  // Determine island side orientation
  let rotation = 0;
  if (placement.wall === 'island-back' || placement.wall === 'island-work') {
    rotation = 0;
  }

  const centerX = islandX + width / 2;
  const centerY = y + height / 2;
  const centerZ = islandZ + depth / 2;

  return {
    x: Math.round(islandX * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(islandZ * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    rotation,
    center: {
      x: Math.round(centerX * 100) / 100,
      y: Math.round(centerY * 100) / 100,
      z: Math.round(centerZ * 100) / 100,
    },
  };
}

/**
 * Export coordinated placements in a clean format for 3D visualization.
 *
 * @param {Array} coordinatedPlacements - Placements with coordinates assigned
 * @returns {Array} Clean visualization export format
 */
export function exportForVisualization(coordinatedPlacements) {
  return coordinatedPlacements.map((placement) => {
    const coords = placement.coordinates || {};
    const bounds = {
      min: {
        x: coords.x || 0,
        y: coords.y || 0,
        z: coords.z || 0,
      },
      max: {
        x: (coords.x || 0) + (coords.width || 0),
        y: (coords.y || 0) + (coords.height || 0),
        z: (coords.z || 0) + (coords.depth || 0),
      },
    };

    return {
      id: placement.id || `${placement.wall}_${Math.random().toString(36).substr(2, 9)}`,
      sku: placement.sku || 'UNKNOWN',
      type: placement.type || placement.role || 'cabinet',
      bounds,
      center: coords.center || {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: (bounds.min.y + bounds.max.y) / 2,
        z: (bounds.min.z + bounds.max.z) / 2,
      },
      rotation: coords.rotation || 0,
      wall: placement.wall || 'unknown',
      material: placement.material || 'Maple',
    };
  });
}

/**
 * Export a complete 2D overhead floor plan for rendering.
 * Produces wall outlines, cabinet footprints (top-down), appliance positions,
 * island/peninsula footprints, openings (doors/windows), and traffic flow arrows.
 *
 * Coordinate space: X = horizontal, Z = vertical (overhead view). Y is ignored (floor plane).
 *
 * @param {Object} layoutResult - Full result from solve()
 * @param {Object} [wallConfig] - Optional wall config (auto-generated if not provided)
 * @returns {Object} Floor plan data with layers for rendering
 */
export function exportFloorPlan(layoutResult, wallConfig) {
  const { layoutType, walls = [], island, peninsula, placements = [], validation = [] } = layoutResult;
  const config = wallConfig || autoWallConfig(layoutResult);

  // ── Wall outlines (structural shell) ──
  const wallOutlines = walls.map(wall => {
    const wId = wall.id || wall.wallId;
    const wc = config[wId];
    if (!wc) return null;
    const len = wall.length || wall.wallLength || 120;
    const thickness = 5; // 5" wall thickness for visual
    return wallRectFromConfig(wId, wc, len, thickness, wall.role || null, wall.partial || false);
  }).filter(Boolean);

  // ── Cabinet footprints (top-down rectangles) ──
  const cabinetFootprints = [];
  for (const p of placements) {
    const coords = p.coordinates;
    if (!coords) continue;
    const depth = coords.depth || (p.type === 'upper' || p.type === 'hutch' ? 13 : 24);
    const fp = {
      id: p.id || `${p.wall}_${p.sku}`,
      sku: p.sku,
      type: p.type || 'base',
      wall: p.wall,
      role: p.role || null,
      // Top-down rect: x/z plane
      x: coords.x || 0,
      z: coords.z || 0,
      width: coords.width || p.width || 0,
      depth,
      rotation: coords.rotation || 0,
      sitsOnCounter: p.sitsOnCounter || false,
      isHutch: p.type === 'hutch',
      zone: p._zone || null,
    };
    // Only include floor-level items in floor plan (bases, tall, appliances, island)
    // Skip uppers unless they're hutch (sit on counter and matter for footprint)
    if (p.type === 'upper' && !p.sitsOnCounter) continue;
    if (p.type === 'floating_shelf') continue;
    if (p.type === 'rangeHood') continue;
    cabinetFootprints.push(fp);
  }

  // ── Appliance footprints ──
  const applianceFootprints = [];
  for (const p of placements) {
    if (p.role !== 'appliance' && p.type !== 'appliance') continue;
    const coords = p.coordinates;
    if (!coords) continue;
    applianceFootprints.push({
      id: p.id || `app_${p.sku}`,
      sku: p.sku,
      applianceType: p.applianceType || p.type,
      x: coords.x || 0,
      z: coords.z || 0,
      width: coords.width || p.width || 0,
      depth: coords.depth || 24,
      rotation: coords.rotation || 0,
      wall: p.wall,
      doorSwingDirection: getSwingDirection(p),
    });
  }

  // ── Island / Peninsula footprint ──
  let islandFootprint = null;
  if (island && config['island']) {
    const ic = config['island'];
    const iLen = island.length || 72;
    const iDepth = island.depth || 39;
    islandFootprint = {
      x: ic.origin.x,
      z: ic.origin.z,
      width: iLen,
      depth: iDepth,
      hasSeating: !!island.seating,
      seatingOverhang: island.seatingOverhang || 12,
      seatingSide: island.seatingSide || 'back',
      seatingCapacity: island.seatingCapacity || 0,
    };
  }
  let peninsulaFootprint = null;
  if (peninsula && config['peninsula']) {
    const pc = config['peninsula'];
    peninsulaFootprint = {
      x: pc.origin.x,
      z: pc.origin.z,
      width: peninsula.length || 60,
      depth: peninsula.depth || 25,
      attachedTo: peninsula.attachedTo || null,
    };
  }

  // ── Openings (doors, windows, archways) ──
  const openings = [];
  for (const wall of walls) {
    if (!wall.openings) continue;
    const wc = config[wall.id];
    if (!wc) continue;
    for (const op of wall.openings) {
      const worldPos = localToWorld(op.posFromLeft || 0, 0, wc);
      openings.push({
        type: op.type, // 'door', 'window', 'entry', 'archway'
        wall: wall.id,
        x: worldPos.x,
        z: worldPos.z,
        width: op.width || 36,
        swingDirection: op.swingDirection || null,
        trafficLane: op.type === 'door' || op.type === 'entry' || op.type === 'archway',
      });
    }
  }

  // ── Traffic flow indicators ──
  const trafficArrows = buildTrafficArrows(walls, config, openings, islandFootprint);

  // ── Work triangle (sink → range → fridge) ──
  const workTriangle = buildWorkTriangle(placements);

  // ── Bounding box (overall room extents) ──
  const bbox = computeBoundingBox(wallOutlines, islandFootprint, peninsulaFootprint);

  return {
    layoutType,
    boundingBox: bbox,
    layers: {
      walls: wallOutlines,
      cabinets: cabinetFootprints,
      appliances: applianceFootprints,
      island: islandFootprint,
      peninsula: peninsulaFootprint,
      openings,
      trafficArrows,
      workTriangle,
    },
    validation: validation.map(v => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
    })),
  };
}

// ── Floor Plan Helpers ──

function wallRectFromConfig(wallId, wc, length, thickness, role, partial) {
  const dir = wc.direction;
  const ox = wc.origin.x;
  const oz = wc.origin.z;

  let x, z, w, d;
  if (dir === 'east' || dir === 'west') {
    x = dir === 'east' ? ox : ox - length;
    z = oz - thickness / 2;
    w = length;
    d = thickness;
  } else {
    // north or south
    x = ox - thickness / 2;
    z = dir === 'north' ? oz : oz - length;
    w = thickness;
    d = length;
  }

  return { id: wallId, x, z, width: w, depth: d, direction: dir, role, partial };
}

function localToWorld(localPos, localDepth, wc) {
  const dir = wc.direction;
  const ox = wc.origin.x;
  const oz = wc.origin.z;
  if (dir === 'east') return { x: ox + localPos, z: oz + localDepth };
  if (dir === 'west') return { x: ox - localPos, z: oz - localDepth };
  if (dir === 'north') return { x: ox - localDepth, z: oz + localPos };
  if (dir === 'south') return { x: ox + localDepth, z: oz - localPos };
  return { x: ox + localPos, z: oz + localDepth };
}

function getSwingDirection(placement) {
  const t = (placement.applianceType || placement.type || '').toLowerCase();
  if (t.includes('fridge') || t.includes('refrigerator')) return 'out'; // into room
  if (t.includes('oven')) return 'down'; // drops down
  if (t.includes('dishwasher') || t === 'dw') return 'down';
  return null;
}

function buildTrafficArrows(walls, config, openings, islandFootprint) {
  const arrows = [];
  // Draw flow arrows from each door/entry through the room
  for (const op of openings) {
    if (!op.trafficLane) continue;
    // Arrow from opening into the room center
    const targetX = islandFootprint
      ? islandFootprint.x + islandFootprint.width / 2
      : op.x + 36; // default 36" into room
    const targetZ = islandFootprint
      ? islandFootprint.z - 12
      : op.z + 36;
    arrows.push({
      from: { x: op.x, z: op.z },
      to: { x: targetX, z: targetZ },
      type: 'traffic_entry',
      doorWall: op.wall,
    });
  }
  return arrows;
}

function buildWorkTriangle(placements) {
  let sink = null, range = null, fridge = null;
  for (const p of placements) {
    const coords = p.coordinates;
    if (!coords) continue;
    const cx = (coords.x || 0) + (coords.width || 0) / 2;
    const cz = (coords.z || 0) + (coords.depth || 0) / 2;
    const t = (p.applianceType || p.type || p.role || '').toLowerCase();
    if ((t.includes('sink') || p.role === 'sink') && !sink) {
      sink = { x: cx, z: cz, label: 'Sink' };
    }
    if ((t.includes('range') || t.includes('cooktop') || p.role === 'range') && !range) {
      range = { x: cx, z: cz, label: 'Range' };
    }
    if ((t.includes('fridge') || t.includes('refrigerator') || p.role === 'refrigerator') && !fridge) {
      fridge = { x: cx, z: cz, label: 'Fridge' };
    }
  }
  if (!sink || !range || !fridge) return null;

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
  const sinkToRange = dist(sink, range);
  const rangeToFridge = dist(range, fridge);
  const fridgeToSink = dist(fridge, sink);
  const perimeter = sinkToRange + rangeToFridge + fridgeToSink;

  return {
    points: [sink, range, fridge],
    legs: [
      { from: 'Sink', to: 'Range', distance: Math.round(sinkToRange) },
      { from: 'Range', to: 'Fridge', distance: Math.round(rangeToFridge) },
      { from: 'Fridge', to: 'Sink', distance: Math.round(fridgeToSink) },
    ],
    perimeter: Math.round(perimeter),
    // NKBA guideline: triangle perimeter 12'-26' (144"-312")
    nkbaCompliant: perimeter >= 144 && perimeter <= 312,
  };
}

function computeBoundingBox(wallOutlines, islandFP, peninsulaFP) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const w of wallOutlines) {
    minX = Math.min(minX, w.x);
    minZ = Math.min(minZ, w.z);
    maxX = Math.max(maxX, w.x + w.width);
    maxZ = Math.max(maxZ, w.z + w.depth);
  }
  if (islandFP) {
    minX = Math.min(minX, islandFP.x);
    minZ = Math.min(minZ, islandFP.z);
    maxX = Math.max(maxX, islandFP.x + islandFP.width);
    maxZ = Math.max(maxZ, islandFP.z + islandFP.depth);
  }
  if (peninsulaFP) {
    minX = Math.min(minX, peninsulaFP.x);
    minZ = Math.min(minZ, peninsulaFP.z);
    maxX = Math.max(maxX, peninsulaFP.x + peninsulaFP.width);
    maxZ = Math.max(maxZ, peninsulaFP.z + peninsulaFP.depth);
  }
  // Add padding
  const pad = 12;
  return {
    min: { x: minX - pad, z: minZ - pad },
    max: { x: maxX + pad, z: maxZ + pad },
    width: (maxX - minX) + pad * 2,
    depth: (maxZ - minZ) + pad * 2,
  };
}
