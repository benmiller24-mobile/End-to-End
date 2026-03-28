/**
 * Eclipse Kitchen Designer — Constraint Engine
 * ==============================================
 * NKBA guidelines + Eclipse catalog rules codified as deterministic constraints.
 * These are enforced DURING layout generation (Layer 1).
 *
 * Sources:
 *   - NKBA Kitchen Planning Guidelines (31 rules)
 *   - Eclipse v8.8.0 catalog physical specs (cabinetKnowledgeBase.json)
 *   - 30 training projects across kitchens, offices, laundry, bathrooms, and utility rooms
 *
 * Catalogs represented:
 *   ECL8_8A_1, ECL8_8B_1, ECL8_8D_1, ECL8_6A_1, ECL8_6B_1,
 *   ECL8_4A_1, ECL8_4B_1, ECL24_1, ECL24A_1, ECL24B_1, ECL24-C_1
 */

// ─── ROOM TYPES ────────────────────────────────────────────────────────────
// Eclipse cabinets serve multiple room types beyond kitchens

export const ROOM_TYPES = {
  kitchen: {
    appliancesRequired: true,
    workTriangleApplies: true,
    nkbaLandingApplies: true,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 24,
    note: "Standard kitchen — NKBA rules enforced. 23 of 30 training projects.",
  },
  office: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 30.5,  // desk height (vanity height)
    defaultBaseDepth: 24,
    specialCabinets: ["FD2HD", "VB3D", "LD36"],
    trainingOccurrences: ["Bissegger Office (FD2HD21 + VB3D18 + LD36 desk config)"],
    note: "Home office built-ins with file drawers, vanity-height pedestals, and lap drawers.",
  },
  laundry: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 24,
    specialCabinets: ["UT", "BBC"],
    trainingOccurrences: ["LWH Hartley Laundry (BBC48R + B3D18 + UT2196L)"],
    note: "Laundry rooms — utility tall for storage, blind corners for L-shapes.",
  },
  master_bath: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 21,     // floating vanity height
    defaultBaseDepth: 21,
    specialCabinets: ["FLVSB", "BC3341", "PLWT-SQUARE"],
    trainingOccurrences: ["McCarter Master Bath (2× FLVSB4221 floating vanities + BC3341 columns)"],
    note: "Master bathroom floating vanities with custom columns and finished tops.",
  },
  vanity: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 36,     // vanity tall height
    defaultBaseDepth: 21.75,
    specialCabinets: ["UV1896", "VTSB", "VTSB3D"],
    trainingOccurrences: ["Cost Plus Vanity (UV1896L/R towers + VTSB36/VTSB3D36 sink bases)"],
    note: "Single-wall bathroom vanity ensembles with tall utility towers and sink bases.",
  },
  utility: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 24,
    specialCabinets: ["UT", "W"],
    trainingOccurrences: ["Bennet Utility (2× UT3387 + 2× W3318 stacked towers)"],
    note: "Utility/storage towers — pure door/shelf storage, no drawers needed.",
  },
  showroom: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 24,
    note: "Showroom display kitchens — showcase configurations.",
    trainingOccurrences: ["Showroom ECLA", "Showroom ECLD"],
  },
  great_room: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 24,
    specialCabinets: ["WGPD", "FLS", "BCF", "REF"],
    trainingOccurrences: ["Bissegger Great Room (4-zone: kitchen + great room + bar + nook)"],
    note: "Multi-zone great room with display, bar, and built-in nook areas.",
  },
  bar: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 21,
    specialCabinets: ["BCF", "FLS", "BBC-S"],
    trainingOccurrences: ["Bissegger Great Room bar zone (21\" depth, Malibu Reeded Panel {B})"],
    note: "Bar/entertaining zone — shallow 21\" depth for service counter, accent materials.",
  },
};


// ─── DIMENSIONAL CONSTANTS ───────────────────────────────────────────────────

export const DIMS = {
  // Kitchen base dimensions
  baseHeight: 34.5,
  baseDepth: 24,
  upperDepth: 13,
  toeKickHeight: 4.5,
  counterThickness: 1.5,
  counterHeight: 36,       // baseHeight + counterThickness
  backsplashHeight: 18,
  upperBottom: 54,          // counter(36) + backsplash(18)
  standardCeiling: 96,
  fillerWidths: [3, 6],
  overlayFillerWidth: 3,

  // Vanity dimensions (from McCarter, Cost Plus training)
  vanityHeight: 30.5,         // standard vanity base height
  vanityTallHeight: 36,       // vanity tall sink base height (Cost Plus VTSB36)
  floatingVanityHeight: 21,   // floating vanity height (McCarter FLVSB4221)
  vanityDepth: 21,            // standard vanity depth
  vanityDepthTall: 21.75,     // vanity tall depth (Cost Plus)

  // Office dimensions (from Bissegger training)
  deskHeight: 30.5,           // desk pedestal height (vanity height)
  lapDrawerHeight: 6,         // LD36 keyboard/pencil tray

  // Peninsula dimensions (from Showroom ECLD, Owen)
  peninsulaColumnDepth: 36,   // PBC column depth (Showroom ECLD PBC3341/2-36|36)
};

// Standard Eclipse cabinet widths (inches)
export const STD_BASE_WIDTHS = [9, 12, 15, 18, 21, 22.5, 24, 27, 30, 33, 36, 39, 42];
export const STD_UPPER_WIDTHS = [9, 12, 15, 18, 21, 22.5, 24, 27, 30, 33, 36, 39, 42];
export const STD_UPPER_HEIGHTS = [12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 60];
export const STD_TALL_HEIGHTS = [84, 87, 90, 93, 96, 102, 105, 108, 114, 117, 118];
export const STD_VANITY_WIDTHS = [18, 21, 24, 27, 30, 33, 36, 42, 48];


// ─── CABINET TYPE REGISTRY ──────────────────────────────────────────────────
// All cabinet types discovered across 30 training projects

