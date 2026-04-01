/**
 * Eclipse Kitchen Designer — C3 Pricing Engine
 * ==============================================
 * Calculates project pricing using the Eclipse C3 formula:
 *
 *   cabinetPrice = stockPrice × (1 + speciesPct/100) × (1 + constructionPct/100)
 *   doorGroupCharge = doorGroupRate × numDoorsInGroup
 *   lineItemTotal = cabinetPrice + doorGroupCharge + modificationCharges
 *   specTotal = Σ lineItemTotals for that material spec
 *   projectTotal = Σ specTotals
 *
 * Sources:
 *   - 30 training projects with real Eclipse pricing data
 *   - Eclipse v8.8 catalog price lists (embedded in training JSONs as list_price)
 *   - Species upcharge rates derived from Bollini ($9,561 species charge on $54K),
 *     Gable (Walnut vs Maple differential), Kline Piazza (3-tone pricing),
 *     and 20+ additional projects
 *
 * Pricing tiers observed in training data:
 *   Budget:   $4,600  — LWH Hartley Laundry (TFL, 6 cabs)
 *   Mid:      $14,000 — Sabelhaus (TFL, 23 cabs)
 *   Standard: $19,000 — Lofton (Walnut+HPL, 2-tone)
 *   High:     $29,000 — Gable (Walnut+Maple, 2-tone)
 *   Premium:  $42,000 — Firebird (Maple stain+paint, 2-tone)
 *   Ultra:    $64,000 — Bollini (Walnut Natural, 39 cabs)
 *   Mega:     $79,000 — Bissegger Great Room (Rift Cut White Oak, 4-zone)
 */


// ─── SPECIES PRICING ──────────────────────────────────────────────────────
// Percentage upcharge relative to White Oak base (White Oak = 0% = reference species)
// Source: Eclipse Estimator v8.8.0 SP constant (eclipse-estimator.jsx)

export const SPECIES_UPCHARGE = {
  // Laminates & engineered (lowest tier — negative = cheaper than White Oak)
  "TFL":                    { pct: -25, tier: "budget",   note: "Thermally Fused Laminate — cheapest option." },
  "PV":                     { pct: -10, tier: "budget",   note: "Polymer Laminate (Polymer Vinyl)." },
  "Rauvisio noir Matte HPL":{ pct: -4,  tier: "budget",   note: "Rauvisio noir Matte HPL." },
  "Red Oak":                { pct: -2,  tier: "value",    note: "Red Oak — below White Oak baseline." },

  // White Oak (baseline = 0%)
  "White Oak":              { pct: 0,   tier: "standard", note: "Reference species. 0% baseline for all upcharges." },
  "Hickory":                { pct: 0,   tier: "standard", note: "Same tier as White Oak." },
  "American Poplar":        { pct: 0,   tier: "standard", note: "Same tier as White Oak." },
  "Acrylic HG":             { pct: 0,   tier: "standard", note: "High Gloss Acrylic — same tier as White Oak." },
  "Acrylic Matte":          { pct: 0,   tier: "standard", note: "Matte Acrylic — same tier as White Oak." },

  // Low-mid upcharges
  "Rustic Red Oak":         { pct: 3,   tier: "standard", note: "Rustic character Red Oak." },
  "Recon White Oak":        { pct: 4,   tier: "standard", note: "Reconstituted White Oak veneer." },
  "Recon Walnut":           { pct: 4,   tier: "standard", note: "Reconstituted Walnut veneer." },
  "Rustic Hickory":         { pct: 5,   tier: "standard", note: "Rustic character Hickory." },
  "Rustic White Oak":       { pct: 5,   tier: "standard", note: "Rustic character White Oak." },

  // Mid hardwoods
  "Maple":                  { pct: 8,   tier: "premium",  note: "Maple — mid-premium hardwood." },
  "Select Poplar":          { pct: 8,   tier: "premium",  note: "Select Poplar — paint-grade hardwood." },
  "Cherry":                 { pct: 10,  tier: "premium",  note: "Cherry — premium traditional hardwood." },
  "Alder":                  { pct: 12,  tier: "premium",  note: "Alder — premium hardwood." },
  "Rustic Maple":           { pct: 13,  tier: "premium",  note: "Rustic character Maple." },
  "Rustic Cherry":          { pct: 15,  tier: "premium",  note: "Rustic character Cherry." },

  // Premium hardwoods
  "QS White Oak":           { pct: 16,  tier: "ultra",    note: "Quarter Sawn White Oak — premium grain pattern." },
  "Rustic Alder":           { pct: 17,  tier: "ultra",    note: "Rustic character Alder." },
  "Paint (Std SW)":         { pct: 18,  tier: "ultra",    note: "Standard Sherwin-Williams paint finish." },
  "Paint (Trend)":          { pct: 18,  tier: "ultra",    note: "Trend paint colors (Sherwin-Williams)." },
  "Rift White Oak":         { pct: 19,  tier: "ultra",    note: "Rift Cut White Oak — premium linear grain." },
  "Walnut":                 { pct: 20,  tier: "ultra",    note: "Walnut — premium dark hardwood." },
  "Rustic Walnut":          { pct: 25,  tier: "ultra",    note: "Rustic character Walnut." },
  "Custom Paint (SW)":      { pct: 28,  tier: "ultra",    note: "Custom Sherwin-Williams color match — most expensive." },
};


// ─── CONSTRUCTION UPCHARGE ────────────────────────────────────────────────
// Percentage upcharge over standard particle board construction
// Source: Eclipse Estimator v8.8.0 CX constant

export const CONSTRUCTION_UPCHARGE = {
  "Standard":                 { pct: 0,   note: "Particle board box — default." },
  "Plywood":                  { pct: 10,  note: "Full plywood box construction." },
};


// ─── DOOR STYLE PRICING ──────────────────────────────────────────────────
// Door Group Charges (Eclipse C3 price list): A=$0, B=$44, C=$88, D=$150 PER DOOR
// Source: Eclipse Estimator v8.8.0 DG constant and DOORS array

export const DOOR_GROUP_CHARGE = { A: 0, B: 44, C: 88, D: 150 };

export const DOOR_STYLE_CHARGE = {
  // Group A — $0/door (flat panels, raised panels, slab)
  "METRO":     { group: "A", groupRate: 0,   label: "Metropolitan (Slab)" },
  "HNVR":      { group: "A", groupRate: 0,   label: "Hanover Flat Panel" },
  "HTFD":      { group: "A", groupRate: 0,   label: "Hartford Flat Panel" },
  "SCDL":      { group: "A", groupRate: 0,   label: "Scottsdale Flat Panel" },
  "MLBU":      { group: "A", groupRate: 0,   label: "Malibu Flat Panel" },
  "WARD":      { group: "A", groupRate: 0,   label: "Ward Flat Panel" },
  "BRST":      { group: "A", groupRate: 0,   label: "Bristol Flat Panel" },
  "CFP":       { group: "A", groupRate: 0,   label: "Crown Flat Panel" },
  "CRP":       { group: "A", groupRate: 0,   label: "Crown Raised Panel" },
  "SFP":       { group: "A", groupRate: 0,   label: "Square Flat Panel" },
  "SRP":       { group: "A", groupRate: 0,   label: "Square Raised Panel" },
  "AFP":       { group: "A", groupRate: 0,   label: "Arch Flat Panel" },
  "ARP":       { group: "A", groupRate: 0,   label: "Arch Raised Panel" },
  "ASPN":      { group: "A", groupRate: 0,   label: "Aspen Flat Panel" },
  "CNCD":      { group: "A", groupRate: 0,   label: "Concord Flat Panel" },
  "GRNS":      { group: "A", groupRate: 0,   label: "Greensboro Flat Panel" },
  "HMLN":      { group: "A", groupRate: 0,   label: "Hamlin Raised Panel" },
  "HRTG":      { group: "A", groupRate: 0,   label: "Heritage Flat Panel" },
  "LNCR":      { group: "A", groupRate: 0,   label: "Lancaster Flat Panel" },
  "NAPA-H":    { group: "A", groupRate: 0,   label: "Napa Horizontal" },
  "NAPA-V":    { group: "A", groupRate: 0,   label: "Napa Vertical" },
  "NHVN":      { group: "A", groupRate: 0,   label: "New Haven Flat Panel" },
  "OXRP":      { group: "A", groupRate: 0,   label: "Oxford Raised Panel" },
  "RCMD":      { group: "A", groupRate: 0,   label: "Richmond Raised Panel" },
  "SMST":      { group: "A", groupRate: 0,   label: "Somerset Flat Panel" },
  "STSVL":     { group: "A", groupRate: 0,   label: "Statesville Flat Panel" },
  "SUMT":      { group: "A", groupRate: 0,   label: "Summit Raised Panel" },
  "TAHOE":     { group: "A", groupRate: 0,   label: "Tahoe Flat Panel" },
  "WMTN":      { group: "A", groupRate: 0,   label: "Wilmington Flat Panel" },
  // Group B — $44/door (miter styles, beaded, reeded)
  "ASVL":      { group: "B", groupRate: 44,  label: "Asherville Miter RP" },
  "BCP":       { group: "B", groupRate: 44,  label: "Beaded Century" },
  "BDFD":      { group: "B", groupRate: 44,  label: "Bradford Miter RP" },
  "CHRS":      { group: "B", groupRate: 44,  label: "Charleston Appl. Mould." },
  "DLTN":      { group: "B", groupRate: 44,  label: "Dalton Miter FP" },
  "ESSX":      { group: "B", groupRate: 44,  label: "Essex Miter FP" },
  "GLBK":      { group: "B", groupRate: 44,  label: "Glenbrook Miter FP" },
  "KNDL":      { group: "B", groupRate: 44,  label: "Kendall Miter FP" },
  "LNDS":      { group: "B", groupRate: 44,  label: "Landes Miter FP" },
  "MNCH":      { group: "B", groupRate: 44,  label: "Manchester Miter RP" },
  "MNTG":      { group: "B", groupRate: 44,  label: "Montgomery Appl. Mould." },
  "PTLN":      { group: "B", groupRate: 44,  label: "Portland Miter RP" },
  "RMLB":      { group: "B", groupRate: 44,  label: "Reeded Malibu" },
  "SVNH":      { group: "B", groupRate: 44,  label: "Savannah Miter RP" },
  "SHBY":      { group: "B", groupRate: 44,  label: "Shelby Miter FP" },
  "WNSR":      { group: "B", groupRate: 44,  label: "Windsor Miter FP" },
  // Group C — $88/door
  // Group D — $150/door
  // Mullion doors — flat per-door surcharge on top of base group
  "GFD":       { group: "A", groupRate: 0,   extra: 0,    label: "Glass Frame Door" },
  "CMD":       { group: "A", groupRate: 0,   extra: 210,  label: "Country Mullion (9 lite)" },
  "FMD":       { group: "A", groupRate: 0,   extra: 210,  label: "Fairfield Mullion (11 lite)" },
  "MD":        { group: "A", groupRate: 0,   extra: 210,  label: "Mullion Door" },
  "XMD":       { group: "A", groupRate: 0,   extra: 825,  label: "X Mullion (4 lite)" },
  "DXMD":      { group: "A", groupRate: 0,   extra: 1171, label: "Double X Mullion (7 lite)" },
};


// ─── DRAWER FRONT STYLES ────────────────────────────────────────────────
// 55 drawer front profiles from Eclipse v8.8.0 (doorData.js).
// Group A = $0/drawer, Group B = $44/drawer — same rate as door groups.
// Drawer fronts are independent from door styles but follow parallel
// naming conventions (e.g. HNVR door → DF-HNVR drawer front).
// Source: eclipse-pricing/src/doorData.js lines 72–107
// ─────────────────────────────────────────────────────────────────────────

