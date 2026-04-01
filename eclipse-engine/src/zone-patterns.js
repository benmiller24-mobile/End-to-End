/**
 * Eclipse Kitchen Designer — Zone-Based Pattern Library (Phase 2)
 * ================================================================
 * Mined from 39 Eclipse training projects. Provides data-driven cabinet
 * selection rules for each functional zone in a kitchen layout.
 *
 * Used by the solver to:
 *   - Pick corner treatments based on layout type and available width
 *   - Select sink bases and flanking cabinets
 *   - Choose range-flanking sequences
 *   - Build fridge pods (tall columns + wall cabs above)
 *   - Size upper cabinets relative to their base runs
 *   - Decide filler vs. width modification
 *   - Apply material spec rules (single-tone, two-tone, stain+paint)
 */


// ═══════════════════════════════════════════════════════════════════════════════
// 1. CORNER TREATMENT SELECTION
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 10 corner occurrences across 39 projects
//
// BL36-SS-PH (Blind 36" w/ Super Susan & Pull Hardware) — most common (5×)
//   Lofton, Diehl, Eddies, Los Alamos, Showroom ECLA
// BBC (Blind Base Corner w/ quarter-turn shelves) — 2×
//   Bissegger Great Room (BBC42R-S), Bollini (BBC48R-MC)
// BL36-PHL (Blind 36" w/ Pull Hardware Left) — 1×
//   DeLawyer

export const CORNER_TREATMENTS = {
  blindSuperSusan: {
    sku: "BL36-SS-PH",
    width: 36,
    frequency: 5,
    description: "36\" blind corner with Super Susan lazy susan and pull hardware",
    bestFor: ["L-shape", "U-shape", "galley"],
    trainingOccurrences: [
      "Lofton (BL36-SS-PH-L)",
      "Diehl (BL36-SS-PH-L)",
      "Eddies (BL36-SS-PH-R)",
      "Los Alamos (BL36-SS-PH-L)",
      "Showroom ECLA (BL36-SS-PH-L)",
    ],
    note: "Default corner treatment for most kitchens. 36\" width standard. -L or -R suffix sets hinge side.",
  },
  blindCornerMagic: {
    sku: "BBC",
    widths: [42, 48],
    frequency: 2,
    description: "Blind base corner with quarter-turn shelves (magic corner)",
    bestFor: ["large kitchens", "premium builds"],
    trainingOccurrences: [
      "Bissegger Great Room (BBC42R-S, with PTKL plywood toe kick)",
      "Bollini (BBC48R-MC, 48\" magic corner — largest in training)",
    ],
    note: "Premium option. BBC42R-S for standard, BBC48R-MC for wide kitchens. Bollini used 48\" for $64K+ build.",
  },
  blindPullHardware: {
    sku: "BL36-PHL",
    width: 36,
    frequency: 1,
    description: "36\" blind corner with pull hardware only (no lazy susan)",
    bestFor: ["budget builds", "minimal kitchens"],
    trainingOccurrences: ["DeLawyer (BL36-PHL — PET laminate, $19K budget build)"],
    note: "Budget option — no lazy susan mechanism. DeLawyer was a $19K PET laminate kitchen.",
  },
};

