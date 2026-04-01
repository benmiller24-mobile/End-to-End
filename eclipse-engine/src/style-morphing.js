/**
 * @fileoverview Style Morphing Module for Eclipse Kitchen Designer
 * Implements material & style morphing: when door style changes, geometry,
 * weight, and finishing details update throughout the kitchen.
 *
 * Maps style choices to physical geometry, molding profiles, and finish metrics.
 *
 * @module eclipse-engine/style-morphing
 */

/**
 * Style-to-Geometry mapping table.
 * Each Eclipse door style has distinct physical properties.
 *
 * @constant {Object<string, Object>}
 */
export const STYLE_GEOMETRY = {
  'Slab (Modern)': {
    doorThickness: 0.75,      // inches
    panelDepth: 0,            // flat
    edgeProfile: 'square',
    weightPerSqft: 2.1,       // lb/sqft
    overlayType: 'full',      // full overlay (1/2" overlap)
    hingeMountOffset: 0.75,   // from edge
    hingeOpenArc: 170,        // degrees
    description: 'Flat slab, modern minimalist'
  },
  'Shaker': {
    doorThickness: 0.75,
    panelDepth: 0.375,        // 3/8" recessed
    edgeProfile: 'square',
    weightPerSqft: 2.4,
    overlayType: 'full',
    hingeMountOffset: 0.75,
    hingeOpenArc: 170,
    description: 'Classic recessed panel with square stiles'
  },
  'Raised Panel': {
    doorThickness: 0.875,     // 7/8" (adds 1/8")
    panelDepth: 0.5,          // 1/2" raised
    edgeProfile: 'ogee',
    weightPerSqft: 2.8,
    overlayType: 'full',
    hingeMountOffset: 0.75,
    hingeOpenArc: 170,
    description: 'Raised panel with ogee edge profile'
  },
  'Beaded Inset': {
    doorThickness: 0.75,
    panelDepth: 0.375,        // 3/8" recessed
    edgeProfile: 'bead',
    weightPerSqft: 2.4,
    overlayType: 'inset',     // inset (door inside frame)
    hingeMountOffset: 0,      // concealed hinge at frame
    hingeOpenArc: 110,        // limited by frame
    description: 'Recessed with beaded edge, inset style'
  },
  'Glass Front': {
    doorThickness: 1.0,       // 3/4" frame + 1/4" glass
    panelDepth: 0,
    edgeProfile: 'varies',
    weightPerSqft: 3.0,       // with glass
    overlayType: 'full',
    hingeMountOffset: 0.75,
    hingeOpenArc: 170,
    isGlassFront: true,
    glassThickness: 0.25,     // 1/4" glass
    frameMaterial: 'wood',
    fragile: true,
    description: 'Glass-front cabinet with wood frame'
  },
  'Gola (J-pull)': {
    doorThickness: 0.75,
    panelDepth: 0,
    edgeProfile: 'integrated channel',
    weightPerSqft: 2.2,
    overlayType: 'full',
    hingeMountOffset: 0,      // no visible hinges
    hingeOpenArc: 0,          // push-to-open
    isPushToOpen: true,
    clearanceRequired: true,  // extra clearance for mechanism
    description: 'Handleless gola with integrated j-pull'
  },
  'Full Height Door': {
    doorThickness: 0.75,
    panelDepth: 0,
    edgeProfile: 'square',
    weightPerSqft: 2.1,
    overlayType: 'full',
    hingeMountOffset: 0.75,
    hingeOpenArc: 170,
    isFullHeight: true,
    description: 'Full-height cabinet door spanning multiple sections'
  }
};

/**
 * Crown molding profile definitions.
 * Profiles define cross-sectional geometry for extrusion along path.
 *
 * @constant {Object<string, Object>}
 */
export const MOLDING_PROFILES = {
  'none': {
    name: 'No Molding',
    height: 0,
    width: 0,
    complexity: 0,
    sku: 'NONE',
    description: 'No crown molding'
  },
  'Simple': {
    name: 'Simple Modern',
    height: 2.25,             // inches
    width: 2.25,
    complexity: 1,            // 45° angle
    curve: 'quarter-round',
    angle: 45,
    sku: 'CROWN-SMP',
    costPerLf: 3.50,
    description: 'Quarter-round, modern minimalist'
  },
  'Cove': {
    name: 'Cove Transitional',
    height: 3.5,
    width: 3.5,
    complexity: 3,            // cove + step detail
    curve: 'cove-with-step',
    stepHeight: 0.25,
    sku: 'CROWN-COV',
    costPerLf: 4.75,
    description: 'Cove profile with 1/4" step detail'
  },
  'Ornate': {
    name: 'Ornate Traditional',
    height: 5.25,
    width: 4.0,
    complexity: 5,            // multi-step + dentil
    curve: 'ornate-dentil',
    dentilSpacing: 4,         // inches between blocks
    dentilDepth: 0.5,
    sku: 'CROWN-ORN',
    costPerLf: 6.25,
    description: 'Multi-step with dentil blocks every 4"'
  }
};