export const DRAWER_FRONT_STYLES = {
  // ── Group A — $0 per drawer ──────────────────────────────────────────
  "DF-MET":     { label: "Metropolitan (Slab)",           group: "A", perDrawer: 0, matchesDoor: "METRO",  note: "Clean slab profile, most popular modern." },
  "DF-MET-V":   { label: "Metropolitan Vertical Grain",   group: "A", perDrawer: 0, matchesDoor: "MET-V",  note: "Slab with vertical grain direction." },
  "DF-MET-H":   { label: "Metropolitan Horizontal Grain", group: "A", perDrawer: 0, matchesDoor: "MET-H",  note: "Slab with horizontal grain direction." },
  "DF-MET-MDF": { label: "Metropolitan MDF (Painted M1)", group: "A", perDrawer: 0, matchesDoor: "MET-MDF",note: "MDF slab for painted finishes." },
  "DF-S":       { label: "Slab",                          group: "A", perDrawer: 0, matchesDoor: null,     note: "Plain slab — no grain/texture. Bollini project." },
  "DF-SCLPT":   { label: "Sculpted",                      group: "A", perDrawer: 0, matchesDoor: null,     note: "Sculpted edge profile." },
  "DFS-OXRP":   { label: "Shaped Oxford",                 group: "A", perDrawer: 0, matchesDoor: "OXRP",   note: "Shaped variant of Oxford raised panel." },
  "DFS-RCMD":   { label: "Shaped Richmond",               group: "A", perDrawer: 0, matchesDoor: "RCMD",   note: "Shaped variant of Richmond raised panel." },
  "DFS-SRP":    { label: "Shaped Shaker",                 group: "A", perDrawer: 0, matchesDoor: "SRP",    note: "Shaped variant of shaker raised panel." },

  // ── Group B — $44 per drawer ─────────────────────────────────────────
  // Standard 5-piece profiles
  "DF-BCP":      { label: "Beaded Century",                group: "B", perDrawer: 44, matchesDoor: "BCP",   note: "5-piece beaded inset profile." },
  "DF2.5-BCP":   { label: "Beaded Century (2.5\" rail)",   group: "B", perDrawer: 44, matchesDoor: "BCP",   note: "Narrow 2.5\" rail variant." },
  "DF-CHRS":     { label: "Charleston",                    group: "B", perDrawer: 44, matchesDoor: "CHRS",  note: "Applied moulding detail." },
  "DF-FP":       { label: "Flat Panel",                    group: "B", perDrawer: 44, matchesDoor: null,    note: "Standard flat panel drawer front." },
  "DF2.5-SFP":   { label: "Square Flat Panel (2.5\" rail)",group: "B", perDrawer: 44, matchesDoor: "SFP",   note: "Narrow rail square flat panel." },
  "DF-GRNS":     { label: "Greensboro",                    group: "B", perDrawer: 44, matchesDoor: "GRNS",  note: "Greensboro flat panel profile." },
  "DF2.5-GRNS":  { label: "Greensboro (2.5\" rail)",       group: "B", perDrawer: 44, matchesDoor: "GRNS",  note: "Narrow rail variant." },
  "DF-HNVR":     { label: "Hanover",                       group: "B", perDrawer: 44, matchesDoor: "HNVR",  note: "Most common 5-piece drawer front. Matches Hanover door." },
  "DF2.5-HNVR":  { label: "Hanover (2.5\" rail)",          group: "B", perDrawer: 44, matchesDoor: "HNVR",  note: "Narrow rail variant." },
  "DF-MNTG":     { label: "Montgomery",                    group: "B", perDrawer: 44, matchesDoor: "MNTG",  note: "Applied moulding detail." },
  "DF-NHVN":     { label: "New Haven",                     group: "B", perDrawer: 44, matchesDoor: "NHVN",  note: "New Haven flat panel profile." },
  "DF2.5-NHVN":  { label: "New Haven (2.5\" rail)",        group: "B", perDrawer: 44, matchesDoor: "NHVN",  note: "Narrow rail variant." },
  "DF-OXRP":     { label: "Oxford Raised Panel",           group: "B", perDrawer: 44, matchesDoor: "OXRP",  note: "Raised panel profile." },
  "DF-RCMD":     { label: "Richmond",                      group: "B", perDrawer: 44, matchesDoor: "RCMD",  note: "Richmond raised panel profile." },
  "DF-RP":       { label: "Raised Panel",                  group: "B", perDrawer: 44, matchesDoor: null,    note: "Generic raised panel." },
  "DF-SRP":      { label: "Shaker Raised Panel",           group: "B", perDrawer: 44, matchesDoor: "SRP",   note: "Square raised panel." },
  "DF-SCDL":     { label: "Scottsdale",                    group: "B", perDrawer: 44, matchesDoor: "SCDL",  note: "Scottsdale flat panel profile." },
  "DF2.5-SCDL":  { label: "Scottsdale (2.5\" rail)",       group: "B", perDrawer: 44, matchesDoor: "SCDL",  note: "Narrow rail variant." },
  "DF-SFP":      { label: "Square Flat Panel",             group: "B", perDrawer: 44, matchesDoor: "SFP",   note: "Clean square profile." },
  "DF-SMST":     { label: "Somerset",                      group: "B", perDrawer: 44, matchesDoor: "SMST",  note: "Somerset flat panel profile." },
  "DF2.5-SMST":  { label: "Somerset (2.5\" rail)",         group: "B", perDrawer: 44, matchesDoor: "SMST",  note: "Narrow rail variant." },
  "DF-WARD":     { label: "Ward",                          group: "B", perDrawer: 44, matchesDoor: "WARD",  note: "Ward flat panel profile." },
  "DF2.5-WARD":  { label: "Ward (2.5\" rail)",             group: "B", perDrawer: 44, matchesDoor: "WARD",  note: "Narrow rail variant." },
  "DF-WMTN":     { label: "Wilmington",                    group: "B", perDrawer: 44, matchesDoor: "WMTN",  note: "Wilmington flat panel profile." },
  "DF2.5-WMTN":  { label: "Wilmington (2.5\" rail)",       group: "B", perDrawer: 44, matchesDoor: "WMTN",  note: "Narrow rail variant." },
  // Specialty profiles
  "DF-AFP":      { label: "Arch Flat Panel",               group: "B", perDrawer: 44, matchesDoor: "AFP",   note: "Arched flat panel." },
  "DF-ARP":      { label: "Arch Raised Panel",             group: "B", perDrawer: 44, matchesDoor: "ARP",   note: "Arched raised panel." },
  "DF-CFP":      { label: "Crown Flat Panel",              group: "B", perDrawer: 44, matchesDoor: "CFP",   note: "Crown flat panel." },
  "DF-CRP":      { label: "Crown Raised Panel",            group: "B", perDrawer: 44, matchesDoor: "CRP",   note: "Crown raised panel." },
  "DF-ASPN":     { label: "Aspen",                         group: "B", perDrawer: 44, matchesDoor: "ASPN",  note: "Aspen flat panel." },
  "DF-BRST":     { label: "Bristol",                       group: "B", perDrawer: 44, matchesDoor: "BRST",  note: "Bristol flat panel." },
  "DF-HMLN":     { label: "Hamlin",                        group: "B", perDrawer: 44, matchesDoor: "HMLN",  note: "Hamlin raised panel." },
  "DF-HRTG":     { label: "Heritage",                      group: "B", perDrawer: 44, matchesDoor: "HRTG",  note: "Heritage flat panel." },
  "DF-HTFD":     { label: "Hartford",                      group: "B", perDrawer: 44, matchesDoor: "HTFD",  note: "Hartford flat panel. Bollini SUB DRW FRONT." },
  "DF-LNCR":     { label: "Lancaster",                     group: "B", perDrawer: 44, matchesDoor: "LNCR",  note: "Lancaster flat panel." },
  "DF-TAHOE":    { label: "Tahoe",                         group: "B", perDrawer: 44, matchesDoor: "TAHOE", note: "Tahoe flat panel." },
  "DF-SUMT":     { label: "Summit",                        group: "B", perDrawer: 44, matchesDoor: "SUMT",  note: "Summit raised panel." },
  "DF-STSVL":    { label: "Statesville",                   group: "B", perDrawer: 44, matchesDoor: "STSVL", note: "Statesville flat panel." },
  "DF-CNCD":     { label: "Concord",                       group: "B", perDrawer: 44, matchesDoor: "CNCD",  note: "Concord flat panel." },
  "DF-RMLB":     { label: "Reeded Malibu",                 group: "B", perDrawer: 44, matchesDoor: "RMLB",  note: "Reeded Malibu profile." },
  // 5-piece drawer fronts
  "DF-NAPA-V":   { label: "Napa 5-Piece (Vertical)",       group: "B", perDrawer: 44, matchesDoor: "NAPA-V",note: "5-piece Napa vertical grain." },
  "DF-NAPA-H":   { label: "Napa 5-Piece (Horizontal)",     group: "B", perDrawer: 44, matchesDoor: "NAPA-H",note: "5-piece Napa horizontal grain." },
  "DF-MLBU":     { label: "Malibu 5-Piece",                group: "B", perDrawer: 44, matchesDoor: "MLBU",  note: "5-piece Malibu." },
  // Miter profiles
  "DF-ASVL":     { label: "Asherville Miter",              group: "B", perDrawer: 44, matchesDoor: "ASVL",  note: "Miter raised panel." },
  "DF-BDFD":     { label: "Bradford Miter",                group: "B", perDrawer: 44, matchesDoor: "BDFD",  note: "Miter raised panel." },
  "DF-DLTN":     { label: "Dalton Miter",                  group: "B", perDrawer: 44, matchesDoor: "DLTN",  note: "Miter flat panel." },
  "DF-ESSX":     { label: "Essex Miter",                   group: "B", perDrawer: 44, matchesDoor: "ESSX",  note: "Miter flat panel." },
  "DF-GLBK":     { label: "Glenbrook Miter",               group: "B", perDrawer: 44, matchesDoor: "GLBK",  note: "Miter flat panel." },
  "DF-KNDL":     { label: "Kendall Miter",                 group: "B", perDrawer: 44, matchesDoor: "KNDL",  note: "Miter flat panel." },
  "DF-LNDS":     { label: "Landes Miter",                  group: "B", perDrawer: 44, matchesDoor: "LNDS",  note: "Miter flat panel." },
  "DF-PTLN":     { label: "Portland Miter",                group: "B", perDrawer: 44, matchesDoor: "PTLN",  note: "Miter raised panel." },
  "DF-MNCH":     { label: "Manchester Miter",              group: "B", perDrawer: 44, matchesDoor: "MNCH",  note: "Miter raised panel." },
  "DF-SVNH":     { label: "Savannah Miter",                group: "B", perDrawer: 44, matchesDoor: "SVNH",  note: "Miter raised panel." },
  "DF-WNSR":     { label: "Windsor Miter",                 group: "B", perDrawer: 44, matchesDoor: "WNSR",  note: "Miter flat panel." },
  "DF-SHBY":     { label: "Shelby Miter",                  group: "B", perDrawer: 44, matchesDoor: "SHBY",  note: "Miter flat panel." },
};

/**
 * Get the default matching drawer front for a given door style code.
 * Falls back to DF-S (Slab) if no match found.
 */
export function defaultDrawerFrontForDoor(doorCode) {
  const dfKey = `DF-${doorCode}`;
  if (DRAWER_FRONT_STYLES[dfKey]) return dfKey;
  // Try shaped variant
  const dfsKey = `DFS-${doorCode}`;
  if (DRAWER_FRONT_STYLES[dfsKey]) return dfsKey;
  return "DF-S"; // Slab fallback
}


// ─── DRAWER BOX OPTIONS ─────────────────────────────────────────────────
// 7 drawer box constructions from Eclipse v8.8.0.
// Source: eclipse-pricing/src/doorData.js lines 109–117
// ─────────────────────────────────────────────────────────────────────────

export const DRAWER_BOX_OPTIONS = {
  "5/8-STD":     { label: '5/8" Std Hdwd Dovetail / Blum Tandem Edge',      perDrawer: 0,   note: "Standard — included in base price." },
  "5/8-SM":      { label: '5/8" Simulated Metal / Blum Tandem Edge',        perDrawer: 0,   note: "Standard metal look — no upcharge." },
  "3/4-PREM":    { label: '3/4" Premium Dovetail',                           perDrawer: 57,  note: "Thicker hardwood dovetail." },
  "LEGRA":       { label: 'Legrabox Stainless Steel',                        perDrawer: 372, note: "Blum Legrabox premium stainless." },
  "5/8-STD-FE":  { label: '5/8" Std Hdwd / Blum Full Extension',            perDrawer: 72,  note: "Full extension upgrade on std box." },
  "5/8-SM-FE":   { label: '5/8" Sim Metal / Blum Full Extension',           perDrawer: 72,  note: "Full extension on sim metal box." },
  "3/4-PREM-FE": { label: '3/4" Premium Dovetail / Blum Full Extension',    perDrawer: 129, note: "Premium box with full extension." },
};

// Legacy aliases for backward compatibility
export const DRAWER_UPGRADES = {
  "Standard":               { perDrawer: 0,    note: "Basic drawer box." },
  "5/8\" Hdwd Dovetail":    { perDrawer: 0,    note: "5/8-STD — standard, included in base price." },
  "3/4\" Hdwd Dovetail":    { perDrawer: 57,   note: "3/4-PREM — thicker dovetail (+$57/drw)." },
  "Slab Drawer Front":      { perDrawer: 0,    note: "DF-S slab fronts. Group A — no upcharge." },
  "Legrabox":               { perDrawer: 372,  note: "LEGRA — Blum Legrabox stainless (+$372/drw)." },
};


// ─── DRAWER GUIDE PRICING ────────────────────────────────────────────────