// Decision function: choose corner treatment based on context
export function selectCornerTreatment(options = {}) {
  const { budget = "standard", layoutType, availableWidth = 36 } = options;

  if (budget === "premium" || availableWidth >= 42) {
    return {
      ...CORNER_TREATMENTS.blindCornerMagic,
      selectedWidth: availableWidth >= 48 ? 48 : 42,
      selectedSku: availableWidth >= 48 ? "BBC48R-MC" : "BBC42R-S",
    };
  }
  if (budget === "budget") {
    return { ...CORNER_TREATMENTS.blindPullHardware, selectedSku: "BL36-PHL" };
  }
  // Default: Super Susan
  return { ...CORNER_TREATMENTS.blindSuperSusan, selectedSku: "BL36-SS-PH" };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. SINK ZONE PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 9 sink zones
//
// Sink base types:
//   SB36 (standard 36" sink base) — 3× (Diehl, Gable, Kline Piazza)
//   SBA36 (apron-front/farmhouse) — 2× (Gable, Bissegger)
//   SB33-FHD (33" full-height door) — 1× (DeLawyer)
//   SB42-1DR (42" single drawer) — 1× (Eddies)
//   SB33 (standard 33") — 1× (Los Alamos)
//   SB36-FHD (36" full-height door) — 1× (Showroom ECLA)
//
// Flanking patterns (most common):
//   Drawer bases (B3D, B4D) on both sides — 5× (standard approach)
//   Mixed: drawer base + specialty (BWDMA, BPOS, B-RT) — 3×
//   Symmetrical drawer flanking — 2× (Lofton: B3D21+B3D18 on each side)

export const SINK_ZONE_RULES = {
  sinkBases: {
    standard: { sku: "SB36", width: 36, frequency: 3, note: "Most common. Standard 36\" sink base." },
    apronFront: { sku: "SBA36", width: 36, frequency: 2, note: "Farmhouse/apron-front sink. Premium kitchens (Gable, Bissegger)." },
    wide: { sku: "SB42-1DR", width: 42, frequency: 1, note: "Extra-wide 42\" with single drawer. Eddies kitchen." },
    compact: { sku: "SB33", width: 33, frequency: 1, note: "Compact 33\". Los Alamos." },
    fullHeightDoor: { sku: "SB36-FHD", width: 36, frequency: 1, note: "Full-height door variant. Showroom ECLA." },
  },

  flankingPreferences: [
    {
      id: "drawer_bases_both_sides",
      description: "Drawer bases (B3D or B4D) flanking sink on both sides",
      frequency: 5,
      examples: [
        "Gable: B4D33 + SBA36 + B3D30",
        "Diehl: B3D27 + B4D15 + SB36 + B3D30",
        "Lofton: B3D21 + B3D18 + SB36 + B3D21 + B3D18 (symmetrical)",
      ],
      note: "Default choice. Drawer bases provide max storage near sink. Symmetrical when possible.",
    },
    {
      id: "mixed_specialty_flanking",
      description: "Mix of drawer base + specialty cabinet (waste bin, pull-out, dishwasher panel)",
      frequency: 3,
      examples: [
        "Kline Piazza: B3D24 + BWDMA18 + SB36 + B4D18 + B30-RT",
        "Eddies: B24-2D + BPOS-9 + SB42 + B18R + BWDMB18",
        "DeLawyer: BFSO24-FHDR + SB33-FHD + BWDMA18-FHD",
      ],
      note: "Waste/dishwasher cab (BWDMA/BWDMB) typically adjacent to sink. Pull-out shelves (BPOS) for convenience.",
    },
  ],

  // Dishwasher/waste management placement rule
  dishwasherRule: {
    placement: "adjacent_to_sink",
    cabTypes: ["BWDMA", "BWDMB", "BWDMW"],
    frequency: 4,
    note: "Dishwasher/waste management cabinet always directly adjacent to sink base. BWDMA=appliance door, BWDMB=matching door, BWDMW=waste.",
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// 3. RANGE ZONE PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 8 range zones
//
// Range widths: 30" (2×), 36" (1×), 48" (1×), unspecified (4×)
//
// Flanking patterns:
//   BPOS (pull-out shelf) adjacent to range — 2× (Gable, Kline Piazza)
//   B-RT (roll-out tray) adjacent to range — 2× (Gable, Kline Piazza)
//   Drawer bases (B3D) flanking — 5× (most common)
//   BL36 at corner + flanking — 3× (DeLawyer, Eddies, Lofton — when range is near corner)
//
// Upper cabinet pattern above range:
//   Symmetrical pair flanking range hood — standard (Gable: W2736 + W2736)
//   Single wide wall cab above range when no hood vent

export const RANGE_ZONE_RULES = {
  standardRangeWidths: [30, 36, 48],

  flankingPreferences: [
    {
      id: "pullout_and_rollout",
      description: "Pull-out shelf (BPOS) and/or roll-out tray (B-RT) flanking range",
      frequency: 4,
      examples: [
        "Gable: BPOS-12 + [RANGE] + B18R-RT",
        "Kline Piazza: BPOS-12 + [RANGE] (range in island)",
        "Bollini: B22¼L-RT + [RANGE] + B22¼R-RT (symmetrical roll-out trays)",
      ],
      note: "BPOS for spice/oil storage. B-RT for pots/pans. Often asymmetric: BPOS on one side, B-RT or B3D on other.",
    },
    {
      id: "drawer_bases",
      description: "Standard drawer bases (B3D) flanking range",
      frequency: 5,
      examples: [
        "Los Alamos: B3D22½ + [RANGE] + B3D22½ (symmetrical)",
        "Eddies: BL36 + [RANGE] + B3D36",
        "Lofton: B3D17 + [RANGE] + B3D21",
      ],
      note: "Default when no specialty storage needed. Try for equal widths when wall allows.",
    },
  ],

  upperAboveRange: {
    symmetricalPair: {
      description: "Pair of equal wall cabs flanking range hood zone",
      frequency: 4,
      examples: [
        "Gable: W2736 + [HOOD] + W2736",
        "Kline Piazza: W1539 + [HOOD] + W1539",
      ],
      note: "Default. Range hood creates gap in uppers. Flanking wall cabs match width when possible.",
    },
    stackedAbove: {
      description: "Stacked wall cabs above range (no separate hood vent)",
      frequency: 1,
      examples: ["Bollini: continuous upper run across range zone"],
      note: "Only when range has integrated downdraft or microwave hood above.",
    },
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// 4. FRIDGE POD PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 11 fridge zones
//
// Common components:
//   REP (refrigerator end panel) — flanks fridge opening. 3/4" to 3" thick.
//     REP3/4 96FTK (most common, 4×)
//     REP1.5 (thicker, 2× — Gable)
//     REP3 93FTK (3" thick, 1× — Kline Piazza)
//   RW (refrigerator wall cabinet) — above fridge
//     RW3621 (36"W × 21"H) most common (3×)
//     RW3633 (36"W × 33"H) for taller installs (2×)
//     RW3627 (36"W × 27"H) mid-height (1×)
//   Utility tower adjacent to fridge — common pairing
//     U1293L, U2190, UT2190, U3D2490L (varies by project)

export const FRIDGE_POD_RULES = {
  endPanels: {
    standard: { sku: "REP3/4", height: 96, suffix: "FTK", frequency: 4, note: "3/4\" thick, 96\"H with flush toe kick. Most common." },
    medium: { sku: "REP1.5", height: 93, frequency: 2, note: "1.5\" thick. Gable used for more substantial look." },
    heavy: { sku: "REP3", height: 93, suffix: "FTK", frequency: 1, note: "3\" thick premium. Kline Piazza." },
  },

  wallCabAboveFridge: {
    short: { sku: "RW3621", width: 36, height: 21, frequency: 3, note: "Most common. 21\"H for standard fridge height." },
    tall: { sku: "RW3633", width: 36, height: 33, frequency: 2, note: "33\"H for shorter fridges or taller ceiling." },
    mid: { sku: "RW3627", width: 36, height: 27, frequency: 1, note: "27\"H medium height. Bissegger." },
    widthRule: "Match fridge opening width (typically 36\")",
    heightRule: "Fill gap between top of fridge and soffit/ceiling. 21\"H standard, 33\"H if space allows.",
  },

  adjacentTall: {
    description: "Utility tower next to fridge is common pairing",
    frequency: 5,
    examples: [
      "Diehl: U1293L (24\"W × 93\"H × 24\"D) next to fridge",
      "DeLawyer: UT2190-RT-27-L (21\"W × 90\"H) with roll-out trays",
      "Gable: U3D2490L-27 (24\"W × 90\"H) 3-door utility",
      "Bollini: U21117-27L + U21102-27R (dual 117\"H columns flanking fridge)",
    ],
    note: "Utility tall (U/UT) provides pantry storage. 93\"H standard, up to 117\"H for premium builds.",
  },

  typicalSequence: "REP + [FRIDGE] + REP + RW above | Optional: UT or U tower adjacent",
};


// ═══════════════════════════════════════════════════════════════════════════════
// 5. ISLAND CABINET PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 18 island wall entries across 10 projects
//
// Work side (facing kitchen): standard depth bases (B, B3D, B4D, SB)
// Display/seating side: shallow FHD bases (B-FHD at 13" depth) or end panels

export const ISLAND_RULES_EXTENDED = {
  workSide: {
    description: "Standard-depth bases facing the kitchen work zone",
    typicalCabs: ["B3D", "B4D", "B24", "SB36", "BTD-9", "BWDMB"],
    examples: [
      "Bollini: BTD-9 + SB36-FHD + BWDMB18 + B4D18",
      "Diehl: B24L + B3D36 + B24R (symmetrical flanking)",
      "Eddies: B30 + BO24 + B30 (symmetrical with built-in oven)",
    ],
    note: "Work side follows same rules as perimeter. Sink in island gets standard flanking.",
  },
  displaySide: {
    description: "Shallow full-height-door bases on display/seating side",
    typicalCabs: ["B-FHD", "EDGTS"],
    depth: 13.875,
    examples: [
      "Diehl: EDGTS + B24L-FHD + B36-FHD + B24R-FHD + EDGTS (dual end gable trim)",
      "Eddies: B27-FHD + B30-FHD + B27-FHD",
      "Kline Piazza: B22½L-FHD + B22½R-FHD + B42-FHD + B42-FHD",
    ],
    note: "FHD (Full Height Door) bases at 13\" depth create display shelving. EDGTS = end gable trim.",
  },
  endPanels: {
    description: "End panels on exposed island sides",
    examples: [
      "Diehl: EDGTS|39|35.5 on each end of display side",
      "Kline Piazza: BEP3 on exposed ends",
    ],
    note: "Always panel exposed ends. EDGTS or BEP3-FTK standard.",
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// 6. UPPER CABINET SIZING RULES
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 15 wall pairs with both bases and uppers
//
// Average upper/base width ratio: 0.70
// Upper height frequency: 39" (3×), 36" (2×), 48" (2×), 63" (2×), 24" (2×)
//
// Key findings:
//   - Walls with range hoods or windows have 0.58-0.64 ratio (gap reduces upper total)
//   - Walls without gaps have 0.47-0.86 ratio depending on layout
//   - 36" and 39" are most common upper heights for standard ceiling
//   - 48" and 63" for tall/stacked applications

export const UPPER_SIZING_RULES = {
  heightsByContext: {
    standard: { height: 36, note: "Standard upper height for 8' ceiling. Gable used 36\" throughout." },
    tall: { height: 39, note: "Slightly taller uppers for 8'-6\" or 9' ceilings. Diehl, Eddies, Kline." },
    stacked: { height: 48, note: "Stacked uppers for high ceilings. Helmer Mitchell (48\")." },
    floorToCeiling: { height: 63, note: "Full floor-to-ceiling uppers. Bollini ($64K premium build)." },
  },

  widthRatioToBase: {
    withGap: {
      avgRatio: 0.63,
      range: [0.34, 1.07],
      note: "When range hood or window creates gap, uppers cover ~63% of base run width.",
    },
    withoutGap: {
      avgRatio: 0.60,
      range: [0.28, 0.86],
      note: "Without gaps, uppers still typically narrower than bases (fillers, end panels take space).",
    },
  },

  // Width matching: uppers should align with bases below when possible
  widthAlignment: {
    rule: "Match upper width to base width below when feasible",
    examples: [
      "Gable: W2736 over B18R-RT+BPOS-12 (27\" upper spans 30\" of bases — close match)",
      "Gable: W3336 over B4D33 (exact match: 33\" over 33\")",
      "DeLawyer: W2124 over B4D21 (exact match: 21\" over 21\")",
    ],
    exceptions: [
      "Range hood zone: symmetric pair flanking, width determined by available space",
      "Window zone: uppers stop at window edges, width determined by window width",
    ],
    note: "Perfect alignment not always possible but aesthetically preferred.",
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// 7. FILLER VS. MODIFICATION DECISION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 7 filler usages, 104 modification usages (35 width mods)
//
// Key insight: Eclipse STRONGLY prefers width modifications over fillers.
// Only 7 fillers found (all OVF — overlay filler for zone transitions)
// vs. 35 width modifications (MOD WIDTH N/C, MOD/SQ30, MOD/SQ50)
//
// Width Mod Pricing:
//   MOD WIDTH N/C — free if within 30% of nominal width (22×)
//   MOD/SQ30 — $91-$194 surcharge when >30% but ≤50% (6×)
//   MOD/SQ50 — $968 surcharge for utility talls (2× — Bollini premium build)
//
// Fillers are used ONLY for:
//   OVF (overlay filler) at zone transitions — 7 uses, all 3" width
//   F3 tall fillers at wall terminals — common in tall/pantry zones (not captured in base filler count)

export const FILLER_MOD_RULES = {
  preference: "modification_over_filler",
  summary: "Eclipse training data shows 5:1 ratio of width mods to fillers. Prefer modifying cabinet width.",

  widthModTiers: {
    free: {
      code: "MOD WIDTH N/C",
      threshold: "Within 30% of nominal width",
      frequency: 22,
      note: "No charge for width modifications within 30% of standard size. Most common approach.",
    },
    sq30: {
      code: "MOD/SQ30",
      threshold: "Outside 30% but width mod still feasible",
      priceRange: "$91-$194",
      frequency: 6,
      note: "30% surcharge on list price. Used for panels (REP, BEP) and modest oversize cabs.",
    },
    sq50: {
      code: "MOD/SQ50",
      threshold: "Major size change on premium components",
      priceRange: "$968+",
      frequency: 2,
      note: "50% surcharge. Only on Bollini ($64K build) for 117\" utility talls. Rare.",
    },
  },

  fillerUseCases: {
    zoneTransition: {
      sku: "OVF3",
      width: 3,
      frequency: 7,
      description: "3\" overlay filler at zone transitions (e.g., corner to main run, appliance gap)",
      projects: ["DeLawyer (4×)", "Kline Piazza (2×)", "Showroom ECLA (1×)"],
      note: "Only filler type found in bases. Always 3\" wide. Used at material/zone boundaries.",
    },
    tallTerminal: {
      skuPattern: "F3{height}",
      description: "Tall fillers at wall terminals flanking tall cabinets",
      note: "F3108, F3102, F396 — match height of adjacent tall cabinet. Terminal closure.",
    },
    wallFiller: {
      skuPattern: "WF{width}",
      description: "Wall fillers between wall cabinets at corners or transitions",
      note: "Less common than base fillers. Used at upper corner junctions.",
    },
  },

  decisionFunction: {
    description: "When a gap exists between cabinet nominal sizes and wall length",
    steps: [
      "1. Calculate gap: wallLength - sum(cabinetWidths)",
      "2. If gap ≤ 3\": add OVF3 filler (zone transition)",
      "3. If gap > 3\" and ≤ 30% of adjacent cabinet: use MOD WIDTH N/C (free)",
      "4. If gap > 30% of adjacent cabinet: use MOD/SQ30 ($91-$194) or split into 2 mods",
      "5. If no single cab can absorb: add tall filler (F3) at terminal end",
    ],
  },

  // Most common non-width modifications
  topModifications: [
    { code: "PTKL", description: "Plywood toe kick", frequency: 16, note: "Most common mod overall. Upgrades toe kick to plywood." },
    { code: "18\" DEPTH OPTION", description: "Shallow 18\" depth base", frequency: 8, note: "For pantry, butler's pantry zones." },
    { code: "FDS", description: "Finished door side", frequency: 6, note: "Exposed cabinet sides get finished panel." },
    { code: "13\" DEPTH OPTION", description: "Very shallow 13\" base", frequency: 6, note: "Display shelving, island back side." },
    { code: "RBS", description: "Recessed bottom shelf", frequency: 4, note: "Bottom shelf recessed for under-cabinet lighting." },
    { code: "16\" DEPTH OPTION", description: "16\" depth base", frequency: 3, note: "Bar zone, peninsula." },
    { code: "WCD2", description: "Wine cooler door modification", frequency: 2, note: "For integrated wine cooler cabinets." },
    { code: "AVENTOS HK", description: "Aventos lift system", frequency: 2, note: "For wall cabs with lift-up doors (appliance garage)." },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// 8. MATERIAL SPECIFICATION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
// Training data: 39 projects
//   Single-spec: 23 projects (59%)
//   Two-tone: 9 projects (23%)
//   Stain+Paint mix: 4 projects (10%)
//
// Species frequency:
//   Maple (13×) — most common, used for paint finishes
//   Walnut (4×), White Oak (4×) — premium stain species
//   Rift Cut White Oak (2×), TFL (2×), Cherry (1×), Alder (1×), etc.
//
// Door style frequency:
//   Hanover FP {A} (9×) — most versatile
//   Metropolitan VG {A} (7×) — modern flat panel
//   Malibu FP {A} (4×) — contemporary
//   Scottsdale FP {A} (3×) — versatile across single/two-tone
//   Napa VG FP {A} (2×) — premium with vertical grain

export const MATERIAL_SPEC_RULES = {
  singleTone: {
    frequency: 23,
    percentage: 59,
    description: "One material spec for entire project",
    commonCombinations: [
      { species: "Maple", finish: "paint", doorStyle: "Hanover FP {A}", note: "Budget-friendly painted Maple. Most common single-spec." },
      { species: "Maple", finish: "paint", doorStyle: "Metropolitan VG {A}", note: "Modern painted look." },
      { species: "White Oak", finish: "stain", doorStyle: "Malibu FP {A}", note: "Premium natural wood." },
    ],
  },

  twoTone: {
    frequency: 9,
    percentage: 23,
    description: "Two material specs — different zones get different treatments",
    patterns: [
      {
        id: "stain_bases_paint_uppers",
        description: "Stained bases + painted uppers",
        frequency: 3,
        examples: [
          "Gable: Walnut/Rye bases + Maple/Polar Paint uppers (Napa VG FP)",
          "Kline Piazza: Walnut/Rye perimeter bases + Maple/Shoji White uppers + Maple/Outer Space island",
          "Lofton: Walnut/Natural bases + HPL/Designer White uppers (Metropolitan VG)",
        ],
        zoneAssignment: { bases: "stain", uppers: "paint", island: "either" },
        note: "Most common two-tone pattern. Warm stained wood on bases, clean painted uppers.",
      },
      {
        id: "paint_paint_different_colors",
        description: "Two different paint colors",
        frequency: 3,
        examples: [
          "McComb: Maple/Shoji White perimeter + Maple/Slate Tile island",
          "Owen: Maple/Light French Gray perimeter + Rustic Hickory/Burnt Sugar island",
        ],
        zoneAssignment: { perimeter: "color_A", island: "color_B" },
        note: "Different paint colors for perimeter vs. island. Creates visual contrast.",
      },
      {
        id: "door_group_contrast",
        description: "Same species/color but different door styles (Group A + Group B)",
        frequency: 2,
        examples: [
          "Bissegger: Rift Cut White Oak/Yosemite — Malibu FP {A} main + Malibu Reeded Panel {B} accent",
          "McCarter Parade: White Oak/Almond — same door but different catalog/zone assignment",
        ],
        zoneAssignment: { main: "group_A_door", accent: "group_B_door" },
        note: "Subtle contrast through door style texture rather than color.",
      },
    ],
  },

  threeTone: {
    frequency: 1,
    description: "Three material specs — rare, premium builds only",
    example: "Kline Piazza: Walnut/Rye bases + Maple/Shoji White uppers + Maple/Outer Space island",
    note: "Only one project used 3 specs. Requires careful zone boundaries.",
  },

  speciesSelection: {
    forPaint: ["Maple"],
    forStain: ["Walnut", "White Oak", "Cherry", "Alder", "Hickory", "Rift Cut White Oak"],
    forBudget: ["Thermally Fused Laminate", "PET Laminate", "HPL"],
    note: "Maple is universal paint substrate. Premium stains use natural hardwoods. TFL/PET/HPL for budget.",
  },

  doorStyleFrequency: [
    { style: "Hanover FP {A}", count: 9, group: "A", note: "Most versatile — works in all layouts." },
    { style: "Metropolitan VG {A}", count: 7, group: "A", note: "Modern flat panel. Popular with GOLA." },
    { style: "Malibu FP {A}", count: 4, group: "A", note: "Contemporary look." },
    { style: "Scottsdale FP {A}", count: 3, group: "A", note: "Versatile across single/two-tone." },
    { style: "Napa VG FP {A}", count: 2, group: "A", note: "Premium with vertical grain texture." },
    { style: "Hartford FP {A}", count: 1, group: "A", note: "Clean modern. Bollini ($64K)." },
    { style: "Ward FP {A}", count: 1, group: "A", note: "Firebird two-tone stain+paint." },
    { style: "Malibu Reeded Panel {B}", count: 1, group: "B", note: "Group B ($44/door upcharge). Texture accent." },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// 9. PENINSULA PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

export const PENINSULA_ZONE_RULES = {
  frequency: 3,
  description: "Peninsula returns with shallow or standard bases",
  examples: [
    "Gable: B12L-FHD + B3D36 (12\" FHD + 36\" drawer base on return wall)",
    "Showroom ECLD: peninsula zone (details in structured JSON)",
    "Ward: peninsula zone",
  ],
  note: "Peninsulas less common than islands in training data. Treat similarly to island display side.",
};


// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export const ZONE_PATTERN_METADATA = {
  version: "2.0.0",
  extractedFrom: "39 Eclipse training projects",
  excludes: "5 Shiloh-only projects (JRS Bath, JRS Bar, JRS Kitchen, McCarter Powder, WRS Beatty Master)",
  patterns: [
    "CORNER_TREATMENTS — 3 corner types, selection function",
    "SINK_ZONE_RULES — 5 sink base types, 2 flanking strategies, dishwasher rule",
    "RANGE_ZONE_RULES — 2 flanking strategies, upper placement rules",
    "FRIDGE_POD_RULES — end panels, wall cabs, adjacent tall pairing",
    "ISLAND_RULES_EXTENDED — work side vs. display side, end panels",
    "UPPER_SIZING_RULES — height by context, width ratios, alignment",
    "FILLER_MOD_RULES — modification tiers, filler use cases, decision logic",
    "MATERIAL_SPEC_RULES — single/two/three-tone, species, door styles",
    "PENINSULA_ZONE_RULES — peninsula treatment",
  ],
};
