/**
 * Eclipse Kitchen Designer â C3 Pricing Engine
 * ==============================================
 * Calculates project pricing using the Eclipse C3 formula:
 *
 *   cabinetPrice = stockPrice Ã (1 + speciesPct/100) Ã (1 + constructionPct/100)
 *   doorGroupCharge = doorGroupRate Ã numDoorsInGroup
 *   lineItemTotal = cabinetPrice + doorGroupCharge + modificationCharges
 *   specTotal = Î£ lineItemTotals for that material spec
 *   projectTotal = Î£ specTotals
 *
 * Sources:
 *   - 30 training projects with real Eclipse pricing data
 *   - Eclipse v8.8 catalog price lists (embedded in training JSONs as list_price)
 *   - Species upcharge rates derived from Bollini ($9,561 species charge on $54K),
 *     Gable (Walnut vs Maple differential), Kline Piazza (3-tone pricing),
 *     and 20+ additional projects
 *
 * Pricing tiers observed in training data:
 *   Budget:   $4,600  â LWH Hartley Laundry (TFL, 6 cabs)
 *   Mid:      $14,000 â Sabelhaus (TFL, 23 cabs)
 *   Standard: $19,000 â Lofton (Walnut+HPL, 2-tone)
 *   High:     $29,000 â Gable (Walnut+Maple, 2-tone)
 *   Premium:  $42,000 â Firebird (Maple stain+paint, 2-tone)
 *   Ultra:    $64,000 â Bollini (Walnut Natural, 39 cabs)
 *   Mega:     $79,000 â Bissegger Great Room (Rift Cut White Oak, 4-zone)
 */


// âââ SPECIES PRICING ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Percentage upcharge over Maple base price (Maple = 0% = reference species)
// Derived from training data price differentials and Eclipse catalog tiers

export const SPECIES_UPCHARGE = {
  // Laminates & engineered (lowest tier)
  "TFL":              { pct: -15, tier: "budget",   note: "Thermally Fused Laminate â cheapest. Bennet $4.7K, Sabelhaus $14K, LWH $4.6K." },
  "HPL":              { pct: -10, tier: "budget",   note: "High Pressure Laminate â slightly above TFL. Lofton HPL spec $3.4K." },
  "PET Laminate":     { pct: -5,  tier: "budget",   note: "PET Laminate â DeLawyer $19K (mid but lower material cost)." },
  "Acrylic":          { pct: 5,   tier: "standard", note: "Acrylic â OC Design option. Slightly above Maple." },

  // Maple (baseline)
  "Maple":            { pct: 0,   tier: "standard", note: "Reference species. Firebird $42K, Owen $30K perimeter, McComb $35K+$4.5K, Kline uppers $5.5K." },

  // Mid hardwoods
  "American Poplar":  { pct: 5,   tier: "standard", note: "JRS $6.7K â slightly above Maple." },
  "Alder":            { pct: 8,   tier: "standard", note: "Los Alamos $22K â mid-premium hardwood." },
  "Cherry":           { pct: 10,  tier: "premium",  note: "Diehl $19K â premium traditional hardwood." },

  // Premium hardwoods
  "White Oak":        { pct: 15,  tier: "premium",  note: "McCarter $26K, Kamisar $41K, Showroom ECLA $8.5K. Popular premium choice." },
  "Rift Cut White Oak": { pct: 20, tier: "premium", note: "Bissegger $79K â premium quarter/rift cut. Highest-end Oak." },
  "Rustic Hickory":   { pct: 12,  tier: "premium",  note: "Owen island $12.7K â character grain, premium rustic." },
  "Walnut":           { pct: 25,  tier: "ultra",    note: "Bollini $54K ($9,561 species charge), Lofton $15.8K, Gable $23.5K, Kline bases $7K. Most expensive common species." },
};


// âââ CONSTRUCTION UPCHARGE ââââââââââââââââââââââââââââââââââââââââââââââââ
// Percentage upcharge over standard particle board construction

