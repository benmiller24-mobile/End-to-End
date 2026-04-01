/**
 * Eclipse Cabinetry — Core Pricing Engine (C3 Formula)
 *
 * The Eclipse pricing formula:
 *   stockBase = price × length × (1 + speciesPct/100)           [standard items]
 *             = price × sqin × (1 + speciesPct/100) + refIce    [sq-in items]
 *             = price × linearInches × (1 + speciesPct/100)     [column overlays]
 *   + doorGroupCharge × doorCount
 *   + drawerFrontGroupCharge × drawerCount
 *   + drawerBoxUpcharge × (drawers + ROTs + builtInROTs)
 *   + RBS charge ($87)
 *   = prePly
 *   × (1 + constructionPct/100)
 *   = UNIT PRICE
 */

import { SPECIES_PCT, CONSTRUCTION_PCT } from './finishData.js';
import { DOOR_GROUP_CHARGES, DOORS, DRAWER_FRONTS, DRAWER_BOXES } from './doorData.js';
import { isSqIn, isCO, isCustom, isFlat, isREF, REF_ICE_CUTOUT } from './helpers.js';

/**
 * Calculate the price for a single line item.
 *
 * @param {Object} item - The line item from the catalog
 *   Required: { s: SKU, p: stockPrice, r: catalogRef, t: typeCode }
 *   Optional: { q: qty, so: speciesOverride, len: length, sqin: sqInches, sqH: linearInches,
 *               dc: doorCount, drc: drawerCount, ds: doorStyle, dfs: drawerFrontStyle,
 *               rbs: hasRBS, brot: builtInROTs, rot: rotType1, rotQ: rotQty1, rotFeg: rotFullExt1,
 *               rot2: rotType2, rot2Q: rotQty2, rot2Feg: rotFullExt2, refIce: hasIceCutout }
 * @param {string} species - Global species selection
 * @param {string} construction - "Standard" or "Plywood"
 * @param {string} globalDoor - Global door style code (default)
 * @param {string} globalDrawerFront - Global drawer front style code (default)
 * @param {string} globalDrawerBox - Global drawer box code (default)
 * @returns {Object} { unitPrice, totalPrice, stockBase, prePly, doorChg, dfChg, dbChg, isSqInItem, rbsChg, plyPct }
 */
export function calculateItemPrice(item, species, construction, globalDoor = "HNVR", globalDrawerFront = "DF-HNVR", globalDrawerBox = "5/8-STD") {
  // Custom items — pass-through pricing
  if (isCustom(item.s)) {
    const u = item.p || 0;
    return { unitPrice: u, totalPrice: u * (item.q || 1), stockBase: u, prePly: u, doorChg: 0, dfChg: 0, dbChg: 0, isSqInItem: false, rbsChg: 0, plyPct: 0 };
  }

  // Flat-price items (samples, displays) — no markups
  if (isFlat(item.s, item.r)) {
    const u = item.p || 0;
    return { unitPrice: u, totalPrice: u * (item.q || 1), stockBase: u, prePly: u, doorChg: 0, dfChg: 0, dbChg: 0, isSqInItem: false, rbsChg: 0, plyPct: 0 };
  }

  const sp = item.so || species;
  const sm = SPECIES_PCT[sp] || 0;
  const cm = CONSTRUCTION_PCT[construction] || 0;
  const len = item.len || 1;
  const sqin = item.sqin || 0;
  const itemSQ = isSqIn(item.s, item.r);
  const refIceCost = isREF(item.s) && item.refIce ? REF_ICE_CUTOUT : 0;
  const isCOItem = isCO(item.s);

  // Step 1: Stock base price with species markup
  const stockBase = isCOItem
    ? item.p * (item.sqH || 0) * (1 + sm / 100)       // Column overlays: price × linear inches × species
    : itemSQ
      ? item.p * sqin * (1 + sm / 100) + refIceCost    // Sq-in items: price × sq.in × species + ice cutout
      : item.p * len * (1 + sm / 100);                  // Standard: price × length × species

  // Step 2: Door style upcharge
  const ds = item.ds || globalDoor;
  const dInfo = DOORS.find(d => d.v === ds);
  const dgCharge = dInfo ? (DOOR_GROUP_CHARGES[dInfo.g] || 0) : 0;
  const dxCharge = dInfo?.x || 0;
  const isC3 = item.r === "C3";
  const doorChg = (itemSQ && !isC3 || item.t === "M") ? 0 : (dgCharge + dxCharge) * (item.dc || 0);

  // Step 3: Drawer front upcharge
  const drc = item.drc || 0;
  const dfStyle = item.dfs || globalDrawerFront;
  const dfInfo = DRAWER_FRONTS.find(d => d.v === dfStyle);
  const dfgChg = dfInfo?.g ? (DOOR_GROUP_CHARGES[dfInfo.g] || 0) : 0;
  const dfChg = (itemSQ && !isC3 || item.t === "M") ? 0 : dfgChg * drc;

  // Step 4: Drawer box upcharge
  const rotQ = (item.rot && item.rotQ > 0) ? item.rotQ : 0;
  const rot2Q = (item.rot2 && item.rot2Q > 0) ? item.rot2Q : 0;
  const brot = item.brot || 0;
  const dbInfo = DRAWER_BOXES.find(d => d.v === (globalDrawerBox));
  const dbChg = isC3 ? 0 : (drc + rotQ + rot2Q + brot) * (dbInfo?.price || 0);

  // Step 5: RBS charge
  const rbsChg = item.rbs ? 87 : 0;

  // Step 6: Pre-plywood subtotal
  const prePly = stockBase + doorChg + dfChg + dbChg + rbsChg;

  // Step 7: Apply construction multiplier (plywood upgrade)
  const unitPrice = prePly * (1 + cm / 100);

  return {
    unitPrice,
    totalPrice: unitPrice * (item.q || 1),
    stockBase,
    prePly,
    doorChg,
    dfChg,
    dbChg,
    isSqInItem: itemSQ,
    rbsChg,
    plyPct: cm,
  };
}

