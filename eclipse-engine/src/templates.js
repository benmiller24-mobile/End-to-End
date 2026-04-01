/**
 * Eclipse Kitchen Designer — Room Template Library
 * ==================================================
 * Pre-built room configurations for quick starts.
 * Each template is a complete solve() input object with real-world
 * kitchen layouts: galley, L-shape, U-shape, single-wall, peninsula, island, and utility rooms.
 */

/**
 * Template structure:
 * @typedef {Object} Template
 * @property {string} id - Unique template identifier (kebab-case)
 * @property {string} name - Human-readable template name
 * @property {string} description - Brief description of use case
 * @property {string} category - Category: galley, l-shape, u-shape, single-wall, peninsula, island, utility
 * @property {Object} input - Complete solve() input object (walls, appliances, prefs, island, peninsula)
 */

// ─── TEMPLATE LIBRARY ───────────────────────────────────────────────────────

const TEMPLATES = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GALLEY KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "galley_small",
    name: "Small Galley Kitchen",
    description: "Compact parallel-wall kitchen for apartments and small spaces",
    category: "galley",
    input: {
      layoutType: "galley",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 96, role: "sink" },
        { id: "B", length: 96, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 30, wall: "B", position: "left" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  {
    id: "galley_large",
    name: "Large Galley Kitchen",
    description: "Spacious parallel-wall kitchen with full appliance suite",
    category: "galley",
    input: {
      layoutType: "galley",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 144, role: "sink" },
        { id: "B", length: 144, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "left" },
      ],
      prefs: { sophistication: "high" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-SHAPE KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "l_shape_standard",
    name: "Standard L-Shape Kitchen",
    description: "Traditional L-shape with sink on long wall, range on short wall",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 156, role: "sink" },
        { id: "B", length: 120, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "A", position: "end" },
      ],
      prefs: { sophistication: "high" },
    },
  },

  {
    id: "l_shape_premium",
    name: "Premium L-Shape Kitchen",
    description: "Upscale L-shape with 108\" ceilings and premium appliances",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 180, ceilingHeight: 108, role: "sink" },
        { id: "B", length: 144, ceilingHeight: 108, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 36, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "very_high" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // U-SHAPE KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "u_shape_family",
    name: "Family U-Shape Kitchen",
    description: "Family-sized U-shape with island for cooking and gathering",
    category: "u-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 156, role: "sink" },
        { id: "B", length: 120, role: "general" },
        { id: "C", length: 156, role: "range" },
      ],
      island: {
        length: 72,
        depth: 36,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "C", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
      ],
      prefs: { sophistication: "high", islandBackStyle: "fhd_seating" },
    },
  },

  {
    id: "u_shape_gourmet",
    name: "Gourmet U-Shape Kitchen",
    description: "Upscale U-shape with 48\" range, wall oven, wine cooler, and large island",
    category: "u-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 180, ceilingHeight: 108, role: "sink" },
        { id: "B", length: 144, ceilingHeight: 108, role: "general" },
        { id: "C", length: 180, ceilingHeight: 108, role: "range" },
      ],
      island: {
        length: 108,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 48, wall: "C", position: "center" },
        { type: "wallOven", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
        { type: "wineCooler", width: 24, wall: "B", position: "left" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE-WALL KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "single_wall_compact",
    name: "Compact Studio Kitchen",
    description: "Single-wall kitchen for studios and small apartments",
    category: "single-wall",
    input: {
      layoutType: "single-wall",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 120, role: "general" },
      ],
      appliances: [
        { type: "sink", width: 30, wall: "A", position: "left" },
        { type: "range", width: 30, wall: "A", position: "center" },
        { type: "refrigerator", width: 30, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  {
    id: "single_wall_entertainer",
    name: "Entertaining Single-Wall Kitchen",
    description: "Long single-wall with island for entertaining",
    category: "single-wall",
    input: {
      layoutType: "single-wall",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 240, role: "general" },
      ],
      island: {
        length: 96,
        depth: 36,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "center-left" },
        { type: "range", width: 30, wall: "A", position: "center" },
        { type: "refrigerator", width: 36, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PENINSULA KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "peninsula_breakfast",
    name: "Peninsula Breakfast Kitchen",
    description: "Kitchen with peninsula for casual breakfast seating",
    category: "peninsula",
    input: {
      layoutType: "galley-peninsula",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 144, role: "sink" },
        { id: "B", length: 96, role: "range" },
      ],
      peninsula: {
        length: 60,
        depth: 24.875,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 30, wall: "B", position: "left" },
      ],
      prefs: { sophistication: "high", seatingStyle: "bar" },
    },
  },

  {
    id: "peninsula_l_shape",
    name: "L-Shape with Peninsula",
    description: "L-shape kitchen with peninsula extending from short wall for extra counter + seating",
    category: "peninsula",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 156, role: "sink" },
        { id: "B", length: 120, role: "range" },
      ],
      peninsula: {
        length: 72,
        depth: 24.875,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "A", position: "end" },
      ],
      prefs: { sophistication: "high", seatingStyle: "bar" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ISLAND-FOCUSED KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "island_centerpiece",
    name: "Island-Centerpiece Kitchen",
    description: "Chef's kitchen with large functional island as design centerpiece",
    category: "island",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 180, role: "sink" },
        { id: "B", length: 120, role: "range" },
      ],
      island: {
        length: 120,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "island", position: "center" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "refrigerator", width: 36, wall: "A", position: "end" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  {
    id: "island_double",
    name: "Double-Island Kitchen",
    description: "Grand kitchen with two islands — one prep, one seating/serving",
    category: "island",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 216, ceilingHeight: 108, role: "sink" },
        { id: "B", length: 156, ceilingHeight: 108, role: "general" },
        { id: "C", length: 216, ceilingHeight: 108, role: "range" },
      ],
      island: {
        length: 120,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 48, wall: "C", position: "center" },
        { type: "wallOven", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // L-SHAPE WITH ISLAND KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "l_island_family",
    name: "Family L-Shape + Island",
    description: "Classic L-shape with center island for prep and casual dining",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 168, role: "sink" },
        { id: "B", length: 132, role: "range" },
      ],
      island: {
        length: 84,
        depth: 36,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "high", islandBackStyle: "fhd_seating" },
    },
  },

  {
    id: "l_island_gourmet",
    name: "Gourmet L-Shape + Island",
    description: "Upscale L-shape with 48\" range, prep sink in island, and pantry wall",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 192, ceilingHeight: 108, role: "sink" },
        { id: "B", length: 156, ceilingHeight: 108, role: "range" },
      ],
      island: {
        length: 108,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "sink", width: 18, wall: "island", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 48, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // U-SHAPE WITH ISLAND KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "u_island_entertainer",
    name: "Entertainer's U-Shape + Island",
    description: "Open U-shape with oversized island for hosting — wine cooler and beverage center",
    category: "u-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 192, ceilingHeight: 108, role: "sink" },
        { id: "B", length: 156, ceilingHeight: 108, role: "general" },
        { id: "C", length: 192, ceilingHeight: 108, role: "range" },
      ],
      island: {
        length: 120,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 36, wall: "C", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
        { type: "wineCooler", width: 24, wall: "B", position: "left" },
        { type: "beverageCenter", width: 24, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GALLEY WITH ISLAND
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "galley_island",
    name: "Galley with Island",
    description: "Modern galley kitchen with center island for extra workspace and seating",
    category: "galley",
    input: {
      layoutType: "galley",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 168, role: "sink" },
        { id: "B", length: 168, role: "range" },
      ],
      island: {
        length: 72,
        depth: 36,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "left" },
      ],
      prefs: { sophistication: "high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN CONCEPT / GREAT ROOM KITCHENS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "open_concept_l",
    name: "Open Concept L-Shape",
    description: "Open-plan L-shape flowing into living space, island defines the room boundary",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 204, role: "sink" },
        { id: "B", length: 144, role: "range" },
      ],
      island: {
        length: 108,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 36, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "A", position: "end" },
        { type: "wallOven", width: 30, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  {
    id: "great_room",
    name: "Great Room Kitchen",
    description: "Grand kitchen for open great rooms — long single wall + oversized island with seating",
    category: "single-wall",
    input: {
      layoutType: "single-wall",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 264, ceilingHeight: 108, role: "general" },
      ],
      island: {
        length: 132,
        depth: 42,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center-left" },
        { type: "dishwasher", width: 24, wall: "A", position: "center" },
        { type: "range", width: 48, wall: "A", position: "center-right" },
        { type: "refrigerator", width: 36, wall: "A", position: "right" },
        { type: "wallOven", width: 30, wall: "A", position: "left" },
      ],
      prefs: { sophistication: "very_high", islandBackStyle: "fhd_seating" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALTY KITCHEN SHAPES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "g_shape",
    name: "G-Shape Kitchen",
    description: "Four-wall kitchen with peninsula return — maximum counter and storage space",
    category: "g-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 156, role: "sink" },
        { id: "B", length: 120, role: "general" },
        { id: "C", length: 156, role: "range" },
      ],
      peninsula: {
        length: 72,
        depth: 24.875,
      },
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "C", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
      ],
      prefs: { sophistication: "high" },
    },
  },

  {
    id: "broken_u",
    name: "Broken U Kitchen",
    description: "U-shape with pass-through opening on one side — great for open-plan flow",
    category: "u-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 144, role: "sink" },
        { id: "B", length: 72, role: "general" },
        { id: "C", length: 144, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "C", position: "center" },
        { type: "refrigerator", width: 36, wall: "C", position: "end" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  {
    id: "u_shape_compact",
    name: "Compact U-Shape Kitchen",
    description: "Efficient U-shape for smaller spaces — maximizes storage in tight footprint",
    category: "u-shape",
    input: {
      layoutType: "u-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 108, role: "sink" },
        { id: "B", length: 96, role: "general" },
        { id: "C", length: 108, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 30, wall: "A", position: "center" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "C", position: "center" },
        { type: "refrigerator", width: 30, wall: "B", position: "center" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  {
    id: "corner_sink",
    name: "Corner Sink L-Shape",
    description: "L-shape with diagonal corner sink — efficient triangle workflow",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 132, role: "sink" },
        { id: "B", length: 132, role: "range" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "end" },
        { type: "dishwasher", width: 24, wall: "A", position: "right" },
        { type: "range", width: 30, wall: "B", position: "center" },
        { type: "refrigerator", width: 36, wall: "B", position: "right" },
      ],
      prefs: { sophistication: "high" },
    },
  },

  {
    id: "bar_wet_bar",
    name: "Wet Bar / Beverage Center",
    description: "Compact wet bar with sink, undercounter fridge, and wine cooler",
    category: "utility",
    input: {
      layoutType: "single-wall",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 96, role: "general" },
      ],
      appliances: [
        { type: "sink", width: 18, wall: "A", position: "center" },
        { type: "wineCooler", width: 24, wall: "A", position: "left" },
        { type: "beverageCenter", width: 24, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "high" },
    },
  },

  {
    id: "outdoor_kitchen",
    name: "Outdoor Kitchen",
    description: "L-shape outdoor kitchen with grill station and bar seating",
    category: "l-shape",
    input: {
      layoutType: "l-shape",
      roomType: "kitchen",
      walls: [
        { id: "A", length: 120, role: "general" },
        { id: "B", length: 84, role: "general" },
      ],
      appliances: [
        { type: "range", width: 36, wall: "A", position: "center" },
        { type: "sink", width: 24, wall: "B", position: "center" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY ROOMS (non-kitchen)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "butler_pantry",
    name: "Butler's Pantry",
    description: "Service pantry with wine storage and prep area",
    category: "utility",
    input: {
      layoutType: "single-wall",
      roomType: "pantry",
      walls: [
        { id: "A", length: 96, role: "general" },
      ],
      appliances: [
        { type: "wineCooler", width: 24, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "standard" },
    },
  },

  {
    id: "laundry_room",
    name: "Laundry Room",
    description: "Laundry room with storage and fold-down counter",
    category: "utility",
    input: {
      layoutType: "single-wall",
      roomType: "laundry",
      walls: [
        { id: "A", length: 84, role: "general" },
      ],
      appliances: [],
      prefs: { sophistication: "standard" },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POWDER ROOM (HALF BATH)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "powder_room_compact",
    name: "Compact Powder Room",
    description: "Small half-bath vanity — single sink, minimal storage (30\"-36\" wide)",
    category: "powder_room",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 36, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 18, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "standard", vanityHeight: 36 },
    },
  },

  {
    id: "powder_room_standard",
    name: "Standard Powder Room",
    description: "Typical half-bath vanity with sink base and side storage (42\"-48\" wide)",
    category: "powder_room",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 48, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 24, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "standard", vanityHeight: 36 },
    },
  },

  {
    id: "powder_room_furniture",
    name: "Furniture-Style Powder Room",
    description: "Upscale half-bath with furniture-style vanity and decorative legs (48\"-60\")",
    category: "powder_room",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 60, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 24, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "high", vanityHeight: 36 },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER BATH
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "master_bath_single",
    name: "Master Bath — Single Vanity",
    description: "Single-sink floating vanity with storage towers (60\"-72\" wall)",
    category: "master_bath",
    input: {
      layoutType: "single-wall",
      roomType: "master_bath",
      walls: [
        { id: "A", length: 72, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "high", vanityHeight: 21, floatingVanity: true },
    },
  },

  {
    id: "master_bath_his_hers",
    name: "Master Bath — His & Hers Double Vanity",
    description: "Symmetrical double-sink vanity with center tower (96\"-120\" wall)",
    category: "master_bath",
    input: {
      layoutType: "single-wall",
      roomType: "master_bath",
      walls: [
        { id: "A", length: 120, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "left" },
        { type: "sink", width: 36, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "very_high", vanityHeight: 21, floatingVanity: true, doubleSink: true },
    },
  },

  {
    id: "master_bath_l_shape",
    name: "Master Bath — L-Shape Double Vanity",
    description: "Corner master bath with vanities on adjacent walls and makeup area",
    category: "master_bath",
    input: {
      layoutType: "l-shape",
      roomType: "master_bath",
      walls: [
        { id: "A", length: 96, role: "vanity" },
        { id: "B", length: 72, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 36, wall: "A", position: "center" },
        { type: "sink", width: 36, wall: "B", position: "center" },
      ],
      prefs: { sophistication: "very_high", vanityHeight: 21, floatingVanity: true, doubleSink: true },
    },
  },

  {
    id: "master_bath_luxury",
    name: "Master Bath — Luxury Suite",
    description: "Grand master bath with dual floating vanities, center tower, and linen storage (144\"+ wall)",
    category: "master_bath",
    input: {
      layoutType: "single-wall",
      roomType: "master_bath",
      walls: [
        { id: "A", length: 144, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 42, wall: "A", position: "left" },
        { type: "sink", width: 42, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "very_high", vanityHeight: 21, floatingVanity: true, doubleSink: true },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUEST BATH
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "guest_bath_compact",
    name: "Guest Bath — Compact Vanity",
    description: "Small guest bathroom with single-sink vanity (36\"-48\" wall)",
    category: "guest_bath",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 48, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 24, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "standard", vanityHeight: 36 },
    },
  },

  {
    id: "guest_bath_standard",
    name: "Guest Bath — Standard Vanity",
    description: "Typical guest bathroom with sink base and storage (48\"-60\" wall)",
    category: "guest_bath",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 60, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 30, wall: "A", position: "center" },
      ],
      prefs: { sophistication: "standard", vanityHeight: 36 },
    },
  },

  {
    id: "guest_bath_double",
    name: "Guest Bath — Double Vanity",
    description: "Guest bathroom with double-sink vanity for shared use (72\"-96\" wall)",
    category: "guest_bath",
    input: {
      layoutType: "single-wall",
      roomType: "vanity",
      walls: [
        { id: "A", length: 84, role: "vanity" },
      ],
      appliances: [
        { type: "sink", width: 30, wall: "A", position: "left" },
        { type: "sink", width: 30, wall: "A", position: "right" },
      ],
      prefs: { sophistication: "high", vanityHeight: 36, doubleSink: true },
    },
  },
];