export const CONSTRUCTION_UPCHARGE = {
  "Standard":                 { pct: 0,   note: "Particle board box â default." },
  "Plywood":                  { pct: 10,  note: "Full plywood box. Imai Robin, Alix options." },
  "Procore Plywood/Partial":  { pct: 7,   note: "Partial plywood upgrade. Huang $2,486 upgrade, McComb." },
  "Mixed":                    { pct: 3,   note: "Mixed construction. Bennet Utility." },
};


// âââ DOOR STYLE PRICING ââââââââââââââââââââââââââââââââââââââââââââââââââ
// Door styles affect pricing through the door group charge
// {A} = primary door group, {B} = accent/secondary, {C}/{D} = additional

export const DOOR_STYLE_CHARGE = {
  // Slab / flat panel (most affordable within species)
  "Metropolitan VG":       { groupRate: 0,    note: "Flat reference. Lofton, DeLawyer, OC Design, Bennet." },
  "Hanover FP":            { groupRate: 0,    note: "Flat panel. Imai Robin, Alix, Dolfin, Diehl, Cost Plus." },
  "Hartford FP":           { groupRate: 0,    note: "Flat panel. Bollini (first in training)." },
  "Scottsdale FP":         { groupRate: 0,    note: "Flat panel. JRS, Owen, McComb, Kamisar (BBSCDL bar back)." },
  "Malibu FP":             { groupRate: 2.50, note: "Flat panel with profile. Bissegger, Eddies, Bissegger Office." },
  "Napa VG FP":            { groupRate: 3.00, note: "Vertical grain flat panel. Gable, Kline Piazza." },
  "Ward FP":               { groupRate: 3.50, note: "Flat panel with distinct profile. Firebird." },
  "Malibu Reeded Panel":   { groupRate: 5.00, note: "Reeded texture panel â premium. Bissegger {B} accent." },
  "Hanover FP 2.5":        { groupRate: 1.50, note: "2.5\" rail Hanover. Kamisar." },
};


// âââ DRAWER UPGRADES âââââââââââââââââââââââââââââââââââââââââââââââââââââ

export const DRAWER_UPGRADES = {
  "Standard":               { perDrawer: 0,    note: "Basic drawer box." },
  "5/8\" Hdwd Dovetail":    { perDrawer: 15,   note: "Hardwood dovetail. Most training projects." },
  "3/4\" Hdwd Dovetail":    { perDrawer: 22,   note: "Thicker dovetail. McComb upgrade." },
  "Slab Drawer Front":      { perDrawer: 8,    note: "DF-S slab fronts. Bollini (first in training)." },
};


// âââ DRAWER GUIDE PRICING ââââââââââââââââââââââââââââââââââââââââââââââââ

export const DRAWER_GUIDE_UPGRADES = {
  "Standard":          { perDrawer: 0,  note: "Basic roller guides." },
  "Blum FEG Guide":    { perDrawer: 0,  note: "Blum full extension â included in most Eclipse specs." },
  "Blum Edge Guide":   { perDrawer: 5,  note: "Blum Edge soft-close premium. Bissegger Great Room." },
};


// âââ MODIFICATION PRICING ââââââââââââââââââââââââââââââââââââââââââââââââ
// Width modifications within 30% N/C threshold are free; beyond that, 30% upcharge

