/**
 * appliance-recommender.js
 *
 * Layout-aware appliance recommendation. Given a solved layout (type, run length,
 * island), recommends a cooking configuration (range vs. cooktop + wall oven),
 * refrigeration, dishwasher, ventilation, and island extras — then offers concrete
 * brand/model options at three budget tiers drawn from the real APPLIANCES catalog.
 *
 * Grounded in NKBA planning practice and the project's "Cabinet Placement & Appliance
 * Selection Guide":
 *   - single-wall: compact range; 48" only if the wall is long (≥132").
 *   - galley: compact range opposite the sink wall; keep ventilation low-profile.
 *   - L-shape: flexible — rangetop + wall oven when there's a tall run to host it.
 *   - U-shape: cooktop + wall oven split shines (oven at a leg-end).
 *   - island: heavy cooking stays on the perimeter; the island gets a prep sink +
 *     beverage/wine, and a cooktop only when it's large enough for 42" on all sides.
 *
 * Pure, additive, no side effects. Returns a plain object safe to attach to solve().
 */

import { APPLIANCES, APPLIANCE_BRANDS } from './applianceData.js';

// Budget tiers → catalog brand ids (the catalog has no true "value" brand, so the
// mid-premium names anchor the value column).
const TIER_BRANDS = {
  value: ['kitchenaid', 'fisherPaykel'],
  luxury: ['thermador', 'miele'],
  ultra: ['wolf', 'subzero', 'cove', 'gaggenau'],
};

const brandName = (id) => (APPLIANCE_BRANDS.find(b => b.id === id) || {}).name || id;

/**
 * Pick a catalog model of a type from a set of brands. Width is the primary
 * criterion (so a value brand doesn't return a 48" pro range when 36" was asked);
 * fuel/subtype are soft preferences that only break near-ties.
 */
function pick(type, brandIds, { width, fuel, subtype } = {}) {
  const pool = APPLIANCES.filter(a => a.type === type && brandIds.includes(a.brand));
  if (!pool.length) return null;
  const score = (a) => {
    let s = 0;
    if (width != null) s += Math.abs((a.width || 0) - width) * 10; // width dominates
    if (fuel && a.fuel && a.fuel !== fuel) s += 5;                 // wrong fuel: soft penalty
    if (fuel && !a.fuel) s += 2;
    if (subtype && a.subtype !== subtype) s += 3;
    return s;
  };
  const a = pool.slice().sort((x, y) => score(x) - score(y))[0];
  return {
    brand: brandName(a.brand), brandId: a.brand, model: a.model,
    width: a.width, fuel: a.fuel || null, msrp: a.msrp || null,
    features: (a.features || []).slice(0, 2),
  };
}

/** Three tiered options for a category (value / luxury / ultra). */
function tieredOptions(type, opts = {}) {
  const out = {};
  for (const tier of ['value', 'luxury', 'ultra']) {
    const m = pick(type, TIER_BRANDS[tier], opts);
    if (m) out[tier] = m;
  }
  return out;
}

/** Hood width + CFM from cooktop width and fuel (NKBA / manufacturer rule of thumb). */
function ventilation(cookWidth, fuel) {
  const hoodWidth = cookWidth >= 48 ? 60 : cookWidth + 6;       // ≥6" overhang; 48"→60"
  const perFoot = fuel === 'induction' || fuel === 'electric' ? 100 : 150; // CFM per linear foot
  const cfm = Math.round(((cookWidth / 12) * perFoot) / 50) * 50; // 48" gas≈600, induction≈400
  return {
    hoodWidth, cfm,
    mount: fuel === 'induction' ? '30"–36" above cooktop' : '24"–30" above cooktop',
    makeUpAir: cfm >= 400,
    options: tieredOptions('hood', { width: hoodWidth }),
  };
}

/**
 * @param {Object} ctx
 * @param {string} ctx.layoutType   single-wall | galley | l-shape | u-shape | ...
 * @param {Array}  ctx.walls        [{length}]
 * @param {Object} [ctx.island]     solver island object (length, backSide, overhang, hasRange)
 */
