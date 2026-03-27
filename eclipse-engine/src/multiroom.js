/**
 * Eclipse Cabinet Designer — Multi-Room Support
 * ================================================
 * Functions for solving and configuring multiple rooms in a single project.
 * Supports kitchen + butler's pantry + laundry or any combination of room types.
 *
 * Usage:
 *   import { solveMultiRoom, getMultiRoomSummary } from '@eclipse/engine';
 *
 *   const results = solveMultiRoom([
 *     { roomId: "kitchen", roomName: "Main Kitchen", ...roomInput },
 *     { roomId: "pantry", roomName: "Butler's Pantry", ...roomInput },
 *   ]);
 *
 *   const summary = getMultiRoomSummary(results);
 */

import { solve } from './solver.js';


// ─── MULTI-ROOM SOLVER ───────────────────────────────────────────────────────

/**
 * Solve multiple rooms in a single operation.
 * Each room is solved independently using the main solver.
 *
 * @param {Array<Object>} rooms - Array of room inputs
 *   Each item must have:
 *     - roomId {string} - Unique identifier for the room
 *     - roomName {string} - Display name (e.g., "Main Kitchen", "Butler's Pantry")
 *     - Plus all fields required by solve() (layoutType, walls, appliances, prefs, etc.)
 *
 * @returns {Object} Multi-room results
 */
export function solveMultiRoom(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return {
      rooms: [],
      summary: {
        totalRooms: 0, totalCabinets: 0, totalErrors: 0, totalWarnings: 0, roomBreakdown: [],
      },
    };
  }

  const results = [];
  let totalCabinets = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const roomBreakdown = [];

  for (const roomInput of rooms) {
    const { roomId, roomName, ...solveInput } = roomInput;
    const layout = solve(solveInput);
    const cabinetCount = layout.metadata?.totalCabinets || 0;
    const errorCount = layout.metadata?.errors || 0;
    const warningCount = layout.metadata?.warnings || 0;

    totalCabinets += cabinetCount;
    totalErrors += errorCount;
    totalWarnings += warningCount;

    results.push({ roomId, roomName, layout });
    roomBreakdown.push({ roomId, roomName, cabinetCount, errorCount, warningCount });
  }

  return {
    rooms: results,
    summary: { totalRooms: rooms.length, totalCabinets, totalErrors, totalWarnings, roomBreakdown },
  };
}


// ─── MULTI-ROOM SUMMARY GENERATOR ───────────────────────────────────────────

/**
 * Generate a project-level summary from multi-room results.
 */
export function getMultiRoomSummary(results) {
  if (!results || !results.rooms || results.rooms.length === 0) {
    return {
      totalPrice: 0, totalCabinets: 0, totalRooms: 0, roomPrices: [],
      sharedMaterials: {}, uniqueMaterials: {},
      validation: { inconsistentMaterials: false, recommendedActions: [] },
    };
  }

  const rooms = results.rooms || [];
  const totalPrice = results.combined?.projectTotal || 0;
  const totalCabinets = results.combined?.totalCabinets || 0;

  const roomPrices = [];
  const materialsByRoom = [];

  for (const room of rooms) {
    roomPrices.push({
      roomName: room.project?.name || "Unknown",
      price: room.pricing?.projectTotal || 0,
      cabinetCount: room.layout?.totalCabinets || 0,
    });
    materialsByRoom.push({
      roomName: room.project?.name || "Unknown",
      materials: room.materials || {},
    });
  }

  const sharedMaterials = {};
  const uniqueMaterials = {};
  let hasInconsistency = false;

  if (materialsByRoom.length > 0) {
    const firstMaterials = materialsByRoom[0].materials;
    const keyMaterialProps = ["species", "construction", "doorStyle"];

    for (const prop of keyMaterialProps) {
      const firstValue = firstMaterials[prop];
      let isShared = true;
      for (const room of materialsByRoom.slice(1)) {
        if (room.materials[prop] !== firstValue) { isShared = false; hasInconsistency = true; break; }
      }
      if (isShared && firstValue) sharedMaterials[prop] = firstValue;
    }

    for (let i = 0; i < materialsByRoom.length; i++) {
      const roomMaterials = materialsByRoom[i].materials;
      const uniqueForRoom = {};
      let hasUnique = false;
      for (const prop of keyMaterialProps) {
        if (roomMaterials[prop] !== sharedMaterials[prop]) { uniqueForRoom[prop] = roomMaterials[prop]; hasUnique = true; }
      }
      if (hasUnique) uniqueMaterials[materialsByRoom[i].roomName] = uniqueForRoom;
    }
  }

  const recommendedActions = [];
  if (hasInconsistency) recommendedActions.push("Consider standardizing door style across all rooms for cohesive design");
  if (totalCabinets > 100) recommendedActions.push("Large multi-room project: confirm material quantities with supplier");

  return {
    totalPrice: Math.round(totalPrice * 100) / 100,
    totalCabinets,
    totalRooms: rooms.length,
    roomPrices,
    sharedMaterials,
    uniqueMaterials,
    validation: { inconsistentMaterials: hasInconsistency, recommendedActions },
  };
}