// ─── TEMPLATE FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Get a single template by ID (returns deep clone)
 * @param {string} id - Template ID (e.g., "galley_small")
 * @returns {Template|null} Template object or null if not found
 */
export function getTemplate(id) {
  const template = TEMPLATES.find(t => t.id === id);
  if (!template) return null;
  return JSON.parse(JSON.stringify(template));
}

/**
 * List all templates, optionally filtered by category
 * @param {string} [category] - Optional category filter (galley, l-shape, u-shape, etc.)
 * @returns {Array} Array of {id, name, description, category} objects
 */
export function listTemplates(category) {
  return TEMPLATES
    .filter(t => !category || t.category === category)
    .map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
    }));
}

/**
 * Get unique list of template categories
 * @returns {Array<string>} Sorted array of unique categories
 */
export function getTemplateCategories() {
  const categories = new Set(TEMPLATES.map(t => t.category));
  return Array.from(categories).sort();
}

/**
 * Solve a template with optional overrides
 * Applies overrides to the template input before solving.
 * Caller must import solve() separately and pass it as a param to avoid circular deps.
 * @param {string} id - Template ID
 * @param {Function} solve - The solve function from solver.js
 * @param {Object} [overrides] - Optional object to merge into prefs
 *   Example: { prefs: { sophistication: "very_high" } }
 * @returns {Object} Layout result from solve(), or null if template not found
 */
export function solveTemplate(id, solve, overrides = {}) {
  const template = getTemplate(id);
  if (!template) return null;

  const input = JSON.parse(JSON.stringify(template.input));

  // Merge overrides into input
  if (overrides.walls) input.walls = overrides.walls;
  if (overrides.appliances) input.appliances = overrides.appliances;
  if (overrides.island) input.island = overrides.island;
  if (overrides.peninsula) input.peninsula = overrides.peninsula;
  if (overrides.layoutType) input.layoutType = overrides.layoutType;
  if (overrides.roomType) input.roomType = overrides.roomType;

  // Merge preference overrides
  if (overrides.prefs) {
    input.prefs = { ...input.prefs, ...overrides.prefs };
  }

  return solve(input);
}

export { TEMPLATES };