/**
 * Light rail profile definitions.
 * Profiles for bottom-of-upper cabinets.
 *
 * @constant {Object<string, Object>}
 */
export const LIGHT_RAIL_PROFILES = {
  'none': {
    name: 'No Light Rail',
    height: 0,
    width: 0,
    sku: 'NONE',
    description: 'No light rail'
  },
  'SQ': {
    name: 'Square',
    height: 0.75,             // 3/4"
    width: 1.5,
    profile: 'rectangular',
    sku: 'RAIL-SQ',
    costPerLf: 1.25,
    description: 'Simple rectangular profile'
  },
  'OG': {
    name: 'Ogee',
    height: 0.75,
    width: 2.25,
    profile: 'ogee',
    curve: 'ogee-curve',
    sku: 'RAIL-OG',
    costPerLf: 1.75,
    description: 'Ogee curve profile'
  }
};

/**
 * Design style presets: aggregated choices for door, crown, light rail, hardware, ceiling.
 *
 * @constant {Object<string, Object>}
 */
export const DESIGN_PRESETS = {
  'Contemporary': {
    door: 'Slab (Modern)',
    crown: 'none',
    lightRail: 'SQ',
    hardware: 'hidden',
    toeCeiling: true,
    finish: 'matte',
    description: 'Clean, minimalist aesthetic'
  },
  'Transitional': {
    door: 'Shaker',
    crown: 'Cove',
    lightRail: 'SQ',
    hardware: 'bar',
    toeCeiling: false,
    finish: 'satin',
    description: 'Balanced blend of traditional and modern'
  },
  'Traditional': {
    door: 'Raised Panel',
    crown: 'Ornate',
    lightRail: 'OG',
    hardware: 'knob',
    toeCeiling: false,
    finish: 'semi-gloss',
    description: 'Classic formal aesthetic'
  },
  'Modern Farmhouse': {
    door: 'Shaker',
    crown: 'Simple',
    lightRail: 'none',
    hardware: 'cup',
    toeCeiling: false,
    finish: 'matte',
    description: 'Rustic charm with modern simplicity'
  },
  'European Minimal': {
    door: 'Gola (J-pull)',
    crown: 'none',
    lightRail: 'none',
    hardware: 'none',
    toeCeiling: true,
    finish: 'matte',
    description: 'Sleek, handle-free European design'
  }
};

/**
 * Morph the layout when door style changes.
 * Updates cabinet dimensions, weights, and geometric properties.
 *
 * @param {Object} layoutResult - Layout result object from solver
 * @param {string} newStyleName - Name of new door style (key in STYLE_GEOMETRY)
 * @param {Object} [prefs={}] - Additional morphing preferences
 * @param {boolean} [prefs.updateAllCabinets=true] - Update entire layout vs. selected only
 * @param {Array<string>} [prefs.selectedCabinetIds=[]] - Cabinet IDs to update (if not all)
 *
 * @returns {Object} Mutated layout with updated geometry, weights, hinge configs
 *
 * @example
 * const newLayout = morphStyle(layoutResult, 'Raised Panel', { updateAllCabinets: true });
 */
