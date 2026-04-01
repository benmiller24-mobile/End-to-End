/**
 * lighting-automation.js
 *
 * Automated light rail molding and LED channel generation for under-cabinet lighting.
 * Handles light rail profiles, LED tape requirements, puck light positioning, and
 * in-cabinet lighting for glass-front uppers.
 *
 * @module lighting-automation
 * @since 1.0.0
 */

/**
 * Lighting system constants and specifications
 * @type {Object}
 */
export const LIGHTING_CONSTANTS = {
  // Light rail profiles
  PROFILES: {
    LR_SQ: { name: 'LR-SQ', label: 'Square', height: 1.5, depth: 0.75 },
    LR_OG: { name: 'LR-OG', label: 'Ogee', height: 2.25, depth: 0.75 },
  },

  // Light rail stock sizing
  STOCK_LENGTH: 96, // inches (8 feet)
  WASTE_FACTOR: 0.10, // 10% waste for cuts and miters

  // LED tape specifications
  LED_TAPE: {
    ROLL_LENGTH: 196.85, // inches (5 meters = 16.4 feet)
    STANDARD_WATTAGE: 4.4, // W per linear foot
    HIGH_OUTPUT_WATTAGE: 8.0, // W per linear foot
    RECESSION: 1.0, // inches from front edge of upper cabinet
    DRIVER_COVERAGE: 196.85, // inches per driver (5m)
  },

  // Puck light specifications
  PUCK_LIGHTS: {
    SPACING: 24, // inches center-to-center
    HOLE_DIAMETER: 2.5, // inches
    WATTAGE_PER_UNIT: 4.0, // watts
  },

  // In-cabinet lighting (glass-front uppers)
  INTERIOR_LIGHTING: {
    STRIP_POSITION_FROM_FRONT: 2.0, // inches
    STRIP_POSITION_FROM_SIDE: 2.0, // inches
  },

  // Miter and return dimensions
  MITER_ANGLE: 45, // degrees
  RETURN_LENGTH: 1.0, // inches (wraps back 1")

  // SKU prices (for cost calculation)
  SKU_PRICES: {
    'LR-SQ-8': 28.50,
    'LR-OG-8': 32.75,
    'LED-TAPE-5M': 12.99,
    'LED-DRIVER': 24.99,
    'LED-CONNECTOR': 3.50,
    'LED-ENDCAP': 2.50,
    'PUCK-LIGHT-KIT': 89.99,
    'INTERIOR-LED-5M': 14.99,
  },

  // Clearance and exclusion rules
  HOOD_CLEARANCE: 6.0, // inches on each side of hood (no light rail)
  GLASS_DOOR_MIN_SPACING: 3.0, // inches for interior lighting access
};

/**
 * Generates a complete lighting automation plan for upper cabinet layout
 *
 * @param {Array<Object>} upperLayouts - Array of upper cabinet layout objects
 *   Each object: { wallId, cabinets: [...], runs: [...] }
 * @param {Object} prefs - User preferences
 *   - lightRailProfile: 'LR-SQ' | 'LR-OG'
 *   - ledType: 'tape' | 'puck' | 'none'
 *   - ledIntensity: 'standard' | 'high-output'
 *   - interiorLighting: boolean (for glass-front uppers)
 * @param {Object} options - Additional options
 *   - excludeHoodArea: boolean (default: true)
 *   - excludeGlassDoors: boolean (default: true)
 *   - calculateCost: boolean (default: false)
 *
 * @returns {Object} Lighting plan with sections:
 *   - lightRail: { runs: Array, totalLength, skusNeeded: Array }
 *   - ledPlan: { runs: Array, totalFeet, rolls, drivers, connectors, wattage }
 *   - puckLights: { positions: Array, count, wattage }
 *   - interiorLights: { runs: Array, totalFeet, rolls, wattage }
 *   - skus: Array of SKU objects with quantities
 *   - totalCost: number (if calculateCost enabled)
 */
