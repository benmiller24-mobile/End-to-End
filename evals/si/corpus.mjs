/**
 * Deterministic kitchen corpus generator.
 * ========================================
 * Yields N diverse, realistic kitchen room-specs spanning the layout space real
 * floor plans fall into — single-wall, galley, L, U, peninsula, and island
 * variants across small/medium/large footprints, varied ceiling heights and
 * appliance arrangements. Deterministic (seeded by index, no RNG) so the
 * self-improving loop re-runs identically and fixes are reproducible. This is
 * the cheap, offline test bed; the live-vision image corpus validates the
 * upload→extract path separately.
 */

// Standard appliance widths (inches)
const SINK = 'sink', RANGE = 'range', COOK = 'cooktop', FRIDGE = 'refrigerator', DW = 'dishwasher', OVEN = 'wall_oven';

// A spread of footprints per layout family. Lengths in inches.
const FOOTPRINTS = {
  single: [[120], [144], [168], [192], [216]],
  galley: [[120, 120], [144, 144], [168, 156], [180, 180], [132, 120]],
  L:      [[120, 96], [144, 120], [168, 132], [180, 144], [156, 108], [204, 156]],
  U:      [[120, 96, 120], [144, 108, 144], [156, 120, 132], [168, 132, 168], [132, 96, 120]],
};

const CEILINGS = [96, 96, 108];   // weight toward 96"

// Appliance KITS by layout — types only, positions left to the solver (the real
// auto-design path: a floor plan gives the room + which appliances, the solver
// lays them out for balance). The kit is scaled to the total wall run so we
// never generate an infeasible kitchen (4 appliances on a 10' single wall).
function appliancesFor(layout, lens, variant) {
  const run = lens.reduce((a, l) => a + l, 0);
  // Appliance footprint budget: fridge 36 + range 30 + sink 33 + dw 24 ≈ 123",
  // plus cabinets need room. Drop the dishwasher on tight runs, drop to a
  // cooktop-only (no separate oven) when very tight.
  const full = [
    { type: FRIDGE }, { type: SINK },
    { type: variant % 2 ? COOK : RANGE }, { type: DW },
  ];
  const noDw = [{ type: FRIDGE }, { type: SINK }, { type: RANGE }];
  // single walls are the tightest (one run); multi-wall layouts have more room
  if (layout === 'single') return run >= 168 ? full : run >= 132 ? noDw : noDw;
  return run >= 240 ? full : run >= 180 ? full : noDw;
}

export function* generateCorpus(n = 100) {
  const layouts = Object.keys(FOOTPRINTS);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const layout = layouts[k % layouts.length];
    const fps = FOOTPRINTS[layout];
    const lens = fps[Math.floor(k / layouts.length) % fps.length];
    const ceil = CEILINGS[k % CEILINGS.length];
    const variant = Math.floor(k / (layouts.length * fps.length));
    const walls = lens.map((L, idx) => ({ id: String.fromCharCode(65 + idx), length: L, ceilingHeight: ceil }));
    const layoutType = layout === 'single' ? 'single' : layout === 'galley' ? 'galley' : layout === 'L' ? 'L' : 'U';
    // Island on larger L / U footprints (every 3rd) — exercises island pricing/geometry.
    const wantIsland = (layout === 'L' || layout === 'U') && lens[0] >= 156 && k % 3 === 0;
    const island = wantIsland ? { length: Math.min(96, lens[0] - 48), depth: 42, seating: 2 } : null;
    yield {
      id: `K${String(++i).padStart(3, '0')}`,
      label: `${layout} ${lens.join('×')} ceil${ceil}${island ? ' +island' : ''}`,
      layout, layoutType, walls, ceiling: ceil,
      appliances: appliancesFor(layout, lens, variant),
      ...(island ? { island } : {}),
      prefs: { ceilingHeight: ceil, sophistication: variant % 2 ? 'high' : 'standard' },
    };
  }
}

export function corpusArray(n = 100) { return [...generateCorpus(n)]; }
