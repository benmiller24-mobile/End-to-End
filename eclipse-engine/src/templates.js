/**
 * Eclipse Kitchen Designer â Room Template Library
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

// âââ TEMPLATE LIBRARY âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const TEMPLATES = [
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // GALLEY KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // L-SHAPE KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // U-SHAPE KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SINGLE-WALL KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // PENINSULA KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
        depth: 24,
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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // ISLAND-FOCUSED KITCHENS
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // UTILITY ROOMS (non-kitchen)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
];

// âââ TEMPLATE FUNCTIONS âââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
