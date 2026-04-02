/**
 * Eclipse Cabinet Designer — Layout Solver
 * ==========================================
 * Takes room dimensions, appliance selections, and design preferences.
 * Generates a complete cabinet layout as structured placement data.
 *
 * Supports multiple room types: kitchen, office, laundry, master_bath,
 * vanity, utility, and showroom — each with context-aware rules.
 *
 * Solver strategy (constraint-first, pattern-matched):
 *   1. Place fixed points (appliances) per NKBA landing rules (kitchen only)
 *   2. Resolve corners based on layout type and wall lengths
 *   3. Fill remaining segments using zone-aware cabinet selection
 *   3b. Solve peninsula if present (columns, shelf, end panels)
 *   4. Generate matching upper cabinets (context-dependent by room type)
 *   5. Add accessories (panels, fillers, trim, toe kick) — room-type-aware
 *   6. Validate against Layer 2 rules (NKBA skipped for non-kitchen rooms)
 *
 * The output is an array of placement objects ready for the pricing engine.
 */

import {
  DIMS, STD_BASE_WIDTHS, STD_UPPER_WIDTHS, STD_UPPER_HEIGHTS,
  STD_VANITY_WIDTHS, ROOM_TYPES, CABINET_TYPES,
  LANDING, ADJACENCY, UPPER_RULES, ISLAND_RULES, FILLER_RULES,
  CORNER_RULES, ZONE_CABINET_PRIORITY, MATERIAL_SPLIT,
  PENINSULA_RULES, TRIM_ACCESSORIES, WIDTH_MOD_RULES,
  CLEARANCE, HUTCH_RULES, BIG_FOUR, TRAFFIC_FLOW,
  fillSegment, validateLayout,
} from './constraints.js';

import {
  RANGE_PATTERNS, SINK_PATTERNS, FRIDGE_PATTERNS,
  ISLAND_PATTERNS, TALL_PATTERNS, UPPER_PATTERNS,
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  VANITY_PATTERNS, UTILITY_PATTERNS,
  ACCESSORY_RULES,
  GOLA_PATTERNS, COMPARISON_PRICING_PATTERNS,
  DOOR_LAYOUT_COMPAT,
  HUTCH_PATTERNS,
} from './patterns.js';

import {
  CORNER_TREATMENTS, selectCornerTreatment as selectCornerFromTraining,
  SINK_ZONE_RULES, RANGE_ZONE_RULES, FRIDGE_POD_RULES,
  ISLAND_RULES_EXTENDED, UPPER_SIZING_RULES,
  FILLER_MOD_RULES, MATERIAL_SPEC_RULES,
  PENINSULA_ZONE_RULES,
} from './zone-patterns.js';

import {
  assignCoordinates, autoWallConfig, exportForVisualization,
} from './coordinates.js';

import {
  buildSpatialModel, VERTICAL_ZONES, DEPTH_TIERS,
  getZoneAtHeight, getDepthTier, validatePlacement,
  composeElevation, calculateElevationBalance,
  validate3DSpatial,
} from './spatial-model.js';

import {
  build3DModel, merge3DValidation, apply3DElevData,
} from './engine-3d.js';

import {
  validateChain as linearValidateChain,
  validateNKBA as linearValidateNKBA,
  decomposeToStandardWidths,
} from './linear-stacker.js';

import {
  validateSpatialLayout,
  computeCornerAnchors,
  buildMoldingPathSegments,
} from './spatial-validator.js';

import {
  enforceFillerRule,
  validateFillers,
} from './filler-resize-logic.js';

import {
  ECLIPSE_DOOR_STYLES,
  styleLogicBridge,
  getDoorGeometry,
} from './eclipse-door-styles.js';

import {
  generateToeKickRuns,
  validateToeKick,
  TOE_KICK_CONSTANTS,
} from './toe-kick-logic.js';

import {
  generateServiceZones,
  validateServiceAccess,
} from './service-zones.js';

import {
  calculateSwingArcs,
  validateAllSwings,
  SWING_ARC_SPECS,
} from './collision-detection.js';

import {
  generateMountingRails,
  RAIL_CONSTANTS,
} from './mounting-rail.js';

import {
  generateLightingPlan,
  calculateLEDRequirements,
  LIGHTING_CONSTANTS,
} from './lighting-automation.js';

import {
  applyScribeTolerance,
  SCRIBE_CONSTANTS,
} from './scribe-tolerance.js';

import {
  solveIslandPlacement,
  calculateNoFlyZone,
  calculateIslandClearances,
  ISLAND_CONSTANTS,
} from './island-solver.js';

import {
  calculateSeatingLayout,
  SEATING_CONSTANTS,
} from './seating-overhang.js';

import {
  validateNKBA,
  generateOutletPlan,
  validateWorkTriangle,
  NKBA_STANDARDS,
} from './nkba-validation.js';

import {
  generatePartIds,
  generateBOM,
  PART_ID_CONSTANTS,
} from './part-id-generator.js';

import {
  CabinetRun,
  buildCabinetRuns,
  validateRuns,
  resolveOverflows,
  ANCHOR_TYPES,
} from './constraint-propagation.js';

import {
  generateEnvelopes,
  runCollisionCheck,
  validateWalkways,
  CLEARANCE_SPECS,
} from './functional-envelopes.js';

import {
  applyFinishingRules,
  visibilityCheck,
  solveFillers,
  enforceSymmetry,
  validateReveals,
  FINISHING_CONSTANTS,
} from './finishing-rules.js';

import {
  morphStyle,
  extrudeMoldingProfile,
  extrudeLightRailProfile,
  calculateFinishMetrics,
  applyDesignPreset,
  STYLE_GEOMETRY,
  MOLDING_PROFILES,
  DESIGN_PRESETS,
} from './style-morphing.js';

import {
  solveRoomExpert,
  analyzeRoom,
  solveWorkTriangle as solveWorkTriangleExpert,
  DESIGN_HIERARCHY,
  ECLIPSE_STANDARD_WIDTHS,
} from './expert-design-workflow.js';

import {
  detectCommonLines,
  alignUppersToBase,
  scoreAlignment,
  centerUpperRun,
  exportAlignmentGrid,
} from './vertical-alignment.js';

import {
  runProfessionalAudit,
  AUDIT_WEIGHTS,
} from './professional-audit.js';

import {
  snapToNeighbor,
  snapToGrid,
  buildCabinetIntelligence,
  insertWithCollisionCheck,
  resolveApplianceFirst,
  analyzeGaps,
  PLACEMENT_ORDER,
  SNAP_CONSTANTS,
} from './snap-collision.js';


// ─── PROFESSIONAL DESIGN PATTERNS (from training data) ──────────────────────
// Extracted from 47 real kitchen projects (Bollini, Spector, Owen, Huang, etc.)

const PRO_DESIGN = {
  // Stacked wall cabinets replace separate upper+base for high/transitional kitchens
  stackedWalls: {
    skuPattern: (width, height, depth) => `SW${width}${height}(${depth})`,
    defaultHeight: 63,  // most common in training
    defaultDepth: 21,   // most common (13" deep would be standard wall depth)
    commonWidths: [16.5, 18, 21, 24, 27, 30, 33, 36],
    typicalMods: ['RBS', 'GFD', 'FINISHED INT'],
    // Used in: Bollini (6x SW3363), Spector (UT3393 utility tower)
  },

  // Refrigerator wall cabinets (27" deep to match fridge depth)
  fridgeWallCabs: {
    skuPattern: (width, height, depth) => `RW${width}${height}-${depth}`,
    aboveFridge: { width: 36, height: 21, depth: 27 }, // RW3621-27
    besideFridge: { width: 30, height: 33, depth: 27 }, // RW3033-27
    // Used in: Bollini (RW3633-27, RW3021-27), Spector (RW3021, RW3621)
  },

  // Base cabinet types by zone (from training frequency analysis)
  basesByZone: {
    rangeFlanking: [
      { sku: 'B-RT', desc: 'Base w/ Roll Out Trays', freq: 4, typicalWidths: [22, 24, 27, 33] },
      { sku: 'B3D', desc: '3-Drawer Base', freq: 5, typicalWidths: [27, 33, 38] },
      { sku: 'B2HD', desc: '2-Drawer Heavy Duty Base', freq: 2, typicalWidths: [36] },
    ],
    sinkAdjacent: [
      { sku: 'BWDMB', desc: 'Door Mount Waste Base', freq: 3, typicalWidths: [18] },
      { sku: 'B4D', desc: '4-Drawer Base', freq: 2, typicalWidths: [18, 21] },
      { sku: 'BTD', desc: 'Base Tray Divider', freq: 2, typicalWidths: [9] },
    ],
    fridgeAdjacent: [
      { sku: 'B3D', desc: '3-Drawer Base', freq: 3, typicalWidths: [27, 33] },
      { sku: 'B-RT', desc: 'Base w/ Roll Out Trays', freq: 2, typicalWidths: [24, 27] },
    ],
    general: [
      { sku: 'B3D', desc: '3-Drawer Base', freq: 8, typicalWidths: [27, 33, 38] },
      { sku: 'B-FHD', desc: 'Base Full Height Door', freq: 3, typicalWidths: [36, 37] },
      { sku: 'BPOS', desc: '4-Tier Pull Out Shelf', freq: 2, typicalWidths: [9] },
    ],
  },

  // Specialty narrow cabinets to fill 9" gaps (instead of fillers)
  narrowSpecialty: [
    { sku: 'BKI-9', desc: 'Base Knife Insert', width: 9, price: 1510 },
    { sku: 'BPOS-9', desc: '4-Tier Pull Out Shelf', width: 9, price: 953 },
    { sku: 'BTD-9', desc: 'Chrome Tray Divider', width: 9, price: 983 },
    { sku: 'BKI-6', desc: 'Base Knife Insert', width: 6, price: 1200 },
  ],

  // Corner treatments by sophistication
  cornerByLevel: {
    high: { sku: 'BBC48R-MC', desc: 'Blind Corner w/ Magic Corner', width: 48, wallConsumption: 48 },
    transitional: { sku: 'BBC42', desc: 'Base Blind Corner', width: 42, wallConsumption: 42 },
    standard: { sku: 'BL36-SS-PH', desc: 'Lazy Susan', width: 36, wallConsumption: 36 },
  },

  // End panels - EVERY exposed end gets a panel
  endPanels: {
    wallFlush: (height, side) => ({ sku: `FWEP3/4-L/R-${height}"`, desc: 'Wall Flush End Panel', height }),
    refEnd: (height, width, side) => ({ sku: `REP3/4 ${height}FTK-${width}${side}`, desc: 'Refrig End Panel', height, width }),
    baseEnd: (side) => ({ sku: `BEP3/4-FTK-L/R`, desc: 'Base End Panel', side }),
    baseEndHalf: (side) => ({ sku: `BEP1 1/2${side}-FTK`, desc: 'Base End Panel 1.5"', side }),
  },

  // Sink base types
  sinkBases: {
    fullHeightDoor: { sku: 'SB-FHD', desc: 'Sink Base Full Height Door', typicalWidths: [30, 33, 36] },
    standard: { sku: 'SB', desc: 'Sink Base', typicalWidths: [30, 33, 36] },
    apronFront: { sku: 'SBA', desc: 'Sink Base Apron', typicalWidths: [30, 33, 36] },
  },

  // Modification codes
  mods: {
    glassFrameDoor: 'GFD',
    finishedInterior: 'FINISHED INT',
    recessedBottomShelf: 'RBS',
    rollOutTray: 'ROT',
    fegGuides: 'FEG GUIDES = 90LB DYNAMIC/100# STATIC LOAD',
    heavyDutyGuides: 'GUIDES = 125LB DYNAMIC LOAD',
    subDrawerFront: 'SUB DRW FRONT',
    modWidth: (newWidth) => `MOD WIDTH N/C|${newWidth}`,
    fullHeightDoor: 'FHD',
  },
};


// ─── INPUT SCHEMA ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} RoomInput
 * @property {string} layoutType - "l-shape" | "u-shape" | "galley" | "single-wall" | "single-wall-island" | "g-shape" | "galley-peninsula"
 * @property {string} [roomType] - "kitchen" | "office" | "laundry" | "master_bath" | "vanity" | "utility" | "showroom"
 * @property {WallInput[]} walls - Array of wall definitions
 * @property {IslandInput} [island] - Optional island definition
 * @property {Object} [peninsula] - Optional peninsula definition
 * @property {ApplianceInput[]} appliances - Appliance selections
 * @property {DesignPrefs} prefs - Design preferences
 */

/**
 * @typedef {Object} WallInput
 * @property {string} id - Wall identifier ("A", "B", "C", etc.)
 * @property {number} length - Wall length in inches
 * @property {number} [ceilingHeight] - Ceiling height (default 96)
 * @property {Opening[]} [openings] - Windows, doors, etc.
 * @property {string} [role] - "range" | "sink" | "fridge" | "pantry" | "general" | "breakfast_nook" | "desk" | "butler_pantry" | "wet_bar" | "coffee_bar"
 * @property {boolean} [partial] - True if wall is partial/open-end (open-plan kitchens)
 * @property {number} [partialHeight] - Height of partial wall (e.g., 42" pony wall)
 */

/**
 * @typedef {Object} ApplianceInput
 * @property {string} type - "range" | "cooktop" | "sink" | "dishwasher" | "refrigerator" | "freezer" | "wallOven" | "speedOven" | "steamOven" | "microwave" | "hood" | "wineCooler" | "wineColumn" | "beverageCenter" | "warmingDrawer" | "iceMaker"
 * @property {number} width - Appliance width in inches
 * @property {string} wall - Wall ID or "island"
 * @property {string} [model] - Model number
 * @property {string} [brand] - Brand name
 * @property {string} [position] - "center" | "left" | "right" | "end" | number (inches from left)
 */

/**
 * @typedef {Object} DesignPrefs
 * @property {string} [cornerTreatment] - "lazySusan" | "blindCorner" | "auto"
 * @property {string} [upperApproach] - "standard" | "floating_shelves" | "minimal" | "none" | "stacked" | "hutch" | "mixed_hutch"
 * @property {boolean} [preferDrawerBases] - Default true — use B3D/B4D over standard B
 * @property {boolean} [preferSymmetry] - Default true for range walls
 * @property {boolean} [golaChannel] - Use FC- GOLA channel cabinets
 * @property {string} [islandBackStyle] - "fhd_seating" | "loose_doors" | "panels" | "open"
 * @property {string} [sophistication] - "standard" | "high" | "very_high"
 */


// ─── MAIN SOLVER ────────────────────────────────────────────────────────────

/**
 * Generate a complete kitchen layout from room specifications.
 *
 * @param {RoomInput} input - Room dimensions, appliances, and preferences
 * @returns {LayoutResult} Complete layout with placements, validation, and metadata
 */
