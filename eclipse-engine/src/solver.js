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
  fillSegment, validateLayout,
} from './constraints.js';

import {
  RANGE_PATTERNS, SINK_PATTERNS, FRIDGE_PATTERNS,
  ISLAND_PATTERNS, TALL_PATTERNS, UPPER_PATTERNS,
  PENINSULA_PATTERNS, OFFICE_PATTERNS, LAUNDRY_PATTERNS,
  VANITY_PATTERNS, UTILITY_PATTERNS,
  ACCESSORY_RULES,
} from './patterns.js';

import {
  assignCoordinates, autoWallConfig, exportForVisualization,
} from './coordinates.js';


// ─── INPUT SCHEMA ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} RoomInput
 * @property {string} layoutType - "l-shape" | "u-shape" | "galley" | "single-wall" | "g-shape" | "galley-peninsula"
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
 * @property {string} [role] - "range" | "sink" | "fridge" | "pantry" | "general"
 */

/**
 * @typedef {Object} ApplianceInput
 * @property {string} type - "range" | "cooktop" | "sink" | "dishwasher" | "refrigerator" | "wallOven" | "wineCooler"
 * @property {number} width - Appliance width in inches
 * @property {string} wall - Wall ID or "island"
 * @property {string} [model] - Model number
 * @property {string} [brand] - Brand name
 * @property {string} [position] - "center" | "left" | "right" | "end" | number (inches from left)
 */