export const CABINET_TYPES = {
  // ── Standard base cabinets ──
  B:      { category: "base", description: "Standard base cabinet (door)", depths: [24], heights: [34.5] },
  "B-2D": { category: "base", description: "Base cabinet with 2 doors", depths: [24], heights: [34.5] },
  "B-FHD":{ category: "base", description: "Base full-height door", depths: [18, 24], heights: [34.5] },
  "B-RT": { category: "base", description: "Base with roll-out trays", depths: [24], heights: [34.5] },
  B3D:    { category: "base", description: "3-drawer base", depths: [24], heights: [34.5] },
  B4D:    { category: "base", description: "4-drawer base", depths: [24], heights: [34.5] },
  B2HD:   { category: "base", description: "2-drawer base with heavy-duty guides", depths: [24], heights: [34.5], trainingOccurrences: ["Firebird (B2HD36)"] },
  BTD:    { category: "base", description: "Base with chrome tray divider", depths: [24], heights: [34.5], widths: [9, 12], trainingOccurrences: ["Huang (BTD-12)", "Bollini (BTD-9)", "Kamisar (BTD-12)"] },

  // ── Specialty base cabinets ──
  SB:     { category: "base", description: "Sink base", depths: [24], heights: [34.5] },
  SBA:    { category: "base", description: "Sink base apron (farmhouse)", depths: [24], heights: [34.5], widths: [36], trainingOccurrences: ["Gable (SBA36)", "Bissegger Great Room (SBA36)"] },
  "SB-FHD":{ category: "base", description: "Sink base full-height door", depths: [24], heights: [34.5], trainingOccurrences: ["Huang (SB33-FHD)", "Bollini (SB36-FHD)"] },
  DSB:    { category: "base", description: "Diagonal sink base", depths: [24], heights: [34.5], trainingOccurrences: ["Kamisar (DSB42-2D — first diagonal sink base)"] },
  RTB:    { category: "base", description: "Range top base", depths: [24], heights: [28.5], widths: [36], trainingOccurrences: ["Kamisar (RTB36)"] },
  BPOS:   { category: "base", description: "Base pull-out shelf (4-tier)", widths: [9, 12, 15], depths: [24], heights: [34.5] },
  BKI:    { category: "base", description: "Base with knife insert", widths: [9], depths: [24], trainingOccurrences: ["Bollini (BKI-9 — first knife insert)"] },
  BWDMA:  { category: "base", description: "Waste cabinet door-mounted aluminum", widths: [18, 21], depths: [24] },
  BWDMW:  { category: "base", description: "Waste cabinet door-mounted wood", widths: [18], depths: [24] },
  BWDMB:  { category: "base", description: "Waste cabinet door-mounted (base)", widths: [18], trainingOccurrences: ["McCarter Parade (BWDMB18)", "Bollini (BWDMB18)", "Bissegger (BWDMB18-FHD)"] },
  BWS:    { category: "base", description: "Base wine shelf", depths: [24], trainingOccurrences: ["McComb (BWS24)"] },
  BO:     { category: "base", description: "Base oven", depths: [24], trainingOccurrences: ["Showroom ECLD (BO27)"] },
  BCF:    { category: "base", description: "Beverage center front (built-in cooler)", widths: [24], heights: [30], trainingOccurrences: ["Bissegger Great Room (BCF|24W|30H ×2)"] },
  BPTPO:  { category: "base", description: "Base paper towel pullout", widths: [12], trainingOccurrences: ["Bissegger Great Room (BPTPO12 — first in training)"] },
  BUBO:   { category: "base", description: "Base utensil bin organizer", widths: [12], trainingOccurrences: ["Bissegger Great Room (BUBO12)", "McComb (BUBO12)"] },
  TB:     { category: "base", description: "Tray base", widths: [9, 12], trainingOccurrences: ["Owen (TB9L)", "McComb (TB12L)"] },

  // ── Corner cabinets ──
  BL:     { category: "corner", description: "Base lazy susan", sizes: [33, 36] },
  BBC:    { category: "corner", description: "Base blind corner", widths: [36, 39, 42, 45, 48] },
  "BBC-WS":{ category: "corner", description: "Base blind corner with wire shelf", widths: [45], trainingOccurrences: ["Huang (BBC45R-WS, BBC45L-WS)", "Firebird (BBC48R)"] },
  "BBC-MC":{ category: "corner", description: "Base blind corner with magic corner (chrome wire)", widths: [48], trainingOccurrences: ["Bollini (BBC48R-MC $3,938 — highest-price corner)", "Artistic (BBC48L-MC)"] },
  "BBC-S": { category: "corner", description: "Base blind corner with quarter-turn shelves", widths: [42], trainingOccurrences: ["Bissegger Great Room bar (BBC42R-S)"] },
  BHM:    { category: "corner", description: "Base half-moon corner with stainless steel shelves", sizes: [36, 42] },
  BDL:    { category: "corner", description: "Base diagonal lazy susan", sizes: [36] },
  WSC:    { category: "corner_upper", description: "Wall square corner", widths: [24], trainingOccurrences: ["Sabelhaus (WSC2436-PHL, WSC2436-PHR)", "Diehl (WSC2439-PHL)"] },
  SWSC:   { category: "stacked_corner", description: "Stacked wall square corner with bi-fold hinge", widths: [24], heights: [63], trainingOccurrences: ["Bollini (SWSC2463(21)R — first stacked corner)"] },

  // ── File/Office cabinets ──
  FD2HD:  { category: "office", description: "2-file drawer with heavy-duty guides", widths: [21], heights: [30.5], trainingOccurrences: ["Bissegger Office (FD2HD21)"] },
  LD:     { category: "office", description: "Lap drawer (keyboard/pencil tray)", widths: [36], heights: [6], trainingOccurrences: ["Bissegger Office (LD36)"] },
  VB3D:   { category: "office", description: "Vanity 3-drawer base (desk pedestal)", widths: [18], heights: [30.5], trainingOccurrences: ["Bissegger Office (VB3D18)"] },

  // ── Vanity/Bathroom cabinets ──
  FLVSB:  { category: "vanity", description: "Floating vanity sink base (wall-mounted)", heights: [21], depths: [21], trainingOccurrences: ["McCarter Master Bath (FLVSB4221)"] },
  VTSB:   { category: "vanity", description: "Vanity tall sink base", heights: [36], depths: [21.75], trainingOccurrences: ["Cost Plus (VTSB36)"] },
  VTSB3D: { category: "vanity", description: "Vanity tall 3-drawer sink base", heights: [36], depths: [21.75], trainingOccurrences: ["Cost Plus (VTSB3D36)"] },
  UV:     { category: "vanity", description: "Utility vanity (tall)", heights: [96], depths: [21.75], widths: [18], trainingOccurrences: ["Cost Plus (UV1896L/R)"] },

  // ── Wall cabinets ──
  W:      { category: "wall", description: "Standard wall cabinet", depths: [12, 13] },
  WND:    { category: "wall", description: "Wall no-door cabinet (open)", trainingOccurrences: ["Showroom ECLD (WND2112)", "McComb (WND2439)"] },
  WGD:    { category: "wall", description: "Wall cabinet with appliance garage doors", heights: [54], depths: [18], trainingOccurrences: ["Dolfin Isle (WGD2454)"] },
  WPD:    { category: "wall", description: "Wall pocket door cabinet", trainingOccurrences: ["Kamisar (WPD3657|18 — first pocket door wall cab)"] },
  WGPD:   { category: "wall", description: "Wall garage with pocket doors", heights: [72], depths: [16], trainingOccurrences: ["Bissegger Great Room (WGPD4272|16 ×2 with contour arch doors)"] },
  WS:     { category: "wall", description: "Wall shelf (decorative)", depths: [13], trainingOccurrences: ["Bissegger Great Room (WS5560 mod to 35\"W)"] },
  "W1DR": { category: "wall", description: "Wall cabinet with 1 drawer (mod)", trainingOccurrences: ["Dolfin Isle (W1DR2454-2D)"] },
  RW:     { category: "wall", description: "Refrigerator wall cabinet (above fridge)" },
  RH21:   { category: "wall", description: "Range hood 21\" model", trainingOccurrences: ["Multiple projects"] },
  RH50:   { category: "wall", description: "Range hood 50\" model (large)", trainingOccurrences: ["Showroom ECLD (RH50 424224)"] },

  // ── Stacked wall cabinets ──
  SW:     { category: "stacked_wall", description: "Stacked wall cabinet", heights: [51, 60, 63], depths: [13, 15], trainingOccurrences: ["McCarter Parade (SW3060(15) ×3)", "Firebird (SW1551, SW3351)", "Bollini (SW3363(21) ×4 + SW16.563(21) — most extensive glass display)"] },
  SA:     { category: "stacked_wall", description: "Stacked wall angle cabinet", heights: [51], trainingOccurrences: ["Firebird (SA2451)"] },

  // ── Tall cabinets ──
  UT:     { category: "tall", description: "Utility tall", depths: [18, 21, 24, 27], heights: [84, 87, 90, 93, 96] },
  U:      { category: "tall", description: "Utility standard", depths: [24, 27] },
  U3D:    { category: "tall", description: "Utility 3-drawer", depths: [27] },
  O:      { category: "tall", description: "Oven tower", heights: [84, 93, 96, 105] },
  OM:     { category: "tall", description: "Oven/microwave tower", heights: [93, 96], trainingOccurrences: ["Firebird (OM3096)", "McComb (OM3093)"] },
  FIO:    { category: "tall", description: "Flush inset oven cabinet", heights: [90, 93], depths: [21, 27], trainingOccurrences: ["JRS (FIBO27 — flush inset base oven)", "Owen (FIO2790 with Miele sub-frame)", "Kamisar (FIO3393-27)"] },

  // ── Peninsula cabinets ──
  PBC:    { category: "peninsula", description: "Peninsula base column", depths: [36], heights: [34.5], trainingOccurrences: ["Showroom ECLD (PBC3341/2-36)"] },
  BC:     { category: "peninsula", description: "Base column (island/peninsula)", trainingOccurrences: ["McCarter Parade (BC3341/2-27)", "McCarter Master Bath (BC3341/2-27|23)"] },

  // ── Panels & Accessories ──
  REP:    { category: "panel", description: "Refrigerator end panel" },
  FREP:   { category: "panel", description: "Full-depth refrigerator end panel" },
  FBEP:   { category: "panel", description: "Base flush end panel with flush toe kick" },
  FWEP:   { category: "panel", description: "Wall flush end panel" },
  BEP:    { category: "panel", description: "Base end panel", variants: ["BEP1.5", "BEP3"] },
  EDGTL:  { category: "panel", description: "Edge-banded panel large (3 edges, waterfall)" },
  EDGTS:  { category: "panel", description: "Edge-banded panel small horizontal" },
  EDGT:   { category: "panel", description: "Edge-banded panel countertop/shelf edge" },
  FPS:    { category: "panel", description: "Finish panel small (vertical)" },
  "BB-CMP":{ category: "panel", description: "Component bar back", trainingOccurrences: ["Dolfin Isle (BB1/2-CMP)"] },
  FLS:    { category: "shelf", description: "Floating shelf", depths: [8, 13], heights: [3], trainingOccurrences: ["Dolfin Isle (FLS|21|3|13)", "Firebird (FLS|17|3|13, FLS|24|3|13)", "Bissegger (FLS|80.75|3|13 ×3 widest, FLS|84|3|8 bar, FLS|53.75|3|13 kitchen)"] },
  REF:    { category: "panel", description: "Large RF wall door panel (appliance panel)", trainingOccurrences: ["Bissegger Great Room (REF 35.5625×79.875 at $3,550.69 each)"] },
  "BB-HTFD":{ category: "panel", description: "Hartford bar back panel", trainingOccurrences: ["Bollini (BBHTFD 52.5×34.5 ×2 + 30.125×34.5 ×2)"] },
  "BB-SCDL":{ category: "panel", description: "Scottsdale bar back panel", trainingOccurrences: ["McComb (BBSCDL|48|34.5)"] },
};