export function recommendAppliances(ctx = {}) {
  const layout = (ctx.layoutType || 'single-wall').toLowerCase();
  const walls = ctx.walls || [];
  const totalRun = walls.reduce((s, w) => s + (w.length || 0), 0);
  const longestWall = walls.reduce((m, w) => Math.max(m, w.length || 0), 0);
  const island = ctx.island || null;
  const hasIsland = !!island;
  const hasSeating = !!(island && ((island.backSide || []).length || island.overhang));
  const big = totalRun >= 300; // generous kitchen

  // ── Cooking strategy by layout ──────────────────────────────────────
  let cooking, cookWidth, cookFuel, rationale;
  const wantSplit = (layout.includes('u-shape') || layout.includes('u_shape')) ||
    ((layout.includes('l-shape') || layout.includes('l_shape')) && big);

  if (wantSplit) {
    cookWidth = 36; cookFuel = 'induction';
    cooking = {
      type: 'cooktop + wall oven',
      cooktop: tieredOptions('cooktop', { width: 36 }),
      wallOven: tieredOptions('wallOven', { width: 30 }),
      reason: layout.includes('u') || layout.includes('U')
        ? 'A U-shape has a tall leg-end to host wall ovens, freeing the run for an induction cooktop and more simultaneous capacity.'
        : 'This L-shape is large enough to split cooking: a cooktop on the run plus wall ovens at a leg-end.',
    };
  } else {
    // Range. 48" only on a long single wall; otherwise 36" (or 30" if tight).
    if (longestWall >= 132 && (layout.includes('single') || hasIsland)) cookWidth = 48;
    else if (totalRun >= 168) cookWidth = 36;
    else cookWidth = 30;
    cookFuel = 'dual';
    cooking = {
      type: 'range',
      width: cookWidth,
      range: tieredOptions('range', { width: cookWidth, fuel: 'dual' }),
      reason: layout.includes('galley')
        ? 'A galley packs the most cooking into the least wall — a single range opposite the sink keeps the triangle tight.'
        : cookWidth === 48
          ? 'The wall is long enough for a 48" range as a focal point without starving the counter.'
          : 'A range is the most space- and budget-efficient cooking choice for this layout.',
    };
  }

  // ── Refrigeration ───────────────────────────────────────────────────
  const fridge = {
    recommendation: big
      ? 'Built-in or column refrigeration near the entry; split columns across legs in a U.'
      : 'Counter-depth or built-in 36" near the entry end of the run.',
    options: tieredOptions('refrigerator', { width: 36 }),
  };

  // ── Dishwasher (cleaning zone, within 36" of the sink) ──────────────
  const dishwasher = {
    placement: 'Within 36" of the cleanup sink; 21" standing clearance at the open door.',
    options: tieredOptions('dishwasher', { width: 24 }),
  };

  // ── Ventilation ─────────────────────────────────────────────────────
  const vent = ventilation(cookWidth, cookFuel);

  // ── Island extras ───────────────────────────────────────────────────
  let islandExtras = null;
  if (hasIsland) {
    const islandLen = island.length || 0;
    const canCook = islandLen >= 84 && (island.hasRange || false);
    islandExtras = {
      prepSink: 'A 15"–18" prep sink + trash pull-out turns the island into a true prep zone.',
      beverage: tieredOptions('wine', { width: 24 }),
      cooktopInIsland: canCook
        ? 'Island is large enough for a cooktop (42" clear on all sides) with downdraft or a ceiling hood.'
        : 'Keep the primary cooking on the perimeter; this island is best for prep + seating.',
      seating: hasSeating ? 'Seating present — keep cooking and water at least one zone apart on the island.' : null,
    };
  }

  // ── Package summary (one pick per tier, for a quick quote) ──────────
  const packageByTier = {};
  for (const tier of ['value', 'luxury', 'ultra']) {
    const items = [];
    if (cooking.type === 'range') items.push(cooking.range && cooking.range[tier]);
    else { items.push(cooking.cooktop && cooking.cooktop[tier]); items.push(cooking.wallOven && cooking.wallOven[tier]); }
    items.push(fridge.options[tier], dishwasher.options[tier], vent.options[tier]);
    const picks = items.filter(Boolean);
    packageByTier[tier] = {
      items: picks,
      estTotal: picks.reduce((s, p) => s + (p.msrp || 0), 0) || null,
    };
  }

  return {
    layout, totalRun, summary: cooking.reason,
    cooking, refrigeration: fridge, dishwasher, ventilation: vent,
    island: islandExtras, packageByTier,
    note: 'Recommendation is layout-driven; see Cabinet-Placement-and-Appliance-Guide.md for the full rationale.',
  };
}

export default recommendAppliances;