export function morphStyle(layoutResult, newStyleName, prefs = {}) {
  const {
    updateAllCabinets = true,
    selectedCabinetIds = []
  } = prefs;

  // Validate style exists
  if (!STYLE_GEOMETRY[newStyleName]) {
    throw new Error(`Style '${newStyleName}' not found in STYLE_GEOMETRY`);
  }

  const newStyleGeom = STYLE_GEOMETRY[newStyleName];
  const oldStyleGeom = layoutResult.styleGeometry || STYLE_GEOMETRY['Slab (Modern)'];
  const layout = JSON.parse(JSON.stringify(layoutResult)); // deep copy

  // Track which cabinets to update
  const cabinetsToUpdate = updateAllCabinets
    ? layout.cabinets
    : layout.cabinets.filter(cab => selectedCabinetIds.includes(cab.id));

  // Update each cabinet's geometry
  cabinetsToUpdate.forEach(cabinet => {
    const oldDoorThickness = oldStyleGeom.doorThickness;
    const newDoorThickness = newStyleGeom.doorThickness;
    const doorThicknessDelta = newDoorThickness - oldDoorThickness;

    // Update door thickness
    cabinet.doorThickness = newDoorThickness;
    cabinet.style = newStyleName;

    // Handle overlay vs. inset style change
    if (oldStyleGeom.overlayType !== newStyleGeom.overlayType) {
      if (newStyleGeom.overlayType === 'inset') {
        // Door sits INSIDE frame: reduce opening width/height by door thickness on each side
        cabinet.openingWidth -= doorThicknessDelta * 2;
        cabinet.openingHeight -= doorThicknessDelta * 2;
        cabinet.doorOverlapLeft = 0;
        cabinet.doorOverlapRight = 0;
        cabinet.doorOverlapTop = 0;
        cabinet.doorOverlapBottom = 0;
      } else if (newStyleGeom.overlayType === 'full') {
        // Full overlay: door overlaps frame by 1/2" on each side
        cabinet.doorOverlapLeft = 0.5;
        cabinet.doorOverlapRight = 0.5;
        cabinet.doorOverlapTop = 0.5;
        cabinet.doorOverlapBottom = 0.5;
      }
    }

    // Recalculate total depth: cabinetBoxDepth + doorThickness
    cabinet.totalDepth = cabinet.boxDepth + newDoorThickness;

    // Update door weight: area (sqft) × weight per sqft
    const doorAreaSqft = (cabinet.doorWidth * cabinet.doorHeight) / 144; // 12² = 144
    let doorWeight = doorAreaSqft * newStyleGeom.weightPerSqft;

    // For glass front: reduce weight for glass portion
    if (newStyleGeom.isGlassFront) {
      const glassAreaSqft = doorAreaSqft * 0.6; // assume 60% glass
      const woodAreaSqft = doorAreaSqft * 0.4;  // 40% frame
      const glassDensity = 0.09;                // lb/sqin approx
      const glassWeight = glassAreaSqft * 144 * glassDensity;
      const woodWeight = woodAreaSqft * newStyleGeom.weightPerSqft;
      doorWeight = glassWeight + woodWeight;
    }

    cabinet.doorWeight = parseFloat(doorWeight.toFixed(2));
    cabinet.fragile = newStyleGeom.fragile || false;

    // Update hinge configuration based on style
    cabinet.hingeType = newStyleGeom.isPushToOpen ? 'push-to-open' : (
      newStyleGeom.overlayType === 'inset' ? 'concealed' : 'visible'
    );
    cabinet.hingeMountOffset = newStyleGeom.hingeMountOffset;
    cabinet.hingeOpenArc = newStyleGeom.hingeOpenArc;

    // Calculate recommended hinge count based on door height and weight
    const hingeCount = calculateHingeCount(cabinet.doorHeight, doorWeight);
    cabinet.recommendedHingeCount = hingeCount;
  });

  // Recalculate finish metrics for entire layout
  const finishMetrics = calculateFinishMetrics(layout, newStyleName);
  layout.finishMetrics = finishMetrics;

  // Store current style info
  layout.styleGeometry = newStyleGeom;
  layout.currentStyle = newStyleName;

  return layout;
}

/**
 * Extrude a molding profile along a path (perimeter of upper cabinets).
 * Handles miters at corners, returns at exposed ends, breaks at hood locations.
 *
 * @param {string} profileName - Name of profile ('Simple', 'Cove', 'Ornate', 'none')
 * @param {Array<Object>} pathSegments - Path segments: [{start: {x, y}, end: {x, y}, type: 'straight'|'corner', angle: 45, ...}]
 * @param {Object} [opts={}] - Extrusion options
 * @param {Array<Object>} [opts.hoodZones=[]] - Hood locations to skip: [{x1, y1, x2, y2}, ...]
 * param {boolean} [opts.returnAtEnds=true] - Add return pieces at exposed ends
 *
 * @returns {Object} Extruded molding: { segments: [...], totalLength, miters: [...], returns: [...], skus: [...], cost }
 *
 * @example
 * const molding = extrudeMoldingProfile('Cove', pathSegments, { hoodZones: [hoodZone] });
 */
