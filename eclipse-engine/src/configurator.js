/**
 * Eclipse Cabinet Designer â Project Configurator
 * =================================================
 * Top-level orchestrator that takes room dimensions + material preferences,
 * runs the layout solver, feeds placements into the pricing engine,
 * and returns a complete project quote.
 *
 * Pipeline:
 *   configureProject(input)
 *     â solve(roomInput)          // layout engine
 *     â mapPlacementsToPricing()  // bridge solver â pricing
 *     â priceProject(project)     // C3 pricing engine
 *     â assembleQuote()           // combined result
 *
 * Usage:
 *   import { configureProject } from '@eclipse/engine';
 *
 *   const quote = configureProject({
 *     room: {
 *       layoutType: "l-shape",
 *       roomType: "kitchen",
 *       walls: [
 *         { id: "A", length: 156, role: "range" },
 *         { id: "B", length: 120, role: "sink" },
 *       ],
 *       appliances: [
 *         { type: "range", width: 30, wall: "A" },
 *         { type: "sink", width: 36, wall: "B" },
 *         { type: "dishwasher", width: 24, wall: "B" },
 *       ],
 *       prefs: { cornerTreatment: "auto", preferDrawerBases: true, sophistication: "high" },
 *     },
 *     materials: {
 *       species: "Walnut",
 *       construction: "Plywood",
 *       doorStyle: "Napa VG FP",
 *       drawerType: "5/8\" Hdwd Dovetail",
 *       drawerGuide: "Blum FEG Guide",
 *     },
 *     options: {
 *       touchUpKit: "TUK-STAIN",
 *       includeEstimate: true,
 *     },
 *   });
 */

import { solve } from './solver.js';
import { CABINET_TYPES } from './constraints.js';
import {
  SPECIES_UPCHARGE, CONSTRUCTION_UPCHARGE,
  ACCESSORY_PRICING,
  priceProject, estimateProject,
} from './pricing.js';
import { generateProjectSummary } from './summary.js';


// âââ CATALOG LIST PRICES ââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Average list (stock) prices by SKU prefix, derived from 30 training projects.
// These are Maple/Standard baseline prices before species/construction upcharges.
// Keyed by cabinet prefix; width-based interpolation for non-standard widths.

const CATALOG_PRICES = {
  // ââ Base cabinets ââ
  base: {
    // width â list price (Maple/Standard)
    9:  185,   12: 220,   15: 275,   18: 330,   21: 385,
    24: 440,   27: 495,   30: 550,   33: 605,   36: 660,
    42: 770,   48: 880,
  },
  // Drawer bases (B3D, B4D) â ~15% premium over standard
  drawerBase: {
    9:  215,   12: 255,   15: 315,   18: 380,   21: 445,
    24: 510,   27: 570,   30: 635,   33: 695,   36: 760,
  },
  // Heavy-duty drawer (B2HD) â ~20% premium
  heavyDrawer: {
    18: 400,   21: 460,   24: 530,   27: 600,   30: 660,   33: 725,   36: 790,
  },
  // Sink bases (SB, SBA)
  sinkBase: {
    30: 480,   33: 540,   36: 600,   42: 720,
  },
  // Waste cabinets
  waste: {
    18: 350,   21: 395,
  },
  // Specialty base (BPOS, BTD, BKI, etc.)
  specialty: {
    9:  280,   12: 340,   15: 400,   18: 460,
  },
  // Roll-out tray base (B-RT)
  rollOut: {
    18: 390,   21: 450,   24: 510,   27: 575,   30: 640,   33: 700,   36: 760,
  },

  // ââ Corner cabinets ââ
  lazySusan: {
    33: 850,   36: 950,
  },
  blindCorner: {
    36: 620,   39: 680,   42: 740,   45: 800,   48: 860,
  },
  magicCorner: {
    48: 3940,  // Bollini BBC48R-MC $3,938
  },
  quarterTurn: {
    42: 780,
  },

  // ââ Wall cabinets ââ
  wall: {
    9:  130,   12: 160,   15: 195,   18: 230,   21: 270,
    24: 310,   27: 345,   30: 385,   33: 420,   36: 460,
    42: 535,   48: 610,
  },
  // Range hood
  rangeHood: {
    21: 380,   30: 450,   36: 520,   42: 580,   48: 640,   50: 680,
  },
  // Stacked wall
  stackedWall: {
    24: 620,   27: 700,   30: 780,   33: 860,   36: 940,
  },

  // ââ Tall cabinets ââ
  tall: {
    18: 950,   21: 1100,  24: 1250,  27: 1400,  30: 1550,
  },
  // Tall pantry (NTK, TP)
  tallPantry: {
    18: 1200,  21: 1400,  24: 1600,
  },

  // ââ Vanity cabinets ââ
  vanity: {
    18: 320,   21: 380,   24: 440,   30: 540,   36: 640,   42: 740,   48: 840,
  },
  vanityTall: {
    18: 780,   21: 900,   24: 1020,
  },

  // ââ Office cabinets ââ
  fileCabinet: {
    18: 420,   21: 480,
  },
  lapDrawer: {
    36: 280,
  },

  // ââ Island/specialty ââ
  island: {
    // Same as base pricing for work-side cabs
    12: 220,   15: 275,   18: 330,   21: 385,   24: 440,   30: 550,   36: 660,
  },

  // ââ GOLA (FC-) prefix adds ~10%
  golaMultiplier: 1.10,
};