/**
 * Calculate total price for an array of line items (a room or full order)
 * @param {Array} items - Array of item objects with catalog data and quantities
 * @param {Object} config - { species, construction, door, drawerFront, drawerBox }
 * @returns {Object} { items: [...pricedItems], subtotal, itemCount }
 */
export function calculateOrderTotal(items, config) {
  const { species, construction, door, drawerFront, drawerBox } = config;
  let subtotal = 0;
  const pricedItems = items.map(item => {
    const pricing = calculateItemPrice(item, species, construction, door, drawerFront, drawerBox);
    subtotal += pricing.totalPrice;
    return { ...item, ...pricing };
  });
  return { items: pricedItems, subtotal, itemCount: items.length };
}

/**
 * Calculate price for a layout generated by the design engine.
 * Takes simplified cabinet placement data and resolves against the catalog.
 *
 * @param {Array} placements - Array of { sku, qty, wall, position, mods, doorOverride, ... }
 * @param {Object} config - { species, construction, door, drawerFront, drawerBox }
 * @param {Function} skuLookup - Function to look up SKU in catalog (sku => catalogEntry)
 * @returns {Object} { items, subtotal, byWall: { wallId: wallSubtotal }, byType: { typeCode: typeSubtotal } }
 */
export function calculateLayoutPrice(placements, config, skuLookup) {
  const byWall = {};
  const byType = {};
  let subtotal = 0;

  const pricedItems = placements.map(placement => {
    const catalogEntry = skuLookup(placement.sku);
    if (!catalogEntry) {
      return { ...placement, error: `SKU not found: ${placement.sku}`, unitPrice: 0, totalPrice: 0 };
    }

    // Merge catalog data with placement overrides
    const item = {
      ...catalogEntry,
      q: placement.qty || 1,
      dc: placement.doorCount,
      drc: placement.drawerCount,
      ds: placement.doorOverride,
      dfs: placement.drawerFrontOverride,
      len: placement.length || 1,
      sqin: placement.sqin,
      sqH: placement.linearInches,
      rbs: placement.rbs,
      brot: placement.builtInROT,
      rot: placement.rot,
      rotQ: placement.rotQty,
      rot2: placement.rot2,
      rot2Q: placement.rot2Qty,
      refIce: placement.refIce,
    };

    const pricing = calculateItemPrice(item, config.species, config.construction, config.door, config.drawerFront, config.drawerBox);

    // Aggregate by wall
    const wall = placement.wall || "unassigned";
    byWall[wall] = (byWall[wall] || 0) + pricing.totalPrice;

    // Aggregate by type
    const type = catalogEntry.t || "X";
    byType[type] = (byType[type] || 0) + pricing.totalPrice;

    subtotal += pricing.totalPrice;

    return { ...placement, ...catalogEntry, ...pricing };
  });

  return { items: pricedItems, subtotal, byWall, byType };
}
