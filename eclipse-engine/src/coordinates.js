/**
 * Eclipse Cabinet Designer â 3D Coordinate Assignment
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
  const { layoutType, walls = [] } = layoutResult;
  const config = {};

  if (layoutType === 'single-wall') {
    // Single wall at origin, running east
    if (walls[0]) {
      config[walls[0].id] = {
        origin: { x: 0, y: 0, z: 0 },
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