// âââ SKU PARSER ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Parses a solver-generated SKU string into component parts for pricing.

function parseSku(sku) {
  if (!sku) return { prefix: "unknown", width: 0, family: "base" };

  const isGola = sku.startsWith("FC-");
  const cleanSku = isGola ? sku.slice(3) : sku;

  // Extract width â the significant dimensional number from the SKU.
  // Strategy: strip known alpha prefix, then grab the first number that
  // represents a cabinet width (typically 9â48 inches).
  // Known prefixes: B3D, B4D, B2HD, BBC, BL, SBA, SB, BPOS, BTD, BKI,
  //   BWDMA, BWDMW, BWDMB, BWS, BO, BCF, BWC, BPTPO, BUBO, TB, W, RW, RH,
  //   NTK, TP, FIO, TC, FLVSB, VTSB3D, VTSB, UV, FD2HD, LD, VB3D, etc.
  const stripped = cleanSku.replace(
    /^(?:SWSC|FLVSB|VTSB3D|VTSB|FD2HD|BWDMA|BWDMW|BWDMB|BPTPO|BBC|BKI|B2HD|B3D|B4D|BPOS|BTD|BUBO|BWS|BWC|BCF|SBA|DSB|RTB|WND|WGT|WGP?D|WPD|B-(?:RT|2D|FHD)|NTK|VB3D|WGPD|WSC|W1DR|RH|RW|SB|BL|TB|FIO|TC|TP|UV|BO|LD|WS|DWP|FDP|FZP|W|B|F)/,
    ""
  );
  // Also check for width after a dash (e.g., BPOS-12)
  let width = 0;
  if (stripped.length > 0) {
    const numMatch = stripped.match(/^-?(\d{1,2})/);
    width = numMatch ? parseInt(numMatch[1]) : 0;
  }
  // Fallback: if strip didn't yield a width, try after the last alpha prefix
  if (width === 0) {
    const fallback = cleanSku.match(/(\d{1,2})(?:\d{2,})?(?:[-|LR]|$)/);
    if (fallback) width = parseInt(fallback[1]);
  }

  // Determine family + doors/drawers from prefix
  let family = "base";
  let numDoors = 0;
  let numDrawers = 0;

  if (/^BL\d/.test(cleanSku)) {
    family = "lazySusan";
    numDoors = 2;
  } else if (/^BBC\d.*-MC/.test(cleanSku)) {
    family = "magicCorner";
    numDoors = 1;
  } else if (/^BBC\d.*-S/.test(cleanSku)) {
    family = "quarterTurn";
    numDoors = 1;
  } else if (/^BBC/.test(cleanSku)) {
    family = "blindCorner";
    numDoors = 1;
  } else if (/^SWSC/.test(cleanSku)) {
    family = "stackedWall";
    numDoors = 4;
  } else if (/^WSC/.test(cleanSku)) {
    family = "wall";
    numDoors = 2;
  } else if (/^SBA/.test(cleanSku)) {
    family = "sinkBase";
    numDoors = 1; // farmhouse apron â single front
  } else if (/^SB/.test(cleanSku)) {
    family = "sinkBase";
    numDoors = 2;
  } else if (/^DSB/.test(cleanSku)) {
    family = "sinkBase";
    numDoors = 2;
  } else if (/^RTB/.test(cleanSku)) {
    family = "specialty";
    numDoors = 0;
  } else if (/^BWDM/.test(cleanSku)) {
    family = "waste";
    numDoors = 1;
  } else if (/^BPOS/.test(cleanSku)) {
    family = "specialty";
    numDoors = 1;
  } else if (/^BKI/.test(cleanSku)) {
    family = "specialty";
    numDoors = 0;
    numDrawers = 1;
  } else if (/^BTD/.test(cleanSku)) {
    family = "specialty";
    numDoors = 1;
  } else if (/^BCF/.test(cleanSku)) {
    family = "specialty";
    numDoors = 1;
  } else if (/^BWC/.test(cleanSku)) {
    family = "specialty";
    numDoors = 1;
  } else if (/^BPTPO/.test(cleanSku)) {
    family = "specialty";
    numDoors = 0;
  } else if (/^BUBO/.test(cleanSku)) {
    family = "specialty";
    numDoors = 0;
    numDrawers = 1;
  } else if (/^B2HD/.test(cleanSku)) {
    family = "heavyDrawer";
    numDrawers = 2;
  } else if (/^B4D/.test(cleanSku)) {
    family = "drawerBase";
    numDrawers = 4;
  } else if (/^B3D/.test(cleanSku)) {
    family = "drawerBase";
    numDrawers = 3;
  } else if (/^B-RT/.test(cleanSku) || /^B\d+.*-RT/.test(cleanSku)) {
    family = "rollOut";
    numDoors = 1;
  } else if (/^B-2D/.test(cleanSku) || /^B\d+-2D/.test(cleanSku)) {
    family = "base";
    numDoors = 2;
  } else if (/^B-FHD/.test(cleanSku) || /^B\d+.*-FHD/.test(cleanSku)) {
    family = "base";
    numDoors = 1;
  } else if (/^TB/.test(cleanSku)) {
    family = "specialty";
    numDoors = 0;
  } else if (/^B\d/.test(cleanSku) || /^B$/.test(cleanSku)) {
    family = "base";
    numDoors = width >= 27 ? 2 : 1;
  } else if (/^RH/.test(cleanSku)) {
    family = "rangeHood";
    numDoors = 0;
  } else if (/^RW/.test(cleanSku)) {
    family = "wall";
    numDoors = 2;
  } else if (/^WGP?D/.test(cleanSku)) {
    family = "wall";
    numDoors = 2;
  } else if (/^WND/.test(cleanSku)) {
    family = "wall";
    numDoors = 0;
  } else if (/^WPD/.test(cleanSku)) {
    family = "wall";
    numDoors = 2;
  } else if (/^WS\d/.test(cleanSku)) {
    family = "wall";
    numDoors = 0;
  } else if (/^W\d/.test(cleanSku) || /^W$/.test(cleanSku)) {
    family = "wall";
    numDoors = width >= 27 ? 2 : 1;
  } else if (/^NTK|^TP/.test(cleanSku)) {
    family = "tallPantry";
    numDoors = 2;
  } else if (/^FIO|^TC|^BO/.test(cleanSku)) {
    family = "tall";
    numDoors = 2;
  } else if (/^FLVSB/.test(cleanSku)) {
    family = "vanity";
    numDoors = 2;
  } else if (/^VTSB3D/.test(cleanSku)) {
    family = "vanity";
    numDrawers = 3;
  } else if (/^VTSB/.test(cleanSku)) {
    family = "vanity";
    numDoors = 2;
  } else if (/^UV/.test(cleanSku)) {
    family = "vanityTall";
    numDoors = 2;
  } else if (/^FD2HD/.test(cleanSku)) {
    family = "fileCabinet";
    numDrawers = 2;
  } else if (/^LD/.test(cleanSku)) {
    family = "lapDrawer";
    numDrawers = 1;
  } else if (/^VB3D/.test(cleanSku)) {
    family = "fileCabinet";
    numDrawers = 3;
  } else if (/^F\d/.test(cleanSku)) {
    // Filler â not a cabinet, priced differently
    family = "filler";
    numDoors = 0;
  } else if (/^FBEP|^FWEP|^BEP|^FREP|^REP|^REF$|^EDGTL/.test(cleanSku)) {
    family = "endPanel";
    numDoors = 0;
  } else if (/^DWP|^FDP|^FZP/.test(cleanSku)) {
    family = "appliance_panel";
    numDoors = 0;
  } else if (/^TK|^TUK|^TUB|^QST/.test(cleanSku)) {
    family = "accessory";
    numDoors = 0;
  } else if (/^3SRM|^CRN|^STP|^BM|^PLWT/.test(cleanSku)) {
    family = "trim";
    numDoors = 0;
  } else if (/^PBC|^BC\d|^TL\d|^FBP|^FSLB/.test(cleanSku)) {
    family = "hardware";
    numDoors = 0;
  }

  return { prefix: cleanSku, width, family, isGola, numDoors, numDrawers };
}


