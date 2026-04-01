/**
 * Eclipse Cabinetry Door Styles
 * ==============================
 * JSON style table for Eclipse door profiles, geometry, and pricing tiers.
 * Used by the Style_Logic_Bridge to drive part selection based on design style.
 *
 * Sources: Eclipse C3 catalog, training data (7 projects), frameless construction specs.
 *
 * Door geometry:
 *   - All Eclipse cabinets are FRAMELESS (European-style)
 *   - Reveal between doors: 1/8" (3mm) standard
 *   - Door overlay: Full overlay (covers entire face frame / box edge)
 *   - Door thickness varies by style (3/4" to 1-1/8")
 *   - Hinge: Concealed European cup hinge (110° or 170° for corner cabs)
 *
 * @module eclipse-door-styles
 */

export const ECLIPSE_DOOR_STYLES = {
  // ── SLAB (FLAT PANEL) ─────────────────────────────────────────
  "Slab": {
    id: "slab",
    category: "modern",
    description: "Flat panel, no profile or detail",
    doorThickness: 0.75,       // 3/4"
    reveal: 0.125,             // 1/8" between doors
    overlay: "full",
    edgeProfile: "square",     // sharp 90° edges
    construction: "frameless",
    grainDirection: "vertical", // grain runs vertical on doors
    hingeType: "concealed_110",
    pricingTier: "standard",   // base price, no upcharge
    compatibleFinishes: ["painted", "thermofoil", "high_gloss", "matte_lacquer", "natural_wood"],
    ceilingTreatment: "straight_fill", // Modern → straight fill to ceiling, no crown
    molding: {
      crown: false,
      lightRail: false, // clean bottom edge, no molding
      toeCap: "recessed", // modern recessed toe kick
    },
    typicalProjects: ["ultra_modern", "minimalist", "contemporary"],
    eclipseSuffix: "",  // base SKU (B36, W3639, etc.)
  },

  // ── SHAKER ────────────────────────────────────────────────────
  "Shaker": {
    id: "shaker",
    category: "transitional",
    description: "Recessed center panel with square-edge stile and rail",
    doorThickness: 0.75,
    reveal: 0.125,
    overlay: "full",
    edgeProfile: "square_inner_bevel",
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_110",
    pricingTier: "standard",
    compatibleFinishes: ["painted", "stained", "natural_wood"],
    ceilingTreatment: "crown",
    molding: {
      crown: true,
      lightRail: true,
      toeCap: "standard",
    },
    typicalProjects: ["transitional", "modern_farmhouse", "coastal"],
    eclipseSuffix: "",
  },

  // ── RAISED PANEL ──────────────────────────────────────────────
  "Raised Panel": {
    id: "raised_panel",
    category: "traditional",
    description: "Center panel raised above stile/rail with decorative edge profile",
    doorThickness: 0.875,      // 7/8"
    reveal: 0.125,
    overlay: "full",
    edgeProfile: "ogee",       // decorative outer edge
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_110",
    pricingTier: "premium",    // upcharge for profile machining
    compatibleFinishes: ["stained", "glazed", "distressed", "painted"],
    ceilingTreatment: "crown",
    molding: {
      crown: true,
      crownProfile: "traditional",  // ornate profile
      lightRail: true,
      lightRailProfile: "ogee",
      toeCap: "standard",
    },
    typicalProjects: ["traditional", "classic", "french_country"],
    eclipseSuffix: "",
  },

  // ── BEADED INSET ──────────────────────────────────────────────
  "Beaded Inset": {
    id: "beaded_inset",
    category: "traditional",
    description: "Inset door with beaded detail around opening",
    doorThickness: 0.75,
    reveal: 0.0625,            // 1/16" — inset doors have tighter reveal
    overlay: "inset",          // door sits inside the box opening
    edgeProfile: "bead",
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_inset",
    pricingTier: "ultra_premium",
    compatibleFinishes: ["painted", "stained"],
    ceilingTreatment: "crown",
    molding: {
      crown: true,
      crownProfile: "traditional",
      lightRail: true,
      toeCap: "furniture_foot",
    },
    typicalProjects: ["luxury_traditional", "historic_renovation"],
    eclipseSuffix: "-INS",
  },

  // ── GLASS FRONT ───────────────────────────────────────────────
  "Glass Front": {
    id: "glass_front",
    category: "transitional",
    description: "Frame with glass insert (clear, seeded, or frosted)",
    doorThickness: 0.75,
    reveal: 0.125,
    overlay: "full",
    edgeProfile: "square",
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_110",
    pricingTier: "premium",
    glassOptions: ["clear", "seeded", "frosted", "leaded", "reeded"],
    compatibleFinishes: ["painted", "stained", "natural_wood"],
    ceilingTreatment: "crown",
    molding: {
      crown: true,
      lightRail: true,
      toeCap: "standard",
    },
    typicalProjects: ["display_uppers", "china_cabinet", "butler_pantry"],
    eclipseSuffix: "-GFD",
  },

  // ── GOLA (HANDLELESS) ────────────────────────────────────────
  "Gola": {
    id: "gola",
    category: "modern",
    description: "Integrated aluminum channel replaces handles — true handleless",
    doorThickness: 0.75,
    reveal: 0.125,
    overlay: "full",
    edgeProfile: "square",
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_110",
    pricingTier: "premium",
    handleSystem: "integrated_channel",
    channelFinish: ["brushed_aluminum", "black_anodized", "stainless"],
    compatibleFinishes: ["high_gloss", "matte_lacquer", "thermofoil"],
    ceilingTreatment: "straight_fill",
    molding: {
      crown: false,
      lightRail: false,
      toeCap: "recessed",
    },
    typicalProjects: ["ultra_modern", "european_minimal"],
    eclipseSuffix: "FC-",  // Gola prefix (FC-B36, FC-W3639, etc.)
    skuPrefix: true,       // prefix goes BEFORE the base SKU
  },

  // ── FULL HEIGHT DOOR (FHD) ────────────────────────────────────
  "Full Height Door": {
    id: "fhd",
    category: "modern",
    description: "Single tall door covers entire cabinet face (no separate drawer front)",
    doorThickness: 0.75,
    reveal: 0.125,
    overlay: "full",
    edgeProfile: "square",
    construction: "frameless",
    grainDirection: "vertical",
    hingeType: "concealed_170",  // wide-open hinge for tall doors
    pricingTier: "standard",
    compatibleFinishes: ["painted", "high_gloss", "matte_lacquer", "thermofoil"],
    ceilingTreatment: "straight_fill",
    molding: {
      crown: false,
      lightRail: false,
      toeCap: "recessed",
    },
    typicalProjects: ["premium_modern", "high_end_kitchen"],
    eclipseSuffix: "-FHD",
  },
};