export const DRAWER_GUIDE_UPGRADES = {
  "Standard":          { perDrawer: 0,  note: "Basic roller guides." },
  "Blum FEG Guide":    { perDrawer: 0,  note: "Blum full extension — included in most Eclipse specs." },
  "Blum Edge Guide":   { perDrawer: 5,  note: "Blum Edge soft-close premium. Bissegger Great Room." },
};


// ─── MODIFICATION PRICING ────────────────────────────────────────────────
// Width modifications within 30% N/C threshold are free; beyond that, 30% upcharge

export const MOD_PRICING = {
  widthMod: {
    noCostThreshold: 0.30,     // 30% of cabinets can be width-modified at no charge
    upchargePercent: 30,        // 30% upcharge on cabinets beyond the threshold
    note: "Bennet Utility training note: '30% N/C' — confirmed across multiple projects.",
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
    "RMK":   { charge: 0,    per: "item",  note: "Removable toe kick — no extra charge. Owen throughout." },
    "RCTD":  { charge: 35,   per: "door",  note: "Right contour door. Bissegger WGPD arch doors." },
    "LCTD":  { charge: 35,   per: "door",  note: "Left contour door. Bissegger WGPD arch doors." },
    "GFD":   { charge: 0,    per: "door",  note: "Glass front door — no extra charge but tracked. Alix, Firebird, Showroom ECLD." },
    "MD":    { charge: 15,   per: "door",  note: "Mullion door modification." },
    "SEED":  { charge: 35,   per: "door",  note: "Seeded glass insert — textured glass option." },
    "LD":    { charge: 55,   per: "door",  note: "Leaded glass insert — mullion pattern option." },
    "FROST": { charge: 25,   per: "door",  note: "Frosted glass insert — etched glass option." },
    "FIN INT": { charge: 40, per: "item",  note: "Finished interior. Showroom ECLD display cabs." },
    "FINISHED INT": { charge: 40, per: "item", note: "Finished interior (alias). Solver uses this key for GFD uppers." },
    "RBS":   { charge: 25,   per: "item",  note: "Rollout behind shelves. Bollini SWSC glass display corner — interior rollout tray." },
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


// ─── ACCESSORY FLAT PRICING ──────────────────────────────────────────────
// End panels, fillers, trim — priced per linear foot or per piece

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
    "EDGTL":          { price: 450, per: "panel", note: "Waterfall end panel. Kline Piazza (2×)." },
  },
  fillers: {
    "F3":  { pricePerInch: 8,  note: "3\" filler — Alix, standard." },
    "F6":  { pricePerInch: 10, note: "6\" filler." },
  },
  toeKicks: {
    "TK-N/C":     { price: 0,   per: "8ft", note: "Standard toe kick — no charge, included." },
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
    "DWP": { price: 185, per: "panel", note: "Dishwasher panel overlay — matches door style." },
    "FDP": { price: 225, per: "panel", note: "Fridge panel overlay — panel-ready appliance." },
    "FZP": { price: 145, per: "panel", note: "Freezer drawer panel — fridge with drawer." },
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
    "BC3341":   { price: 250,  per: "column",  note: "Base column 33×41. McCarter bath." },
    "FSLB":     { price: 35,   per: "bracket", note: "Floating shelf bracket." },
  },
  lighting: {
    "UCL": { pricePerFoot: 12, note: "Under-cabinet LED strips." },
    "ICL": { pricePerUnit: 35, note: "In-cabinet lighting for glass display cabs." },
    "TKL": { pricePerFoot: 8,  note: "Toe kick LED strips." },
    "DSL": { pricePerUnit: 45, note: "Display shelf lighting for floating/display shelves." },
  },
};


// ─── APPLIANCE CATALOG ──────────────────────────────────────────────────
// 5 brands × all kitchen categories. MSRP = manufacturer suggested retail
// (2025–2026). Dimensions W×H×D in inches. Packages group appliances into
// coherent suites the designer can assign to a project.
//
// Sources: subzero-wolf.com, thermador.com, fisherpaykel.com,
//          kitchenaid.com, mieleusa.com, ajmadison.com, yaleappliance.com
// ─────────────────────────────────────────────────────────────────────────