// ─── NKBA LANDING AREA RULES ────────────────────────────────────────────────
// Enforced during appliance placement — no layout can violate these

export const LANDING = {
  sink:   { primary: 24, secondary: 18, note: "24\" on one side, 18\" on other" },
  range:  { eachSide: 15, note: "15\" landing on each side of cooktop/range" },
  fridge: { handleSide: 24, note: "24\" counter on handle side" },
  oven:   { nearest: 15, note: "15\" counter adjacent to oven" },
  micro:  { nearest: 15, note: "15\" counter near microwave" },
  dw:     { note: "Must be adjacent to sink, same wall or island side" },
};


// ─── CLEARANCE RULES ────────────────────────────────────────────────────────

export const CLEARANCE = {
  walkwayMin: 42,
  walkwayRecommended: 48,
  twoCookMin: 48,
  doorClearance: 32,
  lazysusan: { interiorDoor: 36, minDoorway: 30.5 },
};


// ─── WORK TRIANGLE ──────────────────────────────────────────────────────────

export const TRIANGLE = {
  totalMin: 156,   // 13 feet in inches
  totalMax: 312,   // 26 feet
  legMax: 108,     // 9 feet max single leg
};


// ─── CORNER TREATMENT RULES ─────────────────────────────────────────────────
// Extracted from 30 training projects

export const CORNER_RULES = {
  lazySusan: {
    skus: ["BL33-PH", "BL36-PH", "BL33-SS-PH", "BL36-SS-PH"],
    minWallEachDirection: { 33: 33, 36: 36 },
    fillerRequired: false,
    interiorClearance: 36,
    variants: {
      "SS": "Super Susan shelves — premium access ($2,046 list for BL36-SS-PH-L)",
      "PH": "Pie-hinged doors — standard",
      "CP": "Chrome wire pie-cut shelves (BL36 only)",
    },
    trainingOccurrences: ["Alix (×2 BL36-SS-PH)", "Lofton (BL36-SS-PH-L)", "Sabelhaus (BL36-SS-PH-L)"],
    bestWhen: "Both walls ≥36\", client wants full corner access, budget allows",
  },
  blindCorner: {
    skus: ["BBC36", "BBC39", "BBC42", "BBC45", "BBC48"],
    fillerRequired: true,
    minFiller: 3,
    blindPull: 4,
    variants: {
      standard: "BBC{w} standard blind corner",
      wireShelf: "BBC{w}-WS with full swing chrome wire shelf",
      magicCorner: "BBC{w}-MC with chrome wire magic corner ($3,938+ — premium)",
      quarterTurnShelves: "BBC{w}-S with quarter-turn shelves for corner access",
      fillBB: "FILL BB modification to fill blind area",
      fhd: "FHD full-height door option (omit top drawer)",
    },
    trainingOccurrences: [
      "DeLawyer (BL36-PHL — plain blind)",
      "LWH Hartley (BBC48R with FILL BB + FULL SHELF)",
      "Huang (BBC45R-WS + BBC45L-WS with wire shelves)",
      "Firebird (BBC48R modified to 47\" with FILL BB + FHD)",
      "Bollini (BBC48R-MC Magic Corner — $3,938, highest-price corner in training)",
      "Bissegger Great Room (BBC42R-S quarter-turn shelves in bar zone)",
    ],
    bestWhen: "Default corner treatment, works with any wall length ≥39\"",
  },
  wallSquareCorner: {
    skus: ["WSC2436-PHL", "WSC2436-PHR"],
    description: "Wall square corner for upper cabinet L-turns",
    trainingOccurrences: ["Sabelhaus (WSC2436-PHL + WSC2436-PHR pair)"],
    bestWhen: "Upper cabinet L-shape corner — pairs with base lazy susan or blind below",
  },
  noCorner: {
    trainingOccurrences: [
      "Gable (U-shape, corners handled by wall transitions)",
      "Kline Piazza (single wall, no corners)",
      "Imai Robin (single wall, no corners)",
      "All vanity/office/utility projects (single wall)",
    ],
  },
};


// ─── APPLIANCE ADJACENCY RULES ──────────────────────────────────────────────

export const ADJACENCY = {
  dishwasher: {
    mustBeAdjacentTo: "sink",
    maxDistanceFromSink: 36,   // inches from sink centerline
    sameWallOrIslandSide: true,
    width: 24,
    trainingConsistency: "100% — all kitchen projects place DW adjacent to sink",
  },
  waste: {
    preferNearSink: true,
    maxPositionsFromSink: 2,   // 0, 1, or 2 cabinets away
    standardWidths: [18, 21],
    skus: {
      wood: "BWDMW18",        // Lofton, Imai Robin
      aluminum: "BWDMA18",     // DeLawyer, Gable, Kline Piazza, Dolfin Isle
      aluminumFHD: "BWDMA18-FHD",  // DeLawyer
      doorMounted: "BWDMB18",  // McCarter Parade
      double21: "BWDMW21",     // Huang (double waste, 21" wide)
    },
    trainingNote: "Most kitchen projects include waste cabinet. Always within 2 positions of sink.",
  },
  range: {
    neverAdjacentToFridge: true,
    neverInCorner: true,
    preferCenteredOnWall: true,    // Imai Robin, Alix — symmetrical flanking
    preferFlankingDrawers: true,   // Majority of projects use drawer bases adjacent to range
    flanking: {
      drawer: { priority: 1, skuPrefix: "B3D", note: "Most common: B3D18, B3D21, B3D24, B3D30, B3D33, B3D36, B3D37" },
      pullOut: { priority: 2, skuPrefix: "BPOS", widths: [12, 15], note: "4-tier pull-out for spice/oil — Gable, Kline Piazza, Dolfin Isle" },
      rollOut: { priority: 3, skuPrefix: "B-RT", note: "Roll-out tray base — DeLawyer, Gable, Kline Piazza" },
      heavyDuty: { priority: 4, skuPrefix: "B2HD", note: "Heavy-duty guide drawers — Firebird (B2HD36)" },
    },
  },
  fridge: {
    preferEndOfRun: true,
    requiresPanels: true,
    panelSkuPrefix: "REP",
    aboveCab: "RW",     // Refrigerator wall cabinet
    trainingDepths: {
      "24": "Kline Piazza (REP3 93FTK-24) — counter-depth fridge",
      "27": "Imai Robin, Gable, Huang (REP3/4 96FTK-27) — standard depth",
      "30": "Alix (FREP3/4 108FTK27) — full depth",
    },
    trainingHeights: {
      "93": "Kline Piazza, Gable, Huang",
      "96": "Huang (REP3/4 96FTK-27)",
      "102": "Firebird (REP3/4 102FTK-27R) — tallest in training",
      "108": "Alix (FREP3/4 108FTK27)",
      "114": "McCarter Parade (REP1.5 114FTK-27L)",
    },
  },
  ovenTower: {
    requiresPanels: true,
    panelSkuPrefix: "REP",
    heights: [84, 93, 96, 105],
    skuPattern: "O{w}{h}",
    cutoutFormRequired: true,
    trainingOccurrences: ["Lofton (O2784)", "Alix (O30105)", "OC Design (FC-O3084)", "Huang (O3093)"],
  },
  ovenMicroTower: {
    heights: [96],
    skuPattern: "OM{w}{h}",
    dualCutout: true,
    trainingOccurrences: ["Firebird (OM3096 with MW 27×14 + OVEN 27×25 cutouts)"],
    note: "Oven/microwave combo tower — requires 2 cutout forms",
  },
};