export function solve(input) {
  const { walls, island, peninsula, appliances = [], prefs = {} } = input;
  const layoutType = input.layoutType || inferLayoutType(walls, !!peninsula, !!island);
  const roomType = input.roomType || "kitchen";
  const roomDef = ROOM_TYPES[roomType] || ROOM_TYPES.kitchen;
  const golaPrefix = prefs.golaChannel ? "FC-" : "";

  // Normalize preferences — room type can influence defaults
  const pf = {
    cornerTreatment: prefs.cornerTreatment || "auto",
    upperApproach: prefs.upperApproach || (roomDef.appliancesRequired ? "standard" : "minimal"),
    preferDrawerBases: prefs.preferDrawerBases !== false,
    preferSymmetry: prefs.preferSymmetry !== false,
    golaChannel: !!prefs.golaChannel,
    islandBackStyle: prefs.islandBackStyle || "fhd_seating",
    sophistication: prefs.sophistication || "high",
    sinkStyle: prefs.sinkStyle || null,
    seatingStyle: prefs.seatingStyle || "bar",
    bracketStyle: prefs.bracketStyle || "SS",
    material: prefs.material || "Maple",
    twoTone: prefs.twoTone || null,
    // ── Ceiling treatment / molding preference (from Moldings & Fillers Guide) ──
    // "crown"      — Crown molding bridges gap between upper top and ceiling (default)
    // "to_ceiling" — Cabinets extend to ceiling (no gap, no crown)
    // "none"       — No crown, exposed cabinet top (modern/minimal)
    ceilingTreatment: prefs.ceilingTreatment || "crown",
    crownMoulding: prefs.crownMoulding,
    crownStyle: prefs.crownStyle || "standard",
    lightRail: prefs.lightRail,
    lightRailProfile: prefs.lightRailProfile,
    lightBridge: prefs.lightBridge,
    glassStyle: prefs.glassStyle || "clear",
    mullionStyle: prefs.mullionStyle || "standard",
    garageDoorStyle: prefs.garageDoorStyle || "standard",
    valanceStyle: prefs.valanceStyle || "straight",
    toeKickStyle: prefs.toeKickStyle || "standard",
    coolerStyle: prefs.coolerStyle || "integrated",
    appliedMolding: prefs.appliedMolding,
    baseShoe: prefs.baseShoe,
    counterMouldProfile: prefs.counterMouldProfile,
    lightingPackage: prefs.lightingPackage || "none",
    lightingZones: prefs.lightingZones || {},
    coordinates: !!prefs.coordinates,
    wallConfig: prefs.wallConfig || null,
    roomType,
    roomDef,
    _layoutType: layoutType,  // expose layout type for work-triangle-aware positioning
    // ── Hutch preferences ──
    hutchDoorStyle: prefs.hutchDoorStyle || "pocket",
    hutchZones: prefs.hutchZones || null,
    hutchLighting: prefs.hutchLighting !== false,
    hutchGlass: !!prefs.hutchGlass,
    // ── Appliance panel preferences (from Built-In Refrigerator Design Guide) ──
    // "paneled" — 3/4" overlay panels matching cabinetry (panel-ready)
    // "exposed" — stainless steel / manufacturer finish visible
    fridgePaneled: prefs.fridgePaneled !== false, // default: paneled
    dwPaneled: prefs.dwPaneled !== false,         // default: paneled
    // Integration level for panel-ready fridge:
    // "overlay" — panels protrude 1-2" proud, 24" enclosure depth (most common)
    // "flush"   — flush inset, 25-27" enclosure depth (true European integrated)
    fridgeIntegration: prefs.fridgeIntegration || "overlay",
  };

  // ── Gola/Handleless Channel enforcement ──
  // When golaChannel is true, enforce design rules from GOLA_PATTERNS
  if (pf.golaChannel && GOLA_PATTERNS) {
    // Gola kitchens: no wall cabs, no mouldings, B2TD dominance
    if (pf.upperApproach === "standard") pf.upperApproach = "none";
    pf.crownMoulding = false;
    pf.lightRail = false;
    pf.preferDrawerBases = true;
    pf._golaB2TDDominance = true;  // signal to fillWallSegment for B2TD preference
    pf._golaDishwasherPanel = true; // signal to accessories for DP generation
  }

  // ── Auto-assign appliances to walls when wall property is missing ──
  // Two-pass: first assign primary appliances (range, sink, fridge),
  // then assign secondary (DW, hood) that depend on the primaries.
  // NKBA work triangle: range and sink on different walls for L/U shapes.
  const assignedAppliances = appliances.map(a => a.wall ? { ...a } : { ...a, wall: null });

  if (walls.length >= 1) {
    const sorted = [...walls].sort((a, b) => b.length - a.length);
    const primary = sorted[0]; // longest wall → range
    const secondary = sorted.length > 1 ? sorted[1] : sorted[0]; // second → sink
    const wallWithWindow = walls.find(w => w.openings?.some(o => o.type === "window"));

    // Pass 1: Assign primary appliances (range, sink, fridge)
    for (const app of assignedAppliances) {
      if (app.wall) continue;
      const type = app.type;
      if (type === "range" || type === "cooktop") {
        app.wall = primary.id;
      } else if (type === "sink") {
        app.wall = wallWithWindow ? wallWithWindow.id : secondary.id;
      } else if (type === "refrigerator" || type === "freezer" || type === "wineColumn") {
        // Fridge at end of primary wall (range wall) — common in L-shapes
        app.wall = primary.id;
      }
    }

    // Pass 2: Assign dependent appliances (DW follows sink, hood follows range)
    const sinkWall = assignedAppliances.find(a => a.type === "sink")?.wall || secondary.id;
    const rangeWall = assignedAppliances.find(a => a.type === "range" || a.type === "cooktop")?.wall || primary.id;

    for (const app of assignedAppliances) {
      if (app.wall) continue;
      const type = app.type;
      if (type === "dishwasher") {
        app.wall = sinkWall; // DW must be on same wall as sink
      } else if (type === "hood") {
        app.wall = rangeWall; // Hood above range
      } else if (type === "wallOven" || type === "speedOven" || type === "steamOven") {
        app.wall = primary.id;
      } else {
        // Default: put on primary wall
        app.wall = primary.id;
      }
    }
  }

  // Build appliance lookup
  const appByWall = {};
  const appByType = {};
  for (const app of assignedAppliances) {
    if (!appByWall[app.wall]) appByWall[app.wall] = [];
    appByWall[app.wall].push(app);
    appByType[app.type] = app;
  }

  // Phase 1: Resolve corners (skip for single-wall rooms like vanity)
  const corners = resolveCorners(walls, layoutType, pf);

  // ── Build 3D Spatial Model ──
  // Creates the vertical zone + depth tier framework that the solver uses
  // for elevation-aware decisions and the renderer uses for accurate drawing.
  const spatialModel = buildSpatialModel(
    walls,
    assignedAppliances,
    corners.map(c => ({ wall1: c.wallA, wall2: c.wallB, consumption: c.wallAConsumption || c.size || 3 })),
    { ceilingHeight: walls[0]?.ceilingHeight || DIMS.standardCeiling, roomType }
  );

  // Phase 2: Generate wall layouts (room-type-aware)
  // If a DSB diagonal sink corner exists, the sink is handled at the corner —
  // filter it out of the wall appliance list so no duplicate sink base is generated.
  const dsbCorners = corners.filter(c => c.type === "diagonalSink");
  const dsbWallIds = new Set();
  for (const dc of dsbCorners) {
    dsbWallIds.add(dc.wallA);
    dsbWallIds.add(dc.wallB);
  }

  const wallLayouts = [];
  for (const wall of walls) {
    let wallAppliances = appByWall[wall.id] || [];
    // Strip sink from walls that share a DSB corner (sink lives in the DSB)
    if (dsbWallIds.has(wall.id)) {
      wallAppliances = wallAppliances.filter(a => a.type !== "sink");
    }
    const wallCorners = corners.filter(c => c.wallA === wall.id || c.wallB === wall.id);
    const layout = solveWall(wall, wallAppliances, wallCorners, pf, golaPrefix);
    wallLayouts.push(layout);
  }

  // ── Propagate solved positions back to appByWall ──
  // positionAppliances() sets positions on new objects inside solveWall, but
  // appByWall still references the original unpositioned appliance objects.
  // solveUppers() needs accurate positions to place hoods above ranges and
  // build correct skip zones.  Sync them here.
  for (const wl of wallLayouts) {
    const positionedApps = wl.cabinets.filter(c => c.type === "appliance");
    const wallApps = appByWall[wl.wallId] || [];
    for (const pa of positionedApps) {
      const orig = wallApps.find(a => a.type === pa.applianceType && a.model === pa.model);
      if (orig) {
        orig.position = pa.position;
        orig._depth = pa._depth;
        orig._depthOverhang = pa._depthOverhang;
      }
    }
  }

  // Phase 3: Generate island layout
  let islandLayout = null;
  if (island) {
    const islandAppliances = appByWall["island"] || [];
    islandLayout = solveIsland(island, islandAppliances, pf, golaPrefix);
  }

  // Phase 3b: Generate peninsula layout
  let peninsulaLayout = null;
  if (peninsula) {
    peninsulaLayout = solvePeninsula(peninsula, pf, golaPrefix);
  }

  // Phase 4: Generate upper cabinets (skip for non-kitchen rooms that don't use uppers)
  const upperLayouts = [];
  if (pf.upperApproach !== "none") {
    for (const wl of wallLayouts) {
      const wallDef = walls.find(w => w.id === wl.wallId);
      const wallAppliances = appByWall[wallDef.id] || [];
      const uppers = solveUppers(wl, wallDef, wallAppliances, pf);
      upperLayouts.push(uppers);
    }
  }

  // Phase 4b: Generate upper corner cabinets (WSC pairs + SA angle transitions)
  const upperCorners = pf.upperApproach !== "none" ? solveUpperCorners(corners, upperLayouts, pf, walls) : [];

  // Phase 4c: Generate tall cabinets (oven towers, pantry towers)
  // Use assignedAppliances (with wall property set) so solveTalls can
  // correctly determine which walls have major appliances.
  const talls = solveTalls(assignedAppliances, walls, pf, golaPrefix);

  // ── Assign positions to tall cabinets ──
  // Talls don't know where wall layouts placed appliances, so we resolve
  // positions here using wallLayout results and the appByWall lookup.
  //
  // Helper: find the fridge in any wall's positioned appliances
  const positionedFridge = assignedAppliances.find(
    a => a.type === "refrigerator" && typeof a.position === "number"
  );

  for (let ti = talls.length - 1; ti >= 0; ti--) {
    const tall = talls[ti];
    if (typeof tall.position === "number") continue; // already positioned

    if (tall.role === "fridge_panel" || tall.role === "fridge_wall_cab") {
      // Position relative to the fridge appliance
      const fridge = positionedFridge;
      if (fridge) {
        if (tall.role === "fridge_panel" && tall.side === "left") {
          tall.position = Math.max(0, fridge.position - tall.width);
        } else if (tall.role === "fridge_panel" && tall.side === "right") {
          tall.position = fridge.position + (fridge.width || 36);
        } else if (tall.role === "fridge_wall_cab") {
          tall.position = fridge.position;
        }
        // Reassign to fridge's actual wall if tall.wall was a virtual "fridge" wall
        if (!walls.find(w => w.id === tall.wall)) {
          tall.wall = fridge.wall;
        }
      }
    } else if (tall.role === "pantry_tower" || tall.role === "oven_tower") {
      // Pantry/oven towers: place at a wall terminal ONLY if there's room.
      const wl = wallLayouts.find(w => w.wallId === tall.wall);
      if (!wl) continue;

      const wallDef = walls.find(w => w.id === tall.wall);
      const wallLen = wallDef?.length || wl.wallLength;

      // Determine which end(s) the corners occupy
      const cornerAtRight = corners.find(c => c.wallA === tall.wall); // wallA → right end consumed
      const cornerAtLeft = corners.find(c => c.wallB === tall.wall);  // wallB → left end consumed
      const leftConsumed = cornerAtLeft ? cornerAtLeft.wallBConsumption : 0;
      const rightConsumed = cornerAtRight ? cornerAtRight.wallAConsumption : 0;

      // Find the last base cabinet position on this wall
      const baseCabs = wl.cabinets.filter(c => typeof c.position === "number");
      const maxCabEnd = baseCabs.reduce((m, c) => Math.max(m, (c.position || 0) + (c.width || 0)), leftConsumed);

      // Try to place at the left end (before first base cab) if corner is on the right
      let placed = false;
      if (cornerAtRight && !cornerAtLeft) {
        // Left end is free — check if there's room before the first base cab
        const firstCabStart = baseCabs.length ? Math.min(...baseCabs.map(c => c.position || 0)) : leftConsumed;
        if (firstCabStart >= tall.width) {
          tall.position = 0;
          placed = true;
        }
      }

      // Try to place at the right end (after last base cab) if corner is on the left
      if (!placed && cornerAtLeft && !cornerAtRight) {
        if (wallLen - maxCabEnd >= tall.width) {
          tall.position = wallLen - tall.width;
          placed = true;
        }
      }

      // Fallback: try whichever end has more room
      if (!placed) {
        const leftRoom = baseCabs.length
          ? Math.min(...baseCabs.map(c => c.position || Infinity)) - leftConsumed
          : wallLen - leftConsumed - rightConsumed;
        const rightRoom = wallLen - rightConsumed - maxCabEnd;

        if (rightRoom >= tall.width && rightRoom >= leftRoom) {
          tall.position = wallLen - rightConsumed - tall.width;
          placed = true;
        } else if (leftRoom >= tall.width) {
          tall.position = leftConsumed;
          placed = true;
        }
      }

      // No room on this wall — remove the tall (it can't be placed without overlapping)
      if (!placed) {
        talls.splice(ti, 1);
      }
    }
  }

  // Phase 4b: Add end panels (PRO_DESIGN) — EVERY exposed end gets a panel
  // Add BEP (base end panels) and FWEP (wall flush end panels) to exposed wall runs
  addEndPanels(wallLayouts, upperLayouts, walls, corners, pf);

  // Phase 4c: Enforce filler rule — never > 3" filler, redistribute to cabinets
  for (const wl of wallLayouts) {
    enforceFillerRule(wl, golaPrefix);
  }

  // Phase 4d: Validate fillers post-enforcement
  for (const wl of wallLayouts) {
    const fillerIssues = validateFillers(wl.cabinets, wl.wallLength);
    for (const issue of fillerIssues) {
      validation.push(issue);
    }
  }

  // Phase 5: Generate accessories (room-type-aware)
  const accessories = generateAccessories(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, walls, appliances, pf, talls);

  // Phase 5b: Assign hinge sides to single-door cabinets
  assignHingeSides(wallLayouts, upperLayouts);

  // Phase 6: Compile placements
  let placements = compilePlacements(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, accessories, talls, upperCorners);

  // Phase 6b: Resolve two-tone materials
  placements = resolveTwoTone(placements, pf);

  // Phase 6c: Collect solver warnings (overlap, depth, island bounds)
  const solverWarnings = [];
  for (const wl of wallLayouts) {
    if (wl._warnings) solverWarnings.push(...wl._warnings);
  }
  if (islandLayout && islandLayout._warnings) {
    solverWarnings.push(...islandLayout._warnings);
  }

  // Phase 6d: Ensure every kitchen has a trash/waste pull-out cabinet
  // Training data: BWDMB only needed when NO dishwasher is present on the sink wall.
  // When DW is adjacent to sink, the DW zone handles waste duties and the adjacent
  // cabinet should be B3D (drawers) per DIEHL pattern (B3D27 + SB36 + B3D30).
  // Only swap to BWDMA when there's no dishwasher on the sink wall.
  if (roomType === "kitchen" || !roomType) {
    const allWallCabs = wallLayouts.flatMap(wl => wl.cabinets || []);
    const islandCabs = islandLayout?.cabinets || [];
    const allCabs = [...allWallCabs, ...islandCabs];
    const hasWaste = allCabs.some(c => (c.sku || "").toUpperCase().includes("BWDM"));

    if (!hasWaste) {
      // Find the sink and check if DW is on the same wall
      const sinkCab = allWallCabs.find(c => c.type === "appliance" && c.applianceType === "sink");
      if (sinkCab) {
        const sinkWall = wallLayouts.find(wl => wl.wallId === sinkCab.wall);
        if (sinkWall) {
          const wallCabs = sinkWall.cabinets || [];
          const hasDWonWall = wallCabs.some(c => c.applianceType === "dishwasher");

          // Only swap to waste base if NO dishwasher on this wall
          // Training: DIEHL has DW+SB36+B3D30 (no waste base needed — DW handles it)
          if (!hasDWonWall) {
            const sinkIdx = wallCabs.indexOf(sinkCab);
            const candidates = [];
            for (let offset = 1; offset <= 3; offset++) {
              for (const dir of [1, -1]) {
                const idx = sinkIdx + dir * offset;
                if (idx >= 0 && idx < wallCabs.length) {
                  const cab = wallCabs[idx];
                  if (cab.type === "base" && cab.role !== "corner"
                      && !(cab.sku || "").includes("BPOS")) {
                    candidates.push({ cab, dist: offset });
                  }
                }
              }
            }
            if (candidates.length > 0) {
              candidates.sort((a, b) => a.dist - b.dist);
              const target = candidates[0].cab;
              const golaPrefix = pf.golaChannel ? "FC-" : "";
              const wasteW = target.width;
              if (wasteW >= 15) {
                target.sku = `${golaPrefix}BWDMB${wasteW}`;
                target._wasteSwapped = true;
                target.decisionNote = "Phase 6d: waste cabinet — no DW on sink wall, needs dedicated trash pull-out";
              }
            }
          }
        }
      }
    }
  }

  // ── PROJECT 5: Validation-driven correction loop ──
  // Run validation, then auto-correct fixable errors (up to 3 iterations).
  // This catches overlaps, unfillable gaps, and other layout errors that
  // slipped through the constraint solver.
  const MAX_CORRECTION_PASSES = 3;
  let correctionsMade = 0;

  for (let pass = 0; pass < MAX_CORRECTION_PASSES; pass++) {
    let fixedThisPass = 0;

    // Check each wall for overlapping cabinets
    for (const wl of wallLayouts) {
      const cabs = wl.cabinets.filter(c => typeof c.position === 'number').sort((a, b) => a.position - b.position);
      for (let i = 0; i < cabs.length - 1; i++) {
        const curr = cabs[i];
        const next = cabs[i + 1];
        const currEnd = curr.position + (curr.width || 0);
        const overlap = currEnd - next.position;
        if (overlap > 1) {
          // Overlapping: shrink the base cabinet (not the appliance)
          if (curr.type === 'base' && next.type !== 'base') {
            const newWidth = curr.width - overlap;
            if (newWidth >= 9) {
              curr.width = newWidth;
              curr.sku = curr.sku.replace(/\d+/, String(newWidth));
              fixedThisPass++;
            } else {
              // Too small — remove it
              const idx = wl.cabinets.indexOf(curr);
              if (idx >= 0) { wl.cabinets.splice(idx, 1); fixedThisPass++; }
            }
          } else if (next.type === 'base' && curr.type !== 'base') {
            const newWidth = next.width - overlap;
            if (newWidth >= 9) {
              next.position += overlap;
              next.width = newWidth;
              next.sku = next.sku.replace(/\d+/, String(newWidth));
              fixedThisPass++;
            } else {
              const idx = wl.cabinets.indexOf(next);
              if (idx >= 0) { wl.cabinets.splice(idx, 1); fixedThisPass++; }
            }
          }
        }
      }

      // Check for unfillable gaps (< 9" between cabinets, not at wall ends)
      const sorted = wl.cabinets.filter(c => typeof c.position === 'number').sort((a, b) => a.position - b.position);
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        const gap = next.position - (curr.position + curr.width);
        if (gap > 0 && gap < 9 && curr.type === 'base') {
          // Absorb gap into current cabinet (width mod)
          curr.width += gap;
          curr.sku = curr.sku.replace(/\d+/, String(Math.round(curr.width)));
          if (!curr.modified) curr.modified = {};
          curr.modified.type = "MOD WIDTH N/C";
          curr.modified.gapAbsorbed = gap;
          fixedThisPass++;
        }
      }
    }

    correctionsMade += fixedThisPass;
    if (fixedThisPass === 0) break; // No more fixes needed
  }

  // Phase 7: Validate (pass roomType for context-aware validation)
  const validationInput = buildValidationInput(wallLayouts, islandLayout, appliances, corners, roomType, pf, accessories, talls);
  const validation = validateLayout(validationInput);

  // Add correction loop metadata
  if (correctionsMade > 0) {
    validation.push({ severity: "info", rule: "correction_loop",
      message: `Auto-corrected ${correctionsMade} layout issue(s) in validation loop` });
  }

  // Merge solver warnings into validation results
  for (const w of solverWarnings) {
    validation.push({ severity: "warning", rule: w.type, message: w.message });
  }

  // ── 3D Spatial Validation (stacking rules + depth conflicts) ──
  // Uses the _elev data assigned by compilePlacements → assignSpatialData
  try {
    const spatial3DResults = validate3DSpatial(placements);
    for (const issue of spatial3DResults) {
      validation.push(issue);
    }
  } catch (_e) { validation.push({ severity: 'warning', rule: 'spatial_3d_error', message: `3D spatial validation skipped: ${_e.message}` }); }

  // Build materials metadata (safe — individual let with default)
  let materialsMetadata = null;
  try { materialsMetadata = buildMaterialsMetadata(placements, pf); } catch (_e) { /* non-fatal */ }

  // Calculate corner efficiency metrics (safe — individual lets with defaults)
  let avgEfficiency = null;
  let cornerTypes = [];
  let totalWineCoolers = 0;
  let totalBeverageCenters = 0;
  let aesthetics = null;
  try {
    const cornerEfficiencies = (corners || []).map(c => c.efficiency).filter(e => typeof e === 'number');
    avgEfficiency = cornerEfficiencies.length > 0
      ? Math.round(cornerEfficiencies.reduce((a, b) => a + b, 0) / cornerEfficiencies.length)
      : null;
    cornerTypes = [...new Set((corners || []).map(c => c.type).filter(Boolean))];
  } catch (_e) { /* non-fatal */ }

  // Count wine coolers and beverage centers
  try {
    totalWineCoolers = (talls || []).filter(t => t.role === "wine_cooler").length;
    totalBeverageCenters = (talls || []).filter(t => t.role === "beverage_center").length;
  } catch (_e) { /* non-fatal */ }

  // Phase 7b: Aesthetic scoring (Phase 3 — symmetry, consistency, proportionality)
  try { aesthetics = scoreAesthetics(wallLayouts, upperLayouts, corners, pf); } catch (_e) { /* non-fatal */ }

  // ── Phase 7c: Spatial Validation (corner anchors, chain, trim collisions) ──
  let spatialReport = { errors: [], warnings: [], crownPaths: [], lightRailPaths: [] };
  try {
    spatialReport = validateSpatialLayout({ walls: wallLayouts, uppers: upperLayouts, corners, accessories, talls }) || spatialReport;
  } catch (_e) { validation.push({ severity: 'warning', rule: 'spatial_validation_error', message: `Spatial validation skipped: ${_e.message}` }); }
  for (const err of (spatialReport.errors || [])) {
    validation.push({ severity: 'error', rule: err.rule, message: err.message, fix: err.fix });
  }
  for (const warn of (spatialReport.warnings || [])) {
    validation.push({ severity: 'warning', rule: warn.rule, message: warn.message, fix: warn.fix });
  }

  // ── Build path-based molding segments for renderer ──
  // Crown and light rail must follow cabinet contours, skipping hood zones.
  // These segments replace the old min-to-max rectangle approach.
  const moldingPaths = {
    crown: spatialReport.crownPaths || [],
    lightRail: spatialReport.lightRailPaths || [],
  };

  // ── Phase 7d: Countertop Polyline Generation ──
  // Z=34.5" (base height), 1.5" thick, follows base cabinet perimeter.
  // Overhang: 1.5" past front face, 0" at wall, wraps around island edges.
  const countertopPolyline = generateCountertopPolyline(wallLayouts, islandLayout, peninsulaLayout, corners);

  // ── Phase 7e: Symmetry Check for Flanking Zones ──
  // Verify cabinets flanking range hoods and windows are symmetrical.
  const symmetryIssues = checkFlankingSymmetry(wallLayouts, upperLayouts);
  for (const issue of symmetryIssues) {
    validation.push(issue);
  }

  // Phase 8: Optionally assign 3D coordinates (when requested via prefs.coordinates)
  let coordinatedPlacements = null;
  if (pf.coordinates) {
    const layoutResult = {
      layoutType,
      walls,
      island,
      peninsula,
      placements,
    };
    coordinatedPlacements = assignCoordinates(layoutResult, pf.wallConfig);
  }

  // ── Assign _elev 3D spatial data to SOURCE objects ──
  // The renderer reads wallLayouts[].cabinets, upperLayouts[].cabinets, and talls[]
  // directly — NOT the placements copies. We must tag the originals so the renderer
  // can use _elev.yMount and _elev.height for precise vertical positioning.
  assignElevToSourceObjects(wallLayouts, upperLayouts, talls, assignedAppliances, corners);

  // ── POST-PLACEMENT OVERLAP DETECTION & AUTO-CORRECTION ──
  // Scan each wall's base cabinet run for overlaps and gaps that violate
  // standard cabinet widths. If an overlap is found, shift the offending
  // cabinet rightward. If a gap is found that isn't fillable by standard
  // widths, insert a filler strip.
  for (const wl of wallLayouts) {
    const cabs = wl.cabinets;
    if (!cabs || cabs.length < 2) continue;

    // Sort by position ascending
    cabs.sort((a, b) => (a.position || 0) - (b.position || 0));

    // Pass 1: Fix overlaps — shift right
    for (let i = 1; i < cabs.length; i++) {
      const prev = cabs[i - 1];
      const curr = cabs[i];
      const prevEnd = (prev.position || 0) + (prev.width || 0);
      const currStart = curr.position || 0;

      if (currStart < prevEnd) {
        // Overlap detected — shift current cab to end of previous
        const overlapAmount = prevEnd - currStart;
        validation.push({
          severity: 'warning',
          rule: 'overlap_auto_corrected',
          message: `Wall ${wl.wallId}: ${curr.sku || curr.applianceType || 'cabinet'} overlapped ${prev.sku || prev.applianceType || 'cabinet'} by ${overlapAmount}" — auto-shifted right`,
          wall: wl.wallId,
          cab: curr.sku,
          overlap: overlapAmount,
        });
        curr.position = prevEnd;
      }
    }

    // Pass 2: Check for gaps between adjacent cabinets
    // Standard fillable widths: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    const FILLER_WIDTHS = [3, 6];
    const STD_WIDTHS = new Set([9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42]);
    for (let i = 1; i < cabs.length; i++) {
      const prev = cabs[i - 1];
      const curr = cabs[i];
      const prevEnd = (prev.position || 0) + (prev.width || 0);
      const currStart = curr.position || 0;
      const gap = currStart - prevEnd;

      if (gap > 0 && gap < 3) {
        // Tiny gap — likely rounding error. Shift current cab left to close it.
        curr.position = prevEnd;
        validation.push({
          severity: 'info',
          rule: 'micro_gap_closed',
          message: `Wall ${wl.wallId}: closed ${gap}" micro-gap before ${curr.sku || 'cabinet'}`,
        });
      } else if (gap >= 3 && gap <= 6 && FILLER_WIDTHS.includes(gap)) {
        // Insertable filler strip
        const filler = {
          sku: `FST${gap}`,
          width: gap,
          position: prevEnd,
          role: 'filler',
          type: 'filler',
          _autoInserted: true,
          _elev: { zone: 'BASE', yMount: VERTICAL_ZONES.TOE_KICK.yMax, height: DIMS.baseHeight, depth: DEPTH_TIERS.BASE_FRONT, depthSetback: 0 },
        };
        filler._elev.yTop = filler._elev.yMount + filler._elev.height;
        cabs.splice(i, 0, filler);
        i++; // skip inserted filler
        validation.push({
          severity: 'info',
          rule: 'filler_auto_inserted',
          message: `Wall ${wl.wallId}: inserted ${gap}" filler strip at position ${prevEnd}"`,
        });
      }
    }

    // Pass 3: Check last cab doesn't exceed wall length
    const lastCab = cabs[cabs.length - 1];
    if (lastCab) {
      const lastEnd = (lastCab.position || 0) + (lastCab.width || 0);
      if (lastEnd > wl.wallLength) {
        validation.push({
          severity: 'error',
          rule: 'wall_overflow',
          message: `Wall ${wl.wallId}: cabinets extend to ${lastEnd}" but wall is only ${wl.wallLength}" — overflow by ${lastEnd - wl.wallLength}"`,
          wall: wl.wallId,
          overflow: lastEnd - wl.wallLength,
        });
      }
    }
  }

  // ── OCP 3D Solid Geometry Validation ──
  // Build true 3D solids via Python/OpenCascade for collision detection,
  // stacking verification, and elevation extraction.
  let _3dModel = null;
  try {
    const solverSnapshot = { walls: wallLayouts, uppers: upperLayouts, talls, metadata: { ceilingHeight: wallLayouts[0]?.ceilingHeight || DIMS.standardCeiling || 96 } };
    _3dModel = build3DModel(solverSnapshot);
    if (_3dModel.success) {
      // Merge 3D validation issues (collisions, ceiling, depth) into results
      validation.push(...(_3dModel.validation?.all_issues || []).map(i => ({
        severity: i.severity || 'warning',
        rule: `3d_${i.rule || 'unknown'}`,
        message: i.message || '3D validation issue',
      })));
      // Optionally apply OCP-verified _elev data back to source objects
      apply3DElevData(solverSnapshot, _3dModel);
    }
  } catch (e) {
    // 3D engine is optional — degrade gracefully
    validation.push({ severity: 'info', rule: '3d_engine_unavailable', message: `3D engine: ${e.message}` });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 8: SYSTEM DEPENDENCIES — Installation-Level Automation
  // ═══════════════════════════════════════════════════════════════════════════
  // These sub-systems run AFTER all cabinets are placed. They generate the
  // hidden infrastructure that separates a "box placer" from a professional
  // installation engine.

  const _ceilH = wallLayouts[0]?.ceilingHeight || DIMS.standardCeiling || 96;
  const _tkGolaPrefix = prefs?.doorStyle === 'Gola' || prefs?.golaProfile ? 'C' : 'N';

  // ── 8a: Continuous Toe-Kick Runs ──
  // Traces the front line of base cabinets and generates one continuous sweep
  // per wall run (no per-cabinet notches). Handles corners with 45° miters.
  let toeKickResult = null;
  try {
    toeKickResult = generateToeKickRuns(wallLayouts, corners, islandLayout, peninsulaLayout, {
      golaPrefix: _tkGolaPrefix,
      materialMatch: prefs?.toeKickMaterial || 'match',
    });
    if (toeKickResult?.warnings?.length) {
      for (const w of toeKickResult.warnings) {
        validation.push({ severity: 'info', rule: 'toe_kick', message: w });
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'toe_kick_error', message: `Toe kick generation: ${e.message}` });
  }

  // ── 8b: Scribe Tolerance (Out-of-Square Wall Compensation) ──
  // Any cabinet terminating at a wall gets 0.5" scribe margin.
  // Adjusts cabinet widths and inserts SCRIBE-3 fillers.
  let scribeResult = null;
  try {
    const wallDeviations = input.wallDeviations || {};
    scribeResult = applyScribeTolerance(wallLayouts, upperLayouts, corners, wallDeviations);
    if (scribeResult?.validation?.length) {
      for (const v of scribeResult.validation) {
        validation.push({ severity: v.severity || 'info', rule: 'scribe_tolerance', message: v.message || v });
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'scribe_error', message: `Scribe tolerance: ${e.message}` });
  }

  // ── 8c: Service Cavities & Plumbing Voids ──
  // Generates knockout specs for sink P-traps, DW hose routes, gas lines,
  // fridge water lines. Validates corner sink reach-back.
  let serviceZones = null;
  try {
    const applianceList = placements.filter(p => p.type === 'appliance' || p.applianceType);
    serviceZones = generateServiceZones(wallLayouts, islandLayout, applianceList);
    if (serviceZones?.warnings?.length) {
      for (const w of serviceZones.warnings) {
        validation.push({
          severity: w.severity || 'warning',
          rule: `service_zone_${w.type || 'general'}`,
          message: w.message || w,
        });
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'service_zones_error', message: `Service zones: ${e.message}` });
  }

  // ── 8d: Appliance Door-Swing Collision Detection ──
  // Checks that fridge doors, oven doors, DW doors can fully open without
  // hitting walls, islands, or other appliance arcs.
  let swingArcResult = null;
  try {
    swingArcResult = calculateSwingArcs(placements, wallLayouts, islandLayout);
    if (swingArcResult?.collisions?.length) {
      for (const c of swingArcResult.collisions) {
        validation.push({
          severity: c.severity || 'warning',
          rule: 'door_swing_collision',
          message: c.message || `Door swing collision: ${c.applianceA} vs ${c.obstruction || c.applianceB}`,
          fix: c.suggestedFix || c.fix || null,
        });
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'swing_arc_error', message: `Swing arc check: ${e.message}` });
  }

  // ── 8e: Mounting Rail Coordinate Generator ──
  // Calculates Z-bracket/French cleat positions for all upper cabinets.
  // Generates rail cut list with stud-aligned screw locations.
  let mountingRails = null;
  try {
    const wallDefs = walls.map(w => ({ id: w.id, length: w.length, ceilingHeight: w.ceilingHeight || _ceilH }));
    mountingRails = generateMountingRails(upperLayouts, wallDefs, {
      lightingEnabled: prefs?.underCabinetLighting || false,
      studSpacing: 16,
    });
  } catch (e) {
    validation.push({ severity: 'info', rule: 'mounting_rail_error', message: `Mounting rails: ${e.message}` });
  }

  // ── 8f: Light Rail & LED Channel Automation ──
  // Generates continuous light rail molding runs under uppers (skips hoods),
  // calculates LED tape footage, drivers, and puck light positions.
  let lightingPlan = null;
  try {
    lightingPlan = generateLightingPlan(upperLayouts, prefs, {
      profile: prefs?.lightRailProfile || 'SQ',
      ledIntensity: prefs?.ledIntensity || 'standard',
      puckLights: prefs?.puckLights || false,
      interiorLighting: prefs?.interiorLighting || false,
    });
  } catch (e) {
    validation.push({ severity: 'info', rule: 'lighting_error', message: `Lighting plan: ${e.message}` });
  }

  // ── 8g: Island Clearance Envelope & No-Fly Zone ──
  // For island layouts: validates 42" walkways on all sides, generates DFBPs
  // and DEPs, checks work triangle intersection.
  let islandClearances = null;
  let islandNoFlyZone = null;
  try {
    if (islandLayout || layoutType?.includes('island')) {
      const roomDims = { width: input.roomWidth || 144, length: input.roomLength || 168 };
      islandNoFlyZone = calculateNoFlyZone(wallLayouts, roomDims);
      if (islandLayout) {
        islandClearances = calculateIslandClearances(
          {
            x: islandLayout.x || islandNoFlyZone?.buildableArea?.centerX || roomDims.width / 2,
            y: islandLayout.y || islandNoFlyZone?.buildableArea?.centerY || roomDims.length / 2,
            width: islandLayout.totalWidth || 72,
            depth: islandLayout.depth || 24,
          },
          wallLayouts,
          roomDims
        );
        if (islandClearances?.violations?.length) {
          for (const v of islandClearances.violations) {
            validation.push({
              severity: 'error',
              rule: 'island_clearance_violation',
              message: v.message || `Island clearance violation: ${v.side} = ${v.actual}" (min ${v.required}")`,
            });
          }
        }
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'island_clearance_error', message: `Island clearance: ${e.message}` });
  }

  // ── 8h: Seating & Overhang Calculator ──
  // If island/peninsula has seating, calculates overhang depth, max seats,
  // and auto-places support brackets/corbels.
  let seatingLayout = null;
  try {
    if ((islandLayout && prefs?.islandSeating) || (peninsulaLayout && prefs?.peninsulaSeating)) {
      const targetLayout = islandLayout || peninsulaLayout;
      seatingLayout = calculateSeatingLayout(targetLayout, {
        seating: true,
        overhangDepth: prefs?.seatingOverhang || 12,
        seatSpacing: prefs?.seatSpacing || 'standard',
        counterHeight: prefs?.barHeight ? 42 : 36,
        bracketStyle: prefs?.bracketStyle || (prefs?.designStyle === 'modern' ? 'hidden' : 'corbel'),
        waterfallEnd: prefs?.waterfallEnd || false,
      });
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'seating_error', message: `Seating layout: ${e.message}` });
  }

  // ── 8i: NKBA Safety Validation (Electrical, Work Triangle, Clearances) ──
  // Comprehensive code-compliance check: outlet placement every 48",
  // work triangle 13'-26', landing areas, ventilation, walkway widths.
  let nkbaReport = null;
  try {
    if (roomType === 'kitchen') {
      const roomGeometry = {
        width: input.roomWidth || 144,
        length: input.roomLength || 168,
        walls: walls.map(w => ({ id: w.id, length: w.length })),
      };
      nkbaReport = validateNKBA(
        { walls: wallLayouts, uppers: upperLayouts, island: islandLayout, peninsula: peninsulaLayout, placements, corners },
        roomGeometry,
        { adaMode: prefs?.adaCompliant || false, twoCook: prefs?.twoCookKitchen || false }
      );
      if (nkbaReport?.issues?.length) {
        for (const issue of nkbaReport.issues) {
          validation.push({
            severity: issue.severity || 'warning',
            rule: `nkba_${issue.rule || issue.code || 'general'}`,
            message: issue.message,
            fix: issue.fix || null,
          });
        }
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'nkba_validation_error', message: `NKBA validation: ${e.message}` });
  }

  // ── 8j: Part ID Generator & BOM ──
  // Assigns unique installation-ready part IDs to every component:
  // {ROOM}-{WALL}-{SEQ}-{SKU}-{MODS}. Generates full Bill of Materials.
  let partIds = null;
  let bom = null;
  try {
    const layoutResult = {
      walls: wallLayouts, uppers: upperLayouts, talls, island: islandLayout,
      peninsula: peninsulaLayout, accessories, corners,
    };
    partIds = generatePartIds(layoutResult, roomType);
    if (partIds?.parts?.length) {
      bom = generateBOM(partIds.parts, null); // pricing data applied downstream
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'part_id_error', message: `Part ID generation: ${e.message}` });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 9: CONSTRAINT PROPAGATION, SPATIAL INTELLIGENCE, FINISHING, STYLE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 9a: Constraint Propagation (Linked-List Cabinet Runs) ──
  // Build linked-list runs from wall layouts. Enables downstream ripple when
  // any cabinet width changes. Validates overflow against wall length.
  let cabinetRuns = null;
  let runValidation = null;
  try {
    cabinetRuns = buildCabinetRuns(wallLayouts, corners);
    runValidation = validateRuns(cabinetRuns);
    if (runValidation && !runValidation.valid) {
      for (const issue of (runValidation.issues || [])) {
        validation.push({
          severity: issue.severity || 'warning',
          rule: 'constraint_propagation',
          message: issue.message || `Run issue on wall ${issue.wallId}`,
        });
      }
      // Attempt auto-resolution of overflows
      try {
        const resolved = resolveOverflows(cabinetRuns);
        if (resolved && !resolved.resolved) {
          for (const adj of (resolved.adjustments || [])) {
            validation.push({
              severity: 'warning',
              rule: 'overflow_unresolved',
              message: adj.message || `Unresolved overflow on wall ${adj.wallId}`,
            });
          }
        }
      } catch (_) { /* overflow resolution is best-effort */ }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'constraint_prop_error', message: `Constraint propagation: ${e.message}` });
  }

  // ── 9b: Functional Envelopes & Spatial Collision Check ──
  // Generates physical_box + clearance_box for every object, then runs
  // pairwise intersection tests to flag functional obstructions.
  let envelopes = null;
  let spatialCollisions = null;
  let walkwayReport = null;
  try {
    envelopes = generateEnvelopes(placements, wallLayouts, islandLayout, {
      includeUppers: true,
      upperLayouts,
    });
    if (envelopes && envelopes.length > 0) {
      spatialCollisions = runCollisionCheck(envelopes, {
        skipSameWallUppers: true, // uppers don't collide with bases on same wall
      });
      const roomGeom = {
        width: input.roomWidth || 144,
        length: input.roomLength || 168,
      };
      walkwayReport = validateWalkways(envelopes, roomGeom, {
        twoCook: prefs?.twoCookKitchen || false,
      });
      // Merge collision issues into validation
      if (spatialCollisions?.collisions?.length) {
        for (const c of spatialCollisions.collisions) {
          validation.push({
            severity: c.severity || 'warning',
            rule: `spatial_${c.type || 'collision'}`,
            message: c.message || `Spatial collision: ${c.objectA?.id || '?'} vs ${c.objectB?.id || '?'}`,
            fix: c.fix || null,
          });
        }
      }
      if (walkwayReport?.issues?.length) {
        for (const w of walkwayReport.issues) {
          validation.push({
            severity: w.severity || 'warning',
            rule: 'walkway_violation',
            message: w.message,
          });
        }
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'envelope_error', message: `Functional envelopes: ${e.message}` });
  }

  // ── 9c: Automated Finishing Rules (End Panels, Fillers, Symmetry, Reveals) ──
  // Runs the visibility check on all cabinets, auto-adds end panels to exposed
  // sides, solves remaining filler gaps, enforces flanking symmetry, and
  // validates door reveal consistency.
  let finishingResult = null;
  try {
    finishingResult = applyFinishingRules(
      { walls: wallLayouts, uppers: upperLayouts, talls, island: islandLayout, peninsula: peninsulaLayout, corners },
      prefs || {}
    );
    if (finishingResult?.validation?.length) {
      for (const v of finishingResult.validation) {
        validation.push({
          severity: v.severity || 'info',
          rule: `finishing_${v.rule || 'general'}`,
          message: v.message,
        });
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'finishing_error', message: `Finishing rules: ${e.message}` });
  }

  // ── 9d: Style Morphing (Geometry Mutation & Molding Extrusion) ──
  // Applies door style geometry to all cabinets (thickness, overlay, weight),
  // then extrudes crown molding and light rail profiles along upper perimeters.
  let styleMorphResult = null;
  let moldingExtrusion = null;
  let lightRailExtrusion = null;
  let finishMetrics = null;
  try {
    const doorStyleName = prefs?.doorStyle || prefs?.doorStyleName || 'Shaker';
    const designPreset = prefs?.designPreset || null;

    if (designPreset && DESIGN_PRESETS[designPreset]) {
      styleMorphResult = applyDesignPreset(
        { walls: wallLayouts, uppers: upperLayouts, talls, island: islandLayout },
        designPreset
      );
    } else {
      styleMorphResult = morphStyle(
        { walls: wallLayouts, uppers: upperLayouts, talls, island: islandLayout },
        doorStyleName,
        prefs || {}
      );
    }

    // Extrude crown molding along upper perimeter
    const crownProfile = prefs?.crownProfile || (prefs?.crownMolding === 'none' ? null : 'Simple');
    if (crownProfile && moldingPaths?.length) {
      moldingExtrusion = extrudeMoldingProfile(crownProfile, moldingPaths);
    }

    // Extrude light rail along bottom of uppers
    const lrProfile = prefs?.lightRailProfile || 'SQ';
    if (lrProfile !== 'none' && moldingPaths?.length) {
      lightRailExtrusion = extrudeLightRailProfile(lrProfile, moldingPaths);
    }

    // Calculate finish metrics (total door weight, paintable area, glass area, hinges)
    finishMetrics = calculateFinishMetrics(
      { walls: wallLayouts, uppers: upperLayouts, talls, island: islandLayout },
      doorStyleName
    );
  } catch (e) {
    validation.push({ severity: 'info', rule: 'style_morph_error', message: `Style morphing: ${e.message}` });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 10: EXPERT DESIGN INTELLIGENCE — Vertical Alignment, Audit, Snap Logic
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 10a: Vertical Common-Line Alignment ──
  // Scores how well upper cabinet seams align with base cabinet seams.
  // Professional designs maintain a clean vertical grid.
  let alignmentReport = null;
  let alignmentGrid = null;
  try {
    for (const wl of wallLayouts) {
      const ul = upperLayouts.find(u => u.wallId === wl.wallId);
      if (!ul || !ul.cabinets?.length || !wl.cabinets?.length) continue;
      const baseCabs = wl.cabinets.filter(c => c.width && typeof c.position === 'number');
      const upperCabs = ul.cabinets.filter(c => c.width && typeof c.position === 'number');
      if (!baseCabs.length || !upperCabs.length) continue;

      const wallAlignment = scoreAlignment(baseCabs, upperCabs);
      if (!alignmentReport) alignmentReport = { walls: [], overallScore: 0 };
      alignmentReport.walls.push({ wallId: wl.wallId, ...wallAlignment });

      if (wallAlignment.score < 50) {
        validation.push({
          severity: 'warning',
          rule: 'vertical_alignment_low',
          message: `Wall ${wl.wallId}: upper/base seam alignment score ${wallAlignment.score}/100 (${wallAlignment.alignedSeams}/${wallAlignment.totalSeams} seams aligned)`,
        });
      }
    }
    if (alignmentReport?.walls?.length) {
      alignmentReport.overallScore = Math.round(
        alignmentReport.walls.reduce((s, w) => s + w.score, 0) / alignmentReport.walls.length
      );
      // Generate visual grid for renderer
      try {
        const firstWall = wallLayouts[0];
        const firstUpper = upperLayouts.find(u => u.wallId === firstWall?.wallId);
        if (firstWall?.cabinets && firstUpper?.cabinets) {
          alignmentGrid = exportAlignmentGrid(firstWall.cabinets, firstUpper.cabinets);
        }
      } catch (_) { /* alignment grid is optional */ }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'alignment_error', message: `Vertical alignment: ${e.message}` });
  }

  // ── 10b: Professional Audit (Gatekeeper) ──
  // Comprehensive self-check: work triangle, DW placement, landing areas,
  // symmetry, clearances, SKU validity, NKBA compliance, material consistency.
  // Returns A-F grade and 0-100 score.
  let auditReport = null;
  try {
    if (roomType === 'kitchen') {
      auditReport = runProfessionalAudit(
        {
          walls: wallLayouts, uppers: upperLayouts, talls,
          island: islandLayout, peninsula: peninsulaLayout,
          corners, accessories, placements, coordinatedPlacements,
        },
        input,
        prefs || {}
      );
      // Merge critical issues into validation
      if (auditReport?.criticalIssues?.length) {
        for (const ci of auditReport.criticalIssues) {
          validation.push({
            severity: 'error',
            rule: `audit_${ci.category || 'critical'}`,
            message: ci.message,
            fix: ci.fix || null,
          });
        }
      }
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'audit_error', message: `Professional audit: ${e.message}` });
  }

  // ── 10c: Room Analysis (Expert Workflow Context) ──
  // Analyzes center-points, traffic paths, and anchor suggestions.
  // This data feeds future interactive "solve room" mode.
  let roomAnalysis = null;
  try {
    const features = (input.features || []).concat(
      (input.windows || []).map(w => ({ type: 'window', wall: w.wall, position: w.position, width: w.width || 36 })),
      (input.doors || []).map(d => ({ type: 'door', wall: d.wall, position: d.position, width: d.width || 36 })),
    );
    if (features.length > 0 || walls.length > 0) {
      roomAnalysis = analyzeRoom(walls, features);
    }
  } catch (e) {
    validation.push({ severity: 'info', rule: 'room_analysis_error', message: `Room analysis: ${e.message}` });
  }

  // ═══════════════════════════════════════════════════════════════════════════

  return {
    layoutType,
    roomType,
    _inputWalls: walls,
    _spatialModel: spatialModel,     // expose for renderer
    _3dModel,                        // OCP solid geometry validation
    walls: wallLayouts,
    uppers: upperLayouts,
    upperCorners,
    talls,
    island: islandLayout,
    peninsula: peninsulaLayout,
    corners,
    accessories,
    placements,
    coordinatedPlacements,
    validation,
    moldingPaths,           // path-based molding segments for renderer
    spatialValidation: spatialReport, // full spatial validation report
    countertopPolyline,     // automated countertop path (Z=34.5, 1.5" thick)

    // ── Phase 8: System Dependencies ──
    toeKick: toeKickResult,
    serviceZones,
    swingArcs: swingArcResult,
    mountingRails,
    lightingPlan,
    scribes: scribeResult,
    islandClearances,
    islandNoFlyZone,
    seatingLayout,
    nkbaReport,
    partIds,
    bom,

    // ── Phase 9: Constraint Propagation, Spatial, Finishing, Style ──
    cabinetRuns,               // linked-list run structures per wall
    envelopes,                 // physical + clearance boxes for all objects
    spatialCollisions,         // AABB intersection results
    walkwayReport,             // NKBA walkway clearance validation
    finishingResult,           // end panels, fillers, symmetry, reveals
    styleMorph: styleMorphResult, // geometry mutations from door style
    moldingExtrusion,          // crown molding path extrusion
    lightRailExtrusion,        // light rail path extrusion
    finishMetrics,             // door weight, paintable area, glass, hinges

    // ── Phase 10: Expert Design Intelligence ──
    alignmentReport,           // vertical seam alignment scores per wall
    alignmentGrid,             // SVG-ready vertical/horizontal grid lines
    auditReport,               // professional A-F grade with category scores
    roomAnalysis,              // center-points, traffic paths, anchor suggestions

    metadata: {
      totalCabinets: placements.filter(p => p.role !== "accessory").length,
      totalAccessories: accessories.length,
      totalTalls: talls.length,
      totalUpperCorners: upperCorners.length,
      totalEndPanels: accessories._endPanelCount || 0,
      totalFillers: accessories._fillerCount || 0,
      totalWineCoolers,
      totalBeverageCenters,
      errors: validation.filter(v => v.severity === "error").length,
      warnings: validation.filter(v => v.severity === "warning").length,
      materials: materialsMetadata,
      cornerEfficiency: avgEfficiency,
      cornerTypes,
      aesthetics,
      lighting: accessories._lighting,
      // Phase 8 summary
      toeKickLinearFt: toeKickResult?.totalLinearFt || 0,
      mountingRailCount: mountingRails?.rails?.length || 0,
      serviceZoneCount: serviceZones?.zones?.length || 0,
      swingCollisions: swingArcResult?.collisions?.length || 0,
      scribeCount: scribeResult?.scribes?.length || 0,
      nkbaScore: nkbaReport?.score || null,
      totalParts: partIds?.parts?.length || 0,
      seatingCapacity: seatingLayout?.seats || seatingLayout?.maxSeats || 0,
      // Phase 9 summary
      spatialCollisionCount: spatialCollisions?.collisions?.length || 0,
      walkwayViolations: walkwayReport?.issues?.length || 0,
      endPanelsAdded: finishingResult?.endPanels?.length || 0,
      symmetryFixes: finishingResult?.symmetryFixes?.length || 0,
      revealIssues: finishingResult?.revealIssues?.length || 0,
      totalDoorWeight: finishMetrics?.totalDoorWeight || 0,
      paintableAreaSqFt: finishMetrics?.paintableArea || 0,
      totalHinges: finishMetrics?.hingeCount || 0,
      crownMoldingLinearFt: moldingExtrusion?.totalLength ? moldingExtrusion.totalLength / 12 : 0,
      lightRailLinearFt: lightRailExtrusion?.totalLength ? lightRailExtrusion.totalLength / 12 : 0,
      // Phase 10 summary
      verticalAlignmentScore: alignmentReport?.overallScore || null,
      auditGrade: auditReport?.grade || null,
      auditScore: auditReport?.score || null,
      passesMinimumAudit: auditReport?.passesMinimum ?? null,
    },
  };
}


// ─── CORNER RESOLVER ────────────────────────────────────────────────────────

function resolveCorners(walls, layoutType, prefs) {
  const corners = [];

  if (layoutType === "single-wall" || layoutType === "single-wall-island" || layoutType === "galley") return corners;

  // Identify corner pairs based on layout type
  const pairs = [];
  if (layoutType === "l-shape" && walls.length >= 2) {
    pairs.push([walls[0].id, walls[1].id]);
  }
  if (layoutType === "u-shape" && walls.length >= 3) {
    pairs.push([walls[0].id, walls[1].id]);
    pairs.push([walls[1].id, walls[2].id]);
  }
  if (layoutType === "g-shape" && walls.length >= 4) {
    pairs.push([walls[0].id, walls[1].id]);
    pairs.push([walls[1].id, walls[2].id]);
    pairs.push([walls[2].id, walls[3].id]);
  }

  for (const [wA, wB] of pairs) {
    const wallA = walls.find(w => w.id === wA);
    const wallB = walls.find(w => w.id === wB);
    if (!wallA || !wallB) continue; // skip if wall not found
    let treatment, efficiency;
    try {
      treatment = selectCornerTreatment(wallA, wallB, prefs);

      // ── 30% WALL CONSUMPTION GUARD ──
      // If the corner consumes >30% of either wall, downgrade to BL36 or blind corner.
      // This ensures enough run remains for appliances + flanking cabinets.
      const consumeA = treatment.wallAConsumption || treatment.size || 36;
      const consumeB = treatment.wallBConsumption || treatment.size || 36;
      const pctA = consumeA / wallA.length;
      const pctB = consumeB / wallB.length;
      if ((pctA > 0.30 || pctB > 0.30) && treatment.type !== 'blindCorner' && treatment.type !== 'lazySusan') {
        // Downgrade: try BL36 lazy susan (36" per wall, most common in training)
        if (wallA.length >= 36 && wallB.length >= 36) {
          treatment = {
            type: "lazySusan", sku: "BL36-SS-PH", size: 36,
            wallAConsumption: 36, wallBConsumption: 36,
            fillerRequired: false, patternId: "lazy_susan_30pct_downgrade",
            trainingFrequency: 7,
          };
        } else {
          treatment = {
            type: "blindCorner", sku: "BL36-PH", size: 36,
            wallAConsumption: 36, wallBConsumption: 27,
            fillerRequired: true, fillerWidth: 3, patternId: "blind_30pct_downgrade",
          };
        }
      }

      efficiency = scoreCornerEfficiency(treatment.type, wallA.length, wallB.length);
    } catch (_e) { continue; } // skip broken corner
    corners.push({
      id: `corner_${wA}_${wB}`,
      wallA: wA,
      wallB: wB,
      type: treatment.type,
      sku: treatment.sku,
      size: treatment.size,
      wallAConsumption: treatment.wallAConsumption,
      wallBConsumption: treatment.wallBConsumption,
      fillerRequired: treatment.fillerRequired,
      fillerWidth: treatment.fillerWidth || 0,
      patternId: treatment.patternId || null,
      efficiency,
      ...(treatment.trainingFrequency != null ? { trainingFrequency: treatment.trainingFrequency } : {}),
      ...(treatment.hasSink ? { hasSink: true } : {}),
    });
  }

  return corners;
}

// ─── CORNER EFFICIENCY SCORING ──────────────────────────────────────────────

export function scoreCornerEfficiency(cornerType, wallA, wallB) {
  // Score 0-100 based on how well the corner treatment uses available space
  // Factors: wall consumption vs wall length, filler waste, accessibility
  const scores = {
    magicCorner: 95,    // Best access with chrome wire, minimal waste
    diagonalSink: 90,   // Functional diagonal at 45°, good access
    halfMoon: 85,       // Good mid-tier access, reasonable wall consumption
    lazySusan: 75,      // Good access, simple rotation, some waste
    quarterTurnShelves: 60,  // Limited corner access, more waste
    blindCorner: 40,    // Limited access, most wasted space
    diagonalLazy: 70,   // Specialized diagonal, less common
  };
  return scores[cornerType] || 50;
}

function selectCornerTreatment(wallA, wallB, prefs) {
  const aLen = wallA.length;
  const bLen = wallB.length;

  // User explicit overrides
  if (prefs.cornerTreatment === "lazySusan" && aLen >= 36 && bLen >= 36) {
    return {
      type: "lazySusan", sku: "BL36-SS-PH", size: 36,
      wallAConsumption: 36, wallBConsumption: 36,
      fillerRequired: false, patternId: "lazy_susan_explicit",
    };
  }
  if (prefs.cornerTreatment === "halfMoon" && aLen >= 36 && bLen >= 36) {
    // Catalog: BBC{size}-WS (Wire Shelves). Sizes: 45, 48, 51.
    // For smaller walls, use BL36-WSS-PH (Lazy Susan with Wire Shell Shelves)
    const size = aLen >= 48 && bLen >= 48 ? 48 : (aLen >= 45 && bLen >= 45 ? 45 : 36);
    const sku = size >= 45 ? `BBC${size}-WS` : `BL36-WSS-PH`;
    const consumption = size >= 45 ? size : 36;
    return {
      type: "halfMoon", sku, size: consumption,
      wallAConsumption: consumption,
      wallBConsumption: consumption + (size >= 45 ? 7 : 0),
      fillerRequired: size >= 45, fillerWidth: 3, patternId: "half_moon_explicit",
    };
  }
  if (prefs.cornerTreatment === "diagonalLazy" && aLen >= 36 && bLen >= 36) {
    return {
      type: "diagonalLazy", sku: "DSB36-SS", size: 36,
      wallAConsumption: 27, wallBConsumption: 27,
      fillerRequired: false, patternId: "diagonal_lazy_susan_explicit",
    };
  }
  if (prefs.cornerTreatment === "magicCorner" && aLen >= 42 && bLen >= 42) {
    const bbcWidth = aLen >= 48 ? 48 : 42;
    return {
      type: "magicCorner", sku: `BBC${bbcWidth}-MC`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: 27, // cabinet depth (24") + 3" blind-side filler
      fillerRequired: true, fillerWidth: 3, patternId: "magic_corner_explicit",
    };
  }
  if (prefs.cornerTreatment === "quarterTurn" && aLen >= 42 && bLen >= 42) {
    const bbcWidth = aLen >= 48 ? 48 : 42;
    return {
      type: "quarterTurnShelves", sku: `BBC${bbcWidth}-S`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: 27, // cabinet depth (24") + 3" blind-side filler
      fillerRequired: true, fillerWidth: 3, patternId: "quarter_turn_explicit",
    };
  }

  // Diagonal sink base — Kamisar pattern: DSB42-2D at 45° in L-shape corner
  // Requires explicit request or auto when sink is on a corner wall
  if (prefs.cornerTreatment === "diagonalSink" && aLen >= 36 && bLen >= 36) {
    return {
      type: "diagonalSink", sku: "DSB42-2D", size: 42,
      wallAConsumption: 30, wallBConsumption: 30,
      fillerRequired: false, patternId: "sink_diagonal_corner",
      hasSink: true,
    };
  }

  // Auto selection — training-data-driven (Phase 2 CORNER_TREATMENTS)
  // BL36-SS-PH (5× in training) > BBC magic corner (2×) > BL36-PHL (1×)
  // Normalize sophistication: "transitional" → "high" for PRO_DESIGN features
  const cornerSoph = prefs.sophistication === "transitional" ? "high" : (prefs.sophistication || "high");
  if (prefs.cornerTreatment === "auto" || prefs.cornerTreatment === "blindCorner") {
    // Very high sophistication: magic corner (Bollini BBC48R-MC at $3,938)
    // Training: BBC used in 2 premium builds (Bissegger, Bollini)
    if (prefs.cornerTreatment === "auto" && cornerSoph === "very_high" && aLen >= 42 && bLen >= 42) {
      const bbcWidth = aLen >= 48 ? 48 : 42;
      return {
        type: "magicCorner", sku: `BBC${bbcWidth}-MC`, size: bbcWidth,
        wallAConsumption: bbcWidth,
        wallBConsumption: 27, // cabinet depth (24") + 3" blind-side filler
        fillerRequired: true, fillerWidth: 3, patternId: "magic_corner_auto",
        trainingFrequency: CORNER_TREATMENTS.blindCornerMagic?.frequency || 2,
      };
    }

    // High sophistication with LONG walls (both ≥144"): BBC magic corner (professional standard)
    // Training: BBC48R-MC requires enough wall for sink+DW+cabs after consumption.
    // BBC48R consumes 55" of Wall B — on 120" wall that only leaves 65" (too tight for 36"+24"+cabs).
    // Only use BBC48 when shorter wall is ≥144" (leaving 89"+ after consumption).
    const minWall = Math.min(aLen, bLen);
    const bbcConsumption = (aLen >= 48 ? 48 : 42) + 4 + 3;  // BBC width + dead + filler
    if (prefs.cornerTreatment === "auto" && cornerSoph === "high" && aLen >= 48 && bLen >= 48 && (minWall - bbcConsumption) >= 84) {
      const bbcWidth = aLen >= 48 ? 48 : 42;
      return {
        type: "magicCorner", sku: `BBC${bbcWidth}-MC`, size: bbcWidth,
        wallAConsumption: bbcWidth,
        wallBConsumption: 27, // cabinet depth (24") + 3" blind-side filler
        fillerRequired: true, fillerWidth: 3, patternId: "magic_corner_auto_high",
        trainingFrequency: CORNER_TREATMENTS.blindCornerMagic?.frequency || 2,
      };
    }

    // High sophistication: BL36-SS-PH lazy susan (MOST COMMON in training — 7×)
    // Training: Diehl, Eddies, Kline, Lofton, Los Alamos, Showroom all use this
    // Works perfectly for 120"+ walls (consumes only 36" per wall)
    if (prefs.cornerTreatment === "auto" && cornerSoph === "high" && aLen >= 36 && bLen >= 36) {
      return {
        type: "lazySusan", sku: "BL36-SS-PH", size: 36,
        wallAConsumption: 36, wallBConsumption: 36,
        fillerRequired: false, patternId: "lazy_susan_auto",
        trainingFrequency: CORNER_TREATMENTS.blindSuperSusan?.frequency || 7,
      };
    }

    // Standard sophistication + small to medium walls: diagonal lazy susan
    if (prefs.cornerTreatment === "auto" && cornerSoph === "standard" && aLen >= 36 && aLen <= 48 && bLen >= 36 && bLen <= 48) {
      return {
        type: "diagonalLazy", sku: "DSB36-SS", size: 36,
        wallAConsumption: 27, wallBConsumption: 27,
        fillerRequired: false, patternId: "diagonal_lazy_susan_auto",
      };
    }

    // Standard sophistication + LONG walls: quarter-turn shelves (Bissegger BBC42-S)
    // Training: BBC42-S used in Bissegger Great Room
    // BBC42-S consumes 42" on wallA and 49" on wallB — only use when the shorter
    // wall still has ≥84" remaining after consumption (enough for range + flanking cabs).
    // For 120" walls: 120-49=71" remaining — NOT enough. Use BL36 instead.
    if (prefs.cornerTreatment === "auto" && cornerSoph === "standard" && aLen >= 42 && bLen >= 42 && (Math.min(aLen, bLen) - 49) >= 84) {
      return {
        type: "quarterTurnShelves", sku: `BBC42-S`, size: 42,
        wallAConsumption: 42, wallBConsumption: 27, // cabinet depth (24") + 3" filler
        fillerRequired: true, fillerWidth: 3, patternId: "quarter_turn_auto",
      };
    }

    // Standard sophistication: fall through to BL36-SS-PH lazy susan (compact, fits all wall sizes)
    if (prefs.cornerTreatment === "auto" && cornerSoph === "standard" && aLen >= 36 && bLen >= 36) {
      return {
        type: "lazySusan", sku: "BL36-SS-PH", size: 36,
        wallAConsumption: 36, wallBConsumption: 36,
        fillerRequired: false, patternId: "lazy_susan_auto_standard",
        trainingFrequency: 7,
      };
    }

    // Default: BL36-SS-PH (most common in training data — 5 occurrences)
    // Only falls to plain blind corner if walls too small for super susan
    if (aLen >= 36 && bLen >= 36) {
      return {
        type: "lazySusan", sku: "BL36-SS-PH", size: 36,
        wallAConsumption: 36, wallBConsumption: 36,
        fillerRequired: false, patternId: "lazy_susan_default",
        trainingFrequency: CORNER_TREATMENTS.blindSuperSusan.frequency,
      };
    }

    // Small walls: blind corner as last resort
    // Training: BL36-PHL (DeLawyer, 1× budget build)
    const bbcWidth = aLen >= 42 ? 39 : 36;
    return {
      type: "blindCorner", sku: `BL${bbcWidth > 33 ? 36 : 33}-PH`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: 27, // cabinet depth (24") + 3" blind-side filler
      fillerRequired: true, fillerWidth: 3, patternId: "blind_corner_default",
      trainingFrequency: CORNER_TREATMENTS.blindPullHardware.frequency,
    };
  }

  // Fallback
  return {
    type: "blindCorner", sku: "BL36-PH", size: 36,
    wallAConsumption: 36, wallBConsumption: 27, // cabinet depth (24") + 3" filler
    fillerRequired: true, fillerWidth: 3, patternId: "blind_corner_fallback",
  };
}