/**
 * Look up the catalog list price for a parsed SKU.
 */
function lookupListPrice(parsed) {
  const { family, width, isGola } = parsed;

  // Non-cabinet items (accessories, fillers, trim) â priced separately
  if (["filler", "endPanel", "accessory", "trim", "hardware"].includes(family)) {
    return 0; // priced through accessory channel
  }

  const priceTable = CATALOG_PRICES[family] || CATALOG_PRICES.base;
  let price = priceTable[width];

  if (price === undefined) {
    // Interpolate from nearest known widths
    const widths = Object.keys(priceTable).map(Number).sort((a, b) => a - b);
    if (widths.length === 0) return 0;

    if (width <= widths[0]) {
      price = priceTable[widths[0]];
    } else if (width >= widths[widths.length - 1]) {
      price = priceTable[widths[widths.length - 1]];
    } else {
      // Linear interpolation
      let lo = widths[0], hi = widths[widths.length - 1];
      for (const w of widths) {
        if (w <= width) lo = w;
        if (w >= width && hi === widths[widths.length - 1]) hi = w;
      }
      if (lo === hi) {
        price = priceTable[lo];
      } else {
        const ratio = (width - lo) / (hi - lo);
        price = priceTable[lo] + ratio * (priceTable[hi] - priceTable[lo]);
      }
    }
  }

  // GOLA upcharge
  if (isGola) {
    price *= CATALOG_PRICES.golaMultiplier;
  }

  return Math.round(price * 100) / 100;
}