export function generateLightingPlan(upperLayouts, prefs, options = {}) {
  const opts = {
    excludeHoodArea: options.excludeHoodArea !== false,
    excludeGlassDoors: options.excludeGlassDoors !== false,
    calculateCost: options.calculateCost ?? false,
  };

  const profile = LIGHTING_CONSTANTS.PROFILES[prefs.lightRailProfile] ||
    LIGHTING_CONSTANTS.PROFILES.LR_SQ;

  // Generate light rail runs
  const lightRailPlan = generateLightRailRuns(upperLayouts, profile, opts);

  // Generate LED requirements based on light rail
  let ledPlan = { runs: [], totalFeet: 0, rolls: 0, drivers: 0, connectors: 0, wattage: 0 };
  let puckLights = { positions: [], count: 0, wattage: 0 };

  if (prefs.ledType === 'tape') {
    ledPlan = generateLEDTapeRuns(lightRailPlan, prefs.ledIntensity || 'standard');
  } else if (prefs.ledType === 'puck') {
    puckLights = generatePuckLightPositions(upperLayouts, opts);
  }

  // Generate interior lighting for glass-front uppers
  const interiorLights = prefs.interiorLighting
    ? generateInteriorLighting(upperLayouts, opts)
    : { runs: [], totalFeet: 0, rolls: 0, wattage: 0 };

  // Compile SKU requirements
  const skus = compileSKUs(lightRailPlan, ledPlan, puckLights, interiorLights);

  // Calculate total cost if requested
  let totalCost = 0;
  if (opts.calculateCost) {
    totalCost = calculateTotalCost(skus);
  }

  return {
    lightRail: lightRailPlan,
    ledPlan,
    puckLights,
    interiorLights,
    skus,
    totalCost,
    metadata: {
      profile: profile.name,
      ledType: prefs.ledType || 'none',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generates light rail runs for all upper cabinets on all walls
 *
 * @param {Array<Object>} upperLayouts - Upper cabinet layouts by wall
 * @param {Object} profile - Light rail profile object (LR_SQ or LR_OG)
 * @param {Object} options - Processing options
 *
 * @returns {Object} Light rail plan:
 *   - runs: Array of light rail run objects
 *   - totalLength: Total inches
 *   - stockPiecesNeeded: Number of 8' stock pieces
 */
function generateLightRailRuns(upperLayouts, profile, options) {
  const runs = [];
  let totalLength = 0;

  for (const layout of upperLayouts) {
    if (!layout.cabinets || layout.cabinets.length === 0) continue;

    const wallRuns = generateWallLightRails(layout, profile, options);
    runs.push(...wallRuns);
    totalLength += wallRuns.reduce((sum, r) => sum + r.length, 0);
  }

  // Calculate stock pieces needed with waste factor
  const grossLength = totalLength * (1 + LIGHTING_CONSTANTS.WASTE_FACTOR);
  const stockPiecesNeeded = Math.ceil(grossLength / LIGHTING_CONSTANTS.STOCK_LENGTH);

  return {
    runs,
    totalLength: parseFloat(totalLength.toFixed(2)),
    grossLength: parseFloat(grossLength.toFixed(2)),
    stockPiecesNeeded,
    wasteAllowance: parseFloat((grossLength - totalLength).toFixed(2)),
  };
}

/**
 * Generates light rail runs for a single wall
 *
 * @param {Object} layout - Wall layout with cabinet data
 * @param {Object} profile - Light rail profile
 * @param {Object} options - Processing options
 *
 * @returns {Array<Object>} Array of light rail runs
 */
function generateWallLightRails(layout, profile, options) {
  const runs = [];
  const { cabinets } = layout;

  if (!cabinets || cabinets.length === 0) return runs;

  // Sort cabinets by position
  const sorted = [...cabinets].sort((a, b) => a.x - b.x);

  // Build continuous runs, breaking at exclusion zones (hoods, glass doors)
  let currentRun = null;

  for (let i = 0; i < sorted.length; i++) {
    const cab = sorted[i];

    // Skip cabinets that shouldn't have light rail
    if (shouldSkipLightRail(cab, options)) {
      if (currentRun) {
        // Finalize current run with returns and miters
        finalizeRun(currentRun, runs, profile);
        currentRun = null;
      }
      continue;
    }

    const cabStart = cab.x;
    const cabEnd = cab.x + cab.width;

    if (!currentRun) {
      // Start a new run
      currentRun = {
        wallId: layout.wallId,
        startPos: cabStart,
        endPos: cabEnd,
        cabinets: [cab],
        profile: profile.name,
      };
    } else {
      // Extend current run if continuous
      if (cabStart === currentRun.endPos) {
        currentRun.endPos = cabEnd;
        currentRun.cabinets.push(cab);
      } else {
        // Gap detected — finalize and start new run
        finalizeRun(currentRun, runs, profile);
        currentRun = {
          wallId: layout.wallId,
          startPos: cabStart,
          endPos: cabEnd,
          cabinets: [cab],
          profile: profile.name,
        };
      }
    }
  }

  // Finalize last run
  if (currentRun) {
    finalizeRun(currentRun, runs, profile);
  }

  return runs;
}

/**
 * Determines if a cabinet should skip light rail
 *
 * @param {Object} cabinet - Cabinet object
 * @param {Object} options - Processing options
 *
 * @returns {boolean} True if light rail should be skipped
 */
function shouldSkipLightRail(cabinet, options) {
  // Skip if cabinet has no upper component
  if (!cabinet.hasUpper) return true;

  // Skip if under range hood
  if (options.excludeHoodArea && cabinet.underHood) {
    return true;
  }

  // Skip if glass-front upper (lighting goes inside instead)
  if (options.excludeGlassDoors && cabinet.upperStyle === 'glass-front') {
    return true;
  }

  return false;
}

/**
 * Finalizes a light rail run with miter and return calculations
 *
 * @param {Object} run - Current run object
 * @param {Array} runsArray - Destination array for finalized runs
 * @param {Object} profile - Light rail profile
 */
function finalizeRun(run, runsArray, profile) {
  const length = run.endPos - run.startPos;

  // Determine miter/return requirements
  const miterLeft = run.cabinets[0].isLeftEdge || run.cabinets[0].x === 0;
  const miterRight = run.cabinets[run.cabinets.length - 1].isRightEdge;
  const returnLeft = miterLeft; // Return on exposed left end
  const returnRight = miterRight; // Return on exposed right end

  runsArray.push({
    wallId: run.wallId,
    startPos: run.startPos,
    endPos: run.endPos,
    length: parseFloat(length.toFixed(2)),
    profile: run.profile,
    miterLeft,
    miterRight,
    returnLeft,
    returnRight,
    cabinetCount: run.cabinets.length,
    description: `${run.profile} light rail: ${run.startPos.toFixed(2)}" to ${run.endPos.toFixed(2)}"`,
  });
}

/**
 * Generates LED tape runs based on light rail placement
 *
 * @param {Object} lightRailPlan - Light rail plan from generateLightRailRuns
 * @param {string} intensity - 'standard' or 'high-output'
 *
 * @returns {Object} LED tape requirements:
 *   - runs: Array of LED run objects
 *   - totalFeet: Total linear feet
 *   - rolls: Number of 5m rolls needed
 *   - drivers: Number of drivers needed
 *   - connectors: Total connectors
 *   - wattage: Total wattage
 */
function generateLEDTapeRuns(lightRailPlan, intensity = 'standard') {
  const runs = [];
  const wattagePerFoot = intensity === 'high-output'
    ? LIGHTING_CONSTANTS.LED_TAPE.HIGH_OUTPUT_WATTAGE
    : LIGHTING_CONSTANTS.LED_TAPE.STANDARD_WATTAGE;

  let totalFeet = 0;

  for (const railRun of lightRailPlan.runs) {
    // LED tape runs parallel to light rail, recessed 1" from front
    const ledLength = railRun.length;
    totalFeet += ledLength / 12; // Convert to feet

    // Determine if new driver needed (one per 5m / 16.4' of tape)
    const driverNeeded = runs.length === 0 ||
      (totalFeet % LIGHTING_CONSTANTS.LED_TAPE.ROLL_LENGTH / 12 < 0.5);

    runs.push({
      wallId: railRun.wallId,
      startPos: railRun.startPos,
      endPos: railRun.endPos,
      length: parseFloat((ledLength / 12).toFixed(2)), // feet
      recession: LIGHTING_CONSTANTS.LED_TAPE.RECESSION,
      intensity,
      driverNeeded,
      jumperTo: null,
      description: `LED tape (${intensity}): ${(ledLength / 12).toFixed(2)} ft`,
    });
  }

  // Calculate rolls, drivers, connectors
  const totalFeetRounded = parseFloat(totalFeet.toFixed(2));
  const rollLength = LIGHTING_CONSTANTS.LED_TAPE.ROLL_LENGTH / 12; // feet
  const rolls = Math.ceil(totalFeetRounded / rollLength);
  const drivers = runs.filter(r => r.driverNeeded).length;
  const connectors = (drivers - 1) + runs.length; // Inter-run + end connectors
  const wattage = parseFloat((totalFeetRounded * wattagePerFoot).toFixed(2));

  return {
    runs,
    totalFeet: totalFeetRounded,
    rolls,
    drivers,
    connectors,
    wattage,
    intensity,
  };
}

/**
 * Calculates LED tape requirements for given runs
 *
 * @param {Array<Object>} runs - Array of LED run objects with length property (feet)
 * @param {string} intensity - 'standard' or 'high-output'
 *
 * @returns {Object} LED requirements:
 *   - totalFeet: Total linear feet
 *   - rolls: Number of 5m rolls needed
 *   - drivers: Number of drivers needed
 *   - connectors: Total connectors
 *   - wattage: Total wattage
 */
export function calculateLEDRequirements(runs, intensity = 'standard') {
  if (!runs || runs.length === 0) {
    return {
      totalFeet: 0,
      rolls: 0,
      drivers: 0,
      connectors: 0,
      wattage: 0,
    };
  }

  const wattagePerFoot = intensity === 'high-output'
    ? LIGHTING_CONSTANTS.LED_TAPE.HIGH_OUTPUT_WATTAGE
    : LIGHTING_CONSTANTS.LED_TAPE.STANDARD_WATTAGE;

  const totalFeet = parseFloat(runs.reduce((sum, r) => sum + (r.length || 0), 0).toFixed(2));
  const rollLength = LIGHTING_CONSTANTS.LED_TAPE.ROLL_LENGTH / 12; // feet
  const rolls = Math.ceil(totalFeet / rollLength);
  const drivers = Math.ceil(totalFeet / (rollLength));
  const connectors = runs.length + drivers;
  const wattage = parseFloat((totalFeet * wattagePerFoot).toFixed(2));

  return {
    totalFeet,
    rolls,
    drivers,
    connectors,
    wattage,
    intensity,
  };
}

/**
 * Generates puck light positioning for under-cabinet lighting alternative
 *
 * @param {Array<Object>} upperLayouts - Upper cabinet layouts
 * @param {Object} options - Processing options
 *
 * @returns {Object} Puck light plan:
 *   - positions: Array of puck light positions
 *   - count: Total number of pucks
 *   - wattage: Total wattage
 */
function generatePuckLightPositions(upperLayouts, options) {
  const positions = [];
  let totalCount = 0;

  for (const layout of upperLayouts) {
    if (!layout.cabinets || layout.cabinets.length === 0) continue;

    for (const cab of layout.cabinets) {
      // Skip if shouldn't have lighting
      if (shouldSkipLightRail(cab, options)) continue;

      // Calculate puck positions along cabinet width
      const spacing = LIGHTING_CONSTANTS.PUCK_LIGHTS.SPACING;
      const cabWidth = cab.width;
      const puckCount = Math.floor(cabWidth / spacing) || 1;
      const actualSpacing = cabWidth / (puckCount + 1);

      for (let i = 1; i <= puckCount; i++) {
        const xPos = cab.x + (actualSpacing * i);

        positions.push({
          wallId: layout.wallId,
          cabinetId: cab.id,
          x: parseFloat(xPos.toFixed(2)),
          y: cab.y, // Top of cabinet
          holeDiameter: LIGHTING_CONSTANTS.PUCK_LIGHTS.HOLE_DIAMETER,
          holeDepth: 2.5, // Typical recessed mounting
          description: `Puck light in cabinet ${cab.id}`,
        });

        totalCount++;
      }
    }
  }

  const wattage = parseFloat((totalCount * LIGHTING_CONSTANTS.PUCK_LIGHTS.WATTAGE_PER_UNIT).toFixed(2));

  return {
    positions,
    count: totalCount,
    wattage,
    holesNeeded: totalCount,
  };
}

/**
 * Generates interior lighting for glass-front upper cabinets
 *
 * @param {Array<Object>} upperLayouts - Upper cabinet layouts
 * @param {Object} options - Processing options
 *
 * @returns {Object} Interior lighting plan:
 *   - runs: Array of interior LED runs
 *   - totalFeet: Total linear feet
 *   - rolls: Number of 5m rolls needed
 *   - wattage: Total wattage
 */
function generateInteriorLighting(upperLayouts, options) {
  const runs = [];
  let totalFeet = 0;

  for (const layout of upperLayouts) {
    if (!layout.cabinets || layout.cabinets.length === 0) continue;

    for (const cab of layout.cabinets) {
      // Only glass-front uppers get interior lighting
      if (cab.upperStyle !== 'glass-front' || !cab.hasUpper) continue;

      // Two vertical strips per cabinet (left and right sides, 2" from front)
      const stripHeight = (cab.height || 24) - 4; // Account for top/bottom clearance
      const feetPerStrip = stripHeight / 12;

      // Left strip
      runs.push({
        wallId: layout.wallId,
        cabinetId: cab.id,
        location: 'left',
        length: parseFloat(feetPerStrip.toFixed(2)),
        positionFromFront: LIGHTING_CONSTANTS.INTERIOR_LIGHTING.STRIP_POSITION_FROM_FRONT,
        positionFromSide: LIGHTING_CONSTANTS.INTERIOR_LIGHTING.STRIP_POSITION_FROM_SIDE,
        description: `Interior LED strip - cabinet ${cab.id} left side`,
      });

      // Right strip
      runs.push({
        wallId: layout.wallId,
        cabinetId: cab.id,
        location: 'right',
        length: parseFloat(feetPerStrip.toFixed(2)),
        positionFromFront: LIGHTING_CONSTANTS.INTERIOR_LIGHTING.STRIP_POSITION_FROM_FRONT,
        positionFromSide: LIGHTING_CONSTANTS.INTERIOR_LIGHTING.STRIP_POSITION_FROM_SIDE,
        description: `Interior LED strip - cabinet ${cab.id} right side`,
      });

      totalFeet += feetPerStrip * 2;
    }
  }

  const totalFeetRounded = parseFloat(totalFeet.toFixed(2));
  const rollLength = LIGHTING_CONSTANTS.LED_TAPE.ROLL_LENGTH / 12;
  const rolls = Math.ceil(totalFeetRounded / rollLength);
  const wattage = parseFloat((totalFeetRounded * LIGHTING_CONSTANTS.LED_TAPE.STANDARD_WATTAGE).toFixed(2));

  return {
    runs,
    totalFeet: totalFeetRounded,
    rolls,
    wattage,
    glassDoorsAffected: runs.length / 2, // Number of glass-door cabinets
  };
}

/**
 * Compiles all SKU requirements from lighting components
 *
 * @param {Object} lightRailPlan - Light rail plan
 * @param {Object} ledPlan - LED tape plan
 * @param {Object} puckLights - Puck light plan
 * @param {Object} interiorLights - Interior lighting plan
 *
 * @returns {Array<Object>} Array of SKU objects:
 *   - skuCode: SKU code
 *   - description: Item description
 *   - quantity: Number needed
 *   - unitPrice: Price per unit
 *   - totalPrice: Quantity * unitPrice
 */
function compileSKUs(lightRailPlan, ledPlan, puckLights, interiorLights) {
  const skus = [];

  // Light rail stock pieces
  if (lightRailPlan.stockPiecesNeeded > 0) {
    const profileCode = lightRailPlan.runs[0]?.profile === 'LR-OG' ? 'LR-OG-8' : 'LR-SQ-8';
    skus.push({
      skuCode: profileCode,
      description: `${profileCode} Light Rail (8' stock piece)`,
      quantity: lightRailPlan.stockPiecesNeeded,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES[profileCode] || 28.50,
      category: 'light-rail',
    });
  }

  // LED tape rolls
  if (ledPlan.rolls > 0) {
    skus.push({
      skuCode: 'LED-TAPE-5M',
      description: 'LED Tape Roll (5m / 16.4 ft)',
      quantity: ledPlan.rolls,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['LED-TAPE-5M'],
      category: 'led-tape',
    });
  }

  // LED drivers
  if (ledPlan.drivers > 0) {
    skus.push({
      skuCode: 'LED-DRIVER',
      description: 'LED Power Driver',
      quantity: ledPlan.drivers,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['LED-DRIVER'],
      category: 'led-accessories',
    });
  }

  // LED connectors
  if (ledPlan.connectors > 0) {
    skus.push({
      skuCode: 'LED-CONNECTOR',
      description: 'LED Tape Connector',
      quantity: ledPlan.connectors,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['LED-CONNECTOR'],
      category: 'led-accessories',
    });
  }

  // LED end caps
  if (ledPlan.runs.length > 0) {
    skus.push({
      skuCode: 'LED-ENDCAP',
      description: 'LED Tape End Cap',
      quantity: ledPlan.runs.length * 2, // Both ends
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['LED-ENDCAP'],
      category: 'led-accessories',
    });
  }

  // Puck lights
  if (puckLights.count > 0) {
    const puckKits = Math.ceil(puckLights.count / 4); // Typical kit has 4 pucks
    skus.push({
      skuCode: 'PUCK-LIGHT-KIT',
      description: 'Puck Light Kit (4-pack)',
      quantity: puckKits,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['PUCK-LIGHT-KIT'],
      category: 'puck-lights',
    });
  }

  // Interior LED tape rolls
  if (interiorLights.rolls > 0) {
    skus.push({
      skuCode: 'INTERIOR-LED-5M',
      description: 'Interior LED Tape Roll (5m / 16.4 ft)',
      quantity: interiorLights.rolls,
      unitPrice: LIGHTING_CONSTANTS.SKU_PRICES['INTERIOR-LED-5M'],
      category: 'interior-lighting',
    });
  }

  // Calculate total prices
  for (const sku of skus) {
    sku.totalPrice = parseFloat((sku.quantity * sku.unitPrice).toFixed(2));
  }

  return skus;
}

/**
 * Calculates total lighting cost
 *
 * @param {Array<Object>} skus - Array of SKU objects
 *
 * @returns {number} Total cost
 */
function calculateTotalCost(skus) {
  return parseFloat(
    skus.reduce((sum, sku) => sum + (sku.totalPrice || 0), 0).toFixed(2)
  );
}

/**
 * Validates lighting configuration against kitchen design rules
 *
 * @param {Object} lightingPlan - Complete lighting plan from generateLightingPlan
 * @param {Object} kitchenLayout - Kitchen layout object
 *
 * @returns {Object} Validation result:
 *   - valid: boolean
 *   - warnings: Array of warning messages
 *   - errors: Array of error messages
 */
export function validateLighting(lightingPlan, kitchenLayout) {
  const warnings = [];
  const errors = [];

  // Check for coverage gaps
  if (lightingPlan.lightRail.runs.length === 0) {
    warnings.push('No light rail runs generated — verify upper cabinet placement');
  }

  // Check LED coverage vs light rail
  if (lightingPlan.ledPlan.runs.length === 0 && lightingPlan.ledPlan.totalFeet > 0) {
    errors.push('LED tape runs calculated but not generated');
  }

  // Check puck light spacing
  for (const position of lightingPlan.puckLights.positions) {
    if (position.holeDiameter < 2.0 || position.holeDiameter > 3.0) {
      warnings.push(`Puck light hole diameter ${position.holeDiameter}" may not fit standard fixtures`);
    }
  }

  // Check interior lighting for glass cabinets
  if (lightingPlan.interiorLights.glassDoorsAffected > 0) {
    if (lightingPlan.interiorLights.runs.length < lightingPlan.interiorLights.glassDoorsAffected * 2) {
      warnings.push(`Interior lighting incomplete for ${lightingPlan.interiorLights.glassDoorsAffected} glass-front cabinets`);
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    warnings,
    errors,
  };
}

/**
 * Generates a summary report for lighting specifications
 *
 * @param {Object} lightingPlan - Complete lighting plan
 *
 * @returns {string} Formatted summary report
 */
export function generateLightingSummary(lightingPlan) {
  const lines = [];

  lines.push('=== LIGHTING AUTOMATION SUMMARY ===\n');

  // Light Rail Summary
  lines.push('LIGHT RAIL:');
  lines.push(`  Profile: ${lightingPlan.metadata.profile}`);
  lines.push(`  Total Length: ${lightingPlan.lightRail.totalLength}" (${(lightingPlan.lightRail.totalLength / 12).toFixed(2)} ft)`);
  lines.push(`  Runs: ${lightingPlan.lightRail.runs.length}`);
  lines.push(`  Stock Pieces (8' @ 10% waste): ${lightingPlan.lightRail.stockPiecesNeeded}`);
  lines.push('');

  // LED Plan Summary
  if (lightingPlan.ledPlan.totalFeet > 0) {
    lines.push('LED TAPE:');
    lines.push(`  Total Length: ${lightingPlan.ledPlan.totalFeet}' (${lightingPlan.ledPlan.totalFeet * 12}" inches)`);
    lines.push(`  Intensity: ${lightingPlan.ledPlan.intensity || 'standard'}`);
    lines.push(`  Rolls Needed: ${lightingPlan.ledPlan.rolls} (16.4' per roll)`);
    lines.push(`  Drivers: ${lightingPlan.ledPlan.drivers}`);
    lines.push(`  Connectors: ${lightingPlan.ledPlan.connectors}`);
    lines.push(`  Total Wattage: ${lightingPlan.ledPlan.wattage}W`);
    lines.push('');
  }

  // Puck Lights Summary
  if (lightingPlan.puckLights.count > 0) {
    lines.push('PUCK LIGHTS:');
    lines.push(`  Count: ${lightingPlan.puckLights.count}`);
    lines.push(`  Total Wattage: ${lightingPlan.puckLights.wattage}W`);
    lines.push('');
  }

  // Interior Lighting Summary
  if (lightingPlan.interiorLights.totalFeet > 0) {
    lines.push('INTERIOR LIGHTING (Glass-Front Uppers):');
    lines.push(`  Total Length: ${lightingPlan.interiorLights.totalFeet}' (${lightingPlan.interiorLights.totalFeet * 12}" inches)`);
    lines.push(`  Rolls Needed: ${lightingPlan.interiorLights.rolls}`);
    lines.push(`  Glass-Door Cabinets: ${lightingPlan.interiorLights.glassDoorsAffected}`);
    lines.push(`  Total Wattage: ${lightingPlan.interiorLights.wattage}W`);
    lines.push('');
  }

  // SKU Summary
  if (lightingPlan.skus.length > 0) {
    lines.push('MATERIALS REQUIRED:');
    for (const sku of lightingPlan.skus) {
      lines.push(`  ${sku.quantity}x ${sku.description}`);
    }
    lines.push('');
  }

  // Cost Summary
  if (lightingPlan.totalCost > 0) {
    lines.push(`TOTAL COST: $${lightingPlan.totalCost.toFixed(2)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export default {
  LIGHTING_CONSTANTS,
  generateLightingPlan,
  calculateLEDRequirements,
  validateLighting,
  generateLightingSummary,
};
