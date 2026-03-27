/**
 * Eclipse Cabinet Designer — Layout Engine
 * ==========================================
 * Constraint-based cabinet layout generator for kitchens, bathrooms,
 * offices, laundry rooms, utility spaces, and showrooms.
 * Takes room dimensions → generates cabinet placements → prices via @eclipse/pricing.
 */

// Core solver + pattern selection
export { solve, selectTallPattern, selectUpperPattern, selectGlassStyle, selectMullionPattern, resolveTwoTone, applyDrawerUpgrades, scoreCornerEfficiency } from './solver.js';

// Constraints — Layer 1 (NKBA) and Layer 2 (Eclipse catalog rules)
export {
  DIMS, STD_BASE_WIDTHS, STD_UPPER_WIDTHS, STD_UPPER_HEIGHTS,
  STD_TALL_HEIGHTS, STD_VANITY_WIDTHS,
  ROOM_TYPES, CABINET_TYPES,
  LANDING, CLEARANCE, TRIANGLE, CORNER_RULES,
  ADJACENCY, FILLER_RULES, UPPER_RULES, ISLAND_RULES,
  PENINSULA_RULES, MATERIAL_SPLIT, ZONE_CABINET_PRIORITY,
  WIDTH_MOD_RULES, CONSTRUCTION_TYPES, TRIM_ACCESSORIES,
  fillSegment, validateLayout,
} from './constraints.js';

// Patterns — design patterns from 30 training projects
export {
  RANGE_PATTERNS, SINK_PATTERNS, FRIDGE_PATTERNS,
  ISLAND_PATTERNS, TALL_PATTERNS, UPPER_PATTERNS,
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  VANITY_PATTERNS, UTILITY_PATTERNS,
  ACCESSORY_RULES, DOOR_LAYOUT_COMPAT,
} from './patterns.js';

// Pricing — C3 pricing engine
export {
  SPECIES_UPCHARGE, CONSTRUCTION_UPCHARGE,
  DOOR_STYLE_CHARGE, DRAWER_UPGRADES, DRAWER_GUIDE_UPGRADES,
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
  solveMultiRoom, getMultiRoomSummary,
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
