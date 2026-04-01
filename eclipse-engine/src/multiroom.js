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
 *   {
 *     rooms: [{ roomId, roomName, layout, metadata }],
 *     summary: {
 *       totalRooms: number,
 *       totalCabinets: number,
 *       totalErrors: number,
 *       totalWarnings: number,
 *       roomBreakdown: [{ roomId, roomName, cabinetCount, errorCount }]
 *     }
 *   }
 */
export function solveMultiRoom(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return {
      rooms: [],
      summary: {
        totalRooms: 0,
        totalCabinets: 0,
        totalErrors: 0,
        totalWarnings: 0,
        roomBreakdown: [],
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

    // Solve the room
    const layout = solve(solveInput);

    // Extract metadata
    const cabinetCount = layout.metadata?.totalCabinets || 0;
    const errorCount = layout.metadata?.errors || 0;
    const warningCount = layout.metadata?.warnings || 0;

    // Aggregate
    totalCabinets += cabinetCount;
    totalErrors += errorCount;
    totalWarnings += warningCount;

    results.push({
      roomId,
      roomName,
      layout,
    });

    roomBreakdown.push({
      roomId,
      roomName,
      cabinetCount,
      errorCount,
      warningCount,
    });
  }

  // ── Phase 4: Cross-room validation ──
  const crossRoomIssues = validateCrossRoom(results);

  return {
    rooms: results,
    summary: {
      totalRooms: rooms.length,
      totalCabinets,
      totalErrors,
      totalWarnings,
      roomBreakdown,
      crossRoomIssues,
    },
  };
}


// ─── PHASE 4: CROSS-ROOM VALIDATION ──────────────────────────────────────────
// Validates consistency across rooms in a multi-room project.
// Training data: Diehl ecosystem (kitchen + laundry + 2 baths) shares door style but varies species.
// Gable (kitchen + butler's pantry) keeps materials consistent.

function validateCrossRoom(roomResults) {
  const issues = [];
  if (roomResults.length < 2) return issues;

  // Detect material inconsistencies between adjacent rooms
  const materials = roomResults.map(r => ({
    roomName: r.roomName,
    isGola: r.layout.placements?.some(p => p.sku?.startsWith("FC-")),
    hasUppers: r.layout.uppers?.some(u => u.cabinets?.length > 0),
    cornerTypes: r.layout.corners?.map(c => c.type) || [],
    sophistication: r.layout._prefs?.sophistication || "standard",
  }));

  // Check for Gola mismatch (uncommon to mix Gola and non-Gola in same project)
  const golaRooms = materials.filter(m => m.isGola);
  const nonGolaRooms = materials.filter(m => !m.isGola);
  if (golaRooms.length > 0 && nonGolaRooms.length > 0) {
    issues.push({
      type: "gola_mismatch",
      severity: "warning",
      message: `Mixed Gola/non-Gola rooms: ${golaRooms.map(r => r.roomName).join(", ")} use Gola but ${nonGolaRooms.map(r => r.roomName).join(", ")} do not`,
    });
  }

  // Check for sophistication mismatch
  const sophLevels = [...new Set(materials.map(m => m.sophistication))];
  if (sophLevels.length > 1) {
    issues.push({
      type: "sophistication_mismatch",
      severity: "info",
      message: `Multiple sophistication levels: ${sophLevels.join(", ")}. Consider standardizing for visual cohesion.`,
    });
  }

  return issues;
}


// ─── PHASE 4: COMPANION PROJECT TEMPLATES ────────────────────────────────────
// Pre-configured multi-room project templates based on training data patterns.

export const COMPANION_TEMPLATES = {
  "diehl_suite": {
    name: "Full Home Suite (Diehl)",
    description: "Kitchen + Laundry + Bath — shared door style, varying species per room",
    rooms: [
      { roomId: "kitchen", roomName: "Main Kitchen", roomType: "kitchen", layoutType: "l-shape" },
      { roomId: "laundry", roomName: "Laundry Room", roomType: "laundry", layoutType: "single-wall" },
    ],
    defaultMaterials: { species: "Maple", construction: "Standard", door: "MET-V" },
    roomOverrides: { laundry: { species: "Maple" } }, // Can override per room
  },
  "gable_extended": {
    name: "Kitchen + Butler's Pantry (Gable)",
    description: "U-shape kitchen with butler's pantry — consistent materials throughout",
    rooms: [
      { roomId: "kitchen", roomName: "Main Kitchen", roomType: "kitchen", layoutType: "u-shape" },
      { roomId: "pantry", roomName: "Butler's Pantry", roomType: "utility", layoutType: "single-wall" },
    ],
    defaultMaterials: { species: "Cherry", construction: "Plywood", door: "MET-V" },
  },
  "entertainer": {
    name: "Entertainer's Suite",
    description: "Kitchen with island + bar area — great room open concept",
    rooms: [
      { roomId: "kitchen", roomName: "Main Kitchen", roomType: "kitchen", layoutType: "l-shape" },
      { roomId: "bar", roomName: "Bar/Beverage Center", roomType: "utility", layoutType: "single-wall" },
    ],
    defaultMaterials: { species: "Walnut", construction: "Plywood", door: "ESX-M" },
  },
};

export function listCompanionTemplates() {
  return Object.entries(COMPANION_TEMPLATES).map(([id, t]) => ({
    id, name: t.name, description: t.description, roomCount: t.rooms.length,
  }));
}


// ─── MULTI-ROOM SUMMARY GENERATOR ───────────────────────────────────────────

/**
 * Generate a project-level summary from multi-room results.
 * Includes total pricing, per-room breakdown, material consistency, cross-room validation.
 *
 * @param {Object} results - Output from configureMultiRoom (with pricing)
 *   Expected structure:
 *     {
 *       rooms: [quote1, quote2, ...],
 *       combined: { totalCabinets, projectTotal },
 *       project: { name, roomCount, ... }
 *     }
 *
 * @returns {Object} Summary with pricing and cross-room insights
 *   {
 *     totalPrice: number,
 *     totalCabinets: number,
 *     totalRooms: number,
 *     roomPrices: [{ roomName, price, cabinetCount }],
 *     sharedMaterials: { species, construction, doorStyle },
 *     uniqueMaterials: { roomId: { overriddenMaterial } },
 *     validation: {
 *       inconsistentMaterials: boolean,
 *       recommendedActions: [string]
 *     }
 *   }
 */
export function getMultiRoomSummary(results) {
  if (!results || !results.rooms || results.rooms.length === 0) {
    return {
      totalPrice: 0,
      totalCabinets: 0,
      totalRooms: 0,
      roomPrices: [],
      sharedMaterials: {},
      uniqueMaterials: {},
      validation: {
        inconsistentMaterials: false,
        recommendedActions: [],
      },
    };
  }

  const rooms = results.rooms || [];
  const totalPrice = results.combined?.projectTotal || 0;
  const totalCabinets = results.combined?.totalCabinets || 0;

  // Build per-room pricing breakdown
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

  // Detect shared vs unique materials
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
        if (room.materials[prop] !== firstValue) {
          isShared = false;
          hasInconsistency = true;
          break;
        }
      }

      if (isShared && firstValue) {
        sharedMaterials[prop] = firstValue;
      }
    }

    // Track per-room unique materials
    for (let i = 0; i < materialsByRoom.length; i++) {
      const roomMaterials = materialsByRoom[i].materials;
      const uniqueForRoom = {};
      let hasUnique = false;

      for (const prop of keyMaterialProps) {
        if (roomMaterials[prop] !== sharedMaterials[prop]) {
          uniqueForRoom[prop] = roomMaterials[prop];
          hasUnique = true;
        }
      }

      if (hasUnique) {
        uniqueMaterials[materialsByRoom[i].roomName] = uniqueForRoom;
      }
    }
  }

  // Generate recommendations
  const recommendedActions = [];
  if (hasInconsistency) {
    recommendedActions.push("Consider standardizing door style across all rooms for cohesive design");
  }
  if (totalCabinets > 100) {
    recommendedActions.push("Large multi-room project: confirm material quantities with supplier");
  }

  return {
    totalPrice: Math.round(totalPrice * 100) / 100,
    totalCabinets,
    totalRooms: rooms.length,
    roomPrices,
    sharedMaterials,
    uniqueMaterials,
    validation: {
      inconsistentMaterials: hasInconsistency,
      recommendedActions,
    },
  };
}