export function extrudeMoldingProfile(profileName, pathSegments, opts = {}) {
  const {
    hoodZones = [],
    returnAtEnds = true
  } = opts;

  if (!MOLDING_PROFILES[profileName]) {
    throw new Error(`Molding profile '${profileName}' not found`);
  }

  const profile = MOLDING_PROFILES[profileName];

  if (profile.height === 0) {
    // No molding
    return {
      segments: [],
      totalLength: 0,
      miters: [],
      returns: [],
      skus: [],
      cost: 0
    };
  }

  const segments = [];
  const miters = [];
  const returns = [];
  let totalLength = 0;
  const skus = [];

  // Filter path segments: exclude zones covered by hood
  const filteredSegments = pathSegments.filter(seg => {
    return !hoodZones.some(zone => segmentInZone(seg, zone));
  });

  // Process each path segment
  filteredSegments.forEach((seg, idx) => {
    const segmentLength = calculateDistance(seg.start, seg.end);
    totalLength += segmentLength;

    segments.push({
      profile: profileName,
      start: seg.start,
      end: seg.end,
      length: segmentLength,
      type: seg.type || 'straight'
    });

    // Handle corners: add miter
    if (seg.type === 'corner' && seg.angle !== undefined) {
      const miterAngle = seg.angle === 90 ? 45 : (seg.angle / 2);
      miters.push({
        location: seg.end,
        angle: miterAngle,
        type: seg.angle > 180 ? 'inside' : 'outside',
        profile: profileName
      });
    }
  });

  // Add return pieces at exposed ends
  if (returnAtEnds) {
    const firstSeg = filteredSegments[0];
    const lastSeg = filteredSegments[filteredSegments.length - 1];

    // Return at start end
    if (firstSeg) {
      const returnLength = profile.width;
      returns.push({
        location: firstSeg.start,
        direction: 'inward',
        length: returnLength,
        profile: profileName
      });
      totalLength += returnLength;
    }

    // Return at end
    if (lastSeg) {
      const returnLength = profile.width;
      returns.push({
        location: lastSeg.end,
        direction: 'inward',
        length: returnLength,
        profile: profileName
      });
      totalLength += returnLength;
    }
  }

  // Calculate cost
  const costPerLf = profile.costPerLf || 0;
  const cost = totalLength * costPerLf;

  // Generate SKUs: one per linear foot
  const skuCount = Math.ceil(totalLength);
  for (let i = 0; i < skuCount; i++) {
    skus.push({
      sku: `${profile.sku}-${i + 1}`,
      length: 1,
      description: `${profileName} crown molding 1 LF`
    });
  }

  return {
    segments,
    totalLength: parseFloat(totalLength.toFixed(2)),
    miters,
    returns,
    skus,
    cost: parseFloat(cost.toFixed(2)),
    profile
  };
}

/**
 * Extrude a light rail profile along the bottom of upper cabinets.
 * Same path-follower logic as molding, skips hood zones.
 *
 * @param {string} profileName - Name of profile ('SQ', 'OG', 'none')
 * @param {Array<Object>} pathSegments - Path segments (bottom perimeter of uppers)
 * @param {Object} [opts={}] - Extrusion options
 * @param {Array<Object>} [opts.hoodZones=[]] - Hood locations to skip
 *
 * @returns {Object} Extruded light rail: { segments, totalLength, miters, returns, skus, cost }
 */