export const APPLIANCE_BRANDS = {

  // ═══════════════════════════════════════════════════════════════════════
  // SUB-ZERO  /  WOLF  /  COVE
  // ═══════════════════════════════════════════════════════════════════════
  "Sub-Zero": {
    tier: "ultra-premium",
    website: "subzero-wolf.com",
    categories: {

      // ── Refrigeration ────────────────────────────────────────────────
      refrigeration: {
        "CL3650UFD/S":  { type: "french-door",   w: 36, h: 84, d: 24, msrp: 14170, features: "panel-ready, internal dispenser, ice maker" },
        "CL3650UFD/O":  { type: "french-door",   w: 36, h: 84, d: 24, msrp: 15025, features: "stainless pro-handle, ice maker" },
        "CL4250UFD/S":  { type: "french-door",   w: 42, h: 84, d: 24, msrp: 15640, features: "panel-ready, ice maker, 25.3 cu ft" },
        "CL4850UFD/S":  { type: "french-door",   w: 48, h: 84, d: 24, msrp: 17025, features: "panel-ready, ice maker, 28.9 cu ft" },
        "CL4850UFDSP":  { type: "french-door",   w: 48, h: 84, d: 24, msrp: 17025, features: "stainless pro-handle, ice maker" },
        "CL3650U/S":    { type: "over-under",    w: 36, h: 84, d: 24, msrp: 11070, features: "panel-ready, top-fridge bottom-freezer" },
        "CL4250U/S":    { type: "over-under",    w: 42, h: 84, d: 24, msrp: 13005, features: "panel-ready, 25 cu ft" },
        "DEC2450R":     { type: "column-fridge",  w: 24, h: 84, d: 24, msrp: 8550,  features: "panel-ready, Designer series" },
        "DEC3050R":     { type: "column-fridge",  w: 30, h: 84, d: 24, msrp: 9700,  features: "panel-ready, 17.3 cu ft" },
        "DEC3050RID":   { type: "column-fridge",  w: 30, h: 84, d: 24, msrp: 10335, features: "internal dispenser, panel-ready" },
        "DEC3650R":     { type: "column-fridge",  w: 36, h: 84, d: 24, msrp: 10950, features: "panel-ready, 21.7 cu ft" },
        "DEC1850FI":    { type: "column-freezer", w: 18, h: 84, d: 24, msrp: 7200,  features: "panel-ready, ice maker, Designer" },
        "DEC2450FI":    { type: "column-freezer", w: 24, h: 84, d: 24, msrp: 9700,  features: "panel-ready, ice maker" },
        "DEC3050FI":    { type: "column-freezer", w: 30, h: 84, d: 24, msrp: 10100, features: "panel-ready, ice maker" },
      },

      // ── Undercounter ─────────────────────────────────────────────────
      undercounter: {
        "UC24R":        { type: "undercounter-fridge", w: 24, h: 34.5, d: 24, msrp: 4250,  features: "panel-ready, 5.7 cu ft" },
        "UC24CI":       { type: "undercounter-combo",  w: 24, h: 34.5, d: 24, msrp: 4850,  features: "panel-ready, ice maker" },
        "DEU2450BG":    { type: "beverage-center",     w: 24, h: 34.5, d: 24, msrp: 3595,  features: "panel-ready, LED" },
        "DEU1550B":     { type: "beverage-center",     w: 15, h: 34.5, d: 24, msrp: 3100,  features: "panel-ready, compact" },
        "UC15I":        { type: "ice-maker",           w: 15, h: 34.5, d: 24, msrp: 3650,  features: "panel-ready, 25 lb/day" },
        "UC15IP":       { type: "ice-maker",           w: 15, h: 34.5, d: 24, msrp: 3950,  features: "panel-ready, drain pump" },
      },

      // ── Wine Storage ─────────────────────────────────────────────────
      wine: {
        "DEU2450W":     { type: "wine-undercounter", w: 24, h: 34.5, d: 24, msrp: 4200,  features: "dual-zone, 46-bottle, panel-ready" },
        "DEC3050W":     { type: "wine-column",       w: 30, h: 84,   d: 24, msrp: 7800,  features: "146-bottle, UV glass, panel-ready" },
        "CL3050W":      { type: "wine-column",       w: 30, h: 84,   d: 24, msrp: 7600,  features: "146-bottle, Classic series" },
      },
    },
  },

  "Wolf": {
    tier: "ultra-premium",
    website: "subzero-wolf.com",
    categories: {

      // ── Ranges ───────────────────────────────────────────────────────
      ranges: {
        // Dual Fuel
        "DF30450":      { type: "range-dual-fuel",   w: 30, h: 36, d: 29, fuel: "dual-fuel", msrp: 9180,  features: "4 burners, convection" },
        "DF36450G":     { type: "range-dual-fuel",   w: 36, h: 36, d: 29, fuel: "dual-fuel", msrp: 11860, features: "4 burners + infrared griddle" },
        "DF36650":      { type: "range-dual-fuel",   w: 36, h: 36, d: 29, fuel: "dual-fuel", msrp: 12940, features: "6 sealed burners, convection" },
        "DF48450DG":    { type: "range-dual-fuel",   w: 48, h: 36, d: 29, fuel: "dual-fuel", msrp: 18315, features: "4 burners + dual griddle, dual oven" },
        "DF48650G":     { type: "range-dual-fuel",   w: 48, h: 36, d: 29, fuel: "dual-fuel", msrp: 18180, features: "6 burners + griddle, dual oven" },
        "DF60650DG":    { type: "range-dual-fuel",   w: 60, h: 36, d: 29, fuel: "dual-fuel", msrp: 23695, features: "6 burners + dual griddle, dual oven" },
        // Gas
        "GR304":        { type: "range-gas",         w: 30, h: 36, d: 29, fuel: "gas",       msrp: 7340,  features: "4 sealed burners, infrared broiler" },
        "GR366":        { type: "range-gas",         w: 36, h: 36, d: 29, fuel: "gas",       msrp: 9650,  features: "6 sealed burners" },
        "GR486G":       { type: "range-gas",         w: 48, h: 36, d: 29, fuel: "gas",       msrp: 14980, features: "6 burners + griddle, dual oven" },
        "GR606DG":      { type: "range-gas",         w: 60, h: 36, d: 29, fuel: "gas",       msrp: 19450, features: "6 burners + dual griddle, dual oven" },
        // Induction
        "IR30450":      { type: "range-induction",   w: 30, h: 36, d: 29, fuel: "induction", msrp: 9940,  features: "7-zone FlexInduction, transitional" },
        "IR36550":      { type: "range-induction",   w: 36, h: 36, d: 29, fuel: "induction", msrp: 13290, features: "7-zone FlexInduction, transitional" },
        "IR48551":      { type: "range-induction",   w: 48, h: 36, d: 29, fuel: "induction", msrp: 18750, features: "7-zone, dual oven, professional" },
      },

      // ── Cooktops ─────────────────────────────────────────────────────
      cooktops: {
        "CG365P/S":     { type: "cooktop-gas",       w: 36, h: 6,  d: 21, fuel: "gas",       msrp: 3280,  features: "5 dual-stacked sealed burners" },
        "CG304P/S":     { type: "cooktop-gas",       w: 30, h: 6,  d: 21, fuel: "gas",       msrp: 2780,  features: "4 dual-stacked sealed burners" },
        "CI36560C":     { type: "cooktop-induction",  w: 36, h: 5,  d: 21, fuel: "induction", msrp: 4150,  features: "5-zone contemporary, flush mount" },
        "CI365TF":      { type: "cooktop-induction",  w: 36, h: 5,  d: 21, fuel: "induction", msrp: 3780,  features: "5-zone framed, transitional" },
        "CI30460T":     { type: "cooktop-induction",  w: 30, h: 5,  d: 21, fuel: "induction", msrp: 3740,  features: "5-zone transitional, bridge" },
        "CI304TF":      { type: "cooktop-induction",  w: 30, h: 5,  d: 21, fuel: "induction", msrp: 3105,  features: "5-zone framed, transitional" },
        "CE365TS":      { type: "cooktop-electric",   w: 36, h: 5,  d: 21, fuel: "electric",  msrp: 2450,  features: "5 elements, bridge zone" },
        "CE304T/S":     { type: "cooktop-electric",   w: 30, h: 5,  d: 21, fuel: "electric",  msrp: 2180,  features: "4 elements, transitional" },
      },

      // ── Rangetops ────────────────────────────────────────────────────
      rangetops: {
        "SRT366":       { type: "rangetop-gas",      w: 36, h: 9,  d: 28, fuel: "gas",       msrp: 6180,  features: "6 sealed burners, continuous grates" },
        "SRT486G":      { type: "rangetop-gas",      w: 48, h: 9,  d: 28, fuel: "gas",       msrp: 8650,  features: "6 burners + griddle" },
        "SRT484CG":     { type: "rangetop-gas",      w: 48, h: 9,  d: 28, fuel: "gas",       msrp: 9100,  features: "4 burners + charbroiler + griddle" },
      },

      // ── Wall Ovens ───────────────────────────────────────────────────
      ovens: {
        "SO3050PM":     { type: "oven-single",       w: 30, h: 29, d: 24, msrp: 7230,  features: "M Series Professional, dual VertiFlow, 5.1 cu ft" },
        "SO30CM":       { type: "oven-single",       w: 30, h: 29, d: 24, msrp: 7230,  features: "M Series Contemporary, handleless" },
        "SO30US":       { type: "oven-single",       w: 30, h: 29, d: 24, msrp: 5840,  features: "E Series, 4.5 cu ft, cobalt interior" },
        "DO3050PM":     { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 11060, features: "M Series Professional, dual oven" },
        "DO3050PE":     { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 9480,  features: "E Series Professional, dual oven" },
        "DO30CMB":      { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 11060, features: "M Series Contemporary, dual oven" },
      },

      // ── Steam & Speed Ovens ──────────────────────────────────────────
      steam: {
        "CSO3050TM":    { type: "steam-combi",       w: 30, h: 19, d: 24, msrp: 6870,  features: "M Series, 12 modes, convection steam" },
        "CSO24TESTH":   { type: "steam-combi",       w: 24, h: 19, d: 24, msrp: 5650,  features: "E Series, 1.8 cu ft, 12 modes" },
        "SPO3050PM":    { type: "speed-oven",        w: 30, h: 19, d: 24, msrp: 5980,  features: "M Series, microwave+convection+broil" },
        "SPO2450TE":    { type: "speed-oven",        w: 24, h: 19, d: 24, msrp: 4890,  features: "E Series, 3-in-1 cooking" },
      },

      // ── Microwaves & Warming Drawers ─────────────────────────────────
      micro_warm: {
        "MC24":         { type: "microwave",         w: 24, h: 19, d: 22, msrp: 1355,  features: "1.5 cu ft, 900W convection" },
        "MD24TE":       { type: "microwave-drawer",  w: 24, h: 16, d: 23, msrp: 2150,  features: "transitional drawer, 1.2 cu ft" },
        "WWD30":        { type: "warming-drawer",    w: 30, h: 10, d: 24, msrp: 2650,  features: "1.6 cu ft, 80–200°F" },
      },

      // ── Ventilation ──────────────────────────────────────────────────
      ventilation: {
        "PW302210":     { type: "hood-wall",         w: 30, h: 18, d: 22, msrp: 2045,  features: "low-profile, 600 CFM" },
        "PW362210":     { type: "hood-wall",         w: 36, h: 18, d: 22, msrp: 2280,  features: "low-profile, 600 CFM" },
        "PW362418":     { type: "hood-pro-wall",     w: 36, h: 18, d: 24, msrp: 3350,  features: "pro wall, 1200 CFM" },
        "PW482210":     { type: "hood-wall",         w: 48, h: 18, d: 22, msrp: 2510,  features: "low-profile, 600 CFM" },
        "PW482418":     { type: "hood-pro-wall",     w: 48, h: 18, d: 24, msrp: 3850,  features: "pro wall, 1200 CFM" },
        "PW602418":     { type: "hood-pro-wall",     w: 60, h: 18, d: 24, msrp: 4280,  features: "pro wall, 1200 CFM" },
        "VI36S":        { type: "hood-insert",       w: 36, h: 12, d: 22, msrp: 1850,  features: "ventilation insert, 600 CFM" },
        "VI48S":        { type: "hood-insert",       w: 48, h: 12, d: 22, msrp: 2200,  features: "ventilation insert, 600 CFM" },
      },

      // ── Outdoor ──────────────────────────────────────────────────────
      outdoor: {
        "OG36":         { type: "outdoor-grill",     w: 36, h: 24, d: 27, fuel: "gas", msrp: 7680,  features: "4 burners + sear, rotisserie" },
        "OG42":         { type: "outdoor-grill",     w: 42, h: 24, d: 27, fuel: "gas", msrp: 8950,  features: "5 burners + sear, stainless" },
        "OG54":         { type: "outdoor-grill",     w: 54, h: 24, d: 27, fuel: "gas", msrp: 10400, features: "6 burners + sear, pro" },
      },
    },
  },

  "Cove": {
    tier: "ultra-premium",
    website: "subzero-wolf.com",
    categories: {
      dishwashers: {
        "DW2450":       { type: "dishwasher",        w: 24, h: 34.5, d: 23.25, msrp: 2800,  features: "panel-ready, 12 cycles, 41 dBA, 3rd rack" },
        "DW2451":       { type: "dishwasher",        w: 24, h: 34.5, d: 23.25, msrp: 2935,  features: "panel-ready, 12 cycles, water softener" },
        "DW2451WS":     { type: "dishwasher",        w: 24, h: 34.5, d: 23.25, msrp: 3050,  features: "stainless, 12 cycles, water softener" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // THERMADOR
  // ═══════════════════════════════════════════════════════════════════════
  "Thermador": {
    tier: "luxury",
    website: "thermador.com",
    promotion: "One-Two-Free: buy qualifying cooking + refrigeration, get free dishwasher/hood/more",
    categories: {

      // ── Refrigeration ────────────────────────────────────────────────
      refrigeration: {
        "T36IT100NP":   { type: "french-door",      w: 36, h: 84,   d: 25, msrp: 10499, features: "panel-ready, 20.1 cu ft, Freedom Hinge" },
        "T42IT100NP":   { type: "french-door",      w: 42, h: 84,   d: 25, msrp: 12499, features: "panel-ready, 23.1 cu ft" },
        "T48IT100NP":   { type: "french-door",      w: 48, h: 84,   d: 25, msrp: 14499, features: "panel-ready, 26.7 cu ft" },
        "T36FT820NS":   { type: "bottom-freezer",   w: 36, h: 70,   d: 24.5, msrp: 8999,  features: "freestanding, 20.8 cu ft" },
        "T24IR905SP":   { type: "column-fridge",     w: 24, h: 84,   d: 24, msrp: 7499,  features: "panel-ready, 15.4 cu ft" },
        "T30IR905SP":   { type: "column-fridge",     w: 30, h: 84,   d: 24, msrp: 9099,  features: "panel-ready, 20.6 cu ft" },
        "T36IR905SP":   { type: "column-fridge",     w: 36, h: 84,   d: 24, msrp: 9099,  features: "panel-ready, 19.4 cu ft" },
        "T18IF905SP":   { type: "column-freezer",    w: 18, h: 84,   d: 24, msrp: 4699,  features: "panel-ready, 9.6 cu ft" },
        "T24IF905SP":   { type: "column-freezer",    w: 24, h: 84,   d: 24, msrp: 5499,  features: "panel-ready, 13 cu ft" },
        "T24UW905LP":   { type: "wine-undercounter",  w: 24, h: 34,   d: 24, msrp: 3949,  features: "41-bottle, dual zone, left hinge" },
        "T24UR925RS":   { type: "undercounter-fridge", w: 24, h: 34,   d: 24, msrp: 4999,  features: "5.2 cu ft, stainless, glass door" },
        "T24UC905DP":   { type: "fridge-drawer",      w: 24, h: 34,   d: 24, msrp: 4349,  features: "4.3 cu ft, panel-ready" },
      },

      // ── Ranges ───────────────────────────────────────────────────────
      ranges: {
        // Pro Harmony
        "PRG305WH":     { type: "range-gas",         w: 30, h: 36, d: 28, fuel: "gas",       msrp: 5899,  features: "Pro Harmony, 5 Star burners" },
        "PRD304WHU":    { type: "range-dual-fuel",   w: 30, h: 36, d: 28, fuel: "dual-fuel", msrp: 6599,  features: "Pro Harmony, 5 Star burners" },
        "PRI30LBHU":    { type: "range-induction",   w: 30, h: 36, d: 28, fuel: "induction", msrp: 8999,  features: "Pro Harmony, Liberty Induction" },
        "PRG366WH":     { type: "range-gas",         w: 36, h: 36, d: 28, fuel: "gas",       msrp: 7749,  features: "Pro Harmony, 6 burners" },
        "PRD366WHU":    { type: "range-dual-fuel",   w: 36, h: 36, d: 28, fuel: "dual-fuel", msrp: 9499,  features: "Pro Harmony, 6 burners" },
        "PRI36LBHU":    { type: "range-induction",   w: 36, h: 36, d: 28, fuel: "induction", msrp: 12499, features: "Pro Harmony, 5 elements" },
        // Pro Grand
        "PRG486WDH":    { type: "range-gas",         w: 48, h: 36, d: 28, fuel: "gas",       msrp: 12699, features: "Pro Grand, 6 burners + griddle" },
        "PRD486WDHU":   { type: "range-dual-fuel",   w: 48, h: 36, d: 28, fuel: "dual-fuel", msrp: 15699, features: "Pro Grand, 6 burners + griddle" },
        "PRD486WDGU":   { type: "range-dual-fuel",   w: 48, h: 36, d: 28, fuel: "dual-fuel", msrp: 16999, features: "Pro Grand, 6 burners + griddle, steam" },
        "PRD606WESG":   { type: "range-dual-fuel",   w: 60, h: 36, d: 28, fuel: "dual-fuel", msrp: 24699, features: "Pro Grand, 6 burners + grill + griddle" },
      },

      // ── Cooktops ─────────────────────────────────────────────────────
      cooktops: {
        "PCG305W":      { type: "cooktop-gas",       w: 30, h: 5,  d: 21, fuel: "gas",       msrp: 3699,  features: "5 Star burners, pedestal" },
        "PCG366W":      { type: "rangetop-gas",      w: 36, h: 10, d: 27, fuel: "gas",       msrp: 4899,  features: "6 Star burners" },
        "PCG486WD":     { type: "rangetop-gas",      w: 48, h: 10, d: 27, fuel: "gas",       msrp: 5999,  features: "6 burners + griddle" },
        "CIT304BB":     { type: "cooktop-induction",  w: 30, h: 4,  d: 21, fuel: "induction", msrp: 3499,  features: "Liberty, 4 elements" },
        "CIT365BB":     { type: "cooktop-induction",  w: 36, h: 4,  d: 21, fuel: "induction", msrp: 4099,  features: "Liberty, 5 elements" },
        "CIT30YWBB":    { type: "cooktop-induction",  w: 30, h: 4,  d: 21, fuel: "induction", msrp: 5799,  features: "Heritage, 5 elements, HomeConnect" },
        "CIT36YWB":     { type: "cooktop-induction",  w: 36, h: 4,  d: 21, fuel: "induction", msrp: 6599,  features: "Heritage, 7 elements, Freedom" },
      },

      // ── Wall Ovens ───────────────────────────────────────────────────
      ovens: {
        "POD301W":      { type: "oven-single",       w: 30, h: 29, d: 24, msrp: 6199,  features: "Professional, 4.5 cu ft, convection" },
        "PODS301B":     { type: "oven-single-steam",  w: 30, h: 29, d: 24, msrp: 6499,  features: "Professional, steam convection" },
        "PODS302W":     { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 8799,  features: "Professional, steam convection, dual" },
        "MEDS302WS":    { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 9299,  features: "Masterpiece, steam convection, dual" },
        "PODMCW31W":    { type: "oven-triple",       w: 30, h: 74, d: 24, msrp: 12999, features: "Triple: speed + double oven" },
      },

      // ── Microwaves & Specialty ───────────────────────────────────────
      micro_warm: {
        "MBES":         { type: "microwave",         w: 24, h: 19, d: 22, msrp: 2199,  features: "built-in, 2.1 cu ft" },
        "MBCS":         { type: "microwave",         w: 24, h: 19, d: 22, msrp: 2399,  features: "Masterpiece, 2.1 cu ft, sensor" },
        "WD30W":        { type: "warming-drawer",    w: 30, h: 10, d: 24, msrp: 2399,  features: "4 place settings, 3 modes" },
        "WD30WC":       { type: "warming-drawer",    w: 30, h: 10, d: 24, msrp: 2399,  features: "custom panel, 3 modes" },
        "TCM24PS":      { type: "coffee-machine",    w: 24, h: 18, d: 22, msrp: 4729,  features: "built-in, plumbed, WiFi, auto" },
      },

      // ── Ventilation ──────────────────────────────────────────────────
      ventilation: {
        "PH30HWS":      { type: "hood-wall",         w: 30, h: 18, d: 22, msrp: 2799,  features: "Professional, stainless" },
        "PH36HWS":      { type: "hood-wall",         w: 36, h: 18, d: 22, msrp: 3299,  features: "Professional, stainless" },
        "PH48HWS":      { type: "hood-wall",         w: 48, h: 18, d: 24, msrp: 3799,  features: "Professional, stainless" },
        "HMWB36WS":     { type: "hood-wall",         w: 36, h: 18, d: 22, msrp: 2499,  features: "Masterpiece, 4-speed, 600 CFM" },
        "VCI248DS":     { type: "hood-insert",       w: 48, h: 12, d: 22, msrp: 2350,  features: "custom insert, 600 CFM" },
      },

      // ── Dishwashers ──────────────────────────────────────────────────
      dishwashers: {
        "DWHD550FPR":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2299,  features: "Emerald, 48 dBA, panel-ready" },
        "DWHD660FPR":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2599,  features: "Sapphire, 44 dBA, 3rd rack" },
        "DWHD870WFP":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2799,  features: "Star Sapphire, 42 dBA, StarDry" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FISHER & PAYKEL
  // ═══════════════════════════════════════════════════════════════════════
  "Fisher & Paykel": {
    tier: "premium",
    website: "fisherpaykel.com",
    categories: {

      // ── Refrigeration ────────────────────────────────────────────────
      refrigeration: {
        "RF170BRPX6-N":   { type: "bottom-freezer",   w: 31, h: 68, d: 27.5, series: 5,  msrp: 2549,  features: "counter-depth, 17.5 cu ft" },
        "RF170ADX4-N":    { type: "french-door",       w: 31, h: 68, d: 27.5, series: 7,  msrp: 3399,  features: "ActiveSmart, ice/water, 17 cu ft" },
        "RF201ADX5N":     { type: "french-door",       w: 36, h: 70, d: 27.5, series: 7,  msrp: 3749,  features: "counter-depth, 20 cu ft" },
        "RS36A72J1-N":    { type: "french-door-bi",    w: 36, h: 72, d: 24,   series: 7,  msrp: 5850,  features: "panel-ready built-in, 16.8 cu ft" },
        "RS3684WRUVE1":   { type: "bottom-freezer-bi", w: 36, h: 84, d: 24,   series: 11, msrp: 10500, features: "panel-ready, 19.2 cu ft, ActiveSmart" },
        "RB36S25MKIWN1":  { type: "cool-drawer",       w: 36, h: 34, d: 24,   series: 9,  msrp: 4899,  features: "multi-temp fridge/freezer/wine" },
      },

      // ── Ranges ───────────────────────────────────────────────────────
      ranges: {
        "OR30SCG4X1":   { type: "range-gas",         w: 30, h: 37.5, d: 25, fuel: "gas",       series: 7,  msrp: 4299,  features: "Classic, 4 burners" },
        "OR30SDG6X1":   { type: "range-gas",         w: 30, h: 37.5, d: 25, fuel: "gas",       series: 9,  msrp: 5299,  features: "Professional, 4 burners" },
        "OR30SDI6X1":   { type: "range-induction",   w: 30, h: 36.5, d: 25, fuel: "induction", series: 9,  msrp: 6499,  features: "4-zone, self-clean" },
        "OR36SCG6X1":   { type: "range-dual-fuel",   w: 36, h: 37.5, d: 25, fuel: "dual-fuel", series: 9,  msrp: 7999,  features: "5 burners + induction bridge" },
        "OR36SDG6X1":   { type: "range-gas",         w: 36, h: 37.5, d: 25, fuel: "gas",       series: 9,  msrp: 6299,  features: "5 burners, convection" },
        "OR36SDI6X1":   { type: "range-induction",   w: 36, h: 36.5, d: 25, fuel: "induction", series: 9,  msrp: 8399,  features: "5-zone SmartZone" },
        "RIV3-486":     { type: "range-induction",   w: 48, h: 36.5, d: 25, fuel: "induction", series: 11, msrp: 16849, features: "6-zone, dual oven, self-clean" },
        "RHV3-484-N":   { type: "range-hybrid",      w: 48, h: 36.5, d: 25, fuel: "gas+induction", series: 11, msrp: 17149, features: "4 gas + 4 induction, dual oven" },
        "RDV3-486GD-N": { type: "range-gas",         w: 48, h: 36.5, d: 25, fuel: "gas",       series: 9,  msrp: 15949, features: "6 burners, griddle, dual oven" },
      },

      // ── Cooktops ─────────────────────────────────────────────────────
      cooktops: {
        "CG305DNGX1N":  { type: "cooktop-gas",       w: 30, h: 5,  d: 21, fuel: "gas",       series: 7, msrp: 2499, features: "5 burners, sealed" },
        "CG365DNGX1":   { type: "cooktop-gas",       w: 36, h: 5,  d: 21, fuel: "gas",       series: 7, msrp: 2899, features: "5 burners, sealed" },
        "CI36DTTX1":    { type: "cooktop-induction",  w: 36, h: 4,  d: 21, fuel: "induction", series: 9, msrp: 3899, features: "5-zone SmartZone" },
        "CI365DTTB1":   { type: "cooktop-induction",  w: 36, h: 4,  d: 21, fuel: "induction", series: 11, msrp: 4350, features: "5-zone, black glass" },
        "CID364DTB4":   { type: "cooktop-induction",  w: 36, h: 8,  d: 21, fuel: "induction", series: 9, msrp: 4599, features: "4-zone + integrated ventilation" },
      },

      // ── Wall Ovens ───────────────────────────────────────────────────
      ovens: {
        "OB30SCEPX3N":  { type: "oven-single",       w: 30, h: 29, d: 22, series: 7,  msrp: 2799, features: "convection, self-clean" },
        "OB30SDPTX1":   { type: "oven-single",       w: 30, h: 29, d: 22, series: 9,  msrp: 3599, features: "17 functions, self-clean" },
        "OB30DDEPX3N":  { type: "oven-double",       w: 30, h: 51, d: 22, series: 7,  msrp: 4299, features: "dual 4.1 cu ft cavities" },
        "OB30DDPTX1":   { type: "oven-double",       w: 30, h: 51, d: 22, series: 9,  msrp: 5099, features: "17 functions, dual convection" },
        "OB30DPPTX1":   { type: "oven-double",       w: 30, h: 51, d: 22, series: 9,  msrp: 5499, features: "Professional, dual, pyrolytic" },
      },

      // ── Speed Ovens & Microwave ──────────────────────────────────────
      micro_warm: {
        "OM24NDLX1":    { type: "speed-oven",        w: 24, h: 18, d: 22, series: 7,  msrp: 2299, features: "19 functions" },
        "OM24NDTDX1":   { type: "speed-oven",        w: 24, h: 18, d: 22, series: 9,  msrp: 2799, features: "22 functions" },
        "OM30NDTDX1":   { type: "speed-oven",        w: 30, h: 18, d: 22, series: 9,  msrp: 3499, features: "22 functions" },
        "CMOH30SS3T":   { type: "microwave-otr",     w: 30, h: 17, d: 16, series: 7,  msrp: 1899, features: "over-the-range, 1.1 cu ft" },
        "WD24D":        { type: "warming-drawer",    w: 24, h: 10, d: 22, series: 9,  msrp: 2499, features: "6 programs, 16 place settings" },
      },

      // ── Ventilation ──────────────────────────────────────────────────
      ventilation: {
        "HC36DTXB2":    { type: "hood-wall",         w: 36, h: 36, d: 20, series: 7,  msrp: 1899, features: "chimney, 600 CFM" },
        "HC48DTXB2":    { type: "hood-wall",         w: 48, h: 36, d: 20, series: 7,  msrp: 2299, features: "chimney, 900 CFM" },
        "VH36DTXB2":    { type: "hood-undermount",   w: 36, h: 6,  d: 20, series: 9,  msrp: 2699, features: "integrated, 600 CFM" },
        "HD36":         { type: "downdraft",         w: 36, h: 18, d: 14, series: 7,  msrp: 2499, features: "telescopic, 600 CFM" },
      },

      // ── Dishwashers ──────────────────────────────────────────────────
      dishwashers: {
        "DW24UNT2X2":   { type: "dishwasher",        w: 24, h: 34, d: 23, series: 5,  msrp: 1299, features: "front control, 14 settings" },
        "DW24UNT4X2":   { type: "dishwasher",        w: 24, h: 34, d: 23, series: 7,  msrp: 1899, features: "top control, sanitize" },
        "DD24SAX9-N":   { type: "dishdrawer-single",  w: 24, h: 18, d: 23, series: 7,  msrp: 1799, features: "DishDrawer, 7 settings" },
        "DD24DAX9-N":   { type: "dishdrawer-double",  w: 24, h: 34, d: 23, series: 7,  msrp: 2299, features: "double DishDrawer, 14 settings" },
        "DD24DCTX9-N":  { type: "dishdrawer-double",  w: 24, h: 34, d: 23, series: 9,  msrp: 2699, features: "tall double DishDrawer" },
        "DD24DTX6PX1":  { type: "dishdrawer-double",  w: 24, h: 34, d: 23, series: 11, msrp: 2899, features: "tall double, 44 dBA, premium" },
        "DD24DTX6HI1":  { type: "dishdrawer-double",  w: 24, h: 34, d: 23, series: 11, msrp: 3299, features: "integrated panel, tall" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // KITCHENAID
  // ═══════════════════════════════════════════════════════════════════════
  "KitchenAid": {
    tier: "premium",
    website: "kitchenaid.com",
    categories: {

      // ── Refrigeration ────────────────────────────────────────────────
      refrigeration: {
        "KBSD706MPS":   { type: "side-by-side",     w: 36, h: 84, d: 25.5, msrp: 9200,  features: "built-in, 25.5 cu ft, PrintShield" },
        "KBFN502ESS":   { type: "french-door",      w: 42, h: 84, d: 25,   msrp: 10500, features: "built-in, 24.2 cu ft, Platinum Interior" },
        "KBFN506ESS":   { type: "french-door",      w: 36, h: 84, d: 25,   msrp: 10599, features: "built-in, 20.8 cu ft, ExtendFresh" },
        "KBSD708MPS":   { type: "side-by-side",     w: 48, h: 84, d: 25.5, msrp: 11000, features: "built-in, 29.4 cu ft, PrintShield" },
        "KBSD618ESS":   { type: "side-by-side",     w: 48, h: 84, d: 25.5, msrp: 9800,  features: "built-in, 29.5 cu ft" },
        "KRFC704FPS":   { type: "french-door-cd",    w: 36, h: 72, d: 29,   msrp: 3699,  features: "counter-depth, 23.8 cu ft" },
        "KUWR214KSB":   { type: "wine-undercounter",  w: 24, h: 34, d: 24,   msrp: 2649,  features: "46-bottle, dual zone" },
        "KURL114KSB":   { type: "undercounter-fridge", w: 24, h: 34, d: 24,   msrp: 2799,  features: "5.1 cu ft, stainless" },
        "KUIX535HPS":   { type: "ice-maker",          w: 15, h: 34, d: 24,   msrp: 2899,  features: "25 lb/day, clear ice, PrintShield" },
      },

      // ── Ranges ───────────────────────────────────────────────────────
      ranges: {
        "KFGC500JSS":   { type: "range-gas",         w: 30, h: 36, d: 29, fuel: "gas",       msrp: 3499, features: "5 burners, Even-Heat convection" },
        "KFDC500JSS":   { type: "range-dual-fuel",   w: 30, h: 36, d: 29, fuel: "dual-fuel", msrp: 3899, features: "5 burners, Even-Heat True convection" },
        "KFGC506JSS":   { type: "range-gas",         w: 36, h: 36, d: 29, fuel: "gas",       msrp: 4399, features: "6 burners, commercial-style" },
        "KFDC506JSS":   { type: "range-dual-fuel",   w: 36, h: 36, d: 29, fuel: "dual-fuel", msrp: 5299, features: "6 burners, dual convection" },
        "KFGC558JSS":   { type: "range-gas",         w: 48, h: 36, d: 29, fuel: "gas",       msrp: 7999, features: "6 burners + griddle, dual oven" },
        "KFDC558JSS":   { type: "range-dual-fuel",   w: 48, h: 36, d: 29, fuel: "dual-fuel", msrp: 8999, features: "6 burners + griddle, dual oven" },
      },

      // ── Cooktops ─────────────────────────────────────────────────────
      cooktops: {
        "KCGS950ESS":   { type: "cooktop-gas",       w: 30, h: 5, d: 21, fuel: "gas",       msrp: 1699, features: "5 burners, Even-Heat" },
        "KCGS956ESS":   { type: "cooktop-gas",       w: 36, h: 5, d: 21, fuel: "gas",       msrp: 2099, features: "6 burners, continuous grates" },
        "KCES956KSS":   { type: "cooktop-electric",   w: 36, h: 4, d: 21, fuel: "electric",  msrp: 1899, features: "5 elements, Even-Heat" },
        "KICU569XSS":   { type: "cooktop-induction",  w: 36, h: 4, d: 21, fuel: "induction", msrp: 2499, features: "5 elements, Simmer/Melt" },
      },

      // ── Wall Ovens ───────────────────────────────────────────────────
      ovens: {
        "KOSE500ESS":   { type: "oven-single",       w: 30, h: 29, d: 24, msrp: 2999, features: "5.0 cu ft, Even-Heat True convection" },
        "KODE500ESS":   { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 4299, features: "dual 5.0 cu ft, Even-Heat" },
        "KOCE500ESS":   { type: "oven-combo",        w: 30, h: 51, d: 24, msrp: 3899, features: "oven + microwave combo" },
        "KODE900HSS":   { type: "oven-double",       w: 30, h: 51, d: 24, msrp: 5699, features: "Smart Oven+, powered attachment" },
      },

      // ── Microwaves & Warming ─────────────────────────────────────────
      micro_warm: {
        "KMBP100ESS":   { type: "microwave-bi",      w: 30, h: 20, d: 22, msrp: 1599, features: "built-in, 1.4 cu ft, 1000W, convection" },
        "KMBS104ESS":   { type: "microwave-bi",      w: 24, h: 19, d: 22, msrp: 1249, features: "built-in, 1.4 cu ft, 950W" },
        "KOWT100ESS":   { type: "warming-drawer",    w: 30, h: 10, d: 24, msrp: 1349, features: "slow-cook, bread proofing" },
        "KTTS505ESS":   { type: "trash-compactor",   w: 15, h: 34, d: 24, msrp: 1699, features: "1.4 cu ft, undercounter" },
      },

      // ── Ventilation ──────────────────────────────────────────────────
      ventilation: {
        "KVWB400DSS":   { type: "hood-wall",         w: 30, h: 18, d: 20, msrp: 999,  features: "canopy, 400 CFM, 3-speed" },
        "KVWB406DSS":   { type: "hood-wall",         w: 36, h: 18, d: 20, msrp: 1099, features: "canopy, 400 CFM, LED" },
        "KVWC956KSS":   { type: "hood-wall-comm",    w: 36, h: 18, d: 22, msrp: 1699, features: "commercial-style, 585 CFM" },
        "KVIB606DSS":   { type: "hood-island",       w: 36, h: 40, d: 22, msrp: 1399, features: "island mount, 600 CFM" },
        "KXD4636YSS":   { type: "downdraft",         w: 36, h: 18, d: 14, msrp: 1649, features: "telescopic, 585 CFM" },
      },

      // ── Dishwashers ──────────────────────────────────────────────────
      dishwashers: {
        "KDTM404KPS":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 1299, features: "PrintShield, 44 dBA, 3rd rack" },
        "KDTM604KPS":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 1549, features: "PrintShield, 44 dBA, FreeFlex" },
        "KDTE204KPS":   { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 1099, features: "PrintShield, 39 dBA, ProWash" },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MIELE
  // ═══════════════════════════════════════════════════════════════════════
  "Miele": {
    tier: "ultra-premium",
    website: "mieleusa.com",
    categories: {

      // ── Refrigeration ────────────────────────────────────────────────
      refrigeration: {
        "K2801Vi":      { type: "column-fridge",     w: 30, h: 84, d: 24, msrp: 7499,  features: "panel-ready, MasterCool, 16.8 cu ft" },
        "K2802Vi":      { type: "column-fridge",     w: 36, h: 84, d: 24, msrp: 8499,  features: "panel-ready, MasterCool, 20.5 cu ft" },
        "K2612Vi":      { type: "column-fridge",     w: 24, h: 84, d: 24, msrp: 5999,  features: "panel-ready, PerfectFresh Pro" },
        "F2812Vi":      { type: "column-freezer",    w: 30, h: 84, d: 24, msrp: 7299,  features: "panel-ready, NoFrost, IceMaker" },
        "F2672Vi":      { type: "column-freezer",    w: 24, h: 84, d: 24, msrp: 5799,  features: "panel-ready, NoFrost" },
        "F2812SF":      { type: "column-freezer",    w: 30, h: 84, d: 24, msrp: 7799,  features: "stainless, NoFrost, IceMaker" },
        "KWT6322UG":    { type: "wine-undercounter",  w: 24, h: 34, d: 24, msrp: 3999,  features: "34-bottle, dual zone, push-to-open" },
        "KWT2612Vi":    { type: "wine-column",       w: 24, h: 84, d: 24, msrp: 5899,  features: "102-bottle, 3 zones, panel-ready" },
      },

      // ── Ranges ───────────────────────────────────────────────────────
      ranges: {
        "HR1724-3DF":   { type: "range-dual-fuel",   w: 30, h: 36, d: 26, fuel: "dual-fuel", msrp: 8499,  features: "4 burners, TwinPower convection" },
        "HR1936-3GDFGD":{ type: "range-dual-fuel",   w: 36, h: 36, d: 26, fuel: "dual-fuel", msrp: 12499, features: "4 burners + griddle, M Touch" },
        "HR1956-3GDFGD":{ type: "range-dual-fuel",   w: 48, h: 36, d: 26, fuel: "dual-fuel", msrp: 17999, features: "6 burners + griddle, dual oven" },
        "HR1954-3GDF":  { type: "range-dual-fuel",   w: 48, h: 36, d: 26, fuel: "dual-fuel", msrp: 16999, features: "8 burners, dual oven" },
      },

      // ── Cooktops ─────────────────────────────────────────────────────
      cooktops: {
        "KM7684FL":     { type: "cooktop-induction",  w: 36, h: 4, d: 21, fuel: "induction", msrp: 4299,  features: "PowerFlex, 5 zones, TempControl" },
        "KM7564FL":     { type: "cooktop-induction",  w: 30, h: 4, d: 21, fuel: "induction", msrp: 3699,  features: "PowerFlex, 4 zones" },
        "KM3054G":      { type: "cooktop-gas",       w: 36, h: 4, d: 21, fuel: "gas",       msrp: 2999,  features: "6 sealed burners, ComfortClean" },
        "KM3034G":      { type: "cooktop-gas",       w: 30, h: 4, d: 21, fuel: "gas",       msrp: 2499,  features: "4 sealed burners" },
        "KMDA7634FL":   { type: "cooktop-induction",  w: 36, h: 8, d: 21, fuel: "induction", msrp: 5999,  features: "TwoInOne with integrated downdraft" },
        // CombiSet modular
        "CS7612FL":     { type: "combiset-induction",  w: 15, h: 4, d: 21, fuel: "induction", msrp: 2199,  features: "modular single-zone" },
        "CS7632FL":     { type: "combiset-tepanyaki",  w: 15, h: 4, d: 21, fuel: "electric",  msrp: 2799,  features: "modular teppanyaki grill" },
      },

      // ── Wall Ovens ───────────────────────────────────────────────────
      ovens: {
        "H7860BP":      { type: "oven-single",       w: 30, h: 24, d: 22, msrp: 5499,  features: "PerfectClean, M Touch, WiFi, 4.6 cu ft" },
        "H7880BP":      { type: "oven-single",       w: 30, h: 24, d: 22, msrp: 6299,  features: "FoodView camera, M Touch, pyrolytic" },
        "H6880BP":      { type: "oven-single",       w: 30, h: 24, d: 22, msrp: 4899,  features: "SoftOpen/Close, moisture plus" },
        "H7880BP2":     { type: "oven-double",       w: 30, h: 48, d: 22, msrp: 10999, features: "dual FoodView, M Touch, pyrolytic" },
        "H6780BP2":     { type: "oven-double",       w: 30, h: 48, d: 22, msrp: 8499,  features: "dual cavity, SoftOpen/Close" },
      },

      // ── Steam Ovens ──────────────────────────────────────────────────
      steam: {
        "DGC7860CTS":   { type: "steam-combi",       w: 24, h: 18, d: 22, msrp: 5299,  features: "combi-steam XXL, 2.51 cu ft, WiFi" },
        "DGC7785CTS":   { type: "steam-combi",       w: 30, h: 18, d: 22, msrp: 5999,  features: "combi-steam XXL, plumbed, WiFi" },
        "DGC7885CTS":   { type: "steam-combi",       w: 30, h: 18, d: 22, msrp: 6599,  features: "combi-steam XXL, FoodView" },
        "DG7000":       { type: "steam-pure",        w: 24, h: 18, d: 22, msrp: 3299,  features: "pure steam, non-plumbed, 1.84 cu ft" },
      },

      // ── Microwaves, Speed Ovens, Coffee, Warming ─────────────────────
      micro_warm: {
        "M7244TC":      { type: "speed-oven",        w: 24, h: 18, d: 22, msrp: 4199,  features: "microwave-combi, M Touch, 1.84 cu ft" },
        "H7670BM":      { type: "speed-oven",        w: 30, h: 18, d: 22, msrp: 4999,  features: "microwave-combi, 30\", FoodView" },
        "CVA7845":      { type: "coffee-machine",    w: 24, h: 18, d: 22, msrp: 5499,  features: "built-in, plumbed, CupSensor, WiFi" },
        "CVA7440":      { type: "coffee-machine",    w: 24, h: 18, d: 22, msrp: 3999,  features: "built-in, DirectSensor, AromaticSystem" },
        "ESW7020":      { type: "warming-drawer",    w: 30, h: 10, d: 22, msrp: 2199,  features: "PerfectClean, 4 settings" },
        "ESW7570":      { type: "warming-drawer",    w: 30, h: 10, d: 22, msrp: 2799,  features: "Gourmet, cup warmer, 4 modes" },
        "EVS7010":      { type: "vacuum-drawer",     w: 24, h: 10, d: 22, msrp: 2699,  features: "vacuum sealing, sous vide prep" },
      },

      // ── Ventilation ──────────────────────────────────────────────────
      ventilation: {
        "DAR1230":      { type: "hood-wall",         w: 36, h: 18, d: 20, msrp: 2499,  features: "stainless, LED, 625 CFM" },
        "DAR1260":      { type: "hood-wall",         w: 48, h: 18, d: 20, msrp: 2999,  features: "stainless, LED, 625 CFM" },
        "DA2628":       { type: "hood-insert",       w: 36, h: 12, d: 20, msrp: 1899,  features: "built-in canopy, 625 CFM" },
        "DA2698":       { type: "hood-insert",       w: 48, h: 12, d: 20, msrp: 2299,  features: "built-in canopy, 625 CFM" },
        "DAD4941":      { type: "downdraft",         w: 36, h: 18, d: 14, msrp: 3499,  features: "telescopic, 600 CFM, LED" },
      },

      // ── Dishwashers ──────────────────────────────────────────────────
      dishwashers: {
        "G7166SCVI":    { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 1699,  features: "AutoDos, panel-ready, 43 dBA" },
        "G7366SCVI":    { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2099,  features: "AutoDos, panel-ready, 40 dBA, FlexLine" },
        "G7566SCVISF":  { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2399,  features: "AutoDos, panel-ready, 38 dBA, Knock2Open" },
        "G7766SCVISF":  { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 2799,  features: "AutoDos, panel-ready, 37 dBA, AutoOpen" },
        "G7916SCVI":    { type: "dishwasher",        w: 24, h: 34, d: 24, msrp: 3199,  features: "AutoDos, panel-ready, 36 dBA, PowerDisk" },
      },
    },
  },
};


// ─── APPLIANCE PACKAGES ─────────────────────────────────────────────────
// Pre-configured suites grouped by brand, tier, and kitchen size.
// Each package specifies model keys from APPLIANCE_BRANDS above.
// The solver picks a package based on the template's applianceBrand +
// sophistication level.  Packages include: refrigeration, cooking,
// ventilation, dishwasher, and optional extras.
// ─────────────────────────────────────────────────────────────────────────

export const APPLIANCE_PACKAGES = {

  // ═══ SUB-ZERO / WOLF / COVE ════════════════════════════════════════════
  "subzero-wolf": {
    brand: "Sub-Zero / Wolf / Cove",
    tier: "ultra-premium",
    packages: {
      // ── Standard (30" range kitchen) ─────────────────────────────────
      "szw-standard-30": {
        name: "Sub-Zero/Wolf Standard 30\"",
        description: "30\" dual-fuel range, 36\" French door, panel-ready Cove DW",
        appliances: {
          refrigerator:  { brand: "Sub-Zero", model: "CL3650UFD/S",  qty: 1 },
          range:         { brand: "Wolf",     model: "DF30450",       qty: 1 },
          hood:          { brand: "Wolf",     model: "PW362210",      qty: 1 },
          dishwasher:    { brand: "Cove",     model: "DW2450",        qty: 1 },
        },
        get totalMSRP() {
          return 14170 + 9180 + 2280 + 2800;
        },
      },
      // ── Premium (36" range kitchen) ──────────────────────────────────
      "szw-premium-36": {
        name: "Sub-Zero/Wolf Premium 36\"",
        description: "36\" dual-fuel range, 42\" French door, Cove DW + warming drawer",
        appliances: {
          refrigerator:  { brand: "Sub-Zero", model: "CL4250UFD/S",  qty: 1 },
          range:         { brand: "Wolf",     model: "DF36650",       qty: 1 },
          hood:          { brand: "Wolf",     model: "PW362418",      qty: 1 },
          dishwasher:    { brand: "Cove",     model: "DW2451",        qty: 1 },
          warming:       { brand: "Wolf",     model: "WWD30",         qty: 1 },
        },
        get totalMSRP() {
          return 15640 + 12940 + 3350 + 2935 + 2650;
        },
      },
      // ── Ultra (48" range, column pair) ───────────────────────────────
      "szw-ultra-48": {
        name: "Sub-Zero/Wolf Ultra 48\"",
        description: "48\" dual-fuel range, 30\" column fridge + 30\" column freezer, steam oven, Cove DW",
        appliances: {
          fridge_column:  { brand: "Sub-Zero", model: "DEC3050RID",   qty: 1 },
          freezer_column: { brand: "Sub-Zero", model: "DEC3050FI",    qty: 1 },
          range:          { brand: "Wolf",     model: "DF48650G",     qty: 1 },
          hood:           { brand: "Wolf",     model: "PW482418",     qty: 1 },
          steam_oven:     { brand: "Wolf",     model: "CSO3050TM",    qty: 1 },
          dishwasher:     { brand: "Cove",     model: "DW2451",       qty: 1 },
          warming:        { brand: "Wolf",     model: "WWD30",        qty: 1 },
        },
        get totalMSRP() {
          return 10335 + 10100 + 18180 + 3850 + 6870 + 2935 + 2650;
        },
      },
      // ── Grand (60" range, 48" fridge) ────────────────────────────────
      "szw-grand-60": {
        name: "Sub-Zero/Wolf Grand 60\"",
        description: "60\" dual-fuel range, 48\" French door, double ovens, steam, speed, 2× Cove DW",
        appliances: {
          refrigerator:   { brand: "Sub-Zero", model: "CL4850UFD/S",  qty: 1 },
          range:          { brand: "Wolf",     model: "DF60650DG",    qty: 1 },
          hood:           { brand: "Wolf",     model: "PW602418",     qty: 1 },
          wall_oven:      { brand: "Wolf",     model: "DO3050PM",     qty: 1 },
          steam_oven:     { brand: "Wolf",     model: "CSO3050TM",    qty: 1 },
          speed_oven:     { brand: "Wolf",     model: "SPO3050PM",    qty: 1 },
          dishwasher:     { brand: "Cove",     model: "DW2451",       qty: 2 },
          warming:        { brand: "Wolf",     model: "WWD30",        qty: 1 },
          wine:           { brand: "Sub-Zero", model: "DEC3050W",     qty: 1 },
        },
        get totalMSRP() {
          return 17025 + 23695 + 4280 + 11060 + 6870 + 5980 + (2935*2) + 2650 + 7800;
        },
      },
      // ── Cooktop + Wall Oven (36" CT) ─────────────────────────────────
      "szw-cooktop-36": {
        name: "Sub-Zero/Wolf Cooktop Suite 36\"",
        description: "36\" induction cooktop, double wall oven, 36\" fridge, Cove DW",
        appliances: {
          refrigerator:  { brand: "Sub-Zero", model: "CL3650UFD/S",  qty: 1 },
          cooktop:       { brand: "Wolf",     model: "CI36560C",      qty: 1 },
          wall_oven:     { brand: "Wolf",     model: "DO3050PM",      qty: 1 },
          hood:          { brand: "Wolf",     model: "PW362418",      qty: 1 },
          dishwasher:    { brand: "Cove",     model: "DW2451",        qty: 1 },
        },
        get totalMSRP() {
          return 14170 + 4150 + 11060 + 3350 + 2935;
        },
      },
    },
  },

  // ═══ THERMADOR ═════════════════════════════════════════════════════════
  "thermador": {
    brand: "Thermador",
    tier: "luxury",
    packages: {
      "thm-harmony-30": {
        name: "Thermador Pro Harmony 30\"",
        description: "30\" dual-fuel Pro Harmony, 36\" built-in fridge, Sapphire DW",
        appliances: {
          refrigerator: { brand: "Thermador", model: "T36IT100NP",   qty: 1 },
          range:        { brand: "Thermador", model: "PRD304WHU",    qty: 1 },
          hood:         { brand: "Thermador", model: "PH36HWS",     qty: 1 },
          dishwasher:   { brand: "Thermador", model: "DWHD660FPR",  qty: 1 },
        },
        get totalMSRP() {
          return 10499 + 6599 + 3299 + 2599;
        },
      },
      "thm-harmony-36": {
        name: "Thermador Pro Harmony 36\"",
        description: "36\" dual-fuel Pro Harmony, 42\" built-in fridge, warming drawer, Star Sapphire DW",
        appliances: {
          refrigerator: { brand: "Thermador", model: "T42IT100NP",   qty: 1 },
          range:        { brand: "Thermador", model: "PRD366WHU",    qty: 1 },
          hood:         { brand: "Thermador", model: "PH36HWS",     qty: 1 },
          dishwasher:   { brand: "Thermador", model: "DWHD870WFP",  qty: 1 },
          warming:      { brand: "Thermador", model: "WD30W",       qty: 1 },
        },
        get totalMSRP() {
          return 12499 + 9499 + 3299 + 2799 + 2399;
        },
      },
      "thm-grand-48": {
        name: "Thermador Pro Grand 48\"",
        description: "48\" Pro Grand dual-fuel, 48\" built-in fridge, triple oven, coffee machine, 2× DW",
        appliances: {
          refrigerator: { brand: "Thermador", model: "T48IT100NP",   qty: 1 },
          range:        { brand: "Thermador", model: "PRD486WDGU",   qty: 1 },
          hood:         { brand: "Thermador", model: "PH48HWS",     qty: 1 },
          wall_oven:    { brand: "Thermador", model: "PODMCW31W",   qty: 1 },
          coffee:       { brand: "Thermador", model: "TCM24PS",     qty: 1 },
          dishwasher:   { brand: "Thermador", model: "DWHD870WFP",  qty: 2 },
          warming:      { brand: "Thermador", model: "WD30W",       qty: 1 },
        },
        get totalMSRP() {
          return 14499 + 16999 + 3799 + 12999 + 4729 + (2799*2) + 2399;
        },
      },
      "thm-induction-36": {
        name: "Thermador Induction 36\"",
        description: "36\" Heritage induction cooktop, double steam oven, 36\" column fridge + 18\" freezer",
        appliances: {
          fridge_column: { brand: "Thermador", model: "T36IR905SP",  qty: 1 },
          freezer_column:{ brand: "Thermador", model: "T18IF905SP",  qty: 1 },
          cooktop:       { brand: "Thermador", model: "CIT36YWB",    qty: 1 },
          wall_oven:     { brand: "Thermador", model: "MEDS302WS",   qty: 1 },
          hood:          { brand: "Thermador", model: "HMWB36WS",    qty: 1 },
          dishwasher:    { brand: "Thermador", model: "DWHD870WFP",  qty: 1 },
        },
        get totalMSRP() {
          return 9099 + 4699 + 6599 + 9299 + 2499 + 2799;
        },
      },
      "thm-grand-60": {
        name: "Thermador Pro Grand 60\"",
        description: "60\" Pro Grand dual-fuel, 48\" built-in fridge, coffee, wine, 2× Star Sapphire DW",
        appliances: {
          refrigerator: { brand: "Thermador", model: "T48IT100NP",   qty: 1 },
          range:        { brand: "Thermador", model: "PRD606WESG",   qty: 1 },
          hood:         { brand: "Thermador", model: "PH48HWS",     qty: 1 },
          coffee:       { brand: "Thermador", model: "TCM24PS",     qty: 1 },
          wine:         { brand: "Thermador", model: "T24UW905LP",  qty: 1 },
          dishwasher:   { brand: "Thermador", model: "DWHD870WFP",  qty: 2 },
          warming:      { brand: "Thermador", model: "WD30W",       qty: 1 },
        },
        get totalMSRP() {
          return 14499 + 24699 + 3799 + 4729 + 3949 + (2799*2) + 2399;
        },
      },
    },
  },

  // ═══ FISHER & PAYKEL ═══════════════════════════════════════════════════
  "fisher-paykel": {
    brand: "Fisher & Paykel",
    tier: "premium",
    packages: {
      "fp-series7-30": {
        name: "Fisher & Paykel Series 7 — 30\"",
        description: "30\" gas range, French door fridge, double DishDrawer",
        appliances: {
          refrigerator: { brand: "Fisher & Paykel", model: "RF201ADX5N",    qty: 1 },
          range:        { brand: "Fisher & Paykel", model: "OR30SCG4X1",    qty: 1 },
          hood:         { brand: "Fisher & Paykel", model: "HC36DTXB2",     qty: 1 },
          dishwasher:   { brand: "Fisher & Paykel", model: "DD24DAX9-N",    qty: 1 },
        },
        get totalMSRP() {
          return 3749 + 4299 + 1899 + 2299;
        },
      },
      "fp-series9-36": {
        name: "Fisher & Paykel Series 9 — 36\"",
        description: "36\" induction range, 36\" built-in fridge, speed oven, tall DishDrawer",
        appliances: {
          refrigerator: { brand: "Fisher & Paykel", model: "RS36A72J1-N",   qty: 1 },
          range:        { brand: "Fisher & Paykel", model: "OR36SDI6X1",    qty: 1 },
          hood:         { brand: "Fisher & Paykel", model: "HC36DTXB2",     qty: 1 },
          speed_oven:   { brand: "Fisher & Paykel", model: "OM30NDTDX1",   qty: 1 },
          dishwasher:   { brand: "Fisher & Paykel", model: "DD24DCTX9-N",  qty: 1 },
          warming:      { brand: "Fisher & Paykel", model: "WD24D",        qty: 1 },
        },
        get totalMSRP() {
          return 5850 + 8399 + 1899 + 3499 + 2699 + 2499;
        },
      },
      "fp-series11-48": {
        name: "Fisher & Paykel Series 11 — 48\"",
        description: "48\" pro induction range, 36\" built-in panel-ready fridge, CoolDrawer, premium DishDrawer",
        appliances: {
          refrigerator: { brand: "Fisher & Paykel", model: "RS3684WRUVE1",  qty: 1 },
          range:        { brand: "Fisher & Paykel", model: "RIV3-486",      qty: 1 },
          hood:         { brand: "Fisher & Paykel", model: "HC48DTXB2",     qty: 1 },
          cool_drawer:  { brand: "Fisher & Paykel", model: "RB36S25MKIWN1",qty: 1 },
          speed_oven:   { brand: "Fisher & Paykel", model: "OM30NDTDX1",   qty: 1 },
          dishwasher:   { brand: "Fisher & Paykel", model: "DD24DTX6HI1",  qty: 1 },
          warming:      { brand: "Fisher & Paykel", model: "WD24D",        qty: 1 },
        },
        get totalMSRP() {
          return 10500 + 16849 + 2299 + 4899 + 3499 + 3299 + 2499;
        },
      },
      "fp-hybrid-48": {
        name: "Fisher & Paykel Hybrid 48\"",
        description: "48\" hybrid gas+induction range, columns, speed oven, premium DishDrawer",
        appliances: {
          refrigerator: { brand: "Fisher & Paykel", model: "RS3684WRUVE1",  qty: 1 },
          range:        { brand: "Fisher & Paykel", model: "RHV3-484-N",    qty: 1 },
          hood:         { brand: "Fisher & Paykel", model: "HC48DTXB2",     qty: 1 },
          speed_oven:   { brand: "Fisher & Paykel", model: "OM30NDTDX1",   qty: 1 },
          dishwasher:   { brand: "Fisher & Paykel", model: "DD24DTX6PX1",  qty: 1 },
        },
        get totalMSRP() {
          return 10500 + 17149 + 2299 + 3499 + 2899;
        },
      },
    },
  },

  // ═══ KITCHENAID ════════════════════════════════════════════════════════
  "kitchenaid": {
    brand: "KitchenAid",
    tier: "premium",
    packages: {
      "ka-essential-30": {
        name: "KitchenAid Essential 30\"",
        description: "30\" gas range, counter-depth French door fridge, dishwasher",
        appliances: {
          refrigerator: { brand: "KitchenAid", model: "KRFC704FPS",   qty: 1 },
          range:        { brand: "KitchenAid", model: "KFGC500JSS",   qty: 1 },
          hood:         { brand: "KitchenAid", model: "KVWB406DSS",   qty: 1 },
          dishwasher:   { brand: "KitchenAid", model: "KDTE204KPS",   qty: 1 },
        },
        get totalMSRP() {
          return 3699 + 3499 + 1099 + 1099;
        },
      },
      "ka-professional-36": {
        name: "KitchenAid Professional 36\"",
        description: "36\" dual-fuel range, 36\" built-in French door fridge, warming drawer",
        appliances: {
          refrigerator: { brand: "KitchenAid", model: "KBFN506ESS",   qty: 1 },
          range:        { brand: "KitchenAid", model: "KFDC506JSS",   qty: 1 },
          hood:         { brand: "KitchenAid", model: "KVWC956KSS",   qty: 1 },
          dishwasher:   { brand: "KitchenAid", model: "KDTM604KPS",   qty: 1 },
          warming:      { brand: "KitchenAid", model: "KOWT100ESS",   qty: 1 },
        },
        get totalMSRP() {
          return 10599 + 5299 + 1699 + 1549 + 1349;
        },
      },
      "ka-chef-48": {
        name: "KitchenAid Chef 48\"",
        description: "48\" dual-fuel range, 48\" built-in SxS fridge, double oven, microwave",
        appliances: {
          refrigerator: { brand: "KitchenAid", model: "KBSD708MPS",   qty: 1 },
          range:        { brand: "KitchenAid", model: "KFDC558JSS",   qty: 1 },
          hood:         { brand: "KitchenAid", model: "KVWC956KSS",   qty: 1 },
          wall_oven:    { brand: "KitchenAid", model: "KODE900HSS",   qty: 1 },
          microwave:    { brand: "KitchenAid", model: "KMBP100ESS",   qty: 1 },
          dishwasher:   { brand: "KitchenAid", model: "KDTM604KPS",   qty: 2 },
          warming:      { brand: "KitchenAid", model: "KOWT100ESS",   qty: 1 },
        },
        get totalMSRP() {
          return 11000 + 8999 + 1699 + 5699 + 1599 + (1549*2) + 1349;
        },
      },
      "ka-cooktop-36": {
        name: "KitchenAid Cooktop Suite 36\"",
        description: "36\" induction cooktop, oven+microwave combo, 42\" built-in fridge",
        appliances: {
          refrigerator: { brand: "KitchenAid", model: "KBFN502ESS",   qty: 1 },
          cooktop:      { brand: "KitchenAid", model: "KICU569XSS",   qty: 1 },
          wall_oven:    { brand: "KitchenAid", model: "KOCE500ESS",   qty: 1 },
          hood:         { brand: "KitchenAid", model: "KVWC956KSS",   qty: 1 },
          dishwasher:   { brand: "KitchenAid", model: "KDTM404KPS",   qty: 1 },
        },
        get totalMSRP() {
          return 10500 + 2499 + 3899 + 1699 + 1299;
        },
      },
    },
  },

  // ═══ MIELE ═════════════════════════════════════════════════════════════
  "miele": {
    brand: "Miele",
    tier: "ultra-premium",
    packages: {
      "miele-classic-30": {
        name: "Miele Classic 30\"",
        description: "30\" dual-fuel range, 24\" column fridge + 24\" column freezer, dishwasher",
        appliances: {
          fridge_column: { brand: "Miele", model: "K2612Vi",       qty: 1 },
          freezer_column:{ brand: "Miele", model: "F2672Vi",       qty: 1 },
          range:         { brand: "Miele", model: "HR1724-3DF",    qty: 1 },
          hood:          { brand: "Miele", model: "DA2628",        qty: 1 },
          dishwasher:    { brand: "Miele", model: "G7366SCVI",     qty: 1 },
        },
        get totalMSRP() {
          return 5999 + 5799 + 8499 + 1899 + 2099;
        },
      },
      "miele-gourmet-36": {
        name: "Miele Gourmet 36\"",
        description: "36\" dual-fuel range, 30\" column fridge + 30\" freezer, combi-steam, coffee",
        appliances: {
          fridge_column: { brand: "Miele", model: "K2801Vi",         qty: 1 },
          freezer_column:{ brand: "Miele", model: "F2812Vi",         qty: 1 },
          range:         { brand: "Miele", model: "HR1936-3GDFGD",   qty: 1 },
          hood:          { brand: "Miele", model: "DAR1230",         qty: 1 },
          steam_oven:    { brand: "Miele", model: "DGC7860CTS",      qty: 1 },
          coffee:        { brand: "Miele", model: "CVA7440",         qty: 1 },
          dishwasher:    { brand: "Miele", model: "G7566SCVISF",     qty: 1 },
          warming:       { brand: "Miele", model: "ESW7020",         qty: 1 },
        },
        get totalMSRP() {
          return 7499 + 7299 + 12499 + 2499 + 5299 + 3999 + 2399 + 2199;
        },
      },
      "miele-chef-48": {
        name: "Miele Chef 48\"",
        description: "48\" dual-fuel range, 36\" column fridge + 30\" freezer, combi-steam, speed oven, coffee, vacuum, 2× DW",
        appliances: {
          fridge_column:  { brand: "Miele", model: "K2802Vi",         qty: 1 },
          freezer_column: { brand: "Miele", model: "F2812Vi",         qty: 1 },
          range:          { brand: "Miele", model: "HR1956-3GDFGD",   qty: 1 },
          hood:           { brand: "Miele", model: "DAR1260",         qty: 1 },
          steam_oven:     { brand: "Miele", model: "DGC7885CTS",      qty: 1 },
          speed_oven:     { brand: "Miele", model: "H7670BM",         qty: 1 },
          coffee:         { brand: "Miele", model: "CVA7845",         qty: 1 },
          vacuum:         { brand: "Miele", model: "EVS7010",         qty: 1 },
          dishwasher:     { brand: "Miele", model: "G7766SCVISF",     qty: 2 },
          warming:        { brand: "Miele", model: "ESW7570",         qty: 1 },
        },
        get totalMSRP() {
          return 8499 + 7299 + 17999 + 2999 + 6599 + 4999 + 5499 + 2699 + (2799*2) + 2799;
        },
      },
      "miele-induction-36": {
        name: "Miele Induction 36\"",
        description: "36\" induction with downdraft, double wall oven, 30\" column fridge, pure steam, coffee",
        appliances: {
          fridge_column: { brand: "Miele", model: "K2801Vi",          qty: 1 },
          freezer_column:{ brand: "Miele", model: "F2812Vi",          qty: 1 },
          cooktop:       { brand: "Miele", model: "KMDA7634FL",       qty: 1 },
          wall_oven:     { brand: "Miele", model: "H7880BP2",         qty: 1 },
          steam_oven:    { brand: "Miele", model: "DG7000",           qty: 1 },
          coffee:        { brand: "Miele", model: "CVA7440",          qty: 1 },
          dishwasher:    { brand: "Miele", model: "G7566SCVISF",      qty: 1 },
          warming:       { brand: "Miele", model: "ESW7020",          qty: 1 },
        },
        get totalMSRP() {
          return 7499 + 7299 + 5999 + 10999 + 3299 + 3999 + 2399 + 2199;
        },
      },
      "miele-wine-entertaining": {
        name: "Miele Wine & Entertaining",
        description: "36\" induction cooktop, single oven, 30\" fridge column, wine column, gourmet warming drawer",
        appliances: {
          fridge_column: { brand: "Miele", model: "K2801Vi",          qty: 1 },
          wine_column:   { brand: "Miele", model: "KWT2612Vi",       qty: 1 },
          cooktop:       { brand: "Miele", model: "KM7684FL",        qty: 1 },
          wall_oven:     { brand: "Miele", model: "H7860BP",         qty: 1 },
          steam_oven:    { brand: "Miele", model: "DGC7860CTS",      qty: 1 },
          coffee:        { brand: "Miele", model: "CVA7845",         qty: 1 },
          hood:          { brand: "Miele", model: "DAR1230",         qty: 1 },
          dishwasher:    { brand: "Miele", model: "G7766SCVISF",     qty: 1 },
          warming:       { brand: "Miele", model: "ESW7570",         qty: 1 },
        },
        get totalMSRP() {
          return 7499 + 5899 + 4299 + 5499 + 5299 + 5499 + 2499 + 2799 + 2799;
        },
      },
    },
  },
};


/**
 * Look up an appliance by brand and model number.
 * @param {string} brandName - Brand key in APPLIANCE_BRANDS
 * @param {string} model - Model number
 * @returns {Object|null} Appliance data or null
 */
export function lookupAppliance(brandName, model) {
  const brand = APPLIANCE_BRANDS[brandName];
  if (!brand) return null;
  for (const cat of Object.values(brand.categories)) {
    if (cat[model]) return { brand: brandName, model, ...cat[model] };
  }
  return null;
}

/**
 * Calculate total MSRP for an appliance package.
 * @param {string} packageId - Package key (e.g. "szw-ultra-48")
 * @returns {Object} { packageName, totalMSRP, appliances[] }
 */
export function priceAppliancePackage(packageId) {
  for (const group of Object.values(APPLIANCE_PACKAGES)) {
    const pkg = group.packages[packageId];
    if (!pkg) continue;
    const items = [];
    let total = 0;
    for (const [role, spec] of Object.entries(pkg.appliances)) {
      const appliance = lookupAppliance(spec.brand, spec.model);
      const lineTotal = appliance ? appliance.msrp * spec.qty : 0;
      items.push({ role, ...spec, unitMSRP: appliance?.msrp || 0, lineTotal });
      total += lineTotal;
    }
    return { packageId, packageName: pkg.name, description: pkg.description, items, totalMSRP: total };
  }
  return null;
}


// ─── PRICING CALCULATOR ──────────────────────────────────────────────────

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

  // Species upcharge (White Oak is baseline at 0%)
  const speciesKey = item.species || "White Oak";
  const speciesData = SPECIES_UPCHARGE[speciesKey] || SPECIES_UPCHARGE["White Oak"];
  const speciesMultiplier = 1 + (speciesData.pct / 100);

  // Construction upcharge
  const constructionKey = item.construction || "Standard";
  const constructionData = CONSTRUCTION_UPCHARGE[constructionKey] || CONSTRUCTION_UPCHARGE["Standard"];
  const constructionMultiplier = 1 + (constructionData.pct / 100);

  // Base cabinet price: stockBase × (1 + speciesPct/100)
  // Then plywood applied to total: prePly × (1 + constructionPct/100)
  // Source: Eclipse Estimator cp() function
  const stockBase = listPrice * speciesMultiplier;

  // Door group charge: A=$0, B=$44, C=$88, D=$150 per door
  const doorStyleKey = item.doorStyle || "HNVR";
  const doorData = DOOR_STYLE_CHARGE[doorStyleKey] || { groupRate: 0 };
  const numDoors = item.numDoors || 0;
  const doorGroupCharge = doorData.groupRate * numDoors;
  const doorExtraCharge = (doorData.extra || 0) * numDoors;

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

  // prePly = stockBase + doorChg + dfChg + dbChg + rbsChg
  // unitPrice = prePly × (1 + constructionPct/100)
  const prePly = stockBase + doorGroupCharge + doorExtraCharge + drawerCharge + guideCharge + modCharge;
  const totalPrice = prePly * constructionMultiplier;

  return {
    listPrice,
    speciesUpcharge: speciesData.pct,
    constructionUpcharge: constructionData.pct,
    stockBase: round2(stockBase),
    doorGroupCharge: round2(doorGroupCharge),
    doorExtraCharge: round2(doorExtraCharge),
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
      ? `${modifiedCabs} of ${totalCabs} cabs (${Math.round(widthModPct * 100)}%) width-modified — ${extraModCabs} cabs will incur ${MOD_PRICING.widthMod.upchargePercent}% upcharge.`
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
    budget:   350,   // TFL/HPL — Bennet $4.7K/10 cabs, LWH $4.6K/6 cabs
    standard: 550,   // Maple/Poplar — Lofton $19K/22 cabs, DeLawyer $19K/19 cabs
    premium:  700,   // White Oak/Cherry — McCarter $26K/28 cabs, Kamisar $41K/32 cabs
    ultra:    850,   // Walnut/Rift Cut — Bollini $54K/39 cabs, Bissegger $79K/47 cabs
  };

  // Determine tier from species if not provided
  const speciesData = SPECIES_UPCHARGE[species] || SPECIES_UPCHARGE["White Oak"];
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
    note: `Based on ${cabinetCount} cabs × ~$${round2(perCabEstimate)}/cab (${species}, ${construction}).`,
  };
}


// ─── HELPERS ─────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}
