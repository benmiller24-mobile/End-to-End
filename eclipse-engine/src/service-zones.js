/**
 * @fileoverview Service Zones & Plumbing Voids Module
 *
 * Handles hidden service cavities behind and under cabinets that plumbers,
 * electricians, and HVAC technicians need access to. Ensures proper clearances,
 * knockout dimensions, and accessibility for maintenance.
 *
 * @module service-zones
 * @requires cabinet-data
 * @requires geometry
 */

// ============================================================================
// SERVICE ZONE CONSTANTS & SPECIFICATIONS
// ============================================================================

/**
 * Service zone specifications and clearance requirements.
 * @type {Object}
 */
export const SERVICE_ZONE_SPECS = {
  // Dishwasher service
  DISHWASHER: {
    serviceType: 'dishwasher-opening',
    openingWidth: 24,           // inches, clear cabinet-free opening
    openingHeight: 34.5,        // standard DW height (36" w/ toe kick)
    backPanelRequired: false,   // must be open
    adjacentKnockout: {
      type: 'drain-supply',
      width: 6,
      height: 8,
      description: 'Drain hose + water supply routing'
    }
  },

  // Sink plumbing void
  SINK_BASE: {
    serviceType: 'sink-plumbing-void',
    backPanelKnockout: {
      width: 6,
      height: 8,
      position: 'center',        // centered on back panel
      purpose: 'P-trap access'
    },
    cornerHoles: {
      size: 2,                   // diameter, inches
      position: 'bottom-corners', // bottom-left & bottom-right
      purpose: 'hose routing supply/drain'
    },
    disposalElectrical: {
      size: 4,                   // diameter, inches
      position: 'bottom-right',
      required: false,           // only if disposal specified
      purpose: 'electrical cord'
    },
    floorPenetration: {
      width: 4,
      depth: 4,
      position: 'floor-center',
      purpose: 'main drain penetration'
    }
  },

  // Corner sink reach-back
  CORNER_SINK: {
    serviceType: 'corner-reach-back',
    maxErgonomicReach: 24,       // inches, plumber reach distance
    measurementBasis: 'diagonal-depth-from-corner'
  },

  // Range/cooktop gas line
  GAS_RANGE: {
    serviceType: 'gas-line-void',
    voidDepth: 3,               // inches behind range cabinet
    voidClearance: 'no-blocking-component',
    purpose: 'flexible gas line routing',
    backPanelRequired: false    // no back panel behind range
  },

  // Refrigerator water line (built-in)
  FRIDGE_WATER_LINE: {
    serviceType: 'fridge-water-line',
    routingMethod: 'floor-or-wall-penetration',
    penetrationSize: 0.5,       // diameter, inches (1/4" tubing)
    markerOffset: {
      x: 3,                     // inches from left edge of fridge
      y: 12                     // inches from front face
    },
    purpose: 'ice maker supply'
  },

  // Island plumbing
  ISLAND_SINK: {
    serviceType: 'island-plumbing',
    drainPenetration: {
      width: 4,
      depth: 4,
      purpose: 'main drain line'
    },
    supplyPenetration: {
      width: 2,
      depth: 2,
      purpose: 'cold/hot supply lines'
    },
    floorAccessRequired: true,
    pTrapAccess: {
      clearanceRadius: 12,       // inches around drain for P-trap
      description: 'Space below island for trap & clean-out'
    }
  },

  // General clearances
  GENERAL: {
    backPanelStandard: 0.75,     // thickness, inches
    toekickClearance: 4.25,      // inches above floor
    topCabinet: {
      bottomClearance: 18        // min distance above counter for upper cabinet
    }
  }
};

// ============================================================================
// SERVICE ZONE CLASS
// ============================================================================

/**
 * Represents a service cavity or plumbing void in the kitchen layout.
 * @class ServiceZone
 */