export function extrudeLightRailProfile(profileName, pathSegments, opts = {}) {
  const {
    hoodZones = []
  } = opts;

  if (!LIGHT_RAIL_PROFILES[profileName]) {
    throw new Error(`Light rail profile '${profileName}' not found`);
  }

  const profile = LIGHT_RAIL_PROFILES[profileName];

  if (profile.height === 0) {
    return {
      segments: [],
      totalLength: 0,
      miters: [],
      returns: [],
      skus: [],
      cost: 0
    };
  }

  const segments = [];
  const miters = [];
  const returns = [];
  let totalLength = 0;
  const skus = [];

  // Filter path segments: exclude hood zones
  const filteredSegments = pathSegments.filter(seg => {
    return !hoodZones.some(zone => segmentInZone(seg, zone));
  });

  // Process each segment
  filteredSegments.forEach(seg => {
    const segmentLength = calculateDistance(seg.start, seg.end);
    totalLength += segmentLength;

    segments.push({
      profile: profileName,
      start: seg.start,
      end: seg.end,
      length: segmentLength,
      type: seg.type || 'straight'
    });

    if (seg.type === 'corner' && seg.angle !== undefined) {
      const miterAngle = seg.angle === 90 ? 45 : (seg.angle / 2);
      miters.push({
        location: seg.end,
        angle: miterAngle,
        type: seg.angle > 180 ? 'inside' : 'outside',
        profile: profileName
      });
    }
  });

  // Add returns at exposed ends
  const firstSeg = filteredSegments[0];
  const lastSeg = filteredSegments[filteredSegments.length - 1];

  if (firstSeg) {
    const returnLength = profile.width;
    returns.push({
      location: firstSeg.start,
      direction: 'inward',
      length: returnLength,
      profile: profileName
    });
    totalLength += returnLength;
  }

  if (lastSeg) {
    const returnLength = profile.width;
    returns.push({
      location: lastSeg.end,
      direction: 'inward',
      length: returnLength,
      profile: profileName
    });
    totalLength += returnLength;
  }

  // Calculate cost
  const costPerLf = profile.costPerLf || 0;
  const cost = totalLength * costPerLf;

  // Generate SKUs
  const skuCount = Math.ceil(totalLength);
  for (let i = 0; i < skuCount; i++) {
    skus.push({
      sku: `${profile.sku}-${i + 1}`,
      length: 1,
      description: `${profileName} light rail 1 LF`
    });
  }

  return {
    segments,
    totalLength: parseFloat(totalLength.toFixed(2)),
    miters,
    returns,
    skus,
    cost: parseFloat(cost.toFixed(2)),
    profile
  };
}

/**
 * Calculate finish metrics for the layout.
 * Determines paint/stain area, glass area, hinge counts, and material estimates.
 *
 * @param {Object} layoutResult - Layout result object
 * @param {string} styleName - Current door style name
 * @param {Object} [opts={}] - Calculation options
 * @param {boolean} [opts.includeMolding=true] - Include molding in paintable area
 * @param {boolean} [opts.twoTone=false] - Separate calculation for two-tone
 *
 * @returns {Object} Finish metrics: { totalDoorWeight, paintableArea, glassArea, totalHingeCount, ... }
 */
export function calculateFinishMetrics(layoutResult, styleName, opts = {}) {
  const {
    includeMolding = true,
    twoTone = false
  } = opts;

  if (!STYLE_GEOMETRY[styleName]) {
    throw new Error(`Style '${styleName}' not found in STYLE_GEOMETRY`);
  }

  const styleGeom = STYLE_GEOMETRY[styleName];
  const cabinets = layoutResult.cabinets || [];

  let totalDoorWeight = 0;
  let paintableArea = 0;
  let glassArea = 0;
  let totalHingeCount = 0;
  let cabinetCount = 0;
  let glassCabinetCount = 0;

  cabinets.forEach(cabinet => {
    // Door weight
    totalDoorWeight += cabinet.doorWeight || 0;

    // Paintable area (both sides of door, plus interior surfaces)
    const doorAreaSqft = (cabinet.doorWidth * cabinet.doorHeight) / 144;
    paintableArea += doorAreaSqft * 2; // both sides

    // Interior sides, top, bottom (simplified)
    const interiorAreaSqft = (cabinet.boxDepth * 2 + cabinet.boxWidth * 2 +
                              cabinet.boxWidth * cabinet.boxDepth) / 144;
    paintableArea += interiorAreaSqft;

    // Glass area
    if (styleGeom.isGlassFront || cabinet.fragile) {
      const glassAreaSqft = (doorAreaSqft * 0.6); // 60% glass
      glassArea += glassAreaSqft;
      glassCabinetCount += 1;
    }

    // Hinge count
    const hingeCount = cabinet.recommendedHingeCount || 2;
    totalHingeCount += hingeCount;

    cabinetCount += 1;
  });

  // Molding paintable area
  let moldingArea = 0;
  if (includeMolding && layoutResult.molding) {
    const moldingLength = layoutResult.molding.totalLength || 0;
    const moldingProfile = layoutResult.molding.profile || {};
    const moldingHeight = moldingProfile.height || 0;
    const moldingAreaSqft = (moldingLength * moldingHeight) / 12; // linear feet to sqft
    moldingArea = moldingAreaSqft * 2; // front and back
  }

  paintableArea += moldingArea;

  // Light rail paintable area
  let lightRailArea = 0;
  if (layoutResult.lightRail) {
    const railLength = layoutResult.lightRail.totalLength || 0;
    const railProfile = layoutResult.lightRail.profile || {};
    const railHeight = railProfile.height || 0;
    const railAreaSqft = (railLength * railHeight) / 12;
    lightRailArea = railAreaSqft * 2;
  }

  paintableArea += lightRailArea;

  // Two-tone zones (if applicable)
  let primaryZoneArea = paintableArea;
  let secondaryZoneArea = 0;

  if (twoTone && layoutResult.twoToneConfig) {
    const twoToneRatio = layoutResult.twoToneConfig.ratio || 0.5;
    primaryZoneArea = paintableArea * twoToneRatio;
    secondaryZoneArea = paintableArea * (1 - twoToneRatio);
  }

  return {
    totalDoorWeight: parseFloat(totalDoorWeight.toFixed(2)),
    paintableArea: parseFloat(paintableArea.toFixed(2)),
    glassArea: parseFloat(glassArea.toFixed(2)),
    totalHingeCount,
    moldingArea: parseFloat(moldingArea.toFixed(2)),
    lightRailArea: parseFloat(lightRailArea.toFixed(2)),
    cabinetCount,
    glassCabinetCount,
    primaryZoneArea: parseFloat(primaryZoneArea.toFixed(2)),
    secondaryZoneArea: parseFloat(secondaryZoneArea.toFixed(2)),
    style: styleName,
    timestamp: new Date().toISOString()
  };
}

