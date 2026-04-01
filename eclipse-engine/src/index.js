/**
 * Eclipse Cabinet Designer — Layout Engine
 * ==========================================
 * Constraint-based cabinet layout generator for kitchens, bathrooms,
 * offices, laundry rooms, utility spaces, and showrooms.
 * Takes room dimensions → generates cabinet placements → prices via @eclipse/pricing.
 *
 * Architecture:
 *   constraints.js  — NKBA rules + Eclipse catalog rules (Layer 1 & 2) + room types
 *   patterns.js     — Design patterns from 30 training projects
 *   solver.js       — Core layout solver (room-type-aware)
 *
 * Usage:
 *   import { solve } from '@eclipse/engine';
 *   import { calculateLayoutPrice, findSku } from '@eclipse/pricing';
 *
 *   // Kitchen example
 *   const layout = solve({
 *     layoutType: "l-shape",
 *     roomType: "kitchen",
 *     walls: [
 *       { id: "A", length: 156, role: "range" },
 *       { id: "B", length: 120, role: "sink" },
 *     ],
 *     appliances: [
 *       { type: "range", width: 30, wall: "A" },
 *       { type: "sink", width: 36, wall: "B" },
 *       { type: "dishwasher", width: 24, wall: "B" },
 *       { type: "refrigerator", width: 36, wall: "A", position: "end" },
 *     ],
 *     prefs: { cornerTreatment: "auto", preferDrawerBases: true },
 *   });
 *
 *   // Vanity example
 *   const vanity = solve({
 *     layoutType: "single-wall",
 *     roomType: "vanity",
 *     walls: [{ id: "A", length: 198.875 }],
 *     appliances: [],
 *     prefs: {},
 *   });
 */

// Core solver + pattern selection + comparison quotes
export { solve, selectTallPattern, selectUpperPattern, selectGlassStyle, selectMullionPattern, resolveTwoTone, applyDrawerUpgrades, scoreCornerEfficiency, scoreAesthetics, generateComparisonQuotes, scoreAgainstTraining } from './solver.js';

// Constraints — Layer 1 (NKBA) and Layer 2 (Eclipse catalog rules)
export {
  DIMS, STD_BASE_WIDTHS, STD_UPPER_WIDTHS, STD_UPPER_HEIGHTS,
  STD_TALL_HEIGHTS, STD_VANITY_WIDTHS,
  ROOM_TYPES, CABINET_TYPES,
  LANDING, CLEARANCE, TRIANGLE, CORNER_RULES,
  ADJACENCY, FILLER_RULES, UPPER_RULES, ISLAND_RULES,
  PENINSULA_RULES, MATERIAL_SPLIT, ZONE_CABINET_PRIORITY,
  WIDTH_MOD_RULES, CONSTRUCTION_TYPES, TRIM_ACCESSORIES,
  CATALOG_PREFIXES, EDGE_PROFILES, HINGE_TYPES,
  fillSegment, validateLayout,
} from './constraints.js';

// Patterns — design patterns from 44 training projects
export {
  RANGE_PATTERNS, SINK_PATTERNS, FRIDGE_PATTERNS,
  ISLAND_PATTERNS, TALL_PATTERNS, UPPER_PATTERNS,
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  VANITY_PATTERNS, UTILITY_PATTERNS,
  BAR_PATTERNS, VALANCE_PATTERNS, FRIDGE_TALL_PATTERNS,
  ACCESSORY_RULES, DOOR_LAYOUT_COMPAT,
} from './patterns.js';

// Zone Patterns — Phase 2: data-mined cabinet selection by zone (39 Eclipse projects)
export {
  CORNER_TREATMENTS, selectCornerTreatment,
  SINK_ZONE_RULES, RANGE_ZONE_RULES, FRIDGE_POD_RULES,
  ISLAND_RULES_EXTENDED, UPPER_SIZING_RULES,
  FILLER_MOD_RULES, MATERIAL_SPEC_RULES,
  PENINSULA_ZONE_RULES, ZONE_PATTERN_METADATA,
} from './zone-patterns.js';

// Pricing — C3 pricing engine
export {
  SPECIES_UPCHARGE, CONSTRUCTION_UPCHARGE,
  DOOR_STYLE_CHARGE, DOOR_GROUP_CHARGE, DRAWER_UPGRADES, DRAWER_GUIDE_UPGRADES,
  MOD_PRICING, ACCESSORY_PRICING,
  priceLineItem, priceSpec, priceProject, estimateProject,
} from './pricing.js';

// Configurator — top-level project orchestrator (room → layout → pricing → quote)
export {
  configureProject, quickConfigure, configureMultiRoom,
  parseSku, lookupListPrice, CATALOG_PRICES,
} from './configurator.js';

// Summary & export — cost summary generation and formatting
export {
  generateProjectSummary, generateCostBreakdownText,
} from './summary.js';

// Multi-Room support — solve and configure multiple rooms in one project
export {
  solveMultiRoom, getMultiRoomSummary, COMPANION_TEMPLATES, listCompanionTemplates,
} from './multiroom.js';

// Templates — room template library for quick starts
export {
  getTemplate, listTemplates, getTemplateCategories, solveTemplate, TEMPLATES,
} from './templates.js';

// Revisions — change order tracking and diff
export {
  diffLayouts, diffQuotes, createRevision,
} from './revisions.js';

// Coordinates — 3D coordinate assignment for visualization export
export {
  assignCoordinates, autoWallConfig, exportForVisualization,
} from './coordinates.js';

// Renderer — Phase 4: Elevation + Floorplan SVG output + Bill of Materials
export {
  renderFloorPlan, renderElevation, generateBOM, renderLayout,
} from './renderer.js';