// ─── FILLER PLACEMENT RULES ─────────────────────────────────────────────────

export const FILLER_RULES = {
  validPositions: [
    "run_termination",           // cabinet meets wall
    "blind_corner_pull_gap",     // BBC blind side
    "appliance_adjacent",        // service clearance
    "wall_obstruction",          // door frame, pipe chase
    "assembly_flanking",         // flanking utility tower assemblies (Bennet)
    "vanity_transition",         // between vanity base and column (McCarter)
  ],
  invalidPositions: [
    "mid_run_between_standard",  // never between two std cabinets
  ],
  standardFillerSkus: {
    3: "F330", 6: "F630",
    // Vanity-height fillers
    "3v": "F326 1/2",  // vanity filler (Bissegger)
    // Wall fillers
    "3w39": "F339", "3w42": "F342", "6w42": "F642",
    // Tall fillers
    "3t90": "F390", "3t96": "F396", "3t108": "F3108", "6t96": "F696", "6t102": "F6102", "6t114": "F6114",
  },
  overlayFillerSkus: { 3: "OVF330 1/2", 6: "OVF363", 36: "OVF336", 42: "OVF342", 92: "OVF392", 114: "OVF3114" },
  strategy: {
    preferModifyWidth: true,
    maxModPctOfOrder: 30,    // Eclipse allows up to 30% of cabs modified N/C
    note: "Training data shows width mods preferred over fillers. Beyond 30% of cab count, 30% upcharge applies.",
  },
};


// ─── WIDTH MODIFICATION RULES ───────────────────────────────────────────────
// Extracted from Bennet, Huang, Firebird, McCarter training projects

export const WIDTH_MOD_RULES = {
  noCostThreshold: 0.30,      // 30% of total cabinet count can be reduced N/C
  upchargePercent: 30,         // beyond limit: 30% upcharge on modified cabs
  modSq50: {
    code: "MOD/SQ50",
    description: "50% square cabinet modifier for custom quote buffering workflow",
    priceFactor: 0.50,
    trainingOccurrences: ["McCarter Master Bath (FLVSB4221, BC3341)", "Dolfin Isle (W1DR2454-2D)"],
    note: "Used when exact pricing isn't in catalog — 50% buffer for custom quote.",
  },
  modSq30: {
    code: "MOD/SQ30",
    description: "30% square cabinet modifier",
    priceFactor: 0.30,
    trainingOccurrences: ["Firebird (W2742 modified to 25.5\")"],
  },
  widthReductionNC: {
    code: "MOD N/C WIDTH REDUCTION",
    description: "No-charge width reduction within 30% limit",
    trainingOccurrences: ["Bennet (UT3387 33→31.5\", W3318 33→31.5\")"],
  },
  depthOption: {
    code: "DEPTH OPTION",
    description: "Modify depth (commonly 18\", 21\", 21.75\", 27\")",
    standardPrice: 0,
    trainingOccurrences: ["Bissegger Office (24\" depth on FD2HD, LD36)", "Gable pantry (18\" depth)"],
  },
  noToeKick: {
    code: "NTK",
    description: "No Toe Kick modification — removes toe kick from tall cabinets",
    trainingOccurrences: ["McCarter Parade (UT1884L/R with NTK, reduced to 78\" OA height)"],
    note: "Reduces overall height by toe kick amount (4.5\"). Used for stacked assemblies.",
  },
  fillBaseBind: {
    code: "FILL BB",
    description: "Fill base blind area — solid back in blind corner",
    price: 232,
    trainingOccurrences: ["LWH Hartley (BBC48R)", "Huang (BBC45R-WS, BBC45L-WS)", "Firebird (BBC48R)"],
  },
  fullShelf: {
    code: "FULL SHELF",
    description: "Full depth shelves instead of half-depth",
    price: 89,
    trainingOccurrences: ["LWH Hartley (BBC48R, UT2196L)", "McCarter Parade (B30 ×3)"],
  },
  removableToeKick: {
    code: "RMK",
    description: "Removable toe kick — allows service access",
    trainingOccurrences: ["Owen (RMK on nearly every base cab in both orders)"],
    note: "Used when toe kick needs to be removable for plumbing/appliance service access.",
  },
  subDrawerFront: {
    code: "SUB DRW FRONT",
    description: "Substituted drawer front — custom door style on drawer",
    trainingOccurrences: ["Bollini (SUB DRW FRONT DF-HTFD Hartford drawer fronts on B3D38, B2HD36, B4D18, O3096)"],
    note: "Allows mixing drawer front profiles within a cabinet family.",
  },
  wireTrayDivider: {
    code: "WTD",
    description: "Stainless steel wire tray divider for sheet/tray organization",
    price: 63,
    trainingOccurrences: ["Bollini (2× WTD in O3096-27 oven tower)", "Kline Piazza (6× WTD in RW3621)"],
  },
  drawerPegSystem: {
    code: "DPS",
    description: "Drawer peg system for dish/plate organization",
    price: 239,
    trainingOccurrences: ["Bissegger Great Room (DPS-36 ×4 on B3D42 drawer bases)"],
  },
  woodCutleryDrawer: {
    code: "WCD2",
    description: "Wood cutlery drawer inserts (2 per set)",
    price: 237,
    trainingOccurrences: ["Bissegger Great Room (WCD2 on B3D33 ×2)"],
  },
  spiceRack: {
    code: "SR8",
    description: "Spice rack insert (8-shelf) for pull-out cabinets",
    price: 100,
    trainingOccurrences: ["Bissegger Great Room (SR8 on BPOS-12)"],
  },
  toeKickLighting: {
    code: "PTKL",
    description: "Toe kick lighting — LED strip prep in toe kick area",
    price: 60,
    trainingOccurrences: ["Bissegger Great Room (PTKL on 18 bases — most extensive)", "Kamisar (PTKL on island bases)"],
  },
  prepFloatingShelfLighting: {
    code: "PFSL",
    description: "Prep floating shelf for integrated lighting",
    price: 100,
    trainingOccurrences: ["Bissegger Great Room (PFSL on bar floating shelves FLS|84|3|8 ×2)"],
  },
  contourDoor: {
    code: "RCTD/LCTD",
    description: "Right/Left contour door (arch profile) for garage pocket doors",
    price: 90,
    trainingOccurrences: ["Bissegger Great Room (RCTD + LCTD on WGPD4272 wall garages)"],
  },
  mullion: {
    code: "MD",
    description: "Mullion center divider for wall/door cabinets",
    price: 210,
    trainingOccurrences: ["Bissegger Great Room (MD on WGPD4272 wall garages)"],
  },
  glassFrameDoor: {
    code: "GFD",
    description: "Glass frame wall door — premium display option",
    trainingOccurrences: ["Alix (W4236+GFD)", "Firebird (SW1551+GFD, SA2451+GFD, SW3351+GFD)", "Showroom ECLD (W3636+GFD)"],
  },
  finishedInterior: {
    code: "FINISHED INT",
    description: "Finished interior with doors — premium upcharge",
    pctUpcharge: true,
    trainingOccurrences: ["Alix", "Firebird (multiple stacked walls)"],
  },
  prepForLighting: {
    code: "PWL",
    description: "Prep cabinet for lighting — wiring channel",
    price: 60,
    trainingOccurrences: ["Dolfin Isle (FLS shelves)", "Firebird (FLS + SW cabs)", "Showroom ECLD"],
  },
  twoToneInterior: {
    code: "2-TONE",
    description: "Two-tone interior contrast color (e.g., Walnut Rye inside Shoji White cab)",
    trainingOccurrences: ["Showroom ECLD (W3636 with 2-TONE Walnut Rye interior, $884)"],
    note: "Per-door charge for interior contrast color — display/glass door cabinets.",
  },
};


// ─── CONSTRUCTION TYPES ─────────────────────────────────────────────────────
// Discovered across 30 training projects