// ─── END PANEL INSERTION (PRO_DESIGN) ───────────────────────────────────────
// Professional designers add end panels to every exposed end of cabinet runs.
// This creates a finished, built-in look instead of showing cabinet sides.

function addEndPanels(wallLayouts, upperLayouts, walls, corners, prefs) {
  for (const wl of wallLayouts) {
    const baseCabs = wl.cabinets.filter(c => c.type === "base" || c.type === "corner");
    if (baseCabs.length === 0) continue;

    // Check if wall has corners on left/right ends
    const leftCorner = corners.find(c => c.wallB === wl.wallId);
    const rightCorner = corners.find(c => c.wallA === wl.wallId);

    // Find leftmost and rightmost cabinet positions
    const positions = baseCabs.map(c => ({ pos: c.position || 0, width: c.width || 0 }));
    const minPos = Math.min(...positions.map(p => p.pos));
    const maxPos = Math.max(...positions.map(p => p.pos + p.width));

    // Left end panel: add if no left corner consuming that space
    if (!leftCorner && minPos > 0) {
      wl.cabinets.push({
        sku: "BEP3/4-FTK-L/R",
        width: 0.75,
        type: "end_panel",
        role: "base_end_panel",
        position: minPos - 0.75,
        side: "left",
      });
    }

    // Right end panel: add if no right corner consuming that space
    if (!rightCorner) {
      const wallDef = walls.find(w => w.id === wl.wallId);
      const wallLen = wallDef?.length || 96;
      if (maxPos < wallLen) {
        wl.cabinets.push({
          sku: "BEP3/4-FTK-L/R",
          width: 0.75,
          type: "end_panel",
          role: "base_end_panel",
          position: maxPos,
          side: "right",
        });
      }
    }
  }

  // Add upper end panels similarly
  for (const ul of upperLayouts) {
    const upperCabs = ul.cabinets.filter(c =>
      c.type === "wall" || c.type === "wall_stacked_display" || c.type === "refrigerator_wall"
    );
    if (upperCabs.length === 0) continue;

    // Find leftmost and rightmost upper positions
    const positions = upperCabs.map(c => ({ pos: c.position || 0, width: c.width || 0 }));
    if (positions.length === 0) continue;

    const minPos = Math.min(...positions.map(p => p.pos));
    const maxPos = Math.max(...positions.map(p => p.pos + p.width));

    // Get upper height from first cab
    const firstUpper = upperCabs[0];
    const upperH = firstUpper.height || 39;

    // Left FWEP
    if (minPos > 0) {
      ul.cabinets.push({
        sku: "FWEP3/4-L/R-27\"",
        width: 0.75,
        height: upperH,
        type: "end_panel",
        role: "wall_end_panel",
        position: minPos - 0.75,
        side: "left",
      });
    }

    // Right FWEP
    const wallDef = walls.find(w => w.id === ul.wallId);
    const wallLen = wallDef?.length || 96;
    if (maxPos < wallLen) {
      ul.cabinets.push({
        sku: "FWEP3/4-L/R-27\"",
        width: 0.75,
        height: upperH,
        type: "end_panel",
        role: "wall_end_panel",
        position: maxPos,
        side: "right",
      });
    }
  }
}


// ─── WALL SOLVER ────────────────────────────────────────────────────────────

function solveWall(wall, appliances, corners, prefs, golaPrefix) {
  let availableLength = wall.length;
  const cabinets = [];
  const role = wall.role || inferWallRole(appliances);

  // Subtract corner consumption
  let leftConsumed = 0;
  let rightConsumed = 0;
  for (const corner of corners) {
    if (corner.wallA === wall.id) {
      rightConsumed = corner.wallAConsumption;
    }
    if (corner.wallB === wall.id) {
      leftConsumed = corner.wallBConsumption;
      if (corner.fillerRequired) {
        cabinets.push({ sku: 'F330', width: corner.fillerWidth, role: "corner-filler", position: leftConsumed - corner.fillerWidth, wall: wall.id });
      }
    }
  }
  availableLength -= leftConsumed + rightConsumed;

  // Filter out hoods from base-level placement — hoods are ceiling-mounted and don't consume floor space.
  // They are handled in solveUppers() instead, placed above the range/cooktop.
  const baseAppliances = appliances.filter(a => a.type !== "hood");

  // Sort appliances by position (or infer positioning)
  const positioned = positionAppliances(baseAppliances, availableLength, leftConsumed, wall, prefs);

  // Capture placement warnings
  const placementWarnings = positioned._warnings || [];

  // Inject door/entry openings as pseudo-appliances so buildSegments skips those zones
  if (wall.openings) {
    for (const opening of wall.openings) {
      if (opening.type === "door" || opening.type === "entry" || opening.type === "archway") {
        const doorStart = (opening.posFromLeft || 0);
        const doorW = opening.width || 36;
        positioned.push({
          type: "door_opening",
          width: doorW,
          position: doorStart,
          _isDoorZone: true,
        });
      }
    }
  }

  // Build segments between fixed points
  const segments = buildSegments(positioned, availableLength, leftConsumed);

  // Fill each segment with appropriate cabinets
  for (const seg of segments) {
    const filled = fillWallSegment(seg, role, prefs, golaPrefix);
    cabinets.push(...filled);
  }

  // Insert appliance placeholders (with depth metadata) — skip door zones
  // PRO_DESIGN: Sinks get SB (sink base) SKU — a real cabinet that appears in BOM
  // Training: SB36 (57% of sinks), SB33 (4×), SB36-FHD (4× in premium builds)
  for (const app of positioned) {
    if (app._isDoorZone) continue;
    const entry = {
      type: "appliance",
      applianceType: app.type,
      width: app.width,
      model: app.model,
      position: app.position,
      position_start: app.position,
      position_end: app.position + (app.width || 0),
      wall: wall.id,
      _depthOverhang: app._depthOverhang || 0,
      _depth: app._depth || DIMS.baseDepth,
    };
    // Assign SB SKU for sinks — the sink fixture sits IN a sink base cabinet
    if (app.type === "sink") {
      const sinkW = findClosestWidth(app.width, PRO_DESIGN.sinkBases.fullHeightDoor.typicalWidths, "nearest") || app.width;
      const soph = prefs.sophistication === "transitional" ? "high" : (prefs.sophistication || "high");
      // Training: SB36-FHD in premium builds (Bollini, Owen), standard SB36 otherwise
      if (soph === "very_high" || soph === "high") {
        entry.sku = `${golaPrefix}SB${sinkW}-FHD`;
      } else {
        entry.sku = `${golaPrefix}SB${sinkW}`;
      }
      entry.role = "sink-base";
    }
    cabinets.push(entry);
  }

  // Sort by position
  cabinets.sort((a, b) => (a.position || 0) - (b.position || 0));

  // ══════════════════════════════════════════════════════════════
  // CORNER-FIRST ANCHOR-BASED CHAIN INTEGRITY ENFORCEMENT
  // ══════════════════════════════════════════════════════════════
  //
  // Design rule: Corners are ANCHORS. All cabinet runs chain from
  // corner edges. The corner occupies a fixed footprint; adjacent
  // cabinets must snap to that footprint's boundary.
  //
  // Coordinate system:
  //   leftConsumed = corner B consumption (left anchor)
  //   wallEndPos   = wall.length - rightConsumed (right anchor)
  //   cab[0].position_start MUST equal leftConsumed (or 0 if no left corner)
  //   cab[last].position_end MUST equal wallEndPos (or wall.length if no right corner)
  //   cab[i].position_end === cab[i+1].position_start (zero gap between)

  const wallStartAnchor = leftConsumed;      // left corner edge (or 0)
  const wallEndAnchor = wall.length - rightConsumed; // right corner edge (or wall.length)

  // Step 1: Assign position_start / position_end to every cabinet
  for (const cab of cabinets) {
    cab.position_start = cab.position ?? 0;
    cab.position_end = (cab.position ?? 0) + (cab.width || 0);
  }

  // Step 2: Corner-first anchor snap
  // Ensure first non-filler cabinet starts at the left anchor
  const realCabs = cabinets.filter(c => c.type !== 'end_panel' && c.role !== 'corner-filler');
  if (realCabs.length > 0) {
    const firstCab = realCabs[0];
    const drift = firstCab.position_start - wallStartAnchor;
    if (Math.abs(drift) > 0 && Math.abs(drift) <= 6) {
      // Snap first cabinet to left anchor
      firstCab.position = wallStartAnchor;
      firstCab.position_start = wallStartAnchor;
      firstCab.position_end = wallStartAnchor + (firstCab.width || 0);
    }
  }

  // Step 3: Enforce strict chain — snap each cabinet to end of previous
  // This treats the wall as a 1D coordinate line: no gaps, no overlaps.
  for (let i = 1; i < cabinets.length; i++) {
    const prev = cabinets[i - 1];
    const curr = cabinets[i];
    if (curr.type === 'end_panel' || curr.role === 'corner-filler') continue;
    if (prev.type === 'end_panel' || prev.role === 'corner-filler') continue;

    const prevEnd = prev.position_end;
    const delta = curr.position_start - prevEnd;

    // Close micro-gaps (≤ 1") by snapping
    if (delta > 0 && delta <= 1) {
      curr.position = prevEnd;
      curr.position_start = prevEnd;
      curr.position_end = prevEnd + (curr.width || 0);
    }
    // Fix overlaps: shift right
    else if (delta < -0.1) {
      curr.position = prevEnd;
      curr.position_start = prevEnd;
      curr.position_end = prevEnd + (curr.width || 0);
    }
    // Gap 1-6": insert a filler to close
    else if (delta > 1 && delta <= 6) {
      const fillerSku = delta <= 3
        ? 'OVF3'
        : `F${Math.ceil(delta)}30`;
      cabinets.splice(i, 0, {
        sku: fillerSku,
        width: delta,
        type: "filler",
        role: "chain_filler",
        position: prevEnd,
        position_start: prevEnd,
        position_end: prevEnd + delta,
        _chainEnforced: true,
      });
      i++; // skip inserted filler
    }
    // Gap > 6": this is an appliance segment boundary — leave it but log
  }

  // Step 4: Terminal gap — close to right anchor (corner edge or wall end)
  const sortedFinal = cabinets
    .filter(c => c.type !== 'end_panel' && c.role !== 'corner-filler')
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const lastCab = sortedFinal[sortedFinal.length - 1];
  const actualEnd = lastCab ? lastCab.position_end : wallStartAnchor;
  const terminalGap = wallEndAnchor - actualEnd;

  if (terminalGap > 0.5 && terminalGap <= 6 && lastCab) {
    const fillerSku = terminalGap <= 3
      ? 'OVF3'
      : `F${Math.ceil(terminalGap)}30`;
    cabinets.push({
      sku: fillerSku,
      width: terminalGap,
      type: "filler",
      role: "terminal_filler",
      position: actualEnd,
      position_start: actualEnd,
      position_end: actualEnd + terminalGap,
      _chainEnforced: true,
    });
  } else if (terminalGap > 6 && lastCab && lastCab.type === "base") {
    // Try width mod to absorb gap (professional approach)
    const newWidth = lastCab.width + terminalGap;
    if (newWidth <= 54) {
      lastCab.width = newWidth;
      lastCab.position_end = lastCab.position_start + newWidth;
      lastCab.sku = buildSku(lastCab.sku.replace(/\d+/, ''), newWidth, golaPrefix);
      lastCab.modified = { type: "MOD WIDTH N/C", gapAbsorbed: terminalGap };
      lastCab._chainEnforced = true;
    }
  }

  // Step 5: Starting gap — close to left anchor
  const firstReal = cabinets
    .filter(c => c.type !== 'end_panel' && c.role !== 'corner-filler')
    .sort((a, b) => (a.position || 0) - (b.position || 0))[0];
  if (firstReal) {
    const startGap = firstReal.position_start - wallStartAnchor;
    if (startGap > 0.5 && startGap <= 6) {
      const fillerSku = startGap <= 3
        ? 'OVF3'
        : `F${Math.ceil(startGap)}30`;
      cabinets.push({
        sku: fillerSku,
        width: startGap,
        type: "filler",
        role: "start_filler",
        position: wallStartAnchor,
        position_start: wallStartAnchor,
        position_end: wallStartAnchor + startGap,
        _chainEnforced: true,
      });
      cabinets.sort((a, b) => (a.position || 0) - (b.position || 0));
    }
  }

  // Step 6: Validate chain integrity
  const chainCabs = cabinets
    .filter(c => c.type !== 'end_panel' && c.role !== 'corner-filler')
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const chainResult = linearValidateChain(chainCabs.map(c => ({
    sku: c.sku || c.applianceType,
    position_start: c.position_start,
    position_end: c.position_end,
    width: c.width,
  })));

  if (!chainResult.valid) {
    for (const brk of chainResult.breaks) {
      placementWarnings.push({
        type: 'chain_break',
        message: `Chain break on wall ${wall.id}: ${brk.prevSku} ends at ${brk.prevEnd}", ${brk.nextSku} starts at ${brk.nextStart}" (gap: ${brk.gap}")`,
      });
    }
  }

  // Step 7: Anchor verification — log if first/last don't hit anchor exactly
  if (chainCabs.length > 0) {
    const fStart = chainCabs[0].position_start;
    const lEnd = chainCabs[chainCabs.length - 1].position_end;
    if (Math.abs(fStart - wallStartAnchor) > 1) {
      placementWarnings.push({
        type: 'anchor_drift_left',
        message: `Wall ${wall.id}: first cabinet starts at ${fStart}" but left anchor is ${wallStartAnchor}" (drift: ${(fStart - wallStartAnchor).toFixed(1)}")`,
      });
    }
    if (Math.abs(lEnd - wallEndAnchor) > 1) {
      placementWarnings.push({
        type: 'anchor_drift_right',
        message: `Wall ${wall.id}: last cabinet ends at ${lEnd}" but right anchor is ${wallEndAnchor}" (drift: ${(wallEndAnchor - lEnd).toFixed(1)}")`,
      });
    }
  }

  return {
    wallId: wall.id,
    wallLength: wall.length,
    role,
    cabinets,
    corners: corners.map(c => c.id),
    availableAfterCorners: availableLength,
    chainIntegrity: chainResult.valid,
    cornerAnchors: { left: wallStartAnchor, right: wallEndAnchor },
    _warnings: placementWarnings,
  };
}


// ─── APPLIANCE POSITIONING ──────────────────────────────────────────────────

// ─── APPLIANCE DEPTH CONSTANTS ──────────────────────────────────────────────
// Sourced from BIG_FOUR.depths (constraints.js). When the solver places an
// appliance whose depth exceeds DIMS.baseDepth it tags the placement so the
// renderer can show a depth overhang callout and the validator can warn.
// Legacy range depth 29" (Wolf/Thermador pro ranges 28-30") kept as override.
const APPLIANCE_DEPTHS = { ...BIG_FOUR.depths };

// Brand-aware depth resolution: when a specific brand is known, use its exact depth.
// This affects depth protrusion calculations in the SVG projector.
function getApplianceDepth(app) {
  if (app.depth) return app.depth; // explicit depth from input
  if ((app.type === 'range' || app.type === 'cooktop') && app.brand && BIG_FOUR.rangeDepthByBrand) {
    return BIG_FOUR.rangeDepthByBrand[app.brand] || APPLIANCE_DEPTHS.range;
  }
  if ((app.type === 'refrigerator' || app.type === 'freezer') && app.panelReady && BIG_FOUR.fridgePlanningDepth) {
    return BIG_FOUR.fridgePlanningDepth.integrated; // 25" for panel-ready
  }
  return APPLIANCE_DEPTHS[app.type] || DIMS.baseDepth;
}

// ─── PRE-COMPUTED STANDARD GAP SET ─────────────────────────────────────────
// Valid gap widths fillable by 1-4 standard cabinets. Computed once at load.
const _STD_WIDTHS = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42];
const _VALID_GAPS = new Set([0]);
for (const w1 of _STD_WIDTHS) {
  _VALID_GAPS.add(w1);
  for (const w2 of _STD_WIDTHS) {
    _VALID_GAPS.add(w1 + w2);
    for (const w3 of _STD_WIDTHS) {
      const s3 = w1 + w2 + w3;
      if (s3 <= 130) _VALID_GAPS.add(s3);
      for (const w4 of _STD_WIDTHS) {
        const s4 = s3 + w4;
        if (s4 <= 170) _VALID_GAPS.add(s4);
      }
    }
  }
}

/**
 * Check if a gap width is fillable with standard cabinets.
 */
function isStandardGap(gap) {
  if (gap <= 0) return true;
  return _VALID_GAPS.has(Math.round(gap));
}

/**
 * Generate all valid snapped positions for an appliance within a range.
 * Returns sorted array of positions where gaps to boundaries are standard-fillable.
 */
function validPositions(appWidth, rangeStart, rangeEnd, step = 3) {
  const positions = [];
  for (let pos = rangeStart; pos + appWidth <= rangeEnd; pos += step) {
    const leftGap = Math.round(pos - rangeStart);
    const rightGap = Math.round(rangeEnd - (pos + appWidth));
    if (isStandardGap(leftGap) && isStandardGap(rightGap)) {
      positions.push(pos);
    }
  }
  // Also check exact boundary positions
  if (isStandardGap(0) && rangeStart + appWidth <= rangeEnd) {
    if (!positions.includes(rangeStart)) positions.unshift(rangeStart);
  }
  return positions;
}


// ─── PROJECT 1: CONSTRAINT-SATISFACTION APPLIANCE PLACEMENT ────────────────
// Two-phase solver:
//   Phase A: Reserve zones for all appliances based on design principles
//            (fridge at wall end, range centered in remaining, sink on its wall)
//   Phase B: Score candidate positions within zones considering NKBA landing,
//            symmetry, work triangle, and standard-gap fillability.
// This prevents cascading failures where early greedy placements block later ones.

function positionAppliances(appliances, available, offset, wall, prefs) {
  const _warnings = [];
  const wallEnd = offset + available;
  const wallDef = wall || {};

  // Filter hoods — they don't consume floor space
  const floorApps = appliances.filter(a => a.type !== "hood");
  if (floorApps.length === 0) return Object.assign([], { _warnings });

  // Pre-claim door zones
  const doorZones = [];
  if (wallDef.openings) {
    for (const op of wallDef.openings) {
      if (op.type === "door" || op.type === "entry" || op.type === "archway") {
        doorZones.push({ start: op.posFromLeft || 0, end: (op.posFromLeft || 0) + (op.width || 32) });
      }
    }
  }
  const inDoorZone = (s, e) => doorZones.some(d => s < d.end && e > d.start);

  // Separate fixed vs free
  const fixed = floorApps.filter(a => typeof a.position === "number");
  const free = floorApps.filter(a => typeof a.position !== "number");
  free.sort((a, b) => (BIG_FOUR.priority[a.type] ?? 5) - (BIG_FOUR.priority[b.type] ?? 5));

  const placed = [];
  const claimed = [];

  // Pre-claim fixed positions
  for (const f of fixed) {
    const w = f.width || 30;
    placed.push({ ...f, position: f.position, _depth: f.depth || APPLIANCE_DEPTHS[f.type] || DIMS.baseDepth });
    claimed.push({ start: f.position, end: f.position + w, type: f.type });
  }
  for (const dz of doorZones) {
    claimed.push({ start: dz.start, end: dz.end, type: "door_opening" });
  }

  const isClaimed = (s, e) => claimed.some(c => s < c.end && e > c.start);

  // ── Phase A: Pre-compute reserved zones for major appliances ──
  // This lets the range scorer know where the fridge will go.
  const fridge = free.find(a => a.type === "refrigerator" || a.type === "freezer");
  const range = free.find(a => a.type === "range" || a.type === "cooktop");
  const sink = free.find(a => a.type === "sink");
  const dw = free.find(a => a.type === "dishwasher");
  const fridgeW = fridge ? (fridge.width || 36) : 0;
  const rangeW = range ? (range.width || 30) : 0;
  const sinkW = sink ? (sink.width || 36) : 0;
  const dwW = dw ? (dw.width || 24) : 0;

  // Fridge reservation: at the OPEN TERMINAL of the wall (away from the corner).
  // In L/U/G shapes, the corner consumes one end — the fridge goes at the opposite end
  // so it's the first appliance reached from the kitchen entry (grocery unloading logic).
  // Rule: "The refrigerator should be at the end of a cabinet run, not buried in the middle."
  // Rule: "The refrigerator should ideally be the first appliance you reach when entering the kitchen."
  const isMultiWall = prefs._layoutType === 'l-shape' || prefs._layoutType === 'u-shape' || prefs._layoutType === 'g-shape';
  let fridgeReservedStart = null, fridgeReservedEnd = null;
  if (fridge) {
    // Determine which end is the open terminal (away from corner).
    // If offset > 0, the corner consumed the left side → open terminal is at the RIGHT (wallEnd).
    // If offset === 0 and available < wall.length, corner consumed the right side → open terminal is LEFT (offset).
    // For single-wall layouts, prefer left end (entry side by convention).
    const cornerOnLeft = offset > 0;
    const cornerOnRight = !cornerOnLeft && available < (wallDef.length || available);

    let openTerminalPos, cornerTerminalPos;
    if (isMultiWall) {
      if (cornerOnLeft) {
        // Corner is on the left → fridge goes at right (wallEnd - fridgeW)
        openTerminalPos = wallEnd - fridgeW;
        cornerTerminalPos = offset;
      } else {
        // Corner is on the right (or no corner on this wall) → fridge goes at left (offset)
        openTerminalPos = offset;
        cornerTerminalPos = wallEnd - fridgeW;
      }
    } else {
      // Single wall: fridge at left end (entry convention)
      openTerminalPos = offset;
      cornerTerminalPos = wallEnd - fridgeW;
    }

    // Try open terminal first, then corner terminal as fallback
    if (!inDoorZone(openTerminalPos, openTerminalPos + fridgeW) && !isClaimed(openTerminalPos, openTerminalPos + fridgeW)) {
      fridgeReservedStart = openTerminalPos;
    } else if (!inDoorZone(cornerTerminalPos, cornerTerminalPos + fridgeW) && !isClaimed(cornerTerminalPos, cornerTerminalPos + fridgeW)) {
      fridgeReservedStart = cornerTerminalPos;
    } else {
      fridgeReservedStart = openTerminalPos; // fallback
    }
    fridgeReservedEnd = fridgeReservedStart + fridgeW;
  }

  // Effective zone for range placement (exclude fridge reservation).
  // The range goes in the space between the fridge and the corner (or wall end).
  let rangeZoneStart, rangeZoneEnd;
  if (fridge) {
    if (fridgeReservedStart <= offset) {
      // Fridge is at the left end → range zone is to the right of fridge
      rangeZoneStart = fridgeReservedEnd;
      rangeZoneEnd = wallEnd;
    } else {
      // Fridge is at the right end → range zone is to the left of fridge
      rangeZoneStart = offset;
      rangeZoneEnd = fridgeReservedStart;
    }
  } else {
    rangeZoneStart = offset;
    rangeZoneEnd = wallEnd;
  }

  // ── Phase B: Place each appliance with scoring ──
  for (const app of free) {
    const w = app.width || 30;
    let bestPos = null, bestScore = -Infinity;

    if (app.type === "refrigerator" || app.type === "freezer") {
      // Use pre-computed reservation
      bestPos = fridgeReservedStart;
      if (bestPos !== null && isClaimed(bestPos, bestPos + w)) {
        // Reservation conflicts — scan for alternatives
        for (let pos = wallEnd - w; pos >= offset; pos -= 3) {
          if (!isClaimed(pos, pos + w) && !inDoorZone(pos, pos + w)) {
            bestPos = pos;
            break;
          }
        }
      }
    } else if (app.type === "range" || app.type === "cooktop") {
      // Range: place within zone excluding fridge reservation
      // Scoring: NKBA landing + symmetry within usable zone + triangle tightness
      const effectiveEnd = rangeZoneEnd;
      const effectiveAvail = effectiveEnd - rangeZoneStart;
      const minLeft = LANDING.range.oneSide;    // 12"
      const minRight = LANDING.range.otherSide; // 15"

      // Generate candidates snapped to standard grid within usable zone
      for (let pos = rangeZoneStart; pos + w <= effectiveEnd; pos += 3) {
        if (inDoorZone(pos, pos + w)) continue;
        if (isClaimed(pos, pos + w)) continue;

        const snapped = snapToNearestValid(pos, rangeZoneStart, effectiveEnd, w);
        if (snapped === null || isClaimed(snapped, snapped + w)) continue;

        // Score this position
        const leftGap = snapped - rangeZoneStart;
        const rightGap = effectiveEnd - (snapped + w);
        let score = 0;

        // NKBA landing compliance
        const smaller = Math.min(leftGap, rightGap);
        const larger = Math.max(leftGap, rightGap);
        if (smaller >= minLeft) score += 30;
        if (larger >= minRight) score += 30;

        // Symmetry bonus within usable zone (excluding fridge)
        // Perfect symmetry = equal gaps on both sides
        if (larger > 0) {
          const ratio = smaller / larger;
          score += ratio * 50; // up to 50 points for perfect symmetry
        }

        // Standard-gap fillability — both sides must be fillable by stock cabs
        if (isStandardGap(leftGap)) score += 15;
        else score -= 10;
        if (isStandardGap(rightGap)) score += 15;
        else score -= 10;

        // Range centering: in any layout, prefer the range centered within its available zone.
        // Rule: "Symmetry matters around focal points. If the range has a decorative hood,
        // the cabinets flanking it should be the same width."
        // The symmetry bonus above already rewards equal gaps, but we add a mild centering nudge.
        // We do NOT push range toward the corner — that would violate symmetry and
        // create awkward narrow gaps on one side.
        if (effectiveAvail > 0) {
          const idealCenter = rangeZoneStart + Math.round((effectiveAvail - w) / 2);
          const distFromIdeal = Math.abs(snapped - idealCenter);
          score += Math.max(0, 10 - distFromIdeal * 10 / (effectiveAvail / 2));
        }

        // Unfillable gap penalty (gap < 9" can't fit any cabinet)
        if (leftGap > 0 && leftGap < 9) score -= 30;
        if (rightGap > 0 && rightGap < 9) score -= 30;

        if (score > bestScore) { bestScore = score; bestPos = snapped; }
      }

      // Also try exact center of usable zone
      const centerPos = rangeZoneStart + Math.round((effectiveAvail - w) / 2);
      const snappedCenter = snapToNearestValid(centerPos, rangeZoneStart, effectiveEnd, w);
      if (snappedCenter !== null && !isClaimed(snappedCenter, snappedCenter + w) && !inDoorZone(snappedCenter, snappedCenter + w)) {
        const leftGap = snappedCenter - rangeZoneStart;
        const rightGap = effectiveEnd - (snappedCenter + w);
        let score = 0;
        if (Math.min(leftGap, rightGap) >= minLeft) score += 30;
        if (Math.max(leftGap, rightGap) >= minRight) score += 30;
        if (leftGap > 0 && rightGap > 0) score += (Math.min(leftGap, rightGap) / Math.max(leftGap, rightGap)) * 50;
        if (isStandardGap(leftGap)) score += 15;
        if (isStandardGap(rightGap)) score += 15;
        if (leftGap > 0 && leftGap < 9) score -= 30;
        if (rightGap > 0 && rightGap < 9) score -= 30;
        // Centering bonus (center position gets max bonus by definition)
        score += 10;
        if (score > bestScore) { bestScore = score; bestPos = snappedCenter; }
      }

    } else if (app.type === "sink") {
      // Sink: needs landing on both sides. Accounts for DW placement.
      // Two-pass approach: first try with snap validation, then relax if no position found.
      for (let pass = 0; pass < 2; pass++) {
        if (bestPos !== null) break; // found in first pass
        for (let pos = offset; pos + w <= wallEnd; pos += 3) {
          if (inDoorZone(pos, pos + w) || isClaimed(pos, pos + w)) continue;

          // Pass 0: use snapToNearestValid for ideal fillability
          // Pass 1: accept any unclaimed position (relaxed - don't require snap)
          let snapped;
          if (pass === 0) {
            // Compute effective range accounting for claimed zones
            let effectiveEnd = wallEnd;
            for (const c of claimed) {
              if (c.start > pos && c.start < effectiveEnd) effectiveEnd = c.start;
            }
            snapped = snapToNearestValid(pos, offset, effectiveEnd, w);
            if (snapped === null || isClaimed(snapped, snapped + w)) continue;
          } else {
            // Relaxed pass: just use the position directly if unclaimed
            snapped = pos;
          }

          let score = 0;
          // Effective landing: consider already-placed appliances
          let effectiveLeft = snapped - offset;
          let effectiveRight = wallEnd - (snapped + w);
          for (const c of claimed) {
            if (c.end <= snapped && c.end > offset) effectiveLeft = Math.min(effectiveLeft, snapped - c.end);
            if (c.start >= snapped + w && c.start < wallEnd) effectiveRight = Math.min(effectiveRight, c.start - (snapped + w));
          }

          const primary = Math.max(effectiveLeft, effectiveRight);
          const secondary = Math.min(effectiveLeft, effectiveRight);

          // NKBA landing
          if (primary >= LANDING.sink.primary) score += 40;
          else score += (primary / LANDING.sink.primary) * 40;
          if (secondary >= LANDING.sink.secondary) score += 30;
          else score += (secondary / LANDING.sink.secondary) * 30;

          // Room for DW adjacent
          if (dw) {
            const canDWright = snapped + w + dwW <= wallEnd && !isClaimed(snapped + w, snapped + w + dwW);
            const canDWleft = snapped - dwW >= offset && !isClaimed(snapped - dwW, snapped);
            if (canDWright || canDWleft) score += 20;
            else score -= 30;

            let bestMaxLanding = 0;
            if (canDWright) {
              const rightLanding = wallEnd - (snapped + w + dwW);
              const leftLanding = snapped - offset;
              bestMaxLanding = Math.max(bestMaxLanding, Math.max(leftLanding, rightLanding));
            }
            if (canDWleft) {
              const rightLanding = wallEnd - (snapped + w);
              const leftLanding = (snapped - dwW) - offset;
              bestMaxLanding = Math.max(bestMaxLanding, Math.max(leftLanding, rightLanding));
            }
            if (bestMaxLanding >= 24) score += 25;
            else if (bestMaxLanding >= 18) score += 15;
            else if (bestMaxLanding >= 12) score += 5;
            else score -= 15;
          }

          // Standard-gap fillability
          if (isStandardGap(effectiveLeft)) score += 10;
          if (isStandardGap(effectiveRight)) score += 10;

          // Triangle tightness: in L-shapes, sink should be near the corner side
          if (isMultiWall) {
            const distFromCorner = snapped - offset;
            if (distFromCorner >= 0 && distFromCorner < 24) {
              score -= 20;
            } else if (distFromCorner <= available * 0.5) {
              score += 15;
            }
          }

          // Unfillable gap penalty
          if (effectiveLeft > 0 && effectiveLeft < 9) score -= 25;
          if (effectiveRight > 0 && effectiveRight < 9) score -= 25;

          // Pass 1 penalty to prefer pass 0 results when available
          if (pass === 1) score -= 5;

          if (score > bestScore) { bestScore = score; bestPos = snapped; }
        }
      }

    } else if (app.type === "dishwasher") {
      // DW: must be adjacent to sink.
      // Rule: "Place DW on the side of the sink closest to the primary dish cabinet/drawer storage."
      // Rule: "Never place a dishwasher at a right angle to the sink in a corner."
      // In L-shapes, DW goes on the OUTBOARD side (away from corner) so DW door
      // doesn't conflict with the corner cabinet and DW is closer to dish storage.
      const sinkPlaced = placed.find(p => p.type === "sink");
      if (sinkPlaced) {
        const sinkEnd = sinkPlaced.position + sinkPlaced.width;
        const sinkStart = sinkPlaced.position;

        // Determine corner side vs open side
        const cornerOnLeftSide = offset > 0;
        // If corner is on left, outboard = right of sink. If corner is on right, outboard = left of sink.
        const posRight = sinkEnd;
        const posLeft = sinkStart - w;

        // Score both sides
        const tryPos = (pos, side) => {
          if (pos < offset || pos + w > wallEnd || isClaimed(pos, pos + w) || inDoorZone(pos, pos + w)) return -Infinity;
          // Effective cabinet landing on each side of the sink+DW unit
          let cabLeft, cabRight;
          if (pos >= sinkEnd) {
            // DW is right of sink
            cabLeft = sinkStart - offset;
            cabRight = wallEnd - (pos + w);
          } else {
            // DW is left of sink
            cabLeft = pos - offset;
            cabRight = wallEnd - sinkEnd;
          }
          let score = 50; // base score for adjacency
          const maxLanding = Math.max(cabLeft, cabRight);
          score += maxLanding * 0.8; // reward larger contiguous landing
          score += Math.min(cabLeft, cabRight) * 0.3; // mild balance bonus
          if (isStandardGap(cabLeft)) score += 10;
          if (isStandardGap(cabRight)) score += 10;
          if (cabLeft > 0 && cabLeft < 9) score -= 20;
          if (cabRight > 0 && cabRight < 9) score -= 20;

          // In multi-wall layouts, STRONGLY prefer the outboard side (away from corner).
          // This prevents DW door from conflicting with corner cabinet and keeps
          // DW closer to open dish storage area.
          if (isMultiWall) {
            const isOutboardSide = (cornerOnLeftSide && side === 'right') || (!cornerOnLeftSide && side === 'left');
            if (isOutboardSide) score += 40; // strong preference for outboard
            else score -= 20; // penalty for corner-side DW
          }
          return score;
        };

        const scoreRight = tryPos(posRight, 'right');
        const scoreLeft = tryPos(posLeft, 'left');

        if (scoreRight >= scoreLeft && scoreRight > -Infinity) {
          bestPos = posRight;
        } else if (scoreLeft > -Infinity) {
          bestPos = posLeft;
        } else {
          // Neither adjacent position works — scan outward
          for (let delta = 1; delta < available; delta += 3) {
            if (posRight + delta + w <= wallEnd && !isClaimed(posRight + delta, posRight + delta + w)) {
              bestPos = posRight + delta;
              break;
            }
            if (posLeft - delta >= offset && !isClaimed(posLeft - delta, posLeft - delta + w)) {
              bestPos = posLeft - delta;
              break;
            }
          }
        }
      } else {
        // No sink on this wall — find unclaimed position near center
        const idealCenter = offset + Math.round((available - w) / 2);
        // Try center first, then scan outward
        if (!isClaimed(idealCenter, idealCenter + w)) {
          bestPos = idealCenter;
        } else {
          for (let delta = 3; delta < available; delta += 3) {
            const tryRight = idealCenter + delta;
            const tryLeft = idealCenter - delta;
            if (tryRight + w <= wallEnd && !isClaimed(tryRight, tryRight + w)) {
              bestPos = tryRight;
              break;
            }
            if (tryLeft >= offset && !isClaimed(tryLeft, tryLeft + w)) {
              bestPos = tryLeft;
              break;
            }
          }
        }
      }

    } else {
      // Other appliances: find any unclaimed position
      for (let pos = offset; pos + w <= wallEnd; pos += 3) {
        if (!isClaimed(pos, pos + w) && !inDoorZone(pos, pos + w)) {
          bestPos = pos;
          break;
        }
      }
    }

    if (bestPos === null) {
      _warnings.push({ type: "no_space", applianceType: app.type,
        message: `Cannot place ${app.type} (${w}") on wall ${wallDef.id} — no valid position. Skipped.` });
      continue;
    }

    const appDepth = getApplianceDepth(app);
    let depthOverhang = 0;
    if (appDepth > DIMS.baseDepth) {
      depthOverhang = Math.round((appDepth - DIMS.baseDepth) * 10) / 10;
    }

    placed.push({ ...app, position: Math.round(bestPos), _depthOverhang: depthOverhang, _depth: appDepth });
    claimed.push({ start: Math.round(bestPos), end: Math.round(bestPos) + w, type: app.type });
  }

  // ── Post-placement: verify DW adjacency to sink ──
  const sinkP = placed.find(a => a.type === "sink");
  const dwP = placed.find(a => a.type === "dishwasher");
  if (sinkP && dwP) {
    const sinkEnd = sinkP.position + sinkP.width;
    const sinkStart = sinkP.position;
    const dwEnd = dwP.position + dwP.width;
    const dist = Math.min(Math.abs(dwP.position - sinkEnd), Math.abs(sinkStart - dwEnd));
    if (dist > 1) {
      // DW not adjacent — correct it
      const dwClaimIdx = claimed.findIndex(c => c.type === "dishwasher");
      if (dwClaimIdx >= 0) claimed.splice(dwClaimIdx, 1);

      const canGoRight = sinkEnd + dwP.width <= wallEnd && !isClaimed(sinkEnd, sinkEnd + dwP.width);
      const canGoLeft = sinkStart - dwP.width >= offset && !isClaimed(sinkStart - dwP.width, sinkStart);

      if (canGoRight && canGoLeft) {
        const minR = Math.min(wallEnd - (sinkEnd + dwP.width), sinkP.position - offset);
        const minL = Math.min(wallEnd - sinkEnd, (sinkStart - dwP.width) - offset);
        dwP.position = minL > minR ? sinkStart - dwP.width : sinkEnd;
      } else if (canGoRight) {
        dwP.position = sinkEnd;
      } else if (canGoLeft) {
        dwP.position = sinkStart - dwP.width;
      }
      claimed.push({ start: dwP.position, end: dwP.position + dwP.width, type: "dishwasher" });
    }
  }

  placed._warnings = _warnings;
  return placed.sort((a, b) => a.position - b.position);
}