class ServiceZone {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.type - Zone type (dishwasher, sink-void, gas-line, etc.)
   * @param {string} config.applianceType - Appliance using this service (DW, SB33, R36FI, etc.)
   * @param {string} config.wallId - Wall identifier or 'island'
   * @param {Object} config.position - Position {x, y, z} in inches
   * @param {number} config.position.x - X coordinate (horizontal, along wall)
   * @param {number} config.position.y - Y coordinate (depth from wall)
   * @param {number} config.position.z - Z coordinate (height above floor)
   * @param {number} config.width - Width in inches
   * @param {number} config.depth - Depth in inches
   * @param {number} config.height - Height in inches
   * @param {boolean} config.hasBackPanel - Whether back panel is present
   * @param {Array<Object>} config.knockoutSpecs - Array of knockout hole specs
   * @param {string} [config.notes] - Additional notes
   */
  constructor(config) {
    this.type = config.type;
    this.applianceType = config.applianceType;
    this.wallId = config.wallId;
    this.position = config.position;           // {x, y, z}
    this.width = config.width;
    this.depth = config.depth;
    this.height = config.height;
    this.hasBackPanel = config.hasBackPanel ?? true;
    this.knockoutSpecs = config.knockoutSpecs ?? [];
    this.notes = config.notes || '';
    this.violations = [];                      // collected during validation
    this.warnings = [];                        // collected during validation
  }

  /**
   * Generate a unique identifier for this zone.
   * @returns {string}
   */
  getId() {
    return `${this.wallId}-${this.applianceType}-${this.position.x.toFixed(1)}`;
  }

  /**
   * Get boundary box for overlap detection.
   * @returns {Object} {minX, maxX, minY, maxY, minZ, maxZ}
   */
  getBounds() {
    return {
      minX: this.position.x,
      maxX: this.position.x + this.width,
      minY: this.position.y,
      maxY: this.position.y + this.depth,
      minZ: this.position.z,
      maxZ: this.position.z + this.height
    };
  }