export const MOD_PRICING = {
  widthMod: {
    noCostThreshold: 0.30,     // 30% of cabinets can be width-modified at no charge
    upchargePercent: 30,        // 30% upcharge on cabinets beyond the threshold
    note: "Bennet Utility training note: '30% N/C' â confirmed across multiple projects.",
  },
  // Named modification surcharges (flat per-item charges)
  namedMods: {
    // Drawer box upgrades
    "DVT":   { charge: 25,   per: "drawer", note: "Dovetail drawer box upgrade." },
    "DVT-W": { charge: 45,   per: "drawer", note: "Dovetail walnut drawer box upgrade." },
    // Drawer slide upgrades
    "SC-DRW":    { charge: 12,   per: "drawer", note: "Soft-close drawer slides." },
    "UM-DRW":    { charge: 20,   per: "drawer", note: "Undermount drawer slides." },
    "UMSC-DRW":  { charge: 28,   per: "drawer", note: "Undermount soft-close drawer slides." },
    // Drawer inserts
    "WCD":   { charge: 55,   per: "item",  note: "Wood cutlery drawer insert. Bissegger." },
    "DPS":   { charge: 35,   per: "item",  note: "Drawer peg system. Bissegger DPS-36." },
    "SPR":   { charge: 30,   per: "item",  note: "Spice rack drawer insert." },
    // Legacy inserts
    "WCD2":  { charge: 55,   per: "item",  note: "Wood cutlery drawer insert. Bissegger." },
    "SR8":   { charge: 30,   per: "item",  note: "8\" spice rack insert. Bissegger." },
    // Other mods
    "WTD":   { charge: 45,   per: "item",  note: "Wire tray divider. Bollini, Kline Piazza." },
    "BKI":   { charge: 65,   per: "item",  note: "Knife insert block. Bollini BKI-9." },
    "PTKL":  { charge: 18,   per: "item",  note: "Toe kick lighting prep. Bissegger (18 bases), Owen." },
    "PFSL":  { charge: 25,   per: "item",  note: "Prep floating shelf lighting. Bissegger." },
    "PWL":   { charge: 20,   per: "item",  note: "Prep for wiring/lighting. Showroom ECLD peninsula." },
    "RMK":   { charge: 0,    per: "item",  note: "Removable toe kick â no extra charge. Owen throughout." },
    "RCTD":  { charge: 35,   per: "door",  note: "Right contour door. Bissegger WGPD arch doors." },
    "LCTD":  { charge: 35,   per: "door",  note: "Left contour door. Bissegger WGPD arch doors." },
    "GFD":   { charge: 0,    per: "door",  note: "Glass front door â no extra charge but tracked. Alix, Firebird, Showroom ECLD." },
    "MD":    { charge: 15,   per: "door",  note: "Mullion door modification." },
    "SEED":  { charge: 35,   per: "door",  note: "Seeded glass insert â textured glass option." },
    "LD":    { charge: 55,   per: "door",  note: "Leaded glass insert â mullion pattern option." },
    "FROST": { charge: 25,   per: "door",  note: "Frosted glass insert â etched glass option." },
    "FIN INT": { charge: 40, per: "item",  note: "Finished interior. Showroom ECLD display cabs." },
    "FINISHED INT": { charge: 40, per: "item", note: "Finished interior (alias). Solver uses this key for GFD uppers." },
    "RBS":   { charge: 25,   per: "item",  note: "Rollout behind shelves. Bollini SWSC glass display corner â interior rollout tray." },
    "ROT-FM": { charge: 25,  per: "tray",  note: "Floor-mounted roll-out tray. Huang, Kline." },
    "ROT":    { charge: 20,  per: "tray",  note: "Standard roll-out tray." },
    "SUB DRW FRONT": { charge: 30, per: "item", note: "Sub drawer front. Bollini." },
    "RESTRICTOR CLIPS": { charge: 3, per: "clip", note: "Hinge restrictor clips. Firebird (16)." },
    "PKD":   { charge: 85,   per: "item",  note: "Pocket door hardware kit. Premium appliance garage door style." },
    "BFD":   { charge: 45,   per: "item",  note: "Bi-fold door hardware. Premium appliance garage door style." },
    "TMB":   { charge: 120,  per: "item",  note: "Tambour/roll-up door mechanism. Premium appliance garage door style." },
    "TS":    { charge: 15,   per: "item",  note: "Trim strip for undercounter appliances. Wine cooler, beverage center." },
  },
};


// âââ ACCESSORY FLAT PRICING ââââââââââââââââââââââââââââââââââââââââââââââ
// End panels, fillers, trim â priced per linear foot or per piece