/**
 * Snap position to nearest value where gaps from both offset and wallEnd are standard-fillable.
 */
function snapToNearestValid(preferred, rangeStart, rangeEnd, appWidth) {
  let bestPos = null, bestDist = Infinity;
  for (const gap of _VALID_GAPS) {
    const pos = rangeStart + gap;
    if (pos + appWidth > rangeEnd || pos < rangeStart) continue;
    const rightGap = Math.round(rangeEnd - (pos + appWidth));
    if (rightGap >= 0 && _VALID_GAPS.has(rightGap)) {
      const dist = Math.abs(pos - preferred);
      if (dist < bestDist) { bestDist = dist; bestPos = pos; }
    }
  }
  return bestPos;
}



// ─── SEGMENT BUILDER ────────────────────────────────────────────────────────

function buildSegments(positionedAppliances, available, offset) {
  const segments = [];
  let cursor = offset;
  let prevType = null;

  // Safety: sort appliances by position to ensure correct segment building
  const sorted = [...positionedAppliances].sort((a, b) => a.position - b.position);

  for (const app of sorted) {
    const gapLength = Math.round(app.position - cursor);
    if (gapLength > 0) {
      segments.push({
        start: cursor,
        end: app.position,
        length: gapLength,
        leftOf: app.type,
        rightOf: prevType,
      });
    } else if (gapLength < -1) {
      // Negative gap = overlap detected post-placement (should not happen after fix,
      // but guard against it). Skip the overlap zone.
      // This means the previous appliance extends past this one's start position.
    }
    cursor = Math.max(cursor, app.position + app.width); // never go backwards
    prevType = app.type;
  }

  // Remaining space after last appliance
  const endPos = offset + available;
  const remainingLength = Math.round(endPos - cursor);
  if (remainingLength > 0) {
    segments.push({
      start: cursor,
      end: endPos,
      length: remainingLength,
      leftOf: null,
      rightOf: prevType,
    });
  }

  return segments;
}


// ─── SEGMENT FILLER ─────────────────────────────────────────────────────────

function fillWallSegment(segment, wallRole, prefs, golaPrefix) {
  const { length, leftOf, rightOf } = segment;
  if (length < 3) return []; // too small for any cabinet

  // ── PROJECT 3: Zone-aware segment fill with functional roles ──
  // Each segment gets a functional zone classification that drives cabinet
  // selection and provides labeling for the renderer's zone annotations.
  const zone = classifyZone(leftOf, rightOf, wallRole, prefs.roomType);

  // Assign human-readable functional description for renderer annotations
  const zoneFunctions = {
    rangeFlanking: "Prep & Cook Zone",
    sinkAdjacent: "Clean-Up Zone",
    fridgeAdjacent: "Cold Storage Zone",
    pantry: "Pantry Storage",
    general: "General Storage",
    breakfast_nook: "Breakfast Nook",
    desk: "Desk Area",
    butler_pantry: "Butler's Pantry",
    wet_bar: "Wet Bar",
    coffee_bar: "Coffee Bar",
  };
  const zoneFunction = zoneFunctions[zone] || "Storage";

  // Pattern-aware cabinet selection for range flanking zones
  const rangePattern = selectRangePattern(zone, length, prefs);
  const sinkPattern = selectSinkPattern(zone, length, leftOf, rightOf, prefs);

  // Select cabinet type based on zone + pattern intelligence
  const cabType = selectCabinetType(zone, prefs, golaPrefix, rangePattern, sinkPattern);

  // Fill with stock widths
  if (length <= 0) return [];
  const result = fillSegment(length, STD_BASE_WIDTHS, {
    preferSymmetric: zone === "rangeFlanking" && prefs.preferSymmetry,
  });

  // Build cabinet placements with pattern-aware SKU assignment
  const cabinets = [];
  let pos = segment.start;

  for (let i = 0; i < result.cabinets.length; i++) {
    const w = result.cabinets[i];

    // Pattern-driven specialty cabinets in range flanking
    let sku;
    let patternNote = null;

    if (rangePattern && zone === "rangeFlanking") {
      sku = buildPatternAwareSku(rangePattern, cabType, w, i, result.cabinets.length, golaPrefix);
      patternNote = rangePattern.id;
    } else if (sinkPattern && zone === "sinkAdjacent") {
      sku = buildPatternAwareSku(sinkPattern, cabType, w, i, result.cabinets.length, golaPrefix);
      patternNote = sinkPattern.id;
    } else {
      sku = buildSku(cabType, w, golaPrefix);
    }

    cabinets.push({
      sku,
      width: w,
      type: "base",
      role: zone,
      zoneFunction,
      position: pos,
      position_start: pos,
      position_end: pos + w,
      modified: result.modified && w === result.modified.modified ? result.modified : null,
      patternId: patternNote,
    });
    pos += w;
  }

  // ── Phase 2 filler vs. modification decision logic ──
  // Training data: 5:1 ratio of width mods to fillers (FILLER_MOD_RULES)
  // Fillers only for 3" zone transitions (OVF3). Otherwise prefer width modification.
  if (result.filler > 0) {
    if (result.filler <= 3) {
      // Small gap (≤3"): use OVF3 overlay filler (7× in training — zone transitions)
      cabinets.push({
        sku: "OVF3",
        width: result.filler,
        type: "filler",
        role: "zone_transition_filler",
        position: pos,
        position_start: pos,
        position_end: pos + result.filler,
        decisionNote: "Phase 2: OVF3 for ≤3\" gaps per FILLER_MOD_RULES",
      });
    } else if (result.filler <= 6) {
      // Medium gap (3-6"): use F330 filler
      cabinets.push({
        sku: "F330",
        width: result.filler,
        type: "filler",
        role: "filler",
        position: pos,
        position_start: pos,
        position_end: pos + result.filler,
        decisionNote: "Phase 2: F3 filler for 3-6\" gaps",
      });
    } else {
      // Large gap (>6"): try absorbing into adjacent cabinet via width mod
      // If last cabinet exists, widen it (MOD WIDTH N/C if within 30%)
      const lastCab = cabinets[cabinets.length - 1];
      if (lastCab && lastCab.type === "base") {
        const newWidth = lastCab.width + result.filler;
        const pctChange = result.filler / lastCab.width;
        if (pctChange <= 0.30) {
          // Free width modification (22× in training — FILLER_MOD_RULES.widthModTiers.free)
          lastCab.width = newWidth;
          lastCab.sku = buildSku(lastCab.sku.replace(/\d+.*$/, ''), newWidth, golaPrefix);
          lastCab.modified = {
            type: "MOD WIDTH N/C",
            original: lastCab.width - result.filler,
            modified: newWidth,
            upcharge: 0,
          };
          lastCab.decisionNote = "Phase 2: width mod N/C preferred over filler (5:1 ratio in training)";
        } else {
          // Charged width modification (MOD/SQ30 — 6× in training, $91-$194)
          lastCab.width = newWidth;
          lastCab.sku = buildSku(lastCab.sku.replace(/\d+.*$/, ''), newWidth, golaPrefix);
          lastCab.modified = {
            type: "MOD/SQ30",
            original: lastCab.width - result.filler,
            modified: newWidth,
            upcharge: "30%",
          };
          lastCab.decisionNote = "Phase 2: MOD/SQ30 width mod (>30% change, surcharge applies)";
        }
      } else {
        // No cabinet to absorb into — use tall filler at terminal
        cabinets.push({
          sku: 'F330',
          width: result.filler,
          type: "filler",
          role: "terminal_filler",
          position: pos,
          position_start: pos,
          position_end: pos + result.filler,
          decisionNote: "Phase 2: terminal filler (no adjacent cabinet to widen)",
        });
      }
    }
  }

  return cabinets;
}


// ─── ZONE CLASSIFICATION ────────────────────────────────────────────────────

function classifyZone(leftOf, rightOf, wallRole, roomType) {
  // Room-type specific zones
  if (roomType === "office") return "officeDesk";
  if (roomType === "vanity" || roomType === "master_bath") return "vanityWall";
  if (roomType === "laundry") return "laundryRoom";
  if (roomType === "utility") return "utilityStorage";

  // Kitchen zone classification
  if (leftOf === "range" || rightOf === "range" || leftOf === "cooktop" || rightOf === "cooktop") {
    return "rangeFlanking";
  }
  if (leftOf === "sink" || rightOf === "sink") return "sinkAdjacent";
  if (leftOf === "dishwasher" || rightOf === "dishwasher") return "sinkAdjacent";
  if (leftOf === "refrigerator" || rightOf === "refrigerator") return "fridgeAdjacent";
  if (wallRole === "pantry") return "pantry";
  // Special kitchen zones (from wall role)
  if (wallRole === "breakfast_nook") return "breakfast_nook";
  if (wallRole === "desk") return "desk";
  if (wallRole === "butler_pantry") return "butler_pantry";
  if (wallRole === "wet_bar") return "wet_bar";
  if (wallRole === "coffee_bar") return "coffee_bar";
  return "general";
}


// ─── CABINET TYPE SELECTION ─────────────────────────────────────────────────

function selectCabinetType(zone, prefs, golaPrefix, rangePattern, sinkPattern) {
  const zonePrefs = ZONE_CABINET_PRIORITY[zone] || ZONE_CABINET_PRIORITY.general || {};
  const preferred = zonePrefs.preferred || ["B3D"];

  // Non-kitchen rooms use zone-specific cabinet types without gola prefix
  if (zone === "officeDesk" || zone === "vanityWall" || zone === "laundryRoom" || zone === "utilityStorage") {
    return preferred[0] || "B3D";
  }

  // New zone types from Bissegger Great Room
  if (zone === "barEntertaining" || zone === "greatRoomDisplay" || zone === "builtInNook") {
    return preferred[0] || "B-FHD";
  }

  // ── PRO_DESIGN: Professional cabinet selection by zone ──
  // Use training-derived cabinet types instead of amateur defaults

  // Range flanking: B-RT (roll-out trays) is most common, alternating with B3D for variety
  if (zone === "rangeFlanking") {
    if (rangePattern?.id === "heavy_duty_drawer_flank") return golaPrefix + "B2HD";
    if (rangePattern?.id === "2tier_drawer_flank") return golaPrefix + "FC-B2TD";
    if (rangePattern?.id === "roll_out_tray_flank") return golaPrefix + "B-RT";
    if (rangePattern?.id === "pullout_shelf_flank") return golaPrefix + "BPOS";
    // Default: B-RT (roll-out trays) most professional for range flanking
    return golaPrefix + "B-RT";
  }

  // Sink adjacent: Training pattern (60%): B3D on one side, BWDMB on the other
  // DIEHL (3×): B3D27 + SB36 + B3D30
  // Bollini: BTD-9 + SB36-FHD + BWDMB18
  // Owen: BWDMA18 + SB36-FHD + B3D27
  // Most common: B3D flanking, with waste base only when DW is adjacent
  if (zone === "sinkAdjacent") {
    // Default to B3D (drawers) — the #1 most common sink-adjacent cabinet in training
    return golaPrefix + "B3D";
  }

  // Fridge adjacent: B3D primary, B-RT secondary for balance
  if (zone === "fridgeAdjacent") {
    return golaPrefix + "B3D";
  }

  // Gola B2TD dominance: 60-80% of base cabinets should be FC-B2TD (Carolyn's, OC Design)
  if (prefs._golaB2TDDominance && prefs.golaChannel &&
      (zone === "rangeFlanking" || zone === "general" || zone === "sinkAdjacent")) {
    return "FC-B2TD";
  }

  if (prefs.preferDrawerBases && (zone === "rangeFlanking" || zone === "sinkAdjacent" || zone === "general")) {
    // Training data: 5× drawer bases flanking in most zones — confirmed by Phase 2
    return golaPrefix + "B3D";
  }

  // ── CYNCLY PHASE 3: Frameless drawer base preference ──
  // Cyncly 2020 Guide: "Does the client prefer drawers or doors on base cabinets?
  // Modern/frameless kitchens trend heavily toward full-extension drawer bases."
  // For frameless catalogs (Eclipse default), prefer drawer bases (B3D) in all zones.
  // This matches the Cyncly recommendation and professional frameless design patterns.
  if (prefs.constructionType === "frameless" || !prefs.constructionType) {
    // Frameless default: B3D drawer base (most modern, most common in training data)
    return golaPrefix + "B3D";
  }

  return golaPrefix + (preferred[0] || "B3D");
}


// ─── SKU BUILDER ────────────────────────────────────────────────────────────

function buildSku(cabType, width, golaPrefix) {
  // Handle half-widths
  const wStr = width % 1 === 0 ? `${width}` : `${Math.floor(width)} 1/2`;

  // B3D, B4D, B2HD, B — just append width (e.g., B3D27, B4D21, B2HD36)
  if (cabType.endsWith("B3D") || cabType.endsWith("B4D") || cabType.endsWith("B2HD")) {
    return `${cabType}${wStr}`;
  }
  if (cabType.endsWith("B")) {
    return `${cabType}${wStr}`;
  }
  // Dash-suffix patterns: B-RT → B27-RT, B-FHD → B27-FHD, B-2D → B27-2D
  // Catalog format is B{width}-{suffix}, NOT B-{suffix}{width}
  // Minimum widths: B-RT starts at 12", B-FHD at 9". If width < min, fall back to B{width}.
  const dashMatch = cabType.match(/^((?:FC-)?B)-(.+)$/);
  if (dashMatch) {
    const suffix = dashMatch[2];
    const minWidths = { 'RT': 12, '1DR-RT': 12, 'FHD': 9, '2D': 18, '2HD': 24 };
    const minW = minWidths[suffix] || 9;
    if (width < minW) {
      // Fall back to plain base cabinet — suffix variant doesn't exist at this width
      return `${dashMatch[1]}${wStr}`;
    }
    return `${dashMatch[1]}${wStr}-${dashMatch[2]}`;
  }
  // BPOS → BPOS-{width}
  if (cabType.endsWith("BPOS")) {
    return `${cabType}-${wStr}`;
  }
  return `${cabType}${wStr}`;
}

/**
 * Select glass insert style and return configuration with mods.
 * Returns the style configuration with mod codes and optional price adders.
 *
 * @param {Object} prefs - Design preferences
 * @returns {Object} Glass style configuration with { style, baseMod, styleMod, stylePrice }
 */
export function selectGlassStyle(prefs) {
  const style = prefs.glassStyle || "clear";

  const styleConfigs = {
    "clear": {
      style: "clear",
      baseMod: "GFD",
      styleMod: null,
      stylePrice: 0,
      description: "Standard clear glass"
    },
    "seeded": {
      style: "seeded",
      baseMod: "GFD",
      styleMod: "SEED",
      stylePrice: 35,
      description: "Seeded/textured glass"
    },
    "leaded": {
      style: "leaded",
      baseMod: "GFD",
      styleMod: "LD",
      stylePrice: 55,
      description: "Leaded glass with mullion pattern"
    },
    "frosted": {
      style: "frosted",
      baseMod: "GFD",
      styleMod: "FROST",
      stylePrice: 25,
      description: "Frosted/etched glass"
    }
  };

  return styleConfigs[style] || styleConfigs["clear"];
}

/**
 * Create a mullion door modification with pattern tracking.
 * Allows different mullion pattern styles to be tracked on door mods.
 *
 * @param {Object} prefs - Design preferences
 * @returns {Object} Mullion modification with { mod: "MD", qty: 1, mullionPattern: "style" }
 */
export function selectMullionPattern(prefs) {
  const pattern = prefs.mullionStyle || "standard";

  const validPatterns = {
    "standard": { pattern: "standard", description: "Standard mullion" },
    "prairie": { pattern: "prairie", description: "Prairie-style muntins" },
    "diamond": { pattern: "diamond", description: "Diamond lattice pattern" },
    "cathedral": { pattern: "cathedral", description: "Cathedral/arched pattern" }
  };

  const selected = validPatterns[pattern] || validPatterns["standard"];

  return {
    mod: "MD",
    qty: 1,
    mullionPattern: selected.pattern
  };
}

// ─── UPPER CABINET SOLVER ───────────────────────────────────────────────────

function solveUppers(wallLayout, wallDef, wallAppliances, prefs) {
  if (prefs.upperApproach === "none") return { wallId: wallDef.id, cabinets: [], patternId: null };

  // ── Special zone upper approach overrides ──
  const wallRole = wallDef.role || "general";
  const zoneConfig = ZONE_CABINET_PRIORITY[wallRole];
  if (zoneConfig?.upperApproach === "none") {
    return { wallId: wallDef.id, cabinets: [], patternId: "zone_no_uppers" };
  }
  // Zone-specific upper approach can override global pref
  const effectivePrefs = { ...prefs };
  if (zoneConfig?.upperApproach && zoneConfig.upperApproach !== prefs.upperApproach) {
    effectivePrefs.upperApproach = zoneConfig.upperApproach;
  }

  const ceilingH = wallDef.ceilingHeight || DIMS.standardCeiling;
  const upperH = selectUpperHeight(ceilingH, effectivePrefs);
  const pattern = selectUpperPattern(wallRole, effectivePrefs, ceilingH);
  const patternId = pattern?.id || null;

  // ── Define helper flags early (needed for both stacked walls and hutch logic) ──
  const isGlassDisplay = patternId === "stacked_glass_display_wall";
  const isGarage = patternId === "wall_garage_pocket_doors";
  const isHutch = effectivePrefs.upperApproach === "hutch" || effectivePrefs.upperApproach === "mixed_hutch";
  const isMixedHutch = effectivePrefs.upperApproach === "mixed_hutch";

  // Find zones to skip (above range = hood zone, above windows, above tall appliances like fridges)
  // IMPORTANT: Hood zone must account for hood overhang, not just range width.
  // The hood overhangs the range by 3" per side at high/very_high sophistication,
  // so flanking uppers must start at the hood edge — NOT the range edge.
  const skipZones = [];
  const soph = effectivePrefs.sophistication || "high";
  const fridgeApp = wallAppliances.find(a => a.type === "refrigerator" || a.type === "freezer");
  for (const app of wallAppliances) {
    if (app.type === "range" || app.type === "cooktop") {
      // Hood overhang: 3" each side at high/very_high, 0" at standard
      const hoodOH = (soph === "very_high" || soph === "high") ? 3 : 0;
      const hoodStart = app.position - hoodOH;
      const hoodEnd = app.position + app.width + hoodOH;
      skipZones.push({ start: hoodStart, end: hoodEnd, reason: "range_hood", _hoodOverhang: hoodOH });
    }
    // PRO_DESIGN: Don't skip refrigerator zone — will place RW (refrigerator wall) cabinets
    // Skip uppers above tall appliances (freezer, wine column) — they extend to 84"+
    if ((app.type === "freezer" || app.type === "wineColumn")) {
      skipZones.push({ start: app.position, end: app.position + app.width, reason: "tall_appliance" });
    }
  }
  if (wallDef.openings) {
    for (const op of wallDef.openings) {
      if (op.type === "window") {
        skipZones.push({ start: op.posFromLeft, end: op.posFromLeft + op.width, reason: "window" });
      }
    }
  }

  // Generate uppers aligned with base cabinets AND above sink zones.
  // A real designer always puts uppers above the sink for dish/glass storage
  // and above DW zones (continuous upper run). Only range/fridge zones are skipped.
  const uppers = [];
  const baseCabs = wallLayout.cabinets.filter(c => c.type === "base");

  // ── PROJECT 2: Unified upper/base/tall coordination ──
  // Add sink AND dishwasher as virtual bases for upper generation.
  // A pro designer creates continuous upper runs — uppers above the sink for
  // dish/glass storage, and above the DW zone for seamless visual continuity.
  // This produces the "wall of uppers" look seen in professional Cyncly Flex designs.
  const sinkCab = wallLayout.cabinets.find(c => c.type === "appliance" && c.applianceType === "sink");
  if (sinkCab) {
    const sinkInSkipZone = skipZones.find(z => sinkCab.position >= z.start && sinkCab.position < z.end);
    if (!sinkInSkipZone) {
      const upperW = findClosestWidth(sinkCab.width, STD_UPPER_WIDTHS, "down");
      baseCabs.push({ ...sinkCab, type: "base", sku: `W${upperW}${upperH}`, width: sinkCab.width, _isSinkUpper: true });
    }
  }

  // Add dishwasher as virtual base — continuous upper run above DW zone
  const dwCab = wallLayout.cabinets.find(c => c.type === "appliance" && c.applianceType === "dishwasher");
  if (dwCab) {
    const dwInSkipZone = skipZones.find(z => dwCab.position >= z.start && dwCab.position < z.end);
    if (!dwInSkipZone) {
      const upperW = findClosestWidth(dwCab.width, STD_UPPER_WIDTHS, "down");
      baseCabs.push({ ...dwCab, type: "base", sku: `W${upperW}${upperH}`, width: dwCab.width, _isDWUpper: true });
    }
  }

  // PRO_DESIGN: Add refrigerator as virtual base — RW (refrigerator wall) cabinet goes above fridge
  // Training: Bollini uses RW3633-27 above fridge, Spector uses RW3621 above fridge
  // Height is ceiling-aware: available space = ceiling - fridge height (typically 84")
  if (fridgeApp && fridgeApp.position != null) {
    const fridgeInSkipZone = skipZones.find(z => fridgeApp.position >= z.start && fridgeApp.position < z.end);
    if (!fridgeInSkipZone) {
      const fridgeH = 84; // standard fridge height
      const ceilH = wallDef.ceilingHeight || DIMS.standardCeiling || 96;
      const availableAboveFridge = ceilH - fridgeH;
      // Standard RW heights from catalog: 21, 24, 27, 30, 33, 36. Pick largest that fits.
      // Catalog format: RW{width}{height} — no depth suffix (depth is always 12-13")
      const rwStdHeights = [36, 33, 30, 27, 24, 21];
      const rwH = rwStdHeights.find(h => h <= availableAboveFridge) || 21;
      if (rwH >= 21) {  // minimum catalog height is 21"
        baseCabs.push({
          ...fridgeApp,
          type: "base",
          sku: `RW${Math.min(fridgeApp.width, 36)}${rwH}`,
          width: fridgeApp.width,
          position: fridgeApp.position,
          _isFridgeUpper: true,
          _rwHeight: rwH,
        });
      }
    }
  }

  // Sort baseCabs by position — ensures continuous upper runs are built left-to-right
  baseCabs.sort((a, b) => (a.position || 0) - (b.position || 0));

  // ── Upper width coordination: ensure upper widths EXACTLY match base widths ──
  // A pro designer aligns upper edges with base edges. When the closest standard
  // upper width differs from the base width, we use the BASE width directly
  // (it will be a width-modified upper, which is standard in Eclipse Cabinetry).

  // ── Floating shelves pattern ──
  if (patternId === "floating_shelves_instead") {
    for (const base of baseCabs) {
      const skip = skipZones.find(z => base.position >= z.start && base.position < z.end);
      if (skip) continue;
      const shelfW = findClosestWidth(base.width, STD_UPPER_WIDTHS, "down");
      uppers.push({
        sku: `SFLS${shelfW}`,
        width: shelfW,
        height: 3,
        type: "floating_shelf",
        position: base.position,
        wall: wallDef.id,
        alignedWithBase: base.sku,
        patternId,
      });
    }
    // Still add range hood if present
    const rangeApp = wallAppliances.find(a => a.type === "range" || a.type === "cooktop");
    if (rangeApp) {
      // RANGE HOOD DESIGN GUIDE: mounting height calculation
      const isPro = rangeApp._isPro || rangeApp.width >= 48;
      const isElectric = rangeApp._fuelType === "electric" || rangeApp._fuelType === "induction";
      const mountClear = isPro ? 30 : 24;
      const hoodBottomAFF = 36 + mountClear; // 60" or 66"
      uppers.push({
        sku: `RH21 ${rangeApp.width}24`,
        width: rangeApp.width,
        height: 24,
        type: "rangeHood",
        position: rangeApp.position,
        wall: wallDef.id,
        role: "range_hood",
        _hoodMountAFF: hoodBottomAFF,
        _hoodMountClearance: mountClear,
        _rangeType: isPro ? "pro" : (isElectric ? "electric" : "standard"),
      });
    }
    return { wallId: wallDef.id, cabinets: uppers, patternId };
  }

  // ── Hutch-style cabinets (sit on countertop, furniture-like) ──
  if (isHutch) {
    // Hutch height: counter (36") to ceiling, minus crown mould space
    const crownSpace = DIMS.crownMouldDrop || 3.5;
    const availableH = ceilingH - DIMS.counterHeight - crownSpace;
    // Pick closest standard hutch height
    const hutchHeights = HUTCH_RULES.heightOptions;
    const hutchH = hutchHeights.reduce((best, h) =>
      Math.abs(h - availableH) < Math.abs(best - availableH) ? h : best
    );
    // Hutch depth (shallower than base for furniture look)
    const hutchD = HUTCH_RULES.depths.standard; // 13"
    // Door style: pocket door by default, or from prefs
    const hutchDoorStyle = effectivePrefs.hutchDoorStyle || "pocket";
    const hutchConfig = HUTCH_RULES.doorStyles[
      hutchDoorStyle === "pocket" ? "pocketDoor" :
      hutchDoorStyle === "garage" ? "applianceGarage" : "standardDoor"
    ];
    const skuPrefix = hutchConfig.skuPrefix;

    // Determine which zones get hutch vs standard uppers
    // hutchZones: array of base cabinet roles/positions that should get hutch
    const hutchZones = effectivePrefs.hutchZones || null; // e.g., ["coffee_station", "baking_zone"]

    for (const base of baseCabs) {
      const skip = skipZones.find(z => base.position >= z.start && base.position < z.end);
      if (skip) continue;

      if (base.width < HUTCH_RULES.placement.minSegmentWidth) continue; // too narrow for hutch

      const upperW = findClosestWidth(base.width, STD_UPPER_WIDTHS, "down");

      // Mixed mode: check if this base is in a hutch zone
      const inHutchZone = !isMixedHutch || !hutchZones ||
        hutchZones.includes(base.role) || hutchZones.includes("all");

      if (inHutchZone) {
        // Hutch cabinet — sits on countertop
        const effectiveH = hutchDoorStyle === "garage"
          ? (hutchConfig.heights?.[1] || 30)  // shorter for appliance garage
          : hutchH;
        const effectiveD = hutchDoorStyle === "garage"
          ? HUTCH_RULES.depths.applianceGarage
          : hutchD;

        const mods = [];
        if (hutchConfig.hardware) {
          mods.push({ mod: hutchConfig.hardware, qty: 1 });
        }
        // Crown mould for furniture look
        mods.push({ mod: "CM", qty: 1, note: "Crown mould for furniture-like hutch top" });
        // Optional interior lighting
        if (effectivePrefs.hutchLighting !== false) {
          mods.push({ mod: "PWL", qty: 1, note: "Interior puck lighting for hutch" });
        }
        // Optional glass front for display hutch
        if (effectivePrefs.hutchGlass && hutchDoorStyle !== "garage") {
          mods.push({ mod: "GFD", qty: 2 }, { mod: "FINISHED INT", qty: 1 });
        }

        uppers.push({
          sku: `${skuPrefix}${upperW}${effectiveH}|${effectiveD}`,
          width: upperW,
          height: effectiveH,
          depth: effectiveD,
          type: "hutch",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: hutchDoorStyle === "garage" ? "appliance_garage_hutch" : "pocket_door_hutch",
          doorStyle: hutchDoorStyle,
          sitsOnCounter: true,     // key flag: no 18" backsplash gap
          counterGap: 0,
          modifications: mods,
        });
      } else {
        // Standard upper in non-hutch zone (mixed mode)
        uppers.push({
          sku: `W${upperW}${upperH}`,
          width: upperW,
          height: upperH,
          type: "wall",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: "standard_in_mixed_hutch",
        });
      }
    }

    // Still add range hood if present
    const rangeApp = wallAppliances.find(a => a.type === "range" || a.type === "cooktop");
    if (rangeApp) {
      const soph = effectivePrefs.sophistication || "high";
      const hoodOverhang = (soph === "very_high" || soph === "high") ? 3 : 0;
      const hoodW = rangeApp.width + hoodOverhang * 2;
      const hoodPos = rangeApp.position - hoodOverhang;
      // RANGE HOOD DESIGN GUIDE: mounting height
      const isPro = rangeApp._isPro || rangeApp.width >= 48;
      const isElectric = rangeApp._fuelType === "electric" || rangeApp._fuelType === "induction";
      const mountClear = isPro ? 30 : 24;
      const hoodBottomAFF = 36 + mountClear;
      uppers.push({
        sku: `RH21 ${hoodW}24`,
        width: hoodW,
        height: 24,
        type: "rangeHood",
        position: hoodPos,
        wall: wallDef.id,
        role: "range_hood",
        _overhang: hoodOverhang,
        _hoodMountAFF: hoodBottomAFF,
        _hoodMountClearance: mountClear,
        _rangeType: isPro ? "pro" : (isElectric ? "electric" : "standard"),
      });
    }

    return { wallId: wallDef.id, cabinets: uppers, patternId: isHutch ? "hutch" : patternId };
  }

  // ── PRO_DESIGN: Stacked walls (SW####) ONLY for very_high sophistication ──
  // Training data: SW3363(21) appears only in Bollini ($64K premium build).
  // DIEHL, Spector, Owen (high soph) all use standard W#### at 39" height.
  // "transitional" → "high" for pro features but NOT stacked walls.
  const effectiveSoph = (prefs.sophistication === "transitional") ? "high" : (prefs.sophistication || "high");
  const useStackedWalls = (effectiveSoph === "very_high") &&
    !isGlassDisplay && !isGarage && !isHutch &&
    (effectivePrefs.upperApproach === "standard" || effectivePrefs.upperApproach === "stacked" ||
     patternId === "stacked_uppers" || patternId === "stacked_wall_deep" ||
     patternId === "stacked_glass_display_wall");
  const stackedWallHeight = 63;
  const stackedWallDepth = 21;

  // Stacked uppers (W + W_stacked pairs) for tall ceilings at high soph
  const isStacked = !useStackedWalls && (patternId === "stacked_uppers" || patternId === "stacked_wall_deep");
  const stackedTopH = ceilingH >= 120 ? 21 : 15;

  // ── Glass front display mods (GFD + FINISHED INT + PWL) ──
  // Applied to select uppers at very_high or high sophistication with premium aesthetic
  // (soph already declared above in skipZones section)
  const applyGlassFrontDisplay = soph === "very_high" && !isGlassDisplay && !isGarage;
  // Glass front cabs: apply to first and last cab positions (flanking display pair)
  const glassFrontPositions = new Set();
  if (applyGlassFrontDisplay && baseCabs.length >= 3) {
    glassFrontPositions.add(0);
    glassFrontPositions.add(baseCabs.length - 1);
  }

  // ── Appliance garage detection ──
  // WGD flanking pair near range/sink zone at high+ sophistication
  const rangeAppForGarage = wallAppliances.find(a => a.type === "range" || a.type === "cooktop");
  const applyApplianceGarage = soph === "very_high" && rangeAppForGarage && !isGarage && !isGlassDisplay;

  // ── Glass style selection ──
  // Determines which glass mod (SEED, LD, FROST) is applied alongside GFD
  const glassStyleConfig = selectGlassStyle(effectivePrefs);

  for (let cabIdx = 0; cabIdx < baseCabs.length; cabIdx++) {
    const base = baseCabs[cabIdx];
    // Check if this position should be skipped
    const baseEnd = (base.position || 0) + (base.width || 0);
    const skip = skipZones.find(z => (base.position || 0) < z.end && baseEnd > z.start);
    if (skip) continue;

    const upperW = findClosestWidth(base.width, STD_UPPER_WIDTHS, "down");

    // ── Appliance garage pair flanking range zone ──
    if (applyApplianceGarage && upperW >= 18) {
      const rangeStart = rangeAppForGarage.position;
      const rangeEnd = rangeStart + rangeAppForGarage.width;
      const cabEnd = base.position + base.width;
      // Left garage: cab immediately before range
      const isLeftOfRange = cabEnd <= rangeStart && cabEnd >= rangeStart - base.width - 3;
      // Right garage: cab immediately after range
      const isRightOfRange = base.position >= rangeEnd && base.position <= rangeEnd + 3;

      // Determine garage door style and SKU prefix/suffix
      const garageDoorStyle = effectivePrefs.garageDoorStyle || "standard";
      let garageSku, doorStyleMod;

      if (garageDoorStyle === "pocket") {
        garageSku = `WGPD${upperW}54|18`;
        doorStyleMod = { mod: "PKD", qty: 1 };
      } else if (garageDoorStyle === "bifold") {
        garageSku = `WGD${upperW}54|18-BF`;
        doorStyleMod = { mod: "BFD", qty: 1 };
      } else if (garageDoorStyle === "tambour") {
        garageSku = `WGT${upperW}54|18`;
        doorStyleMod = { mod: "TMB", qty: 1 };
      } else {
        // standard (default)
        garageSku = `WGD${upperW}54|18`;
        doorStyleMod = null;
      }

      if (isLeftOfRange) {
        const cab = {
          sku: `${garageSku}|L`,
          width: upperW,
          height: 54,
          depth: 18,
          type: "appliance_garage",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: "appliance_garage",
          side: "left",
          doorStyle: garageDoorStyle,
        };
        if (doorStyleMod) {
          cab.mods = [doorStyleMod];
        }
        uppers.push(cab);
        continue;
      }
      if (isRightOfRange) {
        const cab = {
          sku: `${garageSku}|R`,
          width: upperW,
          height: 54,
          depth: 18,
          type: "appliance_garage",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: "appliance_garage",
          side: "right",
          doorStyle: garageDoorStyle,
        };
        if (doorStyleMod) {
          cab.mods = [doorStyleMod];
        }
        uppers.push(cab);
        continue;
      }
    }

    if (isGarage && upperW >= 24) {
      // Wall garage with pocket doors (Bissegger pattern)
      uppers.push({
        sku: `WGPD${upperW}72|16`,
        width: upperW,
        height: 72,
        depth: 16,
        type: "wall_garage",
        position: base.position,
        wall: wallDef.id,
        alignedWithBase: base.sku,
        patternId,
      });
    } else if (isGlassDisplay) {
      // Bollini pattern: SW{w}63(21) full-height stacked glass display cabs
      // All get GFD + FINISHED INT + RBS mods for walnut backing visibility
      const swH = 63;
      const swD = 21;
      const swMods = [
        { mod: "GFD", qty: 1 },
        { mod: "FINISHED INT", qty: 1 },
        { mod: "RBS", qty: 1 },
      ];
      // Add glass style mod if not clear
      if (glassStyleConfig.styleMod) {
        swMods.push({ mod: glassStyleConfig.styleMod, qty: 1 });
      }
      uppers.push({
        sku: `SW${upperW}${swH}(${swD})`,
        width: upperW,
        height: swH,
        depth: swD,
        type: "wall_glass_display",
        position: base.position,
        wall: wallDef.id,
        alignedWithBase: base.sku,
        patternId,
        modifications: swMods,
      });
    } else if (isStacked) {
      // Standard stacked: main + smaller cab on top
      const mods = [];
      // Glass front display mods on select stacked cabs at very_high sophistication
      if (glassFrontPositions.has(cabIdx)) {
        mods.push({ mod: "GFD", qty: 2 }, { mod: "FINISHED INT", qty: 1 }, { mod: "PWL", qty: 1 });
        // Add glass style mod if not clear
        if (glassStyleConfig.styleMod) {
          mods.push({ mod: glassStyleConfig.styleMod, qty: 1 });
        }
      }
      uppers.push({
        sku: `W${upperW}${upperH}`,
        width: upperW,
        height: upperH,
        type: "wall",
        position: base.position,
        wall: wallDef.id,
        alignedWithBase: base.sku,
        patternId,
        ...(mods.length > 0 ? { modifications: mods } : {}),
      });
      uppers.push({
        sku: `W${upperW}${stackedTopH}`,
        width: upperW,
        height: stackedTopH,
        type: "wall_stacked",
        position: base.position,
        wall: wallDef.id,
        role: "stacked_top",
        patternId,
        ...(mods.length > 0 ? { modifications: mods } : {}),
      });
    } else {
      // PRO_DESIGN: Check if this position is above a refrigerator — use RW instead
      // Detects both the virtual fridge base (_isFridgeUpper) and position proximity
      let isFridgePosition = !!base._isFridgeUpper;
      if (!isFridgePosition && fridgeApp && fridgeApp.position != null) {
        if (base.position >= fridgeApp.position - 6 && base.position <= fridgeApp.position + 6) {
          isFridgePosition = true;
        }
      }

      // PRO_DESIGN: Stacked wall cabinets (SW###(##)) for high+ sophistication
      // These span from counter to ceiling with glass fronts, creating built-in display look
      if (useStackedWalls && !isFridgePosition && upperW >= 16) {
        const swMods = [
          { mod: "GFD", qty: 1 },           // Glass front doors
          { mod: "FINISHED INT", qty: 1 },  // Finished interior for display
          { mod: "RBS", qty: 1 },           // Recessed bottom shelf
        ];
        if (glassStyleConfig.styleMod) {
          swMods.push({ mod: glassStyleConfig.styleMod, qty: 1 });
        }
        uppers.push({
          sku: `SW${upperW}${stackedWallHeight}(${stackedWallDepth})`,
          width: upperW,
          height: stackedWallHeight,
          depth: stackedWallDepth,
          type: "wall_stacked_display",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: patternId || "stacked_walls_pro",
          modifications: swMods,
        });
      } else if (isFridgePosition && upperW >= 24) {
        // PRO_DESIGN: Refrigerator wall cabinet (RW) for built-in fridge look
        // Height is ceiling-aware: ceiling - fridge height (84") = available space
        const rwWidth = Math.min(fridgeApp.width, 36);
        const fridgeH = 84;
        const ceilH = wallDef.ceilingHeight || DIMS.standardCeiling || 96;
        const rwAvail = ceilH - fridgeH;
        const rwStdH = [24, 21, 18, 15, 12];
        const rwHeight = rwStdH.find(h => h <= rwAvail) || 12;
        const rwDepth = 27;
        const rwMods = [];
        if (glassStyleConfig.styleMod) {
          rwMods.push({ mod: glassStyleConfig.styleMod, qty: 1 });
        }
        uppers.push({
          sku: `RW${rwWidth}${rwHeight}-${rwDepth}`,
          width: rwWidth,
          height: rwHeight,
          depth: rwDepth,
          type: "refrigerator_wall",
          position: fridgeApp.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId: patternId || "refrigerator_wall_pro",
          ...(rwMods.length > 0 ? { modifications: rwMods } : {}),
        });
      } else {
        // Standard single-tier uppers — with optional GFD mods
        const mods = [];
        if (glassFrontPositions.has(cabIdx)) {
          mods.push({ mod: "GFD", qty: 2 }, { mod: "FINISHED INT", qty: 1 }, { mod: "PWL", qty: 1 });
          // Add glass style mod if not clear
          if (glassStyleConfig.styleMod) {
            mods.push({ mod: glassStyleConfig.styleMod, qty: 1 });
          }
        }
        uppers.push({
          sku: `W${upperW}${upperH}`,
          width: upperW,
          height: upperH,
          type: "wall",
          position: base.position,
          wall: wallDef.id,
          alignedWithBase: base.sku,
          patternId,
          ...(mods.length > 0 ? { modifications: mods } : {}),
        });
      }
    }
  }

  // ── FWEP flush wall end panels for glass display walls ──
  // Bollini pattern: FWEP flanks the display run at first and last positions
  if (isGlassDisplay && uppers.length > 0) {
    const displayCabs = uppers.filter(c => c.type === "wall_glass_display");
    if (displayCabs.length > 0) {
      const firstDisplay = displayCabs[0];
      const lastDisplay = displayCabs[displayCabs.length - 1];
      // Left FWEP before first display cab
      uppers.push({
        sku: `FWEP3/4-L/R-${firstDisplay.height || 27}"`,
        width: 0.75, // 3/4" panel
        height: firstDisplay.height,
        type: "end_panel",
        position: firstDisplay.position - 1,
        wall: wallDef.id,
        role: "flush_end_panel",
        side: "left",
        patternId,
      });
      // Right FWEP after last display cab
      uppers.push({
        sku: `FWEP3/4-L/R-${lastDisplay.height || 27}"`,
        width: 0.75,
        height: lastDisplay.height,
        type: "end_panel",
        position: lastDisplay.position + lastDisplay.width,
        wall: wallDef.id,
        role: "flush_end_panel",
        side: "right",
        patternId,
      });
    }
  }

  // ── Range hood above range ──
  // Design principle (Shea McGee): "The range hood is the most important view
  // in the kitchen. It should overhang the range by a few inches for a grander
  // appearance."  We add 3" overhang per side (6" total) at high+ sophistication,
  // centering the wider hood over the range.
  //
  // RANGE HOOD DESIGN GUIDE — Mounting Height:
  //   Standard residential: 24-30" above cooking surface → 60-66" AFF
  //   Pro/high-BTU range:   27-36" above cooking surface → 63-72" AFF
  //   Electric/induction:   20-30" above cooking surface → 56-66" AFF
  //   Cooking surface = 36" AFF (counter height)
  //
  // Hood bottom AFF = cookingSurfaceAFF + mountingClearance
  // Cabinet height math (96" ceiling):
  //   96" ceiling - 60" hood bottom = 36" max hood zone
  //   If uppers end at 93" AFF, hood body max = 93" - 60" = 33"
  const rangeApp = wallAppliances.find(a => a.type === "range" || a.type === "cooktop");
  if (rangeApp) {
    // Hood overhang: 3" each side at high/very_high soph, 0" at standard
    const hoodOverhang = (soph === "very_high" || soph === "high") ? 3 : 0;
    const hoodW = rangeApp.width + hoodOverhang * 2;
    const hoodPos = rangeApp.position - hoodOverhang; // center over range

    // ── Hood mounting height calculation (Range Hood Design Guide) ──
    // Determine range type: pro if width >= 36 and explicitly pro, or width >= 48
    const isPro = rangeApp._isPro || rangeApp.width >= 48;
    const isElectric = rangeApp._fuelType === "electric" || rangeApp._fuelType === "induction";
    const cookingSurfaceAFF = 36; // standard counter height

    let mountClearance;
    if (isPro) {
      mountClearance = 30; // pro optimal: 30" above cooking surface → 66" AFF
    } else if (isElectric) {
      mountClearance = 24; // electric optimal: 24" → 60" AFF
    } else {
      mountClearance = 24; // standard gas optimal: 24" → 60" AFF
    }
    const hoodBottomAFF = cookingSurfaceAFF + mountClearance; // 60" standard, 66" pro

    // ── Hood chimney calculation ──
    // Wall-mount chimney hoods have a chimney/flue cover that extends from the
    // top of the hood body up to the ceiling (or to the upper cabinet top line).
    // For 96" ceiling with crown mould, uppers top at ~93". The chimney fills
    // from hood body top to upper top line so the hood "column" aligns vertically
    // with the flanking upper cabinets.
    const crownDrop = DIMS.crownMouldDrop || 3;
    const upperTopAFF = ceilingH - crownDrop; // typically 93"
    const bodyHeight24 = 24; // standard RH21 body
    const bodyHeight42 = 42; // large RH50 body
    const chimneyWidth = 8; // chimney cover is narrower than hood body (~8" wide)

    // Premium/very_high sophistication with large range (≥42"): use RH50 large hood
    const isLargeRange = rangeApp.width >= 42;
    const useLargeHood = isLargeRange && (soph === "very_high" || soph === "high");
    if (useLargeHood) {
      const bodyTop = hoodBottomAFF + bodyHeight42;
      const chimneyH = Math.max(0, upperTopAFF - bodyTop);
      uppers.push({
        sku: `RH50 ${hoodW}4224`,
        width: hoodW,
        height: bodyHeight42,
        depth: 24,
        type: "rangeHood",
        position: hoodPos,
        wall: wallDef.id,
        role: "range_hood",
        variant: "large",
        _overhang: hoodOverhang,
        _hoodMountAFF: hoodBottomAFF,
        _hoodMountClearance: mountClearance,
        _rangeType: isPro ? "pro" : (isElectric ? "electric" : "standard"),
        _hoodBodyTopAFF: bodyTop,
        _chimneyHeight: chimneyH,
        _chimneyWidth: chimneyWidth,
        _chimneyTopAFF: upperTopAFF,
      });
      // Flanking WND display shelves for large hoods (Showroom ECLD pattern)
      if (soph === "very_high") {
        uppers.push({
          sku: `WND2112`,
          width: 21,
          height: 12,
          type: "wall_display",
          position: hoodPos - 21,
          wall: wallDef.id,
          role: "range_hood_flanking",
          side: "left",
        });
        uppers.push({
          sku: `WND2112`,
          width: 21,
          height: 12,
          type: "wall_display",
          position: hoodPos + hoodW,
          wall: wallDef.id,
          role: "range_hood_flanking",
          side: "right",
        });
      }
    } else {
      const bodyTop = hoodBottomAFF + bodyHeight24;
      const chimneyH = Math.max(0, upperTopAFF - bodyTop);
      uppers.push({
        sku: `RH21 ${hoodW}24`,
        width: hoodW,
        height: bodyHeight24,
        type: "rangeHood",
        position: hoodPos,
        wall: wallDef.id,
        role: "range_hood",
        _overhang: hoodOverhang,
        _hoodMountAFF: hoodBottomAFF,
        _hoodMountClearance: mountClearance,
        _rangeType: isPro ? "pro" : (isElectric ? "electric" : "standard"),
        _hoodBodyTopAFF: bodyTop,
        _chimneyHeight: chimneyH,
        _chimneyWidth: chimneyWidth,
        _chimneyTopAFF: upperTopAFF,
      });
    }
  }

  // ── CYNCLY PHASE 5: Hood flanking symmetry enforcement ──────────────────
  // Cyncly 2020 Guide: "Flank the range hood with symmetrical upper cabinets.
  // These should be the same width for visual balance. This is the focal wall —
  // symmetry matters most here."
  // Also: "Align major vertical lines between upper and base cabinets."
  if (rangeApp) {
    const rangeStart = rangeApp.position;
    const rangeEnd = rangeStart + rangeApp.width;
    let leftFlank = null, rightFlank = null;

    for (const upper of uppers) {
      if (upper.type !== "wall" && upper.type !== "wall_stacked_display") continue;
      const upperEnd = upper.position + upper.width;
      const isLeftFlank = Math.abs(upperEnd - rangeStart) <= 6;
      const isRightFlank = Math.abs(upper.position - rangeEnd) <= 6;
      if (isLeftFlank) leftFlank = upper;
      if (isRightFlank) rightFlank = upper;
    }

    // Enforce symmetric widths: if both flanking uppers exist, make them the same width
    // Use the smaller of the two (more conservative — never exceed wall space)
    if (leftFlank && rightFlank && leftFlank.width !== rightFlank.width) {
      const symmetricWidth = Math.min(leftFlank.width, rightFlank.width);
      leftFlank.width = symmetricWidth;
      leftFlank.sku = leftFlank.sku.replace(/\d+/, String(symmetricWidth));
      leftFlank._symmetryEnforced = true;
      rightFlank.width = symmetricWidth;
      rightFlank.sku = rightFlank.sku.replace(/\d+/, String(symmetricWidth));
      rightFlank._symmetryEnforced = true;
    }

    // GFD finishing pass (very_high sophistication only)
    // At transitional+ sophistication, a pro designer adds glass-front doors (GFD)
    // to the uppers immediately flanking the range hood. This creates a designer
    // focal wall that looks intentional, not builder-grade.
    if (soph === "very_high") {
      for (const flank of [leftFlank, rightFlank]) {
        if (!flank || flank.type !== "wall") continue;
        if (!flank.modifications) flank.modifications = [];
        const alreadyHasGFD = flank.modifications.some(m => m.mod === "GFD");
        if (!alreadyHasGFD) {
          flank.modifications.push(
            { mod: "GFD", qty: 2 },
            { mod: "FINISHED INT", qty: 1 },
            { mod: "PWL", qty: 1 },
          );
          flank._glassFrontFlanking = true;
        }
      }
    }
  }

  return { wallId: wallDef.id, cabinets: uppers, patternId };
}