export const CONSTRUCTION_TYPES = {
  standard: {
    code: "Standard",
    material: "Particle Board",
    pctUpcharge: 0,
    note: "Default construction — particle board box",
    trainingOccurrences: ["Majority of projects"],
  },
  plywood: {
    code: "Plywood",
    material: "Plywood",
    pctUpcharge: 10,
    note: "Full plywood box construction",
    trainingOccurrences: ["Imai Robin, Alix options"],
  },
  plywoodPartial: {
    code: "Plywood/Partial Plywood",
    material: "Procore Plywood/Partial",
    pctUpcharge: "varies",
    note: "Procore plywood/partial — finished ends are particle board/MDF, not plywood",
    trainingOccurrences: ["Huang ($2,485.73 upgrade)", "Firebird stain order"],
    warning: "Finished end panels will NOT be plywood — particle board or MDF instead",
  },
  mixed: {
    code: "Mixed",
    material: "Particle Board",
    note: "Mixed construction — proprietary spec beyond Standard/5-ply",
    trainingOccurrences: ["Bennet Utility (Mixed Particle Board)"],
  },
};


// ─── UPPER CABINET RULES ────────────────────────────────────────────────────

export const UPPER_RULES = {
  alignWithBase: true,
  neverWiderThanBaseBelow: true,
  consistentHeightPerWall: true,
  skipAboveRange: true,         // use RH hood or MW
  skipAtWindow: true,
  skipInModernMinimal: true,    // DeLawyer: only 2 wall cabs. Kline Piazza: 3+1
  heightRecommendations: {
    standardCeiling96: { preferred: 36, acceptable: [30, 33, 36, 39, 42] },
    tallCeiling108: { preferred: 42, acceptable: [36, 39, 42] },
    tallCeiling120: { preferred: 42, note: "Use stacked system: 42\" main + 21\" above (OC Design)" },
  },
  stackedSystem: {
    applicable: "ceilings ≥108\"",
    mainHeight: 42,
    stackedHeight: 21,
    stackedDepth15: true,
    note: "Alix and OC Design use stacked uppers. McCarter Parade uses SW3060(15) at 15\" depth.",
    trainingOccurrences: ["Alix", "OC Design", "McCarter Parade (SW3060 ×3)", "Firebird (SW1551, SW3351, SA2451)"],
  },
  rangeHood: {
    models: {
      RH21: { description: "Standard range hood", widths: [30, 36, 42], height: 24 },
      RH50: { description: "Large range hood 50 model", widths: [42], heights: [42], depth: 24, trainingOccurrences: ["Showroom ECLD (RH50 424224)"] },
    },
  },
  applianceGarage: {
    sku: "WGD",
    heights: [54],
    depths: [18],
    trainingOccurrences: ["Dolfin Isle (WGD2454|18|L, WGD2454|18|R flanking)"],
    note: "Tall wall cabinet with garage doors — countertop clutter reduction.",
  },
};


// ─── ISLAND RULES ───────────────────────────────────────────────────────────

export const ISLAND_RULES = {
  minClearanceToPerimeter: 42,
  recommendedClearance: 48,
  minLength: 48,
  seatingSide: {
    depth: 13,
    skuPattern: "B{w}-FHD",
    mods: ["13\" DEPTH OPTION", "FTK"],
    note: "FHD at 13\" depth with flush toe kick — Imai Robin (4× B33-FHD), OC Design (3× FC-B30-FHD)",
  },
  endTreatments: {
    edgeBanded: { skuPattern: "EDGTL|{w}|{h}|0.75", note: "Waterfall ends — Kline Piazza, Huang" },
    barBack: { skuPattern: "BB{style}|{w}|{h}", note: "Bar back panels — Imai Robin (BBHNVR)" },
    barBackComponent: { skuPattern: "BB1/2-CMP", note: "Component bar back — Dolfin Isle (77.25\" wide modified)" },
    decoEndPanel: { skuPattern: "BDEP-F", note: "Deco end panels — Alix, Firebird (BDEP-F LT/RT)" },
    looseDoors: { skuPattern: "LD-STD|{w}|{h}", note: "Loose doors on back — Alix island, Gable pantry" },
    baseColumn: { skuPattern: "BC3341/2-{d}", note: "Base columns at island ends — McCarter Parade (BC3341/2-27)" },
    finishPanelSmall: { skuPattern: "FPS|{w}|{h}", note: "Finish panel small vertical — Huang (3/4\" FPS|39.5|35.5)" },
  },
  withRange: {
    drawerSideFlanking: true,
    fhdBackSide: true,
    note: "Kline Piazza: range in island, B3D36 + BPOS-12 + B33-RT flanking, 4× FHD back",
  },
  floatingShelves: {
    sku: "FLS",
    depths: [13],
    heights: [3],
    note: "Floating shelves on island — Dolfin Isle (4× FLS|21|3|13), Firebird (6× FLS with PWL lighting)",
  },
};


// ─── PENINSULA RULES ────────────────────────────────────────────────────────
// New section — extracted from Showroom ECLD and Owen training projects

export const PENINSULA_RULES = {
  columnSkuPattern: "PBC3341/2-{d}",
  standardDepths: [36],
  columnHeight: 34.5,
  columnWidth: 3,
  requiresEndPanels: true,
  endPanelSku: "REP6R",
  edgeBandedShelf: {
    description: "Edge banded shelf spanning peninsula for seating overhang",
    trainingOccurrences: ["Showroom ECLD (1 1/4\" Edge Banded Shelf 14\"W × 81\"D with PWL)"],
  },
  turnedLegs: {
    sku: "TL",
    description: "Straight turned legs for peninsula support",
  },
  furnitureBase: {
    sku: "FBP",
    description: "Furniture base moulding for peninsula cabinet base treatment",
  },
  trainingOccurrences: [
    "Showroom ECLD (PBC3341/2-36|36 ×2 peninsula columns at 36\" depth)",
  ],
};


// ─── MATERIAL ASSIGNMENT RULES ──────────────────────────────────────────────
// How to split materials when 2+ specs are used

export const MATERIAL_SPLIT = {
  twoTone_baseUpper: {
    description: "All bases in Material A, all uppers in Material B",
    trainingOccurrences: ["Gable (Walnut bases, Polar Paint uppers)"],
    exception: "Fridge wall cab (RW) stays with base material to match tall zone",
  },
  twoTone_zoneSpecific: {
    description: "Different zones get different materials",
    trainingOccurrences: ["Lofton (Walnut perimeter, HPL oven tower)"],
  },
  twoTone_functional: {
    description: "Functional split: cabinets in Material A, countertop/trim in Material B",
    trainingOccurrences: ["Bissegger Office (Painted Maple cabs + Rustic Walnut countertop)"],
  },
  twoTone_stainPaint: {
    description: "Stain for bases/shelves, custom paint for wall/stacked cabs",
    trainingOccurrences: ["Firebird (Maple Cashmere Stain bases + Custom Paint walls)"],
  },
  twoTone_paintStain: {
    description: "Painted perimeter + stained island for material contrast",
    trainingOccurrences: ["Owen (Light French Gray paint perimeter + Burnt Sugar Rustic Hickory stain island)"],
    note: "Different species between perimeter (Maple) and island (Rustic Hickory). First Rustic Hickory in training.",
  },
  twoTone_paintPaint: {
    description: "Two different paint colors on same species for subtle contrast",
    trainingOccurrences: ["McComb (Shoji White Maple perimeter + Slate Tile Maple island)"],
    note: "Same species (Maple), different paint colors. Both use Procore Plywood/Partial construction.",
  },
  twoTone_doorStyle: {
    description: "Same material differentiated by door style {A} vs {B}",
    trainingOccurrences: ["Bissegger Great Room (Rift Cut White Oak: Malibu FP {A} primary + Malibu Reeded Panel {B} bar accent)"],
    note: "Same species + same stain, differentiated entirely by door style. Subtle architectural contrast.",
  },
  twoTone_interior: {
    description: "Cabinet exterior in Material A, interior in contrasting Material B (display cabs)",
    trainingOccurrences: ["Showroom ECLD (Shoji White exterior + Walnut Rye interior on glass display)"],
  },
  threeTone: {
    description: "3 separate POs for 3 material zones",
    trainingOccurrences: ["Kline Piazza (Walnut bases + Shoji White uppers + Outer Space island)"],
    note: "Most complex split — requires 3 separate orders to the factory",
  },
  splitCatalog_sameMaterial: {
    description: "Same material spec split across 2 catalogs for layout/PO separation",
    trainingOccurrences: [
      "McCarter Parade (ECL24A_1 panels + ECL24B_1 main cabs — same White Oak/Almond)",
      "Sabelhaus (ECL24_1 perimeter + ECL24-C_1 window wall — same Grey Echo TFL)",
      "Dolfin Isle (ECL8_6A_1 perimeter + ECL8_6B_1 island — same White Oak Natural)",
    ],
    note: "Used for PO separation, layout grouping, or catalog door group differences.",
  },
  multiVariant: {
    description: "Same layout quoted in multiple material options for client comparison",
    trainingOccurrences: ["Alix (White Oak / TFL / Paint)", "OC Design (Acrylic / TFL)", "Dolfin Isle (5 species quoted)"],
    note: "Layout is material-independent — constraint engine generates one layout, pricing runs multiple configs",
  },
};