/**
 * Apply a complete design preset to the layout.
 * Sets door style, crown molding, light rail, hardware, and ceiling finish.
 *
 * @param {Object} layoutResult - Layout result object
 * @param {string} presetName - Name of preset (key in DESIGN_PRESETS)
 * @param {Object} [opts={}] - Preset override options
 *
 * @returns {Object} Layout with preset applied
 *
 * @example
 * const designedLayout = applyDesignPreset(layout, 'Traditional', { toeCeiling: true });
 */
export function applyDesignPreset(layoutResult, presetName, opts = {}) {
  if (!DESIGN_PRESETS[presetName]) {
    throw new Error(`Design preset '${presetName}' not found in DESIGN_PRESETS`);
  }

  const preset = DESIGN_PRESETS[presetName];
  const layout = JSON.parse(JSON.stringify(layoutResult));

  // Merge preset with overrides
  const finalPreset = { ...preset, ...opts };

  // Apply door style
  const styledLayout = morphStyle(layout, finalPreset.door);

  // Apply crown molding
  if (finalPreset.crown && layoutResult.upperCabinetPerimeter) {
    styledLayout.molding = extrudeMoldingProfile(
      finalPreset.crown,
      layoutResult.upperCabinetPerimeter,
      { hoodZones: layoutResult.hoodZones || [] }
    );
  }

  // Apply light rail
  if (finalPreset.lightRail && layoutResult.lowerCabinetPerimeter) {
    styledLayout.lightRail = extrudeLightRailProfile(
      finalPreset.lightRail,
      layoutResult.lowerCabinetPerimeter,
      { hoodZones: layoutResult.hoodZones || [] }
    );
  }

  // Apply design attributes
  styledLayout.designPreset = presetName;
  styledLayout.hardware = finalPreset.hardware;
  styledLayout.toeCeiling = finalPreset.toeCeiling;
  styledLayout.finish = finalPreset.finish;

  return styledLayout;
}

/**
 * Calculate distance between two points.
 * @private
 */
function calculateDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a line segment is within a bounding zone.
 * @private
 */
function segmentInZone(segment, zone) {
  const { start, end } = segment;
  const { x1, y1, x2, y2 } = zone;

  // Check if either endpoint is in zone
  const startInZone = start.x >= x1 && start.x <= x2 && start.y >= y1 && start.y <= y2;
  const endInZone = end.x >= x1 && end.x <= x2 && end.y >= y1 && end.y <= y2;

  return startInZone || endInZone;
}

/**
 * Calculate recommended hinge count based on door height and weight.
 * @private
 */
function calculateHingeCount(heightInches, weightLbs) {
  if (heightInches < 40) {
    return weightLbs > 50 ? 3 : 2;
  } else if (heightInches < 60) {
    return weightLbs > 70 ? 4 : 3;
  } else {
    return weightLbs > 90 ? 5 : 4;
  }
}