function selectUpperHeight(ceilingH, prefs) {
  if (prefs.upperApproach === "floating_shelves") return 3; // floating shelf height

  // When light rail or decorative molding is present, the effective bottom
  // of the upper assembly drops by the molding thickness. Raise the upper
  // cabinet bottom to maintain a full 18" usable clearance above the counter.
  let effectiveUpperBottom = DIMS.upperBottom; // 54" default (36" counter + 18")
  if (prefs.lightRail) {
    effectiveUpperBottom += DIMS.lightRailThickness; // +1.75" → 55.75"
  }
  // Open shelving: use higher mount (20" clearance) for top-opening appliances
  if (prefs.upperApproach === "open_shelving") {
    effectiveUpperBottom = DIMS.openShelfBottom; // 56"
  }

  const aboveUpper = ceilingH - effectiveUpperBottom;

  // ── Phase 2 UPPER_SIZING_RULES — training-data-driven height selection ──
  // Training frequencies: 39" (3×), 36" (2×), 48" (2×), 63" (2×)
  const soph = prefs.sophistication || "high";

  // Floor-to-ceiling: 63" uppers for very_high sophistication + tall ceilings (Bollini pattern)
  if (soph === "very_high" && ceilingH >= 120) return UPPER_SIZING_RULES.heightsByContext.floorToCeiling.height; // 63"

  // Stacked: 48" for stacked pattern on tall ceilings (Helmer Mitchell pattern)
  if (ceilingH >= 120) return UPPER_SIZING_RULES.heightsByContext.stacked.height; // 48"
  if (ceilingH >= 108) return 42; // 9ft ceiling

  // Standard vs tall: 39" is most common in training (Diehl, Eddies, Kline — 3×)
  // 36" used with 8' ceilings (Gable — 2×)
  if (aboveUpper >= 39) return UPPER_SIZING_RULES.heightsByContext.tall.height; // 39"
  if (aboveUpper >= 36) return UPPER_SIZING_RULES.heightsByContext.standard.height; // 36"
  return 30;
}


// ─── UPPER CORNER SOLVER ────────────────────────────────────────────────────
// Generates WSC (wall square corner) cabinet pairs at L/U-shape upper corners.
// Pie-hinged pairs (PHL/PHR) that sit above base corners like lazy susan.
// At tall ceilings (≥108"), also generates SA (stacked wall angle) transition
// cabinets above the WSC pair for corner-to-straight-run transitions.

function solveUpperCorners(corners, upperLayouts, prefs, walls) {
  const upperCorners = [];
  const soph = prefs.sophistication || "high";

  // WSC only at high+ sophistication with actual base corners
  if (soph !== "high" && soph !== "very_high") return upperCorners;
  if (!corners || corners.length === 0) return upperCorners;

  for (const corner of corners) {
    // Skip diagonal or non-standard corners
    if (corner.type === "diagonal" || corner.type === "none") continue;

    // Determine upper height from adjacent upper layouts
    const wallAUppers = upperLayouts.find(u => u.wallId === corner.wallA);
    const wallBUppers = upperLayouts.find(u => u.wallId === corner.wallB);
    if (!wallAUppers && !wallBUppers) continue;

    // Get upper height from existing wall cabs (default 36)
    const sampleUpper = (wallAUppers?.cabinets || wallBUppers?.cabinets || [])
      .find(c => c.type === "wall");
    const upperH = sampleUpper?.height || 36;

    // ── Check if adjacent walls use stacked_glass_display_wall pattern ──
    // If so, generate SWSC bi-fold corner instead of standard WSC pair.
    // Bollini pattern: SWSC{w}63(21) with GFD + FINISHED INT + RBS mods
    const wallAPattern = wallAUppers?.patternId || null;
    const wallBPattern = wallBUppers?.patternId || null;
    const isGlassDisplayCorner =
      wallAPattern === "stacked_glass_display_wall" ||
      wallBPattern === "stacked_glass_display_wall";

    if (isGlassDisplayCorner && soph === "very_high") {
      // SWSC bi-fold corner: 24" wide, 63" tall, 21" deep
      // Matches the SW{w}63(21) stacked glass cabs on adjacent walls
      const swscW = 24;
      const swscH = 63;
      const swscD = 21;

      // Determine side based on which wall is the "approaching" wall
      // wallA → right-hand corner piece, wallB → left-hand corner piece
      const side = wallAPattern === "stacked_glass_display_wall" ? "R" : "L";

      upperCorners.push({
        sku: `SWSC${swscW}${swscH}(${swscD})${side}`,
        width: swscW,
        height: swscH,
        depth: swscD,
        type: "wall_corner",
        role: "glass_display_corner",
        wall: `${corner.wallA}-${corner.wallB}`,
        patternId: "stacked_glass_display_wall",
        side: side === "R" ? "right" : "left",
        modifications: [
          { mod: "GFD", qty: 1 },
          { mod: "FINISHED INT", qty: 1 },
          { mod: "RBS", qty: 1 },
        ],
      });

      // No WSC pair or SA needed — SWSC is a single full-height corner piece
      continue;
    }

    // Standard WSC: 24" pie-hinged pair
    // Catalog format: WSC24-PH (single SKU, no height suffix, no L/R — one per corner)
    upperCorners.push({
      sku: `WSC24-PH`,
      width: 24,
      height: upperH,
      type: "wall_corner",
      role: "upper_corner",
      wall: `${corner.wallA}-${corner.wallB}`,
      patternId: "wall_square_corner",
      side: "left",
    });
    upperCorners.push({
      sku: `WSC24-PH`,
      width: 24,
      height: upperH,
      type: "wall_corner",
      role: "upper_corner",
      wall: `${corner.wallA}-${corner.wallB}`,
      patternId: "wall_square_corner",
      side: "right",
    });

    // ── Stacked wall angle (SA) for tall ceiling corner transitions ──
    // At ceilings ≥108", add SA cabinet above the WSC pair to transition
    // between stacked straight runs and the corner. Firebird pattern:
    // SA{w}{h}(15) with optional GFD + FINISHED INT + PWL mods
    const wallADef = walls?.find(w => w.id === corner.wallA);
    const wallBDef = walls?.find(w => w.id === corner.wallB);
    const cornerCeiling = Math.max(
      wallADef?.ceilingHeight || DIMS.standardCeiling,
      wallBDef?.ceilingHeight || DIMS.standardCeiling,
    );

    if (cornerCeiling >= 108) {
      // SA height: fills the gap between top of WSC and ceiling
      // Standard stacked top height: 15" for 9ft, 21" for 10ft
      const saH = cornerCeiling >= 120 ? 21 : 15;
      const saW = 24; // matches WSC width
      const saDepth = 15; // 15" depth for clearance (Firebird pattern)

      // Build mods for SA — at very_high, add glass front display + lighting
      const saMods = [];
      if (soph === "very_high") {
        saMods.push({ mod: "GFD", qty: 1 }, { mod: "FINISHED INT", qty: 1 }, { mod: "PWL", qty: 1 });
      }

      // SA placed on the wallA side of the corner transition
      upperCorners.push({
        sku: `SA${saW}${saH}(${saDepth})`,
        width: saW,
        height: saH,
        depth: saDepth,
        type: "wall_angle",
        role: "corner_transition",
        wall: `${corner.wallA}-${corner.wallB}`,
        patternId: "stacked_wall_angle",
        ...(saMods.length > 0 ? { modifications: saMods } : {}),
      });
    }
  }

  return upperCorners;
}


// ─── TALL CABINET SOLVER ────────────────────────────────────────────────────
// Generates oven towers, pantry towers, and utility talls based on appliances
// and sophistication level, driven by selectTallPattern.

function solveTalls(appliances, walls, prefs, golaPrefix) {
  const talls = [];

  // Oven/wall-oven appliances → oven tower
  const ovenApp = appliances.find(a =>
    a.type === "wallOven" || a.type === "oven" || a.type === "wall_oven_microwave_combo"
  );

  if (ovenApp) {
    const pattern = selectTallPattern("oven", prefs);
    const ovenWidth = ovenApp.width || 27;
    const ovenWall = ovenApp.wall || "oven";

    if (pattern) {
      let sku, height, depth;

      if (pattern.id === "flush_inset_oven_tower") {
        // FIO pattern: flush inset oven with frame
        height = prefs.sophistication === "very_high" ? 93 : 90;
        depth = 27.875;  // 27" body + 7/8" door
        sku = `${golaPrefix}FIO${ovenWidth}${height}-${depth}`;
      } else if (pattern.id === "oven_micro_tower") {
        // OM pattern: oven + microwave combo tower
        height = 96;
        depth = 27.875;  // 27" body + 7/8" door
        sku = `${golaPrefix}OM${ovenWidth}${height}`;
      } else if (prefs.golaChannel) {
        // Gola oven tower: FC-O30 (Carolyn's: FC-O3096)
        height = 96;
        depth = 27.875;  // 27" body + 7/8" door
        sku = `FC-O${ovenWidth}${height}`;
      } else {
        // Standard oven tower (O pattern)
        height = 84;
        depth = 24.875;  // 24" body + 7/8" door
        sku = `${golaPrefix}O${ovenWidth}${height}`;
      }

      talls.push({
        sku,
        width: ovenWidth,
        height,
        depth,
        type: "tall",
        role: "oven_tower",
        wall: ovenWall,
        patternId: pattern.id,
        applianceType: ovenApp.type,
      });
    }
  }

  // ── Phase 4 Enhanced Pantry Tower Intelligence ──
  // Training-frequency-driven: 11/42 projects have pantry/utility towers
  // Triggers: explicit pantry wall, pantry appliance, large kitchens (≥360" perimeter),
  //           or medium kitchens with no tall storage (≥240" perimeter, no oven tower, high soph)
  const hasPantryWall = walls.some(w => w.role === "pantry");
  const hasPantryAppliance = appliances.some(a => a.type === "pantry");
  const totalPerimeter = walls.reduce((s, w) => s + (w.length || 0), 0);
  const isKitchen = prefs.roomType === "kitchen" || !prefs.roomType;
  const largeFamilyKitchen = isKitchen && totalPerimeter >= 360;
  // Phase 4: also add pantry for medium+ kitchens at high sophistication if no oven tower
  const mediumKitchenNeedsPantry = isKitchen && totalPerimeter >= 240
    && !ovenApp
    && (prefs.sophistication === "high" || prefs.sophistication === "very_high");

  if (hasPantryWall || hasPantryAppliance || largeFamilyKitchen || mediumKitchenNeedsPantry) {
    const pattern = selectTallPattern("pantry", prefs);

    if (pattern) {
      // Phase 4: Smarter wall selection — prefer dedicated pantry wall, then longest wall
      // without range/sink (training: pantry goes on least-appliance-populated wall)
      const pantryWall = walls.find(w => w.role === "pantry")?.id
        || walls.find(w => w.role === "tall")?.id
        || walls.find(w => w.role === "fridge")?.id
        || (() => {
          // Training pattern: place pantry on longest wall without major appliances
          const wallAppCounts = {};
          for (const app of appliances) {
            const majorApps = ["range", "cooktop", "sink"];
            if (majorApps.includes(app.type)) wallAppCounts[app.wall] = (wallAppCounts[app.wall] || 0) + 1;
          }
          const candidates = walls
            .filter(w => !wallAppCounts[w.id])
            .sort((a, b) => b.length - a.length);
          return candidates[0]?.id;
        })()
        || walls[walls.length - 1]?.id
        || "pantry";

      let sku, height, width, depth;

      // Phase 4: Training-data-driven size selection
      // Training frequencies: TP2496 (5×), UT1884 (3×), UT2496 (2×), NTK2496 (1×)
      const soph = prefs.sophistication || "high";
      const ceilingH = walls.find(w => w.id === pantryWall)?.ceilingHeight || 96;

      if (pattern.id === "ntk_utility_tower") {
        // NTK: no toe kick utility tower (Bennet pattern) — for stacked walls above
        width = 18;
        height = ceilingH >= 108 ? 84 : 96;
        depth = 24.875;  // 24" body + 7/8" door
        sku = `${golaPrefix}NTK${width}${height}`;
      } else if (soph === "very_high" || ceilingH >= 108) {
        // Tall/premium: wider utility tower (McCarter: UT1884 at 120" ceiling)
        width = largeFamilyKitchen ? 24 : 18;
        height = ceilingH >= 120 ? 84 : 96;
        depth = 24.875;  // 24" body + 7/8" door
        sku = `${golaPrefix}UT${width}${height}`;
      } else {
        // Standard utility/pantry tower (most common: TP2496)
        width = 24;
        height = 96;
        depth = 24.875;  // 24" body + 7/8" door
        sku = `${golaPrefix}TP${width}${height}`;
      }

      talls.push({
        sku,
        width,
        height,
        depth,
        type: "tall",
        role: "pantry_tower",
        wall: pantryWall,
        patternId: pattern.id,
      });

      // Phase 4: For large kitchens, add a second utility tower if perimeter ≥ 480"
      // Training: Gable has 3 walls totaling 396", McCarter has UT pair flanking fridge
      if (largeFamilyKitchen && totalPerimeter >= 480) {
        const secondWall = walls.find(w => w.id !== pantryWall && w.role !== "range" && w.role !== "sink")?.id || pantryWall;
        talls.push({
          sku: `${golaPrefix}UT1884`,
          width: 18,
          height: 84,
          depth: 24.875,
          type: "tall",
          role: "pantry_tower",
          wall: secondWall,
          patternId: "utility_pair",
        });
      }
    }
  }

  // ── Fridge pocket: REP panels + RW above-fridge cabinet ──
  // Training: Kline Piazza, Gable, Huang, Alix, Firebird, McCarter Parade
  const fridgeApp = appliances.find(a => a.type === "refrigerator");

  if (fridgeApp) {
    const soph = prefs.sophistication || "high";
    const fridgeWall = fridgeApp.wall || "fridge";
    const fridgeWidth = fridgeApp.width || 36;

    // Determine ceiling height from wall definition
    const fridgeWallDef = walls.find(w => w.id === fridgeWall);
    const ceilingH = fridgeWallDef?.ceilingHeight || 96;

    // Panel thickness: very_high → 3", high → 1.5", standard → 3/4"
    const panelThickness = soph === "very_high" ? "3" : soph === "high" ? "1.5" : "3/4";
    const panelPrefix = `REP${panelThickness}`;

    // Panel height: fill from floor to near ceiling
    // Standard: 93" (Kline, Gable, Huang), Premium: up to 114" (McCarter Parade)
    let panelH;
    if (ceilingH >= 120) panelH = 114;       // McCarter Parade 10ft
    else if (ceilingH >= 108) panelH = 102;   // Firebird 9ft
    else panelH = 93;                          // Standard 8ft

    // Panel depth: counter-depth → 24", standard → 27", full-depth → 30"
    const fridgeDepth = fridgeApp.depth || 27;
    const panelD = fridgeDepth >= 30 ? 30 : fridgeDepth >= 27 ? 27 : 24;

    // Left REP panel
    talls.push({
      sku: `${panelPrefix} ${panelH}FTK-${panelD}R`,
      width: parseFloat(panelThickness),
      height: panelH,
      depth: panelD,
      type: "panel",
      role: "fridge_panel",
      wall: fridgeWall,
      side: "left",
      patternId: "standard_fridge_pocket",
    });

    // Right REP panel
    talls.push({
      sku: `${panelPrefix} ${panelH}FTK-${panelD}L`,
      width: parseFloat(panelThickness),
      height: panelH,
      depth: panelD,
      type: "panel",
      role: "fridge_panel",
      wall: fridgeWall,
      side: "right",
      patternId: "standard_fridge_pocket",
    });

    // RW above-fridge cabinet
    // Height: space between fridge top and panel top
    // Standard counter-depth fridges are 84" tall (70" is incorrect legacy default)
    const fridgeH = fridgeApp.height || 84;
    // Catalog RW heights: 21, 24, 27, 30, 33, 36. Format: RW{width}{height} — no depth suffix.
    const rwStdH = [36, 33, 30, 27, 24, 21];
    const rawRwH = Math.max(12, Math.min(36, panelH - fridgeH - 3)); // 3" clearance
    const rwH = rwStdH.find(h => h <= rawRwH) || 21;
    const rwD = Math.min(panelD, 27); // RW depth matches or shallower than panel

    talls.push({
      sku: `RW${fridgeWidth}${rwH}`,
      width: fridgeWidth,
      height: rwH,
      depth: rwD,
      type: "wall",
      role: "fridge_wall_cab",
      wall: fridgeWall,
      patternId: "standard_fridge_pocket",
    });
  }

  // ── Wine cooler: BWC appliance with panel-ready integration ──
  const wineCoolerApp = appliances.find(a => a.type === "wineCooler");

  if (wineCoolerApp) {
    const coolerStyle = prefs.coolerStyle;
    const wineCoolerWall = wineCoolerApp.wall || "wine";
    const wineCoolerWidth = wineCoolerApp.width || 24;
    const wineCoolerHeight = wineCoolerApp.height || 34.5;

    // Base wine cooler cabinet
    const wcSku = `BWC${wineCoolerWidth}${wineCoolerHeight}`;
    talls.push({
      sku: wcSku,
      width: wineCoolerWidth,
      height: wineCoolerHeight,
      depth: 24.875,
      type: "base",
      role: "wine_cooler",
      wall: wineCoolerWall,
      patternId: "wine_cooler_integration",
      style: coolerStyle,
    });

    // If integrated or undercounter, add end panels
    if (coolerStyle === "integrated" || coolerStyle === "undercounter") {
      // Left end panel
      talls.push({
        sku: "BEP1.5-FTK-L",
        width: 1.5,
        height: wineCoolerHeight,
        depth: 24,
        type: "panel",
        role: "wine_cooler_end_panel",
        wall: wineCoolerWall,
        side: "left",
        patternId: "wine_cooler_integration",
      });

      // Right end panel
      talls.push({
        sku: "BEP1.5-FTK-R",
        width: 1.5,
        height: wineCoolerHeight,
        depth: 24,
        type: "panel",
        role: "wine_cooler_end_panel",
        wall: wineCoolerWall,
        side: "right",
        patternId: "wine_cooler_integration",
      });
    }

    // If undercounter style, add trim strip above
    if (coolerStyle === "undercounter") {
      talls.push({
        sku: `TS-${wineCoolerWidth}`,
        width: wineCoolerWidth,
        height: 3,
        depth: 1,
        type: "trim",
        role: "wine_cooler_trim",
        wall: wineCoolerWall,
        patternId: "wine_cooler_integration",
      });
    }

    // Check if wall has ceiling height for above-cooler wall cabinet
    const wineCoolerWallDef = walls.find(w => w.id === wineCoolerWall);
    const ceilingH = wineCoolerWallDef?.ceilingHeight || 96;

    if (ceilingH > wineCoolerHeight + 12) {
      const upperH = Math.max(12, Math.min(18, ceilingH - wineCoolerHeight - 3));
      talls.push({
        sku: `W${wineCoolerWidth}${upperH}`,
        width: wineCoolerWidth,
        height: upperH,
        depth: 12,
        type: "wall",
        role: "wine_cooler_wall_cab",
        wall: wineCoolerWall,
        patternId: "wine_cooler_integration",
      });
    }
  }

  // ── Beverage center: BCF appliance with panel-ready integration ──
  const beverageCenterApp = appliances.find(a => a.type === "beverageCenter");

  if (beverageCenterApp) {
    const coolerStyle = prefs.coolerStyle;
    const bcWall = beverageCenterApp.wall || "beverage";
    const bcWidth = beverageCenterApp.width || 24;
    const bcHeight = beverageCenterApp.height || 30;

    // Base beverage center cabinet
    const bcSku = `BCF${bcWidth}${bcHeight}`;
    talls.push({
      sku: bcSku,
      width: bcWidth,
      height: bcHeight,
      depth: 24.875,
      type: "base",
      role: "beverage_center",
      wall: bcWall,
      patternId: "beverage_center_integration",
      style: coolerStyle,
    });

    // If integrated or undercounter, add end panels
    if (coolerStyle === "integrated" || coolerStyle === "undercounter") {
      // Left end panel
      talls.push({
        sku: "BEP1.5-FTK-L",
        width: 1.5,
        height: bcHeight,
        depth: 24,
        type: "panel",
        role: "beverage_center_end_panel",
        wall: bcWall,
        side: "left",
        patternId: "beverage_center_integration",
      });

      // Right end panel
      talls.push({
        sku: "BEP1.5-FTK-R",
        width: 1.5,
        height: bcHeight,
        depth: 24,
        type: "panel",
        role: "beverage_center_end_panel",
        wall: bcWall,
        side: "right",
        patternId: "beverage_center_integration",
      });
    }

    // If undercounter style, add trim strip above
    if (coolerStyle === "undercounter") {
      talls.push({
        sku: `TS-${bcWidth}`,
        width: bcWidth,
        height: 3,
        depth: 1,
        type: "trim",
        role: "beverage_center_trim",
        wall: bcWall,
        patternId: "beverage_center_integration",
      });
    }

    // Check if wall has ceiling height for above-cooler wall cabinet
    const bcWallDef = walls.find(w => w.id === bcWall);
    const ceilingH = bcWallDef?.ceilingHeight || 96;

    if (ceilingH > bcHeight + 12) {
      const upperH = Math.max(12, Math.min(18, ceilingH - bcHeight - 3));
      talls.push({
        sku: `W${bcWidth}${upperH}`,
        width: bcWidth,
        height: upperH,
        depth: 12,
        type: "wall",
        role: "beverage_center_wall_cab",
        wall: bcWall,
        patternId: "beverage_center_integration",
      });
    }
  }

  return talls;
}



// ─── SEATING OVERHANG & BRACKET CALCULATION ──────────────────────────────────

/**
 * Calculate seating overhang depth based on style preference
 * @param {string} seatingStyle - "bar", "breakfast", or "ada"
 * @returns {number} overhang depth in inches
 */
function calculateOverhangDepth(seatingStyle = "bar") {
  const overhangs = {
    bar: 12,        // Standard bar overhang
    breakfast: 15,  // Breakfast bar overhang for comfortable dining
    ada: 19,        // ADA-compliant overhang for wheelchair access
  };
  return overhangs[seatingStyle] || overhangs.bar;
}

/**
 * Determine support type needed for an overhang depth
 * @param {number} overhangDepth - depth in inches
 * @returns {string} support type: "none", "l-bracket", "corbel", or "steel"
 */
function determineSupportType(overhangDepth) {
  if (overhangDepth <= 10) return "none";
  if (overhangDepth <= 14) return "l-bracket";
  return "corbel";
}

/**
 * Calculate number of support brackets needed based on length and spacing
 * @param {number} length - counter length in inches
 * @param {number} spacing - spacing between brackets in inches (24-36")
 * @returns {number} number of brackets needed
 */
function calculateBracketCount(length, spacing = 30) {
  if (spacing <= 0) return 0;
  // Always need at least 1 bracket if supports are required, typically 1 per spacing distance
  return Math.max(1, Math.ceil(length / spacing));
}

/**
 * Generate support bracket accessories for an overhang
 * @param {number} overhangDepth - depth in inches
 * @param {number} length - counter length in inches
 * @param {string} bracketStyle - "SS" (stainless), "BK" (black), or "wood"
 * @returns {Array} array of bracket objects to add to accessories
 */
function generateSupportBrackets(overhangDepth, length, bracketStyle = "SS") {
  const supportType = determineSupportType(overhangDepth);
  const brackets = [];

  if (supportType === "none") {
    return brackets;
  }

  if (supportType === "l-bracket") {
    // L-brackets every 24-36" (use 30" as default mid-point)
    const count = calculateBracketCount(length, 30);
    const skuSuffix = bracketStyle === "BK" ? "BK" : "SS";
    for (let i = 0; i < count; i++) {
      brackets.push({
        sku: `LBRK-${skuSuffix}`,
        qty: 1,
        role: "overhang-bracket",
        type: "l-bracket",
        description: `L-bracket (${bracketStyle})`,
      });
    }
  } else if (supportType === "corbel") {
    // Corbels every 24" for deeper overhangs (15"+)
    const count = calculateBracketCount(length, 24);
    for (let i = 0; i < count; i++) {
      brackets.push({
        sku: `CRBL-${bracketStyle}`,
        qty: 1,
        role: "overhang-bracket",
        type: "corbel",
        description: `Corbel (${bracketStyle})`,
      });
    }
  }

  return brackets;
}

/**
 * Calculate maximum number of seats based on overhang length
 * @param {number} overhangLength - length of overhang in inches
 * @param {number} seatWidth - width per seat in inches (24 standard, 30 comfortable)
 * @returns {number} maximum number of seats
 */
function calculateMaxSeats(overhangLength, seatWidth = 24) {
  return Math.floor(overhangLength / seatWidth);
}

/**
 * Generate complete overhang object for island/peninsula
 * @param {number} length - counter length in inches
 * @param {string} seatingStyle - "bar", "breakfast", or "ada"
 * @param {string} bracketStyle - "SS", "BK", or "wood"
 * @returns {Object} overhang data object
 */
function generateOverhangData(length, seatingStyle = "bar", bracketStyle = "SS") {
  const depth = calculateOverhangDepth(seatingStyle);
  const supportType = determineSupportType(depth);
  const supports = generateSupportBrackets(depth, length, bracketStyle);
  const maxSeats = calculateMaxSeats(length, 24);

  return {
    depth,
    style: seatingStyle,
    supportType,
    supports,
    maxSeats,
  };
}


// ─── ISLAND SOLVER ──────────────────────────────────────────────────────────