// âââ DRAWER UPGRADE APPLICATION âââââââââââââââââââââââââââââââââââââââââââ

/**
 * Apply drawer upgrades to a single cabinet line item.
 * Adds modifications for box type, slide type, and inserts based on materials config.
 *
 * @param {Object} cabinet - Cabinet line item with numDrawers, width, modifications
 * @param {Object} materials - Material configuration (may include drawerUpgrades)
 */
function applyDrawerUpgradesToCabinet(cabinet, materials) {
  const drawerUpgrades = materials.drawerUpgrades || {};
  const { boxType, slideType, drawerInserts } = drawerUpgrades;

  // No upgrades if not specified
  if (!boxType && !slideType && (!drawerInserts || drawerInserts.length === 0)) {
    return;
  }

  // Only apply to cabinets with drawers
  const numDrawers = cabinet.numDrawers || 0;
  if (numDrawers > 0) {
    // Box type upgrade
    if (boxType === "dovetail") {
      cabinet.modifications.push({ mod: "DVT", qty: numDrawers });
    } else if (boxType === "dovetail_walnut") {
      cabinet.modifications.push({ mod: "DVT-W", qty: numDrawers });
    }

    // Slide type upgrade
    if (slideType === "soft_close") {
      cabinet.modifications.push({ mod: "SC-DRW", qty: numDrawers });
    } else if (slideType === "undermount") {
      cabinet.modifications.push({ mod: "UM-DRW", qty: numDrawers });
    } else if (slideType === "undermount_soft_close") {
      cabinet.modifications.push({ mod: "UMSC-DRW", qty: numDrawers });
    }

    // Drawer inserts â match by width
    if (drawerInserts && Array.isArray(drawerInserts)) {
      const cabinetWidth = cabinet.width || 0;
      for (const insert of drawerInserts) {
        if (insert.width === cabinetWidth) {
          const modKey = mapInsertTypeToMod(insert.type);
          if (modKey) {
            cabinet.modifications.push({ mod: modKey, qty: 1 });
          }
        }
      }
    }
  }
}