  /**
   * Check if this zone overlaps with another (at same wall/location).
   * @param {ServiceZone} other
   * @returns {boolean}
   */
  overlapsWithZone(other) {
    if (this.wallId !== other.wallId) return false;

    const a = this.getBounds();
    const b = other.getBounds();

    return !(
      a.maxX <= b.minX ||
      a.minX >= b.maxX ||
      a.maxY <= b.minY ||
      a.minY >= b.maxY ||
      a.maxZ <= b.minZ ||
      a.minZ >= b.maxZ
    );
  }
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate all service zones for a kitchen layout.
 *
 * Analyzes wall layouts and appliance list to create service cavity specs
 * for dishwashers, sinks, ranges, fridges, and island plumbing.
 *
 * @param {Array<Object>} wallLayouts - Array of wall layout objects
 *   Each: {wallId, cabinets: [{type, position, width, depth, height, ...}], ...}
 * @param {Object} islandLayout - Island layout object (may be null/undefined)
 *   {cabinets: [{type, position, ...}], ...}
 * @param {Array<Object>} applianceList - Array of appliance specs
 *   Each: {type, location, modelNumber, hasIceMaker, hasDisposal, ...}
 *
 * @returns {Object} Service zones report
 *   {
 *     zones: [ServiceZone, ...],
 *     knockouts: [{zoneId, specs: [...], notes: string}, ...],
 *     warnings: [{severity, message, zoneId}, ...],
 *     violations: [{severity, message, zoneId}, ...],
 *     summary: {totalZones, totalKnockouts, warningCount, violationCount}
 *   }
 */
export function generateServiceZones(wallLayouts, islandLayout, applianceList) {
  const zones = [];
  const warnings = [];
  const violations = [];
  const knockouts = [];

  if (!wallLayouts) wallLayouts = [];
  if (!applianceList) applianceList = [];

  // Process appliances
  for (const appliance of applianceList) {
    // Dishwasher service
    if (appliance.type === 'DW' || appliance.type === 'dishwasher') {
      _processDishwasher(appliance, zones, knockouts, warnings, violations);
    }

    // Sink base plumbing
    if (_isSinkBase(appliance.type)) {
      _processSinkBase(appliance, zones, knockouts, warnings, violations);
    }

    // Corner sink reach-back check
    if (_isSinkBase(appliance.type) && _isCornerCabinet(appliance.type)) {
      _checkCornerSinkReachBack(appliance, warnings, violations);
    }

    // Gas range void
    if (_isGasRange(appliance.type, appliance)) {
      _processGasRange(appliance, zones, warnings);
    }

    // Refrigerator water line
    if (_isBuiltInFridge(appliance.type, appliance)) {
      _processFridgeWaterLine(appliance, zones, warnings);
    }
  }

  // Island plumbing (if present)
  if (islandLayout && islandLayout.cabinets) {
    _processIslandPlumbing(islandLayout, zones, knockouts, warnings);
  }

  // Validate all zones
  const validationResults = validateServiceAccess(zones);
  violations.push(...validationResults.violations);
  warnings.push(...validationResults.warnings);

  // Build knockout report
  for (const zone of zones) {
    if (zone.knockoutSpecs && zone.knockoutSpecs.length > 0) {
      knockouts.push({
        zoneId: zone.getId(),
        applianceType: zone.applianceType,
        specs: zone.knockoutSpecs,
        notes: zone.notes,
        wallId: zone.wallId
      });
    }
  }

  return {
    zones,
    knockouts,
    warnings,
    violations,
    summary: {
      totalZones: zones.length,
      totalKnockouts: knockouts.length,
      warningCount: warnings.length,
      violationCount: violations.length
    }
  };
}

// ============================================================================
// APPLIANCE PROCESSING HELPERS
// ============================================================================

/**
 * Check if cabinet type is a sink base.
 * @param {string} type
 * @returns {boolean}
 */
function _isSinkBase(type) {
  return /^(SB|DSB|BSC|BBC)/.test(type);
}

/**
 * Check if cabinet is a corner (angled) model.
 * @param {string} type
 * @returns {boolean}
 */
function _isCornerCabinet(type) {
  return /^(BBC|BSC|DSB36-SS)/.test(type);
}

/**
 * Check if appliance is a gas range.
 * @param {string} type
 * @param {Object} appliance
 * @returns {boolean}
 */
function _isGasRange(type, appliance) {
  return (type === 'R' || type === 'range') &&
         (appliance.fuelType === 'gas' || appliance.hasGasLine);
}

/**
 * Check if appliance is a built-in refrigerator.
 * @param {string} type
 * @param {Object} appliance
 * @returns {boolean}
 */
function _isBuiltInFridge(type, appliance) {
  return /^R\d+FI/.test(type) &&
         (appliance.hasIceMaker || appliance.iceType !== 'none');
}

/**
 * Process dishwasher: create opening zone and adjacent knockout.
 * @private
 */
function _processDishwasher(appliance, zones, knockouts, warnings, violations) {
  const dwSpec = SERVICE_ZONE_SPECS.DISHWASHER;

  // Create opening zone (no back panel)
  const dwZone = new ServiceZone({
    type: 'dishwasher-opening',
    applianceType: appliance.type || 'DW',
    wallId: appliance.wallId || 'unspecified',
    position: appliance.position || {x: 0, y: 0, z: 0},
    width: dwSpec.openingWidth,
    depth: appliance.depth || 24,
    height: dwSpec.openingHeight,
    hasBackPanel: false,
    knockoutSpecs: [],
    notes: 'Dishwasher requires cabinet-free 24" opening, no back panel'
  });

  zones.push(dwZone);

  // Check for adjacent sink base (should have knockout)
  const adjacentKnockout = {
    zoneId: dwZone.getId(),
    type: 'dishwasher-drain-supply',
    position: 'adjacent-sink-left',
    specs: [dwSpec.adjacentKnockout],
    notes: 'Sink base left side knockout for DW drain hose and water supply'
  };
  knockouts.push(adjacentKnockout);

  warnings.push({
    severity: 'info',
    message: `Dishwasher ${appliance.type} at position ${JSON.stringify(appliance.position)}: verify adjacent sink base has left-side knockout hole`,
    zoneId: dwZone.getId(),
    applianceType: appliance.type
  });
}

/**
 * Process sink base: create plumbing void with knockouts.
 * @private
 */
function _processSinkBase(appliance, zones, knockouts, warnings, violations) {
  const sinkSpec = SERVICE_ZONE_SPECS.SINK_BASE;

  const sinkZone = new ServiceZone({
    type: 'sink-plumbing-void',
    applianceType: appliance.type,
    wallId: appliance.wallId || 'unspecified',
    position: appliance.position || {x: 0, y: 0, z: 0},
    width: appliance.width || 33,
    depth: appliance.depth || 24,
    height: appliance.height || 34.5,
    hasBackPanel: true,
    knockoutSpecs: [],
    notes: `Sink base ${appliance.type}: plumbing void for P-trap, hose routing${
      appliance.hasDisposal ? ', disposal electrical' : ''
    }`
  });

  // Build knockout specs
  const knockoutList = [];

  // Back panel P-trap knockout
  knockoutList.push({
    type: 'p-trap-access',
    location: 'back-panel-center',
    width: sinkSpec.backPanelKnockout.width,
    height: sinkSpec.backPanelKnockout.height,
    purpose: sinkSpec.backPanelKnockout.purpose
  });

  // Corner hose holes
  knockoutList.push({
    type: 'hose-routing',
    location: 'bottom-left-corner',
    diameter: sinkSpec.cornerHoles.size,
    purpose: 'supply/drain hose'
  });

  knockoutList.push({
    type: 'hose-routing',
    location: 'bottom-right-corner',
    diameter: sinkSpec.cornerHoles.size,
    purpose: 'supply/drain hose'
  });

  // Disposal electrical (if present)
  if (appliance.hasDisposal) {
    knockoutList.push({
      type: 'disposal-electrical',
      location: 'bottom-right',
      diameter: sinkSpec.disposalElectrical.size,
      purpose: 'disposal motor electrical cord'
    });
  }

  sinkZone.knockoutSpecs = knockoutList;
  zones.push(sinkZone);

  knockouts.push({
    zoneId: sinkZone.getId(),
    applianceType: appliance.type,
    specs: knockoutList,
    notes: sinkZone.notes,
    wallId: appliance.wallId
  });
}

/**
 * Check corner sink reach-back distance for plumber access.
 * @private
 */
function _checkCornerSinkReachBack(appliance, warnings, violations) {
  const cornerSpec = SERVICE_ZONE_SPECS.CORNER_SINK;

  // Estimate diagonal depth from corner
  const estimatedDiagonalDepth = appliance.depth ? appliance.depth * 1.4 : 33;

  if (estimatedDiagonalDepth > cornerSpec.maxErgonomicReach) {
    violations.push({
      severity: 'error',
      message: `Corner sink ${appliance.type} diagonal reach (${estimatedDiagonalDepth.toFixed(1)}") exceeds max ergonomic reach (${cornerSpec.maxErgonomicReach}"). Plumber access compromised.`,
      applianceType: appliance.type,
      location: appliance.position,
      affectedComponent: 'shut-off valves'
    });
  } else if (estimatedDiagonalDepth > cornerSpec.maxErgonomicReach * 0.9) {
    warnings.push({
      severity: 'warning',
      message: `Corner sink ${appliance.type} near max reach distance. Confirm plumber can access shut-off valves.`,
      applianceType: appliance.type
    });
  }
}

/**
 * Process gas range: create void for flexible line routing.
 * @private
 */
function _processGasRange(appliance, zones, warnings) {
  const gasSpec = SERVICE_ZONE_SPECS.GAS_RANGE;

  const gasZone = new ServiceZone({
    type: 'gas-line-void',
    applianceType: appliance.type || 'R',
    wallId: appliance.wallId || 'unspecified',
    position: appliance.position || {x: 0, y: 0, z: 0},
    width: appliance.width || 30,
    depth: gasSpec.voidDepth,
    height: appliance.height || 36,
    hasBackPanel: false,
    knockoutSpecs: [{
      type: 'gas-line-space',
      location: 'back-of-cabinet',
      depth: gasSpec.voidDepth,
      purpose: 'flexible gas line routing (no rigid components)'
    }],
    notes: `Gas range ${appliance.type}: 3" void behind cabinet for flexible gas line. No back panel blocking.`
  });

  zones.push(gasZone);

  warnings.push({
    severity: 'info',
    message: `Gas range ${appliance.type} requires 3" clear void behind cabinet. Verify no blocking components.`,
    zoneId: gasZone.getId(),
    applianceType: appliance.type
  });
}

/**
 * Process refrigerator water line (built-in models with ice maker).
 * @private
 */
function _processFridgeWaterLine(appliance, zones, warnings) {
  const fridgeSpec = SERVICE_ZONE_SPECS.FRIDGE_WATER_LINE;

  // Create a marker zone for water line penetration
  const waterMarker = new ServiceZone({
    type: 'fridge-water-line',
    applianceType: appliance.type,
    wallId: appliance.wallId || 'unspecified',
    position: {
      x: (appliance.position?.x || 0) + fridgeSpec.markerOffset.x,
      y: (appliance.position?.y || 0) + fridgeSpec.markerOffset.y,
      z: SERVICE_ZONE_SPECS.GENERAL.toekickClearance
    },
    width: fridgeSpec.penetrationSize,
    depth: fridgeSpec.penetrationSize,
    height: 1,
    hasBackPanel: false,
    knockoutSpecs: [{
      type: 'water-line-penetration',
      location: 'floor-or-wall',
      diameter: fridgeSpec.penetrationSize,
      tubing: '1/4" copper or PEX',
      purpose: fridgeSpec.purpose
    }],
    notes: `Built-in fridge ${appliance.type} ice maker: water line penetration required. Mark penetration location for plumber.`
  });

  zones.push(waterMarker);

  warnings.push({
    severity: 'info',
    message: `Built-in fridge ${appliance.type} has ice maker: coordinate water line penetration location with plumber.`,
    zoneId: waterMarker.getId(),
    applianceType: appliance.type
  });
}

/**
 * Process island plumbing (if island has sink).
 * @private
 */
function _processIslandPlumbing(islandLayout, zones, knockouts, warnings) {
  // Check if island contains any sink
  const hasSink = islandLayout.cabinets?.some(cab => _isSinkBase(cab.type));

  if (!hasSink) return;

  // Find sink position in island
  const sinkCab = islandLayout.cabinets.find(cab => _isSinkBase(cab.type));
  if (!sinkCab) return;

  const islandSpec = SERVICE_ZONE_SPECS.ISLAND_SINK;

  // Island drain plumbing zone
  const islandZone = new ServiceZone({
    type: 'island-plumbing',
    applianceType: sinkCab.type || 'Island-Sink',
    wallId: 'island',
    position: sinkCab.position || {x: 0, y: 0, z: 0},
    width: sinkCab.width || 36,
    depth: sinkCab.depth || 24,
    height: islandSpec.pTrapAccess.clearanceRadius,
    hasBackPanel: true,
    knockoutSpecs: [
      {
        type: 'drain-penetration',
        location: 'floor-center',
        width: islandSpec.drainPenetration.width,
        depth: islandSpec.drainPenetration.depth,
        purpose: islandSpec.drainPenetration.purpose
      },
      {
        type: 'supply-penetration',
        location: 'floor-left',
        width: islandSpec.supplyPenetration.width,
        depth: islandSpec.supplyPenetration.depth,
        purpose: islandSpec.supplyPenetration.purpose
      }
    ],
    notes: `Island sink ${sinkCab.type}: floor penetrations for main drain and supply lines. Ensure P-trap clearance below.`
  });

  zones.push(islandZone);

  knockouts.push({
    zoneId: islandZone.getId(),
    applianceType: sinkCab.type,
    specs: islandZone.knockoutSpecs,
    notes: islandZone.notes,
    wallId: 'island'
  });

  warnings.push({
    severity: 'warning',
    message: `Island sink ${sinkCab.type}: coordinate floor penetrations with builder. Ensure ${islandSpec.pTrapAccess.clearanceRadius}" clearance below cabinet for P-trap.`,
    zoneId: islandZone.getId(),
    applianceType: sinkCab.type
  });
}

// ============================================================================
// VALIDATION FUNCTION
// ============================================================================

/**
 * Validate service access: check for overlaps, clearance violations, etc.
 *
 * @param {Array<ServiceZone>} zones - Array of service zones to validate
 *
 * @returns {Object} Validation report
 *   {
 *     violations: [{severity, message, zoneId, ...}, ...],
 *     warnings: [{severity, message, zoneId, ...}, ...],
 *     summary: {totalIssues, violationCount, warningCount}
 *   }
 */
export function validateServiceAccess(zones) {
  const violations = [];
  const warnings = [];
  const seen = new Set();

  if (!zones || zones.length === 0) {
    return { violations, warnings, summary: { totalIssues: 0, violationCount: 0, warningCount: 0 } };
  }

  // Check for overlapping zones on same wall
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const zoneA = zones[i];
      const zoneB = zones[j];

      if (zoneA.overlapsWithZone(zoneB)) {
        const overlapKey = `${zoneA.getId()}-${zoneB.getId()}`;

        if (!seen.has(overlapKey)) {
          violations.push({
            severity: 'error',
            message: `Service zones overlap: ${zoneA.applianceType} and ${zoneB.applianceType} at wall ${zoneA.wallId}`,
            zoneId: zoneA.getId(),
            conflictingZoneId: zoneB.getId(),
            applianceTypeA: zoneA.applianceType,
            applianceTypeB: zoneB.applianceType
          });

          seen.add(overlapKey);
        }
      }
    }
  }

  // Check back panel requirements
  for (const zone of zones) {
    // Dishwasher must have no back panel
    if (zone.type === 'dishwasher-opening' && zone.hasBackPanel) {
      violations.push({
        severity: 'error',
        message: `Dishwasher ${zone.applianceType}: back panel present but must be removed for 24" clear opening`,
        zoneId: zone.getId(),
        applianceType: zone.applianceType
      });
    }

    // Gas range must have no back panel
    if (zone.type === 'gas-line-void' && zone.hasBackPanel) {
      violations.push({
        severity: 'error',
        message: `Gas range ${zone.applianceType}: back panel blocks gas line void. Remove or cut opening.`,
        zoneId: zone.getId(),
        applianceType: zone.applianceType
      });
    }

    // Check knockout specs exist where required
    if ((zone.type === 'sink-plumbing-void' || zone.type === 'island-plumbing') &&
        (!zone.knockoutSpecs || zone.knockoutSpecs.length === 0)) {
      warnings.push({
        severity: 'warning',
        message: `Service zone ${zone.applianceType}: no knockout specifications defined. Plumber must create access holes.`,
        zoneId: zone.getId(),
        applianceType: zone.applianceType
      });
    }
  }

  return {
    violations,
    warnings,
    summary: {
      totalIssues: violations.length + warnings.length,
      violationCount: violations.length,
      warningCount: warnings.length
    }
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Export ServiceZone class for direct instantiation if needed.
 */
export { ServiceZone };

/**
 * Generate a knockout schedule report (typically for production/fab sheet).
 *
 * @param {Array<Object>} knockoutList - Knockout array from generateServiceZones
 * @returns {string} Formatted report
 */
export function generateKnockoutSchedule(knockoutList) {
  if (!knockoutList || knockoutList.length === 0) {
    return 'No knockouts required.';
  }

  let report = '=== KNOCKOUT SCHEDULE ===\n\n';

  for (const knockout of knockoutList) {
    report += `${knockout.zoneId} (${knockout.applianceType}) [Wall: ${knockout.wallId}]\n`;
    report += `  Notes: ${knockout.notes}\n`;
    report += `  Specifications:\n`;

    for (const spec of knockout.specs) {
      report += `    - ${spec.type}: ${spec.location}\n`;
      if (spec.width && spec.height) {
        report += `      Dimensions: ${spec.width}" × ${spec.height}"\n`;
      }
      if (spec.diameter) {
        report += `      Diameter: ${spec.diameter}"\n`;
      }
      report += `      Purpose: ${spec.purpose}\n`;
    }

    report += '\n';
  }

  return report;
}

/**
 * Generate a field notes string for the cabinet maker/installer.
 *
 * @param {Object} serviceReport - Full report from generateServiceZones
 * @returns {string} Field notes
 */
export function generateFieldNotes(serviceReport) {
  let notes = '=== SERVICE ZONE FIELD NOTES ===\n\n';

  // Summary
  notes += `Total Service Zones: ${serviceReport.summary.totalZones}\n`;
  notes += `Knockouts Required: ${serviceReport.summary.totalKnockouts}\n\n`;

  // Critical violations
  if (serviceReport.violations.length > 0) {
    notes += '⚠ CRITICAL ISSUES:\n';
    for (const v of serviceReport.violations) {
      notes += `  - [${v.severity.toUpperCase()}] ${v.message}\n`;
    }
    notes += '\n';
  }

  // Warnings
  if (serviceReport.warnings.length > 0) {
    notes += 'NOTES FOR FIELD:\n';
    for (const w of serviceReport.warnings.slice(0, 5)) {
      notes += `  - ${w.message}\n`;
    }
    if (serviceReport.warnings.length > 5) {
      notes += `  ... and ${serviceReport.warnings.length - 5} more\n`;
    }
    notes += '\n';
  }

  // Knockouts summary
  if (serviceReport.knockouts.length > 0) {
    notes += 'KNOCKOUTS TO CUT:\n';
    const byAppliance = {};
    for (const ko of serviceReport.knockouts) {
      if (!byAppliance[ko.applianceType]) byAppliance[ko.applianceType] = 0;
      byAppliance[ko.applianceType]++;
    }
    for (const [appType, count] of Object.entries(byAppliance)) {
      notes += `  - ${appType}: ${count} location(s)\n`;
    }
  }

  return notes;
}