export const ACCESSORY_PRICING = {
  endPanels: {
    "FBEP 3/4-FTK":  { price: 180, per: "panel", note: "3/4\" base end panel with finished toe kick." },
    "FWEP3/4":        { price: 120, per: "panel", note: "3/4\" wall end panel." },
    "BEP1.5-FTK":     { price: 220, per: "panel", note: "1.5\" base end panel." },
    "BEP3-FTK":       { price: 280, per: "panel", note: "3\" base end panel." },
    "BEP3-RTK":       { price: 290, per: "panel", note: "3\" base end panel recessed toe kick. Kamisar." },
    "FREP3/4":        { price: 250, per: "panel", note: "3/4\" fridge end panel." },
    "REP1.5":         { price: 350, per: "panel", note: "1.5\" refrigerator end panel." },
    "REP3":           { price: 420, per: "panel", note: "3\" refrigerator end panel." },
    "FREP3/4+RCK":    { price: 280, per: "panel", note: "Flush ref end panel with rack. McComb." },
    "REF":            { price: 3550, per: "panel", note: "Refrigerator wall door panel. Bissegger ($3,550.69 each)." },
    "EDGTL":          { price: 450, per: "panel", note: "Waterfall end panel. Kline Piazza (2Ã)." },
  },
  fillers: {
    "F3":  { pricePerInch: 8,  note: "3\" filler â Alix, standard." },
    "F6":  { pricePerInch: 10, note: "6\" filler." },
  },
  toeKicks: {
    "TK-N/C":     { price: 0,   per: "8ft", note: "Standard toe kick â no charge, included." },
    "TK-RTK-8'":  { price: 35,  per: "piece", note: "Recessed toe kick with lighting channel." },
    "TK-FTK-8'":  { price: 25,  per: "piece", note: "Flush toe kick matches cabinet face." },
    "FBM-8'":     { price: 85,  per: "piece", note: "Furniture base moulding (legs/feet instead of toe kick)." },
    "PLN-8'":     { price: 20,  per: "piece", note: "Solid plinth base." },
  },
  trim: {
    "3 1/2CRN":  { pricePerFt: 12,  note: "Crown mould. Kamisar." },
    "1 1/2STP":  { pricePerFt: 8,   note: "Counter top mould. Kamisar." },
    "3SRM10F":   { pricePerFt: 10,  note: "10\" face sub rail. Kamisar." },
    "7/8BM":     { pricePerFt: 5,   note: "Batten mould. Kamisar." },
    "CRN-standard-8'": { price: 96,  per: "piece", note: "Crown moulding standard style, 8ft length (~$12/ft)." },
    "LR-8'":     { price: 64,  per: "piece", note: "Light rail trim under upper cabinets, 8ft length (~$8/ft)." },
    "LR-STD-8'": { price: 48,  per: "piece", note: "Light rail standard profile, 8ft length ($6/ft)." },
    "LR-BEV-8'": { price: 64,  per: "piece", note: "Light rail beveled profile, 8ft length ($8/ft)." },
    "LR-COV-8'": { price: 80,  per: "piece", note: "Light rail cove profile, 8ft length ($10/ft)." },
    "LR-OGE-8'": { price: 96,  per: "piece", note: "Light rail ogee profile, 8ft length ($12/ft)." },
    "PLWT-SQUARE": { price: 45, per: "piece", note: "Finished top square molding." },
    "PLWT-COVE":   { price: 55, per: "piece", note: "Finished top cove molding. Bissegger." },
  },
  appliedMolding: {
    "AM-CL":    { pricePerDoor: 8,  note: "Applied molding classic style." },
    "AM-SH":    { pricePerDoor: 12, note: "Applied molding shaker style." },
    "AM-CO":    { pricePerDoor: 15, note: "Applied molding colonial style." },
  },
  baseShoe: {
    "BS-QR":    { price: 32,  per: "8ft", note: "Base shoe quarter-round profile." },
    "BS-COV":   { price: 48,  per: "8ft", note: "Base shoe cove profile." },
    "BS-OGE":   { price: 80,  per: "8ft", note: "Base shoe ogee profile." },
  },
  counterMould: {
    "STP-STD":  { price: 96,  per: "8ft", note: "Counter top mould standard profile ($12/ft)." },
    "STP-BN":   { price: 128, per: "8ft", note: "Counter top mould bullnose profile ($16/ft)." },
    "STP-OGE":  { price: 176, per: "8ft", note: "Counter top mould ogee profile ($22/ft)." },
  },
  appliancePanels: {
    "DWP": { price: 185, per: "panel", note: "Dishwasher panel overlay â matches door style." },
    "FDP": { price: 225, per: "panel", note: "Fridge panel overlay â panel-ready appliance." },
    "FZP": { price: 145, per: "panel", note: "Freezer drawer panel â fridge with drawer." },
  },
  valances: {
    // VLN-{width} format: $45 flat per valance, regardless of width
  },
  lightBridges: {
    // LB-{width} format: $8 per linear foot ($8/12 = $0.67 per inch)
  },
  touchUp: {
    "TUK-STAIN": { price: 35, note: "Stain touch-up kit." },
    "TUB":       { price: 25, note: "Paint touch-up bottle + fill stick." },
    "QST":       { price: 45, note: "Quart of paint for larger jobs." },
  },
  hardware: {
    "TL28":     { price: 85,   per: "leg",     note: "28\" turned leg. Owen peninsula." },
    "FBP":      { price: 65,   per: "piece",   note: "Furniture base moulding. Owen peninsula." },
    "PBC":      { price: 180,  per: "column",  note: "Peninsula base column. Showroom ECLD, Owen." },
    "BC3341":   { price: 250,  per: "column",  note: "Base column 33Ã41. McCarter bath." },
    "FSLB":     { price: 35,   per: "bracket", note: "Floating shelf bracket." },
  },
  lighting: {
    "UCL": { pricePerFoot: 12, note: "Under-cabinet LED strips." },
    "ICL": { pricePerUnit: 35, note: "In-cabinet lighting for glass display cabs." },
    "TKL": { pricePerFoot: 8,  note: "Toe kick LED strips." },
    "DSL": { pricePerUnit: 45, note: "Display shelf lighting for floating/display shelves." },
  },
};