/**
 * Map insert type to pricing mod key.
 */
function mapInsertTypeToMod(insertType) {
  const mapping = {
    "cutlery": "WCD",
    "peg": "DPS",
    "spice": "SPR",
  };
  return mapping[insertType] || null;
}


// âââ PLACEMENT â LINE ITEM BRIDGE âââââââââââââââââââââââââââââââââââââââââââ

/**
 * Convert solver placements into pricing line items grouped by material spec.
 */
function mapPlacementsToPricing(layout, materials) {
  const cabinets = [];
  const accessoryItems = [];
  let lineNum = 0;

  for (const placement of layout.placements) {
    const role = placement.role || "";

    // Skip appliances
    if (placement.type === "appliance") continue;

    // Separate accessories from cabinets
    if (role === "accessory" || role === "toe-kick" || role === "sub-rail" ||
        role === "touch-up" || role.includes("end-panel") || role === "valance" || role === "light_bridge" || role === "lighting" ||
        role === "applied_molding" || role === "base_shoe" || role === "counter_mould") {
      accessoryItems.push(placement);
      continue;
    }

    const parsed = parseSku(placement.sku);
    const listPrice = lookupListPrice(parsed);

    // Only include items with actual prices (skip zero-price accessories)
    if (listPrice > 0 || parsed.family === "filler") {
      lineNum++;
      const cabinet = {
        line: lineNum,
        sku: placement.sku,
        listPrice,
        numDoors: parsed.numDoors,
        numDrawers: parsed.numDrawers,
        width: placement.width || parsed.width,
        wall: placement.wall,
        role: placement.role,
        modifications: placement.modifications ? [...placement.modifications] : [],
      };

      // Apply drawer upgrades to this cabinet
      applyDrawerUpgradesToCabinet(cabinet, materials);

      cabinets.push(cabinet);
    }
  }

  // Map accessories to priced items
  const pricedAccessories = [];
  for (const acc of accessoryItems) {
    const accPrice = resolveAccessoryPrice(acc);
    if (accPrice > 0) {
      pricedAccessories.push({
        sku: acc.sku,
        qty: acc.qty || 1,
        unitPrice: accPrice,
      });
    }
  }

  // Build material spec(s)
  // For multi-tone projects, materials.specs can be an array;
  // for single-spec, wrap materials into one spec
  const specs = [];
  if (materials.specs && Array.isArray(materials.specs)) {
    // Multi-spec (2-tone, 3-tone)
    for (const spec of materials.specs) {
      const specCabs = cabinets.filter(c => matchesSpec(c, spec));
      specs.push({
        specId: spec.specId || spec.id || `spec-${specs.length + 1}`,
        species: spec.species,
        construction: spec.construction,
        doorStyle: spec.doorStyle,
        drawerType: spec.drawerType,
        drawerGuide: spec.drawerGuide,
        lineItems: specCabs,
      });
    }
    // Catch any unmatched cabinets into first spec
    const matched = new Set(specs.flatMap(s => s.lineItems.map(i => i.line)));
    const unmatched = cabinets.filter(c => !matched.has(c.line));
    if (unmatched.length > 0 && specs.length > 0) {
      specs[0].lineItems.push(...unmatched);
    }
  } else {
    // Single-spec
    specs.push({
      specId: materials.specId || "spec-1",
      species: materials.species || "Maple",
      construction: materials.construction || "Standard",
      doorStyle: materials.doorStyle || "Hanover FP",
      drawerType: materials.drawerType,
      drawerGuide: materials.drawerGuide,
      lineItems: cabinets,
    });
  }

  return { specs, accessories: pricedAccessories };
}