/**
 * @typedef {Object} DesignPrefs
 * @property {string} [cornerTreatment] - "lazySusan" | "blindCorner" | "auto"
 * @property {string} [upperApproach] - "standard" | "floating_shelves" | "minimal" | "none" | "stacked"
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
  const layoutType = input.layoutType || inferLayoutType(walls, !!peninsula);
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
  };

  // Build appliance lookup
  const appByWall = {};
  const appByType = {};
  for (const app of appliances) {
    if (!appByWall[app.wall]) appByWall[app.wall] = [];
    appByWall[app.wall].push(app);
    appByType[app.type] = app;
  }

  // Phase 1: Resolve corners (skip for single-wall rooms like vanity)
  const corners = resolveCorners(walls, layoutType, pf);

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
  if (roomDef.appliancesRequired || pf.upperApproach !== "none") {
    for (const wl of wallLayouts) {
      const wallDef = walls.find(w => w.id === wl.wallId);
      const wallAppliances = appByWall[wallDef.id] || [];
      const uppers = solveUppers(wl, wallDef, wallAppliances, pf);
      upperLayouts.push(uppers);
    }
  }

  // Phase 4b: Generate upper corner cabinets (WSC pairs + SA angle transitions)
  const upperCorners = solveUpperCorners(corners, upperLayouts, pf, walls);

  // Phase 4c: Generate tall cabinets (oven towers, pantry towers)
  const talls = solveTalls(appliances, walls, pf, golaPrefix);

  // Phase 5: Generate accessories (room-type-aware)
  const accessories = generateAccessories(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, walls, appliances, pf);

  // Phase 6: Compile placements
  let placements = compilePlacements(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, accessories, talls, upperCorners);

  // Phase 6b: Resolve two-tone materials
  placements = resolveTwoTone(placements, pf);

  // Phase 7: Validate (pass roomType for context-aware validation)
  const validationInput = buildValidationInput(wallLayouts, islandLayout, appliances, corners, roomType, pf);
  const validation = validateLayout(validationInput);

  // Build materials metadata
  const materialsMetadata = buildMaterialsMetadata(placements, pf);

  // Calculate corner efficiency metrics
  const cornerEfficiencies = corners.map(c => c.efficiency);
  const avgEfficiency = cornerEfficiencies.length > 0
    ? Math.round(cornerEfficiencies.reduce((a, b) => a + b, 0) / cornerEfficiencies.length)
    : null;
  const cornerTypes = [...new Set(corners.map(c => c.type))];

  // Count wine coolers and beverage centers
  const totalWineCoolers = talls.filter(t => t.role === "wine_cooler").length;
  const totalBeverageCenters = talls.filter(t => t.role === "beverage_center").length;

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

  return {
    layoutType,
    roomType,
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
      lighting: accessories._lighting,
    },
  };
}


// ─── CORNER RESOLVER ────────────────────────────────────────────────────────

function resolveCorners(walls, layoutType, prefs) {
  const corners = [];

  if (layoutType === "single-wall" || layoutType === "galley") return corners;

  // Identify corner pairs based on layout type
  const pairs = [];
  if (layoutType === "l-shape" && walls.length >= 2) {
    pairs.push([walls[0].id, walls[1].id]);
  }
  if (layoutType === "u-shape" && walls.length >= 3) {
    pairs.push([walls[0].id, walls[1].id]);
    pairs.push([walls[1].id, walls[2].id]);
  }

  for (const [wA, wB] of pairs) {
    const wallA = walls.find(w => w.id === wA);
    const wallB = walls.find(w => w.id === wB);
    const treatment = selectCornerTreatment(wallA, wallB, prefs);
    const efficiency = scoreCornerEfficiency(treatment.type, wallA.length, wallB.length);
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
    const size = aLen >= 42 && bLen >= 42 ? 42 : 36;
    return {
      type: "halfMoon", sku: `BHM${size}R-SS`, size,
      wallAConsumption: size,
      wallBConsumption: size + 6,
      fillerRequired: true, fillerWidth: 3, patternId: "half_moon_explicit",
    };
  }
  if (prefs.cornerTreatment === "diagonalLazy" && aLen >= 36 && bLen >= 36) {
    return {
      type: "diagonalLazy", sku: "BDL36-SS", size: 36,
      wallAConsumption: 27, wallBConsumption: 27,
      fillerRequired: false, patternId: "diagonal_lazy_susan_explicit",
    };
  }
  if (prefs.cornerTreatment === "magicCorner" && aLen >= 42 && bLen >= 42) {
    const bbcWidth = aLen >= 48 ? 48 : 42;
    return {
      type: "magicCorner", sku: `BBC${bbcWidth}R-MC`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: bbcWidth + 4 + 3,
      fillerRequired: true, fillerWidth: 3, patternId: "magic_corner_explicit",
    };
  }
  if (prefs.cornerTreatment === "quarterTurn" && aLen >= 42 && bLen >= 42) {
    const bbcWidth = aLen >= 48 ? 48 : 42;
    return {
      type: "quarterTurnShelves", sku: `BBC${bbcWidth}R-S`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: bbcWidth + 4 + 3,
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

  // Auto selection — sophistication + budget driven
  if (prefs.cornerTreatment === "auto" || prefs.cornerTreatment === "blindCorner") {
    // Very high sophistication: magic corner (Bollini BBC48R-MC at $3,938)
    if (prefs.cornerTreatment === "auto" && prefs.sophistication === "very_high" && aLen >= 42 && bLen >= 42) {
      const bbcWidth = aLen >= 48 ? 48 : 42;
      return {
        type: "magicCorner", sku: `BBC${bbcWidth}R-MC`, size: bbcWidth,
        wallAConsumption: bbcWidth,
        wallBConsumption: bbcWidth + 4 + 3,
        fillerRequired: true, fillerWidth: 3, patternId: "magic_corner_auto",
      };
    }

    // High sophistication with large walls: half-moon corner (between magic and lazy susan)
    if (prefs.cornerTreatment === "auto" && prefs.sophistication === "high" && aLen >= 42 && bLen >= 42) {
      const size = 42;
      return {
        type: "halfMoon", sku: `BHM${size}R-SS`, size,
        wallAConsumption: size,
        wallBConsumption: size + 6,
        fillerRequired: true, fillerWidth: 3, patternId: "half_moon_auto",
      };
    }

    // High sophistication with smaller walls: lazy susan when walls allow (Lofton, Alix pattern)
    if (prefs.cornerTreatment === "auto" && prefs.sophistication === "high" && aLen >= 36 && bLen >= 36) {
      return {
        type: "lazySusan", sku: "BL36-SS-PH", size: 36,
        wallAConsumption: 36, wallBConsumption: 36,
        fillerRequired: false, patternId: "lazy_susan_auto",
      };
    }

    // Standard sophistication + small to medium walls: diagonal lazy susan
    if (prefs.cornerTreatment === "auto" && prefs.sophistication === "standard" && aLen >= 36 && aLen <= 48 && bLen >= 36 && bLen <= 48) {
      return {
        type: "diagonalLazy", sku: "BDL36-SS", size: 36,
        wallAConsumption: 27, wallBConsumption: 27,
        fillerRequired: false, patternId: "diagonal_lazy_susan_auto",
      };
    }

    // Standard sophistication + adequate walls: quarter-turn shelves (Bissegger BBC42R-S)
    if (prefs.cornerTreatment === "auto" && prefs.sophistication === "standard" && aLen >= 42 && bLen >= 42) {
      return {
        type: "quarterTurnShelves", sku: `BBC42R-S`, size: 42,
        wallAConsumption: 42, wallBConsumption: 49,
        fillerRequired: true, fillerWidth: 3, patternId: "quarter_turn_auto",
      };
    }

    // Default blind corner
    const bbcWidth = aLen >= 48 ? 42 : aLen >= 42 ? 39 : 36;
    return {
      type: "blindCorner", sku: `BBC${bbcWidth}`, size: bbcWidth,
      wallAConsumption: bbcWidth,
      wallBConsumption: bbcWidth + 4 + 3,
      fillerRequired: true, fillerWidth: 3, patternId: "blind_corner_default",
    };
  }

  // Fallback
  return {
    type: "blindCorner", sku: "BBC42", size: 42,
    wallAConsumption: 42, wallBConsumption: 49,
    fillerRequired: true, fillerWidth: 3, patternId: "blind_corner_fallback",
  };
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
        cabinets.push({ sku: `F3${Math.round(DIMS.baseHeight)}0`, width: corner.fillerWidth, role: "corner-filler", position: "left", wall: wall.id });
      }
    }
  }
  availableLength -= leftConsumed + rightConsumed;

  // Sort appliances by position (or infer positioning)
  const positioned = positionAppliances(appliances, availableLength, leftConsumed, wall, prefs);

  // Build segments between fixed points
  const segments = buildSegments(positioned, availableLength, leftConsumed);

  // Fill each segment with appropriate cabinets
  for (const seg of segments) {
    const filled = fillWallSegment(seg, role, prefs, golaPrefix);
    cabinets.push(...filled);
  }

  // Insert appliance placeholders
  for (const app of positioned) {
    cabinets.push({
      type: "appliance",
      applianceType: app.type,
      width: app.width,
      model: app.model,
      position: app.position,
      wall: wall.id,
    });
  }

  // Sort by position
  cabinets.sort((a, b) => (a.position || 0) - (b.position || 0));

  return {
    wallId: wall.id,
    wallLength: wall.length,
    role,
    cabinets,
    corners: corners.map(c => c.id),
    availableAfterCorners: availableLength,
  };
}


// ─── APPLIANCE POSITIONING ──────────────────────────────────────────────────

function positionAppliances(appliances, available, offset, wall, prefs) {
  const positioned = [];

  for (const app of appliances) {
    let pos;

    if (typeof app.position === "number") {
      pos = app.position;
    } else if (app.position === "center" || (app.type === "range" && prefs.preferSymmetry)) {
      pos = offset + (available - app.width) / 2;
    } else if (app.position === "end" || app.type === "refrigerator") {
      pos = offset + available - app.width;
    } else if (app.type === "sink" && wall.openings?.find(o => o.type === "window")) {
      // Center sink under window
      const win = wall.openings.find(o => o.type === "window");
      pos = win.posFromLeft - app.width / 2 + win.width / 2;
    } else {
      // Default: position based on type priority
      pos = offset + LANDING.sink.primary; // leave landing area
    }

    positioned.push({ ...app, position: Math.round(pos) });
  }

  // Ensure DW is adjacent to sink
  const sink = positioned.find(a => a.type === "sink");
  const dw = positioned.find(a => a.type === "dishwasher");
  if (sink && dw) {
    // Place DW immediately right of sink (or left if not enough space)
    const sinkRight = sink.position + sink.width;
    if (sinkRight + dw.width <= offset + available) {
      dw.position = sinkRight;
    } else {
      dw.position = sink.position - dw.width;
    }
    dw.adjacentToSink = true;
  }

  return positioned.sort((a, b) => a.position - b.position);
}


// ─── SEGMENT BUILDER ────────────────────────────────────────────────────────

function buildSegments(positionedAppliances, available, offset) {
  const segments = [];
  let cursor = offset;

  for (const app of positionedAppliances) {
    if (app.position > cursor + 0.5) {
      segments.push({
        start: cursor,
        end: app.position,
        length: Math.round(app.position - cursor),
        leftOf: app.type,
        rightOf: null,
      });
    }
    cursor = app.position + app.width;
  }

  // Remaining space after last appliance
  const endPos = offset + available;
  if (endPos > cursor + 0.5) {
    segments.push({
      start: cursor,
      end: endPos,
      length: Math.round(endPos - cursor),
      leftOf: null,
      rightOf: positionedAppliances.length > 0 ? positionedAppliances[positionedAppliances.length - 1].type : null,
    });
  }

  return segments;
}


// ─── SEGMENT FILLER ─────────────────────────────────────────────────────────

function fillWallSegment(segment, wallRole, prefs, golaPrefix) {
  const { length, leftOf, rightOf } = segment;
  if (length < 3) return []; // too small for any cabinet

  // Determine zone — room-type-aware
  const zone = classifyZone(leftOf, rightOf, wallRole, prefs.roomType);

  // Pattern-aware cabinet selection for range flanking zones
  const rangePattern = selectRangePattern(zone, length, prefs);
  const sinkPattern = selectSinkPattern(zone, length, leftOf, rightOf, prefs);

  // Select cabinet type based on zone + pattern intelligence
  const cabType = selectCabinetType(zone, prefs, golaPrefix, rangePattern, sinkPattern);

  // Fill with stock widths
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
      position: pos,
      modified: result.modified && w === result.modified.modified ? result.modified : null,
      patternId: patternNote,
    });
    pos += w;
  }

  // Add filler if needed
  if (result.filler > 0 && result.filler >= 3) {
    cabinets.push({
      sku: FILLER_RULES.standardFillerSkus[result.filler <= 3 ? 3 : 6] || "F330",
      width: result.filler,
      type: "filler",
      role: "filler",
      position: pos,
    });
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

  // Pattern-driven: range pattern may override to heavy-duty or specialty
  if (rangePattern && zone === "rangeFlanking") {
    if (rangePattern.id === "heavy_duty_drawer_flank") return golaPrefix + "B2HD";
    if (rangePattern.id === "2tier_drawer_flank") return golaPrefix + "FC-B2TD";
    if (rangePattern.id === "roll_out_tray_flank") return golaPrefix + "B-RT";
    // Default: drawer base for range flanking
    return golaPrefix + "B3D";
  }

  // Pattern-driven: sink pattern may override to waste/specialty
  if (sinkPattern && zone === "sinkAdjacent") {
    return golaPrefix + "B3D";
  }

  if (prefs.preferDrawerBases && (zone === "rangeFlanking" || zone === "sinkAdjacent" || zone === "general")) {
    // Training data: most projects use drawer bases in these zones
    return golaPrefix + "B3D";
  }

  return golaPrefix + (preferred[0] || "B3D");
}


// ─── SKU BUILDER ────────────────────────────────────────────────────────────

function buildSku(cabType, width, golaPrefix) {
  // Handle half-widths
  const wStr = width % 1 === 0 ? `${width}` : `${Math.floor(width)} 1/2`;

  // B3D, B4D, B — just append width
  if (cabType.endsWith("B3D") || cabType.endsWith("B4D")) {
    return `${cabType}${wStr}`;
  }
  if (cabType.endsWith("B")) {
    return `${cabType}${wStr}`;
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

  const ceilingH = wallDef.ceilingHeight || DIMS.standardCeiling;
  const upperH = selectUpperHeight(ceilingH, prefs);

  // ── Pattern-driven upper selection ──
  const wallRole = wallDef.role || "general";
  const pattern = selectUpperPattern(wallRole, prefs, ceilingH);
  const patternId = pattern?.id || null;

  // Find zones to skip (above range = hood zone, above windows)
  const skipZones = [];
  for (const app of wallAppliances) {
    if (app.type === "range" || app.type === "cooktop") {
      skipZones.push({ start: app.position, end: app.position + app.width, reason: "range_hood" });
    }
  }
  if (wallDef.openings) {
    for (const op of wallDef.openings) {
      if (op.type === "window") {
        skipZones.push({ start: op.posFromLeft, end: op.posFromLeft + op.width, reason: "window" });
      }
    }
  }

  // Generate uppers aligned with base cabinets below
  const uppers = [];
  const baseCabs = wallLayout.cabinets.filter(c => c.type === "base");

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
      uppers.push({
        sku: `RH21 ${rangeApp.width}24`,
        width: rangeApp.width,
        height: 24,
        type: "rangeHood",
        position: rangeApp.position,
        wall: wallDef.id,
        role: "range_hood",
      });
    }
    return { wallId: wallDef.id, cabinets: uppers, patternId };
  }

  // ── Stacked uppers pattern (tall ceilings) ──
  const isStacked = patternId === "stacked_uppers" || patternId === "stacked_wall_deep";
  const stackedTopH = ceilingH >= 120 ? 21 : 15;

  // ── Glass display wall (very_high sophistication) ──
  const isGlassDisplay = patternId === "stacked_glass_display_wall";

  // ── Wall garage pocket doors ──
  const isGarage = patternId === "wall_garage_pocket_doors";

  // ── Glass front display mods (GFD + FINISHED INT + PWL) ──
  // Applied to select uppers at very_high or high sophistication with premium aesthetic
  const soph = prefs.sophistication || "high";
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
  const glassStyleConfig = selectGlassStyle(prefs);

  for (let cabIdx = 0; cabIdx < baseCabs.length; cabIdx++) {
    const base = baseCabs[cabIdx];
    // Check if this position should be skipped
    const skip = skipZones.find(z => base.position >= z.start && base.position < z.end);
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
      const garageDoorStyle = prefs.garageDoorStyle || "standard";
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

  // ── FWEP flush wall end panels for glass display walls ──
  // Bollini pattern: FWEP flanks the display run at first and last positions
  if (isGlassDisplay && uppers.length > 0) {
    const displayCabs = uppers.filter(c => c.type === "wall_glass_display");
    if (displayCabs.length > 0) {
      const firstDisplay = displayCabs[0];
      const lastDisplay = displayCabs[displayCabs.length - 1];
      // Left FWEP before first display cab
      uppers.push({
        sku: "FWEP",
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
        sku: "FWEP",
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
  const rangeApp = wallAppliances.find(a => a.type === "range" || a.type === "cooktop");
  if (rangeApp) {
    // Premium/very_high sophistication with large range (≥42"): use RH50 large hood
    const isLargeRange = rangeApp.width >= 42;
    const useLargeHood = isLargeRange && (soph === "very_high" || soph === "high");
    if (useLargeHood) {
      uppers.push({
        sku: `RH50 ${rangeApp.width}4224`,
        width: rangeApp.width,
        height: 42,
        depth: 24,
        type: "rangeHood",
        position: rangeApp.position,
        wall: wallDef.id,
        role: "range_hood",
        variant: "large",
      });
      // Flanking WND display shelves for large hoods (Showroom ECLD pattern)
      if (soph === "very_high") {
        uppers.push({
          sku: `WND2112`,
          width: 21,
          height: 12,
          type: "wall_display",
          position: rangeApp.position - 21,
          wall: wallDef.id,
          role: "range_hood_flanking",
          side: "left",
        });
        uppers.push({
          sku: `WND2112`,
          width: 21,
          height: 12,
          type: "wall_display",
          position: rangeApp.position + rangeApp.width,
          wall: wallDef.id,
          role: "range_hood_flanking",
          side: "right",
        });
      }
    } else {
      uppers.push({
        sku: `RH21 ${rangeApp.width}24`,
        width: rangeApp.width,
        height: 24,
        type: "rangeHood",
        position: rangeApp.position,
        wall: wallDef.id,
        role: "range_hood",
      });
    }
  }

  return { wallId: wallDef.id, cabinets: uppers, patternId };
}

function selectUpperHeight(ceilingH, prefs) {
  if (prefs.upperApproach === "floating_shelves") return 3; // floating shelf height

  const aboveUpper = ceilingH - DIMS.upperBottom;

  if (ceilingH >= 120) return 42; // 10ft ceiling: stacked or tall uppers
  if (ceilingH >= 108) return 42; // 9ft ceiling
  if (aboveUpper >= 42) return 42;
  if (aboveUpper >= 39) return 39;
  if (aboveUpper >= 36) return 36;
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

    // Standard WSC: 24" × upperH, pie-hinged L+R pair
    upperCorners.push({
      sku: `WSC24${upperH}-PHL`,
      width: 24,
      height: upperH,
      type: "wall_corner",
      role: "upper_corner",
      wall: `${corner.wallA}-${corner.wallB}`,
      patternId: "wall_square_corner",
      side: "left",
    });
    upperCorners.push({
      sku: `WSC24${upperH}-PHR`,
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
        depth = 27;
        sku = `${golaPrefix}FIO${ovenWidth}${height}-${depth}`;
      } else if (pattern.id === "oven_micro_tower") {
        // OM pattern: oven + microwave combo tower
        height = 96;
        depth = 27;
        sku = `${golaPrefix}OM${ovenWidth}${height}`;
      } else {
        // Standard oven tower (O pattern)
        height = 84;
        depth = 24;
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

  // Pantry demand: explicit pantry wall OR large kitchens with no dedicated pantry get one
  const hasPantryWall = walls.some(w => w.role === "pantry");
  const hasPantryAppliance = appliances.some(a => a.type === "pantry");
  // Also add pantry tower if layout has enough perimeter and room type is kitchen
  const totalPerimeter = walls.reduce((s, w) => s + (w.length || 0), 0);
  const isKitchen = prefs.roomType === "kitchen" || !prefs.roomType;
  const largeFamilyKitchen = isKitchen && totalPerimeter >= 360;

  if (hasPantryWall || hasPantryAppliance || largeFamilyKitchen) {
    const pattern = selectTallPattern("pantry", prefs);

    if (pattern) {
      const pantryWall = walls.find(w => w.role === "pantry")?.id
        || walls.find(w => w.role === "fridge")?.id
        || walls[walls.length - 1]?.id
        || "pantry";

      let sku, height, width, depth;

      if (pattern.id === "ntk_utility_tower") {
        // NTK: no toe kick utility tower (Bennet pattern)
        width = 24;
        height = 96;
        depth = 24;
        sku = `${golaPrefix}NTK${width}${height}`;
      } else {
        // Standard utility/pantry tower
        width = 24;
        height = 96;
        depth = 24;
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
    // Height: space between fridge top (~70") and panel top
    // Fridge height is typically ~70", so RW height fills remaining
    const fridgeH = fridgeApp.height || 70;
    const rwH = Math.max(12, Math.min(24, panelH - fridgeH - 3)); // 3" clearance
    const rwD = Math.min(panelD, 27); // RW depth matches or shallower than panel

    talls.push({
      sku: `RW${fridgeWidth}${rwH}${rwD !== 24 ? `-${rwD}` : ""}`,
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
      depth: 24,
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
      depth: 24,
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
    // Range island: B3D + RANGE + BPOS-12 + B-RT
    const leftWidth = Math.min(36, Math.floor((length - rangeApp.width) * 0.4));
    const rightWidth = length - rangeApp.width - leftWidth - 12;
    workCabs.push({ sku: `${golaPrefix}B3D${leftWidth}`, width: leftWidth, role: "rangeFlanking" });
    workCabs.push({ type: "appliance", applianceType: "range", width: rangeApp.width });
    workCabs.push({ sku: `${golaPrefix}BPOS-12`, width: 12, role: "rangeFlanking" });
    if (rightWidth >= 15) {
      workCabs.push({ sku: `${golaPrefix}B${rightWidth}-RT`, width: rightWidth, role: "rangeFlanking" });
    }
  } else if (sinkApp) {
    // Sink island
    const sinkW = sinkApp.width || 36;
    const dwW = dwApp ? 24 : 0;
    const wasteW = 18;
    const drawerSpace = length - sinkW - dwW - wasteW;
    const leftDrawer = Math.min(30, Math.floor(drawerSpace / 2));
    const rightDrawer = drawerSpace - leftDrawer;

    if (leftDrawer >= 15) workCabs.push({ sku: `${golaPrefix}B3D${leftDrawer}`, width: leftDrawer, role: "sinkAdjacent" });
    if (dwApp) workCabs.push({ type: "appliance", applianceType: "dishwasher", width: dwW });
    workCabs.push({ sku: `${golaPrefix}SB${sinkW}`, width: sinkW, role: "sink-base" });
    workCabs.push({ sku: `${golaPrefix}BWDMA18`, width: wasteW, role: "waste" });
    if (rightDrawer >= 15) workCabs.push({ sku: `${golaPrefix}B3D${rightDrawer}`, width: rightDrawer, role: "sinkAdjacent" });
  } else {
    // Drawer island
    const fillResult = fillSegment(length, STD_BASE_WIDTHS.filter(w => w >= 24 && w <= 36));
    for (const w of fillResult.cabinets) {
      workCabs.push({ sku: `${golaPrefix}B3D${w}`, width: w, role: "island-drawer" });
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
        depth: 13,
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

function generateAccessories(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, walls, appliances, prefs) {
  const accessories = [];
  const roomDef = prefs.roomDef || ROOM_TYPES.kitchen;
  let totalEndPanels = 0;
  let totalFillers = 0;

  // Minimum cabinet width threshold for filler generation
  const MIN_CAB_WIDTH = 9;
  const MAX_GAP_FOR_FILLER = 12; // gaps > 9" but < this use filler

  // Toe kick — skip for floating vanities
  const hasFloatingVanity = roomDef.specialCabinets?.includes("FLVSB");
  const totalBaseRunLF = wallLayouts.reduce((sum, w) => {
    return sum + w.cabinets.filter(c => c.type === "base").reduce((s, c) => s + (c.width || 0), 0);
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
  }

  // Sub rail for wall cabs (only when uppers are present)
  if (prefs.upperApproach !== "none" && prefs.upperApproach !== "minimal") {
    const totalUpperRunLF = wallLayouts.reduce((sum, w) => sum + w.wallLength, 0);
    if (totalUpperRunLF > 0) {
      const srLengths = Math.ceil(totalUpperRunLF / 120); // 10ft lengths
      accessories.push({ sku: "3SRM3F-10'", qty: srLengths, role: "sub-rail" });
    }
  }

  // End panels and fillers at exposed run ends (base cabinets)
  for (const wl of wallLayouts) {
    const baseCabs = wl.cabinets.filter(c => c.type === "base");
    if (baseCabs.length > 0) {
      const first = baseCabs[0];
      const last = baseCabs[baseCabs.length - 1];
      const hasLeftCorner = wl.corners.some(c => corners.find(cr => cr.id === c && cr.wallB === wl.wallId));
      const hasRightCorner = wl.corners.some(c => corners.find(cr => cr.id === c && cr.wallA === wl.wallId));

      // For vanity rooms, use BEP (base end panel) with flush toe kick
      const endPanelPrefix = (prefs.roomType === "vanity" || prefs.roomType === "master_bath")
        ? "BEP1 1/2" : "FBEP 3/4-FTK";

      if (!hasLeftCorner && first.position <= 6) {
        accessories.push({ sku: `${endPanelPrefix}-L`, wall: wl.wallId, role: "base-end-panel-left" });
        totalEndPanels++;
      }
      if (!hasRightCorner) {
        // Check for gap between last cabinet and wall
        const lastCabEnd = last.position + (last.width || 0);
        const gapToWall = wl.wallLength - lastCabEnd;

        // Generate end panel at exposed right
        accessories.push({ sku: `${endPanelPrefix}-R`, wall: wl.wallId, role: "base-end-panel-right" });
        totalEndPanels++;

        // Generate filler strip if gap exists and is appropriate for filler
        if (gapToWall > 0.5 && gapToWall < MAX_GAP_FOR_FILLER && gapToWall >= 3) {
          const fillerW = Math.round(gapToWall);
          // Filler SKU format: F{height}0 where height is standard cabinet height (34.5")
          accessories.push({
            sku: `F${fillerW}0`,
            width: fillerW,
            wall: wl.wallId,
            role: "base-filler-wall-gap",
            position: lastCabEnd,
          });
          totalFillers++;
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

        // FWEP3/4 for wall end panels (from patterns.js endPanels definition)
        const wallEndPanelSku = "FWEP3/4";

        if (!hasLeftCorner && first.position <= 6) {
          accessories.push({ sku: `${wallEndPanelSku}-L`, wall: ul.wallId, role: "wall-end-panel-left" });
          totalEndPanels++;
        }
        if (!hasRightCorner) {
          accessories.push({ sku: `${wallEndPanelSku}-R`, wall: ul.wallId, role: "wall-end-panel-right" });
          totalEndPanels++;
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

  // Crown moulding — runs along top of upper cabinets
  // Only at very_high sophistication (always include), or when explicitly requested
  const crownMouldingRequested = prefs.crownMoulding === true;
  const crownMouldingExcluded = prefs.crownMoulding === false;
  const sophVeryHigh = prefs.sophistication === "very_high";
  const shouldAddCrown = (sophVeryHigh || crownMouldingRequested) && !crownMouldingExcluded;

  if (shouldAddCrown && upperLayouts.length > 0) {
    // Calculate total linear feet of upper cabinet runs
    const totalUpperLF = upperLayouts.reduce((sum, ul) => {
      const totalWidth = (ul.cabinets || []).reduce((s, c) => s + (c.width || 0), 0);
      return sum + totalWidth;
    }, 0);

    if (totalUpperLF > 0) {
      // Crown moulding sold in 8ft lengths
      const crownQty = Math.ceil(totalUpperLF / 96);
      const crownStyle = prefs.crownStyle || "standard";
      const crownSku = `CRN-${crownStyle}-8'`;
      accessories.push({
        sku: crownSku,
        qty: crownQty,
        role: "accessory",
        subrole: "crown-moulding",
        linearFeet: totalUpperLF,
      });
    }
  }

  // Light rail — trim strip under upper cabinets (holds under-cabinet lighting)
  // Only at high or very_high sophistication, or when explicitly requested
  const lightRailRequested = prefs.lightRail === true;
  const lightRailExcluded = prefs.lightRail === false;
  const sophHighOrVeryHigh = prefs.sophistication === "high" || prefs.sophistication === "very_high";
  const shouldAddLightRail = (sophHighOrVeryHigh || lightRailRequested) && !lightRailExcluded;

  if (shouldAddLightRail && upperLayouts.length > 0) {
    // Calculate total linear feet of upper cabinet runs (same as crown)
    const totalUpperLF = upperLayouts.reduce((sum, ul) => {
      const totalWidth = (ul.cabinets || []).reduce((s, c) => s + (c.width || 0), 0);
      return sum + totalWidth;
    }, 0);

    if (totalUpperLF > 0) {
      // Light rail sold in 8ft lengths
      const lightRailQty = Math.ceil(totalUpperLF / 96);
      accessories.push({
        sku: "LR-8'",
        qty: lightRailQty,
        role: "accessory",
        subrole: "light-rail",
        linearFeet: totalUpperLF,
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
  const shouldAddLightBridge = (sophVeryHighForLightBridge || lightBridgeRequested) && !lightBridgeExcluded;

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
  if (appliances && appliances.length > 0) {
    for (const app of appliances) {
    if (app.type === "dishwasher" && app.panelReady) {
      const dwWidth = Math.round(app.width || 24);
      accessories.push({
        sku: `DWP-${dwWidth}`,
        width: dwWidth,
        role: "appliance_panel",
        type: "dw_panel",
        appliance: "dishwasher",
      });
    }

    if (app.type === "refrigerator" && app.panelReady) {
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

  const soph = prefs.sophistication || "high";

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

  const soph = prefs.sophistication || "high";

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
  const soph = prefs.sophistication || "high";
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

  // High sophistication with tall ceilings: stacked uppers
  if (soph === "high" && ceilingHeight >= 108) {
    return UPPER_PATTERNS.find(u => u.id === "stacked_uppers") || null;
  }

  // Standard wall cabs + appliance garage
  if (approach === "stacked") {
    return UPPER_PATTERNS.find(u => u.id === "stacked_wall_deep") || null;
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

  // Drawer + pullout flank: last position gets BPOS for spice pullout
  if (pattern.id === "drawer_plus_pullout_flank") {
    if (width <= 12 && index === totalCabs - 1) {
      return `${golaPrefix}BPOS-${width}`;
    }
    // Pair with roll-out tray base for the other positions
    if (index > 0 && totalCabs > 2) {
      return `${golaPrefix}B${width}-RT`;
    }
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

function inferLayoutType(walls, hasPeninsula = false) {
  if (walls.length === 1 && !hasPeninsula) return "single-wall";
  if (walls.length === 1 && hasPeninsula) return "single-wall-peninsula";
  if (walls.length === 2 && !hasPeninsula) return "l-shape";
  if (walls.length === 2 && hasPeninsula) return "galley-peninsula";
  if (walls.length === 3) return "u-shape";
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

function compilePlacements(wallLayouts, upperLayouts, islandLayout, peninsulaLayout, corners, accessories, talls = [], upperCorners = []) {
  const placements = [];

  // Corner cabs
  for (const corner of corners) {
    placements.push({
      sku: corner.sku,
      type: "corner",
      role: "corner",
      wall: `${corner.wallA}-${corner.wallB}`,
      width: corner.size,
    });
  }

  // Wall base cabs
  for (const wl of wallLayouts) {
    for (const cab of wl.cabinets) {
      if (cab.type !== "appliance") {
        placements.push({ ...cab, wall: wl.wallId });
      }
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

  // Island cabs
  if (islandLayout) {
    for (const cab of islandLayout.workSide) {
      if (cab.type !== "appliance") {
        placements.push({ ...cab, wall: "island-work" });
      }
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

  return placements;
}

function buildValidationInput(wallLayouts, islandLayout, appliances, corners, roomType, prefs) {
  // Calculate appliance positions and clearances from wall layouts
  const appWithPositions = appliances.map(app => {
    let x = 0, y = 0;
    // Find appliance in wall layout to get position
    for (const wall of wallLayouts) {
      if (wall.wallId === app.wall) {
        // Estimate position based on appliance width and wall layout
        let runPosition = 0;
        for (const cab of wall.cabinets || []) {
          if (cab.appliance && cab.appliance.type === app.type) {
            x = runPosition;
            break;
          }
          runPosition += cab.width || 0;
        }
      }
    }
    return {
      ...app,
      x,
      y,
      leftClearance: 0,
      rightClearance: 0,
      handleSideClearance: 0,
      adjacentToSink: app.adjacentToSink || false,
    };
  });

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
    // Default measurements (can be overridden by specific layout data)
    counterHeight: 36,           // Standard 36", ADA max 34"
    upperCabBottomHeight: 54,    // Standard 54", ADA max 48"
    walkwayClearance: 36,        // Standard minimum
    toeKickHeight: 4.5,          // Standard 4.5", ADA 9"
  };
}

export function scoreAgainstTraining(result) {
  if (!result || !result.walls) return { confidence: 0, bestMatch: 'N/A', matches: [] };
  const placements = result.walls.flatMap(w => w.placements || []);
  const totalCabs = placements.length;
  const hasIsland = !!(result.island && result.island.placements && result.island.placements.length > 0);
  const wallCount = result.walls.length;
  const layoutType = result.layoutType || (wallCount >= 3 ? 'u-shape' : wallCount === 2 ? 'l-shape' : 'single-wall');
  const isGola = !!(result.prefs && result.prefs.golaChannel);
  const trainingProjects = [
    { name: 'Project 1 \u2013 L-Shape Traditional', layout: 'l-shape', cabRange: [20, 35], island: false, gola: false },
    { name: 'Project 2 \u2013 U-Shape Gola', layout: 'u-shape', cabRange: [30, 50], island: true, gola: true },
    { name: 'Project 3 \u2013 Galley Modern', layout: 'galley', cabRange: [18, 30], island: false, gola: false },
    { name: 'Project 4 \u2013 L-Shape + Island', layout: 'l-shape', cabRange: [25, 45], island: true, gola: false },
    { name: 'Project 5 \u2013 Single Wall Compact', layout: 'single-wall', cabRange: [8, 18], island: false, gola: false },
    { name: 'Project 6 \u2013 Peninsula Layout', layout: 'peninsula', cabRange: [22, 38], island: true, gola: false },
    { name: 'Project 7 \u2013 U-Shape Traditional', layout: 'u-shape', cabRange: [28, 48], island: false, gola: false },
  ];
  const scored = trainingProjects.map(tp => {
    let s = 0;
    if (tp.layout === layoutType) s += 40;
    else if ((tp.layout === 'l-shape' && layoutType === 'u-shape') || (tp.layout === 'u-shape' && layoutType === 'l-shape')) s += 20;
    if (totalCabs >= tp.cabRange[0] && totalCabs <= tp.cabRange[1]) s += 30;
    else { const dist = Math.min(Math.abs(totalCabs - tp.cabRange[0]), Math.abs(totalCabs - tp.cabRange[1])); s += Math.max(0, 30 - dist * 3); }
    if (tp.island === hasIsland) s += 20;
    if (tp.gola === isGola) s += 10;
    return { name: tp.name, score: Math.min(100, s) };
  });
  scored.sort((a, b) => b.score - a.score);
  return {
    confidence: scored[0].score,
    bestMatch: scored[0].name,
    matches: scored,
    golaCompliance: isGola ? { isGola: true, fcPrefix: placements.some(p => (p.sku || '').startsWith('FC-')), noUppers: !placements.some(p => (p.zone || p.type || '').toLowerCase().includes('upper')), b2td: placements.some(p => (p.zone || p.type || '').toLowerCase().includes('tall')) } : { isGola: false },
  };
}
