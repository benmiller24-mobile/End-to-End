/**
 * Eclipse Cabinetry — Shared Pricing Module
 * ==========================================
 * Single import entry point for the Eclipse pricing engine.
 */

// SKU Catalog
export { RAW_SKU_DATA, CATALOG, findSku, searchSkus, TYPE_NAMES, SECTIONS } from './skuCatalog.js';

// Finish & Species Data
export {
  SPECIES_PCT, CONSTRUCTION_PCT, MATERIALS, INTERIORS,
  FINISH_COLORS, getSpeciesNames, getColorsForSpecies,
  GLAZES, HIGHLIGHTS, CHAR_TECHNIQUES,
} from './finishData.js';

// Door, Drawer Front & Drawer Box Data
export {
  DOOR_GROUP_CHARGES, DOORS, DRAWER_FRONTS, DRAWER_BOXES,
  findDoor, findDrawerFront, findDrawerBox,
} from './doorData.js';

// Cabinet Modifications & ROT Options
export {
  CABINET_MODS, ROT_OPTIONS, ROT_FEG_UPCHARGE,
  getApplicableMods, calcModCost,
} from './modData.js';

// Helper Functions
export {
  isSqIn, isCO, isCustom, isREF, isFlat,
  CO_LABELS, REF_ICE_CUTOUT,
  FLS_DEPTH_MIN, FLS_DEPTH_MAX, FLS_LEN_MIN, FLS_LEN_MAX,
  extractCabinetWidth, guessDoors, guessDrawerCount, guessBuiltInROT,
  SKU_LABELS, ZONES, formatCurrency,
} from './helpers.js';

// Core Pricing Engine
export {
  calculateItemPrice, calculateOrderTotal, calculateLayoutPrice,
} from './pricingEngine.js';

// Margin & Proposal Calculator
export {
  calculateDealerPrice, buildProposal, quickEstimate,
} from './marginCalculator.js';