// ─── CABINET SELECTION PRIORITY ─────────────────────────────────────────────
// When filling a segment, what type of cabinet to prefer based on zone

export const ZONE_CABINET_PRIORITY = {
  rangeFlanking: {
    preferred: ["B3D", "B4D"],          // drawer bases for utensils/pots
    secondary: ["BPOS-12", "BPOS-15", "B-RT", "B2HD"],  // pull-out, roll-out, heavy-duty
    avoid: ["B"],                        // standard door bases look cheap next to range
    note: "Majority of projects use drawer bases flanking range",
  },
  sinkAdjacent: {
    preferred: ["BWDMA18", "B3D", "B4D"],
    note: "Waste cab + drawers near sink. DW always adjacent.",
  },
  endOfRun: {
    preferred: ["B-RT", "B-FHD", "B3D"],  // roll-out, full-height door, drawers
    note: "End of run often gets specialty storage or finished end panel",
  },
  fridgePocket: {
    required: ["REP", "RW"],              // end panels + fridge wall cab above
    note: "Always requires REP panels and RW above-fridge cab",
  },
  cornerAdjacent: {
    preferred: ["B3D", "B4D", "B"],       // drawers or standard
    fillerRequired: true,                  // filler between corner cab and first standard cab
  },
  pantry: {
    preferred: ["UT", "U", "B-FHD"],     // tall utility, base FHD
    depthOption18: true,                   // 18" depth for walkway clearance (Gable, Kline Piazza)
    note: "Can be LD-STD loose doors above shallow bases (Gable butler's pantry)",
  },
  island: {
    workSide: ["B3D", "SB", "BWDM"],    // drawer, sink, waste
    seatingSide: ["B-FHD"],               // full-height door at 13" depth
    rangeSide: ["B3D", "BPOS-12", "B-RT"],
  },
  // New non-kitchen zones
  officeDesk: {
    preferred: ["FD2HD", "VB3D"],         // file drawer, vanity 3-drawer pedestal
    accessories: ["LD36"],                 // lap drawer spanning desk opening
    note: "Bissegger Office: FD2HD21 + VB3D18 pedestals with LD36 keyboard tray",
  },
  vanityWall: {
    preferred: ["FLVSB", "VTSB", "VTSB3D", "UV"],  // floating vanity, tall sink bases, utility vanity towers
    accessories: ["BC3341", "PLWT-SQUARE"],            // columns, finished tops
    note: "Bathroom vanity configurations from McCarter and Cost Plus training",
  },
  utilityStorage: {
    preferred: ["UT", "W"],                // utility tall + wall cap
    stackable: true,
    note: "Bennet: UT3387 + W3318 stacked to 105\" total height",
  },
  laundryRoom: {
    preferred: ["BBC", "B3D", "UT"],       // blind corner, drawer base, utility tall
    note: "LWH Hartley: BBC48R + B3D18 + UT2196L in L-shape laundry",
  },
  barEntertaining: {
    preferred: ["BCF", "B-FHD", "B3D", "BBC-S"],  // beverage center, FHD, drawers, blind corner
    accessories: ["FLS", "PLWT-COVE"],               // floating shelves, cove molding
    shallowDepth: 21,
    note: "Bissegger Great Room bar: 21\" depth, floating shelves with PFSL lighting, PLWT-COVE top edge",
  },
  greatRoomDisplay: {
    preferred: ["WGPD", "RW", "FLS"],     // wall garage, fridge wall, floating shelves
    accessories: ["REF", "WS"],            // RF panels, decorative wall shelves
    note: "Bissegger Great Room: WGPD pocket door garages + REF panels + WS decorative shelves",
  },
  builtInNook: {
    preferred: ["B-FHD", "FLS"],           // FHD bases at shallow depth, floating shelves
    accessories: ["EDGTS"],                // edge-banded side panels
    shallowDepth: 16,
    note: "Bissegger Great Room nook: B-FHD at 16\" depth + 80.75\" floating shelves ×3",
  },
};


// ─── ACCESSORY RULES ────────────────────────────────────────────────────────
// Trim, molding, and hardware accessories

export const TRIM_ACCESSORIES = {
  toeKick: {
    standard: "TK-N/C",
    charged: "TK-CHARGE",
    plywood: "3/4TK",
    flush: "FTK FLUSH TOE",
  },
  subRail: {
    "3inch10ft": "3SRM3F-10'",
    "3inch8ft": "3SRM3F-8'",
    "1.5inch10ft": "3SRM1 1/2F-10'",
  },
  traditionalTrim: {
    "8ft": "7/8TD -8'",
    trainingOccurrences: ["Cost Plus Vanity", "Sabelhaus"],
  },
  furnitureCrown: {
    "10ft": "4 1/4FCR -10'",
    "3inch10ft": "3FCR -10'",
    trainingOccurrences: ["Cost Plus (3FCR)", "Firebird (4 1/4FCR)"],
  },
  battenMould: {
    "8ft": "7/8BM -8'",
    trainingOccurrences: ["McCarter Parade (8× 7/8BM -8')"],
  },
  underCabinet: {
    "96": "1 3/4 UCA",
    trainingOccurrences: ["Firebird (3× 1 3/4 UCA)"],
  },
  touchUp: {
    stain: "TUK-STAIN",
    paintBottle: "TUB",
    paintQuart: "QST",
  },
  restrictorClips: {
    sku: "RESTRICTOR CLIPS",
    trainingOccurrences: ["Firebird (16× clips)"],
  },
  finishedTop: {
    square: "PLWT-SQUARE",
    cove: "PLWT-COVE",
    description: "Finished top molding — square or cove profile for countertop trim",
    trainingOccurrences: ["Bissegger Office (PLWT-SQUARE)", "McCarter Master Bath (PLWT-SQUARE)", "Bissegger Great Room (PLWT-COVE|75.5|25 — first cove molding)"],
  },
  crownMould: {
    "10ft": "3 1/2CRN -10'",
    trainingOccurrences: ["Kamisar (4× 3 1/2CRN -10')"],
  },
  counterTopMould: {
    "8ft": "1 1/2STP -8'",
    trainingOccurrences: ["Kamisar (1 1/2STP -8')"],
    note: "Square counter top mould for exposed counter edges.",
  },
  subRail10: {
    "10ft": "3SRM10F-10'",
    description: "10\" face sub rail — extra wide for premium presentations",
    trainingOccurrences: ["Kamisar (4× 3SRM10F-10')"],
  },
  straightValance: {
    sku: "STVAL",
    description: "Straight valance for decorative accents",
    trainingOccurrences: ["Owen (STVAL48)"],
  },
  contemporaryValance: {
    sku: "FBCCTVAL",
    description: "Furniture base contemporary valance chamfer",
    trainingOccurrences: ["Bissegger Great Room (FBCCTVAL42 ×2)", "JRS (CTVAL)"],
  },
  floatingShelfBrackets: {
    "6inch": "FLSB6",
    "10inch": "FLSB10",
    description: "Floating shelf mounting brackets",
    trainingOccurrences: ["Bissegger Great Room (5× FLSB10 kitchen, 3× FLSB6 bar)"],
  },
};


// ─── WIDTH SELECTION ALGORITHM ──────────────────────────────────────────────
// Given a segment to fill, select the best combination of stock widths

/**
 * Fill a segment with standard Eclipse cabinet widths.
 * Returns an array of widths that sum to exactly segmentLength,
 * using the fewest cabinets possible with the largest stock sizes.
 * If exact fill isn't possible, returns the closest fit with a filler.
 *
 * @param {number} segmentLength - Available space in inches
 * @param {number[]} availableWidths - Stock widths to use (default: STD_BASE_WIDTHS)
 * @param {Object} options - { minWidth, maxWidth, preferSymmetric, maxCabinets }
 * @returns {{ cabinets: number[], filler: number, total: number }}
 */