// âââ PRICING CALCULATOR ââââââââââââââââââââââââââââââââââââââââââââââââââ

/**
 * Calculate the price for a single cabinet line item.
 *
 * @param {Object} item - Cabinet data
 *   @param {number} item.listPrice - Stock/catalog price (from Eclipse catalog)
 *   @param {string} [item.species] - Species name (key in SPECIES_UPCHARGE)
 *   @param {string} [item.construction] - Construction type (key in CONSTRUCTION_UPCHARGE)
 *   @param {string} [item.doorStyle] - Door style (key in DOOR_STYLE_CHARGE)
 *   @param {number} [item.numDoors] - Number of doors on this cabinet (for door group charge)
 *   @param {string} [item.drawerType] - Drawer upgrade type
 *   @param {number} [item.numDrawers] - Number of drawers
 *   @param {string} [item.drawerGuide] - Drawer guide upgrade type
 *   @param {Array}  [item.modifications] - Array of {mod, qty} modification entries
 * @returns {Object} Pricing breakdown
 */
export function priceLineItem(item) {
  const listPrice = item.listPrice || 0;

  // Species upcharge
  const speciesKey = item.species || "Maple";
  const speciesData = SPECIES_UPCHARGE[speciesKey] || SPECIES_UPCHARGE["Maple"];
  const speciesMultiplier = 1 + (speciesData.pct / 100);

  // Construction upcharge
  const constructionKey = item.construction || "Standard";
  const constructionData = CONSTRUCTION_UPCHARGE[constructionKey] || CONSTRUCTION_UPCHARGE["Standard"];
  const constructionMultiplier = 1 + (constructionData.pct / 100);

  // Base cabinet price with species + construction
  const cabinetPrice = listPrice * speciesMultiplier * constructionMultiplier;

  // Door group charge
  const doorStyleKey = item.doorStyle || "Hanover FP";
  const doorData = DOOR_STYLE_CHARGE[doorStyleKey] || { groupRate: 0 };
  const numDoors = item.numDoors || 0;
  const doorGroupCharge = doorData.groupRate * numDoors;

  // Drawer upgrade charge
  const drawerTypeKey = item.drawerType || "Standard";
  const drawerData = DRAWER_UPGRADES[drawerTypeKey] || DRAWER_UPGRADES["Standard"];
  const numDrawers = item.numDrawers || 0;
  const drawerCharge = drawerData.perDrawer * numDrawers;

  // Drawer guide charge
  const guideKey = item.drawerGuide || "Standard";
  const guideData = DRAWER_GUIDE_UPGRADES[guideKey] || DRAWER_GUIDE_UPGRADES["Standard"];
  const guideCharge = guideData.perDrawer * numDrawers;

  // Named modification charges
  let modCharge = 0;
  const modBreakdown = [];
  if (item.modifications && Array.isArray(item.modifications)) {
    for (const mod of item.modifications) {
      const modKey = mod.mod || mod.type;
      const modData = MOD_PRICING.namedMods[modKey];
      if (modData) {
        const qty = mod.qty || 1;
        const cost = modData.charge * qty;
        modCharge += cost;
        modBreakdown.push({ mod: modKey, qty, cost });
      }
    }
  }

  const totalPrice = cabinetPrice + doorGroupCharge + drawerCharge + guideCharge + modCharge;

  return {
    listPrice,
    speciesUpcharge: speciesData.pct,
    constructionUpcharge: constructionData.pct,
    cabinetPrice: round2(cabinetPrice),
    doorGroupCharge: round2(doorGroupCharge),
    drawerCharge: round2(drawerCharge),
    guideCharge: round2(guideCharge),
    modCharge: round2(modCharge),
    modBreakdown,
    totalPrice: round2(totalPrice),
  };
}


