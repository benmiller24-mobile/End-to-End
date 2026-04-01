/**
 * Eclipse Kitchen Designer — Constraint Engine
 * ==============================================
 * NKBA guidelines + Eclipse catalog rules codified as deterministic constraints.
 * These are enforced DURING layout generation (Layer 1).
 *
 * Sources:
 *   - NKBA Kitchen Planning Guidelines (31 rules)
 *   - Eclipse v8.8.0 catalog physical specs (cabinetKnowledgeBase.json)
 *   - 44 training projects across kitchens, offices, laundry, bathrooms, bars, powder rooms, and utility rooms
 *
 * Catalogs represented:
 *   ECL8_8A_1, ECL8_8B_1, ECL8_8D_1, ECL8_6A_1, ECL8_6B_1,
 *   ECL8_4A_1, ECL8_4B_1, ECL24_1, ECL24A_1, ECL24B_1, ECL24-C_1,
 *   ECGO24-A_1 (Gola/Handleless Channel)
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
    specialCabinets: ["FD2HD", "VB3D", "LD"],
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
    specialCabinets: ["FLVSB", "BC"],
    trainingOccurrences: ["McCarter Master Bath (2× FLVSB4221 floating vanities + BC3341 columns)"],
    note: "Master bathroom floating vanities with custom columns and finished tops.",
  },
  vanity: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 36,     // vanity tall height
    defaultBaseDepth: 21.75,
    specialCabinets: ["UV", "VTSB", "VTSB3D"],
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
  primary_bath: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 21,
    specialCabinets: ["VTSB", "VTB3D", "FBEP", "LD"],
    trainingOccurrences: ["Diehl Primary Bath (FBEP + VTB3D15 + VTSB30 + VTB3D15 + FBEP symmetric vanity + LD33 lap drawer)"],
    note: "Primary/ensuite bathroom — larger vanity run with symmetric flanking and lap drawer.",
  },
  main_bath: {
    appliancesRequired: false,
    workTriangleApplies: false,
    nkbaLandingApplies: false,
    defaultBaseHeight: 34.5,
    defaultBaseDepth: 21,
    specialCabinets: ["VTSB", "VTB3D"],
    trainingOccurrences: ["Diehl Main Bath (VTSB27 + VTB3D12 simple vanity + OVF filler)"],
    note: "Main/hall bathroom — simpler vanity configuration than primary bath.",
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
  upperBottom: 54,          // counter(36) + backsplash(18) — minimum 18" clearance
  // Molding adjustments: light rail adds ~1.75", decorative trim adds ~1–2".
  // When molding is present, raise uppers by the molding thickness to maintain
  // a full 18" of usable clearance below the molding bottom.
  lightRailThickness: 1.75,   // standard light rail drop
  crownMouldDrop: 3.5,        // crown overhang below cabinet top
  // Open shelving: go slightly higher than 18" (countertop appliances that open
  // from top need more clearance) — 20" recommended.
  openShelfBottom: 56,        // counter(36) + 20"
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
// All cabinet types discovered across 44 training projects

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
  RTB:    { category: "base", description: "Range top base (lower height for cooktop)", widths: [36], depths: [24], heights: [28.5], trainingOccurrences: ["Kamisar (RTB36)"] },

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
  LD:     { category: "office", description: "Lap drawer (keyboard/pencil tray)", widths: [33, 36], heights: [6], trainingOccurrences: ["Bissegger Office (LD36)", "Diehl Pri Bath (LD33 spanning vanity)"] },
  VB3D:   { category: "office", description: "Vanity 3-drawer base (desk pedestal)", widths: [18], heights: [30.5], trainingOccurrences: ["Bissegger Office (VB3D18)"] },

  // ── Vanity/Bathroom cabinets ──
  FLVSB:  { category: "vanity", description: "Floating vanity sink base (wall-mounted)", heights: [21], depths: [21], widths: [42], trainingOccurrences: ["McCarter Master Bath (FLVSB4221)"] },
  VTSB:   { category: "vanity", description: "Vanity tall sink base", heights: [36], depths: [21.75], widths: [27, 30, 36], trainingOccurrences: ["Cost Plus (VTSB36)", "Diehl Main Bath (VTSB27)", "Diehl Pri Bath (VTSB30)"] },
  VTSB3D: { category: "vanity", description: "Vanity tall 3-drawer sink base", heights: [36], depths: [21.75], trainingOccurrences: ["Cost Plus (VTSB3D36)"] },
  VTB3D:  { category: "vanity", description: "Vanity tall 3-drawer base", heights: [36], depths: [21.75], widths: [12, 15], trainingOccurrences: ["Diehl Main Bath (VTB3D12)", "Diehl Pri Bath (VTB3D15)"] },
  UV:     { category: "vanity", description: "Utility vanity (tall)", heights: [96], depths: [21.75], widths: [18], trainingOccurrences: ["Cost Plus (UV1896L/R)"] },

  // ── Wall cabinets ──
  W:      { category: "wall", description: "Standard wall cabinet", depths: [12, 13] },
  WND:    { category: "wall", description: "Wall no-door cabinet (open)", trainingOccurrences: ["Showroom ECLD (WND2112)", "McComb (WND2439)"] },
  WGD:    { category: "wall", description: "Wall cabinet with appliance garage doors", heights: [54], depths: [18], trainingOccurrences: ["Dolfin Isle (WGD2454)"] },
  WPD:    { category: "wall", description: "Wall pocket door cabinet", trainingOccurrences: ["Kamisar (WPD3657|18 — first pocket door wall cab)"] },
  WGPD:   { category: "wall", description: "Wall garage with pocket doors", heights: [72], depths: [16], trainingOccurrences: ["Bissegger Great Room (WGPD4272|16 ×2 with contour arch doors)"] },
  // ── Hutch-style cabinets (sit on countertop) ──
  "WPD-H": { category: "hutch", description: "Pocket door hutch cabinet — sits on countertop, furniture-like feel", depths: [13, 16, 18], heights: [36, 39, 42, 48], note: "Uses PKD pocket door hardware. Doors retract fully to keep countertop usable." },
  "W-H":   { category: "hutch", description: "Standard door hutch cabinet — sits on countertop", depths: [13, 16], heights: [36, 39, 42, 48], note: "Traditional hutch look with standard doors. Good for open display with occasional closure." },
  "WGD-H": { category: "hutch", description: "Appliance garage hutch — sits on countertop, conceals appliances", depths: [16, 18], heights: [24, 30], note: "Shorter hutch for coffee station/toaster oven areas. Standard or pocket doors." },
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
  BEP:    { category: "panel", description: "Base end panel", variants: ["BEP1.5", "BEP3", "BEP1 1/2-FTK-L", "BEP1 1/2-FTK-R", "BEP3-FTK-L", "BEP3-FTK-R"], trainingOccurrences: ["Diehl Pri Bath (BEP1 1/2-FTK-L/R with flush toe kick)"] },
  EDGTL:  { category: "panel", description: "Edge-banded panel large (3 edges, waterfall)" },
  EDGTS:  { category: "panel", description: "Edge-banded panel small horizontal" },
  EDGT:   { category: "panel", description: "Edge-banded panel countertop/shelf edge" },
  FPS:    { category: "panel", description: "Finish panel small (vertical)" },
  "BB-CMP":{ category: "panel", description: "Component bar back", trainingOccurrences: ["Dolfin Isle (BB1/2-CMP)"] },
  FLS:    { category: "shelf", description: "Floating shelf", depths: [8, 13], heights: [3], trainingOccurrences: ["Dolfin Isle (FLS|21|3|13)", "Firebird (FLS|17|3|13, FLS|24|3|13)", "Bissegger (FLS|80.75|3|13 ×3 widest, FLS|84|3|8 bar, FLS|53.75|3|13 kitchen)"] },
  REF:    { category: "panel", description: "Large RF wall door panel (appliance panel)", heights: [79.875], trainingOccurrences: ["Bissegger Great Room (REF 35.5625×79.875 at $3,550.69 each)"] },
  "LD-STD":{ category: "panel", description: "Loose standard base door (shipped separately)", trainingOccurrences: ["Gable Kitchen (LD-STD above butler's pantry)", "Alix (LD-STD island back)"] },
  "BB-HTFD":{ category: "panel", description: "Hartford bar back panel", trainingOccurrences: ["Bollini (BBHTFD 52.5×34.5 ×2 + 30.125×34.5 ×2)"] },
  "BB-SCDL":{ category: "panel", description: "Scottsdale bar back panel", trainingOccurrences: ["McComb (BBSCDL|48|34.5)"] },

  // ── Gola/Handleless Channel cabinets (FC- prefix, ECGO24 catalog) ──
  // All FC- types mirror standard frameless types but with integrated Gola channel (no handles/knobs)
  "FC-B2TD":  { category: "base", description: "Gola 2-tiered drawer base", depths: [24], heights: [34.5], widths: [12, 15, 18, 21, 24, 27, 30, 33, 36, 42], golaChannel: true, trainingOccurrences: ["OC Design (FC-B2TD21, FC-B2TD24, FC-B2TD36)", "Carolyn's (FC-B2TD15, FC-B2TD18, FC-B2TD21, FC-B2TD24, FC-B2TD30, FC-B2TD36)"] },
  "FC-TUEP":  { category: "panel", description: "Gola tall utility end panel", golaChannel: true, trainingOccurrences: ["Carolyn's (FC-TUEP3/4 96FTK-24L/R)"] },
  "FC-U2D":   { category: "tall", description: "Gola utility 2-door tall", depths: [24, 27], heights: [84, 90, 96], golaChannel: true, trainingOccurrences: ["Carolyn's (FC-U2D2496-27)"] },
  "FC-O30":   { category: "tall", description: "Gola oven tower 30\" wide", heights: [84, 93, 96], golaChannel: true, trainingOccurrences: ["OC Design (FC-O3084)", "Carolyn's (FC-O3096)"] },
  "FC-SB":    { category: "base", description: "Gola sink base", depths: [24], heights: [34.5], golaChannel: true, trainingOccurrences: ["Carolyn's (FC-SB36)"] },
  "FC-SB-FHD":{ category: "base", description: "Gola sink base full-height door", depths: [24], heights: [34.5], golaChannel: true, trainingOccurrences: ["OC Design (FC-SB42-FHD)"] },
  "FC-BWDMB": { category: "base", description: "Gola waste cabinet door-mounted", widths: [18], golaChannel: true, trainingOccurrences: ["Carolyn's (FC-BWDMB18)"] },
  "FC-SBEP":  { category: "panel", description: "Gola sink base end panel", golaChannel: true, trainingOccurrences: ["Carolyn's (FC-SBEP3/4 34.5FTK-24L/R)"] },
  "FC-DBEP":  { category: "panel", description: "Gola decorative base end panel", golaChannel: true, trainingOccurrences: ["Carolyn's (FC-DBEP3/4 34.5FTK-24)"] },
  "FC-B42-FHD":{ category: "base", description: "Gola base 42\" full-height door (island back)", depths: [13, 24], heights: [34.5], golaChannel: true, trainingOccurrences: ["OC Design (FC-B42-FHD back panels)"] },
  "FC-B3D":   { category: "base", description: "Gola 3-drawer base", depths: [24], heights: [34.5], golaChannel: true, trainingOccurrences: ["OC Design (FC-B3D30 ×3 seating island)"] },
  "FC-B-FHD": { category: "base", description: "Gola base full-height door", depths: [13, 24], heights: [34.5], golaChannel: true, trainingOccurrences: ["OC Design (FC-B24L-FHD, FC-B21L/R-FHD, FC-B30-FHD)"] },
  "FC-W":     { category: "wall", description: "Gola wall cabinet", depths: [12, 13], golaChannel: true },
  "FC-RW":    { category: "wall", description: "Gola refrigerator wall cabinet", golaChannel: true },
  "FC-FREP":  { category: "panel", description: "Gola full-depth refrigerator end panel", golaChannel: true },

  // ── 2-Tiered Drawer bases (non-Gola) ──
  B2TD:    { category: "base", description: "2-tiered drawer base (2 rows of drawers)", depths: [24], heights: [34.5], widths: [12, 15, 18, 21, 24, 27, 30, 33, 36, 42], trainingOccurrences: ["Willis (B2TD15, B2TD18, B2TD21, B2TD24, B2TD30)"] },

  // ── Specialty cabinets from recent training ──
  UPOP:    { category: "tall", description: "Pull-out pantry rack (chrome wire slides)", widths: [12, 15, 18], depths: [24], heights: [84, 90, 96], trainingOccurrences: ["Carolyn's (FC-UPOP1296-27 — pull-out pantry in Gola variant)"] },
  MRDBD:   { category: "base", description: "Mud room bench drawer base", widths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36], depths: [24], heights: [20], trainingOccurrences: ["Levensohn (MRDBD — mud room bench entries)"] },
  WHWRC:   { category: "wall", description: "Wine rack cubbies (X-pattern)", widths: [12, 18, 24, 36, 48], depths: [12, 13], trainingOccurrences: ["Levensohn (WHWRC — wine rack cubbies)"] },
  DP:      { category: "panel", description: "Dishwasher door panel (matches cabinet fronts)", widths: [24], heights: [34.5], trainingOccurrences: ["Carolyn's (DP — dishwasher panel)", "Willis (DP — dishwasher panel)"] },
  "BL36-SS-PH": { category: "corner", description: "Lazy susan with Super Susan shelves", sizes: [36], trainingOccurrences: ["Alix (BL36-SS-PH-L/R ×2)", "Lofton (BL36-SS-PH-L)", "Sabelhaus (BL36-SS-PH-L)"] },
  FREP34:  { category: "panel", description: "Full-depth refrigerator end panel 3/4\" thick", trainingOccurrences: ["Willis (FREP3/4 96FTK-27L)", "Imai Robin (FREP3/4)"] },
};


// ─── NKBA LANDING AREA RULES ────────────────────────────────────────────────
// Enforced during appliance placement — no layout can violate these

export const LANDING = {
  // NKBA Kitchen Planning Guidelines (2023 edition)
  sink:   { primary: 24, secondary: 18, note: "24\" on one side, 18\" on other" },
  range:  { oneSide: 12, otherSide: 15, note: "12\" one side, 15\" other (asymmetric)" },
  // Keep legacy `eachSide` for any code still referencing it — set to the smaller minimum
  get rangeEachSide() { return this.range.oneSide; },
  fridge: { handleSide: 15, note: "15\" counter on handle side" },
  oven:   { nearest: 15, maxDistance: 48, note: "15\" adjacent or within 48\" on a counter" },
  micro:  { nearest: 15, note: "15\" above, below, or adjacent" },
  dw:     { maxDistFromSink: 36, standingSpace: 21, note: "Within 36\" of nearest sink edge, 21\" standing space" },
  prep:   { width: 36, depth: 24, note: "Continuous 36\"×24\" prep area adjacent to sink" },
  behindCooktop: { min: 9, note: "9\" behind cooking surface if on island/peninsula" },
};


// ─── CLEARANCE RULES ────────────────────────────────────────────────────────

export const CLEARANCE = {
  // Walkway between two lines of cabinets
  walkwayAbsoluteMin: 36,       // absolute minimum per code
  walkwayMin: 42,               // NKBA recommended minimum (1 cook)
  walkwayRecommended: 48,       // preferred for good flow
  walkwayMax: 50,               // avoid overly roomy walkways (> 50" feels disconnected)
  twoCookMin: 48,               // minimum for 2 cooks
  // Island seating clearance
  seatingMin: 48,               // minimum behind chairs for pull-out
  seatingComfortable: 52,       // comfortable passage behind seated diners
  // Fridge-behind-seating: extra clearance so open fridge door doesn't
  // collide with people pulling out chairs
  fridgeBehindSeating: 56,      // 52" comfort + 4" for door swing
  // Door clearance
  doorClearance: 32,            // entry doorway minimum
  // Counter-to-upper minimum
  counterToUpperMin: 18,        // minimum usable clearance (not including molding)
  lazysusan: { interiorDoor: 36, minDoorway: 30.5 },
};


// ─── WORK TRIANGLE ──────────────────────────────────────────────────────────

export const TRIANGLE = {
  totalMin: 156,   // 13 feet in inches (NKBA: total ≥ 12ft, we use 13ft conservative)
  totalMax: 312,   // 26 feet
  legMin: 48,      // 4 feet min single leg
  legMax: 108,     // 9 feet max single leg
  islandIntersectMax: 12, // work triangle leg can't cross island/peninsula by > 12"
};


// ─── APPLIANCE PLACEMENT PRIORITY ("BIG FOUR" RULE) ───────────────────────
// "Position the Big Four first: cooktop, oven, dishwasher, fridge-freezer, and sink."
// These anchor the kitchen layout — everything else fills around them.
// Lower number = placed first. Appliances placed earlier claim their zone
// (including landing area padding) so later appliances route around them.
//
// Placement strategy per tier:
//   Tier 0 — Range/cooktop: visual center of cooking wall, NKBA 12"/15" asymmetric landings
//   Tier 1 — Refrigerator/freezer/column: wall-end terminal, 15" handle-side landing
//   Tier 2 — Sink: under window if available, or work-triangle-optimized offset from range
//   Tier 3 — Wall oven/speed oven/steam oven: tall tower position, typically near fridge column
//   Tier 4 — Dishwasher: MUST be within 36" of sink (NKBA), always placed after sink
//   Tier 5 — Specialty undercounter (wine cooler, beverage center, ice maker, warming drawer)
//   Tier 6 — Hood: above cooktop (no floor footprint, placed in upper pass)

export const BIG_FOUR = {
  // Placement priority (lower = placed first, claims zone first)
  priority: {
    range: 0, cooktop: 0,
    refrigerator: 1, freezer: 1, wineColumn: 1,
    sink: 2,
    wallOven: 3, speedOven: 3, steamOven: 3,
    dishwasher: 4,
    wineCooler: 5, beverageCenter: 5, iceMaker: 5, warmingDrawer: 5,
    microwave: 5,
    hood: 6,
  },

  // Placement rules per appliance type
  rules: {
    range:        { strategy: "center_biased", triangleBias: 0.6, landingSides: "asymmetric" },
    cooktop:      { strategy: "center_biased", triangleBias: 0.6, landingSides: "asymmetric" },
    refrigerator: { strategy: "wall_end",      preferEnd: "right", landingSide: "handle" },
    freezer:      { strategy: "wall_end",      preferEnd: "right", landingSide: "handle" },
    sink:         { strategy: "under_window",  fallback: "triangle_optimized", adjacentDW: true },
    dishwasher:   { strategy: "adjacent_sink", maxDistance: 36, preferSide: "left" },
    wallOven:     { strategy: "tower_cluster",  nearFridge: true },
    speedOven:    { strategy: "tower_cluster",  nearFridge: true },
    steamOven:    { strategy: "tower_cluster",  nearFridge: true },
  },

  // Standard appliance depths (inches, front face to wall)
  // Eclipse default: counter-depth fridges (24" body, 27" planning depth with door/handle)
  // Range depths vary by brand — use brand-specific depths when model is known
  depths: {
    range: 28, cooktop: 22, refrigerator: 27, freezer: 24,
    dishwasher: 24, sink: 22, wallOven: 24, speedOven: 24,
    steamOven: 24, microwave: 18, hood: 22, wineCooler: 24,
    wineColumn: 24, beverageCenter: 24, warmingDrawer: 24, iceMaker: 24,
  },
  // Brand-specific range depths (body, excl handles) — from Eclipse Appliance Specs
  rangeDepthByBrand: {
    wolf: 28.5,           // 28.25-29.5" depending on model
    thermador: 24.75,     // Pro Harmony ~24.63" (nearly flush with cabinets!)
    kitchenaid: 27.75,
    fisherPaykel: 28,
    miele: 27.5,
  },
  // Fridge planning depth: 27" for counter-depth, 25" for fully integrated panel-ready
  fridgePlanningDepth: { counterDepth: 27, integrated: 25 },
  // Built-in fridge height: 84" (Sub-Zero, Thermador, F&P, Miele)
  // Freestanding counter-depth: 70" (KitchenAid) — needs soffit/cabinet above
  fridgeHeight: { builtIn: 84, freestanding: 70 },
};


// ─── TRAFFIC FLOW RULES ────────────────────────────────────────────────────
// Door/window-aware traffic flow protection (RoomSketcher-inspired)

export const TRAFFIC_FLOW = {
  // Door clearance: no cabinet or island should block a doorway
  doorSwingClearance: 36,         // 36" clear in front of any door swing
  doorTrafficLane: 36,            // 36" wide traffic lane from door into kitchen
  // Island must not block primary entry paths
  islandDoorMinDistance: 42,      // island edge ≥ 42" from door opening
  // Work triangle should not cross primary traffic lane
  triangleCrossTrafficPenalty: "warning", // severity if triangle leg crosses door-to-door path
  // Window-above-sink preference (traditional design)
  sinkPreferWindow: true,         // prefer placing sink under window if available
  // Appliance door swing zones — don't block traffic
  fridgeDoorSwing: 36,            // 36" clear for fridge door opening
  ovenDoorSwing: 36,              // 36" clear for oven door drop-down
  dwDoorSwing: 24,                // 24" clear for dishwasher door
  // Entry points: doors define traffic paths through the kitchen
  // The solver should ensure main circulation routes stay clear
  minCirculationWidth: 36,        // minimum passage width anywhere in kitchen
};


// ─── CORNER TREATMENT RULES ─────────────────────────────────────────────────
// Extracted from 44 training projects

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
    required: true,             // EVERY kitchen must have a trash pull-out
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
    trainingNote: "Every kitchen project must include a waste cabinet. Always within 2 positions of sink.",
    // Placement durability guidance: trash pull-outs are high-use items that
    // cause wear on cabinet doors/slides. Place in durable, accessible locations:
    //   1. Best: drawer-base waste cab (BWDMA/BWDMB) — metal slides rated for heavy use
    //   2. Good: door-mounted waste (BWDMW) — wood hinges, less durable long-term
    //   3. Avoid: corner cabinets or hard-to-reach spots — waste needs easy one-hand access
    durabilityPreference: ["BWDMA", "BWDMB", "BWDMW"],  // best → acceptable
    avoidCornerPlacement: true,    // never put waste in a corner cabinet
    maxReachFromWorkZone: 48,      // trash should be within 48" of primary prep/sink zone
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

  // ── Moldings & Fillers in Frameless Kitchen Design Guide ──────────────────
  // Golden Rule: In frameless cabinetry, NEVER let a cabinet box touch a wall
  // at a drawer or door edge. Min 3" filler next to any wall where a drawer/door opens.

  // Filler Reference Table (from guide Section 2)
  fillerTypes: {
    wallFiller: {
      location: "Cabinet to wall (upper or lower)",
      widthRange: [1, 6],  // 1" to 6"+
      purpose: "Closes gap, provides drawer/hinge clearance, hides out-of-plumb wall",
      minWidth: 3, // minimum 3" where drawer/door opens
    },
    baseFiller: {
      location: "Lower cabinet to wall",
      widthRange: [1, 6],
      purpose: "Same as wall filler but at base cabinet height, includes toe kick",
      minWidth: 3,
      includesToeKick: true,
    },
    applianceFiller: {
      location: "Cabinet to refrigerator or dishwasher",
      widthRange: [1, 3],
      purpose: "Creates finished look between appliance and adjacent cabinet",
    },
    tallPantryFiller: {
      location: "Tall cabinet to wall or adjacent cabinet",
      widthRange: [1, 6],
      purpose: "Full-height filler running floor to ceiling or soffit",
    },
    blindCornerFiller: {
      location: "Adjacent to blind corner cabinet",
      widthRange: [3, 6],
      purpose: "Gives blind door or drawer clearance to fully open",
      rule: "If blind cabinet blinds 6\" into corner, adjacent run needs at least 3\" filler",
    },
    scribeMolding: {
      location: "Any cabinet-to-wall junction",
      widthRange: [0.25, 1.5], // ¼" to 1½"
      purpose: "Follows wall contour, covers final micro-gaps after install",
      note: "Cut and fit in field by installer — specify enough footage",
    },
  },

  // Filler finish must match adjacent cabinet
  fillerFinishRule: "Fillers must be ordered in the SAME finish and material as the adjacent door or panel. Non-negotiable in frameless.",
};

// ─── MOLDING RULES ──────────────────────────────────────────────────────────
// From: Moldings & Fillers in Frameless Kitchen Design guide (Section 3)

export const MOLDING_RULES = {
  // ── Crown Molding ──
  // Location: Top of upper cabinets, transitioning to ceiling or soffit
  // Frameless: simpler profiles (flat-face, minimal cove, square-edged)
  crown: {
    // User-selectable ceiling treatment approach:
    //   "crown"      — Standard crown molding bridges gap between cabinet top and ceiling
    //   "to_ceiling" — Cabinets extend to ceiling (no gap, no crown needed)
    //   "none"       — No crown, exposed cabinet top (modern/minimal look)
    ceilingApproach: {
      crown: {
        description: "Crown molding bridges gap between upper cabinet top and ceiling",
        gapRanges: {
          under2: { approach: "flat_top_panel_plus_scribe", note: "Flat top panel + small scribe molding for gaps < 2\"" },
          twoToFive: { approach: "standard_crown", note: "Standard crown profile for 2-5\" gaps" },
          fiveToTwelve: { approach: "tall_crown_or_stacking", note: "Tall crown or stacking molding for 5-12\" gaps" },
          overTwelve: { approach: "stacking_box", note: "Stacking boxes (decorative open-front boxes above uppers) + own crown for gaps > 12\"" },
        },
      },
      to_ceiling: {
        description: "Upper cabinets sized to reach ceiling — no crown needed",
        note: "Select upper cabinet heights so top edge meets ceiling. May need flat filler strip at ceiling junction to absorb out-of-level ceiling.",
      },
      none: {
        description: "No crown molding — exposed cabinet top for modern/minimal aesthetic",
        note: "Acceptable in European frameless aesthetic. Cabinet tops must be finished.",
      },
    },
    // Style matching (from guide Section 3 — Molding Style Guidance)
    styleMatching: {
      flatPanel: "simple_crown",       // Flat-panel or shaker door → square-edged or minimal cove
      shaker: "simple_crown",
      routedDetailed: "complex_crown", // Routed/detailed door → more complex profile
      europeanFrameless: "minimal",    // European frameless → always err toward restraint
    },
    orderingRule: "Order by linear foot, not by piece. Add 15-20% for miter waste.",
    stickLengths: [96, 120], // 8' and 10' typical
  },

  // ── Light Rail Molding ──
  // Location: Bottom face of upper cabinets (also called bottom molding or valance)
  lightRail: {
    purpose: "Conceals under-cabinet lighting strips and wiring; provides visual base for upper run",
    requiredWhen: "Any time under-cabinet lighting is specified — even without lighting, it's a strong finishing detail",
    placement: {
      runsAcross: "Bottom of all upper cabinets in a continuous run",
      doesNotRunInFrontOf: ["range_hood", "microwave", "other_appliances"],
      terminatesCleanly: "Just before each appliance opening",
    },
    profiles: {
      simple: "LR-SQ",    // square/flat profile
      cove: "LR-COVE",    // minimal cove
      ogee: "LR-OGEE",    // traditional ogee (rare in frameless)
    },
    thickness: 1.75, // standard light rail drop in inches
  },

  // ── Toe Kick ──
  // Location: Base of all lower cabinets — the recessed plinth
  toeKick: {
    standardHeight: 4,       // 4" per guide (frameless standard)
    standardDepth: [3, 3.5], // 3" to 3½"
    insideCorners: "miter",  // Must be mitered at inside corners
    outsideCorners: "cope_or_butt", // Must be coped or butted at outside corners
    exposedEnds: "finished_return", // Every exposed end requires a mitered return or factory end cap
    neverRule: "Never leave a raw toe kick end visible",
    separatePanel: true, // In frameless, toe kick is a separate applied panel (not part of box)
  },

  // ── Scribe Molding ──
  // Location: Final junction between cabinet (or filler) and wall
  scribe: {
    typicalThickness: [0.25, 0.5], // ¼" to ½"
    purpose: "Follows wall contour, covers small gaps after install",
    finishRule: "Always specify in same finish as adjacent cabinet",
    installNote: "Cut and fit in field by installer — you specify it and ensure enough footage is ordered",
    useWhen: "At any visible wall junction, especially on exposed end panels",
  },

  // ── Stacking Boxes / Tall Valance ──
  // Location: Above upper cabinets when ceiling gap is too large for crown
  stackingBoxes: {
    trigger: "Ceiling gap exceeds what crown molding can bridge (typically > 12\")",
    description: "Open-front decorative boxes in same finish as cabinet, fill volume above uppers",
    toppedWith: "Their own crown molding",
    alternative: "tall_decorative_valance", // some manufacturers offer this
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

  recessedBottomShelf: {
    code: "RBS",
    description: "Recessed bottom shelf — moves bottom shelf up for display/lighting space",
    trainingOccurrences: ["Gable Kitchen (5 painted wall cabs)", "Multiple projects with glass door display walls"],
  },
  shallowDepth13: {
    code: "13\" DEPTH OPTION",
    description: "Modify base cabinet to 13\" depth — seating-side island FHDs",
    trainingOccurrences: ["Imai Robin (4× B33-FHD at 13\")"],
  },
};


// ─── CONSTRUCTION TYPES ─────────────────────────────────────────────────────
// Discovered across 44 training projects

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


// ─── CATALOG PREFIXES ──────────────────────────────────────────────────────
// All catalog versions encountered across 44 training projects

export const CATALOG_PREFIXES = {
  // Eclipse catalogs (standard overlay construction)
  ECL8_8A_1:  { brand: "Eclipse", series: "8.8", variant: "A", construction: "standard" },
  ECL8_8B_1:  { brand: "Eclipse", series: "8.8", variant: "B", construction: "standard" },
  ECL8_8D_1:  { brand: "Eclipse", series: "8.8", variant: "D", construction: "standard" },
  ECL8_6A_1:  { brand: "Eclipse", series: "8.6", variant: "A", construction: "standard" },
  ECL8_6B_1:  { brand: "Eclipse", series: "8.6", variant: "B", construction: "standard" },
  ECL8_4A_1:  { brand: "Eclipse", series: "8.4", variant: "A", construction: "standard" },
  ECL8_4B_1:  { brand: "Eclipse", series: "8.4", variant: "B", construction: "standard" },
  ECL24_1:    { brand: "Eclipse", series: "24",  variant: "base", construction: "standard" },
  ECL24A_1:   { brand: "Eclipse", series: "24",  variant: "A", construction: "standard" },
  ECL24B_1:   { brand: "Eclipse", series: "24",  variant: "B", construction: "standard" },
  "ECL24-C_1":{ brand: "Eclipse", series: "24",  variant: "C", construction: "standard" },
  ECL23J_1:   { brand: "Eclipse", series: "23",  variant: "J", construction: "standard", trainingOccurrences: ["WRS Beatty Kitchen"] },

};


// ─── EDGE PROFILES ─────────────────────────────────────────────────────────

export const EDGE_PROFILES = {
  standard: {
    code: "150",
    name: "Standard Edge",
    applicableTo: ["standard", "plywood", "plywoodPartial", "mixed"],
    note: "Default edge profile for overlay construction cabinets.",
  },
};


// ─── HINGE TYPES ───────────────────────────────────────────────────────────

export const HINGE_TYPES = {
  standard: {
    name: "Standard Overlay",
    constructionTypes: ["standard", "plywood", "plywoodPartial", "mixed"],
    drawerGuide: "Blum Edge Guide",
    note: "Default hinge for overlay construction.",
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
    // ── Range Hood Mounting Height (from Range Hood Design Guide) ──
    // Measured from cooking surface (burner grate top) to bottom of hood.
    // Cooking surface AFF: 36" (standard 36" counter height for residential ranges).
    mountingHeight: {
      standard: {
        min: 24,       // 24" above cooking surface → 60" AFF
        max: 30,       // 30" above cooking surface → 66" AFF
        optimal: 24,   // optimal clearance for standard residential
        description: "Standard residential range (≤75k BTU)",
      },
      pro: {
        min: 27,       // 27" above cooking surface → 63" AFF
        max: 36,       // 36" above cooking surface → 72" AFF
        optimal: 30,   // optimal for high-BTU pro ranges
        description: "Pro/commercial-style range (>75k BTU)",
      },
      electric: {
        min: 20,       // 20" above cooking surface → 56" AFF
        max: 30,       // 30" above cooking surface → 66" AFF
        optimal: 24,
        description: "Electric/induction cooktop (lower heat output)",
      },
      cookingSurfaceAFF: 36,  // standard counter height = cooking surface reference
    },
    // ── Hood Width Sizing (from Range Hood Design Guide) ──
    // Minimum = range width; recommended = range width + 6" (3" per side)
    // Pro ranges: size up aggressively
    widthSizing: {
      24: { min: 24, recommended: 30 },
      30: { min: 30, recommended: 36 },
      36: { min: 36, recommended: 42 },
      48: { min: 48, recommended: 54 },
      60: { min: 60, recommended: 66 },
      pro36: { min: 42, recommended: 48, note: "Pro 36\" → 42\" min, ideally 48\"" },
      pro48: { min: 54, recommended: 60, note: "Pro 48\" → 54\" min, ideally 60\"" },
    },
    // ── CFM Sizing (from Range Hood Design Guide) ──
    // Standard: 1 CFM per 100 BTU, or 100 CFM per linear foot of hood width
    // Makeup air required at 400+ CFM
    cfmSizing: {
      30: { standard: 300, pro: [500, 600] },
      36: { standard: 360, pro: [600, 900] },
      42: { standard: 420, pro: [900, 1200] },
      48: { standard: 480, pro: [1000, 1500] },
      makeupAirThreshold: 400,
    },
    // ── Duct Sizing (from Range Hood Design Guide) ──
    ductSizing: {
      upTo400: { round: 6, description: "Up to 400 CFM → 6\" round" },
      upTo600: { round: [7, 8], description: "400-600 CFM → 7-8\" round" },
      upTo900: { round: [8, 10], description: "600-900 CFM → 8-10\" round" },
      upTo1200: { round: [10, 12], description: "900-1200 CFM → 10-12\" round" },
    },
    // ── Hood Body Heights ──
    bodyHeight: {
      standard: 24,   // typical 24" body for wall-mount chimney
      large: 42,      // large RH50 model
      underCabinet: 8, // limited clearance
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
  // ── Island dimension constraints ──
  // "One Slab" rule: keep island within a single countertop slab (~65" × 128")
  oneSlabMaxWidth: 65,          // max short dimension for single slab
  oneSlabMaxLength: 128,        // max long dimension for single slab
  // Depth guidelines (including countertop overhang)
  standardDepth: 39,            // 24" base + 12" overhang + 3" countertop edge
  deepIslandDepth: 50,          // with back-to-back cabinets (24+24+2" gap)
  // ── Seating overhang & spacing ──
  overhangMin: 12,              // minimum overhang for knee clearance
  overhangIdeal: 15,            // ideal for taller stools / comfort
  widthPerAdult: 24,            // inches per adult seat
  widthPerChild: 20,            // inches per child seat
  seatingSide: {
    depth: 13.875,
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
  // Peninsula as fallback: when room can't provide 4-sided island clearance,
  // a peninsula attaches one end to a wall or cabinet run, needing only 3-sided
  // clearance. Solver should suggest peninsula when island clearance fails.
  fallbackForIsland: true,
  minClearance3Sided: 36,       // only 3 sides need clearance (vs 4 for island)
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


// ─── HUTCH RULES ───────────────────────────────────────────────────────────
// Hutch-style cabinetry sits upper cabinets directly on countertop surface
// for a permanent, furniture-like feel. Popular with pocket door hardware.

export const HUTCH_RULES = {
  // Hutch sits on counter — NO backsplash gap (counter-to-upper clearance = 0)
  counterGap: 0,
  // Standard hutch depths (shallower than base to avoid visual heaviness)
  depths: {
    standard: 13,        // most common: shallow enough for furniture look
    deep: 16,            // for appliance garages (toaster oven, mixer, coffee)
    applianceGarage: 18, // matches WGD depth for concealed large appliances
  },
  // Height selection: hutch fills counter-to-ceiling minus crown space
  // Heights depend on ceiling: h = ceiling - 36" counter - crown
  heightOptions: [36, 39, 42, 48],
  // ── Door styles ──
  doorStyles: {
    pocketDoor: {
      skuPrefix: "WPD-H",
      hardware: "PKD",
      hardwareCost: 85,     // per item from pricing.js
      description: "Pocket doors retract fully into cabinet — countertop stays usable when open",
      bestFor: "Coffee stations, baking zones, appliance garages — doors disappear",
    },
    standardDoor: {
      skuPrefix: "W-H",
      hardware: null,
      description: "Traditional hutch doors — glass or solid panel",
      bestFor: "Display areas, china hutch, everyday dish storage",
    },
    applianceGarage: {
      skuPrefix: "WGD-H",
      hardware: "PKD",      // pocket door hardware optional
      heights: [24, 30],    // shorter for countertop appliance concealment
      description: "Shorter hutch for hiding countertop appliances",
      bestFor: "Toaster, coffee maker, mixer — concealed but easily accessible",
    },
  },
  // ── Placement rules ──
  placement: {
    // Hutch should NOT go above range (hood zone) or above sink (window zone)
    avoidAboveRange: true,
    avoidAboveSink: true,       // sinks often have windows above
    avoidAboveFridge: true,     // fridge extends to ceiling
    // Best zones for hutch placement
    preferredZones: ["coffee_station", "baking_zone", "butler_pantry", "display"],
    // Hutch works on any wall segment where standard uppers would go,
    // but the cabinet should be ≥ 15" for proper door proportions
    minSegmentWidth: 15,
    // Can mix hutch + standard uppers on same wall (hutch in one zone, standard in another)
    allowMixedWithStandard: true,
  },
  // ── Accessories ──
  accessories: {
    lightRail: false,           // hutch sits on counter, no light rail needed
    crownMould: true,           // crown at top like furniture piece
    interiorLighting: "PWL",    // puck/wire lighting inside for display
    glassOption: "GFD",         // glass front doors for display hutch
  },
  // ── Full-wall hutch option ──
  // When upperApproach === "hutch", ALL uppers on that wall become hutch cabs
  // When hutchZones is specified, only those zones get hutch treatment
  fullWall: false,              // default: zone-specific, not full wall
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
  // ── Special kitchen zones (RoomSketcher-inspired) ──
  breakfast_nook: {
    preferred: ["B3D", "B-FHD"],
    upperApproach: "none",           // typically no uppers over nook seating
    minLength: 48,                   // need ≥48" for nook seating (2 people)
    features: ["banquette", "table_clearance"],
    note: "Breakfast nook: open area with banquette or small table. No uppers — keep open and airy. Often at end of L or U run.",
  },
  desk: {
    preferred: ["FD2HD", "B3D", "BPOS"],  // file drawers, organizer drawers, pull-outs
    upperApproach: "standard",       // wall cabs or open shelves above desk
    features: ["knee_space", "outlet_required"],
    kneeSpaceWidth: 30,              // 30" min knee opening for desk
    kneeSpaceHeight: 27,             // 27" min knee clearance (matches ADA)
    counterHeight: 30,               // desk at 30" not 36" counter height
    note: "Kitchen workstation/command center: lower counter (30\"), knee space, file drawers. RoomSketcher shows this in 'Large Kitchen With Workstation Desk Area'.",
  },
  butler_pantry: {
    preferred: ["B3D", "B-FHD", "BWDMA", "BPOS"],
    upperApproach: "hutch",          // hutch-style or glass-front uppers
    features: ["wine_storage", "serving_counter", "pass_through"],
    minLength: 60,                   // need ≥60" for functional butler's pantry
    note: "Butler's pantry: passage between kitchen and dining. Often features glass-front uppers, wine storage, and serving counter. Eclipse Gable project has this pattern.",
  },
  wet_bar: {
    preferred: ["SB", "B3D", "BPOS"],  // sink base, drawers, pull-out
    upperApproach: "standard",
    features: ["bar_sink", "wine_cooler", "beverage_center", "glass_rack"],
    requiresSink: true,              // wet bar needs a small sink
    maxLength: 72,                   // typically compact (≤72")
    note: "Wet bar zone: small bar sink, wine cooler or beverage center, glass storage. Can be on kitchen wall or adjacent room.",
  },
  coffee_bar: {
    preferred: ["B3D", "BPOS", "B-FHD"],
    upperApproach: "hutch",          // hutch with pocket doors to conceal coffee gear
    features: ["outlet_required", "water_line", "pocket_doors"],
    maxLength: 48,                   // compact — coffee maker + grinder + cups
    note: "Dedicated coffee station: hutch-style upper with pocket doors conceals equipment when not in use. Very popular in RoomSketcher gallery.",
  },
  // Non-kitchen zones
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
  const accessories = layout.accessories || [];
  const numCooks = prefs.numCooks || 1;
  const isADACompliant = prefs.adaCompliant === true;

  // 1. Landing area checks (only for kitchens)
  if (roomConfig.nkbaLandingApplies && layout.appliances) {
    for (const app of layout.appliances) {
      if (app.type === 'range' || app.type === 'cooktop') {
        // NKBA: 12" on one side, 15" on the other (asymmetric)
        const leftLanding = app.leftClearance || 0;
        const rightLanding = app.rightClearance || 0;
        const larger = Math.max(leftLanding, rightLanding);
        const smaller = Math.min(leftLanding, rightLanding);
        if (smaller < LANDING.range.oneSide) {
          issues.push({ rule: "NKBA-Landing-Range", severity: "error",
            message: `Range smaller landing ${smaller}" < ${LANDING.range.oneSide}" minimum (NKBA: 12" one side, 15" other)`,
            location: app.wall });
        }
        if (larger < LANDING.range.otherSide) {
          issues.push({ rule: "NKBA-Landing-Range", severity: "error",
            message: `Range larger landing ${larger}" < ${LANDING.range.otherSide}" minimum (NKBA: 15" on at least one side)`,
            location: app.wall });
        }
      }
      if (app.type === 'sink') {
        const left = app.leftClearance || 0;
        const right = app.rightClearance || 0;
        const primary = Math.max(left, right);
        const secondary = Math.min(left, right);
        if (primary < LANDING.sink.primary) {
          issues.push({ rule: "NKBA-Landing-Sink", severity: "error",
            message: `Sink primary landing ${primary}" < ${LANDING.sink.primary}" minimum`,
            location: app.wall });
        }
        if (secondary < LANDING.sink.secondary) {
          issues.push({ rule: "NKBA-Landing-Sink", severity: "warning",
            message: `Sink secondary landing ${secondary}" < ${LANDING.sink.secondary}" recommended`,
            location: app.wall });
        }
      }
      if (app.type === 'refrigerator') {
        // NKBA: 15" counter on handle side (corrected from previous 24")
        if ((app.handleSideClearance || 0) < LANDING.fridge.handleSide) {
          issues.push({ rule: "NKBA-Landing-Fridge", severity: "warning",
            message: `Fridge handle-side landing ${app.handleSideClearance}" < ${LANDING.fridge.handleSide}" recommended`,
            location: app.wall });
        }
      }
      if (app.type === 'dishwasher') {
        // NKBA: DW must be within 36" of nearest sink edge (not just touching)
        if (app.distFromSink !== undefined && app.distFromSink > LANDING.dw.maxDistFromSink) {
          issues.push({ rule: "NKBA-DW-Sink", severity: "error",
            message: `Dishwasher is ${app.distFromSink}" from sink — must be within ${LANDING.dw.maxDistFromSink}"`,
            location: app.wall });
        } else if (!app.adjacentToSink && app.distFromSink === undefined) {
          // Fallback: if distance not computed, use adjacency check
          issues.push({ rule: "NKBA-DW-Sink", severity: "error",
            message: "Dishwasher must be within 36\" of sink",
            location: app.wall });
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

  // 2b. Trash/waste cabinet presence check — every kitchen needs one
  if (roomConfig.nkbaLandingApplies && ADJACENCY.waste.required) {
    const allCabs = [];
    if (layout.walls) {
      for (const wall of layout.walls) {
        if (wall.cabinets) allCabs.push(...wall.cabinets);
      }
    }
    if (layout.island?.cabinets) allCabs.push(...layout.island.cabinets);

    const hasWaste = allCabs.some(c => {
      const sku = (c.sku || c.model || "").toUpperCase();
      return sku.includes("BWDM") || sku.includes("BWDMW") || sku.includes("BWDMA") || sku.includes("BWDMB");
    });
    if (!hasWaste) {
      issues.push({
        rule: "Design-Trash-Cabinet-Missing",
        severity: "warning",
        message: "No trash/waste pull-out cabinet found — every kitchen should include one near the sink for accessibility and durability"
      });
    }

    // Check trash placement: should not be in a corner cabinet
    if (hasWaste) {
      const wasteCab = allCabs.find(c => {
        const sku = (c.sku || c.model || "").toUpperCase();
        return sku.includes("BWDM");
      });
      if (wasteCab && (wasteCab.role === "corner" || wasteCab.type === "corner")) {
        issues.push({
          rule: "Design-Trash-Corner-Placement",
          severity: "warning",
          message: "Trash pull-out placed in corner cabinet — move to an accessible, straight-run location to prevent wear and improve access"
        });
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
    const walkwayMin = numCooks >= 2
      ? CLEARANCE.twoCookMin           // 48" for 2 cooks
      : CLEARANCE.walkwayAbsoluteMin;  // 36" absolute code minimum
    const walkwayRecommended = numCooks >= 2
      ? CLEARANCE.walkwayRecommended   // 48"
      : CLEARANCE.walkwayMin;          // 42"

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
      // Walkway too wide — feels disconnected & less functional
      if (layout.walkwayClearance > CLEARANCE.walkwayMax) {
        issues.push({
          rule: "Design-Walkway-Too-Wide",
          severity: "warning",
          message: `Walkway clearance ${layout.walkwayClearance}" > ${CLEARANCE.walkwayMax}" — overly wide walkways feel disconnected; consider narrowing or adding an island/peninsula`
        });
      }
    }

    // Island seating clearance
    if (layout.island?.hasSeating && layout.island?.seatingClearance) {
      if (layout.island.seatingClearance < CLEARANCE.seatingMin) {
        issues.push({
          rule: "NKBA-Seating-Clearance",
          severity: "error",
          message: `Island seating clearance ${layout.island.seatingClearance}" < ${CLEARANCE.seatingMin}" minimum for chair pull-out`
        });
      } else if (layout.island.seatingClearance < CLEARANCE.seatingComfortable) {
        issues.push({
          rule: "NKBA-Seating-Clearance",
          severity: "warning",
          message: `Island seating clearance ${layout.island.seatingClearance}" < ${CLEARANCE.seatingComfortable}" recommended for comfortable passage`
        });
      }
    }

    // Fridge behind seating — needs extra clearance for door swing
    if (layout.island?.hasSeating && layout.island?.fridgeBehindSeating) {
      const fridgeClearance = layout.island.fridgeBehindSeatingClearance || layout.island.seatingClearance || 0;
      if (fridgeClearance < CLEARANCE.fridgeBehindSeating) {
        issues.push({
          rule: "NKBA-Fridge-Seating-Clearance",
          severity: "warning",
          message: `Fridge behind seating clearance ${fridgeClearance}" < ${CLEARANCE.fridgeBehindSeating}" recommended (extra space for fridge door + chairs)`
        });
      }
    }

    // Island dimension checks — "One Slab" rule & depth guidelines
    if (layout.island) {
      const iw = layout.island.width || 0;
      const il = layout.island.length || 0;
      if (iw > ISLAND_RULES.oneSlabMaxWidth || il > ISLAND_RULES.oneSlabMaxLength) {
        issues.push({
          rule: "Design-Island-One-Slab",
          severity: "warning",
          message: `Island ${il}" × ${iw}" exceeds single countertop slab (${ISLAND_RULES.oneSlabMaxLength}" × ${ISLAND_RULES.oneSlabMaxWidth}") — seam required; consider reducing size`
        });
      }

      // Seating overhang
      if (layout.island.hasSeating && layout.island.overhang) {
        if (layout.island.overhang < ISLAND_RULES.overhangMin) {
          issues.push({
            rule: "Design-Island-Overhang",
            severity: "error",
            message: `Island seating overhang ${layout.island.overhang}" < ${ISLAND_RULES.overhangMin}" minimum for knee clearance`
          });
        } else if (layout.island.overhang < ISLAND_RULES.overhangIdeal) {
          issues.push({
            rule: "Design-Island-Overhang",
            severity: "warning",
            message: `Island seating overhang ${layout.island.overhang}" < ${ISLAND_RULES.overhangIdeal}" ideal — taller stools may feel cramped`
          });
        }
      }

      // Seating capacity check (width per person)
      if (layout.island.hasSeating && layout.island.seatingLength && layout.island.seatingCount) {
        const neededWidth = layout.island.seatingCount * ISLAND_RULES.widthPerAdult;
        if (layout.island.seatingLength < neededWidth) {
          issues.push({
            rule: "Design-Island-Seating-Width",
            severity: "warning",
            message: `${layout.island.seatingCount} seats need ${neededWidth}" (${ISLAND_RULES.widthPerAdult}"/person) but only ${layout.island.seatingLength}" available`
          });
        }
      }

      // Peninsula suggestion: if island clearance fails on any side, suggest peninsula
      if (layout.island.clearanceToPerimeter && layout.island.clearanceToPerimeter < CLEARANCE.walkwayAbsoluteMin) {
        issues.push({
          rule: "Design-Peninsula-Suggestion",
          severity: "info",
          message: `Island clearance ${layout.island.clearanceToPerimeter}" is tight — consider a peninsula (3-sided clearance, min ${PENINSULA_RULES.minClearance3Sided}") as a space-saving alternative`
        });
      }
    }

    // Counter-to-upper clearance check
    if (layout.prefs?.lightRail && layout.counterToUpperClearance) {
      const effectiveClearance = layout.counterToUpperClearance - DIMS.lightRailThickness;
      if (effectiveClearance < CLEARANCE.counterToUpperMin) {
        issues.push({
          rule: "NKBA-Counter-Upper-Clearance",
          severity: "error",
          message: `Counter-to-upper clearance ${effectiveClearance}" (after ${DIMS.lightRailThickness}" light rail) < ${CLEARANCE.counterToUpperMin}" minimum — raise uppers to compensate`
        });
      }
    }
  }

  // 3b. Traffic flow validation — door/window-aware
  if (layout.walls) {
    for (const wall of layout.walls) {
      const openings = wall.openings || [];
      const doors = openings.filter(o => o.type === "door" || o.type === "entry" || o.type === "archway");
      const windows = openings.filter(o => o.type === "window");
      const cabs = wall.cabinets || [];

      for (const door of doors) {
        const doorStart = door.posFromLeft || 0;
        const doorEnd = doorStart + (door.width || 32);
        // Check no base cabinet overlaps door opening
        for (const cab of cabs) {
          if (typeof cab.position !== "number") continue;
          const cabEnd = cab.position + cab.width;
          if (cab.position < doorEnd && cabEnd > doorStart) {
            issues.push({
              rule: "Traffic-Door-Blocked",
              severity: "error",
              message: `Cabinet ${cab.sku || cab.type} at ${cab.position}"-${cabEnd}" on wall ${wall.wallId || wall.id} blocks door opening at ${doorStart}"-${doorEnd}"`
            });
          }
        }
      }

      // Check island doesn't block any door's traffic lane
      if (layout.island && doors.length > 0) {
        for (const door of doors) {
          if (layout.island.clearanceToPerimeter && layout.island.clearanceToPerimeter < TRAFFIC_FLOW.islandDoorMinDistance) {
            issues.push({
              rule: "Traffic-Island-Blocks-Door",
              severity: "warning",
              message: `Island is ${layout.island.clearanceToPerimeter}" from wall with door — recommend ≥${TRAFFIC_FLOW.islandDoorMinDistance}" for safe traffic flow around door entry`
            });
            break; // one warning per island is enough
          }
        }
      }

      // Window-above-sink preference: check if sink is placed under a window
      if (TRAFFIC_FLOW.sinkPreferWindow && windows.length > 0) {
        const sinkCab = cabs.find(c => c.type === "appliance" && c.applianceType === "sink");
        if (sinkCab) {
          const sinkCenter = sinkCab.position + sinkCab.width / 2;
          const underWindow = windows.some(w => {
            const wStart = w.posFromLeft || 0;
            const wEnd = wStart + (w.width || 36);
            return sinkCenter >= wStart && sinkCenter <= wEnd;
          });
          if (!underWindow) {
            issues.push({
              rule: "Design-Sink-Not-Under-Window",
              severity: "info",
              message: `Sink on wall ${wall.wallId || wall.id} is not centered under a window — consider repositioning for natural light and sightlines`
            });
          }
        }
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

  // 6. Hutch cabinet validation
  if (layout.walls) {
    for (const wall of layout.walls) {
      const hutchCabs = (wall.cabinets || []).filter(c => c.type === "hutch");
      if (hutchCabs.length === 0) continue;

      // Check hutch not placed above range/cooktop
      const appCabs = (wall.cabinets || []).filter(c => c.type === "appliance");
      for (const hutch of hutchCabs) {
        const hStart = hutch.position;
        const hEnd = hStart + hutch.width;
        for (const app of appCabs) {
          const aStart = app.position;
          const aEnd = aStart + (app.width || 0);
          const overlaps = hStart < aEnd && hEnd > aStart;
          if (overlaps && (app.applianceType === "range" || app.applianceType === "cooktop")) {
            issues.push({
              rule: "Design-Hutch-Above-Range",
              severity: "error",
              message: `Hutch cabinet at position ${hStart}" overlaps range zone — hutch should not sit above cooktop (fire hazard, hood required instead)`
            });
          }
          if (overlaps && app.applianceType === "sink") {
            issues.push({
              rule: "Design-Hutch-Above-Sink",
              severity: "warning",
              message: `Hutch cabinet at position ${hStart}" overlaps sink zone — hutch above sink blocks window sightlines; consider standard uppers or open shelving here`
            });
          }
        }
      }

      // Hutch depth check: should be shallower than base for furniture proportions
      for (const hutch of hutchCabs) {
        if (hutch.depth && hutch.depth > 18) {
          issues.push({
            rule: "Design-Hutch-Depth",
            severity: "warning",
            message: `Hutch at position ${hutch.position}" is ${hutch.depth}" deep — hutch should be ≤18" for proper furniture proportions`
          });
        }
      }
    }
  }

  // ── 8. CYNCLY 2020 "25 NEVER DO" VALIDATION (Phase 10) ──────────────────────
  // These rules come from the Cyncly 2020 Kitchen Layout Guide — Frameless.
  // They catch common professional design mistakes that the NKBA landing checks
  // don't cover. Each maps to a specific "Never Do This" from the guide.
  if (roomConfig.nkbaLandingApplies && layout.appliances && layout.walls) {
    const allApps = layout.appliances || [];
    const rangeApp = findAppliance(allApps, 'range') || findAppliance(allApps, 'cooktop');
    const sinkApp = findAppliance(allApps, 'sink');
    const fridgeApp = findAppliance(allApps, 'refrigerator');
    const dwApp = findAppliance(allApps, 'dishwasher');

    // Cyncly Rule: "Never place range in a corner"
    // Range must not be in the first or last position touching a corner junction.
    if (rangeApp && rangeApp.position !== undefined) {
      const rangeWall = layout.walls.find(w => (w.wallId || w.id) === rangeApp.wall);
      if (rangeWall) {
        const wallCorners = (layout.corners || []).filter(c => c.wallA === rangeApp.wall || c.wallB === rangeApp.wall);
        for (const corner of wallCorners) {
          // Corner on left side of this wall (wall is wallB — corner consumes left)
          if (corner.wallB === rangeApp.wall && rangeApp.position < (corner.wallBConsumption || 36) + 3) {
            issues.push({ rule: "Cyncly-Range-In-Corner", severity: "error",
              message: `Range at position ${rangeApp.position}" is in or adjacent to corner — never place range in a corner (poor access, grease on adjacent walls, fire hazard)` });
          }
          // Corner on right side of this wall (wall is wallA — corner consumes right)
          if (corner.wallA === rangeApp.wall) {
            const wallLen = rangeWall.wallLength || rangeWall.length || 0;
            const rangeEnd = rangeApp.position + (rangeApp.width || 30);
            if (rangeEnd > wallLen - (corner.wallAConsumption || 36) - 3) {
              issues.push({ rule: "Cyncly-Range-In-Corner", severity: "error",
                message: `Range ends at ${rangeEnd}" near corner on wall ${rangeApp.wall} — never place range in a corner` });
            }
          }
        }
      }
    }

    // Cyncly Rule: "Never place range under a window"
    if (rangeApp && rangeApp.wall) {
      const rangeWall = layout.walls.find(w => (w.wallId || w.id) === rangeApp.wall);
      if (rangeWall?.openings) {
        const windows = rangeWall.openings.filter(o => o.type === "window");
        for (const win of windows) {
          const wStart = win.posFromLeft || 0;
          const wEnd = wStart + (win.width || 36);
          const rStart = rangeApp.position;
          const rEnd = rStart + (rangeApp.width || 30);
          if (rStart < wEnd && rEnd > wStart) {
            issues.push({ rule: "Cyncly-Range-Under-Window", severity: "error",
              message: `Range overlaps window at ${wStart}"-${wEnd}" — never place range under a window (curtain fire risk, grease on glass, code violations)` });
          }
        }
      }
    }

    // Cyncly Rule: "Never place range next to fridge with no buffer"
    // Minimum 9" buffer between range and fridge; designers recommend 15-24"
    if (rangeApp && fridgeApp && rangeApp.wall === fridgeApp.wall) {
      const rangeEnd = rangeApp.position + (rangeApp.width || 30);
      const fridgeEnd = fridgeApp.position + (fridgeApp.width || 36);
      const gap = Math.min(
        Math.abs(rangeApp.position - fridgeEnd),
        Math.abs(fridgeApp.position - rangeEnd)
      );
      if (gap < 9) {
        issues.push({ rule: "Cyncly-Range-Fridge-Buffer", severity: "error",
          message: `Range and fridge are ${gap}" apart — minimum 9" buffer required (15-24" recommended)` });
      } else if (gap < 15) {
        issues.push({ rule: "Cyncly-Range-Fridge-Buffer", severity: "warning",
          message: `Range and fridge are ${gap}" apart — 15-24" buffer recommended for heat protection` });
      }
    }

    // Cyncly Rule: "Never place range next to tall cabinet without 3" filler"
    // This prevents heat damage and ensures handle clearance
    if (rangeApp && rangeApp.wall) {
      const rangeWall = layout.walls.find(w => (w.wallId || w.id) === rangeApp.wall);
      if (rangeWall) {
        const cabs = rangeWall.cabinets || [];
        const rangeEnd = rangeApp.position + (rangeApp.width || 30);
        // Check for tall cabinets adjacent to range
        const adjacentTalls = cabs.filter(c => {
          if (c.type !== "tall" && c.role !== "tall") return false;
          const cabEnd = c.position + (c.width || 0);
          return Math.abs(c.position - rangeEnd) <= 1 || Math.abs(cabEnd - rangeApp.position) <= 1;
        });
        for (const tall of adjacentTalls) {
          // Check if there's a filler between them
          const hasFiller = cabs.some(c => c.type === "filler" &&
            c.position > Math.min(rangeApp.position, tall.position) &&
            c.position < Math.max(rangeApp.position + (rangeApp.width || 30), tall.position + (tall.width || 0)));
          if (!hasFiller) {
            issues.push({ rule: "Cyncly-Range-Tall-Filler", severity: "error",
              message: `Range is adjacent to tall cabinet without 3" filler — heat damage and handle clearance issues` });
          }
        }
      }
    }

    // Cyncly Rule: "Never place sink in a corner"
    if (sinkApp && sinkApp.position !== undefined) {
      const sinkWall = layout.walls.find(w => (w.wallId || w.id) === sinkApp.wall);
      if (sinkWall) {
        const wallCorners = (layout.corners || []).filter(c => c.wallA === sinkApp.wall || c.wallB === sinkApp.wall);
        for (const corner of wallCorners) {
          if (corner.type === "diagonalSink") continue; // diagonal sink corners are intentional
          if (corner.wallB === sinkApp.wall && sinkApp.position < (corner.wallBConsumption || 36) + 6) {
            issues.push({ rule: "Cyncly-Sink-In-Corner", severity: "warning",
              message: `Sink at position ${sinkApp.position}" is very close to corner — uncomfortable to stand at, limits faucet options` });
          }
        }
      }
    }

    // Cyncly Rule: "Never place DW at right angle to sink"
    // DW must be on same wall as sink, not around a corner
    if (dwApp && sinkApp && dwApp.wall !== sinkApp.wall) {
      issues.push({ rule: "Cyncly-DW-Right-Angle", severity: "error",
        message: `Dishwasher (wall ${dwApp.wall}) and sink (wall ${sinkApp.wall}) are on different walls — never place DW at right angle to sink (awkward loading, water drips across floor)` });
    }

    // Cyncly Rule: "Never bury fridge mid-run"
    // Fridge should be at end of a cabinet run
    if (fridgeApp && fridgeApp.position !== undefined && fridgeApp.wall) {
      const fridgeWall = layout.walls.find(w => (w.wallId || w.id) === fridgeApp.wall);
      if (fridgeWall) {
        const wallLen = fridgeWall.wallLength || fridgeWall.length || 0;
        const fridgeEnd = fridgeApp.position + (fridgeApp.width || 36);
        const distFromLeft = fridgeApp.position;
        const distFromRight = wallLen - fridgeEnd;
        const cornerConsumption = (layout.corners || []).reduce((max, c) => {
          if (c.wallB === fridgeApp.wall) return Math.max(max, c.wallBConsumption || 0);
          if (c.wallA === fridgeApp.wall) return Math.max(max, c.wallAConsumption || 0);
          return max;
        }, 0);
        // Fridge is "mid-run" if it's more than 36" from both ends (accounting for corner)
        const effectiveDistFromLeft = Math.max(0, distFromLeft - cornerConsumption);
        const effectiveDistFromRight = Math.max(0, distFromRight - cornerConsumption);
        if (effectiveDistFromLeft > 36 && effectiveDistFromRight > 36) {
          issues.push({ rule: "Cyncly-Fridge-Mid-Run", severity: "warning",
            message: `Fridge at position ${fridgeApp.position}" appears buried mid-run — fridge should be at the end of a cabinet run for door swing and grocery access` });
        }
      }
    }

    // Cyncly Rule: "Never have a dead corner with no access"
    if (layout.corners) {
      for (const corner of layout.corners) {
        if (corner.type === "deadCorner" || corner.type === "dead") {
          issues.push({ rule: "Cyncly-Dead-Corner", severity: "warning",
            message: `Dead corner at ${corner.id || 'junction'} — wasted space; use a lazy susan, blind corner pull-out, or magic corner instead` });
        }
      }
    }

    // Cyncly Rule: "Never have missing end panels"
    // Check that all exposed cabinet sides have end panels
    // (This is enforced in generateAccessories but validated here for completeness)

    // Cyncly Rule: "Walkway under 36" — below code minimum"
    // Already covered by NKBA walkway clearance check above

    // Cyncly Rule: "Walkway over 50" — kitchen feels disconnected"
    // Already covered by Design-Walkway-Too-Wide check above

    // Cyncly Rule: "Traffic through work triangle"
    // Check if any door opening creates a traffic path through the triangle
    if (rangeApp && sinkApp && fridgeApp) {
      for (const wall of layout.walls) {
        const doors = (wall.openings || []).filter(o => o.type === "door" || o.type === "entry");
        for (const door of doors) {
          const doorCenter = (door.posFromLeft || 0) + ((door.width || 32) / 2);
          // Simple check: if door is on a wall between two triangle vertices,
          // traffic likely crosses through the triangle
          const appsOnWall = allApps.filter(a => a.wall === (wall.wallId || wall.id));
          if (appsOnWall.length >= 2) {
            issues.push({ rule: "Cyncly-Traffic-Through-Triangle", severity: "info",
              message: `Door on wall ${wall.wallId || wall.id} at ${doorCenter}" — verify traffic path does not cross through the work triangle` });
          }
        }
      }
    }

    // Cyncly Rule: "Upper/base misalignment — vertical lines should align"
    // Check that upper cabinet edges align with base cabinet edges below
    if (layout.walls) {
      for (const wall of layout.walls) {
        const baseCabs = (wall.cabinets || []).filter(c => c.type === "base" && typeof c.position === "number");
        const upperCabs = (wall.upperCabinets || wall.uppers || []).filter(c => typeof c.position === "number");
        if (baseCabs.length > 0 && upperCabs.length > 0) {
          // Collect base stile positions (left and right edges)
          const baseEdges = new Set();
          for (const bc of baseCabs) {
            baseEdges.add(Math.round(bc.position));
            baseEdges.add(Math.round(bc.position + bc.width));
          }
          // Check each upper edge aligns with a base edge
          let misalignments = 0;
          for (const uc of upperCabs) {
            const leftEdge = Math.round(uc.position);
            const rightEdge = Math.round(uc.position + uc.width);
            const leftAligned = [...baseEdges].some(e => Math.abs(e - leftEdge) <= 1);
            const rightAligned = [...baseEdges].some(e => Math.abs(e - rightEdge) <= 1);
            if (!leftAligned && !rightAligned) misalignments++;
          }
          if (misalignments > 0) {
            issues.push({ rule: "Cyncly-Upper-Base-Misalignment", severity: "info",
              message: `${misalignments} upper cabinet(s) on wall ${wall.wallId || wall.id} don't align with base cabinet edges — align stiles for visual order` });
          }
        }
      }
    }
  }

  // ─── SECTION 9: RANGE HOOD DESIGN GUIDE VALIDATION ──────────────────────
  // Validates hood mounting height, width sizing, and clearances per the
  // Range Hood Design Guide specifications.
  if (layout.upperLayouts || layout.uppers) {
    const allUppers = (layout.upperLayouts || []).flatMap(ul => ul.cabinets || [])
      .concat(layout.uppers || []);
    const allBases = (layout.wallLayouts || []).flatMap(wl => wl.cabinets || [])
      .concat(layout.bases || []);

    for (const cab of allUppers) {
      const role = cab.role || cab.type || '';
      const isHood = role === 'range_hood' || role === 'rangeHood' ||
        cab.type === 'rangeHood' || (cab.applianceType === 'hood');
      if (!isHood) continue;

      // ── Hood Mounting Height Validation ──
      const mountAFF = cab._hoodMountAFF || (cab._elev && cab._elev.yMount) || 0;
      const cookingSurface = 36;
      const clearance = mountAFF - cookingSurface;
      const rangeType = cab._rangeType || 'standard';

      if (rangeType === 'pro') {
        // Pro: min 27", max 36", optimal 30"
        if (clearance < 27) {
          issues.push({ rule: "Hood-Mount-Too-Low-Pro", severity: "error",
            message: `Hood at ${mountAFF}" AFF is only ${clearance}" above cooking surface — pro range requires minimum 27" clearance (fire hazard)` });
        } else if (clearance > 36) {
          issues.push({ rule: "Hood-Mount-Too-High-Pro", severity: "warning",
            message: `Hood at ${mountAFF}" AFF is ${clearance}" above cooking surface — pro range max recommended is 36" (capture efficiency drops)` });
        }
      } else {
        // Standard: min 24", max 30" (electric: min 20")
        const minClear = rangeType === 'electric' ? 20 : 24;
        if (clearance < minClear) {
          issues.push({ rule: "Hood-Mount-Too-Low", severity: "error",
            message: `Hood at ${mountAFF}" AFF is only ${clearance}" above cooking surface — minimum ${minClear}" clearance required (fire hazard)` });
        } else if (clearance > 30) {
          issues.push({ rule: "Hood-Mount-Too-High", severity: "warning",
            message: `Hood at ${mountAFF}" AFF is ${clearance}" above cooking surface — max recommended is 30" (capture efficiency drops)` });
        }
      }

      // ── Hood Width Validation ──
      // Find the range on same wall
      const rangeOnWall = allBases.find(c =>
        (c.type === 'appliance' || c.applianceType === 'range' || c.applianceType === 'cooktop') &&
        (c.applianceType === 'range' || c.applianceType === 'cooktop') &&
        (c.wall === cab.wall));
      if (rangeOnWall) {
        const rangeW = rangeOnWall.width || 30;
        const hoodW = cab.width || 30;
        if (hoodW < rangeW) {
          issues.push({ rule: "Hood-Width-Too-Narrow", severity: "error",
            message: `Hood width ${hoodW}" is narrower than range ${rangeW}" — hood must be at least as wide as the range` });
        }
      }

      // ── Hood/Upper Horizontal Overlap Check ──
      // Flanking upper cabinets must not overlap the hood horizontally.
      // The skip zone in solveUppers() should prevent this, but validate anyway.
      const hoodStart = cab.position || 0;
      const hoodEnd = hoodStart + (cab.width || 0);
      const flankingUppers = allUppers.filter(u => {
        if (u === cab) return false;
        const uRole = u.role || u.type || '';
        return uRole !== 'range_hood' && uRole !== 'rangeHood' &&
          u.type !== 'rangeHood' && u.wall === cab.wall;
      });
      for (const flank of flankingUppers) {
        const fStart = flank.position || 0;
        const fEnd = fStart + (flank.width || 0);
        const overlap = Math.min(hoodEnd, fEnd) - Math.max(hoodStart, fStart);
        if (overlap > 0) {
          issues.push({ rule: "Hood-Upper-Overlap", severity: "error",
            message: `Hood (${hoodStart}"-${hoodEnd}") overlaps ${flank.sku || 'upper'} (${fStart}"-${fEnd}") by ${overlap}" — flanking uppers must stop at hood edges` });
        }
      }
    }
  }

  // ─── SECTION 10: MOLDINGS & FILLERS VALIDATION ────────────────────────────
  // Golden Rule: In frameless cabinetry, never let a cabinet box touch a wall
  // at a drawer or door edge. Min 3" filler at every wall junction where
  // a drawer or door opens.
  {
    const accessories = layout.accessories || [];
    const allBases = (layout.wallLayouts || []).flatMap(wl => wl.cabinets || []);

    // Check: Crown molding present when ceilingTreatment is "crown"
    const ceilingTreatment = layout.preferences?.ceilingTreatment || layout.prefs?.ceilingTreatment || "crown";
    if (ceilingTreatment === "crown") {
      const hasCrown = accessories.some(a => a.subrole === "crown-moulding");
      if (!hasCrown) {
        issues.push({ rule: "Molding-Missing-Crown", severity: "warning",
          message: "Ceiling treatment is 'crown' but no crown molding found in accessories — add crown or change to 'none'/'to_ceiling'" });
      }
    }

    // Check: Light rail present when under-cabinet lighting specified
    const hasLighting = layout.preferences?.lightingPackage !== "none" || layout.prefs?.lightingPackage !== "none";
    const hasLightRail = accessories.some(a => a.subrole === "light-rail");
    if (hasLighting && !hasLightRail) {
      issues.push({ rule: "Molding-Missing-Light-Rail", severity: "warning",
        message: "Under-cabinet lighting specified but no light rail molding — light rail required to conceal LED strips and wiring" });
    }

    // Check: Toe kick has finished returns at exposed ends
    const hasToeKick = accessories.some(a => a.role === "toe-kick");
    const hasToeKickReturns = accessories.some(a => a.role === "toe-kick-return");
    if (hasToeKick && !hasToeKickReturns) {
      issues.push({ rule: "Molding-Missing-TK-Returns", severity: "info",
        message: "Toe kick present but no finished returns specified — every exposed end needs a mitered return or factory end cap" });
    }

    // Check: Wall fillers at every wall junction (Golden Rule) — BASE cabinets
    for (const wl of (layout.wallLayouts || [])) {
      const baseCabs = (wl.cabinets || []).filter(c => c.type === "base");
      if (baseCabs.length === 0) continue;
      const first = baseCabs[0];
      const wallId = wl.wallId || wl.id;

      // Check left wall junction: is there a filler between wall start and first cabinet?
      if (first.position > 0 && first.position < 3) {
        const hasLeftFiller = accessories.some(a =>
          a.wall === wallId && (a.role === "base-filler-wall-junction-left" || a.role === "base-end-panel-left"));
        if (!hasLeftFiller) {
          issues.push({ rule: "Filler-Missing-Wall-Junction", severity: "warning",
            message: `Wall ${wallId}: Base cabinet at ${first.position}" from wall with < 3" gap — needs filler for drawer/door clearance (frameless golden rule)` });
        }
      }
    }

    // Check: Wall fillers at every wall junction (Golden Rule) — UPPER cabinets
    for (const ul of (layout.upperLayouts || [])) {
      const upperCabs = (ul.cabinets || []).filter(c => {
        const role = c.role || "";
        const isHood = role === "range_hood" || role === "rangeHood" || c.type === "rangeHood";
        const isMicro = c.applianceType === "microwave";
        return c.type !== "appliance" && !isHood && !isMicro;
      });
      if (upperCabs.length === 0) continue;
      const first = upperCabs[0];
      const wallId = ul.wallId || ul.id;

      if (first.position > 0 && first.position < 3) {
        const hasLeftFiller = accessories.some(a =>
          a.wall === wallId && (a.role === "wall-filler-upper-left" || a.role === "wall-end-panel-left"));
        if (!hasLeftFiller) {
          issues.push({ rule: "Filler-Missing-Upper-Wall-Junction", severity: "warning",
            message: `Wall ${wallId}: Upper cabinet at ${first.position}" from wall with < 3" gap — needs upper wall filler (frameless golden rule)` });
        }
      }
    }

    // Check: Wall fillers at wall junctions — TALL cabinets
    const tallCabs = layout.talls || [];
    const tallsByWall = {};
    for (const t of tallCabs) {
      if (!t.wall || typeof t.position !== "number") continue;
      if (!tallsByWall[t.wall]) tallsByWall[t.wall] = [];
      tallsByWall[t.wall].push(t);
    }
    for (const [wallId, wTalls] of Object.entries(tallsByWall)) {
      wTalls.sort((a, b) => a.position - b.position);
      const first = wTalls[0];
      if (first.position > 0 && first.position < 3) {
        const hasLeftFiller = accessories.some(a =>
          a.wall === wallId && a.role === "tall-filler-wall-junction-left");
        if (!hasLeftFiller) {
          issues.push({ rule: "Filler-Missing-Tall-Wall-Junction", severity: "warning",
            message: `Wall ${wallId}: Tall cabinet at ${first.position}" from wall with < 3" gap — needs tall/pantry filler (frameless golden rule)` });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILT-IN REFRIGERATOR DESIGN GUIDE VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  const fridges = (layout.appliances || []).filter(a => a.type === "refrigerator" || a.type === "freezer");
  const panelPrefs = layout.prefs || {};

  for (const fridge of fridges) {
    const fw = Math.round(fridge.width || 36);

    // Check: Fridge must be sandwiched between tall panels or tall cabinets
    const fridgeREPs = accessories.filter(a =>
      (a.role === "rep" || a.role === "frep" || a.type === "rep" || a.type === "frep" ||
       (a.role && a.role.toLowerCase().includes("fridge")) && a.role.includes("panel"))
    );
    if (fridgeREPs.length < 2) {
      issues.push({
        rule: "Fridge-Enclosure-Missing-Panels",
        severity: "error",
        message: `Refrigerator needs panels on BOTH sides — "sandwiched between tall panels" per Built-In Refrigerator Design Guide. Found ${fridgeREPs.length} panel(s).`,
      });
    }

    // Check: Fridge opening height ≥ 74" (ideally 78")
    const aboveFridgeCab = (layout.upperLayouts || []).flatMap(ul => ul.cabinets || [])
      .find(c => c.type === "rw" || c.role === "above_fridge");
    if (aboveFridgeCab) {
      const openingHeight = (aboveFridgeCab.bottomAFF || 84) - 0; // floor to bottom of overhead
      if (openingHeight < 74) {
        issues.push({
          rule: "Fridge-Opening-Height-Too-Low",
          severity: "error",
          message: `Fridge opening height ${openingHeight}" is below 74" minimum. Adjust overhead cabinet position.`,
        });
      }
    }

    // Check: Above-fridge cabinet should be shallow depth (12-15" recommended)
    if (aboveFridgeCab && aboveFridgeCab.depth && aboveFridgeCab.depth > 15) {
      issues.push({
        rule: "Fridge-Overhead-Too-Deep",
        severity: "warning",
        message: `Above-fridge cabinet depth ${aboveFridgeCab.depth}" exceeds recommended 12-15". Items in full-depth overhead above fridge are nearly impossible to retrieve.`,
      });
    }

    // Check: Fridge opening width matches standard sizes
    const validWidths = [18, 24, 30, 36, 42, 48];
    if (!validWidths.includes(fw)) {
      issues.push({
        rule: "Fridge-Non-Standard-Width",
        severity: "warning",
        message: `Fridge width ${fw}" is non-standard. Standard built-in widths: ${validWidths.join(", ")}".`,
      });
    }

    // Check: Ventilation — no back panel on enclosure
    // (informational — we can't directly check this but flag it)
    if (fridge.hasBackPanel) {
      issues.push({
        rule: "Fridge-Enclosure-Back-Panel",
        severity: "error",
        message: `Fridge enclosure must NOT have a back panel — wall behind serves as back. Back panel restricts critical rear ventilation.`,
      });
    }

    // Check: Panel thickness when paneled
    if (panelPrefs.fridgePaneled && fridge.panelThickness && fridge.panelThickness !== 0.75) {
      issues.push({
        rule: "Fridge-Panel-Thickness",
        severity: "warning",
        message: `Fridge panel thickness ${fridge.panelThickness}" — standard is 3/4" (19mm). Check manufacturer max panel weight specs.`,
      });
    }

    // Check: Enclosure depth matches integration level
    if (panelPrefs.fridgeIntegration === "flush" && fridge.enclosureDepth && fridge.enclosureDepth < 25) {
      issues.push({
        rule: "Fridge-Flush-Depth-Insufficient",
        severity: "error",
        message: `Flush inset integration requires 25-27" enclosure depth. Current: ${fridge.enclosureDepth}".`,
      });
    }
  }

  // Check: DW panel consistency
  const dws = (layout.appliances || []).filter(a => a.type === "dishwasher");
  for (const dw of dws) {
    if (panelPrefs.dwPaneled) {
      const dwPanel = accessories.find(a => a.type === "dw_panel" || a.role === "dw_panel");
      if (!dwPanel) {
        issues.push({
          rule: "DW-Panel-Missing",
          severity: "warning",
          message: `Dishwasher set to panel-ready but no DW panel (DWP) found in accessories. Add 3/4" matching panel.`,
        });
      }
    }
  }

  return issues;
}