function solveIsland(island, appliances, prefs, golaPrefix) {
  const { length, depth } = island;
  const _warnings = [];

  // ── Validate: total appliance widths must fit within island length ──
  const totalApplianceWidth = appliances.reduce((sum, a) => sum + (a.width || 30), 0);
  if (totalApplianceWidth > length) {
    _warnings.push({ type: "island_overflow", message:
      `Island appliances total ${totalApplianceWidth}" but island is only ${length}" long — appliances exceed island bounds by ${totalApplianceWidth - length}". Some appliances will be excluded.` });
  }

  // Validate individual appliance widths
  for (const app of appliances) {
    const w = app.width || 30;
    if (w > length) {
      _warnings.push({ type: "island_appliance_too_wide", applianceType: app.type, model: app.model, message:
        `${app.type} (${w}") is wider than island (${length}") — cannot be placed on island` });
    }
  }

  const hasRange = appliances.some(a => a.type === "range" || a.type === "cooktop");
  const hasSink = appliances.some(a => a.type === "sink");

  // Select island pattern
  let pattern;
  if (hasRange) pattern = "range_island";
  else if (hasSink) pattern = "sink_island_with_seating_back";
  else if (length <= 60) pattern = "small_prep_island";
  else pattern = "drawer_island_with_seating";

  // Work side
  const workCabs = [];
  const rangeApp = appliances.find(a => a.type === "range" || a.type === "cooktop");
  const sinkApp = appliances.find(a => a.type === "sink");
  const dwApp = appliances.find(a => a.type === "dishwasher");
  const wasteApp = appliances.find(a => a.type === "waste");

  let workRemaining = length;

  if (rangeApp) {
    const rw = rangeApp.width || 30;
    // Validate range fits in island with flanking cabinets
    if (rw > length - 24) {
      _warnings.push({ type: "island_range_tight", message:
        `Range (${rw}") leaves only ${length - rw}" for flanking cabinets on ${length}" island — layout will be tight` });
    }
    // Range island: B3D + RANGE + BPOS-12 + B-RT
    const leftWidth = Math.max(12, Math.min(36, Math.floor((length - rw) * 0.4)));
    const rightWidth = length - rw - leftWidth - 12;
    if (leftWidth >= 12) {
      workCabs.push({ sku: `${golaPrefix}B3D${leftWidth}`, width: leftWidth, role: "rangeFlanking" });
    }
    workCabs.push({ type: "appliance", applianceType: "range", width: rw });
    if (rightWidth >= 12) {
      workCabs.push({ sku: `${golaPrefix}BPOS-12`, width: 12, role: "rangeFlanking" });
      workCabs.push({ sku: `${golaPrefix}B${rightWidth}-RT`, width: Math.max(12, rightWidth), role: "rangeFlanking" });
    } else if (length - rw - leftWidth > 0) {
      // Remaining space too small for BPOS + cab — use a single filler/small cab
      const rem = length - rw - leftWidth;
      if (rem >= 9) {
        workCabs.push({ sku: `${golaPrefix}B${rem}`, width: rem, role: "rangeFlanking" });
      }
    }
  } else if (sinkApp) {
    // Sink island
    const sinkW = sinkApp.width || 36;
    const dwW = dwApp ? (dwApp.width || 24) : 0;
    const wasteW = 18;
    const fixedW = sinkW + dwW + wasteW;
    const drawerSpace = length - fixedW;

    if (drawerSpace < 0) {
      _warnings.push({ type: "island_sink_overflow", message:
        `Sink (${sinkW}") + DW (${dwW}") + waste (${wasteW}") = ${fixedW}" exceeds island length ${length}"` });
    }

    const leftDrawer = Math.max(0, Math.min(30, Math.floor(drawerSpace / 2)));
    const rightDrawer = Math.max(0, drawerSpace - leftDrawer);

    if (leftDrawer >= 15) workCabs.push({ sku: `${golaPrefix}B3D${leftDrawer}`, width: leftDrawer, role: "sinkAdjacent" });
    if (dwApp) workCabs.push({ type: "appliance", applianceType: "dishwasher", width: dwW });
    workCabs.push({ sku: `${golaPrefix}SB${sinkW}`, width: sinkW, role: "sink-base" });
    workCabs.push({ sku: `${golaPrefix}BWDMA18`, width: wasteW, role: "waste" });
    if (rightDrawer >= 15) workCabs.push({ sku: `${golaPrefix}B3D${rightDrawer}`, width: rightDrawer, role: "sinkAdjacent" });
  } else {
    // Drawer island — Gola uses B2TD (2-tiered drawers), standard uses B3D
    const drawerType = prefs._golaB2TDDominance ? "B2TD" : "B3D";
    const fillResult = fillSegment(length, STD_BASE_WIDTHS.filter(w => w >= 24 && w <= 36));
    for (const w of fillResult.cabinets) {
      workCabs.push({ sku: `${golaPrefix}${drawerType}${w}`, width: w, role: "island-drawer" });
    }
  }

  // Seating/back side
  const backCabs = [];
  if (prefs.islandBackStyle === "fhd_seating") {
    // FHD at 13" depth — most common pattern (Imai Robin, OC Design, Kline Piazza)
    const fillResult = fillSegment(length, STD_BASE_WIDTHS.filter(w => w >= 22.5 && w <= 42));
    for (const w of fillResult.cabinets) {
      backCabs.push({
        sku: `${golaPrefix}B${w}-FHD`,
        width: w,
        role: "island-seating",
        depth: 13.875,
        mods: ["13\" DEPTH OPTION", "FTK"],
      });
    }
  } else if (prefs.islandBackStyle === "loose_doors") {
    // Loose doors — Alix pattern
    const doorWidth = Math.round(length / 3 * 10) / 10;
    for (let i = 0; i < 3; i++) {
      backCabs.push({
        sku: `LD-STD|${doorWidth}|30.5`,
        width: doorWidth,
        role: "island-loose-door",
      });
    }
  }

  // End panels
  const endPanels = [];
  if (island.endTreatment === "waterfall" || prefs.sophistication === "very_high") {
    const panelH = Math.round(depth + DIMS.counterThickness + 0.5);
    endPanels.push({ sku: `EDGTL|${DIMS.baseHeight}|${panelH}|0.75`, role: "island-end-left" });
    endPanels.push({ sku: `EDGTL|${DIMS.baseHeight}|${panelH}|0.75`, role: "island-end-right" });
  } else {
    endPanels.push({ sku: "FBEP 3/4-FTK-L", role: "island-end-left" });
    endPanels.push({ sku: "FBEP 3/4-FTK-R", role: "island-end-right" });
  }

  // Calculate overhang data
  const seatingStyle = prefs.seatingStyle || "bar";
  const bracketStyle = prefs.bracketStyle || "SS";
  const overhang = generateOverhangData(length, seatingStyle, bracketStyle);

  // ── Assign cumulative positions to island cabinets ──
  // Same pattern as fillWallSegment: position = running total from island start (0)
  let workPos = 0;
  for (const cab of workCabs) {
    cab.position = workPos;
    workPos += cab.width || 0;
  }
  let backPos = 0;
  for (const cab of backCabs) {
    cab.position = backPos;
    backPos += cab.width || 0;
  }

  return {
    pattern,
    length,
    depth,
    workSide: workCabs,
    backSide: backCabs,
    endPanels,
    hasRange,
    hasSink,
    overhang,
    _warnings,
  };
}


// ─── PENINSULA SOLVER ──────────────────────────────────────────────────────

function solvePeninsula(peninsula, prefs, golaPrefix) {
  const { length, depth = PENINSULA_RULES.standardDepths[0] || 36 } = peninsula;

  // Peninsula columns (structural)
  const columns = [];
  const colW = PENINSULA_RULES.columnWidth || 3;
  const colH = PENINSULA_RULES.columnHeight || 34.5;
  columns.push({
    sku: `PBC3341/2-${colH}|${depth}`,
    width: colW,
    height: colH,
    depth,
    role: "peninsula-column-left",
    finSide: "B",
  });
  columns.push({
    sku: `PBC3341/2-${colH}|${depth}`,
    width: colW,
    height: colH,
    depth,
    role: "peninsula-column-right",
    finSide: "B",
  });

  // Edge banded shelf for overhang / seating
  const shelfDepth = peninsula.shelfDepth || length;
  const shelfWidth = peninsula.shelfWidth || 14;
  const shelf = {
    sku: `1 1/4" Edge Banded Shelf`,
    width: shelfWidth,
    depth: shelfDepth,
    height: 1.5,
    role: "peninsula-shelf",
    mods: peninsula.lighting ? ["PWL"] : [],
  };

  // REP end panels (left + right)
  const repHeight = peninsula.repHeight || 48;
  const repDepth = shelfWidth;
  const endPanels = [
    {
      sku: `REP6R1 1/2${Math.round(DIMS.baseHeight)}${Math.round(repDepth * 100 / 100)}L`,
      width: 1.5,
      height: repHeight,
      depth: repDepth,
      role: "peninsula-end-left",
      finSide: "B",
    },
    {
      sku: `REP6R1 1/2${Math.round(DIMS.baseHeight)}${Math.round(repDepth * 100 / 100)}R`,
      width: 1.5,
      height: repHeight,
      depth: repDepth,
      role: "peninsula-end-right",
      finSide: "B",
      price: 0,
      notes: "CUT FROM left panel",
    },
  ];

  // Calculate overhang data for peninsula shelf
  const seatingStyle = prefs.seatingStyle || "bar";
  const bracketStyle = prefs.bracketStyle || "SS";
  // Peninsula shelf length is the shelf depth (which spans the length of island for seating)
  const shelfLength = shelf.depth || length;
  const overhang = generateOverhangData(shelfLength, seatingStyle, bracketStyle);

  return {
    pattern: "column_peninsula_with_shelf",
    length,
    depth,
    columns,
    shelf,
    endPanels,
    overhang,
  };
}


// ─── LIGHTING PACKAGE BUILDER ─────────────────────────────────────────────────

/**
 * Generate lighting accessories based on preferences.
 *
 * @param {Array} wallLayouts - Wall layout results
 * @param {Array} upperLayouts - Upper cabinet layouts
 * @param {Object} islandLayout - Island layout (if any)
 * @param {Object} peninsulaLayout - Peninsula layout (if any)
 * @param {Object} prefs - Design preferences including lightingPackage
 * @returns {Object} { accessories: [...], metadata: {...} }
 */
function generateLighting(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, prefs) {
  const lightingPackage = prefs.lightingPackage || "none";
  const lightingZones = prefs.lightingZones || {};
  const accessories = [];
  const metadata = {
    package: lightingPackage,
    zones: {},
    totalFixtures: 0,
  };

  // If package is "none", return empty
  if (lightingPackage === "none") {
    return { accessories: [], metadata };
  }

  // Determine which zones are active based on package
  let activeZones = {
    underCabinet: false,
    inCabinet: false,
    toeKick: false,
    displayShelf: false,
  };

  if (lightingPackage === "custom") {
    // Use explicit lightingZones
    activeZones = { ...lightingZones };
  } else if (lightingPackage === "basic") {
    activeZones.underCabinet = true;
  } else if (lightingPackage === "standard") {
    activeZones.underCabinet = true;
    activeZones.inCabinet = true;
  } else if (lightingPackage === "premium") {
    activeZones.underCabinet = true;
    activeZones.inCabinet = true;
    activeZones.toeKick = true;
    activeZones.displayShelf = true;
  }

  // Under-cabinet LED strips (UCL) — one per wall with upper cabinets
  if (activeZones.underCabinet) {
    let uclCount = 0;
    for (const ul of upperLayouts) {
      if (ul.cabinets && ul.cabinets.length > 0) {
        const totalWidth = ul.cabinets.reduce((sum, c) => sum + (c.width || 0), 0);
        const lengthFeet = Math.ceil(totalWidth / 12);
        if (lengthFeet > 0) {
          accessories.push({
            sku: `UCL-${lengthFeet}'`,
            width: totalWidth,
            linearFeet: lengthFeet,
            role: "lighting",
            type: "under-cabinet",
            wall: ul.wallId,
          });
          uclCount++;
        }
      }
    }
    metadata.zones.underCabinet = uclCount;
    metadata.totalFixtures += uclCount;
  }

  // In-cabinet lighting (ICL) — one per glass display cabinet
  if (activeZones.inCabinet) {
    let iclCount = 0;
    for (const ul of upperLayouts) {
      if (ul.cabinets && ul.cabinets.length > 0) {
        // Count glass display cabs: wall_glass_display type or has GFD modification
        for (const cab of ul.cabinets) {
          const isGlassDisplay = cab.type === "wall_glass_display" ||
                                 cab.sku?.includes("SW") ||
                                 (cab.modifications && cab.modifications.some(m => m.mod === "GFD"));
          if (isGlassDisplay) {
            accessories.push({
              sku: `ICL-${iclCount + 1}`,
              role: "lighting",
              type: "in-cabinet",
              cabinetSku: cab.sku,
              wall: ul.wallId,
            });
            iclCount++;
          }
        }
      }
    }
    metadata.zones.inCabinet = iclCount;
    metadata.totalFixtures += iclCount;
  }

  // Toe kick LED strips (TKL) — one per wall with base cabinets
  if (activeZones.toeKick) {
    let tklCount = 0;
    for (const wl of wallLayouts) {
      const baseCabs = wl.cabinets.filter(c => c.type === "base");
      if (baseCabs.length > 0) {
        const totalWidth = baseCabs.reduce((sum, c) => sum + (c.width || 0), 0);
        const lengthFeet = Math.ceil(totalWidth / 12);
        if (lengthFeet > 0) {
          accessories.push({
            sku: `TKL-${lengthFeet}'`,
            width: totalWidth,
            linearFeet: lengthFeet,
            role: "lighting",
            type: "toe-kick",
            wall: wl.wallId,
            mods: [{ mod: "PTKL", qty: 1 }],
          });
          tklCount++;
        }
      }
    }
    metadata.zones.toeKick = tklCount;
    metadata.totalFixtures += tklCount;
  }

  // Display shelf lighting (DSL) — floating shelves and display cabs
  if (activeZones.displayShelf) {
    let dslCount = 0;

    // Check for floating shelves (FLS type)
    for (const ul of upperLayouts) {
      if (ul.cabinets && ul.cabinets.length > 0) {
        for (const cab of ul.cabinets) {
          const isDisplayShelf = cab.type === "floating_shelf" || cab.sku?.includes("FLS") || cab.sku?.includes("WND");
          if (isDisplayShelf) {
            accessories.push({
              sku: `DSL-${dslCount + 1}`,
              role: "lighting",
              type: "display-shelf",
              cabinetSku: cab.sku,
              wall: ul.wallId,
              mods: [{ mod: "PFSL", qty: 1 }],
            });
            dslCount++;
          }
        }
      }
    }

    // Check peninsula floating shelves
    if (peninsulaLayout && peninsulaLayout.shelf) {
      const shelf = peninsulaLayout.shelf;
      if (shelf.sku && (shelf.sku.includes("FLS") || shelf.sku.includes("floating"))) {
        accessories.push({
          sku: `DSL-${dslCount + 1}`,
          role: "lighting",
          type: "display-shelf",
          cabinetSku: shelf.sku,
          wall: "peninsula",
          mods: [{ mod: "PFSL", qty: 1 }],
        });
        dslCount++;
      }
    }

    metadata.zones.displayShelf = dslCount;
    metadata.totalFixtures += dslCount;
  }

  return { accessories, metadata };
}


// ─── ACCESSORY GENERATOR ────────────────────────────────────────────────────

function generateAccessories(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, walls, appliances, prefs, talls = []) {
  const accessories = [];
  const roomDef = prefs.roomDef || ROOM_TYPES.kitchen;
  let totalEndPanels = 0;
  let totalFillers = 0;

  // Minimum cabinet width threshold for filler generation
  const MIN_CAB_WIDTH = 9;
  const MAX_GAP_FOR_FILLER = 12; // gaps > 9" but < this use filler

  // ── MOLDINGS & FILLERS GUIDE: Toe Kick ─────────────────────────────────────
  // Guide: "In frameless, the toe kick is typically a separate applied panel."
  //   Standard height: 4". Standard depth: 3" to 3½".
  //   Must be mitered at inside corners.
  //   Must be coped or butted at outside corners.
  //   Every exposed end requires a finished return (mitered or factory end cap).
  //   NEVER leave a raw toe kick end visible.
  const hasFloatingVanity = roomDef.specialCabinets?.includes("FLVSB");
  const totalBaseRunLF = wallLayouts.reduce((sum, w) => {
    return sum + w.cabinets.filter(c => c.type === "base").reduce((s, c) => s + (c.width || 0), 0);
  }, 0);

  // Count corners for toe kick mitering
  const insideCornerCount = corners.filter(c => c.type !== "none").length;
  const exposedEndCount = wallLayouts.reduce((count, wl) => {
    const baseCabs = wl.cabinets.filter(c => c.type === "base");
    if (baseCabs.length === 0) return count;
    const hasLeftCorner = wl.corners?.some(c => corners.find(cr => cr.id === c));
    const hasRightCorner = wl.corners?.some(c => corners.find(cr => cr.id === c && cr.wallA === wl.wallId));
    return count + (hasLeftCorner ? 0 : 1) + (hasRightCorner ? 0 : 1);
  }, 0);

  if (totalBaseRunLF > 0 && !hasFloatingVanity) {
    const tkLengths = Math.ceil(totalBaseRunLF / 96); // 8ft lengths
    const toeKickStyle = prefs.toeKickStyle || "standard";
    let tkSku, tkHeight;

    // Determine toe kick SKU and height based on style
    switch (toeKickStyle) {
      case "recessed":
        tkSku = "TK-RTK-8'";
        tkHeight = 4.5; // 4.5" with 3" recess
        // Add PTKL (toe kick lighting prep) modification
        accessories.push({ sku: "PTKL", qty: tkLengths, role: "toe-kick-mod", style: "recessed" });
        break;
      case "flush":
        tkSku = "TK-FTK-8'";
        tkHeight = 4.5;
        break;
      case "furniture":
        tkSku = `FBM-8'`;
        tkHeight = 6; // Furniture legs are taller
        break;
      case "plinth":
        tkSku = "PLN-8'";
        tkHeight = 3.5; // Solid plinth is shorter
        break;
      case "standard":
      default:
        tkSku = "TK-N/C";
        tkHeight = 4.5;
        break;
    }

    accessories.push({ sku: tkSku, qty: tkLengths, role: "toe-kick", style: toeKickStyle, height: tkHeight });

    // Toe kick miter returns at inside corners (frameless guide rule)
    if (insideCornerCount > 0) {
      accessories.push({
        sku: "TK-MITER",
        qty: insideCornerCount,
        role: "toe-kick-miter",
        note: "Mitered at inside corners per frameless guide",
      });
    }
    // Toe kick finished returns at every exposed end (NEVER leave raw end visible)
    if (exposedEndCount > 0) {
      accessories.push({
        sku: "TK-RETURN",
        qty: exposedEndCount,
        role: "toe-kick-return",
        note: "Finished return at exposed ends — mitered return or factory end cap",
      });
    }
  }

  // Sub rail for wall cabs (only when uppers are present)
  if (prefs.upperApproach !== "none" && prefs.upperApproach !== "minimal") {
    const totalUpperRunLF = wallLayouts.reduce((sum, w) => sum + w.wallLength, 0);
    if (totalUpperRunLF > 0) {
      const srLengths = Math.ceil(totalUpperRunLF / 120); // 10ft lengths
      accessories.push({ sku: "3SRM3F-10'", qty: srLengths, role: "sub-rail" });
    }
  }

  // ── CYNCLY PHASE 8: End panels, fillers at wall junctions, appliance buffers ──
  // Cyncly 2020 Guide: "Add filler strips at every wall-to-cabinet junction where
  // the cabinet doesn't meet the wall squarely. A 3" filler is standard."
  // Also: "Add fillers next to all appliances: minimum 3" between a range and a
  // tall cabinet, and any manufacturer-specified clearance."
  for (const wl of wallLayouts) {
    const baseCabs = wl.cabinets.filter(c => c.type === "base");
    const allCabs = wl.cabinets || [];
    if (baseCabs.length > 0) {
      const first = baseCabs[0];
      const last = baseCabs[baseCabs.length - 1];
      const hasLeftCorner = wl.corners.some(c => corners.find(cr => cr.id === c && cr.wallB === wl.wallId));
      const hasRightCorner = wl.corners.some(c => corners.find(cr => cr.id === c && cr.wallA === wl.wallId));

      // For vanity rooms, use BEP (base end panel) with flush toe kick
      // Catalog format: BEP3/4-FTK-L/R (single SKU for both sides)
      const endPanelPrefix = (prefs.roomType === "vanity" || prefs.roomType === "master_bath")
        ? "BEP1 1/2" : "BEP3/4-FTK";

      // ── Left wall junction: filler + end panel ──
      // FRAMELESS GOLDEN RULE: Every cabinet run starting at a wall junction
      // needs a minimum 3" filler (or overlay filler) to prevent drawer/door
      // interference with the perpendicular wall surface.
      if (!hasLeftCorner) {
        if (first.position <= 6) {
          accessories.push({ sku: `${endPanelPrefix}-L/R`, wall: wl.wallId, role: "base-end-panel-left" });
          totalEndPanels++;
        }
        const leftGap = first.position;
        if (leftGap < 3) {
          // Gap is too small or zero — must insert/expand to 3" minimum
          const fillerW = 3;
          // Shift all cabinets right by (3 - leftGap) to make room
          const shiftNeeded = fillerW - leftGap;
          if (shiftNeeded > 0) {
            for (const cab of sorted) {
              cab.position = (cab.position || 0) + shiftNeeded;
            }
          }
          accessories.push({
            sku: 'F30',
            width: fillerW,
            wall: wl.wallId,
            role: "base-filler-wall-junction-left",
            position: 0,
            cynclyRule: "Frameless golden rule: 3\" min filler at wall junction (left)",
          });
          totalFillers++;
        } else if (leftGap >= 3 && leftGap <= 6 && leftGap < MAX_GAP_FOR_FILLER) {
          // Gap is 3-6": use as filler width directly
          const fillerW = Math.round(leftGap);
          accessories.push({
            sku: `F${fillerW}0`,
            width: fillerW,
            wall: wl.wallId,
            role: "base-filler-wall-junction-left",
            position: 0,
            cynclyRule: "Phase 8: filler at wall-to-cabinet junction (left side)",
          });
          totalFillers++;
        } else if (leftGap > 6 && leftGap <= 12) {
          // Gap 7-12": widen adjacent cabinet via MOD WIDTH instead of large filler
          // (Never use fillers wider than 6" — the guide says widen the adjacent cabinet)
          const widthIncrease = leftGap;
          first.position = 0;
          first.width = (first.width || 0) + widthIncrease;
          first._modWidth = true;
          first._modWidthNote = `MOD +${widthIncrease}" to fill wall junction gap`;
        } else if (leftGap > 12) {
          // Large gap: insert standard 3" filler + note gap for review
          accessories.push({
            sku: 'F30',
            width: 3,
            wall: wl.wallId,
            role: "base-filler-wall-junction-left",
            position: 0,
            cynclyRule: "Phase 8: 3\" filler at wall junction (large gap — review layout)",
          });
          totalFillers++;
        }
      }

      // ── Right wall junction: filler + end panel ──
      if (!hasRightCorner) {
        const lastCabEnd = last.position + (last.width || 0);
        const gapToWall = wl.wallLength - lastCabEnd;

        accessories.push({ sku: `${endPanelPrefix}-L/R`, wall: wl.wallId, role: "base-end-panel-right" });
        totalEndPanels++;

        // Frameless golden rule: 3" min filler at right wall junction
        if (gapToWall > 0 && gapToWall < 3) {
          // Insert 3" filler (shrink last cabinet slightly or just add filler)
          accessories.push({
            sku: 'F30',
            width: 3,
            wall: wl.wallId,
            role: "base-filler-wall-junction-right",
            position: lastCabEnd,
            cynclyRule: "Frameless golden rule: 3\" min filler at wall junction (right)",
          });
          totalFillers++;
        } else if (gapToWall >= 3 && gapToWall <= 6) {
          const fillerW = Math.round(gapToWall);
          accessories.push({
            sku: `F${fillerW}0`,
            width: fillerW,
            wall: wl.wallId,
            role: "base-filler-wall-junction-right",
            position: lastCabEnd,
            cynclyRule: "Phase 8: filler at wall-to-cabinet junction (right side)",
          });
          totalFillers++;
        } else if (gapToWall > 6 && gapToWall <= 12) {
          // Gap 7-12": widen last cabinet via MOD WIDTH
          last.width = (last.width || 0) + gapToWall;
          last._modWidth = true;
          last._modWidthNote = `MOD +${gapToWall}" to fill right wall junction gap`;
        } else if (gapToWall > 12) {
          accessories.push({
            sku: 'F30',
            width: 3,
            wall: wl.wallId,
            role: "base-filler-wall-junction-right",
            position: wl.wallLength - 3,
            cynclyRule: "Phase 8: 3\" filler at wall junction (large gap — review)",
          });
          totalFillers++;
        }
      }

      // ── Cyncly Phase 8: Range-to-tall-cabinet filler (3" minimum) ──
      // "Add fillers next to all appliances: minimum 3" between a range and a tall cabinet"
      // "When placing a tall cabinet next to a range, always add a 3" filler between them.
      //  This prevents heat damage to the tall cabinet and ensures the range door handle clears."
      const rangeOnWall = allCabs.find(c => c.type === "appliance" &&
        (c.applianceType === "range" || c.applianceType === "cooktop"));
      if (rangeOnWall) {
        const rangeStart = rangeOnWall.position;
        const rangeEnd = rangeStart + (rangeOnWall.width || 30);
        // Check tall cabinets and fridge (which acts as a tall)
        const tallItems = allCabs.filter(c =>
          c.type === "tall" || c.role === "tall" ||
          (c.type === "appliance" && (c.applianceType === "refrigerator" || c.applianceType === "freezer")));
        for (const tall of tallItems) {
          const tallStart = tall.position;
          const tallEnd = tallStart + (tall.width || 0);
          // Adjacent on right of range
          if (Math.abs(tallStart - rangeEnd) <= 1) {
            const existingFiller = allCabs.some(c => c.type === "filler" && c.position >= rangeEnd - 1 && c.position <= tallStart + 1);
            if (!existingFiller) {
              accessories.push({
                sku: "F330",
                width: 3,
                wall: wl.wallId,
                role: "range-tall-buffer-filler",
                position: rangeEnd,
                cynclyRule: "Phase 8: 3\" filler between range and tall cabinet (heat + handle clearance)",
              });
              totalFillers++;
            }
          }
          // Adjacent on left of range
          if (Math.abs(tallEnd - rangeStart) <= 1) {
            const existingFiller = allCabs.some(c => c.type === "filler" && c.position >= tallEnd - 1 && c.position <= rangeStart + 1);
            if (!existingFiller) {
              accessories.push({
                sku: "F330",
                width: 3,
                wall: wl.wallId,
                role: "range-tall-buffer-filler",
                position: tallEnd,
                cynclyRule: "Phase 8: 3\" filler between tall cabinet and range (heat + handle clearance)",
              });
              totalFillers++;
            }
          }
        }
      }
    }
  }

  // Wall end panels at exposed upper run ends (FWEP for wall cabinets)
  if (prefs.upperApproach !== "none" && prefs.upperApproach !== "minimal") {
    for (const ul of upperLayouts) {
      if (ul.cabinets && ul.cabinets.length > 0) {
        const first = ul.cabinets[0];
        const last = ul.cabinets[ul.cabinets.length - 1];
        const hasLeftCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallB === ul.wallId));
        const hasRightCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallA === ul.wallId));

        // FWEP3/4 for wall end panels — catalog format: FWEP3/4-L/R-{height}"
        const upperH = first.height || prefs.upperHeight || 27;

        if (!hasLeftCorner && first.position <= 6) {
          accessories.push({ sku: `FWEP3/4-L/R-${upperH}"`, wall: ul.wallId, role: "wall-end-panel-left" });
          totalEndPanels++;
        }
        if (!hasRightCorner) {
          accessories.push({ sku: `FWEP3/4-L/R-${upperH}"`, wall: ul.wallId, role: "wall-end-panel-right" });
          totalEndPanels++;
        }
      }
    }
  }

  // ── UPPER CABINET wall-junction fillers ──────────────────────────────────
  // Moldings & Fillers Guide: Wall Filler applies to "Cabinet to wall (upper or lower)"
  // Same golden rule: never let a cabinet box touch a wall at a drawer/door edge.
  if (prefs.upperApproach !== "none" && prefs.upperApproach !== "minimal") {
    for (const ul of upperLayouts) {
      const upperCabs = (ul.cabinets || []).filter(c => {
        const role = c.role || "";
        const isHood = role === "range_hood" || role === "rangeHood" || c.type === "rangeHood";
        const isMicro = c.applianceType === "microwave";
        return !isHood && !isMicro; // skip appliances — only real wall cabinets get fillers
      });
      if (upperCabs.length === 0) continue;

      const first = upperCabs[0];
      const last = upperCabs[upperCabs.length - 1];
      const hasLeftCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallB === ul.wallId));
      const hasRightCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallA === ul.wallId));
      const upperH = first.height || prefs.upperHeight || 39;

      // Left wall junction filler for uppers
      if (!hasLeftCorner) {
        const leftGap = first.position;
        if (leftGap > 0.5 && leftGap < MAX_GAP_FOR_FILLER && leftGap >= 3) {
          const fillerW = Math.round(leftGap);
          accessories.push({
            sku: `F${fillerW}${upperH}`,
            width: fillerW,
            height: upperH,
            wall: ul.wallId,
            role: "wall-filler-upper-left",
            position: 0,
            cynclyRule: "Moldings Guide: wall filler at upper-to-wall junction (left side)",
          });
          totalFillers++;
        }
      }

      // Right wall junction filler for uppers
      if (!hasRightCorner) {
        const lastCabEnd = last.position + (last.width || 0);
        const gapToWall = ul.wallLength - lastCabEnd;
        if (gapToWall > 0.5 && gapToWall < MAX_GAP_FOR_FILLER && gapToWall >= 3) {
          const fillerW = Math.round(gapToWall);
          accessories.push({
            sku: `F${fillerW}${upperH}`,
            width: fillerW,
            height: upperH,
            wall: ul.wallId,
            role: "wall-filler-upper-right",
            position: lastCabEnd,
            cynclyRule: "Moldings Guide: wall filler at upper-to-wall junction (right side)",
          });
          totalFillers++;
        }
      }
    }
  }

  // ── TALL CABINET wall-junction fillers ──────────────────────────────────
  // Moldings & Fillers Guide: Tall/Pantry Filler 1-6"+, "Tall cabinet to wall"
  // Full-height filler from floor to ceiling (or to cab top).
  {
    // Group talls by wall
    const tallsByWall = {};
    for (const t of talls) {
      if (!t.wall || typeof t.position !== "number") continue;
      if (!tallsByWall[t.wall]) tallsByWall[t.wall] = [];
      tallsByWall[t.wall].push(t);
    }
    for (const [wallId, wallTalls] of Object.entries(tallsByWall)) {
      const wall = walls.find(w => w.id === wallId);
      if (!wall) continue;
      const wallLen = wall.length || wall.width || 120;

      // Sort by position
      wallTalls.sort((a, b) => a.position - b.position);

      const firstTall = wallTalls[0];
      const lastTall = wallTalls[wallTalls.length - 1];
      const tallH = firstTall.height || 90; // typical tall cabinet height

      // Check if tall is at a wall junction (not a corner junction)
      const hasLeftCorner = corners.some(cr => cr.wallB === wallId);
      const hasRightCorner = corners.some(cr => cr.wallA === wallId);

      // Left wall junction filler for talls
      if (!hasLeftCorner && firstTall.position > 0.5) {
        const leftGap = firstTall.position;
        if (leftGap < MAX_GAP_FOR_FILLER && leftGap >= 3) {
          const fillerW = Math.round(leftGap);
          accessories.push({
            sku: `F${fillerW}${tallH}`,
            width: fillerW,
            height: tallH,
            wall: wallId,
            role: "tall-filler-wall-junction-left",
            position: 0,
            cynclyRule: "Moldings Guide: tall/pantry filler at wall junction (left side)",
          });
          totalFillers++;
        }
      }

      // Right wall junction filler for talls
      if (!hasRightCorner) {
        const lastTallEnd = lastTall.position + (lastTall.width || 0);
        const gapToWall = wallLen - lastTallEnd;
        if (gapToWall > 0.5 && gapToWall < MAX_GAP_FOR_FILLER && gapToWall >= 3) {
          const fillerW = Math.round(gapToWall);
          accessories.push({
            sku: `F${fillerW}${tallH}`,
            width: fillerW,
            height: tallH,
            wall: wallId,
            role: "tall-filler-wall-junction-right",
            position: lastTallEnd,
            cynclyRule: "Moldings Guide: tall/pantry filler at wall junction (right side)",
          });
          totalFillers++;
        }
      }
    }
  }

  // DSB diagonal sink base — BEP3-RTK recessed toe kick end panels (Kamisar pattern)
  for (const corner of corners) {
    if (corner.type === "diagonalSink") {
      accessories.push({
        sku: "BEP3L-RTK",
        wall: `${corner.wallA}-${corner.wallB}`,
        role: "dsb-end-panel-left",
        patternId: "sink_diagonal_corner",
      });
      accessories.push({
        sku: "BEP3R-RTK",
        wall: `${corner.wallA}-${corner.wallB}`,
        role: "dsb-end-panel-right",
        patternId: "sink_diagonal_corner",
      });
      totalEndPanels += 2;
    }
  }

  // ── MOLDINGS & FILLERS GUIDE: Scribe Molding ──────────────────────────────
  // Guide: "At any visible wall junction, especially on exposed end panels.
  //   Scribe covers the small gaps that remain after the cabinet is installed."
  //   Typical thickness: ¼" to ½". Same finish as adjacent cabinet.
  //   Cut and fit in field by installer — specify enough footage.
  // We estimate scribe molding needed at every wall junction (base + upper runs).
  {
    let totalScribeLF = 0;
    for (const wl of wallLayouts) {
      const baseCabs = wl.cabinets.filter(c => c.type === "base");
      if (baseCabs.length === 0) continue;
      // Scribe at left wall junction
      const hasLeftCorner = wl.corners?.some(c => corners.find(cr => cr.id === c && cr.wallB === wl.wallId));
      if (!hasLeftCorner) {
        totalScribeLF += 30; // base cabinet height
      }
      // Scribe at right wall junction
      const hasRightCorner = wl.corners?.some(c => corners.find(cr => cr.id === c && cr.wallA === wl.wallId));
      if (!hasRightCorner) {
        totalScribeLF += 30;
      }
    }
    // Upper scribe runs
    for (const ul of upperLayouts) {
      if (!ul.cabinets || ul.cabinets.length === 0) continue;
      const hasLeftCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallB === ul.wallId));
      if (!hasLeftCorner) totalScribeLF += 39; // upper cabinet height
      const hasRightCorner = ul.corners?.some(c => corners.find(cr => cr.id === c && cr.wallA === ul.wallId));
      if (!hasRightCorner) totalScribeLF += 39;
    }

    if (totalScribeLF > 0) {
      const scribeQty = Math.ceil(totalScribeLF / 96); // 8' lengths
      accessories.push({
        sku: "SCRIBE-8'",
        qty: scribeQty,
        role: "accessory",
        subrole: "scribe-molding",
        linearFeet: totalScribeLF,
        note: "Scribe at all visible wall junctions — ¼-½\" flexible trim, same finish as cabinets",
      });
    }
  }

  // Peninsula accessories
  if (peninsulaLayout) {
    for (const col of peninsulaLayout.columns) {
      accessories.push({ ...col, wall: "peninsula" });
    }
    accessories.push({ ...peninsulaLayout.shelf, wall: "peninsula" });
    for (const ep of peninsulaLayout.endPanels) {
      accessories.push({ ...ep, wall: "peninsula" });
      totalEndPanels++;
    }
  }

  // Island overhang support brackets
  if (islandLayout && islandLayout.overhang) {
    for (const bracket of islandLayout.overhang.supports) {
      accessories.push({ ...bracket, wall: "island" });
    }
  }

  // Peninsula overhang support brackets
  if (peninsulaLayout && peninsulaLayout.overhang) {
    for (const bracket of peninsulaLayout.overhang.supports) {
      accessories.push({ ...bracket, wall: "peninsula" });
    }
  }

  // ── MOLDINGS & FILLERS GUIDE: Crown Molding / Ceiling Treatment ──────────
  // User selects ceiling treatment: "crown" | "to_ceiling" | "none"
  //   crown:      Crown molding bridges gap between upper top and ceiling
  //   to_ceiling: Cabinets sized to reach ceiling — no crown needed
  //   none:       No crown, exposed cabinet top (modern/minimal)
  //
  // Crown gap sizing (from guide):
  //   < 2":   Flat top panel + small scribe molding
  //   2-5":   Standard crown profile
  //   5-12":  Tall crown or stacking molding
  //   > 12":  Stacking boxes (decorative open-front) + their own crown
  const ceilingTreatment = prefs.ceilingTreatment || "crown";
  const sophVeryHigh = prefs.sophistication === "very_high";
  const ceilingH = prefs.ceilingHeight || 96;

  if (ceilingTreatment === "crown" && upperLayouts.length > 0) {
    // Calculate total linear feet of upper cabinet runs
    const totalUpperLF = upperLayouts.reduce((sum, ul) => {
      const totalWidth = (ul.cabinets || []).reduce((s, c) => s + (c.width || 0), 0);
      return sum + totalWidth;
    }, 0);

    if (totalUpperLF > 0) {
      // Determine ceiling gap and crown approach
      const upperH = prefs.upperHeight || 39;     // standard upper height
      const upperBottom = 54;                       // standard upper bottom AFF
      const upperTopAFF = upperBottom + upperH;     // typically 93"
      const ceilingGap = ceilingH - upperTopAFF;    // typically 3"

      let crownApproach, crownSku;
      const crownStyle = prefs.crownStyle || "standard";

      if (ceilingGap < 2) {
        // Flat top panel + scribe — very small gap
        crownApproach = "flat_top_panel_plus_scribe";
        crownSku = `FTP-SCRIBE-8'`;
      } else if (ceilingGap <= 5) {
        // Standard crown profile
        crownApproach = "standard_crown";
        crownSku = `CRN-${crownStyle}-8'`;
      } else if (ceilingGap <= 12) {
        // Tall crown or stacking molding
        crownApproach = "tall_crown";
        crownSku = `CRN-TALL-${crownStyle}-10'`;
      } else {
        // Stacking boxes needed (gap > 12")
        crownApproach = "stacking_boxes";
        crownSku = `CRN-${crownStyle}-8'`; // crown still goes on top of stacking boxes
      }

      // Crown moulding sold in 8ft or 10ft lengths. Add 15-20% for miter waste.
      const stickLength = crownApproach === "tall_crown" ? 120 : 96;
      const wasteMultiplier = 1.17; // ~17% for miters
      const crownQty = Math.ceil((totalUpperLF * wasteMultiplier) / stickLength);

      accessories.push({
        sku: crownSku,
        qty: crownQty,
        role: "accessory",
        subrole: "crown-moulding",
        linearFeet: totalUpperLF,
        ceilingGap,
        crownApproach,
        _ceilingTreatment: "crown",
      });

      // If stacking boxes needed (gap > 12"), add those too
      if (crownApproach === "stacking_boxes") {
        const stackingBoxH = ceilingGap - 3; // leave 3" for crown on top
        accessories.push({
          sku: `STK-BOX-${Math.round(stackingBoxH)}`,
          role: "accessory",
          subrole: "stacking-box",
          height: stackingBoxH,
          linearFeet: totalUpperLF,
          note: "Open-front decorative boxes above uppers, topped with their own crown",
          _ceilingTreatment: "crown",
        });
      }
    }
  } else if (ceilingTreatment === "to_ceiling" && upperLayouts.length > 0) {
    // Cabinets extend to ceiling — may need flat filler strip at ceiling junction
    accessories.push({
      sku: "CEIL-FILLER-STRIP",
      role: "accessory",
      subrole: "ceiling-filler",
      note: "Flat filler strip at ceiling junction to absorb out-of-level ceiling",
      _ceilingTreatment: "to_ceiling",
    });
  }
  // ceilingTreatment === "none" → no crown, no ceiling filler — modern/minimal

  // ── MOLDINGS & FILLERS GUIDE: Light Rail Molding ───────────────────────────
  // Location: Bottom face of upper cabinets.
  // Guide rule: "Light rail is required any time under-cabinet lighting is specified.
  //   Even without lighting, it's a strong finishing detail."
  // CRITICAL: "It does NOT run in front of range hoods, microwaves, or other
  //   appliances — it terminates cleanly just before each appliance."
  const lightRailRequested = prefs.lightRail === true;
  const lightRailExcluded = prefs.lightRail === false;
  const sophHighOrVeryHigh = prefs.sophistication === "high" || prefs.sophistication === "very_high";
  const hasUnderCabLighting = prefs.lightingPackage !== "none" || prefs.lightingZones?.underCab;
  const shouldAddLightRail = (sophHighOrVeryHigh || lightRailRequested || hasUnderCabLighting) && !lightRailExcluded;

  if (shouldAddLightRail && upperLayouts.length > 0) {
    // Calculate light rail per wall, EXCLUDING hood and appliance zones
    let totalLightRailLF = 0;

    for (const ul of upperLayouts) {
      if (!ul.cabinets || ul.cabinets.length === 0) continue;
      for (const cab of ul.cabinets) {
        const role = cab.role || cab.type || '';
        const isHood = role === 'range_hood' || role === 'rangeHood' || cab.type === 'rangeHood';
        const isMicrowave = cab.applianceType === 'microwave';
        const isAppliance = isHood || isMicrowave;
        // Light rail runs under wall cabinets only — NOT under hoods/microwaves
        if (!isAppliance) {
          totalLightRailLF += (cab.width || 0);
        }
      }
    }

    if (totalLightRailLF > 0) {
      // Light rail sold in 8ft lengths
      const lightRailQty = Math.ceil(totalLightRailLF / 96);
      const lrProfile = prefs.lightRailProfile || "simple";
      accessories.push({
        sku: `LR-${lrProfile === "cove" ? "COVE" : lrProfile === "ogee" ? "OGEE" : "SQ"}-8'`,
        qty: lightRailQty,
        role: "accessory",
        subrole: "light-rail",
        linearFeet: totalLightRailLF,
        profile: lrProfile,
        note: "Does NOT run in front of range hoods or microwaves — terminates at each appliance",
      });
    }
  }

  // Valance generation — decorative board above sink windows between upper cab runs
  // Trigger: wall has a window opening AND uppers skip that zone
  for (const ul of upperLayouts) {
    const wallDef = walls.find(w => w.id === ul.wallId);
    if (!wallDef || !wallDef.openings) continue;

    // Find windows in this wall
    const windows = wallDef.openings.filter(o => o.type === "window");
    if (windows.length === 0) continue;

    // Generate valance for each window
    for (const win of windows) {
      const valanceWidth = Math.round(win.width);
      const soph = prefs.sophistication || "high";
      const valanceHeight = soph === "very_high" ? 8 : 5; // 8" for very_high, 5" standard

      // Determine valance style suffix
      let valanceSku = `VLN-${valanceWidth}`;
      const valanceStyle = prefs.valanceStyle || "straight"; // straight, arched, scalloped
      if (valanceStyle === "arched") {
        valanceSku += "-A";
      } else if (valanceStyle === "scalloped") {
        valanceSku += "-S";
      }

      accessories.push({
        sku: valanceSku,
        width: valanceWidth,
        height: valanceHeight,
        role: "valance",
        wall: ul.wallId,
        position: win.posFromLeft,
        valanceStyle,
      });
    }
  }

  // Light bridge generation — spans between upper cabinets for under-cabinet task lighting
  // Trigger: prefs.lightBridge is true OR sophistication is very_high
  const lightBridgeRequested = prefs.lightBridge === true;
  const lightBridgeExcluded = prefs.lightBridge === false;
  const sophVeryHighForLightBridge = prefs.sophistication === "very_high";
  const shouldAddLightBridge = lightBridgeRequested && !lightBridgeExcluded;

  if (shouldAddLightBridge && upperLayouts.length > 0) {
    for (const ul of upperLayouts) {
      if (ul.cabinets && ul.cabinets.length > 0) {
        // Calculate total width of upper cabinet run on this wall
        const totalUpperWidth = ul.cabinets.reduce((sum, c) => sum + (c.width || 0), 0);

        if (totalUpperWidth > 0) {
          const lbWidth = totalUpperWidth;
          accessories.push({
            sku: `LB-${lbWidth}`,
            width: lbWidth,
            role: "light_bridge",
            wall: ul.wallId,
            mods: [{ mod: "PWL", qty: 1 }],
          });
        }
      }
    }
  }

  // Appliance panel overlay generation — panel-ready fridges and dishwashers
  // DWP: dishwasher panel, FDP: fridge panel, FZP: freezer drawer panel
  // Uses both appliance.panelReady flag AND prefs.fridgePaneled / prefs.dwPaneled
  // (pref overrides: if user selects "exposed", skip panel even if appliance is panel-ready capable)
  if (appliances && appliances.length > 0) {
    for (const app of appliances) {
    const isDwPaneled = (app.panelReady || prefs.dwPaneled) && prefs.dwPaneled !== false;
    const isFridgePaneled = (app.panelReady || prefs.fridgePaneled) && prefs.fridgePaneled !== false;
    if (app.type === "dishwasher" && isDwPaneled) {
      const dwWidth = Math.round(app.width || 24);
      accessories.push({
        sku: `DWP-${dwWidth}`,
        width: dwWidth,
        role: "appliance_panel",
        type: "dw_panel",
        appliance: "dishwasher",
      });
    }

    if (app.type === "refrigerator" && isFridgePaneled) {
      const fridgeWidth = Math.round(app.width || 36);
      // French door fridges get 2× half-width panels
      if (app.fridgeDoorStyle === "french") {
        const halfWidth = Math.round(fridgeWidth / 2);
        accessories.push({
          sku: `FDP-${halfWidth}`,
          width: halfWidth,
          qty: 2,
          role: "appliance_panel",
          type: "fridge_panel_overlay",
          appliance: "refrigerator",
          doorStyle: "french",
        });
      } else {
        accessories.push({
          sku: `FDP-${fridgeWidth}`,
          width: fridgeWidth,
          role: "appliance_panel",
          type: "fridge_panel_overlay",
          appliance: "refrigerator",
          doorStyle: app.fridgeDoorStyle || "standard",
        });
      }

      // Freezer drawer panel (FZP) when fridge has a drawer
      if (app.hasDrawer) {
        const fzpWidth = Math.round(app.width || 36);
        accessories.push({
          sku: `FZP-${fzpWidth}`,
          width: fzpWidth,
          role: "appliance_panel",
          type: "freezer_drawer_panel",
          appliance: "refrigerator",
        });
      }

      // Grille panel — covers gap between fridge top and overhead cabinet
      // Per Built-In Refrigerator Design Guide Section 4: ventilation grille required
      const grillePanelWidth = Math.round(app.width || 36);
      accessories.push({
        sku: `GRILLE-${grillePanelWidth}`,
        width: grillePanelWidth,
        role: "grille_panel",
        type: "fridge_grille_panel",
        appliance: "refrigerator",
        note: "Covers gap between fridge top and overhead cabinet — allows ventilation airflow",
      });
    }

    // DW toe kick panel when panel-ready
    if (app.type === "dishwasher" && isDwPaneled) {
      const dwWidth = Math.round(app.width || 24);
      accessories.push({
        sku: `DW-TK-${dwWidth}`,
        width: dwWidth,
        role: "appliance_panel",
        type: "dw_toekick_panel",
        appliance: "dishwasher",
        note: "Matching toe kick panel for panel-ready dishwasher",
      });
    }
    }
  }

  // Applied molding — decorative profile on flat-panel doors
  // Adds raised-panel aesthetic to slab-style cabinets
  const appliedMoldingStyle = prefs.appliedMolding;
  if (appliedMoldingStyle && appliedMoldingStyle !== "none") {
    // Count total doors across all wall cabinets (applied molding is for wall cabs with doors/glass)
    let totalDoors = 0;
    for (const ul of upperLayouts) {
      for (const cab of ul.cabinets) {
        const sku = cab.sku || "";
        // W cabinets with door styles have doors (wall cabinets like W4242, WGT, etc.)
        // Count wall cabinets without special modifiers (glass, display, etc.)
        if (sku.startsWith("W") && !sku.startsWith("WND") && !sku.startsWith("WGT") &&
            !sku.startsWith("WGP") && !sku.startsWith("WPD") && !sku.includes("GLASS")) {
          totalDoors += 1;
        }
      }
    }

    if (totalDoors > 0) {
      // Map style names to SKU abbreviations
      const amStyleMap = { "classic": "CL", "shaker": "SH", "colonial": "CO" };
      const styleAbbr = amStyleMap[appliedMoldingStyle] || appliedMoldingStyle.substring(0, 2).toUpperCase();
      const amSku = `AM-${styleAbbr}`;
      accessories.push({
        sku: amSku,
        qty: totalDoors,
        role: "applied_molding",
        style: appliedMoldingStyle,
        description: "Applied molding profile for door faces",
      });
    }
  }

  // Light rail profile variants
  // If light rail is generated, apply profile suffix to SKU
  const lightRailProfile = prefs.lightRailProfile;
  if (lightRailProfile && lightRailProfile !== "none") {
    // Map style names to SKU abbreviations
    const lrStyleMap = { "standard": "STD", "beveled": "BEV", "cove": "COV", "ogee": "OGE" };
    const lrStyleAbbr = lrStyleMap[lightRailProfile] || lightRailProfile.substring(0, 3).toUpperCase();

    // Check if light rail was already added
    const existingLightRail = accessories.find(a => a.sku && a.sku.startsWith("LR-"));
    if (existingLightRail) {
      // Update SKU to include profile variant
      existingLightRail.sku = `LR-${lrStyleAbbr}-8'`;
    } else if (shouldAddLightRail) {
      // If light rail wasn't added yet but profile is specified, add it now
      const totalUpperLF = upperLayouts.reduce((sum, ul) => {
        const totalWidth = (ul.cabinets || []).reduce((s, c) => s + (c.width || 0), 0);
        return sum + totalWidth;
      }, 0);

      if (totalUpperLF > 0) {
        const lightRailQty = Math.ceil(totalUpperLF / 96);
        accessories.push({
          sku: `LR-${lrStyleAbbr}-8'`,
          qty: lightRailQty,
          role: "accessory",
          subrole: "light-rail",
          linearFeet: totalUpperLF,
        });
      }
    }
  }

  // Base shoe molding — decorative trim at base of cabinets meeting floor
  const baseShoeStyle = prefs.baseShoe;
  if (baseShoeStyle && baseShoeStyle !== "none") {
    if (totalBaseRunLF > 0 && !hasFloatingVanity) {
      // Map style names to SKU abbreviations
      const bsStyleMap = { "quarter_round": "QR", "cove": "COV", "ogee": "OGE" };
      const bsStyleAbbr = bsStyleMap[baseShoeStyle] || baseShoeStyle.substring(0, 2).toUpperCase();
      const bsSku = `BS-${bsStyleAbbr}`;
      // Sold in 8ft lengths (96 inches)
      const baseShoeQty = Math.ceil(totalBaseRunLF / 96);
      accessories.push({
        sku: bsSku,
        qty: baseShoeQty,
        role: "base_shoe",
        style: baseShoeStyle,
        linearFeet: totalBaseRunLF,
      });
    }
  }

  // Counter top mould enhancement — trim at counter edges
  const counterMouldProfile = prefs.counterMouldProfile;
  if (counterMouldProfile && counterMouldProfile !== "none") {
    if (totalBaseRunLF > 0) {
      // Length = total base run + island perimeter (if any)
      let totalCounterLF = totalBaseRunLF;
      if (islandLayout) {
        // Island perimeter = 2 × (length + width)
        const islandPerimeter = 2 * ((islandLayout.length || 0) + (islandLayout.width || 0));
        totalCounterLF += islandPerimeter;
      }

      if (totalCounterLF > 0) {
        // Map style names to SKU abbreviations
        const cmStyleMap = { "standard": "STD", "bullnose": "BN", "ogee": "OGE" };
        const cmStyleAbbr = cmStyleMap[counterMouldProfile] || counterMouldProfile.substring(0, 2).toUpperCase();
        const cmSku = `STP-${cmStyleAbbr}`;
        // Sold in 8ft lengths
        const counterMouldQty = Math.ceil(totalCounterLF / 96);
        accessories.push({
          sku: cmSku,
          qty: counterMouldQty,
          role: "counter_mould",
          style: counterMouldProfile,
          linearFeet: totalCounterLF,
        });
      }
    }
  }

  // ── Gola-specific accessories ──
  if (prefs.golaChannel) {
    // Dishwasher panel — seamless facade (Carolyn's, Willis)
    const hasDW = appliances.some(a => a.type === "dishwasher");
    if (hasDW && prefs._golaDishwasherPanel) {
      accessories.push({
        sku: "DP",
        qty: 1,
        role: "dishwasher-panel",
        note: "Gola dishwasher door panel for seamless handleless facade",
      });
    }

    // Gola-specific end panels (FC-SBEP, FC-DBEP) instead of standard BEP/FBEP
    // Replace any standard BEP end panels already added with FC- variants
    for (const acc of accessories) {
      if (acc.sku && acc.sku.startsWith("FBEP") && acc.role?.includes("base-end-panel")) {
        acc.sku = acc.sku.replace("FBEP", "FC-SBEP");
        acc.note = "Gola sink base end panel (replaces standard FBEP)";
      }
    }

    // FC-TUEP tall utility end panels for oven/pantry towers
    const golaTalls = talls.filter(t => t.sku?.startsWith("FC-"));
    for (const tall of golaTalls) {
      const panelH = tall.height || 96;
      const panelD = tall.depth || 24;
      accessories.push({
        sku: `FC-TUEP3/4 ${panelH}FTK-${panelD}L`,
        role: "gola-tall-end-panel-left",
        wall: tall.wall,
      });
      accessories.push({
        sku: `FC-TUEP3/4 ${panelH}FTK-${panelD}R`,
        role: "gola-tall-end-panel-right",
        wall: tall.wall,
      });
      totalEndPanels += 2;
    }
  }

  // Touch-up kit — always included
  accessories.push({ sku: "TUK-STAIN", qty: 1, role: "touch-up" });

  // Lighting package generation
  const lightingResult = generateLighting(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, prefs);
  if (lightingResult.accessories && lightingResult.accessories.length > 0) {
    accessories.push(...lightingResult.accessories);
  }
  accessories._lighting = lightingResult.metadata;

  // Store metadata for tracking
  accessories._endPanelCount = totalEndPanels;
  accessories._fillerCount = totalFillers;

  return accessories;
}