export function fillSegment(segmentLength, availableWidths = STD_BASE_WIDTHS, options = {}) {
  const { minWidth = 9, maxWidth = 42, preferSymmetric = false, maxCabinets = 8 } = options;
  const widths = availableWidths.filter(w => w >= minWidth && w <= maxWidth).sort((a, b) => b - a);

  // Try exact fill with greedy largest-first
  const result = greedyFill(segmentLength, widths);
  if (result.filler === 0) return result;

  // Try symmetric fill if requested (for range flanking)
  if (preferSymmetric && segmentLength >= 30) {
    const half = segmentLength / 2;
    const halfResult = greedyFill(half, widths);
    if (halfResult.filler <= 1.5) {
      const mirrored = [...halfResult.cabinets, ...halfResult.cabinets.slice().reverse()];
      const mirrorTotal = mirrored.reduce((s, w) => s + w, 0);
      const mirrorFiller = segmentLength - mirrorTotal;
      if (mirrorFiller >= 0 && mirrorFiller <= 6) {
        return { cabinets: mirrored, filler: mirrorFiller, total: segmentLength, symmetric: true };
      }
    }
  }

  // Try width modification: can we modify one cabinet to absorb the filler?
  if (result.filler > 0 && result.filler <= 6 && result.cabinets.length > 0) {
    const lastCab = result.cabinets[result.cabinets.length - 1];
    const modifiedWidth = lastCab + result.filler;
    // Eclipse allows N/C width mods up to ~30% of order
    if (modifiedWidth <= lastCab * 1.15 || result.filler <= 3) {
      return {
        cabinets: [...result.cabinets.slice(0, -1), modifiedWidth],
        filler: 0,
        total: segmentLength,
        modified: { original: lastCab, modified: modifiedWidth },
      };
    }
  }

  return result;
}

function greedyFill(length, widths) {
  const cabinets = [];
  let remaining = length;

  for (const w of widths) {
    while (remaining >= w && cabinets.length < 8) {
      cabinets.push(w);
      remaining = Math.round((remaining - w) * 100) / 100; // avoid float drift
    }
  }

  return { cabinets, filler: Math.max(0, remaining), total: length };
}


// ─── CONSTRAINT VALIDATION ──────────────────────────────────────────────────
// Layer 2: Validate a completed layout against all rules

/**
 * Validate a completed layout against NKBA and Eclipse rules.
 * Returns an array of { rule, severity, message, location }
 *
 * @param {Object} layout - The generated layout
 * @returns {Array} validation results
 */
// ─── WORK TRIANGLE HELPERS ──────────────────────────────────────────────────