/**
 * Style Logic Bridge
 * ===================
 * Maps design style preferences to door selection + ceiling/molding treatment.
 *
 * Modern  → Slab + straight fill to ceiling + no crown + recessed toe kick
 * Transitional → Shaker + crown molding + light rail + standard toe kick
 * Traditional → Raised Panel + crown molding + light rail + decorative toe kick
 * Ultra-modern → Gola (handleless) + straight fill + no crown
 *
 * @param {string} designStyle - "modern" | "transitional" | "traditional" | "ultra_modern"
 * @param {string} sophistication - "standard" | "high" | "very_high"
 * @returns {Object} { doorStyle, ceilingTreatment, crownStyle, lightRail, toeKickStyle, golaChannel }
 */
export function styleLogicBridge(designStyle, sophistication = 'high') {
  const mapping = {
    modern: {
      doorStyle: sophistication === 'very_high' ? 'Gola' : 'Slab',
      ceilingTreatment: 'to_ceiling',
      crownStyle: null,
      lightRail: false,
      lightRailProfile: null,
      toeKickStyle: 'recessed',
      golaChannel: sophistication === 'very_high',
      valance: false,
      glassInserts: false,
    },
    transitional: {
      doorStyle: 'Shaker',
      ceilingTreatment: 'crown',
      crownStyle: 'standard',
      lightRail: true,
      lightRailProfile: 'simple',
      toeKickStyle: 'standard',
      golaChannel: false,
      valance: true,
      glassInserts: sophistication === 'very_high',
    },
    traditional: {
      doorStyle: sophistication === 'very_high' ? 'Beaded Inset' : 'Raised Panel',
      ceilingTreatment: 'crown',
      crownStyle: sophistication === 'very_high' ? 'ornate' : 'standard',
      lightRail: true,
      lightRailProfile: 'ogee',
      toeKickStyle: sophistication === 'very_high' ? 'furniture' : 'standard',
      golaChannel: false,
      valance: true,
      glassInserts: true,
    },
    ultra_modern: {
      doorStyle: 'Gola',
      ceilingTreatment: 'to_ceiling',
      crownStyle: null,
      lightRail: false,
      lightRailProfile: null,
      toeKickStyle: 'recessed',
      golaChannel: true,
      valance: false,
      glassInserts: false,
    },
    farmhouse: {
      doorStyle: 'Shaker',
      ceilingTreatment: 'crown',
      crownStyle: 'standard',
      lightRail: true,
      lightRailProfile: 'cove',
      toeKickStyle: 'furniture',
      golaChannel: false,
      valance: true,
      glassInserts: true,
    },
  };

  return mapping[designStyle] || mapping.transitional;
}

/**
 * Get door geometry for a specific style.
 * Returns thickness, reveal, and overlay for the renderer.
 *
 * @param {string} doorStyleName - Name from ECLIPSE_DOOR_STYLES
 * @returns {Object} { thickness, reveal, overlay, edgeProfile }
 */
export function getDoorGeometry(doorStyleName) {
  const style = ECLIPSE_DOOR_STYLES[doorStyleName];
  if (!style) {
    return { thickness: 0.75, reveal: 0.125, overlay: 'full', edgeProfile: 'square' };
  }
  return {
    thickness: style.doorThickness,
    reveal: style.reveal,
    overlay: style.overlay,
    edgeProfile: style.edgeProfile,
  };
}

/**
 * Get all style names grouped by category.
 */
export function getStylesByCategory() {
  const result = {};
  for (const [name, style] of Object.entries(ECLIPSE_DOOR_STYLES)) {
    if (!result[style.category]) result[style.category] = [];
    result[style.category].push({ name, ...style });
  }
  return result;
}