// ─── PATTERN SELECTION ENGINE ──────────────────────────────────────────────
// Auto-selects the best design pattern from patterns.js based on context

/**
 * Select best range pattern for a range-flanking zone segment.
 * @returns {Object|null} Matched pattern or null
 */
function selectRangePattern(zone, segmentLength, prefs) {
  if (zone !== "rangeFlanking") return null;

  // Normalize sophistication: "transitional" maps to "high" for pattern selection
  // (transitional kitchens are professionally designed with specialty cabinets)
  const rawSoph = prefs.sophistication || "high";
  const soph = rawSoph === "transitional" ? "high" : rawSoph;

  // Very high sophistication: knife insert + heavy-duty (Bollini pattern)
  if (soph === "very_high" && segmentLength >= 18) {
    const p = RANGE_PATTERNS.find(r => r.id === "knife_insert_flank");
    if (p) return p;
  }

  // GOLA channel kitchens get 2-tier drawers
  if (prefs.golaChannel) {
    const p = RANGE_PATTERNS.find(r => r.id === "2tier_drawer_flank");
    if (p) return p;
  }

  // High sophistication: symmetric drawer flank (Imai Robin, Alix)
  if (soph === "very_high" || soph === "high") {
    if (segmentLength >= 30) {
      return RANGE_PATTERNS.find(r => r.id === "symmetric_drawer_flank") || null;
    }
    // Smaller segments: drawer + pullout (Kline Piazza, Gable)
    return RANGE_PATTERNS.find(r => r.id === "drawer_plus_pullout_flank") || null;
  }

  // Standard: roll-out tray flank if enough space (McCarter, Sabelhaus)
  if (segmentLength >= 30) {
    return RANGE_PATTERNS.find(r => r.id === "roll_out_tray_flank") || null;
  }

  // Fallback: simple base flank
  return RANGE_PATTERNS.find(r => r.id === "simple_base_flank") || null;
}

/**
 * Select best sink pattern for a sink-adjacent zone segment.
 * @returns {Object|null} Matched pattern or null
 */
function selectSinkPattern(zone, segmentLength, leftOf, rightOf, prefs) {
  if (zone !== "sinkAdjacent") return null;

  // Normalize sophistication: "transitional" → "high" for pattern selection
  const rawSoph = prefs.sophistication || "high";
  const soph = rawSoph === "transitional" ? "high" : rawSoph;

  // Check if DW is adjacent — the classic sink-DW-waste pattern
  const hasDW = leftOf === "dishwasher" || rightOf === "dishwasher";
  const hasSink = leftOf === "sink" || rightOf === "sink";

  // Very high + farmhouse/apron aesthetic: apron farmhouse sink pattern
  if (soph === "very_high" && prefs.sinkStyle === "apron") {
    return SINK_PATTERNS.find(s => s.id === "sink_apron_farmhouse") || null;
  }

  // Double waste: very_high sophistication + large segment + sink adjacent
  if (soph === "very_high" && (hasSink || hasDW) && segmentLength >= 30 && prefs.sinkStyle === "double_waste") {
    return SINK_PATTERNS.find(s => s.id === "sink_double_waste") || null;
  }

  // Classic sink-DW-waste: segment adjacent to DW gets waste pattern
  // (DW is always adjacent to sink, so hasDW implies sink zone)
  if (hasDW && segmentLength >= 18) {
    return SINK_PATTERNS.find(s => s.id === "sink_dw_waste_drawers") || null;
  }

  // Full-height door flanking for modern minimal (sink-only, no DW adjacent)
  // Only on sink-adjacent segments without a DW, at high+ sophistication
  if (hasSink && !hasDW && (soph === "very_high" || soph === "high")) {
    if (segmentLength >= 30) {
      return SINK_PATTERNS.find(s => s.id === "sink_fhd_flanking") || null;
    }
  }

  // Sink-adjacent without DW at lower soph: organized drawers
  if (hasSink && segmentLength >= 36) {
    return SINK_PATTERNS.find(s => s.id === "sink_dw_waste_drawers") || null;
  }

  // Under-window sinks: minimal uppers pattern
  return SINK_PATTERNS.find(s => s.id === "sink_under_window_minimal_uppers") || null;
}

/**
 * Select best tall pattern for oven/pantry towers.
 * @returns {Object|null} Matched pattern or null
 */
export function selectTallPattern(applianceType, prefs) {
  const soph = prefs.sophistication || "high";

  if (applianceType === "wallOven" || applianceType === "oven") {
    // Very high: flush inset oven tower (JRS, Owen, Kamisar FIO pattern)
    if (soph === "very_high") {
      return TALL_PATTERNS.find(t => t.id === "flush_inset_oven_tower") || null;
    }

    // High: oven + micro stacked (Firebird pattern)
    if (soph === "high") {
      return TALL_PATTERNS.find(t => t.id === "oven_micro_tower") || null;
    }

    // Standard: basic oven tower
    return TALL_PATTERNS.find(t => t.id === "oven_tower") || null;
  }

  if (applianceType === "pantry") {
    // Utility tall with no toe kick for maximum storage (Bennet pattern)
    if (soph === "standard") {
      return TALL_PATTERNS.find(t => t.id === "ntk_utility_tower") || null;
    }

    // Standard pantry
    return TALL_PATTERNS.find(t => t.id === "utility_pantry_tower") || null;
  }

  return null;
}

/**
 * Select best upper pattern for a wall section.
 * @returns {Object|null} Matched pattern or null
 */
export function selectUpperPattern(wallRole, prefs, ceilingHeight) {
  // Normalize: "transitional" → "high" for PRO_DESIGN features
  const rawSoph = prefs.sophistication || "high";
  const soph = rawSoph === "transitional" ? "high" : rawSoph;
  const approach = prefs.upperApproach || "standard";

  if (approach === "floating_shelves") {
    return UPPER_PATTERNS.find(u => u.id === "floating_shelves_instead") || null;
  }
  if (approach === "none") return null;

  // Very high sophistication: stacked glass display walls (Bollini)
  if (soph === "very_high" && ceilingHeight >= 96) {
    return UPPER_PATTERNS.find(u => u.id === "stacked_glass_display_wall") || null;
  }

  // Wall garage pocket doors for great room / bar zones (Bissegger)
  if (wallRole === "greatRoomDisplay" || wallRole === "barEntertaining") {
    return UPPER_PATTERNS.find(u => u.id === "wall_garage_pocket_doors") || null;
  }

  // High sophistication with tall ceilings: stacked uppers (Alix, OC Design)
  if (soph === "high" && ceilingHeight >= 108) {
    return UPPER_PATTERNS.find(u => u.id === "stacked_uppers") || null;
  }

  // Phase 4 enhancement: standard stacked display pairs at 96"+ ceilings
  // Training data: even standard kitchens on 96" ceilings benefit from 15" display + 36" main
  // Triggered when approach is explicitly "stacked" OR when ceiling has room for a 15" tier
  if (approach === "stacked") {
    return UPPER_PATTERNS.find(u => u.id === "stacked_wall_deep") || null;
  }

  // Standard sophistication with tall-ish ceiling (≥102"): add display tier
  // Gives a "display + main" pair (15" glass-front on top + 36" main) for visual impact
  if (ceilingHeight >= 102 && wallRole !== "fridge" && wallRole !== "tall") {
    return UPPER_PATTERNS.find(u => u.id === "stacked_uppers") || null;
  }

  // Default: standard uppers
  return UPPER_PATTERNS.find(u => u.id === "standard_uppers_above_bases") || null;
}

/**
 * Build pattern-aware SKU for individual cabinet in a matched pattern.
 * Allows specialty cabinets (BKI, BPOS, B2HD) to appear in the right positions.
 */
function buildPatternAwareSku(pattern, defaultCabType, width, index, totalCabs, golaPrefix) {
  if (!pattern) return buildSku(defaultCabType, width, golaPrefix);

  // Knife insert flank: first cab nearest range gets BKI-9 if 9" wide
  if (pattern.id === "knife_insert_flank") {
    if (width === 9 && index === totalCabs - 1) {
      return `${golaPrefix}BKI-9`;
    }
    // Alternate positions get heavy-duty or standard drawers
    if (index === 0 && totalCabs > 1) {
      return `${golaPrefix}B2HD${width}`;
    }
  }

  // Drawer + pullout flank: B-RT (roll-out trays) is the pro standard for range flanking
  // Training: Bollini uses B-RT flanking, Spector uses B3D flanking
  if (pattern.id === "drawer_plus_pullout_flank") {
    // Single cabinet in range flanking: B-RT (roll-out tray, pots/pans access near range)
    if (totalCabs === 1) {
      return `${golaPrefix}B${width}-RT`;
    }
    // Narrow specialty: 9" gap gets BKI or BPOS specialty insert
    if (width <= 12 && index === totalCabs - 1) {
      return width === 9 ? `${golaPrefix}BKI-9` : `${golaPrefix}BPOS-${width}`;
    }
    // Multi-cab: alternate B-RT and B3D for variety
    if (index % 2 === 0) {
      return `${golaPrefix}B${width}-RT`;
    }
    return `${golaPrefix}B3D${width}`;
  }

  // Roll-out tray flank: alternate between B-RT and B3D
  if (pattern.id === "roll_out_tray_flank") {
    if (index % 2 === 0) return `${golaPrefix}B${width}-RT`;
    return `${golaPrefix}B3D${width}`;
  }

  // Heavy-duty drawer flank: all get B2HD
  if (pattern.id === "heavy_duty_drawer_flank") {
    return `${golaPrefix}B2HD${width}`;
  }

  // ── Sink zone patterns ──

  // Classic sink-DW-waste: cab nearest sink (last) gets BWDMA waste cab,
  // first position gets B4D (4-drawer for pots/pans), middle gets B3D
  if (pattern.id === "sink_dw_waste_drawers") {
    if (index === totalCabs - 1 && width <= 21) {
      return `${golaPrefix}BWDMA${width}`;
    }
    if (index === 0) {
      return `${golaPrefix}B4D${width}`;
    }
    return `${golaPrefix}B3D${width}`;
  }

  // Full-height door flanking: nearest-to-sink cab gets FHD variant
  if (pattern.id === "sink_fhd_flanking") {
    if (index === totalCabs - 1) {
      return `${golaPrefix}B${width}-FHD`;
    }
    return `${golaPrefix}B3D${width}`;
  }

  // Apron farmhouse: first position gets tray divider (BTD for tilt-out trays),
  // rest get standard drawer bases
  if (pattern.id === "sink_apron_farmhouse") {
    if (index === 0 && width <= 15) {
      return `${golaPrefix}BTD-${width}`;
    }
    return `${golaPrefix}B3D${width}`;
  }

  // Double waste: first position gets BTD-12 tray divider,
  // last position gets BWDMW (wide double waste)
  if (pattern.id === "sink_double_waste") {
    if (index === 0 && width <= 15) {
      return `${golaPrefix}BTD-${width}`;
    }
    if (index === totalCabs - 1 && width >= 18) {
      return `${golaPrefix}BWDMW${width}`;
    }
    return `${golaPrefix}B3D${width}`;
  }

  // Default: use the standard cabinet type
  return buildSku(defaultCabType, width, golaPrefix);
}


// ─── HELPERS ────────────────────────────────────────────────────────────────

function inferLayoutType(walls, hasPeninsula = false, hasIsland = false) {
  if (walls.length === 1 && !hasPeninsula && !hasIsland) return "single-wall";
  if (walls.length === 1 && !hasPeninsula && hasIsland) return "single-wall-island";
  if (walls.length === 1 && hasPeninsula) return "single-wall-peninsula";
  if (walls.length === 2 && !hasPeninsula && !hasIsland) return "l-shape";
  if (walls.length === 2 && hasIsland) return "l-shape"; // L + island
  if (walls.length === 2 && hasPeninsula) return "galley-peninsula";
  if (walls.length === 3) return "u-shape";
  if (walls.length === 4) return "g-shape"; // 4 walls = G-shape (U + partial 4th wall)
  return "l-shape";
}

function inferWallRole(appliances) {
  const types = appliances.map(a => a.type);
  if (types.includes("range") || types.includes("cooktop")) return "range";
  if (types.includes("sink")) return "sink";
  if (types.includes("refrigerator")) return "fridge";
  return "general";
}

function findClosestWidth(target, widths, direction = "down") {
  const sorted = [...widths].sort((a, b) => a - b);
  if (direction === "down") {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] <= target) return sorted[i];
    }
    return sorted[0];
  }
  for (const w of sorted) {
    if (w >= target) return w;
  }
  return sorted[sorted.length - 1];
}


// ─── DRAWER UPGRADE APPLICATION ───────────────────────────────────────────
/**
 * Apply drawer box and slide upgrades to cabinet placements based on preferences.
 *
 * Drawer upgrades include:
 *   - Box type: "standard" | "dovetail" ($25) | "dovetail_walnut" ($45)
 *   - Slide type: "standard" | "soft_close" ($12) | "undermount" ($20) | "undermount_soft_close" ($28)
 *   - Inserts: array of {type, width, charge} for cutlery, peg, spice racks
 *
 * The function:
 *   1. Iterates placements that contain drawers (numDrawers > 0)
 *   2. Adds modifications for selected upgrades with qty = numDrawers
 *   3. Matches inserts to cabinet width where available
 *
 * @param {Array} placements - Solver placements array
 * @param {Object} prefs - Preferences with drawerUpgrades config
 * @returns {Array} Updated placements with drawer upgrade mods
 */
export function applyDrawerUpgrades(placements, prefs = {}) {
  const drawerUpgrades = prefs.drawerUpgrades || {};
  const { boxType, slideType, drawerInserts } = drawerUpgrades;

  // No upgrades if not specified
  if (!boxType && !slideType && (!drawerInserts || drawerInserts.length === 0)) {
    return placements;
  }

  const updated = [];

  for (const placement of placements) {
    const p = { ...placement, modifications: [...(placement.modifications || [])] };

    // Only apply upgrades to drawers (numDrawers > 0)
    const numDrawers = p.numDrawers || 0;
    if (numDrawers > 0) {
      // Box type upgrade
      if (boxType === "dovetail") {
        p.modifications.push({ mod: "DVT", qty: numDrawers });
      } else if (boxType === "dovetail_walnut") {
        p.modifications.push({ mod: "DVT-W", qty: numDrawers });
      }

      // Slide type upgrade
      if (slideType === "soft_close") {
        p.modifications.push({ mod: "SC-DRW", qty: numDrawers });
      } else if (slideType === "undermount") {
        p.modifications.push({ mod: "UM-DRW", qty: numDrawers });
      } else if (slideType === "undermount_soft_close") {
        p.modifications.push({ mod: "UMSC-DRW", qty: numDrawers });
      }

      // Drawer inserts — match by width
      if (drawerInserts && Array.isArray(drawerInserts)) {
        const cabinetWidth = p.width || 0;
        for (const insert of drawerInserts) {
          if (insert.width === cabinetWidth) {
            const modKey = getMappedInsertMod(insert.type);
            if (modKey) {
              p.modifications.push({ mod: modKey, qty: 1 });
            }
          }
        }
      }
    }

    updated.push(p);
  }

  return updated;
}

/**
 * Map insert type to pricing mod key.
 */
function getMappedInsertMod(insertType) {
  const mapping = {
    "cutlery": "WCD",
    "peg": "DPS",
    "spice": "SPR",
  };
  return mapping[insertType] || null;
}


// ─── TWO-TONE MATERIAL RESOLUTION ──────────────────────────────────────────
/**
 * Assign material zones and resolve two-tone material configurations.
 *
 * Each placement gets a materialZone derived from its type/role/wall.
 * Then, based on the twoTone config in prefs, materials are assigned:
 *   - base_upper_split: all base/island cabs get baseMaterial, uppers get upperMaterial
 *   - island_contrast: island cabs get islandMaterial, rest get perimeterMaterial
 *   - zone_specific: each zone gets its assigned material from zones object
 *   - (no twoTone): all cabs get the default material
 *
 * Returns updated placements array with material property set on each.
 * Also updates metadata with materials info.
 */
export function resolveTwoTone(placements, prefs = {}) {
  const updated = [];
  const zoneMap = {};

  // First pass: assign zones to all placements
  for (const p of placements) {
    let zone = determineZone(p);
    const pWithZone = { ...p, materialZone: zone };
    updated.push(pWithZone);

    if (!zoneMap[zone]) zoneMap[zone] = [];
    zoneMap[zone].push(pWithZone);
  }

  // Second pass: assign materials based on twoTone config
  const twoTone = prefs.twoTone || null;
  const defaultMaterial = prefs.material || "Maple";

  if (!twoTone) {
    // Single material mode: all cabs get the same material
    for (const p of updated) {
      p.material = defaultMaterial;
    }
    return updated;
  }

  const mode = twoTone.mode || "base_upper_split";

  if (mode === "base_upper_split") {
    const baseMat = twoTone.baseMaterial || "Maple";
    const upperMat = twoTone.upperMaterial || "Polar Paint";
    for (const p of updated) {
      // Base, island, peninsula, accessory → baseMaterial
      // Upper, tall → upperMaterial
      if (["base", "island", "peninsula", "accessory"].includes(p.materialZone)) {
        p.material = baseMat;
      } else {
        p.material = upperMat;
      }
    }
  } else if (mode === "island_contrast") {
    const perimeterMat = twoTone.perimeterMaterial || "Maple";
    const islandMat = twoTone.islandMaterial || "Rustic Hickory";
    for (const p of updated) {
      p.material = (p.materialZone === "island") ? islandMat : perimeterMat;
    }
  } else if (mode === "zone_specific") {
    const zones = twoTone.zones || {};
    for (const p of updated) {
      p.material = zones[p.materialZone] || zones["base"] || defaultMaterial;
    }
  } else {
    // Unknown mode, fall back to default material
    for (const p of updated) {
      p.material = defaultMaterial;
    }
  }

  return updated;
}

/**
 * Build materials metadata from placements and preferences.
 */
function buildMaterialsMetadata(placements, prefs) {
  const twoTone = prefs.twoTone || null;
  const zones = {};
  const mode = twoTone ? (twoTone.mode || "base_upper_split") : "single";

  // Aggregate materials by zone
  for (const p of placements) {
    const zone = p.materialZone || "base";
    const material = p.material || prefs.material || "Maple";
    if (!zones[zone]) {
      zones[zone] = { material, count: 0 };
    }
    zones[zone].count++;
  }

  return {
    mode,
    zones,
  };
}

/**
 * Determine the material zone for a placement based on type, role, and wall.
 * Returns one of: "base", "upper", "island", "peninsula", "tall", "accessory"
 */
function determineZone(placement) {
  const { type, role, wall } = placement;

  // Accessory zone
  if (role === "accessory" || role === "toe-kick" || role === "sub-rail" ||
      role === "touch-up" || (role && role.includes("end-panel"))) {
    return "accessory";
  }

  // Island zone (any placement on island-* wall)
  if (wall && wall.startsWith("island")) {
    return "island";
  }

  // Peninsula zone
  if (wall === "peninsula" || (role && role.includes("peninsula"))) {
    return "peninsula";
  }

  // Tall zone (oven towers, pantry towers, refrigerator walls)
  if (type === "tall" || role === "tall" || role === "fridge_panel" ||
      role === "fridge_wall_cab" || (role && role.includes("tower"))) {
    return "tall";
  }

  // Upper zone
  if (type === "upper" || (role && role.includes("upper"))) {
    return "upper";
  }

  // Base zone (default for regular cabinets, corners, etc.)
  return "base";
}

/**
 * Assign hinge sides to single-door cabinets based on nearest appliance.
 * Door opens TOWARD the nearest appliance (sink, range, dishwasher).
 * At corners: opens AWAY. At wall ends: opens toward center.
 * Called after all cabinets are placed on each wall.
 */
function assignHingeSides(wallLayouts, upperLayouts) {
  for (const wl of wallLayouts) {
    const cabs = wl.cabinets || [];
    const appliances = cabs.filter(c =>
      c.type === 'appliance' || c.role === 'sink' || c.role === 'range' ||
      c.role === 'dishwasher' || c.role === 'refrigerator'
    );

    for (const cab of cabs) {
      if (cab.type === 'appliance' || cab.type === 'filler' || cab.type === 'end_panel') continue;
      if (/^F\d|^OVF/.test((cab.sku || '').toUpperCase())) continue;
      if ((cab.width || 0) > 24) continue; // double-door, no hinge
      const s = (cab.sku || '').toUpperCase();
      if (/^B[34]D|^RTB|^BPOS|^BBC|^BL|^DSB/.test(s)) continue; // no hinge needed
      if (cab.hingeSide) continue; // already set

      const cabCenter = (cab.position || 0) + (cab.width || 0) / 2;

      if (appliances.length > 0) {
        let nearest = appliances[0], nearestDist = Infinity;
        for (const app of appliances) {
          const appCenter = (app.position || 0) + (app.width || 0) / 2;
          const dist = Math.abs(cabCenter - appCenter);
          if (dist < nearestDist) { nearestDist = dist; nearest = app; }
        }
        const appCenter = (nearest.position || 0) + (nearest.width || 0) / 2;
        cab.hingeSide = cabCenter < appCenter ? 'R' : 'L';
      } else {
        const wallCenter = Math.max(...cabs.map(c => (c.position || 0) + (c.width || 0))) / 2;
        cab.hingeSide = cabCenter < wallCenter ? 'R' : 'L';
      }

      // Append hinge to SKU if not already present
      if (cab.sku && !cab.sku.match(/[LR]$/) && cab.type !== 'filler' && !/^F\d|^OVF/i.test(cab.sku)) {
        cab.sku = cab.sku + cab.hingeSide;
      }
    }
  }

  // Also assign hinge sides to upper cabinets
  for (const ul of upperLayouts) {
    const cabs = ul.cabinets || [];
    for (const cab of cabs) {
      if ((cab.width || 0) > 24) continue;
      if (cab.type === 'rangeHood' || cab.role === 'range_hood') continue;
      if (cab.hingeSide) continue;
      const s = (cab.sku || '').toUpperCase();
      if (/^WBC|^WSC|^RW/.test(s)) continue;

      // Simple center-of-wall logic for uppers
      const wallCenter = Math.max(...cabs.map(c => (c.position || 0) + (c.width || 0)), 0) / 2;
      const cabCenter = (cab.position || 0) + (cab.width || 0) / 2;
      cab.hingeSide = cabCenter < wallCenter ? 'R' : 'L';

      if (cab.sku && !cab.sku.match(/[LR]$/)) {
        cab.sku = cab.sku + cab.hingeSide;
      }
    }
  }
}

function compilePlacements(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, accessories, talls = [], upperCorners = []) {
  const placements = [];

  // Corner cabs — position is at the END of each wall's usable space
  for (const corner of corners) {
    // Corner position = wallA length minus corner consumption
    const wallALayout = wallLayouts.find(wl => wl.wallId === corner.wallA);
    const cornerPos = wallALayout ? wallALayout.wallLength - corner.size : 0;
    placements.push({
      sku: corner.sku,
      type: "corner",
      role: "corner",
      wall: `${corner.wallA}-${corner.wallB}`,
      width: corner.size,
      position: cornerPos,
    });
  }

  // Wall base cabs — include ALL items: cabinets AND appliances (range, sink, dishwasher, fridge)
  for (const wl of wallLayouts) {
    for (const cab of wl.cabinets) {
      placements.push({ ...cab, wall: wl.wallId });
    }
  }

  // Upper cabs
  for (const ul of upperLayouts) {
    for (const cab of ul.cabinets) {
      placements.push({ ...cab, wall: ul.wallId });
    }
  }

  // Upper corner cabinets (WSC pairs)
  for (const uc of upperCorners) {
    placements.push({ ...uc });
  }

  // Tall cabinets (oven towers, pantry towers)
  for (const tall of talls) {
    placements.push({ ...tall });
  }

  // Island cabs — include ALL items including appliances (range, sink, dishwasher on island)
  if (islandLayout) {
    for (const cab of islandLayout.workSide) {
      placements.push({ ...cab, wall: "island-work" });
    }
    for (const cab of islandLayout.backSide) {
      placements.push({ ...cab, wall: "island-back" });
    }
    for (const panel of islandLayout.endPanels) {
      placements.push({ ...panel, wall: "island-end" });
    }
  }

  // Peninsula components (columns, shelf, end panels already in accessories if present)
  // No separate peninsula placements needed — they come through accessories

  // Accessories
  for (const acc of accessories) {
    placements.push({ ...acc, role: acc.role || "accessory" });
  }

  // ── Z-AXIS DATA LAYER ──────────────────────────────────────────────────
  // Attach 3D spatial data to every placement: height, depth, vertical
  // mounting position (yMount), and zone classification.
  // This gives the renderer and elevation generator full 3D context
  // without needing a separate 3D engine.
  for (const p of placements) {
    assignSpatialData(p);
  }

  return placements;
}

/**
 * Assign 3D spatial data to a placement object.
 * Every SKU gets: _elev (elevation data) with yMount, height, depth, zone.
 *
 * Mounting positions (yMount = bottom of cabinet from floor):
 *   Base:  4.5" (above toe kick)
 *   Upper: 54"  (standard NKBA upper bottom)
 *   Tall:  0"   (floor to 84-96")
 *   Corner: varies (base or full height)
 *
 * @param {Object} p - Placement object (mutated in place)
 */

/**
 * Assign _elev 3D data to the SOURCE cabinet objects (not placement copies).
 * This is what the renderer actually reads for vertical positioning.
 *
 * Context-aware: understands that RW above fridge mounts at fridge-top (84"),
 * hood mounts above range at 60"+ AFF (24"+ above cooking surface per Range Hood Design Guide), etc.
 */