function calculateDistance(pt1, pt2) {
  if (!pt1 || !pt2) return 0;
  const dx = (pt1.x || 0) - (pt2.x || 0);
  const dy = (pt1.y || 0) - (pt2.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function findAppliance(appliances, type) {
  return appliances.find(a => a.type === type || (type === 'cooktop' && a.type === 'range'));
}

// ─── ADA COMPLIANCE HELPERS ─────────────────────────────────────────────────

const ADA_RULES = {
  counterHeightMax: 34,           // vs standard 36"
  upperCabBottomMax: 48,          // vs standard 54"
  kneeHeight: 27,                 // inches under sink
  kneeWidth: 30,                  // inches under sink
  kneeDepth: 19,                  // inches under sink
  toeKickHeight: 9,               // vs standard 4.5"
  toeKickDepth: 6,                // vs standard 3"
  walkwayMin: 42,                 // general ADA walkway
  walkwayWorkAisle: 48,           // work aisle ADA minimum
};

export function validateLayout(layout) {
  const issues = [];
  const roomType = layout.roomType || "kitchen";
  const roomConfig = ROOM_TYPES[roomType] || ROOM_TYPES.kitchen;
  const prefs = layout.prefs || {};
  const numCooks = prefs.numCooks || 1;
  const isADACompliant = prefs.adaCompliant === true;

  // 1. Landing area checks (only for kitchens)
  if (roomConfig.nkbaLandingApplies && layout.appliances) {
    for (const app of layout.appliances) {
      if (app.type === 'range' || app.type === 'cooktop') {
        const leftLanding = app.leftClearance || 0;
        const rightLanding = app.rightClearance || 0;
        if (leftLanding < LANDING.range.eachSide) {
          issues.push({ rule: "NKBA-Landing-Range", severity: "error", message: `Range left landing ${leftLanding}" < ${LANDING.range.eachSide}" minimum`, location: app.wall });
        }
        if (rightLanding < LANDING.range.eachSide) {
          issues.push({ rule: "NKBA-Landing-Range", severity: "error", message: `Range right landing ${rightLanding}" < ${LANDING.range.eachSide}" minimum`, location: app.wall });
        }
      }
      if (app.type === 'sink') {
        const left = app.leftClearance || 0;
        const right = app.rightClearance || 0;
        const primary = Math.max(left, right);
        const secondary = Math.min(left, right);
        if (primary < LANDING.sink.primary) {
          issues.push({ rule: "NKBA-Landing-Sink", severity: "error", message: `Sink primary landing ${primary}" < ${LANDING.sink.primary}" minimum`, location: app.wall });
        }
        if (secondary < LANDING.sink.secondary) {
          issues.push({ rule: "NKBA-Landing-Sink", severity: "warning", message: `Sink secondary landing ${secondary}" < ${LANDING.sink.secondary}" recommended`, location: app.wall });
        }
      }
      if (app.type === 'refrigerator') {
        if ((app.handleSideClearance || 0) < LANDING.fridge.handleSide) {
          issues.push({ rule: "NKBA-Landing-Fridge", severity: "warning", message: `Fridge handle-side landing ${app.handleSideClearance}" < ${LANDING.fridge.handleSide}" recommended`, location: app.wall });
        }
      }
      if (app.type === 'dishwasher') {
        if (!app.adjacentToSink) {
          issues.push({ rule: "NKBA-DW-Sink", severity: "error", message: "Dishwasher must be adjacent to sink", location: app.wall });
        }
      }
    }
  }

  // 2. Work triangle check (only for kitchens)
  if (roomConfig.workTriangleApplies && layout.appliances) {
    const sink = findAppliance(layout.appliances, 'sink');
    const range = findAppliance(layout.appliances, 'range');
    const fridge = findAppliance(layout.appliances, 'refrigerator');

    if (sink && range && fridge) {
      const legSinkRange = calculateDistance(sink, range);
      const legRangeFridge = calculateDistance(range, fridge);
      const legFridgeSink = calculateDistance(fridge, sink);
      const perimeter = legSinkRange + legRangeFridge + legFridgeSink;

      // Check each leg (4ft–9ft = 48"–108")
      const legMin = 48, legMax = 108;
      if (legSinkRange < legMin) {
        issues.push({ rule: "NKBA-Triangle-Leg-Short", severity: "warning", message: `Sink-to-range ${Math.round(legSinkRange)}" < ${legMin}" minimum (too close)` });
      }
      if (legRangeFridge < legMin) {
        issues.push({ rule: "NKBA-Triangle-Leg-Short", severity: "warning", message: `Range-to-fridge ${Math.round(legRangeFridge)}" < ${legMin}" minimum (too close)` });
      }
      if (legFridgeSink < legMin) {
        issues.push({ rule: "NKBA-Triangle-Leg-Short", severity: "warning", message: `Fridge-to-sink ${Math.round(legFridgeSink)}" < ${legMin}" minimum (too close)` });
      }
      if (legSinkRange > legMax) {
        issues.push({ rule: "NKBA-Triangle-Leg-Long", severity: "warning", message: `Sink-to-range ${Math.round(legSinkRange)}" > ${legMax}" maximum (too far)` });
      }
      if (legRangeFridge > legMax) {
        issues.push({ rule: "NKBA-Triangle-Leg-Long", severity: "warning", message: `Range-to-fridge ${Math.round(legRangeFridge)}" > ${legMax}" maximum (too far)` });
      }
      if (legFridgeSink > legMax) {
        issues.push({ rule: "NKBA-Triangle-Leg-Long", severity: "warning", message: `Fridge-to-sink ${Math.round(legFridgeSink)}" > ${legMax}" maximum (too far)` });
      }

      // Check total perimeter (12ft–26ft = 144"–312")
      if (perimeter < TRIANGLE.totalMin) {
        issues.push({ rule: "NKBA-Triangle-Min", severity: "warning", message: `Work triangle ${Math.round(perimeter)}" < ${TRIANGLE.totalMin}" minimum (too compact)` });
      }
      if (perimeter > TRIANGLE.totalMax) {
        issues.push({ rule: "NKBA-Triangle-Max", severity: "warning", message: `Work triangle ${Math.round(perimeter)}" > ${TRIANGLE.totalMax}" maximum (too spread)` });
      }
    } else {
      // Missing appliance — log info but not error
      const missing = [];
      if (!sink) missing.push("sink");
      if (!range) missing.push("range/cooktop");
      if (!fridge) missing.push("refrigerator");
      if (missing.length > 0) {
        issues.push({ rule: "NKBA-Triangle-Incomplete", severity: "info", message: `Work triangle incomplete — missing: ${missing.join(", ")}` });
      }
    }

    // Check legacy triangle data if present
    if (layout.trianglePerimeter) {
      if (layout.trianglePerimeter < TRIANGLE.totalMin) {
        issues.push({ rule: "NKBA-Triangle-Min", severity: "warning", message: `Work triangle ${layout.trianglePerimeter}" < ${TRIANGLE.totalMin}" minimum` });
      }
      if (layout.trianglePerimeter > TRIANGLE.totalMax) {
        issues.push({ rule: "NKBA-Triangle-Max", severity: "warning", message: `Work triangle ${layout.trianglePerimeter}" > ${TRIANGLE.totalMax}" maximum` });
      }
    }
    if (layout.triangleLegs) {
      for (const leg of layout.triangleLegs) {
        if (leg.distance > TRIANGLE.legMax) {
          issues.push({ rule: "NKBA-Triangle-Leg", severity: "warning", message: `${leg.from}→${leg.to} leg ${leg.distance}" > ${TRIANGLE.legMax}" max` });
        }
      }
    }
  }

  // 3. Clearance zone validation
  if (roomConfig.nkbaLandingApplies && layout.island) {
    // Island clearance: 42" between island and perimeter (36" minimum)
    const islandClearanceMin = 36;
    const islandClearanceRecommended = 42;

    if (layout.island.clearanceToPerimeter) {
      if (layout.island.clearanceToPerimeter < islandClearanceMin) {
        issues.push({
          rule: "NKBA-Island-Clearance-Critical",
          severity: "error",
          message: `Island clearance ${layout.island.clearanceToPerimeter}" < ${islandClearanceMin}" minimum`
        });
      } else if (layout.island.clearanceToPerimeter < islandClearanceRecommended) {
        issues.push({
          rule: "NKBA-Island-Clearance",
          severity: "warning",
          message: `Island clearance ${layout.island.clearanceToPerimeter}" < ${islandClearanceRecommended}" recommended`
        });
      }
    }
  }

  // Walkway clearance based on number of cooks
  if (roomConfig.nkbaLandingApplies) {
    const walkwayMin = numCooks >= 2 ? 42 : 36;
    const walkwayRecommended = numCooks >= 2 ? 48 : 42;

    if (layout.walkwayClearance) {
      if (layout.walkwayClearance < walkwayMin) {
        issues.push({
          rule: "NKBA-Walkway-Clearance",
          severity: "error",
          message: `Walkway clearance ${layout.walkwayClearance}" < ${walkwayMin}" minimum for ${numCooks} cook(s)`
        });
      } else if (layout.walkwayClearance < walkwayRecommended) {
        issues.push({
          rule: "NKBA-Walkway-Clearance",
          severity: "warning",
          message: `Walkway clearance ${layout.walkwayClearance}" < ${walkwayRecommended}" recommended for ${numCooks} cook(s)`
        });
      }
    }
  }

  // 4. Filler placement check
  if (layout.walls) {
    for (const wall of layout.walls) {
      const cabs = wall.cabinets || [];
      for (let i = 1; i < cabs.length - 1; i++) {
        if (cabs[i].type === 'filler' && cabs[i - 1].type !== 'appliance' && cabs[i + 1].type !== 'appliance'
            && cabs[i - 1].type !== 'corner' && cabs[i + 1].type !== 'corner') {
          issues.push({ rule: "Eclipse-Filler-Placement", severity: "warning", message: `Filler at position ${i} on ${wall.id} not adjacent to appliance or corner`, location: wall.id });
        }
      }
    }
  }

  // 5. Corner clearance check
  if (layout.corners) {
    for (const corner of layout.corners) {
      if (corner.type === 'lazySusan') {
        const wallA = corner.wallALength || 0;
        const wallB = corner.wallBLength || 0;
        const req = corner.size === 33 ? 33 : 36;
        if (wallA < req) {
          issues.push({ rule: "Eclipse-LazySusan-Space", severity: "error", message: `Lazy susan needs ${req}" on wall A but only ${wallA}" available`, location: corner.id });
        }
        if (wallB < req) {
          issues.push({ rule: "Eclipse-LazySusan-Space", severity: "error", message: `Lazy susan needs ${req}" on wall B but only ${wallB}" available`, location: corner.id });
        }
      }
    }
  }

  // 6. Width modification limit check
  if (layout.placements) {
    const totalCabs = layout.placements.filter(p => p.type === 'base' || p.type === 'wall' || p.type === 'tall').length;
    const modifiedCabs = layout.placements.filter(p => p.modified).length;
    if (totalCabs > 0 && modifiedCabs / totalCabs > WIDTH_MOD_RULES.noCostThreshold) {
      issues.push({
        rule: "Eclipse-Width-Mod-Limit",
        severity: "warning",
        message: `${modifiedCabs} of ${totalCabs} cabinets (${Math.round(modifiedCabs/totalCabs*100)}%) are width-modified — exceeds 30% N/C limit. ${modifiedCabs - Math.floor(totalCabs * 0.3)} cabs will incur 30% upcharge.`,
      });
    }
  }

  // 7. ADA compliance checks
  if (isADACompliant && roomConfig.nkbaLandingApplies) {
    // Counter height check
    if (layout.counterHeight && layout.counterHeight > ADA_RULES.counterHeightMax) {
      issues.push({
        rule: "ADA-Counter-Height",
        severity: "error",
        message: `Counter height ${layout.counterHeight}" > ${ADA_RULES.counterHeightMax}" ADA maximum (standard 36")`
      });
    }

    // Upper cabinet bottom height
    if (layout.upperCabBottomHeight && layout.upperCabBottomHeight > ADA_RULES.upperCabBottomMax) {
      issues.push({
        rule: "ADA-Upper-Cab-Height",
        severity: "error",
        message: `Upper cabinet bottom ${layout.upperCabBottomHeight}" > ${ADA_RULES.upperCabBottomMax}" ADA maximum (standard 54")`
      });
    }

    // Check for sink knee clearance requirements
    const sink = findAppliance(layout.appliances, 'sink');
    if (sink) {
      if (!layout.sinkKneeClearance || layout.sinkKneeClearance.height < ADA_RULES.kneeHeight) {
        issues.push({
          rule: "ADA-Sink-Knee-Clearance",
          severity: "warning",
          message: `Sink knee clearance height < ${ADA_RULES.kneeHeight}" (required: ${ADA_RULES.kneeHeight}"H × ${ADA_RULES.kneeWidth}"W × ${ADA_RULES.kneeDepth}"D)`
        });
      }
    }

    // Walkway clearance for ADA (minimum 42")
    if (layout.walkwayClearance && layout.walkwayClearance < ADA_RULES.walkwayMin) {
      issues.push({
        rule: "ADA-Walkway-Min",
        severity: "error",
        message: `Walkway clearance ${layout.walkwayClearance}" < ${ADA_RULES.walkwayMin}" ADA minimum`
      });
    }

    // Lever/loop handle preference
    if (layout.handleType === 'knob') {
      issues.push({
        rule: "ADA-Handle-Type",
        severity: "warning",
        message: `Lever/loop handles recommended for ADA compliance (knob handles specified)`
      });
    }

    // Pull-out/roll-out storage preference
    if (layout.storageType === 'fixed-shelves') {
      issues.push({
        rule: "ADA-Storage-Type",
        severity: "warning",
        message: `Pull-out/roll-out storage preferred for ADA compliance (fixed shelves used)`
      });
    }

    // Toe kick check
    if (layout.toeKickHeight && layout.toeKickHeight < ADA_RULES.toeKickHeight) {
      issues.push({
        rule: "ADA-Toe-Kick",
        severity: "warning",
        message: `Toe kick height ${layout.toeKickHeight}" < ${ADA_RULES.toeKickHeight}" ADA recommended (standard 4.5")`
      });
    }
  }

  return issues;
}