/**
 * Calculate pricing for an entire material spec (one PO / one material configuration).
 *
 * @param {Object} spec - Material specification
 *   @param {string} spec.species - Species name
 *   @param {string} spec.construction - Construction type
 *   @param {string} spec.doorStyle - Door style name
 *   @param {string} [spec.drawerType] - Drawer upgrade type
 *   @param {string} [spec.drawerGuide] - Drawer guide type
 *   @param {Array} spec.lineItems - Array of cabinet line items
 *     Each item: { sku, listPrice, numDoors, numDrawers, modifications }
 * @returns {Object} Spec-level pricing summary
 */
export function priceSpec(spec) {
  const items = spec.lineItems || [];
  const pricedItems = items.map(item => ({
    sku: item.sku,
    line: item.line,
    ...priceLineItem({
      listPrice: item.listPrice || item.list_price || 0,
      species: spec.species,
      construction: spec.construction,
      doorStyle: spec.doorStyle || spec.door_style,
      numDoors: item.numDoors || item.num_doors || 0,
      numDrawers: item.numDrawers || item.num_drawers || 0,
      drawerType: spec.drawerType || spec.drawer_type,
      drawerGuide: spec.drawerGuide || spec.drawer_guide,
      modifications: item.modifications,
    }),
  }));

  const subtotal = pricedItems.reduce((sum, p) => sum + p.totalPrice, 0);

  // Width modification limit check
  const totalCabs = pricedItems.length;
  const modifiedCabs = pricedItems.filter(p =>
    p.modBreakdown?.length > 0 || items.find(i => (i.sku === p.sku && i.line === p.line))?.widthModified
  ).length;
  const widthModPct = totalCabs > 0 ? modifiedCabs / totalCabs : 0;
  const overLimit = widthModPct > MOD_PRICING.widthMod.noCostThreshold;
  const extraModCabs = overLimit
    ? modifiedCabs - Math.floor(totalCabs * MOD_PRICING.widthMod.noCostThreshold)
    : 0;

  return {
    specId: spec.specId || spec.spec_id,
    species: spec.species,
    construction: spec.construction,
    doorStyle: spec.doorStyle || spec.door_style,
    itemCount: totalCabs,
    pricedItems,
    subtotal: round2(subtotal),
    widthModWarning: overLimit
      ? `${modifiedCabs} of ${totalCabs} cabs (${Math.round(widthModPct * 100)}%) width-modified â ${extraModCabs} cabs will incur ${MOD_PRICING.widthMod.upchargePercent}% upcharge.`
      : null,
  };
}


/**
 * Calculate full project pricing across all material specs.
 *
 * @param {Object} project - Full project configuration
 *   @param {Array} project.specs - Array of material spec objects (see priceSpec)
 *   @param {Array} [project.accessories] - Global accessories [{sku, qty, unitPrice}]
 *   @param {Object} [project.touchUp] - Touch-up kit {type, qty}
 * @returns {Object} Full project pricing
 */