function assignElevToSourceObjects(wallLayouts, upperLayouts, talls, appliances, corners) {
  // Build fridge lookup: wallId → fridge appliance
  const fridgeByWall = {};
  for (const app of appliances) {
    if (app.type === 'refrigerator' || app.type === 'freezer') {
      fridgeByWall[app.wall] = app;
    }
  }

  // Build range lookup: wallId → range appliance
  const rangeByWall = {};
  for (const app of appliances) {
    if (app.type === 'range' || app.type === 'cooktop') {
      rangeByWall[app.wall] = app;
    }
  }

  // Tag wall base cabinets
  for (const wl of wallLayouts) {
    for (const cab of wl.cabinets) {
      if (cab._elev) continue;
      const sku = (cab.sku || '').toUpperCase();

      if (cab.type === 'appliance') {
        const appType = (cab.applianceType || '').toLowerCase();
        if (appType === 'refrigerator' || appType === 'freezer' || appType === 'winecolumn') {
          cab._elev = { zone: 'TALL', yMount: 0, height: 84, depth: DEPTH_TIERS.FRIDGE_STANDARD, depthSetback: 0 };
        } else if (appType === 'range' || appType === 'cooktop') {
          cab._elev = { zone: 'BASE', yMount: 0, height: DIMS.counterHeight, depth: DEPTH_TIERS.RANGE_STANDARD, depthSetback: 0 };
        } else if (appType === 'hood') {
          // RANGE HOOD DESIGN GUIDE: 24-30" above cooking surface → 60-66" AFF
          const hoodAFF = cab._hoodMountAFF || 60;
          cab._elev = { zone: 'UPPER', yMount: hoodAFF, height: 24, depth: 0, depthSetback: DEPTH_TIERS.BASE_FRONT };
        } else if (appType === 'dishwasher') {
          cab._elev = { zone: 'BASE', yMount: VERTICAL_ZONES.TOE_KICK.yMax, height: DIMS.baseHeight, depth: DEPTH_TIERS.DISHWASHER, depthSetback: 0 };
        } else if (appType === 'sink') {
          cab._elev = { zone: 'BASE', yMount: VERTICAL_ZONES.TOE_KICK.yMax, height: DIMS.baseHeight, depth: DEPTH_TIERS.BASE_FRONT, depthSetback: 0 };
        } else {
          cab._elev = { zone: 'BASE', yMount: VERTICAL_ZONES.TOE_KICK.yMax, height: DIMS.baseHeight, depth: DEPTH_TIERS.BASE_FRONT, depthSetback: 0 };
        }
      } else {
        // Regular base cabinet
        cab._elev = {
          zone: 'BASE',
          yMount: VERTICAL_ZONES.TOE_KICK.yMax,  // 4.5"
          height: DIMS.baseHeight,                 // 30"
          depth: DEPTH_TIERS.BASE_FRONT,           // 24"
          depthSetback: 0,
        };
      }
      cab._elev.yTop = cab._elev.yMount + cab._elev.height;
    }
  }

  // Tag upper cabinets — CONTEXT-AWARE for items above fridge
  for (const ul of upperLayouts) {
    const fridge = fridgeByWall[ul.wallId];
    const range = rangeByWall[ul.wallId];

    for (const cab of ul.cabinets) {
      if (cab._elev) continue;
      const sku = (cab.sku || '').toUpperCase();
      const role = cab.role || cab.type || '';

      // Is this cabinet positioned above the fridge?
      const isFridgeWallCab = sku.startsWith('RW') || role === 'refrigerator_wall' || cab._isFridgeUpper;
      const isAboveFridge = isFridgeWallCab && fridge;

      // Is this a hood?
      const isHood = role === 'rangeHood' || role === 'hood' || (cab.applianceType === 'hood');

      if (isAboveFridge) {
        // RW cabs mount directly on top of the fridge at 84"
        const fridgeTop = 84;
        // Extract height from SKU (e.g., RW3612-27 → 12, RW3621-27 → 21)
        const rwMatch = (cab.sku || '').match(/RW\d+(\d{2})/);
        const cabH = cab._rwHeight || cab.height || (rwMatch ? parseInt(rwMatch[1]) : 12);
        cab._elev = {
          zone: 'ABOVE_TALL',
          yMount: fridgeTop,              // 84" — sits on fridge
          height: cabH,
          depth: 27,                       // 27" deep to match fridge
          depthSetback: 0,
        };
      } else if (isHood) {
        // RANGE HOOD DESIGN GUIDE: Hood mounts 24-30" above cooking surface (36" AFF)
        // Standard: 60" AFF (24" clearance), Pro: 66" AFF (30" clearance)
        // Use _hoodMountAFF from solver if available, otherwise default to 60" (standard)
        // Chimney extends from hood body top to upper cabinet top line (typically 93" AFF)
        const hoodMountAFF = cab._hoodMountAFF || 60;
        const hoodH = cab.height || 24;
        cab._elev = {
          zone: 'UPPER',
          yMount: hoodMountAFF,  // 60" standard, 66" pro (NOT 54")
          height: hoodH,
          depth: 0,
          chimneyHeight: cab._chimneyHeight || 0,
          chimneyWidth: cab._chimneyWidth || 8,
          chimneyTopAFF: cab._chimneyTopAFF || (hoodMountAFF + hoodH),
          depthSetback: DEPTH_TIERS.BASE_FRONT,
        };
      } else {
        // Standard upper — mounts at 54" AFF
        const upperH = cab.height || 30;
        const isSW = sku.startsWith('SW');
        cab._elev = {
          zone: isSW ? 'TALL' : 'UPPER',
          yMount: isSW ? VERTICAL_ZONES.TOE_KICK.yMax : VERTICAL_ZONES.UPPER.yMin,  // SW at 4.5", standard at 54"
          height: upperH,
          depth: sku.startsWith('RW') ? 27 : DEPTH_TIERS.UPPER_FRONT,
          depthSetback: sku.startsWith('RW') ? 0 : (DEPTH_TIERS.BASE_FRONT - DEPTH_TIERS.UPPER_FRONT),
        };
      }
      cab._elev.yTop = cab._elev.yMount + cab._elev.height;
    }
  }

  // Tag tall cabinets
  for (const tall of talls) {
    if (tall._elev) continue;
    const sku = (tall.sku || '').toUpperCase();

    if (sku.startsWith('RW')) {
      // RW in talls array → above fridge
      const cabH = tall.height || 21;
      tall._elev = {
        zone: 'ABOVE_TALL',
        yMount: 84,
        height: cabH,
        depth: 27,
        depthSetback: 0,
      };
    } else if (sku.includes('REP') || sku.includes('PANEL') || tall.role === 'fridge_panel') {
      // Fridge end panel — full height (floor to ceiling-ish)
      const panelH = tall.height || 93;
      tall._elev = {
        zone: 'TALL',
        yMount: 0,
        height: panelH,
        depth: 27,
        depthSetback: 0,
      };
    } else {
      // Standard tall (pantry tower, oven tower)
      const tallH = tall.height || 84;
      tall._elev = {
        zone: 'TALL',
        yMount: 0,
        height: tallH,
        depth: DEPTH_TIERS.BASE_FRONT,
        depthSetback: 0,
      };
    }
    tall._elev.yTop = tall._elev.yMount + tall._elev.height;
  }

  // Tag corner cabinets
  for (const corner of corners) {
    if (corner._elev) continue;
    corner._elev = {
      zone: 'BASE',
      yMount: VERTICAL_ZONES.TOE_KICK.yMax,
      height: DIMS.baseHeight,
      depth: DEPTH_TIERS.BASE_FRONT,
      depthSetback: 0,
    };
    corner._elev.yTop = corner._elev.yMount + corner._elev.height;
  }
}

function assignSpatialData(p) {
  const type = p.type || p.role || '';
  const sku = (p.sku || '').toUpperCase();

  // Default elevation data
  if (!p._elev) p._elev = {};

  // ── Determine category from type/SKU ──
  if (type === 'upper' || type === 'wall' || sku.startsWith('W') || sku.startsWith('WSC') || sku.startsWith('RW')) {
    // Upper / wall cabinets
    const isRW = sku.startsWith('RW');
    const isSW = sku.startsWith('SW');
    p._elev.zone = 'UPPER';
    p._elev.yMount = isSW ? 4 : VERTICAL_ZONES.UPPER.yMin;  // SW starts at base height (4"), standard uppers at 54"
    p._elev.height = p.height || (isSW ? 63 : (isRW ? 21 : 30));
    p._elev.depth = isRW ? 27 : DEPTH_TIERS.UPPER_FRONT;       // RW = 27" deep, standard upper = 13"
    p._elev.depthSetback = isRW ? 0 : (DEPTH_TIERS.BASE_FRONT - DEPTH_TIERS.UPPER_FRONT); // 11" for standard uppers

  } else if (type === 'tall' || type === 'tall_cabinet' || sku.startsWith('UT') || sku.startsWith('PT')) {
    // Tall cabinets (pantry, utility, oven tower)
    p._elev.zone = 'TALL';
    p._elev.yMount = 0;
    p._elev.height = p.height || 84;
    p._elev.depth = DEPTH_TIERS.BASE_FRONT;  // 24"
    p._elev.depthSetback = 0;

  } else if (type === 'corner') {
    // Corner cabinets span base zone
    p._elev.zone = 'BASE';
    p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;  // 4.5"
    p._elev.height = DIMS.baseHeight;                 // 30"
    p._elev.depth = DEPTH_TIERS.BASE_FRONT;
    p._elev.depthSetback = 0;

  } else if (type === 'appliance') {
    // Appliance — depth and height vary by type
    const appType = (p.applianceType || '').toLowerCase();
    if (appType === 'refrigerator' || appType === 'freezer' || appType === 'winecolumn') {
      p._elev.zone = 'TALL';
      p._elev.yMount = 0;
      p._elev.height = 84;
      p._elev.depth = appType === 'refrigerator' ? DEPTH_TIERS.FRIDGE_STANDARD : DEPTH_TIERS.BASE_FRONT;
      p._elev.depthSetback = 0;
      p._elev.depthOverhang = Math.max(0, p._elev.depth - DEPTH_TIERS.BASE_FRONT); // fridge protrudes 3"
    } else if (appType === 'range' || appType === 'cooktop') {
      p._elev.zone = 'BASE';
      p._elev.yMount = 0;
      p._elev.height = DIMS.counterHeight;  // 36" to counter
      p._elev.depth = DEPTH_TIERS.RANGE_STANDARD;
      p._elev.depthSetback = 0;
    } else if (appType === 'hood') {
      // RANGE HOOD DESIGN GUIDE: 60" AFF standard, 66" pro
      p._elev.zone = 'UPPER';
      p._elev.yMount = p._hoodMountAFF || 60;  // 60" standard (24" above cooking surface)
      p._elev.height = p.height || 24;
      p._elev.depth = 0;  // wall-mounted
      p._elev.depthSetback = DEPTH_TIERS.BASE_FRONT;
    } else if (appType === 'dishwasher') {
      p._elev.zone = 'BASE';
      p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;
      p._elev.height = DIMS.baseHeight;
      p._elev.depth = DEPTH_TIERS.DISHWASHER;
      p._elev.depthSetback = 0;
    } else {
      // Generic appliance
      p._elev.zone = 'BASE';
      p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;
      p._elev.height = DIMS.baseHeight;
      p._elev.depth = DEPTH_TIERS.BASE_FRONT;
      p._elev.depthSetback = 0;
    }

  } else if (type === 'base' || type === 'sink-base' || type === 'sink_base' || sku.startsWith('B') || sku.startsWith('SB')) {
    // Base cabinets
    p._elev.zone = 'BASE';
    p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;  // 4.5"
    p._elev.height = p.height || DIMS.baseHeight;     // 30"
    p._elev.depth = DEPTH_TIERS.BASE_FRONT;           // 24"
    p._elev.depthSetback = 0;

  } else if (type === 'accessory' || p.role === 'accessory') {
    // Accessories (fillers, panels, trim) — context-dependent
    if (sku.includes('FWEP') || sku.includes('FEP')) {
      p._elev.zone = 'UPPER';
      p._elev.yMount = VERTICAL_ZONES.UPPER.yMin;
      p._elev.height = p.height || 30;
      p._elev.depth = DEPTH_TIERS.UPPER_FRONT;
      p._elev.depthSetback = DEPTH_TIERS.BASE_FRONT - DEPTH_TIERS.UPPER_FRONT;
    } else if (sku.includes('FBEP') || sku.includes('BEP')) {
      p._elev.zone = 'BASE';
      p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;
      p._elev.height = DIMS.baseHeight;
      p._elev.depth = DEPTH_TIERS.BASE_FRONT;
      p._elev.depthSetback = 0;
    } else {
      p._elev.zone = 'BASE';
      p._elev.yMount = 0;
      p._elev.height = p.height || 4.5;
      p._elev.depth = 0;
      p._elev.depthSetback = 0;
    }

  } else {
    // Fallback — treat as base
    p._elev.zone = 'BASE';
    p._elev.yMount = VERTICAL_ZONES.TOE_KICK.yMax;
    p._elev.height = p.height || DIMS.baseHeight;
    p._elev.depth = DEPTH_TIERS.BASE_FRONT;
    p._elev.depthSetback = 0;
  }

  // Compute top edge (yMount + height)
  p._elev.yTop = p._elev.yMount + p._elev.height;
}

function buildValidationInput(wallLayouts, islandLayout, appliances, corners, roomType, prefs, accessories = [], talls = []) {
  // Build appliance list with ACTUAL positions and landing clearances
  // from the solved wall layouts — not estimated from cumulative widths.
  const appWithPositions = [];

  for (const wall of wallLayouts) {
    const cabs = wall.cabinets || [];
    const appCabs = cabs.filter(c => c.type === "appliance");
    const baseCabs = cabs.filter(c => c.type !== "appliance" && typeof c.position === "number");

    for (const ac of appCabs) {
      const appEnd = ac.position + ac.width;

      // Left clearance: total width of base cabinets immediately to the left
      let leftClearance = 0;
      const leftCabs = baseCabs
        .filter(c => c.position + c.width <= ac.position)
        .sort((a, b) => b.position - a.position); // nearest first
      for (const lc of leftCabs) {
        if (lc.position + lc.width >= ac.position - leftClearance - 1) {
          leftClearance += lc.width;
        } else break; // gap — stop accumulating
      }

      // Right clearance: total width of base cabinets immediately to the right
      let rightClearance = 0;
      const rightCabs = baseCabs
        .filter(c => c.position >= appEnd)
        .sort((a, b) => a.position - b.position); // nearest first
      for (const rc of rightCabs) {
        if (rc.position <= appEnd + rightClearance + 1) {
          rightClearance += rc.width;
        } else break;
      }

      // Check DW-sink distance (NKBA: within 36" of nearest sink edge)
      const isDW = ac.applianceType === "dishwasher";
      let adjacentToSink = false;
      let distFromSink = undefined;
      if (isDW) {
        // Sink may be on same wall or different wall — check all walls
        let sinkCab = appCabs.find(c => c.applianceType === "sink");
        if (!sinkCab) {
          // Check other walls for the sink
          for (const otherWall of wallLayouts) {
            if (otherWall.wallId === wall.wallId) continue;
            sinkCab = (otherWall.cabinets || []).find(c => c.applianceType === "sink");
            if (sinkCab) break;
          }
        }
        if (sinkCab && sinkCab.wall === wall.wallId) {
          // Same wall: measure edge-to-edge distance
          const gap = Math.min(
            Math.abs(ac.position - (sinkCab.position + sinkCab.width)),
            Math.abs(sinkCab.position - (ac.position + ac.width))
          );
          distFromSink = Math.max(0, gap);
          adjacentToSink = distFromSink <= 36; // NKBA: within 36"
        }
      }

      // Find original appliance data
      const origApp = appliances.find(a => a.type === ac.applianceType && a.model === ac.model) || {};

      // Compute 2D coordinates for work triangle calculation.
      // Wall A runs along x-axis (y=0), wall B runs along y-axis (x=wallA.length)
      // for L-shape layouts.  For single-wall, everything is on x-axis.
      const wallIdx = wallLayouts.findIndex(w => w.wallId === wall.wallId);
      const appCenter = ac.position + ac.width / 2;
      let x2d, y2d;
      if (wallIdx === 0) {
        // First wall: along x-axis
        x2d = appCenter;
        y2d = 0;
      } else {
        // Second wall (L-shape): along y-axis from the junction
        const wallALen = wallLayouts[0]?.wallLength || 0;
        x2d = wallALen;
        y2d = appCenter;
      }

      appWithPositions.push({
        ...origApp,
        type: ac.applianceType,
        model: ac.model,
        wall: wall.wallId,
        width: ac.width,
        x: x2d,
        y: y2d,
        position: ac.position,
        leftClearance,
        rightClearance,
        handleSideClearance: Math.max(leftClearance, rightClearance),
        adjacentToSink,
        distFromSink,
      });
    }
  }

  return {
    walls: wallLayouts,
    island: islandLayout,
    roomType: roomType || "kitchen",
    appliances: appWithPositions,
    corners: corners.map(c => ({
      ...c,
      wallALength: wallLayouts.find(w => w.wallId === c.wallA)?.wallLength || 0,
      wallBLength: wallLayouts.find(w => w.wallId === c.wallB)?.wallLength || 0,
    })),
    prefs: prefs || {},
    accessories: accessories || [],
    talls: talls || [],
    counterHeight: 36,
    upperCabBottomHeight: 54,
    walkwayClearance: 36,
    toeKickHeight: 4.5,
  };
}


// ─── AESTHETIC SCORING (Phase 3) ──────────────────────────────────────────────
// Scores a completed layout on three aesthetic dimensions (0-100 each):
//   1. Symmetry — are flanking cabinets equal around focal points (range, sink)?
//   2. Consistency — do cabinet types and widths follow coherent patterns?
//   3. Proportionality — do uppers relate well to bases? Widths proportional?
// Combined into a single 0-100 aestheticScore in the layout metadata.

export function scoreAesthetics(wallLayouts, upperLayouts, corners, prefs) {
  const scores = { symmetry: 0, consistency: 0, proportionality: 0 };
  let wallCount = 0;

  // ── 1. BALANCE ──
  // Design principle (Shea McGee): "You don't need perfect symmetry. You need
  // beautiful balance."  Score visual WEIGHT balance around focal points (range,
  // sink) rather than requiring mirror-image widths.  Compute the total width
  // (visual mass) on each side of each focal appliance, and reward when the
  // left-right mass ratio is close to 1:1.
  let balancePoints = 0;
  let balanceChecks = 0;

  for (const wl of wallLayouts) {
    const baseCabs = (wl.cabinets || []).filter(c => c.type === "base" && typeof c.position === "number");
    const applianceCabs = (wl.cabinets || []).filter(c => c.type === "appliance");

    for (const app of applianceCabs) {
      const appPos = app.position || 0;
      const appEnd = appPos + (app.width || 0);
      const leftTotal = baseCabs
        .filter(c => c.position + c.width <= appPos)
        .reduce((s, c) => s + c.width, 0);
      const rightTotal = baseCabs
        .filter(c => c.position >= appEnd)
        .reduce((s, c) => s + c.width, 0);

      if (leftTotal > 0 || rightTotal > 0) {
        balanceChecks++;
        const larger = Math.max(leftTotal, rightTotal);
        const smaller = Math.min(leftTotal, rightTotal);
        const ratio = larger > 0 ? smaller / larger : 0;
        // ratio 1.0 = perfect balance, 0.0 = completely one-sided
        // Beautiful balance: anything above 0.4 is acceptable, 0.7+ is great
        if (ratio >= 0.85) balancePoints += 100;       // near-perfect balance
        else if (ratio >= 0.6) balancePoints += 85;     // beautiful balance
        else if (ratio >= 0.4) balancePoints += 65;     // acceptable asymmetry
        else if (ratio >= 0.2) balancePoints += 40;     // noticeable imbalance
        else balancePoints += 15;                        // very one-sided
      }
    }
  }
  scores.symmetry = balanceChecks > 0 ? Math.round(balancePoints / balanceChecks) : 80;

  // ── 2. CONSISTENCY ──
  // Check if all bases on a wall use the same cabinet type family
  let consistencyPoints = 0;

  for (const wl of wallLayouts) {
    wallCount++;
    const baseCabs = (wl.cabinets || []).filter(c => c.type === "base" && c.sku);
    if (baseCabs.length === 0) { consistencyPoints += 80; continue; }

    // Extract cabinet type families (B3D, B4D, B, BPOS, etc.)
    const families = baseCabs.map(c => (c.sku || '').replace(/\d+.*$/, ''));
    const uniqueFamilies = [...new Set(families)];

    // Fewer unique families = more consistent
    if (uniqueFamilies.length <= 2) consistencyPoints += 100;
    else if (uniqueFamilies.length <= 3) consistencyPoints += 75;
    else if (uniqueFamilies.length <= 4) consistencyPoints += 50;
    else consistencyPoints += 25;
  }
  scores.consistency = wallCount > 0 ? Math.round(consistencyPoints / wallCount) : 75;

  // ── 3. PROPORTIONALITY ──
  // Check upper-to-base width ratios against training data norms
  // Training avg ratio: 0.63 with gap, 0.60 without (UPPER_SIZING_RULES)
  let propPoints = 0;
  let propChecks = 0;

  for (let i = 0; i < wallLayouts.length && i < upperLayouts.length; i++) {
    const baseCabs = (wallLayouts[i].cabinets || []).filter(c => c.type === "base");
    const upperCabs = (upperLayouts[i].cabinets || []).filter(c => c.sku);

    if (baseCabs.length === 0 || upperCabs.length === 0) continue;
    propChecks++;

    const totalBaseW = baseCabs.reduce((s, c) => s + (c.width || 0), 0);
    const totalUpperW = upperCabs.reduce((s, c) => s + (c.width || 0), 0);
    const ratio = totalUpperW / totalBaseW;

    // Ideal range from training: 0.45 - 1.0
    // Best: 0.55 - 0.75 (near training average)
    if (ratio >= 0.55 && ratio <= 0.75) propPoints += 100;
    else if (ratio >= 0.45 && ratio <= 1.0) propPoints += 75;
    else if (ratio >= 0.30 && ratio <= 1.2) propPoints += 50;
    else propPoints += 20;
  }
  scores.proportionality = propChecks > 0 ? Math.round(propPoints / propChecks) : 70;

  // Combined score (weighted: symmetry 40%, proportionality 35%, consistency 25%)
  const combined = Math.round(
    scores.symmetry * 0.40 +
    scores.proportionality * 0.35 +
    scores.consistency * 0.25
  );

  return {
    overall: combined,
    symmetry: scores.symmetry,
    consistency: scores.consistency,
    proportionality: scores.proportionality,
  };
}


// ─── TRAINING DATA PATTERN SCORING ──────────────────────────────────────────
// Scores a generated layout against real training project patterns.
// Identifies the closest matching training project and confidence score.

/**
 * Score a generated layout against training data design patterns.
 * Returns the top 3 closest matching training project profiles and an overall
 * confidence score (0-100) that the generated layout follows proven patterns.
 *
 * @param {Object} layoutResult - Output from solve()
 * @returns {Object} { confidence, matches, patterns, golaCompliance }
 */
export function scoreAgainstTraining(layoutResult) {
  const { layoutType, roomType, placements = [], island, metadata = {}, walls = [] } = layoutResult;
  const prefs = layoutResult._prefs || {};

  const signals = {
    layoutType,
    roomType,
    totalCabs: (metadata.totalCabinets || 0),
    hasIsland: !!island,
    isGola: placements.some(p => p.sku?.startsWith("FC-")),
    hasTwoTone: placements.some(p => p.materialZone && p.materialZone !== "primary"),
    cornerTypes: metadata.cornerTypes || [],
    hasStacked: placements.some(p => p.sku?.startsWith("SW")),
    hasFloatingShelves: placements.some(p => p.sku?.includes("FLS") || p.sku?.includes("SFLS")),
    hasPantryTower: placements.some(p => p.role === "pantry_tower"),
    hasOvenTower: placements.some(p => p.role === "oven_tower"),
    hasB2TD: placements.some(p => p.sku?.includes("B2TD")),
    hasFHDBack: island?.backSide?.some(c => c.sku?.includes("FHD")),
    hasDP: placements.some(p => p.sku === "DP"),
    upperApproach: metadata.aesthetics ? "present" : "none",
  };

  // ── Training project profiles ──
  // Each profile is a simplified fingerprint of a real training project
  const TRAINING_PROFILES = [
    { id: "carolyns", name: "Carolyn's Kitchen", layout: "l-shape", gola: true, twoTone: false, island: false, b2td: true, dp: true, stacked: false, cabs: [15, 25], price: "$33K", sophistication: "high" },
    { id: "oc_design", name: "OC Design", layout: "l-shape", gola: true, twoTone: false, island: true, b2td: true, dp: false, stacked: false, cabs: [20, 35], price: "$6-31K", sophistication: "high" },
    { id: "imai_robin", name: "Imai Robin", layout: "single-wall", gola: false, twoTone: false, island: true, b2td: false, dp: false, stacked: false, cabs: [25, 40], price: "$48-50K", sophistication: "very_high" },
    { id: "alix", name: "Alix", layout: "u-shape", gola: false, twoTone: false, island: true, b2td: false, dp: false, stacked: true, cabs: [30, 50], price: "$35-42K", sophistication: "very_high" },
    { id: "kline_piazza", name: "Kline Piazza", layout: "single-wall", gola: false, twoTone: true, island: true, b2td: false, dp: false, stacked: false, cabs: [20, 35], price: "$27K", sophistication: "high" },
    { id: "gable", name: "Gable", layout: "u-shape", gola: false, twoTone: true, island: false, b2td: false, dp: false, stacked: false, cabs: [25, 45], price: "$29K", sophistication: "high" },
    { id: "firebird", name: "Firebird", layout: "l-shape", gola: false, twoTone: true, island: true, b2td: false, dp: false, stacked: true, cabs: [30, 50], price: "$42K", sophistication: "very_high" },
    { id: "willis", name: "Willis Kitchen", layout: "l-shape", gola: false, twoTone: true, island: true, b2td: true, dp: true, stacked: false, cabs: [15, 30], price: "$15-23K", sophistication: "standard" },
    { id: "bollini", name: "Bollini", layout: "l-shape", gola: false, twoTone: false, island: true, b2td: false, dp: false, stacked: true, cabs: [30, 55], price: "$64K", sophistication: "very_high" },
    { id: "lofton", name: "Lofton", layout: "l-shape", gola: false, twoTone: true, island: false, b2td: false, dp: false, stacked: false, cabs: [10, 20], price: "$19K", sophistication: "standard" },
    { id: "delawyer", name: "DeLawyer", layout: "l-shape", gola: false, twoTone: false, island: false, b2td: false, dp: false, stacked: false, cabs: [8, 18], price: "$19K", sophistication: "standard" },
    { id: "sabelhaus", name: "Sabelhaus West", layout: "l-shape", gola: false, twoTone: false, island: false, b2td: false, dp: false, stacked: false, cabs: [10, 20], price: "$14K", sophistication: "standard" },
    { id: "mccarter_parade", name: "McCarter Parade", layout: "u-shape", gola: false, twoTone: false, island: true, b2td: false, dp: false, stacked: true, cabs: [25, 45], price: "$26K", sophistication: "high" },
    { id: "levensohn", name: "Levensohn", layout: "l-shape", gola: false, twoTone: true, island: true, b2td: false, dp: false, stacked: false, cabs: [25, 45], price: "$67K", sophistication: "very_high" },
  ];

  // ── Score each profile ──
  const scored = TRAINING_PROFILES.map(profile => {
    let score = 0;
    let maxScore = 0;

    // Layout type match (weight: 20)
    maxScore += 20;
    if (signals.layoutType === profile.layout) score += 20;
    else if (signals.layoutType?.includes("l-") && profile.layout?.includes("l-")) score += 15;

    // Gola match (weight: 25 — very distinctive)
    maxScore += 25;
    if (signals.isGola === profile.gola) score += 25;

    // Island match (weight: 15)
    maxScore += 15;
    if (signals.hasIsland === profile.island) score += 15;

    // Two-tone match (weight: 10)
    maxScore += 10;
    if (signals.hasTwoTone === profile.twoTone) score += 10;

    // B2TD usage (weight: 10)
    maxScore += 10;
    if (signals.hasB2TD === profile.b2td) score += 10;

    // DP usage (weight: 5)
    maxScore += 5;
    if (signals.hasDP === profile.dp) score += 5;

    // Stacked cabs match (weight: 10)
    maxScore += 10;
    if (signals.hasStacked === profile.stacked) score += 10;

    // Cabinet count range (weight: 5)
    maxScore += 5;
    if (signals.totalCabs >= profile.cabs[0] && signals.totalCabs <= profile.cabs[1]) score += 5;

    const pct = Math.round((score / maxScore) * 100);
    return { ...profile, score: pct };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  const confidence = top3[0]?.score || 0;

  // ── Gola compliance check ──
  let golaCompliance = null;
  if (signals.isGola) {
    const issues = [];
    if (!signals.hasB2TD) issues.push("Missing B2TD — Gola kitchens should use 60-80% 2-tiered drawers");
    if (!signals.hasDP) issues.push("Missing DP — Gola kitchens need dishwasher door panel");
    const hasUppers = placements.some(p => p.type === "upper" && !p.sku?.includes("RW"));
    if (hasUppers) issues.push("Has wall cabinets — Gola kitchens prefer no wall cabs (open backsplash)");
    const hasCrown = placements.some(p => p.role?.includes("crown"));
    if (hasCrown) issues.push("Has crown moulding — Gola kitchens use no traditional mouldings");

    golaCompliance = {
      compliant: issues.length === 0,
      issues,
      score: Math.max(0, 100 - issues.length * 25),
    };
  }

  // ── Pattern usage report ──
  const usedPatterns = placements
    .filter(p => p.patternId)
    .map(p => p.patternId);
  const uniquePatterns = [...new Set(usedPatterns)];

  return {
    confidence,
    closestMatch: top3[0]?.name || "Unknown",
    bestMatch: top3[0]?.name || "Unknown",
    matches: top3.map(m => ({ name: m.name, id: m.id, score: m.score, priceRange: m.price })),
    patternsUsed: uniquePatterns,
    golaCompliance,
    totalSignals: Object.keys(signals).length,
  };
}


// ─── PHASE 4.5: COMPARISON QUOTE GENERATION ─────────────────────────────────
// Auto-generates 3 material variant options for the same layout.
// Training data: Willis Kitchen (Paint+Stain $23K vs TFL $15K vs Oak $21K),
// Alix (3 variants $26K-$42K), Diehl Laundry (Maple/Cherry/Alder variants).
//
// Takes a solved layout and a pricing function, returns the layout priced at
// 3 material tiers: Budget (TFL), Mid (Maple), Premium (configurable).
//
// @param {Object} layoutResult - Output from solve()
// @param {Function} priceFn - (placements, config) => { subtotal, items }
// @param {Object} [options] - Optional overrides for variant materials
// @returns {Object} { variants: [{name, species, construction, door, subtotal, itemCount, delta}], baseVariant }

export function generateComparisonQuotes(layoutResult, priceFn, options = {}) {
  const placements = (layoutResult.placements || []).filter(p => p.sku && p.type !== "appliance");

  // Default 3-tier variants (training: Willis Kitchen pattern)
  const variants = options.variants || [
    { name: "Budget (TFL)", species: "TFL", construction: "Standard", door: "HNVR-FP", tier: "budget" },
    { name: "Mid-Range (Maple)", species: "Maple", construction: "Standard", door: "MET-V", tier: "mid" },
    { name: "Premium (Walnut)", species: "Walnut", construction: "Plywood", door: "ESX-M", tier: "premium" },
  ];

  const results = [];
  let baseSubtotal = null;

  for (const variant of variants) {
    try {
      const config = {
        species: variant.species,
        construction: variant.construction,
        door: variant.door,
        drawerFront: "DF-" + variant.door,
        drawerBox: "5/8-STD",
      };

      const quote = priceFn(placements, config);
      const subtotal = quote?.subtotal || 0;
      const itemCount = quote?.items?.length || 0;
      const resolvedCount = (quote?.items || []).filter(i => !i.error).length;

      if (baseSubtotal === null) baseSubtotal = subtotal;

      results.push({
        name: variant.name,
        tier: variant.tier,
        species: variant.species,
        construction: variant.construction,
        door: variant.door,
        subtotal,
        itemCount,
        resolvedCount,
        delta: subtotal - baseSubtotal,
        deltaPct: baseSubtotal > 0 ? Math.round(((subtotal - baseSubtotal) / baseSubtotal) * 100) : 0,
      });
    } catch (err) {
      results.push({
        name: variant.name,
        tier: variant.tier,
        species: variant.species,
        error: err.message,
        subtotal: 0,
      });
    }
  }

  return {
    variants: results,
    baseVariant: results[0]?.name || "Unknown",
    priceRange: results.length > 0
      ? { min: Math.min(...results.filter(r => r.subtotal > 0).map(r => r.subtotal)),
          max: Math.max(...results.map(r => r.subtotal)) }
      : { min: 0, max: 0 },
    spreadPct: results.length >= 2 && results[0].subtotal > 0
      ? Math.round(((results[results.length - 1].subtotal - results[0].subtotal) / results[0].subtotal) * 100)
      : 0,
  };
}


// ─── COUNTERTOP POLYLINE GENERATION ──────────────────────────────────────────
// Generates a polyline path at Z=34.5" (base cabinet top), 1.5" thick.
// Follows the front edge of all base cabinets on each wall, with 1.5" overhang.
// Returns an array of wall segments with start/end coordinates.

function generateCountertopPolyline(wallLayouts, islandLayout, peninsulaLayout, corners) {
  const Z_TOP = DIMS.baseHeight;          // 34.5"
  const THICKNESS = 1.5;                   // 1.5" thick countertop
  const FRONT_OVERHANG = 1.5;             // 1.5" past front face of base cabs
  const SIDE_OVERHANG = 0;                 // 0" at wall sides (flush with cabinet)

  const segments = [];

  // Wall-based countertop segments
  for (const wl of wallLayouts) {
    const baseCabs = wl.cabinets.filter(c =>
      c.type === 'base' || c.role === 'sink-base' ||
      (c.type === 'appliance' && (c.applianceType === 'sink' || c.applianceType === 'dishwasher'))
    );
    if (baseCabs.length === 0) continue;

    const sorted = [...baseCabs].sort((a, b) => (a.position || 0) - (b.position || 0));
    const firstPos = sorted[0].position || 0;
    const lastCab = sorted[sorted.length - 1];
    const lastEnd = (lastCab.position || 0) + (lastCab.width || 0);

    segments.push({
      wallId: wl.wallId,
      type: 'wall',
      startX: firstPos,
      endX: lastEnd,
      width: lastEnd - firstPos,
      depth: DIMS.baseDepth + FRONT_OVERHANG,
      z: Z_TOP,
      thickness: THICKNESS,
      overhang: FRONT_OVERHANG,
    });
  }

  // Island countertop
  if (islandLayout) {
    const workCabs = islandLayout.workSide || [];
    const backCabs = islandLayout.backSide || [];
    const allIsland = [...workCabs, ...backCabs];
    if (allIsland.length > 0) {
      const totalWidth = allIsland.reduce((s, c) => s + (c.width || 0), 0);
      const overhangDist = islandLayout.overhang?.distance || 12; // seating overhang
      segments.push({
        wallId: 'island',
        type: 'island',
        startX: 0,
        endX: totalWidth,
        width: totalWidth + (FRONT_OVERHANG * 2),  // overhang both sides
        depth: DIMS.baseDepth + FRONT_OVERHANG + overhangDist,
        z: Z_TOP,
        thickness: THICKNESS,
        overhang: FRONT_OVERHANG,
        seatingOverhang: overhangDist,
      });
    }
  }

  // Peninsula countertop
  if (peninsulaLayout) {
    const penCabs = peninsulaLayout.cabinets || peninsulaLayout.workSide || [];
    if (penCabs.length > 0) {
      const totalWidth = penCabs.reduce((s, c) => s + (c.width || 0), 0);
      segments.push({
        wallId: 'peninsula',
        type: 'peninsula',
        startX: 0,
        endX: totalWidth,
        width: totalWidth + FRONT_OVERHANG,
        depth: DIMS.baseDepth + FRONT_OVERHANG + (peninsulaLayout.overhang?.distance || 12),
        z: Z_TOP,
        thickness: THICKNESS,
        overhang: FRONT_OVERHANG,
      });
    }
  }

  return {
    segments,
    z: Z_TOP,
    thickness: THICKNESS,
    totalLinearFeet: segments.reduce((s, seg) => s + seg.width, 0) / 12,
    totalSqFt: segments.reduce((s, seg) => s + (seg.width * seg.depth) / 144, 0),
    cornerMiters: corners.filter(c => c.type !== 'none').length,
  };
}


// ─── FLANKING SYMMETRY CHECK ─────────────────────────────────────────────────
// Verifies cabinets on each side of range hoods and windows are symmetrical.
// Professional design rule: flanking cabinets should be equal width when possible.

function checkFlankingSymmetry(wallLayouts, upperLayouts) {
  const issues = [];
  const TOLERANCE = 3; // 3" tolerance for asymmetry

  // Check upper cabinets flanking hoods
  for (const ul of upperLayouts) {
    const cabs = ul.cabinets || [];
    for (let i = 0; i < cabs.length; i++) {
      const cab = cabs[i];
      const isHood = cab.role === 'range_hood' || cab.type === 'rangeHood' || cab._isHood;
      if (!isHood) continue;

      const left = i > 0 ? cabs[i - 1] : null;
      const right = i < cabs.length - 1 ? cabs[i + 1] : null;

      if (left && right && left.type !== 'rangeHood' && right.type !== 'rangeHood') {
        const diff = Math.abs((left.width || 0) - (right.width || 0));
        if (diff > TOLERANCE) {
          issues.push({
            severity: 'warning',
            rule: 'hood_flanking_asymmetry',
            message: `Wall ${ul.wallId}: cabinets flanking hood are asymmetric (${left.width}" left vs ${right.width}" right, diff=${diff}")`,
            fix: `Consider equalizing flanking cabinets to ${Math.round(((left.width || 0) + (right.width || 0)) / 2)}" each`,
          });
        }
      }
    }
  }

  // Check base cabinets flanking ranges
  for (const wl of wallLayouts) {
    const cabs = wl.cabinets || [];
    for (let i = 0; i < cabs.length; i++) {
      const cab = cabs[i];
      if (cab.type !== 'appliance' || (cab.applianceType !== 'range' && cab.applianceType !== 'cooktop')) continue;

      const left = cabs.slice(0, i).filter(c => c.type === 'base').pop();
      const right = cabs.slice(i + 1).find(c => c.type === 'base');

      if (left && right) {
        const diff = Math.abs((left.width || 0) - (right.width || 0));
        if (diff > TOLERANCE) {
          issues.push({
            severity: 'info',
            rule: 'range_flanking_asymmetry',
            message: `Wall ${wl.wallId}: cabinets flanking range are asymmetric (${left.width}" left vs ${right.width}" right)`,
            fix: `Pro tip: equal-width flanking cabinets create balanced visual composition`,
          });
        }
      }
    }
  }

  return issues;
}