/**
 * Check if a cabinet line item matches a multi-spec filter.
 * Spec filters can target by wall, role, or cabinet family.
 */
function matchesSpec(cabinet, spec) {
  if (spec.walls && Array.isArray(spec.walls)) {
    return spec.walls.includes(cabinet.wall);
  }
  if (spec.roles && Array.isArray(spec.roles)) {
    return spec.roles.includes(cabinet.role);
  }
  if (spec.families && Array.isArray(spec.families)) {
    const parsed = parseSku(cabinet.sku);
    return spec.families.includes(parsed.family);
  }
  // Default: match all (single-spec fallback)
  return true;
}


/**
 * Resolve pricing for an accessory placement.
 */
function resolveAccessoryPrice(acc) {
  const sku = acc.sku || "";

  // End panels
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.endPanels)) {
    if (sku.startsWith(key)) return data.price;
  }

  // Fillers â price per inch Ã typical width
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.fillers)) {
    if (sku.startsWith(key)) return data.pricePerInch * (acc.width || 3);
  }

  // Trim
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.trim)) {
    if (sku.startsWith(key)) return data.pricePerFt || data.price || 0;
  }

  // Applied molding â price per door
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.appliedMolding || {})) {
    if (sku.startsWith(key)) return (data.pricePerDoor || 0) * (acc.qty || 1);
  }

  // Base shoe â price per 8ft length
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.baseShoe || {})) {
    if (sku.startsWith(key)) return data.price || 0;
  }

  // Counter mould â price per 8ft length
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.counterMould || {})) {
    if (sku.startsWith(key)) return data.price || 0;
  }

  // Touch-up
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.touchUp)) {
    if (sku.startsWith(key)) return data.price;
  }

  // Hardware
  for (const [key, data] of Object.entries(ACCESSORY_PRICING.hardware)) {
    if (sku.startsWith(key)) return data.price;
  }

  // Valances â $45 flat per valance
  if (sku.startsWith("VLN-")) {
    return 45;
  }

  // Light bridges â $8 per linear foot
  if (sku.startsWith("LB-")) {
    // Extract width from SKU format "LB-{width}"
    const match = sku.match(/LB-(\d+)/);
    if (match) {
      const widthInches = parseInt(match[1], 10);
      const widthInFeet = widthInches / 12;
      return Math.round(widthInFeet * 8);
    }
    return 0;
  }

  // Toe kick â typically no charge (Eclipse includes with order)
  if (sku.startsWith("TK-N/C")) return 0;

  // Lighting accessories
  // Under-cabinet LED strips (UCL) â $12/linear foot
  if (sku.startsWith("UCL-")) {
    const match = sku.match(/UCL-(\d+)'/);
    if (match) {
      const lengthFeet = parseInt(match[1], 10);
      return lengthFeet * 12;
    }
    return 0;
  }

  // In-cabinet lighting (ICL) â $35 per unit
  if (sku.startsWith("ICL-")) {
    return 35;
  }

  // Toe kick LED strips (TKL) â $8/linear foot
  if (sku.startsWith("TKL-")) {
    const match = sku.match(/TKL-(\d+)'/);
    if (match) {
      const lengthFeet = parseInt(match[1], 10);
      return lengthFeet * 8;
    }
    return 0;
  }

  // Display shelf lighting (DSL) â $45 per unit
  if (sku.startsWith("DSL-")) {
    return 45;
  }

  return 0;
}


// âââ MAIN CONFIGURATOR ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/**
 * Configure a complete project: room â layout â pricing â quote.
 *
 * @param {Object} input
 *   @param {RoomInput} input.room - Room dimensions, appliances, preferences (passed to solve())
 *   @param {Object} input.materials - Material configuration
 *     @param {string} materials.species - Species name (e.g. "Walnut")
 *     @param {string} materials.construction - Construction type (e.g. "Plywood")
 *     @param {string} materials.doorStyle - Door style (e.g. "Napa VG FP")
 *     @param {string} [materials.drawerType] - Drawer upgrade type
 *     @param {string} [materials.drawerGuide] - Drawer guide type
 *     @param {Array}  [materials.specs] - Multi-spec array for 2-tone/3-tone projects
 *   @param {Object} [input.options] - Additional options
 *     @param {string} [options.touchUpKit] - Touch-up kit type ("TUK-STAIN", "TUB", "QST")
 *     @param {number} [options.touchUpQty] - Touch-up kit quantity (default 1)
 *     @param {boolean} [options.includeEstimate] - Include quick ballpark estimate
 *     @param {string} [options.projectName] - Project name for the quote
 *     @param {string} [options.clientName] - Client name
 * @returns {Object} Complete project quote
 */
export function configureProject(input) {
  const { room, materials = {}, options = {} } = input;

  if (!room) {
    throw new Error("configureProject requires a 'room' input with walls and layout info.");
  }

  // ââ Step 1: Run the solver ââ
  const layout = solve(room);

  // ââ Step 2: Bridge solver placements â pricing line items ââ
  const { specs, accessories } = mapPlacementsToPricing(layout, materials);

  // ââ Step 3: Build project pricing input ââ
  const projectInput = {
    specs,
    accessories,
  };

  // Touch-up kit
  if (options.touchUpKit) {
    projectInput.touchUp = {
      type: options.touchUpKit,
      qty: options.touchUpQty || 1,
    };
  }

  // ââ Step 4: Run the pricing engine ââ
  const pricing = priceProject(projectInput);

  // ââ Step 5: Optional ballpark estimate ââ
  let estimate = null;
  if (options.includeEstimate) {
    estimate = estimateProject({
      cabinetCount: layout.metadata.totalCabinets,
      species: materials.species || "Maple",
      construction: materials.construction || "Standard",
      doorStyle: materials.doorStyle,
    });
  }

  // ââ Step 6: Generate cost summary ââ
  const quote = {
    specs: pricing.specs,
    projectTotal: pricing.projectTotal,
    accessoryBreakdown: pricing.accessoryBreakdown,
    accessoryTotal: pricing.accessoryTotal,
  };
  const summary = generateProjectSummary({ layout, quote });

  // ââ Step 7: Assemble the complete quote ââ
  return {
    // Project header
    project: {
      name: options.projectName || "Untitled Project",
      client: options.clientName || "",
      date: new Date().toISOString().slice(0, 10),
      roomType: layout.roomType,
      layoutType: layout.layoutType,
    },

    // Layout summary
    layout: {
      totalCabinets: layout.metadata.totalCabinets,
      totalAccessories: layout.metadata.totalAccessories,
      validationErrors: layout.metadata.errors,
      validationWarnings: layout.metadata.warnings,
      walls: layout.walls.map(w => ({
        wallId: w.wallId,
        wallLength: w.wallLength,
        cabinetCount: w.cabinets.filter(c => c.type !== "appliance").length,
      })),
      hasIsland: !!layout.island,
      hasPeninsula: !!layout.peninsula,
      cornerCount: layout.corners.length,
    },

    // Material configuration echo
    materials: {
      species: materials.species || "Maple",
      construction: materials.construction || "Standard",
      doorStyle: materials.doorStyle || "Hanover FP",
      drawerType: materials.drawerType || "Standard",
      drawerGuide: materials.drawerGuide || "Standard",
      specCount: specs.length,
    },

    // Full pricing breakdown
    pricing,

    // Cost summary
    summary,

    // Ballpark estimate (if requested)
    estimate,

    // Raw data for downstream consumers
    _raw: {
      solverOutput: layout,
      pricingInput: projectInput,
    },
  };
}


/**
 * Quick-configure: minimal input for fast quoting.
 * Takes just room basics + species â returns a quote.
 *
 * @param {Object} params
 *   @param {string} params.layoutType - "l-shape", "single-wall", etc.
 *   @param {string} [params.roomType] - "kitchen", "vanity", etc.
 *   @param {Array} params.walls - [{id, length, role?}]
 *   @param {Array} [params.appliances] - Appliance array
 *   @param {string} [params.species] - Species shortcut (default "Maple")
 *   @param {string} [params.construction] - Construction shortcut (default "Standard")
 *   @param {string} [params.doorStyle] - Door style shortcut
 *   @param {string} [params.sophistication] - "standard" | "high" | "very_high"
 * @returns {Object} Complete project quote
 */
export function quickConfigure(params) {
  const {
    layoutType, roomType, walls, appliances,
    species, construction, doorStyle, sophistication,
    island, peninsula,
    ...rest
  } = params;

  return configureProject({
    room: {
      layoutType,
      roomType: roomType || "kitchen",
      walls,
      appliances: appliances || [],
      island,
      peninsula,
      prefs: {
        cornerTreatment: "auto",
        preferDrawerBases: true,
        sophistication: sophistication || "high",
        ...rest.prefs,
      },
    },
    materials: {
      species: species || "Maple",
      construction: construction || "Standard",
      doorStyle: doorStyle || "Hanover FP",
    },
    options: {
      includeEstimate: true,
      touchUpKit: "TUK-STAIN",
    },
  });
}


/**
 * Multi-room configurator: configure multiple rooms in a single project.
 * Returns individual room quotes plus a combined project total.
 *
 * @param {Object} input
 *   @param {Array} input.rooms - Array of room configs (each gets its own configureProject call)
 *   @param {Object} input.materials - Shared material config (can be overridden per room)
 *   @param {Object} [input.options] - Project-level options
 * @returns {Object} Multi-room project quote
 */
export function configureMultiRoom(input) {
  const { rooms, materials = {}, options = {} } = input;

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    throw new Error("configureMultiRoom requires a 'rooms' array with at least one room.");
  }

  const roomQuotes = [];
  let combinedCabinets = 0;
  let combinedTotal = 0;

  for (const roomConfig of rooms) {
    const roomMaterials = { ...materials, ...(roomConfig.materials || {}) };
    const roomOptions = {
      ...options,
      projectName: roomConfig.name || options.projectName,
      includeEstimate: false, // skip per-room estimates
    };

    const quote = configureProject({
      room: roomConfig.room || roomConfig,
      materials: roomMaterials,
      options: roomOptions,
    });

    roomQuotes.push(quote);
    combinedCabinets += quote.layout.totalCabinets;
    combinedTotal += quote.pricing.projectTotal;
  }

  // Combined estimate
  const combinedEstimate = estimateProject({
    cabinetCount: combinedCabinets,
    species: materials.species || "Maple",
    construction: materials.construction || "Standard",
    doorStyle: materials.doorStyle,
  });

  return {
    project: {
      name: options.projectName || "Multi-Room Project",
      client: options.clientName || "",
      date: new Date().toISOString().slice(0, 10),
      roomCount: rooms.length,
    },
    rooms: roomQuotes,
    combined: {
      totalCabinets: combinedCabinets,
      projectTotal: Math.round(combinedTotal * 100) / 100,
    },
    estimate: combinedEstimate,
  };
}


// âââ EXPORTED HELPERS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export { parseSku, lookupListPrice, CATALOG_PRICES };