export function priceProject(project) {
  const specs = (project.specs || []).map(s => priceSpec(s));
  const specSubtotal = specs.reduce((sum, s) => sum + s.subtotal, 0);

  // Global accessories
  let accessoryTotal = 0;
  const accessoryBreakdown = [];
  if (project.accessories && Array.isArray(project.accessories)) {
    for (const acc of project.accessories) {
      const qty = acc.qty || 1;
      const unitPrice = acc.unitPrice || acc.unit_price || 0;
      const cost = unitPrice * qty;
      accessoryTotal += cost;
      accessoryBreakdown.push({ sku: acc.sku, qty, unitPrice, cost: round2(cost) });
    }
  }

  // Touch-up kit
  let touchUpCost = 0;
  if (project.touchUp) {
    const kit = ACCESSORY_PRICING.touchUp[project.touchUp.type];
    if (kit) {
      const qty = project.touchUp.qty || 1;
      touchUpCost = kit.price * qty;
    }
  }

  const projectTotal = specSubtotal + accessoryTotal + touchUpCost;

  return {
    specs,
    specSubtotal: round2(specSubtotal),
    accessoryBreakdown,
    accessoryTotal: round2(accessoryTotal),
    touchUpCost: round2(touchUpCost),
    projectTotal: round2(projectTotal),
    warnings: specs.filter(s => s.widthModWarning).map(s => ({
      spec: s.specId,
      warning: s.widthModWarning,
    })),
  };
}


/**
 * Quick estimate for a layout before detailed line items are available.
 * Uses average cabinet prices by type and room dimensions.
 *
 * @param {Object} params
 *   @param {number} params.cabinetCount - Estimated number of cabinets
 *   @param {string} params.species - Species name
 *   @param {string} params.construction - Construction type
 *   @param {string} [params.doorStyle] - Door style
 *   @param {string} [params.tier] - Price tier hint: "budget" | "standard" | "premium" | "ultra"
 * @returns {Object} Rough estimate with range
 */
export function estimateProject(params) {
  const { cabinetCount, species, construction, doorStyle, tier } = params;

  // Average base cabinet list price by tier (derived from training data)
  const AVG_LIST_PRICE = {
    budget:   350,   // TFL/HPL â Bennet $4.7K/10 cabs, LWH $4.6K/6 cabs
    standard: 550,   // Maple/Poplar â Lofton $19K/22 cabs, DeLawyer $19K/19 cabs
    premium:  700,   // White Oak/Cherry â McCarter $26K/28 cabs, Kamisar $41K/32 cabs
    ultra:    850,   // Walnut/Rift Cut â Bollini $54K/39 cabs, Bissegger $79K/47 cabs
  };

  // Determine tier from species if not provided
  const speciesData = SPECIES_UPCHARGE[species] || SPECIES_UPCHARGE["Maple"];
  const effectiveTier = tier || speciesData.tier || "standard";
  const avgPrice = AVG_LIST_PRICE[effectiveTier] || AVG_LIST_PRICE.standard;

  const speciesMultiplier = 1 + (speciesData.pct / 100);
  const constructionData = CONSTRUCTION_UPCHARGE[construction] || CONSTRUCTION_UPCHARGE["Standard"];
  const constructionMultiplier = 1 + (constructionData.pct / 100);

  const doorData = DOOR_STYLE_CHARGE[doorStyle] || { groupRate: 0 };
  // Assume avg 1.5 doors per cabinet
  const doorCharge = doorData.groupRate * 1.5;

  const perCabEstimate = (avgPrice * speciesMultiplier * constructionMultiplier) + doorCharge;
  const midEstimate = perCabEstimate * cabinetCount;

  // Add ~15% for accessories, end panels, trim
  const accessoryPadding = 0.15;

  return {
    tier: effectiveTier,
    perCabinetEstimate: round2(perCabEstimate),
    cabinetSubtotal: round2(midEstimate),
    estimatedAccessories: round2(midEstimate * accessoryPadding),
    lowEstimate: round2(midEstimate * 0.85),
    midEstimate: round2(midEstimate * (1 + accessoryPadding)),
    highEstimate: round2(midEstimate * 1.35),
    note: `Based on ${cabinetCount} cabs Ã ~$${round2(perCabEstimate)}/cab (${species}, ${construction}).`,
  };
}


// âââ HELPERS âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function round2(n) {
  return Math.round(n * 100) / 100;
}
